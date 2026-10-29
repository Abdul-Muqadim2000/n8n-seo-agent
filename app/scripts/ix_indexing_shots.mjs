// Index coverage browser pass (2026-10-29): the built web app served from /dist, every /api call answered from sample fixtures (no real
// customer), the Indexing page at 1440 and 375, light and dark, with and without a Google update rolling out. Nothing is sent anywhere:
// non-GET requests are refused. Records console errors, horizontal overflow and the h1.
//   docker run --rm -v "$PWD/app/web/dist":/dist -v <out>:/out -v <fixtures>:/fx -v "$PWD/app/scripts":/s -w /s \
//     mcr.microsoft.com/playwright:v1.55.0-noble node /s/ix_indexing_shots.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const DIST = '/dist', OUT = '/out', FX = '/fx';
mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.webp': 'image/webp', '.ico': 'image/x-icon' };
const srv = http.createServer((req, res) => {
  const p = join(DIST, decodeURIComponent(req.url.split('?')[0]));
  const f = existsSync(p) && extname(p) ? p : join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => srv.listen(5180, r));

const ORG = '00000000-0000-0000-0000-0000000000a1', SITE = '00000000-0000-0000-0000-0000000000b2', D = 'novaand-demo.com';
const now = '2026-10-29T07:00:00.000Z';
const user = { id: 'u1', email: 'owner@novaand-demo.com', name: 'Sample Owner', avatarUrl: null, emailVerified: true, hasPassword: true, googleLinked: false, createdAt: now, mfaEnabled: false };
const me = { user, orgs: [{ id: ORG, name: 'Sample Co', slug: 'sample', role: 'owner', onboardingStep: 'done', onboardedAt: now, kind: 'standard' }], platformAdmin: false };
const org = { id: ORG, name: 'Sample Co', slug: 'sample', industry: '', size: '', website: D, monthlyBudgetUsd: 0, disabled: false, onboardingStep: 'done', onboardedAt: now, createdAt: now, role: 'owner', kind: 'standard', agency: null, brand: null, clientApproval: false };
const site = { id: SITE, orgId: ORG, domain: D, n8nSiteId: 'site_novaand-demo-com', country: 'AE', business: 'E-invoicing', customers: '', goal: 'leads', tone: '', cta: '', businessFacts: '', competitors: [], brandNames: [], keywords: [], ga4PropertyId: '', gscProperty: '', blogsPerWeek: 1, verifiedAt: now, verificationMethod: 'dns', trackingStatus: 'active', trackingStartedAt: now, createdAt: now, timezone: '', services: [], cycleWeekday: 1, autopilotLevel: 2 };
let fixture = 'indexing.json';
const history = { status: 'ok', history: [{ at: '2026-10-27T06:00:00Z', state: 'not_indexed', cause: 'noindex', label: 'Your page tells Google to leave it out', evidence: 'inspection', coverage: '' }, { at: '2026-09-01T06:00:00Z', state: 'indexed', cause: '', label: 'In Google search', evidence: 'search', coverage: '' }] };

const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
const unknown = new Set();
async function api(route) {
  const req = route.request();
  if (req.method() !== 'GET') return route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"read-only pass"}' });
  const u = new URL(req.url()), p = u.pathname;
  if (p === '/api/me') return json(route, me);
  if (p === '/api/auth/providers') return json(route, { google: false, emailPassword: true, email: false, engineEmails: false, requireEmailVerification: false });
  if (p === `/api/orgs/${ORG}`) return json(route, org);
  if (p === `/api/orgs/${ORG}/sites`) return json(route, [site]);
  if (p === `/api/orgs/${ORG}/sites/${SITE}`) return json(route, site);
  if (p.endsWith('/data/indexing')) return json(route, JSON.parse(readFileSync(join(FX, fixture), 'utf8')));
  if (p.endsWith('/data/indexing/history')) return json(route, history);
  if (p.endsWith('/data/indexing/pages')) return json(route, { status: 'ok', items: [], total: 0, page: 1, pageSize: 25 });
  unknown.add(p);
  return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not in the fixtures"}' });
}

const browser = await chromium.launch();
const errs = [];
const report = [];
// fix wave 1: `-fixwave` (fixed on site, ask Google, partial sitemap, a newest run that could not read Search Console, an update rolling
// out) at every size and theme; `-failed` (no run could read Search Console yet) at 1440 light and 375 dark
for (const [fx, tag] of [['indexing.json', ''], ['indexing-rolling.json', '-rolling'], ['indexing-fixwave.json', '-fixwave'], ['indexing-failed.json', '-failed']])
  for (const [size, vp] of Object.entries({ desktop: { width: 1440, height: 900 }, phone: { width: 375, height: 812 } }))
    for (const theme of ['light', 'dark']) {
      if (tag === '-rolling' && size === 'phone' && theme === 'dark') continue;
      if (tag === '-failed' && ((size === 'desktop' && theme === 'dark') || (size === 'phone' && theme === 'light'))) continue;
      if (!existsSync(join(FX, fx))) continue;
      fixture = fx;
      const ctx = await browser.newContext({ viewport: vp, colorScheme: theme, reducedMotion: 'reduce' });
      await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
      const page = await ctx.newPage();
      page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(`${size}/${theme}${tag}: ${m.text().slice(0, 160)}`); });
      page.on('pageerror', (e) => errs.push(`${size}/${theme}${tag} pageerror: ${String(e).slice(0, 200)}`));
      await page.route('**/api/**', api);
      await page.goto(`http://localhost:5180/o/${ORG}/sites/${SITE}/indexing`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const h1 = await page.evaluate(() => document.querySelector('h1')?.textContent ?? '');
      await page.screenshot({ path: `${OUT}/indexing-${size}-${theme}${tag}.png`, fullPage: true });
      report.push(`${size}/${theme}${tag}: overflow ${overflow}px, h1 "${h1}"`);
      if (!tag && size === 'desktop' && theme === 'light') {
        // open one page's details and its history, then the New pages tab
        const det = page.getByRole('button', { name: 'Details and history' }).first();
        if (await det.count()) {
          await det.click();
          await page.waitForTimeout(300);
          const hist = page.getByRole('button', { name: 'Show what changed over time' }).first();
          if (await hist.count()) await hist.click();
          await page.waitForTimeout(500);
          await det.scrollIntoViewIfNeeded();
          await page.screenshot({ path: `${OUT}/indexing-details-desktop-light.png` });
        }
        await page.getByRole('tab', { name: /New pages/ }).click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${OUT}/indexing-new-tab-desktop-light.png` });
      }
      await ctx.close();
    }
await browser.close();
srv.close();
console.log(report.join('\n'));
console.log('unknown api paths:', [...unknown].join(' '));
console.log('console errors:', errs.length ? '\n' + [...new Set(errs)].join('\n') : 'none');
