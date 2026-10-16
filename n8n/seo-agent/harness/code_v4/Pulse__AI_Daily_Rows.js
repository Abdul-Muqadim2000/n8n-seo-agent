// One seo_ai_daily row per site and reading (exact columns). The weekly AI visibility run adds them to its figures.
// R95 (2026-10-16, re-rating C-19): the upsert key was site + date, so a same-day ON-DEMAND pulse (exec 630, 19:42) replaced that day's SCHEDULED
// reading (exec 593, 11:11) and the week counted the day once, with the later sample. An on-demand reading now gets its own run_id, so it is
// stored beside the scheduled one (upsert by site + date + run_id); a scheduled re-run of the same day still replaces only the scheduled row.
const rows = $('Pulse Metrics').all().map(i => (i.json.daily_row ? { ...i.json.daily_row, run_id: i.json.on_demand ? String(i.json.daily_row.run_id || 'pulse') + '_on_demand_' + $execution.id : i.json.daily_row.run_id } : null)).filter(r => r && r.samples > 0);
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];