# TestFlight Test Account Setup

This document explains the mock authentication flow for Apple TestFlight reviewers.

## 🎯 Overview

TestFlight reviewers can use fixed credentials to test the app without needing real email/phone verification. This creates a **completely separate mock flow** that bypasses CDP authentication entirely.

## 🔐 Test Credentials

All test credentials are defined in `/constants/TestAccounts.ts`:

```typescript
Email: reviewer@coinbase-demo.app
Email OTP: 123456
Phone: +15555555555
SMS Code: 654321

Mock Wallets:
- EVM: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
- Solana: DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK

Mock Seed Phrase (for export):
"test flight review demo wallet please approve thank you coinbase reviewer mock seed phrase"
```

## 🔄 How It Works

### 1. Email Verification (`app/email-code.tsx`)

When `reviewer@coinbase-demo.app` enters OTP `123456`:
- ✅ Skips CDP `verifyEmailOTP()`
- ✅ Creates mock session in AsyncStorage
- ✅ Sets mock wallet addresses in sharedState
- ✅ Enables sandbox mode automatically
- ✅ Navigates to home screen

**Result**: No real CDP account created. All wallet data is mocked.

### 2. Phone Verification (`app/phone-code.tsx`)

When `+15555555555` enters code `654321`:
- ✅ Skips Twilio verification
- ✅ Stores phone with 60-day expiry (same as real flow)
- ✅ Navigates back

### 3. Profile Display (`app/(tabs)/profile.tsx`)

Profile screen detects test session and:
- Shows `reviewer@coinbase-demo.app` as email (with TestFlight label)
- Shows mock EVM and Solana addresses
- "Connected" button appears (same as real account)
- Export button works (returns mock seed phrase)
- Sign out clears test session

### 4. Export Functionality

When test account clicks "Export private key":
- Returns mock seed phrase from `TEST_ACCOUNTS.seedPhrase`
- Copies to clipboard
- Shows alert: "Mock Seed Phrase Copied (TestFlight)"

### 5. Session Persistence

Test session persists in AsyncStorage until:
- User clicks "Sign out" (clears test session)
- User clicks "Unlink Phone" (clears phone only)
- App is uninstalled

## 🛡️ Safety Features

1. **Forced Sandbox Mode**: Test account automatically enables sandbox mode
2. **No Real CDP Calls**: Test flow completely bypasses CDP SDK
3. **No Real Transactions**: Onramp API calls use sandbox mode (mock transactions only)
4. **Clear Labeling**: Profile shows "(TestFlight)" label next to email

## 📱 Testing Instructions for Reviewers

Add this to your TestFlight notes:

```
TESTFLIGHT REVIEWER INSTRUCTIONS:

1. Sign In:
   - Email: reviewer@coinbase-demo.app
   - OTP: 123456

2. Phone Verification (for Apple Pay):
   - Phone: +15555555555
   - SMS Code: 654321

3. Test Features:
   - View wallet addresses (mock data)
   - Export seed phrase (mock phrase)
   - Test onramp flow (sandbox mode)
   - All features work without real verification

4. Sign Out:
   - Use "Sign out" button to clear session

Note: This is a mock flow for testing only. No real wallet is created.
Sandbox mode is enabled automatically to prevent real transactions.
```

## 🔧 Implementation Details

### Files Modified:

1. `/constants/TestAccounts.ts` - Test credentials
2. `/utils/sharedState.ts` - Test session storage
3. `/app/email-code.tsx` - Email verification bypass
4. `/app/phone-code.tsx` - Phone verification bypass
5. `/app/(tabs)/profile.tsx` - Mock data display & export
6. `/app/_layout.tsx` - Session hydration on startup

### Session Storage:

Test session is stored in AsyncStorage with key `@onramp_test_session`:

```json
{
  "active": true,
  "evm": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "sol": "DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK"
}
```

### CDP Hooks Overrides:

When test session is active, these CDP hooks return mock data:
- `useIsSignedIn()` → overridden to return `true`
- `useEvmAddress()` → overridden to return mock EVM address
- `useSolanaAddress()` → overridden to return mock Solana address
- `useCurrentUser()` → email field overridden to show test email

## ✅ Test Checklist

- [ ] Email verification with test account works
- [ ] Phone verification with test phone works
- [ ] Profile shows mock wallet addresses
- [ ] Export returns mock seed phrase
- [ ] Onramp form shows connected wallet
- [ ] Sign out clears test session
- [ ] Session persists after app restart
- [ ] Sandbox mode is enforced

## 🚨 Important Notes

1. **NO REAL CDP ACCOUNT**: Test account does NOT create a real CDP wallet
2. **NO REAL TRANSACTIONS**: All onramp flows use sandbox mode
3. **TESTFLIGHT ONLY**: This flow is for Apple reviewers, not production users
4. **AUTO SANDBOX**: Test account automatically enables sandbox mode for safety

## 🐛 Troubleshooting

**Test session not persisting?**
- Check AsyncStorage is working
- Look for `🧪` emoji logs in console

**Profile not showing test account?**
- Check `isTestSessionActive()` returns true
- Verify `hydrateTestSession()` ran on startup

**Export not working?**
- Verify `TEST_ACCOUNTS.seedPhrase` is defined
- Check clipboard permissions

## 📝 Summary

This mock flow allows TestFlight reviewers to test all app features without:
- Real email verification (no email sent)
- Real phone verification (no SMS sent)
- Real CDP account creation (no blockchain interaction)
- Real transactions (sandbox mode enforced)

The test account behaves identically to a real account from the user's perspective, but all data is mocked for safety and convenience.
