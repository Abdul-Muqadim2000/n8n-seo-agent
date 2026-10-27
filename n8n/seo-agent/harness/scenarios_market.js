// MK1-MK4 (MKT 2026-10-27, docs/mismatch-audit-2026-10-27/AUDIT.md M2 / M4): the website's market, one table and one path.
// Production facts (devaicon.com, 2026-10-23..27): the website's country in the app is Pakistan, but a "Track my site" sent with the United
// Arab Emirates left seo_sites at location 2784, so every weekly job measured the UAE; the ladder keyword "ai automation solutions gcc" passed
// the fit gate as "in your market".
//   MK1  Site Admin `market` (Admin Validate -> Admin Action, the real nodes): a country name or ISO-2 is read from the main workflow's
//        COUNTRIES (Pakistan -> 2586 / en); an unknown country, or none, is refused with the reason.
//   MK2  the generated Site Admin workflow routes `market` to *Set Market*, which updates ONLY country / location_code / language_code of the
//        site row (never rank history), then *Admin Result* counts the row.
//   MK3  the fit gate with the website's market (ctx.market): "ai automation solutions gcc" is another market for Pakistan, "ai automation
//        services in pakistan" and "erp software gcc" for the UAE are not; the client's own chosen keyword is never refused for it; no
//        market = the gate as before.
//   MK4  the discovery and ladder pool nodes hand the gate the website's market (Normalize Input country_iso); the ladder pool only when the
//        main keyword itself is in the market (a client who chose a keyword of another market gets rungs of that market).
// Called from scenarios_v5.js just before the report (one appended line).
module.exports = async (ctx) => {
  const { H, run, reset, begin } = ctx;
  const fs = require('fs');
  const path = require('path');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);

  {
    reset(); const SN = 'MK1 Site Admin market: a country name or code becomes the engine\'s own location code and language; an unknown country is refused'; begin(SN); const check = mkCheck(SN);
    const v = await run('Admin Validate', { body: { action: 'market', domain: 'devaicon.com', country: 'Pakistan' } });
    check('the Admin API accepts market with a country', v[0].json.ok === true, J(v[0].json));
    const vBad = await run('Admin Validate', { body: { action: 'market', domain: 'devaicon.com' } });
    check('the Admin API refuses market without a country, with the reason', !vBad[0].json.ok && /country/.test(vBad[0].json.error), vBad[0].json.error);
    const a = await run('Admin Action', { body: v[0].json.forward });
    const j = a[0].json;
    check('Pakistan -> location 2586, language en, the site id of the domain', j.action === 'market' && j.market_country === 'Pakistan' && j.market_location_code === 2586 && j.market_language_code === 'en' && j.site_id === 'site_devaicon-com', J(j));
    const iso = (await run('Admin Action', { body: { action: 'market', domain: 'devaicon.com', country: 'ae' } }))[0].json;
    check('an ISO-2 code is read too (ae -> United Arab Emirates, 2784)', iso.market_country === 'United Arab Emirates' && iso.market_location_code === 2784, J(iso));
    const err = await H.expectError('Admin Action', { body: { action: 'market', domain: 'devaicon.com', country: 'Atlantis' } }, /country \(one of United States/);
    check('an unknown country is refused with the list of countries', err.ok, err.error);
    const other = (await run('Admin Action', { body: { action: 'pause', domain: 'devaicon.com' } }))[0].json;
    check('other actions carry no market', other.market_country === '' && other.market_location_code === 0, J(other));
  }

  {
    reset(); const SN = 'MK2 the Site Admin workflow: market -> Set Market (site row country / location / language only) -> Admin Result'; begin(SN); const check = mkCheck(SN);
    const wf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', 'SEO_Agent_Site_Admin.json'), 'utf8'));
    const W = Array.isArray(wf) ? wf[0] : wf;
    const node = (n) => W.nodes.find((x) => x.name === n);
    const route = node('Admin Route');
    const rules = route.parameters.rules.values.map((r) => r.outputKey);
    const k = rules.indexOf('market');
    check('Admin Route has a market output', k >= 0, J(rules));
    const out = ((W.connections['Admin Route'] || {}).main || [])[k] || [];
    check('...wired to Set Market', out.length === 1 && out[0].node === 'Set Market', J(out));
    const sm = node('Set Market');
    const vals = J(sm && sm.parameters);
    check('Set Market updates seo_sites by site_id with the three market columns', /seo_sites/.test(vals) && /market_country/.test(vals) && /market_location_code/.test(vals) && /market_language_code/.test(vals) && /site_id/.test(vals), vals.slice(0, 600));
    check('Set Market writes no other column (history and the site\'s other fields stay)', !/"status"|keywords|ga4_property_id|business_facts/.test(J((sm.parameters.columns || {}).value || {})), J((sm.parameters.columns || {}).value || {}));
    const next = ((W.connections['Set Market'] || {}).main || [])[0] || [];
    check('Set Market -> Admin Result', next.length === 1 && next[0].node === 'Admin Result', J(next));
    await run('Admin Action', { body: { action: 'market', domain: 'devaicon.com', country: 'Pakistan' } });
    const r = await run('Admin Result', [{ json: { id: 7, site_id: 'site_devaicon-com', country: 'Pakistan', location_code: 2586 } }]);
    check('Admin Result counts the updated row', r[0].json.affected === 1, J(r[0].json));
  }

  {
    reset(); const SN = 'MK3 the fit gate knows the website\'s market (one gazetteer for the engine and the app)'; begin(SN); const check = mkCheck(SN);
    const gate = async (keyword, c) => (await run('_fit_gate', [{ json: { keyword, ctx: c } }]))[0].json;
    const g1 = await gate('ai automation solutions gcc', { market: 'PK' });
    check('devaicon: "ai automation solutions gcc" for a Pakistan website is another market', g1.ok === false && g1.reason === 'other market' && /"gcc"/.test(g1.detail), J(g1));
    const g2 = await gate('ai automation services in pakistan', { market: 'PK' });
    check('"ai automation services in pakistan" is the market itself', g2.ok === true, J(g2));
    const g3 = await gate('erp software gcc', { market: 'AE' });
    check('"erp software gcc" for a UAE website: the GCC contains the UAE', g3.reason !== 'other market', J(g3));
    const g4 = await gate('ai automation solutions gcc', { market: 'PK', protect: ['ai automation solutions gcc'] });
    check('the keyword the client chose (protected whole) is never refused for its market', g4.reason !== 'other market', J(g4));
    const g5 = await gate('ai automation solutions gcc', {});
    check('no market given: the gate decides as before', g5.reason !== 'other market', J(g5));
    const g6 = await gate('استشارات الذكاء الاصطناعي في دبي', { market: 'PK' });
    check('an Arabic keyword is read through the glossary ("dubai")', g6.ok === false && g6.reason === 'other market', J(g6));
  }

  {
    reset(); const SN = 'MK4 discovery and the ladder pool hand the gate the website\'s market'; begin(SN); const check = mkCheck(SN);
    const CODE = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
    const rk = fs.readFileSync(path.join(CODE, 'Rank_Keywords.js'), 'utf8');
    const lp = fs.readFileSync(path.join(CODE, 'Ladder_Pool.js'), 'utf8');
    check('Rank Keywords passes market (Normalize Input country_iso) to the gate', /market: \(\(\) => \{ try \{ return String\(\$\('Normalize Input'\)\.first\(\)\.json\.country_iso/.test(rk), 'not found');
    check('Ladder Pool passes market only when the main keyword is in it', /return m && fitMarket\(head, m\)\.ok \? m : ''/.test(lp), 'not found');
    check('both inline the kit\'s gazetteer', /const FIT_PLACES_SRC = \[/.test(rk) && /const FIT_PLACES_SRC = \[/.test(lp), 'kit missing');
  }
};
