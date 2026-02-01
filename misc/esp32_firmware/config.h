#ifndef CONFIG_H
#define CONFIG_H

// WiFi Credentials
const char* WIFI_SSID = "LosTecnicos_Grid";
const char* WIFI_PASSWORD = "solar_energy_revolution";

// MQTT Configuration
const char* MQTT_BROKER = "mqtt.lightsail.network"; // Placeholder
const int MQTT_PORT = 1883; // Non-TLS for simple demo, 8883 for TLS

// Device Settings
#define MIN_VOLTAGE 10.0
#define MAX_VOLTAGE 65.0
#define MAX_CURRENT 5.0
#define REPORT_INTERVAL 60000 // 60s

#endif
