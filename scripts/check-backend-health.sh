#!/bin/bash

# Backend Health Check Script
# Run this to verify your Render backend is working properly

echo "🔍 Checking OceanX Backend Health..."
echo ""

# Check if we have the backend URL
BACKEND_URL="${1:-https://oceanx.onrender.com}"

echo "📍 Backend URL: $BACKEND_URL"
echo ""

# Test 1: Root endpoint
echo "✓ Test 1: Root Endpoint"
curl -s "$BACKEND_URL/" | head -n 5
echo ""
echo ""

# Test 2: Health endpoint
echo "✓ Test 2: Health Endpoint"
HEALTH_RESPONSE=$(curl -s "$BACKEND_URL/health")
echo "$HEALTH_RESPONSE" | jq '.' 2>/dev/null || echo "$HEALTH_RESPONSE"
echo ""
echo ""

# Test 3: Sessions endpoint
echo "✓ Test 3: Sessions Endpoint"
SESSIONS_RESPONSE=$(curl -s "$BACKEND_URL/sessions")
echo "$SESSIONS_RESPONSE" | jq '.' 2>/dev/null || echo "$SESSIONS_RESPONSE"
echo ""
echo ""

# Test 4: WebSocket connection (check if Socket.io responds)
echo "✓ Test 4: WebSocket Handshake"
WS_RESPONSE=$(curl -s "$BACKEND_URL/socket.io/?EIO=4&transport=polling")
echo "Status: $(echo $WS_RESPONSE | head -c 50)..."
echo ""
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 HEALTH CHECK SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if echo "$HEALTH_RESPONSE" | grep -q "OK"; then
    echo "✅ Backend is HEALTHY"
    echo "   Active Sessions: $(echo $HEALTH_RESPONSE | jq -r '.activeSessions' 2>/dev/null || echo 'N/A')"
    echo "   Total Players: $(echo $HEALTH_RESPONSE | jq -r '.totalPlayers' 2>/dev/null || echo 'N/A')"
    echo "   Claim Service: $(echo $HEALTH_RESPONSE | jq -r '.claimServiceAvailable' 2>/dev/null || echo 'N/A')"
else
    echo "❌ Backend health check FAILED"
    echo "   Make sure Render deployment finished successfully"
fi
echo ""

if echo "$WS_RESPONSE" | grep -q "0{"; then
    echo "✅ WebSocket endpoint is responding"
else
    echo "⚠️  WebSocket handshake may have issues"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Next Steps:"
echo "   1. If all tests pass, backend is ready for demo"
echo "   2. Check Render logs if any tests fail: https://dashboard.render.com"
echo "   3. Verify environment variables match deployed contracts"
echo ""
