/**
 * B-R2 — the owner-session browser pass (FIX_PLAN §3.14: "no run has ever exercised the app UI").
 *
 * Drives the dev stack with a real browser as a new customer: sign-up, onboarding, the dashboards, a report, and the shared report
 * page. Every page is visited at 1440 and 375 px, in light and dark, and each visit records console errors, failed requests,
 * horizontal overflow, whether the page has an h1, and the text colours that fall under the WCAG AA contrast ratio.
 *
 * It never signs in as anybody who exists: it creates its own account, its own company and its own website, and its reports are
 * posted to the company's own callback hook — no run is started, so nothing reaches a paid step.
 *
 *   docker run --rm --network seo-platform-dev_default -v "$PWD/app":/app -v <scratch>:/state \
 *     -w /state mcr.microsoft.com/playwright:v1.55.0-noble node /app/scripts/browser_pass.mjs <phase1|phase2>
 *
 * Between the phases the caller marks the website verified in the dev database and posts the callbacks (a domain nobody owns cannot
 * be verified for real); `BROWSER_PASS.md` records exactly what was prepared that way.
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://web:5173';
const OUT = process.env.OUT_DIR || '/app/docs/browser-pass';
const STATE = process.env.STATE_FILE || '/state/browser-pass.json';
const phase = process.argv[2] || 'phase1';

const SIZES = { desktop: { width: 1440, height: 900 }, phone: { width: 375, height: 812 } };
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><rect width="120" height="40" rx="6" fill="#0b4fd1"/><text x="60" y="26" font-family="Helvetica,Arial" font-size="17" font-weight="bold" fill="#fff" text-anchor="middle">NORTHWIND</text></svg>`;

const results = [];
const read = () => JSON.parse(readFileSync(STATE, 'utf8'));
const save = (o) => writeFileSync(STATE, JSON.stringify({ ...(tryRead() ?? {}), ...o }, null, 2));
const tryRead = () => { try { return read(); } catch { return null; } };

mkdirSync(OUT, { recursive: true });

/** Text colours on a page that fall under WCAG AA (4.5:1, or 3:1 for large text). Returns the worst offenders, not every node. */
const CONTRAST = `() => {
  const lum = (c) => { const [r,g,b] = c.map(v => { v/=255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }); return 0.2126*r + 0.7152*g + 0.0722*b; };
  const rgb = (s) => { const m = String(s).match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { c: p.slice(0,3), a: p.length > 3 ? p[3] : 1 }; };
  const bgOf = (el) => { let n = el; while (n && n !== document.documentElement) { const v = rgb(getComputedStyle(n).backgroundColor); if (v && v.a > 0.9) return v.c; n = n.parentElement; } const b = rgb(getComputedStyle(document.body).backgroundColor); return b ? b.c : [255,255,255]; };
  const out = [];
  for (const el of document.querySelectorAll('p,span,a,h1,h2,h3,h4,dt,dd,li,label,button,td,th,div')) {
    if (!el.firstChild || el.firstChild.nodeType !== 3 || !el.textContent.trim()) continue;
    const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue;
    const st = getComputedStyle(el); if (st.visibility === 'hidden' || st.opacity === '0') continue;
    const fg = rgb(st.color); if (!fg || fg.a < 0.9) continue;
    const bg = bgOf(el);
    const l1 = lum(fg.c), l2 = lum(bg);
    const ratio = (Math.max(l1,l2) + 0.05) / (Math.min(l1,l2) + 0.05);
    const size = parseFloat(st.fontSize), bold = Number(st.fontWeight) >= 700;
    const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
    if (ratio + 0.05 < need) out.push({ text: el.textContent.trim().slice(0, 40), ratio: Math.round(ratio * 100) / 100, need, color: st.color, size });
  }
  return out.sort((a, b) => a.ratio - b.ratio).slice(0, 6);
}`;

/** One visit: go there, wait for it to settle, record what went wrong, shoot it. */
/** Vite re-optimises its dependency cache on first load and aborts the in-flight module requests: a dev-server artefact, not the app. */
const DEV_NOISE = ['/node_modules/.vite/deps/'];

async function visit(page, { name, path, size, theme, expectFailed = [], expectConsole = [], shot = true, before, after }) {
  expectFailed = [...expectFailed, ...DEV_NOISE];
  const errors = [], failed = [];
  const onConsole = (m) => { if (m.type() === 'error' && !expectConsole.some((e) => m.text().includes(e))) errors.push(m.text().slice(0, 200)); };
  const onFailed = (r) => { const u = r.url(); if (!expectFailed.some((e) => u.includes(e))) failed.push(u.slice(0, 160) + ' — ' + (r.failure()?.errorText ?? '')); };
  const onResponse = (r) => { if (r.status() >= 400 && !expectFailed.some((e) => r.url().includes(e))) failed.push(r.url().slice(0, 160) + ' — HTTP ' + r.status()); };
  page.on('console', onConsole); page.on('requestfailed', onFailed); page.on('response', onResponse);
  if (before) await before(page);
  if (path) await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(400);
  if (after) await after(page);
  await page.waitForTimeout(200);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const h1 = await page.locator('h1').count();
  const contrast = await page.evaluate(`(${CONTRAST})()`);
  const file = `${name}-${size}-${theme}.png`;
  if (shot) await page.screenshot({ path: `${OUT}/${file}`, fullPage: true });
  page.off('console', onConsole); page.off('requestfailed', onFailed); page.off('response', onResponse);
  // a share URL carries a working token: the recorded evidence keeps the path, never the secret in it
  const row = { name, size, theme, url: page.url().replace(BASE, '').replace(/\/share\/[A-Za-z0-9_-]+/, '/share/<token hidden>'), consoleErrors: errors, failedRequests: failed, overflowPx: Math.max(0, overflow), h1, contrast, shot: shot ? file : null };
  results.push(row);
  const bad = errors.length || failed.length || overflow > 1 || !h1 || contrast.length;
  console.log(`${bad ? 'CHECK' : 'ok   '} ${name} ${size}/${theme}${bad ? ' ' + JSON.stringify({ errors, failed, overflow, h1, contrast: contrast.map((c) => c.ratio) }) : ''}`);
  return row;
}

const ctx = async (browser, size, theme, storageState) =>
  browser.newContext({ viewport: SIZES[size], colorScheme: theme, storageState, deviceScaleFactor: 1, baseURL: BASE });

/** The logo the stub profile points at is served here, so the pass does not depend on the internet. */
const routeLogo = async (page) => page.route('**/northwind-logo.png', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: LOGO_SVG }));

async function phase1() {
  const tag = Math.random().toString(36).slice(2, 8);
  // the domain must be the one the stub n8n holds a business profile for, so the shared report's brand is read from a real row;
  // a repeat pass needs a fresh one, because the first pass verified this one and a verified domain belongs to one company only
  const account = { name: 'Pass Owner', email: `b-r2-pass-${tag}@example.org`, password: 'browser-pass-1234', domain: process.env.SITE_DOMAIN || 'br2-demo.example-shop.com' };
  const browser = await chromium.launch();
  const c = await ctx(browser, 'desktop', 'light');
  const page = await c.newPage();

  await visit(page, { name: '01-marketing-home', path: '/', size: 'desktop', theme: 'light' });
  await visit(page, {
    name: '02-signup', path: '/signup', size: 'desktop', theme: 'light',
    after: async (p) => {
      await p.getByLabel('Your name').fill(account.name);
      await p.getByLabel('Work e-mail').fill(account.email);
      await p.getByLabel('Password', { exact: false }).first().fill(account.password);
    },
  });
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/onboarding/, { timeout: 20_000 });

  await visit(page, {
    name: '03-onboarding-company', size: 'desktop', theme: 'light',
    after: async (p) => { await p.getByLabel('Company name').fill('Northwind Trading'); },
  });
  await page.getByRole('button', { name: 'Continue' }).first().click();
  await page.waitForURL(/website/, { timeout: 20_000 });

  await visit(page, {
    name: '04-onboarding-website', size: 'desktop', theme: 'light',
    after: async (p) => {
      await p.getByLabel('Website address').fill(account.domain);
      await p.getByLabel('Main country').selectOption({ label: 'United Arab Emirates' });
      await p.getByLabel('What you do').fill('We sell wholesale office supplies to companies in the UAE, with next-day delivery.');
      await p.getByLabel('Who your customers are').fill('Office managers and procurement leads at UAE companies with 10 to 500 staff.');
    },
  });
  await page.getByRole('button', { name: 'Add website' }).click();
  await page.waitForURL(/verify/, { timeout: 20_000 });
  await visit(page, { name: '05-onboarding-verify', size: 'desktop', theme: 'light' });
  const m = page.url().match(/onboarding\/([0-9a-f-]{36})/i);
  const siteId = new URL(page.url()).searchParams.get('site');
  save({ account, orgId: m?.[1] ?? null, siteId, results });
  await browser.close();
}

async function phase2() {
  const s = read();
  const browser = await chromium.launch();
  const login = await ctx(browser, 'desktop', 'light');
  const page = await login.newPage();
  await page.goto(BASE + '/login');
  await page.getByLabel(/e-mail/i).fill(s.account.email);
  await page.getByLabel(/password/i).first().fill(s.account.password);
  await page.getByRole('button', { name: /sign in|log in/i }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 });
  const storageState = await login.storageState();
  await login.close();

  const site = `/o/${s.orgId}/sites/${s.siteId}`;
  const pages = [
    ['06-overview', `${site}/overview`],
    ['07-recommendations', `${site}/recommendations`],
    ['08-search', `${site}/search`],
    ['09-rankings', `${site}/rankings`],
    ['10-content', `${site}/content`],
    ['11-technical', `${site}/technical`],
    ['12-ai', `${site}/ai`],
    ['13-backlinks', `${site}/backlinks`],
    ['14-alerts', `${site}/alerts`],
    ['15-pipeline', `${site}/pipeline`],
    ['16-reports', `/o/${s.orgId}/reports`],
    ['17-report', `/o/${s.orgId}/reports/${s.reportId}`],
    ['18-report-draft', `/o/${s.orgId}/reports/${s.draftReportId}`],
  ];

  for (const [size, theme] of [['desktop', 'light'], ['phone', 'light'], ['desktop', 'dark']]) {
    const c = await ctx(browser, size, theme, storageState);
    const p = await c.newPage();
    for (const [name, path] of pages) await visit(p, { name, path, size, theme });
    await c.close();
  }

  // the share link, made the way a customer makes one: the Share button on the report
  const c = await ctx(browser, 'desktop', 'light', storageState);
  const p = await c.newPage();
  await p.goto(BASE + `/o/${s.orgId}/reports/${s.reportId}`);
  await p.getByRole('button', { name: 'Share' }).first().click();
  await p.getByRole('button', { name: /create a link/i }).click();
  await p.waitForSelector('text=/Copy it now/', { timeout: 20_000 });
  const shown = p.locator('.font-mono').filter({ hasText: '/share/' }).first();
  const token = (await shown.innerText()).trim().split('/share/')[1];
  // a live token is a working link to the report: the screenshot that goes into the repository must not carry one
  await shown.evaluate((el) => { el.textContent = el.textContent.replace(/\/share\/.*/, '/share/••••••••  (hidden for the screenshot)'); });
  await visit(p, { name: '19-share-dialog', size: 'desktop', theme: 'light' });
  // and one for the draft, to show what a client is told about work the run did not pass
  await p.goto(BASE + `/o/${s.orgId}/reports/${s.draftReportId}`);
  await p.getByRole('button', { name: 'Share' }).first().click();
  await p.getByRole('button', { name: /create a link/i }).click();
  await p.waitForSelector('text=/Copy it now/', { timeout: 20_000 });
  const draftToken = (await p.locator('.font-mono').filter({ hasText: '/share/' }).first().innerText()).trim().split('/share/')[1];
  await c.close();
  save({ token, draftToken });

  // the shared page itself: no account, no cookies — a fresh context every time
  for (const [size, theme] of [['desktop', 'light'], ['desktop', 'dark'], ['phone', 'light'], ['phone', 'dark']]) {
    const sc = await ctx(browser, size, theme);
    const sp = await sc.newPage();
    await routeLogo(sp);
    await visit(sp, { name: '20-share-branded', path: `/share/${token}`, size, theme });
    await sc.close();
  }
  // a logo that does not load must leave a finished page, not a broken image: no route this time, the host does not resolve
  for (const [size, theme] of [['desktop', 'light'], ['desktop', 'dark']]) {
    const sc = await ctx(browser, size, theme);
    const sp = await sc.newPage();
    await visit(sp, { name: '21-share-logo-fails', path: `/share/${token}`, size, theme, expectFailed: ['northwind-logo.png'] });
    await sc.close();
  }
  // the draft: the run's own caveat, before any figure
  for (const [size, theme] of [['desktop', 'light'], ['phone', 'light']]) {
    const sc = await ctx(browser, size, theme);
    const sp = await sc.newPage();
    await routeLogo(sp);
    await visit(sp, { name: '22-share-draft-caveat', path: `/share/${draftToken}`, size, theme });
    await sc.close();
  }
  // a link that was turned off says so, and shows nothing
  for (const [size, theme] of [['desktop', 'light']]) {
    const sc = await ctx(browser, size, theme);
    const sp = await sc.newPage();
    // the 404 is the point of this one: a token nobody issued must answer exactly like a revoked one
    await visit(sp, { name: '23-share-dead-link', path: '/share/' + 'z'.repeat(43), size, theme, expectFailed: ['/api/share/'], expectConsole: ['404'] });
    await sc.close();
  }

  await browser.close();
  save({ results });
}

await (phase === 'phase1' ? phase1() : phase2());
const prev = tryRead()?.allResults ?? [];
save({ allResults: [...prev, ...results] });
console.log(`\n${results.length} visits recorded in ${STATE}; screenshots in ${OUT}`);
