// Client report 2026-11-11 (devaicon.com, Technical health page): "I have requested indexing for nearly all the pages through the tool's
// indexing feature, but it still shows it as a major issue, as it has not been auto-checked in the pipeline after 28 Oct."
//
// The technical page read its "not indexed by Google" finding from the last audit only (28 Oct: 15 of 23 inspected pages), and no audit
// had run since (the audit runs in the website's monthly cycle). Meanwhile the daily index check read those pages every day: on 11 Nov 8
// of the 15 were in Google, 3 were left out on purpose, 4 were still out, and 9 of the 10 pages the client asked Google about were in.
//
// This kit makes that one finding LIVE: it reads the audit's own pages again from the daily index check (like for like, the engine's own
// threshold, GSC_Audit_Findings.js: 20% or more not indexed = High, some = Medium, none = resolved), says what the client asked Google and
// what Google did since, and gives the website-wide figure in the Indexing page's own sentence (indexInSearchLine, one number everywhere).
// Pure: the server reads the rows (services/technicalLive.ts), the page renders the result.

import { indexDayText, indexInSearchLine, samePageUrl, type IndexPage } from './indexing';

/** The audit findings this kit follows: the engine's High "A large share of important pages is not indexed by Google" and its Medium
 *  "Some sampled pages are not indexed by Google" (v5/code/GSC_Audit_Findings.js). */
export const INDEX_FINDING_RE = /\bnot indexed by google\b/i;
export const isIndexFinding = (f: { title?: string; key?: string }): boolean => INDEX_FINDING_RE.test(String(f.title ?? '')) || INDEX_FINDING_RE.test(String(f.key ?? ''));

/** The engine's threshold for the High finding (GSC_Audit_Findings.js: `share >= 20`). */
export const INDEX_FINDING_HIGH_SHARE = 20;

/** One page the audit inspected in Search Console (the site_audit report's `search_console.index_coverage.pages`). */
export interface AuditInspectedPage {
  url: string;
  /** Google's answer at the audit: true in the index, false not, null no answer */
  indexed: boolean | null;
  /** Google's reason at the audit ("URL is unknown to Google", ...) */
  coverage: string;
}

export type LivePageNow = 'indexed' | 'left_out' | 'not_indexed' | 'not_checked';

export interface FindingLivePage {
  url: string;
  path: string;
  /** Google's reason at the audit */
  then: string;
  now: LivePageNow;
  /** Google's reason today, in its own words ('' = none) */
  nowCoverage: string;
  /** when the daily index check last read this page ('' = never) */
  checkedAt: string;
  /** when the client said they asked Google to read it again ('' = never), and when Google read it after that ('' = not yet) */
  askedAt: string;
  readAfterAskAt: string;
}

export interface FindingLive {
  source: 'index_check';
  /** 'resolved': every page of the audit's list is in Google or left out on purpose; 'improving': fewer are out than at the audit;
   *  'unchanged': as many as at the audit; 'partial': the audit stored only some of its pages, so only those are read again */
  state: 'resolved' | 'improving' | 'unchanged' | 'partial';
  /** the engine's rule applied to today's reading of the audit's pages ('' = nothing left out by mistake). Equal to the audit's severity
   *  while it still holds; never invented for a 'partial' reading (null = keep the audit's) */
  severity: 'High' | 'Medium' | '' | null;
  /** the newest reading of the daily index check over these pages (or the website), '' = none */
  checkedAt: string;
  /** the audit's figure, for the "at the audit" line */
  audit: { notIndexed: number; inspected: number; at: string };
  /** today's reading of the audit's not-indexed pages */
  now: { indexed: number; leftOut: number; notIndexed: number; notChecked: number; of: number };
  /** pages the client said they asked Google about (any page of the website, last 45 days) */
  asked: { pages: number; inGoogle: number; readNotIn: number; waiting: number; lastAskedAt: string };
  /** the website-wide figure of the daily index check (the Indexing page's sentence), null when the check has no reading */
  site: { indexed: number; shouldBe: number; notIndexed: number; newWaiting: number; notChecked: number; line: string } | null;
  /** one sentence for the finding row */
  headline: string;
  /** the details, each a whole sentence */
  lines: string[];
  /** the audit's not-indexed pages, today */
  pages: FindingLivePage[];
}

const pl = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
const pathOf = (u: string) => String(u ?? '').replace(/^https?:\/\/[^/]+/i, '') || '/';
const max = (xs: string[]) => xs.filter(Boolean).sort().slice(-1)[0] ?? '';

/** What the daily index check says about one page today. */
export function livePageNow(p: IndexPage | undefined): LivePageNow {
  if (!p) return 'not_checked';
  if (p.state === 'indexed') return 'indexed';
  if (p.action === 'leave_out') return 'left_out';
  if (p.state === 'not_indexed' || p.state === 'excluded') return 'not_indexed';
  return 'not_checked';
}

/** The engine's severity rule (GSC_Audit_Findings.js) over a reading: pages left out on purpose are not "important pages". */
export function indexFindingSeverity(notIndexed: number, of: number): 'High' | 'Medium' | '' {
  if (!notIndexed || of <= 0) return '';
  return Math.round((notIndexed / of) * 100) >= INDEX_FINDING_HIGH_SHARE ? 'High' : 'Medium';
}

/** The line every live finding carries: asking Google does not index a page at once (Google's own documentation on Request indexing). */
export const ASK_GOOGLE_TRUTH =
  'Asking Google to read a page again does not put it in the index at once: Google reads it first, often within a few days, and then decides. This finding follows the daily index check, so it updates by itself.';

export interface LiveIndexInput {
  finding: { severity: string; affectedCount: number };
  /** the audit's inspected page count (the stored finding's `checked`), used when the report's page list is not available */
  inspected: number;
  auditedAt: string;
  /** the audit's inspected pages from its report ([] = not available) */
  auditPages: readonly AuditInspectedPage[];
  /** the finding's stored sample (at most 5 addresses), the fallback when the report's list is not available */
  sampleUrls: readonly string[];
  /** the daily index check's pages (indexPageOf of its rows) */
  indexPages: readonly IndexPage[];
  /** the Indexing page's totals (buildIndexingData), null = no reading */
  site: { indexed: number; shouldBe: number; known: number; notChecked: number; newWaiting: number; checkedAt: string } | null;
  domain?: string;
}

/**
 * The live reading of the audit's "not indexed by Google" finding. Null when the daily index check has nothing to say (no reading at all):
 * the page then keeps the audit's finding as it was.
 */
export function liveIndexFinding(input: LiveIndexInput): FindingLive | null {
  const { indexPages } = input;
  if (!indexPages.length && !input.site) return null;
  const find = (url: string) => indexPages.find((p) => samePageUrl(p.url, url));
  const full = input.auditPages.length > 0;
  // the audit's not-indexed pages: the report's whole list, else the finding's stored sample
  const listed = full
    ? input.auditPages.filter((p) => p.indexed === false).map((p) => ({ url: p.url, then: p.coverage }))
    : input.sampleUrls.map((u) => ({ url: String(u).trim().split(/\s/)[0], then: '' })).filter((x) => /^https?:\/\//i.test(x.url));
  const pages: FindingLivePage[] = listed.map((x) => {
    const p = find(x.url);
    return {
      url: x.url,
      path: pathOf(x.url),
      then: x.then,
      now: livePageNow(p),
      nowCoverage: p?.coverage ?? '',
      checkedAt: p?.checkedAt ?? '',
      askedAt: p?.askedGoogleAt ?? '',
      readAfterAskAt: p?.googleReadAfterAskAt ?? '',
    };
  });
  const count = (k: LivePageNow) => pages.filter((p) => p.now === k).length;
  const now = { indexed: count('indexed'), leftOut: count('left_out'), notIndexed: count('not_indexed'), notChecked: count('not_checked'), of: pages.length };
  const auditNot = full ? listed.length : Math.max(input.finding.affectedCount, listed.length);
  const inspected = full ? input.auditPages.filter((p) => p.indexed !== null).length : input.inspected;

  // like for like: the audit's own inspected pages read again, minus the ones left out on purpose (and those the check has not read)
  let severity: FindingLive['severity'] = null;
  let state: FindingLive['state'] = 'partial';
  if (full && pages.length) {
    const auditIndexedStill = input.auditPages.filter((p) => p.indexed === true).length;   // in Google at the audit (a drop shows on the Indexing page)
    const of = auditIndexedStill + now.indexed + now.notIndexed;
    severity = indexFindingSeverity(now.notIndexed, of);
    state = now.notIndexed === 0 && now.notChecked === 0 ? 'resolved' : now.notIndexed < auditNot ? 'improving' : 'unchanged';
    if (state === 'resolved') severity = '';
  }

  // what the client asked Google about (the whole website, the Indexing page's "you asked Google" list)
  const askedPages = indexPages.filter((p) => p.askedGoogleAt);
  const inGoogle = askedPages.filter((p) => p.state === 'indexed').length;
  const readNotIn = askedPages.filter((p) => p.state !== 'indexed' && p.googleReadAfterAskAt && p.googleReadAfterAskAt >= p.askedGoogleAt).length;
  const asked = { pages: askedPages.length, inGoogle, readNotIn, waiting: askedPages.length - inGoogle - readNotIn, lastAskedAt: max(askedPages.map((p) => p.askedGoogleAt)) };

  const site = input.site && input.site.shouldBe + input.site.known > 0
    ? {
        indexed: input.site.indexed,
        shouldBe: input.site.shouldBe,
        notIndexed: Math.max(0, input.site.shouldBe - input.site.indexed),
        newWaiting: input.site.newWaiting,
        notChecked: input.site.notChecked,
        line: indexInSearchLine({ indexed: input.site.indexed, shouldBe: input.site.shouldBe, known: input.site.known, notChecked: input.site.notChecked }, input.domain),
      }
    : null;
  const checkedAt = max([...pages.map((p) => p.checkedAt), input.site?.checkedAt ?? '']);
  const day = checkedAt ? ` (${indexDayText(checkedAt)})` : '';
  const auditDay = indexDayText(input.auditedAt);

  let headline: string;
  if (state === 'resolved') headline = `Checked daily${day}: every page this audit found outside Google is in Google's index now, or left out on purpose.`;
  else if (state === 'partial')
    headline = pages.length
      ? `Checked daily${day}: of the ${pl(pages.length, 'page')} this audit stored, ${now.indexed} ${now.indexed === 1 ? 'is' : 'are'} in Google's index now.`
      : `Checked daily${day}: ${site ? site.line : 'see the Indexing page for every page'}.`;
  else
    headline = `Checked daily${day}: ${now.notIndexed} of the ${pl(auditNot, 'page')} this audit found outside Google ${now.notIndexed === 1 ? 'is' : 'are'} still not in Google's index`
      + (now.indexed || now.leftOut ? `; ${[now.indexed ? `${now.indexed} ${now.indexed === 1 ? 'is' : 'are'} in Google now` : '', now.leftOut ? `${now.leftOut} ${now.leftOut === 1 ? 'is' : 'are'} left out on purpose` : ''].filter(Boolean).join(' and ')}.` : '.');

  const lines: string[] = [];
  lines.push(`At the audit of ${auditDay}: ${auditNot} of ${pl(inspected, 'page')} inspected in Search Console were not in Google's index.`);
  if (now.leftOut) lines.push(`${pl(now.leftOut, 'page')} of that list ${now.leftOut === 1 ? 'is' : 'are'} fine out of search (a policy page, or a page that moved to another address), so ${now.leftOut === 1 ? 'it no longer counts' : 'they no longer count'}.`);
  if (now.notChecked) lines.push(`${pl(now.notChecked, 'page')} of that list ${now.notChecked === 1 ? 'has' : 'have'} not been read by the daily index check yet.`);
  if (asked.pages) {
    const parts = [`${asked.inGoogle} ${asked.inGoogle === 1 ? 'is' : 'are'} in Google now`];
    if (asked.readNotIn) parts.push(`${asked.readNotIn} ${asked.readNotIn === 1 ? 'was' : 'were'} read by Google and left out for now`);
    if (asked.waiting) parts.push(`${asked.waiting} ${asked.waiting === 1 ? 'is' : 'are'} waiting for Google to read ${asked.waiting === 1 ? 'it' : 'them'} (last asked ${indexDayText(asked.lastAskedAt)})`);
    lines.push(`You asked Google to read ${pl(asked.pages, 'page')} again: ${parts.join(', ')}.`);
  }
  if (site) {
    const newer = site.newWaiting > 0 && site.notIndexed > 0
      ? ` ${Math.min(site.newWaiting, site.notIndexed)} of the ${site.notIndexed} still out ${Math.min(site.newWaiting, site.notIndexed) === 1 ? 'is a new page' : 'are new pages'}: Google usually takes a few days to a few weeks to index a new page.`
      : '';
    lines.push(`Across the website: ${site.line}.${newer}`);
  }
  lines.push(ASK_GOOGLE_TRUTH);
  return { source: 'index_check', state, severity, checkedAt, audit: { notIndexed: auditNot, inspected, at: input.auditedAt }, now, asked, site, headline, lines, pages };
}

/** The severity the page ranks and labels a finding by: the live one when it holds a reading, else the audit's. */
export function effectiveSeverity(f: { severity: string; live?: FindingLive | null }): string {
  const v = f.live?.severity;
  return v == null || v === '' ? f.severity : v;
}
/** A live finding the daily index check shows resolved: not open any more, whatever the audit said. */
export const liveResolved = (f: { live?: FindingLive | null }): boolean => f.live?.state === 'resolved';
