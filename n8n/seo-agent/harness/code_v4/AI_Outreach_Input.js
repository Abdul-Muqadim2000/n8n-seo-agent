// The AI-source outreach jobs per site (at most 3 a week) with the business facts on file, for the AI Outreach Writer.
const em = (() => { try { return $('Earned Media').all().map(i => i.json).filter(x => !x.skip); } catch (e) { return []; } })();
const plans = $('Growth Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const out = [];
for (const e of em) {
  if (!(e.outreach_jobs || []).length) continue;
  const p = plans.find(x => x.site_id === e.site_id) || {}; const P = p.profile || {};
  // D12: the facts the writer may use — the name from the site model (never the domain label), what the business sells, and the accreditation
  // exactly as it stands on file ("none on file" is a fact too: nothing may be claimed).
  const facts = [['Business', e.business], ['Website', e.domain], ['Type', P.business_type], ['What it sells', (p.services || []).slice(0, 8).join(', ')], ['City', P.city], ['Region', P.region], ['Areas served', P.service_areas], ['Phone', P.phone], ['Public e-mail', P.public_email],
    ['Accreditation', p.accreditation || '']]   // nothing on file -> no line at all: the word in the facts would excuse a claim (the prompt forbids claiming one)
    .filter(([, v]) => v).map(([k, v]) => k + ': ' + v).join('\n');
  out.push({ json: { site_id: e.site_id, domain: e.domain, business: e.business, facts: facts || 'Website: ' + e.domain, our_pages: (p.key_pages || []).filter(k => ['cited', 'content', 'ladder', 'target'].includes(k.kind)).slice(0, 4).map(k => k.url), jobs: e.outreach_jobs } });
}
return out.length ? out : [{ json: { skip: true } }];
