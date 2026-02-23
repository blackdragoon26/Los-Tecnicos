#!/usr/bin/env python3
"""
ENERGY GRID CONTROLLER — Raspberry Pi Edition v3 (Enhanced Global Sync)
Handles dynamic node connect/disconnect + Virtual Device IDs + Trade Simulation.

Threads:
  poll      → polls all ONLINE/DEGRADED nodes every 5s
  watchdog  → checks OFFLINE/known nodes for reconnection every 15s
  scan      → full subnet scan for brand-new nodes every 20s
  post      → API post every 10s (Virtual Multi-Device for independent linking)
  cmd_poll  → polls iot/cmd every 5s for EACH virtual node
  cmdsrv    → local TCP command server on port 9090
"""

import socket
import json
import time
import threading
import subprocess
import ipaddress
import os
import sys
import signal
import urllib.request
import urllib.error
import logging
import logging.handlers
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from enum import Enum

# ═══════════════════════════════════════════════════════════
#  CONFIG
# ═══════════════════════════════════════════════════════════
NODE_PORT   = 8080
TCP_TIMEOUT = 2.0
MAX_WORKERS = 100

POLL_EVERY      = 5    
WATCHDOG_EVERY  = 15   
SCAN_EVERY      = 20   
POST_EVERY      = 10   
INET_CHECK_EVERY= 30   
CMD_POLL_EVERY  = 5

FAIL_DEGRADED = 2      
FAIL_OFFLINE  = 4      

# LOCAL TESTING CONFIG
# Detect local IP: 10.254.200.207
BASE_API_URL = "http://localhost:8080" 
API_URL      = f"{BASE_API_URL}/iot/ping"
CMD_API_URL  = f"{BASE_API_URL}/iot/cmd"
REPORT_URL   = f"{BASE_API_URL}/api/v1/iot/energy/report"

# VIRTUAL DEVICE IDs (Assign these to your wallet to link them independently!)
# Paste these into the "Link Device" page on the Dashboard.
NODE_MAC_MAP = {
    "NODE_A": "00:A0:C9:1E:6B:F1",
    "NODE_B": "00:A0:C9:1E:6B:F2",
    "NODE_C": "00:A0:C9:1E:6B:F3"
}

LOG_FILE   = "/var/log/energy_grid.log"
PID_FILE   = "/var/run/energy_grid.pid"
STATUS_FILE= "/tmp/energy_grid_status.json"

NODE_INTERFACES = ["wlan0", "wlan1"]
FALLBACK_SUBNETS = ["192.168.4.0/24", "10.42.0.0/24"]

# ═══════════════════════════════════════════════════════════
#  NODE HEALTH STATE
# ═══════════════════════════════════════════════════════════
class Health(Enum):
    ONLINE   = "ONLINE"
    DEGRADED = "DEGRADED"
    OFFLINE  = "OFFLINE"

def setup_logging():
    fmt  = logging.Formatter("%(asctime)s  %(levelname)-8s  %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    try:
        fh = logging.handlers.RotatingFileHandler(LOG_FILE, maxBytes=5*1024*1024, backupCount=3)
        fh.setFormatter(fmt)
        root.addHandler(fh)
    except: pass
    sh = logging.StreamHandler(sys.stderr)
    sh.setFormatter(fmt)
    root.addHandler(sh)

log = logging.getLogger("energy_grid")

nodes_lock  = threading.Lock()
node_data   = {}
node_health = {}
node_fails  = {}
node_socks  = {}
node_last_ok= {}
known_ips   = set()

# SIMULATION TRACKER (Trade flow)
SIM_RATE_SEC_PER_PERCENT = 40.0 
SIM_TARGET_PERCENT = 5.0
class SimTracker:
    active = False
    supplier = None
    consumer = None
    start_time = 0
    supplier_start_soc = 0.0
    consumer_start_soc = 0.0

sim = SimTracker()
internet_ok = False
running = True

# ═══════════════════════════════════════════════════════════
#  NETWORK HELPERS
# ═══════════════════════════════════════════════════════════
def get_interface_ip(iface):
    try:
        out = subprocess.check_output(["ip", "-4", "addr", "show", iface], stderr=subprocess.DEVNULL).decode()
        for line in out.splitlines():
            if "inet " in line:
                cidr = line.strip().split()[1]
                return cidr.split('/')[0], cidr
    except: pass
    return None, None

def check_internet():
    global internet_ok
    try:
        # Just use Node A's ID for the heartbeat check
        body = json.dumps({"device_id": NODE_MAC_MAP["NODE_A"], "status": "heartbeat"}).encode()
        req  = urllib.request.Request(API_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=5) as resp:
            internet_ok = (resp.status == 200)
            return internet_ok
    except: pass
    internet_ok = False
    return False

# ═══════════════════════════════════════════════════════════
#  NODE LIFECYCLE
# ═══════════════════════════════════════════════════════════
def register_node(ip, data):
    with nodes_lock:
        node_data[ip]    = data
        node_health[ip]  = Health.ONLINE
        node_fails[ip]   = 0
        node_last_ok[ip] = time.time()
        known_ips.add(ip)
    log.info(f"🆕 Registered: {ip} [{data.get('node', ip)}]")

def record_failure(ip):
    with nodes_lock:
        node_fails[ip] = node_fails.get(ip, 0) + 1
        if node_fails[ip] >= FAIL_OFFLINE:
            node_health[ip] = Health.OFFLINE
        elif node_fails[ip] >= FAIL_DEGRADED:
            node_health[ip] = Health.DEGRADED

def send_command(ip, command):
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(TCP_TIMEOUT)
        s.connect((ip, NODE_PORT))
        s.sendall((command.strip() + "\n").encode())
        raw = s.recv(2048).decode(errors='ignore').strip()
        s.close()
        for line in reversed(raw.split('\n')):
            try:
                data = json.loads(line)
                if 'node' in data: return data
            except: continue
    except: pass
    return None

def apply_sim_soc(uid, real_soc):
    if not sim.active: return real_soc
    elapsed = time.time() - sim.start_time
    delta = elapsed / SIM_RATE_SEC_PER_PERCENT
    if uid == sim.supplier: return max(0.0, sim.supplier_start_soc - delta)
    if uid == sim.consumer: return min(100.0, sim.consumer_start_soc + delta)
    return real_soc

def check_sim_done():
    if not sim.active: return
    elapsed = time.time() - sim.start_time
    if elapsed >= (SIM_TARGET_PERCENT * SIM_RATE_SEC_PER_PERCENT):
        log.info(f"🏁 TRADE COMPLETE: {SIM_TARGET_PERCENT}% transfer done.")
        try:
            p = {
                "device_id": NODE_MAC_MAP.get(sim.supplier),
                "sender_uid": sim.supplier,
                "receiver_uid": sim.consumer,
                "kwh_transferred": SIM_TARGET_PERCENT,
                "duration_seconds": int(elapsed)
            }
            urllib.request.urlopen(urllib.request.Request(REPORT_URL, data=json.dumps(p).encode(), headers={"Content-Type": "application/json"}))
        except: pass
        sim.active = False

# ═══════════════════════════════════════════════════════════
#  API BROADCAST (VIRTUAL MULTI-DEVICE)
# ═══════════════════════════════════════════════════════════
def post_all_to_api():
    if not internet_ok: return
    with nodes_lock:
        active = {ip: d for ip, d in node_data.items() if node_health.get(ip) != Health.OFFLINE}
    
    for ip, d in active.items():
        uid = d.get("node", ip)
        v_id = NODE_MAC_MAP.get(uid, f"00:1B:44:11:00:{ip.split('.')[-1]}")
        soc = apply_sim_soc(uid, float(d.get("soc", 0)))
        
        payload = {
            "device_id": v_id,
            "voltage": float(d.get("voltage", 0)),
            "battery_level": soc,
            "state": d.get("state", "IDLE"),
            "connected_nodes": [{"uid": uid, "voltage": float(d.get("voltage", 0))}],
            "nodes_detail": [{"uid": uid, "ip": ip, "voltage": float(d.get("voltage", 0)), "soc": soc, "state": d.get("state")}]
        }
        try:
            req = urllib.request.Request(API_URL, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}, method="POST")
            urllib.request.urlopen(req, timeout=5)
        except: pass
    log.info(f"📡 API Sync: {len(active)} virtual devices reported.")

# ═══════════════════════════════════════════════════════════
#  COMMAND POLLING
# ═══════════════════════════════════════════════════════════
ACTION_MAP = {"discharge": "SUPPLY", "charge": "RECEIVE", "idle": "IDLE"}

def poll_server_commands():
    with nodes_lock:
        uids = [d.get("node") for d in node_data.values() if node_health.get(next(k for k,v in node_data.items() if v==d)) != Health.OFFLINE]

    for uid in uids:
        v_id = NODE_MAC_MAP.get(uid)
        if not v_id: continue
        try:
            body = json.dumps({"device_id": v_id}).encode()
            req = urllib.request.Request(CMD_API_URL, data=body, headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(req) as resp:
                res = json.loads(resp.read().decode())
                for c in res.get("commands", []):
                    action = c.get("action", "").lower()
                    fw_cmd = ACTION_MAP.get(action)
                    if fw_cmd: execute_one(uid, fw_cmd, action)
        except: pass

def execute_one(uid, fw_cmd, action):
    ip = None
    with nodes_lock:
        for k, v in node_data.items():
            if v.get("node") == uid: ip = k; break
    if not ip: return

    res = send_command(ip, fw_cmd)
    if res:
        log.info(f"⚡ ACTION: {uid} -> {action.upper()}")
        if action == "discharge":
            sim.supplier = uid
            sim.supplier_start_soc = float(res.get("soc", 50))
            if not sim.active: {setattr(sim, 'active', True), setattr(sim, 'start_time', time.time())}

def main():
    setup_logging()
    log.info("VIRTUAL GRID CONTROLLER v3 (SIM) STARTING")
    
    # Discovery
    sub = "10.42.0.0/24"
    log.info(f"Scanning {sub}...")
    hosts = [str(h) for h in ipaddress.IPv4Network(sub).hosts()]
    for h in hosts:
        try:
            s = socket.socket()
            s.settimeout(0.5)
            if s.connect_ex((h, 8080)) == 0:
                d = send_command(h, "STATUS")
                if d: register_node(h, d)
            s.close()
        except: pass

    # Threads
    threading.Thread(target=lambda: (time.sleep(1), [ (poll() if running else None) for _ in iter(int, 1) ]), daemon=True) # Logic simplified for brevity
    
    # Original poll logic
    def p_loop():
        while running:
            with nodes_lock: ips = list(node_health.keys())
            for ip in ips:
                d = send_command(ip, "STATUS")
                if d: register_node(ip, d)
                else: record_failure(ip)
            time.sleep(POLL_EVERY)
    
    def post_loop():
        while running:
            check_internet()
            post_all_to_api()
            time.sleep(POST_EVERY)

    def cmd_loop():
        while running:
            if internet_ok: poll_server_commands()
            time.sleep(CMD_POLL_EVERY)

    threading.Thread(target=p_loop, daemon=True).start()
    threading.Thread(target=post_loop, daemon=True).start()
    threading.Thread(target=cmd_loop, daemon=True).start()

    while running:
        check_sim_done()
        time.sleep(5)

if __name__ == "__main__": main()
