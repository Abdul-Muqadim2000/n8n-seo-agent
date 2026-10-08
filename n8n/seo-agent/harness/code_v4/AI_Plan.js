// AI visibility plan (weekly, Monday 07:00, and on demand): one job per site — the brand names to look for, the competitors (configured, detected,
// and the brand names AI uses for them, learned by the Answer Analyst), the topics, the stored question panel (seo_ai_prompts: stable week to week
// so the trend means something; up to 50 questions with buyer stage, topic cluster and monthly AI search volume), the engines, the AI Pulse samples
// of the past days (seo_ai_daily) that join this week's figures, last week's numbers, and what is due this run: the monthly full run (Claude and the
// brand question), question discovery (Search Console questions + real questions from the AI-answer database), search volumes, the market-wide
// index (the DataForSEO AI-answer database: your share against the competitors across every answer, not only the panel), AI referral traffic from
// GA4 (visits, key events and revenue from ChatGPT, Perplexity, Gemini, Copilot, Claude …) and the AI-crawler access check. (v4.9)
// ---- shared by the monitors (AI Visibility Tracker, Backlink Monitor, Audit Scheduler; inlined by the build): which sites, with which settings ----
// Sites = the Data Table seo_sites ("Track my site") + every domain with a keyword ladder; settings per site from seo_monitors (defaults: everything on).
// On demand (Manual Run with { domain | site_id }) one site runs even when its weekly / monthly monitor is off; an untracked domain is checked ad hoc
// with the trigger's country, e-mail and callback.
let trigger = {}; try { const t = $('Manual Run').first(); trigger = (t && t.json) || {}; } catch (e) {}
if (trigger.body && typeof trigger.body === 'object') trigger = { ...trigger, ...trigger.body };
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error && Object.keys(r).length); } catch (e) { return []; } };
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const siteIdFor = (d) => 'site_' + d.replace(/[^a-z0-9]+/g, '-');
const listOf = (v) => (Array.isArray(v) ? v : String(v || '').split(/[\n,;]+/)).map(x => String(x).trim()).filter(Boolean);
const flag = (v, dflt) => (v === undefined || v === null || v === '') ? dflt : !(v === false || /^(false|0|no|off)$/i.test(String(v)));
const DEFAULT_ENGINES = ['chatgpt', 'perplexity', 'gemini', 'claude', 'ai_overview', 'ai_mode'];
function monitorSites(kind) {   // kind: 'ai' | 'backlinks' | 'audit'
  const sites = rowsOf('Load Sites').filter(r => r.site_id && r.domain), ladders = rowsOf('Load Ladders').filter(r => r.domain), mons = rowsOf('Load Monitors'), profiles = rowsOf('Load Profiles');
  const byDomain = new Map();
  for (const s of sites) { const d = normD(s.domain); if (d && !byDomain.has(d)) byDomain.set(d, { ...s, domain: d, keywords: listOf(s.keywords).map(k => k.toLowerCase()), virtual: false }); }
  for (const l of ladders) { const d = normD(l.domain); if (d && !byDomain.has(d)) byDomain.set(d, { site_id: siteIdFor(d), domain: d, country: l.country || '', location_code: Number(l.location_code) || 0, language_code: l.language_code || 'en', email: l.email || '', callback_url: l.callback_url || '', keywords: [], status: 'active', source: 'ladder', virtual: true }); }
  for (const s of byDomain.values()) { if (s.email && s.callback_url) continue; const l = ladders.find(l => normD(l.domain) === s.domain && (l.email || l.callback_url)); if (l) { s.email = s.email || l.email || ''; s.callback_url = s.callback_url || l.callback_url || ''; } }
  const want = normD(trigger.domain) || String(trigger.site_id || '').trim();
  let list = [...byDomain.values()];
  if (want) {
    list = list.filter(s => s.domain === want || s.site_id === want);
    if (!list.length && normD(trigger.domain)) list = [{ site_id: siteIdFor(normD(trigger.domain)), domain: normD(trigger.domain), country: trigger.country || '', location_code: Number(trigger.location_code) || 0, language_code: trigger.language_code || 'en', email: '', callback_url: '', keywords: [], status: 'active', source: 'adhoc', virtual: true, adhoc: true }];
  } else list = list.filter(s => String(s.status || 'active') !== 'paused');
  const out = list.map(s => {
    const m = mons.find(x => x.site_id === s.site_id) || {};
    const p = profiles.find(x => x.site_id === s.site_id) || {};
    const engines = listOf(m.ai_engines).map(e => e.toLowerCase()).filter(e => DEFAULT_ENGINES.includes(e));
    const settings = { ai_visibility: flag(m.ai_visibility, true), backlinks: flag(m.backlinks, true), audit_monthly: flag(m.audit_monthly, true), engines: engines.length ? engines : DEFAULT_ENGINES,
      prompts_max: Math.min(50, Math.max(3, Number(m.ai_prompts_max) || 20)), pulse: flag(m.ai_pulse, true), audit_pages: Math.min(1000, Math.max(50, Number(m.audit_pages) || 200)), audit_js: flag(m.audit_js, false),
      competitors: [...new Set([...listOf(m.competitors), ...listOf(trigger.competitors)].map(normD).filter(d => d && d !== s.domain))].slice(0, 5),
      brand_names: [...new Set([...listOf(m.brand_names), ...listOf(trigger.brand_names), p.business_name || ''].map(x => String(x).trim()).filter(Boolean))], stored: !!m.site_id };
    const o = { ...s, settings, profile: { business_name: p.business_name || '', business_type: p.business_type || '', city: p.city || '', phone: p.phone || '', street_address: p.street_address || '', author_name: p.author_name || '',
      region: p.region || '', country_code: p.country_code || '', public_email: p.public_email || '', price_range: p.price_range || '', service_areas: p.service_areas || '', opening_hours: p.opening_hours || '' } };
    if (want) { if (trigger.email) o.email = trigger.email; if (trigger.callback_url) o.callback_url = trigger.callback_url; if (trigger.country) o.country = trigger.country; if (Number(trigger.location_code)) o.location_code = Number(trigger.location_code); if (trigger.language_code) o.language_code = trigger.language_code; }
    o.request_id = String(trigger.request_id || s.request_id || '');
    return o;
  });
  const flagOf = { ai: 'ai_visibility', backlinks: 'backlinks', audit: 'audit_monthly' }[kind];
  return { list: want ? out : out.filter(s => s.settings[flagOf]), on_demand: !!want, want, trigger, total: byDomain.size };
}

// ---- countries: copied from the main workflow's Normalize Input by build_monitors.py (DataForSEO location code = 2000 + ISO numeric) ----
const COUNTRIES = {
  'United States':        { code: 2840, iso: 'US', lang: 'en', language: 'English', spelling: 'American English',   currency: 'USD' },
  'United Kingdom':       { code: 2826, iso: 'GB', lang: 'en', language: 'English', spelling: 'British English',    currency: 'GBP' },
  'Canada':               { code: 2124, iso: 'CA', lang: 'en', language: 'English', spelling: 'Canadian English',   currency: 'CAD' },
  'Australia':            { code: 2036, iso: 'AU', lang: 'en', language: 'English', spelling: 'Australian English', currency: 'AUD' },
  'New Zealand':          { code: 2554, iso: 'NZ', lang: 'en', language: 'English', spelling: 'British English',    currency: 'NZD' },
  'Ireland':              { code: 2372, iso: 'IE', lang: 'en', language: 'English', spelling: 'British English',    currency: 'EUR' },
  'Pakistan':             { code: 2586, iso: 'PK', lang: 'en', language: 'English', spelling: 'British English',    currency: 'PKR' },
  'India':                { code: 2356, iso: 'IN', lang: 'en', language: 'English', spelling: 'British English',    currency: 'INR' },
  'United Arab Emirates': { code: 2784, iso: 'AE', lang: 'en', language: 'English', spelling: 'British English',    currency: 'AED' },
  'Saudi Arabia':         { code: 2682, iso: 'SA', lang: 'en', language: 'English', spelling: 'British English',    currency: 'SAR' },
  'Singapore':            { code: 2702, iso: 'SG', lang: 'en', language: 'English', spelling: 'British English',    currency: 'SGD' },
  'South Africa':         { code: 2710, iso: 'ZA', lang: 'en', language: 'English', spelling: 'British English',    currency: 'ZAR' },
  'Germany':              { code: 2276, iso: 'DE', lang: 'de', language: 'German',  spelling: 'German',             currency: 'EUR' },
  'France':               { code: 2250, iso: 'FR', lang: 'fr', language: 'French',  spelling: 'French',             currency: 'EUR' },
  'Spain':                { code: 2724, iso: 'ES', lang: 'es', language: 'Spanish', spelling: 'European Spanish',   currency: 'EUR' },
  'Italy':                { code: 2380, iso: 'IT', lang: 'it', language: 'Italian', spelling: 'Italian',            currency: 'EUR' },
  'Netherlands':          { code: 2528, iso: 'NL', lang: 'nl', language: 'Dutch',   spelling: 'Dutch',              currency: 'EUR' },
  'Brazil':               { code: 2076, iso: 'BR', lang: 'pt', language: 'Portuguese', spelling: 'Brazilian Portuguese', currency: 'BRL' },
  'Mexico':               { code: 2484, iso: 'MX', lang: 'es', language: 'Spanish', spelling: 'Mexican Spanish',    currency: 'MXN' }
};
const CONFIG = { max_sites_per_run: 15, max_topics: 8, monthly_engines: ['claude'],   // v4.9: Gemini moved to the weekly set (the real gemini.google.com answer costs $0.004 through the scraper)
  gsc_questions: 15, pulse_days: 7 };
const { list, on_demand, want, total } = monitorSites('ai');
if (!list.length) return [{ json: { nothing_to_do: true, reason: on_demand ? 'no site matches "' + want + '"' : (total ? 'AI visibility is switched off for every site' : 'no sites yet (register one through "Track my site" or plan a keyword ladder)') } }];
const promptRows = rowsOf('Load AI Prompts'), visRows = rowsOf('Load AI Visibility'), ladders = rowsOf('Load Ladders'), daily = rowsOf('Load AI Daily'), cache = rowsOf('Load Cache (AI)'), queries = rowsOf('Load Query History');
const now = new Date(); const iso = now.toISOString(); const month = iso.slice(0, 7);
const parse = (t, d) => { try { const v = JSON.parse(t || ''); return v == null ? d : v; } catch (e) { return d; } };
const isoOf = (code) => { const c = Object.values(typeof COUNTRIES === 'object' ? COUNTRIES : {}).find(x => Number(x.code) === Number(code)); return c ? String(c.iso || '').toUpperCase() : ''; };
const QUESTION = /^(how|what|which|who|why|when|where|is|are|can|does|do|should|best|top|cost|price|vs|compare)\b|\?|\b(vs|versus|best|cost|price|how to|which)\b/i;
return list.slice(0, CONFIG.max_sites_per_run).map(s => {
  const label = s.domain.split('.')[0];
  const brand_names = [...new Set([s.domain, ...(s.settings.brand_names || []), ...(label.length >= 5 ? [label] : [])].map(x => String(x).trim()).filter(x => x.length >= 3))];
  const lrows = ladders.filter(l => normD(l.domain) === s.domain).sort((a, b) => (Number(a.rung) || 0) - (Number(b.rung) || 0));
  const asked = on_demand ? listOf(trigger.topics).map(x => x.toLowerCase()) : [];   // "Main services or products" on the on-demand form / API `topics`
  const topics = [...new Set([...asked, ...lrows.map(l => String(l.head_keyword || '').toLowerCase().trim()), ...(s.keywords || []), ...lrows.filter(l => Number(l.rung) !== 4).map(l => String(l.keyword || '').toLowerCase().trim())].filter(Boolean))].slice(0, CONFIG.max_topics);
  const mine = promptRows.filter(p => p.site_id === s.site_id && String(p.status || 'active') !== 'off' && p.prompt);
  const custom = mine.filter(p => p.source === 'custom'), auto = mine.filter(p => p.source !== 'custom');
  const mineVis = visRows.filter(v => v.site_id === s.site_id).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)));
  const prev = mineVis[0] || null;
  // brand names AI uses for competitors (learned by the Answer Analyst: "ClearTax" -> cleartax.in), so a competitor named without its website still counts
  const aliasRow = cache.find(c => c.key === 'ai_brands:' + s.site_id); const aliases = aliasRow ? parse(aliasRow.value, {}) : {};
  const autoRivals = prev ? (parse(prev.competitors_json, []) || []).filter(c => c && c.domain && c.auto && (c.mentions || 0) >= 2 && /\./.test(c.domain)).map(c => c.domain) : [];
  const competitors = [...new Set([...s.settings.competitors, ...autoRivals])].slice(0, 8);
  // full run = the first run of the month (or any on-demand run): every engine + the brand question + discovery + the market-wide index
  const isFull = (v) => String(v.run_kind || '') === 'full' || String(v.run_kind || '') === 'on_demand' || (!v.run_kind && (() => { const e = parse(v.engines_json, {}); return ['gemini', 'claude'].some(k => e[k] && Number(e[k].asked) > 0 && !e[k].carried); })());
  const lastFull = mineVis.find(isFull) || null;
  const full_due = on_demand || !mineVis.some(v => String(v.checked_at).slice(0, 7) === month && isFull(v));
  const carried = lastFull ? { checked_at: lastFull.checked_at, engines: parse(lastFull.engines_json, {}) } : null;
  const room = Math.max(0, s.settings.prompts_max - custom.length);
  const deficit = Math.max(0, room - auto.length);
  const need = (!auto.length || deficit >= 2) ? deficit : 0;   // top up only when 2+ questions are missing (not every week for one)
  const prompts = [...custom, ...auto].slice(0, s.settings.prompts_max).map(p => ({ prompt_id: p.prompt_id, prompt: p.prompt, kind: p.kind || 'custom', topic: p.topic || '', keyword: p.keyword || '', source: p.source || 'auto',
    stage: p.stage || '', cluster: p.cluster || p.topic || '', volume: p.volume === '' || p.volume == null ? null : Number(p.volume), origin: p.origin || (p.source === 'custom' ? 'custom' : 'writer'), created_at: p.created_at || '' }));
  // search volumes: questions without one (new) every week; all of them on the month's full run (AI Keyword Data, $0.0001 a keyword)
  const volume_keywords = [...new Set(prompts.filter(p => p.kind !== 'brand' && p.keyword && (full_due || p.volume === null || Number.isNaN(p.volume))).map(p => String(p.keyword).toLowerCase().trim()).filter(k => k.length >= 3 && k.length <= 120))].slice(0, 100);
  // real questions people search (Search Console, last weeks): long or question-shaped queries are the closest thing to an AI prompt
  const gsc_questions = [...new Map(queries.filter(q => q.site_id === s.site_id && q.query && (String(q.query).split(/\s+/).length >= 5 || QUESTION.test(String(q.query))))
    .sort((a, b) => (Number(b.impressions) || 0) - (Number(a.impressions) || 0)).map(q => [String(q.query).toLowerCase().trim(), { query: String(q.query).trim(), impressions: Number(q.impressions) || 0, clicks: Number(q.clicks) || 0, position: Number(q.position) || 0 }])).values()].slice(0, CONFIG.gsc_questions);
  // AI Pulse samples since the last weekly run (or the past week): they join this week's figures (more samples = a steadier, honest rate)
  const since = prev ? String(prev.checked_at) : new Date(now.getTime() - CONFIG.pulse_days * 864e5).toISOString();
  const pulse_rows = daily.filter(d => d.site_id === s.site_id && String(d.checked_at) > since).map(d => ({ date: d.date, checked_at: d.checked_at, samples: Number(d.samples) || 0, mentioned: Number(d.mentioned) || 0, cited: Number(d.cited) || 0,
    mention_rate: Number(d.mention_rate) || 0, visibility_score: Number(d.visibility_score) || 0, engines: parse(d.engines_json, {}), prompts: parse(d.prompts_json, {}), competitors: parse(d.competitors_json, {}), sources: parse(d.sources_json, {}) }));
  const prevMention = prev ? Number(prev.mention_rate) || 0 : 0, prevSamples = prev ? Number(prev.samples) || Number(prev.answers) || 0 : 0;
  const location_code = Number(s.location_code) || 2840;
  // pages that must stay fetchable for AI: the ones AI cited last time and the keyword-ladder pages (checked against robots.txt per AI bot)
  const pathOf = (u) => { const m = String(u || '').match(/^https?:\/\/[^\/?#]+(\/[^?#]*)?/i); return m ? (m[1] || '/') : (String(u || '').startsWith('/') ? String(u) : ''); };
  const key_paths = [...new Set([...(prev ? (parse(prev.pages_json, []) || []).map(x => pathOf(x && x.url)) : []), ...lrows.map(l => pathOf(l.target_url))].filter(x => x && x !== '/'))].slice(0, 8);
  return { json: { site_id: s.site_id, domain: s.domain, country: s.country || '', location_code, language_code: s.language_code || 'en', country_iso: isoOf(location_code), email: s.email || '', callback_url: s.callback_url || '',
    request_id: s.request_id || '', on_demand, adhoc: !!s.adhoc, business_name: s.profile.business_name || '', business_type: s.profile.business_type || '', city: s.profile.city || '', profile: s.profile,
    brand_names, competitors, configured_competitors: s.settings.competitors, aliases, topics, engines: s.settings.engines, prompts_max: s.settings.prompts_max, pulse: s.settings.pulse,
    prompts, full_due, run_kind: on_demand ? 'on_demand' : full_due ? 'full' : 'weekly', monthly_engines: CONFIG.monthly_engines.filter(e => s.settings.engines.includes(e)), carried,
    need_prompts: need > 0, prompts_needed: need, need_site_text: need > 0 && !topics.length && !s.profile.business_name, gsc_questions,
    discovery_due: !!topics.length && (full_due || need > 0), volume_keywords, index_due: full_due, market_due: !!topics.length && (!prev || String(prev.market_month || '') !== month), market_keyword: topics[0] || '',
    ga4_property_id: String(s.ga4_property_id || '').replace(/^properties\//, '').trim(), pulse_rows, key_paths,
    previous: prev ? { checked_at: prev.checked_at, mention_rate: prevMention, samples: prevSamples, mentioned_k: Math.round(prevMention * prevSamples / 100), citation_rate: Number(prev.citation_rate), share_of_voice: Number(prev.share_of_voice), avg_rank: Number(prev.avg_rank),
      visibility_score: prev.visibility_score === '' || prev.visibility_score == null ? null : Number(prev.visibility_score), sentiment_score: prev.sentiment_score === '' || prev.sentiment_score == null ? null : Number(prev.sentiment_score),
      engines: parse(prev.engines_json, {}), market_month: prev.market_month || '', market: parse(prev.market_json, null), index: parse(prev.index_json, null), perception: parse(prev.perception_json, null), traffic: parse(prev.traffic_json, null), access: parse(prev.access_json, null),
      competitors: parse(prev.competitors_json, []) } : null,
    run_id: 'ai_' + iso.slice(0, 10).replace(/-/g, '') + '_' + s.site_id.replace(/^site_/, ''), checked_at: iso } };
});
