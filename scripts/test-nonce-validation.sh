#!/bin/bash

# Nonce Validation System Test Script
# Tests signature replay prevention

echo "🧪 Nonce Validation System Test Suite"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:5000}"
TEST_WALLET="0x1234567890123456789012345678901234567890"

echo "📡 Testing endpoint: $API_URL"
echo "🔑 Test wallet: $TEST_WALLET"
echo ""

# Test 1: Database Migration
echo "Test 1: Check Database Migration"
echo "---------------------------------"
echo "⚠️  Manual check required:"
echo "Run this SQL in Supabase:"
echo ""
echo "SELECT table_name FROM information_schema.tables"
echo "WHERE table_schema = 'public' AND table_name = 'claim_signatures';"
echo ""
echo "Expected: claim_signatures table should exist"
echo ""
read -p "Press Enter when migration is confirmed..."
echo ""

# Test 2: Nonce Manager Initialization
echo "Test 2: Check Nonce Manager Initialization"
echo "-------------------------------------------"
echo "Check server logs for:"
echo "  ✅ Nonce Manager initialized"
echo ""
read -p "Press Enter when confirmed..."
echo ""

# Test 3: Get nonce stats (debug endpoint)
echo "Test 3: Get Nonce Statistics"
echo "----------------------------"
STATS_RESPONSE=$(curl -s "$API_URL/debug/nonce-stats")
echo "Response: $STATS_RESPONSE"

if echo "$STATS_RESPONSE" | grep -q "total"; then
    echo -e "${GREEN}✅ Nonce stats endpoint working${NC}"
else
    echo -e "${RED}❌ Nonce stats endpoint failed${NC}"
fi
echo ""

# Test 4: Request signature (first attempt)
echo "Test 4: Request Claim Signature (First Attempt)"
echo "------------------------------------------------"
echo "This will generate a signature with the current nonce"
echo ""
echo "Manual test required:"
echo "1. Authenticate with wallet signature"
echo "2. Call POST /marketplace/sign-claim with valid auth"
echo "3. Save the returned signature and nonce"
echo ""
echo "Expected: Signature generated successfully"
echo "Expected log: '🔐 Generating signature for [wallet]: [amount] OCX (nonce: X)'"
echo ""
read -p "Press Enter when first signature obtained..."
FIRST_NONCE=""
read -p "Enter the nonce from response: " FIRST_NONCE
echo ""

# Test 5: Replay attack attempt (same nonce)
echo "Test 5: Replay Attack Prevention"
echo "---------------------------------"
echo "Attempt to request ANOTHER signature with the same nonce"
echo ""
echo "Manual test:"
echo "1. Call POST /marketplace/sign-claim again (same wallet)"
echo "2. Should receive EXISTING signature, not generate new one"
echo ""
echo "Expected response:"
echo "  { success: true, isExisting: true, message: 'Signature already generated for this nonce' }"
echo ""
echo "Expected log: '⚠️ Nonce X already signed for [wallet]'"
echo ""
read -p "Press Enter when replay test completed..."
echo ""

# Test 6: Concurrent requests
echo "Test 6: Concurrent Request Protection"
echo "--------------------------------------"
echo "Send multiple simultaneous requests for the same wallet"
echo ""
echo "Manual test (requires testing tool like Apache Bench or k6):"
echo "ab -n 10 -c 10 -H 'Authorization: Bearer TOKEN' \\"
echo "   -H 'Content-Type: application/json' \\"
echo "   -p payload.json \\"
echo "   $API_URL/marketplace/sign-claim"
echo ""
echo "Expected: Only ONE signature created"
echo "Expected: Other requests either:"
echo "  - Get 409 'Nonce already in use' OR"
echo "  - Get existing signature response"
echo ""
read -p "Press Enter when concurrent test completed..."
echo ""

# Test 7: Check database state
echo "Test 7: Verify Database Records"
echo "--------------------------------"
echo "Check claim_signatures table:"
echo ""
echo "SELECT wallet_address, nonce, status, signature IS NOT NULL as has_sig"
echo "FROM claim_signatures"
echo "WHERE wallet_address = LOWER('$TEST_WALLET')"
echo "ORDER BY created_at DESC"
echo "LIMIT 5;"
echo ""
echo "Expected:"
echo "  - One row per unique nonce"
echo "  - status = 'signed'"
echo "  - has_sig = true"
echo ""
read -p "Press Enter when database verified..."
echo ""

# Test 8: Signature expiration
echo "Test 8: Signature Expiration (Optional)"
echo "---------------------------------------"
echo "Wait 1 hour or manually update expires_at in database"
echo ""
echo "UPDATE claim_signatures"
echo "SET expires_at = NOW() - INTERVAL '1 minute'"
echo "WHERE wallet_address = LOWER('$TEST_WALLET');"
echo ""
echo "Then trigger cleanup:"
echo "SELECT expire_old_claim_signatures();"
echo ""
echo "Expected: Expired signatures have status = 'expired'"
echo ""
read -p "Press Enter to skip or when expiration tested..."
echo ""

# Test 9: Blockchain confirmation webhook
echo "Test 9: Blockchain Confirmation Webhook"
echo "----------------------------------------"
echo "Simulate blockchain confirmation:"
echo ""

WEBHOOK_PAYLOAD="{\"wallet\":\"$TEST_WALLET\",\"nonce\":\"$FIRST_NONCE\",\"txHash\":\"0xabc123\"}"
echo "curl -X POST $API_URL/webhook/claim-processed \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '$WEBHOOK_PAYLOAD'"
echo ""

if [ -n "$FIRST_NONCE" ]; then
    WEBHOOK_RESPONSE=$(curl -s -X POST "$API_URL/webhook/claim-processed" \
        -H 'Content-Type: application/json' \
        -d "{\"wallet\":\"$TEST_WALLET\",\"nonce\":\"$FIRST_NONCE\",\"txHash\":\"0xtest123\"}")
    
    echo "Response: $WEBHOOK_RESPONSE"
    
    if echo "$WEBHOOK_RESPONSE" | grep -q "success.*true"; then
        echo -e "${GREEN}✅ Webhook processed successfully${NC}"
        echo "Check database: status should be 'claimed'"
    else
        echo -e "${YELLOW}⚠️  Webhook response unexpected${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Skipped (no nonce provided)${NC}"
fi
echo ""

# Summary
echo "================================"
echo "🎯 Test Summary"
echo "================================"
echo ""
echo "Manual Verification Checklist:"
echo ""
echo "[ ] Database migration created claim_signatures table"
echo "[ ] Nonce Manager initialized on server startup"
echo "[ ] First signature request generates NEW signature"
echo "[ ] Second signature request returns EXISTING signature"
echo "[ ] Concurrent requests prevented by UNIQUE constraint"
echo "[ ] Database has correct records (one per nonce)"
echo "[ ] Cleanup expires old signatures"
echo "[ ] Webhook marks claims as 'claimed'"
echo ""
echo "Security Verification:"
echo "[ ] Replay attack prevented (same signature returned)"
echo "[ ] No duplicate signatures for same nonce"
echo "[ ] Expired signatures cannot be reused"
echo "[ ] Audit trail maintained in database"
echo ""
echo "📚 Documentation:"
echo "  - Implementation: CRITICAL-SECURITY-NONCE-VALIDATION.md"
echo "  - Database Schema: supabase/migrations/20251123_claim_signature_tracking.sql"
echo "  - Code: server/lib/nonceManager.js"
echo ""
echo "🚀 Next Steps:"
echo "1. Monitor production logs for '⚠️ Nonce X already signed' warnings"
echo "2. Set up alerts for unusual nonce usage patterns"
echo "3. Review claim_signatures table periodically"
echo "4. Implement blockchain event listener for automatic confirmations"
echo ""
echo "✅ Nonce Validation System Test Complete!"
