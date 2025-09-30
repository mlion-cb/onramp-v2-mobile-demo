
import { Agent, setGlobalDispatcher } from 'undici';
setGlobalDispatcher(new Agent({ connect: { family: 4, timeout: 10_000 } })); // prefer IPv4

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

let cachedIp = '';
let cachedAt = 0;
async function getPublicIp(): Promise<string> {
  const now = Date.now();
  if (cachedIp && now - cachedAt < 5 * 60_000) return cachedIp; // 5 min cache
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch('https://api.ipify.org?format=json', { signal: ctrl.signal });
    const j = await r.json().catch(() => ({}));
    cachedIp = (j.ip || '').trim();
    cachedAt = now;
    return cachedIp;
  } finally { clearTimeout(t); }
}

export async function resolveClientIp(req: any): Promise<string> {
  const xff = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  const ip = xff || req.socket?.remoteAddress || '';
  const normalized = ip.replace('::ffff:', '');
  return isPrivate(normalized) ? await getPublicIp() : normalized;
}