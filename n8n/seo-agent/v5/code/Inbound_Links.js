/*__INBOUND__*/
// C12 (2026-10-22): the 3-5 live pages of the site to add a link to the new page from, each verified today (answered 200, not noindex,
// no link to the new page yet), with the section it fits under, a varied anchor and a ready sentence. The run's item (and its files) is
// passed on to the Blog Package with `inbound_links`, which puts them in meta.json, the publish checklist and the callback.
const src = $('Attach PDF Report').first(); const d = (src && src.json) || {};
let C = []; try { C = $('Inbound Candidates').all().map(i => i.json || {}); } catch (e) {}
const first = C[0] || {};
const out = (extra) => [{ json: { ...d, ...extra }, binary: (src && src.binary) || {} }];
if (!String(d.page_markdown || '').trim()) return out({});
if (!C.length || first.skip) {
  const t = first.target_in || {};
  return out({ inbound_links: { target_url: String(t.url || ''), picks: [], left_out: [], checked: 0, enough: false, basis: String(first.why || 'no page of the site could be checked'), checklist_line: '' } });
}
const R = $input.all();   // Fetch Inbound Pages answers in the order of the candidates
const fetched = C.map((c, i) => { const r = (R[i] && R[i].json) || {};
  const err = r.error ? String((r.error && r.error.message) || r.error) : '';
  return { url: (c.cand && c.cand.url) || c.url, status: r.statusCode != null ? Number(r.statusCode) : 0, html: String(r.body ?? r.data ?? ''), error: err }; });
const T = INB.target(first.target_in || {});
const res = INB.pick(C.map(c => c.cand).filter(Boolean), fetched, T, { min: 3, max: 5 });
return out({ inbound_links: { ...res, candidates: C.length, checked_on: new Date().toISOString().slice(0, 10), checklist_line: INB.checklist(res) } });
