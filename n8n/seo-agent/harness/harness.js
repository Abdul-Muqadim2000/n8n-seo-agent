// Minimal n8n Code-node executor: runs each node's jsCode with mocked $input / $('Node') / $runIndex / static data.
const fs = require('fs');
const path = require('path');
const CODE_DIR = process.env.CODE_DIR || path.join(__dirname, 'code');
const OUT_DIR = process.env.OUT_DIR || path.join(__dirname, 'out');
fs.mkdirSync(OUT_DIR, { recursive: true });

const store = {};                 // node name -> items
const results = [];               // {scenario, node, ok, ms, error, items}
let scenario = '';
const staticData = {};

const toItems = (arr) => (Array.isArray(arr) ? arr : [arr]).map(x => (x && typeof x === 'object' && ('json' in x)) ? x : { json: x });
const wrap = (arr) => ({
  all: () => arr, first: () => arr[0], last: () => arr[arr.length - 1],
  get item() { return arr[0]; }, get json() { return arr[0] && arr[0].json; }
});
// R38 (2026-10-16): *Check Page Claims* sits between *Parse Analysis* and *Keyword Data*, and *Merge Keyword Data* reads it. A scenario that
// ran *Parse Analysis* and never that node gets the analysis as it was (the check changes nothing when no page digest exists), so the
// older scenarios did not each need a line for a node that is a pass-through for them; S124 runs the real node.
const $ = (name) => { if (!store[name] && name === 'Check Page Claims' && store['Parse Analysis']) return wrap(store['Parse Analysis']); if (!store[name]) throw new Error(`Referenced node "${name}" has no data in this run`); return wrap(store[name]); };

function loadCode(node) {
  // 'legacy:<name>' runs a frozen reference copy from harness/legacy/ (old behaviour to compare against)
  const file = node.startsWith('legacy:') ? path.join(__dirname, 'legacy', node.slice(7) + '.js') : path.join(CODE_DIR, node.replace(/[^A-Za-z0-9_.-]+/g, '_') + '.js');
  return fs.readFileSync(file, 'utf8');
}
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
// P1 (2026-10-20): no page is written before the website's author profile and business facts are on file (v5/code/_readiness.js), read
// by *Cadence Plan* (Load Profiles (Cadence) + the site row's business_facts) and *Ladder Plan* (Load Profile (Model) + the request's or the
// site model's facts). The scenarios written before that rule describe websites ready for written pages and test other rules, so a run of
// either node whose scenario never mocked the profile load gets a READY website for that one run (a complete author, and facts on a site
// row that has no business_facts key), and the store is restored afterwards. A scenario about readiness mocks the profile load itself (an
// empty load included): the shared fixture (KF2) always does, and KF21-KF23 / S-P1 test the hold. Counted in READY_DEFAULTS.
const READY_FACTS = 'Founded in 2012; 40 consultants; certified partner; fixed-price implementation packages from 12 weeks; offices in the region.';
const READY_AUTHOR = { author_name: 'Harness Author', author_job_title: 'Head of delivery', author_bio: 'Leads the delivery team and writes about the services this website sells.' };
const READY_DEFAULTS = { count: 0 };
function readyDefaults(node) {
  const restore = [];
  const keep = (k) => { const had = Object.prototype.hasOwnProperty.call(store, k); restore.push([k, had, store[k]]); };
  if (node === 'Cadence Plan' && !store['Load Profiles (Cadence)']) {
    const sites = (store['Load Sites'] || []).map(i => i.json || {}).filter(s => s && s.site_id);
    keep('Load Profiles (Cadence)'); store['Load Profiles (Cadence)'] = toItems(sites.length ? sites.map(s => ({ site_id: s.site_id, domain: s.domain, ...READY_AUTHOR })) : [{}]);
    if (store['Load Sites']) { keep('Load Sites'); store['Load Sites'] = store['Load Sites'].map(i => ({ ...i, json: i.json && i.json.site_id && !('business_facts' in i.json) ? { ...i.json, business_facts: READY_FACTS } : i.json })); }
    READY_DEFAULTS.count++;
  }
  if (node === 'Ladder Plan' && !store['Load Profile (Model)']) {
    const base = ((store['Parse Verdict'] || [])[0] || {}).json || {};
    const dom = String(base.domain || '').toLowerCase().replace(/^www\./, '');
    keep('Load Profile (Model)'); store['Load Profile (Model)'] = toItems([{ site_id: 'site_' + dom.replace(/[^a-z0-9]+/g, '-'), domain: dom, ...READY_AUTHOR }]);
    const sm = ((store['Site Model'] || [])[0] || {}).json;
    if (!String(base.business_facts || '').trim() && !(sm && sm.site_model && String(sm.site_model.business_facts || '').trim())) {
      keep('Site Model'); store['Site Model'] = toItems([{ ...(sm || {}), site_model: { ...((sm && sm.site_model) || {}), business_facts: READY_FACTS } }]);
    }
    READY_DEFAULTS.count++;
  }
  return () => { for (const [k, had, v] of restore.reverse()) { if (had) store[k] = v; else delete store[k]; } };
}
async function run(node, input, opts = {}) {
  const undoReady = readyDefaults(opts.code || node);
  try { return await runNode(node, input, opts); } finally { undoReady(); }
}
async function runNode(node, input, opts = {}) {
  const inputItems = toItems(input === undefined ? results.filter(r => r.ok && r.scenario === scenario).slice(-1)[0].items : input);
  const t0 = Date.now();
  try {
    const src = loadCode(opts.code || node);   // opts.code: run a node from another extracted file (e.g. 'Pulse__AI_Plan': the AI Pulse's node of the same name)
    // 'URL' is shadowed on purpose: the n8n Code sandbox has no URL constructor (live finding 2026-10-02), so any use must fail here too
    const fn = new AsyncFunction('$input', '$', '$runIndex', '$getWorkflowStaticData', '$now', '$execution', '$workflow', '$json', 'URL', src);
    const thisArg = { helpers: { getBinaryDataBuffer: async (i, prop) => { const b = inputItems[i] && inputItems[i].binary && inputItems[i].binary[prop]; if (!b || !b.data) throw new Error('no binary ' + prop); return Buffer.from(b.data, 'base64'); } } };
    // opts.execId: the execution id n8n would give this run (scenarios_integration.js: every workflow run of a client's life has its own)
    const out = await fn.call(thisArg, wrap(inputItems), $, opts.runIndex || 0, () => staticData, new Date(), { id: String(opts.execId || 'test-exec') }, { id: 'wf', name: 'test' }, inputItems[0] && inputItems[0].json, undefined);
    const items = toItems(out);
    store[node] = items;
    results.push({ scenario, node, ok: true, ms: Date.now() - t0, items });
    return items;
  } catch (e) {
    results.push({ scenario, node, ok: false, ms: Date.now() - t0, error: (e && e.stack || String(e)).split('\n').slice(0, 3).join(' | ') });
    if (opts.expectError) { store[node] = []; return []; }
    throw e;
  }
}
async function expectError(node, input, re, runIndex) {
  try { await run(node, input, { expectError: true, runIndex: runIndex || 0 }); } catch (e) {}
  const r = results[results.length - 1];
  if (r.ok) { r.ok = false; r.error = 'Expected an error but node succeeded'; }
  else if (re && !re.test(r.error)) { r.error = 'Wrong error: ' + r.error; }
  else { r.ok = true; r.error = 'threw as expected: ' + r.error.slice(0, 90); }
  return r;
}
// B-A10 (2026-10-15, INVARIANTS rule 3): every DataForSEO call now sits behind an in-200 retry gate, so the node that used to
// read `X` reads `X Answers` — the merge node. A scenario that mocks the CALL is mocking its first attempt, and with no retry
// mocked the merged answers ARE the first attempt's, so the same items stand in for both. The list of gated calls is the
// build's own (harness/in200.json, written by build section 75), so a call that loses its gate stops being aliased here too,
// and a scenario that wants the gate itself mocks `X Answers` explicitly — which overrides this. S85 runs the real gate nodes
// (plan, merge) against real DataForSEO envelopes, so nothing about the gate rests on this alias.
const GATED = {};
try { const g = require('./in200.json'); for (const wf of Object.values(g)) for (const n of (wf.gated || [])) GATED[n] = true; } catch (e) {}
// F1b (2026-10-23, docs/ai-visibility-2026-10-23/fixes/F1b.md): every stored AI visibility / pulse row now carries the measurement rule it
// was counted under, and a row of another rule is never compared or pooled. The fixtures of S19 ... S211 were written before the rule
// existed and stand for rows of the CURRENT rule, so a fixture row with NO `rule_version` key is stamped with it here (and a pulse row
// gets the per-answer record its aggregates describe). A scenario that wants a row of an older rule says so explicitly
// (`rule_version: ''` or another version): such a row is passed through untouched.
const AIV_RULE = (() => { try { const m = fs.readFileSync(path.join(CODE_DIR, 'AI_Metrics.js'), 'utf8').match(/const RULE_VERSION = '([^']+)'/); return m ? m[1] : ''; } catch (e) { return ''; } })();
const aivSynthDetail = (d) => {
  const P = (v, f) => { try { const x = typeof v === 'string' ? JSON.parse(v || 'null') : v; return x == null ? f : x; } catch (e) { return f; } };
  const eng = P(d.engines_json, {}), codes = P(d.prompts_json, {}), comps = P(d.competitors_json, {});
  const n = Number(d.samples) || 0, m = Number(d.mentioned) || 0, c = Number(d.cited) || 0;
  let units = [];
  for (const [pid, st] of Object.entries(codes || {})) for (const [e, v] of Object.entries(st || {})) if (v !== 'n' && v !== 'e') units.push({ pid, e, named: /[mMcC]/.test(v), cited: /[cC]/.test(v), pos: /[MC]/.test(v) ? 1 : /[mc]/.test(v) ? 2 : null });
  if (units.length !== n) { units = [];
    let per = Object.entries(eng || {}).map(([e, x]) => [e, Number((x || {}).answered) || 0, Number((x || {}).mentioned) || 0, Number((x || {}).cited) || 0]).filter(x => x[1] > 0);
    if (per.reduce((s, x) => s + x[1], 0) !== n || per.reduce((s, x) => s + x[2], 0) !== m) per = [['chatgpt', n, m, c]];
    const pids = Object.keys(codes || {}); let k = 0;
    for (const [e, a, mm, cc] of per) for (let i = 0; i < a; i++) { units.push({ pid: pids.length ? pids[k % pids.length] : 'pq_' + (k % 7), e, named: i < mm, cited: i < Math.min(cc, mm), pos: i < mm ? 2 : null }); k++; } }
  const ents = []; units.forEach(u => { u.r = []; });
  let start = 0; for (const [id, k0] of Object.entries(comps || {})) { const kk = Math.min(Number(k0) || 0, units.length); ents.push(id); for (let i = 0; i < kk; i++) units[(start + i) % units.length].r.push([ents.length - 1, null, 0]); start += kk; }
  return JSON.stringify({ v: 1, rule_version: AIV_RULE, ents, a: units.map(u => [u.pid, u.e, u.named ? 1 : 0, u.cited ? 1 : 0, u.pos, u.r]) });
};
const aivStamp = (node, items) => {
  // a plan item built by hand (scenarios that mock AI Plan): its stored previous row, pooled pulse rows and pulse baseline days
  if (AIV_RULE && node === 'AI Plan') return items.map(it => { const j = it && it.json; if (!j || typeof j !== 'object') return it; const out = { ...j };
    if (j.previous && typeof j.previous === 'object' && !('rule_version' in j.previous)) out.previous = { ...j.previous, rule_version: AIV_RULE };
    if (Array.isArray(j.pulse_rows)) out.pulse_rows = j.pulse_rows.map(d => (!d || ('rule_version' in d)) ? d : { ...d, rule_version: AIV_RULE,
      detail: d.detail || JSON.parse(aivSynthDetail({ samples: d.samples, mentioned: d.mentioned, cited: d.cited, engines_json: d.engines || {}, prompts_json: d.prompts || {}, competitors_json: d.competitors || {} })) });
    if (Array.isArray(j.baseline)) out.baseline = j.baseline.map(d => (!d || ('rule_version' in d)) ? d : { ...d, rule_version: AIV_RULE });
    return { ...it, json: out }; });
  if (!AIV_RULE || (node !== 'Load AI Visibility' && node !== 'Load AI Daily')) return items;
  return items.map(it => { const j = it && it.json; if (!j || typeof j !== 'object' || !j.site_id || ('rule_version' in j)) return it;
    const out = { ...j, rule_version: AIV_RULE }; if (node === 'Load AI Daily' && !out.detail_json) out.detail_json = aivSynthDetail(out); return { ...it, json: out }; });
};
function mock(node, items) {
  store[node] = aivStamp(node, toItems(items));
  // the alias follows EVERY mock of the call, never only the first: S25 mocks `Run Reach Requests` a dozen times in a row with
  // different answers, and a sticky alias would have fed the first one's reach to all twelve.
  if (GATED[node]) store[node + ' Answers'] = store[node];
  return store[node];
}
function begin(name) { scenario = name; console.log('\n########## ' + name + ' ##########'); }
function save(name, content) { fs.writeFileSync(path.join(OUT_DIR, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2)); }
function report() {
  console.log('\n================ RESULTS ================');
  let fail = 0;
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  [${r.scenario}] ${r.node} (${r.ms}ms)` + (r.error ? '\n      ' + r.error : ''));
    if (!r.ok) fail++;
  }
  console.log(`\n${results.length - fail} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;   // CI (.github/workflows/ci.yml) fails on any failed check, not on the printed count alone
  save('_results.json', results.map(r => ({ ...r, items: undefined, count: r.items ? r.items.length : 0 })));
}
// Scan generated HTML for templating defects
function scanHtml(label, html) {
  const issues = [];
  for (const bad of ['undefined', 'NaN', '[object Object]', 'null/100', '>null<', 'N/A/100']) {
    const n = (html.match(new RegExp(bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    if (n) issues.push(`${bad} x${n}`);
  }
  console.log(`   html-scan ${label}: ${html.length} chars` + (issues.length ? ' | DEFECTS: ' + issues.join(', ') : ' | clean'));
  return issues;
}
module.exports = { run, mock, begin, report, save, expectError, store, results, toItems, scanHtml, staticData };
