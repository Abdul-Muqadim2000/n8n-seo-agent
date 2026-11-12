// PR1-PR4 (production review 2026-11-12, build section 189). Pinned on the production rows of that day, anonymised (the client's domain and
// brand replaced by novaand-demo.com / Nova&; the page paths and statuses are production's):
//   PR1  the "same search" check never names an address that redirects, is gone, or is the page itself: the live grade of
//        /ms-365-erp-uae (59 "Not ready to publish yet: same search as /dynamics-365-business-central-uae", which answers 308 since 11-07)
//        is not held; the page's own title is recorded (not the site's generic one); a read of another page is refused; DUP (content runs)
//        skips 3xx / 404 pages; the inventory takes the daily page watch's readings (200 clears a stale 404, a 308 to another path is
//        stored) and re-reads a stored 404 every week even when the sitemap lists it; the 301 advice needs two reads (F-03)
//   PR2  a client's free re-make stayed 59 "Not ready" (S3-04): the editor rewrote the provider-table row the second read flagged, but kept
//        the row's label, which is the quote; a finding whose sentence / row the editor rewrote on its task is resolved (advice to check),
//        one the editor left as it was stays open
//   PR3  the Rank Tracker's next step (S2-07): a ladder paused on the Pipeline page gets no write advice; a rung our check stopped (AVOID) is
//        never "write or improve"; a "-2" copy of a live page is never the page to refresh
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const fs = require('fs');
  const path = require('path');
  const R = require('./replay')(H);
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const V5 = path.join(__dirname, '..', 'v5', 'code');
  const SRC = (f) => fs.readFileSync(path.join(V5, f), 'utf8');
  const places = (SRC('_fit_gate.js').match(/const FIT_PLACES_SRC = (\[[\s\S]*?\]\]);/) || [])[1];
  const DUP = new Function(SRC('_dup_targets.js').replace('/*__FIT_PLACES_SRC__*/[]', places) + '\nreturn DUP;')();
  const W = 'https://www.novaand-demo.com';

  // ---------- PR1a the live grade: the "same search" page the first check named now redirects ----------
  await guard('PR1a live grade duplicate moved', async () => {
    const SN = 'PR1a (S3-05 / S2-05) the live grade never keeps a "same search" page that now redirects (308), is gone (404) or is the page itself; one that still answers 200 stays; the page\'s own title is recorded; a read of another page is refused';
    reset(); begin(SN); const check = mkCheck(SN);
    const F99 = R.load('replay_3299.json.gz'); const F36 = R.load('replay_3336.json.gz');
    const CB = F99.nodes['Build Webhook Response']['0'].items[0].json;
    const BODY0 = F36.nodes['Finalize Webhook']['0'].items[0].json.body;
    const READ = fs.readFileSync(path.join(__dirname, 'fixtures', 'reader_devaicon_bfsi_2026-11-11.md'), 'utf8');
    const D = 'https://' + BODY0.domain;
    const LIVE = D + '/services/industries-bfsi';
    const DUPURL = D + '/dynamics-365-business-central-uae';   // production: the address the first check named, 308 since 2026-11-07
    const dupText = 'This website already has a page for the same search: ' + DUPURL + '. Publish this text as an update of that page, or tell us how the new page differs';
    const gating = { qa_blocking: [{ code: 'duplicate_page', text: dupText, action: 'publish it as an update of your existing page for this search, or tell us how the new page differs' }],
      duplicate_targets: [{ url: DUPURL, title: 'Business Central Implementation UAE | Nova', keyword_words_shared_pct: 100 }], verdict: CB.verdict == null ? null : CB.verdict, score: CB.score == null ? null : CB.score,
      score_withheld: false, page_type: ((CB.meta || {}).page_type) || '', verdict_acknowledged: false, copied_passages: [], content_request_id: CB.request_id || '', length_points: null };
    const live = { url: LIVE, h1: 'Banking & Financial Services Technology Solutions', title: 'Banking & Financial Services Technology | Devaicon' };
    const chain = async (body, reader, dupAnswer) => {
      reset(); delete store['Finalize Editor'];
      const lp = await run('Live Read Plan', [{ json: { body, headers: {} } }], { code: 'Finalize__Live_Read_Plan' });
      mock('Live Read Plan', lp);
      const lb = lp[0].json.live_plan.read ? await run('Live Page Body', [{ json: reader }], { code: 'Finalize__Live_Page_Body' }) : lp;
      const dp = await run('Duplicate Status Plan', lb, { code: 'Finalize__Duplicate_Status_Plan' });
      let pbIn = dp;
      if (dp[0].json.dup_check && dp[0].json.dup_check.url) { mock('Duplicate Status Plan', dp); pbIn = await run('Duplicate Status', dp.map(() => ({ json: clone(dupAnswer) })), { code: 'Finalize__Duplicate_Status' }); }
      const pb = await run('Parse Brief', pbIn, { code: 'Finalize__Parse_Brief' });
      if (!pb[0].json.ok) return { dp, pb: pb[0].json };
      mock('Finalize Plan', pb);
      const ap = await run('Finalize Apply', pb, { code: 'Finalize__Finalize_Apply' });
      const mg = await run('Finalize Merge', ap, { code: 'Finalize__Finalize_Merge' });
      const qa = await run('Content QA', mg, { code: 'Finalize__Content_QA' });
      const oc = await run('Originality Check', qa, { code: 'Finalize__Originality_Check' });
      return { dp, pb: pb[0].json, v: (await run('Finalize Verdict', oc, { code: 'Finalize__Finalize_Verdict' }))[0].json.body };
    };
    const body = { ...clone(BODY0), grade_only: true, grade_live: live, answers: [], page_run: gating };
    const reader = { statusCode: 200, data: READ };
    const moved = await chain(body, reader, { statusCode: 308, headers: { location: '/business-central-implementation-uae' } });
    check('the plan reads the one address the first check named, on this website only', moved.dp.length === 1 && moved.dp[0].json.dup_check.url === DUPURL, J(moved.dp.map(x => x.json.dup_check)));
    check('Parse Brief carries what it answered (308 and where to)', J(moved.pb.prc.duplicate_status) === J([{ url: DUPURL, status: 308, location: D + '/business-central-implementation-uae' }]), J(moved.pb.prc.duplicate_status));
    check('a duplicate that redirects is not held: no duplicate blocker, resolved as moved, said once as advice', moved.v.delivery.blocking.every(b => b.code !== 'duplicate_page') && moved.v.page_run.resolved.includes('duplicate_page:moved')
      && !moved.v.page_run.kept_open.includes('duplicate_page') && moved.v.delivery.advisory.some(a => a.code === 'duplicate_moved' && a.text.includes('now redirects to ' + D + '/business-central-implementation-uae')), J({ b: moved.v.delivery.blocking, r: moved.v.page_run.resolved, a: moved.v.delivery.advisory.map(a => a.code) }));
    check('... and its status is not "Not ready to publish yet: same search" (the production label)', !/same search/.test(moved.v.delivery.label), moved.v.delivery.label);
    const still = await chain(body, reader, { statusCode: 200, headers: {} });
    check('a duplicate that still answers 200 stays open (the rule is unchanged for a real second page)', still.v.page_run.kept_open.includes('duplicate_page') && still.v.delivery.blocking.some(b => b.code === 'duplicate_page'), J(still.v.page_run));
    const gone = await chain(body, reader, { statusCode: 404, headers: {} });
    check('a duplicate that is gone (404) is not held either', !gone.v.page_run.kept_open.includes('duplicate_page') && gone.v.delivery.advisory.some(a => a.code === 'duplicate_moved' && /no longer answers \(404\)/.test(a.text)), J(gone.v.delivery.advisory));
    const unread = await chain(body, reader, { error: { message: 'timeout' } });
    check('an address that could not be read keeps the first check\'s duplicate (unknown is not "moved")', unread.v.page_run.kept_open.includes('duplicate_page'), J(unread.v.page_run));
    const selfBody = { ...body, page_run: { ...gating, qa_blocking: [{ ...gating.qa_blocking[0], text: gating.qa_blocking[0].text.replace(DUPURL, LIVE) }], duplicate_targets: [{ url: LIVE, title: 'x' }] } };
    const self = await chain(selfBody, reader, { statusCode: 200, headers: {} });
    check('the page graded is never its own duplicate (the first check named the address it was then published at)', !self.v.page_run.kept_open.includes('duplicate_page') && self.v.page_run.resolved.includes('duplicate_page:moved'), J(self.v.page_run));
    const other = await chain({ ...body, page_run: { ...gating, duplicate_targets: [{ url: 'https://elsewhere.example/x' }], qa_blocking: [] } }, reader, null);
    check('an address of another website is never read', !(other.dp[0].json.dup_check || {}).url, J(other.dp[0].json.dup_check));
    // the title: production recorded the site's home-page title for /ms-365-erp-uae
    const generic = READ.replace(/^Title:.*$/m, 'Title: Devaicon | Software, AI and Automation');
    const t = await chain(body, { statusCode: 200, data: generic }, { statusCode: 308, headers: { location: '/business-central-implementation-uae' } });
    check('the recorded title is the page\'s own (the publish check\'s reading), not the reader\'s generic one', t.v && t.v.live_read.title === live.title, J(t.v && t.v.live_read));
    const wrong = READ.replace(/^Title:.*$/m, 'Title: Devaicon | Software, AI and Automation').replace(/^## What is banking & financial services technology\?$/m, '# Build software that grows with you');
    const w = await chain(body, { statusCode: 200, data: wrong }, null);
    check('a read whose title AND main heading are another page\'s is refused with the reason, never graded', w.pb.ok === false && /returned another page/.test(w.pb.error), w.pb.error);
    const normal = await chain({ ...clone(BODY0), page_run: gating }, null, { statusCode: 308, headers: { location: '/business-central-implementation-uae' } });
    check('a normal final version (not a live grade) is judged by what the address answers now too', normal.v && !normal.v.page_run.kept_open.includes('duplicate_page'), J(normal.v && normal.v.page_run));
  });

  // ---------- PR1b content runs: DUP and the site model skip addresses that redirect or are gone ----------
  await guard('PR1b DUP skips moved pages', async () => {
    const SN = 'PR1b (S3-05) DUP.targets never names an inventory address that redirects (3xx) or is gone (404 / 410) as the page for the same search; a live one still is';
    reset(); begin(SN); const check = mkCheck(SN);
    const pages = [{ url: W + '/dynamics-365-business-central-uae', title: 'Business Central Implementation UAE | Nova', h1: 'Business Central Implementation in UAE', http_status: 308 },
      { url: W + '/business-central-implementation-old', title: 'Business Central Implementation UAE | Nova', h1: '', http_status: 404 },
      { url: W + '/about', title: 'About Nova&', h1: 'About', http_status: 200 }];
    const a = DUP.targets('business central implementation uae', pages, {});
    check('the 308 and the 404 address are not targets; they are listed as not live', a.targets.length === 0 && a.not_live.length === 2, J(a));
    const b = DUP.targets('business central implementation uae', pages.concat([{ url: W + '/business-central-implementation-uae', title: 'Business Central Implementation UAE | Nova', h1: '', http_status: 200 }]), {});
    check('the live page at the address it moved to is the target', b.targets.length === 1 && b.targets[0].url === W + '/business-central-implementation-uae', J(b.targets));
    const c = DUP.targets('business central implementation uae', pages.map(p => ({ ...p, http_status: 0 })), {});
    check('an address never read (status 0) is judged as before', c.targets.length >= 1, J(c.targets));
  });

  // ---------- PR1c the inventory: the page watch's readings, the weekly re-read of stored 404s, two reads before the 301 advice ----------
  await guard('PR1c inventory status', async () => {
    const SN = 'PR1c (F-03 / S3-05) the inventory takes the daily page watch\'s readings (a 200 clears a stale 404, a 308 to another path is stored, a host-only hop is ignored); a stored 404 the sitemap lists is read again every week; the 301 advice needs two reads';
    reset(); begin(SN); const check = mkCheck(SN);
    const SID = 'site_novaand-demo-com', DOM = 'novaand-demo.com';
    const today = new Date().toISOString(), old = '2026-10-22T17:00:21.156Z';
    // production seo_pages 157 / 158 / 160 (404 since 10-22 / 11-05) and seo_page_watch 116 / 122 (308, 200)
    const stored = [{ url: W + '/business-central-implementation-uae', title: 'Business Central Implementation UAE | Nova', h1: '', source: 'sitemap', http_status: 404, status_at: old },
      { url: W + '/business-central-post-go-live-support-uae', title: 'Business Central Support UAE', h1: '', source: 'sitemap', http_status: 404, status_at: old },
      { url: W + '/dynamics-365-business-central-uae', title: 'Business Central Implementation UAE | Nova', h1: '', source: 'sitemap', http_status: 404, status_at: '2026-11-05T01:23:36.239Z' },
      { url: W + '/old-gone-page', title: 'Old', h1: '', source: 'gsc', http_status: 404, status_at: old }].map(r => ({ site_id: SID, queries_json: '[]', lastmod: '', ...r }));
    const SITEMAP = stored.filter(r => r.source === 'sitemap').map(r => ({ url: r.url, lastmod: '2026-11-06' }));
    mock('Resolve Properties', [{ json: { site_id: SID, domain: DOM } }]);
    mock('Parse GSC', [{ json: { site_idx: 0, pages: [], queries: [], page_perf: [] } }]);
    mock('Detect Published', [{ json: { site_id: SID, inventory: SITEMAP, detected: [], page_titles: [], sitemap: { ok: true } } }]);
    mock('Load Pages (Site)', stored.map(json => ({ json })));
    const T = (await run('Status Targets (Site)', store['Load Pages (Site)'])).map(i => i.json);
    check('every stored 404 is read again this week, the ones the sitemap lists included (production skipped them, so 11 pages stayed "404" while they answered 200)',
      stored.every(r => T.some(t => t.url === r.url)), J(T.map(t => t.url)));
    const ANS = { [W + '/business-central-implementation-uae']: 200, [W + '/business-central-post-go-live-support-uae']: 200, [W + '/dynamics-365-business-central-uae']: 200, [W + '/old-gone-page']: 404 };
    mock('Fetch Page Status (Site)', T.map(t => ({ statusCode: ANS[t.url] || 0, headers: {}, data: '' })));   // the weekly read follows redirects: the 308 reads as 200
    mock('Site Model (Site)', []); mock('Load AI Pages (Site)', []); mock('Match Slugs (Detect)', [{ json: { skip: true, sites: [] } }]);
    mock('Load Page Watch (Site)', [{ json: { site_id: SID, url: W + '/dynamics-365-business-central-uae', status: 308, location: '/business-central-implementation-uae', checked_at: today, error: '' } },
      { json: { site_id: SID, url: W + '/business-central-implementation-uae', status: 200, location: '', checked_at: today, error: '' } },
      { json: { site_id: SID, url: 'https://novaand-demo.com/business-central-post-go-live-support-uae', status: 301, location: W + '/business-central-post-go-live-support-uae', checked_at: today, error: '' } }]);
    const INV = (await run('Page Inventory (Site)', store['Fetch Page Status (Site)']))[0].json;
    const st = (u) => Number(((INV.pages || []).find(p => p.url.replace(/^https?:\/\/(www\.)?/, '') === u.replace(/^https?:\/\/(www\.)?/, '')) || {}).http_status);
    check('a page that answers 200 again clears its 404', st(W + '/business-central-implementation-uae') === 200 && st(W + '/business-central-post-go-live-support-uae') === 200, J(INV.pages.map(p => [p.url, p.http_status])));
    check('the page watch\'s recent 308 to another path is stored (the weekly read, which follows redirects, does not overwrite it)', st(W + '/dynamics-365-business-central-uae') === 308, st(W + '/dynamics-365-business-central-uae'));
    check('a bare-host hop to the same path is not a redirect of the page', st(W + '/business-central-post-go-live-support-uae') === 200, '');
    check('the page still gone after two reads is confirmed for the 301 advice; the ones that answer again are not', J(INV.gone_confirmed) === J([W + '/old-gone-page']), J(INV.gone_confirmed));
    const MODEL = (await run('_site_model', [{ json: { site_row: { site_id: SID, domain: DOM, canonical_host: 'www.novaand-demo.com', business_name: 'Nova&', model_updated_at: today }, extras: { pages: INV.pages }, keyword: 'dynamics 365 business central uae' } }]))[0].json;
    const m = MODEL.match || null;
    check('the site model never answers a search with an address that redirects', !m || !/dynamics-365-business-central-uae/.test(J(m)), J(m));
  });

  // ---------- PR2 the re-make of a final version: the flagged row was rewritten, its label (the quote) kept ----------
  await guard('PR2 finalize rewritten finding', async () => {
    const SN = 'PR2 (S3-04) a second-read finding the editor rewrote on its task (the row that holds the quote changed) no longer holds the final version at 59; a refused or missed edit still does';
    reset(); begin(SN); const check = mkCheck(SN);
    const F99 = R.load('replay_3299.json.gz'); const F36 = R.load('replay_3336.json.gz');
    const CB = F99.nodes['Build Webhook Response']['0'].items[0].json;
    const BODY0 = F36.nodes['Finalize Webhook']['0'].items[0].json.body;
    // production report of 2026-11-12 10:00 (the free re-make), the client's name replaced by Nova
    const Q = 'Delivery partner with a UAE office and offshore engineering';
    const ROW0 = '| ' + Q + ' | High across CRM, ERP and cloud | Contract-based, often extended hours | Shared, with a local contact | Certifications such as ISO 27001, cloud partner status | Mid-size and large organisations with several systems |';
    const ROW1 = '| ' + Q + ' (we have an office in Sharjah, a presence in Multan and an AWS partnership) | Varies by partner; ask for a live example | Contract-based | Shared, with a local contact | Certifications and partnerships to check with the issuing body | Mid-size and large organisations with several systems |';
    const HEAD = '## Which companies offer AI automation services in Dubai, and how do you choose one?';
    const INTRO = 'Options include in-house teams, local agencies, delivery partners with a UAE office, no-code freelancers and the professional services teams of platform vendors. Choose based on how deeply they integrate with your CRM and ERP, how they handle Arabic, where your data is processed, the security certifications they hold and who supports the system after launch.';
    const TABLE = (row) => ['| Provider option | Integration depth | Ongoing support | Your control | Security assurance to check | Who it suits |', '|---|---|---|---|---|---|',
      '| In-house team | High, if the skills exist | Depends on retaining staff | Full | Your own policies | Large organisations with steady demand |',
      '| Local agency | Varies; often front-end and marketing tools | Contract-based | Shared | Certifications and data handling terms | Marketing-led chatbot and lead projects |', row].join('\n');
    const SEC = (row, intro) => HEAD + '\n\n' + (intro || INTRO) + '\n\n' + TABLE(row);
    const OTHER = '## What AI automation covers for a UAE business\n\n' + 'AI automation connects your CRM, your ERP and the documents your teams handle every day, so routine steps run without re-keying and each request reaches the right person with its history attached. '.repeat(6).trim()
      + '\n\n## Talk to us about your automation priorities\n\nTell us which process costs your team the most time, and we will map how it could run with fewer manual steps.';
    const MD = '# AI Automation Services in the UAE\n\n' + 'Most UAE teams still move data between their systems by hand, and each hand-off costs time and creates errors that someone has to find later. '.repeat(3).trim() + '\n\n' + SEC(ROW0) + '\n\n' + OTHER + '\n';
    const REV = 'A second read of the page found a problem at "' + Q + '": This row of the provider table describes Nova without naming it and attributes properties to it (high integration across CRM, ERP and cloud; extended hours; cloud partner status). The facts on file support only a Sharjah office, Multan, AWS partnership, IS';
    const gating = { qa_blocking: [{ code: 'review', text: REV, action: 'correct or remove the words the second read quoted, or check them against a source you trust' }], duplicate_targets: [], verdict: CB.verdict == null ? null : CB.verdict,
      score: CB.score == null ? null : CB.score, score_withheld: false, page_type: ((CB.meta || {}).page_type) || '', verdict_acknowledged: false, copied_passages: [], content_request_id: CB.request_id || '', length_points: null };
    const body = { ...clone(BODY0), keyword: 'ai automation services', markdown: MD, delivered_markdown: MD, client_edited: false, answers: [], page_run: gating,
      business_facts: 'Nova has an office in Sharjah, UAE and an office in Multan, Pakistan. Nova is an AWS partner, is ISO 27001 certified and offers 24/7 support.' };
    const chain = async (sectionText) => {
      reset(); delete store['Finalize Editor'];
      const pb = await run('Parse Brief', [{ json: { body: clone(body), headers: {} } }], { code: 'Finalize__Parse_Brief' });
      mock('Finalize Plan', pb);
      const ap = await run('Finalize Apply', pb, { code: 'Finalize__Finalize_Apply' });
      const job = ((ap[0].json.finalize_apply || {}).jobs || [])[0] || null;
      if (ap[0].json.needs_editor && job) mock('Finalize Editor', [{ json: { output: { sections: [{ id: job.id, text: sectionText }] } } }]);
      const mg = await run('Finalize Merge', ap, { code: 'Finalize__Finalize_Merge' });
      const qa = await run('Content QA', mg, { code: 'Finalize__Content_QA' });
      const oc = await run('Originality Check', qa, { code: 'Finalize__Originality_Check' });
      return { ap: ap[0].json, job, v: (await run('Finalize Verdict', oc, { code: 'Finalize__Finalize_Verdict' }))[0].json.body };
    };
    let refusedBody = null; const refusedV = () => refusedBody || {};
    refusedBody = (await chain(SEC(ROW0))).v;
    const fixed = await chain(SEC(ROW1));
    check('the finding is an edit task for the row\'s section (184C), as on production', fixed.ap.needs_editor === true && (fixed.ap.finalize_apply.review_fixes || []).some(r => r.how === 'edit_task' && r.quote === Q) && fixed.job && /Which companies offer/.test(fixed.job.heading), J(fixed.ap.finalize_apply.review_fixes));
    check('the row was rewritten (its label, the quote, kept): the finding no longer holds the page; it is resolved as rewritten and said as advice to check',
      !fixed.v.page_run.kept_open.includes('review') && fixed.v.page_run.resolved.includes('review:rewritten') && fixed.v.delivery.blocking.every(b => b.code !== 'review')
      && fixed.v.delivery.advisory.some(a => a.code === 'second_read' && /this version rewrote that part/.test(a.text)), J({ k: fixed.v.page_run.kept_open, r: fixed.v.page_run.resolved, b: fixed.v.delivery.blocking }));
    check('... so no blocker caps the grade at 59 for it (production: "1 point still stops this page")', !((fixed.v.grade || {}).caps || []).some(c => /still stops/.test(String(c.why))) && (fixed.v.delivery.blocking.length > 0 || fixed.v.delivery_status !== 'not_ready'),
      J({ s: fixed.v.delivery_status, g: fixed.v.grade && fixed.v.grade.score, caps: fixed.v.grade && fixed.v.grade.caps }));
    check('... while the refused edit keeps that cap', ((refusedV().grade || {}).caps || []).some(c => /still stops/.test(String(c.why))), J(refusedV().grade && refusedV().grade.caps));
    const refused = await chain(SEC(ROW0));
    check('an edit that left the row as it was keeps the finding open (the page stays not ready)', refused.v.page_run.kept_open.includes('review') && refused.v.delivery_status === 'not_ready', J({ k: refused.v.page_run.kept_open, s: refused.v.delivery_status }));
    const elsewhere = await chain(SEC(ROW0, INTRO.replace('Choose based on', 'Pick a provider based on')));
    check('an edit of another sentence of the section, the flagged row untouched, keeps it open too', elsewhere.v.page_run.kept_open.includes('review'), J(elsewhere.v.page_run));
  });

  // ---------- PR3 the rank report of a paused ladder ----------
  await guard('PR3 rank report advice', async () => {
    const SN = 'PR3 (S2-07) the rank report: a paused ladder gets no write advice; a stopped (AVOID) rung is never "write or improve"; a "-2" copy page is never the page to refresh';
    reset(); begin(SN); const check = mkCheck(SN);
    const V = require('./fixtures_v5');
    const D = 'novaand-demo.com', SITE = 'site_novaand-demo-com', HOST = 'https://www.novaand-demo.com';
    const EMPTY = [{ json: {} }];
    const start = new Date(Date.now() - 9 * 864e5).toISOString();
    // production seo_ladders 46-50 (lad_mw0goinsniv1, 2026-11-12), the brand replaced
    const row = (rung, page_no, keyword, status, target, o = {}) => ({ json: { id: page_no, ladder_id: 'lad_crm', domain: D, head_keyword: 'crm service provider', rung, page_no, keyword, supporting: '', page_type: rung === 4 ? 'Service Page' : 'Guide',
      target_url: HOST + target, page_exists: status === 'published', status, months: '1-3', start_date: start, country: 'United Arab Emirates', location_code: 2784, language_code: 'en', email: '', callback_url: '', request_id: '7338', target_words: 2400, status_note: '', ...o } });
    const LAD = [row(2, 1, 'crm for customers', 'published', '/insights/crm-for-customers'),
      row(2, 2, 'what is a crm company', 'stopped', '/what-is-a-crm-company', { status_note: 'stopped: our check advised against this page (AVOID, score 22)' }),
      row(2, 3, 'best crm software for customer service', 'set_aside', '/best-crm-software-for-customer-service'),
      row(2, 4, 'dynamics 365 crm services uae', 'planned', '/dynamics-365-crm-services-uae'),
      row(4, 5, 'crm service provider', 'planned', '/dynamics-365-crm-uae')];
    const PAGES = [{ url: HOST + '/dynamics-365-crm-uae', title: 'Dynamics 365 CRM in Dubai & UAE: Sales and Service | Nova&', h1: 'Dynamics 365 CRM Services in Dubai and the UAE', http_status: 200 },
      { url: HOST + '/dynamics-365-crm-uae-2', title: 'Dynamics 365 CRM Services UAE | Nova&', h1: 'Dynamics 365 CRM Services in UAE', http_status: 200 },
      { url: HOST + '/insights/crm-for-customers', title: 'CRM for Customers: What It Does and How UAE Businesses Choose One', h1: '', http_status: 200 }]
      .map(p => ({ json: { site_id: SITE, source: 'sitemap', queries_json: '[]', lastmod: '', status_at: '', ...p } }));
    const report = async (settings) => {
      reset();
      mock('Load Ladders', LAD); mock('Load History', EMPTY); mock('Load Content Log (Tracker)', EMPTY); mock('Load Pages (Tracker)', PAGES);
      mock('Load Ladder Settings (Tracker)', settings.length ? settings : EMPTY);
      const tp = await run('Tracker Plan', store['Load History']);
      if (tp[0].json.nothing_to_do) return { tp, next: null };
      mock('SERP Check', tp.map(c => V.serpFor(c.json.keyword, c.json.domain, 0)));
      const pp = await run('Parse Positions', store['SERP Check']); mock('Save History', pp);
      const tr = await run('Tracker Report', pp);
      return { tp, tr: tr[0].json, next: tr[0].json.next_step };
    };
    const set = (status) => [{ json: { ladder_id: 'lad_crm', site_id: SITE, domain: D, head_keyword: 'crm service provider', mode: 'auto', status } }];
    const paused = await report(set('paused'));
    check('a ladder paused on the Pipeline page: "paused", no page to write, nothing named', paused.next && paused.next.action === 'paused' && paused.next.reason === 'paused_by_owner' && !paused.next.pages.length
      && !/Write or improve|what is a crm company|-2/.test(paused.next.text), J(paused.next));
    const archived = await report(set('archived'));
    check('an archived ladder: the same, said as archived', archived.next && archived.next.action === 'paused' && archived.next.reason === 'archived' && /archived/.test(archived.next.text), J(archived.next));
    const active = await report(set('active'));
    const txt = J(active.next);
    console.log('   PR3 active next ->', active.next && active.next.text, J(active.next && active.next.pages));
    check('an active ladder\'s next step never asks for the rung our check stopped (AVOID) nor the set-aside one', active.next && !/what is a crm company|best crm software for customer service/.test(txt), txt);
    check('... and never names the "-2" copy as the page to refresh (its original is named instead, or nothing)', !/dynamics-365-crm-uae-2/.test(txt), txt);
    check('... while the rungs still to work on are listed', /dynamics 365 crm services uae|crm for customers/.test(txt), txt);
  });
};
