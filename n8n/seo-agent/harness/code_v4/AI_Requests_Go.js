// F2 (2026-10-23, ENGINE_AUDIT.md E1): nothing is paid unless its record is saved. Reads what *Save Asking State* answered (a Data Table
// upsert answers with the rows it wrote; on a failure it answers with `error`) and lets *AI Requests*' items through, unchanged and in their
// order (Parse AI Answers pairs answers with requests by index), only when EVERY state row *AI Asking State* sent came back. Otherwise it
// asks nothing and says which sites could not be recorded; *AI Chunk Handoff* raises the ops alert (nothing was paid, nothing is lost).
const sent = (() => { try { return $('AI Asking State').all().map(i => i.json).filter(r => r && r.key && !r.skip); } catch (e) { return []; } })();
let saved = []; try { saved = $('Save Asking State').all().map(i => i.json || {}); } catch (e) { saved = []; }
const reqs = $('AI Requests').all();
if (!sent.length) return reqs;   // no weekly-run key in this part (nothing to record): the requests go as they are
const ok = new Set(saved.filter(r => r && !r.error && r.key).map(r => String(r.key)));
const missing = sent.filter(r => !ok.has(String(r.key)));
if (!missing.length) return reqs;
const err = saved.find(r => r && r.error);
return [{ json: { skip: true, not_recorded: missing.map(r => r.site_id), reason: 'the run\'s record (seo_cache ' + missing.map(r => r.key).join(', ') + ') could not be saved'
  + (err ? ' (' + String((err.error && (err.error.message || err.error)) || err.error).slice(0, 200) + ')' : '') + ', so nothing was asked or paid for in this part' } }];
