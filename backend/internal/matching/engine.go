package matching

import (
	"log"
	"time"

	"gorm.io/gorm"
	"los-tecnicos/backend/internal/blockchain"
	"los-tecnicos/backend/internal/core/domain"
	"los-tecnicos/backend/internal/database"
	"los-tecnicos/backend/internal/mqtt"
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

	// Simple matching logic: Iterate through sell orders and find a matching buy order
	for _, sellOrder := range openSellOrders {
		for _, buyOrder := range openBuyOrders {
			// Check if orders are still available (not matched in this same loop)
			if sellOrder.Status != "Created" || buyOrder.Status != "Created" {
				continue
			}

			// Price condition: buyer is willing to pay at least what the seller is asking
			if buyOrder.TokenPrice >= sellOrder.TokenPrice {
				// Quantity condition: for simplicity, we match the exact amount for now
				if buyOrder.KwhAmount == sellOrder.KwhAmount {
					log.Printf("Match found! Buy Order: %s, Sell Order: %s", buyOrder.ID, sellOrder.ID)
					
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
							ID:          "txn_" + buyOrder.ID, // Simple TXN id for now
							DonorID:     sellOrder.UserID,
							RecipientID: buyOrder.UserID,
							KwhAmount:   buyOrder.KwhAmount,
							TokenAmount: buyOrder.KwhAmount * sellOrder.TokenPrice, // Trade happens at seller's price
							Status:      "Pending",
							Timestamp:   time.Now(),
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
					go sorobanClient.HandleTradeExecution(buyOrder)
					
					// Break inner loop to move to next sell order
					break 
				}
			}
		}
	}
}
