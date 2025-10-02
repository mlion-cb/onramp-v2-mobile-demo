import { CDPHooksProvider, Config } from "@coinbase/cdp-hooks";
import { Stack } from "expo-router";
import { COLORS } from "../constants/Colors";

import { hydrateVerifiedPhone } from "@/utils/sharedState";
import { useEffect } from "react";
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import '@ungap/structured-clone';

import { Buffer as PolyfillBuffer } from '@craftzdog/react-native-buffer';
if (typeof (global as any).Buffer === 'undefined') {
  (global as any).Buffer = PolyfillBuffer as any;
}

const { BLUE, TEXT_SECONDARY, CARD_BG, BORDER, TEXT_PRIMARY } = COLORS;

// Conditional crypto setup based on build type
const isExpoGo = process.env.EXPO_PUBLIC_USE_EXPO_CRYPTO === 'true';

if (!isExpoGo) {
  // TestFlight/Production: use react-native-quick-crypto
  try {
    const { install } = require('react-native-quick-crypto');
    install();
    console.log('Using react-native-quick-crypto for production build');
  } catch (e) {
    console.warn('react-native-quick-crypto not available');
  }
} else {
  console.log('Using expo-crypto via Metro alias for Expo Go');
}

// CDP configuration using the working pattern from the template
const cdpConfig: Config = {
  projectId: process.env.EXPO_PUBLIC_CDP_PROJECT_ID!,
  basePath: process.env.EXPO_PUBLIC_CDP_BASE_PATH!,
  ethereum: {createOnLogin: (process.env.EXPO_PUBLIC_CDP_CREATE_ACCOUNT_TYPE as "eoa" | "smart") || "smart"},
  useMock: process.env.EXPO_PUBLIC_CDP_USE_MOCK === "true",
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