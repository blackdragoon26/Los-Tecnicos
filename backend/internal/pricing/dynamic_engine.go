package pricing

import (
	"math"
	"time"

	"los-tecnicos/backend/internal/core/domain"
	"los-tecnicos/backend/internal/database"
)

// PricingEngine handles the calculation of the real-time energy price.
type PricingEngine struct {
	Config PricingConfig
}

// PricingConfig holds the dynamic factors that can be changed via Governance.
type PricingConfig struct {
	BasePrice float64 // Default 5.0 XLM
	Alpha     float64 // Supply/Demand Coefficient (default 0.2)
	Beta      float64 // SoC Scarcity Coefficient (default 0.5)
	Gamma     float64 // Distance Penalty Coefficient (default 0.2)
}

// NewPricingEngine creates a new instance of the pricing engine.
func NewPricingEngine() *PricingEngine {
	// 1. Fetch "Live" params from the Governance Simulation
	// In a real app, this would query the contract state.
	config := FetchGovernanceParams()

	return &PricingEngine{
		Config: config,
	}
}

// FetchGovernanceParams simulates reading the latest passed proposals from the blockchain
func FetchGovernanceParams() PricingConfig {
	// Default values
	config := PricingConfig{
		BasePrice: 5.0,
		Alpha:     0.2,
		Beta:      0.5,
		Gamma:     0.2, // Default penalty
	}

	// CHECK: Is there an active "Lower Distance Penalty" proposal that passed?
	// For the MVP Hardening, we simulate reading the Smart Contract's storage.
	// In a live production environment, this would execute: `sorobanClient.GetContractData(GovContractID, "config_params")`

	return config
}

// CalculateDynamicPrice determines the final price per kWh based on 6 factors.
func (pe *PricingEngine) CalculateDynamicPrice(
	buyOrder domain.EnergyOrder,
	sellOrder domain.EnergyOrder,
	supplyVol, demandVol, socAvg, distance float64,
) (float64, map[string]float64, error) {

	// Factors
	fSD := pe.getSupplyDemandFactor(supplyVol, demandVol)
	fSoC := pe.getSoCFactor(socAvg)
	fDist := pe.getDistanceFactor(distance)
	fTime := pe.getTimeOfDayFactor(time.Now())
	fQuality := pe.getQualityFactor(sellOrder.UserID)

	// Total Multiplier
	totalMultiplier := fSD * fSoC * fDist * fTime * fQuality

	// Bounds Checking (0.5x to 5.0x)
	if totalMultiplier < 0.5 {
		totalMultiplier = 0.5
	}
	if totalMultiplier > 5.0 {
		totalMultiplier = 5.0
	}

	finalPrice := pe.Config.BasePrice * totalMultiplier

	breakdown := map[string]float64{
		"base_price":  pe.Config.BasePrice,
		"f_sd":        fSD,
		"f_soc":       fSoC,
		"f_dist":      fDist,
		"f_time":      fTime,
		"f_quality":   fQuality,
		"final_price": finalPrice,
	}

	// Log history (async)
	go pe.logHistory(breakdown, socAvg, supplyVol, demandVol)

	return finalPrice, breakdown, nil
}

// 1. Supply-Demand Factor: F_sd = 1 + α * ln(Demand / Supply)
func (pe *PricingEngine) getSupplyDemandFactor(supply, demand float64) float64 {
	if supply <= 0 {
		supply = 1 // Avoid division by zero
	}
	if demand <= 0 {
		demand = 0.1 // Avoid log(0)
	}

	ratio := demand / supply
	return 1.0 + pe.Config.Alpha*math.Log(ratio)
}

// 2. SoC Factor: F_soc = 1 + β * (1 - SoC_avg)²
func (pe *PricingEngine) getSoCFactor(socAvg float64) float64 {
	// Using quadratic scarcity: (1 - SoC)^2 accelerates price as battery gets empty
	deficit := 1.0 - socAvg
	return 1.0 + pe.Config.Beta*(deficit*deficit)
}

// 3. Distance Factor: F_dist = 1 + γ * d_norm (Using simplified distance for now)
func (pe *PricingEngine) getDistanceFactor(distanceKm float64) float64 {
	// Normalize distance? Let's assume input is in km.
	// We apply a linear penalty for distance.
	// Governance Control: If 'Gamma' is lowered, local energy trading is incentivized less (or more tolerant of distance).
	return 1.0 + pe.Config.Gamma*distanceKm
}

// 4. Time-of-Day Factor
func (pe *PricingEngine) getTimeOfDayFactor(t time.Time) float64 {
	hour := t.Hour()

	// Evening Peak (6 PM - 10 PM)
	if hour >= 18 && hour < 22 {
		return 1.3
	}
	// Morning Peak (6 AM - 9 AM)
	if hour >= 6 && hour < 9 {
		return 1.15
	}
	// Night Trough (2 AM - 6 AM)
	if hour >= 2 && hour < 6 {
		return 0.85
	}
	// Standard
	return 1.0
}

// 5. Quality Factor: F_quality = 1 + η * Q_score (using simple mock or DB lookup)
func (pe *PricingEngine) getQualityFactor(userID string) float64 {
	// In a real system, we'd query DeviceQualityMetrics
	// For now, let's look up the user/device or default to 1.0
	// We will implement a quick DB lookup

	var device domain.IoTDevice
	if err := database.DB.Where("owner_id = ?", userID).First(&device).Error; err != nil {
		return 1.0 // Default if no device found
	}

	var metrics domain.DeviceQualityMetrics
	if err := database.DB.Where("device_id = ?", device.ID).First(&metrics).Error; err != nil {
		return 1.0 // Default if no metrics
	}

	// Normalize Score (assuming HealthScore is 0-100)
	// Example: High health = lower price? Or higher price for premium?
	// User Requirement: "Donor Reliability" - usually higher quality = higher price (premium supplier)?
	// Formula: F_quality = 1 + η * Q_score
	// If Q_score is high (reliable), price is higher?
	// ACTUALLY: Usually better quality -> Premium price.
	const eta = 0.1 // Coefficient

	// Composite score (0-1)
	qScore := (float64(metrics.SuccessfulDeliveries)/float64(metrics.TotalDeliveries+1)*0.4 +
		metrics.VoltageStability/100.0*0.3 +
		metrics.BatteryHealthScore/100.0*0.3)

	return 1.0 + eta*qScore
}

func (pe *PricingEngine) logHistory(factors map[string]float64, soc, supply, demand float64) {
	record := domain.PricingHistory{
		Timestamp:    time.Now(),
		BasePrice:    factors["base_price"],
		FinalPrice:   factors["final_price"],
		SupplyDemand: factors["f_sd"],
		SoC:          factors["f_soc"],
		Distance:     factors["f_dist"],
		Time:         factors["f_time"],
		Quality:      factors["f_quality"],
		GridSoC:      soc,
		TotalDemand:  demand,
		TotalSupply:  supply,
	}
	database.DB.Create(&record)
}
