// W2-E2 (2026-10-23, docs/ai-visibility-2026-10-23/fixes/W2-E2.md): the one-off REPEAT PILOT for one website (on demand only; this workflow has
// no schedule). 10 questions of its panel (one per topic group first) are asked 10 times each on every engine that answers differently on
// each ask (the AI Overview and Copilot are left out: one results page per search), so the variance of "named or not" can be split into
// BETWEEN questions and WITHIN one question (asked again). Pilot Metrics turns that into the repeats per engine a target precision needs.
// It is priced before anything is spent: without `confirm: true` on the start, the run answers with the price and the plan, and asks nothing.
/*__MONITOR_SITES__*/
/*__COUNTRIES__*/
/*__AI_PANEL__*/
/*__AI_ENTITIES__*/
const CONFIG = { questions: 10, repeats: 10, engines: ['chatgpt', 'gemini', 'perplexity', 'ai_mode', 'claude', 'chatgpt_api', 'gemini_api'], max_usd: 4 };
const { list, on_demand, want } = monitorSites('ai');
if (!on_demand) return [{ json: { nothing_to_do: true, reason: 'the repeat pilot runs on demand only, for one website (domain or site_id)' } }];
if (!list.length) return [{ json: { nothing_to_do: true, reason: 'no site matches "' + want + '"' } }];
const s = list[0]; const confirm = trigger && (trigger.confirm === true || String(trigger.confirm) === 'true');
const promptRows = rowsOf('Load AI Prompts'), cache = rowsOf('Load Cache (AI)'), visRows = rowsOf('Load AI Visibility');
const parse = (t, d) => { try { const v = JSON.parse(t || ''); return v == null ? d : v; } catch (e) { return d; } };
const isoOf = (code) => { const c = Object.values(typeof COUNTRIES === 'object' ? COUNTRIES : {}).find(x => Number(x.code) === Number(code)); return c ? String(c.iso || '').toUpperCase() : ''; };
const stored = promptRows.filter(p => p.site_id === s.site_id && !['off', 'refused'].includes(String(p.status || 'active')) && p.prompt && p.kind !== 'brand');
// one question per topic group in turn (the between-question variance needs different questions), the owner's own first
const groups = new Map(); for (const q of stored.slice().sort((a, b) => (a.source === 'custom' ? 0 : 1) - (b.source === 'custom' ? 0 : 1) || String(a.prompt_id).localeCompare(String(b.prompt_id)))) { const k = String(q.cluster || q.topic || 'other').toLowerCase(); const g = groups.get(k) || []; g.push(q); groups.set(k, g); }
const pick = []; for (let r = 0; pick.length < CONFIG.questions && [...groups.values()].some(g => g.length > r); r++) for (const g of groups.values()) if (g[r] && pick.length < CONFIG.questions) pick.push(g[r]);
const engines = CONFIG.engines.filter(e => s.settings.engines.includes(e));
const perAsk = engines.reduce((t, e) => t + (AIP.PRICE[e] || 0), 0);
const price = +(pick.length * CONFIG.repeats * perAsk).toFixed(4);
const run_id = 'aipilot_' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '_' + s.site_id.replace(/^site_/, '') + '_x' + $execution.id;
const quote = { questions: pick.length, repeats: CONFIG.repeats, engines, requests: pick.length * CONFIG.repeats * engines.length, price_usd: price, max_usd: CONFIG.max_usd,
  per_engine_usd: Object.fromEntries(engines.map(e => [e, +(pick.length * CONFIG.repeats * (AIP.PRICE[e] || 0)).toFixed(4)])),
  note: 'The pilot asks ' + pick.length + ' of your questions ' + CONFIG.repeats + ' times each on ' + engines.length + ' engine' + (engines.length === 1 ? '' : 's') + ' (' + (pick.length * CONFIG.repeats * engines.length) + ' requests, about $' + price.toFixed(2) + ' of DataForSEO, once). It measures how much an engine\'s answer to the same question changes from one ask to the next, and says how many asks per question each engine needs.' };
const base = { site_id: s.site_id, domain: s.domain, run_id, run_kind: 'pilot', pilot: true, quote, email: s.email || '', callback_url: s.callback_url || '', request_id: s.request_id || '', checked_at: new Date().toISOString() };
if (pick.length < 3) return [{ json: { ...base, nothing_to_do: true, reason: 'the panel holds ' + pick.length + ' question(s): the pilot needs at least 3 (run the weekly AI visibility check first)' } }];
if (!engines.length) return [{ json: { ...base, nothing_to_do: true, reason: 'none of this website\'s engines answers differently on each ask (the pilot leaves out the AI Overview and Copilot)' } }];
if (price > CONFIG.max_usd) return [{ json: { ...base, nothing_to_do: true, reason: 'the pilot would cost about $' + price.toFixed(2) + ', above its $' + CONFIG.max_usd + ' limit: switch an engine off for it' } }];
if (!confirm) return [{ json: { ...base, nothing_to_do: true, quote_only: true, reason: 'priced, not run: start it again with confirm: true to spend about $' + price.toFixed(2) } }];
const loc = Number(s.location_code) || 2840; const iso = isoOf(loc); const ownMarket = AIP.normMarket(iso + '-' + (s.language_code || 'en')) || 'US-en';
const aliasRow = cache.find(c => c.key === 'ai_brands:' + s.site_id);
const prev = visRows.filter(v => v.site_id === s.site_id).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0] || null;
const autoRivals = prev ? (parse(prev.competitors_json, []) || []).filter(c => c && c.domain && c.auto && (c.mentions || 0) >= 2 && /\./.test(c.domain)).map(c => c.domain) : [];
// each question asked `repeats` times: a repeat is its own request key (<question>#r<k>); Pilot Metrics folds them back to the question
const prompts = []; for (const q of pick) for (let k = 1; k <= CONFIG.repeats; k++) prompts.push({ prompt_id: q.prompt_id + '#r' + k, base_id: q.prompt_id, prompt: q.prompt, kind: q.kind || 'custom', topic: q.topic || '', keyword: q.keyword || '', cluster: q.cluster || q.topic || '', stage: q.stage || '', persona: '', market: ownMarket });
return [{ json: { ...base, country: s.country || '', location_code: loc, language_code: s.language_code || 'en', country_iso: iso, own_market: ownMarket, markets_map: {},
  business_name: s.business_name || '', brand_names: AIE.brandNames({ domain: s.domain, business_name: s.business_name || '', brand_names: s.settings.brand_names || [] }), services: AIE.servicesOf(s), business_facts: String(s.business_facts || '').slice(0, 900),
  competitors: [...new Set([...s.settings.competitors, ...autoRivals])], configured_competitors: s.settings.competitors, aliases: aliasRow ? parse(aliasRow.value, {}) : {},
  engines, pulse_engines: engines, prompts, prompts_max: prompts.length, pulse_run: true, full_due: false, monthly_engines: [], cost_model: { pulse_day: { dfs: price } }, est_dfs_usd: price, est_ai_usd: 0, panel: pick.map(q => ({ prompt_id: q.prompt_id, prompt: q.prompt, cluster: q.cluster || q.topic || '' })) } }];
