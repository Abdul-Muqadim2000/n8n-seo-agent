import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, lt, lte, or, sql } from 'drizzle-orm';
import {
  DELIVERY,
  eventBody,
  eventsFor,
  nextAttemptAt,
  WEBHOOKS,
  webhookEndpointPatchSchema,
  webhookEndpointSchema,
  type CallbackFacts,
  type EventEnvelope,
  type WebhookDeliveryView,
  type WebhookEndpointView,
  type WebhookEvent,
  type WebhookFormat,
} from '@seo/shared';
import { config } from '../config';
import { db, schema } from '../db';
import type { OrgRow, RunRow, SiteRow, UserRow, WebhookDeliveryRow, WebhookEndpointRow } from '../db/schema';
import { randomToken } from '../lib/crypto';
import { HttpError, notFound, parse } from '../lib/errors';
import { outbound, safeError } from '../lib/netGuard';
import { seal, secretsReady, unseal } from '../lib/secretBox';
import { signBody } from './reportDelivery';

/**
 * G4 (2026-10-17) — event webhooks: several endpoints per company, each subscribed to event types and websites, delivered as
 * HMAC-signed JSON, as a Slack message or as a Teams card, retried with backoff, logged. Design note: app/docs/INTEGRATIONS.md §2, §5.
 *
 * Reused, not re-made: the signature is report delivery's `signBody` (HMAC-SHA256 over `<timestamp>.<body>`, the same two headers);
 * the address rule is report delivery's `webhookUrlOk`; the connection goes through `lib/netGuard.ts` (connect-time DNS check);
 * secrets are sealed with `MAILBOX_KEY` like mailbox passwords; the event of a report is decided by the same `deliveryDecision`.
 *
 * The table `webhook_deliveries` is both the log and the queue: an event is written as one row per subscribed endpoint, sent at
 * once, and picked up again by `webhookTick` when it failed. A row is claimed before it is sent (`claim`), so the immediate send
 * and the timer can never post it twice.
 */

type Log = { info: (o: object, m: string) => void; warn?: (o: object, m: string) => void; error: (o: object, m: string) => void };

const requireSecrets = () => {
  if (!secretsReady())
    throw new HttpError(400, 'This server cannot store connection secrets yet (MAILBOX_KEY is not set). Ask the platform administrator to set it.', 'secrets_unavailable');
};

const hostOf = (url: string) => (url.match(/^https?:\/\/([^/?#]+)/i)?.[1] ?? '').toLowerCase();

export function toEndpointView(r: WebhookEndpointRow): WebhookEndpointView {
  return {
    id: r.id,
    name: r.name,
    format: r.format as WebhookFormat,
    urlHost: r.urlHost,
    urlHint: r.urlHint,
    hasSecret: !!r.secretSealed,
    events: r.events as WebhookEvent[],
    websiteIds: r.siteIds,
    enabled: r.enabled,
    disabledReason: r.disabledReason,
    consecutiveFailures: r.consecutiveFailures,
    createdAt: r.createdAt.toISOString(),
    lastSuccessAt: r.lastSuccessAt ? r.lastSuccessAt.toISOString() : null,
    lastFailureAt: r.lastFailureAt ? r.lastFailureAt.toISOString() : null,
  };
}

export async function listEndpoints(orgId: string): Promise<WebhookEndpointView[]> {
  const rows = await db.select().from(schema.webhookEndpoints).where(eq(schema.webhookEndpoints.orgId, orgId)).orderBy(desc(schema.webhookEndpoints.createdAt)).limit(50);
  return rows.map(toEndpointView);
}

/** The websites must be this company's (another company's id is refused, never stored). */
async function ownSiteIds(orgId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await db.select({ id: schema.sites.id }).from(schema.sites).where(and(eq(schema.sites.orgId, orgId), inArray(schema.sites.id, ids)));
  if (rows.length !== new Set(ids).size) throw new HttpError(400, 'Choose websites of this company', 'validation', { websiteIds: 'Unknown website' });
  return rows.map((r) => r.id);
}

/** Creates an endpoint. A signed-JSON endpoint gets a signing secret, returned here once (`whsec_…`) and never again. */
export async function createEndpoint(org: OrgRow, user: UserRow, body: unknown): Promise<{ endpoint: WebhookEndpointView; secret: string | null }> {
  const v = parse(webhookEndpointSchema, body);
  requireSecrets();
  const count = await db.select({ n: sql<number>`count(*)::int` }).from(schema.webhookEndpoints).where(eq(schema.webhookEndpoints.orgId, org.id));
  if (Number(count[0]?.n ?? 0) >= WEBHOOKS.maxEndpoints) throw new HttpError(409, `A company can have ${WEBHOOKS.maxEndpoints} event endpoints. Remove one first.`, 'webhook_limit');
  const siteIds = await ownSiteIds(org.id, v.websiteIds);
  const secret = v.format === 'json' ? 'whsec_' + randomToken(24) : null;
  const [row] = await db
    .insert(schema.webhookEndpoints)
    .values({
      orgId: org.id,
      name: v.name,
      format: v.format,
      urlSealed: seal(v.url),
      urlHost: hostOf(v.url),
      urlHint: v.url.slice(-4),
      secretSealed: secret ? seal(secret) : '',
      events: v.events,
      siteIds,
      enabled: v.enabled,
      createdBy: user.id,
    })
    .returning();
  return { endpoint: toEndpointView(row), secret };
}

async function endpointOf(orgId: string, id: unknown): Promise<WebhookEndpointRow> {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw notFound('Endpoint not found');
  const row = await db.query.webhookEndpoints.findFirst({ where: and(eq(schema.webhookEndpoints.orgId, orgId), eq(schema.webhookEndpoints.id, id)) });
  if (!row) throw notFound('Endpoint not found');
  return row;
}

export async function updateEndpoint(orgId: string, id: unknown, body: unknown): Promise<WebhookEndpointView> {
  const row = await endpointOf(orgId, id);
  const v = parse(webhookEndpointPatchSchema, body ?? {});
  const patch: Partial<WebhookEndpointRow> = {};
  if (v.name !== undefined) patch.name = v.name;
  if (v.events !== undefined) patch.events = [...new Set(v.events)];
  if (v.websiteIds !== undefined) patch.siteIds = await ownSiteIds(orgId, v.websiteIds);
  // switching it back on clears the reason it was switched off and gives it a clean slate
  if (v.enabled !== undefined) Object.assign(patch, v.enabled ? { enabled: true, disabledReason: '', consecutiveFailures: 0 } : { enabled: false });
  const [saved] = await db.update(schema.webhookEndpoints).set(patch).where(eq(schema.webhookEndpoints.id, row.id)).returning();
  return toEndpointView(saved);
}

export async function rotateSecret(orgId: string, id: unknown): Promise<{ endpoint: WebhookEndpointView; secret: string }> {
  const row = await endpointOf(orgId, id);
  if (row.format !== 'json') throw new HttpError(400, 'Only a signed-JSON endpoint has a signing secret', 'validation');
  requireSecrets();
  const secret = 'whsec_' + randomToken(24);
  const [saved] = await db.update(schema.webhookEndpoints).set({ secretSealed: seal(secret) }).where(eq(schema.webhookEndpoints.id, row.id)).returning();
  return { endpoint: toEndpointView(saved), secret };
}

export async function deleteEndpoint(orgId: string, id: unknown): Promise<{ deleted: true }> {
  const row = await endpointOf(orgId, id);
  await db.delete(schema.webhookEndpoints).where(eq(schema.webhookEndpoints.id, row.id));
  return { deleted: true };
}

// ---------------------------------------------------------------------------------------------------------------------------
// sending
// ---------------------------------------------------------------------------------------------------------------------------

export interface SendResult {
  ok: boolean;
  status: number | null;
  error: string;
}

/** One POST to one endpoint. Pure in its inputs (the row and the envelope), so the test endpoint and the queue share it. */
export async function sendTo(ep: WebhookEndpointRow, deliveryId: string, e: EventEnvelope): Promise<SendResult> {
  let url: string;
  try {
    url = unseal(ep.urlSealed);
  } catch {
    return { ok: false, status: null, error: 'The stored address cannot be read (the server key changed): add the endpoint again' };
  }
  const body = JSON.stringify(eventBody(ep.format as WebhookFormat, e));
  const timestamp = String(Date.now());
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    [DELIVERY.timestampHeader]: timestamp,
    [WEBHOOKS.eventHeader]: e.type,
    [WEBHOOKS.deliveryHeader]: deliveryId,
  };
  if (ep.secretSealed) {
    try {
      headers[DELIVERY.signatureHeader] = signBody(unseal(ep.secretSealed), timestamp, body);
    } catch {
      return { ok: false, status: null, error: 'The signing secret cannot be read (the server key changed): rotate it' };
    }
  }
  try {
    const res = await outbound({ url, method: 'POST', headers, body, timeoutMs: WEBHOOKS.timeoutMs, maxBytes: 64 * 1024 });
    if (res.status >= 200 && res.status < 300) return { ok: true, status: res.status, error: '' };
    return { ok: false, status: res.status, error: `${ep.urlHost} answered ${res.status}${res.text ? `: ${res.text.replace(/\s+/g, ' ').slice(0, 160)}` : ''}` };
  } catch (err) {
    return { ok: false, status: null, error: `${ep.urlHost}: ${safeError(err)}` };
  }
}

/** Takes one due delivery for this process (pushes its next attempt 5 minutes out); false when someone else has it. */
async function claim(id: string): Promise<WebhookDeliveryRow | null> {
  const [row] = await db
    .update(schema.webhookDeliveries)
    .set({ nextAttemptAt: new Date(Date.now() + 5 * 60_000) })
    .where(and(eq(schema.webhookDeliveries.id, id), inArray(schema.webhookDeliveries.status, ['pending', 'failed']), lte(schema.webhookDeliveries.nextAttemptAt, new Date())))
    .returning();
  return row ?? null;
}

export async function attempt(id: string): Promise<void> {
  const d = await claim(id);
  if (!d) return;
  const ep = await db.query.webhookEndpoints.findFirst({ where: eq(schema.webhookEndpoints.id, d.endpointId) });
  if (!ep || !ep.enabled) {
    await db.update(schema.webhookDeliveries).set({ status: 'gave_up', nextAttemptAt: null, lastError: ep ? 'The endpoint is switched off' : 'The endpoint was removed' }).where(eq(schema.webhookDeliveries.id, d.id));
    return;
  }
  const res = await sendTo(ep, d.id, d.payload as unknown as EventEnvelope);
  const attempts = d.attempts + 1;
  const now = new Date();
  if (res.ok) {
    await db.update(schema.webhookDeliveries).set({ status: 'sent', attempts, lastStatusCode: res.status, lastError: '', deliveredAt: now, nextAttemptAt: null }).where(eq(schema.webhookDeliveries.id, d.id));
    await db.update(schema.webhookEndpoints).set({ consecutiveFailures: 0, lastSuccessAt: now }).where(eq(schema.webhookEndpoints.id, ep.id));
    return;
  }
  // 410 Gone: the receiver says the address is retired (Slack and Teams answer this way for a removed webhook) — stop at once
  const gone = res.status === 410;
  const next = gone ? null : nextAttemptAt(attempts, now);
  await db
    .update(schema.webhookDeliveries)
    .set({ status: next ? 'failed' : 'gave_up', attempts, lastStatusCode: res.status, lastError: res.error.slice(0, 500), nextAttemptAt: next })
    .where(eq(schema.webhookDeliveries.id, d.id));
  const failures = ep.consecutiveFailures + 1;
  const disable = gone || failures >= WEBHOOKS.disableAfterFailures;
  await db
    .update(schema.webhookEndpoints)
    .set({
      consecutiveFailures: failures,
      lastFailureAt: now,
      ...(disable
        ? { enabled: false, disabledReason: gone ? `${ep.urlHost} answered 410 Gone: the address was removed on their side.` : `The last ${failures} deliveries all failed (last: ${res.error.slice(0, 200)}).` }
        : {}),
    })
    .where(eq(schema.webhookEndpoints.id, ep.id));
}

// ---------------------------------------------------------------------------------------------------------------------------
// events in
// ---------------------------------------------------------------------------------------------------------------------------

const appUrl = (path: string) => `${config.appUrl}${path}`;

export function envelope(org: Pick<OrgRow, 'id' | 'name'>, site: Pick<SiteRow, 'id' | 'domain'> | null, type: WebhookEvent, data: Record<string, unknown>, now = new Date()): EventEnvelope {
  return { id: randomUUID(), type, createdAt: now.toISOString(), company: { id: org.id, name: org.name }, website: site ? { id: site.id, domain: site.domain } : null, data };
}

/** Queues every event for every enabled endpoint of the company that subscribed to it (and to that website), then sends. */
export async function emit(org: Pick<OrgRow, 'id' | 'name'>, site: Pick<SiteRow, 'id' | 'domain'> | null, events: { type: WebhookEvent; data: Record<string, unknown> }[]): Promise<number> {
  if (!events.length) return 0;
  const eps = await db.select().from(schema.webhookEndpoints).where(and(eq(schema.webhookEndpoints.orgId, org.id), eq(schema.webhookEndpoints.enabled, true)));
  const rows: (typeof schema.webhookDeliveries.$inferInsert)[] = [];
  for (const ev of events) {
    const env = envelope(org, site, ev.type, ev.data);
    for (const ep of eps) {
      if (!(ep.events as string[]).includes(ev.type)) continue;
      if (ep.siteIds.length && (!site || !ep.siteIds.includes(site.id))) continue;
      rows.push({ orgId: org.id, endpointId: ep.id, eventId: env.id, eventType: ev.type, payload: env as unknown as Record<string, unknown>, status: 'pending', nextAttemptAt: new Date() });
    }
  }
  if (!rows.length) return 0;
  const inserted = await db.insert(schema.webhookDeliveries).values(rows).onConflictDoNothing().returning({ id: schema.webhookDeliveries.id });
  // sent now, one after the other (an endpoint's order of events is kept); a failure waits for the timer
  void (async () => {
    for (const r of inserted) await attempt(r.id).catch(() => undefined);
  })();
  return inserted.length;
}

export const runSummary = (r: Pick<RunRow, 'id' | 'orgId' | 'siteId' | 'mode' | 'title' | 'status' | 'error' | 'createdAt' | 'completedAt' | 'actualCostUsd' | 'estimatedCostUsd'>) => ({
  id: r.id,
  websiteId: r.siteId,
  mode: r.mode,
  title: r.title,
  status: r.status,
  error: r.error,
  createdAt: r.createdAt.toISOString(),
  completedAt: r.completedAt ? r.completedAt.toISOString() : null,
  costUsd: r.actualCostUsd ?? r.estimatedCostUsd,
  url: appUrl(`/o/${r.orgId}/runs/${r.id}`),
});

/** The events of one stored callback (called by `ingestCallback` after the report is saved; never allowed to fail it). */
export async function emitForCallback(
  org: OrgRow,
  site: SiteRow | null,
  report: { id: string; title: string; stage: string; status: string; receivedAt: Date; scheduled: boolean; runId: string | null },
  payload: Record<string, unknown>,
  runBefore: RunRow | null,
): Promise<number> {
  const runAfter = runBefore ? ((await db.query.runs.findFirst({ where: eq(schema.runs.id, runBefore.id) })) ?? null) : null;
  const facts: CallbackFacts = {
    stage: report.stage,
    status: report.status,
    payload,
    report: { ...report, receivedAt: report.receivedAt.toISOString(), websiteId: site?.id ?? null, url: appUrl(`/o/${org.id}/reports/${report.id}`) },
    runBefore: runBefore ? { status: runBefore.status } : null,
    runAfter: runAfter ? runSummary(runAfter) : null,
  };
  return emit(org, site, eventsFor(facts));
}

/** `run.failed` for runs closed outside a callback (the engine refused at the door, its execution failed, or it expired). */
export async function emitRunsFailed(runIds: string[]): Promise<void> {
  if (!runIds.length) return;
  const rows = await db
    .select({ r: schema.runs, org: schema.organizations, site: schema.sites })
    .from(schema.runs)
    .innerJoin(schema.organizations, eq(schema.runs.orgId, schema.organizations.id))
    .leftJoin(schema.sites, eq(schema.runs.siteId, schema.sites.id))
    .where(and(inArray(schema.runs.id, runIds.slice(0, 200)), eq(schema.runs.status, 'failed')));
  for (const x of rows) await emit(x.org, x.site, [{ type: 'run.failed', data: { run: runSummary(x.r), error: x.r.error } }]).catch(() => undefined);
}

// ---------------------------------------------------------------------------------------------------------------------------
// the timer, the test, the log
// ---------------------------------------------------------------------------------------------------------------------------

/** Every minute: the deliveries whose next attempt is due; once an hour (cheap) the log older than 30 days goes. */
export async function webhookTick(log: Log, now = new Date()): Promise<number> {
  const due = await db
    .select({ id: schema.webhookDeliveries.id })
    .from(schema.webhookDeliveries)
    .where(and(or(eq(schema.webhookDeliveries.status, 'pending'), eq(schema.webhookDeliveries.status, 'failed')), lte(schema.webhookDeliveries.nextAttemptAt, now)))
    .orderBy(schema.webhookDeliveries.nextAttemptAt)
    .limit(50);
  for (const d of due) await attempt(d.id).catch((err) => log.error({ err: safeError(err), delivery: d.id }, 'webhook delivery failed'));
  if (now.getUTCMinutes() === 0) await db.delete(schema.webhookDeliveries).where(lt(schema.webhookDeliveries.createdAt, new Date(now.getTime() - WEBHOOKS.logDays * 86_400_000)));
  return due.length;
}

/** A test event to one endpoint, sent now and not queued, so nobody finds out on the day of a real alert that the address is wrong. */
export async function testEndpoint(org: OrgRow, id: unknown): Promise<SendResult> {
  const ep = await endpointOf(org.id, id);
  const type = (ep.events[0] as WebhookEvent) ?? 'report.ready';
  const e = envelope(org, null, type, {
    test: true,
    report: { id: '00000000-0000-0000-0000-000000000000', title: 'Test event — this is what an Ascentra event looks like', stage: 'site_tracker', stageLabel: 'Weekly site report', url: appUrl(`/o/${org.id}/settings/integrations`) },
    run: { title: 'Test analysis', url: appUrl(`/o/${org.id}/runs`) },
    alerts: [{ level: 'medium', text: 'Test alert: nothing is wrong.' }],
    findings: [{ title: 'Test finding', severity: 'Low', category: 'Test' }],
    gains: [{ keyword: 'test keyword', position: 4, previous: 11, delta: 7 }],
    drops: [],
    reason: 'Test: a held report says why here.',
    error: 'Test: a failed analysis says why here.',
  });
  const res = await sendTo(ep, randomUUID(), e);
  await db
    .update(schema.webhookEndpoints)
    .set(res.ok ? { lastSuccessAt: new Date() } : { lastFailureAt: new Date() })
    .where(eq(schema.webhookEndpoints.id, ep.id));
  return res;
}

export async function listWebhookDeliveries(orgId: string, limit = 50): Promise<WebhookDeliveryView[]> {
  const rows = await db
    .select({ d: schema.webhookDeliveries, name: schema.webhookEndpoints.name })
    .from(schema.webhookDeliveries)
    .innerJoin(schema.webhookEndpoints, eq(schema.webhookDeliveries.endpointId, schema.webhookEndpoints.id))
    .where(eq(schema.webhookDeliveries.orgId, orgId))
    .orderBy(desc(schema.webhookDeliveries.createdAt))
    .limit(Math.min(200, Math.max(1, limit)));
  return rows.map(({ d, name }) => ({
    id: d.id,
    endpointId: d.endpointId,
    endpointName: name,
    eventId: d.eventId,
    eventType: d.eventType,
    status: d.status as WebhookDeliveryView['status'],
    attempts: d.attempts,
    lastStatusCode: d.lastStatusCode,
    lastError: d.lastError,
    createdAt: d.createdAt.toISOString(),
    deliveredAt: d.deliveredAt ? d.deliveredAt.toISOString() : null,
    nextAttemptAt: d.nextAttemptAt ? d.nextAttemptAt.toISOString() : null,
  }));
}

/** "Send again": a given-up or failed delivery goes back in the queue now (same delivery id, so the receiver can de-duplicate). */
export async function redeliver(orgId: string, id: unknown): Promise<WebhookDeliveryView | null> {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw notFound('Delivery not found');
  const [row] = await db
    .update(schema.webhookDeliveries)
    .set({ status: 'pending', nextAttemptAt: new Date() })
    .where(and(eq(schema.webhookDeliveries.orgId, orgId), eq(schema.webhookDeliveries.id, id), inArray(schema.webhookDeliveries.status, ['failed', 'gave_up'])))
    .returning();
  if (!row) throw notFound('Delivery not found, or it was already sent');
  await attempt(row.id);
  return (await listWebhookDeliveries(orgId, 200)).find((d) => d.id === row.id) ?? null;
}
