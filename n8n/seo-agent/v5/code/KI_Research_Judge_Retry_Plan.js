// Research Judge Retry Plan (KI-JUDGE): the calls that came back with no usable answer (an error, a cut-off or unreadable answer) are asked
// once more, alone: an answered call is never sent again (it is billed per call). A refusal is not retried (the server already tried its
// fallback model); its searches keep the word rules' decision.
/*__KI_KITS__*/
const all = (n) => { try { return $(n).all(0).map(i => (i && i.json) || {}); } catch (e) { return []; } };
const reqs = all('Any Research Judge?').filter(r => r && !r.skip && r.ki_call === 'judge');
const ans = all('Run Research Judge');
const out = [];
reqs.forEach((q, i) => { const r = KIW.judgeParse(ans[i], q.keywords); if (!r.ok && !/declined/.test(r.why)) out.push({ ...q, is_retry: true, retry_reason: r.why }); });
return out.length ? out.map(j => ({ json: j })) : [{ json: { is_retry: false, skip: true } }];
