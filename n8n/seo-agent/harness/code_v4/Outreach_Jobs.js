// Outreach drafts (Claude, low effort). Full runs: up to 8 new prospects per site, highest score first (value x likelihood: unlinked
// mentions and lost links convert far more often than cold gap sites; v4.10), plus the AI-source prospects without a draft. Every run:
// follow-ups for prospects marked "contacted" with no link yet — follow-up 1 after 7 days, follow-up 2 (the last) after 14 (one e-mail
// plus two follow-ups gets about twice the replies of a single e-mail; more than three does worse: Hunter 2026). Prospects that already
// have a draft are skipped.
// ---- which stored outreach draft may still be offered (P34-1, live 2026-10-12; inlined by build_monitors.py) ----
// AI Growth's report said "8 outreach draft(s) written" and printed a pitch to tax.gov.ae opening "I work at techand.ai" — a draft
// written on 2026-10-02, before the D12 / D13 gates (no government portals, no competitors, no bare homepages, the business name from
// the site model, a quote from their own page). Nothing had written it this week: the counter read the stored prospect row.
// Every writer now stamps `drafted_at` on the row it drafts for. A stored draft with no stamp, or one from before the gates, is
// **superseded**: the row is cleared, the draft is never counted as this week's work and never offered to the owner. The same is true
// when a site hands drafting over to the Link Builder (one writer). The web app applies the identical rule to the rows already in the
// table (`app/shared/src/outreach.ts`: DRAFT_GATES_AT / prospectDraft).
const DRAFTS = (() => {
  const GATES_AT = '2026-10-12';   // the day the D12 / D13 gates were deployed; a draft written before them is not offered again
  const S = (v) => String(v == null ? '' : v).trim();
  const reason = 'the draft written for them earlier was withdrawn: it was written before the current outreach rules (no government portals, no competitors, no bare homepages, the business name from the site model)';
  const handedOver = 'the Link Builder writes to them (one writer): approve the pitch on the Link building page';
  // a draft that was sent is part of the record (and the follow-ups quote it): it is never withdrawn, whenever it was written
  const sent = (row) => { const r = row || {}; return !!S(r.contacted_at) || ['contacted', 'won'].includes(S(r.status).toLowerCase()); };
  const superseded = (row) => { const r = row || {}; if (!S(r.outreach_body) || sent(r)) return false; const at = S(r.drafted_at).slice(0, 10); return !at || at < GATES_AT; };
  // what this run keeps of a stored row's draft: the draft while it is still valid, else nothing (and `superseded` says why the note changes)
  const carry = (row, o) => { const r = row || {}; const x = o || {}; const had = !!S(r.outreach_body);
    if (x.handover && !sent(r)) return { outreach_subject: '', outreach_body: '', drafted_at: '', superseded: had, reason: handedOver };
    if (superseded(r)) return { outreach_subject: '', outreach_body: '', drafted_at: '', superseded: true, reason };
    return { outreach_subject: S(r.outreach_subject), outreach_body: S(r.outreach_body), drafted_at: S(r.drafted_at), superseded: false, reason: '' }; };
  // a draft this run wrote: stamped, so the next run knows it is current
  const fresh = (d, at) => ({ outreach_subject: S((d || {}).subject).slice(0, 200), outreach_body: S((d || {}).body).slice(0, 3000), drafted_at: S(at), superseded: false, reason: '' });
  return { GATES_AT, superseded, sent, carry, fresh, reason, handedOver };
})();
const sites = $('Parse Backlinks').all().map(i => i.json);
let existing = []; try { existing = $('Load Link Prospects').all().map(i => i.json).filter(x => x && x.prospect_domain); } catch (e) {}
const days = (d) => d ? (Date.now() - new Date(d).getTime()) / 864e5 : -1;
const jobs = [];
for (const s of sites) {
  if (s.free_only) continue;   // free sources only: no Claude drafts (the prospects are still listed)
  if (s.link_builder) continue;   // v4.13: the Link Builder qualifies, picks our page and drafts the whole sequence (one writer)
  const mine = existing.filter(x => x.site_id === s.site_id);
  const noDraft = (x) => !x.outreach_body || DRAFTS.superseded(x);   // P34-1: a draft withdrawn as superseded may be written again, properly, this run
  const aiSources = mine.filter(x => x.type === 'ai_source' && noDraft(x) && (x.status || 'new') === 'new').map(x => ({ prospect_domain: x.prospect_domain, type: 'ai_source', rank: Number(x.rank) || 0, score: Number(x.score) || 20, detail: x.detail, source_url: '', target_url: '' }));
  const fresh = s.mode === 'full' ? [...s.candidates.filter(c => c.type !== 'reclaim'), ...aiSources]
    .filter(c => { const e = mine.find(x => x.prospect_domain === c.prospect_domain && x.type === c.type); return !e || (noDraft(e) && (e.status || 'new') === 'new'); })
    .filter((c, i, a) => a.findIndex(x => x.prospect_domain === c.prospect_domain) === i)
    .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0)).slice(0, 8) : [];
  const linking = new Set(s.refdomains || []);
  const follow = mine.filter(x => x.status === 'contacted' && x.contacted_at && !linking.has(x.prospect_domain) && x.outreach_body).map(x => {
    const step = Number(x.followup_step) || 0; const d = days(x.contacted_at);
    return (step === 0 && d >= 7) || (step === 1 && d >= 14) ? { prospect_domain: x.prospect_domain, type: 'followup', of_type: x.type, step: step + 1, rank: Number(x.rank) || 0, detail: x.detail, first_subject: x.outreach_subject, source_url: x.source_url || '', target_url: x.target_url || '' } : null; }).filter(Boolean).slice(0, 8);
  if (fresh.length || follow.length) jobs.push({ json: { site_id: s.site_id, domain: s.domain, business_name: s.business_name || s.domain, assets: s.assets, prospects: [...fresh, ...follow] } });
}
return jobs.length ? jobs : [{ json: { skip: true } }];
