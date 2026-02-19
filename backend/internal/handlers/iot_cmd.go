package handlers

import (
	"log"
	"net/http"
	"time"

	"los-tecnicos/backend/internal/scheduling"

	"github.com/gin-gonic/gin"
)

// ──────────────────────────────────────────────────────────────
// Request / Response Types
// ──────────────────────────────────────────────────────────────

// CmdRequest is the JSON body sent by the Raspberry Pi every 5 seconds.
type CmdRequest struct {
	DeviceID string                 `json:"device_id" binding:"required"`
	Nodes    []scheduling.NodeState `json:"nodes" binding:"required"`
}

// CmdResponse is the JSON returned to the Pi with commands for each node.
type CmdResponse struct {
	Commands    []scheduling.NodeCommand `json:"commands"`
	GridSummary scheduling.GridSummary   `json:"grid_summary"`
}

// ──────────────────────────────────────────────────────────────
// POST /iot/cmd — Node scheduling endpoint
// ──────────────────────────────────────────────────────────────

func HandleIoTCmd(c *gin.Context) {
	var req CmdRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[IoT-CMD] ❌ Bad JSON from %s: %v", c.ClientIP(), err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON: " + err.Error()})
		return
	}

	// Validate: max 5 nodes for prototype
	if len(req.Nodes) > 5 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "max 5 nodes supported per device"})
		return
	}

	log.Printf("[IoT-CMD] 🎯 Schedule request from device %s with %d nodes (IP: %s)",
		req.DeviceID, len(req.Nodes), c.ClientIP())

	// Run the scheduling algorithm
	commands, summary := scheduling.Schedule(req.DeviceID, req.Nodes)

	// Broadcast schedule decision to frontend via SSE
	nodesCmdList := make([]map[string]interface{}, len(commands))
	for i, cmd := range commands {
		nodesCmdList[i] = map[string]interface{}{
			"node_id": cmd.NodeID,
			"action":  cmd.Action,
			"reason":  cmd.Reason,
		}
	}

	event := IoTEvent{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Type:      "schedule",
		Payload: map[string]interface{}{
			"device_id":    req.DeviceID,
			"commands":     nodesCmdList,
			"grid_summary": summary,
		},
	}
	IoTBroker.Broadcast <- event

	// Return commands to the Pi
	c.JSON(http.StatusOK, CmdResponse{
		Commands:    commands,
		GridSummary: summary,
	})
}
