# Testing CDP Token Validation API

## 🎯 What You'll See

When a request comes in that requires authentication, your backend logs will show the full CDP API validation flow.

---

## 📊 Success Case (Valid Token)

### Step 1: Request Arrives
```
🔒 [MIDDLEWARE] validateAccessToken called
🔒 [MIDDLEWARE] Target URL: https://api.cdp.coinbase.com/platform/v2/onramp/orders
🔒 [MIDDLEWARE] Protected endpoint - validating authentication
🔒 [MIDDLEWARE] Headers: {
  authorization: 'Bearer eyJhbGciOiJFUzI1NiIs...',
  'content-type': 'application/json',
  origin: 'http://localhost:8081'
}
```

### Step 2: Token Extracted
```
🔒 [MIDDLEWARE] Token extracted: eyJhbGciOiJFUzI1Ni...abc123def456
```

### Step 3: Cache Check (First Request)
```
(No cache hit - will call CDP API)
```

### Step 4: CDP API Call
```
🔍 Validating token with CDP API...
🔍 [CDP API] Endpoint: https://api.cdp.coinbase.com/platform/v2/end-users/auth/validate-token
🔍 [CDP API] Method: POST
🔍 [CDP API] Sending token: eyJhbGciOiJFUzI1NiIsInR5cCI...
```

### Step 5: CDP API Response (Success)
```
📥 [CDP API] Response status: 200
📥 [CDP API] Response ok: true
📥 [CDP API] Response headers: {
  'content-type': 'application/json',
  'x-request-id': 'req_abc123xyz789'
}
```

### Step 6: Response Body
```
✅ [CDP API] Token validation SUCCESS
✅ [CDP API] Response body: {
  "id": "user-abc123-def456-ghi789",
  "email": "user@example.com",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
✅ Token valid, user: user-abc123-def456-ghi789
```

### Step 7: Request Proceeds
```
✅ Authenticated request from user: user-abc123-def456-ghi789
```

---

## 🔄 Success Case (Cached Token - Subsequent Requests)

```
🔒 [MIDDLEWARE] validateAccessToken called
🔒 [MIDDLEWARE] Target URL: https://api.cdp.coinbase.com/platform/v2/onramp/orders
🔒 [MIDDLEWARE] Protected endpoint - validating authentication
🔒 [MIDDLEWARE] Token extracted: eyJhbGciOiJFUzI1Ni...abc123def456
✅ Token valid (cached)
✅ Authenticated request from user: user-abc123-def456-ghi789
```

**Note**: No CDP API call! Token is cached for 5 minutes.

---

## ❌ Failure Case (Invalid/Expired Token)

### Step 1-4: Same as success case

### Step 5: CDP API Response (Failure)
```
📥 [CDP API] Response status: 401
📥 [CDP API] Response ok: false
📥 [CDP API] Response headers: {
  'content-type': 'application/json',
  'x-request-id': 'req_xyz789abc123'
}
```

### Step 6: Error Details
```
❌ [CDP API] Token validation FAILED
❌ [CDP API] Status: 401
❌ [CDP API] Status Text: Unauthorized
❌ [CDP API] Error body: {
  "error": "invalid_token",
  "error_description": "Token is expired or invalid"
}
```

### Step 7: Request Blocked
```
(Request stops here - 401 returned to client)
```

---

## ⚠️ Failure Case (No Token Provided)

```
🔒 [MIDDLEWARE] validateAccessToken called
🔒 [MIDDLEWARE] Target URL: https://api.cdp.coinbase.com/platform/v2/onramp/orders
🔒 [MIDDLEWARE] Protected endpoint - validating authentication
🔒 [MIDDLEWARE] Headers: {
  authorization: 'MISSING',
  'content-type': 'application/json',
  origin: 'http://localhost:8081'
}
❌ [MIDDLEWARE] Missing or invalid Authorization header for protected endpoint
(Request stops here - 401 returned to client)
```

**Note**: Doesn't even call CDP API - fails fast!

---

## 🧪 How to Test

### Test 1: Check if CDP API is being called

1. **Start your backend server**:
   ```bash
   cd server
   npm run dev
   ```

2. **Sign in to your app** (get a real CDP token)

3. **Try to fetch a quote** (this requires auth now)

4. **Watch your backend console** - You should see:
   - `🔍 Validating token with CDP API...` ← CDP call is happening
   - `📥 [CDP API] Response status: 200` ← CDP responded
   - `✅ [CDP API] Token validation SUCCESS` ← Token is valid

### Test 2: Check cache behavior

1. **Make the same request again within 5 minutes**

2. **Watch your backend console** - You should see:
   - `✅ Token valid (cached)` ← No CDP API call!

### Test 3: Test expired/invalid token

1. **Manually edit your token in the frontend** (make it invalid)

2. **Try to fetch a quote**

3. **Watch your backend console** - You should see:
   - `🔍 Validating token with CDP API...`
   - `❌ [CDP API] Token validation FAILED`
   - `❌ [CDP API] Status: 401`
   - `❌ [CDP API] Error body: {...}`

---

## 🔍 What Each Log Tells You

| Log | What It Means |
|-----|---------------|
| `🔍 [CDP API] Endpoint: ...` | About to call CDP validation API |
| `🔍 [CDP API] Sending token: eyJ...` | Token being validated |
| `📥 [CDP API] Response status: 200` | CDP API responded successfully |
| `📥 [CDP API] Response status: 401` | CDP API rejected the token |
| `✅ [CDP API] Response body: {...}` | Full user data from CDP |
| `✅ Token valid (cached)` | Using cached validation (no API call) |
| `❌ [CDP API] Token validation FAILED` | Token is invalid/expired |

---

## 🐛 Troubleshooting

### Problem: No CDP API logs at all

**Possible causes**:
1. Middleware isn't being called (route not protected)
2. Request is hitting a public endpoint
3. Request is failing before reaching middleware

**Check**:
- Do you see `🔒 [MIDDLEWARE] validateAccessToken called`?
- If YES: Middleware is running
- If NO: Middleware isn't applied or request isn't reaching it

---

### Problem: CDP API returns 401 for valid token

**Possible causes**:
1. Token format is wrong (not a valid JWT)
2. Token is expired (CDP tokens have limited lifetime)
3. Token is for a different environment (sandbox vs prod)
4. CDP API is having issues

**Check the error body**:
```
❌ [CDP API] Error body: {
  "error": "invalid_token",
  "error_description": "..." // ← Read this!
}
```

---

### Problem: CDP API never responds

**Possible causes**:
1. Network issue (can't reach CDP API)
2. Firewall blocking outbound requests
3. CDP API is down

**Check**:
- Do you see `🔍 Validating token with CDP API...` but no response logs?
- Try hitting the CDP API manually: `curl https://api.cdp.coinbase.com/platform/v2/end-users/auth/validate-token`

---

## 🎯 Expected Flow for Your App

### Scenario: User Signs In and Fetches Quote

**Frontend logs**:
```
🔐 [AUTH - Quote] Retrieved access token: eyJhbGciOiJFUzI1Ni...
📤 [API] Authorization header added to quote request
```

**Backend logs** (first request):
```
🔒 [MIDDLEWARE] validateAccessToken called
🔒 [MIDDLEWARE] Target URL: .../v2/onramp/orders
🔒 [MIDDLEWARE] Protected endpoint - validating authentication
🔒 [MIDDLEWARE] Token extracted: eyJhbGciOiJFUzI1Ni...
🔍 Validating token with CDP API...
🔍 [CDP API] Endpoint: https://api.cdp.coinbase.com/platform/v2/end-users/auth/validate-token
🔍 [CDP API] Sending token: eyJhbGciOiJFUzI1Ni...
📥 [CDP API] Response status: 200
📥 [CDP API] Response ok: true
✅ [CDP API] Token validation SUCCESS
✅ [CDP API] Response body: { "id": "user-123", "email": "user@example.com", ... }
✅ Token valid, user: user-123
✅ Authenticated request from user: user-123
```

**Backend logs** (second request - within 5 min):
```
🔒 [MIDDLEWARE] validateAccessToken called
🔒 [MIDDLEWARE] Token extracted: eyJhbGciOiJFUzI1Ni...
✅ Token valid (cached)
✅ Authenticated request from user: user-123
```

---

## 🗑️ Removing These Logs Later

Once you've verified everything works, you can remove the detailed CDP API logs:

**In `/server/src/validateToken.ts`**, remove lines 65-67, 80-85, 90-93, 102-103 (the detailed logging).

Keep the essential logs:
- `✅ Token valid (cached)`
- `✅ Token valid, user: ${userData.id}`
- `❌ Token validation failed: ${response.status}`
