# Testing Mode - Submarine Unlock

## Overview
This document tracks the temporary changes made to enable testing of all submarines without purchase requirements or authentication.

## Current Status
**TESTING MODE: FULLY ENABLED** ✅

All submarines are currently unlocked and available for selection and testing, regardless of:
- Player's current tier
- Resource levels
- Authentication status (can test without login)
- Blockchain wallet connection

## Modified Files

### Client-Side (UI Locks)

#### 1. `components/hangar/SubmarineCard3D.tsx`
- **Line 14**: Added `TESTING_MODE_UNLOCK_ALL = true`
- **Lines 47-54**: Modified `getTierStatus()` to treat all submarines as "available" when testing mode is enabled
- **Lines 268-294**: Modified purchase button to allow clicking any submarine

#### 2. `components/submarine-store.tsx`
- **Line 14**: Added `TESTING_MODE_UNLOCK_ALL = true`
- **Lines 47-54**: Modified `getTierStatus()` to treat all submarines as "available" when testing mode is enabled
- **Lines 160-169**: Modified click handler to allow selecting any submarine
- **Lines 311-323**: Modified purchase button to show "Select (Testing)" and allow clicking
- This component is used as a modal during gameplay for in-game submarine upgrades

#### 3. `components/ocean-mining-game.tsx` ⭐ NEW
- **Line 34**: Added `TESTING_MODE_BYPASS_BLOCKCHAIN = true`
- **Lines 1057-1077**: Modified `executeSubmarineUpgrade()` to bypass blockchain and directly update tier in testing mode
- This handles submarine upgrades from the in-game store modal without requiring wallet connection

### Server-Side (API Locks)

#### 4. `middleware.ts` ⭐ IMPORTANT
- **Line 9**: Added `TESTING_MODE_BYPASS_AUTH = true`
- **Lines 25-28**: Added testing mode bypass that skips ALL authentication checks including route protection
- This allows accessing `/game` and other protected routes without logging in

#### 5. `app/api/hangar/test-upgrade/route.ts` ⭐ NEW
- **Entire file**: New simplified testing endpoint that bypasses all authentication and blockchain verification
- Directly updates submarine tier in database or returns success for client-side handling
- **TODO: DELETE THIS ENTIRE FILE before production deployment**

#### 6. `app/submarine-hangar/page-client.tsx`
- **Line 19**: Added `TESTING_MODE_SIMPLE_API = true`
- **Lines 67-95**: Added testing mode branch that uses simplified `/api/hangar/test-upgrade` endpoint

#### 7. `app/api/hangar/pending/route.ts`
- **Line 9**: Added `TESTING_MODE_BYPASS_AUTH = true`
- **Line 11**: Added `TESTING_MODE_USER_ID` with valid UUID format
- **Lines 20-21**: Modified to bypass authentication check when testing mode is enabled
- **Lines 27-30**: Added dummy user ID for testing mode when no user is authenticated

#### 8. `app/api/hangar/pending/[id]/execute/route.ts`
- **Line 12**: Added `TESTING_MODE_BYPASS_AUTH = true`
- **Line 13**: Added `TESTING_MODE_BYPASS_BLOCKCHAIN = true`
- **Lines 21-22**: Modified to bypass authentication check when testing mode is enabled
- **Lines 27-29**: Modified to bypass user ID validation when testing mode is enabled
- **Lines 40-78**: Added complete testing mode bypass that skips blockchain verification and directly updates player tier

#### 9. `app/api/hangar/pending/[id]/confirm/route.ts`
- **Line 8**: Added `TESTING_MODE_BYPASS_AUTH = true`
- **Lines 13-14**: Modified to bypass authentication check when testing mode is enabled
- **Lines 32-35**: Modified to bypass user ID validation when testing mode is enabled

## How to Re-enable Locks (Production Mode)

To re-enable all locks for production, change these flags to `false`:

### Client-Side Files:
1. `components/hangar/SubmarineCard3D.tsx` - Line 14
   ```typescript
   const TESTING_MODE_UNLOCK_ALL = false
   ```

2. `components/submarine-store.tsx` - Line 14
   ```typescript
   const TESTING_MODE_UNLOCK_ALL = false
   ```

3. `components/ocean-mining-game.tsx` - Line 34
   ```typescript
   const TESTING_MODE_BYPASS_BLOCKCHAIN = false
   ```

### Server-Side Files:

**⚠️ CRITICAL: DELETE THIS FILE:**
4. **DELETE** `app/api/hangar/test-upgrade/route.ts` - Remove the entire file

5. `middleware.ts` - Line 9
   ```typescript
   const TESTING_MODE_BYPASS_AUTH = false
   ```

6. `app/submarine-hangar/page-client.tsx` - Line 19
   ```typescript
   const TESTING_MODE_SIMPLE_API = false
   ```

7. `app/api/hangar/pending/route.ts` - Line 9
   ```typescript
   const TESTING_MODE_BYPASS_AUTH = false
   ```

8. `app/api/hangar/pending/[id]/execute/route.ts` - Lines 12-13
   ```typescript
   const TESTING_MODE_BYPASS_AUTH = false
   const TESTING_MODE_BYPASS_BLOCKCHAIN = false
   ```

9. `app/api/hangar/pending/[id]/confirm/route.ts` - Line 8
   ```typescript
   const TESTING_MODE_BYPASS_AUTH = false
   ```

**Important**: Change all flags to `false` AND delete the test-upgrade route file!

## What You Can Test

With testing mode enabled, you can:

1. ✅ **View all submarines** - Browse through all 15 submarine tiers in the hangar
2. ✅ **Select any submarine** - Click on any submarine to "purchase" it for testing
3. ✅ **Test submarine designs** - Each submarine has unique visual designs that render in the game
4. ✅ **Test speed differences** - Higher tier submarines move faster (speed multiplier increases)
5. ✅ **Test mining capabilities** - Higher tier submarines have better mining rates and storage
6. ✅ **Test stats progression** - Verify that health, energy, depth, and other stats increase per tier

## Testing Checklist

- [ ] Verify each submarine tier (1-15) renders correctly in the hangar
- [ ] Confirm submarine visual design changes for each tier in the game
- [ ] Test that speed increases for higher tier submarines (Tier 1 vs Tier 5 vs Tier 10)
- [ ] Verify mining rate improvements (watch resource collection speed)
- [ ] Check storage capacity increases (view max capacity in HUD)
- [ ] Test special abilities for legendary submarines (Tier 8+)
- [ ] Verify submarine colors render correctly in-game
- [ ] Check that submarine stats display correctly in the HUD

## Important Notes

⚠️ **Remember to disable testing mode before production deployment!**

The locks are not deleted, just bypassed. All the original lock logic remains intact and will work immediately when you set the flags back to `false`.

## Original Lock Behavior

When testing mode is disabled (`TESTING_MODE_UNLOCK_ALL = false`):
- Only Tier 1 submarine is available initially
- Players can only upgrade to the next tier (Tier N → Tier N+1)
- Upgrades require sufficient OCX tokens
- Higher tier submarines are locked until previous tier is purchased
- Visual indicators show locked/available status

