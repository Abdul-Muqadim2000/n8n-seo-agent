import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { audit } from '../services/audit';
import { API_KEY, API_SCOPES, apiKeyCreateSchema, bearerKey, EXPORT_TABLES, exportColumns, IDEMPOTENCY, roleAtLeast, triesBearer, type ApiScope } from '@seo/shared';
import { isUuid, orgAccess, requireVerified, siteAccess } from '../auth/access';
import { config } from '../config';
import { sha256 } from '../lib/crypto';
import { badRequest, HttpError, notFound, parse } from '../lib/errors';
import { authenticateKey, createKey, listKeys, revokeKey } from '../services/apiKeys';
import { actorOf, modesV1, startRunV1 } from '../services/apiRuns';
import { createEndpoint, deleteEndpoint, listEndpoints, listWebhookDeliveries, testEndpoint } from '../services/webhooks';
import { connectedTrackers, createIssue, listIssues } from '../services/issueTrackers';
import { runExport, tableRowsV1 } from '../services/exports';
import {
  fileOf,
  getAiSegments,
  getAudit,
  getCrawlers,
  getReport,
  getRun,
  getWebsite,
  listAudits,
  listReports,
  listRuns,
  listWebsites,
  publishCheck,
  requireScope,
  siteOf,
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
    return { org: a.org, auth: 'api_key', key: a.key, scopes: scopesOf(a.key.scopes), req };
  }
  if (!req.user) throw new HttpError(401, 'Send a company API key (Authorization: Bearer asc_...) or sign in', 'unauthorized');
  const orgId = req.headers['x-org-id'] ?? (req.query as { org?: string }).org;
  if (!orgId) throw badRequest('Name the company with the X-Org-Id header', undefined, 'org_missing');
  const a = await orgAccess(req, Array.isArray(orgId) ? orgId[0] : orgId);
  // a person's session may do through the API what their role lets them do in the app
  const scopes: ApiScope[] = roleAtLeast(a.role, 'admin') ? ['read', 'publish_check', 'run', 'admin'] : roleAtLeast(a.role, 'member') ? ['read', 'publish_check', 'run'] : ['read'];
  return { org: a.org, auth: 'session', key: null, scopes, actor: a, req };
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
/** G4: the same ceiling as the app's own "start a run" route (30 a minute), per key */
const perRun = { rateLimit: { max: API_KEY.runsPerMinute, timeWindow: '1 minute', keyGenerator: bucket } };

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
  'GET /api/v1/websites/:websiteId/crawlers',
  'GET /api/v1/websites/:websiteId/ai-segments',
  'GET /api/v1/runs',
  'GET /api/v1/runs/:runId',
  'GET /api/v1/reports',
  'GET /api/v1/reports/:reportId',
  'GET /api/v1/files/:fileId',
  'POST /api/v1/publish-check',
  'GET /api/v1/modes',
  'POST /api/v1/runs',
  'GET /api/v1/tables',
  'GET /api/v1/websites/:websiteId/tables/:table',
  'POST /api/v1/exports/:id/run',
  'GET /api/v1/issues',
  'POST /api/v1/issues',
  'GET /api/v1/webhooks',
  'POST /api/v1/webhooks',
  'DELETE /api/v1/webhooks/:id',
  'POST /api/v1/webhooks/:id/test',
  'POST /api/v1/mcp',
];

/** G4 + G1: who the audit log names for a write through the API, the key's creator "via API key <name>", or the signed-in person */
const apiActor = (ctx: V1Ctx, a: { user: { id: string; email: string } }) => ({
  type: 'user' as const,
  userId: a.user.id,
  label: ctx.key ? `${a.user.email} via API key ${ctx.key.name} (${ctx.key.prefix}...)` : a.user.email,
});

// ---------------- MCP (Streamable HTTP, JSON answers only) over the same handlers ----------------

type Args = Record<string, unknown>;
const listArgs = { limit: { type: 'integer', minimum: 1, maximum: 100 }, cursor: { type: 'string', description: 'nextCursor of the previous page' } };
type Tool = { name: string; description: string; inputSchema: Record<string, unknown>; scope?: ApiScope; run: (ctx: V1Ctx, a: Args) => Promise<unknown> };
const toolScope = (t: Tool): ApiScope => t.scope ?? (t.name === 'publish_check' ? 'publish_check' : 'read');
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const runArgs = {
  input: {
    type: 'object',
    description:
      'The analysis, exactly as the app form sends it: { mode, websiteId, ... }. Call list_modes for the fields of every mode. Example: { "mode": "audit", "websiteId": "<id>", "reportType": "site_audit" }.',
    additionalProperties: true,
  },
  acknowledge: { type: 'array', items: { type: 'string' }, description: 'ids of the duplicate warnings you accept (from preview_run or a confirm_needed answer)' },
};
const TOOLS: Tool[] = [
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
    name: 'get_crawler_activity',
    description:
      "What Googlebot, Bingbot and the AI crawlers (GPTBot, ClaudeBot, PerplexityBot, ChatGPT-User ...) actually requested on one verified website, from its own access logs: requests per crawler and day with how many were proved by the vendor's IP list or DNS, spoofed crawlers counted apart, pages Google or AI did not fetch, crawl budget spent on redirects / errors / parameter URLs, pages AI assistants fetched because a person asked, response times. days: 7, 30 or 90.",
    inputSchema: { type: 'object', properties: { websiteId: { type: 'string' }, days: { type: 'integer', enum: [7, 30, 90] } }, required: ['websiteId'] },
    run: (c, a) => getCrawlers(c, a.websiteId, a),
  },
  {
    name: 'get_ai_visibility_segments',
    description:
      "How often AI assistants name one verified website, per engine, topic cluster, buyer role, market and funnel stage (and topic x role, engine x topic, market x topic), from its latest weekly AI visibility run: answers counted, the share naming it with the 95% range, 'enough' (12+ answers), share of voice against the businesses named instead, and the changes a Benjamini-Hochberg screen called real; plus the question panel it was measured on. dimension: engine | cluster | persona | market | stage | 'cluster x persona' | 'engine x cluster' | 'market x cluster'.",
    inputSchema: { type: 'object', properties: { websiteId: { type: 'string' }, dimension: { type: 'string' } }, required: ['websiteId'] },
    run: (c, a) => getAiSegments(c, a.websiteId, a),
  },
  {
    name: 'list_runs',
    description: "The company's analyses, newest first, with their status and credits (quoted, charged, and whether credits are held while one runs).",
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
  {
    name: 'get_table',
    description:
      'Rows of one export table for one verified website, oldest first: rank_history (keyword positions), site_metrics (weekly Search Console / GA4), audit_findings, ai_visibility, backlinks, runs (analyses and their credits). Filter by date with since / until (ISO).',
    inputSchema: {
      type: 'object',
      properties: { websiteId: { type: 'string' }, table: { type: 'string', enum: ['rank_history', 'site_metrics', 'audit_findings', 'ai_visibility', 'backlinks', 'runs'] }, since: { type: 'string' }, until: { type: 'string' }, ...listArgs },
      required: ['websiteId', 'table'],
    },
    run: async (c, a) => tableRowsV1(c.org, await siteOf(c, a.websiteId), a.table, a),
  },
  // ---- G4: starting work (scope "run") ----
  { name: 'list_modes', description: 'Every analysis that can be started, with what it delivers, what it is quoted in credits, its minutes, and the JSON Schema of its input.', inputSchema: { type: 'object', properties: {} }, run: async () => modesV1() },
  {
    name: 'preview_run',
    scope: 'run',
    description:
      'Before starting an analysis: its quote in credits and its time, whether the company\'s credits allow it now, and any warning that it duplicates work already planned or running (each with an id). Starts nothing, uses no credits.',
    inputSchema: { type: 'object', properties: runArgs, required: ['input'] },
    run: async (c, a) => (await startRunV1(c, { ...obj(a.input), acknowledge: a.acknowledge, dryRun: true }, undefined)).body,
  },
  {
    name: 'start_run',
    scope: 'run',
    description:
      "Starts an analysis (it uses the company's credits: held at its quote while it runs, charged what it used and never more; the same checks as the app's form). If it duplicates planned or running work it is refused with the warnings: read them, then pass their ids in acknowledge. Pass the same idempotencyKey when you retry, so a retry never starts a second run. Follow it with get_run.",
    inputSchema: { type: 'object', properties: { ...runArgs, idempotencyKey: { type: 'string', description: 'any unique string, e.g. a UUID; reuse it to retry safely' } }, required: ['input'] },
    run: async (c, a) => (await startRunV1(c, { ...obj(a.input), acknowledge: a.acknowledge }, a.idempotencyKey == null ? undefined : String(a.idempotencyKey))).body,
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
        serverInfo: { name: 'alaventra', title: `${config.brand}: ${ctx.org.name}`, version: '1.0.0' },
        instructions: ctx.scopes.includes('run')
          ? `Access to ${ctx.org.name}'s SEO data (websites, audits and findings, crawler activity from server logs, analyses, reports, a free publish check) and to starting analyses with the company's credits. Before start_run, call preview_run: it shows the quote in credits and any duplicate warning. Never acknowledge a warning the user has not seen.`
          : `Read-only access to ${ctx.org.name}'s SEO data: websites, technical audits and their findings, crawler activity from server logs, analyses, reports, and a free publish check. This key cannot start a run or change a setting.`,
      });
    }
    case 'ping':
      return ok({});
    case 'tools/list':
      return ok({ tools: TOOLS.filter((t) => ctx.scopes.includes(toolScope(t))).map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === msg.params?.name);
      if (!tool) return rpcError(msg.id, -32602, `Unknown tool: ${String(msg.params?.name ?? '')}`);
      try {
        requireScope(ctx, toolScope(tool));
        const args = msg.params?.arguments && typeof msg.params.arguments === 'object' ? (msg.params.arguments as Args) : {};
        const result = (await tool.run(ctx, args)) as Record<string, unknown>;
        return ok({ content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result, isError: false });
      } catch (e) {
        const he = e instanceof HttpError ? e : null;
        if (!he) throw e;
        const text = he.fields ? `${he.message} (${Object.entries(he.fields).map(([k, v]) => `${k}: ${v}`).join('; ')})` : he.message;
        // a refusal that carries data (the duplicate warnings of confirm_needed) hands it to the assistant as well
        if (he.extra) return ok({ content: [{ type: 'text', text: `${text}\n${JSON.stringify(he.extra)}` }], structuredContent: { error: he.message, code: he.code, ...he.extra }, isError: true });
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
      limits: { perMinute: API_KEY.perMinute, publishChecksPer10Minutes: API_KEY.publishChecksPer10Min, runsPerMinute: API_KEY.runsPerMinute, pageSizeMax: 100 },
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
  app.get('/api/v1/websites/:websiteId/crawlers', { config: perMinute }, async (req) => getCrawlers(await readCtx(req), (req.params as Args).websiteId, req.query as Args));
  app.get('/api/v1/websites/:websiteId/ai-segments', { config: perMinute }, async (req) => getAiSegments(await readCtx(req), (req.params as Args).websiteId, req.query as Args));   // G6
  app.get('/api/v1/runs', { config: perMinute }, async (req) => listRuns(await readCtx(req), req.query as Args));
  app.get('/api/v1/runs/:runId', { config: perMinute }, async (req) => getRun(await readCtx(req), (req.params as Args).runId));
  app.get('/api/v1/reports', { config: perMinute }, async (req) => listReports(await readCtx(req), req.query as Args));
  app.get('/api/v1/reports/:reportId', { config: perMinute }, async (req) => getReport(await readCtx(req), (req.params as Args).reportId));
  app.get('/api/v1/files/:fileId', { config: perMinute }, async (req, reply) => {
    const f = await fileOf(await readCtx(req), (req.params as Args).fileId);
    return sendFile(reply, f, (req.query as { download?: string }).download === '1');
  });

  // ---- G4: the write API (scope "run"): start any analysis a form can start ----
  app.get('/api/v1/modes', { config: perMinute }, async (req) => {
    await readCtx(req);
    return modesV1();
  });
  app.post('/api/v1/runs', { config: perRun }, async (req, reply) => {
    const ctx = await v1Ctx(req);
    const h = req.headers[IDEMPOTENCY.header];
    const r = await startRunV1(ctx, req.body, Array.isArray(h) ? h[0] : h);
    if (r.replayed) reply.header(IDEMPOTENCY.replayHeader, 'true');
    return reply.status(r.status).send(r.body);
  });

  // ---- G4: the export tables, readable per website (what the Looker Studio connector calls) ----
  app.get('/api/v1/tables', { config: perMinute }, async (req) => {
    await readCtx(req);
    return { items: EXPORT_TABLES.map((t) => ({ id: t.id, label: t.label, grain: t.grain, dateColumn: t.dateColumn, columns: exportColumns(t) })) };
  });
  app.get('/api/v1/websites/:websiteId/tables/:table', { config: perMinute }, async (req) => {
    const ctx = await readCtx(req);
    const p = req.params as Args;
    return tableRowsV1(ctx.org, await siteOf(ctx, p.websiteId), p.table, req.query as Args);
  });
  app.post('/api/v1/exports/:id/run', { config: perRun }, async (req) => {
    const ctx = await v1Ctx(req);
    const a = await actorOf(ctx, 'admin');
    const r = await runExport(a.org.id, (req.params as Args).id, 'manual');
    await audit(req, a.org.id, { action: 'integration.export_started', actor: apiActor(ctx, a), target: { type: 'integration', id: r.integrationId }, outcome: r.status === 'failed' ? 'failure' : 'success', details: { status: r.status } });
    return r;
  });

  // ---- G4: tickets in the company's tracker (create: scope "run"; read: "read") ----
  app.get('/api/v1/issues', { config: perMinute }, async (req) => {
    const ctx = await readCtx(req);
    const w = (req.query as Args).websiteId;
    const site = w ? await siteOf(ctx, w) : null;
    return { items: await listIssues(ctx.org.id, site?.id ?? null), trackers: await connectedTrackers(ctx.org.id) };
  });
  app.post('/api/v1/issues', { config: perRun }, async (req, reply) => {
    const ctx = await v1Ctx(req);
    const a = await actorOf(ctx, 'run');
    const r = await createIssue(a, req.body);
    if (!r.existing) await audit(req, a.org.id, { action: 'issue.created', actor: apiActor(ctx, a), target: { type: 'issue', id: r.issue.id, label: r.issue.remoteKey }, details: { kind: r.issue.kind, source: r.issue.sourceKey } });
    return reply.status(r.existing ? 200 : 201).send(r);
  });

  // ---- G4: event webhooks (scope "admin"; the key acts as its creator, who must still be an admin) ----
  app.get('/api/v1/webhooks', { config: perMinute }, async (req) => {
    const a = await actorOf(await v1Ctx(req), 'admin');
    return { items: await listEndpoints(a.org.id), deliveries: await listWebhookDeliveries(a.org.id, 50) };
  });
  app.post('/api/v1/webhooks', { config: perRun }, async (req, reply) => {
    const ctx = await v1Ctx(req);
    const a = await actorOf(ctx, 'admin');
    const r = await createEndpoint(a.org, a.user, req.body);
    await audit(req, a.org.id, { action: 'integration.webhook_added', actor: apiActor(ctx, a), target: { type: 'webhook', id: r.endpoint.id, label: r.endpoint.name }, details: { format: r.endpoint.format, host: r.endpoint.urlHost, events: r.endpoint.events } });
    return reply.status(201).send(r);
  });
  app.delete('/api/v1/webhooks/:id', { config: perMinute }, async (req) => {
    const ctx = await v1Ctx(req);
    const a = await actorOf(ctx, 'admin');
    const r = await deleteEndpoint(a.org.id, (req.params as Args).id);
    await audit(req, a.org.id, { action: 'integration.webhook_removed', actor: apiActor(ctx, a), target: { type: 'webhook', id: String((req.params as Args).id) } });
    return r;
  });
  app.post('/api/v1/webhooks/:id/test', { config: perRun }, async (req) => {
    const a = await actorOf(await v1Ctx(req), 'admin');
    return testEndpoint(a.org, (req.params as Args).id);
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
    if (!triesBearer(req.headers.authorization)) throw new HttpError(401, 'The MCP endpoint takes a company API key (Authorization: Bearer asc_...)', 'unauthorized');
    const ctx = await v1Ctx(req);
    if (Array.isArray(req.body)) return reply.send(rpcError(null, -32600, 'Batches are not supported'));
    const out = await mcp(ctx, req.body as Rpc);
    if (out == null) return reply.status(202).send();
    return reply.header('content-type', 'application/json').send(out);
  });

  // ---- the company's API keys (session only: Company settings -> API access) ----
  app.get('/api/orgs/:orgId/api-keys', async (req) => {
    const a = await orgAccess(req, (req.params as Args).orgId, 'admin');
    return { items: await listKeys(a.org.id), max: API_KEY.maxLive };
  });
  app.post('/api/orgs/:orgId/api-keys', { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (req) => {
    const a = await orgAccess(req, (req.params as Args).orgId, 'admin');
    const b = parse(apiKeyCreateSchema, req.body ?? {});
    const { key, token } = await createKey({ org: a.org, user: a.user, name: b.name, scopes: b.scopes, expiresInDays: b.expiresInDays });
    await audit(req, a.org.id, { action: 'apikey.created', target: { type: 'api_key', id: key.id, label: `${key.name} (${key.prefix}...)` }, details: { scopes: key.scopes, expiresAt: key.expiresAt } });
    return { ...key, token };
  });
  app.delete('/api/orgs/:orgId/api-keys/:keyId', async (req) => {
    const p = req.params as Args;
    const a = await orgAccess(req, p.orgId, 'admin');
    if (!isUuid(p.keyId)) throw notFound('API key not found');
    const k = await revokeKey(a.org.id, p.keyId);
    await audit(req, a.org.id, { action: 'apikey.revoked', target: { type: 'api_key', id: k.id, label: `${k.name} (${k.prefix}...)` } });
    return k;
  });

  // ---- B3-7 in the app: Content -> "Check a page before you publish" (member, verified website) ----
  app.post('/api/orgs/:orgId/sites/:siteId/publish-check', { config: perCheck, bodyLimit: 2 * 1024 * 1024 }, async (req, reply) => {
    const p = req.params as Args;
    const a = await siteAccess(req, p.orgId, p.siteId, 'member');
    requireVerified(a.site);
    const r = await publishCheck({ org: a.org, auth: 'session', key: null, scopes: ['read', 'publish_check'] }, req.body, a.site);
    return reply.status(r.status).send(r.body);
  });
}
