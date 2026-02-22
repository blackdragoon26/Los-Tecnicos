import time
import json
import random
import requests
import threading

API_URL = "http://localhost:8080/api/v1/iot/ping"
REPORT_URL = "http://localhost:8080/api/v1/iot/energy/report"
DEVICE_ID = "rpi-mock-demo"

# Mock nodes for the video
nodes = {
    "NODE_A": {"ip": "192.168.1.10", "soc": 85.0, "status": "idle", "voltage": 4.1},
    "NODE_B": {"ip": "192.168.1.11", "soc": 40.0, "status": "idle", "voltage": 3.7},
    "NODE_C": {"ip": "192.168.1.12", "soc": 95.0, "status": "idle", "voltage": 4.2}
}

active_transfers = {}

def simulate_transfer(sender, receiver):
    print(f"\n⚡ SIMULATING TRANSFER: {sender} -> {receiver}")
    nodes[sender]["status"] = "discharging"
    nodes[receiver]["status"] = "charging"
    
    # Simulate a fast "time lapse" transfer for the video (10 seconds = 0.5 kWh)
    for i in range(10):
        time.sleep(1)
        nodes[sender]["soc"] = max(0, nodes[sender]["soc"] - 0.5)
        nodes[receiver]["soc"] = min(100, nodes[receiver]["soc"] + 0.45) # 10% line loss
    
    nodes[sender]["status"] = "idle"
    nodes[receiver]["status"] = "idle"
    
    # Report the completed transfer to mint tokens!
    report_payload = {
        "device_id": DEVICE_ID,
        "sender_uid": sender,
        "receiver_uid": receiver,
        "kwh_transferred": 0.5,
        "duration_seconds": 10.0,
        "avg_voltage": 3.9,
        "avg_current": 1.2
    }
    try:
        res = requests.post(REPORT_URL, json=report_payload)
        print(f"💰 TRANSFER REPORTED! {res.json()}")
    except Exception as e:
        print(f"Report err: {e}")

def main():
    print("🚀 Mock Raspberry Pi Simulator Started!")
    print(f"Sending data to {API_URL} every 5 seconds...")
    print("Use this to record your frontend demo without actual hardware.")
    
    while True:
        payload = {
            "device_id": DEVICE_ID,
            "timestamp": int(time.time()),
            "nodes": [
                {
                    "uid": uid,
                    "ip": data["ip"],
                    "status": data["status"],
                    "soc": data["soc"],
                    "voltage": data["voltage"],
                    "current": 0.0 if data["status"] == "idle" else 1.5,
                    "temperature": 32.5 + random.uniform(-0.5, 0.5)
                }
                for uid, data in nodes.items()
            ]
        }
        
        try:
            res = requests.post(API_URL, json=payload, timeout=2)
            backend_response = res.json()
            commands = backend_response.get("commands", [])
            print(f"📡 Ping Sent! Nodes: {list(nodes.keys())} | Backend Commands: {commands}")
            
            # Check if backend ordered a transfer
            if commands:
                sender = None
                receiver = None
                for cmd in commands:
                    if cmd["action"] == "discharge": sender = cmd["node_id"]
                    if cmd["action"] == "charge": receiver = cmd["node_id"]
                
                # If we have a new pair and aren't already simulating it
                transfer_key = f"{sender}_{receiver}"
                if sender and receiver and transfer_key not in active_transfers:
                    active_transfers[transfer_key] = True
                    threading.Thread(target=simulate_transfer, args=(sender, receiver)).start()

        except Exception as e:
            print(f"⚠️ Failed to connect to backend: {e}")
            
        time.sleep(5)

if __name__ == "__main__":
    main()
