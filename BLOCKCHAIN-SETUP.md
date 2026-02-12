# Blockchain Setup Guide

This guide will help you register the UpgradeManager as a transferAgent on the OCXToken contract, which is required for on-chain submarine upgrades to work.

## Prerequisites

1. **Foundry installed**: Make sure you have Foundry (forge, cast) installed
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

2. **Deployed contracts**: You must have already deployed:
   - OCXToken contract
   - UpgradeManager contract

3. **Owner wallet**: You need the private key of the OCXToken owner wallet

## Step-by-Step Instructions

### 1. Navigate to contracts directory

```bash
cd contracts
```

### 2. Set up environment variables

Copy the template and fill in your values:

```bash
# Copy template
cp .env.register-agent .env

# Edit .env with your values
# On Windows: notepad .env
# On Mac/Linux: nano .env
```

Required environment variables:
- `PRIVATE_KEY`: Private key of the OCXToken owner wallet
- `RPC_URL`: Your blockchain RPC endpoint (e.g., Infura, Alchemy)
- `OCX_TOKEN_ADDRESS`: Address of your deployed OCXToken contract
- `UPGRADE_MANAGER_ADDRESS`: Address of your deployed UpgradeManager contract

Example `.env`:
```bash
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
OCX_TOKEN_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
UPGRADE_MANAGER_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
```

### 3. Register the UpgradeManager

**On Windows:**
```cmd
register-agent.bat
```

**On Mac/Linux:**
```bash
chmod +x register-agent.sh
./register-agent.sh
```

**Or manually with forge:**
```bash
forge script script/RegisterTransferAgent.s.sol:RegisterTransferAgent \
    --rpc-url $RPC_URL \
    --broadcast \
    --legacy
```

### 4. Verify the registration

**On Windows:**
```cmd
verify-agent.bat
```

**On Mac/Linux:**
```bash
chmod +x verify-agent.sh
./verify-agent.sh
```

**Or manually with cast:**
```bash
cast call $OCX_TOKEN_ADDRESS \
    "transferAgents(address)(bool)" \
    $UPGRADE_MANAGER_ADDRESS \
    --rpc-url $RPC_URL
```

If the result is `true`, the registration was successful! ✅

## Troubleshooting

### Error: "Ownable: caller is not the owner"
- Make sure the PRIVATE_KEY in your .env is the OCXToken owner's private key
- Verify with: `cast call $OCX_TOKEN_ADDRESS "owner()" --rpc-url $RPC_URL`

### Error: "insufficient funds for gas"
- Your wallet needs ETH (or testnet ETH) to pay for gas
- Get testnet ETH from: https://sepoliafaucet.com/

### Error: "nonce too low"
- Your transaction nonce is out of sync
- Wait a few minutes and try again, or use `--skip-simulation` flag

### Error: "OCX_TOKEN_ADDRESS not set"
- Make sure your .env file is in the contracts/ directory
- Check that all required variables are set (no spaces around `=`)

## What This Does

The `setTransferAgent(address, bool)` function on OCXToken allows the specified address (UpgradeManager) to bypass the "transfers disabled" restriction. This enables:

1. Players can approve OCX tokens to the UpgradeManager
2. UpgradeManager can transfer tokens from player to treasury
3. On-chain submarine upgrades work correctly
4. No "Transfers are disabled" errors

## After Registration

Once registered, test the on-chain upgrade flow:

1. Get OCX tokens in your wallet
2. Navigate to submarine store/hangar in the game
3. Try to upgrade your submarine with on-chain payment
4. The transaction should succeed without "Transfers are disabled" error

## Manual Verification (Alternative Method)

You can also verify on Etherscan:

1. Go to your OCXToken address on Etherscan
2. Click "Read Contract"
3. Find the `transferAgents` function
4. Enter your UpgradeManager address
5. Click "Query"
6. Result should be `true`

## Need Help?

- Check Foundry docs: https://book.getfoundry.sh/
- Verify your contract addresses are correct
- Make sure you're on the right network (Sepolia, mainnet, etc.)
- Check that your RPC_URL is working: `cast block-number --rpc-url $RPC_URL`
