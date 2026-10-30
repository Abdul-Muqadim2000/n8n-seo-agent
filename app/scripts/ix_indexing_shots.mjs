// Index coverage browser pass (2026-10-29): the built web app served from /dist, every /api call answered from sample fixtures (no real
// customer), the Indexing page at 1440 and 375, light and dark, with and without a Google update rolling out. Nothing is sent anywhere:
// non-GET requests are refused. Records console errors, horizontal overflow and the h1.
//   docker run --rm -v "$PWD/app/web/dist":/dist -v <out>:/out -v <fixtures>:/fx -v "$PWD/app/scripts":/s -w /s \
//     mcr.microsoft.com/playwright:v1.55.0-noble node /s/ix_indexing_shots.mjs [final]
// `final` (the final browser check, 2026-10-30): every fixture of ix_indexing_fixture.ts (with `final` and `reserve`), the index_coverage
// report (normal and failed), the Pipeline's Steps on your website and the Recommendations, each at 1440 and 375, light and dark, with
// screenshots named `*-final.png`; per view it also records failed requests, unlabelled buttons and links, low-contrast text, cut-off text
// and customer wording the owner's copy rule forbids.
// `wave2` (2026-10-30, DESIGN_WAVE2 §3): the fixtures of `ix_indexing_fixture.ts <out> wave2|wave2-restricted`: the Indexing page (already
// linked pages waiting for Google, the links step, the canonical pages outside the sitemap, policy pages, "I asked Google", the sitemap card
// with Full and read-only access), the Pipeline's Steps on your website, the Recommendations and Website settings > Tracking & monitors (the
// sitemap switch and Google's access), each at 1440 and 375, light and dark, screenshots `*-wave2.png`, with the same audit as `final`.
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
  if (WAVE2) {
    if (p.endsWith('/data/pipeline')) return json(route, pipeline(`${W2}-tasks.json`));
    if (p.endsWith('/recommendations')) return json(route, readFx(`${W2}-recs.json`));
    if (p.endsWith('/tasks')) return json(route, { tasks: readFx(`${W2}-tasks.json`) });
    if (p.endsWith('/data/settings')) return json(route, readFx(`${W2}-settings.json`));
  }
  if (FINAL) {
    if (p.endsWith('/data/pipeline')) return json(route, pipeline());
    if (p.endsWith('/recommendations')) return json(route, readFx('indexing-final-recs.json'));
    if (p.endsWith('/tasks')) return json(route, { tasks: readFx('indexing-final-tasks.json') });
    if (p.endsWith('/00000000-0000-0000-0000-00000000c001')) return json(route, readFx('indexing-final-report.json'));
    if (p.endsWith('/00000000-0000-0000-0000-00000000c002')) return json(route, readFx('indexing-final-report-failed.json'));
  }
  for (const [re, body] of EMPTY) if (re.test(p)) return json(route, body);
  unknown.add(p);
  return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not in the fixtures"}' });
}

const FINAL = process.argv[2] === 'final';
// wave 2 review (W1 / W7): `w2review` takes the fixtures `wave2-will`, `wave2-blocked`, `wave2-refused` (and the read-only one) of
// ix_indexing_fixture.ts: the sitemap card, the Steps on your website and Tracking & monitors, screenshots `*-w2review-*.png`
const W2REVIEW = process.argv[2] === 'w2review';
const WAVE2 = process.argv[2] === 'wave2' || W2REVIEW;
let W2 = 'indexing-wave2';
const readFx = (f) => JSON.parse(readFileSync(join(FX, f), 'utf8'));
// small answers for the other reads of the Pipeline, Recommendations and report pages (nothing about indexing)
const EMPTY = [
  [/\/reports\/[^/]+\/(delivery|share|shares|feedback|review|cms)$/, {}],
  [/\/tickets?(\/states)?$/, []],
  [/\/keyword-proposals$|\/proposals$/, { items: [] }],
  [/\/cycle$/, null],
  [/\/credits$|\/usage$/, {}],
  [/^\/api\/portal\/context$/, null],
  [/\/billing$/, { enforced: false, balance: 5000, held: 0, reservedForAutopilot: 0, available: 5000, onDemandAvailable: 5000, status: 'ok', dailyBurn: 4, runwayDays: null, runsOutOn: null, month: { month: '2026-10', autopilotUsed: 40, onDemandUsed: 0, autopilotForecast: 120, planMonthly: null, planRenewsOn: null }, limits: {}, sites: [], byFeature: [], daily: [], lots: [], expiringSoon: null, packs: [], requests: [], invoices: [], creditValueUsd: 0.05, packExpiryMonths: 12, planRolloverMonths: 0, checkout: 'request' }],
  [/\/data\/settings$/, { tracking: {}, monitors: null, cadence: { pagesPerWeek: 1, status: 'active' }, profile: null, readiness: {}, contentGroups: [] }],
  [/\/consistency$/, { warnings: [], acknowledged: [] }],
  [/\/issues$/, { items: [], trackers: [] }],
  [/\/coming-up$/, { available: false, cycleKey: '', cycleDate: '', scheduledFor: null, receivedAt: null, level: 2, pagesPerWeek: 1, waitingForKeyword: false, pausedReason: '', reason: '', items: [], suggestions: [] }],
];
function pipeline(file = 'indexing-final-tasks.json') {
  const tasks = readFx(file);
  return {
    timezone: 'America/New_York',
    tracking: { status: 'active', verified: true, reportsToThisApp: true, engineEmails: false },
    stages: [], automations: [],
    queue: { pagesPerWeek: 1, next: [], later: [], waiting: [], suggestions: [], paused: null, engineUpcoming: [], engineUpcomingAt: null },
    calendar: [], activity: [], monthlyCredits: 120, running: [], activeRuns: [], written: [], ladders: [], ladderCards: [],
    needsYou: tasks.filter((t) => t.state === 'todo').map((t) => ({ id: `task:${t.key}`, kind: 'site_task', severity: t.severity, title: t.title, detail: t.detail, action: { label: 'Open the step', page: 'pipeline' }, guideVars: t.guideVars })),
    thisWeek: [], summary: { publishedThisMonth: 0, top10: 0, clicks28d: 0, creditsUsedThisMonth: 0 },
    automation: { autopilotLevel: 2, defaultMode: 'auto', opportunities: 'auto', autoStartLadders: false, maxActiveLadders: 2, maxWaiting: 3 },
    detected: [], autoStartEnabled: false,
    autopilot: { level: 2, waitingForKeyword: false, reason: '', suggestions: [], refused: [], dropped: null, notChosen: [] },
    readiness: { ready: true, profileReady: true, factsReady: true, missing: [], missingText: '' },
    siteTasks: tasks,
  };
}

// what one view shows that the owner's rules forbid, read from the rendered page
async function audit(page) {
  return page.evaluate(() => {
    const out = { contrast: [], unlabelled: [], clipped: [], words: [] };
    const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length >= 3 && (c.length < 4 || c[3] > 0.5)) return c; } return [255, 255, 255]; };
    const visible = (el) => { const r = el.getBoundingClientRect(); const st = getComputedStyle(el); return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none' && Number(st.opacity) > 0.3; };
    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el)) continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
      if (own) {
        const st = getComputedStyle(el);
        const fg = rgb(st.color); const bg = bgOf(el);
        const a = fg[3] ?? 1; const mix = fg.slice(0, 3).map((v, i) => v * a + bg[i] * (1 - a));
        const L1 = lum(mix), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        const big = parseFloat(st.fontSize) >= 24 || (parseFloat(st.fontSize) >= 18.66 && Number(st.fontWeight) >= 700);
        if (ratio < (big ? 3 : 4.5) && !el.closest('[aria-hidden="true"],svg,button[disabled]')) out.contrast.push(`${ratio.toFixed(2)} "${own.slice(0, 50)}"`);
        if ((st.overflow === 'hidden' || st.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 2 && !el.title) out.clipped.push(`"${own.slice(0, 60)}"`);
      }
      if (el.matches('button,a[href],[role="button"],[role="tab"],[role="link"]')) {
        const name = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim() || (el.getAttribute('aria-labelledby') ? 'x' : '');
        if (!name) out.unlabelled.push(el.outerHTML.slice(0, 120));
      }
    }
    const text = document.body.innerText;
    const rules = [[/\u2014/, 'em dash'], [/[\u2018\u2019\u201c\u201d]/, 'curly quote'], [/\u2026|\.\.\./, 'ellipsis'], [/\bwe submit\b/i, 'we submit'], [/\bwe ask Google\b/i, 'we ask Google'], [/\bwe change your site\b/i, 'we change your site'],
      [/\bwill be indexed\b|\bguarantee/i, 'indexing promise'], [/\b(engine|n8n|data table)\b/i, 'internal name'], [/\b[a-z]+_[a-z_]+\b/, 'raw code'], [/\bundefined\b|\bNaN\b|\[object|\bnull\b/, 'broken value']];
    for (const [re, what] of rules) { const m = text.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')); if (m) out.words.push(`${what}: ${[...new Set(m)].slice(0, 5).join(' | ')}`); }
    return out;
  });
}

const browser = await chromium.launch();
const errs = [];
const report = [];
const findings = [];
// fix wave 1: `-fixwave` (fixed on site, ask Google, partial sitemap, a newest run that could not read Search Console, an update rolling
// out) at every size and theme; `-failed` (no run could read Search Console yet) at 1440 light and 375 dark
if (!FINAL && !WAVE2) for (const [fx, tag] of [['indexing.json', ''], ['indexing-rolling.json', '-rolling'], ['indexing-fixwave.json', '-fixwave'], ['indexing-failed.json', '-failed']])
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
if (FINAL) {
  const SIZES = { desktop: { width: 1440, height: 900 }, phone: { width: 375, height: 812 } };
  const views = [
    ...[['indexing.json', 'base'], ['indexing-rolling.json', 'rolling'], ['indexing-fixwave.json', 'fixwave'], ['indexing-failed.json', 'failed'], ['indexing-final.json', 'waves'], ['indexing-reserve.json', 'reserve']].map(([fx, name]) => ({ name: `indexing-${name}`, fx, url: `/o/${ORG}/sites/${SITE}/indexing` })),
    { name: 'report', fx: 'indexing-final.json', url: `/o/${ORG}/reports/00000000-0000-0000-0000-00000000c001` },
    { name: 'report-failed', fx: 'indexing-final.json', url: `/o/${ORG}/reports/00000000-0000-0000-0000-00000000c002` },
    { name: 'steps', fx: 'indexing-final.json', url: `/o/${ORG}/sites/${SITE}/pipeline#site-tasks`, el: '#site-tasks' },
    { name: 'recommendations', fx: 'indexing-final.json', url: `/o/${ORG}/sites/${SITE}/recommendations` },
  ];
  for (const v of views)
    for (const [size, vp] of Object.entries(SIZES))
      for (const theme of ['light', 'dark']) {
        const tag = `${v.name} ${size}/${theme}`;
        fixture = v.fx;
        const ctx = await browser.newContext({ viewport: vp, colorScheme: theme, reducedMotion: 'reduce' });
        await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
        const page = await ctx.newPage();
        page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(`${tag}: ${m.text().slice(0, 160)}`); });
        page.on('pageerror', (e) => errs.push(`${tag} pageerror: ${String(e).slice(0, 200)}`));
        page.on('requestfailed', (r) => errs.push(`${tag} request failed: ${r.url().slice(0, 120)}`));
        page.on('response', (r) => { if (r.status() >= 400 && !(r.status() === 403 && r.request().method() !== 'GET')) errs.push(`${tag} HTTP ${r.status()} ${r.request().method()} ${r.url().replace('http://localhost:5180', '').slice(0, 120)}`); });
        await page.route('**/api/**', api);
        await page.goto(`http://localhost:5180${v.url}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(900);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        const h1 = await page.evaluate(() => [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()).join(' / '));
        const a = await audit(page);
        const file = `${OUT}/${v.name}-${size}-${theme}-final.png`;
        if (v.el && (await page.locator(v.el).count())) await page.locator(v.el).screenshot({ path: file });
        else await page.screenshot({ path: file, fullPage: true });
        report.push(`${tag}: overflow ${overflow}px, h1 "${h1}"`);
        for (const [k, xs] of Object.entries(a)) if (xs.length) findings.push(`${tag} ${k}: ${[...new Set(xs)].slice(0, 6).join(' ; ')}`);
        if (v.name === 'indexing-waves' && size === 'desktop' && theme === 'light') {
          // the page Google still sees with the problem: its details
          const row = page.locator('li', { hasText: '/pricing' }).first();
          const det = row.getByRole('button', { name: 'Details and history' }).first();
          if (await det.count()) {
            await det.click();
            await page.waitForTimeout(400);
            await row.scrollIntoViewIfNeeded();
            await row.screenshot({ path: `${OUT}/indexing-waves-details-desktop-light-final.png` });
          }
        }
        await ctx.close();
      }
}
if (WAVE2) {
  const SIZES = { desktop: { width: 1440, height: 900 }, phone: { width: 375, height: 812 } };
  const TRACK = 'text=Let Alaventra submit your sitemap to Google';
  const views = W2REVIEW ? ['will', 'blocked', 'refused', 'restricted'].flatMap((x) => [
    { name: `indexing-w2review-${x}`, w2: `indexing-wave2-${x}`, url: `/o/${ORG}/sites/${SITE}/indexing`, el: 'text=Your sitemap in Search Console' },
    ...(x === 'will' ? [] : [{ name: `steps-w2review-${x}`, w2: `indexing-wave2-${x}`, url: `/o/${ORG}/sites/${SITE}/pipeline#site-tasks`, el: '#site-tasks' }]),
    { name: `tracking-w2review-${x}`, w2: `indexing-wave2-${x}`, url: `/o/${ORG}/sites/${SITE}/settings/tracking`, el: TRACK },
  ]) : [
    { name: 'indexing-wave2', w2: 'indexing-wave2', url: `/o/${ORG}/sites/${SITE}/indexing` },
    { name: 'indexing-wave2-restricted', w2: 'indexing-wave2-restricted', url: `/o/${ORG}/sites/${SITE}/indexing` },
    { name: 'steps-wave2', w2: 'indexing-wave2', url: `/o/${ORG}/sites/${SITE}/pipeline#site-tasks`, el: '#site-tasks' },
    { name: 'recommendations-wave2', w2: 'indexing-wave2', url: `/o/${ORG}/sites/${SITE}/recommendations` },
    { name: 'tracking-wave2', w2: 'indexing-wave2', url: `/o/${ORG}/sites/${SITE}/settings/tracking`, el: 'text=Let Alaventra submit your sitemap to Google' },
    { name: 'tracking-wave2-restricted', w2: 'indexing-wave2-restricted', url: `/o/${ORG}/sites/${SITE}/settings/tracking`, el: 'text=Let Alaventra submit your sitemap to Google' },
  ];
  for (const v of views)
    for (const [size, vp] of Object.entries(SIZES))
      for (const theme of ['light', 'dark']) {
        const tag = `${v.name} ${size}/${theme}`;
        W2 = v.w2;
        fixture = `${v.w2}.json`;
        const ctx = await browser.newContext({ viewport: vp, colorScheme: theme, reducedMotion: 'reduce' });
        await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
        const page = await ctx.newPage();
        page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(`${tag}: ${m.text().slice(0, 160)}`); });
        page.on('pageerror', (e) => errs.push(`${tag} pageerror: ${String(e).slice(0, 200)}`));
        page.on('requestfailed', (r) => errs.push(`${tag} request failed: ${r.url().slice(0, 120)}`));
        page.on('response', (r) => { if (r.status() >= 400 && !(r.status() === 403 && r.request().method() !== 'GET')) errs.push(`${tag} HTTP ${r.status()} ${r.request().method()} ${r.url().replace('http://localhost:5180', '').slice(0, 120)}`); });
        await page.route('**/api/**', api);
        await page.goto(`http://localhost:5180${v.url}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(900);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        const h1 = await page.evaluate(() => [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()).join(' / '));
        const a = await audit(page);
        const file = `${OUT}/${v.name}-${size}-${theme}.png`;
        if (v.el === 'text=Your sitemap in Search Console') {
          // the sitemap card of the Indexing page
          const card = page.locator('text=Your sitemap in Search Console').first();
          if (await card.count()) {
            await card.scrollIntoViewIfNeeded();
            await page.screenshot({ path: file });
          } else {
            findings.push(`${tag}: no sitemap card`);
            await page.screenshot({ path: file, fullPage: true });
          }
        } else if (v.el?.startsWith('text=')) {
          // the Indexing row of Tracking & monitors: the fieldset around the switch
          const box = page.locator('fieldset', { hasText: v.el.slice(5) }).first();
          if (await box.count()) {
            const row = page.locator('label', { hasText: v.el.slice(5) }).first();
            await row.scrollIntoViewIfNeeded();
            await page.screenshot({ path: file });
          } else await page.screenshot({ path: file, fullPage: true });
        } else if (v.el && (await page.locator(v.el).count())) await page.locator(v.el).screenshot({ path: file });
        else await page.screenshot({ path: file, fullPage: true });
        report.push(`${tag}: overflow ${overflow}px, h1 "${h1}"`);
        for (const [k, xs] of Object.entries(a)) if (xs.length) findings.push(`${tag} ${k}: ${[...new Set(xs)].slice(0, 6).join(' ; ')}`);
        if (v.name === 'indexing-wave2' && size === 'desktop' && theme === 'light') {
          // the waiting group opened, and one page's details (linked from, Google's notes)
          const show = page.getByRole('button', { name: /Show the 8 pages/ }).first();
          if (await show.count()) {
            await show.click();
            await page.waitForTimeout(400);
            await show.scrollIntoViewIfNeeded().catch(() => undefined);
            const panel = page.locator('section,div', { hasText: 'Google has not visited these yet' }).last();
            await page.locator('text=Google has not visited these yet').first().scrollIntoViewIfNeeded();
            await page.screenshot({ path: `${OUT}/indexing-wave2-waiting-desktop-light.png` });
            void panel;
          }
        }
        await ctx.close();
      }
}
await browser.close();
srv.close();
console.log('findings:', findings.length ? '\n' + findings.join('\n') : 'none');
console.log(report.join('\n'));
console.log('unknown api paths:', [...unknown].join(' '));
console.log('console errors:', errs.length ? '\n' + [...new Set(errs)].join('\n') : 'none');
