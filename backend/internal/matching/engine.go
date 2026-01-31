package matching

import (
	"log"
	"time"

	"los-tecnicos/backend/internal/blockchain"
	"los-tecnicos/backend/internal/core/domain"
	"los-tecnicos/backend/internal/database"
	"los-tecnicos/backend/internal/mqtt"
	"los-tecnicos/backend/internal/pricing"

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
		return // Nothing to match
	}

	// Calculate Market Variables for Dynamic Pricing
	supplyVol := float64(len(openSellOrders))
	demandVol := float64(len(openBuyOrders))
	socAvg := GetCommunitySoC()

	log.Printf("Market State: Supply=%f, Demand=%f, SoC_avg=%f", supplyVol, demandVol, socAvg)

	// Simple matching logic: Iterate through sell orders and find a matching buy order
	for _, sellOrder := range openSellOrders {
		for _, buyOrder := range openBuyOrders {
			// Check if orders are still available (not matched in this same loop)
			if sellOrder.Status != "Created" || buyOrder.Status != "Created" {
				continue
			}

			// Calculate Dynamic Price
			// For distance, we'd need user locations. For now assuming distance = 1 (neighbor).
			// Base price is the Seller's asking price.
			pe := pricing.NewPricingEngine()
			dynamicPrice, _, err := pe.CalculateDynamicPrice(buyOrder, sellOrder, supplyVol, demandVol, socAvg, 1.0)
			if err != nil {
				log.Printf("Error calculating price: %v", err)
				continue
			}

			// Price condition: buyer is willing to pay at least the dynamic price (or the seller's price if calc fails)
			// We effectively use the dynamic price as the settlement price.
			// However, if dynamic price > buyer's limit, the trade might not happen unless we treat buy limit as soft?
			// For this MVP, let's say if Dynamic Price <= Buyer's Limit, we execute AT Dynamic Price.
			if buyOrder.TokenPrice >= dynamicPrice {
				// Quantity condition: for simplicity, we match the exact amount for now
				if buyOrder.KwhAmount == sellOrder.KwhAmount {
					log.Printf("Match found! Buy: %s, Sell: %s", buyOrder.ID, sellOrder.ID)
					log.Printf("Settlement Price: %f (Dynamic) vs %f (Ask)", dynamicPrice, sellOrder.TokenPrice)

					err := database.DB.Transaction(func(tx *gorm.DB) error {
						// Update orders
						if err := tx.Model(&buyOrder).Update("status", "Matched").Error; err != nil {
							return err
						}
						if err := tx.Model(&sellOrder).Update("status", "Matched").Error; err != nil {
							return err
						}

						// Create transaction record
						transaction := domain.Transaction{
							ID:             "txn_" + buyOrder.ID, // Simple TXN id for now
							DonorID:        sellOrder.UserID,
							RecipientID:    buyOrder.UserID,
							KwhAmount:      buyOrder.KwhAmount,
							TokenAmount:    buyOrder.KwhAmount * dynamicPrice, // Trade happens at DYNAMIC price
							BlockchainHash: "pending_" + "txn_" + buyOrder.ID,
							Status:         "Pending",
							Timestamp:      time.Now(),
						}
						if err := tx.Create(&transaction).Error; err != nil {
							return err
						}
						return nil
					})

					if err != nil {
						log.Printf("Error processing match: %v", err)
						continue
					}

					// 4. COORDINATION: Send lock command to donor's IoT device
					var device domain.IoTDevice
					if err := database.DB.Where("owner_id = ? AND device_type = ?", sellOrder.UserID, "esp32").First(&device).Error; err == nil {
						log.Printf("Sending lock command to device: %s", device.ID)
						mqtt.SendLockCommand(device.ID, sellOrder.ID, sellOrder.KwhAmount)
					} else {
						log.Printf("No ESP32 device found for donor %s, skipping IoT lock simulation", sellOrder.UserID)
					}

					// Trigger blockchain execution (asynchronously)
					// Note: Real Soroban implementation would need to authorize this specific amount.
					go sorobanClient.HandleTradeExecution(buyOrder)

					// Break inner loop to move to next sell order
					break
				}
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
