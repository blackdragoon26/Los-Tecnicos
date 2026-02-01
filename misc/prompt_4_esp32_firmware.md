📋 PROMPT 4: ESP32 Firmware Developer (C++ for IoT)
You are developing firmware for ESP32 microcontrollers that monitor and control battery systems for a decentralized energy trading platform.

HARDWARE CONTEXT:
- Microcontroller: ESP32-WROOM-32
- Battery monitoring: Via current sensor (INA219) and voltage sensor
- Communication: WiFi + MQTT protocol
- Power source: USB or small solar panel
- Enclosure: Weatherproof box for outdoor installation

FIRMWARE RESPONSIBILITIES:

1. BATTERY MONITORING
   - Read battery voltage (0-60V range)
   - Read current flow (bidirectional, ±3A)
   - Calculate available energy (kWh) using: E = V × I × time
   - Track state of charge (SoC) percentage
   - Detect battery health issues (voltage drop, overheating)
   - Sampling rate: Every 1 second for active transactions, every 60 seconds idle

2. WIFI + MQTT CONNECTIVITY
   - Connect to local WiFi network (credentials via setup mode)
   - Establish connection to MQTT broker (backend server)
   - Auto-reconnect on connection loss
   - Implement TLS/SSL for secure communication
   - QoS level 1 for all messages (at least once delivery)

3. DEVICE AUTHENTICATION
   - Generate unique device ID on first boot (based on MAC address + UUID)
   - Create cryptographic signature for all messages
   - Use ECDSA with secp256k1 curve (compatible with Stellar)
   - Store private key in ESP32's encrypted flash memory
   - Implement challenge-response protocol for backend verification

4. ENERGY LOCKING MECHANISM
   - Listen to MQTT topic: `energy/lock/{device_id}`
   - Message format: { "order_id": "xxx", "kwh_requested": 10.5 }
   - Verify available energy: current_available >= kwh_requested
   - If yes: Lock energy (update available_energy -= kwh_requested)
   - Publish response: `energy/lock/{device_id}/response`
     { "order_id": "xxx", "status": "locked"/"rejected", "signature": "..." }
   - Maintain locked state until: transaction completed or timeout (15 min)
   - On timeout: Auto-unlock energy

5. ENERGY TRANSFER MONITORING
   - When transaction executes, monitor actual energy flow
   - Compare expected vs actual energy delivered
   - Publish real-time updates: `energy/transfer/{device_id}/status`
     { "order_id": "xxx", "delivered_kwh": 5.2, "remaining_kwh": 5.3 }
   - On completion: Unlock remaining energy, sign final proof
   - Final proof structure: { "order_id": "xxx", "total_delivered": 10.5, "signature": "..." }

6. HEARTBEAT & STATUS REPORTING
   - Every 60 seconds, publish device status:
     Topic: `energy/device/{device_id}/status`
     Payload: {
       "device_id": "...",
       "voltage": 48.2,
       "current": 1.5,
       "available_kwh": 25.3,
       "locked_kwh": 10.5,
       "temperature": 35.2,
       "uptime": 3600000,
       "wifi_rssi": -45,
       "timestamp": 1704123456
     }

7. SAFETY FEATURES
   - Emergency shutdown if:
     * Battery voltage > 65V or < 10V
     * Temperature > 60°C
     * Current > 5A
     * Communication lost for > 5 minutes
   - Publish alert: `energy/device/{device_id}/alert`
   - LED indicators:
     * Green: Normal operation
     * Blue: Transaction in progress
     * Yellow: Warning (low battery, weak WiFi)
     * Red: Error/Emergency

8. OTA (Over-The-Air) UPDATES
   - Support firmware updates via MQTT
   - Verify update signature before applying
   - Rollback mechanism if update fails
   - Version management

9. SETUP MODE
   - On first boot or button press (3 sec hold):
     * Create WiFi access point: "EnergyGrid_SETUP_XXXX"
     * Host web interface at 192.168.4.1
     * Accept WiFi credentials + backend server address
     * Save to encrypted flash
     * Reboot to normal mode

CODE STRUCTURE:
```cpp
// Main sketch outline
#include <WiFi.h>
#include <PubSubClient.h> // MQTT
#include <Wire.h>
#include <Adafruit_INA219.h> // Current sensor
#include <mbedtls/ecdsa.h> // Crypto

// Configuration
const char* WIFI_SSID = "...";
const char* WIFI_PASSWORD = "...";
const char* MQTT_BROKER = "mqtt.yourdomain.com";
const int MQTT_PORT = 8883; // TLS

// Global objects
WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);
Adafruit_INA219 ina219;

// State variables
float available_kwh = 0.0;
float locked_kwh = 0.0;
String device_id = "";
String active_order_id = "";

void setup() {
  Serial.begin(115200);
  
  // Initialize sensors
  ina219.begin();
  
  // Generate device ID
  device_id = generateDeviceID();
  
  // Connect WiFi
  connectWiFi();
  
  // Connect MQTT
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  connectMQTT();
  
  // Subscribe to lock topic
  String topic = "energy/lock/" + device_id;
  mqttClient.subscribe(topic.c_str());
}

void loop() {
  if (!mqttClient.connected()) {
    connectMQTT();
  }
  mqttClient.loop();
  
  // Read sensors every 1 second
  static unsigned long lastRead = 0;
  if (millis() - lastRead > 1000) {
    readBatteryStatus();
    lastRead = millis();
  }
  
  // Publish status every 60 seconds
  static unsigned long lastStatus = 0;
  if (millis() - lastStatus > 60000) {
    publishStatus();
    lastStatus = millis();
  }
  
  // Check lock timeout
  checkLockTimeout();
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  // Parse incoming messages
  // Handle lock requests
  // Handle unlock commands
}

void readBatteryStatus() {
  float voltage = ina219.getBusVoltage_V();
  float current = ina219.getCurrent_mA() / 1000.0;
  
  // Calculate available kWh
  // Update available_kwh
  
  // Safety checks
  if (voltage > 65.0 || voltage < 10.0) {
    emergencyShutdown();
  }
}

void handleLockRequest(String order_id, float kwh_requested) {
  if (available_kwh >= kwh_requested) {
    // Lock energy
    locked_kwh = kwh_requested;
    available_kwh -= kwh_requested;
    active_order_id = order_id;
    
    // Sign and publish confirmation
    String signature = signMessage(order_id + String(kwh_requested));
    publishLockResponse(order_id, "locked", signature);
  } else {
    publishLockResponse(order_id, "rejected", "");
  }
}

String signMessage(String message) {
  // ECDSA signature using private key
  // Return hex-encoded signature
}
```

MQTT TOPIC STRUCTURE:
- Subscribe:
  * `energy/lock/{device_id}` - Lock requests from backend
  * `energy/unlock/{device_id}` - Unlock commands
  * `energy/ota/{device_id}` - Firmware updates
  
- Publish:
  * `energy/device/{device_id}/status` - Periodic status
  * `energy/lock/{device_id}/response` - Lock confirmations
  * `energy/transfer/{device_id}/status` - Real-time transfer updates
  * `energy/device/{device_id}/alert` - Emergency alerts

SECURITY IMPLEMENTATION:
- Use ESP32's hardware encryption
- Store private keys in encrypted partition
- Implement nonce in all messages to prevent replay attacks
- Validate server certificates (TLS)
- Rate limiting on incoming commands

LIBRARIES REQUIRED:
- WiFi.h (built-in)
- PubSubClient.h (MQTT)
- Adafruit_INA219.h (current sensor)
- mbedtls (cryptography)
- ArduinoJson.h (JSON parsing)
- Preferences.h (encrypted storage)

TESTING REQUIREMENTS:
- Unit tests for crypto functions
- Integration test with local MQTT broker
- Stress test: 100 lock/unlock cycles
- Network failure recovery test
- Battery disconnection handling

OUTPUT REQUIREMENTS:
1. Complete .ino sketch file
2. Configuration header file
3. Cryptographic utilities file
4. WiFi/MQTT connection manager
5. Battery monitoring module
6. Setup mode web interface HTML/CSS
7. OTA update handler
8. Testing suite
9. Hardware assembly guide
10. Troubleshooting documentation

PERFORMANCE TARGETS:
- Message latency: <500ms under normal conditions
- WiFi reconnection: <5 seconds
- Battery reading accuracy: ±2%
- Uptime: >99.9% (excluding network issues)
- Power consumption: <1W idle, <3W active
