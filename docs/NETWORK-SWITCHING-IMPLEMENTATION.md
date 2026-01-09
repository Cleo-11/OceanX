# Network Switching Implementation for BASE

## Overview
This implementation enforces that users must be on the BASE network (or Sepolia temporarily) when signing in with MetaMask or other Web3 wallets. If they're on any other network, they will be automatically prompted to switch.

## What Was Implemented

### 1. Chain Configuration (`lib/chain-config.ts`)
Created a centralized configuration file that defines:
- **BASE Mainnet** (Chain ID: 8453)
- **BASE Sepolia** (Chain ID: 84532) - Current testnet
- **Ethereum Sepolia** (Chain ID: 11155111) - Temporary support, will be removed later

The configuration includes:
- Chain IDs (decimal and hex formats)
- Network names
- RPC URLs
- Block explorers
- Native currency details

**Key Functions:**
- `getPrimaryChain()` - Returns the primary chain based on environment variable
- `isChainAllowed()` - Checks if a chain ID is in the allowed list
- `getChainConfig()` - Gets configuration for a specific chain
- `getChainName()` - Returns user-friendly chain name

### 2. Enhanced WalletManager (`lib/wallet.ts`)
Extended the WalletManager class with network detection and switching capabilities:

**New Methods:**
- `getCurrentChainId()` - Detects the current network from MetaMask
- `isOnAllowedNetwork()` - Checks if current network is BASE or Sepolia
- `switchNetwork()` - Prompts user to switch to a specific network
  - Attempts to switch using `wallet_switchEthereumChain`
  - If network not added, automatically adds it using `wallet_addEthereumChain`
- `ensureAllowedNetwork()` - Enforces network requirement before connection
  - Checks current network
  - If not allowed, prompts switch to primary chain
  - Verifies successful switch

**Updated `connectWallet()` Method:**
- Now calls `ensureAllowedNetwork()` before completing connection
- Includes chainId in the WalletConnection object
- Better error handling with specific error messages

### 3. Authentication Flow Update (`lib/web3auth.ts`)
Updated the `signInWithEthereum()` function to check network before signing in:

**Changes:**
- Imports WalletManager
- Requests account access first
- Calls `ensureAllowedNetwork()` to enforce network requirement
- Provides clear error messages if network switch fails
- Continues with signature flow only if on correct network

### 4. Network Status Component (`components/network-status.tsx`)
Created a visual component that displays network status and allows manual switching:

**Features:**
- Shows green checkmark when on correct network (BASE or Sepolia)
- Shows yellow warning when on wrong network
- Displays current network name
- Provides "Switch Network" button for quick switching
- Listens to MetaMask's `chainChanged` event for real-time updates
- Loading state while switching networks
- Error handling with user-friendly messages

### 5. Auth Page Integration (`app/auth/auth-page-client.tsx`)
Added NetworkStatus component to the authentication page:
- Displays below the BASE network badge
- Only shows when MetaMask is available
- Gives users visibility before they attempt to sign in
- Prevents confusion about network requirements

### 6. Environment Configuration (`.env.local`)
Updated environment variables:
- `NEXT_PUBLIC_USE_BASE_MAINNET=false` - Controls which BASE network to use
- `NEXT_PUBLIC_CHAIN_ID=84532` - Updated to BASE Sepolia
- `NEXT_PUBLIC_NETWORK_NAME=BASE Sepolia` - Updated network name
- `NEXT_PUBLIC_RPC_URL=https://sepolia.base.org` - BASE Sepolia RPC URL

### 7. Type Definitions (`types/window.d.ts`)
Created TypeScript definitions for MetaMask/Ethereum provider:
- EthereumProvider interface
- window.ethereum types
- Proper typing for provider methods

## How It Works

### User Flow:
1. User visits auth page
2. NetworkStatus component checks current network
3. If on wrong network:
   - Yellow warning appears
   - User sees current network name
   - "Switch Network" button is displayed
4. User clicks "Connect with MetaMask"
5. MetaMask prompts for account access
6. `ensureAllowedNetwork()` checks the network
7. If wrong network:
   - MetaMask prompts to switch network
   - If network not in wallet, MetaMask prompts to add it
8. Once on correct network, signature flow proceeds
9. User signs message and authenticates

### Network Switching Process:
```
Current Network Check
       ↓
  Is BASE or Sepolia?
       ↓
   YES → Proceed
       ↓
    NO → Try Switch
       ↓
  Switch Successful?
       ↓
   YES → Proceed
       ↓
    NO → Show Error
```

## Configuration

### To Switch to BASE Mainnet (Production):
1. Update `.env.local`:
   ```
   NEXT_PUBLIC_USE_BASE_MAINNET=true
   NEXT_PUBLIC_CHAIN_ID=8453
   NEXT_PUBLIC_NETWORK_NAME=BASE Mainnet
   NEXT_PUBLIC_RPC_URL=https://mainnet.base.org
   ```

### To Remove Sepolia Support Later:
1. Open `lib/chain-config.ts`
2. Remove `CHAINS.SEPOLIA.chainId` from `ALLOWED_CHAIN_IDS` array:
   ```typescript
   export const ALLOWED_CHAIN_IDS = [
     CHAINS.BASE_MAINNET.chainId,
     CHAINS.BASE_SEPOLIA.chainId,
     // Remove this line:
     // CHAINS.SEPOLIA.chainId,
   ]
   ```

## Error Handling

The implementation includes comprehensive error handling:
- Network not detected
- User rejects network switch
- Network not in wallet (automatically adds it)
- Network switch fails after multiple attempts
- MetaMask not installed

All errors provide clear, user-friendly messages.

## Testing

To test the implementation:
1. Install MetaMask if not already installed
2. Switch MetaMask to a different network (e.g., Ethereum Mainnet)
3. Visit the auth page
4. Observe the yellow warning showing wrong network
5. Click "Switch Network" or "Connect with MetaMask"
6. Follow MetaMask prompts to switch networks
7. Verify that you're now on BASE Sepolia (or the configured network)
8. Complete the sign-in process

## Benefits

✅ **User Experience**: Clear feedback about network requirements
✅ **Security**: Ensures all transactions happen on the correct network
✅ **Automation**: Automatically prompts network switch when needed
✅ **Flexibility**: Easy to switch between BASE Mainnet and Sepolia
✅ **Future-Ready**: Can easily remove Sepolia support later
✅ **Type Safety**: Full TypeScript support with proper types

## Notes

- The implementation is non-blocking - users can still see what network they're on even if MetaMask isn't connected
- Network changes are detected in real-time via event listeners
- The system works with both MetaMask and Coinbase Wallet
- All network configurations are centralized for easy maintenance
