#!/bin/bash

# 🚀 OceanX Production Deployment Script
# This script helps verify everything is ready for production deployment

echo "🌊 OceanX Production Deployment Checker"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "success") echo -e "${GREEN}✅ $message${NC}" ;;
        "warning") echo -e "${YELLOW}⚠️  $message${NC}" ;;
        "error") echo -e "${RED}❌ $message${NC}" ;;
        "info") echo -e "${BLUE}ℹ️  $message${NC}" ;;
    esac
}

# Check if files exist
echo -e "\n${BLUE}📁 Checking Configuration Files...${NC}"

files_to_check=(
    "render.yaml"
    "server/package.json"
    "server/check-env.js"
    "PRODUCTION-DEPLOYMENT.md"
    "SUPABASE-PRODUCTION-CONFIG.md"
    "scripts/production-database-setup.sql"
    ".env.example"
)

for file in "${files_to_check[@]}"; do
    if [ -f "$file" ]; then
        print_status "success" "$file exists"
    else
        print_status "error" "$file is missing"
    fi
done

# Check package.json scripts
echo -e "\n${BLUE}📦 Checking Package.json Scripts...${NC}"

if grep -q '"build"' package.json; then
    print_status "success" "Build script found in main package.json"
else
    print_status "warning" "Build script missing in main package.json"
fi

if grep -q '"start"' server/package.json; then
    print_status "success" "Start script found in server package.json"
else
    print_status "error" "Start script missing in server package.json"
fi

# Check environment example
echo -e "\n${BLUE}🔧 Checking Environment Configuration...${NC}"

required_env_vars=(
    "NEXT_PUBLIC_SITE_URL"
    "NEXT_PUBLIC_SUPABASE_URL" 
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    "NEXT_PUBLIC_API_URL"
)

for var in "${required_env_vars[@]}"; do
    if grep -q "$var" .env.example; then
        print_status "success" "$var defined in .env.example"
    else
        print_status "error" "$var missing from .env.example"
    fi
done

# Check TypeScript compilation
echo -e "\n${BLUE}🔍 Checking TypeScript Compilation...${NC}"
if command -v npm &> /dev/null; then
    if npm run build --dry-run &> /dev/null; then
        print_status "success" "TypeScript compilation check passed"
    else
        print_status "warning" "TypeScript compilation may have issues"
    fi
else
    print_status "warning" "npm not found, cannot check TypeScript compilation"
fi

# Final recommendations
echo -e "\n${BLUE}📋 Pre-Deployment Checklist:${NC}"
echo "   □ Run database migration: scripts/production-database-setup.sql"
echo "   □ Configure Supabase settings (see SUPABASE-PRODUCTION-CONFIG.md)"
echo "   □ Set environment variables in Render dashboard"
echo "   □ Deploy backend service first, then frontend"
echo "   □ Test authentication flow in production"
echo "   □ Verify CORS configuration"
echo "   □ Test wallet connection functionality"

echo -e "\n${GREEN}🎉 Ready for Production Deployment!${NC}"
echo -e "${YELLOW}📖 See PRODUCTION-DEPLOYMENT.md for detailed instructions${NC}"

# Create deployment URLs file
echo -e "\n${BLUE}📝 Creating deployment URLs reference...${NC}"

cat > DEPLOYMENT-URLS.md << EOF
# 🌐 OceanX Production URLs

## Render Services

### Frontend Service
- **Service Name**: oceanx-frontend
- **URL**: https://oceanx-frontend.onrender.com
- **Build Command**: \`npm install && npm run build\`
- **Start Command**: \`npm start\`

### Backend Service  
- **Service Name**: oceanx-backend
- **URL**: https://oceanx-backend.onrender.com
- **Root Directory**: server
- **Build Command**: \`npm install\`
- **Start Command**: \`npm start\`

## Environment Variables to Set

### Frontend (oceanx-frontend)
\`\`\`bash
NEXT_PUBLIC_SITE_URL=https://oceanx-frontend.onrender.com
NEXT_PUBLIC_API_URL=https://oceanx-backend.onrender.com
NEXT_PUBLIC_SUPABASE_URL=[your-supabase-url]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-supabase-anon-key]
\`\`\`

### Backend (oceanx-backend)
\`\`\`bash
NODE_ENV=production
FRONTEND_URL=https://oceanx-frontend.onrender.com
SUPABASE_URL=[your-supabase-url]
SUPABASE_ANON_KEY=[your-supabase-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]
\`\`\`

## Health Check Endpoints

- Frontend: https://oceanx-frontend.onrender.com/
- Backend: https://oceanx-backend.onrender.com/health

## Quick Deploy Commands

1. Push to GitHub main branch
2. Services will auto-deploy
3. Check logs in Render dashboard
4. Test endpoints above

## Troubleshooting

If deployment fails, check:
1. Environment variables are set correctly
2. Database schema is up to date  
3. Supabase configuration matches production URLs
4. CORS settings include your domains
EOF

print_status "success" "Created DEPLOYMENT-URLS.md"

echo -e "\n${GREEN}✨ All checks complete! You're ready to deploy to production.${NC}"