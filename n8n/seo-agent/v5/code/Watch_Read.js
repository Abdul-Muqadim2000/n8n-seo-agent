// G11 (2026-10-13): what each raw fetch of the daily watch says — HTTP status, a redirect that appeared, `noindex` (meta or header), the
// canonical, the title, and (for the re-checks) the meta description and the H1s; for `/robots.txt` the parsed rules and their fingerprint.
// The answers come back in the order of the plan, so item i belongs to target i (the HTTP node keeps the input order).
// A fetch that failed is reported as `ok: false` and is never treated as a change: a stored reading must not be lost to one timeout.
// robots.txt is read here as well, so whether it blocks a key page is decided while the parsed rules are still in memory (an item carries
// plain JSON through n8n: a function would not survive the hop).
/*__PAGE_WATCH__*/
const plan = $('Watch Plan').all().map(i => i.json).filter(p => !p.skip);
const res = $input.all().map(i => i.json);
const robotsBySite = {};
plan.forEach((p, i) => { if (p.kind === 'robots') robotsBySite[p.site_idx] = PW.robotsRead(res[i] || {}); });
return plan.map((p, i) => {
  const r = res[i] || {};
  const rb = robotsBySite[p.site_idx] || null;
  if (p.kind === 'robots') {
    const { blocks, ...plainRobots } = rb || { ok: false, status: 0, hash: '', error: 'no answer' };
    return { json: { site_idx: p.site_idx, site_id: p.site_id, domain: p.domain, url: p.url, kind: 'robots', weight: 0, site: p.site,
      robots: { ...plainRobots, rules: (plainRobots.rules || []).slice(0, 50) }, ok: !!(rb && rb.ok), status: rb ? rb.status : 0, error: rb ? rb.error : 'no answer' } };
  }
  const sig = PW.signals(r);
  const blocked = (rb && rb.ok && typeof rb.blocks === 'function') ? rb.blocks(p.url) : null;
  return { json: { site_idx: p.site_idx, site_id: p.site_id, domain: p.domain, url: p.url, kind: p.kind, weight: p.weight, site: p.site, prev: p.prev,
    robots_blocked: blocked, ...sig } };
});
