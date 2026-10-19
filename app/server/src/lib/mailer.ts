import nodemailer from 'nodemailer';
import { figureLines, type DeliveryItem } from '@seo/shared';
import { config } from '../config';

// Account e-mails (verification, password reset, invitations). Sent only with ACCOUNT_EMAILS=true and SMTP settings (the n8n Gmail
// account); otherwise the message and its link are written to the log, and the app works without e-mail (links are shown in the app).
// Built on first use, not on import: a module that opens a connection the moment it is loaded makes every test that imports
// anything downstream of it carry a mail configuration it does not need.
type Transport = ReturnType<typeof nodemailer.createTransport> | null;
let accountTransport: Transport | undefined;
const transportFor = (): Transport =>
  config.mail?.enabled
    ? nodemailer.createTransport({ host: config.mail.host, port: config.mail.port, secure: config.mail.port === 465, auth: { user: config.mail.user, pass: config.mail.password } })
    : null;
const transport = (): Transport => {
  if (accountTransport === undefined) accountTransport = config.mail?.enabled && config.accountEmails ? transportFor() : null;
  return accountTransport;
};

export interface Mail {
  to: string;
  subject: string;
  /** short paragraphs; the first link button is built from `action` */
  lines: string[];
  action?: { label: string; url: string };
  footer?: string;
  /** G5: an agency's sender (name, From, reply-to, its own mailbox) for e-mails to its clients; default = the app's own */
  sender?: MailSender;
  /** the headline above the paragraphs */
  title?: string;
  /** the line inbox previews show after the subject (default: the first paragraph) */
  preheader?: string;
  /** a small table of facts (company, role, valid until...) under the paragraphs */
  details?: { label: string; value: string }[];
}

/** G5: one message as handed to a transport */
export interface MailPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  headers?: Record<string, string>;
  attachments?: { filename: string; content: Buffer }[];
}

/** G5 (services/portalMail.ts `senderFor`): who a message comes from and under which name */
export interface MailSender {
  brandName: string;
  /** the button colour (passes AA with white text) or null for the default */
  buttonColor: string | null;
  from: string;
  replyTo?: string;
  /** the agency's own mailbox sends (custom From) */
  via?: (m: MailPayload) => Promise<void>;
  /** true for a white-label agency: its name and logo, its support address, nothing of ours */
  whiteLabel?: boolean;
  /** a white-label agency's logo (https), shown instead of ours */
  logoUrl?: string | null;
  /** the agency's own footer line and support address */
  footerText?: string | null;
  supportEmail?: string | null;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// Brand tokens (app/web/brand/tokens.css), written inline: e-mail clients read no stylesheet.
const C = { ink: '#0A0F1F', blue: '#2E4BFF', paper: '#F6F7FB', line: '#E3E7F0', slate: '#4A5468', mist: '#5B6478', white: '#FFFFFF' };
const FONT = "'Segoe UI',-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif";
const HEAD_FONT = "Sora,'Segoe UI',-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif";

// Inbox placement. Gmail files a message under Promotions on what it looks like: many links, several images, product cards and a
// row of site links read as a newsletter. An account e-mail therefore carries one image (the logo), one button, the same link
// written out, and one help link, and nothing that sells. It is marked as an automatic message (RFC 3834) so out-of-office replies
// are not sent back, and it has no List-Unsubscribe header: that header is what bulk mail carries.
const TRANSACTIONAL_HEADERS: Record<string, string> = { 'Auto-Submitted': 'auto-generated', 'X-Auto-Response-Suppress': 'OOF, AutoReply' };

/**
 * The logo is one static PNG on our own domain (web/public/brand/alaventra-email-logo.png, rendered from the supplied header SVG:
 * Gmail and Outlook show no SVG). It is the same file for every recipient, so it tracks no one; with images off the alt text
 * shows the name in the brand's ink.
 */
const OUR_LOGO = { path: '/brand/alaventra-email-logo.png', width: 160, height: 32 };

interface Look {
  brandName: string;
  color: string;
  whiteLabel: boolean;
  logoUrl: string | null;
  footerText: string | null;
  /** where a reader with a problem goes: a page and / or an address */
  helpUrl: string | null;
  helpEmail: string | null;
}

function lookOf(sender: MailSender | undefined): Look {
  const whiteLabel = !!sender?.whiteLabel;
  const color = sender?.buttonColor && /^#[0-9a-f]{6}$/i.test(sender.buttonColor) ? sender.buttonColor : C.blue;
  const logoUrl = whiteLabel
    ? sender?.logoUrl && /^https:\/\//i.test(sender.logoUrl) && !/\.svg(?:$|[?#])/i.test(sender.logoUrl) // Gmail and Outlook draw no SVG: the name then
      ? sender.logoUrl
      : null
    : `${config.appUrl.replace(/\/+$/, '')}${OUR_LOGO.path}`;
  return {
    brandName: sender?.brandName ?? config.brand,
    color,
    whiteLabel,
    logoUrl,
    footerText: whiteLabel ? (sender?.footerText ?? null) : null,
    helpUrl: whiteLabel ? null : config.support.url || null,
    helpEmail: whiteLabel ? (sender?.supportEmail ?? null) : config.support.email || null,
  };
}

function logoHtml(l: Look): string {
  const alt = `font-family:${HEAD_FONT};font-size:18px;font-weight:700;letter-spacing:.08em;color:${C.ink}`;
  if (!l.logoUrl) return `<div style="${alt}">${esc(l.brandName)}</div>`;
  const size = l.whiteLabel
    ? `height="32" style="display:block;border:0;height:32px;width:auto;max-width:220px;${alt}"`
    : `width="${OUR_LOGO.width}" height="${OUR_LOGO.height}" style="display:block;border:0;width:${OUR_LOGO.width}px;height:${OUR_LOGO.height}px;${alt}"`;
  return `<img src="${esc(l.logoUrl)}" alt="${esc(l.brandName)}" ${size}>`;
}

/** a button made of a table cell, so Outlook draws its colour and padding too */
function buttonHtml(label: string, url: string, color: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 8px"><tr><td align="center" bgcolor="${color}" style="border-radius:10px;background:${color}">
<a href="${esc(url)}" target="_blank" style="display:inline-block;padding:14px 26px;font-family:${FONT};font-size:15px;font-weight:600;line-height:20px;color:${C.white};text-decoration:none;border-radius:10px">${esc(label)}</a></td></tr></table>`;
}

/** "Need help?": the support page and / or address; nothing when neither is known (a white-label agency without an address) */
function helpHtml(l: Look): string {
  const page = l.helpUrl ? `<a href="${esc(l.helpUrl)}" target="_blank" style="color:${l.color};text-decoration:none;font-weight:600">Help and support</a>` : '';
  const mail = l.helpEmail ? `<a href="mailto:${esc(l.helpEmail)}" style="color:${l.color};text-decoration:none;font-weight:600">${esc(l.helpEmail)}</a>` : '';
  if (!page && !mail) return '';
  const how = page && mail ? `${page}, or write to ${mail}.` : page ? `${page}: tell us what happened and we will help.` : `Write to ${mail}.`;
  return `<p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:${C.slate}">Something not working, or a question? ${how}</p>`;
}

function helpText(l: Look): string {
  if (l.helpUrl && l.helpEmail) return `Something not working, or a question? Help and support: ${l.helpUrl} or write to ${l.helpEmail}.`;
  if (l.helpUrl) return `Something not working, or a question? Help and support: ${l.helpUrl}`;
  if (l.helpEmail) return `Something not working, or a question? Write to ${l.helpEmail}.`;
  return '';
}

/** the frame every message shares: preheader, logo, the white card, the help line and the footer */
function shell(l: Look, o: { preheader: string; card: string; reason: string; width: number }): string {
  const foot = [
    l.footerText ? `<p style="margin:0 0 8px">${esc(l.footerText)}</p>` : '',
    o.reason ? `<p style="margin:0 0 8px">${esc(o.reason)}</p>` : '',
    l.whiteLabel ? '' : `<p style="margin:0">&copy; ${new Date().getFullYear()} ${esc(config.brand)}</p>`,
  ].join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(l.brandName)}</title></head>
<body style="margin:0;padding:0;background:${C.paper};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:${o.width}px;font-family:${FONT};color:${C.ink}">
<tr><td style="padding:0 4px 22px">${logoHtml(l)}</td></tr>
<tr><td style="background:${C.white};border:1px solid ${C.line};border-radius:14px;overflow:hidden">
<div style="height:4px;line-height:4px;font-size:0;background:${l.color}">&nbsp;</div>
<div style="padding:32px 32px 28px">${o.card}${helpHtml(l)}</div></td></tr>
<tr><td style="padding:22px 4px 0;font-size:12px;line-height:1.6;color:${C.mist}">${foot}</td></tr>
</table></td></tr></table></body></html>`;
}

export function renderMail(m: Mail): { html: string; text: string } {
  const l = lookOf(m.sender);
  const p = (t: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${C.ink}">${esc(t)}</p>`;
  const cell = (i: number) => (i ? `border-top:1px solid ${C.line};` : '');
  const details = m.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 4px;background:${C.paper};border-radius:10px">${m.details
        .map(
          (d, i) =>
            `<tr><td style="padding:10px 16px;font-size:13px;color:${C.mist};${cell(i)}">${esc(d.label)}</td><td align="right" style="padding:10px 16px;font-size:13px;font-weight:600;color:${C.ink};${cell(i)}">${esc(d.value)}</td></tr>`,
        )
        .join('')}</table>`
    : '';
  const action = m.action
    ? `${buttonHtml(m.action.label, m.action.url, l.color)}
<p style="margin:20px 0 0;padding:16px 0 0;border-top:1px solid ${C.line};font-size:12px;line-height:1.55;color:${C.mist}">If the button does not work, copy this link into your browser:<br><a href="${esc(m.action.url)}" style="color:${l.color};word-break:break-all">${esc(m.action.url)}</a></p>`
    : '';
  const card = `${m.title ? `<h1 style="margin:0 0 18px;font-family:${HEAD_FONT};font-size:24px;line-height:1.3;font-weight:700;color:${C.ink}">${esc(m.title)}</h1>` : ''}
${m.lines.map(p).join('\n')}${details}${action}`;
  const reason = m.footer ?? 'You received this e-mail because of an action on your account. If it was not you, you can ignore it.';
  const html = shell(l, { preheader: m.preheader ?? m.lines[0] ?? m.subject, card, reason, width: 560 });
  const text = [
    ...(m.title ? [m.title] : []),
    ...m.lines,
    ...(m.details?.length ? [m.details.map((d) => `${d.label}: ${d.value}`).join('\n')] : []),
    m.action ? `${m.action.label}: ${m.action.url}` : '',
    helpText(l),
    '',
    m.footer ?? '',
  ]
    .filter((x, i, a) => x || i < a.length - 1)
    .join('\n\n');
  return { html, text };
}

/** Reply-To: the sender's (an agency's), else our support address when one is set */
const replyToOf = (sender: MailSender | undefined): string | undefined => sender?.replyTo || (!sender?.whiteLabel && config.support.email) || undefined;

export async function sendMail(m: Mail, log: { info: (o: object, msg: string) => void; error: (o: object, msg: string) => void }): Promise<boolean> {
  const { html, text } = renderMail(m);
  const t = transport();
  if (!t) {
    // the link is a credential (reset / verification): logged only in development
    log.info({ to: m.to, subject: m.subject, ...(config.isProd ? {} : { link: m.action?.url }) }, 'e-mail not sent (ACCOUNT_EMAILS off or no SMTP)');
    return false;
  }
  try {
    const replyTo = replyToOf(m.sender);
    const msg: MailPayload = { from: m.sender?.from || config.mail.from, to: m.to, subject: m.subject, html, text, headers: TRANSACTIONAL_HEADERS, ...(replyTo ? { replyTo } : {}) };
    if (m.sender?.via) await m.sender.via(msg);
    else await t.sendMail(msg);
    return true;
  } catch (err) {
    log.error({ err: String(err), to: m.to, subject: m.subject }, 'e-mail failed');
    return false;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------
// B-R1, report delivery
// ---------------------------------------------------------------------------------------------------------------------------
// Reports go out through their own transport, for one reason: `ACCOUNT_EMAILS` governs verification and reset links and is off on
// this stack, while a customer who asked for their Monday report by e-mail asked for something else entirely. A report message is
// sent whenever SMTP is configured at all. Everything else matches the account mail above: the same frame, the same colours, the
// one static logo and no tracking pixel.
let builtReportTransport: Transport | undefined;
const reportTransport = (): Transport => {
  if (builtReportTransport === undefined) builtReportTransport = transportFor();
  return builtReportTransport;
};

export interface ReportMail extends Mail {
  /** the reports in this message, so each is laid out with its own figures and links */
  reports: DeliveryItem[];
  attachments?: { filename: string; content: Buffer }[];
}

/** One report card: what it is, the figures it carried, and the links that open it. */
function reportCard(r: DeliveryItem, l: Look): string {
  const rows = figureLines(r)
    .map(
      (f) =>
        `<tr><td style="padding:5px 12px 5px 0;color:${C.slate};font-size:13px;border-top:1px solid ${C.line}">${esc(f.label)}</td><td align="right" style="padding:5px 0;font-size:13px;font-weight:600;color:${C.ink};text-align:right;font-variant-numeric:tabular-nums;border-top:1px solid ${C.line}">${esc(f.value)}</td></tr>`,
    )
    .join('');
  const links = [
    `<a href="${esc(r.url)}" target="_blank" style="color:${l.color};text-decoration:none;font-weight:600">Open in ${esc(l.brandName)}</a>`,
    r.shareUrl ? `<a href="${esc(r.shareUrl)}" target="_blank" style="color:${l.color};text-decoration:none">Share this report</a>` : '',
    r.files.length ? `<span style="color:${C.mist}">${r.files.length} file${r.files.length === 1 ? '' : 's'}</span>` : '',
  ]
    .filter(Boolean)
    .join(`<span style="color:${C.line}"> &nbsp;|&nbsp; </span>`);
  return `<div style="border:1px solid ${C.line};border-radius:10px;padding:18px;margin:0 0 14px;background:${C.white}">
<div style="font-size:12px;font-weight:600;color:${C.mist};text-transform:uppercase;letter-spacing:.06em">${esc(r.stageLabel)}${r.siteDomain ? ` &middot; ${esc(r.siteDomain)}` : ''}</div>
<div style="font-family:${HEAD_FONT};font-size:17px;font-weight:700;color:${C.ink};margin:4px 0 12px">${esc(r.title)}</div>
${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:12px">${rows}</table>` : ''}
<div style="font-size:13px">${links}</div></div>`;
}

/** Sends one delivery. Returns false and logs rather than throwing: a delivery that fails must never lose the report. */
export async function sendReportMail(
  m: ReportMail,
  log: { info: (o: object, msg: string) => void; error: (o: object, msg: string) => void },
): Promise<boolean> {
  const l = lookOf(m.sender);
  const text = [...m.lines, helpText(l), m.footer ?? ''].filter(Boolean).join('\n\n');
  const t = reportTransport();
  if (!t && !m.sender?.via) {
    log.info({ to: m.to, subject: m.subject, reports: m.reports.length }, 'report not e-mailed (no SMTP configured)');
    return false;
  }
  const held = m.lines.filter((l) => /^Not sent(?: —|:|,) /.test(l));
  const card = `<p style="margin:0 0 18px;line-height:1.6;font-size:15px;color:${C.ink}">${esc(m.lines[0] ?? '')}</p>
${m.reports.map((r) => reportCard(r, l)).join('\n')}
${held.length ? `<div style="border:1px solid ${C.line};border-radius:10px;padding:14px 18px;margin:0 0 14px;background:${C.paper}"><div style="font-size:13px;color:${C.slate}">${held.map((h) => esc(h)).join('<br>')}</div></div>` : ''}`;
  const html = shell(l, { preheader: m.lines[0] ?? m.subject, card, reason: m.footer ?? '', width: 620 });
  const replyTo = replyToOf(m.sender);
  try {
    const msg: MailPayload = {
      from: m.sender?.from || config.mail.from,
      to: m.to,
      subject: m.subject,
      html,
      text,
      headers: TRANSACTIONAL_HEADERS,
      ...(replyTo ? { replyTo } : {}),
      ...(m.attachments?.length ? { attachments: m.attachments } : {}),
    };
    if (m.sender?.via) await m.sender.via(msg);
    else await t!.sendMail(msg);
    return true;
  } catch (err) {
    log.error({ err: String(err), to: m.to, subject: m.subject }, 'report delivery e-mail failed');
    return false;
  }
}
