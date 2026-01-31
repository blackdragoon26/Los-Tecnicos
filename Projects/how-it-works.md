# How It Works: Decentralized Energy Grid

## 🌍 The Vision
Energy shouldn't be a black box controlled by a few. Our Decentralized Energy Grid (DEG) transforms passive community members into active participants in a peer-to-peer (P2P) energy economy. By combining **IoT-based verification**, a **high-performance Go engine**, and **Stellar's trust layer**, we enable seamless, automated energy trading.

---

## 🛠️ Infrastructure Overview

The project is built on three main pillars:
1.  **The Physical Layer (IoT)**: ESP32/Pi controllers monitor energy production (Solar) and handle remote power locking/unlocking via MQTT.
2.  **The Intelligence Layer (Go Backend)**: A high-performance matching engine that pairs energy donors (sellers) with receivers (buyers) and orchestrates the IoT devices.
3.  **The Trust Layer (Stellar/Soroban)**: A suite of smart contracts that settle trades, hold funds in escrow, and govern the community.

---

## 📜 The Smart Contracts (Soroban)

We wrote 4 specific contracts to manage the grid lifecycle:

### 1. `energy_token`
-   **Why**: To represent electrical energy as a digital asset.
-   **How**: Tokenizes kWh. When a solar panel produces energy, the system can "mint" representative tokens that donors can then list on the market.

### 2. `marketplace`
-   **Why**: To provide a decentralized, trustless venue for trading.
-   **How**: Handles order listings (Buy/Sell) and escrow. It ensures that payment is only released once the trade is finalized by the matching engine.

### 3. `network_incentives`
-   **Why**: To reward "Greenspace" node operators who maintain the local IoT grid.
-   **How**: Tracks packet routing and verification activity from IoT devices and distributes small rewards, ensuring the infrastructure stays healthy.

### 4. `governance`
-   **Why**: To allow the community to decide on grid upgrades or fee structures.
-   **How**: A proposal and voting system where token holders (long-term participants) can steer the project's future.

---

## ✨ Why Stellar?

We chose Stellar specifically for this project because:
-   **Asset-First Design**: Stellar was built for tokenizing assets (like energy).
-   **Soroban Performance**: Soroban's WASM-based execution is fast and efficient, which is critical for real-time market settlement.
-   **Low Latency**: 5-second finality matches the speed of a localized energy market.
-   **Near-Zero Fees**: Micro-transactions for energy units (kWh) are only viable on a chain with minimal transaction costs.

---

## 🔄 The Integrated Flow
1.  **Listing**: A user's Solar Panel (IoT) reports excess power. The Go Backend receives this and creates a **Sell Order** on the **Marketplace**.
2.  **Matching**: Another user places a **Buy Order** on the Frontend. The **Matching Engine** (Go) identifies the price intersection.
3.  **Physical Locking**: Before settlement, the Backend sends an **MQTT Lock Command** to the donor's IoT device to reserve the energy.
4.  **On-Chain Settlement**: Once the "energy link" is verified, the Backend triggers the **Soroban Marketplace Contract** to transfer funds and record the trade.

---

## 🎤 Hackathon Q&A (Preparing for Judges)

### Q1: How do you prevent energy theft or false reporting?
**Answer**: Verification happens via a multi-layered check. The ESP32 is flashed with encrypted firmware that reports encrypted power readings back to the Go Backend. Discrepancies between reported production and actual delivery (monitored by the Grid Server) trigger an audit on the `network_incentives` contract.

### Q2: Why use a Go backend instead of doing everything on-chain?
**Answer**: Speed and IoT orchestration. Real-time MQTT coordination with thousands of physical devices requires the concurrency patterns of Go. The blockchain remains the *System of Record* for value, while Go handles the *System of Action* for real-time logistics.

### Q3: How does this scale to a whole city?
**Answer**: The architecture is "hyper-local." Each community runs its own local Grid Server and MQTT broker. These sub-grids then aggregate their state to the Stellar mainnet. This "Siloed Action, Unified Settlement" approach ensures infinite horizontal scaling.

### Q4: What happens if a user's internet goes down?
**Answer**: The IoT devices are designed to operate in an "Offline-First" mode for short durations. The Grid Server maintains a local cache of orders and syncs with the Stellar network as soon as connectivity is restored, ensuring the physical energy flow isn't interrupted by network jitters.
