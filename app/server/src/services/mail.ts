import { resolveTxt } from 'node:dns/promises';
import { ImapFlow } from 'imapflow';
import { simpleParser, type AddressObject } from 'mailparser';
import nodemailer from 'nodemailer';
import { emailDomain, footerLines, isAutoReply, isBounce, replySubject, type DnsCheck } from '@seo/shared';
import type { MailboxRow } from '../db/schema';
import { randomToken } from '../lib/crypto';
import { unseal } from '../lib/secretBox';

// v4.13 Link Builder: the customer's own mailbox (SMTP to send, IMAP to read replies) — connection test, DNS check, composing one e-mail of a
// sequence (plain text, threading headers, the compliance footer) and reading an incoming message (bounce / automatic reply / person).

export interface MailboxConn { smtpHost: string; smtpPort: number; smtpSecure: boolean; imapHost: string; imapPort: number; imapSecure: boolean; username: string; password: string }

export const connOf = (m: MailboxRow): MailboxConn => ({ smtpHost: m.smtpHost, smtpPort: m.smtpPort, smtpSecure: m.smtpSecure, imapHost: m.imapHost, imapPort: m.imapPort, imapSecure: m.imapSecure, username: m.username, password: unseal(m.secret) });

export function smtpTransport(c: MailboxConn) {
  return nodemailer.createTransport({ host: c.smtpHost, port: c.smtpPort, secure: c.smtpSecure, auth: { user: c.username, pass: c.password }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 45000 });
}

export function imapClient(c: MailboxConn) {
  return new ImapFlow({ host: c.imapHost, port: c.imapPort, secure: c.imapSecure, auth: { user: c.username, pass: c.password }, logger: false, socketTimeout: 60000, connectionTimeout: 20000 } as ConstructorParameters<typeof ImapFlow>[0]);
}

/** Gmail and Google Workspace keep a copy of what SMTP sends; other servers need it appended to the Sent folder. */
export const savesSentCopy = (smtpHost: string) => /(^|\.)gmail\.com$|^smtp\.googlemail\.com$/i.test(smtpHost);

export async function findSentFolder(client: ImapFlow): Promise<string> {
  const list = await client.list();
  const sent = list.find((f) => f.specialUse === '\\Sent') ?? list.find((f) => /^(sent|sent items|sent mail|sent messages|\[gmail\]\/sent mail)$/i.test(f.path));
  return sent?.path ?? '';
}

/** SPF, DMARC and DKIM (common selectors) of the sending domain: they decide whether pitches reach the inbox. */
export async function dnsCheck(domain: string): Promise<DnsCheck> {
  const txt = async (name: string) => { try { return (await resolveTxt(name)).map((r) => r.join('')); } catch { return [] as string[]; } };
  const notes: string[] = [];
  const spfRec = (await txt(domain)).find((t) => /^v=spf1/i.test(t));
  const spf: DnsCheck['spf'] = !spfRec ? 'missing' : /[+?]all\b/i.test(spfRec) ? 'weak' : 'pass';
  if (spf === 'missing') notes.push(`No SPF record on ${domain}: add the one your mail provider gives (e.g. "v=spf1 include:_spf.google.com ~all").`);
  if (spf === 'weak') notes.push('Your SPF record ends in "+all" or "?all": it lets anyone send as you; use "~all" or "-all".');
  const dm = (await txt(`_dmarc.${domain}`)).find((t) => /^v=DMARC1/i.test(t));
  const dmarc: DnsCheck['dmarc'] = !dm ? 'missing' : /\bp=none\b/i.test(dm) ? 'none' : 'pass';
  if (dmarc === 'missing') notes.push(`No DMARC record: add "_dmarc.${domain}" TXT "v=DMARC1; p=none; rua=mailto:dmarc@${domain}" to start.`);
  let dkim: DnsCheck['dkim'] = 'unknown';
  for (const sel of ['google', 'selector1', 'selector2', 'default', 'k1', 'dkim', 'mail', 's1', 's2', 'zoho', 'zmail', 'fm1', 'protonmail', 'mxvault']) {
    if ((await txt(`${sel}._domainkey.${domain}`)).some((t) => /p=/.test(t))) { dkim = 'found'; break; }
  }
  if (dkim === 'unknown') notes.push('No DKIM key found under the common selectors: check that DKIM signing is on in your mail provider.');
  return { spf, dmarc, dkim, checkedAt: new Date().toISOString(), notes };
}

export interface MailboxTest { smtp: { ok: boolean; error: string }; imap: { ok: boolean; error: string; sentFolder: string; uidNext: number; uidValidity: string }; dns: DnsCheck }
const short = (e: unknown) => String((e as Error)?.message || e).replace(/\s+/g, ' ').slice(0, 220);
/** Logs in to both servers (nothing is sent), finds the Sent folder and the inbox's position, checks the domain's DNS. */
export async function testMailbox(c: MailboxConn, fromEmail: string): Promise<MailboxTest> {
  const smtp = { ok: false, error: '' };
  try { await smtpTransport(c).verify(); smtp.ok = true; } catch (e) { smtp.error = short(e); }
  const imap = { ok: false, error: '', sentFolder: '', uidNext: 0, uidValidity: '' };
  const client = imapClient(c);
  try {
    await client.connect();
    imap.sentFolder = await findSentFolder(client);
    const st = await client.status('INBOX', { uidNext: true, uidValidity: true });
    imap.uidNext = Number(st.uidNext ?? 0); imap.uidValidity = String(st.uidValidity ?? ''); imap.ok = true;
  } catch (e) { imap.error = short(e); } finally { await client.logout().catch(() => client.close()); }
  return { smtp, imap, dns: await dnsCheck(emailDomain(fromEmail)) };
}

export const newMessageId = (sequenceId: string, step: number | string, fromEmail: string) => `<lb.${sequenceId.slice(0, 8)}.${step}.${randomToken(8)}@${emailDomain(fromEmail) || 'localhost'}>`;

export interface ComposedMail { from: string; to: string; subject: string; text: string; messageId: string; inReplyTo?: string; references?: string[]; headers: Record<string, string>; raw?: Buffer }
/** One e-mail of a sequence: plain text (no tracking), the footer every e-mail carries, threaded on the earlier messages. */
export function compose(m: MailboxRow, o: { sequenceId: string; step: number; to: string; subject: string; body: string; firstSubject: string; country: string; foundOn: string; previousIds: string[]; manual?: boolean }): ComposedMail {
  const first = o.step === 0 && !o.manual;
  const lines = footerLines({ name: m.signatureName || m.fromName, title: m.signatureTitle, company: m.company, postalAddress: m.postalAddress }, { firstEmail: first, country: o.country, foundOn: o.foundOn });
  const body = o.body.replace(/\r/g, '').trim();
  const text = (o.manual ? body : body + '\n' + lines.join('\n')).replace(/\n{3,}/g, '\n\n');
  const prev = o.previousIds.filter(Boolean);
  return {
    from: m.fromName ? `"${m.fromName.replace(/"/g, '')}" <${m.fromEmail}>` : m.fromEmail,
    to: o.to,
    subject: first ? o.subject.trim() : replySubject(o.firstSubject || o.subject),
    text,
    messageId: newMessageId(o.sequenceId, o.manual ? 'r' : o.step, m.fromEmail),
    ...(prev.length ? { inReplyTo: prev[prev.length - 1], references: prev.slice(-10) } : {}),
    // an unsubscribe the recipient's mail app can show; it lands in this mailbox, where the poller reads it as an opt-out
    headers: { 'List-Unsubscribe': `<mailto:${m.fromEmail}?subject=unsubscribe>` },
  };
}

/** The raw message (to append it to the Sent folder of servers that do not keep a copy of SMTP mail). */
export async function rawMessage(mail: ComposedMail): Promise<Buffer> {
  const t = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
  const info = await t.sendMail({ ...mail, messageId: mail.messageId });
  return info.message as Buffer;
}

export interface Incoming {
  messageId: string; inReplyTo: string; references: string[]; from: string; fromDomain: string; subject: string; text: string; date: Date | null;
  kind: 'bounce' | 'auto' | 'person'; bounceIds: string[]; bounceRecipients: string[]; hardBounce: boolean; policyBlock: boolean;
}
const addr = (a: AddressObject | AddressObject[] | undefined) => { const x = Array.isArray(a) ? a[0] : a; return String(x?.value?.[0]?.address ?? '').toLowerCase(); };
/** One incoming message: who wrote, which of our messages it answers, and whether it is a bounce, an automatic reply or a person. */
export async function parseIncoming(source: Buffer | string): Promise<Incoming> {
  const p = await simpleParser(source);
  const h: Record<string, string> = {};
  for (const [k, v] of p.headers) h[k.toLowerCase()] = typeof v === 'string' ? v : (v as { value?: string; text?: string })?.value ?? (v as { text?: string })?.text ?? JSON.stringify(v);
  const from = addr(p.from);
  const refs = (Array.isArray(p.references) ? p.references : p.references ? String(p.references).split(/\s+/) : []).filter(Boolean);
  const ct = String(h['content-type'] ?? '');
  const subject = String(p.subject ?? '');
  const bounce = isBounce(h, from, ct);
  const auto = !bounce && isAutoReply(h, subject);
  // a bounce carries the original message's headers (message/rfc822 or text/rfc822-headers) and a delivery-status part
  const parts = [String(p.text ?? ''), ...(p.attachments ?? []).map((a) => a.content?.toString('utf8') ?? '')].join('\n');
  const bounceIds = bounce ? [...parts.matchAll(/^message-id:\s*(<[^>\s]+>)/gim)].map((m) => m[1]!) : [];
  const bounceRecipients = bounce ? [...new Set([...parts.matchAll(/^(?:final|original)-recipient:\s*rfc822;\s*<?([^>\s]+@[^>\s]+)>?/gim)].map((m) => m[1]!.toLowerCase()))] : [];
  const status = bounce ? (parts.match(/^status:\s*([245])\.(\d+)\.(\d+)/im) ?? parts.match(/\b([45])\.(\d)\.(\d{1,3})\b/)) : null;
  return {
    messageId: String(p.messageId ?? ''), inReplyTo: String(p.inReplyTo ?? ''), references: refs, from, fromDomain: emailDomain(from), subject,
    text: String(p.text ?? '').slice(0, 20000), date: p.date ?? null, kind: bounce ? 'bounce' : auto ? 'auto' : 'person', bounceIds, bounceRecipients,
    hardBounce: bounce && (!status || status[1] === '5'), policyBlock: !!status && status[1] === '5' && status[2] === '7',
  };
}

/** The reply text without the quoted e-mail below it (what the Reply Reader and the person need). */
export function stripQuoted(text: string): string {
  const cut = text.search(/\n(On .{5,200}wrote:|-{2,}\s*Original Message\s*-{2,}|From: .+\n(Sent|Date): |_{10,})/i);
  return (cut > 0 ? text.slice(0, cut) : text).split('\n').filter((l) => !/^>/.test(l)).join('\n').trim().slice(0, 6000);
}
