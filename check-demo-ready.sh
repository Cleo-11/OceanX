#!/bin/bash

# Demo Readiness Check Script
# Run this before demo to verify everything is working

echo "🔍 OceanX Demo Readiness Check"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track issues
CRITICAL_ISSUES=0
WARNINGS=0

# Function to check URL
check_url() {
  local url=$1
  local name=$2
  
  if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|301\|302"; then
    echo -e "${GREEN}✅${NC} $name is reachable"
  else
    echo -e "${RED}❌${NC} $name is NOT reachable"
    ((CRITICAL_ISSUES++))
  fi
}

# Function to check WebSocket
check_websocket() {
  local url=$1
  
  echo -e "${YELLOW}⏳${NC} Checking WebSocket connection..."
  
  # Simple test - just check if port is open
  if curl -s "$url" | grep -q "OceanX\|Socket\|OK"; then
    echo -e "${GREEN}✅${NC} WebSocket server is responding"
  else
    echo -e "${RED}❌${NC} WebSocket server is NOT responding"
    ((CRITICAL_ISSUES++))
  fi
}

echo "1️⃣  Checking Backend Health"
echo "----------------------------"

# Check if BACKEND_URL is set
if [ -z "$BACKEND_URL" ]; then
  echo -e "${YELLOW}⚠️${NC}  BACKEND_URL not set, using default"
  BACKEND_URL="https://oceanx-backend.onrender.com"
  ((WARNINGS++))
fi

check_url "$BACKEND_URL/health" "Backend Health Endpoint"
check_websocket "$BACKEND_URL"

echo ""
echo "2️⃣  Checking Frontend"
echo "----------------------------"

# Check if FRONTEND_URL is set
if [ -z "$FRONTEND_URL" ]; then
  echo -e "${YELLOW}⚠️${NC}  FRONTEND_URL not set, using default"
  FRONTEND_URL="https://oceanx.vercel.app"
  ((WARNINGS++))
fi

check_url "$FRONTEND_URL" "Frontend Homepage"

echo ""
echo "3️⃣  Checking Required Files"
echo "----------------------------"

if [ -f "server/index.js" ]; then
  # Check for critical updates
  if grep -q "transports: \[\"websocket\"\]" server/index.js; then
    echo -e "${GREEN}✅${NC} WebSocket polling disabled (good for performance)"
  else
    echo -e "${RED}❌${NC} WebSocket polling still enabled (will hurt performance)"
    ((CRITICAL_ISSUES++))
  fi
  
  if grep -q "connectionsByIP" server/index.js; then
    echo -e "${GREEN}✅${NC} Connection limiting enabled"
  else
    echo -e "${YELLOW}⚠️${NC}  Connection limiting not found"
    ((WARNINGS++))
  fi
  
  if grep -q "from('players')" server/index.js; then
    echo -e "${GREEN}✅${NC} Player auto-initialization code present"
  else
    echo -e "${YELLOW}⚠️${NC}  Player auto-initialization might be missing"
    ((WARNINGS++))
  fi
else
  echo -e "${RED}❌${NC} server/index.js not found!"
  ((CRITICAL_ISSUES++))
fi

if [ -f "components/error-boundary.tsx" ]; then
  echo -e "${GREEN}✅${NC} Error Boundary component exists"
else
  echo -e "${RED}❌${NC} Error Boundary component missing"
  ((CRITICAL_ISSUES++))
fi

echo ""
echo "4️⃣  Git Status Check"
echo "----------------------------"

if git diff --quiet; then
  echo -e "${GREEN}✅${NC} No uncommitted changes"
else
  echo -e "${YELLOW}⚠️${NC}  You have uncommitted changes. Run:"
  echo "     git status"
  echo "     git add ."
  echo "     git commit -m 'Pre-demo fixes'"
  echo "     git push origin master"
  ((WARNINGS++))
fi

echo ""
echo "5️⃣  Environment Variables Check"
echo "----------------------------"

# Check if critical env vars docs exist
if [ -f ".env.example" ]; then
  echo -e "${GREEN}✅${NC} .env.example exists"
else
  echo -e "${YELLOW}⚠️${NC}  .env.example not found"
  ((WARNINGS++))
fi

echo ""
echo "================================"
echo "📊 SUMMARY"
echo "================================"

if [ $CRITICAL_ISSUES -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}🎉 All checks passed! Ready for demo.${NC}"
  exit 0
elif [ $CRITICAL_ISSUES -eq 0 ]; then
  echo -e "${YELLOW}⚠️  $WARNINGS warning(s) found. Demo might work but check warnings.${NC}"
  exit 0
else
  echo -e "${RED}❌ $CRITICAL_ISSUES critical issue(s) found!${NC}"
  echo -e "${YELLOW}⚠️  $WARNINGS warning(s) found.${NC}"
  echo ""
  echo "⚠️  FIX CRITICAL ISSUES BEFORE DEMO!"
  exit 1
fi
