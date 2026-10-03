import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { readSession } from './auth/session';
import { config } from './config';
import { HttpError } from './lib/errors';
import { adminRoutes } from './routes/admin';
import { authRoutes } from './routes/auth';
import { dataRoutes } from './routes/data';
import { hookRoutes } from './routes/hooks';
import { keywordRoutes } from './routes/keywords';
import { ladderRoutes } from './routes/ladders';
import { meRoutes } from './routes/me';
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
    logger: config.isProd ? { level: 'info', serializers } : { level: 'info', serializers, transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } },
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
        frameSrc: ["'self'", 'blob:'],
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

  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/')) return;
    // CSRF: state-changing requests must carry a header a cross-site form cannot set (n8n callbacks authenticate by URL token instead)
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.url.startsWith('/api/hooks/') && req.headers['x-requested-with'] !== 'fetch') {
      throw new HttpError(403, 'Missing X-Requested-With header', 'csrf');
    }
    if (req.url.startsWith('/api/hooks/') || req.url === '/api/health') return;
    const s = await readSession(req, reply);
    req.user = s?.user ?? null;
    req.sessionId = s?.sessionId ?? null;
  });

  app.setErrorHandler((err: FastifyError | HttpError, req, reply) => {
    if (err instanceof HttpError) {
      return reply.status(err.statusCode).send({ error: err.message, code: err.code, fields: err.fields });
    }
    const status = (err as FastifyError).statusCode ?? 500;
    if (status === 429) return reply.status(429).send({ error: 'Too many attempts. Please wait a minute and try again.', code: 'rate_limited' });
    if (status >= 400 && status < 500) return reply.status(status).send({ error: err.message, code: (err as FastifyError).code });
    // unique-constraint races (two companies verifying the same domain at once, …)
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
  await app.register(orgRoutes);
  await app.register(siteRoutes);
  await app.register(dataRoutes);
  await app.register(ladderRoutes);
  await app.register(keywordRoutes);
  await app.register(runRoutes);
  await app.register(hookRoutes);
  await app.register(adminRoutes);

  // the built React app (production image): static files, and index.html for every client-side route
  const dist = config.webDist ? resolve(config.webDist) : '';
  if (dist && existsSync(resolve(dist, 'index.html'))) {
    await app.register(fastifyStatic, {
      root: dist,
      wildcard: false,
      cacheControl: false,
      // hashed bundles never change; everything else (index.html, favicon, theme-init.js) is revalidated
      setHeaders: (res, path) => res.setHeader('cache-control', path.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache'),
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/') || req.method !== 'GET') return reply.status(404).send({ error: 'Not found', code: 'not_found' });
      return reply.header('cache-control', 'no-cache').sendFile('index.html');
    });
  } else {
    app.setNotFoundHandler((_req, reply) => reply.status(404).send({ error: 'Not found', code: 'not_found' }));
  }
  return app;
}
