package handlers

import (
	"log"
	"net/http"
	"time"

	"los-tecnicos/backend/internal/core/domain"
	"los-tecnicos/backend/internal/database"

	"github.com/gin-gonic/gin"
)

// ──────────────────────────────────────────────────────────────
// Request Types
// ──────────────────────────────────────────────────────────────

type TransferRequest struct {
	DeviceID    string `json:"device_id" binding:"required"`
	SenderUID   string `json:"sender_uid" binding:"required"`
	ReceiverUID string `json:"receiver_uid" binding:"required"`
}

type TransferStopRequest struct {
	DeviceID string `json:"device_id" binding:"required"`
}

// ──────────────────────────────────────────────────────────────
// GET /iot/nodes/:device_id — returns current node states + schedule commands
// ──────────────────────────────────────────────────────────────

func HandleGetNodes(c *gin.Context) {
	deviceID := c.Param("device_id")
	if deviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "device_id is required"})
		return
	}

	// Only return nodes that have been updated within the last 2 minutes (Pi is actively pinging)
	staleThreshold := time.Now().Add(-2 * time.Minute)

	var nodes []domain.NodeDetail
	database.DB.Where("device_id = ? AND updated_at > ?", deviceID, staleThreshold).Find(&nodes)

	// Get current schedule commands
	var commands []domain.ScheduleCommand
	database.DB.Where("device_id = ?", deviceID).Find(&commands)

	// Build command map
	cmdMap := make(map[string]string)
	for _, cmd := range commands {
		cmdMap[cmd.NodeUID] = cmd.Action
	}

	// Build response: merge node state + current action
	type NodeInfo struct {
		UID       string  `json:"uid"`
		IP        string  `json:"ip"`
		Voltage   float64 `json:"voltage"`
		SoC       float64 `json:"soc"`
		State     string  `json:"state"`
		Action    string  `json:"action"` // current scheduled action
		UpdatedAt string  `json:"updated_at"`
	}

	nodeInfos := make([]NodeInfo, len(nodes))
	for i, nd := range nodes {
		action := "idle"
		if a, ok := cmdMap[nd.UID]; ok {
			action = a
		}
		nodeInfos[i] = NodeInfo{
			UID:       nd.UID,
			IP:        nd.IP,
			Voltage:   nd.Voltage,
			SoC:       nd.SoC,
			State:     nd.State,
			Action:    action,
			UpdatedAt: nd.UpdatedAt.Format(time.RFC3339),
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"device_id": deviceID,
		"nodes":     nodeInfos,
		"count":     len(nodeInfos),
	})
}

// ──────────────────────────────────────────────────────────────
// POST /iot/transfer — manually trigger energy transfer between two nodes
// ──────────────────────────────────────────────────────────────

func HandleTransfer(c *gin.Context) {
	var req TransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON: " + err.Error()})
		return
	}

	if req.SenderUID == req.ReceiverUID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "sender and receiver must be different nodes"})
		return
	}

	log.Printf("[TRANSFER] ⚡ Manual transfer: %s → %s on device %s",
		req.SenderUID, req.ReceiverUID, req.DeviceID)

	now := time.Now()

	// Set sender to "discharge"
	upsertScheduleCommand(req.DeviceID, req.SenderUID, "discharge",
		"manual transfer — discharging to "+req.ReceiverUID, now)

	// Set receiver to "charge"
	upsertScheduleCommand(req.DeviceID, req.ReceiverUID, "charge",
		"manual transfer — charging from "+req.SenderUID, now)

	// Broadcast transfer event via SSE
	event := IoTEvent{
		Timestamp: now.UTC().Format(time.RFC3339),
		Type:      "transfer",
		Payload: map[string]interface{}{
			"device_id":    req.DeviceID,
			"sender_uid":   req.SenderUID,
			"receiver_uid": req.ReceiverUID,
			"status":       "started",
		},
	}
	IoTBroker.Broadcast <- event

	c.JSON(http.StatusOK, gin.H{
		"status":          "transfer_started",
		"sender_uid":      req.SenderUID,
		"sender_action":   "discharge",
		"receiver_uid":    req.ReceiverUID,
		"receiver_action": "charge",
		"message":         req.SenderUID + " will discharge → " + req.ReceiverUID + " will charge on next Pi poll",
	})
}

// ──────────────────────────────────────────────────────────────
// POST /iot/transfer/stop — stop all active transfers, reset everything to idle
// ──────────────────────────────────────────────────────────────

func HandleTransferStop(c *gin.Context) {
	var req TransferStopRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON: " + err.Error()})
		return
	}

	log.Printf("[TRANSFER] 🛑 Stopping all transfers on device %s", req.DeviceID)

	now := time.Now()

	// Reset all schedule commands for this device to idle
	var commands []domain.ScheduleCommand
	database.DB.Where("device_id = ?", req.DeviceID).Find(&commands)

	resetNodes := []string{}
	for _, cmd := range commands {
		if cmd.Action != "idle" {
			cmd.Action = "idle"
			cmd.Reason = "manual stop — all transfers halted"
			cmd.IssuedAt = now
			database.DB.Save(&cmd)
			resetNodes = append(resetNodes, cmd.NodeUID)

			// Log the stop
			logEntry := domain.ScheduleLog{
				DeviceID:  req.DeviceID,
				NodeUID:   cmd.NodeUID,
				Action:    "idle",
				Reason:    "manual stop — all transfers halted",
				Timestamp: now,
			}
			database.DB.Create(&logEntry)
		}
	}

	// Broadcast stop event via SSE
	event := IoTEvent{
		Timestamp: now.UTC().Format(time.RFC3339),
		Type:      "transfer",
		Payload: map[string]interface{}{
			"device_id":   req.DeviceID,
			"status":      "stopped",
			"reset_nodes": resetNodes,
		},
	}
	IoTBroker.Broadcast <- event

	c.JSON(http.StatusOK, gin.H{
		"status":      "all_transfers_stopped",
		"reset_nodes": resetNodes,
		"message":     "All nodes set to idle on next Pi poll",
	})
}

// ──────────────────────────────────────────────────────────────
// Helper: upsert a ScheduleCommand + append ScheduleLog
// ──────────────────────────────────────────────────────────────

func upsertScheduleCommand(deviceID, nodeUID, action, reason string, now time.Time) {
	var existing domain.ScheduleCommand
	err := database.DB.Where("device_id = ? AND node_uid = ?", deviceID, nodeUID).First(&existing).Error
	if err != nil {
		newCmd := domain.ScheduleCommand{
			DeviceID: deviceID,
			NodeUID:  nodeUID,
			Action:   action,
			Reason:   reason,
			IssuedAt: now,
		}
		database.DB.Create(&newCmd)
	} else {
		existing.Action = action
		existing.Reason = reason
		existing.IssuedAt = now
		database.DB.Save(&existing)
	}

	// Append audit log
	logEntry := domain.ScheduleLog{
		DeviceID:  deviceID,
		NodeUID:   nodeUID,
		Action:    action,
		Reason:    reason,
		Timestamp: now,
	}
	database.DB.Create(&logEntry)
}
