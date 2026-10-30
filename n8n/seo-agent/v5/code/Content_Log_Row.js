// One seo_content_log row per content run (v4.14, FIX_PLAN D5). Every page the system writes passes through this workflow — the keyword
// ladder's own page runs, the app's "Write now" and the Content Cadence's Monday pages — so the row is written here, once, for all three.
// Before this, ladder pages were never logged: the pile-up guard counted 2 pages waiting while 4 were written and unpublished, and planned
// two more for the Monday after (execution 380).
// The row is upserted by site_id + keyword and carries exactly the table's columns. Status: started (the cadence / the app at the spawn)
// -> written (here, when the page exists and passed its last quality round) or not_ready (it failed it: R111) -> published (publish detection and "I published a page" close it).
// An existing row keeps what it already knows: its site id and keyword spelling (so the upsert matches it), where the keyword came from
// (`source` — the cadence's ai_answer / ai_refresh / striking / trend must survive) and the last published URL. A page that is written
// again (a refresh, a rewrite) goes back to `written`: the new text still waits for the owner to publish it.
const d = $('Normalize Input').first().json;
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const norm = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();   // F-KW (2026-10-20, finding 8): every script, as cycleNorm
// Report-only runs (a keyword report, a verdict) take the same delivery path, so the article itself has to say that a page exists:
// the Blog Package passes a run without content through untouched.
let page = {}; try { page = (($('Blog Package').first() || {}).json) || {}; } catch (e) { page = {}; }
// W0-D (page-quality 2026-10-29, REVIEW_CODE M3): a run *Parse Verdict* HELD for the client's OK wrote no page, and used to leave the
// opening `started` row as it was. Once that row is older than the in-flight window the cadence picked the keyword again, held it again
// and paid for the check again, every week. A held run now writes `held` with the score and the reasons in `qa_reasons`; the Content
// Cadence and the app's mirror (cadence.ts) skip a held keyword until the client says "Write it anyway" (a run with hold_ack, which
// writes the page and moves the row on) or 90 days pass (D1: the cycle then takes its next candidate). A hold in SHADOW mode wrote the
// page as before, so its row is the page's row; nothing here changes for it. No new column: `held` is a status value.
let PVH = {}; try { PVH = (($('Parse Verdict').first() || {}).json) || {}; } catch (e) { PVH = {}; }
const heldRun = PVH.verdict_hold === true && !!PVH.hold;
// W07-A (2026-10-31, WAVE06 "Open resilience item"): a page run that stopped because the pages it needs could not be read (the page reader
// refused and its fallback failed too) wrote nothing and decided nothing. Its opening `started` row becomes `failed` with the reason, as a
// failed page run's row does (W06-B), never `held` (a hold keeps the keyword off the cadence for 90 days; this is a problem on our side and
// the keyword is tried again).
const unreadRun = PVH.pages_unread_stop === true && !!PVH.pages_unread && !heldRun;
if (!String(page.article_html || page.page_markdown || '').trim() && !heldRun && !unreadRun) return [{ json: { skip: true, reason: 'no page was written in this run (report only)' } }];
const domain = normD(d.domain), keyword = String(d.keyword || '').trim();
if (!domain || !keyword) return [{ json: { skip: true, reason: 'no website or no keyword: there is nothing to follow to publication' } }];
const now = new Date().toISOString();
const logs = rowsOf('Load Content Log (Run)').filter(r => r.keyword && normD(r.domain) === domain);
const rid = String(d.request_id || '');
// the row this run already has (the cadence and the app write one when they start the run), else the newest row for the same keyword.
// F-KW (2026-10-20, finding 7): by request id AND keyword. A ladder start with pages_now 2-3 gives every page run the ladder run's one
// request id (the app matches its callbacks by that id), so a lookup by id alone handed page 2 the row of page 1: page 2 took page 1's
// keyword, and the upsert by site + keyword overwrote page 1's row. A row of the same run for ANOTHER keyword is never this page's row.
const prior = (rid ? logs.find(r => String(r.request_id) === rid && norm(r.keyword) === norm(keyword)) : null) ||
  logs.filter(r => norm(r.keyword) === norm(keyword)).sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))[0] || null;
const ip = String(d.client_ip || '');
const source = (prior && prior.source) || (/^cadence:/i.test(ip) ? 'cadence' : /^app:/i.test(ip) ? 'app' : (/^ladder:/i.test(ip) || d.ladder_id) ? 'ladder' : 'manual');
const sameRun = !!prior && !!rid && String(prior.request_id) === rid;   // the run that opened the row: keep when it started
const rung = Number(d.ladder_rung != null && d.ladder_rung !== '' ? d.ladder_rung : (prior && prior.rung)) || 0;
// R111 (2026-10-16, re-rating 2026-10-15): the row used to say `written` whenever the package held article text, whatever the page's
// LAST quality round decided — and nine readers turn `written` into "publish it" (exec 634's top action, exec 632's "already written —
// publish it", the cadence's pile-up note, the Claude site brief). The verdict is already on the package: *Content QA* decides it and
// *Originality Check* re-decides it when it invalidates the gate (B3-3); *Build Word File* carries it as `qa_not_ready` / `qa_reasons`
// and *Blog Package* passes it on. A draft that failed is `not_ready` with the reasons, so every reader can say "fix it and run it
// again" instead; `written` keeps meaning exactly "passed QA, waiting to be published". A package with no verdict at all (an older
// path) is never invented as failed.
const meta = page.article_meta || {};
const held = heldRun && !String(page.article_html || page.page_markdown || '').trim();
const unread = unreadRun && !String(page.article_html || page.page_markdown || '').trim();
if (unread && (!prior || !['', 'started', 'held', 'failed'].includes(String(prior.status || ''))))   // W07-A: only this run's own opening row, never a page that exists
  return [{ json: { skip: true, reason: 'the pages could not be read and no page was written; ' + (prior ? 'the page this keyword already has keeps its row (' + String(prior.status) + ')' : 'no row of this keyword to mark') } }];
// a hold wrote nothing, so it never takes the place of a page that exists: a written, not-ready or published row keeps its state
if (held && prior && !['', 'started', 'held', 'failed'].includes(String(prior.status || '')))   // W06-B: a failed run's row is not a page either
  return [{ json: { skip: true, reason: 'held for the client\'s OK; the page this keyword already has keeps its row (' + String(prior.status) + ')' } }];
const notReady = !held && (page.qa_not_ready === true || (page.qa_not_ready == null && !!(meta.quality && meta.quality.not_ready === true)));
const reasons = held
  ? ['held for your OK' + (PVH.hold.score != null ? ': verdict score ' + PVH.hold.score + ' (under ' + (PVH.hold.threshold || 50) + ')' : ''),
     ...(Array.isArray(PVH.hold.duplicates) && PVH.hold.duplicates.length ? ['your website already has a page for this search: ' + PVH.hold.duplicates.map(x => x.url).join(', ')] : [])]
  : (Array.isArray(page.qa_reasons) ? page.qa_reasons : (meta.quality && Array.isArray(meta.quality.reasons) ? meta.quality.reasons : []))
  .map(x => String(x || '').trim()).filter(Boolean);
const row = {
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
  status: notReady ? 'not_ready' : 'written',
  published_url: String((prior && prior.published_url) || ''),
  published_at: String((prior && prior.published_at) || ''),
  week: sameRun ? String(prior.week || now.slice(0, 10)) : now.slice(0, 10),
  qa_reasons: notReady ? reasons.join('; ').slice(0, 1500) : '',
  publish_note: ''   // 2026-10-27: a page written again waits again, so a note about how its earlier version was marked published no longer applies
};
if (held) { row.status = 'held'; row.qa_reasons = reasons.join('; ').slice(0, 1500); }   // W0-D: what was held and why, for the cadence and the app
if (unread) { row.status = 'failed'; row.qa_reasons = ('page run failed: the pages it needs could not be read, so nothing was written: ' + String(PVH.pages_unread.client_reason || 'the service we use to read web pages did not answer')).slice(0, 1500); }   // W07-A
return [{ json: row }];
