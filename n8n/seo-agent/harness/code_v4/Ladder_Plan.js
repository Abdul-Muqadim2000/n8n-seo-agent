// Ladder mode: applies the AI relevance screen, assigns keywords to rungs by difficulty, builds one page per topic
// cluster, maps internal links, matches existing pages, estimates the timeline and picks the pages to write now.
const base = $('Parse Verdict').first().json;
const pool = $('Ladder Pool').first().json;
const chunks = $('Ladder Relevance Chunks').all().map(i => i.json);
const outs = $input.all().map(i => i.json);
const head = String(base.keyword || '').toLowerCase().trim();
const domain = String(base.domain || '').toLowerCase();
const pagesNow = Math.min(3, Math.max(1, Number(base.pages_now) || 1));
const parse = (raw) => { if (raw && typeof raw === 'object') return raw; try { return JSON.parse(String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')); } catch (e) { return {}; } };
const INTENTS = ['informational', 'navigational', 'commercial', 'transactional'];
const PAGES = ['Service Page', 'Product Page', 'Landing Page', 'Comparison Page', 'Blog Post', 'Guide', 'FAQ Page', 'Location Page', 'Category Page'];
const defaultPage = (intent) => intent === 'informational' ? 'Guide' : intent === 'transactional' ? 'Landing Page' : 'Service Page';

// ---- AI relevance verdicts ----
const rel = new Map();
outs.forEach((o, i) => {
  const items = (parse(o.output).items) || [];
  const chunk = chunks[i] ? chunks[i].keywords_chunk : [];
  items.forEach((it, j) => {
    const kw = String(it.keyword || (chunk[j] || {}).keyword || '').toLowerCase().trim();
    if (!kw) return;
    rel.set(kw, { relevance: Math.max(0, Math.min(2, Number(it.relevance ?? 1))), intent: String(it.intent || '').toLowerCase(), page_type: it.page_type,
      topic: String(it.topic || '').toLowerCase().replace(/[^\w\s&-]/g, ' ').replace(/\s+/g, ' ').trim() });
  });
});
const RELF = { 2: 1, 1: 0.45, 0: 0 };
const kws = ((pool.research || {}).candidates || []).map(k => {
  const r = rel.get(k.keyword) || { relevance: 1, intent: k.intent, page_type: '', topic: '' };
  const intent = INTENTS.includes(r.intent) ? r.intent : k.intent;
  const page_type = PAGES.includes(r.page_type) ? r.page_type : defaultPage(intent);
  return { ...k, intent, relevance: r.relevance, page_type, topic: r.topic || k.keyword.split(' ').slice(0, 3).join(' '), opportunity: +(k.pre_score * (RELF[r.relevance] ?? 0.45)).toFixed(1) };
}).filter(k => k.relevance > 0 && k.intent !== 'navigational').sort((a, b) => b.opportunity - a.opportunity);

// ---- rung bands by difficulty ----
const kdOf = (k) => k.kd == null ? 35 : k.kd;
const longTail = (k) => k.words >= 3 || (k.words >= 2 && k.volume < 200);
const rungOf = (k) => { const kd = kdOf(k); if (kd <= 25 && k.volume >= 20 && longTail(k)) return 1; if (kd <= 45) return 2; if (kd <= 60) return 3; return 0; };   // 0 = later
const byRung = { 1: [], 2: [], 3: [] }; const later = [];
for (const k of kws) { const r = rungOf(k); if (r) byRung[r].push(k); else later.push(k); }

// ---- existing pages on the site (sitemap tokens or the URL that already ranks) ----
const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'with', 'by', 'at', 'from', 'your', 'our', 'best', 'top', 'services', 'service', 'company', 'how', 'what', 'is', 'are', 'near', 'me', 'vs', 'page', 'pages', 'html', 'php', 'index', 'home']);
const tok = (s) => String(s || '').toLowerCase().replace(/\.(html?|php|aspx?)$/g, '').split(/[^a-z0-9]+/).filter(t => t.length > 1 && !STOP.has(t));
const sitePages = (base.site_urls || []).map(u => ({ url: u, tokens: tok(String(u).replace(/^https?:\/\/[^\/]+/i, '')) }));
const findExisting = (keyword, yourUrl) => {
  if (yourUrl) return { url: yourUrl, source: 'ranking' };
  const kt = new Set(tok(keyword)); if (!kt.size) return null;
  let best = null;
  for (const p of sitePages) {
    const o = p.tokens.filter(t => kt.has(t)).length;
    if (o < Math.min(2, kt.size)) continue;
    const j = o / new Set([...p.tokens, ...kt]).size;
    if (j >= 0.5 && (!best || j > best.j)) best = { url: p.url, j };
  }
  return best ? { url: best.url, source: 'sitemap' } : null;
};
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const homeUrl = domain ? 'https://' + domain + '/' : '';
const plannedUrl = (kw) => homeUrl + slug(kw) + '/';

// ---- one page per topic cluster inside each rung ----
const LIMIT = { 1: 4, 2: 4, 3: 3 };
const MAX_CLUSTER = 6;   // a coarse AI topic label must not swallow a whole rung: split by page type, then into groups of 6
const makePages = (list, rung) => {
  const cl = new Map();
  for (const k of list) { const key = (k.topic || k.keyword) + '|' + k.page_type; if (!cl.has(key)) cl.set(key, []); cl.get(key).push(k); }
  const groups = [];
  for (const ks of cl.values()) { const sorted = ks.slice().sort((a, b) => b.opportunity - a.opportunity); for (let i = 0; i < sorted.length; i += MAX_CLUSTER) groups.push(sorted.slice(i, i + MAX_CLUSTER)); }
  const clusters = groups.map(ks => ({ ks, opp: ks.reduce((s, k) => s + k.opportunity, 0) })).sort((a, b) => b.opp - a.opp);
  return clusters.slice(0, LIMIT[rung]).map(({ ks }) => {
    const p = ks[0];
    const ex = findExisting(p.keyword, p.your_url);
    const pos = ks.map(k => k.your_position).filter(Boolean);
    return { rung, keyword: p.keyword, topic: p.topic, page_type: p.page_type, intent: p.intent, volume: p.volume, kd: p.kd, cpc: p.cpc, opportunity: p.opportunity,
      supporting: ks.slice(1, 7).map(k => k.keyword),
      keywords: ks.slice(0, 8).map(k => ({ keyword: k.keyword, volume: k.volume, kd: k.kd, intent: k.intent, your_position: k.your_position })),
      total_volume: ks.reduce((s, k) => s + k.volume, 0), traffic_potential: ks.reduce((s, k) => s + (k.traffic_potential || 0), 0),
      your_position: pos.length ? Math.min(...pos) : null, exists: !!ex, target_url: ex ? ex.url : plannedUrl(p.keyword), existing_source: ex ? ex.source : null, status: ex ? 'improve' : 'new' };
  });
};
const rungs = [1, 2, 3].map(r => ({ rung: r, label: r === 1 ? 'Rung 1 — long-tail pages (difficulty up to 25)' : r === 2 ? 'Rung 2 — mid-difficulty pages (26-45)' : 'Rung 3 — strong pages (46-60)', pages: makePages(byRung[r], r), available: byRung[r].length }));

// ---- the top rung: the head term ----
const kd = base.keyword_data || {}; const sa = base.site_authority || null; const headRank = (pool.site_rankings || {}).head || null;
const headExisting = (base.existing_page && base.existing_page.url) ? { url: base.existing_page.url, source: base.existing_page.source || 'sitemap' } : findExisting(head, headRank && headRank.url);
const top = { rung: 4, keyword: head, page_type: base.recommended_page || base.page_type || 'Service Page', intent: kd.google_intent || null, volume: kd.search_volume ?? null, kd: kd.keyword_difficulty ?? null, cpc: kd.cpc ?? null,
  supporting: (base.secondary_keywords || []).slice(0, 6), traffic_potential: kd.search_volume ? Math.round(kd.search_volume * 0.3) : null, your_position: headRank ? headRank.position : null,
  exists: !!headExisting, target_url: headExisting ? headExisting.url : plannedUrl(head), existing_source: headExisting ? headExisting.source : null, status: headExisting ? 'improve' : 'new' };
let pageNo = 0; const allPages = [];
for (const r of rungs) for (const p of r.pages) { p.page_no = ++pageNo; allPages.push(p); }
top.page_no = ++pageNo;

// ---- internal link map: every rung page -> top page + one sibling; top page -> every rung page ----
const link_map = [];
for (const r of rungs) {
  const ps = r.pages;
  ps.forEach((p, i) => {
    p.links_to = [{ url: top.target_url, role: 'top', keyword: top.keyword }];
    link_map.push({ from: p.target_url, to: top.target_url, type: 'up' });
    if (ps.length > 1) { const sib = ps[(i + 1) % ps.length]; p.links_to.push({ url: sib.target_url, role: 'sibling', keyword: sib.keyword }); link_map.push({ from: p.target_url, to: sib.target_url, type: 'sideways' }); }
  });
}
top.links_to = allPages.map(p => ({ url: p.target_url, role: 'rung ' + p.rung, keyword: p.keyword }));
allPages.forEach(p => link_map.push({ from: top.target_url, to: p.target_url, type: 'down' }));

// ---- timeline (months); shorter when the site already has authority or ranks for the head term ----
const strongSite = !!(sa && (sa.top10 >= 100 || sa.organic_keywords >= 1000)) || !!(headRank && headRank.position <= 20);
const BASE_LEN = { 1: 2, 2: 3, 3: 3, 4: 4 };
let month = 1; const timeline = [];
for (const r of rungs) {
  if (!r.pages.length) { r.months = null; continue; }
  const len = Math.max(1, BASE_LEN[r.rung] - (strongSite ? 1 : 0));
  r.months = [month, month + len - 1]; timeline.push({ rung: r.rung, label: 'Rung ' + r.rung, months: r.months, pages: r.pages.length }); month += len;
}
const topLen = Math.max(2, BASE_LEN[4] - (strongSite ? 2 : 0));
top.months = [month, month + topLen - 1]; timeline.push({ rung: 4, label: 'Top — ' + head, months: top.months, pages: 1 });

// ---- feasibility of the destination ----
const verdict = base.verdict || 'GO_WITH_CHANGES';
const bl = kd.competitor_backlink_strength || {};
const navigational = /navigational/i.test(String(kd.google_intent || '')) || (base.verdict_reasons || []).some(r => /navigational|brand (term|name|search)|another company/i.test(String(r)));
const status = (verdict === 'AVOID' || navigational) ? 'unrealistic' : ((kd.keyword_difficulty || 0) > 60 && !(sa && sa.top10 >= 100)) ? 'stretch' : 'winnable';
const altPool = [...(base.verdict_changes || []).filter(s => /["“”]/.test(String(s))), ...(base.secondary_keywords || [])].slice(0, 4);
const alternatives = status === 'winnable' ? [] : (altPool.length ? altPool : rungs[2].pages.slice(0, 3).map(p => p.keyword));
const feasibility = { status, verdict, score: base.verdict_score ?? null, reasons: base.verdict_reasons || [], what_must_change: base.verdict_changes || [], alternatives,
  expected_visits_top3: base.expected_visits_top3 ?? null, time_to_rank_months: base.time_to_rank_months ?? null, navigational };

// ---- what else is needed besides the pages ----
const requirements = [];
const needRd = bl.avg_referring_domains || null;
if (needRd) requirements.push({ item: 'Links to the top page', detail: 'Top-10 pages for "' + head + '" average ' + needRd + ' referring domains. Plan ' + Math.max(5, Math.round(needRd * 0.6)) + '+ relevant links (partners, directories, PR, guest articles) to the top page over the ladder period.' });
if (sa) requirements.push({ item: 'Site authority today', detail: domain + ' ranks for ' + (sa.organic_keywords || 0) + ' keywords (' + (sa.top10 || 0) + ' in the top 10, ' + (sa.top3 || 0) + ' in the top 3). ' + (sa.top10 < 20 ? 'The lower rungs come first: they build topical authority before the head term is realistic.' : 'Existing authority shortens the timeline.') });
if ((pool.head_geo || []).length) requirements.push({ item: 'Local trust signals', detail: 'The head term is local (' + pool.head_geo.join(' ') + '): a complete Google Business Profile, consistent name/address/phone and recent reviews support every rung.' });
requirements.push({ item: 'Entity and trust pages', detail: 'Organization schema, an about page with real credentials, author bylines and case studies; the content QA already adds schema to every generated page.' });
requirements.push({ item: 'Publish on schedule and interlink', detail: 'Each rung page links up to the top page and sideways to one sibling; the top page links down to every rung page. Ranking only starts once the pages are live.' });

// ---- pages to write now ----
const order = [...rungs[0].pages, ...rungs[1].pages, ...rungs[2].pages];
const write_now = order.slice(0, pagesNow).map(p => ({ page_no: p.page_no, rung: p.rung, keyword: p.keyword, page_type: p.page_type, target_url: p.target_url, exists: p.exists, supporting: p.supporting, links_to: p.links_to }));
const pages_total = allPages.length + 1;
const stats = { pool_size: (pool.research || {}).pool_size || 0, ai_reviewed: rel.size, relevant: kws.length, pages_total, rung_pages: allPages.length,
  keywords_covered: allPages.reduce((s, p) => s + 1 + p.supporting.length, 0) + 1 + top.supporting.length,
  traffic_potential_total: allPages.reduce((s, p) => s + (p.traffic_potential || 0), 0) + (top.traffic_potential || 0),
  site_rankings_found: (pool.site_rankings || {}).count || 0, research_failures: (pool.research || {}).failures || [] };
const notes = [];
if (pages_total < 8) notes.push('Only ' + pages_total + ' pages could be planned from the data: the topic is narrow in ' + base.country + '. The ladder is shorter but still valid.');
for (const r of rungs) if (!r.pages.length) notes.push('No keywords fell into rung ' + r.rung + '; the ladder skips it.');
const ladder = { ladder_id: base.ladder_id || ('lad_' + Date.now().toString(36)), head: { keyword: head, volume: top.volume, kd: top.kd, cpc: top.cpc, intent: top.intent, your_position: top.your_position },
  domain, country: base.country, goal: base.goal || 'leads', feasibility, rungs, top, link_map, timeline, write_now, pages_now: pagesNow,
  later: later.slice(0, 12).map(k => ({ keyword: k.keyword, volume: k.volume, kd: k.kd })), requirements, stats, notes,
  tracker: { cadence: base.tracker_cadence || 'weekly', auto_next_rung: !!base.auto_next_rung, stop_rule: 'top rung in the top 3 for 4 consecutive checks' }, created_at: new Date().toISOString() };
return [{ json: { ...base, ladder, site_rankings: pool.site_rankings || null } }];
