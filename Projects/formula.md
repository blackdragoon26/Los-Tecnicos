# Dynamic Pricing Model: Decentralized Energy Grid

This document outlines the mathematical foundation for dynamic energy pricing within the community grid. This model ensures the market remains balanced, encourages energy conservation during scarcity, and accounts for physical grid constraints.

---

## 📐 The Pricing Formula

The Real-Time Price ($P_{rt}$) is calculated using the following multi-factor equation:

$$P_{rt} = P_{base} \times F_{sd} \times F_{soc} \times F_{dist}$$

### 1. Base Price ($P_{base}$)
The baseline cost of 1 kWh (e.g., 5 XLM). This is the starting point for all adjustments.

### 2. Supply/Demand Factor ($F_{sd}$)
Based on the current state of the order book.
*   **Formula**: $F_{sd} = 1 + \alpha \ln\left(\frac{D}{S}\right)$
*   **Logic**: If Demand ($D$) > Supply ($S$), the price increases logarithmically.
*   **Coefficient**: $\alpha$ (Sensitivity to market imbalance).

### 3. State of Charge / Scarcity Factor ($F_{soc}$)
Reflects the physical energy reserves in the community.
*   **Formula**: $F_{soc} = 1 + \beta (1 - \text{SoC}_{avg})$
*   **Logic**: As the average battery percentage ($\text{SoC}_{avg}$) of the community drops, energy becomes "precious," and the price increases linearly to discourage excessive consumption.
*   **Coefficient**: $\beta$ (Scarcity sensitivity).

### 4. Transmission/Distance Factor ($F_{dist}$)
Accounts for energy loss over the grid and physical distance.
*   **Formula**: $F_{dist} = 1 + \gamma (d_{sr})$
*   **Logic**: $d_{sr}$ is the distance between the Donor and the Receiver. Trading with a neighbor is cheaper than trading across the entire community.
*   **Coefficient**: $\gamma$ (Grid loss coefficient).

---

## 🛠️ Integration Strategy

### 1. Data Collection (IoT / Raspberry Pi)
*   **Action**: The Raspberry Pi/Grid Controller polls all registered ESP32 devices for their current battery percentage (`SoC`).
*   **Calculation**: The Pi calculates the community-wide average ($\text{SoC}_{avg}$) every 60 seconds (or on every match attempt).

### 2. Engine Modification (Go Backend)
*   **Location**: `backend/internal/matching/engine.go`
*   **Implementation**: Before matching a buyer and seller, the engine calls a `CalculateDynamicPrice()` function using the current $SoC$, Order Book state ($D/S$), and the distance between the two users (stored in the `location` field of the `User` profile).
*   **Outcome**: The transaction price submitted to the Soroban contract is the calculated $P_{rt}$, rather than a fixed limit price.

### 3. Smart Contract Verification (Blockchain)
*   **Location**: `stellar_smart_contract/contracts/marketplace/src/contract.rs`
*   **Validation**: The contract can be updated to accept a signature from the "Price Oracle" (the Go Backend) verifying that the settled price matches the dynamic formula constraints, ensuring fair play.

---

## 💡 Example Scenario
*   **Market**: 100 Buyers, 50 Sellers ($F_{sd} \uparrow$)
*   **Grid**: Community battery avg at 30% ($F_{soc} \uparrow$)
*   **Trade**: Neighbor to Neighbor ($F_{dist} \approx 1$)
*   **Result**: The price will be significantly higher than the base price, incentivizing sellers to release energy and buyers to reduce non-essential usage.
