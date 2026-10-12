// Answer Analyst jobs (v4.9, weekly and on-demand runs): Claude reads the answers that matter — every answer naming the business, the brand question,
// and the recommendation / comparison answers — and returns per answer the businesses named in order (with their website when known), how the
// answer speaks of the business (sentiment) and any claim about it that contradicts the business profile (wrong city, services, prices, a
// different company with the same name). Regex matching cannot see a competitor named without its website, or a wrong fact; this can.
// 12 answers per job, at most 6 jobs per site and 24 per run (~$0.02 each; the agent runs them one after another, so the cap keeps a
// many-site run inside the execution time limit — sites past it keep the parser's reading this week).
const CONFIG = { per_job: 12, max_jobs_per_site: 6, max_jobs_per_run: 24, chars: 1500, min_facts: 2 };   // min_facts (G10): fewer checkable facts than this and the wrong-claim check is reported as "not checked"
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do && !p.pulse_run);
let rows = []; try { rows = $('Parse AI Answers').all().map(i => i.json).filter(r => !r.skip && r.engine && r.answered && r._text); } catch (e) {}
const out = [];
for (const p of plans) {
  const mine = rows.filter(r => r.site_id === p.site_id);
  const pick = [...mine.filter(r => r.mentioned || r.kind === 'brand'), ...mine.filter(r => !r.mentioned && r.kind !== 'brand' && ['recommend', 'compare', 'choose', 'custom'].includes(r.kind))];
  const sel = pick.slice(0, CONFIG.per_job * CONFIG.max_jobs_per_site);
  const P = p.profile || {};
  // G10 (2026-10-11 system review): the fact sheet the analyst checks the answers against — the business profile (seo_profiles), the
  // facts and services of the site model (SITE_MODEL_SPEC.md) and the accreditation status. A claim can only be called wrong against a
  // fact on file, so a sheet with fewer than CONFIG.min_facts checkable facts switches the check OFF: the run then reports "not
  // checked" instead of "no wrong claims" (the website alone says nothing about a city, a service or a price).
  const sheet = [['Business name', p.business_name], ['Website', p.domain], ['Type', p.business_type], ['City', P.city], ['Region', P.region], ['Country', p.country], ['Address', P.street_address], ['Phone', P.phone], ['E-mail', P.public_email],
    ['Price range', P.price_range], ['Areas served', P.service_areas], ['Opening hours', P.opening_hours], ['Services on the site', (p.services || []).join(', ')], ['Topics', (p.topics || []).join(', ')],
    ['Accreditation', p.accreditation], ['Other facts', String(p.business_facts || '').slice(0, 900)], ['Other names', (p.brand_names || []).filter(b => !/\./.test(b)).join(', ')]].filter(([, v]) => v);
  const CHECKABLE = ['City', 'Region', 'Country', 'Address', 'Phone', 'E-mail', 'Price range', 'Areas served', 'Opening hours', 'Services on the site', 'Accreditation', 'Other facts', 'Type'];
  // P34-3 (live 2026-10-12): two checkable entries were met by Country (the site's tracked market) and "Services on the site" (read off
  // the site by the site model) alone, so with an empty business profile the run still reported "no claim was wrong" about a
  // "Dubai-based" description that nothing on file could judge. A claim is only checkable against a fact the owner put on file, and a
  // place has to be among them: without a city, a region, an address or a phone number nothing locates the business, and most wrong
  // claims are about where it is and what it charges. Country, services and topics stay on the sheet as context — they never switch
  // the check on by themselves.
  const OWNER = ['City', 'Region', 'Address', 'Phone', 'E-mail', 'Price range', 'Areas served', 'Opening hours', 'Accreditation', 'Other facts', 'Type'];   // seo_profiles + the business facts the app sends
  const LOCATING = ['City', 'Region', 'Address', 'Phone'];
  const owner_facts = sheet.filter(([k]) => OWNER.includes(k)).length;
  const located = sheet.some(([k]) => LOCATING.includes(k));
  const facts_ok = sheet.filter(([k]) => CHECKABLE.includes(k)).length >= CONFIG.min_facts && owner_facts >= CONFIG.min_facts && located;
  const facts = sheet.map(([k, v]) => k + ': ' + v).join('\n');
  for (let i = 0; i < sel.length && out.length < CONFIG.max_jobs_per_run; i += CONFIG.per_job) {
    const chunk = sel.slice(i, i + CONFIG.per_job);
    out.push({ json: { site_id: p.site_id, domain: p.domain, business: p.business_name || p.domain, facts: facts || 'Website: ' + p.domain, facts_ok,
      fact_check: facts_ok ? 'on' : 'off', owner_facts, located, known_competitors: (p.competitors || []).join(', '),
      ids: chunk.map(r => r.prompt_id + '|' + r.engine), answers: chunk.map((r, k) => 'ANSWER ' + (k + 1) + ' [' + r.engine + '] Q: ' + r.prompt + '\n' + String(r._text).slice(0, CONFIG.chars)).join('\n\n') } });
  }
}
return out.length ? out : [{ json: { skip: true } }];
