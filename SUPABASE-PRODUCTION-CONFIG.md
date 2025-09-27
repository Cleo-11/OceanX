# Supabase Production Configuration

## 🔧 **Supabase Dashboard Settings**

### 1. **Authentication Settings**

#### Site URL Configuration:
1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Settings** → **General**
3. Update **Site URL** to:
   ```
   https://oceanx-frontend.onrender.com
   ```

#### Redirect URLs:
1. In **Authentication** → **Settings** → **URL Configuration**
2. Add these **Redirect URLs**:
   ```
   https://oceanx-frontend.onrender.com/auth/callback
   https://oceanx-frontend.onrender.com/
   ```

### 2. **OAuth Provider Configuration (Google)**

If you're using Google OAuth:

1. Go to **Authentication** → **Providers** → **Google**
2. Update **Authorized redirect URIs** in your Google Cloud Console:
   ```
   https://your-project.supabase.co/auth/v1/callback
   ```
3. Update **Authorized JavaScript origins**:
   ```
   https://oceanx-frontend.onrender.com
   ```

### 3. **Database Configuration**

#### Row Level Security (RLS):
Make sure these policies are enabled:

```sql
-- Enable RLS on players table
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own data
CREATE POLICY "Users can view their own player data" ON players
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can update their own data  
CREATE POLICY "Users can update their own player data" ON players
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can insert their own data
CREATE POLICY "Users can insert their own player data" ON players
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### 4. **API Keys for Production**

You'll need these from your Supabase dashboard:

1. **Project URL**: `https://your-project.supabase.co`
2. **Anon Key**: Found in Settings → API
3. **Service Role Key**: Found in Settings → API (for server-side operations)

## 🔒 **Security Checklist**

- [ ] RLS is enabled on all sensitive tables
- [ ] Correct Site URL is set
- [ ] Redirect URLs include your production domain
- [ ] OAuth providers are configured for production domain
- [ ] API keys are set in Render environment variables (not in code)
- [ ] Database policies are properly configured

## 🧪 **Testing Production Auth**

After deployment, test these flows:

1. **Email Sign Up/Login**
   - Visit your production site
   - Try signing up with email
   - Check email confirmation works
   - Try logging in

2. **Google OAuth** (if enabled)
   - Try "Continue with Google"
   - Verify redirect works correctly
   - Check user data is saved to database

3. **Wallet Connection**
   - After authentication, try connecting wallet
   - Verify wallet address is linked to user_id
   - Test database updates

4. **Protected Routes**
   - Try accessing `/home` without auth (should redirect)
   - Try accessing `/game` without wallet (should redirect to connect-wallet)
   - Verify middleware is working

## ⚠️ **Common Production Issues**

1. **CORS Errors**: Make sure backend CORS includes your frontend URL
2. **Redirect Loops**: Check Site URL matches your actual domain
3. **OAuth Failures**: Verify OAuth provider settings include production URLs
4. **Database Errors**: Ensure RLS policies don't block legitimate operations

## 📋 **Environment Variables Needed**

### Frontend (Render):
```bash
NEXT_PUBLIC_SITE_URL=https://oceanx-frontend.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_API_URL=https://oceanx-backend.onrender.com
```

### Backend (Render):
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
FRONTEND_URL=https://oceanx-frontend.onrender.com
```