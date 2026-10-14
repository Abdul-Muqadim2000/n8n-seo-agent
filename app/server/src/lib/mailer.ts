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
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function renderMail(m: Mail): { html: string; text: string } {
  const button = m.action
    ? `<p style="margin:28px 0"><a href="${esc(m.action.url)}" style="background:#2a78d6;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">${esc(m.action.label)}</a></p><p style="color:#52514e;font-size:13px">Or open this link: <br><a href="${esc(m.action.url)}" style="color:#2a78d6;word-break:break-all">${esc(m.action.url)}</a></p>`
    : '';
  const html = `<!doctype html><html><body style="margin:0;background:#f6f6f3;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0b0b0b">
<div style="max-width:520px;margin:0 auto;padding:32px 20px"><div style="font-weight:700;font-size:16px;margin-bottom:24px">${esc(config.brand)}</div>
<div style="background:#ffffff;border:1px solid #e1e0d9;border-radius:12px;padding:28px">
${m.lines.map((l) => `<p style="margin:0 0 14px;line-height:1.55;font-size:15px">${esc(l)}</p>`).join('\n')}${button}</div>
<p style="color:#898781;font-size:12px;margin-top:20px">${esc(m.footer ?? 'You received this e-mail because of an action on your account. If it was not you, you can ignore it.')}</p></div></body></html>`;
  const text = [...m.lines, m.action ? `${m.action.label}: ${m.action.url}` : '', '', m.footer ?? ''].filter((x, i, a) => x || i < a.length - 1).join('\n\n');
  return { html, text };
}

export async function sendMail(m: Mail, log: { info: (o: object, msg: string) => void; error: (o: object, msg: string) => void }): Promise<boolean> {
  const { html, text } = renderMail(m);
  const t = transport();
  if (!t) {
    // the link is a credential (reset / verification): logged only in development
    log.info({ to: m.to, subject: m.subject, ...(config.isProd ? {} : { link: m.action?.url }) }, 'e-mail not sent (ACCOUNT_EMAILS off or no SMTP)');
    return false;
  }
  try {
    await t.sendMail({ from: config.mail.from, to: m.to, subject: m.subject, html, text });
    return true;
  } catch (err) {
    log.error({ err: String(err), to: m.to, subject: m.subject }, 'e-mail failed');
    return false;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------
// B-R1 — report delivery
// ---------------------------------------------------------------------------------------------------------------------------
// Reports go out through their own transport, for one reason: `ACCOUNT_EMAILS` governs verification and reset links and is off on
// this stack, while a customer who asked for their Monday report by e-mail asked for something else entirely. A report message is
// sent whenever SMTP is configured at all. Everything else matches the account mail above: the same wrapper, the same colours, no
// tracking pixel and no remote images.
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
function reportCard(r: DeliveryItem): string {
  const rows = figureLines(r)
    .map(
      (f) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#52514e;font-size:13px">${esc(f.label)}</td><td style="padding:4px 0;font-size:13px;font-weight:600;text-align:right;font-variant-numeric:tabular-nums">${esc(f.value)}</td></tr>`,
    )
    .join('');
  const links = [
    `<a href="${esc(r.url)}" style="color:#2a78d6;text-decoration:none;font-weight:600">Open in ${esc(config.brand)}</a>`,
    r.shareUrl ? `<a href="${esc(r.shareUrl)}" style="color:#2a78d6;text-decoration:none">Share this report</a>` : '',
    r.files.length ? `<span style="color:#898781">${r.files.length} file${r.files.length === 1 ? '' : 's'}</span>` : '',
  ]
    .filter(Boolean)
    .join('<span style="color:#c9c7bf"> &nbsp;&middot;&nbsp; </span>');
  return `<div style="border:1px solid #e1e0d9;border-radius:10px;padding:18px;margin:0 0 14px;background:#ffffff">
<div style="font-size:12px;color:#898781;text-transform:uppercase;letter-spacing:.04em">${esc(r.stageLabel)}${r.siteDomain ? ` &middot; ${esc(r.siteDomain)}` : ''}</div>
<div style="font-size:16px;font-weight:700;margin:4px 0 12px">${esc(r.title)}</div>
${rows ? `<table style="width:100%;border-collapse:collapse;margin-bottom:12px">${rows}</table>` : ''}
<div style="font-size:13px">${links}</div></div>`;
}

/** Sends one delivery. Returns false and logs rather than throwing: a delivery that fails must never lose the report. */
export async function sendReportMail(
  m: ReportMail,
  log: { info: (o: object, msg: string) => void; error: (o: object, msg: string) => void },
): Promise<boolean> {
  const text = [...m.lines, m.footer ?? ''].filter(Boolean).join('\n\n');
  const t = reportTransport();
  if (!t) {
    log.info({ to: m.to, subject: m.subject, reports: m.reports.length }, 'report not e-mailed (no SMTP configured)');
    return false;
  }
  const held = m.lines.filter((l) => l.startsWith('Not sent — '));
  const html = `<!doctype html><html><body style="margin:0;background:#f6f6f3;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0b0b0b">
<div style="max-width:620px;margin:0 auto;padding:32px 20px"><div style="font-weight:700;font-size:16px;margin-bottom:20px">${esc(config.brand)}</div>
<p style="margin:0 0 18px;line-height:1.55;font-size:15px">${esc(m.lines[0] ?? '')}</p>
${m.reports.map(reportCard).join('\n')}
${held.length ? `<div style="border:1px solid #e1e0d9;border-radius:10px;padding:14px 18px;margin:0 0 14px;background:#ffffff"><div style="font-size:13px;color:#52514e">${held.map((l) => esc(l)).join('<br>')}</div></div>` : ''}
<p style="color:#898781;font-size:12px;margin-top:20px">${esc(m.footer ?? '')}</p></div></body></html>`;
  try {
    await t.sendMail({
      from: config.mail.from,
      to: m.to,
      subject: m.subject,
      html,
      text,
      ...(m.attachments?.length ? { attachments: m.attachments } : {}),
    });
    return true;
  } catch (err) {
    log.error({ err: String(err), to: m.to, subject: m.subject }, 'report delivery e-mail failed');
    return false;
  }
}
