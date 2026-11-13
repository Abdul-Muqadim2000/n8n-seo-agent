// Research Judge Requests (KI-JUDGE 2026-11-12, fixes/JUDGE.md): every candidate the research kept (the soft-stopped ones too), each with
// its top 5 results, to Claude Opus 5.5 in calls of 40 searches. Off (ki_judge false) or nothing to judge -> skip: the word rules decide.
/*__KI_KITS__*/
const p = $('KI Plan').first().json || {};
const pic = $('Research Picture').first().json || {};
const sp = $('Research SERP Picture').first().json || {};
const kws = (pic.rows || []).map(r => r.keyword);
if (p.ki_judge === false) return [{ json: { skip: true, reason: 'the keyword judge is switched off for this run' } }];
if (!kws.length) return [{ json: { skip: true, reason: 'no search to judge' } }];
const site = { domain: p.domain, market: (p.country_name || p.market || '') + ' (Google, ' + (p.language_code || 'en') + ')', services: p.services || [], facts: p.business_facts || '' };
return KIW.judgeRequests(kws, sp.by || {}, site).map(j => ({ json: j }));
