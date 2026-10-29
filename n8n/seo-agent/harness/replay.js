// Replay of recorded production node runs (page-quality programme 2026-10-29, PLAN §3.0 step 4; REVIEW_CODE M9).
// A replay fixture (harness/fixtures/replay_*.json.gz, anonymised) holds, for each node of a chain and each of its runs: the input items
// it received, the run of every node its code reads with $('...') that had run before it (by start time, as n8n resolves it), and the
// output it produced in production. `replay(fx, node, run)` mocks exactly those nodes (and removes any other mock of a node the code
// reads, so a $('X') that threw in production throws here too), runs the CURRENT generated code on the recorded input and returns
// { out, recorded }. Every repeated subtree is stored once ({"$ref": n} -> fx.strings[n], which may hold refs itself); `load` puts them back. The
// hydrated parts are shared, so everything handed to a node is cloned first (a node that mutates its input cannot leak into another run).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
module.exports = (H) => {
  const load = (file) => {
    const p = path.isAbsolute(file) ? file : path.join(__dirname, 'fixtures', file);
    const raw = fs.readFileSync(p);
    const fx = JSON.parse((p.endsWith('.gz') ? zlib.gunzipSync(raw) : raw).toString('utf8'));
    const S = fx.strings || [], done = new Map();
    const hydrate = (v) => {
      if (Array.isArray(v)) return v.map(hydrate);
      if (v && typeof v === 'object') {
        if (Object.keys(v).length === 1 && typeof v.$ref === 'number') {
          if (!done.has(v.$ref)) done.set(v.$ref, hydrate(S[v.$ref]));
          return done.get(v.$ref);
        }
        const o = {}; for (const k of Object.keys(v)) o[k] = hydrate(v[k]); return o;
      }
      return v;
    };
    const out = hydrate({ ...fx, strings: undefined });
    delete out.strings;
    return out;
  };
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const nodeItems = (fx, name, run) => { const n = fx.nodes[name]; const r = n && n[String(run)]; return r ? clone(r.items) : null; };
  // the code file a node's code reads $('...') from; every name it reads is cleared first, then the recorded runs are mocked
  const readsOf = (code) => { try { const src = fs.readFileSync(path.join(process.env.CODE_DIR || path.join(__dirname, 'code_v4'), code + '.js'), 'utf8');
    return [...new Set([...src.matchAll(/\$\('([^']+)'\)/g)].map(m => m[1]))]; } catch (e) { return []; } };
  const prepare = (fx, node, run, opts = {}) => {
    const rec = fx.runs[node] && fx.runs[node][run];
    if (!rec) throw new Error('replay: no recorded run ' + node + '#' + run + ' in execution ' + fx.execution);
    for (const r of readsOf(rec.code)) if (r !== node) delete H.store[r];
    for (const [name, idx] of Object.entries(rec.mocks)) { const it = nodeItems(fx, name, idx); if (it) H.mock(name, it); }
    for (const [name, items] of Object.entries(opts.mocks || {})) { if (items === null) delete H.store[name]; else H.mock(name, items); }
    return rec;
  };
  const replay = async (fx, node, run = 0, opts = {}) => {
    const rec = prepare(fx, node, run, opts);
    const input = opts.input ? opts.input : clone(rec.input);
    const out = await H.run(node, input, { code: rec.code, runIndex: opts.runIndex == null ? run : opts.runIndex });
    return { out, first: out[0] && out[0].json, recorded: clone(rec.output), recordedFirst: rec.output[0] && clone(rec.output[0].json), input };
  };
  return { load, replay, prepare, nodeItems };
};
