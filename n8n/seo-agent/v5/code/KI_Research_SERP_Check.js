// SERP Tasks Check (__ROUND__) (QUEUE 2026-11-11): what the free task_get answered for the tasks of this round. Ready pages are read later by
// the fallback and the picture from this round's Get node; the ones still queued go round again (a minute later), up to __ROUNDS__ rounds.
/*__KI_KITS__*/
const all = (n) => { try { return $(n).all(0).map(i => (i && i.json) || {}); } catch (e) { return []; } };
const R0 = __ROUND__;
const r = KIW.collectRound(all('Wait For SERP Tasks (' + R0 + ')'), all('Get SERP Tasks (' + R0 + ')'));
const next = r.pending.map(q => ({ ...q, round: R0 + 1 }));
return next.length ? next.map(j => ({ json: j })) : [{ json: { skip: true, reason: 'every queued results page was collected (round ' + R0 + '): ' + r.ready.length + ' ready, ' + r.failed.length + ' failed' } }];
