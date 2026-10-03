const base = $('Schema Findings').first().json;
const list = $('Pick Competitors').all().map(i => i.json);
const ov = $('Domain Overview').all().map(i => i.json);
const AGES = $('Domain Ages').first().json.ages || {};   // v4.6: stored registration dates; free RDAP first, paid WHOIS only for the gaps

const rows = list.map((c, i) => {
  const m = ov[i]?.tasks?.[0]?.result?.[0]?.items?.[0]?.metrics?.organic || {};
  const top3 = (m.pos_1 || 0) + (m.pos_2_3 || 0);
  const top10 = top3 + (m.pos_4_10 || 0);
  const regRaw = (AGES[String(c.domain || '').toLowerCase()] || {}).registered || null;
  const reg = regRaw ? String(regRaw).slice(0, 10) : null;
  const age = reg ? Number(((Date.now() - new Date(reg)) / 31557600000).toFixed(1)) : null;
  return {
    domain: c.domain,
    is_you: !!c.is_you,
    shared_keywords: c.shared,
    organic_keywords: m.count ?? 0,
    top3, top10,
    est_monthly_traffic: m.etv != null ? Math.round(m.etv) : 0,
    traffic_value_usd: m.estimated_paid_traffic_cost != null ? Math.round(m.estimated_paid_traffic_cost) : 0,
    registered: reg,
    domain_age_years: age
  };
});

const you = rows.find(r => r.is_you) || {};
const comps = rows.filter(r => !r.is_you);
const median = (arr) => { const a = arr.filter(v => v != null).sort((x, y) => x - y); if (!a.length) return null; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const r1 = (v) => v == null ? null : Math.round(v * 10) / 10;
const med = {
  organic_keywords: median(comps.map(c => c.organic_keywords)),
  top10: median(comps.map(c => c.top10)),
  est_monthly_traffic: median(comps.map(c => c.est_monthly_traffic)),
  domain_age_years: r1(median(comps.map(c => c.domain_age_years)))
};

const findings = [];
const works = [];
const F = (severity, title, evidence, why, fix) => findings.push({
  category: 'Authority', severity, title, evidence, why, fix,
  sample_urls: [], affected_count: null, affected_pct: 100, scope: 'site'
});
const names = comps.map(c => c.domain).join(', ');

if ((you.top10 || 0) === 0) {
  F('High', 'The site does not rank in Google’s top 10 for any keyword',
    'Top-10 rankings in ' + (base.country || 'the target country') + ': ' + base.domain + ' 0' + (comps.length ? ' vs competitor median ' + (med.top10 ?? 'N/A') + ' (' + names + ')' : ''),
    'Without top-10 rankings the site gets almost no organic traffic, however good the pages are.',
    'Build authority first (partner listings, directories, reviews, mentions) and target long-tail keywords where competitors are weak.');
} else if (med.top10 && you.top10 < med.top10 * 0.25) {
  F('High', 'Far fewer top-10 rankings than competitors', base.domain + ' ' + you.top10 + ' vs competitor median ' + med.top10,
    'Competitors are visible for many more searches.', 'Use the keyword gap to target terms competitors rank for, starting with low-difficulty ones.');
} else if (comps.length) {
  works.push('Top-10 rankings comparable with competitors (' + you.top10 + ' vs median ' + med.top10 + ')');
}

if (comps.length && med.est_monthly_traffic && (you.est_monthly_traffic || 0) < med.est_monthly_traffic * 0.1) {
  F('High', 'Organic traffic is under 10% of competitors',
    'Estimated monthly organic visits: ' + base.domain + ' ' + (you.est_monthly_traffic || 0) + ' vs competitor median ' + Math.round(med.est_monthly_traffic).toLocaleString('en-GB'),
    'Most searchers in this market are going to competitors.', 'Close the keyword and backlink gaps shown in this report.');
}

if (you.domain_age_years != null && you.domain_age_years < 1) {
  F('High', 'Very young domain' + (med.domain_age_years ? ' competing with long-established sites' : ''),
    base.domain + ' registered ' + you.registered + ' (' + you.domain_age_years + ' years)' + (med.domain_age_years != null ? ' vs competitor median ' + med.domain_age_years + ' years' : ''),
    'New domains have little accumulated trust; on-page fixes alone rarely move competitive terms in the first year.',
    'Invest in off-site entity building (partner directories, reviews, mentions) and target long-tail, lower-difficulty searches first.');
}

if (!comps.length) {
  findings.push({ category: 'Authority', severity: 'Info', title: 'No competitors could be identified', evidence: 'No overlapping domains found for ' + base.country, why: 'Competitor comparisons in this report are limited.', fix: 'Add up to 3 competitors in the form for a full comparison.', sample_urls: [], affected_count: null, affected_pct: 100, scope: 'site', scoring: false });
}

return [{
  json: {
    ...base,
    competitor_benchmark: {
      country: base.country,
      source: (list[0] && list[0].method) || '',
      rows,
      medians: med
    },
    extra_findings: [...(base.extra_findings || []), ...findings],
    extra_works: [...(base.extra_works || []), ...works]
  }
}];