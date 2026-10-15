// ---- the rows a published page leaves (v4.8, PIPELINE_FEATURE_SPEC §6.5). ONE copy, inlined by the build into Publish Check ("I published a
// page", main workflow) and Detect Published (Site Tracker, publish detection), so a reported page and a detected page are stored identically.
//   log_row    seo_content_log, upsert by site_id + keyword, exactly the table columns: the written page's row (source, page type, rung, ladder,
//              request id and start date kept) with status published, the live URL and now; without a written row, a new one (source ladder / manual)
//   ladder_row seo_ladders, update by ladder_id + keyword: status published, target_url = the live URL, page_exists true (null when no ladder row)
// INVARIANTS rule 4 (2026-10-15, state_lint.py): `o.live` is what PROVED the page is there, and the builder refuses to advance the state
// without it. *Detect Published* only ever called this for a page that had answered 200 (or that the site's own sitemap declares), but
// *Publish Check* called it unconditionally: an owner clicking "I published a page" for a URL that answered 404 still got
// `status: 'published'`, a `published_url` and `page_exists: true` written into seo_content_log and seo_ladders -- while the very same run
// told them, in words, that the page could not be fetched. Every reader of those two tables (the ladder plan, the Rank Tracker, the Content
// Cadence's pile-up guard, the Site Tracker, the app) then treated a page nobody could reach as live. A record says a thing exists only
// when the thing exists.
// Without the proof the row keeps the state it already had, records no URL and no date -- there is nothing to claim -- and the ladder row is
// left alone entirely rather than being moved backwards. The run still answers the owner (the page could not be fetched; the Site Tracker
// looks again on Monday), and Monday's publish detection, which does prove it, is what closes the row.
// o: { site_id, domain, keyword, url, live (what proved the page is there), log (content-log row or null), ladder (ladder row or null), request_id, now (ISO) }
function publishedRows(o) {
  const log = o.log || null, ladder = o.ladder || null, now = o.now;
  const live = o.live === true;
  const log_row = { site_id: o.site_id, domain: o.domain, keyword: o.keyword, source: (log || {}).source || (ladder ? 'ladder' : 'manual'), page_type: (log || {}).page_type || (ladder ? (ladder.page_type || '') : ''), existing_page_url: (log || {}).existing_page_url || '', rung: Number((log || ladder || {}).rung) || 0,
    ladder_id: (log || ladder || {}).ladder_id || '', request_id: (log || {}).request_id || o.request_id || '', started_at: (log || {}).started_at || now,
    status: live ? 'published' : ((log || {}).status || 'reported'),
    published_url: live ? o.url : ((log || {}).published_url || ''),
    published_at: live ? now : ((log || {}).published_at || ''),
    week: live ? now.slice(0, 10) : ((log || {}).week || now.slice(0, 10)) };
  const ladder_row = (ladder && live) ? { ladder_id: ladder.ladder_id, keyword: ladder.keyword, status: 'published', target_url: o.url, page_exists: true } : null;
  return { log_row, ladder_row, live, not_live_reason: live ? '' : 'nothing confirmed the page is there, so no row says it is' };
}
