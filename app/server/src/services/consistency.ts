import type { FastifyRequest } from 'fastify';
import {
  confirmNeededBody,
  consistencyWarnings,
  countryOf,
  needsAcknowledge,
  NOTICE_MODES,
  overriddenCodes,
  type AiPromptRow,
  type ConsistencyAction,
  type ConsistencyCtx,
  type ConsistencySite,
  type LadderRow,
  type RunInput,
  type SiteRow as EngineSiteRow,
  type Warning,
} from '@seo/shared';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db';
import type { OrgRow, SiteRow } from '../db/schema';
import { HttpError } from '../lib/errors';
import { siteRows } from '../n8n/client';
import { audit, type AuditActor } from './audit';

/**
 * MKT (2026-10-27, n8n/seo-agent/docs/mismatch-audit-2026-10-27/AUDIT.md §2.2): the server side of the one mismatch mechanism.
 * The rules are pure and live in `@seo/shared` (consistency.ts, one registry); this file only reads what they need (the website row,
 * the pipeline, the engine's own row of the website, the ladders, the latest research, the AI questions) and enforces the answer:
 * a warning that is not acknowledged answers 409 `confirm_needed` with the warnings (`notices` and `warnings`, one list) and the ids
 * to send back in `acknowledge`. Every start goes through it (createRunWithMeta): the app's forms, the REST API, MCP, proposals,
 * onboarding. An automatic start cannot acknowledge, so it stops and becomes a "Needs you" item.
 */

export const siteApiOf = (site: Pick<SiteRow, 'orgId' | 'id'>): string => `/api/orgs/${site.orgId}/sites/${site.id}`;

export const consistencySite = (s: SiteRow): ConsistencySite => ({
  domain: s.domain,
  country: s.country,
  business: s.business,
  customers: s.customers,
  businessFacts: s.businessFacts,
  services: s.services,
  cta: s.cta,
  timezone: s.timezone,
});

const tracked = (s: SiteRow) => !!s.verifiedAt && ['active', 'paused'].includes(s.trackingStatus);

/** The warnings of a run start: the forms' duplicate warnings and the market checks, on the website's own data. */
export async function runWarnings(org: OrgRow, site: SiteRow | null, input: RunInput, opts: { costLabel?: string } = {}): Promise<Warning[]> {
  if (!site) return [];
  // read lazily: pipeline.ts imports half the server, and runs.ts (which imports this file) is one of its readers
  const pipeline = site.verifiedAt && NOTICE_MODES.includes(input.mode) ? await import('./pipeline').then((m) => m.pipelineData(org, site)).catch(() => null) : null;
  return consistencyWarnings('run', input as unknown as Record<string, unknown>, {
    site: consistencySite(site),
    siteApi: siteApiOf(site),
    tracked: tracked(site),
    pipeline,
    pipelineOpts: opts.costLabel ? { costLabel: opts.costLabel } : undefined,
  });
}

/** The engine's row of the website (seo_sites): the market every weekly job measures it in. null when it cannot be read or is missing. */
export async function engineSiteRow(domain: string): Promise<EngineSiteRow | null> {
  try {
    const rows = await siteRows<EngineSiteRow>('sites', domain, { max: 5 });
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/** The website's ladders, one per ladder id, with the market each is measured in. */
export async function ladderMarkets(domain: string): Promise<{ id: string; head: string; country: string }[]> {
  const rows = await siteRows<LadderRow>('ladders', domain, { max: 2000 }).catch(() => [] as LadderRow[]);
  const by = new Map<string, { id: string; head: string; country: string }>();
  for (const r of rows) {
    if (!r.ladder_id || by.has(r.ladder_id) || ['archived', 'deleted'].includes(String(r.status))) continue;
    by.set(r.ladder_id, { id: r.ladder_id, head: r.head_keyword || r.keyword, country: r.country || (r.location_code ? String(r.location_code) : '') });
  }
  return [...by.values()].map((l) => ({ ...l, country: countryOf(l.country)?.name ?? l.country }));
}

/** Everything the standing checks read about one website (each part on its own: an unreadable part is simply not judged). */
export async function standingCtx(org: OrgRow, site: SiteRow): Promise<ConsistencyCtx> {
  const { latestReport } = await import('./runs');
  const [engine, ladders, research, prompts] = await Promise.all([
    tracked(site) ? engineSiteRow(site.domain) : Promise.resolve(null),
    site.verifiedAt ? ladderMarkets(site.domain) : Promise.resolve([]),
    site.verifiedAt ? latestReport(org.id, site.id, ['keyword_strategy']).catch(() => null) : Promise.resolve(null),
    tracked(site) ? siteRows<AiPromptRow>('aiPrompts', site.domain, { max: 600 }).catch(() => [] as AiPromptRow[]) : Promise.resolve([] as AiPromptRow[]),
  ]);
  return {
    site: consistencySite(site),
    siteApi: siteApiOf(site),
    tracked: tracked(site),
    engine: engine ? { country: engine.country, locationCode: Number(engine.location_code) || null, languageCode: engine.language_code } : null,
    ladders,
    research: research ? { country: countryOf(String(research.payload.country ?? ''))?.name ?? null } : null,
    aiPrompts: prompts.filter((p) => p.source === 'custom' || p.source === 'auto' || !p.source).map((p) => ({ promptId: p.prompt_id, prompt: p.prompt, market: p.market, status: p.status })),
  };
}

/** The website's standing warnings (shown as a banner on its pages), without those a person already answered with Continue anyway. */
export async function standingWarnings(org: OrgRow, site: SiteRow): Promise<{ warnings: Warning[]; acknowledged: Warning[] }> {
  const all = consistencyWarnings('site_standing', {}, await standingCtx(org, site));
  const ack = new Set(site.acknowledgedWarnings ?? []);
  return { warnings: all.filter((w) => !(w.tone === 'warning' && ack.has(w.id))), acknowledged: all.filter((w) => w.tone === 'warning' && ack.has(w.id)) };
}

const DUPLICATE_MESSAGE = 'This looks like a duplicate of work already planned or running. Read the notices, then send their ids in "acknowledge" to start it anyway.';
const MISMATCH_MESSAGE = 'This does not match what we know about the website. Read the warnings: apply the correction they offer, or send their ids in "acknowledge" to go ahead anyway.';

/** The one 409 every path answers: `confirm_needed`, with the warnings and the ids still to acknowledge. */
export function confirmNeeded(warnings: Warning[], open: Warning[], message?: string): HttpError {
  const msg = message ?? (open.every((w) => w.code.startsWith('pipeline.')) ? DUPLICATE_MESSAGE : MISMATCH_MESSAGE);
  return new HttpError(409, msg, 'confirm_needed', undefined, confirmNeededBody(warnings, open) as unknown as Record<string, unknown>);
}

/** Throws the 409 when a warning is not acknowledged; returns what the caller went past (for the run and the audit log). */
export function assertConsistent(warnings: Warning[], acknowledge: readonly string[] = [], message?: string): { ids: string[]; codes: string[] } {
  const open = needsAcknowledge(warnings, acknowledge);
  if (open.length) throw confirmNeeded(warnings, open, message);
  return overriddenCodes(warnings, acknowledge);
}

/** Whether an error is the mechanism's 409 (an automatic start turns it into a "Needs you" item). */
export const isConfirmNeeded = (err: unknown): err is HttpError & { extra: { warnings: Warning[]; needsAcknowledge: string[] } } =>
  err instanceof HttpError && err.statusCode === 409 && err.code === 'confirm_needed';

/** The first open warning's title, for a note a person reads ("Waiting for you: ..."). */
export function firstOpenTitle(err: unknown): string {
  if (!isConfirmNeeded(err)) return '';
  const open = new Set(err.extra.needsAcknowledge ?? []);
  return (err.extra.warnings ?? []).find((w) => open.has(w.id))?.title ?? '';
}

/** One audit row for every "Continue anyway": which codes, on what, with which values. */
export async function recordOverride(
  req: FastifyRequest | null,
  orgId: string,
  e: { codes: string[]; ids: string[]; target: { type: string; id?: string | null; label?: string | null }; what: string; actor?: AuditActor; values?: Record<string, unknown> },
): Promise<void> {
  if (!e.ids.length) return;
  await audit(req, orgId, { action: 'warning.overridden', target: e.target, ...(e.actor ? { actor: e.actor } : {}), details: { codes: e.codes, ids: e.ids.slice(0, 20), what: e.what, ...(e.values ?? {}) } });
}

/** Keeps a standing warning quiet: its id is stored on the website (the id embeds the facts, so a change warns again). */
export async function acknowledgeOnSite(site: SiteRow, ids: string[]): Promise<string[]> {
  const next = [...new Set([...(site.acknowledgedWarnings ?? []), ...ids])].slice(-100);
  await db.update(schema.sites).set({ acknowledgedWarnings: next, updatedAt: new Date() }).where(eq(schema.sites.id, site.id));
  return next;
}

/** A check of a non-run write (site save, AI questions): the warnings, enforced. */
export function checkWrite(action: ConsistencyAction, input: Record<string, unknown>, ctx: ConsistencyCtx, acknowledge: readonly string[] = []) {
  const warnings = consistencyWarnings(action, input, ctx);
  return { warnings, ...assertConsistent(warnings, acknowledge) };
}

/** `acknowledge` from any request body (a list of warning ids), and the body without it. */
export function takeAcknowledge(body: unknown): { acknowledge: string[]; rest: unknown } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { acknowledge: [], rest: body };
  const { acknowledge, ...rest } = body as Record<string, unknown>;
  const list = Array.isArray(acknowledge) ? acknowledge.map((x) => String(x ?? '').trim()).filter((x) => x && x.length <= 200).slice(0, 20) : [];
  return { acknowledge: list, rest };
}
