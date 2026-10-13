// harness shim (written by build_v4.py section 47): the change test — { weeks, base, now, others, joint, kind } -> the control-group reading and its graded verdict
// ---- change test (G12, 2026-10-13, system review FIX_PLAN.md; CRITERIA_technical_tracking_reporting_ai_links.md 3.4) ----
// "We changed the page and clicks went up" is not a result: seasonality and Google's own updates move every page on a site at once
// (P1: CausalImpact, Brodersen et al. 2015 - measuring a change needs a control or a counterfactual; P2: even the most reliable test
// type SearchPilot publishes wins only about 2 times in 3). The Link Builder already measured a won link against a control group of
// the site's OTHER pages over the same weeks; this kit is that same comparison, lifted out so a PAGE CHANGE can be read the same way.
// The verdicts are graded and deliberately weak: "likely helped" / "possibly helped" / "no clear effect yet" / "too early to tell" /
// "can't tell". Nothing here ever says a change CAUSED anything - a control group narrows the alternatives, it does not prove a cause.
const CT = (() => {
  const LABELS = { likely_helped: 'Likely helped', possibly_helped: 'Possibly helped', no_effect_yet: 'No clear effect yet', too_early: 'Too early to tell', cant_tell: 'Can\'t tell' };
  const MIN_WEEKS = 6;          // a change read before 6 weeks says "too early": Google needs weeks to settle (P2: ~10 weeks per position for a link)
  const MIN_OTHERS = 3;         // fewer than 3 other pages to compare with = no usable control group, so the verdict can only be "possibly"
  const r1 = (n) => Math.round(10 * n) / 10;
  const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
  const S = (v) => String(v == null ? '' : v);
  const NOTES = {
    link: { early: 'read at 6, 10 and 16 weeks after the link went live', no_data: 'the page had no search impressions before or after the link' },
    page: { early: 'read at 6, 10 and 16 weeks after the change', no_data: 'the page had no search impressions before or after the change' },
  };
  const label = (v) => LABELS[v] || S(v);
  /**
   * One change, against the control group of the site's other pages over the same window. Positions: lower is better, so a positive
   * `page_change` means the page moved UP. `others` are the control pages' own moves (before - after), unrounded.
   * o: { weeks, base, now, others, joint, kind, min_weeks, min_others, no_data, early }
   */
  const compare = (o) => {
    const x = o || {}; const kind = NOTES[x.kind] ? x.kind : 'page';
    const minWeeks = x.min_weeks == null ? MIN_WEEKS : x.min_weeks, minOthers = x.min_others == null ? MIN_OTHERS : x.min_others;
    const weeks = Math.max(0, Math.floor(Number(x.weeks) || 0));
    const out = { weeks, base_position: 0, position: 0, page_change: 0, control_change: 0, control_spread: 0, control_pages: 0, effect: 0, verdict: '', verdict_label: '', note: '' };
    if (weeks < minWeeks) { out.verdict = 'too_early'; out.note = S(x.early) || NOTES[kind].early; out.verdict_label = label(out.verdict); return out; }
    const base = x.base == null || x.base === '' ? null : Number(x.base), now = x.now == null || x.now === '' ? null : Number(x.now);
    if (!Number.isFinite(base) || !Number.isFinite(now) || base <= 0 || now <= 0) {
      out.verdict = 'cant_tell'; out.note = S(x.no_data) || NOTES[kind].no_data; out.verdict_label = label(out.verdict); return out; }
    const others = (x.others || []).map(Number).filter(Number.isFinite);
    out.base_position = r1(base); out.position = r1(now); out.page_change = r1(out.base_position - out.position);
    const mid = median(others);
    out.control_change = r1(mid); out.control_spread = r1(median(others.map(d => Math.abs(d - mid)))); out.control_pages = others.length;
    out.effect = r1(out.page_change - out.control_change);
    const joint = Number(x.joint) || 0;
    out.verdict = others.length < minOthers ? (out.effect > 1 ? 'possibly_helped' : 'no_effect_yet')
      : out.effect > Math.max(1, 2 * out.control_spread) && !joint ? 'likely_helped'
      : out.effect > Math.max(0.5, out.control_spread) ? 'possibly_helped' : 'no_effect_yet';
    out.verdict_label = label(out.verdict);
    out.note = (joint ? (kind === 'link' ? 'another link to this page within 4 weeks (credit shared); ' : 'another change to this page within 4 weeks (credit shared); ') : '')
      + (others.length < minOthers ? 'few other pages to compare with; ' : '')
      + 'position ' + out.base_position + ' → ' + out.position + ' vs the site\'s other pages ' + (out.control_change >= 0 ? '+' : '') + out.control_change;
    return out;
  };
  const method = 'Each change is dated and read against a control group: the same page\'s average Google position before and after, minus what the site\'s OTHER pages did over the same weeks. That removes the part of the move that was the season, the market or a Google update. "Likely helped" means the page beat its control group by more than twice the spread of the control group itself and nothing else changed on that page in the same four weeks; "possibly helped" means it beat the control group by less than that; "no clear effect yet" means it did not. A control group narrows the alternatives: it is never proof of cause.';
  const summary = (rows) => { const list = (rows || []); const by = (v) => list.filter(r => r.verdict === v).length;
    return { total: list.length, likely_helped: by('likely_helped'), possibly_helped: by('possibly_helped'), no_effect_yet: by('no_effect_yet'), too_early: by('too_early'), cant_tell: by('cant_tell'),
      read: list.filter(r => !['too_early', 'cant_tell'].includes(r.verdict)).length }; };
  return { compare, label, summary, method, LABELS, NOTES, MIN_WEEKS, MIN_OTHERS, r1, median };
})();
return $input.all().map(i => { const j = i.json || {};
  return { json: { ...CT.compare(j), labels: CT.LABELS, method: CT.method, min_weeks: CT.MIN_WEEKS, min_others: CT.MIN_OTHERS } }; });
