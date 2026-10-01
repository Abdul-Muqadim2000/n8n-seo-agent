const base = $('Analyze Backlinks').first().json;
const targets = $('PS Targets').all().map(i => i.json);
const res = $input.all().map(i => i.json);

const rows = targets.map((t, i) => {
  const r = res[i] || {};
  const lr = r.lighthouseResult || {};
  const a = lr.audits || {};
  const sc = lr.categories?.performance?.score;
  const f = r.loadingExperience?.metrics || {};
  const opps = Object.values(a)
    .filter(x => x && x.details && x.details.type === 'opportunity' && (x.details.overallSavingsMs || 0) > 100)
    .sort((x, y) => y.details.overallSavingsMs - x.details.overallSavingsMs)
    .slice(0, 6)
    .map(x => ({ title: x.title, savings_ms: Math.round(x.details.overallSavingsMs), display: x.displayValue || '' }));
  return {
    domain: t.domain, is_you: t.is_you,
    available: sc != null,
    score: sc != null ? Math.round(sc * 100) : null,
    lab: {
      lcp: a['largest-contentful-paint']?.numericValue ?? null,
      cls: a['cumulative-layout-shift']?.numericValue ?? null,
      tbt: a['total-blocking-time']?.numericValue ?? null,
      ttfb: a['server-response-time']?.numericValue ?? null,
      tti: a['interactive']?.numericValue ?? null
    },
    field: {
      lcp: f.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
      cls: f.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile != null ? f.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100 : null,
      inp: f.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
      overall: r.loadingExperience?.overall_category || null
    },
    opportunities: opps
  };
});

const you = rows.find(r => r.is_you) || {};
const comps = rows.filter(r => !r.is_you && r.available);
const median = (arr) => { const a = arr.filter(v => v != null).sort((x, y) => x - y); if (!a.length) return null; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const medians = { score: median(comps.map(c => c.score)) };

const findings = [];
const works = [];
const F = (severity, title, evidence, why, fix) => findings.push({
  category: 'Performance', severity, title, evidence, why, fix,
  sample_urls: ['https://' + base.domain + '/'], affected_count: null, affected_pct: 100, scope: 'site'
});

if (you.available) {
  const lcp = you.field.lcp ?? you.lab.lcp;
  const lcpSrc = you.field.lcp != null ? 'real users' : 'lab test';
  if (lcp > 4000) F('High', 'Largest Contentful Paint is Poor (over 4s)', Math.round(lcp) + 'ms (' + lcpSrc + ', mobile)', 'Google rates LCP over 4 seconds as Poor; it hurts rankings and conversions.', 'Speed up server response, preload the main image and reduce render-blocking resources.');
  else if (lcp > 2500) F('Medium', 'Largest Contentful Paint needs improvement (2.5-4s)', Math.round(lcp) + 'ms (' + lcpSrc + ', mobile)', 'Google rates LCP above 2.5 seconds as Needs Improvement.', 'Speed up server response and optimise the main image.');
  else if (lcp) works.push('Good Largest Contentful Paint (' + Math.round(lcp) + 'ms, ' + lcpSrc + ')');

  const cls = you.field.cls ?? you.lab.cls;
  if (cls > 0.25) F('High', 'Layout shift is Poor (CLS over 0.25)', 'CLS ' + Number(cls).toFixed(2), 'Content jumping while loading frustrates users and fails Core Web Vitals.', 'Reserve space for images, banners and embeds.');
  else if (cls > 0.1) F('Medium', 'Layout shift needs improvement (CLS 0.1-0.25)', 'CLS ' + Number(cls).toFixed(2), 'Visible layout shifts hurt user experience.', 'Set width/height on images and reserve space for dynamic content.');
  else if (cls != null) works.push('Stable layout (CLS ' + Number(cls).toFixed(2) + ')');

  if (you.field.inp > 500) F('High', 'Slow response to clicks and taps (INP over 500ms)', 'INP ' + you.field.inp + 'ms (real users)', 'Pages that react slowly feel broken.', 'Reduce and split heavy JavaScript.');
  else if (you.field.inp > 200) F('Medium', 'Response to clicks needs improvement (INP 200-500ms)', 'INP ' + you.field.inp + 'ms (real users)', 'Slow interactions hurt experience.', 'Reduce long JavaScript tasks.');

  if (you.score < 50) F('High', 'Low mobile performance score', 'PageSpeed ' + you.score + '/100 (mobile)', 'A low score signals heavy, slow pages on phones.', 'Fix the top opportunities listed below.');
  else if (you.score < 75) F('Medium', 'Mobile performance score needs improvement', 'PageSpeed ' + you.score + '/100 (mobile)', 'There is clear room to make mobile pages faster.', 'Fix the top opportunities listed below.');
  else if (you.score >= 90) works.push('Excellent mobile PageSpeed score (' + you.score + '/100)');

  if (you.lab.ttfb > 600) F('Medium', 'Slow server response in Lighthouse test', Math.round(you.lab.ttfb) + 'ms server response', 'The first byte arrives slowly, delaying everything else.', 'Enable HTML caching at the CDN and host close to your audience.');
  if (you.lab.tbt > 600) F('Medium', 'Heavy JavaScript blocks the page', 'Total Blocking Time ' + Math.round(you.lab.tbt) + 'ms', 'Long scripts freeze the page after it appears.', 'Defer third-party tags and split large scripts.');
  if (you.opportunities.length) F('Low', 'Top speed-up opportunities', you.opportunities.map(o => o.title + ' (~' + o.savings_ms + 'ms)').join('; '), 'Google lists these as the biggest savings available.', 'Work through these in order of estimated savings.');

  if (medians.score != null && you.score != null && you.score < medians.score - 15) {
    F('High', 'Mobile speed is well behind competitors', 'PageSpeed ' + you.score + ' vs competitor median ' + medians.score, 'Faster competitor pages give them a user-experience and ranking edge.', 'Prioritise caching, image optimisation and JavaScript reduction.');
  }
} else {
  findings.push({ category: 'Performance', severity: 'Info', title: 'PageSpeed test did not return results', evidence: 'Google PageSpeed API gave no data for the homepage', why: 'Core Web Vitals could not be measured in this run.', fix: 'Check the API key and try again.', sample_urls: [], affected_count: null, affected_pct: 100, scope: 'site', scoring: false });
}

return [{
  json: {
    ...base,
    pagespeed: { rows, medians },
    extra_findings: [...(base.extra_findings || []), ...findings],
    extra_works: [...(base.extra_works || []), ...works]
  }
}];