// ---- F-A1 / A-21 (2026-10-17, re-rating execs 770 / 771): the same keyword, read twice, says that it was read twice ----
// The ladder run scored "it consulting dubai" 52 with "No AI Overview was seen in the check at 16:09 UTC"; the page run it spawned three
// minutes later read the same results page again and scored it 48 with "An AI Overview was seen in the check at 16:12 UTC" - and neither
// report mentioned the other. A results page does change between readings, so the second reading is not wrong; what was wrong is two
// numbers for one keyword with no word between them. *Spawn Page Runs* now hands the main page's run what the ladder measured
// (`ladder_measure`: score, check time, AI Overview, features) and this block, inlined into *Parse Verdict*, says that this run
// re-measured, when each reading was taken, what the results page showed differently, and that the page is written against the newer one.
const LM21 = (prev.ladder_measure && typeof prev.ladder_measure === 'object') ? prev.ladder_measure : null;
let ladder_remeasure = null;
if (LM21 && String(LM21.keyword || '').toLowerCase().trim() === String(prev.keyword || '').toLowerCase().trim() && !EV56.withheld) {
  const sfR = prev.serp_features || {};
  const clock = (t) => { const m = String(t || '').match(/T(\d\d:\d\d)/); return m ? m[1] + ' UTC' : 'an earlier time'; };
  const nowAt = String(sfR.checked_at || ((sfR.ai_overview || {}).seen_at) || '');
  const nowAio = ((sfR.ai_overview || {}).present) === true, thenAio = LM21.ai_overview === true;
  const nowScore = verdict.score ?? null, thenScore = (LM21.score === '' || LM21.score == null) ? null : Number(LM21.score);
  const featsNow = (Array.isArray(sfR.features_present) ? sfR.features_present : []).map(String).filter(f => f !== 'ai_overview');
  const featsThen = (Array.isArray(LM21.features) ? LM21.features : []).map(String).filter(f => f !== 'ai_overview');
  const changed = [];
  // F-SERP (2026-10-20): a reading taken on the lighter last attempt did not ask for the AI Overview, so it saw neither one nor its
  // absence. An unread side is never compared: "no AI Overview this time" would be a claim nobody measured.
  const nowAioRead = ((sfR.ai_overview || {}).present) != null, thenAioRead = LM21.ai_overview_read !== false;
  const aioUnread = !nowAioRead || !thenAioRead
    ? 'whether an AI Overview appears was not read in ' + (!nowAioRead && !thenAioRead ? 'either reading' : !nowAioRead ? 'this reading' : 'the plan\'s reading') + ', so it is not compared. ' : '';
  if (nowAioRead && thenAioRead && thenAio !== nowAio) changed.push(nowAio ? 'an AI Overview was seen this time, and none in the plan\'s reading' : 'no AI Overview was seen this time, while the plan\'s reading had one');
  const added = featsNow.filter(f => !featsThen.includes(f)), gone = featsThen.filter(f => !featsNow.includes(f));
  if (added.length) changed.push('new on the page: ' + added.join(', '));
  if (gone.length) changed.push('gone from the page: ' + gone.join(', '));
  const moved = thenScore != null && nowScore != null && Number(nowScore) !== thenScore;
  const text = 'Re-measured: the ladder plan read this results page at ' + clock(LM21.checked_at) + (thenScore != null ? ' and scored this keyword ' + thenScore : '')
    + '; this page run read it again at ' + clock(nowAt) + (nowScore != null ? ' and scores it ' + nowScore : '') + '. '
    + (changed.length ? 'What the results page showed differently: ' + changed.join('; ') + '. '
      : (moved ? 'The results-page features read the same both times, so the difference is the judgement of the competing pages, made again on this reading. ' : ''))
    + (aioUnread ? aioUnread.charAt(0).toUpperCase() + aioUnread.slice(1) : '')
    + 'A results page changes between readings; this page is written against the newer one.';
  ladder_remeasure = { then: { score: thenScore, checked_at: String(LM21.checked_at || ''), ai_overview: thenAioRead ? thenAio : null, features: featsThen },
    now: { score: nowScore, checked_at: nowAt, ai_overview: nowAioRead ? nowAio : null, features: featsNow }, score_moved: moved, changed, text };
  verdict.reasons = [...(Array.isArray(verdict.reasons) ? verdict.reasons : []), text];
}
