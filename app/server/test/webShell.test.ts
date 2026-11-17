import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
const { appShellFile } = await import('../src/services/portalShell');

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
