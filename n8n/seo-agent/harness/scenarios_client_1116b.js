// CA1-CA2 (client report 2026-11-16 second round, devaicon.com "custom ai solutions uae"): the client approved an AI page for the 13 Nov cycle; the
// run had room for 2 pages, took the first two items of its queue (a ladder page and a ladder refresh), held the refresh because another page of the
// week already rewrote its address, wrote ONE ordinary page and left the approval out, and its callback to the app dropped approved_not_written, so the
// app said "Not written in that run." with no reason. The rules now (APPROVALS FIRST, owner 2026-11-16: the client's approvals, earliest first, then
// the ladder pages, then the rest):
//   - a slot freed by the one-page-one-rewrite hold passes to the next item instead of being lost
//   - an approval held by that rule is reported as `same_page` with the address, not as `budget`
//   - the content_cadence callback carries approved_not_written (Cadence Note computed it; the POST body left it out)
// Synthetic data built on the cadence_levels.json fixtures; no personal data.
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, guard, reset, begin } = ctx;
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'cadence_levels.json'), 'utf8'));
  const caseOf = (n) => JSON.parse(J(FX.cases.find(c => c.name === n)));
  const items = (rows) => (rows || []).map(json => ({ json }));
  const RealDate = Date;
  const frozen = async (iso, fn) => { const T = RealDate.parse(iso);
    class FrozenDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(T); } static now() { return T; } }
    global.Date = FrozenDate; try { return await fn(); } finally { global.Date = RealDate; } };
  const planCase = async (c) => { reset(); const t = c.tables || {};
    mock('Manual Run', [{ json: c.trigger || {} }]);
    mock('Load Sites', items(t.sites)); mock('Load Cadence', items(t.cadence)); mock('Load Ladders', items(t.ladders)); mock('Load Query History', items(t.query_history));
    mock('Load Trends', items(t.trends)); mock('Load Content Log', items(t.content_log)); mock('Load Ladder Settings', items(t.ladder_settings)); mock('Load Main Keyword Ranks', items(t.ranks));
    mock('Load AI Targets (Cadence)', items(t.ai_targets)); mock('Load AI Targets Writing (Cadence)', items([])); mock('Load Monitors (Cadence)', items(t.monitors));
    mock('Load Pages (Cadence)', items(t.pages)); mock('Load AI Brands (Cadence)', items(t.ai_brands)); mock('Load Skips (Cadence)', items(t.skips)); mock('Load Cost (Cadence)', items(t.cost));
    mock('Load Cycle Jobs (Cadence)', items(t.cycle_jobs)); mock('Load Profiles (Cadence)', items(t.profiles));
    const out = await frozen(c.now, async () => (await run('Cadence Plan', [{ json: {} }])).map(i => i.json));
    const picks = out.filter(j => !j.nothing_to_do && !j.preview);
    const facts = out.find(j => j.preview) || out.find(j => j.site_id && !j.nothing_to_do) || out.find(j => j.report_only) || out[0] || {};
    return { out, picks, facts }; };
  const ks = (arr) => (arr || []).map(x => x.keyword + ' (' + x.source + ')');

  await guard('CA1 approvals first, a freed slot is refilled, an approval left out says why', async () => {
    reset(); const SN = 'CA1 (client report 2026-11-16 b) approvals first (earliest first), a slot freed by the one-page-one-rewrite hold is refilled, and an approval left out carries its true reason'; begin(SN); const check = mkCheck(SN);
    const X = 'https://techand.ai/crm-implementation/';
    const SQ = 'crm support desk setup uae';
    const striking = (page) => ({ site_id: 'site_techand-ai', domain: 'techand.ai', period_end: '2026-10-18', query: SQ, position: 9, impressions: 400, clicks: 3, page });
    const approve = (item_key, source, created_at) => ({ key: 'site_techand-ai:cyc:site_techand-ai:2026-10-21:' + item_key, site_id: 'site_techand-ai', cycle_key: 'cyc:site_techand-ai:2026-10-21', item_key, decision: 'approve', scope: 'cycle', by: 'owner', created_at, source });
    // the fixture: one ladder page (automatic) and the client's approved decay refresh of /crm-implementation/, 2 pages a week -> both written, the approval first
    const base = await planCase(caseOf('approval_by_source'));
    check('2 pages a week: the approved refresh is written first, then the ladder page', J(ks(base.picks)) === J(['crm implementation partner uae (decay)', 'crm implementation cost uae (ladder)']), J(ks(base.picks)));
    // 1 page a week: the client's approval takes the page; the automatic ladder page waits (an approval never raises pages_per_week)
    const one = caseOf('approval_by_source'); one.tables.cadence[0].pages_per_week = 1;
    const a = await planCase(one);
    check('1 page a week: the approval is written, the ladder page waits, nothing is reported as a lost approval', a.picks.length === 1 && a.picks[0].source === 'decay' && !(a.facts.approved_not_written || []).length, J({ picks: ks(a.picks), anw: a.facts.approved_not_written }));
    // two approvals, 1 page a week: the EARLIEST approval is written whatever the plan's order; the other is reported with the reason budget
    for (const [first, label] of [['striking', 'the striking refresh approved first'], ['decay', 'the decay refresh approved first']]) {
      const two = caseOf('approval_by_source'); two.tables.cadence[0].pages_per_week = 1;
      two.tables.query_history.push(striking('https://techand.ai/support-desk/'));
      two.tables.skips = [approve('crm implementation partner uae', 'decay', first === 'decay' ? '2026-10-19T08:00:00.000Z' : '2026-10-20T09:00:00.000Z'), approve(SQ, 'striking', first === 'striking' ? '2026-10-19T08:00:00.000Z' : '2026-10-20T09:00:00.000Z')];
      const r = await planCase(two);
      const other = first === 'decay' ? SQ : 'crm implementation partner uae';
      check('two approvals, 1 page a week, ' + label + ': it is written, the other is reported "budget"', r.picks.length === 1 && r.picks[0].source === first && J((r.facts.approved_not_written || []).map(x => [x.keyword, x.reason])) === J([[other, 'budget']]), J({ picks: ks(r.picks), anw: r.facts.approved_not_written }));
    }
    // never a silent drop: the approved decay refresh is left out (its page was refreshed 2 days ago) while a striking item of the SAME keyword is
    // suggested; the approval is for the decay refresh, so it is reported (no_longer_offered), not dropped because its keyword is still offered
    const gone = caseOf('approval_by_source');
    gone.tables.content_log = (gone.tables.content_log || []).concat([{ site_id: 'site_techand-ai', domain: 'techand.ai', keyword: 'crm rollout checklist', source: 'manual', status: 'published', request_id: '13001', started_at: '2026-10-19T10:00:00.000Z', existing_page_url: X, published_url: X, published_at: '2026-10-19T12:00:00.000Z' }]);
    const g = await planCase(gone);
    const ng = (g.facts.approved_not_written || []).find(x => x.keyword === 'crm implementation partner uae') || {};
    check('an approved item left out while another item shares its keyword is reported (no_longer_offered), never dropped in silence', !g.picks.some(p => p.keyword === 'crm implementation partner uae') && ng.reason === 'no_longer_offered', J({ picks: ks(g.picks), anw: g.facts.approved_not_written, sug: ks(g.facts.suggestions) }));
    // the ladder page and an approval on the same page: the approval is written, the ladder page waits as a suggestion with the reason
    const same = caseOf('approval_by_source'); same.tables.ladders[0].page_exists = true; same.tables.ladders[0].target_url = X;
    const c0 = await planCase(same);
    const lad = (c0.facts.suggestions || []).find(x => x.keyword === 'crm implementation cost uae') || {};
    check('the ladder page rewrites the approved page: the approval is written, the ladder page waits with the reason', c0.picks.length === 1 && c0.picks[0].source === 'decay' && /already rewrites https:\/\/techand\.ai\/crm-implementation\//.test(String(lad.why || '')) && !(c0.facts.approved_not_written || []).length, J({ picks: ks(c0.picks), lad, anw: c0.facts.approved_not_written }));
    // the 13 Nov shape (no approval in play at level 3): room 2, the second item is held on the first one's page, the third takes the freed slot
    const refill = caseOf('approval_by_source'); refill.tables.ladder_settings[0].autopilot_level = 3;
    refill.tables.ladders[0].page_exists = true; refill.tables.ladders[0].target_url = X;
    refill.tables.query_history.push(striking('https://techand.ai/support-desk/'));
    const c = await planCase(refill);
    const heldS = (c.facts.suggestions || []).find(x => x.keyword === 'crm implementation partner uae') || {};
    check('room 2, the second item held on the first one\'s page: the next item takes the freed slot, so 2 pages are written on 2 addresses', c.picks.length === 2 && c.picks[0].source === 'ladder' && c.picks[1].existing_page_url && c.picks[1].existing_page_url !== X, J({ picks: c.picks.map(p => [p.keyword, p.source, p.existing_page_url]) }));
    check('... and the held item (automatic at level 3) waits as a suggestion with the reason', /already rewrites https:\/\/techand\.ai\/crm-implementation\//.test(String(heldS.why || '')), J(heldS));
    check('... marked not approvable (an approval would not reach it this week), while a needs-OK suggestion is not marked', heldS.not_approvable === true && (base.facts.suggestions || []).concat(a.facts.suggestions || []).every(x => x.keyword === 'crm implementation partner uae' ? true : !x.not_approvable), J({ heldS, sug: (a.facts.suggestions || []).map(x => [x.keyword, x.not_approvable]) }));
  });

  await guard('CA2 the callback carries approved_not_written', async () => {
    reset(); const SN = 'CA2 (client report 2026-11-16 b) the content_cadence callback to the app carries approved_not_written (the run\'s reason for an approval it did not write)'; begin(SN); const check = mkCheck(SN);
    const wf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', 'SEO_Agent_Content_Cadence.json'), 'utf8'));
    const w = Array.isArray(wf) ? wf[0] : wf;
    const post = w.nodes.find(n => n.name === 'POST Cadence Note');
    const body = String(post && post.parameters && post.parameters.jsonBody || '');
    check('POST Cadence Note sends approved_not_written in the content_cadence body', /approved_not_written:\s*\$json\.approved_not_written/.test(body), body.slice(0, 300));
    // and Cadence Note puts it on the item it posts
    mock('Cadence Plan', [{ json: { site_id: 'site_techand-ai', domain: 'techand.ai', email: '', callback_url: 'https://hooks.example.com/cb', keyword: 'k', source: 'ladder', page_type: 'Guide', why: 'w', request_id: 'cad_1', pages_per_week: 1, upcoming: [], pending_publish: [], candidates: 2,
      approved_not_written: [{ keyword: 'custom ai solutions uae', source: 'ai_answer', reason: 'budget' }] } }]);
    let note = null; try { note = (await run('Cadence Note', [{ json: {} }]))[0].json; } catch (e) { note = { error: String(e) }; }
    check('Cadence Note carries the approval and its reason', note && Array.isArray(note.approved_not_written) && note.approved_not_written[0] && note.approved_not_written[0].reason === 'budget', J(note && (note.approved_not_written || note.error)));
  });
};
