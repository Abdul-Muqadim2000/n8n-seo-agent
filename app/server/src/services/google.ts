import { createSign } from 'node:crypto';
import { cleanDomain } from '@seo/shared';
import { config } from '../config';
import { badRequest } from '../lib/errors';

// The n8n workflows read Search Console and GA4 with one Google service account (credential SEOcredGoogleSvc). A company connects
// its data by adding that account's e-mail as a user in Search Console and GA4. Because the account sees every company's
// properties, nothing from it is shown or accepted unless it belongs to the asking company's own, verified domain: GA4 properties
// only when one of their web streams measures that domain, Search Console only for that domain.
// Ownership itself is NOT proven by the service account (anyone could point at a property it already sees): see gscOwnerCheck.

const SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly', 'https://www.googleapis.com/auth/analytics.readonly'];
let token: { value: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (!config.serviceAccount.enabled) throw new Error('The Google service account is not configured (SEO_GOOGLE_SA_EMAIL / SEO_GOOGLE_SA_PRIVATE_KEY)');
  if (token && token.exp - 60_000 > Date.now()) return token.value;
  const now = Math.floor(Date.now() / 1000);
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({ iss: config.serviceAccount.email, scope: SCOPES.join(' '), aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(config.serviceAccount.privateKey, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
    signal: AbortSignal.timeout(15000),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !body.access_token) throw new Error(body.error_description || `Google token request failed (${res.status})`);
  token = { value: body.access_token, exp: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return token.value;
}

async function gget<T>(url: string, bearer?: string): Promise<T> {
  const res = await fetch(url, { headers: { authorization: `Bearer ${bearer ?? (await accessToken())}` }, signal: AbortSignal.timeout(15000) });
  const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(body.error?.message || `Google API answered ${res.status}`);
  return body;
}

const hostOf = (u: string) => (u.match(/^https?:\/\/([^/?#:]+)/i)?.[1] ?? '').toLowerCase().replace(/^www\./, '');

export interface GscMatch {
  property: string;
  permissionLevel: string;
}

type SiteEntry = { siteUrl: string; permissionLevel: string };
function matchProperty(entries: SiteEntry[], domain: string): SiteEntry | null {
  const d = cleanDomain(domain);
  const usable = entries.filter((e) => e.permissionLevel !== 'siteUnverifiedUser');
  return usable.find((e) => e.siteUrl === `sc-domain:${d}`) ?? usable.find((e) => e.siteUrl.startsWith('http') && hostOf(e.siteUrl) === d) ?? null;
}

/** The domain's Search Console property as the service account sees it (data connection, not ownership). */
export async function findGscProperty(domain: string): Promise<GscMatch | null> {
  const body = await gget<{ siteEntry?: SiteEntry[] }>('https://www.googleapis.com/webmasters/v3/sites');
  const m = matchProperty(body.siteEntry ?? [], domain);
  return m ? { property: m.siteUrl, permissionLevel: m.permissionLevel } : null;
}

/**
 * Ownership: the signed-in person's OWN Google account (OAuth, webmasters.readonly) must be a verified owner of the domain's
 * Search Console property. Google only makes someone an owner after they verified the site, so this proves control of the domain.
 */
export async function gscOwnerCheck(userAccessToken: string, domain: string): Promise<{ owner: boolean; property: string | null; permissionLevel: string | null }> {
  const body = await gget<{ siteEntry?: SiteEntry[] }>('https://www.googleapis.com/webmasters/v3/sites', userAccessToken);
  const entries = body.siteEntry ?? [];
  const d = cleanDomain(domain);
  const own = entries.find((e) => e.permissionLevel === 'siteOwner' && (e.siteUrl === `sc-domain:${d}` || (e.siteUrl.startsWith('http') && hostOf(e.siteUrl) === d)));
  const any = own ?? matchProperty(entries, d);
  return { owner: !!own, property: any?.siteUrl ?? null, permissionLevel: any?.permissionLevel ?? null };
}

export interface Ga4Property {
  id: string;
  name: string;
  account: string;
  matchesDomain: boolean;
}

// every property the service account sees, with the hosts its web streams measure; refreshed every 15 minutes
let ga4Cache: { at: number; props: { id: string; name: string; account: string; hosts: string[] }[] } | null = null;

async function ga4Inventory(): Promise<{ id: string; name: string; account: string; hosts: string[] }[]> {
  if (ga4Cache && Date.now() - ga4Cache.at < 15 * 60_000) return ga4Cache.props;
  const props: { id: string; name: string; account: string; hosts: string[] }[] = [];
  let pageToken = '';
  for (let page = 0; page < 20; page++) {
    const body = await gget<{ accountSummaries?: { displayName: string; propertySummaries?: { property: string; displayName: string }[] }[]; nextPageToken?: string }>(
      `https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`,
    );
    for (const a of body.accountSummaries ?? [])
      for (const p of a.propertySummaries ?? []) props.push({ id: p.property.replace('properties/', ''), name: p.displayName, account: a.displayName, hosts: [] });
    if (!body.nextPageToken) break;
    pageToken = body.nextPageToken;
  }
  // web streams of every property, 8 at a time
  for (let i = 0; i < props.length; i += 8)
    await Promise.all(
      props.slice(i, i + 8).map(async (p) => {
        try {
          const s = await gget<{ dataStreams?: { webStreamData?: { defaultUri?: string } }[] }>(`https://analyticsadmin.googleapis.com/v1beta/properties/${p.id}/dataStreams?pageSize=50`);
          p.hosts = (s.dataStreams ?? []).map((x) => hostOf(x.webStreamData?.defaultUri ?? '')).filter(Boolean);
        } catch {
          /* no access to the streams of this property */
        }
      }),
    );
  ga4Cache = { at: Date.now(), props };
  return props;
}

const measures = (hosts: string[], domain: string) => hosts.some((h) => h === domain || h.endsWith('.' + domain));

/** GA4 properties whose web streams measure the domain (never the other companies' properties). */
export async function listGa4Properties(domain: string): Promise<Ga4Property[]> {
  const d = cleanDomain(domain);
  return (await ga4Inventory())
    .filter((p) => measures(p.hosts, d))
    .map((p) => ({ id: p.id, name: p.name, account: p.account, matchesDomain: true }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** A GA4 property id may be used for a site only when it measures that site's domain. */
export async function assertGa4ForDomain(id: string, domain: string): Promise<void> {
  if (!id) return;
  if (!config.serviceAccount.enabled) throw badRequest('GA4 cannot be checked on this server (no service account)', { ga4PropertyId: 'Leave it empty' });
  let inv;
  try {
    inv = await ga4Inventory();
  } catch (err) {
    throw badRequest(`GA4 could not be checked right now (${String((err as Error).message || err)}). Leave the field empty to detect it automatically.`, { ga4PropertyId: 'Could not be checked' });
  }
  const p = inv.find((x) => x.id === id);
  if (!p || !measures(p.hosts, cleanDomain(domain)))
    throw badRequest(`GA4 property ${id} is not one we can read for ${domain}: add the service account as a Viewer of the property that measures ${domain}, or leave the field empty to detect it automatically.`, {
      ga4PropertyId: `Not a property of ${domain}`,
    });
}
