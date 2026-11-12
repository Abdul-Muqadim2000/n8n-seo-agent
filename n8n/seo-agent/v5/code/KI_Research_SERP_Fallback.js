// Research SERP Fallback (QUEUE 2026-11-11): the results pages the queue did not return - still queued after the last round, refused, or
// never accepted - are read live ($0.002 each; their page addresses are approximate since Google's redirect change, so those searches are
// scored but not grouped). Nothing left -> skip.
/*__KI_KITS__*/
const all = (n) => { try { return $(n).all(0).map(i => (i && i.json) || {}); } catch (e) { return []; } };
const p = $('KI Plan').first().json || {};
const m = { location_code: p.location_code, language_code: p.language_code };
const posted = all('Any Research SERPs?').filter(r => r && !r.skip && r.ki_call === 'serp_post').map(r => KIW.normKw(r.keyword));
const ready = new Set();
for (let n = 1; n <= __ROUNDS__; n++) for (const x of KIW.collectRound(all('Wait For SERP Tasks (' + n + ')'), all('Get SERP Tasks (' + n + ')')).ready) ready.add(KIW.normKw(x.keyword));
const left = [...new Set(posted)].filter(k => k && !ready.has(k));
return left.length ? left.map(k => ({ json: { ...KIW.rq.serp(k, m), ki_source: 'live' } })) : [{ json: { skip: true, reason: 'every queued results page was collected' } }];
