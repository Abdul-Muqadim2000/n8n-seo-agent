const base = $('Schema Findings').first().json;
const list = $('Pick Competitors').all().map(i => i.json);
const ov = $('Domain Overview Answers').all().map(i => i.json);
const AGES = $('Domain Ages').first().json.ages || {};
// B-A11 (2026-10-15, INVARIANTS rule 1): the in-200 retry gate (rule 3) marks an answer `unavailable` when BOTH attempts
// failed, and attaches that block to every item as `__dfs`. Nothing below may rank, score or advise from one.
const __ev76 = (list, node) => { try { const a = (node ? $(node).all().map(i => i.json) : list) || []; return (a.find(x => x && x.__dfs) || {}).__dfs || null; } catch (e) { return null; } };
// A refusal fires on an evidence block that SAYS `unavailable`, never on the absence of one: a path with no gate attached
// (and every harness fixture) has no `__dfs`, and inventing a failure out of silence is the same mistake in the other
// direction. This is how the nine nodes that already refuse read it too (Assess Result falls back when `__dfs` is absent).
const __read76 = (ev) => !ev || !ev.unavailable;
const ovEv76 = __ev76(ov);
// R17's lesson in one line: a missing domain overview is not a site with no rankings. When the read failed twice every
// figure it would have produced is null and the comparison is left out of the report, with its reason.
const metricsRead76 = __read76(ovEv76);
const listEv76 = (list.find(c => c && c.competitors_evidence) || {}).competitors_evidence || null;   // v4.6: stored registration dates; free RDAP first, paid WHOIS only for the gaps

const rows = list.map((c, i) => {
  const m = ov[i]?.tasks?.[0]?.result?.[0]?.items?.[0]?.metrics?.organic || {};
  const top3 = metricsRead76 ? (m.pos_1 || 0) + (m.pos_2_3 || 0) : null;
  const top10 = metricsRead76 ? top3 + (m.pos_4_10 || 0) : null;
  const regRaw = (AGES[String(c.domain || '').toLowerCase()] || {}).registered || null;
  const reg = regRaw ? String(regRaw).slice(0, 10) : null;
  const age = reg ? Number(((Date.now() - new Date(reg)) / 31557600000).toFixed(1)) : null;
  return {
    domain: c.domain,
    is_you: !!c.is_you,
    shared_keywords: c.shared,
    organic_keywords: metricsRead76 ? (m.count ?? 0) : null,
    top3, top10,
    est_monthly_traffic: metricsRead76 ? (m.etv != null ? Math.round(m.etv) : 0) : null,
    traffic_value_usd: metricsRead76 ? (m.estimated_paid_traffic_cost != null ? Math.round(m.estimated_paid_traffic_cost) : 0) : null,
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

if (!metricsRead76) {
  findings.push({ category: 'Authority', severity: 'Info', title: 'The ranking comparison could not be read',
    evidence: 'The search data provider did not answer ' + (ovEv76 ? ovEv76.asked || 0 : 0) + ' domain overview request(s), asked twice'
      + (ovEv76 && ovEv76.error ? ': ' + ovEv76.error : '') + '.',
    why: 'Rankings, traffic and authority comparisons are left out of this report: nothing was measured. This is not "no rankings".',
    fix: 'No action needed — the check is made again on the next run.',
    sample_urls: [], affected_count: null, affected_pct: 100, scope: 'site', scoring: false });
} else if ((you.top10 || 0) === 0) {
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

if (metricsRead76 && comps.length && med.est_monthly_traffic && (you.est_monthly_traffic || 0) < med.est_monthly_traffic * 0.1) {
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
  const unread76 = !!(listEv76 && listEv76.unavailable);
  findings.push({ category: 'Authority', severity: 'Info',
    title: unread76 ? 'The competitor search could not be read' : 'No competitors could be identified',
    evidence: unread76 ? 'The search data provider did not answer, asked twice' + (listEv76.error ? ': ' + listEv76.error : '') + '.' : 'No overlapping domains found for ' + base.country,
    why: unread76 ? 'Competitor comparisons are left out of this report: nothing was measured.' : 'Competitor comparisons in this report are limited.',
    fix: unread76 ? 'No action needed — the search is made again on the next run.' : 'Add up to 3 competitors in the form for a full comparison.', sample_urls: [], affected_count: null, affected_pct: 100, scope: 'site', scoring: false });
}

return [{
  json: {
    ...base,
    competitor_benchmark: {
      country: base.country,
      source: (list[0] && list[0].method) || '',
      rows,
      medians: med,
      evidence: { metrics: ovEv76, list: listEv76, unavailable: !metricsRead76 }
    },
    extra_findings: [...(base.extra_findings || []), ...findings],
    extra_works: [...(base.extra_works || []), ...works]
  }
}];