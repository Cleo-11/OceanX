#!/bin/bash

# Test Claim Validation Implementation
# Tests CVE-002 mitigation: server-side claim amount validation

set -e

# Configuration
API_URL="${API_URL:-http://localhost:5000}"
TEST_WALLET="0x1234567890123456789012345678901234567890"
TEST_AUTH_HEADER="your-test-wallet-signature-here"

echo "🧪 Testing Claim Validation System"
echo "=================================="
echo "API URL: $API_URL"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_passed=0
test_failed=0

# Helper function to test endpoint
test_claim() {
    local test_name=$1
    local endpoint=$2
    local payload=$3
    local expected_status=$4
    local description=$5
    
    echo -n "Testing: $test_name... "
    
    response=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TEST_AUTH_HEADER" \
        -d "$payload" \
        "$API_URL$endpoint")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        echo "   Response: $(echo $body | jq -c '.' 2>/dev/null || echo $body)"
        ((test_passed++))
    else
        echo -e "${RED}✗ FAIL${NC} (Expected HTTP $expected_status, got $http_code)"
        echo "   Response: $(echo $body | jq -c '.' 2>/dev/null || echo $body)"
        ((test_failed++))
    fi
    echo ""
}

echo "📋 Test Suite: /marketplace/sign-claim endpoint"
echo "-----------------------------------------------"

# Test 1: Valid claim request (should pass if player has balance)
test_claim \
    "Valid claim with reasonable amount" \
    "/marketplace/sign-claim" \
    '{"ocxAmount": 10}' \
    "200" \
    "Should generate signature for valid amount"

# Test 2: Zero amount (should fail)
test_claim \
    "Zero amount claim" \
    "/marketplace/sign-claim" \
    '{"ocxAmount": 0}' \
    "400" \
    "Should reject zero amount with INVALID_AMOUNT"

# Test 3: Negative amount (should fail)
test_claim \
    "Negative amount claim" \
    "/marketplace/sign-claim" \
    '{"ocxAmount": -100}' \
    "400" \
    "Should reject negative amount"

# Test 4: Excessive amount (should fail if exceeds balance)
test_claim \
    "Excessive claim amount" \
    "/marketplace/sign-claim" \
    '{"ocxAmount": 999999999}' \
    "403" \
    "Should reject with AMOUNT_EXCEEDS_LIMIT"

# Test 5: Resource trade without ownership (should fail)
test_claim \
    "Resource trade without sufficient resources" \
    "/marketplace/sign-claim" \
    '{"ocxAmount": 50, "resourceType": "manganese", "resourceAmount": 999999}' \
    "403" \
    "Should reject with INSUFFICIENT_RESOURCES"

# Test 6: Idempotency check
IDEMPOTENCY_KEY="test-$(date +%s)"
test_claim \
    "First claim with idempotency key" \
    "/marketplace/sign-claim" \
    "{\"ocxAmount\": 5, \"idempotencyKey\": \"$IDEMPOTENCY_KEY\"}" \
    "200" \
    "Should generate signature with custom idempotency key"

test_claim \
    "Duplicate claim with same idempotency key" \
    "/marketplace/sign-claim" \
    "{\"ocxAmount\": 5, \"idempotencyKey\": \"$IDEMPOTENCY_KEY\"}" \
    "200" \
    "Should return idempotent response (not generate new signature)"

echo ""
echo "📋 Test Suite: /claim endpoint (relay flow)"
echo "-------------------------------------------"

# Test 7: Valid claim with wei amount
test_claim \
    "Valid relay claim" \
    "/claim" \
    '{"amount": "10000000000000000000", "userAddress": "'"$TEST_WALLET"'"}' \
    "200" \
    "Should relay transaction for valid amount in wei"

# Test 8: Invalid amount format
test_claim \
    "Invalid amount format" \
    "/claim" \
    '{"amount": "invalid", "userAddress": "'"$TEST_WALLET"'"}' \
    "400" \
    "Should reject with INVALID_AMOUNT"

# Test 9: Excessive relay amount
test_claim \
    "Excessive relay amount" \
    "/claim" \
    '{"amount": "999999999000000000000000000", "userAddress": "'"$TEST_WALLET"'"}' \
    "403" \
    "Should reject relay if exceeds max claimable"

# Test 10: Missing wallet address
test_claim \
    "Missing user address" \
    "/claim" \
    '{"amount": "1000000000000000000"}' \
    "401" \
    "Should require wallet authentication"

echo ""
echo "======================================="
echo "Test Results Summary"
echo "======================================="
echo -e "${GREEN}Passed: $test_passed${NC}"
echo -e "${RED}Failed: $test_failed${NC}"
echo ""

if [ $test_failed -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed. Review output above.${NC}"
    exit 1
fi
