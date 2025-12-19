# OceanX Hosting Cost Analysis

**Last Updated**: December 16, 2025  
**Target Users**: 500-2,000 monthly active users

---

## 📊 Traffic & Usage Estimates

Based on the OceanX gaming platform architecture:

- **Monthly Active Users**: 500-2,000
- **Concurrent Users (Peak)**: ~20-80
- **Monthly API Requests**: ~500k-2M
- **Database Operations**: ~1-4M reads/writes
- **Bandwidth**: ~50-200GB/month
- **Real-time WebSocket Connections**: 20-80 concurrent
- **Storage Needs**: Moderate (user data, game state, blockchain signatures)

---

## 1️⃣ Render (Backend Server)

### Current Stack
- Express.js backend with Socket.IO for real-time gameplay
- Game state management
- Blockchain integration (claim signatures)
- Mining service & resource management
- WebSocket support required

### Pricing Tiers

| Tier | Monthly Cost | Resources | RAM | Status |
|------|--------------|-----------|-----|--------|
| **Free** | $0 | Sleeps after 15min idle | 512MB | ❌ Not suitable |
| **Starter** | $7 | Always-on | 512MB | ⚠️ Too limited |
| **Standard** | $25 | Better performance | 2GB | ✅ **RECOMMENDED** |
| **Pro** | $85 | High availability | 4GB | 🔥 For scaling |

### Why Free/Starter Won't Work
- Free tier sleeps = broken WebSocket connections
- Starter's 512MB RAM insufficient for Socket.IO + Express + multiple concurrent users
- Real-time gaming requires always-on service

### Recommendation
**Start with Standard ($25/month)**
- Handles 500-1k users reliably
- 2GB RAM sufficient for WebSocket connections
- No sleep issues
- Predictable performance

### Upgrade Triggers → Pro ($85/month)
- Memory usage consistently >1.5GB
- CPU usage >70% sustained
- >50 concurrent WebSocket connections
- API response time p95 >500ms
- Approaching 1,500+ active users

---

## 2️⃣ Vercel (Frontend - Next.js)

### Current Stack
- Next.js 14 with App Router
- Server-side rendering
- Dynamic routes (game, marketplace, profile, submarine-hangar, submarine-store)
- API routes for wallet connection
- Multiple client components with framer-motion animations

### Pricing Tiers

| Tier | Monthly Cost | Bandwidth | Serverless Invocations | Edge Functions |
|------|--------------|-----------|------------------------|----------------|
| **Hobby** | $0 | 100GB | 6,000/day (180k/month) | Unlimited |
| **Pro** | $20/seat | 1TB | 1M/month | Unlimited |

### Hobby Tier Breakdown
- **Bandwidth**: 100GB = ~500k page loads (assuming 200KB per page)
- **Serverless Functions**: 6k/day = 180k/month
- **Build Minutes**: 6,000/month
- **Image Optimization**: 1,000 source images
- **Edge Functions**: Unlimited executions
- **Deployments**: Unlimited

### Why Hobby Works Initially
- 500-2k users generate ~50k-200k page loads/month
- Serverless invocations within limits
- Edge caching reduces origin requests
- Next.js static optimization helps

### Recommendation
**Start with Hobby ($0/month)**
- Easily handles 500-1k users
- Generous limits for small-scale production
- Only pay when you exceed limits

### Upgrade Triggers → Pro ($20/month)
- Bandwidth consistently >80GB/month (3 consecutive months)
- Serverless invocations >150k/month
- Need team collaboration features
- Want preview URLs for pull requests
- Image optimization needs increase
- Require password protection for preview deployments

---

## 3️⃣ Supabase (Database & Storage)

### Current Stack
PostgreSQL database with:
- `players` - User profiles and game state
- `game_sessions` - Active gameplay sessions
- `mining_attempts` - Resource mining history
- `trades` - Marketplace transactions
- `submarine_tiers` - Game configuration
- `pending_actions` - Async operations queue
- `claim_signatures` - Blockchain signature storage
- `resource_nodes` - Game world state
- `upgrade_transactions` - Player purchases

Plus:
- Row Level Security (RLS) enabled
- Real-time subscriptions
- Auth helpers
- Supabase Storage for assets

### Pricing Tiers

| Tier | Monthly Cost | Database | Storage | Bandwidth | Backups | Support |
|------|--------------|----------|---------|-----------|---------|---------|
| **Free** | $0 | 500MB | 1GB | 5GB | ❌ None | Community |
| **Pro** | $25 | 8GB | 100GB | 250GB | 7-day | Email |
| **Team** | $599 | 64GB | 200GB | 500GB | PITR | Priority |

### Database Size Estimation (1,000 users)

```
Players table:         ~50MB  (1k rows × ~50KB each)
Game sessions:        ~100MB  (historical data, high turnover)
Mining attempts:      ~150MB  (high write volume from gameplay)
Trades:                ~30MB  (marketplace transactions)
Claim signatures:      ~40MB  (blockchain integration)
Other tables:          ~30MB  (config, nodes, actions)
───────────────────────────
TOTAL:                ~400MB  ⚠️ Approaching Free limit
```

At 2,000 users: **~700MB** (exceeds Free tier)

### Critical Issue with Free Tier
⚠️ **No backups** - If database corrupts, all game progress is lost!
⚠️ **Pauses after 1 week of inactivity** - Not acceptable for production
⚠️ **Only 2 concurrent real-time connections** - Insufficient for multiplayer

### Recommendation
**Upgrade to Pro ($25/month) IMMEDIATELY for production** ✅

Even if starting with <500 users, Pro is essential because:
- ✅ **Daily backups** (7-day retention) - Critical for gaming platform
- ✅ **No auto-pause** - Always available
- ✅ **8GB database** - Room to grow to 10k+ users
- ✅ **Email support** - Direct help when issues arise
- ✅ **No connection limits** - Unlimited real-time subscriptions
- ✅ **Production SLA** - 99.9% uptime guarantee

### Upgrade Triggers → Team ($599/month)
- Database size >6GB
- Need point-in-time recovery (custom restore points)
- >100k monthly active users
- Require dedicated support
- Need read replicas for scaling

---

## 💰 Total Cost Summary

### Phase 1: Initial Launch (0-500 users) - Minimum Viable

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| Render Backend | Standard | $25 |
| Vercel Frontend | Hobby | $0 |
| Supabase | Free | $0 |
| **TOTAL** | | **$25/month** |

**⚠️ Risk**: No database backups. Single point of failure.  
**Use case**: MVP testing, beta launch only

---

### Phase 2: Production Launch (500-1,500 users) - RECOMMENDED ✅

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| Render Backend | Standard | $25 |
| Vercel Frontend | Hobby | $0 |
| Supabase | **Pro** | $25 |
| **TOTAL** | | **$50/month ($600/year)** |

**✅ This is the sweet spot for production launch**
- Reliable backups
- Room to scale
- Professional support
- All critical features covered

---

### Phase 3: Active Growth (1,500-2,000 users)

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| Render Backend | Pro | $85 |
| Vercel Frontend | Hobby | $0 |
| Supabase | Pro | $25 |
| **TOTAL** | | **$110/month** |

**Upgrade backend when**: >60 concurrent users, increased load

---

### Phase 4: Scaling Up (2,000+ users)

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| Render Backend | Pro | $85 |
| Vercel Frontend | Pro | $20 |
| Supabase | Pro | $25 |
| **TOTAL** | | **$130/month** |

**Full production stack** with team features and maximum performance

---

## 🚨 Upgrade Triggers - When to Scale

### Render Backend Metrics

```bash
# Upgrade from Standard ($25) → Pro ($85) when:

✓ Memory usage consistently >1.5GB (check Render dashboard)
✓ CPU usage >70% sustained (over 1 week)
✓ >50 concurrent WebSocket connections
✓ API response time p95 >500ms
✓ Error rate >1% on critical endpoints
✓ Database connection pool exhaustion
```

**How to monitor**: Render dashboard → Metrics tab

---

### Vercel Frontend Metrics

```bash
# Upgrade from Hobby ($0) → Pro ($20) when:

✓ Bandwidth >80GB/month (3 consecutive months)
✓ Serverless invocations >150k/month
✓ Build timeouts or failures
✓ Need team collaboration (multiple developers)
✓ Want automatic preview deployments for PRs
✓ Image optimization limit reached (>1k source images)
```

**How to monitor**: Vercel dashboard → Usage tab

---

### Supabase Database Metrics

```bash
# Upgrade from Free ($0) → Pro ($25) - DO THIS NOW:

✓ Database size >300MB
✓ Need ANY backups (critical for production)
✓ Active production app
✓ >2 real-time connections needed
✓ Want email support

# Upgrade from Pro ($25) → Team ($599) when:

✓ Database size >6GB
✓ Need point-in-time recovery
✓ >100k monthly active users
✓ Require read replicas
✓ Need dedicated support
```

**How to monitor**: Supabase dashboard → Settings → Usage

---

## 💡 Cost Optimization Strategies

### 1. Implement Caching Layer
```
Add Redis/Upstash for frequently accessed data
Cost: ~$10-20/month
Savings: Reduces DB reads by 40-60%
```

### 2. Use Vercel Edge Functions
```
Move lightweight API routes to Edge
Cost: Free (included in Hobby)
Benefit: Faster response times, reduced serverless invocations
```

### 3. Optimize Database Queries
```
- Add indexes on frequently queried columns
- Use connection pooling (included in Supabase Pro)
- Archive old game sessions to separate table
- Implement query result caching
```

### 4. Enable Compression
```
- Gzip responses in Express backend
- Use Vercel's automatic asset compression
- Compress WebSocket messages
```

### 5. Image Optimization
```
- Use Vercel's built-in image optimization
- Serve images from Supabase Storage
- Implement lazy loading
- Use modern formats (WebP, AVIF)
```

### 6. Archive Old Data
```
- Move game sessions older than 90 days to cold storage
- Archive completed trades
- Keep only recent mining attempts
- Estimated savings: 30-40% database size reduction
```

---

## 📈 Growth Projections

### Monthly Costs by User Count

| Users | Render | Vercel | Supabase | Total | Notes |
|-------|--------|--------|----------|-------|-------|
| 0-500 | $25 | $0 | $0 | **$25** | MVP only |
| 500-1k | $25 | $0 | $25 | **$50** | Production ready ✅ |
| 1k-1.5k | $25 | $0 | $25 | **$50** | Comfortable range |
| 1.5k-2k | $85 | $0 | $25 | **$110** | Backend scaling |
| 2k-3k | $85 | $20 | $25 | **$130** | Full stack scaling |
| 3k-5k | $85 | $20 | $25 | **$130** | Optimized |
| 5k-10k | $85 | $20 | $25-599 | **$130-704** | May need DB upgrade |

### Annual Cost Estimate

```
Year 1 breakdown (assuming growth):
- Months 1-3:   $50/mo  = $150
- Months 4-8:   $50/mo  = $250  
- Months 9-12:  $110/mo = $440
───────────────────────────────
Total Year 1:          $840

Average: ~$70/month in year 1
```

---

## 🎯 Final Recommendation

### For OceanX Production Launch (500-2k users):

```
╔════════════════════════════════════════╗
║  RECOMMENDED PRODUCTION STACK          ║
╠════════════════════════════════════════╣
║  Render Standard:      $25/month       ║
║  Vercel Hobby:         $0/month        ║
║  Supabase Pro:         $25/month       ║
║                                        ║
║  TOTAL:               $50/month        ║
║  Annual:              $600/year        ║
╚════════════════════════════════════════╝
```

### Why This Configuration?

✅ **Supabase Pro is non-negotiable** - Gaming platforms need backups  
✅ **Render Standard** - Handles real-time WebSocket connections reliably  
✅ **Vercel Hobby** - Generous free tier perfect for this traffic level  
✅ **Total cost reasonable** - $600/year for a production gaming platform  
✅ **Room to grow** - Can scale to 5k+ users without major changes

### Budget Planning

- **Month 1 (Setup)**: $50
- **Months 2-6 (Growth)**: $50/month average
- **Months 7-12 (Scale)**: $80-110/month average
- **Year 1 Total**: $600-1,000
- **Year 2 Total**: $1,200-1,800 (with growth)

---

## 🔍 Monitoring Setup

### Key Metrics to Track

1. **Render Backend**
   - Memory usage (alert at 1.5GB)
   - CPU usage (alert at 70%)
   - Response times (alert at 500ms p95)
   - Error rate (alert at 1%)

2. **Vercel Frontend**
   - Monthly bandwidth (alert at 80GB)
   - Serverless invocations (alert at 150k)
   - Build times (alert at failures)

3. **Supabase Database**
   - Database size (alert at 6GB)
   - Connection pool usage (alert at 80%)
   - Query performance (slow query log)
   - Backup success rate (alert on failures)

### Recommended Monitoring Tools

- **Render**: Built-in dashboard + Sentry integration (you already have this!)
- **Vercel**: Built-in analytics
- **Supabase**: Dashboard + pg_stat_statements for query analysis
- **External**: Consider adding Datadog or New Relic at 2k+ users

---

## 📞 Support Contacts

| Service | Support Level | Response Time |
|---------|---------------|---------------|
| Render Standard | Email | 24-48 hours |
| Vercel Hobby | Community | Best effort |
| Supabase Pro | Email | 24 hours |

Upgrade to paid tiers for priority support.

---

## ✅ Action Items

### Before Launch
- [ ] Upgrade Supabase to Pro ($25/month) - **CRITICAL**
- [ ] Verify Render is on Standard plan ($25/month)
- [ ] Confirm Vercel Hobby limits are understood
- [ ] Set up monitoring alerts
- [ ] Test backup restoration process
- [ ] Configure Sentry for error tracking

### Month 1 After Launch
- [ ] Review actual usage vs. projections
- [ ] Analyze slow queries in Supabase
- [ ] Check Render memory patterns
- [ ] Verify backup success rate
- [ ] Collect user feedback on performance

### Every 3 Months
- [ ] Review cost vs. usage metrics
- [ ] Evaluate optimization opportunities
- [ ] Plan for scaling if approaching limits
- [ ] Test disaster recovery procedures

---

## 📚 Additional Resources

- [Render Pricing](https://render.com/pricing)
- [Vercel Pricing](https://vercel.com/pricing)
- [Supabase Pricing](https://supabase.com/pricing)
- [OceanX Deployment Guide](./DEPLOYMENT-GUIDE.md)
- [OceanX Production Readiness](./PRODUCTION-READINESS-CHECKLIST.md)

---

**Document Version**: 1.0  
**Next Review**: March 2026 (or after reaching 1,000 users)
