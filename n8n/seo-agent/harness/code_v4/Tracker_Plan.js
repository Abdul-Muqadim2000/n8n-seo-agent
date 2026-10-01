// Rank tracker: one SERP check (Google top 50) per tracked keyword: the primary keyword of every ladder page, plus the head term.
// Reads the ladders and the history from the Data Tables, skips finished ladders and caps the spend per run.
const LIMITS = { max_keywords_per_ladder: 15, max_checks_per_run: 120, stop_after_top3_checks: 4 };
const rows = $('Load Ladders').all().map(i => i.json).filter(r => r && r.ladder_id);
let history = []; try { history = $('Load History').all().map(i => i.json).filter(r => r && r.ladder_id); } catch (e) { history = []; }
const byLadder = new Map();
for (const r of rows) { if (!byLadder.has(r.ladder_id)) byLadder.set(r.ladder_id, []); byLadder.get(r.ladder_id).push(r); }
const checks = []; const skipped = [];
for (const [id, pages] of byLadder) {
  const top = pages.find(p => Number(p.rung) === 4) || pages[0];
  const topHist = history.filter(h => h.ladder_id === id && h.keyword === top.keyword).sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)));
  const last = topHist.slice(0, LIMITS.stop_after_top3_checks);
  if (last.length >= LIMITS.stop_after_top3_checks && last.every(h => Number(h.position) > 0 && Number(h.position) <= 3)) {
    skipped.push({ ladder_id: id, reason: 'top rung has held the top 3 for ' + last.length + ' checks — tracking stopped' }); continue;
  }
  const sorted = [...pages].sort((a, b) => Number(a.rung) - Number(b.rung) || Number(a.page_no) - Number(b.page_no)).slice(0, LIMITS.max_keywords_per_ladder);
  for (const p of sorted) {
    if (checks.length >= LIMITS.max_checks_per_run) break;
    checks.push({ ladder_id: id, domain: p.domain, head_keyword: p.head_keyword, rung: Number(p.rung), page_no: Number(p.page_no), keyword: p.keyword, page_type: p.page_type || '', target_url: p.target_url || '', status: p.status || '',
      location_code: Number(p.location_code), language_code: p.language_code || 'en', email: p.email || '', callback_url: p.callback_url || '', request_id: p.request_id || '', country: p.country || '',
      endpoint: 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced', body: [{ keyword: p.keyword, location_code: Number(p.location_code), language_code: p.language_code || 'en', depth: 50 }] });   // depth 50: ~$0.015 per check (depth 100 measured at $0.028); positions below 50 add little for a ladder
  }
}
if (!checks.length) return [{ json: { nothing_to_do: true, ladders: byLadder.size, skipped } }];
return checks.map(c => ({ json: { ...c, skipped_ladders: skipped } }));
