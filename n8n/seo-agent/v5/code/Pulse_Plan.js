// AI Pulse plan (v4.9; daily 06:30 Tuesday-Sunday — Monday's weekly run asks the same engines — and on demand): every site with AI visibility and
// the pulse on asks its whole question panel on the fast engines (the real ChatGPT and Gemini answers and Google AI Mode, $0.004 each), so each
// question is sampled about seven times a week per engine. AI answers change from one ask to the next; many samples give a steady rate and catch
// a real change within a day. No brand question, no database views, no Claude: those stay in the weekly / monthly runs.
// Shared node names with the AI Visibility Tracker (AI Plan, AI Requests, Run AI Requests, Parse AI Answers) let both use the same request and parser code.
// B-G1 (2026-10-15, FIX_PLAN §3.16; INVARIANTS rule 2): the Pulse asks the panel the weekly run stored, and that panel was built from
// every stored ladder keyword with no gate between — so a competitor's brand or a government portal was asked of ChatGPT six mornings a
// week and the site scored against the answer. The same shared read-path gate runs here (FITR, _fit_gate.js). A question the owner added
// themselves is kept and only flagged: it is their deliberate choice, and hiding it would be the opposite of telling them.
// G6 (2026-10-18, AI_VISIBILITY_SPEC.md §10): above 50 questions (or when the owner sets `sample`) the pulse no longer asks the whole panel
// every morning: it asks a STRATIFIED ROTATING SAMPLE — strata are topic cluster x persona, each question has a slot inside its stratum, it
// is asked on N of the six pulse mornings of every week (N chosen so the weekly headline reaches ±3 points and the median cluster ±8 at 95%,
// or set by the owner), and every stratum is in every morning's sample. `full` asks every question every morning (as up to 50 questions
// always did), within the request limit of one morning. Each question is asked in ITS market.
/*__MONITOR_SITES__*/
/*__COUNTRIES__*/
/*__FIT_GATE__*/
/*__AI_PANEL__*/
const CONFIG = { pulse_engines: ['chatgpt', 'gemini', 'ai_mode', 'copilot'],   // v4.12: + Copilot ($0.002) when the site chose it
  max_sites_per_run: 15, baseline_days: 7 };
const { list, on_demand, want, total } = monitorSites('ai');
const sites = on_demand ? list : list.filter(s => s.settings.pulse);
if (!sites.length) return [{ json: { nothing_to_do: true, reason: on_demand ? 'no site matches "' + want + '"' : (total ? 'the daily AI pulse is off for every site (or AI visibility is off)' : 'no sites yet') } }];
const promptRows = rowsOf('Load AI Prompts'), visRows = rowsOf('Load AI Visibility'), daily = rowsOf('Load AI Daily'), cache = rowsOf('Load Cache (AI)');
const now = new Date(); const iso = now.toISOString(); const today = iso.slice(0, 10);
const parse = (t, d) => { try { const v = JSON.parse(t || ''); return v == null ? d : v; } catch (e) { return d; } };
const isoOf = (code) => { const c = Object.values(typeof COUNTRIES === 'object' ? COUNTRIES : {}).find(x => Number(x.code) === Number(code)); return c ? String(c.iso || '').toUpperCase() : ''; };
const codeOfIso = (iso) => { const c = Object.values(typeof COUNTRIES === 'object' ? COUNTRIES : {}).find(x => String(x.iso || '').toUpperCase() === String(iso || '').toUpperCase()); return c ? Number(c.code) : AIP.locationOf(iso); };   // G6: a market outside COUNTRIES keeps its own country
const out = [];
for (const s of sites.slice(0, CONFIG.max_sites_per_run)) {
  const storedQ = promptRows.filter(p => p.site_id === s.site_id && !['off', 'refused'].includes(String(p.status || 'active')) && p.prompt && p.kind !== 'brand');   // G6: a refused question is stored, never asked
  // B-G1: the same gate the weekly AI Plan runs, over the same stored rows, with the same context — three read paths, one rule.
  const prevQ = visRows.filter(v => v.site_id === s.site_id).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0] || null;
  const rivals0 = prevQ ? (parse(prevQ.competitors_json, []) || []).filter(c => c && c.domain && c.auto && (c.mentions || 0) >= 2 && /\./.test(c.domain)).map(c => c.domain) : [];
  const aliasRow0 = cache.find(c => c.key === 'ai_brands:' + s.site_id);
  const fitCtx = FITR.ctx({ own_domain: s.domain, competitors: [...s.settings.competitors, ...rivals0], brands: aliasRow0 ? parse(aliasRow0.value, {}) : {},
    heads: storedQ.map(p => p.topic || ''), keywords: s.keywords || [] });
  const fitQ = FITR.rungs(storedQ, fitCtx, { where: 'daily AI pulse', keyword: (p) => p.keyword || p.topic || '', live: (p) => p.source === 'custom' });
  const set_aside = fitQ.set_aside;
  const location_code0 = Number(s.location_code) || 2840;
  const ownMarket = AIP.normMarket(isoOf(location_code0) + '-' + (s.language_code || 'en')) || 'US-en';
  const markets = AIP.marketsOf({ country_iso: isoOf(location_code0), language_code: s.language_code || 'en', ai_markets: [...s.settings.markets, ...storedQ.map(p => p.market).filter(Boolean)] });   // G6: + a stored question's own market
  const markets_map = Object.fromEntries(markets.map(m => { const [cc, lang] = m.split('-'); return [m, { location_code: m === ownMarket ? location_code0 : codeOfIso(cc), language_code: lang || 'en', country_iso: cc }]; }).filter(([, v]) => v.location_code));
  const pin = (p) => p.pinned === true || String(p.pinned) === 'true';
  const panel = fitQ.keep
    .sort((a, b) => ((a.source === 'custom' || pin(a)) ? 0 : 1) - ((b.source === 'custom' || pin(b)) ? 0 : 1)).slice(0, s.settings.prompts_max)
    .map(p => ({ prompt_id: p.prompt_id, prompt: p.prompt, kind: p.kind || 'custom', topic: p.topic || '', keyword: p.keyword || '', source: p.source || 'auto', volume: p.volume === '' || p.volume == null ? null : Number(p.volume),
      stage: p.stage || '', cluster: p.cluster || p.topic || '', persona: String(p.persona || '').trim(), market: markets_map[AIP.normMarket(p.market)] ? AIP.normMarket(p.market) : ownMarket }));
  if (!panel.length) continue;   // the weekly run writes the panel first
  const engines = CONFIG.pulse_engines.filter(e => s.settings.engines.includes(e));
  if (!engines.length) continue;
  // G6: today's rotating sample of the panel (or all of it), and what it buys
  const clusterSizes = [...panel.reduce((m, q) => m.set(AIP.stratumOf(q), (m.get(AIP.stratumOf(q)) || 0) + 1), new Map()).values()].sort((a, b) => a - b);
  const medianCluster = clusterSizes.length ? clusterSizes[Math.floor(clusterSizes.length / 2)] : 0;
  const weeklyEngines = s.settings.engines.filter(e => e !== 'claude').length;
  const pw = AIP.pulsePerWeek({ asked: panel.length, weekly_engines: weeklyEngines, pulse_engines: engines.length, cluster_size: medianCluster, mode: s.settings.pulse_mode, per_week: s.settings.pulse_per_week });
  const sm = pw.per_week >= 6 ? { asked: panel, strata: clusterSizes.length, covered: clusterSizes.length, per_week: 6, extra: 0 } : AIP.pulseSample(panel, { per_week: pw.per_week, day: AIP.pulseDay(today) });
  const prompts = sm.asked.map(({ slot, stratum, top_up, ...q }) => q);
  const sample = { mode: pw.per_week >= 6 ? 'full' : 'sample', setting: s.settings.pulse_mode || 'auto', per_week: pw.per_week, panel: panel.length, asked: prompts.length, strata: sm.strata, covered: sm.covered, top_ups: sm.extra,
    half_width: { headline: pw.headline, cluster: pw.cluster, cluster_size: medianCluster }, capped: !!pw.capped, why: pw.why,
    note: pw.per_week >= 6 ? 'all ' + panel.length + ' questions, as every morning' : prompts.length + ' of the ' + panel.length + ' questions this morning (a rotating sample: every question ' + pw.per_week + ' morning' + (pw.per_week === 1 ? '' : 's') + ' a week, all ' + sm.strata + ' topic x buyer groups every morning)' };
  const costModel = AIP.cost({ panel: panel.length + 1, engines: s.settings.engines, pulse: true, pulse_mode: s.settings.pulse_mode, pulse_per_week: s.settings.pulse_per_week, cluster_size: medianCluster });
  const pulse_est = +(prompts.length * engines.reduce((t, e) => t + (AIP.PRICE[e] || 0), 0)).toFixed(4);
  const label = s.domain.split('.')[0];
  const brand_names = [...new Set([s.domain, ...(s.settings.brand_names || []), ...(label.length >= 5 ? [label] : [])].map(x => String(x).trim()).filter(x => x.length >= 3))];
  const prev = visRows.filter(v => v.site_id === s.site_id).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0] || null;
  const autoRivals = prev ? (parse(prev.competitors_json, []) || []).filter(c => c && c.domain && c.auto && (c.mentions || 0) >= 2 && /\./.test(c.domain)).map(c => c.domain) : [];
  const aliasRow = cache.find(c => c.key === 'ai_brands:' + s.site_id);
  // A5 / R95 (2026-10-16): `seo_ai_daily` now keeps a scheduled AND an on-demand reading for one date, so the baseline is the last
  // `baseline_days` DAYS (every reading of them), not the last 7 rows — two readings of one morning would have pushed a day out.
  const before = daily.filter(d => d.site_id === s.site_id && String(d.date) < today).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.checked_at || '').localeCompare(String(a.checked_at || '')));
  const baseDates = new Set([...new Set(before.map(d => String(d.date)))].slice(0, CONFIG.baseline_days));
  const baseline = before.filter(d => baseDates.has(String(d.date)))
    .map(d => { const eng = parse(d.engines_json, {}), pr = parse(d.prompts_json, {});
      return { date: d.date, samples: Number(d.samples) || 0, mentioned: Number(d.mentioned) || 0, mention_rate: Number(d.mention_rate) || 0, prompts: pr, competitors: parse(d.competitors_json, {}),
        // B8-2 (2026-10-15, benchmark area 8, INVARIANTS rule 1): what that morning was actually measured on. Without it the
        // z-test below pooled seven days of a DIFFERENT panel and called the result "a real drop, not sampling noise".
        engines: Object.keys(eng).filter(e => (Number((eng[e] || {}).answered) || 0) > 0).sort(), panel: Object.keys(pr).length }; });
  const location_code = Number(s.location_code) || 2840;
  out.push({ json: { site_id: s.site_id, domain: s.domain, country: s.country || '', location_code, language_code: s.language_code || 'en', country_iso: isoOf(location_code), email: s.email || '', callback_url: s.callback_url || '', request_id: s.request_id || '',
    on_demand, business_name: s.profile.business_name || '', brand_names, competitors: [...new Set([...s.settings.competitors, ...autoRivals])].slice(0, 8), configured_competitors: s.settings.competitors, aliases: aliasRow ? parse(aliasRow.value, {}) : {},
    engines: s.settings.engines, pulse_engines: engines, prompts, prompts_max: s.settings.prompts_max, pulse_run: true, full_due: false, run_kind: 'pulse', monthly_engines: [], baseline, date: today,
    // G6: the morning's sample, the markets its questions are asked in, and what this morning is priced at (the run ledger reserves it)
    sample, panel_size: panel.length, markets, markets_map, own_market: ownMarket, cost_model: { pulse_day: { dfs: pulse_est, ai: 0, usd: pulse_est }, month: costModel.month, per_week: pw.per_week },
    est_dfs_usd: pulse_est, est_ai_usd: 0,
    // B-G1: what the gate refused, with its reason, so the pulse mail names it instead of printing a shorter panel (INVARIANTS rule 1)
    set_aside, set_aside_note: FITR.line(set_aside, 'asked of the AI engines or scored against'),
    run_id: 'pulse_' + today.replace(/-/g, '') + '_' + s.site_id.replace(/^site_/, ''), checked_at: iso } });
}
return out.length ? out : [{ json: { nothing_to_do: true, reason: 'no site has a question panel yet (the weekly AI visibility run writes it)' } }];
