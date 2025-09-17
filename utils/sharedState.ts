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

let verifiedPhone: string | null = null;
let verifiedPhoneAt: number | null = null;


export const setCurrentPartnerUserRef = (ref: string | null) => {
  currentPartnerUserRef = ref;
  console.log('Global state updated - currentPartnerUserRef:', ref);
};

export const getCurrentPartnerUserRef = () => {
  console.log('Getting global state - currentPartnerUserRef:', currentPartnerUserRef);
  return currentPartnerUserRef;
};

export const setCurrentWalletAddress = (addr: string | null) => {
  currentWalletAddress = addr;
};

export const getCurrentWalletAddress = () => currentWalletAddress;

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