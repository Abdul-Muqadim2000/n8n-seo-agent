import { z } from 'zod';
import { AUTOMATIONS, MODES, SCHEDULED_STAGES, STAGE_LABELS } from './constants';
import { findOpenBrackets } from './placeholders';

/**
 * B-R1, getting the report out of the app (benchmark programme 2026-10-15, area 12 §4 G-1 and §7).
 *
 * On 2026-10-14, 23 reports landed in the app's `reports` table and **not one was e-mailed, posted or pushed anywhere**. The
 * customer learned a report existed by logging in. Every one of the six tools benchmarked in that pass pushes the report:
 * AgencyAnalytics on six frequencies with a subject and body, Looker Studio as a PDF to up to 50 recipients or into Slack. The
 * engine's own e-mail is deliberately off (`ENGINE_EMAILS=false`) because the app holds the reports, so delivery has to come from
 * the app.
 *
 * This file holds the parts that must behave the same on the server and in the browser and that are worth testing on their own:
 * the settings and their schema, when the next scheduled delivery is due, **the decision to deliver or to hold**, and the body of
 * what is sent. Nothing here reaches a database, a mail server or the network.
 *
 * ## The refusal is the point
 *
 * `deliveryDecision()` decides, and its default answer is no. A report the run marked **not ready** is never delivered, a page
 * that failed its quality gate, a plan the engine refused, a verdict it could not check, evidence it could not read, a rejected
 * run. Pushing one of those into an inbox would hand the customer a conclusion the run itself does not stand behind, and the
 * benchmark names refusing as the bar to copy (area 12 §4, "Where the leader is wrong and we are right", item 4: no tool checked
 * labels a figure it could not trust, let alone declines to send it). A held report still sits in the app with its reason on it,
 * so nothing is hidden, it is simply not pushed.
 */

// ---------------------------------------------------------------------------------------------------------------------------
// 1. What the customer sets
// ---------------------------------------------------------------------------------------------------------------------------

/** How often reports are pushed. `each` sends every finished report as it arrives; the rest collect them into one message. */
export const DELIVERY_FREQUENCIES = ['off', 'each', 'daily', 'weekly', 'monthly'] as const;
export type DeliveryFrequency = (typeof DELIVERY_FREQUENCIES)[number];

export const DELIVERY_FREQUENCY_LABELS: Record<DeliveryFrequency, string> = {
  off: 'Off',
  each: 'As each report arrives',
  daily: 'A daily summary',
  weekly: 'A weekly summary',
  monthly: 'A monthly summary',
};

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export const DELIVERY = {
  /** at most this many e-mail recipients (Looker Studio's own cap is 50; ours is the same shape) */
  maxRecipients: 50,
  /** how long a share link made for a delivery lasts, in days */
  shareDays: 30,
  /** reports in one summary message */
  maxReportsPerDigest: 25,
  /** how many times a failed webhook or e-mail is tried again before it is left failed */
  maxAttempts: 3,
  /** how long to wait between attempts, in minutes */
  retryMinutes: 10,
  /** the header a webhook body is signed with */
  signatureHeader: 'X-Alaventra-Signature',
  timestampHeader: 'X-Alaventra-Timestamp',
} as const;

export interface DeliverySettings {
  frequency: DeliveryFrequency;
  /** for `weekly`: 0 = Monday ... 6 = Sunday */
  weekday: number;
  /** for `daily` / `weekly` / `monthly`: the hour of the day, UTC, 0-23 */
  hour: number;
  /** for `monthly`: the day of the month, 1-28 (28 so every month has one) */
  dayOfMonth: number;
  email: {
    enabled: boolean;
    /** who receives it; empty means every member of the company who can see reports */
    recipients: string[];
    /** attach the report's own files (PDF, Word, the fix pack) rather than only linking to them */
    attachFiles: boolean;
  };
  webhook: {
    enabled: boolean;
    url: string;
    /** whether a signing secret is stored, the secret itself is never returned by the API */
    hasSecret?: boolean;
  };
  /** only these stages are pushed; empty means every finished report */
  stages: string[];
  /** include a share link anybody can open without an account (G15), so a report can be forwarded */
  shareLinks: boolean;
}

export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  frequency: 'off',
  weekday: 0,
  hour: 8,
  dayOfMonth: 1,
  email: { enabled: false, recipients: [], attachFiles: true },
  webhook: { enabled: false, url: '', hasSecret: false },
  stages: [],
  shareLinks: true,
};

const emailList = z
  .array(z.string().trim().toLowerCase().email('Enter a valid e-mail address'))
  .max(DELIVERY.maxRecipients, `At most ${DELIVERY.maxRecipients} recipients`)
  .transform((list) => [...new Set(list)]);

/**
 * A webhook must be https, and it must point somewhere outside this network.
 *
 * The second half matters more than the first. The server fetches whatever address is stored here, so without a check an address
 * like `https://169.254.169.254/latest/meta-data/` or `https://10.0.0.5/admin` would turn report delivery into a way of making the
 * server fetch its own neighbours and hand the answer back as a delivery failure. Private, loopback, link-local and `.internal`
 * hosts are refused; `localhost` over plain http is allowed because a developer pointing at their own machine is the one case where
 * it is the whole point, and it cannot reach anything a browser on that machine could not.
 */
const PRIVATE_HOST =
  /^(localhost|127(\.\d{1,3}){3}|0\.0\.0\.0|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}|169\.254(\.\d{1,3}){2}|\[?::1\]?|\[?f[cd][0-9a-f]{2}:.*\]?|.*\.(local|internal|localdomain|home\.arpa))$/i;

export function webhookUrlOk(value: string): boolean {
  const m = String(value || '').match(/^(https?):\/\/([^/?#:]+)(?::(\d+))?([/?#]\S*)?$/i);
  if (!m) return false;
  const [, scheme, host] = m;
  const bare = host!.toLowerCase();
  if (scheme!.toLowerCase() === 'http') return bare === 'localhost' || bare === '127.0.0.1';   // a developer's own machine only
  return !PRIVATE_HOST.test(bare);
}

export const deliverySettingsSchema = z.object({
  frequency: z.enum(DELIVERY_FREQUENCIES).default('off'),
  weekday: z.number().int().min(0).max(6).default(0),
  hour: z.number().int().min(0).max(23).default(8),
  dayOfMonth: z.number().int().min(1).max(28).default(1),
  email: z
    .object({
      enabled: z.boolean().default(false),
      recipients: emailList.default([]),
      attachFiles: z.boolean().default(true),
    })
    .default({ enabled: false, recipients: [], attachFiles: true }),
  webhook: z
    .object({
      enabled: z.boolean().default(false),
      url: z.string().trim().max(2000).default(''),
      /** set once; sending '' clears it, leaving it out keeps what is stored */
      secret: z.string().trim().max(200).optional(),
    })
    .default({ enabled: false, url: '' })
    .refine((w) => !w.enabled || webhookUrlOk(w.url), {
      message: 'Enter an https:// address on a public host for the webhook',
      path: ['url'],
    }),
  stages: z.array(z.string().trim().max(60)).max(40).default([]),
  shareLinks: z.boolean().default(true),
});
export type DeliverySettingsInput = z.input<typeof deliverySettingsSchema>;

/** Whether anything would be sent at all: a frequency, and at least one channel that can carry it. */
export const deliveryOn = (s: DeliverySettings): boolean => s.frequency !== 'off' && (s.email.enabled || s.webhook.enabled);

// ---------------------------------------------------------------------------------------------------------------------------
// 2. The decision: deliver, or hold and say why
// ---------------------------------------------------------------------------------------------------------------------------

export type HoldCode =
  | 'not_ready'
  | 'test_run'
  | 'refused'
  | 'rejected'
  | 'unavailable'
  | 'interim'
  | 'stage_not_chosen'
  | 'delivery_off'
  | 'no_channel'
  | 'already_delivered';

export interface DeliveryDecision {
  deliver: boolean;
  /** why it is held, in the customer's words; empty when it is delivered */
  reason: string;
  code: HoldCode | null;
}

const DELIVER: DeliveryDecision = { deliver: true, reason: '', code: null };
const hold = (code: HoldCode, reason: string): DeliveryDecision => ({ deliver: false, reason, code });

/** Stages that say a run has *started*, not that a report is ready. */
const INTERIM_STAGES = new Set(['case_study_started', 'ai_visibility_started', 'backlinks_started', 'site_tracker_setup', 'ai_pilot_quote', 'unknown']);   // W2-FIX: a pilot's price is a note

/**
 * R110, the stages that are themselves a report. Every weekly / monitor report node in the engine ends with `status: 'progress'`
 * (AI_Report, BL_Report, LB_Report, Growth_Report, Pulse_Metrics, Site_Report, Tracker_Report, Cadence_Status / Cadence_Note):
 * that has been the weekly-report contract since the v4.2 Rank Tracker, 79 stored rows carry it and other API callers may read
 * it, so the app reads `progress` on one of these stages as a finished report rather than the engine changing its word.
 */
export const REPORT_STAGES: ReadonlySet<string> = new Set<string>([
  ...AUTOMATIONS.map((a) => a.id),
  ...AUTOMATIONS.map((a) => a.stage),
  ...SCHEDULED_STAGES,
  'content_cadence',
  ...Object.values(MODES).flatMap((m) => m.finalStages),
]);

const FINISHED_STATUSES = new Set(['completed', 'ok', 'success']);

/**
 * Whether a callback's status says the report is finished. `completed` / `ok` / `success` always do (and an empty status, which
 * old rows carry); `progress` does on a report stage (R110); `failed`, `rejected`, `accepted` and anything unknown never do.
 */
export function finishedStatus(stage: string, status: string): boolean {
  const s = (status || '').toLowerCase();
  if (!s || FINISHED_STATUSES.has(s)) return true;
  return s === 'progress' && REPORT_STAGES.has(stage) && !INTERIM_STAGES.has(stage);
}

const isObj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const text = (v: unknown): string => (typeof v === 'string' ? v : '');

export interface DeliveryCandidate {
  stage: string;
  /** the `status` the callback carried ('completed', 'rejected', ...) */
  status: string;
  /** the callback body */
  payload: Record<string, unknown>;
}

/**
 * Whether one report may leave the app.
 *
 * Every `false` below is deliberate, and each one maps to something a run says about itself:
 *
 *  - **rejected**, the engine refused the request (over budget, a guard, bad input). There is no report.
 *  - **not ready**, R11: a page that used up its quality rounds and still failed carries `qa_not_ready`. It is a draft, and the
 *    report says so; e-mailing it as "your new page" would be a lie told by the delivery, not by the run.
 *  - **refused**, R22 / R23: a ladder the engine declined to plan (`planned: false`) has a reason, not a plan.
 *  - **unavailable**, R18 and the `_serp_obs` rules: a verdict the engine could not check (`NOT_CHECKED`, `feasibility.not_checked`,
 *    `serp_features.unavailable`, a homepage it could not read). The report exists so the customer can see *why*; pushing it
 *    would present "we could not look" as a finding.
 *  - **interim**, a "started" callback is an acknowledgement, not a result.
 *  - **test run**, C-11: a dry run (`dry_run: true`) changed nothing; it is a test, not a report.
 */
export function deliveryDecision(c: DeliveryCandidate): DeliveryDecision {
  const p = c.payload ?? {};
  const stage = c.stage || text(p.stage);
  const status = (c.status || text(p.status) || '').toLowerCase();

  if (stage === 'rejected' || status === 'rejected')
    return hold('rejected', `The engine refused this run${text(p.error) ? ` (${text(p.error).slice(0, 160)})` : ''}, so there is nothing to send.`);
  // R110: a "started" note is an acknowledgement whatever status it carries (the engine sends them as `accepted`), so it is
  // checked before the status, otherwise it is coded `rejected` and a share link calls it "did not produce a report".
  if (INTERIM_STAGES.has(stage)) return hold('interim', 'This is a note that the work started, not the report itself.');
  if (!finishedStatus(stage, status)) return hold('rejected', `This run finished as "${status}", not as a completed report.`);
  if (text(p.validation_error)) return hold('refused', `The engine refused this run: ${text(p.validation_error).slice(0, 200)}`);
  // C-11 (re-rating 2026-10-17): a dry run is a test the owner started - AI Growth's `dry_run: true` submitted nothing, so a report titled
  // "done for you this week" must never be pushed to anyone. It stays in the app, marked as a test.
  if (p.dry_run === true || p.dry_run === 'true')
    return hold('test_run', 'This was a test run (dry run): nothing was submitted or changed, so it stays in the app and is not sent.');

  // R11, the quality gate. A page that did not pass is a draft, whatever else the report contains.
  if (p.qa_not_ready === true || p.qa_publishable === false) {
    const why = (Array.isArray(p.qa_reasons) ? p.qa_reasons.map(text).filter(Boolean) : []).slice(0, 2).join('; ');
    return hold('not_ready', `The page did not pass the quality check${why ? ` (${why})` : ''}, so it is waiting in the app rather than going out as finished work.`);
  }
  // A-13 (2026-10-17), a written page that still holds a bracket for a person to fill in or confirm is a draft too, whatever the
  // gate said: the same detector the engine counts with (placeholders.ts) reads the page that would be sent.
  const body = text(p.markdown) || text(p.page_markdown);
  if (body) {
    const open = findOpenBrackets(body);
    if (open.length) {
      const n = open.reduce((s, b) => s + b.count, 0);
      return hold('not_ready', `The page still has ${n} bracket${n === 1 ? '' : 's'} to fill in or confirm (${open.slice(0, 3).map((b) => b.token.slice(0, 80)).join(', ')}), so it is waiting in the app rather than going out as finished work.`);
    }
  }
  // R22 / R23, a ladder the engine would not plan
  if (p.planned === false) return hold('refused', `No plan was made: ${text(isObj(p.refusal).reason) || 'the engine refused this keyword'}.`);

  // Evidence the run could not read. A report built on it is worth reading in the app and worth not pushing.
  const verdict = text(p.verdict).toUpperCase();
  if (verdict === 'NOT_CHECKED') return hold('unavailable', 'The search results could not be read for this keyword, so there is no verdict to send.');
  if (text(isObj(p.feasibility).status) === 'not_checked') return hold('unavailable', 'The search data could not be read, so the plan was not scored.');
  if (isObj(p.serp_features).unavailable === true)
    return hold('unavailable', 'The live search results could not be read for this run, so the report cannot say what is on them.');
  if (p.site_read_failed === true) return hold('unavailable', 'Your homepage could not be read, so there was nothing to describe.');

  return DELIVER;
}

/** The same decision, plus the customer's own settings: which stages they asked for and whether a channel exists at all. */
export function deliveryDecisionFor(c: DeliveryCandidate, s: DeliverySettings): DeliveryDecision {
  if (s.frequency === 'off') return hold('delivery_off', 'Report delivery is off for this company.');
  if (!s.email.enabled && !s.webhook.enabled) return hold('no_channel', 'No e-mail address or webhook is set up to deliver to.');
  if (s.stages.length && !s.stages.includes(c.stage)) return hold('stage_not_chosen', `${STAGE_LABELS[c.stage] ?? c.stage} is not one of the reports chosen for delivery.`);
  return deliveryDecision(c);
}

// ---------------------------------------------------------------------------------------------------------------------------
// 3. When the next summary is due
// ---------------------------------------------------------------------------------------------------------------------------

const DAY_MS = 86_400_000;

/**
 * The next moment a `daily` / `weekly` / `monthly` summary is due after `from`, on the UTC clock (the app's schedules are stored in
 * UTC so a customer's answer does not move when a server changes time zone). `off` and `each` have no due time.
 */
export function nextDeliveryAt(s: DeliverySettings, from: Date = new Date()): Date | null {
  if (s.frequency === 'off' || s.frequency === 'each') return null;
  const hour = Math.min(23, Math.max(0, Math.round(s.hour)));
  if (s.frequency === 'daily') {
    const today = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), hour);
    return new Date(today > from.getTime() ? today : today + DAY_MS);
  }
  if (s.frequency === 'weekly') {
    const want = Math.min(6, Math.max(0, Math.round(s.weekday)));   // 0 = Monday
    const midnight = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
    const today = (new Date(midnight).getUTCDay() + 6) % 7;
    let ahead = (want - today + 7) % 7;
    if (ahead === 0 && midnight + hour * 3_600_000 <= from.getTime()) ahead = 7;
    return new Date(midnight + ahead * DAY_MS + hour * 3_600_000);
  }
  const day = Math.min(28, Math.max(1, Math.round(s.dayOfMonth)));
  const thisMonth = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), day, hour);
  return new Date(thisMonth > from.getTime() ? thisMonth : Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, day, hour));
}

/** How the schedule reads on the settings page ("Every Monday at 08:00 UTC"). */
export function deliveryScheduleLabel(s: DeliverySettings): string {
  const at = `${String(Math.min(23, Math.max(0, Math.round(s.hour)))).padStart(2, '0')}:00 UTC`;
  switch (s.frequency) {
    case 'off':
      return 'Reports stay in the app';
    case 'each':
      return 'Every report, as soon as it is ready';
    case 'daily':
      return `Every day at ${at}`;
    case 'weekly':
      return `Every ${WEEKDAYS[Math.min(6, Math.max(0, Math.round(s.weekday)))]} at ${at}`;
    case 'monthly':
      return `On day ${Math.min(28, Math.max(1, Math.round(s.dayOfMonth)))} of the month at ${at}`;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------
// 4. What is sent
// ---------------------------------------------------------------------------------------------------------------------------

/** One report inside a delivery: enough to act on without opening anything, plus the links that open it. */
export interface DeliveryItem {
  reportId: string;
  stage: string;
  stageLabel: string;
  title: string;
  siteDomain: string | null;
  receivedAt: string;
  scheduled: boolean;
  /** the headline values the report carried (`summarize` in the server's summaries.ts) */
  figures: Record<string, string | number | boolean | null>;
  /** the signed-in link */
  url: string;
  /** the expiring share link, when the company asked for one (G15) */
  shareUrl: string | null;
  files: { id: string; kind: string; fileName: string; size: number }[];
}

export interface DeliveryPayload {
  company: string;
  /** 'each' for a single report, otherwise the summary's frequency */
  kind: DeliveryFrequency;
  generatedAt: string;
  /** reports in this message, newest first */
  reports: DeliveryItem[];
  /** reports that were deliberately **not** sent, with the reason, stated, never hidden */
  held: { reportId: string; title: string; reason: string; code: HoldCode | null }[];
}

/** Figure names the engine uses, in the words a customer reads. Anything not named here is shown as it comes. */
const FIGURE_LABELS: Record<string, string> = {
  keyword: 'Keyword',
  verdict: 'Verdict',
  score: 'Score',
  page: 'Recommended page',
  qa: 'Quality check',
  volume: 'Monthly searches',
  difficulty: 'Difficulty',
  healthScore: 'Health score',
  grade: 'Grade',
  critical: 'Critical issues',
  high: 'High issues',
  medium: 'Medium issues',
  scoreDelta: 'Change since the last audit',
  clicks: 'Clicks',
  impressions: 'Impressions',
  clicksPct: 'Clicks change',
  clicksChange: 'Clicks change',
  sessions: 'Visits',
  actions: 'Actions to take',
  mentionRate: 'AI mention rate',
  citationRate: 'AI citation rate',
  shareOfVoice: 'Share of voice',
  visibilityScore: 'AI visibility score',
  referringDomains: 'Linking websites',
  backlinks: 'Links',
  lost: 'Lost links',
  importantLost: 'Important links lost',
  prospects: 'Link prospects',
  positions: 'Keywords checked',
  gains: 'Moved up',
  drops: 'Moved down',
  head: 'Main keyword',
  pages: 'Pages',
  startWith: 'Start with',
  quickWins: 'Quick wins',
  drafted: 'Outreach drafted',
  listingsMissing: 'Listings missing',
  submitted: 'Pages submitted',
};

export const figureLabel = (key: string): string => FIGURE_LABELS[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

const figureValue = (v: string | number | boolean | null): string => {
  if (v === null) return '-';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
  return v;
};

/** The figures of one report as label / value lines, in the order the engine put them. */
export const figureLines = (item: DeliveryItem): { label: string; value: string }[] =>
  Object.entries(item.figures)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .slice(0, 12)
    .map(([k, v]) => ({ label: figureLabel(k), value: figureValue(v) }));

export const stageLabel = (stage: string): string => STAGE_LABELS[stage] ?? stage;

/** The subject line: one report names itself, a summary says how many and for which website. */
export function deliverySubject(p: DeliveryPayload): string {
  if (p.reports.length === 1) {
    const r = p.reports[0]!;
    return r.siteDomain ? `${r.title}, ${r.siteDomain}` : r.title;
  }
  const domains = [...new Set(p.reports.map((r) => r.siteDomain).filter(Boolean))] as string[];
  const what = p.kind === 'daily' ? 'Today' : p.kind === 'weekly' ? 'This week' : p.kind === 'monthly' ? 'This month' : 'New';
  const where = domains.length === 1 ? ` for ${domains[0]}` : domains.length > 1 ? ` across ${domains.length} websites` : '';
  return `${what}: ${p.reports.length} SEO reports${where}`;
}

/** The plain-text body. The HTML one is built from the same lines by the server's mailer, so the two can never diverge. */
export function deliveryLines(p: DeliveryPayload): string[] {
  const lines: string[] = [];
  lines.push(
    p.reports.length === 1
      ? 'Your report is ready.'
      : `${p.reports.length} reports are ready${p.kind === 'weekly' ? ' from this week' : p.kind === 'daily' ? ' from today' : p.kind === 'monthly' ? ' from this month' : ''}.`,
  );
  for (const r of p.reports) {
    const figures = figureLines(r).map((f) => `${f.label}: ${f.value}`).join(' · ');
    lines.push(
      [
        `${r.title}${r.siteDomain ? ` (${r.siteDomain})` : ''}`,
        figures,
        r.files.length ? `${r.files.length} file${r.files.length === 1 ? '' : 's'} attached or in the app` : '',
        `Open it: ${r.url}`,
        r.shareUrl ? `Share it (no account needed, expires): ${r.shareUrl}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
  for (const h of p.held) lines.push(`Not sent, ${h.title}: ${h.reason}`);
  return lines;
}

/**
 * The webhook body. It carries the structured report so a system can act on it, and a `text` line so the common chat webhooks
 * (Slack, Discord, Microsoft Teams) render something a person can read without any mapping, the same shape the engine's own ops
 * alerts use.
 */
export function deliveryWebhookBody(p: DeliveryPayload): Record<string, unknown> {
  const text = [
    deliverySubject(p),
    ...p.reports.map((r) => {
      const figures = figureLines(r).map((f) => `${f.label}: ${f.value}`).join(' · ');
      return `• ${r.title}${r.siteDomain ? ` (${r.siteDomain})` : ''}${figures ? `, ${figures}` : ''}\n  ${r.shareUrl ?? r.url}`;
    }),
    ...p.held.map((h) => `• Not sent, ${h.title}: ${h.reason}`),
  ].join('\n');
  return {
    text,
    event: 'reports.delivered',
    company: p.company,
    kind: p.kind,
    generated_at: p.generatedAt,
    reports: p.reports.map((r) => ({
      id: r.reportId,
      stage: r.stage,
      stage_label: r.stageLabel,
      title: r.title,
      site: r.siteDomain,
      received_at: r.receivedAt,
      scheduled: r.scheduled,
      figures: r.figures,
      url: r.url,
      share_url: r.shareUrl,
      files: r.files.map((f) => ({ id: f.id, kind: f.kind, file_name: f.fileName, size: f.size })),
    })),
    held: p.held.map((h) => ({ id: h.reportId, title: h.title, reason: h.reason, code: h.code })),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// 4b. The weekly site report's headline follows its own significance test (R113)
// ---------------------------------------------------------------------------------------------------------------------------

/** One figure's verdict from the engine's two-sample Poisson test (`significance.<figure>` in the site_tracker payload, G28). */
export interface ChangeTest {
  pct?: number | null;
  real?: boolean | null;
  significant?: boolean | null;
  watch?: boolean | null;
}

const asTest = (v: unknown): ChangeTest | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as ChangeTest) : null);

/**
 * R113 (2026-10-16): the hero of the weekly site report read "Clicks from Google are up 52% to 32" while the brief right under it said
 * the same change was "not statistically significant". The headline now follows the test the report itself prints: a clicks change the
 * test calls not real reads "within normal variation", and the headline leads with a change that IS real (impressions, then organic
 * visits) when there is one. Without a significance block (Search Console not connected, older reports) it reads as before.
 */
export function clicksHeadline(clicks: number | null, pctCh: number | null, significance?: unknown): string {
  if (clicks == null) return 'Weekly site report';
  const c = Math.round(clicks).toLocaleString('en-US');
  const unit = clicks === 1 ? 'click' : 'clicks';
  const sig = asTest(significance) ? (significance as Record<string, unknown>) : null;
  const ct = sig ? asTest(sig.clicks) : null;
  if (ct && ct.real === false) {
    const label: Record<string, string> = { impressions: 'Impressions in Google', sessions: 'Visits from organic search' };
    const realKey = ['impressions', 'sessions'].find((k) => {
      const t = asTest(sig![k]);
      return !!t && t.real === true && typeof t.pct === 'number' && Math.abs(t.pct) >= 0.5;
    });
    const steady = `${c} ${unit} from Google, within normal variation`;
    if (!realKey) return steady.charAt(0).toUpperCase() + steady.slice(1);
    const p = asTest(sig![realKey])!.pct as number;
    return `${label[realKey]} ${p >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(p))}%, a real change · ${steady}`;
  }
  if (pctCh == null) return `${c} ${unit} from Google in the last 28 days`;
  if (pctCh >= 0.5) return `Clicks from Google are up ${Math.round(pctCh)}% to ${c}`;
  if (pctCh <= -0.5) return `Clicks from Google are down ${Math.abs(Math.round(pctCh))}% to ${c}`;
  return `Clicks from Google are steady at ${c}`;
}

// ---------------------------------------------------------------------------------------------------------------------------
// 5. What the app shows about deliveries that have happened
// ---------------------------------------------------------------------------------------------------------------------------

export type DeliveryStatus = 'sent' | 'failed' | 'held' | 'pending';
export type DeliveryChannel = 'email' | 'webhook';

export interface DeliveryRecord {
  id: string;
  reportId: string | null;
  reportTitle: string;
  channel: DeliveryChannel;
  /** the address or host it went to, never a secret */
  target: string;
  status: DeliveryStatus;
  kind: DeliveryFrequency;
  reason: string;
  attempts: number;
  createdAt: string;
  sentAt: string | null;
}

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  sent: 'Sent',
  failed: 'Failed',
  held: 'Not sent',
  pending: 'Waiting',
};
