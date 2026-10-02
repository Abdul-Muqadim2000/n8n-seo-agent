const __scored = $('Build Site Issues').first();   // the scored audit (the input here is the last table load)
// Compares this audit with the site's previous one (seo_audits + seo_audit_findings): fixed, new and still-open findings (matched on category +
// title with numbers ignored) and the score change; and suggests internal links from the crawl (pages with few links in, orphan pages, pages with
// search impressions) from strong pages on the same topic. Adds audit_diff / internal_links to site_audit; audit_id identifies this audit.
const d = __scored.json; const a = d.site_audit || {};
const base = $('Check Crawl').first().json; const domain = base.domain; const site_id = 'site_' + String(domain).toLowerCase().replace(/[^a-z0-9]+/g, '-');
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error && r.site_id); } catch (e) { return []; } };
const audits = rowsOf('Load Audit History').filter(r => r.site_id === site_id).sort((x, y) => String(y.audited_at).localeCompare(String(x.audited_at)));
const prev = audits[0] || null;
const prevF = prev ? rowsOf('Load Audit Findings').filter(r => r.audit_id === prev.audit_id) : [];
const keyOf = (f) => String(f.category || '') + '|' + String(f.title || '').toLowerCase().replace(/\d[\d,.%]*/g, '#').replace(/["'“”‘’]/g, '').replace(/\s+/g, ' ').trim();
const cur = (a.findings || []).filter(f => f.scoring !== false && f.severity !== 'Info');
const curKeys = new Map(cur.map(f => [keyOf(f), f])); const prevKeys = new Map(prevF.map(f => [f.finding_key, f]));
const SEV = { Critical: 0, High: 1, Medium: 2, Low: 3, Info: 4 };
const fixed = [...prevKeys.entries()].filter(([k]) => !curKeys.has(k)).map(([, f]) => ({ title: f.title, category: f.category, severity: f.severity })).sort((x, y) => SEV[x.severity] - SEV[y.severity]);
const added = [...curKeys.entries()].filter(([k]) => prev && !prevKeys.has(k)).map(([, f]) => ({ title: f.title, category: f.category, severity: f.severity })).sort((x, y) => SEV[x.severity] - SEV[y.severity]);
const open = [...curKeys.entries()].filter(([k]) => prevKeys.has(k)).map(([k, f]) => { const p = prevKeys.get(k); return { title: f.title, category: f.category, severity: f.severity, was: p.severity, affected: f.affected_count ?? null, affected_before: Number(p.affected_count) || null }; }).sort((x, y) => SEV[x.severity] - SEV[y.severity]);
const audit_id = 'aud_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const audited_at = new Date().toISOString();
const days = prev ? Math.round((Date.now() - new Date(prev.audited_at).getTime()) / 864e5) : null;
const audit_diff = prev ? { baseline: false, previous: { audit_id: prev.audit_id, audited_at: prev.audited_at, health_score: Number(prev.health_score), grade: prev.grade, findings: Number(prev.findings) || prevF.length }, days_since: days,
  score_delta: (Number(a.health_score) || 0) - (Number(prev.health_score) || 0), fixed, new: added, open, summary: fixed.length + ' fixed · ' + added.length + ' new · ' + open.length + ' still open' } : { baseline: true, summary: 'First audit stored: the next one shows what was fixed, what is new and what is still open.' };
// ---- internal links: targets that need links, sources on the same topic that already carry authority ----
const pages = ($('Get Crawled Pages').first().json.tasks?.[0]?.result?.[0]?.items || []).filter(p => p && p.status_code === 200 && p.resource_type === 'html' && !(p.checks || {}).is_redirect && !/(\?|\/(tag|category|author|page)\/|\/feed\/?$)/i.test(p.url));
const norm = (u) => String(u || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
const STOP = new Set(['the', 'and', 'for', 'with', 'your', 'our', 'how', 'what', 'you', 'are', 'from', 'that', 'this', 'page', 'home', 'blog', 'www', 'com', 'html']);
const toks = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(t => t.length > 2 && !STOP.has(t));
const brandToks = new Set(toks(domain.split('.')[0]));
const titleOf = (p) => String(((p.meta || {}).htags || {}).h1?.[0] || (p.meta || {}).title || '').replace(/\s+[|–—-]\s+[^|–—]+$/, '').trim();
const topicOf = (p) => new Set([...toks(titleOf(p)), ...toks(String(p.url).replace(/^https?:\/\/[^\/]+/, ''))].filter(t => !brandToks.has(t)));
const inl = (p) => Number((p.meta || {}).inbound_links_count) || 0;
const sc = a.search_console || {}; const shown = new Map((sc.top_pages || []).map(x => [norm(x.page), Number(x.impressions) || 0]));
const targets = pages.filter(p => norm(p.url) !== norm('https://' + domain) && (inl(p) <= 2 || (p.checks || {}).is_orphan_page || (shown.get(norm(p.url)) || 0) >= 50 && inl(p) <= 5) && !/privacy|terms|cookie|legal|login|cart|checkout/i.test(p.url))
  .sort((x, y) => (shown.get(norm(y.url)) || 0) - (shown.get(norm(x.url)) || 0) || inl(x) - inl(y)).slice(0, 25);
const sources = pages.filter(p => inl(p) >= 3 || (Number(p.click_depth) || 9) <= 1);
const internal_links = [];
for (const t of targets) { const tt = topicOf(t); if (!tt.size) continue;
  const best = sources.filter(s => norm(s.url) !== norm(t.url)).map(s => ({ s, score: [...topicOf(s)].filter(x => tt.has(x)).length * 10 + Math.min(9, Math.floor(inl(s) / 5)) })).filter(x => x.score >= 10).sort((x, y) => y.score - x.score).slice(0, 2);
  for (const b of best) internal_links.push({ from_url: b.s.url, to_url: t.url, anchor: titleOf(t).slice(0, 70) || [...tt].slice(0, 4).join(' '), reason: ((t.checks || {}).is_orphan_page || inl(t) === 0 ? 'orphan page (no links in)' : inl(t) + ' internal link(s) in') + ((shown.get(norm(t.url)) || 0) ? '; ' + shown.get(norm(t.url)) + ' impressions in 28 days' : '') }); }
return [{ json: { ...d, audit_id, audited_at, site_id, site_audit: { ...a, audit_id, audited_at, audit_diff, internal_links: internal_links.slice(0, 20) } } }];
