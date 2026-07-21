---
id: wallet-and-trades
title: Wallets and Trades
sidebar_label: Wallets and Trades
---

# Wallets and Trades

## Identity boundary

The **LT app wallet** is owned by the backend and identified independently from external payment accounts. Freighter and Web2 checkout can fund it, but neither becomes the app-wallet identity.

Every balance change creates an append-only ledger entry with a unique idempotency key. Demo sessions create separate donor and receiver users, JWTs, balances, transaction histories and sample-kit MACs.

## Trade state machine

```text
open -> funds_locked -> transferring -> delivered -> settled
```

- Only the receiver can lock funds.
- Only the donor can start hardware supply.
- Delivery progress is derived by the backend, not a browser timer.
- Settlement removes receiver escrow and credits the donor once.
- Cancellation, timeout or hardware fault refunds receiver escrow once.
- Repeated top-up, settlement and refund requests are idempotent.

The prototype monitor reports sender and receiver MACs, voltage, current, wattage, efficiency, input Wh, usable Wh, estimated loss, escrowed LT and both physical and accelerated ETA.

## APIs

```text
GET  /api/v1/wallet
POST /api/v1/wallet/demo-topup
GET  /api/v1/kits
POST /api/v1/kits/register
GET  /api/v1/trades/active?session_id=...
POST /api/v1/trades/lock
POST /api/v1/trades/:id/start
GET  /api/v1/trades/:id
POST /api/v1/trades/:id/settle
POST /api/v1/trades/:id/cancel
POST /api/v1/trades/:id/fault
```
