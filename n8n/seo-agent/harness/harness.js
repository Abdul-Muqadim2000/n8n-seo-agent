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
const $ = (name) => { if (!store[name]) throw new Error(`Referenced node "${name}" has no data in this run`); return wrap(store[name]); };

function loadCode(node) {
  // 'legacy:<name>' runs a frozen reference copy from harness/legacy/ (old behaviour to compare against)
  const file = node.startsWith('legacy:') ? path.join(__dirname, 'legacy', node.slice(7) + '.js') : path.join(CODE_DIR, node.replace(/[^A-Za-z0-9_.-]+/g, '_') + '.js');
  return fs.readFileSync(file, 'utf8');
}
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
async function run(node, input, opts = {}) {
  const inputItems = toItems(input === undefined ? results.filter(r => r.ok && r.scenario === scenario).slice(-1)[0].items : input);
  const t0 = Date.now();
  try {
    const src = loadCode(opts.code || node);   // opts.code: run a node from another extracted file (e.g. 'Pulse__AI_Plan': the AI Pulse's node of the same name)
    // 'URL' is shadowed on purpose: the n8n Code sandbox has no URL constructor (live finding 2026-10-02), so any use must fail here too
    const fn = new AsyncFunction('$input', '$', '$runIndex', '$getWorkflowStaticData', '$now', '$execution', '$workflow', '$json', 'URL', src);
    const thisArg = { helpers: { getBinaryDataBuffer: async (i, prop) => { const b = inputItems[i] && inputItems[i].binary && inputItems[i].binary[prop]; if (!b || !b.data) throw new Error('no binary ' + prop); return Buffer.from(b.data, 'base64'); } } };
    const out = await fn.call(thisArg, wrap(inputItems), $, opts.runIndex || 0, () => staticData, new Date(), { id: 'test-exec' }, { id: 'wf', name: 'test' }, inputItems[0] && inputItems[0].json, undefined);
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
function mock(node, items) { store[node] = toItems(items); return store[node]; }
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
