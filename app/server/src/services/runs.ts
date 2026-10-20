import { and, asc, desc, eq, gt, inArray, lt, ne, sql } from 'drizzle-orm';
import {
  buildN8nPayload,
  cleanDomain,
  compactBody,
  estimateRunCost,
  estimateRunMinutes,
  IDEMPOTENCY,
  isCycleRequestId,
  MODES,
  n8nSiteId,
  ladderPrefsSchema,
  LADDER_ID_RE,
  normKeyword,
  roleAtLeast,
  urlOnDomain,
  urlOnHost,
  type ModeId,
  type LadderPrefs,
  type LadderRow,
  type Report,
  type ReportFile,
  type Role,
  type Run,
  type RunCredits,
  type RunInput,
  type SiteContext,
} from '@seo/shared';
import { requireVerified, type OrgAccess } from '../auth/access';
import { config } from '../config';
import { db, schema } from '../db';
import type { OrgRow, ReportRow, RunRow, SiteRow } from '../db/schema';
import { safeEqual } from '../lib/crypto';
import { badRequest, forbidden, HttpError, notFound } from '../lib/errors';
import { insertRows, invalidateSite, siteRows, startRun, updateRows } from '../n8n/client';
import { assertGa4ForDomain } from './google';
import { extractFiles, shownFileKind } from './files';
import { applyLadderPrefs, markLadderWon } from './ladderSettings';
import { deliverReport } from './reportDelivery';
import { emitForCallback, emitRunsFailed } from './webhooks';
import { engineCostTable } from './engineCost';
import { assertBudget, assertPlatformCapacity, lockCompany } from './spend';
import { assertCredits, siteForecasts } from './billing';
import { customerError } from '../lib/customerError';
import { suspendedError } from '../auth/session';
import { engineCostEstimate, ledgerCost, stageOf, summarize, titleFor } from './summaries';
import { siteReadiness } from './readiness';

/**
 * R100: what the engine will reserve for this request, its own rolling figures (`engineCostTable`), the shipped table only when
 * n8n cannot be read. The budget check holds this number, so it must be the engine's, not a mirror of its defaults.
 */
export const estimateCost = async (input: RunInput): Promise<number> =>
  estimateRunCost(input.mode, input as unknown as Record<string, unknown>, (await engineCostTable()).calibration);
export const etaFor = (input: RunInput): number => estimateRunMinutes(input.mode, input as unknown as Record<string, unknown>);

export function runTitle(input: RunInput, site: SiteRow | null): string {
  const dom = site?.domain;
  switch (input.mode) {
    case 'verdict':
      return `Verdict: ${input.keyword}`;
    case 'keyword':
      return `${input.receiveContent ? 'Page' : 'Keyword report'}: ${input.keyword}`;
    case 'ladder':
      return `Ladder: ${input.keyword}`;
    case 'published':
      return `Publish check: ${input.keyword}`;
    case 'case_study':
      return `Case study: ${input.service}`;
    case 'audit':
      return `${input.reportType === 'full' ? 'Full SEO report' : 'Technical audit'}${dom ? ` · ${dom}` : ''}`;
    case 'discover':
      return `Keyword discovery${dom ? ` · ${dom}` : input.business ? ` · ${input.business.slice(0, 40)}` : ''}`;
    default:
      return `${MODES[input.mode].title}${dom ? ` · ${dom}` : ''}`;
  }
}

export function siteContext(site: SiteRow): SiteContext {
  return {
    domain: site.domain,
    country: site.country,
    business: site.business,
    customers: site.customers,
    goal: site.goal,
    tone: site.tone,
    cta: site.cta,
    businessFacts: site.businessFacts,
    competitors: site.competitors,
    brandNames: site.brandNames,
    ga4PropertyId: site.ga4PropertyId,
    timezone: site.timezone,
    services: site.services,
  };
}

export function callbackUrl(org: OrgRow): string {
  return `${config.callbackBaseUrl}/api/hooks/n8n/${org.hookToken}`;
}

// the company's spend (runs + keyword checks) and the locked budget check live in spend.ts
export { monthSpend, monthStart } from './spend';

/**
 * What a role may ask for: a new ladder's Auto / Manual and its place in the order (`ladderPrefs`) are ladder settings, so admins
 * only, a member's choices are dropped and the website's defaults apply, as for any ladder.
 */
export function inputForRole(input: RunInput, role: Role): RunInput {
  if (input.mode === 'ladder' && (input.ladderPrefs || input.ladderMode) && !roleAtLeast(role, 'admin')) return { ...input, ladderPrefs: undefined, ladderMode: undefined };
  return input;
}

/**
 * Keyword-first (SCHEDULING_KEYWORDS_PLAN.md §5.1 R-K1 / §14.5): who chose a new ladder's keyword and the mode it starts in. A person
 * never sends `system_announced` (only the server's level-3 announcement starts such a ladder); none = the person typed it. The start
 * mode is the admin's "Auto / Manual" choice of the flow (`ladderPrefs.mode`) when no `ladderMode` is given.
 */
export function ladderChoice(input: RunInput, auto: boolean): RunInput {
  if (input.mode !== 'ladder') return input;
  const chosenBy = input.chosenBy === 'system_announced' && !auto ? 'client_typed' : (input.chosenBy ?? (auto ? 'system_announced' : 'client_typed'));
  return { ...input, chosenBy, ladderMode: input.ladderMode ?? input.ladderPrefs?.mode };
}

export interface CreateRunOptions {
  /** 'auto': started by "Choose keywords for me" on the owner's behalf (its title says so; its reports count as automatic) */
  startedBy?: 'person' | 'auto';
  /** G4: the API key that asks (stored on the run; the run is still the key creator's, `a.user`) */
  apiKeyId?: string | null;
  /** G4: the caller's Idempotency-Key and the hash of its request, checked under the company lock, before the budget */
  idempotency?: { key: string; hash: string } | null;
  /** keyword-first: the keyword proposal this ladder run starts (kept on the run's input, so a restart can find the run it made) */
  proposalId?: string;
  /**
   * D3 (research/start): the website's one free keyword research at setup. The run holds and is charged nothing (quoted at 0 credits,
   * which caps every charge of it at 0) and skips the company's own credit and budget checks; the platform's daily ceiling still applies.
   * Only services/research.ts passes it, after claiming the domain's grant.
   */
  free?: boolean;
}

/** G4: the run an Idempotency-Key named in the last 24 hours, if any. */
export async function findIdempotentRun(orgId: string, key: string): Promise<RunRow | null> {
  return (
    (await db.query.runs.findFirst({
      where: and(eq(schema.runs.orgId, orgId), eq(schema.runs.idempotencyKey, key), gt(schema.runs.createdAt, new Date(Date.now() - IDEMPOTENCY.hours * 3_600_000))),
      orderBy: desc(schema.runs.createdAt),
    })) ?? null
  );
}

/** G4: the same Idempotency-Key with a different request. 422, like Stripe: the key names one request, never two. */
export const idempotencyMismatch = () =>
  new HttpError(422, 'This Idempotency-Key was already used for a different request in the last 24 hours. Use a new key for a new run.', 'idempotency_mismatch');

export async function createRun(a: OrgAccess, input: RunInput, opts: CreateRunOptions = {}): Promise<RunRow> {
  return (await createRunWithMeta(a, input, opts)).run;
}

/**
 * `createRun`, and whether the run is a replay of an earlier request with the same Idempotency-Key (nothing new was started), and the
 * engine's HTTP answer to the start (`engineStatus`: 202 accepted, a 4xx refusal, a 5xx, or 0 when no answer arrived; null on a replay).
 */
export async function createRunWithMeta(a: OrgAccess, input: RunInput, opts: CreateRunOptions = {}): Promise<{ run: RunRow; replayed: boolean; engineStatus?: number | null }> {
  const { org, user } = a;
  const auto = opts.startedBy === 'auto';
  if (org.disabled) throw forbidden('This company is disabled. Contact the platform administrator.');
  // admin panel: a suspended person starts nothing, through the app, an API key or MCP (their keys act as them), or auto-start
  if (user.suspendedAt) throw suspendedError();
  if (config.requireEmailVerification && !user.emailVerifiedAt) throw forbidden('Verify your e-mail address before starting runs (check your inbox, or resend the link from your account page).');

  let site: SiteRow | null = null;
  if (input.siteId) {
    site = (await db.query.sites.findFirst({ where: and(eq(schema.sites.id, input.siteId), eq(schema.sites.orgId, org.id)) })) ?? null;
    if (!site) throw badRequest('Choose one of your websites', { siteId: 'Unknown website' });
    // results are stored under the domain in n8n: only the verified owner may run against it
    requireVerified(site);
  } else if (MODES[input.mode].siteBound) {
    throw badRequest('Choose a website', { siteId: 'Required' });
  }
  // the SEO engine accepts an existing page only on the domain itself (www or not), not on a subdomain
  if (site && input.mode === 'keyword' && input.existingPageUrl && !urlOnHost(input.existingPageUrl, site.domain))
    throw badRequest(`The existing page must be on ${site.domain} (not a subdomain)`, { existingPageUrl: `Must be a page on ${site.domain}` });
  // a GA4 property is read with the shared service account: it must measure this site
  if (site && input.mode === 'track' && input.ga4PropertyId) await assertGa4ForDomain(input.ga4PropertyId, site.domain);
  if (site && input.mode === 'published' && !urlOnDomain(input.publishedUrl, site.domain))
    throw badRequest(`The published page must be on ${site.domain}`, { publishedUrl: `Must be a page on ${site.domain}` });
  input = ladderChoice(inputForRole(input, a.role), auto);

  // a typed keyword that is a planned page of one of the website's ladders is written as that ladder page (linked to the ladder,
  // tracked, marked "writing" so the Content Cadence moves on), exactly like "Write now" on the Pipeline page
  if (site && input.mode === 'keyword' && input.receiveContent && !input.ladder) {
    const page = await plannedLadderPage(site.domain, input.keyword);
    if (page) input = { ...input, keyword: page.keyword, ladder: page.ladder };
  }

  // P1 (2026-10-20, rehearsal §4 item 1): an Auto ladder start on a website without its author profile or business facts keeps its plan, and
  // the engine holds the first page (Ladder Plan, v5/code/_readiness.js) until both are on file: the run is quoted for the plan alone, and
  // the run says so. A Manual start writes nothing anyway. A caller's own `pagesHeld` is never trusted. Unreadable profile = not decided here.
  if (input.mode === 'ladder') {
    const held = site && input.ladderMode !== 'manual' ? await siteReadiness(site) : null;
    input = { ...input, pagesHeld: held && !held.ready ? 'profile' : undefined };
  }
  const estimated = await estimateCost(input);
  // the website's first tracking, kept on every re-save: the anchor of its weekly cycle (the engine accepts it within the last 6 days)
  const trackingStartedAt = site && input.mode === 'track' ? (site.trackingStartedAt ?? new Date()) : null;
  const body = compactBody(
    // ENGINE_EMAILS off: n8n gets no address at all, so it e-mails nothing; every result arrives here through the callback
    buildN8nPayload(input, site ? siteContext(site) : null, { callbackUrl: callbackUrl(org), email: config.engineEmails && input.emailCopy ? user.email : '' }),
  );
  if (trackingStartedAt) body.tracking_started_at = trackingStartedAt.toISOString();
  if (input.mode === 'keyword' && input.ladder && site) {
    // the ladder's links and, since P2-7, the word count its verdict set for this page (the engine clamps the brief to `ladder_words`)
    const { links, targetWords, targetUrl } = await ladderLinks(site.domain, input.ladder.id, input.ladder.rung, input.keyword);
    body.ladder_links = links;
    if (targetWords) body.ladder_words = targetWords;
    if (targetUrl) body.ladder_target_url = targetUrl;   // R15: the page keeps the URL the ladder planned for it
  }
  await siteForecasts(org.id).catch(() => []); // warm the schedules' forecast outside the lock (the credit check reads it)
  // budget checks and the insert under one lock per company, so parallel requests (runs and keyword checks) cannot all pass the same
  // check; the month counts runs and keyword checks, the platform's daily ceiling every company (spend.ts)
  const created = await db.transaction(async (tx) => {
    await lockCompany(tx, org.id);
    // G4: a repeat of an earlier request (same Idempotency-Key within 24 hours) answers that run and starts nothing. Under the lock,
    // so two repeats arriving together cannot both miss each other; before the budget, so a replay is answered even when the
    // budget has since filled up.
    if (opts.idempotency) {
      const prior = await tx.query.runs.findFirst({
        where: and(eq(schema.runs.orgId, org.id), eq(schema.runs.idempotencyKey, opts.idempotency.key), gt(schema.runs.createdAt, new Date(Date.now() - IDEMPOTENCY.hours * 3_600_000))),
        orderBy: desc(schema.runs.createdAt),
      });
      if (prior) {
        if (prior.idempotencyHash !== opts.idempotency.hash) throw idempotencyMismatch();
        return { row: prior, replayed: true };
      }
    }
    // credits (app/docs/CREDITS.md): a company whose credits are enforced is held by its credits (balance, the credits kept for its
    // schedules, its own on-demand limit); the dollar budget is the platform's own guard for the others. Both under the company's lock.
    // D3: the website's one free research at setup skips the company's own checks (the platform's daily ceiling still applies)
    if (opts.free) await assertPlatformCapacity(tx, estimated);
    else if (!org.creditsEnforced) await assertBudget(tx, org, estimated, 'This run');
    else await assertPlatformCapacity(tx, estimated);
    const quoted = opts.free ? 0 : await assertCredits(tx, org, estimated, 'This run');
    const [row] = await tx
      .insert(schema.runs)
      .values({
        orgId: org.id,
        siteId: site?.id ?? null,
        userId: user.id,
        mode: input.mode,
        title: auto && input.mode === 'ladder' ? `Started automatically: ${input.keyword}` : auto && input.mode === 'discover' ? `Keyword research refresh${site ? ` · ${site.domain}` : ''}` : runTitle(input, site),
        status: 'submitting',
        input: { ...input, emailCopy: config.engineEmails && input.emailCopy, ...(auto ? { autoStart: true } : {}), ...(opts.proposalId ? { proposalId: opts.proposalId } : {}), ...(opts.free ? { freeResearch: true } : {}) } as unknown as Record<string, unknown>,
        estimatedCostUsd: estimated,
        // a free run is quoted 0 (the cost sync caps every charge of a run at its quote), so it is never charged
        quotedCredits: opts.free ? 0 : quoted > 0 ? quoted : null,
        etaMinutes: etaFor(input),
        apiKeyId: opts.apiKeyId ?? null,
        idempotencyKey: opts.idempotency?.key ?? null,
        idempotencyHash: opts.idempotency?.hash ?? null,
      })
      .returning();
    return { row, replayed: false };
  });
  if (created.replayed) return { run: created.row, replayed: true, engineStatus: null };
  const run = created.row;

  const res = await startRun(body, org.id);
  if (!res.ok) {
    const [failed] = await db
      .update(schema.runs)
      .set({ status: 'failed', error: res.error, requestId: res.requestId, completedAt: new Date() })
      .where(eq(schema.runs.id, run.id))
      .returning();
    void emitRunsFailed([failed.id]).catch(() => undefined);
    return { run: failed, replayed: false, engineStatus: res.status };
  }
  // B-A6 (2026-10-15): the engine recognised a repeat of a request already running, did not start a second run and did not spend
  // again, and answered with the FIRST run's id. Two of our rows would then carry one request id, and a callback matches the newest
  // of them, so the repeat row would take the result and the original would stay pending for ever. The repeat never existed as a
  // run, so we do not keep a row claiming it did (INVARIANTS Rule 4): we drop ours and hand back the run that is really going.
  if (repeatResolvesToOriginal(res) && res.requestId) {
    // (`res.requestId` is restated for the type checker: `repeatResolvesToOriginal` already proves it is a non-empty string, but a
    // boolean return cannot narrow it, and `eq(column, string | null)` matches no drizzle overload, the server typecheck fails on it.)
    const original = await db.query.runs.findFirst({
      where: and(eq(schema.runs.orgId, org.id), eq(schema.runs.requestId, res.requestId), ne(schema.runs.id, run.id)),
      orderBy: asc(schema.runs.createdAt),
    });
    if (original) {
      await db.delete(schema.runs).where(eq(schema.runs.id, run.id));
      return { run: original, replayed: true, engineStatus: res.status };
    }
    // the first run is not ours (started outside this app, or already cleaned up): keep this row, it is the only one that can
    // receive the callback, but never claim it started work the engine did not do.
  }

  const [accepted] = await db
    .update(schema.runs)
    .set({ status: 'accepted', requestId: res.requestId, acceptedAt: new Date(), etaMinutes: Math.max(run.etaMinutes, res.etaMinutes ?? 0) })
    .where(eq(schema.runs.id, run.id))
    .returning();

  // a page written from the app: the content log (cadence skips it, "waiting to publish", the publish check finds it) and, for a
  // ladder page, the ladder row (no longer "planned"), the same bookkeeping the cadence and the ladder runs do inside n8n
  if (input.mode === 'keyword' && input.receiveContent && site) await recordPageInEngine(site, input, accepted.requestId ?? '').catch(() => undefined);

  if (input.mode === 'track' && site) {
    // the site's ladders keep their own delivery address: point them here as well (and drop stored e-mails when engine e-mails are off)
    await routeSiteToApp(org, site).catch(() => undefined);
    await db
      .update(schema.sites)
      .set({
        trackingStatus: 'active',
        trackingStartedAt: trackingStartedAt ?? site.trackingStartedAt ?? new Date(),
        ...(input.timezone ? { timezone: input.timezone } : {}),
        ...(input.services !== undefined ? { services: input.services } : {}),
        keywords: input.keywords.length ? input.keywords : site.keywords,
        blogsPerWeek: input.blogsPerWeek,
        ga4PropertyId: input.ga4PropertyId || site.ga4PropertyId,
        competitors: input.competitors.length ? input.competitors : site.competitors,
        brandNames: input.monitors.brandNames.length ? input.monitors.brandNames : site.brandNames,
        updatedAt: new Date(),
      })
      .where(eq(schema.sites.id, site.id));
  }
  return { run: accepted, replayed: false, engineStatus: res.status };
}

/** B-A6: should this start resolve to a run that is already going, instead of keeping a row of its own?
 *  Only when the engine actually recognised the repeat AND told us which run it belongs to. A missing or false `duplicate`
 *  (an older engine that does not send the field) means the run really started, so we keep our row. */
export function repeatResolvesToOriginal(res: { duplicate?: boolean; requestId: string | null }): boolean {
  return res.duplicate === true && typeof res.requestId === 'string' && res.requestId !== '';
}

async function recordPageInEngine(site: SiteRow, input: Extract<RunInput, { mode: 'keyword' }>, requestId: string) {
  const now = new Date().toISOString();
  await insertRows('contentLog', [
    {
      site_id: n8nSiteId(site.domain),
      domain: site.domain,
      keyword: input.keyword,
      // R-K5: an approved suggestion keeps its kind (an AI answer page, a refresh...); a ladder page is a ladder page; else the app's own
      source: input.ladder ? 'ladder' : input.source && input.source !== 'ladder' ? input.source : 'app',
      page_type: input.pageType,
      existing_page_url: input.existingPageUrl,
      rung: input.ladder?.rung ?? 0,
      ladder_id: input.ladder?.id ?? '',
      request_id: requestId,
      started_at: now,
      status: 'started',
      published_url: '',
      published_at: '',
      week: now.slice(0, 10),
    },
  ]);
  if (input.ladder)
    await updateRows(
      'ladders',
      [
        { columnName: 'ladder_id', condition: 'eq', value: input.ladder.id },
        { columnName: 'keyword', condition: 'eq', value: input.keyword },
      ],
      { status: 'writing' },
    );
}

/**
 * R116 (2026-10-16): what an expired run says. The old sentence claimed "the run may have failed in n8n (ops were e-mailed)", but the
 * app cannot know an e-mail was sent: the engine's failure watcher (engineFailures.ts) closes a run whose execution FAILED long before
 * this, so a run that reaches the expiry is one whose execution ended without a word to us (a refusal posted nowhere, a stop, a lost
 * callback). It says what is known and nothing more.
 */
export const STALE_RUN_ERROR =
  'No result arrived from the SEO engine in time, and the engine did not report a failure for this run. It may have been refused or stopped without a report; start it again, or check its execution in n8n.';

/** Runs n8n accepted but never answered: failed after 3 h or 6x their expected time. */
export async function expireStaleRuns(): Promise<number> {
  const rows = await db
    .update(schema.runs)
    .set({
      status: 'failed',
      completedAt: new Date(),
      error: STALE_RUN_ERROR,
    })
    .where(
      and(
        inArray(schema.runs.status, ['submitting', 'accepted', 'running']),
        lt(schema.runs.createdAt, sql`now() - greatest(interval '3 hours', make_interval(mins => ${schema.runs.etaMinutes} * 6))`),
      ),
    )
    .returning({ id: schema.runs.id });
  void emitRunsFailed(rows.map((r) => r.id)).catch(() => undefined);
  return rows.length;
}

/** Internal links of a ladder page, as the Content Cadence builds them: the top page (hub) and a sibling on the same rung. */
export async function plannedLadderPage(domain: string, keyword: string): Promise<{ keyword: string; ladder: { id: string; rung: number; head: string; pageNo: number } } | null> {
  const rowsOf = await siteRows<LadderRow>('ladders', domain, { max: 1000, fresh: true }).catch(() => [] as LadderRow[]);
  const k = normKeyword(keyword);
  const r = rowsOf.find((l) => l.ladder_id && normKeyword(l.keyword) === k && String(l.status || 'planned') === 'planned');
  return r ? { keyword: r.keyword, ladder: { id: r.ladder_id, rung: Number(r.rung) || 0, head: r.head_keyword || '', pageNo: Number(r.page_no) || 0 } } : null;
}

export interface LadderPageLink {
  url: string;
  path: string;
  role: string;
  keyword: string;
  planned: boolean;
}

/**
 * What a ladder page run is given besides the keyword: the internal links (as the Content Cadence builds them, the top page and one
 * sibling, or every rung page for the top page itself) and the word target the ladder's verdict set for it.
 *
 * P2-7 (Phase 2 live check, 2026-10-12): the target used to be lost. A "Write now" run never runs the competitor analysis and has no
 * verdict of its own, so the writer invented its own length, run 442 wrote 3,864 words for a page the verdict had set at 2,100 (+84%).
 * `seo_ladders.target_words` stores it; the engine clamps the brief to it (`ladder_words` -> *Parse Brief*).
 * Pure, so the harness-style situations are unit-tested; `ladderLinks` only fetches the rows.
 */
export function ladderPageContext(rows: LadderRow[], rung: number, keyword: string): { links: LadderPageLink[]; targetWords: number; targetUrl: string } {
  const top = rows.find((r) => Number(r.rung) === 4);
  const links: { url: string; role: string; keyword: string }[] = [];
  if (rung === 4) for (const r of rows.filter((x) => Number(x.rung) !== 4 && x.target_url).slice(0, 12)) links.push({ url: r.target_url, role: 'down', keyword: r.keyword });
  else {
    if (top?.target_url && top.keyword !== keyword) links.push({ url: top.target_url, role: 'top', keyword: top.keyword });
    const sib = rows.find((x) => Number(x.rung) === rung && x.keyword !== keyword && x.target_url);
    if (sib) links.push({ url: sib.target_url, role: 'sibling', keyword: sib.keyword });
  }
  // this page's own row first (its keyword, else its rung), then the ladder's main page: the verdict's target belongs to the main page
  const k = normKeyword(keyword);
  const mine = rows.find((r) => normKeyword(r.keyword) === k) ?? rows.find((r) => Number(r.rung) === rung);
  const words = Number(mine?.target_words) || Number(top?.target_words) || 0;
  // R15 (re-rating, 2026-10-13): the URL this ladder planned for the page. Exec 521 delivered `service-industry-erp-software-uae` while
  // the row said `/service-industry-erp-software/`, the row's own link map, the siblings' up-links and the Rank Tracker all use the row,
  // so the engine keeps the planned slug (`ladder_target_url` -> *Parse Brief*) instead of publishing at a URL nothing points at.
  const planned = String(mine?.target_url ?? '').trim();
  return {
    links: links.map((l) => ({ ...l, path: l.url.replace(/^https?:\/\/[^/]+/i, '') || '/', planned: true })),
    targetWords: words >= 300 && words <= 6000 ? Math.round(words) : 0,
    targetUrl: /^https?:\/\/\S+$/i.test(planned) ? planned.slice(0, 300) : '',
  };
}

async function ladderLinks(domain: string, ladderId: string, rung: number, keyword: string): Promise<{ links: LadderPageLink[]; targetWords: number; targetUrl: string }> {
  const rowsOf = await siteRows<LadderRow>('ladders', domain, { extra: [{ columnName: 'ladder_id', condition: 'eq', value: ladderId }], max: 100, fresh: true }).catch(() => [] as LadderRow[]);
  return ladderPageContext(rowsOf, rung, keyword);
}

/** Points every stored delivery address of the site in n8n (site row, ladders) at this company's callback; clears stored e-mails while engine e-mails are off. */
export async function routeSiteToApp(org: OrgRow, site: SiteRow): Promise<void> {
  const data: Record<string, unknown> = { callback_url: callbackUrl(org) };
  if (!config.engineEmails) data.email = '';
  const byDomain = [{ columnName: 'domain', condition: 'eq' as const, value: site.domain }];
  await updateRows('ladders', byDomain, data);
  await updateRows('sites', byDomain, data);
  invalidateSite(site.domain);
}

// ---------------- callbacks ----------------

/**
 * The new ladder's settings the person chose in the "New keyword ladder" flow (the run's `ladderPrefs`), when its plan arrives: a
 * ladder_plan callback of that ladder run that planned pages (`planned: false` = refused, nothing to set) with a valid ladder id.
 */
export function ladderPrefsOf(stage: string, body: Record<string, unknown>, run: { mode: string; input: Record<string, unknown> } | null): { ladderId: string; prefs: LadderPrefs } | null {
  if (stage !== 'ladder_plan' || run?.mode !== 'ladder') return null;
  if (body.planned === false || body.planned === 'false') return null;
  const id = typeof body.ladder_id === 'string' ? body.ladder_id.trim() : '';
  if (!LADDER_ID_RE.test(id) || id === '_site') return null;
  const parsed = ladderPrefsSchema.safeParse(run.input?.ladderPrefs);
  if (!parsed.success || (!parsed.data.mode && parsed.data.first !== true)) return null;
  return { ladderId: id, prefs: parsed.data };
}

/** The ladder a rank-tracker callback reports as won (`won: true`), else null. */
export function wonLadderOf(stage: string, body: Record<string, unknown>): string | null {
  if (stage !== 'rank_tracker' || !(body.won === true || body.won === 'true')) return null;
  const id = typeof body.ladder_id === 'string' ? body.ladder_id.trim() : '';
  return /^[A-Za-z0-9_-]{1,80}$/.test(id) && id !== '_site' ? id : null;
}

export async function orgByHookToken(token: string): Promise<OrgRow | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.hookToken, token) });
  return org && safeEqual(org.hookToken, token) ? org : null;
}

/** `deliverReport` wants a logger; a callback has no request logger to hand, so delivery notes go to the process log. */
const deliveryLog = {
  info: (o: object, msg: string) => console.log(JSON.stringify({ level: 'info', msg, ...o })),
  error: (o: object, msg: string) => console.error(JSON.stringify({ level: 'error', msg, ...o })),
};

/** Stages only a schedule produces. Their callbacks reuse the request id of the run that set the work up (the ladder plan, the
 *  tracking setup), so a run row is found for them although that run did none of the work. */
export const SCHEDULED_STAGES: readonly string[] = ['rank_tracker', 'content_cadence', 'console_alert', 'cycle_preview'];

/** A report a schedule produced (a weekly or daily run, or a job of the website's cycle), as opposed to one the matched app run produced. */
export const isScheduledCallback = (stage: string, body: Record<string, unknown>): boolean =>
  body.on_demand === false || SCHEDULED_STAGES.includes(stage) || String(body.trigger ?? '') === 'cycle' || isCycleRequestId(body.request_id);

/**
 * D-3 (re-rating 2026-10-17): whether a callback's spend belongs to the run row it matched. A scheduled report never does: the Rank
 * Tracker's weekly run (exec 785, $0.116) posted one report per ladder with the request id of the run that planned each ladder, and
 * every one of them was added to that old run, the 2026-10-08 "Ladder: peppol uae" run went 0.1185 -> 0.1905 -> 0.3065. A run's
 * cost counts once, on the run that spent it.
 */
export const callbackCostCountsForRun = (stage: string, body: Record<string, unknown>): boolean => !isScheduledCallback(stage, body);

/**
 * How one callback moves its run (pure, so it is tested without a database). A `rejected` callback closes the run as failed with the
 * engine's own sentence, R116: an on-demand monitor the run guard refused after its "started" note now posts exactly that
 * (`{stage:'rejected', status:'rejected', error, request_id}`), so the customer reads why instead of waiting for a report that never
 * comes. A final stage completes it; anything else marks an accepted run as running. A completed run is never reopened.
 */
/**
 * Rehearsal 2026-10-20 (real engine): a ladder plan that came back with nothing because Google's live results could not be read
 * (`planned: false`, `refusal.reason: 'serp_unchecked'`, after the engine's three attempts) delivered nothing the client can use. The
 * client is not charged for the provider's outage. Returns the customer sentence, or null when the run delivered something.
 */
export function noResultOf(stage: string, body: Record<string, unknown>): string | null {
  if (stage !== 'ladder_plan') return null;
  const planned = !(body.planned === false || body.planned === 'false');
  const refusal = body.refusal && typeof body.refusal === 'object' ? (body.refusal as { reason?: unknown }) : null;
  if (planned || !refusal || refusal.reason !== 'serp_unchecked') return null;
  return "Google's results could not be read right now (our search data provider did not answer), so nothing was planned and no credits were used. Please try again later.";
}

export function runOutcome(
  runStatus: string,
  finalStages: readonly string[],
  stage: string,
  body: Record<string, unknown>,
): { status?: string; error?: string | null; completedAt?: Date } {
  if (stage === 'rejected' || String(body.status ?? '').toLowerCase() === 'rejected') {
    if (runStatus === 'completed') return {};
    const why = typeof body.error === 'string' && body.error.trim() ? body.error.trim() : typeof body.validation_error === 'string' && body.validation_error.trim() ? body.validation_error.trim() : 'Rejected by the SEO engine';
    return { status: 'failed', error: why, completedAt: new Date() };
  }
  if (finalStages.includes(stage)) {
    // rehearsal 2026-10-20: a final answer that delivered nothing because the external data could not be read ends the run as failed,
    // so the cost sync charges it nothing (and returns what it already took, step 6); the engine's own spend stays recorded
    const noResult = noResultOf(stage, body);
    if (noResult) return runStatus === 'failed' ? {} : { status: 'failed', error: noResult, completedAt: new Date() };
    return runStatus === 'completed' ? {} : { status: 'completed', completedAt: new Date(), error: null };
  }
  if (runStatus === 'accepted' || runStatus === 'submitting') return { status: 'running' };
  return {};
}

export async function ingestCallback(
  org: OrgRow,
  body: Record<string, unknown>,
): Promise<{ reportId: string; runId: string | null; stage: string; ladderWon?: boolean; prefsApplied?: boolean }> {
  const stage = stageOf(body);
  const requestId = body.request_id != null && body.request_id !== '' ? String(body.request_id) : null;
  const { callback_url: _cb, ...rest } = body; // the callback URL carries the company's hook token: never stored
  const { payload: raw, files } = extractFiles(rest);
  // older n8n builds listed other customers' Search Console properties in "no access" errors: never stored
  const payload = JSON.parse(JSON.stringify(raw).replace(/ \(it can see: [^)]*\)/g, '')) as Record<string, unknown>;

  const domain = cleanDomain(body.domain);
  const site = domain ? ((await db.query.sites.findFirst({ where: and(eq(schema.sites.orgId, org.id), eq(schema.sites.domain, domain)) })) ?? null) : null;
  // a job of the website's cycle (`cyc_<site>_<date>_<job>`, the Cycle Dispatcher's) belongs to no app run: it is a scheduled report of the website
  const run = requestId && !isCycleRequestId(requestId)
    ? ((await db.query.runs.findFirst({ where: and(eq(schema.runs.orgId, org.id), eq(schema.runs.requestId, requestId)), orderBy: desc(schema.runs.createdAt) })) ?? null)
    : null;

  const status = String(body.status ?? (stage === 'rejected' ? 'rejected' : 'completed'));
  const stored = await db.transaction(async (tx) => {
    const [rep] = await tx
      .insert(schema.reports)
      .values({
        orgId: org.id,
        runId: run?.id ?? null,
        siteId: site?.id ?? run?.siteId ?? null,
        stage,
        status,
        title: run?.mode === 'verdict' && stage === 'content' ? `Verdict: ${String(body.keyword ?? '')}` : titleFor(stage, body),
        requestId,
        // weekly reports reuse the request id of the run that set tracking up: they are scheduled all the same; a ladder started by
        // "Choose keywords for me" is automatic too (it shows among the Pipeline's automatic runs)
        scheduled: !run || isScheduledCallback(stage, body) || run.input?.autoStart === true,
        summary: summarize(stage, body),
        payload,
      })
      .returning({ id: schema.reports.id, title: schema.reports.title, receivedAt: schema.reports.receivedAt, scheduled: schema.reports.scheduled });
    if (files.length)
      await tx.insert(schema.files).values(
        files.map((f) => ({ id: f.id, orgId: org.id, reportId: rep.id, field: f.field, kind: f.kind, fileName: f.fileName, mimeType: f.mimeType, size: f.size, data: f.data })),
      );

    if (run) {
      const info = MODES[run.mode as ModeId];
      // increments in SQL: several callbacks of one run (ladder pages) may arrive at the same moment
      const patch: Record<string, unknown> = { reportCount: sql`${schema.runs.reportCount} + 1`, lastStage: stage };
      // B-R3: whatever the engine says about money replaces what the app guessed. `ledgerCost` is what the run reported spending
      // (search data + the model calls it priced), `engineCostEstimate` its own calibrated reservation with the sentence behind it.
      // D-3: a schedule's spend (and its reservation) is not this run's
      const ownSpend = callbackCostCountsForRun(stage, body);
      const cost = ownSpend ? ledgerCost(body) : null;
      if (cost != null) {
        patch.actualCostUsd = sql`coalesce(${schema.runs.actualCostUsd}, 0) + ${cost.usd}`;
        if (cost.estimated) patch.actualCostEstimated = true;
        if (cost.partial) patch.actualCostPartial = true;
      }
      const engineEstimate = ownSpend ? engineCostEstimate(body) : null;
      if (engineEstimate != null) {
        patch.engineCostEstimateUsd = engineEstimate.usd;
        if (engineEstimate.basis) patch.engineCostBasis = engineEstimate.basis.slice(0, 500);
      }
      Object.assign(patch, runOutcome(run.status, info?.finalStages ?? [], stage, body));
      await tx.update(schema.runs).set(patch).where(eq(schema.runs.id, run.id));
    }
    if (site && (stage === 'site_tracker_setup' || stage === 'site_tracker') && site.trackingStatus === 'not_started')
      await tx.update(schema.sites).set({ trackingStatus: 'active', trackingStartedAt: new Date() }).where(eq(schema.sites.id, site.id));
    // keyword-first: "Track my site" reports the cycle it made or kept; the website keeps its weekday for the screens
    const cyc = stage === 'site_tracker_setup' && body.cycle && typeof body.cycle === 'object' ? (body.cycle as Record<string, unknown>) : null;
    const wd = cyc && cyc.cycle_weekday !== '' && cyc.cycle_weekday != null ? Number(cyc.cycle_weekday) : NaN;
    if (site && Number.isInteger(wd) && wd >= 0 && wd <= 6 && wd !== site.cycleWeekday) await tx.update(schema.sites).set({ cycleWeekday: wd }).where(eq(schema.sites.id, site.id));
    return rep;
  });
  const reportId = stored.id;
  if (domain) invalidateSite(domain);
  // B-R1: push it. `deliverReport` decides for itself whether this report may leave the app (a page that failed its quality gate,
  // a refused plan or evidence the engine could not read is held with its reason), and a delivery that goes wrong is logged, never
  // allowed to lose the callback we have just stored.
  void deliverReport(org.id, reportId, deliveryLog).catch(() => undefined);
  // G4: the company's event webhooks (run.completed / report.ready / alert.raised / audit.finding.new / rank.changed ...), derived from
  // this callback after it is stored, like delivery, an event that goes wrong never loses the callback
  void emitForCallback(org, site, { id: reportId, title: stored.title, stage, status, receivedAt: stored.receivedAt, scheduled: stored.scheduled, runId: run?.id ?? null }, payload, run).catch(() => undefined);
  // the rank tracker says a ladder is won (main keyword top 3 in 4 checks): its settings row says so, so the cadence stops writing it
  // and the app keeps showing Won once the tracker stops checking it (not for a ladder the person paused)
  let ladderWon: boolean | undefined;
  const wonId = wonLadderOf(stage, body);
  if (wonId && site?.verifiedAt) ladderWon = await markLadderWon(site, wonId).catch(() => false);
  // the plan of a ladder started in the "New keyword ladder" flow: its Auto / Manual and "write it first" (n8n wrote the settings row
  // with the website's defaults just before this callback; refused plans have no row and get nothing)
  let prefsApplied: boolean | undefined;
  const prefs = ladderPrefsOf(stage, body, run);
  if (prefs && site?.verifiedAt) prefsApplied = await applyLadderPrefs(site, prefs.ladderId, prefs.prefs).catch(() => false);
  // keyword-first: the "Coming up" plan is kept (and e-mailed once a week); a cadence report may make a queued ladder active (its keyword
  // is checked again when it was planned long ago); a won or finished ladder makes room for the next keyword. None of it may lose the
  // callback just stored, so each is logged and swallowed.
  if (site?.verifiedAt) void afterCallback(org, site, stage, payload, reportId).catch((err) => deliveryLog.error({ err: String(err), stage }, 'keyword-first follow-up failed'));
  return { reportId, runId: run?.id ?? null, stage, ...(ladderWon !== undefined ? { ladderWon } : {}), ...(prefsApplied !== undefined ? { prefsApplied } : {}) };
}

/** The keyword-first follow-ups of a callback (services/autopilot.ts), loaded lazily: that module imports this one. */
async function afterCallback(org: OrgRow, site: SiteRow, stage: string, payload: Record<string, unknown>, reportId: string): Promise<void> {
  const m = await import('./autopilot');
  await m.afterCallback(org, site, stage, payload, reportId);
}

// credits of a run: services/runCredits.ts (re-exported here for the routes)
export { chargesByRun, creditsForRuns, reportCredits, runCreditsOf, type RunCharge } from './runCredits';

// ---------------- serializers ----------------

export function toRun(r: RunRow, extra: { siteDomain?: string | null; userName?: string | null; apiKeyName?: string | null; credits: RunCredits }): Run {
  return {
    apiKeyName: r.apiKeyId ? (extra.apiKeyName ?? 'an API key') : null,
    id: r.id,
    orgId: r.orgId,
    siteId: r.siteId,
    siteDomain: extra.siteDomain ?? null,
    userId: r.userId,
    userName: extra.userName ?? null,
    mode: r.mode as ModeId,
    title: r.title,
    status: r.status as Run['status'],
    requestId: r.requestId,
    // credits: an engine refusal naming a dollar balance or a provider reads as a capacity limit (the raw text stays in the database)
    error: customerError(r.error),
    credits: extra.credits,
    etaMinutes: r.etaMinutes,
    input: r.input as unknown as RunInput,
    createdAt: r.createdAt.toISOString(),
    acceptedAt: r.acceptedAt?.toISOString() ?? null,
    completedAt: r.completedAt?.toISOString() ?? null,
    reportCount: r.reportCount,
    lastStage: r.lastStage,
  };
}

export function toReport(r: Pick<ReportRow, 'id' | 'runId' | 'siteId' | 'stage' | 'status' | 'title' | 'summary' | 'receivedAt' | 'scheduled'>, files: ReportFile[], siteDomain: string | null = null): Report {
  return {
    id: r.id,
    runId: r.runId,
    siteId: r.siteId,
    siteDomain,
    stage: r.stage,
    status: r.status,
    // D-13: pulse reports stored before 2026-10-18 are titled "AI pulse alert" even on a day with no alert
    title: r.stage === 'ai_pulse' && r.summary?.alerts === 0 ? r.title.replace(/^AI pulse alert\b/, 'AI pulse') : r.title,
    summary: r.summary,
    receivedAt: r.receivedAt.toISOString(),
    scheduled: r.scheduled,
    files,
  };
}

export async function filesFor(reportIds: string[]): Promise<Map<string, ReportFile[]>> {
  const m = new Map<string, ReportFile[]>();
  if (!reportIds.length) return m;
  const rows = await db
    .select({ id: schema.files.id, reportId: schema.files.reportId, kind: schema.files.kind, fileName: schema.files.fileName, mimeType: schema.files.mimeType, size: schema.files.size, field: schema.files.field })
    .from(schema.files)
    .where(inArray(schema.files.reportId, reportIds));
  for (const f of rows) {
    const list = m.get(f.reportId) ?? [];
    list.push({ id: f.id, kind: shownFileKind(f), fileName: f.fileName, mimeType: f.mimeType, size: f.size, field: f.field });
    m.set(f.reportId, list);
  }
  return m;
}

export async function reportsList(orgId: string, opts: { siteId?: string; runId?: string; stages?: string[]; limit?: number; before?: Date }): Promise<Report[]> {
  const conds = [eq(schema.reports.orgId, orgId)];
  if (opts.siteId) conds.push(eq(schema.reports.siteId, opts.siteId));
  if (opts.runId) conds.push(eq(schema.reports.runId, opts.runId));
  if (opts.stages?.length) conds.push(inArray(schema.reports.stage, opts.stages));
  if (opts.before) conds.push(lt(schema.reports.receivedAt, opts.before));
  const rows = await db
    .select({
      id: schema.reports.id,
      runId: schema.reports.runId,
      siteId: schema.reports.siteId,
      stage: schema.reports.stage,
      status: schema.reports.status,
      title: schema.reports.title,
      summary: schema.reports.summary,
      receivedAt: schema.reports.receivedAt,
      scheduled: schema.reports.scheduled,
      domain: schema.sites.domain,
    })
    .from(schema.reports)
    .leftJoin(schema.sites, eq(schema.reports.siteId, schema.sites.id))
    .where(and(...conds))
    .orderBy(desc(schema.reports.receivedAt))
    .limit(Math.min(opts.limit ?? 50, 200));
  const fm = await filesFor(rows.map((r) => r.id));
  return rows.map((r) => toReport(r, fm.get(r.id) ?? [], r.domain));
}

/** Latest report of a stage for a site, with its payload (dashboards read the rich weekly reports). */
export async function latestReport(orgId: string, siteId: string, stages: string[]): Promise<{ report: Report; payload: Record<string, unknown> } | null> {
  const row = await db.query.reports.findFirst({
    where: and(eq(schema.reports.orgId, orgId), eq(schema.reports.siteId, siteId), inArray(schema.reports.stage, stages)),
    orderBy: desc(schema.reports.receivedAt),
  });
  if (!row) return null;
  const fm = await filesFor([row.id]);
  return { report: toReport(row, fm.get(row.id) ?? []), payload: row.payload };
}

export async function getRunOrThrow(orgId: string, runId: string): Promise<RunRow> {
  const run = await db.query.runs.findFirst({ where: and(eq(schema.runs.orgId, orgId), eq(schema.runs.id, runId)) });
  if (!run) throw notFound('Run not found');
  return run;
}
