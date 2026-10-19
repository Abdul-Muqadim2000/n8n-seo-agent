// G29 (2026-10-13, system review FIX_PLAN.md; criterion 3.11): where a number came from, over what period, and how big the sample
// was, as structured fields beside the value, rendered as a short note or a tooltip rather than cluttering the figure.
// The vocabulary is the engine's (`n8n/seo-agent/v5/code/_lineage.js`): the two must say the same words, so a figure reads the same
// in the Monday e-mail and on the dashboard. A modelled or uncalibrated number must say so; where the lineage is genuinely unknown
// the note reads "source not recorded", never a borrowed source.

export const LINEAGE_MISSING = 'source not recorded';

/** where numbers come from; the label is what a customer reads */
export const LINEAGE_SOURCES = {
  gsc: 'Google Search Console',
  gsc_history: 'your stored Search Console history',
  inspection: 'Search Console URL Inspection',
  gsc_links: 'your Search Console link export',
  ga4: 'Google Analytics 4',
  serp: 'a live Google results page',
  kwdata: 'Google Ads keyword data (through DataForSEO)',
  backlink_index: 'the DataForSEO backlink index',
  bing: 'Bing Webmaster Tools',
  link_graph: 'the Common Crawl web graph',
  ahrefs: 'the Ahrefs Domain Rating API',
  trends: 'Google Trends',
  ai_engines: 'the AI assistants themselves',
  ai_db: 'the DataForSEO AI-answer database',
  own_check: 'our own fetch of the page',
  crawl: 'our crawl of your website',
  crux: 'the Chrome User Experience Report',
  pagespeed: 'Google PageSpeed Insights (Lighthouse)',
  rdap: 'the domain registry (RDAP, else WHOIS)',
  gbp: 'Google Business Profile',
  wikidata: 'Wikidata',
  web: 'public web pages we read',
  you: 'what you told us',
  model: 'a model on top of measured data',
  none: LINEAGE_MISSING,
} as const;

export type LineageSource = keyof typeof LINEAGE_SOURCES;

/** how the figure was arrived at, the same words G6 / G8 / G28 already use */
export const LINEAGE_BASIS = {
  measured: 'measured',
  calibrated: 'calibrated against your own measured data',
  modelled: 'modelled, not measured',
  one_sample: 'one sample, not an average',
  estimated: 'estimated',
  reported: 'reported by the source',
  unknown: LINEAGE_MISSING,
} as const;

export type LineageBasis = keyof typeof LINEAGE_BASIS;

export interface Lineage {
  /** what the figure is called where a customer sees it */
  figure: string;
  source: LineageSource;
  sourceLabel: string;
  /** the date range the figure covers, or "" when there is none to state */
  period: string;
  /** how big the sample behind it was, or "" */
  sample: string;
  basis: LineageBasis;
  basisLabel: string;
  /** anything else worth one clause (what the source cannot see, which property, ...) */
  note: string;
}

export interface LineageInput {
  period?: string | null;
  sample?: string | null;
  basis?: LineageBasis;
  note?: string | null;
}

const s = (v: unknown): string => (v == null ? '' : String(v));

export function lineage(figure: string, source: LineageSource, o: LineageInput = {}): Lineage {
  const src: LineageSource = source in LINEAGE_SOURCES ? source : 'none';
  const basis: LineageBasis = o.basis && o.basis in LINEAGE_BASIS ? o.basis : src === 'none' ? 'unknown' : 'measured';
  return {
    figure,
    source: src,
    sourceLabel: LINEAGE_SOURCES[src],
    period: s(o.period),
    sample: s(o.sample),
    basis,
    basisLabel: LINEAGE_BASIS[basis],
    note: s(o.note),
  };
}

/** a figure whose source nobody recorded: say exactly that instead of inventing one */
export const lineageUnknown = (figure: string, why: string): Lineage => ({
  figure,
  source: 'none',
  sourceLabel: LINEAGE_MISSING,
  period: '',
  sample: '',
  basis: 'unknown',
  basisLabel: LINEAGE_MISSING,
  note: why,
});

/** "Google Search Console · 2026-09-15 to 2026-10-12 (28 days) · 1,240 impressions · measured" */
export function lineageNote(l: Lineage | null | undefined): string {
  if (!l) return LINEAGE_MISSING;
  const parts = [l.sourceLabel, l.period, l.sample, l.basisLabel === l.sourceLabel ? '' : l.basisLabel, l.note];
  return parts.filter(Boolean).join(' · ');
}

/** "2026-09-15 to 2026-10-12 (28 days)", the period a figure covers, never an empty claim */
export function lineagePeriod(start: string | null | undefined, end: string | null | undefined): string {
  const a = s(start).slice(0, 10);
  const b = s(end).slice(0, 10);
  if (!a && !b) return '';
  if (!a || !b) return `to ${b || a}`;
  const days = Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5) + 1;
  return Number.isFinite(days) && days > 0 ? `${a} to ${b} (${days} day${days === 1 ? '' : 's'})` : `${a} to ${b}`;
}

export const lineageAsOf = (at: string | null | undefined): string => (s(at).slice(0, 10) ? `as of ${s(at).slice(0, 10)}` : '');

export function lineageSample(n: number | null | undefined, unit: string): string {
  if (n == null || !Number.isFinite(Number(n))) return '';
  return `${Number(n).toLocaleString('en-GB')} ${unit}`.trim();
}
