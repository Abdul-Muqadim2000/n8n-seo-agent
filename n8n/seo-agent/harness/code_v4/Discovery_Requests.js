// Question discovery and volumes (v4.9): on the month's full run (or when the panel is short) the AI-answer database is searched for the real
// questions people ask about the site's main topics (DataForSEO LLM Mentions search_mentions: Google AI Overview answers in the site's country,
// plus ChatGPT answers for US-English sites, the only market the database holds for ChatGPT), and the monthly AI search volume of the panel's
// search phrases is looked up (AI Keyword Data, $0.0001 a phrase). The Prompt Writer uses the real questions; volumes weight the visibility score.
// G6 (2026-10-18): a panel growing by many questions reads more of the database (up to 4 topics, not 2) and, when it grows by 10 or more, the
// "People also ask" box of each topic in each market the panel covers (serp/google/organic, $0.002 a results page) — Google's own list of the
// questions people ask next. Both feed the Prompt Writer's cells (market x buyer role).
const API = 'https://api.dataforseo.com/v3/';
const CONFIG = { topics: 2, topics_big: 4, big_at: 100, limit: 40, chat_gpt_location: 2840, paa_at: 10, paa_topics: 6, paa_markets: 3 };
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const out = [];
for (const p of plans) {
  const loc = { location_code: p.location_code, language_code: p.language_code };
  const nTopics = (Number(p.prompts_needed) || 0) >= CONFIG.big_at ? CONFIG.topics_big : CONFIG.topics;
  if (p.discovery_due) for (const t of p.topics.slice(0, nTopics)) {
    const target = [{ keyword: t.slice(0, 250), search_scope: ['question'], match_type: 'word_match' }];
    out.push({ json: { site_id: p.site_id, kind: 'discover', topic: t, platform: 'google', endpoint: API + 'ai_optimization/llm_mentions/search_mentions/live', body: [{ target, ...loc, platform: 'google', order_by: ['ai_search_volume,desc'], limit: CONFIG.limit }], est_cost: 0.14 } });
    if (p.location_code === CONFIG.chat_gpt_location && p.language_code === 'en') out.push({ json: { site_id: p.site_id, kind: 'discover', topic: t, platform: 'chat_gpt', endpoint: API + 'ai_optimization/llm_mentions/search_mentions/live', body: [{ target, ...loc, platform: 'chat_gpt', order_by: ['ai_search_volume,desc'], limit: CONFIG.limit }], est_cost: 0.14 } });
  }
  // G6: People-also-ask per topic and market, only when the panel grows by enough to use it
  if ((Number(p.prompts_needed) || 0) >= CONFIG.paa_at && (p.topics || []).length) {
    const mk = (p.markets && p.markets.length ? p.markets : [p.own_market || '']).slice(0, CONFIG.paa_markets);
    for (const m of mk) { const ml = (p.markets_map || {})[m] || null; const l = ml ? { location_code: ml.location_code, language_code: ml.language_code } : loc;
      for (const t of p.topics.slice(0, CONFIG.paa_topics)) out.push({ json: { site_id: p.site_id, kind: 'paa', topic: t, market: m, endpoint: API + 'serp/google/organic/live/advanced', body: [{ keyword: t.slice(0, 200), ...l, depth: 10 }], est_cost: 0.002 } }); }
  }
  if (p.volume_keywords.length) out.push({ json: { site_id: p.site_id, kind: 'volume', endpoint: API + 'ai_optimization/ai_keyword_data/keywords_search_volume/live', body: [{ keywords: p.volume_keywords, ...loc }], est_cost: 0.01 + 0.0001 * p.volume_keywords.length } });
}
return out.length ? out : [{ json: { skip: true } }];
