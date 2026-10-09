// The link check (v4.10): every fetched page read against the site — found (with rel, anchor, placement, noindex, canonical, outbound links,
// the text around the link), missing (the page answers but no longer links), gone (404 / 410 / domain gone), blocked or JavaScript-only (not
// checked: never counted as lost), error. Mention pages: does the page name the business, and does it link? List pages ("best X"): which
// competitors it names or links, and whether it names you. Own pages: their status (a linked page that answers 404 loses its links).
// Rendered copies (Jina) replace a blocked / JavaScript-only fetch. One item per fetched page.
/*__LINK_KIT__*/
const reqs = $('Verify Requests').all().map(i => i.json); let resps = []; try { resps = $('Fetch Linking Pages').all().map(i => i.json || {}); } catch (e) {}
let rreqs = [], rresps = []; try { rreqs = $('Render Requests').all().map(i => i.json).filter(r => !r.skip); rresps = $('Render Pages').all().map(i => i.json || {}); } catch (e) {}
const plans = $('BL Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const rendered = new Map(); rreqs.forEach((r, k) => { const x = rresps[k] || {}; const body = typeof x === 'string' ? x : (x.data ?? x.body ?? x.rendered ?? ''); if (body && String(body).length > 100) rendered.set(r.index, { statusCode: 200, body: String(body), headers: {} }); });
const out = [];
reqs.forEach((r, i) => {
  if (r.skip || !r.url) return;
  const p = plans.find(x => x.site_id === r.site_id) || {}; let page = resps[i] || {}; let via = 'fetch';
  if (rendered.has(i)) { page = rendered.get(i); via = 'render'; }
  const base = { site_id: r.site_id, domain: r.domain, purpose: r.purpose, ref_domain: r.ref_domain, url: r.url, why: r.why || '', source: r.source || '', via, checked_at: p.checked_at || new Date().toISOString() };
  if (r.purpose === 'target') { const st = Number(page.statusCode) || 0; out.push({ json: { ...base, status: st, broken: st === 404 || st === 410 || (!st && !!page.error), referring: r.referring || 0 } }); return; }
  if (r.purpose === 'mention') { const res = LK.mention(page, r.domain, (p.brand_res || []).map(s => new RegExp(s, 'i'))); out.push({ json: { ...base, ...res, title: res.title || r.title || '', date: r.date || '' } }); return; }
  if (r.purpose === 'list') {
    const html = String(page.body ?? page.data ?? ''); const v = LK.verify(page, r.domain, { url: r.url }); const t = LK.text(html).toLowerCase();
    const comps = (p.competitors || []).filter(c => LK.linksTo(html, c).length || (c.split('.')[0].length >= 5 && t.includes(c.split('.')[0].toLowerCase())));
    const named = v.verify === 'found' || (p.brand_res || []).some(s => new RegExp(s, 'i').test(t));
    out.push({ json: { ...base, verify: v.verify, status: v.status, title: v.title || r.title || '', topic: r.topic || '', competitors_named: comps, named, linked: v.verify === 'found', outbound: v.outbound_domains || 0 } }); return;
  }
  out.push({ json: { ...base, ...LK.verify(page, r.domain, { url: r.url }), located: !!r.located } });
});
return out.length ? out : [{ json: { skip: true } }];
