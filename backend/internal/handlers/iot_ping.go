package handlers

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"sync"
	"time"

	"los-tecnicos/backend/internal/core/domain"
	"los-tecnicos/backend/internal/database"

	"github.com/gin-gonic/gin"
)

// IoTEvent represents the data structure for IoT events broadcasted to frontend
type IoTEvent struct {
	Timestamp string                 `json:"timestamp"`
	Type      string                 `json:"type"`
	Payload   map[string]interface{} `json:"payload"`
}

// ConnectedNodeInfo represents details of a connected neighbor node
type ConnectedNodeInfo struct {
	UID     string  `json:"uid"`
	Voltage float64 `json:"voltage"`
}

// PiPingPayload defines the expected schema from the Raspberry Pi
type PiPingPayload struct {
	DeviceID            string              `json:"device_id"`
	Voltage             float64             `json:"voltage"`
	ConnectedNodesCount int                 `json:"connected_nodes_count"`
	ConnectedNodes      []ConnectedNodeInfo `json:"connected_nodes"`
	BatteryLevel        float64             `json:"battery_level"` // Optional
}

// Broker manages the SSE clients
type Broker struct {
	Clients    map[chan IoTEvent]bool
	Register   chan chan IoTEvent
	Unregister chan chan IoTEvent
	Broadcast  chan IoTEvent
	mutex      sync.Mutex
}

func NewBroker() *Broker {
	return &Broker{
		Clients:    make(map[chan IoTEvent]bool),
		Register:   make(chan chan IoTEvent),
		Unregister: make(chan chan IoTEvent),
		Broadcast:  make(chan IoTEvent),
	}
}

// Global broker instance
var IoTBroker = NewBroker()

func (b *Broker) Run() {
	for {
		select {
		case client := <-b.Register:
			b.mutex.Lock()
			b.Clients[client] = true
			b.mutex.Unlock()
			log.Println("New SSE client connected")

		case client := <-b.Unregister:
			b.mutex.Lock()
			if _, ok := b.Clients[client]; ok {
				delete(b.Clients, client)
				close(client)
			}
			b.mutex.Unlock()
			log.Println("SSE client disconnected")

		case event := <-b.Broadcast:
			b.mutex.Lock()
			for client := range b.Clients {
				select {
				case client <- event:
				default:
					close(client)
					delete(b.Clients, client)
				}
			}
			b.mutex.Unlock()
		}
	}
}

func StartBroker() {
	go IoTBroker.Run()
}

// HandleIoTEventStream handles the SSE connection
func HandleIoTEventStream(c *gin.Context) {
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("Access-Control-Allow-Origin", "*")

	clientChan := make(chan IoTEvent)
	IoTBroker.Register <- clientChan

	defer func() {
		IoTBroker.Unregister <- clientChan
	}()

	notify := c.Writer.CloseNotify()

	c.Stream(func(w io.Writer) bool {
		select {
		case <-notify:
			return false
		case event := <-clientChan:
			eventJSON, err := json.Marshal(event)
			if err != nil {
				return true
			}
			c.SSEvent("message", string(eventJSON))
			c.Writer.Flush()
			return true
		}
	})
}

// HandleIoTPing receives data from the Raspberry Pi and updates the DB
func HandleIoTPing(c *gin.Context) {
	var payload PiPingPayload
	// Bind JSON to struct to validate schema
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON or Schema mismatch: " + err.Error()})
		return
	}

	// 1. Persist Data for Pricing Engine
	go func(p PiPingPayload) {
		// Update IoT Device Status & Battery (SoC)
		var device domain.IoTDevice
		if err := database.DB.Where("id = ?", p.DeviceID).First(&device).Error; err == nil {
			// Found device, update it
			device.BatteryLevel = p.BatteryLevel
			device.LastPing = time.Now()
			device.Status = "online"
			// Ensure Location stores neighbor info if possible, or just log it for now as we don't have a dedicated graph table yet
			database.DB.Save(&device)

			// Update Device Quality Metrics (Voltage)
			var metrics domain.DeviceQualityMetrics
			// Calculate average voltage (self + neighbors)
			totalVoltage := p.Voltage
			count := 1.0
			for _, node := range p.ConnectedNodes {
				totalVoltage += node.Voltage
				count++
			}
			avgVoltage := totalVoltage / count

			// Calculate deviation from 230V
			deviation := avgVoltage - 230.0
			if deviation < 0 {
				deviation = -deviation
			}
			// Score: 100 - deviation. If deviation > 100, score is 0.
			score := 100.0 - deviation
			if score < 0 {
				score = 0
			}

			if err := database.DB.Where("device_id = ?", device.ID).First(&metrics).Error; err == nil {
				metrics.LastUpdated = time.Now()
				metrics.VoltageStability = score
				database.DB.Save(&metrics)
			} else {
				newMetrics := domain.DeviceQualityMetrics{
					DeviceID:           device.ID,
					VoltageStability:   score,
					BatteryHealthScore: 100.0, // Default
					LastUpdated:        time.Now(),
				}
				database.DB.Create(&newMetrics)
			}
		} else {
			log.Printf("Warning: Ping received from unknown device ID: %s", p.DeviceID)
		}
	}(payload)

	// 2. Broadcast to Frontend
	// We convert the struct back to a map or generic JSON for the frontend to display everything
	msgPayload := map[string]interface{}{
		"device_id":             payload.DeviceID,
		"voltage":               payload.Voltage,
		"connected_nodes_count": payload.ConnectedNodesCount,
		"connected_nodes":       payload.ConnectedNodes,
		"battery_level":         payload.BatteryLevel,
	}

	event := IoTEvent{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Type:      "ping",
		Payload:   msgPayload,
	}

	IoTBroker.Broadcast <- event

	c.JSON(http.StatusOK, gin.H{"status": "received", "updated": true})
}
