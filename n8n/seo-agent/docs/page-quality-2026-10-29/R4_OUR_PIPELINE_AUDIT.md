# R4: our page pipeline, audited end to end (2026-10-29)

Read-only audit of how Alaventra decides, researches, writes, checks, finalises and hands over a page, measured against what a page
needs to rank quickly and to pass an expert reviewer. Code at HEAD `8c0eeb46` (`n8n/seo-agent/v5/code`, `v5/prompts`, `build_v4.py`,
generated `harness/code_v4`, and `app/`). Evidence: the production page run **exec 3299** (`SEOagentV4Full01`, 2026-10-28 10:00-10:20
UTC, keyword "ms 365 erp", Service Page, techand.ai) and its finalize **exec 3336** (`SEOagentFinalize`, 11:04-11:05 UTC), read node by
node from the saved executions, plus the delivered, final and live page text. Client text is not reproduced beyond short snippets.

This extends, and does not repeat, `docs/content-quality-2026-10-27/R1_PIPELINE_ANALYSIS.md` (why pages came out "not ready") and
`R2_MARKET_RESEARCH.md` (what the leaders gate on). Those led to H1-H3 (commits `e89cc09c`, `dea3231a`): blocking vs advisory, best draft
kept, section edits, every unsupported claim a question, the finalize workflow. **This audit finds the opposite failure: after H1-H3 a
weak page can now come out "Ready to publish, 100/100".** The causes are mostly upstream of the writer (whether and what to write) and in
the finalize re-check, not in the copy itself.

Severity: **High** = a client can publish a wrong, broken or self-competing page, or our score misleads them; **Medium** = the page is
weaker than it should be or a reviewer would mark it down; **Low** = polish. Every `file:line` is at `8c0eeb46`.

---

## 1. Summary

### 1.1 The eight known defects: all confirmed, with one correction

| # | Defect | Confirmed | Root cause (file:line) | Severity |
|---|---|---|---|---|
| 1 | Meta description destroyed | Yes | `_claims.js:304-305` claim-checks the `Meta Description:` line; the round-1 mark wrapped it; `_page_fix.js:119` `removeAt` on a meta line deletes only the text, leaving `Meta Description:` empty; **two** meta readers then cross the newline: `Content_QA.js:154` (`:\s*(.+)$`) and `Blog_Package.js:13` (same). Result: meta = `Slug: ms-365-erp-uae` (20 characters), also in the HTML `<meta name="description">`, `og:description` and the Service schema `description` | High |
| 2 | The meta sentence became client question q4 and was put in the body | Yes | `PF.questions` (`_page_fix.js:481`) does not know the claim came from the meta (`where` is dropped); `Finalize_Apply.js:78-80` places a "yes" whose neutral is not in the page into the best-matching body section | High |
| 3 | Finalize dropped the page run's blocker and graded 100 | Yes | `Finalize_Parse_Brief.js:97-100` sends Content QA an empty context (no site model, no competitors, no coverage target, no facts, no style guide, `target_word_count` = the page's own word count); `Originality_Check` compared 0 pages, so `duplicate_targets` was empty; `Finalize_Verdict.js:23-28` never reads the page run's `qa_blocking`; the app's `finalizeBody` (`app/shared/src/page-review.ts:360-399`) does not send it | High |
| 4 | The grade ignores what reviewers measure | Yes | `Content_QA.js:761-772`: structure, coverage, readability, specificity, banned phrases, length. No repetition, intent fit, cannibalisation, proof, source quality or publish errors. A 20-character meta passes the structure check (`:761` tests only `<= 155`) | High |
| 5 | Verdict 42/100 and the page was written anyway | Yes | `build_v4.py:1112`: `Verdict Router` stops only on `verdict === 'AVOID'`; `GO_WITH_CHANGES` at any score writes | High |
| 6 | Answers appended as fragments; a slogan offered as proof | Yes | `Finalize_Apply.js:46-51` picks a section by word overlap; `Finalize_Merge.js:30` accepts any edit with 60% of the answer's words present; `:38-41` appends a confirmed sentence as its own paragraph; `PF.prefillOf` (`_page_fix.js:471`) accepts any client-page sentence that shares half the words, in either direction; `prefilledAnswer` (`page-review.ts:280-283`) turns a prefill into an answer on "Accept all" | High |
| 7 | No local regulatory research | Yes, and worse than reported | `build_v4.py:844`: the only facts search is `<keyword> statistics <year>` with every country and city name **removed** from the keyword. No regulator query exists. The homepage the run read even lists the client's post on the 2027 deadline; its body was never read | High |
| 8 | No downloads on the final version | Yes | Finalize returns Markdown only (`Finalize_Verdict.js:56-64`); the app inserts the final report with no files (`app/server/src/services/pageReview.ts:547`) | High |

**Correction to the note we gave the client.** We said British spelling followed "the UAE default because nothing was set for techand".
That is wrong. Exec 3299 has `style_guide.spelling = "British English"`, `spelling_source = "the style guide"`: techand's stored style
guide set it. Meanwhile the three techand pages this run read use American forms 13 times ("Optimize", "organization") and British forms
3 times. The fix is not "set it in the style guide": it is to check the style guide against the client's own site (gap G30).

### 1.2 The most important new findings

1. **The verdict never saw what the site already has (High, G1).** *Own Coverage (Run)* builds `own_coverage` (the site's ladders, drafts
   and pages on the topic), but the next nodes rebuild their item from `$('Prepare Keyword Run')` (`harness/code_v4/Parse_Sitemap_Index.js:384`,
   `Collect_Site_URLs.js:385`), so the field is gone before *Parse Verdict* (`Parse_Verdict.js:1244` reads *Merge Keyword Data*). In exec
   3299: `own_coverage_checked: false`, `existing_related: []`, and the Verdict Agent prompt contains none of the ladder text. Yet
   `own_coverage` (computed and dropped) shows "ms 365 erp" is **rung 2 of the ladder "dynamics 365 erp system"**, already written once
   (exec 2195, `not_ready`), beside a published sibling post for "is microsoft dynamics 365 an erp system". The A-5 / A-23 protections of
   2026-10-17 are inert on this path.
2. **Cannibalisation is found at the end, by accident (High, G4).** The only duplicate check (`Originality_Check.js:63-79`) runs after
   about $1.5 of writing, compares title tokens longer than 2 characters, and for "ms 365 erp" ("365", "erp") matched the Business
   Central page by chance, while the page the client's reviewer named (the existing blog post) was excluded because it had been read.
3. **The verdict's own advice was not applied (High, G2).** It said: make it a Dynamics 365 ERP service page and use "ms 365 erp" as a
   secondary term. The page kept "ms 365 erp" as title, H1, slug and primary keyword.
4. **Page type is never checked against what Google shows on a page run (High, G3).** 2 of the 6 pages read were service pages; the
   rest were a forum thread, a directory and long guides. Ladders only print a note (`Ladder_Plan.js:284-293`), cadence defaults every
   ladder rung to "Service Page" (`Cadence_Plan.js:360`).
5. **Repetition is not measured anywhere (High, G12).** No code path detects a point made several times; the copywriter is told to put
   the keyword in the H1, the first sentence, two H2s and the last section (`copywriter.txt:72`) and to turn every PAA question into a
   heading (`copywriter.txt:61`, `strategy_brief.txt:91`).
6. **The candidate rule kept the weaker draft (High, G18).** The edit replaced weak sources with three Microsoft Learn links but was set
   aside because it was 151 words over a length band built from **2** pages; the Critic's three high-severity problems carry no weight in
   `PF.better` (`_page_fix.js:313-346`).
7. **The client's answers become "facts" that later support claims (High, G16).** Stored now as business facts for every future page:
   "Microsoft Parter" (typo) as a credential, "Deep UAE & GCC knowledge" as proof, the meta sentence, and two call-to-action lines.
8. **A wrong-place splice came from a similarity guess (High, G25).** `PF.neutralIn` (`_page_fix.js:477`) attached the claim "Our sector
   focus is banking ..." to an unrelated checklist sentence; Finalize swapped it in, so it now ends the "Data hosting" item.

### 1.3 Replay in one line

With the fixes in section 8, exec 3299 would **not** have written this page: the verdict (42, own coverage restored) would have held for
the client's OK with two alternatives (fold a short "MS 365 vs Dynamics 365" section into the existing post; improve
`/dynamics-365-business-central-uae`). If the client had insisted, the page would have been re-typed to an explainer section or delivered
"not ready: a page for the same search exists", with a working meta, the 2027 deadline from an official source, one statement of each
point, and a grade near the reviewer's 63, not 100 (section 7).

---

## 2. The trace: "ms 365 erp" from request to the live page

| Step | What happened | Evidence |
|---|---|---|
| Request | App form run, `pipeline_source: form`, no `ladder_id`, page type Service Page, `qa_max_rounds: 5` | *Parse Verdict* output |
| Own coverage | Computed: rung 2 of `lad_mvjsa7995bsr` "dynamics 365 erp system", status `not_ready`; sibling rung "is microsoft dynamics 365 an erp system" published; rung 3 "microsoft dynamics erp", head "dynamics 365 erp system". **Dropped** before the verdict | *Own Coverage (Run)* vs *Merge Keyword Data* |
| SERP | AI Overview seen (cites microsoft.com, visionet, gartner); PAA "Is d365 an ERP system?", "What is agentic ERP?", "Which big companies use Dynamics 365?"; 2 of 6 pages read are service pages | `serp_features`, `length_band.pages` |
| Facts search | Query `ms 365 erp statistics 2026` (country words stripped), 10 snippets kept, 9 `weak`, 1 Microsoft Learn release note | *Facts SERP*, *Collect Facts* |
| Keyword data | 10 searches a month, 5 of 12 months non-zero, KD unknown; modelled visits 1 a month after AI Overview loss | `keyword_data`, `expected_visits` |
| Verdict | `GO_WITH_CHANGES`, **42**. Reasons: "The keyword alone won't generate leads"; risk: "a page built only on this 10-search keyword would be a poor use of effort"; change 1: make it a Dynamics 365 ERP service page, use "ms 365 erp" as a secondary term; change 4 asks for "a budget range table, labelled as an estimate from your own projects" and "UAE case studies" (nothing on file) | *Parse Verdict* |
| Router | Not AVOID, so the brief runs | `build_v4.py:1112` |
| Brief | Target 1,500, band 900-2,400 from the page-type fallback (2 service pages read); evidence plan: 2 weak market figures (Visionet, Landbase) + 1 release note; FAQs = all PAA questions incl. "agentic ERP" and "big companies"; meta and CTA say "then book a consultation with Tech&" | *Parse Brief* `content_brief` |
| Copywriter | 2,300 words, coverage 93%, keyword 8 times | QA round 1 |
| Critic | 66, revise. High: market figures on weak pages; internal links "not confirmed" (false: the Critic was told no site pages were read because `site_description` is null); compliance claims with no primary source. Medium: thin SAP answer, padding "big companies" / "agentic ERP" | *Parse Critique* |
| QA 1 | Claims: the **meta description** and "Our sector focus is banking ..." (both rules-only); hard blocker 1 = duplicate page | *Content QA* [0], `page_fix.history` |
| Source search | 5 bag-of-words SearXNG queries; 1 page "verified" (a Microsoft Learn page whose captured text is mostly site chrome) | *Page Source Plan*, `page_fix.sources` |
| Editor | Sections s4-s7; meta not editable (head is not a section). Output 2,551 words, vendor sources 1 -> 3 | *Edit Check*, QA [1] |
| Candidates | Edit set aside: "further from the targets of the pages that rank (0.252 against 0)", i.e. 151 words over 2,400. Copywriter draft kept; editing stopped | `page_fix.history` |
| Neutralize | Both claims removed: meta line emptied; QA round 3 reads meta = "Slug: ms-365-erp-uae" (20) | QA [2] |
| Delivered | `not_ready`: "This website already has a page for the same search: /dynamics-365-business-central-uae"; grade 92; 7 questions. Prefills: q1 proof <- "Deep UAE & GCC knowledge" (homepage), q2 <- "Does Microsoft Dynamics have ERP?", q3 / q7 <- "Dynamics 365 8 min read" (blog listing chrome) | callback `qa_*` |
| Finalize request | Sends `meta_description: "Slug: ms-365-erp-uae"`, answers, no blocking list | *Finalize Webhook* body |
| Finalize | q1 woven (slogan), q2 "not placed" (typo answer lost), q4 meta sentence "placed" into a body section, q5 swapped into the wrong sentence, q6 "consultation is free of charge" appended to the first section; Originality compared 0 pages | *Finalize Apply / Merge / Verdict* |
| Final | `ready`, **100/100** (length 15 because the target is the page's own length; coverage 25 because no term list), meta 20 characters as advice only, no files | `body.delivery`, `body.grade` |
| Live | Published; reviewer 63/100 | `live/page.txt` |

---

## 3. The eight known defects: root cause, exact fix, acceptance test

### D1. Meta description claim-checked, emptied and misread (High)

- **Root cause.** `_claims.js:304-305` pushes the meta line as an item (`kind: 'meta'`) that the subject rules judge; a meta with a call
  to action ("then book a consultation with Tech&") reads as a business `process` claim (support 47%). `Content_QA` wraps it in
  `[Confirm: ...]`; `PF.neutralize` -> `neutralSentence` -> `removeAt` (`_page_fix.js:116-119`) treats a META line like a heading and
  removes only the span, so the line becomes `Meta Description:` with nothing after it. Two readers then use `:\s*(.+)$` with the `m`
  flag: `\s*` matches the newline, so the value is the next line: `Content_QA.js:154` (`metaOf`) and `Blog_Package.js:13` (`metaRe`,
  which also deletes the Slug line from the article it builds). `_page_fix.js:199` already uses the correct `[ \t]*`.
- **Knock-on.** `Blog_Package.js:48` (`meta_description`), `:214` (meta.json), `:219` (`og:description`), `:260` (HTML `<meta>`), and
  `Content_QA.js:847/852` (Service schema `description`) all carry "Slug: ms-365-erp-uae".
- **Fix.**
  1. `_claims.js:304-306`: skip the meta line like `Title:` / `Slug:` (it is search-result copy written from the brief, not a statement
     on the page). Keep one narrow check: a meta that names a price, guarantee, timeline or number not on file (`CTA_TERMS`,
     `TIME_TERM`, `numsOf`) is rewritten deterministically by dropping that clause.
  2. `Content_QA.js:154` and `Blog_Package.js:13`: `^(label):[ \t]*(.*)$`; an empty value is empty, never the next line.
  3. `PF.fix` step c (`_page_fix.js:199-210`): when the meta description is missing or under 70 characters, rebuild it: the brief's
     `meta_description` if it passes the narrow check, else the Quick answer's first sentence trimmed to 120-155 characters with the
     keyword. Never leave it empty.
  4. `removeAt` (`_page_fix.js:119`): a META line is never edited by a sentence removal.
  5. A missing or short meta becomes a **publish error** (section 5): fixed by the system, and blocking only if it cannot be fixed.
- **Acceptance.** Harness: (a) a draft whose meta ends "then book a consultation with Acme." yields no claim; (b) the input
  `Meta Description:\nSlug: x` gives `metaOf('Meta Description') === ''` and `PF.fix` writes a 120-155 character meta; (c) Blog Package
  on that input keeps `slug: x` and its `meta_description` does not start with `Slug:`; (d) the Service schema description equals the meta.
  Replay: *Content QA* round 3 of exec 3299 (anonymised fixture) gives `meta_description_length` 120-155. Live: next page run, check the
  package, HTML head and schema.

### D2. The meta sentence became a client question and was placed in the body (High)

- **Root cause.** The claim record has `where: 'meta'`, but `PF.questions` (`_page_fix.js:481`) and the question object do not carry it;
  q4 went out with `section: ''`, `in_page: 'left_out'`. On "yes", `Finalize_Apply.js:78-80` found no neutral wording and gave the
  editor "put this sentence into this section word for word"; it now sits after the Business Central vs F&SCM table (final page line 67).
- **Fix.** D1 removes the cause. Also: questions carry `where`; a claim from the head (`meta`, `title`) never becomes a question; Finalize
  applies a head answer to the head line only.
- **Acceptance.** Harness: a claim with `where: 'meta'` produces no question. Replay exec 3336 with q4 "yes": body unchanged.

### D3. Finalize dropped the blocker and graded 100 (High)

- **Root cause.**
  - `Finalize_Parse_Brief.js:97-100`: `facts: []`, `term_model: []`, `coverage_target: null`, `competitors: []`, `style_guide: null`,
    `site_description: null`, `content_brief.target_word_count = ownWords`. So in *Content QA*: coverage ratio = 1 (25/25), length =
    15/15 by construction, no figure is checked against a source, no brand check, no Site Model (no duplicate check), and *Originality*
    reports `pages_compared: 0` with `passed: null`.
  - `Finalize_Verdict.js:23-28` classifies only the new QA result and keeps a textual blocker only if its text is new; the page run's
    hard blocker (`duplicate_page`) is not in the input at all: `finalizeBody` (`page-review.ts:360-399`) sends no `qa_blocking`.
  - The grade basis even says "measured on this final version": true, but measured against itself.
- **Fix.**
  1. The app sends the page run's `qa_blocking`, `length_band`, `coverage_target` (with the term list), `facts` / `sources_cited`,
     `style_guide` and `site_urls` from the stored report payload (they are already in the callback) in `finalizeBody`; or the engine
     loads them from the content log by `content_request_id`.
  2. `Finalize_Verdict`: every **hard** blocker of the page run stays until the client resolves it by an explicit decision (new answer
     kinds: "publish as an update of <url>" which sets the target URL, or "this page differs because ..." which is recorded and shown).
  3. The grade is computed with the page run's band and terms, never with the page's own length as target.
  4. A finalize that cannot reproduce a check says so ("not checked: no page text to compare") and cannot print "Ready" on that basis.
- **Acceptance.** Replay exec 3336 with the page-run fields: `delivery_status = not_ready` (duplicate page) and grade length points < 15.
  App test: `finalizeBody` includes `blocking` when the payload has `qa_blocking`. Live: finalize a `not_ready` page without resolving
  the blocker: it stays `not_ready`.

### D4. The grade does not measure what reviewers measure (High)

- **Root cause.** `Content_QA.js:761-772`. The client's reviewer scored usefulness 22/25, fit with what ranks 8/20, proof and trust 7/15,
  UAE accuracy 11/15, structure 12/15, ready to publish 3/10. Our 100 gave full points for structure (the 20-character meta passes
  `metaDesc.length <= 155`), coverage (no term list in finalize), readability, specificity (any digit counts), banned phrases and length.
  The Critic (66 on the first draft, close to the reviewer's 63) is never re-run and never gates (`qa_grade.first_draft_review` is a note).
- **Fix (detail in section 5).** Replace the six-part content score with a grade built on the reviewer's dimensions, each computed
  deterministically where possible, plus an LLM judge on the delivered version, with **caps**: a duplicate page, a broken meta, a
  wrong-place sentence or a page type that does not match the results page each cap the grade; "Ready to publish" needs no caps and a
  grade of at least 80.
- **Acceptance.** On the anonymised "ms 365 erp" final page the new grade is 55-72 and not "Ready"; on a labelled set (R5) the grade is
  within 10 points of the expert score on at least 80% of pages and never "Ready" when the expert gives under 70.

### D5. A 42/100 keyword was written without asking (High)

- **Root cause.** `build_v4.py:1112` (`Verdict Router`): `verdict === 'AVOID' && !force_content`. The prompt reserves AVOID for "clearly
  poor" fit (`verdict.txt:51`), so a low-value keyword lands in GO_WITH_CHANGES and is written. The app form starts a content run in one
  go (no pre-check), and the cadence and autopilot can do the same.
- **Fix.** A third route **hold**: score under 50, or `expected_visits.visits < 5`, or a GO_WITH_CHANGES whose changes re-target the
  keyword, page type or URL (G2), or `keyword_covered` (G1). Hold = no brief, no copy (saves about $1.4-1.9 of Claude), a callback stage
  `verdict_hold` with the reasons and up to three alternatives (the verdict's re-target, the existing page to improve, a better rung).
  The app shows it as a "Needs your OK" item: "Write it anyway" (sends `force_content` with `acknowledged_score`), "Use the recommended
  target", "Improve the existing page". Cadence and autopilot never pass `force_content` on a hold.
- **Acceptance.** Harness: verdict 42 / GO_WITH_CHANGES: *Need Content?* false, callback stage `verdict_hold`, cost reservation released;
  with `force_content` the brief runs. App test: the hold renders with the three actions. Live: verdict-only run on "ms 365 erp" (about
  $0.13) returns `verdict_hold`.

### D6. Answers appended as fragments; slogans offered as proof (High)

- **Root cause.**
  - Placement: `Finalize_Apply.js:46-51` `sectionFor` picks the section with the highest word overlap with question + answer; q6
    ("consultation is free of charge") went to "Is Microsoft 365 an ERP?" instead of the call to action.
  - Weaving: the editor added the fact as a last sentence ("At Tech&, consultation is free of charge."); `Finalize_Merge.js:30` accepts any
    section where 60% of the answer's words appear; `:38-41` appends a confirmed sentence as its own paragraph when the edit is refused.
  - Prefill: `PF.prefillOf` (`_page_fix.js:471-475`) takes any sentence of the business facts or of up to 20,000 characters of each read
    client page (`Page_Candidates.js:73-75`) sharing half the words in **either** direction. "Deep UAE & GCC knowledge" shares 2 of its 4
    words with the proof question; "Dynamics 365 8 min read" is blog listing chrome.
  - One click: `prefilledAnswer` (`page-review.ts:280-283`) makes every prefill an `answer`; `factOf` (`:286-289`) stores it for all
    future pages.
- **Fix.**
  1. **Slots, not similarity.** Each question category has a home: terms and consultation -> the call to action; credential -> the
     "why us" / partner section or the author line; proof -> a proof block in the decision section; detail -> the section the brief
     question named. The Strategy Brief returns `questions_for_client` as `{question, section, category}`.
  2. **Rewrite the host sentence.** The editor job names the sentence the fact changes ("rewrite this sentence so it states: ..."), not
     "work this in". `Finalize_Merge` refuses an edit where the answer is a standalone sentence at the end of a paragraph whose other
     sentences share under 20% of its content words, and never appends: an unplaced answer is reported "not placed: tell us where".
  3. **Prefill only what answers the question type**: from business facts and profile first; a proof prefill must name a project,
     client or sector and an outcome; a credential prefill must contain a credential noun; no prefill under 6 words or without a verb; no
     prefill from listing pages (`SM.isListing`) or lines matching reading-time / navigation chrome.
  4. "Accept all suggestions" applies only to yes/no claim questions, never to text answers.
- **Acceptance.** Replay exec 3336: q6 lands inside the CTA sentence, q1/q2/q3/q7 have no prefill, no answer is appended as a separate
  last sentence. Harness: `prefillOf("Do you have UAE ERP projects with outcomes...", ["Deep UAE & GCC knowledge"])` is null.

### D7. Local regulatory facts never researched (High)

- **Root cause.** The facts search (`build_v4.py:843-848`, *Facts SERP* -> `Collect_Facts.js`) is one query, the keyword with every
  country and city name **stripped** plus "statistics <year>", depth 20, snippets with a digit only. There is no step that asks "which
  rules, dates and thresholds apply to this topic in this market". In exec 3299 the business facts list "UAE e-invoicing (Peppol), VAT
  compliance" as content topics, the homepage the run read links the client's own post on the 2027 deadline, and the site has four
  e-invoicing posts in `site_urls`; none of it reached the brief. The Source search (`Page_Source_Plan.js:20-24`) builds bag-of-words
  queries from a sentence ("uae model runs peppol invoices exchanged through service provider") with no official-domain scoping.
- **Fix.** A **regulatory facts** step after the competitor read, before the verdict:
  1. `v5/data/regulators.json`: per market, topics (VAT, e-invoicing, corporate tax, data residency, labour, licensing, AML) -> official
     domains (UAE: `mof.gov.ae`, `tax.gov.ae`, `u.ae`, `uaelegislation.gov.ae`; KSA: `zatca.gov.sa`; ...).
  2. Topic detection from the keyword, secondary keywords, the business facts' "content topics", the brief terms and the client's own
     post titles.
  3. Per topic: SearXNG (free) with `site:` on the official domains plus "timeline / deadline / phase / go-live / threshold <year>"; read
     the top 2 pages through the reader already used for sources; extract dated obligations (date + obligation verb + subject + threshold)
     with the URL and the paragraph.
  4. Read the client's own posts on that topic (top 2 by `SM.pageScore`) as the client's position and for consistency, never as the
     source of a date.
  5. The brief and copywriter get **REGULATORY FACTS** with the rule: a page on a regulated topic in this market states the current
     timeline from the official source, or says none could be confirmed. Content QA records `regulatory.required / stated / source_tier`.
- **Acceptance.** Harness fixture: keyword "ms 365 erp", UAE, facts mentioning e-invoicing: the plan contains a `site:mof.gov.ae`
  e-invoicing query; a fixture MoF page yields one dated item with URL; the brief prompt contains it; a draft without it gets the
  "local accuracy" penalty. Live (free): research-only run on techand.ai and compare the dates with the client's post and the reviewer's
  note (1 January 2027 for revenue of AED 50m and above, to be confirmed against the official page, not taken from us or them).

### D8. No files on the final version (High)

- **Root cause.** `Finalize_Verdict.js:56-64` returns Markdown, changes, delivery, grade and cost only. `runFinalize`
  (`pageReview.ts:524-575`) inserts the report with `payload.html` (rendered by `renderArticleHtml`) but no rows in `files`; the report
  view shows downloads from `report.files` only (`ReportView.tsx:55-75`).
- **Fix.** Finalize runs the same tail as a page run on the final Markdown: *Blog Package* (HTML + Markdown + meta.json), *Build Word
  File*, *Render PDF* (Gotenberg, local), and reuses the original report's rendered images (no new image cost). The response carries the
  files as the content callback does; `runFinalize` stores them like a callback. Fallback when the engine is old: the app copies the
  original images and writes the HTML and Markdown it already renders.
- **Acceptance.** App test: a finalize result with files gives the new report at least HTML, Markdown and Word files and the original's
  images. Engine harness: Finalize output contains `files[]` with the four kinds. Live: one finalize, check the download cards.

---

## 4. Every other gap, by stage

### A. Whether to write, and what

**G1. Own coverage dropped before the verdict (High).**
- Evidence: `own_coverage` present on *Own Coverage (Run)* and *Has Domain?*, absent from *Fetch Sitemap Index* onwards (exec 3299);
  `Parse_Sitemap_Index.js:384` and `Collect_Site_URLs.js:385` (generated) build from `$('Prepare Keyword Run')`; *Parse Verdict*
  `own_coverage_checked: false`; the verdict prompt line `verdict.txt:14` (`own_coverage_text`) rendered nothing.
- Fix: *Parse Verdict* and the Verdict Agent read `$('Own Coverage (Run)').first().json` directly (try/catch, same as other cross-node
  reads), or the two sitemap nodes spread their input. Extend `lineage_lint.py`: a field a node writes for a named reader must reach that
  reader along `main` (walk the graph, as build section 55 does for the ledger).
- Acceptance: harness wiring test from *Own Coverage (Run)* to *Parse Verdict* on the real connection graph; replay exec 3299: verdict
  changes open with "This search is already planned on the site" and `existing_related` lists the Business Central and F&O pages.

**G2. Verdict re-targeting is text, not structure (High).**
- Evidence: change 1 "use 'ms 365 erp' as a secondary term"; the page kept it as title, H1, slug, primary keyword; `strategy_brief.txt:5`
  only prints "Recommended page type instead".
- Fix: the verdict returns structured fields `target_keyword`, `page_type`, `target_url` (existing page to improve) and `merge_into`
  (a page that should carry this as a section). A difference from the request triggers the hold (D5); once accepted, the brief uses them.
- Acceptance: harness: a verdict with `target_keyword` different from the request holds; after acceptance the brief's
  `primary_keyword` is the new target.

**G3. Page type not checked against the results page on page runs (High).**
- Evidence: page type came from the form; `length_band.pages` shows 2 of 6 service pages; no `page_type_note` on page runs; ladder plans
  only note a mismatch (`Ladder_Plan.js:284-293`); cadence defaults rungs to "Service Page" (`Cadence_Plan.js:360`); the reviewer gave
  8/20 for "fit with what ranks".
- Fix: compute the dominant kind of the pages read (`KWI.serpPageTypes` / the kinds Parse Analysis already assigns). If the requested
  type does not match a clear majority (at least 4 of 6), hold and propose the matching type or a section on an existing page; the brief
  gets the kind and the rule. Ladders: re-type instead of noting.
- Acceptance: harness: SERP kinds {guide 3, forum 1, directory 1, service 1} + "Service Page" -> hold with "Guide"; replay exec 3299 holds.

**G4. Cannibalisation found late and by token chance (High).**
- Evidence: `Originality_Check.js:63-79`; keyword tokens over 2 characters = {365, erp}; the Business Central page matched 100%; the
  sibling post was in `readKeys` and skipped; the check ran after the copy; Finalize had no Site Model.
- Fix: one pre-brief check `OWN.cannibal(keyword)`: (1) own URL with Search Console impressions for the query or a close variant
  (`seo_query_history`); (2) own URL in the top 30 of the SERP already bought; (3) ladder rungs and drafts (G1); (4) title/H1/slug
  match with intent words, not tokens of 3+ characters. Outcome: the URL to improve, a merge proposal, or "no conflict". Keep the late
  check as a safety net, never as the first line.
- Acceptance: harness with techand fixtures: "ms 365 erp" -> conflict with the sibling post (ladder) and a weak title match flagged as
  low confidence; "dynamics 365 business central uae" -> the Business Central page.

**G5. Ladders plan several pages for one intent (Medium).**
- Evidence: ladder `lad_mvjsa7995bsr` has rung 2 "is microsoft dynamics 365 an erp system" (supporting "is microsoft 365 an erp
  system"), rung 2 "ms 365 erp" (10 a month), rung 3 "microsoft dynamics erp", head "dynamics 365 erp system": one intent, four pages.
  The "Microsoft 365 is not an ERP" point is the same across them, which also drives repetition inside the page.
- Fix: a rung needs its own results page (fewer than 3 of the top 7 shared with any sibling, the B2-4 rule applied as a hard rule) and a
  demand floor (volume at least 30 a month or Search Console impressions), otherwise it becomes a supporting keyword of its sibling.
- Acceptance: harness on the ladder's stored rows: "ms 365 erp" folds into rung 2 as supporting.

**G6. A form run for a ladder rung loses the ladder (Medium).**
- Evidence: no `ladder_id`; planned URL `/ms-365-erp`, delivered slug `ms-365-erp-uae`; the keyword was written twice (2195 and 3299).
- Fix: when `own_coverage.self` is a rung of an active ladder and the request has no `ladder_id`, adopt the rung's fields (target URL,
  links, siblings) and say so; the app's duplicate check ("Check this first") also counts a `not_ready` draft of the same keyword.
- Acceptance: harness: a form request matching a rung gets `ladder_id` and the planned slug.

**G7. The verdict asks for content that would be invented (Medium).**
- Evidence: "a budget range table, labelled as an estimate from your own projects", "UAE case studies" with `proof_context: none`.
- Fix: print `PF.contract` into `verdict.txt`; *Parse Verdict* drops "from your own projects / case studies / testimonials" asks when
  nothing is on file and turns them into client questions.
- Acceptance: harness: such a change line with no proof on file becomes a question, not a brief instruction.

### B. Research, facts and sources

**G8 = D7** (regulatory research).

**G9. Facts are search snippets, mostly weak, and weak market figures reach the page (High).**
- Evidence: 9 of 10 facts `tier: weak`; evidence plan = 2 weak market figures + 1 release note, against the prompt's own rule ("never for
  a market or compliance figure", `strategy_brief.txt`); no deterministic guard (no `evidence_plan` filter in *Parse Brief*); the Critic
  flagged both as high; both are live.
- Fix: *Parse Brief* drops any evidence item whose URL is `weak` (`SRC.tier`) and whose fact is a market, adoption, cost or compliance
  figure; *Content QA* treats a figure whose only source is weak as a soft blocker (rewrite without the number), not a 0.25 advisory;
  the facts step adds one research/press query and the regulatory step (D7).
- Acceptance: harness: an evidence plan with a weak market figure loses it; a draft citing it gets a soft blocker.

**G10. Source verification queries are bags of words (Medium).**
- Evidence: `Page_Source_Plan.js:20-24`; queries like "dynamics tends suit companies already standardised microsoft azure"; the one
  "verified" page's evidence is site chrome ("Access to this page requires authorization").
- Fix: query templates per claim type (product capability -> `site:learn.microsoft.com <product> <capability>`; regulation -> the
  regulator domains); evidence must be a paragraph containing the claim's key terms after stripping navigation text.
- Acceptance: harness: the claim "Both Dynamics 365 ERP products can be set up for UAE VAT" produces a `site:learn.microsoft.com` query;
  chrome-only evidence is rejected.

**G11. Too little of the client's own site is read (Medium).**
- Evidence: 3 pages, 1,800 characters each into the brief (`strategy_brief.txt:19`); service pages known by title only; the 2027 post
  unread.
- Fix: read the top 4-6 own pages by topic score plus the service page that matches the topic; give the brief a facts digest (claims,
  dates, phases) rather than raw excerpts; feed them to the claim corpus.
- Acceptance: replay: the brief context contains the e-invoicing post's dated statements and the matching service page's phases.

### C. Brief and writing

**G12. Repetition is not measured or prevented (High).**
- Evidence: the "Microsoft 365 is not an ERP" idea appears in the intro, the Quick answer, the first H2, its callout box, the "Is D365 an
  ERP system?" answer and the CTA (5 near-identical sentences counted mechanically, 6 by the reviewer); "five questions" names two
  different lists (lines 132 and 192 of the final page) and the CTA's "use the five questions" is ambiguous. No repetition code exists
  (`grep repetit|repeat` in Content QA / PF / prompts finds only "cut repetition" instructions).
- Fix: a deterministic **proposition check** in Content QA: split into sentences, cluster those sharing at least 60% of content words
  (after removing the keyword and brand), report clusters of 3+ outside the Quick answer, and detect a label ("N questions / steps /
  checks") used for two different lists. Feed each cluster to `PF.plan` as "say it once, here; elsewhere link or cut", count it in the
  grade. Prompts: `copywriter.txt:72` asks for the keyword in H1, first sentence, final section only (two H2s optional); the brief gives
  each proposition one home section.
- Acceptance: harness on the anonymised final page: one cluster of 5, one label collision; after a targeted edit both are gone.

**G13. People Also Ask questions become padding sections (Medium).**
- Evidence: `strategy_brief.txt:91` "reuse the People Also Ask questions"; `copywriter.txt:61` every FAQ becomes a heading; "What is
  agentic ERP?" and "Which big companies use Dynamics 365?" were written (the reviewer called them padding; the Critic too).
- Fix: a PAA question becomes a heading only when it serves the page's buyer and intent (not in the verdict exclusions, at least 50% of
  its content words in the keyword's topic, and not a different product); cap 4; others are left out.
- Acceptance: harness: the two questions are dropped from `faqs` for "ms 365 erp".

**G14. The Critic works blind and only once (Medium).**
- Evidence: `site_description` null, so `critic.txt:14` prints "none read" and the Critic called live internal links unconfirmed;
  the rubric (`critic.txt:18-25`) has no repetition, intent fit or cannibalisation; it runs on the first draft only.
- Fix: pass the client pages read and `site_urls`; add rubric lines for repetition, page-type fit, duplicate pages and local accuracy;
  run it again on the delivered candidate as the judge of D4 (AI Agent node outputs only `{output}`: the prompt must read context via
  `$('Parse Brief').first().json`, never `$json`).
- Acceptance: replay the Critic prompt on 3299 inputs: no "links not confirmed" problem.

### D. Claims, questions and the fact store

**G15. Removed claims get a guessed "neutral" sentence (High; the root of the wrong-place splice).**
- Evidence: `Page_Candidates.js:69-71` attaches a neutral only for `cta` / `reworded` removals; for `removed` claims `c.neutral` is
  undefined, so `PF.questions` calls `neutralIn` (`_page_fix.js:477`, overlap 0.45) and picks an unrelated sentence ("Confirm that it
  meets your sector's data rules, particularly in banking ..."). Finalize's `find` (`Finalize_Apply.js:65`) then replaced that sentence
  with the confirmed claim: it now closes checklist item 5 "Data hosting". The change log even names the wrong section.
- Fix: set `neutral: ''` and `in_page: 'left_out'` for every `removed` claim; record the removal's anchor (section id + the sentence
  before it) and let Finalize put a "yes" back at that anchor only.
- Acceptance: replay exec 3299 -> q5 `neutral` empty; replay exec 3336 -> the claim is restored where it was removed, item 5 unchanged.

**G16. Answers and old CTA lines become business facts (High).**
- Evidence: page-run `business_facts` already ends with two CTA lines from earlier pages; finalize `business_facts_kv` holds "Microsoft
  Parter", "Deep UAE & GCC knowledge" (as proof), the meta sentence, "Our sector focus ..." and "Consultation is free of charge". Every
  later claim check (`PJ.ownText`, finalize `businessFacts`) treats them as support.
- Fix: a typed fact store: a "yes" to a claim stores a normalised fact ("Consultations: free of charge") with its category; a CTA or meta
  sentence is never stored; a proof answer without a project or outcome is stored as "no proof yet"; proper nouns are checked against
  the site's own text ("Parter" -> ask); the Business details screen lists every stored fact with its source page for review.
- Acceptance: app unit tests on `factOf` for each case; replay: "Microsoft Parter" prompts a correction instead of being stored.

**G17. The claim reader is rules-only (Low here).** The second reader stays off (`_promise_judge.js:16`); in this run the two flags
were the meta (D1) and a fair question. Re-evaluate after D1 on the production sentences; no change needed for this case.

### E. Choosing the best draft and the grade

**G18. The candidate rule ignores reviewer-grade problems (High).**
- Evidence: `PF.classify` (`_page_fix.js:277-336`): Critic warnings start with "Editor review:" and match no `ADV` code (`:313`), weak
  sources weigh 0.25, repetition 0, page-type fit 0. Edit 1 (vendor sources 1 -> 3, weak 2 -> 3 because Arratech was added) lost to the
  copywriter draft on 0.252 of length distance against a band built from 2 pages.
- Fix: Critic high problems and weak-only figures count as soft blockers; length counts only when the band comes from at least 3 ranking
  pages, and then by distance outside the band, never inside it; repetition clusters count (G12).
- Acceptance: replay round 2 of exec 3299 with the new weights: edit 1 wins on fewer soft problems, or both are surfaced with the reason.

**G19. One failed edit ends editing; edits are all or nothing (Medium).**
- Evidence: `Page_Candidates.js:117-118` stops after the first non-improving edit with `EDIT_MAX` 3 and `qa_max_rounds` 5 unused; the
  whole edit (4 sections) was discarded for one section's length.
- Fix: accept per section (a section replaces the old one if its own problems fall and no protected property is lost); allow a second
  round when the problem set changed even if the count did not.
- Acceptance: harness: a two-section edit where one section regresses keeps the other.

**G20. The head (meta lines) is out of the editor's reach (Medium).**
- Evidence: `PF.plan` `at()` (`_page_fix.js:351`) returns null for anything in the head; the meta claim was never in an edit job.
- Fix: head problems are fixed deterministically (D1 step 3) or by a dedicated head job.

**G21 = D4** (the grade). **G22. A broken meta is advice only (Medium).** `Content_QA.js:653` warns, `PF.classify` weighs 0.25; make
it a publish error that the system fixes (D1) and that blocks only if unfixable.

### F. Finalize

**G23 = D3.** **G24. Fragment weaving (= D6).** **G25. The finalize contract has no length band (Low).** `Finalize_Apply.js:87`
builds `PF.contract` from a context without `length_band`, so the editor reads "80% to 125% of the target"; fixed by D3's context.

### G. Delivery

**G26 = D8** (files). **G27. Broken meta reaches schema, Open Graph and HTML head (Medium, part of D1).** `Blog_Package.js:48, 214,
219, 260`; `Content_QA.js:847, 852`.

### H. Style, spelling, images, E-E-A-T

**G28. Spelling follows a stored setting that contradicts the site (Medium).**
- Evidence: `_style_guide.js:71-78` prefers the stored `style_spelling` (British); the client's own pages read: 13 American forms, 3
  British. The reviewer flagged British spelling.
- Fix: detect the site's variant from its pages (the `_style_guide.js:15` British/American pairs over the pages read); when the stored
  setting differs, show it on the style guide screen and in the page review ("Your site writes American English; your style guide says
  British"); with no stored setting, use the site's variant before the country default.
- Acceptance: harness: pages with 13 US / 3 UK forms and no stored spelling -> American; with British stored -> a mismatch note.

**G29. Images are text cards with weak alt text (Low, known).** `Image_Cards.js:1-9`, alt "Title card: ..." (`:104`). Short term: alt
text describes the content, not "Title card"; a hero card only when there is no client image. Longer term: diagrams drawn from the
page's own tables (decision tree, comparison) as SVG, and client photos from a media library.

**G30. Weak E-E-A-T for a service page (Medium).** Author is a team ("Tech& Technical Team"), reviewer has no job title or URL, no proof
on file (`proof_context: none recorded`). Fix: for service, comparison and local pages, readiness asks for a named person with a title
and profile URL (author or reviewer) and offers the proof-library intake before writing; a team is published as Organization, not Person.

### I. App

**G31. The app shows "100, Ready to publish" with nothing to contradict it (Medium).** The final version drops the first-draft review
score and shows no caps. With D4 the review panel shows the grade by dimension and any cap ("capped at 60: a page for the same search
exists"). `ReviewPanels.tsx`, `content.tsx`.

---

## 5. What our grade measures vs what reviewers measure

| Reviewer dimension (techand's, 100) | Ours today (`Content_QA.js:761-772`) | Proposed measure | Source of truth |
|---|---|---|---|
| Usefulness 25 | specificity 10 (digits and "for example") | judge score on answering the buyer's task + information gain items covered | Critic re-run (rubric aligned) |
| Fit with what ranks 20 | coverage 25 (terms), length 15 | page kind vs dominant SERP kind (G3), keyword verdict and demand (D5), cannibalisation (G4), coverage within range | SERP kinds, verdict, own coverage |
| Proof and trust 15 | nothing | claims supported, named credentials, proof on file, author/reviewer quality, weak-only figures (G9) | claim check, profile, source tiers |
| Local accuracy 15 | nothing | regulatory facts stated with an official source when the topic is regulated (D7) | regulatory step |
| Structure 15 | structure 25 (10 binary checks) | headings, Quick answer, CTA last, **repetition clusters and list-label collisions** (G12) | deterministic |
| Ready to publish 10 | banned phrases 10 | meta present 120-155, no wrong-place or fragment sentence, no bracket, links live, files produced | deterministic |
| (not in the rubric) | readability 15 | advice only | |

Caps (any one stops "Ready"): duplicate page not resolved, page kind mismatch not accepted, meta missing, a sentence spliced or appended,
a figure with only a weak source, verdict hold not acknowledged. Calibration is R5's job (`R5_GRADING_AND_EVALS.md`): this table is what
the pipeline must expose for it.

---

## 6. n8n and cost constraints that shape the fixes

- **Code sandbox**: no `URL` constructor (parse hosts by regex, as `SRC.host` does), no `Object.defineProperty` / `structuredClone`; the
  harness mimics both. All new kits (repetition, regulatory extraction, cannibalisation) must be pure regex/token code.
- **AI Agent nodes output only `{output}`**: the Critic re-run and any judge must read context with `$('Node').first().json`.
- **Cross-node reads are the cause of G1**: any new field must be read from its producer by name or carried by every node in between;
  extend `lineage_lint.py` rather than trusting fixtures that feed nodes directly.
- **Token ceilings**: Opus thinking counts against `maxTokensToSample`; section edits keep prompts small. A Sonnet judge on the delivered
  page is about 25-35k input tokens, about $0.05-0.10 a page.
- **Paid calls**: the hold (D5) saves the brief, copy and edit (about $1.4-1.9 of Claude) on every held keyword. Regulatory research uses
  SearXNG (free) and the existing reader; a DataForSEO SERP instead costs about $0.002 per query and must not get node-level retries
  (`retry_lint`).
- **Data Tables**: a typed fact store or a `verdict_hold` status needs new columns through `ladder_common.py` + `sync_tables.py`; Ensure
  nodes never add columns.
- **Finalize is synchronous** (app timeout 5 minutes, `pageReview.ts:73`): adding Word/PDF rendering (Gotenberg, local) adds about
  10-20 s; keep the editor call on Sonnet.
- **Public repo**: fixtures from exec 3299/3336 must be anonymised as H1-H3 did (client text replaced), or kept out of git.
- **Two rule copies must change together**: `_fact_answers.js` with `app/shared/src/page-review.ts` `factsForEngine`; `Cadence_Plan.js`
  with `app/server/src/services/cadence.ts`.

---

## 7. Replay: would the fixed pipeline have refused, re-typed or fixed "ms 365 erp"?

1. **Own coverage (G1)** reaches the verdict: "This search is already planned on the site: rung 2 of 'dynamics 365 erp system' (a draft,
   not ready)" and "the site already has /dynamics-365-business-central-uae and /dynamics-365-finance-and-operations-uae on this topic".
2. **Cannibalisation (G4)** before the brief: the sibling post "is microsoft dynamics 365 an erp system" covers the same question
   (its supporting keyword is "is microsoft 365 an erp system").
3. **Page kind (G3)**: 2 of 6 service pages: mismatch for a Service Page.
4. **Hold (D5)**: score 42, 10 searches a month, 1 modelled visit, re-target advised, keyword covered: **held, nothing written**, about
   $1.5 saved. The client sees: "This keyword is worth little on its own. Options: add a short 'MS 365 vs Dynamics 365' section to your
   existing post; improve your Business Central page for 'microsoft dynamics 365 erp uae'; or write it anyway."
5. **If the client presses "write it anyway"**: re-typed to the kind Google ranks or kept as a service page with the risk recorded; the
   brief has the 2027 e-invoicing timeline from the official source (D7), no weak market figures (G9), no "agentic ERP" / "big
   companies" sections (G13), one home per proposition (G12).
6. **Checks**: meta never claim-checked, never emptied (D1); the duplicate page is a hard blocker the client must resolve (D3); the grade
   carries the repetition, source and fit penalties and the duplicate cap (D4): about 60-70, "not ready" until the duplicate is resolved.
7. **Finalize**: answers go to their slots and rewrite host sentences (D6); slogans are not offered (D6); the removed sector claim returns
   to where it was or not at all (G15); the page run's blocker and context travel (D3); files are produced (D8).
8. **What the fixes would not have changed**: text-card images (G29) and the absence of case studies (needs the client).

Verdict: **refused (held) in the default path; re-typed or blocked with an honest grade if forced.** Of the reviewer's deductions, fit
(8/20), local accuracy (11/15), structure (12/15) and ready-to-publish (3/10) are addressed by code; proof (7/15) only by the client's
input and the stricter fact store.

---

## 8. Fix order

| Wave | Items | Why first | Size |
|---|---|---|---|
| 1. Stop shipping broken pages | D1, D2, G15, G22, G27, D3 (carry blockers + context), D8 | Deterministic, small, each one visible to clients today | 1-2 sessions |
| 2. Do not write what should not be written | G1 (lineage), D5 (hold), G2, G3, G4, G6, G7 | Saves money and protects rankings; G1 is a one-node fix with a lint | 2 sessions |
| 3. Measure like a reviewer | D4 grade + caps, G12 repetition, G18 weights, G19 per-section accept, G14 Critic re-run, G31 app | Needs R5's labelled set to calibrate | 2 sessions |
| 4. Research like a local expert | D7 regulatory step, G9, G10, G11 | Data file per market, SearXNG queries, reader | 2 sessions |
| 5. Answers and facts | D6 slots and weaving, G16 typed fact store, prefill rules | Touches app + engine + data | 1-2 sessions |
| 6. Style and trust | G28 spelling detection, G30 E-E-A-T readiness, G13 PAA filter, G5 ladder floors, G29 alt text | | 1 session |

Each wave ends with: build exit 0, harness 0 failed, app tests, the replay of exec 3299 / 3336 on anonymised fixtures, and one live run
on a held-out keyword (not "ms 365 erp") before it counts as done.

---

## 9. Open questions for the owner

1. The hold threshold: score under 50 as proposed, or a value threshold (modelled visits) as well? Should the cadence ever write a held
   rung automatically?
2. Should a client be able to publish over a duplicate-page blocker with a recorded reason, or only as an update of the existing URL?
3. Which markets get regulator maps first (UAE and KSA for current clients; Pakistan for devaicon)?
4. Should the fact store keep the client's raw wording, a normalised fact, or both (shown for approval)?
5. techand's stored style guide says British English while its site writes American: ask the client which they want before the next page.
6. Do we tell techand that the live page's sector sentence sits in the wrong item and that its meta description is broken (quick fixes
   on their side today)?
