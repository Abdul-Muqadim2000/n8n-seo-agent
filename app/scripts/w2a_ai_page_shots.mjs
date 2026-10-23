// W2-A browser pass: the built web app served from /dist, every /api call answered from fixtures (sample data, no real customer), the AI
// visibility page at 1440 and 390, light and dark. Nothing is sent anywhere: non-GET requests are refused.
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const DIST = '/dist', OUT = '/out';
mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.webp': 'image/webp', '.ico': 'image/x-icon' };
const srv = http.createServer((req, res) => {
  const p = join(DIST, decodeURIComponent(req.url.split('?')[0]));
  const f = existsSync(p) && extname(p) ? p : join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => srv.listen(5180, r));

const ORG = '00000000-0000-0000-0000-0000000000a1', SITE = '00000000-0000-0000-0000-0000000000b2', D = 'demo-erp.example.com';
const now = '2026-10-19T07:00:00.000Z';
const user = { id: 'u1', email: 'owner@example.com', name: 'Sample Owner', avatarUrl: null, emailVerified: true, hasPassword: true, googleLinked: false, createdAt: now, mfaEnabled: false };
const me = { user, orgs: [{ id: ORG, name: 'Sample Co', slug: 'sample', role: 'owner', onboardingStep: 'done', onboardedAt: now, kind: 'standard' }], platformAdmin: false };
const org = { id: ORG, name: 'Sample Co', slug: 'sample', industry: '', size: '', website: D, monthlyBudgetUsd: 0, disabled: false, onboardingStep: 'done', onboardedAt: now, createdAt: now, role: 'owner', kind: 'standard', agency: null, brand: null, clientApproval: false };
const site = { id: SITE, orgId: ORG, domain: D, n8nSiteId: 'site_demo', country: 'AE', business: 'ERP partner', customers: '', goal: 'leads', tone: '', cta: '', businessFacts: '', competitors: ['acme-erp.example', 'globex.example'], brandNames: [], keywords: [], ga4PropertyId: '', gscProperty: '', blogsPerWeek: 1, verifiedAt: now, verificationMethod: 'dns', trackingStatus: 'active', trackingStartedAt: now, createdAt: now, timezone: '', services: [], cycleWeekday: 1, autopilotLevel: 2 };

const eng = (m, c, n) => ({ mentionRate: m, citationRate: c, samples: n, ci: [Math.max(0, m - 6), m + 6], carried: false });
const run = (i, at, m, comparable) => ({
  runId: `ai_${i}`, checkedAt: at, prompts: 50, answers: 300, mentionRate: m, citationRate: m / 3, shareOfVoice: m + 4, avgRank: 2, aioPresence: 40, aioCitationRate: 5, credits: 120, alerts: [], alertItems: [],
  compare: i === 0 ? null : { source: 'engine', ruleVersion: '1', comparable, reason: comparable ? null : 'a different panel: 40% of the questions were asked before', previousRunId: `ai_${i - 1}`, previousAt: null, panelOverlap: comparable ? 0.95 : 0.4, enginesSame: true, window: null, metrics: comparable ? { named_rate: { now: m, prev: m - 2, delta: 2, nNow: 300, nPrev: 300, significant: false, p: 0.3 } } : {} },
  runKind: 'weekly', samples: 300, visibilityScore: 30 + i, mentionLo: m - 4, mentionHi: m + 5, sentimentScore: null, accuracyIssues: 0, aiSessions: 120, aiConversions: 4, aiRevenue: 0, indexSov: null, aiImpressions: null,
  engineRates: [{ key: 'chatgpt', name: 'ChatGPT', ...eng(m + 3, 6, 50) }, { key: 'gemini', name: 'Gemini', ...eng(m - 2, 3, 50) }, { key: 'perplexity', name: 'Perplexity', ...eng(m + 6, 9, 50) }],
  sov: { basis: 'all', brands: [{ id: 'acme-erp.example', name: 'acme-erp.example', share: 30 - i, n: 40 }, { id: 'globex.example', name: 'globex.example', share: 18 + i, n: 22 }] },
  ciNamed: [m - 5, m + 6], ciCited: null, ciMethod: i === 3 ? 'question-bootstrap' : '',
});
const runs = [run(0, '2026-09-28T07:00:00.000Z', 14, true), run(1, '2026-10-05T07:00:00.000Z', 16, true), run(2, '2026-10-12T07:00:00.000Z', 15, false), run(3, now, 18, true)];
const prompts = Array.from({ length: 8 }, (_, i) => ({ promptId: `q${i}`, prompt: ['Which ERP partner suits a retailer in Dubai?', 'Best ERP implementation partner in the UAE?', 'How much does an ERP rollout cost for a mid-size firm?', 'Which ERP is best for e-invoicing in the UAE?', 'Who supports Microsoft Dynamics 365 in Abu Dhabi?', 'Which accounting software works with UAE VAT?', 'What should a CFO ask an ERP partner?', 'Which inventory software do UAE distributors use?'][i], kind: 'custom', topic: i < 4 ? 'erp' : 'finance', keyword: '', source: i < 3 ? 'custom' : 'auto', status: i === 7 ? 'off' : 'active', createdAt: now, stage: ['decision', 'consideration', 'awareness', 'shopping'][i % 4], cluster: i < 4 ? 'erp' : 'finance', volume: 300 - i * 20, origin: i < 3 ? 'custom' : 'market', persona: i % 2 ? 'CFO' : 'IT manager', market: 'AE-en', pinned: i === 0, fitNote: '', ...(i < 5 ? { lastAskedAt: '2026-10-19T07:10:00.000Z', lastAskedRun: 'ai_3', askedN28d: 4 } : {}) }));
const ai = {
  runs, daily: [], promptsMax: 50, prompts, segments: null, panel: null, answers: [], growth: null, report: null, alertRules: [{ id: 'r1', metric: 'named_rate', scope: { engine: 'chatgpt' }, direction: 'drop', threshold_points: 5, enabled: true }],
  answerResults: prompts.flatMap((p, i) => ['chatgpt', 'gemini', 'perplexity'].map((e, j) => ({ promptId: p.promptId, engine: e, result: (i + j) % 4 === 0 ? 'cited' : (i + j) % 3 === 0 ? 'named' : 'absent' }))), answersStored: 24,
  latest: {
    runId: 'ai_3', engines: runs[3].engineRates.map((e) => ({ key: e.key, name: e.name, asked: 50, answered: 50, mentioned: Math.round(e.mentionRate / 2), cited: 3, mentionRate: e.mentionRate, citationRate: e.citationRate, errors: 0, knowsBrand: true, carried: false, samples: 50, pulseSamples: 0, ci: e.ci, sentiment: null })),
    competitors: [{ domain: 'acme-erp.example', mentions: 40, share: 27, auto: false }, { domain: 'globex.example', mentions: 22, share: 21, auto: false }],
    sources: [], pages: [], gaps: [], traffic: null, access: null, perception: null, index: null, stages: [], clusters: [], market: null,
    extras: {
      urls: { own: [{ url: `https://${D}/erp-retail`, citedN: 6, retrievedN: 14, citedRate: 42.9, answersN: 14, engines: ['chatgpt', 'perplexity'], questions: ['q0', 'q1'], rivalCitedInstead: [{ url: 'https://acme-erp.example/retail', host: 'acme-erp.example', n: 5 }] }], rivals: [], retrievedNotCited: [{ url: `https://${D}/pricing`, retrievedN: 7, topCompeting: [{ url: 'https://globex.example/pricing', host: 'globex.example', n: 4 }] }] },
      sources: { types: [{ type: 'editorial', n: 30, share: 40 }, { type: 'rival', n: 20, share: 27 }, { type: 'ugc', n: 15, share: 20 }, { type: 'own', n: 10, share: 13 }], domains: [{ host: 'reddit.com', type: 'ugc', citedN: 12, share: 16, firstSeen: '2026-08-01', lastSeen: '2026-10-19', halfLifeDays: 21 }, { host: 'g2.com', type: 'directory', citedN: 9, share: 12, firstSeen: '2026-07-11', lastSeen: '2026-10-19', halfLifeDays: null }], n: 75 },
      shopping: { status: 'no shopping results', triggerRate: null, triggerN: 0, answersN: 150, productsN: 0, ownPresenceRate: null, ownAvgPosition: null, merchants: [], byEngine: [] },
      adsLocal: { ads: { seenN: 3, answersN: 150, advertisers: [{ name: 'Initech ERP', host: 'initech.example', n: 3 }] }, local: null },
      ci: { method: 'question-bootstrap', headline: { named_rate: { lo: 13, hi: 24, nAnswers: 300, nQuestions: 50, deff: 1.8 } }, note: 'answers to one question move together' },
      sov: { set: ['acme-erp.example', 'globex.example'], othersShare: 22, byEntity: [{ id: 'acme-erp.example', name: 'acme-erp.example', share: 27, n: 40, position: 1.6 }, { id: 'globex.example', name: 'globex.example', share: 21, n: 22, position: 2.4 }], denominators: { allAnswers: 300, answersNamingAnyBrand: 190 }, namedOfBrandedRate: 28 },
      sentiment: { withheld: false, net: 34, netLo: 12, netHi: 52, n: 41, byAspect: [{ aspect: 'support', pos: 9, neg: 2, neu: 4, net: 47, n: 15 }, { aspect: 'price', pos: 3, neg: 5, neu: 2, net: -20, n: 10 }], byRival: [], objections: ['Seen as expensive for small firms'], method: 'every answer naming you, 3 classes', kappa: 0.74 },
      impact: [{ actionId: 'a1', kind: 'answer page', targetQuestions: ['q0'], controlQuestions: ['q4', 'q5', 'q6'], before: { rate: 8, n: 60 }, after: { rate: 19, n: 62 }, did: { effect: 9.4, lo: 1.2, hi: 17.5 }, verdict: 'likely helped', windowDays: 28 }],
      rules: [{ ruleId: 'r1', fired: false, metric: 'named_rate', scope: { engine: 'chatgpt' }, delta: -2, test: 'two-proportion z-test, not significant', reason: 'within noise' }],
      fanoutGap: { queries: [{ query: 'erp partner dubai retail', freq: 9, engines: ['chatgpt'], ourRank: 2, ourUrl: `https://${D}/erp-retail`, targetUrl: null, topDomains: ['acme-erp.example'], cited: false }, { query: 'erp cost uae', freq: 6, engines: ['chatgpt', 'perplexity'], ourRank: null, ourUrl: null, targetUrl: `https://${D}/erp-cost`, topDomains: ['globex.example', 'g2.com'], cited: false }], checkedN: 25 },
      demand: null, imports: null, notes: null, personaEffect: [{ role: 'CFO', withRate: 22, withN: 30, withoutRate: 15, withoutN: 30, delta: 7, lo: -1, hi: 15, significant: false }], execIds: [],
    },
  },
};
const detail = { answerText: 'For a retailer in Dubai, Acme ERP and Demo ERP are the most cited partners. Acme ERP is the larger firm, while Demo ERP focuses on retail rollouts with fixed-price packages. Globex is an option for distributors. Ask each for references in your sector and for their e-invoicing plan.', answerCut: false, answerExpired: false, answerLen: 300, citations: [{ url: 'https://acme-erp.example/retail', host: 'acme-erp.example', entityId: 'acme', role: 'competitor', position: 1, own: false }, { url: `https://${D}/erp-retail`, host: D, entityId: 'self', role: 'self', position: 2, own: true }, { url: 'https://reddit.com/r/erp/x', host: 'reddit.com', entityId: '', role: 'source', position: 3, own: false }], retrieved: [{ url: `https://${D}/pricing`, host: D, entityId: 'self', own: true }], fanoutQueries: ['erp partner dubai retail', 'best erp retail uae'], products: [], ads: null, local: null, model: 'gpt-5' };
const ans = (i, e) => ({ promptId: `q${i}`, prompt: prompts[i].prompt, kind: 'custom', topic: 'erp', engine: e, answered: true, mentioned: i % 2 === 0, cited: i === 0, rank: 2, ourUrls: [], competitors: ['Acme ERP'], sources: ['reddit.com'], excerpt: 'excerpt', error: '', checkedAt: '2026-10-19T07:12:00.000Z', runKind: 'weekly', sentiment: i % 2 ? '' : 'positive', brands: [], issues: [], fanout: [], citedUrls: [], position: i % 2 === 0 ? 2 : null, entities: [{ id: 'acme', name: 'Acme ERP', role: 'competitor', position: 1, cited: true }, { id: 'self', name: 'Demo ERP', role: 'self', position: 2, cited: i === 0 }, { id: 'reddit', name: 'Reddit', role: 'platform', position: 3, cited: false }], detail, cluster: 'erp', persona: 'CFO', market: 'AE-en', stage: 'decision' });
const answersPage = { runId: 'ai_3', checkedAt: now, runs: runs.map((r) => ({ runId: r.runId, checkedAt: r.checkedAt })).reverse(), total: 24, page: 1, pageSize: 12, items: [ans(0, 'chatgpt'), ans(1, 'perplexity'), ans(2, 'gemini')], summary: { answers: 24, answered: 24, named: 6, cited: 2, namedRate: 25, citedRate: 8.3, namedCi: [12, 44.9], citedCi: [2.3, 25.8], enough: true, questions: 8, topRivals: [{ name: 'Acme ERP', n: 18 }], topSources: [] }, engines: ['chatgpt', 'gemini', 'perplexity'] };
const imports = { sources: [{ source: 'bing_ai', rows: 120, from: '2026-07-20', to: '2026-10-19', citations: 84, impressions: 0, clicks: 0, importedAt: now, fileName: 'bing.csv' }] };

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
  if (p.endsWith('/data/ai')) return json(route, u.searchParams.get('persona') ? { ...ai, scope: { filter: { engine: '', cluster: '', persona: 'CFO', market: '', stage: '', from: '', to: '' }, segment: { dim: 'persona', key: 'CFO' }, summary: answersPage.summary, trend: runs.map((r, i) => ({ runId: r.runId, checkedAt: r.checkedAt, rate: 12 + i * 3, ci: [6 + i * 3, 20 + i * 3], n: 60, enough: true, comparable: i !== 2, reason: i === 2 ? 'a different panel' : null })), note: "The segment's rate in each run is the engine's own count for that segment." } } : ai);
  if (p.endsWith('/data/ai/answers')) return json(route, answersPage);
  if (p.endsWith('/data/ai/imports')) return json(route, imports);
  if (p.includes('/data/ai/questions/')) return json(route, { promptId: 'q0', prompt: prompts[0].prompt, facets: { cluster: 'erp', persona: 'IT manager', market: 'AE-en', stage: 'decision', keyword: 'erp partner dubai' }, runs: [{ runId: 'ai_3', checkedAt: now, answers: [ans(0, 'chatgpt'), ans(0, 'gemini'), ans(0, 'perplexity')] }], series: runs.map((r, i) => ({ runId: r.runId, checkedAt: r.checkedAt, n: 6, named: 2 + (i % 2), cited: 1, namedRate: 33 + i * 5, ci: [10, 70] })), note: 'One question is a handful of answers a run.' });
  unknown.add(p);
  return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not in the fixtures"}' });
}

const browser = await chromium.launch();
const errs = [];
for (const [size, vp] of Object.entries({ desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } }))
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: vp, colorScheme: theme, reducedMotion: 'reduce' });
    await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(`${size}/${theme}: ${m.text().slice(0, 160)}`); });
    page.on('pageerror', (e) => errs.push(`${size}/${theme} pageerror: ${String(e).slice(0, 200)}`));
    await page.route('**/api/**', api);
    await page.goto(`http://localhost:5180/o/${ORG}/sites/${SITE}/ai`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await page.screenshot({ path: `${OUT}/ai-${size}-${theme}.png`, fullPage: true });
    console.log(`${size}/${theme}: horizontal overflow ${overflow}px`);
    if (size === 'desktop' && theme === 'light') {
      await page.goto(`http://localhost:5180/o/${ORG}/sites/${SITE}/ai?persona=CFO`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/ai-filtered-desktop-light.png`, fullPage: false });
      const btn = page.getByRole('button', { name: 'Every engine and its history' }).first();
      if (await btn.count()) { await btn.click(); await page.waitForTimeout(600); await page.screenshot({ path: `${OUT}/ai-question-dialog.png` }); }
    }
    await ctx.close();
  }
await browser.close();
srv.close();
console.log('unknown api paths:', [...unknown].join(' '));
console.log('console errors:', errs.length ? '\n' + [...new Set(errs)].join('\n') : 'none');
