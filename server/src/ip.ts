
/**
 * IP Resolution Service for Coinbase Onramp API
 *
 * SECURITY REQUIREMENTS:
 * - Coinbase requires accurate client IP for security validation
 * - Headers like X-Forwarded-For can be spoofed and should NOT be trusted
 * - IP must match the actual requesting user, not proxy/server IP
 *
 * DEPLOYMENT CONSIDERATIONS:
 * - For production behind proxies (Vercel, AWS ALB), configure trusted proxy settings
 * - External IP services are unreliable and add latency - avoid in production
 * - Consider using req.socket.remoteAddress as the source of truth
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