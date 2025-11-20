# Deploying AbyssX to Render

## Quick Deploy Options

### Option 1: One-Click Deploy (Recommended)
1. Fork this repository to your GitHub account
2. Click the "Deploy to Render" button below:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/YOUR_USERNAME/abyssx-game)

### Option 2: Manual Deployment

## Step 1: Deploy Backend (API Server)

1. **Create New Web Service**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository

2. **Configure Backend Service**
   \`\`\`
   Name: abyssx-backend
   Environment: Node
   Build Command: npm install
   Start Command: npm run start
   \`\`\`
   *Note: The server's package.json is located in the root directory.*

3. **Set Environment Variables**
   \`\`\`
   NODE_ENV=production
   FRONTEND_URL=https://abyssx-frontend.onrender.com
   RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   \`\`\`

4. **Deploy Backend**
   - Click "Create Web Service"
   - Wait for deployment (usually 2-3 minutes)
   - Note your backend URL: `https://abyssx-backend.onrender.com`

## Step 2: Deploy Frontend (Static Site)

1. **Create New Static Site**
   - Click "New +" → "Static Site"
   - Connect same GitHub repository

2. **Configure Frontend Service**
   \`\`\`
   Name: abyssx-frontend
   Build Command: npm install && npm run build
   Publish Directory: out
   \`\`\`

3. **Set Environment Variables**
   \`\`\`
   NEXT_PUBLIC_API_URL=https://abyssx-backend.onrender.com
   NEXT_PUBLIC_WS_URL=https://abyssx-backend.onrender.com
   NEXT_PUBLIC_CHAIN_ID=1
   NEXT_PUBLIC_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
   \`\`\`

4. **Deploy Frontend**
   - Click "Create Static Site"
   - Wait for deployment
   - Your game will be live at: `https://abyssx-frontend.onrender.com`

## Step 3: Configure Smart Contract ABIs

You'll need to add your smart contract ABIs to the `abis/` directory:

1. **Get Contract ABIs**
   - From your contract deployment
   - Or from Etherscan for each contract address

2. **Add ABI Files**
   \`\`\`
   abis/AbyssXToken.json
   abis/PlayerProfile.json
   abis/UpgradeManager.json
   abis/DailyMiner.json
   \`\`\`

3. **Redeploy Backend**
   - Push changes to GitHub
   - Render will auto-deploy

## Step 4: Test Deployment

1. **Check Backend Health**
   \`\`\`bash
   curl https://abyssx-backend.onrender.com/health
   \`\`\`

2. **Test Frontend**
   - Visit your frontend URL
   - Connect MetaMask wallet
   - Try joining a game session

## Environment Variables Reference

### Backend (.env)
\`\`\`env
NODE_ENV=production
PORT=10000
FRONTEND_URL=https://abyssx-frontend.onrender.com
RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
\`\`\`

### Frontend (.env.local)
\`\`\`env
NEXT_PUBLIC_API_URL=https://abyssx-backend.onrender.com
NEXT_PUBLIC_WS_URL=https://abyssx-backend.onrender.com
NEXT_PUBLIC_CHAIN_ID=1
NEXT_PUBLIC_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
\`\`\`

## Troubleshooting

### Common Issues

1. **Backend Won't Start**
   - Check environment variables are set
   - Verify Node.js version (18+)
   - Check build logs for errors

2. **Frontend Build Fails**
   - Ensure all dependencies are in package.json
   - Check TypeScript errors
   - Verify Next.js config

3. **WebSocket Connection Issues**
   - Ensure CORS is configured correctly
   - Check that WS_URL matches backend URL
   - Verify Render allows WebSocket connections

4. **Smart Contract Errors**
   - Verify contract addresses are correct
   - Check ABI files are properly formatted
   - Ensure RPC_URL is working

### Performance Optimization

1. **Backend Scaling**
   - Upgrade to Standard plan for better performance
   - Enable auto-scaling if needed
   - Monitor memory usage

2. **Frontend Optimization**
   - Enable CDN for static assets
   - Optimize images and assets
   - Use Next.js Image optimization

### Monitoring

1. **Backend Logs**
   - Check Render dashboard for logs
   - Monitor API response times
   - Watch for WebSocket connection issues

2. **Frontend Analytics**
   - Monitor user connections
   - Track wallet connection success rate
   - Monitor game session creation

## Cost Estimation

### Render Pricing (as of 2024)
- **Backend (Web Service)**: $7/month (Starter plan)
- **Frontend (Static Site)**: Free
- **Total**: ~$7/month for basic deployment

### Additional Costs
- **Ethereum RPC**: Free tier with Infura/Alchemy
- **Supabase**: Free tier (up to 500MB)
- **Domain**: Optional (~$10-15/year)

## Production Checklist

- [ ] Backend deployed and healthy
- [ ] Frontend deployed and accessible
- [ ] Environment variables configured
- [ ] Smart contract ABIs uploaded
- [ ] Supabase database configured
- [ ] WebSocket connections working
- [ ] Wallet connection tested
- [ ] Multiplayer sessions tested
- [ ] Smart contract interactions tested
- [ ] Error monitoring setup
- [ ] Performance monitoring setup

## Support

If you encounter issues:
1. Check Render build logs
2. Verify environment variables
3. Test locally first
4. Check smart contract interactions on Etherscan
5. Monitor WebSocket connections

Your AbyssX game should now be live and ready for players! 🌊⛏️
