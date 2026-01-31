package simulation

import (
	"log"
	"math/rand"
	"time"

	"los-tecnicos/backend/internal/core/domain"
	"los-tecnicos/backend/internal/database"
)

// SeedMockData populates the database with initial users and devices for the simulation.
func SeedMockData() {
	log.Println("Seeding mock data for simulation...")

	users := []domain.User{
		{ID: "user_a", WalletAddress: "G_DONOR_A_XYZ", Role: "Donor", Location: "28.6139,77.2090", CreatedAt: time.Now()},
		{ID: "user_b", WalletAddress: "G_RECIPIENT_B_123", Role: "Recipient", Location: "28.6200,77.2150", CreatedAt: time.Now()},
		{ID: "user_c", WalletAddress: "G_DONOR_C_FAR", Role: "Donor", Location: "28.7041,77.1025", CreatedAt: time.Now()},
	}

	for _, u := range users {
		database.DB.FirstOrCreate(&u, domain.User{ID: u.ID})
	}

	devices := []domain.IoTDevice{
		{ID: "esp32_a", OwnerID: "user_a", DeviceType: "esp32", Location: "28.6139,77.2090", BatteryLevel: 0.85, Status: "Online"},
		{ID: "esp32_c", OwnerID: "user_c", DeviceType: "esp32", Location: "28.7041,77.1025", BatteryLevel: 0.45, Status: "Online"},
		{ID: "raspi_node_1", OwnerID: "admin", DeviceType: "raspi", Location: "28.6150,77.2100", Status: "Online"},
	}

	for _, d := range devices {
		database.DB.FirstOrCreate(&d, domain.IoTDevice{ID: d.ID})
	}
}

// StartSimulation runs background loops to simulate hardware activity.
func StartSimulation() {
	log.Println("Starting hardware simulation loop...")

	// Ticker for battery fluctuation
	batteryTicker := time.NewTicker(10 * time.Second)

	go func() {
		for range batteryTicker.C {
			fluctuateBatteries()
		}
	}()
}

func fluctuateBatteries() {
	var devices []domain.IoTDevice
	database.DB.Where("device_type = ?", "esp32").Find(&devices)

	for _, d := range devices {
		// Simulate charging (daytime) or discharging (nighttime/usage)
		// For demo purposes, we just add/subtract a random small amount
		change := (rand.Float64() * 0.1) - 0.04 // Bias towards charging slightly
		newLevel := d.BatteryLevel + change

		if newLevel > 1.0 {
			newLevel = 1.0
		}
		if newLevel < 0.1 {
			newLevel = 0.1
		}

		database.DB.Model(&d).Update("battery_level", newLevel)
	}
	log.Println("[Simulation] Battery levels updated across community.")
}
