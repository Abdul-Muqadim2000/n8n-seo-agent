// One writer job per site with this week's best ready prospects: what the e-mails may say (business profile facts, our page and its title,
// the link text to ask for) and what each one is about (their page, the evidence to quote, the angle, the contact, the deadline).
const sites = $('LB Assemble').all().map(i => i.json).filter(s => !s.skip);
const plans = $('LB Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const parse = (t, d) => { try { return JSON.parse(t || ''); } catch (e) { return d; } };
const out = [];
for (const s of sites) {
  if (!s.jobs.length) continue;
  const p = plans.find(x => x.site_id === s.site_id) || {}; const pr = p.profile || {};
  const titleOf = (u) => ((p.pages || []).find(x => String(x.url).replace(/\/+$/, '') === String(u || '').replace(/\/+$/, '')) || {}).title || '';
  const facts = ['Business: ' + (pr.business_name || p.brand) + ' (' + p.domain + ')' + (pr.business_type ? ', ' + pr.business_type : ''), p.topics.length ? 'Topics: ' + p.topics.join(', ') : '',
    pr.city || pr.country_code ? 'Based in: ' + [pr.city, pr.region, pr.country_code].filter(Boolean).join(', ') : '', p.competitors.length ? 'Competitors (never praise or attack them): ' + p.competitors.join(', ') : ''].filter(Boolean).join('\n');
  const signer = pr.author_name ? pr.author_name + (pr.author_job_title ? ', ' + pr.author_job_title : '') + ', ' + (pr.business_name || p.brand) : '[Your name], ' + (pr.business_name || p.brand);
  out.push({ json: { site_id: s.site_id, domain: s.domain, business: pr.business_name || p.brand, facts, signer, home: p.home,
    jobs: s.jobs.map((j, i) => { const ck = parse(j.checks_json, {}) || {}; const c = (parse(j.contacts_json, []) || [])[0] || {};
      return { n: i + 1, prospect_domain: j.prospect_domain, type: j.type, angle: ck.angle === 'broken' || j.type === 'broken' ? 'broken' : j.type, page_url: j.page_url, page_title: j.page_title, evidence: j.evidence,
        dead: ck.dead || null, competitors_named: ck.competitors_named || [], contact: c.kind ? c.kind + (c.own ? ' on their site' : '') : 'contact form', deadline: j.deadline || '',
        target_url: j.target_url, target_title: titleOf(j.target_url), anchor_hint: j.anchor_hint }; }) } });
}
return out.length ? out : [{ json: { skip: true } }];
