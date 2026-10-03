// Rank tracker: one SERP check (Google top 50) per tracked keyword: the primary keyword of every ladder page, plus the head term.
// Reads the ladders and the history from the Data Tables, skips finished ladders and caps the spend per run.
// v4.6 (no repeated checks): live pages, the head term and any keyword the site already ranks for are checked every week; pages not written /
// published yet that do not rank are checked once a month ("do we rank with another page now?") and carried in the report with their last check.
// v4.8: a WON ladder (the main keyword in the top 3 in each of its last 4 checks; failed checks skipped) is no longer dropped: its main keyword
// and its published pages are checked once a month, so a drop is noticed (a drop below the top 3 brings the ladder back to weekly checks).
const LIMITS = { max_keywords_per_ladder: 15, max_checks_per_run: 120, stop_after_top3_checks: 4, unpublished_every_days: 28, won_every_days: 28 };
const daysSince = (iso) => iso ? (Date.now() - new Date(iso).getTime()) / 864e5 : 1e9;
const deferred = [];
const rows = $('Load Ladders').all().map(i => i.json).filter(r => r && r.ladder_id);
let history = []; try { history = $('Load History').all().map(i => i.json).filter(r => r && r.ladder_id); } catch (e) { history = []; }
const byLadder = new Map();
for (const r of rows) { if (!byLadder.has(r.ladder_id)) byLadder.set(r.ladder_id, []); byLadder.get(r.ladder_id).push(r); }
const checks = []; const skipped = [];
for (const [id, pages] of byLadder) {
  const top = pages.find(p => Number(p.rung) === 4) || pages[0];
  const topHist = history.filter(h => h.ladder_id === id && h.keyword === top.keyword && h.position !== '' && h.position != null && Number(h.position) >= 0).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)));   // -1 = failed check: check again
  const last = topHist.slice(0, LIMITS.stop_after_top3_checks);
  const won = last.length >= LIMITS.stop_after_top3_checks && last.every(h => Number(h.position) > 0 && Number(h.position) <= 3);
  if (won && daysSince(last[0].checked_at) < LIMITS.won_every_days) {
    skipped.push({ ladder_id: id, reason: 'won: the top rung has held the top 3 for ' + last.length + ' checks — checked monthly, next after ' + new Date(new Date(last[0].checked_at).getTime() + LIMITS.won_every_days * 864e5).toISOString().slice(0, 10), won: true }); continue;
  }
  const sorted = [...pages].sort((a, b) => Number(a.rung) - Number(b.rung) || Number(a.page_no) - Number(b.page_no)).slice(0, LIMITS.max_keywords_per_ladder);
  for (const p of sorted) {
    if (checks.length >= LIMITS.max_checks_per_run) break;
    const live = Number(p.rung) === 4 || p.status === 'published' || p.page_exists === true || p.page_exists === 'true';
    if (won && !live) continue;   // won ladder, monthly check: the main keyword and the published pages only
    const lastH = history.filter(h => h.ladder_id === id && h.keyword === p.keyword).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)))[0];
    if (!live && lastH && Number(lastH.position) === 0 && daysSince(lastH.checked_at) < LIMITS.unpublished_every_days) {   // only 'not in the top 50' (0); a page that ranks (published but not reported) or a failed check (-1) stays weekly
      deferred.push({ ladder_id: id, domain: p.domain, head_keyword: p.head_keyword, rung: Number(p.rung), page_no: Number(p.page_no), keyword: p.keyword, page_type: p.page_type || '', target_url: p.target_url || '', status: p.status || '', last_position: Number(lastH.position), last_url: lastH.url || '', last_checked: lastH.checked_at }); continue; }
    checks.push({ ladder_id: id, domain: p.domain, head_keyword: p.head_keyword, rung: Number(p.rung), page_no: Number(p.page_no), keyword: p.keyword, page_type: p.page_type || '', target_url: p.target_url || '', status: p.status || '',
      location_code: Number(p.location_code), language_code: p.language_code || 'en', email: p.email || '', callback_url: p.callback_url || '', request_id: p.request_id || '', country: p.country || '', won_monthly: won,
      endpoint: 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced', body: [{ keyword: p.keyword, location_code: Number(p.location_code), language_code: p.language_code || 'en', depth: 50 }] });   // depth 50: ~$0.015 per check (depth 100 measured at $0.028); positions below 50 add little for a ladder
  }
}
if (!checks.length) return [{ json: { nothing_to_do: true, ladders: byLadder.size, skipped, deferred } }];
return checks.map(c => ({ json: { ...c, skipped_ladders: skipped, deferred_pages: deferred } }));
