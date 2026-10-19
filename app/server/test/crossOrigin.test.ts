import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// deploy/gcp, the web front end on app.<domain> (Vercel), this server on api.<domain>. Most requests come through the front end's own
// /api proxy; large uploads go to api.<domain> directly. What that needs, and what it must never open up:
//  - the session cookie is shared on the parent domain (COOKIE_DOMAIN) for hosts inside it, and stays host-only anywhere else;
//  - CORS with credentials for the listed front-end origin only, preflights answered before any session work;
//  - machine endpoints (log push, SCIM) are announced on PUBLIC_API_URL.

vi.hoisted(() => {
  process.env.APP_URL = 'https://app.alaventra.test';
  process.env.PUBLIC_API_URL = 'https://api.alaventra.test/';
  process.env.COOKIE_DOMAIN = '.Alaventra.test';
  process.env.CORS_ORIGINS = 'https://app.alaventra.test, not-an-origin, https://app.alaventra.test/';
  process.env.APP_EXTRA_HOSTS = 'api.alaventra.test';
  process.env.PORTAL_STRICT_HOSTS = 'false';
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.PORTAL_JOBS = 'false';
  process.env.CRAWLER_JOBS = 'false';
  process.env.LOG_LEVEL = 'silent';
});
vi.mock('../src/db', async () => (await import('./helpers/pg')).pgDbModule());

const { buildApp } = await import('../src/app');
const { config } = await import('../src/config');
const { cookieDomainFor, allowedOrigin } = await import('../src/lib/crossOrigin');
const { Client } = await import('./helpers/client');

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});

type Cookie = { name: string; value: string; domain?: string; maxAge?: number; expires?: Date; sameSite?: string; secure?: boolean };
const sid = (cookies: unknown) => (cookies as Cookie[]).find((c) => c.name === 'sid');

describe('settings', () => {
  it('normalises the three settings', () => {
    expect(config.publicApiUrl).toBe('https://api.alaventra.test');
    expect(config.cookieDomain).toBe('alaventra.test');
    expect(config.corsOrigins).toEqual(['https://app.alaventra.test', 'https://app.alaventra.test']);
  });
  it('shares the cookie only on hosts inside the domain', () => {
    expect(cookieDomainFor('app.alaventra.test')).toBe('alaventra.test');
    expect(cookieDomainFor('API.alaventra.test:443')).toBe('alaventra.test');
    expect(cookieDomainFor('alaventra.test')).toBe('alaventra.test');
    for (const h of ['seo.north-agency.com', 'evilalaventra.test', 'alaventra.test.evil.com', 'localhost', '', undefined])
      expect(cookieDomainFor(h), String(h)).toBeUndefined();
  });
  it('allows only the listed origins, exactly', () => {
    expect(allowedOrigin('https://app.alaventra.test')).toBe('https://app.alaventra.test');
    for (const o of ['https://evil.test', 'http://app.alaventra.test', 'https://app.alaventra.test.evil.com', 'null', undefined])
      expect(allowedOrigin(o), String(o)).toBeNull();
  });
});

describe('the session cookie across app.<domain> and api.<domain>', () => {
  it('signing in on app.<domain> sets the cookie on the parent domain (Lax, Secure), and api.<domain> reads it', async () => {
    const c = new Client(app);
    const r = await c.post('/api/auth/signup', { name: 'Split', email: 'split@alaventra.test', password: 'correct horse battery staple' }, { host: 'app.alaventra.test' });
    expect(r.status, r.text).toBe(200);
    const raw = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { host: 'app.alaventra.test', 'x-requested-with': 'fetch', 'content-type': 'application/json' }, payload: { email: 'split@alaventra.test', password: 'correct horse battery staple' } });
    const s = sid(raw.cookies);
    expect(s?.domain).toBe('alaventra.test');
    expect(s?.sameSite?.toLowerCase()).toBe('lax');
    expect(s?.secure).toBe(true);
    // the same cookie, sent by the browser to api.<domain> from the front end's origin
    const me = await app.inject({ method: 'GET', url: '/api/me', headers: { host: 'api.alaventra.test', origin: 'https://app.alaventra.test', cookie: `sid=${s?.value}` } });
    expect(me.statusCode, me.body).toBe(200);
    expect(JSON.parse(me.body)?.email ?? JSON.parse(me.body)?.user?.email).toBe('split@alaventra.test');
    expect(me.headers['access-control-allow-origin']).toBe('https://app.alaventra.test');
    expect(me.headers['access-control-allow-credentials']).toBe('true');
    expect(String(me.headers.vary)).toMatch(/origin/i);
    // signing out clears the parent-domain cookie too (a clear must name the same Domain)
    const out = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { host: 'app.alaventra.test', 'x-requested-with': 'fetch', cookie: `sid=${s?.value}` } });
    const cleared = (out.cookies as Cookie[]).filter((c) => c.name === 'sid');
    expect(cleared.some((c) => c.domain === 'alaventra.test' && (c.value === '' || c.maxAge === 0 || (c.expires && c.expires.getTime() < Date.now())))).toBe(true);
  });

  it('on a host outside the domain (an agency portal, localhost) the cookie stays host-only', async () => {
    const c = new Client(app);
    await c.post('/api/auth/signup', { name: 'Portal', email: 'portal@north-agency.com', password: 'correct horse battery staple' }, { host: 'seo.north-agency.com' });
    const raw = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { host: 'seo.north-agency.com', 'x-requested-with': 'fetch', 'content-type': 'application/json' }, payload: { email: 'portal@north-agency.com', password: 'correct horse battery staple' } });
    const s = sid(raw.cookies);
    expect(s?.value).toBeTruthy();
    expect(s?.domain).toBeUndefined();
  });
});

describe('CORS for direct uploads', () => {
  it('answers the preflight of the listed origin before routing (no session, no CSRF needed for OPTIONS)', async () => {
    const r = await app.inject({
      method: 'OPTIONS',
      url: '/api/orgs/x/sites/y/crawlers/upload?name=access.log',
      headers: { host: 'api.alaventra.test', origin: 'https://app.alaventra.test', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,x-requested-with' },
    });
    expect(r.statusCode).toBe(204);
    expect(r.headers['access-control-allow-origin']).toBe('https://app.alaventra.test');
    expect(r.headers['access-control-allow-credentials']).toBe('true');
    expect(String(r.headers['access-control-allow-headers'])).toContain('x-requested-with');
    expect(String(r.headers['access-control-allow-methods'])).toContain('POST');
  });
  it('gives any other origin nothing (the browser keeps the answer from its script; its preflight fails)', async () => {
    for (const origin of ['https://evil.test', 'https://app.alaventra.test.evil.com']) {
      const r = await app.inject({ method: 'OPTIONS', url: '/api/me', headers: { host: 'api.alaventra.test', origin, 'access-control-request-method': 'POST' } });
      expect(r.headers['access-control-allow-origin'], origin).toBeUndefined();
      expect(r.statusCode, origin).not.toBe(204);
      const g = await app.inject({ method: 'GET', url: '/api/health', headers: { host: 'api.alaventra.test', origin } });
      expect(g.headers['access-control-allow-origin'], origin).toBeUndefined();
    }
  });
  it('still refuses a cross-origin change without the CSRF header, even from the listed origin', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { host: 'api.alaventra.test', origin: 'https://app.alaventra.test' } });
    expect(r.statusCode).toBe(403);
    expect(JSON.parse(r.body).code).toBe('csrf');
  });
});
