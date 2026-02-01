import asyncio
import logging
import time
import json
from mesh_network import MeshNode
from mqtt_relay import MQTTRelay

# Configuration
NODE_ID = "pi_node_" + str(int(time.time()))
BACKEND_URL = "https://api.los-tecnicos.com"

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("Main")

async def main():
    logger.info(f"Starting Mesh Node: {NODE_ID}")
    
    # Initialize components
    mesh = MeshNode(NODE_ID)
    mqtt_relay = MQTTRelay(mesh)
    
    # Start mesh networking (simulation of batman-adv interface interaction)
    await mesh.start()
    
    # Start MQTT relay
    await mqtt_relay.start()
    
    logger.info("Node Operational. Running main loop...")
    
    # Main loop
    while True:
        # Route packets (Mock processing)
        await mesh.process_packets()
        
        # Periodic health check
        await asyncio.sleep(5)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Shutting down node...")
