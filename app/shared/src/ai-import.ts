// AI visibility wave 2 (W2-A, 2026-10-23, WAVE2_CONTRACTS.md §5, MARKET_RND.md §3.1 gap 10): the owner's own AI exports, uploaded in the
// app and stored in the n8n Data Table `seo_ai_imports`, which the engine reads (W2-E3). Neither report has an API, so a CSV is the only way in.
//
//  * Bing Webmaster Tools, "AI Performance": citations of the site's pages in Copilot and Bing's AI answers, per page, per grounding query
//    and per day. For Copilot this is the ground truth (our own Bing summary check rarely sees one).
//  * Google Search Console, the Performance report exported as CSV: the Queries, Pages or Dates file of an export the owner filtered to
//    AI features (AI Mode / AI Overviews) where Search Console offers that filter.
//
// ASSUMPTIONS (the exact headers of both exports could not be checked against a real file from this account; columns are matched by name
// with the synonyms below, in English, and a file whose columns cannot be told apart is refused with the columns it has):
//  * Bing: a date column ("Date" / "Day"), a page column ("URL" / "Page" / "Cited page"), a query column ("Grounding query" / "Query"),
//    a citations column ("Citations" / "Total citations"), optional impressions and clicks. One file may hold any subset of page / query / date.
//  * Search Console: "Top queries" or "Top pages" or "Date" plus "Clicks" and "Impressions" (CTR and Position are ignored). A Queries or
//    Pages file has no date: the rows are stored on the last day of the period the owner exported (asked in the upload form).

import { importDate, parseCsv } from './link-import';

export type AiImportSource = 'bing_ai' | 'gsc_ai';
export const AI_IMPORT_SOURCE_LABEL: Record<AiImportSource, string> = { bing_ai: 'Bing Webmaster Tools, AI Performance', gsc_ai: 'Search Console, AI features' };
export const AI_IMPORT_MAX_ROWS = 20000;

/** seo_ai_imports exactly as the contract names it (WAVE2_CONTRACTS.md §5): the app creates the table with these columns when missing. */
export const AI_IMPORT_COLUMNS = [
  { name: 'site_id', type: 'string' },
  { name: 'domain', type: 'string' },
  { name: 'source', type: 'string' },
  { name: 'day', type: 'string' },
  { name: 'url', type: 'string' },
  { name: 'query', type: 'string' },
  { name: 'impressions', type: 'number' },
  { name: 'citations', type: 'number' },
  { name: 'clicks', type: 'number' },
  { name: 'file_name', type: 'string' },
  { name: 'imported_at', type: 'string' },
  { name: 'import_id', type: 'string' },
] as const;

export interface AiImportRowInput { day: string; url: string; query: string; impressions: number; citations: number; clicks: number }
export interface AiImportResult {
  source: AiImportSource;
  /** what was recognised, in words */
  label: string;
  rows: AiImportRowInput[];
  /** lines read without the header */
  total: number;
  /** blank lines, lines with no figure, over the row limit */
  skipped: number;
  days: { from: string; to: string };
  totals: { impressions: number; citations: number; clicks: number };
}

const norm = (h: string) => h.toLowerCase().replace(/^﻿/, '').replace(/[^a-z]+/g, ' ').trim();
const COLS = {
  day: ['date', 'day', 'dates'],
  url: ['url', 'urls', 'page', 'pages', 'top pages', 'cited page', 'cited pages', 'page url', 'landing page'],
  query: ['query', 'queries', 'top queries', 'grounding query', 'grounding queries', 'keyword', 'search query'],
  citations: ['citations', 'total citations', 'citation count', 'cited', 'times cited'],
  impressions: ['impressions', 'total impressions'],
  clicks: ['clicks', 'total clicks'],
} as const;
const hostOf = (u: string) => (u.match(/^https?:\/\/(?:[^@/?#]*@)?([^/?#:]+)/i)?.[1] ?? '').toLowerCase().replace(/^www\./, '');
const toNum = (v: string) => {
  const s = String(v ?? '').trim().replace(/[\s,]/g, '').replace(/%$/, '');
  if (!s || s === '-') return 0;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

/**
 * Parses an export. `source` is what the owner chose ('' = recognise it: a citations column means Bing). `periodEnd` (YYYY-MM-DD) dates the
 * rows of a file without a date column. Throws an Error with a customer sentence for a file that cannot be read or is for another site.
 */
export function parseAiImport(text: string, domain: string, opts: { source?: AiImportSource | ''; periodEnd?: string } = {}): AiImportResult {
  const lines = parseCsv(String(text ?? ''));
  if (lines.length < 2) throw new Error('The file has no rows. Export the report as CSV and upload that file.');
  // Search Console puts a title line or two above some exports: the header is the first line naming a known column
  const hi = lines.findIndex((l) => l.some((c) => Object.values(COLS).some((names) => (names as readonly string[]).includes(norm(c)))));
  if (hi < 0) throw new Error(`No column of an AI report was found. The first line reads: ${lines[0].slice(0, 6).join(', ')}`);
  const head = lines[hi].map(norm);
  const at = (names: readonly string[]) => head.findIndex((h) => names.includes(h));
  const ix = { day: at(COLS.day), url: at(COLS.url), query: at(COLS.query), citations: at(COLS.citations), impressions: at(COLS.impressions), clicks: at(COLS.clicks) };
  const source: AiImportSource = opts.source || (ix.citations >= 0 ? 'bing_ai' : 'gsc_ai');
  if (source === 'bing_ai' && ix.citations < 0 && ix.impressions < 0 && ix.clicks < 0) throw new Error('This file has no Citations column. Export the AI Performance report from Bing Webmaster Tools.');
  if (source === 'gsc_ai' && ix.impressions < 0 && ix.clicks < 0) throw new Error('This file has no Clicks or Impressions column. Export the Performance report from Search Console as CSV.');
  if (ix.day < 0 && ix.url < 0 && ix.query < 0) throw new Error('The file has figures but no date, page or query column, so the rows cannot be told apart.');
  const fallbackDay = opts.periodEnd && /^\d{4}-\d{2}-\d{2}$/.test(opts.periodEnd) ? opts.periodEnd : new Date().toISOString().slice(0, 10);
  const d = String(domain).toLowerCase().replace(/^www\./, '');

  // a file for another website is refused: most of its page URLs must be on this domain (or a subdomain)
  if (ix.url >= 0) {
    const hosts = lines.slice(hi + 1).map((l) => hostOf(String(l[ix.url] ?? '').trim())).filter(Boolean);
    const own = hosts.filter((h) => h === d || h.endsWith('.' + d)).length;
    if (hosts.length && own / hosts.length < 0.5) {
      const counts = new Map<string, number>();
      for (const h of hosts) if (!(h === d || h.endsWith('.' + d))) counts.set(h, (counts.get(h) ?? 0) + 1);
      const other = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'another website';
      throw new Error(`This export is for ${other}, not ${d}. Export the report of ${d} and upload that file.`);
    }
  }

  const merged = new Map<string, AiImportRowInput>();
  let skipped = 0, total = 0;
  for (const l of lines.slice(hi + 1)) {
    total++;
    const get = (j: number) => (j >= 0 ? String(l[j] ?? '').trim() : '');
    const url = get(ix.url);
    if (url && !/^https?:\/\//i.test(url)) { skipped++; continue; }
    if (url && !(hostOf(url) === d || hostOf(url).endsWith('.' + d))) { skipped++; continue; }
    const day = ix.day >= 0 ? importDate(get(ix.day)) : fallbackDay;
    if (!day) { skipped++; continue; }
    const citations = toNum(get(ix.citations)), impressions = toNum(get(ix.impressions)), clicks = toNum(get(ix.clicks));
    if ([citations, impressions, clicks].some((x) => Number.isNaN(x)) || citations + impressions + clicks === 0) { skipped++; continue; }
    const query = get(ix.query).slice(0, 300);
    const key = [day, url, query.toLowerCase()].join('\u0001');
    const prev = merged.get(key);
    if (prev) { prev.citations += citations; prev.impressions += impressions; prev.clicks += clicks; continue; }
    if (merged.size >= AI_IMPORT_MAX_ROWS) { skipped++; continue; }
    merged.set(key, { day, url: url.slice(0, 500), query, impressions, citations, clicks });
  }
  const rows = [...merged.values()];
  if (!rows.length) throw new Error('No row of this file could be used: every line was blank, had no figure, or named a page of another website.');
  const days = rows.map((r) => r.day).sort();
  const sum = (k: 'impressions' | 'citations' | 'clicks') => rows.reduce((t, r) => t + r[k], 0);
  const kind = ix.url >= 0 ? 'pages' : ix.query >= 0 ? 'queries' : 'days';
  return {
    source,
    label: `${AI_IMPORT_SOURCE_LABEL[source]} (${kind}${ix.day >= 0 ? ' by day' : `, period ending ${fallbackDay}`})`,
    rows,
    total,
    skipped,
    days: { from: days[0], to: days[days.length - 1] },
    totals: { impressions: sum('impressions'), citations: sum('citations'), clicks: sum('clicks') },
  };
}

/** What the upload answers the app (and the audit log keeps, without the rows). */
export interface AiImportSummary { source: AiImportSource; label: string; rows: number; total: number; skipped: number; days: { from: string; to: string }; totals: { impressions: number; citations: number; clicks: number }; importedAt: string; importId: string }
