import urllib.request
import urllib.error
import time
import random
import json

# Configuration
# URL = "https://los-tecnicos-backend.onrender.com/iot/ping" # Production
URL = "http://localhost:8080/iot/ping" # Local
device_id = "rpi-4b-sim-001"

def generate_telemetry_data():
    node_count = random.randint(0, 5)
    connected_nodes = []
    
    for _ in range(node_count):
        connected_nodes.append({
            "uid": f"node-{random.randint(100, 999)}",
            "voltage": round(random.uniform(220.0, 240.0), 2)
        })
    
    return {
        "device_id": device_id,
        "voltage": round(random.uniform(220.0, 240.0), 2),
        "connected_nodes_count": node_count,
        "connected_nodes": connected_nodes,
        "battery_level": round(random.uniform(20.0, 100.0), 2)
    }

def main():
    print(f"Starting simulation for device: {device_id}")
    print(f"Target URL: {URL}")

    try:
        while True:
            data = generate_telemetry_data()
            json_data = json.dumps(data).encode('utf-8')
            
            req = urllib.request.Request(URL, data=json_data, headers={'Content-Type': 'application/json'})
            
            try:
                with urllib.request.urlopen(req) as response:
                    if response.status == 200:
                        print(f"Sent: {json.dumps(data)}")
                    else:
                        print(f"Failed to send: {response.status} - {response.read().decode('utf-8')}")
            except urllib.error.URLError as e:
                print(f"Error sending request: {e}")
            except ConnectionRefusedError:
                 print(f"Connection refused. Is the backend running at {URL}?")

            time.sleep(2) # Send data every 2 seconds
    except KeyboardInterrupt:
        print("\nSimulation stopped.")

if __name__ == "__main__":
    main()
