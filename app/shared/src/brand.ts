// B-R2 (benchmark area 12, "white-label-lite"): whose report is a client looking at?
//
// The leader for this area, AgencyAnalytics, sells a *white-labeled client portal*: "Branded Logo", "Branded Color Scheme", "Client
// Branding" and a custom domain; SE Ranking sells the same shape as a +$69/month Agency Pack add-on. We do not sell to agencies, so
// the custom domain is deliberately out of scope (BENCHMARKS_2026-10-14 §5(c) c1) and so is client messaging inside a report (c4,
// the leader has not shipped it either). What is left is the half a direct customer actually needs: somebody opening a shared report
// must see at a glance that it is *their supplier's* report about *their* website, and must never meet a broken page because a logo
// URL went stale.
//
// Deliberately NOT a new place to keep a logo. The company already gives the engine a business profile (`seo_profiles`:
// `business_name`, `logo_url`) for the Organization schema and the author box, the app already has the form that fills it
// (`ProfileForm`) and the server already reads that table. A second column on `organizations` would be a second truth to keep in
// step, and the first time the two disagreed a client would see the wrong mark.
//
// Nothing here fetches anything: these are the rules, shared by the server (which reads the profile) and the page (which draws it).

/** The company's own mark on something a client sees. `logoUrl` may be null, and the page must look finished without it. */
export interface SharedBrand {
  /** the name the client knows this company by: the business profile's name, else the company's name in the app */
  name: string;
  /** an https logo from that profile, or null when there is none we are willing to show */
  logoUrl: string | null;
  /** one or two letters for the monogram drawn when there is no logo (never empty when there is a name) */
  initials: string;
}

/** how long a name may be before it is cut (a header line, not a biography) */
const MAX_NAME = 120;
/** how long a URL may be before we stop believing it is a logo */
const MAX_URL = 512;

/**
 * A logo URL we are willing to put in an `<img>`.
 *
 * **https only.** The app's CSP allows `'self'`, `data:` and `https:` images, an `http:` one is blocked as mixed content on a live
 * install, and a `data:` or `javascript:` string is not a logo however it reached the profile. Whitespace, angle brackets, quotes and
 * a backslash, the characters that would only ever matter if the string were concatenated into markup, disqualify it outright. The
 * host must be a dotted name: no credentials (`user@host` in an image URL is a phishing shape, not a logo), no bare `localhost`, no
 * IPv6 literal and no IP address, because a client's browser should be asked for a company's logo, not for something on a network.
 *
 * Anything refused becomes `null` and the page falls back to the monogram, so this never throws and never explains itself to a client.
 */
export function brandLogoUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!url || url.length > MAX_URL) return null;
  if (/[\s<>"'\\]/.test(url)) return null;
  const authority = /^https:\/\/([^/?#]*)(?:[/?#]|$)/i.exec(url)?.[1] ?? '';
  if (!authority || authority.includes('@')) return null;
  const host = authority.split(':')[0] ?? '';
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(host)) return null;
  if (/^\d+(?:\.\d+)+$/.test(host)) return null;
  return url;
}

/** One or two letters for the monogram: the first letter of the first two words, or the first two letters of a single word. */
export function brandInitials(name: unknown): string {
  const words = String(name ?? '')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return '';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/**
 * The brand to show with one report: the business profile's name and logo where the company filled them in, the company's name in
 * the app otherwise. A company that has filled in nothing still gets a name, the one it signed up with.
 */
export function sharedBrand(o: { orgName?: unknown; businessName?: unknown; logoUrl?: unknown }): SharedBrand {
  const trim = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME) : '');
  const name = trim(o.businessName) || trim(o.orgName);
  return { name, logoUrl: brandLogoUrl(o.logoUrl), initials: brandInitials(name) };
}
