// v4.14 (D1): the ledger row is marked refused; the refused request (Rate Limit's item) continues to the error path — a Data Table node outputs the row, not its input.
// N2 (2026-10-22): the item Input OK? judged - the duplicate-ladder check's, which may carry the refusal - else Rate Limit's
let __rq = null; try { __rq = $('Ladder Duplicate (Words)').first().json; } catch (e) {}
// P1 (2026-11-12): a page run that gave up waiting for a writing slot (or could not hand its wait on) carries the slot's own reason
let __ps190 = null; try { __ps190 = $('Page Slot').first().json || null; } catch (e) {}
let __hoFail190 = false; try { const __h = $('Hand Off Page Run').first().json; __hoFail190 = !!(__h && __h.error); } catch (e) {}
const __slotErr190 = __ps190 ? String(__ps190.validation_error || (__hoFail190 ? __ps190.handoff_failed_error : '') || '') : '';
const __base190 = __rq || $('Rate Limit').first().json;
return [{ json: __slotErr190 ? { ...__base190, validation_error: __slotErr190 } : __base190 }];