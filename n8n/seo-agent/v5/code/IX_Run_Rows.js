// Index coverage: one seo_index_runs row per website and run (exact columns): what is known, indexed, not indexed, left out, not checked yet,
// the backlog, the inspections spent / reused, our own reads, the causes and actions, the drop-outs, the freeze, and one plain note that says
// what could not be read (quota, access, sitemap, Search Console) - a run that read less says so, it never reads as "fine".
// Fix wave 1: the row REPLACES this run's reservation (Save Index Runs upserts on site_id + run_at, E6); a website that could not be checked
// keeps the figures of its last check and says why (E14); the notes name a partial sitemap tree (E1), a per-minute limit that is not the
// daily quota (E13), a cut Search Console answer (X3), the 6,000-page cap (E12) and addresses outside a URL-prefix property (E5).
// Wave 2 (DESIGN_WAVE2.md §2.5): sitemaps_json also records the access Google reports for us (`permission`, raw; `permission_full`, after a
// 403 on a submission: false), the opt-in (`submit`: on / gate / kill switch), every submission (`submissions`: { path, at, status, reason },
// checked back the next runs from sitemaps.list: `confirmed_at` = Search Console's lastSubmitted, `read_at` = its lastDownloaded),
// the sitemap tree's fingerprint (`tree_fp`) and a 403 that holds the next submission (`submit_denied`). And the run's link read (`links`).
// Wave 2 review: `permission_full` is Google's raw fact (W7); `submit.will_submit` / `submit.blocked` say whether the next run would submit
// and what holds it (W1, IX.submitOutlook); a 403 at Full access and a missing write credential have their own notes (W7, W8).
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const S = (v) => String(v == null ? '' : v).trim();
const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const nowIso = new Date().toISOString();
const grab = (n) => { try { return $(n).all().map(i => i.json); } catch (e) { return []; } };
const diag = grab('Index Diagnose').filter(x => x && x.site_id);
const plan0 = grab('Index Plan')[0] || {};   // R8: the dispatch this run belongs to (chain_id), so another chain can see it was here
const subReqs = grab('Sitemap Submit Requests').filter(q => q && !q.skip && q.site_id);
const subRes = grab('Submit Sitemap (Index)');
const out = [];
for (const d of diag) {
  const sum = IX.summarize(d.all || [], {});
  const cnt = d.counts || {};
  const notes = [];
  // R5 (fix wave 3): the reason in plain words (IX.plainWhy); the raw error is kept for ops in sitemaps_json.error_detail, never in the note
  if (d.failed) notes.push('We could not check this website today: ' + IX.plainWhy(d.why).replace(/[.:]+$/, '') + '.' + (sum.known ? ' The figures are from the last check.' : ' Nothing has been checked yet.'));
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
  // wave 2 (§2.5): the sitemap submission - what was asked today and what Google answered, carried with the earlier ones
  const sp = d.submit || {};
  const mineAsked = []; const mineAns = []; subReqs.forEach((q, i) => { if (q.site_id === d.site_id) { mineAsked.push(q); mineAns.push(subRes[i] || {}); } });
  const sr = IX.submitResults(sp, mineAsked, mineAns, Date.parse(nowIso));
  for (const t of sr.today) {
    if (t.status === 'submitted') notes.push('We submitted your sitemap to Google today (' + t.path + ').');
    // W7: Google reports Full access for us (the gate let the PUT go) and still refused it: never "read-only access"
    else if (t.status === 'denied') notes.push('Google refused our sitemap submission today (' + t.path + ', answered 403) although it reports Full access for us, so the sitemap was not submitted. We try again in ' + IX.CFG.submit_denied_days + ' days, or sooner if your access level in Search Console changes; you can also submit it yourself.');
    // W8: our own write credential is missing: nothing reached Google (one ops alert: Submit Setup Alert)
    else if (t.status === 'not_set_up') notes.push('Sitemap submission is not set up on our side yet, so we did not submit your sitemap today.');
    else notes.push('Google did not accept our sitemap submission today (' + t.path + (t.http_status ? ', answered ' + t.http_status : '') + '); we try again in 7 days.');
  }
  // W1: the outlook the app reads - would the next run submit if nothing changes, and if not, what holds it (after today's attempts)
  const outlook = IX.submitOutlook(sp, sr.submissions, Date.parse(nowIso));
  if (!d.failed && sp.on && sp.gate === 'not_full_access') notes.push('You switched on sitemap submission, but Google gives us read-only access, so we cannot submit your sitemap. Give us Full access in Search Console, or submit it yourself.');
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
      home_host: S(sm.home_host), errors: (sm.errors || []).slice(0, 10), checked: !d.failed, chain_id: S(plan0.chain_id),
      permission: S(sp.permission), permission_full: sr.permission_full, submit: { on: !!sp.on, gate: S(sp.gate), kill_switch: !!sp.kill_off, skipped: (sp.skipped || []).slice(0, 5), will_submit: outlook.will_submit, blocked: outlook.blocked },
      submissions: sr.submissions, tree_fp: sp.tree_fp || null, submit_denied: sr.submit_denied || null,
      ...(d.links ? { links: { read: !!d.links.read, sources: n0(d.links.sources), found: n0(d.links.found), parents: (d.links.parents || []).slice(0, 10).map(x => ({ url: S(x.url), read: !!x.read })),
        suggested: (d.links.suggested || []).slice(0, 10).map(x => ({ url: S(x.url), read: !!x.read })), unread_parents: n0(d.links.unread_parents) } } : {}),
      ...(S(d.why_detail) ? { error_detail: S(d.why_detail).slice(0, 300) } : {}) }) } });
}
return out.length ? out : [{ json: { skip: true, reason: 'no website' } }];
