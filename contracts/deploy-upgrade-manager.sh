#!/bin/bash
# Deploy UpgradeManager Contract

set -e

echo "========================================"
echo " Deploy UpgradeManager Contract"
echo "========================================"
echo ""
echo "This will:"
echo " 1. Deploy UpgradeManager contract"
echo " 2. Automatically register it as transferAgent on OCXToken"
echo " 3. Treasury address: OCX Token (tokens will be burned)"
echo ""

cd "$(dirname "$0")"

if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo "Please make sure .env exists in the contracts folder."
    exit 1
fi

source .env

echo "Configuration:"
echo " OCX Token: 0x0d30a0d0d4de399ed862d0509817ade64b7d2ea9"
echo " Treasury:  0x0d30a0d0d4de399ed862d0509817ade64b7d2ea9 (same as token - burns tokens)"
echo ""
read -p "Press Enter to start deployment..."

echo ""
echo "Deploying UpgradeManager..."
echo ""

forge script script/DeployUpgradeManager.s.sol:DeployUpgradeManager \
    --rpc-url $RPC_URL \
    --broadcast \
    --legacy \
    -vvv

echo ""
echo "✅ Deployment successful!"
echo ""
echo "========================================"
echo " NEXT STEPS"
echo "========================================"
echo ""
echo "1. Copy the UpgradeManager address from output above"
echo ""
echo "2. Add it to your .env file:"
echo "   UPGRADE_MANAGER_ADDRESS=0x..."
echo ""
echo "3. Verify the registration worked:"
echo "   ./verify-agent.sh"
echo ""
echo "4. Update your backend/frontend .env with:"
echo "   UPGRADE_MANAGER_ADDRESS=0x..."
echo ""
