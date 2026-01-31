# Decentralized Energy Grid (Stellar Build-A-Thon)

A peer-to-peer energy trading platform built on the **Stellar (Soroban)** blockchain. This project enables community members to trade excess solar energy as tokenized assets, coordinated via IoT and a high-performance Matching Engine.

![DASHBOARD](https://github.com/user-attachments/assets/395a1862-752f-43bb-98e1-366abb62d601)

---

## 🏗️ Technical Stack

-   **Blockchain**: Soroban (Stellar Smart Contracts) - Rust
-   **Backend**: Go (Golang) - Gin, MQTT Coordination, Matching Engine
-   **Frontend**: Next.js 14, React, Three.js (3D Visuals), Zustand
-   **IoT**: MQTT Protocol for device energy locking and verification

---

## 📂 Project Structure

-   `stellar_smart_contract/`: Soroban smart contracts (Marketplace, Governance, Tokens).
-   `backend/`: Go backend handling order matching and IoT bridges.
-   `frontend/`: Next.js frontend with futuristic 3D dashboards.

---

## 🚀 Local Setup Guide

### 1. Prerequisites
Ensure you have the following installed:
-   **Rust & Soroban CLI** (for smart contracts)
-   **PostgreSQL**: Ensure a local instance is running.
-   **Redis**: Ensure a local instance is running on port 6379.
-   **MQTT Broker** (e.g., Mosquitto) running locally on port 1883.

---

### 1.5 Database Setup (PostgreSQL)
Before running the backend, create the required user and database:
```bash
# Create the postgres superuser role (if not present)
createuser -s postgres
# Create the project database
createdb los_tecnicos
```

---

### 2. Smart Contracts (Soroban)
```bash
cd stellar_smart_contract
# Build all contracts
cargo build
# Run unit tests to verify logic
cargo test
```

---

### 3. Backend (Go)
```bash
cd backend
# Install dependencies
go mod tidy
# Run the server
# (Ensure MQTT broker is running at localhost:1883)
go run cmd/server/main.go
```
The backend will start at `http://localhost:8080`.

---

### 4. Frontend (Next.js)
```bash
cd frontend
# Install dependencies
npm install
# Start development server
npm run dev
```
The UI will be accessible at `http://localhost:3000`.

---

## 🧪 Local Verification Flow

1.  **Start MQTT Broker**: Ensure your local `mosquitto` or similar broker is active.
2.  **Launch Backend**: Run the Go server. It will initialize the matching engine.
3.  **Launch Frontend**: Open the marketplace UI.
4.  **Simulate Trading**:
    -   Place a **Sell Order** for 50 kWh at 10 XLM.
    -   Place a **Buy Order** for 50 kWh at 10 XLM.
5.  **Observe Logs**:
    -   Backend will log: `[Matching Engine] Match found!`.
    -   Backend will log: `[IoT] Sending lock command to device...`.
    -   The system will attempt to settle the trade on the Stellar network (simulation/devnet).

---

## 📄 License
This project is licensed under the MIT License.
