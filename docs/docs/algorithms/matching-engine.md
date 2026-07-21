---
id: matching-engine
title: Matching and Settlement
sidebar_label: Matching Engine
---

# Matching and Settlement

The backend matches an authenticated receiver wallet, donor wallet and their registered Power Kit MACs inside one demo session.

## Match constraints

- Session IDs must match.
- A receiver persona locks funds; a donor persona starts supply.
- Input energy for the current prototype is limited to 50 Wh.
- Price comes from the backend digital-twin snapshot in LT/kWh.
- Usable energy equals measured input after conversion loss.

## Balance conservation

At lock, LT moves from receiver available balance to receiver escrow. At settlement, escrow decreases and donor available balance increases by exactly the same amount. A fault or cancellation restores that amount to the receiver. Unique idempotency keys prevent duplicate ledger effects.

## Current prototype calculation

```text
usable_Wh = input_Wh x 0.82
escrow_LT = usable_Wh / 1000 x price_LT_per_kWh
power_W   = bus_voltage x current_A
```

The transfer modal shows the physical ETA and a separate 20-second accelerated demonstration ETA.
