---
id: business-flow
title: Business Flow
sidebar_label: Business Flow
---

# Business Flow

A complete walkthrough of the Stelltron business model — from solar production to settled trade to revenue distribution.

---

## The Core Transaction

```plantuml
@startuml
!theme plain
skinparam actorStyle awesome

title A Real P2P Energy Trade

actor "Sarah\n(Solar Donor)" as SARAH
actor "Mike\n(Energy Buyer)" as MIKE
participant "Stelltron\nMarketplace" as MKT
participant "Stellar\nBlockchain" as SC
actor "Utility Grid" as UTIL

SARAH -> SARAH : Solar panels generate 8 kWh/hour
SARAH -> MKT : Lists 5 kWh @ 10 XLM/kWh
note right: App auto-lists on each mint

MIKE -> MKT : Places buy order, 5 kWh @ 11 XLM/kWh
MKT -> MKT : Matching engine finds compatible pair\nDynamic price = 10 XLM (settlement price)

MKT -> SC : Execute trade on Soroban\nTokens transfer: SARAH → MIKE\nXLM transfer: MIKE → SARAH

SC --> SARAH : 50 XLM (5 × 10)
SC --> MIKE : 5 LT tokens (redeemable for 5 kWh)
MKT -> MKT : Burn 5000 LT tokens after delivery\nRecord 4.1 kg CO₂ saved

note over SARAH, MIKE
  What utility would have paid Sarah:  $0.50 (at 2¢/kWh)
  What utility would have charged Mike: $7.50 (at 28¢/kWh)
  
  With Stelltron:
  Sarah receives: 50 XLM ≈ $5.00  (1,000% more)
  Mike pays:      50 XLM ≈ $5.00  (33% less)
end note

@enduml
```

---

## Market Participants

| Role | What they do | How they earn |
|------|-------------|---------------|
| **Donor (Solar Owner)** | Sell excess solar energy | Revenue from energy sales + seller staking yield |
| **Recipient (Energy Buyer)** | Buy solar energy at below-grid prices | Savings vs utility rates |
| **NetworkNodeOperator (Pi Operator)** | Run Raspberry Pi relay nodes | DePIN rewards (10 LT/day + routing rewards) |
| **LP Staker** | Stake LT tokens in liquidity pool | 8.5% APY + 2.5% trade commissions |
| **Flash Borrower** | Borrow tokens for peak-demand arbitrage | Arbitrage profit minus 0.3% fee |
| **Community (Governance)** | Vote on pricing parameters | Better market conditions |

---

## Revenue Model

```plantuml
@startuml
!theme plain

title Revenue Distribution

rectangle "Energy Trade" as TRADE {
  (10 XLM settlement\n0.5 kWh trade) as VAL
}

rectangle "Revenue Flows" {
  (LP Stakers\n2.5% commission\n= 0.25 XLM) as LPS
  (Seller Yield\n5% APY daily accrual\n= 0.00137 XLM) as SY
  (Carbon Credit\n0.41 kg CO₂\n= 0.0205 XLM) as CC
  (Token Burn\n500 LT destroyed) as BURN
}

VAL --> LPS
VAL --> SY
VAL --> CC
VAL --> BURN

@enduml
```

---

## Business Flow Diagram

```plantuml
@startuml
!theme plain

title Stelltron Business Flow — End to End

|Physical World|
start
:Solar panels generate energy;
:ESP32 monitors voltage & current;
:Raspberry Pi measures kWh transferred;

|IoT Layer|
:Pi sends POST /iot/energy/report;
:Backend calculates quality factor from voltage;
:TokensMinted = kWh × 1000 × QF;

|Blockchain Layer|
:energy_token.mint(donor_wallet, tokens);
:Tokens appear in donor's wallet;

|Marketplace|
:Auto-create sell order at dynamic price;
:Donor optionally adjusts listing price;
:Buyer places buy order;

|Matching Engine|
:Price calculated (6-factor formula);
:ZK proof: seller battery > 20%?;
if (proof valid AND prices compatible) then (yes)
  :Execute trade at dynamic price;
  :Burn tokens (kWh × 1000);
  :Record carbon credit;
  :2.5% fee → LP stakers;
  :5% APY yield → seller;
else (no)
  :Skip — wait next cycle;
endif

|Settlement|
:Soroban: energy_token.transfer();
:Update transaction status → Completed;
:SSE broadcast to frontends;

|Sustainability|
:CO₂ offset recorded;
:DePIN uptime rewards issued;
:Governance: community votes on params;

stop

@enduml
```

---

## Token Economics at Scale

```plantuml
@startuml
!theme plain

title Token Supply Equilibrium

rectangle "Daily Inflow" {
  (100 trades\n× 0.5 kWh\n× 1000 LT/kWh\n= 50,000 LT minted) as MINT
}

rectangle "Daily Outflow" {
  (100 trades consumed\n= 50,000 LT burned) as BURN
  (DePIN rewards:\n~100 LT/day) as DEPIN
}

rectangle "Circulating Supply" as CS

MINT --> CS : +50,000 LT
BURN --> CS : -50,000 LT
DEPIN --> CS : small inflation pressure

note right of CS
  Net supply change ≈ 0
  DePIN rewards create mild 
  inflation, offset by fee burns
  
  Slightly deflationary at
  high trading volumes
end note

@enduml
```

---

## Payback Period Impact

The core economic value proposition:

| Metric | Without Stelltron | With Stelltron |
|--------|-------------------|----------------|
| Utility buys excess solar at | $0.02/kWh | — |
| Peer buyer pays | — | $0.10/kWh (50% below peak grid) |
| Solar owner receives | $0.02/kWh | $0.10/kWh (5× more) |
| Energy buyer pays | $0.28/kWh (peak) | ~$0.10/kWh (64% savings) |
| Solar panel ROI | 18 years | ~8 years |

---

## Roadmap

```plantuml
@startuml
!theme plain

timeline
  title Stelltron Roadmap

  section Now (MVP)
    Testnet deployment : 4 smart contracts live
    P2P marketplace : Order matching operational
    Real IoT hardware : Raspberry Pi + ESP32 integration
    Dynamic pricing : 6-factor model running
    ZK proofs : Battery privacy protection
    DeFi basics : LP staking + flash loans

  section Month 1–2
    Order types : Partial fills, limit/market/stop orders
    Mobile app : iOS and Android
    Better UX : Smoother onboarding

  section Month 3–6
    Hardware pilot : 10 real households in one neighborhood
    Mainnet : Move from testnet to Stellar mainnet
    Real kWh trading : Regulatory sandbox application

  section Month 6–12
    DeFi expansion : Liquidity pools, yield farming, savings accounts
    Scale : 1,000 households across 3 cities
    Stablecoin : USDC integration for fiat-equivalent pricing

  section Year 2–3
    International : India, Kenya, Philippines expansion
    Partnerships : Solar installers, battery manufacturers
    Regulatory : Full energy trading licenses

  section 2030 Goal
    Impact : 100 million households
    CO2 : 500 million tons CO2 offset

@enduml
```
