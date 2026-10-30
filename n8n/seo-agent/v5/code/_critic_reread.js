// ---- RR: the blind second read of the delivered page (W0-H, 2026-10-29; inlined through the CRITIC_REREAD marker) ----
// docs/page-quality-2026-10-29/PLAN.md Fix 3b (2.7, 2.8), REVIEW_EVIDENCE H1, R4 G14 / G18. Run 3299: the Critic (Sonnet) scored the first
// draft 66 against the expert reviewer's 63 while our code grade said 92 then 100, and its three high-severity problems weighed nothing: it
// read the FIRST draft once and gated nothing. Until the separate grade judge of Wave 2, the Critic's own quality bar (v5/prompts/critic.txt,
// QUALITY BAR + SOURCE QUALITY, inlined here by the build so the two never drift) reads the page the client RECEIVES once more:
//   * blind: no earlier review, no edit history, no score of ours, no "confirmed" labels; it does get the site's own live pages (the 3299
//     Critic, told nothing about them, called live internal links "not confirmed"), the facts on file, the sources the run verified and
//     the regulatory digest when there is one;
//   * one Sonnet 5.5 call over HTTP (the Messages API with the Anthropic credential, like the promise judge): adaptive thinking at medium
//     effort, JSON through structured outputs (output_config.format). No temperature and no forced tool: Sonnet 5.5 refuses both (400);
//   * a problem counts only when its quoted words are on the page (PF.onPage); a high-severity one of a GATING kind (fact, source, claim,
//     local: what would mislead a reader or embarrass the business) is a soft blocker; everything else is advice, shown to the client;
//   * a refused (stop_reason "refusal"), cut (max_tokens), failed or unparsable answer is "not checked", never a pass and never a block;
//   * runs the system started by itself (the cadence, a ladder's own page runs, the tracker, case-study spawns) are read in SHADOW mode
//     first, the rule of owner decision D17 for the holds: what would have blocked is logged and reported as advice, the status does not
//     change. CFG.automatic moves to 'enforce' after two cadence cycles of shadow logs and the owner's review. A page of the client's
//     keyword ladder is read in shadow mode too, also when a person started it from the app (M4, WAVE0_REVIEW 2026-10-30). Other runs a
//     person started (the app, the form, the API) are enforced. The page that ranks (exec 949, a ladder page) is therefore never held back
//     by this read.
// W05-A (wave 0.5, 2026-10-30, docs/page-quality-2026-10-29/BEFORE_AFTER.md "Our second-read blockers against the judges"): the read held 7
// of the 8 AFTER pages at "Not ready 59" while the blind strategist judge would publish 7 of 8 (signed error -10.9). Its high items were
// mostly fix-before-publishing advice given blocker weight. A problem now BLOCKS (enforce mode) only when it is a factual error the page
// states, decided from the read's own words and the page, never from its score:
//   * count: a number followed by a list of a different length on the page ("six engines: ..." and seven names), checked on the quote;
//   * claim: an unsupported statement about the business (kind "claim": what it does, offers, holds or promises, not on file);
//   * contradicted: a statement its own cited or linked source contradicts (never "contradicts nothing", never a contrast with the framing);
//   * wrong: a fact or local rule the read calls wrong, false, out of date, superseded or repealed, unhedged ("could be out of date" is advice),
//     except a date that only falls on the day the page is written: a page is read after that day, so it is advice (add a status line).
// Everything else the read found on the page (an uncited contrast, a figure that wants a source, a vague market figure, a law with no link,
// a statistics note) is ADVICE: shown to the client and taken off its part of the grade by the grade kit (GR.cap review), never the 59 cap.
// "Today" is the website's market day (Regulatory Plan's as_of, the market's time zone, Asia/Dubai for the UAE), told to the reader and used
// for the same-day rule, so a run at 22:31 UTC on 29 October reads a UAE page as written on 30 October, like the page's own date.
// Its cost is MEASURED (Anthropic reports the tokens of the answer) and joins the run's Claude figure in the ledger.
// Pure: no clock, no network, no n8n globals, no URL constructor, no Object.defineProperty, no structuredClone (n8n sandbox rules).
const RR = (() => {
  const S = (v) => String(v == null ? '' : v);
  const MODEL = 'claude-sonnet-5-5';
  const CFG = { automatic: 'shadow', max_tokens: 16000, effort: 'medium', page_chars: 60000, facts_chars: 6000, sources: 25, site_pages: 40, max_advice: 5 };
  const GATING = new Set(['fact', 'source', 'claim', 'local']);
  const KINDS = ['fact', 'source', 'claim', 'local', 'repetition', 'intent', 'depth', 'structure', 'style', 'link', 'other'];
  const AUTOMATIC = /^(cadence|ladder|tracker|casestudy|audit):/;
  const TEMPLATE = /*__RR_TEMPLATE__*/'';
  const BAR = /*__RR_BAR__*/'';
  const SCHEMA = { type: 'object', additionalProperties: false, required: ['score', 'problems'],
    properties: { score: { type: 'integer' }, strengths: { type: 'array', items: { type: 'string' } },
      problems: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['severity', 'kind', 'location', 'issue', 'fix'],
        properties: { severity: { type: 'string', enum: ['high', 'medium', 'low'] }, kind: { type: 'string', enum: KINDS },
          location: { type: 'string' }, issue: { type: 'string' }, fix: { type: 'string' } } } } } };
  const clean = (s) => S(s).replace(/\s*[\u2014\u2013]\s*/g, ': ').replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/\u2026/g, '...').replace(/:\s*:/g, ':').trim();
  const list = (xs, n) => xs.filter(Boolean).slice(0, n);
  // ---- W05-A: which high problems are factual errors the page states (they block); everything else is advice ----
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const fmtDay = (iso) => { const m = S(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return ''; const mo = MONTHS[Number(m[2]) - 1] || ''; return Number(m[3]) + ' ' + mo.charAt(0).toUpperCase() + mo.slice(1) + ' ' + m[1]; };
  const pad2 = (n) => (Number(n) < 10 ? '0' : '') + Number(n);
  const isoDates = (t) => { const out = []; const x = S(t);
    for (const m of x.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/gi))
      out.push(m[3] + '-' + pad2(MONTHS.indexOf(m[2].toLowerCase()) + 1) + '-' + pad2(m[1]));
    for (const m of x.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) out.push(m[0]);
    return out; };
  const NUMW = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
  const plainQ = (t) => S(t).replace(/!?\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]+/g, '').replace(/\s+/g, ' ').trim();
  // "six AI engines and answer surfaces: ChatGPT, Gemini, ..., AI Overviews." -> the stated number and the items the list names. Only a
  // list that ends inside the quote (a full stop or semicolon) is counted, so a quote cut mid-list is never a mismatch.
  const countMismatch = (quote) => {
    const t = plainQ(quote);
    for (const m of t.matchAll(/\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d{1,2})\s+((?:[A-Za-z][\w&'-]*\s+){0,5}?[A-Za-z][\w&'-]*)\s*:\s*([^.;:]+)[.;]/gi)) {
      const n = NUMW[m[1].toLowerCase()] || Number(m[1]); if (!(n >= 2 && n <= 30)) continue;
      const items = m[3].split(/\s*,\s*(?:and\s+|or\s+)?|\s+(?:and|or)\s+/i).map(x => x.trim()).filter(x => x && x.split(/\s+/).length <= 6);
      if (items.length >= 2 && items.length !== n) return { stated: n, listed: items.length, what: m[2] }; }
    return null; };
  const WRONG = /\b(?:wrong(?:ly)?|incorrect(?:ly)?|inaccurate(?:ly)?|untrue|not true|false|out of date|outdated|superseded|repealed|revoked|withdrawn|replaced by|no longer (?:applies|apply|in force|current|valid|true|available|offered)|(?:has|have) (?:already )?(?:passed|expired|lapsed)|already passed|expired)\b/gi;
  const HEDGED = /\b(?:could|may|might|can|possibly|perhaps|likely|risks?|seems?|appears?)\s+(?:\w+\s+){0,2}$/i;
  const wrongIn = (t) => { const x = S(t); for (const m of x.matchAll(WRONG)) if (!HEDGED.test(x.slice(Math.max(0, m.index - 40), m.index))) return m[0]; return ''; };
  const CONTRA_NONE = /\bcontradicts? nothing\b|\bdoes not contradict\b|\bno contradiction\b/i;
  const SRC_CONTRA = /\bcontradict\w*\b[^.;]{0,60}\b(?:source|cited|linked|reference|official (?:text|page)|the law|the decision|the regulation)\b|\bnot what (?:the|its) (?:linked |cited )?(?:source|page|reference)\b|\b(?:source|reference)\b[^.;]{0,60}\b(?:says|states|gives|shows|reports|lists)\b[^.;]{0,60}\b(?:otherwise|the opposite|instead)\b|\bmis(?:quotes?|states?|represents?)\b/i;
  const SAME_DAY = /\b(?:today|the deadline day|day of writing|(?:is|was) (?:written|dated|published) on|the day (?:this|the) page (?:is|was) (?:written|published|dated)|on the day it is written)\b/i;
  // a date problem that is only a problem on the day the page is written (the deadline falls that day): with the market's day known, the
  // date the read talks about must be that day; without it, the read's own words must say so
  const sameDay = (p, today) => SAME_DAY.test(S(p.issue)) && (!today || isoDates(S(p.location) + ' ' + S(p.issue)).includes(today));
  const errorOf = (p, today) => {
    if (p.severity !== 'high' || !p.on_page) return '';
    if (countMismatch(p.location) && /\b(?:\d{1,2}|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i.test(S(p.issue))) return 'count';
    if (!GATING.has(p.kind)) return '';
    if (p.kind === 'claim') return 'claim';
    const issue = S(p.issue);
    if (!CONTRA_NONE.test(issue) && SRC_CONTRA.test(issue)) return 'contradicted';
    if ((p.kind === 'fact' || p.kind === 'local') && wrongIn(issue) && !sameDay(p, today)) return 'wrong';
    return ''; };
  const ERROR_LABEL = { count: 'a count that does not match its list', claim: 'a statement about the business that nothing on file supports',
    contradicted: 'a statement its own source contradicts', wrong: 'a wrong or out-of-date statement' };
  // M4 (WAVE0_REVIEW 2026-10-30): a page of the client's keyword ladder is read in the same shadow mode wherever it was started (the app's
  // ladder "Write now" sends client_ip app:..., not ladder:...), as the hold already exempts it by ladder_id + ladder_rung: the false-positive
  // rate of this blind read is unmeasured, and the guide that ranks (exec 949) is a ladder page. It moves to enforce with the automatic runs,
  // after the owner has reviewed the first 20 second reads (D17).
  const ladderPage = (p) => !!S(p.ladder_id).trim() && p.ladder_rung != null && p.ladder_rung !== '';
  const modeOf = (prev) => { const p = prev || {}; return AUTOMATIC.test(S(p.client_ip).toLowerCase()) || ladderPage(p) ? CFG.automatic : 'enforce'; };
  // what the reader is told about the website and the run, never what we think of the page
  const context = (prev, reg, today) => {
    const p = prev || {}; const b = p.content_brief || {}; const sd = p.site_description || {}; const sp = p.site_profile || {};
    const own = [...new Set([].concat((p.internal_link_candidates || []).filter(x => x && !x.planned).map(x => S(x.url)), (p.site_urls || []).map(x => S(x && x.url ? x.url : x))).filter(u => /^https?:\/\//.test(u)))];
    const facts = list([].concat(b.client_facts || [], [p.business_facts, p.case_facts_text], sd.site_facts || sd.products_or_services || []).map(S), 80).join(' | ').slice(0, CFG.facts_chars);
    const srcs = list([].concat((b.evidence_plan || []).map(e => e && e.source_url ? S(e.fact).slice(0, 240) + ' (' + S(e.source_url) + ')' : ''),
      (p.facts || []).map(f => f && f.url ? S(f.claim || f.fact || f.text).slice(0, 240) + ' (' + S(f.url) + ')' : '')), CFG.sources);
    // W07-B (2026-10-31, WAVE06 section 10 finding 3): a separate new page beside a page the client kept says so, or the read advises the
    // kept page's slug (K1: "Use the slug ms-365-erp-uae"); only on such a page, so every other read gets the same prompt as before
    const apart = typeof PGA !== 'undefined' ? PGA.readerNote(PGA.of(p), b.slug) : '';
    return { KEYWORD: S(p.keyword), PAGE_TYPE: S(p.page_type || 'page'), COUNTRY: S(p.country || 'not stated'), AUDIENCE: S(b.target_audience || p.audience || 'not stated'),
      BUSINESS: S(sp.business_name || sd.business_name || p.domain || 'the business'), DOMAIN: S(p.domain),
      SITE_PAGES: (own.slice(0, CFG.site_pages).join('\n') || 'none listed') + (apart ? '\n\n' + apart : ''), FACTS: facts || 'none', SOURCES: srcs.join('\n') || 'none',
      REGULATORY: (today ? 'Today in ' + S(p.country || 'the market') + ': ' + fmtDay(today) + ' (the date this page is published with; it is read after that day too).\n' : '') + (S(reg).trim() || 'none for this page') }; };
  const fill = (tpl, vals) => S(tpl).replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in vals ? S(vals[k]) : m));
  // the request, or why there is none
  const plan = (item, prev, opts) => {
    const it = item || {}; const o = opts || {}; const qa = it.content_qa || {}; const md = typeof it.output === 'string' ? it.output : '';
    const mode = modeOf(prev); const today = /^\d{4}-\d{2}-\d{2}$/.test(S(o.today)) ? S(o.today) : '';
    const skip = (reason) => ({ skip: true, reason, mode, model: MODEL, today });
    if (!TEMPLATE || !BAR) return skip('the second read is not configured in this build');
    if ((prev || {}).critic_reread === false) return skip('the second read was switched off for this run');
    if (!md.trim()) return skip('no page was written');
    if (!qa.delivery || typeof qa.delivery !== 'object') return skip('the page has no delivered status to check');
    if (qa.cut_off) return skip('the page stops before its end, so a read of it would say nothing new');
    const page = md.length > CFG.page_chars ? md.slice(0, CFG.page_chars) : md;
    const prompt = fill(TEMPLATE, { ...context(prev, o.regulatory_digest, today), BAR, PAGE: page });
    const body = { model: MODEL, max_tokens: CFG.max_tokens, thinking: { type: 'adaptive' }, output_config: { effort: CFG.effort, format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: prompt }] };
    const ap = typeof PGA !== 'undefined' ? PGA.of(prev) : null;   // W07-B: the kept page, so read() can set aside advice that takes it over
    return { skip: false, reason: '', mode, model: MODEL, today, body: JSON.stringify(body), prompt_chars: prompt.length,
      ...(ap ? { apart: { url: ap.url, path: ap.path, slugs: ap.pages.map(x => x.slug).filter(Boolean), paths: ap.pages.map(x => x.path).filter(x => x.length > 1) } } : {}) }; };
  // W07-B: advice that the page take the kept page's address or slug, replace it, merge into it or redirect to it goes against the client's
  // choice (a separate page at its own address): it is set aside with that reason, never shown and never counted. Plain words here, so the
  // reader of the answer needs no other kit.
  const TAKEOVER = /\b(?:slug|url|address|path|redirect\w*|merge\w*|replac\w*|consolidat\w*|canonical\w*|second page)\b/i;
  const againstChoice = (q, apart) => { if (!apart || /^link$/i.test(S(q.kind).trim())) return false; const t = (S(q.location) + ' ' + S(q.issue) + ' ' + S(q.fix)).toLowerCase();
    const named = (apart.slugs || []).some(s => new RegExp('(^|[^\\w-])' + S(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w-])').test(t)) || (apart.paths || []).some(x => t.includes(S(x)));
    return named && TAKEOVER.test(S(q.issue) + ' ' + S(q.fix)); };
  // the answer: checked (with every problem, which ones gate and which are advice) or not checked (and why)
  const read = (resp, md, planned, PFk) => {
    const r = resp || {}; const pl = planned || {}; const mode = pl.mode || 'enforce';
    const usage = r.usage && typeof r.usage === 'object' ? { input_tokens: Number(r.usage.input_tokens) || 0, output_tokens: Number(r.usage.output_tokens) || 0 } : null;
    const nc = (reason) => ({ status: 'not_checked', reason, mode, model: S(r.model || pl.model || MODEL), usage, problems: [], gates: [], advice: [], would_block: [] });
    if (pl.skip) return { ...nc(S(pl.reason) || 'not run'), usage: null };
    if (r.error) { const e = r.error; return nc('the second read could not be run (' + clean(S(typeof e === 'object' ? (e.message || e.type || JSON.stringify(e)) : e)).slice(0, 160) + ')'); }
    if (S(r.stop_reason) === 'refusal') return nc('the reviewer declined to read this page' + (r.stop_details && r.stop_details.category ? ' (' + S(r.stop_details.category) + ')' : ''));
    if (S(r.stop_reason) === 'max_tokens') return nc('the review was cut off before its end');
    const texts = (Array.isArray(r.content) ? r.content : []).filter(c => c && c.type === 'text').map(c => S(c.text));
    if (!texts.length) return nc('the second read gave no answer');
    let j = null; try { j = JSON.parse(texts[texts.length - 1].trim().replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch (e) { j = null; }
    if (!j || typeof j !== 'object' || !Array.isArray(j.problems)) return nc('the second read gave an answer we could not read');
    const onPage = PFk && typeof PFk.onPage === 'function' ? PFk.onPage : () => false;
    const against = [];
    const problems = j.problems.filter(p => p && typeof p === 'object').filter(p => { if (!againstChoice(p, pl.apart)) return true;
      against.push({ severity: S(p.severity).toLowerCase(), kind: S(p.kind).toLowerCase(), location: clean(p.location).slice(0, 300), issue: clean(p.issue).slice(0, 400), fix: clean(p.fix).slice(0, 400),
        why: 'set aside: it advises taking over the existing page the client chose to keep (' + S(pl.apart.path) + ')' }); return false; }).slice(0, 20).map(p => {
      const severity = /^(high|medium|low)$/i.test(S(p.severity)) ? S(p.severity).toLowerCase() : 'low'; const kind = KINDS.includes(S(p.kind).toLowerCase()) ? S(p.kind).toLowerCase() : 'other';
      const location = clean(p.location).slice(0, 300); const on_page = !!location && onPage(location, md);
      const q = { severity, kind, location, issue: clean(p.issue).slice(0, 400), fix: clean(p.fix).slice(0, 400), on_page };
      const error = errorOf(q, S(pl.today)); return { ...q, error, gates: !!error }; });
    const gating = problems.filter(p => p.gates);
    // W05-A: the most damaging advice first (the high items that are not errors), as the client sees it and the grade counts it
    const advice = problems.filter(p => !p.gates && p.on_page && p.severity !== 'low').sort((a, b) => (a.severity === 'high' ? 0 : 1) - (b.severity === 'high' ? 0 : 1)).slice(0, CFG.max_advice);
    return { status: 'checked', reason: '', mode, model: S(r.model || MODEL), usage, today: S(pl.today), score: Number.isFinite(Number(j.score)) ? Number(j.score) : null,
      problems, gates: mode === 'enforce' ? gating : [], would_block: mode === 'enforce' ? [] : gating, advice,
      not_shown: problems.filter(p => !p.on_page).length, ...(against.length ? { against_choice: against } : {}) }; };
  // the delivered page with what the read found: blockers in enforce mode, advice always; the grade object is not touched here
  const apply = (qa0, rr, PFk) => {
    const qa = { ...(qa0 || {}) }; const R = rr || {}; const del = qa.delivery && typeof qa.delivery === 'object' ? { ...qa.delivery } : null;
    const record = { status: R.status, reason: R.reason || '', mode: R.mode, model: R.model, usage: R.usage || null, score: R.score == null ? null : R.score,
      gates: (R.gates || []).map(g => ({ kind: g.kind, error: g.error || '', location: g.location, issue: g.issue, fix: g.fix })),
      would_block: (R.would_block || []).map(g => ({ kind: g.kind, error: g.error || '', location: g.location, issue: g.issue, fix: g.fix })),
      advice: (R.advice || []).map(g => ({ severity: g.severity, kind: g.kind, location: g.location, issue: g.issue, fix: g.fix })), not_shown: R.not_shown || 0,
      ...((R.against_choice || []).length ? { against_choice: R.against_choice } : {}) };   // W07-B: advice set aside because it takes over the page the client kept
    qa.critic_reread = record;
    if (!del || !PFk) return qa;
    const advisory = (del.advisory || []).slice();
    const adv = (g, pre) => advisory.push({ code: 'second_read', text: clean(pre + ' "' + S(g.location).slice(0, 140) + '": ' + S(g.issue).replace(/[.;:]+$/, '') + (g.fix ? '. Suggested: ' + S(g.fix).replace(/[.;:]+$/, '') : '')) });
    for (const g of (R.would_block || [])) adv(g, 'A second read of the page found (reported only while this check is new)');
    for (const g of (R.advice || [])) adv(g, g.severity === 'high' ? 'A second read of the page found something to fix before publishing at' : 'A second read of the page suggests a change at');
    if (R.status !== 'checked') advisory.push({ code: 'second_read', text: clean('Not checked by a second read: ' + S(R.reason)) });
    let out = { ...del, advisory, second_read: { status: R.status, mode: R.mode, blocking: (R.gates || []).length, reported: (R.would_block || []).length } };
    if (R.mode === 'enforce' && (R.gates || []).length) {
      const cls0 = { blocking: (del.blocking || []).map(b => ({ code: S(b.code), text: S(b.text), tier: 'carried' })), advisory };
      const cls = PFk.reviewed(cls0, R);
      const d2 = PFk.deliver(cls, { questions: del.client_questions || qa.client_questions || [] });
      const acts = new Map((del.blocking || []).map(b => [S(b.code) + '|' + S(b.text), b.action]));
      const blocking = d2.blocking.map(b => (acts.has(b.code + '|' + b.text) ? { ...b, action: acts.get(b.code + '|' + b.text) } : b));
      const grade = del.grade && typeof del.grade === 'object' ? { ...del.grade, blocking: blocking.length } : del.grade;
      out = { ...out, status: d2.status, label: d2.label, blocking, next_step: d2.next_step || del.next_step || '', grade };
      const ready = d2.status !== 'not_ready'; const reasons = ready ? [] : blocking.map(b => b.text).slice(0, 8);
      const oq = qa.quality && typeof qa.quality === 'object' ? qa.quality : {};
      Object.assign(qa, { passed: ready, publishable: ready, not_ready: !ready, quality_label: d2.label, not_ready_reasons: reasons, delivery_status: d2.status,
        quality: { ...oq, passed: ready, publishable: ready, not_ready: !ready, label: d2.label, reasons, delivery_status: d2.status, blocking, advisory: out.advisory.map(a => ({ code: a.code, text: a.text })),
          grade: grade || oq.grade, next_step: out.next_step, fix_by: ready ? '' : 'edit' } });
    } else if (qa.quality && typeof qa.quality === 'object') qa.quality = { ...qa.quality, advisory: advisory.map(a => ({ code: a.code, text: a.text })) };
    qa.delivery = out;
    return qa; };
  return { MODEL, CFG, GATING, KINDS, SCHEMA, ERROR_LABEL, modeOf, context, plan, read, apply, fill, errorOf, countMismatch, sameDay, fmtDay };
})();
