// SERP-GOTO (2026-11-08, docs/keyword-intel-2026-11-08/fixes/SERP_GOTO.md, review H2): ONE ops alert when a tracked keyword's position
// could not be told twice in a row because a result Google hid behind a redirect link might be the client's own (Parse Positions -1 with
// `maybe_ours`, Tracker Plan's prev_unread = 1). The row is written to seo_ops_alerts undelivered and due now, so the sweep that follows
// (Load Open Alerts -> Alert Retry Plan, B-A7) sends it in this same run; a third reading is settled as "not found" by Parse Positions.
// Columns are exactly seo_ops_alerts' (OPS_ALERTS_COLS); with nothing to say the item is { skip: true } and the IF passes it by.
const S = (v) => String(v == null ? '' : v).trim();
let plan = [], pos = [];
try { plan = $('Tracker Plan').all().map(i => i.json || {}); } catch (e) { plan = []; }
try { pos = $('Parse Positions').all().map(i => i.json || {}); } catch (e) { pos = []; }
const snapOf = (v) => { try { return typeof v === 'string' ? JSON.parse(v || '{}') : (v || {}); } catch (e) { return {}; } };
const hits = [];
plan.forEach((r, i) => { const p = pos[i] || {}; if (!r || r.skip || String(r.device || 'desktop') === 'mobile') return;
  if (Number(p.position) === -1 && Number(snapOf(p.snapshot_json).mo) > 0 && Number(r.prev_unread) === 1) hits.push({ domain: S(r.domain), keyword: S(r.keyword) }); });
if (!hits.length) return [{ json: { skip: true, reason: 'no keyword was unreadable two weeks in a row' } }];
const now = new Date().toISOString();
const d0 = new Date(); const monday = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate() - ((d0.getUTCDay() + 6) % 7))).toISOString().slice(0, 10);
// re-review N3: one row PER KEYWORD and week, so a second keyword of the same site on the same day is its own alert (the upsert of one shared
// key overwrote the first and was never sent again); a re-run in the same week finds its own row and sends nothing twice
return hits.map(h => ({ json: { alert_key: ('rank-unread|' + h.domain + '|' + h.keyword + '|' + monday).slice(0, 200), workflow: 'SEO Agent — Rank Tracker', node: 'Parse Positions',
  message: ('Rank Tracker: the position of "' + h.keyword + '" (' + h.domain + ') could not be told two weeks in a row, because Google showed a result behind a redirect link with no site we could read and that result may be the client\'s own. From next week the report says "not found among the results we could read" (no drop is claimed). Check the results page by hand, and DataForSEO\'s redirect resolution (docs/keyword-intel-2026-11-08/fixes/SERP_GOTO.md).').slice(0, 1500),
  execution_id: S($execution && $execution.id), execution_url: '', mode: S(($execution && $execution.mode) || 'trigger'), severity: 'high', first_seen_at: now, last_seen_at: now, count: 1,
  channels: 'data_table', notes: 'SERP-GOTO unread positions', attempts: 0, last_attempt_at: '', next_attempt_at: now, attempt_log: '' } }));
