import { afterEach, describe, expect, it, vi } from 'vitest';
import middleware, { csp } from '../../middleware';

// deploy/gcp — the Vercel Routing Middleware in front of the static build: the page's CSP names the API origin (direct uploads), and
// a proxied request carries the shared secret the API host's Caddy checks before it believes X-Real-IP / X-Forwarded-Host.

afterEach(() => vi.unstubAllEnvs());
const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers: { host: new URL(url).host, ...headers } });
const fwd = (r: Response, name: string) => r.headers.get('x-middleware-request-' + name);

describe('the page CSP', () => {
  it('lets scripts talk to the API origin and nothing else besides this site', () => {
    expect(csp('https://api.alaventra.com')).toContain("connect-src 'self' https://api.alaventra.com");
    expect(csp('')).toMatch(/connect-src 'self'$/);
    for (const bad of ['http://api.alaventra.com', 'https://api.alaventra.com/x', "https://a.com; script-src *", 'javascript:alert(1)'])
      expect(csp(bad), bad).toMatch(/connect-src 'self'$/);
  });
  it('is sent on the pages (the static build), with the API origin from API_ORIGIN', () => {
    vi.stubEnv('API_ORIGIN', 'https://api.alaventra.com/');
    const r = middleware(req('https://app.alaventra.com/o/1/sites'));
    expect(r.headers.get('content-security-policy')).toContain("connect-src 'self' https://api.alaventra.com");
    expect(r.headers.get('x-middleware-next')).toBe('1');
  });
});

describe('/api through the proxy', () => {
  it('forwards to API_ORIGIN with the origin secret and our host', () => {
    vi.stubEnv('API_ORIGIN', 'https://api.alaventra.com');
    vi.stubEnv('ORIGIN_SECRET', 's3cret');
    const r = middleware(req('https://app.alaventra.com/api/me?x=1'));
    expect(r.headers.get('x-middleware-rewrite')).toBe('https://api.alaventra.com/api/me?x=1');
    expect(fwd(r, 'x-origin-secret')).toBe('s3cret');
    expect(fwd(r, 'x-forwarded-host')).toBe('app.alaventra.com');
  });
  it("overwrites a visitor's own X-Origin-Secret, and drops it when no secret is configured", () => {
    vi.stubEnv('API_ORIGIN', 'https://api.alaventra.com');
    vi.stubEnv('ORIGIN_SECRET', 's3cret');
    expect(fwd(middleware(req('https://app.alaventra.com/api/me', { 'x-origin-secret': 'guess' })), 'x-origin-secret')).toBe('s3cret');
    vi.stubEnv('ORIGIN_SECRET', '');
    const r = middleware(req('https://app.alaventra.com/api/me', { 'x-origin-secret': 'guess' }));
    expect(fwd(r, 'x-origin-secret')).toBeNull();
    expect(String(r.headers.get('x-middleware-override-headers') ?? '')).not.toContain('x-origin-secret');
  });
  it('answers 503 without an API origin', () => {
    vi.stubEnv('API_ORIGIN', '');
    expect(middleware(req('https://app.alaventra.com/api/me')).status).toBe(503);
  });
});
