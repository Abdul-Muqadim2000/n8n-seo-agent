// Rank tracker report: per ladder, positions vs the previous check, rungs reached, drops and the recommended next step.
const FORM_URL = 'http://localhost:5678/form/54f85234-172e-43e6-a84d-b5ecaa140e7d', API_URL = 'http://localhost:5678/webhook/seo-keyword-check';
const plan = $('Tracker Plan').all().map(i => i.json).filter(p => p && !p.nothing_to_do);
const pos = $('Parse Positions').all().map(i => i.json);
let history = []; try { history = $('Load History').all().map(i => i.json).filter(r => r && r.ladder_id); } catch (e) {}
// v4.8 display-only flags for the app (nothing in the e-mail changes): won / stuck per ladder; published dates from the content log, page facts from the ladder rows
let pubLog = []; try { pubLog = $('Load Content Log (Tracker)').all().map(i => i.json).filter(r => r && r.keyword && r.published_url && !r.error); } catch (e) {}
let ladderRows = []; try { ladderRows = $('Load Ladders').all().map(i => i.json).filter(r => r && r.ladder_id && r.keyword); } catch (e) {}
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
  let next;
  if (done) next = { action: 'complete', rung: 4, text: 'The top rung "' + head.keyword + '" has held the top 3 for 4 checks. From now on it is checked once a month with the published pages, so a drop is noticed; keep the pages fresh and the links growing.', pages: [] };
  else {
    const pending = rungs.find(r => !r.reached);
    const target = pending ? rowsK.filter(x => x.rung === pending.rung) : [head];
    next = { action: pending ? 'write_rung_' + pending.rung : 'write_top', rung: pending ? pending.rung : 4,
      text: pending ? 'Work on rung ' + pending.rung + ': ' + (pending.top10 ? pending.top10 + ' of ' + pending.pages + ' pages are in the top 10. ' : 'none of its pages is in the top 10 yet. ') + 'Write or improve: ' + target.map(t => '"' + t.keyword + '"' + (t.status === 'writing' ? ' (already written — publish it)' : '')).join(', ') + '.' : 'Every rung is in the top 10: write or improve the top page for "' + head.keyword + '".',
      pages: target.map(t => ({ keyword: t.keyword, page_type: t.page_type, target_url: t.target_url, status: t.status })) };
  }
  // won: the main keyword in the top 3 in each of the last 4 checks, this one included (failed checks skipped)
  const histOf = (kw) => history.filter(x => x.ladder_id === id && x.keyword === kw && String(x.checked_at) < nowCheck && validPos(x.position)).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)));
  const headChecks = [...(!head.deferred && validPos(head.result.position) ? [{ position: Number(head.result.position), checked_at: nowCheck }] : []), ...histOf(head.keyword)].slice(0, FLAGS.won_checks);
  const won = rowsK.some(r => r.rung === 4) && headChecks.length >= FLAGS.won_checks && headChecks.every(h => Number(h.position) >= 1 && Number(h.position) <= FLAGS.won_position);
  // stuck: pages published, the first one 8+ weeks ago, and none of them improved its position over the last 8 weeks
  const nowMs = new Date(nowCheck).getTime(), cutoff = nowMs - FLAGS.stuck_weeks * 7 * 864e5;
  const rowOf = (kw) => ladderRows.find(l => l.ladder_id === id && l.keyword === kw) || {};
  const logOf = (kw) => pubLog.filter(l => normK(l.keyword) === normK(kw) && (!l.ladder_id || l.ladder_id === id) && (!l.domain || normD(l.domain) === normD(head.domain))).sort((a, b) => String(a.published_at || '').localeCompare(String(b.published_at || '')))[0] || null;
  const pubRows = rowsK.filter(r => r.status === 'published' || !!logOf(r.keyword));
  const pubDates = pubRows.map(r => { const l = logOf(r.keyword), lr = rowOf(r.keyword); const d = (l && (l.published_at || l.started_at)) || ((lr.page_exists === true || lr.page_exists === 'true') ? lr.start_date : ''); const t = d ? new Date(d).getTime() : NaN; return Number.isFinite(t) ? t : null; }).filter(t => t != null);
  const firstPub = pubDates.length ? Math.min(...pubDates) : null;
  const improved = pubRows.some(r => { const hs = histOf(r.keyword); const cur = (!r.deferred && validPos(r.result.position)) ? Number(r.result.position) : (hs[0] ? Number(hs[0].position) : null); if (cur == null) return false;
    const base = hs.find(h => new Date(h.checked_at).getTime() <= cutoff) || hs[hs.length - 1]; if (!base) return false; const b = Number(base.position);
    return cur > 0 && (b === 0 || cur < b); });
  const stuck = !won && pubRows.length > 0 && firstPub != null && firstPub <= cutoff && !improved;
  const firstPending = (next.pages || []).find(p => p.status !== 'writing') || (next.pages || [])[0];
  const apiBody = firstPending ? { mode: 'keyword', keyword: firstPending.keyword, page_type: firstPending.page_type || 'Service Page', country: head.country || '', domain: head.domain, existing_page_url: '', email: head.email, ladder_id: id, ladder_rung: next.rung, ladder_head: head.head_keyword, force_content: true } : null;
  const formLink = FORM_URL + '?' + encodeURIComponent('What do you want?') + '=' + encodeURIComponent('I know my keyword');
  const table = '<table style="border-collapse:collapse;font-size:13px"><tr><th align="left" ' + td + '>Rung</th><th align="left" ' + td + '>Keyword</th><th ' + td + '>Now</th><th ' + td + '>Before</th><th align="left" ' + td + '>Ranking URL</th></tr>' +
    rowsK.map(r => '<tr><td ' + td + '>' + (r.rung === 4 ? 'Top' : r.rung) + '</td><td ' + td + '>' + esc(r.keyword) + (r.deferred ? ' <span style="color:#64748b;font-size:11px">(not published yet: checked monthly, last ' + esc(String(r.last_checked || '').slice(0, 10)) + ')</span>' : '') + '</td><td align="center" ' + td + '>' + esc(posText(r.current)) + '</td><td align="center" ' + td + '>' + (r.previous == null ? 'first check' : esc(posText(r.previous))) + '</td><td ' + td + '>' + esc(r.url || '—') + '</td></tr>').join('') + '</table>';
  const subject = '[Keyword ladder] ' + head.head_keyword + ' — ' + head.domain + ': ' + (head.current > 0 ? 'top page at #' + head.current : 'top page not yet in the top 100') + (drops.length ? ' · ' + drops.length + ' drop(s)' : '');
  const html = '<p>Hi,</p><p>Position check for your keyword ladder towards <b>' + esc(head.head_keyword) + '</b> on <b>' + esc(head.domain) + '</b> (' + rowsK.length + ' keywords, Google top 50).</p>' + table +
    '<p><b>Rungs:</b> ' + (rungs.map(r => 'Rung ' + r.rung + ': ' + r.top10 + '/' + r.pages + ' in top 10, ' + r.top3 + ' in top 3' + (r.reached ? ' ✓ reached' : '')).join(' · ') || 'no rung pages tracked') + '</p>' +
    (gains.length ? '<p style="color:#15803d"><b>Gains:</b> ' + esc(gains.join('; ')) + '</p>' : '') + (drops.length ? '<p style="color:#b91c1c"><b>Drops to look at:</b> ' + esc(drops.join('; ')) + '</p>' : '') +
    '<p><b>Next step:</b> ' + esc(next.text) + '</p>' +
    (apiBody ? '<p>Start the next page: open the <a href="' + formLink + '">SEO Assistant form</a> ("I know my keyword", keyword <b>' + esc(apiBody.keyword) + '</b>, domain ' + esc(head.domain) + '), or send this to the API (' + esc(API_URL) + '):</p><pre style="background:#f1f5f9;padding:8px;font-size:12px">' + esc(JSON.stringify(apiBody, null, 2)) + '</pre>' : '') +
    '<p style="color:#64748b;font-size:12px">Checks run weekly; once the top page holds the top 3 for four checks, the main keyword and the published pages are checked monthly. Positions come from DataForSEO live SERPs.</p>';
  out.push({ json: { ladder_id: id, domain: head.domain, head_keyword: head.head_keyword, email: head.email || '', callback_url: head.callback_url || '', request_id: head.request_id || '',
    subject, html, status: 'progress', stage: 'rank_tracker', checked_at: nowCheck,
    positions: rowsK.map(r => ({ rung: r.rung, keyword: r.keyword, position: r.current, previous: r.previous, delta: r.delta, url: r.url })), rungs, gains, drops, next_step: next, api_body: apiBody, done, won, stuck } });
}
return out.length ? out : [{ json: { nothing_to_do: true } }];
