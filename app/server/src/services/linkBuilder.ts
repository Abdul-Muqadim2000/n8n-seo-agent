import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import {
  addWorkingDays,
  anchorDisplay,
  consentGate,
  DEFAULT_LINK_SETTINGS,
  draftGate,
  emailDomain,
  isRetiredProspect,
  linkStates,
  linkStatusCounts,
  manualConsentGate,
  n8nSiteId,
  OPEN_SEQUENCE_STATUSES,
  outreachRate,
  subjectAbStats,
  warmupCap,
  type LinkBuildingData,
  type LinkBuildingKpis,
  type LinkImpactRow,
  type LinkOutreachRow,
  type LinkSettings,
  type ListingRow,
  type MailboxView,
  type OutreachContact,
  type OutreachDraft,
  type OutreachSequence,
  type OutreachStep,
  type LinkStatusCounts,
  type LinkStatusRow,
  type LinkStatusSequence,
  type ProfileRow,
  type ProspectRow,
  type ReplyClass,
  type Role,
  type SequenceStatus,
} from '@seo/shared';
import { db, schema } from '../db';
import type { MailboxRow, OrgRow, OutreachSequenceRow, SiteRow } from '../db/schema';
import { sha256 } from '../lib/crypto';
import { badRequest, conflict, HttpError, notFound } from '../lib/errors';
import { siteAdmin, siteRows } from '../n8n/client';
import { mxCheck } from './mail';
import { isOauthMailbox } from './mailOauth';

// v4.13 Link Builder (n8n/seo-agent/LINK_BUILDER_SPEC.md §2): what the page shows and what a person can do. The n8n workflow finds,
// qualifies and drafts; this app sends from the company's own mailbox (outreachJobs.ts), reads the replies and keeps the sequences.

const s = (v: unknown) => (v == null ? '' : String(v));
const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const json = <T>(t: unknown, d: T): T => { try { const v = JSON.parse(s(t) || 'null'); return (v ?? d) as T; } catch { return d; } };
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

// ---- opt-outs: a salted hash per company (the address itself is not kept once suppressed) plus a masked hint ----
const hashOf = (orgId: string, value: string) => sha256(orgId + ':' + value.trim().toLowerCase());
const maskEmail = (e: string) => { const [u = '', d = ''] = e.toLowerCase().split('@'); return (u.slice(0, 1) + '***@' + d).slice(0, 120); };
export async function isSuppressed(orgId: string, email: string): Promise<string | null> {
  const e = email.trim().toLowerCase(); const d = emailDomain(e);
  const hit = await db.select({ kind: schema.suppressions.kind, reason: schema.suppressions.reason }).from(schema.suppressions)
    .where(and(eq(schema.suppressions.orgId, orgId), inArray(schema.suppressions.valueHash, [hashOf(orgId, e), hashOf(orgId, d)]))).limit(1);
  return hit[0] ? (hit[0].kind === 'domain' ? `${d} asked not to be contacted` : `this address asked not to be contacted (${hit[0].reason})`) : null;
}
/** FX-LINKS (review R2 M4): a website the company asked never to contact (a domain-level opt-out), whatever address or contact form is used */
export async function isDomainSuppressed(orgId: string, domain: string): Promise<string | null> {
  const d = domain.trim().toLowerCase().replace(/^www\./, '');
  if (!d) return null;
  const hit = await db.select({ kind: schema.suppressions.kind }).from(schema.suppressions)
    .where(and(eq(schema.suppressions.orgId, orgId), eq(schema.suppressions.kind, 'domain'), eq(schema.suppressions.valueHash, hashOf(orgId, d)))).limit(1);
  return hit[0] ? `${d} asked not to be contacted` : null;
}
/** FX-LINKS (review R2 M4): one lock per company around "may a new conversation start?" and its insert (two clicks, two tabs, the sender) */
const outreachLock = (tx: { execute: (q: ReturnType<typeof sql>) => Promise<unknown> }, orgId: string) => tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'alaventra.outreach:' + orgId}))`);
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** the rules every new conversation with a site follows (approve and "I sent it myself" alike): one at a time, and a rest after one that
 *  ended without a reply. Runs inside the company's lock. */
async function conversationRules(tx: Tx, orgId: string, prospectDomain: string): Promise<void> {
  const others = await tx.select().from(schema.outreachSequences).where(and(eq(schema.outreachSequences.orgId, orgId), eq(schema.outreachSequences.prospectDomain, prospectDomain)));
  if (others.some((q) => (OPEN_SEQUENCE_STATUSES as readonly string[]).includes(q.status))) throw conflict(`A conversation with ${prospectDomain} is already going on.`);
  const recent = others.find((q) => q.status === 'finished' && q.lastSentAt && Date.now() - q.lastSentAt.getTime() < 90 * 864e5);
  if (recent) throw conflict(`${prospectDomain} got a sequence without a reply in the last 90 days: give it a rest.`);
}
export async function suppress(orgId: string, kind: 'email' | 'domain', value: string, reason: string) {
  const v = value.trim().toLowerCase(); if (!v) return;
  await db.insert(schema.suppressions).values({ orgId, kind, valueHash: hashOf(orgId, v), hint: kind === 'email' ? maskEmail(v) : v, reason: reason.slice(0, 120) }).onConflictDoNothing();
}

/** The prospect's status in the SEO engine follows the conversation (contacted / replied / won / rejected); a failure is logged, never fatal. */
export async function setProspectStatus(domain: string, prospectDomain: string, type: string, status: 'contacted' | 'replied' | 'won' | 'rejected', note?: string, log?: { warn: (o: object, m: string) => void }) {
  try {
    // FX-LINKS (review R2 M2): the app's own line goes after a note the person wrote (note_mode system), never over it
    await siteAdmin({ action: 'prospect', domain, site_id: n8nSiteId(domain), prospect_domain: prospectDomain, type, status, ...(note ? { note, note_mode: 'system' } : {}), request_id: `app-outreach-${Date.now().toString(36)}` });
  } catch (err) {
    log?.warn({ err: String(err), prospectDomain, status }, 'prospect status not updated in n8n');
  }
}

export function linkSettingsOf(site: SiteRow): LinkSettings {
  const ls = site.linkSettings ?? {};
  return { mode: ls.mode === 'auto' ? 'auto' : 'approve', mailboxId: ls.mailboxId ?? null, autoDailyMax: Math.min(30, Math.max(1, n(ls.autoDailyMax) || DEFAULT_LINK_SETTINGS.autoDailyMax)) };
}

export async function sentCounts(mailboxId: string, since: Date): Promise<{ first: number; total: number }> {
  const r = await db.select({ step: schema.outreachMessages.step, kind: schema.outreachMessages.kind }).from(schema.outreachMessages)
    .where(and(eq(schema.outreachMessages.mailboxId, mailboxId), eq(schema.outreachMessages.direction, 'out'), gte(schema.outreachMessages.at, since), sql`${schema.outreachMessages.error} is null`));
  return { first: r.filter((x) => x.step === 0 && x.kind === 'step').length, total: r.length };
}

export async function mailboxView(m: MailboxRow): Promise<MailboxView> {
  const now = new Date(); const c = await sentCounts(m.id, new Date(now.getTime() - 864e5));
  return { id: m.id, label: m.label, fromName: m.fromName, fromEmail: m.fromEmail, provider: (m.provider as MailboxView['provider']) ?? 'smtp',
    authType: isOauthMailbox(m) ? 'oauth' : 'password', readsReplies: isOauthMailbox(m) ? m.readsReplies : true, oauthExpiresAt: iso(m.oauthExpiresAt), smtpHost: m.smtpHost, smtpPort: m.smtpPort, smtpSecure: m.smtpSecure, imapHost: m.imapHost, imapPort: m.imapPort, imapSecure: m.imapSecure,
    username: m.username, status: (m.status as MailboxView['status']) ?? 'active', statusReason: m.statusReason, signatureName: m.signatureName, signatureTitle: m.signatureTitle, company: m.company, postalAddress: m.postalAddress,
    timezone: m.timezone, windowStart: m.windowStart, windowEnd: m.windowEnd, dailyFirstMax: m.dailyFirstMax, dailyMax: m.dailyMax, startedAt: m.startedAt.toISOString(), dns: (m.dns as MailboxView['dns']) ?? null,
    lastPollAt: iso(m.lastPollAt), lastSendAt: iso(m.lastSendAt), lastError: m.lastError, today: { first: c.first, total: c.total, firstCap: warmupCap(m.startedAt, now, m.dailyFirstMax), totalCap: m.dailyMax } };
}

const contactsOf = (r: LinkOutreachRow): OutreachContact[] => (json<{ email?: string; kind?: string; own?: boolean; source_url?: string }[]>(r.contacts_json, []) || [])
  .filter((c) => c && c.email).map((c) => ({ email: s(c.email).toLowerCase(), kind: (['person', 'editorial', 'general'].includes(s(c.kind)) ? c.kind : 'other') as OutreachContact['kind'], own: !!c.own, sourceUrl: s(c.source_url) }));
const stepsOf = (r: LinkOutreachRow): OutreachStep[] => (json<{ step?: number; wait_days?: number; subject?: string; body?: string; subject_alt?: string; variant?: string }[]>(r.sequence_json, []) || [])
  .map((x, i) => ({ step: i, waitDays: n(x.wait_days), subject: s(x.subject), body: s(x.body), ...(x.subject_alt ? { subjectAlt: s(x.subject_alt) } : {}), ...(x.variant ? { variant: s(x.variant).toUpperCase() } : {}) })).filter((x) => x.body);

export async function sequencesOf(siteId: string): Promise<OutreachSequence[]> {
  const seqs = await db.select().from(schema.outreachSequences).where(eq(schema.outreachSequences.siteId, siteId)).orderBy(desc(schema.outreachSequences.createdAt)).limit(500);
  if (!seqs.length) return [];
  const msgs = await db.select().from(schema.outreachMessages).where(inArray(schema.outreachMessages.sequenceId, seqs.map((x) => x.id))).orderBy(schema.outreachMessages.at);
  return seqs.map((q) => ({ id: q.id, prospectDomain: q.prospectDomain, type: q.prospectType, toEmail: q.toEmail, mailboxId: q.mailboxId, status: q.status as SequenceStatus, step: q.step, steps: q.steps, subjectVariant: q.subjectVariant, nextAt: iso(q.nextAt),
    approvedAt: iso(q.approvedAt), startedAt: iso(q.startedAt), lastSentAt: iso(q.lastSentAt), targetUrl: q.targetUrl, pageUrl: q.pageUrl, replyAt: iso(q.replyAt), replyClass: (q.replyClass as ReplyClass | null) ?? null,
    replySummary: q.replySummary, suggestedReply: q.suggestedReply, replyFrom: q.replyFrom, oooUntil: iso(q.oooUntil), wonAt: iso(q.wonAt), error: q.error, manual: q.manual,
    messages: msgs.filter((m) => m.sequenceId === q.id).map((m) => ({ id: m.id, direction: m.direction as 'out' | 'in', step: m.step, kind: m.kind, subject: m.subject, body: m.body.slice(0, 6000), from: m.fromEmail, to: m.toEmail, at: m.at.toISOString(), error: m.error })) }));
}

/**
 * FX-LINKS (review R2 M5): a conversation ends as WON when our check has found the link on their page (the engine's prospect row: won, with
 * verified_at, and we wrote to them). A "Mark won" (claimed), a reply saying it is live, or a pitch still sending its follow-ups all close here,
 * so no reply waits for ever and no follow-up goes to a site that already links. Idempotent; returns the sequences as they are now.
 */
export async function settleWonSequences(seqs: OutreachSequence[], prospects: readonly ProspectRow[]): Promise<OutreachSequence[]> {
  const key = (d: string, t: string) => `${d.toLowerCase()}|${t}`;
  const won = new Map(prospects.filter((p) => s(p.status) === 'won' && s(p.verified_at) && s(p.contacted_at)).map((p) => [key(s(p.prospect_domain), s(p.type)), s(p.verified_at)] as const));
  const open = seqs.filter((q) => (OPEN_SEQUENCE_STATUSES as readonly string[]).includes(q.status) && won.has(key(q.prospectDomain, q.type)));
  if (!open.length) return seqs;
  const at = new Map<string, Date>();
  for (const q of open) {
    const t = Date.parse(won.get(key(q.prospectDomain, q.type))!); const wonAt = Number.isFinite(t) ? new Date(t) : new Date();
    at.set(q.id, wonAt);
    await db.update(schema.outreachSequences).set({ status: 'won', wonAt, nextAt: null, updatedAt: new Date() })
      .where(and(eq(schema.outreachSequences.id, q.id), inArray(schema.outreachSequences.status, [...OPEN_SEQUENCE_STATUSES])));
  }
  return seqs.map((q) => (at.has(q.id) ? { ...q, status: 'won' as SequenceStatus, wonAt: at.get(q.id)!.toISOString(), nextAt: null } : q));
}

function kpisOf(seqs: OutreachSequence[], counts: LinkStatusCounts): LinkBuildingKpis {
  const month = new Date().toISOString().slice(0, 7);
  const startedAll = seqs.filter((q) => q.startedAt);
  // CR17-E: a pitch sent by hand ("I sent it myself") counts as a site contacted, but not in the reply / win / bounce rates: its replies
  // reach the person's own inbox, which the app does not read, so it would only pull the rates down
  const started = startedAll.filter((q) => !q.manual);
  const people = started.filter((q) => q.replyAt && q.replyClass && q.replyClass !== 'out_of_office');
  const positive = people.filter((q) => ['interested', 'question', 'says_linked'].includes(q.replyClass!) || q.status === 'won');
  const wonSeq = started.filter((q) => q.status === 'won' && q.wonAt);
  const days = wonSeq.map((q) => (new Date(q.wonAt!).getTime() - new Date(q.startedAt!).getTime()) / 864e5).sort((a, b) => a - b);
  const domains = new Set(started.map((q) => q.prospectDomain));
  const types = [...new Set(startedAll.map((q) => q.type))];
  // B11-1 (benchmark area 11): a rate below its floor is not printed at all. The bounce rate counts e-mails, not conversations, // it is judged against a ~2% limit, and one bounce in 50 IS 2%, so conversations were the wrong denominator for it as well as
  // too small a one.
  const sentAll = seqs.flatMap((q) => q.messages).filter((m) => m.direction === 'out' && !m.error).length;
  const rates = {
    reply: outreachRate('reply', people.length, started.length, 'conversations'),
    win: outreachRate('win', new Set(started.filter((q) => q.status === 'won').map((q) => q.prospectDomain)).size, domains.size, 'sites contacted'),
    bounce: outreachRate('bounce', started.filter((q) => q.status === 'bounced').length, sentAll, 'e-mails sent'),
  };
  return {
    // CR17-E (F9 / C4b): won = we wrote to them and our own check found the link on a clean page (shared link-status.ts); a domain
    // collision (a job listing, a profile, a site nobody was written to) is never a won link
    wonMonth: counts.wonThisMonth, wonAll: counts.won,
    sentMonth: seqs.flatMap((q) => q.messages).filter((m) => m.direction === 'out' && !m.error && m.at.slice(0, 7) === month).length,
    contactedDomains: new Set(startedAll.map((q) => q.prospectDomain)).size, replied: people.length, positive: positive.length,
    replyRate: rates.reply.value, winRate: rates.win.value, bounceRate: rates.bounce.value, rates,
    unsubscribes: started.filter((q) => q.replyClass === 'unsubscribe').length,
    medianDaysToLink: days.length ? Math.round(days[Math.floor((days.length - 1) / 2)]!) : null,
    byType: types.map((t) => ({ type: t, sent: startedAll.filter((q) => q.type === t).length, replied: people.filter((q) => q.type === t).length, won: started.filter((q) => q.type === t && q.status === 'won').length })),
  };
}

/** A filter that keeps the first item of each key (lists are sorted best first before it runs). */
export const firstOf = <T,>(key: (x: T) => string) => {
  const seen = new Set<string>();
  return (x: T): boolean => {
    const k = key(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  };
};

/** CR17-E (owner decision, default): first e-mails a person sends by hand count against the same weekly limit as the app's sender at its
 *  warm-up start (5 a working day): 25 first e-mails a week per company, app and by hand together. */
export const MANUAL_WEEKLY_LIMIT = 25;
/** first e-mails of the company in the last 7 days (the app's sender and "I sent it myself" together) */
export async function firstEmailsThisWeek(orgId: string, now = new Date(), tx?: Tx): Promise<number> {
  const since = new Date(now.getTime() - 7 * 864e5);
  const r = await (tx ?? db).select({ c: sql<number>`count(*)::int` }).from(schema.outreachMessages)
    .where(and(eq(schema.outreachMessages.orgId, orgId), eq(schema.outreachMessages.direction, 'out'), eq(schema.outreachMessages.step, 0), eq(schema.outreachMessages.kind, 'step'), gte(schema.outreachMessages.at, since), sql`${schema.outreachMessages.error} is null`));
  return r[0]?.c ?? 0;
}
/** the business name the pitches carry (the business profile), '' when none is on file */
async function brandOf(domain: string): Promise<string> {
  try { const p = (await siteRows<ProfileRow>('profiles', domain, { max: 5 }))[0]; const b = s(p?.business_name).trim(); return b && b.toLowerCase() !== 'home' ? b : ''; } catch { return ''; }
}
const DRAFT_ORDER: Record<string, number> = { to_review: 0, needs_edit: 1, to_write: 2, needs_contact: 3, no_page: 4, left_out: 5 };
/** CR17-E (F9): the one population behind every link-building count (the Links page, the Backlinks page, the Pipeline row, the recommendations) */
export function linkStatusOf(outreach0: readonly LinkOutreachRow[], prospects0: readonly ProspectRow[], seqs: readonly LinkStatusSequence[]): LinkStatusRow[] {
  // CR17-F (C5, wired by the integrator): a prospect retired with the AI question it came from (never pitched) is kept for the record and
  // never offered: neither it nor its pitch row is counted or listed (the engine skips it the same way, LB Plan / LB Page Requests / LB Assemble)
  const retired = new Set(prospects0.filter(isRetiredProspect).map((p) => `${s(p.prospect_domain).toLowerCase()}|${s(p.type)}`));
  const prospects = prospects0.filter((p) => !isRetiredProspect(p));
  const outreach = outreach0.filter((r) => !retired.has(`${s(r.prospect_domain).toLowerCase()}|${s(r.type)}`));
  return linkStates({
    outreach: outreach.map((r) => ({ prospect_domain: s(r.prospect_domain), type: s(r.type), status: s(r.status), fit_reason: s(r.fit_reason), reason_code: s(r.reason_code), sequence_json: s(r.sequence_json), checked_at: s(r.checked_at) })),
    prospects: prospects.map((p) => ({ prospect_domain: s(p.prospect_domain), type: s(p.type), status: s(p.status), contacted_at: s(p.contacted_at), won_at: s(p.won_at), verified_at: s(p.verified_at) })),
    sequences: seqs.map((q) => ({ prospectDomain: q.prospectDomain, type: q.type, status: q.status, startedAt: q.startedAt, approvedAt: q.approvedAt, replyAt: q.replyAt, replyClass: q.replyClass, wonAt: q.wonAt })),
  });
}

export async function linkBuildingData(org: OrgRow, site: SiteRow, role: Role): Promise<LinkBuildingData> {
  const d = site.domain;
  const [outreach, prospects, listings, impact, mbs, seqs0, supp, brand, weekFirst] = await Promise.all([
    siteRows<LinkOutreachRow>('linkOutreach', d, { max: 1500 }), siteRows<ProspectRow>('prospects', d, { max: 1500 }), siteRows<ListingRow>('listings', d, { max: 200 }), siteRows<LinkImpactRow>('linkImpact', d, { max: 300 }),
    db.select().from(schema.mailboxes).where(eq(schema.mailboxes.orgId, org.id)), sequencesOf(site.id),
    db.select({ c: sql<number>`count(*)::int` }).from(schema.suppressions).where(eq(schema.suppressions.orgId, org.id)),
    brandOf(d), firstEmailsThisWeek(org.id),
  ]);
  const seqs = await settleWonSequences(seqs0, prospects).catch(() => seqs0);
  const settings = linkSettingsOf(site);
  const statusOf = new Map(prospects.map((p) => [s(p.prospect_domain) + '|' + s(p.type), s(p.status) || 'new']));
  // CR17-E (F9): one state per pitch (shared link-status.ts); the cards are the pitches before the first e-mail, and the sites left out
  // (a website-level verdict covers every pitch of that website; a page-level one next to a live pitch of the same website is not listed)
  const states = linkStatusOf(outreach, prospects, seqs);
  const stateBy = new Map(states.map((x) => [x.key, x]));
  const counts = linkStatusCounts(states);
  const drafts: OutreachDraft[] = outreach.filter((r) => s(r.type) !== 'redirect')
    .map((r) => ({ r, st: stateBy.get(`${s(r.prospect_domain).toLowerCase()}|${s(r.type)}`) }))
    .filter(({ st }) => !!st && !st.hidden && st.state in DRAFT_ORDER)
    .map(({ r, st }) => { const contacts = contactsOf(r); const ck = json<{ dead?: { url?: string; anchor?: string } }>(r.checks_json, {}) || {};
      const a = anchorDisplay({ anchorText: s(r.anchor_text), anchorHint: s(r.anchor_hint), targetUrl: s(r.target_url) }, brand, d);
      return { prospectDomain: s(r.prospect_domain), type: s(r.type), status: st!.state === 'left_out' ? 'not_fit' : s(r.status), prospectStatus: statusOf.get(s(r.prospect_domain) + '|' + s(r.type)) ?? 'new', score: n(r.score), fit: n(r.fit),
        fitReason: st!.state === 'left_out' && st!.reason ? st!.reason : s(r.fit_reason),
        pageUrl: s(r.page_url), pageTitle: s(r.page_title), evidence: s(r.evidence), contacts, contactFormUrl: s(r.contact_form_url), country: s(r.country), language: s(r.language), targetUrl: s(r.target_url), targetReason: s(r.target_reason),
        anchorHint: a.kind, anchorText: a.text, steps: stepsOf(r), deadline: s(r.deadline), draftedAt: s(r.drafted_at), checkedAt: s(r.checked_at), deadLink: ck.dead?.url ? { url: s(ck.dead.url), anchor: s(ck.dead.anchor) } : null,
        consent: consentGate(s(r.country), contacts[0]?.email ?? ''), state: st!.state, reasonCode: st!.reasonCode }; })
    .sort((a, b) => (DRAFT_ORDER[a.state] ?? 9) - (DRAFT_ORDER[b.state] ?? 9) || b.score * (0.5 + b.fit) - a.score * (0.5 + a.fit))
    // B8 (pre-launch run 2026-10-21): the page rendered two cards for one prospect and kind (a React duplicate-key error): the best one stays
    .filter(firstOf((x) => `${x.prospectDomain}|${x.type}`));
  const mailboxes = await Promise.all(mbs.map(mailboxView));
  const active = mailboxes.find((m) => m.id === settings.mailboxId && m.status === 'active') ?? mailboxes.find((m) => m.status === 'active');
  const canSend = !mailboxes.length ? { ok: false, why: 'Connect a mailbox in company settings > Mailboxes: pitches go out from your own address.' }
    : !active ? { ok: false, why: 'Your mailbox is paused or has an error: check it in company settings > Mailboxes.' }
    : !active.postalAddress ? { ok: false, why: 'Add your postal address to the mailbox: every e-mail must carry it, the follow-ups too (CAN-SPAM).' }
    // B11-4: the same refusal the sender makes, said here before anyone approves a pitch, neither SPF nor DKIM on the From domain
    : active.dns && active.dns.spf === 'missing' && active.dns.dkim === 'unknown'
      ? { ok: false, why: `${active.fromEmail.split('@')[1] ?? 'Your sending domain'} publishes no SPF record and no DKIM key we can find: receiving servers cannot tell your mail from a forgery. Add one of them in company settings > Mailboxes before new pitches go out.` }
    : role === 'viewer' ? { ok: false, why: 'Viewers cannot send.' } : { ok: true, why: '' };
  return {
    settings, mailboxes, drafts, sequences: seqs, kpis: kpisOf(seqs, counts), subjectAb: subjectAbStats(seqs), counts, brand, manualWeek: { sent: weekFirst, limit: MANUAL_WEEKLY_LIMIT },
    listings: listings.map((l) => ({ id: s(l.listing_id), name: s(l.name), category: s(l.category), status: s(l.status), profileUrl: s(l.profile_url), rel: s(l.rel), competitors: s(l.competitors).split(/,\s*/).filter(Boolean), submitUrl: s(l.submit_url),
      priority: n(l.priority), why: s(l.why), checkedAt: s(l.checked_at), submittedAt: s(l.submitted_at), note: s(l.note) })).sort((a, b) => a.priority - b.priority),
    redirects: outreach.filter((r) => s(r.type) === 'redirect').map((r) => ({ from: s(r.page_url), to: s(r.target_url), reason: s(r.target_reason) })).filter(firstOf((r) => r.from)),
    // G12 (2026-10-13): the table now holds two kinds of reading, won links and page changes. They are never mixed: a page that went
    // live is not a link. Rows written before the `kind` column exist are link readings (they all had a linking site).
    impact: impact.filter((r) => s(r.kind) !== 'page_change').map((r) => ({ refDomain: s(r.ref_domain), fromUrl: s(r.from_url), targetUrl: s(r.target_url), t0: s(r.t0), weeks: n(r.weeks), basePosition: r.base_position == null ? null : n(r.base_position), position: r.position == null ? null : n(r.position),
      pageChange: r.page_change == null ? null : n(r.page_change), controlChange: r.control_change == null ? null : n(r.control_change), effect: r.effect == null ? null : n(r.effect), verdict: s(r.verdict), note: s(r.note), keyword: s(r.keyword) }))
      .sort((a, b) => b.weeks - a.weeks),
    pageChanges: impact.filter((r) => s(r.kind) === 'page_change').map((r) => ({ targetUrl: s(r.target_url), change: s(r.change) || 'published', t0: s(r.t0), weeks: n(r.weeks), basePosition: r.base_position == null ? null : n(r.base_position), position: r.position == null ? null : n(r.position),
      pageChange: r.page_change == null ? null : n(r.page_change), controlChange: r.control_change == null ? null : n(r.control_change), effect: r.effect == null ? null : n(r.effect), verdict: s(r.verdict), note: s(r.note), keyword: s(r.keyword) }))
      .sort((a, b) => b.t0.localeCompare(a.t0)),
    lastRun: outreach.map((r) => s(r.checked_at)).sort().pop() || null, suppressed: supp[0]?.c ?? 0, canSend,
  };
}

// ---- actions ----
export interface ApproveInput { prospectDomain: string; type: string; toEmail: string; steps: OutreachStep[]; consent?: boolean; mailboxId?: string | null }
/** A person (or the automatic mode) approves a drafted sequence: checks, then it waits for the sender (sending window, daily limits). */
export async function approve(org: OrgRow, site: SiteRow, userId: string | null, a: ApproveInput): Promise<OutreachSequenceRow> {
  const settings = linkSettingsOf(site);
  const mbs = await db.select().from(schema.mailboxes).where(eq(schema.mailboxes.orgId, org.id));
  const mb = mbs.find((m) => m.id === (a.mailboxId ?? settings.mailboxId) && m.status === 'active') ?? mbs.find((m) => m.status === 'active');
  if (!mb) throw new HttpError(409, mbs.length ? 'Your mailbox is paused or has an error: check it in company settings > Mailboxes.' : 'Connect a mailbox first (company settings > Mailboxes).', 'no_mailbox');
  if (!mb.postalAddress.trim()) throw new HttpError(409, 'Add your postal address to the mailbox first: every pitch must carry it.', 'no_address');
  const to = a.toEmail.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(to)) throw badRequest('Choose a valid e-mail address.');
  const supp = (await isSuppressed(org.id, to)) ?? (await isDomainSuppressed(org.id, a.prospectDomain)); if (supp) throw new HttpError(409, `Not sent: ${supp}.`, 'suppressed');
  const rows = await siteRows<LinkOutreachRow>('linkOutreach', site.domain, { extra: [{ columnName: 'prospect_domain', condition: 'eq', value: a.prospectDomain }], fresh: true });
  const row = rows.find((r) => s(r.type) === a.type);
  if (!row) throw notFound(`${a.prospectDomain} is not in the link-building list.`);
  const gate = consentGate(s(row.country), to);
  if (gate.needed && !a.consent) throw new HttpError(409, gate.why + ' Tick "I have their consent or we already work together" to send.', 'consent_needed');
  const steps = a.steps.map((x, i) => ({ step: i, waitDays: Math.min(30, Math.max(i === 0 ? 0 : 2, Math.round(n(x.waitDays)))), subject: s(x.subject).trim().slice(0, 140), body: s(x.body).replace(/\r/g, '').trim().slice(0, 6000),
    ...(x.subjectAlt ? { subjectAlt: s(x.subjectAlt).trim().slice(0, 140) } : {}), ...(x.variant ? { variant: s(x.variant).toUpperCase() } : {}) })).filter((x) => x.body).slice(0, 3);
  if (!steps.length || !steps[0]!.subject) throw badRequest('The first e-mail needs a subject and a text.');
  // L2: the same gate the engine ran when it drafted, on the text as it stands now (a person may have edited it in the dialog). The engine
  // checked the claims against the business facts and left anything unproven in brackets, so here a leftover bracket is enough to hold it.
  const ck2 = json<{ dead?: { url?: string; anchor?: string } }>(row.checks_json, {}) || {};
  const qa = draftGate(
    { type: a.type, steps: steps.map((x) => ({ subject: x.subject, body: x.body })), to, prospectDomain: a.prospectDomain, pageUrl: s(row.page_url), pageTitle: s(row.page_title), evidence: s(row.evidence), deadAnchor: s(ck2.dead?.anchor), deadUrl: s(ck2.dead?.url) },
    { domain: site.domain, targetUrl: s(row.target_url) },
  );
  if (!qa.ok) throw new HttpError(409, `This pitch cannot go out yet: ${qa.held.join('; ')}.`, 'draft_held');
  // L1: an address whose domain has no mail server would only bounce, and bounces cost the mailbox its reputation
  const mx = await mxCheck(to);
  if (!mx.ok) { await suppress(org.id, 'email', to, mx.via === 'none' ? 'no mail server for the domain (MX)' : 'not a valid address'); throw new HttpError(409, `Not sent: ${mx.reason}.`, 'no_mx'); }
  // one conversation per site at a time, and a rest after one that ended without a reply (FX-LINKS: checked and inserted under one lock)
  return db.transaction(async (tx) => {
    await outreachLock(tx, org.id);
    await conversationRules(tx, org.id, a.prospectDomain);
    const [q] = await tx.insert(schema.outreachSequences).values({ orgId: org.id, siteId: site.id, mailboxId: mb.id, prospectDomain: a.prospectDomain, prospectType: a.type, toEmail: to,
      contactUrl: contactsOf(row).find((c) => c.email === to)?.sourceUrl ?? '', pageUrl: s(row.page_url), targetUrl: s(row.target_url), country: s(row.country), status: 'scheduled', step: 0, steps, nextAt: new Date(),
      consent: !!a.consent, approvedBy: userId, approvedAt: new Date(),
      subjectVariant: ['A', 'B'].includes(String(steps[0]?.variant ?? '').toUpperCase()) ? String(steps[0]!.variant).toUpperCase() : '' }).returning();   // L7: which subject style went out
    return q!;
  });
}

export async function sequenceFor(org: OrgRow, site: SiteRow, id: string): Promise<OutreachSequenceRow> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw notFound('Sequence not found');
  const q = await db.query.outreachSequences.findFirst({ where: and(eq(schema.outreachSequences.id, id), eq(schema.outreachSequences.orgId, org.id), eq(schema.outreachSequences.siteId, site.id)) });
  if (!q) throw notFound('Sequence not found');
  return q;
}

export async function updateSequence(q: OutreachSequenceRow, patch: Partial<OutreachSequenceRow>) {
  await db.update(schema.outreachSequences).set({ ...patch, updatedAt: new Date() }).where(eq(schema.outreachSequences.id, q.id));
}

/** What the recommendations need (v4.13): pitches waiting for approval, a mailbox, replies waiting, listings competitors have.
 *  CR17-E (F9): the pitch numbers come from the one status model (`counts`, shared link-status.ts). `drafted` is kept for the
 *  recommendation that reads it and is now the pitches READY for the client (written, every check passed, not sent, not left out),
 *  never all-time drafted rows; package H words the recommendation from `counts` (see HANDOFF_E.md). */
export async function linkSummary(org: OrgRow, site: SiteRow): Promise<{ drafted: number; mailbox: boolean; repliesWaiting: number; listingsMissing: { name: string; competitors: string[] }[]; counts: LinkStatusCounts | null }> {
  try {
    const [outreach, prospects, listings, mbs, seqs] = await Promise.all([
      siteRows<LinkOutreachRow>('linkOutreach', site.domain, { max: 1500 }), siteRows<ProspectRow>('prospects', site.domain, { max: 1500 }), siteRows<ListingRow>('listings', site.domain, { max: 200 }),
      db.select({ id: schema.mailboxes.id }).from(schema.mailboxes).where(eq(schema.mailboxes.orgId, org.id)).limit(1),
      db.select({ prospectDomain: schema.outreachSequences.prospectDomain, type: schema.outreachSequences.prospectType, status: schema.outreachSequences.status, replyClass: schema.outreachSequences.replyClass, id: schema.outreachSequences.id,
        startedAt: schema.outreachSequences.startedAt, approvedAt: schema.outreachSequences.approvedAt, replyAt: schema.outreachSequences.replyAt, wonAt: schema.outreachSequences.wonAt }).from(schema.outreachSequences).where(eq(schema.outreachSequences.siteId, site.id)),
    ]);
    const counts = linkStatusCounts(linkStatusOf(outreach, prospects, seqs.map((q) => ({ prospectDomain: q.prospectDomain, type: q.type, status: q.status, startedAt: iso(q.startedAt), approvedAt: iso(q.approvedAt), replyAt: iso(q.replyAt), replyClass: q.replyClass, wonAt: iso(q.wonAt) }))));
    const waiting = seqs.filter((q) => q.status === 'replied' && ['interested', 'question', 'says_linked', 'wrong_person', 'not_now', 'other'].includes(s(q.replyClass)));
    const answered = waiting.length ? new Set((await db.select({ seq: schema.outreachMessages.sequenceId }).from(schema.outreachMessages).where(and(inArray(schema.outreachMessages.sequenceId, waiting.map((q) => q.id)), eq(schema.outreachMessages.kind, 'manual')))).map((x) => x.seq)) : new Set<string>();
    return { drafted: counts.toReview, mailbox: mbs.length > 0, repliesWaiting: waiting.filter((q) => !answered.has(q.id)).length,
      listingsMissing: listings.filter((l) => s(l.status) === 'missing' && s(l.competitors)).map((l) => ({ name: s(l.name), competitors: s(l.competitors).split(/,\s*/).filter(Boolean) })), counts };
  } catch {
    return { drafted: 0, mailbox: false, repliesWaiting: 0, listingsMissing: [], counts: null };
  }
}

// ---- CR17-E (client report 2026-11-17, C4a): "I sent it myself" ----
// No client had connected a mailbox, so every drafted pitch was unusable. A person can now copy the pitch (or open it in their own e-mail),
// send it, and tell us: the sequence is recorded as MANUAL (the sender never sends in it), the follow-ups become reminders on the page on
// the days the app would have sent them, the prospect is marked contacted (contacted_at), and the engine's won check reads their page
// every week from then on (LK.wonCheck). It counts against the same weekly limit as the app's sender (MANUAL_WEEKLY_LIMIT).
export interface ManualSentInput { prospectDomain: string; type: string; toEmail: string; consent?: boolean }
// FX-LINKS (review R2 M4, 2026-11-18): "I sent it myself" follows every rule the app's own sender follows: the consent rule (Germany,
// Austria, Saudi Arabia, a named person in the UAE), the website's opt-out (by address and by domain, so a contact-form pitch is covered too),
// one conversation per site and the 90-day rest, the draft gate (a pitch held for an edit is not recorded as sent), and the weekly limit,
// counted and recorded under one lock per company so two clicks cannot both pass.
export async function manualSent(org: OrgRow, site: SiteRow, userId: string | null, a: ManualSentInput, log?: { warn: (o: object, m: string) => void }): Promise<OutreachSequenceRow> {
  const rows = await siteRows<LinkOutreachRow>('linkOutreach', site.domain, { extra: [{ columnName: 'prospect_domain', condition: 'eq', value: a.prospectDomain }], fresh: true });
  const row = rows.find((r) => s(r.type) === a.type);
  if (!row) throw notFound(`${a.prospectDomain} is not in the link-building list.`);
  if (s(row.status) === 'needs_edit') throw new HttpError(409, 'This pitch is held for your edit: fix what it says first, then send it.', 'draft_held');
  if (s(row.status) !== 'drafted') throw new HttpError(409, s(row.status) === 'not_fit' ? 'This site was left out: there is nothing to send.' : 'The pitch for this site is not written yet.', 'not_written');
  const steps = stepsOf(row).slice(0, 3);
  if (!steps.length) throw new HttpError(409, 'The pitch for this site is not written yet.', 'not_written');
  const to = a.toEmail.trim().toLowerCase();
  const gate = manualConsentGate(s(row.country), to);
  if (gate.needed && !a.consent) throw new HttpError(409, gate.why + ' Tick "I have their consent or we already work together" to record it.', 'consent_needed');
  const supp = (to ? await isSuppressed(org.id, to) : null) ?? (await isDomainSuppressed(org.id, a.prospectDomain));
  if (supp) throw new HttpError(409, `Not recorded: ${supp}.`, 'suppressed');
  const ck = json<{ dead?: { url?: string; anchor?: string } }>(row.checks_json, {}) || {};
  // the draft gate on the text as written (a contact form has no address: the address checks are the form's, on their own site)
  const qa = draftGate(
    { type: a.type, steps: steps.map((x) => ({ subject: x.subject, body: x.body })), to: to || `editor@${a.prospectDomain}`, prospectDomain: a.prospectDomain, pageUrl: s(row.page_url), pageTitle: s(row.page_title), evidence: s(row.evidence), deadAnchor: s(ck.dead?.anchor), deadUrl: s(ck.dead?.url) },
    { domain: site.domain, targetUrl: s(row.target_url) },
  );
  if (!qa.ok) throw new HttpError(409, `This pitch is held: ${qa.held.join('; ')}.`, 'draft_held');
  const q = await db.transaction(async (tx) => {
    await outreachLock(tx, org.id);
    await conversationRules(tx, org.id, a.prospectDomain);
    const week = await firstEmailsThisWeek(org.id, new Date(), tx);
    if (week >= MANUAL_WEEKLY_LIMIT) throw new HttpError(409, `${week} first e-mails went out this week, the weekly limit is ${MANUAL_WEEKLY_LIMIT}: send this one next week.`, 'weekly_limit');
    const now = new Date();
    const next = steps.length > 1 ? addWorkingDays(now, Math.max(2, steps[1]!.waitDays || 4)) : addWorkingDays(now, 7);
    const [ins] = await tx.insert(schema.outreachSequences).values({ orgId: org.id, siteId: site.id, mailboxId: null, prospectDomain: a.prospectDomain, prospectType: a.type, toEmail: to || '',
      contactUrl: to ? (contactsOf(row).find((c) => c.email === to)?.sourceUrl ?? '') : s(row.contact_form_url), pageUrl: s(row.page_url), targetUrl: s(row.target_url), country: s(row.country), status: 'active', step: 1, steps,
      nextAt: next, consent: !!a.consent, approvedBy: userId, approvedAt: now, startedAt: now, lastSentAt: now, manual: true }).returning();
    await tx.insert(schema.outreachMessages).values({ sequenceId: ins!.id, orgId: org.id, mailboxId: null, direction: 'out', step: 0, kind: 'step', subject: steps[0]!.subject.slice(0, 300), body: steps[0]!.body, toEmail: to, at: now });
    return ins!;
  });
  await setProspectStatus(site.domain, a.prospectDomain, a.type, 'contacted', 'sent by you from your own e-mail (marked in the app)', log);
  return q;
}
/** a follow-up of a manual sequence that the person sent themselves: the next reminder, or the end of the sequence */
export async function manualFollowupSent(q: OutreachSequenceRow): Promise<void> {
  if (!q.manual) throw new HttpError(409, 'This conversation is sent by the app.');
  if (!['active', 'paused'].includes(q.status) || q.step >= q.steps.length) throw new HttpError(409, 'There is no follow-up left to send in this conversation.');
  const now = new Date(); const step = q.step; const st = q.steps[step]!;
  await db.insert(schema.outreachMessages).values({ sequenceId: q.id, orgId: q.orgId, mailboxId: null, direction: 'out', step, kind: 'step', subject: '', body: st.body, toEmail: q.toEmail, at: now });
  const more = step + 1 < q.steps.length;
  await updateSequence(q, { step: step + 1, lastSentAt: now, nextAt: more ? addWorkingDays(now, Math.max(2, q.steps[step + 1]!.waitDays || 4)) : addWorkingDays(now, 7) });
}
