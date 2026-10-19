import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createClientSchema } from '@seo/shared';

// G5 (app/docs/WHITE_LABEL.md) — agencies and their client workspaces through the real app on a real Postgres: the role matrix
// (inherited, assigned, client people), isolation in every direction (client ↔ client, client → agency, other agency, a person who
// left), what a client person may and may not reach, cost figures stripped, documents rebranded, approvals and the rule that
// enforces them, the overview and its export, and the audit trail.

vi.hoisted(() => {
  process.env.IDENTITY_KEY = 'ab'.repeat(32); // a test-only key
  process.env.APP_URL = 'http://localhost:5173';
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.PORTAL_JOBS = 'false';
  process.env.LOG_LEVEL = 'silent';
  process.env.SEO_BRAND = 'Dev SEO';
});
vi.mock('../src/db', async () => (await import('./helpers/pg')).pgDbModule());

const { buildApp } = await import('../src/app');
const { db, schema } = await import('../src/db');
const { requireClientApproval } = await import('../src/services/approvals');
const { writeZip, readZip } = await import('../src/services/docRebrand');
const { Client, signUp } = await import('./helpers/client');

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});

type C = InstanceType<typeof Client>;
const PW = 'correct horse battery staple';

async function join(inviter: C, orgId: string, email: string, role: string): Promise<C> {
  const inv = await inviter.post(`/api/orgs/${orgId}/invitations`, { email, role });
  expect(inv.status, inv.text).toBe(200);
  const c = new Client(app);
  const r = await c.post('/api/auth/signup', { name: email.split('@')[0], email, password: PW, inviteToken: inv.body.inviteUrl.split('/invite/')[1] });
  expect(r.status, r.text).toBe(200);
  return c;
}
const userId = async (c: C) => (await c.get('/api/me')).body.user.id as string;

let owner: C;
let agency: { id: string };
let clientA: { id: string };
let clientB: { id: string };
let admin: C;
let member: C;
let viewerA: C;
let approverA: C;
let outsider: C;
let outsiderOrg: { id: string };

describe('agency mode and client workspaces', () => {
  it('an owner turns a company into an agency; only the owner may', async () => {
    owner = (await signUp(app, 'owner@north.agency')).c;
    agency = (await owner.post('/api/orgs', { name: 'North Agency' })).body;
    admin = await join(owner, agency.id, 'admin@north.agency', 'admin');
    expect((await admin.post(`/api/orgs/${agency.id}/agency`)).status).toBe(403);
    const r = await owner.post(`/api/orgs/${agency.id}/agency`);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ kind: 'agency', agency: null, clientApproval: false });
  });

  it('admins create client workspaces; members cannot; a standard company has no clients', async () => {
    member = await join(owner, agency.id, 'member@north.agency', 'member');
    expect((await member.post(`/api/orgs/${agency.id}/clients`, { name: 'Acme' })).status).toBe(403);
    const a = await admin.post(`/api/orgs/${agency.id}/clients`, { name: 'Acme Trading' });
    expect(a.status, a.text).toBe(200);
    // credits (app/docs/CREDITS.md): no dollar budget is asked or shown; the workspace is limited by its credits
    expect(a.body).toMatchObject({ kind: 'client', name: 'Acme Trading', agency: { id: agency.id, name: 'North Agency' }, monthlyBudgetUsd: 0 });
    clientA = a.body;
    clientB = (await owner.post(`/api/orgs/${agency.id}/clients`, { name: 'Beta Foods' })).body;
    outsider = (await signUp(app, 'boss@other.co')).c;
    outsiderOrg = (await outsider.post('/api/orgs', { name: 'Other Co' })).body;
    expect((await outsider.post(`/api/orgs/${outsiderOrg.id}/clients`, { name: 'X' })).status).toBe(404);
    // a dollar budget sent by an old client is not part of the form any more (the platform's default guard is kept on the row)
    expect(createClientSchema.parse({ name: 'Big', monthlyBudgetUsd: 5000 })).not.toHaveProperty('monthlyBudgetUsd');
  });

  it('a client workspace is reached through the agency: owners and admins inherit, members only when assigned', async () => {
    expect((await owner.get(`/api/orgs/${clientA.id}`)).body.role).toBe('owner');
    expect((await admin.get(`/api/orgs/${clientA.id}`)).body.role).toBe('admin');
    expect((await member.get(`/api/orgs/${clientA.id}`)).status).toBe(404);
    const mid = await userId(member);
    const s = await admin.put(`/api/orgs/${agency.id}/clients/${clientA.id}/staff/${mid}`, { role: 'member' });
    expect(s.status, s.text).toBe(200);
    expect(s.body.staff.find((x: { userId: string }) => x.userId === mid)).toMatchObject({ access: 'assigned', role: 'member' });
    expect((await member.get(`/api/orgs/${clientA.id}`)).body.role).toBe('member');
    expect((await member.get(`/api/orgs/${clientB.id}`)).status).toBe(404);
    // the list a member sees is the assigned clients only; staff assignments do not appear as companies of their own in /api/me
    expect((await member.get(`/api/orgs/${agency.id}/clients`)).body.clients.map((c: { id: string }) => c.id)).toEqual([clientA.id]);
    expect((await member.get('/api/me')).body.orgs.map((o: { id: string }) => o.id)).toEqual([agency.id]);
    expect((await admin.get(`/api/orgs/${agency.id}/clients`)).body.clients).toHaveLength(2);
    // owners / admins of the agency cannot be "assigned", and the owner role is never assignable
    expect((await admin.put(`/api/orgs/${agency.id}/clients/${clientA.id}/staff/${await userId(admin)}`, { role: 'viewer' })).status).toBe(400);
    expect((await admin.put(`/api/orgs/${agency.id}/clients/${clientA.id}/staff/${mid}`, { role: 'owner' })).status).toBe(400);
  });

  it('nobody outside the agency reaches its clients', async () => {
    for (const id of [clientA.id, clientB.id, agency.id]) expect((await outsider.get(`/api/orgs/${id}`)).status).toBe(404);
    expect((await outsider.get(`/api/orgs/${agency.id}/agency/overview`)).status).toBe(404);
  });
});

describe('client people', () => {
  it('are invited as client roles only, into client workspaces only', async () => {
    expect((await admin.post(`/api/orgs/${clientA.id}/invitations`, { email: 'x@acme.example.com', role: 'member' })).status).toBe(400);
    expect((await owner.post(`/api/orgs/${agency.id}/invitations`, { email: 'x@acme.example.com', role: 'client_viewer' })).status).toBe(400);
    expect((await outsider.post(`/api/orgs/${outsiderOrg.id}/invitations`, { email: 'x@acme.example.com', role: 'client_approver' })).status).toBe(400);
    viewerA = await join(admin, clientA.id, 'viewer@acme.example.com', 'client_viewer');
    approverA = await join(admin, clientA.id, 'approver@acme.example.com', 'client_approver');
    const me = (await viewerA.get('/api/me')).body;
    expect(me.orgs).toEqual([expect.objectContaining({ id: clientA.id, role: 'client_viewer', kind: 'client', agencyName: 'North Agency' })]);
  });

  it('see their workspace without the agency id or the budget', async () => {
    const o = (await viewerA.get(`/api/orgs/${clientA.id}`)).body;
    expect(o).toMatchObject({ role: 'client_viewer', kind: 'client', agency: { name: 'North Agency' }, monthlyBudgetUsd: 0 });
    expect(o.agency.id).toBeUndefined();
  });

  it('reach the portal routes and nothing else', async () => {
    const ok = [`/api/orgs/${clientA.id}`, `/api/orgs/${clientA.id}/sites`, `/api/orgs/${clientA.id}/reports`, `/api/orgs/${clientA.id}/approvals`];
    for (const u of ok) expect((await viewerA.get(u)).status, u).toBe(200);
    const refused = [
      `/api/orgs/${clientA.id}/usage`,
      `/api/orgs/${clientA.id}/costs`,
      `/api/orgs/${clientA.id}/members`,
      `/api/orgs/${clientA.id}/runs`,
      `/api/orgs/${clientA.id}/delivery`,
      `/api/orgs/${clientA.id}/deliveries`,
      `/api/orgs/${clientA.id}/audit`,
      `/api/orgs/${clientA.id}/api-keys`,
      `/api/orgs/${clientA.id}/mailboxes`,
      `/api/orgs/${clientA.id}/security`,
      `/api/orgs/${clientA.id}/branding`,
      `/api/orgs/${clientA.id}/approvals/candidates`,
    ];
    for (const u of refused) expect([403, 404], u).toContain((await viewerA.get(u)).status);
    expect((await viewerA.post(`/api/orgs/${clientA.id}/sites`, { domain: 'acme.example.com', country: 'United States' })).status).toBe(403);
    expect((await viewerA.post(`/api/orgs/${clientA.id}/invitations`, { email: 'z@acme.example.com', role: 'client_viewer' })).status).toBe(403);
    expect((await viewerA.patch(`/api/orgs/${clientA.id}`, { name: 'Hacked' })).status).toBe(403);
    expect((await viewerA.put(`/api/orgs/${clientA.id}/branding`, { productName: 'Mine' })).status).toBe(403);
    // never another client, never the agency
    for (const id of [clientB.id, agency.id, outsiderOrg.id]) expect((await viewerA.get(`/api/orgs/${id}`)).status).toBe(404);
    expect((await viewerA.get(`/api/orgs/${clientB.id}/reports`)).status).toBe(404);
  });

  it('cannot be turned into staff, and staff assignments are not changed from the client side', async () => {
    const vid = await userId(viewerA);
    expect((await admin.patch(`/api/orgs/${clientA.id}/members/${vid}`, { role: 'admin' })).status).toBe(400);
    expect((await admin.patch(`/api/orgs/${clientA.id}/members/${vid}`, { role: 'client_approver' })).status).toBe(200);
    expect((await admin.patch(`/api/orgs/${clientA.id}/members/${vid}`, { role: 'client_viewer' })).status).toBe(200);
    expect((await admin.patch(`/api/orgs/${clientA.id}/members/${await userId(member)}`, { role: 'admin' })).status).toBe(400);
  });
});

describe('reports for client people', () => {
  let reportId: string;
  let pdfId: string;
  let docxId: string;
  it('carry no cost figures, and white-label hides what cannot carry the agency name', async () => {
    const [r] = await db
      .insert(schema.reports)
      .values({ orgId: clientA.id, stage: 'site_audit', status: 'success', title: 'Technical audit', summary: { healthScore: 71 }, payload: { health_score: 71, run_cost_usd: 1.25, cost: { dataforseo: 0.4 }, findings: [{ title: 'Missing H1', price_usd: 2 }] } })
      .returning();
    reportId = r.id;
    const docx = writeZip([
      { name: '[Content_Types].xml', data: Buffer.from('<?xml version="1.0"?><Types/>') },
      { name: 'word/document.xml', data: Buffer.from('<w:document><w:t>Prepared by Dev SEO for Acme</w:t></w:document>') },
    ]);
    const [f1] = await db.insert(schema.files).values({ orgId: clientA.id, reportId, field: 'pdf', kind: 'pdf', fileName: 'audit.pdf', mimeType: 'application/pdf', size: 8, data: Buffer.from('%PDF-1.4') }).returning();
    const [f2] = await db.insert(schema.files).values({ orgId: clientA.id, reportId, field: 'docx', kind: 'docx', fileName: 'audit.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: docx.length, data: docx }).returning();
    pdfId = f1.id;
    docxId = f2.id;

    // credits (app/docs/CREDITS.md): the agency's own people get no provider cost either, only the credits the work used
    const staff = (await admin.get(`/api/orgs/${clientA.id}/reports/${reportId}`)).body;
    expect(staff.payload).toEqual({ health_score: 71, findings: [{ title: 'Missing H1' }], credits_used: null, credits_state: null });
    const client = (await viewerA.get(`/api/orgs/${clientA.id}/reports/${reportId}`)).body;
    expect(client.payload).toEqual({ health_score: 71, findings: [{ title: 'Missing H1' }] });
    // white-label off: the files are the engine's, for everyone
    expect(client.files.map((f: { kind: string }) => f.kind).sort()).toEqual(['docx', 'pdf']);
  });

  it('with white-label on: the PDF is not offered to a client person, the Word file carries the agency name', async () => {
    const b = await owner.put(`/api/orgs/${agency.id}/branding`, { whiteLabel: true, productName: 'North Insights', accent: '#ff6600', supportEmail: 'help@north.agency' });
    expect(b.status, b.text).toBe(200);
    expect(b.body.contrast.ratios.button).toBeGreaterThanOrEqual(4.5);
    const client = (await viewerA.get(`/api/orgs/${clientA.id}/reports/${reportId}`)).body;
    expect(client.files.map((f: { kind: string }) => f.kind)).toEqual(['docx']);
    expect((await viewerA.get(`/api/orgs/${clientA.id}/files/${pdfId}`)).status).toBe(404);
    const d = await app.inject({ method: 'GET', url: `/api/orgs/${clientA.id}/files/${docxId}`, headers: { cookie: viewerA.cookieHeader() } });
    expect(d.statusCode).toBe(200);
    const xml = readZip(d.rawPayload)!.find((e) => e.name === 'word/document.xml')!.data.toString();
    expect(xml).toContain('Prepared by North Insights for Acme');
    expect(xml).not.toContain('Dev SEO');
    // staff still get the engine's originals
    expect((await admin.get(`/api/orgs/${clientA.id}/files/${pdfId}`)).status).toBe(200);
    const s = await app.inject({ method: 'GET', url: `/api/orgs/${clientA.id}/files/${docxId}`, headers: { cookie: admin.cookieHeader() } });
    expect(readZip(s.rawPayload)!.find((e) => e.name === 'word/document.xml')!.data.toString()).toContain('Dev SEO');
  });

  it('the workspace answer carries the brand; a client override wins', async () => {
    expect((await viewerA.get(`/api/orgs/${clientA.id}`)).body.brand).toMatchObject({ whiteLabel: true, name: 'North Insights', accent: '#ff6600', poweredBy: false });
    expect((await admin.put(`/api/orgs/${clientA.id}/branding`, { productName: 'Acme SEO hub', accent: 'orange' })).status).toBe(400);
    expect((await admin.put(`/api/orgs/${clientA.id}/branding`, { productName: 'Acme SEO hub' })).status).toBe(200);
    expect((await viewerA.get(`/api/orgs/${clientA.id}`)).body.brand.name).toBe('Acme SEO hub');
    expect((await viewerA.get(`/api/orgs/${clientB.id}`)).status).toBe(404);
    expect((await owner.get(`/api/orgs/${clientB.id}`)).body.brand.name).toBe('North Insights');
  });
});

describe('approvals', () => {
  let reportId: string;
  let approvalId: string;
  it('the agency asks, client viewers see, only client approvers decide', async () => {
    const [r] = await db.insert(schema.reports).values({ orgId: clientA.id, stage: 'content', status: 'success', title: 'Page: erp uae', summary: { hasPage: true }, payload: { html: '<p>x</p>' } }).returning();
    reportId = r.id;
    expect((await viewerA.post(`/api/orgs/${clientA.id}/approvals`, { kind: 'page', itemId: reportId, title: 'x' })).status).toBe(403);
    const cand = await member.get(`/api/orgs/${clientA.id}/approvals/candidates`);
    expect(cand.body.items.map((i: { itemId: string }) => i.itemId)).toContain(reportId);
    // a report of another workspace cannot be asked about here
    const [other] = await db.insert(schema.reports).values({ orgId: clientB.id, stage: 'content', status: 'success', title: 'B page', summary: {}, payload: {} }).returning();
    expect((await admin.post(`/api/orgs/${clientA.id}/approvals`, { kind: 'page', itemId: other.id, title: 'B page' })).status).toBe(404);
    const q = await member.post(`/api/orgs/${clientA.id}/approvals`, { kind: 'page', itemId: reportId, title: 'Page: erp uae', note: 'Please check the prices' });
    expect(q.status, q.text).toBe(200);
    approvalId = q.body.id;
    const list = await viewerA.get(`/api/orgs/${clientA.id}/approvals`);
    expect(list.body).toMatchObject({ canDecide: false, items: [expect.objectContaining({ id: approvalId, status: 'pending', reportId })] });
    expect((await viewerA.post(`/api/orgs/${clientA.id}/approvals/${approvalId}/decide`, { decision: 'approved' })).status).toBe(403);
    expect((await admin.post(`/api/orgs/${clientA.id}/approvals/${approvalId}/decide`, { decision: 'approved' })).status).toBe(403);
    expect((await approverA.post(`/api/orgs/${clientA.id}/approvals/${approvalId}/decide`, { decision: 'changes_requested' })).status).toBe(400);
  });

  it('with client approval required, the item waits for an approved decision', async () => {
    const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, clientA.id) });
    expect((await viewerA.put(`/api/orgs/${clientA.id}/client-settings`, { clientApproval: true })).status).toBe(403);
    expect((await admin.put(`/api/orgs/${clientA.id}/client-settings`, { clientApproval: true })).body.clientApproval).toBe(true);
    const on = { ...org!, clientApproval: true };
    await expect(requireClientApproval(on, 'page', reportId)).rejects.toMatchObject({ statusCode: 409, code: 'client_approval_required' });
    const d = await approverA.post(`/api/orgs/${clientA.id}/approvals/${approvalId}/decide`, { decision: 'approved', note: 'Looks right' });
    expect(d.status, d.text).toBe(200);
    expect(d.body).toMatchObject({ status: 'approved', decidedBy: 'approver' });
    await expect(requireClientApproval(on, 'page', reportId)).resolves.toBeUndefined();
    await expect(requireClientApproval(on, 'outreach', 'example.org|resource_page')).rejects.toMatchObject({ statusCode: 409 });
    // a decided request cannot be decided again; asking again replaces it and needs a new decision
    expect((await approverA.post(`/api/orgs/${clientA.id}/approvals/${approvalId}/decide`, { decision: 'approved' })).status).toBe(409);
    await member.post(`/api/orgs/${clientA.id}/approvals`, { kind: 'page', itemId: reportId, title: 'Page: erp uae (v2)' });
    await expect(requireClientApproval(on, 'page', reportId)).rejects.toMatchObject({ statusCode: 409 });
    // a standard company is never held
    await expect(requireClientApproval({ ...on, kind: 'standard' }, 'page', reportId)).resolves.toBeUndefined();
  });

  it('every step is in the audit log of the workspace', async () => {
    const log = (await owner.get(`/api/orgs/${clientA.id}/audit`)).body.items.map((e: { action: string }) => e.action);
    expect(log).toEqual(expect.arrayContaining(['approval.requested', 'approval.approved', 'team.invited']));
  });
});

describe('the overview', () => {
  it('lists every client website for admins, assigned ones for members, with a formula-safe CSV', async () => {
    await db.insert(schema.sites).values({ orgId: clientA.id, domain: 'acme.example.com', country: 'United States', verificationToken: 't1', verifiedAt: new Date() });
    await db.insert(schema.sites).values({ orgId: clientB.id, domain: 'beta.example.com', country: 'United States', verificationToken: 't2' });
    const siteA = (await db.query.sites.findFirst({ where: eq(schema.sites.domain, 'acme.example.com') }))!;
    await db.insert(schema.reports).values({ orgId: clientA.id, siteId: siteA.id, stage: 'site_audit', status: 'success', title: 'Audit', summary: { healthScore: 83 }, payload: {} });
    await db.insert(schema.reports).values({ orgId: clientA.id, siteId: siteA.id, stage: 'rank_tracker', status: 'success', title: 'Ranks', summary: { gains: 4, drops: 1 }, payload: {} });
    await db.insert(schema.reports).values({ orgId: clientA.id, siteId: siteA.id, stage: 'console_alert', status: 'success', title: 'Alert', summary: {}, payload: {} });
    const all = (await admin.get(`/api/orgs/${agency.id}/agency/overview`)).body.rows;
    expect(all.map((r: { domain: string }) => r.domain).sort()).toEqual(['acme.example.com', 'beta.example.com']);
    expect(all.find((r: { domain: string }) => r.domain === 'acme.example.com')).toMatchObject({ healthScore: 83, rankGains: 4, rankDrops: 1, alerts14d: 1, verified: true, creditsUsedMonth: 0, creditBalance: 0 });
    expect((await member.get(`/api/orgs/${agency.id}/agency/overview`)).body.rows.map((r: { clientId: string }) => r.clientId)).toEqual([clientA.id]);
    expect((await member.get(`/api/orgs/${agency.id}/agency/overview.csv`)).status).toBe(403);
    await db.update(schema.organizations).set({ name: '=cmd|calc' }).where(eq(schema.organizations.id, clientB.id));
    const csv = await admin.get(`/api/orgs/${agency.id}/agency/overview.csv`);
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain(`"'=cmd|calc"`);
    expect(csv.text.split('\r\n')[0]).toContain('client,website,verified');
    expect((await owner.get(`/api/orgs/${agency.id}/audit`)).body.items.map((e: { action: string }) => e.action)).toEqual(
      expect.arrayContaining(['agency.enabled', 'agency.client_created', 'agency.staff_assigned', 'branding.updated', 'agency.overview_exported']),
    );
  });
});

describe('leaving and switching off', () => {
  it('a member who leaves the agency loses their client assignments', async () => {
    const mid = await userId(member);
    expect((await member.get(`/api/orgs/${clientA.id}`)).status).toBe(200);
    expect((await owner.del(`/api/orgs/${agency.id}/members/${mid}`)).status).toBe(200);
    expect((await member.get(`/api/orgs/${clientA.id}`)).status).toBe(404);
    expect(await db.query.memberships.findFirst({ where: and(eq(schema.memberships.orgId, clientA.id), eq(schema.memberships.userId, mid)) })).toBeUndefined();
  });

  it('an agency admin switched off by the identity provider loses every client at once', async () => {
    const aid = await userId(admin);
    await db.update(schema.memberships).set({ deactivatedAt: new Date() }).where(and(eq(schema.memberships.orgId, agency.id), eq(schema.memberships.userId, aid)));
    expect((await admin.get(`/api/orgs/${clientA.id}`)).status).toBe(403);
    await db.update(schema.memberships).set({ deactivatedAt: null }).where(and(eq(schema.memberships.orgId, agency.id), eq(schema.memberships.userId, aid)));
    expect((await admin.get(`/api/orgs/${clientA.id}`)).status).toBe(200);
  });

  it('an agency with clients cannot be deleted; a client workspace only by the agency owner', async () => {
    expect((await owner.del(`/api/orgs/${agency.id}`, { confirm: 'North Agency' })).status).toBe(409);
    expect((await admin.del(`/api/orgs/${clientB.id}`, { confirm: '=cmd|calc' })).status).toBe(403);
    expect((await owner.del(`/api/orgs/${clientB.id}`, { confirm: '=cmd|calc' })).status).toBe(200);
    expect((await owner.get(`/api/orgs/${agency.id}/audit`)).body.items.map((e: { action: string }) => e.action)).toContain('agency.client_deleted');
  });
});

describe('single sign-on and SCIM in a client workspace', () => {
  it('never provision staff there', async () => {
    const { provisionedRole } = await import('@seo/shared');
    expect(provisionedRole('client', 'admin')).toBe('client_viewer');
  });
});

void PW;
