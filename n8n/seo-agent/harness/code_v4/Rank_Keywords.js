// Applies the AI relevance verdicts, computes the final opportunity score, builds topic clusters and the content plan,
// and chooses the priority keywords (live SERP check next) and the keyword for the content pipeline.
const base = $('Collect Research').first().json;
const chunks = $('Relevance Chunks').all().map(i => i.json);
const outs = $input.all().map(i => i.json);
const parse = (raw) => { if (raw && typeof raw === 'object') return raw; try { return JSON.parse(String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')); } catch (e) { return {}; } };
const INTENTS = ['informational', 'navigational', 'commercial', 'transactional'];
const PAGES = ['Service Page', 'Product Page', 'Landing Page', 'Comparison Page', 'Blog Post', 'Guide', 'FAQ Page', 'Location Page', 'Category Page'];
const defaultPage = (intent) => intent === 'informational' ? 'Guide' : intent === 'transactional' ? 'Landing Page' : 'Service Page';
const rel = new Map();
outs.forEach((o, i) => {
  const items = (parse(o.output).items) || [];
  const chunk = chunks[i] ? chunks[i].keywords_chunk : [];
  items.forEach((it, j) => {
    const kw = String(it.keyword || (chunk[j] || {}).keyword || '').toLowerCase().trim();
    if (!kw) return;
    rel.set(kw, { relevance: Math.max(0, Math.min(2, Number(it.relevance ?? 1))), intent: String(it.intent || '').toLowerCase(), page_type: it.page_type, topic: String(it.topic || '').toLowerCase().replace(/[^\w\s&-]/g, ' ').replace(/\s+/g, ' ').trim() });
  });
});
const RELF = { 2: 1, 1: 0.45, 0: 0 };
const ai_reviewed = rel.size;
const kws = (base.research.candidates || []).map(k => {
  const r = rel.get(k.keyword) || { relevance: 1, intent: k.intent, page_type: '', topic: '' };
  const intent = INTENTS.includes(r.intent) ? r.intent : k.intent;
  const page_type = PAGES.includes(r.page_type) ? r.page_type : defaultPage(intent);
  return { ...k, intent, relevance: r.relevance, page_type, topic: r.topic || k.keyword.split(' ').slice(0, 3).join(' '), opportunity: +(k.pre_score * (RELF[r.relevance] ?? 0.45)).toFixed(1), competitors_in_top20: k.competitors.length };
}).filter(k => k.relevance > 0 && k.intent !== 'navigational').sort((a, b) => b.opportunity - a.opportunity);

// ---- clusters (topic label from the AI pass) ----
const cl = new Map();
for (const k of kws) {
  const key = k.topic || 'other';
  if (!cl.has(key)) cl.set(key, { topic: key, keywords: [], total_volume: 0, total_opportunity: 0, page_types: {}, intents: {} });
  const c = cl.get(key); c.keywords.push(k); c.total_volume += k.volume; c.total_opportunity += k.opportunity;
  c.page_types[k.page_type] = (c.page_types[k.page_type] || 0) + 1; c.intents[k.intent] = (c.intents[k.intent] || 0) + 1;
}
const mode = (o) => (Object.entries(o).sort((a, b) => b[1] - a[1])[0] || [''])[0];
const clusters = [...cl.values()].map(c => { const p = c.keywords[0]; return {
  topic: c.topic, primary_keyword: p.keyword, page_type: mode(c.page_types), intent: mode(c.intents), keyword_count: c.keywords.length,
  total_volume: c.total_volume, total_opportunity: +c.total_opportunity.toFixed(1), primary_kd: p.kd, primary_volume: p.volume, primary_cpc: p.cpc,
  supporting: c.keywords.slice(1, 9).map(k => k.keyword), keywords: c.keywords.slice(0, 12).map(k => ({ keyword: k.keyword, volume: k.volume, kd: k.kd, intent: k.intent, opportunity: k.opportunity })),
  suggested_title: p.keyword.replace(/\b\w/g, m => m.toUpperCase())
}; }).sort((a, b) => b.total_opportunity - a.total_opportunity);
// Tiers follow the goal: for leads/sales the first "Now" slots go to commercial/transactional topics; research topics support them
const goalNow = (base.goal || 'leads');
const buyerIntent = (c) => c.intent === 'commercial' || c.intent === 'transactional';
const ordered = goalNow === 'traffic' ? clusters : [...clusters.filter(buyerIntent), ...clusters.filter(c => !buyerIntent(c))];
let now = 0, nxt = 0;
ordered.forEach(c => {
  const winnable = c.primary_kd == null || c.primary_kd <= 55;
  if (now < 5 && winnable && (goalNow === 'traffic' || buyerIntent(c) || now >= 4)) { c.tier = 'Now'; now++; }
  else if (nxt < 8) { c.tier = 'Next'; nxt++; }
  else c.tier = 'Later';
});
clusters.sort((a, b) => ({ Now: 0, Next: 1, Later: 2 }[a.tier] - { Now: 0, Next: 1, Later: 2 }[b.tier]) || b.total_opportunity - a.total_opportunity);

const quick_wins = kws.filter(k => k.relevance === 2 && k.kd != null && k.kd < 30 && k.volume >= 30).slice(0, 12);
const questions = kws.filter(k => /^(how|what|why|when|which|where|who|can|do|does|is|are|should|will)\b/.test(k.keyword)).slice(0, 15);
const long_tail = kws.filter(k => k.words >= 4 && k.relevance === 2).slice(0, 15);
const competitor_gaps = kws.filter(k => k.competitors.length && k.relevance === 2).sort((a, b) => b.volume - a.volume).slice(0, 20);
const by_intent = {}; INTENTS.forEach(x => by_intent[x] = kws.filter(k => k.intent === x).slice(0, 10));

// ---- priority keywords: best opportunity, at most 2 per topic ----
const priority = []; const per = {};
const pickPriority = (minVol) => { for (const k of kws) { if (priority.includes(k) || k.relevance < 2 || k.volume < minVol) continue; per[k.topic] = (per[k.topic] || 0) + 1; if (per[k.topic] > 2) continue; priority.push(k); if (priority.length >= 8) break; } };
pickPriority(50); if (priority.length < 8) pickPriority(20); if (priority.length < 5) pickPriority(0);
if (!priority.length) priority.push(...kws.slice(0, 8));
const goal = base.goal || 'leads';
const want = goal === 'traffic' ? ['informational', 'commercial'] : goal === 'brand' ? ['informational', 'commercial', 'transactional'] : ['commercial', 'transactional'];
const pipeline = kws.find(k => k.relevance === 2 && want.includes(k.intent) && (k.kd == null || k.kd <= 55)) || priority[0] || kws[0] || null;

return [{ json: { ...base, keyword_strategy: {
  goal, pool_size: base.research.pool_size, ai_reviewed, total_relevant: kws.length, keywords: kws.slice(0, 200),
  clusters, quick_wins, questions, long_tail, competitor_gaps, by_intent, priority, pipeline_keyword: pipeline,
  competitor_domains: base.research.competitor_domains, by_source: base.research.by_source, research_failures: base.research.failures
} } }];
