// Index coverage: one seo_index_runs row per website and run (exact columns): what is known, indexed, not indexed, left out, not checked yet,
// the backlog, the inspections spent / reused, our own reads, the causes and actions, the drop-outs, the freeze, and one plain note that says
// what could not be read (quota, access, sitemap, Search Console) - a run that read less says so, it never reads as "fine".
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
  const notes = [];
  if (d.failed) notes.push(S(d.why) || 'This website could not be checked today.');
  if (d.quota_stop) notes.push('Google\'s daily URL Inspection quota for this property was used up; inspections stopped for today and the rest are checked tomorrow.');
  if (d.access_lost) notes.push('Search Console refused access for this property, so pages were not checked.');
  const sm = d.sitemap || {};
  if (!d.failed && !n0(sm.read)) notes.push('No sitemap could be read' + ((sm.errors || [])[0] ? ' (' + S(sm.errors[0].url) + ': ' + S(sm.errors[0].error) + ')' : '') + '; pages stay listed as they were.');
  if (!d.failed && Array.isArray(d.gsc_sitemaps) && !d.gsc_sitemaps.length) notes.push('No sitemap is submitted in Search Console.');
  if (!d.failed && Array.isArray(d.gsc_sitemaps) && d.gsc_sitemaps.some(x => x.errors > 0)) notes.push('Search Console reports errors in a submitted sitemap (' + d.gsc_sitemaps.filter(x => x.errors > 0).map(x => x.path).slice(0, 3).join(', ') + ').');
  if (sm.capped) notes.push('The sitemap tree is larger than we read (50 sitemaps / 5,000 addresses a site).');
  if (!d.failed && d.search && d.search.read === false) notes.push('Search Console\'s page data could not be read (' + S(d.search.why) + '), so impressions are as last stored.');
  if (d.search && d.search.truncated) notes.push('Search Console returned its row limit, so pages with very few impressions may be missing from the evidence.');
  const fr = d.freeze || {};
  out.push({ json: { site_id: d.site_id, domain: S(d.domain), run_at: nowIso, request_id: S(d.request_id),
    known: sum.known, indexed: sum.indexed, not_indexed: sum.not_indexed, excluded: sum.excluded, unknown: sum.unknown, errors: n0((d.counts || {}).errors) + sum.errors,
    new_pages: sum.new_pages, new_indexed: sum.new_indexed, inspected: n0((d.counts || {}).inspected), reused: n0((d.counts || {}).reused), fetched: n0((d.counts || {}).fetched),
    quota_cap: n0(d.cap), backlog_left: sum.unknown, by_cause_json: JSON.stringify(sum.by_cause), by_action_json: JSON.stringify(sum.by_action),
    dropped_json: JSON.stringify((d.dropped || []).slice(0, IX.CFG.dropped_max)), freeze: !!fr.freeze, freeze_reason: S(fr.reason), note: notes.join(' ').slice(0, 1500),
    sitemaps_json: JSON.stringify({ submitted: Array.isArray(d.gsc_sitemaps) ? d.gsc_sitemaps.length : null,
      submitted_errors: Array.isArray(d.gsc_sitemaps) ? d.gsc_sitemaps.reduce((t, x) => t + n0(x.errors), 0) : null,
      submitted_warnings: Array.isArray(d.gsc_sitemaps) ? d.gsc_sitemaps.reduce((t, x) => t + n0(x.warnings), 0) : null,
      pending: Array.isArray(d.gsc_sitemaps) ? d.gsc_sitemaps.filter(x => x.pending).length : null,
      read: n0(sm.read), fetched: n0(sm.fetched), urls: n0(sm.urls), capped: !!sm.capped, robots_status: n0(sm.robots_status), errors: (sm.errors || []).slice(0, 10) }) } });
}
return out.length ? out : [{ json: { skip: true, reason: 'no website' } }];
