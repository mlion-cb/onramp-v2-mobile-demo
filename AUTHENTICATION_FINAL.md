# Final Authentication Setup - Summary

## ✅ What's Protected Now

All endpoints **EXCEPT** these two:
- ✅ `/v1/buy/config` - Public (countries, assets, networks)
- ✅ `/v2/onramp/options` - Public (payment methods, currencies)

Everything else **REQUIRES authentication**:
- 🔒 `/v2/onramp/orders` - Both quotes AND real orders
- 🔒 `/v2/onramp/sessions` - Both quotes AND real sessions
- 🔒 `/v2/onramp/transactions` - Transaction history

---

## 🔧 Changes Made

### 1. Middleware (`/server/src/validateToken.ts`)

**Simplified to only allow 2 public endpoints**:

```typescript
const publicEndpoints = [
  '/v1/buy/config',      // Buy configuration - PUBLIC
  '/v2/onramp/options'   // Payment options - PUBLIC
];

// Everything else requires authentication
```

**Removed** the `isQuote` special case - now ALL quotes require auth too.

---

### 2. Quote Function (`/utils/fetchBuyQuote.ts`)

**Added token parameter**:

```typescript
// BEFORE
export async function fetchBuyQuote(payload: {...}) {

// AFTER
export async function fetchBuyQuote(payload: {...}, accessToken: string) {
```

**Now passes token to both quote paths**:
- Apple Pay quotes: `createApplePayOrder(payload, accessToken)` ✅
- Widget quotes: Adds `Authorization: Bearer ${accessToken}` header ✅

---

### 3. useOnramp Hook (`/hooks/useOnramp.ts`)

**Updated `fetchQuote` to get and pass token**:

```typescript
const fetchQuote = useCallback(async (formData) => {
  // Get access token for authentication
  const token = await getAccessToken();
  console.log('🔐 [AUTH - Quote] Retrieved access token:', token ? '...' : 'NO TOKEN');

  const quote = await fetchBuyQuote({...}, token as string);  // ← Pass token
}, [getAssetSymbolFromName, getNetworkNameFromDisplayName, getAccessToken]);
```

---

## 🎯 Why You Saw "NO TOKEN" Before

**The bug**: `fetchBuyQuote` was calling `createApplePayOrder` but **NOT passing the second argument** (token).

**Line 25-36 in old code**:
```typescript
const response = await createApplePayOrder(
  {...payload, isQuote: true, ...},
  // ← Missing second argument! Should be `accessToken`
);
```

Since the token was missing, the function logged `NO TOKEN` but TypeScript didn't catch it because the parameter was typed as `string` (not `string | undefined`).

---

## 🧪 Testing - What You Should See Now

### 1. On App Load (Not Signed In)

**Frontend**:
```
✅ fetchBuyConfig works (no auth needed)
✅ fetchBuyOptions works (no auth needed)
```

**Backend** (if running locally):
```
🔒 [MIDDLEWARE] validateAccessToken called
🔒 [MIDDLEWARE] Target URL: .../v1/buy/config
🌐 [MIDDLEWARE] Public endpoint - skipping authentication
```

---

### 2. Fetching Quote (NOT Signed In)

**Frontend**:
```
🔐 [AUTH - Quote] Retrieved access token: NO TOKEN
⚠️ [API] No access token provided for quote - request will be unauthenticated
```

**Backend**:
```
🔒 [MIDDLEWARE] validateAccessToken called
🔒 [MIDDLEWARE] Target URL: .../v2/onramp/orders  (or /sessions)
🔒 [MIDDLEWARE] Protected endpoint - validating authentication
❌ [MIDDLEWARE] Missing or invalid Authorization header for protected endpoint
```

**Result**: `401 Unauthorized` ❌

---

### 3. Fetching Quote (Signed In)

**Frontend**:
```
🔐 [AUTH - Quote] Retrieved access token: eyJhbGciOiJFUzI1N...Uw5MTczMA
📤 [API] Authorization header added to quote request
```

**Backend**:
```
🔒 [MIDDLEWARE] validateAccessToken called
🔒 [MIDDLEWARE] Target URL: .../v2/onramp/orders
🔒 [MIDDLEWARE] Protected endpoint - validating authentication
🔒 [MIDDLEWARE] Token extracted: eyJ...
✅ Token valid (cached)  OR  ✅ Token valid, user: abc123
```

**Result**: Quote returned successfully ✅

---

### 4. Creating Real Order (Signed In)

**Frontend**:
```
🔐 [AUTH - Apple Pay] Retrieved access token: eyJhbGciOiJFUzI1N...Uw5MTczMA
📤 [API] createApplePayOrder - Token received: eyJ...
📤 [API] Authorization header added to request
```

**Backend**:
```
🔒 [MIDDLEWARE] validateAccessToken called
🔒 [MIDDLEWARE] Target URL: .../v2/onramp/orders
🔒 [MIDDLEWARE] Protected endpoint - validating authentication
✅ Token valid, user: abc123
✅ Authenticated request from user: abc123
```

**Result**: Order created successfully ✅

---

## 🚨 Expected Behavior

### User Flow:

1. **Open app** → Config/Options load ✅ (public)
2. **Type amount** → Quote fetch **FAILS** ❌ (requires auth now)
3. **Sign in** → Gets CDP session token
4. **Type amount** → Quote fetch succeeds ✅ (has token)
5. **Create order** → Order succeeds ✅ (has token)

### Important Note:

**Users MUST sign in BEFORE they can see pricing/quotes now.**

This is the trade-off for protecting the quote endpoints, since they return the onramp URL that can be used to transact.

---

## 📝 Why Quote URLs Are Sensitive

Looking at the quote response, it contains:

**Apple Pay Quote Response**:
```json
{
  "order": {
    "orderId": "abc123",
    "paymentLink": {
      "url": "https://pay.coinbase.com/..." // ← Can be used to complete transaction!
    }
  }
}
```

**Widget Session Response**:
```json
{
  "session": {
    "sessionId": "xyz789",
    "onrampUrl": "https://pay.coinbase.com/..." // ← Direct checkout link!
  }
}
```

These URLs are **transaction links** that anyone with the URL can use to complete a purchase. That's why they should be protected.

---

## ⚠️ Alternative: Keep Quotes Public

If you want users to see pricing **before** signing in, you would need to:

**Option A**: Use a different quote-only endpoint that doesn't return transaction URLs
- But Coinbase doesn't provide this
- The `/orders` and `/sessions` endpoints always return URLs

**Option B**: Allow quotes without auth, but strip out URLs on backend before returning
- Backend middleware could remove `paymentLink.url` and `onrampUrl` from responses
- Only allow full response when authenticated

**Option C**: Accept the risk
- Allow quotes without auth
- Assume the risk that someone could abuse the quote URLs

---

## 🎯 Current Decision

**Protect everything except config/options.**

Users must sign in to see:
- ❌ Pricing/quotes
- ❌ Create orders
- ❌ Create sessions

This is the most secure approach, though it requires authentication earlier in the user flow.

---

## 🔄 To Change This Later

If you want to allow public quotes again, update the middleware:

```typescript
// In validateToken.ts
const publicEndpoints = [
  '/v1/buy/config',
  '/v2/onramp/options',
  '/v2/onramp/orders',   // ← Add this
  '/v2/onramp/sessions'  // ← Add this
];
```

But remember: **This exposes transaction URLs to unauthenticated users.**

---

## ✅ Summary

- 🔒 **All endpoints protected** except config and options
- 🔒 **Quotes require auth** (to protect transaction URLs)
- ✅ **Token passed** from hook → function → API
- ✅ **Middleware validates** token for protected endpoints
- ✅ **Logs show** full authentication flow

**Your backend is now secure!** 🎉
