// One DataForSEO request per question x engine (ChatGPT and Gemini = the real chatgpt.com / gemini.google.com answers through the LLM scraper;
// Perplexity and Claude = LLM Responses with web search, localised to the site's country; Google AI Mode with the question; the Google AI Overview on
// the matching search phrase), plus the monthly views of the AI-answer database (387M+ real questions; Google AI Overviews in every country, ChatGPT
// for US-English): the market view (who AI cites for the main topic), the market-wide index (how often answers cite you vs each competitor, weighted
// by AI search volume) and the real questions where AI cites you. Shared by the AI Visibility Tracker and the AI Pulse (plan field `pulse_run`:
// the fast engines only, no brand question, no database views). Costs measured live on 2026-10-02 / priced 2026-10-08.
// G6 (2026-10-18, AI_VISIBILITY_SPEC.md §10):
//  * every question is asked in ITS market (country + language, `markets_map` from the plan), not only the site's own;
//  * two more opt-in engines: the ChatGPT API and the Gemini API (DataForSEO LLM Responses with web search — what an agent or an app built
//    on those models answers, beside the consumer interfaces the scrapers read);
//  * the weekly run's requests are ONE deterministic list per site (questions in panel order, engines in a fixed order); an execution asks
//    the keys no earlier execution of the same run answered, at most its chunk (`AIP.slice`) — a resumed or repeated chunk never pays twice;
//  * the prices are the one table in _ai_panel.js (AIP.PRICE) and the cost caps follow the panel: the run may spend what the panel's exact
//    estimate says (+25%), never more than the tracker's ceiling.
/*__AI_PANEL__*/
const CONFIG = { max_requests_per_run: 900, max_cost_per_run_usd: 15, max_cost_per_pulse_usd: 4, headroom: 1.25,
  models: { perplexity: 'sonar', claude: 'claude-haiku-4-5', chatgpt_api: 'gpt-5.4-mini', gemini_api: 'gemini-3.5-flash' },
  cost: { ...AIP.PRICE, market: 0.115, index_sov: 0.11, index_you: 0.12 }, chat_gpt_location: 2840,
  order: ['chatgpt', 'gemini', 'perplexity', 'claude', 'ai_mode', 'copilot', 'ai_overview', 'chatgpt_api', 'gemini_api'] };
const API = 'https://api.dataforseo.com/v3/';
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
let fresh = []; try { fresh = $('Prompt Rows').all().map(i => i.json).filter(r => !r.skip && r.prompt_id && r.status !== 'off' && r.status !== 'refused' && r.status !== 'retired' && r.status !== 'proposed'); } catch (e) {}   // new questions (stored ones are in the plan already); a refused one is stored, never asked; AI-FOCUS: nor a retired one, nor one waiting for the owner
const out = []; let spend = 0; const skipped = []; const chunks = {};
// F2 (2026-10-23, ENGINE_AUDIT.md E1): the run's hard ceiling, per site — what is left of it after what earlier parts measured and committed
const siteSpend = {}; const capped = {};
const pulse = plans.some(p => p.pulse_run);
// G6: the cap follows the panel — what this run's exact estimate says it costs, with headroom, never under the v4.9 caps and never over the ceiling
const estAll = plans.reduce((t, p) => t + (pulse ? Number((p.cost_model || {}).pulse_day ? p.cost_model.pulse_day.dfs : 0) : Number(p.est_dfs_usd) || 0), 0);
const cap = Math.min(AIP.LIMITS.max_run_usd, Math.max(pulse ? CONFIG.max_cost_per_pulse_usd : CONFIG.max_cost_per_run_usd, CONFIG.headroom * estAll));
const maxReq = pulse ? Math.max(CONFIG.max_requests_per_run, AIP.LIMITS.pulse_max_requests) : AIP.LIMITS.exec_requests + 40;   // + the database views of the last chunk
const add = (p, q, engine, endpoint, body) => {
  const c = CONFIG.cost[engine] || 0.01;
  if (out.length >= maxReq || spend + c > cap) { skipped.push(p.domain + ':' + engine); return; }
  const left = p.chunk && p.chunk.ceiling_left_usd != null && !p.pulse_run ? Number(p.chunk.ceiling_left_usd) : null;
  if (left != null && (siteSpend[p.site_id] || 0) + c > left + 1e-9) { capped[p.site_id] = (capped[p.site_id] || 0) + 1; skipped.push(p.domain + ':' + engine + ' (run ceiling)'); return; }
  siteSpend[p.site_id] = (siteSpend[p.site_id] || 0) + c;
  spend += c; out.push({ json: { site_id: p.site_id, domain: p.domain, run_id: p.run_id, run_kind: p.run_kind || 'weekly', prompt_id: q.prompt_id, prompt: q.prompt, kind: q.kind, topic: q.topic, keyword: q.keyword, engine, endpoint: API + endpoint, body, est_cost: c,
    market: q.market || p.own_market || '', persona: q.persona || '', cluster: q.cluster || q.topic || '', stage: q.stage || '', ...(q.market_fallback ? { market_fallback: true } : {}) } });   // F2 (E22): asked in the own market because its own is past the cap
};
// the countries Claude's web search accepts (DataForSEO docs, 2026-10); any other code is refused with 40501
const CLAUDE_GEO = new Set('AR AT AU BE BR CA CH CL CN DE DK ES FI FR GB HK ID IN IT JP KR MX MY NL NO NZ PH PL PT RU SA SE TR TW US ZA'.split(' '));
for (const p of plans) {
  const known = new Set(p.prompts.map(x => x.prompt_id));
  const qs = [...p.prompts, ...fresh.filter(r => r.site_id === p.site_id && !known.has(r.prompt_id)).map(r => ({ prompt_id: r.prompt_id, prompt: r.prompt, kind: r.kind, topic: r.topic, keyword: r.keyword, source: r.source,
    persona: r.persona || '', market: r.market || '', cluster: r.cluster || '', stage: r.stage || '', keyword_source: r.keyword_source || '' }))].slice(0, p.prompts_max);
  const locOf = (q) => { const m = (p.markets_map || {})[q.market || p.own_market] || null; return m ? { location_code: m.location_code, language_code: m.language_code } : { location_code: p.location_code, language_code: p.language_code }; };
  const isoOf = (q) => { const m = (p.markets_map || {})[q.market || p.own_market] || null; return String((m && m.country_iso) || p.country_iso || '').toUpperCase(); };
  // every request this execution may owe for the site, in the run's one order
  const want = [];
  const seenKw = new Set();
  for (const q of qs) {
    if (q.kind === 'brand' && (p.pulse_run || !p.full_due)) continue;   // brand recognition hardly changes week to week: once a month
    const e = p.pulse_run ? (p.pulse_engines || []) : p.engines.filter(x => p.full_due || !(p.monthly_engines || []).includes(x));   // Claude once a month (v4.6/v4.9)
    const loc = locOf(q); const iso = isoOf(q); const geo = /^[A-Z]{2}$/.test(iso) ? { web_search_country_iso_code: iso } : {};
    for (const engine of CONFIG.order) {
      if (!e.includes(engine)) continue;
      if (engine === 'chatgpt') want.push([q, engine, 'ai_optimization/chat_gpt/llm_scraper/live/advanced', [{ keyword: q.prompt, ...loc }]]);
      if (engine === 'gemini') want.push([q, engine, 'ai_optimization/gemini/llm_scraper/live/advanced', [{ keyword: q.prompt, ...loc }]]);
      if (engine === 'perplexity') want.push([q, engine, 'ai_optimization/perplexity/llm_responses/live', [{ user_prompt: q.prompt, model_name: CONFIG.models.perplexity, max_output_tokens: 1000, ...geo }]]);
      if (engine === 'claude') want.push([q, engine, 'ai_optimization/claude/llm_responses/live', [{ user_prompt: q.prompt, model_name: CONFIG.models.claude, web_search: true, max_output_tokens: 1200, ...(CLAUDE_GEO.has(iso) ? geo : {}) }]]);   // Claude localises only to its listed countries (AE is not one: 40501 live 2026-10-08); elsewhere the questions name the country
      if (engine === 'ai_mode') want.push([q, engine, 'serp/google/ai_mode/live/advanced', [{ keyword: q.prompt, ...loc }]]);
      if (engine === 'copilot' && q.kind !== 'brand') want.push([q, engine, 'serp/bing/organic/live/advanced', [{ keyword: q.prompt.slice(0, 700), ...loc, depth: 10 }]]);   // v4.12: Copilot Search (Bing shows it for many questions, not all: no summary = no answer, like AI Overviews)
      // G6: the model APIs, with web search. NEEDS ONE LIVE CALL (AI_PANEL_SCALE_HANDOFF.md §7): `web_search` and `max_output_tokens` on these
      // two models and `web_search_country_iso_code` on chat_gpt — the sandbox refused max_output_tokens on o4-mini but does not validate every field
      if (engine === 'chatgpt_api') want.push([q, engine, 'ai_optimization/chat_gpt/llm_responses/live', [{ user_prompt: q.prompt, model_name: CONFIG.models.chatgpt_api, web_search: true, max_output_tokens: 1200, ...geo }]]);
      if (engine === 'gemini_api') want.push([q, engine, 'ai_optimization/gemini/llm_responses/live', [{ user_prompt: q.prompt, model_name: CONFIG.models.gemini_api, web_search: true, max_output_tokens: 1200 }]]);
      const kw = String(q.keyword || '').trim().toLowerCase();
      // F2 (E9): a search phrase built from the question's own words is not a search anyone typed: Google's AI Overview is not asked for it
      if (engine === 'ai_overview' && kw && q.kind !== 'brand' && q.keyword_source !== 'derived' && !seenKw.has((q.market || '') + '|' + kw)) { seenKw.add((q.market || '') + '|' + kw); want.push([q, engine, 'serp/google/organic/live/advanced', [{ keyword: kw, ...loc, depth: 10, load_async_ai_overview: true }]]); }
    }
  }
  // G6: the weekly run is split across executions — this one asks the keys still owed, at most its chunk (the last chunk: all that is left)
  const c = p.chunk || null;
  const all = want.map(([q, engine]) => ({ prompt_id: q.prompt_id, engine }));
  const sl = p.pulse_run || !c ? { now: all, left: 0, done: 0, total: all.length, final: true } : AIP.slice(all, p.done_keys || [], c.final_expected ? all.length + 1 : Math.max(1, c.size));
  const nowKeys = new Set(sl.now.map(r => AIP.reqKey(r.prompt_id, r.engine)));
  const before = out.length;
  for (const [q, engine, endpoint, body] of want) if (nowKeys.has(AIP.reqKey(q.prompt_id, engine)) && (p.pulse_run || !c || c.size > 0 || c.final_expected)) add(p, q, engine, endpoint, body);
  chunks[p.site_id] = { site_id: p.site_id, domain: p.domain, run_id: p.run_id, total: sl.total, done_before: sl.done, asked_now: out.length - before, left_after: Math.max(0, sl.total - sl.done - (out.length - before)),
    final: !c || !!c.final_expected, no: c ? c.no : 1, capped_by_ceiling: capped[p.site_id] || 0, market_fallback: want.filter(([q]) => q.market_fallback).length };
  if (p.pulse_run) continue;
  if (c && !c.final_expected) continue;   // the database views belong to the run's last execution
  const platforms = ['google', ...(p.location_code === CONFIG.chat_gpt_location && p.language_code === 'en' ? ['chat_gpt'] : [])];   // the database holds ChatGPT answers for US-English only
  const loc = { location_code: p.location_code, language_code: p.language_code };
  if (p.market_due && p.market_keyword) add(p, { prompt_id: 'market', prompt: p.market_keyword, kind: 'market', topic: p.market_keyword, keyword: p.market_keyword }, 'market', 'ai_optimization/llm_mentions/top_mentioned_domains/live', [{ target: [{ keyword: p.market_keyword }], ...loc, platform: 'google', limit: 15 }]);
  if (p.index_due) for (const platform of platforms) {
    const targets = [{ key: p.domain, target: [{ domain: p.domain }] }, ...p.competitors.filter(c0 => /\./.test(c0) && c0 !== p.domain).slice(0, 8).map(c0 => ({ key: c0, target: [{ domain: c0 }] }))];
    if (p.business_name && p.business_name.length >= 4 && targets.length < 10) targets.push({ key: 'name:' + p.business_name, target: [{ keyword: p.business_name.slice(0, 250), search_scope: ['answer'], match_type: 'word_match' }] });
    if (targets.length >= 2) add(p, { prompt_id: 'index', prompt: 'market-wide share', kind: 'index', topic: platform, keyword: platform }, 'index_sov', 'ai_optimization/llm_mentions/multi_target_metrics/live', [{ targets, ...loc, platform }]);
    add(p, { prompt_id: 'index', prompt: 'questions citing you', kind: 'index', topic: platform, keyword: platform }, 'index_you', 'ai_optimization/llm_mentions/search_mentions/live', [{ target: [{ domain: p.domain }], ...loc, platform, order_by: ['ai_search_volume,desc'], limit: 20 }]);
  }
}
if (!out.length) return [{ json: { skip: true, reason: plans.length ? (plans.some(p => p.chunk && !p.chunk.final_expected) ? 'nothing left to ask in this part of the run' : 'no questions to ask (no topics and no business name on file)') : 'nothing to do', skipped, chunks: Object.values(chunks) } }];
out[0].json.skipped_by_cap = skipped;
out[0].json.chunks = Object.values(chunks);   // G6: per site, what this execution asked of its run and what is left (read by AI Chunk Handoff / AI Metrics)
out[0].json.cost_cap_usd = +cap.toFixed(2);
return out;
