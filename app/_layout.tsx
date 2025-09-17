import { CDPHooksProvider, Config } from "@coinbase/cdp-hooks";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { COLORS } from "../constants/Colors";

import { hydrateVerifiedPhone } from "@/utils/sharedState";
import { useEffect } from "react";
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

const { BLUE, TEXT_SECONDARY, CARD_BG, BORDER, TEXT_PRIMARY } = COLORS;

// CDP configuration using the working pattern from the template
const cdpConfig: Config = {
  projectId: process.env.EXPO_PUBLIC_CDP_PROJECT_ID!,
  basePath: process.env.EXPO_PUBLIC_CDP_BASE_PATH!,
  createAccountOnLogin: (process.env.EXPO_PUBLIC_CDP_CREATE_ACCOUNT_TYPE as "evm-eoa" | "evm-smart") || "evm-smart",
  useMock: process.env.EXPO_PUBLIC_CDP_USE_MOCK === "true",
};
console.log('RootLayout mounted, CDP config:', cdpConfig);

export default function RootLayout() {
  useEffect(() => {
    hydrateVerifiedPhone().catch(() => {});
  }, []);
  return (
    <CDPHooksProvider config={cdpConfig}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: BLUE,
          tabBarInactiveTintColor: TEXT_SECONDARY,
          headerStyle: {
            backgroundColor: CARD_BG, // Changed from white
          },
          headerTitleStyle: {
            fontWeight: "600",
            color: TEXT_PRIMARY, // Add text color
          },
          tabBarStyle: {
            backgroundColor: CARD_BG, // Changed from white
            borderTopColor: BORDER,
            borderTopWidth: 1,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Buy Crypto",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="card" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: "History",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="time" size={size} color={color} />
            ),
          }}
        />
          <Tabs.Screen
            name="profile"
            options={{
              title: "Profile",
              tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
            }}
          />
      </Tabs>
    </CDPHooksProvider>
  );
}