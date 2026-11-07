// KI W0 (2026-11-08, docs/keyword-intel-2026-11-08/CONTRACTS.md §1 / §4): may this website run keyword intelligence, and the callback that says so.
// The kill switch (seo_cache `ki:kill` = 1) stops every run; a kill switch that could not be read counts as ON (fails closed). The website's
// ki_mode must be trial or on; empty, off, anything else, or a settings row that could not be read is off. W0 is the skeleton: a run that
// passes both is still refused with `not_available_yet` until E2 builds the worker. Nothing here spends, writes a table or reserves money.
const q = $('KI Input').first().json || {};
const S = (v) => (v == null ? '' : String(v)).trim();
const rowsOf = (n) => { try { return $(n).all().map(i => (i && i.json) || {}); } catch (e) { return null; } };
const kill = rowsOf('Load Kill Switch (KI)');
const killUnread = kill === null || kill.some(r => r && r.error);
const killed = killUnread || kill.some(r => S(r.key) === 'ki:kill' && /^(1|true|on|yes)$/i.test(S(r.value)));
const mons = rowsOf('Load Monitors (KI)');
const monUnread = mons === null || mons.some(r => r && r.error);
const mon = (mons || []).find(r => r && q.site_id && S(r.site_id) === q.site_id) || {};
const stored = S(mon.ki_mode).toLowerCase();
const kiMode = monUnread ? 'off' : (stored === 'trial' || stored === 'on' ? stored : 'off');
const reason = killed ? 'killed' : (kiMode === 'off' || !q.kind) ? 'ki_off' : 'not_available_yet';
const NOTE = {
  killed: 'Keyword intelligence is paused for every website (seo_cache ' + 'ki:kill' + (killUnread ? ' could not be read, so it counts as on' : ' is on') + '). Nothing ran and nothing was spent.',
  ki_off: 'Keyword intelligence is not switched on for this website (seo_monitors.ki_mode is ' + (monUnread ? 'unreadable' : (stored ? '"' + stored + '"' : 'empty')) + '). Nothing ran and nothing was spent.',
  not_available_yet: 'Keyword intelligence is switched on (' + kiMode + ') but the analysis is not built yet. Nothing ran and nothing was spent.',
};
const LABELS = { measured: 'measured', provider_estimate: 'estimate from the data provider', modelled: 'our estimate', inferred: 'AI judgement' };
const base = { stage: q.stage, status: 'refused', reason, note: NOTE[reason], request_id: q.request_id, run_id: q.run_id, domain: q.domain, market: '',
  mode: kiMode, rule_version: q.rule_version, sections: [], summary: {}, labels: LABELS, run_ledger: null,
  run_cost_estimate_usd: 0, run_cost_estimate_basis: 'refused before any paid call: no search data was read and no model was asked', run_cost_estimate_state: 'measured' };
const body = q.kind === 'keyword_research'
  ? { ...base, clusters: [], striking: [], questions: [], gaps_summary: {}, plan: [] }
  : { ...base, competitors: [], listings: [], platforms: [] };
return [{ json: { callback_url: q.callback_url, callback_body: body, refused: true, reason, ki_mode: kiMode, killed } }];