// KI Limit Notice (E2, 2026-11-08, CONTRACTS.md §4): a run the daily guards refused (KI Limit) tells its caller with the final KI callback,
// status `refused`, the reason and the sentence. Its ledger row was marked `refused` by *Refuse KI Limit (KI)* (an update node answers with
// the row it wrote, so the refusal is read from KI Limit by name). Nothing was spent.
/*__KI_KITS__*/
const p = $('KI Plan').first().json || {};
const l = $('KI Limit').first().json || {};
return [{ json: { callback_url: p.callback_url || '', callback_body: KIW.refusalBody(p, l.reason || 'rate_limited', l.note || ''), refused: true, reason: l.reason || 'rate_limited' } }];
