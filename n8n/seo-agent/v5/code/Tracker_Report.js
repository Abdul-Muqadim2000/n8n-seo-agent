// Rank tracker report: per ladder, positions vs the previous check, rungs reached, drops and the recommended next step.
const FORM_URL = '__FORM_URL__', API_URL = '__API_URL__';
const plan = $('Tracker Plan').all().map(i => i.json).filter(p => p && !p.nothing_to_do);
const pos = $('Parse Positions').all().map(i => i.json);
let history = []; try { history = $('Load History').all().map(i => i.json).filter(r => r && r.ladder_id); } catch (e) {}
const nowCheck = pos[0] ? pos[0].checked_at : new Date().toISOString();
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const posText = (v) => v == null || v === 0 ? 'not in top 50' : v < 0 ? 'check failed' : '#' + v;
const td = 'style="padding:4px 8px;border:1px solid #cbd5e1"';
const byLadder = new Map();
plan.forEach((p, i) => { if (!byLadder.has(p.ladder_id)) byLadder.set(p.ladder_id, []); byLadder.get(p.ladder_id).push({ ...p, result: pos[i] || {} }); });
const out = [];
for (const [id, items] of byLadder) {
  const prevOf = (kw) => { const h = history.filter(x => x.ladder_id === id && x.keyword === kw && String(x.checked_at) < nowCheck && Number(x.position) >= 0).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0]; return h ? Number(h.position) : null; };
  const rowsK = items.map(it => { const cur = Number(it.result.position); const prev = prevOf(it.keyword);
    const delta = (cur > 0 && prev > 0) ? prev - cur : (cur > 0 && prev === 0) ? 100 : (cur === 0 && prev > 0) ? -100 : null;
    return { ...it, current: cur, previous: prev, delta, url: it.result.url || '' }; }).sort((a, b) => a.rung - b.rung || a.page_no - b.page_no);
  const head = rowsK.find(r => r.rung === 4) || rowsK[0];
  const rungs = [1, 2, 3].map(r => { const ps = rowsK.filter(x => x.rung === r); return { rung: r, pages: ps.length, top10: ps.filter(x => x.current > 0 && x.current <= 10).length, top3: ps.filter(x => x.current > 0 && x.current <= 3).length, reached: ps.length > 0 && ps.every(x => x.current > 0 && x.current <= 10) }; }).filter(r => r.pages);
  const drops = rowsK.filter(r => r.delta != null && r.delta <= -5).map(r => r.keyword + ' (' + posText(r.previous) + ' → ' + posText(r.current) + ')');
  const gains = rowsK.filter(r => r.delta != null && r.delta >= 5).map(r => r.keyword + ' (' + posText(r.previous) + ' → ' + posText(r.current) + ')');
  const topTop3Before = history.filter(x => x.ladder_id === id && x.keyword === head.keyword && String(x.checked_at) < nowCheck && Number(x.position) > 0 && Number(x.position) <= 3).length;
  const done = head.current > 0 && head.current <= 3 && topTop3Before >= 3;
  let next;
  if (done) next = { action: 'complete', rung: 4, text: 'The top rung "' + head.keyword + '" has held the top 3 for 4 checks. Tracking stops; keep the pages fresh and the links growing.', pages: [] };
  else {
    const pending = rungs.find(r => !r.reached);
    const target = pending ? rowsK.filter(x => x.rung === pending.rung) : [head];
    next = { action: pending ? 'write_rung_' + pending.rung : 'write_top', rung: pending ? pending.rung : 4,
      text: pending ? 'Work on rung ' + pending.rung + ': ' + (pending.top10 ? pending.top10 + ' of ' + pending.pages + ' pages are in the top 10. ' : 'none of its pages is in the top 10 yet. ') + 'Write or improve: ' + target.map(t => '"' + t.keyword + '"' + (t.status === 'writing' ? ' (already written — publish it)' : '')).join(', ') + '.' : 'Every rung is in the top 10: write or improve the top page for "' + head.keyword + '".',
      pages: target.map(t => ({ keyword: t.keyword, page_type: t.page_type, target_url: t.target_url, status: t.status })) };
  }
  const firstPending = (next.pages || []).find(p => p.status !== 'writing') || (next.pages || [])[0];
  const apiBody = firstPending ? { mode: 'keyword', keyword: firstPending.keyword, page_type: firstPending.page_type || 'Service Page', country: head.country || '', domain: head.domain, existing_page_url: '', email: head.email, ladder_id: id, ladder_rung: next.rung, ladder_head: head.head_keyword, force_content: true } : null;
  const formLink = FORM_URL + '?' + encodeURIComponent('What do you want?') + '=' + encodeURIComponent('I know my keyword');
  const table = '<table style="border-collapse:collapse;font-size:13px"><tr><th align="left" ' + td + '>Rung</th><th align="left" ' + td + '>Keyword</th><th ' + td + '>Now</th><th ' + td + '>Before</th><th align="left" ' + td + '>Ranking URL</th></tr>' +
    rowsK.map(r => '<tr><td ' + td + '>' + (r.rung === 4 ? 'Top' : r.rung) + '</td><td ' + td + '>' + esc(r.keyword) + '</td><td align="center" ' + td + '>' + esc(posText(r.current)) + '</td><td align="center" ' + td + '>' + (r.previous == null ? 'first check' : esc(posText(r.previous))) + '</td><td ' + td + '>' + esc(r.url || '—') + '</td></tr>').join('') + '</table>';
  const subject = '[Keyword ladder] ' + head.head_keyword + ' — ' + head.domain + ': ' + (head.current > 0 ? 'top page at #' + head.current : 'top page not yet in the top 100') + (drops.length ? ' · ' + drops.length + ' drop(s)' : '');
  const html = '<p>Hi,</p><p>Position check for your keyword ladder towards <b>' + esc(head.head_keyword) + '</b> on <b>' + esc(head.domain) + '</b> (' + rowsK.length + ' keywords, Google top 50).</p>' + table +
    '<p><b>Rungs:</b> ' + (rungs.map(r => 'Rung ' + r.rung + ': ' + r.top10 + '/' + r.pages + ' in top 10, ' + r.top3 + ' in top 3' + (r.reached ? ' ✓ reached' : '')).join(' · ') || 'no rung pages tracked') + '</p>' +
    (gains.length ? '<p style="color:#15803d"><b>Gains:</b> ' + esc(gains.join('; ')) + '</p>' : '') + (drops.length ? '<p style="color:#b91c1c"><b>Drops to look at:</b> ' + esc(drops.join('; ')) + '</p>' : '') +
    '<p><b>Next step:</b> ' + esc(next.text) + '</p>' +
    (apiBody ? '<p>Start the next page: open the <a href="' + formLink + '">SEO Assistant form</a> ("I know my keyword", keyword <b>' + esc(apiBody.keyword) + '</b>, domain ' + esc(head.domain) + '), or send this to the API (' + esc(API_URL) + '):</p><pre style="background:#f1f5f9;padding:8px;font-size:12px">' + esc(JSON.stringify(apiBody, null, 2)) + '</pre>' : '') +
    '<p style="color:#64748b;font-size:12px">Checks run weekly; tracking stops once the top page holds the top 3 for four checks. Positions come from DataForSEO live SERPs.</p>';
  out.push({ json: { ladder_id: id, domain: head.domain, head_keyword: head.head_keyword, email: head.email || '', callback_url: head.callback_url || '', request_id: head.request_id || '',
    subject, html, status: 'progress', stage: 'rank_tracker', checked_at: nowCheck,
    positions: rowsK.map(r => ({ rung: r.rung, keyword: r.keyword, position: r.current, previous: r.previous, delta: r.delta, url: r.url })), rungs, gains, drops, next_step: next, api_body: apiBody, done } });
}
return out.length ? out : [{ json: { nothing_to_do: true } }];
