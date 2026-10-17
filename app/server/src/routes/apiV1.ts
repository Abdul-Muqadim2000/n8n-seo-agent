import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { API_KEY, API_SCOPES, apiKeyCreateSchema, bearerKey, roleAtLeast, triesBearer, type ApiScope } from '@seo/shared';
import { isUuid, orgAccess, requireVerified, siteAccess } from '../auth/access';
import { config } from '../config';
import { sha256 } from '../lib/crypto';
import { badRequest, HttpError, notFound, parse } from '../lib/errors';
import { authenticateKey, createKey, listKeys, revokeKey } from '../services/apiKeys';
import {
  fileOf,
  getAudit,
  getReport,
  getRun,
  getWebsite,
  listAudits,
  listReports,
  listRuns,
  listWebsites,
  publishCheck,
  requireScope,
  type V1Ctx,
} from '../services/apiV1';
import { sendFile } from './runs';

/**
 * B5-11 / area 12 G-5 + B3-7 (v4.18): the read API (`/api/v1`), its MCP endpoint, the company's API keys and the app's own
 * "Check a page before you publish" route. Design note: app/API.md "Read API v1". The handlers live in services/apiV1.ts; this file
 * only resolves WHO is asking (one company, from the key or the session) and hands that company to them.
 */

const scopesOf = (v: unknown): ApiScope[] => (Array.isArray(v) ? v.filter((x): x is ApiScope => (API_SCOPES as readonly string[]).includes(String(x))) : []);

/** The one company this request may read: from the API key, or from the session + `X-Org-Id` membership. */
export async function v1Ctx(req: FastifyRequest): Promise<V1Ctx> {
  const h = req.headers.authorization;
  if (triesBearer(h)) {
    const token = bearerKey(h);
    const a = token ? await authenticateKey(token) : null;
    if (!a) throw new HttpError(401, 'This API key is not valid: it is unknown, revoked or expired', 'api_key_invalid');
    return { org: a.org, auth: 'api_key', key: a.key, scopes: scopesOf(a.key.scopes) };
  }
  if (!req.user) throw new HttpError(401, 'Send a company API key (Authorization: Bearer asc_…) or sign in', 'unauthorized');
  const orgId = req.headers['x-org-id'] ?? (req.query as { org?: string }).org;
  if (!orgId) throw badRequest('Name the company with the X-Org-Id header', undefined, 'org_missing');
  const a = await orgAccess(req, Array.isArray(orgId) ? orgId[0] : orgId);
  return { org: a.org, auth: 'session', key: null, scopes: roleAtLeast(a.role, 'member') ? ['read', 'publish_check'] : ['read'] };
}

/** rate-limit bucket: the key (hashed), else the session, else the address */
function bucket(req: FastifyRequest): string {
  const t = bearerKey(req.headers.authorization);
  if (t) return 'k:' + sha256(t).slice(0, 24);
  const sid = req.cookies?.sid;
  return sid ? 's:' + sha256(sid).slice(0, 24) : 'ip:' + req.ip;
}
const perMinute = { rateLimit: { max: API_KEY.perMinute, timeWindow: '1 minute', keyGenerator: bucket } };
const perCheck = { rateLimit: { max: API_KEY.publishChecksPer10Min, timeWindow: '10 minutes', keyGenerator: bucket } };

const readCtx = async (req: FastifyRequest) => {
  const ctx = await v1Ctx(req);
  requireScope(ctx, 'read');
  return ctx;
};

const ENDPOINTS = [
  'GET /api/v1/websites',
  'GET /api/v1/websites/:websiteId',
  'GET /api/v1/websites/:websiteId/audits',
  'GET /api/v1/websites/:websiteId/audits/:auditId',
  'GET /api/v1/runs',
  'GET /api/v1/runs/:runId',
  'GET /api/v1/reports',
  'GET /api/v1/reports/:reportId',
  'GET /api/v1/files/:fileId',
  'POST /api/v1/publish-check',
  'POST /api/v1/mcp',
];

// ---------------- MCP (Streamable HTTP, JSON answers only) over the same handlers ----------------

type Args = Record<string, unknown>;
const listArgs = { limit: { type: 'integer', minimum: 1, maximum: 100 }, cursor: { type: 'string', description: 'nextCursor of the previous page' } };
const TOOLS: { name: string; description: string; inputSchema: Record<string, unknown>; run: (ctx: V1Ctx, a: Args) => Promise<unknown> }[] = [
  { name: 'list_websites', description: "The company's websites (id, domain, whether ownership is verified).", inputSchema: { type: 'object', properties: listArgs }, run: (c, a) => listWebsites(c, a) },
  {
    name: 'list_audits',
    description: 'Technical audits and full SEO reports of one verified website, newest first: health score, grade, findings by severity.',
    inputSchema: { type: 'object', properties: { websiteId: { type: 'string' }, ...listArgs }, required: ['websiteId'] },
    run: (c, a) => listAudits(c, a.websiteId, a),
  },
  {
    name: 'get_audit',
    description:
      "One audit's findings in its own fix-list order, with severity, pages affected, the pages checked, evidence, and whether each is new, open, fixed or no longer seen compared with the previous audit of the same type. Filter with severity (e.g. 'high,critical') and status (e.g. 'new').",
    inputSchema: { type: 'object', properties: { websiteId: { type: 'string' }, auditId: { type: 'string' }, severity: { type: 'string' }, status: { type: 'string' } }, required: ['websiteId', 'auditId'] },
    run: (c, a) => getAudit(c, a.websiteId, a.auditId, a),
  },
  {
    name: 'list_runs',
    description: "The company's analyses, newest first, with status and cost (and whether the cost is measured or estimated).",
    inputSchema: { type: 'object', properties: { websiteId: { type: 'string' }, status: { type: 'string' }, mode: { type: 'string' }, ...listArgs } },
    run: (c, a) => listRuns(c, a),
  },
  { name: 'get_run', description: 'One analysis with its input and every report it produced.', inputSchema: { type: 'object', properties: { runId: { type: 'string' } }, required: ['runId'] }, run: (c, a) => getRun(c, a.runId) },
  {
    name: 'list_reports',
    description: "Reports (one per result the engine sent), newest first. 'ready' says whether it is finished work or why it is held (a draft that failed its quality check, a verdict that could not be read).",
    inputSchema: { type: 'object', properties: { websiteId: { type: 'string' }, stage: { type: 'string' }, ...listArgs } },
    run: (c, a) => listReports(c, a),
  },
  { name: 'get_report', description: 'One report with its full content.', inputSchema: { type: 'object', properties: { reportId: { type: 'string' } }, required: ['reportId'] }, run: (c, a) => getReport(c, a.reportId) },
  {
    name: 'publish_check',
    description:
      'Is this page publishable? Runs the same deterministic quality gate a written page must pass (placeholders, invented prices, unsourced figures, coverage, readability, answer-first) over a page you supply. Free, writes nothing. Names every reason and what could not be checked.',
    inputSchema: {
      type: 'object',
      properties: {
        markdown: { type: 'string', description: 'the whole page; optional Title: / Meta Description: / Slug: lines above the H1' },
        keyword: { type: 'string', description: 'the search the page is for' },
        domain: { type: 'string', description: 'one of your verified websites' },
        page_type: { type: 'string' },
        target_words: { type: 'integer', minimum: 200, maximum: 10000 },
        terms: { type: 'array', items: {} },
        competitors: { type: 'array', items: { type: 'object' } },
        sources: { type: 'array', items: { type: 'object' } },
        internal_links: { type: 'array', items: { type: 'string' } },
        business_facts: { type: 'string' },
        country: { type: 'string' },
        currency: { type: 'string' },
        ai_question: { type: 'string' },
        ai_fanout: { type: 'array', items: { type: 'string' } },
      },
      required: ['markdown', 'keyword'],
    },
    run: async (c, a) => (await publishCheck(c, a)).body,
  },
];

const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];

type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
const rpcError = (id: Rpc['id'], code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

async function mcp(ctx: V1Ctx, msg: Rpc): Promise<unknown | null> {
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return rpcError(msg?.id, -32600, 'Invalid request');
  if (msg.id === undefined) return null; // a notification (e.g. notifications/initialized): nothing to answer
  const ok = (result: unknown) => ({ jsonrpc: '2.0', id: msg.id, result });
  switch (msg.method) {
    case 'initialize': {
      const asked = String(msg.params?.protocolVersion ?? '');
      return ok({
        protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'ascentra', title: `${config.brand} — ${ctx.org.name}`, version: '1.0.0' },
        instructions: `Read-only access to ${ctx.org.name}'s SEO data: websites, technical audits and their findings, analyses, reports, and a free publish check. Nothing here starts a run or changes a setting.`,
      });
    }
    case 'ping':
      return ok({});
    case 'tools/list':
      return ok({ tools: TOOLS.filter((t) => (t.name === 'publish_check' ? ctx.scopes.includes('publish_check') : ctx.scopes.includes('read'))).map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === msg.params?.name);
      if (!tool) return rpcError(msg.id, -32602, `Unknown tool: ${String(msg.params?.name ?? '')}`);
      try {
        if (tool.name !== 'publish_check') requireScope(ctx, 'read');
        const args = msg.params?.arguments && typeof msg.params.arguments === 'object' ? (msg.params.arguments as Args) : {};
        const result = (await tool.run(ctx, args)) as Record<string, unknown>;
        return ok({ content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result, isError: false });
      } catch (e) {
        const he = e instanceof HttpError ? e : null;
        if (!he) throw e;
        const text = he.fields ? `${he.message} (${Object.entries(he.fields).map(([k, v]) => `${k}: ${v}`).join('; ')})` : he.message;
        return ok({ content: [{ type: 'text', text }], isError: true });
      }
    }
    default:
      return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

// ---------------- routes ----------------

export async function apiV1Routes(app: FastifyInstance) {
  app.get('/api/v1', { config: perMinute }, async (req) => {
    const ctx = await v1Ctx(req);
    return {
      company: { id: ctx.org.id, name: ctx.org.name },
      auth: ctx.auth,
      key: ctx.key ? { id: ctx.key.id, name: ctx.key.name, prefix: ctx.key.prefix, scopes: scopesOf(ctx.key.scopes) } : null,
      scopes: ctx.scopes,
      limits: { perMinute: API_KEY.perMinute, publishChecksPer10Minutes: API_KEY.publishChecksPer10Min, pageSizeMax: 100 },
      endpoints: ENDPOINTS,
    };
  });

  app.get('/api/v1/websites', { config: perMinute }, async (req) => listWebsites(await readCtx(req), req.query as Args));
  app.get('/api/v1/websites/:websiteId', { config: perMinute }, async (req) => getWebsite(await readCtx(req), (req.params as Args).websiteId));
  app.get('/api/v1/websites/:websiteId/audits', { config: perMinute }, async (req) => listAudits(await readCtx(req), (req.params as Args).websiteId, req.query as Args));
  app.get('/api/v1/websites/:websiteId/audits/:auditId', { config: perMinute }, async (req) => {
    const p = req.params as Args;
    return getAudit(await readCtx(req), p.websiteId, p.auditId, req.query as Args);
  });
  app.get('/api/v1/runs', { config: perMinute }, async (req) => listRuns(await readCtx(req), req.query as Args));
  app.get('/api/v1/runs/:runId', { config: perMinute }, async (req) => getRun(await readCtx(req), (req.params as Args).runId));
  app.get('/api/v1/reports', { config: perMinute }, async (req) => listReports(await readCtx(req), req.query as Args));
  app.get('/api/v1/reports/:reportId', { config: perMinute }, async (req) => getReport(await readCtx(req), (req.params as Args).reportId));
  app.get('/api/v1/files/:fileId', { config: perMinute }, async (req, reply) => {
    const f = await fileOf(await readCtx(req), (req.params as Args).fileId);
    return sendFile(reply, f, (req.query as { download?: string }).download === '1');
  });

  app.post('/api/v1/publish-check', { config: perCheck, bodyLimit: 2 * 1024 * 1024 }, async (req, reply) => {
    const r = await publishCheck(await v1Ctx(req), req.body);
    return reply.status(r.status).send(r.body);
  });

  app.get('/api/v1/mcp', async (_req, reply) => reply.status(405).header('allow', 'POST').send({ error: 'This MCP server answers POST requests only (no event stream)', code: 'method_not_allowed' }));
  app.post('/api/v1/mcp', { config: perMinute, bodyLimit: 2 * 1024 * 1024 }, async (req, reply: FastifyReply) => {
    // DNS-rebinding guard of the MCP spec: a browser page of another origin may not drive it
    const origin = req.headers.origin;
    if (origin && origin !== new URL(config.appUrl).origin) throw new HttpError(403, 'This origin may not use the MCP endpoint', 'origin_refused');
    if (!triesBearer(req.headers.authorization)) throw new HttpError(401, 'The MCP endpoint takes a company API key (Authorization: Bearer asc_…)', 'unauthorized');
    const ctx = await v1Ctx(req);
    if (Array.isArray(req.body)) return reply.send(rpcError(null, -32600, 'Batches are not supported'));
    const out = await mcp(ctx, req.body as Rpc);
    if (out == null) return reply.status(202).send();
    return reply.header('content-type', 'application/json').send(out);
  });

  // ---- the company's API keys (session only: Company settings → API access) ----
  app.get('/api/orgs/:orgId/api-keys', async (req) => {
    const a = await orgAccess(req, (req.params as Args).orgId, 'admin');
    return { items: await listKeys(a.org.id), max: API_KEY.maxLive };
  });
  app.post('/api/orgs/:orgId/api-keys', { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (req) => {
    const a = await orgAccess(req, (req.params as Args).orgId, 'admin');
    const b = parse(apiKeyCreateSchema, req.body ?? {});
    const { key, token } = await createKey({ org: a.org, user: a.user, name: b.name, scopes: b.scopes, expiresInDays: b.expiresInDays });
    return { ...key, token };
  });
  app.delete('/api/orgs/:orgId/api-keys/:keyId', async (req) => {
    const p = req.params as Args;
    const a = await orgAccess(req, p.orgId, 'admin');
    if (!isUuid(p.keyId)) throw notFound('API key not found');
    return revokeKey(a.org.id, p.keyId);
  });

  // ---- B3-7 in the app: Content → "Check a page before you publish" (member, verified website) ----
  app.post('/api/orgs/:orgId/sites/:siteId/publish-check', { config: perCheck, bodyLimit: 2 * 1024 * 1024 }, async (req, reply) => {
    const p = req.params as Args;
    const a = await siteAccess(req, p.orgId, p.siteId, 'member');
    requireVerified(a.site);
    const r = await publishCheck({ org: a.org, auth: 'session', key: null, scopes: ['read', 'publish_check'] }, req.body, a.site);
    return reply.status(r.status).send(r.body);
  });
}
