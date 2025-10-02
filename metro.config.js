const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const useExpoCrypto = process.env.EXPO_PUBLIC_USE_EXPO_CRYPTO === 'true';

config.resolver = {
  ...config.resolver,
  alias: {
    ...config.resolver.alias,
    crypto: useExpoCrypto ? 'expo-crypto' : 'react-native-quick-crypto',
    stream: 'readable-stream',
    buffer: '@craftzdog/react-native-buffer',
    util: 'util',
    url: 'react-native-url-polyfill',
    querystring: 'querystring-es3',
    '@noble/hashes/crypto': '@noble/hashes/crypto.js',
  },
  unstable_enableSymlinks: false,
  unstable_enablePackageExports: true,
  unstable_conditionNames: ['react-native', 'browser', 'require'],
};

module.exports = config;