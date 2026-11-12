// P1 (2026-11-12, prod review S1-01, plans/P1_page_concurrency.md): may this page run start writing now?
// On 2026-11-12 three page runs of one website started within 11 seconds and all three hit the time limit at 90-100% done: 0 of 3
// delivered. Every page run (the app's "Write it now", the Content Cadence, ladder pages, follow-ups, case studies) passes here after
// Rate Limit and before its first paid node. The decision is the run guard's (RG.pageSlot): admit when fewer than `limit` page runs are
// writing or ahead in line; otherwise wait (a saved Wait, then this node runs again: $runIndex counts the looks), hand the place in line
// to a new execution once this one has waited handoff_minutes (n8n measures a resumed execution's time limit from its first start), or
// give up after max_wait_hours with nothing charged.
// Input: the ledger rows of the last hours (*Load Page Slots*). The limit: seo_cache `slots:page` {"limit": n} when set (*Load Slot
// Override*), else Normalize Input's page_slots. Out: one item, the decision plus what the slot callback carries.
/*__RUN_GUARD__*/
const one = (n) => { try { return $(n).first().json || {}; } catch (e) { return {}; } };
const d = one('Normalize Input');
const mineRow = one('Run Ledger Row');
const reserved = one('Reserve Run Ledger');
const mine = { ...mineRow, ...(reserved && !reserved.error ? reserved : {}) };
const items = $input.all().map(i => i.json || {});
const read_failed = items.some(r => r && r.error);
const rows = items.filter(r => r && r.run_id && !r.error);
let limit = Number.isFinite(Number(d.page_slots)) && d.page_slots !== '' && d.page_slots != null ? Number(d.page_slots) : RG.PAGE.limit;
let limit_source = 'config';
try {
  const ov = $('Load Slot Override').all().map(i => i.json || {}).find(r => r && String(r.key || '') === RG.PAGE_KEY);
  if (ov) {
    let v = ov.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = {}; } }
    const n = Number(v && typeof v === 'object' ? v.limit : v);
    if (Number.isFinite(n) && n >= 0) { limit = Math.floor(n); limit_source = 'override ' + RG.PAGE_KEY; }
  }
} catch (e) {}
const ho = d.slot_handoff && typeof d.slot_handoff === 'object' ? d.slot_handoff : {};
const r = RG.pageSlot({ rows, read_failed, mine, now: new Date().toISOString(), limit, limit_source,
  max_wait_hours: d.page_slot_max_wait_hours, poll_seconds: d.page_slot_poll_seconds, handoff_minutes: d.page_slot_handoff_minutes,
  run_hours: RG.PAGE.run_hours, hops: ho.hops, queued_at: ho.queued_at || mine.queued_at, exec_started_at: mine.created_at });
const waiting = r.slot === 'wait' || r.slot === 'handoff';
const hops = Number(ho.hops) || 0;
return [{ json: { ...r,
  // the customer hears it once when the run first has to wait (and again from each execution that continues the wait, with a fresh
  // estimate), and once when a run that waited starts writing; a run admitted at once says nothing (the run page already says "writing")
  first_wait: waiting && $runIndex === 0,
  started_after_wait: r.slot === 'admit' && ($runIndex > 0 || hops > 0) && !r.fail_open,
  run_index: $runIndex, execution_id: String($execution.id),
  callback_url: d.via_webhook ? String(d.callback_url || '') : '', request_id: String(d.request_id || ''), domain: String(d.domain || ''), keyword: String(d.keyword || ''),
  handoff_failed_error: 'This page waited for a writing slot but could not keep its place in line, so it was not written. Nothing was charged. Start it again.' } }];
