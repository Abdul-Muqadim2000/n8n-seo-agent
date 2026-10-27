import type { FastifyRequest } from 'fastify';
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, lte, sql } from 'drizzle-orm';
import {
  CHANCE_WORDS,
  DEFAULT_AUTOPILOT_LEVEL,
  ENGINE_TIMEZONE,
  isValidTimezone,
  PROPOSAL_WAIT_HOURS,
  RECOMMENDATIONS_MAX_AGE_DAYS,
  cycleNorm,
  discoverInput,
  estimateRunCost,
  isWithinReach,
  keywordsOverlap,
  ladderInput,
  ladderOverlapsOf,
  normKeyword,
  type AutopilotLevel,
  type KeywordProposalList,
  type KeywordProposalStatus,
  type KeywordProposalView,
  type LadderCard,
  type LadderKeywords,
  type PipelineData,
  type RecommendedKeyword,
  type RecommendedKeywords,
  isoOfCountry,
  marketMismatch,
} from '@seo/shared';
import type { OrgAccess } from '../auth/access';
import { config } from '../config';
import { db, schema } from '../db';
import type { KeywordProposalRow, OrgRow, RunRow, SiteRow, UserRow } from '../db/schema';
import { badRequest, conflict, HttpError, notFound } from '../lib/errors';
import { sendMail } from '../lib/mailer';
import { customerError } from '../lib/customerError';
import { wholeCreditsOfUsd as creditsOfUsd } from './admin/settings';
import { cachedCalibration } from './engineCost';
import { billingContacts } from './invoices';
import { recentChecks } from './keywordCheckStore';
import { assessKeyword, recommendedKeywords } from './keywordChecks';
import { pipelineData } from './pipeline';
import { baseUrlFor, senderFor } from './portalMail';
import { createRun } from './runs';
import { firstOpenTitle, isConfirmNeeded } from './consistency';
import { ownerOf } from './companyOwner';

// The next keyword, proposed by the system (SCHEDULING_KEYWORDS_PLAN.md §5.6 / §5.7, owner decisions D5 / D13 / D14 / D15). "Choose
// keywords for me" became exactly this: when a website has room (fewer active ladders than its limit and none queued: a ladder was won,
// has no pages left, or there is none yet), the best recommended keyword (easy or reachable for the website, a plan, no overlap with its
// ladders, not off topic, never proposed before) becomes a PROPOSAL:
//   * levels 1-2: a suggestion that waits for the client (Start this ladder / Show me others / Not now);
//   * level 3: an announcement that starts PROPOSAL_WAIT_HOURS later unless the client changes or skips it (an e-mail goes out, D15).
// The client may approve it (starts now, chosen_by client_picked), swap it for a typed keyword (keyword check first, then starts as
// client_typed), or skip it (never proposed again for this website; the next one is proposed). A due announcement starts as
// system_announced, on the owner's behalf, through the same run path as a person (createRun: the locked credit check, the platform's
// ceiling) and counts as autopilot spend. Never for a paused or credit-paused website, never above max_active, never while a ladder run is
// going. Idempotent across timer ticks, two servers and restarts by database rules: one open proposal per website, one proposal per
// keyword per website, and a claim (pending -> starting) before any start. AUTO_START_LADDERS is the platform's kill switch.

export const PROPOSALS = {
  /** the timer: due starts every tick, new proposals every `proposeEvery` */
  tickMs: 10 * 60_000,
  firstAfterMs: 2 * 60_000,
  proposeEveryMs: 6 * 3600_000,
  /** a claim older than this with no run is released (a crash between the claim and the start) */
  staleClaimMs: 15 * 60_000,
  /** level 3: a research refresh at most this often (D3's research is the onboarding one) */
  researchEveryDays: RECOMMENDATIONS_MAX_AGE_DAYS,
} as const;

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
/** a keyword whose start failed this many times is not proposed again (a refusal that repeats is not worth another announcement) */
export const MAX_FAILED_STARTS = 2;

/**
 * The keywords not to propose again (pure): every keyword proposed before, except one whose starts only failed (the engine did not take
 * it, so the client never got it), until it failed MAX_FAILED_STARTS times.
 */
export function proposedBeforeOf(rows: { k: string; status: string }[]): string[] {
  const failed = new Map<string, number>();
  const kept = new Set<string>();
  for (const r of rows) {
    const k = cycleNorm(r.k);
    if (r.status === 'failed') failed.set(k, (failed.get(k) ?? 0) + 1);
    else kept.add(k);
  }
  for (const [k, n] of failed) if (n >= MAX_FAILED_STARTS) kept.add(k);
  return [...kept];
}

/** The note of a proposal whose ladder run the engine did not take (the keyword can be proposed again). */
const failedNote = (run: Pick<RunRow, 'error'>) => `The ladder did not start: ${customerError(run.error) ?? 'the SEO engine did not accept it'}. It can be proposed again.`;
const OPEN: KeywordProposalStatus[] = ['pending'];

/** Auto ladders that still have pages to write and are not paused, won or queued (the ones the weekly pages go to). */
export function activeAutoLadders(cards: Pick<LadderCard, 'mode' | 'status' | 'counts'>[]): number {
  return cards.filter((c) => c.mode === 'auto' && !['paused', 'won', 'queued'].includes(c.status) && c.counts.planned > 0).length;
}

export interface ProposalState {
  /** AUTO_START_LADDERS */
  enabled: boolean;
  level: AutopilotLevel;
  maxActive: number;
  cards: Pick<LadderCard, 'id' | 'head' | 'mode' | 'status' | 'counts'>[];
  /** every ladder of the website with its main and page keywords */
  ladders: LadderKeywords[];
  recommended: RecommendedKeywords;
  /** every keyword ever proposed for the website (any status): never proposed twice */
  proposedBefore: string[];
  /** an open proposal exists */
  open: boolean;
  /** a ladder run of the website is going (being planned) */
  ladderRunActive: boolean;
  /** a keyword research run of the website is going */
  researchRunning: boolean;
  /** the website is paused (by a person or by the credit guard), or the company is disabled */
  paused: boolean;
  /** topic fit of keywords the website checked recently (normalised keyword -> 0 / 1 / 2 / null) */
  fitOf: Map<string, number | null>;
  /** MKT (2026-10-27, mismatch audit M4 / M6): the website's main country (a country name); absent = not judged */
  country?: string;
}

export type ProposalDecision =
  | { action: 'propose'; pick: RecommendedKeyword; occasion: 'room' | 'won' | 'done'; why: string }
  | { action: 'research'; why: string }
  | { action: 'none'; why: string };

const none = (why: string): ProposalDecision => ({ action: 'none', why });

/** What to do for one website now (pure). */
export function proposalDecision(s: ProposalState): ProposalDecision {
  if (!s.enabled) return none('keyword proposals are switched off for the platform (AUTO_START_LADDERS)');
  if (s.paused) return none('the website is paused');
  if (s.open) return none('a proposal already waits for the client');
  if (s.ladderRunActive) return none('a keyword ladder is being planned right now');
  if (s.researchRunning) return none('keyword research is running');
  const active = activeAutoLadders(s.cards);
  const queued = s.cards.filter((c) => c.status === 'queued').length;
  if (queued) return none(`${plural(queued, 'ladder')} already wait${queued === 1 ? 's' : ''} for a free place`);
  if (active >= s.maxActive) return none(`${plural(active, 'Auto ladder')} with pages to write (the limit is ${s.maxActive})`);
  const occasion: 'room' | 'won' | 'done' = s.cards.some((c) => c.status === 'won') ? 'won' : s.cards.some((c) => c.mode === 'auto' && c.counts.planned === 0 && c.status !== 'paused') ? 'done' : 'room';
  const r = s.recommended;
  const iso = isoOfCountry(s.country);
  // MKT (M6): suggestions researched for another country than the website's main country are measured for the wrong market: nothing is
  // proposed from them. Level 3 refreshes the research (in the website's own country); levels 1-2 wait for the client
  const otherMarket = !!iso && !!r.reportId && !!r.country && isoOfCountry(r.country) !== '' && isoOfCountry(r.country) !== iso;
  if (otherMarket) return s.level === 3 ? { action: 'research', why: `the keyword research was done for ${r.country}, not for ${s.country}` } : none(`the keyword research was done for ${r.country}, not for ${s.country}`);
  const stale = !r.reportId || r.ageDays == null || r.ageDays > RECOMMENDATIONS_MAX_AGE_DAYS;
  // a research refresh is autopilot spend: only at full autopilot (it is in level 3's forecast); levels 1-2 are offered it as a recommendation
  if (stale) return s.level === 3 ? { action: 'research', why: !r.reportId ? 'no keyword research yet' : `the keyword research is older than ${RECOMMENDATIONS_MAX_AGE_DAYS} days` } : none(!r.reportId ? 'no keyword research for this website yet' : `the keyword research is older than ${RECOMMENDATIONS_MAX_AGE_DAYS} days`);
  const before = new Set(s.proposedBefore.map(cycleNorm));
  const heads = s.ladders.map((l) => l.head);
  const pick = r.keywords.find(
    (k) =>
      isWithinReach(k.difficultyForYou) &&
      k.planType !== 'none' &&
      !ladderOverlapsOf(k.keyword, s.ladders).length &&
      !heads.some((h) => keywordsOverlap(h, k.keyword)) &&
      s.fitOf.get(normKeyword(k.keyword)) !== 0 &&
      !(iso && marketMismatch(k.keyword, iso)) &&   // MKT (M4): never propose a keyword about another market ("... gcc" for a Pakistan website)
      !before.has(cycleNorm(k.keyword)),
  );
  if (!pick) return none('no recommended keyword is easy or reachable for the website, on its topic, in its market and free of overlaps');
  const why =
    (occasion === 'won' ? 'Your ladder reached the top 3, so there is room for the next keyword. ' : occasion === 'done' ? 'Your ladder has no pages left to write, so there is room for the next keyword. ' : '') +
    (pick.why ? `${pick.why.replace(/\.$/, '')}.` : `${CHANCE_WORDS[pick.difficultyForYou ?? ''] ?? 'Within reach'} for your website.`);
  return { action: 'propose', pick, occasion, why };
}

// ---------------- the store ----------------

/** The price of one ladder page in credits, about (the engine's own calibrated figure when known). */
/** MKT D1: the price of starting a suggested ladder, about (the plan and its first page, written now), the engine's calibrated figure. */
export const startCredits = (): number => creditsOfUsd(estimateRunCost('ladder', { pagesNow: 1 }, cachedCalibration()));
export const creditsPerPage = (): number => creditsOfUsd(estimateRunCost('keyword', { receiveContent: true, receiveReport: true }, cachedCalibration()));

export function toProposal(r: KeywordProposalRow, decidedByEmail: string | null = null): KeywordProposalView {
  const d = r.details as Record<string, unknown>;
  const diff = typeof d.difficultyForYou === 'string' ? d.difficultyForYou : null;
  const st = (r.status === 'starting' ? 'pending' : r.status) as KeywordProposalStatus;
  return {
    id: r.id,
    siteId: r.siteId,
    keyword: r.keyword,
    status: st,
    startAt: r.startAt?.toISOString() ?? null,
    level: (r.level === 1 || r.level === 3 ? r.level : 2) as AutopilotLevel,
    why: typeof d.why === 'string' ? d.why : '',
    occasion: r.occasion === 'won' || r.occasion === 'done' ? r.occasion : 'room',
    searches: typeof d.volume === 'number' ? d.volume : null,
    difficulty: diff,
    chance: CHANCE_WORDS[diff ?? ''] ?? '',
    planType: typeof d.planType === 'string' ? d.planType : null,
    months: typeof d.months === 'string' ? d.months : '',
    creditsPerPage: creditsPerPage(),
    startCredits: startCredits(),
    runId: r.runId,
    swappedFor: r.swappedFor,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    decidedAt: r.decidedAt?.toISOString() ?? null,
    decidedBy: decidedByEmail,
  };
}

/** GET .../keyword-proposals: the open ones and the last 20 others. */
export async function listProposals(site: SiteRow): Promise<KeywordProposalList> {
  const list = await db
    .select({ p: schema.keywordProposals, email: schema.users.email })
    .from(schema.keywordProposals)
    .leftJoin(schema.users, eq(schema.keywordProposals.decidedBy, schema.users.id))
    .where(eq(schema.keywordProposals.siteId, site.id))
    .orderBy(desc(schema.keywordProposals.createdAt))
    .limit(40);
  const views = list.map((x) => toProposal(x.p, x.email));
  return {
    pending: views.filter((v) => v.status === 'pending'),
    recent: views.filter((v) => v.status !== 'pending').slice(0, 20),
    level: (site.autopilotLevel === 1 || site.autopilotLevel === 3 ? site.autopilotLevel : DEFAULT_AUTOPILOT_LEVEL) as AutopilotLevel,
    enabled: config.autoStartLadders,
  };
}

/**
 * The details every proposal carries (pure): the keys the app reads back (toProposal: `volume`, `difficultyForYou`, `planType`, `months`,
 * `why`) are always present, null or '' when the research did not say, so no writer can leave one out.
 */
export function proposalDetails(pick: Partial<RecommendedKeyword>, why: string, reportId: string | null): Record<string, unknown> {
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    volume: num(pick.volume),
    kd: num(pick.kd),
    difficultyForYou: typeof pick.difficultyForYou === 'string' ? pick.difficultyForYou : null,
    planType: typeof pick.planType === 'string' ? pick.planType : null,
    months: str(pick.months),
    label: str(pick.label),
    why,
    source: str(pick.source),
    pageType: str(pick.pageType),
    reportId,
  };
}

/** Records a proposal; null when the website already has an open one or this keyword was proposed before (the unique indexes). */
export async function insertProposal(o: { org: OrgRow; site: SiteRow; pick: RecommendedKeyword; occasion: 'room' | 'won' | 'done'; why: string; level: AutopilotLevel; now: number; reportId: string | null }): Promise<KeywordProposalRow | null> {
  const startAt = o.level === 3 ? new Date(o.now + PROPOSAL_WAIT_HOURS * 3_600_000) : null;
  const rows = await db
    .insert(schema.keywordProposals)
    .values({
      orgId: o.org.id,
      siteId: o.site.id,
      keyword: o.pick.keyword,
      keywordNorm: cycleNorm(o.pick.keyword),
      details: proposalDetails(o.pick, o.why, o.reportId),
      status: 'pending',
      level: o.level,
      occasion: o.occasion,
      startAt,
    })
    .onConflictDoNothing()
    .returning();
  return rows[0] ?? null;
}

// ---------------- the job ----------------

type Log = { info: (o: object, m: string) => void; warn: (o: object, m: string) => void; error?: (o: object, m: string) => void };

export interface ProposalDeps {
  pipeline: (org: OrgRow, site: SiteRow) => Promise<PipelineData>;
  recommended: (org: OrgRow, site: SiteRow) => Promise<RecommendedKeywords>;
  fits: (siteId: string) => Promise<Map<string, number | null>>;
  owner: (orgId: string) => Promise<UserRow | null>;
  start: (a: OrgAccess, input: Parameters<typeof createRun>[1], opts: Parameters<typeof createRun>[2]) => Promise<RunRow>;
  announce: (org: OrgRow, site: SiteRow, p: KeywordProposalRow, log: Log) => Promise<void>;
}

export { ownerOf };

async function fitsOf(siteId: string): Promise<Map<string, number | null>> {
  const m = new Map<string, number | null>();
  for (const c of await recentChecks(siteId, 30)) {
    const k = normKeyword(c.keyword);
    const f = (c.result as { fit?: unknown }).fit;
    if (!m.has(k)) m.set(k, f === 0 || f === 1 || f === 2 ? f : null);
  }
  return m;
}

/** The e-mail of a level-3 announcement (pure). */
/** A moment in the website's own time zone, in plain words: "Thursday 22 October at 14:00 (Dubai time)". */
export function localMoment(at: string | Date, timezone: string): string {
  const t = new Date(at);
  const tz = isValidTimezone(timezone) ? timezone : ENGINE_TIMEZONE;
  const part = (type: string) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(t).find((p) => p.type === type)?.value ?? '';
  const place = /^(UTC|Etc\/UTC|Etc\/GMT)$/.test(tz) ? 'UTC' : `${tz.split('/').pop()!.replace(/_/g, ' ')} time`;
  return `${part('weekday')} ${part('day')} ${part('month')} at ${part('hour')}:${part('minute')} (${place})`;
}

export function announcementMail(o: { site: Pick<SiteRow, 'domain' | 'timezone'>; p: KeywordProposalView; url: string }): { subject: string; title: string; lines: string[]; details: { label: string; value: string }[] } {
  // the website's own zone (the one its weekly cycle runs in), never UTC
  const when = o.p.startAt ? localMoment(o.p.startAt, o.site.timezone) : 'in two days';
  return {
    subject: `We will start "${o.p.keyword}" for ${o.site.domain}`,
    title: `Your next keyword: "${o.p.keyword}"`,
    lines: [
      `You chose full autopilot for ${o.site.domain}, so we picked the next keyword for you. ${o.p.why}`.trim(),
      `It starts on ${when} unless you change it. Approve it to start now, pick a different keyword, or skip it and we will propose another one.`,
      `Each page of its plan uses about ${o.p.creditsPerPage} credits.`,
    ],
    details: [
      { label: 'Keyword', value: o.p.keyword },
      ...(o.p.searches != null ? [{ label: 'Searches a month', value: `about ${o.p.searches}` }] : []),
      ...(o.p.chance ? [{ label: 'Your chances', value: o.p.chance }] : []),
      ...(o.p.months ? [{ label: 'Time to rank', value: `${o.p.months} months` }] : []),
    ],
  };
}

async function announce(org: OrgRow, site: SiteRow, p: KeywordProposalRow, log: Log): Promise<void> {
  const [claimed] = await db.update(schema.keywordProposals).set({ emailedAt: new Date() }).where(and(eq(schema.keywordProposals.id, p.id), isNull(schema.keywordProposals.emailedAt))).returning({ id: schema.keywordProposals.id });
  if (!claimed) return;
  const to = await billingContacts(org.id);
  const url = `${await baseUrlFor(org)}/o/${org.id}/sites/${site.id}/pipeline`;
  const m = announcementMail({ site, p: toProposal(p), url });
  const sender = await senderFor(org);
  const mlog = { info: log.info, error: log.error ?? log.warn };
  for (const addr of to)
    await sendMail({ to: addr, subject: m.subject, title: m.title, lines: m.lines, details: m.details, action: { label: 'Review the keyword', url }, sender, footer: `You receive this e-mail because ${site.domain} is on full autopilot in ${sender.brandName}.` }, mlog).catch(() => false);
}

const defaultDeps: ProposalDeps = {
  pipeline: pipelineData,
  recommended: (org, site) => recommendedKeywords(org, site),
  fits: fitsOf,
  owner: ownerOf,
  start: (a, input, opts) => createRun(a, input, opts),
  announce,
};

const ladderBody = (site: SiteRow, keyword: string, chosenBy: 'client_typed' | 'client_picked' | 'system_announced', ladderMode?: 'manual') =>
  ladderInput.safeParse({
    mode: 'ladder',
    siteId: site.id,
    keyword,
    country: site.country,
    business: site.business.slice(0, 500),
    customers: site.customers.slice(0, 300),
    businessFacts: site.businessFacts.slice(0, 2000),
    goal: site.goal,
    tone: site.tone,
    cta: site.cta.slice(0, 200),
    pagesNow: 1,
    chosenBy,
    emailCopy: false,
    // MKT D1 (2026-10-27): "Plan it without writing a page", the safe Accept of the new-ladder confirmation
    ...(ladderMode ? { ladderMode } : {}),
  });

const levelOfSite = (site: Pick<SiteRow, 'autopilotLevel'>): AutopilotLevel => (site.autopilotLevel === 1 || site.autopilotLevel === 3 ? site.autopilotLevel : DEFAULT_AUTOPILOT_LEVEL);
const pausedSite = (org: OrgRow, site: SiteRow) => org.disabled || !site.verifiedAt || site.trackingStatus === 'paused' || !!site.creditsPausedAt;

/** One website: decide, and record a proposal (or, at level 3 with stale research, start the research refresh). */
export async function proposeForSite(org: OrgRow, site: SiteRow, deps: ProposalDeps = defaultDeps, now = Date.now(), log?: Log): Promise<{ proposalId: string | null; keyword: string | null; reason: string; researchRunId?: string }> {
  if (pausedSite(org, site)) return { proposalId: null, keyword: null, reason: 'the website is paused or not verified' };
  const [data, recommended, fitOf, proposed] = await Promise.all([
    deps.pipeline(org, site),
    deps.recommended(org, site),
    deps.fits(site.id),
    db.select({ k: schema.keywordProposals.keyword, status: schema.keywordProposals.status }).from(schema.keywordProposals).where(eq(schema.keywordProposals.siteId, site.id)),
  ]);
  const level = levelOfSite(site);
  const decision = proposalDecision({
    enabled: config.autoStartLadders,
    level,
    maxActive: data.automation.maxActiveLadders,
    cards: data.ladderCards,
    ladders: data.ladders.map((l) => ({ id: l.id, head: l.head, keywords: l.keywords ?? l.planned.map((p) => p.keyword) })),
    recommended,
    proposedBefore: proposedBeforeOf(proposed),
    open: proposed.some((p) => p.status === 'pending' || p.status === 'starting'),
    ladderRunActive: data.activeRuns.some((r) => r.mode === 'ladder'),
    researchRunning: data.activeRuns.some((r) => r.mode === 'discover'),
    paused: data.tracking.status === 'paused',
    fitOf,
    country: site.country,
  });
  if (decision.action === 'none') return { proposalId: null, keyword: null, reason: decision.why };
  if (decision.action === 'research') {
    // level 3: the research refresh (autopilot spend), at most once per refresh period, never while one runs
    const last = await db.query.runs.findFirst({ where: and(eq(schema.runs.siteId, site.id), eq(schema.runs.mode, 'discover')), orderBy: desc(schema.runs.createdAt) });
    if (last && now - last.createdAt.getTime() < 7 * 864e5) return { proposalId: null, keyword: null, reason: `${decision.why}; a research run started less than 7 days ago` };
    const owner = await deps.owner(org.id);
    if (!owner) return { proposalId: null, keyword: null, reason: 'the company has no owner' };
    const input = discoverInput.parse({ mode: 'discover', siteId: site.id, country: site.country, business: site.business.slice(0, 500), customers: site.customers.slice(0, 300), businessFacts: site.businessFacts.slice(0, 2000), goal: site.goal, receiveReport: false, emailCopy: false });
    try {
      const run = await deps.start({ user: owner, org, role: 'owner' }, input, { startedBy: 'auto' });
      return { proposalId: null, keyword: null, reason: `${decision.why}: research started`, researchRunId: run.id };
    } catch (err) {
      if (err instanceof HttpError && (err.statusCode === 402 || err.statusCode === 429)) return { proposalId: null, keyword: null, reason: `${decision.why}; the research could not start (${err.statusCode === 402 ? 'no credits left' : 'limit reached'})` };
      if (isConfirmNeeded(err)) return { proposalId: null, keyword: null, reason: `${decision.why}; the research waits for you (${firstOpenTitle(err)})` };
      throw err;
    }
  }
  const row = await insertProposal({ org, site, pick: decision.pick, occasion: decision.occasion, why: decision.why, level, now, reportId: recommended.reportId });
  if (!row) return { proposalId: null, keyword: decision.pick.keyword, reason: 'another proposal was recorded at the same moment' };
  if (level === 3 && log) await deps.announce(org, site, row, log).catch((err) => log.warn({ err: String(err) }, 'announcement e-mail failed'));
  return { proposalId: row.id, keyword: row.keyword, reason: decision.why };
}

/** Claims one open proposal (pending -> starting) so nothing else starts it. null when it was taken, decided, or not this website's. */
async function claim(id: string, siteId: string): Promise<KeywordProposalRow | null> {
  const [r] = await db
    .update(schema.keywordProposals)
    .set({ status: 'starting', claimedAt: new Date() })
    .where(and(eq(schema.keywordProposals.id, id), eq(schema.keywordProposals.siteId, siteId), eq(schema.keywordProposals.status, 'pending')))
    .returning();
  return r ?? null;
}
const release = (id: string, set: Partial<typeof schema.keywordProposals.$inferInsert> = {}) => db.update(schema.keywordProposals).set({ status: 'pending', ...set }).where(and(eq(schema.keywordProposals.id, id), eq(schema.keywordProposals.status, 'starting')));
const finish = (id: string, set: Partial<typeof schema.keywordProposals.$inferInsert>) => db.update(schema.keywordProposals).set(set).where(eq(schema.keywordProposals.id, id));

/** Whether a ladder may start on this website now; the reason when it may not (the rules every start obeys). */
async function startBlock(org: OrgRow, site: SiteRow, deps: ProposalDeps): Promise<string | null> {
  if (!config.autoStartLadders) return 'keyword proposals are switched off for the platform';
  if (pausedSite(org, site)) return 'the website is paused';
  const data = await deps.pipeline(org, site);
  if (data.tracking.status === 'paused') return 'the website is paused';
  if (data.activeRuns.some((r) => r.mode === 'ladder')) return 'a keyword ladder is being planned right now';
  const active = activeAutoLadders(data.ladderCards);
  if (active >= data.automation.maxActiveLadders) return `${plural(active, 'Auto ladder')} already have pages to write (the limit is ${data.automation.maxActiveLadders})`;
  return null;
}

/** Starts every due level-3 announcement (start_at passed), on the owner's behalf. */
export async function startDueProposals(log: Log, deps: ProposalDeps = defaultDeps, now = Date.now()): Promise<number> {
  // a crash between a claim and its start: a run made for it is found by its proposal id, else the claim is released
  const stale = await db.select().from(schema.keywordProposals).where(and(eq(schema.keywordProposals.status, 'starting'), lt(schema.keywordProposals.claimedAt, new Date(now - PROPOSALS.staleClaimMs))));
  for (const p of stale) {
    const run = await db.query.runs.findFirst({ where: and(eq(schema.runs.siteId, p.siteId), sql`${schema.runs.input}->>'proposalId' = ${p.id}`) });
    const by = String((run?.input as Record<string, unknown> | undefined)?.chosenBy ?? '');
    if (run && run.status === 'failed') await finish(p.id, { status: 'failed', runId: run.id, note: failedNote(run) });
    else if (run) await finish(p.id, { status: by === 'client_picked' ? 'approved' : by === 'client_typed' ? 'swapped' : 'started', runId: run.id, ...(by === 'client_typed' ? { swappedFor: String((run.input as Record<string, unknown>).keyword ?? '') } : {}) });
    else if (!p.decidedAt) await release(p.id);
  }
  if (!config.autoStartLadders) return 0;
  const due = await db
    .select()
    .from(schema.keywordProposals)
    .where(and(eq(schema.keywordProposals.status, 'pending'), isNotNull(schema.keywordProposals.startAt), lte(schema.keywordProposals.startAt, new Date(now))))
    .orderBy(asc(schema.keywordProposals.startAt))
    .limit(50);
  let started = 0;
  for (const p of due) {
    try {
      const site = await db.query.sites.findFirst({ where: eq(schema.sites.id, p.siteId) });
      const org = site ? await db.query.organizations.findFirst({ where: eq(schema.organizations.id, site.orgId) }) : null;
      if (!site || !org) continue;
      // the level was lowered since: the announcement becomes a suggestion that waits for the client
      if (levelOfSite(site) !== 3) {
        await db.update(schema.keywordProposals).set({ startAt: null, level: levelOfSite(site) }).where(and(eq(schema.keywordProposals.id, p.id), eq(schema.keywordProposals.status, 'pending')));
        continue;
      }
      const c = await claim(p.id, site.id);
      if (!c) continue;
      const block = await startBlock(org, site, deps);
      if (block) {
        await release(p.id, { note: `Waiting: ${block}` });
        continue;
      }
      const owner = await deps.owner(org.id);
      const parsed = ladderBody(site, p.keyword, 'system_announced');
      if (!owner || !parsed.success) {
        await finish(p.id, { status: 'failed', note: !owner ? 'The company has no owner to start it for' : "The website's details are incomplete" });
        continue;
      }
      try {
        const run = await deps.start({ user: owner, org, role: 'owner' }, parsed.data, { startedBy: 'auto', proposalId: p.id });
        await finish(p.id, run.status === 'failed' ? { status: 'failed', runId: run.id, note: failedNote(run) } : { status: 'started', runId: run.id, note: '' });
        if (run.status !== 'failed') started++;
        log.info({ site: site.domain, keyword: p.keyword, run: run.id }, 'announced keyword started');
      } catch (err) {
        if (err instanceof HttpError && (err.statusCode === 402 || err.statusCode === 429)) await release(p.id, { note: err.statusCode === 402 ? 'Waiting: no credits left for it' : 'Waiting: a limit was reached' });
        // MKT (2026-10-27, mismatch audit §2.2): an automatic start never continues past a warning. The announcement stops (no start
        // time) and waits for the client as a suggestion on Needs you, with the warning's own words; their approve sees the warning.
        else if (isConfirmNeeded(err)) await release(p.id, { startAt: null, note: `Waiting for you: ${firstOpenTitle(err) || 'a warning needs your answer'}` });
        else {
          await release(p.id);
          throw err;
        }
      }
    } catch (err) {
      log.warn({ proposal: p.id, err: String(err) }, 'announced keyword did not start');
    }
  }
  return started;
}

/** Every verified, tracked, unpaused website: propose where there is room. */
export async function proposeEverywhere(log: Log, deps: ProposalDeps = defaultDeps): Promise<number> {
  if (!config.autoStartLadders) return 0;
  const sites = await db.query.sites.findMany({ where: and(isNotNull(schema.sites.verifiedAt), eq(schema.sites.trackingStatus, 'active'), isNull(schema.sites.creditsPausedAt)) });
  let made = 0;
  for (const site of sites) {
    try {
      const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, site.orgId) });
      if (!org || org.disabled) continue;
      const r = await proposeForSite(org, site, deps, Date.now(), log);
      if (r.proposalId) made++;
      if (r.proposalId || r.researchRunId) log.info({ site: site.domain, keyword: r.keyword, reason: r.reason }, r.proposalId ? 'keyword proposed' : 'keyword research refresh started');
    } catch (err) {
      log.warn({ site: site.domain, err: String(err) }, 'keyword proposal failed');
    }
  }
  return made;
}

/** The timer (index.ts): due starts every tick, new proposals every PROPOSALS.proposeEveryMs. */
export function startProposalJobs(log: Log): () => void {
  let lastPropose = 0;
  const tick = async () => {
    await startDueProposals(log).catch((err) => log.warn({ err: String(err) }, 'starting announced keywords failed'));
    if (Date.now() - lastPropose >= PROPOSALS.proposeEveryMs) {
      lastPropose = Date.now();
      await proposeEverywhere(log).catch((err) => log.warn({ err: String(err) }, 'keyword proposals failed'));
    }
  };
  const first = setTimeout(() => void tick(), PROPOSALS.firstAfterMs);
  const t = setInterval(() => void tick(), PROPOSALS.tickMs);
  return () => {
    clearTimeout(first);
    clearInterval(t);
  };
}

// ---------------- the client's decisions (POST .../keyword-proposals/:id/approve | skip | swap) ----------------

async function proposalOf(site: SiteRow, id: string): Promise<KeywordProposalRow> {
  const p = await db.query.keywordProposals.findFirst({ where: and(eq(schema.keywordProposals.id, id), eq(schema.keywordProposals.siteId, site.id)) });
  if (!p) throw notFound('Proposal not found');
  if (p.status !== 'pending' && p.status !== 'starting') throw conflict(`This proposal was already ${p.status === 'skipped' ? 'skipped' : p.status === 'swapped' ? 'replaced by another keyword' : 'started'}.`, 'proposal_decided');
  if (p.status === 'starting') throw conflict('This keyword is being started right now.', 'proposal_starting');
  return p;
}

/** Approve: start it now, as the client's own pick. */
export async function approveProposal(
  a: OrgAccess & { site: SiteRow },
  id: string,
  deps: Pick<ProposalDeps, 'start'> = defaultDeps,
  /** MKT: the warning ids the person answered with "Continue anyway", and the request (audit) */
  ack: { acknowledge?: string[]; req?: FastifyRequest | null; /** MKT D1: start it Manual (plan only) */ ladderMode?: 'manual' } = {},
): Promise<{ proposal: KeywordProposalView; run: RunRow }> {
  const p = await proposalOf(a.site, id);
  const parsed = ladderBody(a.site, p.keyword, 'client_picked', ack.ladderMode);
  if (!parsed.success) throw badRequest("The website's details are incomplete: fill them in its settings first");
  const c = await claim(p.id, a.site.id);
  if (!c) throw conflict('This proposal was decided a moment ago.', 'proposal_decided');
  try {
    const run = await deps.start(a, parsed.data, { proposalId: p.id, acknowledge: ack.acknowledge, req: ack.req });
    // a run the engine did not take is a failure, not a decision: the proposal says why, and the keyword can be proposed again
    const [row] = await db
      .update(schema.keywordProposals)
      .set(run.status === 'failed' ? { status: 'failed', runId: run.id, decidedAt: new Date(), decidedBy: a.user.id, note: failedNote(run) } : { status: 'approved', runId: run.id, decidedAt: new Date(), decidedBy: a.user.id, note: '' })
      .where(eq(schema.keywordProposals.id, p.id))
      .returning();
    return { proposal: toProposal(row, a.user.email), run };
  } catch (err) {
    await release(p.id);
    throw err;
  }
}

/**
 * MKT D2 (2026-10-27): the suggestion's keyword was added as a page of an existing ladder (the "same product" warning's Accept) instead of
 * starting a ladder of its own: the waiting suggestion is closed as decided (never proposed again), saying where the keyword went.
 */
export async function closeProposalsAdded(siteId: string, keyword: string, _ladderId: string, userId: string): Promise<number> {
  const done = await db
    .update(schema.keywordProposals)
    .set({ status: 'skipped', decidedAt: new Date(), decidedBy: userId, note: "Added as a page of your existing keyword ladder instead of a new ladder." })
    .where(and(eq(schema.keywordProposals.siteId, siteId), eq(schema.keywordProposals.status, 'pending'), eq(schema.keywordProposals.keywordNorm, cycleNorm(keyword))))
    .returning({ id: schema.keywordProposals.id });
  return done.length;
}

/** Skip: never proposed again for this website; the next one is proposed. */
export async function skipProposal(a: OrgAccess & { site: SiteRow }, id: string, deps: ProposalDeps = defaultDeps, log?: Log): Promise<{ proposal: KeywordProposalView; next: KeywordProposalView | null }> {
  const p = await proposalOf(a.site, id);
  const [row] = await db
    .update(schema.keywordProposals)
    .set({ status: 'skipped', decidedAt: new Date(), decidedBy: a.user.id })
    .where(and(eq(schema.keywordProposals.id, p.id), eq(schema.keywordProposals.status, 'pending')))
    .returning();
  if (!row) throw conflict('This proposal was decided a moment ago.', 'proposal_decided');
  const r = await proposeForSite(a.org, a.site, deps, Date.now(), log).catch(() => null);
  const next = r?.proposalId ? await db.query.keywordProposals.findFirst({ where: eq(schema.keywordProposals.id, r.proposalId) }) : null;
  return { proposal: toProposal(row, a.user.email), next: next ? toProposal(next) : null };
}

/** Swap: the client types a different keyword; it is checked first (a keyword check), then started as the client's own. */
export async function swapProposal(
  a: OrgAccess & { site: SiteRow },
  id: string,
  keyword: string,
  deps: Pick<ProposalDeps, 'start'> & { check?: typeof assessKeyword } = defaultDeps,
  ack: { acknowledge?: string[]; req?: FastifyRequest | null; /** MKT D1: start it Manual (plan only) */ ladderMode?: 'manual' } = {},
): Promise<{ proposal: KeywordProposalView; run: RunRow }> {
  const p = await proposalOf(a.site, id);
  const k = keyword.trim();
  if (k.length < 2 || k.length > 100) throw badRequest('Use 2-100 characters', { keyword: 'Use 2-100 characters' });
  const check = await (deps.check ?? assessKeyword)(a, { keyword: k }, { acknowledge: ack.acknowledge, req: ack.req });
  const res = check.result;
  if (res.difficultyForYou === 'not_realistic' || res.fit === 0)
    throw new HttpError(
      409,
      res.fit === 0 ? 'This keyword looks outside your business, so it is not started. Pick one of the alternatives, or another keyword.' : 'This keyword is not realistic for your website now, so it is not started. Pick one of the alternatives, or another keyword.',
      'keyword_not_suitable',
      undefined,
      { check },
    );
  const parsed = ladderBody(a.site, k, 'client_typed', ack.ladderMode);
  if (!parsed.success) throw badRequest("The website's details are incomplete: fill them in its settings first");
  const c = await claim(p.id, a.site.id);
  if (!c) throw conflict('This proposal was decided a moment ago.', 'proposal_decided');
  try {
    const run = await deps.start(a, parsed.data, { proposalId: p.id, acknowledge: ack.acknowledge, req: ack.req });
    const [row] = await db
      .update(schema.keywordProposals)
      .set(run.status === 'failed' ? { status: 'failed', swappedFor: k, runId: run.id, decidedAt: new Date(), decidedBy: a.user.id, note: failedNote(run) } : { status: 'swapped', swappedFor: k, runId: run.id, decidedAt: new Date(), decidedBy: a.user.id, note: '' })
      .where(eq(schema.keywordProposals.id, p.id))
      .returning();
    return { proposal: toProposal(row, a.user.email), run };
  } catch (err) {
    await release(p.id);
    throw err;
  }
}

/**
 * The level changed (PATCH .../automation): an open proposal follows it. Lowered below 3, an announcement becomes a suggestion that waits
 * for the client (no start time); raised to 3, a waiting suggestion is announced (starts PROPOSAL_WAIT_HOURS from now, with its e-mail).
 * Then the website is looked at again, so a level-3 website with room gets its announcement now rather than at the next timer pass.
 */
export async function relevelProposals(org: OrgRow, site: SiteRow, level: AutopilotLevel, log: Log, deps: ProposalDeps = defaultDeps, now = Date.now()): Promise<void> {
  const open = await db.select().from(schema.keywordProposals).where(and(eq(schema.keywordProposals.siteId, site.id), eq(schema.keywordProposals.status, 'pending')));
  for (const p of open) {
    if (level < 3) await db.update(schema.keywordProposals).set({ level, startAt: null }).where(and(eq(schema.keywordProposals.id, p.id), eq(schema.keywordProposals.status, 'pending')));
    else if (!p.startAt) {
      const [row] = await db
        .update(schema.keywordProposals)
        // a new start time is a new announcement: its e-mail goes out again (announce claims emailed_at), with the new time
        .set({ level, startAt: new Date(now + PROPOSAL_WAIT_HOURS * 3_600_000), emailedAt: null })
        .where(and(eq(schema.keywordProposals.id, p.id), eq(schema.keywordProposals.status, 'pending')))
        .returning();
      if (row) await deps.announce(org, site, row, log).catch((err) => log.warn({ err: String(err) }, 'announcement e-mail failed'));
    }
  }
  if (!open.length) await proposeForSite(org, { ...site, autopilotLevel: level }, deps, now, log).catch((err) => log.warn({ err: String(err), site: site.domain }, 'keyword proposal failed'));
}

/** A website's open proposals (for Needs you), newest first. */
export async function openProposals(siteId: string): Promise<KeywordProposalRow[]> {
  return db.select().from(schema.keywordProposals).where(and(eq(schema.keywordProposals.siteId, siteId), inArray(schema.keywordProposals.status, OPEN))).orderBy(desc(schema.keywordProposals.createdAt));
}
