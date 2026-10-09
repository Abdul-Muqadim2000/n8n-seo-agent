// Question discovery and volumes (v4.9): on the month's full run (or when the panel is short) the AI-answer database is searched for the real
// questions people ask about the site's main topics (DataForSEO LLM Mentions search_mentions: Google AI Overview answers in the site's country,
// plus ChatGPT answers for US-English sites, the only market the database holds for ChatGPT), and the monthly AI search volume of the panel's
// search phrases is looked up (AI Keyword Data, $0.0001 a phrase). The Prompt Writer uses the real questions; volumes weight the visibility score.
const API = 'https://api.dataforseo.com/v3/';
const CONFIG = { topics: 2, limit: 40, chat_gpt_location: 2840 };
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const out = [];
for (const p of plans) {
  const loc = { location_code: p.location_code, language_code: p.language_code };
  if (p.discovery_due) for (const t of p.topics.slice(0, CONFIG.topics)) {
    const target = [{ keyword: t.slice(0, 250), search_scope: ['question'], match_type: 'word_match' }];
    out.push({ json: { site_id: p.site_id, kind: 'discover', topic: t, platform: 'google', endpoint: API + 'ai_optimization/llm_mentions/search_mentions/live', body: [{ target, ...loc, platform: 'google', order_by: ['ai_search_volume,desc'], limit: CONFIG.limit }], est_cost: 0.14 } });
    if (p.location_code === CONFIG.chat_gpt_location && p.language_code === 'en') out.push({ json: { site_id: p.site_id, kind: 'discover', topic: t, platform: 'chat_gpt', endpoint: API + 'ai_optimization/llm_mentions/search_mentions/live', body: [{ target, ...loc, platform: 'chat_gpt', order_by: ['ai_search_volume,desc'], limit: CONFIG.limit }], est_cost: 0.14 } });
  }
  if (p.volume_keywords.length) out.push({ json: { site_id: p.site_id, kind: 'volume', endpoint: API + 'ai_optimization/ai_keyword_data/keywords_search_volume/live', body: [{ keywords: p.volume_keywords, ...loc }], est_cost: 0.01 + 0.0001 * p.volume_keywords.length } });
}
return out.length ? out : [{ json: { skip: true } }];
