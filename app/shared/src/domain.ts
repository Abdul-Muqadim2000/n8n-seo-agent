// Same rules as Normalize Input in the n8n workflow (cleanDomain / domainOk), so the app never accepts a domain the agent rejects.

export function cleanDomain(v: unknown): string {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '');
}

/** Public hostnames only: no IP literals, no localhost / internal names. */
export function domainOk(d: string): boolean {
  if (!d || d.length > 253) return false;
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(d)) return false;
  if (/^\[?[0-9a-f:]+\]?$/.test(d) && d.includes(':')) return false;
  if (/(^|\.)(localhost|local|internal|localdomain|home|lan|corp|intranet|test|example|invalid)$/.test(d)) return false;
  return /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(xn--[a-z0-9-]+|[a-z]{2,24})$/.test(d);
}

/** The id the n8n workflows use for a site (Admin Action, Site Row): `site_` + domain with every non-alphanumeric run as `-`. */
export function n8nSiteId(domain: string): string {
  return 'site_' + cleanDomain(domain).replace(/[^a-z0-9]+/g, '-');
}

/**
 * Two DIFFERENT domains the engine would store under one site id: `foo.co.uk` and `foo-co.uk` both become `site_foo-co-uk`. The engine's
 * id scheme is shared by every workflow, so the app keeps the second one out (sites.ts) and checks the domain of every engine row it
 * reads or writes by site id (engineSite.ts).
 */
export function engineIdCollides(a: string, b: string): boolean {
  const x = cleanDomain(a);
  const y = cleanDomain(b);
  return !!x && !!y && x !== y && n8nSiteId(x) === n8nSiteId(y);
}

/** True when an engine row keyed by the site id really is this domain's (its `domain` column names it). An empty domain is not proof. */
export function engineRowIsDomain(rowDomain: unknown, domain: string): boolean {
  const r = cleanDomain(rowDomain);
  return !!r && r === cleanDomain(domain);
}

// Hosting platforms where every subdomain is a different website (the engine's rule, v5/code/_link_kit.js PLATFORM).
const HOSTING_PLATFORM =
  /\.(blogspot\.[a-z.]+|wordpress\.com|tumblr\.com|medium\.com|substack\.com|github\.io|gitlab\.io|wixsite\.com|weebly\.com|webflow\.io|squarespace\.com|netlify\.app|vercel\.app|pages\.dev|herokuapp\.com|web\.app|firebaseapp\.com|blogger\.com|livejournal\.com|over-blog\.com|jimdosite\.com|site123\.me|webnode\.[a-z]+|strikingly\.com|carrd\.co|notion\.site|super\.site|hashnode\.dev|dev\.to|translate\.goog)$/;

/**
 * The registrable domain of a host, by the engine's rule (v5/code/_link_kit.js `regDomain` / `refKey`): the last two labels, or three
 * under a two-letter country code with a common second level (`shop.example.co.uk` -> `example.co.uk`). On a hosting platform every
 * subdomain is its own website, so the host is kept whole (`a.wixsite.com`).
 */
export function registrableDomain(host: string): string {
  const h = cleanDomain(host).replace(/\.$/, '');
  if (HOSTING_PLATFORM.test(h)) return h;
  const p = h.split('.').filter(Boolean);
  if (p.length <= 2) return p.join('.');
  const sld = /^(co|com|net|org|gov|edu|ac|ltd|plc|sch|nic|or|ne|go|mil|biz|info)$/;
  return sld.test(p[p.length - 2]) && p[p.length - 1].length === 2 ? p.slice(-3).join('.') : p.slice(-2).join('.');
}

/** True when the URL's host is the domain or one of its subdomains (host-agnostic about www.). */
export function urlOnDomain(url: string, domain: string): boolean {
  const m = String(url || '').match(/^https?:\/\/(?:[^@/?#]*@)?([^/?#:]+)/i);
  if (!m) return false;
  const h = m[1].toLowerCase().replace(/^www\./, '');
  const d = cleanDomain(domain);
  return h === d || h.endsWith('.' + d);
}

/** True when the URL is on the domain itself (www or not), not a subdomain, the rule Normalize Input uses for an existing page. */
export function urlOnHost(url: string, domain: string): boolean {
  const m = String(url || '').match(/^https?:\/\/(?:[^@/?#]*@)?([^/?#:]+)/i);
  return !!m && m[1].toLowerCase().replace(/^www\./, '') === cleanDomain(domain);
}

/** Splits "a.com, b.com\nc.com" or an array into clean, valid, unique domains. */
export function parseDomainList(v: unknown, max = 3, exclude?: string): string[] {
  const parts = Array.isArray(v) ? v : String(v ?? '').split(/[\s,;]+/);
  const out: string[] = [];
  for (const p of parts) {
    const d = cleanDomain(p);
    if (d && domainOk(d) && d !== exclude && !out.includes(d)) out.push(d);
    if (out.length >= max) break;
  }
  return out;
}
