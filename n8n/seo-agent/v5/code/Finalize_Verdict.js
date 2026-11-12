/*__PAGE_FIX__*/
/*__GRADE__*/
/*__COST_CAL__*/
/*__DUP_TARGETS__*/
/*__CRITIC_REREAD__*/
// H3 (2026-10-28, page review): the answer of `POST /webhook/seo-page-finalize` (the app's FinalizeResult, app/shared/src/page-review.ts).
// The final version went through the content gate (*Content QA* + *Originality Check*, the content run's own node code). This node reads its
// verdict by the page pipeline's one rule (PF.classify) and decides:
//   - a statement about the business the SYSTEM wrote in this run (the editor, while working an answer in) that nothing on file supports is
//     rewritten or removed by the system's own neutral rewrite (PF.neutralize), and asked as a new question; nothing the client wrote or
//     confirmed is ever touched, and a statement already in the page before this run was the client's to answer (it is not re-judged here);
//   - what still blocks is shown (a bracket the client typed, a testimonial, a cut page): the client sees it, the app does not publish it live;
//   - the delivered status in plain words, the grade OF THIS VERSION, and what the editor call cost (Claude only: no search data is bought).
const d = $input.first().json || {};
const P = $('Parse Brief').first().json || {};
const A = $('Finalize Apply').first().json || {};
const M = $('Finalize Merge').first().json || {};
const S = (v) => String(v == null ? '' : v);
const F = P.finalize || {}; const FM = M.finalize_merge || {};
let qa = { ...(d.content_qa || {}) };
const norm = (t) => S(t).replace(/!?\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`>#|]+/g, ' ').toLowerCase().replace(/[^\p{L}\p{N}%$€£&]+/gu, ' ').replace(/\s+/g, ' ').trim();
const marks = (qa.business_promises || []).concat(qa.business_claims || []).map(b => S(b.sentence)).filter(Boolean);
const figs = (qa.unverified_figures || []).map(f => S(f.figure)).concat((qa.flagged_amounts || []).map(a => S(a.amount)));
let md = PF.unmark(S(d.output), marks, figs);
const ctx = PF.ctxOf(P, {});
const cls = PF.classify(qa, md, ctx);
// what was on the page before the editor touched it: the client's version with the deterministic answers applied, and the request itself
const before = norm(S(A.output)) + ' ' + norm(S(F.input_markdown));
const newText = (t) => { const n = norm(t); return !!n && !before.includes(n); };
const TEXTUAL = { claim: 'sentence', figure: 'figure', statistic: 'stat', guarantee: 'quote', testimonial: 'text', weak_figure: 'sentence' };   // W0-H: a weak-only figure the editor wrote in this run is the system's to remove
const judged = cls.blocking.filter(b => !TEXTUAL[b.code] || newText(b[TEXTUAL[b.code]]));
const systemNew = judged.filter(b => b.tier === 'soft' && TEXTUAL[b.code]);
// PF.neutralize's own last sweep removes every bracket left in the page; a bracket the client typed is shown, never silently deleted, so the
// system's rewrite is applied here statement by statement
const N = { md, removed: [] };
for (const b of systemNew) {
  const t = S(b[TEXTUAL[b.code]]); if (!t) continue;
  const r = b.code === 'claim' ? PF.neutralSentence(N.md, t, ctx.domain, b.rewrite) : (() => { const i = N.md.indexOf(b.code === 'guarantee' ? t.slice(0, 60) : t); return i < 0 ? { md: N.md, done: false } : { md: PF.removeAt(N.md, i, b.code === 'guarantee' ? Math.min(60, t.length) : t.length), done: true, how: 'removed' }; })();
  if (r.done) { N.md = r.md; N.removed.push({ code: b.code, sentence: t, kind: b.kind || '', how: r.how || 'removed', text: r.text || '', rewrite: b.rewrite || null }); } }
N.md = PF.tidy(N.md);
md = PF.toc(N.md, S(F.input_markdown)).md;   // fu-finalize-toc: the contents list follows the headings after the system's own rewrite
const finalCls = PF.residual({ ...cls, blocking: judged }, md);
// W0-B (2026-10-29, page-quality PLAN Fix 2, REVIEW_CODE H2 / M8, owner decision D2): the page run's blockers travel with the page. Finalize
// 3336 dropped "this website already has a page for the same search" because this check never saw it and has no list of the website's
// pages to find it again; it said "Ready" at 100. Each blocker of the page run (`prc.gating.qa_blocking`, from the ORIGINAL report) is:
//   * measured again here when this check can see it on the page itself: a cut-off page, the meta description, the author box, the
//     business name (when the style guide travelled), the unsupported statements, figures, guarantees, testimonials and brackets;
//   * kept open when this check cannot see it: the duplicate page (until the client decides: rewrite it as an update of that page, or say
//     how this page differs, recorded and shown, the fit limit kept in the grade), a passage copied from another page (until none of the
//     passages the first check found is left), a dead link (while the link is still there), a section the verdict said to leave out (while
//     its heading is still there), the business name without the style guide, and any blocker this check does not know;
//   * and when the request did not carry the page run's blockers at all, nothing can say the page is ready.
const PR = P.prc || {}; const PG = PR.gating || {}; const DEC = PR.duplicate_decision || null;
const has0 = new Set(finalCls.blocking.map(x => x.code));
const RECHECKED = new Set(['cut_off', 'meta', 'author_profile', 'claim', 'figure', 'statistic', 'guarantee', 'testimonial', 'bracket', 'weak_figure']);   // W0-H: PF.classify measures weak-only figures again
const carried = [], resolved = [];
const urlIn = (t) => (S(t).match(/https?:\/\/[^\s"<>)]+/) || [''])[0].replace(/[.,;:]+$/, '');
let dupOpen = null, decision = null;
// client reports 2026-11-10 (section 184B / 184C): two of the page run's blockers are judged again by today's rule, because the rule itself was
// wrong: a page of the website aimed at ANOTHER market's search is not the same search (DUP.otherMarket), and a second-read finding blocks
// only when its own words say the page states something wrong or unsupported (RR.textError); everything else it found is advice, shown
// to the client and never the 59 cap. A finding that still blocks is the editor's to rewrite (Finalize Apply); it stays open while its words are on the page.
const away = [], reviewAdvice = [];
// section 189 (S3-04): the TABLE ROW or LIST ITEM that holds a quote (its line, normalised), '' when the quote is not in one. Prose is never
// judged this way (review B2, 2026-11-12): an appended clause, a woven fact or a split sentence changes a sentence while the claim stays,
// so a finding in prose stays open while its words are on the page, as before.
const unitOf = (q, text) => { const nq = norm(S(q).split(/\.{3}|\u2026/)[0]); if (nq.length < 8) return '';
  for (const line of S(text).split('\n')) { if (!norm(line).includes(nq)) continue;
    return (/^\s*\|/.test(line) || /^\s*(?:[-*+]|\d{1,3}[.)])\s+/.test(line)) ? norm(line) : ''; }
  return ''; };
const editTasks = ((A.finalize_apply || {}).review_fixes || []).filter(r => r && r.how === 'edit_task');
// rewritten = the row / item lost at least REWRITE_SHARE of its words other than the quote (an edit that only adds words keeps the claim)
const REWRITE_SHARE = 0.3;
const rewrote = (q) => { const nq = norm(q); if (!editTasks.some(r => norm(r.quote) === nq)) return false;
  const was = unitOf(q, S(A.output)), now = unitOf(q, md); if (!was || !now || was === now) return false;
  const qw = new Set(nq.split(' ')); const rest = [...new Set(was.split(' ').filter(w => w && !qw.has(w)))]; if (rest.length < 3) return false;
  const nowW = new Set(now.split(' ')); return rest.filter(w => !nowW.has(w)).length / rest.length >= REWRITE_SHARE; };
// section 189: the addresses the first check called "the same search", as they answer now (Parse Brief `prc.duplicate_status`)
const pageK = (u) => S(u).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
const selfK = F.grade_only ? pageK((F.live_read || {}).url) : '';
const dupMoved = [];
// review 2026-11-12: B1 a redirect to the SAME page (another host form, http -> https, a trailing slash, a language folder) is no move: unknown,
// the duplicate stays; S1 a redirect to ANOTHER page of the site moves the duplicate there (the content moved with it: that page is now the
// one for this search), it is not resolved; S3 a 404 / 410 counts only when the page inventory had it gone too (two reads)
const samePage = (a, b) => { const p = (u) => pageK(u).replace(/^[^\/]+/, '').replace(/^\/[a-z]{2}(?:-[a-z]{2})?(?=\/|$)/, ''); return pageK(a).split('/')[0] === pageK(b).split('/')[0] && p(a) === p(b); };
const sameSite = (a, b) => pageK(a).split('/')[0] === pageK(b).split('/')[0];
const dupGone = (u) => { const k = pageK(u); if (!k) return null; if (selfK && k === selfK) return { why: 'self' };
  const st = (PR.duplicate_status || []).find(x => x && pageK(x.url) === k); const n = st ? Number(st.status) || 0 : 0;
  if (n >= 300 && n < 400) { const to = S(st.location); if (!to || samePage(to, u)) return null;
    if (selfK && pageK(to) === selfK) return { why: 'self', status: n, to };
    return sameSite(to, u) ? { why: 'retarget', status: n, to } : { why: 'redirect', status: n, to }; }
  if ((n === 404 || n === 410) && [404, 410].includes(Number(st.stored_status) || 0)) return { why: 'gone', status: n };
  return null; };
const titleOfDup = (u) => S(((PG.duplicate_targets || []).find(x => x && x.url === u) || {}).title);
for (const b of (PG.qa_blocking || [])) {
  const code = S(b.code) || 'other'; const keep = (x) => { if (!has0.has(code) && !carried.some(c => c.code === code && c.text === x.text)) { const c0 = { code, tier: 'hard', text: S(b.text), action: S(b.action), ...x }; c0.text = PF.clean(c0.text); carried.push(c0); } };
  if (code === 'duplicate_page') {
    // production review 2026-11-12 (S3-05, section 189): an address that now redirects, is gone (404 / 410), or is the page being graded is
    // not a second page for this search; what it answers was read just before (Duplicate Status Plan, no redirect followed). Unread = kept.
    const urls0 = (PR.duplicate_urls || []).length ? PR.duplicate_urls : (b.urls || []);
    const urls = [...new Set(urls0.flatMap(u => { const why = dupGone(u); if (!why) return [u]; if (!dupMoved.some(x => pageK(x.url) === pageK(u))) dupMoved.push({ url: u, ...why });
      return why.why === 'retarget' ? [why.to] : []; }))];
    if (urls0.length && !urls.length) { resolved.push(code + ':moved'); continue; }
    const elsewhere = urls.length ? urls.map(u => ({ url: u, places: DUP.otherMarket(S(P.keyword), { url: u, title: titleOfDup(u) }, S(P.country)) })) : [];
    if (elsewhere.length && elsewhere.every(x => x.places)) { away.push(...elsewhere); resolved.push(code + ':other_market'); continue; }
    if (DEC && DEC.applies !== false) { decision = { code, choice: DEC.choice, url: DEC.url, reason: DEC.reason, pages: urls.slice(0, 3) }; resolved.push(code); }
    else { dupOpen = { urls }; keep({ urls, text: 'This website already has a page for the same search: ' + (urls.slice(0, 2).join(', ') || 'see the first check') + '. Publish this text as an update of that page, or tell us how the new page differs',
      action: 'rewrite it as an update of that page (a new page run that keeps its address), or tell us how this page differs' }); }
  } else if (code === 'copied') {
    const ps = (PG.copied_passages || []).filter(Boolean); const page = norm(md); const left = ps.filter(p => page.includes(norm(p)));
    if (ps.length && !left.length) resolved.push(code); else keep(ps.length ? {} : { text: S(b.text) + ' (the first check found it; this check cannot compare with the other page, so it stays until you rewrite those passages in a new page run)' });
  } else if (code === 'dead_link') { const u = urlIn(b.text); if (u && md.includes('](' + u)) keep({}); else resolved.push(code); }
  else if (code === 'off_topic') { const h = (S(b.text).match(/"([^"]{3,200})"/) || [])[1] || ''; if (h && new RegExp('^#{2,4}\\s+' + h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'm').test(md)) keep({}); else resolved.push(code); }
  else if (code === 'brand') { if (P.style_guide) resolved.push(code + ':rechecked'); else keep({ text: S(b.text) + ' (found by the first check; your style guide did not travel with this page, so it is not checked again here)' }); }
  else if (RECHECKED.has(code)) resolved.push(code + ':rechecked');
  // W0-H (Fix 3b): what the second read of the page run quoted stays open while those words are on the page, and is resolved once they are gone
  else if (code === 'review') { const q = (S(b.text).match(/"([^"]{8,300})"/) || [])[1] || '';
    if (!(q && PF.onPage(q, md))) resolved.push(code);
    else if (!RR.textError(S(b.text))) { reviewAdvice.push(S(b.text).replace(/^A second read of the page found a problem at/, 'A second read of the page suggests a change at')); resolved.push(code + ':advice'); }
    // production review 2026-11-12 (S3-04, section 189): the quote is where the problem stood, not the problem. A client's free re-make stayed
    // 59 because the editor rewrote the table row the read flagged ("High across CRM, ERP and cloud", "cloud partner status" gone, only facts
    // on file left) but kept the row's label, which IS the quote. When this run gave the editor the task for this finding and the sentence /
    // row / list item that holds the quote is no longer what it was, the finding is resolved and said as advice to check; an edit that was
    // refused or never made leaves the unit as it was, so it stays open as before.
    else if (rewrote(q)) { reviewAdvice.push(S(b.text).replace(/^A second read of the page found a problem at "([^"]*)":[\s\S]*$/, 'A second read of the page found a problem at "$1"; this version rewrote that part: check that it now says only what your facts support')); resolved.push(code + ':rewritten'); }
    else keep({}); }
  else keep({});
}
// the request did not carry what stopped the page in its first check: this version cannot be called ready on that basis
const NAMES = { qa_blocking: 'what stopped the page in its first check', duplicate_targets: 'the pages your website already has for this search' };
// M3 (WAVE0_REVIEW 2026-10-30): a request from an app built before W0-B (no page_run at all, `PR.legacy`) is not blocked on this: Parse Brief
// derived what it could and the rest makes the version "Needs work" below, never "Ready to publish"
if (!PR.blocks_known && !PR.legacy) carried.push({ code: 'not_checked', tier: 'hard', text: 'We could not read ' + (PR.gating_missing || ['qa_blocking']).map(k => NAMES[k] || k).join(' and ') + ', so this version cannot be called ready',
  action: 'make the final version again from the page in your content list, so its first check travels with it' });
finalCls.blocking = carried.concat(finalCls.blocking);
finalCls.hard = finalCls.blocking.filter(x => x.tier === 'hard').reduce((s0, x) => s0 + (x.weight || 1), 0);
// a new question for every statement the system had to take back (fact keys the website decided, or that were answered now, are never asked)
const skipKeys = new Set([...(F.stored_keys || []), ...(F.answered_keys || [])]);
const claims = N.removed.filter(r => r.code === 'claim').map(r => ({ sentence: r.sentence, kind: r.kind || 'process', rewrite: r.rewrite || null, neutral: r.how === 'reworded' || r.how === 'cta' ? r.text : '', how: r.how }));
const qs0 = claims.length ? PF.questions({ claims, brief: [], brackets: [], business: ctx.business, final_md: md, docs: [{ source: 'your business facts', text: S(P.business_facts) }], stored: [...skipKeys] }) : [];
const answeredIds = new Set((F.answers || []).map(a => a.id));
const client_questions = qs0.filter(q => !skipKeys.has(q.fact_key)).map((q, i) => ({ ...q, id: 'f' + (i + 1), rank: i + 1 })).filter(q => !answeredIds.has(q.id));
const del = PF.deliver(finalCls, { questions: client_questions });
// W0-B: the carried blockers keep their own action (PF.ACTION knows the codes of this run only), and the next step of an open duplicate
// says what to do, which is not "finish it by hand"
for (const x of del.blocking) { const c = carried.find(y => y.code === x.code && y.text === x.text); if (c && c.action) x.action = PF.clean(c.action); }
if (dupOpen) { const others = [...new Set(del.blocking.filter(x => x.code !== 'duplicate_page').map(x => x.action).filter(Boolean))];
  del.next_step = PF.clean('Your website already has a page for this search (' + (dupOpen.urls[0] || 'see the first check') + '): rewrite this as an update of that page, which is a new page run that keeps its address, or tell us how this page differs and make the final version again.'
    + (others.length ? ' Also: ' + others.join('; ') + '.' : '')); }
else if (!PR.blocks_known && !PR.legacy) del.next_step = PF.clean('We could not read the first check of this page, so this version is not called ready. Make the final version again from the page in your content list, so its first check travels with it.');
// W0-B: what this check could not measure because the page run's research did not travel with the page (pages written before it was kept)
const NOT_CHECKED = { length_band: 'the length of the pages that rank for this search (the usual length for this kind of page was used)', terms: 'topic coverage against the pages that rank',
  facts: 'the figures against the sources the page was written from', style_guide: 'your style guide (the business name and spelling)', site_urls: 'the links to your own pages against your full list of pages',
  sections_removed: 'whether the page run took sections out of this page (as a topic to leave out, or lost in editing)' };
if (PR.received) for (const k of Object.keys(NOT_CHECKED)) if ((PR.grading_missing || []).includes(k)) del.advisory.push({ code: 'not_checked', text: 'Not checked: ' + NOT_CHECKED[k] + '. This page was written before we kept that with it' });
for (const x of away.slice(0, 2)) del.advisory.unshift({ code: 'duplicate_other_market', text: PF.clean('Your website also has ' + x.url + ', aimed at searches in ' + x.places.join(', ') + '. This page is for another market, so it is not the same search: link the two pages to each other') });
for (const t of reviewAdvice.slice(0, 5)) del.advisory.push({ code: 'second_read', text: PF.clean(t) });
// section 189: what happened to the page the first check named (said once, never a blocker)
for (const x of dupMoved.slice(0, 2)) { if (x.why === 'self') continue;
  if (x.why === 'retarget') { del.advisory.push({ code: 'duplicate_moved', text: PF.clean('The page our first check named for this search, ' + x.url + ', now redirects to ' + x.to + ', so that page is the one your website has for this search') }); continue; }
  const to = x.to && pageK(x.to) !== selfK ? x.to : '';
  del.advisory.push({ code: 'duplicate_moved', text: PF.clean(x.why === 'redirect'
    ? 'The page our first check named for this search, ' + x.url + ', now redirects' + (to ? ' to ' + to : ' here') + ', so it is not a second page for this search any more' + (to ? '. If ' + to + ' answers the same search, link the two pages to each other' : '')
    : 'The page our first check named for this search, ' + x.url + ', no longer answers (' + x.status + '), so it is not a second page for this search any more') }); }
if (decision) del.advisory.unshift({ code: 'duplicate_decision', text: decision.choice === 'update'
  ? 'You chose to publish this text as an update of ' + decision.url + ': publish it at that address, in place of the page there now, not as a new page'
  : 'You chose to publish this as a separate page from ' + (decision.pages[0] || 'the page your website has') + ': "' + decision.reason + '". Two pages for one search can compete with each other, so the grade keeps its limit for fit' });
// W0-B: a page written before the length band was kept with it takes the length points its page run measured against the pages that rank
// (Finalize Parse Brief `length_points`), never 15 of 15 for matching its own word count
// W0-C (2026-10-29, page-quality PLAN Fix 3): on the grade kit's scale length carries no points (advice only), so the length points the
// page run measured are no longer put back into the number; a grade from a check before the kit keeps the rule above
const GD = qa.grade_detail || null;
// W06-C (2026-10-30, WAVE06 Open 1): what the page run took out of the page travels with it (page_run.sections_removed), so a final version
// made from a page that lost its core is "Needs work" with the reason, never "Ready": in Wave 0.5 the K1 page that lost six sections read
// 79 delivered and 83 "Ready" as its final version, because this check re-graded it with no memory of the run. A section counts as written
// back when a heading of this version carries (nearly) all of its heading's words; the H2s lost in editing are counted against this
// version's H2s, as the page run's grade counts them. A report from before the field keeps the old behaviour ("Not checked" advice above).
const SRm = PR.sections_removed && typeof PR.sections_removed === 'object' ? PR.sections_removed : null;
const removedNow = (() => {
  if (!SRm) return null;
  const STOPH = new Set('the and for with what which how why who when your our are does can its from into that this you'.split(' '));
  const tk = (t) => [...new Set(S(t).toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w.length >= 2 && !STOPH.has(w)))];
  const heads = (S(md).match(/^#{2,4}[ \t]+.+$/gm) || []).map(h => new Set(tk(h.replace(/^#+\s*/, ''))));
  const back = (h) => { const w = tk(h); return w.length > 0 && heads.some(H => w.filter(x => H.has(x)).length >= Math.max(1, Math.ceil(w.length * 0.75))); };
  const list = Array.isArray(SRm.list) ? SRm.list : [];
  const gone = list.filter(x => !back(x.heading)); const restored = list.filter(x => back(x.heading));
  const listWords = list.reduce((t, x) => t + (Number(x.words) || 0), 0); const total = Number(SRm.words) || 0;
  const words = listWords > 0 ? gone.reduce((t, x) => t + (Number(x.words) || 0), 0) + Math.max(0, total - listWords) : list.length ? Math.round(total * gone.length / list.length) : total;
  const restoredH2 = restored.filter(x => Number(x.level) === 2).length;
  const h2b = Number(SRm.h2_before) || 0; const h2r = Math.max(0, (Number(SRm.h2_removed) || 0) - restoredH2);
  // the H2s the page run's edits lost, as delivered, can only go down here (sections written back); a section the client deleted in the
  // editor is the client's choice, never counted as "lost in editing"
  const h2Final = PF.split(md).parts.length - 1;
  const h2Now = h2b > 0 ? Math.max(h2Final, h2b - h2r - (Number(SRm.by_edits) || 0)) : h2Final;
  return { sections: gone.length + Math.max(0, (Number(SRm.sections) || 0) - list.length), words, words_before: Number(SRm.words_before) || 0, h2_before: h2b,
    h2_removed: h2r, h2_now: h2Now, headings: gone.map(x => x.heading).slice(0, 8),
    restored: restored.map(x => x.heading).slice(0, 8) }; })();
let score0 = qa.content_score == null ? null : Number(qa.content_score); let breakdown0 = qa.score_breakdown ? { ...qa.score_breakdown } : null;
if (!GD && PR.length_from === 'first_check' && PR.length_points != null && breakdown0 && score0 != null && Number.isFinite(Number(breakdown0.length))) {
  score0 = Math.max(0, Math.min(100, Math.round(score0 - Number(breakdown0.length) + Number(PR.length_points)))); breakdown0.length = Math.round(Number(PR.length_points)); }
// W0-C: the grade of THIS version with the caps only this node knows: a blocker still open (at most 59), the page the website already has
// (fit at most 30% while it is open, and after "this page differs" too: D2 keeps the limit), and the floors (a page with no blocker that is
// under half its points in a part is "Needs work: <part>", never "Ready to publish")
const grade = GR.cap({ score: score0, of: 100, breakdown: breakdown0,
  basis: 'measured on this final version, after your answers and the last full check (' + (GD ? GR.basis : 'structure, readability, specificity, plain language, length') + '), '
    + (PR.length_from === 'page_run' ? 'against the length band, topic terms and sources of the page run'
      : PR.length_from === 'first_check' ? (GD ? 'with the length as the first check measured it against the pages that rank, as advice only (the page run\'s research was not kept with this page)' : 'with the length as the first check measured it against the pages that rank (the page run\'s research was not kept with this page)')
        : 'against the usual length for this kind of page (the page run\'s research was not kept with this page)'),
  blocking: del.blocking.length, advice: del.advisory.length, ...(GD ? { notes: GD.notes || [] } : {}),
  // D2: a page published beside the website's page for the same search keeps the fit limit (GR.cap applies it)
  ...(decision && decision.choice === 'differs' ? { fit_cap: { kept: true, why: 'published as a separate page beside ' + (decision.pages[0] || 'a page for the same search') + ', with your reason recorded' } } : {}) },
  del.blocking, { w0c: GD, decision, removed: removedNow,   // W06-C: the page run's removals still missing on this version cap coverage and fit (GR.removedCap)
    // W05-A (wave 0.5): the page run's second-read advice still costs its points while its quoted words are on this version (the grade does
    // not rise at Finalize for nothing); advice the client has edited away costs nothing
    review: Array.isArray(PR.second_read) ? { mode: 'enforce', status: 'checked', advice: PR.second_read.filter(a => a && a.location && PF.onPage(a.location, md)) } : null });
Object.assign(del, GR.deliver(del, grade));
// W06-C: the reason in the advice too (the parts under half say what to write back; this says what the run took out)
if (removedNow && grade.removed && grade.removed.capped && GD) { const RMn = GR.removedCap(removedNow, GD.max); if (RMn) del.advisory.unshift({ code: 'sections_removed', text: RMn.note }); }
// M3: the version of a legacy request is never "Ready to publish" (what only the first check could see is unknown), but it is not held back
// either: "Needs work" with what to do, the grade not capped, nothing blocking. A page that is not ready for its own reasons stays so.
if (PR.legacy && !PR.blocks_known && del.status !== 'not_ready') {
  const item = { code: 'needs_work', dim: 'first_check', text: 'Not checked: whether your website already has a page for this search, passages copied from another page and dead links. Only the first check of this page could see them, and this request did not carry it',
    action: 'Make the final version again from the page in your content list, so its first check travels with it' };
  const was = del.status === 'needs_work';
  del.needs_work = (del.needs_work || []).concat(item);
  del.status = 'needs_work'; del.label = PF.clean(was ? S(del.label) + ', first check not read' : 'Needs work: first check not read');
  del.next_step = PF.clean((was ? S(del.next_step).replace(/[.\s]+$/, '') + '. ' : 'Nothing stops you publishing this page, but ') + 'we could not read the first check of this page, so this version is not called ready. Make the final version again from the page in your content list, so its first check travels with it.');
  grade.ready = false; grade.first_check = { read: false, unknown: PR.legacy_unknown || [] };
}
// the answer: the Markdown the caller sent, without the meta lines it did not send
let out = md;
if (!P.had_meta) { const lines = out.split('\n'); let i = 0; while (i < lines.length && (/^(Title|Meta Description|Meta Title|Slug|Primary Keyword|Secondary Keywords)\s*:/i.test(lines[i].trim()) || !lines[i].trim())) i++; out = lines.slice(i).join('\n'); }
const changes = (FM.changes || []).concat(N.removed.map(r => ({ section: '', what: r.how === 'reworded' ? 'reworded: nothing on file supports it' : r.how === 'cta' ? 'kept only its link: nothing on file supports it' : 'removed: nothing on file supports it', before: PF.clean(S(r.sentence)).slice(0, 400), after: S(r.text || '') })));
// the cost: one Claude Sonnet call when an answer had to be worked into the text, priced by the cost kit from its characters (estimated); $0 otherwise
const call = FM.editor_ran ? CC.callCost({ node: 'Finalize Editor', model: 'claude-sonnet-5-5', calls: 1, prompt_chars: Number(FM.prompt_chars) || 0, output_chars: Number(FM.output_chars) || 0, effort: 'low', streaming: true, think_model: 'seen', max_tokens: 128000 }) : null;
const cost = { claude_usd: call ? call.usd : 0, dfs_usd: 0, estimated: !!call && !call.measured, model_calls: call ? 1 : 0, basis: call ? call.basis : 'no model call: every answer was applied without the editor' };
const body = {
  ok: true, request_id: S(P.request_id), markdown: out,
  // W0-A (PLAN Fix 1, acceptance f): the meta lines of the final version as the check read them (PF.meta rebuilt a broken description in
  // Parse Brief), so the app stores this description instead of the one it sent
  meta: { title: S((d.meta || {}).title), meta_description: S((d.meta || {}).description), slug: S((d.meta || {}).slug),
    // W0-B (D2): published as an update of the website's page for this search: its address and slug
    ...(decision && decision.choice === 'update' ? { target_url: decision.url, slug: (decision.url.replace(/^https?:\/\/[^\/]+/i, '').replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop() || S((d.meta || {}).slug)) } : {}) },
  decision, page_run: { received: !!PR.received, legacy: !!PR.legacy, gating_missing: PR.gating_missing || [], grading_missing: PR.grading_missing || [], kept_open: carried.map(x => x.code), resolved, duplicate_moved: dupMoved,
    // W06-C: what the page run took out, as this version stands (still missing, written back, whether it capped the grade)
    sections_removed: removedNow ? { checked: true, missing: removedNow.sections, missing_headings: removedNow.headings, restored: removedNow.restored, capped: !!(grade.removed && grade.removed.capped) } : { checked: false } },
  applied: (FM.applied || []).map(a => ({ id: a.id, how: a.how, section: S(a.section), ...(a.why ? { why: S(a.why).slice(0, 160) } : {}) })), sections_rewritten: FM.sections_rewritten || [], changes: changes.slice(0, 60),
  delivery_status: del.status,
  delivery: { status: del.status, label: del.label, blocking: del.blocking, advisory: del.advisory, next_step: del.next_step, grade, ...(del.needs_work ? { needs_work: del.needs_work } : {}) },
  client_questions, grade, cost, notes: (FM.notes || []).slice(0, 10), content_score: grade.score,
  // client reports 2026-11-11 (185): a live-page grade says so, with what was read; the app stores it and never treats it as a final version
  ...(F.grade_only ? { grade_only: true, live_read: F.live_read || null } : {}),
  basis: 'the content gate of a content run (Content QA + Originality Check, the same node code) over the final version, with your answers and the sentences you wrote counted as on file; no research, no new page',
  writes: 'none'
};
return [{ json: { body, cost_usd: 0, run_cost_usd: cost.claude_usd } }];
