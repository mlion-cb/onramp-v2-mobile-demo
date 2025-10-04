import { CDPHooksProvider, Config } from "@coinbase/cdp-hooks";
import { Stack } from "expo-router";
import { COLORS } from "../constants/Colors";

import { hydrateVerifiedPhone } from "@/utils/sharedState";
import { useEffect } from "react";
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

// Import polyfills (only used conditionally)

const { BLUE, TEXT_SECONDARY, CARD_BG, BORDER, TEXT_PRIMARY } = COLORS;

// Conditional crypto setup based on build type
const isExpoGo = process.env.EXPO_PUBLIC_USE_EXPO_CRYPTO === 'true';

// CDP configuration with both ETH and SOL support
const cdpConfig: Config = {
  projectId: process.env.EXPO_PUBLIC_CDP_PROJECT_ID!,
  basePath: "https://api.cdp.coinbase.com/platform",
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