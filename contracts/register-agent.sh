#!/bin/bash
# Unix/Mac script to register UpgradeManager as transferAgent
# Make sure you have set up your .env file first!

set -e

echo "========================================"
echo " Register UpgradeManager as Transfer Agent"
echo "========================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo "Please copy .env.register-agent to .env and fill in your values."
    exit 1
fi

# Load environment variables
source .env

echo "Loading environment from .env..."
echo ""
echo "Owner: $(cast wallet address --private-key $PRIVATE_KEY)"
echo "OCXToken: $OCX_TOKEN_ADDRESS"
echo "UpgradeManager: $UPGRADE_MANAGER_ADDRESS"
echo ""

# Execute the Foundry script
forge script script/RegisterTransferAgent.s.sol:RegisterTransferAgent \
    --rpc-url $RPC_URL \
    --broadcast \
    --legacy

echo ""
echo "✅ Registration successful!"
echo ""
echo "Next step: Run ./verify-agent.sh to confirm registration"
