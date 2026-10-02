// Up to 8 new prospects per site get an outreach draft (Claude, low effort): lost links first (ask to restore), then unlinked mentions
// (ask for the link), then link-gap and AI-source domains (pitch a page worth linking to). Prospects that already have a draft are skipped.
const sites = $('Parse Backlinks').all().map(i => i.json);
let existing = []; try { existing = $('Load Link Prospects').all().map(i => i.json).filter(x => x && x.prospect_domain); } catch (e) {}
const ORDER = { lost: 0, mention: 1, gap: 2, ai_source: 3 };
const jobs = [];
for (const s of sites) {
  const aiSources = existing.filter(x => x.site_id === s.site_id && x.type === 'ai_source' && !x.outreach_body && x.status === 'new').map(x => ({ prospect_domain: x.prospect_domain, type: 'ai_source', rank: Number(x.rank) || 0, detail: x.detail, source_url: '', target_url: '' }));
  const todo = [...s.candidates.filter(c => c.type !== 'reclaim'), ...aiSources]
    .filter(c => { const e = existing.find(x => x.site_id === s.site_id && x.prospect_domain === c.prospect_domain && x.type === c.type); return !e || (!e.outreach_body && (e.status || 'new') === 'new'); })
    .sort((a, b) => (ORDER[a.type] - ORDER[b.type]) || (b.rank - a.rank)).slice(0, 8);
  if (s.mode === 'full' && todo.length) jobs.push({ json: { site_id: s.site_id, domain: s.domain, business_name: s.business_name || s.domain, assets: s.assets, prospects: todo } });
}
return jobs.length ? jobs : [{ json: { skip: true } }];
