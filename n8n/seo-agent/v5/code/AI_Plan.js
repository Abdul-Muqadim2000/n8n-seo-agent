// AI visibility plan (weekly, Monday 07:00, and on demand): one job per site — the brand names to look for, the competitors, the topics,
// the stored prompt set (seo_ai_prompts: stable week to week so the trend means something), whether new prompts must be written,
// the engines, the previous week's numbers and whether the monthly market view (DataForSEO LLM Mentions) is due.
/*__MONITOR_SITES__*/
const CONFIG = { max_sites_per_run: 15, max_topics: 8 };
const { list, on_demand, want, total } = monitorSites('ai');
if (!list.length) return [{ json: { nothing_to_do: true, reason: on_demand ? 'no site matches "' + want + '"' : (total ? 'AI visibility is switched off for every site' : 'no sites yet (register one through "Track my site" or plan a keyword ladder)') } }];
const promptRows = rowsOf('Load AI Prompts'), visRows = rowsOf('Load AI Visibility'), ladders = rowsOf('Load Ladders');
const now = new Date(); const iso = now.toISOString(); const month = iso.slice(0, 7);
return list.slice(0, CONFIG.max_sites_per_run).map(s => {
  const label = s.domain.split('.')[0];
  const brand_names = [...new Set([s.domain, ...(s.settings.brand_names || []), ...(label.length >= 5 ? [label] : [])].map(x => String(x).trim()).filter(x => x.length >= 3))];
  const lrows = ladders.filter(l => normD(l.domain) === s.domain).sort((a, b) => (Number(a.rung) || 0) - (Number(b.rung) || 0));
  const asked = on_demand ? listOf(trigger.topics).map(x => x.toLowerCase()) : [];   // "Main services or products" on the on-demand form / API `topics`
  const topics = [...new Set([...asked, ...lrows.map(l => String(l.head_keyword || '').toLowerCase().trim()), ...(s.keywords || []), ...lrows.filter(l => Number(l.rung) !== 4).map(l => String(l.keyword || '').toLowerCase().trim())].filter(Boolean))].slice(0, CONFIG.max_topics);
  const mine = promptRows.filter(p => p.site_id === s.site_id && String(p.status || 'active') !== 'off' && p.prompt);
  const custom = mine.filter(p => p.source === 'custom'), auto = mine.filter(p => p.source !== 'custom');
  const prev = visRows.filter(v => v.site_id === s.site_id).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0] || null;
  const parse = (t, d) => { try { return JSON.parse(t || ''); } catch (e) { return d; } };
  const autoRivals = prev ? (parse(prev.competitors_json, []) || []).filter(c => c && c.domain && c.auto && (c.mentions || 0) >= 2).map(c => c.domain) : [];
  const competitors = [...new Set([...s.settings.competitors, ...autoRivals])].slice(0, 8);
  const room = Math.max(0, s.settings.prompts_max - custom.length);
  const deficit = Math.max(0, room - auto.length);
  const need = (!auto.length || deficit >= 2) ? deficit : 0;   // top up only when 2+ questions are missing (not every week for one)
  return { json: { site_id: s.site_id, domain: s.domain, country: s.country || '', location_code: Number(s.location_code) || 2840, language_code: s.language_code || 'en', email: s.email || '', callback_url: s.callback_url || '',
    request_id: s.request_id || '', on_demand, adhoc: !!s.adhoc, business_name: s.profile.business_name || '', business_type: s.profile.business_type || '', city: s.profile.city || '',
    brand_names, competitors, configured_competitors: s.settings.competitors, topics, engines: s.settings.engines, prompts_max: s.settings.prompts_max,
    prompts: [...custom, ...auto].slice(0, s.settings.prompts_max).map(p => ({ prompt_id: p.prompt_id, prompt: p.prompt, kind: p.kind || 'custom', topic: p.topic || '', keyword: p.keyword || '', source: p.source || 'auto' })),
    need_prompts: need > 0, prompts_needed: need, need_site_text: need > 0 && !topics.length && !s.profile.business_name, market_due: !!topics.length && (!prev || String(prev.market_month || '') !== month), market_keyword: topics[0] || '',
    previous: prev ? { checked_at: prev.checked_at, mention_rate: Number(prev.mention_rate), citation_rate: Number(prev.citation_rate), share_of_voice: Number(prev.share_of_voice), avg_rank: Number(prev.avg_rank), engines: parse(prev.engines_json, {}), market_month: prev.market_month || '', market: parse(prev.market_json, null) } : null,
    run_id: 'ai_' + iso.slice(0, 10).replace(/-/g, '') + '_' + s.site_id.replace(/^site_/, ''), checked_at: iso } };
});
