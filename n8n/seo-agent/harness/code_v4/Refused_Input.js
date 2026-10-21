// v4.14 (D1): the ledger row is marked refused; the refused request (Rate Limit's item) continues to the error path — a Data Table node outputs the row, not its input.
// N2 (2026-10-22): the item Input OK? judged - the duplicate-ladder check's, which may carry the refusal - else Rate Limit's
let __rq = null; try { __rq = $('Ladder Duplicate (Words)').first().json; } catch (e) {}
return [{ json: __rq || $('Rate Limit').first().json }];