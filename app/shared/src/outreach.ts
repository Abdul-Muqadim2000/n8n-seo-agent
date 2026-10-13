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
  /** G12 (2026-10-13): what was read — `link` (a won link; ref_domain set) or `page_change` (a page that went live or was rewritten).
   * Rows written before this change have neither, and are link readings. */
  kind?: string;
  /** G12: a page change says what changed — published | rewritten */
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
/** scheduled (approved, waiting for the window) → active (sent, waiting for the next step) → replied | bounced | stopped | won | finished (no reply) | failed */
export const SEQUENCE_STATUSES = ['scheduled', 'active', 'paused', 'replied', 'bounced', 'stopped', 'won', 'finished', 'failed'] as const;
export type SequenceStatus = (typeof SEQUENCE_STATUSES)[number];
export const SEQUENCE_LABEL: Record<SequenceStatus, string> = { scheduled: 'Scheduled', active: 'Sent, waiting', paused: 'Paused', replied: 'Replied', bounced: 'Bounced', stopped: 'Stopped', won: 'Won', finished: 'No reply', failed: 'Failed' };

// ---- API shapes ----
export interface OutreachStep { step: number; waitDays: number; subject: string; body: string }
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
  nextAt: string | null; approvedAt: string | null; startedAt: string | null; lastSentAt: string | null; targetUrl: string; pageUrl: string;
  replyAt: string | null; replyClass: ReplyClass | null; replySummary: string; suggestedReply: string; replyFrom: string; oooUntil: string | null; wonAt: string | null; error: string;
  messages: OutreachMessageView[];
}
export interface MailboxView {
  id: string; label: string; fromName: string; fromEmail: string; provider: 'smtp'; smtpHost: string; smtpPort: number; smtpSecure: boolean; imapHost: string; imapPort: number; imapSecure: boolean;
  username: string; status: 'active' | 'paused' | 'error'; statusReason: string; signatureName: string; signatureTitle: string; company: string; postalAddress: string; timezone: string;
  windowStart: number; windowEnd: number; dailyFirstMax: number; dailyMax: number; startedAt: string; dns: DnsCheck | null; lastPollAt: string | null; lastSendAt: string | null; lastError: string;
  today: { first: number; total: number; firstCap: number; totalCap: number };
}
export interface SuppressionView { id: string; kind: 'email' | 'domain'; hint: string; reason: string; createdAt: string }
export interface MailboxTestResult { ok: boolean; smtp: { ok: boolean; error: string }; imap: { ok: boolean; error: string }; dns: DnsCheck }
export interface DnsCheck { spf: 'pass' | 'missing' | 'weak'; dmarc: 'pass' | 'missing' | 'none'; dkim: 'found' | 'unknown'; checkedAt: string; notes: string[] }
export interface LinkSettings { mode: 'approve' | 'auto'; mailboxId: string | null; autoDailyMax: number }
export const DEFAULT_LINK_SETTINGS: LinkSettings = { mode: 'approve', mailboxId: null, autoDailyMax: 5 };
export interface LinkBuildingKpis { wonMonth: number; wonAll: number; sentMonth: number; contactedDomains: number; replied: number; positive: number; replyRate: number | null; winRate: number | null;
  bounceRate: number | null; unsubscribes: number; medianDaysToLink: number | null; byType: { type: string; sent: number; replied: number; won: number }[] }
export interface LinkBuildingData {
  settings: LinkSettings; mailboxes: MailboxView[]; drafts: OutreachDraft[]; sequences: OutreachSequence[]; kpis: LinkBuildingKpis;
  listings: { id: string; name: string; category: string; status: string; profileUrl: string; rel: string; competitors: string[]; submitUrl: string; priority: number; why: string; checkedAt: string; submittedAt: string; note: string }[];
  redirects: { from: string; to: string; reason: string }[];
  impact: { refDomain: string; fromUrl: string; targetUrl: string; t0: string; weeks: number; basePosition: number | null; position: number | null; pageChange: number | null; controlChange: number | null; effect: number | null; verdict: string; note: string; keyword: string }[];
  /** G12 (2026-10-13): the same control-group reading for a page that went live or was rewritten (never mixed into the link readings) */
  pageChanges: { targetUrl: string; change: string; t0: string; weeks: number; basePosition: number | null; position: number | null; pageChange: number | null; controlChange: number | null; effect: number | null; verdict: string; note: string; keyword: string }[];
  lastRun: string | null; suppressed: number; canSend: { ok: boolean; why: string };
}

// ---- rules ----
/** first e-mails a mailbox may send today: 5 in its first week, 10 in the second, then the set cap (at most 30) — steady volume builds trust */
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
/** the lines every e-mail ends with: who is writing, from where, and how to stop it (CAN-SPAM, GDPR Art. 14, PECR) */
export function footerLines(m: { name: string; title: string; company: string; postalAddress: string }, opts: { firstEmail: boolean; country: string; foundOn?: string }): string[] {
  const who = [m.name, m.title].filter(Boolean).join(', ');
  const lines = ['', '—', [who, m.company].filter(Boolean).join(' · ')];
  if (opts.firstEmail && m.postalAddress) lines.push(m.postalAddress);
  if (opts.firstEmail && EU_UK.has(String(opts.country || '').toUpperCase()) && opts.foundOn) lines.push(`I found your address on ${opts.foundOn}.`);
  lines.push(opts.firstEmail ? 'If you would rather not hear from me, reply "no" and I won\'t write again.' : 'Reply "no" and I won\'t write again.');
  return lines;
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
// website's domain — drafts written on 2026-10-02, before the gates that refuse government sites, competitors and bare homepages and
// that take the business name from the site model. Nothing had written them that week: the counter read the stored prospect row.
// Every writer now stamps `drafted_at`. A stored draft with no stamp, or one from before the gates, is **superseded**: it is not shown,
// not counted and not offered to the owner; the engine clears it on its next run and says so in the row's note. A draft that was
// already sent (the prospect is contacted or won) is part of the record and is never withdrawn.
// The engine applies the identical rule in n8n/seo-agent/v5/code/_drafts.js — the two must stay in step.
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
