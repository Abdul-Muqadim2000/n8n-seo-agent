// Key pages checked this week (seo_ai_pages, upsert by site + url) (exact columns)
// R92 part 6: the URL in the upsert key is on the canonical host, whatever host the page was read under
const COLS = ["site_id", "domain", "url", "kind", "checked_at", "status", "score", "checks_json", "issues", "words_raw", "title", "updated_on", "bing_crawled_at", "bing_status", "submitted_at", "submitted_via", "cited_by", "questions"];
const plans = (() => { try { return $('Growth Plan').all().map(i => i.json).filter(p => p && p.site_id); } catch (e) { return []; } })();
const hostFor = new Map(plans.map(p => [p.site_id, String(p.site_host || '').toLowerCase().replace(/\.$/, '')]));
const bare = (h) => String(h || '').toLowerCase().replace(/^www\./, '');
const canon = (r) => { const h = hostFor.get(r.site_id) || ''; const m = String(r.url || '').match(/^https?:\/\/([^\/?#]+)(.*)$/i);
  if (!h || !m || bare(m[1]) !== bare(h)) return r.url; return 'https://' + h + (m[2] || '/'); };
const rows = $('Growth Metrics').all().flatMap(i => i.json.page_rows || []).map(r => ({ ...r, url: canon(r) })).map(r => Object.fromEntries(COLS.map(c => [c, r[c] === undefined ? null : r[c]])));
const one = new Map(); for (const r of rows) one.set(r.site_id + '|' + r.url, r);   // two variants of one page in one run: one row, the last read wins (as the upsert would)
const out = [...one.values()];
return out.length ? out.map(r => ({ json: r })) : [{ json: { skip: true } }];