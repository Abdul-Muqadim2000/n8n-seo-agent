const base = $('Competitor Analysis').first().json;
const targets = $('KW Targets').all().map(i => i.json);
const ranked = $('Ranked Keywords').all().map(i => i.json);
const ideasRes = $input.first().json || {};
const seeds = $('Fallback Queries').all().map(i => i.json.query).filter(Boolean);
const INTENTS = ['informational', 'navigational', 'commercial', 'transactional'];
const brand = base.domain.split('.')[0].toLowerCase();

// Intent: DataForSEO ka ho to wahi, warna alfaaz se andaza
const classify = (kw, intent) => {
  if (INTENTS.includes(intent)) return intent;
  const k = String(kw).toLowerCase();
  if (k.includes(brand)) return 'navigational';
  if (/\b(price|pricing|cost|costs|buy|hire|quote|near me|licen[cs]e|subscription|free trial|demo)\b/.test(k)) return 'transactional';
  if (/\b(best|top|vs|versus|compare|comparison|review|reviews|alternatives?|services?|company|companies|agency|partner|partners|consultants?|consulting|providers?|firms?)\b/.test(k)) return 'commercial';
  return 'informational';
};

// ---------- Ranked keywords (aap + competitors) ----------
const byDomain = targets.map((t, i) => {
  const items = ranked[i]?.tasks?.[0]?.result?.[0]?.items || [];
  const kws = items.map(it => {
    const kd = it.keyword_data || {};
    const info = kd.keyword_info || {};
    const se = (it.ranked_serp_element || {}).serp_item || {};
    const kw = String(kd.keyword || '').toLowerCase();
    return {
      keyword: kw,
      volume: info.search_volume ?? 0,
      cpc: info.cpc ?? null,
      difficulty: (kd.keyword_properties || {}).keyword_difficulty ?? null,
      intent: classify(kw, (kd.search_intent_info || {}).main_intent),
      position: se.rank_group ?? null,
      url: se.url || null
    };
  }).filter(k => k.keyword);
  const by_intent = {};
  INTENTS.forEach(x => by_intent[x] = kws.filter(k => k.intent === x).length);
  return {
    domain: t.domain, is_you: t.is_you,
    total: kws.length,
    top3: kws.filter(k => k.position && k.position <= 3).length,
    top10: kws.filter(k => k.position && k.position <= 10).length,
    by_intent, keywords: kws
  };
});

const you = byDomain.find(d => d.is_you) || { keywords: [], by_intent: {}, total: 0, top10: 0 };
const comps = byDomain.filter(d => !d.is_you);
const median = (arr) => { const a = arr.filter(v => v != null).sort((x, y) => x - y); if (!a.length) return null; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

// Competitor rankings ka map: keyword -> [{domain, position}]
const compRank = {};
comps.forEach(c => c.keywords.forEach(k => {
  if (!k.position || k.position > 10) return;
  (compRank[k.keyword] = compRank[k.keyword] || []).push({ domain: c.domain, position: k.position });
}));
const yourPos = {};
you.keywords.forEach(k => { yourPos[k.keyword] = k.position; });

// ---------- Aapke top keywords har intent mein ----------
const your_top_by_intent = {};
INTENTS.forEach(x => {
  your_top_by_intent[x] = you.keywords.filter(k => k.intent === x)
    .sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 8);
});

// ---------- Keyword opportunities (4 intents) ----------
const ideaItems = ideasRes.tasks?.[0]?.result?.[0]?.items || [];
const seen = new Set();
const ideas = [];
ideaItems.forEach(it => {
  const kd = it.keyword_data || it;
  const kw = String(kd.keyword || '').toLowerCase().trim();
  if (!kw || seen.has(kw)) return;
  seen.add(kw);
  const info = kd.keyword_info || {};
  const vol = info.search_volume ?? 0;
  if (!vol) return;
  ideas.push({
    keyword: kw,
    volume: vol,
    difficulty: (kd.keyword_properties || {}).keyword_difficulty ?? null,
    cpc: info.cpc ?? null,
    intent: classify(kw, (kd.search_intent_info || {}).main_intent),
    your_position: yourPos[kw] ?? null,
    competitors: compRank[kw] || []
  });
});
// Competitors ke keywords bhi opportunities mein (jo ideas mein na hon)
Object.entries(compRank).forEach(([kw, list]) => {
  if (seen.has(kw)) return;
  const src = comps.flatMap(c => c.keywords).find(k => k.keyword === kw) || {};
  seen.add(kw);
  ideas.push({ keyword: kw, volume: src.volume || 0, difficulty: src.difficulty ?? null, cpc: src.cpc ?? null, intent: src.intent || classify(kw), your_position: yourPos[kw] ?? null, competitors: list });
});

const notWinning = ideas.filter(k => !k.your_position || k.your_position > 10);
const opportunities_by_intent = {};
INTENTS.forEach(x => {
  opportunities_by_intent[x] = notWinning.filter(k => k.intent === x)
    .sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 10);
});
const easy_wins = notWinning
  .filter(k => k.difficulty != null && k.difficulty < 30 && k.volume >= 20)
  .sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 10);

// ---------- Keyword gap ----------
const keyword_gap = notWinning.filter(k => k.competitors.length && (!k.your_position || k.your_position > 20))
  .sort((a, b) => b.competitors.length - a.competitors.length || (b.volume || 0) - (a.volume || 0))
  .slice(0, 25);

// ---------- Page 1 ke qareeb ----------
const striking_distance = you.keywords.filter(k => k.position >= 11 && k.position <= 20)
  .sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 10);

// ---------- Findings ----------
const findings = [];
const works = [];
const F = (severity, title, evidence, why, fix) => findings.push({
  category: 'Authority', severity, title, evidence, why, fix,
  sample_urls: [], affected_count: null, affected_pct: 100, scope: 'site'
});

if (keyword_gap.length) {
  F('High', 'Keyword gap: searches competitors win and you do not',
    keyword_gap.length + ' keywords where competitors rank in the top 10 and you are not in the top 20. Top: ' +
    keyword_gap.slice(0, 5).map(g => '"' + g.keyword + '" (' + (g.volume || 0) + '/mo)').join(', '),
    'Each of these is proven demand in your market that is currently going to competitors.',
    'Create or improve a dedicated page for the highest-volume, lowest-difficulty gap keywords first.');
}
INTENTS.forEach(x => {
  const med = median(comps.map(c => c.by_intent[x]));
  if ((you.by_intent[x] || 0) === 0 && med != null && med >= 5) {
    F('Medium', 'No rankings for ' + x + ' searches',
      'You rank for 0 ' + x + ' keywords vs competitor median ' + med,
      'You are missing a whole stage of the buyer journey that competitors capture.',
      x === 'informational' ? 'Publish helpful guides that answer the questions buyers research.' :
      x === 'commercial' ? 'Add comparison, "best", pricing and service-selection pages.' :
      x === 'transactional' ? 'Strengthen service and contact pages around buy/hire/quote searches.' :
      'Make sure branded searches lead clearly to your site.');
  }
});
if (easy_wins.length) {
  F('Low', 'Low-difficulty keywords you can target now',
    easy_wins.slice(0, 5).map(k => '"' + k.keyword + '" (' + k.volume + '/mo, difficulty ' + k.difficulty + ')').join(', '),
    'These searches have real demand and weak competition, the best starting point for a young site.',
    'Build or optimise one focused page per keyword group, starting with the highest volume.');
}
if (striking_distance.length) {
  F('Low', 'Keywords close to page 1 (positions 11-20)',
    striking_distance.slice(0, 5).map(k => '"' + k.keyword + '" #' + k.position).join(', '),
    'These are the fastest wins: small improvements can move them onto page 1.',
    'Improve the ranking page (depth, internal links, title) for each of these keywords.');
}
if (you.top10 > 0) works.push('Ranks in the Google top 10 for ' + you.top10 + ' keywords');

return [{
  json: {
    ...base,
    site_keywords: {
      seeds,
      domains: byDomain.map(d => ({ domain: d.domain, is_you: d.is_you, total: d.total, top3: d.top3, top10: d.top10, by_intent: d.by_intent })),
      your_top_by_intent,
      opportunities_by_intent,
      easy_wins,
      keyword_gap,
      striking_distance
    },
    extra_findings: [...(base.extra_findings || []), ...findings],
    extra_works: [...(base.extra_works || []), ...works]
  }
}];