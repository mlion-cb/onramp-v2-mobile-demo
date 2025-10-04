/**
 * Simple global state for sharing data between tabs
 * Alternative to React Context - lightweight for demo purposes
 * 
 * Stores: currentPartnerUserRef (for transaction history lookup)
 * Updated: When user completes an onramp transaction
 * Used by: History page to fetch transactions for specific user
 * 
 * Production apps are suggested to use:
 * - React Context + useContext
 * - Redux/Zustand for complex state
 * - React Query for server state
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const PHONE_KEY = 'verifiedPhone';
const PHONE_AT_KEY = 'verifiedPhoneAt';
export const PHONE_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

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

let sandboxMode: boolean = true;

export const getSandboxMode = () => sandboxMode;
export const setSandboxMode = (enabled: boolean) => { 
  sandboxMode = enabled;
  console.log('Sandbox mode:', enabled ? 'ENABLED' : 'DISABLED');
};


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