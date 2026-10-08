// The link ledger (v4.10, seo_backlinks, upsert by site + referring site; exact columns): every referring site from every source with the
// latest link check, its three values and its history (first / last seen, lost with the reason). Only new and changed rows are written (a big
// site has thousands of referrers and most do not change from week to week); a row nobody touched for 30 days is refreshed anyway.
const COLS = ['site_id', 'domain', 'ref_domain', 'kind', 'from_url', 'to_url', 'anchor', 'anchor_kind', 'rel', 'placement', 'link_type', 'relevance', 'note', 'sources', 'source_count', 'first_seen', 'last_seen', 'status', 'lost_at', 'lost_reason', 'miss_count',
  'verify', 'verified_at', 'noindex', 'canonical_elsewhere', 'outbound', 'page_title', 'context', 'authority', 'dr', 'cc_rank', 'page_keywords', 'spam_score', 'original', 'sitewide', 'links', 'visits', 'key_events', 'ai_cited', 'seo_value', 'referral_value', 'brand_value', 'updated_at'];
const WATCH = ['status', 'verify', 'verified_at', 'sources', 'from_url', 'rel', 'placement', 'link_type', 'anchor', 'authority', 'dr', 'cc_rank', 'miss_count', 'last_seen', 'visits', 'key_events', 'seo_value', 'referral_value', 'brand_value', 'spam_score', 'noindex', 'ai_cited', 'lost_reason'];
let prev = []; try { prev = $('Load Backlinks').all().map(i => i.json).filter(r => r && r.site_id && r.ref_domain); } catch (e) {}
const before = new Map(prev.map(r => [r.site_id + '|' + r.ref_domain, r]));
const same = (a, b) => String(a ?? '') === String(b ?? '') || (Number(a) === Number(b) && a !== '' && b !== '' && a != null && b != null);
const out = [];
for (const s of $('Parse Backlinks').all().map(i => i.json)) for (const r of (s.ledger_rows || [])) {
  const o = {}; for (const c of COLS) o[c] = r[c] === undefined || r[c] === null ? '' : r[c]; if (o.relevance === '') o.relevance = null;
  const pv = before.get(r.site_id + '|' + r.ref_domain);
  if (pv && WATCH.every(c => same(o[c], pv[c])) && (Date.now() - new Date(pv.updated_at || 0).getTime()) / 864e5 < 30) continue;
  out.push({ json: o }); }
return out.length ? out : [{ json: { skip: true } }];
