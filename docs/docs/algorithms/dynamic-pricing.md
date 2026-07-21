---
id: dynamic-pricing
title: Dynamic Pricing Engine
sidebar_label: Dynamic Pricing
---

# Dynamic Pricing Engine

The Go backend is authoritative for every price and its factor attribution. Frontends display the response; they do not generate market values.

```text
Price = Base x Supply/Demand x SoC x Distance x Time x Reliability
```

The current base is **0.50 LT/kWh**.

| Factor | Backend input | Purpose |
|---|---|---|
| `f_sd` | Supplying and receiving households | Respond to local scarcity |
| `f_soc` | Fleet battery state of charge | Price depleted storage risk |
| `f_dist` | Donor-receiver distance | Represent local transfer loss |
| `f_time` | Simulated or real Delhi time | Reflect morning and evening peaks |
| `f_reliability` | Hardware delivery history | Reward dependable kits |

For the digital twin, weather changes production, demand and SoC before these factors are calculated. There is no direct weather-price multiplier.

## Attribution response

```json
{
  "price_lt_per_kwh": 0.5421,
  "price_breakdown": {
    "base_price": 0.5,
    "f_sd": 1.0412,
    "f_soc": 1.0874,
    "f_dist": 1.168,
    "f_time": 0.85,
    "f_reliability": 0.9981,
    "final_price": 0.5421
  }
}
```

## Display currencies

Trades and settlement remain LT-only. The backend exposes LT-to-INR, USD and EUR display rates from Frankfurter/ECB with source, timestamp and fallback status:

```text
GET /api/v1/market/rates
```
