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

// ──────────────────────────────────────────────────────────────
// SSE Broker — manages live event stream connections to frontend
// ──────────────────────────────────────────────────────────────

// IoTEvent is the structure broadcasted to all connected SSE clients.
type IoTEvent struct {
	Timestamp string      `json:"timestamp"`
	Type      string      `json:"type"`    // "heartbeat" or "node_data"
	Payload   interface{} `json:"payload"` // raw payload forwarded to frontend
}

// Broker manages SSE client channels.
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
			log.Println("[SSE] New client connected")

		case client := <-b.Unregister:
			b.mutex.Lock()
			if _, ok := b.Clients[client]; ok {
				delete(b.Clients, client)
				close(client)
			}
			b.mutex.Unlock()
			log.Println("[SSE] Client disconnected")

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

// ──────────────────────────────────────────────────────────────
// SSE Endpoint — GET /iot/events
// ──────────────────────────────────────────────────────────────

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
			// Marshal manually and write raw SSE to avoid Gin double-serialization
			eventJSON, err := json.Marshal(event)
			if err != nil {
				log.Printf("[SSE] Marshal error: %v", err)
				return true
			}
			// Write raw SSE format: "data: {json}\n\n"
			fmt.Fprintf(w, "data: %s\n\n", eventJSON)
			c.Writer.Flush()
			return true
		}
	})
}

// ──────────────────────────────────────────────────────────────
// Payload Structs — matching real Raspberry Pi data format
// ──────────────────────────────────────────────────────────────

// ConnectedNodeInfo is the simple node entry in connected_nodes array.
type ConnectedNodeInfo struct {
	UID     string  `json:"uid"`
	Voltage float64 `json:"voltage"`
}

// NodeDetailInfo is the rich per-node data in nodes_detail array.
type NodeDetailInfo struct {
	UID     string  `json:"uid"`
	IP      string  `json:"ip"`
	Voltage float64 `json:"voltage"`
	SoC     float64 `json:"soc"`
	State   string  `json:"state"`
}

// PiPingPayload handles BOTH payload types from the real Pi.
// For heartbeat: only device_id and status are set.
// For node data: all fields are populated.
type PiPingPayload struct {
	// Common
	DeviceID string `json:"device_id" binding:"required"`

	// Heartbeat-only field
	HeartbeatStatus string `json:"status,omitempty"` // "heartbeat" when it's a heartbeat

	// Node data fields
	Voltage             float64             `json:"voltage,omitempty"`
	ConnectedNodesCount int                 `json:"connected_nodes_count,omitempty"`
	ConnectedNodes      []ConnectedNodeInfo `json:"connected_nodes,omitempty"`
	BatteryLevel        float64             `json:"battery_level,omitempty"`
	State               string              `json:"state,omitempty"`     // IDLE, CHARGING, FAULT
	Timestamp           string              `json:"timestamp,omitempty"` // ISO 8601 from Pi
	Source              string              `json:"source,omitempty"`    // "rpi_energy_grid"
	NodesDetail         []NodeDetailInfo    `json:"nodes_detail,omitempty"`
}

// ──────────────────────────────────────────────────────────────
// Production Device Seeding
// ──────────────────────────────────────────────────────────────

// SeedProductionDevices cleans up old fake simulation data and ensures real production devices exist.
func SeedProductionDevices() {
	// ── Clean up old simulation/fake data ──
	fakeDeviceIDs := []string{"esp32_a", "esp32_c", "raspi_node_1", "rpi-4b-sim-001"}
	fakeUserIDs := []string{"user_a", "user_b", "user_c"}

	for _, id := range fakeDeviceIDs {
		database.DB.Where("device_id = ?", id).Delete(&domain.DeviceQualityMetrics{})
		database.DB.Where("id = ?", id).Delete(&domain.IoTDevice{})
	}
	for _, id := range fakeUserIDs {
		database.DB.Where("id = ?", id).Delete(&domain.User{})
	}

	// Clean up stale test orders that spam the matching engine
	result := database.DB.Where("status = ?", "Created").Delete(&domain.EnergyOrder{})
	if result.RowsAffected > 0 {
		log.Printf("[SEED] Cleaned up %d stale test orders", result.RowsAffected)
	}

	// Clear stale discharge/charge commands so nodes default to idle on restart
	cmdResult := database.DB.Where("action IN ?", []string{"discharge", "charge"}).Delete(&domain.ScheduleCommand{})
	if cmdResult.RowsAffected > 0 {
		log.Printf("[SEED] Cleared %d stale schedule commands (nodes will idle)", cmdResult.RowsAffected)
	}

	// Clear ALL simulated network nodes (these inflate the "Active Nodes" count)
	nodeResult := database.DB.Exec("DELETE FROM network_nodes")
	if nodeResult.RowsAffected > 0 {
		log.Printf("[SEED] Cleaned up %d stale network nodes", nodeResult.RowsAffected)
	}

	log.Println("[SEED] Cleaned up old simulation data (fake users, devices, metrics)")

	// ── Seed real production devices ──
	log.Println("[SEED] Ensuring production IoT devices exist...")

	prodDevices := []domain.IoTDevice{
		{
			ID:         "rpi-4b-prod-01",
			OwnerID:    "production",
			DeviceType: "raspi",
			Location:   "",
			Status:     "offline",
			State:      "UNKNOWN",
			Source:     "rpi_energy_grid",
		},
	}

	for _, d := range prodDevices {
		result := database.DB.Where("id = ?", d.ID).FirstOrCreate(&d)
		if result.RowsAffected > 0 {
			log.Printf("[SEED] Created production device: %s", d.ID)
		} else {
			log.Printf("[SEED] Production device already exists: %s", d.ID)
		}
	}
}

// ──────────────────────────────────────────────────────────────
// POST /iot/ping — receives data from the real Raspberry Pi
// ──────────────────────────────────────────────────────────────

func HandleIoTPing(c *gin.Context) {
	var payload PiPingPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		log.Printf("[IoT-PING] ❌ Bad JSON from %s: %v", c.ClientIP(), err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON: " + err.Error()})
		return
	}

	// ─── HEARTBEAT ───
	if payload.HeartbeatStatus == "heartbeat" {
		log.Printf("[IoT-PING] 💓 Heartbeat from device: %s (IP: %s)", payload.DeviceID, c.ClientIP())

		// Update last_ping and status in background
		go func(deviceID string) {
			var device domain.IoTDevice
			if err := database.DB.Where("id = ?", deviceID).First(&device).Error; err == nil {
				device.LastPing = time.Now()
				device.Status = "online"
				database.DB.Save(&device)
			} else {
				// Auto-register unknown device
				newDevice := domain.IoTDevice{
					ID:         deviceID,
					OwnerID:    "auto-registered",
					DeviceType: "raspi",
					Status:     "online",
					LastPing:   time.Now(),
				}
				database.DB.Create(&newDevice)
				log.Printf("[IoT-PING] ✅ Auto-registered new device from heartbeat: %s", deviceID)
			}
		}(payload.DeviceID)

		// Broadcast heartbeat event to frontend
		event := IoTEvent{
			Timestamp: time.Now().UTC().Format(time.RFC3339),
			Type:      "heartbeat",
			Payload: map[string]interface{}{
				"device_id": payload.DeviceID,
				"status":    "heartbeat",
			},
		}
		IoTBroker.Broadcast <- event

		c.JSON(http.StatusOK, gin.H{"status": "received", "type": "heartbeat", "updated": true})
		return
	}

	// ─── NODE DATA POST ───
	nodeVoltages := ""
	for _, n := range payload.ConnectedNodes {
		nodeVoltages += fmt.Sprintf("  → %s: %.3fV\n", n.UID, n.Voltage)
	}
	nodeDetails := ""
	for _, nd := range payload.NodesDetail {
		nodeDetails += fmt.Sprintf("  → %s (IP: %s) V=%.3f SoC=%.1f%% State=%s\n", nd.UID, nd.IP, nd.Voltage, nd.SoC, nd.State)
	}
	log.Printf("[IoT-PING] 📡 Node data from %s (IP: %s)\n"+
		"  device_id:             %s\n"+
		"  voltage:               %.3fV\n"+
		"  battery_level:         %.1f%%\n"+
		"  state:                 %s\n"+
		"  source:                %s\n"+
		"  connected_nodes_count: %d\n"+
		"  connected_nodes:\n%s"+
		"  nodes_detail:\n%s",
		payload.DeviceID, c.ClientIP(),
		payload.DeviceID,
		payload.Voltage,
		payload.BatteryLevel,
		payload.State,
		payload.Source,
		payload.ConnectedNodesCount,
		nodeVoltages,
		nodeDetails,
	)

	// Persist to DB in background
	go func(p PiPingPayload) {
		// 1. Upsert IoTDevice
		var device domain.IoTDevice
		err := database.DB.Where("id = ?", p.DeviceID).First(&device).Error
		if err != nil {
			// Auto-register new device
			device = domain.IoTDevice{
				ID:           p.DeviceID,
				OwnerID:      "auto-registered",
				DeviceType:   "raspi",
				BatteryLevel: p.BatteryLevel / 100.0, // normalize 0-100 → 0.0-1.0
				LastPing:     time.Now(),
				Status:       "online",
				State:        p.State,
				Source:       p.Source,
			}
			if createErr := database.DB.Create(&device).Error; createErr != nil {
				log.Printf("[IoT-PING] ⚠️ Could not auto-register device %s: %v", p.DeviceID, createErr)
				return
			}
			log.Printf("[IoT-PING] ✅ Auto-registered new device: %s", p.DeviceID)
		} else {
			// Update existing device
			device.BatteryLevel = p.BatteryLevel / 100.0
			device.LastPing = time.Now()
			device.Status = "online"
			device.State = p.State
			device.Source = p.Source
			database.DB.Save(&device)
		}

		// 2. Upsert NodeDetail records
		for _, nd := range p.NodesDetail {
			var existing domain.NodeDetail
			err := database.DB.Where("device_id = ? AND uid = ?", p.DeviceID, nd.UID).First(&existing).Error
			if err != nil {
				// Create new
				newNode := domain.NodeDetail{
					DeviceID:  p.DeviceID,
					UID:       nd.UID,
					IP:        nd.IP,
					Voltage:   nd.Voltage,
					SoC:       nd.SoC,
					State:     nd.State,
					UpdatedAt: time.Now(),
				}
				database.DB.Create(&newNode)
			} else {
				// Update existing
				existing.IP = nd.IP
				existing.Voltage = nd.Voltage
				existing.SoC = nd.SoC
				existing.State = nd.State
				existing.UpdatedAt = time.Now()
				database.DB.Save(&existing)
			}
		}

		// 3. Update DeviceQualityMetrics (voltage stability)
		totalVoltage := p.Voltage
		count := 1.0
		for _, node := range p.ConnectedNodes {
			totalVoltage += node.Voltage
			count++
		}
		avgVoltage := totalVoltage / count

		// Voltage stability score based on deviation from nominal ~4V (Li-ion battery voltage range)
		// Your Pi reports ~3.7-4.2V range, not 230V mains
		deviation := avgVoltage - 3.85 // midpoint of 3.7-4.2V range
		if deviation < 0 {
			deviation = -deviation
		}
		// Max deviation in normal range is ~0.35V. Score 0-100.
		score := 100.0 - (deviation / 0.35 * 100.0)
		if score < 0 {
			score = 0
		}
		if score > 100 {
			score = 100
		}

		log.Printf("[IoT-PING] 📊 Device %s → avgVoltage=%.3fV, stabilityScore=%.1f", p.DeviceID, avgVoltage, score)

		var metrics domain.DeviceQualityMetrics
		if err := database.DB.Where("device_id = ?", device.ID).First(&metrics).Error; err == nil {
			metrics.VoltageStability = score
			metrics.BatteryHealthScore = p.BatteryLevel // raw 0-100 for health tracking
			metrics.LastUpdated = time.Now()
			database.DB.Save(&metrics)
		} else {
			newMetrics := domain.DeviceQualityMetrics{
				DeviceID:           device.ID,
				VoltageStability:   score,
				BatteryHealthScore: p.BatteryLevel,
				LastUpdated:        time.Now(),
			}
			database.DB.Create(&newMetrics)
		}
	}(payload)

	// Build full event payload for frontend (forward everything the Pi sent)
	frontendPayload := map[string]interface{}{
		"device_id":             payload.DeviceID,
		"voltage":               payload.Voltage,
		"battery_level":         payload.BatteryLevel,
		"state":                 payload.State,
		"source":                payload.Source,
		"connected_nodes_count": payload.ConnectedNodesCount,
		"connected_nodes":       payload.ConnectedNodes,
		"nodes_detail":          payload.NodesDetail,
	}

	event := IoTEvent{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Type:      "node_data",
		Payload:   frontendPayload,
	}

	IoTBroker.Broadcast <- event

	c.JSON(http.StatusOK, gin.H{"status": "received", "type": "node_data", "updated": true})
}
