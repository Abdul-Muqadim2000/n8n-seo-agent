// Index coverage (fix wave 1, E13): the pages Google answered with a PER-MINUTE limit (another tool inspecting the same property at the same
// moment), asked once more after a one-minute pause (Wait, then Inspect URL (Retry), 400 ms apart). A second per-minute answer is then read
// as the day's quota. Never "the daily quota was used up" for a minute's limit.
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const grab = (n) => { try { return $(n).all().map(i => i.json); } catch (e) { return []; } };
const pq = grab('Index Probe Requests').filter(q => q && !q.skip), iq = grab('Index Inspect Requests').filter(q => q && !q.skip);
const reqs = pq.concat(iq);
const res = grab('Inspect URL (Probe)').slice(0, pq.length).concat(grab('Inspect URL (Index)'));
const out = [];
reqs.forEach((q, i) => { const r = IX.readInspection(res[i] || {}); if (!r.ok && r.error_kind === 'rate' && out.length < IX.CFG.rate_retry_max) out.push({ json: { ...q, retry: true } }); });
return out.length ? out : [{ json: { skip: true, reason: 'no per-minute limit to wait out' } }];
