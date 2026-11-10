// Research SERP Tasks (QUEUE 2026-11-11): the results pages posted to the normal-priority queue, one collection item per task created
// (task id + keyword); the free task_get reads them after a minute. Nothing posted (every page read today, or only the Ads volume asked)
// -> skip: the fallback finds nothing to read live and the picture is built from the cache.
/*__KI_KITS__*/
const all = (n) => { try { return $(n).all(0).map(i => (i && i.json) || {}); } catch (e) { return []; } };
const reqs = all('Any Research SERPs?').filter(r => r && !r.skip && r.ki_call);
const pr = KIW.paired(reqs, all('Run Research SERPs Answers'));
const items = [];
for (const x of pr) { if (x.q.ki_call !== 'serp_post' || !x.ok) continue; const t = KIW.task0(x.a); if (!t.id) continue;
  items.push(KIW.taskGet(t.id, x.q.keyword, 1)); }
return items.length ? items.map(j => ({ json: j })) : [{ json: { skip: true, reason: 'no results page was sent to the queue' } }];
