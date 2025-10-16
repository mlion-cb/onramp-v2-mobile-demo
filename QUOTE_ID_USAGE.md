# Quote ID Usage - Best Practices

## 🎯 Why Quote IDs Matter

When you create an order with Coinbase, cryptocurrency prices can fluctuate rapidly. Using a quote ID **locks in the price** shown to the user during the quote phase.

**Without quote ID**: Price at order creation time (may differ from shown quote)
**With quote ID**: Price locked from quote (matches what user saw)

---

## ✅ What We Fixed

### Before (❌ Not Following Best Practices)

**Quote returned quote_id**:
- Widget: ✅ Had `quote_id` (session ID)
- Apple Pay: ❌ Missing `quote_id`

**Order creation**:
- ❌ Didn't include quote ID at all
- ❌ Price could differ from what user saw

---

### After (✅ Following Best Practices)

**Quote returns quote_id**:
- Widget: ✅ `quote_id: sessionId`
- Apple Pay: ✅ `quote_id: orderId`

**Order creation**:
- ✅ Includes `quoteId` field if available
- ✅ Locks in the price from the quote

---

## 🔄 The Flow

### Step 1: User Fetches Quote

**User types amount** → `fetchQuote()` called → Returns quote with ID:

```javascript
{
  purchase_amount: { value: "0.001", currency: "ETH" },
  payment_total: { value: "100.00", currency: "USD" },
  coinbase_fee: { value: "1.99", currency: "USD" },
  exchange_rate: { ... },
  quote_id: "order_abc123" or "session_xyz789",  // ← Quote ID
  raw: { ... }
}
```

This is stored in `currentQuote` state.

---

### Step 2: User Creates Order

**User confirms** → `createOrder()` called:

```typescript
const orderPayload = {
  paymentAmount: formData.amount,
  purchaseCurrency: "ETH",
  // ... other fields
};

// Include quote ID if available
if (currentQuote?.quote_id) {
  orderPayload.quoteId = currentQuote.quote_id;  // ← Lock in price!
  console.log('💰 [ORDER] Using quote ID to lock pricing:', currentQuote.quote_id);
}

const result = await createApplePayOrder(orderPayload, token);
```

---

### Step 3: Coinbase Validates Quote

Coinbase API receives the order with `quoteId`:

```json
{
  "paymentAmount": "100",
  "purchaseCurrency": "ETH",
  "quoteId": "order_abc123",  // ← Coinbase validates this
  ...
}
```

**If quote is still valid** (not expired):
- ✅ Order uses exact price from quote
- ✅ User gets what they saw

**If quote expired** (usually 30-60 seconds):
- ❌ Order rejected (quote expired error)
- User needs to fetch new quote

---

## 📊 Quote Types

### Apple Pay Quote (isQuote: true)

**Endpoint**: `/v2/onramp/orders`
**Returns**: Order object with `orderId`
**Quote ID**: `order.orderId`

```javascript
// Apple Pay quote response
{
  order: {
    orderId: "order_abc123",  // ← Use this as quote_id
    paymentAmount: "100",
    purchaseAmount: "0.001",
    // ... fees, etc
  }
}

// Extracted quote
{
  quote_id: "order_abc123",  // ← orderId becomes quote_id
  payment_total: { value: "100", currency: "USD" },
  ...
}
```

---

### Widget Quote (Session)

**Endpoint**: `/v2/onramp/sessions`
**Returns**: Session object with `sessionId`
**Quote ID**: `session.sessionId`

```javascript
// Widget session response
{
  session: {
    sessionId: "session_xyz789",  // ← Use this as quote_id
    onrampUrl: "https://pay.coinbase.com/...",
  },
  quote: {
    paymentAmount: "100",
    purchaseAmount: "0.001",
    // ... fees, etc
  }
}

// Extracted quote
{
  quote_id: "session_xyz789",  // ← sessionId becomes quote_id
  payment_total: { value: "100", currency: "USD" },
  ...
}
```

---

## 🧪 Testing Quote ID Usage

### Test 1: Verify Quote ID is Returned

1. Sign in to your app
2. Enter amount and select asset
3. **Check frontend logs**:
   ```
   // After quote loads, check currentQuote state
   currentQuote: {
     quote_id: "order_abc123" or "session_xyz789",  // ← Should exist!
     payment_total: { ... },
     ...
   }
   ```

---

### Test 2: Verify Quote ID is Sent in Order

1. After getting a quote, create an order
2. **Check frontend logs**:
   ```
   💰 [ORDER] Using quote ID to lock pricing: order_abc123
   ```

   **OR** if no quote:
   ```
   ⚠️ [ORDER] No quote ID - price may vary
   ```

3. **Check backend logs** (if running locally):
   ```
   // Request body should include quoteId
   {
     "paymentAmount": "100",
     "quoteId": "order_abc123",
     ...
   }
   ```

---

### Test 3: Quote Expiry Behavior

1. Fetch a quote
2. **Wait 2-3 minutes** (quotes typically expire after 30-60 seconds)
3. Try to create an order
4. **Expected**: Should fail with quote expired error
5. **Solution**: Fetch new quote and try again

---

## 🚨 Edge Cases

### Case 1: User Doesn't Fetch Quote First

**Scenario**: User directly creates order without viewing quote

**Behavior**:
```typescript
if (currentQuote?.quote_id) {
  // Has quote - use it
} else {
  // No quote - order created at current price
  console.log('⚠️ [ORDER] No quote ID - price may vary');
}
```

**Result**: Order succeeds but price may differ from expectation

---

### Case 2: Quote Fetch Fails

**Scenario**: Network error, unsupported network, etc.

**Behavior**:
```typescript
try {
  const quote = await fetchBuyQuote(...);
  setCurrentQuote(quote);
} catch (error) {
  console.log('Failed to fetch quote:', error);
  setCurrentQuote(null);  // ← No quote
}
```

**Result**: Order created without quote ID (price not locked)

---

### Case 3: User Changes Amount After Quote

**Scenario**: User gets quote for $100, then changes to $200 before creating order

**Current Behavior**:
- Quote is for $100 (different amount)
- Order is for $200 (new amount)
- Quote ID doesn't match → **Should be invalidated**

**Recommended Fix**: Clear quote when amount changes:

```typescript
// In OnrampForm when amount changes
useEffect(() => {
  if (amount !== currentQuote?.raw?.paymentAmount) {
    setCurrentQuote(null);  // Clear outdated quote
  }
}, [amount]);
```

---

## 📋 Coinbase API Expectations

According to Coinbase documentation:

**Quote endpoint** (`/orders` with `isQuote: true` or `/sessions`):
- Returns pricing information
- Returns quote identifier (orderId or sessionId)
- Quote valid for 30-60 seconds

**Order endpoint** (`/orders`):
- Accepts optional `quoteId` field
- If provided: Validates quote and locks price
- If not provided: Uses current market price
- If quote expired: Returns error, user must get new quote

---

## ✅ Best Practices Summary

1. ✅ **Always fetch quote before order** - Show user exact pricing
2. ✅ **Return quote_id from fetchBuyQuote** - Both Apple Pay and Widget
3. ✅ **Include quoteId when creating order** - Lock in the price
4. ✅ **Clear quote when parameters change** - Amount, asset, or network
5. ✅ **Handle quote expiry gracefully** - Prompt user to get fresh quote
6. ✅ **Log quote ID usage** - Makes debugging easier

---

## 🎯 Current Implementation Status

- ✅ Quote returns `quote_id` for both payment methods
- ✅ Order creation includes `quoteId` if available
- ✅ Logs show when quote ID is used
- ⚠️ **TODO**: Clear quote when amount/asset/network changes
- ⚠️ **TODO**: Handle quote expiry with user-friendly message
