import { and, eq, inArray, isNotNull, lte, or, sql } from 'drizzle-orm';
import { addWorkingDays, consentGate, digestOpen, digestProspect, emailDomain, inSendWindow, isDigestEmail, n8nSiteId, parseDigest, parseReturnDate, sendGap, warmupCap, type DnsCheck, type LinkOutreachRow, type ProfileRow, type ProspectRow } from '@seo/shared';
import { db, schema } from '../db';
import type { MailboxRow, OutreachSequenceRow, SiteRow } from '../db/schema';
import { replyRead, siteRows, upsertRow } from '../n8n/client';
import { approve, isSuppressed, linkSettingsOf, sentCounts, setProspectStatus, suppress } from './linkBuilder';
import { compose, connOf, imapClient, mailAuthGate, mxCheck, parseIncoming, rawMessage, savesSentCopy, smtpTransport, stripQuoted, type Incoming } from './mail';
import { inboxViaApi, isOauthMailbox, sendRawViaApi } from './mailOauth';
import { replyReadBody } from './replyFacts';

// v4.13 Link Builder jobs (index.ts runs them on timers; LINK_BUILDER_JOBS=false switches them off):
// - sender (every minute): per mailbox at most one e-mail per run, inside its sending window (Mon-Fri, its hours, its time zone), within the
//   warm-up and daily limits, 4-9 minutes apart; before each e-mail the opt-out list and the prospect's status are checked again;
// - inbox (every 3 minutes): new messages in INBOX matched to our sequences (Message-ID -> address -> domain + subject); bounces, automatic
//   replies (out of office reschedules), people (the conversation stops, the Reply Reader classifies it and suggests an answer);
// - automatic approval (every 10 minutes) for websites whose owner chose it; sequences without a reply end after their last e-mail.
// L5 (2026-10-13): the same inbox pass reads journalist digests (HARO / Source of Sources) and writes every request that is still open
//   as a `digest` prospect for each verified website, which the SEO engine then qualifies and drafts like any other prospect.
// L4 (2026-10-13): a mailbox connected with OAuth sends through its provider's API (Gmail messages.send / Graph sendMail) and, for
//   Microsoft 365, is read through Graph; Gmail OAuth sends only (Google's inbox scope is restricted), so its replies are not polled.

type Log = { info: (o: object, m: string) => void; warn: (o: object, m: string) => void; error: (o: object, m: string) => void };
const ACTIVE = ['scheduled', 'active'];
const DIGESTS_PER_EMAIL = 15;   // L5: at most this many requests are taken from one digest
const short = (e: unknown) => String((e as Error)?.message || e).replace(/\s+/g, ' ').slice(0, 300);
let sending = false, polling = false, approving = false;

async function siteOf(id: string): Promise<SiteRow | undefined> { return db.query.sites.findFirst({ where: eq(schema.sites.id, id) }); }

async function prospectStatusNow(site: SiteRow, q: OutreachSequenceRow): Promise<string> {
  try {
    const rows = await siteRows<ProspectRow>('prospects', site.domain, { extra: [{ columnName: 'prospect_domain', condition: 'eq', value: q.prospectDomain }] });
    return String(rows.find((r) => r.type === q.prospectType)?.status ?? 'new');
  } catch { return 'unknown'; }
}

/** one e-mail of one sequence, now */
async function sendStep(mb: MailboxRow, q: OutreachSequenceRow, site: SiteRow, log: Log): Promise<void> {
  const st = q.steps[q.step]!; const now = new Date();
  const prev = await db.select({ messageId: schema.outreachMessages.messageId }).from(schema.outreachMessages).where(and(eq(schema.outreachMessages.sequenceId, q.id), eq(schema.outreachMessages.direction, 'out'))).orderBy(schema.outreachMessages.at);
  const mail = compose(mb, { sequenceId: q.id, step: q.step, to: q.toEmail, subject: st.subject, body: st.body, firstSubject: q.steps[0]!.subject, country: q.country, foundOn: q.contactUrl, previousIds: prev.map((p) => p.messageId) });
  const oauth = isOauthMailbox(mb);   // L4: no password to read, and the provider's API sends
  let conn;
  if (!oauth) { try { conn = connOf(mb); } catch (e) { await db.update(schema.mailboxes).set({ status: 'error', statusReason: short(e), updatedAt: now }).where(eq(schema.mailboxes.id, mb.id)); return; } }
  try {
    const mid = oauth
      ? await sendRawViaApi(mb, await rawMessage(mail), mail.messageId)
      : String((await smtpTransport(conn!).sendMail({ from: mail.from, to: mail.to, subject: mail.subject, text: mail.text, messageId: mail.messageId, ...(mail.inReplyTo ? { inReplyTo: mail.inReplyTo, references: mail.references } : {}), headers: mail.headers })).messageId || mail.messageId);
    await db.insert(schema.outreachMessages).values({ sequenceId: q.id, orgId: q.orgId, mailboxId: mb.id, direction: 'out', step: q.step, kind: 'step', subject: mail.subject, body: mail.text, messageId: mid, inReplyTo: mail.inReplyTo ?? '', fromEmail: mb.fromEmail, toEmail: q.toEmail, at: now });
    const next = q.step + 1; const more = next < q.steps.length;
    await db.update(schema.outreachSequences).set({ status: 'active', step: next, startedAt: q.startedAt ?? now, lastSentAt: now, nextAt: more ? addWorkingDays(now, q.steps[next]!.waitDays) : addWorkingDays(now, 7), error: '', updatedAt: now }).where(eq(schema.outreachSequences.id, q.id));
    await db.update(schema.mailboxes).set({ lastSendAt: now, lastError: '', updatedAt: now }).where(eq(schema.mailboxes.id, mb.id));
    if (q.step === 0) await setProspectStatus(site.domain, q.prospectDomain, q.prospectType, 'contacted', undefined, log);
    if (!oauth && !savesSentCopy(mb.smtpHost) && mb.sentFolder) {   // a copy in the person's own Sent folder, as if they had sent it themselves (Gmail and Graph keep their own)
      const c = imapClient(conn!);
      try { await c.connect(); await c.append(mb.sentFolder, await rawMessage(mail), ['\\Seen']); } catch (e) { log.warn({ err: short(e), mailbox: mb.id }, 'sent copy not saved'); } finally { await c.logout().catch(() => c.close()); }
    }
    log.info({ sequence: q.id, step: q.step, to: emailDomain(q.toEmail) }, 'outreach e-mail sent');
  } catch (e) {
    const err = short(e); const code = Number((e as { responseCode?: number }).responseCode) || 0;
    await db.insert(schema.outreachMessages).values({ sequenceId: q.id, orgId: q.orgId, mailboxId: mb.id, direction: 'out', step: q.step, kind: 'step', subject: mail.subject, body: mail.text, messageId: mail.messageId, fromEmail: mb.fromEmail, toEmail: q.toEmail, error: err, at: now });
    if (oauth) {   // L4: a provider that refuses the token needs the customer to grant access again (accessTokenFor already recorded why)
      if (/refused the request|no stored permission|withdrew our access/i.test(err)) await db.update(schema.mailboxes).set({ status: 'error', statusReason: err, lastError: err, updatedAt: now }).where(eq(schema.mailboxes.id, mb.id));
      else await db.update(schema.outreachSequences).set({ nextAt: new Date(now.getTime() + 30 * 60_000), error: err, updatedAt: now }).where(eq(schema.outreachSequences.id, q.id));
    } else if (code === 535 || /auth|credentials|password|username and password/i.test(err)) {   // the mailbox stops; nothing else is tried until a person fixes it
      await db.update(schema.mailboxes).set({ status: 'error', statusReason: 'The mail server refused the login: ' + err, lastError: err, updatedAt: now }).where(eq(schema.mailboxes.id, mb.id));
    } else if (/\b5\.7\.\d/.test(err) || code === 550 && /policy|spam|blocked|reputation/i.test(err)) {
      await db.update(schema.mailboxes).set({ status: 'paused', statusReason: 'The mail server blocked a message as a policy issue: ' + err, lastError: err, updatedAt: now }).where(eq(schema.mailboxes.id, mb.id));
    } else if (code >= 500) {
      await db.update(schema.outreachSequences).set({ status: 'failed', error: err, updatedAt: now }).where(eq(schema.outreachSequences.id, q.id));
    } else {
      await db.update(schema.outreachSequences).set({ nextAt: new Date(now.getTime() + 30 * 60_000), error: err, updatedAt: now }).where(eq(schema.outreachSequences.id, q.id));
      await db.update(schema.mailboxes).set({ lastError: err, updatedAt: now }).where(eq(schema.mailboxes.id, mb.id));
    }
    log.warn({ sequence: q.id, err }, 'outreach e-mail failed');
  }
}

export async function senderTick(log: Log, now = new Date()): Promise<number> {
  if (sending) return 0; sending = true; let sent = 0;
  try {
    // sequences whose last e-mail went out a while ago without a reply end here
    await db.update(schema.outreachSequences).set({ status: 'finished', nextAt: null, updatedAt: now })
      .where(and(eq(schema.outreachSequences.status, 'active'), lte(schema.outreachSequences.nextAt, now), sql`${schema.outreachSequences.step} >= jsonb_array_length(${schema.outreachSequences.steps})`));
    const mbs = await db.select().from(schema.mailboxes).where(eq(schema.mailboxes.status, 'active'));
    for (const mb of mbs) {
      if (!inSendWindow(now, mb.timezone, mb.windowStart, mb.windowEnd)) continue;
      if (mb.lastSendAt && now.getTime() - mb.lastSendAt.getTime() < sendGap(mb.id + mb.lastSendAt.toISOString())) continue;
      const c = await sentCounts(mb.id, new Date(now.getTime() - 864e5));
      if (c.total >= mb.dailyMax) continue;
      const firstCap = warmupCap(mb.startedAt, now, mb.dailyFirstMax);
      const due = await db.select().from(schema.outreachSequences).where(and(eq(schema.outreachSequences.mailboxId, mb.id), inArray(schema.outreachSequences.status, ACTIVE), lte(schema.outreachSequences.nextAt, now), sql`${schema.outreachSequences.step} < jsonb_array_length(${schema.outreachSequences.steps})`))
        .orderBy(sql`${schema.outreachSequences.step} desc`, schema.outreachSequences.nextAt).limit(10);   // follow-ups first: they keep conversations going
      for (const q of due) {
        if (q.step === 0 && c.first >= firstCap) continue;
        const site = await siteOf(q.siteId); if (!site) continue;
        const supp = await isSuppressed(q.orgId, q.toEmail);
        if (supp) { await db.update(schema.outreachSequences).set({ status: 'stopped', error: 'Not sent: ' + supp, nextAt: null, updatedAt: now }).where(eq(schema.outreachSequences.id, q.id)); continue; }
        // B11-4: before a NEW conversation, the sender's own authentication is re-read when the stored reading is a week old. A
        // From domain with neither SPF nor DKIM cannot start one; open threads keep running. The reason is put on the mailbox so
        // the Link building page and the Mailboxes tab say the same thing the sender decided.
        if (q.step === 0) {
          const auth = await mailAuthGate(mb.fromEmail, (mb.dns as DnsCheck | null) ?? null, now);
          if (auth.rechecked && auth.dns) await db.update(schema.mailboxes).set({ dns: auth.dns as unknown as Record<string, unknown>, updatedAt: now }).where(eq(schema.mailboxes.id, mb.id));
          if (!auth.ok) {
            await db.update(schema.mailboxes).set({ status: 'paused', statusReason: auth.why, updatedAt: now }).where(eq(schema.mailboxes.id, mb.id));
            log.warn({ mailbox: mb.id }, 'outreach paused: the sending domain has no SPF and no DKIM');
            break;
          }
        }
        if (q.step === 0) {   // L1: the recipient's domain must accept mail at all, an address with no mail server is suppressed, never sent to
          const mx = await mxCheck(q.toEmail);
          if (!mx.ok) {
            await suppress(q.orgId, 'email', q.toEmail, mx.via === 'none' ? 'no mail server for the domain (MX)' : 'not a valid address');
            await db.update(schema.outreachSequences).set({ status: 'stopped', error: 'Not sent: ' + mx.reason, nextAt: null, updatedAt: now }).where(eq(schema.outreachSequences.id, q.id));
            log.info({ sequence: q.id, domain: emailDomain(q.toEmail) }, 'outreach address suppressed: no mail server');
            continue;
          }
        }
        if (q.step === 0) {   // at most 2 first e-mails to one site a week, never while another conversation with it is open
          const other = await db.select({ id: schema.outreachSequences.id, status: schema.outreachSequences.status, startedAt: schema.outreachSequences.startedAt }).from(schema.outreachSequences)
            .where(and(eq(schema.outreachSequences.orgId, q.orgId), eq(schema.outreachSequences.prospectDomain, q.prospectDomain), sql`${schema.outreachSequences.id} <> ${q.id}`));
          if (other.filter((o) => o.startedAt && now.getTime() - o.startedAt.getTime() < 7 * 864e5).length >= 2 || other.some((o) => o.status === 'replied')) {
            await db.update(schema.outreachSequences).set({ nextAt: addWorkingDays(now, 2), updatedAt: now }).where(eq(schema.outreachSequences.id, q.id)); continue; }
        }
        const ps = await prospectStatusNow(site, q);
        if (ps === 'won') { await db.update(schema.outreachSequences).set({ status: 'won', wonAt: now, nextAt: null, updatedAt: now }).where(eq(schema.outreachSequences.id, q.id)); continue; }
        if (ps === 'rejected' || ps === 'ignored') { await db.update(schema.outreachSequences).set({ status: 'stopped', error: 'The prospect was marked ' + ps, nextAt: null, updatedAt: now }).where(eq(schema.outreachSequences.id, q.id)); continue; }
        await sendStep(mb, q, site, log); sent++;
        break;   // one e-mail per mailbox per run: the next one waits 4-9 minutes
      }
    }
  } catch (e) { log.error({ err: short(e) }, 'outreach sender failed'); } finally { sending = false; }
  return sent;
}

/** the sequence an incoming message belongs to (our Message-IDs first, then the sender's address, then their domain + our subject) */
async function matchSequence(mb: MailboxRow, m: Incoming): Promise<OutreachSequenceRow | null> {
  const ids = [...new Set([m.inReplyTo, ...m.references, ...m.bounceIds].filter(Boolean))];
  if (ids.length) {
    const hit = await db.select({ seq: schema.outreachMessages.sequenceId }).from(schema.outreachMessages).where(and(eq(schema.outreachMessages.orgId, mb.orgId), inArray(schema.outreachMessages.messageId, ids))).limit(1);
    if (hit[0]) return (await db.query.outreachSequences.findFirst({ where: eq(schema.outreachSequences.id, hit[0].seq) })) ?? null;
  }
  const addrs = m.kind === 'bounce' ? m.bounceRecipients : [m.from];
  if (addrs.length) {
    const byAddr = await db.select().from(schema.outreachSequences).where(and(eq(schema.outreachSequences.orgId, mb.orgId), inArray(schema.outreachSequences.toEmail, addrs))).orderBy(sql`${schema.outreachSequences.lastSentAt} desc nulls last`).limit(1);
    if (byAddr[0]) return byAddr[0];
  }
  if (m.kind !== 'bounce' && m.fromDomain) {
    const byDomain = await db.select().from(schema.outreachSequences).where(and(eq(schema.outreachSequences.orgId, mb.orgId), or(eq(schema.outreachSequences.prospectDomain, m.fromDomain), sql`${m.fromDomain} like '%.' || ${schema.outreachSequences.prospectDomain}`)));
    const subj = m.subject.replace(/^(re|aw|fw|fwd|sv|antw)\s*:\s*/gi, '').trim().toLowerCase();
    return byDomain.find((q) => q.startedAt && subj && String(q.steps[0]?.subject ?? '').toLowerCase().includes(subj.slice(0, 40))) ?? null;
  }
  return null;
}

/** L5: one journalist digest -> one `digest` prospect per open request, for every verified website of the company. */
async function storeDigest(mb: MailboxRow, m: Incoming, log: Log): Promise<number> {
  const requests = parseDigest(m.text, m.date ?? new Date()).filter((r) => digestOpen(r)).slice(0, DIGESTS_PER_EMAIL);
  if (!requests.length) return 0;
  const sites = await db.select().from(schema.sites).where(and(eq(schema.sites.orgId, mb.orgId), isNotNull(schema.sites.verifiedAt)));
  const service = /helpareporter/i.test(m.fromDomain) ? 'HARO' : 'Source of Sources';
  let written = 0;
  for (const site of sites) {
    const siteId = n8nSiteId(site.domain);
    for (const r of requests) {
      const row = digestProspect(r, { siteId, domain: site.domain, service });
      try {
        await upsertRow('prospects', [{ columnName: 'site_id', condition: 'eq', value: siteId }, { columnName: 'prospect_domain', condition: 'eq', value: String(row.prospect_domain) }, { columnName: 'type', condition: 'eq', value: 'digest' }], row);
        written++;
      } catch (e) { log.warn({ err: short(e), site: site.domain, request: r.id }, 'journalist request not stored'); }
    }
  }
  log.info({ mailbox: mb.id, service, requests: requests.length, sites: sites.length }, 'journalist digest read');
  return written;
}

async function handleIncoming(mb: MailboxRow, m: Incoming, log: Log): Promise<void> {
  if (!m.from || m.from === mb.fromEmail.toLowerCase()) return;
  if (m.kind !== 'bounce' && isDigestEmail(m.from, m.subject)) { await storeDigest(mb, m, log); return; }   // L5: a digest answers no e-mail of ours
  const q = await matchSequence(mb, m); if (!q) return;
  const site = await siteOf(q.siteId); if (!site) return;
  const now = new Date(); const text = stripQuoted(m.text);
  if (m.messageId) { const dup = await db.select({ id: schema.outreachMessages.id }).from(schema.outreachMessages).where(and(eq(schema.outreachMessages.orgId, mb.orgId), eq(schema.outreachMessages.messageId, m.messageId), eq(schema.outreachMessages.direction, 'in'))).limit(1); if (dup[0]) return; }
  await db.insert(schema.outreachMessages).values({ sequenceId: q.id, orgId: q.orgId, mailboxId: mb.id, direction: 'in', step: q.step, kind: m.kind === 'person' ? 'reply' : m.kind, subject: m.subject.slice(0, 300), body: text, messageId: m.messageId, inReplyTo: m.inReplyTo, fromEmail: m.from, toEmail: mb.fromEmail, at: m.date ?? now });
  if (m.kind === 'bounce') {
    if (m.hardBounce) await suppress(q.orgId, 'email', q.toEmail, 'hard bounce');
    await db.update(schema.outreachSequences).set({ status: 'bounced', nextAt: null, error: m.hardBounce ? 'The address does not exist (hard bounce)' : 'Delivery failed', updatedAt: now }).where(eq(schema.outreachSequences.id, q.id));
    // 3 hard bounces among the last 50 e-mails, or a policy block: the mailbox pauses before its reputation suffers
    const lastOut = await db.select({ seq: schema.outreachMessages.sequenceId }).from(schema.outreachMessages).where(and(eq(schema.outreachMessages.mailboxId, mb.id), eq(schema.outreachMessages.direction, 'out'))).orderBy(sql`${schema.outreachMessages.at} desc`).limit(50);
    const bounced = lastOut.length ? (await db.select({ id: schema.outreachSequences.id }).from(schema.outreachSequences).where(and(inArray(schema.outreachSequences.id, [...new Set(lastOut.map((x) => x.seq))]), eq(schema.outreachSequences.status, 'bounced')))).length : 0;
    if (m.policyBlock || bounced >= 3) await db.update(schema.mailboxes).set({ status: 'paused', statusReason: m.policyBlock ? 'A receiving server blocked a message as a policy issue: check SPF / DKIM / DMARC before sending more.' : `${bounced} of the last ${lastOut.length} e-mails bounced: check the addresses before sending more.`, updatedAt: now }).where(eq(schema.mailboxes.id, mb.id));
    return;
  }
  const firstOut = await db.select().from(schema.outreachMessages).where(and(eq(schema.outreachMessages.sequenceId, q.id), eq(schema.outreachMessages.direction, 'out'))).orderBy(schema.outreachMessages.at).limit(1);
  // D14: the business facts and the profile go with every reply, so the suggested answer states nothing the owner did not write
  let profile: ProfileRow | null = null;
  try { profile = (await siteRows<ProfileRow>('profiles', site.domain, { max: 5 }))[0] ?? null; } catch (e) { log.warn({ err: short(e) }, 'business profile not read for the reply'); }
  const reading = await replyRead(replyReadBody({ site, profile, mailbox: mb, sequence: q, ourSubject: firstOut[0]?.subject ?? q.steps[0]?.subject ?? '', ourBody: firstOut[0]?.body ?? '', from: m.from, subject: m.subject, text: m.kind === 'auto' ? m.text.slice(0, 3000) : text, now }));
  const cls = m.kind === 'auto' ? 'out_of_office' : (reading?.class ?? (/^\s*(no|stop|unsubscribe|remove me)\b/i.test(text) || /^unsubscribe$/i.test(m.subject.trim()) ? 'unsubscribe' : 'other'));
  if (cls === 'out_of_office') {   // the conversation keeps its place: the next step waits until they are back
    const back = reading?.return_date ? new Date(reading.return_date + 'T09:00:00Z') : parseReturnDate(m.text, now);   // the app reads the date itself when the Reply Reader is off
    const next = back && back.getTime() > now.getTime() ? addWorkingDays(back, 1) : addWorkingDays(now, 5);
    await db.update(schema.outreachSequences).set({ oooUntil: back ?? next, nextAt: q.status === 'active' && q.nextAt && q.nextAt.getTime() > next.getTime() ? q.nextAt : (q.status === 'active' ? next : q.nextAt), updatedAt: now }).where(eq(schema.outreachSequences.id, q.id));
    return;
  }
  const won = cls === 'says_linked' && !!reading?.link_found;
  await db.update(schema.outreachSequences).set({ status: won ? 'won' : 'replied', replyAt: now, replyFrom: m.from, replyClass: cls, replySummary: reading?.summary ?? '', suggestedReply: reading?.suggested_reply ?? '', nextAt: null, ...(won ? { wonAt: now } : {}), updatedAt: now }).where(eq(schema.outreachSequences.id, q.id));
  // a reply from anyone at that site stops every other open sequence to it (they have heard from us)
  await db.update(schema.outreachSequences).set({ status: 'stopped', error: 'Another person at this site replied', nextAt: null, updatedAt: now })
    .where(and(eq(schema.outreachSequences.orgId, q.orgId), eq(schema.outreachSequences.prospectDomain, q.prospectDomain), inArray(schema.outreachSequences.status, ACTIVE), sql`${schema.outreachSequences.id} <> ${q.id}`));
  if (cls === 'unsubscribe' || cls === 'declined') { await suppress(q.orgId, 'email', m.from, cls === 'unsubscribe' ? 'asked not to be contacted' : 'declined'); if (m.from !== q.toEmail) await suppress(q.orgId, 'email', q.toEmail, cls); }
  await setProspectStatus(site.domain, q.prospectDomain, q.prospectType, won ? 'won' : cls === 'unsubscribe' || cls === 'declined' ? 'rejected' : 'replied', cls === 'wants_payment' ? 'asked for payment, not pursued (paid links must be sponsored)' : cls === 'link_swap' ? 'asked for a link swap' : undefined, log);
  log.info({ sequence: q.id, cls }, 'outreach reply read');
}

/** L4: new messages of a Microsoft 365 mailbox, through Graph. A Gmail OAuth mailbox is not read: its scope is restricted. */
async function pollApiMailbox(mb: MailboxRow, log: Log): Promise<number> {
  const now = new Date();
  if (!mb.readsReplies) { await db.update(schema.mailboxes).set({ lastPollAt: now }).where(eq(schema.mailboxes.id, mb.id)); return 0; }
  let read = 0;
  try {
    const { messages, cursor } = await inboxViaApi(mb);
    for (const m of messages) {
      try { await handleIncoming(mb, await parseIncoming(m.mime), log); read++; } catch (e) { log.warn({ err: short(e), message: m.id }, 'incoming message not handled'); }
    }
    await db.update(schema.mailboxes).set({ oauthCursor: cursor, lastPollAt: new Date(), ...(mb.lastError.startsWith('Graph') ? { lastError: '' } : {}) }).where(eq(schema.mailboxes.id, mb.id));
  } catch (e) {
    await db.update(schema.mailboxes).set({ lastError: 'Graph: ' + short(e), lastPollAt: new Date() }).where(eq(schema.mailboxes.id, mb.id));
  }
  return read;
}

export async function pollTick(log: Log): Promise<number> {
  if (polling) return 0; polling = true; let read = 0;
  try {
    const mbs = await db.select().from(schema.mailboxes).where(inArray(schema.mailboxes.status, ['active', 'paused']));
    for (const mb of mbs) {
      // L4: an OAuth mailbox is read through its provider's API (Microsoft 365 only; Gmail's inbox scope is restricted by Google)
      if (isOauthMailbox(mb)) { read += await pollApiMailbox(mb, log); continue; }
      // L5: the inbox is read even before anything has been sent, the journalist digests arrive there.
      let conn; try { conn = connOf(mb); } catch { continue; }
      const c = imapClient(conn);
      try {
        await c.connect();
        const lock = await c.getMailboxLock('INBOX');
        try {
          const st = await c.status('INBOX', { uidNext: true, uidValidity: true });
          const validity = String(st.uidValidity ?? ''); let from = mb.lastUid;
          if (mb.uidValidity && validity !== mb.uidValidity) from = Math.max(0, Number(st.uidNext ?? 1) - 200);   // the server renumbered the inbox: re-read the last 200
          let last = from;
          if (Number(st.uidNext ?? 0) > from + 1) {
            for await (const msg of c.fetch(`${from + 1}:*`, { uid: true, source: true }, { uid: true })) {
              if (msg.uid <= from) continue; last = Math.max(last, msg.uid);
              try { await handleIncoming(mb, await parseIncoming(msg.source as Buffer), log); read++; } catch (e) { log.warn({ err: short(e), uid: msg.uid }, 'incoming message not handled'); }
            }
          }
          await db.update(schema.mailboxes).set({ lastUid: last, uidValidity: validity, lastPollAt: new Date(), ...(mb.lastError.startsWith('IMAP') ? { lastError: '' } : {}) }).where(eq(schema.mailboxes.id, mb.id));
        } finally { lock.release(); }
      } catch (e) {
        await db.update(schema.mailboxes).set({ lastError: 'IMAP: ' + short(e), lastPollAt: new Date() }).where(eq(schema.mailboxes.id, mb.id));
      } finally { await c.logout().catch(() => c.close()); }
    }
  } catch (e) { log.error({ err: short(e) }, 'outreach inbox poll failed'); } finally { polling = false; }
  return read;
}

/** Automatic mode (owner's choice per website): drafted sequences with a contact, a good fit and no consent question are approved, a few a day. */
export async function autoApproveTick(log: Log): Promise<number> {
  if (approving) return 0; approving = true; let done = 0;
  try {
    const sites = await db.select().from(schema.sites).where(sql`${schema.sites.linkSettings}->>'mode' = 'auto' and ${schema.sites.verifiedAt} is not null`);
    for (const site of sites) {
      const ls = linkSettingsOf(site);
      const today = await db.select({ c: sql<number>`count(*)::int` }).from(schema.outreachSequences).where(and(eq(schema.outreachSequences.siteId, site.id), sql`${schema.outreachSequences.approvedAt} > now() - interval '1 day'`));
      let left = ls.autoDailyMax - (today[0]?.c ?? 0); if (left <= 0) continue;
      const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, site.orgId) }); if (!org) continue;
      const rows = await siteRows<LinkOutreachRow>('linkOutreach', site.domain, { extra: [{ columnName: 'status', condition: 'eq', value: 'drafted' }], fresh: true });
      const taken = new Set((await db.select({ d: schema.outreachSequences.prospectDomain }).from(schema.outreachSequences).where(eq(schema.outreachSequences.orgId, site.orgId))).map((x) => x.d));
      for (const r of rows.sort((a, b) => Number(b.score) * (0.5 + Number(b.fit)) - Number(a.score) * (0.5 + Number(a.fit)))) {
        if (left <= 0) break; if (taken.has(String(r.prospect_domain)) || Number(r.fit) < 0.6 || r.type === 'press') continue;   // journalist answers always wait for a person
        if (String(r.status) !== 'drafted') continue;   // L2: a draft the gate held ("needs_edit") waits for a person, never for the automatic mode
        const to = String(r.contact_email || ''); if (!to || consentGate(String(r.country), to).needed || (await isSuppressed(site.orgId, to))) continue;
        let steps; try { steps = (JSON.parse(String(r.sequence_json || '[]')) as { wait_days: number; subject: string; body: string }[]).map((x, i) => ({ step: i, waitDays: Number(x.wait_days) || 0, subject: x.subject || '', body: x.body || '' })); } catch { continue; }
        try { await approve(org, site, null, { prospectDomain: String(r.prospect_domain), type: String(r.type), toEmail: to, steps }); done++; left--; taken.add(String(r.prospect_domain)); } catch (e) { log.warn({ err: short(e), prospect: r.prospect_domain }, 'automatic approval skipped'); }
      }
    }
  } catch (e) { log.error({ err: short(e) }, 'automatic approval failed'); } finally { approving = false; }
  return done;
}

/** A person's answer written in the app, sent now in the same thread from the sequence's mailbox (counts toward the daily total). */
export async function sendManual(q: OutreachSequenceRow, body: string, log: Log): Promise<void> {
  const mb = q.mailboxId ? await db.query.mailboxes.findFirst({ where: eq(schema.mailboxes.id, q.mailboxId) }) : undefined;
  if (!mb || mb.status === 'error') throw new Error('The mailbox of this conversation is not connected: check company settings > Mailboxes.');
  const c = await sentCounts(mb.id, new Date(Date.now() - 864e5));
  if (c.total >= mb.dailyMax) throw new Error(`This mailbox has sent its ${mb.dailyMax} e-mails for today: try again tomorrow.`);
  const thread = await db.select().from(schema.outreachMessages).where(eq(schema.outreachMessages.sequenceId, q.id)).orderBy(schema.outreachMessages.at);
  const lastIn = [...thread].reverse().find((m) => m.direction === 'in' && m.kind === 'reply');
  const to = lastIn?.fromEmail || q.toEmail;
  const mail = compose(mb, { sequenceId: q.id, step: q.step, to, subject: q.steps[0]!.subject, body: body + `\n\n${[mb.signatureName || mb.fromName, mb.signatureTitle, mb.company].filter(Boolean).join(', ')}`, firstSubject: q.steps[0]!.subject, country: q.country, foundOn: '', previousIds: thread.map((m) => m.messageId), manual: true });
  const oauth = isOauthMailbox(mb);
  const conn = oauth ? null : connOf(mb);
  const mid = oauth
    ? await sendRawViaApi(mb, await rawMessage(mail), mail.messageId)
    : String((await smtpTransport(conn!).sendMail({ from: mail.from, to: mail.to, subject: mail.subject, text: mail.text, messageId: mail.messageId, ...(mail.inReplyTo ? { inReplyTo: mail.inReplyTo, references: mail.references } : {}) })).messageId || mail.messageId);
  const now = new Date();
  await db.insert(schema.outreachMessages).values({ sequenceId: q.id, orgId: q.orgId, mailboxId: mb.id, direction: 'out', step: q.step, kind: 'manual', subject: mail.subject, body: mail.text, messageId: mid, inReplyTo: mail.inReplyTo ?? '', fromEmail: mb.fromEmail, toEmail: to, at: now });
  await db.update(schema.mailboxes).set({ lastSendAt: now, updatedAt: now }).where(eq(schema.mailboxes.id, mb.id));
  if (!oauth && !savesSentCopy(mb.smtpHost) && mb.sentFolder) { const cl = imapClient(conn!); try { await cl.connect(); await cl.append(mb.sentFolder, await rawMessage(mail), ['\\Seen']); } catch (e) { log.warn({ err: short(e) }, 'sent copy not saved'); } finally { await cl.logout().catch(() => cl.close()); } }
}
