// ---- the pages written and not yet published, and the ladders being written: ONE rule for the Content Cadence and the ladder mode ----
// F-A1 / A-12 (2026-10-17, re-rating exec 770): the ladder mode counted the site's waiting pages its own way (published keywords left
// out, ladder rows ignored) and then wrote a sixth waiting page and started a seventh active ladder while the Content Cadence - the
// owner of both limits (`_site.max_waiting`, `_site.max_active` in seo_ladder_settings) - would have written nothing. Both now ask this
// kit, inlined by the build into *Cadence Plan* (Content Cadence) and *Ladder Plan* (main workflow); the web app mirrors the same rule in
// app/server/src/services/cadence.ts (pile-up) and ladders.ts (focus).
//   waiting(): the Content Cadence's pile-up count, unchanged in meaning (FIX_PLAN D5, R1, R111): a keyword waits when a content-log row
//   of the last `days` says `written` or `not_ready`, or when a ladder row says its page was written (A-20: `writing`, `written` or
//   `not_ready`) and the content log proves it with such a row and no published page. Each keyword counts once; a failed draft
//   (`not_ready`) is labelled `needs_fix`.
//   focus(): which Auto ladders the cadence writes now. The `max_active` highest-priority Auto ladders (status active / queued, main
//   keyword not set aside) that still have a planned page to write are active; the rest wait as Queued. `won` is not judged here (no
//   rank history is read by the ladder mode) - a won ladder with a planned page left is counted, and the result says so in `basis`.
const WAITING = (() => {
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const lc = (v) => String(v == null ? '' : v).toLowerCase().trim();
  const WAITS = new Set(['written', 'not_ready']);
  const LADDER_WRITTEN = new Set(['writing', 'written', 'not_ready']);   // A-20: a ladder row whose page run has started or finished
  const STATUSES = ['active', 'queued', 'paused', 'won', 'stuck', 'archived'];
  const posInt = (v, d, max) => { const n = Number(v); return (v !== '' && v != null && Number.isFinite(n) && n >= 1) ? Math.min(max, Math.floor(n)) : d; };
  const waiting = (o) => {
    const x = o || {}; const now = Number(x.now) || Date.now(); const days = Number(x.days) || 120;
    const log = (x.log || []).filter(r => r && typeof r === 'object'); const ladders = (x.ladders || []).filter(r => r && typeof r === 'object');
    const fresh = (t) => { const v = Date.parse(String(t || '')); return Number.isFinite(v) && (now - v) < days * 864e5; };
    const publishedKw = new Set(log.filter(l => String(l.published_url || '').trim()).map(l => norm(l.keyword)));
    const writtenOf = (k) => log.filter(r => norm(r.keyword) === k && (WAITS.has(r.status) || r.status === 'published' || String(r.published_url || '').trim()))
      .sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))[0] || null;
    const fixOf = (l) => l && l.status === 'not_ready' ? { needs_fix: true, reasons: String(l.qa_reasons || '').split(/;\s+/).filter(Boolean).slice(0, 3) } : {};
    const map = new Map();
    for (const l of log) { if (!WAITS.has(l.status) || !fresh(l.started_at)) continue; const k = norm(l.keyword); if (!k || map.has(k)) continue;
      map.set(k, { keyword: l.keyword, written_at: String(l.started_at || ''), source: String(l.source || ''), ...fixOf(l) }); }
    for (const l of ladders) { if (!LADDER_WRITTEN.has(l.status)) continue; const k = norm(l.keyword); if (!k || map.has(k) || publishedKw.has(k)) continue;
      const lg = writtenOf(k); if (!lg) continue;   // R1: no written log row = the page was never written
      const at = String(lg.started_at || l.start_date || ''); if (!fresh(at)) continue;
      map.set(k, { keyword: l.keyword, written_at: at, source: 'ladder', ...fixOf(lg) }); }
    const list = [...map.values()].sort((a, b) => String(a.written_at).localeCompare(String(b.written_at)));
    return { list, keys: new Set(map.keys()), count: list.length, needs_fix: list.filter(w => w.needs_fix).length };
  };
  // o: { ladders (seo_ladders rows of the site), settings (seo_ladder_settings rows of the site, '_site' included), log, exclude (ladder id),
  //      recent_days } -> { max_active, active: [...], queued: [...], order: [...] } ; each entry { ladder_id, head, priority, mode, open }
  const focus = (o) => {
    const x = o || {}; const now = Number(x.now) || Date.now();
    const settings = (x.settings || []).filter(r => r && r.ladder_id);
    const siteRow = settings.find(r => String(r.ladder_id) === '_site') || {};
    const siteMode = lc(siteRow.mode) === 'manual' ? 'manual' : 'auto';
    const max_active = posInt(siteRow.max_active, 2, 20);
    const settingOf = new Map(settings.filter(r => String(r.ladder_id) !== '_site').map(r => [String(r.ladder_id), r]));
    const recentDays = Number(x.recent_days) || 90;
    const recent = new Set((x.log || []).filter(l => l && (l.status === 'published' || (now - Date.parse(String(l.started_at || 0))) < recentDays * 864e5)).map(l => norm(l.keyword)));
    for (const l of (x.ladders || [])) if (l && (LADDER_WRITTEN.has(l.status) || l.status === 'published')) recent.add(norm(l.keyword));
    const groups = new Map();
    for (const r of (x.ladders || [])) { if (!r || !r.ladder_id || String(r.ladder_id) === String(x.exclude || '')) continue; const id = String(r.ladder_id); if (!groups.has(id)) groups.set(id, []); groups.get(id).push(r); }
    const all = [...groups.entries()].map(([id, rows]) => {
      const st = settingOf.get(id) || null; const top = rows.find(r => Number(r.rung) === 4) || null;
      const mode = st && ['auto', 'manual'].includes(lc(st.mode)) ? lc(st.mode) : siteMode;
      const status = st && STATUSES.includes(lc(st.status)) ? lc(st.status) : 'active';
      const priority = st && Number(st.priority) >= 1 ? Number(st.priority) : Infinity;
      const start = rows.map(r => String(r.start_date || '')).filter(Boolean).sort()[0] || String((st && st.created_at) || '');
      const head_aside = !!top && String(top.status || '') === 'set_aside';
      const open = head_aside ? 0 : rows.filter(r => String(r.status || 'planned') === 'planned' && !recent.has(norm(r.keyword))).length;
      return { ladder_id: id, head: String((top && top.keyword) || rows[0].head_keyword || ''), mode, status, priority, start, open, head_aside };
    }).sort((a, b) => a.priority - b.priority || String(a.start).localeCompare(String(b.start)) || a.ladder_id.localeCompare(b.ladder_id));
    const auto = all.filter(l => l.mode === 'auto' && ['active', 'queued'].includes(l.status) && l.open > 0);
    return { max_active, site_mode: siteMode, order: auto, active: auto.slice(0, max_active), queued: auto.slice(max_active), all,
      basis: 'the Content Cadence\'s rule: Auto ladders with status active or queued that still have a planned page, in priority order; a ladder that has already won its main keyword is not told apart here (no rank history is read on this run)' };
  };
  return { waiting, focus, norm, LADDER_WRITTEN, WAITS };
})();
