/*__FIT_GATE__*/
/*__LADDER_RULES__*/
/*__AI_QUESTION__*/
// client report 2026-11-17 (CR17 Q3, build section 197): a page that goes live settles the AI questions it answers at once ($0). The AI visibility
// page said "a page is planned" for devaicon.com's question 37 for days after its ladder's main page went live, because questions were judged
// only in the weekly cycle. Runs beside "I published a page" (*Publish Check*, main workflow) and the Site Tracker's publish detection
// (*Detect Published*): the content-log rows those nodes just recorded live (each proved by a fetch of the page or the site's own sitemap), the
// website's stored questions, and AQ.settleOnPublish (the run's own question, or a question the page answers by LRU.questionPage). The weekly
// settle (AI Growth) keeps the same answer (AQ.answeredBy). A run that recorded nothing live settles nothing.
const itemsOf = (get) => { try { return get().all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const now = new Date().toISOString();
// the rows proved live: Publish Check's own row when it recorded the page (recorded_live: the fetch answered and the page is the draft), or every
// row Detect Published recorded (an answer of 200, or the site's sitemap declaring the page)
const pc = itemsOf(() => $('Publish Check'))[0] || null;
const detected = itemsOf(() => $('Detect Published'));
const rows = pc ? (pc.recorded_live === true && pc.log_row && pc.log_row.published_url ? [pc.log_row] : [])
  : detected.flatMap(d => Array.isArray(d.log_rows) ? d.log_rows : []);
const targets = itemsOf(() => $('Load AI Targets (Publish)')).filter(t => t.target_id);
const markets = new Map(itemsOf(() => $('Load Sites')).map(r => [String(r.domain || '').toLowerCase().replace(/^www\./, ''), String(r.country || '')]));
const marketOf = (dom) => markets.get(String(dom || '').toLowerCase().replace(/^www\./, '')) || (pc ? String(pc.country || '') : '');
const out = [];
for (const dom of [...new Set(rows.map(r => String(r.domain || '').toLowerCase().replace(/^www\./, '')))]) {
  const mine = rows.filter(r => String(r.domain || '').toLowerCase().replace(/^www\./, '') === dom);
  for (const u of AQ.settleOnPublish(mine, targets, { market: marketOf(dom), now })) out.push({ json: u });
}
return out.length ? out : [{ json: { skip: true } }];
