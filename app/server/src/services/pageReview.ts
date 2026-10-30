import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { FastifyBaseLogger, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  ANSWER_DECISIONS,
  answerProblem,
  carryOpenQuestions,
  cmsPage,
  cmsReadiness,
  deliveryOf,
  DUPLICATE_DECISION_KEY,
  duplicatePagesOf,
  duplicateReasonProblem,
  factOf,
  FACT_DECISION_LABEL,
  FINALIZE_STALE_MINUTES,
  finalizeBody,
  finalizeNeeded,
  finalReportPayload,
  keyCost,
  metaDescriptionView,
  cleanMetaDescription,
  n8nSiteId,
  NEEDS_YOU_QUESTION_PAGES,
  openQuestions,
  PAGE_MARKDOWN_MAX,
  pageCheckOf,
  pageMarkdownWithMeta,
  personDisplayName,
  plainWords,
  acceptAllPlan,
  questionsOf,
  reviewPersonIds,
  reviewStage,
  reviewSummaryOf,
  sanitizeMarkdown,
  storedFactFor,
  type AnswerDecision,
  type ClientQuestion,
  type ContentLogRow,
  type FactAnswer,
  type FactAnswers,
  type FinalizeResult,
  type NeedsYouItem,
  type PageRunContext,
  type DuplicateDecision,
  type PageAnswer,
  type PageReviewSummary,
  type PageReviewView,
} from '@seo/shared';
import { requireVerified, type OrgAccess, type SiteAccess } from '../auth/access';
import { db, schema } from '../db';
import type { PageReviewRow, ReportRow, RunRow, SiteRow } from '../db/schema';
import { badRequest, conflict, forbidden, HttpError, notFound, validationError } from '../lib/errors';
import { finalizeCall, publishCheckCall, siteAdmin, siteRows } from '../n8n/client';
import { quoteOf } from './runCredits';
import { settingsRow } from './admin/settings';
import { assertCredits, siteForecasts } from './billing';
import { assertBudget, assertPlatformCapacity, lockCompany } from './spend';
import { audit } from './audit';
import { emitRunsFailed } from './webhooks';
import { finalVersionFiles, isImageRow, type StoredFileRow } from './finalFiles';

// H3 (2026-10-28, n8n/seo-agent/docs/content-quality-2026-10-27): the review of a written page. The engine delivers the page with its
// status (ready / ready with questions / not ready), the grade of the delivered page and every client question (H1). Here the client:
//   answers the questions (saved per question; each answer is also a business fact of the website, stored once in sites.fact_answers and
//   sent to the engine, so later pages never ask it again), edits the page in the app (sanitised Markdown, checked again for free by the
//   engine's Publish Check), asks for the final version (engine mode `finalize`, a small charged run: only the sections the answers change
//   are rewritten, then the whole page is checked), and approves it (recorded, audited) before the existing publishing flows.
// One row per delivered page (page_reviews); a final version is a new report (`finalized_from`) sharing its original's row.

type Log = Pick<FastifyBaseLogger, 'warn' | 'error'>;
type P = Record<string, unknown>;
const obj = (v: unknown): P => (v && typeof v === 'object' && !Array.isArray(v) ? (v as P) : {});
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FACT_KEY = /^[\p{L}\p{N}_.&-]{1,80}$/u;

/** The engine's answer is awaited this long (the finalize workflow edits a few sections and checks the page). */
export const FINALIZE_TIMEOUT_MS = 5 * 60_000;

// ---------------------------------------------------------------------------------------------------------------------------------
// 1. Which report, which review
// ---------------------------------------------------------------------------------------------------------------------------------

/** A written page: a `content` report that carries the page itself. */
export function isPageReport(r: Pick<ReportRow, 'stage'> & { payload: unknown }): boolean {
  const p = obj(r.payload);
  return r.stage === 'content' && (str(p.markdown).trim().length > 50 || str(p.html).trim().length > 50);
}

/** answers are stored per report: the delivered page's under its question id, a final version's under `<report id>/<question id>` */
export const answerKey = (originalId: string, reportId: string, questionId: string): string => (reportId === originalId ? questionId : `${reportId}/${questionId}`);
export function answersFor(all: Record<string, PageAnswer> | null | undefined, originalId: string, reportId: string): Record<string, PageAnswer> {
  const out: Record<string, PageAnswer> = {};
  const prefix = `${reportId}/`;
  for (const [k, v] of Object.entries(all ?? {})) {
    if (k.startsWith('@')) continue;   // W0-B: a decision of the whole review (DUPLICATE_DECISION_KEY), not an answer of one version
    if (reportId === originalId ? !k.includes('/') : k.startsWith(prefix)) out[reportId === originalId ? k : k.slice(prefix.length)] = v;
  }
  return out;
}

/** W0-B (owner decision D2): the client's answer to "this website already has a page for the same search", kept once for the whole review. */
export function duplicateDecisionOf(all: Record<string, PageAnswer> | null | undefined): PageAnswer | null {
  const a = (all ?? {})[DUPLICATE_DECISION_KEY];
  return a && typeof a.text === 'string' && a.text.trim() ? a : null;
}
/** The decision as the engine reads it (FinalizeBody.duplicate_decision). */
export const duplicateDecisionBody = (a: PageAnswer | null): DuplicateDecision | null => (a ? { choice: 'differs', reason: a.text } : null);

interface Loaded {
  report: ReportRow;
  site: SiteRow | null;
  original: ReportRow;
  /** the latest final version of the original (null when none) */
  final: ReportRow | null;
  row: PageReviewRow | null;
}

async function reportRow(orgId: string, id: string): Promise<ReportRow | null> {
  if (!UUID.test(id)) return null;
  return (await db.query.reports.findFirst({ where: and(eq(schema.reports.orgId, orgId), eq(schema.reports.id, id)) })) ?? null;
}

/** The report, its website, the delivered original, its final version and the review row; 404 for anything but a written page of this company. */
export async function loadReview(orgId: string, reportId: unknown): Promise<Loaded> {
  if (typeof reportId !== 'string' || !UUID.test(reportId)) throw notFound('Report not found');
  const report = await reportRow(orgId, reportId);
  if (!report || !isPageReport(report)) throw notFound('Report not found');
  const from = str(obj(report.payload).finalized_from);
  const original = from ? ((await reportRow(orgId, from)) ?? report) : report;
  const row = (await db.query.pageReviews.findFirst({ where: and(eq(schema.pageReviews.orgId, orgId), eq(schema.pageReviews.reportId, original.id)) })) ?? null;
  const final = row?.finalReportId ? ((await reportRow(orgId, row.finalReportId)) ?? null) : from ? report : null;
  const siteId = report.siteId ?? original.siteId;
  const site = siteId ? ((await db.query.sites.findFirst({ where: and(eq(schema.sites.id, siteId), eq(schema.sites.orgId, orgId)) })) ?? null) : null;
  return { report, site, original, final, row };
}

async function ensureRow(orgId: string, l: Loaded): Promise<PageReviewRow> {
  if (l.row) return l.row;
  await db.insert(schema.pageReviews).values({ orgId, siteId: l.original.siteId ?? l.site?.id ?? null, reportId: l.original.id }).onConflictDoNothing({ target: schema.pageReviews.reportId });
  const row = await db.query.pageReviews.findFirst({ where: and(eq(schema.pageReviews.orgId, orgId), eq(schema.pageReviews.reportId, l.original.id)) });
  if (!row) throw notFound('Report not found');
  l.row = row;
  return row;
}

/** The version the client works on now: the final version once there is one, else the delivered page. */
const baseOf = (l: Pick<Loaded, 'original' | 'final'>): ReportRow => l.final ?? l.original;

// ---------------------------------------------------------------------------------------------------------------------------------
// 2. The view
// ---------------------------------------------------------------------------------------------------------------------------------

type FinalizeState = PageReviewView['finalize'];

/** The finalize state of a review row (pure; `run` is the finalize run when there is one). */
export function finalizeStateOf(row: Pick<PageReviewRow, 'finalRunId' | 'finalReportId' | 'finalError' | 'finalStartedAt'> | null, run: Pick<RunRow, 'status'> | null, now = Date.now()): { status: FinalizeState['status']; stale: boolean } {
  if (!row?.finalRunId && !row?.finalReportId && !row?.finalError) return { status: 'none', stale: false };
  const started = row?.finalStartedAt?.getTime() ?? 0;
  const waiting = !!row?.finalRunId && (!run || run.status === 'running' || run.status === 'accepted' || run.status === 'submitting') && started > 0;
  if (waiting && !row?.finalError) {
    if (now - started > FINALIZE_STALE_MINUTES * 60_000) return { status: 'failed', stale: true };
    return { status: 'running', stale: false };
  }
  if (row?.finalError) return { status: 'failed', stale: false };
  return { status: row?.finalReportId ? 'done' : 'none', stale: false };
}

/** Whether a final version is worth making now (anything changed since the last one started) and, if not, why (pure). */
export function finalizeNeedOf(o: { answers: Record<string, PageAnswer>; clientMarkdown: string | null; clientSavedAt: Date | null; since: Date | null; status: FinalizeState['status']; openCount?: number }): { needed: boolean; reason: string } {
  if (o.status === 'running') return { needed: false, reason: 'The final version is being made now.' };
  const after = (at: string | Date | null | undefined) => !o.since || (at ? new Date(at).getTime() > o.since.getTime() : false);
  const fresh = Object.values(o.answers).filter((a) => after(a.at));
  const edited = !!o.clientMarkdown && after(o.clientSavedAt);
  // W05-C: the first final version once every question is decided, even when all were left general ("Accept all" on a page whose
  // suggestions all need the client's own words)
  if (finalizeNeeded(fresh, edited, !o.since && o.openCount === 0)) return { needed: true, reason: '' };
  return { needed: false, reason: o.since ? 'Nothing changed since the last final version: answer a question or edit the page first.' : 'Answer a question or edit the page first: as it is, nothing would change.' };
}

type PublishState = PageReviewView['publish'];

/** Where the page stands on the website (pure): the engine's content log first (a live check), then what the CMS holds. */
export function publishStateOf(o: { log: Pick<ContentLogRow, 'status' | 'published_url' | 'published_at' | 'publish_note'> | null; cms: { remoteStatus: string; remoteUrl: string; updatedAt: Date }[] }): PublishState {
  const l = o.log;
  if (l && str(l.status) === 'published' && str(l.published_url))
    return { status: str(l.publish_note) ? 'published' : 'live_verified', url: str(l.published_url), at: str(l.published_at) || null };
  const live = o.cms.find((c) => c.remoteStatus === 'published');
  if (live) return { status: 'published', url: live.remoteUrl || null, at: live.updatedAt.toISOString() };
  const draft = o.cms.find((c) => c.remoteStatus === 'draft' || c.remoteStatus === 'unknown');
  if (draft) return { status: 'sent_draft', url: draft.remoteUrl || null, at: draft.updatedAt.toISOString() };
  return { status: 'not_published', url: null, at: null };
}

/** The content-log row of a page: by the engine request that wrote it, else the newest one of its keyword. */
export function logRowFor(rows: ContentLogRow[], requestId: string, keyword: string): ContentLogRow | null {
  const k = keyword.trim().toLowerCase();
  return rows.find((r) => requestId && str(r.request_id) === requestId) ?? rows.filter((r) => k && str(r.keyword).trim().toLowerCase() === k).sort((a, b) => str(b.started_at).localeCompare(str(a.started_at)))[0] ?? null;
}

async function publishState(orgId: string, l: Loaded): Promise<PublishState> {
  const ids = [l.original.id, ...(l.final ? [l.final.id] : [])];
  const cms = await db
    .select({ remoteStatus: schema.cmsItems.remoteStatus, remoteUrl: schema.cmsItems.remoteUrl, updatedAt: schema.cmsItems.updatedAt })
    .from(schema.cmsItems)
    .where(and(eq(schema.cmsItems.orgId, orgId), inArray(schema.cmsItems.lastReportId, ids), sql`${schema.cmsItems.remoteId} <> ''`));
  const p = obj(l.original.payload);
  const logs = l.site ? await siteRows<ContentLogRow>('contentLog', l.site.domain, { sortBy: 'started_at:desc', max: 1000 }).catch(() => [] as ContentLogRow[]) : [];
  return publishStateOf({ log: logRowFor(logs, str(p.request_id) || (l.original.requestId ?? ''), str(p.keyword) || str(obj(p.meta).primary_keyword)), cms });
}

export async function finalizeQuote(): Promise<{ credits: number; usd: number }> {
  const usd = keyCost('finalize');
  return { usd, credits: quoteOf(usd, await settingsRow()) };
}

export async function reviewView(a: OrgAccess, l: Loaded): Promise<PageReviewView> {
  const row = l.row;
  const base = baseOf(l);
  const viewed = l.report;
  const isFinal = viewed.id !== l.original.id;
  const payload = obj(viewed.payload);
  const facts = (l.site?.factAnswers ?? {}) as FactAnswers;
  const answers = answersFor(row?.answers, l.original.id, viewed.id);
  const run = row?.finalRunId ? ((await db.query.runs.findFirst({ where: eq(schema.runs.id, row.finalRunId) })) ?? null) : null;
  let fin = finalizeStateOf(row, run);
  if (fin.stale && row) {
    // the server restarted while it waited for the engine: the run failed, nothing is charged
    await failFinalize(row.id, row.finalRunId, 'No answer arrived from the engine in time. Nothing was charged; try again.').catch(() => undefined);
    fin = { status: 'failed', stale: false };
  }
  const baseAnswers = answersFor(row?.answers, l.original.id, base.id);
  const decision = duplicateDecisionOf(row?.answers);
  const questions = questionsOf(payload);
  const open = openQuestions(questions, answers, facts);
  const openBase = openQuestions(questionsOf(obj(base.payload)), baseAnswers, facts).length;
  const need = finalizeNeedOf({ answers: { ...baseAnswers, ...(decision ? { [DUPLICATE_DECISION_KEY]: decision } : {}) }, clientMarkdown: row?.clientMarkdown ?? null, clientSavedAt: row?.clientSavedAt ?? null, since: row?.finalReportId ? (row.finalStartedAt ?? null) : null, status: fin.status, openCount: openBase });
  // W0-B (D2): the website's page this one duplicates, while that blocker is open on the delivered page, and what the client decided
  const dupPages = duplicatePagesOf(obj(l.original.payload));
  const publish = await publishState(a.org.id, l);
  const delivery = deliveryOf(payload);
  const bp = obj(base.payload);
  const bmeta = obj(bp.meta);
  const approvedReport = row?.approvedReportId ?? null;
  const view: Omit<PageReviewView, 'people'> = {
    reportId: viewed.id,
    siteId: viewed.siteId ?? l.original.siteId ?? null,
    keyword: str(payload.keyword) || str(obj(payload.meta).primary_keyword),
    delivery,
    questions: questions.map((q) => ({ ...q, stored: storedFactFor(q, facts) })),
    answers,
    // W0-A (2026-10-29): read-time repair of a report written before the meta fix ("Slug: ..." as its description): shown as missing
    delivered: (() => { const md = metaDescriptionView(bmeta.meta_description); return { markdown: str(bp.markdown), title: str(bmeta.title), metaDescription: md.text, metaDescriptionNote: md.note, slug: str(bmeta.slug) }; })(),
    clientVersion: row?.clientMarkdown != null && row.clientSavedAt
      ? { markdown: row.clientMarkdown, savedAt: row.clientSavedAt.toISOString(), savedBy: row.clientSavedBy ?? null, check: row.clientCheck ?? null }
      : null,
    finalize: {
      status: fin.status,
      runId: row?.finalRunId ?? null,
      reportId: row?.finalReportId ?? null,
      error: fin.status === 'failed' ? (row?.finalError ?? 'The final version could not be made. Nothing was charged; try again.') : null,
      startedAt: row?.finalStartedAt?.toISOString() ?? null,
      quote: await finalizeQuote(),
      needed: need.needed,
      reason: need.reason,
    },
    approval: row?.approvedAt && approvedReport ? { approvedAt: row.approvedAt.toISOString(), approvedBy: row.approvedBy ?? null, reportId: approvedReport } : null,
    publish,
    stage: reviewStage({ delivery, openQuestions: open.length, finalize: { status: fin.status }, isFinal, approved: !!row?.approvedAt, publish: publish.status }),
    isFinal,
    finalOf: isFinal ? l.original.id : null,
    duplicate: dupPages.length
      ? {
          pages: dupPages,
          decision: decision ? { choice: 'differs', reason: decision.text, at: decision.at, by: decision.by ?? null } : null,
          rewrite: { keyword: str(obj(l.original.payload).keyword) || str(obj(obj(l.original.payload).meta).primary_keyword), pageType: str(obj(obj(l.original.payload).meta).page_type), country: str(obj(l.original.payload).country) },
        }
      : null,
  };
  return { ...view, people: await peopleOf(reviewPersonIds(view)) };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The names behind the user ids a review carries (name, else e-mail, else "a team member" for a deleted user), so the page says
 * "Approved by Sara" and never prints an internal id.
 */
export async function peopleOf(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const valid = [...new Set(ids)].filter((id) => UUID_RE.test(id));
  const users = valid.length ? await db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email }).from(schema.users).where(inArray(schema.users.id, valid)) : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  for (const id of ids) out[id] = personDisplayName(byId.get(id) ?? null);
  return out;
}

export async function getReview(a: OrgAccess, reportId: unknown): Promise<PageReviewView> {
  return reviewView(a, await loadReview(a.org.id, reportId));
}

// ---------------------------------------------------------------------------------------------------------------------------------
// 3. Answers, and the business facts they fill
// ---------------------------------------------------------------------------------------------------------------------------------

export const answersSchema = z.object({
  answers: z
    .array(z.object({ questionId: z.string().trim().min(1).max(40), decision: z.enum(ANSWER_DECISIONS), text: z.string().max(2000).optional() }))
    .min(1, 'Answer at least one question')
    .max(200),
});

/** The answers to store and the facts they fill, or the first problem (pure). */
export function applyAnswers(o: {
  questions: ClientQuestion[];
  input: { questionId: string; decision: AnswerDecision; text?: string }[];
  stored: Record<string, PageAnswer>;
  facts: FactAnswers;
  originalId: string;
  reportId: string;
  userId: string | null;
  at: string;
  fromPrefill?: boolean;
}): { answers: Record<string, PageAnswer>; facts: FactAnswers; changed: number; problems: Record<string, string> } {
  const answers = { ...o.stored };
  const facts = { ...o.facts };
  const problems: Record<string, string> = {};
  let changed = 0;
  for (const x of o.input) {
    const q = o.questions.find((y) => y.id === x.questionId);
    if (!q) {
      problems[x.questionId] = 'This question is not on this page.';
      continue;
    }
    const text = plainWords(x.text ?? '');
    const why = answerProblem(q, x.decision, text);
    if (why) {
      problems[x.questionId] = why;
      continue;
    }
    const a: PageAnswer = { questionId: q.id, factKey: q.fact_key, decision: x.decision, text: x.decision === 'edit' || x.decision === 'answer' ? text : '', at: o.at, by: o.userId, ...(o.fromPrefill ? { fromPrefill: true } : {}) };
    answers[answerKey(o.originalId, o.reportId, q.id)] = a;
    const f = FACT_KEY.test(q.fact_key) ? factOf(q, a, o.reportId) : null;
    if (f) facts[q.fact_key] = f;
    changed++;
  }
  return { answers, facts, changed, problems };
}

/** The website's facts to the engine (Site Admin `facts`), only for a tracked verified website; a failure is logged and the save stands. */
export async function syncFacts(site: SiteRow, facts: FactAnswers, log?: Log | null): Promise<void> {
  if (!site.verifiedAt || !['active', 'paused'].includes(site.trackingStatus)) return;
  await siteAdmin({
    action: 'facts',
    domain: site.domain,
    site_id: n8nSiteId(site.domain),
    business_facts: site.businessFacts.slice(0, 2000),
    fact_answers: Object.fromEntries(Object.entries(facts).map(([k, f]) => [k, { decision: f.decision, text: f.text }])),
    request_id: `app-facts-${site.id}-${Date.now().toString(36)}`,
  }).catch((err) => log?.warn({ site: site.domain, err: String((err as Error)?.message ?? err) }, 'business facts not sent to the engine'));
}

async function saveAnswers(a: OrgAccess, req: FastifyRequest | null, l: Loaded, input: { questionId: string; decision: AnswerDecision; text?: string }[], fromPrefill: boolean): Promise<PageReviewView> {
  const row = await ensureRow(a.org.id, l);
  const questions = questionsOf(obj(l.report.payload));
  const facts = (l.site?.factAnswers ?? {}) as FactAnswers;
  const r = applyAnswers({ questions, input, stored: row.answers ?? {}, facts, originalId: l.original.id, reportId: l.report.id, userId: a.user.id, at: new Date().toISOString(), fromPrefill });
  if (Object.keys(r.problems).length && !r.changed) throw new HttpError(400, Object.values(r.problems)[0]!, 'validation', r.problems);
  const [saved] = await db.update(schema.pageReviews).set({ answers: r.answers, updatedAt: new Date() }).where(eq(schema.pageReviews.id, row.id)).returning();
  l.row = saved!;
  if (l.site && JSON.stringify(r.facts) !== JSON.stringify(l.site.factAnswers ?? {})) {
    const [s] = await db.update(schema.sites).set({ factAnswers: r.facts, updatedAt: new Date() }).where(eq(schema.sites.id, l.site.id)).returning();
    l.site = s ?? l.site;
    await syncFacts(l.site, r.facts, req?.log);
  }
  await audit(req, a.org.id, { action: 'page.answered', target: { type: 'report', id: l.report.id, label: str(obj(l.report.payload).keyword) || l.report.title }, details: { answered: r.changed, decisions: input.map((x) => x.decision), oneClick: fromPrefill } });
  return reviewView(a, l);
}

export async function putAnswers(a: OrgAccess, req: FastifyRequest | null, reportId: unknown, body: unknown): Promise<PageReviewView> {
  const parsed = answersSchema.safeParse(body ?? {});
  if (!parsed.success) throw validationError(parsed.error);
  return saveAnswers(a, req, await loadReview(a.org.id, reportId), parsed.data.answers, false);
}

/**
 * W0-B (owner decision D2): "this website already has a page for the same search". The page is published only as an update of that page
 * (the report offers a page run that rewrites it, quoted and charged as a page) or with the client's reason, recorded here, sent with the
 * next final version and shown on it; the grade keeps its limit for fit. `choice: null` takes the reason back.
 */
export const decisionSchema = z.object({ choice: z.enum(['differs']).nullable(), reason: z.string().max(2000).optional() });

export async function putDecision(a: OrgAccess, req: FastifyRequest | null, reportId: unknown, body: unknown): Promise<PageReviewView> {
  const parsed = decisionSchema.safeParse(body ?? {});
  if (!parsed.success) throw validationError(parsed.error);
  const l = await loadReview(a.org.id, reportId);
  if (l.row?.approvedAt) throw conflict('This page is approved: its decisions can no longer change.', 'approved');
  const answers = { ...(l.row?.answers ?? {}) };
  if (parsed.data.choice === null) {
    if (!(DUPLICATE_DECISION_KEY in answers)) return reviewView(a, l);
    delete answers[DUPLICATE_DECISION_KEY];
  } else {
    if (!duplicatePagesOf(obj(l.original.payload)).length) throw badRequest('This page has no other page of your website for the same search, so there is nothing to decide.');
    const reason = plainWords(parsed.data.reason ?? '').replace(/\s+/g, ' ').trim();
    const why = duplicateReasonProblem(reason);
    if (why) throw badRequest(why);
    answers[DUPLICATE_DECISION_KEY] = { questionId: DUPLICATE_DECISION_KEY, factKey: '', decision: 'answer', text: reason, at: new Date().toISOString(), by: a.user.id };
  }
  const row = await ensureRow(a.org.id, l);
  const [saved] = await db.update(schema.pageReviews).set({ answers, updatedAt: new Date() }).where(eq(schema.pageReviews.id, row.id)).returning();
  l.row = saved!;
  await audit(req, a.org.id, { action: 'page.duplicate_decision', target: { type: 'report', id: l.original.id, label: str(obj(l.original.payload).keyword) || l.original.title }, details: { choice: parsed.data.choice ?? 'cleared' } });
  return reviewView(a, l);
}

/**
 * "Accept all suggestions" (W05-C, 2026-10-30): every open yes-or-no question that has a suggestion is confirmed; every other open question
 * is left general on this page (never answered with a suggestion: W0-E, 3299 stored a homepage slogan as proof), so the final version can be
 * made. A stored fact is not asked, so not answered; a question left general here is not stored and a later page may ask it again.
 */
export async function acceptPrefilled(a: OrgAccess, req: FastifyRequest | null, reportId: unknown): Promise<PageReviewView> {
  const l = await loadReview(a.org.id, reportId);
  const questions = questionsOf(obj(l.report.payload));
  const open = openQuestions(questions, answersFor(l.row?.answers, l.original.id, l.report.id), (l.site?.factAnswers ?? {}) as FactAnswers);
  const input = acceptAllPlan(open);
  if (!input.length) throw badRequest('Every question on this page is already answered or decided. Change an answer one by one if you need to.');
  return saveAnswers(a, req, l, input, true);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// 4. The client's own version (the in-app editor)
// ---------------------------------------------------------------------------------------------------------------------------------

export const versionSchema = z.object({ markdown: z.string().max(PAGE_MARKDOWN_MAX + 20_000, 'The page is too long to save') });

/** The free check of the client's version: the engine's Publish Check (the deterministic half of the content gate). */
async function checkVersion(orgId: string, l: Loaded, md: string, openCount: number): Promise<ReturnType<typeof pageCheckOf>> {
  const p = obj(baseOf(l).payload);
  const meta = obj(p.meta);
  const keyword = (str(p.keyword) || str(meta.primary_keyword) || l.report.title).slice(0, 120);
  const facts = Object.values((l.site?.factAnswers ?? {}) as FactAnswers).map((f) => f.text).filter(Boolean);
  const at = new Date().toISOString();
  const words = md.trim().split(/\s+/).filter(Boolean).length;
  if (words < 50) return pageCheckOf({ ran: false, note: 'The page is shorter than 50 words, so it was not checked.' }, openCount, at);
  const res = await publishCheckCall(
    {
      markdown: pageMarkdownWithMeta(md, { title: str(meta.title), meta_description: cleanMetaDescription(meta.meta_description), slug: str(meta.slug) }),   // W0-A: never "Slug: ..."
      keyword,
      ...(l.site ? { domain: l.site.domain, country: l.site.country } : {}),
      ...(str(meta.page_type) ? { page_type: str(meta.page_type).slice(0, 60) } : {}),
      business_facts: [l.site?.businessFacts ?? '', ...facts].filter(Boolean).join('\n').slice(0, 5000),
    },
    orgId,
  ).catch(() => null);
  if (!res || res.kind !== 'answered' || res.status !== 200) return pageCheckOf({ ran: false }, openCount, at);
  return pageCheckOf({ ran: true, json: res.json }, openCount, at);
}

export async function putVersion(a: OrgAccess, req: FastifyRequest | null, reportId: unknown, body: unknown): Promise<PageReviewView> {
  const parsed = versionSchema.safeParse(body ?? {});
  if (!parsed.success) throw validationError(parsed.error);
  const md = sanitizeMarkdown(parsed.data.markdown);
  if (!md.trim()) throw badRequest('The page is empty: write something, or go back to the delivered version.');
  const l = await loadReview(a.org.id, reportId);
  const row = await ensureRow(a.org.id, l);
  const open = openQuestions(questionsOf(obj(baseOf(l).payload)), answersFor(row.answers, l.original.id, baseOf(l).id), (l.site?.factAnswers ?? {}) as FactAnswers).length;
  const check = await checkVersion(a.org.id, l, md, open);
  const [saved] = await db
    .update(schema.pageReviews)
    .set({ clientMarkdown: md, clientSavedAt: new Date(), clientSavedBy: a.user.id, clientCheck: check, updatedAt: new Date() })
    .where(eq(schema.pageReviews.id, row.id))
    .returning();
  l.row = saved!;
  await audit(req, a.org.id, { action: 'page.edited', target: { type: 'report', id: l.report.id, label: str(obj(l.report.payload).keyword) || l.report.title }, details: { characters: md.length, check: check.status } });
  return reviewView(a, l);
}

export async function deleteVersion(a: OrgAccess, req: FastifyRequest | null, reportId: unknown): Promise<PageReviewView> {
  const l = await loadReview(a.org.id, reportId);
  if (l.row?.clientMarkdown != null) {
    const [saved] = await db.update(schema.pageReviews).set({ clientMarkdown: null, clientSavedAt: null, clientSavedBy: null, clientCheck: null, updatedAt: new Date() }).where(eq(schema.pageReviews.id, l.row.id)).returning();
    l.row = saved!;
    await audit(req, a.org.id, { action: 'page.edit_reverted', target: { type: 'report', id: l.report.id, label: l.report.title } });
  }
  return reviewView(a, l);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// 5. The final version
// ---------------------------------------------------------------------------------------------------------------------------------

async function failFinalize(rowId: string, runId: string | null, error: string): Promise<void> {
  await db.update(schema.pageReviews).set({ finalError: error, updatedAt: new Date() }).where(eq(schema.pageReviews.id, rowId));
  if (runId) {
    const done = await db
      .update(schema.runs)
      .set({ status: 'failed', error, completedAt: new Date() })
      .where(and(eq(schema.runs.id, runId), inArray(schema.runs.status, ['submitting', 'accepted', 'running'])))
      .returning({ id: schema.runs.id });
    if (done.length) void emitRunsFailed(done.map((r) => r.id)).catch(() => undefined);
  }
}

/** The engine's answer as an outcome (pure): the result, or a plain reason and whether money may have been spent. */
export function interpretFinalize(res: { kind: 'answered' | 'unreachable' | 'timeout'; status: number; json: P }): { ok: true; result: FinalizeResult } | { ok: false; error: string } {
  if (res.kind === 'unreachable') return { ok: false, error: 'The engine is not reachable right now. Nothing was charged; try again in a few minutes.' };
  if (res.kind === 'timeout') return { ok: false, error: 'The final version took too long. Nothing was charged; try again in a few minutes.' };
  const j = res.json;
  if (res.status === 200 && j.ok === true && str(j.markdown).trim().length > 50) return { ok: true, result: j as unknown as FinalizeResult };
  if (res.status === 404) return { ok: false, error: 'Making final versions is not switched on in the engine yet. Nothing was charged.' };
  if (res.status === 400) return { ok: false, error: `The engine could not use this page${str(j.error) ? ` (${plainWords(str(j.error)).slice(0, 200)})` : ''}. Nothing was charged.` };
  return { ok: false, error: 'The final version could not be made right now. Nothing was charged; try again in a few minutes.' };
}

/** What the run is called in the runs list. */
export const finalizeTitle = (keyword: string) => `Final version: "${keyword || 'page'}"`;

/** Starts the final version: a charged run, answered at once ("running"); the engine is called in the background. */
export async function startFinalize(a: OrgAccess, req: FastifyRequest | null, reportId: unknown, opts: { wait?: boolean } = {}): Promise<PageReviewView> {
  const l = await loadReview(a.org.id, reportId);
  const { org, user } = a;
  if (org.disabled) throw forbidden('This company is disabled. Contact the platform administrator.');
  if (user.suspendedAt) throw forbidden('Your access is suspended. Contact the company owner.');
  if (!l.site) throw badRequest('This page was written without one of your websites, so it cannot be finalised here.');
  requireVerified(l.site);
  const row = await ensureRow(a.org.id, l);
  const run0 = row.finalRunId ? ((await db.query.runs.findFirst({ where: eq(schema.runs.id, row.finalRunId) })) ?? null) : null;
  const st = finalizeStateOf(row, run0);
  if (st.status === 'running') throw conflict('The final version is being made now. It appears here in a minute or two.', 'finalize_running');
  const base = baseOf(l);
  const baseAnswers = answersFor(row.answers, l.original.id, base.id);
  const decision = duplicateDecisionOf(row.answers);
  const openBase = openQuestions(questionsOf(obj(base.payload)), baseAnswers, (l.site?.factAnswers ?? {}) as FactAnswers).length;
  const need = finalizeNeedOf({ answers: { ...baseAnswers, ...(decision ? { [DUPLICATE_DECISION_KEY]: decision } : {}) }, clientMarkdown: row.clientMarkdown, clientSavedAt: row.clientSavedAt, since: row.finalReportId ? row.finalStartedAt : null, status: st.status, openCount: openBase });
  if (!need.needed) throw conflict(need.reason, 'finalize_not_needed');
  const quote = await finalizeQuote();
  const keyword = str(obj(base.payload).keyword) || str(obj(obj(base.payload).meta).primary_keyword);
  const requestId = `app-fin-${randomUUID()}`;
  await siteForecasts(org.id).catch(() => []);
  const run = await db.transaction(async (tx) => {
    await lockCompany(tx, org.id);
    if (!org.creditsEnforced) await assertBudget(tx, org, quote.usd, 'This final version');
    else await assertPlatformCapacity(tx, quote.usd);
    const quoted = await assertCredits(tx, org, quote.usd, 'This final version');
    // a second click in the same moment: the row is taken under the company's lock
    const fresh = await tx.query.pageReviews.findFirst({ where: eq(schema.pageReviews.id, row.id) });
    if (fresh?.finalRunId && fresh.finalRunId !== row.finalRunId) throw conflict('The final version is being made now.', 'finalize_running');
    const [r] = await tx
      .insert(schema.runs)
      .values({
        orgId: org.id,
        siteId: l.site!.id,
        userId: user.id,
        mode: 'finalize',
        title: finalizeTitle(keyword),
        status: 'running',
        requestId,
        input: { mode: 'finalize', siteId: l.site!.id, reportId: base.id, originalReportId: l.original.id, keyword, clientEdited: !!row.clientMarkdown },
        estimatedCostUsd: quote.usd,
        quotedCredits: quoted,
        etaMinutes: 3,
        acceptedAt: new Date(),
      })
      .returning();
    await tx.update(schema.pageReviews).set({ finalRunId: r!.id, finalStartedAt: new Date(), finalError: null, updatedAt: new Date() }).where(eq(schema.pageReviews.id, row.id));
    return r!;
  });
  await audit(req, org.id, { action: 'page.finalize_started', target: { type: 'report', id: l.original.id, label: keyword || l.original.title }, details: { runId: run.id, credits: run.quotedCredits, clientEdited: !!row.clientMarkdown } });
  const body: P = { ...finalizeBody({
    requestId,
    domain: l.site.domain,
    siteId: n8nSiteId(l.site.domain),
    payload: obj(base.payload),
    markdown: row.clientMarkdown ?? str(obj(base.payload).markdown),
    clientEdited: row.clientMarkdown != null,
    questions: questionsOf(obj(base.payload)),
    answers: baseAnswers,
    businessFacts: l.site.businessFacts,
    facts: (l.site.factAnswers ?? {}) as FactAnswers,
    // W0-B (PLAN Fix 2): the page run's blockers and research come from the ORIGINAL report, never the final version being improved
    original: obj(l.original.payload),
    duplicateDecision: decision && duplicatePagesOf(obj(l.original.payload)).length ? duplicateDecisionBody(decision) : null,
  }) };
  const work = runFinalize({ orgId: org.id, siteId: l.site.id, rowId: row.id, runId: run.id, base, original: l.original, requestId, body, log: req?.log ?? null });
  if (opts.wait) await work;
  else void work.catch(() => undefined);
  return getReview(a, l.report.id);
}

/** The engine call and what follows it: the final version's report, the run settled, the review linked; or the run failed (not charged). */
export async function runFinalize(o: { orgId: string; siteId: string; rowId: string; runId: string; base: ReportRow; original: ReportRow; requestId: string; body: P; log: Log | null }): Promise<void> {
  let outcome: ReturnType<typeof interpretFinalize>;
  const originalFilesP = originalImageRows(o.orgId, o.original.id).catch((err) => {
    o.log?.warn({ err: String((err as Error)?.message ?? err) }, 'finalize: the first version\'s images could not be read');
    return [] as StoredFileRow[];
  });
  try {
    outcome = interpretFinalize(await finalizeCall(o.body, o.orgId, FINALIZE_TIMEOUT_MS));
  } catch (err) {
    outcome = { ok: false, error: 'The final version could not be made right now. Nothing was charged; try again in a few minutes.' };
    o.log?.warn({ err: String((err as Error)?.message ?? err) }, 'finalize call failed');
  }
  if (!outcome.ok) {
    await failFinalize(o.rowId, o.runId, outcome.error);
    return;
  }
  // the delivered page's questions still open after this finalize stay on the final version (the engine sends only new ones)
  const answeredIds = (Array.isArray(o.body.answers) ? o.body.answers : []).map((a) => str(obj(a).id)).filter(Boolean);
  const storedKeys = (Array.isArray(o.body.stored_fact_keys) ? o.body.stored_fact_keys : []).map((k) => String(k));
  const result = { ...outcome.result, client_questions: carryOpenQuestions(questionsOf(obj(o.base.payload)), outcome.result.client_questions ?? [], answeredIds, storedKeys) };
  const payload0 = finalReportPayload(obj(o.base.payload), result, { originalReportId: o.original.id, requestId: o.requestId, pageRun: (o.body.page_run as PageRunContext | undefined) ?? null });
  // W0-G (PLAN Fix 7): the final version's own downloads (its HTML / Markdown / meta.json, the PDF and Word file the engine printed, the
  // first version's images, read before the engine call); a file that cannot be read never stops the final version from being stored
  const originalFiles = await originalFilesP;
  const { payload, files } = finalVersionFiles(payload0, obj(outcome.result as unknown).files, originalFiles);
  const d = deliveryOf(payload);
  const cost = Number((payload.run_ledger as P).ai_usd) + Number((payload.run_ledger as P).dataforseo_usd);
  const keyword = str(payload.keyword) || str(obj(payload.meta).primary_keyword);
  try {
    await db.transaction(async (tx) => {
      const [rep] = await tx
        .insert(schema.reports)
        .values({
          orgId: o.orgId,
          runId: o.runId,
          siteId: o.siteId,
          stage: 'content',
          status: o.original.status,
          title: finalizeTitle(keyword),
          requestId: o.requestId,
          summary: { ...(o.original.summary ?? {}), delivery: d.status, grade: d.grade, finalVersion: true },
          payload,
        })
        .returning({ id: schema.reports.id });
      await tx
        .update(schema.runs)
        .set({
          status: 'completed',
          completedAt: new Date(),
          lastStage: 'content',
          reportCount: 1,
          actualCostUsd: Math.round(cost * 10000) / 10000,
          actualCostEstimated: (payload.run_ledger as P).ai_cost_estimated === true,
          error: null,
        })
        .where(eq(schema.runs.id, o.runId));
      // the client's version is now part of the final version: it is not applied twice
      await tx.update(schema.pageReviews).set({ finalReportId: rep!.id, finalError: null, clientMarkdown: null, clientSavedAt: null, clientSavedBy: null, clientCheck: null, updatedAt: new Date() }).where(eq(schema.pageReviews.id, o.rowId));
      // W0-G: the final version's downloads, in the same transaction (the report never shows without its files) but behind a savepoint:
      // files that cannot be stored are logged and never cost the client the final version itself
      if (files.length)
        await tx
          .transaction(async (sp) => {
            await sp.insert(schema.files).values(files.map((f) => ({ id: f.id, orgId: o.orgId, reportId: rep!.id, field: f.field, kind: f.kind, fileName: f.fileName, mimeType: f.mimeType, size: f.size, data: f.data })));
          })
          .catch((err) => o.log?.warn({ err: String((err as Error)?.message ?? err) }, 'finalize: the final version\'s files were not stored'));
    });
  } catch (err) {
    o.log?.error({ err: String((err as Error)?.message ?? err) }, 'finalize result not stored');
    await failFinalize(o.rowId, o.runId, 'The final version arrived but could not be saved. Nothing was charged; try again.');
  }
}

/** The original report's image rows with their bytes (W0-G): the final version gets copies of them. */
async function originalImageRows(orgId: string, reportId: string): Promise<StoredFileRow[]> {
  const head = await db
    .select({ id: schema.files.id, field: schema.files.field, kind: schema.files.kind, fileName: schema.files.fileName, mimeType: schema.files.mimeType, size: schema.files.size })
    .from(schema.files)
    .where(and(eq(schema.files.orgId, orgId), eq(schema.files.reportId, reportId)));
  const ids = head.filter((f) => isImageRow(f)).map((f) => f.id).slice(0, 12);
  if (!ids.length) return [];
  return db
    .select({ id: schema.files.id, field: schema.files.field, kind: schema.files.kind, fileName: schema.files.fileName, mimeType: schema.files.mimeType, size: schema.files.size, data: schema.files.data })
    .from(schema.files)
    .where(and(eq(schema.files.orgId, orgId), inArray(schema.files.id, ids)));
}

// ---------------------------------------------------------------------------------------------------------------------------------
// 6. Approval
// ---------------------------------------------------------------------------------------------------------------------------------

export const approveSchema = z.object({ versionReportId: z.string().uuid().optional() });

export async function approve(a: OrgAccess, req: FastifyRequest | null, reportId: unknown, body: unknown): Promise<PageReviewView> {
  const parsed = approveSchema.safeParse(body ?? {});
  if (!parsed.success) throw validationError(parsed.error);
  const l = await loadReview(a.org.id, reportId);
  const target = parsed.data.versionReportId ? [l.original, l.final].find((r) => r?.id === parsed.data.versionReportId) : baseOf(l);
  if (!target) throw badRequest('Approve the delivered page or its final version.');
  const p = obj(target.payload);
  const d = deliveryOf(p);
  if (d.status === 'not_ready') throw new HttpError(409, `This page is not ready to publish: ${d.blocking[0]?.text ?? 'the check found a problem to fix first'}. Fix it in the editor, then make the final version.`, 'not_ready');
  const r = cmsReadiness({ stage: target.stage, status: target.status, payload: p, siteDomain: l.site?.domain ?? null }, cmsPage(p));
  const real = r.blockers.filter((b) => b.code !== 'no_website');
  if (real.length) throw new HttpError(409, real[0]!.message, 'not_ready');
  const row = await ensureRow(a.org.id, l);
  const [saved] = await db.update(schema.pageReviews).set({ approvedAt: new Date(), approvedBy: a.user.id, approvedReportId: target.id, updatedAt: new Date() }).where(eq(schema.pageReviews.id, row.id)).returning();
  l.row = saved!;
  await audit(req, a.org.id, { action: 'page.approved', target: { type: 'report', id: target.id, label: str(p.keyword) || target.title }, details: { version: target.id === l.original.id ? 'delivered' : 'final', grade: d.grade } });
  return reviewView(a, l);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// 7. The website's business details (the facts answered on pages)
// ---------------------------------------------------------------------------------------------------------------------------------

export const factSchema = z.object({ decision: z.enum(['yes', 'edit', 'remove', 'general', 'answer']), text: z.string().max(2000).optional() });

/** One fact changed by hand (pure): refused with a reason, else the new map. */
export function setFact(facts: FactAnswers, key: string, input: { decision: FactAnswer['decision']; text?: string }, by: string | null, at: string): { facts: FactAnswers } | { error: string } {
  if (!FACT_KEY.test(key)) return { error: 'Unknown business detail.' };
  const prev = facts[key];
  const text = plainWords(input.text ?? '');
  const needsText = input.decision === 'yes' || input.decision === 'edit' || input.decision === 'answer';
  if (needsText && !text && !(input.decision === 'yes' && prev?.text)) return { error: 'Write the detail as it may be published, or choose "Keep it general".' };
  if (text.length > 600) return { error: 'Keep it under 600 characters.' };
  if (/[<>]/.test(text)) return { error: 'Plain text only, please (no < or > characters).' };
  return { facts: { ...facts, [key]: { decision: input.decision, text: needsText ? text || prev?.text || '' : '', question: prev?.question ?? '', category: prev?.category ?? key.split('.')[0] ?? 'detail', at, by, reportId: prev?.reportId ?? null } } };
}

export async function getFacts(a: SiteAccess): Promise<{ facts: FactAnswers }> {
  return { facts: (a.site.factAnswers ?? {}) as FactAnswers };
}

export async function putFact(a: SiteAccess, req: FastifyRequest | null, key: string, body: unknown): Promise<{ facts: FactAnswers }> {
  const parsed = factSchema.safeParse(body ?? {});
  if (!parsed.success) throw validationError(parsed.error);
  const r = setFact((a.site.factAnswers ?? {}) as FactAnswers, key, parsed.data, a.user.id, new Date().toISOString());
  if ('error' in r) throw badRequest(r.error);
  return writeFacts(a, req, r.facts, key, 'set');
}

export async function deleteFact(a: SiteAccess, req: FastifyRequest | null, key: string): Promise<{ facts: FactAnswers }> {
  const facts = { ...((a.site.factAnswers ?? {}) as FactAnswers) };
  if (!(key in facts)) throw notFound('Business detail not found');
  delete facts[key];
  return writeFacts(a, req, facts, key, 'deleted');
}

async function writeFacts(a: SiteAccess, req: FastifyRequest | null, facts: FactAnswers, key: string, what: 'set' | 'deleted'): Promise<{ facts: FactAnswers }> {
  const [s] = await db.update(schema.sites).set({ factAnswers: facts, updatedAt: new Date() }).where(eq(schema.sites.id, a.site.id)).returning();
  await syncFacts(s ?? a.site, facts, req?.log);
  await audit(req, a.org.id, { action: 'facts.changed', target: { type: 'site', id: a.site.id, label: a.site.domain }, details: { key, what, decision: what === 'set' ? FACT_DECISION_LABEL[facts[key]!.decision] : null } });
  return { facts };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// 8. The content board and the Pipeline's Needs you
// ---------------------------------------------------------------------------------------------------------------------------------

interface PageRef {
  id: string;
  requestId: string | null;
  receivedAt: Date;
  payload: P;
}

/** The written pages of a website with only what the review needs from their payloads (no page text). */
async function pageRefs(orgId: string, siteId: string, limit = 80): Promise<PageRef[]> {
  const rows = await db
    .select({
      id: schema.reports.id,
      requestId: schema.reports.requestId,
      receivedAt: schema.reports.receivedAt,
      payload: sql<P>`jsonb_build_object(
        'keyword', ${schema.reports.payload}->'keyword', 'request_id', ${schema.reports.payload}->'request_id', 'finalized_from', ${schema.reports.payload}->'finalized_from',
        'qa_delivery_status', ${schema.reports.payload}->'qa_delivery_status', 'qa_client_questions', ${schema.reports.payload}->'qa_client_questions',
        'qa_grade', ${schema.reports.payload}->'qa_grade', 'qa_blocking', ${schema.reports.payload}->'qa_blocking', 'qa_reasons', ${schema.reports.payload}->'qa_reasons',
        'qa_not_ready', ${schema.reports.payload}->'qa_not_ready', 'qa_publishable', ${schema.reports.payload}->'qa_publishable',
        'meta', jsonb_build_object('primary_keyword', ${schema.reports.payload}->'meta'->'primary_keyword', 'content_score', ${schema.reports.payload}->'meta'->'content_score',
          'publishable', ${schema.reports.payload}->'meta'->'publishable', 'delivery_status', ${schema.reports.payload}->'meta'->'delivery_status',
          'client_questions', ${schema.reports.payload}->'meta'->'client_questions', 'grade', ${schema.reports.payload}->'meta'->'grade'),
        'has_page', (length(coalesce(${schema.reports.payload}->>'markdown', '')) > 50 or length(coalesce(${schema.reports.payload}->>'html', '')) > 50))`,
    })
    .from(schema.reports)
    .where(and(eq(schema.reports.orgId, orgId), eq(schema.reports.siteId, siteId), eq(schema.reports.stage, 'content')))
    .orderBy(desc(schema.reports.receivedAt))
    .limit(limit);
  return rows.filter((r) => obj(r.payload).has_page === true);
}

export interface SiteReviews {
  /** a delivered page's summary, by its report id */
  summaryOf(original: PageRef, log: ContentLogRow | null): PageReviewSummary;
  originals: PageRef[];
  /** the delivered page of a content-log row */
  pageFor(log: Pick<ContentLogRow, 'request_id' | 'keyword'>): PageRef | null;
}

export async function siteReviews(orgId: string, site: SiteRow): Promise<SiteReviews> {
  const refs = await pageRefs(orgId, site.id);
  const originals = refs.filter((r) => !str(r.payload.finalized_from));
  const ids = originals.map((r) => r.id);
  const rows = ids.length ? await db.select().from(schema.pageReviews).where(and(eq(schema.pageReviews.orgId, orgId), inArray(schema.pageReviews.reportId, ids))) : [];
  const byReport = new Map(rows.map((r) => [r.reportId, r]));
  const finals = new Map(refs.filter((r) => str(r.payload.finalized_from)).map((r) => [r.id, r]));
  const runIds = rows.map((r) => r.finalRunId).filter((x): x is string => !!x);
  const runs = runIds.length ? await db.select({ id: schema.runs.id, status: schema.runs.status }).from(schema.runs).where(inArray(schema.runs.id, runIds)) : [];
  const runOf = new Map(runs.map((r) => [r.id, r]));
  const cms = ids.length
    ? await db
        .select({ lastReportId: schema.cmsItems.lastReportId, remoteStatus: schema.cmsItems.remoteStatus, remoteUrl: schema.cmsItems.remoteUrl, updatedAt: schema.cmsItems.updatedAt })
        .from(schema.cmsItems)
        .where(and(eq(schema.cmsItems.orgId, orgId), eq(schema.cmsItems.siteId, site.id), sql`${schema.cmsItems.remoteId} <> ''`))
    : [];
  const facts = (site.factAnswers ?? {}) as FactAnswers;
  const kw = (r: PageRef) => (str(r.payload.keyword) || str(obj(r.payload.meta).primary_keyword)).trim().toLowerCase();
  return {
    originals,
    pageFor(log) {
      const rid = str(log.request_id);
      const k = str(log.keyword).trim().toLowerCase();
      return originals.find((r) => rid && (r.requestId === rid || str(r.payload.request_id) === rid)) ?? originals.find((r) => k && kw(r) === k) ?? null;
    },
    summaryOf(original, log) {
      const row = byReport.get(original.id) ?? null;
      const final = row?.finalReportId ? (finals.get(row.finalReportId) ?? null) : null;
      const base = final ?? original;
      const fin = finalizeStateOf(row, row?.finalRunId ? (runOf.get(row.finalRunId) ?? null) : null);
      const publish = publishStateOf({ log, cms: cms.filter((c) => c.lastReportId === original.id || (final && c.lastReportId === final.id)) });
      return reviewSummaryOf(base.id, base.payload, {
        answers: answersFor(row?.answers, original.id, base.id),
        facts,
        finalize: fin.status,
        isFinal: !!final,
        approved: !!row?.approvedAt,
        publish: publish.status,
      });
    },
  };
}

/** One "questions" item per written page with open questions, not approved or published (most impactful first, at most 5). */
export async function questionNeedsYou(orgId: string, site: SiteRow): Promise<NeedsYouItem[]> {
  const sr = await siteReviews(orgId, site);
  const logs = await siteRows<ContentLogRow>('contentLog', site.domain, { sortBy: 'started_at:desc', max: 1000 }).catch(() => [] as ContentLogRow[]);
  const seen = new Set<string>();
  const out: { item: NeedsYouItem; impact: number }[] = [];
  for (const r of sr.originals) {
    const keyword = str(r.payload.keyword) || str(obj(r.payload.meta).primary_keyword);
    const k = keyword.trim().toLowerCase();
    if (k && seen.has(k)) continue;   // the newest page of a keyword only
    if (k) seen.add(k);
    const s = sr.summaryOf(r, logRowFor(logs, r.requestId ?? str(r.payload.request_id), keyword));
    if (!['questions', 'final_ready', 'needs_work'].includes(s.stage) || s.answered >= s.questions) continue;   // W0-C: a page that needs work still gets its questions asked
    const qs = questionsOf(r.payload);
    const top = qs.find((q) => !storedFactFor(q, site.factAnswers as FactAnswers));
    const open = s.questions - s.answered;
    if (!top || open <= 0) continue;
    out.push({
      impact: top.impact,
      item: {
        id: `questions:${r.id}`,
        kind: 'questions',
        severity: 'info',
        title: `${open} ${open === 1 ? 'question' : 'questions'} on "${keyword || 'a written page'}"`,
        detail: `The page can be published as it is; your answers make it more specific. First: ${top.question.length > 160 ? `${top.question.slice(0, 157)}...` : top.question}`,
        action: { label: 'Answer them', reportId: s.reportId },
      },
    });
  }
  return out.sort((a, b) => b.impact - a.impact).slice(0, NEEDS_YOU_QUESTION_PAGES).map((x) => x.item);
}

