// RV-2 (2026-10-21, pre-launch run on techand.ai): the known URLs outside the crawl that answered a redirect are asked again with the redirects
// followed (*Fetch Not Crawled (Final)*), because where a redirect ends decides what the address is. On techand.ai the bare host 308s to www
// and www answers 404 for 34 old addresses; read at the first answer they were filed as "redirect somewhere else" (Low). One item per
// redirect, paired by position with the follow-up answers in *Not Crawled Check*; free, plain GETs of the site's own addresses.
let reqs = []; try { reqs = $('Not Crawled Targets').all().map(i => i.json || {}); } catch (e) {}
let res = []; try { res = $('Fetch Not Crawled').all().map(i => i.json || {}); } catch (e) {}
const targets = reqs.filter(r => r && r.url && !r.skip);
const hops = [];
targets.forEach((t, i) => { const r = res[i] || {}; const st = Number(r.statusCode != null ? r.statusCode : r.status) || 0;
  if (st >= 300 && st < 400) hops.push({ url: String(t.url), first_status: st }); });
return hops.length ? hops.map(h => ({ json: h })) : [{ json: { no_hops: true } }];
