# EnergyGrid Frontend - Decentralized P2P Energy Marketplace

This is the futuristic, cyberpunk-inspired frontend for the Decentralized Energy Grid, built on the Stellar blockchain. The interface provides a stunning, high-performance experience for energy community participants.

## ✨ Project Vision
Imagine a world where energy flow is as transparent as the code that powers it. EnergyGrid visualizes the community energy mesh as a living, glowing network of trade, where every rooftop solar panel is a node in a global decentralized grid.

## 🚀 Tech Stack
- **Framework**: Next.js 14 (App Router)
- **3D Visuals**: Three.js + React Three Fiber + @react-three/drei
- **Animations**: Framer Motion + GSAP
- **Styling**: Tailwind CSS (Custom Cyberpunk Theme)
- **State Management**: Zustand (Scaffolded)
- **Blockchain**: stellar-sdk + @stellar/freighter-api
- **Design Language**: Glassmorphism, Neon Accents, Geometric Grid Systems

## 🛠️ Folder Structure
- `src/app/`: Next.js App Router pages and layouts.
  - `(landing)`: Hero section and core value prop.
  - `dashboard/`: Donor, Recipient, and Operator management views.
  - `marketplace/`: Real-time order book and trading interface.
  - `network/`: 3D community node map.
- `src/components/`:
  - `three/`: Core 3D components like the Energy Background and Globe.
  - `ui/`: Common UI components (Navbar, Cards, Buttons).
- `src/lib/`: Blockchain interaction and utility helpers.

## 🖥️ Core Interfaces

### 1. 3D Background System
The entire application is draped in a custom-built 3D particle grid that responds to depth and movement, creating a sense of being "inside" the energy mesh.

### 2. Role-Based Dashboard
Seamlessly switch between:
- **Donor**: Monitor battery levels (holographic gauges), mint energy tokens, and create sell orders.
- **Recipient**: Track energy consumption and browse matching offers.
- **Operator**: High-level view of Raspberry Pi node performance and rewards.

### 3. Cyberpunk Marketplace
A data-rich trading floor featuring:
- Dynamic Order Book (Asymmetric Buy/Sell columns).
- Price discovery charts with neon indicators.
- Real-time trade feed simulation.

### 4. Global Network Map
An interactive 3D globe showing the distribution of active grid nodes and overall network health.

## 🏁 How to Run

### Prerequisites
- [Node.js 18+](https://nodejs.org/)
- `npm` or `yarn`

### Installation
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```
   *(Note: --legacy-peer-deps is used for React 18 compatibility with some 3D libraries)*

### Development Mode
Launch the development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to see the future of energy.

### Production Build
Build the optimized application:
```bash
npm run build
```

## 🔐 Security & Integration
The application is pre-configured to integrate with the **Freighter Wallet**. While the current implementation uses UI simulations for demonstration, the `stellar-sdk` and `freighter-api` are already installed and scaffolded in the components.

---
*Built for the Stellar Build-A-Thon - Shaping the future of decentralization.*
