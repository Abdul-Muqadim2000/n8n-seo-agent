import { and, desc, eq, isNull } from 'drizzle-orm';
import {
  AUTOPILOT_LEVELS,
  SKIPS_COLUMNS,
  cycleDateOf,
  itemKey as itemKeyOf,
  n8nSiteId,
  roleAtLeast,
  skipKey,
  type AutopilotLevel,
  type ComingUpDecisionResult,
  type ComingUpItem,
  type ComingUpView,
  type CyclePreview,
  type CyclePreviewItem,
  type Role,
  type SkipRow,
  type TopicSource,
} from '@seo/shared';
import { db, schema } from '../db';
import type { CyclePreviewRow, OrgRow, SiteRow, UserRow } from '../db/schema';
import { badRequest, HttpError, notFound } from '../lib/errors';
import { sendMail } from '../lib/mailer';
import { deleteRows, ensureTable, rows as n8nRows, upsertRow } from '../n8n/client';
import { wholeCreditsOfUsd as creditsOfUsd } from './admin/settings';
import { billingContacts } from './invoices';
import { baseUrlFor, senderFor } from './portalMail';
import { localDayName, siteTimezone } from './cycles';

// The weekly "Coming up" plan (SCHEDULING_KEYWORDS_PLAN.md §5.7, §14.4, §14.6): 48 hours before each cycle the engine plans exactly what
// that cycle would write and posts it (callback stage `cycle_preview`, nothing written). The app keeps the latest plan of each cycle
// (`cycle_previews`), shows it with the client's decisions, e-mails it once, and writes each decision to the engine's `seo_skips` (the
// real cycle's cadence honours them: a skipped item is not written, an approved needs-OK item is written within the pages a week).
// Decisions: owners, admins and members (viewers cannot); Skip for any item, Approve only for an item that waits for an OK (an
// automatic item is written anyway), and only for this cycle (the engine reads approvals per cycle). An approval clears an "always
// skip" of the same item, so the client's newest word wins. Every decision is in the company's audit log.

const S = (v: unknown) => String(v == null ? '' : v).trim();
const SOURCES: TopicSource[] = ['ladder', 'decay', 'striking', 'trend', 'ai_answer', 'ai_refresh'];
const asSource = (v: unknown): TopicSource => (SOURCES.includes(S(v) as TopicSource) ? (S(v) as TopicSource) : 'ladder');
const asLevel = (v: unknown): AutopilotLevel => (Number(v) === 1 || Number(v) === 3 ? (Number(v) as AutopilotLevel) : 2);

/** The preview body is the engine's: read every field defensively (an older engine may leave some out). */
export function previewOf(body: Record<string, unknown>): CyclePreview {
  const list = (v: unknown): CyclePreviewItem[] =>
    (Array.isArray(v) ? v : [])
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && !!S((x as Record<string, unknown>).keyword))
      .map((x) => ({
        item_key: S(x.item_key) || itemKeyOf(S(x.keyword)),
        keyword: S(x.keyword),
        source: asSource(x.source),
        page_type: S(x.page_type),
        existing_page_url: S(x.existing_page_url),
        ladder_id: S(x.ladder_id),
        rung: Number(x.rung) || 0,
        why: S(x.why),
        auto: x.auto === true,
        est_usd: Number(x.est_usd) > 0 ? Number(x.est_usd) : 0,
        ai_target: x.ai_target && typeof x.ai_target === 'object' ? (x.ai_target as CyclePreviewItem['ai_target']) : null,
      }));
  const pr = S(body.paused_reason);
  return {
    stage: 'cycle_preview',
    site_id: S(body.site_id),
    domain: S(body.domain),
    cycle_key: S(body.cycle_key),
    scheduled_for: S(body.scheduled_for),
    level: asLevel(body.level),
    pages_per_week: Number(body.pages_per_week) || 0,
    waiting_for_keyword: body.waiting_for_keyword === true,
    paused_reason: pr === 'pileup' || pr === 'site_paused' ? pr : '',
    items: list(body.items),
    suggestions: list(body.suggestions),
    cycle_date: S(body.cycle_date) || cycleDateOf(S(body.cycle_key)),
    reason: S(body.reason),
    refused: (Array.isArray(body.refused) ? body.refused : [])
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
      .map((x) => ({ keyword: S(x.keyword), source: S(x.source), reason: S(x.reason), detail: S(x.detail) })),
  };
}

/** Keeps the latest plan of each cycle of the website (a re-made preview replaces the earlier one). */
export async function storePreview(org: OrgRow, site: SiteRow, body: Record<string, unknown>, reportId: string | null): Promise<CyclePreviewRow | null> {
  const cycleKey = S(body.cycle_key);
  if (!/^cyc:.+:\d{4}-\d{2}-\d{2}$/.test(cycleKey)) return null;
  const t = Date.parse(S(body.scheduled_for));
  const values = { orgId: org.id, siteId: site.id, cycleKey, scheduledFor: Number.isFinite(t) ? new Date(t) : null, body, reportId, receivedAt: new Date() };
  const [row] = await db
    .insert(schema.cyclePreviews)
    .values(values)
    .onConflictDoUpdate({ target: [schema.cyclePreviews.siteId, schema.cyclePreviews.cycleKey], set: { body, reportId, scheduledFor: values.scheduledFor, receivedAt: values.receivedAt } })
    .returning();
  return row ?? null;
}

/** The website's latest plan (the cycle due next, or the newest one received). */
export async function latestPreview(siteId: string): Promise<CyclePreviewRow | null> {
  return (await db.query.cyclePreviews.findFirst({ where: eq(schema.cyclePreviews.siteId, siteId), orderBy: [desc(schema.cyclePreviews.scheduledFor), desc(schema.cyclePreviews.receivedAt)] })) ?? null;
}

const decisionOf = (skips: SkipRow[], siteId: string, cycleKey: string, key: string): ComingUpItem['decision'] => {
  const mine = skips
    .filter((r) => S(r.site_id) === siteId && itemKeyOf(S(r.item_key)) === key && (S(r.scope) === 'always' || S(r.cycle_key) === cycleKey))
    .sort((a, b) => S(b.created_at).localeCompare(S(a.created_at)));
  // the engine's rule: a skip beats an approval, whatever the order
  const r = mine.find((x) => S(x.decision) === 'skip') ?? mine[0];
  return r ? { decision: S(r.decision) === 'approve' ? 'approve' : 'skip', scope: S(r.scope) === 'always' ? 'always' : 'cycle', by: S(r.by), at: S(r.created_at) } : null;
};

/** The view of one plan (pure): items in credits, each with the client's decision on it. */
export function comingUpView(o: { site: Pick<SiteRow, 'id' | 'domain'>; preview: CyclePreviewRow | null; skips: SkipRow[]; role: Role; now: number; credits: (usd: number) => number }): ComingUpView {
  const canDecide = roleAtLeast(o.role, 'member');
  if (!o.preview)
    return { available: false, cycleKey: '', cycleDate: '', scheduledFor: null, receivedAt: null, level: 2, pagesPerWeek: 0, waitingForKeyword: false, pausedReason: '', reason: '', items: [], suggestions: [], refused: [], autoCredits: 0, canDecide, closed: false };
  const p = previewOf(o.preview.body);
  const siteId = n8nSiteId(o.site.domain);
  const due = o.preview.scheduledFor?.getTime() ?? Date.parse(p.scheduled_for);
  const closed = Number.isFinite(due) && due <= o.now;
  const toItem = (x: CyclePreviewItem): ComingUpItem => {
    const t = x.ai_target as (Record<string, unknown> & { question?: unknown }) | null | undefined;
    return {
      itemKey: x.item_key,
      keyword: x.keyword,
      source: x.source,
      pageType: x.page_type,
      existingPageUrl: x.existing_page_url,
      ladderId: x.ladder_id,
      rung: x.rung,
      why: x.why,
      auto: x.auto,
      credits: o.credits(x.est_usd),
      aiTarget: t && S(t.question)
        ? {
            targetId: S(t.target_id),
            question: S(t.question),
            kind: S(t.kind) === 'refresh' ? 'refresh' : 'answer',
            fanout: Array.isArray(t.fanout) ? t.fanout.map(String) : [],
            sources: (Array.isArray(t.sources) ? t.sources : []).map((s) => (s && typeof s === 'object' ? { url: S((s as Record<string, unknown>).u ?? (s as Record<string, unknown>).url), title: S((s as Record<string, unknown>).t ?? (s as Record<string, unknown>).title) } : { url: S(s), title: '' })).filter((s) => s.url),
            competitors: Array.isArray(t.competitors) ? t.competitors.map(String) : [],
          }
        : null,
      decision: decisionOf(o.skips, siteId, p.cycle_key, x.item_key),
      canSkip: canDecide && !closed,
      canApprove: canDecide && !closed && !x.auto,
    };
  };
  const items = p.items.map(toItem);
  return {
    available: true,
    cycleKey: p.cycle_key,
    cycleDate: p.cycle_date ?? '',
    scheduledFor: Number.isFinite(due) ? new Date(due).toISOString() : null,
    receivedAt: o.preview.receivedAt.toISOString(),
    level: p.level,
    pagesPerWeek: p.pages_per_week,
    waitingForKeyword: p.waiting_for_keyword,
    pausedReason: p.paused_reason as ComingUpView['pausedReason'],
    reason: p.reason ?? '',
    items,
    suggestions: p.suggestions.map(toItem),
    refused: (p.refused ?? []).map((r) => ({ keyword: r.keyword, source: r.source, reason: r.reason, detail: r.detail })),
    autoCredits: items.filter((i) => i.auto && i.decision?.decision !== 'skip').reduce((t, i) => t + i.credits, 0),
    canDecide,
    closed,
  };
}

async function skipsOf(site: Pick<SiteRow, 'domain'>, fresh = false): Promise<SkipRow[]> {
  return n8nRows<SkipRow>('skips', { filters: [{ columnName: 'site_id', condition: 'eq', value: n8nSiteId(site.domain) }], max: 2000, fresh }).catch(() => []);
}

/** GET .../coming-up */
export async function loadComingUp(site: SiteRow, role: Role, now = Date.now()): Promise<ComingUpView> {
  const [preview, skips] = await Promise.all([latestPreview(site.id), skipsOf(site)]);
  return comingUpView({ site, preview, skips, role, now, credits: creditsOfUsd });
}

export interface ComingUpDecisionInput {
  itemKey: string;
  decision: 'skip' | 'approve';
  scope: 'cycle' | 'always';
}

/** The seo_skips row a decision writes, after checking it against the plan (pure). */
export function decisionRow(o: { site: Pick<SiteRow, 'domain'>; preview: CyclePreviewRow | null; input: ComingUpDecisionInput; by: string; now: number }): { row: SkipRow; item: CyclePreviewItem; preview: CyclePreview } {
  if (!o.preview) throw notFound('There is no "Coming up" plan for this website yet');
  const p = previewOf(o.preview.body);
  const due = o.preview.scheduledFor?.getTime() ?? Date.parse(p.scheduled_for);
  if (Number.isFinite(due) && due <= o.now) throw new HttpError(409, 'This cycle has already started, so its plan can no longer be changed. Decide on the next plan when it arrives.', 'cycle_started');
  const key = itemKeyOf(o.input.itemKey);
  const item = [...p.items, ...p.suggestions].find((x) => x.item_key === key);
  if (!item) throw badRequest('That item is not in the coming plan', { itemKey: 'Not in the plan' });
  if (o.input.decision === 'approve' && item.auto) throw badRequest('This page is written on its own in this cycle already. Skip it if you do not want it.', { decision: 'Already automatic' });
  if (o.input.decision === 'approve' && o.input.scope === 'always') throw badRequest('An approval counts for one cycle. Approve it again in a later plan, or choose a keyword for it.', { scope: 'Approvals are for this cycle' });
  const siteId = n8nSiteId(o.site.domain);
  const row: SkipRow = {
    key: skipKey(siteId, o.input.scope, p.cycle_key, key),
    site_id: siteId,
    cycle_key: o.input.scope === 'always' ? '' : p.cycle_key,
    item_key: key,
    decision: o.input.decision,
    scope: o.input.scope,
    by: o.by.slice(0, 200),
    created_at: new Date(o.now).toISOString(),
  };
  return { row, item, preview: p };
}

/** POST .../coming-up/decisions: writes the decision to the engine's seo_skips (one row per key; a new decision replaces the old). */
export async function decideComingUp(site: SiteRow, user: Pick<UserRow, 'email'>, role: Role, input: ComingUpDecisionInput, now = Date.now()): Promise<ComingUpDecisionResult> {
  const preview = await latestPreview(site.id);
  const { row, preview: p } = decisionRow({ site, preview, input, by: user.email, now });
  await ensureTable('skips', SKIPS_COLUMNS);
  await upsertRow('skips', [{ columnName: 'key', condition: 'eq', value: row.key }], row as unknown as Record<string, unknown>);
  // the client's newest word wins: an approval for this cycle clears an "always skip" of the same item (the engine lets a skip win)
  if (row.decision === 'approve') await deleteRows('skips', [{ columnName: 'key', condition: 'eq', value: skipKey(row.site_id, 'always', p.cycle_key, row.item_key) }]);
  const view = comingUpView({ site, preview, skips: await skipsOf(site, true), role, now, credits: creditsOfUsd });
  const item = [...view.items, ...view.suggestions].find((x) => x.itemKey === row.item_key)!;
  return { item, key: row.key };
}

// ---------------- the weekly e-mail (D15) ----------------

/** The e-mail of one plan (pure): plain words, the price in credits, what is automatic and what waits for an OK. */
export function comingUpMail(o: { site: Pick<SiteRow, 'domain' | 'timezone'>; view: ComingUpView; url: string }): { subject: string; title: string; lines: string[]; details: { label: string; value: string }[] } {
  const v = o.view;
  const day = v.scheduledFor ? localDayName(siteTimezone(o.site), v.scheduledFor) : '';
  const autos = v.items.filter((i) => i.auto);
  const waits = [...v.items.filter((i) => !i.auto), ...v.suggestions];
  const level = AUTOPILOT_LEVELS.find((l) => l.level === v.level);
  const lines: string[] = [];
  if (v.waitingForKeyword) lines.push('We write nothing for this website until you choose the keyword you want to be found for. Choose it in the app and its first page is written in the next cycle.');
  else if (v.pausedReason === 'pileup') lines.push('Nothing new is written this week: pages we already wrote are waiting for you to publish them. Publish them and the next cycle continues.');
  else if (v.pausedReason === 'site_paused') lines.push('The website is paused, so this cycle writes nothing. Resume it in the app to continue.');
  if (autos.length) lines.push(`Written on their own${day ? ` on ${day}` : ''}: ${autos.map((i) => `"${i.keyword}" (about ${i.credits} credits)`).join(', ')}. Skip any of them in the app if you do not want it.`);
  if (waits.length) lines.push(`Waiting for your OK: ${waits.slice(0, 6).map((i) => `"${i.keyword}" (about ${i.credits} credits)`).join(', ')}${waits.length > 6 ? ` and ${waits.length - 6} more` : ''}. Approve the ones you want and they are written in this cycle.`);
  if (!autos.length && !waits.length && !v.waitingForKeyword && !v.pausedReason) lines.push('Nothing is planned to be written this week. Your checks and reports run as usual.');
  lines.push(`Your autopilot level: ${level ? `${v.level}, ${level.label.toLowerCase()}` : v.level}. You can change it in the website's settings at any time.`);
  return {
    subject: `Coming up${day ? ` on ${day}` : ' this week'} for ${o.site.domain}`,
    title: `Coming up${day ? ` on ${day}` : ' this week'}`,
    lines,
    details: [
      { label: 'Website', value: o.site.domain },
      { label: 'Written on their own', value: `${autos.length} (about ${v.autoCredits} credits)` },
      { label: 'Waiting for your OK', value: String(waits.length) },
    ],
  };
}

type Log = { info: (o: object, m: string) => void; error: (o: object, m: string) => void };

/** Sends the plan's e-mail once (cycle_previews.emailed_at is claimed first, so two callbacks of one cycle send one e-mail). */
export async function emailComingUp(org: OrgRow, site: SiteRow, preview: CyclePreviewRow, log: Log, now = Date.now()): Promise<boolean> {
  const view = comingUpView({ site, preview, skips: await skipsOf(site), role: 'owner', now, credits: creditsOfUsd });
  if (!view.available || view.closed) return false;
  const [claimed] = await db
    .update(schema.cyclePreviews)
    .set({ emailedAt: new Date(now) })
    .where(and(eq(schema.cyclePreviews.id, preview.id), eq(schema.cyclePreviews.siteId, site.id), isNull(schema.cyclePreviews.emailedAt)))
    .returning({ id: schema.cyclePreviews.id });
  if (!claimed) return false;
  const to = await billingContacts(org.id);
  if (!to.length) return false;
  const base = await baseUrlFor(org);
  const url = `${base}/o/${org.id}/sites/${site.id}/pipeline`;
  const m = comingUpMail({ site, view, url });
  const sender = await senderFor(org);
  let sent = false;
  for (const addr of to)
    sent = (await sendMail({ to: addr, subject: m.subject, title: m.title, lines: m.lines, details: m.details, action: { label: 'Open the plan', url }, sender, footer: `You receive this e-mail once a week because you manage ${site.domain} in ${sender.brandName}.` }, log).catch(() => false)) || sent;
  return sent;
}

/** A plan just arrived: keep it and e-mail it (the first plan of a cycle only). */
export async function onPreview(org: OrgRow, site: SiteRow, body: Record<string, unknown>, reportId: string, log: Log): Promise<void> {
  const row = await storePreview(org, site, body, reportId);
  if (row && !row.emailedAt) await emailComingUp(org, site, row, log);
}
