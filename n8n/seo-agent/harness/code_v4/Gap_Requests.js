// Link gap (full runs): the domains that link to at least one competitor but not to you (backlinks/domain_intersection; the linking domain is the
// item's `target` field), one request per site.
// Competitors: configured, kept from earlier runs, or picked now from the Labs competitors (big platforms and the site itself excluded).
const API = 'https://api.dataforseo.com/v3/';
const plans = $('BL Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const reqs = $('BL Requests').all().map(i => i.json); let resps = []; try { resps = $('Run BL Requests').all().map(i => i.json || {}); } catch (e) {}   // not run on a free-sources-only check
const BIG = /(^|\.)(google|youtube|facebook|linkedin|wikipedia|amazon|apple|microsoft|reddit|quora|instagram|x|twitter|tiktok|medium|github|indeed|glassdoor|gov)\./i;
const out = [];
for (const p of plans) {
  let comps = [...p.competitors];
  if (!comps.length) { const i = reqs.findIndex(r => r.site_id === p.site_id && r.kind === 'competitors'); const items = i >= 0 ? (((resps[i].tasks || [])[0] || {}).result || [{}])[0]?.items || [] : [];
    comps = items.map(x => String(x.domain || '').replace(/^www\./, '')).filter(d => d && d !== p.domain && !BIG.test(d + '.') && !/\.gov(\.|$)/.test(d)).slice(0, 3); }
  if (p.mode !== 'full' || !p.gap_due || !comps.length || p.free_only) continue;   // quarterly (v4.6): between refreshes the stored gap prospects are shown
  const targets = {}; comps.forEach((c, i) => { targets[String(i + 1)] = c; });
  out.push({ json: { site_id: p.site_id, domain: p.domain, kind: 'gap', competitors: comps, endpoint: API + 'backlinks/domain_intersection/live', body: [{ targets, exclude_targets: [p.domain], intersection_mode: 'partial', limit: 100, order_by: ['1.rank,desc'] }] } });   // partial = links to at least one competitor (verified live 2026-10-02)
}
return out.length ? out : [{ json: { skip: true } }];
