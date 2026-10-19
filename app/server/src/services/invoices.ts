import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import { formatCredits, type InvoiceView } from '@seo/shared';
import { config } from '../config';
import { db, schema } from '../db';
import type { CreditEntryRow, InvoiceRow } from '../db/schema';
import { sendMail } from '../lib/mailer';

// Invoices and credit e-mails (app/docs/CREDITS.md "Invoices"). There is no card payment: the Alaventra team invoices a pack outside
// the app and confirms it in /admin with a grant that records the payment. That grant issues the invoice here, in the same
// transaction as its ledger entry (a paid grant never exists without its invoice), numbered per year with no gaps, and the company's
// owners and admins are told by e-mail with the PDF attached. Credits added without a payment (a free grant, a refund, a correction
// up) get a short e-mail too; the platform admin can untick it. Everything printed is copied onto the row when it is issued, so an
// invoice reads the same after the company is renamed or the seller's details change.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Log = { info: (o: object, msg: string) => void; warn: (o: object, msg: string) => void; error: (o: object, msg: string) => void };

const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const whole = (n: number) => formatCredits(n, { unit: false });

export const invoiceView = (r: InvoiceRow): InvoiceView => ({
  id: r.id,
  number: r.number,
  issuedAt: r.issuedAt.toISOString(),
  credits: r.credits,
  amountUsd: r.amountUsd,
  description: r.description,
  emailedAt: r.emailedAt?.toISOString() ?? null,
  emailedTo: r.emailedTo ?? [],
});

/** The company's owners and admins (not those switched off by its identity provider): who is billed and told about credits. */
export async function billingContacts(orgId: string): Promise<string[]> {
  const rows = await db
    .select({ email: schema.users.email })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.memberships.userId, schema.users.id))
    .where(and(eq(schema.memberships.orgId, orgId), inArray(schema.memberships.role, ['owner', 'admin']), isNull(schema.memberships.deactivatedAt)));
  return [...new Set(rows.map((r) => r.email.toLowerCase()))];
}

export const validUntil = (expiresAt: Date | null) => (expiresAt ? `valid until ${day(expiresAt)}` : 'no expiry date');

/**
 * Issues the invoice of a paid grant inside the grant's own transaction. The number is the year's next one, allocated under a
 * platform-wide lock so two admins confirming at the same moment never take the same number and a rolled-back grant leaves no gap.
 */
export async function issueInvoice(
  tx: Tx,
  o: { org: { id: string; name: string }; ledgerId: string; requestId: string | null; credits: number; amountUsd: number; expiresAt: Date | null; issuedBy: string; billedTo: string[]; now?: Date },
): Promise<InvoiceRow> {
  const now = o.now ?? new Date();
  const year = now.getUTCFullYear();
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('invoice_numbers'))`);
  const [m] = await tx.select({ n: sql<number>`coalesce(max(${schema.invoices.seq}), 0)::int` }).from(schema.invoices).where(eq(schema.invoices.year, year));
  const seq = Number(m?.n ?? 0) + 1;
  const [row] = await tx
    .insert(schema.invoices)
    .values({
      number: `${config.invoice.prefix}-${year}-${String(seq).padStart(4, '0')}`,
      year,
      seq,
      orgId: o.org.id,
      orgName: o.org.name,
      ledgerId: o.ledgerId,
      requestId: o.requestId,
      credits: o.credits,
      amountUsd: Math.round(o.amountUsd * 100) / 100,
      description: `${config.brand} credits: ${whole(o.credits)} credits, ${validUntil(o.expiresAt)}`,
      billedTo: o.billedTo,
      issuer: { name: config.invoice.name, lines: config.invoice.lines, taxId: config.invoice.taxId, email: config.invoice.email || config.support.email },
      issuedAt: now,
      issuedBy: o.issuedBy,
    })
    .returning();
  return row!;
}

export async function listInvoices(orgId: string, limit = 24): Promise<InvoiceView[]> {
  const rows = await db.query.invoices.findMany({ where: eq(schema.invoices.orgId, orgId), orderBy: desc(schema.invoices.issuedAt), limit });
  return rows.map(invoiceView);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The PDF (A4, standard Helvetica: no font files to ship). The logo is the PNG the e-mails use, rendered from the supplied SVG; when
// it cannot be found the seller's name is printed instead.
// ---------------------------------------------------------------------------------------------------------------------------------

const INK = rgb(10 / 255, 15 / 255, 31 / 255);
const BLUE = rgb(46 / 255, 75 / 255, 255 / 255);
const SLATE = rgb(74 / 255, 84 / 255, 104 / 255);
const MIST = rgb(91 / 255, 100 / 255, 120 / 255);
const LINE = rgb(227 / 255, 231 / 255, 240 / 255);
const PAPER = rgb(246 / 255, 247 / 255, 251 / 255);

let logoBytes: Promise<Buffer | null> | undefined;
const LOGO = 'brand/alaventra-email-logo.png';
function logo(): Promise<Buffer | null> {
  logoBytes ??= (async () => {
    const tries = [config.webDist && path.join(config.webDist, LOGO), path.resolve(process.cwd(), '../web/public', LOGO), path.resolve(process.cwd(), 'web/public', LOGO)].filter(Boolean) as string[];
    for (const p of tries) {
      try {
        return await readFile(p);
      } catch {
        /* the next place */
      }
    }
    return null;
  })();
  return logoBytes;
}

/** Helvetica speaks WinAnsi only: anything else would throw, so it is spelled with what the font has (a name in another script prints as "?"). */
function printable(s: string, font: PDFFont): string {
  const plain = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014\u2212]/g, '-');
  let out = '';
  for (const ch of plain) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += '?';
    }
  }
  return out;
}

export async function invoicePdf(inv: InvoiceRow): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${inv.number}`);
  pdf.setAuthor(inv.issuer.name);
  pdf.setCreator(config.brand);
  pdf.setProducer(config.brand);
  pdf.setCreationDate(inv.issuedAt);
  const page = pdf.addPage([595.28, 841.89]);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = page.getWidth();
  const L = 56;
  const R = W - 56;
  const text = (p: PDFPage, s: string, x: number, y: number, o: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; right?: boolean } = {}) => {
    const font = o.font ?? reg;
    const size = o.size ?? 10;
    const t = printable(s, font);
    p.drawText(t, { x: o.right ? x - font.widthOfTextAtSize(t, size) : x, y, size, font, color: o.color ?? INK });
  };

  page.drawRectangle({ x: 0, y: page.getHeight() - 6, width: W, height: 6, color: BLUE });
  let y = page.getHeight() - 70;

  const png = await logo();
  let img: PDFImage | null = null;
  if (png) img = await pdf.embedPng(png).catch(() => null);
  if (img) {
    const h = 24;
    page.drawImage(img, { x: L, y: y - 4, width: (img.width / img.height) * h, height: h });
  } else text(page, inv.issuer.name, L, y, { size: 18, font: bold });

  text(page, 'INVOICE', R, y + 2, { size: 22, font: bold, right: true });
  y -= 22;
  text(page, inv.number, R, y, { size: 11, color: SLATE, right: true });
  // the "Paid" mark: these invoices are issued when the payment has been received
  const paid = 'PAID';
  const pw = bold.widthOfTextAtSize(paid, 9) + 16;
  page.drawRectangle({ x: R - pw, y: y - 24, width: pw, height: 16, color: BLUE });
  text(page, paid, R - pw + 8, y - 19.5, { size: 9, font: bold, color: rgb(1, 1, 1) });

  y -= 64;
  const col2 = L + 260;
  text(page, 'FROM', L, y, { size: 8, font: bold, color: MIST });
  text(page, 'BILLED TO', col2, y, { size: 8, font: bold, color: MIST });
  y -= 16;
  const from = [inv.issuer.name, ...inv.issuer.lines, ...(inv.issuer.taxId ? [`Tax ID: ${inv.issuer.taxId}`] : []), ...(inv.issuer.email ? [inv.issuer.email] : [])];
  const to = [inv.orgName, ...(inv.billedTo ?? []).slice(0, 4)];
  for (let i = 0; i < Math.max(from.length, to.length); i++) {
    if (from[i]) text(page, from[i]!, L, y, { size: 10, font: i === 0 ? bold : reg, color: i === 0 ? INK : SLATE });
    if (to[i]) text(page, to[i]!, col2, y, { size: 10, font: i === 0 ? bold : reg, color: i === 0 ? INK : SLATE });
    y -= 14;
  }

  y -= 18;
  const facts: [string, string][] = [
    ['Invoice number', inv.number],
    ['Issue date', day(inv.issuedAt)],
    ['Payment received', day(inv.issuedAt)],
    ['Currency', inv.currency],
  ];
  page.drawRectangle({ x: L, y: y - 38, width: R - L, height: 50, color: PAPER });
  const cw = (R - L) / facts.length;
  facts.forEach(([k, v], i) => {
    text(page, k, L + 14 + i * cw, y - 6, { size: 8, color: MIST });
    text(page, v, L + 14 + i * cw, y - 24, { size: 10.5, font: bold });
  });

  y -= 80;
  const cQty = L + 300;
  const cUnit = L + 395;
  text(page, 'Description', L, y, { size: 8.5, font: bold, color: MIST });
  text(page, 'Credits', cQty, y, { size: 8.5, font: bold, color: MIST, right: true });
  text(page, 'Unit price', cUnit, y, { size: 8.5, font: bold, color: MIST, right: true });
  text(page, 'Amount', R, y, { size: 8.5, font: bold, color: MIST, right: true });
  y -= 10;
  page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.8, color: LINE });
  y -= 20;
  const unit = inv.credits > 0 ? inv.amountUsd / inv.credits : 0;
  // the description can be long: wrapped to the column
  const words = printable(inv.description, reg).split(' ');
  const lines: string[] = [];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (cur != null && reg.widthOfTextAtSize(`${cur} ${w}`, 10) <= cQty - L - 70) lines[lines.length - 1] = `${cur} ${w}`;
    else lines.push(w);
  }
  lines.forEach((ln, i) => text(page, ln, L, y - i * 13, { size: 10 }));
  text(page, whole(inv.credits), cQty, y, { size: 10, right: true });
  text(page, `$${unit.toFixed(unit < 0.1 ? 4 : 2)}`, cUnit, y, { size: 10, right: true });
  text(page, usd(inv.amountUsd), R, y, { size: 10, right: true });
  y -= Math.max(1, lines.length) * 13 + 10;
  page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.8, color: LINE });

  y -= 22;
  const totals: [string, string, boolean][] = [
    ['Subtotal', usd(inv.amountUsd), false],
    ['Total', usd(inv.amountUsd), true],
    ['Amount paid', `-${usd(inv.amountUsd)}`, false],
    ['Balance due', usd(0), true],
  ];
  for (const [k, v, strong] of totals) {
    text(page, k, cUnit, y, { size: strong ? 11 : 10, font: strong ? bold : reg, color: strong ? INK : SLATE, right: true });
    text(page, v, R, y, { size: strong ? 11 : 10, font: strong ? bold : reg, right: true });
    y -= strong ? 22 : 16;
  }

  y -= 24;
  const notes = [
    `Credits pay for work in ${config.brand}: analyses, written pages and the scheduled reports of your websites.`,
    ...(inv.issuer.taxId ? [] : ['No tax has been charged on this invoice.']),
    ...(inv.issuer.email ? [`Questions about this invoice: ${inv.issuer.email}`] : []),
  ];
  for (const n of notes) {
    text(page, n, L, y, { size: 9, color: SLATE });
    y -= 13;
  }

  text(page, `${inv.issuer.name}  |  ${inv.number}  |  Page 1 of 1`, L, 36, { size: 8, color: MIST });
  return Buffer.from(await pdf.save());
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The e-mails
// ---------------------------------------------------------------------------------------------------------------------------------

const creditsUrl = (orgId: string) => `${config.appUrl}/o/${orgId}/settings/credits`;
const NOT_SENT = 'e-mail is off on this server or no address could take it';

/** E-mails the invoice (PDF attached) and records who got it. Returns the addresses it reached. */
export async function emailInvoice(inv: InvoiceRow, log: Log, o: { to?: string[]; balanceAfter?: number | null; expiresAt?: Date | null; resend?: boolean } = {}): Promise<string[]> {
  if (!inv.orgId) return [];
  const to = o.to ?? (await billingContacts(inv.orgId));
  if (!to.length) return [];
  const content = await invoicePdf(inv);
  const reached: string[] = [];
  for (const addr of to) {
    const ok = await sendMail(
      {
        to: addr,
        subject: `${o.resend ? 'Your invoice' : 'Payment received'}: invoice ${inv.number} · ${inv.orgName}`,
        title: o.resend ? `Invoice ${inv.number}` : 'Thank you for your payment',
        preheader: `${usd(inv.amountUsd)} received, ${whole(inv.credits)} credits added. Invoice ${inv.number} attached.`,
        lines: [
          o.resend
            ? `Here is invoice ${inv.number} for ${inv.orgName} again, as a PDF.`
            : `We received your payment of ${usd(inv.amountUsd)} and added ${whole(inv.credits)} credits to ${inv.orgName}.`,
          `The invoice is attached as a PDF. You can also download it at any time from Settings, Credits.`,
        ],
        details: [
          { label: 'Invoice', value: inv.number },
          { label: 'Date', value: day(inv.issuedAt) },
          { label: 'Credits', value: whole(inv.credits) },
          { label: 'Amount paid', value: usd(inv.amountUsd) },
          ...(o.expiresAt !== undefined ? [{ label: 'Credits valid', value: o.expiresAt ? `until ${day(o.expiresAt)}` : 'no expiry date' }] : []),
          ...(o.balanceAfter != null ? [{ label: 'Balance now', value: `${whole(o.balanceAfter)} credits` }] : []),
        ],
        action: { label: 'Open Credits', url: creditsUrl(inv.orgId) },
        attachments: [{ filename: `${inv.number}.pdf`, content, contentType: 'application/pdf' }],
        footer: `You received this e-mail because you are an owner or admin of ${inv.orgName} in ${config.brand}.`,
      },
      log,
    ).catch(() => false);
    if (ok) reached.push(addr);
  }
  if (reached.length) await db.update(schema.invoices).set({ emailedAt: new Date(), emailedTo: reached }).where(eq(schema.invoices.id, inv.id));
  return reached;
}

const FREE_COPY: Record<'grant' | 'refund' | 'adjust', { subject: string; title: string; line: (n: string, org: string) => string }> = {
  grant: { subject: 'credits added', title: 'Credits added to your account', line: (n, org) => `${n} credits were added to ${org}.` },
  refund: { subject: 'credits given back', title: 'Credits given back', line: (n, org) => `We gave back ${n} credits to ${org} for work that did not go as it should.` },
  adjust: { subject: 'balance corrected', title: 'Your credit balance was corrected', line: (n, org) => `We corrected the credit balance of ${org}: ${n} credits were added.` },
};

/**
 * Tells the company about credits a platform admin added (an entry already committed). A paid grant sends its invoice; any other
 * positive entry a short message. Returns what to record on the ledger entry (`ref.notified`).
 */
export async function notifyCredits(
  org: { id: string; name: string },
  entry: Pick<CreditEntryRow, 'id' | 'kind' | 'credits'>,
  o: { invoice: InvoiceRow | null; expiresAt: Date | null; balanceAfter: number },
  log: Log,
): Promise<{ to: string[]; at: string } | { skipped: string }> {
  let result: { to: string[]; at: string } | { skipped: string };
  if (entry.credits <= 0) result = { skipped: 'no credits were added' };
  else {
    const to = await billingContacts(org.id);
    if (!to.length) result = { skipped: 'the company has no owner or admin' };
    else {
      let reached: string[] = [];
      if (o.invoice) reached = await emailInvoice(o.invoice, log, { to, balanceAfter: o.balanceAfter, expiresAt: o.expiresAt });
      else {
        const c = FREE_COPY[entry.kind as keyof typeof FREE_COPY] ?? FREE_COPY.grant;
        const n = whole(entry.credits);
        for (const addr of to) {
          const ok = await sendMail(
            {
              to: addr,
              subject: `${n} ${c.subject} · ${org.name}`,
              title: c.title,
              lines: [c.line(n, org.name), 'They are in your balance now and ready to use.'],
              details: [
                { label: 'Credits added', value: n },
                ...(entry.kind === 'grant' ? [{ label: 'Credits valid', value: o.expiresAt ? `until ${day(o.expiresAt)}` : 'no expiry date' }] : []),
                { label: 'Balance now', value: `${whole(o.balanceAfter)} credits` },
              ],
              action: { label: 'Open Credits', url: creditsUrl(org.id) },
              footer: `You received this e-mail because you are an owner or admin of ${org.name} in ${config.brand}.`,
            },
            log,
          ).catch(() => false);
          if (ok) reached.push(addr);
        }
      }
      result = reached.length ? { to: reached, at: new Date().toISOString() } : { skipped: NOT_SENT };
    }
  }
  await db.execute(sql`update ${schema.creditLedger} set ref = coalesce(ref, '{}'::jsonb) || ${JSON.stringify({ notified: result })}::jsonb where id = ${entry.id}::uuid`);
  return result;
}

/** Records on the ledger entry that nobody was told, and why (the admin unticked the e-mail). */
export async function notifySkipped(entryId: string, why: string): Promise<{ skipped: string }> {
  await db.execute(sql`update ${schema.creditLedger} set ref = coalesce(ref, '{}'::jsonb) || ${JSON.stringify({ notified: { skipped: why } })}::jsonb where id = ${entryId}::uuid`);
  return { skipped: why };
}
