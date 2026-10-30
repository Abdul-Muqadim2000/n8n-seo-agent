// W06-B (2026-10-30, docs/page-quality-2026-10-29/WAVE05.md 3.2): the end of a run that took its failure path. *Draft Check (Copywriter)*
// used to throw where it found the page cut off a second time, so the run-ledger row stayed `reserved` at $0 while about $0.85 of Claude
// had been spent (exec 379). The failed item now goes through the settle chain first (the row is settled with what the run spent), and
// THIS node ends the execution with the same error as before, so n8n records the run as failed, the error handler alerts ops and the web
// app's failure watcher closes the run with the engine's own sentence (the client is not charged). Every other run passes through here
// after its settle and nothing happens: no item out.
const FAIL_NODES = ['Draft Check (Copywriter)'];
for (const nd of FAIL_NODES) for (let r = 0; r < 12; r++) {
  let a = null; try { a = $(nd).all(0, r); } catch (e) { break; }
  if (!a || !a.length) break;
  for (const i of a) { const k = i && i.json && i.json.llm_check; if (k && k.failed) throw new Error(String(k.error || 'The page run stopped before the page was written. Start the page again.')); }
}
return [];
