// CQ9 (client reports 2026-11-16, integration of the engine and app branches of issue 1). The app now marks an AI question's target `writing`
// when a person starts its page in the app: request_id = the engine's request id of that run (the n8n execution id, digits only, never cad_...),
// reason_code `writing` with reason_args.date. The engine's readers of that row must settle it from the content log like a cadence row:
//   - AI Target Settle (both cadence branches) and AI Growth: an app run's id matches its content-log row whether the row holds it as text or as
//     a number (published -> written / live; failed -> queued)
//   - AI Growth: a row the app marked without written_at is timed from reason_args.date (updated_at is rewritten by AI Growth every week, so
//     before this the row could never be queued again when its run never produced a page); a fresh one stays `writing`
//   - the Content Cadence never picks a question that is `writing` (only `queued` targets are candidates), so the app's page is not written twice
// Synthetic data in the shapes production holds; no personal data.
const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const day = (n) => new Date(Date.now() - n * 864e5).toISOString();
  const D = 'https://devaicon.com';

  await guard('CQ9 app-started AI pages settle', async () => {
    reset(); const SN = 'CQ9 (integration 2026-11-16) a target the app marked writing (numeric request id) settles from the content log and is never left writing for ever'; begin(SN); const check = mkCheck(SN);
    const SID = 'site_devaicon-com', DOM = 'devaicon.com';
    // ---- AI Target Settle (the cadence, both branches): the app run's id as text on the target, as a number on the log row ----
    const tg = (id, rid) => ({ json: { target_id: id, site_id: SID, domain: DOM, question: 'q', keyword: 'k ' + id, status: 'writing', request_id: rid, written_at: '', reason_code: 'writing', reason_args: J({ date: day(2).slice(0, 10) }) } });
    mock('Load AI Targets Writing (Cadence)', [tg('ait_pub', '13659'), tg('ait_fail', '13700'), tg('ait_wait', '13800')]);
    mock('Load Content Log', [
      { json: { site_id: SID, domain: DOM, keyword: 'k ait_pub', source: 'ai_answer', request_id: 13659, status: 'published', published_url: D + '/insights/q', published_at: day(1), started_at: day(2) } },
      { json: { site_id: SID, domain: DOM, keyword: 'k ait_fail', source: 'ai_answer', request_id: 13700, status: 'failed', started_at: day(2) } },
      { json: { site_id: SID, domain: DOM, keyword: 'k ait_wait', source: 'ai_answer', request_id: '13800', status: 'started', started_at: day(0) } }]);
    mock('Cadence Plan', [{ json: { nothing_to_do: true, report_only: true, site_id: SID, domain: DOM } }]);
    for (const node of ['AI Target Settle', 'AI Target Settle (Idle)']) {
      const out = (await run(node, [{ json: {} }])).map(i => i.json); const by = (id) => out.find(o => o.target_id === id) || {};
      console.log('   ' + node + ' ->', J(out.map(o => [o.target_id, o.status, o.reason_code, o.request_id])));
      check(node + ': the app run\'s page published -> written (live, its address), its run failed -> queued, still running -> left writing',
        by('ait_pub').status === 'written' && by('ait_pub').reason_code === 'live' && by('ait_pub').request_id === '13659' && /\/insights\/q/.test(by('ait_pub').reason_args)
        && by('ait_fail').status === 'queued' && by('ait_fail').reason_code === 'run_failed' && !out.some(o => o.target_id === 'ait_wait'), J(out));
    }

    // ---- AI Growth: the weekly read of the same rows ----
    const SVC = ['AI automation services', 'Agentic AI development', 'Custom software development'];
    const gap = (pid, prompt, topic, kind) => ({ prompt_id: pid, prompt, kind: kind || 'recommend', topic, competitors: ['rival-ai.example'], sources: [], volume: 40, stage: 'decision', cluster: topic, fanout: [], cited_urls: [], engines: { chatgpt: 'absent' } });
    const G = [gap('q_dubai', 'Which companies offer the best AI automation services for businesses in Dubai?', 'ai automation services'),
      gap('q_govern', 'Governed agentic AI vs fully autonomous AI agents: which is safer for a UAE company?', 'agentic ai development in uae', 'compare'),
      gap('q_failed', 'How much does AI automation cost for a mid-sized company in the UAE?', 'ai automation services', 'cost')];
    const P = [['q_dubai', 'best ai automation services dubai', 'ai automation services'], ['q_govern', 'governed vs autonomous ai agents', 'agentic ai development in uae'], ['q_failed', 'ai automation cost uae', 'ai automation services']]
      .map(([prompt_id, keyword, topic]) => ({ json: { site_id: SID, status: 'active', prompt_id, prompt: G.find(g => g.prompt_id === prompt_id).prompt, keyword, topic, focus_topic: topic, focus_source: 'client', focus_state: 'active', kind: 'recommend' } }));
    const tid = (pid) => 'ait_devaicon-com_' + pid;
    const appRow = (pid, keyword, rid, startedDays) => ({ target_id: tid(pid), site_id: SID, domain: DOM, prompt_id: pid, keyword, kind: 'answer', status: 'writing', request_id: rid,
      written_at: '', updated_at: day(1), created_at: day(40), reason: 'A page for this question is being written (started ' + day(startedDays).slice(0, 10) + ').', reason_code: 'writing', reason_args: J({ date: day(startedDays).slice(0, 10) }) });
    const TGT = [appRow('q_govern', 'governed vs autonomous ai agents', '13659', 3), appRow('q_failed', 'ai automation cost uae', '13700', 20), appRow('q_dubai', 'best ai automation services dubai', '13800', 2)];
    const LOG = [{ site_id: SID, domain: DOM, keyword: 'governed vs autonomous ai agents', source: 'ai_answer', request_id: 13659, status: 'published', published_url: D + '/insights/governed-vs-autonomous-ai-agents', published_at: day(1), started_at: day(3) }];
    reset();
    mock('Load Sites', [{ json: { site_id: SID, domain: DOM, country: 'United Arab Emirates', location_code: 2784, language_code: 'en', email: '', callback_url: 'https://hooks.example.com/cb', status: 'active', canonical_host: DOM, declared_services: J(SVC), services_json: J(SVC) } }]);
    mock('Load Ladders', [{ json: {} }]); mock('Load Monitors', [{ json: { site_id: SID, domain: DOM, ai_visibility: true, ai_growth: true } }]); mock('Load Profiles', [{ json: {} }]); mock('Load Cycles', [{ json: {} }]);
    mock('Load AI Visibility', [{ json: { site_id: SID, domain: DOM, run_id: 'ai_cq9', checked_at: day(1), gaps_json: J(G), pages_json: '[]', competitors_json: J([{ domain: 'rival-ai.example', mentions: 3, auto: true }]) } }]);
    mock('Load AI Prompts', P); mock('Load Content Log', LOG.map(j => ({ json: j }))); mock('Load Query History', [{ json: {} }]); mock('Load AI Pages', [{ json: {} }]);
    mock('Load AI Targets', TGT.map(j => ({ json: j }))); mock('Load AI Growth', [{ json: {} }]); mock('Load AI Answers', [{ json: {} }]); mock('Load Cache (Growth)', [{ json: {} }]); mock('Load Link Prospects (Growth)', [{ json: {} }]);
    mock('Load Pages (Growth)', [{ json: {} }]);
    const GP = (await run('Growth Plan', store['Load Cache (Growth)']))[0].json;
    const t = (pid) => (GP.targets || []).find(x => x.prompt_id === pid) || {};
    console.log('   targets ->', J((GP.targets || []).map(x => [x.prompt_id, x.status, x.reason_code, x.request_id])));
    check('AI Growth: an app run whose page is published (its id a number on the log row) -> written, code live, the run id kept', t('q_govern').status === 'written' && t('q_govern').reason_code === 'live' && t('q_govern').request_id === '13659', J(t('q_govern')));
    check('AI Growth: an app mark with no written_at, started 20 days ago and no page on record -> queued again (run_failed), not "being written" for ever', t('q_failed').status === 'queued' && t('q_failed').reason_code === 'run_failed', J(t('q_failed')));
    check('AI Growth: an app mark started 2 days ago stays writing (not queued for a second page while its run may still write it)', t('q_dubai').status === 'writing' && t('q_dubai').request_id === '13800', J(t('q_dubai')));
  });
};
