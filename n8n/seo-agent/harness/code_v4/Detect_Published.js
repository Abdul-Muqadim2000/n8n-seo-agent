// Publish detection, step 4: the title check on the pages read (a <title> or first <h1> holding >= 80% of the keyword's significant words), then
// one URL per candidate and one candidate per URL (slug matches first, then the best title match), and the rows to store — built by the same
// code as "I published a page" (Publish Check), so a detected page is stored exactly like a reported one. The live publish check itself is not
// run here; the Site Tracker inspects the page in Search Console (index status) in this same run and tracks its keyword from now on.
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
// rule R1 "one search, one page" — the same words as the web app (app/shared/src/ladders.ts): lower case, one-letter and stop words out, a light
// stem, place names kept; two keywords are the same search when their word sets are equal or 75%+ the same (Jaccard)
const OVERLAP_STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'with', 'by', 'at', 'from', 'near', 'me', 'vs', 'is', 'are', 'what', 'how', 'best', 'top', 'your', 'my']);
const overlapTokens = (s) => { const out = []; for (const t of String(s || '').toLowerCase().split(/[^a-z0-9]+/)) { if (t.length <= 1 || OVERLAP_STOP.has(t)) continue;
  const w = t.replace(/ies$/, 'y').replace(/(ing|ed|es|s)$/, '').replace(/[^a-z0-9]/g, ''); if (w && !out.includes(w)) out.push(w); } return out; };
const overlapScore = (a, b) => { if (!a.length || !b.length) return 0; const sb = new Set(b); const common = a.filter(t => sb.has(t)).length; return common / (a.length + b.length - common); };
const keywordsOverlap = (a, b) => overlapScore(overlapTokens(a), overlapTokens(b)) >= 0.75;
const CONFIG = { title_share: 0.8, max_html_chars: 300000 };
const ms = $('Match Slugs (Detect)').all().map(i => i.json || {});
const state = (ms[0] && ms[0].sites) || [];
const fetchReq = ms.filter(x => x.fetch && x.url);
let fetchRes = []; if (fetchReq.length) { try { fetchRes = $('Fetch Pages (Detect)').all().map(i => i.json || {}); } catch (e) { fetchRes = []; } }
const bodyOf = (r) => { const b = r && (r.body != null ? r.body : r.data); return typeof b === 'string' ? b : (b ? JSON.stringify(b) : ''); };   // text responses come under `data`
const clean = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z0-9#]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const pick1 = (b, re) => { const x = b.match(re); return x ? clean(x[1]) : ''; };
const tokHit = (t, set) => set.some(x => x === t || (t.length >= 5 && x.length >= 5 && (x.startsWith(t) || t.startsWith(x))));
const shareOf = (kwT, other) => kwT.length ? kwT.filter(t => tokHit(t, other)).length / kwT.length : 0;
const pages = new Map();
fetchReq.forEach((q, i) => { const r = fetchRes[i] || {}; const st = Number(r.statusCode) || (r.error ? 0 : (fetchRes[i] ? 200 : 0)); const b = st === 200 ? bodyOf(r).slice(0, CONFIG.max_html_chars) : '';
  pages.set(q.url, { ok: st === 200 && !r.error && !!b, status: st, title: pick1(b, /<title[^>]*>([\s\S]*?)<\/title>/i), h1: pick1(b, /<h1[^>]*>([\s\S]*?)<\/h1>/i) }); });
const now = new Date().toISOString();
const out = state.map(st => {
  const matched = new Map((st.slug_matches || []).map(p => [p.key, p])), claimed = new Set((st.slug_matches || []).map(p => p.ukey));
  const pairs = [];
  for (const ch of st.title_checks || []) {
    if (matched.has(ch.key)) continue;
    for (const o of ch.options || []) {
      const pg = pages.get(o.url); if (!pg || !pg.ok) continue;
      const best = Math.max(shareOf(ch.tokens, overlapTokens(pg.title)), shareOf(ch.tokens, overlapTokens(pg.h1)));
      if (best >= CONFIG.title_share) pairs.push({ key: ch.key, url: o.url, ukey: o.ukey, score: 50 + 20 * best + 10 * (Number(o.slug_share) || 0), matched_by: 'title' });
    }
  }
  pairs.sort((a, b) => b.score - a.score);
  for (const p of pairs) if (!matched.has(p.key) && !claimed.has(p.ukey)) { matched.set(p.key, p); claimed.add(p.ukey); }
  const detected = [], log_rows = [], ladder_rows = [], case_rows = [];
  for (const c of st.candidates || []) {
    const p = matched.get(c.key); if (!p) continue;
    const keyword = (c.log || c.ladder || {}).keyword || c.keyword;
    // the content-log row keeps its own site_id: the upsert (site_id + keyword) must hit the row the Content Cadence wrote
    // INVARIANTS rule 4: what proves this page is there — HTTP 200 for the pages this run fetched (a title match), and the site's own
    // sitemap for a slug match, which is the site declaring the page exists. Either way it is evidence from outside this run.
    const pgLive = pages.get(p.url);
    const live = pgLive ? !!pgLive.ok : true;
    const { log_row, ladder_row } = publishedRows({ site_id: (c.log && c.log.site_id) || st.site_id, domain: st.domain, keyword, url: p.url, log: c.log, ladder: c.ladder, request_id: '', now, live });
    if (!live) continue;
    log_rows.push(log_row); if (ladder_row) ladder_rows.push(ladder_row);
    if (log_row.source === 'case_study' || /case stud/i.test(log_row.page_type)) case_rows.push({ site_id: log_row.site_id, keyword: log_row.keyword, page_url: p.url });
    detected.push({ keyword, url: p.url, ladder_id: log_row.ladder_id || (c.ladder ? c.ladder.ladder_id : ''), matched_by: p.matched_by, source: c.source });
  }
  const unmatched = (st.candidates || []).filter(c => !matched.has(c.key)).map(c => ({ keyword: c.keyword, note: (st.notes || {})[c.key] || '' }));
  // D11: the sitemap URLs this run read, plus the title / H1 of the pages it fetched, feed the week's page inventory (seo_pages)
  const titles = (st.fetches || []).map(u => { const pg = pages.get(u); return (pg && pg.ok) ? { url: u, title: pg.title, h1: pg.h1 } : null; }).filter(Boolean);
  return { json: { site_idx: st.site_idx, site_id: st.site_id, domain: st.domain, candidates: (st.candidates || []).length, sitemap: st.sitemap, pages_fetched: (st.fetches || []).length, detected, log_rows, ladder_rows, case_rows, unmatched, inventory: st.inventory || [], page_titles: titles } };
});
return out.length ? out : [{ json: { skip: true, reason: 'nothing to match' } }];   // the chain must reach the Search Console part in every case
