// CR1-CR6 (client reports 2026-11-10, devaicon.com on production; docs/client-reports-2026-11-10/README.md; build_v4.py section 184).
// The cases are the production ones (public addresses and the second read's own words; no personal data).
//   CR1  the verify kit: an update published at a new address is verified once the old address permanently redirects there (301 / 308,
//        absolute or relative Location); a temporary redirect, a redirect elsewhere or an unread old address keep "another address"; a
//        home page is never "the page it updates" for a move
//   CR2  Publish Check end to end: the old address read without redirects verifies the move and clears the "marked on your word" note; the
//        title "Banking &amp; Financial Services Technology | Devaicon" uses the keyword "banking & financial services technology"
//   CR3  DUP: a page aimed at another market's search ("AI Automation Services in Pakistan") is not the duplicate of a UAE page; the same
//        page IS the duplicate for a Pakistan run; a keyword naming another place keeps the old rule; a GCC page is in the UAE market
//   CR4  the second read: of the eight real findings that held devaicon's pages at 59, the five that say the page states something
//        unsupported still block, the three that say something is missing elsewhere are advice (RR.errorOf on the read, RR.textError on the
//        stored blocker text, the same answer)
module.exports = async (ctx) => {
  const { H, run, mock, reset, begin, guard } = ctx;
  const fs = require('fs');
  const path = require('path');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const V5 = path.join(__dirname, '..', 'v5', 'code');
  const SRC = (f) => fs.readFileSync(path.join(V5, f), 'utf8');
  const verifyPublished = new Function(SRC('_publish_verify.js') + '\nreturn verifyPublished;')();
  // DUP exactly as the build inlines it (kit_src.py): the fit gate's gazetteer in place of the marker
  const places = (SRC('_fit_gate.js').match(/const FIT_PLACES_SRC = (\[[\s\S]*?\]\]);/) || [])[1];
  const DUP = new Function(SRC('_dup_targets.js').replace('/*__FIT_PLACES_SRC__*/[]', places) + '\nreturn DUP;')();
  const RR = new Function(SRC('_critic_reread.js') + '\nreturn RR;')();
  const D = 'https://devaicon.com';

  await guard('CR1 verify kit', async () => {
    reset(); const SN = 'CR1 (2026-11-10) an update published at a new address is verified once the old address permanently redirects there; a home page is never asked to move'; begin(SN); const check = mkCheck(SN);
    const log = { domain: 'devaicon.com', keyword: 'engagement models', request_id: '7491', status: 'published', existing_page_url: D + '/engagement-models', published_url: D + '/services/engagement-models' };
    const base = { keyword: 'engagement models', url: D + '/services/engagement-models', title: 'Engagement Models | Outsourcing, Dedicated Teams | Devaicon', h1: 'Engagement models', text: '', draft: {}, log, ladder: null, logs: [log], ladders: [], domain: 'devaicon.com', now: '2026-11-10T12:00:00.000Z' };
    const v0 = verifyPublished(base);
    check('without a reading of the old address: "another address", as before', v0.verify === 'refresh_other_address' && !v0.accepted, J(v0));
    const v1 = verifyPublished({ ...base, redirect: { status: 301, location: D + '/services/engagement-models' } });
    check('the old address answers 301 to the address sent: verified, no warning note, the move said in plain words',
      v1.verify === 'ok' && v1.verified && v1.accepted && v1.publish_note === '' && /now redirects here permanently/.test(v1.note) && v1.evidence.old_address.moved_here === true, J(v1));
    const v2 = verifyPublished({ ...base, redirect: { status: 308, location: '/services/engagement-models/' } });
    check('308 with a relative Location and a trailing slash: the same move', v2.verify === 'ok', J(v2));
    const v3 = verifyPublished({ ...base, redirect: { status: 302, location: D + '/services/engagement-models' } });
    check('a temporary redirect (302) is not a move', v3.verify === 'refresh_other_address', J(v3.verify));
    const v4 = verifyPublished({ ...base, redirect: { status: 301, location: D + '/services' } });
    check('a permanent redirect to another address is not this move', v4.verify === 'refresh_other_address', J(v4.verify));
    const v5 = verifyPublished({ ...base, redirect: { status: 200, location: '' } });
    check('the old address still opens its old page: "another address"', v5.verify === 'refresh_other_address', J(v5.verify));
    const v6 = verifyPublished({ ...base, title: 'Something else entirely | Devaicon', h1: 'Unrelated', redirect: { status: 301, location: D + '/services/engagement-models' } });
    check('a moved page must still be the draft (keyword or written title): an unrelated page at the new address is not verified', v6.verify === 'refresh_not_live' && !v6.accepted, J(v6.verify));
    // the home page (ladder row 17: planned as an update of https://devaicon.com/, published at its own address)
    const home = { ...log, keyword: 'ai automation services pakistan', request_id: 'cad_20261030_devaicon-com_2', existing_page_url: D + '/', published_url: D + '/ai-automation-services-pakistan' };
    const h1 = verifyPublished({ ...base, keyword: home.keyword, url: home.published_url, title: 'AI Automation Services in Pakistan | ISO 27001 | Devaicon', h1: 'AI automation services in Pakistan', log: home, logs: [home] });
    check('a home-page update published as its own page: verified as a page of its own, the home page stays (no redirect asked)', h1.verify === 'ok' && h1.publish_note === '' && /home page stays as it is/.test(h1.note) && !/Redirect/.test(h1.note), J(h1));
    const h2 = verifyPublished({ ...base, keyword: home.keyword, url: home.published_url, title: 'Contact us | Devaicon', h1: 'Contact', text: 'Write to us.', log: home, logs: [home] });
    check('... and judged as a NEW page when it does not match (not_the_draft, not "update not live")', h2.verify === 'not_the_draft', J(h2.verify));
  });

  await guard('CR2 Publish Check', async () => {
    reset(); const SN = 'CR2 (2026-11-10) Publish Check reads the old address without redirects: the move is verified and the note cleared; HTML entities in the title are read as text'; begin(SN); const check = mkCheck(SN);
    const html = (title, h1) => '<html><head><title>' + title + '</title><meta name="description" content="' + 'Banking and financial services technology for banks and insurers in the UAE and GCC, from core systems to digital channels.' + '"></head><body><main><h1>' + h1 + '</h1>'
      + '<p>' + 'Banking & financial services technology helps banks move faster. '.repeat(40) + '</p></main></body></html>';
    const row = { site_id: 'site_devaicon-com', domain: 'devaicon.com', keyword: 'banking & financial services technology', source: 'app', request_id: '6661', status: 'published', existing_page_url: D + '/industries/bfsi',
      published_url: D + '/services/industries-bfsi', published_at: '2026-11-04T12:11:37.867Z', publish_note: 'Marked published by you after a warning: sent at another address than the page it updates (checked 2026-11-04)', started_at: '2026-11-02T17:11:21.126Z' };
    const go = async (old) => {
      reset();
      await run('Normalize Input', { body: { mode: 'published', domain: 'devaicon.com', keyword: 'banking & financial services technology', content_request_id: '6661', url: D + '/services/industries-bfsi', callback_url: 'https://hooks.example.com/x', request_id: 'pub-cr2' } });
      mock('Load Content Log (Published)', [{ json: row }]); mock('Load Ladders (Published)', [{ json: {} }]); mock('Load Query History (Published)', [{ json: {} }]);
      mock('Fetch Published Page', { statusCode: 200, headers: { 'content-type': 'text/html' }, data: html('Banking &amp; Financial Services Technology | Devaicon', 'Banking &amp; Financial Services Technology Solutions') });
      const plan = (await run('Updated Address Plan', [{ json: {} }]))[0].json;
      if (old) mock('Fetch Updated Address', old);
      return { plan, c: (await run('Publish Check', [{ json: {} }]))[0].json };
    };
    const a = await go({ statusCode: 301, headers: { location: D + '/services/industries-bfsi' }, data: '' });
    check('Updated Address Plan asks for the old address of the draft (not skipped)', a.plan.skip === false && a.plan.old_url === D + '/industries/bfsi', J(a.plan));
    check('verified and recorded, the note cleared', a.c.verified === true && a.c.recorded_live === true && a.c.log_row.publish_note === '', J({ v: a.c.verify, note: a.c.log_row.publish_note }));
    check('"Title tag uses the keyword" passes on "Banking &amp; Financial Services Technology | Devaicon"', (a.c.checks || []).find(x => x.name === 'Title tag uses the keyword').ok === true, J((a.c.checks || []).slice(0, 4)));
    check('the title is shown decoded', /Banking & Financial Services Technology/.test((a.c.checks || []).find(x => x.name === 'Title tag uses the keyword').detail), '');
    const b = await go(null);
    check('the old address not read (the step did not run): "another address", nothing moved', b.c.verify === 'refresh_other_address' && b.c.recorded_live === false, J(b.c.verify));
  });

  await guard('CR3 DUP market', async () => {
    reset(); const SN = 'CR3 (2026-11-10, run 12467) a page aimed at another market\'s search is not the duplicate of a page for this market'; begin(SN); const check = mkCheck(SN);
    const pk = { url: D + '/ai-automation-services-pakistan', title: 'AI Automation Services in Pakistan | ISO 27001 | Devaicon', h1: '' };
    const pages = [pk, { url: D + '/services/engagement-models', title: 'Engagement Models | Devaicon' }, { url: D + '/', title: 'Devaicon | Software and AI' }];
    const ae = DUP.targets('ai automation services', pages, { market: 'United Arab Emirates' });
    check('UAE run of "ai automation services": the Pakistan page is in other_market (with its place), not a target', ae.targets.length === 0 && ae.other_market.length === 1 && ae.other_market[0].places.includes('pakistan'), J(ae));
    const pkRun = DUP.targets('ai automation services', pages, { market: 'Pakistan' });
    check('Pakistan run: the same page IS the duplicate', pkRun.targets.length === 1 && pkRun.targets[0].url === pk.url, J(pkRun));
    const none = DUP.targets('ai automation services', pages, {});
    check('no market given: the rule as before (a target)', none.targets.length === 1, J(none));
    const named = DUP.targets('ai automation services pakistan', pages, { market: 'AE' });
    check('a keyword naming Pakistan in a UAE run keeps the old rule (the Pakistan page is its duplicate)', named.targets.length === 1, J(named));
    const gcc = DUP.targets('erp software', [{ url: 'https://x.example/erp-software-gcc', title: 'ERP Software in the GCC' }], { market: 'United Arab Emirates' });
    check('a GCC page is in the UAE market: still a duplicate', gcc.targets.length === 1, J(gcc));
    check('marketOf reads names and codes', DUP.marketOf('United Arab Emirates') === 'AE' && DUP.marketOf('pk') === 'PK' && DUP.marketOf('Pakistan') === 'PK' && DUP.marketOf('') === '', '');
  });

  await guard('CR4 second read', async () => {
    reset(); const SN = 'CR4 (2026-11-10) the second read blocks a claim only when it says the statement is unsupported: the eight real findings of devaicon.com'; begin(SN); const check = mkCheck(SN);
    const F = [
      ['Our engineers work with Python and Django on the server and React in the browser.', 'The facts on file do not say Devaicon uses this stack, so this is an unverified claim about the business', true],
      ['Pakistan and the Gulf share close working hours, which makes daily stand-ups and same-day decisions practical.', 'Delivery across both locations is a claim about the business the facts do not carry. The offices on file are Sharjah and Multan, and a delivery model across them is not stated', true],
      ['Pakistani financial institutions tend to report four symptoms:', 'This presents an observed pattern among Pakistani institutions with no source and no client evidence. The facts on file say customers are mainly in the UAE and GCC', true],
      ['Delivery partner with a UAE office and offshore engineering', 'This row of the provider table describes Devaicon without naming it and attributes properties to it (high integration across CRM, ERP and cloud; extended hours; cloud partner status). The facts on file support only a Sharjah office, Multan, AWS partnership, ISO', true],
      ['Our work runs in three phases:', 'The page maps its own five-step model onto the three phases. The facts on file list only business discovery, requirements, gap-fit and ROI under that phase', true],
      ['Devaicon has an office in Sharjah, is ISO 27001 certified and is an AWS partner.', 'The section claims deep UAE and GCC knowledge and a track record from application and AI delivery, yet no strategy-consulting credential, case, or named outcome backs a page selling strategic consulting. Trust gap for CEO readers', false],
      ['Devaicon provides AI automation services for organisations in banking and financial services, the public sector', 'The paragraph states that Devaicon provides AI automation services. It never mentions the Sharjah office or 24/7 support, which are the UAE-specific proof points this buyer needs', false],
      ['Dedicated teams and staff augmentation work as described in the comparison above.', 'The facts on file list outsourcing, dedicated teams and staff augmentation as Devaicon\'s options. The page compares five models, including fixed price, T&M and ODC, so a reader cannot tell which of the five Devaicon actually offers', false]];
    for (const [loc, issue, blocks] of F) {
      const e = RR.errorOf({ severity: 'high', kind: 'claim', location: loc, issue, on_page: true }, '');
      const t = RR.textError('A second read of the page found a problem at "' + loc + '": ' + issue);
      check((blocks ? 'blocks: ' : 'advice: ') + loc.slice(0, 60), (!!e === blocks) && (!!t === blocks), J({ e, t }));
    }
    check('a count that does not match its list still blocks (any kind)', RR.errorOf({ severity: 'high', kind: 'structure', location: 'We cover six engines: ChatGPT, Gemini, Perplexity, Claude, Copilot.', issue: 'Six engines are named but the list has five', on_page: true }, '') === 'count', '');
    check('a wrong fact still blocks', RR.errorOf({ severity: 'high', kind: 'fact', location: 'The deadline is 31 July 2026.', issue: 'This date is out of date: it was replaced by 30 October 2026', on_page: true }, '') === 'wrong', '');
    check('a medium claim never blocks', RR.errorOf({ severity: 'medium', kind: 'claim', location: F[0][0], issue: F[0][1], on_page: true }, '') === '', '');
  });
};
