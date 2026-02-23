---
id: intro
title: Stelltron
sidebar_label: Overview
slug: /
---

# Stelltron

**Peer-to-peer solar energy trading on the Stellar blockchain.**

Stelltron is a decentralized marketplace where solar panel owners sell excess energy directly to neighbors — without a utility company in the middle. Built on Stellar's Soroban smart contract platform, it connects real physical hardware (ESP32 microcontrollers, Raspberry Pi nodes) to an on-chain settlement layer, dynamic pricing engine, and DeFi protocol.

---

## The Problem

A solar panel owner generates clean energy during the day. The utility company buys it at **2 cents/kWh**. Then at night, the same utility sells power back at **28 cents/kWh**. The ROI on solar panels stretches to 18+ years.

The root causes:

- No direct market exists between energy producers and consumers
- Utilities buy low, sell high, and pocket the spread
- Zero price transparency
- Grid infrastructure was never designed for distributed generation

---

## The Solution

Stelltron replaces the utility middleman with:

1. **On-chain energy tokens** — every kilowatt-hour of solar production mints LT tokens (1 kWh = 1,000 LT)
2. **A P2P order book** — buyers and sellers meet directly at market-discovered prices
3. **Real IoT hardware** — ESP32 and Raspberry Pi nodes measure actual energy flows and report them on-chain
4. **Dynamic pricing** — a six-factor model replaces arbitrary utility tariffs with real market conditions
5. **ZK privacy** — sellers prove battery capacity without revealing exact state-of-charge
6. **DeFi yield** — LP staking, flash loans, and trade commissions generate revenue for participants

---

## Architecture at a Glance

```
Physical Layer    →    IoT Layer         →    Backend         →    Blockchain
─────────────────────────────────────────────────────────────────────────────
ESP32 nodes            Raspberry Pi            Go API               Stellar Soroban
18650 batteries        MQTT / HTTP             Gin + GORM           4 smart contracts
Relay circuits         SSE broadcast           Matching engine      Energy token
Voltage sensors        Scheduler               Pricing engine       Marketplace
                       ZK proofs               Redis cache          Governance
                                               PostgreSQL           Network incentives
```

---

## Key Numbers

| Metric | Value |
|--------|-------|
| Token ratio | 1 kWh = 1,000 LT tokens |
| Matching cycle | Every 5 seconds |
| Base price | 5.0 XLM/kWh |
| Price range | 2.5 – 25.0 XLM/kWh |
| Trade commission | 2.5% to LP stakers |
| LP base APY | 8.5% |
| Flash loan fee | 0.3% |
| CO₂ emission factor | 0.82 kg/kWh (India grid) |
| Carbon credit value | 0.05 XLM/kg CO₂ |
| ZK minimum SoC | Battery > 20% required |

---

## Why Stellar

| Requirement | Stellar | Ethereum |
|-------------|---------|----------|
| Transaction fee | ~$0.00001 | ~$0.50–$5 |
| Finality | 3–5 seconds | 15+ seconds |
| Smart contracts | Soroban / Rust | Solidity |
| DEX integration | Native | Uniswap dependency |
| Regulatory design | Built-in compliance | Afterthought |

Micro-transactions for energy (selling 1 kWh for ~$0.10) are only viable if fees are negligible. Ethereum would consume the entire profit on gas. Stellar makes the math work.

---

## Documentation Structure

| Section | What it covers |
|---------|---------------|
| [Architecture](./architecture/system-overview) | Full system design, component interactions |
| [Smart Contracts](./contracts/overview) | Soroban contract code, storage, functions |
| [API Reference](./api/overview) | Every endpoint, request/response schemas |
| [Dynamic Pricing](./algorithms/dynamic-pricing) | The six-factor pricing formula |
| [Matching Engine](./algorithms/matching-engine) | Order matching and trade settlement |
| [ZK Proofs](./algorithms/zero-knowledge) | Pedersen commitments, range proofs |
| [IoT Layer](./iot/overview) | Raspberry Pi, ESP32, hardware wiring |
| [DeFi Protocol](./defi/overview) | LP staking, flash loans, yield mechanics |
| [Getting Started](./getting-started/quickstart) | Local setup and deployment |
