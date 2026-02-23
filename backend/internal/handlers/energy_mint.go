package handlers

import (
	"fmt"
	"log"
	"math"
	"net/http"
	"time"

	"los-tecnicos/backend/internal/blockchain"
	"los-tecnicos/backend/internal/config"
	"los-tecnicos/backend/internal/core/domain"
	"los-tecnicos/backend/internal/database"
	"los-tecnicos/backend/internal/pricing"

	"github.com/gin-gonic/gin"
)

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────

const (
	TokensPerKwh      = 1000.0 // 1 kWh = 1000 LT tokens (allows fractional energy)
	CO2EmissionFactor = 0.82   // kg CO₂ per kWh (India grid average)
	CarbonCreditPerKg = 0.05   // XLM per kg CO₂ saved
	MinMintableKwh    = 0.001  // Minimum energy to trigger a mint
	MaxMintableKwh    = 10.0   // Maximum plausible single transfer
)

// ──────────────────────────────────────────────────────────────
// POST /iot/energy/report — Pi reports completed energy transfer
// ──────────────────────────────────────────────────────────────

type EnergyReportRequest struct {
	DeviceID        string  `json:"device_id" binding:"required"`
	SenderUID       string  `json:"sender_uid" binding:"required"`
	ReceiverUID     string  `json:"receiver_uid" binding:"required"`
	KwhTransferred  float64 `json:"kwh_transferred" binding:"required"`
	DurationSeconds float64 `json:"duration_seconds"`
	AvgVoltage      float64 `json:"avg_voltage"`
	AvgCurrent      float64 `json:"avg_current"`
}

func HandleEnergyReport(c *gin.Context) {
	var req EnergyReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// ─── Validate energy amount ───
	if req.KwhTransferred < MinMintableKwh {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("kWh too small (min %.3f)", MinMintableKwh)})
		return
	}
	if req.KwhTransferred > MaxMintableKwh {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("kWh too large (max %.1f)", MaxMintableKwh)})
		return
	}

	// ─── Verify there was an active discharge command for this sender ───
	var cmd domain.ScheduleCommand
	err := database.DB.Where("device_id = ? AND node_uid = ? AND action = ?",
		req.DeviceID, req.SenderUID, "discharge").First(&cmd).Error
	if err != nil {
		log.Printf("[MINT] ⚠️ No active discharge command for %s on %s", req.SenderUID, req.DeviceID)
		// Still allow minting but log the discrepancy
	}

	// ─── Calculate quality factor based on voltage stability ───
	qualityFactor := 1.0
	if req.AvgVoltage > 0 {
		// Good voltage (3.6-4.2V for Li-ion) = higher quality
		if req.AvgVoltage >= 3.6 && req.AvgVoltage <= 4.2 {
			qualityFactor = 1.0 + (req.AvgVoltage-3.6)/6.0 // 1.0 to 1.1
		} else {
			qualityFactor = 0.85 // Penalty for out-of-range voltage
		}
	}

	// ─── Calculate tokens to mint ───
	tokensMinted := req.KwhTransferred * TokensPerKwh * qualityFactor
	tokensMinted = math.Round(tokensMinted*100) / 100 // Round to 2 decimals

	// ─── Trigger Soroban mint (calls energy_token.mint) ───
	txHash := "mint_" + time.Now().Format("20060102_150405")
	contractID := config.GetEnv("TOKEN_CONTRACT_ID", "")

	// Default to SenderUID if wallet mapping fails
	ownerWallet := req.SenderUID

	// 1. Try to find owner wallet by the specific Node UID (Virtual Device Linking)
	var depinNode domain.DePINNode
	if err := database.DB.Where("device_id = ?", req.SenderUID).First(&depinNode).Error; err == nil && depinNode.OperatorWallet != "" {
		ownerWallet = depinNode.OperatorWallet
		log.Printf("[MINT] Found linked wallet %s for node %s", ownerWallet, req.SenderUID)
	} else if err := database.DB.Where("device_id = ?", req.DeviceID).First(&depinNode).Error; err == nil && depinNode.OperatorWallet != "" {
		// 2. Fallback to root DeviceID
		ownerWallet = depinNode.OperatorWallet
		log.Printf("[MINT] Found linked wallet %s for root device %s", ownerWallet, req.DeviceID)
	} else {
		log.Printf("[MINT] ⚠️ No wallet linked for node %s or device %s. Using UID as fallback.", req.SenderUID, req.DeviceID)
	}

	// Trigger Soroban mint if contract is configured
	if contractID != "" && ownerWallet != "" && ownerWallet != req.SenderUID {
		rpcURL := config.GetEnv("SOROBAN_RPC_URL", "https://soroban-testnet.stellar.org:443")
		client := blockchain.NewSorobanClient(rpcURL)
		hash, err := client.MintTokens(ownerWallet, tokensMinted)
		if err != nil {
			log.Printf("[MINT] ⚠️ Soroban mint call failed: %v (continuing with local record)", err)
		} else {
			txHash = hash
			log.Printf("[MINT] ✨ Successfully minted on Soroban to wallet %s", ownerWallet)
		}
	}

	// ─── Record the mint ───
	mint := domain.EnergyMint{
		DeviceID:        req.DeviceID,
		SenderUID:       ownerWallet, // Mapped to wallet
		ReceiverUID:     req.ReceiverUID,
		KwhTransferred:  req.KwhTransferred,
		TokensMinted:    tokensMinted,
		QualityFactor:   qualityFactor,
		AvgVoltage:      req.AvgVoltage,
		AvgCurrent:      req.AvgCurrent,
		DurationSeconds: req.DurationSeconds,
		TxHash:          txHash,
		Status:          "minted",
		Timestamp:       time.Now(),
	}
	database.DB.Create(&mint)

	log.Printf("[MINT] ⚡ Minted %.2f LT tokens for %s (%.4f kWh, quality=%.2f)",
		tokensMinted, ownerWallet, req.KwhTransferred, qualityFactor)

	// ─── Auto-create sell order on marketplace ───
	pe := pricing.NewPricingEngine()
	// Use a dummy order to get current market price
	dummySell := domain.EnergyOrder{Type: "sell"}
	dummyBuy := domain.EnergyOrder{Type: "buy"}
	dynamicPrice, _, _ := pe.CalculateDynamicPrice(dummyBuy, dummySell, 1, 1, 50, 1.0)

	sellOrder := domain.EnergyOrder{
		ID:         fmt.Sprintf("auto_sell_%d", mint.ID),
		UserID:     ownerWallet, // Assigned to the web3 wallet instead of raw node UID
		Type:       "sell",
		KwhAmount:  req.KwhTransferred,
		TokenPrice: dynamicPrice,
		Status:     "Created",
		CreatedAt:  time.Now(),
	}
	database.DB.Create(&sellOrder)

	mint.Status = "listed"
	database.DB.Save(&mint)

	log.Printf("[MINT] 📋 Auto-listed sell order %s: %.4f kWh @ %.2f XLM",
		sellOrder.ID, req.KwhTransferred, dynamicPrice)

	// ─── Record carbon credit ───
	co2Saved := req.KwhTransferred * CO2EmissionFactor
	creditValue := co2Saved * CarbonCreditPerKg
	carbon := domain.CarbonCredit{
		DeviceID:    req.DeviceID,
		KwhOffset:   req.KwhTransferred,
		CO2SavedKg:  co2Saved,
		CreditValue: creditValue,
		Timestamp:   time.Now(),
	}
	database.DB.Create(&carbon)

	log.Printf("[CARBON] 🌱 Saved %.3f kg CO₂ (%.4f kWh × %.2f factor)",
		co2Saved, req.KwhTransferred, CO2EmissionFactor)

	// ─── Broadcast via SSE ───
	event := IoTEvent{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Type:      "energy_mint",
		Payload: map[string]interface{}{
			"device_id":       req.DeviceID,
			"sender_uid":      req.SenderUID,
			"receiver_uid":    req.ReceiverUID,
			"kwh_transferred": req.KwhTransferred,
			"tokens_minted":   tokensMinted,
			"quality_factor":  qualityFactor,
			"dynamic_price":   dynamicPrice,
			"co2_saved_kg":    co2Saved,
			"sell_order_id":   sellOrder.ID,
			"tx_hash":         txHash,
		},
	}
	IoTBroker.Broadcast <- event

	c.JSON(http.StatusOK, gin.H{
		"status":         "minted",
		"tokens_minted":  tokensMinted,
		"quality_factor": qualityFactor,
		"sell_order_id":  sellOrder.ID,
		"dynamic_price":  dynamicPrice,
		"co2_saved_kg":   co2Saved,
		"carbon_credit":  creditValue,
		"tx_hash":        txHash,
		"message": fmt.Sprintf("⚡ %.2f LT tokens minted for %.4f kWh → auto-listed at %.2f XLM/kWh",
			tokensMinted, req.KwhTransferred, dynamicPrice),
	})
}

// ──────────────────────────────────────────────────────────────
// GET /api/v1/tokens/supply — Token supply stats
// ──────────────────────────────────────────────────────────────

func GetTokenSupply(c *gin.Context) {
	var totalMinted float64
	var totalBurned float64
	var mintCount int64

	database.DB.Model(&domain.EnergyMint{}).Select("COALESCE(SUM(tokens_minted), 0)").Row().Scan(&totalMinted)
	database.DB.Model(&domain.TokenBurn{}).Select("COALESCE(SUM(tokens_burned), 0)").Row().Scan(&totalBurned)
	database.DB.Model(&domain.EnergyMint{}).Count(&mintCount)

	circulating := totalMinted - totalBurned

	c.JSON(http.StatusOK, gin.H{
		"total_minted":       totalMinted,
		"total_burned":       totalBurned,
		"circulating_supply": circulating,
		"total_mint_events":  mintCount,
		"token_name":         "LT (Los Técnicos Energy Token)",
		"ratio":              "1 kWh = 1000 LT",
	})
}
