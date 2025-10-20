# 🔒 Profile Security - Quick Setup

## What Changed?

Your profile page is now **ONLY accessible from the User Home page**. Direct URL access is blocked with secure token authentication.

## ✅ Setup Steps

### 1. Add Environment Variable

Add to your `.env.local` file:

```bash
# Profile Access Secret - REQUIRED for profile page security
PROFILE_ACCESS_SECRET=oceanx-profile-secret-key-change-in-production
```

**⚠️ Important**: Generate a random secret for production:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Restart Dev Server

```bash
# Stop current server (Ctrl+C)
pnpm dev
```

### 3. Test It Works

1. Go to your app and connect wallet
2. Navigate to User Home page
3. Click the **Profile button** (right side floating panel)
4. Profile page should load ✅
5. Try accessing `/profile` directly → should redirect to `/home` ✅

## 🎯 How Users Access Profile

### ✅ Correct Way (ONLY way that works)
```
User Home → Click Profile Button → Profile Page
```

### ❌ Blocked Methods
- Direct URL: `http://localhost:3000/profile` → Redirects to /home
- Bookmarks: Old profile URLs → Redirects to /home
- Shared links: URLs from other users → Redirects to /home
- Manual navigation: `router.push('/profile')` → Redirects to /home

## 🔐 Security Features

- **Token expires in 5 minutes** - prevents URL sharing
- **HMAC signature** - prevents token tampering
- **Server-side validation** - cannot be bypassed
- **Wallet verification** - ensures correct user
- **Database check** - user must exist

## 📋 Files Created

```
lib/
├── profile-access-token.ts      # Token generation/verification
└── profile-navigation.ts         # Secure navigation hook

app/
└── api/profile/generate-token/
    └── route.ts                  # Token API endpoint

app/profile/
├── page.tsx                      # Updated with validation
└── SECURITY.md                   # Full documentation
```

## 🔧 Files Modified

```
components/user-home.tsx          # Profile button now uses secure nav
app/profile/page.tsx              # Now validates access tokens
```

## 🧪 Quick Test

```bash
# 1. Start server
pnpm dev

# 2. Try direct access (should fail)
curl http://localhost:3000/profile
# Expected: Redirect to /home

# 3. Use the app normally
# - Connect wallet
# - Go to user home
# - Click profile button
# Expected: Profile loads successfully
```

## 📊 What Happens Now

### Old Behavior ❌
```
Anyone with the URL → /profile → ✅ Accessed
```

### New Behavior ✅
```
Direct URL → /profile → ❌ Redirected to /home
User Home → Profile Button → Generate Token → /profile?token=... → ✅ Accessed (5 min)
```

## 🐛 Troubleshooting

### "Cannot find module 'crypto'"
- **Fix**: crypto is built-in to Node.js, restart your dev server

### "Access denied: Missing token"
- **Fix**: Use the profile button, don't navigate directly

### "Access denied: Invalid token"
- **Fix**: Check that `PROFILE_ACCESS_SECRET` is set in `.env.local`

### Profile button does nothing
- **Fix**: Check browser console for errors, ensure API route is working

## 🎉 You're Done!

Your profile page is now fully secured. Users can only access it through the proper navigation flow from the User Home page.

**Test it** and ensure the profile button works correctly!

---

**Need more details?** See `/app/profile/SECURITY.md` for complete documentation.
