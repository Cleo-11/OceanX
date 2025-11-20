# Production Environment Configuration for Render

## 🚀 Deployment Steps

### 1. **Frontend Deployment (Next.js)**

**Service Name:** `oceanx-frontend`
**Build Command:** `npm install && npm run build`
**Start Command:** `npm start`

#### Environment Variables to set in Render Dashboard:
```bash
# Required for authentication
NEXT_PUBLIC_SITE_URL=https://oceanx-frontend.onrender.com
NEXT_PUBLIC_API_URL=https://oceanx-backend.onrender.com

# Supabase Configuration (get from your Supabase dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Optional: Contract addresses for Web3 functionality
NEXT_PUBLIC_OCEAN_X_TOKEN_ADDRESS=0x7082bd37ea9552faf0549abb868602135aada705
NEXT_PUBLIC_PLAYER_PROFILE_ADDRESS=0x3b4682e9e31c0fb9391967ce51c58e8b4cc02063
NEXT_PUBLIC_UPGRADE_MANAGER_ADDRESS=0xb8ca16e41aac1e17dc5ddd22c5f20b35860f9a0c
NEXT_PUBLIC_DAILY_MINER_ADDRESS=0x8b0f0580fe26554bbfa2668ee042f20301c3ced3
```

### 2. **Backend Deployment (Node.js API)**

**Service Name:** `oceanx-backend`
**Root Directory:** `server`
**Build Command:** `npm install`
**Start Command:** `npm start`

#### Environment Variables to set in Render Dashboard:
```bash
# Server Configuration
NODE_ENV=production
FRONTEND_URL=https://oceanx-frontend.onrender.com

# Database Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Blockchain Configuration
RPC_URL=https://mainnet.infura.io/v3/your-project-id
# or use: https://eth-mainnet.g.alchemy.com/v2/your-api-key
```

## 🔧 **Setup Instructions**

### Step 1: Create Render Services

1. **Create Frontend Service:**
   - Go to Render Dashboard → New → Web Service
   - Connect your GitHub repository
   - Name: `oceanx-frontend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Add environment variables from above

2. **Create Backend Service:**
   - Go to Render Dashboard → New → Web Service
   - Connect your GitHub repository
   - Name: `oceanx-backend`
   - Root Directory: `server`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Add environment variables from above

### Step 2: Configure Supabase for Production

1. **Update Site URL in Supabase:**
   - Go to your Supabase project
   - Settings → Authentication → Site URL
   - Set to: `https://oceanx-frontend.onrender.com`

2. **Add Redirect URLs:**
   - Settings → Authentication → URL Configuration
   - Add: `https://oceanx-frontend.onrender.com/auth/callback`

3. **Configure OAuth (if using Google):**
   - Settings → Authentication → Providers
   - Update redirect URLs for Google OAuth

### Step 3: Update CORS in Backend

Make sure your backend allows requests from your frontend domain.

## 🔒 **Security Checklist**

- [ ] All sensitive keys are set in Render dashboard (not in code)
- [ ] Supabase RLS policies are enabled and configured
- [ ] CORS is properly configured for your domain
- [ ] Environment variables are correctly set
- [ ] Database migrations have been run

## 📋 **Post-Deployment Verification**

1. **Frontend Health Check:**
   - Visit: `https://oceanx-frontend.onrender.com`
   - Test authentication flow
   - Test protected routes

2. **Backend Health Check:**
   - Visit: `https://oceanx-backend.onrender.com/health`
   - Should return server status

3. **Authentication Flow:**
   - Test sign up/login
   - Test wallet connection
   - Test database operations

## ⚠️ **Important Notes**

- Replace all `onrender.com` URLs with your actual Render service URLs
- Update Supabase configuration with your production URLs
- Make sure your database schema matches the updated types
- Test thoroughly in production before going live

## 🔄 **Auto-Deploy Setup**

Both services will automatically deploy when you push to your main branch on GitHub.