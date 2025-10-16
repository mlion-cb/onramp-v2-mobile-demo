# API Endpoints Analysis - Authentication Requirements

## 🎯 Problem

We added authentication middleware to ALL `/server/api` requests, but some endpoints should be **public** (no auth required) while others should be **protected** (auth required).

---

## 📊 Current Endpoints

| File | Endpoint | Auth Needed? | Why |
|------|----------|--------------|-----|
| `fetchBuyConfig.ts` | `/v1/buy/config` | ❌ NO | Public config (countries, assets, networks) |
| `fetchBuyOptions.ts` | `/v2/onramp/options` | ❌ NO | Public options (payment methods, currencies) |
| `fetchBuyQuote.ts` | `/v2/onramp/quote` | ❌ NO | Public quotes (pricing for anyone) |
| `createApplePayOrder.ts` | `/v2/onramp/orders` | ✅ YES | Creates real transaction |
| `createOnrampSession.ts` | `/v2/onramp/sessions` | ✅ YES | Creates widget session |
| `fetchTransactionHistory.ts` | `/v2/onramp/transactions` | ✅ YES | User-specific data |

---

## 🔓 Public Endpoints (No Auth Required)

These endpoints are designed to be called **before** the user signs in:

### 1. `/v1/buy/config` - Buy Configuration
**Called by**: `fetchBuyConfig.ts`
**Used for**: Loading countries, assets, networks in the UI
**When**: App startup, region selection
**Why public**: User needs to see options before deciding to sign in

### 2. `/v2/onramp/options` - Buy Options
**Called by**: `fetchBuyOptions.ts`
**Used for**: Loading payment methods, currencies
**When**: Form initialization
**Why public**: User needs to see what's available before signing in

### 3. `/v2/onramp/quote` - Price Quotes
**Called by**: `fetchBuyQuote.ts`
**Used for**: Showing real-time pricing, fees, totals
**When**: User types amount or selects asset
**Why public**: User needs to see pricing before committing to sign in

---

## 🔒 Protected Endpoints (Auth Required)

These endpoints create transactions or access user data:

### 1. `/v2/onramp/orders` - Create Order
**Called by**: `createApplePayOrder.ts`
**Used for**: Creating Apple Pay orders
**When**: User confirms purchase
**Why protected**: Creates real transaction, debits funds

### 2. `/v2/onramp/sessions` - Create Session
**Called by**: `createOnrampSession.ts`
**Used for**: Creating Coinbase Widget sessions
**When**: User chooses widget payment
**Why protected**: Creates checkout session, tracks user

### 3. `/v2/onramp/transactions` - Transaction History
**Called by**: `fetchTransactionHistory.ts`
**Used for**: Viewing past transactions
**When**: User views history
**Why protected**: User-specific private data

---

## ✅ Solution Options

### Option 1: Conditional Middleware (Recommended)

Make the middleware check which endpoint is being called and enforce auth only for protected endpoints:

```typescript
// validateToken.ts
export async function validateAccessToken(req, res, next) {
  const targetUrl = req.body?.url || '';

  // Public endpoints - no auth required
  const publicEndpoints = [
    '/v1/buy/config',
    '/v2/onramp/options',
    '/v2/onramp/quote'
  ];

  const isPublicEndpoint = publicEndpoints.some(endpoint => targetUrl.includes(endpoint));

  if (isPublicEndpoint) {
    console.log('🌐 [MIDDLEWARE] Public endpoint - skipping auth');
    return next();
  }

  // Protected endpoints - require auth
  console.log('🔒 [MIDDLEWARE] Protected endpoint - validating token');
  // ... existing validation logic
}
```

**Pros**:
- Single route `/server/api`
- Simple frontend (no changes needed)
- Clear logic in one place

**Cons**:
- Middleware needs to know about endpoint paths

---

### Option 2: Split Routes

Create separate routes for public and protected endpoints:

```typescript
// app.ts
app.post("/server/api/public", async (req, res) => {
  // No middleware - allow all
});

app.post("/server/api/protected", validateAccessToken, async (req, res) => {
  // Middleware enforces auth
});
```

Then update frontend to use the right route:

```typescript
// fetchBuyConfig.ts - public
const res = await fetch(`${BASE_URL}/server/api/public`, ...);

// createApplePayOrder.ts - protected
const res = await fetch(`${BASE_URL}/server/api/protected`, ...);
```

**Pros**:
- Clear separation
- Middleware doesn't need endpoint knowledge

**Cons**:
- Frontend changes required
- Two routes to maintain

---

### Option 3: Optional Token

Check for token but don't require it - validate if present:

```typescript
export async function validateAccessToken(req, res, next) {
  const authHeader = req.headers.authorization;

  // No token? Allow request but don't add user info
  if (!authHeader) {
    console.log('🌐 [MIDDLEWARE] No token - allowing unauthenticated request');
    return next();
  }

  // Has token? Validate it
  // ... existing validation logic
}
```

**Pros**:
- Most flexible
- Frontend can optionally send tokens

**Cons**:
- Protected endpoints aren't enforced
- Security risk if you forget to check in route handler

---

## 🎯 Recommended Implementation

**Use Option 1: Conditional Middleware**

This gives you:
- ✅ Public endpoints work without auth
- ✅ Protected endpoints require auth
- ✅ No frontend changes needed
- ✅ Clear security boundaries
- ✅ Easy to test

---

## 🧪 Testing Matrix

| Scenario | Endpoint | Has Token? | Expected Result |
|----------|----------|------------|-----------------|
| Anonymous user loads app | `/v1/buy/config` | ❌ No | ✅ Success - loads options |
| Anonymous user views quote | `/v2/onramp/quote` | ❌ No | ✅ Success - shows pricing |
| Anonymous user tries to buy | `/v2/onramp/orders` | ❌ No | ❌ 401 Unauthorized |
| Signed-in user views quote | `/v2/onramp/quote` | ✅ Yes | ✅ Success - shows pricing |
| Signed-in user creates order | `/v2/onramp/orders` | ✅ Yes | ✅ Success - creates order |
| Signed-in user (expired token) | `/v2/onramp/orders` | ⚠️ Invalid | ❌ 401 Unauthorized |

---

## 🚀 Next Steps

1. ✅ Update `validateAccessToken` middleware with conditional logic
2. ✅ Add public endpoint list
3. ✅ Test public endpoints work without auth
4. ✅ Test protected endpoints require auth
5. ✅ Update logging to show public vs protected
