/*__EXCLUSIONS__*/
/*__SITE_MODEL__*/
/*__OWN_COVER__*/
/*__READER__*/
// Accepts an object (from the Structured Output Parser) or a string with/without code fences or surrounding text
const parseAgentJson = (raw) => {
  if (raw && typeof raw === 'object') return raw;
  let s = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try { return JSON.parse(s); } catch (e) {}
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) {} }
  throw new Error('AI did not return valid JSON. Output was: ' + s.slice(0, 300));
};

/*__REACH__*/
/*__KW_INPUTS__*/
const prev = $('Merge Keyword Data').first().json;
const verdict = parseAgentJson($input.first().json.output);

/*__PAGE_TYPE__*/
// 2026-10-12 (FIX_PLAN D10): the verdict answers in free text; the fixed option decides the length band, the schema and
// meta.json, and the sentence itself travels on as page_notes so the brief still hears what the verdict asked for.
const allowed = ['GO', 'GO_WITH_CHANGES', 'AVOID'];
if (!allowed.includes(verdict.verdict)) verdict.verdict = 'GO_WITH_CHANGES';

// ---- a keyword the site already has a page for (P2-5, 2026-10-12; inlined into the v3 node *Parse Verdict* by build_v4.py section 39) ----
// Run 444 asked for a verdict on "uae e invoicing penalties" — a search the site's own /insights/…-uae-e-invoicing-penalties-… page has
// answered since 2026-08-21 — and the answer was "Build an informational penalty guide", recommended_page "Guide": the owner was told to
// create a second URL for a search their page already answers (the exact D11 harm). *Collect Client Pages* now sets `existing_page` from
// the page inventory (SM.matchPage) and `v5/prompts/verdict.txt` forbids a new page; this is the deterministic half of it.
// ---- R7 (2026-10-13, re-rating): no verdict may ask for FAQPage schema (G2 removed it from everything we write) ----
// Live: exec 486 `verdict_changes[3]` said "add … an FAQ with schema matching the People Also Ask questions" and the ladder's exec 495
// `what_must_change[3]` said "Add an FAQ section that mirrors the People Also Ask questions, with FAQ and Service schema". Google stopped
// showing FAQ rich results on 2026-05-07, so the owner would spend time on markup that shows nothing. The prompt now forbids it; this
// rewrites the schema part out of any line that still asks for it and keeps the FAQ *section*, which is what AI assistants quote.
const FAQ_SCHEMA_RE = /\b(?:faq\s*page|faqpage)\b(?:\s+(?:schema|markup|structured\s+data))?|\bfaq\b[^.;]{0,20}?\b(?:schema|markup|structured\s+data)\b|\b(?:schema|markup|structured\s+data)\b[^.;]{0,20}?\bfaq\b/gi;
const noFaqSchema = (line) => {
  let t = String(line == null ? '' : line);
  if (!FAQ_SCHEMA_RE.test(t)) return t;
  FAQ_SCHEMA_RE.lastIndex = 0;
  t = t.replace(/\b(an?\s+)?FAQ\s+with\s+(?:its\s+own\s+)?(?:schema|markup|structured data)\b/gi, '$1FAQ section (question headings answered directly)')
       .replace(/\bwith\s+FAQ\s+and\s+([A-Z][A-Za-z]*)\s+schema\b/g, 'with $1 schema')
       .replace(/\bFAQ\s+and\s+([A-Z][A-Za-z]*)\s+schema\b/g, '$1 schema')
       .replace(/\b(?:an?\s+)?FAQ\s*(?:page)?\s+(?:schema|markup|structured data)\b/gi, 'an FAQ section (question headings answered directly)')
       .replace(/\bFAQPage\b/gi, 'an FAQ section (question headings answered directly)')
       .replace(/\bwith\s+(?:FAQ|FAQPage)\s+(?:schema|markup|structured data)\b/gi, '')
       .replace(/\s{2,}/g, ' ').replace(/\s+([,.;])/g, '$1').replace(/,\s*\./g, '.').trim();
  return t;
};
verdict.risks = (Array.isArray(verdict.risks) ? verdict.risks : []).map(noFaqSchema);
verdict.reasons = (Array.isArray(verdict.reasons) ? verdict.reasons : []).map(noFaqSchema);
/*__PAGE_CLAIMS__*/
// ---- R38 / R48 (2026-10-16): what the verdict says about the client's own page is checked against what was measured on that page ----
// Exec 608: reasons[3] said "Its visible text has no mandate dates, ... no tables, ... no author or date" about a page that has all three.
// The Verdict Agent now reads the page's facts; this removes any sentence of its reasons / risks that the digest still contradicts (or that
// the digest says could not be checked) and says so in `page_claims_dropped`. R48: "FTA-accredited" -> the Ministry of Finance's framework.
const PCD = prev.existing_page_digest || null;
const page_claims_dropped = [];
const pcClean = (arr) => (Array.isArray(arr) ? arr : []).map(x => { const r = PC.filterText(x, PCD, {}); r.dropped.forEach(d => page_claims_dropped.push(d)); return PC.fta(r.text); }).filter(Boolean);
verdict.risks = pcClean(verdict.risks);
verdict.reasons = pcClean(verdict.reasons);

// ---- R18 (2026-10-14, FIX_PLAN §3.12): a feasibility score computed on a results page nobody could read ----
// Execution 549: both SERP calls answered 40101 inside an HTTP 200, were billed, ran once — and the run still said
// "winnable, GO_WITH_CHANGES 68" and wrote a page. The retry is wired above; when it fails too, the competition was never seen,
// so there is no verdict and no number — only what was tried, and the suggestion to run the check again.
// ---- W07-A (2026-10-31, docs/page-quality-2026-10-29/WAVE06.md "Open resilience item"): the pages it stands on, unread ----
// The K1 run of 2026-10-30 (WAVE06 section 9): the page reader's account was out of balance, every read answered HTTP 402, and this node
// still scored the keyword 38, held it on that score and told the client "/ms-365-erp-uae has no title, main heading or Search Console search
// on file" about a page nobody had read. Each reader node now reads a refused page again another way (v5/code/_reader.js); when that failed
// too for the pages this verdict stands on (the page the website already has for the search, the site's own pages, the pages that rank),
// there is no verdict, no score, no hold, no duplicate or existing-page decision and no page: the run says the pages could not be read and
// why, and is charged only for the check. A page that is simply down or blocked is not a refusal and is judged as before.
const PU = (() => {
  if (typeof RD === 'undefined') return null;
  const all = (n) => { try { return $(n).all().map(i => (i && i.json) || {}); } catch (e) { return null; } };
  const client = all('Read Client Pages'), comp = all('Read Competitor Pages'), retry = all('Retry Blocked Pages');
  if (![client, comp, retry].some(l => l && RD.refusedIn(l).length)) return null;
  const first = RD.firstRefusal([client, comp, retry]);
  let acp = {}; try { acp = $('Analyze Competitor Pages').first().json || {}; } catch (e) { acp = {}; }
  const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const compAsked = comp ? comp.filter(j => j && Object.keys(j).length).length : 0;
  const compRead = n0(acp.competitors_read != null ? acp.competitors_read : prev.competitors_read);
  const clientAsked = client ? client.filter(j => j && Object.keys(j).length).length : 0;
  const clientRead = n0(prev.client_pages_read);
  const ex = (prev.existing_page_unread && prev.existing_page_unread.url) ? prev.existing_page_unread : null;
  const missing = [];
  if (ex) missing.push('the page your website already has for this search (' + ex.url + ')');
  if (clientAsked && !clientRead) missing.push('your own pages');
  if (compAsked && !compRead) missing.push('the pages that rank for it');
  if (!missing.length) return null;
  const writesPU = prev.include_content === true && !prev.verdict_only && String(prev.mode || 'keyword').trim() === 'keyword';
  const why = RD.clientReason(first);
  return { refused: first, missing, existing: ex, client: { asked: clientAsked, read: clientRead }, competitors: { asked: compAsked, read: compRead }, client_reason: why,
    reason: 'No verdict is given for this keyword: ' + why + ', so ' + missing.join(' and ') + ' could not be read. Nobody has looked at them, so a score, '
      + 'a hold or a match with a page you already have would be invented.' + (writesPU ? ' Nothing was written and only the check was charged.' : '')
      + ' This is a problem on our side, not with your keyword: run it again later.' };
})();
const EV56 = (() => {
  const sf = prev.serp_features || {}; const ev = prev.serp_evidence || null; const kd = prev.keyword_data_evidence || null;
  const out = !!(sf.unavailable || (ev && ev.unavailable));
  const why = String((ev && ev.error) || sf.error || 'no answer from the search data provider').slice(0, 160);
  const again = (ev && ev.retried) ? (Number(ev.attempts) > 2 ? ' The search was sent ' + ev.attempts + ' times (the last time as a lighter request) and failed every time.' : ' The search was sent again once and failed again.') : '';   // F-SERP: up to three attempts
  return {
    withheld: out || !!PU,   // W07-A: the pages it stands on could not be read
    evidence: { serp: out ? 'unavailable' : 'read', error: out ? why : '', asked: ev ? ev.asked : 1, checked: ev ? ev.checked : (out ? 0 : 1),
      retried: ev ? ev.retried : 0, attempts: ev ? (Number(ev.attempts) || 1 + (Number(ev.retried) || 0)) : 1, read_light: !!sf.light_read, keyword_data: (kd && kd.unavailable) ? 'unavailable' : 'read',
      ...(PU ? { pages: 'unread', pages_error: RD.describe(PU.refused) } : {}) },
    reason: (!out && PU) ? PU.reason : out ? 'No score is given for this keyword: the live Google results could not be read (' + why + ').' + again
      + ' Nobody has seen the pages that rank, the featured snippet or the AI Overview, so any number here would be invented.' + (sf.retryable === false ? ' Run the check again.' : ' This is a temporary problem with the search data provider, not with your keyword. Run the check again later.') : ''
  };
})();
// ---- B1-1 (2026-10-15, benchmark area 1): the two numbers the keyword report puts in front of a customer ----
// They used to be whatever the Verdict Agent typed into its JSON. The same run computes both properly: `_reach.js` turns a keyword
// difficulty and this site's reach into a plan with a month RANGE and an uncalibrated chance band against a published base rate, and
// `KWI.calibrate` turns a monthly volume into visits through the measured click loss of the results page that was actually read.
const KD77 = (prev.keyword_data || {}).keyword_difficulty ?? null;
const VOL77 = (prev.keyword_data || {}).search_volume ?? null;
const SF77 = prev.serp_features || {};
const SERP_READ77 = SF77.unavailable !== true;
let CACHE77 = []; try { CACHE77 = $('Load Site Cache').all().map(i => i.json); } catch (e) { CACHE77 = []; }
// the site's reach: the stored measurement (30 days, same market) or, failing that, the size tier of the authority this run already
// read. Never a fresh paid pull: a keyword report does not buy the ranked-keywords list.
const RI77 = reachCached(CACHE77, prev.domain, prev.location_code) || { ...reachFrom(null, prev.site_authority || null), ranked: null, cached: false };
const TA77 = reachTopic(RI77.ranked === undefined ? null : RI77.ranked, prev.keyword, RI77.reach, { domain: prev.domain || 'your site',
  reason_missing: RI77.cached ? 'the reach of your site was measured on ' + String(RI77.cached_at || '').slice(0, 10) + ' across all your keywords, not this topic, so this report cannot say how strong you are on this topic in particular'
    : 'a keyword report does not buy the list of keywords your site ranks for (the keyword research and the ladder do)' });
const DIFF77 = prev.domain ? difficultyForYou(KD77, TA77.reach, {}) : null;
const PLAN77 = DIFF77 ? reachPlan(DIFF77, reachStrong(RI77, null), reachMeasured(TA77 && TA77.used ? { used: true } : RI77, null)) : null;   // R49: no chance band on a reach no measured ranking supports
const FORYOU77 = !DIFF77 ? null : { difficulty_for_you: DIFF77, plan_type: PLAN77.plan_type, months: PLAN77.months, months_range: PLAN77.months_range,
  stretch: PLAN77.stretch, chance: PLAN77.chance, reach_used: TA77.reach, reach_basis: TA77.used ? 'topic' : 'site',
  site_reach: TA77.site_reach, topic_reach: TA77.topic_reach, kd_known: KD77 != null,
  label: reachLabel(DIFF77, PLAN77.plan_type === 'none' ? null : PLAN77) + (TA77.used ? ' \u00b7 measured on this topic' : ''),
  note: TA77.note + (KD77 == null ? ' This keyword has no measured difficulty either, so it is counted as that reach + ' + REACH_CFG.unknown_kd + '.' : '') };
const TTR77 = (!PLAN77 || PLAN77.plan_type === 'none') ? null : { months: PLAN77.months, months_range: PLAN77.months_range, basis: 'modelled',
  chance: PLAN77.chance, note: reachChanceText(PLAN77), base_rate: REACH_BASE_RATE, model_months: verdict.time_to_rank_months ?? null };
// the visits a page in the top three would take. A results page nobody could read yields NO estimate: what it takes in clicks before
// anyone reaches a link is exactly what was not seen.
const VIS77 = (() => {
  const model = verdict.expected_monthly_visits_top3 ?? null;
  if (!SERP_READ77) return { visits: null, basis: 'unknown', basis_text: 'not estimated: the live results page could not be read, so the clicks it takes before anyone reaches a link are unknown',
    note: 'No visit estimate: the live Google results could not be read (' + String(SF77.error || 'no answer').slice(0, 120) + ').', model_estimate: model, loss_applied: '' };
  const c = KWI.calibrate({ volume: VOL77, serp_types: SF77.features_present || [] }, {});
  const basis_text = c.traffic_basis === 'calibrated' ? 'calibrated with your own Search Console data'
    : c.traffic_basis === 'modelled' ? 'modelled from the provider\'s monthly volume, after this results page\'s click loss'
    : 'not estimated: no monthly search volume was measured for this keyword';
  return { visits: c.traffic_potential, basis: c.traffic_basis,
    basis_text: basis_text + ((SF77.ai_overview || {}).not_read ? ' (the AI Overview was not read on this attempt, so any clicks it takes are not counted)' : ''),   // F-SERP
    note: c.traffic_note, model_estimate: model, loss_applied: KWI.lossText(SF77.features_present || []) };
})();
const EXP = (prev.existing_page && prev.existing_page.url) ? prev.existing_page : null;
let verdict_changes = Array.isArray(verdict.what_must_change) ? verdict.what_must_change.map(x => PC.fta(noFaqSchema(x))).filter(Boolean) : [];   // R7: never FAQPage schema
let existing_page_action = null;
if (EXP) {
  existing_page_action = 'improve';
  // a line that explicitly asks for a SECOND URL is dropped; a line that asks for work ("Build an informational penalty guide of about
  // 1,800 words …", the live answer of run 444) is kept but addressed to the page that exists, so no advice and no word target is lost.
  const NEW_URL_RE = /\b(?:new|second|separate|dedicated|additional|another|standalone|stand-alone)\s+(?:page|url|post|article)\b|\b(?:publish|create|build|launch|spin up)\s+an?\s+(?:new\s+)?(?:page|url)\b/i;
  const CREATE_RE = /^(?:please\s+)?(?:build|create|write|publish|launch|produce|develop|make|add|set up)\b/i;
  const WORDS_RE = /\b(\d[\d,]{2,5})\s*words?\b/i;
  const dropped = verdict_changes.filter(c => NEW_URL_RE.test(c));
  verdict_changes = verdict_changes.filter(c => !NEW_URL_RE.test(c))
    .map(c => CREATE_RE.test(c) ? c.replace(CREATE_RE, (m) => 'On that page, ' + m.toLowerCase()) : c);
  // the length the verdict asked for is the brief's clamp (D10): never lose it with the line that happened to carry it
  const lostWords = dropped.map(c => (c.match(WORDS_RE) || [])[1]).filter(Boolean)[0];
  if (lostWords && !verdict_changes.some(c => WORDS_RE.test(c))) verdict_changes.push('Aim for about ' + lostWords + ' words on that page.');
  verdict_changes.unshift('Improve the page the site already has for this search (' + EXP.url + '): update and expand it, keep its URL, and do not publish a second page for this keyword.');
}
// W05-B (2026-10-30, BEFORE_AFTER K4 / K1): a page matched by its address but not confirmed by its own title, heading or searches is not this
// run's page (Collect Client Pages), and a page the client chose to write beside ("Write it anyway") is left as it is: the report and the brief
// both say so, so nothing is written onto another page's address
const EPU = (!EXP && prev.existing_page_unconfirmed && prev.existing_page_unconfirmed.url) ? prev.existing_page_unconfirmed : null;
const EPI = (!EXP && prev.existing_page_ignored && prev.existing_page_ignored.url && !prev.existing_page_ignored.planned_url) ? prev.existing_page_ignored : null;
if (EPU) verdict_changes.unshift('Write this as a new page at its own address. ' + EPU.url + ' was considered and is left as it is: ' + String(EPU.why || 'it is not the page for this search') + '.');
if (EPI) verdict_changes.unshift('Write this as a separate new page at its own address, as you chose. ' + EPI.url + ' stays as it is; link to it where it helps the reader.');

/*__VERDICT_OWN__*/
/*__REMEASURE__*/
/*__DUP_TARGETS__*/

// ---- W0-D (page-quality programme 2026-10-29, PLAN Fix 4 + §2.1, REVIEW_CODE H1 / M1 / M3, owner decisions D1 / D2 / D17) ----
// Run 3299 wrote "ms 365 erp", a keyword this verdict scored 42 and called a poor use of effort, because the router stopped only on AVOID,
// and the site already had pages for the same search, which the late duplicate check found only after the brief, the copy and three
// editor rounds had been paid for. Now, BEFORE the brief, a page run is held for the client's OK when:
//   * the verdict scored the keyword under 50 (a null score, NOT_CHECKED or withheld, is "not checked": never a hold, the reason printed);
//   * or the site already has a page aimed at the same search (DUP.targets, the late check's own rule, moved before the brief).
// Not held (the owner's priority: the pages that already rank are ladder pages, case studies and refreshes, and nothing here may stop them):
//   * a case study (its keyword is the case name, so a search score says nothing), an AI answer page (`ai_target`: chosen for AI answers,
//     often with no search volume), a refresh of an own page (`existing_page_url`), a page of a keyword ladder (the ladder checked its main
//     keyword when it was planned; production exec 949, the guide that ranks, is one): no score hold;
//   * a ladder page is still checked for a duplicate, but only a page carrying ALL of its words counts (the ladder's planned neighbour shares
//     most of them on purpose), and never the keyword's own page (its slug, or the ladder's planned address);
//   * a run started with `hold_ack` (the client chose "Write it anyway"): no hold, `verdict_acknowledged` true; the fit cap downstream stays.
// Automatic runs (the cadence, a ladder's own page runs, the tracker, case-study spawns) are held in SHADOW mode first (D17: two cadence
// cycles): `would_hold` and the reasons are logged in the run and reported in its callback, the page is written as before. Runs a person
// started (the app, the form, the API) are asked ("Needs your OK"). A hold writes no brief, no copy and no edit: the run delivers the
// verdict report with `hold: { score, reasons, alternatives }` on stage `content`, and its cost is what the verdict cost.
const HOLD = (() => {
  // W05-B (2026-10-30, BEFORE_AFTER "Holds"): the line at 50 sat inside the verdict's own noise (one keyword read 52, 42, then 46; K3 was held
  // at 42 and its page was the best of 31). A score is now held on its own only when it is clearly low (under 40); between 40 and 50 only when
  // a second signal agrees: little demand (under 20 searches a month and no Search Console impressions for the site) or a page the site
  // already has for the search. Every reading is logged (`readings`), and a run the client acknowledged keeps the acknowledged reading.
  const CFG = { threshold: 50, clear: 40, low_volume: 20, automatic: 'shadow', recheck_days: 90 };   // D17: automatic -> 'enforce' after two cadence cycles of shadow logs (owner review of the first 20 holds, RE L4)
  const S = (v) => String(v == null ? '' : v).trim();
  const ip = S(prev.client_ip).toLowerCase();
  const automatic = /^(cadence|ladder|tracker|casestudy|audit):/.test(ip);
  const writes = prev.include_content === true && !prev.verdict_only && S(prev.mode || 'keyword') === 'keyword';
  const ackRaw = prev.hold_ack;
  const ack = ackRaw && typeof ackRaw === 'object' && !Array.isArray(ackRaw) ? ackRaw : (ackRaw === true ? {} : null);
  const num = (v) => (v === '' || v == null || !Number.isFinite(Number(v))) ? null : Math.round(Number(v));
  const runScore = EV56.withheld ? null : num(verdict.score);
  const ackScore = ack ? num(ack.score) : null;
  // the client said "Write it anyway" to the reading it was shown: the written run keeps THAT reading (the verdict is not moved by a re-read)
  const score = (ack && ackScore != null && runScore != null) ? ackScore : runScore;
  const caseStudy = !!(S(prev.case_id) || (prev.case_study && typeof prev.case_study === 'object' && Object.keys(prev.case_study).length) || /case stud/i.test(S(prev.page_type)));
  const aiPage = !!(prev.ai_target && typeof prev.ai_target === 'object' && S(prev.ai_target.question));
  // W05-B: a refresh is a page the client (or the pipeline) NAMED. A page this run found by itself (EXP from the inventory or the sitemap) is
  // not a refresh the client asked for: K4 was waved through as "a refresh of a page your website already has" for a page it had matched
  const found = !!EXP && S(EXP.source) !== '' && S(EXP.source) !== 'provided';
  const refresh = !!S(prev.existing_page_url) && !found;
  const ladderPage = !!S(prev.ladder_id) && prev.ladder_rung != null && prev.ladder_rung !== '';
  const exemptScore = caseStudy ? 'a case study: its keyword is the case name, so a search score says nothing about it'
    : aiPage ? 'a page written to be cited in AI answers: chosen for the question, not for search volume'
    : refresh ? 'a refresh of a page your website already has'
    : ladderPage ? 'a page of your keyword ladder: the ladder checked its main keyword when it was planned' : '';
  const exemptDup = caseStudy ? 'a case study' : aiPage ? 'a page written for an AI answer' : refresh ? 'a refresh of a page your website already has' : '';
  // ---- the duplicate gate (the late check's rule, before the brief) ----
  let MODEL = prev.site_model && typeof prev.site_model === 'object' ? prev.site_model : null;
  if (!MODEL) { try { MODEL = ($('Site Model').first().json || {}).site_model || null; } catch (e) { MODEL = null; } }
  const ownUrl = EXP ? EXP.url : '';
  const dup = (MODEL && !exemptDup) ? DUP.targets(prev.keyword, SM.pages(MODEL), { skip: [ownUrl, S(prev.existing_page_url)], self: [S(prev.ladder_target_url)], self_aware: true, slug_self: true, ladder: ladderPage })
    : { targets: [], partial: [], self: [], basis: MODEL ? '' : 'no page inventory of the website was available, so a duplicate could not be checked' };
  const dupHit = !EXP && dup.targets.length > 0;   // a page the verdict already redirected the run to (existing_page) is improved, not duplicated
  // W05-B (BEFORE_AFTER K1): the page this run found for the search (confirmed by its own title, heading or searches in Collect Client Pages)
  // used to be rewritten silently. A person who started the run is now asked first: improve that page, or write a separate new one.
  const existingHit = found && !exemptDup && !ladderPage;
  const kwn = (s) => S(s).toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim().split(/\s+/).filter(Boolean).sort().join(' ');
  const kwKey = kwn(prev.keyword);
  // the site's own Search Console reading for this search (the page inventory's searches): the impressions, and the pages Google shows for it
  const gsc = (() => { const out = { read: false, impressions: 0, pages: [] };
    for (const p of (MODEL ? SM.pages(MODEL) : [])) { const qs = Array.isArray(p.queries) ? p.queries : []; if (qs.length) out.read = true;
      if (SM.isGone && SM.isGone(p)) continue;
      const hit = qs.filter(q => kwn((q || {}).query || (q || {}).keyword) === kwKey).reduce((a, q) => a + (Number((q || {}).impressions) || 0), 0);
      if (hit > 0) { out.impressions += hit; out.pages.push({ url: SM.canonUrl ? SM.canonUrl(MODEL, p.url) : p.url, title: S(p.title), impressions: hit }); } }
    out.pages.sort((a, b) => b.impressions - a.impressions); return out; })();
  const volume = num(((prev.keyword_data || {}).search_volume));
  const lowDemand = volume != null && volume < CFG.low_volume && gsc.impressions === 0;
  const second = dupHit || existingHit || lowDemand;
  // ---- the value gate ----
  let valueHit = false; let notChecked = '';
  if (score == null) notChecked = PU ? 'the pages this check needs could not be read, so nothing was held for it: ' + PU.client_reason
    : EV56.withheld ? 'the verdict could not score this keyword (' + (EV56.evidence.error || 'the live results could not be read') + '), so nothing was held for it'
    : 'the verdict gave no score, so nothing was held for it';
  else if (!exemptScore && (score < CFG.clear || (score < CFG.threshold && second))) valueHit = true;
  const band = score == null ? 'not checked' : score < CFG.clear ? 'clearly low' : score < CFG.threshold ? 'near the line' : 'above the line';
  const readings = { this_run: runScore, acknowledged: ackScore, used: score, band, clear_under: CFG.clear, line: CFG.threshold,
    second_signal: { low_demand: lowDemand, duplicate: dupHit, existing_page: existingHit, volume, impressions: gsc.read ? gsc.impressions : null, search_console_read: gsc.read },
    decision: !writes ? 'no page in this run' : ack ? 'acknowledged by the client' + (ackScore != null && runScore != null && ackScore !== runScore ? ': this run read ' + runScore + ', the acknowledged ' + ackScore + ' is kept' : '')
      : score == null ? 'not checked' : valueHit ? (score < CFG.clear ? 'held: clearly low' : 'held: near the line with a second signal') : score < CFG.threshold ? (exemptScore ? 'not held: ' + exemptScore : 'not held: near the line, no second signal') : 'not held for the score' };
  const would = writes && !ack && !PU && (valueHit || dupHit || existingHit);   // W07-A: never a hold (score, duplicate or existing page) on pages nobody read
  const mode = !writes ? 'off' : automatic ? CFG.automatic : 'enforce';
  const kw = S(prev.keyword);
  const reasons = [];
  const demandText = 'little demand (' + (volume === 0 ? 'no measured searches' : 'about ' + volume + ' searches a month') + (gsc.read ? ' and no impressions for your site in Search Console' : '') + ')';
  if (writes && valueHit) reasons.push('Our verdict scored "' + kw + '" ' + score + ' out of 100' + (score < CFG.clear ? ', clearly under the ' + CFG.threshold + ' we write without asking'
    : ', under the ' + CFG.threshold + ' we write without asking, and ' + (lowDemand ? 'the search has ' + demandText : 'your website already has a page for it'))
    + ((verdict.reasons || [])[0] ? ': ' + String(verdict.reasons[0]).replace(/\s+/g, ' ').slice(0, 260) : '.'));
  if (writes && dupHit) reasons.push('Your website already has a page aimed at this search: ' + dup.targets.map(t => t.url).join(', ')
    + '. A second page would compete with it for the same search; improving that page is usually the faster way up.');
  if (writes && existingHit) reasons.push('Your website already has a page for this search: ' + EXP.url + (S(EXP.title) ? ' ("' + S(EXP.title).replace(/[“”"]/g, '') + '")' : '')
    + '. Choose "Improve the existing page" to rewrite that page at its own address (it keeps what it has already earned), or "Write it anyway" for a separate new page at a new address of its own; your existing page then stays as it is.');   // W06-B (WAVE05 3.3): the copy says exactly what each choice does
  const shown = gsc.pages.filter(p => !EXP || p.url.toLowerCase().replace(/\/+$/, '') !== String(EXP.url).toLowerCase().replace(/\/+$/, ''));
  if (writes && (dupHit || existingHit) && shown[0]) reasons.push('Google already shows ' + shown[0].url + ' for this search (' + shown[0].impressions + ' impressions in Search Console).');
  // ---- what to do instead (up to three, each one click in the app) ----
  const alternatives = [];
  const seen = new Set();
  const addAlt = (a) => { const k = a.kind + '|' + S(a.keyword).toLowerCase() + '|' + S(a.url).toLowerCase(); if (seen.has(k) || alternatives.length >= 3) return; seen.add(k); alternatives.push(a); };
  // W05-B (BEFORE_AFTER item 4): a recommended target must be a search a person types, never a headline ("verify an ASP in 5 minutes") or a
  // slash form ("AI development company Dubai/UAE": the first form is kept). The searches Google itself lists (related searches, People Also
  // Ask) and the verdict's secondary keywords come first; a quoted phrase from the verdict's advice is used only when it passes the same test.
  const searchOf = (raw) => {
    let q = S(raw).replace(/[‘’“”"]/g, '').replace(/\s+/g, ' ').trim();
    q = q.replace(/([A-Za-z0-9]+)(?:\s*\/\s*[A-Za-z0-9]+)+/g, '$1');   // "Dubai/UAE" -> "Dubai"
    q = q.replace(/[.!,;:]+$/, '').trim();
    if (!q || q.length > 80 || /[:;!|()[\]{}<>=+*#@]/.test(q)) return '';
    const w = q.split(/\s+/);
    if (w.length < 2 || w.length > 8) return '';
    if (/\b(?:in|within|under)\s+\d+\s+(?:minutes?|mins?|steps?|days?|hours?|seconds?|weeks?)\b/i.test(q)) return '';   // a headline promise
    if (/^\d+\s+(?:ways|tips|reasons|steps|things|mistakes|questions|signs)\b/i.test(q)) return '';
    if (/^(?:verify|discover|learn|get|see|find out|choose|meet|unlock|boost|stop|start|build|make|read|download|book|talk|contact|hire|use|add|create|write|improve|try|let|why you|here)\b/i.test(q)) return '';
    if (/\b(?:you|your|we|our|us)\b/i.test(q)) return '';   // a sentence to a reader, not a search
    return q;
  };
  const known = new Set([...(((prev.serp_features || {}).related_searches) || []), ...(((prev.serp_features || {}).people_also_ask) || []), ...(OWNV.secondary || [])].map(s => kwn(searchOf(s))).filter(Boolean));
  if (writes && (valueHit || dupHit || existingHit)) {
    const improveUrl = existingHit ? EXP.url : ((dup.targets[0] || {}).url || ((OWNV.related || [])[0] || {}).url || '');
    if (improveUrl) addAlt({ kind: 'improve', label: 'Improve the existing page', url: improveUrl, keyword: kw,
      why: existingHit ? 'your website already has this page for the search: improving it keeps its address and what it has already earned'
        : dupHit ? 'your website already has this page for the search: a refresh keeps its address and what it has already earned' : 'your website has a page on this topic: strengthening it is cheaper than a new page' });
    if ((dupHit || existingHit) && shown[0] && shown[0].url !== improveUrl) addAlt({ kind: 'improve', label: 'Improve the page Google shows', url: shown[0].url, keyword: kw,
      why: 'Google already shows this page for the search (' + shown[0].impressions + ' impressions in Search Console)' });
    // the verdict's own re-target: a quoted search in its first changes ("such as 'Microsoft Dynamics 365 ERP implementation partner UAE'"),
    // else its first secondary keyword the site does not already hold elsewhere; either one only when it reads as a real search
    const quoted = (() => { const out = []; for (const c of verdict_changes.filter(l => !/^Write this as (?:a new|a separate new) page/.test(String(l || ''))).slice(0, 3)) { const re = /(?:^|[\s(])['‘“"]([^'’”"]{8,90})['’”"](?=[\s.,;:)]|$)/g; let m;
      while ((m = re.exec(String(c || '')))) { const q = m[1].trim(); if (q.split(/\s+/).length >= 2 && q.toLowerCase() !== kw.toLowerCase() && !/[.!?]$/.test(q)) out.push(q); } } return out; })();
    const pool = [...quoted, ...(OWNV.secondary || [])].map(searchOf).filter(q => q && kwn(q) !== kwKey);
    const retarget = pool.find(q => known.has(kwn(q)) && quoted.map(searchOf).includes(q)) || pool[0] || '';
    if (retarget) addAlt({ kind: 'retarget', label: 'Use the recommended target', keyword: retarget, page_type: PT.of(verdict.recommended_page || prev.page_type, prev.page_type),
      why: 'the verdict recommends this search instead of "' + kw + '"' });
    const kc = OWNV.keyword_covered;
    if (kc && S(kc.keyword) && S(kc.keyword).toLowerCase() !== kw.toLowerCase()) addAlt({ kind: 'rung', label: 'Write the planned page', keyword: S(kc.keyword), ladder_id: S(kc.ladder_id),
      why: S(kc.note) || 'this search is already planned on your website' });
  }
  const hold = would ? { score, threshold: CFG.threshold, clear: CFG.clear, kinds: [valueHit ? 'score' : '', (dupHit || existingHit) ? 'duplicate' : ''].filter(Boolean), reasons, alternatives,
    duplicates: dupHit ? dup.targets : existingHit ? [{ url: EXP.url, title: S(EXP.title) }] : [], mode, held: mode === 'enforce', readings,
    rule: 'A page waits for your OK when our verdict scores its keyword under ' + CFG.clear + ' out of 100, or under ' + CFG.threshold + ' when the search also has little demand, or when your website already has a page for the same search.',
    next: mode === 'enforce' ? 'Nothing was written and only the check was charged. Choose "Write it anyway", use the recommended target, or improve the existing page.'
      : 'Started automatically, so the page was written as before; this check only records what it would have asked you.' } : null;
  return {
    applies: writes, mode, would, held: would && mode === 'enforce', hold, ack: ack ? { score: ackScore } : null, score, readings,
    exempt: writes ? [exemptScore && ('score: ' + exemptScore), exemptDup && ('duplicate: ' + exemptDup)].filter(Boolean).join('; ') : '',
    not_checked: writes ? notChecked : '', duplicate_check: { checked: !!MODEL && !exemptDup, targets: dup.targets, partial: dup.partial, self: dup.self, basis: dup.basis },
    recheck_days: CFG.recheck_days
  };
})();

return [{
  json: {
    ...prev,
    verdict: EV56.withheld ? 'NOT_CHECKED' : verdict.verdict,
    verdict_score: EV56.withheld ? null : (HOLD.ack && HOLD.score != null ? HOLD.score : (verdict.score ?? null)),   // W05-B: after "Write it anyway" the acknowledged reading is kept
    verdict_readings: HOLD.readings,
    verdict_evidence: EV56.evidence,
    ladder_remeasure,   // A-21
    score_withheld: EV56.withheld,
    score_withheld_reason: EV56.reason,
    verdict_reasons: EV56.withheld ? [EV56.reason, ...(PU ? [] : (verdict.reasons || []))] : (verdict.reasons || []),   // W07-A: the model's reasons on pages nobody read are not shown
    verdict_risks: PU ? [] : (verdict.risks || []),
    recommended_page: PT.of(verdict.recommended_page || prev.page_type, prev.page_type),
    page_notes: PT.notes(verdict.recommended_page, PT.of(verdict.recommended_page || prev.page_type, prev.page_type)),
    secondary_keywords: OWNV.secondary,
    secondary_covered: OWNV.covered,   // A-5: the searches the site already holds elsewhere, kept off this page and named
    existing_related: OWNV.related, sections_covered: OWNV.sections, already_on_page: OWNV.already_on_page, keyword_covered: OWNV.keyword_covered, own_coverage_checked: OWNV.checked,
    verdict_changes: PU ? [] : verdict_changes,   // W07-A: no advice on pages nobody read
    page_claims_dropped,
    verdict_exclusions: EXC.fromVerdict(verdict_changes, verdict.topics_to_skip),   // A-18: what this page must not cover
    existing_page_action,
    expected_visits_top3: EV56.withheld ? null : (VIS77.visits ?? null),
    expected_visits: EV56.withheld ? null : VIS77,
    time_to_rank_months: EV56.withheld ? null : (verdict.time_to_rank_months ?? null),   // kept for the ladder and older readers: it is the MODEL's own number and every surface now says so
    time_to_rank: EV56.withheld ? null : TTR77,
    for_you: EV56.withheld ? null : FORYOU77,
    reach_info: FORYOU77 ? { reach: RI77.reach, method: RI77.method, cached: !!RI77.cached, cached_at: RI77.cached_at || null, evidence_kept: !!RI77.ranked } : null,
    // W0-D: the hold before the brief (the router *Need Content?* reads verdict_hold; the callback carries hold / hold_shadow)
    verdict_hold: HOLD.held,
    would_hold: HOLD.would,
    hold_mode: HOLD.mode,
    hold_reason: HOLD.would ? HOLD.hold.reasons.join(' ') : '',
    hold: HOLD.held ? HOLD.hold : null,
    hold_shadow: (HOLD.would && !HOLD.held) ? HOLD.hold : null,
    hold_exempt: HOLD.exempt,
    hold_not_checked: HOLD.not_checked,
    hold_ack: HOLD.ack,
    hold_recheck_days: HOLD.recheck_days,
    verdict_acknowledged: !!HOLD.ack,
    duplicate_check: HOLD.applies ? (PU ? { checked: false, targets: [], partial: [], self: [], basis: 'not checked: ' + PU.client_reason } : HOLD.duplicate_check) : null,
    // W07-A: the pages this verdict stands on could not be read; a page run stops before the brief (*Need Content?*) and says why
    ...(PU ? { pages_unread: PU, pages_unread_stop: HOLD.applies } : {})
  }
}];