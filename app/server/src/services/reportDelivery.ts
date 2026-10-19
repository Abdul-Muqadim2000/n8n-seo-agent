import { createHmac, timingSafeEqual } from 'node:crypto';
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import {
  DEFAULT_DELIVERY_SETTINGS,
  DELIVERY,
  deliveryDecision,
  deliveryDecisionFor,
  deliveryLines,
  deliverySettingsSchema,
  deliverySubject,
  deliveryWebhookBody,
  figureLines,
  nextDeliveryAt,
  shareUrl,
  stageLabel,
  type DeliveryCandidate,
  type DeliveryFrequency,
  type DeliveryItem,
  type DeliveryPayload,
  type DeliveryRecord,
  type DeliverySettings,
} from '@seo/shared';
import { config } from '../config';
import { db, schema } from '../db';
import type { OrgRow, ReportDeliveryRow, ReportRow } from '../db/schema';
import { badRequest } from '../lib/errors';
import { seal, secretsReady, unseal } from '../lib/secretBox';
import { sendReportMail } from '../lib/mailer';
import { baseUrlFor, senderFor } from './portalMail';
import { createShareForDelivery } from './shareLinks';

/**
 * B-R1, report delivery (benchmark programme 2026-10-15, area 12 §4 G-1, §5(a) a3 and §7).
 *
 * Until now a finished report waited in the app to be visited. All six benchmarked tools push it instead, and the area's own
 * conclusion is blunt: *"until a Monday report arrives somewhere the customer already is... every other improvement in this area is
 * work the customer has to log in to discover."* This service is the push: every finished report, or a daily / weekly / monthly
 * summary of them, by **e-mail** and by **webhook**, carrying the report's own figures and the expiring share link (G15) so it can
 * be forwarded to somebody with no account.
 *
 * What it will not do is the part worth reading twice. `deliveryDecision` (in `@seo/shared`, tested on its own) refuses any report
 * the run marked not ready, a failed quality gate, a refused plan, a verdict the engine could not check, evidence it could not
 * read. A held report keeps a row in the delivery log with its reason, so it is visible without being pushed. Refusing is the
 * behaviour the benchmark names as ours to keep, not a limitation to work around.
 *
 * The share link is G15's, unchanged: the same table, the same 256-bit token stored only as its hash, the same expiry and
 * revocation. Nothing here invents a second way to share a report.
 */

// ---------------------------------------------------------------------------------------------------------------------------
// settings
// ---------------------------------------------------------------------------------------------------------------------------

/** The stored settings of a company, with every missing field filled from the defaults. */
export function settingsOf(org: Pick<OrgRow, 'deliverySettings' | 'deliveryWebhookSecret'>): DeliverySettings {
  const raw = (org.deliverySettings ?? {}) as Record<string, unknown>;
  const parsed = deliverySettingsSchema.safeParse({ ...DEFAULT_DELIVERY_SETTINGS, ...raw });
  const v = parsed.success ? parsed.data : DEFAULT_DELIVERY_SETTINGS;
  return {
    frequency: v.frequency,
    weekday: v.weekday,
    hour: v.hour,
    dayOfMonth: v.dayOfMonth,
    email: { enabled: v.email.enabled, recipients: v.email.recipients, attachFiles: v.email.attachFiles },
    webhook: { enabled: v.webhook.enabled, url: v.webhook.url, hasSecret: !!org.deliveryWebhookSecret },
    stages: v.stages,
    shareLinks: v.shareLinks,
  };
}

/**
 * Saves the settings. The webhook secret is sealed with the same key as mailbox passwords and is never returned: the API answers
 * `hasSecret` only. Sending `secret: ''` clears it, leaving the field out keeps what is stored.
 */
export async function saveSettings(org: OrgRow, body: unknown): Promise<DeliverySettings> {
  const parsed = deliverySettingsSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[issue.path.join('.') || 'frequency'] = issue.message;
    throw badRequest('Check the delivery settings', fields);
  }
  const v = parsed.data;
  if (v.email.enabled && !v.email.recipients.length && !config.mail.enabled)
    throw badRequest('This server has no mail account set up, so reports cannot be e-mailed yet. Use a webhook, or ask the platform administrator to connect SMTP.', {
      'email.enabled': 'No mail server',
    });
  const { secret, ...webhook } = v.webhook;
  const patch: Record<string, unknown> = {
    deliverySettings: { ...v, webhook: { enabled: webhook.enabled, url: webhook.url } },
  };
  if (secret !== undefined) patch.deliveryWebhookSecret = secret ? sealSecret(secret) : '';
  const [row] = await db.update(schema.organizations).set(patch).where(eq(schema.organizations.id, org.id)).returning();
  return settingsOf(row);
}

// The webhook's signing secret is kept the way mailbox passwords are (AES-256-GCM under `MAILBOX_KEY`). On a server with no key
// the secret is simply refused rather than stored in the clear; an unsigned https POST is still an https POST, and a signature
// nobody could trust would be worse than none.
const sealSecret = (s: string): string => {
  if (!secretsReady()) throw badRequest('This server cannot store a signing secret (MAILBOX_KEY is not set). Leave it empty, or ask the platform administrator.', { 'webhook.secret': 'Not available' });
  return seal(s);
};
const openSecret = (s: string): string => {
  if (!s) return '';
  try {
    return unseal(s);
  } catch {
    return '';
  }
};

/** The signature a receiver checks: HMAC-SHA256 over `<timestamp>.<body>`, the shape Stripe and GitHub use. */
export const signBody = (secret: string, timestamp: string, body: string): string =>
  'sha256=' + createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');

/** Exported for the tests: a receiver's side of the same check. */
export function verifyBody(secret: string, timestamp: string, body: string, signature: string): boolean {
  const want = Buffer.from(signBody(secret, timestamp, body));
  const got = Buffer.from(String(signature || ''));
  return want.length === got.length && timingSafeEqual(want, got);
}

// ---------------------------------------------------------------------------------------------------------------------------
// building one delivery
// ---------------------------------------------------------------------------------------------------------------------------

const appReportUrl = (base: string, orgId: string, reportId: string) => `${base}/o/${orgId}/reports/${reportId}`;

type ReportWithFiles = ReportRow & { domain: string | null };

async function itemFor(org: OrgRow, r: ReportWithFiles, wantShare: boolean): Promise<DeliveryItem> {
  const files = await db
    .select({ id: schema.files.id, kind: schema.files.kind, fileName: schema.files.fileName, size: schema.files.size })
    .from(schema.files)
    .where(eq(schema.files.reportId, r.id))
    .orderBy(asc(schema.files.createdAt))
    .limit(20);
  let share: string | null = null;
  // G5: a white-label client workspace's links open on its agency's portal host
  const base = await baseUrlFor(org);
  if (wantShare) {
    // G15's own link, created by G15's own service: one report, hashed token, expiring, revocable from the report page
    const made = await createShareForDelivery(org.id, r.id, DELIVERY.shareDays).catch(() => null);
    if (made) share = shareUrl(base, made.token);
  }
  return {
    reportId: r.id,
    stage: r.stage,
    stageLabel: stageLabel(r.stage),
    title: r.title,
    siteDomain: r.domain,
    receivedAt: r.receivedAt.toISOString(),
    scheduled: r.scheduled,
    figures: r.summary ?? {},
    url: appReportUrl(base, org.id, r.id),
    shareUrl: share,
    files: files.map((f) => ({ id: f.id, kind: f.kind, fileName: f.fileName, size: f.size })),
  };
}

const candidateOf = (r: ReportRow): DeliveryCandidate => ({ stage: r.stage, status: r.status, payload: (r.payload ?? {}) as Record<string, unknown> });

/** Who an e-mail goes to: the addresses the company chose, or every member who can see reports when it chose none. */
async function recipients(org: OrgRow, s: DeliverySettings): Promise<string[]> {
  if (s.email.recipients.length) return s.email.recipients;
  const rows = await db
    .select({ email: schema.users.email })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.memberships.userId, schema.users.id))
    .where(and(eq(schema.memberships.orgId, org.id), isNull(schema.memberships.deactivatedAt)))
    .limit(DELIVERY.maxRecipients);
  return rows.map((r) => r.email).filter(Boolean);
}

// ---------------------------------------------------------------------------------------------------------------------------
// sending
// ---------------------------------------------------------------------------------------------------------------------------

export interface SendOutcome {
  channel: 'email' | 'webhook';
  ok: boolean;
  target: string;
  error: string;
}

async function sendWebhook(org: OrgRow, s: DeliverySettings, payload: DeliveryPayload): Promise<SendOutcome> {
  const host = (s.webhook.url.match(/^https?:\/\/([^/]+)/i) ?? ['', s.webhook.url])[1]!;
  const body = JSON.stringify(deliveryWebhookBody(payload));
  const timestamp = String(Date.now());
  const secret = openSecret(org.deliveryWebhookSecret);
  const headers: Record<string, string> = { 'content-type': 'application/json', [DELIVERY.timestampHeader]: timestamp };
  if (secret) headers[DELIVERY.signatureHeader] = signBody(secret, timestamp, body);
  try {
    const res = await fetch(s.webhook.url, { method: 'POST', headers, body, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return { channel: 'webhook', ok: false, target: host, error: `The webhook answered ${res.status}` };
    return { channel: 'webhook', ok: true, target: host, error: '' };
  } catch (err) {
    return { channel: 'webhook', ok: false, target: host, error: String((err as Error).message || err).slice(0, 200) };
  }
}

async function sendEmail(org: OrgRow, s: DeliverySettings, payload: DeliveryPayload, log: Log): Promise<SendOutcome> {
  const to = await recipients(org, s);
  if (!to.length) return { channel: 'email', ok: false, target: '', error: 'Nobody to send to: no recipient and no member with an address' };
  if (!config.mail.enabled) return { channel: 'email', ok: false, target: to.join(', '), error: 'This server has no mail account set up (SMTP)' };
  const attachments = s.email.attachFiles ? await filesFor(payload) : [];
  const ok = await sendReportMail(
    {
      to: to.join(', '),
      subject: deliverySubject(payload),
      lines: deliveryLines(payload),
      action: payload.reports.length === 1 ? { label: 'Open the report', url: payload.reports[0]!.shareUrl ?? payload.reports[0]!.url } : undefined,
      footer: 'You receive this because your company turned report delivery on. An owner can change it in Settings > Report delivery.',
      reports: payload.reports,
      attachments,
      // G5: an agency's client hears from the agency (name, reply-to, its own verified mailbox)
      sender: await senderFor(org),
    },
    log,
  );
  return { channel: 'email', ok, target: to.join(', '), error: ok ? '' : 'The mail server did not accept the message' };
}

/** The report's own files, so a PDF arrives in the inbox rather than behind a login. Capped so one message cannot be refused for size. */
const MAX_ATTACH_BYTES = 12 * 1024 * 1024;
async function filesFor(payload: DeliveryPayload): Promise<{ filename: string; content: Buffer }[]> {
  const ids = payload.reports.flatMap((r) => r.files.filter((f) => f.kind === 'pdf' || f.kind === 'zip' || f.kind === 'docx' || f.kind === 'doc').map((f) => f.id));
  if (!ids.length) return [];
  const rows = await db
    .select({ fileName: schema.files.fileName, data: schema.files.data, size: schema.files.size })
    .from(schema.files)
    .where(inArray(schema.files.id, ids.slice(0, 10)));
  const out: { filename: string; content: Buffer }[] = [];
  let total = 0;
  for (const f of rows) {
    if (total + f.size > MAX_ATTACH_BYTES) break;
    total += f.size;
    out.push({ filename: f.fileName, content: f.data });
  }
  return out;
}

export interface Log {
  info: (o: object, msg: string) => void;
  warn?: (o: object, msg: string) => void;
  error: (o: object, msg: string) => void;
}

/** Writes (or updates) the log row for one channel of one delivery. */
async function record(o: {
  orgId: string;
  reportId: string | null;
  channel: 'email' | 'webhook';
  status: 'sent' | 'failed' | 'held';
  kind: DeliveryFrequency;
  target?: string;
  reason?: string;
  title?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const values = {
    orgId: o.orgId,
    reportId: o.reportId,
    channel: o.channel,
    target: (o.target ?? '').slice(0, 500),
    status: o.status,
    kind: o.kind,
    reason: (o.reason ?? '').slice(0, 500),
    title: (o.title ?? '').slice(0, 300),
    attempts: o.status === 'held' ? 0 : 1,
    meta: o.meta ?? {},
    sentAt: o.status === 'sent' ? new Date() : null,
    nextAttemptAt: o.status === 'failed' ? new Date(Date.now() + DELIVERY.retryMinutes * 60_000) : null,
  };
  if (!o.reportId) {
    await db.insert(schema.reportDeliveries).values(values);
    return;
  }
  await db
    .insert(schema.reportDeliveries)
    .values(values)
    .onConflictDoUpdate({
      target: [schema.reportDeliveries.reportId, schema.reportDeliveries.channel],
      set: {
        status: values.status,
        target: values.target,
        reason: values.reason,
        title: values.title,
        kind: values.kind,
        meta: values.meta,
        sentAt: values.sentAt,
        nextAttemptAt: values.nextAttemptAt,
        attempts: sql`${schema.reportDeliveries.attempts} + ${values.attempts}`,
      },
    });
}

// ---------------------------------------------------------------------------------------------------------------------------
// the two entry points: one report as it arrives, and the scheduled summary
// ---------------------------------------------------------------------------------------------------------------------------

export interface DeliveryResult {
  delivered: boolean;
  reason: string;
  outcomes: SendOutcome[];
}

/**
 * One report, as soon as its callback is stored. Called from `ingestCallback` and never allowed to fail it: a delivery that goes
 * wrong is logged, it does not lose the report.
 */
export async function deliverReport(orgId: string, reportId: string, log: Log, opts: { force?: boolean; kind?: DeliveryFrequency } = {}): Promise<DeliveryResult> {
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, orgId) });
  if (!org) return { delivered: false, reason: 'Unknown company', outcomes: [] };
  const s = settingsOf(org);
  const kind = opts.kind ?? 'each';
  const rows = await db
    .select({ r: schema.reports, domain: schema.sites.domain })
    .from(schema.reports)
    .leftJoin(schema.sites, eq(schema.reports.siteId, schema.sites.id))
    .where(and(eq(schema.reports.orgId, orgId), eq(schema.reports.id, reportId)))
    .limit(1);
  const row = rows[0];
  if (!row) return { delivered: false, reason: 'Unknown report', outcomes: [] };
  const report = { ...row.r, domain: row.domain ?? null };

  // the readiness rule applies even to a delivery somebody asked for by hand: `force` skips the settings, never the refusal
  const decision = opts.force ? deliveryDecision(candidateOf(report)) : deliveryDecisionFor(candidateOf(report), s);
  if (!decision.deliver) {
    // a report held because delivery is off at all is not worth a row in the log, there is nothing to tell anyone about
    if (decision.code !== 'delivery_off' && decision.code !== 'no_channel' && decision.code !== 'stage_not_chosen')
      await record({ orgId, reportId, channel: s.webhook.enabled ? 'webhook' : 'email', status: 'held', kind, reason: decision.reason, title: report.title });
    return { delivered: false, reason: decision.reason, outcomes: [] };
  }
  if (!opts.force && !s.email.enabled && !s.webhook.enabled) return { delivered: false, reason: 'No channel is switched on', outcomes: [] };

  const payload: DeliveryPayload = {
    company: org.name,
    kind,
    generatedAt: new Date().toISOString(),
    reports: [await itemFor(org, report, s.shareLinks)],
    held: [],
  };
  return send(org, s, payload, log, reportId);
}

async function send(org: OrgRow, s: DeliverySettings, payload: DeliveryPayload, log: Log, reportId: string | null): Promise<DeliveryResult> {
  const outcomes: SendOutcome[] = [];
  if (s.webhook.enabled && s.webhook.url) outcomes.push(await sendWebhook(org, s, payload));
  if (s.email.enabled) outcomes.push(await sendEmail(org, s, payload, log));
  for (const o of outcomes)
    await record({
      orgId: org.id,
      reportId,
      channel: o.channel,
      status: o.ok ? 'sent' : 'failed',
      kind: payload.kind,
      target: o.target,
      reason: o.error,
      title: payload.reports.length === 1 ? payload.reports[0]!.title : `${payload.reports.length} reports`,
      meta: { reportIds: payload.reports.map((r) => r.reportId), held: payload.held.length },
    });
  const delivered = outcomes.some((o) => o.ok);
  log.info({ org: org.id, reports: payload.reports.length, delivered, channels: outcomes.map((o) => `${o.channel}:${o.ok ? 'ok' : 'failed'}`) }, 'report delivery');
  return { delivered, reason: delivered ? '' : outcomes.map((o) => o.error).filter(Boolean).join('; ') || 'Nothing was sent', outcomes };
}

/**
 * The scheduled summary. Runs on a timer; for every company whose next due time has passed it collects the reports that arrived
 * since the last summary, decides on each, and sends one message with the ones that may go and the reasons for the ones that may
 * not.
 */
export async function deliveryTick(log: Log, now = new Date()): Promise<number> {
  const orgs = await db.query.organizations.findMany({ where: eq(schema.organizations.disabled, false), limit: 500 });
  let sent = 0;
  for (const org of orgs) {
    const s = settingsOf(org);
    if (s.frequency === 'off' || s.frequency === 'each' || (!s.email.enabled && !s.webhook.enabled)) continue;
    // due when the next moment after the last summary has passed; a company that never had one starts from its last 7 days
    const since = org.deliveryLastRunAt ?? new Date(now.getTime() - 7 * 86_400_000);
    const due = nextDeliveryAt(s, since);
    if (!due || due.getTime() > now.getTime()) continue;
    try {
      if (await sendDigest(org, s, since, now, log)) sent++;
    } catch (err) {
      log.error({ err: String(err), org: org.id }, 'scheduled report delivery failed');
    }
    await db.update(schema.organizations).set({ deliveryLastRunAt: now }).where(eq(schema.organizations.id, org.id));
  }
  return sent;
}

async function sendDigest(org: OrgRow, s: DeliverySettings, since: Date, now: Date, log: Log): Promise<boolean> {
  const rows = await db
    .select({ r: schema.reports, domain: schema.sites.domain })
    .from(schema.reports)
    .leftJoin(schema.sites, eq(schema.reports.siteId, schema.sites.id))
    .where(and(eq(schema.reports.orgId, org.id), gte(schema.reports.receivedAt, since), lte(schema.reports.receivedAt, now)))
    .orderBy(desc(schema.reports.receivedAt))
    .limit(DELIVERY.maxReportsPerDigest * 2);

  const ready: DeliveryItem[] = [];
  const held: DeliveryPayload['held'] = [];
  for (const row of rows) {
    const report = { ...row.r, domain: row.domain ?? null };
    const decision = deliveryDecisionFor(candidateOf(report), s);
    if (decision.code === 'stage_not_chosen' || decision.code === 'interim') continue;   // not asked for, or not a report
    if (!decision.deliver) {
      held.push({ reportId: report.id, title: report.title, reason: decision.reason, code: decision.code });
      await record({ orgId: org.id, reportId: report.id, channel: s.webhook.enabled ? 'webhook' : 'email', status: 'held', kind: s.frequency, reason: decision.reason, title: report.title });
      continue;
    }
    if (ready.length < DELIVERY.maxReportsPerDigest) ready.push(await itemFor(org, report, s.shareLinks));
  }
  if (!ready.length && !held.length) return false;
  if (!ready.length) {
    // nothing may be sent: say nothing rather than mailing a list of refusals. The reasons are in the app and in the log above.
    log.info({ org: org.id, held: held.length }, 'scheduled delivery: every report was held');
    return false;
  }
  const payload: DeliveryPayload = { company: org.name, kind: s.frequency, generatedAt: now.toISOString(), reports: ready, held };
  const res = await send(org, s, payload, log, null);
  return res.delivered;
}

/** A failed attempt, tried again. Called from the same timer; gives up after `DELIVERY.maxAttempts`. */
export async function retryTick(log: Log, now = new Date()): Promise<number> {
  const rows = await db
    .select()
    .from(schema.reportDeliveries)
    .where(and(eq(schema.reportDeliveries.status, 'failed'), lte(schema.reportDeliveries.nextAttemptAt, now), lte(schema.reportDeliveries.attempts, DELIVERY.maxAttempts - 1)))
    .orderBy(asc(schema.reportDeliveries.nextAttemptAt))
    .limit(20);
  let done = 0;
  for (const row of rows) {
    if (!row.reportId) {
      // a summary is not replayed: by the time it could be, its window has moved on. Mark it given up so it stops being picked up.
      await db.update(schema.reportDeliveries).set({ nextAttemptAt: null }).where(eq(schema.reportDeliveries.id, row.id));
      continue;
    }
    const res = await deliverReport(row.orgId, row.reportId, log).catch(() => null);
    if (res?.delivered) done++;
  }
  return done;
}

// ---------------------------------------------------------------------------------------------------------------------------
// what the app shows
// ---------------------------------------------------------------------------------------------------------------------------

const toRecord = (r: ReportDeliveryRow): DeliveryRecord => ({
  id: r.id,
  reportId: r.reportId,
  reportTitle: r.title,
  channel: r.channel as DeliveryRecord['channel'],
  target: r.target,
  status: r.status as DeliveryRecord['status'],
  kind: r.kind as DeliveryFrequency,
  reason: r.reason,
  attempts: r.attempts,
  createdAt: r.createdAt.toISOString(),
  sentAt: r.sentAt ? r.sentAt.toISOString() : null,
});

export async function listDeliveries(orgId: string, limit = 50): Promise<DeliveryRecord[]> {
  const rows = await db
    .select()
    .from(schema.reportDeliveries)
    .where(eq(schema.reportDeliveries.orgId, orgId))
    .orderBy(desc(schema.reportDeliveries.createdAt))
    .limit(Math.min(200, Math.max(1, limit)));
  return rows.map(toRecord);
}

/** A test message, so nobody finds out their webhook is wrong on the Monday a report was due. */
export async function sendTest(org: OrgRow, log: Log): Promise<SendOutcome[]> {
  const s = settingsOf(org);
  if (!s.email.enabled && !s.webhook.enabled) throw badRequest('Switch on an e-mail address or a webhook first', { frequency: 'No channel' });
  const payload: DeliveryPayload = {
    company: org.name,
    kind: 'each',
    generatedAt: new Date().toISOString(),
    reports: [
      {
        reportId: '00000000-0000-0000-0000-000000000000',
        stage: 'site_tracker',
        stageLabel: stageLabel('site_tracker'),
        title: 'Test delivery: this is what a report looks like',
        siteDomain: null,
        receivedAt: new Date().toISOString(),
        scheduled: true,
        figures: { clicks: 128, impressions: 5420, actions: 3 },
        url: `${config.appUrl}/o/${org.id}/reports`,
        shareUrl: null,
        files: [],
      },
    ],
    held: [],
  };
  const outcomes: SendOutcome[] = [];
  if (s.webhook.enabled && s.webhook.url) outcomes.push(await sendWebhook(org, s, payload));
  if (s.email.enabled) outcomes.push(await sendEmail(org, s, payload, log));
  return outcomes;
}

/** Everything the settings page needs in one answer. */
export async function deliveryOverview(org: OrgRow): Promise<{
  settings: DeliverySettings;
  nextAt: string | null;
  mailReady: boolean;
  signingReady: boolean;
  recent: DeliveryRecord[];
}> {
  const settings = settingsOf(org);
  const next = nextDeliveryAt(settings, new Date());
  return {
    settings,
    nextAt: next ? next.toISOString() : null,
    mailReady: config.mail.enabled,
    signingReady: !!org.deliveryWebhookSecret,
    recent: await listDeliveries(org.id, 25),
  };
}

export { figureLines };
