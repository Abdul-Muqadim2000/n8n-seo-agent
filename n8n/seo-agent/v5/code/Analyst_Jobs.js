// Answer Analyst jobs (v4.9, weekly and on-demand runs): Claude reads the answers that matter — every answer naming the business, the brand question,
// and the recommendation / comparison answers — and returns per answer the businesses named in order (with their website when known), how the
// answer speaks of the business (sentiment) and any claim about it that contradicts the business profile (wrong city, services, prices, a
// different company with the same name). Regex matching cannot see a competitor named without its website, or a wrong fact; this can.
// 12 answers per job, at most 6 jobs per site and 24 per run (~$0.02 each; the agent runs them one after another, so the cap keeps a
// many-site run inside the execution time limit — sites past it keep the parser's reading this week).
const CONFIG = { per_job: 12, max_jobs_per_site: 6, max_jobs_per_run: 24, chars: 1500 };
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do && !p.pulse_run);
let rows = []; try { rows = $('Parse AI Answers').all().map(i => i.json).filter(r => !r.skip && r.engine && r.answered && r._text); } catch (e) {}
const out = [];
for (const p of plans) {
  const mine = rows.filter(r => r.site_id === p.site_id);
  const pick = [...mine.filter(r => r.mentioned || r.kind === 'brand'), ...mine.filter(r => !r.mentioned && r.kind !== 'brand' && ['recommend', 'compare', 'choose', 'custom'].includes(r.kind))];
  const sel = pick.slice(0, CONFIG.per_job * CONFIG.max_jobs_per_site);
  const P = p.profile || {};
  const facts = [['Business name', p.business_name], ['Website', p.domain], ['Type', p.business_type], ['City', P.city], ['Region', P.region], ['Country', p.country], ['Address', P.street_address], ['Phone', P.phone], ['E-mail', P.public_email],
    ['Price range', P.price_range], ['Areas served', P.service_areas], ['Opening hours', P.opening_hours], ['Services / topics', (p.topics || []).join(', ')], ['Other names', (p.brand_names || []).filter(b => !/\./.test(b)).join(', ')]].filter(([, v]) => v).map(([k, v]) => k + ': ' + v).join('\n');
  for (let i = 0; i < sel.length && out.length < CONFIG.max_jobs_per_run; i += CONFIG.per_job) {
    const chunk = sel.slice(i, i + CONFIG.per_job);
    out.push({ json: { site_id: p.site_id, domain: p.domain, business: p.business_name || p.domain, facts: facts || 'Website: ' + p.domain, known_competitors: (p.competitors || []).join(', '),
      ids: chunk.map(r => r.prompt_id + '|' + r.engine), answers: chunk.map((r, k) => 'ANSWER ' + (k + 1) + ' [' + r.engine + '] Q: ' + r.prompt + '\n' + String(r._text).slice(0, CONFIG.chars)).join('\n\n') } });
  }
}
return out.length ? out : [{ json: { skip: true } }];
