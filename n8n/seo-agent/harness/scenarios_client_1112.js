// PR1-PR4 (production review 2026-11-12, build section 189). Pinned on the production rows of that day, anonymised (the client's domain and
// brand replaced by novaand-demo.com / Nova&; the page paths and statuses are production's):
//   PR1  the "same search" check never names an address that redirects, is gone, or is the page itself: the live grade of
//        /ms-365-erp-uae (59 "Not ready to publish yet: same search as /dynamics-365-business-central-uae", which answers 308 since 11-07)
//        is not held; the page's own title is recorded (not the site's generic one); a read of another page is refused; DUP (content runs)
//        skips 3xx / 404 pages; the inventory takes the daily page watch's readings (200 clears a stale 404, a 308 to another path is
//        stored) and re-reads a stored 404 every week even when the sitemap lists it; the 301 advice needs two reads (F-03)
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
};
