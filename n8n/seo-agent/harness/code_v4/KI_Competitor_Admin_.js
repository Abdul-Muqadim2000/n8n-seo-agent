// KI Competitor (Admin) (E2, 2026-11-08, CONTRACTS.md §5): the client's own choice on one competitor of the KI set. It must be a row of this
// website and market (the set is the engine's; the client picks from it), and at most ki_max_competitors (1-5, empty = 5) may be chosen. The
// update sets status_by `user`, which no run ever changes again (CONTRACTS.md §2). A refusal writes nothing and says why.
const a = $('Admin Action').first().json || {};
const S = (v) => (v == null ? '' : String(v)).trim();
const rows = (() => { try { return $('Load KI Competitors (Admin)').all().map(i => i.json).filter(r => r && r.comp_domain && !r.error); } catch (e) { return []; } })();
const mon = (() => { try { return ($('Load KI Monitors (Admin)').first() || {}).json || {}; } catch (e) { return {}; } })();
const host = (h) => S(h).toLowerCase().replace(/^www\./, '');
const mine = rows.filter(r => S(r.market) === a.ki_market);
const row = mine.find(r => host(r.comp_domain) === host(a.ki_comp_domain));
const n = Number(mon.ki_max_competitors); const max = S(mon.ki_max_competitors) === '' || !Number.isFinite(n) ? 5 : Math.min(5, Math.max(1, Math.round(n)));
const chosen = mine.filter(r => S(r.status) === 'chosen' && host(r.comp_domain) !== host(a.ki_comp_domain)).length;
let error = '';
if (!row) error = a.ki_comp_domain + ' is not in the competitor set of ' + (a.domain || a.site_id) + ' for ' + a.ki_market + ' (run Competitors first; the set is chosen from)';
else if (a.ki_status === 'chosen' && chosen >= max) error = 'at most ' + max + ' competitors can be chosen; set another one to watch first';
return [{ json: error ? { ok: false, error } : { ok: true, site_id: a.site_id, market: a.ki_market, comp_domain: S(row.comp_domain), status: a.ki_status, status_by: 'user', updated_at: a.updated_at } }];
