---
id: business-flow
title: Business Flow
sidebar_label: Business Flow
---

# Business Flow

## Household onboarding

1. A user creates an LT app wallet.
2. Freighter or Web2 checkout may fund that wallet without becoming its identity.
3. The user buys a Power Kit for **50 LT** or receives a sample kit in demo mode.
4. The kit is registered by its chipset MAC address and given an optional friendly alias.
5. A Raspberry Pi gateway discovers the kit and forwards telemetry.

## Two-person energy transfer

1. Receiver places a request and locks LT in escrow.
2. Donor sees the shared session update and accepts the transfer.
3. Donor relay enters supply mode; receiver relay enters receive mode.
4. The backend monitors voltage, current, input energy, usable energy and loss.
5. Successful delivery releases escrow to the donor.
6. Cancellation, timeout or hardware fault refunds the receiver.

```text
open -> funds_locked -> transferring -> delivered -> settled
```

Soroban hashes can be attached as optional settlement proof. Their absence does not block the demo or local energy delivery.

## Revenue direction

The near-term business model is hardware and gateway deployment, not unsupported yield claims. DeFi and governance concepts are documented only under Experimental Labs.
