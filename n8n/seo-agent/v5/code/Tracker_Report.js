/*__ANCHOR__*/
/*__SITE_MODEL__*/
// Rank tracker report: per ladder, positions vs the previous check, rungs reached, drops and the recommended next step.
const FORM_URL = '__FORM_URL__', API_URL = '__API_URL__';
const plan = $('Tracker Plan').all().map(i => i.json).filter(p => p && !p.nothing_to_do);
const pos = $('Parse Positions').all().map(i => i.json);
let history = []; try { history = $('Load History').all().map(i => i.json).filter(r => r && r.ladder_id); } catch (e) {}
// v4.8 display-only flags for the app (nothing in the e-mail changes): won / stuck per ladder; published dates from the content log, page facts from the ladder rows
let pubLog = []; try { pubLog = $('Load Content Log (Tracker)').all().map(i => i.json).filter(r => r && r.keyword && r.published_url && !r.error); } catch (e) {}
let ladderRows = []; try { ladderRows = $('Load Ladders').all().map(i => i.json).filter(r => r && r.ladder_id && r.keyword); } catch (e) {}
// 2026-10-12 (FIX_PLAN D11): the site's page inventory (seo_pages, filled weekly by the Site Tracker). A ladder keyword that a live page
// already answers is never "write it" or "publish it": the next step names that page and asks for a refresh, because a second page for the
// same search splits the signals. With no inventory stored nothing changes.
let pageRows = []; try { pageRows = $('Load Pages (Tracker)').all().map(i => i.json).filter(r => r && r.site_id && r.url && !r.error); } catch (e) {}
const modelFor = (domain) => SM.from({ site_id: 'site_' + normD(domain).replace(/[^a-z0-9]+/g, '-'), domain: normD(domain) },
  { pages: pageRows.filter(r => r.site_id === 'site_' + normD(domain).replace(/[^a-z0-9]+/g, '-')) });
const FLAGS = { won_checks: 4, won_position: 3, stuck_weeks: 8 };
const normK = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const validPos = (v) => v !== '' && v != null && Number.isFinite(Number(v)) && Number(v) >= 0;   // -1 = failed check: "check again", never a position
const nowCheck = pos[0] ? pos[0].checked_at : new Date().toISOString();
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const posText = (v) => v == null || v === 0 ? 'not in top 50' : v < 0 ? 'check failed' : '#' + v;
const td = 'style="padding:4px 8px;border:1px solid #cbd5e1"';
const byLadder = new Map();
plan.forEach((p, i) => { if (!byLadder.has(p.ladder_id)) byLadder.set(p.ladder_id, []); byLadder.get(p.ladder_id).push({ ...p, result: pos[i] || {} }); });
// pages not checked this week (not live yet; checked monthly) keep their last known position, so the ladder picture stays complete
for (const d of ((plan[0] || {}).deferred_pages || [])) { if (!byLadder.has(d.ladder_id)) continue; const src = byLadder.get(d.ladder_id)[0]; byLadder.get(d.ladder_id).push({ ...src, ...d, deferred: true, result: { position: d.last_position, url: d.last_url, checked_at: d.last_checked } }); }
const out = [];
for (const [id, items] of byLadder) {
  const prevOf = (kw) => { const h = history.filter(x => x.ladder_id === id && x.keyword === kw && String(x.checked_at) < nowCheck && Number(x.position) >= 0).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0]; return h ? Number(h.position) : null; };
  const rowsK = items.map(it => { const cur = Number(it.result.position); const prev = it.deferred ? cur : prevOf(it.keyword);
    const delta = (cur > 0 && prev > 0) ? prev - cur : (cur > 0 && prev === 0) ? 100 : (cur === 0 && prev > 0) ? -100 : null;
    return { ...it, current: cur, previous: prev, delta, url: it.result.url || '' }; }).sort((a, b) => a.rung - b.rung || a.page_no - b.page_no);
  const head = rowsK.find(r => r.rung === 4) || rowsK[0];
  const rungs = [1, 2, 3].map(r => { const ps = rowsK.filter(x => x.rung === r); return { rung: r, pages: ps.length, top10: ps.filter(x => x.current > 0 && x.current <= 10).length, top3: ps.filter(x => x.current > 0 && x.current <= 3).length, reached: ps.length > 0 && ps.every(x => x.current > 0 && x.current <= 10) }; }).filter(r => r.pages);
  const drops = rowsK.filter(r => r.delta != null && r.delta <= -5).map(r => r.keyword + ' (' + posText(r.previous) + ' → ' + posText(r.current) + ')');
  const gains = rowsK.filter(r => r.delta != null && r.delta >= 5).map(r => r.keyword + ' (' + posText(r.previous) + ' → ' + posText(r.current) + ')');
  const topTop3Before = history.filter(x => x.ladder_id === id && x.keyword === head.keyword && String(x.checked_at) < nowCheck && Number(x.position) > 0 && Number(x.position) <= 3).length;
  const done = head.current > 0 && head.current <= 3 && topTop3Before >= 3;
  const rowOf = (kw) => ladderRows.find(l => l.ladder_id === id && l.keyword === kw) || {};
  const logOf = (kw) => pubLog.filter(l => normK(l.keyword) === normK(kw) && (!l.ladder_id || l.ladder_id === id) && (!l.domain || normD(l.domain) === normD(head.domain))).sort((a, b) => String(a.published_at || '').localeCompare(String(b.published_at || '')))[0] || null;
  // 2026-10-11 (FIX_PLAN D16): the next step follows the ladder's state, not only the rungs — live, a main-page-only ladder read "every rung is in
  // the top 10" and a Direct plan was told to work on rung 1 while its main page waited to be published.
  //   main page: planned -> write it; written ('writing') but not live -> publish it (with the page's URL); live = row 'published', a content-log
  //   row, an existing page, or ranking. Direct plan (the main page is page 1) and main-page-only ladders: the main page comes first, the rungs
  //   only once it is live (the Content Cadence's gate). Short / full plans: rungs first; "every rung is in the top 10" only when rungs exist
  //   and are all in — then the main page is written, published or improved by its state.
  const isTop = (r) => r.rung === 4;
  const topRow = rowsK.find(isTop) || null;
  const invModel = pageRows.length ? modelFor(head.domain) : null;
  const ukeyT = (u) => String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/$/, '');
  // D11: the live page that already answers this keyword (never the ladder's own planned URL)
  const coveredBy = (r) => { if (!invModel) return null; const m = SM.matchPage(invModel, r.keyword); return (m && ukeyT(m.url) !== ukeyT(r.target_url)) ? m : null; };
  const liveOf = (r) => { const lr = rowOf(r.keyword); return r.status === 'published' || !!logOf(r.keyword) || lr.page_exists === true || lr.page_exists === 'true' || r.current > 0 || !!coveredBy(r); };
  const mainLive = !!topRow && liveOf(topRow), mainWritten = !!topRow && (mainLive || topRow.status === 'writing');
  const mainFirst = !!topRow && (Number(topRow.page_no) === 1 || !rungs.length);
  const allIn = rungs.length > 0 && rungs.every(r => r.reached);
  const pending = rungs.find(r => !r.reached) || null;
  const pageOf = (t) => ({ keyword: t.keyword, page_type: t.page_type, target_url: t.target_url, status: t.status });
  let next;
  if (done) next = { action: 'complete', rung: 4, text: 'The top rung "' + head.keyword + '" has held the top 3 for 4 checks. From now on it is checked once a month with the published pages, so a drop is noticed; keep the pages fresh and the links growing.', pages: [] };
  else if (topRow && !mainWritten && (mainFirst || allIn)) next = { action: 'write_top', rung: 4, main_page: 'planned',
    text: (mainFirst ? (rungs.length ? 'This plan writes the main page first: ' : 'The main page is the whole ladder for now: ') : 'Every rung is in the top 10: ') + 'write the main page "' + head.keyword + '"' + (rungs.length && mainFirst ? '; its supporting pages follow once it is live' : '') + '.', pages: [pageOf(topRow)] };
  else if (topRow && mainWritten && !mainLive && (mainFirst || allIn)) next = { action: 'publish_top', rung: 4, main_page: 'written', publish_url: topRow.target_url || '',
    text: 'The main page "' + head.keyword + '" is written but not live yet: publish it' + (topRow.target_url ? ' at ' + topRow.target_url : '') + '. Nothing climbs until it is published' + (rungs.length && mainFirst ? ', and its supporting pages wait for it' : '') + '.', pages: [] };
  else if (pending) {
    const target = rowsK.filter(x => x.rung === pending.rung);
    next = { action: 'write_rung_' + pending.rung, rung: pending.rung, main_page: mainLive ? 'live' : mainWritten ? 'written' : 'planned',
      text: 'Work on rung ' + pending.rung + ': ' + (pending.top10 ? pending.top10 + ' of ' + pending.pages + ' pages are in the top 10. ' : 'none of its pages is in the top 10 yet. ') + 'Write or improve: ' + target.map(t => { const c = coveredBy(t);
        return '"' + t.keyword + '"' + (c ? ' (' + c.url + ' already answers this search — refresh that page, do not publish a second one)' : t.status === 'writing' ? ' (already written — publish it)' : ''); }).join(', ') + '.',
      pages: target.map(t => { const c = coveredBy(t); return c ? { ...pageOf(t), status: 'improve', target_url: c.url, covered_by: c.url } : pageOf(t); }) };
  } else { const cTop = topRow ? coveredBy(topRow) : null;   // D11: the page that answers the main keyword may be one the site already had
    next = { action: 'improve_top', rung: 4, main_page: 'live',
      text: (allIn ? 'Every rung is in the top 10 and the main page is live' : 'The main page is live') + ': improve the main page "' + head.keyword + '"' + (cTop ? ' — it is ' + cTop.url + ', the page the site already has for this search' : '') + ' (depth, internal links from the rung pages, links from other sites) and keep it fresh.',
      pages: topRow ? [cTop ? { ...pageOf(topRow), status: 'improve', target_url: cTop.url, covered_by: cTop.url } : pageOf(topRow)] : [] }; }
  // won: the main keyword in the top 3 in each of the last 4 checks, this one included (failed checks skipped)
  const histOf = (kw) => history.filter(x => x.ladder_id === id && x.keyword === kw && String(x.checked_at) < nowCheck && validPos(x.position)).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)));
  const headChecks = [...(!head.deferred && validPos(head.result.position) ? [{ position: Number(head.result.position), checked_at: nowCheck }] : []), ...histOf(head.keyword)].slice(0, FLAGS.won_checks);
  const won = rowsK.some(r => r.rung === 4) && headChecks.length >= FLAGS.won_checks && headChecks.every(h => Number(h.position) >= 1 && Number(h.position) <= FLAGS.won_position);
  // stuck: pages published, the first one 8+ weeks ago, and none of them improved its position over the last 8 weeks
  const nowMs = new Date(nowCheck).getTime(), cutoff = nowMs - FLAGS.stuck_weeks * 7 * 864e5;
  const pubRows = rowsK.filter(r => r.status === 'published' || !!logOf(r.keyword));
  const pubDates = pubRows.map(r => { const l = logOf(r.keyword), lr = rowOf(r.keyword); const d = (l && (l.published_at || l.started_at)) || ((lr.page_exists === true || lr.page_exists === 'true') ? lr.start_date : ''); const t = d ? new Date(d).getTime() : NaN; return Number.isFinite(t) ? t : null; }).filter(t => t != null);
  const firstPub = pubDates.length ? Math.min(...pubDates) : null;
  const improved = pubRows.some(r => { const hs = histOf(r.keyword); const cur = (!r.deferred && validPos(r.result.position)) ? Number(r.result.position) : (hs[0] ? Number(hs[0].position) : null); if (cur == null) return false;
    const base = hs.find(h => new Date(h.checked_at).getTime() <= cutoff) || hs[hs.length - 1]; if (!base) return false; const b = Number(base.position);
    return cur > 0 && (b === 0 || cur < b); });
  const stuck = !won && pubRows.length > 0 && firstPub != null && firstPub <= cutoff && !improved;
  // 2026-10-11 (FIX_PLAN D9): pages are written without links to their unpublished siblings, so when one goes live the owner has to add the
  // link. One reminder line per ladder, only for the pages that went live since the previous check, with the anchor words to use.
  const lastCheck = history.filter(x => x.ladder_id === id && String(x.checked_at) < nowCheck).map(x => String(x.checked_at)).sort().pop() || '';
  const links_to_add = lastCheck ? rowsK.map(r => { const l = logOf(r.keyword); const at = l ? String(l.published_at || l.started_at || '') : ''; return (at && at > lastCheck && l.published_url) ? { keyword: r.keyword, url: l.published_url, anchor: anchorText({ title: l.title, keyword: r.keyword, url: l.published_url }), rung: r.rung } : null; }).filter(Boolean) : [];
  const remindHtml = links_to_add.length ? '<p><b>Now live — add the links:</b> ' + links_to_add.map(x => '"' + esc(x.anchor) + '" (' + esc(x.url) + ')').join(', ') + '. ' +
    'Each of these pages was published since the last check, so the other ladder pages do not link to it yet: add one link from ' + (links_to_add.some(x => x.rung !== 4) ? 'the main page "' + esc(head.head_keyword) + '"' : 'the pages that cover the same topic') + ' using the anchor shown.</p>' : '';
  const firstPending = (next.pages || []).find(p => p.status !== 'writing') || (next.pages || [])[0];
  const apiBody = firstPending ? { mode: 'keyword', keyword: firstPending.keyword, page_type: firstPending.page_type || 'Service Page', country: head.country || '', domain: head.domain, existing_page_url: (next.action === 'improve_top' || firstPending.covered_by) ? (firstPending.target_url || '') : '', email: head.email, ladder_id: id, ladder_rung: next.rung, ladder_head: head.head_keyword, force_content: true } : null;   // D11: a covered keyword is written as a refresh of the page that exists
  const formLink = FORM_URL + '?' + encodeURIComponent('What do you want?') + '=' + encodeURIComponent('I know my keyword');
  const table = '<table style="border-collapse:collapse;font-size:13px"><tr><th align="left" ' + td + '>Rung</th><th align="left" ' + td + '>Keyword</th><th ' + td + '>Now</th><th ' + td + '>Before</th><th align="left" ' + td + '>Ranking URL</th></tr>' +
    rowsK.map(r => '<tr><td ' + td + '>' + (r.rung === 4 ? 'Top' : r.rung) + '</td><td ' + td + '>' + esc(r.keyword) + (r.deferred ? ' <span style="color:#64748b;font-size:11px">(not published yet: checked monthly, last ' + esc(String(r.last_checked || '').slice(0, 10)) + ')</span>' : '') + '</td><td align="center" ' + td + '>' + esc(posText(r.current)) + '</td><td align="center" ' + td + '>' + (r.previous == null ? 'first check' : esc(posText(r.previous))) + '</td><td ' + td + '>' + esc(r.url || '—') + '</td></tr>').join('') + '</table>';
  const subject = '[Keyword ladder] ' + head.head_keyword + ' — ' + head.domain + ': ' + (head.current > 0 ? 'top page at #' + head.current : 'top page not yet in the top 100') + (drops.length ? ' · ' + drops.length + ' drop(s)' : '');
  const html = '<p>Hi,</p><p>Position check for your keyword ladder towards <b>' + esc(head.head_keyword) + '</b> on <b>' + esc(head.domain) + '</b> (' + rowsK.length + ' keywords, Google top 50).</p>' + table +
    '<p><b>Rungs:</b> ' + (rungs.map(r => 'Rung ' + r.rung + ': ' + r.top10 + '/' + r.pages + ' in top 10, ' + r.top3 + ' in top 3' + (r.reached ? ' ✓ reached' : '')).join(' · ') || 'no rung pages tracked') + '</p>' +
    (gains.length ? '<p style="color:#15803d"><b>Gains:</b> ' + esc(gains.join('; ')) + '</p>' : '') + (drops.length ? '<p style="color:#b91c1c"><b>Drops to look at:</b> ' + esc(drops.join('; ')) + '</p>' : '') +
    remindHtml + '<p><b>Next step:</b> ' + esc(next.text) + '</p>' + (next.publish_url ? '<p>Page to publish: <a href="' + esc(next.publish_url) + '">' + esc(next.publish_url) + '</a></p>' : '') +
    (apiBody ? '<p>Start the next page: open the <a href="' + formLink + '">SEO Assistant form</a> ("I know my keyword", keyword <b>' + esc(apiBody.keyword) + '</b>, domain ' + esc(head.domain) + '), or send this to the API (' + esc(API_URL) + '):</p><pre style="background:#f1f5f9;padding:8px;font-size:12px">' + esc(JSON.stringify(apiBody, null, 2)) + '</pre>' : '') +
    '<p style="color:#64748b;font-size:12px">Checks run weekly; once the top page holds the top 3 for four checks, the main keyword and the published pages are checked monthly. Positions come from DataForSEO live SERPs.</p>';
  out.push({ json: { ladder_id: id, domain: head.domain, head_keyword: head.head_keyword, email: head.email || '', callback_url: head.callback_url || '', request_id: head.request_id || '',
    subject, html, status: 'progress', stage: 'rank_tracker', checked_at: nowCheck,
    positions: rowsK.map(r => ({ rung: r.rung, keyword: r.keyword, position: r.current, previous: r.previous, delta: r.delta, url: r.url })), rungs, gains, drops, next_step: next, links_to_add, api_body: apiBody, done, won, stuck } });
}
return out.length ? out : [{ json: { nothing_to_do: true } }];
