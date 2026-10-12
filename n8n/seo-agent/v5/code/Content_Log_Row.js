// One seo_content_log row per content run (v4.14, FIX_PLAN D5). Every page the system writes passes through this workflow — the keyword
// ladder's own page runs, the app's "Write now" and the Content Cadence's Monday pages — so the row is written here, once, for all three.
// Before this, ladder pages were never logged: the pile-up guard counted 2 pages waiting while 4 were written and unpublished, and planned
// two more for the Monday after (execution 380).
// The row is upserted by site_id + keyword and carries exactly the table's columns. Status: started (the cadence / the app at the spawn)
// -> written (here, when the page exists) -> published (publish detection and "I published a page" close it).
// An existing row keeps what it already knows: its site id and keyword spelling (so the upsert matches it), where the keyword came from
// (`source` — the cadence's ai_answer / ai_refresh / striking / trend must survive) and the last published URL. A page that is written
// again (a refresh, a rewrite) goes back to `written`: the new text still waits for the owner to publish it.
const d = $('Normalize Input').first().json;
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// Report-only runs (a keyword report, a verdict) take the same delivery path, so the article itself has to say that a page exists:
// the Blog Package passes a run without content through untouched.
let page = {}; try { page = (($('Blog Package').first() || {}).json) || {}; } catch (e) { page = {}; }
if (!String(page.article_html || page.page_markdown || '').trim()) return [{ json: { skip: true, reason: 'no page was written in this run (report only)' } }];
const domain = normD(d.domain), keyword = String(d.keyword || '').trim();
if (!domain || !keyword) return [{ json: { skip: true, reason: 'no website or no keyword: there is nothing to follow to publication' } }];
const now = new Date().toISOString();
const logs = rowsOf('Load Content Log (Run)').filter(r => r.keyword && normD(r.domain) === domain);
const rid = String(d.request_id || '');
// the row this run already has (the cadence and the app write one when they start the run), else the newest row for the same keyword
const prior = (rid ? logs.find(r => String(r.request_id) === rid) : null) ||
  logs.filter(r => norm(r.keyword) === norm(keyword)).sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))[0] || null;
const ip = String(d.client_ip || '');
const source = (prior && prior.source) || (/^cadence:/i.test(ip) ? 'cadence' : /^app:/i.test(ip) ? 'app' : (/^ladder:/i.test(ip) || d.ladder_id) ? 'ladder' : 'manual');
const sameRun = !!prior && !!rid && String(prior.request_id) === rid;   // the run that opened the row: keep when it started
const rung = Number(d.ladder_rung != null && d.ladder_rung !== '' ? d.ladder_rung : (prior && prior.rung)) || 0;
return [{ json: {
  site_id: String((prior && prior.site_id) || ('site_' + domain.replace(/[^a-z0-9]+/g, '-'))),
  domain,
  keyword: String((prior && prior.keyword) || keyword),
  source,
  page_type: String(d.page_type || (prior && prior.page_type) || ''),
  existing_page_url: String(d.existing_page_url || (prior && prior.existing_page_url) || ''),
  rung,
  ladder_id: String(d.ladder_id || (prior && prior.ladder_id) || ''),
  request_id: rid || String((prior && prior.request_id) || ''),
  started_at: sameRun ? String(prior.started_at || now) : now,
  status: 'written',
  published_url: String((prior && prior.published_url) || ''),
  published_at: String((prior && prior.published_at) || ''),
  week: sameRun ? String(prior.week || now.slice(0, 10)) : now.slice(0, 10)
} }];
