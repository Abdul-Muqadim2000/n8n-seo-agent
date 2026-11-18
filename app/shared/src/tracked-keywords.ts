import { LRU } from './ladder-rules';

// CR17-I (client report 2026-11-17, F8): what "tracked keywords" means, once, for every screen and report.
//
// The client read "0 keywords tracked" on the tracking report, "of 7 keywords tracked" on the Overview, and 12 rows in the weekly report's
// "Tracked keywords" table: three screens counted three different lists (the client's own list in the engine, the app's own list plus every
// ladder row, ladder pages plus written pages).
//
// The definition: TRACKED KEYWORDS = the searches we check on Google every week = the keywords of your keyword ladders (their rungs still
// in play) + your own list, after the keyword fit gate, each search counted once (two spellings of one search are one search: LRU.sameSearch).
// Written pages that are not ladder pages are "pages we follow" in Search Console: a separate count, never part of the tracked total.
// The engine's weekly report mirrors the count (v5/code/Site_Report.js "Keywords we check on Google").

/** Ladder rungs that are no longer checked: set aside by the fit gate, stopped by the owner, merged into another page. */
export const UNTRACKED_RUNG_STATUSES: readonly string[] = ['set_aside', 'stopped', 'merged', 'archived'];

export interface TrackedKeywordInput {
  /** the website's own keyword list (Settings > Tracking) */
  own: readonly string[];
  /** the rungs of its keyword ladders */
  ladder: readonly { keyword: string; status?: string | null }[];
  /** written pages that are not ladder pages (their keywords), followed in Search Console */
  pages?: readonly { keyword: string }[];
  /** the keyword fit gate for this website (fitGate with its context): false = not checked; absent = every keyword passes */
  fits?: (keyword: string) => boolean;
}

export interface TrackedKeywordSet {
  /** the searches we check every week, each once, ladder keywords first */
  keywords: { keyword: string; source: 'ladder' | 'own' }[];
  /** how many of them come from the keyword ladders and from your own list (a search in both counts as a ladder search) */
  fromLadders: number;
  fromYourList: number;
  total: number;
  /** written pages we follow in Search Console that are not one of the searches above */
  pagesFollowed: number;
}

const clean = (k: unknown) => String(k ?? '').trim().replace(/\s+/g, ' ');

/** The one definition (see the header). Pure. */
export function trackedKeywordsOf(input: TrackedKeywordInput): TrackedKeywordSet {
  const out: { keyword: string; source: 'ladder' | 'own' }[] = [];
  const has = (k: string) => out.some((x) => x.keyword.toLowerCase() === k.toLowerCase() || LRU.sameSearch(x.keyword, k));
  const fits = input.fits ?? (() => true);
  for (const r of input.ladder) {
    const k = clean(r.keyword);
    if (!k || UNTRACKED_RUNG_STATUSES.includes(String(r.status ?? '').trim().toLowerCase()) || !fits(k) || has(k)) continue;
    out.push({ keyword: k, source: 'ladder' });
  }
  for (const raw of input.own) {
    const k = clean(raw);
    if (!k || !fits(k) || has(k)) continue;
    out.push({ keyword: k, source: 'own' });
  }
  let pagesFollowed = 0;
  const seenPages: string[] = [];
  for (const p of input.pages ?? []) {
    const k = clean(p.keyword);
    if (!k || has(k) || seenPages.some((x) => x.toLowerCase() === k.toLowerCase() || LRU.sameSearch(x, k))) continue;
    seenPages.push(k);
    pagesFollowed++;
  }
  const fromLadders = out.filter((x) => x.source === 'ladder').length;
  return { keywords: out, fromLadders, fromYourList: out.length - fromLadders, total: out.length, pagesFollowed };
}

/** "7 keywords checked on Google: 6 from your keyword ladders, 1 from your list" (or the empty case), the line Settings and reports show. */
export function trackedKeywordsLine(t: Pick<TrackedKeywordSet, 'total' | 'fromLadders' | 'fromYourList'>): string {
  if (!t.total) return 'No keyword checked on Google yet: Search Console queries only';
  const parts = [t.fromLadders ? `${t.fromLadders} from your keyword ladders` : '', t.fromYourList ? `${t.fromYourList} from your list` : ''].filter(Boolean);
  return `${t.total} keyword${t.total === 1 ? '' : 's'} checked on Google${parts.length ? `: ${parts.join(', ')}` : ''}`;
}
