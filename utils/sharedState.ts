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
let currentPartnerUserRef: string | null = null;

export const setCurrentPartnerUserRef = (ref: string | null) => {
  currentPartnerUserRef = ref;
  console.log('Global state updated - currentPartnerUserRef:', ref);
};

export const getCurrentPartnerUserRef = () => {
  console.log('Getting global state - currentPartnerUserRef:', currentPartnerUserRef);
  return currentPartnerUserRef;
};