# 🔄 Authentication Flow Migration Guide

**Purpose**: Fix player record creation inconsistencies and implement database trigger for auto-creation.

**Impact**: Simplifies auth flow, eliminates race conditions, ensures every auth user has a player record.

**Estimated Time**: 30-45 minutes

**Risk Level**: Medium (requires database changes + code updates)

---

## 📋 Pre-Migration Checklist

- [ ] **Backup your database** (Supabase Dashboard → Database → Backups)
- [ ] **Test on staging first** (if you have a staging environment)
- [ ] **Have service role key ready** (for testing service role operations)
- [ ] **Note current player count**: Run `SELECT COUNT(*) FROM players;` and save result
- [ ] **Commit all current changes**: `git add -A && git commit -m "chore: pre-migration checkpoint"`

---

## 🗂️ Migration Steps

### Step 1: Create Database Trigger (5 minutes)

**Purpose**: Auto-create player records when auth users are created.

**Action**: Run in Supabase SQL Editor

```sql
-- ===========================================
-- MIGRATION: Add auto-create player trigger
-- Date: 2026-01-06
-- ===========================================

-- Function to auto-create player record on auth user creation
CREATE OR REPLACE FUNCTION public.create_player_for_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  wallet_addr TEXT;
  player_username TEXT;
BEGIN
  -- Extract wallet address from user metadata (lowercase)
  wallet_addr := LOWER(NEW.raw_user_meta_data->>'wallet_address');
  
  -- Generate username from metadata or email
  player_username := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NULLIF(SPLIT_PART(NEW.email, '@', 1), ''),
    'Captain-' || SUBSTRING(NEW.id::text, 1, 8)
  );
  
  -- Insert player record with data from auth metadata
  INSERT INTO public.players (
    user_id, 
    wallet_address,
    username, 
    submarine_tier, 
    coins,
    nickel,
    cobalt,
    copper,
    manganese,
    total_resources_mined, 
    total_ocx_earned, 
    is_active,
    last_login,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    wallet_addr,
    player_username,
    1,   -- submarine_tier
    0,   -- coins
    0,   -- nickel
    0,   -- cobalt
    0,   -- copper
    0,   -- manganese
    0,   -- total_resources_mined
    0,   -- total_ocx_earned
    true, -- is_active
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    wallet_address = COALESCE(EXCLUDED.wallet_address, players.wallet_address),
    last_login = NOW(),
    updated_at = NOW();
  
  RAISE NOTICE 'Player record created/updated for user_id: %, wallet: %', NEW.id, wallet_addr;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_player_for_new_user();

-- Verify trigger was created
SELECT 
  tgname AS trigger_name,
  tgtype,
  tgenabled,
  proname AS function_name
FROM pg_trigger
JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid
WHERE tgname = 'on_auth_user_created';

-- Expected output: 1 row showing trigger is enabled
```

**Verification**:
```sql
-- Check trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- Should return 1 row with tgenabled = 'O' (enabled)
```

---

### Step 2: Backfill Missing Player Records (10 minutes)

**Purpose**: Create player records for any auth users that don't have one.

**Action**: Run in Supabase SQL Editor

```sql
-- ===========================================
-- BACKFILL: Create player records for existing auth users
-- ===========================================

-- Preview: Check how many auth users are missing player records
SELECT COUNT(*) AS missing_players
FROM auth.users u
LEFT JOIN public.players p ON u.id = p.user_id
WHERE p.user_id IS NULL;

-- Backfill missing player records
INSERT INTO public.players (
  user_id,
  wallet_address,
  username,
  submarine_tier,
  coins,
  nickel,
  cobalt,
  copper,
  manganese,
  total_resources_mined,
  total_ocx_earned,
  is_active,
  last_login,
  created_at,
  updated_at
)
SELECT 
  u.id AS user_id,
  LOWER(u.raw_user_meta_data->>'wallet_address') AS wallet_address,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    NULLIF(SPLIT_PART(u.email, '@', 1), ''),
    'Captain-' || SUBSTRING(u.id::text, 1, 8)
  ) AS username,
  1 AS submarine_tier,
  0 AS coins,
  0 AS nickel,
  0 AS cobalt,
  0 AS copper,
  0 AS manganese,
  0 AS total_resources_mined,
  0 AS total_ocx_earned,
  true AS is_active,
  u.created_at AS last_login,
  u.created_at AS created_at,
  NOW() AS updated_at
FROM auth.users u
LEFT JOIN public.players p ON u.id = p.user_id
WHERE p.user_id IS NULL;

-- Verify backfill
SELECT 
  COUNT(u.id) AS total_auth_users,
  COUNT(p.user_id) AS players_with_auth,
  COUNT(u.id) - COUNT(p.user_id) AS still_missing
FROM auth.users u
LEFT JOIN public.players p ON u.id = p.user_id;

-- Expected: still_missing = 0
```

**Verification**:
```sql
-- All auth users should have player records
SELECT 
  u.id,
  u.email,
  p.id AS player_id,
  p.wallet_address,
  p.username
FROM auth.users u
LEFT JOIN public.players p ON u.id = p.user_id
ORDER BY u.created_at DESC
LIMIT 10;

-- Every row should have player_id populated
```

---

### Step 3: Update API Routes (15 minutes)

#### 3A: Delete `/api/player/ensure/route.ts`

**Purpose**: No longer needed - trigger handles player creation

```bash
cd "c:\Users\cleon\Desktop\AbyssX\OceanX-master"
git rm app/api/player/ensure/route.ts
```

#### 3B: Update `/app/game/page.tsx`

Remove player creation logic, enforce player MUST exist:

**File**: `app/game/page.tsx`

**Replace lines 36-84** with:

```typescript
  console.info("[game/page] Session found for user:", {
    userId: session.user.id,
    email: session.user.email,
  })

  // Load player data using service role (more reliable)
  const { data: playerData, error: playerError } = await supabaseAdmin
    .from("players")
    .select("wallet_address, nickel, cobalt, copper, manganese")
    .eq("user_id", session.user.id)
    .single()

  if (playerError || !playerData) {
    console.error("[game/page] Player not found:", playerError)
    // Player MUST exist due to trigger - if missing, force re-auth
    redirect("/auth")
  }

  console.info("[game/page] Player data loaded:", {
    userId: session.user.id,
    hasPlayerData: true,
    hasWallet: !!playerData?.wallet_address,
  })
```

#### 3C: Update `/app/home/page.tsx`

Remove fallback logic, enforce player MUST exist:

**File**: `app/home/page.tsx`

**Replace lines 30-77** with:

```typescript
  if (!session) {
    console.warn("[home/page] No session, redirecting to /auth")
    redirect("/auth")
  }

  const { data: playerRecord, error: playerError } = await supabase
    .from("players")
    .select("*")
    .eq("user_id", session.user.id)
    .single()

  if (playerError || !playerRecord) {
    console.error("[home/page] Player not found:", {
      userId: session.user.id,
      error: playerError?.message,
      code: playerError?.code,
    })
    // Player MUST exist due to trigger - if missing, force re-auth
    redirect("/auth")
  }

  console.info("[home/page] Player record loaded:", {
    userId: session.user.id,
    username: playerRecord.username,
    hasWalletAddress: !!playerRecord.wallet_address,
    walletAddress: playerRecord.wallet_address?.slice(0, 10) + "...",
  })

  return (
    <HomePageClient
      playerData={{
        id: playerRecord.id,
        user_id: playerRecord.user_id,
        wallet_address: playerRecord.wallet_address,
        username: playerRecord.username,
        submarine_tier: playerRecord.submarine_tier,
        total_resources_mined: playerRecord.total_resources_mined,
        total_ocx_earned: playerRecord.total_ocx_earned,
        last_login: playerRecord.last_login,
      }}
    />
  )
```

#### 3D: Simplify `/app/api/auth/siwe/route.ts`

Remove player creation block (lines 400-520):

**File**: `app/api/auth/siwe/route.ts`

**Find the section starting at line 400** (after auth user creation):

```typescript
      // Create player record if missing, reconcile duplicates if constraints hit
      const lowerWallet = address.toLowerCase()
      console.log('📝 Ensuring player record for wallet:', lowerWallet)

      // ... 120+ lines of player creation logic ...
```

**Replace with**:

```typescript
      // Player record is auto-created by database trigger
      // Just sign in to create session
      console.log('🔐 Creating session via sign-in...')
      const { client: supabaseNewUser, getCookies: getNewUserCookies } = getSupabaseWithCookies(request)
      const { data: signInData, error: signInError } = await supabaseNewUser.auth.signInWithPassword({
        email,
        password: stablePassword,
      })

      if (signInError || !signInData.session) {
        console.error('Sign in error after creation:', signInError)
        return NextResponse.json(
          { error: 'Failed to create session' },
          { status: 500 }
        )
      }

      console.log('✅ Session created successfully')

      const response = NextResponse.json({
        success: true,
        isNewUser: !isRecoveredUser,
        session: signInData.session,
        user: signInData.user,
        address: address.toLowerCase()
      })
      
      // Apply cookies from Supabase auth
      const cookies = getNewUserCookies()
      Object.entries(cookies).forEach(([name, value]) => {
        response.cookies.set(name, value, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' })
      })
      return response
```

---

### Step 4: Build and Test Locally (10 minutes)

```bash
cd "c:\Users\cleon\Desktop\AbyssX\OceanX-master"

# Build to check for errors
pnpm run build

# Start dev server
pnpm dev
```

**Test Cases**:

1. **New User Sign Up**
   - [ ] Open http://localhost:3000/auth
   - [ ] Connect wallet and sign SIWE message
   - [ ] Verify redirect to /home
   - [ ] Check console: should see "Player record loaded" with wallet
   - [ ] Verify database: `SELECT * FROM players WHERE wallet_address = '<your-wallet>'`

2. **Existing User Sign In**
   - [ ] Clear cookies/disconnect wallet
   - [ ] Visit /auth and reconnect same wallet
   - [ ] Should load existing player record
   - [ ] Verify no duplicate players created

3. **Game Access**
   - [ ] From /home, click "Dive Deep"
   - [ ] Should navigate to /game without errors
   - [ ] Check console: should see "Player data loaded"

4. **Protected Routes**
   - [ ] Visit /marketplace, /profile, /submarine-hangar
   - [ ] All should load player data without fallbacks

---

### Step 5: Commit Changes

```bash
cd "c:\Users\cleon\Desktop\AbyssX\OceanX-master"

git add -A
git commit -m "feat: implement database trigger for auto-creating player records

- Add trigger on auth.users to auto-create players table entry
- Backfill missing player records for existing auth users
- Remove redundant player creation from /api/player/ensure
- Simplify /app/game/page.tsx (remove manual player creation)
- Simplify /app/home/page.tsx (remove fallback logic)
- Simplify /app/api/auth/siwe/route.ts (trigger handles player creation)
- Enforce player record MUST exist (redirect to /auth if missing)

BREAKING CHANGE: /api/player/ensure endpoint removed (no longer needed)"
```

---

## 🧪 Post-Migration Verification

### Database Checks

```sql
-- 1. Verify trigger exists and is enabled
SELECT 
  tgname AS trigger_name,
  tgenabled,
  proname AS function_name
FROM pg_trigger
JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid
WHERE tgname = 'on_auth_user_created';

-- 2. Verify all auth users have player records
SELECT 
  COUNT(u.id) AS total_auth_users,
  COUNT(p.user_id) AS total_players,
  COUNT(u.id) - COUNT(p.user_id) AS orphaned_auth_users
FROM auth.users u
LEFT JOIN public.players p ON u.id = p.user_id;
-- Expected: orphaned_auth_users = 0

-- 3. Check for players with NULL wallet_address
SELECT 
  id,
  user_id,
  wallet_address,
  username,
  created_at
FROM players
WHERE wallet_address IS NULL
ORDER BY created_at DESC;
-- Should only be players who haven't connected wallet yet

-- 4. Check for duplicate players (same wallet)
SELECT 
  wallet_address,
  COUNT(*) AS count
FROM players
WHERE wallet_address IS NOT NULL
GROUP BY wallet_address
HAVING COUNT(*) > 1;
-- Expected: 0 rows (no duplicates)

-- 5. Verify player data integrity
SELECT 
  COUNT(*) AS total_players,
  COUNT(DISTINCT user_id) AS unique_users,
  COUNT(DISTINCT wallet_address) AS unique_wallets,
  SUM(CASE WHEN wallet_address IS NULL THEN 1 ELSE 0 END) AS no_wallet,
  SUM(CASE WHEN submarine_tier > 1 THEN 1 ELSE 0 END) AS upgraded_subs
FROM players;
```

### Application Checks

- [ ] New wallet sign-up creates player record automatically
- [ ] Existing wallet sign-in loads player data correctly
- [ ] /home page shows wallet address (no "Disconnected" when connected)
- [ ] /game page loads without creating duplicate players
- [ ] /marketplace, /profile, /submarine-hangar all work
- [ ] Wallet disconnect → sign out → redirect to /auth
- [ ] Reconnect wallet → loads same player record

### Edge Case Testing

- [ ] **Orphaned auth user**: Delete player record, sign in → Should redirect to /auth
- [ ] **Multiple tabs**: Open /auth in 2 tabs, sign in both → No duplicate players
- [ ] **Race condition**: Rapidly navigate between pages → No errors
- [ ] **Invalid session**: Clear cookies, visit /home → Redirect to /auth

---

## 🔄 Rollback Plan (If Issues Occur)

### Step 1: Disable Trigger
```sql
-- Disable trigger (don't delete yet)
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;

-- Verify disabled
SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'on_auth_user_created';
-- tgenabled should be 'D' (disabled)
```

### Step 2: Restore Code
```bash
cd "c:\Users\cleon\Desktop\AbyssX\OceanX-master"

# Revert to pre-migration commit
git log --oneline | head -5  # Find pre-migration commit hash
git revert <commit-hash>     # Or git reset --hard <commit-hash> if not pushed

# Rebuild
pnpm run build
```

### Step 3: Re-enable Manual Player Creation
Restore the deleted `/api/player/ensure/route.ts` from git history:
```bash
git checkout <previous-commit> -- app/api/player/ensure/route.ts
git add app/api/player/ensure/route.ts
git commit -m "rollback: restore manual player creation endpoint"
```

### Step 4: Monitor and Debug
- Check Supabase logs for trigger errors
- Check application logs for player creation failures
- Verify no orphaned auth users: `SELECT COUNT(*) FROM auth.users u LEFT JOIN players p ON u.id = p.user_id WHERE p.user_id IS NULL`

---

## 📊 Success Metrics

After migration, you should see:

- ✅ **Zero orphaned auth users** (all auth.users have player record)
- ✅ **Zero duplicate wallets** (each wallet_address is unique)
- ✅ **Faster auth flow** (no manual player creation logic)
- ✅ **Simplified codebase** (~150 lines of code removed)
- ✅ **Consistent player data** (wallet set correctly on first login)
- ✅ **No race conditions** (trigger is atomic)

---

## 🆘 Troubleshooting

### Issue: Trigger not firing

**Symptoms**: New auth users don't get player records

**Debug**:
```sql
-- Check trigger is enabled
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- Check function exists
SELECT proname, prosrc FROM pg_proc WHERE proname = 'create_player_for_new_user';

-- Test manually
SELECT public.create_player_for_new_user();
```

**Fix**: Re-run Step 1 SQL

---

### Issue: Trigger fails with error

**Symptoms**: Auth user created but no player record

**Debug**:
```sql
-- Check Supabase logs (Dashboard → Database → Logs)
-- Look for RAISE NOTICE or errors

-- Test trigger with dummy data
INSERT INTO auth.users (
  id, 
  email, 
  raw_user_meta_data
) VALUES (
  gen_random_uuid(),
  'test@example.com',
  '{"wallet_address": "0x1234567890abcdef"}'::jsonb
);

-- Check if player was created
SELECT * FROM players WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test@example.com');
```

**Fix**: Check function syntax, ensure `raw_user_meta_data` has correct structure

---

### Issue: Wallet address is NULL for new players

**Symptoms**: Player record created but `wallet_address` is NULL

**Debug**:
```sql
-- Check auth user metadata
SELECT 
  id, 
  email, 
  raw_user_meta_data->>'wallet_address' AS wallet_from_metadata
FROM auth.users
LIMIT 5;
```

**Cause**: SIWE route not setting `wallet_address` in user metadata

**Fix**: Update SIWE route to set metadata:
```typescript
const { data: authData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
  email,
  password: stablePassword,
  email_confirm: true,
  user_metadata: {
    wallet_address: address.toLowerCase(),  // ← Ensure this is set
    wallet_type: 'ethereum',
    auth_method: 'siwe',
  },
})
```

---

### Issue: Duplicate player records

**Symptoms**: Multiple players with same `user_id` or `wallet_address`

**Debug**:
```sql
-- Find duplicates by user_id
SELECT user_id, COUNT(*) FROM players GROUP BY user_id HAVING COUNT(*) > 1;

-- Find duplicates by wallet_address
SELECT wallet_address, COUNT(*) FROM players 
WHERE wallet_address IS NOT NULL 
GROUP BY wallet_address 
HAVING COUNT(*) > 1;
```

**Fix**: Delete duplicates (keep most recent):
```sql
-- Delete older duplicates by user_id
DELETE FROM players p1
WHERE EXISTS (
  SELECT 1 FROM players p2
  WHERE p2.user_id = p1.user_id
  AND p2.created_at > p1.created_at
);

-- Delete older duplicates by wallet_address
DELETE FROM players p1
WHERE EXISTS (
  SELECT 1 FROM players p2
  WHERE p2.wallet_address = p1.wallet_address
  AND p2.created_at > p1.created_at
);
```

---

## 📚 Additional Resources

- [Supabase Triggers Documentation](https://supabase.com/docs/guides/database/postgres/triggers)
- [PostgreSQL Trigger Functions](https://www.postgresql.org/docs/current/plpgsql-trigger.html)
- [Auth Flow Analysis](./AUTH-FLOW-ANALYSIS.md) (detailed problem analysis)

---

## ✅ Migration Complete Checklist

- [ ] Database trigger created and verified
- [ ] Backfill complete (all auth users have players)
- [ ] `/api/player/ensure` deleted
- [ ] `/app/game/page.tsx` simplified
- [ ] `/app/home/page.tsx` simplified
- [ ] `/app/api/auth/siwe/route.ts` simplified
- [ ] Build passes (`pnpm run build`)
- [ ] All test cases passed
- [ ] Changes committed to git
- [ ] Database verification queries show 0 orphaned users
- [ ] Application verified in production/staging

---

**Migration Date**: _________________

**Performed By**: _________________

**Sign-off**: _________________
