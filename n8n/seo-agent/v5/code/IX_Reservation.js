// Index coverage (fix wave 1, E6 / FIX_CONTRACT decision 1): before the first URL Inspection, this run writes its seo_index_runs row with
// what it is ABOUT to spend (`inspected` = today's planned inspections). The final run row replaces it (same site_id + run_at). If the run
// is cancelled, crashes or times out, the row stays: the next run of the day - on demand, a replay by the catch-up, a manual start - counts
// those inspections and can never spend more than the cap. Its figures are the site's as known before today's inspections (never zeros
// that read as a measurement), and its note says the check did not finish.
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const S = (v) => String(v == null ? '' : v).trim();
const KILL_OFF = '__SITEMAP_SUBMIT__' === 'off';
const inv = (() => { try { return $('Index Inventory').all().map(i => i.json).filter(x => x && x.site_id && !x.failed && !x.no_access); } catch (e) { return []; } })();
let g = {}; try { g = $('Google Events').first().json || {}; } catch (e) { g = {}; }
const fr = g.freeze || {};
const out = [];
for (const v of inv) {
  const s = v.site || {};
  const sum = IX.summarize(v.pages || [], {});
  const at = S(s.run_at) || new Date().toISOString();
  out.push({ json: { site_id: v.site_id, domain: S(v.domain), run_at: at, request_id: S(s.request_id),
    known: sum.known, indexed: sum.indexed, not_indexed: sum.not_indexed, excluded: sum.excluded, unknown: sum.unknown, errors: sum.errors,
    new_pages: sum.new_pages, new_indexed: sum.new_indexed, inspected: (v.take || []).length, reused: (v.reuse || []).length, fetched: 0,
    quota_cap: Number(s.cap) || 0, backlog_left: sum.unknown, by_cause_json: JSON.stringify(sum.by_cause), by_action_json: JSON.stringify(sum.by_action),
    dropped_json: '[]', freeze: !!fr.freeze, freeze_reason: S(fr.reason),
    note: ('Today\'s check started at ' + at.slice(11, 16) + ' UTC and had not finished when this row was written; the figures are from before today\'s inspections. '
      + 'It holds today\'s ' + (v.take || []).length + ' planned inspection(s), so a repeat of the run stays inside the daily limit.').slice(0, 1500),
    // R2 (fix wave 3): Save Index Reservation UPSERTS on site_id + run_at, so this row replaces the run's attempt row (Index Attempt)
    // wave 2 (§2.5): the submission history travels on the reservation too, so a run that crashes after it never loses the 7-day spacing;
    // wave 2 review W13: with TODAY's attempts first, as 'pending' (written before the PUT; Index Run Rows replaces them with the answers)
    sitemaps_json: JSON.stringify({ reservation: true, complete: !!(v.sitemap || {}).complete, home_host: S((v.sitemap || {}).home_host), chain_id: S(s.chain_id),
      permission: S((v.submit || {}).permission), permission_full: !!(v.submit || {}).permission_full, submissions: IX.submitPending(v, KILL_OFF, Date.now()),
      tree_fp: (v.submit || {}).tree_fp || null, submit_denied: (v.submit || {}).submit_denied || null }) } });
}
return out.length ? out : [{ json: { skip: true, reason: 'no website to inspect' } }];
