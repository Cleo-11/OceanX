# 🔄 Private Key Rotation Guide

**Last Updated:** November 21, 2025  
**Purpose:** Step-by-step guide for rotating backend signer private key

---

## 📋 Overview

This guide provides detailed procedures for rotating the `BACKEND_PRIVATE_KEY` used by the OceanX backend to sign claim transactions. Regular key rotation is a **critical security practice** that limits the impact of potential key compromise.

---

## ⏰ Rotation Schedule

### Recommended Frequency:

| Scenario | Rotation Frequency | Priority |
|----------|-------------------|----------|
| **Normal Operations** | Every 90 days | 🟡 Medium |
| **Team Member Leaves** | Immediately | 🔴 Critical |
| **Suspected Compromise** | Immediately | 🚨 Emergency |
| **After Security Incident** | Immediately | 🚨 Emergency |
| **Compliance Requirement** | Per policy | 🔴 Critical |

### Automated Reminders:

Add to your calendar:
- **Every 90 days:** Schedule key rotation
- **Every 30 days:** Review access logs for anomalies

---

## 🛠️ Standard Rotation Procedure

### Prerequisites:

- [ ] Access to Render dashboard (team owner/admin)
- [ ] Access to contract owner wallet (for updating authorized signer)
- [ ] Node.js installed locally (for key generation)
- [ ] ethers.js CLI or cast (for blockchain interactions)

### Timeline: ~30 minutes

---

## Step 1: Generate New Private Key

### Option A: Using Node.js (Recommended)

```bash
# Generate cryptographically secure private key
node -e "console.log('0x' + require('crypto').randomBytes(32).toString('hex'))"

# Output: 0xabc123def456... (66 characters including 0x)
```

### Option B: Using ethers.js

```bash
npm install -g ethers

node -e "const ethers = require('ethers'); const wallet = ethers.Wallet.createRandom(); console.log('Private Key:', wallet.privateKey); console.log('Address:', wallet.address);"
```

### Option C: Using MetaMask

1. Open MetaMask
2. Click account icon → **"Create Account"**
3. Name it: `OceanX Backend Signer [NEW]`
4. Click **⋮** → **Account Details** → **Show Private Key**
5. Enter password → Copy private key

**⚠️ SECURITY:**
- ✅ Save new private key to password manager (1Password, LastPass, etc.)
- ✅ Label it with date: `OceanX Backend Key - 2025-11-21`
- ❌ Never paste into Slack, Discord, email, or plaintext files
- ❌ Never commit to Git

---

## Step 2: Get New Signer Address

```bash
# If you generated with Node.js, derive the address:
node -e "const ethers = require('ethers'); const wallet = new ethers.Wallet('YOUR_NEW_PRIVATE_KEY'); console.log('New Signer Address:', wallet.address);"

# Output: New Signer Address: 0x1234abcd...
```

**Save this address** - you'll need it for the smart contract update.

---

## Step 3: Fund New Wallet

The new wallet needs ETH for gas fees:

```bash
# Send 0.01 ETH to new address (enough for ~500 claim transactions)
# From your personal wallet or exchange

# Verify balance:
cast balance 0xNEW_SIGNER_ADDRESS --rpc-url $RPC_URL
```

Expected output: `10000000000000000` (0.01 ETH in wei)

---

## Step 4: Update Smart Contract Authorized Signer

### Check Current Authorized Signer:

```bash
# Read current authorized signer from contract
cast call $TOKEN_CONTRACT_ADDRESS "authorizedSigner()(address)" --rpc-url $RPC_URL

# Output: 0xOLD_SIGNER_ADDRESS
```

### Update to New Signer:

```bash
# Call setAuthorizedSigner from contract owner wallet
cast send $TOKEN_CONTRACT_ADDRESS \
  "setAuthorizedSigner(address)" \
  0xNEW_SIGNER_ADDRESS \
  --private-key $OWNER_PRIVATE_KEY \
  --rpc-url $RPC_URL

# Wait for transaction confirmation...
# Transaction hash: 0xabc123...
```

### Verify Update:

```bash
# Confirm new signer is set
cast call $TOKEN_CONTRACT_ADDRESS "authorizedSigner()(address)" --rpc-url $RPC_URL

# Output should match new address: 0xNEW_SIGNER_ADDRESS ✅
```

---

## Step 5: Update Render Environment Variable

### Via Render Dashboard:

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Select your service: **oceanx-backend**
3. Navigate to **Environment** tab
4. Find `BACKEND_PRIVATE_KEY`
5. Click **Edit** (pencil icon)
6. **Value:** Paste new private key (with `0x` prefix)
7. ✅ Ensure **"Secret"** checkbox is checked
8. Click **Save Changes**

**🔄 Automatic Redeploy:** Render will automatically redeploy your service with the new key.

### Via Render CLI (Alternative):

```bash
# Install Render CLI
npm install -g @render/cli

# Login
render login

# Update environment variable
render env set BACKEND_PRIVATE_KEY=0xNEW_PRIVATE_KEY \
  --service=oceanx-backend \
  --secret
```

---

## Step 6: Monitor Deployment

### Watch Deployment Logs:

1. Render Dashboard → Your Service → **Logs**
2. Wait for deployment to complete (~2-3 minutes)
3. Look for validation messages:

```
🔍 Validating server environment variables...
✅ All required environment variables validated successfully
   - Private Key: ****NEW_LAST_8
✅ Backend signer initialized: 0xNEW_SIGNER_ADDRESS
🔐 Private key loaded securely from environment (last 8 chars: ****abcd1234)
```

### Verify Address Matches:

```bash
# The signer address in logs should match your new address
# If it doesn't, check you pasted the correct private key
```

---

## Step 7: Test New Key

### Test Claim Operation:

```bash
# From frontend or curl
curl -X POST https://oceanx-backend.onrender.com/api/claim \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0xYOUR_TEST_WALLET",
    "amount": "1000000000000000000"
  }'

# Expected response:
# {
#   "success": true,
#   "signature": "0x...",
#   "deadline": 1700000000,
#   ...
# }
```

### Verify Signature:

```bash
# The signature should be valid when submitted to contract
# Test by calling OCXToken.claim() from frontend
```

---

## Step 8: Revoke Old Key

**⚠️ WAIT 24 HOURS** before revoking old key (in case rollback needed)

### After 24 Hours:

1. **Move remaining ETH out of old wallet:**
   ```bash
   # Send ETH back to your personal wallet
   cast send YOUR_PERSONAL_WALLET \
     --value 0.009ether \
     --private-key $OLD_PRIVATE_KEY \
     --rpc-url $RPC_URL
   ```

2. **Archive old private key:**
   - Move to password manager "Archive" folder
   - Label: `OceanX Backend Key - ROTATED 2025-11-21 - DO NOT USE`
   - Keep for 90 days (in case forensics needed)

3. **Update documentation:**
   - Record rotation date in team wiki
   - Update runbook with new signer address

---

## 🚨 Emergency Rotation Procedure

**Use this if key is compromised or suspected compromise**

### Immediate Actions (< 5 minutes):

1. **Pause the contract** (if pause function exists):
   ```bash
   cast send $TOKEN_CONTRACT_ADDRESS "pause()" \
     --private-key $OWNER_PRIVATE_KEY \
     --rpc-url $RPC_URL
   ```

2. **Suspend backend service:**
   - Render Dashboard → Service → **"Suspend"**

3. **Generate new key immediately:**
   ```bash
   node -e "console.log('0x' + require('crypto').randomBytes(32).toString('hex'))"
   ```

4. **Update contract (skip funding step if urgent):**
   ```bash
   cast send $TOKEN_CONTRACT_ADDRESS \
     "setAuthorizedSigner(address)" \
     0xNEW_SIGNER_ADDRESS \
     --private-key $OWNER_PRIVATE_KEY \
     --rpc-url $RPC_URL
   ```

5. **Update Render immediately:**
   - Update `BACKEND_PRIVATE_KEY` in Render dashboard
   - Wait for redeploy

6. **Resume service:**
   - Render Dashboard → Service → **"Resume"**

7. **Unpause contract:**
   ```bash
   cast send $TOKEN_CONTRACT_ADDRESS "unpause()" \
     --private-key $OWNER_PRIVATE_KEY \
     --rpc-url $RPC_URL
   ```

### Post-Incident Actions (< 24 hours):

1. **Audit blockchain transactions:**
   ```bash
   # Check for unauthorized claims
   cast logs --address $TOKEN_CONTRACT_ADDRESS \
     --from-block INCIDENT_START_BLOCK \
     --to-block INCIDENT_END_BLOCK \
     --event "Claimed(address,uint256,uint256)"
   ```

2. **Review server logs:**
   - Check for unusual IP addresses
   - Check for unusual claim patterns
   - Check for failed authentication attempts

3. **Notify stakeholders:**
   - Team members
   - Users (if tokens were drained)
   - Investors (if material impact)

4. **Post-mortem:**
   - Document what happened
   - Document how key was compromised
   - Implement additional security measures
   - Update incident response plan

---

## 🔍 Rollback Procedure

**If new key doesn't work and you need to revert:**

1. **Update contract back to old signer:**
   ```bash
   cast send $TOKEN_CONTRACT_ADDRESS \
     "setAuthorizedSigner(address)" \
     0xOLD_SIGNER_ADDRESS \
     --private-key $OWNER_PRIVATE_KEY \
     --rpc-url $RPC_URL
   ```

2. **Update Render to old key:**
   - Edit `BACKEND_PRIVATE_KEY` in Render
   - Paste old private key
   - Save (triggers redeploy)

3. **Verify rollback:**
   - Check logs for old signer address
   - Test claim operation

4. **Investigate why new key failed:**
   - Wrong private key pasted?
   - Contract not updated?
   - Insufficient gas in new wallet?

---

## 📊 Rotation Checklist

Print this and check off during rotation:

### Pre-Rotation:
- [ ] Calendar reminder set (90 days from now)
- [ ] Team notified of planned rotation
- [ ] Maintenance window scheduled (if needed)
- [ ] Backup of current configuration saved

### Rotation:
- [ ] New private key generated securely
- [ ] New signer address derived
- [ ] New wallet funded with 0.01 ETH
- [ ] Contract authorized signer updated
- [ ] Blockchain transaction confirmed
- [ ] Render environment variable updated
- [ ] Service redeployed successfully
- [ ] Logs show new signer address
- [ ] Test claim operation successful

### Post-Rotation:
- [ ] Old key ETH moved out (after 24h)
- [ ] Old key archived in password manager
- [ ] Documentation updated with new address
- [ ] Team notified of completion
- [ ] Next rotation scheduled (90 days)

---

## 🔐 Security Best Practices

### During Rotation:

1. **Never rotate during peak hours** (unless emergency)
   - Best time: Tuesday-Thursday, 2-4 AM UTC
   - Avoid Mondays, Fridays, weekends

2. **Always test in staging first** (if available)
   - Rotate testnet backend key
   - Verify process works
   - Then rotate mainnet

3. **Keep old key for 24-90 days**
   - Allows rollback if issues discovered
   - Helps forensics if compromise suspected

4. **Use different person for verification**
   - Person A rotates
   - Person B verifies
   - Prevents single point of failure

### Communication:

```markdown
# Example Team Notification

**Subject:** Backend Signer Key Rotation - Scheduled Maintenance

**When:** November 21, 2025, 2:00 AM - 2:30 AM UTC
**Impact:** ~5 minutes downtime
**Reason:** Scheduled 90-day key rotation

**Timeline:**
- 2:00 AM: Begin rotation
- 2:05 AM: New key deployed
- 2:10 AM: Testing
- 2:15 AM: Complete (or rollback if issues)

**No action required from users.**

Questions? Reply to this thread.
```

---

## 📚 References

- [Render Environment Variables](https://render.com/docs/environment-variables)
- [ethers.js Wallet](https://docs.ethers.org/v6/api/wallet/)
- [Foundry Cast](https://book.getfoundry.sh/reference/cast/)
- [OceanX Deployment Guide](./RENDER-DEPLOYMENT-SECURITY.md)

---

## ❓ FAQ

**Q: Why rotate every 90 days?**  
A: Industry standard for secret rotation. Limits exposure window if key compromised.

**Q: What if I lose the old key before 24 hours?**  
A: No problem. The old key is only kept for rollback. If new key works, you don't need old key.

**Q: Can I automate this?**  
A: Not recommended for current setup. Automation requires:
- AWS Secrets Manager auto-rotation ($$$)
- Or custom rotation lambda functions (complex)
- Manual rotation takes 30min every 90 days (acceptable)

**Q: What if contract owner wallet is compromised?**  
A: Much bigger problem. Attacker can:
- Change authorized signer to their own address
- Drain entire token supply
- **Prevention:** Use multi-sig for contract ownership (SC-001 fix)

---

**✅ Key Rotation Complete!** Next rotation due: [DATE + 90 days]
