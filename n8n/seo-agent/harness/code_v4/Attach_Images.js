// Attach images (FIX_PLAN G30, 2026-10-13): the rendered files join the blog package, and meta.json says which ones exist.
// *Render Images* answered once per card (the local renderer, no API, no licence, no cost). Here the bytes are read off disk -- n8n keeps
// an HTTP node's binary as a file, so `.data` is only a reference and `getBinaryDataBuffer` is the only way to the bytes -- and attached
// under the file names the plan already carried, so the alt text, the caption, the dimensions and the Open Graph image all still match.
// Nothing here can fail the run: a card the renderer could not produce keeps its place in the plan with the reason, and the publish
// checklist then still asks the owner for that one image.
const cards = $('Image Cards').all().map(i => i.json || {});
const pkg = $('Blog Package').first();
const base = pkg.json || {};
const binary = { ...(pkg.binary || {}) };
const meta = JSON.parse(JSON.stringify(base.article_meta || {}));
const planned = Array.isArray(meta.images) ? meta.images : [];
if (!planned.length || (cards.length === 1 && cards[0].skip)) return [pkg];

const rendered = $input.all();
const ok = [], failed = [], altSwaps = [];
for (let i = 0; i < planned.length; i++) {
  const card = cards[i] || {};
  const r = rendered[i] || {};
  const rj = r.json || {};
  const key = 'image_' + (i + 1);
  let bytes = null;
  if (!rj.error) {
    try { const buf = await this.helpers.getBinaryDataBuffer(i, 'image'); if (buf && buf.length > 500) bytes = buf; } catch (e) {}
    if (!bytes) { const b = (r.binary || {}).image; if (b && b.data && String(b.data).length > 600) bytes = Buffer.from(b.data, 'base64'); }
  }
  if (!bytes) {
    const why = String((rj.error && (rj.error.message || rj.error)) || 'the renderer returned no file').slice(0, 160);
    planned[i] = { ...planned[i], produced: false, produce_error: why };
    failed.push({ file: planned[i].filename, reason: why });
    continue;
  }
  const name = String(planned[i].filename || key + '.webp');
  binary[key] = { data: bytes.toString('base64'), mimeType: 'image/webp', fileName: name, fileExtension: 'webp' };
  // M6 (2026-10-21, exec 42): the hero was a dark title card while its alt text described "an AI consultant working with a UAE enterprise
  // team"; the alt text of a produced card is what the card shows, and the planned one is kept for a photo that replaces it
  const cardAlt = String(card.card_alt || '').trim();
  if (cardAlt && cardAlt !== planned[i].alt_text) altSwaps.push({ from: String(planned[i].alt_text || ''), to: cardAlt });
  planned[i] = { ...planned[i], ...(cardAlt ? { alt_text: cardAlt, alt_text_for_a_photo: planned[i].alt_text || '' } : {}), produced: true, bytes: bytes.length, kb: Math.max(1, Math.round(bytes.length / 1024)),
    format: 'webp', made: card.kind || 'card', made_by: 'generated from this page by the local renderer', binary_key: key };
  ok.push({ file: name, kb: Math.max(1, Math.round(bytes.length / 1024)), alt_text: planned[i].alt_text, binary_key: key });
}
meta.images = planned;
meta.images_produced = ok.length;
meta.images_planned = planned.length;
meta.image_notes = ok.length
  ? ok.length + ' of ' + planned.length + ' images are attached as WebP (' + ok.map(x => x.file).join(', ') + '), generated from this page\'s own content and sized as planned. Their alt text says what each card shows. Replace any of them with a photo or your own graphic if you prefer: keep the file name, and use "alt_text_for_a_photo" as its alt text.'
  : 'No image could be produced in this run (' + (failed[0] ? failed[0].reason : 'renderer unavailable') + '); the plan below says what each image should show.';
// the checklist asked for three images to be created: say what is already there
const CHK = Array.isArray(meta.publish_checklist) ? meta.publish_checklist : [];
meta.publish_checklist = CHK.map(step => (/^Create the three images/.test(String(step)) && ok.length)
  ? 'Save the ' + ok.length + ' attached image file(s) (' + ok.map(x => x.file).join(', ') + ') into your media library under those exact file names, keep the alt text and captions from "images", and swap any of them for a photo or your own graphic if you prefer'
  : step);

const out = { ...base, article_meta: meta, images_produced: ok.length, images_failed: failed.length,
  article_images: ok.map(x => ({ ...x, kind: 'image' })) };
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
// the article carries the same alt text as meta.json: the HTML <img alt="..."> and the Markdown ![...](path) are rewritten for every card
const escA = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');   // Blog Package's own escape, so the match is exact
const swapAlt = (text, html) => altSwaps.reduce((t, x) => !x.from ? t : html ? t.split('alt="' + escA(x.from) + '"').join('alt="' + escA(x.to) + '"')
  : t.split('![' + x.from.replace(/[\[\]]/g, '') + '](').join('![' + x.to.replace(/[\[\]]/g, '') + ']('), String(text || ''));
if (altSwaps.length) {
  if (typeof out.article_html === 'string') out.article_html = swapAlt(out.article_html, true);
  if (typeof out.article_markdown === 'string') out.article_markdown = swapAlt(out.article_markdown, false);
  const fromB64 = (b) => Buffer.from(String(b || ''), 'base64').toString('utf8');
  if (binary.article_html && binary.article_html.data) binary.article_html = { ...binary.article_html, data: b64(swapAlt(fromB64(binary.article_html.data), true)) };
  if (binary.article_md && binary.article_md.data) binary.article_md = { ...binary.article_md, data: b64(swapAlt(fromB64(binary.article_md.data), false)) };
}
if (binary.meta_json) binary.meta_json = { ...binary.meta_json, data: b64(JSON.stringify(meta, null, 2)) };
return [{ json: out, binary }];
