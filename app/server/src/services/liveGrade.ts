import { randomUUID } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import {
  duplicatePagesOf,
  interpretLiveGrade,
  liveGradeBody,
  liveGradePending,
  liveReadSettled,
  liveReadWaiting,
  n8nSiteId,
  nextLiveGrade,
  type ContentLogRow,
  type FactAnswers,
  type LiveGradeBody,
  type LiveGradeOutcome,
  type PageLiveGrade,
} from '@seo/shared';
import { config } from '../config';
import { db, schema } from '../db';
import type { PageReviewRow, ReportRow, SiteRow } from '../db/schema';
import { finalizeCall, siteRows, type AssessCallResult } from '../n8n/client';
import { liveTargetFor, publishChecks, writtenPageRows, type PublishCheckRef } from './data';
import { duplicateDecisionBody, duplicateDecisionOf, siteReviews, type PageRef, type SiteReviews } from './pageReview';

// Client reports 2026-11-11 (devaicon.com: "I published the pages after fixing every issue the tool listed, but the card still shows the
// old score of the page: the page check does not check the score of the page"). The card's grade was the grade of the version WE delivered;
// the client rewrote the pages before publishing them and nothing graded what is live. This job asks the engine to grade the live page
// (Page Finalize webhook, `grade_only` + `grade_live`, shared/src/live-grade.ts) once per publish check: every 10 minutes (and shortly after
// a publish check arrives, nudgeLiveGrade), for live pages (content log `published`) whose newest publish check that opened the page and
// recorded it is newer than their last live grade, at most LIVE_GRADE_PER_RUN pages a run for the whole platform. The grade is stored on
// the page's review row (page_reviews.live_grade / live_graded_at). Free: no Claude call in the engine, no credits, no run row, no report,
// no e-mail. An engine that does not grade live pages yet (it would make a normal final version) is never stored and pauses the job for an
// hour; a live page the engine could not read keeps the previous grade and says so.

type Log = Pick<FastifyBaseLogger, 'info' | 'warn'>;
type P = Record<string, unknown>;
const obj = (v: unknown): P => (v && typeof v === 'object' && !Array.isArray(v) ? (v as P) : {});
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

/** pages graded (engine calls) per run, for the whole platform */
export const LIVE_GRADE_PER_RUN = 3;
export const LIVE_GRADE_EVERY_MS = 10 * 60_000;
/** the engine reads the live page and runs the content gate: no editor, usually under a minute */
export const LIVE_GRADE_TIMEOUT_MS = 3 * 60_000;
/** a page whose grade could not be made (engine unreachable, refused) is asked again after this long */
export const LIVE_GRADE_PAGE_BACKOFF_MS = 60 * 60_000;
/** an engine without live grading (or without the webhook): the job stops asking for this long */
export const LIVE_GRADE_ENGINE_PAUSE_MS = 60 * 60_000;
/** a website with nothing to grade is read again after this long even when no new publish check arrived */
export const LIVE_GRADE_SITE_RECHECK_MS = 6 * 60 * 60_000;

export interface LiveGradeTarget {
  log: ContentLogRow;
  page: PageRef;
  row: PageReviewRow | null;
  check: PublishCheckRef;
}

/**
 * The live pages of one website to grade (pure): each written page the content log says is published, with the publish check it is graded
 * from (liveTargetFor) newer than its newest live grade. Newest check first.
 */
export function pagesToGrade(o: { logs: ContentLogRow[]; reviews: Pick<SiteReviews, 'pageFor' | 'rowOf'>; checks: readonly PublishCheckRef[] }): LiveGradeTarget[] {
  const out: LiveGradeTarget[] = [];
  const seen = new Set<string>();
  for (const log of writtenPageRows(o.logs)) {
    if (str(log.status) !== 'published' || !str(log.published_url)) continue;
    const page = o.reviews.pageFor(log);
    if (!page || seen.has(page.id)) continue;
    seen.add(page.id);
    const check = liveTargetFor(log, page, o.checks);
    const row = o.reviews.rowOf(page.id);
    if (!check || !liveGradePending(row?.liveGradedAt ?? null, check)) continue;
    if (liveReadWaiting((row?.liveGrade ?? null) as PageLiveGrade | null, check.id, Date.now())) continue;   // review M1: a failed read waits 12 h before it is tried again
    out.push({ log, page, row, check });
  }
  return out.sort((a, b) => b.check.receivedAt.localeCompare(a.check.receivedAt));
}

/** The request for one page (pure): the finalize body of its newest version with no answers, plus the live address. */
export function liveGradeRequest(o: { site: Pick<SiteRow, 'domain' | 'businessFacts' | 'factAnswers'>; original: Pick<ReportRow, 'payload'>; final: Pick<ReportRow, 'payload'> | null; row: Pick<PageReviewRow, 'answers'> | null; check: PublishCheckRef; requestId: string }): LiveGradeBody {
  const original = obj(o.original.payload);
  const decision = duplicateDecisionOf(o.row?.answers ?? null);
  return liveGradeBody({
    requestId: o.requestId,
    domain: o.site.domain,
    siteId: n8nSiteId(o.site.domain),
    payload: obj((o.final ?? o.original).payload),
    original,
    businessFacts: o.site.businessFacts ?? '',
    facts: (o.site.factAnswers ?? {}) as FactAnswers,
    duplicateDecision: decision && duplicatePagesOf(original).length ? duplicateDecisionBody(decision) : null,
    check: o.check,
  });
}

export interface LiveGradeDeps {
  /** websites (of companies that are not disabled) with a recorded publish check, and the time of their newest one */
  candidates: () => Promise<{ siteId: string; orgId: string; newest: string }[]>;
  site: (siteId: string) => Promise<SiteRow | null>;
  logs: (domain: string) => Promise<ContentLogRow[]>;
  reviews: (orgId: string, site: SiteRow) => Promise<Pick<SiteReviews, 'pageFor' | 'rowOf'>>;
  checks: (orgId: string, siteId: string) => Promise<PublishCheckRef[]>;
  report: (orgId: string, id: string) => Promise<ReportRow | null>;
  /** the page's review row, created when nobody opened the review yet */
  ensureRow: (orgId: string, siteId: string, originalId: string) => Promise<PageReviewRow | null>;
  call: (body: LiveGradeBody, orgId: string) => Promise<AssessCallResult>;
  store: (rowId: string, grade: PageLiveGrade, at: Date | null) => Promise<void>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const defaultDeps: LiveGradeDeps = {
  candidates: async () => {
    const R = schema.reports;
    const rows = await db
      .select({ siteId: R.siteId, orgId: R.orgId, newest: sql<string>`max(${R.receivedAt})::text` })
      .from(R)
      .innerJoin(schema.organizations, eq(schema.organizations.id, R.orgId))
      .where(and(eq(R.stage, 'published'), sql`${R.siteId} is not null`, sql`${R.payload}->>'recorded' = 'true'`, eq(schema.organizations.disabled, false)))
      .groupBy(R.siteId, R.orgId)
      .orderBy(desc(sql`max(${R.receivedAt})`))
      .limit(500);
    return rows.filter((r) => !!r.siteId).map((r) => ({ siteId: r.siteId!, orgId: r.orgId, newest: str(r.newest) }));
  },
  site: async (siteId) => (await db.query.sites.findFirst({ where: eq(schema.sites.id, siteId) })) ?? null,
  logs: (domain) => siteRows<ContentLogRow>('contentLog', domain, { sortBy: 'started_at:desc', max: 1000 }),
  reviews: (orgId, site) => siteReviews(orgId, site),
  checks: (orgId, siteId) => publishChecks(orgId, siteId),
  report: async (orgId, id) => (UUID.test(id) ? ((await db.query.reports.findFirst({ where: and(eq(schema.reports.orgId, orgId), eq(schema.reports.id, id)) })) ?? null) : null),
  ensureRow: async (orgId, siteId, originalId) => {
    await db.insert(schema.pageReviews).values({ orgId, siteId, reportId: originalId }).onConflictDoNothing({ target: schema.pageReviews.reportId });
    return (await db.query.pageReviews.findFirst({ where: and(eq(schema.pageReviews.orgId, orgId), eq(schema.pageReviews.reportId, originalId)) })) ?? null;
  },
  call: (body, orgId) => finalizeCall(body as unknown as P, orgId, LIVE_GRADE_TIMEOUT_MS),
  // the review's own activity time (updated_at) is left as it is: grading the live page is not something the client did
  store: async (rowId, grade, at) => {
    await db.update(schema.pageReviews).set({ liveGrade: grade, liveGradedAt: at }).where(eq(schema.pageReviews.id, rowId));
  },
};

/** What the job keeps between runs (in memory: a restart grades whatever is still pending, which is the same work once). */
export interface LiveGradeState {
  engineUntil: number;
  /** page (delivered report id) -> asked again after this time, for this publish check */
  pageUntil: Map<string, { until: number; checkId: string }>;
  /** website -> newest publish check seen when nothing was left to grade, and when */
  siteDone: Map<string, { newest: string; at: number }>;
}
export const newLiveGradeState = (): LiveGradeState => ({ engineUntil: 0, pageUntil: new Map(), siteDone: new Map() });
const state = newLiveGradeState();

export interface LiveGradeResult {
  graded: { domain: string; keyword: string; score: number | null; reportId: string }[];
  readFailed: { domain: string; keyword: string; reportId: string }[];
  skipped: { domain: string; keyword: string; why: string }[];
}

let sweeping = false;

/** One run over the platform: at most LIVE_GRADE_PER_RUN live pages graded. */
export async function gradeLivePages(log: Log | null, deps: LiveGradeDeps = defaultDeps, st: LiveGradeState = state, now = Date.now()): Promise<LiveGradeResult> {
  const out: LiveGradeResult = { graded: [], readFailed: [], skipped: [] };
  if (sweeping || now < st.engineUntil) return out;
  sweeping = true;
  try {
    let budget = LIVE_GRADE_PER_RUN;
    for (const c of await deps.candidates()) {
      if (budget <= 0) break;
      const done = st.siteDone.get(c.siteId);
      if (done && done.newest === c.newest && now - done.at < LIVE_GRADE_SITE_RECHECK_MS) continue;
      const site = await deps.site(c.siteId).catch(() => null);
      if (!site || !site.verifiedAt || site.orgId !== c.orgId) continue;
      let targets: LiveGradeTarget[];
      try {
        const [logs, reviews, checks] = await Promise.all([deps.logs(site.domain), deps.reviews(c.orgId, site), deps.checks(c.orgId, site.id)]);
        targets = pagesToGrade({ logs, reviews, checks });
      } catch (err) {
        log?.warn({ site: site.domain, err: String((err as Error)?.message ?? err) }, 'live grade: the website could not be read');
        continue;
      }
      let left = 0;
      for (const t of targets) {
        const hold = st.pageUntil.get(t.page.id);
        if (hold && hold.checkId === t.check.id && now < hold.until) {
          left++;
          continue;
        }
        if (budget <= 0) {
          left++;
          continue;
        }
        budget--;
        const keyword = str(t.log.keyword);
        const outcome = await gradeOne(c.orgId, site, t, deps).catch((err): LiveGradeOutcome => ({ kind: 'skip', pause: 'page', why: String((err as Error)?.message ?? err).slice(0, 200) }));
        if (outcome.kind === 'skip') {
          left++;
          out.skipped.push({ domain: site.domain, keyword, why: outcome.why });
          log?.warn({ site: site.domain, keyword, why: outcome.why }, 'live grade not made');
          if (outcome.pause === 'engine') {
            st.engineUntil = now + LIVE_GRADE_ENGINE_PAUSE_MS;
            return out;
          }
          st.pageUntil.set(t.page.id, { until: now + LIVE_GRADE_PAGE_BACKOFF_MS, checkId: t.check.id });
          continue;
        }
        st.pageUntil.delete(t.page.id);
        if (outcome.kind === 'graded') out.graded.push({ domain: site.domain, keyword, score: outcome.grade.score, reportId: t.page.id });
        else out.readFailed.push({ domain: site.domain, keyword, reportId: t.page.id });
      }
      if (left === 0) st.siteDone.set(c.siteId, { newest: c.newest, at: now });
      else st.siteDone.delete(c.siteId);
    }
    if (out.graded.length || out.readFailed.length) log?.info({ graded: out.graded, readFailed: out.readFailed }, 'live pages graded');
    return out;
  } finally {
    sweeping = false;
  }
}

/** Grades one live page and stores the grade (or the failed read). */
async function gradeOne(orgId: string, site: SiteRow, t: LiveGradeTarget, deps: LiveGradeDeps): Promise<LiveGradeOutcome> {
  const original = await deps.report(orgId, t.page.id);
  if (!original) return { kind: 'skip', pause: 'page', why: 'the written page was not found' };
  const row = t.row ?? (await deps.ensureRow(orgId, site.id, original.id));
  if (!row) return { kind: 'skip', pause: 'page', why: 'the review row could not be made' };
  const final = row.finalReportId ? await deps.report(orgId, row.finalReportId) : null;
  const body = liveGradeRequest({ site, original, final, row, check: t.check, requestId: `app-live-${randomUUID()}` });
  const outcome = interpretLiveGrade(await deps.call(body, orgId));
  if (outcome.kind === 'skip') return outcome;
  // live_graded_at = the time of the publish check this attempt covers (not the clock): a check that arrives while the engine grades is newer
  // and is graded next
  const covered = new Date(t.check.receivedAt);
  const next = nextLiveGrade(row.liveGrade ?? null, outcome, { publishedReportId: t.check.id, url: t.check.url, at: new Date().toISOString() });
  // review M1: a failed read that may be tried again leaves live_graded_at as it was (the check stays pending; the 12-hour wait spaces the tries)
  const settled = outcome.kind === 'graded' || liveReadSettled(next, t.check.id);
  await deps.store(row.id, next, settled ? (Number.isFinite(covered.getTime()) ? covered : new Date()) : (row.liveGradedAt ?? null));
  return outcome;
}

let nudgeTimer: ReturnType<typeof setTimeout> | null = null;

/** A publish check just arrived: grade shortly (debounced; the 10-minute job alone is enough). */
export function nudgeLiveGrade(log: Log | null, delayMs = 45_000): void {
  if (!config.liveGradeJobs || nudgeTimer) return;
  nudgeTimer = setTimeout(() => {
    nudgeTimer = null;
    void gradeLivePages(log).catch((err) => log?.warn({ err: String(err) }, 'live grade failed'));
  }, delayMs);
  nudgeTimer.unref?.();
}

/** The job (index.ts): every 10 minutes, and once two minutes after the start (back-fills pages checked while the server was down). */
export function startLiveGradeJobs(log: Log): () => void {
  if (!config.liveGradeJobs) {
    log.info({ liveGradeJobs: false }, 'live page grading off (LIVE_GRADE_JOBS)');
    return () => undefined;
  }
  const run = () => void gradeLivePages(log).catch((err) => log.warn({ err: String(err) }, 'live grade failed'));
  const first = setTimeout(run, 2 * 60_000);
  const timer = setInterval(run, LIVE_GRADE_EVERY_MS);
  return () => {
    clearTimeout(first);
    clearInterval(timer);
    if (nudgeTimer) clearTimeout(nudgeTimer);
  };
}
