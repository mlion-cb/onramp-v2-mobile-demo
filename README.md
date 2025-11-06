# Coinbase Onramp V2 Demo App

A React Native + Expo mobile app demonstrating Coinbase's Onramp v2 API with CDP Embedded Wallets, Apple Pay integration, and real-time push notifications.

![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)

## Features

- 🔐 **Embedded Wallet**: Automatic wallet creation via CDP
- 💳 **Multiple Payment Methods**: Apple Pay and Coinbase Widget
- 🌐 **Multi-Network**: Base, Ethereum, Solana support
- 🔔 **Push Notifications**: Real-time transaction updates
- 💸 **Gasless Transfers**: Paymaster support on Base (USDC, EURC, cbBTC)
- 📜 **Transaction History**: Complete purchase tracking
- 🧪 **Sandbox Mode**: Test without real transactions

## Tech Stack

- React Native + Expo Router
- TypeScript
- Onramp V2 Apple Pay integration
- CDP React Native SDK
- Node.js/Express backend
- Expo Notifications

## Quick Start

### Prerequisites

- Node.js v20+
- iOS device or simulator
- [Coinbase CDP account](https://portal.cdp.coinbase.com/)
- (Optional) Twilio account - for phone verification (Apple Pay only)
- (Optional) [ngrok account](https://ngrok.com/) (free tier works) - for Webhook

### 1. Installation

```bash
# Clone and install dependencies
git clone <your-repo-url>
cd onramp-v2-new
npm install
cd server && npm install && cd ..
```

### 2. Get Your CDP Credentials

1. Go to [CDP Portal](https://portal.cdp.coinbase.com/)
2. Create a new project (or use existing)
3. Copy your **Project ID**
4. Generate **API Keys** (you'll need the key name and private key in `Ed25519`)

### 3. Environment Setup

#### Root `.env`

```bash
# Copy template
cp .env.example .env
```

Edit `.env`:
```bash
# CDP Project ID from portal
EXPO_PUBLIC_CDP_PROJECT_ID=your_project_id_here

# Local server (will update with ngrok URL in step 5)
EXPO_PUBLIC_BASE_URL=http://localhost:3000

# Crypto implementation selector
# - Set to 'true' for Expo Go (npx expo start)
# - Set to 'false' for development builds (npx expo run:ios)
EXPO_PUBLIC_USE_EXPO_CRYPTO=true
```

#### Server `.env`

```bash
# Copy template
cp server/.env.example server/.env
```

Edit `server/.env`:
```bash
# CDP API Credentials from portal
CDP_API_KEY_NAME=your_api_key_name
CDP_API_KEY_PRIVATE_KEY=your_private_key_here
```

### 4. Start Development Servers

Open **two terminal windows**:

```bash
# Terminal 1: Start backend server
cd server
npm run dev
# Should see: "Server running on http://localhost:3000"
```

```bash
# Terminal 2: Start Expo

# Option A: Expo Go (requires USE_EXPO_CRYPTO=true in .env)
npx expo start
# Scan QR code with Expo Go app or press 'i' for iOS simulator

# Option B: Development build (set USE_EXPO_CRYPTO=false in .env)
npx expo run:ios
# Builds and installs native iOS app with full crypto support
```

### 5. Setup Webhooks with ngrok (Optional)

**Note**: This step is **optional**. Webhooks enable push notifications for transaction updates. Without ngrok, the app works fully but you won't receive push notifications.

**⚠️ iOS Simulator Limitation**: Push notifications do **not** work on iOS Simulator due to Apple's restrictions. To test push notifications, use a physical iOS device.

If you want push notifications, open a **third terminal**:

```bash
# Install ngrok globally (if not already installed)
npm install -g ngrok

# Start ngrok tunnel
ngrok http 3000
```

You'll see output like:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:3000
```

**Copy the ngrok URL** (e.g., `https://abc123.ngrok.io`) and update `.env`:

```bash
# Update this line in root .env
EXPO_PUBLIC_BASE_URL=https://abc123.ngrok.io
```

**Create webhook subscription**:

Follow the instructions to [create a webhook subscription](https://docs.cdp.coinbase.com/onramp-&-offramp/webhooks#create-a-webhook-subscription) using your ngrok URL (e.g., `https://abc123.ngrok.io/server/webhook`).

**Restart Expo** (press `r` in Terminal 2)

> **Note**: Free ngrok URLs change every time you restart. Update `.env` and re-create webhook subscription each time and restart Expo. See [webhook documentation](https://docs.cdp.coinbase.com/onramp-&-offramp/webhooks) for details.
>
> **Alternative (without ngrok)**: The app will work but webhooks/push notifications won't function (Coinbase servers can't reach localhost).
> - **Testing on Simulator**: Keep `EXPO_PUBLIC_BASE_URL=http://localhost:3000`
> - **Testing on Physical Device**: Use your local network IP:
>   ```bash
>   # Get your local IP address
>   ipconfig getifaddr en0
>   # Update .env with: EXPO_PUBLIC_BASE_URL=http://YOUR_LOCAL_IP:3000
>   # Example: EXPO_PUBLIC_BASE_URL=http://192.168.1.100:3000
>   ```

### 6. Run the App

1. Open **Expo Go** app on your iOS device or iOS Simulator
2. Scan the QR code from Terminal 2
3. App will load on your device or simulator

**Push notifications work automatically** via Expo Push Service - no additional setup needed!

## Using the App

### First Time Setup

1. **Sign In**: Enter your email → Verify code
2. **Wallet Created**: Embedded wallet auto-created
3. **Complete Profile**:
   - Verify phone (optional for testing)
   - Select region
   - Select Sandbox / Production mode for Onramp transaction

### Making a Purchase

1. **Home Tab**: Fill out onramp form
   - Select network (Base, Ethereum, Solana)
   - Select asset (USDC, ETH, SOL, etc.)
   - Enter amount
2. **Choose Payment**:
   - **Apple Pay**: Native iOS payment
   - **Coinbase Widget**: Opens widget on default browser
3. **Complete Purchase**
4. **Receive Notification**: Transaction status notification on Production

### Sandbox Mode

Test without real transactions:

1. Go to **Profile Tab**
2. Toggle **Sandbox Mode** ON
3. Features enabled:
   - Optional phone verification
   - Any wallet address override accepted
   - No real blockchain transactions
   - Email verification still required for server authentication

> **Note**: Sandbox mode auto-resets on app restart for safety.

## Project Structure

```
/app/                 # Expo Router pages
  ├─ (tabs)/          # Bottom tab navigation
  │   ├─ index.tsx    # Home: Onramp form
  │   ├─ profile.tsx  # Settings & wallet
  │   └─ history.tsx  # Transaction history
  ├─ auth/            # Email/phone verification
  └─ transfer.tsx     # Token transfer

/components/          # React components
  ├─ onramp/          # Onramp-specific UI
  └─ ui/              # Reusable UI components

/hooks/               # Custom hooks
  └─ useOnramp.ts     # Onramp logic & API calls

/utils/               # Helper functions
  ├─ sharedState.ts   # Global state
  ├─ create*.ts       # Onramp v2 API
  └─ fetch*.ts        # Onramp v1 API

/server/              # Backend proxy
  └─ src/app.ts       # Express server
```

## Key Concepts

### Smart Account vs EOA

The app creates two wallet types:
- **EOA**: Standard wallet (externally owned account)
- **Smart Account**: ERC-4337 account abstraction

**Important**: The app displays **Smart Account balances** only. All EVM onramp funds automatically go to the Smart Account.

### Backend Proxy Pattern

For security, API keys are **never exposed** to the client:

```
Client App → Backend Proxy → Coinbase API
              (has API keys)
```

This prevents API key theft if someone inspects your app.

### Gasless Transfers

On Base network, transfers of USDC, EURC, or BTC are **gasless** (no ETH needed for gas) thanks to Coinbase Paymaster.

## Troubleshooting

### "Wallet not creating"
- Verify `EXPO_PUBLIC_CDP_PROJECT_ID` is correct
- Check CDP Portal for project status
- Ensure you're using email address that hasn't been used before

### "Push notifications not working"
- **iOS Simulator**: Push notifications do not work on iOS Simulator. Use a physical device.
- Should work automatically in Expo Go on physical devices
- Verify ngrok tunnel is running
- Check `.env` has correct ngrok URL
- Restart Expo after updating `.env`

### "Transaction failing"
- Enable **Sandbox Mode** for testing
- Verify phone verification is complete (for Apple Pay)
- Check backend logs: `cd server && npm run dev`

## Development Tips

### Testing Without Real Money

1. Enable **Sandbox Mode** in Profile tab
2. All transactions will be simulated
3. No real blockchain interaction

### Viewing Backend Logs

```bash
cd server
npm run dev
# Watch console for API requests/responses
```

### Debugging Push Notifications

Check Expo logs:
```bash
# In Expo terminal (Terminal 2)
# Look for lines with [PUSH] prefix
```

### Resetting App State

1. Sign out from Profile tab
2. Force close app
3. Relaunch

## Environment Variables

### Required (Root `.env`)

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_CDP_PROJECT_ID` | Your CDP project ID |
| `EXPO_PUBLIC_BASE_URL` | Backend URL (ngrok URL or localhost) |
| `EXPO_PUBLIC_USE_EXPO_CRYPTO` | `true` for Expo Go (`npx expo start`), `false` for dev builds (`npx expo run:ios`) |

### Required (Server `.env`)

| Variable | Description |
|----------|-------------|
| `CDP_API_KEY_NAME` | CDP API key name |
| `CDP_API_KEY_PRIVATE_KEY` | CDP private key |

## Documentation

- [CDP Documentation](https://docs.cdp.coinbase.com/)
- [Onramp API](https://docs.cdp.coinbase.com/onramp-&-offramp/introduction/quickstart)
- [CDP React Native SDK](https://docs.cdp.coinbase.com/embedded-wallets/react-native/quickstart)
- [Expo Documentation](https://docs.expo.dev/)

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
