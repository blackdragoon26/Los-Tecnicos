---
id: quickstart
title: Getting Started
sidebar_label: Quickstart
---

# Getting Started

This guide walks through running the Stelltron stack locally: Go backend, React/Vite frontend, Docusaurus docs, and optional Soroban contracts.

---

## Prerequisites

Install the following before proceeding:

| Tool | Version | Install |
|------|---------|---------|
| Rust | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Stellar CLI | latest | `cargo install --locked stellar-cli --features opt` |
| Go | 1.21+ | [golang.org/dl](https://golang.org/dl/) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org/) |
| PostgreSQL | 14+ | `brew install postgresql` (macOS) |
| Redis | 7+ | `brew install redis` (macOS) |
| Docker | Optional | Required for `docker-compose up -d` |

---

## Step 1: Deploy Smart Contracts

Contracts must be deployed to Stellar testnet first — the backend needs their contract IDs.

```bash
cd stellar_smart_contract

# Fund a testnet account for deploying (first-time only)
stellar keys generate oracle --network testnet
stellar keys fund oracle --network testnet

# Deploy all four contracts
./deploy.sh
```

`deploy.sh` will:
1. Compile all Rust contracts to WASM
2. Deploy each to Stellar testnet
3. Initialize each contract with the oracle admin key
4. Write contract IDs to `../backend/.env`

The script outputs something like:
```
TOKEN_CONTRACT_ID=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
MARKETPLACE_CONTRACT_ID=CXXXXXXXX...
GOVERNANCE_CONTRACT_ID=CXXXXXXXX...
NETWORK_INCENTIVES_CONTRACT_ID=CXXXXXXXX...
```

---

## Step 2: Configure Backend

Create or edit `backend/.env`:

```env
# Database
DATABASE_URL=postgres://postgres:password@localhost:5432/stelltron?sslmode=disable

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key-here-change-in-production

# Stellar / Soroban
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org:443
ORACLE_PRIVATE_KEY=<the oracle key that deployed the contracts>

# Contract IDs (written by deploy.sh)
TOKEN_CONTRACT_ID=CXXXXXXXX...
MARKETPLACE_CONTRACT_ID=CXXXXXXXX...
GOVERNANCE_CONTRACT_ID=CXXXXXXXX...
NETWORK_INCENTIVES_CONTRACT_ID=CXXXXXXXX...
```

---

## Step 3: Start Backend

### Option A: Docker Compose (recommended for first run)

```bash
cd backend
docker-compose up -d    # starts PostgreSQL + Redis
go run cmd/api/main.go
```

### Option B: Manual

```bash
# Start PostgreSQL
brew services start postgresql
createdb stelltron

# Start Redis
redis-server

# Run backend
cd backend
go run cmd/api/main.go
```

The backend will:
- Auto-migrate all 17 database tables
- Seed the production Pi device (`rpi-4b-prod-01`)
- Start the matching engine goroutine (every 5s)
- Start the SSE broker
- Listen on `:8080`

Expected startup output:
```
[SEED] Cleaned up old simulation data
[SEED] Production device already exists: rpi-4b-prod-01
Starting matching engine...
Starting IoT SSE broker...
Server listening on :8080
```

---

## Step 4: Start Frontend

```bash
cd frontend
npm install

# Create .env.local
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080
EOF

npm run dev
```

Frontend starts at `http://localhost:3000`.

---

## Step 5: Connect Wallet

1. Install [Freighter](https://www.freighter.app/) browser extension
2. Create or import a Stellar wallet
3. Switch Freighter to **Testnet** network
4. Fund your testnet account: visit [Stellar Laboratory Friendbot](https://laboratory.stellar.org/#account-creator?network=test)
5. Open `http://localhost:3000`
6. Click "Connect Wallet" → Freighter will prompt you to sign `"los-tecnicos-auth"`
7. Sign — you're logged in

---

## Step 6: Test a Trade

### Create a Sell Order (as Donor)

```bash
# Get your access token first
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"wallet_address":"YOUR_WALLET","signature":"YOUR_SIG"}' \
  | jq -r '.access_token')

# Create a sell order
curl -X POST http://localhost:8080/api/v1/market/order/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"sell","kwh_amount":0.5,"token_price":9.0}'
```

### Create a Buy Order (as Recipient)

```bash
curl -X POST http://localhost:8080/api/v1/market/order/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"buy","kwh_amount":0.5,"token_price":10.0}'
```

Within 5 seconds, the matching engine will match these orders. Check the result:

```bash
curl http://localhost:8080/api/v1/ledger/transactions
```

---

## Simulating IoT Hardware

If you don't have a Raspberry Pi, you can simulate it with curl:

```bash
# Simulate Pi heartbeat
curl -X POST http://localhost:8080/iot/ping \
  -H "Content-Type: application/json" \
  -d '{"device_id":"rpi-4b-prod-01","status":"heartbeat"}'

# Simulate node data
curl -X POST http://localhost:8080/iot/ping \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "rpi-4b-prod-01",
    "voltage": 3.92,
    "battery_level": 72.4,
    "state": "IDLE",
    "source": "simulation",
    "connected_nodes_count": 2,
    "connected_nodes": [
      {"uid":"NODE_A","voltage":3.92},
      {"uid":"NODE_B","voltage":3.61}
    ],
    "nodes_detail": [
      {"uid":"NODE_A","ip":"192.168.1.101","voltage":3.92,"soc":72.4,"state":"IDLE"},
      {"uid":"NODE_B","ip":"192.168.1.102","voltage":3.61,"soc":28.1,"state":"IDLE"}
    ]
  }'

# Simulate energy transfer completion (mints tokens)
curl -X POST http://localhost:8080/iot/energy/report \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "rpi-4b-prod-01",
    "sender_uid": "NODE_A",
    "receiver_uid": "NODE_B",
    "kwh_transferred": 0.5,
    "duration_seconds": 1800,
    "avg_voltage": 3.92,
    "avg_current": 0.27
  }'
```

---

## Production Deployment

The project uses `render.yaml` for production:

```bash
# Backend on Render (auto-deploys on push to main)
# Uses environment variables configured in Render dashboard

# Frontend on Vercel
npx vercel --prod
```

See the `/deploy_full_stack` workflow in `.agent/workflows/` for the full deployment procedure.

---

## Project Links

| Resource | URL |
|----------|-----|
| Frontend | [los-tecnicos.vercel.app](https://los-tecnicos.vercel.app/) |
| Backend | [los-tecnicos-backend.onrender.com](https://los-tecnicos-backend.onrender.com/) |
| GitHub | [github.com/blackdragoon26/Los-Tecnicos](https://github.com/blackdragoon26/Los-Tecnicos) |
| Stellar Testnet | [stellar.expert/explorer/testnet](https://stellar.expert/explorer/testnet) |
| Freighter Wallet | [freighter.app](https://www.freighter.app/) |
