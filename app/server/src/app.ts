import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { readSession } from './auth/session';
import { config } from './config';
import { corsHook } from './lib/crossOrigin';
import { HttpError } from './lib/errors';
import { linkBuilderRoutes } from './routes/linkBuilder';
import { crawlerRoutes, crawlerStreamRoutes } from './routes/crawlers';
import { apiV1Routes } from './routes/apiV1';
import { integrationRoutes } from './routes/integrations';
import { cmsRoutes } from './routes/cms';
import { agencyRoutes } from './routes/agency';
import { hostGate } from './services/portalHosts';
import { portalIndexHtml } from './services/portalShell';
import { triesBearer } from '@seo/shared';
import { adminRoutes } from './routes/admin';
import { billingRoutes } from './routes/billing';
import { authRoutes } from './routes/auth';
import { dataRoutes } from './routes/data';
import { hookRoutes } from './routes/hooks';
import { keywordRoutes } from './routes/keywords';
import { ladderRoutes } from './routes/ladders';
import { autopilotRoutes } from './routes/autopilot';
import { meRoutes } from './routes/me';
import { mfaRoutes } from './routes/mfa';
import { securityRoutes } from './routes/security';
import { sessionRoutes } from './routes/sessions';
import { ssoRoutes } from './routes/sso';
import { scimRoutes } from './routes/scim';
import { orgRoutes } from './routes/orgs';
import { runRoutes } from './routes/runs';
import { siteRoutes } from './routes/sites';
import { sqlClient } from './db';
import { n8nHealth } from './n8n/client';

export async function buildApp(): Promise<FastifyInstance> {
  // the callback URL carries the company's token: never in the logs
  const redact = (url: string) => url.replace(/(\/api\/hooks\/n8n\/)[^/?#]+/, '$1***');
  const serializers = { req: (r: { method: string; url: string; ip?: string }) => ({ method: r.method, url: redact(r.url), ip: r.ip }) };
  const app = Fastify({
    logger: config.isProd || config.logLevel === 'silent' ? { level: config.logLevel, serializers } : { level: config.logLevel, serializers, transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } },
    // behind a reverse proxy: trust exactly that many hops of X-Forwarded-For (never every hop: the client controls the leftmost)
    trustProxy: config.trustProxy > 0 ? (_addr: string, hop: number) => hop < config.trustProxy : false,
    // 1 MB for people; the n8n callback route allows 40 MB (PDFs and Word files as base64)
    bodyLimit: 1024 * 1024,
  });

  // on plain http (local or LAN use) the https-only headers would break the page: browsers would rewrite every asset to https
  const https = config.appUrl.startsWith('https://');
  await app.register(helmet, {
    hsts: https ? { maxAge: 15552000, includeSubDomains: false } : false,
    crossOriginOpenerPolicy: https,
    originAgentCluster: https,
    contentSecurityPolicy: {
      directives: {
        upgradeInsecureRequests: https ? [] : null,
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        frameSrc: ["'self'", 'blob:', 'https://www.youtube-nocookie.com', 'https://www.youtube.com'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });

  app.decorateRequest('user', null);
  app.decorateRequest('sessionId', null);
  app.decorateRequest('session', null);
  app.decorateRequest('portal', null);

  // G5 (app/docs/WHITE_LABEL.md §2): the host decides the tenant before anything else, a verified portal host sets `req.portal`,
  // a lapsed one (and, with strict hosts, any unknown one) gets a plain 421 and nothing of the app; on a portal host our own icons
  // and social images are not served (the page names the agency, not us)
  app.addHook('onRequest', async (req, reply) => {
    if (!(await hostGate(req, reply))) return reply;
    if (req.portal && /^\/(favicon[^/]*|apple-touch-icon[^/]*|safari-pinned-tab\.svg|site\.webmanifest|og-image\.png|brand\/.*|maskable-icon[^/]*)(\?|$)/.test(req.url))
      return reply.status(404).header('cache-control', 'no-store').send('');
    // the static plugin would answer "/" with the app's own shell: the portal's comes from here
    if (req.portal && req.method === 'GET' && /^\/(index\.html)?(\?|$)/.test(req.url) && config.webDist)
      return reply.header('cache-control', 'no-cache').header('content-type', 'text/html; charset=utf-8').send(await portalIndexHtml(resolve(config.webDist), req.portal.orgId));
  });

  // deploy/gcp: the front end on another host of the same site uploads here directly (lib/crossOrigin.ts); its preflight ends here
  app.addHook('onRequest', async (req, reply) => {
    if (corsHook(req, reply)) return reply;
  });

  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/')) return;
    // B5-11: a request to the read API that presents a company API key is authenticated by that key alone - never by the cookie - so
    // it needs no CSRF header (a cross-site form cannot set Authorization) and its session is not read at all
    // G1: SCIM is authenticated by its own bearer token only (routes/scim.ts), never by a cookie
    if ((req.url.startsWith('/api/v1') && triesBearer(req.headers.authorization)) || req.url.startsWith('/api/scim/')) {
      req.user = null;
      req.sessionId = null;
      return;
    }
    // CSRF: state-changing requests must carry a header a cross-site form cannot set (n8n callbacks authenticate by URL token instead)
    // log pushes (Cloudflare Logpush, log drains) authenticate by the site's push key in a header, like n8n callbacks by URL token
    const machine = req.url.startsWith('/api/hooks/') || req.url.startsWith('/api/ingest/');
    // G1: the SAML answer is a cross-site form POST from the identity provider, authenticated by its signature and our request id
    const samlAcs = req.method === 'POST' && /^\/api\/sso\/saml\/[^/]+\/acs(\?|$)/.test(req.url);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !machine && !samlAcs && req.headers['x-requested-with'] !== 'fetch') {
      throw new HttpError(403, 'Missing X-Requested-With header', 'csrf');
    }
    if (machine || req.url === '/api/health') return;
    const s = await readSession(req, reply);
    req.user = s?.user ?? null;
    req.sessionId = s?.sessionId ?? null;
    req.session = s?.session ?? null;
  });

  app.setErrorHandler((err: FastifyError | HttpError, req, reply) => {
    if (err instanceof HttpError) {
      return reply.status(err.statusCode).send({ ...err.extra, error: err.message, code: err.code, fields: err.fields });
    }
    const status = (err as FastifyError).statusCode ?? 500;
    if (status === 429) return reply.status(429).send({ error: 'Too many attempts. Please wait a minute and try again.', code: 'rate_limited' });
    if (status >= 400 && status < 500) return reply.status(status).send({ error: err.message, code: (err as FastifyError).code });
    // unique-constraint races (two companies verifying the same domain at once, ...)
    if ((err as unknown as { code?: string }).code === '23505') return reply.status(409).send({ error: 'This already exists.', code: 'conflict' });
    req.log.error({ err }, 'request failed');
    return reply.status(500).send({ error: 'Something went wrong on our side. Please try again.', code: 'internal' });
  });

  app.get('/api/health', async (_req, reply) => {
    let db = false;
    try {
      await sqlClient`select 1`;
      db = true;
    } catch {
      db = false;
    }
    const n8n = await n8nHealth();
    // the container health check: 503 when the database is down
    return reply.status(db ? 200 : 503).send({ ok: db, db, n8n });
  });

  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(mfaRoutes);
  await app.register(securityRoutes);
  await app.register(sessionRoutes);
  await app.register(ssoRoutes);
  await app.register(scimRoutes);
  await app.register(orgRoutes);
  await app.register(siteRoutes);
  await app.register(dataRoutes);
  await app.register(ladderRoutes);
  await app.register(autopilotRoutes);
  await app.register(keywordRoutes);
  await app.register(runRoutes);
  await app.register(hookRoutes);
  await app.register(adminRoutes);
  await app.register(billingRoutes);
  await app.register(linkBuilderRoutes);
  await app.register(crawlerRoutes);
  await app.register(crawlerStreamRoutes);
  await app.register(apiV1Routes);
  await app.register(integrationRoutes);
  await app.register(cmsRoutes);
  await app.register(agencyRoutes);

  // the built React app (production image): static files, and index.html for every client-side route
  const dist = config.webDist ? resolve(config.webDist) : '';
  if (dist && existsSync(resolve(dist, 'index.html'))) {
    await app.register(fastifyStatic, {
      root: dist,
      wildcard: false,
      cacheControl: false,
      // hashed bundles never change; everything else (index.html, favicon, theme-init.js) is revalidated
      setHeaders: (reply, path) => void reply.header('cache-control', path.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache'),
    });
    app.setNotFoundHandler(async (req, reply) => {
      if (req.url.startsWith('/api/') || req.method !== 'GET') return reply.status(404).send({ error: 'Not found', code: 'not_found' });
      // G5: on a portal host the page shell names the agency from the first byte (title, icon), never us
      if (req.portal) return reply.header('cache-control', 'no-cache').header('content-type', 'text/html; charset=utf-8').send(await portalIndexHtml(dist, req.portal.orgId));
      return reply.header('cache-control', 'no-cache').sendFile('index.html');
    });
  } else {
    app.setNotFoundHandler((_req, reply) => reply.status(404).send({ error: 'Not found', code: 'not_found' }));
  }
  return app;
}
