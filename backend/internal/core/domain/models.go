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
	BatteryLevel float64   `json:"battery_level"` // 0.0 to 1.0 (State of Charge), normalized from Pi's 0-100
	LastPing     time.Time `json:"last_ping"`
	Status       string    `json:"status" gorm:"not null"` // e.g., online, offline
	State        string    `json:"state"`                  // IDLE, CHARGING, FAULT, etc. from real Pi
	Source       string    `json:"source"`                 // e.g., "rpi_energy_grid"
}

// NodeDetail stores per-node telemetry from the Raspberry Pi mesh network.
type NodeDetail struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	DeviceID  string    `json:"device_id" gorm:"index;not null"` // FK to IoTDevice.ID (the Pi that reported this)
	UID       string    `json:"uid" gorm:"not null"`             // NODE_A, NODE_B, etc.
	IP        string    `json:"ip"`
	Voltage   float64   `json:"voltage"`
	SoC       float64   `json:"soc"`   // 0-100 raw percentage
	State     string    `json:"state"` // IDLE, FAULT, etc.
	UpdatedAt time.Time `json:"updated_at"`
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

// ScheduleCommand stores the latest action assigned to each node by the scheduler.
type ScheduleCommand struct {
	ID       uint      `json:"id" gorm:"primaryKey"`
	DeviceID string    `json:"device_id" gorm:"index;not null"`
	NodeUID  string    `json:"node_uid" gorm:"not null"`
	Action   string    `json:"action" gorm:"not null"` // "charge", "supply", "idle"
	Reason   string    `json:"reason"`
	IssuedAt time.Time `json:"issued_at"`
}

// ScheduleLog is an append-only audit log of every scheduling decision for analytics.
type ScheduleLog struct {
	ID            uint      `json:"id" gorm:"primaryKey"`
	DeviceID      string    `json:"device_id" gorm:"index;not null"`
	NodeUID       string    `json:"node_uid" gorm:"not null"`
	Action        string    `json:"action" gorm:"not null"`
	SoCAtTime     float64   `json:"soc_at_time"`
	VoltageAtTime float64   `json:"voltage_at_time"`
	Reason        string    `json:"reason"`
	Timestamp     time.Time `json:"timestamp" gorm:"index"`
}

// ──────────────────────────────────────────────────────────────
// Energy Metering → Token Minting
// ──────────────────────────────────────────────────────────────

// EnergyMint records every minting event when a donor discharges energy.
type EnergyMint struct {
	ID              uint      `json:"id" gorm:"primaryKey"`
	DeviceID        string    `json:"device_id" gorm:"index;not null"`
	SenderUID       string    `json:"sender_uid" gorm:"not null"`
	ReceiverUID     string    `json:"receiver_uid" gorm:"not null"`
	KwhTransferred  float64   `json:"kwh_transferred" gorm:"not null"`
	TokensMinted    float64   `json:"tokens_minted" gorm:"not null"`
	QualityFactor   float64   `json:"quality_factor"`
	AvgVoltage      float64   `json:"avg_voltage"`
	AvgCurrent      float64   `json:"avg_current"`
	DurationSeconds float64   `json:"duration_seconds"`
	TxHash          string    `json:"tx_hash"`                                 // Soroban mint tx hash
	Status          string    `json:"status" gorm:"not null;default:'minted'"` // minted, listed, sold, burned
	Timestamp       time.Time `json:"timestamp" gorm:"index"`
}

// TokenBurn records every burn event when energy tokens are consumed.
type TokenBurn struct {
	ID           uint      `json:"id" gorm:"primaryKey"`
	MintID       uint      `json:"mint_id" gorm:"index"`  // FK to EnergyMint
	OrderID      string    `json:"order_id" gorm:"index"` // FK to EnergyOrder that was matched
	TokensBurned float64   `json:"tokens_burned" gorm:"not null"`
	BurnReason   string    `json:"burn_reason" gorm:"not null"` // "trade_settlement", "expiry", "manual"
	TxHash       string    `json:"tx_hash"`                     // Soroban burn tx hash
	Timestamp    time.Time `json:"timestamp" gorm:"index"`
}

// ──────────────────────────────────────────────────────────────
// DeFi: Liquidity Pool
// ──────────────────────────────────────────────────────────────

// LiquidityPool tracks user stakes in the energy liquidity pool.
type LiquidityPool struct {
	ID            uint      `json:"id" gorm:"primaryKey"`
	UserID        string    `json:"user_id" gorm:"index;not null"`
	AmountStaked  float64   `json:"amount_staked" gorm:"not null"`
	SharePercent  float64   `json:"share_percent"`
	APY           float64   `json:"apy"` // Current annualized yield
	YieldEarned   float64   `json:"yield_earned"`
	Status        string    `json:"status" gorm:"default:'active'"` // active, unstaking, withdrawn
	StakedAt      time.Time `json:"staked_at"`
	LastYieldCalc time.Time `json:"last_yield_calc"`
}

// ──────────────────────────────────────────────────────────────
// DeFi: Flash Energy Lending
// ──────────────────────────────────────────────────────────────

// FlashLoan records flash energy loans (borrow now, repay within epoch).
type FlashLoan struct {
	ID              uint       `json:"id" gorm:"primaryKey"`
	BorrowerID      string     `json:"borrower_id" gorm:"index;not null"`
	KwhBorrowed     float64    `json:"kwh_borrowed" gorm:"not null"`
	TokenCollateral float64    `json:"token_collateral"`
	InterestRate    float64    `json:"interest_rate"` // e.g. 0.3% per flash
	RepaymentDue    time.Time  `json:"repayment_due"`
	RepaidAt        *time.Time `json:"repaid_at"`
	Status          string     `json:"status" gorm:"default:'active'"` // active, repaid, liquidated
	CreatedAt       time.Time  `json:"created_at"`
}

// ──────────────────────────────────────────────────────────────
// Carbon Credits
// ──────────────────────────────────────────────────────────────

// CarbonCredit tracks CO₂ savings from peer-to-peer energy trading.
type CarbonCredit struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	DeviceID    string    `json:"device_id" gorm:"index;not null"`
	KwhOffset   float64   `json:"kwh_offset" gorm:"not null"`   // kWh traded P2P instead of grid
	CO2SavedKg  float64   `json:"co2_saved_kg" gorm:"not null"` // kWh × emission factor
	CreditValue float64   `json:"credit_value"`                 // Estimated value in XLM
	Timestamp   time.Time `json:"timestamp" gorm:"index"`
}

// ──────────────────────────────────────────────────────────────
// DePIN: Hardware Registry
// ──────────────────────────────────────────────────────────────

// DePINNode records on-chain registered physical hardware nodes.
type DePINNode struct {
	ID              uint      `json:"id" gorm:"primaryKey"`
	DeviceID        string    `json:"device_id" gorm:"uniqueIndex;not null"` // Maps to IoTDevice.ID
	OperatorWallet  string    `json:"operator_wallet" gorm:"index"`
	HardwareType    string    `json:"hardware_type"` // "rpi4b", "esp32", etc.
	FirmwareVersion string    `json:"firmware_version"`
	TotalKwhRouted  float64   `json:"total_kwh_routed"`
	TotalUptime     int64     `json:"total_uptime"` // seconds
	RewardsEarned   float64   `json:"rewards_earned"`
	ReliabilityPct  float64   `json:"reliability_pct"`  // 0-100 uptime percentage
	OnChainTxHash   string    `json:"on_chain_tx_hash"` // Soroban registration tx
	RegisteredAt    time.Time `json:"registered_at"`
	LastSeen        time.Time `json:"last_seen"`
}
