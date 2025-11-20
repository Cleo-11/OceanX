# 🔄 Migration & Rollback Guide

## ✅ **Migration Safety Information**

### **What Changes Are Made**
The migration script **only changes constraints and adds features** - it **never deletes or modifies your data**.

| Change Type | What It Does | Risk Level |
|-------------|--------------|------------|
| Make `wallet_address` nullable | Allows auth before wallet connection | ✅ **ZERO RISK** - Existing data untouched |
| Add unique constraint on `user_id` | Prevents duplicate user accounts | ✅ **ZERO RISK** - Constraint only |
| Enable RLS policies | Secures data access per user | ✅ **ZERO RISK** - Security feature |
| Add indexes | Improves query performance | ✅ **ZERO RISK** - Performance only |
| Add helper functions | Convenience functions for auth | ✅ **ZERO RISK** - Optional utilities |

### **Your Data is 100% Safe**
- ✅ No `DROP TABLE` commands
- ✅ No `DELETE` commands  
- ✅ No data modification
- ✅ Only constraint and security changes

---

## 🚀 **How to Apply Migration**

### Step 1: Backup (Optional but Recommended)
```sql
-- Create a backup of your players table
CREATE TABLE players_backup AS SELECT * FROM players;
```

### Step 2: Run Migration
```sql
-- Copy contents of scripts/production-database-setup.sql
-- Paste into Supabase SQL Editor and execute
```

### Step 3: Verify Success
The script includes verification that will show:
- ✅ `wallet_address nullable: YES`
- ✅ `user_id unique constraint: true`
- ✅ `RLS enabled: true`

---

## ↩️ **How to Rollback (If Needed)**

### Option 1: Full Rollback
```sql
-- Run scripts/rollback-migration.sql
-- This undoes ALL migration changes
```

### Option 2: Selective Rollback
You can undo individual parts:

```sql
-- Just disable RLS
ALTER TABLE players DISABLE ROW LEVEL SECURITY;

-- Just remove unique constraint
ALTER TABLE players DROP CONSTRAINT players_user_id_unique;

-- Just make wallet_address required again (if no NULL values exist)
ALTER TABLE players ALTER COLUMN wallet_address SET NOT NULL;
```

---

## ⚠️ **Important Rollback Considerations**

### **Potential Issue: NULL Wallet Addresses**
If you've run the authentication system after migration, some users might have `user_id` but `wallet_address = NULL`.

**The rollback script will warn you about this and provide options:**

1. **Delete users without wallets:**
   ```sql
   DELETE FROM players WHERE wallet_address IS NULL;
   ```

2. **Set temporary wallet addresses:**
   ```sql
   UPDATE players SET wallet_address = 'temp_' || id WHERE wallet_address IS NULL;
   ```

3. **Keep current state** (recommended - let users connect wallets later)

---

## 🔍 **Rollback Verification**

After rollback, your database will be restored to:
- ❌ `wallet_address` is `NOT NULL` (original state)
- ❌ No unique constraint on `user_id`
- ❌ RLS disabled
- ✅ All your data preserved

---

## 🎯 **Recommended Approach**

### **Safest Path:**
1. **Test in development first** (if you have a dev database)
2. **Run migration on production** (very low risk)
3. **Test authentication flow**
4. **Keep migration** (it makes your system more secure and flexible)

### **If You Need to Rollback:**
- The rollback script is comprehensive and safe
- Your data will be preserved
- You can re-run migration later if needed

---

## 🔧 **Quick Commands Summary**

```bash
# Apply Migration
# Run: scripts/production-database-setup.sql

# Full Rollback  
# Run: scripts/rollback-migration.sql

# Backup First (optional)
CREATE TABLE players_backup AS SELECT * FROM players;

# Restore from Backup (if something goes wrong)
DROP TABLE players;
ALTER TABLE players_backup RENAME TO players;
```

---

## 💡 **Why Migration is Recommended**

The migration makes your system:
- ✅ **More secure** (RLS protects user data)
- ✅ **More flexible** (users can auth before wallet connection)
- ✅ **More reliable** (prevents duplicate accounts)
- ✅ **Better performance** (optimized indexes)

**Bottom line: Migration is low-risk, high-benefit with easy rollback available!**