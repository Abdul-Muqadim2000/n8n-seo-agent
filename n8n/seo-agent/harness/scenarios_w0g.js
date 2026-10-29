// W0G1-W0G5 (page-quality programme 2026-10-29, W0-G: PLAN Fix 7, R4 D8, REVIEW_CODE M7; owner priority of 2026-10-29). The final version
// of a page gets its own documents, as the first draft does: the app stores its HTML / Markdown / meta.json and the first draft's images
// (app/server/src/services/finalFiles.ts, tested in the app), the engine prints the final page as a PDF (Gotenberg) and a Word file.
//   * the three Finalize-only nodes sit after *Finalize Verdict*, read its answer and never change it; the answer leaves before the settle;
//   * finalize 3336 (anonymised): its final page printed whole, with the status and the grade of THIS version and where the grade came from;
//   * a PDF is listed only when the renderer returned one; a renderer that is down or answers something else never fails the final version;
//   * the guide that ranks (exec 949) prints in full: every section, every table, every word; nothing in its answer changes.
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
  const PLAIN = /[—–…‘’“”]/;
  const wf = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', f), 'utf8'))[0];
  const F36 = R.load('replay_3336.json.gz');
  const G = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'ranking_guide_949.json'), 'utf8'));
  const visible = (h) => String(h).replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&middot;/g, ' ').replace(/\s+/g, ' ').trim();
  const wordsOf = (t) => String(t).split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
  // a small PDF as Gotenberg returns it (the bytes only have to start like a PDF and be more than a stub)
  const PDF = Buffer.from('%PDF-1.7\n' + '1 0 obj << /Type /Catalog >> endobj\n'.repeat(12) + '%%EOF\n', 'latin1').toString('base64');
  // the three nodes as the workflow runs them: the document, then (true branch) the renderer's item, then the attach
  const files = async (vdItems, renderItem) => {
    mock('Finalize Verdict', vdItems);
    const doc = await run('Final Version Document', vdItems, { code: 'Finalize__Final_Version_Document' });
    const into = renderItem === undefined ? doc : [renderItem(doc[0])];
    const att = await run('Attach Final Files', into, { code: 'Finalize__Attach_Final_Files' });
    return { doc: doc[0], att: att[0].json };
  };
  const rendered = (d) => ({ json: { ...d.json }, binary: { ...(d.binary || {}), pdf: { data: PDF, mimeType: 'application/pdf', fileName: 'index.pdf' } } });
  const sameExceptFiles = (before, after) => { const a = clone(after); delete a.files; return J(a) === J(before); };

  // ---------- W0G1 the workflow as generated ----------
  await guard('W0G1 wiring', async () => {
    const SN = 'W0G1 (W0-G, PLAN Fix 7) the Page Finalize workflow prints the final version after Finalize Verdict (read, never edited) and answers before the ledger settles';
    reset(); begin(SN); const check = mkCheck(SN);
    const W = wf('SEO_Agent_Page_Finalize.json'); const N = Object.fromEntries(W.nodes.map(n => [n.name, n])); const C = W.connections;
    const outs = (n, i = 0) => ((C[n] || {}).main || [])[i] || [];
    check('Finalize Verdict feeds Final Version Document first, then the settle (the answer still leaves before the settle)', J(outs('Finalize Verdict').map(t => t.node)) === J(['Final Version Document', 'Load Cost Factors (Finalize)']), J(outs('Finalize Verdict')));
    check('Has Final Document?: a printed page goes to the renderer, anything else straight to the attach', outs('Final Version Document')[0].node === 'Has Final Document?' && outs('Has Final Document?', 0)[0].node === 'Render Final PDF' && outs('Has Final Document?', 1)[0].node === 'Attach Final Files'
      && /final_doc === true/.test(J(N['Has Final Document?'].parameters)));
    const r = N['Render Final PDF'];
    check('Render Final PDF: Gotenberg as every report, 30 s, 3 tries 5 s apart, a failure continues (never fails the final version), the PDF as a file', r.parameters.url === 'http://gotenberg:3000/forms/chromium/convert/html' && r.parameters.options.timeout === 30000
      && r.retryOnFail === true && r.maxTries === 3 && r.waitBetweenTries === 5000 && r.onError === 'continueRegularOutput' && r.parameters.options.response.response.responseFormat === 'file' && r.parameters.options.response.response.outputPropertyName === 'pdf', J(r));
    check('Render Final PDF -> Attach Final Files -> Respond Finalize, which answers $json.body', outs('Render Final PDF')[0].node === 'Attach Final Files' && outs('Attach Final Files')[0].node === 'Respond Finalize' && /\$json\.body/.test(N['Respond Finalize'].parameters.responseBody));
    check('Finalize Verdict itself adds no files (the grade and the blockers stay its own)', !/body\.files/.test(N['Finalize Verdict'].parameters.jsCode));
    check('the document carries the lineage kit (the grade it prints says where it came from)', /const LN = \(\(\) =>/.test(N['Final Version Document'].parameters.jsCode));
    check('no em dash, curly quote or ellipsis character in the code this fix adds', ['code/Finalize_Document.js', 'code/Finalize_Attach_Files.js'].every(f => !PLAIN.test(fs.readFileSync(path.join(__dirname, '..', 'v5', f), 'utf8'))));
  });

  // ---------- W0G2 finalize 3336: the final page printed, the PDF and the Word file in the answer ----------
  await guard('W0G2 finalize 3336 files', async () => {
    const SN = 'W0G2 (W0-G) finalize 3336 (anonymised): the final page printed whole with the status and the grade of this version; the answer gains files.pdf and files.word and nothing else changes';
    reset(); begin(SN); const check = mkCheck(SN);
    const vd = (await R.replay(F36, 'Finalize Verdict', 0)).out;
    const body0 = clone(vd[0].json.body);
    const { doc, att } = await files(clone(vd), rendered);
    const html = doc.json.final_doc_html || ''; const t = visible(html);
    console.log('   W0-G 3336 document: ' + html.length + ' characters, ' + wordsOf(t) + ' words; files ' + J({ pdf: att.body.files.pdf && att.body.files.pdf.fileName, word: att.body.files.word && att.body.files.word.fileName }));
    check('the page is printed: final_doc, an index.html for the renderer that is the same document', doc.json.final_doc === true && doc.binary && doc.binary.html && doc.binary.html.fileName === 'index.html' && Buffer.from(doc.binary.html.data, 'base64').toString('utf8') === html);
    const h1 = ((body0.markdown || '').match(/^#\s+(.+)$/m) || [])[1] || '';
    check('it opens with "Final version", the status label and the grade of THIS version', /Final version/.test(t) && (!body0.delivery.label || t.includes(body0.delivery.label)) && (body0.grade.score == null || t.includes('Grade ' + Math.round(body0.grade.score) + ' of 100')), t.slice(0, 300));
    check('the H1 and every H2 of the final Markdown are in the document', (!h1 || t.includes(visible(h1.replace(/\*\*/g, '')))) && [...(body0.markdown || '').matchAll(/^##\s+(.+)$/gm)].every(m => t.includes(visible(m[1].replace(/\*\*|\[|\]\([^)]*\)/g, '')))), J([...(body0.markdown || '').matchAll(/^##\s+(.+)$/gm)].map(m => m[1])));
    check('the grade says where it came from (About the grade: this final version, the same check as the first draft)', /About the grade/.test(t) && /this final version/.test(t) && Array.isArray(doc.json.lineage) && doc.json.lineage.length === 1);
    check('no Title / Meta Description / Slug line is printed as page text', !/(^|\s)(Meta Description|Slug)\s*:/.test(visible(html.slice(html.indexOf('<article>')))));
    const f = att.body.files || {};
    check('files.pdf: the renderer\'s bytes, named after the page, application/pdf', f.pdf && f.pdf.data === PDF && /-final\.pdf$/.test(f.pdf.fileName) && f.pdf.mimeType === 'application/pdf' && f.pdf_missing === '', J(f.pdf && { n: f.pdf.fileName, m: f.pdf.mimeType }));
    const w = f.word ? Buffer.from(f.word.data, 'base64').toString('utf8') : '';
    check('files.word: the same document as a Word file (.doc, application/msword, Word\'s HTML form, byte order mark)', f.word && /-final\.doc$/.test(f.word.fileName) && f.word.mimeType === 'application/msword' && w.charCodeAt(0) === 0xfeff && /urn:schemas-microsoft-com:office:word/.test(w) && visible(w).includes(visible(html.slice(html.indexOf('<body>')))), J(f.word && f.word.fileName));
    check('nothing else in the answer changes: markdown, delivery, grade, questions, cost are Finalize Verdict\'s', sameExceptFiles(body0, att.body));
    check('the printed header keeps the house copy rules', !PLAIN.test(visible(html.slice(0, html.indexOf('<article>')))));
  });

  // ---------- W0G3 a PDF only when one was rendered ----------
  await guard('W0G3 pdf only when rendered', async () => {
    const SN = 'W0G3 (W0-G) a PDF is listed only when the renderer returned one: a renderer that is down or answers something else, or no page to print, never fails the final version';
    reset(); begin(SN); const check = mkCheck(SN);
    const vd = (await R.replay(F36, 'Finalize Verdict', 0)).out;
    const body0 = clone(vd[0].json.body);
    const down = await files(clone(vd), (d) => ({ json: { error: { message: 'connect ECONNREFUSED gotenberg:3000' } } }));
    check('renderer down: no PDF, the reason said, the Word file still there, the answer otherwise unchanged', down.att.body.files.pdf === null && /did not answer/.test(down.att.body.files.pdf_missing) && !!down.att.body.files.word && sameExceptFiles(body0, down.att.body), J(down.att.body.files.pdf_missing));
    const wrong = await files(clone(vd), (d) => ({ json: {}, binary: { pdf: { data: Buffer.from('<html><body>Gateway timeout</body></html>'.repeat(10)).toString('base64'), mimeType: 'text/html' } } }));
    check('a renderer answer that is not a PDF is never listed as one', wrong.att.body.files.pdf === null && /not return a PDF/.test(wrong.att.body.files.pdf_missing), J(wrong.att.body.files.pdf_missing));
    const tiny = await files(clone(vd), (d) => ({ json: {}, binary: { pdf: { data: Buffer.from('%PDF-').toString('base64'), mimeType: 'application/pdf' } } }));
    check('an empty PDF stub is not listed', tiny.att.body.files.pdf === null);
    const none = clone(vd); none[0].json.body = { ...none[0].json.body, ok: false, markdown: '' };
    const n = await files(none);
    check('no page to print: final_doc false (the renderer is never called), no PDF, no Word file, the answer as it was', n.doc.json.final_doc === false && !n.doc.binary && n.att.body.files.pdf === null && n.att.body.files.word === null && n.att.body.ok === false, J(n.att.body.files));
  });

  // ---------- W0G4 the guide that ranks prints in full ----------
  await guard('W0G4 ranking guide 949 prints whole', async () => {
    const SN = 'W0G4 (W0-G, owner priority) the published guide that ranks (exec 949) as a final version: printed in full (every section, table and word), its answer unchanged';
    reset(); begin(SN); const check = mkCheck(SN);
    const md = G.live_markdown;
    const body = { ok: true, request_id: 'x', markdown: md, meta: { title: (md.match(/^Title:\s*(.+)$/m) || [])[1] || '', meta_description: (md.match(/^Meta Description:\s*(.+)$/m) || [])[1] || '', slug: 'is-microsoft-dynamics-365-an-erp-system' },
      delivery_status: 'ready', delivery: { status: 'ready', label: 'Ready to publish', blocking: [], advisory: [], next_step: '', grade: { score: 94 } }, client_questions: [], grade: { score: 94, of: 100, basis: 'measured on this final version' }, cost: { claude_usd: 0, dfs_usd: 0, estimated: false, model_calls: 0 }, writes: 'none' };
    const vd = [{ json: { body: clone(body), cost_usd: 0, run_cost_usd: 0 } }];
    const { doc, att } = await files(vd, rendered);
    const html = doc.json.final_doc_html; const art = html.slice(html.indexOf('<article>'), html.indexOf('</article>'));
    const mdBody = md.split('\n').filter(l => !/^(Title|Meta Description|Slug|Primary Keyword|Secondary Keywords)\s*:/i.test(l)).join('\n');
    const mdWords = wordsOf(mdBody.replace(/^\s*\d{1,3}[.)]\s+/gm, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#>*_`|]/g, ' ').replace(/^\s*[-:| ]+$/gm, ' '));
    const docWords = wordsOf(visible(art));
    console.log('   W0-G 949 guide: markdown ' + mdWords + ' words, printed ' + docWords + ' words, ' + (art.match(/<h2/g) || []).length + ' H2, ' + (art.match(/<table/g) || []).length + ' tables, ' + (art.match(/<tr>/g) || []).length + ' table rows');
    check('every word of the page is printed (within 1%: Markdown marks and list numbers only)', Math.abs(docWords - mdWords) <= Math.ceil(mdWords * 0.01), docWords + ' vs ' + mdWords);
    const h2s = [...md.matchAll(/^##\s+(.+)$/gm)].map(m => m[1]);
    check('every H2 of the guide is a heading of the document', h2s.length >= 6 && h2s.every(h => /<h2[ >]/.test(art) && visible(art).includes(visible(h.replace(/\*\*/g, '')))), J(h2s));
    const tables = (md.match(/^\|[\s:|-]+\|?\s*$/gm) || []).length;
    check('every table of the guide is a table of the document, every row kept', (art.match(/<table/g) || []).length === tables && (art.match(/<tr>/g) || []).length === md.split('\n').filter(l => /^\s*\|/.test(l) && !/^\|[\s:|-]+\|?\s*$/.test(l.trim())).length, tables + ' tables');
    check('its search description and planned address are in the header; Ready to publish, grade 94', visible(html).includes(body.meta.meta_description) && visible(html).includes('/is-microsoft-dynamics-365-an-erp-system') && /Ready to publish/.test(visible(html)) && /Grade 94 of 100/.test(visible(html)));
    check('nothing in its answer changes: no refusal, no hold, no shortening, the same grade and status', sameExceptFiles(body, att.body) && att.body.markdown === md && att.body.delivery_status === 'ready' && att.body.grade.score === 94);
    check('the PDF and the Word file are listed', !!att.body.files.pdf && !!att.body.files.word);
  });

  // ---------- W0G5 the printed page is safe ----------
  await guard('W0G5 safe document', async () => {
    const SN = 'W0G5 (W0-G) the printed page cannot run anything: markup in the text is shown as text, only http(s) / site / anchor links are links, images are named (their files are downloads of their own)';
    reset(); begin(SN); const check = mkCheck(SN);
    const md = '# A page <script>alert(1)</script>\n\nIntro with [a bad link](javascript:alert(1)) and [a good one](https://example.org/x) and [a page](/contact) and **bold** and *soft*.\n\n![Hero chart](images/hero.webp)\n\n## Part "one" & two\n\n- item <b>one</b>\n- item two\n\n| A | B |\n|---|---|\n| <img src=x onerror=alert(1)> | 2 |\n';
    const vd = [{ json: { body: { ok: true, markdown: md + 'More words to pass the length floor of fifty characters.\n', meta: { slug: 'a-page' }, delivery: { status: 'ready', label: 'Ready to publish' }, grade: { score: 80 } } } }];
    const { doc } = await files(vd);
    const html = doc.json.final_doc_html;
    const art = html.slice(html.indexOf('<article>'));
    check('no script, no event handler, no javascript: link', !/<script/i.test(art) && !/<img/i.test(art) && !/onerror=/i.test(art.replace(/&lt;img[^&]*&gt;/g, '')) && !/href="javascript:/i.test(art), art.slice(0, 400));
    check('markup in the text is shown as text', art.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && art.includes('&lt;b&gt;one&lt;/b&gt;'));
    check('http(s) and site links are links; the javascript: one is only its text', art.includes('<a href="https://example.org/x">a good one</a>') && art.includes('<a href="/contact">a page</a>') && /a bad link/.test(art) && !/<a [^>]*>a bad link/.test(art));
    check('bold, italics, lists, the table and an image line', art.includes('<strong>bold</strong>') && art.includes('<em>soft</em>') && /<ul>[\s\S]*<li>/.test(art) && /<table>/.test(art) && art.includes('Image: Hero chart') && art.includes('<h2 id="part-one-two">Part &quot;one&quot; &amp; two</h2>'));   // fu-finalize-toc: an H2 carries the page package's id
    check('the files are named after the page slug', doc.json.final_file_base === 'a-page-final');
  });
};
