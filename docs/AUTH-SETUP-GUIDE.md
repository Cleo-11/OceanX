# 🔐 Authentication Setup & Email Verification Fix

## 📋 Overview
This guide covers:
1. ✅ Complete sign-up form with username + password confirmation
2. 🐛 Email verification debugging and fixes
3. ⚙️ Supabase configuration steps
4. ✅ Verification checklist

---

## 1. ✅ Sign-Up Form Implementation (COMPLETED)

### What Was Fixed

**Before:**
- Only email + password fields
- No username collection
- No password confirmation
- Username defaulted to email address

**After:**
- ✅ Email field
- ✅ Username field (3-30 characters, required)
- ✅ Password field (min 8 characters)
- ✅ Confirm Password field (must match password)
- ✅ Client-side validation
- ✅ Username stored in `auth.users` metadata and `players` table

### Files Modified

1. **`app/auth/auth-page-client.tsx`** - Updated sign-up form UI
2. **`lib/supabase.ts`** - Updated `signUpWithEmail` to accept username parameter
3. **`scripts/create-fresh-database.sql`** - Updated trigger to extract username from user metadata

### How It Works

**Sign-Up Flow:**
```
User fills form → Client validates → Supabase Auth creates user →
Database trigger fires → Player record created with username
```

**Data Storage:**
- **Email**: Stored in `auth.users.email` (Supabase Auth table)
- **Password**: Hashed and stored in `auth.users.encrypted_password` (Supabase Auth table)
- **Username**: Stored in both:
  - `auth.users.raw_user_meta_data->>'username'` (user metadata)
  - `players.username` (your game table)

**Username Priority (Database Trigger):**
1. Username from sign-up form (`raw_user_meta_data->>'username'`)
2. Google display name (`raw_user_meta_data->>'full_name'`)
3. Email prefix (before @ symbol)
4. Fallback: "Player"

---

## 2. 🐛 Email Verification Not Working - Debugging Guide

### Why Emails Aren't Arriving

#### ❌ **Most Common Issues:**

1. **Email Confirmation is Disabled** (default in dev mode)
2. **Incorrect redirect URL configuration**
3. **SMTP not configured / using default Supabase SMTP**
4. **Emails going to spam folder**
5. **Rate limiting hit during testing**
6. **Project email template issues**

---

## 3. ⚙️ Supabase Configuration Fixes

### Step 1: Check Email Confirmation Setting

**Path:** Supabase Dashboard → Authentication → Settings → Email Auth

**What to Check:**
```
☑ Enable email confirmations
```

**Status:**
- **Enabled** = Users MUST click email link before signing in ✅
- **Disabled** = Users can sign in immediately without email verification ⚠️

**Recommendation:**
- **Development**: Disable for faster testing
- **Production**: Enable for security

**How to Access:**
1. Go to [app.supabase.com](https://app.supabase.com)
2. Select your project
3. Click **Authentication** (left sidebar)
4. Click **Providers** tab
5. Find **Email** provider
6. Toggle "Confirm email" setting

---

### Step 2: Configure Redirect URLs

**Path:** Supabase Dashboard → Authentication → URL Configuration

**Required URLs:**

**For localhost development:**
```
Site URL: http://localhost:3000
Redirect URLs:
  - http://localhost:3000/auth/callback
  - http://localhost:3000/**  (wildcard for flexibility)
```

**For production:**
```
Site URL: https://yourdomain.com
Redirect URLs:
  - https://yourdomain.com/auth/callback
  - https://yourdomain.com/**
```

**How to Configure:**
1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL** to your main app URL
3. Add redirect URLs in **Redirect URLs** section (one per line)
4. Click **Save**

**⚠️ Important:**
- If your `.env.local` has `NEXT_PUBLIC_SITE_URL`, it MUST match Supabase Site URL
- Localhost URLs won't work in production
- HTTPS required for production

---

### Step 3: Check Email Templates

**Path:** Supabase Dashboard → Authentication → Email Templates

**Templates to Review:**

#### **Confirm Signup Template**
This email is sent when users click "Sign Up"

**Default Subject:** `Confirm Your Signup`

**Check:**
- ✅ Template is enabled
- ✅ `{{ .ConfirmationURL }}` variable exists in template
- ✅ No custom HTML/CSS breaking the link

**Test Template:**
```html
<h2>Confirm your signup</h2>
<p>Follow this link to confirm your email:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm Email</a></p>
```

#### **Magic Link Template** (if using magic links)
**Subject:** `Your Magic Link`

**Check:** Same as above but with `{{ .TokenHash }}` or `{{ .Token }}`

---

### Step 4: SMTP Configuration (Optional but Recommended)

**Why:** Supabase's default SMTP has rate limits and may go to spam.

**Path:** Supabase Dashboard → Project Settings → Auth → SMTP Settings

**Option A: Use Supabase Default SMTP (Easiest)**
- No configuration needed
- ⚠️ Rate limited (max ~4 emails/hour in free tier)
- May go to spam
- Good for development

**Option B: Custom SMTP (Recommended for Production)**

**Providers:**
- **SendGrid** (free tier: 100 emails/day)
- **Mailgun** (free trial)
- **Amazon SES** (cheap, 62,000 free emails/month)
- **Gmail** (for testing only, not recommended for production)

**Configuration Fields:**
```
SMTP Host: smtp.sendgrid.net
SMTP Port: 587
SMTP User: apikey
SMTP Password: <your SendGrid API key>
Sender Email: noreply@yourdomain.com
Sender Name: OceanX Game
```

**How to Set Up SendGrid (Example):**
1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Create API Key (Settings → API Keys)
3. Go to Supabase → Project Settings → Auth → SMTP
4. Enable "Enable Custom SMTP"
5. Fill in SendGrid credentials
6. Click **Save**
7. Send test email

**⚠️ Verification Required:**
- Verify sender email in SendGrid dashboard
- Add SPF/DKIM records to your domain DNS (for production)

---

### Step 5: Check Spam Folder & Gmail Filters

**If using Gmail:**

1. **Check Spam/Junk folder**
2. **Check "All Mail" folder**
3. **Search for:**
   - `from:noreply@supabase.io`
   - `from:noreply@yourdomain.com` (if custom SMTP)
   - Subject keywords: "confirm", "signup", "verification"

4. **Gmail Filters:**
   - Go to Gmail Settings → Filters and Blocked Addresses
   - Remove any filters blocking Supabase emails

5. **Mark as Not Spam:**
   - If found in spam, mark as "Not spam"
   - Add sender to contacts

---

### Step 6: Test Email Delivery

**Option A: Enable Email Confirmation Temporarily**

1. Supabase Dashboard → Authentication → Providers → Email
2. **Disable** "Confirm email"
3. Try signing up → Should work immediately without email
4. **Re-enable** after testing

**Option B: Check Supabase Logs**

1. Go to Supabase Dashboard → Logs → Auth Logs
2. Filter by "signup" or "email"
3. Look for errors like:
   - `SMTP connection failed`
   - `Rate limit exceeded`
   - `Email delivery failed`

**Option C: Use Supabase CLI to Test**

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Check auth logs
supabase functions logs --project-ref <your-project-ref>
```

---

## 4. 📝 Quick Fix Checklist

### For Development (Localhost)

- [ ] **Disable email confirmation** (faster testing)
  - Supabase → Auth → Providers → Email → Uncheck "Confirm email"

- [ ] **Add localhost redirect URLs**
  - Supabase → Auth → URL Configuration
  - Site URL: `http://localhost:3000`
  - Redirect URLs: `http://localhost:3000/auth/callback`

- [ ] **Update `.env.local`**
  ```env
  NEXT_PUBLIC_SITE_URL=http://localhost:3000
  NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
  NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
  ```

- [ ] **Test sign-up flow**
  - Should work immediately without email (if confirmation disabled)

---

### For Production

- [ ] **Enable email confirmation**
  - Supabase → Auth → Providers → Email → Check "Confirm email"

- [ ] **Configure custom SMTP** (recommended)
  - Supabase → Project Settings → Auth → SMTP Settings
  - Use SendGrid, Mailgun, or Amazon SES

- [ ] **Add production redirect URLs**
  - Supabase → Auth → URL Configuration
  - Site URL: `https://yourdomain.com`
  - Redirect URLs: `https://yourdomain.com/auth/callback`

- [ ] **Customize email templates**
  - Supabase → Auth → Email Templates
  - Update branding and messaging

- [ ] **Test with real email**
  - Sign up with Gmail, Outlook, etc.
  - Check spam folder
  - Verify link works

---

## 5. 🔧 Troubleshooting

### Problem: "Email already registered" but no user exists

**Solution:**
```sql
-- Check if user exists in auth.users
SELECT email, confirmed_at FROM auth.users WHERE email = 'test@example.com';

-- If unconfirmed for > 24 hours, delete and retry
DELETE FROM auth.users WHERE email = 'test@example.com' AND confirmed_at IS NULL;
```

---

### Problem: Confirmation link redirects to wrong URL

**Check:**
1. `.env.local` → `NEXT_PUBLIC_SITE_URL`
2. Supabase → Auth → URL Configuration → Site URL
3. Both should match!

**Fix:**
```env
# .env.local
NEXT_PUBLIC_SITE_URL=http://localhost:3000  # For dev
# or
NEXT_PUBLIC_SITE_URL=https://yourdomain.com  # For prod
```

---

### Problem: Emails not sending at all

**Debug Steps:**
1. Check Supabase logs (Dashboard → Logs → Auth)
2. Verify SMTP settings (if custom SMTP enabled)
3. Test with default Supabase SMTP first
4. Check rate limits (free tier: ~4 emails/hour)
5. Wait 15 minutes and retry (rate limit cooldown)

---

### Problem: User confirmed but can't sign in

**Check player creation:**
```sql
-- Verify player record exists
SELECT p.id, p.user_id, p.username, u.email 
FROM players p
JOIN auth.users u ON p.user_id = u.id
WHERE u.email = 'test@example.com';

-- If missing, trigger not working - check trigger exists:
SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- Manually create player:
INSERT INTO players (user_id, username, submarine_tier, coins)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'test@example.com'),
  'TestUser',
  1,
  0
);
```

---

## 6. ✅ End-to-End Verification Checklist

### Pre-Flight Checks

- [ ] Database trigger exists:
  ```sql
  SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';
  ```

- [ ] Environment variables set:
  ```bash
  # Check .env.local exists and contains:
  cat .env.local | grep SUPABASE
  ```

- [ ] Server running:
  ```bash
  pnpm dev
  # or
  npm run dev
  ```

---

### Test Sign-Up Flow

1. **Navigate to sign-up page**
   - URL: `http://localhost:3000/auth?mode=signup`

2. **Fill in form:**
   - Email: `test+123@gmail.com` (use `+` trick for testing)
   - Username: `TestPlayer123`
   - Password: `SecurePass123!`
   - Confirm Password: `SecurePass123!`

3. **Submit form**
   - ✅ Should show: "Check your email for confirmation"
   - ✅ Or (if confirmation disabled): Redirect to `/connect-wallet`

4. **Check email (if confirmation enabled)**
   - ✅ Email arrives within 1-2 minutes
   - ✅ Click confirmation link
   - ✅ Redirects to `/connect-wallet`

5. **Verify database:**
   ```sql
   -- Check auth.users
   SELECT id, email, confirmed_at, raw_user_meta_data->>'username' as username 
   FROM auth.users 
   WHERE email = 'test+123@gmail.com';

   -- Check players table
   SELECT id, user_id, username, submarine_tier, coins 
   FROM players 
   WHERE username = 'TestPlayer123';
   ```

6. **Expected Results:**
   - ✅ User exists in `auth.users` with `confirmed_at` timestamp
   - ✅ Player exists in `players` table with correct username
   - ✅ `players.user_id` matches `auth.users.id`
   - ✅ Username is `TestPlayer123` (not email)

---

### Test Sign-In Flow

1. **Navigate to login page**
   - URL: `http://localhost:3000/auth?mode=login`

2. **Fill in credentials:**
   - Email: `test+123@gmail.com`
   - Password: `SecurePass123!`

3. **Submit form**
   - ✅ Should redirect to `/connect-wallet`
   - ✅ Session cookie set
   - ✅ No errors in console

4. **Verify session:**
   - Open DevTools → Application → Cookies
   - Look for `sb-<project-ref>-auth-token` cookie
   - Should contain JWT token

---

## 7. 📂 Updated File Structure

```
app/
├── auth/
│   ├── page.tsx                    # Auth route wrapper
│   ├── auth-page-client.tsx        # ✅ UPDATED - Sign-up form with username
│   └── callback/
│       └── page.tsx                # OAuth callback handler
│
lib/
├── supabase.ts                     # ✅ UPDATED - signUpWithEmail accepts username
└── env.ts                          # Environment validation
│
scripts/
└── create-fresh-database.sql       # ✅ UPDATED - Trigger extracts username from metadata
│
docs/
└── AUTH-SETUP-GUIDE.md             # ✅ NEW - This file
```

---

## 8. 🎯 Summary of Changes

### Code Changes

**1. Sign-Up Form (`app/auth/auth-page-client.tsx`)**
- Added `username` state
- Added `confirmPassword` state
- Added `showConfirmPassword` state
- Added username input field (3-30 chars, required)
- Added confirm password input field
- Added client-side validation:
  - Username min 3 characters
  - Passwords must match
  - Password min 8 characters
- Pass username to `signUpWithEmail()`

**2. Supabase Helper (`lib/supabase.ts`)**
- Updated `signUpWithEmail()` signature:
  ```typescript
  // Before
  signUpWithEmail(email: string, password: string)

  // After
  signUpWithEmail(email: string, password: string, username?: string)
  ```
- Store username in user metadata: `data: { username }`

**3. Database Trigger (`scripts/create-fresh-database.sql`)**
- Updated `create_player_for_new_user()` function
- Extract username from metadata with priority:
  1. Form username (`raw_user_meta_data->>'username'`)
  2. Google name (`raw_user_meta_data->>'full_name'`)
  3. Email prefix
  4. Fallback: "Player"

---

### Configuration Changes (Required)

**Supabase Dashboard:**
1. **Email Confirmation** (Auth → Providers → Email)
   - Dev: Disable for faster testing
   - Prod: Enable for security

2. **Redirect URLs** (Auth → URL Configuration)
   - Dev: `http://localhost:3000/auth/callback`
   - Prod: `https://yourdomain.com/auth/callback`

3. **Site URL** (Auth → URL Configuration)
   - Dev: `http://localhost:3000`
   - Prod: `https://yourdomain.com`

4. **SMTP** (Optional, Project Settings → Auth → SMTP)
   - Use custom SMTP for production
   - SendGrid, Mailgun, or Amazon SES recommended

**Local Environment (`.env.local`):**
```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR...
```

---

## 9. 🚨 Common Mistakes to Avoid

1. **❌ Mismatch between `.env.local` and Supabase Site URL**
   - Must match exactly!

2. **❌ Forgetting to restart dev server after .env changes**
   - Always restart: `pnpm dev`

3. **❌ Using production URLs in development**
   - Use `http://localhost:3000` for local testing

4. **❌ Not checking spam folder**
   - Always check spam when testing emails

5. **❌ Testing with same email repeatedly**
   - Use `email+1@gmail.com`, `email+2@gmail.com` trick

6. **❌ Enabling email confirmation without SMTP**
   - Default SMTP has rate limits (4 emails/hour)

7. **❌ Not updating database trigger after SQL changes**
   - Re-run entire `create-fresh-database.sql` script or just the trigger

---

## 10. 📞 Need Help?

**Check Logs:**
- Browser DevTools → Console (frontend errors)
- Supabase Dashboard → Logs → Auth Logs (backend errors)
- Terminal running `pnpm dev` (Next.js errors)

**Common Error Messages:**

| Error | Cause | Fix |
|-------|-------|-----|
| `Email rate limit exceeded` | Too many emails sent | Wait 15 mins or disable email confirmation |
| `Invalid redirect URL` | URL not in allowed list | Add to Supabase → Auth → URL Configuration |
| `Email already registered` | User exists but unconfirmed | Delete from `auth.users` or complete confirmation |
| `Invalid password` | Wrong password during login | Reset password or check typo |
| `User not found` | Player record missing | Check trigger, manually create player |

---

## ✅ Done!

Your authentication system now has:
- ✅ Complete sign-up form with username
- ✅ Password confirmation validation
- ✅ Email verification setup (configured)
- ✅ Database trigger to store username
- ✅ Debugging tools and checklists

**Next Steps:**
1. Run through the verification checklist
2. Test sign-up → email → sign-in flow
3. Deploy to production with email confirmation enabled
