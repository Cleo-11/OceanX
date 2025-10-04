# OAuth Authentication Debugging Guide

## Current Issue
After OAuth sign-in (Google), you're being redirected back to `/auth#` instead of `/connect-wallet`.

## Changes Made

### 1. Enhanced Auth Callback Route (`app/auth/callback/route.ts`)
- Added comprehensive error logging
- Added session verification after code exchange
- Added specific error codes for different failure scenarios
- Added `dynamic = 'force-dynamic'` to prevent caching issues

### 2. Updated Middleware (`middleware.ts`)
- Added detailed logging for all auth checks
- Excluded `/auth/callback` from the redirect loop prevention
- Better session state tracking

### 3. Updated Auth Pages
- `app/auth/page.tsx`: Added logging for session checks
- `app/auth/auth-page-client.tsx`: Added specific error messages for different auth failures

### 4. Fixed Environment Variable
- Removed trailing slash from `NEXT_PUBLIC_SITE_URL` in `.env.local`

## Critical Supabase Dashboard Settings

### ⚠️ MUST CHECK: Supabase Dashboard Configuration

Go to: **Supabase Dashboard → Your Project → Authentication → URL Configuration**

#### 1. Site URL
Set to (WITHOUT trailing slash):
```
https://ocean-x.vercel.app
```

#### 2. Redirect URLs
Add these to the **allowed redirect URLs list**:
```
https://ocean-x.vercel.app/auth/callback
http://localhost:3000/auth/callback
```

#### 3. Additional Redirect URLs
If you're using any other domains (staging, etc.), add them too.

## Common Issues and Solutions

### Issue 1: Hash Fragment (`#`) in URL
**Symptom**: Redirected to `https://ocean-x.vercel.app/auth#`

**Causes**:
1. Redirect URL mismatch in Supabase Dashboard
2. OAuth provider returning fragment instead of query params
3. PKCE flow not properly configured

**Solution**:
- Ensure Supabase redirect URLs match EXACTLY (no trailing slashes)
- Check that Google OAuth is configured correctly in Supabase

### Issue 2: Session Not Persisting
**Symptom**: Callback succeeds but session lost on next page

**Causes**:
1. Cookie domain mismatch
2. Secure flag issues (http vs https)
3. SameSite cookie restrictions

**Solution**:
- Verify Vercel deployment uses HTTPS
- Check browser console for cookie warnings
- Ensure cookies are not being blocked

### Issue 3: Redirect Loop
**Symptom**: Constantly redirecting between `/auth` and `/connect-wallet`

**Causes**:
1. Session not being read correctly
2. Middleware logic conflict
3. Server/client session mismatch

**Solution**:
- Check server logs for session verification
- Ensure middleware is not interfering with callback route

## Debugging Steps

### Step 1: Deploy Changes
```bash
git add .
git commit -m "Fix OAuth callback with enhanced logging and session verification"
git push origin master
```

### Step 2: Check Vercel Logs
After deploying, try signing in with Google and immediately check:
1. Vercel Function Logs (Dashboard → Your Project → Logs)
2. Look for `[auth/callback]` log entries
3. Check what error (if any) is being logged

### Step 3: Check Browser Console
1. Open browser DevTools (F12)
2. Go to Console tab
3. Try signing in with Google
4. Look for any JavaScript errors or warnings

### Step 4: Check Network Tab
1. Open DevTools → Network tab
2. Try signing in
3. Look at the redirect chain:
   - Should go to Google OAuth
   - Then to `/auth/callback?code=...`
   - Then to `/connect-wallet`
4. Check if any redirect fails or has wrong URL

### Step 5: Check Cookies
1. Open DevTools → Application tab (Chrome) or Storage tab (Firefox)
2. Look under Cookies → `https://ocean-x.vercel.app`
3. After OAuth, you should see Supabase auth cookies like:
   - `sb-qerlxuwcmaycgjiresjb-auth-token`
   - `sb-qerlxuwcmaycgjiresjb-auth-token-code-verifier`

## Expected Flow

### Successful OAuth Flow:
```
1. User clicks "Sign in with Google"
   ↓
2. Redirects to Google OAuth (external)
   ↓
3. User approves on Google
   ↓
4. Google redirects to: https://ocean-x.vercel.app/auth/callback?code=ABC123
   ↓
5. Callback route exchanges code for session
   ↓
6. Logs: "[auth/callback] Session exchange successful"
   ↓
7. Redirects to: https://ocean-x.vercel.app/connect-wallet
   ↓
8. User sees connect wallet page
```

### Current (Failing) Flow:
```
1. User clicks "Sign in with Google"
   ↓
2. Redirects to Google OAuth (external)
   ↓
3. User approves on Google
   ↓
4. ??? Something goes wrong here ???
   ↓
5. User ends up at: https://ocean-x.vercel.app/auth#
```

## What to Check Next

1. **Vercel Environment Variables**
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Ensure `NEXT_PUBLIC_SITE_URL` is set to `https://ocean-x.vercel.app` (no trailing slash)
   - Redeploy after changing environment variables

2. **Supabase Google OAuth Configuration**
   - Go to Supabase Dashboard → Authentication → Providers → Google
   - Ensure "Enabled" is checked
   - Verify Client ID and Client Secret are correct
   - Check if there are any additional settings needed

3. **Google Cloud Console**
   - Go to Google Cloud Console → APIs & Services → Credentials
   - Find your OAuth 2.0 Client ID
   - Check "Authorized redirect URIs" includes:
     - `https://qerlxuwcmaycgjiresjb.supabase.co/auth/v1/callback`
   - This is the Supabase OAuth callback, NOT your app's callback

## Testing Locally

To test locally:
```bash
# 1. Update .env.local with localhost URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# 2. Run dev server
pnpm dev

# 3. Try OAuth flow
# Should redirect to: http://localhost:3000/auth/callback?code=...
```

## Getting Help

If the issue persists, provide:
1. **Vercel logs** from the `/auth/callback` route
2. **Browser console errors** (if any)
3. **Network tab** showing the redirect chain
4. **Exact URL** you're being redirected to (including any error params)

Example of what to share:
```
Redirected to: https://ocean-x.vercel.app/auth?error=session_error

Vercel Logs:
[auth/callback] Processing OAuth callback
[auth/callback] Error exchanging code for session: { message: "..." }
```
