# ✅ OceanX Production Quick Checklist

Print this and check off as you go! ⏱️ Total: 4-6 hours

---

## ⚡ Phase 1: Security Foundation (45 min)

### Step 1: Add Service Role Key
- [ ] Open Supabase Dashboard → Settings → API
- [ ] Copy `service_role` key
- [ ] Add to `.env.local`: `SUPABASE_SERVICE_ROLE_KEY=...`
- [ ] Verify NOT in `.env.example`
- [ ] Test: `cat .env.local | grep SERVICE_ROLE` (should show key)

### Step 2: Create Admin Client
- [ ] Create file: `lib/supabase-admin.ts`
- [ ] Copy code from implementation plan
- [ ] Test build: `npm run build` (no errors)

### Step 3: Apply Production RLS
- [ ] Open Supabase Dashboard → SQL Editor
- [ ] Copy contents of `scripts/production-rls-policies.sql`
- [ ] Paste and click "Run"
- [ ] Run `scripts/check-production-rls.sql` to verify
- [ ] Confirm: 8 production policies, 0 demo policies

**✅ Phase 1 Complete!** Take a 5-min break.

---

## 🔧 Phase 2: Backend API Routes (90 min)

### Step 1: Mining Rewards API
- [ ] Create folder: `app/api/mining/`
- [ ] Create file: `app/api/mining/claim-rewards/route.ts`
- [ ] Copy code from implementation plan
- [ ] Import `supabaseAdmin` at top
- [ ] Test build: `npm run build`

### Step 2: Submarine Upgrade API
- [ ] Create folder: `app/api/submarine/`
- [ ] Create file: `app/api/submarine/upgrade/route.ts`
- [ ] Copy code from implementation plan
- [ ] Test build: `npm run build`

### Step 3: Update Hangar Route
- [ ] Open: `app/api/hangar/purchase/route.ts`
- [ ] Add import: `import { supabaseAdmin } from '@/lib/supabase-admin'`
- [ ] Replace `supabase` with `supabaseAdmin` for writes
- [ ] Test build: `npm run build`

**✅ Phase 2 Complete!** Take a 5-min break.

---

## 🛡️ Phase 3: Validation & Rate Limiting (60 min)

### Step 1: Install Zod
- [ ] Run: `npm install zod`
- [ ] Create file: `lib/validation.ts`
- [ ] Copy validation schemas from plan

### Step 2: Add Validation to APIs
- [ ] Update `app/api/mining/claim-rewards/route.ts`
- [ ] Import and use `MiningClaimSchema.safeParse()`
- [ ] Update `app/api/submarine/upgrade/route.ts`
- [ ] Import and use `SubmarineUpgradeSchema.safeParse()`

### Step 3: Rate Limiting
- [ ] Run: `npm install @upstash/ratelimit @upstash/redis`
- [ ] Create file: `lib/rate-limit.ts`
- [ ] Add rate limit checks to both API routes
- [ ] Test build: `npm run build`

**✅ Phase 3 Complete!** Take a 10-min break.

---

## 💻 Phase 4: Client-Side Updates (75 min)

### Step 1: Find Client DB Writes
- [ ] Run: `grep -r "supabase.from('players').update" app/ components/`
- [ ] List all files with direct writes: _______________

### Step 2: Update Mining Component
- [ ] Find mining component (mine-button.tsx or game/page.tsx)
- [ ] Replace DB write with fetch to `/api/mining/claim-rewards`
- [ ] Add error handling with try/catch
- [ ] Test in browser (npm run dev)

### Step 3: Update Submarine Upgrade
- [ ] Find submarine upgrade button
- [ ] Replace DB write with fetch to `/api/submarine/upgrade`
- [ ] Add error handling
- [ ] Test in browser

### Step 4: Remove All Other Direct Writes
- [ ] Go through each file from Step 1
- [ ] Replace or remove direct writes
- [ ] Keep SELECT (reads) on client, move writes to API

**✅ Phase 4 Complete!** Take a 10-min break.

---

## 🎨 Phase 5: Error Handling (45 min)

### Step 1: Install Toast Library
- [ ] Run: `npm install sonner`
- [ ] Update `app/layout.tsx` to include `<Toaster />`

### Step 2: Add Loading States
- [ ] Mining component: Add `isLoading` state
- [ ] Submarine upgrade: Add `isLoading` state
- [ ] Disable buttons during loading
- [ ] Show "Processing..." text

### Step 3: Add Error Messages
- [ ] Add `error` state to all async operations
- [ ] Show `toast.error()` on failures
- [ ] Show `toast.success()` on success
- [ ] Test all error paths

**✅ Phase 5 Complete!** Take a 10-min break.

---

## 🧪 Phase 6: Testing (60 min)

### Manual Testing Checklist

#### Authentication
- [ ] Sign in works
- [ ] Sign out works
- [ ] Session persists on reload
- [ ] Protected routes redirect when not auth'd

#### Mining
- [ ] Can start mining
- [ ] Can claim rewards
- [ ] Rewards save to database
- [ ] Cannot claim excessive amounts
- [ ] Rate limiting works (try spamming)

#### Submarine Upgrade
- [ ] Upgrade works with enough resources
- [ ] Fails with insufficient resources
- [ ] Tier increases correctly
- [ ] Resources deducted correctly

#### Security
- [ ] Unauthenticated API calls return 401
- [ ] Cannot see other users' data
- [ ] Cannot modify other users' data

#### UI/UX
- [ ] Loading spinners show
- [ ] Success toasts appear
- [ ] Error toasts appear
- [ ] No console errors
- [ ] Responsive on mobile

**✅ Phase 6 Complete!** Almost there!

---

## 🚀 Phase 7: Environment Setup (30 min)

### Step 1: Check .env.local
- [ ] Contains `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Contains `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Contains `SUPABASE_SERVICE_ROLE_KEY` (secret!)
- [ ] Contains `NEXT_PUBLIC_SITE_URL`

### Step 2: Update .gitignore
- [ ] Includes `.env*.local`
- [ ] Includes `.env.production`
- [ ] Keeps `.env.example` (has ! prefix)

### Step 3: Prepare for Deployment
- [ ] Update `.env.example` with all required vars
- [ ] Document any new env vars needed

**✅ Phase 7 Complete!** Ready to deploy!

---

## 🎯 Phase 8: Deploy & Launch (30 min)

### Step 1: Build Locally
- [ ] Run: `npm run build`
- [ ] Fix any TypeScript errors
- [ ] Build succeeds with 0 errors

### Step 2: Test Production Build
- [ ] Run: `npm run start`
- [ ] Test all features locally
- [ ] Verify everything works

### Step 3: Deploy to Vercel
- [ ] Set environment variables in Vercel dashboard:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` (secret!)
  - [ ] `NEXT_PUBLIC_SITE_URL` (production URL)
- [ ] Push to GitHub or run `vercel --prod`
- [ ] Wait for deployment to complete

### Step 4: Verify Production
- [ ] Visit live site
- [ ] Sign in
- [ ] Mine resources
- [ ] Upgrade submarine
- [ ] Check Supabase database for correct data
- [ ] Check Vercel logs (no errors)
- [ ] Run `scripts/check-production-rls.sql` in production Supabase

**✅ Phase 8 Complete!** 🎉 YOU'RE LIVE!

---

## 🏆 Final Verification

### Production is ready when:
- [ ] ✅ All 8 phases checked off
- [ ] ✅ Build succeeds with no errors
- [ ] ✅ Production RLS policies verified (8 policies)
- [ ] ✅ No client-side DB writes remaining
- [ ] ✅ All API routes authenticated
- [ ] ✅ Manual testing complete
- [ ] ✅ Deployed to Vercel
- [ ] ✅ Live site tested and working

---

## 🆘 Quick Troubleshooting

**Error: "Missing SUPABASE_SERVICE_ROLE_KEY"**
→ Add to `.env.local` (not `.env`)

**Error: "new row violates row-level security"**
→ Run `scripts/check-production-rls.sql` and verify policies

**Error: 401 Unauthorized from API**
→ Check user is signed in, verify middleware

**Build fails with TypeScript errors**
→ Fix each error shown in terminal

---

## 📞 Need Help?

- 📖 Full guide: `docs/PRODUCTION-IMPLEMENTATION-PLAN.md`
- 🔒 RLS info: `docs/PRODUCTION-RLS-MIGRATION.md`
- 🔧 Backend patterns: `docs/BACKEND-SERVER-SIDE-PATTERNS.md`
- ✅ Full checklist: `docs/PRODUCTION-READINESS-CHECKLIST.md`

---

**Started at:** ________________  
**Completed at:** ________________  
**Total time:** ________________  

🎮 Happy shipping! 🚀
