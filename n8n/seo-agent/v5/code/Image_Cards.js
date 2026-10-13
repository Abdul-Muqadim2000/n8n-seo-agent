/*__SITE_MODEL__*/
// Image cards (FIX_PLAN G30, 2026-10-13): one HTML card per planned image, for the local renderer to turn into a WebP file.
// Until now the package only *described* three images ("3-image plan + live checks; no images produced" -- CRITERIA C13), so every page
// left the customer with three gaps to fill before publishing. This builds the images from the page's own content:
//   * the hero: the H1 over the business name and the topic, at 1200x675 (also the Open Graph image);
//   * each in-body figure: the heading it belongs under with the three to five points that section actually makes -- a numbered list for
//     steps, bullets otherwise -- so the picture carries information instead of decoration.
// Nothing is invented: every word on a card is taken from the finished article. The cards are plain HTML and CSS with the fonts the
// renderer has (Noto Sans covers Arabic, Thai and the other scripts our markets write in); no JavaScript, no web request, no licence.
// A run with no article (a report-only run) emits one `skip` item so the chain downstream still gets exactly one item.
const item = $input.first();
const d = item.json || {};
const meta = d.article_meta || {};
const images = Array.isArray(meta.images) ? meta.images : [];
const md = String(d.article_markdown || d.page_markdown || '');
if (!images.length || !md.trim()) return [{ json: { skip: true, reason: images.length ? 'no article text in this run' : 'no image plan in this run' } }];

const S = (v) => String(v == null ? '' : v);
const esc = (s) => S(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (s) => S(s).replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`#>]+/g, '').replace(/\s+/g, ' ').trim();
// a cut never ends on a half word or on a dangling "to a" / "of the"
const clip = (s, n) => { const t = plain(s); if (t.length <= n) return t;
  return t.slice(0, n - 1).replace(/[\s,;:.]+\S*$/, '').replace(/(\s+(?:a|an|the|and|or|of|to|for|in|on|with|by|from|at|as|that|which|is|are|was|were))+$/i, '') + '…'; };

// the business name and the site: the model first (G19), then the profile, then the domain
let MODEL = null;
try { MODEL = $('Site Model').first().json.site_model || null; } catch (e) {}
if (!MODEL && d.site_model && typeof d.site_model === 'object') MODEL = d.site_model;
const dom = S(meta.domain || d.domain).toLowerCase().replace(/^www\./, '');
const brand = S((d.site_profile && d.site_profile.business_name) || (MODEL ? SM.name(MODEL) : '') || dom.split('.')[0]).slice(0, 48);
const topic = clip(d.keyword || meta.primary_keyword || '', 60);

// ---- the points each in-body card shows: from the section the image sits under ----
const lines = md.split('\n');
const sections = [];
let cur = null;
for (const ln of lines) {
  const h = ln.match(/^##\s+(.+)$/);
  if (h) { cur = { heading: plain(h[1]), body: [] }; sections.push(cur); continue; }
  if (cur) cur.body.push(ln);
}
const pointsFor = (heading) => {
  const norm = (t) => plain(t).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const key = norm(heading);
  let sec = sections.find(s => norm(s.heading) === key);
  if (!sec && key) sec = sections.find(s => norm(s.heading).includes(key) || key.includes(norm(s.heading)));
  if (!sec) sec = sections[0];
  if (!sec) return { heading: plain(heading), points: [], numbered: false };
  const bullets = sec.body.map(l => l.match(/^\s*(\d+[.)]|[-*•])\s+(.+)$/)).filter(Boolean);
  const numbered = bullets.length >= 3 && /^\d/.test(bullets[0][1]);
  let points = bullets.map(b => clip(b[2], 95)).filter(x => x.length > 12);
  if (points.length < 3) {   // prose section: its first sentences, one per line
    const text = plain(sec.body.filter(l => !/^\s*\|/.test(l)).join(' '));
    points = text.split(/(?<=[.!?])\s+/).map(x => clip(x, 110)).filter(x => x.length > 30).slice(0, 4);
  }
  return { heading: plain(sec.heading) || plain(heading), points: points.slice(0, 5), numbered };
};

// The card has to fit its canvas exactly: the renderer clips at the given size, so the type scales with how much the section says and the
// text area clips rather than pushing the footer off the picture.
const CSS = (f) => `*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%}
body{font-family:'Noto Sans','DejaVu Sans','Liberation Sans',Arial,sans-serif;-webkit-font-smoothing:antialiased;background:#0E1726;color:#F8FAFC;display:flex;flex-direction:column;overflow:hidden}
.bar{height:10px;background:#2563EB;flex:0 0 10px}
.main{flex:1 1 auto;min-height:0;overflow:hidden;padding:${f.padV}px ${f.padH}px ${Math.round(f.padV / 2)}px;display:flex;flex-direction:column;justify-content:center}
.footwrap{flex:0 0 auto;padding:0 ${f.padH}px ${Math.round(f.padV * 0.7)}px}
.eyebrow{font-size:${f.eyebrow}px;letter-spacing:.14em;text-transform:uppercase;color:#93B4F7;font-weight:600}
h1{font-size:${f.title}px;line-height:1.12;font-weight:700;letter-spacing:-.02em;margin-top:${Math.round(f.eyebrow * 1.1)}px}
h2{font-size:${f.title}px;line-height:1.18;font-weight:700;letter-spacing:-.01em;color:#FFFFFF;margin-top:${Math.round(f.eyebrow * 0.9)}px}
.points{margin-top:${f.gap + 8}px;display:flex;flex-direction:column;gap:${f.gap}px}
.point{display:flex;gap:${Math.round(f.body * 0.6)}px;align-items:flex-start;font-size:${f.body}px;line-height:1.32;color:#DCE4F2}
.dot{flex:0 0 ${Math.round(f.body * 1.3)}px;height:${Math.round(f.body * 1.3)}px;border-radius:999px;background:#1D3C82;color:#CFE0FF;font-size:${Math.round(f.body * 0.72)}px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:2px}
.foot{display:flex;justify-content:space-between;align-items:center;gap:24px;font-size:${f.foot}px;color:#8FA3C4;border-top:1px solid #1E2B44;padding-top:${Math.round(f.foot * 0.9)}px}
.foot span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.foot b{color:#E6EDF9;font-weight:600}
.card--light{background:#F6F8FC;color:#0E1726}
.card--light h2{color:#0E1726}.card--light .point{color:#27354C}.card--light .dot{background:#DCE6FB;color:#17408F}
.card--light .foot{color:#5A6B86;border-top-color:#DAE1EC}.card--light .foot b{color:#17223A}`;

const page = (w, h, light, f, inner) => '<!doctype html><html lang="' + esc(d.language_code || 'en') + '"><head><meta charset="utf-8">'
  + '<style>html,body{width:' + w + 'px;height:' + h + 'px}' + CSS(f) + '</style></head><body class="' + (light ? 'card--light' : '') + '">'
  + '<div class="bar"></div><main class="main">' + inner + '</main><div class="footwrap">'
  + '<div class="foot"><span><b>' + esc(brand) + '</b>' + (dom ? ' · ' + esc(dom) : '') + '</span><span>' + esc(topic) + '</span></div></div></body></html>';

const out = images.map((im, i) => {
  const hero = S(im.purpose) === 'hero';
  const w = Number(im.width) || (hero ? 1200 : 1000), h = Number(im.height) || (hero ? 675 : 600);
  let inner, f;
  if (hero) {
    const title = clip(meta.h1 || meta.title || topic, 110);
    f = { padV: 60, padH: 72, eyebrow: 22, title: title.length > 72 ? 50 : title.length > 46 ? 58 : 66, body: 26, gap: 20, foot: 22 };
    inner = '<p class="eyebrow">' + esc(topic || brand) + '</p><h1>' + esc(title) + '</h1>';
  } else {
    const p = pointsFor(im.placement || im.subject || im.alt_text);
    // a point is cut at a clause, never mid-phrase: a card that ends in "and a…" reads worse than a shorter, whole statement
    const short = (t) => { const x = plain(t); if (x.length <= 88) return x; const cut = x.slice(0, 88); const c = cut.lastIndexOf(','); return c > 45 ? cut.slice(0, c) : clip(x, 88); };
    const pts = p.points.slice(0, p.numbered ? 5 : 4).map(short);   // every step of a numbered list, or four bullets
    const chars = pts.join(' ').length;
    const heading = clip(p.heading, 70);
    f = { padV: 46, padH: 56, eyebrow: 19,
      title: heading.length > 46 ? 34 : 40,
      body: pts.length >= 5 ? 20 : pts.length === 4 || chars > 260 ? 21 : pts.length === 3 ? 23 : 26,
      gap: pts.length >= 5 ? 11 : pts.length === 4 ? 13 : 17, foot: 19 };
    inner = '<p class="eyebrow">' + esc(topic || brand) + '</p><h2>' + esc(heading) + '</h2>'
      + (pts.length ? '<div class="points">' + pts.map((x, k) => '<div class="point"><span class="dot">' + (p.numbered ? (k + 1) : '•') + '</span><span>' + esc(x) + '</span></div>').join('') + '</div>' : '');
  }
  return { json: { slot: Number(im.slot) || i + 1, index: i, filename: S(im.filename), alt_text: S(im.alt_text), caption: S(im.caption),
      purpose: S(im.purpose), width: w, height: h, format: 'webp', kind: hero ? 'title card' : 'section summary card', skip: false },
    binary: { html: { data: Buffer.from(page(w, h, !hero, f, inner), 'utf8').toString('base64'), mimeType: 'text/html', fileName: 'index.html', fileExtension: 'html' } } };
});
return out.slice(0, 4);
