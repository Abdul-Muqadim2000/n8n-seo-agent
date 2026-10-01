const d = $('Analyze HTML').first().json;
const a = d.html_analysis;
const urls = $('URLs To Check').all().map(i => i.json);
const res = $input.all().map(i => i.json);

const findings = [...a.findings];
const works = [...a.works];

urls.forEach((u, i) => {
  if (u.purpose === 'none') return;
  const status = (res[i] || {}).statusCode || 0;
  if (!status || status >= 400) {
    const isLogo = /logo/i.test(u.purpose);
    findings.push({
      category: 'Schema', severity: /organization logo/i.test(u.purpose) ? 'Critical' : (isLogo ? 'High' : 'Medium'),
      title: u.purpose + ' URL is broken',
      evidence: u.url + ' returned ' + (status || 'no response'),
      why: isLogo ? 'A broken schema logo breaks Google logo and organisation rich results, and is usually repeated on every page from one template.' : 'Search engines cannot use images that do not load.',
      fix: 'Point the schema to a working image URL (ImageObject with width and height). Verify: the URL should return 200.',
      sample_urls: [], affected_count: null, affected_pct: 100, scope: 'site'
    });
  } else {
    works.push(u.purpose + ' loads correctly (' + status + ')');
  }
});

return [{
  json: {
    ...d,
    extra_findings: [...(d.extra_findings || []), ...findings],
    extra_works: [...(d.extra_works || []), ...works]
  }
}];