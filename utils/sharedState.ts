/**
 * ============================================================================
 * SHARED STATE MANAGEMENT - LIGHTWEIGHT GLOBAL STATE
 * ============================================================================
 *
 * PURPOSE:
 * Alternative to React Context for cross-tab/cross-screen state sharing.
 * Used for demo purposes - production apps should use Redux/Zustand/React Query.
 *
 * STATE CATEGORIES:
 *
 * 1. WALLET ADDRESSES (currentWalletAddress, currentSolanaAddress, manualWalletAddress)
 *    - EVM address: Smart Account or EOA from CDP
 *    - Solana address: Solana account from CDP
 *    - Manual address: Testing-only input for sandbox mode
 *    - getCurrentWalletAddress(): Network-aware resolution (see below)
 *
 * 2. NETWORK TRACKING (currentNetwork)
 *    - Tracks selected blockchain network (Base, Ethereum, Solana, etc.)
 *    - Updated by OnrampForm when user changes network dropdown
 *    - Used for address resolution logic
 *
 * 3. PHONE VERIFICATION (verifiedPhone, verifiedPhoneAt)
 *    - Stored in AsyncStorage (persists across app restarts)
 *    - Required for Apple Pay transactions
 *    - 60-day expiry (PHONE_TTL_MS constant)
 *    - hydrateVerifiedPhone(): Called in _layout.tsx on app start
 *
 * 4. REGION (currentCountry, currentSubdivision)
 *    - Determines available payment methods and currencies
 *    - US requires subdivision (state) for compliance
 *    - Triggers OnrampForm remount on change (key prop)
 *
 * 5. SANDBOX MODE (sandboxMode)
 *    - Defaults to ON for safety (prevents accidental real transactions)
 *    - Resets to default ON every app restart
 *    - Test mode: uses mock data, optional verification
 *    - Production mode: real transactions, strict validation
 *
 * 6. TRANSACTION TRACKING (currentPartnerUserRef, pendingTransactionForm)
 *    - partnerUserRef: Unique identifier for transaction history lookup
 *    - pendingForm: Stores form data when user needs phone verification
 *
 * ============================================================================
 * WALLET ADDRESS PRIORITY SYSTEM - NETWORK-AWARE ROUTING
 * ============================================================================
 *
 * getCurrentWalletAddress() returns different addresses based on:
 * - Current network (EVM vs Solana vs Unsupported)
 * - Sandbox vs Production mode
 * - Available wallet types
 *
 * SANDBOX MODE (testing with flexibility):
 * ┌─────────────────┬──────────────────────────────────────┐
 * │ Network Type    │ Address Priority                     │
 * ├─────────────────┼──────────────────────────────────────┤
 * │ Solana/SOL      │ manual > SOL wallet > null           │
 * │ EVM (eth, base) │ manual > EVM wallet > null           │
 * │ Other (bitcoin) │ manual > EVM wallet > null           │
 * └─────────────────┴──────────────────────────────────────┘
 *
 * PRODUCTION MODE (strict network-wallet matching):
 * ┌─────────────────┬──────────────────────────────────────┐
 * │ Network Type    │ Address Priority                     │
 * ├─────────────────┼──────────────────────────────────────┤
 * │ SOL             │ SOL wallet ONLY > null               │
 * │ EVM (eth, base) │ EVM wallet ONLY > null               │
 * │ Other (bitcoin) │ NULL (unsupported)                   │
 * └─────────────────┴──────────────────────────────────────┘
 *
 * EXAMPLES:
 * - User has EVM + SOL wallets, selects "Solana" → returns SOL address
 * - User has EVM wallet only, selects "Base" → returns EVM address
 * - User has EVM wallet only, selects "Bitcoin" (prod) → returns null (shows error card)
 * - User in sandbox with manual address, selects any network → returns manual address
 *
 * WHY THIS DESIGN?
 * - Sandbox: Flexibility for testing any network with demo addresses
 * - Production: Safety - prevent sending crypto to wrong address type
 * - Network-aware: Same user can have multiple wallets for different chains
 *
 * @see components/onramp/OnrampForm.tsx for network change handling
 * @see app/(tabs)/index.tsx for address updates on network changes
 * @see app/(tabs)/profile.tsx for manual address input (sandbox only)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const PHONE_KEY = 'verifiedPhone';
const PHONE_AT_KEY = 'verifiedPhoneAt';
// export const PHONE_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
export const PHONE_TTL_MS = 60 * 1000; // 1 minute

let currentPartnerUserRef: string | null = null;
let currentWalletAddress: string | null = null;
let currentSolanaAddress: string | null = null;

let verifiedPhone: string | null = null;
let verifiedPhoneAt: number | null = null;

let currentCountry: string = 'US';
let currentSubdivision: string = 'CA';

let manualWalletAddress: string | null = null;
let currentNetwork: string = 'Base'; // Track selected network

let pendingTransactionForm: any = null;

export const setPendingForm = (form: any) => { pendingTransactionForm = form; };
export const getPendingForm = () => pendingTransactionForm;
export const clearPendingForm = () => { pendingTransactionForm = null; };

export const getCountry = () => currentCountry;
export const setCountry = (c: string) => { currentCountry = c; };

export const getSubdivision = () => currentSubdivision;
export const setSubdivision = (s: string) => { currentSubdivision = s; };

let phoneVerifyCanceled = false;

export const markPhoneVerifyCanceled = () => { phoneVerifyCanceled = true; };
export const getPhoneVerifyWasCanceled = () => phoneVerifyCanceled;
export const clearPhoneVerifyWasCanceled = () => { phoneVerifyCanceled = false; };

// Sandbox mode - always defaults to ON for safety (prevents accidental real transactions)
// Does NOT persist across app restarts - intentional design
let sandboxMode: boolean = true;

export const getSandboxMode = () => sandboxMode;
export const setSandboxMode = (enabled: boolean) => {
  sandboxMode = enabled;
  console.log('Sandbox mode:', enabled ? 'ENABLED' : 'DISABLED');
};

// Initialize sandbox mode - always starts as ON for safety
export const hydrateSandboxMode = async () => {
  sandboxMode = true;
  console.log('ℹ️ Sandbox mode initialized to default: ENABLED (for safety)');
};

// ============================================================================
// TEST ACCOUNT SESSION (TestFlight Only)
// ============================================================================
// Stores mock session for TestFlight reviewers who use test account
// Persists until sign out (email) or unlink phone

const TEST_SESSION_KEY = '@onramp_test_session';

let testSessionActive = false;
let testWalletEvm: string | null = null;
let testWalletSol: string | null = null;

export const setTestSession = async (evmAddress: string, solAddress: string) => {
  testSessionActive = true;
  testWalletEvm = evmAddress;
  testWalletSol = solAddress;

  await AsyncStorage.setItem(TEST_SESSION_KEY, JSON.stringify({
    active: true,
    evm: evmAddress,
    sol: solAddress
  }));

  console.log('✅ Test session activated (TestFlight)');
};

export const clearTestSession = async () => {
  testSessionActive = false;
  testWalletEvm = null;
  testWalletSol = null;

  await AsyncStorage.removeItem(TEST_SESSION_KEY);
  console.log('❌ Test session cleared');
};

export const hydrateTestSession = async () => {
  try {
    const data = await AsyncStorage.getItem(TEST_SESSION_KEY);
    if (data) {
      const parsed = JSON.parse(data);

      // Safety check: Validate test session data
      if (parsed.active && parsed.evm && parsed.sol) {
        testSessionActive = true;
        testWalletEvm = parsed.evm;
        testWalletSol = parsed.sol;
        console.log('🔄 Test session hydrated from storage');
      } else {
        // Invalid data, clear it
        console.warn('⚠️ Invalid test session data, clearing');
        await clearTestSession();
      }
    }
  } catch (error) {
    console.error('❌ Error hydrating test session:', error);
    await clearTestSession();
  }
};

export const isTestSessionActive = () => testSessionActive;
export const getTestWalletEvm = () => testWalletEvm;
export const getTestWalletSol = () => testWalletSol;


export const setCurrentPartnerUserRef = (ref: string | null) => {
  currentPartnerUserRef = ref;
  console.log('Global state updated - currentPartnerUserRef:', ref);
};

export const getCurrentPartnerUserRef = () => {
  console.log('Getting global state - currentPartnerUserRef:', currentPartnerUserRef);
  return currentPartnerUserRef;
};

export const setManualWalletAddress = (addr: string | null) => {
  manualWalletAddress = addr;
};

export const getManualWalletAddress = () => manualWalletAddress;

export const clearManualAddress = () => {
  manualWalletAddress = '';
  console.log('🧹 [SHARED STATE] Manual address cleared (production mode)');
};

export const setCurrentWalletAddress = (addr: string | null) => {
  currentWalletAddress = addr;
};

export const setCurrentSolanaAddress = (addr: string | null) => {
  currentSolanaAddress = addr;
};

export const setCurrentNetwork = (network: string) => {
  currentNetwork = network;
};

export const getCurrentNetwork = () => currentNetwork;

// utils/sharedState.ts - document wallet address priority
/**
 * Wallet address priority system:
 *
 * SANDBOX MODE:
 * - SOL network: manual > SOL wallet
 * - EVM and ANY other network: manual > EVM wallet
 *
 * PRODUCTION MODE:
 * - SOL network: SOL wallet only
 * - EVM networks: EVM wallet only
 * - Unsupported networks: null (no address)
 */
export const getCurrentWalletAddress = () => {
  const networkLower = (currentNetwork || '').toLowerCase();
  const isSolanaNetwork = ['solana', 'sol'].some(k => networkLower.includes(k));
  const isEvmNetwork = ['ethereum', 'base', 'unichain', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'avax', 'bsc', 'fantom', 'linea', 'zksync', 'scroll'].some(k => networkLower.includes(k));

  if (sandboxMode) {
    // Sandbox mode: allow testing with any address
    if (isSolanaNetwork) {
      // SOL network: prefer manual, fallback to SOL wallet
      return manualWalletAddress || currentSolanaAddress || null;
    } else {
      // EVM and ANY other network (including unsupported): prefer manual, fallback to EVM wallet
      return manualWalletAddress || currentWalletAddress || null;
    }
  } else {
    // Production mode: strict network-wallet matching
    if (isSolanaNetwork) {
      // SOL network: SOL wallet only
      return currentSolanaAddress || null;
    } else if (isEvmNetwork) {
      // EVM networks: EVM wallet only
      return currentWalletAddress || null;
    } else {
      // Unsupported networks (Bitcoin, Noble, etc.): NO address
      return null;
    }
  }
};

export const setVerifiedPhone = async (phone: string | null) => {
  verifiedPhone = phone;
  verifiedPhoneAt = phone ? Date.now() : null;
  if (phone) {
    await AsyncStorage.multiSet([[PHONE_KEY, phone], [PHONE_AT_KEY, String(verifiedPhoneAt)]]);
  } else {
    await AsyncStorage.multiRemove([PHONE_KEY, PHONE_AT_KEY]);
  }
};

export const hydrateVerifiedPhone = async () => {
  const [p, at] = await AsyncStorage.multiGet([PHONE_KEY, PHONE_AT_KEY]);
  verifiedPhone = p?.[1] || null;
  verifiedPhoneAt = at?.[1] ? Number(at[1]) : null;
};

export const getVerifiedPhone = () => verifiedPhone;
export const getVerifiedPhoneAt = () => verifiedPhoneAt;

export const isPhoneFresh60d = () => {
  if (!verifiedPhoneAt) return false;
  return Date.now() - verifiedPhoneAt < PHONE_TTL_MS;
};

export const phoneExpiry = () => (verifiedPhoneAt ? new Date(verifiedPhoneAt + PHONE_TTL_MS) : null);
export const daysUntilExpiry = () => {
  if (!verifiedPhoneAt) return -1;
  const rem = verifiedPhoneAt + PHONE_TTL_MS - Date.now();
  return Math.ceil(rem / (24 * 60 * 60 * 1000));
};

export const formatPhoneDisplay = (phone: string | null): string => {
  if (!phone) return '';
  
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Handle +1 prefix (US numbers are 11 digits total)
  if (digits.length === 11 && digits.startsWith('1')) {
    const areaCode = digits.slice(1, 4);
    const exchange = digits.slice(4, 7);
    const number = digits.slice(7, 11);
    return `+1 (${areaCode}) ${exchange}-${number}`;
  }
  
  // Handle 10-digit US numbers (add +1)
  if (digits.length === 10) {
    const areaCode = digits.slice(0, 3);
    const exchange = digits.slice(3, 6);
    const number = digits.slice(6, 10);
    return `+1 (${areaCode}) ${exchange}-${number}`;
  }
  
  // Fallback: return as-is if not a standard US format
  return phone;
};