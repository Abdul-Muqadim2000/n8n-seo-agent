// Outreach drafts (Claude, low effort). Full runs: up to 8 new prospects per site, highest score first (value x likelihood: unlinked
// mentions and lost links convert far more often than cold gap sites; v4.10), plus the AI-source prospects without a draft. Every run:
// follow-ups for prospects marked "contacted" with no link yet — follow-up 1 after 7 days, follow-up 2 (the last) after 14 (one e-mail
// plus two follow-ups gets about twice the replies of a single e-mail; more than three does worse: Hunter 2026). Prospects that already
// have a draft are skipped.
const sites = $('Parse Backlinks').all().map(i => i.json);
let existing = []; try { existing = $('Load Link Prospects').all().map(i => i.json).filter(x => x && x.prospect_domain); } catch (e) {}
const days = (d) => d ? (Date.now() - new Date(d).getTime()) / 864e5 : -1;
const jobs = [];
for (const s of sites) {
  if (s.free_only) continue;   // free sources only: no Claude drafts (the prospects are still listed)
  const mine = existing.filter(x => x.site_id === s.site_id);
  const aiSources = mine.filter(x => x.type === 'ai_source' && !x.outreach_body && (x.status || 'new') === 'new').map(x => ({ prospect_domain: x.prospect_domain, type: 'ai_source', rank: Number(x.rank) || 0, score: Number(x.score) || 20, detail: x.detail, source_url: '', target_url: '' }));
  const fresh = s.mode === 'full' ? [...s.candidates.filter(c => c.type !== 'reclaim'), ...aiSources]
    .filter(c => { const e = mine.find(x => x.prospect_domain === c.prospect_domain && x.type === c.type); return !e || (!e.outreach_body && (e.status || 'new') === 'new'); })
    .filter((c, i, a) => a.findIndex(x => x.prospect_domain === c.prospect_domain) === i)
    .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0)).slice(0, 8) : [];
  const linking = new Set(s.refdomains || []);
  const follow = mine.filter(x => x.status === 'contacted' && x.contacted_at && !linking.has(x.prospect_domain) && x.outreach_body).map(x => {
    const step = Number(x.followup_step) || 0; const d = days(x.contacted_at);
    return (step === 0 && d >= 7) || (step === 1 && d >= 14) ? { prospect_domain: x.prospect_domain, type: 'followup', of_type: x.type, step: step + 1, rank: Number(x.rank) || 0, detail: x.detail, first_subject: x.outreach_subject, source_url: x.source_url || '', target_url: x.target_url || '' } : null; }).filter(Boolean).slice(0, 8);
  if (fresh.length || follow.length) jobs.push({ json: { site_id: s.site_id, domain: s.domain, business_name: s.business_name || s.domain, assets: s.assets, prospects: [...fresh, ...follow] } });
}
return jobs.length ? jobs : [{ json: { skip: true } }];
