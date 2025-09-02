// Simple global state for currentPartnerUserRef
let currentPartnerUserRef: string | null = null;

export const setCurrentPartnerUserRef = (ref: string | null) => {
  currentPartnerUserRef = ref;
  console.log('Global state updated - currentPartnerUserRef:', ref);
};

export const getCurrentPartnerUserRef = () => {
  console.log('Getting global state - currentPartnerUserRef:', currentPartnerUserRef);
  return currentPartnerUserRef;
};