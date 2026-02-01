#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_INA219.h>
#include "mbedtls/ecdsa.h"
#include "mbedtls/pk.h"
#include "mbedtls/entropy.h"
#include "mbedtls/ctr_drbg.h"
#include "config.h"

// Global objects
WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);
Adafruit_INA219 ina219;

// State variables
float available_kwh = 0.0;
float locked_kwh = 0.0;
String device_id = "";
String active_order_id = "";
unsigned long lock_timestamp = 0;

// Setup WiFi
void connectWiFi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

// Setup MQTT
void connectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Attempting MQTT connection...");
    // Create a random client ID
    String clientId = "ESP32Client-";
    clientId += String(random(0xffff), HEX);
    
    // Attempt to connect
    if (mqttClient.connect(clientId.c_str())) {
      Serial.println("connected");
      // Subscribe to topics
      String lockTopic = "energy/lock/" + device_id;
      mqttClient.subscribe(lockTopic.c_str());
      String unlockTopic = "energy/unlock/" + device_id;
      mqttClient.subscribe(unlockTopic.c_str());
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

// Generate unique Device ID (MAC-based)
String generateDeviceID() {
  uint8_t mac[6];
  WiFi.macAddress(mac);
  String id = "";
  for (int i = 0; i < 6; ++i) {
    if (mac[i] < 0x10) id += "0";
    id += String(mac[i], HEX);
  }
  return id;
}

// Battery Reading Logic
void readBatteryStatus() {
  float voltage = ina219.getBusVoltage_V();
  float current = ina219.getCurrent_mA() / 1000.0; // Convert to Amps
  
  // Calculate Energy (Simple Integration for Demo)
  // E = V * I * t (kWh)
  // Assumes 1 second interval
  float power_kw = (voltage * current) / 1000.0;
  float energy_kwh_increment = power_kw * (1.0 / 3600.0); // 1 second in hours

  // Update State (Simulated available energy for demo purposes if no battery connected)
  if (voltage < 1.0) {
      // Simulation Mode
      available_kwh -= 0.0001; // Self discharge
      if (available_kwh < 0) available_kwh = 10.0; // Reset
  } else {
      // Real Mode
      // Only integrate if discharging? 
      // Simplified: Just track current cap.
      // E = (Voltage - MinVoltage) * capacity_factor
      available_kwh = (voltage - 10.0) * 0.5; // Dummy formula
  }

  // Safety Checks
  if (voltage > 65.0 || voltage < 10.0 && voltage > 1.0) {
    Serial.println("EMERGENCY SHUTDOWN: Voltage out of range!");
    // publishAlert("voltage_critical");
  }
}

// Publish Status Report
void publishStatus() {
  String topic = "energy/device/" + device_id + "/status";
  
  float voltage = ina219.getBusVoltage_V();
  float current = ina219.getCurrent_mA();
  
  String payload = "{";
  payload += "\"device_id\": \"" + device_id + "\",";
  payload += "\"voltage\": " + String(voltage, 2) + ",";
  payload += "\"current\": " + String(current, 2) + ",";
  payload += "\"available_kwh\": " + String(available_kwh, 3) + ",";
  payload += "\"locked_kwh\": " + String(locked_kwh, 3) + ",";
  payload += "\"uptime\": " + String(millis()) + "";
  payload += "}";

  mqttClient.publish(topic.c_str(), payload.c_str());
}

// Handle Incoming MQTT Messages
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  Serial.println(message);

  String topicStr = String(topic);
  if (topicStr.indexOf("/lock/") > 0) {
      // Parse JSON (Manual parsing for simplicity or use ArduinoJson)
      // Expect: { "order_id": "xxx", "kwh_requested": 10.5 }
      // Mock parsing:
      int orderIdx = message.indexOf("order_id");
      int kwhIdx = message.indexOf("kwh_requested");
      
      if (orderIdx > 0 && kwhIdx > 0) {
          // Extract (Very naive parsing)
          // Assume valid JSON structure
          active_order_id = "ORDER_123"; // Extracted ID
          float req_kwh = 2.0; // Extracted Amount

          handleLockRequest(active_order_id, req_kwh);
      }
  }
}

// Lock Request Handler
void handleLockRequest(String order_id, float kwh_requested) {
  String responseTopic = "energy/lock/" + device_id + "/response";
  
  if (available_kwh >= kwh_requested) {
    // Lock energy
    locked_kwh = kwh_requested;
    available_kwh -= kwh_requested; // Reserve it
    active_order_id = order_id;
    lock_timestamp = millis();
    
    // Sign response (Mock Signature)
    String signature = "simulated_ecdsa_sig_" + order_id;
    
    String payload = "{";
    payload += "\"order_id\": \"" + order_id + "\",";
    payload += "\"status\": \"locked\",";
    payload += "\"signature\": \"" + signature + "\"";
    payload += "}";
    
    mqttClient.publish(responseTopic.c_str(), payload.c_str());
    Serial.println("Energy Locked for Order " + order_id);
  } else {
    String payload = "{\"order_id\": \"" + order_id + "\", \"status\": \"rejected\"}";
    mqttClient.publish(responseTopic.c_str(), payload.c_str());
    Serial.println("Energy Lock Rejected (Insufficient Capacity)");
  }
}

void checkLockTimeout() {
    if (locked_kwh > 0 && (millis() - lock_timestamp > 15 * 60 * 1000)) { // 15 min
        Serial.println("Lock Timeout - Releasing Energy");
        available_kwh += locked_kwh;
        locked_kwh = 0;
        active_order_id = "";
    }
}

void setup() {
  Serial.begin(115200);
  
  // Initialize I2C and Sensors
  if (!ina219.begin()) {
    Serial.println("Failed to find INA219 chip");
  }
  
  // Generate ID
  device_id = generateDeviceID();
  Serial.println("Device ID: " + device_id);

  // Setup WiFi & MQTT
  espClient.setInsecure(); // For demo, skip Cert valid.
  connectWiFi();
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  connectMQTT();
}

void loop() {
  if (!mqttClient.connected()) {
    connectMQTT();
  }
  mqttClient.loop();
  
  // 1s Interval
  static unsigned long lastRead = 0;
  if (millis() - lastRead > 1000) {
    readBatteryStatus();
    lastRead = millis();
  }
  
  // 60s Interval
  static unsigned long lastStatus = 0;
  if (millis() - lastStatus > 60000) {
    publishStatus();
    lastStatus = millis();
  }
  
  checkLockTimeout();
}
