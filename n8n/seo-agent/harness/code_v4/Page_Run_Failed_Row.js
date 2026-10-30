// W06-B (2026-10-30, docs/page-quality-2026-10-29/WAVE05.md 3.2, K4 first try, exec 379): a page run that stops on its failure path wrote no
// page, so the content-log row opened for it at the start (status `started`: the web app writes one when it starts a page, the Content
// Cadence one per page it spawns) must not keep saying a page is on its way. On "Start it again" the app read that row as "A page for ...
// was already written ... and is waiting to be published", and counted it among the pages waiting (the pile-up notice): both false.
// This node picks THIS run's opening row (its request id AND its keyword: a ladder start gives several page runs one request id, F-KW) and
// hands *Mark Page Run Failed* the exact key; that node moves it from `started` to `failed` with the reason in qa_reasons. A row in any
// other state (a page written earlier for the same keyword, a held row, a published page) is never touched: the update matches `started`
// only. Always one item out, so the settle chain after it runs once; with no row to mark it carries a key that matches no row.
const d = (() => { try { return $('Normalize Input').first().json || {}; } catch (e) { return {}; } })();
const norm = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();
const rid = String(d.request_id || '').trim();
const kw = norm(d.keyword);
const fail = (() => { const it = $input.first(); return ((it && it.json && it.json.llm_check) || {}); })();
const reason = String(fail.note || fail.error || 'the page run stopped before the page was written').slice(0, 480);
let rows = []; try { rows = $('Load Content Log (Failed)').all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error && r.keyword); } catch (e) { rows = []; }
const mine = rid && kw ? rows.filter(r => String(r.request_id || '') === rid && norm(r.keyword) === kw && String(r.status || '') === 'started') : [];
const NONE = '__no_row__';
if (!mine.length) return [{ json: { request_id: NONE, keyword: NONE, status: 'failed', qa_reasons: '', marked: 0,
  why: !rid ? 'the run carries no request id' : !kw ? 'the run carries no keyword' : 'no content-log row of this run says started (nothing to undo)' } }];
return [{ json: { request_id: rid, keyword: String(mine[0].keyword), status: 'failed', qa_reasons: 'page run failed: ' + reason, marked: mine.length,
  why: 'this run wrote no page: its opening row is marked failed, never "written" or "waiting to be published"' } }];
