// 2026-10-27 (production 2026-10-25, devaicon.com run ai_20261025_devaicon-com): did *Save AI Answers* store every answer this part paid for?
// A row is stored when the Data Table handed it back with its `id` (n8n 2.41 inserts a call's rows in one transaction and returns each row,
// or fails them all) - never judged by the row's `error` column, which holds DataForSEO's message for an answer the gate could not read.
// One item per site whose answers are not all handed back: *Reread AI Answers* reads that run's rows from seo_ai_answers (a save can report
// an error for rows it did write), and *AI Save Retry Rows* inserts once more only the ones that are truly not there. Nothing is asked
// again: this reads and writes the table only. No gap -> a skip item, and the part goes on to the Answer Analyst as before.
/*__AI_PANEL__*/
let sent = [], saved = [], ran = true;
try { sent = $('AI Answer Rows').all().map(i => i.json).filter(r => r && !r.skip && r.engine && r.prompt_id && r.run_id); } catch (e) {}
try { saved = $('Save AI Answers').all().map(i => i.json || {}); } catch (e) { ran = false; }
const sites = [...new Map(sent.map(r => [r.site_id + '|' + r.run_id, { site_id: r.site_id, run_id: r.run_id, domain: r.domain || '' }])).values()];
const out = [];
for (const s of sites) {
  const c = AIP.storeCheck({ site_id: s.site_id, run_id: s.run_id, sent, saved: ran ? saved : [] });
  if (c.missing.length) out.push({ json: { site_id: s.site_id, run_id: s.run_id, domain: s.domain, sent: c.sent, handed_back: c.stored, missing: c.missing.length,
    note: c.missing.length + ' of the ' + c.sent + ' answers of ' + (s.domain || s.site_id) + ' were not handed back by the save: the run\'s rows are read back before anything is decided' } });
}
return out.length ? out : [{ json: { skip: true, reason: sent.length ? 'every answer of this part was stored' : 'no answer rows in this part' } }];
