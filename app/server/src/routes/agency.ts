import type { FastifyInstance } from 'fastify';
import {
  approvalDecisionSchema,
  approvalRequestSchema,
  brandingSchema,
  clientBrandingSchema,
  clientSettingsSchema,
  createClientSchema,
  csvCell,
  effectiveBrand,
  OVERVIEW_CSV_COLUMNS,
  overviewCsvRow,
  staffAssignSchema,
  type PortalContext,
} from '@seo/shared';
import { isUuid, orgAccess, requireRecentAuth, requireUser } from '../auth/access';
import { config } from '../config';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { badRequest, notFound, parse } from '../lib/errors';
import {
  agencyOverview,
  assignStaff,
  brandingView,
  clientOf,
  createClient,
  enableAgency,
  listClients,
  orgById,
  orgView,
  requireAgency,
  staffAccess,
  toOrg,
} from '../services/agency';
import { approvalCandidates, decideApproval, listApprovals, requestApproval, withdrawApproval } from '../services/approvals';
import { audit } from '../services/audit';
import { claimDomain, consumeHandoff, createHandoff, listDomains, releaseDomain, tlsAllowed, verifyDomain } from '../services/portalHosts';
import { mailView, recheckFrom, saveMailSettings } from '../services/portalMail';

type P = { orgId: string; clientId?: string; userId?: string; id?: string; token?: string };

/** G5 (app/docs/WHITE_LABEL.md, app/API.md "Agencies and the client portal") */
export async function agencyRoutes(app: FastifyInstance) {
  // ---------- agency mode, clients, staff ----------
  app.post('/api/orgs/:orgId/agency', async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'owner');
    const o = await enableAgency(req, a);
    return orgView(o, a.role);
  });

  app.get('/api/orgs/:orgId/clients', async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId);
    requireAgency(a);
    return { clients: await listClients(a) };
  });

  app.post('/api/orgs/:orgId/clients', { config: { rateLimit: { max: 30, timeWindow: '1 hour' } } }, async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'admin');
    requireAgency(a, 'admin');
    const body = parse(createClientSchema, req.body);
    const o = await createClient(req, a, body);
    return toOrg(o, a.role, { agency: a.org });
  });

  app.get('/api/orgs/:orgId/clients/:clientId/staff', async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'admin');
    requireAgency(a, 'admin');
    if (!isUuid(p.clientId)) throw notFound('Client not found');
    return { staff: await staffAccess(a, await clientOf(a, p.clientId)) };
  });

  app.put('/api/orgs/:orgId/clients/:clientId/staff/:userId', async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'admin');
    requireAgency(a, 'admin');
    if (!isUuid(p.clientId) || !isUuid(p.userId)) throw notFound('Not found');
    const client = await clientOf(a, p.clientId);
    const body = parse(staffAssignSchema, req.body);
    await assignStaff(req, a, client, p.userId, body.role);
    return { staff: await staffAccess(a, client) };
  });

  app.get('/api/orgs/:orgId/agency/overview', async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId);
    return { rows: await agencyOverview(a), generatedAt: new Date().toISOString() };
  });

  app.get('/api/orgs/:orgId/agency/overview.csv', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'admin');
    const rows = await agencyOverview(a);
    await audit(req, a.org.id, { action: 'agency.overview_exported', target: { type: 'company', id: a.org.id, label: a.org.name }, details: { rows: rows.length } });
    const csv = [OVERVIEW_CSV_COLUMNS.join(','), ...rows.map((r) => overviewCsvRow(r, csvCell))].join('\r\n');
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="clients-${new Date().toISOString().slice(0, 10)}.csv"`)
      .header('cache-control', 'no-store')
      .send(`﻿${csv}\r\n`);
  });

  // ---------- branding (agency: everything; client workspace: its override and the approval rule) ----------
  app.get('/api/orgs/:orgId/branding', async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'admin');
    if (a.org.kind === 'standard') throw notFound('Turn on agency mode first.');
    const parent = a.org.kind === 'client' ? await orgById(a.org.parentOrgId) : null;
    return { ...brandingView(a.org), agencyBrand: parent ? effectiveBrand({ name: parent.name, branding: parent.branding }) : null };
  });

  app.put('/api/orgs/:orgId/branding', async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'admin');
    if (a.org.kind === 'standard') throw notFound('Turn on agency mode first.');
    const next = a.org.kind === 'client' ? parse(clientBrandingSchema, req.body) : parse(brandingSchema, req.body);
    const before = a.org.branding;
    const [o] = await db.update(schema.organizations).set({ branding: next }).where(eq(schema.organizations.id, a.org.id)).returning();
    await audit(req, a.org.kind === 'client' && a.org.parentOrgId ? a.org.parentOrgId : a.org.id, {
      action: 'branding.updated',
      target: { type: 'company', id: a.org.id, label: a.org.name },
      details: { before, after: next as Record<string, unknown> },
    });
    const parent = o.kind === 'client' ? await orgById(o.parentOrgId) : null;
    return { ...brandingView(o), agencyBrand: parent ? effectiveBrand({ name: parent.name, branding: parent.branding }) : null };
  });

  app.put('/api/orgs/:orgId/client-settings', async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'admin');
    if (a.org.kind !== 'client') throw notFound('This is not a client workspace.');
    const body = parse(clientSettingsSchema, req.body);
    const [o] = await db.update(schema.organizations).set({ clientApproval: body.clientApproval }).where(eq(schema.organizations.id, a.org.id)).returning();
    if (o.clientApproval !== a.org.clientApproval)
      await audit(req, a.org.parentOrgId ?? a.org.id, { action: 'agency.client_settings_changed', target: { type: 'company', id: a.org.id, label: a.org.name }, details: { clientApproval: { before: a.org.clientApproval, after: o.clientApproval } } });
    return orgView(o, a.role);
  });

  // ---------- client e-mail (agency) ----------
  app.get('/api/orgs/:orgId/portal/mail', async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'admin');
    requireAgency(a, 'admin');
    return mailView(a.org);
  });
  app.put('/api/orgs/:orgId/portal/mail', { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'admin');
    requireAgency(a, 'admin');
    return saveMailSettings(req, a.org, req.body);
  });
  app.post('/api/orgs/:orgId/portal/mail/check', { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'admin');
    requireAgency(a, 'admin');
    return recheckFrom(a.org);
  });

  // ---------- portal addresses (agency) ----------
  app.get('/api/orgs/:orgId/portal/domains', async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'admin');
    requireAgency(a, 'admin');
    return { domains: await listDomains(a.org.id), cnameTarget: config.portal.cnameTarget || null };
  });
  // a host that serves the sign-in page under the agency's name is security-relevant: claiming and releasing need a fresh sign-in proof
  app.post('/api/orgs/:orgId/portal/domains', { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'admin');
    requireAgency(a, 'admin');
    await requireRecentAuth(req);
    return claimDomain(req, a.org, a.user, ((req.body ?? {}) as { host?: unknown }).host);
  });
  app.post('/api/orgs/:orgId/portal/domains/:id/verify', { config: { rateLimit: { max: 30, timeWindow: '10 minutes' } } }, async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'admin');
    requireAgency(a, 'admin');
    if (!isUuid(p.id)) throw notFound('Portal address not found');
    return verifyDomain(req, a.org, p.id);
  });
  app.delete('/api/orgs/:orgId/portal/domains/:id', async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'owner');
    requireAgency(a, 'owner');
    await requireRecentAuth(req);
    if (!isUuid(p.id)) throw notFound('Portal address not found');
    await releaseDomain(req, a.org, p.id);
    return { ok: true };
  });

  // ---------- approvals (client workspace) ----------
  app.get('/api/orgs/:orgId/approvals', async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'client_viewer');
    const status = (req.query as { status?: string }).status;
    return { items: await listApprovals(a.org.id, { status: status && ['pending', 'approved', 'changes_requested'].includes(status) ? status : undefined }), canDecide: a.role === 'client_approver' };
  });
  app.get('/api/orgs/:orgId/approvals/candidates', async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'member');
    if (a.org.kind !== 'client') throw badRequest('Approvals exist in client workspaces.');
    return { items: await approvalCandidates(a.org) };
  });
  app.post('/api/orgs/:orgId/approvals', { config: { rateLimit: { max: 60, timeWindow: '1 hour' } } }, async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'member');
    return requestApproval(req, a, parse(approvalRequestSchema, req.body));
  });
  app.post('/api/orgs/:orgId/approvals/:id/decide', { config: { rateLimit: { max: 60, timeWindow: '1 hour' } } }, async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'client_viewer');
    return decideApproval(req, a, String(p.id), parse(approvalDecisionSchema, req.body));
  });
  app.post('/api/orgs/:orgId/approvals/:id/withdraw', async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'member');
    await withdrawApproval(req, a, String(p.id));
    return { ok: true };
  });

  // ---------- the portal host itself (no company in the URL) ----------
  /** what the page needs before sign-in on a portal host: the agency's brand; null on the app's own host */
  app.get('/api/portal/context', async (req): Promise<PortalContext | null> => {
    if (!req.portal) return null;
    const agency = await orgById(req.portal.orgId);
    return { host: req.portal.host, brand: agency ? effectiveBrand({ name: agency.name, branding: agency.branding }) : null, appUrl: config.appUrl };
  });

  /** on-demand TLS "ask" (Caddy and friends): 200 for a host we serve, 404 otherwise; no detail either way */
  app.get('/api/portal/tls-allow', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (req, reply) => {
    const ok = await tlsAllowed((req.query as { domain?: string }).domain);
    return reply.status(ok ? 200 : 404).header('cache-control', 'no-store').send(ok ? 'ok' : 'no');
  });

  app.post('/api/portal/handoff', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req) => {
    const user = requireUser(req);
    const r = await createHandoff(req, user, ((req.body ?? {}) as { host?: unknown }).host);
    return r;
  });

  app.get('/api/portal/handoff/:token', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    await consumeHandoff(req, reply, (req.params as P).token);
    return reply.header('cache-control', 'no-store').redirect('/', 303);
  });
}
