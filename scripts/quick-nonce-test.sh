#!/bin/bash

# Quick Nonce Validation Test
# Tests the /marketplace/sign-claim endpoint behavior

SERVER="http://localhost:3001"
WALLET="0x1234567890123456789012345678901234567890"

echo "🧪 Quick Nonce Validation Test"
echo "=============================="
echo ""

# Test 1: Check if server is running
echo "Test 1: Server Health Check"
echo "----------------------------"
response=$(curl -s -w "\n%{http_code}" "${SERVER}/api/health" 2>&1)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ] || [ "$http_code" = "404" ]; then
    echo "✅ Server is running on port 5000"
else
    echo "❌ Server not responding (HTTP $http_code)"
    echo "💡 Start the server with: pnpm dev"
    exit 1
fi
echo ""

# Test 2: Check NonceManager initialization
echo "Test 2: NonceManager Status"
echo "----------------------------"
response=$(curl -s -w "\n%{http_code}" "${SERVER}/debug/nonce-stats" 2>&1)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo "HTTP Status: $http_code"
echo "Response: $body"

if [ "$http_code" = "200" ]; then
    echo "✅ NonceManager is initialized"
    echo "📊 Stats: $body"
elif echo "$body" | grep -q "not initialized"; then
    echo "⚠️  NonceManager not initialized"
    echo "💡 This is expected if database migration hasn't run yet"
elif [ "$http_code" = "404" ]; then
    echo "❌ Debug endpoint not found"
    echo "💡 Make sure server/index.js has the debug endpoints"
else
    echo "⚠️  Unexpected response (HTTP $http_code)"
fi
echo ""

# Test 3: Try to sign a claim
echo "Test 3: Sign Claim Request"
echo "----------------------------"
response=$(curl -s -w "\n%{http_code}" \
    -X POST "${SERVER}/marketplace/sign-claim" \
    -H "Content-Type: application/json" \
    -d "{\"walletAddress\":\"${WALLET}\",\"amount\":\"100\"}" 2>&1)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo "HTTP Status: $http_code"
echo "Response: $body"

if [ "$http_code" = "200" ]; then
    echo "✅ Claim signing successful"
    if echo "$body" | grep -q "signature"; then
        echo "✅ Signature returned"
    fi
elif echo "$body" | grep -q "not initialized"; then
    echo "⚠️  NonceManager not initialized"
    echo "💡 Run the database migration first:"
    echo "   Execute: supabase/migrations/20251123_claim_signature_tracking.sql"
elif echo "$body" | grep -q "already signed"; then
    echo "✅ NONCE VALIDATION WORKING! Replay prevention detected"
    echo "🔒 This nonce was already used"
else
    echo "⚠️  Error: $body"
fi
echo ""

echo "=============================="
echo "📋 Summary"
echo "=============================="
echo ""
echo "Next Steps:"
echo "1. ✅ If NonceManager shows 'not initialized':"
echo "   → Run database migration in Supabase SQL editor"
echo "   → File: supabase/migrations/20251123_claim_signature_tracking.sql"
echo ""
echo "2. ✅ After migration:"
echo "   → Restart server: pnpm dev"
echo "   → Run full tests: bash scripts/test-nonce-validation.sh"
echo ""
echo "3. ✅ To verify replay protection:"
echo "   → Make same request twice"
echo "   → Second request should return existing signature"
echo ""
