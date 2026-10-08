// Merges every research response into one keyword pool with metrics, SERP features and competitor positions,
// then scores each keyword's OPPORTUNITY before the AI relevance pass:
//   traffic potential (volume x CTR after SERP features) x winnability (difficulty, top-10 link strength)
//   x commercial value (CPC) x intent weight for the client's goal x trend
const base = $('Seed List').first().json;
const reqA = $('Research Requests').all().map(i => i.json), resA = $('Run Research').all().map(i => i.json);
const reqB = $('Competitor Keyword Requests').all().map(i => i.json), resB = $input.all().map(i => i.json);
const goal = base.goal || 'leads';
const brand = String(base.domain || '').split('.')[0].toLowerCase();
const INTENTS = ['informational', 'navigational', 'commercial', 'transactional'];
const W = {
  leads:   { transactional: 1.3, commercial: 1.25, informational: 0.8, navigational: 0.2 },
  sales:   { transactional: 1.4, commercial: 1.2, informational: 0.7, navigational: 0.2 },
  traffic: { informational: 1.2, commercial: 1.0, transactional: 0.9, navigational: 0.2 },
  brand:   { informational: 1.1, commercial: 1.1, transactional: 1.0, navigational: 0.3 }
}[goal] || { transactional: 1.3, commercial: 1.25, informational: 0.8, navigational: 0.2 };
const classify = (kw, intent) => {
  if (INTENTS.includes(intent)) return intent;
  const k = String(kw).toLowerCase();
  if (brand.length > 3 && k.includes(brand)) return 'navigational';
  if (/\b(price|pricing|cost|costs|buy|hire|quote|near me|licen[cs]e|subscription|free trial|demo|order|book)\b/.test(k)) return 'transactional';
  if (/\b(best|top|vs|versus|compare|comparison|review|reviews|alternatives?|services?|company|companies|agency|partner|partners|consultants?|consulting|providers?|firms?)\b/.test(k)) return 'commercial';
  return 'informational';
};
const pool = new Map();
const addItem = (raw, source, extra = {}) => {
  const kd = raw.keyword_data || raw;
  const kw = String(kd.keyword || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!kw) return;
  const info = kd.keyword_info || {};
  const vol = info.search_volume ?? 0;
  if (vol < 10) return;
  const props = kd.keyword_properties || {}, serp = kd.serp_info || {}, bl = kd.avg_backlinks_info || {}, trend = info.search_volume_trend || {};
  let e = pool.get(kw);
  if (!e) {
    e = { keyword: kw, volume: vol, cpc: info.cpc ?? null, competition: info.competition ?? null, kd: props.keyword_difficulty ?? null,
      intent: classify(kw, (kd.search_intent_info || {}).main_intent), trend_yearly: trend.yearly ?? null, trend_quarterly: trend.quarterly ?? null,
      monthly: (info.monthly_searches || []).slice(0, 12).map(m => m.search_volume), serp_types: serp.serp_item_types || [],
      se_results_count: serp.se_results_count ?? null, avg_rd: bl.referring_domains != null ? Math.round(bl.referring_domains) : null,
      words: props.words_count || kw.split(' ').length, sources: [], competitors: [] };
    pool.set(kw, e);
  }
  if (!e.sources.includes(source)) e.sources.push(source);
  if (extra.competitor) e.competitors.push(extra.competitor);
  if (e.kd == null && props.keyword_difficulty != null) e.kd = props.keyword_difficulty;
  if (!e.serp_types.length && Array.isArray(serp.serp_item_types)) e.serp_types = serp.serp_item_types;
  if (e.cpc == null && info.cpc != null) e.cpc = info.cpc;
};
const walk = (req, res) => {
  const items = res?.tasks?.[0]?.result?.[0]?.items || [];
  for (const it of items) {
    if (req.kind === 'serp') continue;
    if (req.kind === 'competitor') { const se = (it.ranked_serp_element || {}).serp_item || {}; addItem(it, 'competitor', { competitor: { domain: req.domain, position: se.rank_group ?? null, url: se.url || null } }); }
    else addItem(it, req.kind);
  }
};
reqA.forEach((r, i) => walk(r, resA[i]));
reqB.forEach((r, i) => walk(r, resB[i]));

const score = (e) => {
  let ctr = 1; const t = e.serp_types || [];
  if (t.includes('ai_overview')) ctr *= 0.65;
  if (t.includes('featured_snippet')) ctr *= 0.85;
  if (t.includes('video') || t.includes('short_videos')) ctr *= 0.92;
  if (t.includes('local_pack') || t.includes('map')) ctr *= 0.85;
  if (t.includes('shopping') || t.includes('popular_products')) ctr *= 0.9;
  const traffic_potential = Math.round(e.volume * ctr * 0.3);          // roughly what a #1-3 page captures
  let win = Math.min(1, Math.max(0.05, (100 - (e.kd ?? 50)) / 100));
  if (e.avg_rd != null && e.avg_rd > 300) win *= 0.5; else if (e.avg_rd != null && e.avg_rd > 100) win *= 0.7;
  const value = 1 + Math.log10(1 + (e.cpc || 0));
  const iw = W[e.intent] ?? 1;
  const tr = 1 + Math.min(0.3, Math.max(-0.3, (e.trend_yearly || 0) / 100));
  return { traffic_potential, winnability: +win.toFixed(2), value_factor: +value.toFixed(2), pre_score: +(traffic_potential * win * value * iw * tr).toFixed(1) };
};
const all = [...pool.values()].map(e => { if (brand.length > 3 && e.keyword.includes(brand)) e.intent = 'navigational'; return { ...e, ...score(e) }; })
  .sort((a, b) => b.pre_score - a.pre_score);
const candidates = all.filter(e => e.intent !== 'navigational').slice(0, 240);
const bySource = {};
for (const e of all) for (const s of e.sources) bySource[s] = (bySource[s] || 0) + 1;
const pairs = [...reqA.map((r, i) => [r, resA[i]]), ...reqB.map((r, i) => [r, resB[i]])];
const failures = pairs.filter(([r, res]) => !res || res.error || Number(res.status_code) >= 40000 || ((res.tasks || [])[0] || {}).status_code >= 40000)   // + a top-level DataForSEO error (50000 with tasks: null, HTTP 200)
  .map(([r, res]) => r.label + ': ' + ((res && ((res.error && res.error.message) || ((res.tasks || [])[0] || {}).status_message || res.status_message)) || 'no response'));
return [{ json: { ...base, research: {
  pool_size: all.length, candidates, long_tail_pool: all.filter(e => e.words >= 4 && e.intent !== 'navigational').slice(0, 300),
  competitor_domains: [...new Set(reqB.filter(r => r.kind === 'competitor').map(r => r.domain))], by_source: bySource, failures, requests: pairs.length
} } }];
