// ---- JOBT: a placeholder author job title is no job title (F-29, production review 2026-11-12; build section 189) ----
// An author job title of "User" was accepted and printed on every byline ("Name, User"), in the Person schema and in the author box. The
// web app now refuses such a title; profile rows stored before that still carry it, so every engine node that PRINTS a job title reads it
// through JOBT.real: a placeholder is '' (the line is left out), never printed. The placeholders are only these words, whole, case and
// spacing aside: "User", "N/A", "-", "none", "test", "job title", "title" ("Owner", "Administrator", "Tester" are real titles). The content
// readiness rule (_readiness.js, word for word app/shared/src/readiness.ts) is not changed. Inlined by build_v4.py / build_monitors.py
// (marker JOB_TITLE in a block comment). Pure.
const JOBT = (() => {
  const LIST = ['user', 'n/a', '-', 'none', 'test', 'job title', 'title'];
  const SET = new Set(LIST);
  const norm = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().toLowerCase();
  /** true for a job title that is not one; an empty title is missing, not a placeholder */
  const isPlaceholder = (v) => SET.has(norm(v));
  /** the job title to print: '' for a placeholder, else the title with its spacing collapsed */
  const real = (v) => (isPlaceholder(v) ? '' : String(v == null ? '' : v).replace(/\s+/g, ' ').trim());
  return { isPlaceholder, real, LIST };
})();
// One writer job per site with this week's best ready prospects: what the e-mails may say (business profile facts, our page and its title,
// the link text to ask for) and what each one is about (their page, the evidence to quote, the angle, the contact, the deadline).
const sites = $('LB Assemble').all().map(i => i.json).filter(s => !s.skip);
const plans = $('LB Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const parse = (t, d) => { try { return JSON.parse(t || ''); } catch (e) { return d; } };
const out = [];
for (const s of sites) {
  if (!s.jobs.length) continue;
  const p = plans.find(x => x.site_id === s.site_id) || {}; const pr = p.profile || {};
  // R93 (2026-10-16): the page's own title, matched host-agnostically (the stored pitch rows mix www and the bare host). A page whose title
  // is not on record is offered with the brand as link text — never a keyword (LB Plan no longer puts a search query in `title`).
  const pk = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const titleOf = (u) => ((p.pages || []).find(x => pk(x.url) === pk(u)) || {}).title || '';
  // D13: the business name comes from the site model (LB Plan), never from the domain label; with no name on file the e-mails carry a bracket
  // the owner fills in, and the draft gate holds them until then.
  const business = p.brand_known ? p.brand : '[Confirm: the business name]';
  const facts = ['Business: ' + business + ' (' + p.domain + ')' + (pr.business_type ? ', ' + pr.business_type : ''), p.topics.length ? 'Topics: ' + p.topics.join(', ') : '',
    (p.services || []).length ? 'What it sells: ' + p.services.slice(0, 8).join(', ') : '',
    pr.city || pr.country_code ? 'Based in: ' + [pr.city, pr.region, pr.country_code].filter(Boolean).join(', ') : '',
    p.accreditation ? 'Accreditation on file: ' + p.accreditation : '',   // nothing on file -> the word does not appear here at all: the draft gate checks every claim against these facts, and the prompt forbids claiming one
    p.brand_known ? '' : 'The business name is not on file: write [Confirm: the business name], never the website address',
    p.competitors.length ? 'Competitors (never praise or attack them): ' + p.competitors.join(', ') : ''].filter(Boolean).join('\n');
  // CR17-E (client report 2026-11-17, build section 195): the pitch is signed by a PERSON. Live, devaicon's drafts were signed "Devaicon,
  // User, Devaicon" (the profile's author name was the company, its job title a placeholder) and techand's "Tech& Technical Team": a name
  // that is the business, the domain or a team / department is not a person, so the draft carries [Your name] for the client to fill in
  // (the draft gate holds a bracket until it is edited) and the title rides only with a real person.
  const nrm = (x) => String(x || '').toLowerCase().replace(/&amp;/g, '&').replace(/[^a-z0-9&]+/g, ' ').trim();
  const person = (() => { const a = String(pr.author_name || '').trim(); if (!a) return '';
    let rest = ' ' + nrm(a) + ' '; for (const b of [p.brand_known ? p.brand : '', p.domain, String(p.domain || '').split('.')[0]]) { const nb = nrm(b); if (nb) rest = rest.split(' ' + nb + ' ').join(' '); }
    rest = rest.replace(/\b(team|teams|technical|tech|support|sales|marketing|admin|administrator|staff|company|group|office|department|dept|editorial|content|the|and|of|ltd|llc|inc|fze|fzco|fz|llp|pvt|private|limited|co|corp|user|owner|info|contact)\b/g, ' ').trim();
    return rest && nrm(a) !== nrm(business) ? a : ''; })();
  const signer = person ? person + (JOBT.real(pr.author_job_title) ? ', ' + JOBT.real(pr.author_job_title) : '') + ', ' + business : '[Your name], ' + business;
  out.push({ json: { site_id: s.site_id, domain: s.domain, business, facts, signer, home: p.home,
    jobs: s.jobs.map((j, i) => { const ck = parse(j.checks_json, {}) || {}; const c = (parse(j.contacts_json, []) || [])[0] || {};
      return { n: i + 1, prospect_domain: j.prospect_domain, type: j.type, angle: ck.angle === 'broken' || j.type === 'broken' ? 'broken' : j.type, page_url: j.page_url, page_title: j.page_title, evidence: j.evidence,
        dead: ck.dead || null, competitors_named: ck.competitors_named || [], contact: c.kind ? c.kind + (c.own ? ' on their site' : '') : 'contact form', to: c.email || '', deadline: j.deadline || '',
        target_url: j.target_url, target_title: titleOf(j.target_url), anchor_hint: (j.anchor_hint === 'title' && !titleOf(j.target_url)) ? 'brand' : j.anchor_hint,
        // CR17-E (195): the link text itself (LB Assemble's OK.anchorText; a row stored before it had none: the business name, or the bare address)
        anchor_text: String(j.anchor_text || '') || (j.anchor_hint === 'as before' ? '' : (p.brand_known ? p.brand : String(j.target_url || p.home || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, ''))) }; }) } });
}
return out.length ? out : [{ json: { skip: true } }];
