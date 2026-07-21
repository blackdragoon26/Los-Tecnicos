---
id: api-overview
title: API Reference
sidebar_label: Overview
---

# API Reference

Production base: `https://los-tecnicos-backend.onrender.com`

## Demo and simulation

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/demo/sessions` | Create isolated donor and receiver personas |
| POST | `/api/v1/demo/sessions/join` | Join with code and persona |
| PATCH | `/api/v1/demo/sessions/:id/speed` | Set `realtime`, `10x` or `pitch` |
| GET | `/api/v1/simulation/snapshot` | Current 50-home snapshot |
| GET | `/api/v1/simulation/timeseries` | Backend market and energy history |
| GET | `/api/v1/market/rates` | LT display rates with quote metadata |

## Wallet and hardware

These routes require the persona JWT.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/wallet` | Authoritative balance and ledger |
| POST | `/api/v1/wallet/demo-topup` | Idempotent demo funding |
| GET | `/api/v1/kits` | Wallet-owned Power Kits |
| POST | `/api/v1/kits/register` | Register canonical MAC and alias |

## Trades

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/trades/active?session_id=...` | Discover the shared session trade |
| POST | `/api/v1/trades/lock` | Receiver locks LT |
| POST | `/api/v1/trades/:id/start` | Donor starts supply |
| GET | `/api/v1/trades/:id` | Read progress and telemetry |
| POST | `/api/v1/trades/:id/settle` | Release delivered escrow |
| POST | `/api/v1/trades/:id/cancel` | Cancel and refund |
| POST | `/api/v1/trades/:id/fault` | Simulate hardware fault and refund |

## IoT

`POST /iot/ping` accepts real Pi-shaped telemetry. Extended fields include `mac_address`, `latitude`, `longitude`, `hardware_profile`, `session_id`, per-node MACs and source metadata.

```json
{
  "device_id": "rpi-4b-prod-01",
  "mac_address": "DC:A6:32:00:10:01",
  "hardware_profile": "prototype_5v_18650",
  "source": "rpi_energy_grid",
  "nodes_detail": [{
    "uid": "NODE_A",
    "mac_address": "78:21:84:BD:C9:64",
    "voltage": 3.96,
    "soc": 84.2,
    "state": "SUPPLYING"
  }]
}
```
