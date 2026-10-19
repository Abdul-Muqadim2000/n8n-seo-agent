import { z } from 'zod';
import { STAGE_LABELS } from './constants';
import { deliveryDecision, webhookUrlOk } from './report-delivery';

/**
 * G4 (2026-10-17) — integrations: event webhooks (signed JSON, Slack, Microsoft Teams), issue trackers (Jira Cloud, Linear, Asana)
 * and the warehouse / BI export (S3-compatible storage, BigQuery). Design note: app/docs/INTEGRATIONS.md.
 *
 * This file is what the server and the web app share: the event types and how they are derived from a stored callback, the message
 * formats, the connector schemas (with the vendor-host rules), the ticket text, and the export tables' one schema. Everything here is
 * pure, so it is unit-tested once (integrations.test.ts); the server only reads, seals, sends and records.
 */

type P = Record<string, unknown>;
const obj = (v: unknown): P => (v && typeof v === 'object' && !Array.isArray(v) ? (v as P) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const num = (v: unknown): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

// ---------------------------------------------------------------------------------------------------------------------------
// 1. Events
// ---------------------------------------------------------------------------------------------------------------------------

export const WEBHOOK_EVENTS = ['run.completed', 'run.failed', 'report.ready', 'report.held', 'alert.raised', 'audit.finding.new', 'rank.changed'] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_EVENT_LABELS: Record<WebhookEvent, { label: string; description: string }> = {
  'run.completed': { label: 'Analysis finished', description: 'An analysis delivered its final report.' },
  'run.failed': { label: 'Analysis failed', description: 'The engine refused or failed an analysis, or no result arrived in time.' },
  'report.ready': { label: 'Report ready', description: 'A finished report arrived (a weekly report, an audit, a written page that passed its quality check…).' },
  'report.held': { label: 'Report held back', description: 'A report the analysis itself marked not ready — a draft that failed its quality check, a refused plan — with the reason.' },
  'alert.raised': { label: 'Alert', description: 'A Search Console alert, a real change in AI answers, a key page that changed, or an alert line in a weekly report.' },
  'audit.finding.new': { label: 'New audit findings', description: 'An audit found issues the previous audit of the same type did not have.' },
  'rank.changed': { label: 'Ranking moved', description: 'A tracked keyword moved five places or more.' },
};

export const WEBHOOK_FORMATS = ['json', 'slack', 'teams'] as const;
export type WebhookFormat = (typeof WEBHOOK_FORMATS)[number];
export const WEBHOOK_FORMAT_LABELS: Record<WebhookFormat, string> = { json: 'Signed JSON (your own system, Zapier, Make, n8n)', slack: 'Slack channel', teams: 'Microsoft Teams channel' };

export const WEBHOOKS = {
  maxEndpoints: 10,
  /** minutes to wait before attempt 2, 3, 4, 5 and 6; then the delivery is given up */
  backoffMinutes: [1, 5, 30, 120, 720] as const,
  timeoutMs: 10_000,
  /** an endpoint whose last N deliveries all failed is switched off, with the reason */
  disableAfterFailures: 25,
  logDays: 30,
  eventHeader: 'X-Alaventra-Event',
  deliveryHeader: 'X-Alaventra-Delivery',
  /** receivers should refuse a timestamp older than this */
  toleranceSeconds: 300,
} as const;

/** When the next attempt is due after `attempts` failed ones, or null when the delivery is given up. */
export function nextAttemptAt(attempts: number, now = new Date()): Date | null {
  const m = WEBHOOKS.backoffMinutes[attempts - 1];
  return m == null ? null : new Date(now.getTime() + m * 60_000);
}

/** A Slack incoming webhook (https://api.slack.com/messaging/webhooks) */
const SLACK_RE = /^https:\/\/hooks\.slack\.com\/(services|workflows|triggers)\/[A-Za-z0-9/_-]+$/;
/** Teams: a Workflows "Post to a channel when a webhook request is received" URL, or a legacy Office 365 connector URL */
const TEAMS_RE = /^https:\/\/([a-z0-9-]+\.)+(logic\.azure\.com|powerplatform\.com|webhook\.office\.com)(:\d+)?\/\S+$/i;

export function webhookUrlFor(format: WebhookFormat, url: string): string | null {
  if (!webhookUrlOk(url)) return 'Enter an https:// address on a public host';
  if (format === 'slack' && !SLACK_RE.test(url)) return 'A Slack incoming-webhook address starts with https://hooks.slack.com/services/';
  if (format === 'teams' && !TEAMS_RE.test(url)) return 'A Teams Workflows address ends in logic.azure.com or powerplatform.com (or webhook.office.com for an older connector)';
  return null;
}

export const webhookEndpointSchema = z
  .object({
    name: z.string().trim().min(1, 'Give it a name, e.g. "#seo-alerts" or "Data warehouse"').max(60),
    format: z.enum(WEBHOOK_FORMATS).default('json'),
    url: z.string().trim().max(2000),
    events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, 'Choose at least one event').max(WEBHOOK_EVENTS.length).transform((l) => [...new Set(l)]),
    /** empty = every website of the company */
    websiteIds: z.array(z.string().uuid()).max(50).default([]),
    enabled: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    const why = webhookUrlFor(v.format, v.url);
    if (why) ctx.addIssue({ code: 'custom', path: ['url'], message: why });
  });
export type WebhookEndpointInput = z.input<typeof webhookEndpointSchema>;
export const webhookEndpointPatchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, 'Choose at least one event').max(WEBHOOK_EVENTS.length).optional(),
  websiteIds: z.array(z.string().uuid()).max(50).optional(),
  enabled: z.boolean().optional(),
});

export interface WebhookEndpointView {
  id: string;
  name: string;
  format: WebhookFormat;
  /** the host and the last four characters of the address — never the address (a Slack URL is a credential) */
  urlHost: string;
  urlHint: string;
  hasSecret: boolean;
  events: WebhookEvent[];
  websiteIds: string[];
  enabled: boolean;
  disabledReason: string;
  consecutiveFailures: number;
  createdAt: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
}

export interface WebhookDeliveryView {
  id: string;
  endpointId: string;
  endpointName: string;
  eventId: string;
  eventType: string;
  status: 'pending' | 'sent' | 'failed' | 'gave_up';
  attempts: number;
  lastStatusCode: number | null;
  lastError: string;
  createdAt: string;
  deliveredAt: string | null;
  nextAttemptAt: string | null;
}

export interface EventEnvelope {
  id: string;
  type: WebhookEvent;
  createdAt: string;
  company: { id: string; name: string };
  website: { id: string; domain: string } | null;
  data: P;
}

/** What one stored callback means as events (pure; the server adds the envelope). */
export interface CallbackFacts {
  stage: string;
  status: string;
  payload: P;
  report: { id: string; title: string; stage: string; status: string; receivedAt: string; scheduled: boolean; runId: string | null; websiteId: string | null; url: string };
  runBefore: { status: string } | null;
  /** credits (app/docs/CREDITS.md): the run's credits ride along (`credits`), never its provider cost */
  runAfter: { id: string; mode: string; title: string; status: string; error: string | null; completedAt: string | null; url: string; credits?: { quoted: number | null; charged: number | null; state: string } | null } | null;
}

const ALERT_SKIP_LEVELS = new Set(['info', 'ok', 'good', 'success']);
const alertOf = (a: unknown, fallbackLevel = 'medium'): { level: string; text: string } | null => {
  if (typeof a === 'string') return a.trim() ? { level: fallbackLevel, text: a.trim().slice(0, 500) } : null;
  const o = obj(a);
  const t = text(o.text) || text(o.message) || text(o.subject);
  return t ? { level: (text(o.level) || text(o.severity) || fallbackLevel).toLowerCase(), text: t.slice(0, 500) } : null;
};

export function eventsFor(f: CallbackFacts): { type: WebhookEvent; data: P }[] {
  const out: { type: WebhookEvent; data: P }[] = [];
  const p = f.payload ?? {};
  const report = { id: f.report.id, title: f.report.title, stage: f.report.stage, stageLabel: STAGE_LABELS[f.report.stage] ?? f.report.stage, receivedAt: f.report.receivedAt, scheduled: f.report.scheduled, runId: f.report.runId, url: f.report.url };

  // ---- the run ----
  if (f.runAfter && f.runBefore) {
    if (f.runAfter.status === 'completed' && f.runBefore.status !== 'completed') out.push({ type: 'run.completed', data: { run: f.runAfter } });
    if (f.runAfter.status === 'failed' && f.runBefore.status !== 'failed') out.push({ type: 'run.failed', data: { run: f.runAfter, error: f.runAfter.error } });
  }

  // ---- the report: the delivery rule decides finished vs held, exactly as for e-mail delivery and share links ----
  const d = deliveryDecision({ stage: f.stage, status: f.status, payload: p });
  if (d.deliver) out.push({ type: 'report.ready', data: { report } });
  else if (d.code === 'not_ready' || d.code === 'refused' || d.code === 'unavailable') out.push({ type: 'report.held', data: { report, reason: d.reason, code: d.code } });

  // ---- alerts ----
  if (f.stage === 'console_alert') {
    const a = alertOf({ level: text(p.severity) || 'high', text: text(p.subject) || text(p.summary) || 'Search Console sent an alert' });
    if (a) out.push({ type: 'alert.raised', data: { source: text(p.source) === 'page_watch' ? 'page_watch' : 'search_console', alerts: [a], report } });
  } else {
    const alerts = arr(p.alerts)
      .map((a) => alertOf(a))
      .filter((a): a is { level: string; text: string } => !!a && !ALERT_SKIP_LEVELS.has(a.level))
      .slice(0, 20);
    if (alerts.length && d.code !== 'interim') out.push({ type: 'alert.raised', data: { source: f.stage, alerts, report } });
  }

  // ---- new audit findings (only against the previous audit of the same type: the engine's diff already says so) ----
  if (f.stage === 'site_audit' || f.stage === 'full_report') {
    const diff = obj(p.audit_diff ?? obj(p.site_audit).audit_diff);
    const added = arr(diff.new).map(obj).filter((x) => text(x.title));
    if (diff.baseline !== true && added.length)
      out.push({
        type: 'audit.finding.new',
        data: {
          audit: { id: text(p.audit_id) || text(obj(p.site_audit).audit_id) || null, reportType: f.stage, healthScore: num(p.health_score), comparedWith: text(obj(diff.previous).audit_id) || null },
          findings: added.slice(0, 50).map((x) => ({ title: text(x.title), category: text(x.category), severity: text(x.severity), oneReading: x.one_reading === true })),
          report,
        },
      });
  }

  // ---- rank moves of five places or more (the tracker's own threshold) ----
  if (f.stage === 'rank_tracker') {
    const moves = arr(p.positions)
      .map(obj)
      .filter((x) => num(x.delta) != null && Math.abs(num(x.delta)!) >= 5 && text(x.keyword))
      .map((x) => ({ keyword: text(x.keyword), position: num(x.position) ?? num(x.current), previous: num(x.previous), delta: num(x.delta)!, url: text(x.url) || null }));
    const gains = moves.filter((m) => m.delta > 0);
    const drops = moves.filter((m) => m.delta < 0);
    if (moves.length) out.push({ type: 'rank.changed', data: { ladder: { id: text(p.ladder_id) || null, head: text(p.head_keyword) || null }, gains, drops, report } });
  }
  return out;
}

// ---- message formats ----

const EMOJI_FREE_LEVEL: Record<string, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };

/** The one-line headline and the detail lines of an event, shared by the Slack and Teams formats. */
export function eventLines(e: EventEnvelope): { headline: string; lines: string[]; link: { label: string; url: string } | null } {
  const d = e.data;
  const site = e.website ? ` · ${e.website.domain}` : '';
  const report = obj(d.report);
  const link = text(report.url) ? { label: 'Open in Alaventra', url: text(report.url) } : text(obj(d.run).url) ? { label: 'Open the run', url: text(obj(d.run).url) } : null;
  switch (e.type) {
    case 'run.completed':
      return { headline: `Finished: ${text(obj(d.run).title)}${site}`, lines: [], link };
    case 'run.failed':
      return { headline: `Failed: ${text(obj(d.run).title)}${site}`, lines: [text(d.error) || 'No reason was given.'], link };
    case 'report.ready':
      return { headline: `${text(report.stageLabel) || 'Report'} ready: ${text(report.title)}${site}`, lines: [], link };
    case 'report.held':
      return { headline: `Held back: ${text(report.title)}${site}`, lines: [text(d.reason)], link };
    case 'alert.raised':
      return {
        headline: `Alert${site}`,
        lines: arr(d.alerts)
          .map(obj)
          .map((a) => `${EMOJI_FREE_LEVEL[text(a.level)] ?? (text(a.level) || 'Alert')}: ${text(a.text)}`)
          .slice(0, 10),
        link,
      };
    case 'audit.finding.new': {
      const list = arr(d.findings).map(obj);
      return { headline: `${list.length} new audit finding${list.length === 1 ? '' : 's'}${site}`, lines: list.slice(0, 10).map((x) => `${text(x.severity) || '—'} · ${text(x.title)}`), link };
    }
    case 'rank.changed': {
      const mv = (m: P) => `${text(m.keyword)}: ${num(m.previous) ?? '—'} → ${num(m.position) || 'not in the top 50'} (${num(m.delta)! > 0 ? '+' : ''}${num(m.delta)})`;
      return {
        headline: `Rankings moved${site}${text(obj(d.ladder).head) ? ` — ${text(obj(d.ladder).head)}` : ''}`,
        lines: [...arr(d.gains).map(obj).map((m) => `Up ${mv(m)}`), ...arr(d.drops).map(obj).map((m) => `Down ${mv(m)}`)].slice(0, 12),
        link,
      };
    }
  }
}

/** Slack's mrkdwn treats &, < and > as control characters (https://api.slack.com/reference/surfaces/formatting#escaping) */
const slackEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Slack incoming-webhook body: `text` (notifications) + Block Kit section / context / actions blocks. */
export function slackMessage(e: EventEnvelope): P {
  const { headline, lines, link } = eventLines(e);
  const blocks: P[] = [{ type: 'section', text: { type: 'mrkdwn', text: `*${slackEscape(headline)}*${lines.length ? '\n' + lines.map((l) => '• ' + slackEscape(l)).join('\n') : ''}`.slice(0, 2900) } }];
  if (link) blocks.push({ type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: link.label }, url: link.url }] });
  blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: slackEscape(`${e.company.name} · ${WEBHOOK_EVENT_LABELS[e.type].label} · ${e.createdAt.slice(0, 16).replace('T', ' ')} UTC`) }] });
  return { text: headline.slice(0, 300), blocks };
}

/** Teams Workflows webhook body: a message with one Adaptive Card (https://learn.microsoft.com/en-us/connectors/teams/ — "Post card in a chat or channel"). */
export function teamsMessage(e: EventEnvelope): P {
  const { headline, lines, link } = eventLines(e);
  const body: P[] = [
    { type: 'TextBlock', text: headline.slice(0, 300), weight: 'Bolder', size: 'Medium', wrap: true },
    ...lines.map((l) => ({ type: 'TextBlock', text: l.slice(0, 500), wrap: true, spacing: 'Small' })),
    { type: 'TextBlock', text: `${e.company.name} · ${WEBHOOK_EVENT_LABELS[e.type].label}`, isSubtle: true, size: 'Small', wrap: true },
  ];
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: { $schema: 'http://adaptivecards.io/schemas/adaptive-card.json', type: 'AdaptiveCard', version: '1.4', body, ...(link ? { actions: [{ type: 'Action.OpenUrl', title: link.label, url: link.url }] } : {}) },
      },
    ],
  };
}

export function eventBody(format: WebhookFormat, e: EventEnvelope): P {
  return format === 'slack' ? slackMessage(e) : format === 'teams' ? teamsMessage(e) : (e as unknown as P);
}

// ---------------------------------------------------------------------------------------------------------------------------
// 2. Issue trackers
// ---------------------------------------------------------------------------------------------------------------------------

export const TRACKER_KINDS = ['jira', 'linear', 'asana'] as const;
export type TrackerKind = (typeof TRACKER_KINDS)[number];
export const EXPORT_KINDS = ['s3', 'bigquery'] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];
export type IntegrationKind = TrackerKind | ExportKind;
export const INTEGRATION_LABELS: Record<IntegrationKind, string> = { jira: 'Jira Cloud', linear: 'Linear', asana: 'Asana', s3: 'S3-compatible storage', bigquery: 'BigQuery' };

/** Jira Cloud sites only (`https://<name>.atlassian.net`); Data Center is not reachable from here and would need its own guard. */
const JIRA_SITE_RE = /^https:\/\/[a-z0-9][a-z0-9-]{0,62}\.atlassian\.net\/?$/i;
const secretField = (label: string, max = 4000) => z.string().trim().min(8, `Paste the ${label}`).max(max);

export const jiraConnectSchema = z.object({
  kind: z.literal('jira'),
  siteUrl: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => JIRA_SITE_RE.test(v), 'Your Jira Cloud address, like https://your-company.atlassian.net')
    .transform((v) => v.replace(/\/+$/, '')),
  email: z.string().trim().toLowerCase().email('The e-mail address of the Atlassian account the token belongs to').max(200),
  apiToken: secretField('API token', 500),
  projectKey: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9_]{1,19}$/, 'The project key, e.g. SEO or WEB'),
  issueType: z.string().trim().min(1).max(60).default('Task'),
});
export const linearConnectSchema = z.object({
  kind: z.literal('linear'),
  apiKey: secretField('API key', 500).refine((v) => /^lin_api_[A-Za-z0-9]+$/.test(v), 'A Linear personal API key starts with lin_api_'),
  teamKey: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,10}$/, 'The team key, e.g. WEB (the letters before every issue number)'),
});
export const asanaConnectSchema = z.object({
  kind: z.literal('asana'),
  token: secretField('personal access token', 500),
  projectGid: z.string().trim().regex(/^\d{5,25}$/, 'The project id: the long number in the project’s address'),
});
export const trackerConnectSchema = z.discriminatedUnion('kind', [jiraConnectSchema, linearConnectSchema, asanaConnectSchema]);
export type TrackerConnectInput = z.input<typeof trackerConnectSchema>;

/** What a pushed ticket is about: an audit finding (its stable key across audits) or a recommendation (its id). */
export const issueCreateSchema = z.object({
  kind: z.enum(TRACKER_KINDS).optional(),
  websiteId: z.string().uuid(),
  source: z.discriminatedUnion('type', [
    z.object({ type: z.literal('finding'), auditId: z.string().trim().min(1).max(80), findingKey: z.string().trim().min(1).max(200) }),
    z.object({ type: z.literal('recommendation'), id: z.string().trim().min(1).max(200) }),
  ]),
});
export type IssueCreateInput = z.input<typeof issueCreateSchema>;

export const issueSourceKey = (websiteId: string, s: { type: 'finding'; findingKey: string } | { type: 'recommendation'; id: string }): string =>
  s.type === 'finding' ? `finding:${websiteId}:${s.findingKey}` : `rec:${websiteId}:${s.id}`;

export type IssueState = 'todo' | 'in_progress' | 'done' | 'unknown';
export const ISSUE_STATE_LABELS: Record<IssueState, string> = { todo: 'To do', in_progress: 'In progress', done: 'Done', unknown: 'Unknown' };
/** Jira status categories: new / indeterminate / done (https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-workflow-status-categories/) */
export const jiraState = (categoryKey: unknown): IssueState => (categoryKey === 'done' ? 'done' : categoryKey === 'indeterminate' ? 'in_progress' : categoryKey === 'new' ? 'todo' : 'unknown');
/** Linear workflow state types: triage / backlog / unstarted / started / completed / canceled */
export const linearState = (type: unknown): IssueState =>
  type === 'completed' || type === 'canceled' ? 'done' : type === 'started' ? 'in_progress' : type === 'triage' || type === 'backlog' || type === 'unstarted' ? 'todo' : 'unknown';
export const asanaState = (completed: unknown): IssueState => (completed === true ? 'done' : completed === false ? 'todo' : 'unknown');

export interface IssueLinkView {
  id: string;
  websiteId: string | null;
  kind: TrackerKind;
  sourceKey: string;
  sourceTitle: string;
  remoteKey: string;
  remoteUrl: string;
  remoteStatus: string;
  remoteState: IssueState;
  status: 'creating' | 'created' | 'failed';
  createdAt: string;
  syncedAt: string | null;
}

/** The ticket, in plain text paragraphs; each tracker turns it into its own format (Jira: ADF, Linear: Markdown, Asana: notes). */
export interface TicketContent {
  title: string;
  /** paragraphs; a paragraph starting with "- " is a bullet list item */
  paragraphs: string[];
  link: string;
}

export interface FindingForTicket {
  title: string;
  category: string;
  severity: string;
  affected: number | null;
  checked: number | null;
  evidence: string | null;
  why: string | null;
  fix: string | null;
  sampleUrls: string[];
  auditedAt: string;
  reportType: string;
}

export function findingTicket(f: FindingForTicket, domain: string, link: string): TicketContent {
  const p: string[] = [];
  p.push(`Found by the ${f.reportType === 'full_report' ? 'full SEO report' : 'technical audit'} of ${domain} on ${f.auditedAt.slice(0, 10)}. Severity: ${f.severity || 'not set'} · ${f.category || 'uncategorised'}.`);
  if (f.affected != null) p.push(`Pages affected: ${f.affected}${f.checked ? ` of ${f.checked} checked` : ''}.`);
  if (f.why) p.push(`Why it matters: ${f.why}`);
  if (f.evidence) p.push(`Evidence: ${f.evidence}`);
  if (f.sampleUrls.length) {
    p.push('Example pages:');
    for (const u of f.sampleUrls.slice(0, 10)) p.push(`- ${u}`);
  }
  p.push(f.fix ? `The fix: ${f.fix}` : 'The fix: see the finding in Alaventra.');
  p.push('When it is fixed, mark it "I fixed this" in Alaventra: the daily key-page watch checks it again the next morning.');
  return { title: `[SEO] ${f.title}`.slice(0, 250), paragraphs: p, link };
}

export function recommendationTicket(r: { title: string; body: string; action?: string | null }, domain: string, link: string): TicketContent {
  const p = [`Recommendation for ${domain}.`, r.body].filter(Boolean);
  if (r.action) p.push(`What to do: ${r.action}`);
  return { title: `[SEO] ${r.title}`.slice(0, 250), paragraphs: p, link };
}

export const ticketMarkdown = (t: TicketContent): string => [...t.paragraphs, `[Open in Alaventra](${t.link})`].join('\n\n');
export const ticketPlain = (t: TicketContent): string => [...t.paragraphs, `Open in Alaventra: ${t.link}`].join('\n\n');

/** Atlassian Document Format for a Jira description (https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/) */
export function ticketAdf(t: TicketContent): P {
  const content: P[] = [];
  let list: P[] | null = null;
  const para = (s: string): P => ({ type: 'paragraph', content: s ? [{ type: 'text', text: s.slice(0, 5000) }] : [] });
  for (const line of t.paragraphs) {
    if (line.startsWith('- ')) {
      if (!list) {
        list = [];
        content.push({ type: 'bulletList', content: list });
      }
      list.push({ type: 'listItem', content: [para(line.slice(2))] });
    } else {
      list = null;
      content.push(para(line));
    }
  }
  content.push({ type: 'paragraph', content: [{ type: 'text', text: 'Open in Alaventra', marks: [{ type: 'link', attrs: { href: t.link } }] }] });
  return { type: 'doc', version: 1, content };
}

// ---------------------------------------------------------------------------------------------------------------------------
// 3. Warehouse / BI export
// ---------------------------------------------------------------------------------------------------------------------------

export type ColType = 'STRING' | 'INTEGER' | 'FLOAT' | 'BOOLEAN' | 'TIMESTAMP' | 'DATE';
export interface ExportColumn {
  name: string;
  type: ColType;
  description: string;
}
export interface ExportTable {
  id: string;
  label: string;
  /** the n8n Data Table key, or 'runs' for the app's own table */
  source: 'rankHistory' | 'siteMetrics' | 'auditFindings' | 'aiVisibility' | 'backlinks' | 'runs';
  grain: string;
  /** the column the API's `since` filter and the BI tools' date range use */
  dateColumn: string;
  columns: readonly ExportColumn[];
}

const c = (name: string, type: ColType, description: string): ExportColumn => ({ name, type, description });

/** Added to every row of every table. */
export const EXPORT_COMMON: readonly ExportColumn[] = [
  c('company_id', 'STRING', 'Your company id in Alaventra'),
  c('website_id', 'STRING', 'The website id in Alaventra (null for analyses without a website)'),
  c('website_domain', 'STRING', 'The website, e.g. example.com'),
  c('exported_at', 'TIMESTAMP', 'When this export ran (UTC)'),
];

export const EXPORT_TABLES: readonly ExportTable[] = [
  {
    id: 'rank_history',
    label: 'Rank history',
    source: 'rankHistory',
    grain: 'One reading of one tracked keyword',
    dateColumn: 'checked_at',
    columns: [
      c('ladder_id', 'STRING', 'The keyword ladder, or the website id for the weekly live checks'),
      c('keyword', 'STRING', 'The search'),
      c('checked_at', 'TIMESTAMP', 'When the results page was read'),
      c('position', 'INTEGER', 'Position of your page; 0 = not in the top 50; -1 = the check failed (check again, not "does not rank")'),
      c('url', 'STRING', 'Your page that ranked'),
      c('device', 'STRING', 'desktop or mobile (empty on readings before device was stored = desktop)'),
      c('rung', 'INTEGER', 'The ladder rung of the keyword (0 = not a ladder keyword)'),
      c('serp_features', 'STRING', 'Results-page features seen, comma-separated'),
      c('share_of_voice', 'FLOAT', 'Your modelled share of the clicks page 1 offers; -1 = the check failed'),
    ],
  },
  {
    id: 'site_metrics',
    label: 'Search Console and GA4, weekly',
    source: 'siteMetrics',
    grain: 'One weekly period of one website',
    dateColumn: 'period_end',
    columns: [
      c('period_start', 'DATE', 'First day of the period'),
      c('period_end', 'DATE', 'Last day of the period'),
      c('checked_at', 'TIMESTAMP', 'When it was read'),
      c('gsc_connected', 'BOOLEAN', 'Search Console was readable'),
      c('ga4_connected', 'BOOLEAN', 'GA4 was readable'),
      c('clicks', 'INTEGER', 'Search Console clicks'),
      c('impressions', 'INTEGER', 'Search Console impressions'),
      c('ctr', 'FLOAT', 'Click-through rate (0-1)'),
      c('position', 'FLOAT', 'Average position'),
      c('prev_clicks', 'INTEGER', 'Clicks in the period before'),
      c('prev_impressions', 'INTEGER', 'Impressions in the period before'),
      c('prev_ctr', 'FLOAT', 'CTR in the period before'),
      c('prev_position', 'FLOAT', 'Average position in the period before'),
      c('yoy_clicks', 'INTEGER', 'Clicks in the same period a year before'),
      c('yoy_impressions', 'INTEGER', 'Impressions in the same period a year before'),
      c('sessions', 'INTEGER', 'GA4 organic sessions'),
      c('engaged_sessions', 'INTEGER', 'GA4 organic engaged sessions'),
      c('key_events', 'INTEGER', 'GA4 organic key events'),
      c('organic_share', 'FLOAT', 'Organic share of all sessions (0-1)'),
      c('queries', 'INTEGER', 'Searches you appeared for'),
      c('striking', 'INTEGER', 'Searches at positions 8-20 ("striking distance")'),
      c('alerts', 'STRING', 'Alert lines of that week, " | "-separated'),
    ],
  },
  {
    id: 'audit_findings',
    label: 'Audit findings',
    source: 'auditFindings',
    grain: 'One finding of one audit',
    dateColumn: 'audited_at',
    columns: [
      c('audit_id', 'STRING', 'The audit'),
      c('audited_at', 'TIMESTAMP', 'When the audit ran'),
      c('finding_key', 'STRING', 'Stable key of the finding across audits'),
      c('category', 'STRING', 'Category, e.g. Indexing, Content, Links'),
      c('severity', 'STRING', 'Critical, High, Medium or Low'),
      c('title', 'STRING', 'The finding'),
      c('affected_count', 'INTEGER', 'Pages affected (0 = site-wide)'),
      c('checked', 'INTEGER', 'Pages the count was measured on (null on audits before it was stored)'),
      c('impact', 'FLOAT', 'Impact weight the fix list is ordered by'),
      c('impact_basis', 'STRING', 'Why it ranks where it does'),
      c('evidence', 'STRING', 'The evidence line (null on audits before it was stored)'),
      c('sample_urls', 'STRING', 'Up to 5 example addresses, as a JSON array'),
      c('recheck_state', 'STRING', '"I fixed this": requested, fixed, still_open or not_checked'),
      c('recheck_at', 'TIMESTAMP', 'When the daily watch answered'),
    ],
  },
  {
    id: 'ai_visibility',
    label: 'AI visibility, weekly',
    source: 'aiVisibility',
    grain: 'One AI visibility run of one website',
    dateColumn: 'checked_at',
    columns: [
      c('run_id', 'STRING', 'The run'),
      c('checked_at', 'TIMESTAMP', 'When it ran'),
      c('run_kind', 'STRING', 'weekly, full or on_demand'),
      c('prompts', 'INTEGER', 'Questions asked'),
      c('answers', 'INTEGER', 'Answers read'),
      c('samples', 'INTEGER', 'Answers the rates are computed on (incl. the daily pulse)'),
      c('mention_rate', 'FLOAT', 'Share of answers naming you (0-1)'),
      c('mention_lo', 'FLOAT', '95% Wilson range, low'),
      c('mention_hi', 'FLOAT', '95% Wilson range, high'),
      c('citation_rate', 'FLOAT', 'Share of answers citing your pages (0-1)'),
      c('share_of_voice', 'FLOAT', 'Your share of brand mentions against the tracked competitors (0-1)'),
      c('avg_rank', 'FLOAT', 'Average order you are named in'),
      c('aio_presence', 'FLOAT', 'Share of searches showing a Google AI Overview'),
      c('aio_citation_rate', 'FLOAT', 'Share of AI Overviews citing you'),
      c('visibility_score', 'FLOAT', 'Visibility score (0-100)'),
      c('sentiment_score', 'FLOAT', 'Sentiment of the answers naming you'),
      c('accuracy_issues', 'INTEGER', 'Answers with a wrong claim about you'),
      c('ai_sessions', 'INTEGER', 'GA4 visits from AI assistants'),
      c('ai_conversions', 'INTEGER', 'GA4 key events from AI assistants'),
      c('ai_revenue', 'FLOAT', 'GA4 revenue from AI assistants'),
      c('credits', 'FLOAT', 'Credits the run used'),
      c('alerts', 'STRING', 'Alert lines, " | "-separated'),
    ],
  },
  {
    id: 'backlinks',
    label: 'Backlink ledger',
    source: 'backlinks',
    grain: 'One referring site of one website',
    dateColumn: 'last_seen',
    columns: [
      c('ref_domain', 'STRING', 'The linking site'),
      c('kind', 'STRING', 'Kind of site'),
      c('from_url', 'STRING', 'The linking page'),
      c('to_url', 'STRING', 'Your page it links to'),
      c('anchor', 'STRING', 'Link text'),
      c('anchor_kind', 'STRING', 'brand, url, generic, keyword…'),
      c('rel', 'STRING', 'follow, nofollow, sponsored, ugc'),
      c('placement', 'STRING', 'Where on the page the link sits'),
      c('status', 'STRING', 'live, lost, at_risk…'),
      c('first_seen', 'TIMESTAMP', 'First seen by any source'),
      c('last_seen', 'TIMESTAMP', 'Last seen'),
      c('lost_at', 'TIMESTAMP', 'When it was confirmed lost (two misses of our own check)'),
      c('lost_reason', 'STRING', 'Why it is lost'),
      c('sources', 'STRING', 'The sources that report it, comma-separated'),
      c('source_count', 'INTEGER', 'How many sources report it'),
      c('authority', 'FLOAT', 'Authority of the linking site'),
      c('dr', 'FLOAT', 'Ahrefs Domain Rating (when the free key is set)'),
      c('spam_score', 'FLOAT', 'Spam score'),
      c('seo_value', 'FLOAT', 'Estimated SEO value'),
      c('referral_value', 'FLOAT', 'Estimated referral value'),
      c('brand_value', 'FLOAT', 'Estimated brand value'),
      c('visits', 'INTEGER', 'GA4 referral visits'),
      c('key_events', 'INTEGER', 'GA4 referral key events'),
      c('ai_cited', 'BOOLEAN', 'The linking page is cited in AI answers'),
      c('verified_at', 'TIMESTAMP', 'When our own check last saw the link'),
    ],
  },
  {
    id: 'runs',
    label: 'Analyses and their credits',
    source: 'runs',
    grain: 'One analysis',
    dateColumn: 'created_at',
    columns: [
      c('run_id', 'STRING', 'The analysis'),
      c('mode', 'STRING', 'What it was: audit, keyword, ladder, ai_visibility…'),
      c('title', 'STRING', 'Its title'),
      c('status', 'STRING', 'submitting, accepted, running, completed or failed'),
      c('started_by', 'STRING', 'person, api_key or auto'),
      c('created_at', 'TIMESTAMP', 'When it started'),
      c('completed_at', 'TIMESTAMP', 'When it finished'),
      // credits (app/docs/CREDITS.md): the provider cost columns (estimated_cost_usd, actual_cost_usd, cost_estimated, cost_partial) are gone
      c('credits_quoted', 'FLOAT', 'Credits it was quoted before it started (the most it can be charged)'),
      c('credits_charged', 'FLOAT', 'Credits it was charged (null until the charge settles; 0 for a run that failed)'),
      c('report_count', 'INTEGER', 'Reports it produced'),
      c('error', 'STRING', 'Why it failed'),
    ],
  },
];
export type ExportTableId = (typeof EXPORT_TABLES)[number]['id'];
export const EXPORT_TABLE_IDS = EXPORT_TABLES.map((t) => t.id);
export const exportTable = (id: unknown): ExportTable | null => EXPORT_TABLES.find((t) => t.id === id) ?? null;
export const exportColumns = (t: ExportTable): readonly ExportColumn[] => [...EXPORT_COMMON, ...t.columns];

export const EXPORTS = {
  maxDestinations: 3,
  maxRowsPerTable: 200_000,
  maxObjectBytes: 100 * 1024 * 1024,
  /** "Run now" at most once per this many minutes per destination */
  manualEveryMinutes: 10,
  /** how many minutes a destination may stay `running` before the next tick takes it over (a crash mid-export) */
  staleRunMinutes: 60,
} as const;

/** A value as the column type wants it: numbers as numbers, timestamps as ISO, dates as YYYY-MM-DD; unreadable → null. */
export function coerce(v: unknown, type: ColType): string | number | boolean | null {
  if (v == null || v === '') return null;
  switch (type) {
    case 'STRING':
      return typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v);
    case 'INTEGER': {
      const n = Number(v);
      return Number.isFinite(n) ? Math.round(n) : null;
    }
    case 'FLOAT': {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    case 'BOOLEAN':
      return v === true || v === 'true' || v === 1 ? true : v === false || v === 'false' || v === 0 ? false : null;
    case 'TIMESTAMP': {
      const t = v instanceof Date ? v.getTime() : Date.parse(String(v));
      return Number.isFinite(t) ? new Date(t).toISOString() : null;
    }
    case 'DATE': {
      const m = /^(\d{4}-\d{2}-\d{2})/.exec(v instanceof Date ? v.toISOString() : String(v));
      return m ? m[1]! : null;
    }
  }
}

/** One source row as an export row: exactly the documented columns, in order, typed. */
export function exportRow(t: ExportTable, row: P, common: { companyId: string; websiteId: string | null; websiteDomain: string | null; exportedAt: string }): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {
    company_id: common.companyId,
    website_id: common.websiteId,
    website_domain: common.websiteDomain,
    exported_at: common.exportedAt,
  };
  for (const col of t.columns) out[col.name] = coerce(row[col.name], col.type);
  return out;
}

export const toNdjson = (rows: readonly Record<string, unknown>[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '');

/**
 * RFC 4180 CSV with a header row. A text cell that starts with = + - @ (or a tab / carriage return) gets a leading apostrophe, so
 * a spreadsheet that opens the file cannot run it as a formula (OWASP "CSV injection"); numbers are written as numbers.
 */
export function toCsv(cols: readonly ExportColumn[], rows: readonly Record<string, unknown>[]): string {
  const cell = (v: unknown, type: ColType): string => {
    if (v == null) return '';
    let s = typeof v === 'string' ? v : String(v);
    if (type === 'STRING' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = cols.map((c) => c.name).join(',');
  return [head, ...rows.map((r) => cols.map((c) => cell(r[c.name], c.type)).join(','))].join('\r\n') + '\r\n';
}

/** The BigQuery schema of a table (all columns NULLABLE: a field the engine did not store is null, never 0). */
export const bigQuerySchema = (t: ExportTable) => ({ fields: exportColumns(t).map((c) => ({ name: c.name, type: c.type, mode: 'NULLABLE', description: c.description.slice(0, 1024) })) });

export const EXPORT_FORMATS = ['ndjson', 'csv'] as const;
export const EXPORT_SCHEDULES = ['daily', 'weekly', 'off'] as const;
export const STORAGE_PROVIDERS = ['aws', 'gcs', 'r2', 'other'] as const;
export type StorageProvider = (typeof STORAGE_PROVIDERS)[number];
export const STORAGE_PROVIDER_LABELS: Record<StorageProvider, string> = { aws: 'Amazon S3', gcs: 'Google Cloud Storage (HMAC keys)', r2: 'Cloudflare R2', other: 'Another S3-compatible store' };

const bucketRe = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
const prefixField = z
  .string()
  .trim()
  .max(200)
  .regex(/^[A-Za-z0-9!_.*'()/-]*$/, 'Letters, digits and / - _ . only')
  .transform((v) => v.replace(/^\/+|\/+$/g, ''))
  .default('alaventra');
const tablesField = z.array(z.enum(EXPORT_TABLE_IDS as [string, ...string[]])).min(1, 'Choose at least one table').default([...EXPORT_TABLE_IDS]);
const scheduleFields = {
  schedule: z.enum(EXPORT_SCHEDULES).default('daily'),
  /** UTC hour */
  hour: z.number().int().min(0).max(23).default(3),
  /** weekly: 0 = Monday … 6 = Sunday */
  weekday: z.number().int().min(0).max(6).default(0),
};

/** The endpoint a provider is reached at (virtual-hosted for AWS, path-style for the rest). Public hosts only. */
export function storageEndpoint(o: { provider: StorageProvider; region: string; accountId?: string; endpoint?: string }): string | null {
  if (o.provider === 'aws') return /^[a-z]{2}(-gov)?-[a-z]+-\d$/.test(o.region) ? `https://s3.${o.region}.amazonaws.com` : null;
  if (o.provider === 'gcs') return 'https://storage.googleapis.com';
  if (o.provider === 'r2') return /^[a-f0-9]{32}$/.test(o.accountId ?? '') ? `https://${o.accountId}.r2.cloudflarestorage.com` : null;
  const e = (o.endpoint ?? '').replace(/\/+$/, '');
  return /^https:\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(e) && webhookUrlOk(e + '/') ? e : null;
}

export const s3DestinationSchema = z
  .object({
    kind: z.literal('s3'),
    name: z.string().trim().min(1).max(60).default('Storage'),
    provider: z.enum(STORAGE_PROVIDERS),
    region: z.string().trim().toLowerCase().max(40).default('auto'),
    /** Cloudflare R2: the account id (32 hex characters) */
    accountId: z.string().trim().toLowerCase().max(64).default(''),
    /** other: the https endpoint */
    endpoint: z.string().trim().max(300).default(''),
    bucket: z.string().trim().toLowerCase().refine((v) => bucketRe.test(v), 'A bucket name: 3-63 lower-case letters, digits, dots and dashes'),
    prefix: prefixField,
    format: z.enum(EXPORT_FORMATS).default('ndjson'),
    tables: tablesField,
    ...scheduleFields,
    accessKeyId: z.string().trim().min(8, 'Paste the access key id').max(200),
    secretAccessKey: z.string().trim().min(16, 'Paste the secret access key').max(400),
  })
  .superRefine((v, ctx) => {
    if (!storageEndpoint(v))
      ctx.addIssue({
        code: 'custom',
        path: [v.provider === 'aws' ? 'region' : v.provider === 'r2' ? 'accountId' : 'endpoint'],
        message: v.provider === 'aws' ? 'The bucket’s region, e.g. eu-west-1' : v.provider === 'r2' ? 'The Cloudflare account id (32 characters)' : 'An https:// endpoint on a public host',
      });
  });

/** The service-account JSON key file Google hands out (https://cloud.google.com/iam/docs/keys-create-delete) */
export const serviceAccountKeySchema = z.object({
  type: z.literal('service_account', { message: 'This is not a service-account key file' }),
  project_id: z.string().min(1),
  client_email: z.string().email(),
  private_key: z.string().includes('PRIVATE KEY', { message: 'The key file has no private key' }),
});
export const bigQueryDestinationSchema = z.object({
  kind: z.literal('bigquery'),
  name: z.string().trim().min(1).max(60).default('BigQuery'),
  projectId: z.string().trim().regex(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/, 'The Google Cloud project id, e.g. acme-analytics'),
  datasetId: z.string().trim().regex(/^[A-Za-z_][A-Za-z0-9_]{0,1023}$/, 'The dataset id: letters, digits and _'),
  location: z.string().trim().max(40).default('US'),
  tablePrefix: z.string().trim().regex(/^[A-Za-z0-9_]{0,40}$/, 'Letters, digits and _ only').default('alaventra_'),
  tables: tablesField,
  ...scheduleFields,
  /** the whole JSON key file, as text */
  serviceAccountJson: z
    .string()
    .trim()
    .max(20_000)
    .transform((v, ctx) => {
      try {
        const parsed = serviceAccountKeySchema.safeParse(JSON.parse(v));
        if (parsed.success) return parsed.data;
      } catch {
        /* fall through */
      }
      ctx.addIssue({ code: 'custom', message: 'Paste the whole JSON key file of the service account' });
      return z.NEVER;
    }),
});
export const exportDestinationSchema = z.discriminatedUnion('kind', [s3DestinationSchema, bigQueryDestinationSchema]);
/** What can change on a connected destination without connecting it again (the credentials and the target cannot). */
export const exportDestinationPatchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  tables: z.array(z.enum(EXPORT_TABLE_IDS as [string, ...string[]])).min(1, 'Choose at least one table').optional(),
  schedule: z.enum(EXPORT_SCHEDULES).optional(),
  hour: z.number().int().min(0).max(23).optional(),
  weekday: z.number().int().min(0).max(6).optional(),
  format: z.enum(EXPORT_FORMATS).optional(),
});
export type ExportDestinationInput = z.input<typeof exportDestinationSchema>;

/** The next scheduled export after `from` (UTC), or null when the schedule is off. */
export function nextExportAt(o: { schedule: string; hour: number; weekday?: number }, from: Date): Date | null {
  if (o.schedule !== 'daily' && o.schedule !== 'weekly') return null;
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), o.hour, 0, 0));
  if (o.schedule === 'daily') {
    if (d.getTime() <= from.getTime()) d.setUTCDate(d.getUTCDate() + 1);
    return d;
  }
  const want = ((o.weekday ?? 0) + 1) % 7; // 0 = Monday in ours, 1 = Monday in getUTCDay
  let add = (want - d.getUTCDay() + 7) % 7;
  if (add === 0 && d.getTime() <= from.getTime()) add = 7;
  d.setUTCDate(d.getUTCDate() + add);
  return d;
}

/** `<prefix>/<table>/dt=YYYY-MM-DD/<table>-<run>.<ext>`: Hive-style partitions, one full snapshot per run */
export const exportObjectKey = (prefix: string, table: string, runId: string, at: Date, format: 'ndjson' | 'csv'): string =>
  `${prefix ? prefix + '/' : ''}${table}/dt=${at.toISOString().slice(0, 10)}/${table}-${runId}.${format}`;

export interface IntegrationView {
  id: string;
  kind: IntegrationKind;
  name: string;
  /** the non-secret settings, as stored */
  config: P;
  /** e.g. "token …a1b2", "key AKIA…WXYZ" — never the secret */
  secretHint: string;
  status: 'ok' | 'error' | 'untested';
  lastError: string;
  lastCheckedAt: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
}

export interface ExportRunView {
  id: string;
  integrationId: string;
  trigger: 'schedule' | 'manual';
  status: 'running' | 'ok' | 'partial' | 'failed';
  tables: { table: string; rows: number; bytes: number; object: string; truncated: boolean; error: string }[];
  startedAt: string;
  finishedAt: string | null;
  error: string;
}

export interface IntegrationsOverview {
  secretsReady: boolean;
  appUrl: string;
  endpoints: WebhookEndpointView[];
  deliveries: WebhookDeliveryView[];
  integrations: IntegrationView[];
  exportRuns: ExportRunView[];
  issues: IssueLinkView[];
}

/** a secret, shown as its last four characters */
export const secretHint = (label: string, s: string): string => (s && s.length >= 8 ? `${label} …${s.slice(-4)}` : label);
