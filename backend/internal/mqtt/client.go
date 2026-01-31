package mqtt

import (
	"fmt"
	"log"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"los-tecnicos/backend/internal/config"
)

var Client mqtt.Client

// defaultMessageHandler is called for any message received that doesn't have a specific handler.
var defaultMessageHandler mqtt.MessageHandler = func(client mqtt.Client, msg mqtt.Message) {
	log.Printf("Received unhandled message on topic: %s\nMessage: %s\n", msg.Topic(), msg.Payload())
}

// onConnectHandler is called once a connection to the broker is established.
var onConnectHandler mqtt.OnConnectHandler = func(client mqtt.Client) {
	log.Println("Connected to MQTT broker.")
	// Subscribe to topics upon connection
	subscribeToTopics(client)
}

// onConnectionLostHandler is called when the connection to the broker is lost.
var onConnectionLostHandler mqtt.ConnectionLostHandler = func(client mqtt.Client, err error) {
	log.Printf("MQTT connection lost: %v. Reconnecting...", err)
}

// Connect initializes and connects the MQTT client.
func Connect() error {
	broker := config.GetEnv("MQTT_BROKER_ADDR", "tcp://localhost:1883")
	clientID := "los-tecnicos-backend"

	opts := mqtt.NewClientOptions()
	opts.AddBroker(broker)
	opts.SetClientID(clientID)
	opts.SetDefaultPublishHandler(defaultMessageHandler)
	opts.OnConnect = onConnectHandler
	opts.OnConnectionLost = onConnectionLostHandler
	opts.SetCleanSession(false) // Persist session
	opts.SetConnectRetry(true)
	opts.SetConnectRetryInterval(5 * time.Second)

	Client = mqtt.NewClient(opts)
	if token := Client.Connect(); token.Wait() && token.Error() != nil {
		return fmt.Errorf("failed to connect to MQTT broker at %s: %w", broker, token.Error())
	}

	return nil
}

// subscribeToTopics sets up subscriptions for the backend service.
func subscribeToTopics(client mqtt.Client) {
	// Topics from the prompt
	topics := []string{
		"energy/donor/+/status",
		"energy/donor/+/lock/response",
		"energy/recipient/+/status",
		"energy/device/+/alert",
		"energy/transfer/+/status",
	}

	for _, topic := range topics {
		if token := client.Subscribe(topic, 1, nil); token.Wait() && token.Error() != nil {
			log.Printf("Failed to subscribe to topic %s: %v", topic, token.Error())
		} else {
			log.Printf("Subscribed to topic: %s", topic)
		}
	}
}

// SendLockCommand sends an energy lock request to a donor's ESP32.
func SendLockCommand(deviceID string, orderID string, kwh float64) error {
	if Client == nil || !Client.IsConnected() {
		return fmt.Errorf("MQTT client not connected")
	}

	topic := fmt.Sprintf("energy/donor/%s/lock", deviceID)
	payload := fmt.Sprintf(`{"order_id": "%s", "kwh_requested": %f}`, orderID, kwh)
	
	token := Client.Publish(topic, 1, false, payload)
	token.Wait()
	return token.Error()
}
