// KI Gate (W0 2026-11-08, E2 2026-11-08; CONTRACTS.md §1 / §3 / §4): may this website run keyword intelligence, in which market, and the
// refusal callback when it may not. Nothing here spends, writes a table or reserves money: a refusal ends the run before the ledger.
//   * the kill switch (seo_cache `ki:kill` = 1) stops every run; a kill switch that could not be read counts as ON (fails closed);
//   * the website's ki_mode must be trial or on; empty, off, anything else, or a settings row that could not be read is off;
//   * the market is the website's main country (seo_sites); a request for another country is refused `market_mismatch` (R3 #1: devaicon.com
//     was researched in Pakistan while it is measured in the UAE), and with no country on file at all the request's own is used.
// Who may start a run (owner / admin / member; Trial: platform admins only) is the app's rule (app/server/src/services/ki.ts): the engine
// receives no role and decides nothing from any role-like field of the body.
/*__KI_KITS__*/
const q = $('KI Input').first().json || {};
const S = (v) => (v == null ? '' : String(v)).trim();
const rowsOf = (n) => { try { return $(n).all().map(i => (i && i.json) || {}); } catch (e) { return null; } };
const kill = rowsOf('Load Kill Switch (KI)');
const killUnread = kill === null || kill.some(r => r && r.error);
const killed = killUnread || kill.some(r => S(r.key) === '__KILL_KEY__' && /^(1|true|on|yes)$/i.test(S(r.value)));
const mons = rowsOf('Load Monitors (KI)');
const monUnread = mons === null || mons.some(r => r && r.error);
const mon = (mons || []).find(r => r && q.site_id && S(r.site_id) === q.site_id) || {};
const stored = S(mon.ki_mode).toLowerCase();
const kiMode = monUnread ? 'off' : (stored === 'trial' || stored === 'on' ? stored : 'off');
const sites = rowsOf('Load Site (KI)') || [];
const site = sites.find(r => r && !r.error && S(r.site_id) === q.site_id) || {};
const mk = KIW.market(q.country, site, COUNTRIES);
const reason = killed ? 'killed' : (kiMode === 'off' || !q.kind) ? 'ki_off' : (!q.domain ? 'no_domain' : (!mk.ok ? mk.reason : ''));
const NOTE = {
  killed: 'Keyword intelligence is paused for every website (seo_cache ' + '__KILL_KEY__' + (killUnread ? ' could not be read, so it counts as on' : ' is on') + '). Nothing ran and nothing was spent.',
  ki_off: 'Keyword intelligence is not switched on for this website (seo_monitors.ki_mode is ' + (monUnread ? 'unreadable' : (stored ? '"' + stored + '"' : 'empty')) + '). Nothing ran and nothing was spent.',
  no_domain: 'No website was named. Nothing ran and nothing was spent.',
  market_mismatch: 'This analysis runs in the website\'s main market: ' + S(mk.detail) + '. Nothing ran and nothing was spent.',
  no_market: 'No market could be set: ' + S(mk.detail) + '. Nothing ran and nothing was spent.',
};
const ctx = { ...q, ki_mode: kiMode, market: mk.ok ? mk.market : '' };
const out = { ...q, ki_mode: kiMode, killed, refused: !!reason, reason, site, monitors: mon,
  country_name: mk.country || '', iso: mk.iso || '', location_code: mk.location_code || null, language_code: mk.language_code || '', market: mk.ok ? mk.market : '', market_from: mk.from || '' };
if (reason) { out.callback_body = KIW.refusalBody(ctx, reason, NOTE[reason] || reason); out.note = NOTE[reason] || reason; }
return [{ json: out }];
