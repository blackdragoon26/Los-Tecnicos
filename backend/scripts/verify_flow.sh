#!/bin/bash

BASE_URL="http://localhost:8080"

echo "🔋 Starting Solar Energy Trading Flow Simulation 🔋"
echo "---------------------------------------------------"

# 1. Create a Sell Order (Seller > 20% Battery)
# Mock data seeds 'user_a' with an ESP32 at 85% battery.
echo "1. Placing Sell Order for User A (Donor)..."
curl -s -X POST "$BASE_URL/api/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_a",
    "type": "sell",
    "kwh_amount": 10,
    "token_price": 0.5
  }' | jq
echo ""

# 2. Create a Buy Order
echo "2. Placing Buy Order for User B (Recipient)..."
curl -s -X POST "$BASE_URL/api/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_b",
    "type": "buy",
    "kwh_amount": 10,
    "token_price": 0.5
  }' | jq
echo ""

# 3. Wait for Matching Engine
echo "⏳ Waiting 6 seconds for Matching Engine to run..."
sleep 6

# 4. Check Transaction Status
echo "3. Checking Transaction Status (Expected: Transaction Created + Yield + ZK Log)..."
# We fetch transactions for User B
curl -s "$BASE_URL/api/transactions?user_id=user_b" | jq
echo ""

echo "✅ Simulation Complete. Check Backend Logs for 'ZK PRIVACY' and 'DEFI YIELD' messages."
