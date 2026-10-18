/*__KW_INPUTS__*/
// Merges every research response into one keyword pool with metrics, SERP features and competitor positions,
// then scores each keyword's OPPORTUNITY before the AI relevance pass:
//   traffic potential (volume x CTR after SERP features) x winnability (difficulty, top-10 link strength)
//   x commercial value (CPC) x intent weight for the client's goal x trend
// 2026-10-13 (FIX_PLAN G8, criteria K2 / K6): every keyword the site's Search Console measured carries that measurement
// (impressions, clicks, average position, the page that gets them) and its traffic potential is CALIBRATED against it
// instead of modelled from the provider's volume - and says which of the two it is (KWI.calibrate). Search Console queries
// the providers never returned join the pool as candidates in their own right, with no invented search volume.
const base = (() => { try { const x = $('Search Console Seeds (Discovery)').first().json; if (x && Array.isArray(x.seeds) && x.seeds.length) return x; } catch (e) {} return $('Seed List').first().json; })();
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
// G8: what Search Console measured for this site in the newest 28-day period, by exact query
const SC = (base.search_console && typeof base.search_console === 'object') ? base.search_console : {};
// R36 (2026-10-16): the seeds are only the searches worth seeding; `measured` is every search Search Console measured with a page of
// the site, so a keyword the providers also returned still carries the page it already ranks with (and is never offered a second one)
const gscBy = new Map([...(SC.measured || []).map(q => ({ ...q, kinds: [], answered_by: q.answered_url ? { url: q.answered_url } : null })), ...(SC.queries || [])].map(q => [String(q.keyword || '').toLowerCase(), q]));
const gscFacts = (kw) => { const q = gscBy.get(kw); return q ? { impressions: q.impressions, clicks: q.clicks, position: q.position, ctr: q.ctr,
  page: q.page || '', gsc_page: q.gsc_page || q.page || '', answered_by: q.answered_by || null, kinds: q.kinds || [], period_end: q.period_end || SC.period_end || '', period_days: q.period_days || SC.period_days || 28 } : null; };
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
      words: props.words_count || kw.split(' ').length, sources: [], competitors: [], gsc: gscFacts(kw) };
    pool.set(kw, e);
    if (e.gsc) e.sources.push('search_console');
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
// G8 (K6): a search the site already gets impressions for is a candidate even when no provider returned it. It keeps `volume: null`
// (Search Console impressions are not a search volume: they count only the searches this site was shown in) and is scored from the
// measured data, so it is never dressed up with a number nobody measured.
let gsc_only = 0;
for (const q of (SC.queries || [])) {
  const kw = String(q.keyword || '').toLowerCase().trim();
  if (!kw || pool.has(kw)) continue;
  pool.set(kw, { keyword: kw, volume: null, volume_note: 'no monthly volume from the search-data provider; the numbers below are what Search Console measured on your site',
    cpc: null, competition: null, kd: null, intent: classify(kw, null), trend_yearly: null, trend_quarterly: null, monthly: [], serp_types: [],
    se_results_count: null, avg_rd: null, words: kw.split(' ').length, sources: ['search_console'], competitors: [], gsc: gscFacts(kw) });
  gsc_only++;
}

const score = (e) => {
  // G8 (K2): the same two factors as before - the results page's click loss and the share a top-three page takes - but applied to the
  // site's own MEASURED impressions when Search Console has them, and labelled `calibrated` / `modelled` / `unknown` either way.
  // Without Search Console data the number is exactly what it was: volume x click loss x 0.3.
  const cal = KWI.calibrate(e, {});
  const traffic_potential = cal.traffic_potential == null ? 0 : cal.traffic_potential;
  let win = Math.min(1, Math.max(0.05, (100 - (e.kd ?? 50)) / 100));
  if (e.avg_rd != null && e.avg_rd > 300) win *= 0.5; else if (e.avg_rd != null && e.avg_rd > 100) win *= 0.7;
  const value = 1 + Math.log10(1 + (e.cpc || 0));
  const iw = W[e.intent] ?? 1;
  // R51 (2026-10-16): a keyword losing 73% of its searches a year lost only 30% of its score (the floor was -0.3), and a CPC outweighed
  // it into "where to start". A decline now counts as far as -70%; a rise is still capped at +30% (one good year is not a trend).
  const tr = 1 + Math.min(0.3, Math.max(-0.7, (e.trend_yearly || 0) / 100));
  return { traffic_potential, traffic_basis: cal.traffic_basis, traffic_note: cal.traffic_note, modelled_traffic_potential: cal.modelled_traffic_potential,
    winnability: +win.toFixed(2), value_factor: +value.toFixed(2), pre_score: +(traffic_potential * win * value * iw * tr).toFixed(1) };
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
  competitor_domains: [...new Set(reqB.filter(r => r.kind === 'competitor').map(r => r.domain))], by_source: bySource, failures, requests: pairs.length,
  competitor_basis: (reqB[0] || {}).competitor_basis || null,   // A-24: how each competitor was chosen and which results were passed over
  // G8: how much of the pool came from the site's own Search Console, and how many estimates its data could check
  search_console: { available: !!SC.available, seeded: (base.gsc_seeds || []).length, measured: all.filter(e => e.gsc).length, only_source: gsc_only,
    calibrated: all.filter(e => e.traffic_basis === 'calibrated').length, modelled: all.filter(e => e.traffic_basis === 'modelled').length, period_end: SC.period_end || '' }
} } }];
