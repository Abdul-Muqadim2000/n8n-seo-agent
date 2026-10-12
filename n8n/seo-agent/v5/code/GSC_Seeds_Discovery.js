/*__SITE_MODEL__*/
/*__GSC_QUERIES__*/
/*__KW_INPUTS__*/
// 2026-10-13 (FIX_PLAN G8, criterion K6): the site's own Search Console queries seed the keyword research.
// Until now Search Console was read only by the weekly tracker and the content cadence, while discovery started from what an AI model
// guessed the business sells - so the searches the site ALREADY gets impressions for never reached the paid pulls. This node reads the
// stored rows (seo_query_history, the newest 28-day period only), drops scraper and brand queries with the same rules the weekly report
// uses (GQ, v5/code/_gsc_queries.js), and keeps two kinds:
//   * no page answers it - the page inventory (seo_pages + this run's sitemap, SM.matchPage; D11) has nothing for the search;
//   * striking distance - the site ranks 8-20, where one strong page moves it onto page one.
// Those queries are inserted into the seed list right after the primary seed (so they also reach keyword_suggestions / related), and
// their measured impressions, clicks and position travel with the run for the traffic calibration in Collect Research (K2).
// No new API call: the rows are already in the Data Table and the seeds ride on the pulls the research makes anyway.
const base = $('Seed List').first().json;
const rows = (() => { try { return $('Load Query History (Discovery)').all().map(i => i.json).filter(r => r && r.query); } catch (e) { return []; } })();
const siteModel = (() => { try { const m = $('Site Model').first().json.site_model; return (m && typeof m === 'object') ? m : null; } catch (e) { return null; } })();
const model = SM.withPages(siteModel || SM.from({ domain: base.domain || '' }, {}), (base.site_urls || []).map(u => ({ url: u, source: 'sitemap' })));
const pages_known = SM.pages(model).length;
// a brand query is the site's own name, not an SEO win: the site model's names, the business name and the domain label (GQ.brandTest)
const brandNames = [...((siteModel || {}).brand_names || []), (siteModel || {}).business_name || '', String(base.business_name || '')].filter(Boolean);
const BR = GQ.brandTest(base.domain || '', brandNames);
const gsc = KWI.gscSeeds(rows, { domain: base.domain || '', isScraper: GQ.isScraper, isBrand: BR.is, pages_known,
  matchPage: pages_known ? ((kw) => SM.matchPage(model, kw)) : null, use_row_page: !pages_known });
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const seeds0 = (base.seeds || []).map(norm).filter(Boolean);
const extra = gsc.seeds.filter(k => !seeds0.includes(k));
// the primary seed stays first (it drives the competitor SERP and the long-tail heads); the measured queries come next, ahead of the
// model's guesses, and the rest of the original list follows
const seeds = [...seeds0.slice(0, 1), ...extra, ...seeds0.slice(1)].filter((s, i, a) => a.indexOf(s) === i).slice(0, 40);
return [{ json: { ...base, seeds, gsc_seeds: extra, search_console: {
  available: gsc.available, period_end: gsc.period_end, period_days: gsc.period_days, rows: gsc.rows, considered: gsc.considered,
  page_check: gsc.page_check, pages_known, brand_names: BR.keys, dropped: gsc.dropped,
  min_impressions: gsc.min_impressions, striking_min: gsc.striking_min, striking_max: gsc.striking_max,
  seeded: extra, queries: gsc.queries.slice(0, 60), no_page: gsc.no_page.slice(0, 30), striking: gsc.striking.slice(0, 30), answered: gsc.answered
} } }];
