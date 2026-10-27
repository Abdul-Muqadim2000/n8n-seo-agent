// 2026-10-27: the answers of this part that are truly not in seo_ai_answers after the re-read (*Reread AI Answers*, one read per site whose
// save looked short), as exact table rows for ONE more insert (*Retry Save AI Answers*). An answer the table already holds - the save had
// reported an error for a row it did write, or the row carries its DataForSEO `error` column - is never inserted twice. Nothing is asked
// again and nothing is paid: these are the answers this part already read. Whatever is still missing after this insert, the hand-off
// records as `lost_keys` and the run pauses (`failed_store`) until the next start checks the table again.
/*__AI_PANEL__*/
let gaps = [], sent = [], saved = [], back = [];
try { gaps = $('AI Save Check').all().map(i => i.json).filter(g => g && !g.skip && g.site_id); } catch (e) {}
try { sent = $('AI Answer Rows').all().map(i => i.json).filter(r => r && !r.skip && r.engine && r.prompt_id && r.run_id); } catch (e) {}
try { saved = $('Save AI Answers').all().map(i => i.json || {}); } catch (e) {}
try { back = $('Reread AI Answers').all().map(i => i.json || {}); } catch (e) {}
const have = new Set([...saved, ...back].filter(AIP.storedRow).map(r => r.site_id + '|' + r.run_id + '|' + AIP.reqKey(r.prompt_id, r.engine)));
const want = new Set(gaps.map(g => g.site_id + '|' + g.run_id));
const seen = new Set(); const out = [];
for (const r of sent) {
  const k = r.site_id + '|' + r.run_id + '|' + AIP.reqKey(r.prompt_id, r.engine);
  if (!want.has(r.site_id + '|' + r.run_id) || have.has(k) || seen.has(k)) continue;
  seen.add(k); out.push({ json: { ...r } });   // AI Answer Rows already carries exactly the seo_ai_answers columns
}
return out.length ? out : [{ json: { skip: true, reason: gaps.length ? 'every answer of this part is in the table: the save had reported rows it did write' : 'no save gap' } }];
