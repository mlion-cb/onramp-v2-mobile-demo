# Onramp v2 - Architecture & Flow Documentation

## Overview
A React Native/Expo mobile application that enables users to purchase cryptocurrency using Coinbase's embedded wallet and onramp services. The app supports both production and sandbox modes with comprehensive authentication flows.

## System Architecture

```mermaid
graph TB
    subgraph "Mobile App (React Native/Expo)"
        A[App Entry] --> B[Authentication Flow]
        B --> C[Profile Management]
        C --> D[Onramp Purchase Flow]
        D --> E[Wallet Operations]
    end

    subgraph "Backend Services"
        F[Express Server] --> G[IP Resolution Service]
        F --> H[Twilio SMS Service]
        F --> I[Coinbase API Proxy]
    end

    subgraph "External Services"
        J[Coinbase CDP Platform]
        K[Coinbase Onramp API]
        L[Twilio Verify API]
        M[IP Geolocation Services]
    end

    A --> F
    F --> J
    F --> K
    H --> L
    G --> M
    I --> J
    I --> K
```

## User Flow Sequence Diagram

```mermaid
sequenceDiagram
    participant U as User
    participant App as Mobile App
    participant Server as Express Server
    participant CDP as Coinbase CDP
    participant Onramp as Coinbase Onramp
    participant Twilio as Twilio SMS

    Note over U,Twilio: 1. Initial Setup & Authentication

    U->>App: Open app
    App->>App: Check initialization state

    Note over U,Twilio: 2. Email Authentication (New Users)

    U->>App: Enter email for wallet creation
    App->>CDP: Request email OTP
    CDP->>U: Send verification email
    U->>App: Enter OTP code
    App->>CDP: Verify OTP
    CDP->>CDP: Create embedded wallet (EOA + Smart Account)
    CDP-->>App: Authentication success + wallet created

    Note over U,Twilio: 3. Phone Verification (Required for Apple Pay)

    U->>App: Enter phone number
    App->>Server: POST /auth/sms/start
    Server->>Twilio: Start SMS verification
    Twilio->>U: Send SMS code
    U->>App: Enter SMS code
    App->>Server: POST /auth/sms/verify
    Server->>Twilio: Verify code
    Twilio-->>Server: Verification result
    Server-->>App: Phone verified

    Note over U,Twilio: 4. Purchase Flow

    U->>App: Select amount & initiate purchase
    App->>Server: POST /server/api (onramp request)
    Server->>Server: Resolve client IP (IPv4/IPv6)
    Server->>Server: Generate JWT for Coinbase API
    Server->>Onramp: Request session token + client IP
    Onramp-->>Server: Session token
    Server->>Onramp: Generate onramp URL
    Onramp-->>Server: Payment URL
    Server-->>App: Payment URL + session token
    App->>App: Open Coinbase payment widget
    U->>Onramp: Complete payment (Apple Pay/Card)
    Onramp-->>App: Payment completion

    Note over U,Twilio: 5. Wallet Operations

    U->>App: Request private key export
    App->>CDP: Export EOA account
    CDP-->>App: Private key
    App->>App: Copy to clipboard

    U->>App: Sign out
    App->>CDP: Sign out user
    App->>App: Clear local state
```

## Component Architecture

### Frontend (Mobile App)
```
app/
├── _layout.tsx              # Root provider with CDP configuration
├── (tabs)/
│   ├── index.tsx           # Home screen with onramp integration
│   └── profile.tsx         # Wallet management & user settings
├── email-verify.tsx        # Email authentication flow
├── email-code.tsx          # Email OTP verification
├── phone-verify.tsx        # Phone number verification
└── phone-code.tsx          # SMS OTP verification
```

### Backend (Express Server)
```
server/src/
├── app.ts                  # Main server with proxy endpoints
├── ip.ts                   # IP resolution service (IPv4/IPv6)
└── index.ts               # Server entry point
```

## Key Technical Features

### 1. Dual Wallet Architecture
- **EOA (Externally Owned Account)**: For private key export
- **Smart Account**: Primary wallet for transactions

### 2. Environment Support
- **Production Mode**: Real transactions, full verification required
- **Sandbox Mode**: Test transactions, optional verification

### 3. Cross-Platform Compatibility
- **Expo Go**: Development with polyfills
- **TestFlight/Production**: Native crypto libraries

### 4. Authentication Methods
- **Email OTP**: Primary authentication via Coinbase CDP
- **SMS Verification**: Required for Apple Pay integration

## Data Flow

### 1. Wallet Creation
```
Email → OTP Verification → CDP Account Creation → Wallet Generation (EOA + Smart)
```

### 2. Purchase Flow
```
Amount Selection → Phone Verification → IP Resolution → Session Token → Onramp Widget → Payment
```

### 3. Export Flow
```
User Request → Confirmation Modal → EOA Export → Clipboard Copy → Security Warning
```

## Security Considerations

### 1. Session Token Management
- Single-use tokens to prevent reuse
- Server-side IP injection
- No token exposure in URLs

### 2. Private Key Handling
- Export only EOA accounts
- Immediate clipboard copy
- Clear security warnings

### 3. IP Resolution
- IPv6 support for backend compatibility
- Private IP detection and public IP fallback
- Caching to reduce external calls

## Configuration

### Environment Variables
```bash
# CDP Configuration
EXPO_PUBLIC_CDP_PROJECT_ID=your_project_id
CDP_API_KEY_ID=your_api_key
CDP_API_KEY_SECRET=your_secret

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_VERIFY_SERVICE_SID=your_service_sid

# Build Configuration
EXPO_PUBLIC_USE_EXPO_CRYPTO=true  # For Expo Go
```

### Metro Configuration
- Custom resolvers for CDP packages
- Node.js polyfills for React Native
- Package export field compatibility

## Testing Flows

### 1. New User Flow
1. Open app → Connect wallet
2. Enter email → Verify OTP → Wallet created
3. Verify phone → Enter SMS code
4. Select amount → Complete purchase

### 2. Export Flow
1. Ensure wallet is connected
2. Tap "Export private key" → Confirm
3. Private key copied to clipboard

### 3. Sandbox Testing
1. Enable sandbox mode
2. Enter test wallet address
3. Test onramp flow without real transactions

## Dependencies

### Core Libraries
- `@coinbase/cdp-hooks`: Wallet and authentication
- `@coinbase/cbpay-js`: Onramp URL generation
- `expo-router`: Navigation
- `twilio`: SMS verification

### Polyfills (React Native)
- `react-native-quick-crypto`: Crypto operations
- `@craftzdog/react-native-buffer`: Buffer polyfill
- Various Node.js polyfills for web3 compatibility

This architecture provides a secure, scalable foundation for cryptocurrency onramp functionality with comprehensive user authentication and wallet management.