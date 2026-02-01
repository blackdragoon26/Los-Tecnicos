import asyncio
import logging
import json
# import paho.mqtt.client as mqtt # Uncomment when installed

logger = logging.getLogger("MQTTRelay")

class MQTTRelay:
    def __init__(self, mesh_node):
        self.mesh = mesh_node
        self.mqtt_client = None
        
    async def start(self):
        logger.info("Starting MQTT Relay...")
        # self.client = mqtt.Client()
        # self.client.on_connect = self.on_connect
        # self.client.on_message = self.on_message
        # self.client.connect("localhost", 1883, 60)
        # self.client.loop_start()
        pass
        
    def on_connect(self, client, userdata, flags, rc):
        logger.info(f"Connected to local broker with result code {rc}")
        client.subscribe("energy/#")
        
    def on_message(self, client, userdata, msg):
        payload = msg.payload.decode()
        logger.info(f"Received MQTT: {msg.topic} -> {payload}")
        
        # Forward to Mesh if destination is another node
        # For this prototype, we just log it
        asyncio.create_task(self.process_message(msg.topic, payload))

    async def process_message(self, topic, payload):
        # Logic to route MQTT message over mesh
        if "device" in topic:
            # Assuming payload has destination info or topic maps to a node
            await self.mesh.send_message("backend", payload)
