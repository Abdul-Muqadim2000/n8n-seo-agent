/*__FIT_GATE__*/
/*__KI__*/
/*__LADDER_RULES__*/
// LADDER PACKAGE (2026-11-09, rule 6; build_v4.py section 183): keyword intelligence's stored picture as the ladder's pool, read ONCE here and
// through KI's own read gate (KI.readable: the kill switch, the website's mode exactly 'on', a row that passed the gate; fails closed), then
// narrowed to the latest finished keyword research of this market (LRU.kiPool, CONTRACTS KI_ROW_CURRENT). Ladder Requests (which pulls to
// skip) and Ladder Pool (the pool itself) read this node's answer, never the table. A website in `trial` or off keeps its own research.
const d = $('Parse Verdict').first().json || {};
const rowsOf = (n) => { try { return $(n).all().map(i => i.json || {}).filter(r => r && !r.error && Object.keys(r).length); } catch (e) { return null; } };
const sid = 'site_' + String(d.domain || '').toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9]+/g, '-');
const mons = rowsOf('Load Monitors (Ladder)'); const kill = rowsOf('Load KI Kill (Ladder)');
const mon = (mons || []).find(r => String(r.site_id || '') === sid) || {};
const killed = kill === null ? null : kill.some(r => String(r.key || '') === 'ki:kill' && /^(1|true|on|yes)$/i.test(String(r.value || '').trim()));
const mode = String(mon.ki_mode || '').trim().toLowerCase();
const ctx = { killed: killed === null ? true : killed, mode, own_domain: String(d.domain || '') };
const all = rowsOf('Load KI Keywords (Ladder)') || [];
const readable = all.filter(r => String(r.site_id || '') === sid && KI.readable(r, ctx));
const avoid = all.filter(r => String(r.site_id || '') === sid && String(r.gate_reason || '').toLowerCase() === 'avoid').map(r => String(r.keyword || ''));
let iso = ''; try { iso = String($('Normalize Input').first().json.country_iso || d.country_iso || ''); } catch (e) { iso = String(d.country_iso || ''); }
const P = LRU.kiPool({ mode, killed, rows: readable, runs: rowsOf('Load KI Runs (Ladder)') || [], market: iso.toUpperCase() + '-' + String(d.language_code || 'en') });
// the AVOID rows are gated, so KI.readable never hands them out: they are kept apart, only to STOP a rung (rule 4), and only from the current run
const cur = P.run_id;
const avoidCur = cur ? all.filter(r => String(r.site_id || '') === sid && String(r.run_id || '') === cur && String(r.gate_reason || '').toLowerCase() === 'avoid').map(r => String(r.keyword || '')) : [];
return [{ json: { ki_pool: { ...P, avoid: P.used ? avoidCur.slice(0, 200) : [], mode, rows_read: all.length, rows_readable: readable.length } } }];
