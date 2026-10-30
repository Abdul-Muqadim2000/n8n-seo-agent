// Index coverage wave 2 (2026-10-30, docs/indexing-2026-10-29/DESIGN_WAVE2.md §2.5): the OPT-IN sitemap submission - the only write this
// workflow makes to a client's Search Console, and only of the website's sitemap (sitemaps.submit; never the Indexing API, never a URL).
// Index Inventory decided it (IX.submitPlan): the client switched it on (seo_monitors.index_sitemap_submit), the build's kill switch is not
// set (SEO_SITEMAP_SUBMIT=off), Google reports FULL access for the property (siteOwner / siteFullUser) and no earlier 403 at the same
// level holds it, Search Console's list was read today, the property covers the address, and the sitemap is new to Search Console, or
// changed (with errors since our last submission, or since Search Console's lastSubmitted and not submitted by us in 7 days). Never an
// unchanged resubmit; at most 3 sitemaps a website a run. This node checks the gates again (kill switch, gate, own domain, property) and
// builds the one PUT per sitemap that `Submit Sitemap (Index)` sends with the write-scope credential (SEOcredGoogleSvcW).
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const S = (v) => String(v == null ? '' : v).trim();
const KILL_OFF = '__SITEMAP_SUBMIT__' === 'off';
const inv = (() => { try { return $('Index Inventory').all().map(i => i.json).filter(x => x && x.site_id && !x.failed && !x.no_access); } catch (e) { return []; } })();
const API = 'https://www.googleapis.com/webmasters/v3/sites/';
// Wave 2 review W13: the gates and the list are IX.submitRequests, the same function Index Reservation used to record these attempts as
// 'pending' before this node runs (a crash or an overlapping run still sees them for the 7-day spacing)
const out = [];
for (const v of inv) {
  const s = v.site || {};
  for (const q of IX.submitRequests(v, KILL_OFF)) out.push({ json: { site_id: v.site_id, path: q.path, reason: q.reason, url: API + encodeURIComponent(S(s.gsc_property)) + '/sitemaps/' + encodeURIComponent(q.path) } });
}
return out.length ? out : [{ json: { skip: true, reason: KILL_OFF ? 'sitemap submission is switched off for this engine (SEO_SITEMAP_SUBMIT=off)' : 'no sitemap to submit today' } }];
