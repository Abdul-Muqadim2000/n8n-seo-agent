// Link Builder (v4.13, n8n/seo-agent/LINK_BUILDER_SPEC.md): the n8n rows the app reads, the API shapes, and the sending rules shared by the
// server (sender, inbox poller) and the web app (what the page explains). Rules come from the research of 2026-10-10: low, steady volume
// from the customer's own mailbox, 3 e-mails at most in one thread, stop on any reply, plain text, identity + postal address + a working
// opt-out in every e-mail, consent where the law asks for it (Germany, Austria, Saudi Arabia, named people in the UAE).
import type { DtRow } from './tables';

// ---- n8n Data Tables written by the Link Builder workflow (SEOagentLinkBld1) ----
export interface LinkOutreachRow extends DtRow {
  site_id: string; domain: string; prospect_domain: string; type: string;
  /** ready (qualified, contact found) | drafted (sequence written and every check passed) | needs_edit (written, but the draft gate held it: the reason is in fit_reason) | needs_contact | not_fit | fix (a redirect to add on our own site) */
  status: string; score: number | null; fit: number | null; fit_reason: string; checks_json: string; page_url: string; page_title: string; evidence: string;
  contacts_json: string; contact_email: string; contact_form_url: string; country: string; language: string; target_url: string; target_reason: string;
  anchor_hint: string; sequence_json: string; deadline: string; drafted_at: string; checked_at: string; request_id: string;
}
export interface ListingRow extends DtRow {
  site_id: string; domain: string; listing_id: string; name: string; category: string;
  /** linked | listed | missing | submitted | unknown (the platform blocks checks) | ignored */
  status: string; profile_url: string; rel: string; competitors: string; submit_url: string; priority: number | null; why: string; checked_at: string; submitted_at: string; note: string;
}
export interface LinkImpactRow extends DtRow {
  site_id: string; domain: string; ref_domain: string; from_url: string; target_url: string; t0: string; weeks: number | null; base_position: number | null; base_clicks: number | null;
  position: number | null; clicks: number | null; page_change: number | null; control_change: number | null; control_spread: number | null; effect: number | null;
  /** likely_helped | possibly_helped | no_effect_yet | too_early | cant_tell */
  verdict: string; note: string; keyword: string; updated_at: string;
  /** G12 (2026-10-13): what was read, `link` (a won link; ref_domain set) or `page_change` (a page that went live or was rewritten).
   * Rows written before this change have neither, and are link readings. */
  kind?: string;
  /** G12: a page change says what changed, published | rewritten */
  change?: string;
}
export const LINK_OUTREACH_TABLE_COLUMNS = ['site_id', 'domain', 'prospect_domain', 'type', 'status', 'score', 'fit', 'fit_reason', 'checks_json', 'page_url', 'page_title', 'evidence', 'contacts_json',
  'contact_email', 'contact_form_url', 'country', 'language', 'target_url', 'target_reason', 'anchor_hint', 'sequence_json', 'deadline', 'drafted_at', 'checked_at', 'request_id'] as const;

// ---- labels ----
export const OPPORTUNITY_LABEL: Record<string, string> = { lost: 'Link to restore', mention: 'Mentions you without a link', list: 'List that leaves you out', comp_new: 'Just linked to a competitor', gap: 'Links to your competitors',
  ai_source: 'Page AI assistants cite', resource: 'Resource page', broken: 'Dead link to replace', press: 'Journalist request', reclaim: 'Broken page of yours', manual: 'Added by you' };
export const REPLY_CLASSES = ['says_linked', 'interested', 'question', 'wants_payment', 'link_swap', 'not_now', 'declined', 'unsubscribe', 'wrong_person', 'out_of_office', 'other'] as const;
export type ReplyClass = (typeof REPLY_CLASSES)[number];
export const REPLY_LABEL: Record<ReplyClass, string> = { says_linked: 'Says the link is live', interested: 'Interested', question: 'Has a question', wants_payment: 'Asks for payment', link_swap: 'Asks for a link swap',
  not_now: 'Not now', declined: 'Declined', unsubscribe: 'Asked not to be contacted', wrong_person: 'Wrong person', out_of_office: 'Out of office', other: 'Replied' };
/** scheduled (approved, waiting for the window) -> active (sent, waiting for the next step) -> replied | bounced | stopped | won | finished (no reply) | failed */
export const SEQUENCE_STATUSES = ['scheduled', 'active', 'paused', 'replied', 'bounced', 'stopped', 'won', 'finished', 'failed'] as const;
export type SequenceStatus = (typeof SEQUENCE_STATUSES)[number];
export const SEQUENCE_LABEL: Record<SequenceStatus, string> = { scheduled: 'Scheduled', active: 'Sent, waiting', paused: 'Paused', replied: 'Replied', bounced: 'Bounced', stopped: 'Stopped', won: 'Won', finished: 'No reply', failed: 'Failed' };

// ---- API shapes ----
export interface OutreachStep {
  step: number; waitDays: number; subject: string; body: string;
  /** L7: the other subject the writer wrote for this pitch, in the other style (only on the first step, and only when it passed the same checks) */
  subjectAlt?: string;
  /** L7: which of the two styles this pitch carries, A names what we found, B asks the one question */
  variant?: string;
}
export interface OutreachContact { email: string; kind: 'person' | 'editorial' | 'general' | 'other'; own: boolean; sourceUrl: string }
export interface OutreachDraft {
  prospectDomain: string; type: string; status: string; prospectStatus: string; score: number; fit: number; fitReason: string;
  pageUrl: string; pageTitle: string; evidence: string; contacts: OutreachContact[]; contactFormUrl: string; country: string; language: string;
  targetUrl: string; targetReason: string; anchorHint: string; steps: OutreachStep[]; deadline: string; draftedAt: string; checkedAt: string;
  deadLink: { url: string; anchor: string } | null; consent: ConsentGate;
}
export interface OutreachMessageView { id: string; direction: 'out' | 'in'; step: number; kind: string; subject: string; body: string; from: string; to: string; at: string; error: string | null }
export interface OutreachSequence {
  id: string; prospectDomain: string; type: string; toEmail: string; mailboxId: string | null; status: SequenceStatus; step: number; steps: OutreachStep[];
  /** L7: the subject style this conversation went out with (A | B, empty for a pitch with only one subject) */
  subjectVariant: string;
  nextAt: string | null; approvedAt: string | null; startedAt: string | null; lastSentAt: string | null; targetUrl: string; pageUrl: string;
  replyAt: string | null; replyClass: ReplyClass | null; replySummary: string; suggestedReply: string; replyFrom: string; oooUntil: string | null; wonAt: string | null; error: string;
  messages: OutreachMessageView[];
}
// ---- L4: how a mailbox is connected ----
/** `smtp`: SMTP + IMAP with an app password. The others are OAuth: no password is stored and the provider's API does the sending. */
export const MAILBOX_PROVIDERS = ['smtp', 'gmail_oauth', 'ms_graph'] as const;
export type MailboxProvider = (typeof MAILBOX_PROVIDERS)[number];
export const OAUTH_PROVIDERS = ['gmail_oauth', 'ms_graph'] as const;
export type OauthProvider = (typeof OAUTH_PROVIDERS)[number];
export const isOauthProvider = (p: string): p is OauthProvider => (OAUTH_PROVIDERS as readonly string[]).includes(p);
/** what the Mailboxes tab offers: whether this installation has the provider's OAuth app, and what the provider can do */
export interface MailProviderInfo { id: OauthProvider; label: string; enabled: boolean; reads: boolean; note: string; disabledWhy: string; withdraw: string }
export interface MailboxView {
  id: string; label: string; fromName: string; fromEmail: string; provider: MailboxProvider; smtpHost: string; smtpPort: number; smtpSecure: boolean; imapHost: string; imapPort: number; imapSecure: boolean;
  /** L4: `password` (SMTP + IMAP with an app password) or `oauth` (the provider's own permission, nothing to store) */
  authType: 'password' | 'oauth';
  /** L4: are replies read automatically? False for Gmail OAuth, whose inbox scope is restricted by Google */
  readsReplies: boolean;
  /** L4: when the stored permission needs renewing (OAuth only; it is renewed by itself before every send) */
  oauthExpiresAt: string | null;
  username: string; status: 'active' | 'paused' | 'error'; statusReason: string; signatureName: string; signatureTitle: string; company: string; postalAddress: string; timezone: string;
  windowStart: number; windowEnd: number; dailyFirstMax: number; dailyMax: number; startedAt: string; dns: DnsCheck | null; lastPollAt: string | null; lastSendAt: string | null; lastError: string;
  today: { first: number; total: number; firstCap: number; totalCap: number };
}
export interface SuppressionView { id: string; kind: 'email' | 'domain'; hint: string; reason: string; createdAt: string }
export interface MailboxTestResult { ok: boolean; smtp: { ok: boolean; error: string }; imap: { ok: boolean; error: string }; dns: DnsCheck }
export interface DnsCheck { spf: 'pass' | 'missing' | 'weak'; dmarc: 'pass' | 'missing' | 'none'; dkim: 'found' | 'unknown'; checkedAt: string; notes: string[] }
export interface LinkSettings { mode: 'approve' | 'auto'; mailboxId: string | null; autoDailyMax: number }
export const DEFAULT_LINK_SETTINGS: LinkSettings = { mode: 'approve', mailboxId: null, autoDailyMax: 5 };
export interface LinkBuildingKpis { wonMonth: number; wonAll: number; sentMonth: number; contactedDomains: number; replied: number; positive: number;
  /** B11-1: null until the sample reaches `OUTREACH_RATE_MIN`, the page shows `rates.*.note` instead of an invented percentage */
  replyRate: number | null; winRate: number | null; bounceRate: number | null;
  /** B11-1: the same three figures with what they were counted over and whether they may be read at all */
  rates: { reply: RateRead; win: RateRead; bounce: RateRead };
  unsubscribes: number; medianDaysToLink: number | null; byType: { type: string; sent: number; replied: number; won: number }[] }
export interface LinkBuildingData {
  settings: LinkSettings; mailboxes: MailboxView[]; drafts: OutreachDraft[]; sequences: OutreachSequence[]; kpis: LinkBuildingKpis;
  listings: { id: string; name: string; category: string; status: string; profileUrl: string; rel: string; competitors: string[]; submitUrl: string; priority: number; why: string; checkedAt: string; submittedAt: string; note: string }[];
  redirects: { from: string; to: string; reason: string }[];
  impact: { refDomain: string; fromUrl: string; targetUrl: string; t0: string; weeks: number; basePosition: number | null; position: number | null; pageChange: number | null; controlChange: number | null; effect: number | null; verdict: string; note: string; keyword: string }[];
  /** G12 (2026-10-13): the same control-group reading for a page that went live or was rewritten (never mixed into the link readings) */
  pageChanges: { targetUrl: string; change: string; t0: string; weeks: number; basePosition: number | null; position: number | null; pageChange: number | null; controlChange: number | null; effect: number | null; verdict: string; note: string; keyword: string }[];
  /** L7: the reply rate per subject style, or why it may not be read yet */
  subjectAb: SubjectAbRead;
  lastRun: string | null; suppressed: number; canSend: { ok: boolean; why: string };
}

// ---- L7: subject-line A/B (mirrors n8n/seo-agent/v5/code/_ab.js, the two must change together) ----
// The engine gives every batch two subjects in different styles and hands them out in turn (A, B, A, B ...), so both go out about as often.
// Here they are read back: first e-mails sent per style, people who replied, and the reply rate. **Under SUBJECT_AB_MIN_SENDS first
// e-mails per style nothing may be called better**, at a dozen sends a few points of difference is noise, so the counts are shown with
// "not enough sends yet" instead of a winner. Measuring never changes what is sent: a person approves every pitch.
export const SUBJECT_AB_MIN_SENDS = 30;
export const SUBJECT_AB_MIN_GAP = 2;
export const SUBJECT_VARIANTS = ['A', 'B'] as const;
export type SubjectVariant = (typeof SUBJECT_VARIANTS)[number];
export const subjectVariantFor = (i: number): SubjectVariant => SUBJECT_VARIANTS[Math.abs(Math.round(i)) % SUBJECT_VARIANTS.length]!;
export interface SubjectAbRow { variant: SubjectVariant; subject: string; sent: number; replied: number; replyRate: number | null; enough: boolean }
export interface SubjectAbRead {
  rows: SubjectAbRow[];
  enough: boolean;
  leader: SubjectVariant | '';
  verdict: 'nothing_sent' | 'not_enough' | 'no_difference' | 'ahead';
  minSends: number;
  gap: number | null;
  note: string;
  counts: string;
}
interface SubjectAbInput { subjectVariant?: string | null; startedAt: string | null; replyAt: string | null; replyClass: string | null; steps: OutreachStep[] }
/** the reply rate per subject style, and whether it may be read at all */
export function subjectAbStats(sequences: SubjectAbInput[]): SubjectAbRead {
  const rate = (replied: number, sent: number) => (sent > 0 ? Math.round((1000 * replied) / sent) / 10 : null);
  const rows: SubjectAbRow[] = SUBJECT_VARIANTS.map((v) => {
    const mine = sequences.filter((q) => String(q.subjectVariant ?? '').toUpperCase() === v && q.startedAt);
    const replied = mine.filter((q) => q.replyAt && q.replyClass && q.replyClass !== 'out_of_office').length;
    return { variant: v, subject: (mine[0]?.steps?.[0]?.subject ?? '').slice(0, 140), sent: mine.length, replied, replyRate: rate(replied, mine.length), enough: mine.length >= SUBJECT_AB_MIN_SENDS };
  });
  const live = rows.filter((r) => r.sent > 0);
  const counts = rows.map((r) => `${r.variant}: ${r.replied} ${r.replied === 1 ? 'reply' : 'replies'} from ${r.sent} e-mail${r.sent === 1 ? '' : 's'}`).join(' · ');
  if (!live.length) return { rows, enough: false, leader: '', verdict: 'nothing_sent', minSends: SUBJECT_AB_MIN_SENDS, gap: null, note: 'No first e-mails have gone out yet, so there is nothing to compare.', counts };
  const enough = live.length >= 2 && live.every((r) => r.enough);
  if (!enough) {
    const short = rows.filter((r) => r.sent < SUBJECT_AB_MIN_SENDS).map((r) => `${r.variant} (${r.sent} of ${SUBJECT_AB_MIN_SENDS})`).join(', ');
    return { rows, enough: false, leader: '', verdict: 'not_enough', minSends: SUBJECT_AB_MIN_SENDS, gap: null,
      note: `Not enough sends yet to call a subject better: ${SUBJECT_AB_MIN_SENDS} first e-mails per variant are needed, and ${short} ${short.includes(',') ? 'are' : 'is'} short. ${counts}.`, counts };
  }
  const sorted = [...live].sort((a, b) => (b.replyRate ?? 0) - (a.replyRate ?? 0));
  const gap = Math.round(((sorted[0]!.replyRate ?? 0) - (sorted[sorted.length - 1]!.replyRate ?? 0)) * 10) / 10;
  if (gap < SUBJECT_AB_MIN_GAP) return { rows, enough: true, leader: '', verdict: 'no_difference', minSends: SUBJECT_AB_MIN_SENDS, gap, note: `Both subjects reply about equally well (${counts}): keep either.`, counts };
  return { rows, enough: true, leader: sorted[0]!.variant, verdict: 'ahead', minSends: SUBJECT_AB_MIN_SENDS, gap,
    note: `Subject ${sorted[0]!.variant} is ahead by ${gap} points (${counts}). One test on this many e-mails is a hint, not a rule.`, counts };
}

// ---- rules ----
/** first e-mails a mailbox may send today: 5 in its first week, 10 in the second, then the set cap (at most 30), steady volume builds trust */
export function warmupCap(startedAt: Date, now: Date, cap: number): number {
  const weeks = Math.floor((now.getTime() - startedAt.getTime()) / (7 * 864e5));
  return Math.max(0, Math.min(30, weeks <= 0 ? Math.min(5, cap) : weeks === 1 ? Math.min(10, cap) : cap));
}
/** the local calendar of a time zone: weekday 0-6 (Sunday 0), hour, and the date */
export function localParts(d: Date, timeZone: string): { weekday: number; hour: number; date: string } {
  try {
    const f = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', hour: '2-digit', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' });
    const parts = Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
    return { weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday), hour: Number(parts.hour), date: `${parts.year}-${parts.month}-${parts.day}` };
  } catch {
    return { weekday: d.getUTCDay(), hour: d.getUTCHours(), date: d.toISOString().slice(0, 10) };
  }
}
/** Monday-Friday, between the window's hours, in the mailbox's time zone */
export function inSendWindow(now: Date, timeZone: string, start = 8, end = 17): boolean {
  const p = localParts(now, timeZone);
  return p.weekday >= 1 && p.weekday <= 5 && p.hour >= start && p.hour < end;
}
/** n working days (Monday-Friday) after a date */
export function addWorkingDays(from: Date, n: number): Date {
  const d = new Date(from.getTime()); let left = Math.max(0, Math.round(n));
  while (left > 0) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w !== 0 && w !== 6) left--; }
  return d;
}
/** a random pause of 4-9 minutes between two e-mails from one mailbox (never in batches); seeded so a retry does not shorten it */
export function sendGap(seed: string): number {
  let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (4 + (h % 6)) * 60_000;
}
export const EU_UK = new Set(['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'IS', 'LI', 'NO']);
export interface ConsentGate { needed: boolean; why: string }
const ROLE = /^(info|hello|hi|contact|team|office|enquir(y|ies)|inquir(y|ies)|admin|marketing|partnerships?|partner|sales|business|support|help|editor|editors|editorial|news|newsroom|press|media|pr|content|stories|tips|submissions?|contribute|features)@/i;
/** Countries whose law asks for consent before a promotional e-mail (summary, not legal advice): Germany and Austria (even B2B), Saudi
 *  Arabia (no prior interaction), and named people in the UAE (consent-based law; a role address like editor@ is treated as a business inbox). */
export function consentGate(country: string, email: string): ConsentGate {
  const c = String(country || '').toUpperCase(); const role = ROLE.test(String(email || ''));
  if (c === 'DE' || c === 'AT') return { needed: true, why: 'Germany and Austria require prior consent for promotional e-mail, also between businesses.' };
  if (c === 'SA') return { needed: true, why: "Saudi Arabia's data law requires consent for promotional messages without a prior relationship." };
  if (c === 'AE' && !role) return { needed: true, why: "The UAE's data law is consent-based: write to a named person only with their consent or an existing relationship (editor@ or info@ inboxes are fine)." };
  return { needed: false, why: '' };
}
/** the lines every e-mail ends with: who is writing, from where, and how to stop it (CAN-SPAM, GDPR Art. 14, PECR)
 *
 *  **B11-3 (2026-10-15, benchmark area 11).** The postal address used to go out on the FIRST e-mail only, and the two follow-ups
 *  carried the signature and the opt-out without it. CAN-SPAM's requirements are written per **message**, "Include your valid
 *  physical postal address" is one of the seven, and the Act's definition of a commercial electronic mail message covers every
 *  message whose primary purpose is commercial advertising, not only the first one in a thread
 *  (https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business). A link pitch is such a message and so
 *  is its follow-up, so two of every three e-mails we sent were short of a requirement that costs one line. The address is on all
 *  of them now; a mailbox with no postal address on file cannot start a conversation at all (`canSend`).
 *  The GDPR Art. 14 line stays on the first contact, where the Article puts it ("at the time of the first communication").
 */
export function footerLines(m: { name: string; title: string; company: string; postalAddress: string }, opts: { firstEmail: boolean; country: string; foundOn?: string }): string[] {
  const who = [m.name, m.title].filter(Boolean).join(', ');
  const lines = ['', '--', [who, m.company].filter(Boolean).join(' · ')];
  if (m.postalAddress) lines.push(m.postalAddress);   // B11-3: every commercial message, not only the first
  if (opts.firstEmail && EU_UK.has(String(opts.country || '').toUpperCase()) && opts.foundOn) lines.push(`I found your address on ${opts.foundOn}.`);
  lines.push(opts.firstEmail ? 'If you would rather not hear from me, reply "no" and I won\'t write again.' : 'Reply "no" and I won\'t write again.');
  return lines;
}

// ---- B11-1 (2026-10-15, benchmark area 11): a rate is measured, or it says it is not yet ------------------------------------
// The Link building page printed a reply rate, a win rate and a bounce rate from whatever had been sent, "33.3%" off one reply in
// three, and a red "50.0% bounced" badge off a single bounce in two e-mails, on the same screen as the subject-line A/B, which
// refuses to name a better subject under 30 first e-mails per style. The discipline was in one corner of the page and nowhere else
// (INVARIANTS rule 1: a figure is measured, modelled, or not available, and says which).
// The floors are derived, not chosen:
//  * **bounce, 50.** Criterion 4C.5 and every mailbox provider's guidance put the limit at ~2%. One bounce in 50 IS 2%, so below 50
//    sends the rate cannot land on the threshold it is judged against: it can only be 0% or something far above it.
//  * **reply, 20.** The smallest list size the published data even separates is 21-50 (Hunter, State of Cold Email, 31M e-mails:
//    6.2% for lists of 21-50 against 2.4% for 500+). Under 20 first e-mails there is no rate to compare with it.
//  * **win, 25 contacted sites.** The only published link-building funnel with its arithmetic shown is Hunter's own, 1,000
//    prospects e-mailed, ~50 replies, ~13 published links, a 1.3% prospect-to-backlink rate
//    (https://hunter.io/blog/link-building-outreach-guide/, April 2026). At rates like that even 25 sites expects well under one
//    link, so the figure is shown with that base rate beside it and never on its own.
// Below the floor the counts are still shown, with how many more are needed: the customer sees the work, not an invented rate.
export const OUTREACH_RATE_MIN = { reply: 20, win: 25, bounce: 50 } as const;
export type OutreachRateKind = keyof typeof OUTREACH_RATE_MIN;
export interface RateRead {
  /** the percentage, or null when the sample is too small to read one from */
  value: number | null;
  /** measured (enough sample) or not available (not enough yet), never modelled: this one is counted or it is withheld */
  basis: 'measured' | 'unavailable';
  hits: number;
  sample: number;
  min: number;
  /** one sentence for the customer: the rate and what it was counted over, or how many more are needed */
  note: string;
}
/** a rate the page may print, or the counts and the reason it may not be read yet */
export function outreachRate(kind: OutreachRateKind, hits: number, sample: number, unit: string): RateRead {
  const h = Math.max(0, Math.round(hits));
  const n = Math.max(0, Math.round(sample));
  const min = OUTREACH_RATE_MIN[kind];
  const counted = `${h} of ${n} ${n === 1 ? unit.replace(/s$/, '') : unit}`;
  if (n < min) {
    return { value: null, basis: 'unavailable', hits: h, sample: n, min,
      note: n === 0 ? `Nothing to count yet: ${unit} start this at ${min}.` : `${counted} so far, too few to read a rate from (${min} needed).` };
  }
  return { value: Math.round((1000 * Math.min(h, n)) / n) / 10, basis: 'measured', hits: h, sample: n, min, note: `${counted}.` };
}
/** subject of a follow-up in the same thread */
export const replySubject = (first: string) => (/^re:/i.test(first.trim()) ? first.trim() : `Re: ${first.trim()}`);
/** automatic messages by their headers (RFC 3834 and common vendor headers) */
export function isAutoReply(h: Record<string, string>, subject: string): boolean {
  const g = (k: string) => String(h[k.toLowerCase()] ?? '').toLowerCase();
  if (g('auto-submitted') && g('auto-submitted') !== 'no') return true;
  if (g('x-autoreply') || g('x-autorespond') || g('x-autoreply-from') || /oof|autoreply|all/.test(g('x-auto-response-suppress'))) return true;
  if (/^(bulk|junk|list|auto_reply)$/.test(g('precedence'))) return true;
  return /^(auto(matic)?[ -]?(reply|response)|out of (the )?office|ooo\b|abwesend|absence|away from|on leave|vacation)/i.test(subject.trim());
}
/** a delivery failure report (bounce) */
export function isBounce(h: Record<string, string>, from: string, contentType: string): boolean {
  return /multipart\/report/i.test(contentType) && /delivery-status/i.test(contentType) || /^(mailer-daemon|postmaster|mail delivery (sub)?system)\b/i.test(from.replace(/^.*<|>.*$/g, '').split('@')[0] ?? '') || /^(mailer-daemon|postmaster)@/i.test(from) || /(undeliverable|delivery status notification \(failure\)|mail delivery failed|returned mail|failure notice)/i.test(String(h['subject'] ?? ''));
}
/** the domain of an address */
export const emailDomain = (e: string) => String(e || '').toLowerCase().split('@')[1] ?? '';
/** The return date of an out-of-office message ("until 20 October", "back on 2026-10-20", "returning 20/10"), when the Reply Reader is not
 *  available; the next date of that day after `now` (a date already past this year means next year). */
export function parseReturnDate(text: string, now: Date): Date | null {
  const t = String(text || '').toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, '$1');
  const M = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const at = (y: number, m: number, d: number) => { const x = new Date(Date.UTC(y, m, d, 9)); return x.getUTCMonth() === m && x.getUTCDate() === d ? x : null; };
  const future = (m: number, d: number, y?: number) => { if (y) return at(y, m, d); const x = at(now.getUTCFullYear(), m, d); return x && x.getTime() < now.getTime() - 864e5 ? at(now.getUTCFullYear() + 1, m, d) : x; };
  const cue = /(until|till|back|return(ing)?|from|on leave to|away to|reachable (again )?(on|from))\b[^.\n]{0,40}/g;
  for (const c of t.matchAll(cue)) {
    const s = c[0];
    let m = s.match(/(\d{4})-(\d{2})-(\d{2})/); if (m) { const x = at(+m[1]!, +m[2]! - 1, +m[3]!); if (x) return x; }
    m = s.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:\s+(\d{4}))?/); if (m) { const x = future(M.indexOf(m[2]!), +m[1]!, m[3] ? +m[3] : undefined); if (x) return x; }
    m = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?/); if (m) { const x = future(M.indexOf(m[1]!), +m[2]!, m[3] ? +m[3] : undefined); if (x) return x; }
    m = s.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/); if (m) { const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : undefined; const x = future(+m[2]! - 1, +m[1]!, y); if (x) return x; }   // day / month (most of the world)
  }
  return null;
}

// ---- which stored outreach draft may still be offered (P34-1, 2026-10-12) ----
// The AI Growth report of 2026-10-12 counted eight "outreach drafts written" and printed a pitch to a government portal signed with the
// website's domain, drafts written on 2026-10-02, before the gates that refuse government sites, competitors and bare homepages and
// that take the business name from the site model. Nothing had written them that week: the counter read the stored prospect row.
// Every writer now stamps `drafted_at`. A stored draft with no stamp, or one from before the gates, is **superseded**: it is not shown,
// not counted and not offered to the owner; the engine clears it on its next run and says so in the row's note. A draft that was
// already sent (the prospect is contacted or won) is part of the record and is never withdrawn.
// The engine applies the identical rule in n8n/seo-agent/v5/code/_drafts.js, the two must stay in step.
export const DRAFT_GATES_AT = '2026-10-12';
export interface StoredDraftRow {
  outreach_subject?: string | null; outreach_body?: string | null; drafted_at?: string | null;
  status?: string | null; contacted_at?: string | null;
}
const draftStr = (v: unknown) => String(v ?? '').trim();
/** was this draft sent? then it stays on the record whenever it was written */
export const draftWasSent = (row: StoredDraftRow | null | undefined): boolean => {
  const r = row ?? {};
  return !!draftStr(r.contacted_at) || ['contacted', 'won'].includes(draftStr(r.status).toLowerCase());
};
/** a stored draft written before the current outreach rules (or with no date at all), and never sent */
export const draftSuperseded = (row: StoredDraftRow | null | undefined): boolean => {
  const r = row ?? {};
  if (!draftStr(r.outreach_body) || draftWasSent(r)) return false;
  const at = draftStr(r.drafted_at).slice(0, 10);
  return !at || at < DRAFT_GATES_AT;
};
/** the draft to show for a prospect row, or null when there is none to offer */
export function prospectDraft(row: StoredDraftRow | null | undefined): { subject: string; body: string; draftedAt: string } | null {
  const r = row ?? {};
  if (!draftStr(r.outreach_body) || draftSuperseded(r)) return null;
  return { subject: draftStr(r.outreach_subject), body: draftStr(r.outreach_body), draftedAt: draftStr(r.drafted_at) };
}
