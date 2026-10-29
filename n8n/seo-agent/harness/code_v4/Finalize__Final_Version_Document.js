// ---- lineage (G29, 2026-10-13, system review FIX_PLAN.md; CRITERIA_technical_tracking_reporting_ai_links.md 3.11) ----
// Every number a customer reads has to say where it came from, over what period, and how big the sample was. Before this, the AI
// visibility report said it (sample sizes, Wilson ranges) and the others did not: the weekly report printed "1,240 impressions" and
// "#8" side by side without saying that one is a 28-day Search Console count and the other one live sample of one results page.
// LN.of() carries that as structured fields next to the value (`source`, `period`, `sample`, `basis`), LN.note() turns them into one
// short line for a tooltip or a footnote, and LN.block() prints the whole list under a report as "Where these numbers come from".
// Rules: the vocabulary is the one the rest of the system already uses (G6 "modelled, not measured clicks", G8 `calibrated` /
// `modelled` / `unknown`, G28 statistical ranges, G26 `impact_basis`) - this kit makes it universal, it does not invent a second
// scheme. A modelled or uncalibrated number must say so. Where lineage is genuinely unknown the note reads "source not recorded":
// never a guessed source.
const LN = (() => {
  const MISSING = 'source not recorded';
  // where numbers come from. `label` is what a customer reads, `how` the one sentence about what that source can and cannot see.
  const SOURCES = {
    gsc: { label: 'Google Search Console', how: 'Google\'s own count of the impressions and clicks it served; the last 3 days are not final, and figures are averages across devices and locations' },
    gsc_history: { label: 'your stored Search Console history', how: 'the weekly Search Console readings we have kept for this site' },
    inspection: { label: 'Search Console URL Inspection', how: 'Google\'s own answer about one URL at the moment it was asked' },
    gsc_links: { label: 'your Search Console link export', how: 'the sample of links Google shows you; it is a sample, not the whole list' },
    ga4: { label: 'Google Analytics 4', how: 'visits measured on your site by your own GA4 property' },
    serp: { label: 'a live Google results page', how: 'one results page read through DataForSEO at that moment, from one country and one device' },
    kwdata: { label: 'Google Ads keyword data (through DataForSEO)', how: 'the provider\'s monthly search volume and cost per click; a provider estimate for a single keyword, not a measurement of your site' },
    backlink_index: { label: 'the DataForSEO backlink index', how: 'one crawler\'s index of the web: it finds much of the web, never all of it' },
    bing: { label: 'Bing Webmaster Tools', how: 'Bing\'s own figures for the site it has verified' },
    link_graph: { label: 'the Common Crawl web graph', how: 'a public crawl of the web, released every few months' },
    ahrefs: { label: 'the Ahrefs Domain Rating API', how: 'Ahrefs\' own 0-100 rating of a domain' },
    trends: { label: 'Google Trends', how: 'a relative index of search interest (100 = the peak of the period), not a count of searches' },
    ai_engines: { label: 'the AI assistants themselves', how: 'the answers ChatGPT, Gemini, Google AI Mode and the others gave to the questions in your panel' },
    ai_db: { label: 'the DataForSEO AI-answer database', how: 'a database of AI answers and the brands they name' },
    own_check: { label: 'our own fetch of the page', how: 'we requested the page ourselves and read what came back' },
    draft: { label: 'the finished draft itself', how: 'counted in the text this run wrote, before anybody published it' },
    crawl: { label: 'our crawl of your website', how: 'the pages we could reach and read on your site' },
    crux: { label: 'the Chrome User Experience Report', how: 'speed as real Chrome visitors experienced it over 28 days' },
    pagespeed: { label: 'Google PageSpeed Insights (Lighthouse)', how: 'one simulated mobile load in a lab, not what your visitors felt' },
    rdap: { label: 'the domain registry (RDAP, else WHOIS)', how: 'the registry\'s own record of when a domain was registered' },
    gbp: { label: 'Google Business Profile', how: 'the public listing Google holds for the business' },
    wikidata: { label: 'Wikidata', how: 'the public knowledge base search engines read' },
    web: { label: 'public web pages we read', how: 'pages we fetched and quoted; nothing behind a login' },
    you: { label: 'what you told us', how: 'the business profile, the monthly check-in or the forms you filled in' },
    model: { label: 'a model on top of measured data', how: 'computed from measured numbers with a published formula, not measured itself' },
    none: { label: MISSING, how: 'this figure reached the report without its source: treat it as unverified' },
  };
  // how the figure was arrived at. The words are the ones G6 / G8 / G28 already use.
  const BASIS = {
    measured: 'measured',
    calibrated: 'calibrated against your own measured data',
    modelled: 'modelled, not measured',
    one_sample: 'one sample, not an average',
    estimated: 'estimated',
    reported: 'reported by the source',
    unknown: MISSING,
  };
  const S = (v) => String(v == null ? '' : v);
  const fmt = (v) => (Number(v) || 0).toLocaleString('en-GB');
  const esc1 = (s) => S(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const src = (k) => SOURCES[k] || SOURCES.none;
  // "2026-09-15 to 2026-10-12 (28 days)" - the period a figure covers, never an empty string
  const range = (r, label) => { const o = r || {}; const a = S(o.start), b = S(o.end);
    if (!a && !b) return label ? S(label) : 'period not recorded';
    if (a && b) { const d = Math.round((new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / 864e5) + 1;
      return a + ' to ' + b + (Number.isFinite(d) && d > 0 ? ' (' + d + ' day' + (d === 1 ? '' : 's') + ')' : ''); }
    return 'to ' + (b || a); };
  const asOf = (at) => { const d = S(at).slice(0, 10); return d ? 'as of ' + d : 'date not recorded'; };
  const days = (n, end) => (Number(n) || 0) + ' days' + (S(end).slice(0, 10) ? ' to ' + S(end).slice(0, 10) : '');
  const sample = (n, unit) => (n == null || n === '' || !Number.isFinite(Number(n))) ? 'sample not recorded' : fmt(n) + (unit ? ' ' + S(unit) : '');
  // one figure's lineage, as structured fields beside the value
  const of = (figure, source, o) => { const x = o || {}; const key = SOURCES[source] ? source : 'none';
    const basis = BASIS[x.basis] ? x.basis : (key === 'none' ? 'unknown' : 'measured');
    return { figure: S(figure), source: key, source_label: src(key).label, source_how: src(key).how,
      period: S(x.period) || 'period not recorded', sample: x.sample == null ? 'sample not recorded' : S(x.sample),
      basis, basis_label: BASIS[basis], note: S(x.note) };
  };
  // a figure whose source nobody recorded: say exactly that instead of inventing one
  const unknown = (figure, why) => ({ figure: S(figure), source: 'none', source_label: MISSING, source_how: src('none').how,
    period: '', sample: '', basis: 'unknown', basis_label: MISSING, note: S(why) });
  // "Google Search Console · 2026-09-15 to 2026-10-12 (28 days) · 1,240 impressions · measured"
  const note = (l) => { const x = l || {}; const lbl = x.source_label || MISSING;
    return [lbl, x.period, x.sample, x.basis_label === lbl ? '' : x.basis_label, x.note].filter(Boolean).join(' · '); };
  const isHonest = (l) => !!l && (l.basis !== 'unknown' || note(l).indexOf(MISSING) >= 0);
  // ---- the evidence half of the same rule (R10, promoted to the class by lineage_lint.py, 2026-10-15) ----
  // A finding is a figure like any other: it may not be shown without the thing that shows it. R10 was exactly this - Google
  // retired the Mobile Usability report, the API answered VERDICT_UNSPECIFIED for every page, and the audit raised a HIGH finding
  // on 45 of 47 pages whose evidence string was "/:  | /whatwedo/ai-automation: " - punctuation and nothing else. So the test is
  // not `evidence !== ''`: a string that is only separators, brackets or a bare "0" carries no evidence either.
  const hasEvidence = (f) => {
    const ev = S((f || {}).evidence).replace(/<[^>]*>/g, ' ');     // markup is not evidence
    return /[A-Za-z]|[1-9]/.test(ev.replace(/[\s;|,.:·\-–—()\[\]\/]+/g, ' '));
  };
  // the findings that may be shown, and the titles of the ones held back. `allow` names a title that is evidence in itself
  // (a count in the title, a note about data that could not be collected); everything else has to carry its own.
  const unevidenced = (list, o) => { const x = o || {}; const allow = (x.allow || []).map(S);
    return (list || []).filter(f => f && !hasEvidence(f) && allow.indexOf(S(f.title)) < 0).map(f => S(f.title || f.id || 'untitled')); };
  const evidenced = (list, o) => { const x = o || {}; const allow = (x.allow || []).map(S);
    const keep = (list || []).filter(f => f && (hasEvidence(f) || allow.indexOf(S(f.title)) >= 0));
    if (typeof x.onDrop === 'function') { const d = unevidenced(list, o); if (d.length) x.onDrop(d); }
    return keep; };
  const evidenceNote = (dropped) => (dropped || []).length
    ? (dropped.length + ' finding(s) were left out because nothing was measured to show them: ' + dropped.slice(0, 5).join(', ')) : '';
  const html = (l) => '<span style="color:#64748b;font-size:11px">' + esc1(note(l)) + '</span>';
  const line = (l) => '<div style="color:#64748b;font-size:11px;margin-top:2px">' + esc1(note(l)) + '</div>';
  // the block under a report: one row per figure, so no number is left without a source, a period and a sample
  const block = (list, o) => { const rows = (list || []).filter(Boolean); const x = o || {};
    const td = 'style="padding:3px 8px;border:1px solid #cbd5e1;font-size:11px;vertical-align:top;color:#334155"';
    const th = 'style="padding:3px 8px;border:1px solid #cbd5e1;background:#f1f5f9;text-align:left;font-size:11px"';
    if (!rows.length) return '';
    return '<h3 style="margin:18px 0 4px;font-size:13px;color:#0f172a">' + esc1(x.title || 'Where these numbers come from') + '</h3>'
      + '<table style="border-collapse:collapse;margin:4px 0;max-width:100%">'
      + '<tr><th ' + th + '>Figure</th><th ' + th + '>Source</th><th ' + th + '>Period</th><th ' + th + '>Sample</th><th ' + th + '>How it was arrived at</th></tr>'
      + rows.map(l => '<tr><td ' + td + '>' + esc1(l.figure) + '</td><td ' + td + '>' + esc1(l.source_label) + '</td><td ' + td + '>' + esc1(l.period || '-')
        + '</td><td ' + td + '>' + esc1(l.sample || '-') + '</td><td ' + td + '>' + esc1([l.basis_label, l.note].filter(Boolean).join(': ')) + '</td></tr>').join('')
      + '</table><p style="color:#64748b;font-size:11px;margin:4px 0">' + esc1(x.footer || 'A figure marked "' + BASIS.modelled + '" is computed, not counted; "' + MISSING + '" means the figure reached this report without its source and should be treated as unverified.') + '</p>';
  };
  return { of, unknown, note, html, line, block, range, asOf, days, sample, isHonest, hasEvidence, evidenced, unevidenced,
    evidenceNote, SOURCES, BASIS, MISSING };
})();
// W0-G (2026-10-29, page-quality PLAN Fix 7, R4 D8, REVIEW_CODE M7): the final version's own documents. A page run delivers the page as a
// Word file and a PDF next to its HTML / Markdown / meta.json package; the final version delivered Markdown only, so the client who answered
// the questions had nothing to download but the first draft's files. This node reads *Finalize Verdict*'s answer (it never edits it) and
// prints the FINAL page as one document: a short header (the page's title, its status and the grade of THIS version, the search
// description and the address it is meant for) and the page itself. *Render Final PDF* turns it into a PDF (Gotenberg, as every report);
// *Attach Final Files* adds the PDF (only when one was rendered) and the same document as a Word file to the answer. The app stores them as
// the final version's downloads, with the HTML / Markdown / meta.json it already makes and the first version's images.
// Pure: no clock, no network, no URL constructor, no Object.defineProperty (n8n sandbox rules). A body that is not a page passes through
// with final_doc false, so the PDF renderer is never called for it.
const V = $input.first().json || {};
const body = V.body || {};
const S = (v) => String(v == null ? '' : v);
const md0 = S(body.markdown);
if (body.ok !== true || md0.trim().length < 50) return [{ json: { ...V, final_doc: false } }];

const esc = (s) => S(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// a link the document may carry: http(s), a page of the site (/...) or an anchor; anything else (javascript:, data:) is kept as its text
const safeHref = (u) => { const t = S(u).trim().replace(/^<|>$/g, ''); return /^(https?:\/\/|\/(?!\/)|#)/i.test(t) && !/["\s]/.test(t) ? t : ''; };
const inline = (s) => {
  const parts = []; let t = S(s);
  // images: the files are not in the document (they are downloads of their own), so the reader sees where one goes and what it shows
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/g, (m, alt) => { parts.push('<span class="img">Image: ' + esc(alt || 'see the image plan') + '</span>'); return '\u0000' + (parts.length - 1) + '\u0000'; });
  t = t.replace(/\[([^\[\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (m, a, u) => { const h = safeHref(u); parts.push(h ? '<a href="' + esc(h) + '">' + esc(a) + '</a>' : esc(a)); return '\u0000' + (parts.length - 1) + '\u0000'; });
  t = t.replace(/`([^`]+)`/g, (m, c) => { parts.push('<code>' + esc(c) + '</code>'); return '\u0000' + (parts.length - 1) + '\u0000'; });
  t = esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/__(.+?)__/g, '<strong>$1</strong>').replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
  return t.replace(/\u0000(\d+)\u0000/g, (m, i) => parts[Number(i)] || '');
};
const META = /^(Title|Meta Description|Meta Title|Slug|Primary Keyword|Secondary Keywords)\s*:[ \t]*(.*)$/i;
const lines = md0.replace(/\r\n?/g, '\n').split('\n');
const head = {}; let i0 = 0;
while (i0 < lines.length && (META.test(lines[i0].trim()) || !lines[i0].trim())) { const m = lines[i0].trim().match(META); if (m) head[m[1].toLowerCase()] = m[2].trim(); i0++; }
const md = lines.slice(i0);
let h1 = '';
const out = []; let list = null, table = false, para = [], fence = null;
const flush = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
const closeList = () => { if (list) { out.push('</' + list + '>'); list = null; } };
const closeTable = () => { if (table) { out.push('</tbody></table>'); table = false; } };
const cells = (l) => l.replace(/^\s*\||\|\s*$/g, '').split('|').map(c => c.trim());
for (let k = 0; k < md.length; k++) {
  const raw = md[k]; const l = raw.trim();
  if (fence !== null) { if (/^(```|~~~)/.test(l)) { out.push('<pre>' + esc(fence) + '</pre>'); fence = null; } else fence += (fence ? '\n' : '') + raw; continue; }
  if (/^(```|~~~)/.test(l)) { flush(); closeList(); closeTable(); fence = ''; continue; }
  if (l.startsWith('|')) { flush(); closeList(); if (/^\|[\s:|-]+\|?$/.test(l)) continue;
    if (!table) { out.push('<table><thead><tr>' + cells(l).map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>'); table = true; }
    else out.push('<tr>' + cells(l).map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>'); continue; }
  // a table whose rows are split by blank lines (a page read back from a website often is) stays one table
  if (!l && table) { let n = k + 1; while (n < md.length && !md[n].trim()) n++; if (n < md.length && md[n].trim().startsWith('|')) continue; }
  closeTable();
  if (!l) { flush(); closeList(); continue; }
  let x;
  if ((x = l.match(/^#\s+(.+)$/))) { flush(); closeList(); if (!h1) { h1 = x[1].trim(); continue; } out.push('<h2>' + inline(x[1]) + '</h2>'); continue; }
  if ((x = l.match(/^(#{2,6})\s+(.+)$/))) { flush(); closeList(); const h = Math.min(4, x[1].length); out.push('<h' + h + '>' + inline(x[2]) + '</h' + h + '>'); continue; }
  if (/^(-{3,}|\*{3,}|_{3,})$/.test(l)) { flush(); closeList(); out.push('<hr>'); continue; }
  if ((x = l.match(/^>\s?(.*)$/))) { flush(); closeList(); out.push('<blockquote><p>' + inline(x[1]) + '</p></blockquote>'); continue; }
  if ((x = l.match(/^[-*+]\s+(.+)$/))) { flush(); if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; } out.push('<li>' + inline(x[1].replace(/^\[[ xX]\]\s+/, '')) + '</li>'); continue; }
  if ((x = l.match(/^\d{1,3}[.)]\s+(.+)$/))) { flush(); if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; } out.push('<li>' + inline(x[1]) + '</li>'); continue; }
  if (list && /^\s{2,}\S/.test(raw)) { out[out.length - 1] = out[out.length - 1].replace(/<\/li>$/, ' ' + inline(l) + '</li>'); continue; }
  closeList(); para.push(l);
}
if (fence !== null) out.push('<pre>' + esc(fence) + '</pre>');
flush(); closeList(); closeTable();

const M = body.meta || {};
const title = S(M.title || head.title || h1 || 'Your page').trim();
const h1Text = h1 || title;
const desc = S(M.meta_description || head['meta description']).trim();
const slug = S(M.slug || head.slug).trim();
const target = /^https?:\/\//i.test(S(M.target_url)) ? S(M.target_url) : '';
const del = body.delivery || {};
const status = S(del.status || body.delivery_status);
const label = S(del.label) || (status === 'not_ready' ? 'Not ready to publish' : status === 'ready_with_questions' ? 'Ready to publish, stronger with your answers' : status === 'ready' ? 'Ready to publish' : '');
const score = (body.grade || {}).score;
const facts = [];
if (label) facts.push('<span class="status status-' + esc(status || 'unknown') + '">' + esc(label) + '</span>');
if (score != null && Number.isFinite(Number(score))) facts.push('<span>Grade ' + esc(S((body.grade || {}).display) || String(Math.round(Number(score)))) + ' of 100</span>');   // W0-C: "95+" from 95, never 100
const rows = [];
if (title && title !== h1Text) rows.push(['Title in search results', title]);
if (desc) rows.push(['Search description', desc]);
if (target) rows.push(['Publish it at', target + ' (an update of the page there now)']);
else if (slug) rows.push(['Planned address', '/' + slug.replace(/^\/+/, '')]);
const header = '<header class="final">'
  + '<p class="kicker">Final version</p>'
  + (facts.length ? '<p class="facts">' + facts.join('<span class="sep">&middot;</span>') + '</p>' : '')
  + (rows.length ? '<dl>' + rows.map(r => '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>').join('') + '</dl>' : '')
  + '</header>';
// the grade printed in the header says where it came from (INVARIANTS rule 1): this version, measured by the content run's own check
const words = md.join(' ').replace(/[#>*_`|]/g, ' ').split(/\s+/).filter(Boolean).length;
const lineage = (score != null && Number.isFinite(Number(score)))
  ? [LN.of('Grade of this final version', 'draft', { basis: 'measured', period: 'this final version', sample: words + ' words', note: S((body.grade || {}).basis) })]
  : [LN.unknown('Grade of this final version', 'the check did not give a grade')];
const inner = header + '\n<article>\n<h1>' + inline(h1Text) + '</h1>\n' + out.join('\n') + '\n</article>\n'
  + '<footer class="lineage">' + LN.block(lineage, { title: 'About the grade', footer: 'The grade is measured on this final version by the same check as the first draft.' }) + '</footer>';
const css = 'body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.55;color:#1d2433;margin:0}'
  + 'header.final{border:1px solid #d6dbe4;border-radius:6px;padding:10px 14px;margin:0 0 18px;background:#f5f7fa;font-size:9.5pt}'
  + '.kicker{margin:0 0 4px;font-weight:bold;text-transform:uppercase;letter-spacing:.06em;color:#2f5bd3;font-size:8.5pt}'
  + '.facts{margin:0 0 6px}.sep{margin:0 6px;color:#8a93a3}.status{font-weight:bold}.status-not_ready{color:#b42318}.status-needs_work{color:#b54708}.status-ready{color:#067647}'
  + 'dl{margin:0}dt{font-weight:bold;margin-top:4px}dd{margin:0 0 2px}'
  + 'h1{font-size:20pt;line-height:1.25;margin:0 0 12px}h2{font-size:15pt;margin:20px 0 8px}h3{font-size:12.5pt;margin:16px 0 6px}h4{font-size:11pt;margin:14px 0 6px}'
  + 'p{margin:0 0 9px}ul,ol{margin:0 0 10px 22px;padding:0}li{margin:0 0 4px}a{color:#2f5bd3}'
  + 'table{border-collapse:collapse;width:100%;margin:6px 0 12px;font-size:10pt}th,td{border:1px solid #c9d0db;padding:5px 7px;text-align:left;vertical-align:top}th{background:#eef1f6}'
  + 'blockquote{margin:0 0 10px;padding:4px 12px;border-left:3px solid #c9d0db;color:#3d4657}pre{white-space:pre-wrap;background:#f5f7fa;padding:8px;font-size:9.5pt}'
  + '.img{display:block;margin:4px 0 10px;padding:6px 10px;border:1px dashed #c9d0db;color:#5b6577;font-size:9.5pt}';
const doc = '<!doctype html>\n<html lang="' + esc(S(body.language_code || 'en').slice(0, 10) || 'en') + '"><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' + css + '</style></head>\n<body>\n' + inner + '\n</body></html>';
// the Word file: the same document in the HTML form Word opens (the page run's Word file uses it too), so both say exactly the same
const word = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">\n<head><meta charset="utf-8"><title>' + esc(title) + '</title>\n'
  + '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->\n<style>' + css + '</style></head>\n<body>\n' + inner + '\n</body></html>';
const base = ((S(slug || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70)) || 'page') + '-final';
return [{ json: { ...V, final_doc: true, final_doc_html: doc, final_word_html: word, final_file_base: base, lineage },
  binary: { html: { data: Buffer.from(doc, 'utf8').toString('base64'), mimeType: 'text/html', fileName: 'index.html', fileExtension: 'html' } } }];
