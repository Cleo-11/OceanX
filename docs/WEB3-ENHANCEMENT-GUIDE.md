# AbyssX Web3 Enhancement Guide

**Date:** January 1, 2026  
**Project:** AbyssX / OceanX - Web3 Ocean Mining Game

---

## ✅ Completed Changes

### 1. Authentication - Wallet-Only Sign-In
- **Removed:** Google OAuth, Email/Password authentication UI
- **Deprecated:** `signInWithGoogle()`, `signInWithEmail()`, `signUpWithEmail()` functions (return errors)
- **Kept & Enhanced:** 
  - SIWE (Sign-In with Ethereum) via MetaMask
  - SIWS (Sign-In with Solana) via Phantom
  - Coinbase Wallet support
  - **NEW:** WalletConnect support for mobile wallets

### Files Modified:
- [app/auth/auth-page-client.tsx](../app/auth/auth-page-client.tsx) - Complete rewrite for wallet-only UI
- [lib/supabase.ts](../lib/supabase.ts) - Deprecated Google/email functions with warnings
- [lib/web3auth.ts](../lib/web3auth.ts) - Added WalletConnect support & improved types
- [.env.example](../.env.example) - Added `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- [types/walletconnect.d.ts](../types/walletconnect.d.ts) - Type declarations for WalletConnect

---

## 🔧 To Enable WalletConnect (Mobile Wallet Support)

### Step 1: Install Dependencies
```bash
pnpm add @walletconnect/ethereum-provider @walletconnect/modal
```

### Step 2: Get Project ID
1. Visit https://cloud.walletconnect.com/
2. Create a new project
3. Copy the Project ID

### Step 3: Configure Environment
```bash
# .env.local
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

### Step 4: Test
The WalletConnect button will automatically appear in the auth page when configured.

**Why:** Show human-readable names instead of `0x742d35Cc...`

**Implementation:**
```typescript
import { ethers } from 'ethers'

async function resolveENS(address: string): Promise<string | null> {
  const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_ETH_RPC_URL)
  return await provider.lookupAddress(address)
}

// Display: "vitalik.eth" instead of "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
```

---

### Priority 3: On-Chain Game Achievements (NFTs)

**Why:** Players own their achievements, can trade/display them.

**Smart Contract Pattern:**
```solidity
// contracts/src/AbyssXAchievements.sol
contract AbyssXAchievements is ERC721, Ownable {
    mapping(uint256 => Achievement) public achievements;
    
    struct Achievement {
        string name;
        string imageURI;
        uint256 unlockedAt;
    }
    
    function mintAchievement(address player, uint256 achievementId) external onlyOperator {
        _mint(player, achievementId);
    }
}
```

**Achievement Ideas:**
- "First Dive" - Complete first mining session
- "Deep Explorer" - Reach maximum depth
- "OCX Millionaire" - Earn 1M total OCX
- "Tier 5 Captain" - Max upgrade submarine

---

### Priority 4: Token-Gated Features

**Why:** Reward token holders with exclusive content.

**Implementation:**
```typescript
// lib/token-gate.ts
import { ethers } from 'ethers'

export async function checkTokenBalance(address: string): Promise<bigint> {
  const ocxToken = new ethers.Contract(OCX_TOKEN_ADDRESS, OCX_ABI, provider)
  return await ocxToken.balanceOf(address)
}

export function getPlayerTier(balance: bigint): 'bronze' | 'silver' | 'gold' | 'diamond' {
  if (balance >= ethers.parseEther('1000000')) return 'diamond'
  if (balance >= ethers.parseEther('100000')) return 'gold'
  if (balance >= ethers.parseEther('10000')) return 'silver'
  return 'bronze'
}
```

**Token-Gated Perks:**
| Tier | OCX Required | Benefits |
|------|--------------|----------|
| Bronze | 0 | Basic gameplay |
| Silver | 10,000 | +10% mining speed |
| Gold | 100,000 | Exclusive submarine skin, +20% mining |
| Diamond | 1,000,000 | All perks + early feature access |

---

### Priority 5: Decentralized Leaderboard

**Why:** Trustless, verifiable rankings stored on-chain.

**Smart Contract:**
```solidity
contract AbyssXLeaderboard {
    struct PlayerScore {
        address player;
        uint256 totalMined;
        uint256 timestamp;
    }
    
    PlayerScore[100] public topPlayers;
    
    function submitScore(address player, uint256 score) external onlyGameServer {
        // Insert score in sorted position
    }
}
```

---

### Priority 6: Multi-Chain Support

**Why:** Players on different chains can participate.

**Supported Chains:**
| Chain | Token Contract | Explorer |
|-------|---------------|----------|
| Ethereum | `0x...` | etherscan.io |
| Polygon | `0x...` | polygonscan.com |
| Base | `0x...` | basescan.org |
| Arbitrum | `0x...` | arbiscan.io |

**Implementation:** Use chain detection in wallet connection:
```typescript
const chainId = await provider.getNetwork().then(n => n.chainId)
const supportedChains = [1, 137, 8453, 42161]

if (!supportedChains.includes(Number(chainId))) {
  throw new Error('Please switch to a supported network')
}
```

---

### Priority 7: Gasless Transactions (Meta-Transactions)

**Why:** New players can play without ETH for gas.

**Options:**
1. **OpenZeppelin Defender Relayer** - Backend pays gas
2. **Biconomy** - SDK for gasless UX
3. **Gelato** - Relay network

**Implementation with EIP-2612 Permit:**
```typescript
// Player signs permit, backend submits transaction
const { v, r, s } = await signPermit(player, spender, value, deadline)
await ocxToken.permit(player, spender, value, deadline, v, r, s)
```

---

### Priority 8: DAO Governance (Future)

**Why:** Community-driven game development.

**Token Voting:**
```solidity
// OCX token holders vote on:
// - New submarine tiers
// - Mining zone difficulty
// - Token emission rates

contract AbyssXGovernor is Governor {
    function proposalThreshold() public pure returns (uint256) {
        return 100_000e18; // 100K OCX to propose
    }
}
```

---

## 📦 Recommended Dependencies

```json
{
  "dependencies": {
    "@walletconnect/modal": "^2.x",
    "@walletconnect/ethereum-provider": "^2.x",
    "viem": "^2.x",
    "@wagmi/core": "^2.x",
    "@rainbow-me/rainbowkit": "^2.x"
  }
}
```

---

## 🔐 Security Considerations

1. **Never expose private keys** - All signing happens in wallet
2. **Validate signatures server-side** - Current SIWE implementation ✅
3. **Rate limit claims** - Prevent signature replay abuse ✅
4. **Use nonces** - Current implementation ✅

---

## 🎮 Web3 UX Best Practices

1. **Show wallet address prominently** - With ENS fallback
2. **Display chain network** - Prevent wrong-chain transactions
3. **Transaction confirmations** - Show pending/confirmed states
4. **Gas estimation** - Show expected cost before signing
5. **Error messages** - Translate wallet errors to human-readable

---

## Next Steps

1. [ ] Apply for WalletConnect Cloud Project ID
2. [ ] Implement WalletConnect provider integration
3. [ ] Add ENS resolution for profile display
4. [ ] Design achievement NFT artwork
5. [ ] Deploy achievement contract to testnet
6. [ ] Community vote on token-gated features

---

*This document outlines the Web3 enhancement roadmap for AbyssX. Prioritize based on user feedback and development resources.*
