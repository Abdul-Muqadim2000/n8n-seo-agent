// Sites that need questions but have no topics and no business name on file (e.g. an ad-hoc check of a new domain): the homepage is read
// (Jina Reader) so the Prompt Writer knows what the business sells.
// G6 (2026-10-18): when a panel grows by 20 questions or more, the homepages of up to three of its declared competitors are read too
// (kind `competitor`): what they say they sell gives the writer topic ideas for clusters the site's own pages do not name. Never their names.
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const out = [];
for (const p of plans) {
  if (p.need_site_text) out.push({ json: { site_id: p.site_id, domain: p.domain, kind: 'own' } });
  if (p.need_prompts && (Number(p.prompts_needed) || 0) >= 20) for (const c of (p.configured_competitors || p.competitors || []).filter(d => /\./.test(d) && d !== p.domain).slice(0, 3)) out.push({ json: { site_id: p.site_id, domain: c, kind: 'competitor' } });
}
return out.length ? out : [{ json: { skip: true } }];
