# Web3 Wallet Authentication Setup Guide

This guide explains how to enable and configure Web3 wallet authentication (Ethereum & Solana) and Google OAuth on your AbyssX website.

## 🎯 Overview

Your website now supports **4 authentication methods**:
1. ✅ **Email/Password** (already working)
2. ✅ **Google OAuth** (enabled in Supabase)
3. ✅ **Sign-In with Ethereum (SIWE)** (newly added)
4. ✅ **Sign-In with Solana (SIWS)** (newly added)

---

## 📋 Prerequisites

### ✅ Already Completed
- [x] Supabase project created
- [x] Google OAuth enabled in Supabase dashboard
- [x] Web3 wallet providers enabled in Supabase

### 🔧 Required Wallets for Testing
- **Ethereum**: [MetaMask](https://metamask.io/download/) browser extension
- **Solana**: [Phantom](https://phantom.app/) or [Solflare](https://solflare.com/) browser extension

---

## 🔐 Supabase Configuration

### Step 1: Configure Google OAuth (Already Done ✅)

Since you've already enabled Google OAuth in Supabase, verify these settings:

1. Go to **Supabase Dashboard** → **Authentication** → **Providers**
2. Find **Google** and ensure it's **Enabled**
3. Verify these settings:
   - **Client ID**: (your Google OAuth client ID)
   - **Client Secret**: (your Google OAuth secret)
   - **Authorized redirect URIs**: Should include your callback URL

### Step 2: Configure Web3 Wallet Providers

#### For Ethereum (SIWE):

1. Go to **Supabase Dashboard** → **Authentication** → **Providers**
2. Scroll to **Web3 Wallet** section
3. Find **Sign in with Ethereum** toggle
4. Ensure it's **ENABLED** ✅
5. Configure settings:
   ```
   Attack Protection: ENABLED (recommended)
   Rate Limits: Set appropriate limits (e.g., 10 requests per hour per IP)
   ```

#### For Solana (SIWS):

1. In the same **Web3 Wallet** section
2. Find **Sign in with Solana** toggle
3. Ensure it's **ENABLED** ✅
4. Configure settings:
   ```
   Attack Protection: ENABLED (recommended)
   Rate Limits: Set appropriate limits (e.g., 10 requests per hour per IP)
   ```

### Step 3: Configure Redirect URLs

1. Go to **Authentication** → **URL Configuration**
2. Add these URLs:

   **Site URL** (Development):
   ```
   http://localhost:3000
   ```

   **Redirect URLs** (add all of these):
   ```
   http://localhost:3000/auth/callback
   http://localhost:3000/connect-wallet
   ```

   **For Production** (when deploying):
   ```
   https://yourdomain.com
   https://yourdomain.com/auth/callback
   https://yourdomain.com/connect-wallet
   ```

---

## 💻 Code Implementation

### Files Created/Modified:

1. **`lib/web3auth.ts`** (NEW ✨)
   - Sign-In with Ethereum (SIWE/EIP-4361)
   - Sign-In with Solana (SIWS/EIP-4361)
   - Nonce generation
   - Message signing and verification

2. **`app/auth/auth-page-client.tsx`** (UPDATED 🔄)
   - Added Ethereum wallet button
   - Added Solana wallet button
   - Added authentication handlers
   - Wallet detection logic

---

## 🎨 User Interface

### What Users See:

The `/auth` page now shows:

```
┌────────────────────────────────────┐
│         Continue with Google       │  ← Google OAuth
├────────────────────────────────────┤
│      Sign in with Ethereum 🦊      │  ← MetaMask/Ethereum
├────────────────────────────────────┤
│       Sign in with Solana ◎        │  ← Phantom/Solflare
├────────────────────────────────────┤
│              or                    │
│                                    │
│    [Email/Password Form]           │  ← Traditional login
└────────────────────────────────────┘
```

**Smart Detection:**
- Ethereum button only shows if MetaMask is installed
- Solana button only shows if Phantom/Solflare is installed
- Google button always shows

---

## 🚀 How It Works

### Ethereum Wallet Authentication Flow:

```
1. User clicks "Sign in with Ethereum"
   └─> Checks for MetaMask installation

2. MetaMask popup appears
   └─> Requests wallet connection

3. Create SIWE message (EIP-4361)
   └─> Includes: domain, address, nonce, timestamp

4. User signs message in MetaMask
   └─> Cryptographic signature created

5. Send signature to Supabase
   └─> Supabase verifies signature

6. Create Supabase session
   └─> User authenticated!

7. Redirect to /connect-wallet
   └─> Link wallet to game account
```

### Solana Wallet Authentication Flow:

```
1. User clicks "Sign in with Solana"
   └─> Checks for Phantom/Solflare

2. Wallet popup appears
   └─> Requests wallet connection

3. Create SIWS message
   └─> Includes: domain, publicKey, nonce, timestamp

4. User signs message in wallet
   └─> Signature created

5. Send to Supabase for verification
   └─> Supabase validates signature

6. Create session
   └─> User authenticated!

7. Redirect to /connect-wallet
   └─> Link wallet to game account
```

---

## 🧪 Testing

### Test Ethereum Authentication:

1. **Install MetaMask**
   - Download from [metamask.io](https://metamask.io/download/)
   - Create or import a wallet

2. **Visit your auth page**
   ```
   http://localhost:3000/auth
   ```

3. **Click "Sign in with Ethereum"**
   - MetaMask popup will appear
   - Click "Connect"
   - Sign the message
   - You'll be redirected after successful auth

4. **Verify in Supabase**
   - Go to **Authentication** → **Users**
   - Find your new user
   - Check user metadata for wallet details

### Test Solana Authentication:

1. **Install Phantom Wallet**
   - Download from [phantom.app](https://phantom.app/)
   - Create or import a wallet

2. **Visit your auth page**
   ```
   http://localhost:3000/auth
   ```

3. **Click "Sign in with Solana"**
   - Phantom popup will appear
   - Click "Connect"
   - Sign the message
   - You'll be redirected after successful auth

### Test Google OAuth:

1. **Click "Continue with Google"**
2. **Select your Google account**
3. **Grant permissions**
4. **You'll be redirected to `/auth/callback`**
5. **Then forwarded to `/connect-wallet`**

---

## 🔍 Troubleshooting

### Ethereum Issues:

❌ **"No Ethereum wallet detected"**
- Solution: Install MetaMask browser extension
- Restart browser after installation

❌ **MetaMask not appearing**
- Check if MetaMask is unlocked
- Try refreshing the page
- Check browser console for errors

❌ **Signature verification failed**
- Check Supabase Web3 provider is enabled
- Verify network matches (Sepolia for testing)
- Check nonce generation

### Solana Issues:

❌ **"No Solana wallet detected"**
- Solution: Install Phantom or Solflare
- Restart browser

❌ **Wallet won't connect**
- Check if wallet is unlocked
- Try switching networks in wallet
- Refresh the page

### Google OAuth Issues:

❌ **Redirect loop**
- Check redirect URLs in Supabase match exactly
- Verify `NEXT_PUBLIC_SITE_URL` in `.env.local`

❌ **"OAuth error"**
- Verify Google Client ID and Secret
- Check Google Cloud Console settings
- Ensure OAuth consent screen is configured

---

## 🌐 Environment Variables

Your `.env.local` should have:

```env
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://xbuauvvqvnuaourlmnjj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Site URL (Important for OAuth redirects)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Network Configuration (for Ethereum)
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_NETWORK_NAME=Sepolia
NEXT_PUBLIC_RPC_URL=https://sepolia.infura.io/v3/your_key
```

---

## 📊 Database Integration

### Automatic Player Record Creation:

When a user signs in with Web3 wallet:

1. **Supabase creates auth.users record**
   ```sql
   user_metadata = {
     wallet_address: "0x742d35Cc...",
     wallet_type: "ethereum" | "solana",
     siwe_message: "..." (for Ethereum)
     siws_message: "..." (for Solana)
   }
   ```

2. **Trigger creates players record**
   ```sql
   INSERT INTO players (
     user_id,
     username,  -- Extracted from wallet address
     wallet_address  -- NULL initially
   )
   ```

3. **User proceeds to /connect-wallet**
   - Links their MetaMask wallet (for gameplay)
   - Updates `wallet_address` in players table

### Why Two Wallet Fields?

- **auth.users.user_metadata.wallet_address**: Authentication wallet (Ethereum/Solana)
- **players.wallet_address**: Game wallet (currently MetaMask only for blockchain interactions)

This allows users to:
- Sign in with Solana wallet
- But use MetaMask for game transactions (OCX token is on Ethereum)

---

## 🔒 Security Best Practices

### SIWE/SIWS Security:

1. **Nonce**: Randomly generated 32-byte hex string
   - Prevents replay attacks
   - Used once per signature

2. **Message Expiration**: Set short expiration times
   ```javascript
   expirationTime: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
   ```

3. **Domain Binding**: Messages include domain
   - Prevents cross-site attacks
   - Signature only valid for your domain

4. **Attack Protection**: Enable in Supabase
   - Rate limiting
   - IP blocking for suspicious activity

### OAuth Security:

1. **HTTPS Only** (Production)
2. **Secure Client Secret** (never expose)
3. **Redirect URI validation**
4. **PKCE flow** (Proof Key for Code Exchange)

---

## 📱 Mobile Wallet Support

### WalletConnect (Future Enhancement):

For mobile wallet support, you can add WalletConnect:

```bash
npm install @walletconnect/web3-provider
```

This allows users to connect using:
- Mobile MetaMask
- Trust Wallet
- Rainbow Wallet
- And 300+ other wallets

---

## ✅ Success Checklist

- [ ] Supabase Google OAuth enabled
- [ ] Supabase Ethereum provider enabled
- [ ] Supabase Solana provider enabled
- [ ] Redirect URLs configured
- [ ] `.env.local` updated with Supabase credentials
- [ ] MetaMask installed (for testing Ethereum)
- [ ] Phantom installed (for testing Solana)
- [ ] Test sign-in with Ethereum wallet ✅
- [ ] Test sign-in with Solana wallet ✅
- [ ] Test sign-in with Google ✅
- [ ] Test traditional email/password ✅
- [ ] Verified users appear in Supabase dashboard
- [ ] Wallet addresses stored in user metadata
- [ ] Players table created with trigger

---

## 🎯 Next Steps

1. **Test all authentication methods**
2. **Configure production redirect URLs** (when deploying)
3. **Set up custom SMTP** (for email verification)
4. **Consider adding WalletConnect** (for mobile support)
5. **Add social login icons** (Twitter, Discord, etc.)

---

## 💡 Pro Tips

1. **Development**: Disable email confirmation for faster testing
   - Supabase → Auth → Email → Uncheck "Confirm email"

2. **Production**: Enable email confirmation + 2FA
   - Better security
   - Prevent spam accounts

3. **User Experience**: Show wallet installation prompts
   - If no wallet detected, show download links
   - Guide users through setup

4. **Analytics**: Track authentication methods
   - Which method is most popular?
   - Optimize user flow accordingly

---

## 🆘 Need Help?

- **Supabase Docs**: https://supabase.com/docs/guides/auth
- **SIWE Spec**: https://eips.ethereum.org/EIPS/eip-4361
- **MetaMask Docs**: https://docs.metamask.io/
- **Phantom Docs**: https://docs.phantom.app/

---

**Last Updated**: November 26, 2025
**Status**: ✅ Ready for Testing
