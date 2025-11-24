# How to Run the Nonce Validation Migration

## Current Status
- ✅ Migration file created: `supabase/migrations/20251123_claim_signature_tracking.sql`
- ✅ NonceManager code implemented
- ✅ Server integration complete
- ⏳ **MIGRATION NOT YET RUN**

## What the Migration Does
This migration enhances your existing `claim_signatures` table to prevent signature replay attacks by:
1. Adding a `nonce` column to track blockchain nonce
2. Adding a `signature` column to store EIP-712 signatures
3. Creating a UNIQUE index on `(wallet, nonce)` to prevent duplicates
4. Adding helper functions for nonce checking and cleanup

**Important:** This is a NON-DESTRUCTIVE migration that only ADDS columns and indexes to your existing table.

## Steps to Run the Migration

### Option 1: Supabase Web Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your OceanX project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query" button

3. **Copy Migration SQL**
   - Open file: `supabase/migrations/20251123_claim_signature_tracking.sql`
   - Select ALL content (Ctrl+A)
   - Copy (Ctrl+C)

4. **Run Migration**
   - Paste into SQL Editor (Ctrl+V)
   - Click "Run" button (or press Ctrl+Enter)
   - Wait for "Success" message

5. **Verify Success**
   Look for green success message:
   ```
   Success. No rows returned
   ```

### Option 2: Using psql (If you have PostgreSQL client)

```bash
# Get connection string from Supabase Dashboard > Project Settings > Database
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f supabase/migrations/20251123_claim_signature_tracking.sql
```

## After Running Migration

### 1. Verify Migration
```bash
node scripts/verify-migration.js
```

Expected output:
```
✅ Table schema looks good!
✅ UNIQUE constraint is working!
✅ Server NonceManager is working!
```

### 2. Restart Server
```bash
cd server
npm run dev
```

Look for these log messages:
```
✅ Supabase client initialized
✅ Nonce Manager initialized
```

### 3. Test Nonce Validation
```bash
node scripts/test-nonce-simple.js
```

Expected output:
```
✅ NonceManager is initialized and working
📊 Total signatures: X
📊 Pending: X
📊 Claimed: X
```

## What Gets Added to Your Table

### New Columns
- `nonce` (BIGINT) - Smart contract nonce at signature generation time
- `signature` (TEXT) - The actual EIP-712 signature string

### New Indexes
- `idx_claim_sigs_wallet_nonce_unique` - UNIQUE index on (wallet, nonce)
- `idx_claim_sigs_wallet_lookup` - Performance index on wallet
- `idx_claim_sigs_used_status` - Performance index on used column
- `idx_claim_sigs_expires_lookup` - Performance index on expires_at

### New Functions
- `check_nonce_usage(wallet, nonce)` - Check if nonce already used
- `expire_old_claim_signatures()` - Auto-expire old signatures

## Existing Data
✅ **Your existing claim_signatures data will NOT be affected**
- All existing rows remain unchanged
- New columns will be NULL for existing rows (which is fine)
- Existing columns (claim_id, wallet, amount, etc.) unchanged

## Troubleshooting

### Error: "relation claim_signatures does not exist"
❌ The table doesn't exist yet. Make sure you're connected to the correct database.

### Error: "column nonce already exists"
✅ Migration already partially run. This is safe - the migration is idempotent (can run multiple times).

### Error: "duplicate key value violates unique constraint"
✅ This is EXPECTED when testing! It means the unique constraint is working correctly.

## Security Impact

After migration, your system will:
- ✅ Prevent signature replay attacks (each nonce = one signature)
- ✅ Block concurrent duplicate signature requests
- ✅ Auto-expire unused signatures after 1 hour
- ✅ Maintain complete audit trail of all signatures

This closes the **Critical Security Blocker #4** from your audit report.

## Need Help?

If you see any errors during migration:
1. Copy the FULL error message
2. Share it along with the line number
3. Don't panic - the migration is designed to be safe and idempotent
