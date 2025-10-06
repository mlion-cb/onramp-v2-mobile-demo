
/**
 * IP Resolution Service for Coinbase Onramp API
 *
 * COINBASE SECURITY REQUIREMENTS (Official Docs):
 * @see https://docs.cdp.coinbase.com/onramp-&-offramp/security-requirements
 * @see https://docs.cdp.coinbase.com/onramp-&-offramp/onramp-apis/generating-onramp-url
 *
 * "The client IP address of the end user. This parameter is required for security
 * validation to ensure the quote can only be used by the requesting user.
 * Do not trust HTTP headers like X-Forwarded-For — these can be easily spoofed."
 *
 * IMPLEMENTATION STRATEGY:
 *
 * 1. TRUSTED PROXY (Production on Vercel):
 *    - Use req.ip (Vercel sets this from actual TCP connection, NOT raw client headers)
 *    - Vercel strips client-provided X-Forwarded-For and sets its own trusted value
 *    - This gives the true client IP even when behind CDN/load balancer
 *
 * 2. DIRECT CONNECTION (Self-hosted):
 *    - Use req.socket.remoteAddress (direct TCP connection IP)
 *    - No proxy headers involved - pure socket-level IP
 *
 * 3. LOCALHOST (Development):
 *    - Both approaches give 127.0.0.1 (server and client on same machine)
 *    - MUST use external IP service (ipify.org) to get developer's real public IP
 *    - Coinbase will reject localhost IPs in production mode
 *
 * SECURITY NOTE:
 * - Never trust raw X-Forwarded-For header from req.headers (client can spoof)
 * - Always use req.ip (framework-sanitized) or req.socket.remoteAddress (TCP-level)
 * - For hosted platforms, verify they use trusted proxy configuration
 */

import { Agent, setGlobalDispatcher } from 'undici';
setGlobalDispatcher(new Agent({ connect: { family: 0, timeout: 10_000 } })); // allow both IPv4 and IPv6

const isPrivate = (ip?: string) => {
  if (!ip) return true;
  const v = ip.replace('::ffff:', '');
  return (
    v === '127.0.0.1' ||
    v === '::1' ||
    v.startsWith('10.') ||
    v.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(v) ||
    v.startsWith('fe80:') || // link-local v6
    v.startsWith('fc') || v.startsWith('fd') // unique local v6
  );
};

async function getPublicIp(): Promise<string> {
  // NO CACHING: User IP can change when switching networks (WiFi ↔ Mobile)
  // Caching would cause mismatches with Coinbase validation

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 3000); // Shorter timeout

  try {
    const r = await fetch('https://api.ipify.org?format=json', { signal: ctrl.signal });
    const j = await r.json().catch(() => ({}));
    return (j.ip || '').trim();
  } catch {
    return '';
  } finally {
    clearTimeout(t);
  }
}

export async function resolveClientIp(req: any): Promise<string> {
  // Simple approach: Use Vercel's req.ip (from trusted x-forwarded-for)
  // This gives us whatever IP the client is actually using (IPv4 or IPv6)
  const clientIp = req.ip || req.socket?.remoteAddress || '';

  // For development environments with private IPs, use fallback
  if (isPrivate(clientIp)) {
    const fallbackIp = await getPublicIp().catch(() => '');
    return fallbackIp || clientIp;
  }

  return clientIp;
}