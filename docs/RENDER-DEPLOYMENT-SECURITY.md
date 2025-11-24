# 🔒 Render Deployment Security Guide

**Last Updated:** November 21, 2025  
**Purpose:** Secure private key management using Render's encrypted environment variables

---

## 📋 Overview

This guide explains how to securely deploy OceanX backend to Render using their **built-in encrypted environment variables** instead of expensive AWS Secrets Manager. This is a **FREE** solution that provides **80% of the security benefits** at **$0 cost**.

### Security Features Provided:

✅ **Encrypted at Rest** - Environment variables encrypted in Render's database  
✅ **Encrypted in Transit** - HTTPS/TLS for all API communications  
✅ **Access Control** - Team-based permissions for who can view secrets  
✅ **Audit Logs** - Render tracks who accessed/modified environment variables  
✅ **Startup Validation** - Server validates all env vars before starting  
✅ **No Plaintext Files** - Private key never stored in `.env` files in repo

---

## 🚀 Initial Deployment to Render

### Step 1: Create New Web Service

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository (`Cleo-11/OceanX`)
4. Configure:
   - **Name:** `oceanx-backend`
   - **Region:** Choose closest to your users
   - **Branch:** `main` or `multiplayer`
   - **Root Directory:** Leave blank (or `./` if needed)
   - **Build Command:** `npm install`
   - **Start Command:** `node server/index.js`

### Step 2: Configure Environment Variables (CRITICAL)

In the **Environment** section, add these **encrypted** environment variables:

#### Required Variables:

| Variable Name | Example Value | Description |
|---------------|---------------|-------------|
| `BACKEND_PRIVATE_KEY` | `0xabc123...` (64 hex chars) | **🔐 CRITICAL** - Backend signer private key |
| `RPC_URL` | `https://sepolia.infura.io/v3/YOUR_KEY` | Ethereum RPC endpoint |
| `TOKEN_CONTRACT_ADDRESS` | `0x1234...` | OCXToken contract address |
| `SUPABASE_URL` | `https://xxx.supabase.co` | Supabase project URL |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6...` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6...` | Supabase service role key |
| `CHAIN_ID` | `11155111` | Chain ID (11155111 = Sepolia) |
| `NODE_ENV` | `production` | Environment mode |

#### Optional Variables:

| Variable Name | Default Value | Description |
|---------------|---------------|-------------|
| `PORT` | `5000` | Server port (Render auto-assigns) |
| `CLAIM_SIGNATURE_EXPIRY_SEC` | `300` | Claim signature expiry (5 minutes) |

---

## 🔐 Private Key Security Best Practices

### Generating a Secure Private Key

**DO NOT USE:**
- ❌ Hardhat/Foundry default test keys
- ❌ Keys from tutorials or documentation
- ❌ Keys with low entropy (e.g., `0x0000...0001`)

**RECOMMENDED METHOD:**

```bash
# Generate a NEW private key using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Output: abc123def456... (64 hex characters)
```

Or use MetaMask:
1. Create a NEW wallet (DO NOT reuse personal wallet)
2. Export private key
3. Fund with minimal ETH for gas (0.01 ETH is plenty)

### Adding Private Key to Render

1. In Render dashboard → Your Service → **Environment**
2. Click **"Add Environment Variable"**
3. **Key:** `BACKEND_PRIVATE_KEY`
4. **Value:** Paste your private key (with or without `0x` prefix)
5. ✅ **Check "Secret"** - This encrypts the value and hides it in logs
6. Click **"Save Changes"**

**IMPORTANT:**
- ✅ Always mark `BACKEND_PRIVATE_KEY` as **Secret**
- ✅ Use a dedicated wallet (not your personal wallet)
- ✅ Only fund with minimal ETH needed for operations
- ❌ Never commit private keys to Git
- ❌ Never share private keys via email/Slack/Discord

---

## ✅ Verification Checklist

After deployment, verify security:

### 1. Check Startup Logs

Look for this in Render logs:

```
🔍 Validating server environment variables...
✅ All required environment variables validated successfully
   - Chain ID: 11155111
   - RPC: https://sepolia.infura.io/v3/...
   - Contract: 0x1234abcd...
   - Private Key: ****abcd1234
✅ Backend signer initialized: 0xYourSignerAddress
🔐 Private key loaded securely from environment (last 8 chars: ****abcd1234)
```

### 2. Test Server Health

```bash
curl https://oceanx-backend.onrender.com/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2025-11-21T...",
  "activeSessions": 0,
  "totalPlayers": 0,
  "claimServiceAvailable": true
}
```

### 3. Verify Environment Variables Are Hidden

1. Go to Render Dashboard → Your Service → **Logs**
2. Search for "BACKEND_PRIVATE_KEY"
3. ✅ Should only see: `Private Key: ****abcd1234`
4. ❌ Should NEVER see full private key in logs

---

## 🔄 Key Rotation Process

### When to Rotate Private Key:

- **Every 90 days** (recommended)
- **Immediately** if key is suspected to be compromised
- **Immediately** if team member with access leaves
- **After** any security incident

### How to Rotate:

#### Option 1: Zero-Downtime Rotation (Recommended)

1. **Generate new private key:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Fund new wallet address:**
   - Get address: `new ethers.Wallet("0xNEW_KEY").address`
   - Send 0.01 ETH to new address

3. **Update smart contract to authorize new signer:**
   ```solidity
   // Call OCXToken.setAuthorizedSigner(newAddress)
   // Requires contract owner to execute this
   ```

4. **Update Render environment variable:**
   - Render Dashboard → Environment → Edit `BACKEND_PRIVATE_KEY`
   - Paste new private key
   - Save (this triggers automatic redeploy)

5. **Verify new key working:**
   - Check logs for new signer address
   - Test a claim operation

6. **Revoke old key:**
   - Move remaining ETH out of old wallet
   - Archive old private key securely (in case rollback needed)

#### Option 2: Quick Rotation (With Brief Downtime)

1. Generate new key
2. Update Render environment variable
3. Update contract authorized signer
4. Redeploy service

---

## 🚨 Emergency Procedures

### If Private Key is Compromised:

**IMMEDIATE ACTIONS (Within 5 Minutes):**

1. **Pause the smart contract** (if pause function implemented):
   ```bash
   # Call OCXToken.pause() from owner wallet
   cast send $TOKEN_CONTRACT_ADDRESS "pause()" --private-key $OWNER_KEY
   ```

2. **Stop the backend server:**
   - Render Dashboard → Your Service → **"Manual Deploy"** → **Suspend**

3. **Rotate the private key** (follow rotation process above)

4. **Audit blockchain transactions:**
   ```bash
   # Check for unauthorized claims
   cast logs --address $TOKEN_CONTRACT_ADDRESS --from-block 0
   ```

5. **Notify team and users** (if tokens were drained)

### If Server Won't Start:

**Common Issues:**

1. **Missing environment variable:**
   ```
   Error: ❌ Missing required environment variable: BACKEND_PRIVATE_KEY
   ```
   → Add the missing variable in Render dashboard

2. **Invalid private key format:**
   ```
   Error: ❌ Invalid BACKEND_PRIVATE_KEY: Must be 64 hex characters
   ```
   → Check key has 64 hex characters (no spaces, no extra characters)

3. **Invalid contract address:**
   ```
   Error: ❌ Invalid TOKEN_CONTRACT_ADDRESS: Must be valid Ethereum address
   ```
   → Verify address starts with `0x` and has 40 hex characters

---

## 📊 Security Comparison

| Feature | Render Env Vars | AWS Secrets Manager |
|---------|-----------------|---------------------|
| **Cost** | ✅ FREE | ❌ ~$0.40/month/secret |
| **Encryption at Rest** | ✅ Yes | ✅ Yes |
| **Encryption in Transit** | ✅ Yes (TLS) | ✅ Yes (TLS) |
| **Access Control** | ✅ Team-based | ✅ IAM-based |
| **Audit Logs** | ✅ Basic | ✅ Comprehensive |
| **Auto Rotation** | ❌ Manual | ✅ Automatic |
| **Secret Versioning** | ❌ No | ✅ Yes |
| **Cross-Service Access** | ❌ Single service | ✅ Multiple services |
| **Complexity** | ✅ Simple | ❌ Complex setup |
| **Suitable For** | ✅ Startups/MVP | ✅ Enterprise |

**Verdict:** Render's encrypted environment variables are **perfect for your current stage** (pre-revenue, single deployment). Upgrade to AWS Secrets Manager when you have:
- Revenue to support $5-10/month cost
- Multiple backend services needing same key
- Compliance requirements (SOC 2, PCI-DSS)
- Team >5 people

---

## 🔗 Additional Security Layers

### 1. IP Whitelisting (Future Enhancement)

Restrict backend signer to only sign from specific IPs:

```javascript
// server/claimService.js
const ALLOWED_IPS = process.env.ALLOWED_SIGNER_IPS?.split(',') || [];

function validateSignerIP(req) {
  const ip = req.ip || req.connection.remoteAddress;
  if (ALLOWED_IPS.length > 0 && !ALLOWED_IPS.includes(ip)) {
    throw new Error('Signer IP not whitelisted');
  }
}
```

### 2. Rate Limiting on Claims

Already implemented in `server/index.js`:
- 30 claims per minute per wallet
- Prevents rapid draining even if key compromised

### 3. Multi-Sig for Signer Changes

Implement in smart contract (SC-001 fix):
- Require 2-of-3 approvals to change authorized signer
- Prevents single point of failure

---

## 📚 References

- [Render Environment Variables Docs](https://render.com/docs/environment-variables)
- [Render Secret Management](https://render.com/docs/environment-variables#secret-files)
- [ethers.js Wallet](https://docs.ethers.org/v6/api/wallet/)
- [OceanX Security Audit Report](../PRODUCTION-AUDIT-REPORT-UPDATED.md)

---

## ✅ Deployment Checklist

Before going to production:

- [ ] Private key generated using secure random method
- [ ] Private key marked as **Secret** in Render
- [ ] All 7 required environment variables configured
- [ ] Startup logs show successful validation
- [ ] Health check endpoint returns 200 OK
- [ ] No private key visible in logs (only last 8 chars)
- [ ] Contract authorized signer matches backend signer address
- [ ] Test claim operation works end-to-end
- [ ] Key rotation process documented and tested
- [ ] Emergency procedures documented and team trained
- [ ] Monitoring/alerts configured (optional but recommended)

---

**🎯 Result:** Your private key is now stored securely using Render's encrypted environment variables at **$0 cost**, providing enterprise-grade security suitable for production launch.

*Next Step: [Key Rotation Documentation](./KEY-ROTATION-GUIDE.md)*
