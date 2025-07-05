# OceanX Deployment Guide

## Frontend Deployment (Vercel)

### 1. Deploy to Vercel
1. Push your code to GitHub
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click "New Project"
4. Import your GitHub repository
5. Vercel will auto-detect Next.js settings

### 2. Environment Variables in Vercel
Add these in your Vercel project settings:

\`\`\`env
NEXT_PUBLIC_API_URL=https://oceanx-backend.onrender.com
NEXT_PUBLIC_WS_URL=https://oceanx-backend.onrender.com
NEXT_PUBLIC_CHAIN_ID=1
NEXT_PUBLIC_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
\`\`\`

### 3. Add Supabase Integration (Optional)
- Go to Vercel Dashboard → Integrations
- Add Supabase integration
- This will automatically set SUPABASE_URL and SUPABASE_ANON_KEY

---

## Backend Deployment (Render)

### 1. Deploy Backend to Render
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `oceanx-backend`
   - **Environment**: Node
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && npm start`

### 2. Environment Variables in Render
\`\`\`env
NODE_ENV=production
RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
FRONTEND_URL=https://your-vercel-app.vercel.app
\`\`\`

### 3. Update Frontend URL
After Vercel deployment, update the `FRONTEND_URL` in Render with your actual Vercel URL.

---

## Required External Services

### 1. Infura (Ethereum RPC)
- Sign up at [Infura.io](https://infura.io)
- Create a new project
- Copy your Project ID for RPC_URL

### 2. Supabase (Database)
- Already connected in v0
- Use existing SUPABASE_URL and SUPABASE_ANON_KEY

---

## Testing Deployment

### Health Checks
- Backend: `https://oceanx-backend.onrender.com/health`
- Frontend: `https://your-vercel-app.vercel.app`

### WebSocket Connection
- Test at: `https://oceanx-backend.onrender.com/socket.io/`

---

## Cost Breakdown
- **Vercel Frontend**: FREE (Hobby plan)
- **Render Backend**: $7/month (Starter plan)
- **Supabase**: FREE (up to 500MB)
- **Infura**: FREE (up to 100k requests/day)

**Total**: ~$7/month
