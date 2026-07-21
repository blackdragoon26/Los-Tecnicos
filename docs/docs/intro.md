---
id: intro
title: Stelltron
sidebar_label: Overview
slug: /
---

# Stelltron

[**Stellar APAC Winner**](https://stellar.org/) | [Live app](https://los-tecnicos.vercel.app) | [Partner with Stelltron](mailto:sankalp.jha9643@gmail.com?subject=Partner%20with%20Stelltron)

**Seeking angel and pre-seed partners.**

Stelltron is household energy infrastructure that lets individuals donate or trade surplus stored energy through local Power Kits and Raspberry Pi mesh gateways. The goal is to give households a direct role in energy resilience instead of relying entirely on large utilities.

The recognition link above does not imply that Stellar endorses Stelltron's projected deployment or simulation data.

![Photographed Stelltron Power Kit prototype](/img/stelltron-power-kit.png)

## What exists today

- A photographed ESP32, relay, converter and 18650 prototype operating on a shared 5V rail.
- Raspberry Pi gateway software that discovers nodes and forwards telemetry to the backend.
- A Go backend with LT app wallets, append-only ledger entries, escrow and a complete trade state machine.
- Optional Stellar/Soroban integration for funding rails and settlement proofs.
- A clearly labelled 50-household Delhi NCR digital twin for product demonstrations.

## Prototype versus projection

| Profile | Status | Scale |
|---|---|---|
| 5V/18650 Power Kit | Physical prototype | Wh-scale transfers, three ESP32 nodes |
| Delhi NCR digital twin | Projected simulation | 50 synthetic households across five cities |
| Community mesh | Roadmap | Multiple nearby Raspberry Pi gateways |

Digital-twin households are never presented as deployed customers.

## Product model

1. A household owns a **Power Kit**, priced at **50 LT**.
2. The kit reports a MAC-addressed battery and relay state to a local gateway.
3. A receiver locks LT in the app-wallet escrow.
4. Donor and receiver hardware enter supply and receive modes.
5. Telemetry verifies input energy, usable energy and loss.
6. The backend settles LT to the donor and writes matching immutable ledger entries.

Freighter and Web2 payments are funding rails only. They do not replace or share the identity of the backend-owned LT app wallet.

## Documentation map

- [System architecture](./architecture/system-overview)
- [Digital twin](./architecture/digital-twin)
- [Wallet and trade lifecycle](./architecture/wallet-and-trades)
- [Dynamic pricing](./algorithms/dynamic-pricing)
- [IoT layer](./iot/iot-overview)
- [Investor overview](./company/investors)
- [Experimental Labs](./defi/defi-overview)
