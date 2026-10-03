// Ladder mode: merges the research pulls into one pool around the head term, keeps only keywords that share its
// topic, scores opportunity (same formula as discovery) and records where the client's site ranks today.
const base = $('Parse Verdict').first().json;
const reqs = $('Ladder Requests').all().map(i => i.json);
const res = $input.all().map(i => i.json);
const head = String(base.keyword || '').toLowerCase().trim();
const goal = base.goal || 'leads';
const brand = String(base.domain || '').split('.')[0].toLowerCase();
const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'with', 'by', 'at', 'from', 'near', 'me', 'vs', 'is', 'are', 'what', 'how', 'best', 'top', 'your', 'my']);
const GEO = new Set(['uae', 'dubai', 'abu', 'dhabi', 'sharjah', 'ajman', 'saudi', 'ksa', 'riyadh', 'jeddah', 'qatar', 'doha', 'oman', 'bahrain', 'kuwait', 'pakistan', 'karachi', 'lahore', 'islamabad', 'india', 'mumbai', 'delhi', 'uk', 'london', 'usa', 'us', 'australia', 'sydney', 'canada', 'toronto', 'singapore', 'germany', 'berlin', 'france', 'paris', 'spain', 'madrid', 'italy', 'netherlands', 'brazil', 'mexico', 'ireland', 'dublin', 'emirates', 'gcc', 'middle', 'east']);
const stem = (t) => t.replace(/ies$/, 'y').replace(/(ing|ed|es|s)$/, '').replace(/[^a-z0-9]/g, '');
const tokens = (s) => String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 1 && !STOP.has(t));
const headTok = tokens(head);
const headCore = headTok.filter(t => !GEO.has(t)).map(stem).filter(t => t.length >= 2);
const headGeo = headTok.filter(t => GEO.has(t));
const headSet = new Set(headTok.map(stem));
const sharesTopic = (kw) => { const t = tokens(kw).filter(x => !GEO.has(x)).map(stem); return headCore.length ? t.some(x => headCore.includes(x)) : true; };
const sameAsHead = (kw) => { const t = tokens(kw).map(stem); return t.length === headSet.size && t.every(x => headSet.has(x)); };
const INTENTS = ['informational', 'navigational', 'commercial', 'transactional'];
const W = { leads: { transactional: 1.3, commercial: 1.25, informational: 0.8, navigational: 0.2 }, sales: { transactional: 1.4, commercial: 1.2, informational: 0.7, navigational: 0.2 },
  traffic: { informational: 1.2, commercial: 1.0, transactional: 0.9, navigational: 0.2 }, brand: { informational: 1.1, commercial: 1.1, transactional: 1.0, navigational: 0.3 } }[goal]
  || { transactional: 1.3, commercial: 1.25, informational: 0.8, navigational: 0.2 };
const classify = (kw, intent) => {
  if (INTENTS.includes(intent)) return intent;
  const k = String(kw).toLowerCase();
  if (brand.length > 3 && k.includes(brand)) return 'navigational';
  if (/\b(price|pricing|cost|costs|buy|hire|quote|near me|licen[cs]e|subscription|free trial|demo|order|book|register|registration|apply)\b/.test(k)) return 'transactional';
  if (/\b(best|top|vs|versus|compare|comparison|review|reviews|alternatives?|services?|company|companies|agency|partner|partners|consultants?|consulting|providers?|firms?|software|solutions?|platform|systems?|tools?)\b/.test(k)) return 'commercial';
  return 'informational';
};
const pool = new Map(); const rankings = {};
const addItem = (raw, source) => {
  const kd0 = raw.keyword_data || raw;
  const kw = String(kd0.keyword || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!kw) return;
  const info = kd0.keyword_info || {}; const vol = info.search_volume ?? 0;
  if (source === 'ranked') { const se = (raw.ranked_serp_element || {}).serp_item || {}; if (se.rank_group) rankings[kw] = { position: se.rank_group, url: se.url || null, volume: vol, kd: (kd0.keyword_properties || {}).keyword_difficulty ?? null }; }   // kd: the site's reach (v4.8)
  if (vol < 10) return;
  if ((source === 'ideas' || source === 'ranked') && !sharesTopic(kw)) return;
  const props = kd0.keyword_properties || {}, serp = kd0.serp_info || {}, bl = kd0.avg_backlinks_info || {}, trend = info.search_volume_trend || {};
  let e = pool.get(kw);
  if (!e) {
    e = { keyword: kw, volume: vol, cpc: info.cpc ?? null, competition: info.competition ?? null, kd: props.keyword_difficulty ?? null,
      intent: classify(kw, (kd0.search_intent_info || {}).main_intent), trend_yearly: trend.yearly ?? null, serp_types: serp.serp_item_types || [],
      avg_rd: bl.referring_domains != null ? Math.round(bl.referring_domains) : null, words: props.words_count || kw.split(' ').length, sources: [], competitors: [],
      local: tokens(kw).some(t => GEO.has(t)) };
    pool.set(kw, e);
  }
  if (!e.sources.includes(source)) e.sources.push(source);
  if (e.kd == null && props.keyword_difficulty != null) e.kd = props.keyword_difficulty;
  if (!e.serp_types.length && Array.isArray(serp.serp_item_types)) e.serp_types = serp.serp_item_types;
  if (e.cpc == null && info.cpc != null) e.cpc = info.cpc;
};
reqs.forEach((r, i) => { const items = res[i]?.tasks?.[0]?.result?.[0]?.items || []; for (const it of items) addItem(it, r.kind); });
const score = (e) => {
  let ctr = 1; const t = e.serp_types || [];
  if (t.includes('ai_overview')) ctr *= 0.65;
  if (t.includes('featured_snippet')) ctr *= 0.85;
  if (t.includes('video') || t.includes('short_videos')) ctr *= 0.92;
  if (t.includes('local_pack') || t.includes('map')) ctr *= 0.85;
  if (t.includes('shopping') || t.includes('popular_products')) ctr *= 0.9;
  const traffic_potential = Math.round(e.volume * ctr * 0.3);
  let win = Math.min(1, Math.max(0.05, (100 - (e.kd ?? 50)) / 100));
  if (e.avg_rd != null && e.avg_rd > 300) win *= 0.5; else if (e.avg_rd != null && e.avg_rd > 100) win *= 0.7;
  const value = 1 + Math.log10(1 + (e.cpc || 0));
  const iw = W[e.intent] ?? 1;
  const tr = 1 + Math.min(0.3, Math.max(-0.3, (e.trend_yearly || 0) / 100));
  return { traffic_potential, winnability: +win.toFixed(2), value_factor: +value.toFixed(2), pre_score: +(traffic_potential * win * value * iw * tr).toFixed(1) };
};
const all = [...pool.values()].map(e => {
  if (brand.length > 3 && e.keyword.includes(brand)) e.intent = 'navigational';
  const r = rankings[e.keyword];
  return { ...e, ...score(e), your_position: r ? r.position : null, your_url: r ? r.url : null };
}).sort((a, b) => b.pre_score - a.pre_score);
const candidates = all.filter(e => e.intent !== 'navigational' && !sameAsHead(e.keyword)).slice(0, 160);
const bySource = {}; for (const e of all) for (const s of e.sources) bySource[s] = (bySource[s] || 0) + 1;
const failures = reqs.map((r, i) => [r, res[i]]).filter(([r, x]) => !x || x.error || ((x.tasks || [])[0] || {}).status_code >= 40000)
  .map(([r, x]) => r.label + ': ' + ((x && ((x.error && x.error.message) || ((x.tasks || [])[0] || {}).status_message)) || 'no response'));
if (failures.length === reqs.length) throw new Error('Keyword ladder: every research pull failed (' + failures.join('; ') + '). Check the DataForSEO credential on "Run Ladder Research" and the account balance.');
if (!all.length) throw new Error('Keyword ladder: no keywords with search volume were found around "' + head + '" in ' + (base.country || 'this market') + '. Try a broader destination keyword.');
const headRank = rankings[head] || null;
// v4.8: did the "keywords the site ranks for" pull answer? (reach falls back to the site's size when it did not)
const rankedIdx = reqs.findIndex(r => r.kind === 'ranked');
const rankedOk = rankedIdx >= 0 && !!res[rankedIdx] && !res[rankedIdx].error && ((((res[rankedIdx].tasks || [])[0] || {}).status_code) || 0) > 0 && (((res[rankedIdx].tasks || [])[0] || {}).status_code) < 40000;
const sd = base.site_description || {};
// Context for the AI relevance screen: anchor "relevance" on the head term, not just on the business
const business = (base.business || sd.business_description || 'unknown') + '. KEYWORD LADDER: this research is for a ladder of pages that climb towards the head keyword "' + head +
  '". A keyword is core (2) only when a page about it would naturally link up to a page about "' + head + '"; neighbouring topics are adjacent (1); jobs, courses, unrelated definitions and other brands are 0.';
return [{ json: { ...base, business, services: (sd.products_or_services || []).slice(0, 8),
  research: { pool_size: all.length, candidates, by_source: bySource, failures, requests: reqs.length },
  site_rankings: { count: Object.keys(rankings).length, head: headRank, keywords: Object.fromEntries(Object.entries(rankings).slice(0, 400)), available: rankedOk,
    top10: Object.entries(rankings).filter(([k, r]) => r.position >= 1 && r.position <= 10).map(([k, r]) => ({ keyword: k, kd: r.kd, position: r.position })) },
  head_tokens: headTok, head_geo: headGeo } }];
