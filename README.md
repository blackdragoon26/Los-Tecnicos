# Los Tecnicos - Stelltron

> Built for Stellar Build-A-Thon | Making solar panels profitable for everyone

<img width="1280" height="625" alt="540369150-395a1862-752f-43bb-98e1-366abb62d601-2" src="https://github.com/user-attachments/assets/d818ba40-320a-4d6b-b3c5-79b62bdb5790" />

---
Link to frontend -https://los-tecnicos-frontend.vercel.app/dashboard
Link to Backend  -https://los-tecnicos-backend.onrender.com/
## The Problem We're Solving

My neighbor installed solar panels last year. Cost him $22,000. Know what the utility company pays him for excess energy? 2 cents per kWh. Meanwhile, I'm paying 28 cents per kWh from the same grid. 

That's broken.

He generates clean energy during the day when he's at work. It goes back to the grid for pennies. Then at night, he buys it back at 14x the price. His ROI? 18 years. By then, he'll need new panels.

This isn't just my neighbor. It's 3.2 million US households with solar, and millions more worldwide. They're sitting on valuable assets that can't reach their full potential because:

1. **The middleman takes everything** - Utilities buy low, sell high, keep the difference
2. **No market exists** - You can't sell directly to your neighbor even if you wanted to
3. **Zero transparency** - Nobody knows where energy comes from or what it actually costs
4. **Tech is stuck in the 1950s** - The grid wasn't built for distributed generation

We're fixing this with blockchain.

---

## What We Built

Stelltron is a peer-to-peer energy marketplace running on Stellar. Think of it as a local energy exchange where:

- Solar owners list their excess energy for sale
- Neighbors buy it at fair market prices
- Everything settles instantly on-chain
- No utility company needed

But here's what makes it actually work in the real world:

### Real Hardware Integration

We're not just building smart contracts in a vacuum. We built this to work with actual solar installations:

**ESP32 microcontrollers** monitor your solar panels - voltage, current, production. When you generate excess energy, the system mints tokens representing real kWh. One token = one kilowatt-hour. Physics meets blockchain.

**Raspberry Pi nodes** form a mesh network that routes energy data and earns rewards for participation. Every packet they route makes them money. Decentralized infrastructure that pays for itself.

### Smart Contract Architecture

We deployed four Soroban contracts on Stellar testnet:

**Energy Token Contract** - Handles token minting when solar panels produce. Only authorized devices can mint (verified through our IoT backend). Prevents inflation, ensures every token represents real energy.

**Marketplace Contract** - Order book for energy trading. Create buy/sell orders, automatic matching based on price-time priority, escrow handling. Built-in yield mechanism (5% APY simulation) because why shouldn't your energy tokens earn interest?

**Network Incentives Contract** - Pays Raspberry Pi operators for routing data. 1 stroop per 100 packets. Makes the network self-sustaining.

**Governance Contract** - Community votes on pricing parameters, grid rules, feature additions. One wallet, one vote. Democracy for your local energy grid.

### Dynamic Pricing Engine

Wrote this in Go because we needed speed. Calculates fair prices using six factors:

- Supply vs demand (basic economics)
- Battery state of charge (scarcity pricing)
- Physical distance (transmission costs)
- Time of day (peak vs off-peak)
- Seller reliability score (reputation matters)
- Seasonal adjustments (summer vs winter production)

The formula looks complicated but it basically answers: "What should this energy cost right now given all market conditions?"

Community can vote to change the coefficients through governance. Want to reward local trading more? Vote to increase the distance penalty. Want to incentivize battery storage? Adjust the SoC factor. It's your grid.

---

## Why Stellar?

We evaluated Ethereum, Solana, and Polygon. Stellar won for reasons that matter in energy markets:

**Speed** - Energy trades need to settle fast. 3-5 seconds on Stellar vs 15 seconds on Ethereum. When someone needs power, they need it now.

**Cost** - We're talking micro-transactions. Selling 1 kWh for $0.10 needs to be profitable after fees. Stellar transactions cost $0.00001. Ethereum would eat the entire profit.

**Compliance-ready** - Energy is regulated. Heavily. Stellar was built with financial regulations in mind. Makes future licensing easier.

**Soroban** - Writing smart contracts in Rust instead of Solidity was refreshing. Better safety guarantees, smaller WASM binaries, faster execution.

**Built-in DEX** - Future integration path is clear. CommunityEnergy tokens could trade on Stellar's native exchange without writing new contracts.

The tech just made sense for what we're building.

---

## Technical Architecture

### Backend (Go)

Chose Go for the API server because:
- Goroutines make concurrent order matching trivial
- PostgreSQL driver is rock solid
- MQTT client libraries actually work
- Compile to a single binary for easy deployment

The matching engine runs in a goroutine, checking for compatible orders every 5 seconds. When it finds a match (buy price ≥ sell price, quantities align), it calls the Soroban contract to execute the trade.

Database schema is straightforward:
- `users` - wallet addresses and metadata
- `orders` - buy/sell orders with status tracking
- `devices` - ESP32 and Pi registration
- `transactions` - on-chain trade history
- `device_telemetry` - real-time IoT data

Redis handles rate limiting (100 req/min per IP) and caches hot data.

### Frontend (Next.js)

Server-side rendering for performance. Key pages:

- `/marketplace` - Browse available energy, create orders
- `/dashboard` - Your position, pending trades, balance
- `/governance` - Active proposals, voting interface
- `/analytics` - Price charts, volume stats, grid visualization

Used Three.js for the 3D grid view. Shows energy flowing between nodes in real-time. Looks cool and actually helps visualize the network topology.

Wallet integration with Freighter. No passwords, no email - just sign in with your Stellar wallet. Transactions require signatures, so nobody can trade without your explicit approval.

### Smart Contracts (Rust/Soroban)

Each contract is under 500 lines. Key functions:

**Energy Token:**
```rust
pub fn mint(env: Env, admin: Address, to: Address, amount: i128)
pub fn burn(env: Env, from: Address, amount: i128)
pub fn balance(env: Env, id: Address) -> i128
```

**Marketplace:**
```rust
pub fn create_order(env: Env, seller: Address, quantity: i128, price: i128)
pub fn match_orders(env: Env, order1_id: u64, order2_id: u64)
pub fn complete_trade(env: Env, trade_id: u64)
```

**Network Incentives:**
```rust
pub fn register_node(env: Env, node: Address)
pub fn report_activity(env: Env, node: Address, packets: u64)
pub fn claim_rewards(env: Env, node: Address) -> i128
```

**Governance:**
```rust
pub fn create_proposal(env: Env, proposer: Address, description: String)
pub fn vote(env: Env, voter: Address, proposal_id: u64, support: bool)
pub fn finalize(env: Env, proposal_id: u64)
```

Deployment script handles everything - compiles to WASM, deploys to testnet, updates backend .env with contract IDs.

### IoT Layer (ESP32 + Raspberry Pi)

ESP32s talk MQTT. Every 10 seconds they publish:
```json
{
  "device_id": "esp32_001",
  "voltage": 48.2,
  "current": 12.5,
  "power_kwh": 0.6,
  "battery_soc": 85,
  "timestamp": 1738419200
}
```

Backend consumes these messages, updates the database, and mints tokens when production exceeds consumption.

Raspberry Pis run a simple Python script that routes data and reports activity to the incentives contract. They're earning money just by being online.

For demo purposes, we built a simulation engine that generates realistic data. Fluctuates battery levels, simulates production curves, adds noise. Makes testing possible without physical hardware.

---

## How It Actually Works

Let me walk through a real trade:

**9:00 AM** - Sarah's solar panels are cranking. She's at work, house is empty, generating 8 kWh/hour. Her ESP32 sees this and tells our backend.

**9:01 AM** - Backend mints 8 tokens to Sarah's wallet. She opens the app and lists them for sale at 10 XLM/kWh.

**1:00 PM** - Mike gets home, turns on the AC. Needs energy. Sees Sarah's offer. Market rate is 12 XLM/kWh but Sarah's selling for 10. He creates a buy order for 5 kWh at 11 XLM/kWh (still cheaper than grid).

**1:00:05 PM** - Matching engine finds compatible orders. Calls marketplace contract. Trade executes. Sarah gets 50 XLM (5 × 10), Mike gets 5 tokens. Transaction settles in 4 seconds.

**1:00:10 PM** - Mike's device confirms energy receipt. Tokens are burned (they've been "consumed"). Sarah's wallet shows the XLM. Both get notifications.

Total cost to Mike: 55 XLM (~$5.50). What he would've paid the utility: $7.50. Saved 27%.

Total earnings for Sarah: 55 XLM. What utility would've paid: $0.50. Made 1,000% more.

The difference? No middleman.

---

## What Makes This Different

Every hackathon has an "Uber for X" project. What makes ours credible?

**We built the whole stack.** Not just contracts. Not just a UI. Backend matching engine, dynamic pricing, IoT integration, governance - it's all there and it works.

**Real hardware connections.** The ESP32 code exists. The MQTT broker runs. We can plug in actual solar panels and it'll work. Not "in theory" - we tested it.

**Economic model makes sense.** Ran the numbers. At current solar production rates and utility prices, payback period drops from 18 years to 8 years. That's the difference between "maybe someday" and "worth doing now."

**Regulatory awareness.** We know this needs licenses. We know utilities will fight it. We know grids have technical constraints. Built with that reality in mind - the governance system lets communities adapt to local regulations.

**Stellar integration is deep.** Not just "we used XLM." We use Soroban contracts, we're planning DEX integration, we designed around Stellar's compliance features. This couldn't easily be ported to another chain.

---

## Challenges We Hit

**Smart contract storage limits** - Soroban has storage constraints. Had to optimize data structures. Orders store minimal data on-chain, full details in Postgres.

**MQTT reliability** - Devices disconnect. Network hiccups. Had to build retry logic and offline queueing. Learned that IoT is harder than it looks.

**Price discovery** - How do you price energy fairly when there's no historical market data? Built the dynamic pricing engine through trial and error. First version was way too volatile.

**Wallet UX** - People don't want to think about wallets and signing. Made onboarding smoother with clear instructions and helpful error messages. Still not perfect.

**Testing contracts** - Soroban testing framework is young. Wrote a lot of integration tests. Deployed to testnet early and often.

**Simulation realism** - Fake IoT data looks fake. Spent time making battery curves realistic, adding noise, simulating cloud cover effects. Details matter.

---

## What's Next

If this wins (or even if it doesn't), here's the plan:

**Month 1-2:** Order partial fills, advanced order types (limit/market/stop), mobile app.

**Month 3-6:** Real hardware pilot with 10 households in one neighborhood. Actual solar panels, actual batteries, actual energy trades.

**Month 6-12:** DeFi features - liquidity pools, yield farming, energy savings accounts. Make energy a financial asset.

**Year 2:** Expand to 1,000 households across 3 cities. Start working on regulatory approvals. Partner with solar installers.

**Year 3:** Go international. India has 300 days of sun and expensive energy. Kenya's grid is unreliable. Philippines has high solar adoption. These markets need this.

Long shot goal: By 2030, power 100 million households with P2P solar. Offset 500 million tons of CO2. Make energy accessible and affordable globally.

Ambitious? Yeah. Impossible? We don't think so.

---

## Run It Yourself

### Prerequisites
- Rust + Soroban CLI
- Go 1.21+
- Node.js 18+
- PostgreSQL + Redis
- Mosquitto MQTT broker

### Quick Start

```bash
# Deploy contracts
cd stellar_smart_contract
./deploy.sh

# Start backend
cd ../backend
docker-compose up -d
go run cmd/server/main.go

# Start frontend
cd ../frontend
npm install && npm run dev
```

Open `localhost:3000`, connect Freighter wallet, start trading.

Full setup guide in `/docs/SETUP.md`.

---

## Project Structure

```
Los-Tecnicos/
├── stellar_smart_contract/    # Soroban contracts (Rust)
│   ├── energy_token/
│   ├── marketplace/
│   ├── network_incentives/
│   └── governance/
├── backend/                    # Go API
│   ├── api/handlers/
│   ├── core/domain/
│   ├── pricing/
│   ├── matching/
│   └── mqtt/
├── frontend/                   # Next.js app
│   ├── app/
│   ├── components/
│   └── lib/
└── docs/                       # Documentation
```

---

## Contributing

Found a bug? Have an idea? PRs welcome.

Areas where help would be appreciated:
- Real solar panel testing
- Mobile app development  
- Regulatory research
- Documentation improvements
- Translation (Spanish, Hindi, Mandarin)

---

## Team

Built by Los Tecnicos for Stellar Build-A-Thon.

We're developers who believe blockchain can solve real problems. Energy access is one of them.

---

## License

MIT - use it, fork it, improve it.

---

## Final Thoughts

The energy system is broken. Utilities are monopolies. Solar owners get ripped off. Buyers overpay. The grid is centralized and fragile.

Blockchain can fix this. Not in theory - in practice. Real hardware, real energy, real trades, real impact.

We built Los Tecnicos to prove it's possible. To show that P2P energy markets can work. To demonstrate that Stellar is the right platform for regulated, high-frequency, micro-transaction markets.

This isn't just a hackathon project. It's a blueprint for the future of energy.

Help us build it.

---

**GitHub:** [Los-Tecnicos](https://github.com/blackdragoon26/Los-Tecnicos)  
**Testnet Contracts:** Deployed and functional  
**Demo:** Available on request

⚡ Powered by Stellar | Built for communities | Made with determination

---
