# Ocean Trading Hub - Resource Display Fix

## Problem
The Ocean Trading Hub's "In Stock" resources page was not displaying resources from Supabase tables. Instead, it was falling back to hardcoded mock data when the `marketplace_resources` table didn't exist in the database.

## Solution Implemented

### 1. Created Database Migration
**File**: `db/migrations/012-create-marketplace-resources.sql`

This migration creates the `marketplace_resources` table with:
- Resource definitions (id, name, icon, description)
- Exchange rates (base_ocx_rate)
- Rarity and category classifications
- RLS policies for secure access
- Pre-populated with 4 core resources: Nickel, Cobalt, Copper, Manganese

### 2. Improved Error Handling
**File**: `app/marketplace/marketplace-client.tsx`

Updated the resource loading logic to:
- Fetch player's actual resource amounts from `get_player_resources` RPC first
- Try to fetch marketplace definitions from `marketplace_resources` table
- Gracefully fall back to DEFAULT_MARKETPLACE_RESOURCES if table doesn't exist
- Continue showing player's actual inventory amounts even if table is missing
- Better error logging to diagnose issues

## How Resources Are Displayed

The marketplace now shows:
1. **Resource Definitions**: From `marketplace_resources` table (or defaults)
   - Name, icon, description
   - Exchange rate (OCX per unit)
   - Rarity and category

2. **"In Stock" Amounts**: From player's actual inventory
   - Fetched via `get_player_resources(p_player_id)` RPC
   - Shows nickel, cobalt, copper, manganese quantities
   - This is the amount the PLAYER has available to trade

## Setup Instructions

### Option 1: Using Supabase CLI (Recommended)
```bash
cd /path/to/OceanX-master
chmod +x scripts/setup-marketplace-table.sh
./scripts/setup-marketplace-table.sh
```

### Option 2: Manual SQL Execution
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Open `db/migrations/012-create-marketplace-resources.sql`
4. Copy and paste the entire SQL content
5. Click "Run" to execute

### Option 3: Using Supabase CLI Directly
```bash
supabase db push
```

## Verification

After running the migration, verify it worked:

1. **Check the table exists**:
```sql
SELECT * FROM marketplace_resources;
```
You should see 4 resources: nickel, cobalt, copper, manganese

2. **Test in the app**:
   - Navigate to the Ocean Trading Hub
   - Resources should display with proper names, icons, and exchange rates
   - "In Stock" amounts should match your player's inventory
   - No console errors about missing tables

## What Each Filter Does

- **All Resources**: Shows all 4 mineable resources
- **Price: Low to High**: Sorts by exchange rate (Nickel → Manganese)
- **Price: High to Low**: Sorts by exchange rate (Manganese → Nickel)
- **Most in Stock**: Sorts by player's inventory amount (highest first)

## Technical Details

### Data Flow
```
Player visits marketplace
    ↓
Fetch player's resources: get_player_resources(player_id)
    ↓ (returns: {nickel: 100, cobalt: 50, copper: 25, manganese: 10})
    ↓
Fetch marketplace definitions: SELECT * FROM marketplace_resources
    ↓ (returns: resource metadata, exchange rates, icons)
    ↓
Combine both datasets
    ↓
Display: Resource cards with player's amounts + exchange rates
```

### Fallback Behavior
If `marketplace_resources` table doesn't exist:
- Uses DEFAULT_MARKETPLACE_RESOURCES from `lib/marketplace-utils.ts`
- Still shows player's actual inventory amounts
- Exchange rates from hardcoded defaults (Nickel: 10 OCX, Cobalt: 25 OCX, etc.)

## Files Modified

1. `db/migrations/012-create-marketplace-resources.sql` - New migration file
2. `app/marketplace/marketplace-client.tsx` - Improved error handling
3. `scripts/setup-marketplace-table.sh` - Helper script for easy setup

## Notes

- The "In Stock" amount refers to how many resources the PLAYER has, not marketplace inventory
- Players trade their own mined resources for OCX tokens
- Exchange rates can be updated in the `marketplace_resources` table
- RLS policies ensure read-only access for players, only service_role can modify
