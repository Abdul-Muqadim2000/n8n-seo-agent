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
  const TEMPLATE = "You are a demanding editor-in-chief and SEO lead. This page is finished and about to go to the client. You did not write it, and you have not seen any earlier review of it or any of the edits that led to it. Read it once, as a careful expert reader in {{COUNTRY}} would, and report what is wrong. Quote the exact words of the page for every problem.\n\nTARGET\nKeyword: {{KEYWORD}} \u00b7 Page type: {{PAGE_TYPE}} \u00b7 Country: {{COUNTRY}} \u00b7 Audience: {{AUDIENCE}}\nBusiness: {{BUSINESS}} ({{DOMAIN}})\n\nTHE BUSINESS'S OWN LIVE PAGES (a link to one of these is confirmed: never report it as unconfirmed or unpublished)\n{{SITE_PAGES}}\n\nFACTS ON FILE (true: the business may state them, whatever wording the page uses)\n{{FACTS}}\n\nSOURCES THIS RUN READ AND VERIFIED (a figure quoted from one of these, with its link, is supported)\n{{SOURCES}}\n\nLOCAL REGULATORY FACTS FOR THIS RUN (dated, with their official source)\n{{REGULATORY}}\n\n{{BAR}}\n\nHOW TO REPORT\n- \"location\": copy 5 to 15 words EXACTLY as they appear on the page (no \"...\", no paraphrase). A problem whose words are not on the page cannot be shown to the client.\n- \"kind\", one of:\n  fact: a statement about the world (a product, a market, a process) that is wrong, out of date, or not what its linked source says;\n  source: a figure or claim whose only support is a weak source (rule 5 of SOURCE QUALITY), or a link that does not support its sentence;\n  claim: a statement about the business (what it does, offers, holds, has done or promises) that the facts on file do not support;\n  local: a local rule, deadline, regulator, tax or market fact that is wrong, out of date or stated without its status;\n  repetition: the same point made again in another section; intent: the page answers a different search or buyer than the keyword's;\n  depth: an answer too thin or generic for this reader; structure: headings, order, table, call to action; style: wording, readability, banned phrases;\n  link: an internal or external link problem; other: anything else.\n- \"severity\": high only when publishing it as it is would mislead a reader or embarrass the business (a wrong or unsupported fact, figure, claim or local rule). Everything a good editor would improve but a reader would not be misled by is medium or low.\n- Never ask for a bracket or a placeholder, never ask the page to grow past its length, and never ask for a claim about the business that the facts on file do not carry.\n\nTHE PAGE\n{{PAGE}}\n\nReturn ONLY valid JSON (no markdown, no backticks):\n{ \"score\": 0-100, \"strengths\": [\"2-4 specific strengths\"], \"problems\": [{ \"severity\": \"high | medium | low\", \"kind\": \"fact | source | claim | local | repetition | intent | depth | structure | style | link | other\", \"location\": \"the exact words from the page\", \"issue\": \"what is wrong\", \"fix\": \"exactly what to write or change\" }] }\nList at most 12 problems, most damaging first. Score 85+ only if you would publish it under your own name.\n";
  const BAR = "QUALITY BAR\n1. Specificity: examples, numbers with linked sources, decision rules, steps \u2014 not generic advice.\n2. Originality and information gain: every information-gain item is covered fully; the page says something competitors do not.\n3. Audience fit: speaks to the stated audience and answers their objections.\n4. Trust: no unsupported claims or invented numbers; external numbers carry a source link; client facts are used correctly; no bracket of any kind in the page (a missing fact is written around, never left as [Price] or [Confirm: ...]). Anything that appears in the client facts or in the facts from the client's own website above is TRUE: never call it invented, made up or unsupported, whatever wording the draft uses for it. For anything else that cannot be checked, the word is \"unverified\" \u2014 say what would verify it (a source link) or how to say it without the claim; never \"invented\", and never suggest a bracket or a placeholder as the fix.\n5. Readability and voice: plain words, varied sentence length, active voice, no filler, none of the banned phrases (delve, unlock, seamless, robust, leverage, cutting-edge, game-changer, elevate, empower, crucial, paramount, realm, embark, foster, streamline, synergy, holistic, best-in-class, world-class, state-of-the-art, top-notch, one-stop shop, \"in today's fast-paced world\", \"ever-evolving\", \"it's important to note\", \"in conclusion\", \"when it comes to\", \"a wide range of\").\n6. Search fit: matches the intent, at least three headings phrased as the questions buyers ask and answered directly in the 40-60 words under them (no \"Frequently Asked Questions\" block and no Q1:/A1: list \u2014 Google stopped showing FAQ rich results in May 2026), terms used naturally, primary keyword placed correctly without stuffing, internal links only to allowed URLs and never to a page that is not published yet.\n7. Structure: follows the outline order and target lengths, comparison table present, CTA last, meta title \u226460 and description 120-155 characters.\n\nSOURCE QUALITY \u2014 what a citation is worth, best first. Judge every external link against this list and say so in \"problems\" when the draft falls short.\n1. Primary: a government, regulator, standards body or official statistics page (.gov, .gov.<country>, .edu, europa.eu, iso.org, w3.org, peppol.org, u.ae, the WHO / OECD / World Bank / IMF / UN).\n2. Research: a named research house publishing its own data (Statista, Gartner, Forrester, IDC, McKinsey, Deloitte, PwC, KPMG, EY, BCG, Bain, Pew, Nielsen, Grand View, MarketsandMarkets).\n3. Major press: Reuters, Bloomberg, the BBC, the Financial Times, the Wall Street Journal, the New York Times, The Economist, AP, CNBC, Khaleej Times, The National, Gulf News, Zawya.\n4. Vendor documentation: a product's own documentation or release notes (Microsoft Learn, Oracle, SAP, Odoo, Zoho docs) \u2014 fine for how the product works, never for a market figure.\n5. Weak: everything else \u2014 a vendor's or agency's blog post, a listicle, an unknown site. The page may cite at most ONE page per weak domain; a second citation of the same weak domain is a high-severity problem, and so is a market or compliance figure whose only source is a weak page.\nAlso flag: a figure that does not appear in the source it links to, a link with tracking parameters (utm_*, srsltid, gclid, fbclid), and a link to a page of this site that is not published yet.";
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
    return { KEYWORD: S(p.keyword), PAGE_TYPE: S(p.page_type || 'page'), COUNTRY: S(p.country || 'not stated'), AUDIENCE: S(b.target_audience || p.audience || 'not stated'),
      BUSINESS: S(sp.business_name || sd.business_name || p.domain || 'the business'), DOMAIN: S(p.domain),
      SITE_PAGES: own.slice(0, CFG.site_pages).join('\n') || 'none listed', FACTS: facts || 'none', SOURCES: srcs.join('\n') || 'none',
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
    return { skip: false, reason: '', mode, model: MODEL, today, body: JSON.stringify(body), prompt_chars: prompt.length }; };
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
    const problems = j.problems.filter(p => p && typeof p === 'object').slice(0, 20).map(p => {
      const severity = /^(high|medium|low)$/i.test(S(p.severity)) ? S(p.severity).toLowerCase() : 'low'; const kind = KINDS.includes(S(p.kind).toLowerCase()) ? S(p.kind).toLowerCase() : 'other';
      const location = clean(p.location).slice(0, 300); const on_page = !!location && onPage(location, md);
      const q = { severity, kind, location, issue: clean(p.issue).slice(0, 400), fix: clean(p.fix).slice(0, 400), on_page };
      const error = errorOf(q, S(pl.today)); return { ...q, error, gates: !!error }; });
    const gating = problems.filter(p => p.gates);
    // W05-A: the most damaging advice first (the high items that are not errors), as the client sees it and the grade counts it
    const advice = problems.filter(p => !p.gates && p.on_page && p.severity !== 'low').sort((a, b) => (a.severity === 'high' ? 0 : 1) - (b.severity === 'high' ? 0 : 1)).slice(0, CFG.max_advice);
    return { status: 'checked', reason: '', mode, model: S(r.model || MODEL), usage, today: S(pl.today), score: Number.isFinite(Number(j.score)) ? Number(j.score) : null,
      problems, gates: mode === 'enforce' ? gating : [], would_block: mode === 'enforce' ? [] : gating, advice,
      not_shown: problems.filter(p => !p.on_page).length }; };
  // the delivered page with what the read found: blockers in enforce mode, advice always; the grade object is not touched here
  const apply = (qa0, rr, PFk) => {
    const qa = { ...(qa0 || {}) }; const R = rr || {}; const del = qa.delivery && typeof qa.delivery === 'object' ? { ...qa.delivery } : null;
    const record = { status: R.status, reason: R.reason || '', mode: R.mode, model: R.model, usage: R.usage || null, score: R.score == null ? null : R.score,
      gates: (R.gates || []).map(g => ({ kind: g.kind, error: g.error || '', location: g.location, issue: g.issue, fix: g.fix })),
      would_block: (R.would_block || []).map(g => ({ kind: g.kind, error: g.error || '', location: g.location, issue: g.issue, fix: g.fix })),
      advice: (R.advice || []).map(g => ({ severity: g.severity, kind: g.kind, location: g.location, issue: g.issue, fix: g.fix })), not_shown: R.not_shown || 0 };
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
// W0-H (2026-10-29, page-quality PLAN Fix 3b; build section 158): the request for the blind second read of the page the client receives
// (RR.plan, v5/code/_critic_reread.js), or why there is none. Runs once, after Page Candidates delivered the page (Finalize Page? said
// "deliver"); the delivered item passes through unchanged with `second_read` added. What the reader gets: the page, the keyword, the
// website's own live pages, the facts on file, the sources this run verified and the regulatory digest. Never the first-draft review,
// the edit history or our grade.
const it = $input.first().json || {};
let prev = {}; try { prev = $('Parse Brief').first().json || {}; } catch (e) { prev = {}; }
let ip = ''; try { ip = String(($('Normalize Input').first().json || {}).client_ip || ''); } catch (e) { ip = ''; }
let reg = '', asOf = ''; try { const r = $('Collect Regulatory Facts').first().json.regulatory; if (r && typeof r.digest === 'string') reg = r.digest; if (r && r.as_of) asOf = String(r.as_of); } catch (e) { reg = ''; }
if (!reg) reg = String(((prev.regulatory || {}).digest) || '');
// W05-A (wave 0.5): "today" is the website's market day (Regulatory Plan's as_of, in the market's time zone), the date the page carries;
// a run with no as_of falls back to the UTC day the run started
if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) asOf = String(((prev.regulatory || {}).as_of) || '');
if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) { const t = Date.parse(String(prev.started_at || '')); asOf = new Date(isNaN(t) ? Date.now() : t).toISOString().slice(0, 10); }
const second_read = RR.plan(it, { ...prev, client_ip: prev.client_ip || ip }, { regulatory_digest: reg, today: asOf });
return [{ json: { ...it, second_read } }];
