// Per site: link profile now vs the last check, links lost (important ones = alert), new links (spammy ones flagged), links pointing to broken
// pages on the site (reclaim with a redirect), 12 months of history, unlinked brand mentions, the link gap (domains linking to competitors, not
// to you), alerts and the prospect candidates (gap / mention / lost / reclaim). Rank and spam score are DataForSEO's 0-1000 and 0-100 scales.
const plans = $('BL Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const reqs = $('BL Requests').all().map(i => i.json); const resps = $('Run BL Requests').all().map(i => i.json || {});
let greqs = [], gresps = []; try { greqs = $('Gap Requests').all().map(i => i.json); gresps = $('Run Gap Requests').all().map(i => i.json || {}); } catch (e) {}
const SPAM_WORDS = /\b(pbn|buy (?:cheap )?backlinks?|backlinks? (?:service|package)|link ?farm|casino|betting|slots?|porn|xxx|viagra|cialis|payday|escort|essay writing)\b/i;
const BIG = /(^|\.)(google|youtube|facebook|linkedin|wikipedia|amazon|apple|microsoft|reddit|quora|instagram|twitter|x|tiktok|medium|github|pinterest|blogspot|wordpress|tumblr)\.[a-z.]+$/i;
const result = (rs, i) => { const t = ((rs[i] || {}).tasks || [])[0] || {}; return { ok: t.status_code === 20000, res: (t.result || [])[0] || null, cost: Number(t.cost) || 0, error: t.status_code && t.status_code !== 20000 ? t.status_message : ((rs[i] || {}).error ? String((rs[i].error.message || rs[i].error)).slice(0, 160) : null) }; };
const pathOf = (u) => String(u || '').replace(/^https?:\/\/[^\/]+/i, '') || '/';
const toks = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(t => t.length > 2);
return plans.map(p => {
  const get = (kind) => { const out = []; reqs.forEach((r, i) => { if (r.site_id === p.site_id && r.kind === kind) out.push(result(resps, i)); }); return out; };
  const one = (kind) => get(kind)[0] || { ok: false, res: null, cost: 0, error: 'not requested' };
  const cost = reqs.reduce((s, r, i) => s + (r.site_id === p.site_id ? result(resps, i).cost : 0), 0) + greqs.reduce((s, r, i) => s + (r.site_id === p.site_id ? result(gresps, i).cost : 0), 0);
  const S = one('summary'); const sm = S.res || {};
  const summary = { rank: Number(sm.rank) || 0, backlinks: Number(sm.backlinks) || 0, referring_domains: Number(sm.referring_domains) || 0, referring_domains_nofollow: Number(sm.referring_domains_nofollow) || 0, spam_score: Number(sm.backlinks_spam_score) || 0, broken_backlinks: Number(sm.broken_backlinks) || 0, broken_pages: Number(sm.broken_pages) || 0, available: S.ok, error: S.error };
  const spamOf = (x) => Number(x.backlink_spam_score) >= 50 || SPAM_WORDS.test(String(x.anchor || '') + ' ' + String(x.page_from_title || ''));
  const link = (x) => ({ from_domain: String(x.domain_from || '').replace(/^www\./, ''), from_url: x.url_from || '', to_url: x.url_to || '', anchor: String(x.anchor || '').slice(0, 120), dofollow: !!x.dofollow, domain_rank: Number(x.domain_from_rank) || 0, page_rank: Number(x.page_from_rank) || 0, spam: Number(x.backlink_spam_score) || 0, first_seen: String(x.first_seen || '').slice(0, 10), last_seen: String(x.last_seen || '').slice(0, 10), title: String(x.page_from_title || '').slice(0, 120) });
  const lost = ((one('lost').res || {}).items || []).map(link);
  const isImportant = (l) => l.spam < 40 && (l.domain_rank >= 150 || l.page_rank >= 100 || (l.dofollow && l.domain_rank >= 80));
  const important_lost = lost.filter(isImportant);
  const news = ((one('new').res || {}).items || []).map(x => ({ ...link(x), spammy: spamOf(x) }));
  const spammy = news.filter(x => x.spammy);
  // reclaim: links that point to broken pages here -> 301 to the closest live page
  const live = [...p.assets.map(a => a.url), 'https://' + p.domain + '/'];
  const suggest = (u) => { const t = new Set(toks(pathOf(u))); let best = live[live.length - 1], score = 0; for (const c of live) { const s = toks(pathOf(c)).filter(x => t.has(x)).length; if (s > score) { score = s; best = c; } } return best; };
  const brokenLinks = ((one('broken').res || {}).items || []).map(x => ({ ...link(x), status: Number(x.url_to_status_code) || null }));
  const reclaimMap = new Map();
  for (const b of brokenLinks) { const k = b.to_url; const r = reclaimMap.get(k) || { broken_url: k, status: b.status, links: 0, domains: new Set(), redirect_to: suggest(k) }; r.links++; r.domains.add(b.from_domain); reclaimMap.set(k, r); }
  const reclaim = [...reclaimMap.values()].map(r => ({ ...r, domains: [...r.domains].slice(0, 8) })).sort((a, b) => b.links - a.links).slice(0, 20);
  const refdomains = new Set(((one('refdomains').res || {}).items || []).map(x => String(x.domain || '').replace(/^www\./, '')).filter(Boolean));
  const tsNew = ((one('timeseries').res || {}).items || []).map(x => ({ month: String(x.date || '').slice(0, 7), backlinks: Number(x.backlinks) || 0, referring_domains: Number(x.referring_domains) || 0, rank: Number(x.rank) || 0 }));
  const tsMap = new Map((p.stored_timeseries || []).filter(x => x && x.month).map(x => [x.month, x])); for (const x of tsNew) tsMap.set(x.month, x);   // stored history + the fresh months
  const ts = [...tsMap.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-13);
  // unlinked mentions: pages naming the brand on a domain that does not link to you
  const brandRe = p.brand_names.map(b => new RegExp(String(b).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  const mentions = [];
  for (const m of get('mentions')) for (const x of ((m.res || {}).items || [])) { const d = String(x.domain || '').replace(/^www\./, ''); const ci = x.content_info || {}; const txt = (ci.title || '') + ' ' + (ci.snippet || '');
    if (!d || d === p.domain || d.endsWith('.' + p.domain) || refdomains.has(d) || BIG.test(d) || !brandRe.some(re => re.test(txt)) || mentions.some(y => y.domain === d)) continue;
    mentions.push({ domain: d, url: x.url || '', title: String(ci.title || '').slice(0, 140), domain_rank: Number(x.domain_rank) || 0, spam: Number(x.spam_score) || 0 }); }
  // link gap
  const gi = greqs.findIndex(g => g.site_id === p.site_id); const G = gi >= 0 ? result(gresps, gi) : null; const competitors = gi >= 0 ? greqs[gi].competitors : p.competitors;
  const freshGap = ((G && G.res && G.res.items) || []).map(it => { const vals = Object.entries(it.domain_intersection || {}); const f = (vals[0] || [])[1] || {};
    return { domain: String(f.target || '').replace(/^www\./, ''), rank: Number(f.rank) || 0, spam: Number(f.backlinks_spam_score) || 0, links_to: vals.map(([k]) => competitors[Number(k) - 1]).filter(Boolean), backlinks: vals.reduce((s, [, v]) => s + (Number(v.backlinks) || 0), 0) }; })
    .filter(g => g.domain && g.spam < 30 && !BIG.test(g.domain) && !refdomains.has(g.domain) && g.domain !== p.domain).sort((a, b) => (b.links_to.length - a.links_to.length) || (b.rank - a.rank)).slice(0, 30);
  const gap = gi >= 0 ? freshGap : (p.stored_gap || []).filter(g => !refdomains.has(g.domain));   // between quarterly refreshes: the stored gap prospects
  // alerts
  const prev = p.previous; const alerts = [];
  if (important_lost.length) alerts.push({ level: 'high', text: important_lost.length + ' important link(s) lost: ' + important_lost.slice(0, 3).map(l => l.from_domain + ' (authority ' + l.domain_rank + ')').join(', ') + '.' });
  if (spammy.length >= 3) alerts.push({ level: 'medium', text: spammy.length + ' new spammy links (PBN / link-farm pages) since ' + p.since.slice(0, 10) + '.' });
  if (prev && summary.available && prev.spam_score && summary.spam_score - prev.spam_score >= 15) alerts.push({ level: 'medium', text: 'Link spam score rose from ' + prev.spam_score + ' to ' + summary.spam_score + '.' });
  if (prev && summary.available && prev.referring_domains >= 10 && summary.referring_domains < prev.referring_domains * 0.9) alerts.push({ level: 'medium', text: 'Referring domains fell from ' + prev.referring_domains + ' to ' + summary.referring_domains + '.' });
  if (reclaim.length) alerts.push({ level: 'low', text: reclaim.reduce((s, r) => s + r.links, 0) + ' link(s) point to ' + reclaim.length + ' broken page(s): redirect them to keep the value.' });
  const deliver = p.mode === 'full' || p.on_demand || alerts.some(a => a.level === 'high' || a.level === 'medium');
  // disavow candidates (review, do not upload blindly: Google ignores most spam on its own)
  const disavow = [...new Set([...spammy.filter(x => x.spam >= 60 || SPAM_WORDS.test(x.anchor + ' ' + x.title)).map(x => x.from_domain)])];
  const disavow_text = disavow.length ? '# Disavow candidates for ' + p.domain + ' (' + p.checked_at.slice(0, 10) + ')\n# Review before uploading at https://search.google.com/search-console/disavow-links — Google ignores most spam links on its own;\n# disavow only for a manual action or a clear paid-link pattern you did not create.\n' + disavow.map(d => 'domain:' + d).join('\n') + '\n' : '';
  const candidates = [
    ...important_lost.map(l => ({ prospect_domain: l.from_domain, type: 'lost', rank: l.domain_rank, spam_score: l.spam, detail: 'Linked to ' + pathOf(l.to_url) + ' from ' + l.from_url + ' until ' + l.last_seen, source_url: l.from_url, target_url: l.to_url })),
    ...reclaim.flatMap(r => r.domains.slice(0, 3).map(d => ({ prospect_domain: d, type: 'reclaim', rank: 0, spam_score: 0, detail: 'Links to ' + pathOf(r.broken_url) + ' (HTTP ' + (r.status || 'error') + '): 301-redirect it to ' + pathOf(r.redirect_to), source_url: '', target_url: r.redirect_to }))),
    ...mentions.slice(0, 10).map(m => ({ prospect_domain: m.domain, type: 'mention', rank: m.domain_rank, spam_score: m.spam, detail: 'Mentions you without a link: ' + m.title, source_url: m.url, target_url: 'https://' + p.domain + '/' })),
    ...freshGap.slice(0, 25).map(g => ({ prospect_domain: g.domain, type: 'gap', rank: g.rank, spam_score: g.spam, detail: 'Links to ' + g.links_to.join(', ') + ' (' + g.backlinks + ' links), not to you', source_url: '', target_url: (p.assets[0] || {}).url || '' }))];
  return { json: { ...p, competitors, summary, lost, important_lost, new_links: news, spammy, reclaim, refdomains: [...refdomains].slice(0, 500), timeseries: ts, mentions, gap, gap_stored: gi < 0 && gap.length > 0, gap_checked: gi < 0 ? ((p.stored_gap || [])[0] || {}).last_seen || '' : p.checked_at.slice(0, 10), alerts, deliver, disavow_text, candidates, gap_error: G && !G.ok ? G.error : null, cost_usd: +cost.toFixed(4) } };
});
