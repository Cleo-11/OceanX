# 🚀 OceanX Production Implementation Plan

## Overview

This guide takes you from demo-safe to fully production-ready in **8 focused phases**. Each phase builds on the previous one, with clear deliverables and verification steps.

**Time Estimate:** 4-6 hours of focused work  
**Difficulty:** Intermediate  
**Prerequisites:** Current demo-safe state working

---

## Phase 1: Security Foundation (45 min)

### 1.1 Add Service Role Key to Environment

**What:** Add server-side Supabase credentials for privileged operations.

**Steps:**

1. Open Supabase Dashboard → Settings → API
2. Copy the `service_role` key (NOT the anon key)
3. Add to `.env.local`:

```bash
# Add this line (keep existing vars)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

4. Verify it's NOT in `.env.example` or `.gitignore`:

```bash
# Check .gitignore includes:
.env*.local
.env.production
```

**Verification:**
```bash
# Run in terminal - should NOT show service role key
cat .env.example | grep SERVICE_ROLE
# Should be empty - good!

# Check it exists locally
cat .env.local | grep SERVICE_ROLE
# Should show your key - good!
```

---

### 1.2 Create Admin Supabase Client

**What:** Create a server-only client that bypasses RLS for privileged operations.

**File:** `lib/supabase-admin.ts` (NEW)

```bash
# Create the file
touch lib/supabase-admin.ts
```

**Content:**

```typescript
/**
 * Supabase Admin Client (Server-Side Only)
 * 
 * ⚠️ CRITICAL: Never import this in client components!
 * This client bypasses Row Level Security and has full database access.
 * 
 * Use cases:
 * - Mining reward distribution
 * - Submarine upgrades
 * - Admin operations
 * - Batch updates
 * 
 * @see docs/BACKEND-SERVER-SIDE-PATTERNS.md
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

// Validate environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY - Add it to .env.local')
}

/**
 * Admin client with service role key
 * Bypasses RLS - use with extreme caution
 */
export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

/**
 * Type-safe helper to verify user owns resource
 */
export async function verifyUserOwnership(
  userId: string,
  tableName: 'players' | 'pending_actions',
  recordId: string
) {
  const { data, error } = await supabaseAdmin
    .from(tableName)
    .select('user_id')
    .eq('id', recordId)
    .single()

  if (error || !data) {
    return false
  }

  return data.user_id === userId
}
```

**Verification:**
```bash
# Build should succeed
npm run build
# No TypeScript errors about missing types
```

---

### 1.3 Apply Production RLS Policies

**What:** Replace permissive demo policies with strict user-isolation policies.

**Steps:**

1. Open Supabase Dashboard → SQL Editor
2. Open `scripts/production-rls-policies.sql` in your code editor
3. Copy the entire file
4. Paste into Supabase SQL Editor
5. Click **Run**
6. Wait for "Success" message

**Verification:**

Run `scripts/check-production-rls.sql` in SQL Editor:

```sql
-- Expected output:
-- RLS Enabled: true (both tables)
-- 8 production policies
-- 0 demo policies
```

**Expected Results:**
- ✅ `production_players_select`
- ✅ `production_players_insert`
- ✅ `production_players_update`
- ✅ `production_players_delete`
- ✅ `production_pending_actions_select`
- ✅ `production_pending_actions_insert`
- ✅ `production_pending_actions_update`
- ✅ `production_pending_actions_delete`

---

## Phase 2: Backend API Routes (90 min)

### 2.1 Create Mining Rewards API

**What:** Move mining reward calculations to secure backend.

**File:** `app/api/mining/claim-rewards/route.ts` (NEW)

```bash
mkdir -p app/api/mining
touch app/api/mining/claim-rewards/route.ts
```

**Content:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

interface ClaimRewardsRequest {
  resources_mined: number
  mining_duration_seconds: number
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify authentication
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Parse and validate request
    const body: ClaimRewardsRequest = await request.json()
    const { resources_mined, mining_duration_seconds } = body

    // Validation rules
    if (!resources_mined || resources_mined <= 0) {
      return NextResponse.json(
        { error: 'Invalid resources amount' },
        { status: 400 }
      )
    }

    if (resources_mined > 1000) {
      return NextResponse.json(
        { error: 'Resources amount too high (max 1000 per claim)' },
        { status: 400 }
      )
    }

    if (!mining_duration_seconds || mining_duration_seconds <= 0) {
      return NextResponse.json(
        { error: 'Invalid mining duration' },
        { status: 400 }
      )
    }

    // Anti-cheat: Validate resources vs time (max 10 resources per second)
    const maxPossible = Math.floor(mining_duration_seconds * 10)
    if (resources_mined > maxPossible) {
      console.warn(`[ANTI-CHEAT] User ${user.id} claimed ${resources_mined} but max possible was ${maxPossible}`)
      return NextResponse.json(
        { error: 'Invalid mining rate detected' },
        { status: 400 }
      )
    }

    // 3. Calculate OCX tokens (10 OCX per resource)
    const ocx_earned = resources_mined * 10

    // 4. Update player stats using admin client (bypasses RLS)
    const { data: updatedPlayer, error: updateError } = await supabaseAdmin
      .from('players')
      .update({
        total_resources_mined: supabaseAdmin.sql`total_resources_mined + ${resources_mined}`,
        total_ocx_earned: supabaseAdmin.sql`total_ocx_earned + ${ocx_earned}`,
        last_login: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('[Mining] Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update player stats' },
        { status: 500 }
      )
    }

    // 5. Return success
    return NextResponse.json({
      success: true,
      rewards: {
        resources: resources_mined,
        ocx: ocx_earned
      },
      player: updatedPlayer
    })

  } catch (error) {
    console.error('[Mining] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

**Verification:**
```bash
# Test locally
curl -X POST http://localhost:3000/api/mining/claim-rewards \
  -H "Content-Type: application/json" \
  -d '{"resources_mined": 50, "mining_duration_seconds": 10}'

# Should get 401 Unauthorized (no auth token) - good!
```

---

### 2.2 Create Submarine Upgrade API

**What:** Secure submarine upgrade logic on backend.

**File:** `app/api/submarine/upgrade/route.ts` (NEW)

```bash
mkdir -p app/api/submarine
touch app/api/submarine/upgrade/route.ts
```

**Content:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

interface UpgradeRequest {
  target_tier: number
}

// Upgrade costs (resources required)
const UPGRADE_COSTS: Record<number, number> = {
  1: 0,
  2: 1000,
  3: 5000,
  4: 20000,
  5: 50000,
  6: 100000,
  7: 200000,
  8: 400000,
  9: 800000,
  10: 1600000,
  11: 3200000,
  12: 6400000,
  13: 12800000,
  14: 25600000,
  15: 51200000
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify authentication
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Parse and validate request
    const body: UpgradeRequest = await request.json()
    const { target_tier } = body

    if (!target_tier || target_tier < 2 || target_tier > 15) {
      return NextResponse.json(
        { error: 'Invalid tier (must be 2-15)' },
        { status: 400 }
      )
    }

    // 3. Get current player state
    const { data: player, error: fetchError } = await supabaseAdmin
      .from('players')
      .select('submarine_tier, total_resources_mined, username')
      .eq('user_id', user.id)
      .single()

    if (fetchError || !player) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      )
    }

    // 4. Validate upgrade logic
    if (player.submarine_tier >= target_tier) {
      return NextResponse.json(
        { error: 'Already at or above target tier' },
        { status: 400 }
      )
    }

    const cost = UPGRADE_COSTS[target_tier]

    if (player.total_resources_mined < cost) {
      return NextResponse.json({
        error: 'Insufficient resources',
        required: cost,
        current: player.total_resources_mined,
        shortage: cost - player.total_resources_mined
      }, { status: 400 })
    }

    // 5. Perform upgrade (deduct resources, increase tier)
    const { data: updatedPlayer, error: upgradeError } = await supabaseAdmin
      .from('players')
      .update({
        submarine_tier: target_tier,
        total_resources_mined: player.total_resources_mined - cost
      })
      .eq('user_id', user.id)
      .select()
      .single()

    if (upgradeError) {
      console.error('[Upgrade] Error:', upgradeError)
      return NextResponse.json(
        { error: 'Failed to upgrade submarine' },
        { status: 500 }
      )
    }

    // 6. Log upgrade for analytics
    console.log(`[Upgrade] ${player.username} upgraded to tier ${target_tier}`)

    return NextResponse.json({
      success: true,
      upgrade: {
        old_tier: player.submarine_tier,
        new_tier: target_tier,
        cost: cost,
        remaining_resources: updatedPlayer.total_resources_mined
      },
      player: updatedPlayer
    })

  } catch (error) {
    console.error('[Upgrade] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

**Verification:**
```bash
npm run build
# No TypeScript errors
```

---

### 2.3 Update Existing Hangar Purchase Route

**What:** Ensure hangar purchase uses admin client for privileged updates.

**File:** `app/api/hangar/purchase/route.ts` (EDIT)

Find the line with `supabase.from('upgrade_transactions').insert` (around line 247) and update to use admin client:

```typescript
// Add import at top
import { supabaseAdmin } from '@/lib/supabase-admin'

// Replace this section (around line 240-250):
// Old:
const { error: auditError } = await supabase.from('upgrade_transactions').insert({

// New:
const { error: auditError } = await supabaseAdmin.from('upgrade_transactions').insert({
```

Also update player data writes to use `supabaseAdmin`:

```typescript
// Find player update (around line 180-200)
// Change from:
const { data: updatedPlayer, error: updateError } = await supabase
  .from('players')
  .update({...})

// To:
const { data: updatedPlayer, error: updateError } = await supabaseAdmin
  .from('players')
  .update({...})
```

---

## Phase 3: Input Validation & Rate Limiting (60 min)

### 3.1 Install Validation Library

```bash
npm install zod
```

### 3.2 Create Validation Schemas

**File:** `lib/validation.ts` (NEW)

```typescript
import { z } from 'zod'

export const MiningClaimSchema = z.object({
  resources_mined: z.number().int().min(1).max(1000),
  mining_duration_seconds: z.number().int().min(1).max(3600)
})

export const SubmarineUpgradeSchema = z.object({
  target_tier: z.number().int().min(2).max(15)
})

export const WalletAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/)

export const TransactionHashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/)
```

### 3.3 Apply Validation to API Routes

**Update:** `app/api/mining/claim-rewards/route.ts`

```typescript
import { MiningClaimSchema } from '@/lib/validation'

// In POST function, replace manual validation with:
const validationResult = MiningClaimSchema.safeParse(body)

if (!validationResult.success) {
  return NextResponse.json(
    { 
      error: 'Invalid request',
      details: validationResult.error.format()
    },
    { status: 400 }
  )
}

const { resources_mined, mining_duration_seconds } = validationResult.data
```

### 3.4 Add Rate Limiting

**Install:**
```bash
npm install @upstash/ratelimit @upstash/redis
```

**File:** `lib/rate-limit.ts` (NEW)

```typescript
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Simple in-memory rate limiter for development
// In production, use Upstash Redis

class SimpleRateLimiter {
  private requests: Map<string, number[]> = new Map()

  async limit(identifier: string, maxRequests: number, windowMs: number) {
    const now = Date.now()
    const requests = this.requests.get(identifier) || []
    
    // Remove old requests outside window
    const validRequests = requests.filter(time => now - time < windowMs)
    
    if (validRequests.length >= maxRequests) {
      return { success: false }
    }
    
    validRequests.push(now)
    this.requests.set(identifier, validRequests)
    
    return { success: true }
  }
}

const rateLimiter = new SimpleRateLimiter()

export async function checkRateLimit(userId: string, endpoint: string) {
  // Allow 10 requests per minute per endpoint
  return await rateLimiter.limit(`${userId}:${endpoint}`, 10, 60000)
}
```

**Apply to routes:**

```typescript
// In app/api/mining/claim-rewards/route.ts
import { checkRateLimit } from '@/lib/rate-limit'

// After auth check:
const rateLimitResult = await checkRateLimit(user.id, 'mining-claim')
if (!rateLimitResult.success) {
  return NextResponse.json(
    { error: 'Rate limit exceeded. Please wait before claiming again.' },
    { status: 429 }
  )
}
```

---

## Phase 4: Client-Side Updates (75 min)

### 4.1 Update Mining Component

**File:** Find your mining component (likely `components/mine-button.tsx` or `app/game/page.tsx`)

**Change client-side DB write to API call:**

```typescript
// Old (direct DB write):
await supabase.from("players").update({ 
  total_resources_mined: ... 
})

// New (API call):
const response = await fetch('/api/mining/claim-rewards', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    resources_mined: minedAmount,
    mining_duration_seconds: Math.floor((Date.now() - miningStartTime) / 1000)
  })
})

const result = await response.json()

if (result.success) {
  // Update UI with result.player data
  toast.success(`Mined ${result.rewards.resources} resources!`)
} else {
  toast.error(result.error)
}
```

### 4.2 Update Submarine Upgrade Component

**Find:** Submarine upgrade button component

**Replace:**

```typescript
// Old:
await supabase.from('players').update({ submarine_tier: newTier })

// New:
const response = await fetch('/api/submarine/upgrade', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ target_tier: newTier })
})

const result = await response.json()

if (result.success) {
  toast.success(`Upgraded to Tier ${result.upgrade.new_tier}!`)
  // Refresh player data
} else {
  toast.error(result.error)
}
```

### 4.3 Remove Direct Client Writes

**Search and replace all instances:**

```bash
# Find all direct writes
grep -r "supabase.from('players').update" app/ components/
grep -r "supabase.from('players').insert" app/ components/
```

**Strategy:**
- Keep READ operations (`select()`) on client
- Move all WRITE operations (`insert()`, `update()`, `delete()`) to API routes

---

## Phase 5: Error Handling & Loading States (45 min)

### 5.1 Create Toast Notification System

**Install:**
```bash
npm install sonner
```

**File:** `app/layout.tsx`

```typescript
import { Toaster } from 'sonner'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
```

### 5.2 Add Loading States to All Async Operations

**Pattern:**

```typescript
const [isLoading, setIsLoading] = useState(false)
const [error, setError] = useState<string | null>(null)

async function handleAction() {
  setIsLoading(true)
  setError(null)
  
  try {
    const response = await fetch('/api/endpoint')
    const result = await response.json()
    
    if (!response.ok) {
      throw new Error(result.error || 'Unknown error')
    }
    
    toast.success('Action completed!')
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An error occurred'
    setError(errorMessage)
    toast.error(errorMessage)
  } finally {
    setIsLoading(false)
  }
}

// In JSX:
<button disabled={isLoading} onClick={handleAction}>
  {isLoading ? 'Processing...' : 'Perform Action'}
</button>
{error && <p className="text-red-500">{error}</p>}
```

---

## Phase 6: Testing & Verification (60 min)

### 6.1 Create Test Script

**File:** `scripts/test-production-security.ts` (NEW)

```typescript
/**
 * Test Production Security
 * 
 * This script verifies that:
 * 1. Users cannot read other users' data
 * 2. Users cannot update other users' data
 * 3. API routes properly authenticate
 * 4. Rate limiting works
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function runSecurityTests() {
  console.log('🔒 Running production security tests...\n')
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  
  // Test 1: Unauthenticated access should fail
  console.log('Test 1: Unauthenticated API access')
  const unauthResponse = await fetch('http://localhost:3000/api/mining/claim-rewards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resources_mined: 100, mining_duration_seconds: 10 })
  })
  
  if (unauthResponse.status === 401) {
    console.log('✅ PASS: Unauthenticated requests blocked\n')
  } else {
    console.log('❌ FAIL: Unauthenticated requests allowed\n')
  }
  
  // Add more tests...
  
  console.log('✅ All security tests complete!')
}

runSecurityTests()
```

### 6.2 Manual Testing Checklist

Create `docs/TESTING-CHECKLIST.md`:

```markdown
# Production Testing Checklist

## Authentication
- [ ] Sign in with wallet works
- [ ] Sign out works
- [ ] Session persists on page reload
- [ ] Middleware redirects unauthenticated users
- [ ] Protected routes are inaccessible without auth

## Player Data
- [ ] Profile created automatically on first sign-in
- [ ] Player can read own profile
- [ ] Player cannot read other users' profiles
- [ ] Player can update own profile
- [ ] Player cannot update other users' profiles

## Mining
- [ ] Mining starts successfully
- [ ] Mining rewards calculated correctly
- [ ] Rewards saved to database
- [ ] Cannot claim negative/excessive rewards
- [ ] Rate limiting prevents spam

## Submarine Upgrades
- [ ] Upgrade succeeds with sufficient resources
- [ ] Upgrade fails with insufficient resources
- [ ] Cannot upgrade to invalid tiers
- [ ] Resources deducted correctly

## UI/UX
- [ ] Loading states show during API calls
- [ ] Success messages display
- [ ] Error messages display
- [ ] Forms disabled during submission
- [ ] No console errors

## Performance
- [ ] Page load < 3 seconds
- [ ] 3D scenes run at 60fps
- [ ] No memory leaks after 5 minutes
```

Run through this checklist manually.

---

## Phase 7: Environment & Deployment (30 min)

### 7.1 Update Environment Files

**`.env.local` (Development):**
```bash
# Public (safe to expose)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_NETWORK_NAME=Sepolia

# Server-only (NEVER expose)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**`.env.example` (Template):**
```bash
# Copy this to .env.local and fill in your values

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Server-side only - DO NOT expose to client
SUPABASE_SERVICE_ROLE_KEY=
```

**`.env.production` (Vercel/Production):**
Set these in Vercel Dashboard → Settings → Environment Variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` ⚠️ (secret)
- `NEXT_PUBLIC_SITE_URL` (your production URL)

### 7.2 Update `.gitignore`

```bash
# Environment variables
.env*.local
.env.production
.env

# Keep .env.example
!.env.example
```

---

## Phase 8: Final Checks & Launch (30 min)

### 8.1 Build Production Bundle

```bash
npm run build
```

**Fix all errors before proceeding.**

### 8.2 Run Production Locally

```bash
npm run start
```

Test all features in production mode.

### 8.3 Deploy to Vercel

```bash
# If using Vercel CLI
vercel --prod

# Or push to GitHub (auto-deploys)
git add .
git commit -m "feat: Production-ready with secure RLS and backend APIs"
git push origin main
```

### 8.4 Post-Deployment Verification

1. **Check Supabase RLS:**
   - Run `scripts/check-production-rls.sql` in production Supabase project
   - Verify 8 production policies exist

2. **Test Live Site:**
   - Sign in
   - Mine resources
   - Upgrade submarine
   - Check database for correct data

3. **Monitor Errors:**
   - Check Vercel logs
   - Check Supabase logs
   - Set up error tracking (Sentry)

---

## 📊 Progress Tracker

Use this to track your progress:

```markdown
## Phase 1: Security Foundation
- [ ] 1.1 Add service role key to .env.local
- [ ] 1.2 Create lib/supabase-admin.ts
- [ ] 1.3 Apply production RLS policies

## Phase 2: Backend API Routes
- [ ] 2.1 Create mining rewards API
- [ ] 2.2 Create submarine upgrade API
- [ ] 2.3 Update hangar purchase route

## Phase 3: Input Validation & Rate Limiting
- [ ] 3.1 Install Zod
- [ ] 3.2 Create validation schemas
- [ ] 3.3 Apply validation to routes
- [ ] 3.4 Add rate limiting

## Phase 4: Client-Side Updates
- [ ] 4.1 Update mining component
- [ ] 4.2 Update submarine upgrade component
- [ ] 4.3 Remove all direct client writes

## Phase 5: Error Handling & Loading States
- [ ] 5.1 Install Sonner toast library
- [ ] 5.2 Add loading states to all async operations

## Phase 6: Testing & Verification
- [ ] 6.1 Create test script
- [ ] 6.2 Complete manual testing checklist

## Phase 7: Environment & Deployment
- [ ] 7.1 Update environment files
- [ ] 7.2 Update .gitignore

## Phase 8: Final Checks & Launch
- [ ] 8.1 Build production bundle
- [ ] 8.2 Run production locally
- [ ] 8.3 Deploy to Vercel
- [ ] 8.4 Post-deployment verification
```

---

## 🆘 Troubleshooting

### Issue: "Missing SUPABASE_SERVICE_ROLE_KEY"
**Fix:** Add it to `.env.local` (not `.env`)

### Issue: RLS blocks legitimate updates
**Check:** Run `scripts/check-production-rls.sql`
**Fix:** Ensure production policies are applied, not demo policies

### Issue: API returns 401 Unauthorized
**Check:** Is user authenticated? Does middleware allow the route?
**Fix:** Verify session exists, check middleware config

### Issue: TypeScript errors on build
**Fix:** Run `npm run build` and fix each error one by one

---

## 🎯 Success Criteria

You're production-ready when:

✅ All 8 phases complete  
✅ `npm run build` succeeds with no errors  
✅ Production RLS policies verified  
✅ All API routes use server-side auth  
✅ No client-side direct DB writes  
✅ Manual testing checklist complete  
✅ Deployed to Vercel successfully  
✅ Live site tested and working  

---

## 📚 Quick Reference

- **RLS Policies:** `scripts/production-rls-policies.sql`
- **Verification:** `scripts/check-production-rls.sql`
- **Backend Patterns:** `docs/BACKEND-SERVER-SIDE-PATTERNS.md`
- **Migration Guide:** `docs/PRODUCTION-RLS-MIGRATION.md`
- **Checklist:** `docs/PRODUCTION-READINESS-CHECKLIST.md`

---

**Time to complete:** 4-6 hours focused work  
**Difficulty:** Intermediate  
**Support:** Refer to docs/ folder for detailed examples

Let's build! 🚀
