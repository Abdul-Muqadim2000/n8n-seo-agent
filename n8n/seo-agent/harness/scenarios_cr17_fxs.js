// CR17FXS1-CR17FXS2 (FX-SERVER, CR17 review fixes 2026-11-18): synthetic domains and rows, no personal data.
//   FXS1 (review R3 M2, build section 201): Track my site clears the competitors / brand names the client emptied in the app (clear_lists), and
//        keeps them when the request leaves them out (an API caller): Monitor Row (Track) over a stored row.
//   FXS2 (review R5 M5, build section 200): a website whose engine site id another domain also holds is deleted with purge_ids: false: every
//        delete of the route keyed only by the site id leaves the other website's rows, the rows that name this domain (and its own site row) go.
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, run, store, guard, reset, begin } = ctx;
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const sid = (d) => 'site_' + d.replace(/[^a-z0-9]+/g, '-');

  await guard('CR17FXS1 Track my site clears an emptied list in the engine too', async () => {
    const SN = 'CR17FXS1 (review R3 M2, section 201) Track my site: a list the client emptied is stored empty (clear_lists), a list the request left out is kept, a list given replaces'; begin(SN); const check = mkCheck(SN);
    const D = 'northwind-erp.example';
    const stored = { site_id: sid(D), domain: D, competitors: 'rival-one.example, rival-two.example', brand_names: 'Northwind, Northwind ERP', ai_engines: 'chatgpt', ai_prompts_max: 20 };
    const track = async (ni) => { reset(); store['Normalize Input'] = [{ json: { mode: 'track', domain: D, request_id: 'fxs1', competitors: [], monitor_input: {}, ...ni } }];
      store['Load Monitors (Track)'] = [{ json: { ...stored } }]; return (await run('Monitor Row (Track)', store['Load Monitors (Track)']))[0].json; };
    const cleared = await track({ clear_lists: ['competitors', 'brand_names'], monitor_input: { brand_names: '' } });
    check('both lists emptied by the client: stored empty', cleared.competitors === '' && cleared.brand_names === '', J({ c: cleared.competitors, b: cleared.brand_names }));
    const onlyComp = await track({ clear_lists: ['competitors'] });
    check('only the competitors emptied: the brand names are kept', onlyComp.competitors === '' && onlyComp.brand_names === stored.brand_names, J({ c: onlyComp.competitors, b: onlyComp.brand_names }));
    const kept = await track({});
    check('a request that leaves both out (no clear_lists): both kept, as before', kept.competitors === stored.competitors && kept.brand_names === stored.brand_names, J({ c: kept.competitors, b: kept.brand_names }));
    const given = await track({ competitors: ['new-rival.example'], clear_lists: ['brand_names'], monitor_input: { brand_names: 'Northwind Trading' } });
    check('a list given replaces the stored one, even next to a clear of the other key', given.competitors === 'new-rival.example' && given.brand_names === 'Northwind Trading', J({ c: given.competitors, b: given.brand_names }));
    const spaced = await track({ monitor_input: { brand_names: ' ' } });
    check('a blank brand list is stored blank, never as a space', spaced.brand_names === '', J(spaced.brand_names));
  });

  await guard('CR17FXS2 a delete never removes another website\'s rows keyed by a shared engine id', async () => {
    const SN = 'CR17FXS2 (review R5 M5, section 200) the Site Admin delete with purge_ids: false (another domain holds the engine id): id-keyed rows stay, the domain\'s rows and its own site row go'; begin(SN); const check = mkCheck(SN);
    const WF = path.join(__dirname, '..', 'workflows', 'SEO_Agent_Site_Admin.json');
    const raw = JSON.parse(fs.readFileSync(WF, 'utf8')); const wf = Array.isArray(raw) ? raw[0] : raw;
    const byName = Object.fromEntries(wf.nodes.map(n => [n.name, n])); const conn = wf.connections || {};
    const next = (n, out = 0) => (((conn[n] || {}).main || [])[out] || []).map(t => t.node);
    const evalExpr = (v, a) => { const s = String(v); const m = s.match(/^=?\{\{([\s\S]*)\}\}$/); if (!m) return s.replace(/^=/, ''); const $ = () => ({ first: () => ({ json: a }) }); return new Function('$', 'return (' + m[1] + ');')($); };
    const match = (row, p, a) => { const hits = p.filters.conditions.map(c => c.condition === 'eq' && String(row[c.keyName] ?? '') === String(evalExpr(c.keyValue, a) ?? '')); return p.matchType === 'anyCondition' ? hits.some(Boolean) : hits.every(Boolean); };
    const exec = (st, a) => { let cur = 'Delete Cycle (Admin)'; let g = 0; while (cur && cur !== 'Admin Result' && g++ < 200) { const nd = byName[cur]; let out = 0;
      if (nd.type === 'n8n-nodes-base.if') out = evalExpr(nd.parameters.conditions.conditions[0].leftValue, a) === true ? 0 : 1;
      else if (nd.parameters.operation === 'deleteRows') { const t = nd.parameters.dataTableId.value; st[t] = (st[t] || []).filter(r => !match(r, nd.parameters, a)); }
      cur = next(cur, out)[0]; } };
    // my-site.example (being deleted) and my.site.example (another company) share the engine id site_my-site-example
    const MINE = 'my-site.example', OTHER = 'my.site.example', ID = sid(MINE);
    const fixture = () => ({
      seo_sites: [{ tag: 'mine', site_id: ID, domain: MINE }, { tag: 'other', site_id: ID + '-2', domain: OTHER }],
      seo_cycles: [{ tag: 'other', site_id: ID, domain: OTHER }],
      seo_cycle_jobs: [{ tag: 'shared', site_id: ID }],
      seo_pages: [{ tag: 'shared', site_id: ID }],
      seo_index_history: [{ tag: 'shared', site_id: ID }],
      seo_rank_history: [{ tag: 'mine', domain: MINE, ladder_id: 'lad_1' }, { tag: 'shared', domain: '', ladder_id: ID }, { tag: 'other', domain: OTHER, ladder_id: 'lad_2' }],
      seo_cache: [{ tag: 'shared', site_id: ID, kind: 'ki', key: 'ki:x' }, { tag: 'mine', site_id: MINE, kind: 'idem', key: 'idem:1' }],
      seo_ki_runs: [{ tag: 'shared', site_id: ID }],
      seo_content_log: [{ tag: 'mine', domain: MINE }, { tag: 'other', domain: OTHER }],
      seo_ladders: [{ tag: 'mine', domain: 'www.' + MINE }, { tag: 'other', domain: OTHER }],
    });
    reset();
    const a = (await run('Admin Action', { headers: {}, body: { action: 'delete', domain: MINE, site_id: ID, purge_ids: false, request_id: 'app-delete-fxs2' } }))[0].json;
    check('Admin Action: the domain is vouched, the id-keyed deletes get a value no row holds', a.purge_domain === MINE && a.purge_ids === false && a.purge_id !== ID && !!a.purge_id && a.site_id === ID, J({ d: a.purge_domain, ids: a.purge_ids, id: a.purge_id }));
    const st = fixture(); exec(st, a);
    const left = (tag) => Object.entries(st).flatMap(([t, rows]) => rows.filter(r => r.tag === tag).map(r => t));
    check('every row that names my-site.example went (its own site row too)', !left('mine').length, J(left('mine')));
    check('every row keyed only by the shared id is still there (another website may own it)', J(left('shared').sort()) === J(Object.entries(fixture()).flatMap(([t, rows]) => rows.filter(r => r.tag === 'shared').map(() => t)).sort()), J(left('shared')));
    check('the other website\'s rows are untouched', left('other').length === 5, J(left('other')));
    const b = (await run('Admin Action', { headers: {}, body: { action: 'delete', domain: MINE, site_id: ID, request_id: 'app-delete-fxs2b' } }))[0].json;
    check('without the flag (the id is the website\'s own): purge_id is the site id, as before', b.purge_ids === true && b.purge_id === ID, J({ ids: b.purge_ids, id: b.purge_id }));
    const st2 = fixture(); exec(st2, b);
    check('then the id-keyed rows go with it', !Object.values(st2).some(rows => rows.some(r => r.tag === 'shared')), J(Object.entries(st2).filter(([, rows]) => rows.some(r => r.tag === 'shared')).map(([t]) => t)));
    const c = (await run('Admin Action', { headers: {}, body: { action: 'delete', site_id: ID, purge_ids: 'false' } }))[0].json;
    const st3 = fixture(); exec(st3, c);
    const lost3 = Object.entries(fixture()).filter(([t, rows]) => (st3[t] || []).length !== rows.length).map(([t]) => t);
    check('a delete by id only with purge_ids "false": no domain is vouched and nothing keyed by the id or a domain goes', c.purge_domain === '' && !lost3.length, J({ id: c.purge_id, d: c.purge_domain, lost: lost3 }));
    for (const n of ['Delete Cycle (Admin)', 'Delete Cycle Jobs (Admin)', 'Delete KI Runs (Admin)', 'Delete Site'])
      check(n + ' matches the site id through purge_id', byName[n].parameters.filters.conditions.filter(x => x.keyName === 'site_id').every(x => /json\.purge_id\b/.test(x.keyValue)));
  });
};
