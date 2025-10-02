const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const useExpoCrypto = process.env.EXPO_PUBLIC_USE_EXPO_CRYPTO === 'true';

config.resolver = {
  ...config.resolver,
  alias: {
    ...config.resolver.alias,
    '@coinbase/cdp-hooks': '@coinbase/cdp-hooks/dist/esm/index.js',
    '@coinbase/cdp-core': '@coinbase/cdp-core/dist/esm/index.js',
    '@coinbase/cdp-react': '@coinbase/cdp-react/dist/esm/index.js',
    '@noble/hashes/crypto.js': '@noble/hashes/crypto.js',
    crypto: useExpoCrypto ? 'expo-crypto' : 'react-native-quick-crypto',
    stream: 'readable-stream',
    buffer: '@craftzdog/react-native-buffer',
    util: 'util',
    url: 'react-native-url-polyfill',
    querystring: 'querystring-es3',
    zlib: 'browserify-zlib',
    // path: 'path-browserify',
    vm: 'vm-browserify',
  },
  unstable_enableSymlinks: false,
  unstable_enablePackageExports: true,
  unstable_conditionNames: ['react-native', 'browser', 'require', 'default'],
};

module.exports = config;