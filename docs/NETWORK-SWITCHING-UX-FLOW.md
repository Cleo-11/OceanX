# Network Switching - User Experience Flow

## Visual Examples

### Scenario 1: User on Correct Network (BASE Sepolia)
```
┌─────────────────────────────────────────────────────────┐
│  🔵 Powered by BASE Sepolia                             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ✓ Connected to BASE Sepolia                            │
│  [Green background, shows user is good to go]           │
│                                                          │
│  [🦊 MetaMask] ← User can click to sign in              │
│  [🔵 Coinbase Wallet]                                    │
│  [🔗 WalletConnect]                                      │
└─────────────────────────────────────────────────────────┘
```

### Scenario 2: User on Wrong Network (e.g., Ethereum Mainnet)
```
┌─────────────────────────────────────────────────────────┐
│  🔵 Powered by BASE Sepolia                             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ⚠️ Wrong Network                                        │
│  You're on Ethereum Mainnet. Please switch to           │
│  BASE Sepolia.                [Switch Network]          │
│  [Yellow background, clearly indicates action needed]   │
│                                                          │
│  [🦊 MetaMask] ← Can still click, will prompt switch    │
│  [🔵 Coinbase Wallet]                                    │
│  [🔗 WalletConnect]                                      │
└─────────────────────────────────────────────────────────┘
```

### Scenario 3: User Clicks "Connect with MetaMask" on Wrong Network
```
Step 1: MetaMask popup appears
┌────────────────────────────────┐
│  MetaMask                    × │
├────────────────────────────────┤
│  Select an account             │
│                                │
│  ⚬ Account 1                   │
│    0x1234...5678               │
│                                │
│        [Next] [Cancel]         │
└────────────────────────────────┘

Step 2: Network switch prompt appears
┌────────────────────────────────┐
│  MetaMask                    × │
├────────────────────────────────┤
│  Allow this site to switch     │
│  the network?                  │
│                                │
│  Switch to BASE Sepolia        │
│                                │
│    [Cancel] [Approve]          │
└────────────────────────────────┘

Step 3: If network not in wallet, add network prompt
┌────────────────────────────────┐
│  MetaMask                    × │
├────────────────────────────────┤
│  Allow this site to add a      │
│  network?                      │
│                                │
│  Network Name: BASE Sepolia    │
│  Chain ID: 84532               │
│  RPC: https://sepolia.base.org │
│                                │
│    [Cancel] [Approve]          │
└────────────────────────────────┘

Step 4: User approves, network switches, signature request appears
┌────────────────────────────────┐
│  MetaMask                    × │
├────────────────────────────────┤
│  Signature Request             │
│                                │
│  Sign in to AbyssX with your   │
│  Ethereum wallet               │
│                                │
│    [Cancel] [Sign]             │
└────────────────────────────────┘
```

## User Journey Map

```
START
  │
  ├─→ User visits /auth page
  │
  ├─→ NetworkStatus component checks current network
  │
  ├─→ Is on BASE or Sepolia?
  │   │
  │   ├─ YES → Green checkmark displayed
  │   │         "Connected to BASE Sepolia"
  │   │         User can sign in directly
  │   │
  │   └─ NO  → Yellow warning displayed
  │             "Wrong Network - You're on [Current Network]"
  │             "Switch Network" button shown
  │
  ├─→ User clicks "Connect with MetaMask"
  │
  ├─→ ensureAllowedNetwork() executes
  │
  ├─→ Is on allowed network?
  │   │
  │   ├─ YES → Proceed to signature
  │   │
  │   └─ NO  → Automatic switch prompt
  │             │
  │             ├─→ MetaMask prompts user to switch
  │             │
  │             ├─→ User approves switch
  │             │
  │             ├─→ Verify switch successful
  │             │
  │             └─→ Proceed to signature
  │
  ├─→ User signs message
  │
  ├─→ Authentication complete
  │
  └─→ Redirect to /home or /onboarding
```

## Error States

### Network Switch Declined by User
```
┌─────────────────────────────────────────────────────────┐
│  ❌ Authentication Error                                 │
│                                                          │
│  Please switch to BASE or Sepolia network to continue   │
│                                                          │
│  [Red background alert]                                 │
└─────────────────────────────────────────────────────────┘
```

### MetaMask Not Installed
```
┌─────────────────────────────────────────────────────────┐
│  No wallet detected. Install one of these to continue:  │
│                                                          │
│  [MetaMask 🔗]  [Coinbase 🔗]                            │
└─────────────────────────────────────────────────────────┘
```

### Network Switch Failed
```
┌─────────────────────────────────────────────────────────┐
│  ⚠️ Network Switch Failed                                │
│                                                          │
│  Please manually switch to BASE or Sepolia in your      │
│  wallet and try again.                                  │
│                                                          │
│  [Yellow background alert with instructions]            │
└─────────────────────────────────────────────────────────┘
```

## Real-Time Network Detection

The NetworkStatus component listens for network changes:

```
User switches network in MetaMask
         ↓
'chainChanged' event fires
         ↓
NetworkStatus updates display
         ↓
Shows correct status (green checkmark or yellow warning)
```

## Mobile Experience (WalletConnect)

```
1. User scans QR code with mobile wallet
2. Wallet app opens and checks network
3. If wrong network, wallet prompts to switch
4. User approves in mobile wallet
5. Connection established on correct network
6. User signs message in mobile wallet
7. Authentication complete
```

## Key Features

✅ **Proactive Network Detection**: Shows status before user attempts to sign in
✅ **One-Click Switch**: "Switch Network" button for manual switching
✅ **Automatic Network Addition**: If network not in wallet, automatically adds it
✅ **Real-Time Updates**: Instantly reflects network changes
✅ **Clear Visual Feedback**: Green for success, yellow for warning, red for errors
✅ **Non-Blocking**: Users can see requirements even if not connected
✅ **Multi-Wallet Support**: Works with MetaMask, Coinbase Wallet, and WalletConnect

## Configuration Examples

### Development (Current Setup)
- Primary: BASE Sepolia (testnet)
- Fallback: Ethereum Sepolia (temporary)
- Auto-switch target: BASE Sepolia

### Production (Future Setup)
- Primary: BASE Mainnet
- Fallback: BASE Sepolia (optional)
- Auto-switch target: BASE Mainnet

Users will see:
```
"🔵 Powered by BASE Mainnet"
```

Instead of:
```
"🔵 Powered by BASE Sepolia"
```
