# 🔍 Authentication & Player Data Flow Analysis

## Summary of Issues Found

### ✅ What's Working Correctly

1. **SIWE Authentication Flow** - Properly implemented with stable passwords
2. **Middleware Session Checking** - Uses `@supabase/ssr` consistently
3. **Cookie Handling** - All pages now use `@supabase/ssr` (fixed today)
4. **Wallet Disconnect** - Calls `/api/auth/signout` to clear session
5. **Protected Routes** - Middleware properly guards `/home`, `/game`, `/profile`, etc.

### ❌ Critical Issues

#### 1. **MISSING PLAYER RECORD CREATION ON AUTH**

**Problem**: When a wallet authenticates via SIWE, the auth user is created BUT the player record is NOT automatically created.

**Evidence**:
- `app/api/auth/siwe/route.ts` lines 400-500: Creates player record ONLY in the `/api/auth/siwe` route
- `app/home/page.tsx` lines 30-60: Falls back to user metadata when `playerRecord` is null
- `app/game/page.tsx` lines 36-84: Creates player record using service role if missing

**Impact**: 
- Users authenticate successfully but have NO player record in database
- `/home` page shows default values (tier 1, 0 resources) from fallbacks
- `/game` page tries to create player on-the-fly
- Multiple pages racing to create player record = potential duplicates

**Root Cause**: NO trigger on `auth.users` table to auto-create player records.

---

#### 2. **PLAYER RECORD CREATION IS INCONSISTENT**

Three different places try to create player records:

##### Location A: `/api/auth/siwe/route.ts` (lines 400-500)
```typescript
const { error: playerInsertError } = await supabaseAdmin
  .from('players')
  .insert({
    user_id: authUserId,
    wallet_address: lowerWallet,
    username: `Captain-${address.slice(2, 8)}`,
    submarine_tier: 1,
    // ... other defaults
  })
```

##### Location B: `/api/player/ensure/route.ts` (lines 50-75) 
```typescript
const { data: newPlayer, error: createError } = await supabaseAdmin
  .from("players")
  .insert({
    user_id: userId,
    username,
    wallet_address: null,  // ⚠️ DIFFERENT: null instead of actual wallet
    submarine_tier: 1,
    // ... other defaults
  })
```

##### Location C: `/app/game/page.tsx` (lines 48-84)
```typescript
const { data: newPlayer, error: createError } = await supabaseAdmin
  .from("players")
  .insert({
    user_id: session.user.id,
    username,
    wallet_address: null,  // ⚠️ DIFFERENT: null instead of actual wallet
    submarine_tier: 1,
    // ... other defaults
  })
```

**Problems**:
- **Inconsistent `wallet_address`**: SIWE sets wallet, others set `null`
- **Race conditions**: Multiple pages can try to create player simultaneously
- **Error handling differs**: Some routes delete auth user on failure, others don't
- **Username generation differs**: Different patterns across locations

---

#### 3. **DATABASE SCHEMA MISMATCH**

**Expected Schema** (from `docs/COMPLETE-DATABASE-SCHEMA.md`):
```sql
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT UNIQUE,  -- ✅ Can be NULL
  username TEXT,
  submarine_tier INTEGER NOT NULL DEFAULT 1,
  coins BIGINT NOT NULL DEFAULT 0,
  nickel INTEGER NOT NULL DEFAULT 0,
  cobalt INTEGER NOT NULL DEFAULT 0,
  copper INTEGER NOT NULL DEFAULT 0,
  manganese INTEGER NOT NULL DEFAULT 0,
  total_resources_mined BIGINT DEFAULT 0,
  total_ocx_earned NUMERIC(78, 0) DEFAULT 0,
  last_reward_claim TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)

-- WITH AUTO-CREATE TRIGGER:
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_player_for_new_user();
```

**Current Implementation Issues**:
- ✅ `user_id` is UNIQUE and references `auth.users(id) ON DELETE CASCADE` - Good
- ✅ `wallet_address` is UNIQUE - Good for preventing duplicate wallets
- ❌ **MISSING TRIGGER**: No `on_auth_user_created` trigger exists
- ❌ **NULL wallet_address**: Multiple pages create player with `wallet_address: null`, causing issues

---

#### 4. **WALLET LINKING FLOW IS UNCLEAR**

**Current Flow**:
1. User visits `/auth` → Clicks "Connect Wallet"
2. Signs SIWE message → `/api/auth/siwe` creates auth user + player (with wallet)
3. Redirects to `/home` → Checks for player record
4. If no player record → Falls back to metadata (shows placeholder data)

**Issues**:
- `/home` page expects `wallet_address` to exist in player record
- But if player record was created by `/api/player/ensure` or `/game/page`, wallet is NULL
- User sees "Wallet not connected" even after authenticating

**Expected Flow**:
1. User visits `/auth` → Authenticates via SIWE
2. **Trigger auto-creates player record** with wallet_address from user_metadata
3. Redirects to `/home` → Always has complete player record
4. All pages read from player record, not user metadata

---

#### 5. **RLS POLICIES DON'T MATCH CODE**

**RLS Policy** (`scripts/production-rls-policies.sql` line 57):
```sql
CREATE POLICY "production_players_insert" ON public.players
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND auth.uid() = user_id  -- Can only create row for self
  );
```

**Code Reality**:
- `/api/auth/siwe` uses `supabaseAdmin` (service role) to create player → **Bypasses RLS ✅**
- `/api/player/ensure` uses `supabaseAdmin` → **Bypasses RLS ✅**
- `/app/game/page.tsx` uses `supabaseAdmin` → **Bypasses RLS ✅**

**Verdict**: RLS policies are correct (INSERT only allows user_id = auth.uid()), and all player creation uses service role to bypass RLS. **No issue here.**

---

## 🎯 Recommended Fix: Single Source of Truth

### Solution: Database Trigger + Cleanup

#### Step 1: Add Database Trigger (Run in Supabase SQL Editor)

```sql
-- Function to auto-create player record on auth user creation
CREATE OR REPLACE FUNCTION create_player_for_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Extract wallet address from user metadata
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
    LOWER(NEW.raw_user_meta_data->>'wallet_address'),  -- Extract from metadata
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.email,
      'Captain-' || SUBSTRING(NEW.id::text, 1, 8)
    ),
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
  ON CONFLICT (user_id) DO NOTHING;  -- Prevent duplicate if player already exists
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_player_for_new_user();
```

#### Step 2: Remove Redundant Player Creation Code

**Delete `/api/player/ensure/route.ts`** - No longer needed

**Update `/app/game/page.tsx`** - Remove player creation logic:

```typescript
// BEFORE (lines 34-84):
let { data: playerData, error: playerError } = await supabaseAdmin
  .from("players")
  .select("wallet_address, nickel, cobalt, copper, manganese")
  .eq("user_id", session.user.id)
  .maybeSingle()

if (!playerData) {
  // 50 lines of player creation logic...
}

// AFTER:
const { data: playerData, error: playerError } = await supabaseAdmin
  .from("players")
  .select("wallet_address, nickel, cobalt, copper, manganese")
  .eq("user_id", session.user.id)
  .single()  // Use .single() instead of .maybeSingle() - player MUST exist

if (playerError) {
  console.error("[game/page] Player not found:", playerError)
  redirect("/auth")  // Force re-auth if player missing
}
```

**Update `/app/home/page.tsx`** - Remove fallbacks:

```typescript
// BEFORE (lines 30-75):
const { data: playerRecord, error: playerError } = await supabase
  .from("players")
  .select("*")
  .eq("user_id", session.user.id)
  .maybeSingle()

// 20+ lines of fallback logic...

const walletAddress = playerRecord?.wallet_address || 
  session.user.user_metadata?.wallet_address || 
  null

// AFTER:
const { data: playerRecord, error: playerError } = await supabase
  .from("players")
  .select("*")
  .eq("user_id", session.user.id)
  .single()

if (playerError || !playerRecord) {
  console.error("[home/page] Player not found:", playerError)
  redirect("/auth")  // Force re-auth
}

// No fallbacks needed - player record ALWAYS exists
```

#### Step 3: Simplify SIWE Route

**Update `/app/api/auth/siwe/route.ts`** (lines 400-500):

Remove the entire player creation block (lines 400-520). The trigger handles it.

```typescript
// BEFORE: 120 lines of player creation + reconciliation

// AFTER: Just sign in
const { client: supabaseNewUser, getCookies: getNewUserCookies } = getSupabaseWithCookies(request)
const { data: signInData, error: signInError } = await supabaseNewUser.auth.signInWithPassword({
  email,
  password: stablePassword,
})

if (signInError || !signInData.session) {
  console.error('Sign in error:', signInError)
  return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
}

const response = NextResponse.json({
  success: true,
  isNewUser: !isRecoveredUser,
  session: signInData.session,
  user: signInData.user,
  address: address.toLowerCase()
})

const cookies = getNewUserCookies()
Object.entries(cookies).forEach(([name, value]) => {
  response.cookies.set(name, value, { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === 'production', 
    sameSite: 'lax', 
    path: '/' 
  })
})
return response
```

---

## 📊 Current Flow vs. Fixed Flow

### BEFORE (Current - Broken)

```
1. User connects wallet → SIWE signature
2. /api/auth/siwe:
   ✅ Creates auth.users record
   ✅ Creates players record (wallet set)
3. Redirects to /home
4. /home page:
   ⚠️ Queries players table → May be NULL if race condition
   ⚠️ Falls back to user metadata → Shows placeholder data
5. User clicks "Dive Deep"
6. /game page:
   ⚠️ Queries players table → May be NULL
   ⚠️ Creates player record with wallet: null
   ⚠️ Now have DUPLICATE player records (one with wallet, one without)
```

### AFTER (Fixed)

```
1. User connects wallet → SIWE signature
2. /api/auth/siwe:
   ✅ Creates auth.users record (with wallet in metadata)
   ✅ TRIGGER auto-creates players record (wallet from metadata)
3. Redirects to /home
4. /home page:
   ✅ Queries players table → ALWAYS exists
   ✅ Shows real player data (wallet, tier, resources)
5. User clicks "Dive Deep"
6. /game page:
   ✅ Queries players table → ALWAYS exists
   ✅ Loads player resources → Starts game
```

---

## 🔧 Implementation Checklist

- [ ] Run database trigger SQL (Step 1)
- [ ] Test trigger: Create new auth user → Verify player record auto-created
- [ ] Delete `/api/player/ensure/route.ts`
- [ ] Update `/app/game/page.tsx` (remove player creation)
- [ ] Update `/app/home/page.tsx` (remove fallbacks)
- [ ] Simplify `/app/api/auth/siwe/route.ts` (remove player creation)
- [ ] Update `/api/player/ensure` uses `@supabase/ssr` (already done today)
- [ ] Test full auth flow:
  - [ ] New wallet → Auth → Player created → /home shows data
  - [ ] Existing wallet → Auth → Player loaded → /home shows data
  - [ ] Disconnect wallet → Clears session → Redirect to /auth
  - [ ] Reconnect wallet → Auth → /home shows data

---

## 💡 Additional Recommendations

### 1. Add Username Editing
Currently username is auto-generated. Add a flow to let users set custom username.

### 2. Add Wallet Unlinking
Allow users to disconnect wallet from profile (set `wallet_address = NULL`).

### 3. Add Player Profile Page
Show player stats, wallet, tier, resources in a dedicated profile page.

### 4. Add Admin Dashboard
Create admin routes using service role to:
- View all players
- Reset player data (testing)
- Monitor auth issues

### 5. Add Error Boundary
Wrap pages in error boundary to catch and display auth/player loading errors gracefully.

---

## 🎓 Key Learnings

1. **Database triggers > Application logic** for critical data integrity
2. **Single source of truth** prevents race conditions and inconsistencies
3. **Service role bypasses RLS** - Use for privileged operations only
4. **Consistent cookie handling** across all pages prevents auth bugs
5. **Remove fallback logic** - If player MUST exist, enforce it with trigger

---

## ✅ Testing Strategy

### Unit Tests Needed
- [ ] Trigger creates player on auth.users INSERT
- [ ] Trigger extracts wallet from metadata correctly
- [ ] Trigger handles missing wallet gracefully
- [ ] Trigger prevents duplicate players (ON CONFLICT)

### Integration Tests Needed
- [ ] Full SIWE flow creates player
- [ ] /home loads player data correctly
- [ ] /game loads player resources correctly
- [ ] Wallet disconnect clears session
- [ ] Re-authentication works after disconnect

### Edge Cases to Test
- [ ] User has auth.users but no player (orphaned auth)
- [ ] User has player but wallet is NULL
- [ ] Two tabs authenticate simultaneously
- [ ] Network error during auth
- [ ] Invalid SIWE signature

