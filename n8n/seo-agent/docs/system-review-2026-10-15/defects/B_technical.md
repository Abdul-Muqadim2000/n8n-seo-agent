# Fix-ready dossier — technical audit, full SEO report, pre-release check (R59–R76 = executor B's B-1…B-18)

Written 2026-10-16 by executor B, read-only (no run, no code change, no Data Table write). Every statement below was re-checked
against the saved evidence and the code **as it ran**: the saved executions embed their workflow (`workflowData`), and every node
quoted here was compared byte-for-byte with `n8n/seo-agent/harness/code_v4/<Node>.js` in the main checkout — all identical — so the
`harness/code_v4/…:line` references are the exact code that ran. Where a node comes from a `v5/code/*.js` source, that file and line
are given too; where it comes from the v3 export or a `build_v4.py` patch, that is said. The main checkout's `v5/`, `build_v4.py`,
`harness/code_v4/` and `app/server/src/services/data.ts` are identical to the worktree this was written in.

**Evidence folder** (git-ignored): `/Users/abdul.muqadim/n8n_devaicon/n8n/seo-agent/docs/system-review-2026-10-15/files/`
— `exec-595.json` (technical audit), `exec-614.json` (full report), `exec-617.json` / `exec-618.json` (pre-release), `B-*`
artefacts, `report-2b58928c-…json` / `report-3fac33ae-…json` (the app's report rows). Abbreviated below as `files/`.
Paths without a prefix are relative to `n8n/seo-agent/`.

**Severity changes against the register:** R66 (B-8) Medium → **High**; R69 (B-11) Low → **Medium**. Reasons in each entry.
No defect withdrawn. One description corrected: R63 ("Links pointing to redirects" is flagged by the crawler on the redirect URLs
themselves). Parts left as hypothesis are marked **[hypothesis]**.

Order: High (R59, R60, R61, R66) · Medium (R62, R63, R64, R65, R67, R69, R76) · Low (R68, R70, R71, R72, R73, R74, R75) ·
then three observations found while re-verifying that are not in the register yet.

---

## High

### R59 (B-1) — The first-ranked audit finding reads "Google serves the bare host" as "pages not indexed"

- **Severity:** High (unchanged).
- **Feature / run:** technical audit exec 595 and full report exec 614 (the same finding, ranked first in both); also 2026-10-14
  exec 566 ("18 of 45").
- **What the customer sees:** Word / PDF report §1 *Fix These First*, first item, and `reports.payload.top_issues[0]`:
  > A large share of important pages is not indexed by Google — High (16 of 45 sampled pages: 1 × Discovered - currently not
  > indexed, 11 × URL is unknown to Google, 3 × Duplicate, Google chose different canonical than user, 1 × Crawled - currently not
  > indexed …) — Why it matters: Pages that Google has not indexed cannot rank at all, whatever their content. — How to fix: Open
  > each URL in Search Console's URL inspection, fix the stated reason …, then request indexing.

  Same report, §3 *What Works Well*: "One canonical host: https://techand.ai redirects (308) to https://www.techand.ai, and the
  canonical tags agree". §5b URL Inspection table prints Google's canonical for the 3 duplicate pages as a bare path identical to the
  page (`/d365-finance-operations-implementation-rollout-uae`), and the *Top page* table lists `/` twice (14 clicks / 410 and 3 / 153).
  (`files/B-audit-595-doc.txt`, `files/B-fullreport-614-doc.txt`.)
- **Evidence (exec 595; 614 is the same):**
  1. *GSC Audit Query* item 1 = Search Console page rows, 28 days (2026-09-15 → 10-12), 50 rows. By host: `techand.ai` **37 pages,
     28 clicks, 5,193 impressions**; `www.techand.ai` 13 pages, 4 clicks, 522 impressions (91% of page-level impressions on the bare host).
  2. All **16** "not indexed" www paths have a row on the bare host in that same answer — 1,374 impressions, 1 click in all:
     `/d365-finance-operations-implementation-rollout-uae` 330, `/whywith-techand` 292,
     `/insights/how-microsoft-dynamics-365-finance-operations-supports-uae-vat-compliance` 194,
     `/insights/the-cost-of-non-compliance-uae-e-invoicing-penalties-mitigation-costs` 180, `/capabilities/data` 95, `/whatwedo` 94,
     `/insights/the-financial-reporting-trap-…` 93 (1 click), `/ai-copilot-advisory-uae` 41, `/capabilities` 13, `/privacy` 11,
     `/security` 8, `/industries` 7, `/insights/agentic-ai` 5, `/capabilities/cloud-services` 4, `/insights/data-sovereign-asset` 4,
     `/cookies` 3.
  3. *GSC Audit Query* inspection answers for the 3 "Duplicate" pages: `googleCanonical: https://techand.ai/<path>`,
     `userCanonical: https://www.techand.ai/<path>`, `pageFetchState: SUCCESSFUL`; `referringUrls` include
     `https://techand.ai/sitemap.xml` and `https://techand.ai/insights/…`.
  4. *GSC Sitemaps (Audit)*: the only sitemap submitted to the property is `https://techand.ai/sitemap.xml` (bare host, submitted
     2026-09-07).
  5. *Analyze Probes* `measurements.hosts`: `apex_status 308`, `apex_location https://www.techand.ai/`, `canonical_tag_host
     www.techand.ai`, `consolidated: true`.
  6. *Build Site Issues* `search_console.index_coverage`: 29 of 45 www key pages "Submitted and indexed";
     `index_coverage.canonical_mismatch: 3` but `search_console.canonical_mismatch: []` — two counts of the same thing in one object.
  7. Live (curl, 2026-10-15): `https://techand.ai/<path>` → 308 → `https://www.techand.ai/<path>`; every www page has a www canonical;
     `/insights/your-current-pdf-invoices-…` links to three bare-host URLs (`files/B-live-techand-pages-scan.json`).
- **Root cause:** [confirmed in code]
  - `harness/code_v4/GSC_Audit_Findings.js:674` (source `v5/code/GSC_Audit_Findings.js:91`): every inspected URL with a verdict
    other than PASS counts as not indexed and, at ≥ 20%, raises the High "cannot rank at all … request indexing". It never checks
    whether Google shows the same path under the other host, although the page rows with their hosts (`pagesRows`, harness `:636` /
    v5 `:64`) are in the same function.
  - `harness/code_v4/GSC_Audit_Findings.js:678` (v5 `:95`): the canonical-mismatch finding only looks at `i.indexed` pages, so the
    three pages where Google chose the bare host (verdict NEUTRAL) never raise a canonical finding. `:663` / `:667` compute
    `index_coverage.canonical_ok` with the host-SENSITIVE `same` (`:554`, v5 `:8`) — giving `canonical_mismatch: 3` — while the URL
    keys used everywhere else are host-agnostic (`key`, `:562`, v5 `:14`). The split is computed and then not used.
  - `harness/code_v4/Analyze_Probes.js:49` (built from `build_v4.py:2244`): "One canonical host … and the canonical tags agree" is
    decided from the server's redirect and the homepage canonical tag alone; Google's own choice is never consulted.
  - The submitted sitemap's host is never compared with the canonical host (`v5/code/GSC_Audit_Findings.js:51-61`).
  - Report tables strip the host: `build_v4.py:3646` `p3 = (u) => …replace(/^https?:\/\/[^\/]+/, '')`, used for Google's canonical
    at `build_v4.py:3653` (harness `Build_Audit_Report.js:857/864`, `Build_Full_Report.js:867/874`); `build_v4.py:1401` `p2`, used
    for the *Top page* table at `build_v4.py:1421` (harness `Build_Audit_Report.js:761/783`).
- **Same cause elsewhere:**
  - Page Watch / Site Tracker / pre-release use the page-watch kit, whose `same` is host-AGNOSTIC (`v5/code/_page_watch.js:18-19`,
    used for `canonical_ok` at `:327`): a Google canonical on the bare host counts as "same as ours" there, so the daily watch can never
    see this split. `v5/code/Site_Metrics.js:112` alerts on a canonical mismatch only for indexed pages (the same blind spot as `:678`).
  - The impact basis of this finding (R65) and the "Pages shown in Google but never clicked" finding (bare-host URLs only, same
    report) are two more places the split shows without being named.
  - Not checked: the Site Tracker's weekly page tables (`v5/code/Parse_GSC.js`) for the same host stripping.
- **Correct behaviour:** one finding that states what the data shows, e.g. *"Google serves most of the site from https://techand.ai
  although every page redirects (308) to https://www.techand.ai and names www as canonical"*, with evidence: the host split of the
  Search Console page rows (37 vs 13 pages, 91% of page-level impressions on the bare host), Google's chosen canonical on the bare host
  for 3 pages, the bare-host sitemap being the one submitted, the internal links still pointing at the bare host. Fix text: submit the
  www sitemap in Search Console (in place of the bare-host one), change those internal links to www, keep the redirects, and watch the
  move — not "request indexing" page by page. The 16 www pages are then reported as "shown by Google under https://techand.ai" (with
  their impressions), not "cannot rank at all"; only pages with no impressions on either host stay in a not-indexed finding.
  What-works must not say the host is consolidated while Google picks the other host. Report tables print Google's canonical with
  its host whenever the host differs.
- **Acceptance test:**
  (a) offline — a harness scenario that feeds *GSC Audit Findings* the real inputs of exec 595 (the 48 *GSC Audit Requests* items,
  the 48 *GSC Audit Query* answers, *GSC Sitemaps (Audit)*, the probe measurements) and asserts: a host-split finding exists whose
  evidence carries the per-host page / click / impression counts above and names `https://techand.ai/sitemap.xml`; no finding says
  "cannot rank at all" for a path with impressions on either host; `index_coverage.canonical_mismatch` and
  `search_console.canonical_mismatch` agree; the rendered §5b table contains `https://techand.ai/d365-finance-operations-implementation-rollout-uae`
  with its host. A second fixture with every row on www must produce no host-split finding.
  (b) live — next technical audit of techand.ai: the host-split finding is first or second, "One canonical host … agree" is gone from
  what works, and any not-indexed list holds only paths with no impressions on either host.
- **Related:** R65 (impact basis from site averages), R63 (bare-host redirect items counted as pages).
- **Watch out:** do not "fix" this by making the not-indexed check host-agnostic and silently counting the bare-host rows as indexed —
  the www URLs really are not in Google's index; the finding must say why and what to do. Do not decide whether the redirect is right:
  the split may be a host move still in progress (29 www pages are already indexed) — **[hypothesis]**, the data cannot date when the
  308 was introduced. Search Console's state for the same URL changed between two runs 8 minutes apart (5 pages flipped between "URL is
  unknown to Google" and "Discovered - currently not indexed"), so do not key anything on the exact state label.

### R60 (B-2) — Full-report keyword research is seeded from three orphan card headings, and the topic gate never engages

- **Severity:** High (unchanged).
- **Feature / run:** full report exec 614; identical on 2026-10-14 exec 566.
- **What the customer sees:** Word / PDF §4: "Keyword research based on your services: ai & automation, assess & envision, build &
  implement"; *Easy Wins*: "ai mode (49,500/mo, difficulty 1), ai in cloud, ai on cloud, cloud's ai, blackbox ai, face swap ai, magic
  light ai, ai photo generator, uae company tax, mofa attestation dubai"; *Opportunities*: "ai", "character ai", "humanize ai", "google
  ai", "meta ai", "ai humanizer", "flow ai", "presentation ai", "mh enterprises uae", "ai image generator", "free ai image generator" …;
  *Keyword gap* (a High finding): "value-added tax", "vat", "company tax uae", … "mofa attestation dubai", "trade license", "trn", "icv
  certificate", "attestation", "how to check emirates id status with passport number". §8: the AI question asked of ChatGPT and
  Perplexity is "Which are the best ai in cloud company United Arab Emirates?", which yields the High findings "ChatGPT recommends other
  providers, not you" / "Perplexity recommends other providers, not you" (bayzat.tech, nxaara.com, g42.ai, core42.ai …) and the Medium
  AI Overview finding.
- **Evidence:** exec 614 → *Fallback Queries* output `["ai & automation", "assess & envision", "build & implement"]` → *Analyze
  Keywords* `site_keywords.seeds` (the same), `easy_wins`, `opportunities_by_intent`, `keyword_gap`, `refused` (40 rows, every one
  `reason: "navigational"`) → *AI Queries* `category_query: "best ai in cloud company United Arab Emirates"`. In the same run *Restore
  Site Model* holds `site_model.services` (30 services: "Dynamics 365 Finance", "Dynamics 365 Business Central", "Azure OpenAI
  Service", …) and *Load Site Row (Model)* holds `keywords: "e invoicing software uae, erp implementation dubai, peppol uae"` and
  `services_json` — none of these reach the keyword research. *Get Crawled Pages*: the six `/whatwedo/*` pages have `click_depth 0`
  and `inbound_links_count 1`; the real service pages have depth 1 and 46 inbound links.
- **Root cause:** [confirmed in code]
  1. Seeds: `build_v4.py:649-674` (`setcode('Fallback Queries', …)`, harness `Fallback_Queries.js`) takes H1s of crawled pages sorted
     by `click_depth` ascending, then inbound links. Orphan pages reached only through the sitemap get `click_depth 0` from the crawler,
     so "AI & Automation", "Assess & Envision", "Build & Implement" sort ahead of every real service page.
  2. Topic gate disabled: `harness/code_v4/Analyze_Keywords.js:348-353` builds the gate's `topics` from `base.services`,
     `base.business`, the seeds and `base.site_description.products_or_services`, where `base = $('Competitor Analysis')` (`:1`). That
     item carries none of them (`services: null`, `business: ''`, `site_description: null` in exec 614), so the topics are the three
     seeds — about five distinctive words. `fitTopic` (`v5/code/_fit_gate.js:74-76`, harness `Analyze_Keywords.js:186`) returns
     `ok: true` ("too few topic words on file … to judge topic distance") under 12 words, so **no keyword is refused for topic**. The
     patch that added the topic bar (`build_v4.py:4095-4103`) names "ai", "character ai", "google ai", "meta ai", "mh enterprises uae"
     and "mofa attestation dubai" as the cases it was written to refuse; they still pass because of this.
  3. Government names: `v5/code/_fit_gate.js:40` lists `mofa` and `emirates id`, but `fitGate` (harness `Analyze_Keywords.js:223-227`)
     lets "<body> + one more word" through as a topic ("mofa attestation dubai" → rest `attestation`; "how to check emirates id status …"
     carries the content word "how to"); the topic bar was meant to be the backstop.
  4. AI question: `harness/code_v4/AI_Queries.js:7-19` takes the highest-volume commercial / transactional keyword of that pool ("ai in
     cloud", 27,100) as the category and wraps it in "best … company"; it never reads the site's configured keywords or its AI question
     panel (`seo_ai_prompts`).
- **Same cause elsewhere:** `fitTopic`'s "fewer than 12 words → judge nothing" applies to every caller that passes thin topics (the other
  inlined callers: Rank Keywords, Ladder Pool, Ladder Plan, Brief Context — `build_v4.py:2347`); not checked whether their topics are
  also empty. The Fallback Queries seeds also feed *Keyword Ideas* and *Pick Competitors* (R70). The AI category question feeds §8 and
  three findings.
- **Correct behaviour:** seeds and topics from what the business sells — `site_model.services`, the site row's `keywords` and
  `services_json`, the description — and a seed order that does not favour sitemap-only pages. With those topics the gate should refuse
  "ai mode", "blackbox ai", "character ai", "face swap ai" (no word of their own on topic) — expected from reading the code, not verified
  by running it. Government-service queries ("mofa attestation dubai", "emirates id status …", "trn") are refused or flagged. The AI
  question comes from the site's own panel / configured keywords ("e invoicing software uae" …).
- **Acceptance test:** (a) offline — feed *Fallback Queries* exec 614's *Get Crawled Pages* items: the seeds are not the three
  `/whatwedo` headings; feed *Analyze Keywords* exec 614's inputs plus the site model of *Restore Site Model*: `refused` contains "ai
  mode", "blackbox ai", "character ai", "google ai", "meta ai", "face swap ai", "mofa attestation dubai", "how to check emirates id status
  with passport number", and `easy_wins` / `keyword_gap` contain none of them; feed *AI Queries* the result: `category_query` is not
  "best ai in cloud company …". (b) live — next full report on techand.ai: §4 seeds name Dynamics 365 / Business Central / e-invoicing
  terms; easy wins and the gap hold no other brand, Google product or government service; §8 asks about the site's own market.
- **Related:** R61 (the "0 rankings" statements next to this list), R70 (paid competitor discovery that feeds the same seeds).
- **Watch out:** *Fallback Queries* is read by *Pick Competitors*, *Analyze Keywords*, *Keyword Ideas*, *Keyword Ideas (Retry)* and
  *Fallback SERP Retry Plan* — change the seed source once. Feeding the gate real topics is the fix; lowering the 12-word minimum would
  refuse good keywords on sites with little on file (the rule's own comment).

### R61 (B-3) — "The site does not rank in Google's top 10 for any keyword" while the same report's Search Console shows 15

- **Severity:** High (kept: a wrong number in the *Key Numbers* table and a High finding in `top_issues`. The direction — far behind
  the competitors — is right; the absolute statement is not).
- **Feature / run:** full report exec 614 (also 566).
- **What the customer sees:** Word / PDF §1 *Key Numbers*: "Keywords ranking (top 30) 0 · Keywords in top 10 0"; finding (High, 3rd in
  `top_issues`): "The site does not rank in Google's top 10 for any keyword — Top-10 rankings in United Arab Emirates: techand.ai 0 vs
  competitor median 266 (cleartax.com, azentio.com)"; §4: "Your site does not rank in the top 30 for any keyword in United Arab Emirates
  yet."; Medium "No rankings for informational searches — You rank for 0 informational keywords vs competitor median 109.5". Same
  report §3: "Ranks #1 for its brand name".
- **Evidence:** exec 614 → *Competitor Analysis* `competitor_benchmark.rows[0]`: `organic_keywords 0, top10 0` (DataForSEO Labs
  `domain_rank_overview`, read successfully); *GSC Audit Query* item 2 (100 query rows): 15 queries with average position ≤ 10, 123
  impressions, 5 clicks — `techand` 4.5, `tech and ai` 2, `copilot is changing business productivity` 2.5 (informational), `copilot
  advisory services` 3.2, `d365 f&o upgrade partner` 7 …; *AI Visibility* `queries[0]` "tech&" `your_position: 1`.
- **Root cause:** [confirmed in code] the statements are made from DataForSEO's ranking database alone: `harness/code_v4/Competitor_Analysis.js:64-69`
  (v3 node; severity patched at `build_v4.py:195`) raises the High when `you.top10 === 0`; `harness/code_v4/Analyze_Keywords.js:402-407`
  raises "No rankings for <intent> searches" when `you.by_intent[x] === 0`; `harness/code_v4/Build_Full_Report.js:1046` prints "does not
  rank in the top 30 for any keyword" when `your_top_by_intent` is empty. *Competitor Analysis* and *Analyze Keywords* run before *GSC
  Audit Findings*, and nothing afterwards (e.g. *Build Site Issues*, which holds both) reconciles them. `harness/code_v4/AI_Visibility.js:125`
  adds the contradicting "Ranks #N for its brand name" from a live SERP.
- **Same cause elsewhere:** *Key Numbers* and the benchmark row (`est_monthly_traffic 0` beside 32 measured clicks in 28 days); "Organic
  traffic is under 10% of competitors: techand.ai 0" (`Competitor_Analysis.js:76-80`) has the same shape — its conclusion holds, its
  "0" is the provider's estimate. Not checked: the keyword strategy / discovery reports.
- **Correct behaviour:** with Search Console connected, the ranking statements use it or name their source: "DataForSEO's database holds
  no ranking for techand.ai; Search Console shows 15 queries in Google's top 10 (123 impressions in 28 days)". No High built on the
  database count alone when the site's own data contradicts it; the intent finding counts Search Console queries too; *Key Numbers*
  labels the provider's figures as provider estimates.
- **Acceptance test:** (a) offline — wherever the reconciliation lands (e.g. *Build Site Issues*), fed exec 614's *Competitor Analysis*
  and *GSC Audit Query* items: no finding or table cell says "0 … top 10" / "any keyword" while a query row has position ≤ 10; "Ranks #1
  for its brand name" and a "does not rank" finding never appear together. (b) live — next full report: *Key Numbers* and the finding
  cite Search Console's count.
- **Related:** R60.
- **Watch out:** keep the competitor comparison like-for-like (provider vs provider). The fix is to stop presenting the provider's zero
  as the site's reality, not to compare Search Console clicks with a competitor's provider estimate.

### R66 (B-8) — The app compares a full report with the technical audit before it: wrong delta, "25 new issues", a High recommendation

- **Severity:** **High** (raised from Medium). Re-inspection found that the same comparison drives a High-priority *Recommendation*
  "Health score fell from 83 to 70 — New issues appeared since the previous audit", which is wrong advice; the register had only the
  "25 new" count.
- **Feature / run:** app technical page and recommendations, on the rows written by exec 595 (`aud_mv9wujhkclv`, site_audit, 83,
  19:07:10) and exec 614 (`aud_mv9x4zz1i6i`, full, 70, 19:15:18). **Derived from the code and the stored rows; not rendered in a browser.**
- **What the customer sees (derived):** technical page hero (`app/web/src/pages/site/TechnicalPage.tsx:127`): "Since the audit of
  15 Oct 2026: 1 issue fixed, 25 new issues, 26 still open. Health score down from 83 to 70."; *Health score change* "−13 pts" (`:142`,
  `scoreDelta` at `:116`); Recommendations (`app/server/src/services/recommendations.ts:257-261`): **High** "Health score fell from 83
  to 70 — New issues appeared since the previous audit. Start with the new critical and high findings."
- **Evidence:** `seo_audits` rows 19 and 20 and `seo_audit_findings` for the two audit ids (27 and 51 rows). Keys of the full report's
  rows not in the technical audit's: 25 (every Authority, Schema, AI and content finding); technical keys not in the full report: 1
  ("Content|articles with no outbound links to sources"). The engine's own diff of the full report (`files/B-fullreport-614-diff.json`):
  "1 fixed · 0 new · 51 still open (compared with the full SEO report of 2026-10-14)".
- **Root cause:** [confirmed in code] `app/server/src/services/data.ts:721-760` `technicalData()`: audits read sorted by `audited_at`
  (`:726`), `points` (`:730`), `selected` = the last (`:731-732`), `previous` = the one before it (`:733`) **whatever its
  `report_type`**; each finding's `new` / `fixed` status comes from that pair (`:740-756`). `TechnicalPage.tsx:109` falls back to the
  same neighbour; `recommendations.ts:257-258` takes `t.audits[length-1]` and `[length-2]` the same way. The engine filters by type
  (`v5/code/Audit_Diff.js:1-14`, "OF THE SAME TYPE"); the app does not.
- **Same cause elsewhere:** the overview health series (`recommendations.ts:419`, `series: audits.map(…)`) mixes the two score scales
  (technical vs full weights, `Build_Site_Issues.js` WEIGHTS) in one line; `data.ts:335` reads the audits again for the search page
  (annotations) — not checked whether it filters by type.
- **Correct behaviour:** compare an audit only with the previous audit of the same `report_type` (as the engine's diff does), show the
  engine's `audit_diff` where present, and fire the score-drop recommendation only within one report type. A full report following a
  technical audit shows the full-vs-full delta (69 → 70) or "first full report".
- **Acceptance test:** (a) offline — a server unit test on the two stored row sets (27 + 51 findings) plus the 2026-10-14 full report
  row: `technicalData` for the latest audit returns `previousAuditId = aud_mv8bsknpagb` (the 2026-10-14 full report) and 0 new;
  `recommendations` emits no `tech:score-drop`. (b) live — after any full report that follows a technical audit, the technical page hero
  quotes the full-vs-full delta.
- **Related:** R67 (two High counts on the same page), R74 (the "fixed" wording).
- **Watch out:** `technicalData(…, auditId)` lets the user pick an older audit — "previous of the same type" must be relative to the
  selected one, not the latest. Rows written before v4.5 may lack `report_type` (the engine skips them).

---

## Medium

### R62 (B-4) — Hex HTML entities are not decoded: a false "AI crawlers see a different version" finding and a false "unescaped entity" review finding

- **Severity:** Medium (unchanged).
- **Feature / run:** execs 595 and 614 (and 2026-10-14 566, where it was the only "new" finding of that diff).
- **What the customer sees:** Medium finding "AI crawlers see a different version of 1 key page(s) — Evidence:
  /insights/microsofts-saudi-arabia-east-datacenter-goes-live-in-november-2026-what-it-means-for-your-d365-roadmap (Main heading (H1))",
  and the table row "In the first response: Microsoft&#x27;s Saudi Arabia East Datacenter … | After JavaScript: Microsoft's Saudi Arabia
  East Datacenter …". Full report content review (Medium, not scored): "contact page shows 'Let&#x27;s discuss how we can help your
  business' with an unescaped HTML entity".
- **Evidence:** exec 595 → *Render Diff* `pages[3].figures` h1 `raw: "Microsoft&#x27;s Saudi Arabia …"`, `rendered: "Microsoft's Saudi
  Arabia …"`, `state: "differs"`; exec 614 → *Build Content Prompt* `content_prompt_our` contains `Let&#x27;s discuss` (1 × `&#x27;`,
  0 × `&amp;`). Live: the raw H1 (fetched with a GPTBot user agent) is `Microsoft&#x27;s …`, which every HTML parser shows as
  "Microsoft's"; `/contact-us` holds `Let&#x27;s`, shown as "Let's".
- **Root cause:** [confirmed in code]
  - `v5/code/_link_kit.js:6` `ent()` decodes `&amp; &quot; &#39; &#039; &apos; &lt; &gt; &nbsp; &#160;` and decimal `&#NNN;`, but
    **not hex `&#xNN;`** — what React / Next.js emits for an apostrophe. `LK.text` (`:7`) produces the raw H1 in *Render Diff*
    (`v5/code/Render_Diff.js:97`); the rendered reading arrives decoded from the render service (Jina reader), so the two differ.
  - `harness/code_v4/Build_Content_Prompt.js:2-4` (v3 node) decodes only `&nbsp;` and `&amp;`, so the reviewer reads the entity as text
    and reports it as an artefact.
- **Same cause elsewhere:** every user of `LK.text` / `LK.attr`: `v5/code/LB_Assemble.js`, `LB_Second_Requests.js`, `Verify_Links.js`,
  `_outreach_kit.js` (anchors, quotes, page titles in outreach evidence); `harness/code_v4/Analyze_HTML.js:207-209` (same
  `&nbsp;`/`&amp;`-only strip); the page-watch kit's `strip` (decodes `&nbsp; &#160; &amp;` only) — no false diff there (raw against
  raw), but entity text in what it prints.
- **Correct behaviour:** one decoder (named + decimal + hex) used on both sides of every comparison and on every text given to a
  model; no finding for this page.
- **Acceptance test:** (a) offline — *Render Diff* fed exec 595's *Fetch Raw Pages* / *Render Key Pages* items: `differs` is empty for
  the Saudi page and there is no "AI crawlers see a different version" finding; *Build Content Prompt* fed exec 614's *Fetch Page HTML*:
  the output contains "Let's discuss", not `&#x27;`; unit check `LK.text('Microsoft&#x27;s')` → "Microsoft's". (b) live — next audit:
  the finding is absent and the render table lists no difference for that page.
- **Related:** R76 (the same strip feeds the reviewer), R72.
- **Watch out:** the render diff compares six figures; decode before every comparison (title, canonical, robots too), not only the H1.

### R63 (B-5) — Two 308 redirect responses are treated as pages

- **Severity:** Medium (unchanged). **Description corrected:** "Internal URLs that redirect" (listing the redirecting URLs) is correct;
  it is "Links pointing to redirects" that names the wrong pages — the crawler flags `has_links_to_redirects` on the redirect URLs
  themselves, not on the page that holds the links.
- **Feature / run:** execs 595 and 614 (and 2026-10-14).
- **What the customer sees:** "No compression (gzip/brotli)" Medium, "Missing canonical tag" Medium, "Articles with no outbound links to
  sources" Low (technical audit only), "Missing Open Graph tags" Low, "Missing Twitter/X card tags" Info, "Links pointing to redirects"
  Low, and an extra row in "Long or messy URLs" — all naming
  `https://techand.ai/insights/the-cost-of-non-compliance-uae-e-invoicing-penalties-mitigation-costs` and
  `https://techand.ai/insights/upgrading-your-erp-for-uae-peppol-pint-ae-compliance-a-technical-integration-guide`; every page share
  reads "of 47 crawled pages" although the site-structure section says 45.
- **Evidence:** exec 595 → *Get Crawled Pages Answers* `tasks[0].result[0].items`: 47 items = 45 `resource_type: "html"` + 2
  `resource_type: "redirect"`, `status_code 308`, `meta: null`, `checks` true for `no_content_encoding`, `is_redirect`,
  `has_links_to_redirects`. Live: those URLs answer 308, `content-type: text/plain`; the www pages have a canonical, `og:title`,
  `og:image`, `twitter:card` and serve `content-encoding: br`. The engine's own score formula without these findings (+ R62's and R71's)
  gives 85 instead of 83.
- **Root cause:** [confirmed in code] `harness/code_v4/Build_Site_Issues.js:264` `pages` = every crawl item, no filter on
  `resource_type` / status; `:268` `total = pages.length` (47); the CATALOG loop `:318-339` raises a finding for every item whose
  `checks[key]` is true; the RULES loop `:434-452` runs `test(p, m)` with `m = p.meta || {}` — `meta` is null on a redirect item, so
  `!m.canonical` (`:386`), missing `og:*` (`:399`), missing `twitter:card` (`:402-404`) and `external_links_count === 0` (`:429-431`)
  all fire. Build Site Issues is a v3 node changed by 37 `patch('Build Site Issues', …)` calls in `build_v4.py`.
- **Same cause elsewhere:** *GSC Audit Findings*' site structure counts 45 (it filters), so two sections of one report disagree;
  *Fallback Queries* filters on status 200. The Audit Scheduler starts the same main-workflow audit, so scheduled audits carry the same
  findings.
- **Correct behaviour:** page rules and page shares run on HTML items only (45 pages). Redirect items feed one redirect finding — "3
  internal links point at https://techand.ai/… from /insights/your-current-pdf-invoices-…" — naming the page that holds the links (true
  live). "Internal URLs that redirect" may keep listing the redirecting URLs.
- **Acceptance test:** (a) offline — *Build Site Issues* fed exec 595's inputs: denominator 45; no compression / canonical / Open Graph /
  Twitter / outbound-links / links-to-redirects sample names a `https://techand.ai/` URL; health recomputes to 85 if nothing else
  changes. (b) live — next audit: none of those titles appears unless a real www page has the problem.
- **Related:** R64 (the redirect-chain report that could name the linking page is never read), R59.
- **Watch out:** the linking page needs another source — DataForSEO `on_page/links`, R64's redirect-chain report, or the raw HTML the
  audit already fetches.

### R64 (B-6) — The four extra crawl reports are requested without the crawl's task id and never read

- **Severity:** Medium (unchanged).
- **Feature / run:** execs 595, 614; the same on 2026-10-14 (551, 566). Inherited from the v3 workflow — it has never worked.
- **What the customer sees:** report notes "Some extra crawl reports were unavailable: duplicate_title: Task Not Found.;
  duplicate_description: Task Not Found.; non_indexable: Task Not Found.; redirect_chains: Task Not Found." — and no redirect-chain or
  non-indexable finding.
- **Evidence:** exec 595 → *Run Crawl Extras* 4 answers, each `tasks[0].status_code 40401 "Task Not Found."`, request echo `data:
  {"api":"on_page","function":"duplicate_tags","type":"duplicate_title","limit":100}` — **no `id`**. *Run Crawl Extras Retry Plan*:
  "nothing can be gained by asking again: Task Not Found.". *Check Crawl* and *Save Task ID* both carry `crawl_task_id:
  "10151902-2365-0216-0000-3f3f17128538"`.
- **Root cause:** [confirmed in code] `harness/code_v4/Crawl_Extra_Requests.js:2-3`: `const d = $input.first().json; const id =
  d.crawl_task_id;` — its input is the raw DataForSEO answer of *Get Crawled Pages* (v3) / *Get Crawled Pages Answers* (v4), which has
  no `crawl_task_id`; `id` is `undefined` and `JSON.stringify` drops it. The node comes unchanged from
  `workflows/SEO_Agent_v3_original_export.json` (no `build_v4.py` reference). *Collect Crawl Extras*
  (`harness/code_v4/Collect_Crawl_Extras.js:2`) already reads its base from `$('Check Crawl')`.
- **Same cause elsewhere:** *Build Site Issues* consumes the extras (`:266-267`, findings `:495-514`, note `:742`); *Render Diff* reads
  `crawl_extras.non_indexable` for the robots figure when the crawl rendered JS (`v5/code/Render_Diff.js:122`). Both silently get nothing.
- **Correct behaviour:** the four requests carry the crawl's id (from *Check Crawl* / *Save Task ID*); their findings appear when the data
  says so; the note names a failure only when the provider really fails.
- **Acceptance test:** (a) offline — *Crawl Extra Requests* run against exec 595's *Check Crawl* and *Get Crawled Pages Answers* items:
  every `body[0].id === "10151902-2365-0216-0000-3f3f17128538"`. (b) live — next audit: *Run Crawl Extras* answers `20000` four times;
  the notes no longer list "Task Not Found"; a "Redirect chains (2+ hops)" finding appears if the crawler reports one (live:
  `http://techand.ai/` → `https://techand.ai/` → `https://www.techand.ai/` is two hops; whether the crawler reports it is **[hypothesis]**).
- **Related:** R63.
- **Watch out:** once the extras are read, the next audit's diff will show their findings as "new" (duplicate titles / descriptions,
  non-indexable, chains) — that is the measurement starting, not the site changing; the diff should say so.

### R65 (B-7) — Impact weights use site-average estimates for pages Search Console measured in the same run

- **Severity:** Medium (unchanged).
- **Feature / run:** execs 595, 614.
- **What the customer sees:** "Orphan pages … an estimated 4 clicks and 637 impressions in the last 28 days"; "Placeholder (lorem ipsum)
  text is live … an estimated 1 clicks and 106 impressions"; "Missing meta description … an estimated 1 clicks and 106 impressions"; "A
  large share of important pages is not indexed … an estimated 10 clicks and 1,699 impressions" (first item of *Fix These First*).
- **Evidence:** exec 595 → *GSC Audit Query* page rows (50): the 6 orphan pages total 16 impressions, 0 clicks (www rows 1, 3, 2, 6, 4;
  `/whatwedo/run-optimize` none); `/industries` 0 / 7; `/power-platform-analytics-uae` 0 / 87; the 16 not-indexed paths 1 / 1,374 on the
  bare host. The estimate is `totals / pages_with_impressions × affected`: 5,308 / 50 × 16 = 1,699 and 32 / 50 × 16 = 10 — exact.
- **Root cause:** [confirmed in code] `v5/code/GSC_Audit_Findings.js:71` (harness `:636`) keeps only `pagesRows.slice(0, 10)` as
  `top_pages`; `v5/code/_impact.js:33-41` `trafficIndex` reads only `sc.top_pages`; `:77-85` falls back to the site average when no sample
  URL is in it. Second limit: the lookup walks `f.sample_urls` only (5–10 per finding), not every affected URL.
- **Same cause elsewhere:** every audit type uses `IMP.rank` (`build_v4.py:2867`); the app mirrors `_impact.js` in
  `app/shared/src/findings.ts` (`build_v4.py:3147`) — not checked whether it gets the same 10-row input.
- **Correct behaviour:** the lookup indexes every page row (50 here; host-agnostic by path, as `pathOf` already is) and every affected
  URL, and says "about …" (measured) when Search Console names the pages.
- **Acceptance test:** (a) offline — `IMP.rank` on exec 595's findings with a `search_console` carrying all 50 page rows: the orphan
  finding's `impact_traffic` is `{clicks 0, impressions 16, estimated false}` and the not-indexed one `{1, 1374}`. (b) live — next report:
  those basis lines read "about …".
- **Related:** R59, observation X-2.
- **Watch out:** keep `top_pages` at 10 for the report table — add a separate full index for the impact rather than enlarging the
  payload the app receives.

### R67 (B-9) — The full report's `seo_audits` row disagrees with its own finding rows

- **Severity:** Medium (unchanged).
- **Feature / run:** exec 614 → `seo_audits` id 20 and `seo_audit_findings` for `aud_mv9x4zz1i6i`.
- **What the customer sees:** app report summary `{high 17, medium 22, …}` and the technical page hero (both from `seo_audits`), against
  the page's per-category counts built from the rows (14 High) — two High counts for one audit (derived from code, not rendered).
- **Evidence:** row 20: `findings 51, high 17, medium 22, low 19` (17 + 22 + 19 = 58); rows: 51 = High 14, Medium 19, Low 18. The 7
  content-review findings (`scoring: false`: 3 High, 3 Medium, 1 Low) are in the severity counts, not in the rows or in `findings`.
- **Root cause:** [confirmed in code] `v5/code/Audit_Row.js:4`: `findings` counts `scoring !== false && severity !== 'Info'`, while
  `high / medium / low` come from `issue_counts` (`harness/code_v4/Build_Site_Issues.js:675-676`), which counts every finding including
  `scoring: false`; `harness/code_v4/Finding_Rows.js:4` stores only scored, non-Info findings.
- **Same cause elsewhere:** every full report (the content review is full-report only); technical audits are consistent (row 19: 27 = 4 +
  9 + 14). `issue_counts` also feeds the Word / PDF severity table and the callback summary.
- **Correct behaviour:** one definition — the row's severity columns count the stored (scored) findings, or the rows include the review
  findings with a flag — and the report's table says which.
- **Acceptance test:** (a) offline — *Audit Row* + *Finding Rows* on exec 614's *Audit Diff* item: `critical + high + medium + low ===
  findings === rows.length`. (b) live — next full report: the row's counts equal its rows.
- **Related:** R66.
- **Watch out:** the app reads both sources; changing only one side moves the disagreement.

### R69 (B-11) — The token counter counts a structured answer as "[object Object]": 9 Claude nodes' "measured" cost is wrong

- **Severity:** **Medium** (raised from Low): the defect is not specific to the Content Reviewer — 9 of the 11 count chains have the same
  input, so the "measured" label on Claude money is wrong for most of the engine's model calls.
- **Feature / run:** exec 614 (*Claude — Content Reviewer*); by code, every run that calls one of the 9 nodes below.
- **What the customer sees:** `run_ledger.ai_cost` in the full report payload: "$0.0370 … measured: Anthropic /v1/messages/count_tokens
  counted 10306 prompt and 5 answer token(s); the 1638 thinking token(s) it cannot see are modelled …", `measured_share 55.9`. n8n's own
  `tokenUsage` for the call: 11,190 in / 2,456 out = $0.0469.
- **Evidence:** exec 614 → *Prompt For Count (Content Reviewer)* `__answer: "[object Object]"`; *Count Prompt* `input_tokens 10306`;
  *Count Answer* `input_tokens 10311` (Δ = 5); *Content Reviewer* output `{output: {business_context, eeat_signals, findings, …}}` (an
  object).
- **Root cause:** [confirmed in code] `build_v4.py:7491-7492` sets `__answer = String($json.output ?? '')`; `build_v4.py:5836-5837` sets
  `String($('<agent>').first().json.output ?? '')`. For an agent with an output parser `output` is an object and `String(obj)` is
  `"[object Object]"`. Agents with `hasOutputParser: true` in `workflows/SEO_Agent_v4.json`: **Strategy Brief, Keyword Seeds, Competitor
  Analyzer, Content Reviewer, Critic, Keyword Relevance, Ladder Keyword Relevance, Site Describer, Verdict Agent**; Copywriter and Editor
  return text and are not affected.
- **Same cause elsewhere:** those 9 nodes in every mode that runs them (verdict, discover, ladder, content, describe, full report). The
  calibration rows built from these figures (`seo_cache` `cost:ai:*`, written by *Save Cost Calibration*) inherit the error.
- **Correct behaviour:** the answer counted is the JSON the model produced (`JSON.stringify(output)` when it is an object); the
  modelled-thinking remainder is then the real gap, not the whole answer.
- **Acceptance test:** (a) offline — the `__answer` expression evaluated on exec 614's *Content Reviewer* item yields a string of more than
  1,000 characters starting `{"business_context"`. (b) live — any run with a parser agent: *Count Answer* − *Count Prompt* is within about
  10% of n8n's reported output tokens minus thinking, and `measured_share` rises.
- **Related:** R68.
- **Watch out:** the count endpoint needs the answer as the model wrote it; key order or whitespace changes the count slightly — "within
  about 10%" is the honest bar, not equality.

### R76 (B-18) — The content review says "no badges" where the homepage shows a Microsoft Partner badge

- **Severity:** Medium (unchanged).
- **Feature / run:** full report exec 614.
- **What the customer sees:** finding (High label, not scored) "Microsoft partner status claimed but not evidenced — Menu items 'Business
  Central Partner' and 'Finance & Operations Partner' appear, but no badges, Partner Center link, specializations or certifications are
  visible in the text."; it also shapes the executive summary line "… shows no verifiable proof: no case studies, named experts,
  certifications or client evidence".
- **Evidence:** live homepage: `<img alt="Microsoft Partner" … src="/microsoft-partner.svg">` twice (header and footer); no link to
  Microsoft's partner directory found. Exec 614 → *Build Content Prompt* `content_prompt_our` contains no "Microsoft Partner" alt text.
- **Root cause:** [confirmed in code] `harness/code_v4/Build_Content_Prompt.js:2-4` strips every tag (`<[^>]+>`), image alt text included,
  and `:15` keeps only the first 2,500 characters per page (mostly navigation, as the review itself notes). The reviewer prompt (*Content
  Reviewer* node `text`, from the v3 export) tells the model to "Look for … unproven claims (partner, certified, client base)" from "raw
  text". The model is never shown the badge.
- **Same cause elsewhere:** every review finding about proof, logos and trust marks (client logos are usually images); the competitor
  homepages are read as Markdown whose image alt text (`![alt](…)`) is deleted at `:24`, so the comparison is equally blind.
- **Correct behaviour:** the reviewer's text keeps image alt text (e.g. `[image: Microsoft Partner]`) and decoded text beyond the first
  2,500 characters; the finding then reads "a Microsoft Partner logo is shown, but nothing links to a verifiable designation" — the true
  statement.
- **Acceptance test:** (a) offline — *Build Content Prompt* fed exec 614's *Fetch Page HTML* items: the output contains "Microsoft
  Partner". (b) live — next full report: no review finding says "no badges".
- **Related:** R62 (same strip function).
- **Watch out:** the 22,000-character total cap (`:17`) is there for cost; keeping alt text and dropping the repeated navigation is
  cheaper than raising the cap.

---

## Low

### R68 (B-10) — Run cost misses the first Google Business Profile lookup; a definitive "No Search Results" is retried and paid again

- **Severity:** Low (unchanged).
- **Feature / run:** execs 595 and 614 (every audit).
- **What the customer sees:** `run_ledger.dataforseo_usd` $0.0265 (595) / $0.3936 (614) with no "Fetch GBP" in `by_node`; the app's run
  cost and ledger rows 79 / 87 carry the same figures.
- **Evidence:** exec 595, tasks counted once by id: *Fetch GBP* 2 tasks × $0.0054 (`"Tech& Dubai"` → `40102 "No Search Results."`,
  `"techand Dubai"` → 1 item), *Fetch GBP (Retry)* 1 × $0.0054 (the same `"Tech& Dubai"`, 40102 again). With the crawl at the engine's
  own estimate the runs cost $0.0373 (595) and $0.4044 (614) — $0.0108 above the engine each time.
- **Root cause:** [confirmed in code] (1) `harness/code_v4/Build_Audit_Report.js:644` (and the same list in `Build_Full_Report.js`,
  `Build_Word_File.js`, `Build_Keyword_File.js`) — `__LEDGER_NODES` holds `'Fetch GBP (Retry)'` but not `'Fetch GBP'`: the original node
  was added in v4.5 (`build_v4.py:1815`) without joining the list; the retries were added wholesale later (`build_v4.py:7311-7316`).
  (2) `v5/code/_dfs_retry.js:22-31`: `PERMANENT` matches "not found", "permission", … but not "No Search Results", so a 40102 is
  `retryable` and *Fetch GBP Retry Plan* re-sends it.
- **Same cause elsewhere:** any paid node missing from the hand-written `__LEDGER_NODES` is missed the same way; no lint asserts that
  every DataForSEO HTTP node is listed (none found). "No Search Results" is retried wherever the kit runs (SERP, Labs, GBP).
- **Correct behaviour:** every paid node is in the cost walk (ideally derived from the workflow rather than a hand list); "No Search
  Results" is a final, valid answer — neither retried nor reported as a failure.
- **Acceptance test:** (a) offline — the cost walk on exec 595's run data reports DataForSEO $0.0373 with `by_node["Fetch GBP"] =
  0.0108`; the kit's verdict for `"No Search Results."` / 40102 has `retryable === false`. (b) live — next audit: `by_node` lists *Fetch
  GBP*, and *Fetch GBP (Retry)* does not run after a 40102.
- **Related:** R69.
- **Watch out:** `__dfsOnce` dedupes by task id across original and retry — keep both nodes in the list; the id prevents a double count.

### R70 (B-12) — Competitor discovery is paid for and discarded when the request names the competitors

- **Severity:** Low (unchanged).
- **Feature / run:** full report exec 614.
- **What the customer sees:** nothing directly; $0.024 per full report in `by_node` ("Find Competitors" $0.012, "Fallback SERP" $0.012),
  and "Competitors: provided by user" in the benchmark.
- **Evidence:** exec 614 → *Pick Competitors* `method: "provided by user"` for both; `competitors_evidence.labs` 1 task $0.012, `serps` 3
  tasks $0.012.
- **Root cause:** [confirmed in code] workflow connections (`workflows/SEO_Agent_v4.json`): *Schema Findings* → *Find Competitors*
  (unconditional) → … → *Fallback Queries* → *Fallback SERP* → *Fallback SERP Answers* → *Pick Competitors* only.
  `harness/code_v4/Pick_Competitors.js:37` decides "provided by user" after both calls have run.
- **Same cause elsewhere:** none found; *Fallback Queries* (free) must still run because four nodes read its seeds (see R60).
- **Correct behaviour:** with at least one competitor in the request, skip *Find Competitors* and *Fallback SERP* (keep *Fallback
  Queries* or its replacement).
- **Acceptance test:** (a) offline — wiring check: with `competitors` non-empty, no executed path reaches *Find Competitors* / *Fallback
  SERP*. (b) live — next full report with named competitors: neither node in `by_node`.
- **Related:** R60.
- **Watch out:** *Analyze Keywords* builds `serp_domains` from *Competitor Analysis* (the provided competitors), not from *Fallback SERP*,
  so skipping the SERP calls loses nothing there.

### R71 (B-13) — "Deprecated HTML tags" flags `<u>`, a conforming HTML element

- **Severity:** Low (unchanged).
- **Feature / run:** execs 595, 614.
- **What the customer sees:** minor item "Deprecated HTML tags · Technical · Low · 1 page — Replace deprecated tags with modern HTML/CSS."
  on `/insights/your-current-pdf-invoices-will-be-illegal-in-the-uae-by-2027-and-how-to-fix-it`; no tag is named.
- **Evidence:** exec 595 crawl item for that URL: `checks.deprecated_html_tags: true`, `meta.deprecated_tags: ["u"]`; the live page has
  2 `<u>` and none of center / font / marquee / strike / big / tt / frame / acronym / applet / basefont / dir / blink.
- **Root cause:** [confirmed in code] the CATALOG entry `deprecated_html_tags` in `harness/code_v4/Build_Site_Issues.js` and the loop
  `:318-339` raise the finding from the crawler's boolean alone; `meta.deprecated_tags` is never read. `<u>` is defined in the HTML Living
  Standard (not obsolete); the crawler's list treats it as deprecated.
- **Same cause elsewhere:** other CATALOG checks taken from the crawler's booleans without their detail — e.g. `no_image_alt`, which
  counted 45 pages although no `<img>` on the site lacks an `alt` attribute (all 45 pages have at least one `alt=""`, mostly decorative)
  — [not re-verified image by image].
- **Correct behaviour:** read `meta.deprecated_tags`, drop elements the current standard defines (u, s, small, b, i …), name the tags in
  the evidence; no finding for this page.
- **Acceptance test:** (a) offline — *Build Site Issues* on exec 595's crawl items: no "Deprecated HTML tags" finding. (b) live — next
  audit: the same.
- **Related:** —.
- **Watch out:** the finding is folded into "Minor items" but still scores in Technical; removing it moves Technical from 98 to 100.

### R72 (B-14) — "1 of 47 pages (20%)"

- **Severity:** Low (unchanged).
- **Feature / run:** execs 595, 614.
- **What the customer sees:** "AI crawlers see a different version of 1 key page(s) — AI Search Readiness • 1 of 47 pages (20%)".
- **Evidence:** exec 595 finding `affected_count 1`, `affected_pct 20`; `pages_crawled 47`.
- **Root cause:** [confirmed in code] `v5/code/Render_Diff.js:217-218` computes `affected_pct` against the 5 pages checked;
  `harness/code_v4/Build_Audit_Report.js:992` and `Build_Full_Report.js:942` print `${affected_count} of ${pages_crawled} pages
  (${affected_pct}%)`. `v5/code/Not_Crawled_Check.js:35-36` does the same with its share of URLs read.
- **Same cause elsewhere:** the score uses that 20% too (`Build_Site_Issues.js` section 7, share factor) — a sample share treated as a
  site share.
- **Correct behaviour:** print the denominator the percentage was taken on ("1 of 5 key pages read twice (20%)").
- **Acceptance test:** (a) offline — rendering exec 595's findings: no line where `affected_count / pages_crawled` differs from the
  printed %. (b) live — next audit's text.
- **Related:** R62 (this particular finding should not exist at all).
- **Watch out:** `_impact.js` uses `affected_pct` only when `affected_count` is missing — not the case here.

### R73 (B-15) — Lineage rows that do not match the report

- **Severity:** Low (unchanged; scope widened — two more wrong rows found).
- **Feature / run:** execs 595, 614.
- **What the customer sees:** §6a / §16a *Where these numbers come from* — technical: "Core Web Vitals (real users) | source not recorded
  | … unknown" and "Lighthouse scores and speed savings | Google PageSpeed Insights | one simulated mobile load per page tested"; full:
  "Searches per month … | sample 0 keywords", "Backlinks and referring domains | … | sample not recorded", "Core Web Vitals (real users) |
  Chrome UX Report | … | **measured**" (CrUX had no data), "Domain age | … | as of 2026-10-15 | sample not recorded".
- **Evidence:** exec 595: `crux.available false` with a reason; no PageSpeed node ran (`not_assessed` lists the lab test). Exec 614: about
  60 keywords printed in §4; `authority.rows[0].referring_domains 18`; `crux.available false`; *Domain Ages* `whois_requests 0`, ages
  "whois, stored 2026-10-11".
- **Root cause:** [confirmed in code]
  - technical: `harness/code_v4/Build_Audit_Report.js:1043-1046` (source `build_v4.py:6956-6958`): CrUX `available === false` →
    `LN.unknown` ("source not recorded") although the source is known and answered; the Lighthouse row is unconditional.
  - full: `harness/code_v4/Build_Full_Report.js:1181-1188` (source `build_v4.py:3752-3759`): keyword sample from `a.keyword_ideas ||
    a.keywords` (the data is in `a.site_keywords`) → 0; backlinks sample from `a.backlinks.referring_domains` (the data is in
    `a.authority`) → not recorded; the CrUX row is hard-coded `basis: 'measured'`; domain age uses `period: LN.asOf(today)` and a sample
    from `a.domain_ages.rows` (the node writes `ages`).
- **Same cause elsewhere:** `v5/code/Build_Keyword_Strategy.js:209` builds its own keyword lineage row — not checked.
- **Correct behaviour:** each row reads the field the report actually printed; CrUX says "no field data (the Chrome UX Report answered: too
  few visits)" instead of "source not recorded" or "measured"; a row appears only when the figure is in the report; cached data is dated by
  the cache date.
- **Acceptance test:** (a) offline — both builders on exec 595 / 614 items: no lineage row with "sample 0" / "not recorded" where the report
  prints figures; no Lighthouse row in a technical audit; the CrUX row is not "measured" when `available` is false. (b) live — next audit
  and full report §6a / §16a.
- **Related:** —.
- **Watch out:** `lineage_lint.py` (INVARIANTS rule 1) checks that lineage exists, not that it matches the printed figures — the fix should
  add that check.

### R74 (B-16) — The full-report diff calls a one-day SERP swing "fixed"; its summary misstates why a number is not compared

- **Severity:** Low (unchanged).
- **Feature / run:** exec 614's diff against 2026-10-14 exec 566.
- **What the customer sees:** "1 fixed · 0 new · 51 still open (compared with the full SEO report of 2026-10-14). 1 finding(s) are not
  compared as numbers: they were measured on a different number of pages this time (how many is shown with each)."; *fixed*: "Site does
  not rank at the top for its own brand name (High)".
- **Evidence:** exec 566 *AI Visibility* `queries[0]` "tech&" `your_position: null` ("not in top 20"); exec 614 `your_position: 1`; one
  SERP read each. The indexing row's `sample_note`: "16 now against 18 before, but how many pages each number was measured on was not
  recorded".
- **Root cause:** [confirmed in code] `v5/code/Audit_Diff.js:33` (harness `:373`): `fixed` = previous keys absent now, with no notion of a
  finding that rests on one external observation (SERP, AI answer, content review); `harness/code_v4/Audit_Diff.js:396` (patch
  `build_v4.py:5383`) prints "measured on a different number of pages this time" for every `sample_changed`, including the "not recorded"
  case. The brand finding itself (`harness/code_v4/AI_Visibility.js:118-125`) is decided on one SERP read.
- **Same cause elsewhere:** every finding from a single live observation (AI Overview citations, ChatGPT / Perplexity answers, content
  review) can flip between "fixed" and "new" from run to run.
- **Correct behaviour:** a finding that disappears because a single external reading changed is "no longer seen", not "fixed"; the sample
  sentence says "not recorded last time" when that is the reason.
- **Acceptance test:** (a) offline — *Audit Diff* on exec 614's *Build Site Issues* item with exec 566's stored rows: the brand row is not
  reported as a fix; the summary does not claim a different page count when `checked_before` is null. (b) live — the next full-vs-full
  diff's wording.
- **Related:** R66.
- **Watch out:** the app's technical page derives `fixed` from its own comparison (R66) — both places need the wording.

### R75 (B-17) — The pre-release check talks about a staging host on a production check

- **Severity:** Low (unchanged).
- **Feature / run:** exec 617 (all URLs on `live_host`, `staging: false`).
- **What the customer sees:** `not_checked`: "Search Console can only answer for URLs Google has seen; a staging URL has never been
  crawled …", "the Chrome UX Report has no real visitors for a staging host …", "a position exists only for a live URL".
- **Evidence:** exec 617 → *Prerelease Validate* items `staging: false`, `live_host: "techand.ai"`; *Prerelease Verdict* answer as quoted.
- **Root cause:** [confirmed in code] `v5/code/Prerelease_Verdict.js:88-92`: the `cannot` list is constant — it never reads `staging`
  (defined at `:14`).
- **Same cause elsewhere:** none.
- **Correct behaviour:** with `staging: false` the reasons say why the check does not ask (by design it reads only the pages), or offer the
  live URLs' index state from the page watch's latest rows; the staging wording only on a staging run.
- **Acceptance test:** (a) offline — *Prerelease Verdict* on exec 617's items: no `not_checked.reason` mentions staging. (b) live — a
  production-host call.
- **Related:** —.
- **Watch out:** the check is documented and asserted as writing nothing (`writes: "none"`, `build_api.py`); reading page-watch rows would
  add a Data Table *read* node — allowed by the assertion, which forbids only write / sub-workflow nodes.

---

## Observations found while re-verifying (not in the register yet)

- **X-1 — "Shallow site structure: 100% of crawled pages are within 3 clicks of the homepage" next to a High "Orphan pages" finding.**
  Exec 595 `site_structure.depth_buckets {"0": 7, "1": 36, "2": 2}`: the six orphan `/whatwedo/*` pages carry `click_depth 0` (the crawler
  starts from the sitemap), so they count as "within 3 clicks". Code: `harness/code_v4/GSC_Audit_Findings.js:585` (the what-works line)
  and `:731`. The same `click_depth 0` is what puts them first in R60's seeds. Suggested Low.
- **X-2 — "Pages with duplicate content" is weighted as a whole-site issue with no page named.** Exec 595: `affected_count 7`, `scope:
  "site"`, `sample_urls: []`, impact basis "the whole website · about 32 clicks and 5,308 impressions", 3rd in the fix list (above orphans
  and lorem ipsum). Code: `harness/code_v4/Build_Site_Issues.js:482-487` (`addCount` sets `scope: 'site'` with no URLs; the count is the
  crawl summary's `pm.duplicate_content`). Suggested Low–Medium.
- **X-3 — the technical audit's raw-page fetch identifies itself with Google's bot URL.** *Fetch Raw Pages* (exec 595 workflowData) sends
  `User-Agent: Mozilla/5.0 (compatible; SEOAgentAudit/1.0; +https://www.google.com/bot.html)`. Noted because that reading is presented as
  what "a crawler that does not render" sees, and some sites vary by user agent. **[not investigated]**
