# 🚀 DEMO DEPLOYMENT CHECKLIST

## ✅ FIXES APPLIED (Just Now)

### 1. **WebSocket Performance Fixed** ✅
- ❌ **Before**: Polling enabled → massive overhead with 100+ users
- ✅ **After**: WebSocket-only, connection limits (5 per IP), rate limiting

### 2. **Player Auto-Creation** ✅
- ❌ **Before**: New users got "Player not found" errors
- ✅ **After**: Auto-creates player record in Supabase on first join

### 3. **Error Boundaries** ✅
- ❌ **Before**: Any React error crashed entire app
- ✅ **After**: Graceful error handling with reload option

### 4. **Socket Rate Limiting** ✅
- ❌ **Before**: No enforcement, just tracking
- ✅ **After**: Blocks spam (100 msg/min global, 30 moves/sec, 10 mines/5sec)

---

## 🔥 CRITICAL - VERIFY THESE NOW

### 1. **Supabase Schema Check** (Share with me)
Please run this in Supabase SQL Editor and share the output:

```sql
-- Check if players table exists and has correct columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'players'
ORDER BY ordinal_position;

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('players', 'player_sessions', 'player_stats');

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('players', 'player_sessions', 'player_stats')
ORDER BY tablename, indexname;
```

**CRITICAL**: If RLS policies show `USING (true)` or `WITH CHECK (true)`, they're **BROKEN** (anyone can edit anyone's data).

---

### 2. **Environment Variables Check**

#### **Render (Backend) - Verify These Exist:**
```bash
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://your-app.vercel.app
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
BACKEND_PRIVATE_KEY=0x... (wallet with ETH for claims)
GAME_CONTRACT_ADDRESS=0x...
```

#### **Vercel (Frontend) - Verify These Exist:**
```bash
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
NEXT_PUBLIC_API_URL=https://oceanx-backend.onrender.com
NEXT_PUBLIC_WS_URL=wss://oceanx-backend.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
GAME_CONTRACT_ADDRESS=0x...
```

---

### 3. **Deploy Updated Backend** 🚨

The changes I made to `server/index.js` need to be deployed:

```bash
# Commit changes
git add server/index.js lib/websocket.ts
git commit -m "fix: add WebSocket limits, player auto-init, rate limiting"
git push origin master
```

**Render will auto-deploy** (check build logs in Render dashboard)

---

### 4. **Deploy Updated Frontend** 🚨

```bash
# Commit changes
git add components/error-boundary.tsx app/game/page.tsx
git commit -m "feat: add error boundary for crash protection"
git push origin master
```

**Vercel will auto-deploy** (check deployment in Vercel dashboard)

---

## 🧪 TESTING CHECKLIST (After Deploy)

### **Test 1: Wallet Connection**
1. ✅ Visit `https://your-app.vercel.app/game`
2. ✅ Click "Connect Wallet"
3. ✅ MetaMask pops up → Sign message
4. ✅ No errors in browser console

### **Test 2: First-Time User**
1. ✅ Connect with a NEW wallet (never used before)
2. ✅ Check browser DevTools Network tab → WebSocket connects
3. ✅ Player joins game (no "Player not found" error)
4. ✅ Check Supabase `players` table → new row created

### **Test 3: Game Functionality**
1. ✅ Move submarine with arrow keys/WASD
2. ✅ Mine resources (click on nodes)
3. ✅ Resources show in UI
4. ✅ No crashes/white screens

### **Test 4: Multiple Users**
1. ✅ Open game in incognito window with different wallet
2. ✅ Both players see each other moving
3. ✅ Mining works for both

### **Test 5: Error Recovery**
1. ✅ Disconnect internet → reconnect
2. ✅ Game shows error boundary (not white screen)
3. ✅ Click "Reload Game" → works

---

## ⚠️ KNOWN ISSUES TO FIX BEFORE DEMO

### **Issue #1: CORS Headers** (If WebSocket Fails)
If you get `CORS error` in browser console:

**In Render Dashboard → Environment:**
```
FRONTEND_URL=https://your-actual-vercel-app.vercel.app
```
(Make sure it matches exactly!)

### **Issue #2: WebSocket URL**
If WebSocket doesn't connect, verify in **Vercel → Environment:**
```
NEXT_PUBLIC_WS_URL=wss://oceanx-backend.onrender.com
```
(Note: `wss://` not `ws://` for production)

### **Issue #3: Supabase RLS**
If players can't read their own data:

**Run in Supabase SQL Editor:**
```sql
-- Temporarily disable RLS for demo (NOT FOR PRODUCTION!)
ALTER TABLE players DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_sessions DISABLE ROW LEVEL SECURITY;

-- Better: Fix policies (share your current schema first)
```

---

## 📊 MONITORING DURING DEMO

### **Backend Health Check**
```bash
curl https://oceanx-backend.onrender.com/health
```
Should return:
```json
{
  "status": "OK",
  "timestamp": "2025-10-03T...",
  "activeSessions": 0,
  "totalPlayers": 0,
  "claimServiceAvailable": true
}
```

### **Check Render Logs**
1. Render Dashboard → Your Service → Logs
2. Look for:
   - ✅ `"✅ Supabase client initialized"`
   - ✅ `"✅ Claim service loaded"`
   - ✅ `"✅ Server is live on port 5000"`
   - ❌ Any errors with `❌` prefix

### **Check Vercel Logs**
1. Vercel Dashboard → Your Project → Deployments
2. Click latest deployment → Runtime Logs
3. Look for errors during page load

---

## 🚨 EMERGENCY FIXES (During Demo)

### If WebSocket Won't Connect:
```javascript
// Temporarily add to lib/websocket.ts line 76
transports: ["websocket", "polling"], // Re-enable polling as fallback
```

### If Players Can't Join:
```javascript
// In server/index.js, comment out signature verification (lines 814-829)
// ONLY FOR EMERGENCY - removes security!
// try {
//   verification = verifyJoinSignature(...)
// } catch (error) {
//   ...
// }

// Replace with:
const verification = {
  wallet: sanitizedWallet,
  timestamp: Date.now(),
  session: sanitizedSessionId
};
```

### If Supabase RLS Blocks Everything:
```sql
-- Run in Supabase SQL Editor
ALTER TABLE players DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_sessions DISABLE ROW LEVEL SECURITY;
```

---

## 📋 NEXT STEPS

1. **Share Supabase schema output** (from SQL query above)
2. **Verify env vars** in Render + Vercel dashboards
3. **Deploy updates** (git push)
4. **Test end-to-end** (wallet → game → mine)
5. **Load test with 5-10 simultaneous users** (friends/team)

Once I see your Supabase schema, I can:
- ✅ Verify RLS policies are secure
- ✅ Add missing indexes for performance
- ✅ Check if any columns are missing

**What's your Supabase schema look like?** (Share SQL output or table structure)
