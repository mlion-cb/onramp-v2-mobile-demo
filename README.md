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

![Architecture]([https://www.plantuml.com/plantuml/proxy?cache=no&src=https://raw.githubusercontent.com/mlion-cb/onramp-v2-demo/main/assets/docs/architecture.puml](https://www.plantuml.com/plantuml/png/jLTjRzkm4VwUNt4rXjL6Oxj9NxQvwD34SLetB_4Yfq410oujNMmk4gcIL5olo7_VKJHbHLMofEZyYU8zT_VmNiZp1ssOCbaIRpqp2qmGqfXniGLWk8aH-fAB6TC8PqAn98Klkt20YOIzD8KsIHN2OIoNUeiqM6YaWWkDodxDv0ze4An1Q_jBoGqFUSg4WSOv4XXEcU4tE14M1KnRemH64LdbmaR_O5HhW_RXaiKn6WWEZd83j5M7t73V6mrpeDkXhmVWXuE9Q5xYx0l7PQkaTJYe8RdFmclQgoKQeBf1bLjmoxlwxz_d8OIT7WmIncCubdCkuA_-S7s552Sf24ZmFBxG_gSD5Ya8GrzerKX4MrP2KUY1vdCn59VSB7AZpPyE1RSj0X82sjx6JxWYzyC8Rgrv8Gs2ulE50NbbWPwLHc70ICZ8_pqythOZFkS6GXbXXGwTcb-jSajdur7J-zm6QLBBoP7oS7TcX6KU0GqiCp9X557wNar46pwYG6KHWoydy0826JF1u1fNcgHUMwFMN8gj2XKwG3zJ2eMnHsXMu-4E5Z73IefshmS7N5DthDQqW4MHGarUobdSxS5-jY8AgzH8M5ByhOqOOKIADHayv74CLr8b4v6oLKAizXAP2TE3l-oyUKcRcGeNp5CELyGlEEXFH8JQS94NnYcQfLJNv9XmXPaJD0iPzJRUIyTnPTY3qLamXgxElxeivHFHlTdjohpCkr95g2YUFs4YW7wTJiSjkFvN9WtsmAWCINZhUf_VC8DhqzQNMvNT5LdxV3a68wbXoh1DKtfYLIv0y084xPBbd10erAaK6alUVLOTmgKL8C8QlhMf_fwhwIn9c5hzahnWoLEqJH5ASSLLOW4iDZ1QI86sbLpTSuoWkQa2AU9LorqKzGcXSbzqTQAx-TriCv1QWprelDXvK_mQSEkCr4HwlEGnbq1Xga0sJK-sJQR9PeeYuc9kpJbmNMi79u5hwyVGTirUyDxEDVyGMvQcIjvWv4vFr7-lh87OkMekDPAxSCd9onyxkwzUKy4tjXr8Isf3z9tPeCxq4gOrcc2Lp6HC0jkRNW8mYsLuJTtB1OdiA-f5ULXEisI6gfhKGhdInesF5uDWFEr_6lIFpYx6qxtHw7Wm7UrzzHfXp0a-J0bAv3klttJU_gtpztyqdj2VvwXbV8DhKp0SFRQBdzR6ztRncHL3cD_UKP6WNAa7xij_3oDtpjV--ANxwTPj-GWUSt5TKi-KJTJ2c5Jtkbt2TCBrZ4EBf5ialM9Xl4gHz2ZW9uFJyVHuU7eq7NyT3JQ9cEvVZCTdfuqr2HlthPfIzaQdH0Hk7xwCYecZ1yUIHNTKkO3rS59EhrSW6yNwhg5p51I_qgCqouoHegBWoAPIKm5gpURORBWSJgcVEZ6HcUei34dMQDNo7Of_OsZWCxjXGQXuQgW9k_29HxXsk6uiiugnO_27wKjXRDMzXsy-_CnoRDEXsqvbaqI0o5tGFH1Iu3k_V-iMtsWZzxUN6TccSWwlrqqYXJOmCuBSH3BCR3GxSpI36EroVpMCcjxMSpffsnswNMNot85QQyVy2ffaj6KjTt9tpTQx-rCmLdm-lvC3lK0qLc6kP9R29oQY62CG-O0SKuvMmCy2QCEfX0XfIwQapuN1kNB3eSBl6LSORPKky99B2iH2AluVz3LadTNmStqRPBE46m_rI2UjjhYIjWeAR1LyXyN8WM1TEbTPxExm9nKVTIcHAvLVvUaE5d893UygA5mzQpp9JIhZc8lvD7-3x_CoLZJt4mgCOaBRBfI2RX3lgJPY0HqOGZSV6bbw97wBNZaC4TRS0xMy-p99OpH8CN5oxwuVIut-OYdFjQz-dMkB_uQNFA8UUd2wVSGh_TX7P3tMt_-C10u0BzpGz-0m-0S7lwSC8VuCxf7x_yqWjHD8pNH15R5tVc1dXRfHeRhrXuVxHoUqEXci5KkFkxDuyR-VU3fftUFi3JpYQSuLZhcmxT-HAOgBy-FcCky4-pwtoZNZIiit7VZ_T1CXnQQBKchnwX_mNBCybNCD2YEkC3GOWP5ELXXvhc4XDOcSjRNKFIV57GqQOyolgkqruEXhVni8LBx6tCsSqzdwGAiiYVyB))

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

