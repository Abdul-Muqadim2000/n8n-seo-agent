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

/** True when the URL's host is the domain or one of its subdomains (host-agnostic about www.). */
export function urlOnDomain(url: string, domain: string): boolean {
  const m = String(url || '').match(/^https?:\/\/(?:[^@/?#]*@)?([^/?#:]+)/i);
  if (!m) return false;
  const h = m[1].toLowerCase().replace(/^www\./, '');
  const d = cleanDomain(domain);
  return h === d || h.endsWith('.' + d);
}

/** True when the URL is on the domain itself (www or not), not a subdomain — the rule Normalize Input uses for an existing page. */
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
