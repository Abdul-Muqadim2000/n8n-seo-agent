// AI Growth per site (v4.12): what was done automatically this week (pages sent to Bing / IndexNow, key pages checked), the page readiness, the
// questions queued for an answer page or a refresh (the Content Cadence writes them), the earned-media list with drafts, the entity check, the
// actions ranked by value, alerts; plus the rows for seo_ai_pages, seo_ai_targets, seo_link_prospects, seo_ai_growth and seo_cache.
const plans = $('Growth Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const all = (n) => { try { return $(n).all().map(i => i.json); } catch (e) { return []; } };
const ready = all('AI Readiness').filter(x => !x.skip), earnedAll = all('Earned Media').filter(x => !x.skip);
const oIn = all('AI Outreach Input').filter(x => !x.skip), oOut = all('AI Outreach Writer');
const bSub = all('Bing Submit Requests').filter(x => !x.skip), bRes = all('Submit to Bing'), bReq = all('Bing Growth Requests').filter(x => !x.skip);
const kReq = all('IndexNow Key Requests').filter(x => !x.skip), kRes = all('Fetch IndexNow Key'), iReq = all('IndexNow Requests').filter(x => !x.skip), iRes = all('Submit IndexNow');
const eReq = all('Entity Requests').filter(x => !x.skip), eRes = all('Fetch Wikidata');
const BING = __BING_ENABLED__;
const jsonOf = (r) => { if (!r) return {}; if (r.d !== undefined || r.ErrorCode !== undefined || r.search || r.query) return r; const b = r.body ?? r.data; if (b && typeof b === 'object') return b; try { return JSON.parse(b || '{}'); } catch (e) { return {}; } };
const parseJ = (raw) => { if (raw && typeof raw === 'object') return raw; try { return JSON.parse(String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')); } catch (e) { return {}; } };
const keyOf = (u) => { const m = String(u || '').trim().match(/^https?:\/\/(?:www\.)?([^\/?#]+)([^?#]*)/i); if (!m) return ''; return m[1].toLowerCase() + ((m[2] || '/').replace(/\/+$/, '') || '/'); };
const J = (o) => JSON.stringify(o);
const out = [];
for (const p of plans) {
  const now = p.checked_at;
  // ---- submissions ----
  const bi = bSub.findIndex(x => x.site_id === p.site_id); const br = bi >= 0 ? jsonOf(bRes[bi]) : null;
  const bingOk = bi >= 0 && br && !br.ErrorCode && !br.Message && !(br.error);
  const inAccount = bReq.some(x => x.site_id === p.site_id);
  const bing = { enabled: BING, in_account: inAccount, submitted: bingOk ? bSub[bi].urls.length : 0, urls: bi >= 0 ? bSub[bi].urls : [], quota: bi >= 0 ? bSub[bi].quota : null, error: bi >= 0 && !bingOk ? String((br && (br.Message || (br.error && (br.error.message || br.error)))) || 'no answer').slice(0, 200) : '' };
  const ki = kReq.findIndex(x => x.site_id === p.site_id); const kr = ki >= 0 ? (kRes[ki] || {}) : {};
  const verified = Number(kr.statusCode) === 200 && String(kr.body ?? kr.data ?? '').trim() === p.indexnow_key;
  const ii = iReq.findIndex(x => x.site_id === p.site_id); const ir = ii >= 0 ? (iRes[ii] || {}) : null;
  const inStatus = ir ? (Number(ir.statusCode) || (ir.error ? 0 : 200)) : 0; const inOk = ir && [200, 202].includes(inStatus);
  const indexnow = { key: p.indexnow_key, key_url: 'https://' + p.site_host + '/' + p.indexnow_key + '.txt', verified, submitted: inOk ? iReq[ii].urls.length : 0, status: inStatus || null, error: ir && !inOk ? 'IndexNow answered ' + (inStatus || 'nothing') : '' };
  const subVia = new Map(); for (const u of (bingOk ? bing.urls : [])) subVia.set(keyOf(u), 'bing'); if (inOk) for (const u of iReq[ii].urls) subVia.set(keyOf(u), subVia.has(keyOf(u)) ? 'bing+indexnow' : 'indexnow');
  // ---- pages ----
  const pages = ready.filter(r => r.site_id === p.site_id).map(r => ({ ...r, submitted_now: subVia.get(keyOf(r.url)) || '' }));
  const keyInfo = new Map(p.key_pages.map(k => [keyOf(k.url), k]));
  const page_rows = pages.map(r => { const k = keyInfo.get(keyOf(r.url)) || {}; const st = (p.stored_pages || []).find(x => x.key === keyOf(r.url)) || {};
    return { site_id: p.site_id, domain: p.domain, url: r.url, kind: r.kind, checked_at: r.checked_at, status: r.status, score: r.score, checks_json: J(r.checks.map(c => ({ key: c.key, ok: c.ok, weight: c.weight, label: c.label, detail: c.detail }))),
      issues: r.issues.slice(0, 4).join(' | ').slice(0, 1000), words_raw: r.words_raw, title: r.title, updated_on: r.updated_on, bing_crawled_at: r.bing_crawled_at, bing_status: r.bing_status,
      submitted_at: r.submitted_now ? now : (st.submitted_at || ''), submitted_via: r.submitted_now || st.submitted_via || '', cited_by: (k.cited_by || []).join(', '), questions: (k.questions || []).join(' | ').slice(0, 600) }; });
  // submitted pages not checked this week and never stored: a first row so the next run knows they were sent
  for (const [k, via] of subVia) if (!pages.some(r => keyOf(r.url) === k) && !(p.stored_pages || []).some(x => x.key === k)) { const kp = keyInfo.get(k); const url = (kp && kp.url) || 'https://' + k;
    page_rows.push({ site_id: p.site_id, domain: p.domain, url, kind: (kp && kp.kind) || 'page', checked_at: '', status: 0, score: null, checks_json: '', issues: '', words_raw: 0, title: '', updated_on: '', bing_crawled_at: '', bing_status: 0, submitted_at: now, submitted_via: via, cited_by: '', questions: '' }); }
  const scored = pages.filter(r => r.status);
  const avg_score = scored.length ? Math.round(scored.reduce((t, r) => t + r.score, 0) / scored.length) : null;
  // ---- earned media (+ drafts) ----
  const em = earnedAll.find(x => x.site_id === p.site_id) || { earned: [], prospect_rows: [], outreach_jobs: [] };
  const oi = oIn.findIndex(x => x.site_id === p.site_id); const drafts = oi >= 0 && oOut[oi] && !oOut[oi].error ? ((parseJ(oOut[oi].output).drafts) || []) : [];
  const draftFor = (job) => drafts.find(d => Number(d.n) === job.n) || null;
  const prospect_rows = em.prospect_rows.map(r => { const job = em.outreach_jobs.find(j => j.prospect_domain === r.prospect_domain); const d = job ? draftFor(job) : null;
    return d && d.body ? { ...r, outreach_subject: String(d.subject || '').slice(0, 200), outreach_body: String(d.body).slice(0, 3000) } : r; });   // status stays new (the app's prospect statuses: new / contacted / won / rejected / ignored); a stored draft = ready to send
  const earned = em.earned.slice(0, 15).map(e => { const row = prospect_rows.find(r => r.prospect_domain === e.host && r.source_url === e.url); return { ...e, status: row ? row.status : '', contact_email: (row && row.contact_email) || e.contact_email || '', draft: row && row.outreach_body ? { subject: row.outreach_subject, body: row.outreach_body } : null }; });
  const newlyWon = prospect_rows.filter(r => r.status === 'won' && r.won_at === now);
  // ---- targets ----
  const targets = p.targets; const queued = targets.filter(t => t.status === 'queued').sort((a, b) => b.value - a.value); const wonT = targets.filter(t => t.status === 'won' && t.won_at === now);
  // ---- entity (Wikidata) ----
  let entity = p.previous_entity || null;
  const er = eReq.map((q, i) => ({ q, r: jsonOf(eRes[i]) })).filter(x => x.q.site_id === p.site_id);
  if (er.length) { const byName = ((er.find(x => x.q.kind === 'name') || {}).r || {}).search || []; const bySite = er.filter(x => x.q.kind === 'site').flatMap(x => ((x.r.query || {}).search || []).map(s => s.title)).filter(Boolean);
    const qid = bySite[0] || ''; entity = { checked_at: now, found: !!qid, qid, by_site: [...new Set(bySite)], by_name: byName.slice(0, 5).map(s => ({ id: s.id, label: s.label, description: s.description || '' })),
      errors: er.filter(x => !x.r || (!x.r.search && !x.r.query)).length }; }
  // ---- actions (most valuable first) and alerts ----
  const actions = []; const alerts = [];
  for (const r of pages.filter(r => !r.status || r.status >= 400 || r.checks.some(c => c.key === 'indexable' && c.ok === false && r.status >= 200 && r.status < 300))) {
    actions.push({ priority: 1, type: 'access', action: 'Fix ' + r.url + (r.status >= 400 || !r.status ? ' (answers ' + (r.status || 'nothing') + ')' : ' (not indexable)'), why: r.issues[0] || 'Assistants cannot use a page they cannot fetch or index.' });
    if (['cited', 'target', 'ladder', 'content', 'home'].includes(r.kind)) alerts.push({ level: 'high', text: 'Key page ' + r.url + ' cannot be used by AI: ' + (r.issues[0] || 'error ' + r.status) });
  }
  for (const r of pages.filter(r => r.checks.some(c => c.key === 'raw_text' && c.ok === false))) actions.push({ priority: 1, type: 'render', action: 'Serve the text of ' + r.url + ' in the HTML', why: 'Only ' + r.words_raw + ' words without JavaScript; ChatGPT, Claude, Perplexity and Gemini do not run JavaScript.' });
  for (const e of earned.filter(e => e.draft || e.action_type === 'reply').slice(0, 3)) actions.push({ priority: 1, type: 'earned', action: e.action, why: 'AI cited "' + (e.title || e.url) + '" ' + e.citations + 'x (' + e.engines.join(', ') + ') for "' + (e.questions[0] || '') + '"' + (e.competitors_named.length ? '; it names ' + e.competitors_named.join(', ') + ' and not you' : '') + (e.draft ? '. A draft is ready.' : ''), url: e.url, draft: e.draft });
  if (!verified) actions.push({ priority: 2, type: 'indexnow', action: 'Put one file on the website: ' + indexnow.key_url, why: 'The file contains just ' + p.indexnow_key + '. Then every new or updated page is sent the same day to Bing (ChatGPT search, Copilot), Yandex, Naver and the other IndexNow engines.', key: p.indexnow_key, key_url: indexnow.key_url });
  if (BING && !inAccount) actions.push({ priority: 2, type: 'bing', action: 'Add ' + p.site_host + ' to Bing Webmaster Tools', why: 'Import it from Google Search Console (one click) in the account the agent reads: new pages are then submitted to Bing every week and Bing\'s crawl of each key page is checked.' });
  for (const t of queued.slice(0, 2)) actions.push({ priority: 2, type: t.kind === 'refresh' ? 'refresh' : 'content', action: (t.kind === 'refresh' ? 'Refresh ' + t.page_url + ' to answer "' : 'Write an answer page for "') + t.question + '"', why: t.reason + (p.ai_pages_month > 0 ? '. Queued: the Monday content run writes it (' + p.ai_pages_month + ' AI pages a month).' : '. AI pages are off for this site: write it from the AI visibility page.'), target_id: t.target_id,
    api_body: { mode: 'keyword', keyword: t.keyword, country: p.country, domain: p.domain, page_type: t.page_type || 'Guide', existing_page_url: t.kind === 'refresh' ? t.page_url : '', receive: ['Keyword Report', 'Page Content'], ai_target: { question: t.question, kind: t.kind, fanout: t.fanout.split(' | ').filter(Boolean), sources: JSON.parse(t.sources_json || '[]'), competitors: t.competitors.split(', ').filter(Boolean), target_id: t.target_id } } });
  for (const r of pages.filter(r => ['cited', 'target', 'ladder', 'content'].includes(r.kind) && r.checks.some(c => (c.key === 'fresh' || c.key === 'answer_first') && c.ok !== true)).slice(0, 3)) actions.push({ priority: 3, type: 'page', action: 'Improve ' + r.url + ' (AI-readiness ' + r.score + '/100)', why: r.issues.slice(0, 2).join(' ') });
  if (entity && !entity.found) actions.push({ priority: 3, type: 'entity', action: 'Become a recognised entity', why: 'No Wikidata item has ' + p.domain + ' as its official website. Wikidata accepts organisations with independent sources (press, registries): once covered, create the item with the website (P856), the founding date and the location — knowledge graphs feed AI answers.' });
  for (const w of newlyWon) alerts.push({ level: 'good', text: 'You are now named on ' + w.source_url + ', a page AI cites for your topic.' });
  for (const t of wonT) alerts.push({ level: 'good', text: 'AI now names you for "' + t.question + '" (an AI target written for it).' });
  const growth_row = { site_id: p.site_id, domain: p.domain, run_id: p.run_id, checked_at: now, submitted: bing.submitted + indexnow.submitted, submitted_json: J({ bing, indexnow: { ...indexnow, key: undefined } }), indexnow: verified ? 'verified' : 'key_missing',
    pages_checked: scored.length, avg_score, pages_json: J(pages.map(r => ({ url: r.url, kind: r.kind, score: r.score, status: r.status, issues: r.issues.slice(0, 3), updated_on: r.updated_on, words_raw: r.words_raw, bing_crawled_at: r.bing_crawled_at, submitted: r.submitted_now }))),
    targets_json: J({ queued: queued.length, writing: targets.filter(t => t.status === 'writing').length, written: targets.filter(t => t.status === 'written').length, won: targets.filter(t => t.status === 'won').length, top: queued.slice(0, 5).map(t => ({ target_id: t.target_id, question: t.question, kind: t.kind, page_url: t.page_url, value: t.value })) }),
    earned_json: J(earned.slice(0, 12).map(e => ({ url: e.url, title: e.title, host: e.host, kind: e.kind, citations: e.citations, engines: e.engines, questions: e.questions, mentions_us: e.mentions_us, competitors_named: e.competitors_named, action: e.action, status: e.status, drafted: !!e.draft }))),
    entity_json: entity ? J(entity) : '', actions_json: J(actions.map(({ api_body, draft, ...a }) => a).slice(0, 12)), alerts: alerts.map(a => a.level + ': ' + a.text).join(' | ').slice(0, 2000), cost_usd: oi >= 0 ? 0.03 : 0 };
  const cache_rows = (p.indexnow_new || (verified && !p.indexnow_verified_at)) ? [{ key: 'indexnow:' + p.site_id, kind: 'ai', site_id: p.site_id, value: J({ key: p.indexnow_key, verified_at: verified ? now : '', created_at: now }), updated_at: now }] : [];
  out.push({ json: { site_id: p.site_id, domain: p.domain, site_host: p.site_host, business_name: p.business_name, email: p.email, callback_url: p.callback_url, request_id: p.request_id, on_demand: p.on_demand, run_id: p.run_id, checked_at: now, ai_pages_month: p.ai_pages_month,
    submitted: { bing, indexnow }, pages: pages.map(({ checks, ...r }) => ({ ...r, checks: checks.map(c => ({ key: c.key, ok: c.ok, label: c.label })) })), avg_score, previous_avg_score: p.previous ? p.previous.avg_score : null,
    targets: targets.map(t => ({ target_id: t.target_id, question: t.question, kind: t.kind, page_url: t.page_url, status: t.status, value: t.value, reason: t.reason, engines: t.engines, competitors: t.competitors })),
    earned, entity, actions: actions.slice(0, 12), alerts, page_rows, target_rows: targets, prospect_rows, growth_row, cache_rows } });
}
return out.length ? out : [{ json: { skip: true } }];
