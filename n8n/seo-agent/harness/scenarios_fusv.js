// FUSV1-FUSV6 (page-quality follow-up 2026-10-29, BASELINE.md "Recurring defects" rows the plan did not cover): sources, byline, voice.
// The paid BEFORE run (8 pages on 3 sites, judged blind) found three defects no Wave 0 fix touches:
//   * citations that are Google redirects: one run's facts search answered 16 of 19 results as https://google.com/goto?url=<token> with
//     domain "google.com" (rated high authority because it is Google), and all 5 citations of the delivered page pointed there (K7);
//   * the byline printed twice: the package's structured byline plus the writer's own "Written by ... and reviewed by ..." paragraph
//     (3 of 8 pages; the brief context opened "Written by <author>.", which the writer copied);
//   * the client described from the outside on its own site: "Its website states 20+ years of industry experience", "its site states 5
//     years and 100+ projects", "<name> lists X among its business applications" (5 of 8 pages; the facts on file were worded that way).
// Fixtures: replay_3299.json.gz (anonymised page run, Nova& / novaand.example) and ranking_guide_949.json (the guide that ranks: the
// owner's guard, nothing here may change it). The redirect tokens below are synthetic.
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const R = require('./replay')(H);
  const CODE_DIR = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const FX = {};
  const fx = (name) => FX[name] || (FX[name] = name.endsWith('.gz') ? R.load(name) : JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8')));
  // the kits as generated: SRC from its shim, CL from the generated Content QA (one copy each, the code that runs in production)
  const kitSrc = fs.readFileSync(path.join(CODE_DIR, '_sources.js'), 'utf8');
  const SRC = new Function(kitSrc.slice(0, kitSrc.indexOf('\nreturn $input')) + '\nreturn SRC;')();
  const cqa = fs.readFileSync(path.join(CODE_DIR, 'Content_QA.js'), 'utf8');
  const clAt = cqa.indexOf('const CL = (() => {');
  const CL = new Function(cqa.slice(clAt, cqa.indexOf('\n})();', clAt) + 6) + '\nreturn CL;')();
  const GOTO = 'https://google.com/goto?url=CAESagHrOzAVYgvVpSg_JQSTJ99WFjonOhOSJH95hAvEv2jOYpndLVvxvUjkkWewgy4hHK2';
  const GOTO2 = 'https://google.com/goto?url=CAESdQHrOzAVeWhVDnLnzNoz6Mi158oJYFB4QJ0BJ31l8njsmfxkWTvwt5Z73zc7I4Mfz134K';
  const GURL = 'https://www.google.com/url?q=https%3A%2F%2Fwww.mof.gov.ae%2Fen%2Fe-invoicing%3Futm_source%3Dx&sa=U&ved=2ahUKEwi';
  const VERTEX = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHx9Ab3Cd4Ef5Gh6';
  const BING = 'https://www.bing.com/ck/a?!&&p=abc&u=a1' + 'aHR0cHM6Ly93d3cuZXhhbXBsZS5vcmcvcmVwb3J0' + '&ntb=1';   // a1 + base64url("https://www.example.org/report")

  // ---------- FUSV1 the source kit knows a redirect and what it leads to ----------
  await guard('FUSV1 redirect kit', async () => {
    const SN = 'FUSV1 (2026-10-29, BEFORE run K7) the source kit: a search-engine redirect is resolved to its target or known to be opaque';
    reset(); begin(SN); const check = mkCheck(SN);
    check('the K7 form (google.com/goto, opaque token) is a redirect with no target', SRC.isRedirect(GOTO) && SRC.unwrap(GOTO) === '', SRC.unwrap(GOTO));
    check('Google /url?q= is resolved, decoded and cleaned of its tracking parameters', SRC.clean(GURL) === 'https://www.mof.gov.ae/en/e-invoicing', SRC.clean(GURL));
    check('the Vertex AI grounding redirect is opaque', SRC.isRedirect(VERTEX) && SRC.unwrap(VERTEX) === '');
    check('Bing /ck/a with u=a1<base64> is resolved', SRC.unwrap(BING) === 'https://www.example.org/report', SRC.unwrap(BING));
    check('an ordinary page is not a redirect and keeps its link (google.com documentation too)', !SRC.isRedirect('https://www.example.org/url?x=1') && !SRC.isRedirect('https://developers.google.com/search/docs')
      && SRC.clean('https://developers.google.com/search/docs?utm_source=a') === 'https://developers.google.com/search/docs');
    check('an opaque redirect is rated weak, never "vendor" because it is on google.com', SRC.tier(GOTO) === 'weak' && SRC.tier(GURL) === 'primary', SRC.tier(GOTO) + ' / ' + SRC.tier(GURL));
    const u = SRC.unredirect('Only 16% track it ([industry analysis](' + GOTO + ')). See [the rules](' + GURL + ') and <a href="' + VERTEX + '">this summary</a>, ' + GOTO2 + ' and [a page](https://www.example.org/a).');
    check('unredirect: the opaque link keeps its words, the resolvable one links its target, an ordinary link is untouched',
      u.text === 'Only 16% track it (industry analysis). See [the rules](https://www.mof.gov.ae/en/e-invoicing) and this summary,  and [a page](https://www.example.org/a).'
      && u.dropped.length === 3 && u.resolved.length === 1, J(u));
    check('a text with no redirect is returned as it is', SRC.unredirect('[a](https://www.example.org/a) b').text === '[a](https://www.example.org/a) b');
  });

  // ---------- FUSV2 Collect Facts never makes a redirect a fact ----------
  await guard('FUSV2 collect facts', async () => {
    const SN = 'FUSV2 (2026-10-29, K7: 16 of 19 facts results were google.com/goto) Collect Facts reads a redirect as its target or leaves it out; "google.com" is never a source';
    reset(); begin(SN); const check = mkCheck(SN);
    const acp = clone(fx('replay_3299.json.gz').nodes['Analyze Competitor Pages']['0'].items[0].json);
    const org = (url, domain, title, description, extra) => ({ type: 'organic', url, domain, title, description, ...(extra || {}) });
    const serp = { tasks: [{ id: 'fusv', status_code: 20000, cost: 0.002, result: [{ items: [
      org(GOTO, 'google.com', '22 Best AI Visibility Tools for 2026', 'Oct 2, 2026 - Only 16% of brands track AI search visibility systematically, a 2026 survey found.', { breadcrumb: 'https://www.rankability.example › Blog', website_name: 'Rankability' }),
      org(GURL, 'google.com', 'E-invoicing in the UAE', 'The Ministry of Finance says 2027 is the first phase for businesses with revenue of AED 50 million or more.'),
      org('https://www.example-research.com/erp-stats', 'example-research.com', 'ERP statistics', 'In 2026, 62% of mid-size firms run a cloud ERP, up from 48% in 2023.')] }] }] };
    mock('Analyze Competitor Pages', [{ json: acp }]); mock('Facts SERP', [{ json: serp }]); delete store['Facts SERP (Retry)']; delete store['Collect Regulatory Facts'];
    const out = (await run('Collect Facts', [{ json: serp }]))[0].json;
    const urls = (out.facts || []).map(f => f.url);
    check('no fact carries a redirect or the source "google.com"', !(out.facts || []).some(f => SRC.isRedirect(f.url) || /(^|\.)google\.com$/.test(f.source)), J(out.facts));
    check('the redirect that carries its target becomes a fact on the target (an official page, rated primary)', (out.facts || []).some(f => f.url === 'https://www.mof.gov.ae/en/e-invoicing' && f.source === 'mof.gov.ae' && f.tier === 'primary'), J(out.facts));
    check('the ordinary result is kept as before', urls.includes('https://www.example-research.com/erp-stats'), J(urls));
    check('the opaque redirect is named in facts_unlinkable with the site it came from, not used', (out.facts_unlinkable || []).length === 1 && out.facts_unlinkable[0].site === 'Rankability', J(out.facts_unlinkable));
  });

  // the guide that ranks, through today's Content QA in the 3299 context (as RPL4), optionally with extra paragraphs after its first H2
  const guideQA = async (extra) => {
    const F = fx('replay_3299.json.gz'); const G = fx('ranking_guide_949.json');
    let md = G.live_markdown;
    if (extra) { const lines = md.split('\n'); const at = lines.findIndex(l => /^## /.test(l)); lines.splice(at + 1, 0, '', ...extra.flatMap(p => [p, ''])); md = lines.join('\n'); }
    const pb = clone(F.nodes['Parse Brief']['0'].items[0].json);
    Object.assign(pb, { keyword: G.keyword, page_type: 'Guide', recommended_page: 'Guide', page_role: G.brief.page_role || 'standard', pipeline_source: 'ladder', force_content: true,
      ladder_id: G.brief.ladder_id, ladder_rung: G.ladder_rung, ladder_target_url: G.published_url, existing_page_url: '', secondary_keywords: [],
      length_band: { ok: true, source: 'serp', low: 1800, high: 3000, median: 2898, target_word_count: 2900, sample: 5, kind: 'guide' } });
    pb.content_brief = { ...(pb.content_brief || {}), target_word_count: 2900, secondary_keywords: [] };
    const rec = F.runs['Content QA'][2];
    const input = clone(rec.input); input[0].json = { ...input[0].json, ...pb, output: md, qa_round: 1 };
    const pf = clone(F.nodes['Page Fix']['2'].items); pf[0].json.output = md;
    // 'Promise Candidates' is taken away: Content QA reads its recorded item (the 3299 draft) before $input when it carries the judge,
    // so with it in place the page checked would be the 3299 draft, not the one given here
    return (await R.replay(F, 'Content QA', 2, { input, mocks: { 'Parse Brief': [pb], 'Page Fix': pf, 'Promise Candidates': null }, runIndex: 0 })).first;
  };

  // ---------- FUSV3 Content QA: the citations ----------
  await guard('FUSV3 content qa redirects', async () => {
    const SN = 'FUSV3 (2026-10-29, K7) Content QA never ships a redirect as a citation: the target when the redirect carries it, else the words without the link';
    reset(); begin(SN); const check = mkCheck(SN);
    const q = await guideQA(['Few firms measure this yet ([industry analysis of AI search tracking](' + GOTO + ')). The [Ministry of Finance e-invoicing page](' + GURL + ') sets the timeline.']);
    const out = String(q.output || ''); const c = q.content_qa || {};
    check('no redirect left in the page', !/google\.com\/goto|google\.com\/url|grounding-api-redirect/.test(out), (out.match(/.{60}google\.com\/(?:goto|url).{20}/) || [''])[0]);
    check('the attribution stays readable without its link', out.includes('(industry analysis of AI search tracking)'), (out.match(/.{80}industry analysis.{40}/) || [''])[0]);
    check('the resolvable redirect now links the official page itself', out.includes('[Ministry of Finance e-invoicing page](https://www.mof.gov.ae/en/e-invoicing)'), (out.match(/.{10}Ministry of Finance e-invoicing page.{80}/) || [''])[0]);
    check('no outbound link to check is a redirect, and the counts are reported', !(c.outbound_links || []).some(l => SRC.isRedirect(l.url)) && (c.source_redirects || {}).resolved === 1 && (c.source_redirects || {}).dropped === 1, J(c.source_redirects));
    check('the owner is told what was done, in plain words', J(q).includes('search engine redirect') && !/[—–]/.test((J(q).match(/[^"]*search engine redirect[^"]*/g) || []).join(' ')), (J(q).match(/[^"]*search engine redirect[^"]*/g) || []).join(' | '));
  });

  // ---------- FUSV4 Content QA: the business's own voice, and the claim check still reads the claim ----------
  await guard('FUSV4 content qa voice', async () => {
    const SN = 'FUSV4 (2026-10-29, 5 of 8 pages) the client\'s own facts are never reported from the outside on its own site; the claim check reads the rewritten claim';
    reset(); begin(SN); const check = mkCheck(SN);
    const v = CL.voice([
      'Nova& is a Microsoft partner based in a Dubai free zone, and its business applications span all of the above. Its website states 20+ years of industry experience.',
      'It serves enterprises across the UAE and GCC, and its website states Managed Services and 24/7 support.',
      'Nova&\'s site reports 5 years of work, 100+ projects and a 95% client satisfaction rate.',
      'Nova& lists Project Operations among its business applications for UAE services firms.',
      'According to its website, Nova& works from Dubai.',
      'Nova& is certified, and its site names Contoso and Fabrikam among those that trust it.',
      'The Ministry has amended its decisions, so read the current text on its e-invoicing page. According to the FTA\'s website, registration opens in 2027.',
      '"Its website states nothing," the reviewer said of Nova&.',
      '## Its website states the facts',
      'Nova& works with the FTA, and its website states 31 July 2026 as the date.',
      'The FTA publishes the rules. Its website states 20+ pages of guidance.'].join('\n'), { names: ['Nova&', 'novaand', 'Nova& systems LLC'] });
    const L = v.text.split('\n');
    check('"its website states <figure>" becomes "<name> has <figure>"', L[0] === 'Nova& is a Microsoft partner based in a Dubai free zone, and its business applications span all of the above. Nova& has 20+ years of industry experience.', L[0]);
    check('"its website states <services>" becomes "<name> offers ..." (the "It" sentence follows a paragraph about the business)', L[1] === 'It serves enterprises across the UAE and GCC, and Nova& offers Managed Services and 24/7 support.', L[1]);
    check('"<name>\'s site reports <figure>" becomes "<name> has <figure>"', L[2] === 'Nova& has 5 years of work, 100+ projects and a 95% client satisfaction rate.', L[2]);
    check('"<name> lists X among its Y" becomes "<name>\'s Y include X"', L[3] === 'Nova&\'s business applications for UAE services firms include Project Operations.', L[3]);
    check('"According to its website, X" becomes "X"', L[4] === 'Nova& works from Dubai.', L[4]);
    check('what it cannot rewrite safely is left as written and named for the editor', L[5] === 'Nova& is certified, and its site names Contoso and Fabrikam among those that trust it.' && v.flags.some(s => /its site names Contoso/.test(s)), J(v.flags));
    check('a third party\'s "its" / "website" is never touched (no business name in the line)', L[6] === 'The Ministry has amended its decisions, so read the current text on its e-invoicing page. According to the FTA\'s website, registration opens in 2027.', L[6]);
    check('quoted words and headings are never touched', L[7] === '"Its website states nothing," the reviewer said of Nova&.' && L[8] === '## Its website states the facts', L[7] + ' | ' + L[8]);
    check('another organisation\'s website is never the business\'s: "works with the FTA, and its website ..." and a paragraph about the FTA stay as written',
      L[9] === 'Nova& works with the FTA, and its website states 31 July 2026 as the date.' && L[10] === 'The FTA publishes the rules. Its website states 20+ pages of guidance.', L[9] + ' | ' + L[10]);
    check('five lines rewritten, one flagged', v.fixed.length === 5 && v.flags.length === 1, J({ fixed: v.fixed.length, flags: v.flags }));
    // through Content QA: the claim is still read, and one that is not on file is held for the owner
    const q = await guideQA(['Nova& is a Microsoft partner based in a Dubai free zone. Its website states 20+ years of industry experience.',
      'Its website also reports 500+ projects for UAE groups. The website states that Nova& is ISO 27001 certified.']);
    const out = String(q.output || ''); const c = q.content_qa || {};
    check('the page carries the claims in the business\'s name, not "its website states"', !/(?:its|the) website (?:states|also reports)/i.test(out) && out.includes('Nova& has 20+ years of industry experience') && out.includes('Nova& also has 500+ projects for UAE groups'),
      (out.match(/.{40}(?:20\+|500\+|ISO 27001).{60}/g) || []).join(' | '));
    check('content_qa.voice reports the two rewritten lines', (c.voice || {}).fixed === 2 && !((c.voice || {}).flags || []).length, J(c.voice));
    check('the claim check still sees each claim: 500+ projects (on no page of the business) is an unverified figure, the ISO certificate (not on file) is held for the owner, 20+ years (on file) is neither',
      (c.unverified_statistics || []).some(s => /500\+ projects/.test(s)) && (c.business_claims || []).some(b => /ISO 27001 certified/.test(b.sentence))
      && !(c.unverified_statistics || []).some(s => /20\+ years/.test(s)) && !(c.business_claims || []).some(b => /20\+ years of industry experience/.test(b.sentence)),
      J({ stats: c.unverified_statistics, claims: (c.business_claims || []).map(b => [b.kind, b.sentence.slice(0, 90)]) }));
  });

  // ---------- FUSV5 Blog Package: one byline, no redirect anywhere in the package ----------
  await guard('FUSV5 blog package', async () => {
    const SN = 'FUSV5 (2026-10-29, 3 of 8 pages + K7) the package prints one byline (its own) and no search-engine redirect in the Markdown, the HTML or meta.json';
    reset(); begin(SN); const check = mkCheck(SN);
    const F = fx('replay_3299.json.gz');
    const rec = F.runs['Blog Package'][0];
    const base = clone(rec.input);
    const md0 = String(base[0].json.page_markdown || '');
    const h1At = md0.indexOf('\n# '); const h1End = md0.indexOf('\n', h1At + 3);
    const withDupes = md0.slice(0, h1End + 1) + '\n*By Nova& Technical Team · Updated 28 October 2026*\n\nWritten by the Nova& Technical Team and reviewed by Reviewer Name. The team\'s areas of expertise are Dynamics 365 and UAE e-invoicing.\n'
      + md0.slice(h1End + 1) + '\n\nOnly 16% of brands track this ([industry analysis](' + GOTO + ')). Read [the official timeline](' + GURL + ').\n\nThe guide was written by the Ministry of Finance in 2025 and covers every phase.\n\nThis page was written by the Nova& Technical Team and reviewed by Reviewer Name.\n';
    const inp = clone(base); inp[0].json.page_markdown = withDupes;
    const r = await R.replay(F, 'Blog Package', 0, { input: inp });
    const P = r.first || {}; const mdOut = String(P.article_markdown || ''); const html = String(P.article_html || ''); const meta = J(P.article_meta || {});
    const team = (s) => (String(s).match(/written by (?:the )?(?:\[)?Nova& Technical Team/gi) || []).length;
    check('one "Written by" the team and one "Reviewed by" in the Markdown: the structured byline', team(mdOut) === 1 && (mdOut.match(/reviewed by/gi) || []).length === 1 && /^\*Written by \[Nova& Technical Team\]/m.test(mdOut),
      (mdOut.match(/.{0,40}(?:written|reviewed) by.{0,60}/gi) || []).join(' | '));
    check('the writer\'s own "*By ... · Updated ...*" line is gone', !/\*By Nova& Technical Team · Updated 28 October 2026\*/.test(mdOut));
    check('the HTML prints one byline paragraph', (html.match(/class="byline/g) || []).length === 1 && (html.match(/written by/gi) || []).length === 2 && !/written by the Nova&/i.test(html), (html.match(/.{0,60}written by.{0,40}/gi) || []).join(' | '));
    check('a sentence about who wrote something else stays', mdOut.includes('The guide was written by the Ministry of Finance in 2025 and covers every phase.'));
    check('no redirect in the Markdown, the HTML or meta.json; the target is linked and the words kept', !/google\.com\/(?:goto|url)/.test(mdOut + html + meta) && mdOut.includes('[the official timeline](https://www.mof.gov.ae/en/e-invoicing)') && mdOut.includes('(industry analysis)')
      && !((P.article_meta || {}).external_links || []).some(l => SRC.isRedirect(l.url)), J((P.article_meta || {}).external_links));
    // with no reviewer on file the byline names none: the writer's line that names one is the only mention, so it stays
    const inp2 = clone(inp); inp2[0].json.reviewer = null;
    const P2 = (await R.replay(F, 'Blog Package', 0, { input: inp2 })).first || {};
    check('no reviewer on file: the line naming the reviewer is kept (its only mention)', /reviewed by Reviewer Name/i.test(String(P2.article_markdown || '')));
    // the recorded run itself: nothing in it changes but what this fix removes
    const rec0 = (await R.replay(F, 'Blog Package', 0)).first || {};
    console.log('   3299 recorded package, writer byline lines removed by the fix: ' + J((String(r.recordedFirst && r.recordedFirst.article_markdown || '').match(/^.*(?:written|reviewed) by.*$/gim) || []).length) + ' before, ' + J((String(rec0.article_markdown || '').match(/^.*(?:written|reviewed) by.*$/gim) || []).length) + ' after');
  });

  // ---------- FUSV6 the owner's guard: the guide that ranks is untouched ----------
  await guard('FUSV6 ranking guide', async () => {
    const SN = 'FUSV6 (2026-10-29, owner priority) the guide that ranks (exec 949) goes through Content QA with no voice rewrite and no link change';
    reset(); begin(SN); const check = mkCheck(SN);
    const G = fx('ranking_guide_949.json');
    const q = await guideQA(null); const c = q.content_qa || {};
    check('no line of the guide is rewritten for voice (it already speaks as "we")', (c.voice || {}).fixed === 0 && !((c.voice || {}).flags || []).length, J(c.voice));
    check('no link of the guide is a redirect', (c.source_redirects || {}).resolved === 0 && (c.source_redirects || {}).dropped === 0, J(c.source_redirects));
    const links = (s) => [...String(s).matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map(m => m[1]).sort();
    check('every external link of the live guide is still there', links(G.live_markdown).every(u => String(q.output).includes(u)), J(links(G.live_markdown).filter(u => !String(q.output).includes(u))));
    const v = CL.voice(G.live_markdown, { names: ['Nova&', 'novaand', 'Novaand systems LLC'] });
    check('the voice kit alone leaves the guide byte for byte', v.text === G.live_markdown && v.fixed.length === 0, J(v.fixed.slice(0, 3)));
  });
};
