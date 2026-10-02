// Sites that need questions but have no topics and no business name on file (e.g. an ad-hoc check of a new domain): the homepage is read
// (Jina Reader) so the Prompt Writer knows what the business sells.
const jobs = $('AI Plan').all().map(i => i.json).filter(p => p.need_site_text && !p.nothing_to_do);
return jobs.length ? jobs.map(p => ({ json: { site_id: p.site_id, domain: p.domain } })) : [{ json: { skip: true } }];
