/*__ANCHOR__*/
/*__SITE_MODEL__*/
/*__SERP_OBS__*/
/*__RANK_SERP__*/
/*__ANNOTATIONS__*/
/*__LINEAGE__*/
/*__REPLAN__*/
/*__FIT_GATE__*/
// Rank tracker report: per ladder, positions vs the previous check, rungs reached, drops and the recommended next step.
// G32 (2026-10-13, FIX_PLAN): a ladder that has not moved for the configured number of weeks (`seo_monitors.stuck_weeks`, empty = 8)
// no longer only says "stuck": RP (v5/code/_replan.js) turns the same facts into a re-plan PROPOSAL — a different rung order, an easier
// supporting keyword, improving the page that exists instead of writing another, or stopping — with the reason and the evidence. It is
// a proposal: no row is rewritten and nothing the owner approved is changed.
// v4.16 (G6, 2026-10-12 system review): also the results page itself — the features it showed (AI Overview, snippet, People Also Ask,
// local pack, video), who is above us with their positions, our modelled share of voice, and the mobile position of the main keywords.
// Anything volatile is worded as an observation of one search at one moment (_serp_obs.js, D26), never as a fact about the query.
const FORM_URL = '__FORM_URL__', API_URL = '__API_URL__';
const plan = $('Tracker Plan').all().map(i => i.json).filter(p => p && !p.nothing_to_do);
const pos = $('Parse Positions').all().map(i => i.json);
let history = []; try { history = $('Load History').all().map(i => i.json).filter(r => r && r.ladder_id); } catch (e) {}
// v4.8 display-only flags for the app (nothing in the e-mail changes): won / stuck per ladder; published dates from the content log, page facts from the ladder rows
let logRows = []; try { logRows = $('Load Content Log (Tracker)').all().map(i => i.json).filter(r => r && r.keyword && !r.error); } catch (e) {}
const pubLog = logRows.filter(r => r.published_url);
// R1 (2026-10-13, re-rating): a ladder row saying `writing` is a promise, not a page. Live, 90 seconds after the budget guard refused the page
// run of row 19, this report told the owner "already written — publish it" about a page nobody had written. `written` in seo_content_log is the
// proof (the content run upserts it when the article exists); a `started` row is a run that opened the row and never finished.
const writtenLog = logRows.filter(r => r.status === 'written' || r.status === 'published' || String(r.published_url || '').trim());
// R111 (2026-10-16, re-rating 2026-10-15): a draft whose LAST quality round failed is `not_ready` in the content log. It is not "written"
// (that word means "passed QA, waiting to be published"): ladders 609 and 548 told the owner "already written — publish it" about two
// drafts their own quality check had refused. Such a rung is "fix the draft and run it again", with the quality check's reasons.
const notReadyLog = logRows.filter(r => r.status === 'not_ready' && !String(r.published_url || '').trim());
// R87 (2026-10-16): ladders the plan found paused (their main keyword set aside), and the AI brand names for the gate (R90)
const pausedAll = ((plan[0] || {}).paused_ladders) || [];
let aiBrandRowsT = []; try { aiBrandRowsT = $('Load AI Brands (Tracker)').all().map(i => i.json).filter(r => r && r.key && !r.error); } catch (e) {}
// R91 (2026-10-16): the depth every check really asked for (Tracker Plan's request body), never a number written into a sentence
const depthAsked = Number((((plan.find(p => p && Array.isArray(p.body)) || {}).body || [])[0] || {}).depth) || 50;
let ladderRows = []; try { ladderRows = $('Load Ladders').all().map(i => i.json).filter(r => r && r.ladder_id && r.keyword); } catch (e) {}
// B6-14 (2026-10-16, benchmark area 6): the site's own Search Console impressions per query (seo_query_history, written weekly by the
// Site Tracker) weigh the share of voice across a ladder's keywords; RS.weightedVoice keeps the newest stored period only
let queryRows = []; try { queryRows = $('Load Query History (Tracker)').all().map(i => i.json).filter(r => r && r.query && !r.error); } catch (e) {}
// 2026-10-12 (FIX_PLAN D11): the site's page inventory (seo_pages, filled weekly by the Site Tracker). A ladder keyword that a live page
// already answers is never "write it" or "publish it": the next step names that page and asks for a refresh, because a second page for the
// same search splits the signals. With no inventory stored nothing changes.
let pageRows = []; try { pageRows = $('Load Pages (Tracker)').all().map(i => i.json).filter(r => r && r.site_id && r.url && !r.error); } catch (e) {}
const modelFor = (domain) => SM.from({ site_id: 'site_' + normD(domain).replace(/[^a-z0-9]+/g, '-'), domain: normD(domain) },
  { pages: pageRows.filter(r => r.site_id === 'site_' + normD(domain).replace(/[^a-z0-9]+/g, '-')) });
const FLAGS = { won_checks: 4, won_position: 3, stuck_weeks: RP.WEEKS };
// G32: how many weeks without a gain make a ladder stuck, per site (seo_monitors.stuck_weeks; empty = 8, kept between 2 and 26 by RP.weeks)
let monRowsT = []; try { monRowsT = $('Load Monitors (Tracker)').all().map(i => i.json).filter(r => r && (r.site_id || r.domain) && !r.error); } catch (e) {}
const normK = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const validPos = (v) => v !== '' && v != null && Number.isFinite(Number(v)) && Number(v) >= 0;   // -1 = failed check: "check again", never a position
const nowCheck = pos[0] ? pos[0].checked_at : new Date().toISOString();
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const posText = (v) => v == null || v === 0 ? 'not in top 50' : v < 0 ? 'check failed' : '#' + v;
const td = 'style="padding:4px 8px;border:1px solid #cbd5e1"';
// G6: a mobile check is a second reading of the same keyword, so it never becomes a row of the ladder table — it is kept beside the
// desktop row (the series, the rungs, won / stuck and the next step all stay desktop, as they were before G6).
const isMob = (x) => String((x || {}).device || '') === 'mobile';
const deskHist = history.filter(h => !isMob(h));
const mobileNow = new Map();   // keyword -> this run's mobile reading
plan.forEach((p, i) => { if (isMob(p)) mobileNow.set(p.keyword, { position: Number((pos[i] || {}).position), checked_at: (pos[i] || {}).checked_at || nowCheck, fresh: true }); });
for (const d of ((plan[0] || {}).deferred_pages || [])) if (isMob(d) && !mobileNow.has(d.keyword)) mobileNow.set(d.keyword, { position: Number(d.last_position), checked_at: d.last_checked, fresh: false });
const mobileOf = (kw) => { const n = mobileNow.get(kw); if (n) return n;
  const h = history.filter(x => isMob(x) && x.keyword === kw && validPos(x.position)).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0];
  return h ? { position: Number(h.position), checked_at: h.checked_at, fresh: false } : null; };
const byLadder = new Map();
plan.forEach((p, i) => { if (isMob(p) || p.watch_keyword) return; if (!byLadder.has(p.ladder_id)) byLadder.set(p.ladder_id, []); byLadder.get(p.ladder_id).push({ ...p, result: pos[i] || {} }); });
// pages not checked this week (not live yet; checked monthly) keep their last known position, so the ladder picture stays complete
for (const d of ((plan[0] || {}).deferred_pages || [])) { if (isMob(d) || !byLadder.has(d.ladder_id)) continue; const src = byLadder.get(d.ladder_id)[0]; byLadder.get(d.ladder_id).push({ ...src, ...d, deferred: true, result: { position: d.last_position, url: d.last_url, checked_at: d.last_checked } }); }
// R16 (2026-10-13, FIX_PLAN §3.11): rungs the fit gate set aside (a competitor's brand, a government portal, stored before the rule).
// No check was bought for them, so they are not in `positions`; the report names them with the reason instead of promising a page.
const asideAll = ((plan[0] || {}).set_aside_pages) || [];
const asideAllOf = (id) => asideAll.filter(x => x && x.ladder_id === id);
const out = [];
for (const [id, items] of byLadder) {
  // B6-2 (2026-10-15, benchmark area 6): the whole previous row, not only its position — its snapshot is what says how much the
  // results page itself moved, and its date is what says how old the "Before" column really is.
  // R88 (2026-10-16, re-rating 2026-10-15): ONE baseline per keyword per run — the newest earlier desktop reading of the keyword for this
  // site, whichever workflow bought it (RS.prevReading). This used to read this ladder's own rows only while the tracked-keyword block
  // below read any reading of the site, so "erp implementation dubai" was "3 of top 8 changed" in one and "5 of top 8 changed" in the other.
  const ladDomain = (items[0] || {}).domain || '';
  const prevRowOf = (kw) => RS.prevReading(deskHist, { keyword: kw, domain: ladDomain, before: nowCheck });
  const prevOf = (kw) => { const h = prevRowOf(kw); return h ? Number(h.position) : null; };
  const rowsK = items.map(it => { const pr = it.deferred ? null : prevRowOf(it.keyword); const cur = Number(it.result.position); const prev = it.deferred ? cur : (pr ? Number(pr.position) : null);
    const delta = (cur > 0 && prev > 0) ? prev - cur : (cur > 0 && prev === 0) ? 100 : (cur === 0 && prev > 0) ? -100 : null;
    return { ...it, current: cur, previous: prev, delta, prev_row: pr, prev_at: pr ? String(pr.checked_at) : '', url: it.result.url || '' }; }).sort((a, b) => a.rung - b.rung || a.page_no - b.page_no);
  const head = rowsK.find(r => r.rung === 4) || rowsK[0];
  // ---- G6: the results page of each keyword, read back from the row that was just stored ----
  const serpOf = (r) => {
    if (r.deferred) return null;
    const f = RS.unpack(r.result.features_json, null), c = RS.unpack(r.result.competitors_json, null);
    if (!f) return null;
    // the AI Overview across this check and the stored ones for the same keyword: "seen in N of M checks" (never "there is no AI Overview")
    const obs = [{ seen: f.unavailable ? null : f.ai_overview.shown, at: f.checked_at || nowCheck, source: 'rank check' }];
    for (const h of deskHist.filter(x => x.ladder_id === id && x.keyword === r.keyword && String(x.checked_at) < nowCheck).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at))).slice(0, 3)) {
      const hf = RS.unpack(h.features_json, null);
      if (hf) obs.push({ seen: hf.unavailable ? null : hf.ai_overview.shown, at: hf.checked_at || h.checked_at, source: 'rank check' });
    }
    const sov = r.result.share_of_voice == null || Number(r.result.share_of_voice) < 0 ? null : Number(r.result.share_of_voice);
    const above = ((c || {}).above || []).map(x => ({ domain: x.d, position: x.p, tracked: !!x.t }));
    return { features: f, chips: RS.featureChips(f), line: RS.featureLine(f, obs), observations: obs.filter(o => o.seen != null).length,
      share_of_voice: sov, above, competitors: ((c || {}).competitors || []).map(x => ({ domain: x.d, position: x.p, tracked: !!x.t })),
      shares: (c || {}).shares || [], method: (c || {}).method || RS.METHOD, snapshot_at: (RS.unpack(r.result.snapshot_json, {}) || {}).at || null };
  };
  const serps = new Map(rowsK.map(r => [r.keyword, serpOf(r)]));
  const mobiles = new Map(rowsK.map(r => [r.keyword, mobileOf(r.keyword)]));
  // ---- B6-2: how much each results page itself moved since the previous reading, measured from the stored snapshots ----
  // A position is one reading of one page at one moment. Until now a fall of seven places was printed with nothing beside it, so a
  // page that slipped and a page that was simply pushed down by a rewritten results page read identically. The proof was already
  // stored (criterion 2.2): `snapshot_json` keeps the top 10 with their URLs for every check. Nothing extra is bought.
  const changes = new Map(rowsK.map(r => [r.keyword, r.deferred ? RS.churnNone('no check was bought for this keyword this week — it is checked monthly until its page is live')
    : RS.withNoise(RS.churn(r.prev_row ? r.prev_row.snapshot_json : null, r.result.snapshot_json, { own: ladDomain }), RS.noise(deskHist, { keyword: r.keyword, domain: ladDomain }))]));   // R88: judged against what two readings of one moment show; B6-8: `own` also measures the page without us
  const moveNoteOf = (r) => RS.moveNote(r.delta, changes.get(r.keyword));
  const withMove = (r) => { const n = moveNoteOf(r); return r.keyword + ' (' + posText(r.previous) + ' \u2192 ' + posText(r.current) + (n ? '; ' + n : '') + ')'; };
  // how old the oldest reading this report compares against is, and what Google did in between (criterion 2.12)
  const prevDays = rowsK.map(r => r.prev_at).filter(Boolean).sort();
  const windowStart = prevDays.length ? prevDays[0].slice(0, 10) : '';
  const sinceMarks = windowStart ? AN.marks({ from: windowStart, to: String(nowCheck).slice(0, 10) }).filter(m => m.kind === 'google_update' || m.kind === 'data_break') : [];
  const updateLine = sinceMarks.length ? 'Google changed its ranking systems inside the window these positions are compared over ('
    + windowStart + ' to ' + String(nowCheck).slice(0, 10) + '): ' + sinceMarks.map(m => String(m.label).replace(/^Google: /, '') + ' (' + m.date + (m.date_end && m.date_end !== m.date ? ' to ' + m.date_end : '') + ')').join(' and ')
    + '. A move in this window may be part of the cause, which cannot be proven from these positions.' : '';
  const rungs = [1, 2, 3].map(r => { const ps = rowsK.filter(x => x.rung === r); return { rung: r, pages: ps.length, top10: ps.filter(x => x.current > 0 && x.current <= 10).length, top3: ps.filter(x => x.current > 0 && x.current <= 3).length, reached: ps.length > 0 && ps.every(x => x.current > 0 && x.current <= 10) }; }).filter(r => r.pages);
  const drops = rowsK.filter(r => r.delta != null && r.delta <= -5).map(withMove);
  const gains = rowsK.filter(r => r.delta != null && r.delta >= 5).map(withMove);
  const topTop3Before = deskHist.filter(x => x.ladder_id === id && x.keyword === head.keyword && String(x.checked_at) < nowCheck && Number(x.position) > 0 && Number(x.position) <= 3).length;
  const done = head.current > 0 && head.current <= 3 && topTop3Before >= 3;
  const rowOf = (kw) => ladderRows.find(l => l.ladder_id === id && l.keyword === kw) || {};
  const logOf = (kw) => pubLog.filter(l => normK(l.keyword) === normK(kw) && (!l.ladder_id || l.ladder_id === id) && (!l.domain || normD(l.domain) === normD(head.domain))).sort((a, b) => String(a.published_at || '').localeCompare(String(b.published_at || '')))[0] || null;
  // 2026-10-11 (FIX_PLAN D16): the next step follows the ladder's state, not only the rungs — live, a main-page-only ladder read "every rung is in
  // the top 10" and a Direct plan was told to work on rung 1 while its main page waited to be published.
  //   main page: planned -> write it; written ('writing') but not live -> publish it (with the page's URL); live = row 'published', a content-log
  //   row, an existing page, or ranking. Direct plan (the main page is page 1) and main-page-only ladders: the main page comes first, the rungs
  //   only once it is live (the Content Cadence's gate). Short / full plans: rungs first; "every rung is in the top 10" only when rungs exist
  //   and are all in — then the main page is written, published or improved by its state.
  // ---- R16 (2026-10-13, FIX_PLAN §3.11): the fit gate with THIS run's results page in hand ----
  // A rung stored before the gate existed ("facts erp") is only recognisable from the page it ranks on: facts.ae holding the top
  // results is what makes it a brand query. The check was already paid for, so the position stays in the table — but the rung is taken
  // out of "write or improve" and named with its reason. A rung whose page is already written is kept and only flagged.
  const trackedComps = [...new Set(rowsK.flatMap(r => ((serps.get(r.keyword) || {}).competitors || []).filter(c => c.tracked).map(c => c.domain)))];
  // R87 (2026-10-16): the results page is read ONE entry per position (RS.serpHosts: the snapshot's own top ten). The old line joined the
  // answer's "above" list with its competitor list, so every domain on page 1 was counted twice and "e invoicing in uae" — tax.gov.ae #1
  // and mof.gov.ae #2, two government sites of the five the rule reads, it needs three — was set aside as a government query (exec 632).
  // R90: a rung is also judged against the HEAD's page of this check (the brands that compete for the ladder's own subject) and the
  // names AI uses for other companies; the ladder heads of the site stay protected, so its own subject is never read as a brand.
  const headDoms = RS.serpHosts(head.deferred ? null : head.result, 10);
  const sidF = 'site_' + normD(head.domain).replace(/[^a-z0-9]+/g, '-');
  const brandsF = fitLearnedBrands(aiBrandRowsT.filter(r => String(r.key || '') === 'ai_brands:' + sidF));
  const protectF = [...new Set([head.head_keyword || '', ...ladderRows.filter(l => normD(l.domain) === normD(head.domain)).map(l => String(l.head_keyword || ''))].filter(Boolean))];
  const fitAside = []; const asideKw = new Set();
  for (const r of rowsK) {
    const s = serps.get(r.keyword); if (!s) continue;
    const doms = RS.serpHosts(r.result, 10);
    const lr = rowOf(r.keyword);
    const g = fitStored({ keyword: r.keyword, status: r.status, page_exists: lr.page_exists, published_url: (logOf(r.keyword) || {}).published_url },
      { own_domain: normD(head.domain), brands: brandsF, competitors: trackedComps, serp: doms, serp_domains: doms.concat(headDoms).filter((h, i, a) => a.indexOf(h) === i), protect: protectF });
    if (!g.flagged) continue;
    fitAside.push({ ladder_id: id, keyword: r.keyword, rung: r.rung, page_no: r.page_no, status: r.status || '', target_url: lr.target_url || '',
      reason: g.reason, detail: g.detail, note: g.note, written: !!g.live, dropped: !g.ok, seen: 'this check' });
    if (!g.ok) asideKw.add(r.keyword);
  }
  // R87: a ladder whose MAIN keyword is set aside — by this check, by the plan, or already on its row — is paused: nothing asks for its
  // rungs (they exist only to climb towards that keyword), the head's row is written back `set_aside` with the reason, and the next step
  // says so and offers a re-plan. Setting the head aside is not dropping the topic: nothing is deleted.
  const headAsideNow = fitAside.find(x => x.rung === 4 && x.dropped) || (asideAllOf(id).find(x => Number(x.rung) === 4 && x.dropped)) || null;
  const pausedPlan = pausedAll.find(x => x && x.ladder_id === id) || null;
  const paused = headAsideNow ? { keyword: headAsideNow.keyword, reason: headAsideNow.reason, detail: headAsideNow.detail, note: headAsideNow.note, seen: headAsideNow.seen || 'before this check' }
    : pausedPlan ? { keyword: pausedPlan.head_keyword, reason: pausedPlan.reason, detail: pausedPlan.detail, note: pausedPlan.note, seen: 'stored', held: pausedPlan.held || [] } : null;
  const isTop = (r) => r.rung === 4;
  const topRow = rowsK.find(isTop) || null;
  const invModel = pageRows.length ? modelFor(head.domain) : null;
  const ukeyT = (u) => String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/$/, '');
  // D11: the live page that already answers this keyword (never the ladder's own planned URL)
  const coveredBy = (r) => { if (!invModel) return null; const m = SM.matchPage(invModel, r.keyword); return (m && ukeyT(m.url) !== ukeyT(r.target_url)) ? m : null; };
  const liveOf = (r) => { const lr = rowOf(r.keyword); return r.status === 'published' || !!logOf(r.keyword) || lr.page_exists === true || lr.page_exists === 'true' || r.current > 0 || !!coveredBy(r); };
  const writtenOf = (kw) => writtenLog.some(l => normK(l.keyword) === normK(kw) && (!l.domain || normD(l.domain) === normD(head.domain)));   // R1
  const notReadyOf = (kw) => (writtenOf(kw) ? null : notReadyLog.filter(l => normK(l.keyword) === normK(kw) && (!l.domain || normD(l.domain) === normD(head.domain))).sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))[0]) || null;   // R111
  const fixText = (kw) => { const l = notReadyOf(kw); const why = String((l && l.qa_reasons) || '').split(/;\s+/).filter(Boolean).slice(0, 2).join('; ');
    return 'written, but the draft did not pass the quality check' + (why ? ' (' + why.slice(0, 220) + ')' : '') + ' — fix it and run it again; do not publish it as it is'; };
  const mainLive = !!topRow && liveOf(topRow), mainWritten = !!topRow && (mainLive || (['writing', 'written', 'not_ready'].includes(topRow.status) && writtenOf(topRow.keyword)));
  const mainFirst = !!topRow && (Number(topRow.page_no) === 1 || !rungs.length);
  const allIn = rungs.length > 0 && rungs.every(r => r.reached);
  const pending = rungs.find(r => !r.reached) || null;
  const pageOf = (t) => ({ keyword: t.keyword, page_type: t.page_type, target_url: t.target_url, status: t.status });
  let next;
  const mainNotReady = !!topRow && !mainLive && !mainWritten && ['writing', 'written', 'not_ready'].includes(topRow.status) && !!notReadyOf(topRow.keyword);   // R111
  if (paused) next = { action: 'paused', rung: 4, main_page: mainLive ? 'live' : 'planned', reason: paused.reason,
    text: 'This ladder is paused: its main keyword "' + paused.keyword + '" is not a search this website should target (' + (paused.detail || paused.reason) + ')'
      + (paused.seen === 'this check' ? ', as this week\'s check of its results page showed' : '') + '. None of its pages is written or asked for until you re-plan the ladder towards another main keyword, or tell us the keyword is deliberate; the pages that are already live keep being checked.', pages: [] };
  else if (done) next = { action: 'complete', rung: 4, text: 'The top rung "' + head.keyword + '" has held the top 3 for 4 checks. From now on it is checked once a month with the published pages, so a drop is noticed; keep the pages fresh and the links growing.', pages: [] };
  else if (topRow && !mainWritten && (mainFirst || allIn)) next = { action: 'write_top', rung: 4, main_page: 'planned',
    text: (mainFirst ? (rungs.length ? 'This plan writes the main page first: ' : 'The main page is the whole ladder for now: ') : 'Every rung is in the top 10: ') + 'write the main page "' + head.keyword + '"' + (rungs.length && mainFirst ? '; its supporting pages follow once it is live' : '') + '.', pages: [pageOf(topRow)] };
  else if (mainNotReady && (mainFirst || allIn)) next = { action: 'fix_top', rung: 4, main_page: 'not_ready',
    text: 'The main page "' + head.keyword + '" is ' + fixText(topRow.keyword) + '.', pages: [pageOf(topRow)] };
  else if (topRow && mainWritten && !mainLive && (mainFirst || allIn)) next = { action: 'publish_top', rung: 4, main_page: 'written', publish_url: topRow.target_url || '',
    text: 'The main page "' + head.keyword + '" is written but not live yet: publish it' + (topRow.target_url ? ' at ' + topRow.target_url : '') + '. Nothing climbs until it is published' + (rungs.length && mainFirst ? ', and its supporting pages wait for it' : '') + '.', pages: [] };
  else if (pending) {
    const target = rowsK.filter(x => x.rung === pending.rung && !asideKw.has(x.keyword));   // R16: never ask for a page we should not write
    next = { action: 'write_rung_' + pending.rung, rung: pending.rung, main_page: mainLive ? 'live' : mainWritten ? 'written' : 'planned',
      text: 'Work on rung ' + pending.rung + ': ' + (pending.top10 ? pending.top10 + ' of ' + pending.pages + ' pages are in the top 10. ' : 'none of its pages is in the top 10 yet. ') + 'Write or improve: ' + target.map(t => { const c = coveredBy(t);
        return '"' + t.keyword + '"' + (c ? ' (' + c.url + ' already answers this search — refresh that page, do not publish a second one)' : (['writing', 'written', 'not_ready'].includes(t.status) && writtenOf(t.keyword)) ? ' (already written — publish it)' : (t.status === 'writing' && notReadyOf(t.keyword)) ? ' (' + fixText(t.keyword) + ')' : t.status === 'writing' ? ' (a page run was started for it but no page was written — it is written again)' : ''); }).join(', ') + '.',
      pages: target.map(t => { const c = coveredBy(t); return c ? { ...pageOf(t), status: 'improve', target_url: c.url, covered_by: c.url } : pageOf(t); }) };
  } else { const cTop = topRow ? coveredBy(topRow) : null;   // D11: the page that answers the main keyword may be one the site already had
    next = { action: 'improve_top', rung: 4, main_page: 'live',
      text: (allIn ? 'Every rung is in the top 10 and the main page is live' : 'The main page is live') + ': improve the main page "' + head.keyword + '"' + (cTop ? ' — it is ' + cTop.url + ', the page the site already has for this search' : '') + ' (depth, internal links from the rung pages, links from other sites) and keep it fresh.',
      pages: topRow ? [cTop ? { ...pageOf(topRow), status: 'improve', target_url: cTop.url, covered_by: cTop.url } : pageOf(topRow)] : [] }; }
  // won: the main keyword in the top 3 in each of the last 4 checks, this one included (failed checks skipped)
  const histOf = (kw) => deskHist.filter(x => x.ladder_id === id && x.keyword === kw && String(x.checked_at) < nowCheck && validPos(x.position)).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)));
  const headChecks = [...(!head.deferred && validPos(head.result.position) ? [{ position: Number(head.result.position), checked_at: nowCheck }] : []), ...histOf(head.keyword)].slice(0, FLAGS.won_checks);
  const won = rowsK.some(r => r.rung === 4) && headChecks.length >= FLAGS.won_checks && headChecks.every(h => Number(h.position) >= 1 && Number(h.position) <= FLAGS.won_position);
  // stuck: pages published, the first one `stuck_weeks`+ weeks ago, and none of them improved its position over those weeks (G32: the
  // threshold is the site's own setting, and the same facts become the re-plan proposal below)
  const sidT = 'site_' + normD(head.domain).replace(/[^a-z0-9]+/g, '-');
  const stuckWeeks = RP.weeks((monRowsT.find(m => m.site_id === sidT || normD(m.domain) === normD(head.domain)) || {}).stuck_weeks);
  const nowMs = new Date(nowCheck).getTime(), cutoff = nowMs - stuckWeeks * 7 * 864e5;
  const pubRows = rowsK.filter(r => r.status === 'published' || !!logOf(r.keyword));
  const pubDates = pubRows.map(r => { const l = logOf(r.keyword), lr = rowOf(r.keyword); const d = (l && (l.published_at || l.started_at)) || ((lr.page_exists === true || lr.page_exists === 'true') ? lr.start_date : ''); const t = d ? new Date(d).getTime() : NaN; return Number.isFinite(t) ? t : null; }).filter(t => t != null);
  const firstPub = pubDates.length ? Math.min(...pubDates) : null;
  const improved = pubRows.some(r => { const hs = histOf(r.keyword); const cur = (!r.deferred && validPos(r.result.position)) ? Number(r.result.position) : (hs[0] ? Number(hs[0].position) : null); if (cur == null) return false;
    const base = hs.find(h => new Date(h.checked_at).getTime() <= cutoff) || hs[hs.length - 1]; if (!base) return false; const b = Number(base.position);
    return cur > 0 && (b === 0 || cur < b); });
  const stuck = !won && pubRows.length > 0 && firstPub != null && firstPub <= cutoff && !improved;
  // G32: the same facts turned into a re-plan proposal (RP decides nothing about the data — it only reads what is above). A ladder that
  // is moving gets no proposal, and an accepted one is applied by a person in the app: nothing here rewrites the plan.
  const baseAt = (kw) => { const hs = histOf(kw); const b = hs.find(h => new Date(h.checked_at).getTime() <= cutoff) || hs[hs.length - 1]; return b ? Number(b.position) : null; };
  const replan = RP.propose({ ladder_id: id, head_keyword: head.head_keyword || head.keyword, domain: head.domain, checked_at: nowCheck,
    weeks: firstPub == null ? null : Math.floor((nowMs - firstPub) / (7 * 864e5)), stuck_weeks: stuckWeeks, won, improved, reach: null,
    head: { keyword: head.keyword, position: head.current, base_position: baseAt(head.keyword), live: mainLive },
    pages: rowsK.map(r => { const c = coveredBy(r); const lr = rowOf(r.keyword);
      return { keyword: r.keyword, rung: Number(r.rung), page_no: Number(r.page_no), status: r.status || '', live: liveOf(r), position: r.current,
        base_position: baseAt(r.keyword), target_url: r.url || lr.target_url || r.target_url || '', covered_by: c ? c.url : '' }; }) });
  // 2026-10-11 (FIX_PLAN D9): pages are written without links to their unpublished siblings, so when one goes live the owner has to add the
  // link. One reminder line per ladder, only for the pages that went live since the previous check, with the anchor words to use.
  const lastCheck = deskHist.filter(x => x.ladder_id === id && String(x.checked_at) < nowCheck).map(x => String(x.checked_at)).sort().pop() || '';
  const links_to_add = lastCheck ? rowsK.map(r => { const l = logOf(r.keyword); const at = l ? String(l.published_at || l.started_at || '') : ''; return (at && at > lastCheck && l.published_url) ? { keyword: r.keyword, url: l.published_url, anchor: anchorText({ title: l.title, keyword: r.keyword, url: l.published_url }), rung: r.rung } : null; }).filter(Boolean) : [];
  const remindHtml = links_to_add.length ? '<p><b>Now live — add the links:</b> ' + links_to_add.map(x => '"' + esc(x.anchor) + '" (' + esc(x.url) + ')').join(', ') + '. ' +
    'Each of these pages was published since the last check, so the other ladder pages do not link to it yet: add one link from ' + (links_to_add.some(x => x.rung !== 4) ? 'the main page "' + esc(head.head_keyword) + '"' : 'the pages that cover the same topic') + ' using the anchor shown.</p>' : '';
  const firstPending = (next.pages || []).find(p => !(['writing', 'written', 'not_ready'].includes(p.status) && writtenOf(p.keyword))) || (next.pages || [])[0];   // R1: a `writing` row with no written page is still to be written
  const apiBody = (firstPending && next.action !== 'paused') ? { mode: 'keyword', keyword: firstPending.keyword, page_type: firstPending.page_type || 'Service Page', country: head.country || '', domain: head.domain, existing_page_url: (next.action === 'improve_top' || firstPending.covered_by) ? (firstPending.target_url || '') : '', email: head.email, ladder_id: id, ladder_rung: next.rung, ladder_head: head.head_keyword, force_content: true } : null;   // D11: a covered keyword is written as a refresh of the page that exists
  const formLink = FORM_URL + '?' + encodeURIComponent('What do you want?') + '=' + encodeURIComponent('I know my keyword');
  // B6-2: a reading from a month ago is not "before" in the sense a weekly table implies — a won ladder and an unpublished rung are
  // both checked monthly, and the column said nothing about it.
  const staleRead = (r) => !!r.prev_at && (new Date(nowCheck).getTime() - new Date(r.prev_at).getTime()) / 864e5 > RS.CHURN.stale_days;
  const table = '<table style="border-collapse:collapse;font-size:13px"><tr><th align="left" ' + td + '>Rung</th><th align="left" ' + td + '>Keyword</th><th ' + td + '>Now</th><th ' + td + '>Before</th><th align="left" ' + td + '>Ranking URL</th></tr>' +
    rowsK.map(r => '<tr><td ' + td + '>' + (r.rung === 4 ? 'Top' : r.rung) + '</td><td ' + td + '>' + esc(r.keyword) + (r.deferred ? ' <span style="color:#64748b;font-size:11px">(not published yet: checked monthly, last ' + esc(String(r.last_checked || '').slice(0, 10)) + ')</span>' : '') + '</td><td align="center" ' + td + '>' + esc(posText(r.current)) + '</td><td align="center" ' + td + '>' + (r.previous == null ? 'first check' : esc(posText(r.previous)) + (staleRead(r) ? ' <span style="color:#64748b;font-size:11px">(' + esc(r.prev_at.slice(0, 10)) + ')</span>' : '')) + '</td><td ' + td + '>' + esc(r.url || '—') + '</td></tr>').join('') + '</table>';
  // ---- G6: what the results pages looked like, who is above us and the share of voice ----
  const mobText = (m) => !m ? '—' : posText(m.position) + (m.fresh ? '' : ' <span style="color:#64748b;font-size:11px">(' + esc(String(m.checked_at || '').slice(0, 10)) + ')</span>');
  const serpRows = rowsK.filter(r => serps.get(r.keyword) || mobiles.get(r.keyword));
  const serpTable = serpRows.length ? '<table style="border-collapse:collapse;font-size:13px"><tr><th align="left" ' + td + '>Keyword</th><th align="left" ' + td + '>What the page showed</th><th ' + td + '>Share of voice</th><th ' + td + '>Mobile</th><th align="left" ' + td + '>Page movement</th><th align="left" ' + td + '>Above you</th></tr>' +
    serpRows.map(r => { const s = serps.get(r.keyword), m = mobiles.get(r.keyword);
      const ab = s && s.above.length ? s.above.slice(0, 3).map(a => esc(a.domain) + ' (#' + a.position + ')' + (a.tracked ? ' *' : '')).join(', ') + (s.above.length > 3 ? ' +' + (s.above.length - 3) + ' more' : '') : (s && r.current > 0 && r.current <= 10 ? 'nobody on page 1' : '—');
      const ch = changes.get(r.keyword);
      const chCell = ch && ch.available ? esc(ch.changed + ' of top ' + ch.depth + ' changed') + ' <span style="color:#64748b;font-size:11px">(' + esc(ch.band) + ')</span>'
        : '<span style="color:#64748b;font-size:11px">not available</span>';
      return '<tr><td ' + td + '>' + esc(r.keyword) + '</td><td ' + td + '>' + esc(s ? (s.chips.join(' \u00b7 ') || 'plain results, no features') : 'not checked this week') + '</td><td align="center" ' + td + '>' + (s && s.share_of_voice != null ? s.share_of_voice + '%' : '\u2014') + '</td><td align="center" ' + td + '>' + mobText(m) + '</td><td ' + td + '>' + chCell + '</td><td ' + td + '>' + ab + '</td></tr>'; }).join('') + '</table>' : '';
  const headSerp = serps.get(head.keyword) || null;
  const headChange = changes.get(head.keyword) || null;
  // ---- B6-5 (2026-10-15, benchmark area 6, criterion 2.14): what this week's checks cost, and what a keyword costs a month ----
  // The gate (B-A10) already reads the provider's own cost for these calls; it reached the callback and nothing printed it. A figure
  // the provider did not report is not invented here: the line then says the cost was not reported.
  const weekChecks = (() => { try { return checkEvidence || null; } catch (e) { return null; } })();
  const costHtml = (() => {
    if (!weekChecks) return '';
    // the gate's own evidence block names them `checked` and `retried`; B-A10's summary renames them `read` and `sent_again`
    const asked = Number(weekChecks.asked) || 0;
    const read = Number(weekChecks.read != null ? weekChecks.read : weekChecks.checked) || 0;
    const sentAgain = Number(weekChecks.sent_again != null ? weekChecks.sent_again : weekChecks.retried) || 0;
    const usd = weekChecks.cost_usd == null ? null : Number(weekChecks.cost_usd);
    const per = (usd != null && asked > 0) ? (usd / asked * (365 / 7 / 12)) : null;
    return '<p style="color:#64748b;font-size:12px">This week\u2019s checks: ' + asked + ' results page' + (asked === 1 ? '' : 's') + ' asked for, ' + read + ' read'
      + (Number(weekChecks.failed) ? ', ' + Number(weekChecks.failed) + ' could not be read' + (sentAgain ? ' and ' + sentAgain + ' of them sent again' : '') : '')
      + (usd == null ? '. The provider reported no cost for these calls, so none is shown.'
        : '. Cost $' + usd.toFixed(4) + (weekChecks.cost_basis ? ' (' + esc(String(weekChecks.cost_basis)) + ')' : ' (measured: the provider\u2019s own figure for these calls)')
          + (per != null ? ' \u2014 about $' + per.toFixed(3) + ' per keyword per month at a weekly check, modelled from this week\u2019s figure.' : '.'))
      + '</p>';
  })();
  const serpHtml = serpTable ? '<p style="margin-top:14px"><b>The results page itself</b> (the same check, no extra cost):</p>' + serpTable +
    (headSerp ? '<p style="font-size:12px;color:#334155">' + esc(headSerp.line) + '</p>' : '') +
    (headChange && headChange.available ? '<p style="font-size:12px;color:#334155">' + esc(RS.churnText(headChange)) + '</p>' : '') +
    (updateLine ? '<p style="font-size:12px;color:#b45309">' + esc(updateLine) + '</p>' : '') +
    '<p style="color:#64748b;font-size:12px">Share of voice is an estimate of the clicks page 1 offers, not measured clicks: ' + esc(RS.METHOD) + ' Domains marked * are the competitors on your list. Mobile is checked weekly for the main keywords (only about 13% of sites hold the same position on both devices). ' +
    'Page movement is measured: the top ten stored for this reading against the top ten stored for the previous one. ' + esc(RS.CHURN.labels_basis) + '.</p>' + costHtml : '';
  // ---- G12 (2026-10-13): the events of the tracked window (pages that went live, Google updates, data breaks), for the charts ----
  const firstCheck = [...deskHist.filter(x => x.ladder_id === id).map(x => String(x.checked_at)), nowCheck].sort()[0];
  const windowFrom = (String((rowOf(head.keyword) || {}).start_date || head.start_date || '').slice(0, 10) || String(firstCheck).slice(0, 10));
  const myPub = pubLog.filter(r => (r.ladder_id ? r.ladder_id === id : rowsK.some(x => x.keyword === r.keyword)) && String(r.published_at || '').slice(0, 10));
  const marks = AN.marks({ from: windowFrom, to: String(nowCheck).slice(0, 10), published: myPub });
  // ---- G29 (2026-10-13): where each figure in this report came from ----
  const mobileChecked = rowsK.filter(r => (mobiles.get(r.keyword) || {}).fresh).length;
  const lineage = [
    LN.of('Position per keyword', 'serp', { basis: 'one_sample', period: LN.asOf(nowCheck), sample: LN.sample(rowsK.length, 'keywords, one results page each (top 50, desktop)'),
      note: 'one country and one device at one moment: it will differ from a Search Console average' }),
    LN.of('Share of voice', 'model', { basis: 'modelled', period: LN.asOf(nowCheck), sample: LN.sample(rowsK.map(r => serps.get(r.keyword)).filter(s => s && s.share_of_voice != null).length, 'results pages read'), note: RS.METHOD }),
    [...changes.values()].some(c => c.available)
      ? LN.of('How much the results page itself moved', 'serp', { basis: 'measured', period: (windowStart || String(nowCheck).slice(0, 10)) + ' to ' + String(nowCheck).slice(0, 10),
          sample: LN.sample([...changes.values()].filter(c => c.available).length, 'results pages with a stored earlier reading to compare against'),
          note: 'counted from the two stored top-ten readings; ' + RS.CHURN.labels_basis })
      : LN.unknown('How much the results page itself moved', 'no earlier stored reading of these results pages to compare with yet'),
    mobileChecked ? LN.of('Mobile position', 'serp', { basis: 'one_sample', period: LN.asOf(nowCheck), sample: LN.sample(mobileChecked, 'main keywords checked on mobile') })
      : LN.unknown('Mobile position', 'no mobile check was bought for this ladder this week'),
    myPub.length ? LN.of('The dates your pages went live', 'own_check', { basis: 'measured', period: windowFrom + ' onwards', sample: LN.sample(myPub.length, 'published pages recorded') })
      : LN.unknown('The dates your pages went live', 'no publish date is recorded for this ladder yet — report one with "I published a page"'),
  ];
  // R16: this ladder's set-aside rungs, with the reason, before the next step (so nothing in the report asks for that page) — the ones
  // the plan never checked and the ones this run's results page revealed
  const aside = [...asideAllOf(id), ...fitAside];
  // R87 (2026-10-16): a keyword set aside BEFORE any check and one set aside BY this week's check are not the same sentence — the second
  // one's position is in the table above, so "no position checked" was false for it
  const asideBefore = aside.filter(x => x.seen !== 'this check'), asideNow = aside.filter(x => x.seen === 'this check');
  const asideHtml = (asideBefore.length ? '<p style="color:#b45309"><b>Set aside before any check</b> (planned before the keyword rule existed, no position checked and no page to write): '
    + asideBefore.map(x => esc(x.note || x.keyword)).join(' | ') + '</p>' : '')
    + (asideNow.length ? '<p style="color:#b45309"><b>Set aside by this week\'s check</b> (its position is in the table above; this results page shows it is not a search to write for, so no page is written for it): '
    + asideNow.map(x => esc(x.note || x.keyword)).join(' | ') + '</p>' : '');
  // R87: the rows to write back (Tracker Ladder Marks -> Mark Set Aside (Tracker)): every rung refused that has no page yet, and the head of
  // a paused ladder with the reason, so the cadence and the app stop treating the ladder as one to write
  const ladder_marks = aside.filter(x => x && x.dropped && !x.written && x.keyword).map(x => ({ ladder_id: id, keyword: x.keyword, status: 'set_aside',
    status_note: String((x.note || x.detail || x.reason || 'set aside by the keyword rule') + (Number(x.rung) === 4 ? ' — the ladder is paused until it is re-planned' : '')).slice(0, 300) }))
    .filter((m, i, a) => a.findIndex(o => o.keyword === m.keyword) === i);
  // ---- B6-8 (2026-10-16, benchmark area 6): a move of five places is the page's OWN only when it beats the results page's churn ----
  // `gains` / `drops` above stay what they were (every five-place move with its clause; the app reads them). What a move is CALLED now
  // follows the measurement: the mail's "Drops to look at" holds the page's own falls only, a move no larger than the page around it is
  // "moved with the results page", and a move with no comparable earlier reading is listed with no verdict at all.
  const moves = rowsK.filter(r => !r.deferred && r.delta != null && Math.abs(r.delta) >= RS.MOVE.min_places).map(r => {
    const k = RS.moveKind(r.delta, changes.get(r.keyword)) || { kind: 'not_compared', own: false, text: '' };
    return { keyword: r.keyword, rung: r.rung, previous: r.previous, current: r.current, delta: r.delta, direction: r.delta > 0 ? 'gain' : 'drop',
      kind: k.kind, own: !!k.own, note: k.text, line: r.keyword + ' (' + posText(r.previous) + ' → ' + posText(r.current) + (k.text ? '; ' + k.text : '') + ')' }; });
  const movesOf = (kind, dir) => moves.filter(m => m.kind === kind && (!dir || m.direction === dir)).map(m => m.line);
  const ownDrops = movesOf('own', 'drop'), ownGains = movesOf('own', 'gain');
  const movedWithPage = movesOf('with_page'), withinNoise = movesOf('within_noise'), notCompared = movesOf('not_compared');
  const move_summary = { own: moves.filter(m => m.kind === 'own').length, with_page: movedWithPage.length, within_noise: withinNoise.length,
    not_compared: notCompared.length, min_places: RS.MOVE.min_places, rule: RS.MOVE.rule };
  // ---- B6-6 / B6-10 (2026-10-16): two of the site's own pages on one results page, and who moved above the target URL ----
  const cannibals = new Map(rowsK.map(r => [r.keyword, r.deferred ? null : RS.cannibal(r.result.snapshot_json, { keyword: r.keyword, depth: depthAsked,
    previous_url: r.prev_row ? r.prev_row.url : '', previous_at: r.prev_at })]));
  const outrankedOf = new Map(rowsK.map(r => [r.keyword, r.deferred ? null : RS.outranked(r.prev_row ? r.prev_row.snapshot_json : null, r.result.snapshot_json,
    { domain: ladDomain, previous_position: r.previous, position: r.current, target_url: rowOf(r.keyword).target_url || r.url, previous_at: r.prev_at })]));
  const cannibalFound = [...cannibals.values()].filter(c => c && c.found);
  const outrankedFound = rowsK.map(r => outrankedOf.get(r.keyword)).filter(o => o && o.available && o.domains.length);
  // ---- B6-14 (2026-10-16): one share of voice over the ladder's keywords, weighted by the site's own Search Console impressions ----
  const voiceW = RS.weightedVoice(rowsK.map(r => ({ keyword: r.keyword, share_of_voice: (serps.get(r.keyword) || {}).share_of_voice })), queryRows, { domain: ladDomain });
  const movesHtml = (ownGains.length ? '<p style="color:#15803d"><b>Gains:</b> ' + esc(ownGains.join('; ')) + '</p>' : '')
    + (ownDrops.length ? '<p style="color:#b91c1c"><b>Drops to look at:</b> ' + esc(ownDrops.join('; ')) + '</p>' : '')
    + (movedWithPage.length ? '<p style="color:#334155"><b>Moved with the results page</b> (not necessarily about your page): ' + esc(movedWithPage.join('; ')) + '</p>' : '')
    + (withinNoise.length ? '<p style="color:#64748b"><b>Within what two readings of the same moment differ by</b> (not a move): ' + esc(withinNoise.join('; ')) + '</p>' : '')
    + (notCompared.length ? '<p style="color:#64748b"><b>Position changes that could not be compared with the results page around them</b> (no verdict): ' + esc(notCompared.join('; ')) + '</p>' : '')
    + (moves.length ? '<p style="color:#64748b;font-size:12px">How a move of ' + RS.MOVE.min_places + ' places or more is read: ' + esc(RS.MOVE.rule) + '.</p>' : '')
    + (outrankedFound.length ? '<p style="color:#b45309"><b>Who took the place:</b> ' + esc(outrankedFound.map(o => o.text).join(' ')) + '</p>' : '')
    + (cannibalFound.length ? '<p style="color:#b45309"><b>Two of your pages compete for one search:</b> ' + esc(cannibalFound.map(c => c.text).join(' ')) + '</p>' : '');
  const sovHtml = voiceW.value != null ? '<p style="font-size:12px;color:#334155">Your share of voice across the ' + voiceW.keywords + ' keyword' + (voiceW.keywords === 1 ? '' : 's') + ' read: '
    + voiceW.value + '% (' + esc(voiceW.note) + ').</p>' : '';
  for (const l of lineage) if (l && /^Share of voice$/.test(String(l.figure || '')) && l.basis !== 'unknown') l.note = String(l.note || '') + ' Across the keywords: ' + voiceW.note + '.';
  const subject = '[Keyword ladder] ' + head.head_keyword + ' — ' + head.domain + ': ' + (head.current > 0 ? 'top page at #' + head.current : 'top page not yet in the top ' + depthAsked) + (ownDrops.length ? ' · ' + ownDrops.length + ' drop(s)' : '');
  const html = '<p>Hi,</p><p>Position check for your keyword ladder towards <b>' + esc(head.head_keyword) + '</b> on <b>' + esc(head.domain) + '</b> (' + rowsK.length + ' keywords, Google top ' + depthAsked + ').</p>' + table +
    '<p><b>Rungs:</b> ' + (rungs.map(r => 'Rung ' + r.rung + ': ' + r.top10 + '/' + r.pages + ' in top 10, ' + r.top3 + ' in top 3' + (r.reached ? ' ✓ reached' : '')).join(' · ') || 'no rung pages tracked') + '</p>' +
    movesHtml +
    serpHtml + sovHtml + remindHtml + RP.block(replan) + asideHtml + '<p><b>Next step:</b> ' + esc(next.text) + '</p>' + (next.publish_url ? '<p>Page to publish: <a href="' + esc(next.publish_url) + '">' + esc(next.publish_url) + '</a></p>' : '') +
    (apiBody ? '<p>Start the next page: open the <a href="' + formLink + '">SEO Assistant form</a> ("I know my keyword", keyword <b>' + esc(apiBody.keyword) + '</b>, domain ' + esc(head.domain) + '), or send this to the API (' + esc(API_URL) + '):</p><pre style="background:#f1f5f9;padding:8px;font-size:12px">' + esc(JSON.stringify(apiBody, null, 2)) + '</pre>' : '') +
    '<p style="color:#64748b;font-size:12px">Checks run weekly; once the top page holds the top 3 for four checks, the main keyword and the published pages are checked monthly. Positions come from DataForSEO live SERPs.</p>'
    // G12 / G29 (2026-10-13): the events of the tracked window, and where each figure came from
    + (marks.length ? '<p style="margin-top:14px"><b>What happened while this ladder was tracked</b> (these dates are marked on the ladder\'s charts):</p>' + AN.html(marks, { empty: false }) : '')
    + LN.block(lineage);
  // G6: the ladder's own picture of the results pages — our share of voice (the main keyword, and the average over the keywords that
  // were checked), the competitors above us anywhere on the ladder with how many keywords they beat us for, and what the pages showed.
  const sovs = rowsK.map(r => serps.get(r.keyword)).filter(s => s && s.share_of_voice != null).map(s => s.share_of_voice);
  const fcount = (pick) => rowsK.filter(r => { const s = serps.get(r.keyword); return s && !s.features.unavailable && pick(s.features) === true; }).length;
  const aboveCount = new Map();
  for (const r of rowsK) for (const a of ((serps.get(r.keyword) || {}).above || [])) { const e = aboveCount.get(a.domain) || { domain: a.domain, keywords: 0, best_position: a.position, tracked: a.tracked };
    e.keywords++; e.best_position = Math.min(e.best_position, a.position); e.tracked = e.tracked || a.tracked; aboveCount.set(a.domain, e); }
  const serp_summary = { checked: sovs.length, share_of_voice: voiceW.value,   // B6-14: weighted by impressions when there are any, else the unweighted mean, labelled
    share_of_voice_unweighted: voiceW.unweighted, share_of_voice_weight: voiceW.weight, share_of_voice_note: voiceW.note,
    share_of_voice_weighting: { weight: voiceW.weight, keywords: voiceW.keywords, weighted_keywords: voiceW.weighted_keywords, impressions: voiceW.impressions || null, period_end: voiceW.period_end, basis: RS.WEIGHT.basis },
    cannibalisation: { found: cannibalFound.length, checked: [...cannibals.values()].filter(c => c && c.checked).length, not_checked: [...cannibals.values()].filter(c => c && !c.checked).length },
    outranked: { keywords: outrankedFound.length, compared: rowsK.filter(r => (outrankedOf.get(r.keyword) || {}).available).length },
    head_share_of_voice: headSerp ? headSerp.share_of_voice : null, method: RS.METHOD,
    competitors_above: [...aboveCount.values()].sort((a, b) => b.keywords - a.keywords || a.best_position - b.best_position).slice(0, 10),
    tracked_competitors: (headSerp && headSerp.competitors.filter(c => c.tracked)) || [],
    features: { ai_overview: fcount(f => f.ai_overview.shown), ai_overview_cites_us: fcount(f => f.ai_overview.cites_us),
      ai_overview_sources_unknown: fcount(f => f.ai_overview.shown === true && f.ai_overview.cites_us === null),
      featured_snippet: fcount(f => f.featured_snippet.shown), snippet_ours: fcount(f => f.featured_snippet.ours),
      people_also_ask: fcount(f => f.people_also_ask.shown), local_pack: fcount(f => f.local_pack.shown),
      video: fcount(f => f.video.shown), shopping: fcount(f => f.shopping.shown), not_read: rowsK.filter(r => (serps.get(r.keyword) || {}).features && serps.get(r.keyword).features.unavailable).length },
    // B6-2 / B6-3: how much the results pages themselves moved, and what Google did inside the window these positions are compared over
    page_movement: { compared: [...changes.values()].filter(c => c.available).length, not_available: [...changes.values()].filter(c => !c.available).length,
      high: [...changes.values()].filter(c => c.available && c.band === 'high').length, some: [...changes.values()].filter(c => c.available && c.band === 'some').length,
      still: [...changes.values()].filter(c => c.available && c.band === 'still').length,
      noise: [...changes.values()].filter(c => c.available && c.band === 'noise').length,   // R88: no larger than two readings of one moment
      basis: 'measured: the stored top ten of this reading against the stored top ten of the previous one', labels_basis: RS.CHURN.labels_basis,
      window_from: windowStart || null, head: headChange },
    updates_in_window: sinceMarks, update_note: updateLine,
    week_checks: weekChecks,
    head_line: headSerp ? headSerp.line : '', mobile_checked: rowsK.filter(r => (mobiles.get(r.keyword) || {}).fresh).length };
  out.push({ json: { ladder_id: id, domain: head.domain, head_keyword: head.head_keyword, email: head.email || '', callback_url: head.callback_url || '', request_id: head.request_id || '',
    subject, html, status: 'progress', stage: 'rank_tracker', checked_at: nowCheck,
    positions: rowsK.map(r => { const s = serps.get(r.keyword), m = mobiles.get(r.keyword);
      return { rung: r.rung, keyword: r.keyword, position: r.current, previous: r.previous, delta: r.delta, url: r.url, device: 'desktop',
        mobile_position: m ? m.position : null, mobile_checked_at: m ? m.checked_at : null,
        features: s ? s.features : null, feature_labels: s ? s.chips : [], results_page: s ? s.line : '',
        share_of_voice: s ? s.share_of_voice : null, above: s ? s.above : [], competitors: s ? s.competitors : [], snapshot_at: s ? s.snapshot_at : null,
        previous_checked_at: r.prev_at || null, previous_is_stale: staleRead(r),
        serp_change: changes.get(r.keyword) || null, move_note: moveNoteOf(r),
        move_kind: ((moves.find(m => m.keyword === r.keyword) || {}).kind) || null, cannibal: cannibals.get(r.keyword) || null, outranked: outrankedOf.get(r.keyword) || null }; }),
    rungs, gains, drops, own_gains: ownGains, own_drops: ownDrops, moved_with_page: movedWithPage, not_compared_moves: notCompared, moves, move_summary, serp_summary, annotations: marks, lineage, next_step: next, links_to_add, set_aside: aside, ladder_marks, paused, api_body: apiBody, done, won, stuck,
    stuck_weeks: stuckWeeks, replan } });   // G32: the proposal, never applied here
}
// ====================================================================================================================
// B6-7 (2026-10-15, benchmark area 6 - docs/system-review-2026-10-14/BENCH_AREA6_rank_tracking.md gap G6-8, section 7):
// the keywords the CUSTOMER named, reported by the tracker that exists for them.
// Until now this report had exactly one shape, "a ladder", so a business that named thirty searches when it set tracking up had none
// of them in the rank tracker: `Tracker Plan` read `seo_ladders` and nothing else. The list is `seo_sites.keywords`, and the readings
// are the ones this run bought plus the ones the weekly site check already bought (one series, `watch_<site_id>` and `<site_id>` both
// read here). Every keyword on the list appears, and each one says which it is:
//   checked this week | read from the reading already bought on <date> | checked with your keyword ladder | waiting for the cap |
//   set aside by the keyword rule, with the reason.
// Nothing is inferred from a keyword nobody read: no position, no share of voice, no movement, no place in a count (rule 1).
const watchMeta = ((plan[0] || {}).watch) || null;
if (watchMeta && (watchMeta.sites || []).length) {
  const runChecks = (() => { try { return checkEvidence || null; } catch (e) { return null; } })();
  const perCheck = (runChecks && runChecks.cost_usd != null && Number(runChecks.asked) > 0) ? Number(runChecks.cost_usd) / Number(runChecks.asked) : null;
  for (const site of watchMeta.sites) {
    const sid = String(site.site_id || ''), wid = 'watch_' + sid, dom = normD(site.domain);
    if (!sid || !dom) continue;
    const mine = (list) => (list || []).filter(x => String(x.site_id || '') === sid);
    const carriedW = mine(watchMeta.carried), heldW = mine(watchMeta.held), asideW = mine(watchMeta.set_aside);
    // one series per keyword: our own weekly readings and the weekly site check's, oldest-last. A failed check (-1) is never a position.
    const series = (kw) => deskHist.filter(x => String(x.keyword || '').toLowerCase() === kw && validPos(x.position)
      && (x.ladder_id === wid || x.ladder_id === sid || normD(x.domain) === dom)).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)));
    const seeds = [];
    plan.forEach((p, i) => { if (p.watch_keyword && String(p.site_id || '') === sid) seeds.push({ keyword: p.keyword, row: pos[i] || {}, at: (pos[i] || {}).checked_at || nowCheck, how: 'bought' }); });
    for (const c of carriedW) {
      const kw = String(c.keyword).toLowerCase(); let row = null, at = '';
      if (c.source === 'ladder') {   // the ladder bought it in THIS run: the freshest reading there is, and it is not bought twice
        const i = plan.findIndex(x => !x.watch_keyword && !isMob(x) && normD(x.domain) === dom && String(x.keyword || '').toLowerCase() === kw);
        if (i >= 0 && pos[i]) { row = pos[i]; at = pos[i].checked_at || nowCheck; }
      }
      if (!row) { const h = series(kw)[0]; if (h) { row = h; at = h.checked_at; } }
      seeds.push({ keyword: c.keyword, row: row || null, at, how: c.source, reason: c.reason });
    }
    const rowsW = seeds.map(sd => {
      const kw = String(sd.keyword).toLowerCase();
      const read = !!sd.row && sd.row.position != null && sd.row.position !== '';
      const current = read ? Number(sd.row.position) : null;
      const prev = read ? RS.prevReading(deskHist, { keyword: kw, domain: dom, before: String(sd.at || nowCheck) }) : null;   // R88: the ladder report's baseline, one rule
      const previous = prev ? Number(prev.position) : null;
      const delta = (current > 0 && previous > 0) ? previous - current : (current > 0 && previous === 0) ? 100 : (current === 0 && previous > 0) ? -100 : null;
      const change = !read ? RS.churnNone('no live reading of this results page is stored for this keyword yet')
        : RS.withNoise(RS.churn(prev ? prev.snapshot_json : null, sd.row.snapshot_json, { own: dom }), RS.noise(deskHist, { keyword: kw, domain: dom }));
      // B6-6 / B6-8 / B6-10 (2026-10-16): the same three readings the ladder report makes, from the same stored rows
      const kind = RS.moveKind(delta, change);
      const cannibal = read ? RS.cannibal(sd.row.snapshot_json, { keyword: sd.keyword, depth: depthAsked, previous_url: prev ? prev.url : '', previous_at: prev ? prev.checked_at : '' }) : null;
      const outr = read ? RS.outranked(prev ? prev.snapshot_json : null, sd.row.snapshot_json, { domain: dom, previous_position: prev ? Number(prev.position) : null, position: current, target_url: sd.row.url || '', previous_at: prev ? prev.checked_at : '' }) : null;
      const f = read ? RS.unpack(sd.row.features_json, null) : null;
      const c = read ? RS.unpack(sd.row.competitors_json, null) : null;
      const sov = (read && sd.row.share_of_voice != null && Number(sd.row.share_of_voice) >= 0) ? Number(sd.row.share_of_voice) : null;
      return { keyword: sd.keyword, how: sd.how, reason: sd.reason || '', read, current, previous, delta, change,
        at: sd.at || '', url: read ? (sd.row.url || '') : '', features: f, chips: f ? RS.featureChips(f) : [],
        share_of_voice: sov, above: ((c || {}).above || []).map(x => ({ domain: x.d, position: x.p, tracked: !!x.t })),
        competitors: ((c || {}).competitors || []).map(x => ({ domain: x.d, position: x.p, tracked: !!x.t })),
        previous_checked_at: prev ? String(prev.checked_at) : null, move_note: RS.moveNote(delta, change),
        move_kind: kind ? kind.kind : null, move_kind_note: kind ? kind.text : '', cannibal, outranked: outr };
    }).sort((a, b) => (a.current == null ? 1 : 0) - (b.current == null ? 1 : 0) || (a.current === 0 ? 1 : 0) - (b.current === 0 ? 1 : 0) || (a.current || 0) - (b.current || 0) || a.keyword.localeCompare(b.keyword));
    if (!rowsW.length && !heldW.length && !asideW.length) continue;
    const moveOf = (r) => r.keyword + ' (' + posText(r.previous) + ' → ' + posText(r.current) + (r.move_note ? '; ' + r.move_note : '') + ')';
    const gainsW = rowsW.filter(r => r.delta != null && r.delta >= 5).map(moveOf);
    const dropsW = rowsW.filter(r => r.delta != null && r.delta <= -5).map(moveOf);
    // B6-8: what each five-place move is called; the mail's gains and drops are the page's own moves only
    const bigW = rowsW.filter(r => r.delta != null && Math.abs(r.delta) >= RS.MOVE.min_places && r.move_kind);
    const kindLine = (r) => r.keyword + ' (' + posText(r.previous) + ' → ' + posText(r.current) + (r.move_kind_note ? '; ' + r.move_kind_note : '') + ')';
    const ofKindW = (k, dir) => bigW.filter(r => r.move_kind === k && (!dir || (dir === 'gain' ? r.delta > 0 : r.delta < 0))).map(kindLine);
    const ownGainsW = ofKindW('own', 'gain'), ownDropsW = ofKindW('own', 'drop'), withPageW = ofKindW('with_page'), noiseW = ofKindW('within_noise'), notComparedW = ofKindW('not_compared');
    const movesW = bigW.map(r => ({ keyword: r.keyword, previous: r.previous, current: r.current, delta: r.delta, direction: r.delta > 0 ? 'gain' : 'drop', kind: r.move_kind, own: r.move_kind === 'own', note: r.move_kind_note, line: kindLine(r) }));
    const cannibalW = rowsW.filter(r => r.cannibal && r.cannibal.found), outrankedW = rowsW.filter(r => r.outranked && r.outranked.available && r.outranked.domains.length);
    const voiceWW = RS.weightedVoice(rowsW.filter(r => r.read).map(r => ({ keyword: r.keyword, share_of_voice: r.share_of_voice })), queryRows, { domain: dom });
    const movesHtmlW = (ownGainsW.length ? '<p style="color:#15803d"><b>Gains:</b> ' + esc(ownGainsW.join('; ')) + '</p>' : '')
      + (ownDropsW.length ? '<p style="color:#b91c1c"><b>Drops to look at:</b> ' + esc(ownDropsW.join('; ')) + '</p>' : '')
      + (withPageW.length ? '<p style="color:#334155"><b>Moved with the results page</b> (not necessarily about your page): ' + esc(withPageW.join('; ')) + '</p>' : '')
      + (noiseW.length ? '<p style="color:#64748b"><b>Within what two readings of the same moment differ by</b> (not a move): ' + esc(noiseW.join('; ')) + '</p>' : '')
      + (notComparedW.length ? '<p style="color:#64748b"><b>Position changes that could not be compared with the results page around them</b> (no verdict): ' + esc(notComparedW.join('; ')) + '</p>' : '')
      + (bigW.length ? '<p style="color:#64748b;font-size:12px">How a move of ' + RS.MOVE.min_places + ' places or more is read: ' + esc(RS.MOVE.rule) + '.</p>' : '')
      + (outrankedW.length ? '<p style="color:#b45309"><b>Who took the place:</b> ' + esc(outrankedW.map(r => '"' + r.keyword + '": ' + r.outranked.text).join(' ')) + '</p>' : '')
      + (cannibalW.length ? '<p style="color:#b45309"><b>Two of your pages compete for one search:</b> ' + esc(cannibalW.map(r => r.cannibal.text).join(' ')) + '</p>' : '')
      + (voiceWW.value != null ? '<p style="font-size:12px;color:#334155">Your share of voice across the ' + voiceWW.keywords + ' keyword' + (voiceWW.keywords === 1 ? '' : 's') + ' read: ' + voiceWW.value + '% (' + esc(voiceWW.note) + ').</p>' : '');
    const readRows = rowsW.filter(r => r.read);
    const top10 = readRows.filter(r => r.current > 0 && r.current <= 10).length;
    const top3 = readRows.filter(r => r.current > 0 && r.current <= 3).length;
    const striking = readRows.filter(r => r.current >= 4 && r.current <= 20);
    const unreadable = readRows.filter(r => r.current === -1).length;
    const comparedW = rowsW.filter(r => r.change && r.change.available).length;
    const sovRows = readRows.filter(r => r.share_of_voice != null);
    const howText = (r) => r.how === 'bought' ? 'checked this week'
      : r.how === 'ladder' ? 'checked with your keyword ladder' + (r.at ? ' on ' + String(r.at).slice(0, 10) : '')
      : r.how === 'site_check' ? 'read from the weekly site check' + (r.at ? ' of ' + String(r.at).slice(0, 10) : '')
      : r.how === 'own' ? 'checked on ' + String(r.at || '').slice(0, 10) + ' (a position is checked once a week)'
      : (r.at ? 'read from the reading of ' + String(r.at).slice(0, 10) : 'not read');
    const tableW = rowsW.length ? '<table style="border-collapse:collapse;font-size:13px"><tr><th align="left" ' + td + '>Keyword</th><th ' + td + '>Now</th><th ' + td + '>Before</th><th align="left" ' + td + '>Where this reading came from</th><th ' + td + '>Share of voice</th><th align="left" ' + td + '>Page movement</th><th align="left" ' + td + '>Above you</th></tr>' +
      rowsW.map(r => { const ab = r.above.length ? r.above.slice(0, 3).map(a => esc(a.domain) + ' (#' + a.position + ')' + (a.tracked ? ' *' : '')).join(', ') + (r.above.length > 3 ? ' +' + (r.above.length - 3) + ' more' : '') : (r.current > 0 && r.current <= 10 ? 'nobody on page 1' : '—');
        const ch = r.change && r.change.available ? esc(r.change.changed + ' of top ' + r.change.depth + ' changed') + ' <span style="color:#64748b;font-size:11px">(' + esc(r.change.band) + ')</span>' : '<span style="color:#64748b;font-size:11px">not available</span>';
        return '<tr><td ' + td + '>' + esc(r.keyword) + '</td><td align="center" ' + td + '>' + (r.read ? esc(posText(r.current)) : '<span style="color:#64748b;font-size:11px">not read</span>') + '</td><td align="center" ' + td + '>' +
          (r.previous == null ? 'first reading' : esc(posText(r.previous)) + (r.previous_checked_at ? ' <span style="color:#64748b;font-size:11px">(' + esc(String(r.previous_checked_at).slice(0, 10)) + ')</span>' : '')) + '</td><td ' + td + '>' + esc(howText(r)) +
          '</td><td align="center" ' + td + '>' + (r.share_of_voice != null ? r.share_of_voice + '%' : '—') + '</td><td ' + td + '>' + ch + '</td><td ' + td + '>' + ab + '</td></tr>'; }).join('') + '</table>' : '';
    const heldHtml = heldW.length ? '<p style="color:#64748b;font-size:12px"><b>Not checked this week (' + heldW.length + (watchMeta.held_total > heldW.length ? ' of ' + watchMeta.held_total : '') + '):</b> ' +
      heldW.slice(0, 12).map(h => esc(h.keyword) + ' — ' + esc(h.reason) + (h.last_checked ? ' (last read ' + esc(String(h.last_checked).slice(0, 10)) + ')' : ', never read')).join('; ') + (heldW.length > 12 ? ' (and ' + (heldW.length - 12) + ' more)' : '') + '</p>' : '';
    const asideHtmlW = asideW.length ? '<p style="color:#b45309"><b>Set aside by the keyword rule:</b> ' + asideW.map(a => esc(a.note)).join(' | ') + '</p>' : '';
    // ---- what the week cost for THIS list (criterion 2.14). Measured per check by the provider, counted once by task id (R28) ----
    const costW = (() => {
      const bought = rowsW.filter(r => r.how === 'bought').length;
      if (!bought) return '<p style="color:#64748b;font-size:12px">No check was bought for your keyword list this week: every keyword above was read from a results page somebody had already paid for.</p>';
      if (perCheck == null) return '<p style="color:#64748b;font-size:12px">' + bought + ' live check' + (bought === 1 ? '' : 's') + ' were bought for your keyword list this week. The provider reported no cost for these calls, so none is shown.</p>';
      return '<p style="color:#64748b;font-size:12px">' + bought + ' live check' + (bought === 1 ? '' : 's') + ' bought for your keyword list this week: about $' + (bought * perCheck).toFixed(4) +
        ' (measured — $' + Number(runChecks.cost_usd).toFixed(4) + ' for this run’s ' + runChecks.asked + ' checks, $' + perCheck.toFixed(4) + ' each). At this rate a keyword costs about $' +
        (perCheck * (365 / 7 / 12)).toFixed(3) + ' a month to watch weekly. ' + (carriedW.length ? carriedW.length + ' of your keywords cost nothing this week because a reading already existed. ' : '') + 'The tracker buys at most ' + watchMeta.limits.per_site + ' of them a week, oldest reading first.</p>';
    })();
    // the next step says something only when the readings say it (rule 1): a fall the page around it did not share, then the nearest win
    const ownDrop = rowsW.filter(r => r.delta != null && r.delta <= -RS.MOVE.min_places && r.move_kind === 'own').sort((a, b) => a.delta - b.delta)[0] || null;   // B6-8: the page's own fall, by the one rule
    const nearest = striking.sort((a, b) => a.current - b.current)[0] || null;
    const nextW = ownDrop ? { action: 'look_at_drop', keyword: ownDrop.keyword, text: '"' + ownDrop.keyword + '" fell from ' + posText(ownDrop.previous) + ' to ' + posText(ownDrop.current) + ' and the rest of that results page barely moved, so this one is about your page: look at the page that ranks for it first.' }
      : nearest ? { action: 'nearest_win', keyword: nearest.keyword, text: '"' + nearest.keyword + '" is at ' + posText(nearest.current) + ' — the nearest win on your list. Strengthening the page that already ranks for it is cheaper than writing a new one.' }
      : readRows.length ? { action: 'hold', keyword: '', text: 'Nothing on your keyword list moved five places or more this week, and none of it is within reach of page 1 yet. The readings keep building the trend.' }
      : { action: 'nothing_read', keyword: '', text: 'No results page could be read for your keyword list this week, so there is nothing to act on: the checks are sent again next week.' };
    const summaryW = { keywords: site.total, read: readRows.length, checked: rowsW.filter(r => r.how === 'bought').length,
      carried: carriedW.length, held: heldW.length, set_aside: asideW.length, could_not_be_read: unreadable,
      top10, top3, striking: striking.length, share_of_voice: voiceWW.value,   // B6-14: weighted by impressions when there are any, else unweighted, labelled
      share_of_voice_unweighted: voiceWW.unweighted, share_of_voice_weight: voiceWW.weight, share_of_voice_note: voiceWW.note,
      cannibalisation: { found: cannibalW.length }, outranked: { keywords: outrankedW.length },
      method: RS.METHOD, page_movement: { compared: comparedW, not_available: rowsW.length - comparedW, labels_basis: RS.CHURN.labels_basis },
      week_checks: runChecks, limits: watchMeta.limits };
    const lineageW = [
      readRows.length ? LN.of('Position per keyword', 'serp', { basis: 'one_sample', period: LN.asOf(nowCheck),
        sample: LN.sample(readRows.length, 'of the ' + site.total + ' keywords on your list had a results page read (top 50, desktop)'),
        note: 'one country and one device at one moment; ' + rowsW.filter(r => r.how !== 'bought' && r.read).length + ' of them were read from a results page already bought this week, with the date shown beside each' })
        : LN.unknown('Position per keyword', 'no results page could be read for any keyword on your list this week'),
      sovRows.length ? LN.of('Share of voice', 'model', { basis: 'modelled', period: LN.asOf(nowCheck), sample: LN.sample(sovRows.length, 'results pages read'), note: RS.METHOD + ' Across the keywords: ' + voiceWW.note + '.' })
        : LN.unknown('Share of voice', 'no results page was read, so no share can be modelled'),
      comparedW ? LN.of('How much the results page itself moved', 'serp', { basis: 'measured', period: LN.asOf(nowCheck),
        sample: LN.sample(comparedW, 'results pages with a stored earlier reading to compare against'), note: 'counted from the two stored top-ten readings; ' + RS.CHURN.labels_basis })
        : LN.unknown('How much the results page itself moved', 'no earlier stored reading of these results pages to compare with yet'),
      (perCheck != null) ? LN.of('What the checks cost', 'serp', { basis: 'measured', period: LN.asOf(nowCheck),
        sample: LN.sample(runChecks.asked, 'results pages asked for in this run'), note: 'the provider’s own figure for these calls, each task counted once by its id' })
        : LN.unknown('What the checks cost', 'the provider reported no cost for this run’s calls'),
    ];
    const subjectW = '[Tracked keywords] ' + site.domain + ' — ' + readRows.length + ' of ' + site.total + ' read'
      + (top10 ? ' · ' + top10 + ' in the top 10' : '') + (ownDropsW.length ? ' · ' + ownDropsW.length + ' drop(s)' : '');
    const htmlW = '<p>Hi,</p><p>This week’s positions for the <b>' + site.total + ' keyword' + (site.total === 1 ? '' : 's') + ' you asked us to watch</b> on <b>' + esc(site.domain) + '</b> (Google top 50, desktop). ' +
      'Your keyword ladders are reported separately — a keyword that is both is checked once, with the ladder.</p>' +
      (tableW || '<p>No keyword on your list could be read this week.</p>') +
      '<p><b>Where they stand:</b> ' + top3 + ' in the top 3, ' + top10 + ' in the top 10, ' + striking.length + ' within reach (positions 4-20)' +
      (unreadable ? ', ' + unreadable + ' could not be read this week (they are checked again next week — that is "check again", not "not ranking")' : '') + '.</p>' +
      movesHtmlW +
      heldHtml + asideHtmlW +
      '<p><b>Next step:</b> ' + esc(nextW.text) + '</p>' +
      '<p style="color:#64748b;font-size:12px">Share of voice is an estimate of the clicks page 1 offers, not measured clicks: ' + esc(RS.METHOD) +
      ' Domains marked * are the competitors on your list. Page movement is measured: the top ten stored for this reading against the top ten stored for the previous one. ' + esc(RS.CHURN.labels_basis) + '.</p>' +
      costW + LN.block(lineageW);
    out.push({ json: { ladder_id: '', watchlist: true, site_id: sid, domain: site.domain, head_keyword: 'the keywords you asked us to watch',
      email: site.email || '', callback_url: site.callback_url || '', request_id: site.request_id || '',
      subject: subjectW, html: htmlW, status: 'progress', stage: 'rank_tracker', checked_at: nowCheck,
      positions: rowsW.map(r => ({ rung: 0, keyword: r.keyword, position: r.read ? r.current : null, previous: r.previous, delta: r.delta,
        url: r.url, device: 'desktop', source: r.how, source_note: howText(r), read: r.read, reason: r.reason,
        features: r.features, feature_labels: r.chips, share_of_voice: r.share_of_voice, above: r.above, competitors: r.competitors,
        previous_checked_at: r.previous_checked_at, checked_at: r.at || null, serp_change: r.change, move_note: r.move_note,
        move_kind: r.move_kind, cannibal: r.cannibal, outranked: r.outranked })),
      rungs: [], gains: gainsW, drops: dropsW, own_gains: ownGainsW, own_drops: ownDropsW, moved_with_page: withPageW, not_compared_moves: notComparedW,
      moves: movesW, move_summary: { own: bigW.filter(r => r.move_kind === 'own').length, with_page: withPageW.length, within_noise: noiseW.length, not_compared: notComparedW.length, min_places: RS.MOVE.min_places, rule: RS.MOVE.rule },
      serp_summary: summaryW, watch_summary: summaryW,
      not_checked: heldW, set_aside: asideW, annotations: [], lineage: lineageW, next_step: nextW, links_to_add: [],
      api_body: null, done: false, won: false, stuck: false } });
  }
}
// R28 / R31 (the money is what happened): the week's checks are MEASURED by the in-200 gate, each task counted once by its own id,
// and until now the Rank Tracker settled its reservation instead. The figure travels on the first item of the report, which is the
// node the ledger settles from; a run whose evidence block could not be read carries none and the settle keeps saying so.
if (out.length) { const ev = (() => { try { return checkEvidence || null; } catch (e) { return null; } })();
  if (ev && ev.cost_usd != null) { out[0].json.cost_usd = Number(ev.cost_usd); out[0].json.cost_basis = String(ev.cost_basis || ''); } }
return out.length ? out : [{ json: { nothing_to_do: true } }];
