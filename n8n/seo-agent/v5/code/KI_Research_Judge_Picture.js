// Research Judge Picture (KI-JUDGE): one label per search from the first answer that gave it (the call, then its one retry), the searches
// left unjudged (they keep the word rules' decision, and the run says how many), and the Claude cost the answers' own token counts measured.
/*__KI_KITS__*/
const all = (n) => { try { return $(n).all(0).map(i => (i && i.json) || {}); } catch (e) { return []; } };
const reqs = all('Any Research Judge?').filter(r => r && !r.skip && r.ki_call === 'judge');
const skipped = all('Any Research Judge?').find(r => r && r.skip);
const ans = all('Run Research Judge');
const rq = all('Any Research Judge Retries?').filter(r => r && r.is_retry);
const ra = all('Run Research Judge (Retry)');
const labels = {}; const usages = []; let failedCalls = 0; const whys = [];
reqs.forEach((q, i) => { const r = KIW.judgeParse(ans[i], q.keywords); if (r.usage) usages.push(r.usage); if (r.ok) Object.assign(labels, r.labels); else { failedCalls++; whys.push(r.why); } });
rq.forEach((q, i) => { const r = KIW.judgeParse(ra[i], q.keywords); if (r.usage) usages.push(r.usage); if (r.ok) { failedCalls--; for (const [k, v] of Object.entries(r.labels)) if (!labels[k]) labels[k] = v; } });
const asked = reqs.reduce((n, q) => n + (q.keywords || []).length, 0);
const judged = Object.keys(labels).length;
const counts = {}; for (const v of Object.values(labels)) counts[v] = (counts[v] || 0) + 1;
const section = !reqs.length ? { key: 'judge', state: 'skipped', reason: skipped ? skipped.reason : 'no search to judge', rows: 0 }
  : { key: 'judge', state: judged >= asked ? 'ok' : (judged ? 'partial' : 'missing'), rows: judged,
      reason: judged >= asked ? '' : (asked - judged) + ' of ' + asked + ' searches could not be judged (' + ([...new Set(whys)].join('; ') || 'no answer') + '): the word rules decided them' };
return [{ json: { labels, judged, asked, counts, failed_calls: Math.max(0, failedCalls), sections: [section], ai_cost: KIW.judgeCost(usages) } }];
