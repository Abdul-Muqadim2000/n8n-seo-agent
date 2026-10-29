// Index coverage: the callback `index_coverage` (DESIGN §5) per website - sent on Mondays (the engine's own calendar), the same day when a page
// dropped out of Google or a Google update started or finished (or its spam-policies page changed), and always to an on-demand caller. Quiet
// days send nothing: the app reads the tables. Free: the run ledger settles $0 and the callback carries `cost: { usd: 0 }`.
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const S = (v) => String(v == null ? '' : v).trim();
const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const grab = (n) => { try { return $(n).all().map(i => i.json); } catch (e) { return []; } };
const diag = grab('Index Diagnose').filter(x => x && x.site_id);
const runs = grab('Index Run Rows').filter(x => x && x.site_id);
const g = grab('Google Events')[0] || {};
const impactNew = grab('Update Impact Rows').filter(x => x && x.site_id);
const impactOld = grab('Load Update Impact').filter(x => x && x.site_id && !x.error);
const events = (g.events || []).filter(e => e.source === 'status_dashboard' ? (e.kind === 'core' || e.kind === 'spam') : true).slice(0, 6)
  .map(e => ({ title: S(e.title), kind: S(e.kind), status: S(e.status), started_at: S(e.started_at), ended_at: S(e.ended_at) }));
const out = [];
for (const d of diag) {
  const run = runs.find(r => r.site_id === d.site_id) || {};
  const newsToday = n0(d.news_today) > 0;
  const send = d.on_demand || d.monday || (d.dropped || []).length > 0 || newsToday;
  if (!send || !S(d.callback_url)) continue;
  const sum = IX.summarize(d.all || [], { backlog_left: run.backlog_left });
  const imp = impactNew.filter(x => x.site_id === d.site_id).concat(impactOld.filter(x => x.site_id === d.site_id))
    .sort((a, b) => S(b.after_to).localeCompare(S(a.after_to)) || S(b.compared_at).localeCompare(S(a.compared_at)))[0] || null;
  const fr = d.freeze || {};
  const summary = { known: sum.known, indexed: sum.indexed, not_indexed: sum.not_indexed, excluded: sum.excluded, unknown: sum.unknown, backlog_left: sum.unknown,
    new_pages: sum.new_pages, new_indexed: sum.new_indexed, by_action: sum.by_action, by_cause: sum.by_cause, dropped: (d.dropped || []).slice(0, IX.CFG.dropped_max),
    freeze: !!fr.freeze, freeze_reason: S(fr.reason), events,
    impact: imp ? { event_title: S(imp.event_title), dropped: n0(imp.dropped), stable: n0(imp.stable), gained: n0(imp.gained) } : { event_title: '', dropped: 0, stable: 0, gained: 0 } };
  const md = IX.reportMarkdown({ domain: d.domain }, { ...sum, should_index: sum.should_index }, { ...run, quota_cap: d.cap }, { rows: d.all || [], dropped: d.dropped || [], events, freeze: fr, impact: imp, failed: !!d.failed, why: S(d.why) });   // E14: a site not checked says so, never "0 of 0"
  out.push({ json: { stage: 'index_coverage', status: 'complete', domain: S(d.domain), site_id: d.site_id, request_id: S(d.request_id), summary, report_markdown: md,
    cost: { usd: 0 }, callback_url: S(d.callback_url) } });
}
return out.length ? out : [{ json: { skip: true, reason: 'nothing to send today' } }];
