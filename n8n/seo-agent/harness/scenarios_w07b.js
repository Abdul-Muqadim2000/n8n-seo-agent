// W07B1-W07B6 (page-quality wave 0.7, 2026-10-31, fix agent W07-B "write-anyway page identity"; docs/page-quality-2026-10-29/WAVE06.md
// section 10, findings 1-3; build section 179). Live (K1 "ms 365 erp", the re-check on the new reader key) the client chose "Write it anyway"
// next to its existing service page /ms-365-erp-uae. The new page got its own address (W06-B), but its title tag was the kept page's title tag
// word for word, it did not link to the kept page, the brief told the writer to publish it "as a replacement of that URL", and the blind second
// read advised "Use the slug ms-365-erp-uae". Pinned here, on the anonymised K1 replay (fixtures/replay_w05_k1.json.gz: the W05 run, which
// chose "Write it anyway" on the same page and has the same title, its H1 one word from the kept page's) and synthetic cases:
//   W07B1 the kit: which runs it applies to (only a separate new page beside a kept page), and what "the same title" means
//   W07B2 Collect Client Pages: the kept page's title tag and H1 from this run's read, else the page inventory, else "not checked"
//   W07B3 Parse Brief on the K1 brief: a title and an H1 of its own, no "replacement" line, the kept page offered as a link, the slug still moved;
//         the page contract tells the writer and the editor (and says nothing on any other run)
//   W07B4 Page Fix and Content QA on the K1 replay: the delivered title and H1 differ from the kept page's, one link to it, nothing else of the
//         page changed; a second pass changes nothing; a title that cannot be made different blocks; the 402 case (nothing read) still links
//   W07B5 the second read: told the choice, and its advice to take the kept page's slug is set aside (a link remark is kept)
//   W07B6 the pages that rank and every other run: the guide 949 (a ladder page), a rewrite and an ordinary run are byte for byte unchanged
// Called from scenarios_v5.js (one line). Every check runs the GENERATED code (harness/code_v4).
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const R = require('./replay')(H);
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const show = (label, v) => console.log('   W07-B ' + label + ': ' + (typeof v === 'string' ? v : J(v)));
  const PLAIN = /[—–…‘’“”]/;
  const pa = async (kit, fn, args) => (await run('PA Kit', [{ json: { kit, fn, args } }], { code: '_page_apart' }))[0].json.r;
  const pfNoPa = async (fn, args) => (await run('RR Kit', [{ json: { kit: 'PF', fn, args } }], { code: '_critic_reread' }))[0].json.r;   // the page kit WITHOUT PA (the Finalize nodes' view)
  const K1 = R.load('replay_w05_k1.json.gz');
  const G = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'ranking_guide_949.json'), 'utf8'));
  const PB = K1.nodes['Parse Brief']['0'].items[0].json;
  const W = 'https://www.novaand.example';
  // the kept page as the K1 run on the new reader key read it (WAVE06 section 10; brand anonymised): its title tag and its H1
  const KEPT_TITLE = 'MS 365 ERP in the UAE: Dynamics 365 Partner | Nova&';
  const KEPT_H1 = 'MS 365 ERP for UAE Businesses: Choosing and Implementing Dynamics 365';
  const IGN = { ...PB.existing_page_ignored, title_tag: KEPT_TITLE, h1: KEPT_H1, identity_from: 'read in this run' };
  const PBI = { ...clone(PB), existing_page_ignored: IGN };
  const titleOf = (md) => ((String(md).match(/^Title:[ \t]*(.*)$/im) || [])[1] || '').trim();
  const h1Of = (md) => ((String(md).match(/^# (.+)$/m) || [])[1] || '').trim();
  const linksTo = (md, p) => [...String(md).matchAll(/\]\(([^)\s]+)\)/g)].filter(m => m[1].replace(/^https?:\/\/[^\/]+/, '').replace(/\/+$/, '') === p).length;

  // ---------- W07B1 the kit ----------
  await guard('W07B1 kit', async () => {
    const SN = 'W07B1 (W07-B) the kit applies only to a separate new page beside a page the client kept, and "the same title" is the kept page\'s title or H1 word for word or nearly (the brand suffix off)';
    reset(); begin(SN); const check = mkCheck(SN);
    const ap = await pa('PA', 'of', [PBI]);
    show('PA.of(K1)', ap);
    check('K1 after "Write it anyway": one kept page, /ms-365-erp-uae, with its title tag and H1 as read in this run', ap && ap.pages.length === 1 && ap.path === '/ms-365-erp-uae' && ap.slug === 'ms-365-erp-uae'
      && ap.title === KEPT_TITLE && ap.h1 === KEPT_H1 && ap.checked === true && ap.from === 'read in this run', J(ap));
    const none = [
      ['"Improve the existing page" (a rewrite at its own address)', { ...PBI, existing_page: { url: W + '/ms-365-erp-uae', source: 'provided' } }],
      ['a page the client named (a refresh)', { ...PBI, existing_page_url: W + '/ms-365-erp-uae' }],
      ['a keyword-ladder page with its planned address', { ...PBI, ladder_id: 'lad_x', ladder_target_url: W + '/ms-365-erp' }],
      ['the ladder\'s own "left alone" page (planned_url)', { ...PBI, existing_page_ignored: { ...IGN, planned_url: W + '/ms-365-erp' } }],
      ['an ordinary run (no page left alone, nothing acknowledged)', { ...PBI, existing_page_ignored: null, verdict_acknowledged: false }]];
    const got = []; for (const [why, p] of none) got.push([why, await pa('PA', 'of', [p])]);
    check('null for a rewrite, a named page, a ladder page, the ladder\'s planned case and an ordinary run', got.every(g => g[1] === null), J(got.filter(g => g[1] !== null)));
    const dup = await pa('PA', 'of', [{ ...PBI, verdict_acknowledged: true, duplicate_check: { targets: [{ url: W + '/dynamics-365-erp-uae', title: 'Dynamics 365 ERP in the UAE' }, { url: W + '/ms-365-erp-uae/', title: 'x' }] } }]);
    check('after "Write it anyway" on a duplicate hold, the pages the duplicate check found join the kept page (the same page once)', dup && dup.pages.length === 2 && dup.pages[0].primary && dup.pages[1].path === '/dynamics-365-erp-uae' && dup.pages[1].from === 'the page inventory', J(dup));
    const dupOnly = await pa('PA', 'of', [{ ...PBI, existing_page_ignored: null, verdict_acknowledged: true, duplicate_check: { targets: [{ url: W + '/dynamics-365-erp-uae', title: 'Dynamics 365 ERP in the UAE' }] } }]);
    check('... and stand on their own when no page was left alone', dupOnly && dupOnly.pages.length === 1 && dupOnly.path === '/dynamics-365-erp-uae', J(dupOnly));
    const same = async (a, b) => pa('PA', 'same', [a, b]);
    const pairs = [[KEPT_TITLE, KEPT_TITLE, true, 'the K1 title word for word (the live finding)'], ['MS 365 ERP in the UAE: Dynamics 365 Partner', KEPT_TITLE, true, 'the brand suffix off'],
      ['MS 365 ERP in UAE: Dynamics 365 Partners | Nova&', KEPT_TITLE, true, 'one small word and a plural'],
      [PB.content_brief.h1, KEPT_H1, true, 'the W05 H1 ("Enterprises" for "Businesses")'], ['MS 365 ERP for UAE Enterprises: Choose the Right Dynamics 365 App', KEPT_H1, false, 'the W06 H1 (the judges: it differs)'],
      ['MS 365 ERP Explained: Choosing Dynamics 365 in the UAE', KEPT_TITLE, false, 'a title variant of the W06 brief'], ['MS 365 ERP | Nova&', KEPT_TITLE, false, 'the keyword and the brand only']];
    const bad = []; for (const [a, b, want, why] of pairs) if ((await same(a, b)) !== want) bad.push(why);
    check('near-equal: word for word, without the brand, a word and a plural apart, the W05 H1; not near-equal: the W06 H1, a variant, the keyword alone', bad.length === 0, J(bad));
  });

  // ---------- W07B2 Collect Client Pages: the kept page's title tag and H1 ----------
  await guard('W07B2 kept page read', async () => {
    const SN = 'W07B2 (W07-B) Collect Client Pages records the kept page\'s title tag and H1 from its HTML read in this run (never the reader\'s title line, which named the homepage on the client-rendered site), else from the page inventory, else nothing (not checked)';
    reset(); begin(SN); const check = mkCheck(SN);
    const body = 'If you searched for MS 365 ERP, you are almost certainly looking for Microsoft Dynamics 365, not your Office subscription. '.repeat(12);
    const html = '<!DOCTYPE html><html><head><meta charSet="utf-8"/><title>MS 365 ERP in the UAE: Dynamics 365 Partner | Nova&amp;</title></head><body><header><nav>Home</nav></header><main><h1 class="x">MS 365 ERP for UAE <span>Businesses</span>: Choosing and Implementing Dynamics 365</h1><p>' + body + '</p></main></body></html>';
    const jina = 'Title: Nova& | Enterprise Automation & Digital Transformation Solutions\n\nURL Source: ' + W + '/ms-365-erp-uae\n\nMarkdown Content:\n## MS 365 ERP for UAE Businesses: Choosing and Implementing Dynamics 365\n\n' + body;
    const home = 'Title: Nova& | Home\n\nURL Source: ' + W + '/\n\nMarkdown Content:\n## Value Driven Innovation\n\n' + 'We help enterprises in Dubai with technology. '.repeat(20);
    const SITE = { domain: 'novaand.example', canonical_host: 'www.novaand.example', pages: [{ url: W + '/ms-365-erp-uae', title: 'MS 365 ERP in the UAE: Dynamics 365 Partner | Nova&', h1: 'MS 365 ERP for UAE Businesses: Choosing and Implementing Dynamics 365' }] };
    const CSU = { keyword: 'ms 365 erp', domain: 'novaand.example', hold_ack: { score: 48 }, site_urls: [W + '/', W + '/ms-365-erp-uae'], internal_link_candidates: [{ url: W + '/ms-365-erp-uae', path: '/ms-365-erp-uae' }], site_model: SITE };
    const REQS = [{ url: W + '/ms-365-erp-uae', kind: 'related', ignored_existing: { url: W + '/ms-365-erp-uae', why: 'you chose "Write it anyway", so a separate new page is written and this page is read as a related page and left as it is' } },
      { url: W + '/', kind: 'home' }];
    const cc = async (jinaItems, htmlItems, csu) => { mock('Collect Site URLs', [{ json: csu || CSU }]); mock('Client Page Requests', REQS.map(r => ({ json: r })));
      mock('Read Client Pages', jinaItems.map(j => ({ json: j }))); delete store['Client Render Plan']; delete store['Site Model'];
      return (await run('Collect Client Pages', htmlItems.map(h => ({ json: h }))))[0].json; };
    const a = await cc([{ page_text: jina }, { page_text: home }], [{ page_html: html }, { page_html: '<html><title>Nova&amp; | Home</title><h1>Value</h1>' + body + '</html>' }]);
    show('read in this run', a.existing_page_ignored);
    check('from its HTML: the title tag (the entity decoded) and the H1 (inner tags flattened), never the reader\'s "Title:" line (the homepage\'s on this site)', a.existing_page_ignored.title_tag === KEPT_TITLE
      && a.existing_page_ignored.h1 === KEPT_H1 && a.existing_page_ignored.identity_from === 'read in this run' && a.existing_page === null && /Write it anyway/.test(a.existing_page_ignored.why), J(a.existing_page_ignored));
    const b = await cc([{ page_text: jina }, { page_text: home }], [{ error: { message: 'timeout' } }, { page_html: '' }]);
    check('the HTML read failed, the reader did not: the H1 from the reader\'s first heading, no title (the reader\'s title line is not trusted)', b.existing_page_ignored.h1 === KEPT_H1 && b.existing_page_ignored.title_tag === '' && b.existing_page_ignored.identity_from === 'read in this run', J(b.existing_page_ignored));
    const c402 = await cc([{ error: { message: '402 Payment Required' } }, { error: { message: '402 Payment Required' } }], [{ error: { message: '402' } }, { error: { message: '402' } }]);
    check('every read refused (the 402 run): the title and H1 the page inventory has on file', c402.existing_page_ignored.title_tag === KEPT_TITLE && c402.existing_page_ignored.h1 === KEPT_H1 && c402.existing_page_ignored.identity_from === 'the page inventory', J(c402.existing_page_ignored));
    const d = await cc([{ error: { message: '402' } }, { error: { message: '402' } }], [{ error: { message: '402' } }, { error: { message: '402' } }], { ...CSU, site_model: { ...SITE, pages: [] } });
    check('nothing read and nothing on file: empty, and the kit then says "not checked"', d.existing_page_ignored.title_tag === '' && d.existing_page_ignored.h1 === '' && d.existing_page_ignored.identity_from === ''
      && /^not checked/.test((await pa('PA', 'check', ['Title: x\n\n# y', await pa('PA', 'of', [{ ...PBI, existing_page_ignored: d.existing_page_ignored }])])).basis), J(d.existing_page_ignored));
    mock('Client Page Requests', [{ json: { ...REQS[0], ignored_existing: { ...REQS[0].ignored_existing, planned_url: W + '/ms-365-erp' } } }, { json: REQS[1] }]);
    mock('Collect Site URLs', [{ json: CSU }]); mock('Read Client Pages', [{ json: { page_text: jina } }, { json: { page_text: home } }]);
    const lad = (await run('Collect Client Pages', [{ json: { page_html: html } }, { json: { page_html: '' } }]))[0].json;
    check('a ladder\'s planned page (its own rule) is left exactly as before: no title or H1 recorded', lad.existing_page_ignored && !('title_tag' in lad.existing_page_ignored) && !('h1' in lad.existing_page_ignored), J(lad.existing_page_ignored));
  });

  // ---------- W07B3 Parse Brief and the page contract ----------
  await guard('W07B3 brief', async () => {
    const SN = 'W07B3 (W07-B) on the K1 brief: a meta title and an H1 of its own, the "publish as a replacement" line gone, the kept page offered as a link, the slug still moved; the contract tells the brief, the writer and the editor, and only on such a run';
    reset(); begin(SN); const check = mkCheck(SN);
    const BR = clone(PB.content_brief);
    BR.slug = 'ms-365-erp-uae';
    BR.title_variants = [KEPT_TITLE, 'MS 365 ERP Explained: Choosing Dynamics 365 in the UAE | Nova&', 'Microsoft ERP for UAE Enterprises: Dynamics 365, Not M365 | Nova&'];
    // the line the W06 brief carried (WAVE06 section 10), anonymised
    BR.gaps_to_cover = [...(BR.gaps_to_cover || []), 'Cannibalisation: novaand.example already has /ms-365-erp-uae on the same topic. Publish this brief as a replacement of that URL, not as a second page.'];
    const CTX = { ...PBI, site_urls: [W + '/', W + '/ms-365-erp-uae'], internal_link_candidates: PB.internal_link_candidates };
    mock('Brief Context', [{ json: CTX }]);
    const out = (await run('Parse Brief', [{ json: { output: JSON.stringify(BR) } }]))[0].json;
    const b = out.content_brief;
    show('brief', { meta_title: b.meta_title, h1: b.h1, slug: b.slug, variants: b.title_variants, link0: (b.internal_link_suggestions || [])[0], adj: (out.brief_adjustments || []).filter(x => /existing page|Slug|Meta title|H1 /.test(x)) });
    check('the meta title is no longer the kept page\'s (it was word for word), carries the keyword, fits 60 characters and comes from the brief\'s own variants',
      b.meta_title !== KEPT_TITLE && !(await pa('PA', 'same', [b.meta_title, KEPT_TITLE])) && !(await pa('PA', 'same', [b.meta_title, KEPT_H1])) && /ms 365 erp/i.test(b.meta_title) && b.meta_title.length <= 60 && /^MS 365 ERP Explained/.test(b.meta_title), b.meta_title);
    check('the H1 is no longer one word from the kept page\'s', b.h1 !== PB.content_brief.h1 && !(await pa('PA', 'same', [b.h1, KEPT_H1])) && /ms 365 erp/i.test(b.h1), b.h1);
    check('the title variant that was the kept page\'s title is off the list', !b.title_variants.includes(KEPT_TITLE) && b.title_variants.length === 2, J(b.title_variants));
    check('the "publish this brief as a replacement of that URL" line is gone; every other gap is kept', !b.gaps_to_cover.some(g => /replacement of that URL/.test(g)) && b.gaps_to_cover.length === BR.gaps_to_cover.length - 1, J(b.gaps_to_cover.slice(-2)));
    check('the kept page is the first internal link, with its own heading as a descriptive anchor; the other suggestions follow unchanged', b.internal_link_suggestions[0].url === W + '/ms-365-erp-uae' && b.internal_link_suggestions[0].anchor === KEPT_H1
      && J(b.internal_link_suggestions.slice(1)) === J(PB.content_brief.internal_link_suggestions), J(b.internal_link_suggestions.slice(0, 2)));
    const adj = out.brief_adjustments || [];
    check('the slug still moves off the kept page\'s address (W06-B), and every change is said in plain words', b.slug === 'ms-365-erp' && adj.some(x => /^Slug "ms-365-erp-uae" -> "ms-365-erp"/.test(x))
      && adj.some(x => /^Meta title ".*" -> ".*": your existing page \/ms-365-erp-uae already uses it as its title tag, and two pages with one title compete for one search$/.test(x))
      && adj.some(x => /^H1 ".*" -> ".*": your existing page \/ms-365-erp-uae already uses it as its main heading$/.test(x)) && adj.some(x => /^Took 1 line\(s\) off the brief that advised replacing or taking over your existing page \/ms-365-erp-uae/.test(x))
      && !adj.some(x => PLAIN.test(x)), J(adj));
    mock('Brief Context', [{ json: { ...CTX, existing_page_ignored: null } }]);
    const plainRun = (await run('Parse Brief', [{ json: { output: JSON.stringify(BR) } }]))[0].json;
    check('an ordinary run: the brief\'s title, H1, variants, gaps and links are exactly as the strategist wrote them', plainRun.content_brief.meta_title === BR.meta_title && plainRun.content_brief.h1 === BR.h1
      && J(plainRun.content_brief.title_variants) === J(BR.title_variants) && J(plainRun.content_brief.gaps_to_cover) === J(BR.gaps_to_cover) && J(plainRun.content_brief.internal_link_suggestions) === J(BR.internal_link_suggestions), J(plainRun.brief_adjustments));
    // the contract (Brief Context -> the brief, the Copywriter, the Critic, the Editor)
    const ct = await pa('PF', 'contract', [PBI]);
    const line = ct.text.split('\n').find(l => /^SEPARATE PAGE:/.test(l)) || '';
    show('contract line', line);
    check('the contract carries one SEPARATE PAGE line naming the kept page, its title and H1, and what not to do', /^SEPARATE PAGE: the client chose a separate new page at its own address beside the existing page https:\/\/www\.novaand\.example\/ms-365-erp-uae \(title tag "MS 365 ERP in the UAE: Dynamics 365 Partner \| Nova&", main heading "MS 365 ERP for UAE Businesses/.test(line)
      && /never suggest that page's address or slug/.test(line) && /link to that page once where it helps the reader/.test(line) && !PLAIN.test(line), line);
    const plainCt = await pa('PF', 'contract', [{ ...PBI, existing_page_ignored: null }]);
    const noPa = await pfNoPa('contract', [{ ...PBI, existing_page_ignored: null }]);
    check('any other run: the contract is byte for byte what the page kit wrote before (no line added)', plainCt.text === noPa.text && !/SEPARATE PAGE/.test(plainCt.text) && ct.text === noPa.text + '\n' + line, '');
    const ed = fs.readFileSync(path.join(__dirname, '..', 'v5', 'prompts', 'editor.txt'), 'utf8');
    check('the Editor prints the contract (so it is told the choice)', ed.includes("{{ ($json.page_contract || {}).text || '' }}"), '');
  });

  // ---------- W07B4 Page Fix and Content QA on the K1 replay ----------
  await guard('W07B4 page', async () => {
    const SN = 'W07B4 (W07-B) the K1 replay through Page Fix and Content QA: the title tag and H1 differ from the kept page\'s, the kept page is linked once, nothing else of the page changes; a second pass is a no-op; a title that cannot be made different blocks; the 402 case still links';
    reset(); begin(SN); const check = mkCheck(SN);
    const r0 = await R.replay(K1, 'Page Fix', 0, { mocks: { 'Parse Brief': [{ json: PBI }] } });
    const md = r0.first.output, old = r0.recordedFirst.output;
    show('title', titleOf(old) + ' -> ' + titleOf(md)); show('h1', h1Of(old) + ' -> ' + h1Of(md));
    show('fixes', (r0.first.page_fix_applied || {}).fixes.filter(f => /own wording|existing page/.test(f)));
    check('the recorded draft carried the kept page\'s title word for word and an H1 one word from its H1 (the live defect)', titleOf(old) === KEPT_TITLE && h1Of(old) === PB.content_brief.h1, J([titleOf(old), h1Of(old)]));
    check('the title tag differs from the kept page\'s title and H1, keeps the keyword and the 60-character limit', !(await pa('PA', 'same', [titleOf(md), KEPT_TITLE])) && !(await pa('PA', 'same', [titleOf(md), KEPT_H1])) && /^MS 365 ERP/i.test(titleOf(md)) && titleOf(md).length <= 60 && titleOf(md).length >= 25, titleOf(md));
    check('the H1 differs from the kept page\'s H1 and title and keeps the keyword', !(await pa('PA', 'same', [h1Of(md), KEPT_H1])) && !(await pa('PA', 'same', [h1Of(md), KEPT_TITLE])) && /ms 365 erp/i.test(h1Of(md)), h1Of(md));
    check('the kept page is linked exactly once, with its own heading as the anchor, in a middle section (never the introduction or the call to action)', linksTo(md, '/ms-365-erp-uae') === 1 && linksTo(old, '/ms-365-erp-uae') === 0
      && md.includes('For more on this, see our page [' + KEPT_H1 + '](' + W + '/ms-365-erp-uae).') && md.indexOf('/ms-365-erp-uae)') > md.indexOf('\n## ') && md.indexOf('/ms-365-erp-uae)') < md.lastIndexOf('\n## '), '');
    // nothing else changed: put the three lines back and the page is the recorded one, byte for byte
    const back = md.replace(/^Title:[ \t]*.*$/m, 'Title: ' + titleOf(old)).replace(/^# .+$/m, '# ' + h1Of(old)).replace('\n\nFor more on this, see our page [' + KEPT_H1 + '](' + W + '/ms-365-erp-uae).', '');
    check('nothing else of the page changed (the title, the H1 and the one new sentence put back give the recorded draft byte for byte)', back === old, back.length + ' vs ' + old.length);
    const fx = (r0.first.page_fix_applied || {}).fixes || [];
    check('the fixes say what changed and why, in plain words', fx.some(f => /^Gave the meta title its own wording \(".*"\): your existing page \/ms-365-erp-uae already uses "MS 365 ERP in the UAE: Dynamics 365 Partner \| Nova&" as its title tag, and two pages with one title compete for one search$/.test(f))
      && fx.some(f => /^Gave the main heading its own wording/.test(f)) && fx.some(f => /^Linked your existing page \/ms-365-erp-uae once, in the section "/.test(f)) && !fx.some(f => PLAIN.test(f)), J(fx));
    const r0b = await R.replay(K1, 'Page Fix', 0, { mocks: { 'Parse Brief': [{ json: PBI }] }, input: [{ json: { ...r0.input[0].json, output: md } }] });
    check('a second pass (the next round, the final version) changes nothing more', r0b.first.output === md && !((r0b.first.page_fix_applied || {}).fixes || []).some(f => /own wording|Linked your existing page/.test(f)), J((r0b.first.page_fix_applied || {}).fixes));
    // the editor's later rounds: the same three fixes, nothing else
    for (const k of [1, 2]) { const rk = await R.replay(K1, 'Page Fix', k, { mocks: { 'Parse Brief': [{ json: PBI }] } });
      const o = rk.recordedFirst.output, n = rk.first.output;
      const b2 = n.replace(/^Title:[ \t]*.*$/m, 'Title: ' + titleOf(o)).replace(/^# .+$/m, '# ' + h1Of(o)).replace('\n\nFor more on this, see our page [' + KEPT_H1 + '](' + W + '/ms-365-erp-uae).', '');
      check('editor round ' + k + ': own title and H1, one link, nothing else changed', b2 === o && !(await pa('PA', 'same', [titleOf(n), KEPT_TITLE])) && linksTo(n, '/ms-365-erp-uae') === 1, ''); }
    // Content QA on the fixed draft: it records the identity and keeps the link
    const pcRec = clone(K1.nodes['Promise Candidates']['0'].items);
    pcRec[0].json.output = md;
    const q = await R.replay(K1, 'Content QA', 0, { mocks: { 'Parse Brief': [{ json: PBI }], 'Page Fix': [{ json: { ...r0.first } }], 'Promise Candidates': pcRec }, input: [{ json: { ...r0.first } }] });
    const qa = q.first.content_qa; const id = qa.page_identity;
    show('page_identity', id);
    check('Content QA records the page identity: not the same title, not the same H1, linked, checked against the title and H1 read in this run', id && id.title_same === false && id.h1_same === false && id.linked === true && id.checked === true
      && /^the title tag and main heading of \/ms-365-erp-uae \(read in this run\)$/.test(id.basis), J(id));
    check('the link to the kept page survives the link check (one more internal link than the recorded check counted) and no identity warning is raised', linksTo(q.first.output, '/ms-365-erp-uae') === 1 && qa.internal_links === q.recordedFirst.content_qa.internal_links + 1
      && !(qa.warnings || []).some(w => /^Same (title|main heading)/.test(w)), J([qa.internal_links, q.recordedFirst.content_qa.internal_links]));
    check('the delivered meta title is the new one', q.first.meta.title === titleOf(md), J(q.first.meta));
    // the recorded check WITHOUT the fix: the same title flagged
    const qOld = await R.replay(K1, 'Content QA', 0, { mocks: { 'Parse Brief': [{ json: PBI }] } });
    const idOld = qOld.first.content_qa.page_identity;
    check('the recorded draft as it was (no Page Fix): Content QA flags the same title and the missing link', idOld && idOld.title_same === true && idOld.linked === false && idOld.same_as.field === 'title'
      && (qOld.first.content_qa.warnings || []).some(w => /^Same title as your existing page \/ms-365-erp-uae: the meta title repeats its title tag$/.test(w)), J(idOld));
    // the classify: a title that is still the same blocks; the fixed page does not
    const cls = await pa('PF', 'classify', [{ page_identity: idOld }, old, {}]);
    const clsOk = await pa('PF', 'classify', [{ page_identity: id }, md, {}]);
    check('a title still the kept page\'s blocks with a reason and an action; the fixed page has no such blocker', cls.blocking.some(b => b.code === 'same_title' && b.tier === 'hard' && /^The meta title is the same as the title tag of your existing page https:\/\/www\.novaand\.example\/ms-365-erp-uae, so the two pages would compete for one search$/.test(b.text))
      && !clsOk.blocking.some(b => b.code === 'same_title') && /title tag of its own/.test((await pa('PF', 'deliver', [cls, {}])).blocking.find(b => b.code === 'same_title').action), J(cls.blocking.map(b => b.code)));
    // when no title of its own can be written (synthetic: the kept page's title is "<keyword> | <brand>" and every candidate is the same)
    const AP2 = await pa('PA', 'of', [{ ...PBI, existing_page_ignored: { ...IGN, title_tag: 'MS 365 ERP | Nova&', h1: 'MS 365 ERP' } }]);
    const tiny = 'Title: MS 365 ERP | Nova&\nMeta Description: x\n\n# MS 365 ERP\n\nIntro.\n\n## MS 365 ERP\n\nText.\n\n## Contact\n\nCall us.';
    const f2 = await pa('PA', 'fix', [tiny, AP2, { keyword: 'ms 365 erp', business: 'Nova&', brand: 'Nova&', title_variants: [] }]);
    check('no candidate differs: the title is left, recorded as left, and Content QA would block it (no silent pass)', f2.title && f2.title.left === true && titleOf(f2.md) === 'MS 365 ERP | Nova&' && (await pa('PA', 'check', [f2.md, AP2])).title_same === true, J(f2.title));
    // a keyword whose words a title carries in another order (synthetic): a variant with every word of it is a title of its own
    const AP4 = await pa('PA', 'of', [{ ...PBI, keyword: 'erp software uae', existing_page_ignored: { url: W + '/erp-software-uae', title_tag: 'ERP Software in the UAE | Nova&', h1: 'ERP Software in the UAE', identity_from: 'read in this run' } }]);
    const page4 = 'Title: ERP Software in the UAE | Nova&\nMeta Description: x\n\n# ERP Software in the UAE\n\nIntro.\n\n## How to choose ERP software in the UAE\n\nText about choosing.\n\n## Talk to us\n\nCall us.';
    const f4 = await pa('PA', 'fix', [page4, AP4, { keyword: 'erp software uae', business: 'Nova&', brand: 'Nova&', title_variants: ['Choosing ERP Software for UAE Firms | Nova&'] }]);
    check('the keyword in another order ("ERP Software ... UAE"): the brief\'s variant becomes the title, and the H1 gets its own wording too', titleOf(f4.md) === 'Choosing ERP Software for UAE Firms | Nova&'
      && !(await pa('PA', 'same', [h1Of(f4.md), 'ERP Software in the UAE'])) && /erp software/i.test(h1Of(f4.md)), J([titleOf(f4.md), h1Of(f4.md)]));
    // the 402 run: nothing read, nothing on file; the title cannot be compared, the link is still added (anchor from the address)
    const AP3 = await pa('PA', 'of', [{ ...PBI, existing_page_ignored: { ...PB.existing_page_ignored, title_tag: '', h1: '', identity_from: '' } }]);
    const r3 = await R.replay(K1, 'Page Fix', 0, { mocks: { 'Parse Brief': [{ json: { ...PBI, existing_page_ignored: { ...PB.existing_page_ignored, title_tag: '', h1: '', identity_from: '' } } }] } });
    check('nothing read (the 402 run): the title is not touched (nothing to compare), the kept page is still linked once with its address in words, and the check says "not checked"', titleOf(r3.first.output) === KEPT_TITLE
      && linksTo(r3.first.output, '/ms-365-erp-uae') === 1 && r3.first.output.includes('[MS 365 ERP UAE](' + W + '/ms-365-erp-uae)') && /^not checked/.test((await pa('PA', 'check', [r3.first.output, AP3])).basis), '');
  });

  // ---------- W07B5 the second read ----------
  await guard('W07B5 second read', async () => {
    const SN = 'W07B5 (W07-B) the second read is told the client\'s choice and its advice to take the kept page\'s slug (K1: "Use the slug ms-365-erp-uae") is set aside; a remark about the link itself is kept; any other run is read as before';
    reset(); begin(SN); const check = mkCheck(SN);
    const md = 'Title: MS 365 ERP Explained: Choosing Dynamics 365 in the UAE\nMeta Description: ' + 'm'.repeat(90) + '\nSlug: ms-365-erp\n\n# MS 365 ERP Explained\n\nMS 365 ERP means Dynamics 365. For more on this, see our page [' + KEPT_H1 + '](' + W + '/ms-365-erp-uae).\n\n## Which app fits\n\nBusiness Central suits smaller firms. Finance suits groups.\n\n## Contact\n\nBook a consultation.';
    const item = { output: md, content_qa: { delivery: { status: 'ready', blocking: [], advisory: [] } } };
    const prev = { ...PBI, content_brief: { ...PBI.content_brief, slug: 'ms-365-erp' } };
    const plan = await pa('RR', 'plan', [item, prev, { today: '2026-10-30' }]);
    const prompt = JSON.parse(plan.body).messages[0].content;
    check('the read is told: a separate new page at /ms-365-erp, the kept page stays, never its address or slug, a link to it is wanted', plan.skip === false && /THE CLIENT'S CHOICE: this page is a separate new page at its own address \(\/ms-365-erp\)\. https:\/\/www\.novaand\.example\/ms-365-erp-uae is the business's existing page on the same search/.test(prompt)
      && /Never suggest that this page take that page's address or slug/.test(prompt) && plan.apart && plan.apart.path === '/ms-365-erp-uae' && J(plan.apart.slugs) === J(['ms-365-erp-uae']), J(plan.apart));
    const planPlain = await pa('RR', 'plan', [item, { ...prev, existing_page_ignored: null }, { today: '2026-10-30' }]);
    const planNoPa = (await run('RR Kit', [{ json: { kit: 'RR', fn: 'plan', args: [item, { ...prev, existing_page_ignored: null }, { today: '2026-10-30' }] } }], { code: '_critic_reread' }))[0].json.r;
    check('any other run: no note, no apart, the request byte for byte what the kit sent before', !/THE CLIENT'S CHOICE/.test(planPlain.body) && !planPlain.apart && planPlain.body === planNoPa.body, '');
    // the K1 answer (anonymised): the slug advice, a link remark naming the kept page, and an ordinary piece of advice
    const answer = { model: 'claude-sonnet-5-5', stop_reason: 'end_turn', usage: { input_tokens: 14376, output_tokens: 1841 }, content: [{ type: 'text', text: J({ score: 66, problems: [
      { severity: 'low', kind: 'structure', location: 'MS 365 ERP Explained: Choosing Dynamics 365 in the UAE', issue: 'The slug \'ms-365-erp\' differs from the live URL /ms-365-erp-uae. The meta description is also short on benefit.', fix: 'Use the slug ms-365-erp-uae and make sure the meta description is 120-155 characters.' },
      { severity: 'medium', kind: 'other', location: 'MS 365 ERP means Dynamics 365', issue: 'Cannibalisation: this page competes with /ms-365-erp-uae.', fix: 'Merge this page into /ms-365-erp-uae and redirect it.' },
      { severity: 'medium', kind: 'link', location: 'For more on this, see our page', issue: 'The link to /ms-365-erp-uae uses a long anchor.', fix: 'Replace the anchor with a shorter description of that page.' },
      { severity: 'medium', kind: 'depth', location: 'Business Central suits smaller firms. Finance suits groups.', issue: 'The decision is left vague.', fix: 'Add one concrete example of a group with three entities.' }] }) }] };
    const rd = await pa('RR', 'read', [answer, md, plan, '__PF__']);
    show('read', { advice: rd.advice.map(a => a.kind), against: (rd.against_choice || []).map(a => a.kind + ': ' + a.fix.slice(0, 40)) });
    check('the slug advice and the merge-and-redirect advice are set aside with the reason; the link remark and the depth advice are kept', (rd.against_choice || []).length === 2 && rd.against_choice.every(a => /^set aside: it advises taking over the existing page the client chose to keep \(\/ms-365-erp-uae\)$/.test(a.why))
      && rd.problems.length === 2 && rd.problems.some(p => p.kind === 'link') && rd.problems.some(p => p.kind === 'depth') && !rd.problems.some(p => /ms-365-erp-uae and make sure|Merge this page/.test(p.fix)), J(rd.problems.map(p => p.kind)));
    const ap = await pa('RR', 'apply', [item.content_qa, rd, '__PF__']);
    check('the record keeps what was set aside; the client never sees it as advice', (ap.critic_reread.against_choice || []).length === 2 && !ap.delivery.advisory.some(a => /ms-365-erp-uae and make sure|Merge this page/.test(a.text)), J(ap.delivery.advisory));
    const rdPlain = await pa('RR', 'read', [answer, md, planPlain, '__PF__']);
    check('an ordinary run reads the same answer as before: nothing set aside, no new field', !('against_choice' in rdPlain) && rdPlain.problems.length === 4, J(Object.keys(rdPlain)));
  });

  // ---------- W07B6 the pages that rank and every other run ----------
  await guard('W07B6 unchanged', async () => {
    const SN = 'W07B6 (W07-B) the guide that ranks (949, a ladder page), a rewrite and an ordinary run: the page kit with PA fixes the page byte for byte as the kit without it, and the contract is the same';
    reset(); begin(SN); const check = mkCheck(SN);
    const prev949 = { ...G.brief, ladder_rung: G.ladder_rung, existing_page_ignored: { url: G.published_url.replace('/insights/', '/'), planned_url: G.ladder_target_url_at_run, why: 'the keyword ladder planned a new page for this keyword' } };
    const cases = [['the guide that ranks (949)', prev949, G.live_markdown], ['a rewrite ("Improve the existing page")', { ...PBI, existing_page: { url: W + '/ms-365-erp-uae', source: 'provided' } }, K1.runs['Page Fix'][0].input[0].json.output],
      ['an ordinary run', { ...PBI, existing_page_ignored: null }, K1.runs['Page Fix'][0].input[0].json.output]];
    for (const [why, p, md] of cases) {
      const cA = await pa('PF', 'ctxOf', [p, {}]); const cB = await pfNoPa('ctxOf', [p, {}]);
      const fA = await pa('PF', 'fix', [md, cA]); const fB = await pfNoPa('fix', [md, cB]);
      const tA = await pa('PF', 'contract', [p]); const tB = await pfNoPa('contract', [p]);
      check(why + ': no kept page, the same fixed page and fixes, the same contract', cA.apart === null && fA.md === fB.md && J(fA.fixes) === J(fB.fixes) && tA.text === tB.text, J([cA.apart, fA.fixes.length, fB.fixes.length]));
    }
    // and the guide's own text: its title and H1 are its own (nothing to compare with), so nothing here could touch them
    check('the guide 949 keeps its title and H1', titleOf((await pa('PF', 'fix', [G.live_markdown, await pa('PF', 'ctxOf', [prev949, {}])])).md) === titleOf(G.live_markdown), '');
  });
};
