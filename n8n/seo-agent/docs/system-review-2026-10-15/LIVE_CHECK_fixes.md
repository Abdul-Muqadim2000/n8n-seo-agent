# Live checks of the 2026-10-16 fixes (DEFECTS.md R34–R119)

Deployed 2026-10-16 00:22 UTC with `apply_env.py` from commit `d277644` (main workflow 674 nodes, 22 workflows published incl. the new
`SEOagentCatchUp1`; `sync_tables` added `seo_content_log.qa_reasons`; container recreated, `GENERIC_TIMEZONE=America/New_York`).
Data repair: `fix_not_ready_drafts.py --apply` marked rows 5 ("azure api management monetization", exec 554) and 6 ("ai consulting",
exec 616) `not_ready`; rows 3 and 4 stay `written`. DataForSEO balance before: $11.26.

A defect is **verified live** only when its dossier's live check passed below. Everything else merged is **fixed (harness)**.

| Defect | Live check | Execution(s) | Result |
|---|---|---|---|
| R49 | Keyword Check "erp software uae": no "good (50-70%)" on a reach with no measured ranking | 649 | **pass** — `chance.band: "unmeasured"`, "No estimated chance: … rests on no measured ranking", base rate 1.74% |
| R50 | Same check: the answer names the existing ladder | 649 | **partial** — `existing.note` "already one of your keywords (one of your keyword ladders)…", label "· already one of your keywords"; `ladder_id` / page null (the Keyword Check workflow loads no ladders yet) |
| R77 | API `backlinks` through the front door with nothing else running: child not refused by its parent | 645 (API) → 646 (front door) → 650 (Backlink Monitor) | **pass** — 650 ledger row `key: parent:646`, allowed, `done`; report `backlinks/progress` reached the app (request 645) |
| R81 (part 1) | the front-door row of the hand-off settles $0; the money sits on the child's row only | ledger rows 104 (646) / 106 (650) | **pass** — row 104 `settled_usd 0`, row 106 `dfs_usd 0.3722` measured |
| R59 | technical audit of techand.ai: the host split is named, not "not indexed — request indexing"; "One canonical host" not in what works | 647 (API) → 648 | **pass** — first finding "www and non-www are split in Google: most pages are shown under https://techand.ai, not https://www.techand.ai" (High, 16 of 47 pages); no not-indexed finding; no "canonical host" line in what works; `search_console.host_split` 37 bare-host pages / 89% of impressions |
| R65 | same audit: impact basis measured for the pages Search Console reported | 648 | **pass** — host-split finding "about 1 clicks and 1,362 impressions in the last 28 days" (measured, not the site average) |
| R117 | same audit: orphan pages are not "within 3 clicks" | 648 | **pass** — `depth_buckets {"0":1,"1":36,"2":2,"unlinked":6}`; no "100% within 3 clicks" line |
| R73 (technical half) | same audit: the CrUX lineage row names its source and answer; no unconditional Lighthouse row | 648 | **pass** — "Core Web Vitals (real users) · the Chrome User Experience Report · no field data · reported"; no Lighthouse row |
| R59 (Site Tracker path) | Site Tracker: a host-split alert for pages Google keeps under the other host | 651 (Test Runner) → 652 | **pass** — alert `host_split` "Google keeps 3 of the 44 pages it was asked about under https://techand.ai…"; action `host_split` |
| R111 | Site Tracker: no "publish" for the QA-failed drafts | 652 | **pass** — actions `fix_draft` "ai consulting" and "azure api management monetization" (with reasons); `publish` only for the two drafts that passed; `needs_fix` carried |
| R113 | Site Tracker subject: no raw "▲ 52%" beside a not-significant change | 652 | **pass** — subject "impressions ▲ 198% · 32 clicks (within normal variation) · 5 alerts" |
| R78 | site report compares like with like | 652 | **pass** — "Full SEO report health 68/100 · the report before it was a technical audit (80/100): different checks, so the two scores are not comparable"; technical audits compared only with technical audits |
| R112 (engine) | site report backlinks line | 652 | **pass** — "3 linking sites (all sources) · DataForSEO's index: 18 · … spam score 63 (the index's)" |
| R34 (inventory half) | the page inventory carries the live title of /ai-copilot-advisory-uae | 652, `seo_pages` | **pass** — title "AI Consulting Copilot Advisory UAE \| Tech", H1 "AI Consulting Copilot Advisory Services in UAE" (updated 00:29:45) |
| R91 | Rank Tracker ladder subjects say the depth that was checked | 653 (Test Runner) → 654 | **pass** — every subject "top page not yet in the top 50" / "at #48" |
| R90 | Rank Tracker: "facts erp" (another company's brand) set aside and written back | 654 | **pass** — Tracker Ladder Marks: `facts erp` → `set_aside`, "names another company on the results page: facts (facts.ae) (other brand)" |
| R87 | "e invoicing in uae" is not set aside and pursued in the same run | 654 | **pass** — its ladder report is a normal ladder report (the 10-15 set-aside was itself false, A4 §6); no head set aside this run |
| R88 | one movement figure for "erp implementation dubai" in one run | 654 | **pass** — both the ladder block and the tracked-keyword block: "0 of top 8 changed (noise)" (no new readings bought this run — all were fresh) |
| R35 | discovery: no "does not target this search" on pages that target it | 655 (API) → 656 | **pass** — 0 occurrences in the keyword strategy |
| R36 | discovery: no keyword with an on-site Search Console page left uncovered | 656 | **pass** — 0 of 138 keywords |
| R55 | discovery: one host | 656 | **pass** — every page URL on https://www.techand.ai; the bare host only in `gsc_page` (Google's own URL, kept on purpose) and one site-model nav entry |
| R56 | discovery: "answered by" not the /insights index | 656 | **pass** — no keyword covered by the index page |
| R51 | discovery: the pipeline pick is not a steeply falling keyword | 656 | **pass** — pick "erp system dubai" (trend +143%); the −77% "erp software uae" is not the pick (the relevance-prompt half stays open) |
| R58 | discovery: no ladder-covered topic in "Now" | 656 | **pass** — no Now cluster carries `ladder_covered` / `covered_by` |
| R34 (end to end) | a verdict for "ai consulting" finds the live page and improves it | 657 (API) → 658 | **pass** — Client Page Requests: existing `https://www.techand.ai/ai-copilot-advisory-uae`; `existing_page_action: "improve"`, reasons quote that page's 354 words. Seen: the page digest's author reads "Tech&amp;" (entity not decoded — cosmetic) |
| R49 (verdict path) | the verdict's own chance | 658 | **still open (known)** — `for_you.chance` "good (50-70%, uncalibrated)": Parse Verdict's `reachPlan` call was not given the measured flag (A1 NEEDS ELSEWHERE) |
| R38 | the verdict on "e invoicing software uae" reads the existing article whole and states nothing it has as missing | 660 (API) → 661 | **pass** — digest of /insights/top-peppol-e-invoicing-software-features…: 2,137 words, 3 tables, author, published 2026-09-26, CTA, dates "30 October 2026" / "1 January 2027"; Check Page Claims dropped the analyzer's false "no table…" gap ("the page has 3 table(s)"); no "no dates / no tables / no author" anywhere in the verdict; reason: "a 2,137-word CFO feature guide with 3 tables, an author, a CTA" |
| R48 | same verdict: no "FTA-accredited" | 661 | **pass** — none; the verdict names a "Ministry of Finance ASP" |
| R60 | full report: seeds from the site's own keywords; no off-topic or government searches shown | 662 (API) → 663 | **pass** — seeds "e invoicing software uae", "erp implementation dubai", "peppol uae" (source "your keywords"); AI category question "best e invoicing software uae"; "mofa attestation uae / dubai / online" only in `site_keywords.refused`; no "ai mode", "blackbox ai", "character ai" |
| R61 | full report: no "does not rank in Google's top 10 for any keyword" beside Search Console's rankings | 663 | **pass** — the sentence is gone; the finding is "Far fewer top-10 rankings than competitors" with both sources |
| R73 (full half) | full report lineage rows match what is printed | 663 | **pass** — CrUX "no field data" (reported, not measured); Lighthouse row only with PageSpeed data (3 sites); domain age "looked up 2026-10-11 and cached" |
| R74 | a finding from one outside reading is not called "fixed" | 663 | **not exercised** — no single-reading finding disappeared this run (`no_longer_seen: []`). Seen: this one diff lists 3 "fixed" that are the old wordings our own fixes replaced (R59 / R61), 3 "new" their new wordings — a one-time effect of the rewording |
| R66 | the app's technical page after a full report compares full with full | app `technicalData` after 663 | **pass** — selected `full` 70 (2026-10-16) vs previous `full` 70 (2026-10-15); statuses 3 new / 3 fixed / 48 open (= the engine's diff); no "health score fell" recommendation |
| R110 | the delivery decision over the stored reports since 2026-10-15 (26 rows) | app DB | **pass** — all 14 monitor reports (`progress`: rank_tracker ×8, backlinks ×2, ai_visibility, ai_pulse, link_builder, site_tracker) → deliver; started notes (`accepted`) → held `interim`; QA-failed page 616 → held `not_ready`. "Send it now" to a test webhook not exercised |

Spend: DataForSEO $1.24 for the day after all checks (balance $11.26 → $10.02); Test Runner deactivated after use (`active: false`).

Also seen: execution 659 is discovery's own follow-up verdict on its pick ("erp system dubai", request 655) — by design.

Spend notes: the backlinks check was meant to be free but was sent with `free` instead of `free_only`, so it ran the paid path ($0.37).
