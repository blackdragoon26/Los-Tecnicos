📋 PROMPT 5: Raspberry Pi Mesh Network Developer (Python + Networking)
You are building firmware for Raspberry Pi devices that create a decentralized mesh network for the energy trading platform.

HARDWARE:
- Device: Raspberry Pi 4 Model B (4GB RAM recommended)
- Additional: USB WiFi adapter for mesh networking (802.11s)
- Storage: 32GB microSD card
- Power: PoE HAT or standard power supply
- Enclosure: Weatherproof for outdoor placement

NETWORK ROLE:
Raspberry Pi devices act as relay nodes that:
- Connect energy trading participants (donors, recipients, ESP32 devices)
- Route data between local community members and backend server
- Create resilient mesh network topology
- Earn cryptocurrency rewards based on network contribution

CORE FUNCTIONALITIES:

1. MESH NETWORK FORMATION
   - Implement 802.11s mesh networking protocol
   - Auto-discover nearby Raspberry Pi nodes
   - Establish peer connections using batman-adv (Better Approach To Mobile Ad-hoc Networking)
   - Maintain routing table for efficient packet forwarding
   - Handle node join/leave gracefully
   - Network topology: Each node connects to 3-8 neighbors
   - Broadcast beacon every 30 seconds for discovery

2. DATA ROUTING & FORWARDING
   - Act as MQTT relay between ESP32 devices and backend
   - Implement store-and-forward for offline resilience
   - Traffic types:
     * ESP32 ↔ Backend (energy data, lock commands)
     * Node ↔ Node (mesh management)
     * Node ↔ Backend (performance metrics)
   - QoS handling: Priority queue for time-sensitive energy transactions
   - Packet deduplication to prevent loops

3. PERFORMANCE MONITORING
   - Track metrics:
     * Packets routed (total count)
     * Data volume (MB transferred)
     * Uptime percentage
     * Average latency (ms)
     * Connected peers count
     * Network coverage area (estimated based on GPS if available)
   - Log to local SQLite database
   - Periodic reporting to backend (every 5 minutes)

4. INCENTIVE SYSTEM INTEGRATION
   - Generate cryptographic proofs of routing work
   - Proof structure: { node_id, packet_count, timestamp, merkle_root, signature }
   - Submit proofs to blockchain for reward claims
   - Local wallet for receiving XLM rewards
   - Display earnings on local web interface

5. NETWORK HEALTH MONITORING
   - Heartbeat checks to all connected peers (every 60s)
   - Detect and report network partitions
   - Bandwidth testing between nodes
   - Signal strength monitoring (if WiFi)
   - Automatic route optimization based on latency

6. SECURITY FEATURES
   - Encrypted mesh traffic (WPA3 or WireGuard tunnels)
   - Node authentication using public key infrastructure
   - Rate limiting to prevent abuse
   - Anomaly detection (unusual traffic patterns)
   - Firewall rules (allow only necessary ports)
   - DDoS protection mechanisms

7. LOCAL WEB DASHBOARD
   - Accessible at http://{node_ip}:8080
   - Shows:
     * Node status (online, uptime)
     * Connected peers (map visualization)
     * Packets routed today/week/month
     * Earnings (XLM)
     * Network topology graph
     * Configuration panel (WiFi settings, backend server)
   - Mobile-responsive interface

8. BOOTSTRAP & AUTO-CONFIGURATION
   - On first boot:
     * Generate unique node ID
     * Create cryptographic key pair
     * Scan for existing mesh networks
     * Join if found, else create new mesh
     * Register with backend server
   - Setup wizard accessible via Ethernet or AP mode

CODE STRUCTURE:
```python
# main.py - Entry point
import asyncio
import logging
from mesh_network import MeshNode
from mqtt_relay import MQTTRelay
from performance_tracker import PerformanceTracker
from blockchain_client import BlockchainClient
from web_dashboard import start_dashboard

# Configuration
NODE_ID = generate_node_id()
BACKEND_URL = "https://api.yourdomain.com"
STELLAR_HORIZON = "https://horizon-testnet.stellar.org"

async def main():
    # Initialize components
    mesh = MeshNode(NODE_ID)
    mqtt_relay = MQTTRelay(mesh)
    perf_tracker = PerformanceTracker()
    blockchain_client = BlockchainClient(STELLAR_HORIZON)
    
    # Start mesh networking
    await mesh.start()
    
    # Start MQTT relay
    await mqtt_relay.start()
    
    # Start performance tracking
    asyncio.create_task(perf_tracker.monitor())
    
    # Start web dashboard
    asyncio.create_task(start_dashboard(mesh, perf_tracker))
    
    # Main loop
    while True:
        # Route packets
        await mesh.process_packets()
        
        # Submit proofs every hour
        if perf_tracker.should_submit_proof():
            proof = perf_tracker.generate_proof()
            await blockchain_client.submit_proof(proof)
        
        await asyncio.sleep(0.1)

# mesh_network.py
class MeshNode:
    def __init__(self, node_id):
        self.node_id = node_id
        self.peers = {}
        self.routing_table = {}
        
    async def start(self):
        # Initialize batman-adv
        # Start beacon broadcasting
        # Listen for peer connections
        pass
    
    async def discover_peers(self):
        # Scan for other nodes
        # Handshake protocol
        # Update peer list
        pass
    
    async def route_packet(self, packet):
        # Determine next hop from routing table
        # Forward packet
        # Update performance metrics
        pass
    
    def update_routing_table(self):
        # Dijkstra's algorithm for shortest path
        # Consider latency and bandwidth
        pass

# mqtt_relay.py
class MQTTRelay:
    def __init__(self, mesh_node):
        self.mesh = mesh_node
        self.mqtt_client = None
        
    async def start(self):
        # Connect to backend MQTT broker
        # Subscribe to relevant topics
        # Start relay loop
        pass
    
    async def relay_esp32_message(self, message):
        # Receive from mesh
        # Forward to backend via MQTT
        pass
    
    async def relay_backend_message(self, message):
        # Receive from backend MQTT
        # Forward to ESP32 via mesh
        pass

# performance_tracker.py
class PerformanceTracker:
    def __init__(self):
        self.packets_routed = 0
        self.data_volume = 0
        self.start_time = time.time()
        
    async def monitor(self):
        while True:
            # Update metrics
            # Calculate uptime
            # Report to backend
            await asyncio.sleep(300)  # Every 5 min
    
    def generate_proof(self):
        # Create merkle tree of routed packet hashes
        # Sign with node private key
        # Return proof structure
        pass

# blockchain_client.py
class BlockchainClient:
    def __init__(self, horizon_url):
        self.horizon = horizon_url
        self.keypair = load_or_generate_keypair()
        
    async def submit_proof(self, proof):
        # Build Stellar transaction
        # Call incentive smart contract
        # Submit to network
        # Handle confirmation
        pass
    
    async def claim_rewards(self):
        # Query earned rewards from contract
        # Submit claim transaction
        pass
```

NETWORK TOPOLOGY VISUALIZATION:
  [Pi Node A]
   /   |   \
  /    |    \
[Pi B]  [Pi C]  [Pi D]
|      / \      |
|     /   \     |
[ESP32] [ESP32] [ESP32]
|       |       |
[Donor] [Recip] [Donor]

PACKET ROUTING EXAMPLE:
1. ESP32 (Donor) publishes energy status
2. Nearest Pi Node B receives via WiFi
3. Pi Node B checks routing table: Backend reachable via Pi Node A
4. Pi Node B forwards to Pi Node A
5. Pi Node A forwards to Backend MQTT broker
6. Both nodes increment packet counters

REWARD CALCULATION (Backend):
- Base reward: 0.01 XLM per 1000 packets routed
- Bonus for uptime: +10% if uptime >95%
- Bonus for low latency: +5% if avg latency <100ms
- Penalty for downtime: -20% if uptime <80%
- Community vote can adjust parameters via governance

INSTALLATION SCRIPT:
```bash
#!/bin/bash
# install.sh - Automated Raspberry Pi setup

# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y python3 python3-pip batman-adv dnsmasq hostapd

# Enable batman-adv
sudo modprobe batman-adv
echo "batman-adv" | sudo tee -a /etc/modules

# Install Python packages
pip3 install asyncio paho-mqtt stellar-sdk flask

# Download node software
git clone https://github.com/yourusername/energy-mesh-node.git
cd energy-mesh-node

# Run setup wizard
python3 setup_wizard.py

# Create systemd service
sudo cp energy-node.service /etc/systemd/system/
sudo systemctl enable energy-node
sudo systemctl start energy-node

echo "Mesh node installation complete!"
echo "Access dashboard at http://$(hostname -I | cut -d' ' -f1):8080"
```

TESTING SCENARIOS:
1. Single node test (node ↔ backend)
2. Two-node relay test (node A ↔ node B ↔ backend)
3. Network partition recovery
4. High traffic stress test (1000 packets/sec)
5. Node failure & re-routing
6. ESP32 connection via mesh

OUTPUT REQUIREMENTS:
1. Complete Python codebase (modular structure)
2. Installation script for Raspberry Pi OS
3. Configuration files (batman-adv, dnsmasq, hostapd)
4. Web dashboard (HTML/CSS/JS)
5. Blockchain integration module
6. Performance monitoring tools
7. Network topology visualization
8. Logging and debugging utilities
9. User manual for node operators
10. Troubleshooting guide

PERFORMANCE TARGETS:
- Packet latency: <200ms for 3-hop route
- Throughput: >10 Mbps per node
- Uptime: >99% availability
- Max network size: 500 nodes per community
- Auto-healing time: <30 seconds after node failure

SECURITY CONSIDERATIONS:
- WPA3 encryption for mesh links
- TLS for backend communication
- Private keys stored in encrypted partition
- Regular security updates (auto-update option)
- Intrusion detection system (IDS)
