---
id: system-overview
title: System Architecture
sidebar_label: System Overview
---

# System Architecture

Stelltron has two physical layers and one authoritative software plane.

```text
Power Kit (ESP32 + cell + relays)
        | TCP telemetry and commands
Raspberry Pi local mesh gateway
        | HTTPS / JSON
Go backend
        |-- LT app wallets and append-only ledger
        |-- pricing, matching, escrow and settlement
        |-- 50-home Delhi NCR digital twin
        |-- PostgreSQL or SQLite demo persistence
        |-- optional Redis cache
        |-- optional Soroban proof anchor
        |
React / Vite frontend and Docusaurus docs
```

## Runtime responsibilities

| Layer | Responsibility |
|---|---|
| Power Kit | Sense voltage/SoC and switch supply or receive relay paths |
| Pi gateway | Discover MAC-addressed kits and bridge the local network |
| Go backend | Own identity, wallets, telemetry, pricing, transfers and time series |
| Frontend | Render backend state and issue authenticated commands |
| Soroban | Optional funding or settlement-proof integration |

## Data profiles

The backend keeps the physical prototype and projected simulation distinct:

- `prototype_5v_18650`: photographed hardware, Wh-scale transfer monitor
- `projected_household`: synthetic kWh-scale Delhi NCR household model

Every simulation response includes source, weather source, coordinates, units and simulated timestamp.

## Persistence model

`DemoSession`, `AppWallet`, `WalletLedgerEntry`, `HardwareKit` and `EnergyTrade` form the demo product contract. `IoTDevice` and `NodeDetail` retain the physical telemetry model. Session IDs isolate every demo market.

Render can use PostgreSQL in production. SQLite fallback keeps the demonstrator available when an external database is unavailable.
