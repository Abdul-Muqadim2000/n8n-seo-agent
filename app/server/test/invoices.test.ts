import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Invoices and credit e-mails (app/docs/CREDITS.md "Invoices"), on a real Postgres (PGlite, every migration): a paid grant issues a
// numbered invoice in its own transaction and e-mails it as a PDF to the company's owners and admins; credits added without a payment
// get a short e-mail; the admin can untick the e-mail; the customer downloads its own invoices only; the admin sends one again.

type SentMail = { to: string; subject: string; lines: string[]; attachments?: { filename: string; content: Buffer; contentType?: string }[] };
const sent = vi.hoisted(() => ({ mails: [] as SentMail[] }));
vi.hoisted(() => {
  process.env.PLATFORM_ADMIN_EMAILS = 'boss@admin.test';
  process.env.APP_URL = 'http://localhost:5173';
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.ADMIN_COST_SYNC = 'false';
  process.env.CREDIT_GUARD = 'false';
  process.env.LOG_LEVEL = 'silent';
  process.env.N8N_BASE_URL = 'http://127.0.0.1:9';
  process.env.SEO_API_KEY = 'test-only';
  process.env.INVOICE_ISSUER_ADDRESS = 'Office 1, Tower A|Dubai, United Arab Emirates';
});
vi.mock('../src/db', async () => (await import('./helpers/pg')).pgDbModule());
vi.mock('../src/lib/mailer', async (orig) => {
  const real = await orig<typeof import('../src/lib/mailer')>();
  return { ...real, sendMail: vi.fn(async (m: SentMail) => (sent.mails.push(m), true)) };
});

const { buildApp } = await import('../src/app');
const { db, schema } = await import('../src/db');
const { Client, signUp } = await import('./helpers/client');
const { invoicePdf } = await import('../src/services/invoices');
vi.setConfig({ testTimeout: 30_000 });

let app: FastifyInstance;
let boss: InstanceType<typeof Client>;
const YEAR = new Date().getUTCFullYear();
const verify = (email: string) => db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.email, email));
async function company(email: string, name: string) {
  const u = await signUp(app, email);
  const org = (await u.c.post('/api/orgs', { name })).body as { id: string; name: string };
  sent.mails.length = 0; // the sign-up's own confirmation mail
  return { c: u.c, org };
}
const credit = (orgId: string, body: Record<string, unknown>) => boss.post(`/api/admin/companies/${orgId}/credits`, { kind: 'grant', ...body });

beforeAll(async () => {
  app = await buildApp();
  boss = (await signUp(app, 'boss@admin.test', 'Boss')).c;
  await verify('boss@admin.test');
});
beforeEach(() => {
  sent.mails.length = 0;
});
afterAll(async () => {
  await app.close();
});

describe('a paid credit purchase', () => {
  it('issues invoice 0001 with the grant, e-mails the PDF to the owner, and the customer can download it', async () => {
    const { c, org } = await company('owner@acme.test', 'Acme Trading');
    const req = (await c.post(`/api/orgs/${org.id}/billing/requests`, { packId: 'standard' })).body as { id: string; credits: number; priceUsd: number };
    sent.mails.length = 0; // the request's own notice to the platform admins

    const r = await credit(org.id, { credits: req.credits, paidUsd: req.priceUsd, requestId: req.id });
    expect(r.status).toBe(200);
    const number = `ALV-${YEAR}-0001`;
    expect(r.body.ref.invoice.number).toBe(number);
    expect(r.body.ref.notified.to).toEqual(['owner@acme.test']);

    expect(sent.mails).toHaveLength(1);
    const m = sent.mails[0]!;
    expect(m.to).toBe('owner@acme.test');
    expect(m.subject).toBe(`Payment received: invoice ${number} · Acme Trading`);
    expect(m.attachments?.[0]?.filename).toBe(`${number}.pdf`);
    expect(m.attachments?.[0]?.contentType).toBe('application/pdf');
    expect(m.attachments?.[0]?.content.subarray(0, 5).toString()).toBe('%PDF-');
    // no em dash, curly quote or ellipsis in what the customer reads
    expect(JSON.stringify(m.lines)).not.toMatch(/[—‘’“”…]/);

    const inv = await db.query.invoices.findFirst({ where: eq(schema.invoices.number, number) });
    expect(inv).toMatchObject({ orgId: org.id, orgName: 'Acme Trading', credits: req.credits, amountUsd: req.priceUsd, requestId: req.id, billedTo: ['owner@acme.test'], emailedTo: ['owner@acme.test'] });
    expect(inv!.issuer.lines).toEqual(['Office 1, Tower A', 'Dubai, United Arab Emirates']);

    const b = (await c.get(`/api/orgs/${org.id}/billing`)).body;
    expect(b.invoices).toHaveLength(1);
    expect(b.invoices[0]).toMatchObject({ number, credits: req.credits, amountUsd: req.priceUsd, emailedTo: ['owner@acme.test'] });

    const pdf = await c.get(`/api/orgs/${org.id}/billing/invoices/${inv!.id}/pdf`);
    expect(pdf.status).toBe(200);
    expect(String(pdf.headers['content-type'])).toContain('application/pdf');
    expect(String(pdf.headers['content-disposition'])).toContain(`${number}.pdf`);
    expect(pdf.text.startsWith('%PDF-')).toBe(true);

    // another company cannot read it, even with the id
    const other = await company('owner@other.test', 'Other Co');
    expect((await other.c.get(`/api/orgs/${other.org.id}/billing/invoices/${inv!.id}/pdf`)).status).toBe(404);
    expect((await other.c.get(`/api/orgs/${org.id}/billing/invoices/${inv!.id}/pdf`)).status).toBe(404);
  });

  it('numbers the next invoice of the year 0002, and sends it to every owner and admin', async () => {
    const { org } = await company('owner@beta.test', 'Beta LLC');
    await signUp(app, 'admin@beta.test');
    const admin = await db.query.users.findFirst({ where: eq(schema.users.email, 'admin@beta.test') });
    await db.insert(schema.memberships).values({ orgId: org.id, userId: admin!.id, role: 'admin' });
    sent.mails.length = 0;
    const r = await credit(org.id, { credits: 500, paidUsd: 25, expires: 'never' });
    expect(r.body.ref.invoice.number).toBe(`ALV-${YEAR}-0002`);
    expect(sent.mails.map((m) => m.to).sort()).toEqual(['admin@beta.test', 'owner@beta.test']);
    expect(sent.mails.every((m) => m.attachments?.length === 1)).toBe(true);
  });
});

describe('credits added without a payment', () => {
  it('a free grant: a short e-mail, no invoice', async () => {
    const { org } = await company('owner@gamma.test', 'Gamma');
    const r = await credit(org.id, { credits: 300, paidUsd: 0 });
    expect(r.body.ref.invoice).toBeUndefined();
    expect(sent.mails).toHaveLength(1);
    expect(sent.mails[0]!.subject).toBe('300 credits added · Gamma');
    expect(sent.mails[0]!.attachments).toBeUndefined();
    expect(await db.query.invoices.findMany({ where: eq(schema.invoices.orgId, org.id) })).toHaveLength(0);
  });

  it('a refund is told; a correction down is not; an unticked e-mail is recorded as skipped', async () => {
    const { org } = await company('owner@delta.test', 'Delta');
    await boss.post(`/api/admin/companies/${org.id}/credits`, { kind: 'refund', credits: 40 });
    expect(sent.mails.map((m) => m.subject)).toEqual(['40 credits given back · Delta']);

    sent.mails.length = 0;
    const down = await boss.post(`/api/admin/companies/${org.id}/credits`, { kind: 'adjust', credits: -10 });
    expect(sent.mails).toHaveLength(0);
    expect(down.body.ref.notified.skipped).toBeTruthy();

    const quiet = await credit(org.id, { credits: 1000, paidUsd: 50, notify: false });
    expect(sent.mails).toHaveLength(0);
    expect(quiet.body.ref.invoice.number).toMatch(new RegExp(`^ALV-${YEAR}-\\d{4}$`)); // the invoice exists all the same
    expect(quiet.body.ref.notified).toEqual({ skipped: 'the platform admin chose not to e-mail' });
  });
});

describe('the platform admin', () => {
  it('lists a company invoices, downloads one and sends it again', async () => {
    const { org } = await company('owner@eps.test', 'Epsilon');
    await credit(org.id, { credits: 2000, paidUsd: 100 });
    const list = (await boss.get(`/api/admin/companies/${org.id}/invoices`)).body as { id: string; number: string }[];
    expect(list).toHaveLength(1);
    const pdf = await boss.get(`/api/admin/invoices/${list[0]!.id}/pdf`);
    expect(pdf.status).toBe(200);
    expect(pdf.text.startsWith('%PDF-')).toBe(true);

    sent.mails.length = 0;
    const again = await boss.post(`/api/admin/invoices/${list[0]!.id}/send`, {});
    expect(again.status).toBe(200);
    expect(sent.mails).toHaveLength(1);
    expect(sent.mails[0]!.subject).toBe(`Your invoice: invoice ${list[0]!.number} · Epsilon`);

    // only platform admins
    const { c } = await company('owner@zeta.test', 'Zeta');
    expect((await c.get(`/api/admin/invoices/${list[0]!.id}/pdf`)).status).toBe(403);
    expect((await c.post(`/api/admin/invoices/${list[0]!.id}/send`, {})).status).toBe(403);
  });

  it('a company name in another script still makes a PDF', async () => {
    const row = await db.query.invoices.findFirst();
    const buf = await invoicePdf({ ...row!, orgName: 'شركة الاختبار Ünïcødé “Ltd” – Co' });
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
