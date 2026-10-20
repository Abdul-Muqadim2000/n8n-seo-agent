import { and, desc, eq, inArray, lt, or } from 'drizzle-orm';
import {
  AUTOPILOT_LEVELS,
  NUDGE_AFTER_PAGES,
  QUEUED_RECHECK_DAYS,
  REJECT_LIMIT,
  REJECT_WINDOW,
  cycleNorm,
  type AutopilotLevel,
  type ContentFeedbackResult,
  type ContentLogRow,
  type LadderRow,
  type LadderSettingsRow,
  type NeedsYouItem,
  type SkipRow,
} from '@seo/shared';
import type { FastifyRequest } from 'fastify';
import { db, schema } from '../db';
import type { KeywordProposalRow, LadderRecheckRow, OrgRow, SiteRow, UserRow } from '../db/schema';
import { badRequest, HttpError, notFound } from '../lib/errors';
import { sendMail } from '../lib/mailer';
import { siteRows } from '../n8n/client';
import { audit } from './audit';
import { billingContacts } from './invoices';
import { assessKeyword } from './keywordChecks';
import { markLadderRechecked, updateLadderSettings, updateSiteAutomation } from './ladderSettings';
import { baseUrlFor, senderFor } from './portalMail';
import { wonLadderOf } from './runs';
import { onPreview, skipsOf } from './comingUp';
import { ownerOf } from './companyOwner';

// The autopilot level of a website and what follows from it (SCHEDULING_KEYWORDS_PLAN.md §5.5 / §5.6, contract app/shared/src/cycles.ts):
//   * the level itself (PATCH .../automation `autopilotLevel`): written to the engine's `_site` row (which decides) and mirrored on the site;
//   * "Not what I wanted" on a written page (content_feedback): REJECT_LIMIT rejections among the last REJECT_WINDOW automatic pages that
//     are not ladder pages drop the level to 1, and the owners and admins are told why and how to raise it again (the auto-pause);
//   * the upgrade nudge: NUDGE_AFTER_PAGES pages published or approved at level 1 offer level 2 (never switched automatically);
//   * the queued-ladder re-check (§5.6): a queued ladder planned more than QUEUED_RECHECK_DAYS ago gets one fresh keyword check when it
//     becomes active; when its verdict fell (not realistic now, or a topic fit of 0) it is paused and the client is asked;
//   * the follow-ups of a callback (afterCallback): the "Coming up" plan, the re-check, the next keyword after a won ladder.

type Log = { info: (o: object, m: string) => void; error: (o: object, m: string) => void; warn?: (o: object, m: string) => void };
const consoleLog: Log = {
  info: (o, m) => console.log(JSON.stringify({ level: 'info', msg: m, ...o })),
  error: (o, m) => console.error(JSON.stringify({ level: 'error', msg: m, ...o })),
};
const S = (v: unknown) => String(v == null ? '' : v).trim();
const asLevel = (n: unknown): AutopilotLevel => (Number(n) === 1 || Number(n) === 3 ? (Number(n) as AutopilotLevel) : 2);
const levelLabel = (l: AutopilotLevel) => AUTOPILOT_LEVELS.find((x) => x.level === l)?.label ?? String(l);

// ---------------- the level ----------------

/** Sets the website's level: the engine's `_site` row first (it decides), then the app's mirror. Raising the level clears the auto-pause notice. */
export async function setAutopilotLevel(site: SiteRow, level: AutopilotLevel, why: 'person' | 'auto_pause' = 'person'): Promise<void> {
  await updateSiteAutomation(site, { autopilotLevel: level });
  await mirrorAutopilotLevel(site, level, why);
}

/** The app's mirror of the level (the engine's `_site` row decides): the auto-pause records when and from which level it dropped. */
export async function mirrorAutopilotLevel(site: SiteRow, level: AutopilotLevel, why: 'person' | 'auto_pause' = 'person'): Promise<void> {
  await db
    .update(schema.sites)
    .set({
      autopilotLevel: level,
      ...(why === 'auto_pause' ? { autopilotDroppedAt: new Date(), autopilotDroppedFrom: site.autopilotLevel } : level > 1 ? { autopilotDroppedAt: null, autopilotDroppedFrom: null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.sites.id, site.id));
}

// ---------------- "Not what I wanted" and the auto-pause ----------------

/** Whether a written page was the autopilot's own choice: a cadence page (`cad_` run) that is not a ladder page and that the client did not approve. Pure. */
export function automaticPage(log: Pick<ContentLogRow, 'request_id' | 'source' | 'keyword'> | null, approvedKeys: Set<string>): boolean {
  if (!log) return false;
  return /^cad_/.test(S(log.request_id)) && S(log.source) !== 'ladder' && !approvedKeys.has(cycleNorm(log.keyword));
}

/** A written page's content-log row (pure; v5/code/Content_Log_Row.js `prior`): its request id and keyword, else the newest row of its keyword. */
export function contentLogRowOf(logs: ContentLogRow[], requestId: string, keyword: string): ContentLogRow | null {
  const k = cycleNorm(keyword);
  return (
    (requestId ? logs.find((l) => S(l.request_id) === requestId && cycleNorm(l.keyword) === k) : undefined) ??
    logs.filter((l) => cycleNorm(l.keyword) === k).sort((a, b) => S(b.started_at).localeCompare(S(a.started_at)))[0] ??
    null
  );
}

/** Whether the rejections drop the level (pure): REJECT_LIMIT of the last REJECT_WINDOW automatic non-ladder pages were rejected. */
export function autoPauseDue(o: { level: AutopilotLevel; automaticPages: Pick<ContentLogRow, 'keyword' | 'started_at'>[]; rejectedKeys: Set<string> }): boolean {
  if (o.level === 1) return false;
  const last = [...o.automaticPages].sort((a, b) => S(b.started_at).localeCompare(S(a.started_at))).slice(0, REJECT_WINDOW);
  return last.filter((p) => o.rejectedKeys.has(cycleNorm(p.keyword))).length >= REJECT_LIMIT;
}

/** The keywords the client approved in "Coming up" (seo_skips, read only when the engine's site id is this website's: skipsOf). */
async function approvedKeysOf(site: Pick<SiteRow, 'domain'>): Promise<Set<string>> {
  const skips: SkipRow[] = await skipsOf(site);
  return new Set(skips.filter((r) => S(r.decision) === 'approve').map((r) => cycleNorm(S(r.item_key))));
}

/** The auto-pause e-mail (pure). */
export function autoPauseMail(site: Pick<SiteRow, 'domain'>, from: AutopilotLevel, url: string) {
  return {
    subject: `We paused the extra pages for ${site.domain}`,
    title: 'We now write only for your keywords',
    lines: [
      `You marked ${REJECT_LIMIT} of the last ${REJECT_WINDOW} pages we chose on our own for ${site.domain} as not what you wanted, so we moved the website from "${levelLabel(from)}" to "${levelLabel(1)}".`,
      'From now on we write only the pages of the keywords you chose. Everything else waits for your OK in the weekly "Coming up" plan.',
      'You can raise the level again in the website settings whenever you like.',
    ],
  };
}

/**
 * POST /api/orgs/:orgId/reports/:reportId/feedback {verdict: 'reject', reason?}: "Not what I wanted" on a written page. Idempotent (one
 * rejection per page). Returns whether this rejection dropped the level.
 */
export async function rejectPage(req: FastifyRequest | null, org: OrgRow, user: UserRow, reportId: string, reason: string): Promise<ContentFeedbackResult> {
  const report = await db.query.reports.findFirst({ where: and(eq(schema.reports.id, reportId), eq(schema.reports.orgId, org.id)) });
  if (!report) throw notFound('Report not found');
  const payload = report.payload as Record<string, unknown>;
  if (report.stage !== 'content' || !S(payload.keyword)) throw badRequest('Only a written page can be marked as not what you wanted', { reportId: 'Not a written page' });
  const site = report.siteId ? await db.query.sites.findFirst({ where: and(eq(schema.sites.id, report.siteId), eq(schema.sites.orgId, org.id)) }) : null;
  const level = asLevel(site?.autopilotLevel);
  const existing = await db.query.contentFeedback.findFirst({ where: eq(schema.contentFeedback.reportId, report.id) });
  if (existing) return { id: existing.id, verdict: 'reject', levelDropped: false, level };
  const keyword = S(payload.keyword).slice(0, 200);
  const requestId = S(report.requestId ?? payload.request_id);
  let automatic = false;
  let source = /^cad_/.test(requestId) ? '' : 'app';
  let logs: ContentLogRow[] = [];
  let approved = new Set<string>();
  if (site) {
    [logs, approved] = await Promise.all([siteRows<ContentLogRow>('contentLog', site.domain, { sortBy: 'started_at:desc', max: 1000 }).catch(() => [] as ContentLogRow[]), approvedKeysOf(site)]);
    // F-KW: pages 2-3 of one ladder start share a request id, so the page's row is the one with its request id AND its keyword, else the
    // newest row of its keyword (the engine's Content Log Row rule, word for word)
    const row = contentLogRowOf(logs, requestId, keyword);
    source = row ? S(row.source) : source;
    automatic = automaticPage(row, approved);
  }
  // the auto-pause is decided BEFORE the rejection is stored, and the level is written first: when the engine refuses the write, nothing is
  // kept, so the client's retry (or the next "Not what I wanted") decides again and the drop is never lost behind a stored rejection
  let drop = false;
  if (site && automatic) {
    const rejected = await db.select({ keyword: schema.contentFeedback.keyword }).from(schema.contentFeedback).where(and(eq(schema.contentFeedback.siteId, site.id), eq(schema.contentFeedback.automatic, true)));
    const rejectedKeys = new Set([...rejected.map((r) => cycleNorm(r.keyword)), cycleNorm(keyword)]);
    drop = autoPauseDue({ level, automaticPages: logs.filter((l) => automaticPage(l, approved)), rejectedKeys });
  }
  if (drop && site) {
    try {
      await setAutopilotLevel(site, 1, 'auto_pause');
    } catch (err) {
      consoleLog.error({ site: site.domain, reportId: report.id, err: String((err as Error)?.message ?? err) }, 'auto-pause: the level could not be lowered, the rejection is not stored so a retry decides again');
      if (err instanceof HttpError && err.code === 'engine_not_ready') throw err;
      throw new HttpError(502, 'We could not save this right now, so nothing was changed. Try again in a minute.', 'engine_failed');
    }
  }
  const [fb] = await db
    .insert(schema.contentFeedback)
    .values({ orgId: org.id, siteId: site?.id ?? null, reportId: report.id, keyword, source, automatic, verdict: 'reject', reason: reason.slice(0, 1000), by: user.id })
    .onConflictDoNothing()
    .returning();
  const id = fb?.id ?? (await db.query.contentFeedback.findFirst({ where: eq(schema.contentFeedback.reportId, report.id) }))!.id;
  await audit(req, org.id, { action: 'site.content_rejected', target: { type: 'report', id: report.id, label: keyword }, details: { siteId: site?.id ?? null, automatic, source } });
  // a second request for the same page at the same moment: the first one told the client
  if (!site || !drop || !fb) return { id, verdict: 'reject', levelDropped: false, level: drop ? 1 : level };
  await audit(req, org.id, { action: 'site.autopilot_paused', actor: { type: 'system', label: 'system' }, target: { type: 'site', id: site.id, label: site.domain }, details: { from: level, to: 1, rejected: REJECT_LIMIT, window: REJECT_WINDOW } });
  const url = `${await baseUrlFor(org)}/o/${org.id}/sites/${site.id}/settings/automation`;
  const m = autoPauseMail(site, level, url);
  const sender = await senderFor(org);
  for (const to of await billingContacts(org.id))
    await sendMail({ to, subject: m.subject, title: m.title, lines: m.lines, action: { label: 'Open the settings', url }, sender, footer: `You receive this e-mail because you manage ${site.domain} in ${sender.brandName}.` }, consoleLog).catch(() => false);
  return { id, verdict: 'reject', levelDropped: true, level: 1 };
}

/** The upgrade nudge (pure): at level 1, NUDGE_AFTER_PAGES pages published or approved, and not just dropped there by the auto-pause. */
export function nudgeDue(o: { level: AutopilotLevel; published: number; approved: number; dropped: boolean }): boolean {
  return o.level === 1 && !o.dropped && o.published + o.approved >= NUDGE_AFTER_PAGES;
}

// ---------------- the queued-ladder re-check (§5.6) ----------------

/** The ladders that were queued in the previous plan and are written now (pure): queued before, not queued now, not won. */
export function newlyActive(prevQueued: string[], nowQueued: string[], won: string[]): string[] {
  const now = new Set(nowQueued), w = new Set(won);
  return [...new Set(prevQueued)].filter((id) => !now.has(id) && !w.has(id));
}

const queuedOf = (p: Record<string, unknown> | null | undefined): string[] =>
  (Array.isArray(p?.queued_ladders) ? (p!.queued_ladders as unknown[]) : []).map((x) => (x && typeof x === 'object' ? S((x as Record<string, unknown>).ladder_id) : S(x))).filter(Boolean);
const wonOf = (p: Record<string, unknown>): string[] => (Array.isArray(p.won_ladders) ? (p.won_ladders as unknown[]) : []).map((x) => (x && typeof x === 'object' ? S((x as Record<string, unknown>).ladder_id) : S(x))).filter(Boolean);

/** The verdict of a fresh check fell (pure): not realistic now, or off the website's topic. */
export const recheckFell = (r: { difficultyForYou?: string | null; fit?: number | null }): boolean => r.difficultyForYou === 'not_realistic' || r.fit === 0;

/** F-KW: the ladders the cadence itself says wait for a fresh check (`recheck_ladders` in a cycle_preview or content_cadence callback). */
export const recheckLaddersOf = (p: Record<string, unknown> | null | undefined): string[] =>
  (Array.isArray(p?.recheck_ladders) ? (p!.recheck_ladders as unknown[]) : []).map((x) => (x && typeof x === 'object' ? S((x as Record<string, unknown>).ladder_id) : S(x))).filter(Boolean);

/**
 * After a cadence report or a plan, a ladder planned long ago gets one fresh keyword check before its first page (plan §5.6):
 *   * the ladders the cadence lists in `recheck_ladders` (F-KW: planned more than 60 days ago and never written, whether they were queued
 *     or active all along; the engine decided at the cycle's due time, so its list is trusted as it is);
 *   * and a ladder that was queued in the previous plan and is written now, when it was planned more than QUEUED_RECHECK_DAYS ago.
 * A check that passes writes `rechecked_at` on the ladder's settings row (the cadence writes no page of such a ladder until it is set);
 * one that fell pauses the ladder and the client is asked. One check per ladder; it may run again only when it failed to run, or when
 * a pass is older than QUEUED_RECHECK_DAYS (the engine then asks for a fresh one).
 */
export async function recheckActivated(org: OrgRow, site: SiteRow, payload: Record<string, unknown>, reportId: string, log: Log = consoleLog, now = Date.now()): Promise<LadderRecheckRow[]> {
  // the plan before this one: the newest cadence report or plan of the website that is not this report
  const recent = await db.query.reports.findMany({
    where: and(eq(schema.reports.siteId, site.id), inArray(schema.reports.stage, ['content_cadence', 'cycle_preview'])),
    orderBy: desc(schema.reports.receivedAt),
    limit: 3,
  });
  const before = recent.find((r) => r.id !== reportId) ?? null;
  const listed = new Set(recheckLaddersOf(payload));
  const ids = [...new Set([...listed, ...newlyActive(queuedOf(before?.payload as Record<string, unknown>), queuedOf(payload), wonOf(payload))])];
  if (!ids.length) return [];
  const [ladders, settings] = await Promise.all([siteRows<LadderRow>('ladders', site.domain, { max: 2000, fresh: true }), siteRows<LadderSettingsRow>('ladderSettings', site.domain, { max: 500, fresh: true })]);
  // the system acts for the company's first active owner (a deactivated or suspended one is never acted for)
  const owner = await ownerOf(org.id);
  const out: LadderRecheckRow[] = [];
  for (const id of ids) {
    const rows = ladders.filter((l) => l.ladder_id === id);
    const st = settings.find((r) => r.ladder_id === id);
    if (!rows.length || ['paused', 'archived', 'won'].includes(S(st?.status))) continue;
    const planned = rows.map((r) => S(r.start_date)).filter(Boolean).sort()[0] || S(st?.created_at);
    const t = Date.parse(planned);
    if (!listed.has(id) && (!Number.isFinite(t) || now - t <= QUEUED_RECHECK_DAYS * 864e5)) continue;
    const head = rows.find((r) => Number(r.rung) === 4)?.keyword || S(rows[0].head_keyword);
    const claimed = await claimRecheck(org.id, site.id, id, head, now);
    if (!claimed) continue;
    if (!owner) {
      await db.update(schema.ladderRechecks).set({ status: 'failed', reason: 'the company has no owner to check it for', checkedAt: new Date() }).where(eq(schema.ladderRechecks.id, claimed.id));
      continue;
    }
    try {
      // started by the system: the website's autopilot spend, never the owner's on-demand spend
      const check = await assessKeyword({ org, site, user: owner }, { keyword: head }, { automatic: true });
      const fell = recheckFell(check.result);
      const reason = fell ? (check.result.fit === 0 ? 'its keyword now looks outside your business' : 'its keyword is no longer realistic for your website') : '';
      // the verdict reaches the engine: a fall pauses the ladder, a pass lets the cadence write its first page
      if (fell) await updateLadderSettings(site, id, { status: 'paused' });
      else await markLadderRechecked(site, id, new Date(now).toISOString());
      const [row] = await db
        .update(schema.ladderRechecks)
        .set({ status: 'done', result: { difficultyForYou: check.result.difficultyForYou, fit: check.result.fit, checkId: check.id }, paused: fell, reason, checkedAt: new Date() })
        .where(eq(schema.ladderRechecks.id, claimed.id))
        .returning();
      if (fell) await audit(null, org.id, { action: 'site.ladder_rechecked', actor: { type: 'system', label: 'system' }, target: { type: 'site', id: site.id, label: site.domain }, details: { ladderId: id, keyword: head, reason } });
      out.push(row);
    } catch (err) {
      await db.update(schema.ladderRechecks).set({ status: 'failed', reason: String((err as Error).message ?? err).slice(0, 300), checkedAt: new Date() }).where(eq(schema.ladderRechecks.id, claimed.id));
      log.error({ site: site.domain, ladder: id, err: String(err) }, 'queued ladder re-check failed');
    }
  }
  return out;
}

/**
 * Claims the one re-check of a ladder (pure database rule, safe across two servers): a new row, or the existing one when its check failed
 * to run, or when it passed more than QUEUED_RECHECK_DAYS ago. A paused verdict is never re-checked (the client decides). null = not ours.
 */
async function claimRecheck(orgId: string, siteId: string, ladderId: string, keyword: string, now: number): Promise<LadderRecheckRow | null> {
  const [fresh] = await db.insert(schema.ladderRechecks).values({ orgId, siteId, ladderId, keyword }).onConflictDoNothing().returning();
  if (fresh) return fresh;
  const [again] = await db
    .update(schema.ladderRechecks)
    .set({ status: 'pending', keyword, reason: '', checkedAt: null, createdAt: new Date(now) })
    .where(
      and(
        eq(schema.ladderRechecks.siteId, siteId),
        eq(schema.ladderRechecks.ladderId, ladderId),
        eq(schema.ladderRechecks.paused, false),
        or(eq(schema.ladderRechecks.status, 'failed'), and(eq(schema.ladderRechecks.status, 'done'), lt(schema.ladderRechecks.checkedAt, new Date(now - QUEUED_RECHECK_DAYS * 864e5)))),
      ),
    )
    .returning();
  return again ?? null;
}

// ---------------- Needs you (the autopilot's part) ----------------

export interface AutopilotNeedsInput {
  level: AutopilotLevel;
  waitingForKeyword: boolean;
  /** the website has ladders, none of them still writing (all won or with no pages left) */
  laddersDone: { head: string; won: boolean } | null;
  proposals: KeywordProposalRow[];
  rechecks: LadderRecheckRow[];
  dropped: { at: Date; from: number } | null;
  nudge: boolean;
  /** research is running (the first keyword step waits for it) */
  researching: boolean;
}

const q = (s: string) => `"${s}"`;

/** The autopilot's Needs-you items (pure): the keyword to choose, a proposal, a paused ladder, the level. */
export function autopilotNeedsYou(o: AutopilotNeedsInput): NeedsYouItem[] {
  const out: NeedsYouItem[] = [];
  const open = o.proposals.filter((p) => p.status === 'pending' || p.status === 'starting');
  if (o.waitingForKeyword && !open.length)
    out.push({
      id: 'keyword:first',
      kind: 'keyword',
      severity: 'warning',
      title: 'Choose the keyword you want to be found for',
      detail: o.researching
        ? 'We are finding keywords for your website right now. Pick one when the suggestions are ready, or type your own: nothing is written for your website until you do.'
        : 'Nothing is written for your website until you choose a keyword. Pick one of our suggestions or type your own; its pages are then written every week.',
      action: { label: 'Choose a keyword', page: 'pipeline/new' },
    });
  if (o.laddersDone && !open.length && !o.waitingForKeyword)
    out.push({
      id: 'keyword:next',
      kind: 'keyword',
      severity: 'info',
      title: o.laddersDone.won ? `Your ladder for ${q(o.laddersDone.head)} is done. Choose your next keyword` : `${q(o.laddersDone.head)} has no pages left. Choose your next keyword`,
      detail: 'Your weekly pages need a keyword to write for. Pick the next one from our suggestions or type your own.',
      action: { label: 'Choose a keyword', page: 'pipeline/new' },
    });
  for (const p of open) {
    const announced = !!p.startAt && p.level === 3;
    out.push({
      id: `proposal:${p.id}`,
      kind: 'proposal',
      severity: announced ? 'warning' : 'info',
      title: announced ? `We start ${q(p.keyword)} on ${p.startAt!.toISOString().slice(0, 10)}` : `Suggested keyword: ${q(p.keyword)}`,
      detail: `${S((p.details as Record<string, unknown>).why)} ${announced ? 'Approve it to start now, pick a different keyword, or skip it.' : 'Start this ladder, look at the others, or skip it.'}`.trim(),
      action: { label: announced ? 'Review it' : 'Start this ladder', page: 'pipeline' },
    });
  }
  for (const r of o.rechecks.filter((x) => x.paused))
    out.push({
      id: `recheck:${r.ladderId}`,
      kind: 'recheck',
      severity: 'warning',
      title: `We paused your ladder for ${q(r.keyword)}`,
      detail: `It waited in the queue for a long time, and a fresh check shows ${r.reason}. Choose another keyword, or resume it if you still want it.`,
      action: { label: 'Open the ladder', page: `pipeline/ladders/${r.ladderId}` },
      ladderId: r.ladderId,
    });
  if (o.dropped)
    out.push({
      id: 'level:dropped',
      kind: 'level',
      severity: 'warning',
      title: 'We now write only for your keywords',
      detail: `You marked ${REJECT_LIMIT} of the last ${REJECT_WINDOW} pages we chose on our own as not what you wanted, so the autopilot level went from ${o.dropped.from} to 1 on ${o.dropped.at.toISOString().slice(0, 10)}. Raise it again in the settings when you are ready.`,
      action: { label: 'Autopilot settings', page: 'settings/automation' },
    });
  else if (o.nudge)
    out.push({
      id: 'level:nudge',
      kind: 'level',
      severity: 'info',
      title: 'Let us keep your existing pages healthy',
      detail: `You have published or approved ${NUDGE_AFTER_PAGES} pages or more. At level 2 we also refresh your own pages on your topics when they lose visitors or sit close to page one, without asking each time. New topics still wait for your OK.`,
      action: { label: 'Autopilot settings', page: 'settings/automation' },
    });
  return out;
}

// ---------------- the follow-ups of a callback ----------------

/** Called by ingestCallback after a callback is stored (runs.ts). Each part is independent and logged. */
export async function afterCallback(org: OrgRow, site: SiteRow, stage: string, payload: Record<string, unknown>, reportId: string, log: Log = consoleLog): Promise<void> {
  if (stage === 'cycle_preview') await onPreview(org, site, payload, reportId, log).catch((err) => log.error({ err: String(err), site: site.domain }, '"Coming up" plan not kept'));
  if (stage === 'content_cadence' || stage === 'cycle_preview') await recheckActivated(org, site, payload, reportId, log).catch((err) => log.error({ err: String(err), site: site.domain }, 'queued ladder re-check failed'));
  // a won ladder (or a cadence report naming one) makes room for the next keyword; fresh keyword research gives one to propose
  const won = wonLadderOf(stage, payload) || (stage === 'content_cadence' && wonOf(payload).length ? wonOf(payload)[0] : null);
  if (won || stage === 'keyword_strategy') {
    const m = await import('./autoStart');
    await m.proposeForSite(org, site, undefined, Date.now(), { ...log, warn: log.warn ?? log.error }).catch((err) => log.error({ err: String(err), site: site.domain }, 'next keyword not proposed'));
  }
}
