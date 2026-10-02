const base = $('Analyze Keywords').first().json;
const targets = $('BL Targets').all().map(i => i.json);
const sums = $('Backlink Summary').all().map(i => i.json);
const gapRes = $input.first().json || {};

const rows = targets.map((t, i) => {
  const task = sums[i]?.tasks?.[0] || {};
  const r = task.result?.[0] || null;
  if (!r) return { domain: t.domain, is_you: t.is_you, available: false, error: task.status_message || sums[i]?.error?.message || 'no data' };
  const rd = r.referring_domains ?? null;
  return {
    domain: t.domain, is_you: t.is_you, available: true,
    domain_rank: r.rank ?? null,
    backlinks: r.backlinks ?? null,
    referring_domains: rd,
    dofollow_pct: rd ? Math.round((1 - (r.referring_domains_nofollow || 0) / rd) * 100) : null,
    spam_score: r.backlinks_spam_score ?? null,
    broken_backlinks: r.broken_backlinks ?? null
  };
});

const available = rows.some(r => r.available);
const you = rows.find(r => r.is_you) || {};
const comps = rows.filter(r => !r.is_you && r.available);
const median = (arr) => { const a = arr.filter(v => v != null).sort((x, y) => x - y); if (!a.length) return null; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const medians = {
  referring_domains: median(comps.map(c => c.referring_domains)),
  backlinks: median(comps.map(c => c.backlinks)),
  domain_rank: median(comps.map(c => c.domain_rank))
};

const gapItems = gapRes.tasks?.[0]?.result?.[0]?.items || [];
const gap = gapItems.map(it => {
  const vals = Object.values(it.domain_intersection || {});
  const first = vals[0] || {};
  return { referring_domain: first.target || first.domain || it.domain || it.referring_domain || null, rank: first.rank ?? null, links_to_competitors: vals.length };
}).filter(g => g.referring_domain).slice(0, 25);

const findings = [];
const works = [];
const F = (severity, title, evidence, why, fix) => findings.push({
  category: 'Authority', severity, title, evidence, why, fix,
  sample_urls: [], affected_count: null, affected_pct: 100, scope: 'site'
});

if (!available) {
  findings.push({ category: 'Authority', severity: 'Info', title: 'Backlink data not available', evidence: 'Backlinks API returned: ' + (rows[0] && rows[0].error || 'no data'), why: 'Backlink numbers need the DataForSEO Backlinks API to be active.', fix: 'Activate the Backlinks API to include link authority in the next report.', sample_urls: [], affected_count: null, affected_pct: 100, scope: 'site', scoring: false });
} else if (you.available) {
  if (medians.referring_domains && (you.referring_domains || 0) < medians.referring_domains * 0.1) {
    F('High', 'Far fewer referring domains than competitors',
      you.referring_domains + ' referring domains vs competitor median ' + Math.round(medians.referring_domains),
      'Links from other websites are one of the strongest ranking signals; competitors are far ahead.',
      'Earn links from partner directories, industry associations, suppliers, press and guest content.');
  } else if (medians.referring_domains && you.referring_domains >= medians.referring_domains) {
    works.push('Referring domains on par with competitors (' + you.referring_domains + ' vs median ' + Math.round(medians.referring_domains) + ')');
  }
  if (you.dofollow_pct != null && you.dofollow_pct < 50 && you.referring_domains > 5) {
    F('Low', 'Most links are nofollow', you.dofollow_pct + '% of referring domains give followed links',
      'Nofollow links pass little ranking value.', 'Prioritise editorial links, directories and partners that give followed links.');
  }
  if (you.spam_score != null && you.spam_score > 30) {
    F('Medium', 'High backlink spam score', 'Spam score ' + you.spam_score,
      'A high share of low-quality links can hold rankings back.', 'Review the worst linking domains and disavow clearly manipulative ones.');
  }
  if (you.broken_backlinks > 10) {
    F('Low', 'Backlinks pointing to broken pages', you.broken_backlinks + ' backlinks lead to pages that no longer exist',
      'Link value is lost when links point to 404 pages.', 'Redirect the old URLs to the most relevant live pages.');
  }
}
if (gap.length) {
  F('Medium', 'Link opportunities: sites that link to competitors but not to you',
    gap.length + ' domains. Top: ' + gap.slice(0, 5).map(g => g.referring_domain).join(', '),
    'Sites that already link to your competitors are the most likely to link to you.',
    'Reach out to these sites with a listing request, partnership or useful resource.');
}

return [{
  json: {
    ...base,
    authority: { available, rows, medians, gap },
    extra_findings: [...(base.extra_findings || []), ...findings],
    extra_works: [...(base.extra_works || []), ...works]
  }
}];