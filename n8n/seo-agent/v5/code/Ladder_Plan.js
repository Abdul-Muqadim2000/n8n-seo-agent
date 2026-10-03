/*__REACH__*/
// Ladder mode: applies the AI relevance screen, assigns keywords to rungs by difficulty, builds one page per topic
// cluster, maps internal links, matches existing pages, estimates the timeline and picks the pages to write now.
// v4.8 (PIPELINE_FEATURE_SPEC §5.3-5.5): everything is measured against the site's REACH (stored 30 days in seo_cache, else measured from this
// run's "keywords the site ranks for" pull and the site authority): rungs relative to reach (1 <= reach, 2 <= reach + 15, 3 <= reach + 30, above
// = later); the main keyword's difficulty for this site picks the plan — direct (main page FIRST + 2-3 supporting pages), short (3-5 supporting
// pages, then the main page), full (rungs 1-3 + main page, as before; very hard = stretch with the alternatives first) or none (not realistic:
// alternatives only, no pages). Keywords that already belong to another ladder of the site are never planned again (same search: equal stemmed
// word sets or 75%+ in common), and a main keyword that duplicates another ladder's main keyword is refused.
const base = $('Parse Verdict').first().json;
const pool = $('Ladder Pool').first().json;
const chunks = $('Ladder Relevance Chunks').all().map(i => i.json);
const outs = $input.all().map(i => i.json);
const head = String(base.keyword || '').toLowerCase().trim();
const domain = String(base.domain || '').toLowerCase();
const pagesNow = Math.min(3, Math.max(1, Number(base.pages_now) || 1));
const ladderId = String(base.ladder_id || ('lad_' + Date.now().toString(36)));
const parse = (raw) => { if (raw && typeof raw === 'object') return raw; try { return JSON.parse(String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')); } catch (e) { return {}; } };
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error && Object.keys(r).length); } catch (e) { return []; } };
const INTENTS = ['informational', 'navigational', 'commercial', 'transactional'];
const PAGES = ['Service Page', 'Product Page', 'Landing Page', 'Comparison Page', 'Blog Post', 'Guide', 'FAQ Page', 'Location Page', 'Category Page'];
const defaultPage = (intent) => intent === 'informational' ? 'Guide' : intent === 'transactional' ? 'Landing Page' : 'Service Page';

// ---- reach: stored for this site and market (30 days), else measured from this run's data (saved by "Save Reach (Ladder)") ----
const sa = base.site_authority || null;
const SR = pool.site_rankings || {};
let reachInfo = reachCached(rowsOf('Load Site Cache'), domain, base.location_code);
let reach_cache_row = null;
if (!reachInfo) {
  reachInfo = reachFrom(SR.available === false ? null : (SR.top10 || []), sa);
  if (reachInfo.method !== 'default') reach_cache_row = reachCacheRow(domain, reachInfo, base.location_code);
}
const reach = reachInfo.reach;

// ---- the site's other ladders (rule R1: one search, one page) ----
const settingsRows = rowsOf('Load Domain Ladder Settings');
const archived = new Set(settingsRows.filter(r => String(r.status || '').toLowerCase() === 'archived').map(r => String(r.ladder_id)));
const others = rowsOf('Load Domain Ladders').filter(r => r.ladder_id && String(r.ladder_id) !== ladderId && reachDomain(r.domain) === reachDomain(domain) && !archived.has(String(r.ladder_id)));
const otherHeads = new Map(); for (const r of others) { const h = String(r.head_keyword || (Number(r.rung) === 4 ? r.keyword : '') || '').toLowerCase().trim(); if (h && !otherHeads.has(String(r.ladder_id))) otherHeads.set(String(r.ladder_id), h); }
const taken = []; const seenTaken = new Set();
for (const r of others) for (const k of [r.keyword, r.head_keyword]) { const kw = String(k || '').toLowerCase().trim(); const sig = r.ladder_id + '|' + kw; if (kw && !seenTaken.has(sig)) { seenTaken.add(sig); taken.push({ keyword: kw, tokens: overlapTokens(kw), ladder_id: String(r.ladder_id), head: otherHeads.get(String(r.ladder_id)) || '' }); } }
const takenBy = (kw) => { const t = overlapTokens(kw); return taken.find(x => overlapScore(t, x.tokens) >= 0.75) || null; };
const dupHead = [...otherHeads.entries()].map(([id, h]) => ({ ladder_id: id, head: h })).find(x => keywordsOverlap(x.head, head)) || null;
const headTakenAsPage = !dupHead ? takenBy(head) : null;

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
const excluded = [];
const kws = ((pool.research || {}).candidates || []).map(k => {
  const r = rel.get(k.keyword) || { relevance: 1, intent: k.intent, page_type: '', topic: '' };
  const intent = INTENTS.includes(r.intent) ? r.intent : k.intent;
  const page_type = PAGES.includes(r.page_type) ? r.page_type : defaultPage(intent);
  return { ...k, intent, relevance: r.relevance, page_type, topic: r.topic || k.keyword.split(' ').slice(0, 3).join(' '), opportunity: +(k.pre_score * (RELF[r.relevance] ?? 0.45)).toFixed(1) };
}).filter(k => k.relevance > 0 && k.intent !== 'navigational').filter(k => {
  const t = takenBy(k.keyword); if (!t) return true;
  excluded.push({ keyword: k.keyword, ladder_id: t.ladder_id, head: t.head, as: t.keyword }); return false;
}).sort((a, b) => b.opportunity - a.opportunity);

// ---- rung bands relative to reach (unknown difficulty = reach + 10) ----
const kdOf = (k) => k.kd == null ? reach + REACH_CFG.unknown_kd : k.kd;
const longTail = (k) => k.words >= 3 || (k.words >= 2 && k.volume < 200);
const BAND = { 1: reach, 2: reach + 15, 3: reach + 30 };
const rungOf = (k) => { const kd = kdOf(k); if (kd <= BAND[1] && k.volume >= 20 && longTail(k)) return 1; if (kd <= BAND[2]) return 2; if (kd <= BAND[3]) return 3; return 0; };   // 0 = later
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
const bandLabel = (r) => r === 1 ? 'Rung 1 — long-tail pages (difficulty up to ' + BAND[1] + ')' : r === 2 ? 'Rung 2 — mid-difficulty pages (' + (BAND[1] + 1) + '-' + BAND[2] + ')' : 'Rung 3 — strong pages (' + (BAND[2] + 1) + '-' + BAND[3] + ')';
const rungs = [1, 2, 3].map(r => ({ rung: r, label: bandLabel(r), band_max: BAND[r], pages: makePages(byRung[r], r), available: byRung[r].length }));

// ---- the main keyword for this site: difficulty, plan type, months ----
const kd = base.keyword_data || {}; const headRank = SR.head || null;
const verdict = base.verdict || 'GO_WITH_CHANGES';
const navigational = /navigational/i.test(String(kd.google_intent || '')) || (base.verdict_reasons || []).some(r => /navigational|brand (term|name|search)|another company/i.test(String(r)));
const difficulty_for_you = difficultyForYou(kd.keyword_difficulty ?? null, reach, { navigational, verdict, position: headRank ? headRank.position : null });
const strongSite = reachStrong(sa, headRank ? headRank.position : null);
const plan = reachPlan(difficulty_for_you, strongSite);
const top = { rung: 4, keyword: head, page_type: base.recommended_page || base.page_type || 'Service Page', intent: kd.google_intent || null, volume: kd.search_volume ?? null, kd: kd.keyword_difficulty ?? null, cpc: kd.cpc ?? null,
  supporting: (base.secondary_keywords || []).slice(0, 6), traffic_potential: kd.search_volume ? Math.round(kd.search_volume * 0.3) : null, your_position: headRank ? headRank.position : null };
const headExisting = (base.existing_page && base.existing_page.url) ? { url: base.existing_page.url, source: base.existing_page.source || 'sitemap' } : findExisting(head, headRank && headRank.url);
Object.assign(top, { exists: !!headExisting, target_url: headExisting ? headExisting.url : plannedUrl(head), existing_source: headExisting ? headExisting.source : null, status: headExisting ? 'improve' : 'new' });

// ---- feasibility of the destination (alternatives before any page is dropped) ----
const status = difficulty_for_you === 'not_realistic' ? 'unrealistic' : difficulty_for_you === 'very_hard' ? 'stretch' : 'winnable';
const altPool = [...(base.verdict_changes || []).filter(s => /["“”]/.test(String(s))), ...(base.secondary_keywords || [])].slice(0, 4);
const altPages = [...rungs[2].pages, ...rungs[1].pages, ...rungs[0].pages].map(p => p.keyword);
const alternatives = status === 'winnable' ? [] : (altPool.length ? altPool : altPages.slice(0, 3));

// ---- refusals: a duplicate main keyword, or a destination that is not realistic -> no ladder pages ----
let refusal = null;
if (dupHead) refusal = { reason: 'duplicate', ladder_id: dupHead.ladder_id, head: dupHead.head,
  message: 'This website already has a keyword ladder for "' + dupHead.head + '" (' + dupHead.ladder_id + '). One search needs one page, so no second ladder was planned: continue that ladder instead.' };
else if (plan.plan_type === 'none') refusal = { reason: 'not_realistic', message: '"' + head + '" is not a realistic main keyword for ' + domain + ' (' + (navigational ? 'people searching it look for one particular website or brand' : 'the verdict is AVOID') + '). No ladder pages were planned; pick one of the alternatives as the main keyword instead.' };
const plan_type = refusal ? 'none' : plan.plan_type;
const planned = !refusal;

// ---- pages per plan type: direct 2-3 supporting pages, short 3-5, full as before (rung limits); the rest is kept for later ----
const CAP = { direct: 3, short: 5, full: Infinity, none: 0 }[plan_type];
let kept = 0;
for (const r of rungs) {
  const keep = r.pages.slice(0, Math.max(0, CAP - kept)); kept += keep.length;
  for (const p of r.pages.slice(keep.length)) later.unshift({ keyword: p.keyword, volume: p.volume, kd: p.kd, held_back: true });
  r.pages = keep;
}
const rungPages = rungs.flatMap(r => r.pages);
let pageNo = 0;
if (plan_type === 'direct') top.page_no = ++pageNo;   // direct: the main page is written first
for (const p of rungPages) p.page_no = ++pageNo;
if (plan_type !== 'direct') top.page_no = ++pageNo;

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
top.links_to = rungPages.map(p => ({ url: p.target_url, role: 'rung ' + p.rung, keyword: p.keyword }));
if (planned) rungPages.forEach(p => link_map.push({ from: top.target_url, to: p.target_url, type: 'down' }));

// ---- timeline (months): full = rung by rung (shorter for a strong site), then the main page in the plan's range; short = supporting pages,
//      then the main page; direct = the main page first, its supporting pages in the same window ----
const range = plan.months_range || [0, 0];
const timeline = [];
const topLabel = 'Top — ' + head;
if (!planned) { for (const r of rungs) r.months = null; top.months = null; }
else if (plan_type === 'full') {
  const BASE_LEN = { 1: 2, 2: 3, 3: 3 }; let month = 1;
  for (const r of rungs) {
    if (!r.pages.length) { r.months = null; continue; }
    const len = Math.max(1, BASE_LEN[r.rung] - (strongSite ? 1 : 0));
    r.months = [month, month + len - 1]; timeline.push({ rung: r.rung, label: 'Rung ' + r.rung, months: r.months, pages: r.pages.length }); month += len;
  }
  top.months = range.slice(); timeline.push({ rung: 4, label: topLabel, months: top.months, pages: 1 });
} else if (plan_type === 'short') {
  const sup = [1, Math.max(1, range[0] - 1)];
  for (const r of rungs) { r.months = r.pages.length ? sup.slice() : null; if (r.pages.length) timeline.push({ rung: r.rung, label: 'Rung ' + r.rung, months: r.months, pages: r.pages.length }); }
  top.months = range.slice(); timeline.push({ rung: 4, label: topLabel, months: top.months, pages: 1 });
} else {
  top.months = range.slice(); timeline.push({ rung: 4, label: topLabel + ' (written first)', months: top.months, pages: 1 });
  for (const r of rungs) { r.months = r.pages.length ? range.slice() : null; if (r.pages.length) timeline.push({ rung: r.rung, label: 'Rung ' + r.rung, months: r.months, pages: r.pages.length }); }
}

const bl = kd.competitor_backlink_strength || {};
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

// ---- pages to write now, in the plan's order (direct: the main page first; otherwise the supporting pages, the main page waits for support) ----
const order = !planned ? [] : plan_type === 'direct' ? [top, ...rungPages] : rungPages;
const write_now = order.slice(0, pagesNow).map(p => ({ page_no: p.page_no, rung: p.rung, keyword: p.keyword, page_type: p.page_type, target_url: p.target_url, exists: p.exists, supporting: p.supporting, links_to: p.links_to }));
const pages_total = planned ? rungPages.length + 1 : 0;
const stats = { pool_size: (pool.research || {}).pool_size || 0, ai_reviewed: rel.size, relevant: kws.length, pages_total, rung_pages: planned ? rungPages.length : 0,
  keywords_covered: planned ? rungPages.reduce((s, p) => s + 1 + p.supporting.length, 0) + 1 + top.supporting.length : 0,
  traffic_potential_total: planned ? rungPages.reduce((s, p) => s + (p.traffic_potential || 0), 0) + (top.traffic_potential || 0) : 0,
  site_rankings_found: SR.count || 0, research_failures: (pool.research || {}).failures || [], excluded_keywords: excluded.length };
const notes = [];
if (refusal) notes.push(refusal.message);
if (planned && plan_type === 'full' && pages_total < 8) notes.push('Only ' + pages_total + ' pages could be planned from the data: the topic is narrow in ' + base.country + '. The ladder is shorter but still valid.');
if (planned && plan_type === 'full') for (const r of rungs) if (!r.pages.length) notes.push('No keywords fell into rung ' + r.rung + '; the ladder skips it.');
if (planned && plan_type === 'direct' && rungPages.length < 2) notes.push('Only ' + rungPages.length + ' supporting page(s) could be planned around the main keyword; add more as the site grows.');
if (planned && plan_type === 'short' && rungPages.length < 3) notes.push('Only ' + rungPages.length + ' supporting page(s) could be planned before the main page.');
if (excluded.length) notes.push(excluded.length + ' keyword(s) already belong to other ladders of this site and were left out (one search, one page): ' + excluded.slice(0, 6).map(x => '"' + x.keyword + '" (ladder "' + x.head + '")').join(', ') + (excluded.length > 6 ? ' …' : '') + '.');
if (headTakenAsPage) notes.push('The main keyword is also planned as a page of the ladder "' + headTakenAsPage.head + '" (' + headTakenAsPage.ladder_id + '): publish only one page for it.');
if (plan.stretch && planned) notes.push('Very hard for this site today: consider one of the alternatives first (' + alternatives.join(', ') + ').');
const order_text = !planned ? 'no pages' : plan_type === 'direct' ? 'main page first, then the supporting pages that link to it' : plan_type === 'short' ? 'supporting pages first, then the main page once half of them are live' : 'rung by rung from the easiest pages, the main page last';
const ladder = { ladder_id: ladderId, head: { keyword: head, volume: top.volume, kd: top.kd, cpc: top.cpc, intent: top.intent, your_position: top.your_position },
  domain, country: base.country, goal: base.goal || 'leads', feasibility, rungs, top, link_map, timeline, write_now, pages_now: pagesNow,
  later: later.slice(0, 12).map(k => ({ keyword: k.keyword, volume: k.volume, kd: k.kd, ...(k.held_back ? { held_back: true } : {}) })), requirements, stats, notes,
  plan_type, difficulty_for_you, reach, months: planned ? plan.months : '', months_range: planned ? plan.months_range : null, stretch: planned && plan.stretch, planned, refusal, order: order_text,
  label: planned ? reachLabel(difficulty_for_you, plan) : (REACH_DIFF_LABEL[difficulty_for_you] + ' · no ladder'),
  reach_info: { reach, method: reachInfo.method, p75: reachInfo.p75 ?? null, size_reach: reachInfo.size_reach ?? null, sample: reachInfo.sample ?? null, top10: reachInfo.top10 ?? null, organic_keywords: reachInfo.organic_keywords ?? null, cached: !!reachInfo.cached, cached_at: reachInfo.cached_at || null },
  excluded_keywords: excluded.slice(0, 40),
  tracker: { cadence: base.tracker_cadence || 'weekly', auto_next_rung: !!base.auto_next_rung, stop_rule: 'once the top rung holds the top 3 for 4 checks it is checked monthly (with the published pages)' }, created_at: new Date().toISOString() };
return [{ json: { ...base, ladder, site_rankings: pool.site_rankings || null, reach_cache_row } }];
