package handlers

import (
	"encoding/json"
	"fmt"
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
	BatteryLevel        float64             `json:"battery_level"`
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

var IoTBroker = NewBroker()

func (b *Broker) Run() {
	for {
		select {
		case client := <-b.Register:
			b.mutex.Lock()
			b.Clients[client] = true
			b.mutex.Unlock()

		case client := <-b.Unregister:
			b.mutex.Lock()
			if _, ok := b.Clients[client]; ok {
				delete(b.Clients, client)
				close(client)
			}
			b.mutex.Unlock()

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

// HandleIoTEventStream handles the SSE connection for the frontend
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

// HandleIoTPing receives data from the Raspberry Pi
func HandleIoTPing(c *gin.Context) {
	var payload PiPingPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		log.Printf("[IoT-PING] ❌ Bad JSON from %s: %v", c.ClientIP(), err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON: " + err.Error()})
		return
	}

	// Log the full incoming payload for debugging
	nodeVoltages := ""
	for _, n := range payload.ConnectedNodes {
		nodeVoltages += fmt.Sprintf("  → %s: %.2fV\n", n.UID, n.Voltage)
	}
	log.Printf("[IoT-PING] 📡 Ping received from IP: %s\n"+
		"  device_id:             %s\n"+
		"  voltage:               %.2fV\n"+
		"  battery_level:         %.1f%%\n"+
		"  connected_nodes_count: %d\n"+
		"  connected_nodes:\n%s",
		c.ClientIP(),
		payload.DeviceID,
		payload.Voltage,
		payload.BatteryLevel,
		payload.ConnectedNodesCount,
		nodeVoltages,
	)

	// Auto-register device if it doesn't exist yet
	go func(p PiPingPayload) {
		var device domain.IoTDevice
		err := database.DB.Where("id = ?", p.DeviceID).First(&device).Error
		if err != nil {
			// Device not found — auto-register it
			device = domain.IoTDevice{
				ID:           p.DeviceID,
				OwnerID:      "auto-registered",
				DeviceType:   "raspi",
				Location:     "",
				BatteryLevel: p.BatteryLevel / 100.0, // normalize 0-100 → 0.0-1.0
				LastPing:     time.Now(),
				Status:       "online",
			}
			if createErr := database.DB.Create(&device).Error; createErr != nil {
				log.Printf("[IoT-PING] ⚠️  Could not auto-register device %s: %v", p.DeviceID, createErr)
				return
			}
			log.Printf("[IoT-PING] ✅ Auto-registered new device: %s", p.DeviceID)
		} else {
			// Update existing device
			device.BatteryLevel = p.BatteryLevel / 100.0
			device.LastPing = time.Now()
			device.Status = "online"
			database.DB.Save(&device)
		}

		// Calculate average voltage (self + all neighbors)
		totalVoltage := p.Voltage
		count := 1.0
		for _, node := range p.ConnectedNodes {
			totalVoltage += node.Voltage
			count++
		}
		avgVoltage := totalVoltage / count

		// Voltage stability score: 100 - deviation from 230V
		deviation := avgVoltage - 230.0
		if deviation < 0 {
			deviation = -deviation
		}
		score := 100.0 - deviation
		if score < 0 {
			score = 0
		}

		log.Printf("[IoT-PING] 📊 Device %s → avgVoltage=%.2fV, stabilityScore=%.1f", p.DeviceID, avgVoltage, score)

		// Upsert DeviceQualityMetrics
		var metrics domain.DeviceQualityMetrics
		if err := database.DB.Where("device_id = ?", device.ID).First(&metrics).Error; err == nil {
			metrics.VoltageStability = score
			metrics.LastUpdated = time.Now()
			database.DB.Save(&metrics)
		} else {
			newMetrics := domain.DeviceQualityMetrics{
				DeviceID:           device.ID,
				VoltageStability:   score,
				BatteryHealthScore: 100.0,
				LastUpdated:        time.Now(),
			}
			database.DB.Create(&newMetrics)
		}
	}(payload)

	// Build event payload for frontend SSE broadcast
	msgPayload := map[string]interface{}{
		"device_id":             payload.DeviceID,
		"voltage":               payload.Voltage,
		"battery_level":         payload.BatteryLevel,
		"connected_nodes_count": payload.ConnectedNodesCount,
		"connected_nodes":       payload.ConnectedNodes,
	}

	event := IoTEvent{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Type:      "ping",
		Payload:   msgPayload,
	}

	IoTBroker.Broadcast <- event

	c.JSON(http.StatusOK, gin.H{
		"status": "received",
		"event":  event,
	})
}
