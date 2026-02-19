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
	Action string `json:"action"` // "charge", "discharge", "idle"
	Reason string `json:"reason"`
}

// GridSummary provides a snapshot of the overall grid state after scheduling.
type GridSummary struct {
	AvgSoC           float64 `json:"avg_soc"`
	DischargingNodes int     `json:"discharging_nodes"`
	ChargingNodes    int     `json:"charging_nodes"`
	IdleNodes        int     `json:"idle_nodes"`
}

// ──────────────────────────────────────────────────────────────
// SoC Thresholds
// ──────────────────────────────────────────────────────────────

const (
	SoCCritical     = 20.0 // Below this → node MUST receive charge
	SoCLow          = 40.0 // Below this → node SHOULD receive charge
	SoCHigh         = 70.0 // Above this → node CAN donate (discharge)
	SoCFull         = 90.0 // Above this → node SHOULD donate
	BalanceDeadband = 10.0 // If all nodes within this % of each other → no transfer needed
	MinTransferGap  = 15.0 // Minimum SoC gap between sender and receiver to justify a transfer
)

// ──────────────────────────────────────────────────────────────
// Main Scheduling Function
//
// Design principles:
//   1. Default state is IDLE for all nodes
//   2. Only paired nodes (sender→receiver) change state
//   3. Sender = "discharge", Receiver = "charge"
//   4. Non-participating nodes keep their PREVIOUS state
//   5. Voltage is NOT a constraint (circuit handles V conversion)
//   6. Pairing is purely SoC-based
//   7. #senders >= #receivers (shared rail constraint)
// ──────────────────────────────────────────────────────────────

func Schedule(deviceID string, nodes []NodeState) ([]NodeCommand, GridSummary) {
	n := len(nodes)

	// ─── Edge case: no nodes ───
	if n == 0 {
		return []NodeCommand{}, GridSummary{}
	}

	// Build a map of previous states from the DB
	prevState := getPreviousStates(deviceID)

	// ─── Edge case: single node → keep previous state ───
	if n == 1 {
		prev := getPrevAction(prevState, nodes[0].UID)
		cmd := NodeCommand{
			NodeID: nodes[0].UID,
			Action: prev,
			Reason: "single node — no partner for energy transfer",
		}
		summary := GridSummary{AvgSoC: nodes[0].SoC, IdleNodes: 1}
		persistDecisions(deviceID, []NodeCommand{cmd}, nodes)
		return []NodeCommand{cmd}, summary
	}

	// ─── Check if all nodes are balanced (within deadband) → no transfer ───
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
			prev := getPrevAction(prevState, nd.UID)
			commands[i] = NodeCommand{
				NodeID: nd.UID,
				Action: prev,
				Reason: fmt.Sprintf("balanced (spread %.1f%% < %.0f%% deadband) — keeping %s", maxSoC-minSoC, BalanceDeadband, prev),
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

	// ─── Pair-based assignment ───
	// Strategy: Match highest-SoC node (sender/discharge) with lowest-SoC node (receiver/charge)
	// Only pair if the SoC gap is meaningful (> MinTransferGap)
	// Non-participating nodes keep their previous state

	assigned := make(map[string]NodeCommand) // UID → command

	lo := 0               // pointer to lowest SoC (potential receivers)
	hi := len(sorted) - 1 // pointer to highest SoC (potential senders)

	for lo < hi {
		receiver := sorted[lo]
		sender := sorted[hi]

		gap := sender.SoC - receiver.SoC

		// Skip FAULT nodes
		if receiver.State == "FAULT" {
			prev := getPrevAction(prevState, receiver.UID)
			assigned[receiver.UID] = NodeCommand{
				NodeID: receiver.UID,
				Action: prev,
				Reason: "FAULT — keeping previous state",
			}
			lo++
			continue
		}
		if sender.State == "FAULT" {
			prev := getPrevAction(prevState, sender.UID)
			assigned[sender.UID] = NodeCommand{
				NodeID: sender.UID,
				Action: prev,
				Reason: "FAULT — keeping previous state",
			}
			hi--
			continue
		}

		// Check if transfer is worthwhile
		if gap < MinTransferGap {
			break // remaining nodes are too close in SoC, stop pairing
		}

		// Check if receiver actually needs charge and sender can afford to discharge
		if receiver.SoC >= SoCHigh {
			break // even the "lowest" is high enough, no one needs charge
		}
		if sender.SoC <= SoCLow {
			break // even the "highest" is too low to donate
		}

		// ─── PAIR: sender (discharge) → receiver (charge) ───
		assigned[sender.UID] = NodeCommand{
			NodeID: sender.UID,
			Action: "discharge",
			Reason: fmt.Sprintf("SoC %.1f%% → donating to %s (SoC %.1f%%, gap %.1f%%)",
				sender.SoC, receiver.UID, receiver.SoC, gap),
		}
		assigned[receiver.UID] = NodeCommand{
			NodeID: receiver.UID,
			Action: "charge",
			Reason: fmt.Sprintf("SoC %.1f%% → receiving from %s (SoC %.1f%%, gap %.1f%%)",
				receiver.SoC, sender.UID, sender.SoC, gap),
		}

		lo++
		hi--
	}

	// ─── Non-participating nodes keep their previous state ───
	commands := make([]NodeCommand, n)
	for i, nd := range nodes {
		if cmd, ok := assigned[nd.UID]; ok {
			commands[i] = cmd
		} else {
			prev := getPrevAction(prevState, nd.UID)
			commands[i] = NodeCommand{
				NodeID: nd.UID,
				Action: prev,
				Reason: fmt.Sprintf("not participating in transfer — keeping %s", prev),
			}
		}
	}

	summary := buildSummary(commands, nodes)
	persistDecisions(deviceID, commands, nodes)

	log.Printf("[SCHEDULER] Device %s → %d discharge, %d charge, %d idle (avgSoC=%.1f%%)",
		deviceID, summary.DischargingNodes, summary.ChargingNodes, summary.IdleNodes, summary.AvgSoC)

	return commands, summary
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

// getPreviousStates fetches the last-known action for each node under a device.
func getPreviousStates(deviceID string) map[string]string {
	var commands []domain.ScheduleCommand
	database.DB.Where("device_id = ?", deviceID).Find(&commands)

	m := make(map[string]string)
	for _, cmd := range commands {
		m[cmd.NodeUID] = cmd.Action
	}
	return m
}

// getPrevAction returns the previous action for a node, defaulting to "idle".
func getPrevAction(prevState map[string]string, uid string) string {
	if action, ok := prevState[uid]; ok && action != "" {
		return action
	}
	return "idle"
}

func buildSummary(commands []NodeCommand, nodes []NodeState) GridSummary {
	totalSoC := 0.0
	for _, nd := range nodes {
		totalSoC += nd.SoC
	}
	avgSoC := totalSoC / math.Max(float64(len(nodes)), 1)

	s := GridSummary{AvgSoC: math.Round(avgSoC*10) / 10}
	for _, cmd := range commands {
		switch cmd.Action {
		case "discharge":
			s.DischargingNodes++
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
			newCmd := domain.ScheduleCommand{
				DeviceID: deviceID,
				NodeUID:  cmd.NodeID,
				Action:   cmd.Action,
				Reason:   cmd.Reason,
				IssuedAt: now,
			}
			database.DB.Create(&newCmd)
		} else {
			existing.Action = cmd.Action
			existing.Reason = cmd.Reason
			existing.IssuedAt = now
			database.DB.Save(&existing)
		}

		// Append to ScheduleLog
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
		return 50.0, 0, 0
	}

	total := 0.0
	for _, nd := range nodes {
		total += nd.SoC
	}
	avgSoC = total / float64(len(nodes))

	var commands []domain.ScheduleCommand
	database.DB.Where("device_id = ?", deviceID).Find(&commands)
	for _, cmd := range commands {
		switch cmd.Action {
		case "discharge":
			supplyCount++
		case "charge":
			demandCount++
		}
	}

	return avgSoC, supplyCount, demandCount
}
