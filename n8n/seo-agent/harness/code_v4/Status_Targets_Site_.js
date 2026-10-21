// RV-1 (2026-10-21, pre-launch run on techand.ai): what the pages Google shows, and the sitemap does not list, answer TODAY. The site had been
// rebuilt: Search Console still showed ~34 old addresses (2-3k of 5.7k impressions) that 404, the inventory stored them with no status, and
// the weekly report told the owner to make one of them "the single page" for a search. Each week, up to CONFIG.per_site of them (the most
// impressions first, the ones gone last week again, so a redirect added since is seen) are read with one free plain GET, redirects
// followed (*Fetch Page Status (Site)*). Page Inventory (Site) stores the answer on the page row (seo_pages.http_status / status_at) and
// every reader asks SM.isGone. A page whose live answer was read in the last CONFIG.recheck_days is not read again.
const CONFIG = { per_site: 40, per_run: 120, recheck_days: 6 };
const sites = $('Resolve Properties').all().map(i => i.json);
const grab = (name) => { try { return $(name).all().map(i => i.json).filter(j => j && !j.skip && !j.error); } catch (e) { return []; } };
const gscAll = grab('Parse GSC');
const detAll = grab('Detect Published').filter(x => x.site_id);
const stored = grab('Load Pages (Site)').filter(r => r.site_id && r.url);
const key = (u) => String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
const days = (d) => { const t = Date.parse(String(d || '')); return Number.isFinite(t) ? (Date.now() - t) / 864e5 : Infinity; };
let run = 0; const items = []; const plan = [];
sites.forEach((s, idx) => {
  const gsc = gscAll.find(g => g.site_idx === idx) || null;
  const det = detAll.find(x => x.site_id === s.site_id) || null;
  const inSitemap = new Set(((det && det.inventory) || []).map(u => key(u.url)));
  const storedBy = new Map(stored.filter(r => r.site_id === s.site_id).map(r => [key(r.url), r]));
  const cand = new Map();
  for (const p of ((gsc && gsc.pages) || [])) { const u = String(p.page || '').trim(); const k = key(u); if (!u || !k || inSitemap.has(k)) continue;
    const c = cand.get(k) || { url: u, impressions: 0, clicks: 0 }; c.impressions += Number(p.impressions) || 0; c.clicks += Number(p.clicks) || 0; cand.set(k, c); }
  // an address found gone before is read again every week until it redirects (or Google forgets it)
  for (const [k, r] of storedBy) { const st = Number(r.http_status) || 0; if ((st === 404 || st === 410) && !cand.has(k) && !inSitemap.has(k)) cand.set(k, { url: r.url, impressions: Number(r.impressions) || 0, clicks: Number(r.clicks) || 0 }); }
  const list = [...cand.entries()].filter(([k]) => { const r = storedBy.get(k); const st = r ? Number(r.http_status) || 0 : 0;
    return !(st >= 200 && st < 300 && days(r.status_at) < CONFIG.recheck_days); }).map(([, c]) => c).sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks);
  const take = []; for (const c of list) { if (take.length >= CONFIG.per_site || run >= CONFIG.per_run) break; take.push(c); run++; }
  plan.push({ site_id: s.site_id, wanted: list.length, planned: take.length, left: list.length - take.length, sitemap_read: !!(det && det.inventory && det.inventory.length) });
  for (const c of take) items.push({ site_id: s.site_id, site_idx: idx, url: c.url, impressions: c.impressions, clicks: c.clicks });
});
return items.length ? items.map((it, i) => ({ json: i === 0 ? { ...it, status_plan: plan } : it })) : [{ json: { skip: true, status_plan: plan } }];
