// Client report 2026-11-11 (devaicon.com, N45): "I have connected Bing Webmaster Tools but it is still not connected and says it will be
// checked on the next autorun". The engine reads Bing with ONE key (SEO_BING_WEBMASTER_API_KEY, n8n credential SEOcredBingWebm): Bing's
// GetUserSites lists only the sites in the Bing account that owns that key (on 2026-11-06, execution 10597: techand.ai alone). A client who
// adds the site to their own Bing account has done the first half; the key's account still cannot see it, so every weekly run says
// "Missing" and the AI ranking step L03 never ticks off. This check asks Bing the same question the engine asks, right now, so the page can
// say which half is missing instead of "wait for the next run". The key is never logged and never sent to the browser.
import { config } from '../config';
import type { BingCheck } from '@seo/shared';

const GET_USER_SITES = 'https://ssl.bing.com/webmaster/api.svc/json/GetUserSites';
const hostOf = (u: string) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '').replace(/\.$/, '');

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export async function checkBingAccess(domain: string, opts: { fetch?: Fetch; key?: string; shareWith?: string; now?: Date } = {}): Promise<BingCheck> {
  const key = (opts.key ?? config.bing.apiKey).trim();
  const shareWith = (opts.shareWith ?? config.bing.shareWith).trim();
  const checkedAt = (opts.now ?? new Date()).toISOString();
  const base = { shareWith, checkedAt };
  if (!key) return { ...base, configured: false, inAccount: false, verified: false, message: 'Bing is not set up on this server.' };
  const want = hostOf(domain);
  let res: Response;
  try {
    res = await (opts.fetch ?? fetch)(`${GET_USER_SITES}?apikey=${encodeURIComponent(key)}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw Object.assign(new Error('Bing did not answer just now. Try again in a minute.'), { statusCode: 503 });
  }
  if (!res.ok) throw Object.assign(new Error(`Bing answered ${res.status}. Try again in a minute.`), { statusCode: 503 });
  let sites: { Url?: string; IsVerified?: boolean }[] = [];
  try {
    const j = (await res.json()) as { d?: { Url?: string; IsVerified?: boolean }[] };
    sites = Array.isArray(j?.d) ? j.d : [];
  } catch {
    throw Object.assign(new Error('Bing sent an answer we could not read. Try again in a minute.'), { statusCode: 503 });
  }
  const mine = sites.filter((s) => hostOf(s.Url ?? '') === want);
  const verified = mine.some((s) => s.IsVerified !== false);
  if (!mine.length) return { ...base, configured: true, inAccount: false, verified: false, message: `Bing does not list ${want} for us yet.` };
  return { ...base, configured: true, inAccount: true, verified, message: verified ? `Bing lists ${want} for us, verified.` : `Bing lists ${want} for us, not verified yet.` };
}
