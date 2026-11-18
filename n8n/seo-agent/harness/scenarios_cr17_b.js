// CR17B1-CR17B4 (client report 2026-11-17, C1; build section 200): a deleted website takes its whole engine history with it.
// Site Admin `delete` now runs one delete node per table of ladder_common.SITE_PURGE behind a gate (Admin Action vouches for the domain: named
// by the caller and its engine id is the site id). The chain is EXECUTED here over an in-memory copy of every table, with rows of the website,
// its www. form, a domain it is a suffix of (mydevaicon.com), a domain that starts with it (devaicon.com.au) and global rows: only the website's
// rows may go. Synthetic domains and rows; no personal data.
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, run, guard, reset, begin } = ctx;
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const WF = path.join(__dirname, '..', 'workflows', 'SEO_Agent_Site_Admin.json');
  const wfRaw = JSON.parse(fs.readFileSync(WF, 'utf8'));
  const wf = Array.isArray(wfRaw) ? wfRaw[0] : wfRaw;
  const byName = Object.fromEntries(wf.nodes.map(n => [n.name, n]));
  const conn = wf.connections || {};
  const next = (n, out = 0) => (((conn[n] || {}).main || [])[out] || []).map(t => t.node);
  const sid = (d) => 'site_' + d.replace(/[^a-z0-9]+/g, '-');
  // an n8n expression of this chain: "={{ <js> }}" over $('Admin Action').first().json only
  const evalExpr = (v, admin) => { const s = String(v); const m = s.match(/^=?\{\{([\s\S]*)\}\}$/) || s.match(/^=\{\{([\s\S]*)\}\}$/);
    if (!m) return s.replace(/^=/, ''); const $ = () => ({ first: () => ({ json: admin }) });
    return new Function('$', 'return (' + m[1] + ');')($); };
  const admin = async (body) => { reset(); return (await run('Admin Action', { headers: {}, body }))[0].json; };
  // the purge nodes and their tables, read off the generated workflow
  const purgeNodes = () => { const out = []; let cur = next('Purge History? (Admin)', 0);
    while (cur.length && cur[0] !== 'Delete Site') { out.push(cur[0]); cur = next(cur[0]); } return out; };
  const tableOf = (n) => byName[n].parameters.dataTableId.value;
  // every table the delete route touches, with fixture rows: the website (bare + www.), two look-alike domains, and global rows
  const D = 'devaicon.com', LOOK = ['mydevaicon.com', 'devaicon.com.au'];
  const tablesTouched = () => { const t = new Set(); const walk = (n, seen) => { if (!n || seen.has(n)) return; seen.add(n); const p = (byName[n] || {}).parameters || {};
    if (p.operation === 'deleteRows') t.add(p.dataTableId.value); for (const o of ((conn[n] || {}).main || [])) for (const x of o) walk(x.node, seen); };
    walk('Delete Cycle (Admin)', new Set()); return [...t]; };
  const keyCols = (t) => { const cols = new Set(); for (const n of wf.nodes) { const p = n.parameters || {}; if (p.operation === 'deleteRows' && p.dataTableId.value === t) for (const c of p.filters.conditions) cols.add(c.keyName); } return [...cols]; };
  const fixture = () => { const store = {};
    for (const t of tablesTouched()) { const cols = keyCols(t); const rows = [];
      const add = (dom, tag) => { const r = { tag, domain: dom, site_id: sid(dom.replace(/^www\./, '')), ladder_id: sid(dom.replace(/^www\./, '')) };
        for (const c of cols) if (!(c in r)) r[c] = ''; rows.push(r); };
      add(D, 'own'); add('www.' + D, 'own'); for (const x of LOOK) { add(x, 'other'); add('www.' + x, 'other'); }
      if (t === 'seo_cache') { rows.push({ tag: 'own', site_id: D, kind: 'idem', key: 'idem:keyword:1' }); rows.push({ tag: 'own', site_id: 'www.' + D, kind: 'idem', key: 'idem:keyword:2' });
        rows.push({ tag: 'other', site_id: LOOK[0], kind: 'idem', key: 'idem:keyword:3' }); rows.push({ tag: 'global', site_id: '', kind: 'serp', key: 'serp:x|2784|en|desktop' });
        rows.push({ tag: 'own', site_id: sid(D), kind: 'ki', key: 'ki:x' }); }
      if (t === 'seo_rank_history') rows.push({ tag: 'own', domain: '', ladder_id: sid(D), site_id: '' });   // a Site Tracker live check keyed by the site id
      if (t === 'seo_run_ledger') rows.push({ tag: 'kept', domain: D });
      store[t] = rows; }
    return store; };
  const match = (row, p, a) => { const cs = p.filters.conditions.map(c => ({ col: c.keyName, op: c.condition, val: evalExpr(c.keyValue, a) }));
    const hits = cs.map(c => c.op === 'eq' && String(row[c.col] ?? '') === String(c.val ?? '') && (c.col !== 'kind' || true));
    return p.matchType === 'anyCondition' ? hits.some(Boolean) : hits.every(Boolean); };
  // run the delete route: Delete Cycle .. KI .. the gate .. the purge chain .. Delete Site, each node once (executeOnce)
  const execDelete = (store, a) => { const done = []; let cur = 'Delete Cycle (Admin)'; let guardN = 0;
    while (cur && cur !== 'Admin Result' && guardN++ < 200) { const nd = byName[cur]; let out = 0;
      if (nd.type === 'n8n-nodes-base.if') { const c = nd.parameters.conditions.conditions[0]; out = evalExpr(c.leftValue, a) === true ? 0 : 1; }
      else if (nd.parameters.operation === 'deleteRows') { const t = nd.parameters.dataTableId.value; const before = (store[t] || []).length;
        store[t] = (store[t] || []).filter(r => !match(r, nd.parameters, a)); done.push([cur, before - store[t].length]); }
      cur = next(cur, out)[0]; }
    return done; };

  await guard('CR17B1 Admin Action vouches for the purge domain', async () => {
    const SN = 'CR17B1 (client report 2026-11-17, C1) Admin Action vouches for the domain whose engine history a delete purges: named by the caller, and its engine id is the site id'; begin(SN); const check = mkCheck(SN);
    const a = await admin({ action: 'delete', domain: 'https://www.DevAicon.com/', site_id: sid(D), request_id: 'app-delete-1' });
    check('delete with the domain and its id: purge_domain is the bare domain', a.purge_domain === D && a.site_id === sid(D), J(a));
    const b = await admin({ action: 'delete', site_id: sid(D) });
    check('delete with the site id only: no purge (a domain read back from an id can be another website: site_my-site-com)', b.purge_domain === '', J(b));
    const c = await admin({ action: 'delete', domain: 'mydevaicon.com', site_id: sid(D) });
    check('delete whose domain and id disagree: no purge', c.purge_domain === '', J(c));
    const d = await admin({ action: 'pause', domain: D });
    check('any other action: no purge', d.purge_domain === '', J(d));
    const e = await admin({ action: 'delete', domain: D });
    check('delete with the domain only: the id is derived from it, so the domain is vouched', e.purge_domain === D && e.site_id === sid(D), J(e));
  });

  await guard('CR17B2 the delete chain purges every history table of the website and nothing else', async () => {
    const SN = 'CR17B2 (client report 2026-11-17, C1) the Site Admin delete chain, executed over every table: the website and its www. form go, mydevaicon.com / devaicon.com.au / global rows stay'; begin(SN); const check = mkCheck(SN);
    const nodes = purgeNodes();
    check('the purge chain has one node per history table (49 + the site row last)', nodes.length === 49 && new Set(nodes.map(tableOf)).size === 49 && next(nodes[nodes.length - 1])[0] === 'Delete Site', J({ n: nodes.length }));
    check('the gate leads to Delete Site when the domain is not vouched', J(next('Purge History? (Admin)', 1)) === J(['Delete Site']));
    const a = await admin({ action: 'delete', domain: D, site_id: sid(D), request_id: 'app-delete-2' });
    const store = fixture(); const done = execDelete(store, a);
    const left = Object.entries(store).flatMap(([t, rows]) => rows.filter(r => r.tag === 'own').map(r => t + ':' + (r.domain ?? r.site_id)));
    check('no row of the website is left in any table (bare, www., site id, idempotency keys)', !left.length, J(left.slice(0, 20)));
    const lost = Object.entries(store).map(([t, rows]) => [t, rows.filter(r => r.tag !== 'own').length]);
    const want = Object.fromEntries(Object.keys(store).map(t => [t, fixture()[t].filter(r => r.tag !== 'own').length]));
    const diff = lost.filter(([t, n]) => n !== want[t]);
    check('every row of mydevaicon.com, devaicon.com.au (and their www.) and every global row is still there', !diff.length, J(diff));
    check('the purge reached every history table (seo_profiles, seo_link_outreach, seo_query_history, seo_console_alerts among them)',
      ['seo_profiles', 'seo_link_outreach', 'seo_query_history', 'seo_console_alerts', 'seo_link_prospects', 'seo_rank_history', 'seo_backlinks', 'seo_audits', 'seo_page_watch', 'seo_ai_rank_sources']
        .every(t => done.some(([n, k]) => tableOf(n) === t && k > 0)), J(done.filter(([, k]) => !k).map(([n]) => n)));
    check('the run ledger (cost records) is not touched', !wf.nodes.some(n => (n.parameters || {}).operation === 'deleteRows' && n.parameters.dataTableId.value === 'seo_run_ledger'));
    const site = done.find(([n]) => n === 'Delete Site');
    check('the site row goes last, so Admin Result still counts it', site && site[1] >= 1 && done[done.length - 1][0] === 'Delete Site', J(done.slice(-2)));
  });

  await guard('CR17B3 a delete by site id only keeps the history (nothing is guessed)', async () => {
    const SN = 'CR17B3 (client report 2026-11-17, C1) a delete that names no domain removes what it always removed (site row, cycle, KI) and purges nothing else'; begin(SN); const check = mkCheck(SN);
    const a = await admin({ action: 'delete', site_id: sid(D) });
    const store = fixture(); execDelete(store, a);
    const kept = ['seo_profiles', 'seo_link_outreach', 'seo_query_history', 'seo_ladders'].every(t => store[t].some(r => r.tag === 'own'));
    check('the history tables keep the website rows', kept);
    check('the site row and the cycle still go', !store.seo_sites.some(r => r.tag === 'own' && r.domain === D) && !store.seo_cycles.some(r => r.tag === 'own' && r.domain === D));
    check('look-alike domains untouched', store.seo_sites.filter(r => r.tag === 'other').length === 4);
  });

  await guard('CR17B4 the app list equals the engine chain', async () => {
    const SN = 'CR17B4 (client report 2026-11-17, C1) app/shared/src/engine-purge.generated.ts lists exactly the tables and keys the Site Admin chain purges (one list, ladder_common.SITE_PURGE)'; begin(SN); const check = mkCheck(SN);
    const p = path.join(__dirname, '..', '..', '..', 'app', 'shared', 'src', 'engine-purge.generated.ts');
    let ts = ''; try { ts = fs.readFileSync(p, 'utf8'); } catch (e) { check('the app list is readable', false, p); return; }
    const app = {}; for (const m of ts.matchAll(/\{ table: "([a-z_]+)", keys: \[(.*?)\] \}/g)) app[m[1]] = [...m[2].matchAll(/column: "([a-z_]+)", kind: "(domain|id)"/g)].map(x => x[1] + ':' + x[2]).sort();
    const want = { domain: ["={{ $('Admin Action').first().json.purge_domain }}", "={{ 'www.' + $('Admin Action').first().json.purge_domain }}"], id: ["={{ $('Admin Action').first().json.purge_id }}"] };   // FX-SERVER (review R5 M5): the id-keyed deletes match purge_id
    const eng = {}; for (const n of purgeNodes()) { const p2 = byName[n].parameters; const keys = new Set();
      for (const c of p2.filters.conditions) for (const k of ['domain', 'id']) if (want[k].includes(c.keyValue)) keys.add(c.keyName + ':' + k);
      eng[tableOf(n)] = [...keys].sort(); }
    const appNoSite = Object.fromEntries(Object.entries(app).filter(([t]) => t !== 'seo_sites'));
    check('same tables, same keys', J(Object.keys(appNoSite).sort()) === J(Object.keys(eng).sort()) && Object.keys(eng).every(t => J(eng[t]) === J(appNoSite[t])),
      J({ onlyApp: Object.keys(appNoSite).filter(t => !eng[t]), onlyEngine: Object.keys(eng).filter(t => !appNoSite[t]), differ: Object.keys(eng).filter(t => appNoSite[t] && J(eng[t]) !== J(appNoSite[t])) }));
    check('the site row is in the app list (the engine deletes it last, by Delete Site)', !!app.seo_sites);
    check('the kept tables are named with a reason', /seo_run_ledger": "cost record/.test(ts) && /seo_google_events/.test(ts) && /seo_ops_alerts/.test(ts) && /seo_ai_rank_priors/.test(ts));
  });
};
