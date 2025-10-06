# Coinbase Onramp V2 Demo App

React Native + Expo Router demo showcasing Coinbase's Onramp v2 API with embedded wallets.

See the [CDP React Native Quickstart](https://docs.cdp.coinbase.com/embedded-wallets/react-native/quickstart) and [Onramp Quickstart](https://docs.cdp.coinbase.com/onramp-&-offramp/introduction/quickstart) for more details.

## 🏗️ Architecture Overview
### Main User Flow
1. Wallet Creation: email-verify → email-code → CDP creates      
2. Crypto Purchase (Apple Pay): OnrampForm → Apple Pay → (phone?) → Creates order 
3. Crypto Purchase (Coinbase Widget): OnrampForm → Coinbase Widget → Creates order  

### Key Directories
```
/app/                 # Expo Router pages (file-based routing) 
  ├─ (tabs)/          # Main app with bottom tabs              
  │   ├─ index.tsx    # Home: Onramp form + purchase           
  │   ├─ profile.tsx  # Settings: wallet, phone, region        
  │   └─ history.tsx  # Transaction list                       
  ├─ _layout.tsx      # Root: CDP provider + hydrate phone     
  ├─ email-*.tsx      # Email verification flow (CDP)          
  └─ phone-*.tsx      # Phone verification flow (Twilio)       
                                                                
/components/          # Reusable UI components                 
  ├─ onramp/          # Onramp-specific components              
  │   ├─ OnrampForm.tsx        # Main form UI                  
  │   └─ ApplePayWidget.tsx    # Hidden WebView for Apple Pay  
  └─ ui/              # Generic UI components                   
                                                                
/hooks/               # Custom React hooks                     
  └─ useOnramp.ts     # Central onramp state & API calls        
                                                                
/utils/               # Helper functions & API calls           
  ├─ sharedState.ts   # Global state (addresses, phone, etc.)  
  ├─ create*.ts       # Onramp V2 API endpoints to fetch quote and onramp URL for order                  
  └─ fetch*.ts        # Onramp V1 API endpoints to fetch Onramp config and options               
                                                                
/server/              # Node.js proxy (API key security)       
  └─ index.js         # Forwards requests to Coinbase with keys
                                                                
/index.ts             # Crypto setup entry point 
```

## 🚀 Getting Started

### Prerequisites
- Node.js v20+
- iOS Simulator or TestFlight (Android not tested)
- Coinbase CDP API keys
- (Optional) Twilio account for phone verification

### Environment Setup

#### Create `.env`
1. Copy `.env` file
```bash
cp .env.example .env
```
2. Fetch your Project ID from [CDP Portal](https://portal.cdp.coinbase.com/) and update `EXPO_PUBLIC_CDP_PROJECT_ID` in `.env`.
```bash
EXPO_PUBLIC_CDP_PROJECT_ID=your_cdp_project_id
```
3. Update `EXPO_PUBLIC_BASE_URL`. If using device to test, run on local Terminal `ipconfig getifaddr en0` to get IP address. If running on iOS Simulator, use `localhost`.
```bash
EXPO_PUBLIC_BASE_URL=http://<localhost>:3000
```
4. Use `true` if running on Expo Go, and `false` for TestFlight
```bash
EXPO_PUBLIC_USE_EXPO_CRYPTO=false 
```

#### Create `/server/.env`
1. Copy `/server/.env` file
```bash
cp /server/.env.example /server/.env
```
2. See [API Authentication](https://docs.cdp.coinbase.com/api-reference/v2/authentication#secret-api-key) to get your Secret API Key
```bash
CDP_API_KEY_NAME=your_api_key_name
CDP_API_KEY_PRIVATE_KEY=your_private_key
```
3. (Optional) Use the [Twilio Verify API](https://www.twilio.com/docs/verify/api) service for phone authentication
```bash
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_VERIFY_SERVICE_SID=your_verify_service_sid
```

### Installation & Running

```bash
# Install dependencies
npm install && cd server && npm install && cd ..

# Start backend proxy (for Onramp API calls)
cd server && npm run dev &

# Expo Go (limited Wallet features)
npx expo start

```

## User Sequence Flow
 ![Architecture](https://www.plantuml.com/plantuml/proxy?src=https://github.com/mlion-cb/onramp-v2-mobile-demo/main/assets/docs/architecture.puml)


## 🔐 Security Architecture

### API Key Protection
- **Never** expose CDP API keys in client code
- All Coinbase API calls proxy through `/server/index.js`
- Server adds authentication headers before forwarding

### Sandbox vs Production
- Sandbox: Mock data, optional verification
- Production: Real transactions, strict validation

## 📱 Two Build Modes

### Expo Go (Development)
- Uses `expo-crypto` (JavaScript polyfill)
- **Limitations:**
  - No wallet export (crypto.subtle missing)
  - Can't create new wallets (only use verified emails)

### TestFlight (Production)
- Uses `react-native-quick-crypto` (native C++)
- **Full Features:**
  - Wallet export enabled
  - New wallet creation

## 📚 API Documentation
- [CDP Onramp v2 API](https://docs.cdp.coinbase.com/onramp/docs/)
- [CDP Hooks React](https://docs.cdp.coinbase.com/cdp-hooks/docs/)

