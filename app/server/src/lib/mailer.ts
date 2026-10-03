import nodemailer from 'nodemailer';
import { config } from '../config';

// Account e-mails (verification, password reset, invitations). Sent only with ACCOUNT_EMAILS=true and SMTP settings (the n8n Gmail
// account); otherwise the message and its link are written to the log, and the app works without e-mail (links are shown in the app).
const transport = config.mail.enabled && config.accountEmails
  ? nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.port === 465,
      auth: { user: config.mail.user, pass: config.mail.password },
    })
  : null;

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
  if (!transport) {
    // the link is a credential (reset / verification): logged only in development
    log.info({ to: m.to, subject: m.subject, ...(config.isProd ? {} : { link: m.action?.url }) }, 'e-mail not sent (ACCOUNT_EMAILS off or no SMTP)');
    return false;
  }
  try {
    await transport.sendMail({ from: config.mail.from, to: m.to, subject: m.subject, html, text });
    return true;
  } catch (err) {
    log.error({ err: String(err), to: m.to, subject: m.subject }, 'e-mail failed');
    return false;
  }
}
