# Fourth whole-system re-rating — live runs on techand.ai, 2026-10-17

The whole-system re-rating protocol (`../system-review-2026-10-11/FIX_PLAN.md` §5.2), run on the owner's site **techand.ai** (country
United Arab Emirates) on **2026-10-17 between 15:58 and 20:50 UTC**, after the R34–R119 fix waves of 2026-10-16 and the third wave of
28 benchmark rows (2026-10-17). Every analysis was sent the way the web app sends it (`X-Forwarded-For: app:<techand.ai company>` and
the company's own callback), so its report landed in the app's `reports` table; monitors were started on demand through the Test Runner.
**Executions 736–799** (excluding 795–796, which do not exist, and 797, an Error Handler run nobody started): every one `success` except
**798**, the deliberate failure used to test the alert path.

The deployed state matched the source exactly before the first run (checked by the orchestrator at 15:57 UTC through the n8n public API):
**24 published workflows, main workflow 687 nodes, every `workflows/*.json` node count equal to the live one**; nothing running; last
execution before the run 735.

**This document is the master record. The per-run evidence — every request body, quoted output, node-level checks, live-site checks and
cost reconciliation — is in the four part files beside it, which are part of this record:**

| Part | Runs | Written by |
|---|---|---|
| [`parts/1_keywords_content.md`](parts/1_keywords_content.md) | Site Admin, Keyword Check ×5, Reply Reader ×4, describe, verdict, a new ladder ("it consulting dubai") + its page, discover + its keyword report | executor A |
| [`parts/2_technical.md`](parts/2_technical.md) | technical audit (200 pages, **JavaScript crawl**), Full SEO Report (200 pages), pre-release check ×5 (incl. the new threshold / expected-change fields), stand-alone publish check ×5; every audit finding checked on the live site | executor B |
| [`parts/3_monitors.md`](parts/3_monitors.md) | AI visibility, backlinks, Link Builder, AI Pulse, **AI Growth (`dry_run: true`, its first live rating)**, Rank Tracker, Site Tracker, Page Watch, Content Cadence dry run, Audit Scheduler, the error path, the schedule / catch-up / alert record | executor C |
| [`parts/4_app_reporting.md`](parts/4_app_reporting.md) | the web app as a new customer (1440 / 390 px, light / dark), the read API + MCP with per-company keys, delivery and sharing, cost figures, the 26 reports of this run rendered and put through the delivery rule, the reliability record | executor D |

A separate document, [`MARKET_BENCHMARK.md`](MARKET_BENCHMARK.md), records the market as of October 2026 (Search Atlas, Ahrefs, Semrush /
Adobe, seoClarity, Conductor, BrightEdge, Botify, Profound, SE Ranking, Moz, Surfer, plus Evertune, Peec, Scrunch, AthenaHQ, Alli AI) with
sources opened on 2026-10-17. It was written from vendor sources and Ascentra's own docs, not from this run.

**How it was run.** Four executor agents ran and recorded the runs in the main checkout; none scored anything. A and B ran in parallel
(15:58–16:22), D drove the app at the same time without starting any engine run, and C ran the monitors after A and B had finished
(16:27–16:54, then the error path at 20:34–20:36). A session limit stopped every agent between ≈ 18:30 and 20:33 UTC; no run was in
flight then, and no run was repeated afterwards. The Test Runner had been left `active` since the 2026-10-16 fix-wave live checks; it was
used 16:34–16:48, deactivated by the orchestrator at 20:33:27, re-activated by C for the error test 20:34:43–20:35:24 and is `active:
false`. The orchestrator re-checked every High finding against the executions, artefacts or code before accepting it (§0b). The score
is given separately, by an independent session that took no part in the run (`SCORECARD.md`).

**Rules kept.** No outreach e-mail (no mailbox connected); nothing published; no WordPress push; **no URL submitted to Bing or IndexNow**
(AI Growth ran with `dry_run: true`; both submit nodes are gated on it and neither ran — there was also nothing due, so the dry-run branch
itself was not exercised); no credential printed or stored in the record; no code, workflow, prompt or credential changed during the run;
nothing deployed. Third parties received nothing; public pages were read (GET) to check claims. One dev-stack action: executor D restarted
the dev web container once (≈ 16:11:40 UTC) to clear Vite's stale dependency cache (`504 Outdated Optimize Dep`), nothing else.

---

## 0. Spend

**DataForSEO $2.5905 measured from the account; Claude $1.2558 from n8n's own token counts ($0.8991 measured + $0.3567 n8n's estimate for
the three Opus streaming calls of page run 771). Total ≈ $3.85** (2026-10-15: $2.45 + $1.41 = $3.86).

| Window | UTC | Runs | Account moved | Engine's own ledger | Difference |
|---|---|---|---|---|---|
| A + B | 15:58:37 → 16:25:46 | 736–771 | **$1.099915** | $1.0998 (A's runs $0.6274 + 739 $0.0954 + 767 $0.3770) | −0.01% |
| C | 16:27:44 → 20:36:24 | 772–799 | **$1.490549** | $1.4785 (rows 153–165) | −0.8% (inside the one overlap, 776 + 777) |
| Total | 15:58:37 → 20:36:24 | | **$2.590464** ($8.022516 → $5.432052) | $2.5783 | −0.5% |

Claude by part (n8n token counts at list prices): A $1.0354 (27 calls; engine ledger **$1.5984**, +54%: modelled thinking tokens, A-27),
B $0.0451 (engine $0.0592), C $0.1753 (engine $0.1905), D none. Day total on the DataForSEO account: $2.682464 (incl. a scheduled
pulse replay of $0.092 before the run). **Balance left: $5.43.**

---

## 0b. What the orchestrator verified independently (every High)

| Claim (part id) | How it was checked | Result |
|---|---|---|
| 20 pages "AI crawlers see a different version" are false (B-1) | `v5/code/Render_Diff.js` `fromCrawl` (≈ l.118-128) vs the method text in `B-audit-739-doc.txt` l.93 | **Confirmed**: the rendered side takes DataForSEO's `internal_links_count` / `external_links_count` / `plain_text_word_count`, the raw side our own parser, while the report says both are read "with the same parser"; the finding is printed at l.224 / 371 / 487 |
| Brand-rank finding from one search for "tech&" (B-2) | `B-audit-739-doc.txt`; part 2 §B-2 | **Confirmed** as described in part 2 (the run's own Search Console rows hold "techand" #4.5 and "tech & ai" #2.7) |
| Full report keyword lists carry other services / another company's name (B-3) | `B-fullreport-767-doc.txt` | **Confirmed**: "mofa document attestation" ×4, "intelligent software solutions" ×5 (one with intent "Commercial") |
| One keyword planned on two ladder pages (A-8) | `A-ladder-770-rows-after.json`, `A-ladder-770-plan.json` | **Confirmed**: "it consulting company dubai" is a rung (row 32) and appears again in the plan's supporting lists (plan l.2215, 2549–2587, 2694) |
| Discover names a different page than Search Console in 17 of 79 rows (A-22) | part 1 §discover with `A-discover-764-strategy.json` | Accepted on part 1's row-by-row evidence (not recounted by the orchestrator) |
| Keyword report says to build pages the site has (A-23) | `A-kwreport-765-verdict.json` | **Confirmed**: "Build a Dynamics 365 Business Central/Finance & Operations ERP service page for Dubai/UAE …" |
| The weekly loop still never runs by itself (C-1) | part 3 §schedule; executions list since 735 (no trigger-mode execution of the weekly workflows; 728 catch-up `canceled`) | **Confirmed**: six of ten schedules have no trigger-mode execution since 2026-10-01; the catch-up sweep 728 was cancelled at its 900 s limit across a 44-min sleep |
| Onboarding step 6 crashes every time (D-1) | `app/web/src/components/site/MonitorSettingsFields.tsx:71` calls `useEngineCal()`; `app/web/src/lib/context.tsx:18` throws `useOrgCtx outside OrgLayout`; onboarding is outside OrgLayout | **Confirmed** in code; reproduced 4× in D's sweep |

---

## 1. Runs (summary — each part holds its full table)

| # (protocol) | What | Executions | Duration | DataForSEO (engine) | Status |
|---|---|---|---|---|---|
| 1 | Site Admin `monitors` | 736 → 737 | < 1 s | 0 | 200, only `updated_at` / `request_id` changed |
| 5 | Keyword Check ×3 (+2 to choose the ladder keyword) | 749–751 (+761, 762) | 5 s each | ≈ $0.024 each | 200 |
| 11 | Reply Reader ×4 | 753–756 | 3–8 s | 0 | all four classes right |
| 3 | `describe` | 757 → 758 | | 0 | completed |
| 4 | `verdict` "e invoicing software uae" | 759 → 760 | | | completed |
| 9 / 10 | `discover` + keyword report "erp system dubai" | 763 → 764 → 765 | | | completed |
| 6 / 7 | new ladder "it consulting dubai" + its page | 769 → 770 → 771 | page ≈ 10.8 min | | ladder `lad_mvcldcnv9q1q`; page **not ready** (QA) |
| 8 | Technical audit, 200 pages, JS crawl | 738 → 739 | 7 min 35 s | $0.0954 | health 85, 24 findings |
| 14 | Full SEO Report, 200 pages | 766 → 767 | 7 min 36 s | $0.377 | health 70, 55 findings |
| G27 | Pre-release ×5 | 740–744 | 0.1–5 s | 0 | pass / fail / pass(high) / fail(low) / 400 |
| new | Publish check ×5 | 745–748, 752 | < 1 s | 0 | 4 answered, 1 × 400 |
| 12 | `ai_visibility` | 772 → 773 → 776 | ≈ 3 min | | completed |
| 13 | `backlinks` full | 774 → 775 → 777 | ≈ 1 min | | completed (**not** refused by its parent) |
| 16 | AI Pulse | 778 → 779 | 1.5 min | | completed |
| 15 | Link Builder | 780 → 781 | 2.4 min | | completed, nothing sent |
| 17 | **AI Growth `dry_run: true`** | 782 → 783 | 53 s | | completed, nothing submitted |
| 18 | Rank Tracker | 784 → 785 | 23 s | $0.116 | 9 reports |
| 20 | Site Tracker | 786 → 787 | 1.5 min | | completed |
| G11 | Page Watch | 788 → 789 | 6 s | 0 | completed |
| 19 | Content Cadence dry run | 790 → 791 | 3 s | 0 | paused (pile-up) |
| 21 | Audit Scheduler → technical audit (no JS) | 792 → 793 → 794 | 5.7 min | | health 85 |
| — | Error path (Test Runner, unknown workflow) | 798 (error) → 799 | | 0 | Slack 200 + SMTP 250, recorded |
| UI / API | the app, read API + MCP, delivery, budget refusal | none | | 0 | see part 4 |

**26 reports reached the app** for the company (part 4 §6 lists each with its stage, status, the delivery decision and the render check):
23 would be delivered, 3 held (the not-ready page draft and two "started" notes). Delivery is off for every company; no report has ever
been delivered on the platform.

---

## 2. Findings (the parts hold the evidence, the correct output and the gap to the leader for each)

Severity as the executors assigned it: **High** = wrong advice or a wrong number shown to a customer, or a customer blocked; **Medium** =
misleading or missing something the run claims; **Low** = cosmetic or minor.

**High (8):** B-1 false "AI crawlers see a different version of 20 key pages" (measurement mismatch, scored) · B-2 brand-rank finding
from one search contradicting the run's own Search Console data · B-3 full-report keyword lists with government services, job searches
and another company's name (which also became an AI question) · A-8 one keyword planned on two ladder pages · A-22 discover names a
different page than Search Console in 17 of 79 rows · A-23 keyword report recommends building pages the site already has · C-1 the weekly
loop has still never run by itself (six of ten schedules no trigger-mode run since 2026-10-01; the catch-up replays only 36 h and its first
sweep was cancelled) · D-1 onboarding step 6 crashes every time for every new customer.

**Medium (≈ 33):** part 1 — A-1, A-5, A-9, A-10, A-11, A-12, A-13, A-14, A-15, A-16, A-17, A-24, A-25; part 2 — B-4, B-5, B-6, B-7, B-17;
part 3 — C-2, C-3, C-4, C-5, C-6, C-7, C-8, C-16; part 4 — D-2, D-3, D-4, D-5, D-7, D-8.

**Low (≈ 35):** A-2, A-3, A-4, A-6, A-7, A-18, A-19, A-20, A-21, A-26, A-27, A-28; B-8 … B-16, B-18; C-9 … C-15; D-6, D-9 … D-13.

### What did not recur from 2026-10-15 on the same inputs (quoted in the parts)

Part 1: no "good 50–70%" chance on an unmeasured reach; the Keyword Check names the ladder a keyword already heads; the verdict reads the
client page whole and no longer claims missing dates / tables / author; all 45 inventory rows carry titles; no sourced figure masked as
`[Confirm]`; answers counted in real tokens (not `[object Object]`); the content log stores `not_ready`. Part 2: the www / bare-host split
is its own finding with the right action (not "not indexed"); no findings on 308 stubs or `<u>`; extra crawl reports answer; duplicate
pages named; the domain-age cache used by the second full report (`skip: true`, 0 WHOIS); live check of the audit's 24 findings: **17
true, 1 false, 2 partly true, 4 unverifiable** (2026-10-15: 7 of 30 false). Part 3: backlinks not refused by its own parent; no stale alert
re-sent; the site report does not diff a full report against an audit; "publish it" only for drafts that passed QA. Part 4: verification
messages honest; the locked card no longer offers the service-account route; no 390 px overflow; monitor reports carry a cost card and
**the delivery rule now delivers monitor reports** (held on 2026-10-15).

### Protocol runs not exercised, and why

| Run | State | Reason |
|---|---|---|
| AI Growth's dry-run branch / a submission | not exercised | nothing was due for submission (`submit: []`); no test submission allowed |
| A scheduled (trigger-mode) run of a weekly monitor | not exercised live | no Monday since the 2026-10-16 deploy; the schedule record was read instead (C-1) |
| The app UI signed in inside the techand.ai company | not exercised | the test owner account has no known password in any repo script; no reset, session or membership was forced. Its data was read from the database and its 26 reports rendered with the app's own renderer |
| Share links, "Send it now", a real delivery | not exercised | the new test company owns no report; copying the techand reports into it was refused by the permission system and not retried |
| `published` for a live page, the October check-in, a profile write + a content run using it | not exercised | nothing written has been published; only the owner can answer the check-in; no real author / reviewer / address on file |
| Fact check and corrections for wrong AI claims; per-engine change tests | not exercised | no business profile on file; fewer than 12 prior samples per engine |
| Source re-check on a page refresh; GA4 key-event reordering; hreflang | not exercised | no refresh run; GA4 recorded 0 organic key events; the site declares no hreflang |
| Link Builder sending, Reply Reader's mailbox effects | not exercised | no mailbox may be connected in a rating |

---

## 3. State left behind

- New ladder **`lad_mvcldcnv9q1q`** "it consulting dubai" (rows 30–33; `seo_ladder_settings` auto / active / priority 8) — the site now
  has **7 active ladders** against a cap of 2 (A-12); `seo_content_log` row 8 `not_ready`; **6 unpublished pages** in total.
- `seo_audits` rows 26, 27 (+ the Audit Scheduler's audit), `seo_audit_findings` rows for each; `seo_ai_daily` row 11; `seo_ai_growth`
  row 10 (dry run, nothing submitted); prospects 178 → 186, outreach rows 179 → 206 (nothing sent); alert rows 4 (attempt 6) and 5.
- Ledger rows 136–165, all `done`, none `reserved`.
- App: 26 reports for the techand.ai company; test users `rr1017-owner-…@example.org` / `rr1017-member-…@example.org`, company "Rerate
  1017 Trading" (`7bf8e6a6-…`), an unverified site `rr1017-newcustomer.example.com`, 3 API keys (all revoked), delivery Off, budget $25.
- Test Runner `active: false`. Nothing published, submitted or sent to a third party.
