/*__LINEAGE__*/
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
// fu-finalize-toc (2026-10-30): each H2 carries the id the page package gives it (Blog Package anchorOf: one per heading text, "-2" for a
// repeat), so the contents list's "#anchor" links land on their sections in the final version's documents too
const hIds = new Map(), hUsed = [];
const hId = (t) => { const k = S(t).trim(); if (hIds.has(k)) return hIds.get(k); const a = k.toLowerCase().replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'section';
  let id = a, n = 2; while (hUsed.includes(id)) id = a + '-' + (n++); hIds.set(k, id); hUsed.push(id); return id; };
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
  if ((x = l.match(/^(#{2,6})\s+(.+)$/))) { flush(); closeList(); const h = Math.min(4, x[1].length); out.push('<h' + h + (h === 2 ? ' id="' + esc(hId(x[2])) + '"' : '') + '>' + inline(x[2]) + '</h' + h + '>'); continue; }
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
if (score != null && Number.isFinite(Number(score))) facts.push('<span>Grade ' + Math.round(Number(score)) + ' of 100</span>');
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
  + '.facts{margin:0 0 6px}.sep{margin:0 6px;color:#8a93a3}.status{font-weight:bold}.status-not_ready{color:#b42318}.status-ready{color:#067647}'
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
