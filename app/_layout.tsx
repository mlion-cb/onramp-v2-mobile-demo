import { CDPHooksProvider, Config } from "@coinbase/cdp-hooks";
import { Stack } from "expo-router";
import { COLORS } from "../constants/Colors";

import { hydrateVerifiedPhone } from "@/utils/sharedState";
import { useEffect } from "react";
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

// Import polyfills (only used conditionally)
import structuredClone from "@ungap/structured-clone";
import { Buffer } from "buffer";

const { BLUE, TEXT_SECONDARY, CARD_BG, BORDER, TEXT_PRIMARY } = COLORS;

// Conditional crypto setup based on build type
const isExpoGo = process.env.EXPO_PUBLIC_USE_EXPO_CRYPTO === 'true';

// Add missing global polyfills needed for CDP export functionality
if (!("structuredClone" in globalThis)) {
  globalThis.structuredClone = structuredClone as any;
}

if (!("Buffer" in globalThis)) {
  globalThis.Buffer = Buffer as any;
}

if (!isExpoGo) {
  // TestFlight/Production: use react-native-quick-crypto + full polyfills
  try {
    const { install } = require('react-native-quick-crypto');
    install();
    console.log('Using react-native-quick-crypto for production build with full polyfills');
  } catch (e) {
    console.warn('react-native-quick-crypto not available:', e);
  }
} else {
  console.log('Using expo-crypto via Metro alias for Expo Go - export wallet disabled');
}

// CDP configuration with both ETH and SOL support
const cdpConfig: Config = {
  projectId: process.env.EXPO_PUBLIC_CDP_PROJECT_ID!,
  ethereum: {
    createOnLogin: "smart"
  },
  solana: {
    createOnLogin: true
  },
  useMock: false
};
console.log('RootLayout mounted, CDP config:', cdpConfig);

export default function RootLayout() {
  useEffect(() => {
    hydrateVerifiedPhone().catch(() => {});
  }, []);

  return (
    <CDPHooksProvider config={cdpConfig}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Phone verification pages - no tabs */}
        <Stack.Screen 
          name="phone-verify" 
          options={{
            presentation: 'card',
            animation: 'none', 
          }}
        />
        <Stack.Screen 
            name="phone-code" 
            options={{
              presentation: 'card',
              animation: 'none',
            }}
        />
        
        {/* Main app with tabs */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </CDPHooksProvider>
  );
}