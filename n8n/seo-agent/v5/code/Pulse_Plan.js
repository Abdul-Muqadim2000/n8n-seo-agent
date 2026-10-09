// AI Pulse plan (v4.9; daily 06:30 Tuesday-Sunday — Monday's weekly run asks the same engines — and on demand): every site with AI visibility and
// the pulse on asks its whole question panel on the fast engines (the real ChatGPT and Gemini answers and Google AI Mode, $0.004 each), so each
// question is sampled about seven times a week per engine. AI answers change from one ask to the next; many samples give a steady rate and catch
// a real change within a day. No brand question, no database views, no Claude: those stay in the weekly / monthly runs.
// Shared node names with the AI Visibility Tracker (AI Plan, AI Requests, Run AI Requests, Parse AI Answers) let both use the same request and parser code.
/*__MONITOR_SITES__*/
/*__COUNTRIES__*/
const CONFIG = { pulse_engines: ['chatgpt', 'gemini', 'ai_mode'], max_sites_per_run: 15, baseline_days: 7 };
const { list, on_demand, want, total } = monitorSites('ai');
const sites = on_demand ? list : list.filter(s => s.settings.pulse);
if (!sites.length) return [{ json: { nothing_to_do: true, reason: on_demand ? 'no site matches "' + want + '"' : (total ? 'the daily AI pulse is off for every site (or AI visibility is off)' : 'no sites yet') } }];
const promptRows = rowsOf('Load AI Prompts'), visRows = rowsOf('Load AI Visibility'), daily = rowsOf('Load AI Daily'), cache = rowsOf('Load Cache (AI)');
const now = new Date(); const iso = now.toISOString(); const today = iso.slice(0, 10);
const parse = (t, d) => { try { const v = JSON.parse(t || ''); return v == null ? d : v; } catch (e) { return d; } };
const isoOf = (code) => { const c = Object.values(typeof COUNTRIES === 'object' ? COUNTRIES : {}).find(x => Number(x.code) === Number(code)); return c ? String(c.iso || '').toUpperCase() : ''; };
const out = [];
for (const s of sites.slice(0, CONFIG.max_sites_per_run)) {
  const prompts = promptRows.filter(p => p.site_id === s.site_id && String(p.status || 'active') !== 'off' && p.prompt && p.kind !== 'brand')
    .sort((a, b) => (a.source === 'custom' ? 0 : 1) - (b.source === 'custom' ? 0 : 1)).slice(0, s.settings.prompts_max)
    .map(p => ({ prompt_id: p.prompt_id, prompt: p.prompt, kind: p.kind || 'custom', topic: p.topic || '', keyword: p.keyword || '', source: p.source || 'auto', volume: p.volume === '' || p.volume == null ? null : Number(p.volume) }));
  if (!prompts.length) continue;   // the weekly run writes the panel first
  const engines = CONFIG.pulse_engines.filter(e => s.settings.engines.includes(e));
  if (!engines.length) continue;
  const label = s.domain.split('.')[0];
  const brand_names = [...new Set([s.domain, ...(s.settings.brand_names || []), ...(label.length >= 5 ? [label] : [])].map(x => String(x).trim()).filter(x => x.length >= 3))];
  const prev = visRows.filter(v => v.site_id === s.site_id).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0] || null;
  const autoRivals = prev ? (parse(prev.competitors_json, []) || []).filter(c => c && c.domain && c.auto && (c.mentions || 0) >= 2 && /\./.test(c.domain)).map(c => c.domain) : [];
  const aliasRow = cache.find(c => c.key === 'ai_brands:' + s.site_id);
  const baseline = daily.filter(d => d.site_id === s.site_id && String(d.date) < today).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, CONFIG.baseline_days)
    .map(d => ({ date: d.date, samples: Number(d.samples) || 0, mentioned: Number(d.mentioned) || 0, mention_rate: Number(d.mention_rate) || 0, prompts: parse(d.prompts_json, {}), competitors: parse(d.competitors_json, {}) }));
  const location_code = Number(s.location_code) || 2840;
  out.push({ json: { site_id: s.site_id, domain: s.domain, country: s.country || '', location_code, language_code: s.language_code || 'en', country_iso: isoOf(location_code), email: s.email || '', callback_url: s.callback_url || '', request_id: s.request_id || '',
    on_demand, business_name: s.profile.business_name || '', brand_names, competitors: [...new Set([...s.settings.competitors, ...autoRivals])].slice(0, 8), configured_competitors: s.settings.competitors, aliases: aliasRow ? parse(aliasRow.value, {}) : {},
    engines: s.settings.engines, pulse_engines: engines, prompts, prompts_max: s.settings.prompts_max, pulse_run: true, full_due: false, run_kind: 'pulse', monthly_engines: [], baseline, date: today,
    run_id: 'pulse_' + today.replace(/-/g, '') + '_' + s.site_id.replace(/^site_/, ''), checked_at: iso } });
}
return out.length ? out : [{ json: { nothing_to_do: true, reason: 'no site has a question panel yet (the weekly AI visibility run writes it)' } }];
