// R-E1 (2026-10-23, docs/ai-visibility-2026-10-23/REVIEW_ENGINE.md): nothing of the options is paid unless its record is saved (AI Requests Go's
// rule for the weekly requests). Reads what *Save Extras State* answered and lets *AI Extra Requests*' items through, unchanged and in their
// order (AI Extras pairs answers with requests by index), only when EVERY state row *Extras Asking State* sent came back. Otherwise nothing is
// asked and AI Extras writes the reason into the run's notes.
const sent = (() => { try { return $('Extras Asking State').all().map(i => i.json).filter(r => r && r.key && !r.skip); } catch (e) { return []; } })();
let saved = []; try { saved = $('Save Extras State').all().map(i => i.json || {}); } catch (e) { saved = []; }
const reqs = $('AI Extra Requests').all();
if (!sent.length) return [{ json: { skip: true, not_recorded: [], reason: 'no option request was recorded, so none is sent' } }];
const ok = new Set(saved.filter(r => r && !r.error && r.key).map(r => String(r.key)));
const missing = sent.filter(r => !ok.has(String(r.key)));
if (!missing.length) return reqs;
const err = saved.find(r => r && r.error);
return [{ json: { skip: true, not_recorded: missing.map(r => r.site_id), reason: 'the options of this run were not asked: their record (seo_cache ' + missing.map(r => r.key).join(', ') + ') could not be saved'
  + (err ? ' (' + String((err.error && (err.error.message || err.error)) || err.error).slice(0, 200) + ')' : '') + ', so nothing was paid for them' } }];
