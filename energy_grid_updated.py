#!/usr/bin/env python3
"""
ENERGY GRID CONTROLLER — Raspberry Pi Edition
Runs headlessly as a systemd service.

Network layout:
  eth0  / usb0  — internet (10.10.x.x or DHCP from phone tether)
  wlan0          — ESP32 nodes (scanned first, subnet detected dynamically)

Logs to:  /var/log/energy_grid.log  +  systemd journal

Fixes applied over original:
  1. get_socket() drains the ESP32's immediate status push on connect,
     so send_command() always reads the response to its own command
     and never picks up stale buffered data.
  2. resp.read() now happens inside the urllib `with` block so the
     response body is available when command parsing runs.
  3. Added rescan thread (runs every RESCAN_EVERY seconds) so nodes
     that connect after startup are discovered automatically.
  4. Added startup node wait — waits for at least one node to appear
     on the subnet before starting threads, matching observed boot timing.
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

# ═══════════════════════════════════════════════════════════
#  CONFIG
# ═══════════════════════════════════════════════════════════
NODE_PORT      = 8080
TCP_TIMEOUT    = 2.0
MAX_WORKERS    = 100
POLL_EVERY     = 5      # seconds between node status polls
POST_EVERY     = 10     # seconds between API posts
INET_CHECK     = 30     # seconds between internet checks
RESCAN_EVERY   = 30     # seconds between rescans for new nodes

API_URL   = "https://los-tecnicos-backend.onrender.com/iot/ping"
DEVICE_ID = "rpi-4b-prod-01"

LOG_FILE  = "/var/log/energy_grid.log"
PID_FILE  = "/var/run/energy_grid.pid"

NODE_INTERFACES = ["wlan0", "wlan1"]

FALLBACK_SUBNETS = [
    "192.168.4.0/24",
    "192.168.137.0/24",
    "192.168.1.0/24",
    "192.168.0.0/24",
]

# ═══════════════════════════════════════════════════════════
#  LOGGING
# ═══════════════════════════════════════════════════════════
def setup_logging():
    fmt = logging.Formatter(
        "%(asctime)s  %(levelname)-8s  %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    root = logging.getLogger()
    root.setLevel(logging.INFO)

    try:
        fh = logging.handlers.RotatingFileHandler(
            LOG_FILE, maxBytes=5*1024*1024, backupCount=3
        )
        fh.setFormatter(fmt)
        root.addHandler(fh)
    except PermissionError:
        fallback = str(Path.home() / "energy_grid.log")
        fh = logging.handlers.RotatingFileHandler(
            fallback, maxBytes=5*1024*1024, backupCount=3
        )
        fh.setFormatter(fmt)
        root.addHandler(fh)
        logging.warning(f"Cannot write to {LOG_FILE}, using {fallback}")

    sh = logging.StreamHandler(sys.stderr)
    sh.setFormatter(fmt)
    root.addHandler(sh)

log = logging.getLogger("energy_grid")

# ═══════════════════════════════════════════════════════════
#  STATE
# ═══════════════════════════════════════════════════════════
nodes       = {}   # ip → latest status dict
node_socks  = {}   # ip → persistent socket
nodes_lock  = threading.Lock()
internet_ok = False
running     = True

# Cache the subnet found during discovery so rescan uses the same one
_scan_subnet_cache = []

# ═══════════════════════════════════════════════════════════
#  GRACEFUL SHUTDOWN
# ═══════════════════════════════════════════════════════════
def shutdown_handler(signum, frame):
    global running
    log.info(f"Signal {signum} received — shutting down")
    running = False
    for s in node_socks.values():
        try: s.close()
        except: pass
    try: os.remove(PID_FILE)
    except: pass
    sys.exit(0)

signal.signal(signal.SIGTERM, shutdown_handler)
signal.signal(signal.SIGINT,  shutdown_handler)

# ═══════════════════════════════════════════════════════════
#  PID FILE
# ═══════════════════════════════════════════════════════════
def write_pid():
    try:
        with open(PID_FILE, 'w') as f:
            f.write(str(os.getpid()))
    except:
        pass

# ═══════════════════════════════════════════════════════════
#  INTERFACE HELPERS
# ═══════════════════════════════════════════════════════════
def get_interface_ip(iface):
    try:
        out = subprocess.check_output(
            ["ip", "-4", "addr", "show", iface],
            stderr=subprocess.DEVNULL
        ).decode()
        for line in out.splitlines():
            line = line.strip()
            if line.startswith("inet "):
                cidr = line.split()[1]
                ip   = cidr.split('/')[0]
                return ip, cidr
    except:
        pass
    return None, None

def get_interface_subnet(iface):
    _, cidr = get_interface_ip(iface)
    if cidr:
        try:
            net = ipaddress.IPv4Network(cidr, strict=False)
            return str(net)
        except:
            pass
    return None

def wait_for_interface_ip(iface, timeout=120):
    log.info(f"Waiting for {iface} to get IP (timeout {timeout}s)...")
    start = time.time()
    while time.time() - start < timeout:
        ip, _ = get_interface_ip(iface)
        if ip:
            log.info(f"{iface} IP: {ip}")
            return ip
        time.sleep(5)
    log.warning(f"{iface} did not get IP within {timeout}s — will use fallback subnets")
    return None

def get_node_subnets():
    subnets = []
    for iface in NODE_INTERFACES:
        subnet = get_interface_subnet(iface)
        if subnet:
            log.info(f"{iface} subnet: {subnet}")
            subnets.append(subnet)
    if not subnets:
        log.warning("No wlan IP found — using fallback subnets")
        subnets = FALLBACK_SUBNETS.copy()
    return subnets

def get_internet_interface_ip():
    for iface in ["eth0", "usb0", "eth1"]:
        ip, _ = get_interface_ip(iface)
        if ip:
            return ip, iface
    return None, None

# ═══════════════════════════════════════════════════════════
#  INTERNET CHECK
# ═══════════════════════════════════════════════════════════
def check_internet():
    global internet_ok
    try:
        body = json.dumps({"device_id": DEVICE_ID, "status": "heartbeat"}).encode()
        req  = urllib.request.Request(
            API_URL, data=body,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            if resp.status == 200:
                if not internet_ok:
                    log.info("Internet: UP (API reachable)")
                internet_ok = True
                return True
    except:
        pass
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(4)
        s.connect(("1.1.1.1", 443))
        s.close()
        if not internet_ok:
            log.info("Internet: UP (TCP fallback)")
        internet_ok = True
        return True
    except:
        pass
    if internet_ok:
        log.warning("Internet: DOWN")
    internet_ok = False
    return False

# ═══════════════════════════════════════════════════════════
#  NODE DISCOVERY
# ═══════════════════════════════════════════════════════════
def check_port(ip):
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(TCP_TIMEOUT)
        ok = s.connect_ex((str(ip), NODE_PORT)) == 0
        s.close()
        return ok
    except:
        return False

def verify_node(ip):
    """Fresh connection to verify a node — no persistent socket."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(TCP_TIMEOUT)
        s.connect((str(ip), NODE_PORT))
        # Drain immediate push the ESP32 sends on connect
        s.settimeout(0.3)
        try:
            while s.recv(2048):
                pass
        except:
            pass
        s.settimeout(TCP_TIMEOUT)
        s.sendall(b"STATUS\n")
        raw = s.recv(1024).decode(errors='ignore').strip()
        s.close()
        for line in reversed(raw.split('\n')):
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                if 'node' in data and 'voltage' in data:
                    return data
            except:
                continue
    except:
        pass
    return None

def _scan_subnet(subnet, skip_ips=None):
    """
    Scan one subnet for energy nodes.
    skip_ips: set of IPs to skip (already known).
    Returns dict of ip → status for newly found nodes.
    """
    skip_ips = skip_ips or set()
    found = {}

    try:
        hosts = list(ipaddress.IPv4Network(subnet, strict=False).hosts())
    except Exception as e:
        log.error(f"Invalid subnet {subnet}: {e}")
        return found

    candidates = [str(h) for h in hosts if str(h) not in skip_ips]
    if not candidates:
        return found

    live = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futures = {ex.submit(check_port, ip): ip for ip in candidates}
        for future in as_completed(futures):
            ip = futures[future]
            try:
                if future.result():
                    live.append(ip)
            except:
                pass

    if not live:
        return found

    log.info(f"{subnet}: port {NODE_PORT} open on {len(live)} host(s): "
             f"{', '.join(sorted(live))}")

    for ip in sorted(live):
        data = verify_node(ip)
        if data:
            found[ip] = data
            log.info(f"✅ Energy node confirmed: {ip} [{data.get('node')}] "
                     f"v={data.get('voltage')}V soc={data.get('soc')}% "
                     f"state={data.get('state')}")
        else:
            log.debug(f"  {ip}: port open but not an energy node — skipped")

    return found

def discover_nodes():
    """
    One-time startup scan. Populates nodes{} and caches the subnet.
    """
    global _scan_subnet_cache
    subnets = get_node_subnets()
    _scan_subnet_cache = subnets
    log.info(f"Discovery: scanning {len(subnets)} subnet(s): {', '.join(subnets)}")
    found = {}

    for subnet in subnets:
        subnet_found = _scan_subnet(subnet)
        found.update(subnet_found)
        if found and subnet not in FALLBACK_SUBNETS:
            log.info(f"Nodes found on {subnet} — skipping remaining subnets")
            break

    with nodes_lock:
        nodes.clear()
        nodes.update(found)

    log.info(f"Discovery complete — {len(found)} node(s) registered: "
             f"{[d.get('node') for d in found.values()]}")
    return found

def rescan_for_new_nodes():
    """
    Background rescan — only checks IPs not already in nodes{}.
    Called by the rescan thread periodically.
    """
    subnets = _scan_subnet_cache if _scan_subnet_cache else get_node_subnets()

    with nodes_lock:
        already_known = set(nodes.keys())

    newly_found = {}
    for subnet in subnets:
        new = _scan_subnet(subnet, skip_ips=already_known)
        newly_found.update(new)
        if new and subnet not in FALLBACK_SUBNETS:
            break

    if newly_found:
        with nodes_lock:
            nodes.update(newly_found)
        log.info(f"Rescan: {len(newly_found)} new node(s) added: "
                 f"{[d.get('node') for d in newly_found.values()]}")

# ═══════════════════════════════════════════════════════════
#  NODE COMMUNICATION
#
#  FIX 1: get_socket() drains the ESP32's status push that arrives
#  immediately on every new connection. Without this, the first
#  recv() in send_command() reads that stale push instead of the
#  response to the command we just sent — causing commands to appear
#  to return the previous state (typically IDLE) regardless of what
#  the node actually did.
# ═══════════════════════════════════════════════════════════
def get_socket(ip):
    if ip in node_socks:
        try:
            node_socks[ip].getpeername()
            return node_socks[ip]
        except:
            node_socks.pop(ip, None)
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(TCP_TIMEOUT + 1)
        s.connect((ip, NODE_PORT))
        # Drain the status push the ESP32 sends immediately on connect.
        # Use a short timeout so we don't block long if there's nothing.
        s.settimeout(0.3)
        try:
            while s.recv(2048):
                pass
        except:
            pass
        s.settimeout(TCP_TIMEOUT + 1)
        node_socks[ip] = s
        return s
    except Exception as e:
        log.debug(f"Socket to {ip} failed: {e}")
        return None

def send_command(ip, cmd):
    s = get_socket(ip)
    if not s:
        return None
    try:
        s.sendall((cmd.strip() + "\n").encode())
        raw = s.recv(2048).decode(errors='ignore').strip()
        for line in reversed(raw.split('\n')):
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                with nodes_lock:
                    nodes[ip] = data
                return data
            except:
                continue
    except Exception as e:
        log.debug(f"Command '{cmd}' to {ip} failed: {e}")
        node_socks.pop(ip, None)
    return None

def poll_all():
    with nodes_lock:
        ips = list(nodes.keys())
    if not ips:
        return
    for ip in ips:
        data = send_command(ip, "STATUS")
        if data:
            log.debug(f"Poll {ip}: v={data.get('voltage')}V "
                      f"soc={data.get('soc')}% state={data.get('state')}")
        else:
            log.warning(f"No response from {ip} during poll")

# ═══════════════════════════════════════════════════════════
#  API POST
#
#  FIX 2: resp.read() is now called inside the `with` block.
#  urllib closes and drains the response when the `with` block exits,
#  so any read() after it returns an empty string. The body must be
#  read while the response is still open.
# ═══════════════════════════════════════════════════════════
def build_api_payload():
    with nodes_lock:
        node_items = list(nodes.items())

    if not node_items:
        return None

    connected_nodes = [
        {
            "uid":     d.get("node", ip),
            "voltage": float(d.get("voltage", 0))
        }
        for ip, d in node_items
    ]
    primary = node_items[0][1]

    return {
        "device_id":             DEVICE_ID,
        "voltage":               float(primary.get("voltage", 0)),
        "connected_nodes_count": len(node_items),
        "connected_nodes":       connected_nodes,
        "battery_level":         float(primary.get("soc", 0)),
        "state":                 primary.get("state", "UNKNOWN"),
        "timestamp":             datetime.now(timezone.utc).isoformat(),
        "source":                "rpi_energy_grid",
        "nodes_detail": [
            {
                "uid":     d.get("node", ip),
                "ip":      ip,
                "voltage": float(d.get("voltage", 0)),
                "soc":     float(d.get("soc", 0)),
                "state":   d.get("state", "?"),
            }
            for ip, d in node_items
        ]
    }

def post_to_api():
    if not internet_ok:
        log.debug("API post skipped — no internet")
        return False

    payload = build_api_payload()
    if not payload:
        log.debug("API post skipped — no nodes")
        return False

    try:
        body = json.dumps(payload).encode()
        req  = urllib.request.Request(
            API_URL, data=body,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        t0 = time.time()
        with urllib.request.urlopen(req, timeout=8) as resp:
            # FIX 2: read body HERE, inside the with block, before it closes
            resp_body = resp.read().decode()
            ms = int((time.time() - t0) * 1000)
            log.info(f"API post OK {resp.status} — "
                     f"{payload['connected_nodes_count']} node(s)  {ms}ms")

            # ── READ COMMANDS FROM BACKEND ──
            try:
                resp_data = json.loads(resp_body)
                commands  = resp_data.get("commands", [])

                with nodes_lock:
                    name_to_ip     = {d.get("node"): ip for ip, d in nodes.items()}
                    current_states = {ip: d.get("state") for ip, d in nodes.items()}

                # Map backend action strings → firmware TCP commands
                desired_actions = {}
                for cmd in commands:
                    uid = cmd.get("node_id")
                    act = cmd.get("action")
                    if act == "discharge":
                        desired_actions[uid] = "SUPPLY"
                    elif act == "charge":
                        desired_actions[uid] = "RECEIVE"

                # Sync all nodes to desired physical state
                for node_id, ip in name_to_ip.items():
                    desired_tcp_cmd = desired_actions.get(node_id, "IDLE")
                    current_state   = current_states.get(ip, "IDLE")

                    needs_cmd = False
                    if desired_tcp_cmd == "SUPPLY"  and current_state != "SUPPLYING":
                        needs_cmd = True
                    elif desired_tcp_cmd == "RECEIVE" and current_state != "RECEIVING":
                        needs_cmd = True
                    elif desired_tcp_cmd == "IDLE" and current_state in ("SUPPLYING", "RECEIVING"):
                        needs_cmd = True

                    if needs_cmd:
                        log.info(f"⚡ {node_id} state sync: "
                                 f"{current_state} → sending {desired_tcp_cmd}")
                        result = send_command(ip, desired_tcp_cmd)
                        if result:
                            log.info(f"✅ {node_id} responded: "
                                     f"state={result.get('state')}")
                        else:
                            log.warning(f"❌ {node_id} ({ip}) did not respond "
                                        f"to {desired_tcp_cmd}")
            except Exception as e:
                log.debug(f"Command parsing error: {e}")

            return True

    except urllib.error.URLError as e:
        log.warning(f"API post failed: {e.reason}")
    except Exception as e:
        log.warning(f"API post error: {e}")
    return False

# ═══════════════════════════════════════════════════════════
#  STATUS FILE
# ═══════════════════════════════════════════════════════════
STATUS_FILE = "/tmp/energy_grid_status.json"

def write_status_file():
    with nodes_lock:
        node_items = list(nodes.items())
    eth_ip, _ = get_internet_interface_ip()
    wlan_ip, _= get_interface_ip("wlan0")
    payload = {
        "timestamp":  datetime.now(timezone.utc).isoformat(),
        "internet":   internet_ok,
        "eth_ip":     eth_ip,
        "wlan_ip":    wlan_ip,
        "node_count": len(node_items),
        "nodes": {
            ip: {
                "node":    d.get("node"),
                "voltage": d.get("voltage"),
                "soc":     d.get("soc"),
                "state":   d.get("state"),
                "fault":   d.get("fault"),
            }
            for ip, d in node_items
        }
    }
    try:
        with open(STATUS_FILE, 'w') as f:
            json.dump(payload, f, indent=2)
    except Exception as e:
        log.debug(f"Status file write failed: {e}")

# ═══════════════════════════════════════════════════════════
#  BACKGROUND THREADS
# ═══════════════════════════════════════════════════════════
def poll_thread_fn():
    log.info("Poll thread started")
    while running:
        try:
            poll_all()
            write_status_file()
        except Exception as e:
            log.error(f"Poll thread error: {e}")
        time.sleep(POLL_EVERY)

def post_thread_fn():
    log.info("Post thread started")
    check_internet()
    last_inet_check = time.time()
    while running:
        try:
            now = time.time()
            if now - last_inet_check >= INET_CHECK:
                check_internet()
                last_inet_check = now
            post_to_api()
        except Exception as e:
            log.error(f"Post thread error: {e}")
        time.sleep(POST_EVERY)

def rescan_thread_fn():
    """
    FIX 3: Periodically scans for nodes that joined after startup.
    Only checks IPs not already in nodes{} so it's fast after the
    initial population — it skips all known IPs every cycle.
    """
    log.info("Rescan thread started")
    # First rescan runs shortly after startup to catch any node that
    # connected while initial discovery was still running
    time.sleep(15)
    while running:
        try:
            rescan_for_new_nodes()
        except Exception as e:
            log.error(f"Rescan thread error: {e}")
        time.sleep(RESCAN_EVERY)

def cmd_server_fn():
    try:
        srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        srv.bind(("0.0.0.0", 9090))
        srv.listen(5)
        srv.settimeout(2)
        log.info("Command server listening on port 9090")
        while running:
            try:
                conn, addr = srv.accept()
                t = threading.Thread(
                    target=handle_cmd_client, args=(conn, addr), daemon=True
                )
                t.start()
            except socket.timeout:
                continue
            except Exception as e:
                log.debug(f"CMD server accept error: {e}")
    except Exception as e:
        log.error(f"CMD server failed to start: {e}")

def handle_cmd_client(conn, addr):
    try:
        raw = conn.recv(1024).decode(errors='ignore').strip()
        if not raw:
            conn.close()
            return
        req = json.loads(raw)
        ip  = req.get("target")
        cmd = req.get("cmd", "STATUS").upper()

        if not ip:
            with nodes_lock:
                resp = {"nodes": list(nodes.values())}
        else:
            data = send_command(ip, cmd)
            resp = data if data else {"error": f"no response from {ip}"}

        conn.sendall((json.dumps(resp) + "\n").encode())
    except Exception as e:
        log.debug(f"CMD server client error: {e}")
    finally:
        conn.close()

# ═══════════════════════════════════════════════════════════
#  STARTUP
# ═══════════════════════════════════════════════════════════
def log_system_info():
    log.info("=" * 60)
    log.info("ENERGY GRID CONTROLLER — STARTING")
    log.info(f"PID: {os.getpid()}")
    log.info(f"API: {API_URL}")
    log.info(f"Device ID: {DEVICE_ID}")
    for iface in ["eth0", "usb0", "wlan0", "wlan1"]:
        ip, cidr = get_interface_ip(iface)
        if ip: log.info(f"Interface {iface}: {ip} ({cidr})")
        else:  log.info(f"Interface {iface}: no IP")
    log.info("=" * 60)

def wait_for_first_node(subnet, timeout=120, poll_interval=5):
    """
    Wait until at least one node is visible on the subnet.
    wlan0 getting an IP only means the hotspot is up — ESP32s
    take another 30-90s to boot and get DHCP leases.
    """
    log.info(f"Waiting for nodes on {subnet} (up to {timeout}s)...")
    deadline = time.time() + timeout
    attempt  = 0
    while time.time() < deadline:
        attempt  += 1
        remaining = int(deadline - time.time())
        live = []
        try:
            hosts = list(ipaddress.IPv4Network(subnet, strict=False).hosts())
            with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
                futures = {ex.submit(check_port, str(h)): str(h) for h in hosts}
                for f in as_completed(futures):
                    if f.result():
                        live.append(futures[f])
        except Exception as e:
            log.debug(f"Node wait scan error: {e}")
        if live:
            log.info(f"  Node(s) visible after {attempt} scan(s): "
                     f"{', '.join(sorted(live))}")
            return True
        log.info(f"  No nodes yet (attempt {attempt}, {remaining}s remaining)...")
        time.sleep(poll_interval)
    log.warning(f"No nodes found after {timeout}s — "
                f"proceeding; rescan thread will pick them up")
    return False

def main():
    setup_logging()
    write_pid()
    log_system_info()

    # Wait for wlan0 IP
    wlan_ip, _ = get_interface_ip("wlan0")
    if not wlan_ip:
        log.info("wlan0 has no IP — waiting up to 60s...")
        wlan_ip = wait_for_interface_ip("wlan0", timeout=60)

    # Wait for at least one node to appear on the subnet before discovery.
    # This is the key step: wlan0 having an IP ≠ ESP32s have connected.
    if wlan_ip:
        subnet = get_interface_subnet("wlan0") or "10.42.0.0/24"
        wait_for_first_node(subnet, timeout=120, poll_interval=5)

    # Internet check
    log.info("Checking internet connectivity...")
    check_internet()
    log.info(f"Internet: {'UP' if internet_ok else 'DOWN'}")

    # One-time node discovery
    log.info("Starting one-time node discovery...")
    discover_nodes()

    # Start background threads
    threads = [
        threading.Thread(target=poll_thread_fn,    name="poll",    daemon=True),
        threading.Thread(target=post_thread_fn,    name="post",    daemon=True),
        threading.Thread(target=rescan_thread_fn,  name="rescan",  daemon=True),
        threading.Thread(target=cmd_server_fn,     name="cmdsrv",  daemon=True),
    ]
    for t in threads:
        t.start()
        log.info(f"Thread started: {t.name}")

    log.info("All threads running — entering main loop")

    last_heartbeat = 0
    while running:
        now = time.time()
        if now - last_heartbeat >= 60:
            with nodes_lock:
                n       = len(nodes)
                summary = [
                    f"{d.get('node')}={d.get('voltage')}V/"
                    f"{d.get('soc')}%/{d.get('state')}"
                    for d in nodes.values()
                ]
            log.info(f"Heartbeat — nodes:{n} "
                     f"internet:{'UP' if internet_ok else 'DOWN'} "
                     f"| {' '.join(summary) if summary else 'no nodes'}")
            last_heartbeat = now
        time.sleep(5)

if __name__ == "__main__":
    main()
