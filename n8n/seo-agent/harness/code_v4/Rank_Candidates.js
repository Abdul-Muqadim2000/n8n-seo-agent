const base = $('Seed List').first().json;
const items = $input.first().json.tasks?.[0]?.result?.[0]?.items || [];
const INTENTS = ['informational', 'navigational', 'commercial', 'transactional'];
const brand = String(base.domain || '').split('.')[0].toLowerCase();

const classify = (kw, intent) => {
  if (INTENTS.includes(intent)) return intent;
  const k = String(kw).toLowerCase();
  if (brand && k.includes(brand)) return 'navigational';
  if (/\b(price|pricing|cost|costs|buy|hire|quote|near me|licen[cs]e|subscription|free trial|demo)\b/.test(k)) return 'transactional';
  if (/\b(best|top|vs|versus|compare|comparison|review|reviews|alternatives?|services?|company|companies|agency|partner|partners|consultants?|consulting|providers?|firms?)\b/.test(k)) return 'commercial';
  return 'informational';
};
const W = { transactional: 1.3, commercial: 1.2, informational: 0.8, navigational: 0.3 };

const seen = new Set();
const all = [];
items.forEach(it => {
  const kd = it.keyword_data || it;
  const kw = String(kd.keyword || '').toLowerCase().trim();
  if (!kw || seen.has(kw)) return;
  seen.add(kw);
  const info = kd.keyword_info || {};
  const vol = info.search_volume ?? 0;
  if (!vol) return;
  const diff = (kd.keyword_properties || {}).keyword_difficulty ?? null;
  const intent = classify(kw, (kd.search_intent_info || {}).main_intent);
  all.push({ keyword: kw, volume: vol, difficulty: diff, cpc: info.cpc ?? null, intent,
    score: Math.round(vol * (1 - (diff ?? 50) / 100) * W[intent]) });
});

const candidates = all.filter(k => k.intent !== 'navigational')
  .sort((a, b) => b.score - a.score).slice(0, 6);

if (!candidates.length) {
  return [{ json: { keyword: base.seeds[0] || 'services', volume: null, difficulty: null, cpc: null, intent: 'commercial', score: 0, fallback: true } }];
}
return candidates.map(k => ({ json: k }));