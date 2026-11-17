// CR17-C (client report 2026-11-17, devaicon.com, C3 + F6): two honest numbers instead of one that hides the worse one. The audit score
// is Technical health: what our crawl can verify on the site (crawlability, on-page, content, speed, security, images, AI readiness). Whether
// Google shows the pages is Pages in Google, from the daily index check (buildIndexingData: the same figures as the Indexing page). The
// market leaders keep the two apart too (Semrush Site Health and Ahrefs Health Score are crawl scores; Screaming Frog and Sitebulb show
// Google's index state as its own report). Pure: every screen, the reports and the server read these, nobody keeps a copy.
import { INDEX_POPULATION_LINE, indexInSearchLine, type IndexingData } from './indexing';

/** The audit score's name on every screen, report and e-mail (a technical audit). */
export const TECHNICAL_HEALTH_LABEL = 'Technical health';
/** A full SEO report's score covers more than the crawl (authority, content review): its own name. */
export const SEO_HEALTH_LABEL = 'SEO health';
/** The line under the Technical health figure. */
export const TECHNICAL_HEALTH_LINE = 'What our crawl found on your site. Whether Google shows your pages is under Pages in Google.';
/** The score's name for an audit of this report type ('full_report' or the technical 'site_audit'). */
export const healthLabelFor = (reportType?: string | null): string => (reportType === 'full_report' ? SEO_HEALTH_LABEL : TECHNICAL_HEALTH_LABEL);

export type TechnicalGrade = 'Excellent' | 'Good' | 'Needs improvement' | 'Poor';
/**
 * The grade words of an audit score (the engine's bands, unchanged: 90 / 75 / 60), always shown as "(technical)" so "Excellent" is never
 * read as "Google shows my pages". tone: the score's colour.
 */
export function technicalGrade(score: number | null | undefined): { grade: TechnicalGrade; label: string; tone: 'good' | 'warning' | 'critical' } | null {
  if (score == null || !Number.isFinite(Number(score))) return null;
  const x = Number(score);
  const grade: TechnicalGrade = x >= 90 ? 'Excellent' : x >= 75 ? 'Good' : x >= 60 ? 'Needs improvement' : 'Poor';
  return { grade, label: `${grade} (technical)`, tone: x >= 75 ? 'good' : x >= 60 ? 'warning' : 'critical' };
}

export const PAGES_IN_GOOGLE_LABEL = 'Pages in Google';
/** Bands on the EXISTING pages' share (new pages are named, never red: Google's normal delay is a few days to a few weeks). */
export const PAGES_IN_GOOGLE_BANDS = { good: 90, critical: 70 } as const;

export type PagesInGoogleTone = 'good' | 'warning' | 'critical' | 'waiting' | 'unknown';
export interface PagesInGoogle {
  /** pages in Google among the pages that should be in Google (both lanes) */
  inGoogle: number;
  shouldBe: number;
  pct: number | null;
  existing: { inGoogle: number; shouldBe: number; pct: number | null };
  newPages: { inGoogle: number; shouldBe: number; waiting: number };
  notChecked: number;
  tone: PagesInGoogleTone;
  /** the figure's title, e.g. "Google shows 15 of your 31 existing pages" */
  headline: string;
  /** the Indexing page's own sentence plus the new pages waiting */
  detail: string;
  /** which pages are counted, in one sentence (INDEX_POPULATION_LINE) */
  population: string;
  checkedAt: string | null;
}

const pg = (x: number) => `${x.toLocaleString('en-US')} page${x === 1 ? '' : 's'}`;
const pctOf = (a: number, b: number): number | null => (b > 0 ? Math.round((100 * a) / b) : null);

/**
 * Pages in Google, from the Indexing page's data (one computation: buildIndexingData's totals and lanes, which count "in Google" among
 * the pages that should be in Google only, a moved address once through its new address). null: the daily index check has no reading.
 * Tone on the existing pages' share: >= 90% good, 70-89% warning, < 70% critical; only new pages: waiting.
 */
export function pagesInGoogle(d: Pick<IndexingData, 'status' | 'totals' | 'lanes' | 'checkedAt'> | null | undefined, domain = 'your website'): PagesInGoogle | null {
  if (!d || d.status !== 'ok' || !d.totals || !d.lanes) return null;
  const t = d.totals;
  const ex = d.lanes.existing;
  const nw = d.lanes.new;
  const waiting = Math.max(0, nw.shouldBe - nw.indexed);
  const exPct = pctOf(ex.indexed, ex.shouldBe);
  const tone: PagesInGoogleTone =
    exPct != null ? (exPct >= PAGES_IN_GOOGLE_BANDS.good ? 'good' : exPct < PAGES_IN_GOOGLE_BANDS.critical ? 'critical' : 'warning') : nw.shouldBe > 0 ? 'waiting' : 'unknown';
  const notChecked = t.unknown + t.errors;
  const headline =
    ex.shouldBe > 0
      ? tone === 'good'
        ? `Google shows ${ex.indexed.toLocaleString('en-US')} of your ${pg(ex.shouldBe)}`
        : `Google shows only ${ex.indexed.toLocaleString('en-US')} of your ${ex.shouldBe.toLocaleString('en-US')} existing pages`
      : nw.shouldBe > 0
        ? `${pg(nw.shouldBe)} waiting for Google`
        : 'Not checked yet';
  const newLine = waiting > 0 ? ` ${pg(waiting)} ${waiting === 1 ? 'is' : 'are'} new and waiting for Google (it usually takes a few days to a few weeks).` : '';
  return {
    inGoogle: t.indexed,
    shouldBe: t.shouldBe,
    pct: pctOf(t.indexed, t.shouldBe),
    existing: { inGoogle: ex.indexed, shouldBe: ex.shouldBe, pct: exPct },
    newPages: { inGoogle: nw.indexed, shouldBe: nw.shouldBe, waiting },
    notChecked,
    tone,
    headline,
    detail: `${indexInSearchLine({ indexed: t.indexed, shouldBe: t.shouldBe, known: t.known, notChecked }, domain)}.${newLine}`,
    population: INDEX_POPULATION_LINE,
    checkedAt: d.checkedAt,
  };
}

/**
 * The Overview hero's first line when Pages in Google is critical (it leads, instead of a lone "Excellent"); null otherwise.
 * technicalScore: the newest audit's score (null: no audit).
 */
export function pagesInGoogleLead(p: PagesInGoogle | null, technicalScore: number | null | undefined): string | null {
  if (!p || p.tone !== 'critical') return null;
  const sound = technicalScore != null && Number(technicalScore) >= 75;
  return `${sound ? 'Technically sound, but Google' : 'Google'} shows only ${p.existing.inGoogle.toLocaleString('en-US')} of your ${p.existing.shouldBe.toLocaleString('en-US')} existing pages`;
}

/**
 * CR17-C (client report 2026-11-17 F6): the Search Console Pages report a client uploads with the monthly check-in counts EVERY address Google
 * knows for the property (http / www forms, old 404 and redirected addresses, job pages). It is shown as Google's count, labelled with this
 * line, never compared with Pages in Google and never subtracted from it. (AlertsPage, package D's hunks, shows it.)
 */
export const GOOGLE_ALL_ADDRESSES_LABEL = 'Google\'s count of every address it knows';
export const GOOGLE_ALL_ADDRESSES_LINE =
  'Google\'s own count from the Search Console Pages report you uploaded: every address it knows for your website, old, redirected and duplicate addresses included. It is a different list from Pages in Google, which counts only the pages that should be in Google.';
