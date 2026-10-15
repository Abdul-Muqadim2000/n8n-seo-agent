// B9-3 (2026-10-15, benchmark area 9): the site's robots.txt, once per run, before anything is scored or submitted.
// AI readiness used to be measured with a browser User-Agent and nothing else, so a page robots.txt forbids every AI search
// fetcher to read could still be reported as "AI can read and quote this page, 90/100" — a score whose inputs were never checked.
// One free GET per site (retried by the shared rule); what it cannot read is reported as not checked, never as allowed.
/*__SITE_MODEL__*/
const plans = $('Growth Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const out = plans.map(p => ({ json: { site_id: p.site_id, domain: p.domain, site_host: p.site_host, url: SM.siteUrl({ canonical_host: p.site_host, domain: p.domain }, '/robots.txt') } }));
return out.length ? out : [{ json: { skip: true } }];
