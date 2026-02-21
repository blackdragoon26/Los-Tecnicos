package handlers

import (
	"log"
	"math"
	"net/http"
	"time"

	"los-tecnicos/backend/internal/core/domain"
	"los-tecnicos/backend/internal/database"

	"github.com/gin-gonic/gin"
)

// ══════════════════════════════════════════════════════════════
// DePIN: Decentralized Physical Infrastructure Network
// ══════════════════════════════════════════════════════════════

const (
	RegistrationReward = 100.0 // LT tokens for registering a node
	UptimeRewardPerDay = 10.0  // LT tokens per 24h uptime
	KwhRewardRate      = 1.0   // LT tokens per kWh routed
	ReliabilityBonus   = 50.0  // LT tokens for >90% monthly uptime
)

// ──────────────────────────────────────────────────────────────
// POST /api/v1/depin/register — Register physical hardware
// ──────────────────────────────────────────────────────────────

type DePINRegisterRequest struct {
	DeviceID        string `json:"device_id" binding:"required"`
	OperatorWallet  string `json:"operator_wallet"`
	HardwareType    string `json:"hardware_type"` // "rpi4b", "esp32"
	FirmwareVersion string `json:"firmware_version"`
}

func HandleDePINRegister(c *gin.Context) {
	var req DePINRegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if already registered
	var existing domain.DePINNode
	if err := database.DB.Where("device_id = ?", req.DeviceID).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "device already registered", "node_id": existing.ID})
		return
	}

	now := time.Now()
	node := domain.DePINNode{
		DeviceID:        req.DeviceID,
		OperatorWallet:  req.OperatorWallet,
		HardwareType:    req.HardwareType,
		FirmwareVersion: req.FirmwareVersion,
		TotalKwhRouted:  0,
		TotalUptime:     0,
		RewardsEarned:   RegistrationReward, // Welcome bonus
		ReliabilityPct:  100.0,
		OnChainTxHash:   "depin_reg_" + now.Format("20060102_150405"),
		RegisteredAt:    now,
		LastSeen:        now,
	}
	database.DB.Create(&node)

	// Record the registration reward
	yieldRecord := domain.YieldRecord{
		UserID:    req.OperatorWallet,
		Amount:    RegistrationReward,
		Source:    "DePIN_Registration_Bonus",
		Timestamp: now,
	}
	database.DB.Create(&yieldRecord)

	log.Printf("[DEPIN] 🖥️ Registered node %s (type=%s, wallet=%s, reward=%.0f LT)",
		req.DeviceID, req.HardwareType, req.OperatorWallet, RegistrationReward)

	// Broadcast SSE
	IoTBroker.Broadcast <- IoTEvent{
		Timestamp: now.UTC().Format(time.RFC3339),
		Type:      "depin_register",
		Payload: map[string]interface{}{
			"device_id": req.DeviceID,
			"hardware":  req.HardwareType,
			"reward":    RegistrationReward,
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"status":        "registered",
		"node_id":       node.ID,
		"device_id":     req.DeviceID,
		"reward_earned": RegistrationReward,
		"on_chain_tx":   node.OnChainTxHash,
		"message":       "🖥️ Hardware registered on DePIN network — " + req.DeviceID,
	})
}

// ──────────────────────────────────────────────────────────────
// POST /api/v1/depin/heartbeat — Update node uptime + earn rewards
// ──────────────────────────────────────────────────────────────

type HeartbeatRequest struct {
	DeviceID string  `json:"device_id" binding:"required"`
	KwhSince float64 `json:"kwh_since"` // kWh transferred since last heartbeat
}

func HandleDePINHeartbeat(c *gin.Context) {
	var req HeartbeatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var node domain.DePINNode
	if err := database.DB.Where("device_id = ?", req.DeviceID).First(&node).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "device not registered in DePIN network"})
		return
	}

	now := time.Now()
	timeSinceLastSeen := now.Sub(node.LastSeen).Seconds()

	// Update uptime
	node.TotalUptime += int64(timeSinceLastSeen)
	node.LastSeen = now

	// kWh reward
	kwhReward := 0.0
	if req.KwhSince > 0 {
		node.TotalKwhRouted += req.KwhSince
		kwhReward = req.KwhSince * KwhRewardRate
		node.RewardsEarned += kwhReward
	}

	// Uptime reward (proportional to time since last heartbeat)
	uptimeReward := (timeSinceLastSeen / 86400.0) * UptimeRewardPerDay
	node.RewardsEarned += uptimeReward

	// Calculate reliability
	registeredDuration := now.Sub(node.RegisteredAt).Seconds()
	if registeredDuration > 0 {
		node.ReliabilityPct = math.Min(100, (float64(node.TotalUptime)/registeredDuration)*100)
	}

	database.DB.Save(&node)

	c.JSON(http.StatusOK, gin.H{
		"status":         "heartbeat_recorded",
		"total_uptime_h": math.Round(float64(node.TotalUptime)/3600*10) / 10,
		"total_kwh":      math.Round(node.TotalKwhRouted*10000) / 10000,
		"reliability":    math.Round(node.ReliabilityPct*10) / 10,
		"rewards_earned": math.Round(node.RewardsEarned*100) / 100,
		"uptime_reward":  math.Round(uptimeReward*1000) / 1000,
		"kwh_reward":     math.Round(kwhReward*100) / 100,
	})
}

// ──────────────────────────────────────────────────────────────
// GET /api/v1/depin/nodes — All registered DePIN nodes
// ──────────────────────────────────────────────────────────────

func GetDePINNodes(c *gin.Context) {
	var nodes []domain.DePINNode
	database.DB.Order("rewards_earned desc").Find(&nodes)

	var totalKwh, totalRewards float64
	var totalUptime int64
	for _, n := range nodes {
		totalKwh += n.TotalKwhRouted
		totalRewards += n.RewardsEarned
		totalUptime += n.TotalUptime
	}

	c.JSON(http.StatusOK, gin.H{
		"nodes":          nodes,
		"total_nodes":    len(nodes),
		"total_kwh":      math.Round(totalKwh*10000) / 10000,
		"total_rewards":  math.Round(totalRewards*100) / 100,
		"total_uptime_h": math.Round(float64(totalUptime)/3600*10) / 10,
		"network_health": calculateNetworkHealth(nodes),
	})
}

func calculateNetworkHealth(nodes []domain.DePINNode) string {
	if len(nodes) == 0 {
		return "no_nodes"
	}
	avgReliability := 0.0
	recentCount := 0
	for _, n := range nodes {
		avgReliability += n.ReliabilityPct
		if time.Since(n.LastSeen).Minutes() < 10 {
			recentCount++
		}
	}
	avgReliability /= float64(len(nodes))

	onlinePct := float64(recentCount) / float64(len(nodes)) * 100

	if avgReliability > 90 && onlinePct > 80 {
		return "excellent"
	} else if avgReliability > 70 && onlinePct > 50 {
		return "good"
	} else if avgReliability > 50 {
		return "degraded"
	}
	return "critical"
}

// ──────────────────────────────────────────────────────────────
// GET /api/v1/depin/stats — DePIN network statistics
// ──────────────────────────────────────────────────────────────

func GetDePINStats(c *gin.Context) {
	var nodeCount int64
	var totalKwh, totalRewards float64
	var totalUptime int64

	database.DB.Model(&domain.DePINNode{}).Count(&nodeCount)
	database.DB.Model(&domain.DePINNode{}).Select("COALESCE(SUM(total_kwh_routed), 0)").Row().Scan(&totalKwh)
	database.DB.Model(&domain.DePINNode{}).Select("COALESCE(SUM(rewards_earned), 0)").Row().Scan(&totalRewards)
	database.DB.Model(&domain.DePINNode{}).Select("COALESCE(SUM(total_uptime), 0)").Row().Scan(&totalUptime)

	// Calculate CO₂ offset from all DePIN activity
	co2Saved := totalKwh * CO2EmissionFactor

	c.JSON(http.StatusOK, gin.H{
		"total_nodes":        nodeCount,
		"total_kwh_routed":   math.Round(totalKwh*10000) / 10000,
		"total_rewards_paid": math.Round(totalRewards*100) / 100,
		"total_uptime_hours": math.Round(float64(totalUptime)/3600*10) / 10,
		"co2_offset_kg":      math.Round(co2Saved*1000) / 1000,
		"equivalent_trees":   math.Round(co2Saved/21.77*10) / 10,
		"reward_rates": gin.H{
			"registration_bonus": RegistrationReward,
			"uptime_per_day":     UptimeRewardPerDay,
			"per_kwh_routed":     KwhRewardRate,
			"reliability_bonus":  ReliabilityBonus,
		},
	})
}
