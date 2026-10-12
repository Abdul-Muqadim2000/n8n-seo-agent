// The link-prospect pipeline (seo_link_prospects, upsert by site + prospect domain + type; exact columns): this run's candidates merged with
// the stored rows (status, notes and drafts kept), outreach drafts attached, and prospects that now link to you marked "won" automatically.
// v4.10: score (value x likelihood) and origin, the contact found on the prospect's site, follow-up drafts (1 + 2) for contacted prospects,
// and "won" only for a link the check found on the page (or that an index reports live this run) — verified_at says when.
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
let jobs = [], outs = []; try { jobs = $('Outreach Input').all().map(i => i.json).filter(j => !j.skip); outs = $('Outreach Writer').all().map(i => i.json); } catch (e) {}
const parse = (raw) => { if (raw && typeof raw === 'object') return raw; const s = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, ''); try { return JSON.parse(s); } catch (e) { const a = s.indexOf('{'), b = s.lastIndexOf('}'); try { return JSON.parse(s.slice(a, b + 1)); } catch (e2) { return null; } } };
const rows = [];
for (const s of sites) {
  const now = s.checked_at; const ji = jobs.findIndex(j => j.site_id === s.site_id);
  const drafts = ji >= 0 && outs[ji] && !outs[ji].error ? ((parse(outs[ji].output) || {}).drafts || []) : [];
  const contacts = new Map(ji >= 0 ? jobs[ji].prospects.filter(p => p.contact_email).map(p => [p.prospect_domain, p]) : []);
  const ledgerBy = new Map((s.ledger_rows || []).map(r => [r.ref_domain, r]));
  const linking = new Set(s.refdomains || []);
  const key = (x) => x.prospect_domain + '|' + x.type;
  const mine = new Map(existing.filter(x => x.site_id === s.site_id).map(x => [key(x), x]));
  const seen = new Set();
  const emit = (c, old) => {
    // P34-1 (live 2026-10-12): a stored draft written before the D12 / D13 gates is withdrawn, not carried into the new row with its
    // old subject (run 476 re-wrote mof.gov.ae and uae-asp.ae as gap prospects with "A resource suggestion for your readers").
    const kept = DRAFTS.carry(old, { handover: !!s.link_builder });
    const d = drafts.find(x => String(x.prospect_domain || '').toLowerCase() === c.prospect_domain && !(Number(x.followup) > 0) && !kept.outreach_body);
    const f = drafts.find(x => String(x.prospect_domain || '').toLowerCase() === c.prospect_domain && Number(x.followup) > 0 && old.status === 'contacted' && Number(x.followup) === (Number(old.followup_step) || 0) + 1);
    const lr = ledgerBy.get(c.prospect_domain); const won = c.type !== 'reclaim' && linking.has(c.prospect_domain) && (old.status || 'new') !== 'won';
    const ct = contacts.get(c.prospect_domain) || {};
    rows.push({ site_id: s.site_id, domain: s.domain, prospect_domain: c.prospect_domain, type: c.type, rank: Number(c.rank ?? old.rank) || 0, spam_score: Number(c.spam_score ?? old.spam_score) || 0, detail: String(c.detail || old.detail || '').slice(0, 300),
      source_url: c.source_url || old.source_url || '', target_url: c.target_url || old.target_url || '', status: won ? 'won' : (old.status || 'new'), first_seen: old.first_seen || now, last_seen: c.fresh ? now : (old.last_seen || now),
      won_at: won ? now : (old.won_at || ''), outreach_subject: kept.outreach_subject || (d ? String(d.subject || '').slice(0, 120) : ''), outreach_body: kept.outreach_body || (d ? String(d.body || '').slice(0, 1500) : ''),
      drafted_at: d ? now : kept.drafted_at, note: kept.superseded ? DRAFTS.reason.slice(0, 300) : (old.note || ''),
      score: Number(c.score ?? old.score) || 0, origin: c.origin || old.origin || '', contact_email: old.contact_email || ct.contact_email || '', contact_url: old.contact_url || ct.contact_url || '', contacted_at: old.contacted_at || '',
      followup_step: f ? Number(f.followup) : (Number(old.followup_step) || 0), followup_subject: f ? String(f.subject || '').slice(0, 120) : (old.followup_subject || ''), followup_body: f ? String(f.body || '').slice(0, 1200) : (old.followup_body || ''),
      verified_at: won && lr && lr.verify === 'found' ? now : (old.verified_at || '') }); };
  for (const c of s.candidates) { const k = key(c); if (seen.has(k)) continue; seen.add(k); emit({ ...c, fresh: true }, mine.get(k) || {}); }
  // stored prospects not seen this run: only touched when they now link (won), or a draft / follow-up / contact was written for them
  for (const [k, old] of mine) { if (seen.has(k)) continue; const won = old.type !== 'reclaim' && linking.has(old.prospect_domain) && old.status !== 'won';
    const d = drafts.some(x => String(x.prospect_domain || '').toLowerCase() === old.prospect_domain && (Number(x.followup) > 0 ? old.status === 'contacted' : !old.outreach_body));
    if (won || d || DRAFTS.superseded(old) || (contacts.has(old.prospect_domain) && !old.contact_email)) { seen.add(k); emit({ prospect_domain: old.prospect_domain, type: old.type }, old); } }   // P34-1: a superseded draft is cleared even when the prospect was not seen again
}
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];
