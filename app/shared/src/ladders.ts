import type { LadderOverlap, LadderPageState, LadderStatus, PageSearchConsole, RankPoint } from './data';

// Keyword ladders on the Pipeline page (PIPELINE_FEATURE_SPEC.md): when two keywords are the same search (rule R1, one search one
// page, §5.4) and which state a ladder is in (§6.2-6.4). Pure functions: the server builds the ladder cards with them, the tool
// forms warn with them.

// ---------- overlap ----------
// Same word rules as the ladder research (n8n/seo-agent/v5/code/Ladder_Pool.js): lower case, one-letter words and stop words out,
// a light stem. Place names stay in: "erp dubai" and "erp abu dhabi" are different searches.
const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'with', 'by', 'at', 'from', 'near', 'me', 'vs', 'is', 'are', 'what', 'how', 'best', 'top', 'your', 'my']);
const stem = (t: string) =>
  t
    .replace(/ies$/, 'y')
    .replace(/(ing|ed|es|s)$/, '')
    .replace(/[^a-z0-9]/g, '');

/** The words that make a search: "E-invoicing in the UAE" -> ["invoic", "uae"]. */
export function keywordTokens(s: string): string[] {
  const out: string[] = [];
  for (const t of String(s || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)) {
    if (t.length <= 1 || STOP.has(t)) continue;
    const w = stem(t);
    if (w && !out.includes(w)) out.push(w);
  }
  return out;
}

/** Share of words two keyword token lists have in common (Jaccard), 0 when either is empty. */
function similarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const sb = new Set(b);
  const common = a.filter((t) => sb.has(t)).length;
  return common / (a.length + b.length - common);
}

export const OVERLAP_MIN = 0.75;

/** Two keywords are the same search when their words are the same, or at least 75% the same. */
export function keywordsOverlap(a: string, b: string): boolean {
  return similarity(keywordTokens(a), keywordTokens(b)) >= OVERLAP_MIN;
}

/** For each ladder: the other ladders it overlaps, with its own keywords (main or page) that overlap any keyword of the other one. */
export function ladderOverlaps(ladders: { id: string; head: string; keywords: string[] }[]): Map<string, LadderOverlap[]> {
  const words = ladders.map((l) => {
    const seen = new Set<string>();
    return [l.head, ...l.keywords]
      .filter((k) => String(k || '').trim())
      .map((k) => ({ keyword: k, tokens: keywordTokens(k) }))
      .filter((k) => {
        const sig = [...k.tokens].sort().join(' ');
        if (!sig || seen.has(sig)) return false;
        seen.add(sig);
        return true;
      });
  });
  const out = new Map<string, LadderOverlap[]>(ladders.map((l) => [l.id, []]));
  ladders.forEach((a, i) =>
    ladders.forEach((b, j) => {
      if (i === j || a.id === b.id) return;
      const shared = words[i].filter((x) => words[j].some((y) => similarity(x.tokens, y.tokens) >= OVERLAP_MIN)).map((x) => x.keyword);
      if (shared.length) out.get(a.id)!.push({ ladderId: b.id, head: b.head, keywords: shared });
    }),
  );
  return out;
}

// ---------- status ----------

const WEEK = 7 * 864e5;
/** checks that ran (-1 = the check failed: check again, not "does not rank"), oldest first */
const valid = (h: RankPoint[]) => h.filter((p) => p.position >= 0).sort((a, b) => a.checkedAt.localeCompare(b.checkedAt));

/** Won: the main keyword in the top 3 in each of the last 4 checks. */
export function isWon(headHistory: RankPoint[]): boolean {
  const last = valid(headHistory).slice(-4);
  return last.length === 4 && last.every((p) => p.position >= 1 && p.position <= 3);
}

/** Whether a page moved up within the last `weeks` weeks: its latest position against the one at the start of that window. */
export function improvedWithin(history: RankPoint[], weeks: number, now = Date.now()): boolean {
  const h = valid(history);
  if (h.length < 2) return false;
  const since = new Date(now - weeks * WEEK).toISOString();
  const before = h.filter((p) => p.checkedAt <= since);
  const base = before.length ? before[before.length - 1] : h[0];
  const latest = h[h.length - 1];
  if (latest === base || latest.position <= 0) return false;
  return base.position === 0 || latest.position < base.position;
}

export interface StatusPage {
  state: LadderPageState;
  writtenAt: string | null;
  publishedAt: string | null;
  history: RankPoint[];
  /** R111: the written draft did not pass the quality check */
  needsFix?: boolean;
}

/** Stuck: pages are live, the first went live 8+ weeks ago, and none of them moved up over the last 8 weeks. */
export function isStuck(pages: StatusPage[], now = Date.now()): boolean {
  const live = pages.filter((p) => p.state === 'published');
  const dates = live.map((p) => p.publishedAt || p.writtenAt).filter((d): d is string => !!d && !Number.isNaN(Date.parse(d)));
  if (!live.length || !dates.length) return false;
  const first = Math.min(...dates.map((d) => Date.parse(d)));
  if (now - first < 8 * WEEK) return false;
  return !live.some((p) => improvedWithin(p.history, 8, now));
}

export const daysSince = (iso: string | null | undefined, now = Date.now()) => (iso && !Number.isNaN(Date.parse(iso)) ? Math.max(0, Math.floor((now - Date.parse(iso)) / 864e5)) : 0);

export interface LadderStatusInput {
  /** the ladder's row in seo_ladder_settings ('' or undefined: no row, i.e. active) */
  settingsStatus?: string;
  /** beyond the website's limit of active ladders (by priority) */
  queued?: boolean;
  pages: StatusPage[];
  headHistory: RankPoint[];
  /** pages of the whole website written and not published yet */
  siteWaiting: number;
  /** the pile-up guard: no new pages while this many wait */
  maxWaiting: number;
  now?: number;
}

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

/** The ladder's status and one plain line about it (rules in the LadderStatus doc comment, shared/src/data.ts). */
export function ladderStatus(i: LadderStatusInput): { status: LadderStatus; statusText: string } {
  const now = i.now ?? Date.now();
  const st = String(i.settingsStatus || '');
  const total = i.pages.length;
  const live = i.pages.filter((p) => p.state === 'published').length;
  const waiting = i.pages.filter((p) => p.state === 'waiting');
  const written = i.pages.filter((p) => p.state === 'waiting' || p.state === 'writing' || p.state === 'published').length;
  const toWrite = i.pages.some((p) => p.state === 'planned' || p.state === 'gated');
  const head = valid(i.headHistory).pop()?.position ?? null;

  if (st === 'paused' || st === 'archived')
    return { status: 'paused', statusText: `${st === 'archived' ? 'Archived' : 'Paused'}: no new pages are written; positions are still checked every week.` };
  if (st === 'won' || isWon(i.headHistory))
    return { status: 'won', statusText: 'Won: the main keyword has been in the top 3 for 4 checks in a row. No more pages; positions are still checked every week.' };
  if (st === 'queued' || i.queued) return { status: 'queued', statusText: 'Queued: it starts when a ladder ahead of it is won, fully written or paused.' };

  const oldest = Math.max(0, ...waiting.map((p) => daysSince(p.writtenAt, now)));
  // R111: a written page whose draft did not pass the quality check is not "waiting to be published" - it needs a fix and a new run
  const fixing = waiting.filter((p) => p.needsFix);
  if (waiting.length && oldest >= 7 && fixing.length)
    return {
      status: 'needs_you',
      statusText: fixing.length === waiting.length
        ? `${plural(fixing.length, 'page')} written ${fixing.length === 1 ? 'needs' : 'need'} your edits before ${fixing.length === 1 ? 'it' : 'they'} can be published: the draft did not pass the quality check, so finish it by hand (each bracket its report lists) and publish it.`
        : `${plural(fixing.length, 'page')} written ${fixing.length === 1 ? 'needs' : 'need'} your edits by hand (the draft did not pass the quality check) and ${waiting.length - fixing.length} ${waiting.length - fixing.length === 1 ? 'is' : 'are'} waiting to be published.`,
    };
  if (waiting.length && oldest >= 7)
    return {
      status: 'needs_you',
      statusText: `${plural(waiting.length, 'page')} ${waiting.length === 1 ? 'is' : 'are'} waiting to be published (the oldest for ${oldest} days): nothing ranks before ${waiting.length === 1 ? 'it is' : 'they are'} live.`,
    };
  if (i.maxWaiting > 0 && i.siteWaiting >= i.maxWaiting && (waiting.length || toWrite))
    return { status: 'needs_you', statusText: `${plural(i.siteWaiting, 'page')} of this website wait to be published: publish them so the ladder can continue.` };
  if (st === 'stuck' || isStuck(i.pages, now))
    return { status: 'stuck', statusText: 'No live page has moved up in 8 weeks: links from other sites, a refresh of the best page or more internal links help.' };
  if (!written) return { status: 'planning', statusText: `Planned: ${plural(total, 'page')}, none written yet.` };
  if (!live) return { status: 'writing', statusText: `${written} of ${plural(total, 'page')} written, none live yet.` };
  return {
    status: 'climbing',
    statusText: `${live} of ${plural(total, 'page')} live; the main keyword is ${head == null ? 'not checked yet' : head > 0 ? `at #${head}` : 'not in the top 50 yet'}.`,
  };
}

// ---------- how the main keyword is checked, and what Search Console says (prod 2026-11-10, devaicon.com) ----------
// The client saw "Not in the top 50" while Google showed them the page on page one. Our reading was right (one neutral desktop check in the
// ladder's country), but it counted a check taken before the page existed, hid Search Console's page figures and never said how we check.

const isoMs = (v: unknown): number => (typeof v === 'string' && v && !Number.isNaN(Date.parse(v)) ? Date.parse(v) : NaN);

/** The history with every reading taken before the page went live marked (kept for the chart; never counted). Pure. */
export function markBeforePublish(history: RankPoint[], publishedAt: string | null | undefined): RankPoint[] {
  const at = isoMs(publishedAt);
  if (Number.isNaN(at)) return history;
  return history.map((h) => (isoMs(h.checkedAt) < at ? { ...h, beforePublish: true } : h));
}

/** The readings that count: a check that worked (0 = not in the top 50) and was taken while the page was live. */
export const countedReadings = (history: RankPoint[]): RankPoint[] => history.filter((h) => h.position >= 0 && !h.beforePublish);

/** Latest, previous and best position from the readings that count (null when none). */
export function countedPositions(history: RankPoint[]): { latest: number | null; previous: number | null; best: number | null } {
  const ok = countedReadings(history);
  const pos = ok.filter((h) => h.position > 0).map((h) => h.position);
  return { latest: ok.length ? ok[ok.length - 1].position : null, previous: ok.length > 1 ? ok[ok.length - 2].position : null, best: pos.length ? Math.min(...pos) : null };
}

/** Google's own address in each market the app offers (the rank check reads Google as searched from that country). */
export const GOOGLE_DOMAINS: Record<string, string> = {
  US: 'google.com', GB: 'google.co.uk', CA: 'google.ca', AU: 'google.com.au', NZ: 'google.co.nz', IE: 'google.ie', PK: 'google.com.pk',
  IN: 'google.co.in', AE: 'google.ae', SA: 'google.com.sa', SG: 'google.com.sg', ZA: 'google.co.za', DE: 'google.de', FR: 'google.fr',
  ES: 'google.es', IT: 'google.it', NL: 'google.nl', BR: 'google.com.br', MX: 'google.com.mx',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "8 Nov 2026" (UTC; the same text on the server and in every browser) */
export const dayText = (iso: string): string => {
  const ms = isoMs(iso);
  if (Number.isNaN(ms)) return '';
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const oneDecimal = (x: number) => String(Math.round(x * 10) / 10);

/**
 * The note beside the main keyword's position. How we check (Google in the ladder's country, desktop, not signed in, the day), that a
 * person's own searches are personalised, a last check from before the page went live, and, when Search Console shows the page near the
 * top while our check found it nowhere in the top 50, both in one sentence. '' when it was never checked. Pure.
 */
export function rankCheckNote(i: {
  head: string;
  /** the ladder's market: its name and ISO code (empty: not known) */
  country: string;
  iso: string;
  /** the readings of the main keyword (desktop), oldest first, each marked when taken before the page went live */
  history: RankPoint[];
  /** the main page's live date ('' / null: not live, or not a page of this ladder) */
  publishedAt?: string | null;
  /** the main page's own Search Console figures */
  gsc?: PageSearchConsole | null;
}): string {
  const worked = i.history.filter((h) => h.position >= 0);
  if (!worked.length) return '';
  const counted = countedReadings(i.history);
  const last = counted[counted.length - 1] ?? null;
  const domain = GOOGLE_DOMAINS[String(i.iso || '').toUpperCase()] ?? '';
  const where = i.country ? `Google ${i.country}${domain ? ` (${domain})` : ''}` : 'Google';
  if (!last) {
    const before = worked[worked.length - 1];
    return `Our last check, on ${dayText(before.checkedAt)}, was taken before the page went live${i.publishedAt ? ` on ${dayText(i.publishedAt)}` : ''}, so it does not count; the next weekly check on ${where}, desktop, not signed in, is the first one that does.`;
  }
  const how = `We check ${where}, desktop, not signed in; last checked ${dayText(last.checkedAt)}. Your own searches are personalised (your place, your history, your account), so they can show something else.`;
  const g = i.gsc;
  if (last.position === 0 && g && g.impressions > 0 && g.position != null && g.position > 0 && g.position <= 10)
    return `Search Console shows this page at about #${oneDecimal(g.position)} on average (${g.impressions} ${g.impressions === 1 ? 'time' : 'times'} shown, every search and place, last 28 days), while our check of "${i.head}" did not find it in the top 50, because Search Console counts every search and place where Google showed the page and our check reads this one search in one place. ${how}`;
  return how;
}

/** A host-agnostic page key: no scheme, no www., no query or fragment, no trailing slash. */
const pageKey = (u: string) => String(u || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');

/**
 * One page's own Search Console figures (the page inventory's 28-day row), its addresses added up (its live address and the address it
 * moved to or from); position averaged over the impressions. null when none of the addresses was measured. Pure.
 */
export function pageSearchConsole(urls: readonly string[], rows: readonly { url?: unknown; impressions?: unknown; clicks?: unknown; position?: unknown; measured_at?: unknown }[]): PageSearchConsole | null {
  const keys = new Set(urls.map(pageKey).filter(Boolean));
  if (!keys.size) return null;
  const seen = new Set<string>();
  let impressions = 0, clicks = 0, weighted = 0, measuredAt = '';
  const used: string[] = [];
  for (const r of rows) {
    const u = String(r.url ?? '');
    const k = pageKey(u);
    const at = String(r.measured_at ?? '');
    if (!keys.has(k) || seen.has(k) || !at) continue;
    seen.add(k);
    used.push(u);
    const imp = Math.max(0, Number(r.impressions) || 0);
    const pos = Number(r.position) || 0;
    impressions += imp;
    clicks += Math.max(0, Number(r.clicks) || 0);
    if (imp > 0 && pos > 0) weighted += imp * pos;
    if (at > measuredAt) measuredAt = at;
  }
  if (!used.length) return null;
  return { impressions, clicks, position: impressions > 0 && weighted > 0 ? Math.round((weighted / impressions) * 10) / 10 : null, measuredAt, urls: used };
}
