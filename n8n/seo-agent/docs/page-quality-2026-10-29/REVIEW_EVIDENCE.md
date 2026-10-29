# REVIEW_EVIDENCE: a skeptical review of PLAN.md (2026-10-29)

Reviewer stance: senior SEO strategist and content editor, asked to find what in `PLAN.md` is unsupported, would not make pages rank
faster or pass an expert review, can be gamed, or is over-built. Read-only: no code changed, nothing deployed, no paid API called.

What I read: `PLAN.md`, the research files R2 (ranking evidence), R3 (page-type playbook, sections 0-2), R5 (grading and evals, sections
0-1, 3, 5-6), the code of `KWI.serpPageTypes` (`v5/code/_kw_inputs.js:251-300`), the saved production execution 3299 (page run) and the
published page as captured on 2026-10-28 21:28 (`live/page.html`, `live/page.txt` in the session scratchpad). Client page text is not
reproduced beyond short quoted fragments.

Labels as in the research files: **[doc]** engine or vendor documentation, **[evidence]** primary study with method, **[vendor claim]**,
**[thin]** secondary or inferred. **[replay]** means I re-ran our own code logic (a Python port of the classifier) on saved production data.

---

## 0. Verdict in brief

1. The plan's diagnosis is right and well sourced. 15 of the 16 sources I opened say what the research files say (section 1). One is
   mislabelled (Workshop Digital is one agency's own site, not its clients), and one fact has moved under the plan's feet (the UAE
   Phase 1 provider deadline was an amendment, and it falls tomorrow).
2. **Wave 0 would not stop a 63-quality page.** It stops *this* page only because of two accidents of this case: a low verdict score
   and a duplicate URL. Remove the duplicate and let the client click "Write it anyway", and the interim grade lands near 83 and the page
   is "Ready" with the same padding, repetition, weak sources and missing regulatory date (section 3.3). Readiness is tied to blockers
   only. Nothing in Wave 0 uses the one signal the plan itself calls calibrated (the Critic: 66 vs the reviewer's 63).
3. **Three concrete holes in the gates**: "Write it anyway" lifts the fit cap (consent is not quality); the SERP-type cap does not fire on
   the trigger case (our own classifier counts 3 of 10 results as service pages, above the 20% line, and exactly at Wave 1's "< 3 of 10"
   line) [replay]; source quality is counted on links, and the live page links one tier-1 source while quoting two weak ones unlinked,
   so it would pass.
4. **The causes of padding and repetition are two prompt lines, scheduled for Wave 4.** They should be in Wave 0.
5. **Scored with the plan's own rubric**, the published page lands at about 43 (range 38-50), not ready, against the reviewer's 63. The
   gates stop it, but the number under-reads a human by 15-25 points: binary items plus stacked caps deflate, and the caps are written in
   points of the default weights that page-type weights break. Calibration on 12 versions from one client cannot fix that.
6. Spam-policy exposure grows in Wave 4 (location, glossary, answer pages through a weekly cadence) with guards that test text
   similarity rather than purpose. The plan is also over-built in Wave 2 (three same-family judges, escalation, isotonic maps on ~12
   labels) where one reference-guided judge would do until the gold set says otherwise.
7. Section 8 (what to tell techand.ai) is partly stale: the live page's meta description is already a proper sentence, the page was
   rebuilt by the client's developers (FAQPage markup added, our Service schema dropped), and the promised "free refresh after Wave 0"
   needs Wave 1 and Wave 4 parts.

---

## 1. Source spot-checks (16 opened on 2026-10-29)

| # | Claim as used in the plan / research | Source opened | Result |
|---|---|---|---|
| 1 | UAE e-invoicing Phase 1 (revenue >= AED 50m): appoint ASP by 30 Oct 2026, go live 1 Jan 2027; Phase 2 31 Mar / 1 Jul 2027; government 1 Oct 2027 (PLAN §2.2, §8; R3 §2.3) | kpmg.com taxnewsflash, 22 Jul 2026 | **Confirmed**, but KPMG cites no decision number. A web search (Deloitte, Sovos, Middle East Briefing, Gulf News headlines) says the 30 Oct date is an **extension** of the original 31 Jul 2026 under Ministerial Decision 244 of 2025 as amended, that some vendor pages still show 31 Jul, and that the late penalty is AED 5,000 a month [thin: search summaries, not opened one by one]. See finding H5 |
| 2 | Only 1.74% of new pages reach top 10 in a year, 6.11% on non-empty English pages, 40.82% of those within a month, 72.9% of top-10 pages > 3 years old (PLAN §1.1) | ahrefs.com/blog/how-long-does-it-take-to-rank, 15 May 2025 | **Confirmed.** 40.82% appears only in the key takeaways. Six-month line confirmed |
| 3 | Refreshed service pages moved from position 41 to 23 in 90 days, controls fell (PLAN §1.1, T18; R2 §2.2 "one agency's clients") | workshopdigital.com/blog/content-refresh-analysis, 18 May 2026 | **Numbers confirmed (41.26 -> 23.29)**; **label wrong in R2**: the data is the agency's **own website**, not client sites; the author says Claude pulled the data; net-new pages had near-zero baselines. Controls: -20.2% overall, -9.1% blog, -33.4% service (R2 and R3 each quote a different subset, both right). See M6 |
| 4 | FAQ rich results stopped 2026-05-07, documentation removed 2026-06-15 (R3 §0.5, PLAN §2.11) | developers.google.com Search Central "Latest documentation updates" | **Confirmed** (8 May 2026 entry: "will no longer appear ... starting May 7, 2026"; 15 Jun 2026 removal) |
| 5 | Generative AI page updated 2026-10-01; "manually factcheck and review all AI-generated content"; review applies to meta descriptions; scaled content wording (R2 §1, PLAN Fix 1) | developers.google.com/search/docs/fundamentals/using-gen-ai-content | **Confirmed**, all four quotes |
| 6 | Spam policies updated 2026-08-28; doorway, scaled content, keyword stuffing wording (PLAN §7.1) | developers.google.com/search/docs/essentials/spam-policies | **Confirmed.** Doorway: "created to rank for specific, similar search queries", example "pages targeted at specific regions or cities that funnel users to one page". Used in H8 |
| 7 | Meta description: no length limit, truncated to device width (R3 §2.5) | developers.google.com/search/docs/appearance/snippet (updated 2026-04-20) | **Confirmed** |
| 8 | At most two listings per site in top results (R3 §1.4, R2 §0.3) | developers.google.com ranking systems guide (updated 2025-12-10) | **Confirmed** ("generally won't show more than two web page listings from the same site") |
| 9 | 38% of AI Overview citations rank top 10, down from 76%, 863k SERPs, March 2026 (R2 §0.4) | ahrefs.com/blog/ai-overview-citations-top-10, 2 Mar 2026 | **Confirmed** (37.9%) |
| 10 | Branded mentions correlate 0.66-0.71 with AI visibility, DR 0.27-0.33, 75k brands (R2 §0.5, PLAN §1.1) | ahrefs.com/blog/ai-brand-visibility-correlations, 12 Dec 2025 | **Confirmed** (0.664 / 0.709 / 0.656; DR 0.266 / 0.285 / 0.326) |
| 11 | Adding schema gave no citation lift, difference-in-differences, May 2026 (R2 §0.5, PLAN §7.3 #13) | ahrefs.com/blog/schema-ai-citations, 11 May 2026 | **Confirmed** (1,885 treated vs 4,000 controls; AIO -4.6%, AI Mode +2.4% n.s., ChatGPT +2.2% n.s.); caveat: only already-cited pages |
| 12 | Seer: cited pages updated within a year (R2 says 72%, R3 says 75%) | seerinteractive.com content recency study, 24 Jul 2026 | **Both confirmed**: 75% on the full dated set, 72% on the paired subset. Four brands, a GEO vendor's study [vendor study] |
| 13 | Whitespark 2026: "Dedicated Page for Each Service" #1 local organic, #2 AI; FAQs on service pages #60 / #43 (R2 §2.4, R3 §2.2) | whitespark.ca/local-search-ranking-factors (published 6 Nov 2025, 47 experts, 187 factors) | **Confirmed** (expert survey, grade C as labelled) |
| 14 | CheckEval: checklists raise inter-judge agreement by 0.45, EMNLP 2025 (R5 §0.5) | arxiv.org/abs/2403.18771 | **Confirmed** (metric not named in the abstract) |
| 15 | Pairwise preferences flip ~35% vs 9% for absolute scores (R5 §0.5) | arxiv.org/abs/2504.14716 (Tripathi et al.) | **Confirmed** |
| 16 | Haiku 5.5 exists at $0.10 / $0.50; forced `tool_choice` returns 400 on Opus 5.5 / Sonnet 5.5; `temperature` refused from API version 2026-10-21 (PLAN §2.7, R5 §5.2) | claude-api skill model table (cached 2026-10-06) | **Confirmed.** Also: Opus 5.5 effort defaults to `medium`; Sonnet 5.5 and Opus 5.5 can stop with `stop_reason: "refusal"` (see L2) |

Also verified in our own data: execution 3299 holds `verdict_score: 42` and a Critic `score: 66` (R5 §1.3 is right).

---

## 2. Findings

Severity: **High** = would let a bad page through, mislead the client, or break a gate on the trigger case; **Medium** = weakens a target,
an eval or spam safety; **Low** = cost, wording, cosmetics. Each finding: plan section, what is wrong, evidence, correction.

### H1. Wave 0 throws away the calibrated signal and leaves the causes of padding and repetition for Wave 4

- **Plan sections**: §1.1 ("The signal that was right was thrown away"), §2.4, §2.7, §3 (Wave 0 scope), §4 Wave 4 (W4-B).
- **What is wrong**: the plan's own diagnosis says the Critic (66) was the calibrated instrument and the code score (92/100) the
  inflated one. Wave 0 still does not use the Critic for anything. The two prompt lines that create the padding and repetition
  (`strategy_brief.txt:91` "reuse the People Also Ask questions", `copywriter.txt:61` every FAQ a heading, `copywriter.txt:72` keyword in
  H1, first sentence, two H2s and the last section) are scheduled for Wave 4, and dropping weak-only figures from the page is Wave 3.
  Wave 0 only *scores* repetition and weak sources; it does not stop the writer producing them.
- **Evidence**: R3 §0.4 traces "agentic ERP" and "which big companies use Dynamics 365" word for word to the SERP's PAA; the live page
  restates "Microsoft 365 is not an ERP / is the productivity suite" at least six times (intro, Quick answer, at-a-glance bullet,
  "a search for ms 365 erp refers to ...", the H2 "Paying for Microsoft 365 does not give you an ERP", the FAQ). The Critic flagged
  Visionet and Landbase as high severity; both reached the live page.
- **Correction**: add to Wave 0, all cheap: (a) delete or rewrite the three prompt lines (the PAA filter and "one home per proposition"
  wording of §2.4), (b) a weak-only market or compliance figure is a soft blocker that triggers a "rewrite without the number" edit, not
  only a points deduction, (c) re-run the Critic (Sonnet, about $0.05) on the delivered candidate, blind to the editor's history, and
  treat each unresolved high-severity problem as a soft blocker. This is the interim judge until Wave 2.

### H2. "Ready" is decided by blockers only, so a 63-quality page with no blocker is "Ready"

- **Plan sections**: §1.2 T7, §2.9 ("Can I publish this?" = blockers only), §7.3 #3, Fix 3.
- **What is wrong**: T7 promises zero "Ready" pages that humans score under 70, but no mechanism links the grade to the status, and
  §7.3 #3 forbids it. A page that is weak on usefulness, proof and accuracy without a hard defect still gets "Ready to publish".
- **Evidence**: section 3.3 below: the trigger page without its duplicate URL and with "Write it anyway" grades about 83 on the Wave 0
  interim formula with no blocker left. The reviewer's 63 had no single fatal defect either: it was many medium ones.
- **Correction**: keep "no single total as the gate" but add **dimension floors**: a page is "Ready" only when it has no blocker *and*
  every dimension is at or above 50% of its weight *and* (once calibrated) the total is >= 70; otherwise "Needs work: <dimension>" with
  the failing items. Floors are per dimension, so they are not the single-score gate §7.3 rejects.

### H3. "Write it anyway" lifts the fit cap

- **Plan sections**: §2.6 Keyword fit ("unless acknowledged"), Fix 3 item 3, §2.9 caps, R5 §3.3 B2.
- **What is wrong**: the client's acknowledgement turns "fit" from at most 8 of 20 back to full points. Consent to proceed says nothing
  about whether the page fits what ranks. On the trigger case the client asked for this page, so the acknowledgement is the likely
  path, and one click restores the inflated grade. It is also inconsistent with D2, where a recorded reason keeps the fit cap.
- **Evidence**: plan text; the verdict for 3299 said a page on this keyword alone is "a poor use of effort", which does not change when
  a client clicks a button.
- **Correction**: the acknowledgement changes the **status path** (the run may proceed and is not charged as a hold), never the **grade**.
  The fit cap stays and the reason is shown ("you chose to write this; the search shows explainers and low demand").

### H4. The SERP-type cap does not fire on the trigger case, and Wave 1's acceptance test uses an invented SERP

- **Plan sections**: §2.1 (page type from the SERP), §2.6 Keyword fit (Wave 0 uses `KWI.serpPageTypes` counts), §2.9 cap "requested
  type < 20% of the SERP", Wave 1 W1-B rule "< 3 of 10 -> hold", Wave 1 acceptance.
- **What is wrong**: the classifier lumps vendor product pages and software directories into "Service or product page". On the real
  "ms 365 erp" SERP it counts 3 of 10 as service pages: 30%, above the 20% cap, and exactly on Wave 1's "< 3 of 10" line, so neither
  rule fires. Wave 1's acceptance test ("SERP kinds {guide 3, forum 1, directory 1, service 1}") is not what our code sees on that SERP.
- **Evidence** [replay]: a Python port of `shapeOf` (`_kw_inputs.js:258-275`) on the top 10 organic results stored in execution 3299
  gives service 3 (dynamicssquare.com `/products/`, erpsoftwareblog.com `/software/`, microsoft.com `.../solutions/erp`), guide 3
  (visionet, abouttmc, esker `/resources/`), other 3 (YouTube, Gartner peer community, microsoft.com fr-fr), list 1. R3 §1.5's hand reading
  found 1 partner service page. Only one of the three "service" results is a business like the client.
- **Correction**: (a) Wave 0 must not use the SERP share for a cap until the vendor-official and directory shapes exist, or must add a
  small per-topic vendor list now (microsoft.com, sap.com, oracle.com...) and count software listing domains as directories; (b) the fit
  rule counts **provider service pages from businesses comparable to the client**, not "service or product"; (c) every SERP rule's
  acceptance test runs on the **stored real SERP of 3299** (and two other stored SERPs), not a synthetic distribution; (d) use "<= 3 of
  10" or a share, and test the boundary.

### H5. The regulatory facts step can state a superseded date, and does not know a deadline has passed

- **Plan sections**: Fix 6, §2.2 Market regulation, §7.1 "Stale regulatory facts", §8 urgency paragraph.
- **What is wrong**: (1) the Phase 1 provider date of 30 Oct 2026 is itself an amendment of 31 Jul 2026. A "read the top 2 official
  pages" step can return the original decision and state 31 July as fact. (2) 30 Oct 2026 is tomorrow: any page published after it must
  say the appointment deadline has passed and what follows (late penalties), which the plan's `regulatory_facts[]` shape (date +
  obligation + subject + threshold) cannot express. (3) "If none could be confirmed, say so" removes the single most useful fact when
  the official page is a PDF in Arabic or rendered by script, which is common for UAE ministries. (4) The live acceptance check says to
  compare "with the official MoF page by hand (... per the KPMG summary)": KPMG names no decision, so this is not an official check.
- **Evidence**: source checks 1 above (KPMG confirms the dates but no decision number; search results report the extension from 31 Jul
  and older vendor pages still showing 31 Jul).
- **Correction**: each fact carries `as_of`, `source_date`, `supersedes`, an amendment search ("amended", "extended", "postponed" plus the
  topic), and a status computed against the publish date (upcoming / passed / in force); the latest dated source wins. Add a second tier:
  two independent secondary sources (Big Four, law firms, government press) that agree, labelled as such in the page, when no official
  text can be read. Send techand the timeline today by hand rather than waiting for Wave 0.

### H6. Section 8 tells the client things about the live page that are no longer true, and misses what is

- **Plan section**: §8 ("Quick fixes on the live page today", item 1).
- **What is wrong**: the live page as captured on 2026-10-28 21:28 has a proper meta description (about 150 characters, one sentence),
  not a 20-character "Slug:" line. The client's developers rebuilt the Markdown inside their own site: the page carries **FAQPage**
  JSON-LD and no Service schema (we stopped emitting FAQPage on 2026-10-11, so they added it), `og:description` and
  `twitter:description` are the site's generic slogan, the "free of charge" answer became a CTA banner heading, and the sector sentence
  plus "We bring deep UAE & GCC knowledge" sit inside the "Data hosting" checklist item.
- **Evidence**: `live/page.html` (meta tags, three `application/ld+json` blocks, the `h2` and `li` elements around the spliced text).
- **Correction**: re-read the live page before sending §8; replace item 1 with: remove the sector and slogan sentences from "Data
  hosting", turn the "free of charge" banner heading into a normal CTA line, set a page-specific `og:description`, note that FAQPage
  markup earns no rich result since 7 May 2026 (harmless, optional to keep). Add a pipeline stage (see M8): the Publish Check compares the
  **live page** with our final version and grades the live page, because that is what reviewers and Google see.

### H7. The promised free refresh "after Wave 0" needs Wave 1 and Wave 4 parts

- **Plan sections**: §8 ("We will re-run their page for free after Wave 0 (option A as a refresh)"), §2.14 (Refresh type is Wave 4,
  triggers Wave 5), Wave 1 (update-vs-new routing).
- **What is wrong**: Wave 0 has no refresh type, no refresh brief block and no "keep the URL and the sections that earn queries" rule.
  A re-run after Wave 0 would write a new page again.
- **Correction**: either promise the refresh after Wave 1 with the minimal refresh brief block of R3 §3.13 pulled forward, or run it
  now as a hand-steered run (brief override with the existing guide's text as input) and say so to the client.

### M1. Caps are written in points of the default weights; page-type weights break them

- **Plan sections**: §2.9 caps, Fix 3 items 4 and 6, R5 §3.2-3.3, §3.5.
- **What is wrong**: caps say "fit <= 8 of 20", "accuracy <= 9 of 15", "proof <= 8 of 15", "structure <= 10 of 15", but service pages weight
  proof 25 and accuracy 10, local pages accuracy 25. "Accuracy <= 9 of 15" on a service page whose accuracy maximum is 10 caps nothing.
  The Wave 0 interim grade gives the freed 15 length points to "fit" (Fix 3 item 4) and then caps fit "of 20" (item 6).
- **Correction**: express every cap as a share of its dimension (fit <= 40%, duplicate fit <= 30%, accuracy <= 60%, proof <= 53%,
  structure <= 67%) and test one page under two type weightings in `S-GRADE`.

### M2. Source quality counted on links is gamed by not linking

- **Plan sections**: §2.6 Source quality, R5 C1 ("share of external citations from tiers 1-4 >= 60%").
- **What is wrong**: the live page links exactly one external URL (Microsoft Learn, tier 1) while quoting "as reported by Visionet" and
  "according to Landbase" without links. C1 computes 1 of 1 = 100% and passes. Unlinked attributions and unsourced figures are invisible.
- **Evidence**: `live/page.html` external links: only `learn.microsoft.com/.../whats-new-may-2026-resource-based` besides trackers.
- **Correction**: C1 counts **attributions in text** ("according to X", "as reported by X", "X found", "X's report") and every figure;
  a figure with no tier 1-4 attribution fails, linked or not.

### M3. The rubric as written deflates; calibration on this gold set cannot repair it

- **Plan sections**: §1.2 T1-T3, §2.9, §5.1-5.2, R5 §3.5, §5.4.
- **What is wrong**: binary items plus stacked caps score the live page about 43 (section 3) against a human 63; R5's own estimate was
  52. T2 (mean signed error within +/- 3) would fail before calibration, and the isotonic map is fitted on about 12 versions, four of the
  five cases from techand.ai and two on the same keyword. That fits the trigger case, not experts.
- **Correction**: partial credit per item (0 / 0.5 / 1) for judge items; show bands ("strong / fair / weak") instead of a number until
  `GRADE_PANEL_EVAL.md` shows MAE <= 8 on a hold-out of other clients; no isotonic map below 30 labels (identity plus bands).

### M4. The gold set cannot detect the bias it is meant to detect

- **Plan sections**: §5.1, Wave 6 cross-family trigger ("mean signed error > +3 on Claude-written pages"), D9.
- **What is wrong**: every gold page is Claude-written, so there is no contrast group for family bias. The owner is one of two raters
  but built the product and knows the faults: not independent. The Critic-vs-reviewer agreement (66 vs 63) is n = 1.
- **Correction**: add 15-20 non-Claude pages: the top-3 ranking pages for the held-out keywords (already read in the runs, free) and
  pages the clients wrote themselves; label them blind with the same rubric. A rubric that scores pages Google ranks top 3 under 60
  is miscalibrated on proof or local items. Use two external raters; the owner adjudicates only. Split dev / hold-out **by client**.

### M5. Some targets are gamed by the decide layer itself or confounded

- **Plan section**: §1.2 T12, T13, T15-T18.
- **What is wrong**: T15-T17 are measured only on pages "that passed the decide layer", so holding more keywords raises them. T18
  compares refreshed pages with "untouched pages", but refresh triggers pick decaying or striking-distance pages, which move back toward
  their mean on their own. T12 ("ready without body edits") rewards clients who do not read the page. T13 ("$0 on pages later blocked
  as duplicate") is met by not detecting duplicates.
- **Correction**: report the hold rate next to T15-T17, and what happened to the alternative actions offered for held keywords; for T18,
  a randomised hold-back: one in four eligible refresh candidates waits 90 days and is the control; replace T12 by "accepted, and the
  reviewer score >= 70 on the sample"; pair T13 with duplicate-detection recall on the gold set.

### M6. Evidence labelling: Workshop Digital is one agency's own site

- **Plan sections**: §1.1, T18; R2 §2.2 ("one agency's clients").
- **Evidence**: source check 3.
- **Correction**: relabel as "one agency's own B2B site, 95 refreshed pages, analysed with an LLM, grade C-" in R2 and the plan; keep
  T18's 10 positions as *our choice* with no external anchor; do not quote it to customers.

### M7. The real root cause (a page already serves the search) is caught after writing in Wave 0

- **Plan sections**: §2.1 (cannibalisation is Wave 1), Fix 4.
- **What is wrong**: "ms 365 erp" is stopped in Wave 0 only because its verdict score was 42. A keyword with a good score that
  duplicates an existing page (the techand guide ranked #32 for this search) is still written, then blocked: the money is spent (T13).
- **Correction**: in Wave 0, move the existing duplicate check (`duplicate_targets`, the Search Console query-to-page rows in
  `seo_query_history`) **before the brief** and hold on a hit with "improve <url> instead". The data already exists in the run; the full
  `_cannibal.js` stays in Wave 1.

### M8. No check of the page that actually went live

- **Plan sections**: §2.11 Publish, §2.13 Measure, §5.4.
- **What is wrong**: the plan grades our Markdown. techand's developers rebuilt the page (H6). Reviewers, other LLMs and Google judged
  the live page, which differs in schema, headings, links and head tags.
- **Correction**: extend the Publish Check to fetch the live URL, diff it against the final version (headings, CTA lines, external
  links, meta / og tags, JSON-LD types), run the deterministic grade items on it, and report differences to the client. Grade the live
  page in the §5.4 re-rating.

### M9. Spam-policy exposure in Wave 4 types and cadence volume

- **Plan sections**: §7.1 (scaled content, doorways), W4-D doorway guard, D11, D12, §2.14.
- **What is wrong**: the doorway guard tests text (two "verified local facts" and < 30% shingle overlap between siblings). Google's
  policy tests purpose: pages "created to rank for specific, similar search queries" and "pages targeted at specific regions or cities
  that funnel users to one page" [doc, spam policies 2026-08-28]. An LLM rewrite beats a shingle threshold easily. Glossary and answer
  pages written weekly by the cadence are the profile of "generate many pages without adding value" [doc, generative AI page
  2026-10-01]. The plan names the risk but caps volume only by "what the client can review", with no number.
- **Correction**: a location page needs a real presence in that place (address, staff, or named projects there) or a materially
  different offer, else hold; a hard cap per site (for example no more than 2 location pages and 2 glossary or answer pages a month, and
  new AI-written URLs in 90 days no more than a set share of the site's indexed pages, *our choice* to tune); every new page names a human
  reviewer on the client side before publish. D12: put Glossary and Listicle last.

### M10. Missing page types and decisions that matter for B2B service clients

- **Plan sections**: §2.4 page types, D12, §2.3 E-E-A-T.
- **What is wrong**: no **industry / vertical solution page** ("Dynamics 365 for trading companies in the UAE"), which is a core
  commercial page for B2B firms; no **author / expert profile page**, though §2.3 requires "a named person with role and profile URL" for
  service, comparison and local pages; no decision on **Arabic or bilingual pages** for UAE and KSA clients; no plan for **real images**
  (the reviewer docked text cards; the plan treats it as a known limit).
- **Correction**: add Industry page to D12 ahead of Glossary; add an author page generator to Wave 3 (it unblocks the E-E-A-T rule);
  owner decision on Arabic; ask for 2-3 client photos or a process diagram in the proof screen (W3-D).

### M11. Inbound internal links come too late

- **Plan section**: §2.11 (Wave 5).
- **What is wrong**: links from the hub and related pages are the cheapest way to get a new page found and understood, and the one
  refresh study the plan cites lists better internal links among the changes made. Waiting for Wave 5 leaves every Wave 1-4 page orphaned
  unless the client links it.
- **Correction**: suggestion-only inbound links (no CMS write) in Wave 1, from the site inventory already read.

### L1. Wave 2 is over-built for the evidence it has

- **Plan sections**: §2.7, Wave 2, §4.1.
- **What is wrong**: three Claude judges (Sonnet, Opus at low effort, Haiku) plus Opus escalation plus per-dimension isotonic maps,
  fitted on about 12 labels. The panel literature the plan cites favours *different families*; three Claude seats share their biases.
  The plan has 14 stages, 6 waves, about 33 agents and 18 targets.
- **Correction**: Wave 2 = deterministic items + caps + **one** reference-guided Sonnet checklist judge with quote verification; add a
  second seat only when the gold set shows judge variance or bias; cut the targets to the eight that gate (T1, T2, T5, T6, T7, T8, T11,
  T13) plus outcome reporting.

### L2. Judge cost and failure mode

- **Plan sections**: §2.7, §6.1.
- **What is wrong**: at list prices (Opus 5.5 $4 / $20, Sonnet 5.5 $2 / $10, Haiku 5.5 $0.10 / $0.50 per million tokens) and a 10-12k token
  reference pack, one grading is about $0.12-0.15 (J1 about $0.05-0.06, J2 Opus at low effort about $0.06-0.09, J3 about $0.002), so about
  $0.25-0.30 per page graded twice before escalation, not $0.15-0.25. Sonnet 5.5 and Opus 5.5 can also end with `stop_reason: "refusal"`;
  the plan does not say what a refused judge means.
- **Correction**: re-cost after the first recorded run; a refused or unparsable judge answer is "not graded" for its items, never a pass.

### L3. The splice detector misses the shape the live page shows

- **Plan sections**: §2.6 Splice / fragment, R5 F3.
- **What is wrong**: "At Tech&, consultation is free of charge." starts upper case and ends with a period; only the Finalize offset test
  catches it, and that test does not exist for the live page or for client edits. A heading that is a full sentence is not checked.
- **Correction**: add "heading ending with a period or written as a first-person claim" and "a first-person business sentence whose
  content words are absent from its paragraph" as checks on any version.

### L4. Small items

- Fix 3 item 5 ("95+") is cosmetic; keep it but do not count it as a fix.
- Fix 4 holds on an uncalibrated LLM score; for B2B, a 10-search commercial term can be worth a page. Log every hold and review the first
  20 with the owner before D3 adds volume rules.
- R3 §1.4 and R2 §2.2 disagree on the Workshop Digital control figures (both correct for different subsets); quote the subset.

---

## 3. The published "ms 365 erp" page scored with the plan's rubric

Rubric: R5 §3.1 items, service-page weights (usefulness 20, fit 20, proof 25, accuracy 10, structure 15, ready 10), caps of §2.9 converted
to shares of each dimension (M1). Scored on the live page as captured 2026-10-28 21:28, with the SERP and verdict stored in execution 3299.
Pass = 1, partial = 0.5, fail = 0; dimension = share passed x weight, then caps. Judge items are my judgement as a senior editor.

### 3.1 Items

| Dim | Item | Result | Why (short) |
|---|---|---|---|
| A | A1 answer first | pass | opening says the searcher almost certainly means Dynamics 365 |
| A | A2 must-cover questions | fail | no e-invoicing go-live date or threshold; PAA answered but off-intent |
| A | A3 decision help | pass | Business Central vs Finance and SCM rule, partner questions, quote lines |
| A | A4 information gain | partial | NAV / GP / AX path and UAE checklist add a little; the rest restates the top results |
| A | A5 no padding sections | fail | "What is agentic ERP?", "Which big companies use Dynamics 365?", the Project Operations release-note section |
| A | A6 CTA fits the evidence | pass | consultation CTA; "free" was confirmed by the client |
| B | B1 type matches the SERP | fail | 1 partner service page of 10 by hand (R3 §1.5); our code says 3 (H4) |
| B | B2 verdict >= 50 | fail | 42, not acknowledged |
| B | B3 no page for the same search | fail | Business Central service page and the guide ranked #32 |
| B | B4 verdict angle followed | partial | broadened to Dynamics 365 ERP, but "ms 365 erp" stays the H1 target |
| B | B5 searcher satisfied | pass | the naming confusion is answered |
| C | C1 sources tier 1-4 | fail | the two market figures rest on Visionet (relaying Panorama) and Landbase; only link is Microsoft Learn (M2) |
| C | C2 business statements on file | pass | partner, DAFZA, 20+ years, 24/7, sectors and free consultation all confirmed by the client |
| C | C3 own proof | fail | no case, no named client, no partner directory link; "deep UAE & GCC knowledge" is a slogan |
| C | C4 author / reviewer with role | fail | author is the organisation only |
| C | C5 no claims beyond facts | partial | sector list confirmed by a one-click "yes"; the reviewer disputed it |
| D | D1 regulated facts stated | fail | the 1 January 2027 go-live and AED 50m threshold are missing |
| D | D2 official source linked | fail | no Ministry of Finance link |
| D | D3 figures match source | pass | nothing checkable contradicts its source |
| D | D4 third-party product facts | fail | the SAP answer is vague by design |
| D | D5 locale as configured | pass | British, as the stored style guide says (the site writes American: D6) |
| E | E1 headings and order | pass | one H1, logical order |
| E | E2 no idea stated 3+ times | fail | the "Microsoft 365 is not an ERP" point at least six times |
| E | E3 unique list labels | fail | two different "five questions" lists, closing line "use the five questions"; also "four tools", "four ways", "four steps" |
| E | E4 readability | pass | plain sentences |
| E | E5 no orphan sentences | fail | the "free of charge" heading, the sector and slogan sentences in "Data hosting", "Packaged ERP or Enterprise Pair" |
| F | F1 meta description | pass on the live page | the client fixed it (our final version 3336 fails: 20 characters) |
| F | F2 title | pass | |
| F | F3 no splices | fail, **blocker** | two inserted sentences (above) |
| F | F4 spelling consistent | pass | |
| F | F5 images | advice | text cards |
| F | F6 no brackets, cut-off, dead links | pass | |

### 3.2 Totals

| Dimension | Raw | Cap | Score | Reviewer |
|---|---|---|---|---|
| Usefulness (20) | 3.5 / 6 | - | 12 | 22 / 25 |
| Fit (20) | 1.5 / 5 | verdict 40%, duplicate 30% | 6 | 8 / 20 |
| Proof (25) | 1.5 / 5 | weak sources 53% (not binding) | 7.5 | 7 / 15 |
| Accuracy (10) | 2 / 5 | missing must-mention 60% (not binding) | 4 | 11 / 15 |
| Structure (15) | 2 / 5 | idea 4+ times 67% (not binding) | 6 | 12 / 15 |
| Ready (10) | 4 / 5 | - | 8 | 3 / 10 |
| **Total** | | open blockers: splice, duplicate | **about 43 (range 38-50), not ready** | **63** |

Reading: the gates are right (two blockers, a hold), the number is 15-25 points under the human. The rubric punishes accuracy and
structure harder than the reviewer did, and gives readiness more than the reviewer did because the client had already fixed the meta.
On our own final version (3336, broken meta) the same scoring gives about 37. This is the deflation of M3, and it is why the grade should
show bands until it is calibrated on other clients' pages.

### 3.3 Would the plan's gates have stopped or fixed it?

| Gate | Wave | On this page | Stops / fixes? |
|---|---|---|---|
| Hold under 50 (Fix 4) | 0 | verdict 42 | **Stops before writing**, unless someone clicks "Write it anyway" |
| Duplicate blocker kept (Fix 2) | 0 | Business Central page | **Stops at "not ready"**, unless the client records a reason (D2) |
| Meta (Fix 1) | 0 | broken in 3336 | **Fixes** |
| Weaving and slogans (Fix 5) | 0 | splice, slogan, sector line | **Fixes** the two splices and the slogan prefill |
| Regulatory facts (Fix 6) | 0 | 2027 dates missing | **Fixes if** an official or agreed secondary page is read and the amendment is handled (H5) |
| Downloads (Fix 7) | 0 | no files | **Fixes** (the client rebuilt the page in its own site anyway, M8) |
| Interim grade (Fix 3) | 0 | 100 | Lowers it, but see below |
| PAA filter, one home per proposition | 4 | padding, repetition | **Not until Wave 4** (H1) |
| Weak sources removed | 3 | Visionet, Landbase | **Not until Wave 3**, and counted on links only (M2) |
| Proof minimum, author | 3 | slogan as proof, no person | **Not until Wave 3** |
| SERP type decision | 1 | explainers | **Does not fire** on the real SERP as coded (H4) |

**The counterfactual that matters.** Take the same page but assume (a) the client clicked "Write it anyway" (lifts the fit cap, H3) and
(b) no duplicate URL existed. Wave 0 interim grade: structure 25 minus repetition and list collision about 5 = 20; coverage 25;
readability 15; specificity 10 minus weak-only figures about 3 = 7; clean language 10; fit 15 points with the verdict acknowledged and a
SERP share of 30% = about 6-15; total about **83-92, no blocker, "Ready"**. The reviewer would still give it about 63-70. So Wave 0's T8 pin
(3336 <= 70) passes for this page's accidents, not because the plan measures what the reviewer measured. H1, H2 and H3 close that gap.

---

## 4. What holds up (keep as written)

- The three-layer diagnosis (decide wrong, write with wrong inputs, measure wrong things) and the root causes in §1.1, all traceable to
  execution data I re-checked (verdict 42, Critic 66).
- Update before new, one search one page, page type from the SERP: supported by Google's own documentation [doc, checks 8, 2] and the
  Ahrefs ranking-age data [evidence].
- No FAQPage / HowTo schema, no llms.txt, no schema-for-citation promises: supported [doc, check 4; evidence, check 11].
- Not promising positions; refusing chunked "LLM versions"; manual review of everything AI-written including meta [doc, check 5].
- Keeping state through Finalize (the PRC contract), and removing length from the grade.
- The honesty rules for the grade display (no 100, calibration claimed only once measured).

---

## 5. Corrections, most severe first

1. Wave 0: fix the causes, not only the score: rewrite `strategy_brief.txt:91` and `copywriter.txt:61, 72`, make weak-only figures a
   rewrite-triggering soft blocker, and re-run the Critic on the delivered candidate with unresolved high-severity problems as soft blockers (H1).
2. "Ready" requires no blocker **and** every dimension at or above 50% of its weight (and total >= 70 once calibrated) (H2).
3. "Write it anyway" changes the status path only; the fit cap stays (H3).
4. Fix the SERP rules on the real stored SERP: vendor and directory shapes before any type cap, count comparable provider pages, test the
   "3 of 10" boundary (H4).
5. Regulatory facts carry as-of date, supersedes, amendment search and a passed / upcoming status; add an agreed-secondary tier; send
   techand the timeline today by hand (H5).
6. Re-read the live page before §8 goes out; correct item 1; add the live-page diff and grade to the Publish Check (H6, M8).
7. Do not promise the refresh "after Wave 0"; pull the minimal refresh brief block and update-vs-new routing forward or run it by hand (H7).
8. Express caps as shares of their dimension (M1); count source quality on in-text attributions and figures, not links (M2).
9. Partial credit per item, bands instead of numbers until calibrated on other clients, no isotonic map below 30 labels (M3).
10. Add non-Claude and top-ranking pages to the gold set, two external raters, split by client (M4).
11. Report hold rate beside T15-T17, randomised refresh hold-back for T18, replace T12, pair T13 with detection recall (M5).
12. Move the existing duplicate and Search Console query-to-page check before the brief in Wave 0 (M7).
13. Doorway and scaled-content guards on purpose and volume: real presence for location pages, monthly caps per type and per site, a named
    client reviewer per page; Glossary and Listicle last (M9).
14. Add Industry pages and an author page generator; decide Arabic; ask for real images (M10). Move suggestion-only inbound links to Wave 1 (M11).
15. Simplify Wave 2 to one reference-guided judge plus code until the gold set justifies more; cut targets to the eight that gate (L1).
16. Re-cost the panel (about $0.25-0.30 per page) and treat a refused judge as "not graded" (L2); widen the splice detector (L3); relabel
    Workshop Digital as one agency's own site (M6).
