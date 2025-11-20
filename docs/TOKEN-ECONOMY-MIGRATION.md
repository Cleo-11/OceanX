# Token-Only Economy Migration

## Overview
This document outlines the migration from a hybrid resource + token economy to a **token-only economy** for submarine upgrades and purchases.

## What Changed

### 1. Smart Contracts (Already Token-Only) ✅
**File:** `contracts/src/UpgradeManager.sol`
- Contract already uses OCX tokens exclusively
- No resource requirements in smart contract logic
- Token costs defined per tier (100-9000 OCX)

### 2. Frontend - Submarine Tier Definitions
**File:** `lib/submarine-tiers.ts`

**Before:**
```typescript
upgradeCost: {
  nickel: 80,
  cobalt: 40,
  copper: 40,
  manganese: 20,
  tokens: 100
}
```

**After:**
```typescript
upgradeCost: {
  tokens: 100
}
```

All 15 submarine tiers updated to use token-only costs.

### 3. Frontend - Resource Utilities
**File:** `lib/resource-utils.ts`

**Function:** `hasEnoughResourcesForUpgrade()`
- **Before:** Checked nickel, cobalt, copper, manganese AND tokens
- **After:** Only checks token balance

**Function:** `deductResourcesForUpgrade()`
- **Before:** Deducted all resources + tokens
- **After:** Only deducts tokens, resources remain unchanged

### 4. Frontend - Submarine Store UI
**File:** `components/submarine-store.tsx`

**Changes:**
- Removed resource balance display (Ni, Co, Cu, Mn) from header
- Now shows only: **💰 {balance} OCE**
- Upgrade cost section shows only token requirement
- Removed 5-column grid showing all resources
- Now displays single centered token cost

### 5. Frontend - Upgrade Modal
**File:** `components/upgrade-modal.tsx`

**Changes:**
- Removed 5-panel resource cost display
- Now shows single centered panel with token cost
- Larger, more prominent token display
- Simplified validation (token-only)

### 6. Frontend - API Types
**File:** `lib/api.ts`

**Before:**
```typescript
upgradeCost?: PlayerResources & { tokens: number }
```

**After:**
```typescript
upgradeCost?: { tokens: number }
```

### 7. Backend - Server Logic
**File:** `server/index.js`

**Changes:**
1. Updated all 15 `SUBMARINE_TIERS` definitions to use `upgradeCost: { tokens: X }`
2. Modified upgrade endpoint logic:
   - **Before:** `const upgradeCost = (currentTier + 1) * 100`
   - **After:** `const upgradeCost = tierDefinition.upgradeCost?.tokens ?? 0`
3. Now reads token cost from tier definition instead of formula

## Token Cost Structure

| Tier | Submarine Name | Token Cost (OCE) |
|------|----------------|------------------|
| 1 → 2 | Nautilus I → II | 100 |
| 2 → 3 | Nautilus II → Abyssal Explorer | 200 |
| 3 → 4 | Abyssal Explorer → Mariana Miner | 350 |
| 4 → 5 | Mariana Miner → Hydrothermal Hunter | 500 |
| 5 → 6 | Hydrothermal Hunter → Pressure Pioneer | 750 |
| 6 → 7 | Pressure Pioneer → Quantum Diver | 1,000 |
| 7 → 8 | Quantum Diver → Titan Voyager | 1,500 |
| 8 → 9 | Titan Voyager → Oceanic Behemoth | 2,000 |
| 9 → 10 | Oceanic Behemoth → Abyssal Fortress | 2,750 |
| 10 → 11 | Abyssal Fortress → Kraken's Bane | 3,500 |
| 11 → 12 | Kraken's Bane → Void Walker | 4,500 |
| 12 → 13 | Void Walker → Stellar Harvester | 6,000 |
| 13 → 14 | Stellar Harvester → Cosmic Dreadnought | 7,500 |
| 14 → 15 | Cosmic Dreadnought → Leviathan | 9,000 |
| 15 | Leviathan (Max Tier) | 0 (Already max) |

## What Stayed The Same

### Resource Mining System
- Resources (nickel, cobalt, copper, manganese) are still mined
- Submarines still have storage capacity for resources
- Resources are still traded for tokens via the daily trade system
- Resource nodes still exist in the game world

### Display Elements
- Resource capacity stats shown in submarine details (for mining)
- Player HUD still shows resource storage
- Resource nodes still render on ocean floor

## Migration Flow

### Upgrade Process (Token-Only)
1. Player clicks "Upgrade" button
2. Frontend checks: `balance >= upgradeCost.tokens`
3. If sufficient, smart contract called: `upgradeSubmarine(targetTier)`
4. Smart contract deducts OCX tokens from player
5. Backend updates player tier in database
6. Frontend reflects new tier and reduced token balance

### No Resource Deduction
- Resources are NOT consumed during upgrades
- Resources only used for:
  - Trading to earn tokens (daily trade)
  - Display/progression tracking
  - Future feature expansion

## Benefits of Token-Only Economy

1. **Simplified UX**: Single currency for all upgrades
2. **Blockchain Integration**: Tokens live on-chain, resources are off-chain
3. **Clearer Progression**: Players focus on earning tokens
4. **Flexible Economy**: Easier to balance costs
5. **Trading Incentive**: Resources → Tokens via daily trade

## Testing Checklist

- [ ] Verify submarine store shows only token costs
- [ ] Verify upgrade modal shows only token costs  
- [ ] Test upgrade with sufficient tokens
- [ ] Test upgrade with insufficient tokens (should fail)
- [ ] Verify smart contract deducts correct token amount
- [ ] Verify backend uses correct token costs per tier
- [ ] Confirm resources are NOT deducted on upgrade
- [ ] Verify resource mining still works
- [ ] Verify daily trading still works

## Backward Compatibility

⚠️ **Breaking Change**: This migration removes resource requirements for upgrades. Existing players with resources but insufficient tokens may need to:
1. Use daily trade to convert resources → tokens
2. Mine more resources to trade
3. Purchase tokens directly (if applicable)

## Files Modified

### Smart Contracts
- ✅ `contracts/src/UpgradeManager.sol` (Already token-only)

### Frontend
- ✅ `lib/submarine-tiers.ts` - Tier definitions
- ✅ `lib/resource-utils.ts` - Utility functions
- ✅ `lib/api.ts` - Type definitions
- ✅ `components/submarine-store.tsx` - Store UI
- ✅ `components/upgrade-modal.tsx` - Upgrade UI

### Backend
- ✅ `server/index.js` - Server logic and tier definitions

---

**Migration Date:** December 2024  
**Status:** ✅ Complete  
**Economy Model:** Token-Only
