/**
 * G5 browser pass — the agency screens and the white-label client portal, driven by a real Chromium against a throwaway stack
 * (gap-g5: own Postgres, the n8n stand-in `stub_n8n.py`, the API serving the built web app on :4000). Run inside the API container's
 * network namespace, with the portal host mapped to it:
 *   docker run --rm --network container:gap-g5-api -v <app>/scripts:/bp:ro -v <state>:/state -v <app>/docs/browser-pass/g5:/out \
 *     -w /state mcr.microsoft.com/playwright:v1.55.0-noble node /bp/g5_browser_pass.mjs <setup|reports|shots>
 * Between `setup` and `reports` the caller marks the client's website and the portal address verified in the throwaway database (no
 * real DNS and no real domain exist here); everything else goes through the UI or the API.
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const APP = 'http://localhost:4000';
const PORTAL_HOST = 'seo.northagency.com';
const PORTAL = `http://${PORTAL_HOST}:4000`;
const OUT = '/out';
const STATE = '/state/g5.json';
const PW = 'browser-pass-1234';
const SIZES = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
const phase = process.argv[2];
mkdirSync(OUT, { recursive: true });
const read = () => {
  try {
    return JSON.parse(readFileSync(STATE, 'utf8'));
  } catch {
    return {};
  }
};
const save = (o) => writeFileSync(STATE, JSON.stringify({ ...read(), ...o }, null, 2));
const launch = () => chromium.launch({ args: [`--host-resolver-rules=MAP ${PORTAL_HOST} 127.0.0.1`] });

const CONTRAST = `() => {
  const lum = (c) => { const [r,g,b] = c.map(v => { v/=255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }); return 0.2126*r + 0.7152*g + 0.0722*b; };
  const rgb = (s) => { const m = String(s).match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { c: p.slice(0,3), a: p.length > 3 ? p[3] : 1 }; };
  const bgOf = (el) => { let n = el; while (n && n !== document.documentElement) { const v = rgb(getComputedStyle(n).backgroundColor); if (v && v.a > 0.9) return v.c; n = n.parentElement; } const b = rgb(getComputedStyle(document.body).backgroundColor); return b ? b.c : [255,255,255]; };
  const out = [];
  for (const el of document.querySelectorAll('p,span,a,h1,h2,h3,h4,dt,dd,li,label,button,td,th,div,code,legend')) {
    if (!el.firstChild || el.firstChild.nodeType !== 3 || !el.textContent.trim()) continue;
    const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue;
    const st = getComputedStyle(el); if (st.visibility === 'hidden' || st.opacity === '0') continue;
    const fg = rgb(st.color); if (!fg || fg.a < 0.9) continue;
    const bg = bgOf(el); const l1 = lum(fg.c), l2 = lum(bg);
    const ratio = (Math.max(l1,l2) + 0.05) / (Math.min(l1,l2) + 0.05);
    const size = parseFloat(st.fontSize), bold = Number(st.fontWeight) >= 700;
    const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
    if (ratio + 0.05 < need) out.push({ text: el.textContent.trim().slice(0, 40), ratio: Math.round(ratio * 100) / 100, need });
  }
  return out.sort((a, b) => a.ratio - b.ratio).slice(0, 6);
}`;

const results = read().results ?? [];
async function visit(page, { name, url, size, theme, portal = false, expectFailed = [], after }) {
  const errors = [];
  const failed = [];
  const skip = (u) => expectFailed.some((e) => u.includes(e));
  const onConsole = (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200));
  };
  const onFailed = (r) => {
    // a request cancelled because the test navigated on (net::ERR_ABORTED) is not a failure of the page
    if (!skip(r.url()) && r.failure()?.errorText !== 'net::ERR_ABORTED') failed.push(`${r.url().slice(0, 140)} — ${r.failure()?.errorText ?? ''}`);
  };
  const onResponse = (r) => {
    if (r.status() >= 400 && !skip(r.url())) failed.push(`${r.url().slice(0, 140)} — HTTP ${r.status()}`);
  };
  page.on('console', onConsole);
  page.on('requestfailed', onFailed);
  page.on('response', onResponse);
  if (url) await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(600);
  if (after) await after(page);
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const h1 = await page.locator('h1').count();
  const contrast = await page.evaluate(`(${CONTRAST})()`);
  // the white-label promise: on a client-facing page our name appears nowhere (text, title, images' alt)
  const platformMentions = portal
    ? await page.evaluate(() => {
        const t = `${document.title} ${document.body.innerText} ${[...document.images].map((i) => `${i.alt} ${i.src}`).join(' ')}`;
        return (t.match(/alaventra/gi) ?? []).length;
      })
    : null;
  const file = `${name}-${size}-${theme}.png`;
  await page.screenshot({ path: `${OUT}/${file}`, fullPage: true });
  page.off('console', onConsole);
  page.off('requestfailed', onFailed);
  page.off('response', onResponse);
  const row = { name, size, theme, url: page.url(), consoleErrors: errors, failedRequests: failed, overflowPx: Math.max(0, overflow), h1, contrast, platformMentions, shot: file };
  results.push(row);
  const bad = errors.length || failed.length || overflow > 1 || !h1 || contrast.length || (portal && platformMentions);
  console.log(`${bad ? 'CHECK' : 'ok   '} ${name} ${size}/${theme}${bad ? ` ${JSON.stringify({ errors, failed, overflow, h1, contrast, platformMentions })}` : ''}`);
  return row;
}

const api = async (page, base, method, path, data, headers = {}) => {
  const r = await page.request.fetch(base + path, { method, data, headers: { 'x-requested-with': 'fetch', ...headers } });
  const t = await r.text();
  let body;
  try {
    body = JSON.parse(t);
  } catch {
    body = t;
  }
  if (r.status() >= 400) throw new Error(`${method} ${path} → ${r.status()} ${t.slice(0, 200)}`);
  return body;
};

// ------------------------------------------------------------------ setup: an agency, two clients, a website, client people
async function setup() {
  const browser = await launch();
  const page = await (await browser.newContext()).newPage();
  await api(page, APP, 'POST', '/api/auth/signup', { name: 'Nora Lindqvist', email: 'nora@northagency.com', password: PW });
  const agency = await api(page, APP, 'POST', '/api/orgs', { name: 'North Agency', industry: 'Marketing' });
  await api(page, APP, 'PATCH', `/api/orgs/${agency.id}/onboarding`, { step: 'done', done: true });
  await api(page, APP, 'POST', `/api/orgs/${agency.id}/agency`);
  await api(page, APP, 'PUT', `/api/orgs/${agency.id}/branding`, {
    whiteLabel: true,
    productName: 'North Insights',
    accent: '#0f766e',
    supportEmail: 'help@northagency.com',
    footerText: 'North Agency Ltd · 12 Harbour Street, Leith',
    poweredBy: false,
  });
  await api(page, APP, 'PUT', `/api/orgs/${agency.id}/portal/mail`, { senderName: '', replyTo: 'team@northagency.com', fromMailboxId: null, dkimSelector: '' });
  const acme = await api(page, APP, 'POST', `/api/orgs/${agency.id}/clients`, { name: 'Acme Trading', monthlyBudgetUsd: 40 });
  const beta = await api(page, APP, 'POST', `/api/orgs/${agency.id}/clients`, { name: 'Beta Foods', monthlyBudgetUsd: 25 });
  const site = await api(page, APP, 'POST', `/api/orgs/${acme.id}/sites`, { domain: 'acme-trading-demo.com', country: 'United Kingdom', business: 'Industrial supplies' });
  const inv = await api(page, APP, 'POST', `/api/orgs/${acme.id}/invitations`, { email: 'claire@acme-trading-demo.com', role: 'client_approver' });
  const domain = await api(page, APP, 'POST', `/api/orgs/${agency.id}/portal/domains`, { host: PORTAL_HOST });
  // a member of the agency with access to Acme only
  const memInv = await api(page, APP, 'POST', `/api/orgs/${agency.id}/invitations`, { email: 'sam@northagency.com', role: 'member' });
  const cp = await (await browser.newContext()).newPage();
  await api(cp, APP, 'POST', '/api/auth/signup', { name: 'Claire Dubois', email: 'claire@acme-trading-demo.com', password: PW, inviteToken: inv.inviteUrl.split('/invite/')[1] });
  const mp = await (await browser.newContext()).newPage();
  const sam = await api(mp, APP, 'POST', '/api/auth/signup', { name: 'Sam Patel', email: 'sam@northagency.com', password: PW, inviteToken: memInv.inviteUrl.split('/invite/')[1] });
  await api(page, APP, 'PUT', `/api/orgs/${agency.id}/clients/${acme.id}/staff/${sam.user.id}`, { role: 'member' });
  save({ agency: agency.id, acme: acme.id, beta: beta.id, site: site.id, domainId: domain.id, inviteUrl: inv.inviteUrl, results: [] });
  console.log(JSON.stringify({ agency: agency.id, acme: acme.id, site: site.id, domain: domain.id, inviteUrl: inv.inviteUrl }));
  await browser.close();
}

// ------------------------------------------------------------------ reports: the engine's callbacks, posted to the client's own hook
async function reports() {
  const s = read();
  const browser = await launch();
  const page = await (await browser.newContext()).newPage();
  const hook = process.argv[3];
  const b64 = (x) => Buffer.from(x).toString('base64');
  const post = (body) => page.request.post(`${APP}/api/hooks/n8n/${hook}`, { data: body }).then((r) => r.status());
  console.log(
    await post({
      stage: 'site_audit',
      status: 'success',
      domain: 'acme-trading-demo.com',
      health_score: 78,
      grade: 'C',
      issue_counts_stored: { Critical: 0, High: 3, Medium: 5, Low: 4 },
      run_cost_usd: 0.42,
      on_demand: false,
      pdf: { data: b64('%PDF-1.4\n% Prepared by Dev SEO\n'), fileName: 'acme-audit.pdf', mimeType: 'application/pdf' },
      markdown: { data: b64('# Technical audit\n\nPrepared by Dev SEO for acme-trading-demo.com\n'), fileName: 'acme-audit.md', mimeType: 'text/markdown' },
    }),
  );
  console.log(
    await post({
      stage: 'content',
      status: 'success',
      domain: 'acme-trading-demo.com',
      keyword: 'industrial fasteners uk',
      verdict: 'GO',
      score: 74,
      recommended_page: 'Guide',
      html: '<h1>Industrial fasteners in the UK: a buyer’s guide</h1><p>How to choose bolts, nuts and anchors for site work, with the standards that apply.</p>',
      on_demand: false,
    }),
  );
  console.log(await post({ stage: 'rank_tracker', status: 'success', domain: 'acme-trading-demo.com', head_keyword: 'industrial fasteners', positions: [1, 2, 3], gains: [1, 2, 3, 4], drops: [1], on_demand: false }));
  await browser.close();
  save({ hook });
}

// ------------------------------------------------------------------ shots
async function signIn(browser, base, email, theme, size) {
  const ctx = await browser.newContext({ viewport: SIZES[size], colorScheme: theme });
  const page = await ctx.newPage();
  await api(page, base, 'POST', '/api/auth/login', { email, password: PW });
  return { ctx, page };
}

async function shots() {
  const s = read();
  const browser = await launch();
  // the client's page report and the approval the agency asks for (once)
  {
    const { ctx, page } = await signIn(browser, APP, 'nora@northagency.com', 'light', 'desktop');
    const reps = await api(page, APP, 'GET', `/api/orgs/${s.acme}/reports`);
    const pageRep = reps.find((r) => r.stage === 'content');
    const audit = reps.find((r) => r.stage === 'site_audit');
    const existing = await api(page, APP, 'GET', `/api/orgs/${s.acme}/approvals`);
    void existing;
    // asking again replaces any earlier request: the portal shows one waiting for a decision
    await api(page, APP, 'POST', `/api/orgs/${s.acme}/approvals`, { kind: 'page', itemId: pageRep.id, siteId: s.site, title: pageRep.title, note: 'Please check the standards named in the second section.' });
    await api(page, APP, 'PUT', `/api/orgs/${s.acme}/client-settings`, { clientApproval: true });
    const share = await api(page, APP, 'POST', `/api/orgs/${s.acme}/reports/${audit.id}/shares`, { days: 7 });
    save({ pageReport: pageRep.id, auditReport: audit.id, shareUrl: share.url });
    await ctx.close();
  }
  const st = read();
  for (const size of ['desktop', 'phone']) {
    for (const theme of ['light', 'dark']) {
      // the agency's own screens, on the app's host (Alaventra's look)
      {
        const { ctx, page } = await signIn(browser, APP, 'nora@northagency.com', theme, size);
        await visit(page, { name: 'agency-clients', url: `${APP}/o/${st.agency}/clients`, size, theme });
        await visit(page, { name: 'agency-branding', url: `${APP}/o/${st.agency}/settings/branding`, size, theme });
        await visit(page, { name: 'agency-portal-address', url: `${APP}/o/${st.agency}/settings/portal`, size, theme });
        await visit(page, { name: 'agency-client-mail', url: `${APP}/o/${st.agency}/settings/client-mail`, size, theme });
        await visit(page, { name: 'client-approvals-staff', url: `${APP}/o/${st.acme}/approvals`, size, theme });
        await visit(page, { name: 'client-branding', url: `${APP}/o/${st.acme}/settings/branding`, size, theme });
        await visit(page, { name: 'client-team', url: `${APP}/o/${st.acme}/settings/team`, size, theme });
        if (size === 'desktop' && theme === 'light')
          await visit(page, {
            name: 'agency-new-client-dialog',
            url: `${APP}/o/${st.agency}/clients`,
            size,
            theme,
            after: async (p) => {
              await p.getByRole('button', { name: 'New client' }).first().click();
              await p.getByRole('dialog').waitFor();
            },
          });
        await ctx.close();
      }
      // the client's portal, on the agency's host
      {
        const ctx = await browser.newContext({ viewport: SIZES[size], colorScheme: theme });
        const page = await ctx.newPage();
        const noIcon = ['/favicon.ico'];
        await visit(page, { name: 'portal-login', url: `${PORTAL}/login`, size, theme, portal: true, expectFailed: noIcon });
        await page.getByLabel('Work e-mail').fill('claire@acme-trading-demo.com');
        await page.getByLabel('Password').fill(PW);
        await page.getByRole('button', { name: 'Sign in' }).click();
        await page.waitForURL(/\/overview/, { timeout: 20_000 });
        await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
        await visit(page, { name: 'portal-overview', size, theme, portal: true, expectFailed: noIcon });
        await visit(page, { name: 'portal-recommendations', url: `${PORTAL}/o/${st.acme}/sites/${st.site}/recommendations`, size, theme, portal: true, expectFailed: noIcon });
        await visit(page, { name: 'portal-technical', url: `${PORTAL}/o/${st.acme}/sites/${st.site}/technical`, size, theme, portal: true, expectFailed: noIcon });
        await visit(page, { name: 'portal-reports', url: `${PORTAL}/o/${st.acme}/reports`, size, theme, portal: true, expectFailed: noIcon });
        await visit(page, { name: 'portal-report-audit', url: `${PORTAL}/o/${st.acme}/reports/${st.auditReport}`, size, theme, portal: true, expectFailed: noIcon });
        await visit(page, { name: 'portal-approvals', url: `${PORTAL}/o/${st.acme}/approvals`, size, theme, portal: true, expectFailed: noIcon });
        // a page outside the portal sends the client back to it
        await visit(page, { name: 'portal-guard-runs', url: `${PORTAL}/o/${st.acme}/runs`, size, theme, portal: true, expectFailed: noIcon });
        await ctx.close();
      }
      // the shared report under the agency (no account)
      {
        const ctx = await browser.newContext({ viewport: SIZES[size], colorScheme: theme });
        const page = await ctx.newPage();
        await visit(page, { name: 'share-white-label', url: st.shareUrl.replace(PORTAL_HOST + '/', PORTAL_HOST + ':4000/'), size, theme, portal: true, expectFailed: ['/favicon.ico'] });
        await ctx.close();
      }
    }
  }
  // the client approves the page, through the UI, on the portal host
  {
    const ctx = await browser.newContext({ viewport: SIZES.desktop, colorScheme: 'light' });
    const page = await ctx.newPage();
    await page.goto(`${PORTAL}/login`);
    await page.getByLabel('Work e-mail').fill('claire@acme-trading-demo.com');
    await page.getByLabel('Password').fill(PW);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/overview/, { timeout: 20_000 });
    await page.goto(`${PORTAL}/o/${st.acme}/approvals`);
    await page.getByRole('button', { name: 'Approve' }).first().click();
    await page.getByText('Approved', { exact: true }).first().waitFor({ timeout: 10_000 });
    await visit(page, { name: 'portal-approved', size: 'desktop', theme: 'light', portal: true, expectFailed: ['/favicon.ico'] });
    await ctx.close();
  }
  // a client person on the app's own host still sees the agency inside the workspace
  {
    const { ctx, page } = await signIn(browser, APP, 'claire@acme-trading-demo.com', 'light', 'desktop');
    await visit(page, { name: 'client-on-app-host', url: `${APP}/o/${st.acme}/sites/${st.site}/overview`, size: 'desktop', theme: 'light', portal: true });
    await ctx.close();
  }
  // an agency member assigned to Acme only
  {
    const { ctx, page } = await signIn(browser, APP, 'sam@northagency.com', 'light', 'desktop');
    await visit(page, { name: 'member-clients', url: `${APP}/o/${st.agency}/clients`, size: 'desktop', theme: 'light' });
    await ctx.close();
  }
  // a host nobody verified
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const r = await page.request.get(`${APP.replace('localhost', '127.0.0.1')}/api/health`);
    results.push({ name: 'health-on-ip', status: r.status() });
    await ctx.close();
  }
  save({ results });
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  const bad = results.filter((r) => r.consoleErrors?.length || r.failedRequests?.length || r.overflowPx > 1 || r.h1 === 0 || r.contrast?.length || r.platformMentions);
  console.log(`${results.length} visits, ${bad.length} to check`);
  await browser.close();
}

if (phase === 'setup') await setup();
else if (phase === 'reports') await reports();
else if (phase === 'shots') await shots();
else console.log('phase: setup | reports | shots');
