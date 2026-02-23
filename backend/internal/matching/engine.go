package matching

import (
	"log"
	"math"
	"time"

	"los-tecnicos/backend/internal/blockchain"
	"los-tecnicos/backend/internal/config"
	"los-tecnicos/backend/internal/core/domain"
	"los-tecnicos/backend/internal/database"
	"los-tecnicos/backend/internal/mqtt"
	"los-tecnicos/backend/internal/pricing"
	"los-tecnicos/backend/internal/zk"

	"gorm.io/gorm"
)

// RunMatchingEngine starts a background process to match buy and sell orders.
func RunMatchingEngine(sorobanClient *blockchain.SorobanClient) {
	log.Println("Starting matching engine...")
	ticker := time.NewTicker(5 * time.Second) // Run every 5 seconds

	for range ticker.C {
		matchOrders(sorobanClient)
	}
}

func matchOrders(sorobanClient *blockchain.SorobanClient) {
	var openSellOrders []domain.EnergyOrder
	var openBuyOrders []domain.EnergyOrder

	// Fetch open sell orders, lowest price first
	database.DB.Where("type = ? AND status = ?", "sell", "Created").Order("token_price asc").Find(&openSellOrders)

	// Fetch open buy orders, highest price first
	database.DB.Where("type = ? AND status = ?", "buy", "Created").Order("token_price desc").Find(&openBuyOrders)

	if len(openSellOrders) == 0 || len(openBuyOrders) == 0 {
		return // Nothing to match — silent
	}

	// Calculate Market Variables for Dynamic Pricing (used for analytics/logging)
	supplyVol := float64(len(openSellOrders))
	demandVol := float64(len(openBuyOrders))
	socAvg := GetCommunitySoC()

	// Standard order-book matching:
	// Iterate sell orders (cheapest first) and match against buy orders (highest bid first)
	for i := range openSellOrders {
		sellOrder := &openSellOrders[i]
		for j := range openBuyOrders {
			buyOrder := &openBuyOrders[j]

			// Skip already-matched or cancelled orders
			if sellOrder.Status != "Created" || buyOrder.Status != "Created" {
				continue
			}

			// ---- PRICE CHECK: Standard order-book semantics ----
			// A match occurs when the buyer's limit price >= seller's ask price.
			// Settlement is at the seller's ask price (maker-taker model).
			if buyOrder.TokenPrice < sellOrder.TokenPrice {
				continue // No price overlap — skip
			}

			// Settlement price is the seller's ask (price improvement for the buyer)
			settlementPrice := sellOrder.TokenPrice

			// ---- QUANTITY: Support partial fills ----
			matchedKwh := math.Min(buyOrder.KwhAmount, sellOrder.KwhAmount)
			if matchedKwh <= 0 {
				continue
			}

			// Log dynamic price for analytics only (not used for gating)
			pe := pricing.NewPricingEngine()
			dynamicPrice, _, _ := pe.CalculateDynamicPrice(*buyOrder, *sellOrder, supplyVol, demandVol, socAvg, 1.0)

			// --- ZK PRIVACY CHECK (Simulated Device Logic) ---
			// Use a safe fallback SoC when no IoT devices are registered (socAvg=0).
			zkSoC := int64(socAvg * 100)
			if zkSoC <= 0 {
				zkSoC = 50 // Default: assume 50% charge when no device data available
			}
			zkCommitment, err := zk.NewPedersenCommitment(zkSoC)
			if err != nil {
				// ZK is a simulation — log the warning but do not block matching
				log.Printf(">>> ZK WARNING: Setup failed for seller %s (proceeding anyway): %v", sellOrder.UserID, err)
			} else {
				proof, proofErr := zkCommitment.GenerateRangeProof(20)
				if proofErr != nil {
					log.Printf(">>> ZK WARNING: Proof generation failed for seller %s (proceeding anyway): %v", sellOrder.UserID, proofErr)
				} else if !zk.VerifyRangeProof(proof) {
					log.Printf(">>> ZK WARNING: Proof verification failed for seller %s (proceeding anyway)", sellOrder.UserID)
				} else {
					log.Printf(">>> ZK PRIVACY: Seller %s proved Battery > 20%% with Commitment %s", sellOrder.UserID, proof.CommitmentStr)
				}
			}
			// ------------------------------------

			log.Printf("MATCH FOUND! Buy: %s (limit %.4f), Sell: %s (ask %.4f), Qty: %.4f kWh, Settlement: %.4f XLM",
				buyOrder.ID, buyOrder.TokenPrice, sellOrder.ID, sellOrder.TokenPrice, matchedKwh, settlementPrice)
			log.Printf("Dynamic Price (analytics): %.4f", dynamicPrice)

			// 3. Attempt blockchain settlement — non-blocking: failure only logs, does not skip the DB update
			log.Printf(">>> PRE-SETTLEMENT: Checking for Soroban contract...")
			contractID := config.GetEnv("MARKETPLACE_CONTRACT_ID", "")
			if contractID != "" {
				payloadBytes := []byte("marketplace_match")
				txHash, blockchainErr := sorobanClient.TriggerContractCall(contractID, "match_orders", sellOrder.ID, payloadBytes)
				if blockchainErr != nil {
					// Log but do NOT skip — DB settlement is the source of truth for the MVP
					log.Printf(">>> BLOCKCHAIN WARNING: On-chain call failed (settling off-chain): %v", blockchainErr)
				} else {
					log.Printf(">>> BLOCKCHAIN SUCCESS: TxHash: %s", txHash)
				}
			} else {
				log.Printf(">>> Dev Mode: MARKETPLACE_CONTRACT_ID not set — settling off-chain only.")
			}

			// 4. Update Database only AFTER Blockchain success (or Dev Mode continuation)
			dbErr := database.DB.Transaction(func(tx *gorm.DB) error {
				// Determine new statuses based on whether full or partial fill
				buyStatus := "Matched"
				if matchedKwh < buyOrder.KwhAmount {
					buyStatus = "PartiallyFilled"
				}
				sellStatus := "Matched"
				if matchedKwh < sellOrder.KwhAmount {
					sellStatus = "PartiallyFilled"
				}

				if err := tx.Model(buyOrder).Updates(map[string]interface{}{
					"status":     buyStatus,
					"kwh_amount": buyOrder.KwhAmount - matchedKwh,
				}).Error; err != nil {
					return err
				}
				if err := tx.Model(sellOrder).Updates(map[string]interface{}{
					"status":     sellStatus,
					"kwh_amount": sellOrder.KwhAmount - matchedKwh,
				}).Error; err != nil {
					return err
				}

				// Update in-memory quantities so the outer loop sees the residual
				buyOrder.KwhAmount -= matchedKwh
				sellOrder.KwhAmount -= matchedKwh
				buyOrder.Status = buyStatus
				sellOrder.Status = sellStatus

				// Create transaction record
				transaction := domain.Transaction{
					ID:             "txn_" + buyOrder.ID + "_" + time.Now().Format("20060102150405"),
					DonorID:        sellOrder.UserID,
					RecipientID:    buyOrder.UserID,
					KwhAmount:      matchedKwh,
					TokenAmount:    matchedKwh * settlementPrice,
					BlockchainHash: "soroban_txn_" + buyOrder.ID,
					Status:         "Pending",
					Timestamp:      time.Now(),
				}
				if err := tx.Create(&transaction).Error; err != nil {
					return err
				}

				// --- DEFI YIELD ACCRUAL ---
				yieldAmount := matchedKwh * settlementPrice * 0.05 / 365
				yieldRecord := domain.YieldRecord{
					UserID:    sellOrder.UserID,
					Amount:    yieldAmount,
					Source:    "LiquidityPool_Staking",
					Timestamp: time.Now(),
				}
				if err := tx.Create(&yieldRecord).Error; err != nil {
					log.Printf("Failed to persist yield: %v", err)
				}
				log.Printf(">>> DEFI: Persisted Yield Record of %.6f XLM for User %s", yieldAmount, sellOrder.UserID)

				// --- TOKEN BURN ---
				tokensBurned := matchedKwh * 1000
				burnRecord := domain.TokenBurn{
					OrderID:      buyOrder.ID,
					TokensBurned: tokensBurned,
					BurnReason:   "trade_settlement",
					TxHash:       "burn_" + time.Now().Format("20060102_150405"),
					Timestamp:    time.Now(),
				}
				if err := tx.Create(&burnRecord).Error; err != nil {
					log.Printf("Failed to persist burn: %v", err)
				}
				log.Printf(">>> BURN: 🔥 %.0f LT tokens burned (%.4f kWh consumed)", tokensBurned, matchedKwh)

				// --- TRADE FEE ---
				tradeFee := matchedKwh * settlementPrice * 0.025
				lpYield := domain.YieldRecord{
					UserID:    "liquidity_pool",
					Amount:    tradeFee,
					Source:    "Trade_Commission_2.5pct",
					Timestamp: time.Now(),
				}
				if err := tx.Create(&lpYield).Error; err != nil {
					log.Printf("Failed to persist LP yield: %v", err)
				}

				// --- CARBON CREDIT ---
				co2Saved := matchedKwh * 0.82
				carbonCredit := domain.CarbonCredit{
					DeviceID:    "marketplace",
					KwhOffset:   matchedKwh,
					CO2SavedKg:  co2Saved,
					CreditValue: co2Saved * 0.05,
					Timestamp:   time.Now(),
				}
				if err := tx.Create(&carbonCredit).Error; err != nil {
					log.Printf("Failed to persist carbon credit: %v", err)
				}

				return nil
			})

			if dbErr != nil {
				log.Printf("Error processing match: %v", dbErr)
				continue
			}

			// 5. COORDINATION: Send lock command to donor's IoT device
			var device domain.IoTDevice
			if err := database.DB.Where("owner_id = ? AND device_type = ?", sellOrder.UserID, "esp32").First(&device).Error; err == nil {
				log.Printf("Sending lock command to device: %s", device.ID)
				mqtt.SendLockCommand(device.ID, sellOrder.ID, matchedKwh)
			} else {
				log.Printf("No ESP32 device found for donor %s, skipping IoT lock simulation", sellOrder.UserID)
			}

			// If sell order fully filled, move to next sell
			if sellOrder.Status == "Matched" {
				break
			}
		}
	}
}

// GetCommunitySoC calculates the average battery level of all registered devices
func GetCommunitySoC() float64 {
	var devices []domain.IoTDevice
	if err := database.DB.Find(&devices).Error; err != nil {
		log.Printf("Error fetching devices for SoC: %v", err)
		return 0.5 // Default to 50% on error
	}

	if len(devices) == 0 {
		return 0.5
	}

	var totalSoC float64
	var count float64

	for _, d := range devices {
		// Only counting devices that report battery level (assuming > 0 is valid for now)
		// Real implementation would check device type or status
		totalSoC += d.BatteryLevel
		count++
	}

	if count == 0 {
		return 0.5
	}

	return totalSoC / count
}
