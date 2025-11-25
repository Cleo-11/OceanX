# ✅ Authentication Setup Checklist

## 📋 Quick Reference - Use this to verify your setup step-by-step

---

## 1️⃣ CODE CHANGES (Already Done ✅)

- [x] Sign-up form has email field
- [x] Sign-up form has username field
- [x] Sign-up form has password field  
- [x] Sign-up form has confirm password field
- [x] Username only shows on signup (not login)
- [x] Confirm password only shows on signup
- [x] Client validates username >= 3 characters
- [x] Client validates password >= 8 characters
- [x] Client validates passwords match
- [x] `signUpWithEmail()` accepts username parameter
- [x] Username stored in user metadata
- [x] Database trigger extracts username from metadata

---

## 2️⃣ DATABASE SETUP

### Run SQL Script

- [ ] Open Supabase Dashboard → SQL Editor
- [ ] Choose one:
  - [ ] **Fresh database:** Run `scripts/create-fresh-database.sql` (entire script)
  - [ ] **Existing database:** Run `scripts/update-player-trigger.sql` (trigger only)
- [ ] Verify no errors in SQL output
- [ ] Check trigger exists:
  ```sql
  SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';
  ```
  Expected: 1 row returned

---

## 3️⃣ SUPABASE EMAIL CONFIGURATION

### A. Email Confirmation Setting

**Path:** Dashboard → Authentication → Providers → Email

- [ ] **Development:** UNCHECK "Confirm email" (faster testing, no email needed)
- [ ] **Production:** CHECK "Confirm email" (security, requires email verification)

---

### B. Redirect URLs

**Path:** Dashboard → Authentication → URL Configuration

**Development:**
- [ ] Site URL: `http://localhost:3000`
- [ ] Redirect URLs: 
  - [ ] `http://localhost:3000/auth/callback`
  - [ ] `http://localhost:3000/**` (optional wildcard)

**Production:**
- [ ] Site URL: `https://yourdomain.com`
- [ ] Redirect URLs:
  - [ ] `https://yourdomain.com/auth/callback`
  - [ ] `https://yourdomain.com/**` (optional wildcard)

---

### C. Email Templates (Optional - Check if emails not arriving)

**Path:** Dashboard → Authentication → Email Templates

- [ ] Open "Confirm signup" template
- [ ] Verify `{{ .ConfirmationURL }}` exists in template
- [ ] Subject line is clear (e.g., "Confirm Your Email")
- [ ] Template is enabled (toggle on right side)

---

### D. SMTP Configuration (Production Only - Recommended)

**Path:** Dashboard → Project Settings → Auth → SMTP Settings

**Development:**
- [ ] Use default Supabase SMTP (no config needed)
- [ ] Accept rate limits (~4 emails/hour on free tier)

**Production (Choose one):**
- [ ] Option A: Keep default Supabase SMTP (not recommended - may go to spam)
- [ ] Option B: Configure SendGrid
  - [ ] Sign up at sendgrid.com
  - [ ] Create API key
  - [ ] Enable "Custom SMTP" in Supabase
  - [ ] Host: `smtp.sendgrid.net`
  - [ ] Port: `587`
  - [ ] User: `apikey`
  - [ ] Password: `<your-sendgrid-api-key>`
  - [ ] Sender Email: `noreply@yourdomain.com`
  - [ ] Verify sender email in SendGrid
- [ ] Option C: Configure Mailgun (similar to SendGrid)
- [ ] Option D: Configure Amazon SES (cheapest for volume)

**Test SMTP:**
- [ ] Send test email from Supabase SMTP settings page
- [ ] Check inbox (and spam folder)
- [ ] Verify email arrives within 2 minutes

---

## 4️⃣ ENVIRONMENT VARIABLES

### .env.local (Frontend - Development)

**File:** `.env.local` in project root

```env
# ✅ Required
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ✅ Backend API
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_WS_URL=ws://localhost:5000

# Optional blockchain (can be left blank for auth testing)
NEXT_PUBLIC_OCEAN_X_TOKEN_ADDRESS=
NEXT_PUBLIC_PLAYER_PROFILE_ADDRESS=
```

- [ ] File exists in project root
- [ ] `NEXT_PUBLIC_SITE_URL` matches Supabase Site URL
- [ ] `NEXT_PUBLIC_SUPABASE_URL` is your project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` is from Supabase → Settings → API → anon public key

### Restart Dev Server

- [ ] Stop dev server (Ctrl+C)
- [ ] Run: `pnpm dev` or `npm run dev`
- [ ] Verify no errors in terminal
- [ ] Check console: `validateEnv()` should pass

---

## 5️⃣ TEST SIGN-UP FLOW (Development)

### Navigate to Sign-Up Page

- [ ] Open browser: `http://localhost:3000/auth?mode=signup`
- [ ] Form loads successfully
- [ ] All 4 fields visible:
  - [ ] Email
  - [ ] Username
  - [ ] Password
  - [ ] Confirm Password

### Fill Form (Valid Input)

- [ ] Email: `test+1@gmail.com` (use `+` trick for multiple tests)
- [ ] Username: `TestPlayer123` (at least 3 chars)
- [ ] Password: `SecurePass123!` (at least 8 chars)
- [ ] Confirm Password: `SecurePass123!` (must match)

### Submit Form

- [ ] Click "Create Account"
- [ ] No error messages shown
- [ ] **If email confirmation DISABLED:**
  - [ ] Immediately redirects to `/connect-wallet`
- [ ] **If email confirmation ENABLED:**
  - [ ] Shows "Check your email for confirmation"
  - [ ] Email arrives in inbox (or spam) within 2 minutes
  - [ ] Click confirmation link in email
  - [ ] Redirects to `/connect-wallet`

---

## 6️⃣ TEST VALIDATION (Edge Cases)

### Username Validation

- [ ] Try username with 2 chars → Shows error: "Username must be at least 3 characters"
- [ ] Try username with 3 chars → Accepts
- [ ] Try username with 30 chars → Accepts
- [ ] Try username with 31 chars → Browser validation prevents (maxLength)

### Password Validation

- [ ] Try password with 7 chars → Shows error: "Password must be at least 8 characters"
- [ ] Try password with 8 chars → Accepts
- [ ] Try mismatched passwords → Shows error: "Passwords do not match"
- [ ] Try matching passwords → Accepts

### Email Validation

- [ ] Try invalid email (`test`) → Browser validation error
- [ ] Try valid email (`test@example.com`) → Accepts

---

## 7️⃣ VERIFY DATABASE RECORDS

### Open Supabase SQL Editor

**Path:** Dashboard → SQL Editor → New Query

### Check Auth Table

```sql
SELECT 
  id,
  email,
  confirmed_at,
  raw_user_meta_data->>'username' AS stored_username,
  created_at
FROM auth.users
WHERE email = 'test+1@gmail.com';
```

**Expected:**
- [ ] 1 row returned
- [ ] `email` = "test+1@gmail.com"
- [ ] `stored_username` = "TestPlayer123"
- [ ] `confirmed_at` = timestamp (if email confirmation enabled and completed)
- [ ] `confirmed_at` = null (if confirmation disabled OR email not yet confirmed)

### Check Players Table

```sql
SELECT 
  id,
  user_id,
  username,
  submarine_tier,
  coins,
  created_at
FROM players
WHERE username = 'TestPlayer123';
```

**Expected:**
- [ ] 1 row returned
- [ ] `username` = "TestPlayer123" (NOT "test+1@gmail.com")
- [ ] `submarine_tier` = 1
- [ ] `coins` = 0
- [ ] `user_id` = UUID (matches `auth.users.id`)

### Verify Linkage

```sql
SELECT 
  u.email,
  u.raw_user_meta_data->>'username' AS metadata_username,
  p.username AS player_username,
  p.submarine_tier,
  p.coins
FROM auth.users u
JOIN players p ON u.id = p.user_id
WHERE u.email = 'test+1@gmail.com';
```

**Expected:**
- [ ] 1 row returned
- [ ] `metadata_username` = "TestPlayer123"
- [ ] `player_username` = "TestPlayer123"
- [ ] Both usernames match

---

## 8️⃣ TEST SIGN-IN FLOW

### Navigate to Login Page

- [ ] Open: `http://localhost:3000/auth?mode=login`
- [ ] Form shows only email + password (NO username or confirm password)

### Fill Credentials

- [ ] Email: `test+1@gmail.com`
- [ ] Password: `SecurePass123!`

### Submit

- [ ] Click "Sign In"
- [ ] **If email confirmed OR confirmation disabled:**
  - [ ] Redirects to `/connect-wallet`
  - [ ] No errors
- [ ] **If email NOT confirmed and confirmation enabled:**
  - [ ] Shows error: "Email not confirmed"

### Verify Session

- [ ] Open DevTools → Application → Cookies
- [ ] Find cookie: `sb-<project-ref>-auth-token`
- [ ] Cookie contains JWT token (long string)
- [ ] Token has expiry date in future

---

## 9️⃣ TEST TOGGLE BETWEEN MODES

### From Login → Sign-Up

- [ ] On login page, click "Don't have an account? Sign up"
- [ ] URL changes to `?mode=signup`
- [ ] Username field appears
- [ ] Confirm password field appears
- [ ] Form clears previous email/password

### From Sign-Up → Login

- [ ] On signup page, click "Already have an account? Sign in"
- [ ] URL changes to `?mode=login`
- [ ] Username field disappears
- [ ] Confirm password field disappears
- [ ] Form clears previous data

---

## 🔟 TROUBLESHOOTING (If Issues Occur)

### Issue: Form validation errors not showing

- [ ] Check browser console for JavaScript errors
- [ ] Verify React state updates (use React DevTools)
- [ ] Try clearing browser cache

### Issue: Player record not created

- [ ] Verify trigger exists (Step 2)
- [ ] Check Supabase logs: Dashboard → Logs → Postgres Logs
- [ ] Manually create player:
  ```sql
  INSERT INTO players (user_id, username, submarine_tier, coins)
  VALUES (
    (SELECT id FROM auth.users WHERE email = 'test+1@gmail.com'),
    'TestPlayer123',
    1,
    0
  );
  ```

### Issue: Emails not arriving (Production)

- [ ] Check spam folder
- [ ] Verify SMTP settings saved correctly
- [ ] Check Supabase → Logs → Auth Logs for SMTP errors
- [ ] Test with different email provider (Gmail, Outlook, etc.)
- [ ] Wait 5 minutes (some SMTP providers delay)

### Issue: Redirect URL mismatch

- [ ] Verify `.env.local` → `NEXT_PUBLIC_SITE_URL`
- [ ] Verify Supabase → Auth → URL Configuration → Site URL
- [ ] Ensure both match EXACTLY (including http/https)
- [ ] Restart dev server after .env changes

### Issue: "Email already registered"

- [ ] Check if user exists but unconfirmed:
  ```sql
  SELECT email, confirmed_at FROM auth.users WHERE email = 'test+1@gmail.com';
  ```
- [ ] If `confirmed_at` is null and > 24 hours old, delete and retry:
  ```sql
  DELETE FROM auth.users WHERE email = 'test+1@gmail.com' AND confirmed_at IS NULL;
  ```

---

## ✅ FINAL VERIFICATION

All checks passed when:

- [x] Sign-up form has all 4 fields (email, username, password, confirm)
- [x] Validation works (username min 3, password min 8, passwords match)
- [x] Database trigger creates player record automatically
- [x] Username stored in both `auth.users` metadata AND `players.username`
- [x] Email confirmation works (if enabled) OR bypassed (if disabled)
- [x] Sign-in works with created credentials
- [x] Session persists (cookie exists)
- [x] Toggle between signup/login clears form

---

## 🎉 SUCCESS!

Your authentication system is now fully functional with:
- ✅ Complete registration form with username
- ✅ Password confirmation validation
- ✅ Proper database integration
- ✅ Email verification (configured)

**Next Steps:**
1. Test with multiple users
2. Enable email confirmation for production
3. Configure custom SMTP for production
4. Deploy and test on live domain

**Need More Help?**
- See: `docs/AUTH-SETUP-GUIDE.md` (detailed guide)
- See: `docs/AUTH-FIX-SUMMARY.md` (implementation summary)
