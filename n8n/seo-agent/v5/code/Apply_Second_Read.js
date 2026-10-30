/*__PAGE_FIX__*/
/*__CRITIC_REREAD__*/
/*__GRADE__*/
// W0-H (2026-10-29, page-quality PLAN Fix 3b; build section 158): what the blind second read found, on the delivered page. A high-severity
// problem whose quoted words are on the page and that is a factual error the page states (W05-A, wave 0.5: a count that does not match its
// list, an unsupported claim about the business, a statement its own source contradicts, a wrong or out-of-date fact or rule) is a soft
// blocker in enforce mode (runs a person started) and reported advice in shadow mode (runs the system started by itself, D17); every other
// problem it could show is advice that takes points off its part of the grade (GR.cap review, never the 59 cap); a
// refused, cut, failed or unreadable answer is "not checked", never a pass and never a block. The grade changes here only by the blocker
// cap and the advice deduction (GR.cap); the item goes on to Build Word File exactly as Page Candidates delivered it, with content_qa updated.
const it = $('Second Read Plan').first().json || {};
const plan = it.second_read && typeof it.second_read === 'object' ? it.second_read : { skip: true, reason: 'the second read was not planned' };
const resp = plan.skip ? {} : ($input.first().json || {});
const rr = RR.read(resp, String(it.output || ''), plan, PF);
const content_qa = RR.apply(it.content_qa || {}, rr, PF);
// W0-C (2026-10-29, page-quality PLAN Fix 3): a problem the second read made blocking is an open blocker like any other, so the grade takes
// the blocker cap again (GR.cap recomputes from the parts, so a grade already capped is never capped twice)
{ const D = content_qa.delivery;
  if (D && D.grade && typeof D.grade === 'object' && content_qa.grade_detail) {
    // W05-A (wave 0.5): what the read found that is not a factual error is advice and takes points off its part (enforce mode only)
    const g = GR.cap(D.grade, D.blocking || [], { w0c: content_qa.grade_detail, review: content_qa.critic_reread || null });
    content_qa.delivery = { ...D, grade: g };
    // the grade NUMBER only: the verdict fields (publishable, not_ready, label, reasons) are RR.apply's and are not touched here
    const Q = content_qa.quality; if (Q && typeof Q === 'object') Object.assign(content_qa, { quality: { ...Q, grade: g } }); } }
const out = { ...it, content_qa };
delete out.second_read;
return [{ json: out }];
