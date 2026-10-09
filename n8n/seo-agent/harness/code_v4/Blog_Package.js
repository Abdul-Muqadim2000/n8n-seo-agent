// Framework-agnostic blog package for every content run: the article as clean HTML (with the JSON-LD blocks), as Markdown, and a meta.json
// (title, slug, meta description, H1, keywords, headings, links, schema, word count, content score, suggested URL, publish checklist).
// Attached to the e-mail and returned in the API callback next to the PDF / Word report. Runs without content pass through untouched.
// v4.4: byline + author box (E-E-A-T), linked table of contents (H2 ids), hub "Guides in this series" block, case-study snapshot box,
// local NAP block, video embed with transcript; the copywriter's [Image: ...] marker lines are dropped (the image plan places the figures).
const item = $input.first(); const d = item.json || {};
const md0 = String(d.page_markdown || '');
if (!md0.trim()) return [item];
const metaRe = /^(Title|Meta Description|Slug|Primary Keyword|Secondary Keywords):\s*(.+)$/gim;
const metaLines = {}; let mm; while ((mm = metaRe.exec(md0)) !== null) metaLines[mm[1].toLowerCase()] = mm[2].trim();
let md = md0.replace(metaRe, '').replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, '').replace(/^\s*(Production Brief|Note|Editor's note):.*$/gim, '').replace(/[ \t]*\[(?:Image|Video)\s*:(?:[^\[\]\n]|\[[^\[\]\n]*\])*\][ \t]*/gi, '').replace(/\n{3,}/g, '\n\n').trim();
const h1 = (md.match(/^#\s+(.+)$/m) || [])[1] || '';
md = md.replace(/^#\s+.+$\n?/m, '').trim();
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => { let t = esc(s); t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); t = t.replace(/\[([^\[\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>'); return t; };
const anchorIds = new Map();   // H2 ids for the table of contents (unique, stable)
const anchorOf = (h) => { if (anchorIds.has(h)) return anchorIds.get(h); let a = String(h).toLowerCase().replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'section'; let k = a, i = 2; while ([...anchorIds.values()].includes(k)) k = a + '-' + (i++); anchorIds.set(h, k); return k; };
function mdToHtml(text) {
  const out = []; let list = null, table = null;
  const closeList = () => { if (list) { out.push('</' + list + '>'); list = null; } };
  const closeTable = () => { if (table) { out.push('</tbody></table>'); table = null; } };
  for (const raw of text.split('\n')) {
    const l = raw.trim();
    if (l.startsWith('|')) { closeList(); if (/^\|[\s:|-]+\|$/.test(l)) continue; const cells = l.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      if (!table) { out.push('<table><thead><tr>' + cells.map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>'); table = 'open'; } else out.push('<tr>' + cells.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>'); continue; }
    closeTable();
    if (!l) { closeList(); continue; }
    let x;
    if ((x = l.match(/^(#{2,4})\s+(.+)$/))) { closeList(); const h = x[1].length; out.push('<h' + h + (h === 2 ? ' id="' + anchorOf(x[2]) + '"' : '') + '>' + inline(x[2]) + '</h' + h + '>'); continue; }
    if ((x = l.match(/^>\s*(.+)$/))) { closeList(); out.push('<blockquote><p>' + inline(x[1]) + '</p></blockquote>'); continue; }
    if ((x = l.match(/^Q\d+:\s*(.+)$/))) { closeList(); out.push('<h3>' + inline(x[1]) + '</h3>'); continue; }
    if ((x = l.match(/^A\d+:\s*(.+)$/))) { closeList(); out.push('<p>' + inline(x[1]) + '</p>'); continue; }
    if ((x = l.match(/^[-*]\s+(.+)$/))) { if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; } out.push('<li>' + inline(x[1]) + '</li>'); continue; }
    if ((x = l.match(/^\d+\.\s+(.+)$/))) { if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; } out.push('<li>' + inline(x[1]) + '</li>'); continue; }
    closeList(); out.push('<p>' + inline(l) + '</p>');
  }
  closeList(); closeTable(); return out.join('\n');
}
const schema = Array.isArray(d.schema_blocks) ? d.schema_blocks : [];
const title = metaLines.title || h1 || d.keyword || 'New page';
const slug = (String(d.content_brief_slug || metaLines.slug || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)) || 'page';
const description = metaLines['meta description'] || '';
const headings = [...md.matchAll(/^(#{2,3})\s+(.+)$/gm)].map(x => ({ level: x[1].length, text: x[2].trim() }));
const links = [...md.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)].map(x => ({ text: x[1], url: x[2] }));
const dom = String(d.domain || '').toLowerCase();
const hostOf = (u) => { const m = String(u || '').trim().match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };   // no URL constructor in the n8n Code sandbox (live finding 2026-10-02)
const isInternal = (u) => { const h = hostOf(u); return !!dom && !!h && (h === dom || h.endsWith('.' + dom)); };
const words = md.replace(/\|/g, ' ').replace(/[#>*_`]/g, '').split(/\s+/).filter(Boolean).length;
// ---- image plan: hero + in-body figures as placeholders (the owner drops the files in place; alt text and file names are SEO-ready) ----
const normT = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slugify = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const h2List = headings.filter(x => x.level === 2).map(x => x.text);
let plan = (Array.isArray(d.content_images) ? d.content_images : []).filter(i => i && (i.alt_text || i.subject)).slice(0, 4);
if (!plan.length) plan = [{ placement: 'hero', purpose: 'hero', subject: 'Visual for ' + (h1 || title), alt_text: (h1 || title).slice(0, 120), filename: slug + '-hero.webp' }, ...h2List.filter((_, i) => i === 0 || i === Math.floor(h2List.length / 2)).slice(0, 2).map(h => ({ placement: h, purpose: 'diagram', subject: 'Visual that explains: ' + h, alt_text: (h + ' - ' + (d.keyword || title)).slice(0, 120), filename: slug + '-' + slugify(h).split('-').slice(0, 4).join('-') + '.webp' }))];
if (!plan.some(i => /hero/i.test(i.purpose || '') || /hero/i.test(i.placement || ''))) plan.unshift({ placement: 'hero', purpose: 'hero', subject: 'Visual for ' + (h1 || title), alt_text: (h1 || title).slice(0, 120), filename: slug + '-hero.webp' });
const images = plan.slice(0, 4).map((im, i) => { const hero = /hero/i.test(im.purpose || '') || /hero/i.test(im.placement || ''); const alt = String(im.alt_text || im.subject || title).replace(/^(an? |the )?(image|photo|picture) of /i, '').slice(0, 125);
  const base = slugify(String(im.filename || '').replace(/\.[a-z0-9]+$/i, '')) || (slug + '-' + (hero ? 'hero' : slugify(im.subject || alt).split('-').slice(0, 4).join('-')));
  return { slot: i + 1, purpose: hero ? 'hero' : String(im.purpose || 'photo').toLowerCase(), placement: hero ? 'hero' : String(im.placement || ''), subject: String(im.subject || ''), alt_text: alt, caption: String(im.caption || ''), filename: base + '.webp', path: 'images/' + base + '.webp', width: hero ? 1200 : 1000, height: hero ? 675 : 600, max_kb: hero ? 200 : 150 }; });
const figure = (im, eager) => '<figure><img src="' + esc(im.path) + '" alt="' + esc(im.alt_text) + '" width="' + im.width + '" height="' + im.height + '" loading="' + (eager ? 'eager' : 'lazy') + '">' + (im.caption ? '<figcaption>' + esc(im.caption) + '</figcaption>' : '') + '</figure>';
const mdImg = (im) => '![' + im.alt_text.replace(/[\[\]]/g, '') + '](' + im.path + (im.caption ? ' "' + im.caption.replace(/"/g, "'") + '"' : '') + ')';
const findH2 = (placement) => { const p = normT(placement).replace(/^(after|before|under|in|the|h2|section)\s+/g, ''); if (!p) return -1; let idx = h2List.findIndex(h => normT(h) === p); if (idx < 0) idx = h2List.findIndex(h => normT(h).includes(p) || p.includes(normT(h))); return idx; };
const bodyImgs = images.filter(im => im.purpose !== 'hero'); const heroImg = images.find(im => im.purpose === 'hero');
const slots = bodyImgs.map((im, i) => { let idx = findH2(im.placement); if (idx < 0) idx = Math.min(h2List.length - 1, i === 0 ? 0 : Math.floor(h2List.length / 2)); return { im, idx }; });
let bodyHtml = mdToHtml(md); let mdOut = md;
{ const lines = bodyHtml.split('\n'); let seen = 0; const out = [];
  for (const line of lines) { out.push(line); if (/^<h2[ >]/.test(line)) { for (const sl of slots) if (sl.idx === seen) out.push(figure(sl.im, false)); seen++; } }
  bodyHtml = out.join('\n');
  const mlines = mdOut.split('\n'); let seenMd = 0; const mout = [];
  for (const line of mlines) { mout.push(line); if (/^##\s+/.test(line)) { for (const sl of slots) if (sl.idx === seenMd) mout.push('', mdImg(sl.im)); seenMd++; } }
  mdOut = mout.join('\n'); }
// ---- v4.4 blocks: E-E-A-T byline and author box, table of contents, hub cluster block, case snapshot, local NAP, video ----
const role = d.page_role || 'standard'; const pt = String(d.recommended_page || d.page_type || '').toLowerCase();
const articleLike = d.article_like != null ? !!d.article_like : /blog|guide|article|pillar|hub|case stud/.test(pt);
const AU = d.author || null, RV = d.reviewer || null, P = d.site_profile || null, V = d.video && d.video.url ? d.video : null, CS = d.case_study || null;
const today = new Date().toISOString().slice(0, 10);
const dateText = new Date(today + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const a = (href, text, rel) => href ? '<a href="' + esc(href) + '"' + (rel ? ' rel="' + rel + '"' : '') + '>' + esc(text) + '</a>' : esc(text);
const authorName = AU ? AU.name : '[Author Name]', authorUrl = AU ? (AU.url || '') : '[Author Page URL]';
const bylineHtml = articleLike ? '<p class="byline">By ' + a(authorUrl, authorName, 'author') + (AU ? (AU.job_title ? ', ' + esc(AU.job_title) : '') : ', [Job title]') + ' · <time datetime="' + today + '">Updated ' + esc(dateText) + '</time>' + (RV ? ' · Reviewed by ' + a(RV.url, RV.name) + (RV.job_title ? ', ' + esc(RV.job_title) : '') : '') + '</p>' : '';
const bylineMd = articleLike ? '*By ' + (AU && authorUrl ? '[' + authorName + '](' + authorUrl + ')' : authorName) + (AU ? (AU.job_title ? ', ' + AU.job_title : '') : ', [Job title]') + ' · Updated ' + dateText + (RV ? ' · Reviewed by ' + (RV.url ? '[' + RV.name + '](' + RV.url + ')' : RV.name) + (RV.job_title ? ', ' + RV.job_title : '') : '') + '*' : '';
const authorImg = AU && AU.image_url ? AU.image_url : (AU ? '' : 'images/author-[name].webp');
const authorBoxHtml = articleLike ? '<aside class="author-box">' + (authorImg ? '<img src="' + esc(authorImg) + '" alt="' + esc(authorName) + '" width="96" height="96" loading="lazy">' : '') + '<div><p class="author-name">' + a(authorUrl, authorName, 'author') + (AU ? (AU.job_title ? ' — ' + esc(AU.job_title) : '') : ' — [Job title]') + '</p>' +
  '<p>' + esc(AU ? (AU.bio || '[Two-sentence bio: what the author does and for whom]') : '[Two-sentence bio: what the author does and for whom]') + '</p>' + (AU ? (AU.credentials ? '<p class="credentials">' + esc(AU.credentials) + '</p>' : '') : '<p class="credentials">[Credentials and years of experience]</p>') +
  ((AU && (AU.same_as || []).length) ? '<p class="author-links">' + AU.same_as.slice(0, 4).map(u => '<a href="' + esc(u) + '" rel="me noopener">' + esc(/linkedin/i.test(u) ? 'LinkedIn' : /x\.com|twitter/i.test(u) ? 'X' : /github/i.test(u) ? 'GitHub' : String(u).replace(/^https?:\/\/(www\.)?/, '').split('/')[0]) + '</a>').join(' · ') + '</p>' : (AU ? '' : '<p class="author-links">[LinkedIn profile]</p>')) + '</div></aside>' : '';
const authorBoxMd = articleLike ? '---\n\n**About the author: ' + (AU && authorUrl ? '[' + authorName + '](' + authorUrl + ')' : authorName) + '**' + (AU ? (AU.job_title ? ', ' + AU.job_title : '') : ', [Job title]') + '\n\n' + (AU ? (AU.bio || '[Two-sentence bio]') : '[Two-sentence bio: what the author does and for whom]') + (AU ? (AU.credentials ? '\n\n' + AU.credentials : '') : '\n\n[Credentials and years of experience]') + ((AU && (AU.same_as || []).length) ? '\n\n' + AU.same_as.slice(0, 4).map(u => '[' + (/linkedin/i.test(u) ? 'LinkedIn' : String(u).replace(/^https?:\/\/(www\.)?/, '').split('/')[0]) + '](' + u + ')').join(' · ') : '') : '';
// table of contents: hub pages always, long articles (5+ sections, 1,500+ words) too; FAQ and the closing CTA are left out
const faqAt = h2List.findIndex(h => /frequently asked|^faqs?$/i.test(h));
const tocH2 = faqAt >= 0 ? h2List.slice(0, faqAt) : h2List;   // the CTA always follows the FAQ
const wantToc = role === 'hub' || (articleLike && h2List.length >= 5 && words >= 1500);
const tocHtml = wantToc && tocH2.length >= 3 ? '<nav class="toc" aria-label="Table of contents"><p class="toc-title">' + (role === 'hub' ? 'In this guide' : 'Contents') + '</p><ol>' + tocH2.map(h => '<li><a href="#' + anchorOf(h) + '">' + inline(h) + '</a></li>').join('') + '</ol></nav>' : '';
const tocMd = tocHtml ? '**' + (role === 'hub' ? 'In this guide' : 'Contents') + '**\n\n' + tocH2.map((h, i) => (i + 1) + '. [' + h.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') + '](#' + anchorOf(h) + ')').join('\n') : '';
// hub: "Guides in this series" (the cluster pages the hub links down to)
const HP = role === 'hub' ? (d.hub_pages || []).filter(p => p && p.url) : [];
const cap = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
const clusterHtml = HP.length ? '<nav class="cluster" aria-label="Guides in this series"><h2 id="guides-in-this-series">Guides in this series</h2><ul>' + HP.map(p => '<li><a href="' + esc(p.url) + '">' + esc(cap(p.keyword) || p.url) + '</a></li>').join('') + '</ul></nav>' : '';
const clusterMd = HP.length ? '## Guides in this series\n\n' + HP.map(p => '- [' + (cap(p.keyword) || p.url) + '](' + p.url + ')').join('\n') : '';
// case study: snapshot box from the intake (only the facts given)
const csRows = CS ? [['Client', CS.client_public === false ? ('A ' + (CS.industry ? CS.industry + ' business' : 'client') + (CS.location ? ' in ' + CS.location : '')) : CS.client_name], ['Industry', CS.industry], ['Location', CS.location], ['Service', CS.service], ['Timeline', CS.timeline], ['Results', CS.results]].filter(r => String(r[1] || '').trim()) : [];
const snapshotHtml = csRows.length ? '<aside class="case-snapshot"><p class="snapshot-title">At a glance</p><dl>' + csRows.map(r => '<dt>' + esc(r[0]) + '</dt><dd>' + esc(String(r[1]).slice(0, 300)) + '</dd>').join('') + '</dl></aside>' : '';
const snapshotMd = csRows.length ? '| At a glance | |\n|---|---|\n' + csRows.map(r => '| ' + r[0] + ' | ' + String(r[1]).replace(/\|/g, '/').replace(/\n+/g, ' ').slice(0, 300) + ' |').join('\n') : '';
// local: verified name / address / phone / hours (placeholders when the profile has none)
const PA = (P && P.address) || {};
const area = String(d.local_area || '').trim();
const addr = [PA.street, PA.city, PA.region, PA.postal_code].filter(Boolean).join(', ');
const telHref = P && P.phone ? 'tel:' + String(P.phone).replace(/[^\d+]/g, '') : '';
const napHtml = role === 'local' ? '<section class="nap" aria-label="Contact details"><p class="nap-title">' + esc((P && P.business_name) || '[Your Business Name]') + (area ? ' — serving ' + esc(area) : '') + '</p><address>' + esc(addr || '[Street address, City]') + '<br>' + (telHref ? '<a href="' + esc(telHref) + '">' + esc(P.phone) + '</a>' : '[Phone]') + (P && P.public_email ? '<br><a href="mailto:' + esc(P.public_email) + '">' + esc(P.public_email) + '</a>' : '') + '</address>' + (P && P.opening_hours ? '<p class="hours">Opening hours: ' + esc(P.opening_hours) + '</p>' : '<p class="hours">Opening hours: [Opening hours]</p>') + (P && P.map_url ? '<p><a href="' + esc(P.map_url) + '">Open in Google Maps</a></p>' : '<p>[Google Maps link or embedded map]</p>') + '</section>' : '';
const napMd = role === 'local' ? '**' + ((P && P.business_name) || '[Your Business Name]') + (area ? ' — serving ' + area : '') + '**  \n' + (addr || '[Street address, City]') + '  \n' + ((P && P.phone) || '[Phone]') + ((P && P.public_email) ? '  \n' + P.public_email : '') + '  \nOpening hours: ' + ((P && P.opening_hours) || '[Opening hours]') + ((P && P.map_url) ? '  \n[Open in Google Maps](' + P.map_url + ')' : '') : '';
// video: lazy embed (privacy-friendly YouTube host) + transcript in <details>
const vidTitle = V ? (V.title || h1 || title) : '';
const iframeSrc = V ? (V.provider === 'youtube' && V.id ? 'https://www.youtube-nocookie.com/embed/' + V.id : (V.embed_url || '')) : '';
const transcriptHtml = V ? '<details class="transcript"><summary>Video transcript</summary>' + (V.transcript ? V.transcript.split(/\n{2,}|\n/).filter(x => x.trim()).map(p => '<p>' + esc(p.trim()) + '</p>').join('') : '<p>[Paste the video transcript here: YouTube Studio → Subtitles → the language → Download (.txt), or your own script.]</p>') + '</details>' : '';
const videoHtml = V ? '<figure class="video">' + (iframeSrc ? '<iframe src="' + esc(iframeSrc) + '" title="' + esc(vidTitle) + '" width="1280" height="720" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>' : '<video controls preload="metadata" width="1280" height="720"' + (V.thumbnail_url ? ' poster="' + esc(V.thumbnail_url) + '"' : '') + '><source src="' + esc(V.url) + '"></video>') + '<figcaption>' + esc(vidTitle) + (V.minutes ? ' (' + V.minutes + ' min)' : '') + '</figcaption></figure>\n' + transcriptHtml : '';
const videoMd = V ? '[▶ Watch: ' + vidTitle + (V.minutes ? ' (' + V.minutes + ' min)' : '') + '](' + V.url + ')\n\n<details>\n<summary>Video transcript</summary>\n\n' + (V.transcript || '[Paste the video transcript here.]') + '\n\n</details>' : '';
// placement: video after the quick answer (or under the H2 the brief named), TOC before the first H2, snapshot after the hero,
// NAP after the H2 about reaching the business (else before the FAQ), cluster block before the FAQ, author box at the end
const vidPlace = String((V && V.placement) || ((d.content_brief_video_placement || '') !== 'top' ? d.content_brief_video_placement || '' : '') || '').trim();
const vidIdx = V && vidPlace ? findH2(vidPlace) : -1;
const napIdx = role === 'local' ? h2List.findIndex(h => /reach|visit|contact|find us|office|locat|address|where/i.test(h)) : -1;
const faqIdx = h2List.findIndex(h => /frequently asked|^faqs?$/i.test(h));
function weave(lines, isH2, isQuick) {
  const out = []; let seen = 0, quickDone = false, firstH2Done = false;
  const pendingNext = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isH2(line)) {
      if (!firstH2Done) { firstH2Done = true; if (V && vidIdx < 0 && !quickDone) out.push(...videoParts()); if (toc()) out.push(toc()); }
      if (seen === faqIdx || (faqIdx < 0 && seen === h2List.length - 1)) { if (role === 'local' && napIdx < 0 && nap()) out.push(nap()); if (cluster()) out.push(cluster()); }
      if (pendingNext.length) { out.push(...pendingNext.splice(0)); }
      out.push(line);
      if (seen === vidIdx && V) pendingNext.push('@@VIDEO@@');
      if (seen === napIdx && nap()) pendingNext.push('@@NAP@@');
      seen++; continue;
    }
    out.push(line);
    if (pendingNext.length && line.trim() && !isH2(line) && !/^<figure|^!\[/.test(line.trim())) {   // after the first paragraph under that H2
      for (const p of pendingNext.splice(0)) out.push(...(p === '@@VIDEO@@' ? videoParts() : [nap()]));
    }
    if (!quickDone && isQuick(line)) { quickDone = true; if (V && vidIdx < 0) out.push(...videoParts()); }
  }
  if (pendingNext.length) for (const p of pendingNext.splice(0)) out.push(...(p === '@@VIDEO@@' ? videoParts() : [nap()]));
  return out;
}
let fmt = 'html';
const videoParts = () => fmt === 'html' ? [videoHtml] : ['', videoMd, ''];
const toc = () => fmt === 'html' ? tocHtml : (tocMd ? '\n' + tocMd + '\n' : '');
const nap = () => fmt === 'html' ? napHtml : (napMd ? '\n' + napMd + '\n' : '');
const cluster = () => fmt === 'html' ? clusterHtml : (clusterMd ? '\n' + clusterMd + '\n' : '');
fmt = 'html'; bodyHtml = weave(bodyHtml.split('\n'), (l) => /^<h2[ >]/.test(l), (l) => /^<p><strong>Quick answer:?<\/strong>/i.test(l)).filter(x => x !== '').join('\n');
fmt = 'md'; mdOut = weave(mdOut.split('\n'), (l) => /^##\s+/.test(l), (l) => /^\*\*Quick answer:?\*\*/i.test(l.trim())).join('\n').replace(/\n{3,}/g, '\n\n');
const html = '<article>\n<h1>' + inline(h1 || title) + '</h1>\n' + (bylineHtml ? bylineHtml + '\n' : '') + (heroImg ? figure(heroImg, true) + '\n' : '') + (snapshotHtml ? snapshotHtml + '\n' : '') + bodyHtml + (authorBoxHtml ? '\n' + authorBoxHtml : '') + (schema.length ? '\n' + schema.map(b => '<script type="application/ld+json">' + JSON.stringify(b.json || b) + '</script>').join('\n') : '') + '\n</article>';
const meta = { title, h1: h1 || title, slug, suggested_url: dom ? 'https://' + dom + '/' + slug + '/' : '/' + slug + '/', meta_description: description, meta_description_length: description.length, title_length: title.length,
  primary_keyword: d.keyword || metaLines['primary keyword'] || '', secondary_keywords: (Array.isArray(d.secondary_keywords) && d.secondary_keywords.length) ? d.secondary_keywords : String(metaLines['secondary keywords'] || '').split(/,\s*/).filter(Boolean),
  page_type: d.recommended_page || '', language: d.language_name || 'English', country: d.country || '', domain: dom, word_count: words, content_score: d.content_score == null ? null : d.content_score, qa_summary: d.qa_summary || '',
  headings, internal_links: links.filter(l => isInternal(l.url)), external_links: links.filter(l => !isInternal(l.url)), schema_blocks: schema.map(b => ({ type: b.type || ((b.json || {})['@type']) || '', json: b.json || b })),
  images, featured_image: heroImg || images[0] || null, open_graph: { 'og:title': title, 'og:description': description, 'og:image': (heroImg || images[0] || {}).path || '', 'og:image:width': 1200, 'og:image:height': 630, 'twitter:card': 'summary_large_image' },
  ladder: d.ladder_id ? { ladder_id: d.ladder_id, rung: d.ladder_rung == null ? null : d.ladder_rung, head_keyword: d.ladder_head || '' } : null, request_id: d.request_id || null, generated_at: new Date().toISOString(),
  page_role: role, article_like: articleLike,
  author: articleLike ? (AU ? { name: AU.name, job_title: AU.job_title || '', bio: AU.bio || '', credentials: AU.credentials || '', url: AU.url || '', image_url: AU.image_url || '', same_as: AU.same_as || [], knows_about: AU.knows_about || [], placeholder: false } : { name: '[Author Name]', placeholder: true }) : null,
  reviewer: RV || null, updated: today, table_of_contents: tocHtml ? tocH2.map(h => ({ text: h.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'), anchor: '#' + anchorOf(h) })) : [],
  hub: role === 'hub' ? { cluster_pages: HP, planned: HP.filter(p => p.planned).length } : null,
  case_study: CS ? { case_id: d.case_id || '', client_public: CS.client_public !== false, snapshot: Object.fromEntries(csRows) } : null,
  local: role === 'local' ? { area, business_name: (P && P.business_name) || '', address: addr, phone: (P && P.phone) || '', opening_hours: (P && P.opening_hours) || '', map_url: (P && P.map_url) || '', complete: !!(P && P.phone && PA.street) } : null,
  video: V ? { url: V.url, provider: V.provider || '', embed_url: V.embed_url || '', title: vidTitle, upload_date: V.upload_date || '', duration: V.duration_iso || '', thumbnail_url: V.thumbnail_url || '', chapters: V.chapters || [], transcript_included: !!V.transcript, missing: V.missing || [] } : null,
  eeat_notes: Array.isArray(d.eeat_notes) ? d.eeat_notes : [],
  publish_checklist: ['Use "title" as the page <title> and "h1" as the main heading', 'Paste "meta_description" into the page or SEO settings', 'Keep the slug (URL) unless your CMS needs another', 'Keep the internal links in the article and add 2-3 links to this page from existing pages', 'Add the JSON-LD blocks to the page head or body', 'Create the three images in "images" (or pick stock photos matching "subject"), save them as WebP under the given file names and sizes, keep the alt text and captions', 'Use the hero as the featured and Open Graph image (1200×630 for sharing) and set the og:image / twitter:card tags from "open_graph"', 'Then report the published URL ("I published a page" in the form, or API mode "published") so indexing and positions are tracked'] };
// v4.4 checklist items for the page's role (inserted before the final "report the URL" step)
const extra = [];
if (articleLike) extra.push(AU ? 'Keep the byline (author, updated date' + (RV ? ', reviewer' : '') + ') under the H1 and the author box at the end; link the author name to the author page' : 'Fill in the [Author] byline and author box (name, job title, bio, credentials, LinkedIn) — or set up the business profile once ("Set up my business profile") so every page carries them');
if (/\[Author insight:/i.test(md)) extra.push('Complete each [Author insight: ...] line with a real first-hand example: this is the experience Google looks for');
if (HP.length) extra.push('Keep the table of contents and the "Guides in this series" block; publish the cluster pages first' + (HP.some(p => p.planned) ? ' (' + HP.filter(p => p.planned).length + ' are planned, not live: publish them or drop their links)' : ''));
if (CS) extra.push('Get the client\'s approval of the text' + (CS.client_public === false ? ' (the client is anonymised)' : ' and the quote') + ' before publishing; link this case study from the matching service page');
if (role === 'local') extra.push('Name, address and phone must match the Google Business Profile exactly; ' + ((P && P.phone && PA.street) ? 'add the map embed' : 'fill in the [bracketed] NAP details (or complete the business profile)') + '; keep the LocalBusiness schema');
if (V) extra.push('Keep the video embed and the transcript under it; ' + ((V.missing || []).filter(m => m !== 'transcript').length ? 'fill in the VideoObject ' + V.missing.filter(m => m !== 'transcript').join(', ') : 'the VideoObject details were read from the video page') + (V.transcript ? '' : '; paste the transcript (YouTube Studio → Subtitles)'));
meta.publish_checklist.splice(meta.publish_checklist.length - 1, 0, ...extra);
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const doc = '<!DOCTYPE html>\n<html lang="' + esc(d.language_code || 'en') + '">\n<head>\n<meta charset="utf-8">\n<title>' + esc(title) + '</title>\n' + (description ? '<meta name="description" content="' + esc(description) + '">\n' : '') + (AU ? '<meta name="author" content="' + esc(AU.name) + '">\n' : '') + '</head>\n<body>\n' + html + '\n</body>\n</html>\n';
// 2026-10-09: the clean article Markdown also travels as text (article_markdown): the API callback's `markdown` used to be the raw
// draft with its "Title: / Meta Description:" lines and [Image: …] markers, saved by the web app as <slug>.md
const articleMd = '# ' + (h1 || title) + '\n\n' + (bylineMd ? bylineMd + '\n\n' : '') + (heroImg ? mdImg(heroImg) + '\n\n' : '') + (snapshotMd ? snapshotMd + '\n\n' : '') + mdOut + (authorBoxMd ? '\n\n' + authorBoxMd : '') + '\n';
return [{ json: { ...d, article_html: html, article_meta: meta, article_slug: slug, article_title: title, article_markdown: articleMd },
  binary: { ...(item.binary || {}),
    article_html: { data: b64(doc), mimeType: 'text/html', fileName: slug + '.html', fileExtension: 'html' },
    article_md: { data: b64(articleMd), mimeType: 'text/markdown', fileName: slug + '.md', fileExtension: 'md' },
    meta_json: { data: b64(JSON.stringify(meta, null, 2)), mimeType: 'application/json', fileName: slug + '.meta.json', fileExtension: 'json' } } }];
