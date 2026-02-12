#!/bin/bash
# Unix/Mac script to verify UpgradeManager is registered as transferAgent

set -e

echo "========================================"
echo " Verify Transfer Agent Registration"
echo "========================================"
echo ""

if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    exit 1
fi

source .env

echo "Checking if UpgradeManager is registered as transferAgent..."
echo ""
echo "OCXToken: $OCX_TOKEN_ADDRESS"
echo "UpgradeManager: $UPGRADE_MANAGER_ADDRESS"
echo ""

# Call the transferAgents mapping on OCXToken
result=$(cast call $OCX_TOKEN_ADDRESS \
    "transferAgents(address)(bool)" \
    $UPGRADE_MANAGER_ADDRESS \
    --rpc-url $RPC_URL)

echo "Result: $result"
echo ""

if [ "$result" = "true" ]; then
    echo "✅ UpgradeManager IS registered as a transferAgent!"
    echo "   On-chain submarine upgrades will work correctly."
else
    echo "❌ UpgradeManager is NOT registered as a transferAgent!"
    echo "   Please run ./register-agent.sh first."
    exit 1
fi
