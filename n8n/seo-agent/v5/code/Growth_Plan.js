// AI Growth plan (v4.12, AI_GROWTH_SPEC.md; weekly, Monday 09:30 after the AI Visibility Tracker and the Site Tracker, and on demand): the work that
// gets a site named and cited in AI answers, not only measured. Per site with AI visibility and the growth loop on:
//   * key pages to check this week (can an assistant read and quote them: the AI Readiness step) — pages AI cited, the targets' pages, written and
//     ladder pages, the pages Search Console shows most, the homepage; each page about once a month, never-checked ones first;
//   * pages to send to Bing (the index Bing and Microsoft Copilot answer from) and to notify through IndexNow (Bing, Yandex, Naver, Seznam, Yep, Amazon — not
//     Google): new or updated pages, and key pages Bing has not crawled — plus (B9-2) the pages submitted in earlier runs whose outcome nobody ever looked up;
//   * the questions to win (seo_ai_targets): every lost question of the latest AI visibility run becomes a target — a new answer page, or a
//     refresh of the page the site already has for it — which the Content Cadence writes (ai_pages_month, default 2);
//   * the earned-media list: the exact third-party pages AI cited in answers that did not name the business (articles, lists, reviews, threads),
//     fetched next to see whether they name the business or its competitors (the strongest lever on AI mentions: earned media);
//   * the monthly entity check (Wikidata).
// B-G2 (2026-10-15, FIX_PLAN §3.16; INVARIANTS rule 2): the stored ladder rungs reached this plan with no gate, so a rung that is a
// competitor's brand or a government portal became a "question to win" and then a page the Content Cadence writes. The same shared
// read-path gate R16 built now runs here (FITR, _fit_gate.js) before any rung is read for a target, a key page or a submission.
/*__MONITOR_SITES__*/
/*__SITE_MODEL__*/
/*__FIT_GATE__*/
const CONFIG = { audit_per_week: 12, recheck_days: 25, max_key_pages: 40, submit_max: 50, resubmit_days: 30, recent_days: 8, earned_fetch: 10, max_targets: 6, refresh_after_days: 90,
  win_min_answers: 2, follow_up_days: 45, follow_up_max: 15, decay_runs: 3, stale_writing_days: 14,   // B9-2 / B9-4 / B9-5 / B9-6 (benchmark area 9): what became of a submission, what a win needs, a page AI has stopped citing, and a page run that never produced a page
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
  const visMine = vis.filter(x => x.site_id === s.site_id).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)));
  const v = visMine[0] || null;
  // B9-4 (2026-10-15, benchmark area 9): a win used to be "the question is not in the latest run's gap list" — one observation, and
  // brand lists come back the same less than 1% of the time (SparkToro, in CRITERIA 4A). The answers of the last 8 days (the weekly
  // run AND the daily pulse write them) are what a win is measured on: how many answers named the business, out of how many answered.
  const myAns = answers.filter(a => a.site_id === s.site_id);
  const obsOf = (pid) => { const rows = myAns.filter(a => String(a.prompt_id || '') === String(pid || '') && (a.answered === true || a.answered === 'true'));
    const named = rows.filter(a => a.mentioned === true || a.mentioned === 'true');
    return { answers: rows.length, named: named.length, engines: [...new Set(rows.map(a => a.engine))], named_engines: [...new Set(named.map(a => a.engine))],
      last: rows.reduce((m, a) => String(a.checked_at || '') > m ? String(a.checked_at || '') : m, '') }; };
  const obsLine = (o) => o.answers ? 'named in ' + o.named + ' of ' + o.answers + ' answers in the last 8 days' + (o.named_engines.length ? ' (' + o.named_engines.join(', ') + ')' : '') : 'not asked in the last 8 days';
  // B9-5: a page AI used to cite and has stopped citing is the best refresh there is — measured from our own stored weekly runs.
  const citedRuns = visMine.slice(0, 6).map(r => ({ at: r.checked_at, set: new Set((parse(r.pages_json, []) || []).map(x => keyOf(x && (x.url || x.u) || ''))) }));
  const decayOf = (url) => { const k = keyOf(url); if (citedRuns.length < CONFIG.decay_runs || !k) return null;
    const hit = citedRuns.map(r => r.set.has(k)); if (hit[0] || hit[1]) return null;   // still cited in one of the last two checks: nothing to say
    const earlier = hit.slice(2).filter(Boolean).length; if (earlier < 2) return null;
    const last = citedRuns.slice(2).find(r => r.set.has(k));
    return { runs: citedRuns.length, cited_in: earlier, missed: 2, last_cited: last ? String(last.at || '').slice(0, 10) : '' }; };
  const gaps = v ? parse(v.gaps_json, []) : []; const cited = v ? parse(v.pages_json, []) : []; const compRows = v ? parse(v.competitors_json, []) : [];
  const comps = [...new Set([...s.settings.competitors, ...compRows.filter(c => c && /\./.test(c.domain || '')).map(c => c.domain)])];
  const myPrompts = prompts.filter(p => p.site_id === s.site_id); const promptOf = new Map(myPrompts.map(p => [p.prompt_id, p]));
  const slog = logs.filter(l => normD(l.domain) === dom); const lrowsAll = ladders.filter(l => normD(l.domain) === dom);
  // B-G2: the read-path gate, before a rung can become a key page, a target's page or the ladder page a question is handed to.
  const fitCtx = FITR.ctx({ own_domain: dom, competitors: comps, heads: lrowsAll.map(l => l.head_keyword), services: SM.services(site_model) });
  const fitG = FITR.rungs(lrowsAll, fitCtx, { where: 'AI growth targets' });
  const lrows = fitG.keep; const set_aside = fitG.set_aside;
  // keyword-first R-K4 (2026-10-19, SCHEDULING_KEYWORDS_PLAN.md §5.1): the target's OWN keyword passes the gate too, not only the rungs it may be
  // handed to. On 2026-10-19 a CRM-only site (no ladder, no Dynamics 365 among its services) got the AI refresh target "dynamics 365 finance
  // operations partner uae", and the Content Cadence wrote it. The topics are what the client chose and sells: the ladder heads, the rungs the
  // gate kept and the site model's services (the client's declared services included); a refused target is stored `set_aside` with its reason.
  // the services from the stored model AND from the site row itself: a site the weekly Site Tracker has not modelled yet has no stored model,
  // but its row already carries what the client declared (declared_services) and any services read so far
  const targetSvc = [...new Set([...SM.services(site_model), ...SM.services(SM.from(s, {}))].map(x => String(x || '').trim()).filter(Boolean))];
  const targetCtx = FITR.ctx({ own_domain: dom, competitors: comps, heads: lrowsAll.map(l => l.head_keyword), services: targetSvc,
    topics: [...new Set([...lrowsAll.map(l => String(l.head_keyword || '')), ...lrows.map(l => String(l.keyword || '')), ...targetSvc].map(x => String(x || '').trim()).filter(Boolean))],
    topic_label: 'what this website sells and the keywords you chose' });
  const targets_set_aside = [];
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
  const logByReq = new Map(slog.filter(l => l.request_id).map(l => [String(l.request_id), l]));   // B9-6: the run a target claims to be written by
  const targets = []; const won_lost = []; const won_now = []; const stalled_targets = [];   // B9-4: what was won this run, with its evidence, and what was won before and is lost again
  for (const g of gaps.filter(g => g && g.prompt && g.kind !== 'brand').slice(0, 10)) {
    const p0 = promptOf.get(g.prompt_id || '') || myPrompts.find(x => String(x.prompt || '').trim() === String(g.prompt).trim()) || {}; const pid = g.prompt_id || p0.prompt_id || qid(g.prompt); const keyword = String(p0.keyword || g.topic || '').toLowerCase().trim() || toks(g.prompt).slice(0, 5).join(' ');
    const target_id = 'ait_' + s.site_id.replace(/^site_/, '') + '_' + pid; const old = existing.get(target_id) || {};
    const tg = fitGate(keyword, targetCtx);   // R-K4: judged before it may claim a page, so a refused question never takes another one's refresh
    const page = pageFor(keyword, g.prompt, pid); if (page && (tg.ok || ['writing', 'written'].includes(old.status))) usedPages.add(keyOf(page.url)); const pr = page ? stored.get(keyOf(page.url)) : null;
    // a planned keyword-ladder page for the same search: the Content Cadence writes it with this AI target (one search, one page)
    const hw = new Set(lrows.flatMap(l => String(l.head_keyword || '').toLowerCase().split(/[^a-z0-9]+/)).filter(Boolean)); const kt = (k) => [...new Set(toks(k).filter(w => !hw.has(w)))];
    const same = (a, b) => { const A = kt(a), B = new Set(kt(b)); return A.length > 0 && A.filter(w => B.has(w)).length / A.length >= 0.6; };
    const ladderPage = !page ? lrows.find(l => !['published'].includes(String(l.status)) && (same(keyword, l.keyword) || same(l.keyword, keyword))) : null;
    const stale = !pr || !pr.updated_on || days(pr.updated_on) > CONFIG.refresh_after_days; const weak = !pr || (Number(pr.score) || 0) < 70;
    const kind = page ? 'refresh' : 'answer';
    const engines = Object.entries(g.engines || {}).filter(([, st]) => st === 'absent').map(([e]) => e);
    const vol = Number(g.volume) || 0; const value = Math.round(100 * (1 + Math.log10(1 + vol) / 2) * (CONFIG.stage_weight[g.stage] || 0.7) * (1 + Math.min(4, (g.competitors || []).length) / 4) * (1 + engines.length / 7)) / 100;
    const PT = { compare: 'Comparison Page', recommend: 'Guide', choose: 'Guide', cost: 'Guide', problem: 'Guide' };
    // B9-4: this question is LOST — so a row that says 'won' is out of date, whatever it said last week. It goes back in the queue
    // with the date it was won and the date it was lost again, and the report raises it; nothing stays won because it once was.
    const wasWon = old.status === 'won';
    // B9-6 (INVARIANTS rules 2 and 4): the Content Cadence marks a target `writing` and stamps written_at when it STARTS a page
    // run, and nothing writes the row back if that run is refused or fails — so a question could sit "being written" for ever and
    // never be queued again. The read path checks the evidence: a content-log row for the same run that really says written or
    // published. Without one, after two weeks the question goes back in the queue and says why. (The write-side release belongs
    // to the cadence — registered as B9-6 for area 4.)
    // R111 (2026-10-16): a run that left a draft which failed its quality check is not stalled (nothing would be gained by writing the
    // question again from nothing) and it is not written either — the row stays `writing` and says the draft needs a fix
    const draftFailed = old.status === 'writing' && String((logByReq.get(String(old.request_id || '')) || {}).status || '') === 'not_ready';
    const stalled = (() => { if (old.status !== 'writing' || draftFailed) return null;
      const l = logByReq.get(String(old.request_id || ''));
      if (l && ['written', 'published'].includes(String(l.status))) return null;
      const since = old.written_at || old.updated_at || '';
      if (days(since) < CONFIG.stale_writing_days) return null;
      return { since: String(since).slice(0, 10), log: l ? 'the page run is still "' + l.status + '"' : 'no page run on record' }; })();
    const status0 = wasWon ? 'queued' : stalled ? 'queued' : ['writing', 'written'].includes(old.status) ? old.status : (kind === 'refresh' && !stale && !weak) ? 'skipped' : (old.status === 'skipped' && old.reason === 'kept by you') ? 'skipped' : 'queued';
    // R-K4: a target whose keyword this website should not target is never queued for a page. A row already being written (or written) keeps
    // its state - that page is live work - and is flagged, the same rule fitStored applies to a stored rung.
    const tLive = ['writing', 'written'].includes(status0);
    const status = !tg.ok && !tLive ? 'set_aside' : status0;
    const gateNote = tg.ok ? '' : 'not a search this website should target: ' + tg.detail + ' (' + tg.reason + ')' + (tLive ? '; its page is already being written, so it is kept and flagged' : '; set aside, so no page is written for it') + '. ';
    if (!tg.ok) targets_set_aside.push({ target_id, question: g.prompt, keyword, kind, reason: tg.reason, detail: tg.detail, kept: tLive, note: '"' + keyword + '" ' + gateNote.trim() });
    if (stalled) stalled_targets.push({ target_id, question: g.prompt, since: stalled.since, detail: stalled.log });
    const lostAgain = wasWon ? { target_id, question: g.prompt, won_at: String(old.won_at || '').slice(0, 10), lost_at: String((v && v.checked_at) || iso).slice(0, 10), observed: obsLine(obsOf(pid)) } : null;
    if (lostAgain) won_lost.push(lostAgain);
    targets.push({ target_id, site_id: s.site_id, domain: dom, prompt_id: pid, question: g.prompt, keyword, kind, page_url: page ? page.url : '', page_type: kind === 'refresh' ? '' : (PT[g.kind] || 'Guide'),
      fanout: (g.fanout || []).slice(0, 8).join(' | '), sources_json: JSON.stringify((g.cited_urls || []).slice(0, 6).map(c => ({ u: c.u, t: c.t || '', n: c.n || 1 }))), competitors: (g.competitors || []).slice(0, 8).join(', '),
      engines: engines.join(', '), stage: g.stage || '', value, status,
      reason: gateNote + (draftFailed ? 'the page written for this question did not pass the quality check: fix the draft and run it again (it is not offered as a page that answers the question until it passes). ' : '') + (stalled ? 'the page run started on ' + stalled.since + ' never produced a page (' + stalled.log + '): queued again. ' : '') + (lostAgain ? 'AI named you for this question and has stopped (won ' + (lostAgain.won_at || 'earlier') + ', lost again in the check of ' + lostAgain.lost_at + '; ' + lostAgain.observed + '). ' : '') + (ladderPage ? 'written as the keyword ladder page "' + ladderPage.keyword + '" (one search, one page)' : status === 'skipped' && kind === 'refresh' ? 'the page is fresh (updated ' + String(pr && pr.updated_on || '').slice(0, 10) + ') and AI-ready (' + (pr && pr.score) + '/100)' : page ? 'refresh ' + page.url + ' (' + page.how + (stale ? '; not updated in 90+ days' : '') + (weak ? '; AI-readiness ' + (pr ? pr.score + '/100' : 'not checked yet') : '') + ')' : 'no page answers it yet'),
      created_at: old.created_at || iso, updated_at: iso, request_id: old.request_id || '', written_at: old.written_at || '', won_at: old.won_at || '' });
    if (page) addPage(page.url, 'target', 'answers "' + g.prompt.slice(0, 80) + '"', { question: g.prompt });
  }
  // targets no longer lost: won (if written) or no longer needed
  const lostIds = new Set(targets.map(t => t.target_id));
  for (const [id, t] of existing) if (!lostIds.has(id) && !['won', 'skipped', 'set_aside'].includes(t.status) && v) {
    // B9-4: absent from the gap list is not the same as named. It can also mean the question was not asked this run (the panel
    // rotates, a request can fail), so the answers of the window decide: at least win_min_answers of them must name the business.
    const o = obsOf(t.prompt_id || ''); const written = ['writing', 'written'].includes(t.status);
    const won = written && o.named >= CONFIG.win_min_answers;
    const keep = !won && (written || o.answers === 0);   // still being written, or nothing was asked: the row waits rather than lying either way
    const why = won ? 'AI names you for this question: ' + obsLine(o) : o.answers === 0 ? 'not asked in the last 8 days: nothing to judge a win on (kept)'
      : written ? obsLine(o) + ' — too few to call it won (at least ' + CONFIG.win_min_answers + ' needed)' : 'no longer lost in the latest AI check';
    targets.push({ target_id: id, site_id: s.site_id, domain: dom, prompt_id: t.prompt_id || '', question: t.question || '', keyword: t.keyword || '', kind: t.kind || 'answer', page_url: t.page_url || '', page_type: t.page_type || '', fanout: t.fanout || '', sources_json: t.sources_json || '[]',
      competitors: t.competitors || '', engines: t.engines || '', stage: t.stage || '', value: Number(t.value) || 0, status: won ? 'won' : keep ? t.status : 'skipped', reason: why,
      created_at: t.created_at || iso, updated_at: iso, request_id: t.request_id || '', written_at: t.written_at || '', won_at: won ? iso : (t.won_at || '') });
    if (won) won_now.push({ target_id: id, question: t.question || '', observed: obsLine(o) }); }
  const queued = targets.filter(t => t.status === 'queued').sort((a, b) => b.value - a.value);
  queued.slice(CONFIG.max_targets).forEach(t => { t.status = 'skipped'; t.reason = 'lower value than the ' + CONFIG.max_targets + ' queued questions (checked again next week)'; });
  // ---- pages to audit this week (rotating) ----
  const keyPages = [...key.values()].slice(0, CONFIG.max_key_pages);
  const rank = { cited: 0, target: 1, content: 2, ladder: 3, search: 4, home: 5 };
  const audit = keyPages.filter(p => { const st = stored.get(keyOf(p.url)); return !st || days(st.checked_at) >= CONFIG.recheck_days || on_demand; })
    .sort((a, b) => (stored.has(keyOf(a.url)) ? 1 : 0) - (stored.has(keyOf(b.url)) ? 1 : 0) || rank[a.kind] - rank[b.kind]).slice(0, CONFIG.audit_per_week);
  for (const kp of key.values()) { const d = decayOf(kp.url); if (d) kp.decay = d; }   // B9-5
  // B9-2 (INVARIANTS rule 4): a page SENT to Bing is not a page Bing has crawled, and nothing ever went back to look. Every page
  // submitted in the last 45 days that Bing has not crawled is asked about again (GetUrlInfo, free) so the run can report what
  // became of the submissions instead of counting them as work done.
  const follow_up = [...stored.values()].filter(st => st.submitted_at && days(st.submitted_at) <= CONFIG.follow_up_days && !st.bing_crawled_at)
    .filter(st => !audit.some(a => keyOf(a.url) === keyOf(st.url)))
    .sort((a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at))).slice(0, CONFIG.follow_up_max)
    .map(st => ({ url: normU(st.url), submitted_at: st.submitted_at, submitted_via: st.submitted_via || '', days: Math.round(days(st.submitted_at)) }));
  // ---- pages to submit (Bing / IndexNow): new or updated, and key pages Bing has not crawled ----
  const submit = new Map(); const addSub = (u, why) => { if (!ours(u)) return; const k = keyOf(u), x = normU(u); if (k && x && ![...submit.keys()].some(y => keyOf(y) === k)) submit.set(x, why); };   // one entry per page (www / slash variants)
  for (const l of slog.filter(l => l.published_url && days(l.published_at) <= CONFIG.recent_days)) addSub(l.published_url, 'published this week');
  for (const st of stored.values()) { if (st.updated_on && days(st.updated_on) <= CONFIG.recent_days && (!st.submitted_at || st.submitted_at < st.updated_on)) addSub(st.url, 'updated this week');
    else if (Number(st.bing_status) === 0 && st.checked_at && !st.bing_crawled_at && days(st.submitted_at) > CONFIG.resubmit_days) addSub(st.url, 'Bing has not crawled it'); }
  for (const p of keyPages) if (!stored.has(keyOf(p.url))) addSub(p.url, 'key page, first submission');
  // ---- the earned-media list: exact pages AI cited in answers that did not name the business (last 8 days, weekly + daily) ----
  const em = new Map();
  // C-3 (re-rating 2026-10-17): the count is "answers that cited this page" over the answers stored in the last 8 days - weekly runs AND
  // the daily pulse (670 rows on 2026-10-17) - and the report now says exactly that (earned_basis). It used to say "the answers of the last
  // weekly AI-visibility run", against which mof.gov.ae's 93 next to that run's 18 looked like a per-site total; and a page cited twice
  // in one answer counts once.
  const earnAns = answers.filter(a => a.site_id === s.site_id && (a.answered === true || a.answered === 'true') && !(a.mentioned === true || a.mentioned === 'true') && a.kind !== 'brand');
  const atsE = earnAns.map(a => String(a.checked_at || '')).filter(Boolean).sort();
  const earned_basis = { answers: earnAns.length, from: (atsE[0] || '').slice(0, 10), to: (atsE[atsE.length - 1] || '').slice(0, 10), days: 8,
    runs: new Set(earnAns.map(a => String(a.run_id || ''))).size, pulse: earnAns.filter(a => /pulse/i.test(String(a.run_kind || a.run_id || ''))).length };
  for (const a of earnAns) {
    const seenU = new Set();
    // G22 (2026-10-11 system review): a source chip sometimes carries only a fragment of the title ("E", "Best e" live). A title that
    // short is treated as missing, so Earned Media reads the page's own <title> from the copy it fetches anyway; a real title is kept whole.
    for (const c of parse(a.cited_urls, [])) { if (!c || !c.u || ours(c.u) || seenU.has(c.u)) continue; seenU.add(c.u); const h = hostOf(c.u); const t0 = String(c.t || '').replace(/\s+/g, ' ').trim(); const t = t0.length >= 8 ? t0 : '';
      const x = em.get(c.u) || { url: c.u, title: t, host: h, n: 0, engines: new Set(), questions: new Set() }; x.n++; x.engines.add(a.engine); x.questions.add(a.prompt); if (!x.title && t) x.title = t; em.set(c.u, x); }
  }
  const perHost = new Map();
  const earned = [...em.values()].map(x => ({ url: x.url, title: x.title, host: x.host, citations: x.n, engines: [...x.engines], questions: [...x.questions].slice(0, 3), kind: kindOf(x.host, x.title, x.url, comps) }))
    .sort((a, b) => b.citations * (1 + b.engines.length) - a.citations * (1 + a.engines.length))
    .filter((e, i, all) => !e.title || all.findIndex(x => x.host === e.host && x.title === e.title) === i)   // the same article under two addresses (tracking parameters) once
    .filter(e => { const k = perHost.get(e.host) || 0; perHost.set(e.host, k + 1); return k < 2; }).slice(0, 30);
  // ---- B9-7 (2026-10-17, benchmark area 9): a wrong claim AI makes about the business is a correction target ----
  // The Answer Analyst (AI Metrics) stores each wrong claim as "claim → what the facts on file say" in the answer rows' `issues`, and the
  // list of them in the visibility row's perception_json. A correction needs three things: the claim, the TRUE fact (which must be on file
  // — the analyst's "correct" half is only used when the profile, the services or the accreditation carry it; otherwise the target says
  // "needs your fact" and nothing is drafted), and the pages that carry the claim (the third-party pages cited in the answers that made it).
  // Nothing here is sent; the Earned Media step drafts through the one outreach writer, or hands the page to the Link Builder.
  const perc = v ? parse(v.perception_json, null) : null;
  const factsText = [...Object.values(s.profile || {}), ...(SM.services(site_model) || []), String(SM.facts(site_model).accreditation || ''), JSON.stringify(SM.facts(site_model) || {})].map(x => String(x == null ? '' : x)).join(' ').toLowerCase();
  const wordsOf = (t) => [...new Set((String(t || '').toLowerCase().match(/[a-z0-9]{3,}/g) || []).filter(w => !['the', 'and', 'for', 'with', 'are', 'was', 'not', 'has', 'its', 'that', 'this', 'from', 'than'].includes(w)))];
  const factOnFile = (fact) => { const ws = wordsOf(fact); if (!ws.length) return false; const hit = ws.filter(w => factsText.includes(w)); const digits = ws.filter(w => /\d/.test(w));
    return digits.every(w => factsText.includes(w)) && hit.length / ws.length >= 0.6; };
  const rivalDomains = (() => { const r = v ? parse(v.rival_sources_json, []) : []; return (Array.isArray(r) ? r : []).map(x => String((x && x.domain) || x || '').toLowerCase().replace(/^www\./, '')).filter(d => /\./.test(d)); })();   // R83 leftover: the businesses AI names instead of you, as the AI visibility run stored them
  const corrections = [];
  if (perc && perc.fact_check === 'checked') for (const it of (perc.issues || []).slice(0, 6)) {
    const text = String(it.text || ''); const cut = text.indexOf(' → '); const claim = (cut >= 0 ? text.slice(0, cut) : text).trim(); const trueFact = cut >= 0 ? text.slice(cut + 3).trim() : '';
    if (!claim) continue;
    const key = claim.toLowerCase().slice(0, 40);
    const pagesMap = new Map();
    for (const a of answers.filter(a => a.site_id === s.site_id && String(a.issues || '').toLowerCase().includes(key)))
      for (const c of parse(a.cited_urls, [])) { if (!c || !c.u || ours(c.u)) continue; const h = hostOf(c.u); if (GOV.test(h) || rivalDomains.some(d => h === d || h.endsWith('.' + d)) || comps.some(d => h === d || h.endsWith('.' + d))) continue;
        const x = pagesMap.get(c.u) || { url: c.u, host: h, title: String(c.t || '').slice(0, 140), citations: 0 }; x.citations++; pagesMap.set(c.u, x); }
    const onFile = !!trueFact && factOnFile(trueFact);
    corrections.push({ claim: claim.slice(0, 200), true_fact: onFile ? trueFact.slice(0, 200) : '', fact_on_file: onFile, engines: it.engines || [], questions: it.questions || [], is_new: !!it.new,
      pages: [...pagesMap.values()].sort((a, b) => b.citations - a.citations).slice(0, 3),
      status: onFile ? 'ready' : 'needs_fact', note: onFile ? '' : 'needs your fact: the profile does not carry the correct answer to this claim' + (trueFact ? ' (the analyst suggested "' + trueFact.slice(0, 80) + '", which nothing on file confirms)' : '') + ' - add it to the business profile; nothing is drafted until then' });
  }
  const correction_fetch = [...new Set(corrections.filter(c => c.fact_on_file).flatMap(c => c.pages.map(pg => pg.url)))].slice(0, 4);
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
    // B-G2: what the gate refused, with its reason, so the report names it instead of printing a shorter list (INVARIANTS rule 1)
    set_aside, set_aside_note: [FITR.line(set_aside, 'turned into a question to win or a page to write'),
      targets_set_aside.filter(x => !x.kept).length ? targets_set_aside.filter(x => !x.kept).length + ' question(s) to win were set aside, so no page is written for them: ' + targets_set_aside.filter(x => !x.kept).slice(0, 6).map(x => '"' + x.keyword + '" (' + x.reason + ': ' + x.detail + ')').join('; ') + '.' : ''].filter(Boolean).join(' '),
    targets_set_aside,   // R-K4: the questions to win whose own keyword the gate refused, with the reason (stored `set_aside`, never written)
    brand_names, competitors: comps.slice(0, 12), ai_pages_month: s.settings.ai_pages_month, run_id: 'grow_' + iso.slice(0, 10).replace(/-/g, '') + '_' + s.site_id.replace(/^site_/, ''), checked_at: iso,
    vis_checked_at: v ? v.checked_at : '', win_min_answers: CONFIG.win_min_answers, won_lost, won_now, stalled_targets, follow_up, follow_up_days: CONFIG.follow_up_days,
    topics: [...new Set(lrowsAll.map(l => String(l.head_keyword || '')).filter(Boolean))].slice(0, 20),   // C-2: the categories RV.providerOf judges a cited site against
    key_pages: keyPages, audit, submit: [...submit.entries()].slice(0, CONFIG.submit_max).map(([url, why]) => ({ url, why })), targets, earned, earned_basis, earned_fetch: [...new Set([...earned.filter(e => e.kind !== 'competitor').slice(0, CONFIG.earned_fetch).map(e => e.url), ...correction_fetch])], corrections, rival_sources: rivalDomains,
    indexnow_key, indexnow_new: !kRow, indexnow_verified_at: kv.verified_at || '', entity_due, previous_entity: prevEntity, previous: prevG ? { checked_at: prevG.checked_at, avg_score: Number(prevG.avg_score) || null, earned: parse(prevG.earned_json, []) } : null,
    stored_pages: [...stored.values()].map(p => ({ url: normU(p.url), key: keyOf(p.url), score: Number(p.score) || 0, checked_at: p.checked_at, updated_on: p.updated_on, submitted_at: p.submitted_at, submitted_via: p.submitted_via, bing_crawled_at: p.bing_crawled_at, bing_status: Number(p.bing_status) || 0, kind: p.kind })) } });
}
return out.length ? out : [{ json: { nothing_to_do: true, reason: 'no site to work on' } }];
