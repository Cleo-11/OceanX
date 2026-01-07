# 🔐 JWT-Based Wallet Authentication Setup

## Overview

Your app now uses **custom JWT tokens** for wallet-only authentication. No passwords, no Email provider dependency.

## ⚙️ Required Configuration

### 1. Get Your JWT Secret from Supabase

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Settings** → **API**
4. Scroll down to **JWT Settings**
5. Copy the **JWT Secret** (looks like a long base64 string)

### 2. Update .env.local

Replace `your-jwt-secret-here` with your actual JWT secret:

```env
SUPABASE_JWT_SECRET=your-actual-jwt-secret-from-dashboard
```

⚠️ **Important**: Keep this secret secure! Never commit it to git.

### 3. Restart Your Dev Server

```bash
# Stop the current server (Ctrl+C)
pnpm dev
```

## 🔍 How It Works

1. **User connects wallet** → Signs SIWE message
2. **Server verifies signature** → Creates/finds auth user
3. **Server generates JWT** → Custom access token signed with JWT secret
4. **Session created** → Tokens set as httpOnly cookies
5. **Middleware validates** → Decodes JWT on every request

## ✅ Benefits

- ✅ **100% Web3-native**: No passwords anywhere
- ✅ **Email provider disabled**: True wallet-only auth
- ✅ **No external dependencies**: Self-contained token generation
- ✅ **Standard JWT**: Compatible with Supabase's auth system

## 🧪 Testing

1. Connect your wallet at http://localhost:3000/auth
2. Sign the SIWE message
3. Check browser DevTools → Application → Cookies:
   - Should see `sb-access-token` (JWT)
   - Should see `sb-refresh-token` (UUID)
4. Navigate to /home → Should load without redirects
5. Navigate to /game → Should access game

## 🐛 Troubleshooting

### "SUPABASE_JWT_SECRET not configured" error

**Cause**: Environment variable not set or dev server not restarted

**Fix**:
```bash
# 1. Check .env.local has the secret
# 2. Restart dev server
pnpm dev
```

### Session not persisting

**Cause**: JWT secret doesn't match your Supabase project

**Fix**: Double-check you copied the correct JWT Secret from Supabase Dashboard → Settings → API → JWT Settings

### "Invalid token" errors in middleware

**Cause**: JWT format or claims mismatch

**Fix**: The JWT is generated with standard Supabase claims. If you see this, check the `generateSupabaseTokens()` function in [app/api/auth/siwe/route.ts](app/api/auth/siwe/route.ts)

## 📚 Technical Details

### JWT Structure

```json
{
  "aud": "authenticated",
  "exp": 1234567890,
  "iat": 1234567890,
  "iss": "https://your-project.supabase.co",
  "sub": "user-uuid",
  "email": "0x123...@ethereum.wallet",
  "role": "authenticated",
  "app_metadata": {
    "provider": "email",
    "providers": ["email"]
  }
}
```

### Token Lifecycle

- **Access Token**: 1 hour expiry, contains user claims
- **Refresh Token**: 7 days expiry, UUID for token refresh
- **Cookies**: httpOnly, secure in production, sameSite=lax

### Security Notes

- JWT signed with HS256 algorithm
- Synthetic emails used internally (never exposed to users)
- No password storage or validation
- Session ID regenerated on each login

## 🚀 Production Deployment

Before deploying:

1. ✅ Ensure `SUPABASE_JWT_SECRET` is set in production environment
2. ✅ Verify `NODE_ENV=production` for secure cookies
3. ✅ Test wallet authentication end-to-end
4. ✅ Confirm session persistence across page reloads

---

**Last Updated**: January 7, 2026
