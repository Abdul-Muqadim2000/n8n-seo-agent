// CA1-CA2 (client report 2026-11-16 second round, devaicon.com "custom ai solutions uae"): the client approved an AI page for the 13 Nov cycle; the
// run had room for 2 pages, took the first two items of its queue (a ladder page and a ladder refresh), held the refresh because another page of the
// week already rewrote its address, wrote ONE ordinary page and left the approval out, and its callback to the app dropped approved_not_written, so the
// app said "Not written in that run." with no reason. The rules now (the order is unchanged: ladder pages, then approvals, then the rest):
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

  await guard('CA1 a freed slot is refilled, an approval left out says why', async () => {
    reset(); const SN = 'CA1 (client report 2026-11-16 b) a slot freed by the one-page-one-rewrite hold is refilled, and an approval left out carries its true reason'; begin(SN); const check = mkCheck(SN);
    const X = 'https://techand.ai/crm-implementation/';
    // the fixture: one ladder page (automatic) and the client's approved decay refresh of /crm-implementation/, 2 pages a week -> both written
    const base = await planCase(caseOf('approval_by_source'));
    check('fixture as before: 2 pages a week write the ladder page and the approved refresh, in that order', J(ks(base.picks)) === J(['crm implementation cost uae (ladder)', 'crm implementation partner uae (decay)']), J(ks(base.picks)));
    // 1 page a week: the ladder page comes first (the rule of cadence_levels.json approve_outside_budget); the approval is reported with "budget"
    const one = caseOf('approval_by_source'); one.tables.cadence[0].pages_per_week = 1;
    const a = await planCase(one);
    check('1 page a week: the ladder page is written and the approval is reported as not written for the budget', a.picks.length === 1 && a.picks[0].source === 'ladder' && J((a.facts.approved_not_written || []).map(x => [x.keyword, x.reason])) === J([['crm implementation partner uae', 'budget']]), J({ picks: ks(a.picks), anw: a.facts.approved_not_written }));
    // the ladder page rewrites the SAME page as the approved refresh: one page is changed once, the approval says so with the address
    const same = caseOf('approval_by_source'); same.tables.ladders[0].page_exists = true; same.tables.ladders[0].target_url = X;
    const b = await planCase(same);
    const nb = (b.facts.approved_not_written || [])[0] || {};
    check('two picks on one page: the ladder page is written, the approval waits with reason same_page and the address (not "budget")', b.picks.length === 1 && b.picks[0].source === 'ladder' && nb.reason === 'same_page' && nb.detail === X, J({ picks: ks(b.picks), anw: b.facts.approved_not_written }));
    // the 13 Nov shape: room 2, the second item is held on the first one's page, the third takes the freed slot (it was lost before)
    const refill = caseOf('approval_by_source'); refill.tables.ladder_settings[0].autopilot_level = 3;
    refill.tables.ladders[0].page_exists = true; refill.tables.ladders[0].target_url = X;
    refill.tables.query_history.push({ site_id: 'site_techand-ai', domain: 'techand.ai', period_end: '2026-10-18', query: 'crm support desk setup uae', position: 9, impressions: 400, clicks: 3, page: 'https://techand.ai/support-desk/' });
    const c = await planCase(refill);
    const heldS = (c.facts.suggestions || []).find(x => x.keyword === 'crm implementation partner uae') || {};
    check('room 2, the second item held on the first one\'s page: the next item takes the freed slot, so 2 pages are written on 2 addresses', c.picks.length === 2 && c.picks[0].source === 'ladder' && c.picks[1].existing_page_url && c.picks[1].existing_page_url !== X, J({ picks: c.picks.map(p => [p.keyword, p.source, p.existing_page_url]) }));
    check('... and the held item (automatic at level 3) waits as a suggestion with the reason', /already rewrites https:\/\/techand\.ai\/crm-implementation\//.test(String(heldS.why || '')), J(heldS));
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
