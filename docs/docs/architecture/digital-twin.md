---
id: digital-twin
title: Delhi NCR Digital Twin
sidebar_label: Digital Twin
---

# Delhi NCR Digital Twin

The backend maintains **50 synthetic households** across Delhi, Noida, Gurugram, Ghaziabad and Faridabad. This is projected product behavior, not customer deployment data.

Each household has deterministic coordinates, a unique Power Kit MAC address, solar capacity, battery capacity, demand curve, conversion efficiency, reliability and state of charge.

## Environmental model

The backend fetches Delhi weather from Open-Meteo and caches it for 10 minutes. A Delhi seasonal profile is used when the network request fails. Temperature and cloud cover affect:

- Solar production
- Cooling and household demand
- Battery state of charge
- Whether a household supplies, receives or stays idle

Weather is **not** applied as an artificial price multiplier. Its effects reach price through supply, demand and SoC.

## Clock modes

| Mode | Multiplier | Use |
|---|---:|---|
| Real time | 1x | Operational monitoring |
| Accelerated | 10x | Development and shorter demos |
| Pitch | 120x | 24 simulated hours in 12 minutes |

Clock state is isolated per demo session.

## APIs

```text
POST  /api/v1/demo/sessions
POST  /api/v1/demo/sessions/join
PATCH /api/v1/demo/sessions/:id/speed
GET   /api/v1/simulation/snapshot?session_id=...
GET   /api/v1/simulation/timeseries?session_id=...
```

Responses include `mode: simulation`, a disclosure, weather source, simulated timestamp, coordinates, MAC addresses and physical units.
