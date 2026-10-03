// ---- the rows a published page leaves (v4.8, PIPELINE_FEATURE_SPEC §6.5). ONE copy, inlined by the build into Publish Check ("I published a
// page", main workflow) and Detect Published (Site Tracker, publish detection), so a reported page and a detected page are stored identically.
//   log_row    seo_content_log, upsert by site_id + keyword, exactly the table columns: the written page's row (source, page type, rung, ladder,
//              request id and start date kept) with status published, the live URL and now; without a written row, a new one (source ladder / manual)
//   ladder_row seo_ladders, update by ladder_id + keyword: status published, target_url = the live URL, page_exists true (null when no ladder row)
// o: { site_id, domain, keyword, url, log (content-log row or null), ladder (ladder row or null), request_id, now (ISO) }
function publishedRows(o) {
  const log = o.log || null, ladder = o.ladder || null, now = o.now;
  const log_row = { site_id: o.site_id, domain: o.domain, keyword: o.keyword, source: (log || {}).source || (ladder ? 'ladder' : 'manual'), page_type: (log || {}).page_type || (ladder ? (ladder.page_type || '') : ''), existing_page_url: (log || {}).existing_page_url || '', rung: Number((log || ladder || {}).rung) || 0,
    ladder_id: (log || ladder || {}).ladder_id || '', request_id: (log || {}).request_id || o.request_id || '', started_at: (log || {}).started_at || now, status: 'published', published_url: o.url, published_at: now, week: now.slice(0, 10) };
  const ladder_row = ladder ? { ladder_id: ladder.ladder_id, keyword: ladder.keyword, status: 'published', target_url: o.url, page_exists: true } : null;
  return { log_row, ladder_row };
}
