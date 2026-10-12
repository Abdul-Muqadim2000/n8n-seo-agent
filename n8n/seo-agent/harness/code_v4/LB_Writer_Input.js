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
  // D13: the business name comes from the site model (LB Plan), never from the domain label; with no name on file the e-mails carry a bracket
  // the owner fills in, and the draft gate holds them until then.
  const business = p.brand_known ? p.brand : '[Confirm: the business name]';
  const facts = ['Business: ' + business + ' (' + p.domain + ')' + (pr.business_type ? ', ' + pr.business_type : ''), p.topics.length ? 'Topics: ' + p.topics.join(', ') : '',
    (p.services || []).length ? 'What it sells: ' + p.services.slice(0, 8).join(', ') : '',
    pr.city || pr.country_code ? 'Based in: ' + [pr.city, pr.region, pr.country_code].filter(Boolean).join(', ') : '',
    p.accreditation ? 'Accreditation on file: ' + p.accreditation : '',   // nothing on file -> the word does not appear here at all: the draft gate checks every claim against these facts, and the prompt forbids claiming one
    p.brand_known ? '' : 'The business name is not on file: write [Confirm: the business name], never the website address',
    p.competitors.length ? 'Competitors (never praise or attack them): ' + p.competitors.join(', ') : ''].filter(Boolean).join('\n');
  const signer = pr.author_name ? pr.author_name + (pr.author_job_title ? ', ' + pr.author_job_title : '') + ', ' + business : '[Your name], ' + business;
  out.push({ json: { site_id: s.site_id, domain: s.domain, business, facts, signer, home: p.home,
    jobs: s.jobs.map((j, i) => { const ck = parse(j.checks_json, {}) || {}; const c = (parse(j.contacts_json, []) || [])[0] || {};
      return { n: i + 1, prospect_domain: j.prospect_domain, type: j.type, angle: ck.angle === 'broken' || j.type === 'broken' ? 'broken' : j.type, page_url: j.page_url, page_title: j.page_title, evidence: j.evidence,
        dead: ck.dead || null, competitors_named: ck.competitors_named || [], contact: c.kind ? c.kind + (c.own ? ' on their site' : '') : 'contact form', to: c.email || '', deadline: j.deadline || '',
        target_url: j.target_url, target_title: titleOf(j.target_url), anchor_hint: j.anchor_hint }; }) } });
}
return out.length ? out : [{ json: { skip: true } }];
