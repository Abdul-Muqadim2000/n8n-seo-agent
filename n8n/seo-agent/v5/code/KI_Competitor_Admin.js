// KI Competitor (Admin) (E2, 2026-11-08, CONTRACTS.md §5): the client's own choice on one competitor. The update sets status_by `user`, which no
// run ever changes again (CONTRACTS.md §2). A refusal writes nothing and says why.
// CR17-F (2026-11-17, client report C5, section 196): ONE competitor list per site (CMP.oneList: Site settings' seo_monitors.competitors + the
// chosen rows of seo_ki_competitors - the rows the client marked not a competitor). A choice now works for ANY domain, KI on or off:
//  * a row of the KI set (this website, the market given or the domain's only one) gets the status; not_competitor is stored as `dismissed`,
//    the KI set's own word for "not a competitor" (the Competitors page shows it so);
//  * a domain outside the KI set (SAP named by AI, a site above you in Rankings) gets its own row with market '' ("any market": the KI worker
//    reads its own market only, the app shows market-less rows in every market), status_by user, so every monitor reads the choice.
// At most ki_max_competitors (1-5, empty = 5) chosen in the one list.
const a = $('Admin Action').first().json || {};
const S = (v) => (v == null ? '' : String(v)).trim();
const rows = (() => { try { return $('Load KI Competitors (Admin)').all().map(i => i.json).filter(r => r && r.comp_domain && !r.error); } catch (e) { return []; } })();
const mon = (() => { try { return ($('Load KI Monitors (Admin)').first() || {}).json || {}; } catch (e) { return {}; } })();
const host = (h) => S(h).toLowerCase().replace(/^www\./, '');
const listOf = (v) => (Array.isArray(v) ? v : S(v).split(/[\n,;]+/)).map(host).filter(Boolean);
// FX-LINKS (review R2 M3, 2026-11-18): one decision per domain. The update (Set KI Competitor) now matches EVERY row of the domain for this
// site, every market and the market-less one, so a later choice always replaces an earlier one wherever it was stored (a market-less "not a
// competitor" from AI visibility, then "choose" on the Competitors page, left the old row in force and the competitor was pitched). A new
// market-less row is written only when the domain has no row at all.
const d = host(a.ki_comp_domain);
const mineD = rows.filter(r => host(r.comp_domain) === d);
const row = (a.ki_market ? mineD.find(r => S(r.market) === a.ki_market) : (mineD.find(r => S(r.market)) || mineD[0])) || null;
const n = Number(mon.ki_max_competitors); const max = S(mon.ki_max_competitors) === '' || !Number.isFinite(n) ? 5 : Math.min(5, Math.max(1, Math.round(n)));
const want = a.ki_status;
const kiStatus = want === 'not_competitor' ? 'dismissed' : want;
const off = new Set(rows.filter(r => S(r.status) === 'dismissed' && S(r.status_by) === 'user' && host(r.comp_domain) !== d).map(r => host(r.comp_domain)));
const chosenAll = [...new Set([...listOf(mon.competitors), ...rows.filter(r => S(r.status) === 'chosen').map(r => host(r.comp_domain))])].filter(x => x !== d && !off.has(x));
let error = '';
if (!/^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(d)) error = 'comp_domain must be a web address';
else if (a.ki_market && !row) error = d + ' is not in the competitor set of ' + (a.domain || a.site_id) + ' for ' + a.ki_market + ' (run Competitors first; the set is chosen from)';
else if (want === 'chosen' && chosenAll.length >= max) error = 'at most ' + max + ' competitors can be chosen; set another one to watch first';
const now = a.updated_at || new Date().toISOString();
// the market-less row of a domain outside the KI set: exactly the table's columns (the upsert maps every field)
const COLS = __KI_COMP_COLS__;
const own = row ? null : Object.fromEntries(COLS.map(c => [c, null]));
if (own) Object.assign(own, { site_id: a.site_id, domain: a.domain || '', market: '', comp_domain: d, class: 'adjacent', class_basis: 'user', status: kiStatus, status_by: 'user',
  declared: false, scored: false, first_seen: now, last_seen: now, misses: 0, reasons_json: JSON.stringify(['set by you']), updated_at: now });
return [{ json: error ? { ok: false, error } : { ok: true, ki_row: !!row, rows_of_domain: mineD.length, site_id: a.site_id, market: row ? S(row.market) : '', comp_domain: row ? S(row.comp_domain) : d, status: kiStatus, status_by: 'user', updated_at: now, own_row: own } }];
