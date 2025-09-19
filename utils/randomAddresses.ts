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
    return rand(BASE58, 44);
  }

  if (n.includes('btc') || n.includes('bitcoin')) {
    // Bitcoin bech32-like
    return 'bc1q' + rand(BECH32_LOW, 38);
  }

  if (n.includes('litecoin') || n.includes('ltc')) {
    return 'ltc1q' + rand(BECH32_LOW, 38);
  }

  if (n.includes('cosmos')) {
    return 'cosmos1' + rand(BECH32_LOW, 38);
  }

  // Fallback to EVM
  return '0x' + rand(HEX, 40);
};