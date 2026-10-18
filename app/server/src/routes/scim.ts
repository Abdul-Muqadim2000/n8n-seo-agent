import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { SCIM, scimBearer, scimGroupRoleSchema, scimTokenCreateSchema } from '@seo/shared';
import { isUuid, orgAccess, requireRecentAuth } from '../auth/access';
import { sha256 } from '../lib/crypto';
import { HttpError, notFound, parse } from '../lib/errors';
import {
  authenticateScim,
  createGroup,
  createScimToken,
  createUser,
  deleteGroup,
  deleteUser,
  getGroup,
  getUser,
  listGroups,
  listUsers,
  patchGroup,
  patchUser,
  replaceGroup,
  replaceUser,
  resourceTypes,
  revokeScimToken,
  schemasList,
  ScimError,
  scimOverview,
  serviceProviderConfig,
  setGroupRole,
  type ScimAuth,
} from '../services/scim';

declare module 'fastify' {
  interface FastifyRequest {
    scim?: ScimAuth;
  }
}

/** G1 SCIM 2.0 — the protocol at /api/scim/v2 (bearer token only) and the admin side in the app. Design: app/docs/IDENTITY.md §5. */
export async function scimRoutes(app: FastifyInstance) {
  // ------------------------------------------------------------------ admin (session, owners and admins)
  app.get('/api/orgs/:orgId/scim', async (req) => {
    const a = await orgAccess(req, (req.params as { orgId: string }).orgId, 'admin');
    return scimOverview(a.org);
  });
  app.post('/api/orgs/:orgId/scim/tokens', { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, async (req) => {
    const a = await orgAccess(req, (req.params as { orgId: string }).orgId, 'admin');
    await requireRecentAuth(req);
    return createScimToken(req, a.org, a.user, parse(scimTokenCreateSchema, req.body).name);
  });
  app.delete('/api/orgs/:orgId/scim/tokens/:id', async (req) => {
    const p = req.params as { orgId: string; id: string };
    const a = await orgAccess(req, p.orgId, 'admin');
    if (!isUuid(p.id)) throw notFound('Token not found');
    await requireRecentAuth(req);
    return revokeScimToken(req, a.org, p.id);
  });
  app.patch('/api/orgs/:orgId/scim/groups/:id', async (req) => {
    const p = req.params as { orgId: string; id: string };
    const a = await orgAccess(req, p.orgId, 'admin');
    if (!isUuid(p.id)) throw notFound('Group not found');
    await requireRecentAuth(req);
    return setGroupRole(req, a.org, p.id, parse(scimGroupRoleSchema, req.body).role);
  });

  // ------------------------------------------------------------------ the protocol (bearer token)
  await app.register(scimProtocol, { prefix: '/api/scim/v2' });
}

async function scimProtocol(app: FastifyInstance) {
  app.addContentTypeParser(['application/scim+json'], { parseAs: 'string', bodyLimit: 1024 * 1024 }, (_req, body, done) => {
    try {
      done(null, body ? JSON.parse(String(body)) : {});
    } catch {
      done(new ScimError(400, 'The body is not JSON', 'invalidSyntax') as unknown as Error, undefined);
    }
  });

  const send = (reply: FastifyReply, status: number, body: unknown) => reply.status(status).header('content-type', 'application/scim+json; charset=utf-8').send(JSON.stringify(body));

  app.setErrorHandler((err: Error, req, reply) => {
    const code = err instanceof ScimError ? err.status : err instanceof HttpError ? err.statusCode : ((err as { statusCode?: number }).statusCode ?? 500);
    if (code >= 500) req.log.error({ err }, 'scim request failed');
    return send(reply, code, {
      schemas: [SCIM.schemas.error],
      status: String(code),
      ...(err instanceof ScimError && err.scimType ? { scimType: err.scimType } : {}),
      detail: code === 429 ? 'Too many requests' : code >= 500 ? 'Internal error' : err.message,
    });
  });
  app.setNotFoundHandler((_req, reply) => send(reply, 404, { schemas: [SCIM.schemas.error], status: '404', detail: 'Not found' }));

  // every request: a company's token, nothing else (no cookie, no CSRF header)
  app.addHook('onRequest', async (req: FastifyRequest) => {
    const a = await authenticateScim(scimBearer(req.headers.authorization));
    if (!a) throw new ScimError(401, 'A valid provisioning token is required (Authorization: Bearer scim_…)');
    req.scim = a;
  });

  const rl = { config: { rateLimit: { max: SCIM.perMinute, timeWindow: '1 minute', keyGenerator: (req: FastifyRequest) => sha256(String(req.headers.authorization ?? '')).slice(0, 24) } } };
  const body = (req: FastifyRequest) => (req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {});
  const q = (req: FastifyRequest) => (req.query ?? {}) as Record<string, unknown>;
  const id = (req: FastifyRequest) => (req.params as { id: string }).id;

  app.get('/ServiceProviderConfig', rl, async (_req, reply) => send(reply, 200, serviceProviderConfig()));
  app.get('/ResourceTypes', rl, async (_req, reply) => send(reply, 200, resourceTypes()));
  app.get('/Schemas', rl, async (_req, reply) => send(reply, 200, schemasList()));

  app.get('/Users', rl, async (req, reply) => send(reply, 200, await listUsers(req.scim!, q(req))));
  app.post('/Users', rl, async (req, reply) => send(reply, 201, await createUser(req, req.scim!, body(req))));
  app.get('/Users/:id', rl, async (req, reply) => send(reply, 200, await getUser(req.scim!, id(req))));
  app.put('/Users/:id', rl, async (req, reply) => send(reply, 200, await replaceUser(req, req.scim!, id(req), body(req))));
  app.patch('/Users/:id', rl, async (req, reply) => send(reply, 200, await patchUser(req, req.scim!, id(req), body(req))));
  app.delete('/Users/:id', rl, async (req, reply) => {
    await deleteUser(req, req.scim!, id(req));
    return reply.status(204).send();
  });

  app.get('/Groups', rl, async (req, reply) => send(reply, 200, await listGroups(req.scim!, q(req))));
  app.post('/Groups', rl, async (req, reply) => send(reply, 201, await createGroup(req, req.scim!, body(req))));
  app.get('/Groups/:id', rl, async (req, reply) => send(reply, 200, await getGroup(req.scim!, id(req))));
  app.put('/Groups/:id', rl, async (req, reply) => send(reply, 200, await replaceGroup(req, req.scim!, id(req), body(req))));
  app.patch('/Groups/:id', rl, async (req, reply) => send(reply, 200, await patchGroup(req, req.scim!, id(req), body(req))));
  app.delete('/Groups/:id', rl, async (req, reply) => {
    await deleteGroup(req, req.scim!, id(req));
    return reply.status(204).send();
  });
}
