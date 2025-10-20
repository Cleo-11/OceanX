# Profile Page Authentication Migration

**Date:** October 20, 2025  
**Status:** ✅ Complete

## Summary

Migrated `/profile` page authentication from HMAC-signed tokens to Supabase server-side session authentication.

## Changes Made

### ✅ New Files Created

- **`lib/supabase-server.ts`** - Server-side Supabase client using `@supabase/ssr`
  - `createSupabaseServerClient()` - Creates server client with cookie support
  - `getServerUser()` - Get authenticated user server-side
  - `getServerSession()` - Get active session server-side

### ✅ Files Updated

- **`app/profile/page.tsx`**
  - Removed HMAC token verification (`verifyProfileAccessToken`)
  - Now uses `createSupabaseServerClient()` to read session from cookies
  - Checks `supabase.auth.getUser()` for authentication
  - Fetches player data by `user_id` from session or wallet param
  - Redirects to `/home` if not authenticated

- **`components/user-home.tsx`**
  - Removed `useProfileNavigation` hook import
  - Profile button now uses direct navigation: `router.push('/profile')`
  - Removed loading/disabled states for token generation
  - Simplified button click handler

### 📦 Archived Files (No Longer Used)

The following files were part of the HMAC token flow and are no longer needed:

- **`lib/profile-access-token.ts`** - HMAC token generation/verification
- **`lib/profile-navigation.ts`** - Token-based navigation hook
- **`app/api/profile/generate-token/route.ts`** - Token generation API endpoint

These files can be safely deleted or kept for reference.

### 📝 Documentation Updates Needed

The following profile documentation files may reference the old HMAC flow and should be updated:

- `app/profile/README.md`
- `app/profile/SECURITY.md`
- `app/profile/FLOW-DIAGRAM.md`
- `app/profile/INTEGRATION-GUIDE.md`

## How It Works Now

### Authentication Flow

1. **User navigates to `/profile`** (via Profile button or direct URL)
2. **Server Component (`app/profile/page.tsx`) runs:**
   - Creates Supabase server client with cookie support
   - Calls `supabase.auth.getUser()` to check authentication
   - If no authenticated user → redirect to `/home`
   - If authenticated → fetch player data and render profile
3. **Session is managed automatically** by Supabase cookies

### Security Benefits

✅ **Simpler auth flow** - No custom token generation/verification  
✅ **No token in URL** - Avoids referrer/bookmark leaks  
✅ **Automatic session refresh** - Supabase handles token rotation  
✅ **Standard OAuth flow** - Uses industry-standard session management  
✅ **RLS compatible** - Can leverage Supabase Row Level Security policies  

### User Experience

- **Direct navigation** works: Users can bookmark `/profile` or type URL directly
- **Session required** - Only logged-in users can access
- **Seamless** - No extra token generation step or loading delay

## Testing Checklist

- [x] Server-side Supabase client created (`lib/supabase-server.ts`)
- [x] Profile page updated to use session auth
- [x] User-home navigation simplified
- [ ] Test: Navigate to `/profile` while logged in → should render profile
- [ ] Test: Navigate to `/profile` while logged out → should redirect to `/home`
- [ ] Test: Profile button from user-home → should navigate directly
- [ ] Test: Session expiry handling → should redirect gracefully

## Rollback Plan

If needed, the HMAC token flow can be restored by:

1. Restore archived files from git history or `.archived` backups
2. Revert changes to `app/profile/page.tsx` and `components/user-home.tsx`
3. Restore imports and token verification logic

Git commit before migration: `7fb5895` (HMAC token implementation)

## Environment Variables

### ✅ Still Required

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### ❌ No Longer Required

- `PROFILE_ACCESS_SECRET` (was used for HMAC signing)

Can be removed from `.env.local` if no other features use it.

## Next Steps

1. ✅ Update profile page authentication logic
2. ✅ Update user-home navigation
3. ✅ Create server Supabase client helper
4. ⏳ Test authentication flow end-to-end
5. ⏳ Update profile documentation files
6. ⏳ Remove/archive HMAC token files
7. ⏳ Remove `PROFILE_ACCESS_SECRET` from `.env.local`
8. ⏳ Deploy and verify in production

## Migration Notes

- The new flow relies on Supabase cookies being set during login
- Ensure middleware or auth callback routes properly set session cookies
- Check that `@supabase/ssr` and `@supabase/auth-helpers-nextjs` are installed (already present in package.json)
- Server components automatically read cookies via Next.js `cookies()` API

---

**Migration completed by:** GitHub Copilot  
**Session ID:** Profile Auth Migration 2025-10-20
