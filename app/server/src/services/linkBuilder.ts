import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import {
  consentGate,
  DEFAULT_LINK_SETTINGS,
  emailDomain,
  n8nSiteId,
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
export async function suppress(orgId: string, kind: 'email' | 'domain', value: string, reason: string) {
  const v = value.trim().toLowerCase(); if (!v) return;
  await db.insert(schema.suppressions).values({ orgId, kind, valueHash: hashOf(orgId, v), hint: kind === 'email' ? maskEmail(v) : v, reason: reason.slice(0, 120) }).onConflictDoNothing();
}

/** The prospect's status in the SEO engine follows the conversation (contacted / replied / won / rejected); a failure is logged, never fatal. */
export async function setProspectStatus(domain: string, prospectDomain: string, type: string, status: 'contacted' | 'replied' | 'won' | 'rejected', note?: string, log?: { warn: (o: object, m: string) => void }) {
  try {
    await siteAdmin({ action: 'prospect', domain, site_id: n8nSiteId(domain), prospect_domain: prospectDomain, type, status, ...(note ? { note } : {}), request_id: `app-outreach-${Date.now().toString(36)}` });
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
  return { id: m.id, label: m.label, fromName: m.fromName, fromEmail: m.fromEmail, provider: 'smtp', smtpHost: m.smtpHost, smtpPort: m.smtpPort, smtpSecure: m.smtpSecure, imapHost: m.imapHost, imapPort: m.imapPort, imapSecure: m.imapSecure,
    username: m.username, status: (m.status as MailboxView['status']) ?? 'active', statusReason: m.statusReason, signatureName: m.signatureName, signatureTitle: m.signatureTitle, company: m.company, postalAddress: m.postalAddress,
    timezone: m.timezone, windowStart: m.windowStart, windowEnd: m.windowEnd, dailyFirstMax: m.dailyFirstMax, dailyMax: m.dailyMax, startedAt: m.startedAt.toISOString(), dns: (m.dns as MailboxView['dns']) ?? null,
    lastPollAt: iso(m.lastPollAt), lastSendAt: iso(m.lastSendAt), lastError: m.lastError, today: { first: c.first, total: c.total, firstCap: warmupCap(m.startedAt, now, m.dailyFirstMax), totalCap: m.dailyMax } };
}

const contactsOf = (r: LinkOutreachRow): OutreachContact[] => (json<{ email?: string; kind?: string; own?: boolean; source_url?: string }[]>(r.contacts_json, []) || [])
  .filter((c) => c && c.email).map((c) => ({ email: s(c.email).toLowerCase(), kind: (['person', 'editorial', 'general'].includes(s(c.kind)) ? c.kind : 'other') as OutreachContact['kind'], own: !!c.own, sourceUrl: s(c.source_url) }));
const stepsOf = (r: LinkOutreachRow): OutreachStep[] => (json<{ step?: number; wait_days?: number; subject?: string; body?: string }[]>(r.sequence_json, []) || [])
  .map((x, i) => ({ step: i, waitDays: n(x.wait_days), subject: s(x.subject), body: s(x.body) })).filter((x) => x.body);

export async function sequencesOf(siteId: string): Promise<OutreachSequence[]> {
  const seqs = await db.select().from(schema.outreachSequences).where(eq(schema.outreachSequences.siteId, siteId)).orderBy(desc(schema.outreachSequences.createdAt)).limit(500);
  if (!seqs.length) return [];
  const msgs = await db.select().from(schema.outreachMessages).where(inArray(schema.outreachMessages.sequenceId, seqs.map((x) => x.id))).orderBy(schema.outreachMessages.at);
  return seqs.map((q) => ({ id: q.id, prospectDomain: q.prospectDomain, type: q.prospectType, toEmail: q.toEmail, mailboxId: q.mailboxId, status: q.status as SequenceStatus, step: q.step, steps: q.steps, nextAt: iso(q.nextAt),
    approvedAt: iso(q.approvedAt), startedAt: iso(q.startedAt), lastSentAt: iso(q.lastSentAt), targetUrl: q.targetUrl, pageUrl: q.pageUrl, replyAt: iso(q.replyAt), replyClass: (q.replyClass as ReplyClass | null) ?? null,
    replySummary: q.replySummary, suggestedReply: q.suggestedReply, replyFrom: q.replyFrom, oooUntil: iso(q.oooUntil), wonAt: iso(q.wonAt), error: q.error,
    messages: msgs.filter((m) => m.sequenceId === q.id).map((m) => ({ id: m.id, direction: m.direction as 'out' | 'in', step: m.step, kind: m.kind, subject: m.subject, body: m.body.slice(0, 6000), from: m.fromEmail, to: m.toEmail, at: m.at.toISOString(), error: m.error })) }));
}

function kpisOf(seqs: OutreachSequence[], prospects: ProspectRow[]): LinkBuildingKpis {
  const month = new Date().toISOString().slice(0, 7);
  const started = seqs.filter((q) => q.startedAt);
  const people = started.filter((q) => q.replyAt && q.replyClass && q.replyClass !== 'out_of_office');
  const positive = people.filter((q) => ['interested', 'question', 'says_linked'].includes(q.replyClass!) || q.status === 'won');
  const wonRows = prospects.filter((p) => s(p.status) === 'won');
  const wonSeq = started.filter((q) => q.status === 'won' && q.wonAt);
  const days = wonSeq.map((q) => (new Date(q.wonAt!).getTime() - new Date(q.startedAt!).getTime()) / 864e5).sort((a, b) => a - b);
  const domains = new Set(started.map((q) => q.prospectDomain));
  const types = [...new Set(started.map((q) => q.type))];
  return {
    wonMonth: wonRows.filter((p) => s(p.won_at).slice(0, 7) === month).length, wonAll: wonRows.length,
    sentMonth: seqs.flatMap((q) => q.messages).filter((m) => m.direction === 'out' && !m.error && m.at.slice(0, 7) === month).length,
    contactedDomains: domains.size, replied: people.length, positive: positive.length,
    replyRate: started.length ? Math.round((1000 * people.length) / started.length) / 10 : null,
    winRate: domains.size ? Math.round((1000 * new Set(started.filter((q) => q.status === 'won').map((q) => q.prospectDomain)).size) / domains.size) / 10 : null,
    bounceRate: started.length ? Math.round((1000 * started.filter((q) => q.status === 'bounced').length) / started.length) / 10 : null,
    unsubscribes: started.filter((q) => q.replyClass === 'unsubscribe').length,
    medianDaysToLink: days.length ? Math.round(days[Math.floor((days.length - 1) / 2)]!) : null,
    byType: types.map((t) => ({ type: t, sent: started.filter((q) => q.type === t).length, replied: people.filter((q) => q.type === t).length, won: started.filter((q) => q.type === t && q.status === 'won').length })),
  };
}

export async function linkBuildingData(org: OrgRow, site: SiteRow, role: Role): Promise<LinkBuildingData> {
  const d = site.domain;
  const [outreach, prospects, listings, impact, mbs, seqs, supp] = await Promise.all([
    siteRows<LinkOutreachRow>('linkOutreach', d, { max: 1500 }), siteRows<ProspectRow>('prospects', d, { max: 1500 }), siteRows<ListingRow>('listings', d, { max: 200 }), siteRows<LinkImpactRow>('linkImpact', d, { max: 300 }),
    db.select().from(schema.mailboxes).where(eq(schema.mailboxes.orgId, org.id)), sequencesOf(site.id),
    db.select({ c: sql<number>`count(*)::int` }).from(schema.suppressions).where(eq(schema.suppressions.orgId, org.id)),
  ]);
  const settings = linkSettingsOf(site);
  const statusOf = new Map(prospects.map((p) => [s(p.prospect_domain) + '|' + s(p.type), s(p.status) || 'new']));
  const taken = new Set(seqs.filter((q) => q.status !== 'stopped' || q.startedAt).map((q) => q.prospectDomain + '|' + q.type));
  const drafts: OutreachDraft[] = outreach.filter((r) => s(r.type) !== 'redirect' && !taken.has(s(r.prospect_domain) + '|' + s(r.type)) && !['won', 'ignored', 'rejected'].includes(statusOf.get(s(r.prospect_domain) + '|' + s(r.type)) ?? ''))
    .map((r) => { const contacts = contactsOf(r); const ck = json<{ dead?: { url?: string; anchor?: string } }>(r.checks_json, {}) || {};
      return { prospectDomain: s(r.prospect_domain), type: s(r.type), status: s(r.status), prospectStatus: statusOf.get(s(r.prospect_domain) + '|' + s(r.type)) ?? 'new', score: n(r.score), fit: n(r.fit), fitReason: s(r.fit_reason),
        pageUrl: s(r.page_url), pageTitle: s(r.page_title), evidence: s(r.evidence), contacts, contactFormUrl: s(r.contact_form_url), country: s(r.country), language: s(r.language), targetUrl: s(r.target_url), targetReason: s(r.target_reason),
        anchorHint: s(r.anchor_hint), steps: stepsOf(r), deadline: s(r.deadline), draftedAt: s(r.drafted_at), checkedAt: s(r.checked_at), deadLink: ck.dead?.url ? { url: s(ck.dead.url), anchor: s(ck.dead.anchor) } : null,
        consent: consentGate(s(r.country), contacts[0]?.email ?? '') }; })
    .sort((a, b) => ({ drafted: 0, ready: 1, needs_contact: 2, not_fit: 3 }[a.status] ?? 4) - ({ drafted: 0, ready: 1, needs_contact: 2, not_fit: 3 }[b.status] ?? 4) || b.score * (0.5 + b.fit) - a.score * (0.5 + a.fit));
  const mailboxes = await Promise.all(mbs.map(mailboxView));
  const active = mailboxes.find((m) => m.id === settings.mailboxId && m.status === 'active') ?? mailboxes.find((m) => m.status === 'active');
  const canSend = !mailboxes.length ? { ok: false, why: 'Connect a mailbox in company settings → Mailboxes: pitches go out from your own address.' }
    : !active ? { ok: false, why: 'Your mailbox is paused or has an error: check it in company settings → Mailboxes.' }
    : !active.postalAddress ? { ok: false, why: 'Add your postal address to the mailbox: every e-mail must carry it (CAN-SPAM).' }
    : role === 'viewer' ? { ok: false, why: 'Viewers cannot send.' } : { ok: true, why: '' };
  return {
    settings, mailboxes, drafts, sequences: seqs, kpis: kpisOf(seqs, prospects),
    listings: listings.map((l) => ({ id: s(l.listing_id), name: s(l.name), category: s(l.category), status: s(l.status), profileUrl: s(l.profile_url), rel: s(l.rel), competitors: s(l.competitors).split(/,\s*/).filter(Boolean), submitUrl: s(l.submit_url),
      priority: n(l.priority), why: s(l.why), checkedAt: s(l.checked_at), submittedAt: s(l.submitted_at), note: s(l.note) })).sort((a, b) => a.priority - b.priority),
    redirects: outreach.filter((r) => s(r.type) === 'redirect').map((r) => ({ from: s(r.page_url), to: s(r.target_url), reason: s(r.target_reason) })),
    impact: impact.map((r) => ({ refDomain: s(r.ref_domain), fromUrl: s(r.from_url), targetUrl: s(r.target_url), t0: s(r.t0), weeks: n(r.weeks), basePosition: r.base_position == null ? null : n(r.base_position), position: r.position == null ? null : n(r.position),
      pageChange: r.page_change == null ? null : n(r.page_change), controlChange: r.control_change == null ? null : n(r.control_change), effect: r.effect == null ? null : n(r.effect), verdict: s(r.verdict), note: s(r.note), keyword: s(r.keyword) }))
      .sort((a, b) => b.weeks - a.weeks),
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
  if (!mb) throw new HttpError(409, mbs.length ? 'Your mailbox is paused or has an error: check it in company settings → Mailboxes.' : 'Connect a mailbox first (company settings → Mailboxes).', 'no_mailbox');
  if (!mb.postalAddress.trim()) throw new HttpError(409, 'Add your postal address to the mailbox first: every pitch must carry it.', 'no_address');
  const to = a.toEmail.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(to)) throw badRequest('Choose a valid e-mail address.');
  const supp = await isSuppressed(org.id, to); if (supp) throw new HttpError(409, `Not sent: ${supp}.`, 'suppressed');
  const rows = await siteRows<LinkOutreachRow>('linkOutreach', site.domain, { extra: [{ columnName: 'prospect_domain', condition: 'eq', value: a.prospectDomain }], fresh: true });
  const row = rows.find((r) => s(r.type) === a.type);
  if (!row) throw notFound(`${a.prospectDomain} is not in the link-building list.`);
  const gate = consentGate(s(row.country), to);
  if (gate.needed && !a.consent) throw new HttpError(409, gate.why + ' Tick "I have their consent or we already work together" to send.', 'consent_needed');
  const steps = a.steps.map((x, i) => ({ step: i, waitDays: Math.min(30, Math.max(i === 0 ? 0 : 2, Math.round(n(x.waitDays)))), subject: s(x.subject).trim().slice(0, 140), body: s(x.body).replace(/\r/g, '').trim().slice(0, 6000) })).filter((x) => x.body).slice(0, 3);
  if (!steps.length || !steps[0]!.subject) throw badRequest('The first e-mail needs a subject and a text.');
  // one conversation per site at a time, and a rest after one that ended without a reply
  const others = await db.select().from(schema.outreachSequences).where(and(eq(schema.outreachSequences.orgId, org.id), eq(schema.outreachSequences.prospectDomain, a.prospectDomain)));
  if (others.some((q) => ['scheduled', 'active', 'paused', 'replied'].includes(q.status))) throw conflict(`A conversation with ${a.prospectDomain} is already going on.`);
  const recent = others.find((q) => q.status === 'finished' && q.lastSentAt && Date.now() - q.lastSentAt.getTime() < 90 * 864e5);
  if (recent) throw conflict(`${a.prospectDomain} got a sequence without a reply in the last 90 days: give it a rest.`);
  const [q] = await db.insert(schema.outreachSequences).values({ orgId: org.id, siteId: site.id, mailboxId: mb.id, prospectDomain: a.prospectDomain, prospectType: a.type, toEmail: to,
    contactUrl: contactsOf(row).find((c) => c.email === to)?.sourceUrl ?? '', pageUrl: s(row.page_url), targetUrl: s(row.target_url), country: s(row.country), status: 'scheduled', step: 0, steps, nextAt: new Date(),
    consent: !!a.consent, approvedBy: userId, approvedAt: new Date() }).returning();
  return q!;
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

/** What the recommendations need (v4.13): pitches waiting for approval, a mailbox, replies waiting for an answer, listings competitors have. */
export async function linkSummary(org: OrgRow, site: SiteRow): Promise<{ drafted: number; mailbox: boolean; repliesWaiting: number; listingsMissing: { name: string; competitors: string[] }[] }> {
  try {
    const [outreach, listings, mbs, seqs] = await Promise.all([
      siteRows<LinkOutreachRow>('linkOutreach', site.domain, { max: 1500, extra: [{ columnName: 'status', condition: 'eq', value: 'drafted' }] }), siteRows<ListingRow>('listings', site.domain, { max: 200 }),
      db.select({ id: schema.mailboxes.id }).from(schema.mailboxes).where(eq(schema.mailboxes.orgId, org.id)).limit(1),
      db.select({ d: schema.outreachSequences.prospectDomain, t: schema.outreachSequences.prospectType, status: schema.outreachSequences.status, cls: schema.outreachSequences.replyClass, id: schema.outreachSequences.id }).from(schema.outreachSequences).where(eq(schema.outreachSequences.siteId, site.id)),
    ]);
    const taken = new Set(seqs.map((q) => q.d + '|' + q.t));
    const waiting = seqs.filter((q) => q.status === 'replied' && ['interested', 'question', 'says_linked', 'wrong_person', 'not_now', 'other'].includes(s(q.cls)));
    const answered = waiting.length ? new Set((await db.select({ seq: schema.outreachMessages.sequenceId }).from(schema.outreachMessages).where(and(inArray(schema.outreachMessages.sequenceId, waiting.map((q) => q.id)), eq(schema.outreachMessages.kind, 'manual')))).map((x) => x.seq)) : new Set<string>();
    return { drafted: outreach.filter((r) => !taken.has(s(r.prospect_domain) + '|' + s(r.type))).length, mailbox: mbs.length > 0, repliesWaiting: waiting.filter((q) => !answered.has(q.id)).length,
      listingsMissing: listings.filter((l) => s(l.status) === 'missing' && s(l.competitors)).map((l) => ({ name: s(l.name), competitors: s(l.competitors).split(/,\s*/).filter(Boolean) })) };
  } catch {
    return { drafted: 0, mailbox: false, repliesWaiting: 0, listingsMissing: [] };
  }
}
