const HEX = '0123456789abcdef';
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BECH32_LOW = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

const rand = (chars: string, len: number) =>
  Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

export const demoAddressForNetwork = (network: string) => {
  const n = (network || '').toLowerCase();

  // EVM-like (ethereum, base, polygon, arbitrum, optimism, avalanche, bsc, etc.)
  const isEvm = [
    'ethereum','base','polygon','arbitrum','optimism','avalanche','avax','bsc','linea','scroll','zksync','fantom'
  ].some(k => n.includes(k));
  if (isEvm) return '0x' + rand(HEX, 40);

  if (n.includes('sol')) {
    // Solana: 44-char base58
    return '11111111111111111111111111111112'; //  Demo address for quote
  }

  if (n.includes('btc') || n.includes('bitcoin')) {
    // Bitcoin bech32-like
    return '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'; // Genesis block address for demo
  }

  if (n.includes('litecoin') || n.includes('ltc')) {
    return 'LM2WMpR1Rp6j3Sa59cMXMs1SPzj9eXpGc1'; //  Demo address for quote
  }

  if (n.includes('cosmos')) {
    return 'cosmos1depk54cuajgkzea6zpgkq36tnjwdzv4afc3d27'; //  Demo address for quote
  }

  // Fallback to EVM
  return '0x' + rand(HEX, 40);
};