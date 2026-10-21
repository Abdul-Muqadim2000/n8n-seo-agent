/*__SITE_MODEL__*/
/*__CLAIMS__*/
/*__PROMISE_JUDGE__*/
// CT-FIX2 (2026-10-22, live page exec 159): stage 1 of the promise check. The draft of this QA round (the Copywriter's, then each Editor
// round's) is read by the claims kit with its wide net: every sentence the rules judge, plus the ones near a commitment (a section about
// the business, a phase or service on file as the subject, "we / our", image captions), each with the closest facts on file. The request
// for the second reader (Claude Haiku, *Promise Judge*) is built here; Content QA applies the verdicts. The draft passes through untouched
// (Content QA reads it from this node).
const inItem = $input.first().json || {};
const prev = $('Parse Brief').first().json || {};
let SITE_MODEL = null; try { SITE_MODEL = $('Site Model').first().json.site_model || null; } catch (e) {}
const raw = typeof inItem.output === 'string' ? inItem.output : JSON.stringify(inItem.output || '');
// QA's own [Confirm: <sentence>] marks of the round before are sentences again here, so the judge reads them like any other
const md = raw.replace(/\[Confirm: ([^\[\]]{20,}?[.!])\]/g, '$1');
const OWN = PJ.ownText(prev, SITE_MODEL);
const domain = String(prev.domain || '');
const names = [...new Set([(prev.site_profile || {}).business_name, SITE_MODEL ? SM.name(SITE_MODEL) : '', ...((SITE_MODEL && Array.isArray(SITE_MODEL.brand_names)) ? SITE_MODEL.brand_names : []),
  (prev.site_description || {}).business_name, domain ? domain.split('.')[0] : ''].map(x => String(x || '').trim()).filter(x => x.length >= 3))];
let cands = [];
// at most PJ.MAX_CANDS a call: the rules' own flags first, then the sentences they judged as commitments, then the wide net (captions and
// "we recommend ..." with the latter); a candidate left out is decided by the rules in Content QA
const rank = (c) => (c.rule_flag ? 0 : (c.why === 'wide' || c.why === 'advice') ? (c.where === 'caption' || c.why === 'advice' ? 2 : 3) : 1);
try { cands = (CL.commitments(md, OWN, { names, collect: true, captions: PJ.captionsOf(prev.content_brief) }).candidates || []).map((c, i) => ({ c, i }))
  .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i).slice(0, PJ.MAX_CANDS).map(x => x.c); } catch (e) { cands = []; }
const skip = !cands.length || !OWN.trim();
const promise_judge = { key: PJ.keyOf(cands), candidates: cands.map(c => ({ sentence: c.sentence, why: c.why, rule_flag: c.rule_flag, where: c.where, facts: c.facts })), n: cands.length, skip,
  skip_reason: !OWN.trim() ? 'nothing on file to hold the sentences against' : !cands.length ? 'no sentence in the business\'s name to judge' : '',
  body: skip ? '' : JSON.stringify(PJ.request(cands, { business: names[0] || domain, domain })) };
return [{ json: { ...inItem, promise_judge } }];
