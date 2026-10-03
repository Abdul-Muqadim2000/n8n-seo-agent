import { promises as dns, type LookupAddress } from 'node:dns';
import { request } from 'node:https';
import { isIP } from 'node:net';
import { cleanDomain, domainOk, VERIFICATION_META_NAME, VERIFICATION_TXT_PREFIX, type VerificationMethod } from '@seo/shared';

// Proof that a company owns a domain before it sees the domain's data: a DNS TXT record or a meta tag on the homepage (this
// module), or "Verify with Google" — the person's own Google account owns the property in Search Console (services/google.ts
// gscOwnerCheck, through the OAuth callback). The engine's service account seeing a property proves nothing about who asks.

export interface VerifyOutcome {
  verified: boolean;
  message: string;
}

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const l = ip.toLowerCase();
  return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:') || l.startsWith('64:ff9b');
}

/** DNS lookup for the HTTPS connection itself: only public addresses (the address checked is the address connected to). */
function publicLookup(hostname: string, options: object, cb: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void) {
  dns
    .lookup(hostname, { all: true })
    .then((addrs) => {
      const ok = addrs.filter((a) => !isPrivateIp(a.address));
      if (!ok.length || ok.length !== addrs.length) return cb(Object.assign(new Error(`${hostname} resolves to a private address`), { code: 'EPRIVATE' }), '', 4);
      if ((options as { all?: boolean }).all) return cb(null, ok);
      cb(null, ok[0].address, ok[0].family);
    })
    .catch((err) => cb(err, '', 4));
}

function getOnce(url: string, maxBytes: number): Promise<{ status: number; location: string | null; text: string }> {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: 'GET', lookup: publicLookup as never, headers: { 'user-agent': 'SEO-Agent-Verifier/1.0', accept: 'text/html' }, timeout: 10000 }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) {
        res.resume();
        return resolve({ status: res.statusCode, location: res.headers.location ?? null, text: '' });
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (c: Buffer) => {
        size += c.length;
        if (size <= maxBytes) chunks.push(c);
        else res.destroy();
      });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, location: null, text: Buffer.concat(chunks).toString('utf8') }));
      res.on('close', () => resolve({ status: res.statusCode ?? 0, location: null, text: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

/** HTTPS GET with manual redirects (https only, public hosts only, at most 4 hops) and a size cap. */
export async function fetchPublicText(url: string, maxBytes = 512 * 1024, hops = 4): Promise<{ status: number; text: string; finalUrl: string } | null> {
  let current = url;
  for (let i = 0; i <= hops; i++) {
    const host = current.match(/^https:\/\/([^/?#:]+)/i)?.[1];
    if (!host || !domainOk(cleanDomain(host))) return null;
    const r = await getOnce(current, maxBytes);
    if (r.location) {
      current = new URL(r.location, current).toString();
      continue;
    }
    return { status: r.status, text: r.text, finalUrl: current };
  }
  return null;
}

export async function verifyDns(domain: string, token: string): Promise<VerifyOutcome> {
  const expected = VERIFICATION_TXT_PREFIX + token;
  try {
    const records = (await dns.resolveTxt(cleanDomain(domain))).map((chunks) => chunks.join(''));
    if (records.some((r) => r.trim() === expected)) return { verified: true, message: 'TXT record found' };
    return { verified: false, message: `No TXT record "${expected}" on ${domain} yet (${records.length} TXT record(s) found). DNS changes can take a few minutes to an hour.` };
  } catch (err) {
    return { verified: false, message: `Could not read the DNS records of ${domain} (${(err as NodeJS.ErrnoException).code ?? String(err)}).` };
  }
}

export async function verifyMeta(domain: string, token: string): Promise<VerifyOutcome> {
  const d = cleanDomain(domain);
  const re1 = new RegExp(`<meta[^>]+name=["']${VERIFICATION_META_NAME}["'][^>]*content=["']([^"']+)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*name=["']${VERIFICATION_META_NAME}["']`, 'i');
  for (const url of [`https://${d}/`, `https://www.${d}/`]) {
    try {
      const page = await fetchPublicText(url);
      if (!page) continue;
      // the tag counts only on the domain itself (a redirect to another site proves nothing)
      const finalHost = cleanDomain(page.finalUrl.match(/^https:\/\/([^/?#:]+)/i)?.[1] ?? '');
      if (finalHost !== d) continue;
      const m = page.text.match(re1) ?? page.text.match(re2);
      if (m && m[1].trim() === token) return { verified: true, message: `Meta tag found on ${page.finalUrl}` };
      if (m) return { verified: false, message: `A ${VERIFICATION_META_NAME} tag is on ${page.finalUrl}, but with a different code.` };
    } catch {
      /* try the next URL */
    }
  }
  return { verified: false, message: `The ${VERIFICATION_META_NAME} meta tag was not found on the homepage of ${d} (https). Publish it inside <head> and try again.` };
}

export function verify(method: Exclude<VerificationMethod, 'search_console'>, domain: string, token: string): Promise<VerifyOutcome> {
  return method === 'dns' ? verifyDns(domain, token) : verifyMeta(domain, token);
}
