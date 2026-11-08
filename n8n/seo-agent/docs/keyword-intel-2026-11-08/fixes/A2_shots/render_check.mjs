// KI A2 render check: the built web app (dist) served from disk through page.route, every /api answered from fixtures (GET only; any other
// method is refused, so nothing can start or change). Screens at 375 / 768 / 1440, light and dark. Findings: horizontal page scroll,
// tap targets under 40 px on phones, console errors, h1 count.
import { chromium } from 'playwright';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const DIST = process.env.DIST;
const OUT = process.env.OUT;
mkdirSync(OUT, { recursive: true });
const BASE = 'http://app.test';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

const D = 'novaand-demo.com';
const now = '2026-11-08T06:12:00Z';
const me = { user: { id: 'u1', email: 'owner@novaand-demo.com', name: 'Nora Owner', avatarUrl: null, emailVerified: true, hasPassword: true, googleLinked: false, createdAt: now, mfaEnabled: false }, orgs: [{ id: 'org-1', name: 'Nova Works', slug: 'nova', role: 'owner', onboardingStep: 'done', onboardedAt: now }], platformAdmin: true };
const org = { id: 'org-1', name: 'Nova Works', slug: 'nova', industry: '', size: '1-10', website: D, monthlyBudgetUsd: 25, disabled: false, onboardingStep: 'done', onboardedAt: now, createdAt: now, role: 'owner', kind: 'standard', agency: null };
const site = { id: 'site-1', orgId: 'org-1', domain: D, n8nSiteId: 'site_' + D, country: 'United Arab Emirates', business: 'ERP and Microsoft Dynamics partner', customers: '', goal: 'leads', tone: '', cta: '', businessFacts: '', competitors: [], brandNames: [], keywords: [], ga4PropertyId: '', gscProperty: '', blogsPerWeek: 1, verifiedAt: now, verificationMethod: 'dns', trackingStatus: 'active', trackingStartedAt: now, createdAt: now, timezone: 'Asia/Dubai', services: [], cycleWeekday: 1, autopilotLevel: 1 };

const overview = { mode: 'on', visible: true, canSwitch: true, canAct: true, maxCompetitors: 5, credits: { competitors: 21, research: 54 },
  lastRuns: [
    { runId: 'r1', kind: 'competitors', market: 'AE-en', mode: 'on', status: 'ok', reason: '', startedAt: now, finishedAt: now, sections: [], missingSections: [], counts: {} },
    { runId: 'r2', kind: 'keyword_research', market: 'AE-en', mode: 'on', status: 'partial', reason: '', startedAt: now, finishedAt: now, sections: [], missingSections: ['gaps'], counts: {} },
  ],
  summary: { market: 'AE-en', competitors: { total: 9, chosen: 2, watch: 1, candidates: 3, dismissed: 1, listings: 3, platforms: 1, confirmed: true }, keywords: { total: 124, byVerdict: { go: 6, months: 9, hard: 4, gated: 3 }, byStage: {}, striking: 5, quickWins: 4, questions: 8, clusters: 22, needsReview: 1, brand: 2 }, gaps: { open: 11, byType: { missing: 5, listing: 3 } }, fetchedAt: now },
};
const comp = (d, o = {}) => ({ compDomain: d, market: 'AE-en', class: 'direct', classLabel: '', classBasis: 'rule', classConfidence: 0.9, scored: true, score: 60, scoreLow: 52, scoreHigh: 68, serpShare: 0.21, topicSim: 0.7, geoMatch: 1, aiShare: 0.1, sizeTag: 'peer', sizeLabel: '', seedsSeen: 9, seedsTotal: 14, reasons: [`In the first 10 Google results for 9 of 14 of your service searches in the United Arab Emirates`], evidence: [], declared: false, status: 'candidate', statusBy: 'auto', firstSeen: now, lastSeen: now, misses: 0,
  profile: { etv: 4200, keywords: 860, refdomains: 140, pace_per_month: 6, brand_share: 0.3, top_pages: [{ url: `https://${d}/erp-implementation`, etv: 900, keywords: 80, page_type: 'service' }, { url: `https://${d}/business-central`, etv: 600, keywords: 40, page_type: 'service' }], basis: {}, fetched_at: now }, fetchedAt: now, basis: 'provider_estimate', basisLabel: '', ...o });
const competitors = { market: 'AE-en', maxCompetitors: 5, chosen: 2, items: [
  comp('northpeak-erp.com', { status: 'chosen', statusBy: 'user', score: 74 }), comp('bluefin-consulting.ae', { status: 'chosen', statusBy: 'user', score: 66, sizeTag: 'leader' }),
  comp('atlas-dynamics-partners-international.io', { class: 'adjacent', score: 51 }), comp('gulfledger.ae', { score: 44, sizeTag: 'smaller' }), comp('orbit-erp.com', { status: 'watch', score: 40 }),
  comp('clutch.co', { class: 'directory', scored: false, score: null }), comp('topfirms-list.com', { class: 'publisher_list', scored: false, score: null }), comp('goodfirms.co', { class: 'directory', scored: false, score: null }),
  comp('microsoft.com', { class: 'principal', scored: false, score: null }), comp('lookalike.example', { status: 'dismissed', statusBy: 'user' }),
] };
const KW = [
  ['business central partner abu dhabi', 'go', 'hire', 480, 14, 220], ['erp implementation cost uae', 'months', 'compare', 320, null, null], ['dynamics 365 partner dubai', 'go', 'hire', 590, 9, 400],
  ['how much does erp cost in dubai', 'months', 'compare', 90, null, null], ['what is microsoft dynamics 365 business central', 'hard', 'info', 1300, 33, 60], ['dynamics 365 jobs dubai', 'gated', 'hire', 880, null, null],
  ['erp software uae', 'months', 'solution', 1900, 18, 310], ['sap vs dynamics 365 for distributors', 'hard', 'compare', 70, null, null], ['cloud erp migration uae', 'go', 'solution', 140, 11, 130],
  ['best erp consultants in dubai', 'months', 'compare', 210, 21, 50],
];
const kwRow = ([k, v, st, vol, pos, imp], i) => ({ keyword: k, kwKey: k, market: 'AE-en', sources: [{ source: i % 2 ? 'paa' : 'gsc', label: '', fetchedAt: now }, { source: 'autocomplete', label: '', fetchedAt: now }], sourceCount: 2, volume: i === 3 ? null : vol, volumeBasis: 'provider_estimate', volumeBasisLabel: '', volumeSource: 'Google Ads', cpc: 4, kd: 30,
  gsc: pos == null ? null : { impressions: imp, clicks: 3, position: pos, page: `https://${D}/erp` }, intent: 'commercial', stage: st, stageLabel: '', needsReview: i === 7, gate: v === 'gated' ? 'fail' : 'pass', gateReason: v === 'gated' ? 'career' : null, verdict: v, verdictLabel: '', verdictTone: '',
  score: v === 'gated' ? 0 : 70 - i * 4, scoreLow: v === 'gated' ? 0 : 60 - i * 4, scoreHigh: v === 'gated' ? 0 : 78 - i * 4, lowConfidence: i === 4, factors: { fit: 1, demand: 0.5, win: v === 'go' ? 0.7 : 0.45, value: 0.5, gap: 0.4 }, clusterId: 'c' + i, isHead: i !== 3, clusterSize: 3 + (i % 4), clusterDemand: vol * 2,
  pageAction: i % 3 === 0 ? 'refresh' : i % 3 === 1 ? 'new' : 'list', pageUrl: i % 3 === 0 ? `https://${D}/erp` : null, competitors: [{ domain: 'northpeak-erp.com', position: 2 + i, url: 'https://northpeak-erp.com/x' }], striking: pos != null && pos >= 8 && pos <= 20, brand: false, question: /^(how|what)/.test(k), serpReadAt: now, fetchedAt: now });
const rows = KW.map(kwRow);
const gaps = { market: 'AE-en', total: 4, page: 1, pageSize: 50, pages: 1, byType: {}, byStatus: {}, items: [
  { gapId: 'g1', market: 'AE-en', type: 'missing', keyword: 'erp support dubai', clusterId: 'c1', competitorDomains: ['northpeak-erp.com', 'bluefin-consulting.ae'], clientPosition: null, evidence: null, sampleNote: null, action: 'new_page', actionTarget: null, credits: 114, status: 'open', createdAt: now, updatedAt: now },
  { gapId: 'g2', market: 'AE-en', type: 'listing', keyword: null, clusterId: null, competitorDomains: ['northpeak-erp.com'], clientPosition: null, evidence: null, sampleNote: null, action: 'list', actionTarget: 'clutch.co', credits: 0, status: 'open', createdAt: now, updatedAt: now },
  { gapId: 'g3', market: 'AE-en', type: 'weak', keyword: 'erp software uae', clusterId: 'c6', competitorDomains: ['bluefin-consulting.ae'], clientPosition: 18, evidence: null, sampleNote: 'sample of 300 of 1,240', action: 'refresh', actionTarget: `https://${D}/erp`, credits: 40, status: 'open', createdAt: now, updatedAt: now },
  { gapId: 'g4', market: 'AE-en', type: 'page_type', keyword: 'erp pricing', clusterId: null, competitorDomains: ['northpeak-erp.com', 'gulfledger.ae'], clientPosition: null, evidence: null, sampleNote: null, action: 'new_page', actionTarget: null, credits: 114, status: 'open', createdAt: now, updatedAt: now },
] };
const plan = [
  { action_id: 'a1', kind: 'refresh', title: 'Improve your Business Central page', why: 'You are #14 for "business central partner abu dhabi" and two of your competitors are on page one.', target: `https://${D}/erp`, credits: 40 },
  { action_id: 'a2', kind: 'new_page', title: 'Write a page for "erp implementation cost uae"', why: 'Buyers comparing providers search it 320 times a month; you have no page.', target: '', credits: 114 },
  { action_id: 'a3', kind: 'list', title: 'Get listed on clutch.co', why: 'It shows three of your competitors for your services, and not you.', target: 'clutch.co', credits: 0 },
];
const report = { id: 'rep-1', runId: 'run-1', siteId: 'site-1', siteDomain: D, stage: 'ki_research', status: 'ok', title: 'Keyword research', summary: {}, receivedAt: now, scheduled: false, files: [] };

function kwAnswer(url) {
  const q = url.searchParams;
  let r = rows;
  if (q.get('heads') === '1') r = r.filter((x) => x.isHead);
  if (q.get('striking') === '1') r = r.filter((x) => x.striking);
  if (q.get('questions') === '1') r = r.filter((x) => x.question);
  if (q.get('verdict')) r = r.filter((x) => x.verdict === q.get('verdict'));
  const page = Number(q.get('page') || 1);
  const total = q.get('heads') || q.get('striking') || q.get('questions') || q.get('verdict') ? r.length : 124;
  return { market: 'AE-en', total, page, pageSize: 50, pages: Math.ceil(total / 50), sort: q.get('sort'), items: r, facets: {} };
}

function api(url) {
  const p = url.pathname;
  if (p === '/api/auth/providers') return { google: false, emailPassword: true, email: false, engineEmails: false, requireEmailVerification: false };
  if (p === '/api/me') return me;
  if (p === '/api/orgs/org-1') return org;
  if (p === '/api/orgs/org-1/sites') return [site];
  const b = '/api/orgs/org-1/sites/site-1/ki';
  if (p === b) return overview;
  if (p === b + '/competitors') return competitors;
  if (p === b + '/keywords') return kwAnswer(url);
  if (p === b + '/gaps') return gaps;
  if (p === '/api/orgs/org-1/reports') return url.searchParams.get('stage') === 'ki_research' ? [report] : [];
  if (p === '/api/orgs/org-1/reports/rep-1') return { ...report, payload: { stage: 'ki_research', plan } };
  return null;
}

const browser = await chromium.launch();
const findings = [];
const SIZES = [375, 768, 1440];
const PAGES = ['competitors', 'keywords'];
for (const theme of ['light', 'dark']) {
  for (const w of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' });
    await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
    await ctx.route('**/*', async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.origin !== BASE) return route.fulfill({ status: 204, body: '' });
      if (url.pathname.startsWith('/api/')) {
        if (req.method() !== 'GET') return route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ error: 'blocked in the render check' }) });
        const a = api(url);
        return a == null ? route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Not found' }) }) : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(a) });
      }
      let f = join(DIST, url.pathname);
      if (!existsSync(f) || url.pathname === '/' || !extname(f)) f = join(DIST, 'index.html');
      return route.fulfill({ status: 200, contentType: MIME[extname(f)] ?? 'application/octet-stream', body: readFileSync(f) });
    });
    for (const pg of PAGES) {
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(`${BASE}/o/org-1/sites/site-1/${pg}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      const m = await page.evaluate(() => {
        const doc = document.documentElement;
        const small = [...document.querySelectorAll('main button, main a[href], main select, main input[type=checkbox]')]
          .filter((el) => el.offsetParent !== null)
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ el, r }) => r.width > 0 && r.height < 40 && !(el.tagName === 'INPUT') && !el.closest('[data-tip], [role=tooltip]') && !(el.getAttribute('aria-label') || '').startsWith('What') && !(el.getAttribute('aria-label') || '').startsWith('About'))
          .map(({ el, r }) => `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40)}" ${Math.round(r.height)}px`);
        return { overflow: doc.scrollWidth - doc.clientWidth, h1: document.querySelectorAll('h1').length, small: [...new Set(small)].slice(0, 12) };
      });
      const name = `${pg}-${w}-${theme}.png`;
      await page.screenshot({ path: join(OUT, name), fullPage: true });
      if (w === 375) for (const [i, y] of [0, 1, 2, 3].map((k) => [k, k * 1100])) await page.screenshot({ path: join(OUT, `${pg}-375-${theme}-part${i}.png`), clip: { x: 0, y, width: 375, height: 1100 }, fullPage: true }).catch(() => {});
      findings.push({ page: pg, width: w, theme, overflowPx: m.overflow, h1: m.h1, smallTapTargets: w === 375 ? m.small : undefined, consoleErrors: errors.filter((e) => !/404|Failed to load resource/.test(e)).slice(0, 5), file: name });
      // the drawer and the filter sheet, light only
      if (theme === 'light' && pg === 'competitors' && w !== 768) {
        await page.getByRole('button', { name: 'Details' }).first().click();
        await page.waitForTimeout(700);
        await page.screenshot({ path: join(OUT, `competitors-drawer-${w}.png`) });
        const dov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        findings.push({ page: 'competitors drawer', width: w, theme, overflowPx: dov, file: `competitors-drawer-${w}.png` });
      }
      if (theme === 'light' && pg === 'keywords' && w === 375) {
        await page.getByRole('button', { name: /^Filters/ }).first().click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: join(OUT, `keywords-filters-375.png`) });
        findings.push({ page: 'keywords filter sheet', width: w, theme, file: 'keywords-filters-375.png' });
      }
      await page.close();
    }
    await ctx.close();
  }
}
await browser.close();
writeFileSync(join(OUT, 'findings.json'), JSON.stringify(findings, null, 2));
console.log(JSON.stringify(findings, null, 1));
