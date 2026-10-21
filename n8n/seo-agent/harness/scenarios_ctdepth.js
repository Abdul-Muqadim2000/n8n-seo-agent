// CTD1-CTD3 (CT-DEPTH 2026-10-22, scorecard 2026-10-17 §3.3 C8 / C12). Replayed on the real pre-launch run (exec 42, "ai consultant",
// harness/fixtures_eqa_42.json.gz) and on techand.ai's own live pages saved 2026-10-21 (harness/fixtures_inbound_techand.json.gz).
//   CTD1 C8: the length target is a band from the ranking pages of the kind being written (median + interquartile range inside the
//        page-type band, stated with the sample); exec 42 read no service page, so the page-type band is used and said so; the hub band
//        (lost since the G33 re-read) is back; Parse Brief's guard keeps the brief inside the band.
//   CTD2 C12 kit: the site's own pages that should link to the new page (no legal / contact / gone page, no home page while another fits),
//        verified (200, not noindex, no link to it yet), with a section, varied anchors (one exact match at most) and a sentence.
//   CTD3 C12 nodes: Inbound Candidates -> Inbound Links -> Blog Package: meta.json carries the picks, the checklist names them.
// Every check fails on the code before CT-DEPTH (no length_band, hub band 900-2,400, no INB kit, no inbound nodes, generic checklist line).
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
module.exports = async (ctx) => {
  const { H, run, mock, guard, reset, begin } = ctx;
  const CD = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const FX = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures_eqa_42.json.gz'))).toString());
  const LIVE = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures_inbound_techand.json.gz'))).toString()).pages;
  const TELL = /[—–…→]/;
  const SM42 = { ...(FX.parse_brief.site_model || {}), domain: 'techand.ai', canonical_host: 'www.techand.ai' };

  await guard('CTD1 C8 the length band', async () => {
    const SN = 'CTD1 C8 — the length target is the range of the ranking pages of the same kind, stated with its sample';
    reset(); begin(SN); const check = mkCheck(SN);
    // a) exec 42 as it ran: a certification course, a list, a job guide, a directory and a knowledge-base article; no service page
    mock('Collect Facts', [{ json: clone(FX.collect_facts) }]);
    const A = (await run('Parse Analysis', [{ json: { output: { recommended_word_count: 1800 } } }]))[0].json;
    const B = A.length_band || (A.competitor_analysis || {}).length_band;
    check('exec 42: a length band is set (it was one figure before)', !!B, J(Object.keys(A).filter(k => /length|word/.test(k))));
    check('exec 42: no service page read -> the page-type band 900-2,400, said so', B && B.ok === false && B.source === 'page_type' && B.low === 900 && B.high === 2400
      && /service page/.test(B.basis) && /900-2,400 words/.test(B.basis) && /3 are needed/.test(B.basis), J(B));
    check('exec 42: the target stays the clamped figure (1,800)', A.competitor_analysis.recommended_word_count === 1800 && B && B.target_word_count === 1800, J(B && B.target_word_count));
    // b) the same results with five readable service pages (exec 42's blocked Dubai service page among them): the band is theirs
    const svc = [['www.bell-integration.com', 'https://www.bell-integration.com/services/ai-consultant-in-dubai/', 'AI Consultant in Dubai | Bell Integration', 1400],
      ['www.kineticconsulting.ae', 'https://www.kineticconsulting.ae/services/ai-consulting/', 'AI Consulting Services in Dubai - Kinetic Consulting', 1650],
      ['www.atilab.ae', 'https://www.atilab.ae/services/ai-consulting-services/', 'AI Consulting Services | ATI Lab', 1800],
      ['www.datasyst.ae', 'https://www.datasyst.ae/services/ai-consultant/', 'AI Consultant Services | Datasyst', 2050],
      ['www.mindbridge.ae', 'https://www.mindbridge.ae/services/ai-consulting/', 'Enterprise AI Consulting Services | MindBridge', 2600]];
    const base = FX.collect_facts.competitors.find(c => c.domain === 'opsiocloud.com');
    const cf = clone(FX.collect_facts);
    cf.competitors = cf.competitors.concat(svc.map(([domain, url, title, wc], i) => ({ ...clone(base), domain, url, title, word_count: wc, rank: 12 + i, has_author: false, has_date: false })));
    mock('Collect Facts', [{ json: cf }]);
    const A2 = (await run('Parse Analysis', [{ json: { output: { recommended_word_count: 2400 } } }]))[0].json; const B2 = A2.length_band || {};
    console.log('   band (5 service pages) ->', B2.low, B2.high, B2.median, '|', B2.basis);
    check('5 service pages: the band is their middle half (1,700-2,100), the target their median (1,800)', B2.ok === true && B2.sample === 5 && B2.low === 1700 && B2.high === 2100 && B2.target_word_count === 1800
      && A2.competitor_analysis.recommended_word_count === 1800, J(B2));
    check('5 service pages: the basis says the range and the sample in plain words', /^pages ranking for this run 1,700-2,100 words \(5 service pages/.test(B2.basis || '') && !TELL.test(B2.basis || ''), B2.basis);
    check('5 service pages: the list, the course and the guides are not in the sample', (B2.pages || []).every(p => p.kind === 'service') && !(B2.pages || []).some(p => /usaii|consultancy-me|opsiocloud/.test(p.url)), J((B2.pages || []).map(p => p.url)));
    // c) the hub band is applied again (it was a build patch the G33 re-read dropped: a hub got the service band)
    mock('Collect Facts', [{ json: { ...clone(FX.collect_facts), page_type: 'Pillar / hub page' } }]);
    const A3 = (await run('Parse Analysis', [{ json: { output: { recommended_word_count: 1200 } } }]))[0].json;
    check('hub page: 1,800-3,500 words, not the service band', A3.competitor_analysis.recommended_word_count === 1800 && (A3.length_band || {}).page_type_band && A3.length_band.page_type_band.low === 1800 && A3.length_band.page_type_band.high === 3500, J(A3.length_band && A3.length_band.page_type_band));
    // d) Parse Brief's guard: inside the band the brief keeps its number, outside it goes to the median; without a band, 10% as before
    const pb = fs.readFileSync(path.join(CD, 'Parse_Brief.js'), 'utf8');
    const a = pb.indexOf('const EXC = (() => {'), b = pb.indexOf('// Word count check');
    check('Parse Brief carries the guard', a >= 0 && b > a, 'markers not found');
    const G = new Function('brief', 'prev', pb.slice(a, b) + '\nreturn { brief, adjustments };');
    const out = (asked, prevX) => G({ target_word_count: asked, outline: [{ h2: 'A', target_words: asked / 2 }, { h2: 'B', target_words: asked / 2 }] }, { keyword: 'ai consultant', ...prevX });
    const g1 = out(2000, { competitor_analysis: A2.competitor_analysis });
    check('guard: 2,000 inside the 1,700-2,100 band is kept', g1.brief.target_word_count === 2000 && !g1.adjustments.length, J(g1));
    const g2 = out(3100, { competitor_analysis: A2.competitor_analysis });
    check('guard: 3,100 outside the band goes to the median 1,800, with the band named', g2.brief.target_word_count === 1800 && /pages ranking for this run 1,700-2,100 words/.test(g2.adjustments.join(' ')), J(g2.adjustments));
    const g3 = out(2000, { competitor_analysis: A.competitor_analysis });
    check('guard: no band (exec 42) -> within 10% of 1,800 as before', g3.brief.target_word_count === 1980 && /within 10%/.test(g3.adjustments.join(' ')), J(g3));
  });

  const kit = () => { const src = fs.readFileSync(path.join(CD, 'Inbound_Links.js'), 'utf8'); const a = src.indexOf('const INB = (() => {'), b = src.indexOf('\n})();', a);
    if (a < 0 || b < 0) throw new Error('the inbound-link kit is not inlined in Inbound Links'); return new Function(src.slice(a, b + 6) + '\nreturn INB;')(); };
  const TARGET = { url: 'https://www.techand.ai/ai-consultant', keyword: 'ai consultant', md: FX.build_word_file.page_markdown, title: 'AI Consultant UAE: From Readiness to Governed AI | Tech&',
    secondary: ['ai consultant uae', 'ai consulting', 'ai readiness assessment', 'ai governance'], kind: 'service' };
  // the pages fetched today: the saved live copies; an inventory address with no copy is one of the old addresses that answer 404 (RV-1)
  const fetchedFor = (cands, edit) => cands.map(c => { const k = c.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, ''); const L = LIVE.find(p => p.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '') === k);
    if (L) return { url: c.url, status: L.status, html: edit ? edit(c.url, L.html) : L.html };
    const inv = (SM42.pages || []).find(p => p.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '') === k);
    return inv && inv.source === 'gsc' ? { url: c.url, status: 404, html: '' } : null; }).filter(Boolean);

  await guard('CTD2 C12 the inbound-link kit', async () => {
    const SN = 'CTD2 C12 — which live pages of techand.ai should link to the new "ai consultant" page, verified';
    reset(); begin(SN); const check = mkCheck(SN);
    const INB = kit(); const T = INB.target(TARGET);
    const cands = INB.candidates(SM42.pages, T, { domain: 'techand.ai', max: 10 });
    console.log('   candidates ->', cands.map(c => c.path + ' ' + c.score).join(' | '));
    check('candidates: 10 at most, AI Automation among the first three', cands.length >= 3 && cands.length <= 10 && cands.slice(0, 3).some(c => c.path === '/whatwedo/ai-automation'), J(cands.map(c => c.path)));
    check('candidates: no legal, contact or home page, not the new page itself', !cands.some(c => /privacy|cookies|security|contact|^\/$|^\/ai-consultant$/.test(c.path)), J(cands.map(c => c.path)));
    const R = INB.pick(cands, fetchedFor(cands), T, { min: 3, max: 5 });
    console.log('   picks ->', R.picks.map(p => p.source_path + ' | ' + p.where + ' | "' + p.anchor + '"').join(' || '));
    console.log('   left out ->', R.left_out.map(l => l.url.replace(/^https:\/\/[^/]+/, '') + ': ' + l.reason).join(' | '));
    check('3-5 picks, each a page that answered 200 today', R.picks.length >= 3 && R.picks.length <= 5 && R.picks.every(p => p.status === 200), J(R.picks.map(p => [p.source_path, p.status])));
    check('every pick names the section it fits under (the live pages have headings)', R.picks.every(p => p.heading && /^in the section "/.test(p.where)), J(R.picks.map(p => p.where)));
    check('anchors differ, at most one exact match of the keyword', new Set(R.picks.map(p => p.anchor.toLowerCase())).size === R.picks.length && R.picks.filter(p => p.exact_match).length <= 1, J(R.picks.map(p => p.anchor)));
    check('anchors read as words: no leading article, acronyms in capitals', R.picks.every(p => !/^(?:an?|the) /i.test(p.anchor) && !/\b(?:ai|uae|gcc)\b/.test(p.anchor)), J(R.picks.map(p => p.anchor)));
    check('the sentence links the anchor to the new page', R.picks.every(p => p.sentence_md.includes('[' + p.anchor + '](https://www.techand.ai/ai-consultant)')), J(R.picks.map(p => p.sentence_md)));
    check('a gone address is left out with its status, a noindex page with its reason', R.left_out.every(l => /answered 404|not to index|not found|already links|could not be read|not checked/.test(l.reason)), J(R.left_out));
    check('no em dash, ellipsis or arrow in what the client reads', !TELL.test(J(R.picks.map(p => [p.where, p.anchor, p.sentence])) + R.basis + INB.checklist(R)), INB.checklist(R));
    // a page that already links to the new page is not proposed again
    const first = R.picks[0].source_url;
    const R2 = INB.pick(cands, fetchedFor(cands, (u, h) => u === first ? h.replace('</main>', '<a href="/ai-consultant/">AI consultant</a></main>').replace('</body>', '<a href="https://techand.ai/ai-consultant">x</a></body>') : h), T, { min: 3, max: 5 });
    check('a page that already links to it is left out with that reason', !R2.picks.some(p => p.source_url === first) && R2.left_out.some(l => l.url === first && /already links/.test(l.reason)), J(R2.left_out));
    // the home page only when nothing else fits
    const onlyHome = INB.candidates([{ url: 'https://www.techand.ai', title: 'Tech | Turning Technology into measurable Business Impact' }, { url: 'https://www.techand.ai/privacy', title: 'Privacy Policy | Tech' }], T, { domain: 'techand.ai' });
    check('the home page stands in only when no other page fits', onlyHome.length === 1 && onlyHome[0].home, J(onlyHome));
    const noHome = INB.candidates(SM42.pages, T, { domain: 'techand.ai', max: 40 });
    check('the home page is not a candidate while other pages fit', !noHome.some(c => c.home), J(noHome.map(c => c.path)));
  });

  await guard('CTD3 C12 the nodes and the blog package', async () => {
    const SN = 'CTD3 C12 — Inbound Candidates -> Fetch Inbound Pages -> Inbound Links -> Blog Package (meta.json + checklist)';
    reset(); begin(SN); const check = mkCheck(SN);
    const bw = { ...clone(FX.build_word_file), ladder_links: clone(FX.ladder_links), site_model: SM42 };
    mock('Attach PDF Report', [{ json: bw, binary: {} }]);
    mock('Site Model', [{ json: { site_model: SM42 } }]);
    const C = await run('Inbound Candidates', [{ json: bw }]);
    check('Inbound Candidates: one item per candidate, each with a URL on the canonical host', C.length >= 3 && C.every(i => /^https:\/\/www\.techand\.ai\//.test(i.json.url)) && !!C[0].json.target_in, J(C.map(i => i.json.url)));
    check('the target is the ladder\'s planned URL', /techand\.ai\/ai-consultant\/?$/.test(C[0].json.target_in.url), C[0].json.target_in.url);
    const fetched = fetchedFor(C.map(i => ({ url: i.json.cand.url })));
    const http = fetched.map(f => ({ json: { statusCode: f.status, headers: {}, data: f.html } }));
    const L = (await run('Inbound Links', http))[0];
    const IL = L.json.inbound_links || {};
    check('Inbound Links: 3-5 verified picks on the run item', (IL.picks || []).length >= 3 && (IL.picks || []).length <= 5 && /checked today/.test(IL.basis || ''), J(IL));
    const P = (await run('Blog Package', [L]))[0].json; const M = P.article_meta || {};
    check('meta.json carries the inbound links with the suggested URL', M.inbound_links && M.inbound_links.picks.length === IL.picks.length && M.inbound_links.picks.every(p => p.sentence_md.includes('](' + M.suggested_url + ')')), J(M.inbound_links && M.inbound_links.picks.map(p => p.sentence_md)));
    check('the checklist names the pages ("Add these links from your existing pages")', M.publish_checklist.some(x => /^Add these links from your existing pages/.test(x) && x.includes(IL.picks[0].anchor))
      && !M.publish_checklist.some(x => /add 2-3 links to this page from existing pages/.test(x)), J(M.publish_checklist));
    // a run without a page passes straight through; a page with no candidate keeps the generic advice
    mock('Inbound Candidates', [{ json: { skip: true, why: 'no page of the site shares the new page\'s topic', target_in: { url: 'https://www.techand.ai/x' } } }]);
    const L0 = (await run('Inbound Links', [{ json: { skip: true } }]))[0];
    check('no candidate: no picks, the reason kept', L0.json.inbound_links && L0.json.inbound_links.picks.length === 0 && /shares the new page/.test(L0.json.inbound_links.basis), J(L0.json.inbound_links));
    const P0 = (await run('Blog Package', [L0]))[0].json;
    check('no picks: the generic checklist line stays', (P0.article_meta.publish_checklist || []).some(x => /add 2-3 links to this page from existing pages/.test(x)), J(P0.article_meta.publish_checklist));
  });
};
