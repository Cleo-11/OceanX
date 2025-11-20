# Quick Reference: Marketplace Claim Flow

## Environment Variables (server/.env)
```bash
RPC_URL=https://sepolia.infura.io/v3/a52d834f9c2c425f815099e9819a360b
CHAIN_ID=11155111
TOKEN_CONTRACT_ADDRESS=0x3282E5D599b2A19c59C2c89EC9BDe5b5ad0F257E
BACKEND_PRIVATE_KEY=0xf679fc3342dfcb4d70f87357103aaffd03cb56caf3211432aa5068ca1ae7c664
BACKEND_SIGNER_ADDRESS=0x14Ac0ceB3fF8858358b487F6A24553fa3a04407b
```

## Test Wallet
- Address: `0x5711b49b29680c1eabb3e3eb6c191d4db70c853c`
- Needs Sepolia ETH for gas: https://sepoliafaucet.com/

## API Endpoints

### 1. Sign Claim (Backend generates signature)
```bash
POST http://localhost:5000/marketplace/sign-claim
Content-Type: application/json
x-wallet-address: 0x5711b49b29680c1eabb3e3eb6c191d4db70c853c

{
  "ocxAmount": "100"
}
```

**Response:**
```json
{
  "success": true,
  "amountWei": "100000000000000000000",
  "nonce": "0",
  "deadline": 1699999999,
  "signature": "0x...",
  "v": 27,
  "r": "0x...",
  "s": "0x..."
}
```

### 2. Submit Claim (Client pays gas)
```bash
cd client
node submit-claim.js \
  <recipient> \
  <amountWei> \
  <nonce> \
  <deadline> \
  <signature> \
  <playerPrivateKey>
```

### 3. Confirm Trade (Backend verifies and updates DB)
```bash
POST http://localhost:5000/marketplace/trade/confirm
Content-Type: application/json
x-wallet-address: 0x5711b49b29680c1eabb3e3eb6c191d4db70c853c

{
  "txHash": "0x...",
  "tradeId": "uuid-from-step-1"
}
```

## Database Migration
```bash
# Run in Supabase SQL editor
psql < db/migrations/002_create_trades_table.sql
```

## Files Added
- ✅ `server/claimService.js` - Added sign-only & verify functions
- ✅ `server/index.js` - Added `/marketplace/sign-claim` and `/marketplace/trade/confirm`
- ✅ `client/submit-claim.js` - Client script to submit claim tx
- ✅ `db/migrations/002_create_trades_table.sql` - Trades table migration
- ✅ `TESTING-GUIDE.md` - Complete testing walkthrough
- ✅ `QUICK-REFERENCE.md` - This file

## Testing Steps (Quick)
1. Start server: `cd server && node index.js`
2. Request signature: `POST /marketplace/sign-claim`
3. Submit claim: `node client/submit-claim.js ...`
4. Confirm trade: `POST /marketplace/trade/confirm`
5. Check DB: `SELECT * FROM trades;`

## Verification
- [ ] Server logs: "✅ OCXToken ABI loaded successfully"
- [ ] Step 1 returns signature with v/r/s
- [ ] Step 2 submits tx and gets txHash
- [ ] Step 3 verifies tx and updates DB
- [ ] Etherscan shows confirmed tx with Claimed event
- [ ] DB shows trade status = 'confirmed'
- [ ] Player balance increased on-chain

## Troubleshooting
| Error | Cause | Fix |
|-------|-------|-----|
| Invalid signature | Backend signer mismatch | Check BACKEND_PRIVATE_KEY matches authorizedSigner |
| Insufficient funds | No Sepolia ETH | Get ETH from faucet |
| Nonce mismatch | Stale signature | Request fresh signature |
| Transaction failed | Various | Check etherscan for revert reason |

## Next: Production Deployment
When ready for Base mainnet:
1. Update `CHAIN_ID=8453`
2. Update `RPC_URL` to Base mainnet
3. Update `TOKEN_CONTRACT_ADDRESS` to Base deployment
4. Ensure BACKEND_PRIVATE_KEY is secure (use secrets manager)
5. Test on Base Sepolia (84532) first!

---

**See TESTING-GUIDE.md for detailed step-by-step instructions**
