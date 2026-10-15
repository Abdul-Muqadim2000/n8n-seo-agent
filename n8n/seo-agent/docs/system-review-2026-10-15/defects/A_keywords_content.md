# Defect dossier — keywords, verdicts, ladders, content, Reply Reader (executor A findings A-1 … A-25 = R34 … R58)

Source run: the 2026-10-15 re-rating on techand.ai, executions 596–616 (`../parts/1_keywords_content.md`). Each entry below was
re-verified on 2026-10-16. The checks were read-only: the saved executions and artefacts in `../files/` and the code at the deployed
commit. The main checkout's `v5/`, `harness/code_v4/` and `build_v4.py` are byte-identical to the worktree that was read (`diff -rq`,
no output).

**Register mapping:** A-n = R(33+n). A-1 = R34 … A-25 = R58.

**Where the evidence is.** Every `exec-<id>.json`, `A-*.json`, `report-<id>.json` file named below sits in the main checkout's
git-ignored folder `n8n/seo-agent/docs/system-review-2026-10-15/files/`. Code paths are relative to `n8n/seo-agent/`.
`harness/code_v4/<Node>.js` is the code that ran in n8n; `v5/code/*.js` is its source. A kit such as `_sources.js` or `_coverage.js` is
inlined by `build_v4.py` into the nodes named below.

**Corrections made while re-verifying** (detail in each entry):

| Register | Change | Reason |
|---|---|---|
| R43 (A-10) | **Medium → High** | The draft's "60%" and the competitor's "90%" are measured two different ways. On the competitor's measure the draft scores 20 of 20. The refusal reason is a wrong number. |
| R39 (A-6) | Narrowed | The supply-chain rung stands. The "openai consulting" half is withdrawn: "openai" is a protected word because the site sells "Azure OpenAI Service", and that SERP is mixed. |
| R42 (A-9) | **Medium → Low**, narrowed | "6 active ladders against `max_active: 2`" is withdrawn. `max_active` caps the ladders the cadence *writes*, and the extra active ladders are queued by design. Only the unannounced pile-up remains. |
| R50 (A-17) | **Medium → Low** | The app's form warns about an existing ladder at the ladder step (`pipeline-notices.ts`). Only the engine's own answer lacks the warning. |
| R52 (A-19) | Narrowed | Only the "Pages read" titles shown to the customer remain. `site_facts` is an internal whitelist for the Critic, built from headings by design and never shown. |
| R53 (A-20) | **Withdrawn** | A ladder row's `writing` means "written, not live" by design. Tracker_Report and Cadence_Plan both read it that way. |

**Root causes still marked hypothesis:** only part of R48 (A-15): why the model wrote "FTA-accredited". The wording is in its inputs; no
code is involved. Every other root cause below is confirmed in code.

Order: High (R34, R35, R36, R37, R38, R43), then Medium (R39, R40, R41, R44, R45, R47, R49, R51, R58), then Low (R42, R46, R48, R50,
R52, R54, R55, R56, R57), then withdrawn (R53).

---

## HIGH

### R34 (A-1) — The ladder plans new "AI consulting" pages, and writes one, on a site that already has a live "AI Consulting" page

- **Severity:** High. Wrong advice: it creates a second page for a search the site already answers.
- **Feature / run:** ladder "ai consulting dubai", exec 610. Its spawned rung page "ai consulting", exec 616.
- **What the customer sees:**
  - Ladder report (`report-4db246f7…`, `payload.notes[1]`): *"Nothing on techand.ai is about "ai consulting dubai" yet — no page and
    no keyword it ranks for — so all 4 page(s) in this plan are new and this topic starts from zero. A search that an existing page
    already answers is never given a second page."*
  - The plan lists /ai-consulting/ (rung 1, written in 616), /ai-consulting-firm/ and /ai-consulting-dubai/ as `status: "new"`.
  - The page report "Page: ai consulting" (`report-338c4333…`) carries `existing_page: null`.
- **Evidence:**
  - Exec 610 → `Load Pages (Model)` (45 rows) holds the row
    `{url: "https://www.techand.ai/ai-copilot-advisory-uae", title: "", h1: "", source: "sitemap"}`. 25 of the 45 rows have an empty
    title.
  - The live page (curl, 2026-10-15 19:18 UTC): `<title>` "AI Consulting & Copilot Advisory UAE | Tech&", H1 "AI Consulting &
    Copilot Advisory Services in UAE". Among its H2s are "What Is AI Consulting & Copilot Advisory?" and "AI Consulting Across
    Strategy, Readiness & Governance".
  - Exec 616 → `Collect Client Pages` → `internal_link_candidates` includes the page. The delivered draft (`A-page-616.md`) links to it
    ("[AI and Copilot advisory for UAE businesses](https://www.techand.ai/ai-copilot-advisory-uae)").
  - Exec 616 → `Originality Check` compared only the homepage and /ai-agents-copilot-studio-uae as own pages (`duplicate_targets: []`).
- **Root cause [confirmed in code]:**
  1. `v5/code/Page_Inventory_Site.js:39-49` (Site Tracker) fills `seo_pages.title` / `h1` from only two places:
     - the pages the publish detection fetched (`Detect Published.page_titles`), capped at
       `max_fetches_per_site: 15` (`v5/code/Match_Slugs_Detect.js:11`);
     - AI Growth's key pages.
     
     Every other sitemap URL is stored with an empty title.
  2. `v5/code/_site_model.js:143-161` `SM.matchPage` matches a keyword to a page when ≥ 75% of its terms are in the page's slug or its
     title + H1. With no title, the slug "ai-copilot-advisory-uae" gives "ai" but not "consulting".
  3. That matcher is used in three places:
     - the ladder's per-page `findExisting` (`v5/code/Ladder_Plan.js:161-165`);
     - the plan's coverage count `onTopicPage` (`Ladder_Plan.js:408-410`, which reads `p.title` and the URL path);
     - the page run's `Client_Page_Requests.js` (`matched`).
     
     All three see no title, so none finds the page, and `Ladder_Plan.js:419-420` prints "Nothing on … is about …".
- **Same cause elsewhere:**
  - Every caller of `SM.matchPage` on the same inventory:
    - discovery `coveredBy` (`v5/code/Rank_Keywords.js:66`);
    - Search Console seeds (`v5/code/GSC_Seeds_Discovery.js:25`, used by `_kw_inputs.js:81`);
    - the verdict's existing page (`Client_Page_Requests.js`);
    - the Content Cadence's inventory reads (`Cadence_Plan.js:197`).
  - Any page outside the ≤ 15 fetched per week and the AI Growth set is matched on its slug alone.
- **Correct behaviour:**
  - Every inventory page carries its live `<title>` and H1. Fetch the missing ones on a bounded schedule, or take them from a crawl the
    run already did.
  - The ladder finds /ai-copilot-advisory-uae for "ai consulting". With the title, `matchPage("ai consulting")` scores 2/2.
  - The plan marks that rung "improve the page you have" with its URL, and the coverage note names the page.
  - No rung URL is planned that duplicates it.
- **Acceptance test:**
  - (a) Offline:
    1. Build a fixture from `exec-610.json`: the input of `Ladder Plan`, plus the `Load Pages (Model)` rows with the live title above put
       on the /ai-copilot-advisory-uae row.
    2. Assert the rung "ai consulting" has `exists: true` and `target_url` = that URL.
    3. Assert `topic_authority.coverage.pages_on_site ≥ 1` and that the note does not contain "Nothing on".
    4. Separately, give `Page_Inventory_Site` a sitemap of 45 URLs with ≤ 15 fetched and assert every output row carries a non-empty
       title, or that the rows without one are listed as "title unknown".
  - (b) Live: after a Site Tracker run, `seo_pages` row /ai-copilot-advisory-uae has `title` "AI Consulting & Copilot Advisory UAE |
    Tech&". A Keyword Check or a ladder on "ai consulting" then names that page.
- **Related:** R35, R36 (same inventory, same matcher), R56.
- **Watch out:**
  - The fix is the **missing title**, not the 75% threshold. Lowering the threshold would match unrelated pages.
  - The site's own canonical host is `www.techand.ai`. Inventory URLs are www, Search Console URLs are bare (R55).

### R35 (A-2) — Discovery says 20 pages "do not target" searches they plainly target

- **Severity:** High. A wrong statement about the customer's own pages, printed in the report.
- **Feature / run:** discover, exec 612.
- **What the customer sees:** the keyword strategy report (`A-discover-612-result.html`, Search Console table "Why it is here"). 20 rows
  read *"the page that gets the impressions does not target this search (you rank #N with it)"*. Examples:
  - "d365 finance dubai" (#43.6), "best dynamics 365 finance partner dubai" (#32.6), "d365 finance and operations support services
    uae" (#24.5) → /dynamics-365-finance-and-operations-uae. That page has 18 such rows.
  - "microsoft dynamics finance and operations implementation partner in uae" (#34.4) →
    /d365-finance-operations-implementation-rollout-uae.
  - "pdf vs e-invoice uae" (#20.4) → /insights/your-current-pdf-invoices-will-be-illegal-in-the-uae-by-2027-and-how-to-fix-it.
- **Evidence:**
  - Exec 612 → `Build Keyword Strategy` → `keyword_strategy.search_console.queries`: 30 rows, 20 with `kinds` containing
    `"page_mismatch"` (`A-discover-612-strategy.json`).
  - The live pages (curl, 2026-10-15):

    | Page | Title | H1 | Body |
    |---|---|---|---|
    | /dynamics-365-finance-and-operations-uae | "Dynamics 365 Finance & Operations UAE" (also in the inventory) | "Microsoft Dynamics 365 Finance & Operations Partner in UAE" | "D365" ×22, "Dubai" ×4 |
    | /d365-finance-operations-implementation-rollout-uae | — | "Dynamics 365 Finance & Operations Implementation & Rollout Services" | — |
    | the PDF article | — | "Your Current PDF Invoices Will Be Illegal in the UAE by 2027 (And How to Fix It)" | "PDF" ×25 |
- **Root cause [confirmed in code]:** `v5/code/_kw_inputs.js:81-101` (`KWI.gscSeeds`).
  - `inv = matchPage(q)` asks whether an inventory page matches the query: an exact query in the page's stored top 10, or ≥ 75% of the
    query's terms in its slug / title.
  - When that fails and Search Console's own page for the row is on the site, `row_page` is used with `matched_by: 'impressions'`, and
    line 95 sets `page_mismatch`.
  - Line 100 then prints "the page that gets the impressions does not target this search".
  - So the label states something about the page's *content*, while the only fact behind it is that a literal token matcher failed.
    Long-tail queries rarely have 75% of their words in a title, and "d365" ≠ "dynamics", "dubai" ≠ "uae".
  - The stored per-page query list is capped at 10 (`v5/code/Page_Inventory_Site.js:11` `queries_per_page: 10`). A page's 11th and later
    queries can never match by `query`.
- **Same cause elsewhere:**
  - `GSC_Seeds_Discovery.js:24-25` is the only caller of `gscSeeds`.
  - The same `page_mismatch` rows rank second as discovery seeds (`_kw_inputs.js:108`), so the seeds are chosen on the wrong premise
    too.
  - `Build_Keyword_Strategy.js:166` prints the reason as-is.
- **Correct behaviour:** a Search Console row whose page is on the site is a page that ranks for the query. Label it by position:
  - "striking distance — improve that page" for #8-20;
  - "low position on <page> — improve that page" beyond #20.
  
  Call a page off-target only from evidence about the page itself (its title / H1 read against the query, with synonyms such as
  d365 = dynamics 365, emirate ⊂ uae), and say what was compared.
- **Acceptance test:**
  - (a) Offline: drive `KWI.gscSeeds` (harness S52 already does) with exec 612's `Load Query History (Discovery)` rows (newest period)
    and the inventory from `Load Pages (Model)`. Assert:
    - no row whose `page` is /dynamics-365-finance-and-operations-uae gets `page_mismatch`;
    - "d365 finance dubai" reads "you rank #43.6 with <page>" (or equivalent) and not "does not target".
  - (b) Live: a discover run's Search Console table shows no "does not target this search" for the D365 F&O pages.
- **Related:** R34, R36, R55.
- **Watch out:** R12 (2026-10-13) deliberately introduced `page_mismatch` so that "no page answers this" stopped being printed. The fix
  must keep naming the answering page; it is only the "does not target" claim that is unsupported.

### R36 (A-3) — Discovery recommends new pages for searches the site already ranks for with a dedicated page

- **Severity:** High. Wrong advice: a second page for a search the site already ranks for.
- **Feature / run:** discover, exec 612.
- **What the customer sees:** priority keywords #10 and #12–#16 of the keyword strategy (`A-discover-612-result.html`). Each card shows
  a new page type ("Location Page" / "Landing Page"), "Reachable for your site · Short ladder · 4-8 months", "Your position: not in top
  20", and "Search Console already measured N impressions for this exact search on your site". The existing page is not named. Example,
  #13 *"which dynamics 365 finance partner can help migrate a retail business in the uae"*:
  - Landing Page;
  - Search Console average position **6.2** with /dynamics-365-finance-and-operations-uae;
  - the card says "Your position: not in top 20".
  
  #16 "dynamics 365 finance and operations pricing dubai" is at GSC #9.6.
- **Evidence:** exec 612 → `keyword_strategy.priority[9]`, `[11]`…`[15]`. Each has `sources: ["search_console"]`,
  `covered_by: null`, `ladder_covered: null`, and `gsc: {impressions, position, page: "https://techand.ai/dynamics-365-finance-and-operat…"}`.
  The `gsc.page` URL is on the site.
- **Root cause [confirmed in code]:**
  - `v5/code/Rank_Keywords.js:66`: `coveredBy(kw)` uses only `SM.matchPage`, which fails as in R34 / R35. The keyword's own
    Search Console page (`k.gsc.page`) is never consulted.
  - `Rank_Keywords.js:90` sets `covered_by: coveredBy(k.keyword)`, so the keyword is "free".
  - `:165` `free = !k.covered_by && !k.ladder_covered` lets it into the priority list and the pick, with a new page type.
  - The card's "Your position: not in top 20" is the live depth-10 SERP check (`live.your_position`). Search Console's average position
    is printed only as impressions.
- **Same cause elsewhere:**
  - `Rank_Keywords.js:166` (the pipeline keyword pick) uses the same `free()`.
  - `quick_wins` and `clusters` (`:117-121`) carry the same `covered_by`.
- **Correct behaviour:**
  - A keyword whose Search Console row names a page on the site is `covered_by` that page (`matched_by: "search console"`, with the
    position).
  - It moves to "already answered by a page you have — improve it" and is not offered as a new page.
  - The card shows Search Console's position beside the live check's, and says why they differ.
- **Acceptance test:**
  - (a) Offline: run `Rank Keywords` / `Build Keyword Strategy` with exec 612's inputs. Assert no priority entry with a `gsc.page` on
    techand.ai has `covered_by: null`, and #13 is listed under `covered` with position 6.2.
  - (b) Live: in the discover report, none of the D365 F&O queries appears as a new "Location/Landing Page" card.
- **Related:** R34, R35.
- **Watch out:** the live check really did not see the site in the top 20 at 19:07 UTC. Search Console's 28-day average and one live
  read can differ. Both are true; the defect is recommending a *new page*.

### R37 (A-4) — Page QA masks two correctly sourced figures and tells the owner the source does not carry them

- **Severity:** High. A wrong statement shown to the customer; it is one of the "not ready to publish" reasons.
- **Feature / run:** ladder page "ai consulting", exec 616 (Content QA round 2).
- **What the customer sees:**
  - Page report `qa_reasons[2]`: *"Figures the cited source does not carry (now marked [Confirm: …]): "40%" (mckinsey.com); "27%"
    (mckinsey.com) — quote the source's own number or cite the page that states it"*.
  - The body reads *"McKinsey's 2026 State of AI survey reports that [Confirm: 40%] of respondents … up from [Confirm: 27%]"*.
- **Evidence:**
  - Exec 616 → `Content QA` [run 1] → `content_qa.unverified_figures`: `[{"figure":"40%","sources":["mckinsey.com"]},{"figure":"27%",…}]`.
  - The only source text the run held for that URL (`Collect Facts` → `facts[1]`, and `Parse Brief` → `content_brief.evidence_plan[0]`;
    `A-page-616-facts.json`): *"25 Aug 2026 — Forty percent of respondents from large organizations (those with annual revenues of more
    than $1 billion) report scaling AI agents, up from 27 ... Read more"*.
  - McKinsey's "The state of AI in 2026: On the road to ROI" states 40 percent, up from 27 percent. Confirmed by web search
    2026-10-15, which lists McKinsey's own PDF. The direct fetch of mckinsey.com timed out.
- **Root cause [confirmed in code]:**
  - `v5/code/Content_QA.js:44-49` builds `srcText` per URL from `facts[].text/claim/title`, the brief's evidence plan and the
    competitor pages.
  - `:247-265` checks every figure in a cited sentence with `SRC.hasFigure(f, sourceText)`.
  - `v5/code/_sources.js:44-70` `SRC.figures` / `valueSet` only recognise digits: `NUM = \d[\d,]*…`, a percentage needs `%` /
    "percent" after digits, and a bare number counts only from 1,000 or as a year.
  - "Forty percent" (a number in words) yields no figure. "up from 27 ..." (the snippet is cut before "percent") yields no figure,
    because 27 < 1,000 and has no unit.
  - So `valueSet(source)` is empty, both draft figures are "not carried", and `:268` replaces them with `[Confirm: …]`.
  - `:383` writes the warning "Figures the cited source does not carry", and `:593` puts it among the not-ready reasons.
- **Same cause elsewhere:**
  - `amountInCitedSource` (`Content_QA.js:57-58`, the money mask) uses the same `SRC.hasFigure`, so an amount written in words in the
    source ("fifty million dirhams") would be masked as unsourced too.
  - `SRC.figures` is inlined into `Blog_Package.js` and `Collect_Facts.js`; neither calls `hasFigure` (grep).
- **Correct behaviour:**
  - Spelled-out numbers ("forty", "a third") count as figures in the source.
  - A draft figure that matches a bare number in a truncated snippet ("up from 27 …") with a unit nearby counts, or is reported as
    "could not be confirmed: the source text the run read was cut short".
  - "Does not carry" is said only when the source text is complete and the number is absent.
- **Acceptance test:**
  - (a) Offline:
    1. Unit: `SRC.hasFigure(SRC.valueOf("40%"), "Forty percent of respondents … up from 27 ...")` must be true (or a new
       "unconfirmed (truncated)" result must be returned instead of false).
    2. Node: replay `Content QA` with exec 616's round-2 input. Assert `unverified_figures` does not contain 40% or 27% for
       mckinsey.com and the body keeps "40%" and "27%" unbracketed.
  - (b) Live: a page run that cites a snippet with a number in words keeps the figure and states its source.
- **Related:** R45 (bracket counting), R43 (other not-ready reasons).
- **Watch out:** **the 40% and 27% are right; the matcher is wrong.** Do not "fix" this by dropping McKinsey or by having the writer
  avoid the figure.

### R38 (A-5) — The verdict states what the customer's page lacks; three of those statements are false

- **Severity:** High. A false statement about the customer's own page.
- **Feature / run:** verdict "e invoicing software uae", exec 608.
- **What the customer sees:** the keyword report (`report-44818f6f…`), `reasons[3]`: *"The existing insights article at the target URL
  is a CFO-framed Peppol features piece. Its visible text has no mandate dates, no PINT-AE or 5-corner explanation, no tables, no lead
  CTA and no author or date. Its intent is a poor match for a service page, so the page needs rework before it can rank."*
- **Evidence:**
  - The live page /insights/top-peppol-e-invoicing-software-features-every-uae-cfo-must-look-for (curl, 2026-10-15) has:
    - the dates, in body text: "an amendment that moved the ASP appointment deadline for businesses with revenue of AED 50 million or
      more to 30 October 2026, while retaining the 1 January 2027 implementation date";
    - **3 HTML tables**;
    - a visible byline "Muhammad Aarish — System Architect";
    - Article schema `author` and `datePublished` 2026-09-26.
    
    "PINT" and "5-corner" do not occur, so that part is true.
  - Exec 608 → `Collect Client Pages` → `existing_page_text` is exactly 9,000 characters (1,248 of ~2,100 words). "30 October" is at
    char 6,997, the first table's text at 4,496, and the byline is beyond 9,000 (`A-verdict-608-existing-page-text.json`).
    `client_signals.credentials` contains "Accredited Service Provider (ASP) by 30 October 2026".
  - Exec 608 → `Competitor Analyzer` → `output.existing_page_gaps` includes:
    - *"The visible text does not state the mandate dates, such as 30 Oct 2026 or 1 Jan 2027…"*;
    - *"No comparison table … is visible in the text provided"*;
    - *"No visible trust signals: author, date…"*;
    - *"… in the excerpt provided"*.
- **Root cause [confirmed in code]:** three cuts, and the hedge is lost on the way.
  1. `v5/code/Collect_Client_Pages.js:13` keeps the first 9,000 characters of the existing page. `strip()` (`:5-8`) flattens markdown,
     so the tables become runs of words.
  2. `v5/prompts/competitor_analyzer.txt:25-26` gives the analyzer only `existing_page_text.slice(0, 3500)`, labelled "(first part)".
     The dates (char 6,997) and the tables (4,496) are outside it, so the analyzer writes "not in the excerpt provided".
  3. `v5/prompts/verdict.txt:23-24` passes `competitor_analysis` as JSON. The Verdict Agent restates `existing_page_gaps` as fact
     ("Its visible text has no …") without the excerpt caveat.
  
  No code compares a negative claim about the client's page with the page text.
- **Same cause elsewhere:**
  - Every keyword-mode run with an existing page runs the same three nodes: verdict, keyword report, ladder head, page run.
  - `v5/prompts/copywriter.txt:23` gives the writer only `existing_page_text.slice(0, 5000)` when it rewrites an existing page. The
    rewrite of a long page loses everything after 5,000 characters ("keep its true facts" cannot keep facts it never saw).
- **Correct behaviour:**
  - The analyzer reads the whole page, or a structured digest of all of it: dates found, number of tables, author / date present, CTAs.
  - Absence claims are made only for what was read in full.
  - The verdict keeps any "in the excerpt" caveat or drops the claim.
  - Tables are kept as tables (rows with separators) in the text the models get.
- **Acceptance test:**
  - (a) Offline: with exec 608's `Read Client Pages` output as the fixture, assert `Collect Client Pages` keeps ≥ 2,000 words of the
    existing page (or a digest with `tables: 3`, `dates: ["30 October 2026","1 January 2027"]`, `author: "Muhammad Aarish"`), and that
    the rendered analyzer prompt contains "30 October 2026".
  - (b) Live: the verdict on "e invoicing software uae" makes no claim that the page lacks dates, tables or an author.
- **Related:** R48 (another verdict wording issue).
- **Watch out:** the model behaved reasonably given a 3,500-character excerpt; the analyzer even hedged. The defect is the truncation,
  and the hedge being dropped at the next step. Raising the 9,000 cap alone does not fix it: the 3,500 slice in the prompt is the
  binding one.

### R43 (A-10) — The page is refused at "60% coverage against 90%", but the two numbers are measured differently; on the competitor's measure the draft has 100%

- **Severity:** **High (raised from Medium).** The refusal reason is a wrong number shown to the customer. The 60% and the 90% are not
  comparable, and on the competitor's own measure the draft covers 20 of 20 terms.
- **Feature / run:** ladder page "ai consulting", exec 616.
- **What the customer sees:** the page report.
  - `qa_reasons[0]`: *"it covers 60% of the terms the best-ranking page covers, against a target of 90%"*.
  - `qa_reasons[3]`: *"Topic coverage 60% against a target of 90% (vendasta.com covers 90%) — work these terms in where they belong:
    strategy, technology, consulting firms, consulting services, change management, management, customer service, building"*.
- **Evidence:**
  - Exec 616 → `Content QA` [run 1] → `content_qa.term_coverage` (`A-page-616-qa-round2.json`): 20 terms, each with a `target` count
    from the brief. "Missing" means `found < target`: strategy 7 vs 8, technology 1 vs 3, consulting firms 1 vs 3, consulting services
    2 vs 3, change management 2 vs 3, management 2 vs 3, customer service 1 vs 2, building 1 vs 2.
  - **Every one of the 20 terms is found at least once.** The delivered markdown has strategy ×9.
  - Round 1 (`A-page-616-qa-round1.json`): coverage 90% at 2,793 words. The editor cut to 2,197 words; round 2 is at 60%.
- **Root cause [confirmed in code]:**
  - `v5/code/Content_QA.js:291-296`: the draft's coverage is "terms whose count reaches the brief's `min_count`"
    (`ok: found >= target`).
  - `:304-315`: the benchmark is `CVG.coverageOf(benchText, termList)`. `v5/code/_coverage.js:22-26` counts a term as used when it
    appears **at least once** (presence).
  - `:390-391` and `:593` then compare and print the two as the same quantity: "covers 60% of the terms the best-ranking page covers".
  - The thresholds are the Strategy Brief's own `terms_to_use[].min_count` (Opus output).
  - The editor's `length_instruction` ("CUT 893 words … Do not add a single word", round 1) pushes counts below those thresholds, so a
    correct cut flips coverage from passing to failing.
- **Same cause elsewhere:**
  - Every page run (keyword, ladder, cadence, AI target, case study), since all go through `Content QA`.
  - `score_breakdown.coverage` (`coverage_ratio`, `:317`) uses the same mixed comparison, so the content score is affected too.
- **Correct behaviour:**
  - Draft and benchmark are measured the same way. Either both by presence ("uses 20 of 20 terms; vendasta.com uses 18 of 20"), or
    both by count, with the competitor's own counts as the bar.
  - The reason text says which.
  - A term present below its brief count is "used 7 times (the brief asked for 8)", never listed as something to "work in".
  - The length cut and the coverage count are reconciled: an instruction to cut must not cause a coverage refusal for terms that are
    still present.
- **Acceptance test:**
  - (a) Offline: replay `Content QA` with exec 616's round-2 input. Assert that on the presence basis `coverage_pct` = 100 (20/20) and
    is not < target, and that no reason says "covers 60%". If a count-based measure is kept, assert the benchmark is computed with the
    same counts and the reason names both figures and the basis.
  - (b) Live: a page run where the editor cuts length does not fail coverage for terms that are still on the page.
- **Related:** R44 (where the benchmark page comes from), R37 (other not-ready reason).
- **Watch out:** the 90% figure for vendasta.com is correct *as presence*. The draft's 60% is correct *as count thresholds*. The
  defect is putting them side by side as the same thing.

---

## MEDIUM

### R39 (A-6) — An off-topic supply-chain rung on the "ai consulting dubai" ladder, because "ai" is not a word that matters

- **Severity:** Medium. Narrowed: the "openai consulting" half is withdrawn, see Watch out.
- **Feature / run:** ladder, exec 610.
- **What the customer sees:** in the ladder report rungs (`report-4db246f7…`), rung 2 "supply chain optimization consulting" with
  supporting "supply chain operations consulting", "supply chain logistics consulting", "supply chain risk consulting" (10 searches
  each), target URL /supply-chain-optimization-consulting/.
- **Evidence:**
  - Exec 610 → `Ladder Keyword Relevance` → `output.items`: "supply chain optimization consulting" `relevance: 1`, topic "supply chain
    consulting" (`A-ladder-610-relevance.json`).
  - The cluster SERP for it (exec 610 → `Run Ladder Cluster SERP`): consultancy-me.com supply-chain rankings, ibm.com/consulting/supply-
    chain, kpmg.com/ae operations, thehackettgroup.com glossary.
  - The plan's off-topic list states the gate's words: *"it shares none of the words that matter in "ai consulting dubai" ("consult",
    "dubai")"*.
- **Root cause [confirmed in code]:**
  - `v5/code/_radius.js:21-22` `RAD.tokens` drops every token of ≤ 2 characters, so "ai" is not one of the head's words.
  - `RAD.headFit` (`:101-111`) then needs only `ceil(2/2) = 1` shared word, and "consult" passes "supply chain optimization
    consulting".
  - The AI relevance score 1 ("adjacent") still keeps it in the pool.
- **Same cause elsewhere:**
  - Every `RAD.headFit` / `RAD.tokens` caller:
    - `Ladder_Cluster_Requests.js:21` (what results pages are bought, R54);
    - `Ladder_Plan.js` rung filter and `onTopicPage` (`:408`);
    - discovery's topic radius `anchors` (`_radius.js:25-32`).
  - Any head with a 2-letter core word is affected ("ai", "bi", "hr", "it", "ui", "ux", "uk" as geography).
  - `_site_model.js:19` `termsOf` keeps 2-letter tokens (`length > 1`), so the two kits disagree.
- **Correct behaviour:**
  - A head's core words include "ai" (and similar 2-letter terms). "supply chain optimization consulting" fails the fit for "ai
    consulting dubai" and is not a rung.
  - A rung must share the head's subject word, not only its generic service word ("consulting").
- **Acceptance test:**
  - (a) Offline: unit `RAD.headFit("ai consulting dubai", "supply chain optimization consulting").ok === false` and
    `RAD.headFit("ai consulting dubai", "ai consulting firm").ok === true`. Replay `Ladder Plan` with exec 610's input; no rung keyword
    lacks "ai".
  - (b) Live: a ladder for an "ai …" head has no rung without "ai" or a synonym.
- **Related:** R54 (results pages bought for the same keywords), R40.
- **Watch out:**
  - **Withdrawn half:** "openai consulting" as "another company's brand" is not a clear defect. `Ladder_Pool.js:96` protects every word
    of the site's services (`protect: [head, ...products_or_services …]`), and the site sells "Azure OpenAI Service", so "openai" is
    deliberately not a brand for this site. Its SERP is mixed: OpenAI's own consulting news, plus IBM's and BCG's OpenAI consulting
    pages.
  - Do not lower `headFit`'s bar to 2 words for 3-word heads without testing; the fix is the token rule.

### R40 (A-7) — Keywords Google answers with different pages are merged onto one page anyway

- **Severity:** Medium.
- **Feature / run:** ladder, exec 610.
- **What the customer sees:**
  - Rung pages with `grouped_by: "topic label (no search Google answers with the same pages)"`: "ai consulting firm" + "openai
    consulting", and "supply chain optimization consulting" + 3 supply-chain keywords.
  - The note: *"The results pages of 10 of the 10 rung keyword(s) were read and compared: searches sharing 3 of their top 7 pages (40%)
    are one page, not two - no two of them share one."*
- **Evidence:**
  - Exec 610 → `Ladder Clusters` / plan `serp_clusters`: `compared: 10`, `clusters: []`.
  - Recomputed from `Run Ladder Cluster SERP` (top 7, URL-normalised): the most any two rung keywords share is 1 URL. "ai consulting
    firm" vs "openai consulting" share 0.
- **Root cause [confirmed in code]:**
  - `v5/code/Ladder_Plan.js:173-181`: a keyword with a `serp_group` is keyed by it. **Every keyword without one** is keyed by the AI's
    `topic + page_type` and grouped (up to `MAX_CLUSTER` 6), including keywords whose results pages *were* compared and found not to
    overlap.
  - `:191` labels such a group "topic label (no search Google answers with the same pages)", stating the contradicting evidence in the
    label itself.
- **Same cause elsewhere:** discovery's clusters in `Rank_Keywords.js:105-121` group by topic label in the same way, and use a
  different overlap rule (`_kw_inputs.js` CFG `top_n: 0`, `min_shared_urls: 3`) from the ladder's top 7 / 40%.
- **Correct behaviour:** when results pages were compared, keywords that did not cluster stay as separate pages, or the smaller ones
  are dropped as not worth a page. A topic label groups only keywords whose results pages could not be read.
- **Acceptance test:**
  - (a) Offline: replay `Ladder Plan` with exec 610's input. Assert no page has `grouped_by` "topic label (no search Google answers …)"
    with more than one keyword, and that "openai consulting" is not a supporting keyword of "ai consulting firm".
  - (b) Live: a ladder whose cluster check finds no overlap shows one keyword per page, or names the dropped ones.
- **Related:** R39, R54.
- **Watch out:** the SERP comparison itself works (10 of 10 compared, all task status 20000). The defect is the fallback grouping
  after it.

### R41 (A-8) — Two traffic figures for the head term in one ladder report

- **Severity:** Medium.
- **Feature / run:** ladder, exec 610.
- **What the customer sees:**
  - The ladder report: top page `traffic_potential: 12`, included in `stats.traffic_potential_total: 57`.
  - The same run's feasibility / verdict: *expected visits 6*, "Modelled, not measured: 40 searches a month … Click loss applied: an AI
    Overview (-52% of the clicks, measured: Ahrefs, 300,000 keywords, December 2025 data (published 2026-02-04))".
- **Evidence:** exec 610 → `Ladder Plan` → `ladder.top.traffic_potential: 12`; `Ladder Pool` → `expected_visits.visits: 6`,
  `model_estimate: 15` (`A-ladder-610-plan.json`, `A-ladder-610-pool-verdict.json`).
- **Root cause [confirmed in code]:**
  - `v5/code/Ladder_Plan.js:220`: `traffic_potential: kd.search_volume ? Math.round(kd.search_volume * 0.3) : null`, i.e. 40 × 0.3 =
    12, with **no click loss**.
  - The rung pages' `traffic_potential` comes from the pool candidates, which apply the click loss (`Collect_Research.js` /
    `KWI` click-loss table).
  - The verdict's `expected_visits` applies the AI Overview loss.
- **Same cause elsewhere:** `Ladder_Plan.js:460` `traffic_potential_total` sums it. Any report or app view reading
  `top.traffic_potential` (ladder detail page, PDF) shows 12.
- **Correct behaviour:** the head term's traffic goes through the same click-loss model as the rungs and the verdict (here ≈ 6, with
  the basis printed); one figure per keyword per report.
- **Acceptance test:**
  - (a) Offline: replay `Ladder Plan` with exec 610's input. Assert `top.traffic_potential` equals the verdict's
    `expected_visits.visits` (6) or carries the same `loss_applied`.
  - (b) Live: in the ladder report the head term shows one traffic figure.
- **Related:** none.
- **Watch out:** this is the open item called B6-15 in the re-rating brief; it was known and not yet fixed.

### R44 (A-11) — The coverage target and its subtopics come from pages that do not match the page being written

- **Severity:** Medium.
- **Feature / run:** page run exec 616; ladder verdict exec 610.
- **What the customer sees:**
  - Page report reason: *"Subtopics the best competitor page covers and this draft does not: "Acquire and serve 10x more clients with
    AI-powered software", "7. Performance Measurement and Optimization", "How to Tell if an SMB Needs AI Consulting Services?", "1.
    They're Drowning in Data but Lacking Insight" … — add each one where it belongs …"*.
  - The delivered draft gained a section *"### Serving more clients with AI-powered software"*.
  - Exec 610's coverage target for the top page lists the subtopics "2. Accenture AI & Analytics", "3. IBM AI Consulting", "10. G42 AI
    Solutions" for a Service Page.
- **Evidence:**
  - Exec 616 → `Analyze Competitor Pages`: vendasta.com headings start with `H2: Acquire and serve 10x more clients with AI-powered
    software`. The heading has no body (it is followed directly by `## What is AI Consulting?`).
  - The page text: "For marketing agencies, offering AI consulting means …". It is a guide for agencies on selling AI consulting.
  - Round 1's `missing_subtopics` includes the banner (`A-page-616-qa-round1.json`); the final markdown has the section.
  - Exec 610: `coverage_target.best` = digiscorp.com (#7, "best AI consulting companies in Dubai" listicle), with 7 company-name
    subtopics.
- **Root cause [confirmed in code]:**
  - `v5/code/Parse_Analysis.js:30` picks the benchmark with `CVG.best(competitors, terms)`, the page with the highest term presence
    (`_coverage.js:27-36`), regardless of its page type, audience or market.
  - `Parse_Analysis.js:39` takes its headings as subtopics via `CVG.subtopics` (`_coverage.js:41-52`). That filter drops only generic
    headings (`JUNK`, `:42`), so a heading-only promo block and numbered listicle entries naming other companies pass.
  - `Content_QA.js:318-320` reports each one as missing, and the editor is told to add it.
- **Same cause elsewhere:**
  - Every keyword-mode run: `coverage_target` and `coverage_digest` reach the Strategy Brief prompt (`v5/prompts/strategy_brief.txt`)
    and Content QA.
  - The verdict's coverage line ("cleartax.com … 96%") is from the same picker.
- **Correct behaviour:**
  - The benchmark is chosen among results of the page type and intent being written (a service page for a service page; the run already
    classifies page types).
  - Subtopics exclude headings with no body text below them, promo / CTA blocks, and list entries that name another company.
- **Acceptance test:**
  - (a) Offline: run `Parse Analysis` with exec 616's competitors. Assert the subtopics do not contain "Acquire and serve 10x more
    clients with AI-powered software". With exec 610's competitors, assert no subtopic names Accenture, IBM, PwC, Cognizant, DataRobot
    or G42.
  - (b) Live: a page run's "missing subtopics" contain only topical headings.
- **Related:** R43.
- **Watch out:** the editor did what QA told it. The fix belongs in the subtopic source, not in the editor prompt.

### R45 (A-12) — Brackets left for the owner are not counted or named

- **Severity:** Medium.
- **Feature / run:** page run, exec 616.
- **What the customer sees:**
  - Page report: `placeholder_count: 0`, `placeholders_in_body: []`, `placeholder_note: ""`.
  - The delivered body contains *"\*Checklist reviewed by [name, role], [date].\*"* and *"Deloitte's State of AI in the Enterprise report
    [Confirm: edition year and sample size] lists …"*. Neither is named in the reasons; only the two `[Confirm: x%]` figures are, via
    the R37 warning.
- **Evidence:** exec 616 → `Content QA` [run 1] → `content_qa.placeholder_count: 0`, `review_notes: 1`
  (`A-page-616-qa-round2.json`); `A-page-616.md`.
- **Root cause [confirmed in code]:**
  - `v5/code/Content_QA.js:404`: `PH_RE = /\[[A-Z][A-Za-z0-9 &/'’.,()-]{1,48}\]/g` counts only brackets that start with an
    **upper-case** letter. "[name, role]" and "[date]" are not counted.
  - `:410` counts `[Confirm …]` notes as `review_notes`, by design a review note, but nothing names them to the owner.
  - `review_notes` is also computed on `withoutMeta` (`:192`), i.e. before §9b inserted the `[Confirm: x%]` marks, so it counts 1 of 3.
- **Same cause elsewhere:** every page run's placeholder gate (`PH_MAX`, `:403`, `:538`) and `placeholder_note` (`:565-567`). The app
  highlights the same upper-case pattern, so it does not highlight these either.
- **Correct behaviour:** every bracket left for a person to fill (any case, any `[Confirm: …]` the writer added) is counted and listed
  in the reasons the owner reads.
- **Acceptance test:**
  - (a) Offline: replay `Content QA` round 2 with exec 616's input. Assert the list of open brackets contains "[name, role]", "[date]"
    and "[Confirm: edition year and sample size]".
  - (b) Live: a page with a lower-case bracket shows it in the reasons.
- **Related:** R37.
- **Watch out:** the `[Confirm: x%]` marks are QA's own and are named already (as the R37 warning). Do not count them twice.

### R47 (A-14) — The Claude cost ledger counts every structured answer as "[object Object]" (4–6 tokens) and labels it measured

- **Severity:** Medium. A wrong cost figure, labelled "measured".
- **Feature / run:** describe 606, verdict 608, ladder 610, discover 612, keyword report 615, page 616.
- **What the customer sees:** each report's `run_ledger.ai_cost.basis`, e.g. *"measured: Anthropic /v1/messages/count_tokens counted
  3919 prompt and 4 answer token(s)"* (606) or *"counted 15823 prompt and 5 answer token(s); the 1638 thinking token(s) it cannot see
  are modelled …"* (608 Competitor Analyzer), and the `seo_run_ledger` row's `ai_usd`.
- **Evidence:**
  - `Prompt For Count (Site Describer)` (606), `(Competitor Analyzer)` (608), `(Keyword Relevance)` (612, 3 items) and `(Critic)` (616)
    all output `__answer: "[object Object]"`.
  - Ledger vs n8n's reported `tokenUsage`:

    | Exec | Ledger | n8n `tokenUsage` | Difference |
    |---|---|---|---|
    | 606 | $0.0039 | $0.0117 | −67% |
    | 608 | $0.0848 | $0.1145 | −26% |
    | 610 | $0.0882 | $0.1167 | −24% |
    | 612 | $0.0653 | $0.1648 | −60% |
    | 615 | $0.0752 | $0.0888 | −15% |

  - Real output tokens: 1,368 (606); 4,251 (608 Competitor Analyzer); 12,986 across 612's three relevance calls.
- **Root cause [confirmed in code]:** the `__answer` field of the "Prompt For Count" Set nodes is `String(<agent>.json.output ?? '')`.
  For an agent with a structured output parser, `output` is an object, and `String(object)` is `"[object Object]"`.
  - `build_v4.py:5836-5837` (section 62, the streaming Strategy Brief / Copywriter / Editor). Strategy Brief is structured; Copywriter
    and Editor return text and are counted correctly (6,191 and 5,189 answer tokens in 616).
  - `build_v4.py:7491-7492` (section 76, all non-streaming agents: Site Describer, Competitor Analyzer, Verdict Agent, Critic, Keyword
    Seeds, Keyword Relevance, Ladder Keyword Relevance).
  - `build_monitors.py:149-150` (section 84, the monitor workflows' agents).
  
  `_cost_cal.js:122-123` then writes "measured: … counted N answer token(s)".
- **Same cause elsewhere:**
  - Every structured agent in the main workflow and in the monitor workflows built by `build_monitors.py`.
  - Two different gaps, not the same cause:
    - The Keyword Check settles a fixed list-price estimate. `Assess_Ledger_Settle.js:22-28` labels it "ESTIMATED", so that is
      honest: $0.002 against n8n's $0.0027–0.0030.
    - The Reply Reader writes no ledger row at all; four Haiku calls ($0.0129) are unrecorded.
- **Correct behaviour:**
  - `__answer` is `typeof output === 'string' ? output : JSON.stringify(output)` in all three builders.
  - A count that is implausible (answer < 20 tokens for a structured agent) is labelled estimated, not measured.
  - The Reply Reader records its cost, or says it is not recorded.
- **Acceptance test:**
  - (a) Offline: a build assertion that no `Prompt For Count (…)` `__answer` expression applies `String()` to `.output` without a
    JSON branch. Then evaluate the expression on exec 608's `Competitor Analyzer` output and assert the string starts with `{` and its
    length is > 1,000.
  - (b) Live: after the fix, the ledger's `ai_usd` for a verdict run is within ±15% of n8n's `tokenUsage` priced at list prices
    (`RR claude`), and no basis says "4 answer token(s)".
- **Related:** R46 (editor rounds priced twice), R57 (retried calls not priced).
- **Watch out:** the prompt half of the count is correct (608: 15,823 counted vs 17,072 reported). Only the answer is wrong. The
  modelled thinking (1,638 per Sonnet node) is a separate estimate and stays labelled as such.

### R49 (A-16) — A "good (50-70%)" chance is shown for a site whose reach rests on no measured ranking

- **Severity:** Medium. Misleading: the band is labelled uncalibrated, but it is not conditioned on the evidence behind the reach.
- **Feature / run:** Keyword Check "erp software uae", exec 598. The same band appears in discover (612) for "best erp software in
  uae".
- **What the customer sees:**
  - Keyword Check answer: *"Easy for your site · Direct plan · 2-4 months"*, `chance.label` *"estimated chance good (50-70%,
    uncalibrated)"*.
  - In the same answer: `chance_text` *"… Base rate (Ahrefs, 2025): only 1.74% of new pages reach Google's top 10 within a year …"*,
    and `reach_note` *"… treat the months and the chance below as the optimistic case."*
- **Evidence:** `files/assess-erp-software-uae.json`: `reach_info: {method: "size", p75: null, sample: 0, top10: 0, cached_at:
  "2026-10-08…"}`, `kd: 3`.
- **Root cause [confirmed in code]:**
  - `v5/code/_reach.js:21-24`: `reachChance(plan_type)` maps the plan type to a fixed band (direct → good 50-70%).
  - The plan type comes from KD vs reach. Reach here is the size tier for 0–4 top-10 keywords (`reachSizeTier`, = 10), so KD 3 is
    "easy" → direct → "good".
  - Nothing in `reachChance` looks at `reach_info.method` or `sample`.
  - `Assess_Response.js:61` prints it. The only suppression is the no-data branch (`:80`, no volume / KD).
- **Same cause elsewhere:**
  - Every user of `reachChance`: Ladder Plan, Reach (Discovery), Rank Keywords, Build Keyword Strategy, the Keyword Check.
  - The app's copy of the same table, `app/shared/src/keywords.ts:80`.
- **Correct behaviour:** when the reach rests on no ranked keywords (`method: "size"`, `sample: 0`), show no chance band, or show one
  derived from the stated base rate and labelled as such. Keep the plan and the months, with the existing "optimistic case" note.
- **Acceptance test:**
  - (a) Offline: `Assess Response` with exec 598's `Assess Result` → `chance` is null or banded from the base rate, and the label says
    why.
  - (b) Live: a Keyword Check on a site with 0 top-10 keywords shows no "good (50-70%)".
- **Related:** R50.
- **Watch out:** this is a judgement table documented as uncalibrated until G17 (an owner item: months of the system's own data). The
  defect is not the table; it is applying the highest band when the reach itself is unmeasured.

### R51 (A-18) — Discovery's "where to start" pick is a keyword in steep decline, which its own follow-up advises against

- **Severity:** Medium.
- **Feature / run:** discover 612 → keyword report 615.
- **What the customer sees:**
  - Discover report: *"Where to start: "construction project erp" — 70 searches/mo, difficulty —, commercial intent, best page: Service
    Page. Reachable for your site · Short ladder · 4-8 months."*
  - The follow-up keyword report's verdict (615, score 46): *"The head term's volume is tiny and falling, so traffic will be
    negligible"*, *"… Free and open-source searchers will not convert."*
- **Evidence:** exec 612 → `keyword_strategy.pipeline_keyword`: `trend_yearly: -73`, `trend_quarterly: -57`, `monthly` ends at 30,
  `cpc: 15.14`, `relevance: 2`.
  techand.ai's industries page lists BFSI, Public Sector, Tourism & Hospitality, Trading & Manufacturing, Retail, Professional
  Services, Non-Profit. Construction is not among them.
- **Root cause [confirmed in code]:**
  - `v5/code/Collect_Research.js:93`: `tr = 1 + clamp(trend_yearly/100, -0.3, +0.3)`, so a −73% yearly trend lowers `pre_score` by
    only 30%.
  - The CPC (`value_factor 2.21`) outweighs it.
  - `Rank_Keywords.js:164-166` picks the first `fits && free` keyword by opportunity. `fits` needs `relevance === 2` from the AI
    screen, which rated construction ERP as core.
- **Same cause elsewhere:** the trend factor feeds every discovery ranking (priority, quick wins, clusters) and the ladder pool's
  `pre_score`, which uses the same formula.
- **Correct behaviour:**
  - A keyword falling more than ~50% a year is not the "where to start" pick unless nothing else qualifies, and then it is labelled
    "falling".
  - Relevance to an industry the site does not list is "adjacent", not core.
- **Acceptance test:**
  - (a) Offline: replay `Rank Keywords` with exec 612's input. Assert `pipeline_keyword` is not "construction project erp", or that it
    carries a "falling −73%" label.
  - (b) Live: the discover pick has a non-falling trend, or says it is falling.
- **Related:** none.
- **Watch out:** the two SERP reads of this keyword, 53 s apart, shared no top-5 domain: discover's card at 19:07:49 vs the report at
  19:08:42, same location 2784 / desktop. That is result volatility, not a code defect. It is worth a note in the report, not a fix
  here.

### R58 (A-25) — Discovery's content plan puts first a topic its own header says to leave to an existing ladder

- **Severity:** Medium.
- **Feature / run:** discover, exec 612.
- **What the customer sees:**
  - The header line: *"5 keywords below are already covered by a keyword ladder of yours: … "best erp software in uae" → ladder "erp
    software uae" (the same search, its main page, planned), "erp software company dubai" → ladder "erp software uae" (the same
    search, rung 1, planned) … Let that ladder finish."*
  - Then *"Build first: erp software uae (Landing Page, 210/mo across 2 keywords) · …"*.
  - The Content plan table's first **Now** row is "Erp software uae — erp software company dubai, best erp software in uae — Landing
    Page … Easy direct, 2-4 mo, good chance (50-70%, uncalibrated)", with no ladder note.
- **Evidence:** exec 612 → `keyword_strategy.clusters[0]` has `tier: "Now"` and `ladder_covered: {ladder_id: "lad_mv40b6s9h5a8",
  head_keyword: "erp software uae", how: "the same search"}` (`A-discover-612-strategy.json`).
- **Root cause [confirmed in code]:**
  - `v5/code/Rank_Keywords.js:121` copies `ladder_covered` onto the cluster, but `:127-134` assigns `tier = 'Now'` without checking
    `ladder_covered` or `covered_by`.
  - `Build_Keyword_Strategy.js:196` and `:252` print "Build first" from the Now tier; `:275` renders the plan table without the ladder
    note.
- **Same cause elsewhere:**
  - `content_plan` in the callback payload, and the app's renderer of it.
  - The Now tier also feeds the follow-up pick only indirectly (the pick uses `free()`, which does skip ladder-covered keywords).
- **Correct behaviour:** a cluster whose primary keyword is covered by a ladder or by a live page is not in "Now" / "Build first". If
  shown at all, it is shown with "in your ladder …" / "improve …".
- **Acceptance test:**
  - (a) Offline: replay `Rank Keywords` with exec 612's input. Assert no cluster with `ladder_covered` or `covered_by` has
    `tier: "Now"`.
  - (b) Live: the discover report's "Build first" names no topic that the report's own header lists as ladder-covered.
- **Related:** R36, R50.
- **Watch out:** the priority *cards* already show "Already in your ladder" (`Build_Keyword_Strategy.js:258`). Only the tiers and the
  "Build first" line ignore it.

---

## LOW

### R42 (A-9) — An on-demand ladder writes a page past the pile-up limit without saying so

- **Severity:** **Low (lowered from Medium), and narrowed.** The "sixth active ladder against `max_active: 2`" half is withdrawn, see
  Watch out.
- **Feature / run:** ladder, exec 610 → page run 616.
- **What the customer sees:** the ladder report says nothing about pages already waiting. `seo_content_log` held 3 `written`,
  unpublished pages (erp software uae, service industry erp software, azure api management monetization) and the `_site` row says
  `max_waiting: 3`. The run wrote a 4th ("ai consulting").
- **Evidence:** `seo_ladder_settings` `_site` row: `max_active: 2`, `max_waiting: 3`. `seo_content_log` rows 3–5 `written`, plus the
  new row "ai consulting" `written` (source `ladder`).
- **Root cause [confirmed in code]:**
  - `v5/code/Spawn_Page_Runs.js:5-6` spawns `pages_now` pages with no pile-up check.
  - The pile-up guard exists only in the Content Cadence: `Cadence_Plan.js` (pile-up `max_waiting`) and its mirror
    `app/server/src/services/cadence.ts:414`.
  - The app's notice for a new ladder (`app/shared/src/pipeline-notices.ts:240-251`, "Your pipeline takes it from there") does not
    mention waiting pages.
- **Same cause elsewhere:** the app's "Write now" on the Pipeline page, the keyword mode with `force_content`, and the case study spawn
  write regardless of the pile-up count. These are explicit user requests, so a notice rather than a block fits.
- **Correct behaviour:** when `max_waiting` or more pages are written-but-unpublished, the ladder form (app) and the ladder report
  (engine) say so ("you have 3 pages waiting to be published; this writes a 4th") before / when the page is written.
- **Acceptance test:**
  - (a) Offline: the app's `pipeline-notices` for mode `ladder` with `queue.waitingPublish = 3`, `maxWaiting = 3` returns a warning.
    `Ladder Plan` / `Build Ladder Report` with a fixture of 3 waiting rows adds the note.
  - (b) Live: create a ladder with `pages_now 1` while 3 pages wait; the form and the report name them.
- **Related:** none.
- **Watch out:** `max_active` is "ladders written at once". `Cadence_Plan.js:141-143` and `cadence.ts:258-259` write the first
  `max_active` active ladders and queue the rest. A new ladder stored as `status: "active"` (`Ladder_Settings_Rows.js:36`) is therefore
  queued by design. **Do not "fix" the active count.**

### R46 (A-13) — "The editor had 2 round(s)" after one editor call, and the ledger prices a second

- **Severity:** Low.
- **Feature / run:** page run, exec 616.
- **What the customer sees:**
  - Page report `qa_quality.note`: *"The editor had 2 round(s) and the page still fails the checks above: it is delivered as a draft
    to finish by hand …"*.
  - `run_ledger` Editor line: *"… repeated for the 1 round(s) the counter did not see"*, `$0.4256`.
- **Evidence:** exec 616 node list: `Claude — Editor [0]` and `Editor [0]` only (one run, 235 s). `Content QA` ran twice (rounds 1
  and 2).
- **Root cause [confirmed in code]:**
  - `v5/code/Content_QA.js:603` prints `max_rounds` (the QA rounds, `qa_max_rounds` = 2) as editor rounds. With QA rounds N the editor
    runs at most N − 1 times.
  - Cost: `build_v4.py:4236` `__qaRounds()` returns the last `Content QA.qa_round` (2), and `:4247` / `:5874` / `:7539` set
    `calls = answers.length × __qaRounds()` for a `loop` node (the Editor). That gives 2 calls for one.
  - `v5/code/_cost_cal.js:106-125` then prices the "repeated" round.
- **Same cause elsewhere:** every page run that reaches QA round ≥ 2. A page passing at round 2 is also priced at 2 editor calls.
- **Correct behaviour:** the note counts editor calls (`qa_round − 1`, or the Editor node's run count), and the ledger prices
  `qa_round − 1` editor calls.
- **Acceptance test:**
  - (a) Offline: replay `Content QA` round 2 (exec 616 input). The note says "1 editor round". `Run Ledger Settle` with exec 616's run
    data prices the Editor once.
  - (b) Live: a not-ready page run's note and ledger agree with the n8n node runs.
- **Related:** R47, R57.
- **Watch out:** the Editor node is wired as a loop (`build_v4.py:7452` asserts it), so a 3-round QA would run it twice. The fix is
  "rounds − 1", not "1".

### R48 (A-15) — The verdict calls an ASP "FTA-accredited"; accreditation is run by the Ministry of Finance

- **Severity:** Low (wording).
- **Feature / run:** verdict, exec 608.
- **What the customer sees:** keyword report `risks[2]`: *"Tech& must be honest about its accreditation. If it is not an
  FTA-accredited ASP, the page has to position it as an implementation partner …"*.
- **Evidence:**
  - The MoF's own service page "Accreditation of eInvoicing Service Providers" (mof.gov.ae) says providers apply to the Ministry; the
    standards are set by MoF and FTA (web search 2026-10-16).
  - The wording is in the run's inputs. Exec 608 → `SERP Top 10` snippet: *"SMARTeIS is an FTA-accredited ASP"*.
    `Analyze Competitor Pages` / `Collect Facts`: *"Businesses must appoint an FTA accredited ASP"*.
- **Root cause [hypothesis]:** the model reused the competitors' wording. No code produces it, and no prompt line mentions FTA
  accreditation (`v5/prompts/verdict.txt`, `competitor_analyzer.txt`: no match).
- **Same cause elsewhere:** any prompt that reads competitor text: brief, copywriter, outreach.
- **Correct behaviour:** "an ASP accredited under the Ministry of Finance's e-invoicing framework". A business-facts or glossary line
  in the UAE e-invoicing context would carry it.
- **Acceptance test:**
  - (a) Offline: none practical (model wording).
  - (b) Live: a verdict on a UAE e-invoicing keyword names the Ministry of Finance as the accrediting body.
- **Related:** R38.
- **Watch out:** many vendor pages say "FTA-accredited". This is a precision issue, not a factual error about dates or money.

### R50 (A-17) — The Keyword Check's own answer does not mention an existing ladder or page for the keyword

- **Severity:** **Low (lowered from Medium).** The app's ladder form warns at the next step.
- **Feature / run:** Keyword Check, execs 598 ("erp software uae") and 600 ("dynamics 365 partner uae").
- **What the customer sees:** the check's answer (label, plan, chance) carries no "you already have …".
  - "erp software uae" is the head of active ladder `lad_mv40b6s9h5a8` and has a `written` page in `seo_content_log` (2026-10-12).
  - "dynamics 365 partner uae" is the head of paused ladder `lad_mv4vxu3bq0kl`.
- **Evidence:** `files/assess-erp-software-uae.json` → `body.existing_keywords` contains both keywords (25 sent); the answer has no
  field about them.
- **Root cause [confirmed in code]:** `v5/code/Assess_Response.js:44` uses `existing_keywords` only to filter `alternatives`.
- **Same cause elsewhere:** none in the engine. The app covers part of it:
  - `app/shared/src/pipeline-notices.ts:210-220` ("You already have a ladder for …", mode `ladder`);
  - `:169` (keyword mode: "written … waiting to be published").
  
  Whether the "check a keyword" screen shows a notice was not verified in a browser.
- **Correct behaviour:** the check returns `existing: {ladder_id, status, page_url}` when the keyword (or the same search) is a ladder
  head or rung, or has a written / published page, and the label says it.
- **Acceptance test:**
  - (a) Offline: `Assess Response` with exec 598's input returns the existing ladder.
  - (b) Live: a check on "erp software uae" says it is already a ladder.
- **Related:** R49, R58.
- **Watch out:** the app's warning on the ladder step exists. Do not duplicate it; surface the engine fact so the check screen can
  show it.

### R52 (A-19) — The description's "Pages read" shows the same wrong title for all five menu pages

- **Severity:** Low. **Narrowed:** the `site_facts` half is withdrawn, see Watch out.
- **Feature / run:** describe, exec 606.
- **What the customer sees:** the site description page (`report-301ae0cd…` HTML): *"Pages read: Tech& | Turning Technology into
  measurable Business Impact, Tech& | Enterprise Automation & Digital Transformation Solutions, Tech& | Enterprise Automation & Digital
  Transformation Solutions, …"* (five times).
- **Evidence:**
  - Exec 606 → `Read Nav Pages`: each `page_text` starts "Title: Tech& | Enterprise Automation & Digital Transformation Solutions".
  - The live server HTML titles are "Industries We Serve | Tech&", "Capabilities | Tech&", "Cloud Services | Tech&", "Business
    Applications | Tech&", "Data & Analytics | Tech&" (curl, 2026-10-15).
- **Root cause [confirmed in code]:**
  - `v5/code/Site_Pages.js:21` takes the title from the Jina reader's `Title:` line. For this client-rendered site that is the
    application's generic title, not the page's `<title>`.
  - `:46` stores it in `site_pages`; `harness/code_v4/Build_Description_Page.js:40` prints it.
- **Same cause elsewhere:** any title taken from a `r.jina.ai` answer (`Read Client Pages` → `Collect_Client_Pages.js` uses the text
  only; the verdict's competitor pages use their own titles from the SERP).
- **Correct behaviour:** use the page's own `<title>` (the raw HTML the site serves), or the menu link text, and fall back to the
  reader's title only when neither exists.
- **Acceptance test:**
  - (a) Offline: `Site Pages` with exec 606's `Read Nav Pages` output plus the nav plan. When the reader title repeats across pages,
    use the plan's link text.
  - (b) Live: describe on techand.ai lists five different page titles.
- **Related:** none.
- **Watch out:**
  - **Withdrawn half:** `site_facts` is built from page headings **by design**. `Site_Pages.js:4` says so: it is the Critic's list of
    what the site says about itself (`Parse_Critique.js:24`), and it is not shown on the description page.
  - `nav_pages` (one "Read more" link on the bare host) is internal and not shown either. It was not pursued.

### R54 (A-21) — Results pages are bought for keywords the relevance screen then rejects

- **Severity:** Low ($0.006 in exec 610).
- **Feature / run:** ladder, exec 610.
- **What the customer sees:** nothing directly. `serp_check_cost_usd: 0.02` in the plan stats includes them.
- **Evidence:**
  - Exec 610 → `Run Ladder Cluster SERP` bought "transfer pricing consulting", "supply chain consulting uk" and "supply chain consulting
    meaning" at $0.002 each.
  - `Ladder Keyword Relevance` then rated them `relevance: 0` (`A-ladder-610-relevance.json`).
- **Root cause [confirmed in code]:**
  - `v5/code/Ladder_Cluster_Requests.js:21-22` filters the candidates only with `RAD.headFit`, which passes them through "consult"
    (R39). Its own comment says "no call is ever bought for a keyword the plan would have thrown away".
  - The AI relevance screen runs after the cluster calls (wiring `build_v4.py:6702-6711`: `Ladder Pool → Ladder Cluster Requests → Run Ladder Cluster SERP
    → Ladder Clusters → Ladder Relevance Chunks`).
- **Same cause elsewhere:** discovery's `Candidate SERP` runs after its relevance screen, so it is not affected.
- **Correct behaviour:** buy cluster results pages only for keywords that pass the relevance screen, or apply R39's corrected head
  fit first.
- **Acceptance test:**
  - (a) Offline: replay `Ladder Cluster Requests` with exec 610's pool and R39's token rule. Assert the three keywords are not
    requested.
  - (b) Live: a ladder's cluster requests contain no keyword later rated 0.
- **Related:** R39, R40.
- **Watch out:** moving the relevance screen before the cluster calls changes the node order that build section 55's ledger-order
  proof walks. Rebuild and run the lints.

### R55 (A-22) — Discovery's Search Console rows mix the bare host and `www.`

- **Severity:** Low.
- **Feature / run:** discover, exec 612.
- **What the customer sees:** in the Search Console table (`A-discover-612-result.html`), `page_mismatch` rows link to
  `https://techand.ai/…` while `striking` rows link to `https://www.techand.ai/…`. The canonical host is `www.techand.ai`.
- **Evidence:** exec 612 → `search_console.queries[*].answered_by.url`: bare for `matched_by: "impressions"`, www for `"query"` /
  `"slug"`.
- **Root cause [confirmed in code]:** `v5/code/_kw_inputs.js:87-93`. `row_page` uses the raw Search Console URL (`r.page`, bare for an
  `sc-domain:` property). The inventory match uses the inventory's (canonical) URL. Neither is passed through `SM.siteUrl`.
- **Same cause elsewhere:** `Rank_Keywords` `k.gsc.page` and any report printing a Search Console page URL.
- **Correct behaviour:** every site URL goes through the site model's canonical host (`SM.siteUrl`), as the rest of the engine does
  (`url_lint.py`).
- **Acceptance test:**
  - (a) Offline: `KWI.gscSeeds` with exec 612's rows. Assert every `answered_by.url` starts with `https://www.techand.ai/`.
  - (b) Live: the discover report shows one host.
- **Related:** R35.
- **Watch out:** the bare URLs are what Google reports. Keep them as `gsc_page` if needed, but print the canonical one.

### R56 (A-23) — "Already answered by" points at the blog index instead of the dedicated article

- **Severity:** Low.
- **Feature / run:** discover, exec 612.
- **What the customer sees:** *"9 keywords below are already answered by a page you have: … "dynamics 365 finance vat compliance uae" →
  https://www.techand.ai/insights … Refresh those pages instead of writing new ones"*.
  The site has the article /insights/how-microsoft-dynamics-365-finance-operations-supports-uae-vat-compliance (in the sitemap).
- **Evidence:** exec 612 → `keyword_strategy.covered[4]`: `{keyword: "dynamics 365 finance vat compliance uae", url:
  "https://www.techand.ai/insights", matched_by: "query"}`.
- **Root cause [confirmed in code]:** `v5/code/_site_model.js:148-152` `SM.matchPage` returns the **first** inventory page whose stored
  queries contain the exact query, before any slug / title match. Search Console credited the impressions to the /insights index, so
  the index wins.
- **Same cause elsewhere:** every `SM.matchPage` caller (R34's list).
- **Correct behaviour:** when the query-matched page is a listing / index page (/insights, /blog, a category) and a dedicated page
  matches by slug or title, name the dedicated page, and add that Google currently shows the index for it.
- **Acceptance test:**
  - (a) Offline: `SM.matchPage` with exec 612's inventory and the query → the article URL, with a note.
  - (b) Live: the discover header names the article.
- **Related:** R34, R36.
- **Watch out:** the Search Console fact (impressions on /insights) is real and worth keeping as context.

### R57 (A-24) — A Strategy Brief rejected by its parser is asked again, and the retry is not in the cost

- **Severity:** Low.
- **Feature / run:** page run, exec 616.
- **What the customer sees:** the run took 13.9 min. The Strategy Brief took two Opus calls (114 s + 129 s) and `run_ledger` prices one
  ("Strategy Brief: $0.1155 … counted 16567 prompt and 5 answer token(s)").
- **Evidence:** exec 616 → `Claude — Strategy Brief` has runs [0] and [1]; `Parser — Strategy Brief` [0] has error *"Model output
  doesn't fit required format"* and [1] succeeds; `Strategy Brief` has one run (246.7 s). n8n's `tokenUsageEstimate` for the two calls:
  $0.1628 + $0.1690.
- **Root cause [confirmed in code]:**
  - `build_v4.py:751` creates every agent with `retryOnFail: true, maxTries: 2`, so a parser failure re-runs the agent. n8n keeps only
    the successful run of the agent node.
  - The cost loop counts `answers.length` of the agent node (`build_v4.py:4247` and later copies). The count_tokens chain sees only
    the final answer.
- **Same cause elsewhere:** every agent built by that helper (Competitor Analyzer, Verdict Agent, Critic, Strategy Brief, …). A silent
  retry is never priced.
- **Correct behaviour:** price the number of language-model runs (the `Claude — …` sub-node's run count), and note "1 retry after a
  format error".
- **Acceptance test:**
  - (a) Offline: `Run Ledger Settle` with exec 616's run data prices 2 Strategy Brief calls.
  - (b) Live: a run with a parser retry shows it in the ledger basis.
- **Related:** R47, R46.
- **Watch out:** the retry itself is correct behaviour and must stay.

---

## WITHDRAWN

### R53 (A-20) — Ladder row `writing` while the content log says `written`: by design, not a defect

- **Severity:** withdrawn (was Low).
- **Feature / run:** page run 616. Ladder `lad_mv9wshpdy2jf` rung 1 has `seo_ladders.status: "writing"`; `seo_content_log` "ai
  consulting" has `status: "written"`.
- **Why withdrawn:** the ladder row's vocabulary uses `writing` for "written, not yet live", and the readers depend on it:
  - `v5/code/Tracker_Report.js:115` (*"written ('writing') but not live -> publish it"*);
  - `v5/code/Cadence_Plan.js:209-218` (the pile-up count reads ladder rows "still 'writing'" together with `written` content-log rows);
  - the app's ladder page states (`app/shared/src/data.ts:1075`, `waiting` derived from the log).
  
  Changing the ladder row to `written` would break those readers.
- **Watch out:** `state_lint.py:102` describes the machine as `planned -> writing -> written -> published`. That describes the content
  log. If the vocabulary is ever unified, Tracker_Report and Cadence_Plan must change in the same commit.
