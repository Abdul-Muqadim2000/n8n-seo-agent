// Turns the generated page into a WordPress REST payload: a DRAFT post with title, slug, excerpt (meta description),
// HTML content, JSON-LD blocks and SEO-plugin meta (Yoast / RankMath keys; they must be exposed to the REST API by the plugin).
const d = $input.first().json;
const md0 = String(d.page_markdown || d.output || '');
const metaRe = /^(Title|Meta Description|Slug|Primary Keyword|Secondary Keywords):\s*(.+)$/gim;
const meta = {}; let m; while ((m = metaRe.exec(md0)) !== null) meta[m[1].toLowerCase()] = m[2].trim();
let md = md0.replace(metaRe, '').replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, '').trim();
const h1 = (md.match(/^#\s+(.+)$/m) || [])[1] || '';
md = md.replace(/^#\s+.+$\n?/m, '').trim();
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => { let t = esc(s); t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); t = t.replace(/\[([^\[\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>'); return t; };
function mdToHtml(text) {
  const out = []; let list = null, table = null;
  const closeList = () => { if (list) { out.push('</' + list + '>'); list = null; } };
  const closeTable = () => { if (table) { out.push('</tbody></table>'); table = null; } };
  for (const raw of text.split('\n')) {
    const l = raw.trim();
    if (l.startsWith('|')) {
      closeList();
      if (/^\|[\s:|-]+\|$/.test(l)) continue;
      const cells = l.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      if (!table) { out.push('<table><thead><tr>' + cells.map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>'); table = 'open'; }
      else out.push('<tr>' + cells.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>');
      continue;
    }
    closeTable();
    if (!l) { closeList(); continue; }
    let x;
    if ((x = l.match(/^(#{2,4})\s+(.+)$/))) { closeList(); const h = x[1].length; out.push('<h' + h + '>' + inline(x[2]) + '</h' + h + '>'); continue; }
    if ((x = l.match(/^>\s*(.+)$/))) { closeList(); out.push('<blockquote><p>' + inline(x[1]) + '</p></blockquote>'); continue; }
    if ((x = l.match(/^Q\d+:\s*(.+)$/))) { closeList(); out.push('<h3>' + inline(x[1]) + '</h3>'); continue; }
    if ((x = l.match(/^A\d+:\s*(.+)$/))) { closeList(); out.push('<p>' + inline(x[1]) + '</p>'); continue; }
    if ((x = l.match(/^[-*]\s+(.+)$/))) { if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; } out.push('<li>' + inline(x[1]) + '</li>'); continue; }
    if ((x = l.match(/^\d+\.\s+(.+)$/))) { if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; } out.push('<li>' + inline(x[1]) + '</li>'); continue; }
    closeList(); out.push('<p>' + inline(l) + '</p>');
  }
  closeList(); closeTable();
  return out.join('\n');
}
const schema = Array.isArray(d.schema_blocks) ? d.schema_blocks : [];
const content = mdToHtml(md) + schema.map(b => '\n<script type="application/ld+json">' + JSON.stringify(b.json) + '</script>').join('');
const title = meta.title || h1 || d.keyword || 'New page';
const slug = String(d.content_brief_slug || meta.slug || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const excerpt = meta['meta description'] || '';
return [{ json: {
  wordpress_url: String(d.wordpress_url || '').replace(/\/+$/, ''),
  wp_payload: { title, content, slug, status: 'draft', excerpt,
    meta: { _yoast_wpseo_title: title, _yoast_wpseo_metadesc: excerpt, _yoast_wpseo_focuskw: d.keyword || '', rank_math_title: title, rank_math_description: excerpt, rank_math_focus_keyword: d.keyword || '' } },
  keyword: d.keyword || '', ladder_id: d.ladder_id || '', request_id: d.request_id || '', email: d.email || '', schema_blocks: schema.length, content_chars: content.length
} }];
