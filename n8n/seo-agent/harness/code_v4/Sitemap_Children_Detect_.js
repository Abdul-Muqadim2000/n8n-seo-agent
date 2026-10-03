// Publish detection, step 2: when a site's /sitemap.xml is a sitemap index (Yoast, Rank Math, WordPress core, Shopify, ...), the 5 most recently
// changed child sitemaps are read next — new pages land in the newest one; tag / category / author / image / video sitemaps come last. The
// parsing follows the audit's (Sitemap Children (Audit)); the HTTP node returns text bodies under `data`.
const CONFIG = { max_children: 5, max_body_chars: 5000000 };
const sites = $('Publish Candidates').all().map(i => i.json);
const res = $input.all().map(i => i.json || {});
const bodyOf = (r) => { const b = r && (r.body != null ? r.body : r.data); return typeof b === 'string' ? b : (b ? JSON.stringify(b) : ''); };
const tagOf = (blk, t) => { const m = blk.match(new RegExp('<' + t + '>\\s*(?:<!\\[CDATA\\[)?\\s*([^<\\]\\s]+)', 'i')); return m ? m[1].replace(/&amp;/g, '&').trim() : ''; };
const lowValue = (u) => /tag|categor|author|image|video|attachment|archive|format/i.test(String(u).split('?')[0].split('/').pop());
const out = [];
sites.forEach((s, i) => {
  if (s.skip) return;
  const r = res[i] || {}; const status = Number(r.statusCode) || (r.error ? 0 : 200); const body = bodyOf(r).slice(0, CONFIG.max_body_chars);
  if (status !== 200 || !/<sitemapindex/i.test(body)) return;
  const kids = [...body.matchAll(/<sitemap\b[^>]*>([\s\S]*?)<\/sitemap>/gi)].map(m => ({ loc: tagOf(m[1], 'loc'), lastmod: tagOf(m[1], 'lastmod') })).filter(k => /^https?:\/\//i.test(k.loc));
  kids.sort((a, b) => (lowValue(a.loc) - lowValue(b.loc)) || String(b.lastmod).localeCompare(String(a.lastmod)));
  kids.slice(0, CONFIG.max_children).forEach(k => out.push({ json: { site_idx: s.site_idx, site_id: s.site_id, url: k.loc, lastmod: k.lastmod, total_children: kids.length } }));
});
return out.length ? out : [{ json: { skip: true, reason: 'no sitemap index to follow' } }];
