import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// CR17 (client report 2026-11-17). M1: the API sends HSTS for two years with subdomains and a Permissions-Policy, the same values as
// the web pages (app/vercel.json). C2: the public pages are prerendered, so a web build's index.html is the marketing home; the app's
// plain shell is app.html, and this server (the production image, the agency portal shell) must serve that shell, never the home.

const dist = mkdtempSync(join(tmpdir(), 'web-dist-'));
const SHELL = '<!doctype html><html><head><title>Alaventra</title><meta name="description" content="x" /></head><body><div id="root"></div></body></html>';
writeFileSync(join(dist, 'index.html'), '<!doctype html><html><head><title>Home | Alaventra</title></head><body><div id="root" data-prerendered="/"><h1>Marketing home</h1></div></body></html>');
writeFileSync(join(dist, 'app.html'), SHELL);
// R4 L1: our public website's files in the same build (the API serves them at their own paths on our hosts, never on a portal)
const PUBLIC_FILES: Record<string, string> = {
  'pricing.html': '<title>Pricing | Alaventra</title>',
  '404.html': '<title>Page not found | Alaventra</title>',
  'platform/ai-visibility.html': '<title>AI visibility | Alaventra</title>',
  'llms.txt': '# Alaventra',
  'sitemap.xml': '<urlset><url><loc>https://www.alaventra.com/</loc></url></urlset>',
  'robots.txt': 'User-agent: *\nAllow: /\nSitemap: https://www.alaventra.com/sitemap.xml\n',
  '.well-known/security.txt': 'Contact: mailto:security@alaventra.com',
  'assets/index-abc.js': 'console.log(1)',
};
for (const [f, body] of Object.entries(PUBLIC_FILES)) {
  mkdirSync(join(dist, f, '..'), { recursive: true });
  writeFileSync(join(dist, f), body);
}

vi.hoisted(() => {
  process.env.APP_URL = 'https://app.alaventra.test';
  process.env.PORTAL_STRICT_HOSTS = 'false';
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.PORTAL_JOBS = 'false';
  process.env.CRAWLER_JOBS = 'false';
  process.env.LOG_LEVEL = 'silent';
});
vi.mock('../src/db', async () => (await import('./helpers/pg')).pgDbModule());

const { config } = await import('../src/config');
(config as { webDist: string }).webDist = dist;
const { buildApp, HSTS_MAX_AGE, PERMISSIONS_POLICY } = await import('../src/app');
const { appShellFile, portalRefusesPublicFile, PORTAL_ROBOTS_TXT } = await import('../src/services/portalShell');
const { invalidatePortalHosts } = await import('../src/services/portalHosts');
const { db, schema } = await import('../src/db');

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
  rmSync(dist, { recursive: true, force: true });
});

const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
const webHeader = (key: string) => vercel.headers.find((h) => h.source === '/(.*)')!.headers.find((h) => h.key === key)!.value;

describe('security headers (M1)', () => {
  it('the API sends the same HSTS and Permissions-Policy as the web pages', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/health' });
    expect(HSTS_MAX_AGE).toBe(63072000);
    expect(r.headers['strict-transport-security']).toBe('max-age=63072000; includeSubDomains');
    expect(r.headers['strict-transport-security']).toBe(webHeader('Strict-Transport-Security'));
    expect(r.headers['permissions-policy']).toBe(PERMISSIONS_POLICY);
    expect(PERMISSIONS_POLICY).toBe(webHeader('Permissions-Policy'));
  });
  it('errors carry them too', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/does-not-exist' });
    expect(r.statusCode).toBe(404);
    expect(r.headers['permissions-policy']).toBe(PERMISSIONS_POLICY);
  });
});

describe('the app shell in a prerendered web build (C2)', () => {
  it('picks app.html when the build has it, index.html in an older build', () => {
    expect(appShellFile(dist)).toBe('app.html');
    const old = mkdtempSync(join(tmpdir(), 'web-old-'));
    writeFileSync(join(old, 'index.html'), SHELL);
    expect(appShellFile(old)).toBe('index.html');
    rmSync(old, { recursive: true, force: true });
  });
  it('serves the plain shell for "/" and for app routes, never the prerendered home', async () => {
    for (const url of ['/', '/o/abc/sites/def/overview', '/login']) {
      const r = await app.inject({ method: 'GET', url });
      expect(r.statusCode, url).toBe(200);
      expect(r.body, url).toContain('<div id="root"></div>');
      expect(r.body, url).not.toContain('Marketing home');
    }
  });
});

// R4 L1 (2026-11-18): a portal host is proxied whole to this server, which serves the web build at its own paths. Since CR17 that
// build is also our public website: on a portal host none of it may answer (WHITE_LABEL.md §2), and robots.txt is the portal's own.
describe('a portal host serves none of our public website (R4 L1)', () => {
  const PORTAL = 'seo.webshell-agency.test';
  const on = { host: PORTAL };
  beforeAll(async () => {
    const [org] = await db.insert(schema.organizations).values({ name: 'Webshell Agency', slug: `webshell-${Date.now()}`, hookToken: `tok-ws-${Date.now()}`, monthlyBudgetUsd: 25 }).returning();
    await db.insert(schema.portalDomains).values({ orgId: org.id, host: PORTAL, token: 't', status: 'verified', verifiedAt: new Date() });
    invalidatePortalHosts();
  });

  it('the rule: our pages, llms.txt, sitemaps, robots.txt and security.txt in any spelling; never the shell, app routes or the bundle', () => {
    for (const u of ['/pricing.html', '/PRICING.HTML', '/platform/x.html?a=1', '/app.html', '/404.html', '/pricing%2Ehtml', '/llms.txt', '/llms-full.txt', '/sitemap.xml', '/sitemap-0.xml', '/robots.txt', '/.well-known/security.txt', '/llms.txt/', '/%E0%A4%A'])
      expect(portalRefusesPublicFile(u), u).toBe(true);
    for (const u of ['/', '/o/x/sites/y/overview', '/login', '/assets/index-abc.js', '/theme-init.js', '/pricing', '/share/t?x=.html'])
      expect(portalRefusesPublicFile(u), u).toBe(false);
  });

  it('answers 404 for our public files on the portal host, its own robots.txt, and still serves the portal shell and the bundle', async () => {
    for (const f of Object.keys(PUBLIC_FILES).filter((f) => f !== 'robots.txt' && !f.startsWith('assets/'))) {
      const r = await app.inject({ method: 'GET', url: `/${f}`, headers: on });
      expect(r.statusCode, f).toBe(404);
      expect(r.body, f).not.toMatch(/alaventra/i);
    }
    const robots = await app.inject({ method: 'GET', url: '/robots.txt', headers: on });
    expect(robots.statusCode).toBe(200);
    expect(robots.body).toBe(PORTAL_ROBOTS_TXT);
    expect(robots.body).not.toMatch(/alaventra|sitemap/i);
    for (const url of ['/', '/o/abc/sites/def/overview']) {
      const r = await app.inject({ method: 'GET', url, headers: on });
      expect(r.statusCode, url).toBe(200);
      expect(r.body, url).toContain('<meta name="portal-host" content="1" />');
      expect(r.body, url).not.toMatch(/alaventra|Marketing home/i);
    }
    expect((await app.inject({ method: 'GET', url: '/assets/index-abc.js', headers: on })).statusCode).toBe(200);
  });

  it('our own hosts keep serving the files as before', async () => {
    // (.well-known/ is a dot folder the static plugin never served here; the web host serves it)
    for (const f of ['pricing.html', 'llms.txt', 'sitemap.xml', 'robots.txt']) {
      const r = await app.inject({ method: 'GET', url: `/${f}` });
      expect(r.statusCode, f).toBe(200);
      expect(r.body, f).toBe(PUBLIC_FILES[f]);
    }
  });
});
