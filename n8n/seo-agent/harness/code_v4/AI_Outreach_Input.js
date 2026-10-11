// The AI-source outreach jobs per site (at most 3 a week) with the business facts on file, for the AI Outreach Writer.
const em = (() => { try { return $('Earned Media').all().map(i => i.json).filter(x => !x.skip); } catch (e) { return []; } })();
const plans = $('Growth Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const out = [];
for (const e of em) {
  if (!(e.outreach_jobs || []).length) continue;
  const p = plans.find(x => x.site_id === e.site_id) || {}; const P = p.profile || {};
  const facts = [['Business', e.business], ['Website', e.domain], ['Type', P.business_type], ['City', P.city], ['Region', P.region], ['Areas served', P.service_areas], ['Phone', P.phone], ['Public e-mail', P.public_email]]
    .filter(([, v]) => v).map(([k, v]) => k + ': ' + v).join('\n');
  out.push({ json: { site_id: e.site_id, domain: e.domain, business: e.business, facts: facts || 'Website: ' + e.domain, our_pages: (p.key_pages || []).filter(k => ['cited', 'content', 'ladder', 'target'].includes(k.kind)).slice(0, 4).map(k => k.url), jobs: e.outreach_jobs } });
}
return out.length ? out : [{ json: { skip: true } }];
