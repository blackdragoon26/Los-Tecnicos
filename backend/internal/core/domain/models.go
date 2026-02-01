package domain

import (
	"time"
)

// User represents a user in the system.
type User struct {
	ID                    string    `json:"id"`
	WalletAddress         string    `json:"wallet_address" gorm:"unique;not null"`
	Role                  string    `json:"role" gorm:"not null"` // e.g., Donor, Recipient, NetworkNodeOperator
	Location              string    `json:"location"`
	CreatedAt             time.Time `json:"created_at"`
	KYCStatus             string    `json:"kyc_status" gorm:"default:'pending'"`
	RefreshToken          string    `json:"-" gorm:"index"` // The token is sensitive, don't expose in JSON
	RefreshTokenExpiresAt time.Time `json:"-"`
}

// EnergyOrder represents a buy or sell order in the marketplace.
type EnergyOrder struct {
	ID         string    `json:"id"`
	UserID     string    `json:"user_id" gorm:"not null"`
	Type       string    `json:"type" gorm:"not null"` // "buy" or "sell"
	KwhAmount  float64   `json:"kwh_amount" gorm:"not null"`
	TokenPrice float64   `json:"token_price" gorm:"not null"`
	Status     string    `json:"status" gorm:"not null"` // e.g., Created, Matched, Executing, Completed, Cancelled
	CreatedAt  time.Time `json:"created_at"`
}

// IoTDevice represents a registered IoT device (ESP32 or Raspberry Pi).
type IoTDevice struct {
	ID           string    `json:"id"`
	OwnerID      string    `json:"owner_id" gorm:"not null"`
	DeviceType   string    `json:"device_type" gorm:"not null"` // "esp32" or "raspi"
	Location     string    `json:"location"`
	BatteryLevel float64   `json:"battery_level"` // 0.0 to 1.0 (State of Charge)
	LastPing     time.Time `json:"last_ping"`
	Status       string    `json:"status" gorm:"not null"` // e.g., Online, Offline, Unregistered
}

// Transaction represents a completed energy trade.
type Transaction struct {
	ID             string    `json:"id"`
	DonorID        string    `json:"donor_id" gorm:"not null"`
	RecipientID    string    `json:"recipient_id" gorm:"not null"`
	KwhAmount      float64   `json:"kwh_amount" gorm:"not null"`
	TokenAmount    float64   `json:"token_amount" gorm:"not null"`
	BlockchainHash string    `json:"blockchain_hash" gorm:"unique"`
	Status         string    `json:"status" gorm:"not null"` // e.g., Pending, Confirmed, Failed
	Timestamp      time.Time `json:"timestamp"`
}

// NetworkNode represents a Raspberry Pi node in the mesh network.
type NetworkNode struct {
	ID            string  `json:"id"`
	OperatorID    string  `json:"operator_id" gorm:"not null"`
	Location      string  `json:"location"`
	Uptime        int64   `json:"uptime"` // in seconds
	PacketsRouted int64   `json:"packets_routed"`
	Earnings      float64 `json:"earnings"`
}

// DeviceQualityMetrics stores historical performance data for a donor's device.
type DeviceQualityMetrics struct {
	ID                   uint      `json:"id" gorm:"primaryKey"`
	DeviceID             string    `json:"device_id" gorm:"unique;not null"`
	SuccessfulDeliveries int       `json:"successful_deliveries"`
	TotalDeliveries      int       `json:"total_deliveries"`
	VoltageStability     float64   `json:"voltage_stability"`    // Standard deviation or score (0-100)
	BatteryHealthScore   float64   `json:"battery_health_score"` // 0-100
	LastUpdated          time.Time `json:"last_updated"`
}

// PricingHistory logs the detailed breakdown of every price calculation.
type PricingHistory struct {
	ID           uint      `json:"id" gorm:"primaryKey"`
	Timestamp    time.Time `json:"timestamp" gorm:"index"`
	BasePrice    float64   `json:"base_price"`
	FinalPrice   float64   `json:"final_price"`
	SupplyDemand float64   `json:"f_sd"`
	SoC          float64   `json:"f_soc"`
	Distance     float64   `json:"f_dist"`
	Time         float64   `json:"f_time"`
	Quality      float64   `json:"f_quality"`
	GridSoC      float64   `json:"grid_soc"`
	TotalDemand  float64   `json:"total_demand"`
	TotalSupply  float64   `json:"total_supply"`
}

// YieldRecord tracks the simulated DeFi yield earned by users.
type YieldRecord struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"user_id" gorm:"index"`
	Amount    float64   `json:"amount"` // in XLM
	Source    string    `json:"source"` // e.g. "LiquidityPool_Staking"
	Timestamp time.Time `json:"timestamp"`
}
