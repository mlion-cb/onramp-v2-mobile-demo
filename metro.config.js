const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver = {
  ...config.resolver,
  alias: {
    ...config.resolver.alias,
    crypto: 'react-native-quick-crypto',
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