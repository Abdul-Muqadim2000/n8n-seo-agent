// AI Growth plan (v4.12, AI_GROWTH_SPEC.md; weekly, Monday 09:30 after the AI Visibility Tracker and the Site Tracker, and on demand): the work that
// gets a site named and cited in AI answers, not only measured. Per site with AI visibility and the growth loop on:
//   * key pages to check this week (can an assistant read and quote them: the AI Readiness step) — pages AI cited, the targets' pages, written and
//     ladder pages, the pages Search Console shows most, the homepage; each page about once a month, never-checked ones first;
//   * pages to send to Bing (ChatGPT search, Copilot) and IndexNow (Bing, Yandex, Naver, Seznam …): new or updated pages, and key pages Bing has not crawled;
//   * the questions to win (seo_ai_targets): every lost question of the latest AI visibility run becomes a target — a new answer page, or a
//     refresh of the page the site already has for it — which the Content Cadence writes (ai_pages_month, default 2);
//   * the earned-media list: the exact third-party pages AI cited in answers that did not name the business (articles, lists, reviews, threads),
//     fetched next to see whether they name the business or its competitors (the strongest lever on AI mentions: earned media);
//   * the monthly entity check (Wikidata).
/*__MONITOR_SITES__*/
/*__SITE_MODEL__*/
const CONFIG = { audit_per_week: 12, recheck_days: 25, max_key_pages: 40, submit_max: 50, resubmit_days: 30, recent_days: 8, earned_fetch: 10, max_targets: 6, refresh_after_days: 90,
  stage_weight: { decision: 1, consideration: 0.8, awareness: 0.6 } };
const { list, on_demand, want, total } = monitorSites('ai');
const sites = on_demand ? list : list.filter(s => s.settings.ai_visibility && s.settings.growth);
if (!sites.length) return [{ json: { nothing_to_do: true, reason: on_demand ? 'no site matches "' + want + '"' : (total ? 'the AI growth loop is off for every site' : 'no sites yet') } }];
const vis = rowsOf('Load AI Visibility'), answers = rowsOf('Load AI Answers'), prompts = rowsOf('Load AI Prompts'), logs = rowsOf('Load Content Log'), qh = rowsOf('Load Query History'),
  pagesStored = rowsOf('Load AI Pages'), targetsStored = rowsOf('Load AI Targets'), growthRows = rowsOf('Load AI Growth'), cache = rowsOf('Load Cache (Growth)'), ladders = rowsOf('Load Ladders');
const now = new Date(); const iso = now.toISOString(); const month = iso.slice(0, 7);
const parse = (t, d) => { try { const v = JSON.parse(t || ''); return v == null ? d : v; } catch (e) { return d; } };
const days = (d) => d ? (now - new Date(d)) / 864e5 : Infinity;
const hostOf = (u) => { const m = String(u || '').match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };
const keyOf = (u) => { const m = String(u || '').trim().match(/^https?:\/\/(?:www\.)?([^\/?#]+)([^?#]*)/i); if (!m) return ''; const path = (m[2] || '/').replace(/\/+$/, '') || '/'; return m[1].toLowerCase() + path; };   // host-agnostic (www or not)
const pathOfU = (u) => { const m = String(u || '').trim().match(/^https?:\/\/[^\/?#]+([^?#]*)/i); return m ? (m[1] || '/') : ''; };   // as the site writes it (trailing slash kept: Bing / IndexNow get the real address)
const toks = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length > 2 && !['the', 'and', 'for', 'with', 'what', 'how', 'which', 'are', 'can', 'does', 'your', 'you', 'that', 'this', 'from', 'into', 'best'].includes(w));
const overlap = (a, b) => { const A = new Set(toks(a)), B = new Set(toks(b)); if (!A.size || !B.size) return 0; let k = 0; for (const x of A) if (B.has(x)) k++; return k / A.size; };   // share of the target keyword's words found in the other text
const hex = (len) => { let s = ''; while (s.length < len) s += Math.floor(Math.random() * 16).toString(16); return s; };
const qid = (q) => { let h = 5381; for (const ch of String(q || '').toLowerCase().replace(/\s+/g, ' ').trim()) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0; return 'q' + h.toString(36); };   // a stable id for a question stored without one (runs before v4.12)
const GOV = /(^|\.)(gov|gob|gouv|govt|mil)(\.[a-z]{2})?$|(^|\.)gov\.[a-z]{2}$|(^|\.)europa\.eu$|(^|\.)(un|who|oecd|worldbank|imf)\.org$/i;
const REVIEW = /(^|\.)(g2\.com|capterra\.[a-z.]+|clutch\.co|goodfirms\.co|trustpilot\.com|softwareadvice\.com|getapp\.com|trustradius\.com|sourceforge\.net|gartner\.com|yelp\.[a-z.]+|tripadvisor\.[a-z.]+|bayut\.com|designrush\.com|sortlist\.[a-z.]+|themanifest\.com|upcity\.com)$/i;
const FORUM = /(^|\.)(reddit\.com|quora\.com|stackexchange\.com|stackoverflow\.com|news\.ycombinator\.com)$|^(community|forum|forums|discuss)\./i;
const VIDEO = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com)$/i;
const SOCIAL = /(^|\.)(linkedin\.com|facebook\.com|x\.com|twitter\.com|instagram\.com|medium\.com)$/i;
const WIKI = /(^|\.)(wikipedia\.org|wikidata\.org)$/i;
const NEWS = /(^|\.)(reuters\.com|bloomberg\.com|forbes\.com|cnbc\.com|bbc\.co\.uk|ft\.com|wsj\.com|gulfnews\.com|khaleejtimes\.com|thenationalnews\.com|zawya\.com|arabianbusiness\.com|gulfbusiness\.com|techcrunch\.com|theverge\.com|businessinsider\.com|economictimes\.indiatimes\.com|livemint\.com)$/i;
const LISTY = /\b(best|top\s?\d+|\d+\s(best|top)|alternatives?|vs\.?|versus|compared?|comparison|leading|list of|providers? in|companies in|ranked|review(s|ed)?)\b/i;
const kindOf = (host, title, url, comps) => comps.some(c => host === c || host.endsWith('.' + c)) ? 'competitor' : WIKI.test(host) ? 'encyclopedia' : GOV.test(host) ? 'official' : FORUM.test(host) ? 'forum' : VIDEO.test(host) ? 'video'
  : SOCIAL.test(host) ? 'social' : REVIEW.test(host) ? 'review' : LISTY.test(title + ' ' + String(url).replace(/[-_\/]/g, ' ')) ? 'list' : (NEWS.test(host) || /\/(news|press)\//i.test(url)) ? 'news' : 'article';
const out = [];
for (const s of sites) {
  const dom = s.domain; const ours = (u) => { const h = hostOf(u); return h === dom || h.endsWith('.' + dom); };
  // D15: the host the site really serves (www or not) comes from the one site model (SITE_MODEL_SPEC.md), which resolved it from the homepage,
  // its canonical tag and the site's own live URLs. Bing and IndexNow refuse addresses on another host than the site's. With no model yet
  // (the weekly Site Tracker has not run for this site), the model is built here from the same live URLs the old vote used.
  const seen_hosts = [...qh.filter(q => q.site_id === s.site_id && q.page).map(q => q.page), ...logs.filter(l => normD(l.domain) === dom && l.published_url).map(l => l.published_url)].filter(u => ours(u));
  const site_model = SM.stored(s) || SM.from({ site_id: s.site_id, domain: dom }, { seen_hosts });
  const site_host = site_model.canonical_host || dom;
  const normU = (u) => { const k = keyOf(u); return k ? SM.siteUrl(site_model, pathOfU(u)) : ''; };
  const v = vis.filter(x => x.site_id === s.site_id).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0] || null;
  const gaps = v ? parse(v.gaps_json, []) : []; const cited = v ? parse(v.pages_json, []) : []; const compRows = v ? parse(v.competitors_json, []) : [];
  const comps = [...new Set([...s.settings.competitors, ...compRows.filter(c => c && /\./.test(c.domain || '')).map(c => c.domain)])];
  const myPrompts = prompts.filter(p => p.site_id === s.site_id); const promptOf = new Map(myPrompts.map(p => [p.prompt_id, p]));
  const slog = logs.filter(l => normD(l.domain) === dom); const lrows = ladders.filter(l => normD(l.domain) === dom);
  const sqAll = qh.filter(q => q.site_id === s.site_id && q.page); const lastPeriod = sqAll.reduce((m, q) => String(q.period_end || '') > m ? String(q.period_end || '') : m, '');
  const sq = sqAll.filter(q => String(q.period_end || '') === lastPeriod);   // the latest Search Console period only
  const stored = new Map(pagesStored.filter(p => p.site_id === s.site_id).map(p => [keyOf(p.url), p]));
  // ---- key pages ----
  const key = new Map();
  const addPage = (url, kind, why, extra = {}) => { if (!ours(url)) return; const k = keyOf(url), u = normU(url); if (!k) return; const x = key.get(k) || { url: u, kind, why, cited_by: [], questions: [] }; if (pathOfU(url) === '/' || pathOfU(url) === '') { x.kind = 'home'; x.why = 'homepage'; } if (extra.cited_by) x.cited_by = [...new Set([...x.cited_by, ...extra.cited_by])]; if (extra.question) x.questions = [...new Set([...x.questions, extra.question])].slice(0, 5); key.set(k, x); };
  for (const c of cited) addPage(c.url, 'cited', 'AI cites it', { cited_by: c.engines || [] });
  for (const l of slog.filter(l => l.published_url)) addPage(l.published_url, 'content', 'written by the agent: "' + l.keyword + '"');
  for (const l of lrows.filter(l => l.target_url && (l.status === 'published' || l.page_exists === true || l.page_exists === 'true'))) addPage(l.target_url, 'ladder', 'keyword ladder page: "' + l.keyword + '"');
  const byPage = new Map(); for (const q of sq) { const u = normU(q.page); if (!u) continue; const same = [...byPage.keys()].find(y => keyOf(y) === keyOf(u)) || u; byPage.set(same, (byPage.get(same) || 0) + (Number(q.impressions) || 0)); }
  [...byPage.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([u, imp]) => addPage(u, 'search', imp.toLocaleString('en-GB') + ' Google impressions'));
  addPage(SM.siteUrl(site_model, '/'), 'home', 'homepage');
  // ---- the questions to win (targets) ----
  const pageFor = (keyword, question, pid) => {
    const fromAi = cited.find(c => answers.some(a => a.site_id === s.site_id && a.prompt_id === pid && String(a.our_urls || '').includes(String(c.url || '').replace(/^https?:\/\/(www\.)?/, ''))));
    if (fromAi) return { url: normU(fromAi.url), how: 'AI cited it for this question' };
    let best = null; for (const [u, imp] of byPage) { if (usedPages.has(keyOf(u))) continue; const qs = sq.filter(q => keyOf(q.page) === keyOf(u)); const o = Math.max(0, ...qs.map(q => wcover(keyword, q.query))); if (o >= 0.7 && (!best || o * Math.log10(10 + imp) > best.s)) best = { url: u, s: o * Math.log10(10 + imp), how: 'ranks on Google for related searches' }; }
    if (best) return best;
    const lr = lrows.find(l => l.target_url && !usedPages.has(keyOf(l.target_url)) && (l.status === 'published' || l.page_exists === true || l.page_exists === 'true') && wcover(keyword, l.keyword) >= 0.6); if (lr) return { url: normU(lr.target_url), how: 'keyword ladder page' };
    const lg = slog.find(l => l.published_url && !usedPages.has(keyOf(l.published_url)) && wcover(keyword, l.keyword) >= 0.6); if (lg) return { url: normU(lg.published_url), how: 'page written earlier' };
    return null;
  };
  // the site's own topic words appear in most of its queries: weight each word by how rare it is (IDF), so a page matches a question by its distinctive words
  const qn = Math.max(1, sq.length); const df = new Map(); for (const q of sq) for (const w of new Set(toks(q.query))) df.set(w, (df.get(w) || 0) + 1);
  const wgt = (w) => Math.log(1 + qn / (1 + (df.get(w) || 0)));
  const wcover = (kw, text) => { const K = [...new Set(toks(kw))], T = new Set(toks(text)); if (!K.length) return 0; const tot = K.reduce((t, w) => t + wgt(w), 0); return tot ? K.filter(w => T.has(w)).reduce((t, w) => t + wgt(w), 0) / tot : 0; };
  const usedPages = new Set();   // one refresh per page: a page matched to a question is not offered for the next one
  const existing = new Map(targetsStored.filter(t => t.site_id === s.site_id).map(t => [t.target_id, t]));
  const targets = [];
  for (const g of gaps.filter(g => g && g.prompt && g.kind !== 'brand').slice(0, 10)) {
    const p0 = promptOf.get(g.prompt_id || '') || myPrompts.find(x => String(x.prompt || '').trim() === String(g.prompt).trim()) || {}; const pid = g.prompt_id || p0.prompt_id || qid(g.prompt); const keyword = String(p0.keyword || g.topic || '').toLowerCase().trim() || toks(g.prompt).slice(0, 5).join(' ');
    const target_id = 'ait_' + s.site_id.replace(/^site_/, '') + '_' + pid; const old = existing.get(target_id) || {};
    const page = pageFor(keyword, g.prompt, pid); if (page) usedPages.add(keyOf(page.url)); const pr = page ? stored.get(keyOf(page.url)) : null;
    // a planned keyword-ladder page for the same search: the Content Cadence writes it with this AI target (one search, one page)
    const hw = new Set(lrows.flatMap(l => String(l.head_keyword || '').toLowerCase().split(/[^a-z0-9]+/)).filter(Boolean)); const kt = (k) => [...new Set(toks(k).filter(w => !hw.has(w)))];
    const same = (a, b) => { const A = kt(a), B = new Set(kt(b)); return A.length > 0 && A.filter(w => B.has(w)).length / A.length >= 0.6; };
    const ladderPage = !page ? lrows.find(l => !['published'].includes(String(l.status)) && (same(keyword, l.keyword) || same(l.keyword, keyword))) : null;
    const stale = !pr || !pr.updated_on || days(pr.updated_on) > CONFIG.refresh_after_days; const weak = !pr || (Number(pr.score) || 0) < 70;
    const kind = page ? 'refresh' : 'answer';
    const engines = Object.entries(g.engines || {}).filter(([, st]) => st === 'absent').map(([e]) => e);
    const vol = Number(g.volume) || 0; const value = Math.round(100 * (1 + Math.log10(1 + vol) / 2) * (CONFIG.stage_weight[g.stage] || 0.7) * (1 + Math.min(4, (g.competitors || []).length) / 4) * (1 + engines.length / 7)) / 100;
    const PT = { compare: 'Comparison Page', recommend: 'Guide', choose: 'Guide', cost: 'Guide', problem: 'Guide' };
    const status = ['writing', 'written', 'won'].includes(old.status) ? old.status : (kind === 'refresh' && !stale && !weak) ? 'skipped' : (old.status === 'skipped' && old.reason === 'kept by you') ? 'skipped' : 'queued';
    targets.push({ target_id, site_id: s.site_id, domain: dom, prompt_id: pid, question: g.prompt, keyword, kind, page_url: page ? page.url : '', page_type: kind === 'refresh' ? '' : (PT[g.kind] || 'Guide'),
      fanout: (g.fanout || []).slice(0, 8).join(' | '), sources_json: JSON.stringify((g.cited_urls || []).slice(0, 6).map(c => ({ u: c.u, t: c.t || '', n: c.n || 1 }))), competitors: (g.competitors || []).slice(0, 8).join(', '),
      engines: engines.join(', '), stage: g.stage || '', value, status,
      reason: ladderPage ? 'written as the keyword ladder page "' + ladderPage.keyword + '" (one search, one page)' : status === 'skipped' && kind === 'refresh' ? 'the page is fresh (updated ' + String(pr && pr.updated_on || '').slice(0, 10) + ') and AI-ready (' + (pr && pr.score) + '/100)' : page ? 'refresh ' + page.url + ' (' + page.how + (stale ? '; not updated in 90+ days' : '') + (weak ? '; AI-readiness ' + (pr ? pr.score + '/100' : 'not checked yet') : '') + ')' : 'no page answers it yet',
      created_at: old.created_at || iso, updated_at: iso, request_id: old.request_id || '', written_at: old.written_at || '', won_at: old.won_at || '' });
    if (page) addPage(page.url, 'target', 'answers "' + g.prompt.slice(0, 80) + '"', { question: g.prompt });
  }
  // targets no longer lost: won (if written) or no longer needed
  const lostIds = new Set(targets.map(t => t.target_id));
  for (const [id, t] of existing) if (!lostIds.has(id) && !['won', 'skipped'].includes(t.status) && v) { const won = ['writing', 'written'].includes(t.status);
    targets.push({ target_id: id, site_id: s.site_id, domain: dom, prompt_id: t.prompt_id || '', question: t.question || '', keyword: t.keyword || '', kind: t.kind || 'answer', page_url: t.page_url || '', page_type: t.page_type || '', fanout: t.fanout || '', sources_json: t.sources_json || '[]',
      competitors: t.competitors || '', engines: t.engines || '', stage: t.stage || '', value: Number(t.value) || 0, status: won ? 'won' : 'skipped', reason: won ? 'AI now names the business for this question' : 'no longer lost in the latest AI check',
      created_at: t.created_at || iso, updated_at: iso, request_id: t.request_id || '', written_at: t.written_at || '', won_at: won ? iso : (t.won_at || '') }); }
  const queued = targets.filter(t => t.status === 'queued').sort((a, b) => b.value - a.value);
  queued.slice(CONFIG.max_targets).forEach(t => { t.status = 'skipped'; t.reason = 'lower value than the ' + CONFIG.max_targets + ' queued questions (checked again next week)'; });
  // ---- pages to audit this week (rotating) ----
  const keyPages = [...key.values()].slice(0, CONFIG.max_key_pages);
  const rank = { cited: 0, target: 1, content: 2, ladder: 3, search: 4, home: 5 };
  const audit = keyPages.filter(p => { const st = stored.get(keyOf(p.url)); return !st || days(st.checked_at) >= CONFIG.recheck_days || on_demand; })
    .sort((a, b) => (stored.has(keyOf(a.url)) ? 1 : 0) - (stored.has(keyOf(b.url)) ? 1 : 0) || rank[a.kind] - rank[b.kind]).slice(0, CONFIG.audit_per_week);
  // ---- pages to submit (Bing / IndexNow): new or updated, and key pages Bing has not crawled ----
  const submit = new Map(); const addSub = (u, why) => { if (!ours(u)) return; const k = keyOf(u), x = normU(u); if (k && x && ![...submit.keys()].some(y => keyOf(y) === k)) submit.set(x, why); };   // one entry per page (www / slash variants)
  for (const l of slog.filter(l => l.published_url && days(l.published_at) <= CONFIG.recent_days)) addSub(l.published_url, 'published this week');
  for (const st of stored.values()) { if (st.updated_on && days(st.updated_on) <= CONFIG.recent_days && (!st.submitted_at || st.submitted_at < st.updated_on)) addSub(st.url, 'updated this week');
    else if (Number(st.bing_status) === 0 && st.checked_at && !st.bing_crawled_at && days(st.submitted_at) > CONFIG.resubmit_days) addSub(st.url, 'Bing has not crawled it'); }
  for (const p of keyPages) if (!stored.has(keyOf(p.url))) addSub(p.url, 'key page, first submission');
  // ---- the earned-media list: exact pages AI cited in answers that did not name the business (last 8 days, weekly + daily) ----
  const em = new Map();
  for (const a of answers.filter(a => a.site_id === s.site_id && (a.answered === true || a.answered === 'true') && !(a.mentioned === true || a.mentioned === 'true') && a.kind !== 'brand'))
    for (const c of parse(a.cited_urls, [])) { if (!c || !c.u || ours(c.u)) continue; const h = hostOf(c.u); const x = em.get(c.u) || { url: c.u, title: c.t || '', host: h, n: 0, engines: new Set(), questions: new Set() }; x.n++; x.engines.add(a.engine); x.questions.add(a.prompt); if (!x.title && c.t) x.title = c.t; em.set(c.u, x); }
  const perHost = new Map();
  const earned = [...em.values()].map(x => ({ url: x.url, title: x.title, host: x.host, citations: x.n, engines: [...x.engines], questions: [...x.questions].slice(0, 3), kind: kindOf(x.host, x.title, x.url, comps) }))
    .sort((a, b) => b.citations * (1 + b.engines.length) - a.citations * (1 + a.engines.length))
    .filter((e, i, all) => !e.title || all.findIndex(x => x.host === e.host && x.title === e.title) === i)   // the same article under two addresses (tracking parameters) once
    .filter(e => { const k = perHost.get(e.host) || 0; perHost.set(e.host, k + 1); return k < 2; }).slice(0, 30);
  // ---- IndexNow key (stored once per site; the owner hosts https://<domain>/<key>.txt) and the monthly entity check ----
  const kRow = cache.find(c => c.key === 'indexnow:' + s.site_id); const kv = kRow ? parse(kRow.value, {}) : {};
  const indexnow_key = (kv && /^[a-f0-9]{32}$/.test(kv.key || '')) ? kv.key : hex(32);
  const prevG = growthRows.filter(g => g.site_id === s.site_id).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0] || null;
  const prevEntity = prevG ? parse(prevG.entity_json, null) : null;
  const entity_due = on_demand || !prevEntity || String(prevEntity.checked_at || '').slice(0, 7) !== month;
  const label = dom.split('.')[0];
  const brand_names = [...new Set([dom, ...(s.settings.brand_names || []), ...(label.length >= 5 ? [label] : []), s.profile.business_name].map(x => String(x || '').trim()).filter(x => x.length >= 3))];
  // D12: the name a draft signs with comes from the one site model (profile -> homepage Organization / og:site_name -> what the app sent),
  // never from the domain label — the earned-media drafts signed "techand" / "techand.ai" (live 2026-10-11). `link_builder` decides who
  // writes: with it on, these prospects go to the Link Builder's qualification and writer (one writer).
  const modelName = SM.name(site_model);
  const business_name = String(s.profile.business_name || '').trim() || (modelName && SM.helpers.bare(modelName) !== dom ? modelName : '');
  out.push({ json: { site_id: s.site_id, domain: dom, site_host, country: s.country || '', email: s.email || '', callback_url: s.callback_url || '', request_id: s.request_id || '', on_demand, business_name, profile: s.profile,
    link_builder: !!s.settings.link_builder, services: SM.services(site_model), accreditation: SM.facts(site_model).accreditation,
    brand_names, competitors: comps.slice(0, 12), ai_pages_month: s.settings.ai_pages_month, run_id: 'grow_' + iso.slice(0, 10).replace(/-/g, '') + '_' + s.site_id.replace(/^site_/, ''), checked_at: iso,
    vis_checked_at: v ? v.checked_at : '', key_pages: keyPages, audit, submit: [...submit.entries()].slice(0, CONFIG.submit_max).map(([url, why]) => ({ url, why })), targets, earned, earned_fetch: earned.filter(e => e.kind !== 'competitor').slice(0, CONFIG.earned_fetch).map(e => e.url),
    indexnow_key, indexnow_new: !kRow, indexnow_verified_at: kv.verified_at || '', entity_due, previous_entity: prevEntity, previous: prevG ? { checked_at: prevG.checked_at, avg_score: Number(prevG.avg_score) || null, earned: parse(prevG.earned_json, []) } : null,
    stored_pages: [...stored.values()].map(p => ({ url: normU(p.url), key: keyOf(p.url), score: Number(p.score) || 0, checked_at: p.checked_at, updated_on: p.updated_on, submitted_at: p.submitted_at, submitted_via: p.submitted_via, bing_crawled_at: p.bing_crawled_at, bing_status: Number(p.bing_status) || 0, kind: p.kind })) } });
}
return out.length ? out : [{ json: { nothing_to_do: true, reason: 'no site to work on' } }];
