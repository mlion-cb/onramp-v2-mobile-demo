/**
 * This file handles crypto polyfill installation which is required by @coinbase/cdp-hooks.
 *
 * TWO BUILD MODES:
 * 1. Expo Go (EXPO_PUBLIC_USE_EXPO_CRYPTO=true):
 *    - Uses expo-crypto via Metro alias (limited functionality)
 *    - Wallet export disabled
 *    - Can only use previously verified email addresses
 *
 * 2. TestFlight/Production (EXPO_PUBLIC_USE_EXPO_CRYPTO=false):
 *    - Uses react-native-quick-crypto (full native crypto)
 *    - Wallet export enabled via expo-secure-store
 *    - Full wallet creation supported
 *
 * @see app.config.ts for expo-secure-store plugin configuration
 * @see metro.config.js for module resolution (no aliases to avoid conflicts)
 */

import structuredClone from "@ungap/structured-clone";
import { Buffer } from "buffer";
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";

// Conditional crypto setup based on build type
const isExpoGo = process.env.EXPO_PUBLIC_USE_EXPO_CRYPTO === 'true';

// Setup globals FIRST (needed for both environments)
if (!("Buffer" in globalThis)) {
  globalThis.Buffer = Buffer as any;
}

if (!("structuredClone" in globalThis)) {
  globalThis.structuredClone = structuredClone as any;
}

// Install crypto based on environment
if (!isExpoGo) {
  // TestFlight/Production: use react-native-quick-crypto
  try {
    const { install } = require('react-native-quick-crypto');
    install();
    console.log('Using react-native-quick-crypto for production build with full polyfills');
  } catch (e) {
    console.warn('react-native-quick-crypto not available:', e);
  }
} else {
  // Expo Go: use expo-crypto via Metro alias
  console.log('Using expo-crypto via Metro alias for Expo Go - export wallet disabled');
}

// Now it's safe to import the app
import "expo-router/entry";
