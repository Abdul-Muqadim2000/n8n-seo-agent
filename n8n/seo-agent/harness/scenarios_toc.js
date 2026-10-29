// TOC1-TOC6 (fu-finalize-toc, 2026-10-30; docs/page-quality-2026-10-29/BASELINE.md "Recurring defects": "Finalize strips table-of-contents
// links", 3 of 3 finals with a linked contents list; "Finalize false cut_off blocker on an unchanged page", K6). Owner priority: our
// published pages rank; the replays of 3299 / 3336 and the ranking guide 949 keep passing.
//   * the cause of the first: Content QA read a "#anchor" link as a weak source with no host, so entries 2-8 of every contents list were
//     unlinked as "repeat citations"; the fix keeps in-page links, and PF.toc keeps the list true to the page's headings through Finalize
//     Merge and Finalize Verdict (a lost link back, a renamed heading's entry renamed, a gone section's entry dropped, a lost list put back);
//     the final version's documents give every H2 the id the page package gives it, so each "#anchor" lands;
//   * the cause of the second: the delivered page ends on its author box, whose credentials line has no full stop ("...; 5 years, 100+
//     projects"); CK.text read it as a page cut mid-sentence. The author box is profile data (the end is read on the text before it), and an
//     end word for word the end of the page the client sent is not a cut, unless the page run itself found that page cut off;
//   * a truly truncated answer is still caught (with or without an author box, with or without a source page).
// Fixtures: the anonymised finalize 3336 (harness/fixtures/replay_3336.json.gz) with a contents list made by the page package's own rule and
// a synthetic author box; synthetic pages written for this file. No model call: the Finalize Editor's answer is the one recorded in 3336.
// Called from scenarios_v5.js before the report.
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const R = require('./replay')(H);
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const show = (label, v) => console.log('   TOC ' + label + ': ' + (typeof v === 'string' ? v : J(v)));
  const PLAIN = /[—–…‘’“”]/;
  const F99 = R.load('replay_3299.json.gz');
  const F36 = R.load('replay_3336.json.gz');
  const G = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'ranking_guide_949.json'), 'utf8'));
  const CB = F99.nodes['Build Webhook Response']['0'].items[0].json;   // 3299's stored original report (old format)
  const BODY = F36.nodes['Finalize Webhook']['0'].items[0].json.body;   // the app's finalize request of 3336
  const EDITOR = F36.nodes['Finalize Editor']['0'].items;               // the Finalize Editor's recorded answer
  const pf = async (fn, args) => (await run('_pf', [{ json: { fn, args } }], { code: '_page_fix' }))[0].json.r;
  const ck = async (fn, ...args) => (await run('Complete Kit', [{ json: { fn, args } }], { code: '_complete' }))[0].json.r;
  const codes = (list) => (list || []).map(x => x.code);
  // the page package's own rule (v5/code/Blog_Package.js anchorOf / tocMd): the H2s before the FAQ, "N. [Heading](#id)" under "**Contents**"
  const slugOf = (h) => String(h).toLowerCase().replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'section';
  const h2sOf = (md) => [...String(md).matchAll(/^##\s+(.+)$/gm)].map(m => m[1].trim());
  const idsOf = (md) => { const ids = new Map(), used = []; for (const h of h2sOf(md)) { if (ids.has(h)) continue; const a = slugOf(h); let k = a, i = 2; while (used.includes(k)) k = a + '-' + (i++); ids.set(h, k); used.push(k); } return ids; };
  const tocMd = (md) => { const hs = h2sOf(md); const faq = hs.findIndex(h => /frequently asked|^faqs?$/i.test(h)); const ids = idsOf(md);
    return '**Contents**\n\n' + (faq >= 0 ? hs.slice(0, faq) : hs).map((h, i) => (i + 1) + '. [' + h.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') + '](#' + ids.get(h) + ')').join('\n'); };
  const withToc = (md) => { const i = md.search(/^## /m); return md.slice(0, i) + tocMd(md) + '\n\n' + md.slice(i); };
  const tocLinks = (md) => [...String(md).matchAll(/^\s*\d{1,3}[.)]\s+\[([^\]]+)\]\(#([^)\s]+)\)/gm)].map(m => ({ text: m[1], id: m[2] }));
  const tocItems = (md) => { const s = String(md); const i = s.indexOf('**Contents**'); if (i < 0) return []; return s.slice(i).split('\n').slice(2).filter((l, k, a) => /^\d{1,3}[.)]\s/.test(l) && a.slice(0, k).every(x => /^\d{1,3}[.)]\s/.test(x))); };
  // the K6 shape: a guide that ends on the author box the page package adds, its credentials line without a full stop
  const BOX = '---\n\n**About the author: Nova& Technical Team**, Microsoft Dynamics 365 and AI Consulting Team\n\nThe Nova& Technical Team builds ERP, data and AI systems for companies in the UAE and the GCC.\n\nMicrosoft partner; 20+ years, 100+ projects';
  const PAGE = withToc(BODY.markdown.replace(/\s+$/, '')) + '\n\n' + BOX + '\n';
  const gatingOf = (p) => { const m = p.meta || {}; const o = m.originality || {};
    return { qa_blocking: Array.isArray(p.qa_blocking) ? p.qa_blocking : null, duplicate_targets: Array.isArray(o.duplicate_targets) ? o.duplicate_targets : null,
      verdict: p.verdict == null ? null : p.verdict, score: p.score == null ? null : p.score, score_withheld: p.score_withheld === true, page_type: m.page_type || '',
      verdict_acknowledged: p.verdict_acknowledged === true, copied_passages: [], content_request_id: p.request_id || '',
      length_points: (((p.qa_grade || m.grade || {}).breakdown || {}).length ?? null) }; };
  const pr = (blk) => ({ ...gatingOf(CB), qa_blocking: blk || [], duplicate_targets: [] });
  const chain = async (body, opts = {}) => {
    reset(); delete store['Finalize Editor'];
    const pb = await run('Parse Brief', [{ json: { body, headers: {} } }], { code: 'Finalize__Parse_Brief' });
    if (!pb[0].json.ok) return { bad: pb[0].json };
    mock('Finalize Plan', pb);
    const ap = await run('Finalize Apply', pb, { code: 'Finalize__Finalize_Apply' });
    if (ap[0].json.needs_editor) mock('Finalize Editor', clone(opts.editor || EDITOR));
    const mg = await run('Finalize Merge', ap, { code: 'Finalize__Finalize_Merge' });
    const qa = await run('Content QA', mg, { code: 'Finalize__Content_QA' });
    const oc = await run('Originality Check', qa, { code: 'Finalize__Originality_Check' });
    const vd = await run('Finalize Verdict', oc, { code: 'Finalize__Finalize_Verdict' });
    return { pb: pb[0].json, ap: ap[0].json, mg: mg[0].json, qaItem: qa[0].json, qa: qa[0].json.content_qa || {}, vd, body: vd[0].json.body };
  };
  const bodyOf = (md, blk) => ({ ...clone(BODY), markdown: md, delivered_markdown: md, page_run: pr(blk) });

  // ---------- TOC1 the kit: PF.toc ----------
  await guard('TOC1 PF.toc', async () => {
    const SN = 'TOC1 (fu-finalize-toc) PF.toc keeps a linked contents list true to the page: lost links back, a renamed heading followed, a gone section dropped and renumbered, a lost list put back; pages without one untouched';
    begin(SN); const check = mkCheck(SN); reset();
    const L0 = tocLinks(PAGE);
    check('the fixture carries the package\'s contents list (one linked entry per H2 of 3336, ' + h2sOf(BODY.markdown).length + ')', L0.length === h2sOf(BODY.markdown).length && L0.length >= 7, J(L0));
    // a. the K6 shape: what the old Content QA left (entry 1 linked, entries 2-n unlinked)
    let n = 0; const stripped = PAGE.replace(/^(\d{1,3}\.) \[([^\]]+)\]\(#[^)\s]+\)$/gm, (m, k, t) => (n++ === 0 ? m : k + ' ' + t));
    const a = await pf('toc', [stripped, PAGE]);
    check('a. entries 2-' + L0.length + ' unlinked (K6 / K3 / K7): every link comes back with its own anchor, the page is the page the client sent again', a.md === PAGE && a.relinked === L0.length - 1, J({ relinked: a.relinked, diff: tocItems(a.md) }));
    // b. a heading renamed in the final version: its entry and its anchor follow
    const OLD = 'Business Central or Finance and Supply Chain Management: which suits a UAE company?', NEW = 'Business Central or Finance and SCM: which fits a UAE company?';
    const renamed = PAGE.replace('## ' + OLD, '## ' + NEW);
    const b = await pf('toc', [renamed, PAGE]);
    const bl = tocLinks(b.md); const bi = bl.findIndex(x => x.text === NEW);
    check('b. the renamed heading\'s entry carries its new words and the id of the new heading, in its place', bi === 1 && bl[bi].id === slugOf(NEW) && !bl.some(x => x.text === OLD) && b.renamed === 1, J(bl.slice(0, 3)));
    check('b. every other entry is unchanged', J(bl.filter((x, i) => i !== 1)) === J(L0.filter((x, i) => i !== 1)));
    // c. a section gone: its entry is dropped and the list counts 1..n-1
    const GONE = 'Moving off Dynamics NAV, GP, AX or SL: which path applies?';
    const s = PAGE.indexOf('## ' + GONE), e = PAGE.indexOf('\n## ', s + 3);
    const c = await pf('toc', [PAGE.slice(0, s) + PAGE.slice(e + 1), PAGE]);
    const ci = tocItems(c.md);
    check('c. the gone section\'s entry is dropped and the entries are numbered 1..' + (L0.length - 1), c.dropped === 1 && ci.length === L0.length - 1 && ci.every((l, i) => l.startsWith((i + 1) + '. ')) && !c.md.includes('](#' + slugOf(GONE) + ')'), J(ci));
    // d. the list lost by an edit of the introduction: put back above the first H2, linked
    const lost = PAGE.replace(tocMd(BODY.markdown) + '\n\n', '');
    const d = await pf('toc', [lost, PAGE]);
    check('d. a contents list the final version lost is put back where the page had it, every entry linked', d.restored && d.md === PAGE, J({ restored: d.restored, at: d.md.indexOf('**Contents**'), want: PAGE.indexOf('**Contents**') }));
    // e. no linked contents list: nothing changes (the 3336 service page, the guide that ranks)
    const e1 = await pf('toc', [BODY.markdown, BODY.markdown]); const e2 = await pf('toc', [G.live_markdown, G.live_markdown]);
    check('e. a page without a contents list is returned byte for byte (3336, the ranking guide 949)', e1.md === BODY.markdown && !e1.changed && e2.md === G.live_markdown && !e2.changed);
    const plainList = '# T\n\nIntro.\n\n**In this guide**\n\n- Pricing\n- Support\n\n## Pricing\n\nText.\n\n## Support\n\nText.\n';
    check('e. a labelled list with no link here or in the source is left as the client wrote it', (await pf('toc', [plainList, plainList])).md === plainList);
    // f. the client's own words for an entry stay; only its anchor follows a renamed heading
    const OWN = 'What it covers';
    const COV = 'What a Dynamics 365 ERP covers and how it connects to the Microsoft stack', COV2 = 'What Dynamics 365 ERP covers and how it fits the Microsoft stack';
    const ownSrc = PAGE.replace('[' + COV + '](', '[' + OWN + '](');
    const f = await pf('toc', [ownSrc.replace('## ' + COV, '## ' + COV2), ownSrc]);
    const fe = tocLinks(f.md).find(x => x.text === OWN);
    check('f. an entry in the client\'s own words keeps them and points to the renamed heading', !!fe && fe.id === slugOf(COV2), J(tocLinks(f.md).slice(0, 4)));
    // g. two H2s with the same id: "-2", as the package numbers them
    const dup = '# T\n\nIntro.\n\n**Contents**\n\n1. [Costs?](#costs)\n2. Costs!\n3. [Next](#next)\n\n## Costs?\n\nA.\n\n## Costs!\n\nB.\n\n## Next\n\nC.\n';
    const dupSrc = dup.replace('2. Costs!', '2. [Costs!](#costs-2)');
    check('g. a second heading with the same id is linked as "-2", as the page package numbers it', (await pf('toc', [dup, dupSrc])).md === dupSrc);
  });

  // ---------- TOC2 the completeness kit ----------
  await guard('TOC2 CK author box and unchanged end', async () => {
    const SN = 'TOC2 (fu-finalize-toc, K6) CK.text: the author box is profile data and an end word for word the source\'s is not a cut; a truly truncated answer is still caught';
    begin(SN); const check = mkCheck(SN); reset();
    const t1 = await ck('text', PAGE);
    check('the K6 shape (a guide ending on its author box, credentials without a full stop) ends cleanly', t1.complete && !t1.cut_off, J(t1));
    const cutBody = BODY.markdown.replace(/\s+$/, '').replace(/\[Get in touch with our experts\]\([^)]*\)$/, '').replace(/\s+$/, '').replace(/support\.$/, 'supp');
    check('a body cut mid-word before the author box is still cut off', (await ck('text', cutBody + '\n\n' + BOX)).cut_off, cutBody.slice(-60));
    check('an author box that stops inside its link is cut off', (await ck('text', PAGE.replace(/\s+$/, '') + '\n\n[LinkedIn](https://www.linkedin.com/company/nova')).cut_off);
    const bare = BODY.markdown.replace(/\s+$/, '') + '\n\nMicrosoft partner; 20+ years, 100+ projects';
    const t4 = await ck('text', bare);
    check('without an author box that line still reads as unfinished (the rule is unchanged for any other text)', t4.cut_off, J(t4));
    const t5 = await ck('text', bare, { unchanged_from: [bare] });
    check('the same end as the page it was made from: not a cut, recorded as such', !t5.cut_off && t5.unchanged_end === true && t5.unchanged_end_reasons.length >= 1, J(t5));
    const t6 = await ck('text', cutBody, { unchanged_from: [BODY.markdown] });
    check('a truly truncated answer of a complete source is still cut off (its end is not the source\'s)', t6.cut_off && !t6.unchanged_end, J(t6));
    const t7 = await ck('text', bare, { min_words: 99999, unchanged_from: [bare] });
    check('a same end never hides a length problem', t7.cut_off && /words, far below/.test(t7.reasons[0]) && t7.reasons.length === 1, J(t7));
    const e1 = await ck('edit', BODY.markdown, cutBody);
    check('CK.edit still refuses a cut edit', e1.cut_off, J(e1));
  });

  // ---------- TOC3 the finalize chain on 3336 with a contents list and an author box ----------
  let fin = null;
  await guard('TOC3 finalize 3336 with a contents list', async () => {
    const SN = 'TOC3 (fu-finalize-toc) finalize 3336 (anonymised) with the package\'s contents list and the K6 author box: every entry linked to an H2 of the final page, no false cut-off blocker, the recorded editor answer';
    begin(SN); const check = mkCheck(SN);
    fin = await chain(bodyOf(PAGE, []));
    const md = fin.body.markdown; const L = tocLinks(md); const ids = idsOf(md);
    show('3336 + contents', { status: fin.body.delivery_status, blocking: codes(fin.body.delivery.blocking), entries: L.length, sections_rewritten: fin.body.sections_rewritten, cut_off: fin.qa.cut_off });
    check('Content QA keeps every in-page link (was: entries 2-n unlinked as repeat citations of a weak source)', tocLinks(fin.qaItem.output).length === tocLinks(PAGE).length && !/repeat citation/.test(J(fin.qa.fixes || [])), J({ links: tocLinks(fin.qaItem.output).length, fixes: fin.qa.fixes }));
    check('the final page keeps one linked entry per H2 of the page (' + tocLinks(PAGE).length + ')', L.length === tocLinks(PAGE).length && L.length === h2sOf(md).length, J(L));
    check('every entry points to an H2 of the final page by the id the documents give it', L.every(x => [...ids.values()].includes(x.id)), J({ L, ids: [...ids.values()] }));
    check('no cut-off blocker on a page whose end is the delivered page\'s (K6)', !codes(fin.body.delivery.blocking).includes('cut_off') && fin.qa.cut_off === false, J(fin.body.delivery.blocking));
    check('the author box is still there, word for word', md.includes(BOX), md.slice(-300));
    // the same request without the contents list: the list changes nothing else in the answer
    const plain = await chain(bodyOf(BODY.markdown.replace(/\s+$/, '') + '\n\n' + BOX + '\n', []));
    const strip = (t) => String(t).replace(tocMd(BODY.markdown) + '\n\n', '');
    check('apart from the list, the final page is the one made without it (same sections rewritten, same text)', strip(md) === plain.body.markdown && J(fin.body.sections_rewritten) === J(plain.body.sections_rewritten), J({ a: strip(md).length, b: plain.body.markdown.length }));
    check('the same blockers with and without the list', J(codes(fin.body.delivery.blocking)) === J(codes(plain.body.delivery.blocking)), J([codes(fin.body.delivery.blocking), codes(plain.body.delivery.blocking)]));
  });

  // ---------- TOC4 the editor drops or renames: the list follows ----------
  await guard('TOC4 finalize: the editor drops the list or renames a heading', async () => {
    const SN = 'TOC4 (fu-finalize-toc) an accepted edit that renames the heading of its section, or returns the introduction without the contents list: Finalize Merge keeps the list, following the heading, and the final version carries it';
    begin(SN); const check = mkCheck(SN);
    // the 3336 request with the contents list, then ONE edit job planned on a chosen section, answered by the editor (no model call)
    const edited = async (sid, text) => {
      reset(); delete store['Finalize Editor'];
      const pb = await run('Parse Brief', [{ json: { body: bodyOf(PAGE, []), headers: {} } }], { code: 'Finalize__Parse_Brief' });
      mock('Finalize Plan', pb);
      const ap = await run('Finalize Apply', pb, { code: 'Finalize__Finalize_Apply' });
      const part = (await pf('split', [ap[0].json.output])).parts.find(p => p.id === sid);
      const item = { json: { ...clone(ap[0].json), needs_editor: true, finalize_apply: { applied: [], changes: [], jobs: [{ id: sid, heading: part.heading, must_contain: [], keep: [], weave: [], answers: [], texts: [] }] } } };
      mock('Finalize Apply', [item]); mock('Finalize Editor', [{ json: { output: { sections: [{ id: sid, text: text(part.text) }] } } }]);
      const mg = await run('Finalize Merge', [item], { code: 'Finalize__Finalize_Merge' });
      const qa = await run('Content QA', mg, { code: 'Finalize__Content_QA' });
      const oc = await run('Originality Check', qa, { code: 'Finalize__Originality_Check' });
      const vd = await run('Finalize Verdict', oc, { code: 'Finalize__Finalize_Verdict' });
      return { mg: mg[0].json, body: vd[0].json.body };
    };
    const OLDH = 'UAE readiness checklist: VAT, e-invoicing, Arabic, AED and data hosting', NEWH = 'UAE readiness checklist for VAT, e-invoicing, Arabic and hosting';
    const sid = (await pf('split', [PAGE])).parts.find(p => p.heading === OLDH).id;
    const r = await edited(sid, (t) => t.replace('## ' + OLDH, '## ' + NEWH));
    const L = tocLinks(r.body.markdown);
    show('renamed', { section: sid, rewritten: r.mg.finalize_merge.sections_rewritten, entry: L.find(x => x.text === NEWH) || null });
    check('the edit is accepted (its section rewritten)', r.mg.finalize_merge.sections_rewritten.includes(sid), J(r.mg.finalize_merge));
    check('Finalize Merge already hands Content QA the renamed entry (its words and the new heading\'s id)', tocLinks(r.mg.output).some(x => x.text === NEWH && x.id === slugOf(NEWH)), J(tocLinks(r.mg.output)));
    check('the final page: the entry follows the renamed heading, in its place, nothing else in the list changed', L.findIndex(x => x.text === NEWH && x.id === slugOf(NEWH)) === tocLinks(PAGE).findIndex(x => x.text === OLDH)
      && !L.some(x => x.text === OLDH) && J(L.filter(x => x.text !== NEWH)) === J(tocLinks(PAGE).filter(x => x.text !== OLDH)), J(L));
    check('every entry lands on an H2 of the final page', L.length === h2sOf(r.body.markdown).length && L.every(x => [...idsOf(r.body.markdown).values()].includes(x.id)), J(L));
    // the introduction returned without the list
    const r2 = await edited('s0', (t) => t.replace(tocMd(BODY.markdown) + '\n\n', ''));
    check('the edit of the introduction is accepted', r2.mg.finalize_merge.sections_rewritten.includes('s0'), J(r2.mg.finalize_merge));
    check('an introduction returned without the contents list: the list is put back above the first H2, every entry linked', r2.body.markdown.includes(tocMd(BODY.markdown) + '\n\n## ') && tocLinks(r2.body.markdown).length === h2sOf(r2.body.markdown).length,
      J({ n: tocLinks(r2.body.markdown).length, at: r2.body.markdown.indexOf('**Contents**') }));
    // the recorded 3336 editor answer: whatever it was refused or accepted, the list still matches the page
    const r3 = await chain(bodyOf(PAGE, []));
    check('with the recorded 3336 editor answer the list still matches the page', tocLinks(r3.body.markdown).length === h2sOf(r3.body.markdown).length, J(tocLinks(r3.body.markdown)));
  });

  // ---------- TOC5 the cut-off pin on unchanged text (K6), and real cut-off detection kept ----------
  await guard('TOC5 cut-off on unchanged text', async () => {
    const SN = 'TOC5 (fu-finalize-toc, K6) the final version raises no cut-off blocker on an end the delivered page already had, unless the page run found that page cut off; a page the run found cut stays cut';
    begin(SN); const check = mkCheck(SN);
    const bare = BODY.markdown.replace(/\s+$/, '') + '\n\nMicrosoft partner; 20+ years, 100+ projects\n';
    const a = await chain(bodyOf(bare, []));
    check('an end the delivered page already had (no full stop, no author box): no cut-off blocker', !codes(a.body.delivery.blocking).includes('cut_off'), J(a.body.delivery.blocking));
    const b = await chain(bodyOf(bare, [{ code: 'cut_off', text: 'The page stops before its end, so it cannot be published as it is', action: 'x' }]));
    check('the same page when its page run found it cut off: the cut-off blocker stands (never excused by its own source)', codes(b.body.delivery.blocking).includes('cut_off') && b.body.delivery_status === 'not_ready', J(b.body.delivery.blocking));
    const cut = BODY.markdown.replace(/\s+$/, '').replace(/\[Get in touch with our experts\]\([^)]*\)$/, '').replace(/\s+$/, '').replace(/support\.$/, 'supp');
    const c = await chain({ ...bodyOf(cut, []), delivered_markdown: BODY.markdown });
    check('a page the client sent cut mid-word (the delivered page complete): cut off, not ready', codes(c.body.delivery.blocking).includes('cut_off') && c.body.delivery_status === 'not_ready', J(c.body.delivery.blocking));
  });

  // ---------- TOC6 the documents and the guards ----------
  await guard('TOC6 documents and guards', async () => {
    const SN = 'TOC6 (fu-finalize-toc) the final version\'s document gives every H2 the id its contents list points to; the ranking guide 949 and 3336 replays unchanged; wording and wiring';
    begin(SN); const check = mkCheck(SN);
    if (!fin) fin = await chain(bodyOf(PAGE, []));
    mock('Finalize Verdict', fin.vd);
    const doc = (await run('Final Version Document', fin.vd, { code: 'Finalize__Final_Version_Document' }))[0].json;
    const hrefs = [...String(doc.final_doc_html).matchAll(/href="#([^"]+)"/g)].map(m => m[1]);
    const idsH = new Set([...String(doc.final_doc_html).matchAll(/<h2 id="([^"]+)"/g)].map(m => m[1]));
    check('the PDF / Word document: every "#anchor" of the contents list has its H2 id (' + hrefs.length + ' links)', hrefs.length === tocLinks(PAGE).length && hrefs.every(h => idsH.has(h)), J({ hrefs, ids: [...idsH] }));
    check('the Word file carries the same ids', hrefs.every(h => String(doc.final_word_html).includes('<h2 id="' + h + '"')));
    // the guide that ranks: no contents list, nothing for PF.toc to do; through the final version its text is unchanged and no cut-off
    // blocker comes from its live author box and tag line (the end is the delivered page's)
    const g = await chain({ ...clone(BODY), markdown: G.live_markdown, delivered_markdown: G.live_markdown, keyword: G.keyword, page_type: 'Guide', answers: [], page_run: { ...pr([]), page_type: 'Guide' } });
    show('949 final', { status: g.body.delivery_status, blocking: codes(g.body.delivery.blocking), grade: g.body.grade.score });
    check('the ranking guide 949: no cut-off blocker (its end is the delivered page\'s), no contents list added', !codes(g.body.delivery.blocking).includes('cut_off') && !/\*\*Contents\*\*/.test(g.body.markdown), J(g.body.delivery.blocking));
    const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'v5', f), 'utf8');
    check('no em dash, curly quote or ellipsis character in the code this fix adds', ['code/Finalize_Merge.js', 'code/Finalize_Verdict.js', 'code/Finalize_Document.js', 'code/_page_fix.js'].every(f => !PLAIN.test(src(f))));
    check('Content QA keeps "#anchor" links before any source rule reads them', /if \(\/\^#\[\^\\s#\]\*\$\/\.test\(url\.trim\(\)\)\) return m;/.test(src('code/Content_QA.js')));
    const W = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', 'SEO_Agent_Page_Finalize.json'), 'utf8'))[0]; const N = Object.fromEntries(W.nodes.map(x => [x.name, x]));
    check('the Page Finalize workflow: Finalize Merge and Finalize Verdict call PF.toc, Content QA passes the source pages to the cut-off check', /PF\.toc\(md, S\(\(A\.finalize/.test(N['Finalize Merge'].parameters.jsCode) && /PF\.toc\(N\.md, S\(F\.input_markdown\)\)/.test(N['Finalize Verdict'].parameters.jsCode)
      && /CK\.text\(md, \{ unchanged_from: __cutFrom \}\)/.test(N['Content QA'].parameters.jsCode) && /\[f\.delivered_markdown\]/.test(N['Content QA'].parameters.jsCode));
  });
};
