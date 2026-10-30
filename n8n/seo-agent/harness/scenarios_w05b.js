// W05B1-W05B5 (page-quality wave 0.5, agent W05-B, 2026-10-30; docs/page-quality-2026-10-29/BEFORE_AFTER.md "Holds", headline item 4,
// Next items 1 and 4). What the blind before / after run found in the hold and the page matcher, on anonymised fixtures:
//   * K4 ("dynamics 365 partner dubai") was written onto ANOTHER service page's address (/dynamics-365-project-operations-uae, matched by its
//     address alone, its title not on file) and the hold waved it through as "a refresh of a page your website already has";
//   * K1 ("ms 365 erp") silently improved the page the site has for the search: the client was not told, "Improve the existing page" was
//     not offered;
//   * the hold line at 50 sat inside the verdict's own noise (one keyword read 52, 42, then 46), the written run re-read the verdict and moved
//     it after the client's OK, and the recommended targets were a headline ("verify an ASP in 5 minutes") and a slash form ("Dubai/UAE").
// Called from scenarios_v5.js (one line). Every check runs the GENERATED code (harness/code_v4).
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const R = require('./replay')(H);
  const CD = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const PLAIN = /[—–…‘’“”]|\.\.\./;
  const smSrc = fs.readFileSync(path.join(CD, '_site_model.js'), 'utf8');
  const a0 = smSrc.indexOf('const SM = (() => {'), b0 = smSrc.indexOf('\n})();', a0);
  const SM = new Function(smSrc.slice(a0, b0 + 6) + '\nreturn SM;')();

  // an anonymised Dynamics partner site shaped like client A's inventory: half the pages have no title on file (R34), the product words
  // "dynamics" and "365" are on most addresses
  const D = 'novaand.example'; const W = 'https://www.' + D;
  const PO = W + '/dynamics-365-project-operations-uae', ERP = W + '/ms-365-erp-uae', FO = W + '/dynamics-365-finance-and-operations-uae';
  const PAGES = [
    { url: W, title: 'Novaand | Turning technology into business impact', h1: 'Value driven innovation', queries: [] },
    { url: W + '/whatwedo', title: 'What We Do | Novaand', h1: 'What We Do', queries: [] },
    { url: W + '/capabilities/business-applications', title: 'Business Applications | Novaand', h1: 'Capabilities', queries: [] },
    { url: PO, title: '', h1: '', queries: [{ query: 'dynamics 365 project operations', impressions: 14 }, { query: 'd365 operations uae', impressions: 35 }, { query: 'project operations uae', impressions: 3 }] },
    { url: ERP, title: '', h1: '', queries: [] },
    { url: FO, title: '', h1: '', queries: [{ query: 'd365 finance and operations uae', impressions: 9 }] },
    { url: W + '/dynamics-365-business-central-uae', title: '', h1: '', queries: [] },
    { url: W + '/dynamics-365-crm-uae', title: '', h1: '', queries: [] },
    { url: W + '/dynamics-ax-to-d365-upgrade-uae', title: '', h1: '', queries: [] },
    { url: W + '/dynamics-365-cloud-migration-uae', title: '', h1: '', queries: [] },
    { url: W + '/business-central-implementation-uae', title: '', h1: '', queries: [] },
    { url: W + '/insights/is-microsoft-dynamics-365-an-erp-system', title: 'Is Microsoft Dynamics 365 an ERP System?', h1: 'Is Microsoft Dynamics 365 an ERP System?', queries: [] }];
  const MODEL = { site_id: 'site_novaand-example', domain: D, canonical_host: 'www.' + D, business_name: 'Novaand', brand_names: ['Novaand'], services: ['Dynamics 365 Finance', 'Dynamics 365 Business Central', 'AI consulting'], pages: PAGES };

  // ---------- W05B1 the kit: a page is THE page for a search only by its own words ----------
  await guard('W05B1 confirmPage', async () => {
    const SN = 'W05B1 (W05-B, K4) SM.confirmPage: the title, the main heading or a Search Console search must be about the search; an address alone never is';
    begin(SN); const check = mkCheck(SN);
    const po = PAGES.find(p => p.url === PO);
    const k4 = SM.confirmPage(MODEL, po, 'dynamics 365 partner dubai', { texts: [{ text: 'Dynamics 365 Project Operations Implementation UAE | Novaand', by: 'its title as read now' }, { text: 'Dynamics 365 Project Operations in UAE', by: 'its main heading as read now' }] });
    console.log('   K4 ->', J(k4));
    check('K4: the Project Operations page is not the page for "dynamics 365 partner dubai" (its title adds "project" and "operations")', k4.ok === false && /project/.test(k4.why) && /not the page for it/.test(k4.why) && !PLAIN.test(k4.why), J(k4));
    const bare = SM.confirmPage(MODEL, { url: PO }, 'dynamics 365 partner dubai', {});
    check('an address with no title, heading or search on file: never confirmed, and said so', bare.ok === false && /address alone/.test(bare.why), J(bare));
    const k1 = SM.confirmPage(MODEL, PAGES.find(p => p.url === ERP), 'ms 365 erp', { texts: [{ text: 'MS 365 ERP in the UAE: Dynamics 365 Partner | Novaand', by: 'its title as read now' }] });
    check('K1: "MS 365 ERP in the UAE: Dynamics 365 Partner" is the page for "ms 365 erp"', k1.ok === true && /its title as read now/.test(k1.evidence), J(k1));
    const r35 = SM.confirmPage(MODEL, { url: FO, title: 'Dynamics 365 Finance and Operations Partner in UAE' }, 'd365 finance dubai', {});
    check('R35 kept: "d365 finance dubai" is answered by "Dynamics 365 Finance and Operations Partner in UAE" (short names written out, an emirate inside the UAE)', r35.ok === true, J(r35));
    const kind = SM.confirmPage(MODEL, { url: W + '/dynamics-365-partner-dubai', title: 'Dynamics 365 Partner in Dubai | Implementation and Support' }, 'dynamics 365 partner dubai', {});
    check('the kind of service a title adds ("implementation", "support") does not count against it', kind.ok === true, J(kind));
    const q = SM.confirmPage(MODEL, { url: PO, queries: [{ query: 'dynamics 365 partner dubai', impressions: 6 }] }, 'dynamics 365 partner dubai', {});
    check('a Search Console search it earns impressions for confirms it', q.ok === true && /Search Console/.test(q.by), J(q));
    const q0 = SM.confirmPage(MODEL, { url: PO, queries: [{ query: 'dynamics 365 partner dubai', impressions: 0 }] }, 'dynamics 365 partner dubai', {});
    check('a search with no impressions does not', q0.ok === false, J(q0));
    const poq = SM.confirmPage(MODEL, po, 'dynamics 365 partner dubai', {});
    check('the page\'s own searches ("dynamics 365 project operations", "d365 operations uae": a third of their weight is "operations") are about something else too', poq.ok === false, J(poq));
    const g = SM.confirmPage(MODEL, PAGES[PAGES.length - 1], 'is microsoft dynamics 365 an erp system', {});
    check('the ranking guide\'s own page is confirmed for its own search', g.ok === true, J(g));
  });

  // ---------- W05B2 Collect Client Pages: a page matched by its address is read, not rewritten ----------
  const CTX = (over) => ({ mode: 'keyword', keyword: 'dynamics 365 partner dubai', domain: D, existing_page: null, existing_page_url: '', site_model: MODEL,
    internal_link_candidates: [{ url: W + '/', path: '/' }], site_urls: PAGES.map(p => p.url), site_urls_count: PAGES.length, ...(over || {}) });
  const html = (title, h1, para) => '<!doctype html><html lang="en"><head><title>' + title + '</title></head><body><header><nav><a href="/">Home</a></nav></header><main><h1>' + h1 + '</h1><p>'
    + para.repeat(30) + '</p><p><a href="/contact-us">Book a consultation</a></p></main><footer>Novaand, Dubai</footer></body></html>';
  const md = (t, h, s) => 'Title: ' + t + '\n\nURL Source: x\n\nMarkdown Content:\n# ' + h + '\n\n' + s.repeat(8);
  const collect = async (ctx0, reqs, pages) => {
    reset();
    for (const k of ['Client Render Plan', 'Render Client Pages', 'Client Render More', 'Render More Client Pages']) delete store[k];
    mock('Site Model', [{ json: { site_model: MODEL } }]);
    mock('Collect Site URLs', [{ json: ctx0 }]); mock('Client Page Requests', reqs.map(r => ({ json: r })));
    mock('Read Client Pages', pages.map(p => ({ json: { page_text: md(p.title, p.h1, p.para) } })));
    mock('Read Client Page HTML', pages.map(p => ({ json: { page_html: html(p.title, p.h1, p.para) } })));
    return (await run('Collect Client Pages', store['Read Client Page HTML']))[0].json;
  };
  const PO_PAGE = { title: 'Dynamics 365 Project Operations Implementation UAE | Novaand', h1: 'Dynamics 365 Project Operations in UAE', para: 'Project Operations brings quotes, contracts, estimates and project billing into one Dynamics 365 app for UAE project companies. ' };
  const HOME = { title: 'Novaand | Turning technology into business impact', h1: 'Value driven innovation', para: 'Novaand is a Microsoft partner in Dubai for Dynamics 365, AI and automation. ' };
  await guard('W05B2 Collect Client Pages', async () => {
    const SN = 'W05B2 (W05-B, K4 / K1) Collect Client Pages: a page matched by its address is confirmed by its own title first; not confirmed, a new page is written and the report says why';
    begin(SN); const check = mkCheck(SN);
    // K4 as it ran: the inventory matched the untitled Project Operations page by its address
    const k4req = [{ url: PO, kind: 'existing', existing_page: { url: PO, title: '', match: 0.75, matched_by: 'slug', source: 'page inventory' } }, { url: W + '/', kind: 'home' }];
    const k4 = await collect(CTX(), k4req, [PO_PAGE, HOME]);
    console.log('   K4 ->', J({ existing: k4.existing_page, url: k4.existing_page_url, unconfirmed: k4.existing_page_unconfirmed, kinds: (k4.client_pages || []).map(p => p.kind) }));
    check('K4: not this run\'s page: existing_page null, existing_page_url empty (no refresh exemption downstream)', k4.existing_page === null && k4.existing_page_url === '', J({ e: k4.existing_page, u: k4.existing_page_url }));
    check('K4: the reason is kept for the report (its title is about Project Operations)', !!k4.existing_page_unconfirmed && k4.existing_page_unconfirmed.url === PO && /project/.test(k4.existing_page_unconfirmed.why) && !PLAIN.test(k4.existing_page_unconfirmed.note), J(k4.existing_page_unconfirmed));
    check('K4: the page is still read, as a related page; its text is not "the page to improve"', (k4.client_pages || []).some(p => p.url === PO && p.kind === 'related') && k4.existing_page_text === '' && k4.existing_page_digest === null, J((k4.client_pages || []).map(p => [p.kind, p.url])));
    // K1: the sitemap matched /ms-365-erp-uae by its address; its title read now is about the search
    const ERP_PAGE = { title: 'MS 365 ERP in the UAE: Dynamics 365 Partner | Novaand', h1: 'MS 365 ERP for UAE Businesses', para: 'Microsoft 365 is not an ERP; the ERP is Dynamics 365 Business Central or Finance. ' };
    const k1 = await collect(CTX({ keyword: 'ms 365 erp', existing_page: { url: ERP, match: 0.75, source: 'sitemap' } }), [{ url: ERP, kind: 'existing' }, { url: W + '/', kind: 'home' }], [ERP_PAGE, HOME]);
    check('K1: confirmed by its title read now, with the title kept and the evidence', !!k1.existing_page && k1.existing_page.url === ERP && /MS 365 ERP in the UAE/.test(k1.existing_page.title) && /title/.test(k1.existing_page.confirmed_by) && !k1.existing_page_unconfirmed
      && k1.existing_page_text.length > 100, J({ e: k1.existing_page, u: k1.existing_page_unconfirmed }));
    // the page's HTML could not be read: the reader's own title line is the title read now
    reset(); for (const k of ['Client Render Plan', 'Render Client Pages', 'Client Render More', 'Render More Client Pages']) delete store[k];
    mock('Site Model', [{ json: { site_model: MODEL } }]);
    const k1c = CTX({ keyword: 'ms 365 erp', existing_page: { url: ERP, match: 0.75, source: 'sitemap' } });
    mock('Collect Site URLs', [{ json: k1c }]); mock('Client Page Requests', [{ json: { url: ERP, kind: 'existing' } }, { json: { url: W + '/', kind: 'home' } }]);
    mock('Read Client Pages', [ERP_PAGE, HOME].map(p => ({ json: { page_text: md(p.title, p.h1, p.para) } })));
    mock('Read Client Page HTML', [{ json: { error: { message: 'timeout' } } }, { json: { error: { message: 'timeout' } } }]);
    const k1r = (await run('Collect Client Pages', store['Read Client Page HTML']))[0].json;
    check('no HTML: the reader\'s title line confirms it', !!k1r.existing_page && k1r.existing_page.url === ERP && /its title/.test(k1r.existing_page.confirmed_by), J({ e: k1r.existing_page, u: k1r.existing_page_unconfirmed }));
    // a page the client named: never second-guessed, the output exactly as before (no new field)
    const named = await collect(CTX({ existing_page: { url: PO, match: 1, source: 'provided' }, existing_page_url: PO }), [{ url: PO, kind: 'existing' }, { url: W + '/', kind: 'home' }], [PO_PAGE, HOME]);
    check('a page the client named ("Improve the existing page"): kept as the page, nothing added', named.existing_page && named.existing_page.url === PO && named.existing_page_url === PO && !('existing_page_unconfirmed' in named), J({ e: named.existing_page, u: named.existing_page_unconfirmed }));
  });

  // ---------- W05B3 Client Page Requests: "Write it anyway" on a found page writes a separate page ----------
  await guard('W05B3 write it anyway', async () => {
    const SN = 'W05B3 (W05-B, K1, D2) Client Page Requests: after "Write it anyway" a page the run FOUND is read as related and left alone; a NAMED page is still the page';
    begin(SN); const check = mkCheck(SN);
    const base = CTX({ keyword: 'ms 365 erp', existing_page: { url: ERP, match: 0.75, source: 'sitemap' } });
    reset(); mock('Site Model', [{ json: { site_model: MODEL } }]);
    const plain = (await run('Client Page Requests', [{ json: base }])).map(r => r.json);
    check('without the OK: the found page is read as the existing page (and the run is asked first, W05B4)', plain[0].kind === 'existing' && plain[0].url === ERP && !plain[0].ignored_existing, J(plain[0]));
    reset(); mock('Site Model', [{ json: { site_model: MODEL } }]);
    const ack = (await run('Client Page Requests', [{ json: { ...base, hold_ack: { score: 52 } } }])).map(r => r.json);
    check('with the OK: read as a related page, ignored_existing says the client chose a separate page', ack[0].kind === 'related' && ack[0].url === ERP && !!ack[0].ignored_existing && /Write it anyway/.test(ack[0].ignored_existing.why) && !ack[0].ignored_existing.planned_url, J(ack[0]));
    reset(); mock('Site Model', [{ json: { site_model: MODEL } }]);
    const named = (await run('Client Page Requests', [{ json: { ...base, existing_page: { url: ERP, match: 1, source: 'provided' }, existing_page_url: ERP, hold_ack: { score: 52 } } }])).map(r => r.json);
    check('a named page with an OK: still the page to improve', named[0].kind === 'existing' && named[0].url === ERP && !named[0].ignored_existing, J(named[0]));
  });

  // ---------- W05B4 Parse Verdict: the hold ----------
  const F = R.load('replay_3299.json.gz');
  const PB = F.nodes['Parse Brief']['0'].items[0].json;
  const PREV = (() => { const p = clone(PB); for (const k of ['verdict_hold', 'would_hold', 'hold', 'hold_shadow', 'hold_ack', 'verdict_acknowledged', 'duplicate_check', 'verdict_readings']) delete p[k]; p.client_ip = 'app:0b1c2d3e-anon'; return p; })();
  const AGENT = { verdict: PB.verdict, score: PB.verdict_score, reasons: PB.verdict_reasons, risks: PB.verdict_risks, what_must_change: PB.verdict_changes,
    secondary_keywords: PB.secondary_keywords, recommended_page: 'Service Page', expected_monthly_visits_top3: 1, time_to_rank_months: 7 };
  const pv = async (over, agentOver) => {
    reset();
    mock('Merge Keyword Data', [{ json: { ...PREV, ...(over || {}) } }]);
    mock('Load Site Cache', [{ json: {} }]);
    return (await run('Parse Verdict', [{ json: { output: { ...AGENT, ...(agentOver || {}) } } }]))[0].json;
  };
  const SITE0 = { site_model: { ...PB.site_model, pages: [] } };   // no inventory: no duplicate, no Search Console reading
  await guard('W05B4 hold', async () => {
    const SN = 'W05B4 (W05-B, K4 / K1 / K3 / K2 / K5) Parse Verdict: only a NAMED page is a refresh; a FOUND page is asked about; the score line outside the noise; the acknowledged reading kept; real searches only';
    begin(SN); const check = mkCheck(SN);
    // K4 as it ran (before the matcher fix): a page the inventory found, set as existing_page_url by Collect Client Pages, score 58
    const k4 = await pv({ ...SITE0, keyword: 'dynamics 365 partner dubai', existing_page: { url: PO, title: '', match: 0.75, matched_by: 'slug', source: 'page inventory' }, existing_page_url: PO }, { score: 58 });
    check('a page the run FOUND is not "a refresh of a page your website already has": no exemption', !/refresh/.test(k4.hold_exempt), J(k4.hold_exempt));
    check('a person started it: held for the client\'s OK, "Improve the existing page" first', k4.verdict_hold === true && J(k4.hold.kinds) === J(['duplicate']) && k4.hold.alternatives[0].kind === 'improve' && k4.hold.alternatives[0].url === PO
      && /rewrite that page at its own address/.test(k4.hold.reasons.join(' ')) && /a new address of its own/.test(k4.hold.reasons.join(' ')) && /Write it anyway/.test(k4.hold.reasons.join(' ')), J(k4.hold));
    const k4a = await pv({ ...SITE0, keyword: 'dynamics 365 partner dubai', client_ip: 'cadence:site_novaand-example', force_content: true, existing_page: { url: PO, title: '', source: 'page inventory' }, existing_page_url: PO }, { score: 58 });
    check('started automatically: only logged (shadow), written as before', k4a.verdict_hold === false && k4a.would_hold === true && k4a.hold_mode === 'shadow' && !!k4a.hold_shadow, J({ h: k4a.verdict_hold, w: k4a.would_hold }));
    // K4 after the matcher fix: Collect Client Pages left the page alone and said why
    const k4u = await pv({ ...SITE0, keyword: 'dynamics 365 partner dubai', existing_page: null, existing_page_url: '', existing_page_unconfirmed: { url: PO, why: 'its title "Dynamics 365 Project Operations Implementation UAE" is about "project" and "operation", not this search, so ' + PO.replace(W, '') + ' is not the page for it' } }, { score: 58 });
    check('K4 now: a new page, not held at 58, and the brief and the report say the other page is left as it is', k4u.verdict_hold === false && k4u.would_hold === false && /^Write this as a new page at its own address\. /.test(k4u.verdict_changes[0]) && k4u.verdict_changes[0].includes(PO)
      && k4u.existing_page_action === null, J({ h: k4u.verdict_hold, c: k4u.verdict_changes[0] }));
    // a NAMED page ("Improve the existing page"): still a refresh, never held for its score
    const named = await pv({ ...SITE0, existing_page: { url: ERP, match: 1, source: 'provided' }, existing_page_url: ERP }, { score: 35 });
    check('a NAMED page: the refresh exemption stands, not held at 35', named.verdict_hold === false && named.would_hold === false && /refresh/.test(named.hold_exempt), J({ h: named.verdict_hold, e: named.hold_exempt }));
    // K1: the sitemap found /ms-365-erp-uae and the matcher confirmed it; score 52 (above the line): asked first anyway
    const k1 = await pv({ ...SITE0, existing_page: { url: ERP, title: 'MS 365 ERP in the UAE: Dynamics 365 Partner', match: 0.75, source: 'sitemap', confirmed_by: 'its title is about this search' }, existing_page_url: '' }, { score: 52 });
    console.log('   K1 ->', J({ h: k1.verdict_hold, kinds: (k1.hold || {}).kinds, alts: ((k1.hold || {}).alternatives || []).map(a => a.kind + ':' + (a.url || a.keyword)) }));
    check('K1: the found page is no longer improved silently: held, the page named with its title, "Improve the existing page" first', k1.verdict_hold === true && J(k1.hold.kinds) === J(['duplicate']) && k1.hold.duplicates[0].url === ERP
      && /MS 365 ERP in the UAE/.test(k1.hold.reasons.join(' ')) && k1.hold.alternatives[0].kind === 'improve' && k1.hold.alternatives[0].url === ERP && !PLAIN.test(k1.hold.reasons.join(' ') + k1.hold.rule), J(k1.hold));
    const k1ack = await pv({ ...SITE0, existing_page: null, existing_page_url: '', existing_page_ignored: { url: ERP, why: 'you chose "Write it anyway"' }, hold_ack: { score: 52 } }, { score: 52 });
    check('K1 "Write it anyway": written as a separate page, the brief told to leave the found page as it is', k1ack.verdict_hold === false && k1ack.verdict_acknowledged === true && /^Write this as a separate new page/.test(k1ack.verdict_changes[0]), J(k1ack.verdict_changes[0]));
    // the page Google shows for the search (Search Console impressions) is offered too
    const gModel = { ...PB.site_model, pages: [{ url: W + '/insights/is-microsoft-dynamics-365-an-erp-system', title: 'Is Microsoft Dynamics 365 an ERP System?', h1: '', queries: [{ query: 'ms 365 erp', impressions: 40 }] }] };
    const k1g = await pv({ site_model: gModel, existing_page: { url: ERP, title: 'MS 365 ERP in the UAE', source: 'sitemap' }, existing_page_url: '' }, { score: 52 });
    check('the page Google shows for the search is offered beside it, with its impressions', k1g.verdict_hold === true && k1g.hold.alternatives.some(a => a.label === 'Improve the page Google shows' && /is-microsoft-dynamics-365-an-erp-system/.test(a.url))
      && /Google already shows/.test(k1g.hold.reasons.join(' ')), J(k1g.hold && k1g.hold.alternatives));
    // the score line (K3: read 52, 42, 46 on one keyword)
    const vol = (v) => ({ ...SITE0, keyword_data: { ...(PB.keyword_data || {}), search_volume: v } });
    const n46 = await pv(vol(500), { score: 46 });
    check('46 with real demand and no page for it: inside the noise, written (not held), the reading logged', n46.verdict_hold === false && n46.would_hold === false && n46.verdict_readings.band === 'near the line'
      && /no second signal/.test(n46.verdict_readings.decision) && n46.verdict_readings.this_run === 46, J(n46.verdict_readings));
    const n42 = await pv(vol(10), { score: 42 });
    check('42 with under 20 searches a month and no impressions: held, both signals in the reason', n42.verdict_hold === true && J(n42.hold.kinds) === J(['score']) && /little demand/.test(n42.hold.reasons[0]) && n42.verdict_readings.second_signal.low_demand === true, J(n42.hold));
    const n38 = await pv(vol(500), { score: 38 });
    check('38: clearly low, held on its own', n38.verdict_hold === true && /clearly under/.test(n38.hold.reasons[0]) && n38.verdict_readings.band === 'clearly low', J(n38.hold && n38.hold.reasons));
    const nnull = await pv({ ...SITE0, keyword_data: { ...(PB.keyword_data || {}), search_volume: null } }, { score: 45 });
    check('45 with no measured volume: unknown demand is not a signal, written', nnull.verdict_hold === false, J(nnull.verdict_readings));
    const n50 = await pv(vol(5), { score: 50 });
    check('50 is never held for the score', n50.verdict_hold === false, J(n50.verdict_readings));
    // the acknowledged reading is kept (K3: held at 42, the written run read 46)
    const ack = await pv({ ...SITE0, hold_ack: { score: 42 } }, { score: 46 });
    check('after "Write it anyway" at 42, a re-read of 46 does not move the run\'s score: 42 is kept, both readings logged', ack.verdict_score === 42 && ack.verdict_readings.this_run === 46 && ack.verdict_readings.acknowledged === 42
      && /46.*42 is kept/.test(ack.verdict_readings.decision) && ack.verdict_acknowledged === true, J({ s: ack.verdict_score, r: ack.verdict_readings }));
    const ack0 = await pv({ ...SITE0, hold_ack: { score: null } }, { score: 46 });
    check('an OK with no reading on it keeps this run\'s score', ack0.verdict_score === 46, J(ack0.verdict_score));
    // recommended targets are searches people type
    const tgt = await pv(vol(10), { score: 42, what_must_change: ['Retarget to \'verify an ASP in 5 minutes\' and lead with the checklist.', 'Use \'AI development company Dubai/UAE\' as the main search.'], secondary_keywords: [] });
    const rt = (tgt.hold.alternatives.find(a => a.kind === 'retarget') || {}).keyword || '';
    check('K2 / K5: a headline is refused and a slash form is reduced to its first form ("AI development company Dubai")', rt === 'AI development company Dubai', J(tgt.hold.alternatives));
    const tgt2 = await pv(vol(10), { score: 42, what_must_change: ['Lead with \'verify an ASP in 5 minutes\'.'], secondary_keywords: ['how to verify an accredited service provider uae'] });
    const rt2 = (tgt2.hold.alternatives.find(a => a.kind === 'retarget') || {}).keyword || '';
    check('no quoted search passes: the secondary keyword that reads as a search is offered', rt2 === 'how to verify an accredited service provider uae', J(tgt2.hold.alternatives));
    const tgt3 = await pv(vol(10), { score: 42, what_must_change: ['Target \'NetSuite vs Business Central in the UAE\' instead.'], secondary_keywords: [] });
    check('K3: a real comparison search is kept as written', ((tgt3.hold.alternatives.find(a => a.kind === 'retarget') || {}).keyword) === 'NetSuite vs Business Central in the UAE', J(tgt3.hold.alternatives));
  });

  // ---------- W05B5 the callback carries the readings and the page left alone ----------
  await guard('W05B5 callback', async () => {
    const SN = 'W05B5 (W05-B) Build Webhook Response: the verdict readings and the page left alone reach the app';
    begin(SN); const check = mkCheck(SN);
    const o = await pv({ ...SITE0, existing_page: null, existing_page_url: '', existing_page_unconfirmed: { url: PO, why: 'its title is about Project Operations', note: 'Written as a new page at its own address.' } }, { score: 58 });
    reset(); mock('Parse Verdict', [{ json: o }]);
    const cb = (await run('Build Webhook Response', [{ json: { request_id: '9001', keyword: o.keyword, domain: D, verdict: o.verdict, verdict_score: o.verdict_score, score_withheld: false } }]))[0].json;
    check('verdict_readings and existing_page_unconfirmed are in the callback', !!cb.verdict_readings && cb.verdict_readings.this_run === 58 && !!cb.existing_page_unconfirmed && cb.existing_page_unconfirmed.url === PO, J({ r: cb.verdict_readings, u: cb.existing_page_unconfirmed }));
  });
};
