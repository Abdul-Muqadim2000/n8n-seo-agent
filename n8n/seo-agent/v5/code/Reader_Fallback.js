// W07-A (2026-10-31, docs/page-quality-2026-10-29/WAVE06.md "Open resilience item"): the reads of *__READER__* that the page reader REFUSED
// (its key, its balance, its rate: HTTP 401 / 402 / 429, or 403 in its own words) are read again another way, and everything else is handed on
// exactly as the reader answered it. This node took the reader node's name, so every node that reads `$('__NAME__')` reads these items, in the
// same order and the same shape. With a funded key no item is refused and nothing changes (the same objects are returned).
//   * a refused read: the same reader without the key (capped and spaced: its free limit is about 20 reads a minute), then, for a text read,
//     a direct fetch of the page in the reader's line format (the client-render path's HTML-to-text, CRK.linesOf);
//   * a read nothing recovered stays an error item, with the reason and `reader_fallback.via: 'none'`, so no later step mistakes a refused read
//     for "the page has no title" or "the competitor wrote nothing";
//   * *Reader Refusals* reads these items and raises ONE ops alert per run for the refusal (seo_ops_alerts, then the alert webhook).
// What was read here: __LABEL__ (mode __MODE__).
/*__LINK_KIT__*/
/*__CLIENT_RENDER__*/
/*__READER__*/
const H = this.helpers;
const res = $input.all().map(i => (i && i.json) || {});
let reqs = [];
try { reqs = $('__REQS__').all().map(i => (i && i.json) || {}); } catch (e) { reqs = []; }
const r = await RD.recover(H, { reqs, res, mode: '__MODE__', full: __FULL__, prop: '__PROP__', headers: __HEADERS__, links: __LINKS__,
  target: (q) => __TARGET__, domain: (q) => __DOMAIN__, path: '__LABEL__', node: '__NAME__',
  sleep: (H && typeof H.sleep === 'function') ? H.sleep : undefined });   // n8n has no helpers.sleep: the kit waits with setTimeout there
return r.items.map((j, i) => ({ json: j, pairedItem: { item: i } }));
