// P1 review S3 / N2 (2026-11-12): did this run really get its writing slot? Runs right after *Take Page Slot* on a fresh read of the ledger
// (*Load Page Slots (Check)*, read BY NAME: never through $input, see Page_Slot.js). Of the page rows writing, the first `limit` by admission
// order keep their slot; a later one (two runs took the last slot at nearly the same moment) steps back to waiting, and a run whose own row
// did not turn `reserved` (the take failed) waits and takes again. Out: { keep, ... } for *Slot Kept?*.
/*__RUN_GUARD__*/
const one = (n) => { try { return $(n).first().json || {}; } catch (e) { return {}; } };
const ps = one('Page Slot');
let items = []; try { items = $('Load Page Slots (Check)').all().map(i => i.json || {}); } catch (e) { items = [{ error: 'Load Page Slots (Check) did not run' }]; }
const read_failed = items.some(r => r && r.error);
const r = RG.slotHeld({ rows: items.filter(x => x && x.run_id && !x.error), read_failed, run_id: String($execution.id), now: new Date().toISOString(),
  limit: ps.limit, run_hours: RG.PAGE.run_hours });
const reserved = one('Reserve Run Ledger');
// stepping back restores the row's queue clock: created_at = when this execution joined (its insert), so the waiter rules read it as before
return [{ json: { ...r, step_back_created_at: String(reserved.created_at || one('Run Ledger Row').created_at || new Date().toISOString()) } }];
