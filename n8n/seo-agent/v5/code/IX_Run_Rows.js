// Index coverage: one seo_index_runs row per website and run (exact columns): what is known, indexed, not indexed, left out, not checked yet,
// the backlog, the inspections spent / reused, our own reads, the causes and actions, the drop-outs, the freeze, and one plain note that says
// what could not be read (quota, access, sitemap, Search Console) - a run that read less says so, it never reads as "fine".
// Fix wave 1: the row REPLACES this run's reservation (Save Index Runs upserts on site_id + run_at, E6); a website that could not be checked
// keeps the figures of its last check and says why (E14); the notes name a partial sitemap tree (E1), a per-minute limit that is not the
// daily quota (E13), a cut Search Console answer (X3), the 6,000-page cap (E12) and addresses outside a URL-prefix property (E5).
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const S = (v) => String(v == null ? '' : v).trim();
const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const nowIso = new Date().toISOString();
const grab = (n) => { try { return $(n).all().map(i => i.json); } catch (e) { return []; } };
const diag = grab('Index Diagnose').filter(x => x && x.site_id);
const out = [];
for (const d of diag) {
  const sum = IX.summarize(d.all || [], {});
  const cnt = d.counts || {};
  const notes = [];
  if (d.failed) notes.push('We could not check this website today: ' + (S(d.why) || 'not checked').replace(/[.:]+$/, '') + '.' + (sum.known ? ' The figures are from the last check.' : ' Nothing has been checked yet.'));
  if (d.quota_stop) notes.push('Google\'s daily URL Inspection quota for this property was used up; inspections stopped for today and the rest are checked tomorrow.');
  if (!d.quota_stop && n0(cnt.rate)) notes.push('Google asked us to slow down (a per-minute limit, not the daily quota); ' + n0(cnt.rate) + ' page(s) were asked again a minute later or are checked on the next run.');
  if (d.access_lost) notes.push('Search Console refused access for some addresses of this property, so they were not checked.');
  if (!d.failed && d.reserved === false && n0((d.plan || {}).limit) > 0) notes.push('Today\'s planned inspections could not be recorded first, so none were made (they are tried on the next run).');
  const sm = d.sitemap || {};
  if (!d.failed && !n0(sm.read) && (sm.errors || []).length) notes.push('No sitemap could be read (' + S(sm.errors[0].url) + ': ' + S(sm.errors[0].error) + '); pages stay listed as they were.');
  else if (!d.failed && sm.complete === false) notes.push('The sitemap could not be read completely' + ((sm.errors || [])[0] ? ' (' + S(sm.errors[0].url) + ': ' + S(sm.errors[0].error) + ')' : sm.capped ? ' (it is larger than we read: 50 sitemaps / 5,000 addresses)' : '') + ', so pages not found in it keep what was stored and no "add it to the sitemap" advice is given today.');
  if (!d.failed && Array.isArray(d.gsc_sitemaps) && !d.gsc_sitemaps.length) notes.push('No sitemap is submitted in Search Console.');
  if (!d.failed && Array.isArray(d.gsc_sitemaps) && d.gsc_sitemaps.some(x => x.errors > 0)) notes.push('Search Console reports errors in a submitted sitemap (' + d.gsc_sitemaps.filter(x => x.errors > 0).map(x => x.path).slice(0, 3).join(', ') + ').');
  if (!d.failed && d.search && d.search.read === false) notes.push('Search Console\'s page data could not be read (' + S(d.search.why) + '), so impressions are as last stored.');
  if (d.search && d.search.truncated) notes.push('Search Console has more pages than we read (50,000 rows); pages it left out keep their stored figures.');
  if (d.capped) notes.push('This website has more than 6,000 known addresses; our own pages and the sitemap\'s are kept first and the rest are not followed.');
  if (n0((d.plan || {}).outside)) notes.push(n0(d.plan.outside) + ' address(es) are outside the Search Console property and are not checked.');
  if (n0(cnt.blocked)) notes.push(n0(cnt.blocked) + ' page(s) turned our reader away (a bot wall or a language redirect); Google\'s own reading is kept for them.');
  const fr = d.freeze || {};
  out.push({ json: { site_id: d.site_id, domain: S(d.domain), run_at: S(d.run_at) || nowIso, request_id: S(d.request_id),
    known: sum.known, indexed: sum.indexed, not_indexed: sum.not_indexed, excluded: sum.excluded, unknown: sum.unknown, errors: n0(cnt.errors) + sum.errors,
    new_pages: sum.new_pages, new_indexed: sum.new_indexed, inspected: n0(cnt.inspected), reused: n0(cnt.reused), fetched: n0(cnt.fetched),
    quota_cap: n0(d.cap), backlog_left: sum.unknown, by_cause_json: JSON.stringify(sum.by_cause), by_action_json: JSON.stringify(sum.by_action),
    dropped_json: JSON.stringify((d.dropped || []).slice(0, IX.CFG.dropped_max)), freeze: !!fr.freeze, freeze_reason: S(fr.reason), note: notes.join(' ').slice(0, 1500),
    sitemaps_json: JSON.stringify({ submitted: Array.isArray(d.gsc_sitemaps) ? d.gsc_sitemaps.length : null,
      submitted_errors: Array.isArray(d.gsc_sitemaps) ? d.gsc_sitemaps.reduce((t, x) => t + n0(x.errors), 0) : null,
      submitted_warnings: Array.isArray(d.gsc_sitemaps) ? d.gsc_sitemaps.reduce((t, x) => t + n0(x.warnings), 0) : null,
      pending: Array.isArray(d.gsc_sitemaps) ? d.gsc_sitemaps.filter(x => x.pending).length : null,
      read: n0(sm.read), fetched: n0(sm.fetched), urls: n0(sm.urls), capped: !!sm.capped, complete: d.failed ? null : sm.complete === true, robots_status: n0(sm.robots_status),
      home_host: S(sm.home_host), errors: (sm.errors || []).slice(0, 10), checked: !d.failed }) } });
}
return out.length ? out : [{ json: { skip: true, reason: 'no website' } }];
