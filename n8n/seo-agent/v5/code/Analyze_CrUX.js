// G7 (2026-10-12, system review FIX_PLAN.md): reads the Chrome UX Report answers into `crux` — the p75 of real Chrome users per template
// (homepage, a service page, a blog post) on phone and desktop, with the whole-site (origin) figures as the fallback for a page with too
// little traffic of its own. Thresholds T2: LCP <= 2.5 s, INP <= 200 ms, CLS <= 0.1, at the p75 of 28 days of field data.
// Nothing here can fail the audit: a key whose project has the CrUX API switched off (403 PERMISSION_DENIED), a site with no field data at
// all (404) and a request that never answered are all reported as "not available", with the reason and what to do, and the report always
// says which source its numbers came from (CrUX field data vs the Lighthouse lab run of the full report).
const TH = { lcp: 2500, inp: 200, cls: 0.1 };
const FF = ['phone', 'desktop'];

let prev = {};
try { prev = $('Entity Check').first().json || {}; } catch (e) {}
if (!prev.probe) { try { const i = $input.first().json || {}; if (i.probe || i.skip) prev = i; } catch (e2) {} }

let reqs = [];
try { reqs = $('CrUX Targets').all().map(i => i.json || {}); } catch (e) {}
let answers = [];
try { answers = $('Fetch CrUX').all().map(i => i.json || {}); } catch (e) {}
const plan = (reqs[0] || {}).crux_plan || { origin: '', templates: [], missing: [], requests: 0 };
const skipped = !reqs.length || reqs.every(r => r.skip);

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const dateOf = (d) => d && d.year ? [d.year, String(d.month).padStart(2, '0'), String(d.day).padStart(2, '0')].join('-') : '';
const metricOf = (metrics, key) => {
  const m = (metrics || {})[key] || {};
  const p75 = num((m.percentiles || {}).p75);
  const good = (m.histogram || []).find(h => h && num(h.density) != null && num(h.start) === 0);
  return { p75, good_pct: good ? Math.round(num(good.density) * 100) : null };
};
// one answer: the parsed record, or the reason there is none
const read = (res) => {
  const r = res || {};
  const body = r.body ?? r.data ?? r;
  const status = num(r.statusCode) || num((body || {}).code) || (body && body.error ? num(body.error.code) : null) || (body && body.record ? 200 : null);
  if (body && body.record) {
    const rec = body.record;
    return { ok: true, status: 200, lcp: metricOf(rec.metrics, 'largest_contentful_paint'), inp: metricOf(rec.metrics, 'interaction_to_next_paint'),
      cls: metricOf(rec.metrics, 'cumulative_layout_shift'),
      period: { first: dateOf((rec.collectionPeriod || {}).firstDate), last: dateOf((rec.collectionPeriod || {}).lastDate) },
      measured_url: ((body.urlNormalizationDetails || {}).normalizedUrl) || ((rec.key || {}).url) || ((rec.key || {}).origin) || '' };
  }
  const err = (body && body.error) || {};
  const msg = String(err.message || r.message || r.error || '').slice(0, 300);
  const st = String(err.status || '');
  let reason = 'no_data', text = 'no field data for this address';
  if (st === 'PERMISSION_DENIED' || status === 403 || status === 401 || /has not been used in project|is disabled|API key not valid/i.test(msg)) {
    reason = 'api_off'; text = 'the Chrome UX Report API is not enabled for the Google key this agent uses';
  } else if (status === 404 || /not found/i.test(msg)) { reason = 'no_data'; text = 'the Chrome UX Report has no field data for this address (too few real-user visits in the last 28 days)'; }
  else if (status === 429 || /quota|rate/i.test(msg)) { reason = 'rate'; text = 'the Chrome UX Report API refused the request for rate reasons'; }
  else if (status === 400) { reason = 'bad_request'; text = 'the Chrome UX Report refused the address (' + (msg || 'invalid argument') + ')'; }
  else if (!status) { reason = 'no_answer'; text = 'the request to the Chrome UX Report did not answer'; }
  else { reason = 'error'; text = 'the Chrome UX Report answered ' + status + (msg ? ': ' + msg : ''); }
  return { ok: false, status, reason, text, message: msg };
};

// the answers come back in the order they were sent
const rows = reqs.filter(r => !r.skip).map((r, i) => ({ req: r, res: read(answers[i]) }));
const originOf = (ffKey) => (rows.find(x => x.req.level === 'origin' && x.req.form_factor === ffKey) || {}).res || null;
const verdict = (m) => {
  if (!m) return null;
  const parts = [['lcp', m.lcp && m.lcp.p75, TH.lcp], ['inp', m.inp && m.inp.p75, TH.inp], ['cls', m.cls && m.cls.p75, TH.cls]];
  const known = parts.filter(p => p[1] != null);
  if (!known.length) return null;
  const failed = known.filter(p => p[1] > p[2]).map(p => p[0]);
  return { pass: failed.length === 0, failed, complete: known.length === 3 };
};

const templates = [];
for (const t of (plan.templates || [])) {
  const entry = { template: t.template, label: t.label, url: t.url, devices: {} };
  for (const ffKey of FF) {
    const own = (rows.find(x => x.req.level === 'url' && x.req.template === t.template && x.req.form_factor === ffKey) || {}).res || null;
    const org = originOf(ffKey);
    const used = own && own.ok ? own : (org && org.ok ? org : own || org);
    if (!used) { entry.devices[ffKey] = null; continue; }
    const level = own && own.ok ? 'page' : (org && org.ok ? 'origin' : 'none');
    entry.devices[ffKey] = used.ok
      ? { available: true, source: 'crux_field', level, lcp_ms: used.lcp.p75, inp_ms: used.inp.p75, cls: used.cls.p75,
          good_pct: { lcp: used.lcp.good_pct, inp: used.inp.good_pct, cls: used.cls.good_pct }, period: used.period,
          measured_url: used.measured_url, verdict: verdict(used) }
      : { available: false, source: null, level: 'none', reason: used.reason, not_available: used.text };
  }
  templates.push(entry);
}

const every = templates.flatMap(t => FF.map(f => t.devices[f])).filter(Boolean);
const withData = every.filter(d => d.available);
const apiOff = rows.some(x => x.res.reason === 'api_off');
const period = (withData.find(d => d.period && d.period.last) || {}).period || null;
const crux = {
  available: withData.length > 0,
  source: withData.length ? 'crux_field' : null,
  not_available: withData.length ? '' : (skipped ? ((reqs[0] || {}).crux_reason || 'no page of the site could be identified for the speed check')
    : apiOff ? 'the Chrome UX Report API is not enabled for the Google key this agent uses'
      : ((every.find(d => !d.available) || {}).not_available || 'the Chrome UX Report returned no field data for this site')),
  not_available_fix: apiOff ? 'Enable the "Chrome UX Report API" in the Google Cloud project that owns the PageSpeed key (APIs & Services → Library → Chrome UX Report API); no new key or cost is involved.'
    : withData.length ? '' : 'Field data appears once enough Chrome users with reporting enabled visit the site; until then the lab measurements in the full report are the only speed figures.',
  api_enabled: !apiOff,
  thresholds: TH,
  collection_period: period,
  origin: plan.origin || '',
  origin_rows: FF.reduce((m, f) => { const o = originOf(f); m[f] = o && o.ok ? { lcp_ms: o.lcp.p75, inp_ms: o.inp.p75, cls: o.cls.p75, period: o.period, verdict: verdict(o) } : null; return m; }, {}),
  templates,
  templates_missing: plan.missing || [],
  requests: rows.length,
  checked_at: new Date().toISOString()
};

// ---- findings: a low weight on purpose (criterion 1.5: "low weight in the score"). The full report measures the homepage in a Lighthouse
// lab run as well (Analyze PageSpeed), and that one already scores — so there the field data is reported but left unscored, and nothing is
// counted twice. In a technical audit, where no other source measures speed, one Medium finding per failing metric carries it.
const findings = [];
const works = [];
const labScored = !!prev.pagespeed;
const secs = (ms) => (Math.round(ms / 100) / 10).toFixed(1) + ' s';
const F = (sev, title, evidence, why, fix, scoring) => findings.push({ category: 'Performance', severity: sev, title, evidence, why, fix,
  sample_urls: [], affected_count: null, affected_pct: 100, scope: 'site', scoring: !!scoring, source: 'crux' });

if (!crux.available) {
  F('Info', 'Core Web Vitals field data not available', crux.not_available, 'Google judges page experience on what real Chrome users measured (the 75th percentile of 28 days), so without field data the audit cannot say how the site performs for them.', crux.not_available_fix, false);
} else {
  const phoneFail = (key) => templates.filter(t => t.devices.phone && t.devices.phone.available && t.devices.phone.verdict && t.devices.phone.verdict.failed.includes(key));
  const label = { lcp: ['Largest Contentful Paint', 'how long the main content takes to appear'], inp: ['Interaction to Next Paint', 'how quickly the page answers a tap'], cls: ['Cumulative Layout Shift', 'how much the layout moves while loading'] };
  for (const key of ['lcp', 'inp', 'cls']) {
    const bad = phoneFail(key);
    if (!bad.length) continue;
    const worst = bad.map(t => t.devices.phone).sort((a, b) => (key === 'cls' ? b.cls - a.cls : (key === 'lcp' ? b.lcp_ms - a.lcp_ms : b.inp_ms - a.inp_ms)))[0];
    const value = key === 'cls' ? Number(worst.cls).toFixed(2) : key === 'lcp' ? secs(worst.lcp_ms) : Math.round(worst.inp_ms) + ' ms';
    const limit = key === 'cls' ? '0.10' : key === 'lcp' ? '2.5 s' : '200 ms';
    F('Medium', label[key][0] + ' fails for real users on phones (' + key.toUpperCase() + ')',
      bad.map(t => t.label + ' ' + (key === 'cls' ? Number(t.devices.phone.cls).toFixed(2) : key === 'lcp' ? secs(t.devices.phone.lcp_ms) : Math.round(t.devices.phone.inp_ms) + ' ms') + (t.devices.phone.level === 'origin' ? ' (whole site)' : '')).join(', ') + ' — worst ' + value + ' against Google\'s ' + limit + ' limit, at the 75th percentile of real Chrome users' + (period ? ' (' + period.first + ' to ' + period.last + ')' : ''),
      'Core Web Vitals are part of Google\'s page-experience signal and decide ' + label[key][1] + ' for the visitors who actually arrive.',
      key === 'lcp' ? 'Serve the hero image and the first text from cache at the edge, size the hero image for phones and remove render-blocking CSS and fonts from the top of the page.'
        : key === 'inp' ? 'Split and defer the heavy JavaScript that runs on load (tag managers, chat widgets, sliders) so taps are answered within 200 ms.'
          : 'Reserve height for images, ads and embeds, and load fonts with font-display: swap plus a matching fallback metric so nothing moves.',
      !labScored);
  }
  const pass = templates.filter(t => t.devices.phone && t.devices.phone.available && t.devices.phone.verdict && t.devices.phone.verdict.pass);
  if (pass.length) works.push('Core Web Vitals pass for real users on phones on ' + pass.map(t => t.label.toLowerCase()).join(' and ') + ' (p75 from the Chrome UX Report' + (period ? ', ' + period.first + ' to ' + period.last : '') + ')');
}

return [{ json: { ...prev, skip: undefined, crux,
  extra_findings: [...(prev.extra_findings || []), ...findings],
  extra_works: [...(prev.extra_works || []), ...works] } }];
