// AIR (2026-11-06, docs/ai-ranking-2026-11-05/CONTRACTS.md §8): a small, deterministic executor of a GENERATED workflow (workflows/*.json), for
// the AIR golden test and package P4's shadow / on scenarios. It walks the real graph from the trigger the way n8n's v1 order does (depth first,
// children top to bottom, a Merge waits for its inputs), runs every Code node's real jsCode under the harness's sandbox rules (no URL, no
// structuredClone, Object.defineProperty / setPrototypeOf as no-ops), evaluates IF / Set / expressions, and answers Data Table, HTTP and AI-agent
// nodes from an in-memory store and the caller's responders. The clock is pinned (`now`) and Math.random is seeded, so the same workflow on the
// same fixture gives byte-identical outputs.
//
// exec({ wf, trigger, tables, http, agent, now, seed, execId, maxSteps }) -> { order, runs, writes, posts, errors, tables }
//   wf        the workflow object (one element of workflows/<file>.json)
//   trigger   the trigger item json (Manual Run)                       tables  { <table>: [rows] } (copied; writes change the copy)
//   http(node, req) -> response json  (req: { url, method, body, headers, text, item }); for text / full-response nodes return { statusCode, headers, data }
//   agent(node, item) -> the agent's `output` value
//   order     node names in the order they ran (a name once per run)    runs  { node: [[items of output 0], [output 1], ...] per run }
//   writes    [{ node, table, op, rows }] every Data Table write           posts [{ node, url, body }] every HTTP POST
//   errors    [{ node, error }] errors of nodes WITHOUT onError continueRegularOutput (they stop their branch, as in n8n)
const SANDBOX_NOOP = new Set(['defineProperty', 'defineProperties', 'setPrototypeOf']);
const SANDBOX_OBJECT = new Proxy(Object, { get: (t, k) => SANDBOX_NOOP.has(k) ? ((o) => o) : t[k] });
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const SYSTEM_COLS = ['id', 'createdAt', 'updatedAt'];

async function exec(opt) {
  const o = opt || {}; const wf = o.wf; const nowMs = typeof o.now === 'number' ? o.now : Date.parse(o.now);
  if (!wf || !Array.isArray(wf.nodes)) throw new Error('air_graph_exec: no workflow');
  const RealDate = Date;
  const PD = class extends RealDate { constructor(...a) { if (!a.length) super(nowMs); else super(...a); } static now() { return nowMs; } };
  let seedState = 0; { const t = String(o.seed == null ? 'air' : o.seed); let h = 2166136261 >>> 0; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } seedState = h || 1; }
  const M = Object.create(Math); M.random = () => { seedState = (seedState + 0x6D2B79F5) >>> 0; let t = seedState; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const nodes = new Map(wf.nodes.map(n => [n.name, n])); const conns = wf.connections || {};
  const tables = JSON.parse(JSON.stringify(o.tables || {})); const ids = {};
  const order = [], runs = {}, writes = [], posts = [], errors = [], staticData = {};
  const execId = String(o.execId || 'air-exec');
  const pos = (name) => { const n = nodes.get(name); return n && Array.isArray(n.position) ? n.position : [0, 0]; };
  const childrenOf = (name, idx) => (((conns[name] || {}).main || [])[idx] || []).filter(c => nodes.has(c.node));
  const inputsOf = (name) => { const s = new Set(); for (const [a, outs] of Object.entries(conns)) for (const br of ((outs || {}).main || [])) for (const c of (br || [])) if (c.node === name) s.add(c.index || 0); return [...s].sort(); };
  const lastOut = (name, out = 0) => { const r = runs[name]; if (!r || !r.length) throw new Error('Referenced node "' + name + '" has no data in this run'); return r[r.length - 1][out] || []; };
  const accessor = (arr, idx) => ({ all: () => arr, first: () => arr[0], last: () => arr[arr.length - 1], get item() { return arr[Math.min(idx || 0, Math.max(0, arr.length - 1))]; }, get json() { return arr[0] && arr[0].json; } });
  const $of = (idx) => (name) => { if (!nodes.has(name)) throw new Error('Referenced node "' + name + '" does not exist'); return accessor(lastOut(name), idx); };
  const $node = new Proxy({}, { get: (t, k) => ({ name: String(k), runIndex: (runs[String(k)] || []).length - 1 }) });
  const toItems = (out) => (Array.isArray(out) ? out : out == null ? [] : [out]).map(x => (x && typeof x === 'object' && 'json' in x) ? x : { json: x });
  // an n8n expression: '=...{{ js }}...' ; a string that is only '={{ js }}' keeps the value's type
  const evalExpr = (v, ctx) => {
    if (typeof v !== 'string' || v.charAt(0) !== '=') return v;
    const body = v.slice(1); const one = body.match(/^\{\{([\s\S]*)\}\}$/);
    const run1 = (js) => new Function('$json', '$', '$input', '$execution', '$workflow', '$now', '$today', '$node', 'Date', 'Math', 'URL', 'structuredClone', 'return (' + js + ');')
      (ctx.json, ctx.$, ctx.$input, { id: execId }, { id: wf.id || 'wf', name: wf.name || '' }, new PD(), new PD(new PD().toISOString().slice(0, 10)), $node, PD, M, undefined, undefined);
    if (one && body.indexOf('{{', 2) < 0) return run1(one[1]);
    return body.replace(/\{\{([\s\S]*?)\}\}/g, (m, js) => { const x = run1(js); return x == null ? '' : typeof x === 'object' ? JSON.stringify(x) : String(x); });
  };
  const ctxFor = (items, i) => ({ json: (items[i] || {}).json || {}, $: $of(i), $input: accessor(items, i) });
  const evalDeep = (v, ctx) => Array.isArray(v) ? v.map(x => evalDeep(x, ctx)) : (v && typeof v === 'object') ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, evalDeep(x, ctx)])) : evalExpr(v, ctx);
  // ---- Data Tables (in memory) ----
  const tbl = (name) => (tables[name] = tables[name] || []);
  const tableOf = (p) => String(((p.dataTableId || {}).value) || p.tableName || '');
  const condOk = (row, c, ctx) => { const k = c.keyName; const cond = String(c.condition || 'eq'); const want = evalExpr(c.keyValue, ctx); const v = row[k];
    const cmp = (a, b) => (typeof a === 'number' && typeof b === 'number') ? a - b : String(a == null ? '' : a).localeCompare(String(b == null ? '' : b));
    switch (cond) { case 'eq': return String(v == null ? '' : v) === String(want == null ? '' : want); case 'neq': return String(v == null ? '' : v) !== String(want == null ? '' : want);
      case 'gt': return v != null && v !== '' && cmp(v, want) > 0; case 'gte': return v != null && v !== '' && cmp(v, want) >= 0; case 'lt': return v != null && v !== '' && cmp(v, want) < 0; case 'lte': return v != null && v !== '' && cmp(v, want) <= 0;
      case 'isTrue': return v === true || v === 'true'; case 'isFalse': return v === false || v === 'false'; case 'isEmpty': return v == null || v === ''; case 'isNotEmpty': return !(v == null || v === '');
      default: return true; } };
  const match = (row, p, ctx) => { const cs = ((p.filters || {}).conditions) || []; if (!cs.length) return true; const all = p.matchType !== 'anyCondition'; return all ? cs.every(c => condOk(row, c, ctx)) : cs.some(c => condOk(row, c, ctx)); };
  const stamp = (t, row) => { ids[t] = (ids[t] || (tbl(t).reduce((m, r) => Math.max(m, Number(r.id) || 0), 0))) + 1; const at = new PD().toISOString(); return { id: ids[t], ...row, createdAt: at, updatedAt: at }; };
  const dataFor = (p, item, ctx) => { if (((p.columns || {}).mappingMode) === 'defineBelow') return evalDeep((p.columns || {}).value || {}, ctx); const d = { ...(item.json || {}) }; for (const c of SYSTEM_COLS) delete d[c]; return d; };
  const dataTable = (n, items) => { const p = n.parameters || {}; const t = tableOf(p); const res = p.resource || 'row'; const op = p.operation;
    if (res === 'table') return [items.map(() => ({ json: { id: 'dt_' + t, name: t } }))];
    if (op === 'get') { const ctx = ctxFor(items, 0); const rows = tbl(t).filter(r => match(r, p, ctx)).map(r => ({ json: { ...r } })); return [rows]; }
    const out = []; const wrote = [];
    items.forEach((it, i) => { const ctx = ctxFor(items, i); const d = dataFor(p, it, ctx);
      if (op === 'insert') { const r = stamp(t, d); tbl(t).push(r); wrote.push(d); out.push({ json: r }); }
      else if (op === 'upsert') { const hit = tbl(t).filter(r => match(r, p, ctx)); if (hit.length) hit.forEach(r => { Object.assign(r, d, { updatedAt: new PD().toISOString() }); out.push({ json: { ...r } }); }); else { const r = stamp(t, d); tbl(t).push(r); out.push({ json: r }); } wrote.push(d); }
      else if (op === 'update') { const hit = tbl(t).filter(r => match(r, p, ctx)); hit.forEach(r => { Object.assign(r, d, { updatedAt: new PD().toISOString() }); out.push({ json: { ...r } }); }); wrote.push(d); }
      else if (op === 'deleteRows') { const keep = tbl(t).filter(r => !match(r, p, ctx)); const gone = tbl(t).length - keep.length; tables[t] = keep; wrote.push({ deleted: gone }); out.push({ json: { deleted: gone } }); }
      else throw new Error('air_graph_exec: Data Table operation ' + op + ' not supported'); });
    writes.push({ node: n.name, table: t, op, rows: wrote }); return [out]; };
  // ---- the other node types ----
  const truthy = (v) => v === true || (typeof v === 'string' ? !/^(false|0|)$/i.test(v.trim()) : !!v);
  const ifNode = (n, items) => { const p = n.parameters || {}; const cs = ((p.conditions || {}).conditions) || []; const all = ((p.conditions || {}).combinator || 'and') === 'and'; const t = [], f = [];
    items.forEach((it, i) => { const ctx = ctxFor(items, i); const res = cs.map(c => { const v = evalExpr(c.leftValue, ctx); const op = (c.operator || {}); const w = evalExpr(c.rightValue, ctx);
        if (op.type === 'boolean') return op.operation === 'false' ? !truthy(v) : truthy(v);
        if (op.operation === 'equals') return String(v) === String(w); if (op.operation === 'notEquals') return String(v) !== String(w);
        if (op.operation === 'exists' || op.operation === 'notEmpty') return !(v == null || v === ''); if (op.operation === 'empty' || op.operation === 'notExists') return v == null || v === '';
        if (op.operation === 'gt') return Number(v) > Number(w); if (op.operation === 'lt') return Number(v) < Number(w);
        throw new Error('air_graph_exec: IF operator ' + JSON.stringify(op) + ' not supported'); });
      ((all ? res.every(Boolean) : res.some(Boolean)) ? t : f).push(it); });
    return [t, f]; };
  const codeNode = async (n, items) => { const p = n.parameters || {}; const src = p.jsCode || '';
    const fn = new AsyncFunction('$input', '$', '$runIndex', '$getWorkflowStaticData', '$now', '$execution', '$workflow', '$json', '$node', 'URL', 'Object', 'structuredClone', 'Date', 'Math', 'require', src);
    const thisArg = { helpers: { getBinaryDataBuffer: async () => { throw new Error('no binary in air_graph_exec'); }, httpRequest: async (r) => { throw new Error('no network in air_graph_exec: ' + String((r && r.url) || '')); } } };
    if (p.mode === 'runOnceForEachItem') { const out = []; for (let i = 0; i < items.length; i++) { const r = await fn.call(thisArg, accessor(items, i), $of(i), (runs[n.name] || []).length, () => staticData, new PD(), { id: execId }, { id: wf.id || 'wf', name: wf.name || '' }, items[i].json, $node, undefined, SANDBOX_OBJECT, undefined, PD, M, undefined); out.push(...toItems(r)); } return [out]; }
    const r = await fn.call(thisArg, accessor(items, 0), $of(0), (runs[n.name] || []).length, () => staticData, new PD(), { id: execId }, { id: wf.id || 'wf', name: wf.name || '' }, (items[0] || {}).json, $node, undefined, SANDBOX_OBJECT, undefined, PD, M, undefined);
    return [toItems(r)]; };
  const httpNode = async (n, items) => { const p = n.parameters || {}; const resp = ((p.options || {}).response || {}).response || {}; const text = resp.responseFormat === 'text' || !!resp.fullResponse; const out = [];
    for (let i = 0; i < items.length; i++) { const ctx = ctxFor(items, i); const url = String(evalExpr(p.url, ctx) || ''); const method = String(p.method || 'GET').toUpperCase();
      let body = null; if (p.sendBody) { const raw = evalExpr(p.jsonBody, ctx); try { body = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { body = raw; } }
      const headers = Object.fromEntries((((p.headerParameters || {}).parameters) || []).map(h => [h.name, evalExpr(h.value, ctx)]));
      if (method === 'POST') posts.push({ node: n.name, url, body });
      const r = typeof o.http === 'function' ? await o.http(n.name, { url, method, body, headers, text, item: items[i].json }) : undefined;
      out.push({ json: r === undefined ? (text ? { statusCode: 404, headers: {}, data: '' } : {}) : r }); }
    return [out]; };
  const setNode = (n, items) => { const p = n.parameters || {}; const as = (((p.assignments || {}).assignments) || []);
    return [items.map((it, i) => { const ctx = ctxFor(items, i); const base = p.includeOtherFields === false ? {} : { ...(it.json || {}) }; for (const a of as) base[a.name] = evalExpr(a.value, ctx); return { json: base }; })]; };
  const agentNode = async (n, items) => [await Promise.all(items.map(async (it) => ({ json: { output: typeof o.agent === 'function' ? await o.agent(n.name, it.json) : {} } })))];
  const runType = async (n, items, inputs) => {
    const t = n.type;
    if (t === 'n8n-nodes-base.code') return codeNode(n, items);
    if (t === 'n8n-nodes-base.if') return ifNode(n, items);
    if (t === 'n8n-nodes-base.dataTable') return dataTable(n, items);
    if (t === 'n8n-nodes-base.httpRequest') return httpNode(n, items);
    if (t === 'n8n-nodes-base.set') return setNode(n, items);
    if (t === 'n8n-nodes-base.merge') return [[...(inputs[0] || []), ...(inputs[1] || []), ...(inputs[2] || [])]];
    if (t === 'n8n-nodes-base.noOp' || t === 'n8n-nodes-base.emailSend' || t === 'n8n-nodes-base.executeWorkflow') { if (t !== 'n8n-nodes-base.noOp') posts.push({ node: n.name, url: t, body: items.map(i => i.json) }); return [items]; }
    if (t === '@n8n/n8n-nodes-langchain.agent') return agentNode(n, items);
    throw new Error('air_graph_exec: node type ' + t + ' not supported (' + n.name + ')'); };
  // ---- the walk ----
  const waiting = new Map();   // merge node -> { index: items }
  const stack = [];
  const startName = (wf.nodes.find(n => /Trigger$/i.test(n.type) || n.type === 'n8n-nodes-base.executeWorkflowTrigger') || {}).name;
  if (!startName) throw new Error('air_graph_exec: no trigger node');
  const runOne = async (name, items, inputs) => {
    const n = nodes.get(name); let use = items; if (n.executeOnce) use = items.slice(0, 1);
    let outs;
    if (n.type === 'n8n-nodes-base.executeWorkflowTrigger') outs = [items];
    else { try { outs = await runType(n, use, inputs || {}); }
      catch (e) { const msg = String((e && e.message) || e);
        if (n.onError === 'continueRegularOutput' || n.onError === 'continueErrorOutput') outs = [[{ json: { error: msg } }]];
        else { errors.push({ node: name, error: msg }); order.push(name); (runs[name] = runs[name] || []).push([]); return; } } }
    if (n.alwaysOutputData && !(outs[0] || []).length) outs[0] = [{ json: {} }];
    order.push(name); (runs[name] = runs[name] || []).push(outs);
    const next = [];
    outs.forEach((arr, idx) => { if (!arr || !arr.length) return; for (const c of childrenOf(name, idx)) next.push({ node: c.node, index: c.index || 0, items: arr }); });
    next.sort((a, b) => (pos(a.node)[1] - pos(b.node)[1]) || (pos(a.node)[0] - pos(b.node)[0]));
    for (let i = next.length - 1; i >= 0; i--) stack.push(next[i]); };
  {
    const steps = Math.max(100, Number(o.maxSteps) || 5000); let k = 0;
    await runOne(startName, toItems([o.trigger || {}]));
    while (true) {
      while (stack.length) { if (++k > steps) throw new Error('air_graph_exec: more than ' + steps + ' steps (a loop?)');
        const s = stack.pop(); const n = nodes.get(s.node);
        if (n.type === 'n8n-nodes-base.merge') { const w = waiting.get(s.node) || {}; w[s.index] = [...(w[s.index] || []), ...s.items]; waiting.set(s.node, w);
          const need = inputsOf(s.node); if (need.every(i => w[i])) { waiting.delete(s.node); await runOne(s.node, [], w); } continue; }
        await runOne(s.node, s.items); }
      // a Merge whose other input never came runs with what it has (n8n v1 runs waiting nodes at the end)
      const first = [...waiting.keys()].sort()[0]; if (!first) break;
      const w = waiting.get(first); waiting.delete(first); await runOne(first, [], w);
    }
  }
  return { order, runs, writes, posts, errors, tables };
}
module.exports = { exec };
