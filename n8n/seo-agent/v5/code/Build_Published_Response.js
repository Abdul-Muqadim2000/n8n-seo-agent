// API answer for mode "published" (POSTed to callback_url): the publish check, the link suggestions and the stored state.
const p = $input.first().json;
return [{ json: { status: 'completed', stage: 'published', request_id: p.request_id || null, domain: p.domain, keyword: p.keyword, published_url: p.published_url, live: p.live,
  // 2026-10-27: whether the page was recorded as published, and if not why (the live page did not match the draft, the update was not
  // live, the address belongs to another keyword); `confirmable` = the owner may re-send with confirm_mismatch: true
  recorded: p.recorded_live === true, verified: p.verified === true, verify: p.verify || null, verify_message: p.verify_message || '', verify_missing: p.verify_missing || [], verify_note: p.verify_note || '', verify_evidence: p.verify_evidence || null, confirmable: p.confirmable === true, confirmed: p.confirmed === true, content_request_id: p.content_request_id || '',
  http_status: p.http_status, fetch_error: p.fetch_error || null, checks: p.checks, images: p.images || null, page_signals: p.page_signals || null, passed: p.passed, failed: p.failed, link_from: p.link_from,
  page: { title: p.page_title, h1: p.page_h1, meta_description: p.page_meta_description, canonical: p.canonical, jsonld_blocks: p.jsonld_blocks, words: p.words }, ladder_found: p.ladder_found, log_found: p.log_found, stored: p.stored, store_error: p.store_error, summary: p.summary, callback_url: p.callback_url } }];
