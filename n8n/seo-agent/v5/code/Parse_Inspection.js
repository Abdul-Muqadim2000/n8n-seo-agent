// What Google says about each inspected URL (G25, 2026-10-13): index verdict and coverage state, the canonical **Google** chose against the
// one the page names, the last crawl, mobile usability and the rich results it detected. A permission error, an exhausted quota or a missing
// answer is reported as "not checked" with the reason — never as "not indexed" and never as fine (PW.inspection).
// The pages the run's share of the quota did not reach ride along on the requests as `budget.skipped` and are listed here the same way.
/*__PAGE_WATCH__*/
const reqs = $('Inspect Requests').all().map(i => i.json);
const res = $input.all().map(i => i.json);
const S = (v) => String(v == null ? '' : v).trim();
const asked = reqs.filter(q => !q.skip);
const out = asked.map((q, i) => {
  const r = res[i] || {};
  const ins = PW.inspection(r);
  return { json: { site_idx: q.site_idx, site_id: q.site_id, url: q.inspect_url, keyword: q.keyword, rung: q.rung, status: q.status, kind: q.kind,
    // the reason is called `inspect_error`, not `error`: every reader of this node drops items that carry an `error` field, which is how a
    // page Search Console refused used to disappear and be reported as "not inspected" instead of "access is missing" (S53)
    inspect_error: ins.ok ? '' : ins.error, not_checked: ins.not_checked || '', error_kind: ins.error_kind || '', checked_at: new Date().toISOString(),
    verdict: ins.verdict, indexed: ins.ok ? ins.indexed : null, coverage: ins.coverage, indexing_state: ins.indexing_state || '', robots: ins.robots,
    last_crawl: ins.last_crawl, canonical_ok: ins.canonical_ok, google_canonical: ins.google_canonical, user_canonical: ins.user_canonical,
    mobile_usable: ins.mobile_usable, mobile_issues: ins.mobile_issues, rich_results: ins.rich_results, rich_verdict: ins.rich_verdict,
    budget: q.budget || null } };
});
// one row per page the budget did not reach: "not checked", with the day it was last inspected
const seenSites = new Set();
for (const q of asked) {
  if (seenSites.has(q.site_idx) || !q.budget) continue;
  seenSites.add(q.site_idx);
  for (const sk of (q.budget.skipped || [])) out.push({ json: { site_idx: q.site_idx, site_id: q.site_id, url: sk.url, keyword: '', rung: 0, status: '', kind: 'page',
    inspect_error: '', not_checked: 'Not checked in this run: Google allows ' + PW.QUOTA_PER_DAY + ' URL inspections a day per property and the pages rotate, oldest first'
      + (S(sk.inspect_at) ? ' (last inspected ' + S(sk.inspect_at).slice(0, 10) + ')' : ' (never inspected yet)') + '.',
    error_kind: 'budget', checked_at: '', verdict: '', indexed: null, coverage: '', indexing_state: '', robots: '', last_crawl: S(sk.inspect_at) ? '' : '',
    canonical_ok: null, google_canonical: '', user_canonical: '', mobile_usable: null, mobile_issues: [], rich_results: [], rich_verdict: '',
    skipped: true, budget: q.budget } });
}
return out.length ? out : [{ json: { skip: true, reason: 'no page was inspected' } }];
