# Testing Backend Authentication Locally

## 🎯 What to Look For

You should see a **chain of logs** showing the token flowing through your app:

```
Frontend (Mobile) → Backend API → Middleware → CDP Validation
```

---

## 📱 Frontend Logs (React Native/Expo)

When you try to create an order or widget session, look for these logs in your **Expo console**:

### 1. Token Retrieved from CDP
```
🔐 [AUTH - Apple Pay] Retrieved access token: eyJhbGciOiJFUzI1N...Uw5MTczMA
```
or
```
🔐 [AUTH - Widget] Retrieved access token: eyJhbGciOiJFUzI1N...Uw5MTczMA
```

**✅ What this means**: The `useGetAccessToken()` hook successfully retrieved a token from CDP

**❌ If you see `NO TOKEN`**: User is not authenticated with CDP, or CDP session is expired

---

### 2. Token Sent to Backend
```
📤 [API] createApplePayOrder - Token received: eyJhbGciOiJFUzI1N...Uw5MTczMA
📤 [API] Authorization header added to request
```
or
```
📤 [API] createOnrampSession - Token received: eyJhbGciOiJFUzI1N...Uw5MTczMA
📤 [API] Authorization header added to request
```

**✅ What this means**: Token is being passed to the API function and added to headers

**❌ If you see warning**: `⚠️ [API] No access token provided - request will be unauthenticated`

---

## 🖥️ Backend Logs (Vercel/Local Server)

In your **server terminal** (where you run `npm run dev`), you should see:

### 3. Middleware Receives Request
```
🔒 [MIDDLEWARE] validateAccessToken called
🔒 [MIDDLEWARE] Headers: {
  authorization: 'Bearer eyJhbGciOiJFUzI1N...',
  'content-type': 'application/json',
  origin: 'http://localhost:8081'
}
🔒 [MIDDLEWARE] Token extracted: eyJhbGciOiJFUzI1N...Uw5MTczMA
```

**✅ What this means**: Middleware received the Authorization header with Bearer token

**❌ If you see**: `❌ [MIDDLEWARE] Missing or invalid Authorization header`
- Token was not sent from frontend
- Check frontend logs to see if token was retrieved

---

### 4. Token Validation

**Option A: Cached Token (Fast)**
```
✅ Token valid (cached)
```

**Option B: Fresh Validation (Calls CDP API)**
```
🔍 Validating token with CDP API...
✅ Token valid, user: abc123-def456-ghi789
```

**✅ What this means**: Token is valid and user is authenticated

**❌ If validation fails**:
```
❌ Token validation failed: 401
```
- Token is invalid or expired
- CDP API rejected the token
- User needs to re-authenticate

---

### 5. Request Proceeds to Route Handler
```
✅ Authenticated request from user: abc123-def456-ghi789
```

**✅ What this means**: Middleware called `next()`, request is now in your route handler

---

## 🧪 Test Cases

### Test 1: Real User with Valid Session
1. Sign in with your email on the app
2. Verify phone (for Apple Pay) or just connect wallet
3. Try to create an order
4. **Expected**: Full token chain shown above ✅

### Test 2: Unauthenticated User
1. Sign out from the app
2. Try to create an order (shouldn't be possible in UI, but if you force it)
3. **Expected**:
   - Frontend: `🔐 [AUTH] Retrieved access token: NO TOKEN`
   - Backend: `❌ [MIDDLEWARE] Missing or invalid Authorization header`
   - Response: 401 Unauthorized

### Test 3: TestFlight Test Account
1. Sign in with `reviewer@coinbase-demo.app`
2. Try to create an order
3. **Expected**:
   - Frontend: Should retrieve token (if CDP is mocked properly)
   - Backend: Token validation might fail (test accounts don't have real CDP tokens)
   - **See BACKEND_AUTH.md** for test account handling options

---

## 🐛 Troubleshooting

### Problem: No token retrieved on frontend
**Symptoms**: `🔐 [AUTH] Retrieved access token: NO TOKEN`

**Causes**:
- User not signed in with CDP
- CDP session expired
- `useGetAccessToken()` hook failed

**Fix**:
- Check if `useCurrentUser()` returns a user
- Try signing out and back in
- Check CDP console for errors

---

### Problem: Token not reaching backend
**Symptoms**: Frontend shows token, but backend sees `MISSING` header

**Causes**:
- Headers not being sent in fetch request
- Network proxy stripping headers
- CORS preflight issue

**Fix**:
- Check `createApplePayOrder.ts` and `createOnrampSession.ts` are using the `headers` variable (not hardcoded)
- Check BASE_URL is correct
- Try logging the full fetch request: `console.log('Full request:', { method, headers, body })`

---

### Problem: Token validation fails (401)
**Symptoms**: `❌ Token validation failed: 401`

**Causes**:
- Token is expired (CDP tokens have limited lifetime)
- Token is invalid (corrupted, wrong format)
- CDP API is down
- Wrong CDP API endpoint

**Fix**:
- Try signing out and back in (gets fresh token)
- Check token format (should be JWT: `eyJ...`)
- Verify CDP API endpoint: `https://api.cdp.coinbase.com/platform/v2/end-users/auth/validate-token`
- Check CDP API status page

---

### Problem: Test account has no token
**Symptoms**: Test accounts don't work with authentication

**Cause**: Test accounts bypass CDP, so they don't have real CDP tokens

**Fix**: See `BACKEND_AUTH.md` "Test Account Handling" section for 3 options:
1. Allow unauthenticated requests in dev (not recommended)
2. Generate mock tokens for test accounts
3. Skip backend for test accounts (use sandbox API directly)

---

## ✅ Success Criteria

Authentication is working correctly when you see:

1. ✅ Frontend retrieves token (not "NO TOKEN")
2. ✅ Frontend sends token in Authorization header
3. ✅ Backend middleware receives token
4. ✅ Token validates successfully (cached or CDP API)
5. ✅ Request proceeds to route handler
6. ✅ Order/session created successfully

---

## 📊 Quick Debug Checklist

```bash
# Frontend (Expo console)
[ ] Token retrieved from CDP?
[ ] Token sent to API function?
[ ] Authorization header added?

# Backend (Server console)
[ ] Middleware called?
[ ] Authorization header received?
[ ] Token extracted?
[ ] Token validation passed?
[ ] Route handler executed?

# Response
[ ] Success response (200)?
[ ] Order/session created?
```

---

## 🚀 When Ready to Deploy

Once local testing passes:

1. Push code to GitHub
2. Vercel will auto-deploy
3. Update `BASE_URL` in your app to point to Vercel URL
4. Test again with production URL
5. Monitor Vercel logs for authentication flow

**Vercel Logs**: https://vercel.com/your-project/logs
