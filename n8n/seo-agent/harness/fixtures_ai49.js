// Fixtures for AI visibility v4.9 (S19, S27). Engine answers start from the REAL responses captured on 2026-10-02 (fixtures_live/*.json, via
// fixtures_monitors.js); the new endpoints use the response shapes returned by DataForSEO's free sandbox on 2026-10-08 (fixtures_live/sandbox_v49.json:
// Gemini LLM scraper, LLM Mentions search_mentions / multi_target_metrics / top_mentioned_domains, AI Keyword Data) with this client's values.
// GA4 Data API, robots.txt / CDN responses and the Answer Analyst's output are written to the documented formats.
const fs = require('fs'); const path = require('path');
const M = require('./fixtures_monitors'); const { SITE, DOMAIN } = M;
const clone = (o) => JSON.parse(JSON.stringify(o));
const SB = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures_live', 'sandbox_v49.json'), 'utf8'));
const sb = (p) => clone(SB['ai_optimization/' + p]);
const ok = (d, cost) => { d.tasks[0].status_code = 20000; d.tasks[0].cost = cost; return d; };
// ---- engines ----
const chatgpt = (withUs) => { const d = M.scraper(withUs); const r = d.tasks[0].result[0];
  r.markdown = r.markdown + '\n\nFor small firms, **Zoho Books** also handles UAE e-invoicing.';
  r.brand_entities = [{ type: 'chat_gpt_brand_entity', title: 'Azentio Software', category: 'company' }, ...(withUs ? [{ type: 'chat_gpt_brand_entity', title: 'Northwind ERP', category: 'company' }] : []), { type: 'chat_gpt_brand_entity', title: 'ClearTax', category: 'company' }, { type: 'chat_gpt_brand_entity', title: 'Zoho Books', category: 'software' }];
  return d; };
const gemini = (withUs) => { const d = ok(sb('gemini/llm_scraper/live/advanced'), 0.004); const r = d.tasks[0].result[0];
  const md = 'Here are e-invoicing partners in the UAE:\n\n1. **Azentio** — accredited service provider ([azentio.com](https://www.azentio.com/))\n2. **EDICOM** — Peppol access point ([edicomgroup.com](https://www.edicomgroup.com/))\n' + (withUs ? '3. **Northwind ERP** — Odoo partner for distributors ([northwind-erp.com](https://northwind-erp.com/e-invoicing-uae/))\n' : '') + '\nThe Ministry of Finance keeps the official list.';
  r.keyword = 'e-invoicing partners uae'; r.location_code = 2784; r.markdown = md; r.model = '3.5 Flash';
  r.sources = [{ type: 'gemini_source', title: 'Accredited service providers', domain: 'mof.gov.ae', url: 'https://mof.gov.ae/en/about-us/initiatives/einvoicing/' }, { type: 'gemini_source', title: 'Azentio', domain: 'www.azentio.com', url: 'https://www.azentio.com/e-invoicing' }, ...(withUs ? [{ type: 'gemini_source', title: 'E-invoicing in the UAE', domain: 'northwind-erp.com', url: 'https://northwind-erp.com/e-invoicing-uae/' }] : [])];
  r.items = [{ type: 'gemini_text', rank_group: 1, rank_absolute: 1, markdown: md, original_text: md, sources: [] }]; return d; };
// ---- the AI-answer database (LLM Mentions) and AI search volume ----
const discovery = () => { const d = ok(sb('llm_mentions/search_mentions/live'), 0.14); const r = d.tasks[0].result[0]; const base = r.items[0];
  r.total_count = 412; r.items = [['which companies provide e invoicing services in the uae', 1300, ['Azentio', 'EDICOM']], ['e invoicing uae deadline for small businesses', 880, []], ['best e invoicing software uae for distributors', 320, ['Zoho Books', 'ClearTax']], ['what is peppol e invoicing in uae', 210, []], ['tbms', 9000, []]]
    .map(([q, v, b]) => ({ ...base, platform: 'google', model_name: 'google_ai_overview', location_code: 2784, question: q, ai_search_volume: v, brand_entities: b.map(t => ({ title: t })), sources: [{ domain: 'mof.gov.ae', url: 'https://mof.gov.ae/x' }, ...(v === 320 ? [{ domain: DOMAIN, url: 'https://northwind-erp.com/e-invoicing-uae/' }] : [])] }));
  return d; };
const volume = (keywords) => { const d = ok(sb('ai_keyword_data/keywords_search_volume/live'), 0.01 + 0.0001 * keywords.length); const r = d.tasks[0].result[0]; r.location_code = 2784;
  r.items = keywords.map((k, i) => ({ keyword: k, ai_search_volume: [880, 320, 140, 90, 1300, 210][i % 6], ai_monthly_searches: [] })); r.items_count = r.items.length; return d; };
const indexSov = (targets) => { const d = ok(sb('llm_mentions/multi_target_metrics/live'), 0.11); const r = d.tasks[0].result[0]; const tpl = r.items[0];
  const val = { [DOMAIN]: [37, 5400], 'azentio.com': [410, 61000], 'cleartax.com': [260, 38000] };
  r.items = targets.map(t => { const [m, v] = val[t.key] || (t.key.startsWith('name:') ? [52, 7000] : [120, 15000]); return { ...tpl, key: t.key, total: { mentions: m, ai_search_volume: v }, location: [{ key: 2784, mentions: m, ai_search_volume: v }], platform: [{ key: 'google', mentions: m, ai_search_volume: v }] }; });
  r.total_count = r.items.length; r.items_count = r.items.length; return d; };
const indexYou = () => { const d = ok(sb('llm_mentions/search_mentions/live'), 0.12); const r = d.tasks[0].result[0]; const base = r.items[0];
  r.total_count = 37; r.items = [['e invoicing uae for distributors', 260], ['odoo e invoicing uae', 140], ['how to prepare for e invoicing uae', 90]].map(([q, v]) => ({ ...base, platform: 'google', model_name: 'google_ai_overview', location_code: 2784, question: q, ai_search_volume: v, sources: [{ domain: DOMAIN, url: 'https://northwind-erp.com/e-invoicing-uae/' }, { domain: 'mof.gov.ae', url: 'https://mof.gov.ae/x' }] }));
  return d; };
const market = () => { const d = ok(sb('llm_mentions/top_mentioned_domains/live'), 0.115); const r = d.tasks[0].result[0]; const tpl = r.items[0];
  r.items = [['mof.gov.ae', 128, 80230], ['azentio.com', 64, 21000], ['cleartax.com', 40, 15000], ['www.youtube.com', 31, 9000], [DOMAIN, 6, 1200]].map(([dm, m, v]) => ({ ...tpl, domain: dm, total: { mentions: m, ai_search_volume: v }, location: [{ key: 2784, mentions: m, ai_search_volume: v }] }));
  r.aggregated_metrics.total = { mentions: 2210, ai_search_volume: 310000 }; return d; };
const answerFor = (req, i, o = {}) => { const e = req.engine; const us = !!(o.us && o.us(req, i));
  if (o.fail && o.fail(req, i)) return M.answerFor(req, i, { fail: () => true });
  if (e === 'market') return market(); if (e === 'index_sov') return indexSov(req.body[0].targets); if (e === 'index_you') return indexYou();
  if (e === 'chatgpt') return chatgpt(us); if (e === 'gemini') return gemini(us);
  return M.answerFor(req, i, { ...o, us: () => us }); };
const discoveryFor = (req) => req.kind === 'volume' ? volume(req.body[0].keywords) : discovery();
// ---- GA4 Data API (runReport) ----
const ga = (dims, mets, rows) => ({ dimensionHeaders: dims.map(name => ({ name })), metricHeaders: mets.map(name => ({ name, type: 'TYPE_INTEGER' })), rows: rows.map(r => ({ dimensionValues: r[0].map(value => ({ value })), metricValues: r[1].map(v => ({ value: String(v) })) })), rowCount: rows.length });
const MET = ['sessions', 'engagedSessions', 'keyEvents', 'totalRevenue', 'totalUsers'];
const ga4 = (kind) => {
  if (kind === 'ai_sources') return ga(['sessionSource', 'sessionMedium', 'dateRange'], MET, [[['chatgpt.com', 'referral', 'current'], [120, 74, 9, 0, 101]], [['perplexity.ai', 'referral', 'current'], [25, 15, 2, 0, 22]], [['gemini.google.com', 'referral', 'current'], [14, 8, 1, 0, 12]], [['copilot.microsoft.com', 'ai-assistant', 'current'], [4, 2, 0, 0, 4]],
    [['chatgpt.com', 'referral', 'previous'], [90, 52, 6, 0, 80]], [['perplexity.ai', 'referral', 'previous'], [30, 18, 2, 0, 27]]]);
  if (kind === 'ai_landing') return ga(['landingPage'], MET, [[['/e-invoicing-uae/'], [80, 50, 7, 0, 70]], [['/'], [48, 25, 3, 0, 44]], [['/services/odoo/'], [35, 24, 2, 0, 30]]]);
  if (kind === 'ai_daily') { const rows = []; for (let k = 0; k < 84; k++) { const t = new Date(Date.UTC(2026, 6, 15) + k * 864e5); rows.push([[t.toISOString().slice(0, 10).replace(/-/g, '')], [3 + (k % 5), 2, k % 9 === 0 ? 1 : 0, 0, 3]]); } return ga(['date'], MET, rows); }
  return ga(['sessionDefaultChannelGroup', 'dateRange'], MET, [[['Organic Search', 'current'], [2400, 1500, 60, 0, 2000]], [['Direct', 'current'], [900, 500, 20, 0, 800]], [['Referral', 'current'], [300, 160, 5, 0, 260]], [['Organic Search', 'previous'], [2300, 1450, 55, 0, 1900]]]);
};
const ga4Denied = () => ({ error: { code: 403, message: 'User does not have sufficient permissions for this property.', status: 'PERMISSION_DENIED' } });
// ---- robots.txt, llms.txt and the homepage as a browser / as AI fetchers ----
const ROBOTS = 'User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\n\n# training opt-out\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: PerplexityBot\nDisallow: /uae-e-invoicing-penalties/\n\nSitemap: https://northwind-erp.com/sitemap.xml\n';
const ROBOTS_BLOCK = 'User-agent: *\nAllow: /\n\nUser-agent: OAI-SearchBot\nUser-agent: ChatGPT-User\nDisallow: /\n';
const HOME = '<!doctype html><html><head><title>Northwind ERP</title></head><body>' + 'Odoo and Business Central partner in Dubai. '.repeat(200) + '</body></html>';
const accessFor = (req, o = {}) => {
  if (req.kind === 'robots') return { statusCode: 200, headers: { 'content-type': 'text/plain' }, data: o.robots || ROBOTS };
  if (req.kind === 'llms') return o.llms ? { statusCode: 200, headers: {}, data: '# Northwind ERP\n> Odoo partner in Dubai\n\n- [E-invoicing](https://northwind-erp.com/e-invoicing-uae/)\n' } : { statusCode: 404, headers: {}, data: '<html><body>Not found</body></html>' };
  if (req.bot === 'PerplexityBot' && !o.noCdnBlock) return { statusCode: 403, headers: { 'cf-mitigated': 'challenge', server: 'cloudflare' }, data: '<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>cf-chl</body></html>' };
  return { statusCode: 200, headers: { server: 'cloudflare' }, data: HOME };
};
// ---- Answer Analyst (Claude): reads the job text; names Northwind first where the answer names it ----
const analystFor = (job, o = {}) => { const parts = String(job.answers).split(/\n\nANSWER \d+ /);
  return { output: { answers: job.ids.map((id, k) => { const t = (parts[k] || '').toLowerCase(); const us = /northwind/.test(t);
    return { n: k + 1, brands: [{ name: 'Azentio Software', domain: 'azentio.com' }, ...(us ? [{ name: 'Northwind ERP', domain: DOMAIN }] : []), { name: 'Zoho Books', domain: o.zohoDomain ? 'zoho.com' : '' }, { name: 'EDICOM', domain: 'edicomgroup.com' }],
      sentiment: us ? (k === 1 && o.negative ? 'negative' : 'positive') : 'not_mentioned', why: us ? 'listed as an Odoo partner' : '', wrong: us && k === 0 ? [{ claim: 'Northwind ERP is based in Abu Dhabi', correct: 'Dubai' }] : [] }; }), descriptors: ['Odoo partner', 'UAE-based', 'distributor specialist'] } }; };
// ---- prompt panel stored after the first run (with stage / cluster / volume) and pulse baselines ----
const promptRows = (rows) => rows.map(r => ({ json: { ...r.json, volume: r.json.volume == null ? 500 : r.json.volume } }));
const dailyRow = (date, o = {}) => ({ json: { site_id: SITE, domain: DOMAIN, date, checked_at: date + 'T06:31:00.000Z', run_id: 'pulse_' + date.replace(/-/g, '') + '_northwind-erp-com', samples: o.samples || 18, mentioned: o.mentioned != null ? o.mentioned : 11, cited: o.cited || 4,
  mention_rate: Math.round(1000 * (o.mentioned != null ? o.mentioned : 11) / (o.samples || 18)) / 10, citation_rate: 22.2, share_of_voice: 30, visibility_score: o.vis || 41,
  engines_json: JSON.stringify(o.engines || { chatgpt: { answered: 6, mentioned: 4, cited: 2 }, gemini: { answered: 6, mentioned: 4, cited: 1 }, ai_mode: { answered: 6, mentioned: 3, cited: 1 } }),
  prompts_json: JSON.stringify(o.prompts || {}), competitors_json: JSON.stringify(o.competitors || { 'azentio.com': 9, 'cleartax.com': 5 }), sources_json: JSON.stringify({ 'mof.gov.ae': 10, 'zawya.com': 3 }), alerts: '', cost_usd: 0.072 } });
module.exports = { answerFor, discoveryFor, ga4, ga4Denied, accessFor, analystFor, promptRows, dailyRow, ROBOTS, ROBOTS_BLOCK, chatgpt, gemini };
