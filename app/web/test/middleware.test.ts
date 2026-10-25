import { afterEach, describe, expect, it, vi } from 'vitest';
import middleware, { csp } from '../../middleware';

// deploy/gcp, the Vercel Routing Middleware in front of the static build: the page's CSP names the API origin (direct uploads), and
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
  it('allows the tutorial films from their own https origin as media, and nothing else', () => {
    expect(csp('', 'https://media.alaventra.com/tutorials/')).toContain("media-src 'self' https://media.alaventra.com;");
    expect(csp('https://api.alaventra.com', 'https://media.alaventra.com')).toMatch(/media-src 'self' https:\/\/media\.alaventra\.com; connect-src 'self' https:\/\/api\.alaventra\.com$/);
    for (const bad of ['', '/tutorials/video', 'http://media.alaventra.com', "https://a.com; script-src *", 'https://a.com x'])
      expect(csp('', bad), bad).not.toContain('media-src');
    vi.stubEnv('VITE_TUTORIALS_VIDEO_BASE', 'https://media.alaventra.com/tutorials');
    expect(middleware(req('https://alaventra.com/tutorials')).headers.get('content-security-policy')).toContain("media-src 'self' https://media.alaventra.com");
  });
  it("frames YouTube's player for the tutorial films, and nothing else changes: no YouTube script, no other frame host", () => {
    const p = csp('https://api.alaventra.com');
    expect(p).toContain("frame-src 'self' blob: https://www.youtube-nocookie.com https://www.youtube.com;");
    expect(p).toContain("script-src 'self';");
    expect(p).toContain("script-src-attr 'none';");
    expect(p).toContain("img-src 'self' data: https:;");
    expect(p).toContain("frame-ancestors 'self';");
    expect(p.match(/youtube/g)?.length).toBe(2);
    expect(p).toBe(
      "default-src 'self'; base-uri 'self'; font-src 'self' https: data:; form-action 'self'; frame-ancestors 'self'; img-src 'self' data: https:; " +
        "object-src 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; " +
        "frame-src 'self' blob: https://www.youtube-nocookie.com https://www.youtube.com; upgrade-insecure-requests; connect-src 'self' https://api.alaventra.com",
    );
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
  it("forwards only what the API reads: never Vercel's own x-vercel-* or hop-by-hop headers (2026-10-18: MIDDLEWARE_INVOCATION_FAILED)", () => {
    vi.stubEnv('API_ORIGIN', 'https://api.alaventra.com');
    vi.stubEnv('ORIGIN_SECRET', 's3cret');
    const r = middleware(req('https://app.alaventra.com/api/me', {
      cookie: 'sid=abc', 'x-requested-with': 'fetch', 'x-org-id': 'o1', 'x-real-ip': '203.0.113.7',
      'x-vercel-id': 'bom1::x', 'x-vercel-oidc-token': 'jwt', connection: 'keep-alive', 'x-forwarded-for': '203.0.113.7, 10.0.0.1',
    }));
    const over = String(r.headers.get('x-middleware-override-headers') ?? '').split(',');
    expect(fwd(r, 'cookie')).toBe('sid=abc');
    expect(fwd(r, 'x-requested-with')).toBe('fetch');
    expect(fwd(r, 'x-org-id')).toBe('o1');
    expect(fwd(r, 'x-real-ip')).toBe('203.0.113.7');
    for (const h of ['x-vercel-id', 'x-vercel-oidc-token', 'connection', 'host', 'x-forwarded-for']) expect(over, h).not.toContain(h);   // whole names
  });
  it('does not crash on a secret that is not a header value (a pasted masked placeholder)', () => {
    vi.stubEnv('API_ORIGIN', 'https://api.alaventra.com');
    vi.stubEnv('ORIGIN_SECRET', '\u2022\u2022\u2022\u2022');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = middleware(req('https://app.alaventra.com/api/health'));
    expect(r.headers.get('x-middleware-rewrite')).toBe('https://api.alaventra.com/api/health');
    expect(fwd(r, 'x-origin-secret')).toBeNull();
  });
  it('answers 503 without an API origin', () => {
    vi.stubEnv('API_ORIGIN', '');
    expect(middleware(req('https://app.alaventra.com/api/me')).status).toBe(503);
  });
});
