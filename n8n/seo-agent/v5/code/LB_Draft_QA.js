// The draft gate (L2, system review 2026-10-11): every sequence the Outreach Sequence Writer wrote is checked here before the app may offer
// it for approval — the claims against the facts on file (wrapped for the owner), nothing left in brackets, the address on the prospect's own
// domain, a real quote from their page, one link to the page we chose on our canonical host, the length and one clear ask, the words we never
// use, and the business name as the site model has it (DQ, v5/code/_draft_qa.js). A draft that fails is held ("needs_edit") with its reasons:
// the owner edits it in the app, automatic mode skips it, and nothing is sent. The steps carry the waits in working days (follow-ups after 4
// and 8; a journalist request — on Bluesky or from a digest — gets one follow-up after 3).
// L7 (2026-10-13): the writer gives every sequence a second subject in the other style; it is kept only when it passes the same
// checks (length, nothing left in brackets, none of the words we never use, not a copy of the first). LB Rows then gives half the
// batch each subject, so the app can read the reply rate per style.
/*__LINK_KIT__*/
/*__OUTREACH_KIT__*/
/*__CLAIMS__*/
/*__DRAFT_QA__*/
/*__AB__*/
const plans = $('LB Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
let inputs = [], outs = [];
try { inputs = $('LB Writer Input').all().map(i => i.json).filter(j => !j.skip); outs = $('Outreach Sequence Writer').all().map(i => i.json); } catch (e) {}
const parse = (raw) => { if (raw && typeof raw === 'object') return raw; const s = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  try { return JSON.parse(s); } catch (e) { const a = s.indexOf('{'), b = s.lastIndexOf('}'); try { return JSON.parse(s.slice(a, b + 1)); } catch (e2) { return null; } } };
const clean = (t, n) => String(t || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);
const out = [];
inputs.forEach((job, i) => {
  const p = plans.find(x => x.site_id === job.site_id) || {};
  const o = outs[i] || {}; const res = o && !o.error ? (parse(o.output) || {}) : {};
  const verdicts = [];
  for (const sq of (res.sequences || [])) {
    const j = (job.jobs || []).find(x => x.n === Number(sq.n)); if (!j) continue;
    const press = ['press', 'digest'].includes(j.type);
    const raw = (sq.steps || []).filter(x => clean(x.body, 10)).sort((a, b) => Number(a.step) - Number(b.step)).slice(0, press ? 2 : 3);
    if (!raw.length) { verdicts.push({ n: j.n, prospect_domain: j.prospect_domain, type: j.type, ok: false, held: ['no e-mail was written'], notes: [], steps: [] }); continue; }
    const v = DQ.check({ type: j.type, steps: raw.map((x, k) => ({ step: k, subject: k === 0 ? clean(x.subject, 90) : '', body: clean(x.body, k === 0 ? 2200 : 900) })),
      to: j.to || '', prospect_domain: j.prospect_domain, page_url: j.page_url, page_title: j.page_title, evidence: j.evidence, dead: j.dead },
      { facts: job.facts, signer: job.signer, brand: p.brand || job.business, brand_known: !!p.brand_known, domain: p.domain || job.domain, canonical_host: p.canonical_host || p.domain || job.domain,
        target_url: j.target_url, competitors: p.competitors || [], serp_rivals: p.serp_rivals || [], accredited: OK.accredited(p.accreditation) });   // R21: the last gate sees the SERP rivals too
    const waits = press ? [0, 3] : [0, 4, 8];
    const alt = press ? '' : clean(sq.subject_b, 90);   // a journalist answer keeps "Re: " + their request: there is nothing to test there
    const altWhy = press ? '' : AB.altOk(alt, v.steps[0] ? v.steps[0].subject : '');
    verdicts.push({ n: j.n, prospect_domain: j.prospect_domain, type: j.type, ok: v.ok, held: v.held, notes: altWhy ? [...v.notes, altWhy] : v.notes,
      subject_alt: altWhy ? '' : alt,
      steps: v.steps.map((x, k) => ({ step: k, wait_days: waits[k], subject: k === 0 ? x.subject : '', body: x.body })) });
  }
  const writer_skip = (res.skip || []).map(sk => { const j = (job.jobs || []).find(x => x.n === Number(sk.n)); return j ? { n: j.n, prospect_domain: j.prospect_domain, type: j.type, reason: clean(sk.reason, 200) } : null; }).filter(Boolean);
  out.push({ json: { site_id: job.site_id, domain: job.domain, verdicts, writer_skip, checked: verdicts.length, held: verdicts.filter(v => !v.ok).length,
    writer_error: o && o.error ? String(o.error.message || o.error).slice(0, 200) : '' } });
});
return out.length ? out : [{ json: { skip: true } }];
