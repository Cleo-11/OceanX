# Player Creation Fix - Critical Bug Resolution

## Problem Identified

### Root Cause
The application had a **schema mismatch** between the database and application code:

1. **Database Schema** (`scripts/create-players-table.sql`):
   - Used `wallet_address` as the primary unique identifier
   - Did NOT have a `user_id` column
   - Required wallet_address to be NOT NULL

2. **Application Code** (all pages/components):
   - Assumed `players` table had a `user_id` column
   - Used `.eq("user_id", session.user.id)` for ALL player lookups
   - Never created player rows after authentication—only after wallet linking

3. **The Gap**:
   - User authenticates via Google/Email → Supabase creates `auth.users` row ✅
   - NO player row created → `players` table remains empty ❌
   - User clicks "DIVE DEEP" → app queries `players` WHERE `user_id = ?` → **NOT FOUND** ❌

### Why This Happened
- Original `create-players-table.sql` was designed for wallet-first flow (user = wallet)
- App evolved to use Supabase auth (user = auth.users.id) + wallet linking
- Schema was never migrated to match the new architecture
- Player creation was gated behind wallet linking, not authentication

---

## Solution Implemented

### Migration 004: `004-fix-players-schema-add-user-id.sql`

This migration:
1. ✅ Adds `user_id UUID` column to `players` table
2. ✅ Makes `wallet_address` nullable (users exist before wallet link)
3. ✅ Adds unique constraint on `user_id`
4. ✅ Adds foreign key `user_id → auth.users(id)` with ON DELETE CASCADE
5. ✅ Creates index on `user_id` for fast lookups
6. ✅ Adds missing columns: `username`, `total_resources_mined`, `total_ocx_earned`, `is_active`
7. ✅ **Creates database trigger** to auto-create player rows when auth users are created
8. ✅ Handles idempotency—safe to run multiple times

### Database Trigger: `create_player_for_new_user()`

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_player_for_new_user();
```

**Behavior:**
- Fires automatically when a user signs up via Google/Email
- Creates a `players` row with:
  - `user_id` = new auth user's ID
  - `username` = user's name/email (from metadata)
  - `submarine_tier` = 1 (default)
  - `wallet_address` = NULL (will be filled when wallet is linked)
  - Resource counters = 0

### Code Changes

#### `connect-wallet-client.tsx`
- Added detailed error logging (code, details) for upsert failures
- Added comment clarifying that player row should already exist from trigger
- Upsert still works as fallback for edge cases (legacy users, trigger failures)

---

## How to Apply This Fix

### Step 1: Apply the Migration
Run the migration in your Supabase SQL Editor:

```bash
# Copy the contents of db/migrations/004-fix-players-schema-add-user-id.sql
# Paste into Supabase Dashboard > SQL Editor > New Query
# Run the query
```

**Expected Output:**
```
NOTICE: Added user_id column to players table
NOTICE: Made wallet_address nullable
NOTICE: Added unique constraint on user_id
NOTICE: Added foreign key constraint to auth.users
NOTICE: Verified all required columns exist
NOTICE: Migration complete. Check for any players without user_id and handle manually if needed.
```

### Step 2: Clean Up Existing Data (if needed)

If you have existing auth users WITHOUT player rows:

```sql
-- Check for orphaned auth users
SELECT u.id, u.email, p.user_id 
FROM auth.users u
LEFT JOIN players p ON u.id = p.user_id
WHERE p.user_id IS NULL;

-- Manually create player rows for them (trigger won't fire retroactively)
INSERT INTO players (user_id, username, submarine_tier, total_resources_mined, total_ocx_earned, is_active, last_login)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', SPLIT_PART(u.email, '@', 1), 'Captain'),
  1,
  0,
  0,
  true,
  NOW()
FROM auth.users u
LEFT JOIN players p ON u.id = p.user_id
WHERE p.user_id IS NULL;
```

### Step 3: Test the Flow

1. **Sign Out** (clear existing session)
2. **Sign Up** with a new test account (Google or Email)
3. **Check Database**:
   ```sql
   SELECT * FROM players ORDER BY created_at DESC LIMIT 5;
   ```
   You should see a new row with:
   - `user_id` populated
   - `wallet_address` NULL
   - `submarine_tier` = 1

4. **Navigate to /home** → Should load successfully (no "player not found")
5. **Click "DIVE DEEP"** → Should now work (player row exists)
6. **Link Wallet** → `wallet_address` gets populated

---

## Technical Details

### New Player Lifecycle

**Before Fix:**
```
User Signs Up → auth.users created → NO player row → "player not found" ❌
```

**After Fix:**
```
User Signs Up → auth.users created → TRIGGER fires → players row created ✅
User visits /home → player found (user_id lookup) ✅
User clicks DIVE DEEP → game loads ✅
User links wallet → wallet_address updated ✅
```

### Database Schema (Post-Migration)

```sql
TABLE players (
  id SERIAL PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- NEW
  wallet_address VARCHAR(42) UNIQUE,  -- Now nullable
  username TEXT,
  submarine_tier INTEGER DEFAULT 1,
  total_resources_mined BIGINT DEFAULT 0,
  total_ocx_earned BIGINT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- ... other columns
)
```

### Indexes
- `idx_players_user_id` on `user_id` (fast auth lookups)
- `idx_players_wallet_address` on `wallet_address` (wallet lookups)

---

## Verification Checklist

- [ ] Migration 004 applied successfully
- [ ] Trigger `on_auth_user_created` exists in database
- [ ] Function `create_player_for_new_user()` exists
- [ ] `players` table has `user_id` column with unique constraint
- [ ] `wallet_address` is nullable
- [ ] Foreign key to `auth.users` exists
- [ ] Test user signup creates player row automatically
- [ ] /home page loads without "player not found"
- [ ] /game page loads without errors
- [ ] Wallet linking updates existing player row

---

## Rollback Plan (if needed)

If migration causes issues:

```sql
-- Drop trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.create_player_for_new_user();

-- Remove user_id column (WARNING: destructive)
ALTER TABLE players DROP COLUMN IF EXISTS user_id;

-- Restore wallet_address NOT NULL (if needed)
-- Note: Will fail if any players have NULL wallet_address
ALTER TABLE players ALTER COLUMN wallet_address SET NOT NULL;
```

---

## Future Improvements

1. **Add RLS policies** for `players` table to enforce user-level security
2. **Add updated_at trigger** to auto-update timestamp on row changes
3. **Consider soft deletes** instead of CASCADE (add `deleted_at` column)
4. **Add player stats table** for better data modeling
5. **Add migration version tracking** table

---

## Related Files Modified

- ✅ `db/migrations/004-fix-players-schema-add-user-id.sql` (NEW)
- ✅ `app/connect-wallet/connect-wallet-client.tsx` (enhanced error logging)
- ✅ `db/migrations/PLAYER-CREATION-FIX-README.md` (this file)

---

## Questions?

If you encounter issues:
1. Check Supabase logs for trigger execution
2. Verify auth.users table is accessible to trigger
3. Check RLS policies aren't blocking inserts
4. Ensure SECURITY DEFINER is set on trigger function
