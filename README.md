# Los Tecnicos — Stelltron 

> Making solar panels profitable for everyone | Built for Stellar Build-A-Thon

[![Deploy Docs](https://github.com/blackdragoon26/Los-Tecnicos/actions/workflows/docs.yml/badge.svg)](https://github.com/blackdragoon26/Los-Tecnicos/actions/workflows/docs.yml)


---

## 🟢 Level 4 - Green Belt Submission

This project has been advanced to **Level 4 (Green Belt)**, focusing on advanced contract patterns, production readiness, and real-world hardware integration.

### 👉 Overview
Stelltron is a peer-to-peer energy marketplace that optimizes distributed energy resources (DERs) using the Stellar blockchain. We have implemented advanced Soroban contract patterns and prepared the system for production-grade deployment.

**Key Level 4 Implementations:**
- **Advanced Contract Architecture**: A multi-contract ecosystem (Energy Token, Marketplace, Governance, Incentives).
- **Custom Token & Liquidity Mechanics**: Specialized `LT` tokens with automated mint/burn and staking yield.
- **Production-Ready CI/CD**: Automated deployment pipeline for documentation and tests.
- **Mobile Responsive Design**: Fully responsive UI/UX for grid management on the go.
- **Advanced Event Streaming**: Real-time IoT data integration via MQTT and WebSockets.

---

## ⚪ Level 1 - White Belt Compliance (Foundation)

Stelltron fully implements all White Belt requirements as the foundation of its architecture:

- [x] **Wallet Setup**: Integrated with **Freighter Wallet** on the **Stellar Testnet**.
- [x] **Wallet Connection**: Robust connect/disconnect functionality with persistent state.
- [x] **Balance Handling**: Real-time fetching and clear display of XLM balances.
- [x] **Transaction Flow**: Seamless XLM transactions for energy settlements with user feedback and confirmation hashes.

---

## 🚀 Live Demo & Documentation

- **Frontend App**: [https://los-tecnicos.vercel.app/](https://los-tecnicos.vercel.app/)
- **Project Docs**: [https://stelltron-docs.vercel.app/](https://stelltron-docs.vercel.app/)
- **Backend API**: [https://los-tecnicos-backend.onrender.com/](https://los-tecnicos-backend.onrender.com/)

---

## 🛠️ Technical Architecture

### 1. Smart Contracts (Soroban/Rust)
We utilized a 4-contract modular architecture for maximum scalability and security:
- **Energy Token**: Handles minting (production) and burning (consumption).
- **Marketplace**: P2P order matching and settlement logic.
- **Governance**: On-chain voting for grid parameters.
- **Network Incentives**: Rewards DePIN node operators (Raspberry Pi/ESP32).

### 2. Backend (Go)
- **Matching Engine**: High-performance order pairing.
- **Dynamic Pricing**: Algorithmic price discovery based on grid SoC and demand.
- **IoT Gateway**: MQTT bridge for real hardware telemetry.

### 3. Frontend (React/Vite)
- **Dashboard**: Real-time visualization of energy flow and earnings.
- **Marketplace**: Professional trading interface for energy tokens.
- **Mobile First**: Shadcn/UI components optimized for all devices.

---

## 🔗 Contract & Transaction Details

---

- **Marketplace Contract**: `CCLRPNRPQDTG5773FCQJ2PH3WP74CNSO5SWFYFOXXLG2Z7YX6DPSLSA2`
- **Energy Token Address**: `CC3UGVJXGH3X2OE2WRRL4Z7VIUVSB64MYAZSNCXQGXXE64RRR4P3VZD`
- **Deployment Transaction Hash**: `df3c80b7704a8da30d6ee0af68c1e7e0fe60a78a6b8e8d4d1087ce30b32204c9`
- **Verified Account**: `GAIFJD5FD236SFHM75GJ2OGNY6CJI5YAGSAQ7LHWXNQL6H5LBABEAPSG`

---

## ⚙️ Setup & Installation

### Prerequisites
- **Node.js** 18+ & **npm**
- **Go** 1.21+
- **Rust** & **Soroban CLI**
- **Freighter Wallet** (Stellar Testnet)

### Local Development

1. **Clone the Repository**
   ```bash
   git clone https://github.com/blackdragoon26/Los-Tecnicos.git
   cd Los-Tecnicos
   ```

2. **Frontend Setup**
```bash
cd frontend
npm install
npm run dev
```
3. **Backend Setup**
```
bash
cd backend
go mod download
go run cmd/api/main.go
```
4. **Smart Contracts**

```bash
cd stellar_smart_contract
soroban contract build
```

## Team
Built with determination by Los Tecnicos for the Stellar Build-A-Thon. We believe in high-frequency, micro-transaction energy markets powered by the future of finance.
- @blackdragoon26
- @AkarshSahlot
- @abhishek-8081
License: MIT
