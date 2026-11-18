import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { RouteObject } from 'react-router';
import { marketingPages, routes } from '@/routes';
import { ROBOTS_DISALLOW } from '@/marketing/seo/files';
import { sitePages, STATIC_PATHS } from '@/marketing/seo/paths';
import { features } from '@/marketing/content/features';
import { solutions } from '@/marketing/content/solutions';
import { tutorials } from '@/marketing/content/tutorials';

// C2 (client report 2026-11-17): app/vercel.json no longer turns every address into the app shell. Each public page is a prerendered
// file, the app's own paths are rewritten to the app shell, and everything else is a real 404. This test keeps the three in step with
// the route table: a new app route without a rewrite would 404 in production, a new public page without a prerendered file would too.

interface Rewrite {
  source: string;
  destination: string;
}
const vercel = JSON.parse(readFileSync(fileURLToPath(new URL('../../vercel.json', import.meta.url)), 'utf8')) as { cleanUrls: boolean; trailingSlash: boolean; rewrites: Rewrite[] };

/** Vercel's path syntax for the forms used in vercel.json: `/x/:path*` (the prefix and anything under it), `/x/:id`, plain paths */
const sourceRe = (src: string) => new RegExp(`^${src.replace(/\/:[a-z]+\*/gi, '(?:/.*)?').replace(/:[a-z]+/gi, '[^/]+')}$`);
const rewriteFor = (path: string) => vercel.rewrites.find((r) => sourceRe(r.source).test(path));

/** every absolute path in the route table (children with relative paths live under their parent's) */
function absolutePaths(list: RouteObject[], out: string[] = []): string[] {
  for (const r of list) {
    if (r.path?.startsWith('/')) out.push(r.path);
    if (r.children) absolutePaths(r.children, out);
  }
  return out;
}
/** a concrete address for a route pattern: `/o/:orgId` -> `/o/x`, optional segments dropped */
const concrete = (p: string) => p.replace(/\/:[a-z]+\?/gi, '').replace(/:[a-z]+/gi, 'x');

const marketing = new Set(['/', ...marketingPages.map((r) => r.path!)]);
const appPaths = absolutePaths(routes).filter((p) => !marketing.has(p));

describe('route coverage (app/vercel.json, prerendered pages, route table)', () => {
  it('serves files without .html, with no catch-all rewrite left', () => {
    expect(vercel.cleanUrls).toBe(true);
    expect(vercel.rewrites.some((r) => /\(\.\*\)|index\.html/.test(r.source + r.destination))).toBe(false);
    // cleanUrls serves dist/app.html at /app (Vercel's Build Output `overrides`: {"app.html": {"path": "app"}}); a rewrite to
    // /app.html has `check: true`, misses the filesystem and falls to the 404 page (review R4 H1, 2026-11-18)
    for (const r of vercel.rewrites) expect(r.destination, r.source).toBe('/app');
  });

  it('marks the HTML entry points no-cache at the addresses visitors really request under cleanUrls', () => {
    const rules = (vercel as unknown as { headers: { source: string; headers: { key: string; value: string }[] }[] }).headers;
    const noCache = rules.filter((h) => h.headers.some((x) => x.key === 'Cache-Control' && x.value === 'no-cache')).map((h) => sourceRe(h.source));
    for (const p of ['/', '/app', '/theme-init.js', '/site.webmanifest']) expect(noCache.some((re) => re.test(p)), p).toBe(true);
    for (const p of ['/assets/index-abc.js', '/pricing']) expect(noCache.some((re) => re.test(p)), p).toBe(false);
  });

  it('every app route reaches the app shell, including deep links', () => {
    expect(appPaths.length).toBeGreaterThan(10);
    for (const p of appPaths) expect(rewriteFor(concrete(p)), p).toBeTruthy();
    for (const deep of ['/o/x/sites/y/overview', '/o/x/settings/team', '/admin/companies/x', '/login/mfa', '/onboarding/x/website', '/share/tok', '/invite/tok'])
      expect(rewriteFor(deep), deep).toBeTruthy();
  });

  it('every app route is kept out of search engines', () => {
    for (const p of appPaths) expect(ROBOTS_DISALLOW.some((d) => concrete(p).startsWith(d.replace(/\/$/, ''))), p).toBe(true);
  });

  it('every public route has a prerendered page, and no public page is shadowed by an app rewrite', () => {
    const pages = new Set(sitePages().map((p) => p.path));
    for (const p of marketing) {
      if (p.includes(':')) continue;
      expect(STATIC_PATHS as readonly string[], p).toContain(p);
      expect(pages.has(p), p).toBe(true);
    }
    for (const f of features) expect(pages.has(`/platform/${f.slug}`)).toBe(true);
    for (const s of solutions) expect(pages.has(`/solutions/${s.slug}`)).toBe(true);
    for (const t of tutorials) expect(pages.has(`/tutorials/${t.slug}`)).toBe(true);
    // the reverse: no listed page without a route
    for (const p of STATIC_PATHS) expect(marketing.has(p), p).toBe(true);
    for (const p of pages) expect(rewriteFor(p), p).toBeUndefined();
  });

  it('unknown addresses match nothing, so they get the real 404 page', () => {
    for (const p of ['/llms', '/does-not-exist-xyz', '/wp-admin', '/platform/x/y', '/.env']) expect(rewriteFor(p), p).toBeUndefined();
  });
});
