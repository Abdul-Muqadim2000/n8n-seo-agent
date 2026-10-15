// B5-5 + B5-8 (2026-10-15, benchmark area 5 — docs/system-review-2026-10-14/BENCH_AREA5_technical_audit.md §5(a) a5 / a8).
// G24 made the coverage line honest — "Crawled 47 of 112 known URLs" — but the 65 the crawl never reached were a COUNT and nothing
// more: the audit judged the site on a sample and never once looked at what was outside it. The worst problems hide there, because a
// URL the crawler could not reach is exactly the kind that 404s, redirects, carries a `noindex` or points its canonical somewhere else.
// This node picks up to CONFIG.not_crawled_checks (25) of them for a free plain GET — the same shape as *Fetch Raw Pages*, no paid API,
// no render, no credential — so "not crawled" becomes a statement a customer can act on instead of a number.
// Order (B5-8): the pages we KNOW changed in the last week come first — the ones AI Growth submitted to IndexNow / Bing
// (`seo_ai_pages.submitted_at`) and the ones we wrote or published (`seo_content_log`, `seo_ai_targets.written_at`) — which is the
// signal Ahrefs' Always-On Audit uses to pick its next URL. Under that, the most-seen pages in Search Console first.
// Nothing here can fail the audit: with no coverage reading, no list, or the cap at 0 this node skips and says which it was.
const base = $('Check Crawl').first().json || {};
let prev = {};
try { prev = $('Render Diff').first().json || {}; } catch (e) {}
if (!prev.probe) { try { const i = $input.first().json || {}; if (i.probe || i.skip) prev = i; } catch (e2) {} }

const S = (v) => String(v == null ? '' : v).trim();
const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
// A load that FAILED and a load that answered with nothing are different answers (INVARIANTS rule 1): the first is `ok: false` with
// the reason, the second is an empty list. A Data Table node that errors with continueRegularOutput hands on an item carrying `error`.
const loadOf = (nodeName) => {
  let items = null;
  try { items = $(nodeName).all().map(i => i.json); } catch (e) { return { ok: false, reason: 'it was not read in this run' }; }
  if (!Array.isArray(items)) return { ok: false, reason: 'it was not read in this run' };
  const errs = items.filter(r => r && r.error);
  const rows = items.filter(r => r && typeof r === 'object' && !r.error);
  if (errs.length && !rows.length) return { ok: false, reason: S((errs[0].error && (errs[0].error.message || errs[0].error.description)) || errs[0].error).slice(0, 120) || 'the load failed' };
  return { ok: true, rows };
};
const pathOf = (u) => S(u).replace(/^https?:\/\/[^\/]+/, '').replace(/[?#].*$/, '') || '/';

const capRaw = base.not_crawled_checks;
const CAP = Math.max(0, Math.min(50, capRaw === undefined || capRaw === null || capRaw === '' ? 25 : n0(capRaw)));
const cov = ((prev.site_structure || {}).crawl_coverage) || null;
const list = (cov && Array.isArray(cov.not_crawled_list)) ? cov.not_crawled_list.filter(r => r && /^https?:\/\//i.test(S(r.url))) : [];

// ---- B5-8: the pages we already know changed, from signals this product writes itself ----
// A table that could not be read is reported as not read: "nothing changed this week" is a different answer and the two never merge.
const src = (name, nodeName, map) => {
  const got = loadOf(nodeName);
  return got.ok ? Object.assign({ name, read: true, rows: got.rows }, map) : { name, read: false, reason: got.reason };
};
const changed = PW.changedPages([
  src('IndexNow / Bing submissions', 'Load AI Pages (Audit)',
    { url: (r) => r.url, at: (r) => r.submitted_at, kind: (r) => (/bing/i.test(S(r.submitted_via)) && !/indexnow/i.test(S(r.submitted_via)) ? 'bing' : 'indexnow') }),
  src('the published-page log', 'Load Content Log (Audit)',
    { url: (r) => S(r.published_url) || S(r.existing_page_url), at: (r) => S(r.published_at), kind: () => 'published' }),
  src('the AI answer pages written', 'Load AI Targets (Audit)',
    { url: (r) => r.page_url, at: (r) => r.written_at, kind: () => 'written' }),
], { days: PW.FRESH_DAYS, now: S(base.today) || undefined });

const plan = {
  cap: CAP, known_urls: cov ? n0(cov.known_urls) : null, crawled_known: cov ? n0(cov.crawled_known) : null,
  not_crawled_total: cov ? n0(cov.not_crawled) : null, listed: list.length,
  coverage_pct: cov && cov.coverage_pct != null ? n0(cov.coverage_pct) : null,
  changed: { read: changed.read, count: changed.count, window_days: changed.window_days, basis: changed.basis,
    sources_read: changed.sources_read, not_read: changed.not_read, pages: changed.pages },
};

const skip = (reason) => [{ json: { skip: true, reason, not_crawled_plan: Object.assign({ reason }, plan) } }];
if (!CAP) return skip('the check is switched off for this run (not_crawled_checks = 0)');
if (!cov) return skip('this run carries no crawl-coverage reading, so there is no list of known URLs to compare against');
if (!n0(cov.known_urls)) return skip('no sitemap and no Search Console pages: the crawl is the only list of URLs this site has, so nothing is known to be missing from it');
if (!n0(cov.not_crawled)) return skip('the crawl reached every one of the ' + n0(cov.known_urls) + ' known URLs: there is nothing left to look at');
if (!list.length) return skip('the crawl missed ' + n0(cov.not_crawled) + ' known URL(s) but none of their addresses survived into this run');

// most-seen in Search Console first, then the sitemap's own order - with anything we know changed this week in front of all of it
const fresh = PW.freshFirst(list, changed, {
  order: 'the pages Google shows most often first',
  then: (a, b) => (n0(b.impressions) - n0(a.impressions)) || (n0(b.clicks) - n0(a.clicks)) || S(a.url).localeCompare(S(b.url)),
});
const take = fresh.ordered.slice(0, CAP);

return take.map((r, i) => {
  const c = PW.changeOf(changed, r.url);
  return { json: {
    idx: i, url: S(r.url), path: pathOf(r.url), source: S(r.source) || 'sitemap',
    impressions: n0(r.impressions), clicks: n0(r.clicks),
    changed_at: c ? c.at : '', changed_kind: c ? c.kind : '', changed_label: c ? c.label : '',
    not_crawled_plan: Object.assign({ asked: take.length, order_note: fresh.note, changed_first: fresh.changed_count,
      method: 'Up to ' + CAP + ' of the known URLs the crawl never reached are read with one free plain GET each (status, redirect, robots rule, canonical, title). '
        + 'No JavaScript, no paid API: this is what a crawler receives on its first request.' }, plan),
  } };
});
