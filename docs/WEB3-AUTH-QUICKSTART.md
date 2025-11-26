# 🚀 Quick Start: Web3 & Google Auth

## ✅ What's Enabled

Your AbyssX website now supports **4 authentication methods**:

| Method | Status | Required Wallet/Account |
|--------|--------|------------------------|
| Email/Password | ✅ Working | None |
| Google OAuth | ✅ Enabled | Google Account |
| Ethereum Wallet | ✅ Ready | MetaMask |
| Solana Wallet | ✅ Ready | Phantom/Solflare |

---

## 🎯 Quick Test (3 Steps)

### Test Web3 Wallet Auth:

1. **Install MetaMask or Phantom**
   - MetaMask: https://metamask.io/download/
   - Phantom: https://phantom.app/

2. **Visit auth page**
   ```
   http://localhost:3000/auth
   ```

3. **Click the wallet button**
   - "Sign in with Ethereum" (if MetaMask installed)
   - "Sign in with Solana" (if Phantom installed)
   - Approve connection in wallet popup
   - Sign the message
   - ✅ You're authenticated!

### Test Google OAuth:

1. **Visit auth page**
   ```
   http://localhost:3000/auth
   ```

2. **Click "Continue with Google"**
   - Select Google account
   - Grant permissions
   - ✅ You're authenticated!

---

## 📋 Supabase Checklist

Make sure these are enabled in your Supabase dashboard:

### Authentication → Providers:

- [x] **Google** - Enabled ✅ (already done)
- [x] **Sign in with Ethereum** - Enabled ✅ (you confirmed)
- [x] **Sign in with Solana** - Enabled ✅ (you confirmed)

### Authentication → URL Configuration:

Add these redirect URLs:
```
http://localhost:3000/auth/callback
http://localhost:3000/connect-wallet
```

---

## 🎨 What Users See

```
┌──────────────────────────────────┐
│    Continue with Google    🔵   │  ← Always visible
├──────────────────────────────────┤
│   Sign in with Ethereum    🦊   │  ← Only if MetaMask installed
├──────────────────────────────────┤
│    Sign in with Solana     ◎    │  ← Only if Phantom installed
├──────────────────────────────────┤
│             or                   │
│                                  │
│   [Email/Password Form]          │
└──────────────────────────────────┘
```

---

## 💻 Files Changed

✨ **NEW:**
- `lib/web3auth.ts` - Web3 wallet authentication logic
- `docs/WEB3-AUTH-SETUP.md` - Complete setup guide

🔄 **UPDATED:**
- `app/auth/auth-page-client.tsx` - Added wallet buttons & handlers

---

## 🔍 How to Verify

### Check Supabase Dashboard:

1. Go to **Authentication** → **Users**
2. Sign in with each method
3. Verify user metadata contains:
   ```json
   {
     "wallet_address": "0x742d35Cc...",
     "wallet_type": "ethereum",
     "auth_method": "siwe"
   }
   ```

### Check Database:

```sql
-- See all users
SELECT email, raw_user_meta_data FROM auth.users;

-- See players created
SELECT username, wallet_address FROM players;
```

---

## 🚨 Troubleshooting

### "No wallet detected" error?
- **Solution**: Install MetaMask or Phantom browser extension
- Restart browser after installation

### Wallet buttons not showing?
- **Solution**: Wallet must be installed and unlocked
- Try refreshing the page

### Google OAuth not working?
- **Solution**: Verify redirect URLs in Supabase match exactly
- Check `NEXT_PUBLIC_SITE_URL` in `.env.local`

---

## 📚 Full Documentation

For detailed setup, security info, and advanced configuration:

👉 **Read**: `docs/WEB3-AUTH-SETUP.md`

---

## ✅ Success Criteria

You know it's working when:

1. ✅ Ethereum button appears (with MetaMask installed)
2. ✅ Solana button appears (with Phantom installed)
3. ✅ Clicking wallet button opens wallet popup
4. ✅ Signing message creates Supabase session
5. ✅ User is redirected to `/connect-wallet`
6. ✅ New user appears in Supabase Auth dashboard
7. ✅ `players` table has new record with username

---

**Ready to test?** Visit http://localhost:3000/auth 🚀
