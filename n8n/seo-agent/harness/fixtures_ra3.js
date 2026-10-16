// Fixtures for S106-S109 (agent A3, 2026-10-16): the weekly site report's monitor block (R78, R112) and its subject line (R113).
// The monitor rows are cut from exec 634 (Site Tracker on demand, techand.ai, 2026-10-15) — the newest rows of each table, trimmed to
// the columns Site_Report.js reads. The Site Metrics item is synthetic and minimal (no query or page rows); only its `significance`
// block is the real one of exec 634 (clicks 21 -> 32, "up 52%", not a real change; impressions 1637 -> 5308, a real change).
const SITE = 'site_techand-ai';

const audits = [
  // the technical audits (report_type site_audit)
  { audited_at: '2026-10-14T16:35:43.415Z', report_type: 'site_audit', health_score: 83, grade: 'Good', critical: 0, high: 4, medium: 10, pages_crawled: 47 },
  { audited_at: '2026-10-14T17:59:58.161Z', report_type: 'site_audit', health_score: 83, grade: 'Good', critical: 0, high: 4, medium: 9, pages_crawled: 47 },
  { audited_at: '2026-10-15T19:07:10.760Z', report_type: 'site_audit', health_score: 83, grade: 'Good', critical: 0, high: 4, medium: 9, pages_crawled: 47 },
  // the full SEO reports (report_type full) — the newest row of the table is one of these
  { audited_at: '2026-10-14T16:30:00.853Z', report_type: 'full', health_score: 69, grade: 'Needs Improvement', critical: 0, high: 18, medium: 22, pages_crawled: 47 },
  { audited_at: '2026-10-15T19:15:18.685Z', report_type: 'full', health_score: 70, grade: 'Needs Improvement', critical: 0, high: 17, medium: 22, pages_crawled: 47 },
].map(r => ({ site_id: SITE, ...r }));

const snapshots = [
  { checked_at: '2026-10-13T07:16:07.161Z', mode: 'full', referring_domains: 18, union_domains: 2, new_links: 0, lost_links: 0, important_lost: 0, spammy_new: 0, spam_score: 63 },
  { checked_at: '2026-10-14T16:18:36.362Z', mode: 'full', referring_domains: 18, union_domains: 3, new_links: 1, lost_links: 0, important_lost: 0, spammy_new: 0, spam_score: 63 },
  // a free_only check: it never reads DataForSEO, so its referring_domains is 0 — it is no baseline for the index's counts
  { checked_at: '2026-10-14T17:54:57.092Z', mode: 'free', referring_domains: 0, union_domains: 3, new_links: 0, lost_links: 0, important_lost: 0, spammy_new: 0, spam_score: 0 },
  { checked_at: '2026-10-15T19:40:42.109Z', mode: 'full', referring_domains: 18, union_domains: 3, new_links: 0, lost_links: 0, important_lost: 0, spammy_new: 0, spam_score: 63 },
].map(r => ({ site_id: SITE, ...r }));

const eng = (o) => JSON.stringify(o);
const SIX = { chatgpt: { asked: 7, answered: 7 }, perplexity: { asked: 7, answered: 7 }, gemini: { asked: 7, answered: 7 }, claude: { asked: 7, answered: 7 }, ai_overview: { asked: 7, answered: 6 }, ai_mode: { asked: 7, answered: 7 } };
const aiRows = [
  { checked_at: '2026-10-14T16:18:35.891Z', mention_rate: 0, citation_rate: 0, share_of_voice: 0, prompts: 8, run_kind: 'on_demand', alerts: '', engines_json: eng(SIX), competitors_json: '[]' },
  { checked_at: '2026-10-15T19:29:37.688Z', mention_rate: 0, citation_rate: 0, share_of_voice: 0, prompts: 8, run_kind: 'on_demand', alerts: '', engines_json: eng(SIX), competitors_json: '[]' },
].map(r => ({ site_id: SITE, ...r }));

// the significance block exactly as exec 634's Site Metrics carried it
const significance = {
  clicks: { cur: 32, prev: 21, pct: 52, z: 1.51, ci: [-12, 164], measurable: true, significant: false, big: true, real: false, watch: true, direction: 'up', text: 'up 52% (21 → 32, 95% range -12% to 164%)' },
  impressions: { cur: 5308, prev: 1637, pct: 224, z: 44.05, ci: [207, 243], measurable: true, significant: true, big: true, real: true, watch: false, direction: 'up', text: 'up 224% (1637 → 5308, 95% range 207% to 243%)' },
  sessions: { cur: 84, prev: 46, pct: 83, z: 3.33, ci: [27, 162], measurable: true, significant: true, big: true, real: true, watch: false, direction: 'up', text: 'up 83% (46 → 84, 95% range 27% to 162%)' },
};

/** A minimal Site Metrics item: Search Console connected with only totals and deltas, GA4 off, nothing else to list. */
function siteMetrics(over = {}) {
  const gsc = {
    connected: true, property: 'sc-domain:techand.ai', permission: 'siteFullUser', error: null,
    totals: { cur: { clicks: 32, impressions: 5308, ctr: 0.6, position: 6.5 }, prev: { clicks: 21, impressions: 1637, ctr: 1.28, position: 13 } },
    deltas: { clicks_pct: 52, impressions_pct: 224, ctr_pts: -0.68, position: 6.5, yoy_clicks_pct: null },
    daily: [], query_count: 0, page_count: 0, anonymised: null, brand_split: null, scraper_queries: { count: 0, sample: [] }, rows_read: 0, paging: [], truncated: [],
    winners: [], losers: [], new_queries: [], lost_queries: [], striking: [], ctr_gaps: [], top_pages: [], decaying_pages: [], not_decay: [], decay_summary: null,
    rising_pages: [], errors: [], cannibal: [], cannibal_summary: null, devices: null, countries: null,
  };
  return {
    site_id: SITE, domain: 'techand.ai', email: '', callback_url: '', request_id: 'rq-a3', on_demand: true, weeks_tracked: 3, first_run: false,
    period: { current: { start: '2026-09-15', end: '2026-10-12' }, previous: { start: '2026-08-18', end: '2026-09-14' } },
    form_url: 'https://forms.example.test/seo', api_url: 'https://api.example.test/seo', service_account_email: 'svc@example.test',
    gsc, ga4: { connected: false, error: 'not connected', property_id: '', detected: false, organic: { cur: {}, prev: {} }, total: { cur: {} }, channels: [], landing: [], organic_share: 0 },
    significance, alerts: [], actions: [], tracked: [], trends: [], ladder_pages: [], pending_publish: [], detected_published: [], set_aside: [], set_aside_note: '',
    lineage: [], annotations: [], data_breaks: [], console: { notices: [], last_checkin: null, checkin_due: false }, change_tests: null, change_method: '',
    ...over,
  };
}

module.exports = { SITE, audits, snapshots, aiRows, significance, siteMetrics };
