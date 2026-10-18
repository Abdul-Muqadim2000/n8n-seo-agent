import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { emailField, ssoConnectionSchema, ssoDomainSchema, ssoSwitchSchema } from '@seo/shared';
import { z } from 'zod';
import { isUuid, orgAccess, requireRecentAuth } from '../auth/access';
import { db, schema } from '../db';
import { forbidden, notFound, parse } from '../lib/errors';
import { safeNext } from './auth';
import {
  addDomain,
  beginSso,
  completeOidc,
  completeSaml,
  connectionForEmail,
  deleteConnection,
  failSso,
  finishSso,
  removeDomain,
  samlMetadata,
  saveConnection,
  setSwitches,
  SsoFailure,
  ssoOverview,
  verifyDomain,
} from '../services/sso';

type P = { orgId: string; id?: string; connId?: string };

/** G1 single sign-on: the company's configuration (admins) and the sign-in round trip (public). Design: app/docs/IDENTITY.md §3-4. */
export async function ssoRoutes(app: FastifyInstance) {
  // the SAML answer is an HTML form POST (application/x-www-form-urlencoded); only this plugin's routes parse it
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string', bodyLimit: 512 * 1024 }, (_req, body, done) => {
    try {
      done(null, Object.fromEntries(new URLSearchParams(String(body))));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  // ------------------------------------------------------------------ configuration (owners and admins)
  app.get('/api/orgs/:orgId/sso', async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'admin');
    return ssoOverview(a.org);
  });

  app.post('/api/orgs/:orgId/sso/domains', { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'admin');
    await requireRecentAuth(req);
    const { domain } = parse(ssoDomainSchema, req.body);
    return addDomain(req, a.org, a.user, domain);
  });

  app.post('/api/orgs/:orgId/sso/domains/:id/verify', { config: { rateLimit: { max: 30, timeWindow: '10 minutes' } } }, async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'admin');
    if (!isUuid(p.id)) throw notFound('Domain not found');
    return verifyDomain(req, a.org, p.id);
  });

  app.delete('/api/orgs/:orgId/sso/domains/:id', async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'admin');
    if (!isUuid(p.id)) throw notFound('Domain not found');
    await requireRecentAuth(req);
    await removeDomain(req, a.org, p.id);
    return { ok: true };
  });

  app.put('/api/orgs/:orgId/sso/connection', async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'admin');
    await requireRecentAuth(req);
    return saveConnection(req, a.org, parse(ssoConnectionSchema, req.body));
  });

  app.patch('/api/orgs/:orgId/sso/connection', async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'admin');
    await requireRecentAuth(req);
    return setSwitches(req, a.org, a.user, a.role, parse(ssoSwitchSchema, req.body));
  });

  app.delete('/api/orgs/:orgId/sso/connection', async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'admin');
    await requireRecentAuth(req);
    const conn = await db.query.ssoConnections.findFirst({ where: eq(schema.ssoConnections.orgId, a.org.id) });
    if (conn?.enforced && a.role !== 'owner') throw forbidden('Single sign-on is required for this company: only an owner can delete the connection.');
    await deleteConnection(req, a.org);
    return { ok: true };
  });

  /** a real sign-in in test mode: nothing is provisioned, no session is made; the result lands on the connection */
  app.post('/api/orgs/:orgId/sso/connection/test', { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'admin');
    const conn = await db.query.ssoConnections.findFirst({ where: eq(schema.ssoConnections.orgId, a.org.id) });
    if (!conn) throw notFound('Set up the connection first');
    return { url: await beginSso(reply, conn, { next: `/o/${a.org.id}/settings/sso`, test: true, adminUserId: a.user.id }) };
  });

  // ------------------------------------------------------------------ the sign-in round trip (public)
  app.post('/api/sso/discover', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req) => {
    const { email } = parse(z.object({ email: emailField }), req.body);
    const hit = await connectionForEmail(email);
    return hit ? { sso: true, orgName: hit.org.name, url: `/api/sso/start?email=${encodeURIComponent(email)}` } : { sso: false };
  });

  app.get('/api/sso/start', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const q = req.query as { email?: string; next?: string };
    const email = emailField.safeParse(q.email ?? '');
    if (!email.success) return reply.redirect('/login/sso?error=sso_email');
    const hit = await connectionForEmail(email.data);
    if (!hit) return reply.redirect(`/login/sso?error=sso_none&email=${encodeURIComponent(email.data)}`);
    try {
      return reply.redirect(await beginSso(reply, hit.conn, { next: safeNext(q.next), loginHint: email.data }));
    } catch (err) {
      req.log.warn({ err: String(err) }, 'single sign-on could not start');
      return reply.redirect('/login/sso?error=sso_unavailable');
    }
  });

  const done = async (req: FastifyRequest, reply: FastifyReply, run: () => ReturnType<typeof completeOidc>) => {
    try {
      const r = await run();
      return await finishSso(req, reply, r.conn, r.flow, r.identity);
    } catch (err) {
      if (err instanceof SsoFailure) return failSso(req, reply, err);
      throw err;
    }
  };

  app.get('/api/sso/oidc/callback', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => done(req, reply, () => completeOidc(req)));

  app.post('/api/sso/saml/:connId/acs', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const p = req.params as P;
    if (!isUuid(p.connId)) throw notFound('Unknown connection');
    return done(req, reply, () => completeSaml(req, p.connId!));
  });

  app.get('/api/sso/saml/:connId/metadata', async (req, reply) => {
    const p = req.params as P;
    const conn = isUuid(p.connId) ? await db.query.ssoConnections.findFirst({ where: eq(schema.ssoConnections.id, p.connId) }) : undefined;
    if (!conn) throw notFound('Unknown connection');
    return reply.header('content-type', 'application/samlmetadata+xml; charset=utf-8').send(samlMetadata(conn));
  });
}
