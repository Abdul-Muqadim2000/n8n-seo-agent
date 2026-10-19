// G6 (2026-10-18, AI_VISIBILITY_SPEC.md §10): the daily safety net for a weekly AI visibility run that is split across executions. Each
// execution of such a run starts the next one itself; if that chain breaks (n8n restarted between two executions, a part crashed, the Mac slept
// through a start), the run's state row in seo_cache (`ai_run:<site_id>`) stays `running` and goes silent. Every morning the pulse looks at
// those rows and starts the tracker again for each run silent for 65 minutes or more (the tracker's own time limit is 60) (and at most 6 days old): the tracker asks only the
// questions x engines no earlier execution of that run answered, so nothing is asked — or paid for — twice. Any start of the tracker itself
// (a cycle job of its website, a catch-up replay, an on-demand check) does the same for its sites.
// 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §15): a run started by a website's weekly cycle is resumed AS a run of that cycle (trigger, key, job,
// monthly, due time from its state), so its last execution still settles `cycle:<cycle_key>:ai_visibility` - the dispatcher's done signal.
/*__AI_PANEL__*/
let cache = []; try { cache = $('Load Cache (AI)').all().map(i => i.json).filter(r => r && r.key && String(r.key).indexOf('ai_run:') === 0); } catch (e) {}
const now = new Date().toISOString();
const out = [];
for (const r of cache) {
  const st = AIP.stateOf([r], String(r.key).slice('ai_run:'.length));
  if (!st || AIP.stateVerdict(st, now, '') !== 'resume') continue;
  const cyc = st.cycle && st.cycle.key ? { trigger: 'cycle', cycle_key: st.cycle.key, job: st.cycle.job || 'ai_visibility', monthly: !!st.cycle.monthly, scheduled_for: st.cycle.scheduled_for || '' } : {};
  out.push({ json: { ...cyc, continue_run: st.run_id, site_id: st.site_id || String(r.key).slice('ai_run:'.length), domain: st.domain || '', email: st.email || '', callback_url: st.callback_url || '', request_id: st.request_id || '',
    parent_run_id: String($execution.id), resumed_by: 'ai_pulse', note: 'run ' + st.run_id + ' stopped after part ' + (st.chunk || 1) + ' (' + (st.asked || 0) + ' of ' + (st.total || '?') + ' requests answered, last heard ' + String(st.updated_at || '').slice(0, 16) + ' UTC): started again' } });
}
return out.length ? out.slice(0, 5) : [{ json: { skip: true, reason: 'no AI visibility run is waiting to be resumed' } }];
