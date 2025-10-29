# 🚀 Production Readiness Checklist - OceanX

## Overview

This checklist ensures your OceanX game is secure, performant, and ready for production deployment.

**Current Status:** 🟡 Demo-Safe (RLS policies applied, but permissive)  
**Target Status:** 🟢 Production-Ready (Strict security, optimized, tested)

---

## 🔒 Security (Critical)

### Database & RLS
- [x] ✅ Demo-safe RLS policies applied to `players` table
- [x] ✅ Demo-safe RLS policies applied to `pending_actions` table
- [ ] ⚠️ Production RLS policies applied (`scripts/production-rls-policies.sql`)
- [ ] ⚠️ RLS policies verified (`scripts/check-production-rls.sql`)
- [ ] Service role key stored in `.env.local` (not exposed to client)
- [ ] All database queries use indexes on foreign keys (`user_id`, etc.)

### Authentication & Authorization
- [ ] Moralis/wallet auth correctly integrated
- [ ] User sessions persist across page reloads
- [ ] Middleware protects authenticated routes (`middleware.ts`)
- [ ] Unauthorized users redirected to login
- [ ] JWT tokens validated on backend API routes

### API Security
- [ ] All API routes validate authentication
- [ ] Input validation implemented (Zod or similar)
- [ ] Rate limiting on sensitive endpoints
- [ ] CORS configured correctly
- [ ] No sensitive data exposed in error messages
- [ ] Service role key never exposed to client

### Environment Variables
- [ ] `.env.local` contains server-only secrets
- [ ] `.env` or `.env.production` contains client-safe vars
- [ ] `NEXT_PUBLIC_*` prefix only on client-safe variables
- [ ] No secrets committed to git (`.gitignore` configured)
- [ ] Production env vars set in Vercel/hosting dashboard

---

## 🎨 Frontend (Important)

### UI/UX Polish
- [ ] Loading states on all async operations
  - [ ] Player profile fetch
  - [ ] Submarine data fetch
  - [ ] Marketplace items
  - [ ] Mining actions
  - [ ] Contract transactions
- [ ] Error states with user-friendly messages
  - [ ] API failures
  - [ ] Network errors
  - [ ] Contract reverts
- [ ] Empty states (no submarines, no items, no history)
- [ ] Success notifications (upgrades, purchases, mining rewards)

### Responsive Design
- [ ] Mobile (320px - 767px) tested
- [ ] Tablet (768px - 1023px) tested
- [ ] Desktop (1024px+) tested
- [ ] Touch interactions work on mobile
- [ ] Navigation accessible on all screen sizes

### Performance
- [ ] Three.js scenes optimized
  - [ ] 3D models compressed (gltf-transform)
  - [ ] Textures optimized
  - [ ] 60fps maintained
  - [ ] Level-of-detail (LOD) for complex assets
- [ ] Images optimized (Next.js Image component)
- [ ] Code splitting implemented
- [ ] Bundle size analyzed (`next build` output)
- [ ] Lighthouse score > 90 (performance, accessibility)

### Error Handling
- [ ] Error boundary wraps app (`components/error-boundary.tsx`)
- [ ] Hydration errors resolved
- [ ] Console errors/warnings addressed
- [ ] Network failures handled gracefully

---

## ⚙️ Backend (Important)

### API Routes
- [ ] All routes use proper HTTP methods (GET, POST, PUT, DELETE)
- [ ] Request validation on all POST/PUT/PATCH routes
- [ ] Server-side logic for privileged operations
  - [ ] Mining rewards → `/api/mining/claim-rewards`
  - [ ] Submarine upgrades → `/api/submarine/upgrade`
  - [ ] Resource updates → `/api/resources/update`
- [ ] No client-side trust (all calculations on server)

### Database
- [ ] Migrations tracked in `db/migrations/`
- [ ] Indexes on frequently queried columns
  - [ ] `players.user_id`
  - [ ] `players.wallet_address`
  - [ ] `pending_actions.user_id`
- [ ] Connection pooling configured (Supabase PgBouncer)
- [ ] No N+1 queries (use `.select()` with joins)

### Logging & Monitoring
- [ ] Error logging configured (Sentry, LogRocket, etc.)
- [ ] API request logging
- [ ] Privileged operations logged for audit trail
- [ ] Performance monitoring (Vercel Analytics, etc.)

---

## 🔗 Smart Contract Integration (Important)

### Contract Interaction
- [ ] Ethers.js v6 properly configured
- [ ] Contract addresses in environment variables
- [ ] ABI files up-to-date
- [ ] Gas estimation implemented
- [ ] Revert handling with user-friendly messages
- [ ] Transaction confirmations awaited
- [ ] Loading states during transactions

### Wallet Integration
- [ ] Wallet connection flow tested
- [ ] Disconnect functionality works
- [ ] Network switching handled (Base/Sepolia)
- [ ] Wrong network detection and prompts
- [ ] Account change detection

### Error Handling
- [ ] User rejected transaction
- [ ] Insufficient gas
- [ ] Contract revert reasons displayed
- [ ] Network errors

---

## 🧪 Testing (Nice-to-Have)

### Unit Tests
- [ ] Critical utility functions tested
- [ ] Component rendering tests
- [ ] API route logic tests

### Integration Tests
- [ ] Auth flow (sign in → profile created)
- [ ] Mining flow (start → complete → rewards)
- [ ] Submarine upgrade flow
- [ ] Marketplace purchase flow

### E2E Tests (Optional)
- [ ] Full user journey (sign in → mine → upgrade)
- [ ] Cross-browser testing (Chrome, Safari, Firefox)

---

## 🚀 Deployment (Critical)

### Pre-Deployment
- [ ] Build succeeds locally (`npm run build`)
- [ ] No TypeScript errors
- [ ] No ESLint errors (or warnings addressed)
- [ ] Environment variables documented

### CI/CD
- [ ] GitHub Actions workflow configured
- [ ] Automated tests run on PR
- [ ] Automated deployment on merge to `main`
- [ ] Database migrations run automatically (or documented)

### Hosting Configuration
- [ ] Vercel project configured
- [ ] Environment variables set in Vercel dashboard
- [ ] Custom domain configured (if applicable)
- [ ] HTTPS enabled
- [ ] Preview deployments work

### Post-Deployment
- [ ] Health check endpoint (`/api/health`)
- [ ] Smoke tests passed (can sign in, view profile, start game)
- [ ] Production database connection verified
- [ ] Production RLS policies applied and tested

---

## 📊 Performance Benchmarks

### Target Metrics
- [ ] Page load < 3 seconds (3G)
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3.5s
- [ ] 3D scene renders at 60fps
- [ ] API response times < 500ms (p95)

### Monitoring
- [ ] Core Web Vitals tracked
- [ ] Error rate < 1%
- [ ] Uptime > 99.9%

---

## 📚 Documentation (Nice-to-Have)

### User-Facing
- [ ] README with game description
- [ ] How to play guide
- [ ] FAQ section
- [ ] Troubleshooting guide

### Developer-Facing
- [ ] Setup instructions (`README.md`)
- [ ] Environment variable documentation
- [ ] Database schema documentation
- [ ] API endpoint documentation
- [ ] Deployment guide

---

## 🎯 Go-Live Checklist

**Before announcing to users:**

1. **Security**
   - [ ] Production RLS policies applied
   - [ ] All secrets secured
   - [ ] API routes protected

2. **Functionality**
   - [ ] Sign in/sign up works
   - [ ] Profile creation automatic
   - [ ] Mining works end-to-end
   - [ ] Submarine upgrades work
   - [ ] Rewards calculation correct

3. **Performance**
   - [ ] Load times acceptable
   - [ ] No memory leaks in 3D scenes
   - [ ] Database queries optimized

4. **Monitoring**
   - [ ] Error tracking configured
   - [ ] Analytics enabled
   - [ ] Alerts set up (downtime, errors)

5. **Backup & Recovery**
   - [ ] Database backup strategy
   - [ ] Rollback plan documented
   - [ ] Recovery tested

---

## 🆘 Emergency Rollback

If critical issues arise in production:

### Quick Rollback Steps

1. **Revert deployment**
   ```bash
   # In Vercel dashboard, select previous deployment
   # Click "Promote to Production"
   ```

2. **Rollback RLS policies** (if needed)
   ```sql
   -- Run demo-safe policies from SUPABASE-RLS-FIX.md
   ```

3. **Communicate with users**
   - Post status update
   - Estimate fix timeline
   - Apologize for inconvenience

---

## 📈 Progress Tracking

### Phase 1: Demo-Safe (Current)
- [x] Basic RLS policies applied
- [x] Core game features working
- [x] Demo-ready

### Phase 2: Production Prep (In Progress)
- [ ] Production RLS policies applied
- [ ] Backend API routes secured
- [ ] Testing completed
- [ ] Documentation updated

### Phase 3: Production Launch (Target)
- [ ] All security measures in place
- [ ] Performance optimized
- [ ] Monitoring configured
- [ ] Users onboarded

---

## 🔗 Quick Links

- [Demo RLS Fix](../SUPABASE-RLS-FIX.md)
- [Production RLS Policies](../scripts/production-rls-policies.sql)
- [Backend Patterns](./BACKEND-SERVER-SIDE-PATTERNS.md)
- [Migration Guide](./PRODUCTION-RLS-MIGRATION.md)
- [Scripts README](../scripts/README.md)

---

## 📞 Need Help?

**Common Issues:**
- RLS policy errors → See `SUPABASE-RLS-FIX.md`
- Backend patterns → See `BACKEND-SERVER-SIDE-PATTERNS.md`
- Migration steps → See `PRODUCTION-RLS-MIGRATION.md`

**Still stuck?**
- Check Supabase logs (Dashboard → Logs)
- Check Vercel logs (Dashboard → Logs)
- Review error tracking (Sentry, etc.)
