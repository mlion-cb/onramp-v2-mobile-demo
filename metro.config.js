// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Allow common dist formats
config.resolver.sourceExts = Array.from(new Set([
  ...config.resolver.sourceExts,
  'cjs',
  'mjs'
]));

// Toggle to force expo-crypto (Expo Go) vs react-native-quick-crypto (Dev Client)
const useExpoCrypto = process.env.EXPO_PUBLIC_USE_EXPO_CRYPTO === 'true';

// Aliases for Node core modules → RN-friendly shims
const alias = {
  // crypto
  crypto: useExpoCrypto ? require.resolve('expo-crypto') : require.resolve('react-native-quick-crypto'),
  'node:crypto': useExpoCrypto ? require.resolve('expo-crypto') : require.resolve('react-native-quick-crypto'),

  // path
  path: require.resolve('path-browserify'),
  'node:path': require.resolve('path-browserify'),

  // buffer
  buffer: require.resolve('@craftzdog/react-native-buffer'),
  'node:buffer': require.resolve('@craftzdog/react-native-buffer'),

  // stream
  stream: require.resolve('readable-stream'),
  'node:stream': require.resolve('readable-stream'),

  // util
  util: require.resolve('util'),
  'node:util': require.resolve('util'),

  // url & querystring
  url: require.resolve('react-native-url-polyfill'),
  'node:url': require.resolve('react-native-url-polyfill'),
  querystring: require.resolve('querystring-es3'),
  'node:querystring': require.resolve('querystring-es3'),

  // extras that pop up sometimes
  events: require.resolve('events'),
  'node:events': require.resolve('events'),
  zlib: require.resolve('browserify-zlib'),
  'node:zlib': require.resolve('browserify-zlib'),
  vm: require.resolve('vm-browserify'),
  'node:vm': require.resolve('vm-browserify'),
  assert: require.resolve('assert'),
  'node:assert': require.resolve('assert'),
  process: require.resolve('process/browser'),
  'node:process': require.resolve('process/browser'),

  // noble asks for this hint sometimes
  '@noble/hashes/crypto': require.resolve('@noble/hashes/crypto'),
};

// Map both bare and node: specifiers
const nodePrefixed = Object.fromEntries(
  Object.entries(alias).map(([k, v]) => [`node:${k}`, v])
);

config.resolver.alias = {
  ...(config.resolver.alias || {}),
  ...alias,
  ...nodePrefixed,
};

// ✅ Critical part: normalize `node:` specifiers before Metro resolves
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('node:')) {
    const bare = moduleName.slice(5); // e.g., "node:path" -> "path"
    const mapped = alias[moduleName] || alias[bare] || bare;
    return defaultResolve
      ? defaultResolve(context, mapped, platform)
      : context.resolveRequest(context, mapped, platform);
  }
  return defaultResolve
    ? defaultResolve(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

// Optional: terser minifier & transform opts
config.transformer = {
  ...config.transformer,
  minifierPath: 'metro-minify-terser',
  getTransformOptions: async () => ({
    transform: { experimentalImportSupport: false, inlineRequires: true },
  }),
};

module.exports = config;
