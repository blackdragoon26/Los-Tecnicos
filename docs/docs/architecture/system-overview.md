---
id: system-overview
title: System Architecture
sidebar_label: System Overview
---

# System Architecture

Stelltron is a full-stack application spanning physical hardware, an IoT communication layer, a Go backend, a Next.js frontend, and four Soroban smart contracts on Stellar. Every layer has a defined contract with the layers above and below it.

---

## High-Level Stack

| Layer | Technology | Role |
|-------|-----------|------|
| Hardware | ESP32, 18650 Li-ion, relays | Measure and route physical energy |
| IoT Protocol | HTTP (REST), Server-Sent Events | Transport telemetry to backend |
| Backend | Go, Gin, GORM, PostgreSQL, Redis | Business logic, matching, pricing |
| Blockchain | Stellar Soroban (Rust/WASM) | Token settlement, governance |
| Frontend | Next.js, React, TailwindCSS | User interface |
| Hosting | Render (backend), Vercel (frontend) | Cloud deployment |

---

## Full System Diagram

```plantuml
@startuml
!theme plain
skinparam backgroundColor #FAFAFA
skinparam componentStyle rectangle

title Stelltron — Full System Architecture

package "Physical Hardware" {
  [ESP32 Node] as ESP
  [18650 Battery] as BAT
  [Relay Circuit] as REL
  ESP --> BAT : reads voltage/SoC
  ESP --> REL : GPIO 25/26 control
}

package "Raspberry Pi (Edge Gateway)" {
  [energy_grid.py] as PY
  [TCP Socket Server] as TCP
  PY --> TCP : translates API commands
  TCP --> ESP : SUPPLY / RECEIVE / IDLE
}

package "Backend (Go)" {
  [IoT Handlers] as IOT
  [Scheduler] as SCH
  [Matching Engine] as ME
  [Pricing Engine] as PE
  [ZK Module] as ZK
  [DeFi Handlers] as DEFI
  [Blockchain Client] as BC
  [PostgreSQL] as DB
  [Redis] as RDS

  IOT --> SCH : \nPOST /iot/cmd
  ME --> PE : calculate price
  ME --> ZK : verify SoC proof
  ME --> BC : trigger Soroban mint/burn
  IOT --> DB : persist telemetry
  IOT --> RDS : rate limiting / cache
}

package "Stellar Blockchain" {
  [energy_token contract] as ET
  [marketplace contract] as MKT
  [governance contract] as GOV
  [network_incentives contract] as NI
}

package "Frontend (Next.js)" {
  [Marketplace] as FMK
  [Dashboard] as FDB
  [Governance] as FGO
  [Transparency Ledger] as FTR
  [IoT Console] as FIO
}

PY --> IOT : POST /iot/ping\nPOST /iot/cmd
IOT --> PY : commands in response body
BC --> ET : mint / burn / transfer
BC --> MKT : create_order / match_orders
FMK --> IOT : GET /api/v1/market/orders
FGO --> GOV : create_proposal / vote
FIO --> IOT : GET /iot/events (SSE)

@enduml
```

---

## Data Flow: End-to-End Energy Trade

```plantuml
@startuml
!theme plain
skinparam sequenceMessageAlign center

title End-to-End Energy Trade Flow

actor "Sarah (Donor)" as S
participant "ESP32 / Pi" as HW
participant "Backend API" as API
database "PostgreSQL" as DB
participant "Matching Engine" as ME
participant "ZK Module" as ZK
participant "Soroban" as SC
actor "Mike (Buyer)" as M

S -> HW : Solar panels generate energy
HW -> API : POST /iot/ping\n{device_id, battery_level, voltage, nodes_detail}
API -> DB : Upsert IoTDevice, NodeDetail, DeviceQualityMetrics
API -> HW : {commands: [{node_id, action}]}

HW -> API : POST /iot/energy/report\n{kwh_transferred, avg_voltage}
API -> API : QualityFactor = f(avg_voltage)\nTokens = kWh × 1000 × QF
API -> SC : energy_token.mint(sender, tokens)
API -> DB : INSERT EnergyMint, CarbonCredit
API -> DB : INSERT EnergyOrder (auto sell)

M -> API : POST /api/v1/market/order/create\n{type: "buy", kwh_amount, token_price}
API -> DB : INSERT EnergyOrder (buy)

ME -> ME : [every 5 seconds]\nfetch open sell + buy orders
ME -> ME : CalculateDynamicPrice()
ME -> ZK : NewPedersenCommitment(SoC × 100)
ZK --> ME : commitment
ME -> ZK : GenerateRangeProof(min=20)
ZK --> ME : proof
ME -> ZK : VerifyRangeProof(proof)
ZK --> ME : true / false

ME -> DB : UPDATE orders status = "Matched"
ME -> DB : INSERT Transaction, TokenBurn, YieldRecord, CarbonCredit
ME -> SC : energy_token.burn(tokens)
ME -> API : broadcast SSE event

API --> S : settlement notification
API --> M : settlement notification

@enduml
```

---

## Database Schema

```plantuml
@startuml
!theme plain
skinparam backgroundColor #FAFAFA

title Stelltron — PostgreSQL Schema

entity "users" {
  * id : VARCHAR (wallet address)
  --
  wallet_address : VARCHAR UNIQUE
  role : VARCHAR  /'Donor','Recipient','NetworkNodeOperator'/
  location : VARCHAR
  kyc_status : VARCHAR
  refresh_token : VARCHAR
  refresh_token_expires_at : TIMESTAMP
  created_at : TIMESTAMP
}

entity "energy_orders" {
  * id : VARCHAR (UUID)
  --
  user_id : VARCHAR FK
  type : VARCHAR  /'buy','sell'/
  kwh_amount : FLOAT
  token_price : FLOAT
  status : VARCHAR  /'Created','Matched','Completed','Cancelled'/
  created_at : TIMESTAMP
}

entity "transactions" {
  * id : VARCHAR
  --
  donor_id : VARCHAR FK
  recipient_id : VARCHAR FK
  kwh_amount : FLOAT
  token_amount : FLOAT
  blockchain_hash : VARCHAR UNIQUE
  status : VARCHAR
  timestamp : TIMESTAMP
}

entity "iot_devices" {
  * id : VARCHAR
  --
  owner_id : VARCHAR FK
  device_type : VARCHAR  /'raspi','esp32'/
  location : VARCHAR
  battery_level : FLOAT  /0.0 – 1.0/
  last_ping : TIMESTAMP
  status : VARCHAR  /'online','offline'/
  state : VARCHAR  /'IDLE','CHARGING','FAULT'/
  source : VARCHAR
}

entity "node_details" {
  * id : UINT
  --
  device_id : VARCHAR FK
  uid : VARCHAR  /'NODE_A','NODE_B'/
  ip : VARCHAR
  voltage : FLOAT
  soc : FLOAT  /0-100/
  state : VARCHAR
  updated_at : TIMESTAMP
}

entity "energy_mints" {
  * id : UINT
  --
  device_id : VARCHAR FK
  sender_uid : VARCHAR
  receiver_uid : VARCHAR
  kwh_transferred : FLOAT
  tokens_minted : FLOAT
  quality_factor : FLOAT
  avg_voltage : FLOAT
  duration_seconds : FLOAT
  tx_hash : VARCHAR
  status : VARCHAR
  timestamp : TIMESTAMP
}

entity "token_burns" {
  * id : UINT
  --
  mint_id : UINT FK
  order_id : VARCHAR FK
  tokens_burned : FLOAT
  burn_reason : VARCHAR
  tx_hash : VARCHAR
  timestamp : TIMESTAMP
}

entity "carbon_credits" {
  * id : UINT
  --
  device_id : VARCHAR FK
  kwh_offset : FLOAT
  co2_saved_kg : FLOAT
  credit_value : FLOAT
  timestamp : TIMESTAMP
}

entity "liquidity_pools" {
  * id : UINT
  --
  user_id : VARCHAR FK
  amount_staked : FLOAT
  share_percent : FLOAT
  apy : FLOAT
  yield_earned : FLOAT
  status : VARCHAR
  staked_at : TIMESTAMP
}

entity "flash_loans" {
  * id : UINT
  --
  borrower_id : VARCHAR FK
  kwh_borrowed : FLOAT
  token_collateral : FLOAT
  interest_rate : FLOAT
  repayment_due : TIMESTAMP
  repaid_at : TIMESTAMP
  status : VARCHAR
}

entity "depin_nodes" {
  * id : UINT
  --
  device_id : VARCHAR UNIQUE FK
  operator_wallet : VARCHAR
  hardware_type : VARCHAR
  total_kwh_routed : FLOAT
  total_uptime : INT
  rewards_earned : FLOAT
  reliability_pct : FLOAT
  on_chain_tx_hash : VARCHAR
  registered_at : TIMESTAMP
  last_seen : TIMESTAMP
}

entity "schedule_commands" {
  * id : UINT
  --
  device_id : VARCHAR
  node_uid : VARCHAR
  action : VARCHAR  /'charge','discharge','idle'/
  reason : VARCHAR
  issued_at : TIMESTAMP
}

entity "schedule_logs" {
  * id : UINT
  --
  device_id : VARCHAR
  node_uid : VARCHAR
  action : VARCHAR
  soc_at_time : FLOAT
  voltage_at_time : FLOAT
  reason : VARCHAR
  timestamp : TIMESTAMP
}

entity "pricing_history" {
  * id : UINT
  --
  timestamp : TIMESTAMP
  base_price : FLOAT
  final_price : FLOAT
  f_sd / f_soc / f_dist / f_time / f_quality : FLOAT
  grid_soc : FLOAT
  total_demand / total_supply : FLOAT
}

users ||--|{ energy_orders
users ||--|{ transactions
users ||--|{ iot_devices
iot_devices ||--|{ node_details
iot_devices ||--|{ energy_mints
energy_mints ||--|{ token_burns

@enduml
```

---

## Component Responsibilities

### Backend Package Structure

```
backend/
├── cmd/api/main.go              Entry point, wires all components
├── internal/
│   ├── config/                  Env var helpers
│   ├── cache/                   Redis client singleton
│   ├── database/                GORM PostgreSQL setup + AutoMigrate
│   ├── core/domain/models.go    All domain structs (17 models)
│   ├── handlers/                HTTP handlers (routes.go registers all 44 routes)
│   │   ├── handlers.go          Auth, market, devices, analytics
│   │   ├── iot_ping.go          IoT heartbeat + node data + SSE broker
│   │   ├── iot_cmd.go           Scheduling endpoint
│   │   ├── iot_transfer.go      Manual transfer commands
│   │   ├── energy_mint.go       Token minting from energy reports
│   │   ├── defi.go              LP staking, flash loans
│   │   ├── ledger.go            Transparency endpoints
│   │   ├── depin.go             DePIN node registry
│   │   ├── middleware.go        JWT auth middleware
│   │   └── requests.go          Request struct definitions
│   ├── matching/engine.go       Order matching loop (every 5s)
│   ├── pricing/dynamic_engine.go  Six-factor pricing model
│   ├── scheduling/scheduler.go  Grid SoC-based command scheduling
│   ├── zk/commitment.go         Pedersen commitments + range proofs
│   ├── blockchain/soroban.go    Soroban client wrapper
│   └── mqtt/client.go           MQTT command dispatch
```

### Authentication Flow

```plantuml
@startuml
!theme plain
title Wallet Authentication Flow

actor User as U
participant "Freighter Wallet" as FW
participant "Frontend" as FE
participant "Backend API" as API
database "PostgreSQL" as DB
database "Redis" as RDS

U -> FE : Click "Connect Wallet"
FE -> FW : Request signature
FW -> U : Prompt to sign "los-tecnicos-auth"
U -> FW : Approve
FW --> FE : {signature: base64}

FE -> API : POST /api/v1/auth/signup\n{wallet_address, signature}
API -> API : Parse wallet address as Ed25519 pubkey\nSHA256("Stellar Signed Message:\\n" + "los-tecnicos-auth")\nVerify signature against hash

alt New user
  API -> DB : INSERT users
  API --> FE : 201 {user}
else Existing user
  API --> FE : 200 {user}
end

FE -> API : POST /api/v1/auth/login\n{wallet_address, signature}
API -> RDS : GET user:{wallet_address}
alt Cache hit
  RDS --> API : cached user JSON
else Cache miss
  API -> DB : SELECT WHERE wallet_address = ?
end

API -> API : Generate JWT (15 min)\nGenerate refresh token (UUID, 7 days)
API -> DB : UPDATE user SET refresh_token = ?
API -> RDS : SET user:{wallet_address} TTL 1h

API --> FE : {access_token, refresh_token}
FE -> FE : Store tokens in-memory / localStorage

@enduml
```
