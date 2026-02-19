package scheduling

import (
	"fmt"
	"log"
	"math"
	"sort"
	"time"

	"los-tecnicos/backend/internal/core/domain"
	"los-tecnicos/backend/internal/database"
)

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

// NodeState is the input per-node from the Pi's /iot/cmd request.
type NodeState struct {
	UID     string  `json:"uid"`
	Voltage float64 `json:"voltage"`
	SoC     float64 `json:"soc"`   // 0-100
	State   string  `json:"state"` // current state from hardware
}

// NodeCommand is the output per-node returned to the Pi.
type NodeCommand struct {
	NodeID string `json:"node_id"`
	Action string `json:"action"` // "charge", "supply", "idle"
	Reason string `json:"reason"`
}

// GridSummary provides a snapshot of the overall grid state after scheduling.
type GridSummary struct {
	AvgSoC         float64 `json:"avg_soc"`
	SupplyingNodes int     `json:"supplying_nodes"`
	ChargingNodes  int     `json:"charging_nodes"`
	IdleNodes      int     `json:"idle_nodes"`
}

// ──────────────────────────────────────────────────────────────
// SoC Thresholds
// ──────────────────────────────────────────────────────────────

const (
	SoCCritical     = 20.0 // Must charge
	SoCLow          = 40.0 // Prefers charge
	SoCHigh         = 70.0 // Prefers supply
	SoCFull         = 90.0 // Must supply or idle
	MinSafeVoltage  = 3.3  // Below this → force IDLE to protect hardware
	BalanceDeadband = 10.0 // If all nodes within this % of each other → all IDLE
)

// ──────────────────────────────────────────────────────────────
// Main Scheduling Function
// ──────────────────────────────────────────────────────────────

// Schedule takes the current state of all nodes under a device and returns
// commands for each node, respecting the shared-rail constraint:
//
//	#supply nodes >= #charge nodes
func Schedule(deviceID string, nodes []NodeState) ([]NodeCommand, GridSummary) {
	n := len(nodes)

	// ─── Edge case: no nodes ───
	if n == 0 {
		return []NodeCommand{}, GridSummary{}
	}

	// ─── Edge case: single node → always IDLE ───
	if n == 1 {
		cmd := NodeCommand{
			NodeID: nodes[0].UID,
			Action: "idle",
			Reason: "single node — no partner for energy transfer",
		}
		summary := GridSummary{AvgSoC: nodes[0].SoC, IdleNodes: 1}
		persistDecisions(deviceID, []NodeCommand{cmd}, nodes)
		return []NodeCommand{cmd}, summary
	}

	// ─── Check if all nodes are balanced (within deadband) → all IDLE ───
	minSoC, maxSoC := nodes[0].SoC, nodes[0].SoC
	for _, nd := range nodes {
		if nd.SoC < minSoC {
			minSoC = nd.SoC
		}
		if nd.SoC > maxSoC {
			maxSoC = nd.SoC
		}
	}
	if (maxSoC - minSoC) < BalanceDeadband {
		commands := make([]NodeCommand, n)
		for i, nd := range nodes {
			commands[i] = NodeCommand{
				NodeID: nd.UID,
				Action: "idle",
				Reason: fmt.Sprintf("all nodes balanced (spread %.1f%% < %.0f%% deadband)", maxSoC-minSoC, BalanceDeadband),
			}
		}
		summary := buildSummary(commands, nodes)
		persistDecisions(deviceID, commands, nodes)
		return commands, summary
	}

	// ─── Sort nodes by SoC ascending (lowest first) ───
	sorted := make([]NodeState, n)
	copy(sorted, nodes)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].SoC < sorted[j].SoC
	})

	// ─── Phase 1: Initial role assignment based on thresholds ───
	type assignment struct {
		node   NodeState
		action string
		reason string
	}
	assignments := make([]assignment, n)

	for i, nd := range sorted {
		switch {
		case nd.Voltage < MinSafeVoltage:
			assignments[i] = assignment{nd, "idle", fmt.Sprintf("voltage %.2fV < %.1fV safety limit", nd.Voltage, MinSafeVoltage)}
		case nd.State == "FAULT":
			assignments[i] = assignment{nd, "idle", "node in FAULT state — skipping"}
		case nd.SoC < SoCCritical:
			assignments[i] = assignment{nd, "charge", fmt.Sprintf("SoC %.1f%% < %.0f%% critical threshold", nd.SoC, SoCCritical)}
		case nd.SoC < SoCLow:
			assignments[i] = assignment{nd, "charge", fmt.Sprintf("SoC %.1f%% < %.0f%% low threshold", nd.SoC, SoCLow)}
		case nd.SoC > SoCFull:
			assignments[i] = assignment{nd, "supply", fmt.Sprintf("SoC %.1f%% > %.0f%% full threshold", nd.SoC, SoCFull)}
		case nd.SoC > SoCHigh:
			assignments[i] = assignment{nd, "supply", fmt.Sprintf("SoC %.1f%% > %.0f%% high threshold", nd.SoC, SoCHigh)}
		default:
			// Balanced range (40-70%) → tentatively idle, may be reassigned
			assignments[i] = assignment{nd, "idle", fmt.Sprintf("SoC %.1f%% in balanced range", nd.SoC)}
		}
	}

	// ─── Phase 2: Enforce shared-rail constraint (#supply >= #charge) ───
	supplyCount := 0
	chargeCount := 0
	idleIndices := []int{}

	for i, a := range assignments {
		switch a.action {
		case "supply":
			supplyCount++
		case "charge":
			chargeCount++
		case "idle":
			idleIndices = append(idleIndices, i)
		}
	}

	// If we have chargers but not enough suppliers, promote idle nodes to supply
	// (pick from highest SoC idle nodes first — they're at the end of sorted list)
	if chargeCount > 0 && supplyCount < chargeCount {
		deficit := chargeCount - supplyCount
		// Reverse iterate idle indices (highest SoC first since sorted ascending)
		for j := len(idleIndices) - 1; j >= 0 && deficit > 0; j-- {
			idx := idleIndices[j]
			assignments[idx].action = "supply"
			assignments[idx].reason = fmt.Sprintf("promoted to supply (SoC %.1f%%) — need >= %d suppliers for %d chargers",
				assignments[idx].node.SoC, chargeCount, chargeCount)
			supplyCount++
			deficit--
		}
	}

	// If still not enough suppliers, demote some chargers to idle (lowest priority chargers = highest SoC among chargers)
	if chargeCount > 0 && supplyCount < chargeCount {
		// Demote chargers with highest SoC until constraint is met
		for i := len(assignments) - 1; i >= 0 && supplyCount < chargeCount; i-- {
			if assignments[i].action == "charge" {
				assignments[i].action = "idle"
				assignments[i].reason = fmt.Sprintf("demoted to idle — not enough suppliers (SoC %.1f%%)", assignments[i].node.SoC)
				chargeCount--
			}
		}
	}

	// If we have suppliers but no chargers, and some nodes could use a charge, promote lowest SoC idle to charge
	if supplyCount > 0 && chargeCount == 0 {
		for i := 0; i < len(assignments) && chargeCount < supplyCount; i++ {
			if assignments[i].action == "idle" && assignments[i].node.SoC < SoCHigh {
				assignments[i].action = "charge"
				assignments[i].reason = fmt.Sprintf("promoted to charge (SoC %.1f%%) — suppliers available", assignments[i].node.SoC)
				chargeCount++
			}
		}
	}

	// ─── Phase 3: If no energy transfer is happening, idle everything ───
	finalSupply := 0
	finalCharge := 0
	for _, a := range assignments {
		if a.action == "supply" {
			finalSupply++
		}
		if a.action == "charge" {
			finalCharge++
		}
	}
	if finalSupply == 0 || finalCharge == 0 {
		for i := range assignments {
			if assignments[i].action != "idle" {
				assignments[i].action = "idle"
				assignments[i].reason = "no valid supply-charge pair — all idle"
			}
		}
	}

	// ─── Build output ───
	commands := make([]NodeCommand, n)
	for i, a := range assignments {
		commands[i] = NodeCommand{
			NodeID: a.node.UID,
			Action: a.action,
			Reason: a.reason,
		}
	}

	summary := buildSummary(commands, nodes)
	persistDecisions(deviceID, commands, nodes)

	log.Printf("[SCHEDULER] Device %s → %d supply, %d charge, %d idle (avgSoC=%.1f%%)",
		deviceID, summary.SupplyingNodes, summary.ChargingNodes, summary.IdleNodes, summary.AvgSoC)

	return commands, summary
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

func buildSummary(commands []NodeCommand, nodes []NodeState) GridSummary {
	totalSoC := 0.0
	for _, nd := range nodes {
		totalSoC += nd.SoC
	}
	avgSoC := totalSoC / math.Max(float64(len(nodes)), 1)

	s := GridSummary{AvgSoC: math.Round(avgSoC*10) / 10}
	for _, cmd := range commands {
		switch cmd.Action {
		case "supply":
			s.SupplyingNodes++
		case "charge":
			s.ChargingNodes++
		case "idle":
			s.IdleNodes++
		}
	}
	return s
}

// persistDecisions writes to both ScheduleCommand (upsert) and ScheduleLog (append).
func persistDecisions(deviceID string, commands []NodeCommand, nodes []NodeState) {
	// Build a lookup for node state by UID
	stateMap := map[string]NodeState{}
	for _, nd := range nodes {
		stateMap[nd.UID] = nd
	}

	now := time.Now()

	for _, cmd := range commands {
		ns := stateMap[cmd.NodeID]

		// Upsert ScheduleCommand (latest action per device+node)
		var existing domain.ScheduleCommand
		err := database.DB.Where("device_id = ? AND node_uid = ?", deviceID, cmd.NodeID).First(&existing).Error
		if err != nil {
			// Create
			newCmd := domain.ScheduleCommand{
				DeviceID: deviceID,
				NodeUID:  cmd.NodeID,
				Action:   cmd.Action,
				Reason:   cmd.Reason,
				IssuedAt: now,
			}
			database.DB.Create(&newCmd)
		} else {
			// Update
			existing.Action = cmd.Action
			existing.Reason = cmd.Reason
			existing.IssuedAt = now
			database.DB.Save(&existing)
		}

		// Append to ScheduleLog (audit trail)
		logEntry := domain.ScheduleLog{
			DeviceID:      deviceID,
			NodeUID:       cmd.NodeID,
			Action:        cmd.Action,
			SoCAtTime:     ns.SoC,
			VoltageAtTime: ns.Voltage,
			Reason:        cmd.Reason,
			Timestamp:     now,
		}
		database.DB.Create(&logEntry)
	}
}

// GetGridSoC returns the current average SoC across all active nodes for a device.
// Used by the pricing engine to get real-time grid state.
func GetGridSoC(deviceID string) (avgSoC float64, supplyCount int, demandCount int) {
	var nodes []domain.NodeDetail
	database.DB.Where("device_id = ?", deviceID).Find(&nodes)

	if len(nodes) == 0 {
		return 50.0, 0, 0 // default fallback
	}

	total := 0.0
	for _, nd := range nodes {
		total += nd.SoC
	}
	avgSoC = total / float64(len(nodes))

	// Count from latest schedule commands
	var commands []domain.ScheduleCommand
	database.DB.Where("device_id = ?", deviceID).Find(&commands)
	for _, cmd := range commands {
		switch cmd.Action {
		case "supply":
			supplyCount++
		case "charge":
			demandCount++
		}
	}

	return avgSoC, supplyCount, demandCount
}
