import 'dotenv/config';
import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
    name: 'Onramp V2 Demo',
    slug: 'onramp-v2-demo',
    version: '1.0.0',
    scheme: 'onrampdemo',
    owner: 'mlion-cb',
    userInterfaceStyle: 'automatic',
    newArchEnabled: false,
    icon: './assets/images/icon.png',

    ios: {
      bundleIdentifier: 'com.mlion-cb.onrampv2demo', 
      buildNumber: process.env.IOS_BUILD_NUMBER ?? '1.0.0', // bump each submit
      supportsTablet: false,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false
      }
    },

    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff'
      },
      edgeToEdgeEnabled: true,
      package: "com.mlioncb.onrampv2demo"
    },

    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png'
    },

    plugins: [
      'expo-router',
      ['expo-splash-screen', { image: './assets/images/splash-icon.png', imageWidth: 200, resizeMode: 'contain', backgroundColor: '#ffffff' }],
      ['expo-build-properties', { ios: { deploymentTarget: '15.1' } }]
    ],

    experiments: { typedRoutes: true },

    extra: {
      // Keep EAS project id
      eas: { projectId: '981ff535-f8bf-4fac-97ef-1cdbc9038e85' },

      // Client-visible env (set locally in .env/.env.local and in EAS Secrets)
      EXPO_PUBLIC_BASE_URL: process.env.EXPO_PUBLIC_BASE_URL,
      EXPO_PUBLIC_USE_EXPO_CRYPTO: process.env.EXPO_PUBLIC_USE_EXPO_CRYPTO ?? 'false',
      EXPO_PUBLIC_CDP_PROJECT_ID: process.env.EXPO_PUBLIC_CDP_PROJECT_ID,
      EXPO_PUBLIC_CDP_BASE_PATH: process.env.EXPO_PUBLIC_CDP_BASE_PATH ?? 'https://api.cdp.coinbase.com/platform',
      EXPO_PUBLIC_CDP_CREATE_ACCOUNT_TYPE: process.env.EXPO_PUBLIC_CDP_CREATE_ACCOUNT_TYPE ?? 'evm-smart',
      EXPO_PUBLIC_CDP_USE_MOCK: process.env.EXPO_PUBLIC_CDP_USE_MOCK ?? 'false'
    },

    // Good hygiene if you later use EAS Update
    runtimeVersion: { policy: 'sdkVersion' }
};

export default config;