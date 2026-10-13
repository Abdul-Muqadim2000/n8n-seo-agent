// ---- re-plan a stuck ladder (G32, 2026-10-13, system review FIX_PLAN.md G32; criterion K13 in CRITERIA_keywords_content.md) ----
// The tracker has flagged a ladder as `stuck` since v4.8 (pages live, the first of them 8+ weeks ago, and not one of them improved its
// position since), but it only said so: the owner was left to work out what to change (K13 scored 4 of 10 — "won / stuck; next rung is
// recommended only"). RP turns that flag into a concrete proposal with the reason and the evidence behind it:
//   improve_page    — a live page already answers the search: improve it instead of writing another one for the same search;
//   easier_keyword  — the next page to write is the easiest supporting keyword, not the hardest one;
//   reorder         — the order is wrong for where the ladder actually is (supporting pages missing under a live main page, or a main
//                     page still missing under live supporting pages);
//   stop            — the honest option: stop this ladder and put the effort somewhere with a better chance.
// **It proposes, it never applies.** No row is rewritten, no page is queued, nothing the owner approved is changed: the proposal goes
// into the report, the callback and the app, where a person accepts or ignores it. `RP.weeks()` is the configurable threshold
// (`seo_monitors.stuck_weeks`, empty = 8, kept between 2 and 26 weeks).
const RP = (() => {
  const CFG = { weeks: 8, min_weeks: 2, max_weeks: 26, close_position: 30, max_options: 4 };
  const S = (v) => String(v == null ? '' : v);
  const num = (v) => (v === '' || v == null || typeof v === 'boolean' || !Number.isFinite(Number(v))) ? null : Number(v);
  const pos = (v) => { const p = num(v); return p != null && p > 0 ? p : null; };   // 0 = not in the top 50, -1 = the check failed
  const posText = (v) => { const p = num(v); return p == null || p < 0 ? 'not checked' : p === 0 ? 'not in the top 50' : '#' + p; };
  /** the configured number of weeks without a gain before a ladder is called stuck (empty / nonsense = 8) */
  const weeks = (v) => { const w = num(v); return w == null ? CFG.weeks : Math.min(CFG.max_weeks, Math.max(CFG.min_weeks, Math.round(w))); };
  /**
   * o: { ladder_id, head_keyword, domain, weeks (weeks since the first page went live), stuck_weeks, won, improved,
   *      head: { keyword, position, base_position, live }, pages: [{ keyword, rung, page_no, status, live, position, base_position,
   *      target_url, covered_by }], later?: [{ keyword, kd, volume }], reach?, checked_at? }
   * -> { stuck, weeks, stuck_weeks, headline, reason, evidence: [], options: [], applied: false, note }
   */
  const propose = (o) => {
    const x = o || {};
    const limit = weeks(x.stuck_weeks);
    const pages = (x.pages || []).filter(p => p && S(p.keyword));
    const live = pages.filter(p => p.live);
    const w = num(x.weeks);
    const head = x.head || {};
    const stuck = !x.won && live.length > 0 && w != null && w >= limit && !x.improved;
    const base = { stuck, weeks: w, stuck_weeks: limit, applied: false, ladder_id: S(x.ladder_id), head_keyword: S(x.head_keyword || head.keyword),
      note: 'This is a proposal, not a change: nothing in your plan was rewritten. Pick one in the app (or ignore it) and the ladder carries on as it is.' };
    if (!stuck) return { ...base, headline: '', reason: x.won ? 'This ladder is won: the main keyword has held the top 3.' : '', evidence: [], options: [] };

    const evidence = [
      live.length + ' page(s) of this ladder are live, the first of them ' + w + ' weeks ago',
      'no page of this ladder has improved its position in the last ' + limit + ' weeks',
      'the main keyword "' + S(x.head_keyword || head.keyword) + '" is ' + posText(head.position) + (pos(head.base_position) ? ' (it was ' + posText(head.base_position) + ' ' + limit + ' weeks ago)' : ''),
    ];
    for (const p of live.slice(0, 6)) evidence.push('"' + p.keyword + '": ' + posText(p.base_position) + ' → ' + posText(p.position));

    const options = [];
    // 1. a live page already answers the search, or a live page of this ladder is close: improve it instead of writing another
    const covered = pages.filter(p => p.covered_by);
    const close = live.filter(p => pos(p.position) && pos(p.position) > 10 && pos(p.position) <= CFG.close_position)
      .sort((a, b) => Number(a.position) - Number(b.position));
    if (covered.length) options.push({ action: 'improve_page', title: 'Improve the page you already have instead of writing another',
      detail: covered.slice(0, 3).map(p => '"' + p.keyword + '" is already answered by ' + p.covered_by).join('; ') + '. Deepen that page (answer the question in the first lines, add the sections the top results have, link to it from your other pages) rather than publishing a second page for the same search, which splits the signals.',
      evidence: covered.slice(0, 3).map(p => '"' + p.keyword + '" → ' + p.covered_by + ' (' + posText(p.position) + ')') });
    else if (close.length) options.push({ action: 'improve_page', title: 'Improve the page that is closest instead of writing a new one',
      detail: 'Your page for "' + close[0].keyword + '" sits at ' + posText(close[0].position) + '. Lifting a page from there is usually cheaper than a new page: depth against the pages above it, internal links from your other ladder pages, and one or two links from other sites.',
      evidence: close.slice(0, 3).map(p => '"' + p.keyword + '" at ' + posText(p.position) + (p.target_url ? ' (' + p.target_url + ')' : '')) });
    // 2. the easiest keyword still unwritten (lowest rung first, then the easiest of the keywords held back)
    const waiting = pages.filter(p => !p.live && Number(p.rung) !== 4).sort((a, b) => (Number(a.rung) || 9) - (Number(b.rung) || 9));
    const later = (x.later || []).filter(k => k && S(k.keyword) && num(k.kd) != null).sort((a, b) => Number(a.kd) - Number(b.kd));
    const easier = waiting[0] || null, easiest = later[0] || null;
    if (easier || (easiest && num(x.reach) != null && Number(easiest.kd) <= Number(x.reach))) {
      const pick = easier ? { keyword: easier.keyword, why: 'rung ' + (Number(easier.rung) || 1) + ', the easiest step still unwritten' }
        : { keyword: easiest.keyword, why: 'difficulty ' + easiest.kd + ', inside your reach of ' + x.reach };
      options.push({ action: 'easier_keyword', title: 'Write the easier supporting keyword next',
        detail: 'Write "' + pick.keyword + '" next (' + pick.why + '). A ladder that stalls usually stalls because the pages that were meant to carry it are not there yet: the easy pages earn the topical ground the harder ones stand on.',
        evidence: [easier ? '"' + easier.keyword + '" is planned but not live' : '"' + easiest.keyword + '" has difficulty ' + easiest.kd + ' against your reach ' + x.reach] });
    }
    // 3. the order is wrong for where the ladder is
    const mainLive = !!(head.live || pages.some(p => Number(p.rung) === 4 && p.live));
    const rungPages = pages.filter(p => Number(p.rung) !== 4);
    const rungLive = rungPages.filter(p => p.live);
    if (mainLive && rungPages.length && rungLive.length < rungPages.length) options.push({ action: 'reorder', title: 'Change the order: finish the supporting pages first',
      detail: 'The main page is live but only ' + rungLive.length + ' of ' + rungPages.length + ' supporting pages are. Publish the rest before working on the main page again — the main page is held up by the pages that should be pointing at it, not by its own text.',
      evidence: rungPages.filter(p => !p.live).slice(0, 4).map(p => '"' + p.keyword + '" (rung ' + (Number(p.rung) || 1) + ') is ' + (p.status === 'writing' ? 'written but not published' : 'not written yet')) });
    else if (!mainLive && rungLive.length) options.push({ action: 'reorder', title: 'Change the order: the main page is the missing piece',
      detail: rungLive.length + ' supporting page(s) are live and nothing is pointing at a main page, because there is none yet. Write and publish the main page for "' + S(x.head_keyword || head.keyword) + '" and link every supporting page up to it.',
      evidence: ['the main page for "' + S(x.head_keyword || head.keyword) + '" is not live', rungLive.length + ' supporting page(s) are live'] });
    // 4. the honest option
    options.push({ action: 'stop', title: 'Stop this ladder and put the effort elsewhere',
      detail: 'After ' + w + ' weeks with no movement, stopping is a real option: pause the ladder in the app and give the weeks to a keyword inside your reach. Nothing is deleted — the pages stay live and keep what they earn, and the ladder can be resumed.',
      evidence: ['no gain in ' + w + ' weeks with ' + live.length + ' page(s) live', 'the main keyword is ' + posText(head.position)] });

    return { ...base,
      headline: 'This ladder has not moved in ' + w + ' weeks — here is what we would change',
      reason: 'Pages are live and the ' + limit + '-week check found no page of this ladder in a better position than it was, so the plan as it stands is not working.',
      evidence, options: options.slice(0, CFG.max_options) };
  };
  /** the block a report prints under a stuck ladder */
  const block = (rp) => { const x = rp || {}; if (!x.stuck || !(x.options || []).length) return '';
    const esc1 = (s) => S(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return '<!--replan--><div style="background:#fffbeb;border-left:4px solid #b45309;padding:8px 12px;margin:8px 0">'
      + '<div style="font-weight:700;font-size:14px">' + esc1(x.headline) + '</div>'
      + '<p style="margin:4px 0;font-size:13px">' + esc1(x.reason) + '</p>'
      + '<ol style="margin:4px 0;padding-left:20px;font-size:13px">'
      + x.options.map(op => '<li style="margin:3px 0"><b>' + esc1(op.title) + '</b> — ' + esc1(op.detail) + '</li>').join('')
      + '</ol>'
      + '<p style="margin:4px 0;font-size:12px;color:#64748b">Why we think so: ' + esc1((x.evidence || []).join('; ')) + '. ' + esc1(x.note) + '</p></div><!--/replan-->';
  };
  return { propose, block, weeks, CFG, WEEKS: CFG.weeks };
})();
