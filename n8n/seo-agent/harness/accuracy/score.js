// G18 — the accuracy scorer: runs the real node code over the labelled set and reports precision per category.
//
// Two gated categories:
//   audit_findings — every finding the audit raises for a labelled site must be in `findings.json` with a human label
//                    (true_positive / false_positive / cosmetic). Precision = TP / (TP + FP) over the labelled cases.
//   spam_labels    — every referring site in `links.json` is labelled spam / genuine; the link ledger's own label
//                    (`link_type === 'spam'`, the D3 footprint gate inside the real *Parse Backlinks* node) is scored against it.
//
// Offline: the site fixtures in `sites/*.json` are real free fetches (harness/accuracy/capture.js), the link rows are the real
// rows of execution 418. No network, no paid API. Used by scenario S49 in scenarios_v5.js; see n8n/seo-agent/ACCURACY_SET.md.
//
// Report mode (prints every emitted finding and its label, for adding cases):
//   docker exec n8n-n8n-1 sh -c 'cd /tmp/harness && CODE_DIR=/tmp/harness/code_v4 OUT_DIR=/tmp/harness/out node accuracy/score.js'
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(DIR, p), 'utf8'));
const FINDINGS = readJson('findings.json');
const LINKS = readJson('links.json');

// ---------- site fixture -> the probe responses the HTTP nodes would return ----------
const filler = (n) => 'x'.repeat(Math.max(0, n));
const sitemapXml = (p) => {
  const locs = p.locs || [];
  const body = locs.map(u => '<url><loc>' + u + '</loc></url>').join('\n');
  return p.is_index
    ? '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + locs.map(u => '<sitemap><loc>' + u + '</loc></sitemap>').join('\n') + '\n</sitemapindex>'
    : '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + '\n</urlset>';
};
// The fixture keeps what the audit measures: status, the headers it reads, the homepage <head> and each response's length.
// A body it never parses is rebuilt at its measured length (the crawler-access check compares lengths, nothing else).
const probeBody = (id, p) => {
  if (id === 'sitemap') return p.status === 200 ? sitemapXml(p) : filler(p.body_len || 0);
  if (id === 'robots') return p.status === 200 ? String(p.text || '') : filler(p.body_len || 0);
  if (p.head != null) { const tail = Math.max(0, (p.body_len || 0) - p.head.length - 15); return p.head + '<body>' + filler(tail) + '</body>'; }
  if (p.text) return String(p.text);
  return filler(p.body_len || 0);
};
const probeResponse = (site, id) => {
  const p = site.probes[id];
  if (!p) throw new Error('fixture ' + site.domain + ' has no probe "' + id + '"');
  return { json: { statusCode: p.status || 0, headers: p.headers || {}, body: probeBody(id, p), ...(p.error ? { error: { message: p.error } } : {}) } };
};

// ---------- runner 1: the audit chain (Build Probes / Content Probes / Analyze Probes / Build Site Issues) ----------
async function auditSite(H, site) {
  const { run, mock, store } = H;
  mock('Check Crawl', [{ json: { domain: site.domain, audit_level: site.audit_level || 'site_audit', pages_crawled: site.pages.length, crawl_finished: true, crawl_limit: 200, crawl_summary: site.crawl || {} } }]);
  mock('Get Crawled Pages', [{ json: { tasks: [{ result: [{ items: site.pages }] }] } }]);
  mock('Collect Crawl Extras', [{ json: { crawl_extras: {} } }]);
  const bp = await run('Build Probes', [{ json: { domain: site.domain } }]);
  const cp = await run('Content Probes', [{ json: { domain: site.domain } }]);
  mock('Run Probes', bp.map(i => probeResponse(site, i.json.id)));
  mock('Run Content Probes', cp.map(i => probeResponse(site, i.json.id)));
  const ap = await run('Analyze Probes', store['Run Content Probes']);
  const bsi = await run('Build Site Issues', [{ json: { ...ap[0].json, extra_findings: [], extra_works: [] } }]);
  const a = bsi[0].json.site_audit;
  // One case per decision the customer can check: a site-wide finding is one key, a page-level finding is one key per page
  // it lists (`category|title@url`), because that is what someone clicking the finding verifies.
  const byKey = new Map();
  for (const f of a.findings) {
    const base = f.category + '|' + f.title;
    const urls = (f.sample_urls || []).map(s => String(s).split(' — ')[0]).filter(u => /^https?:\/\//.test(u));
    if (urls.length) for (const u of urls) byKey.set(base + '@' + u, f); else byKey.set(base, f);
  }
  return { audit: a, probe: ap[0].json, emitted: [...byKey.keys()], byKey };
}

// ---------- runner 2: the link ledger (the real Parse Backlinks node, D3 footprint gate included) ----------
const BL_PLAN = {
  site_id: 'site_techand-ai', domain: 'techand.ai', country: 'United Arab Emirates', country_name: 'United Arab Emirates', country_iso: 'AE',
  location_code: 2784, language_code: 'en', email: '', callback_url: '', request_id: 'g18', on_demand: true, adhoc: false, free_only: false,
  mode: 'full', since: new Date(Date.now() - 30 * 864e5).toISOString(), since_full: new Date(Date.now() - 30 * 864e5).toISOString(),
  stored_timeseries: [], gap_due: false, stored_gap: [], competitors: ['cleartax.com', 'complyance.io'], need_competitors: false,
  business_name: 'Tech& Systems', brand_names: ['Techand Systems'], assets: [], brand_query: '', brand_res: [], label: 'techand',
  topics: ['e invoicing', 'peppol', 'erp', 'dynamics 365', 'uae'], ga4_property_id: '', gsc_property: '', bing: false, link_builder: false,
  import_info: [], previous: null, existing_prospects: 0, checked_at: '2026-10-12T06:00:00.000Z', ledger_size: 0, ledger_live: 0
};
async function linkLedger(H, target = 'techand.ai') {
  const { run, mock } = H;
  const entries = LINKS.cases.filter(c => c.target === target).map(c => ({
    ref_domain: c.ref_domain, kind: c.entry.kind || 'web', sources: c.entry.sources || ['dfs'], from_url: c.entry.from_url || '', to_url: c.entry.to_url || 'https://techand.ai/',
    anchor: c.entry.anchor || '', rel: c.entry.rel || 'follow', placement: c.entry.placement || 'content', first_seen: c.entry.first_seen || '2026-09-01',
    last_seen: c.entry.last_seen || '2026-10-12', authority: c.entry.authority || 0, page_keywords: 0, spam: c.entry.spam || 0, original: true,
    sitewide: 0, links: 1, visits: c.entry.visits || 0, visits_28d: 0, key_events: 0, dfs_lost: null, cc_rank: c.entry.cc_rank || 0,
    pages: c.entry.from_url ? [{ url: c.entry.from_url, src: 'dfs' }] : [], prev: null, ai_cited: false,
    page_title: c.entry.page_title || '', link_type: c.entry.link_type || '', relevance: c.entry.relevance == null ? null : c.entry.relevance
  }));
  const plan = { ...BL_PLAN, domain: target, site_id: 'site_' + target.replace(/[^a-z0-9]+/g, '-'),
    competitors: target === 'techand.ai' ? BL_PLAN.competitors : ['techand.ai', 'azentio.com'],
    business_name: target === 'techand.ai' ? BL_PLAN.business_name : 'ClearTax', brand_names: target === 'techand.ai' ? BL_PLAN.brand_names : ['ClearTax'] };
  mock('BL Plan', [{ json: plan }]);
  mock('Link Merge', [{ json: { site_id: plan.site_id, domain: plan.domain, mode: 'full', entries, mention_pages: [], list_pages: [], cc_gap: [], cc_rank: {}, sources: { cc: { release: '', links: 0, checked_at: '' }, counts: {}, bing: { enabled: false }, gsc: { rows: 0, domains: 0 }, ga4: { rows: 0, property: '', excluded: [] }, wiki: {}, hn: {} } } }]);
  const pb = await run('Parse Backlinks', H.store['Link Merge']);
  const out = pb[0].json;
  const byDomain = new Map((out.ledger_rows || []).map(r => [r.ref_domain, r]));
  return { out, byDomain };
}

// ---------- scoring ----------
const blank = () => ({ tp: 0, fp: 0, fn: 0, tn: 0, cosmetic_emitted: 0, cosmetic_suppressed: 0, unlabelled: [], wrong: [] });
const pct = (n, d) => (d === 0 ? null : Math.round((n / d) * 1000) / 10);
// precision: of the claims the system makes, how many are true (the metric G18 gates at 95%, the one the 2026-10-11 spot-check
// measured as 5 of 7). useful_precision also counts the claims that are true but not worth reporting (`cosmetic`) against the
// system: it is reported, never gated, and it is the honest number for "how much of a report is worth reading".
const finish = (s) => ({ ...s, cases: s.tp + s.fp + s.fn + s.tn + s.cosmetic_emitted + s.cosmetic_suppressed, precision: pct(s.tp, s.tp + s.fp), recall: pct(s.tp, s.tp + s.fn), useful_precision: pct(s.tp, s.tp + s.fp + s.cosmetic_emitted) });

async function scoreAudit(H, log) {
  const s = blank(); const perSite = {};
  for (const sf of FINDINGS.sites) {
    const site = readJson(path.join('sites', sf.file));
    const r = await auditSite(H, site);
    const cases = FINDINGS.cases.filter(c => c.site === sf.site);
    const ss = blank();
    for (const c of cases) {
      const emitted = r.byKey.has(c.finding);
      if (c.label === 'cosmetic') { emitted ? ss.cosmetic_emitted++ : ss.cosmetic_suppressed++; continue; }
      if (c.label === 'true_positive') { if (emitted) ss.tp++; else { ss.fn++; ss.wrong.push(c.id + ' missed: ' + c.finding); } }
      else if (c.label === 'false_positive') { if (emitted) { ss.fp++; ss.wrong.push(c.id + ' wrongly raised: ' + c.finding + ' — ' + (r.byKey.get(c.finding) || {}).evidence); } else ss.tn++; }
      else throw new Error('case ' + c.id + ': unknown label "' + c.label + '"');
    }
    const known = new Set(cases.map(c => c.finding));
    for (const k of r.emitted) if (!known.has(k)) ss.unlabelled.push(sf.site + ': ' + k);
    perSite[sf.site] = { ...finish(ss), emitted: r.emitted.length, findings: r.emitted, what_works: r.audit.what_works, health: r.audit.health_score };
    for (const k of Object.keys(s)) Array.isArray(s[k]) ? s[k].push(...ss[k]) : (s[k] += ss[k]);
    if (log) { log('   ' + sf.site + ': ' + r.emitted.length + ' findings, ' + cases.length + ' labelled (tp ' + ss.tp + ' fp ' + ss.fp + ' fn ' + ss.fn + ' tn ' + ss.tn + ' cosmetic ' + (ss.cosmetic_emitted + ss.cosmetic_suppressed) + ')' + (ss.unlabelled.length ? ' | UNLABELLED ' + ss.unlabelled.length : '')); }
  }
  return { ...finish(s), per_site: perSite };
}

async function scoreLinks(H, log) {
  const s = blank(); const ledgers = new Map(); const farms = [];
  for (const t of LINKS.targets) { const r = await linkLedger(H, t.target); ledgers.set(t.target, r); farms.push(...(r.out.farms || []).map(f => t.target + ' ← ' + f.ref_domain)); if (log) log('   ' + t.target + ': ' + (r.out.ledger_rows || []).length + ' ledger rows, ' + (r.out.farms || []).length + ' labelled spam'); }
  for (const c of LINKS.cases) {
    const row = (ledgers.get(c.target) || { byDomain: new Map() }).byDomain.get(c.ref_domain);
    if (!row) { s.unlabelled.push('no ledger row for ' + c.ref_domain); continue; }
    const predicted = row.link_type === 'spam';
    if (c.label === 'spam') { if (predicted) s.tp++; else { s.fn++; s.wrong.push(c.id + ' ' + c.ref_domain + ': spam not labelled (link_type "' + row.link_type + '")'); } }
    else if (c.label === 'genuine') { if (predicted) { s.fp++; s.wrong.push(c.id + ' ' + c.ref_domain + ': wrongly labelled spam — ' + row.note); } else s.tn++; }
    else throw new Error('case ' + c.id + ': unknown label "' + c.label + '"');
  }
  // reported, never gated: of the links the report calls the site's "best", how many are both genuine and worth something.
  // A genuine link can still be worthless (`low_value`): a search-results page ranked above the one real editorial link is the
  // same mistake D3 fixed for link farms, one step further on. See ACCURACY_SET.md, G18-1.
  const best = ((((ledgers.get('techand.ai') || {}).out || {}).values || {}).best_seo || []).map(x => x.ref_domain);
  const lowValue = new Set(LINKS.cases.filter(c => c.low_value).map(c => c.ref_domain));
  const spamLabelled = new Set(LINKS.cases.filter(c => c.label === 'spam').map(c => c.ref_domain));
  const badBest = best.filter(d => lowValue.has(d) || spamLabelled.has(d));
  return { ...finish(s), farms, best_seo: best, best_link_precision: pct(best.length - badBest.length, best.length), best_link_wrong: badBest };
}

async function scoreAll(H, log) {
  const audit = await scoreAudit(H, log);
  const links = await scoreLinks(H, log);
  return { audit_findings: audit, spam_labels: links, generated_at: new Date().toISOString().slice(0, 10) };
}

module.exports = { scoreAll, scoreAudit, scoreLinks, auditSite, linkLedger, readJson, FINDINGS, LINKS };

// direct run: print every emitted finding with its label, so a new case can be added
if (require.main === module) (async () => {
  const H = require('../harness');
  H.begin('accuracy report');
  const labelOf = (site, key) => (FINDINGS.cases.find(c => c.site === site && c.finding === key) || {}).label || 'NO LABEL';
  const r = await scoreAll(H, (m) => console.log(m));
  for (const [site, v] of Object.entries(r.audit_findings.per_site)) {
    console.log('\n===== ' + site + ' (health ' + v.health + ', ' + v.emitted + ' findings) =====');
    for (const k of v.findings) console.log('  [' + labelOf(site, k) + '] ' + k + '  ::  ' + JSON.stringify(((FINDINGS.cases.find(c => c.site === site && c.finding === k) || {}).reason || '').slice(0, 60)));
    console.log('  what works: ' + v.what_works.length);
    for (const w of v.what_works) console.log('    + ' + w);
  }
  console.log('\n===== spam labels =====');
  for (const t of LINKS.targets) { const { byDomain } = await linkLedger(H, t.target);
    for (const c of LINKS.cases.filter(x => x.target === t.target)) { const row = byDomain.get(c.ref_domain) || {}; console.log('  ' + t.target + ' ← ' + c.ref_domain + ' | label ' + c.label + ' | link_type "' + (row.link_type || '') + '" | seo ' + row.seo_value + ' | ' + String(row.note || '').slice(0, 70)); } }
  console.log('\n' + JSON.stringify({ audit: { precision: r.audit_findings.precision, recall: r.audit_findings.recall, tp: r.audit_findings.tp, fp: r.audit_findings.fp, fn: r.audit_findings.fn, tn: r.audit_findings.tn, unlabelled: r.audit_findings.unlabelled }, links: { precision: r.spam_labels.precision, recall: r.spam_labels.recall, tp: r.spam_labels.tp, fp: r.spam_labels.fp, fn: r.spam_labels.fn, tn: r.spam_labels.tn } }, null, 1));
  for (const w of [...r.audit_findings.wrong, ...r.spam_labels.wrong]) console.log('  WRONG: ' + w);
})();
