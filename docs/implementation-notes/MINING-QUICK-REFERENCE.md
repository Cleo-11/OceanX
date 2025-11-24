# Mining System Quick Reference

## 🎯 One-Page Cheat Sheet

### Security Checklist (10/10 ✅)

- [x] **Server-authoritative mining** - All RNG on server
- [x] **Atomic node state** - PostgreSQL row locking
- [x] **Prerequisites validated** - Range, cooldown, node status
- [x] **Server-side randomness** - crypto.randomBytes()
- [x] **Idempotency** - Unique attempt IDs
- [x] **Rate limiting** - 30/min per wallet, 60/min per IP
- [x] **Sign after validation** - Never trust client results
- [x] **Comprehensive logging** - Every attempt logged
- [x] **Fraud detection** - Auto-flagging triggers
- [x] **Client graceful** - Wait for server response

### File Locations

```
db/migrations/
├── 005-create-resource-nodes.sql      ← Node state management
├── 006-create-mining-attempts.sql     ← Audit trail + fraud detection
└── 007-create-mining-transaction-rpc.sql ← Atomic transaction

server/
├── miningService.js    ← Core mining logic
└── index.js            ← WebSocket handler (line ~1470)

__tests__/
└── server-mining.test.js ← Comprehensive tests

MINING-SYSTEM-DOCUMENTATION.md ← Full docs
```

### Configuration Quick Edit

**server/miningService.js:**
```javascript
export const MINING_CONFIG = {
  MAX_MINING_RANGE: 50,              // Change range limit
  GLOBAL_MINING_COOLDOWN_MS: 2000,   // Change cooldown
  MAX_ATTEMPTS_PER_MINUTE: 30,       // Change rate limit
  
  RESOURCE_AMOUNTS: {
    nickel: { min: 1, max: 5 },      // Change yields
  },
  
  DROP_RATES: {
    nickel: 0.80,                    // Change probabilities
  }
};
```

### Common Operations

**Run migrations:**
```bash
psql $DATABASE_URL
\i db/migrations/005-create-resource-nodes.sql
\i db/migrations/006-create-mining-attempts.sql
\i db/migrations/007-create-mining-transaction-rpc.sql
```

**Run tests:**
```bash
npm test __tests__/server-mining.test.js
```

**Check fraud flags:**
```sql
SELECT wallet_address, suspicious_reasons, COUNT(*)
FROM mining_attempts
WHERE is_suspicious = true
GROUP BY wallet_address, suspicious_reasons
ORDER BY COUNT(*) DESC;
```

**Emergency disable:**
```javascript
// server/index.js - comment out handler
// socket.on("mine-resource", async (data) => { ... });
```

### API Quick Reference

**Client sends:**
```typescript
socket.emit("mine-resource", {
  nodeId: string,
  sessionId: string,
  walletAddress: string
});
```

**Client receives:**
```typescript
socket.on("mining-result", (result) => {
  // result.success: boolean
  // result.resourceType: string (if success)
  // result.amount: number (if success)
  // result.reason: string (if failure)
});
```

### Error Codes

| Code | Meaning | Fix |
|------|---------|-----|
| `rate_limit_exceeded` | >30 attempts/min | Wait 1 minute |
| `out_of_range` | >50 units away | Move closer |
| `cooldown_active` | <2 seconds since last | Wait 2 seconds |
| `node_already_claimed` | Race condition | Try different node |
| `duplicate_attempt` | Same attempt ID | Generate new ID |

### Drop Rates & Amounts

| Resource | Drop Rate | Amount Range | Tier 1 | Tier 14 |
|----------|-----------|--------------|--------|---------|
| Nickel | 80% | 1-5 | 1-5 | 3.6-18 |
| Cobalt | 50% | 1-4 | 1-4 | 3.6-14.4 |
| Copper | 30% | 1-3 | 1-3 | 3.6-10.8 |
| Manganese | 10% | 1-2 | 1-2 | 3.6-7.2 |

*Tier 14 amounts = base × 3.6x multiplier*

### Monitoring Queries

**Success rates (last 24h):**
```sql
SELECT resource_type, 
       COUNT(*) FILTER (WHERE success) AS successes,
       COUNT(*) AS total,
       ROUND(100.0 * COUNT(*) FILTER (WHERE success) / COUNT(*), 2) AS pct
FROM mining_attempts
WHERE attempt_timestamp > NOW() - INTERVAL '24 hours'
GROUP BY resource_type;
```

**Top miners:**
```sql
SELECT wallet_address, COUNT(*) AS mines, SUM(resource_amount) AS total
FROM mining_attempts
WHERE success = true AND is_suspicious = false
GROUP BY wallet_address
ORDER BY total DESC
LIMIT 10;
```

**Recent failures:**
```sql
SELECT wallet_address, failure_reason, COUNT(*)
FROM mining_attempts
WHERE success = false
  AND attempt_timestamp > NOW() - INTERVAL '1 hour'
GROUP BY wallet_address, failure_reason
ORDER BY COUNT(*) DESC;
```

### Performance Specs

- **Cooldown**: 2 seconds between attempts
- **Range**: 50 units max distance
- **Rate limit**: 30 attempts/min per wallet
- **Node claim**: 5 seconds exclusive lock
- **Respawn**: 300 seconds default (configurable per node)
- **Processing time**: ~50-200ms typical

### Fraud Detection Thresholds

| Pattern | Threshold | Action |
|---------|-----------|--------|
| Rapid succession | >10 attempts/min | Auto-flag |
| Unrealistic success | >90% success rate | Auto-flag |
| Impossible distance | >500 units/10sec avg | Auto-flag |
| Flagged attempts | ≥2 suspicious reasons | Review queue |

### Database Tables

**resource_nodes** (node state):
- `node_id` (unique)
- `status` (available/claimed/depleted/respawning)
- `position_x/y/z`
- `resource_type`, `resource_amount`
- `claimed_by_wallet`, `respawn_at`

**mining_attempts** (audit log):
- `attempt_id` (unique, idempotency)
- `wallet_address`, `ip_address`
- `success`, `failure_reason`
- `resource_type`, `resource_amount`
- `is_suspicious`, `suspicious_reasons[]`

### Rollback Procedure

1. **Comment out WebSocket handler** in `server/index.js`
2. **Don't drop tables** - keep audit trail
3. **Set all nodes to maintenance:**
   ```sql
   UPDATE resource_nodes SET status = 'maintenance';
   ```
4. **Review recent logs:**
   ```sql
   SELECT * FROM mining_attempts 
   ORDER BY attempt_timestamp DESC LIMIT 100;
   ```

### Testing Checklist

```bash
# Unit tests
npm test -- --testNamePattern="secureRandom"
npm test -- --testNamePattern="calculateDistance3D"
npm test -- --testNamePattern="determineMiningOutcome"

# Integration tests
npm test -- --testNamePattern="validateMiningPrerequisites"
npm test -- --testNamePattern="executeMiningAttempt"

# Security tests
npm test -- --testNamePattern="Anti-Exploit"
npm test -- --testNamePattern="RNG Security"

# All tests
npm test __tests__/server-mining.test.js
```

### Client Integration Example

```typescript
// When player clicks resource node
function handleMineClick(nodeId: string) {
  const attemptId = generateClientAttemptId(); // Random UUID
  
  socket.emit("mine-resource", {
    nodeId,
    sessionId: currentSessionId,
    walletAddress: playerWallet.toLowerCase()
  });
  
  // Disable button, show loading
  setMiningInProgress(true);
}

// Listen for result
socket.on("mining-result", (result) => {
  setMiningInProgress(false);
  
  if (result.success) {
    // Update resource display
    updatePlayerResources(result.resourceType, result.amount);
    showSuccessToast(`Mined ${result.amount}x ${result.resourceType}!`);
  } else {
    // Show error
    showErrorToast(result.message || result.reason);
  }
});

// Listen for other players mining in session
socket.on("resource-mined", (data) => {
  // Mark node as unavailable in local state
  markNodeAsUnavailable(data.nodeId);
});
```

### Tuning Guide

**Increase drop rates** (make easier):
```javascript
DROP_RATES: {
  nickel: 0.90,  // 80% → 90%
  manganese: 0.20 // 10% → 20%
}
```

**Decrease cooldown** (faster mining):
```javascript
GLOBAL_MINING_COOLDOWN_MS: 1000 // 2s → 1s
```

**Increase range** (more forgiving):
```javascript
MAX_MINING_RANGE: 75 // 50 → 75 units
```

**Tighten rate limits** (anti-spam):
```javascript
MAX_ATTEMPTS_PER_MINUTE: 20 // 30 → 20
```

---

**Quick Links:**
- Full docs: [MINING-SYSTEM-DOCUMENTATION.md](./MINING-SYSTEM-DOCUMENTATION.md)
- Tests: [__tests__/server-mining.test.js](./__tests__/server-mining.test.js)
- Service: [server/miningService.js](./server/miningService.js)
- Migrations: [db/migrations/](./db/migrations/)
