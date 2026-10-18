/**
 * G6 browser pass — the AI visibility page with a 500-question panel (segments with ranges, the panel manager, the CSV import) and the
 * panel settings (size, buyer roles, markets, pulse sampling, cost before saving), driven by a real Chromium against a throwaway stack
 * (g6-*: own Postgres, the n8n stand-in `stub_n8n.py`, the API serving the built web app on :4000). Run inside the API container's
 * network namespace:
 *   docker run --rm --network container:g6-api -v <app>/scripts:/bp:ro -v <state>:/state -v <app>/docs/browser-pass/g6:/out \
 *     -w /state mcr.microsoft.com/playwright:v1.55.0-noble node /bp/g6_browser_pass.mjs <setup|seed|shots>
 * Between `setup` and `seed` the caller marks the website verified in the throwaway database (no real domain exists here). `seed`
 * writes the engine's rows for that website into the stand-in (a 500-question panel, the latest weekly run with its segments and
 * panel, answers, the monitor settings) — the same shapes n8n writes, nothing from a real customer.
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const APP = 'http://localhost:4000';
const STUB = process.env.STUB || 'http://g6-stub:8099';
const OUT = '/out';
const STATE = '/state/g6.json';
const PW = 'browser-pass-1234';
const DOMAIN = 'g6-demo.example-shop.com';
const SIZES = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
const phase = process.argv[2];
mkdirSync(OUT, { recursive: true });
const read = () => { try { return JSON.parse(readFileSync(STATE, 'utf8')); } catch { return {}; } };
const save = (o) => writeFileSync(STATE, JSON.stringify({ ...read(), ...o }, null, 2));

const CONTRAST = `() => {
  const lum = (c) => { const [r,g,b] = c.map(v => { v/=255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }); return 0.2126*r + 0.7152*g + 0.0722*b; };
  const rgb = (s) => { const m = String(s).match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { c: p.slice(0,3), a: p.length > 3 ? p[3] : 1 }; };
  const bgOf = (el) => { let n = el; while (n && n !== document.documentElement) { const v = rgb(getComputedStyle(n).backgroundColor); if (v && v.a > 0.9) return v.c; n = n.parentElement; } const b = rgb(getComputedStyle(document.body).backgroundColor); return b ? b.c : [255,255,255]; };
  const out = [];
  for (const el of document.querySelectorAll('p,span,a,h1,h2,h3,h4,dt,dd,li,label,button,td,th,div,code,legend,option')) {
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
async function visit(page, { name, url, size, theme, after }) {
  const errors = [], failed = [];
  const onConsole = (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); };
  const onFailed = (r) => { if (r.failure()?.errorText !== 'net::ERR_ABORTED') failed.push(`${r.url().slice(0, 140)} — ${r.failure()?.errorText ?? ''}`); };
  const onResponse = (r) => { if (r.status() >= 400) failed.push(`${r.url().slice(0, 140)} — HTTP ${r.status()}`); };
  page.on('console', onConsole); page.on('requestfailed', onFailed); page.on('response', onResponse);
  if (url) await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(800);
  let note = '';
  if (after) note = (await after(page)) || '';
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  // what sticks out, when something does (the deepest elements past the viewport's right edge)
  const wide = overflow > 1 ? await page.evaluate(() => { const W = document.documentElement.clientWidth; return [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.right > W + 1 && r.width > 0 && ![...e.children].some((c) => c.getBoundingClientRect().right > W + 1); }).slice(0, 5).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 60)} "${(e.textContent || '').trim().slice(0, 40)}" ${Math.round(e.getBoundingClientRect().right)}`); }) : [];
  const h1 = await page.locator('h1').count();
  const contrast = await page.evaluate(`(${CONTRAST})()`);
  const file = `${name}-${size}-${theme}.png`;
  // the part of the page this pass is about, not the whole (a 500-question page is 8,000 px long): what the `after` step scrolled to
  await page.screenshot({ path: `${OUT}/${file}`, fullPage: false });
  page.off('console', onConsole); page.off('requestfailed', onFailed); page.off('response', onResponse);
  const row = { name, size, theme, url: page.url(), consoleErrors: errors, failedRequests: failed, overflowPx: Math.max(0, overflow), wide, h1, contrast, note, shot: file };
  results.push(row);
  const bad = errors.length || failed.length || overflow > 1 || !h1 || contrast.length;
  console.log(`${bad ? 'CHECK' : 'ok   '} ${name} ${size}/${theme}${note ? ' — ' + note : ''}${bad ? ` ${JSON.stringify({ errors, failed, overflow, wide, h1, contrast })}` : ''}`);
  return row;
}
const api = async (page, base, method, path, data, headers = {}) => {
  const r = await page.request.fetch(base + path, { method, data, headers: { 'x-requested-with': 'fetch', ...headers } });
  const t = await r.text(); let body; try { body = JSON.parse(t); } catch { body = t; }
  if (r.status() >= 400) throw new Error(`${method} ${path} → ${r.status()} ${t.slice(0, 200)}`);
  return body;
};

async function setup() {
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  await api(page, APP, 'POST', '/api/auth/signup', { name: 'Maya Haddad', email: 'maya@g6-demo.example-shop.com', password: PW });
  const org = await api(page, APP, 'POST', '/api/orgs', { name: 'Gulf Ledger Demo', industry: 'Software' });
  await api(page, APP, 'PATCH', `/api/orgs/${org.id}/onboarding`, { step: 'done', done: true });
  const site = await api(page, APP, 'POST', `/api/orgs/${org.id}/sites`, { domain: DOMAIN, country: 'United Arab Emirates', business: 'Accounting and ERP software for SMEs' });
  save({ org: org.id, site: site.id, results: [] });
  console.log(JSON.stringify({ org: org.id, site: site.id }));
  await browser.close();
}

// ------------------------------------------------------------------ seed: the engine's rows for the website, in the stand-in
async function seed() {
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  const tables = (await (await page.request.get(`${STUB}/api/v1/data-tables`)).json()).data;
  const id = (n) => tables.find((t) => t.name === n).id;
  const put = async (table, rows) => { for (let i = 0; i < rows.length; i += 200) await page.request.post(`${STUB}/api/v1/data-tables/${id(table)}/rows`, { data: { data: rows.slice(i, i + 200) } }); };
  const site_id = 'site_' + DOMAIN.replace(/[^a-z0-9]+/g, '-');
  const now = new Date().toISOString();
  const CL = ['payroll software', 'erp implementation', 'vat returns', 'corporate tax', 'inventory management', 'expense management', 'procurement automation', 'business intelligence', 'cloud accounting', 'audit readiness'];
  const PE = ['CFO', 'Finance manager', 'IT manager', 'Founder'];
  const MK = ['AE-en', 'SA-en', 'QA-en'];
  const prompts = [];
  for (let i = 0; i < 499; i++) {
    const c = CL[i % 10], p = PE[Math.floor(i / 10) % 4], m = i < 420 ? MK[i % 2] : MK[2];
    prompts.push({ prompt_id: 'p_g6_' + i, site_id, domain: DOMAIN, prompt: `As a ${p.toLowerCase()} in ${m === 'AE-en' ? 'the UAE' : m === 'SA-en' ? 'Saudi Arabia' : 'Qatar'}, which ${c} providers should I shortlist? (${i})`, kind: 'recommend', topic: c, keyword: c + ' ' + i,
      source: i % 50 === 0 ? 'custom' : 'auto', status: i % 97 === 5 ? 'off' : 'active', created_at: now, stage: ['awareness', 'consideration', 'decision'][i % 3], cluster: c, volume: (i * 37) % 900,
      origin: ['market', 'search', 'paa', 'competitor', 'writer'][i % 5], updated_at: now, persona: p, market: m, pinned: i % 61 === 0, fit_note: '' });
  }
  prompts.push({ prompt_id: 'p_g6_refused', site_id, domain: DOMAIN, prompt: 'Is RivalBooks the best accounting software in Dubai?', kind: 'compare', topic: 'cloud accounting', keyword: 'rivalbooks dubai', source: 'auto', status: 'refused', created_at: now,
    stage: 'decision', cluster: 'cloud accounting', volume: null, origin: 'writer', updated_at: now, persona: 'CFO', market: 'AE-en', pinned: false, fit_note: '"Is RivalBooks the best accounting software in Dubai?" was not added: names a competitor: rivalbooks (rivalbooks.com) (other brand)' });
  await put('seo_ai_prompts', prompts);
  await put('seo_monitors', [{ site_id, domain: DOMAIN, ai_visibility: true, ai_engines: 'chatgpt, perplexity, gemini, claude, ai_overview, ai_mode', ai_prompts_max: 500, backlinks: true, audit_monthly: true, audit_pages: 200, audit_js: false,
    competitors: 'rivalbooks.com', brand_names: 'Gulf Ledger', updated_at: now, request_id: '', ai_pulse: true, ai_personas: PE.join(', '), ai_markets: 'SA-en, QA-en', ai_pulse_mode: '', ai_pulse_per_week: null }]);
  // the latest weekly run: segments as the engine stores them (compact), the panel record
  const seg = [];
  const rate = (i) => [6, 11, 18, 24, 9, 31, 14, 3, 21, 12][i % 10];
  const row = (dim, key, q, n, pct, delta = null, sig = null, leader = 'rivalbooks.com') => seg.push([dim, key, q, n, Math.round(n * pct / 100), Math.round(n * pct / 300), Math.round(pct * 0.7 * 10) / 10, leader, Math.round(n * 0.4), delta, sig]);
  CL.forEach((c, i) => row('cluster', c, 50, 250 + i * 5, rate(i), i === 1 ? -14.2 : i === 5 ? 9.8 : 1.1, i === 1 || i === 5 ? true : false));
  PE.forEach((p, i) => row('persona', p.toLowerCase(), 125, 620, [8, 15, 22, 12][i], 0.8, false));
  row('market', 'AE-en', 210, 1050, 16, 0.5, false); row('market', 'SA-en', 210, 1050, 9, -1.2, false); row('market', 'QA-en', 79, 10, 10, null, null, '');
  ['chatgpt', 'gemini', 'perplexity', 'ai_overview', 'ai_mode'].forEach((e, i) => row('engine', e, 499, 499 + (i < 2 || i === 4 ? 1497 : 0), [14, 9, 21, 4, 12][i], 0.4, false));
  ['awareness', 'consideration', 'decision'].forEach((s, i) => row('stage', s, 166, 830, [7, 13, 19][i], null, null));
  const segments_json = JSON.stringify({ v: 1, cols: ['dim', 'key', 'questions', 'n', 'k', 'cited', 'sov', 'leader', 'pulse_n', 'delta', 'significant'], rows: seg, min_answers: 12,
    family: { method: 'benjamini-hochberg', q: 0.1, tests: 24, rejected: 2, note: '24 segment changes were tested together, at a 10% false discovery rate (Benjamini-Hochberg: of the moves called real, about 1 in 10 at most may be noise); 2 cleared it. The headline alerts are judged separately, Holm-adjusted, because each one interrupts you.' },
    moves: [{ dim: 'cluster', key: 'erp implementation', rate: 11, delta: -14.2, n: 255 }, { dim: 'cluster', key: 'expense management', rate: 31, delta: 9.8, n: 275 }] });
  const panel_json = JSON.stringify({ ids: prompts.map((p) => p.prompt_id), size: 494, setting: 500, engines: ['ai_mode', 'ai_overview', 'chatgpt', 'gemini', 'perplexity'],
    composition: { cluster: Object.fromEntries(CL.map((c) => [c, 50])), persona: Object.fromEntries(PE.map((p) => [p.toLowerCase(), 125])), market: { 'AE-en': 210, 'SA-en': 210, 'QA-en': 79 }, stage: { awareness: 166, consideration: 166, decision: 167 } },
    overlap_with_previous: { share: 0.96, same: true, common: 474 }, half_width: { measured: { headline: 1.1, headline_answers: 5487, median_cluster: 5.8, median_cluster_answers: 260 }, achievable: { headline: 1.2, cluster: 7.5, per_week: 3 } }, executions: 5 });
  const engines = Object.fromEntries(['chatgpt', 'gemini', 'perplexity', 'claude', 'ai_overview', 'ai_mode'].map((e, i) => [e, { name: e, asked: 499, answered: 480, samples: 480 + (i < 2 || i === 5 ? 1497 : 0), mentioned: 70, cited: 22, mention_rate: 14.6, citation_rate: 4.6, ci: [12.1, 17.4], errors: 2, knows_brand: true, pulse_samples: i < 2 || i === 5 ? 1497 : 0 }]));
  const runs = [14, 7, 0].map((d, i) => ({ site_id, domain: DOMAIN, run_id: 'ai_g6_' + i, checked_at: new Date(Date.now() - d * 864e5).toISOString(), prompts: 494, answers: 5487, mention_rate: [12.2, 13.5, 14.1][i], citation_rate: 4.4, share_of_voice: 18.3,
    avg_rank: 3.1, aio_presence: 61, aio_citation_rate: 6, engines_json: JSON.stringify(engines), competitors_json: JSON.stringify([{ domain: 'rivalbooks.com', mentions: 900, share: 41, auto: false }]), sources_json: '[]', pages_json: '[]', gaps_json: '[]',
    market_json: '', market_month: '', cost_usd: 10.42, alerts: '', run_kind: i === 0 ? 'full' : 'weekly', samples: 5487, visibility_score: 22.5, mention_lo: 13.2, mention_hi: 15.0, sentiment_score: 12, accuracy_issues: null, ai_sessions: null, ai_conversions: null,
    ai_revenue: null, index_sov: null, ai_impressions: null, perception_json: '', traffic_json: '', access_json: '', index_json: JSON.stringify({ suggestions: [{ question: 'Which payroll software do Dubai SMEs use for WPS?', volume: 1900, platform: 'google', you_cited: false }, { question: 'What does ERP implementation cost in Saudi Arabia?', volume: 880, platform: 'google', you_cited: false }] }),
    clusters_json: '{}', rival_sources_json: '[]', segments_json: i === 2 ? segments_json : '', panel_json: i === 2 ? panel_json : '', chunks: 5 }));
  await put('seo_ai_visibility', runs);
  const answers = [];
  for (let i = 0; i < 300; i++) { const p = prompts[i]; for (const e of ['chatgpt', 'gemini']) answers.push({ site_id, domain: DOMAIN, run_id: 'ai_g6_2', checked_at: runs[2].checked_at, prompt_id: p.prompt_id, prompt: p.prompt, kind: p.kind, topic: p.topic, engine: e,
    answered: true, mentioned: i % 6 === 0, cited: i % 18 === 0, rank: i % 6 === 0 ? 2 : 0, our_urls: '', competitors: 'rivalbooks.com', sources: 'mof.gov.ae', excerpt: 'Popular options include RivalBooks and others.', cost: 0.004, error: '', run_kind: 'weekly', sentiment: '', brands: 'RivalBooks', issues: '', fanout: '', cited_urls: '' }); }
  await put('seo_ai_answers', answers);
  console.log('seeded', prompts.length, 'prompts,', runs.length, 'runs,', answers.length, 'answers');
  await browser.close();
}

async function shots() {
  const s = read();
  const browser = await chromium.launch();
  for (const theme of ['light', 'dark']) for (const size of ['desktop', 'phone']) {
    const ctx = await browser.newContext({ viewport: SIZES[size], colorScheme: theme });
    const page = await ctx.newPage();
    await api(page, APP, 'POST', '/api/auth/login', { email: 'maya@g6-demo.example-shop.com', password: PW });
    const base = `${APP}/o/${s.org}/sites/${s.site}`;
    await visit(page, { name: 'ai-visibility', url: `${base}/ai`, size, theme, after: async (p) => {
      await p.getByText('By topic, buyer role and market').first().scrollIntoViewIfNeeded();
      await p.evaluate(() => window.scrollBy(0, -80));
      const segs = await p.getByText('By topic, buyer role and market').count();
      const bars = await p.locator('[aria-label="Named in, with the 95% range"] li').count();
      const tooFew = await p.getByText(/too few answers/).count();
      return `segments panel ${segs}, ${bars} bars, "too few answers" ${tooFew}`;
    } });
    await visit(page, { name: 'ai-visibility-by-role', url: null, size, theme, after: async (p) => {
      await p.getByRole('radio', { name: /Buyer role/ }).first().click();
      await p.waitForTimeout(300);
      await p.getByRole('radio', { name: /Buyer role/ }).first().scrollIntoViewIfNeeded();
      return `${await p.locator('[aria-label="Named in, with the 95% range"] li').count()} buyer-role bars`;
    } });
    await visit(page, { name: 'ai-panel-refused', url: null, size, theme, after: async (p) => {
      await p.getByRole('radio', { name: /Refused/ }).first().click();
      await p.waitForTimeout(300);
      await p.getByRole('radio', { name: /Refused/ }).first().scrollIntoViewIfNeeded();
      await p.evaluate(() => window.scrollBy(0, -60));
      return `refused shown: ${await p.getByText(/was not added: names a competitor/).count()}`;
    } });
    if (size === 'desktop' && theme === 'light') {
      await visit(page, { name: 'ai-panel-csv', url: null, size, theme, after: async (p) => {
        await p.getByRole('radio', { name: /Tracked/ }).first().click();
        const csv = 'question,buyer role,cluster,stage,market,pinned\nWhich payroll providers handle WPS for 200 staff in Dubai?,CFO,payroll software,decision,AE-en,yes\nToo short,,,,,\nWhich ERP partners support Arabic e-invoices?,IT manager,erp implementation,purchase,SA-en,\n';
        await p.locator('input[type=file]').setInputFiles({ name: 'questions.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
        await p.waitForTimeout(400);
        await p.getByText('questions.csv').scrollIntoViewIfNeeded();
        return `csv preview: ${await p.getByText(/1 question ready/).count()} ready, lines named ${await p.getByText(/^Line \d/).count()}`;
      } });
      await visit(page, { name: 'ai-panel-pin', url: null, size, theme, after: async (p) => {
        const btn = p.getByRole('button', { name: /^Pin: / }).first();
        await btn.click();
        await p.waitForTimeout(800);
        const sent = await (await p.request.get(`${STUB}/__publish_checks`)).json();
        const last = (sent.data || []).filter((x) => x.site_admin).pop();
        return `site admin received: ${last ? JSON.stringify({ action: last.site_admin.action, pin: last.site_admin.pin }) : 'nothing'}`;
      } });
    }
    await visit(page, { name: 'settings-ai-panel', url: `${base}/settings/tracking`, size, theme, after: async (p) => {
      const cost = p.getByText(/This panel: \$/).first();
      if (await cost.count()) await cost.scrollIntoViewIfNeeded();
      return `cost box: ${await p.getByText(/This panel: \$/).count()}, buyer roles field: ${await p.getByText('Buyer roles').count()}, pulse sampling: ${await p.getByText('Pulse sampling').count()}`;
    } });
    await ctx.close();
  }
  save({ results });
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}

if (phase === 'setup') await setup();
else if (phase === 'seed') await seed();
else if (phase === 'shots') await shots();
else console.log('phase: setup | seed | shots');
