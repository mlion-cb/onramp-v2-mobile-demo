const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const useExpoCrypto = process.env.EXPO_PUBLIC_USE_EXPO_CRYPTO === 'true';

// Custom resolver based on working Coinbase demo
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Handle CDP packages with custom resolution
  if (moduleName.includes('@coinbase/cdp-')) {
    try {
      const result = require.resolve(moduleName);
      return context.resolveRequest(context, result, platform);
    } catch (e) {
      // Fallback to default resolution
    }
  }

  // Handle noble hashes specifically
  if (moduleName.includes('@noble/hashes') && moduleName.includes('/crypto.js')) {
    try {
      const result = require.resolve('@noble/hashes/crypto.js');
      return context.resolveRequest(context, result, platform);
    } catch (e) {
      // Fallback to default resolution
    }
  }

  // Add zustand and rpc-websockets from working reference
  if (moduleName.includes("zustand")) {
    const result = require.resolve(moduleName);
    return context.resolveRequest(context, result, platform);
  }

  if (moduleName.includes("rpc-websockets")) {
    const result = require.resolve(moduleName);
    return context.resolveRequest(context, result, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

config.resolver = {
  ...config.resolver,
  alias: {
    ...config.resolver.alias,
    // Keep essential polyfills for other packages
    crypto: useExpoCrypto ? 'expo-crypto' : 'react-native-quick-crypto',
    stream: 'readable-stream',
    buffer: '@craftzdog/react-native-buffer',
    util: 'util',
    url: 'react-native-url-polyfill',
    querystring: 'querystring-es3',
    zlib: 'browserify-zlib',
    path: 'path-browserify',
    vm: 'vm-browserify',
  },
  unstable_enableSymlinks: false,
  unstable_enablePackageExports: true,
  unstable_conditionNames: ['react-native', 'browser', 'require', 'default'],
};

module.exports = config;