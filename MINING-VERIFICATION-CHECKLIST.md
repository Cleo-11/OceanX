# Mining System Verification Checklist

Use this checklist to verify the server-authoritative mining system is properly deployed.

## ✅ Pre-Deployment Verification

### Code Files Created
- [ ] `db/migrations/005-create-resource-nodes.sql` exists
- [ ] `db/migrations/006-create-mining-attempts.sql` exists
- [ ] `db/migrations/007-create-mining-transaction-rpc.sql` exists
- [ ] `server/miningService.js` exists
- [ ] `__tests__/server-mining.test.js` exists
- [ ] `MINING-SYSTEM-DOCUMENTATION.md` exists
- [ ] `MINING-QUICK-REFERENCE.md` exists
- [ ] `MINING-IMPLEMENTATION-COMPLETE.md` exists

### Code Modifications
- [ ] `server/index.js` has `import * as miningService from "./miningService.js"`
- [ ] `server/index.js` has `miningLimiter` defined (lines 305-315)
- [ ] `server/index.js` has `socket.on("mine-resource")` handler (lines ~1470-1605)

### Code Quality
- [ ] No TypeScript/ESLint errors in `server/index.js`
- [ ] No TypeScript/ESLint errors in `server/miningService.js`
- [ ] All files use ES module syntax (`import`/`export`)

## ✅ Database Deployment

### Run Migrations
```bash
# Connect to database
psql $DATABASE_URL

# Run each migration
\i db/migrations/005-create-resource-nodes.sql
\i db/migrations/006-create-mining-attempts.sql
\i db/migrations/007-create-mining-transaction-rpc.sql
```

### Verify Tables Created
- [ ] Table `resource_nodes` exists
  ```sql
  \dt resource_nodes
  ```
- [ ] Table `mining_attempts` exists
  ```sql
  \dt mining_attempts
  ```
- [ ] Function `execute_mining_transaction` exists
  ```sql
  \df execute_mining_transaction
  ```
- [ ] Function `respawn_expired_nodes` exists
  ```sql
  \df respawn_expired_nodes
  ```
- [ ] Function `detect_suspicious_mining_patterns` exists (trigger)
  ```sql
  SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_detect_suspicious_mining';
  ```

### Verify Indexes
- [ ] Indexes on `resource_nodes`:
  ```sql
  \di idx_resource_nodes_session
  \di idx_resource_nodes_status
  \di idx_resource_nodes_claimed_by
  \di idx_resource_nodes_respawn
  \di idx_resource_nodes_position
  ```
- [ ] Indexes on `mining_attempts`:
  ```sql
  \di idx_mining_attempts_wallet
  \di idx_mining_attempts_timestamp
  \di idx_mining_attempts_suspicious
  \di idx_mining_attempts_session_node
  ```

### Verify RLS Policies
- [ ] `resource_nodes` has RLS enabled:
  ```sql
  SELECT tablename, rowsecurity 
  FROM pg_tables 
  WHERE tablename = 'resource_nodes';
  ```
- [ ] `mining_attempts` has RLS enabled:
  ```sql
  SELECT tablename, rowsecurity 
  FROM pg_tables 
  WHERE tablename = 'mining_attempts';
  ```

## ✅ Application Testing

### Run Test Suite
```bash
npm test __tests__/server-mining.test.js
```

- [ ] All unit tests pass (RNG, distance, idempotency)
- [ ] All integration tests pass (validation, execution)
- [ ] All security tests pass (anti-exploit, RNG security)
- [ ] No test failures

### Manual Testing Scenarios

#### Test 1: Successful Mining
```bash
# Start server
npm run dev

# In client console:
socket.emit("mine-resource", {
  nodeId: "test-node-1",
  sessionId: "test-session",
  walletAddress: "0xYourWallet"
});

# Listen for result:
socket.on("mining-result", console.log);
```
- [ ] Receive `mining-result` with `success: true` or `success: false`
- [ ] Check database: `SELECT * FROM mining_attempts ORDER BY attempt_timestamp DESC LIMIT 1;`
- [ ] Verify attempt logged in database

#### Test 2: Rate Limiting
```javascript
// Spam 35 mining attempts rapidly
for (let i = 0; i < 35; i++) {
  socket.emit("mine-resource", {
    nodeId: `node-${i}`,
    sessionId: "test-session",
    walletAddress: "0xYourWallet"
  });
}
```
- [ ] Receive `rate_limit_exceeded` error after 30 attempts
- [ ] Server console shows: `⚠️ Mining rate limit exceeded for wallet`

#### Test 3: Range Validation
```javascript
// Try mining from far away (>50 units)
socket.emit("mine-resource", {
  nodeId: "distant-node",
  sessionId: "test-session",
  walletAddress: "0xYourWallet"
  // Player position: {x: 1000, y: 1000, z: 1000}
  // Node position: {x: 0, y: 0, z: 0}
  // Distance: 1732 units (way over 50)
});
```
- [ ] Receive `out_of_range` error
- [ ] Distance logged in `mining_attempts.distance_to_node`

#### Test 4: Idempotency
```javascript
// Send same attempt ID twice
const attemptId = "test-duplicate-12345";
socket.emit("mine-resource", {
  nodeId: "node-1",
  sessionId: "test-session",
  walletAddress: "0xYourWallet",
  attemptId: attemptId // Custom attempt ID
});

// Wait 100ms, send again
setTimeout(() => {
  socket.emit("mine-resource", {
    nodeId: "node-1",
    sessionId: "test-session",
    walletAddress: "0xYourWallet",
    attemptId: attemptId // Same ID
  });
}, 100);
```
- [ ] Second request returns `duplicate_attempt` error
- [ ] Only ONE entry in database with this `attempt_id`

#### Test 5: Concurrency (Race Condition)
```javascript
// Two players try to mine same node simultaneously
// Player 1:
socket1.emit("mine-resource", {
  nodeId: "contested-node",
  sessionId: "test-session",
  walletAddress: "0xPlayer1"
});

// Player 2 (same instant):
socket2.emit("mine-resource", {
  nodeId: "contested-node",
  sessionId: "test-session",
  walletAddress: "0xPlayer2"
});
```
- [ ] Only ONE player gets `success: true`
- [ ] Other player gets `node_already_claimed` error
- [ ] Database shows `resource_nodes` has `status = 'claimed'` by one wallet

## ✅ Security Verification

### Check Server-Side RNG
- [ ] `miningService.js` imports `crypto` module
- [ ] `secureRandom()` uses `crypto.randomBytes()`
- [ ] No usage of `Math.random()` in mining logic

### Check Client Authority Removed
- [ ] Client does NOT send `amount` or `success` fields
- [ ] Server ignores `requestedResourceType` (validates against DB)
- [ ] All outcomes determined by `determineMiningOutcome()` on server

### Check Atomic Transactions
- [ ] `execute_mining_transaction()` uses `FOR UPDATE` locking
- [ ] Function returns success/error (no silent failures)
- [ ] Error handling triggers rollback

### Check Fraud Detection
```sql
-- Simulate rapid succession (insert 15 attempts in 1 minute)
INSERT INTO mining_attempts (
  attempt_id, player_id, wallet_address, session_id, node_id, 
  success, attempt_timestamp
)
SELECT 
  'test-rapid-' || generate_series,
  1,
  '0xTestWallet',
  'test-session',
  'test-node',
  true,
  NOW() - (generate_series || ' seconds')::INTERVAL
FROM generate_series(1, 15);

-- Check if flagged
SELECT is_suspicious, suspicious_reasons 
FROM mining_attempts 
WHERE wallet_address = '0xTestWallet' 
  AND is_suspicious = true;
```
- [ ] Records with >10 attempts/min flagged with `rapid_succession`

## ✅ Monitoring Setup

### Create Monitoring Queries

**Success Rate Dashboard:**
```sql
CREATE OR REPLACE VIEW mining_success_rates AS
SELECT 
  resource_type,
  COUNT(*) FILTER (WHERE success) AS successes,
  COUNT(*) AS total_attempts,
  ROUND(100.0 * COUNT(*) FILTER (WHERE success) / NULLIF(COUNT(*), 0), 2) AS success_rate_pct,
  DATE_TRUNC('hour', attempt_timestamp) AS hour
FROM mining_attempts
WHERE attempt_timestamp > NOW() - INTERVAL '24 hours'
GROUP BY resource_type, DATE_TRUNC('hour', attempt_timestamp)
ORDER BY hour DESC, resource_type;
```
- [ ] View created successfully
- [ ] Query returns expected success rates (~80% nickel, ~10% manganese)

**Fraud Alert Dashboard:**
```sql
CREATE OR REPLACE VIEW flagged_accounts AS
SELECT 
  wallet_address,
  COUNT(*) AS flagged_attempts,
  ARRAY_AGG(DISTINCT unnest(suspicious_reasons)) AS reasons,
  MAX(attempt_timestamp) AS last_attempt,
  SUM(CASE WHEN success THEN resource_amount ELSE 0 END) AS total_mined
FROM mining_attempts
WHERE is_suspicious = true
  AND attempt_timestamp > NOW() - INTERVAL '7 days'
GROUP BY wallet_address
ORDER BY COUNT(*) DESC;
```
- [ ] View created successfully
- [ ] Test with known flagged wallet

### Set Up Alerts (Optional)

**PostgreSQL Notify Trigger:**
```sql
CREATE OR REPLACE FUNCTION notify_suspicious_mining()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_suspicious AND ARRAY_LENGTH(NEW.suspicious_reasons, 1) >= 2 THEN
    PERFORM pg_notify('suspicious_mining', 
      json_build_object(
        'wallet', NEW.wallet_address,
        'reasons', NEW.suspicious_reasons,
        'timestamp', NEW.attempt_timestamp
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notify_on_suspicious_mining
AFTER INSERT OR UPDATE ON mining_attempts
FOR EACH ROW
WHEN (NEW.is_suspicious = true)
EXECUTE FUNCTION notify_suspicious_mining();
```
- [ ] Trigger created successfully
- [ ] Listen for notifications: `LISTEN suspicious_mining;`

## ✅ Performance Verification

### Load Testing
```bash
# Use artillery or similar
artillery quick --count 100 --num 30 wss://your-server.com
```
- [ ] Server handles 100 concurrent connections
- [ ] Average response time <200ms
- [ ] No rate limit false positives
- [ ] Database CPU <50%

### Database Performance
```sql
-- Check query performance
EXPLAIN ANALYZE
SELECT * FROM resource_nodes
WHERE session_id = 'test-session'
  AND status = 'available'
  AND respawn_at < NOW();
```
- [ ] Uses index scan (not seq scan)
- [ ] Execution time <10ms

```sql
-- Check mining_attempts insert performance
EXPLAIN ANALYZE
INSERT INTO mining_attempts (
  attempt_id, player_id, wallet_address, session_id, node_id, success
) VALUES (
  'perf-test-123', 1, '0xPerfTest', 'session-1', 'node-1', true
);
```
- [ ] Trigger executes in <10ms
- [ ] No locking issues

## ✅ Documentation Review

- [ ] `MINING-SYSTEM-DOCUMENTATION.md` is complete
- [ ] `MINING-QUICK-REFERENCE.md` is accurate
- [ ] `MINING-IMPLEMENTATION-COMPLETE.md` matches actual implementation
- [ ] All code comments are clear
- [ ] API examples work as documented

## ✅ Rollback Preparation

- [ ] Backup current database:
  ```bash
  pg_dump $DATABASE_URL > backup-pre-mining-$(date +%Y%m%d).sql
  ```
- [ ] Document rollback procedure (see `MINING-IMPLEMENTATION-COMPLETE.md`)
- [ ] Test emergency disable (comment out WebSocket handler)
- [ ] Verify non-mining features still work with handler disabled

## ✅ Production Deployment

### Pre-Flight Checklist
- [ ] All tests passing locally
- [ ] Database migrations applied to staging
- [ ] Staging testing complete
- [ ] Documentation reviewed
- [ ] Team briefed on new features

### Deployment Steps
1. [ ] Deploy database migrations to production
2. [ ] Deploy application code (with mining handler)
3. [ ] Monitor logs for first 10 minutes
4. [ ] Run smoke tests (manual mining attempts)
5. [ ] Check database for logged attempts
6. [ ] Verify rate limiting working
7. [ ] Check fraud detection flags

### Post-Deployment Monitoring (First 24 Hours)
- [ ] Monitor success rates (should match DROP_RATES)
- [ ] Check for excessive rate limit hits
- [ ] Review flagged accounts
- [ ] Monitor database CPU/memory
- [ ] Check average processing times
- [ ] Review error logs for unexpected failures

## ✅ Success Criteria

### Functional Requirements
- [x] Mining requests handled via WebSocket
- [x] All outcomes determined server-side
- [x] Resources added to player accounts
- [x] Nodes transition through states correctly
- [x] Respawn timers work

### Security Requirements
- [x] No client-side authority
- [x] Server-side RNG only
- [x] Atomic transactions prevent double-claiming
- [x] Rate limiting enforced
- [x] Idempotency prevents duplicates
- [x] Range validation prevents teleportation
- [x] Cooldown enforced
- [x] Prerequisites validated
- [x] Fraud detection active
- [x] Comprehensive audit trail

### Performance Requirements
- [ ] <200ms average processing time
- [ ] Handles 50+ TPS mining attempts
- [ ] No database deadlocks
- [ ] No memory leaks

### Operational Requirements
- [ ] Monitoring dashboards set up
- [ ] Alert system configured (optional)
- [ ] Rollback procedure tested
- [ ] Documentation complete
- [ ] Team trained on new system

---

## 🎉 Sign-Off

**Verified By**: ___________________  
**Date**: ___________________  
**Environment**: [ ] Staging  [ ] Production  
**Status**: [ ] Approved  [ ] Issues Found  

**Notes**:
_______________________________________________________
_______________________________________________________
_______________________________________________________

---

**Next Steps After Sign-Off:**
1. Monitor production for 24 hours
2. Review fraud detection flags weekly
3. Tune configuration based on metrics
4. Plan Phase 2 features (rarity system, leaderboards)
