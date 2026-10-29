import { promises as dns } from 'node:dns';
import type { IncomingHttpHeaders } from 'node:http';
import { request } from 'node:https';
import { isIP } from 'node:net';
import { cleanDomain, domainOk, VERIFICATION_META_NAME, VERIFICATION_TXT_PREFIX, type VerificationMethod } from '@seo/shared';
import { publicLookup } from '../lib/netGuard';

// Proof that a company owns a domain before it sees the domain's data: a DNS TXT record or a meta tag on the homepage (this
// module), or "Verify with Google", the person's own Google account owns the property in Search Console (services/google.ts
// gscOwnerCheck, through the OAuth callback). The engine's service account seeing a property proves nothing about who asks.

export interface VerifyOutcome {
  verified: boolean;
  message: string;
}

// the SSRF guard's two halves live in lib/netGuard.ts (G4); re-exported here for the callers that import them from verify (cms/http.ts)
export { isPrivateIp, publicLookup } from '../lib/netGuard';

/** What one GET answered. `headers` only when the caller asked for them (Index coverage, 2026-10-29: X-Robots-Tag); every other caller
 *  gets exactly the three fields it always got. */
export interface OnceAnswer {
  status: number;
  location: string | null;
  text: string;
  headers?: IncomingHttpHeaders;
}

/** Options of one request. `headers: true` adds the response headers to the answer (opt-in; nothing else changes). */
export interface FetchOpts {
  headers?: boolean;
}

/** One HTTPS GET (no redirect followed). Exported for its tests only: callers use fetchPublicText / fetchPublicOnce (the host guard). */
export function getOnce(url: string, maxBytes: number, opts: FetchOpts = {}): Promise<OnceAnswer> {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: 'GET', lookup: publicLookup as never, headers: { 'user-agent': 'SEO-Agent-Verifier/1.0', accept: 'text/html' }, timeout: 10000 }, (res) => {
      // opt-in only: an answer without the option has no `headers` key at all (its shape is unchanged for every existing caller)
      const withHeaders = (a: Omit<OnceAnswer, 'headers'>): OnceAnswer => (opts.headers ? { ...a, headers: { ...res.headers } } : a);
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) {
        res.resume();
        return resolve(withHeaders({ status: res.statusCode, location: res.headers.location ?? null, text: '' }));
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (c: Buffer) => {
        size += c.length;
        if (size <= maxBytes) chunks.push(c);
        else res.destroy();
      });
      res.on('end', () => resolve(withHeaders({ status: res.statusCode ?? 0, location: null, text: Buffer.concat(chunks).toString('utf8') })));
      res.on('close', () => resolve(withHeaders({ status: res.statusCode ?? 0, location: null, text: Buffer.concat(chunks).toString('utf8') })));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

/**
 * The host of a public https address, or null. Parsed the way Node itself parses it for the request: a regex reads `good.com` in
 * `https://good.com:x@10.0.0.5/` while the request goes to 10.0.0.5 (and Node skips the guarded DNS lookup for an IP), so an address with a
 * user name or password, or an IP literal, is refused outright (site tasks, 2026-10-28: a client's own Location header reaches here).
 */
export function publicHttpsHost(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password) return null;
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!host || isIP(host)) return null;
  return domainOk(cleanDomain(host)) ? host : null;
}

/**
 * HTTPS GET with manual redirects (https only, public hosts only, at most 4 hops) and a size cap. With `opts.headers` the answer also
 * carries the final response's headers and the first hop's status (`firstStatus`, so a caller can tell a 301 from a 302); without it the
 * answer is exactly `{ status, text, finalUrl }` as before.
 */
export async function fetchPublicText(
  url: string,
  maxBytes = 512 * 1024,
  hops = 4,
  opts: FetchOpts = {},
): Promise<{ status: number; text: string; finalUrl: string; headers?: IncomingHttpHeaders; firstStatus?: number } | null> {
  let current = url;
  let firstStatus = 0;
  for (let i = 0; i <= hops; i++) {
    if (!publicHttpsHost(current)) return null;
    const r = await getOnce(current, maxBytes, opts.headers ? { headers: true } : {});
    if (i === 0 && r.location) firstStatus = r.status;
    if (r.location) {
      current = new URL(r.location, current).toString();
      continue;
    }
    return opts.headers ? { status: r.status, text: r.text, finalUrl: current, headers: r.headers ?? {}, firstStatus } : { status: r.status, text: r.text, finalUrl: current };
  }
  return null;
}

/** One HTTPS GET with no redirect followed (site tasks: a redirect check must see a 301 apart from a 302); public hosts only. */
export async function fetchPublicOnce(url: string, maxBytes = 64 * 1024): Promise<{ status: number; location: string | null; text: string } | null> {
  if (!publicHttpsHost(url)) return null;
  const r = await getOnce(url, maxBytes);
  return { ...r, location: r.location ? new URL(r.location, url).toString() : null };
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

export async function verifyMeta(domain: string, token: string, fetchPage: typeof fetchPublicText = fetchPublicText): Promise<VerifyOutcome> {
  const d = cleanDomain(domain);
  const re1 = new RegExp(`<meta[^>]+name=["']${VERIFICATION_META_NAME}["'][^>]*content=["']([^"']+)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*name=["']${VERIFICATION_META_NAME}["']`, 'i');
  // what happened on each URL tried: the message says which case it was (R108)
  let opened = false; // a page on the domain itself answered, with no tag in it
  let redirectedTo = '';
  let failure = '';
  for (const url of [`https://${d}/`, `https://www.${d}/`]) {
    try {
      const page = await fetchPage(url);
      if (!page) {
        failure ||= 'no public https page answered';
        continue;
      }
      // the tag counts only on the domain itself (a redirect to another site proves nothing)
      const finalHost = cleanDomain(page.finalUrl.match(/^https:\/\/([^/?#:]+)/i)?.[1] ?? '');
      if (finalHost !== d) {
        redirectedTo ||= finalHost;
        continue;
      }
      const m = page.text.match(re1) ?? page.text.match(re2);
      if (m && m[1].trim() === token) return { verified: true, message: `Meta tag found on ${page.finalUrl}` };
      if (m) return { verified: false, message: `A ${VERIFICATION_META_NAME} tag is on ${page.finalUrl}, but with a different code.` };
      opened = true;
    } catch (err) {
      // the error code only (messages can carry addresses)
      failure ||= (err as NodeJS.ErrnoException).code ?? 'the request failed';
    }
  }
  if (opened) return { verified: false, message: `The homepage of ${d} has no ${VERIFICATION_META_NAME} meta tag. Publish it inside <head> and try again.` };
  if (redirectedTo) return { verified: false, message: `https://${d}/ redirects to ${redirectedTo}. The tag must be on ${d} itself, so make the homepage of ${d} answer with the tag, then try again.` };
  return { verified: false, message: `We could not open https://${d}/ (${failure || 'no answer'}), so we could not look for the ${VERIFICATION_META_NAME} meta tag. Check that the address is right and the site is online, then try again.` };
}

export function verify(method: Exclude<VerificationMethod, 'search_console'>, domain: string, token: string): Promise<VerifyOutcome> {
  return method === 'dns' ? verifyDns(domain, token) : verifyMeta(domain, token);
}
