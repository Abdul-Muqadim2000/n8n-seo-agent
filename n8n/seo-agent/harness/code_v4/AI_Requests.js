// One DataForSEO request per question x engine (ChatGPT = the real chatgpt.com answer through the LLM scraper; Perplexity, Gemini and Claude =
// LLM Responses with web search; Google AI Mode with the question; the Google AI Overview on the matching search phrase), plus the monthly market
// view (LLM Mentions: which domains AI answers cite for the main topic). Costs measured live on 2026-10-02.
const CONFIG = { max_requests_per_run: 500, max_cost_per_run_usd: 12,
  models: { perplexity: 'sonar', gemini: 'gemini-3.5-flash', claude: 'claude-haiku-4-5' },
  cost: { chatgpt: 0.004, perplexity: 0.006, gemini: 0.035, claude: 0.025, ai_overview: 0.002, ai_mode: 0.004, market: 0.115 } };
const API = 'https://api.dataforseo.com/v3/';
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
let fresh = []; try { fresh = $('Prompt Rows').all().map(i => i.json).filter(r => !r.skip && r.prompt_id); } catch (e) {}
const out = []; let spend = 0; const skipped = [];
const add = (p, q, engine, endpoint, body) => {
  const c = CONFIG.cost[engine] || 0.01;
  if (out.length >= CONFIG.max_requests_per_run || spend + c > CONFIG.max_cost_per_run_usd) { skipped.push(p.domain + ':' + engine); return; }
  spend += c; out.push({ json: { site_id: p.site_id, domain: p.domain, run_id: p.run_id, prompt_id: q.prompt_id, prompt: q.prompt, kind: q.kind, topic: q.topic, keyword: q.keyword, engine, endpoint: API + endpoint, body, est_cost: c } });
};
for (const p of plans) {
  const qs = [...p.prompts, ...fresh.filter(r => r.site_id === p.site_id).map(r => ({ prompt_id: r.prompt_id, prompt: r.prompt, kind: r.kind, topic: r.topic, keyword: r.keyword, source: r.source }))].slice(0, p.prompts_max);
  const loc = { location_code: p.location_code, language_code: p.language_code };
  const seenKw = new Set();
  for (const q of qs) {
    const e = p.engines;
    if (e.includes('chatgpt')) add(p, q, 'chatgpt', 'ai_optimization/chat_gpt/llm_scraper/live/advanced', [{ keyword: q.prompt, ...loc }]);
    if (e.includes('perplexity')) add(p, q, 'perplexity', 'ai_optimization/perplexity/llm_responses/live', [{ user_prompt: q.prompt, model_name: CONFIG.models.perplexity, max_output_tokens: 1000 }]);
    if (e.includes('gemini')) add(p, q, 'gemini', 'ai_optimization/gemini/llm_responses/live', [{ user_prompt: q.prompt, model_name: CONFIG.models.gemini, web_search: true, max_output_tokens: 1200 }]);
    if (e.includes('claude')) add(p, q, 'claude', 'ai_optimization/claude/llm_responses/live', [{ user_prompt: q.prompt, model_name: CONFIG.models.claude, web_search: true, max_output_tokens: 1200 }]);
    if (e.includes('ai_mode')) add(p, q, 'ai_mode', 'serp/google/ai_mode/live/advanced', [{ keyword: q.prompt, ...loc }]);
    const kw = String(q.keyword || '').trim().toLowerCase();
    if (e.includes('ai_overview') && kw && q.kind !== 'brand' && !seenKw.has(kw)) { seenKw.add(kw); add(p, q, 'ai_overview', 'serp/google/organic/live/advanced', [{ keyword: kw, ...loc, depth: 10, load_async_ai_overview: true }]); }
  }
  if (p.market_due && p.market_keyword) add(p, { prompt_id: 'market', prompt: p.market_keyword, kind: 'market', topic: p.market_keyword, keyword: p.market_keyword }, 'market', 'ai_optimization/llm_mentions/top_domains/live', [{ target: [{ keyword: p.market_keyword }], ...loc, limit: 15 }]);
}
if (!out.length) return [{ json: { skip: true, reason: plans.length ? 'no questions to ask (no topics and no business name on file)' : 'nothing to do', skipped } }];
out[0].json.skipped_by_cap = skipped;
return out;
