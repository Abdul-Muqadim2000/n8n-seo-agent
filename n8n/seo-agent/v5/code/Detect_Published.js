// Publish detection, step 4: the title check on the pages read (a <title> or first <h1> holding >= 80% of the keyword's significant words), then
// one URL per candidate and one candidate per URL (slug matches first, then the best title match), and the rows to store — built by the same
// code as "I published a page" (Publish Check), so a detected page is stored exactly like a reported one. The live publish check itself is not
// run here; the Site Tracker inspects the page in Search Console (index status) in this same run and tracks its keyword from now on.
/*__PUBLISH_ROWS__*/
/*__OVERLAP__*/
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
    const { log_row, ladder_row } = publishedRows({ site_id: (c.log && c.log.site_id) || st.site_id, domain: st.domain, keyword, url: p.url, log: c.log, ladder: c.ladder, request_id: '', now });
    log_rows.push(log_row); if (ladder_row) ladder_rows.push(ladder_row);
    if (log_row.source === 'case_study' || /case stud/i.test(log_row.page_type)) case_rows.push({ site_id: log_row.site_id, keyword: log_row.keyword, page_url: p.url });
    detected.push({ keyword, url: p.url, ladder_id: log_row.ladder_id || (c.ladder ? c.ladder.ladder_id : ''), matched_by: p.matched_by, source: c.source });
  }
  const unmatched = (st.candidates || []).filter(c => !matched.has(c.key)).map(c => ({ keyword: c.keyword, note: (st.notes || {})[c.key] || '' }));
  return { json: { site_idx: st.site_idx, site_id: st.site_id, domain: st.domain, candidates: (st.candidates || []).length, sitemap: st.sitemap, pages_fetched: (st.fetches || []).length, detected, log_rows, ladder_rows, case_rows, unmatched } };
});
return out.length ? out : [{ json: { skip: true, reason: 'nothing to match' } }];   // the chain must reach the Search Console part in every case
