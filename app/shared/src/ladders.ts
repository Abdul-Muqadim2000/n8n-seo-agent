import type { LadderOverlap, LadderPageState, LadderStatus, RankPoint } from './data';

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

/** The words that make a search: "E-invoicing in the UAE" → ["invoic", "uae"]. */
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
    return { status: 'paused', statusText: `${st === 'archived' ? 'Archived' : 'Paused'}: no new pages are written; positions are still checked every Monday.` };
  if (st === 'won' || isWon(i.headHistory))
    return { status: 'won', statusText: 'Won: the main keyword has been in the top 3 for 4 checks in a row. No more pages; positions are still checked every Monday.' };
  if (st === 'queued' || i.queued) return { status: 'queued', statusText: 'Queued: it starts when a ladder ahead of it is won, fully written or paused.' };

  const oldest = Math.max(0, ...waiting.map((p) => daysSince(p.writtenAt, now)));
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
