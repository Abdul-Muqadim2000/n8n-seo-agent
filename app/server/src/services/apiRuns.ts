import { createHash } from 'node:crypto';
import {
  API_SCOPE_ROLE,
  estimateRunMinutes,
  idempotencyKeyOk,
  IDEMPOTENCY,
  MODES,
  MODE_IDS,
  NOTICE_MODES,
  parseRunInput,
  pipelineNotices,
  RUN_SCHEMAS,
  roleAtLeast,
  type ApiScope,
  type ModeId,
  type PipelineNotice,
  type Role,
  type RunInput,
  type RunV1,
} from '@seo/shared';
import { z } from 'zod';
import type { OrgAccess } from '../auth/access';
import type { SiteRow } from '../db/schema';
import { badRequest, HttpError, validationError } from '../lib/errors';
import { getRun, requireScope, siteOf, toRunV1, type V1Ctx } from './apiV1';
import { pipelineData } from './pipeline';
import { createRunWithMeta, estimateCost, findIdempotentRun } from './runs';
import { creatorMembership } from './apiKeys';
import { monthSpend } from './spend';

/**
 * G4 (2026-10-17) — the write API: start any analysis a form can start (`POST /api/v1/runs`, MCP `start_run`).
 * Design note: app/docs/INTEGRATIONS.md §4.
 *
 * Nothing here is a second copy of the app's run path. The body is validated by the forms' own schemas (`parseRunInput`), the run is
 * created by the same `createRunWithMeta` the form route calls — the company lock, the budget check, the platform ceiling, the
 * engine's front door, the ladder-page and tracking bookkeeping — and the duplicate warnings are the forms' own `pipelineNotices`,
 * computed here on the same pipeline data the page reads. What is added is only what a machine caller needs that a person has:
 * an identity (the key's creator, re-checked), an explicit acknowledgement in place of the form's tick box, a dry run, and an
 * Idempotency-Key in place of a person not pressing the button twice.
 */

/**
 * Who acts. A session acts as the signed-in person; a key acts as the person who created it — who must STILL be a member with the
 * role the scope needs (a key must not outlive its creator's access). The answer is the same `OrgAccess` the form routes use.
 */
export async function actorOf(ctx: V1Ctx, scope: ApiScope): Promise<OrgAccess> {
  requireScope(ctx, scope);
  const need = API_SCOPE_ROLE[scope] as Role;
  if (ctx.auth === 'session') {
    if (!ctx.actor) throw new HttpError(401, 'Sign in again', 'unauthorized');
    if (!roleAtLeast(ctx.actor.role, need)) throw new HttpError(403, `Your role cannot do this (it needs ${need} or higher)`, 'scope_missing');
    return ctx.actor;
  }
  const m = await creatorMembership(ctx.org.id, ctx.key?.createdBy ?? null);
  if (!m || !roleAtLeast(m.role as Role, need))
    throw new HttpError(
      403,
      `The person who created this API key is no longer ${need === 'admin' ? 'an admin' : 'a member'} of ${ctx.org.name}, so the key cannot ${scope === 'admin' ? 'manage integrations' : 'start work'} any more. Revoke it and create a new one.`,
      'key_owner_gone',
    );
  return { org: ctx.org, user: m.user, role: m.role };
}

/** The request body, beside the form fields: what the caller acknowledges, and whether this is only a preview. */
const extrasSchema = z.object({
  acknowledge: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  dryRun: z.boolean().default(false),
});

/** A stable JSON of a value (keys sorted), so two equal requests hash the same whatever order their fields came in. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}
export const requestHash = (input: RunInput, acknowledge: string[]): string =>
  createHash('sha256').update(canonical({ input, acknowledge: [...acknowledge].sort() })).digest('hex');

/** `websiteId` (the v1 name) is accepted for the forms' `siteId`; the v1 extras are not form fields. */
export function formBodyOf(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest('Send a JSON object: { "mode": …, "websiteId": …, … }', { mode: 'Required' });
  const { websiteId, acknowledge: _a, dryRun: _d, ...rest } = body as Record<string, unknown>;
  return websiteId !== undefined && rest.siteId === undefined ? { ...rest, siteId: websiteId } : rest;
}

/** Warnings the form asks a person to tick before starting, that this caller has not acknowledged by id. */
export const unconfirmed = (notices: readonly PipelineNotice[], acknowledged: readonly string[]): PipelineNotice[] =>
  notices.filter((n) => n.tone === 'warning' && n.confirm && !acknowledged.includes(n.id));

export interface StartAnswer {
  status: 200 | 201;
  replayed: boolean;
  body:
    | { dryRun: true; mode: ModeId; estimate: { usd: number; minutes: number }; notices: PipelineNotice[]; needsAcknowledge: string[]; budget: { spentUsd: number; budgetUsd: number; remainingUsd: number } }
    | { run: RunV1 & { input: Record<string, unknown> }; notices: PipelineNotice[] };
}

export async function startRunV1(ctx: V1Ctx, rawBody: unknown, idempotencyKey: string | undefined): Promise<StartAnswer> {
  const actor = await actorOf(ctx, 'run');
  if (idempotencyKey !== undefined && !idempotencyKeyOk(idempotencyKey))
    throw new HttpError(400, `Idempotency-Key must be 1-200 characters of letters, digits and _ . : -`, 'validation', { [IDEMPOTENCY.header]: 'Invalid' });
  const extras = extrasSchema.safeParse({ acknowledge: (rawBody as { acknowledge?: unknown })?.acknowledge, dryRun: (rawBody as { dryRun?: unknown })?.dryRun });
  if (!extras.success) throw validationError(extras.error);
  const form = formBodyOf(rawBody);
  // the website must be this company's: a website of another company is "not found", the same answer as one that does not exist.
  // Like the form, the website fills the country when the caller leaves it out.
  let site: SiteRow | null = null;
  if (typeof form.siteId === 'string' && form.siteId) {
    site = await siteOf(ctx, form.siteId);
    if (form.country === undefined && site.country) form.country = site.country;
  }
  const parsed = parseRunInput(form);
  if (!parsed.success) throw validationError(parsed.error);
  const input = parsed.data;

  // the forms' own duplicate warnings, on the same pipeline data the page reads
  const estimate = await estimateCost(input);
  let notices: PipelineNotice[] = [];
  if (site?.verifiedAt && NOTICE_MODES.includes(input.mode)) {
    const data = await pipelineData(ctx.org, site).catch(() => null);
    notices = pipelineNotices(input.mode, input as never, data, { costUsd: estimate });
  }
  const open = unconfirmed(notices, extras.data.acknowledge);

  if (extras.data.dryRun) {
    const spent = await monthSpend(ctx.org.id);
    return {
      status: 200,
      replayed: false,
      body: {
        dryRun: true,
        mode: input.mode,
        estimate: { usd: estimate, minutes: estimateRunMinutes(input.mode, input as unknown as Record<string, unknown>) },
        notices,
        needsAcknowledge: open.map((n) => n.id),
        budget: { spentUsd: round(spent), budgetUsd: ctx.org.monthlyBudgetUsd, remainingUsd: round(Math.max(0, ctx.org.monthlyBudgetUsd - spent)) },
      },
    };
  }
  // a repeat with the same key is answered from the run itself, even when its warnings would now be different
  const idem = idempotencyKey ? { key: idempotencyKey, hash: requestHash(input, extras.data.acknowledge) } : null;
  if (open.length && !(idem && (await findIdempotentRun(ctx.org.id, idem.key))))
    throw new HttpError(
      409,
      `This looks like a duplicate of work already planned or running. Read the notices, then send their ids in "acknowledge" to start it anyway.`,
      'confirm_needed',
      undefined,
      { notices, needsAcknowledge: open.map((n) => n.id) },
    );

  const { run, replayed } = await createRunWithMeta(actor, input, { apiKeyId: ctx.key?.id ?? null, idempotency: idem });
  const full = await getRun(ctx, run.id);
  return { status: replayed ? 200 : 201, replayed, body: { run: full.run, notices } };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** What each mode needs, for a caller (or an assistant) deciding what to send: the forms' schemas as JSON Schema. */
export function modesV1() {
  return {
    items: MODE_IDS.map((id) => {
      const m = MODES[id];
      let inputSchema: unknown = null;
      try {
        inputSchema = z.toJSONSchema(RUN_SCHEMAS[id], { io: 'input', unrepresentable: 'any' });
      } catch {
        inputSchema = null;
      }
      return {
        mode: id,
        title: m.title,
        description: m.summary,
        websiteRequired: !!m.siteBound,
        delivers: m.delivers,
        estimate: { usd: m.costUsd, minutes: estimateRunMinutes(id, { mode: id }) },
        inputSchema,
      };
    }),
  };
}

export { toRunV1 };
