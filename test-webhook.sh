#!/bin/bash

# Webhook Test Script
# Tests both Apple Pay and Widget webhook formats

BASE_URL="${1:-http://localhost:3001}"

echo "🧪 Testing Webhook Endpoints"
echo "Target: $BASE_URL"
echo ""

# Test 1: Apple Pay Success Webhook
echo "📱 Test 1: Apple Pay Success Webhook"
curl -X POST "$BASE_URL/webhooks/onramp" \
  -H "Content-Type: application/json" \
  -H "x-coinbase-signature: test-signature" \
  -H "x-coinbase-timestamp: $(date +%s)" \
  -d '{
    "orderId": "123e4567-e89b-12d3-a456-426614174000",
    "eventType": "onramp.transaction.success",
    "paymentTotal": "100.75",
    "paymentSubtotal": "100",
    "paymentCurrency": "USD",
    "paymentMethod": "GUEST_CHECKOUT_APPLE_PAY",
    "purchaseAmount": "100.000000",
    "purchaseCurrency": "USDC",
    "destinationAddress": "0x1234567890abcdef",
    "destinationNetwork": "base",
    "status": "ONRAMP_ORDER_STATUS_COMPLETED",
    "txHash": "0xabcdef1234567890",
    "createdAt": "2025-09-10T10:30:00Z",
    "partnerUserRef": "user-0x1234567890abcdef"
  }'

echo -e "\n\n"

# Test 2: Widget Success Webhook
echo "🌐 Test 2: Widget Success Webhook"
curl -X POST "$BASE_URL/webhooks/onramp" \
  -H "Content-Type: application/json" \
  -H "x-coinbase-signature: test-signature" \
  -H "x-coinbase-timestamp: $(date +%s)" \
  -d '{
    "transactionId": "1f087a54-ff1f-62e8-9f85-aa77ac0499a5",
    "eventType": "onramp.transaction.success",
    "paymentTotal": {
      "currency": "USD",
      "value": "5"
    },
    "paymentMethod": "CARD",
    "purchaseAmount": {
      "currency": "USDC",
      "value": "4.81"
    },
    "purchaseCurrency": "USDC",
    "purchaseNetwork": "ethereum",
    "walletAddress": "0xe0512E358C347cc2b1A42d057065CE642068b7Ba",
    "status": "ONRAMP_TRANSACTION_STATUS_COMPLETED",
    "txHash": "0x",
    "partnerUserRef": "user-0xe0512E358C347cc2b1A42d057065CE642068b7Ba"
  }'

echo -e "\n\n"

# Test 3: Transaction Failed Webhook
echo "❌ Test 3: Transaction Failed Webhook"
curl -X POST "$BASE_URL/webhooks/onramp" \
  -H "Content-Type: application/json" \
  -H "x-coinbase-signature: test-signature" \
  -H "x-coinbase-timestamp: $(date +%s)" \
  -d '{
    "orderId": "failed-order-123",
    "eventType": "onramp.transaction.failed",
    "paymentAmount": "50.00",
    "paymentCurrency": "USD",
    "failureReason": "Payment declined by issuer",
    "failureCode": "card_declined",
    "partnerUserRef": "user-0x1234567890abcdef"
  }'

echo -e "\n\n✅ Tests complete! Check server logs for details."
