/*__OUTBOUND__*/
// A-14 (2026-10-17): one item per distinct outbound link of THIS round's draft (Content QA lists them all as `outbound_links`), for
// *Fetch Outbound Links*. With no outbound link the single item says so and *Any Outbound Links?* goes straight to the check, which
// then reports "no outbound link". Every item carries the QA round, so the check never reads an earlier round's fetch.
const d = $input.first().json || {};
const qa = d.content_qa || {};
const round = Number(d.qa_round || qa.round) || 1;
const reqs = OB.requests(qa.outbound_links || [], round);
if (!reqs.length) return [{ json: { skip: true, round } }];
return reqs.map(r => ({ json: r }));
