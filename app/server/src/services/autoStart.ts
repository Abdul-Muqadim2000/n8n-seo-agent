import { and, asc, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import {
  cleanDomain,
  isWithinReach,
  keywordsOverlap,
  LADDER_SITE_ROW,
  ladderInput,
  ladderOverlapsOf,
  normKeyword,
  RECOMMENDATIONS_MAX_AGE_DAYS,
  type LadderCard,
  type LadderKeywords,
  type LadderSettingsRow,
  type PipelineData,
  type RecommendedKeyword,
  type RecommendedKeywords,
  type SiteAutomation,
} from '@seo/shared';
import type { OrgAccess } from '../auth/access';
import { db, schema } from '../db';
import type { OrgRow, RunRow, SiteRow, UserRow } from '../db/schema';
import { HttpError } from '../lib/errors';
import { rows } from '../n8n/client';
import { recentChecks } from './keywordCheckStore';
import { recommendedKeywords } from './keywordChecks';
import { pipelineData } from './pipeline';
import { createRun } from './runs';

// "Choose keywords for me" (PIPELINE_FEATURE_SPEC.md §7): for a website that switched it on (the '_site' row's auto_start), when fewer
// Auto ladders are being written than its limit, start the next recommended keyword that is easy or reachable for the website — on
// the company owner's behalf, through the same run path as a person (createRun: the locked budget check, the platform's daily
// ceiling). Off unless the server runs with AUTO_START_LADDERS=true (index.ts timer, every 6 hours). Never automatic: going over the
// budget (402 → skipped), a keyword a ladder covers, a keyword started automatically before, more than one start a week per website.

export const AUTO_START = {
  everyMs: 6 * 3600_000,
  /** the first pass after the server starts */
  firstAfterMs: 5 * 60_000,
  /** at most one automatic start per website in this many days */
  minDaysBetween: 7,
} as const;

export interface AutoStartState {
  automation: SiteAutomation;
  cards: Pick<LadderCard, 'id' | 'mode' | 'status' | 'counts'>[];
  /** every ladder of the website with its main and page keywords */
  ladders: LadderKeywords[];
  recommended: RecommendedKeywords;
  /** keywords started automatically before for this website (any outcome) */
  previous: { keyword: string; at: string }[];
  /** a ladder run of the website is going (being planned) */
  ladderRunActive: boolean;
  /** the pile-up guard holds: pages wait to be published, so nothing new is written */
  pileup: boolean;
  trackingPaused: boolean;
  /** topic fit of keywords the website checked recently (normalised keyword → 0 / 1 / 2 / null) */
  fitOf: Map<string, number | null>;
  now: number;
}

export type AutoStartDecision = { start: RecommendedKeyword; reason: string } | { start: null; reason: string };

const skip = (reason: string): AutoStartDecision => ({ start: null, reason });
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** Auto ladders that still have pages to write and are not paused, won or queued (the ones the weekly posts go to). */
export function activeAutoLadders(cards: AutoStartState['cards']): number {
  return cards.filter((c) => c.mode === 'auto' && !['paused', 'won', 'queued'].includes(c.status) && c.counts.planned > 0).length;
}

/** Whether to start a ladder now, and which keyword. Pure: every input is in `s`. */
export function autoStartDecision(s: AutoStartState): AutoStartDecision {
  if (!s.automation.autoStartLadders) return skip('"Choose keywords for me" is off');
  if (s.trackingPaused) return skip('the pipeline is paused');
  if (s.ladderRunActive) return skip('a keyword ladder is being planned right now');
  const last = s.previous.map((p) => Date.parse(p.at)).filter(Number.isFinite).sort((a, b) => b - a)[0];
  if (last && s.now - last < AUTO_START.minDaysBetween * 864e5) return skip(`a ladder was started automatically less than ${AUTO_START.minDaysBetween} days ago`);
  if (s.pileup) return skip('pages wait to be published: nothing new is started until they are live');
  const active = activeAutoLadders(s.cards);
  if (active >= s.automation.maxActiveLadders) return skip(`${plural(active, 'Auto ladder')} with pages to write (the limit is ${s.automation.maxActiveLadders})`);
  const r = s.recommended;
  if (!r.reportId) return skip('no keyword research for this website yet');
  if (r.ageDays == null || r.ageDays > RECOMMENDATIONS_MAX_AGE_DAYS) return skip(`the keyword research is older than ${RECOMMENDATIONS_MAX_AGE_DAYS} days`);
  const startedBefore = (k: string) => s.previous.some((p) => normKeyword(p.keyword) === normKeyword(k) || keywordsOverlap(p.keyword, k));
  const pick = r.keywords.find(
    (k) =>
      isWithinReach(k.difficultyForYou) &&
      k.planType !== 'none' &&
      // the ladders as they are now (the list may be older than the newest ladder)
      !ladderOverlapsOf(k.keyword, s.ladders).length &&
      s.fitOf.get(normKeyword(k.keyword)) !== 0 &&
      !startedBefore(k.keyword),
  );
  if (!pick) return skip('no recommended keyword is easy or reachable for the website and free of overlaps');
  return { start: pick, reason: `${pick.label || 'within reach'}: the first recommended keyword no ladder covers` };
}

// ---------------- the job ----------------

export interface AutoStartDeps {
  pipeline: (org: OrgRow, site: SiteRow) => Promise<PipelineData>;
  recommended: (org: OrgRow, site: SiteRow) => Promise<RecommendedKeywords>;
  previous: (siteId: string) => Promise<{ keyword: string; at: string }[]>;
  fits: (siteId: string) => Promise<Map<string, number | null>>;
  owner: (orgId: string) => Promise<UserRow | null>;
  start: (a: OrgAccess, input: ReturnType<typeof ladderInput.parse>) => Promise<RunRow>;
}

const defaultDeps: AutoStartDeps = {
  pipeline: pipelineData,
  recommended: (org, site) => recommendedKeywords(org, site),
  previous: async (siteId) => {
    const list = await db
      .select({ keyword: sql<string | null>`${schema.runs.input}->>'keyword'`, at: schema.runs.createdAt })
      .from(schema.runs)
      .where(and(eq(schema.runs.siteId, siteId), eq(schema.runs.mode, 'ladder'), sql`${schema.runs.input}->>'autoStart' = 'true'`))
      .orderBy(desc(schema.runs.createdAt))
      .limit(200);
    return list.map((r) => ({ keyword: r.keyword ?? '', at: r.at.toISOString() }));
  },
  fits: async (siteId) => {
    const m = new Map<string, number | null>();
    for (const c of await recentChecks(siteId, 30)) {
      const k = normKeyword(c.keyword);
      const f = (c.result as { fit?: unknown }).fit;
      if (!m.has(k)) m.set(k, f === 0 || f === 1 || f === 2 ? f : null);
    }
    return m;
  },
  owner: async (orgId) => {
    const r = await db
      .select({ u: schema.users })
      .from(schema.memberships)
      .innerJoin(schema.users, eq(schema.memberships.userId, schema.users.id))
      .where(and(eq(schema.memberships.orgId, orgId), eq(schema.memberships.role, 'owner')))
      .orderBy(asc(schema.memberships.createdAt))
      .limit(1);
    return r[0]?.u ?? null;
  },
  start: (a, input) => createRun(a, input, { startedBy: 'auto' }),
};

/** One website: decide, and start the ladder run on the owner's behalf. */
export async function autoStartForSite(org: OrgRow, site: SiteRow, deps: AutoStartDeps = defaultDeps, now = Date.now()): Promise<{ runId: string | null; keyword: string | null; reason: string }> {
  if (org.disabled) return { runId: null, keyword: null, reason: 'the company is disabled' };
  if (!site.verifiedAt) return { runId: null, keyword: null, reason: 'the website is not verified' };
  const [data, recommended, previous, fitOf] = await Promise.all([deps.pipeline(org, site), deps.recommended(org, site), deps.previous(site.id), deps.fits(site.id)]);
  const decision = autoStartDecision({
    automation: data.automation,
    cards: data.ladderCards,
    ladders: data.ladders.map((l) => ({ id: l.id, head: l.head, keywords: l.keywords ?? l.planned.map((p) => p.keyword) })),
    recommended,
    previous,
    ladderRunActive: data.activeRuns.some((r) => r.mode === 'ladder'),
    pileup: !!data.queue.paused,
    trackingPaused: data.tracking.status === 'paused' || site.trackingStatus === 'paused',
    fitOf,
    now,
  });
  if (!decision.start) return { runId: null, keyword: null, reason: decision.reason };
  const owner = await deps.owner(org.id);
  if (!owner) return { runId: null, keyword: decision.start.keyword, reason: 'the company has no owner' };
  const parsed = ladderInput.safeParse({
    mode: 'ladder',
    siteId: site.id,
    keyword: decision.start.keyword,
    country: site.country,
    business: site.business.slice(0, 500),
    customers: site.customers.slice(0, 300),
    businessFacts: site.businessFacts.slice(0, 2000),
    goal: site.goal,
    tone: site.tone,
    cta: site.cta.slice(0, 200),
    pagesNow: 1,
    emailCopy: false,
  });
  if (!parsed.success) return { runId: null, keyword: decision.start.keyword, reason: `the website's settings are incomplete (${parsed.error.issues[0]?.path.join('.') || 'input'})` };
  try {
    const run = await deps.start({ user: owner, org, role: 'owner' }, parsed.data);
    return { runId: run.id, keyword: decision.start.keyword, reason: run.status === 'failed' ? `the SEO engine did not accept it: ${run.error ?? ''}` : decision.reason };
  } catch (err) {
    if (err instanceof HttpError && (err.statusCode === 402 || err.statusCode === 429)) return { runId: null, keyword: decision.start.keyword, reason: err.statusCode === 402 ? 'it would go over the monthly budget' : err.message };
    throw err;
  }
}

/** Every verified website whose '_site' settings row has auto_start on. */
export async function runAutoStart(log: { info: (o: object, m: string) => void; warn: (o: object, m: string) => void }): Promise<number> {
  const on = await rows<LadderSettingsRow>('ladderSettings', {
    filters: [
      { columnName: 'ladder_id', condition: 'eq', value: LADDER_SITE_ROW },
      { columnName: 'auto_start', condition: 'eq', value: true },
    ],
    max: 1000,
    fresh: true,
  }).catch(() => [] as LadderSettingsRow[]);
  const domains = [...new Set(on.map((r) => cleanDomain(r.domain)).filter(Boolean))];
  if (!domains.length) return 0;
  const sites = await db.query.sites.findMany({ where: and(isNotNull(schema.sites.verifiedAt), inArray(schema.sites.domain, domains)) });
  let started = 0;
  for (const site of sites) {
    try {
      const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, site.orgId) });
      if (!org) continue;
      const r = await autoStartForSite(org, site);
      if (r.runId) started++;
      log.info({ site: site.domain, keyword: r.keyword, run: r.runId, reason: r.reason }, r.runId ? 'ladder started automatically' : 'no ladder started automatically');
    } catch (err) {
      log.warn({ site: site.domain, err: String(err) }, 'automatic ladder start failed');
    }
  }
  return started;
}
