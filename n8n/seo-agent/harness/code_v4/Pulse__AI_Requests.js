// One DataForSEO request per question x engine (ChatGPT and Gemini = the real chatgpt.com / gemini.google.com answers through the LLM scraper;
// Perplexity and Claude = LLM Responses with web search, localised to the site's country; Google AI Mode with the question; the Google AI Overview on
// the matching search phrase), plus the monthly views of the AI-answer database (387M+ real questions; Google AI Overviews in every country, ChatGPT
// for US-English): the market view (who AI cites for the main topic), the market-wide index (how often answers cite you vs each competitor, weighted
// by AI search volume) and the real questions where AI cites you. Shared by the AI Visibility Tracker and the AI Pulse (plan field `pulse_run`:
// the fast engines only, no brand question, no database views). Costs measured live on 2026-10-02 / priced 2026-10-08.
const CONFIG = { max_requests_per_run: 900, max_cost_per_run_usd: 15, max_cost_per_pulse_usd: 4,
  models: { perplexity: 'sonar', claude: 'claude-haiku-4-5' },
  cost: { chatgpt: 0.004, gemini: 0.004, perplexity: 0.006, claude: 0.025, ai_overview: 0.002, ai_mode: 0.004, market: 0.115, index_sov: 0.11, index_you: 0.12 }, chat_gpt_location: 2840 };
const API = 'https://api.dataforseo.com/v3/';
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
let fresh = []; try { fresh = $('Prompt Rows').all().map(i => i.json).filter(r => !r.skip && r.prompt_id && r.status !== 'off'); } catch (e) {}   // new questions (stored ones are in the plan already)
const out = []; let spend = 0; const skipped = [];
const cap = plans.some(p => p.pulse_run) ? CONFIG.max_cost_per_pulse_usd : CONFIG.max_cost_per_run_usd;
const add = (p, q, engine, endpoint, body) => {
  const c = CONFIG.cost[engine] || 0.01;
  if (out.length >= CONFIG.max_requests_per_run || spend + c > cap) { skipped.push(p.domain + ':' + engine); return; }
  spend += c; out.push({ json: { site_id: p.site_id, domain: p.domain, run_id: p.run_id, run_kind: p.run_kind || 'weekly', prompt_id: q.prompt_id, prompt: q.prompt, kind: q.kind, topic: q.topic, keyword: q.keyword, engine, endpoint: API + endpoint, body, est_cost: c } });
};
for (const p of plans) {
  const known = new Set(p.prompts.map(x => x.prompt_id));
  const qs = [...p.prompts, ...fresh.filter(r => r.site_id === p.site_id && !known.has(r.prompt_id)).map(r => ({ prompt_id: r.prompt_id, prompt: r.prompt, kind: r.kind, topic: r.topic, keyword: r.keyword, source: r.source }))].slice(0, p.prompts_max);
  const loc = { location_code: p.location_code, language_code: p.language_code };
  const iso = String(p.country_iso || '').toUpperCase(); const geo = /^[A-Z]{2}$/.test(iso) ? { web_search_country_iso_code: iso } : {};
  const seenKw = new Set();
  for (const q of qs) {
    if (q.kind === 'brand' && (p.pulse_run || !p.full_due)) continue;   // brand recognition hardly changes week to week: once a month
    const e = p.pulse_run ? (p.pulse_engines || []) : p.engines.filter(x => p.full_due || !(p.monthly_engines || []).includes(x));   // Claude once a month (v4.6/v4.9)
    if (e.includes('chatgpt')) add(p, q, 'chatgpt', 'ai_optimization/chat_gpt/llm_scraper/live/advanced', [{ keyword: q.prompt, ...loc }]);
    if (e.includes('gemini')) add(p, q, 'gemini', 'ai_optimization/gemini/llm_scraper/live/advanced', [{ keyword: q.prompt, ...loc }]);
    if (e.includes('perplexity')) add(p, q, 'perplexity', 'ai_optimization/perplexity/llm_responses/live', [{ user_prompt: q.prompt, model_name: CONFIG.models.perplexity, max_output_tokens: 1000, ...geo }]);
    if (e.includes('claude')) add(p, q, 'claude', 'ai_optimization/claude/llm_responses/live', [{ user_prompt: q.prompt, model_name: CONFIG.models.claude, web_search: true, max_output_tokens: 1200 }]);   // no geo: Claude's endpoint refuses web_search_country_iso_code (40501, live 2026-10-08); the questions name the country
    if (e.includes('ai_mode')) add(p, q, 'ai_mode', 'serp/google/ai_mode/live/advanced', [{ keyword: q.prompt, ...loc }]);
    const kw = String(q.keyword || '').trim().toLowerCase();
    if (e.includes('ai_overview') && kw && q.kind !== 'brand' && !seenKw.has(kw)) { seenKw.add(kw); add(p, q, 'ai_overview', 'serp/google/organic/live/advanced', [{ keyword: kw, ...loc, depth: 10, load_async_ai_overview: true }]); }
  }
  if (p.pulse_run) continue;
  const platforms = ['google', ...(p.location_code === CONFIG.chat_gpt_location && p.language_code === 'en' ? ['chat_gpt'] : [])];   // the database holds ChatGPT answers for US-English only
  if (p.market_due && p.market_keyword) add(p, { prompt_id: 'market', prompt: p.market_keyword, kind: 'market', topic: p.market_keyword, keyword: p.market_keyword }, 'market', 'ai_optimization/llm_mentions/top_mentioned_domains/live', [{ target: [{ keyword: p.market_keyword }], ...loc, platform: 'google', limit: 15 }]);
  if (p.index_due) for (const platform of platforms) {
    const targets = [{ key: p.domain, target: [{ domain: p.domain }] }, ...p.competitors.filter(c => /\./.test(c) && c !== p.domain).slice(0, 8).map(c => ({ key: c, target: [{ domain: c }] }))];
    if (p.business_name && p.business_name.length >= 4 && targets.length < 10) targets.push({ key: 'name:' + p.business_name, target: [{ keyword: p.business_name.slice(0, 250), search_scope: ['answer'], match_type: 'word_match' }] });
    if (targets.length >= 2) add(p, { prompt_id: 'index', prompt: 'market-wide share', kind: 'index', topic: platform, keyword: platform }, 'index_sov', 'ai_optimization/llm_mentions/multi_target_metrics/live', [{ targets, ...loc, platform }]);
    add(p, { prompt_id: 'index', prompt: 'questions citing you', kind: 'index', topic: platform, keyword: platform }, 'index_you', 'ai_optimization/llm_mentions/search_mentions/live', [{ target: [{ domain: p.domain }], ...loc, platform, order_by: ['ai_search_volume,desc'], limit: 20 }]);
  }
}
if (!out.length) return [{ json: { skip: true, reason: plans.length ? 'no questions to ask (no topics and no business name on file)' : 'nothing to do', skipped } }];
out[0].json.skipped_by_cap = skipped;
return out;
