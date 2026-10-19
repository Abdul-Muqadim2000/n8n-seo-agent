import { resolveTxt } from 'node:dns/promises';
import { and, eq, isNull } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import type { FastifyRequest } from 'fastify';
import {
  brandTokens,
  emailDomain,
  fromCheckPasses,
  isClientRole,
  portalMailOf,
  portalMailSchema,
  senderDisplayName,
  type PortalBrand,
  type PortalFromCheck,
  type PortalMailView,
} from '@seo/shared';
import { config } from '../config';
import { db, schema } from '../db';
import type { MailboxRow, OrgRow } from '../db/schema';
import { badRequest, notFound, parse } from '../lib/errors';
import type { MailPayload, MailSender } from '../lib/mailer';
import { agencyOf, brandForOrg } from './brandOf';
import { audit } from './audit';
import { connOf, dnsCheck, smtpTransport } from './mail';
import { isOauthMailbox, sendRawViaApi } from './mailOauth';
import { agencyPortalHost, portalUrl } from './portalHosts';

/**
 * G5 (WHITE_LABEL.md §1.5, §2): what e-mails to an agency's clients look like and who they come from, the agency's name as the
 * sender, its reply-to, and a custom From only through a mailbox the agency connected whose domain publishes SPF and a DKIM key, * and which address links in them open (the agency's portal host when it has one).
 */

/** the agency behind a company (itself, or a client workspace's parent) */
async function agencyBehind(org: OrgRow): Promise<OrgRow | null> {
  if (org.kind === 'agency') return org;
  if (org.kind === 'client') return agencyOf(org);
  return null;
}

/** where links for this company point: the agency's verified portal host when white-label is on, else the app */
export async function baseUrlFor(org: OrgRow | null): Promise<string> {
  if (!org) return config.appUrl;
  const brand = await brandForOrg(org);
  if (!brand) return config.appUrl;
  const agency = await agencyBehind(org);
  const host = await agencyPortalHost(agency?.id);
  return host ? portalUrl(host) : config.appUrl;
}

export interface BrandedSender extends MailSender {
  brand: PortalBrand | null;
  /** the name in the message header and body */
  brandName: string;
  /** the button colour (AA with white text), or null for the default */
  buttonColor: string | null;
  from: string;
  replyTo?: string;
  /** set when the agency's own mailbox sends (custom From) */
  via?: (m: MailPayload) => Promise<void>;
}

const addressOf = (from: string): string => /<([^>]+)>/.exec(from)?.[1]?.trim() ?? from.trim();
const FROM_CHECK_DAYS = 7;
const checkFresh = (c: PortalFromCheck | null | undefined, now = new Date()) => !!c && now.getTime() - Date.parse(c.checkedAt) < FROM_CHECK_DAYS * 864e5;

async function sendViaMailbox(mb: MailboxRow, m: MailPayload): Promise<void> {
  if (isOauthMailbox(mb)) {
    const t = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
    const messageId = `<portal.${Date.now()}.${Math.random().toString(36).slice(2, 10)}@${emailDomain(mb.fromEmail) || 'localhost'}>`;
    const info = await t.sendMail({ ...m, messageId });
    await sendRawViaApi(mb, info.message as Buffer, messageId);
    return;
  }
  await smtpTransport(connOf(mb)).sendMail(m);
}

/** who e-mails to this company's people come from, and under which name */
export async function senderFor(org: OrgRow | null): Promise<BrandedSender> {
  const plain: BrandedSender = { brand: null, brandName: config.brand, buttonColor: null, from: config.mail.from };
  if (!org) return plain;
  const brand = await brandForOrg(org);
  const agency = await agencyBehind(org);
  if (!brand || !agency) return plain;
  const s = portalMailOf(agency.portalMail);
  const name = senderDisplayName(s.senderName || brand.name) || brand.name;
  const replyTo = s.replyTo || brand.supportEmail || undefined;
  const buttonColor = brand.accent ? (brandTokens(brand.accent)?.light.accent ?? null) : null;
  const look = { whiteLabel: true, logoUrl: brand.logoUrl, footerText: brand.footerText, supportEmail: brand.supportEmail || s.replyTo || null };
  if (s.fromMailboxId) {
    const mb = await db.query.mailboxes.findFirst({ where: and(eq(schema.mailboxes.id, s.fromMailboxId), eq(schema.mailboxes.orgId, agency.id)) });
    if (mb && mb.status === 'active' && fromCheckPasses(s.fromCheck) && s.fromCheck?.email === mb.fromEmail.toLowerCase() && checkFresh(s.fromCheck))
      return { brand, brandName: brand.name, buttonColor, ...look, from: `"${name}" <${mb.fromEmail}>`, replyTo, via: (m) => sendViaMailbox(mb, m) };
  }
  const platform = addressOf(config.mail.from);
  return { brand, brandName: brand.name, buttonColor, ...look, from: platform ? `"${name}" <${platform}>` : config.mail.from, replyTo };
}

/**
 * For a person's own account e-mails (verification, password): the agency's sender when every company they belong to is a client
 * workspace of one white-label agency, a client's people never get an e-mail in our name. Anyone else: the app's own.
 */
export async function senderForUser(userId: string): Promise<{ sender: BrandedSender; baseUrl: string }> {
  const rows = await db
    .select({ org: schema.organizations, role: schema.memberships.role })
    .from(schema.memberships)
    .innerJoin(schema.organizations, eq(schema.memberships.orgId, schema.organizations.id))
    .where(and(eq(schema.memberships.userId, userId), isNull(schema.memberships.deactivatedAt)));
  const agencies = new Set(rows.map((r) => (r.org.kind === 'client' ? r.org.parentOrgId : `self:${r.org.id}`)));
  if (rows.length && rows.every((r) => r.org.kind === 'client' && isClientRole(r.role)) && agencies.size === 1)
    return { sender: await senderFor(rows[0]!.org), baseUrl: await baseUrlFor(rows[0]!.org) };
  return { sender: await senderFor(null), baseUrl: config.appUrl };
}

// ---- settings (Company settings -> Client e-mail, agency admins) ----

export async function mailView(agency: OrgRow): Promise<PortalMailView> {
  const s = portalMailOf(agency.portalMail);
  const mbs = await db.select().from(schema.mailboxes).where(eq(schema.mailboxes.orgId, agency.id));
  const fromMb = s.fromMailboxId ? mbs.find((m) => m.id === s.fromMailboxId) : undefined;
  const sender = await senderFor(agency);
  return {
    senderName: s.senderName,
    replyTo: s.replyTo,
    fromMailboxId: s.fromMailboxId,
    dkimSelector: s.dkimSelector,
    fromEmail: fromMb?.fromEmail ?? null,
    fromCheck: s.fromCheck ?? null,
    effectiveFrom: sender.from || '(no mail account on this server)',
    mailboxes: mbs.map((m) => ({ id: m.id, email: m.fromEmail, label: m.label, status: m.status })),
    smtpConfigured: config.mail.enabled,
  };
}

export interface FromDns {
  check: typeof dnsCheck;
  txt: (name: string) => Promise<string[][]>;
}
let fromDns: FromDns = { check: dnsCheck, txt: (n) => resolveTxt(n) };
/** tests: answer the SPF / DKIM lookups from a table */
export const setFromDns = (d: Partial<FromDns> | null) => {
  fromDns = d ? { check: dnsCheck, txt: (n) => resolveTxt(n), ...d } : { check: dnsCheck, txt: (n) => resolveTxt(n) };
};

/** SPF and DKIM of a mailbox's domain (the mailbox checks of v4.13, plus the selector the agency named) */
export async function checkFrom(email: string, selector: string): Promise<PortalFromCheck> {
  const domain = emailDomain(email);
  const d = await fromDns.check(domain);
  let dkim: PortalFromCheck['dkim'] = d.dkim === 'found' ? 'found' : 'unknown';
  if (dkim !== 'found' && selector) {
    try {
      if ((await fromDns.txt(`${selector}._domainkey.${domain}`)).some((r) => /p=/.test(r.join('')))) dkim = 'found';
    } catch {
      /* not found */
    }
  }
  const notes = [...d.notes.filter((n) => !(dkim === 'found' && /DKIM/.test(n)))];
  if (dkim !== 'found' && selector) notes.push(`No DKIM key at ${selector}._domainkey.${domain}.`);
  const res: PortalFromCheck = { ok: false, email: email.toLowerCase(), spf: d.spf, dkim, checkedAt: new Date().toISOString(), notes };
  res.ok = fromCheckPasses(res);
  return res;
}

export async function saveMailSettings(req: FastifyRequest, agency: OrgRow, body: unknown): Promise<PortalMailView> {
  const b = parse(portalMailSchema, body);
  let fromCheck: PortalFromCheck | null = null;
  if (b.fromMailboxId) {
    const mb = await db.query.mailboxes.findFirst({ where: and(eq(schema.mailboxes.id, b.fromMailboxId), eq(schema.mailboxes.orgId, agency.id)) });
    if (!mb) throw notFound('Mailbox not found');
    fromCheck = await checkFrom(mb.fromEmail, b.dkimSelector);
    if (!fromCheck.ok)
      throw badRequest(
        `${mb.fromEmail} cannot be the sender yet: ${fromCheck.spf !== 'pass' ? 'its domain needs an SPF record that does not allow everyone' : 'no DKIM key was found for its domain'}. ${fromCheck.notes[0] ?? ''}`.trim(),
        { fromMailboxId: 'SPF and DKIM must both verify' },
        'from_not_verified',
      );
  }
  const before = portalMailOf(agency.portalMail);
  const next = { ...b, fromCheck };
  const [o] = await db.update(schema.organizations).set({ portalMail: next }).where(eq(schema.organizations.id, agency.id)).returning();
  await audit(req, agency.id, {
    action: 'portal.mail_updated',
    target: { type: 'company', id: agency.id, label: agency.name },
    details: { before: { senderName: before.senderName, replyTo: before.replyTo, fromMailboxId: before.fromMailboxId }, after: { senderName: b.senderName, replyTo: b.replyTo, fromMailboxId: b.fromMailboxId } },
  });
  return mailView(o);
}

/** re-runs the check of the chosen mailbox (the button on the settings page); the result is stored */
export async function recheckFrom(agency: OrgRow): Promise<PortalMailView> {
  const s = portalMailOf(agency.portalMail);
  if (!s.fromMailboxId) throw badRequest('Choose a mailbox first.');
  const mb = await db.query.mailboxes.findFirst({ where: and(eq(schema.mailboxes.id, s.fromMailboxId), eq(schema.mailboxes.orgId, agency.id)) });
  if (!mb) throw notFound('Mailbox not found');
  const fromCheck = await checkFrom(mb.fromEmail, s.dkimSelector);
  const [o] = await db.update(schema.organizations).set({ portalMail: { ...s, fromCheck } }).where(eq(schema.organizations.id, agency.id)).returning();
  return mailView(o);
}
