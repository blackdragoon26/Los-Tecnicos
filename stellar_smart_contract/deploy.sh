#!/bin/bash
set -e

# Configuration
NETWORK="testnet"
# Ensure we are in the project root
cd "$(dirname "$0")"

echo "🚀 Starting Soroban Contract Deployment to $NETWORK..."

# 0. Check for stellar CLI
if ! command -v stellar &> /dev/null; then
    echo "❌ 'stellar' CLI not found. Please install it:"
    echo "   brew install stellar-cli"
    exit 1
fi

# 0.1 Check for Rust WASM target
if ! rustup target list --installed | grep -q "wasm32-unknown-unknown"; then
    echo "⚙️  Installing Rust WASM target..."
    rustup target add wasm32-unknown-unknown
fi

# 1. Check/Create Identity
echo "👤 Setting up identity..."
# 'stellar keys' is the new command.
# verify if 'deployer' exists
if ! stellar keys address deployer > /dev/null 2>&1; then
    echo "⚠️  Identity 'deployer' not found. Creating and funding..."
    stellar keys generate --global deployer --network "$NETWORK"
    # Funding is often automatic with generate on testnet or requires 'stellar keys fund'
    # New CLI sometimes auto-funds. Let's be explicit if needed.
    # explicit fund command:
    stellar keys fund deployer --network "$NETWORK"
else
    echo "✅ Identity 'deployer' found: $(stellar keys address deployer)"
fi

# 2. Build Contracts
echo "🛠  Building Contracts..."
cargo build --target wasm32-unknown-unknown --release

# 3. Deploy Energy Token
echo "📦 Deploying Energy Token..."
TOKEN_WASM="target/wasm32-unknown-unknown/release/energy_token.wasm"
if [ ! -f "$TOKEN_WASM" ]; then
    echo "❌ Error: $TOKEN_WASM not found. Build failed?"
    exit 1
fi

TOKEN_ID=$(stellar contract deploy \
    --wasm "$TOKEN_WASM" \
    --source deployer \
    --network "$NETWORK" \
    --alias energy_token)
echo "✅ Energy Token Deployed: $TOKEN_ID"

# 4. Initialize Token
echo "⚙️  Initializing Token..."
ADMIN_ADDR=$(stellar keys address deployer)
stellar contract invoke \
    --id "$TOKEN_ID" \
    --source deployer \
    --network "$NETWORK" \
    -- \
    initialize \
    --admin "$ADMIN_ADDR"

# 5. Deploy Marketplace
echo "📦 Deploying Marketplace..."
MARKET_WASM="target/wasm32-unknown-unknown/release/marketplace.wasm"
MARKET_ID=$(stellar contract deploy \
    --wasm "$MARKET_WASM" \
    --source deployer \
    --network "$NETWORK" \
    --alias marketplace)
echo "✅ Marketplace Deployed: $MARKET_ID"

# 6. Initialize Marketplace
echo "⚙️  Initializing Marketplace..."
stellar contract invoke \
    --id "$MARKET_ID" \
    --source deployer \
    --network "$NETWORK" \
    -- \
    initialize \
    --admin "$ADMIN_ADDR" \
    --token_wasm_hash "$TOKEN_ID"

# 7. Update Backend Config
echo "📝 Updating Backend Configuration..."
ENV_FILE="../backend/.env"

# Function to update or add env var
update_env() {
    local key=$1
    local val=$2
    if grep -q "^$key=" "$ENV_FILE"; then
        sed -i '' "s/^$key=.*/$key=$val/" "$ENV_FILE"
    else
        echo "$key=$val" >> "$ENV_FILE"
    fi
}

# Create .env if not exists
touch "$ENV_FILE"

update_env "MARKETPLACE_CONTRACT_ID" "$MARKET_ID"
update_env "TOKEN_CONTRACT_ID" "$TOKEN_ID"
# Capture private key for backend (from global config)
# Note: 'stellar keys show' shows the secret key
ORACLE_PRIVATE_KEY=$(stellar keys show deployer)
update_env "ORACLE_PRIVATE_KEY" "$ORACLE_PRIVATE_KEY"

echo "✅ Configuration updated in $ENV_FILE"
echo "🎉 Deployment Complete!"
echo "   Token: $TOKEN_ID"
echo "   Market: $MARKET_ID"
