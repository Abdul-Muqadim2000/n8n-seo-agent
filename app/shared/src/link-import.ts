// Uploaded link lists (v4.10, n8n/seo-agent/BACKLINKS_SPEC.md §3.2): the Search Console Links report exports ("Latest links", "More sample
// links", "Top linking sites") and the backlink CSVs of other tools (Ahrefs Webmaster Tools is free for a verified site; Semrush, Moz,
// Majestic exports work too). The Search Console API has no links; an upload is the only way to bring Google's own sample in.
// Columns are found by their content, not their names (Search Console names them in the account's language): the linking-page column holds
// URLs on other sites, the target column URLs on this site, a date column dates, a site column bare domains. The Backlink Monitor merges the
// latest upload of each kind into its ledger and checks the pages itself.

export type LinkImportKind = 'gsc_latest' | 'gsc_sample' | 'gsc_sites' | 'csv';
export interface LinkImportRowInput {
  ref_domain: string;
  from_url: string;
  to_url: string;
  anchor: string;
  links: number;
  last_crawled: string;
}
export interface LinkImportResult {
  source: LinkImportKind;
  /** a plain-language name of what was recognised */
  label: string;
  rows: LinkImportRowInput[];
  /** lines read (without the header) */
  total: number;
  /** linking sites in the kept rows */
  domains: number;
  /** lines left out: own pages, not a URL, more than PAGES_PER_DOMAIN pages of one site, over MAX_ROWS */
  skipped: number;
}

export const LINK_IMPORT_MAX_ROWS = 20000;
/** the monitor checks a few pages per linking site; more add nothing but load */
export const LINK_IMPORT_PAGES_PER_DOMAIN = 5;

/** RFC 4180 CSV with the delimiter detected (comma, semicolon or tab), a BOM and CRLF tolerated. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const first = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = [',', ';', '\t'].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0]![0];
  const out: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim() !== '')) out.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) out.push(row);
  return out;
}

const URL_RE = /^https?:\/\/[^\s/]+/i;
const DOMAIN_RE = /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i;
const hostOf = (u: string) => (u.match(/^https?:\/\/(?:[^@/?#]*@)?([^/?#:]+)/i)?.[1] ?? '').toLowerCase().replace(/^www\./, '');
const sameSite = (host: string, domain: string) => !!host && (host === domain || host.endsWith('.' + domain));
const MONTHS: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

/** A date in the forms the exports use ("2026-09-28", "Sep 28, 2026", "28 Sep 2026", "28/09/2026") as YYYY-MM-DD, else ''. */
export function importDate(v: string): string {
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^([A-Za-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4})$/);
  if (m && MONTHS[m[1]!.toLowerCase()]) return `${m[3]}-${MONTHS[m[1]!.toLowerCase()]}-${m[2]!.padStart(2, '0')}`;
  m = s.match(/^(\d{1,2}) ([A-Za-z]{3})[a-z]*\.? (\d{4})$/);
  if (m && MONTHS[m[2]!.toLowerCase()]) return `${m[3]}-${MONTHS[m[2]!.toLowerCase()]}-${m[1]!.padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (m) return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  return '';
}

/**
 * Reads an uploaded link list for `domain` (the site's bare domain). Throws an Error with a message for the person when the file is not a
 * list of links to the site (e.g. the "Top linked pages" table, which lists only your own pages).
 */
export function parseLinkImport(text: string, domain: string): LinkImportResult {
  const site = domain.toLowerCase().replace(/^www\./, '');
  const grid = parseCsv(text);
  if (grid.length < 2) throw new Error('The file has no rows. Export the table as CSV (Search Console: Links → Export external links → Latest links → Download CSV).');
  const header = grid[0]!.map((h) => h.trim());
  const body = grid.slice(1);
  const cols = header.map((h, i) => {
    const vals = body.slice(0, 500).map((r) => (r[i] ?? '').trim()).filter(Boolean);
    const n = vals.length || 1;
    const urls = vals.filter((v) => URL_RE.test(v));
    return {
      i,
      h: h.toLowerCase(),
      url: urls.length / n,
      own: urls.length ? urls.filter((u) => sameSite(hostOf(u), site)).length / urls.length : 0,
      date: vals.filter((v) => importDate(v)).length / n,
      dom: vals.filter((v) => DOMAIN_RE.test(v.replace(/^www\./i, ''))).length / n,
      num: vals.filter((v) => /^[\d.,\s]+$/.test(v)).length / n,
    };
  });
  const byName = (re: RegExp, ok: (c: (typeof cols)[number]) => boolean) => cols.find((c) => re.test(c.h) && ok(c));
  const linking =
    byName(/linking page|referring page|source url|url from|from url|backlink url|referring url|linking url|^url$|^page url$/, (c) => c.url >= 0.5 && c.own < 0.5) ??
    [...cols].filter((c) => c.url >= 0.6 && c.own < 0.5).sort((a, b) => b.url - a.url)[0];
  const target = byName(/target|url to|to url|destination|linked page/, (c) => c.url >= 0.5 && c.own >= 0.5) ?? cols.find((c) => c !== linking && c.url >= 0.6 && c.own >= 0.6);
  const anchorCol = cols.find((c) => /anchor|link text|linking text/.test(c.h));
  const dateCol = byName(/last crawled|last seen|first seen|date|crawled/, (c) => c.date >= 0.5) ?? cols.find((c) => c.date >= 0.8);
  const rowsOut: LinkImportRowInput[] = [];
  let skipped = 0;
  let source: LinkImportKind;
  let label: string;
  if (linking) {
    const tool = !!anchorCol || !!target || cols.some((c) => /domain rating|\bdr\b|authority|trust flow|nofollow|first seen/.test(c.h));
    source = tool ? 'csv' : dateCol ? 'gsc_latest' : 'gsc_sample';
    label = source === 'csv' ? 'a backlink export (linking pages with targets / anchors)' : source === 'gsc_latest' ? 'Search Console "Latest links"' : 'Search Console "More sample links"';
    for (const r of body) {
      const from = (r[linking.i] ?? '').trim();
      const host = hostOf(from);
      if (!URL_RE.test(from) || !host || sameSite(host, site)) {
        skipped++;
        continue;
      }
      const to = target ? (r[target.i] ?? '').trim() : '';
      rowsOut.push({ ref_domain: host, from_url: from.slice(0, 500), to_url: sameSite(hostOf(to), site) ? to.slice(0, 500) : '', anchor: anchorCol ? (r[anchorCol.i] ?? '').trim().slice(0, 160) : '', links: 0, last_crawled: dateCol ? importDate(r[dateCol.i] ?? '') : '' });
    }
  } else {
    const siteCol = byName(/site|domain|referring domain|root domain/, (c) => c.dom >= 0.5) ?? cols.find((c) => c.dom >= 0.7);
    if (!siteCol) {
      const ownPages = cols.find((c) => c.url >= 0.6 && c.own >= 0.6);
      throw new Error(
        ownPages
          ? 'This table lists your own pages ("Top linked pages"), not the sites that link to you. Export "Latest links", "More sample links" or "Top linking sites" instead.'
          : 'No column of linking pages or linking sites was found. Upload a CSV with the pages (URLs) that link to ' + site + '.',
      );
    }
    source = 'gsc_sites';
    label = 'Search Console "Top linking sites"';
    const countCol = cols.find((c) => c !== siteCol && c.num >= 0.8);
    for (const r of body) {
      const d = (r[siteCol.i] ?? '').trim().toLowerCase().replace(/^www\./, '');
      if (!DOMAIN_RE.test(d) || sameSite(d, site)) {
        skipped++;
        continue;
      }
      rowsOut.push({ ref_domain: d, from_url: '', to_url: '', anchor: '', links: countCol ? Number(String(r[countCol.i] ?? '').replace(/[^\d.]/g, '')) || 0 : 0, last_crawled: '' });
    }
  }
  // a few pages per linking site, newest first; at most LINK_IMPORT_MAX_ROWS
  const perDomain = new Map<string, number>();
  const kept: LinkImportRowInput[] = [];
  const seen = new Set<string>();
  for (const r of [...rowsOut].sort((a, b) => b.last_crawled.localeCompare(a.last_crawled))) {
    const key = r.from_url || r.ref_domain;
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    const n = perDomain.get(r.ref_domain) ?? 0;
    if (n >= LINK_IMPORT_PAGES_PER_DOMAIN || kept.length >= LINK_IMPORT_MAX_ROWS) {
      skipped++;
      continue;
    }
    perDomain.set(r.ref_domain, n + 1);
    kept.push(r);
  }
  if (!kept.length) throw new Error('No link to ' + site + ' from another site was found in the file.');
  return { source, label, rows: kept, total: body.length, domains: perDomain.size, skipped };
}
