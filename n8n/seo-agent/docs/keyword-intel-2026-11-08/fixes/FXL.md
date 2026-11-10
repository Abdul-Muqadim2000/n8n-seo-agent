# KI FX-L: the engine fix round (2026-11-08, branch `ki/fxl`)

Engine fix round after the three independent reviews (REVIEW_LOGIC, REVIEW_PERF_SAFETY, REVIEW_CONSISTENCY). Section 1 was committed first
(f4872f92) so the app fixer FX-A could merge the constants; the WIP commit f212ff53 (owner usage-limit pause) and the final commit on top hold the rest.
Nothing deployed, pushed by me, paid or written to production.

## 1. Contract constants (engine = source of truth; `app/shared/src/ki.ts` mirrors, `harness/fixtures/ki_parity.json` holds both)

| What | Rule | Where |
|---|---|---|
| Verdict words | `go` Go, `months` Takes a few months, `hard` **Hard for your website now** (the app's existing wording), `gated` Not for you, **new `unknown` Not judged yet** (tone neutral): no Win, or a Win read with an unknown Strength whose range crosses a verdict line. Never shown as Hard. | `KI_VERDICT_IDS` / `KI_VERDICTS` / `KI_VERDICT_TONE`, `kiVerdict` (missing Win -> `unknown`), fixture `verdicts` + case "Win not computed" |
| Gate reasons | `seo_ki_keywords.gate_reason` holds ONE code ('' when the row passes): `other_market`, `career`, `other_brand`, `government`, `portal`, `navigational`, `own_brand`, `off_topic`, `too_broad`, `empty`, `low_fit`, `avoid`. The engine's sentence goes to the NEW column `gate_detail` (ladder_common `KI_KW_COLS`, synced by `sync_tables.py`). The app maps each code to its own words. | `KI_GATE_REASON_IDS`, `KiGateReason`, `KI_GATE_FIELDS = { code: 'gate_reason', detail: 'gate_detail', pass_code: '' }`, `KiKeywordRow.gate_detail`; fixture `gate_reasons`, `gate_fields` |
| Current rows (supersede) | After every keyword-research run that wrote rows, the engine DELETES the site x market rows of `seo_ki_keywords` and `seo_ki_gaps` whose `run_id` is not this run's (a user's gap status is carried to the new row by keyword key, not gap_id). A reader also keeps only rows whose `run_id` equals the latest `seo_ki_runs` row of kind `keyword_research` with status `ok` or `partial` (safety net if a delete failed). No new column. | `KI_ROW_CURRENT`; fixture `row_current` |
| Striking distance (round 2, replaces the 100 / 30 rule) | Search Console position 8-20 with impressions >= clamp(round(the site's own 28-day impressions / 300), 20, 100): one query must hold 1/300 of the site's impressions, never under 20 (noise), never over 100 (the published bar). The total is `seo_site_metrics.impressions` of the latest period (else the sum of the stored query rows of the newest period); unknown -> 100. techand (8,013) -> 27, devaicon (66) -> 20. The web reads `row.striking`. | `KI_STRIKING` = { min_position 8, max_position 20, impressions_28d 100, floor_impressions_28d 20, site_divisor 300 }, `kiStrikingBar`, `kiIsStriking`, `KI_STRIKING_WORDS`; fixture `striking`; engine `KI.strikingBar` |
| Basis words | `inferred` = "our reading of the results" (no model is called; "AI judgement" is gone). | `KI_BASIS`; fixture `basis_labels`; engine `KI.label`, `KIW.LABELS` |
| Cost rows | Claude 0 for `competitors` and `keyword_research` (the worker calls no model); search data unchanged ($0.35 / $0.90). | `cost.ts` COST_TABLE, `_cost_cal.js` EST |

For FX-A to map (app/server, app/web are theirs): every Record keyed by KiVerdict now needs `unknown`; the verdict component's tone for
`unknown`; gate reason words per code (read `gate_reason` as a code, show `gate_detail` only as the detail); filter keyword / gap reads by
`KI_ROW_CURRENT`; the web striking fallback (`web/src/lib/ki.ts kiStrikingOf`) to `kiIsStriking` with the site total; "Hard for your site
now" copy in guides / marketing (`shared/src/guides.ts`, `web/src/marketing/content/features.ts`, changelog) to "Hard for your website now".

## 2. What was fixed (file pointers are `v5/code/` unless named)

| Review item | Fix |
|---|---|
| B1 services | `_ki.js KI.services`: every item (array or string) goes through one cleaner: a word cut by the 80-character limit is dropped, split at sentence ends / colons / semicolons / short-comma lists, "We provide" / "we also do" / leading "and" / market tails ("in the UAE and GCC") removed, sentences rejected, "X and Y" split (with a shared product: "GP and AX migrations" -> GP migrations, AX migrations; "Dynamics 365 consulting and implementation" keeps its product), parentheses kept as their own term (Peppol, NLP), deduped by key, no cap by position. `_ki_io.js KIW.services` ranks by evidence (declared, Search Console impressions of queries containing it, a page named for it) and caps at 60 after ranking. |
| B2 topic | `_ki.js KI.topicSim`: a domain's topic is its OWN titles / homepage words only (the site name segment of a title dropped); service phrase inside = 1, product / category / standard (Open edX, Dynamics 365, Peppol, PINT, ERP, CRM) = 0.8, else an IDF-free word share where generic words (automation, cloud, AI ...) count half. Topic 0 -> `adjacent`, conf 0.35, never scored; no own text -> `adjacent` needing review, never `direct`. |
| H1 seeds | `KIW.compSeeds`: quotas request 6, Search Console 6, tracked + ladder 4, then service x market (2 phrasings, round robin), products, then the rest of GSC; plausibility (no punctuation, 2-6 words for built phrases, 2-8 for typed searches). |
| H2 Strength | Research Traffic Requests adds one Backlinks bulk referring-domains request (client + every read top-10 host, 7-day cache shared with Competitors; +$0.035 in the plan, still under the $0.90 quote); Research Result joins it to the top 10 and the client; unknown Strength keeps its span (a page in the top 10 / 20 lifts its low end); the verdict is `unknown` (Not judged yet) when the range crosses a verdict line or Win is missing. Go is reachable with measured strength (KI26). |
| H3 lists | `pageType`: a list needs a number, "list of", vs / alternatives, a plural seller or product noun as the head (not followed by a singular seller), a year with a product noun, or a top- / best- list slug; a homepage is never a list without a number. `classifyDomain`: publisher_list needs two list pages or one list of products; one list of providers is read on its topic at review confidence (edly's own "Best Open edX Service Providers" article). |
| H4 AVOID | KI Input accepts `avoid` (keywords, max 200: the app should send its keyword-check / content AVOID verdicts); KI Plan adds content-log rows the check advised against (new load `Load Content Log (KI)`); both go to `fit_ctx.avoid`, gated with code `avoid` before seeds and candidates. |
| H5 brands | `fit_ctx.competitors` = declared + chosen + every stored direct / adjacent competitor not dismissed; after its results page is read a keyword is re-gated with the page's hosts as `serp_domains`. |
| H6 unknown position | `KI.gaps`: missing / untapped only when the client is measured absent (known position > 100, the provider's intersection which excludes the client, or a read page plus a complete Search Console reading); else counted in `summary.gaps_position_unread` (`KI.gapsUnread`). |
| H7 demand | impressions are the demand only at position <= 20; deeper, the larger of them and provider volume (a lower bound note); a measured 0 is 0; the floor is the demand of 5 searches a month (0 to 20 as range), so an unmeasured search never outranks a measured 10; PAA / related / forum = one family. |
| H8 fit | `KI.fit` takes the highest of the shared fit gate, phrase containment (service phrase 1, product / category / standard 0.85) and an IDF share over services + page titles (KI Plan passes 150 page titles in `fit_ctx.pages`); a search the site already has impressions for at position <= 20 is never `low_fit`. |
| H9 stale rows | `Drop Old KI Keywords` / `Drop Old KI Gaps` after Save KI Keywords (site x market, run_id neq this run); the client's gap status carries by keyword key. Rule in `KI_ROW_CURRENT`. |
| LOGIC M1-M5, M7, M9 | Win range = Strength span, no forced +/-0.15 when Win carries its range; small site from `seo_site_metrics` (new load `Load Site Metrics (KI)`) and the `KIW.CAPS` striking copy deleted; competitor share over READ seeds only ("of N read (M not read)"); gap factor top 10 only; identical pages with < 3 keyable results join; declared competitors chosen only up to the max (rest `watch`), a no-longer-declared row returns to the run's status; a stored row seen this run is always rewritten; unscored businesses kept before lists / platforms (20 + 15). |
| LOGIC L1-L8 | key: stop words before letter joining, migration direction kept; CPC 0 = unknown; top10_json keeps exact / url_partial; pageType gets the principal context (Microsoft docs = guide); a buyer cluster's refresh target prefers a service page and flags a blog; plan dedupes refreshes by target and drops target-less refreshes; sample note on intersection rows only; missing Win = unknown. |
| PERF H2 SSRF / size | homepages and sitemaps: no redirect followed by the client, one hop read only after `KIW.hopOf` (https, public host, same registrable domain, no credentials), Range 400 KB, 15 s timeout; `publicHost` refuses wildcard-DNS names (nip.io, sslip.io ...), dotted-IP names, metadata names, credentials; homepages only for hosts seen on a results page, sitemaps only for chosen competitors seen on a results page; linear `KIW.htmlText` replaces the backtracking strip regex. |
| PERF M1 / M4 / M5 | KI Limit: at most 1 open KI run per company and 3 platform-wide (`busy`), 3 runs of one kind per website a day; stale reserved rows count at their estimate in the day's spend. |
| PERF M2 | discovery / overlap cache keys on request + service seeds only (`KIW.seedHash`, no weekly GSC churn); `KI Cache Prune` deletes this site's ki:* rows older than 2x their lifetime or keyed on an old seed set; Site Admin `Delete KI Cache (Admin)` removes kind ki rows of a deleted site. |
| PERF L9 | the r5_shapes / ki_live `offset_token` values replaced by `REDACTED_OFFSET_TOKEN`. |
| CONSISTENCY M2 / M3 / M4 / L10 | section 1; volume_source "DataForSEO Labs" -> "DataForSEO keyword data". |

Skipped, and why: LOGIC M6 (topic / page_type / ai_answer / listing / backlink gaps need page reads of lists and AI answers: W2, or the app hides those types until built); LOGIC L9 (the borderline re-read and the title term of Fit need a second results-page pass: no gain on today's data); PERF M6 (SU.key for partial breadcrumbs in the ladder path changes Off sites: owner decision after Trial); PERF L1, L4, L5 (pre-existing patterns shared with the main workflow); PERF L2 (the shared `Refusal Notice` comes from `ledger_mainline`, used by every monitor: changing it is outside KI's blast radius; the app can drop `rejected` reports of trial runs); PERF H1, M3, L3, L6-L8 and CONSISTENCY H1, M1, M5-M7, L1-L9, L11-L14 are app items (FX-A).

## 3. Replay on the real stored rows (private tool, raw output only in `~/seo-agent-secrets/keyword-intel-2026-11-08/fxl_replay/`)

The generated Code nodes run on the stored production rows of both sites (seo_sites services verbatim, seo_query_history, seo_ladders,
seo_pages, seo_content_log, seo_site_metrics, the app's AVOID verdicts passed as the request's `avoid`). A results page is answered only where
a reading is stored (rank-history snapshots with known hosts, keyword checks); every other provider answer and every homepage is unavailable,
as the worker would see it. The stored-SERP keywords are passed as the request's seeds; the research run is given the top 3 direct
competitors of the competitors run as the client's choice. Base = 407440c0, after = this build.

| | techand.ai before | techand.ai after | devaicon.com before | devaicon.com after |
|---|---|---|---|---|
| services kept | 16 (fragments) | 37 clean | 16, Open edX cut | 32, Open edX kept |
| competitor seeds (fragment seeds) | 7 seed + 13 service (3) | 6 seed + 6 GSC + 8 service (0) | 3 seed + 17 service (3) | 3 seed + 3 GSC + 1 ladder + 13 service (0) |
| direct competitors | 3 (incl. a CRM SaaS vendor) | 11, Dynamics / ERP partners incl. randgroup.com, intwo.cloud, visionet.com | 7, incl. openedx.org (the principal) and marketing / AI sites found only by the seed's words | 3: edly.io, edunext.co, raccoongang.com; openedx.org principal; no travel / home-automation site direct |
| verdicts of scored rows | go 2, months 69, hard 23 | go 2, months 37, hard 10, not judged 43 (Strength not readable offline) | hard 20 | hard 18, not judged 2 |
| gate | crm for customers passed (fit 0.45); peppol access point provider uae low_fit 0.25; intwo / velosio brand searches passed | crm for customers `avoid`; peppol access point provider uae passes 0.85; pint ae validation rules 0.765; erp software uae passes; randgroup / intwo brand searches `other_brand`; what is a crm company `too_broad` | open edx hosting `off_topic`, open edx provider `low_fit` | open edx hosting / provider / managed / development pass (0.9) |
| gaps | 3 striking (the small-site rule read 4,028 instead of the property's 8,013) + 1 weak | none (the striking bar is 100 impressions: techand is not a small site; no measured absence offline) | 1 "missing" from an unread position | none |
| list actions at rival pages | 0 | 0 | 0 | 0 |
| keyword both missing and strong | 0 | 0 | 0 | 0 |

The top of techand's ranking is unchanged in substance: dynamics ax dubai, peppol pint uae, Dynamics 365 cloud migration, F&O implementation
lead; "what is a crm company" is gated too broad. Limits of the replay: only ~8 stored results pages per site, no Labs, Backlinks or AI answers
are stored, so nothing is scored as a competitor (2 seeds seen are needed once 3+ are read) and Strength stays unknown; the one live Trial run
per site (DESIGN section 8) is still the real test.

## 4. Harness and checks

- New public-safe cases: `scenarios_ki.js` KI20 (H6, L7), KI23 (three negative competitor cases; business cases now carry the public titles
  of their stored results), KI26 (16 checks: the stored fragment lists verbatim, 30 services with Open edX at #21, a competitor with no title,
  "Best ERP Company in Dubai" provider homepages, page-5 impressions, unknown verdicts and a reachable Go, keys, seeds, redirect hops, wildcard
  DNS, the linear page reader); `scenarios_ki_e2.js` KIE2-13 (cache delete) and KIE2-14 (the worker on the stored services verbatim, the
  free reads' options, the supersede wiring). Updated expectations: KIW0-1 (gate_detail), KIW0-8 (no Claude row, five verdicts), KI2, KI4,
  KI12, KI14, KI22, KIE2-8.
- Accuracy hold-outs: domains 33/33 (100%, was 97.0%), stage 27/28, intent 26/28 (unchanged).
- `python3 build_v4.py`: exit 0; a second build byte-identical (workflows, harness/code_v4, harness/*.json).
- Full harness (throwaway n8nio/n8n:2.41.4, n8n/seo-agent without docs + app/shared): **18296 passed, 0 failed**.
- App shared (node:22-bookworm-slim): **1145 passed** (72 files), `tsc` clean.

## 5. Deploy notes (when the owner deploys)

`sync_tables.py` before the import (new column `seo_ki_keywords.gate_detail`). The worker gains 13 nodes (two loads, two hop code nodes with
their IFs and GETs, two supersede deletes, the cache prune code / IF / delete). Site Admin gains `Delete KI Cache (Admin)`. Off sites: no change outside KI and the
Site Admin delete chain.

## 6. Round 2 (after the re-reviews of 3a990e62; ki/integration merged first)

| Re-review item | Fix |
|---|---|
| LOGIC N2 (High) exact-match rivals gate money searches | `KI.brandDomains`: a rival's label is a brand only when it cannot be cut entirely into service / product / category / generic / place words (a small dynamic-programming split over the site's service words + a generic list). softwarecompany.ae, crmsoftware.ae, businesscentral.ae, peppol-uae.com are not brands; velosio, randgroup, intwo, dynamicssquare are. Used for `fit_ctx.competitors` (seeds, candidates, ladder heads) and for the after-read `serp_domains` re-gate. |
| LOGIC N3 = PERF N1 supersede after a failed save | new `KI Supersede Check` + `Supersede Keywords?` / `Supersede Gaps?`: old keyword rows go only when every row of this run was saved with no error item and discovery + results pages were read (a partial run never replaces a fuller one); old gaps only when this run's gap section is `ok`, and the delete is `status = open` only, so a started / dismissed / done gap survives (its status is also carried to a regenerated row by keyword). |
| LOGIC N4 unknown Strength still Hard | `strength_unknown_spread` 0.5 (Strength 0..1 when unknown): such rows are `unknown` (Not judged yet) unless both ends agree. |
| LOGIC L4 documentation pages | a maker's documentation (title "documentation / docs / knowledge base", or learn. / docs. / support. / help. hosts) is a `guide`. |
| Consistency: plan weight of `unknown` | `plan.verdict_mult.unknown` 0.5 (explicit: above Hard, below Takes a few months). |
| PERF N2 the 400 KB cap was only a Range request | the four free GETs now write the answer to a binary file (`responseFormat: file`, on disk, not in the process) and a `Comp Home Text` / `Comp Home Hop Text` / `Comp Sitemap Text` / `Comp Sitemap Hop Text` node reads it: known size over 2 MB or unknown size -> never read; up to 2 MB -> read and cut at 400 KB. Proven in KIE2-14 (small page read, 600 KB cut at 400,000, 3 GB and unknown size refused, redirect headers kept). Residual: the GET still writes the whole answer to disk within the 15 s idle timeout. |
| Striking bar | site-relative rule (section 1). On the stored data techand now has 5 striking rows: dynamics ax dubai (43, #8.4), microsoft dynamics ax dubai (32, #14.7), microsoft dynamics ax abu dhabi (27, #13.6), pdf vs e-invoice uae (38, #19.6, the Peppol cluster), microsoft erp system for marine infrastructure (57, #19.4). Left out: 22-impression and smaller rows (finance migration 22, power platform 20), and Saudi queries (other market). The cloud-migration rows R3 names are already at #2.9 / #5.5 (page one, not striking). devaicon (66 impressions in all): none. |
| LOGIC Lows | GSC seeds need >= 3 impressions; a one-word service seed only when it names a product (no "nav uae", "nlp uae", "crm uae"); the content-log AVOID match reads only the engine's "keyword check advised against" wording, never free text. |

Not changed: LOGIC N1 and consistency N1 / N2 (the app's avoid list must send explicit AVOID verdicts only; API v1 `get_table` column allow-list and current-row rule) are FX-A's. Remaining Lows: `focussoftnet.com` title segmenting, `keepRows` growth bounded by the two-miss drop, PERF N3 (a crashed run holds its concurrency slot until `run_stale_hours`).

Replay on the stored rows with the corrected app behaviour (the `avoid` list = explicit AVOID verdicts only: techand `crm for customers`, devaicon `privacy policy`):
- techand.ai: 11 direct competitors (Dynamics / ERP partners), `crm for customers` gated `avoid`, randgroup / intwo searches `other_brand`; verdicts go 2, months 1, not judged 89 (no Strength offline); 5 striking gaps.
- devaicon.com: direct edly.io, edunext.co, raccoongang.com; `open edx provider` / `hosting` / `development company` pass (fit 0.9, no longer gated by the old fit-0 checks); verdicts not judged 23; no striking (66 impressions in all).

Checks: build exit 0, second build byte-identical; full harness **18312 passed, 0 failed**; app shared **1145 passed**, `tsc` clean for shared and web (`KI_STRIKING_WORDS` follows the new rule; the server typecheck reports only missing modules of the borrowed node_modules: `pdf-lib`, a Fastify type).

## 7. Competitor classification on real Trial results (2026-11-10)

The first good Trial competitor runs (production executions 11726 techand.ai, 11727 devaicon.com) classified about half of the `direct` rows
wrong and stored ~20 evidence-less `adjacent` rows per site. Fixes (`_ki.js classifyDomain` / `pageType`, `KI_Comp_Result.js`):

- **Classes from the evidence we hold, beyond the fixed host lists.** The host's own name first: job / career / recruit / staff / talent /
  trabajo / empleo ... -> `job_board`; university / college / academy / institute / school or an `.ac.` / `.edu` address -> **new class
  `education`** (training providers, schools, universities; never scored; `KI_CLASS_IDS` / `KI_CLASSES` "Training or education" in
  `app/shared/src/ki.ts`); yellow pages / directory / listing / agencies / companies / suppliers -> `directory`; news / update / times /
  magazine / blog -> `media`. Then the titles of its results: half or more job listings -> `job_board`, courses / training / certification
  -> `education`, two or more news / update / "released" titles -> `media`. about.me and link-in-bio hosts -> `platform`.
- **`direct` needs provider evidence**: a service or product page of its own among its results, or a homepage that names the client's
  services. A business on topic seen only through articles, guides or lists is `adjacent` (a close competitor to confirm).
- **Lists**: a title whose first part names plural sellers as its head ("AI Companies UAE", "Distributors And Suppliers In Sharjah") is a
  list (not on a directory's own category pages); a comparison ("X vs Y") is an article, never a reason to call a site a list publisher; a
  result whose address is a Google redirect has an unknown path, not a homepage (it was typed "provider" by default).
- **No evidence-less rows**: a business never seen on a results page read and with no title or page of its own (an overlap list or an AI
  citation alone) is not stored; such a row stored before leaves on the next run.

Labelled set (`harness/accuracy/ki_domains.json`): +23 Trial hosts with the titles their results showed (public domains, page titles only),
6 earlier labels changed to the rule (direct -> adjacent where only articles were seen: randgroup, velosio, dynatechconsultancy, synoptek,
visionet; edly / raccoongang carry the Trial titles; uae-asp.ae and deloitte.com direct). **Train 87/87 (100%), hold-out 39/39 (100%)**
(stage 27/28, intent 26/28 unchanged). Where I differ from the brief: concettolabs.com is `direct` (its result is "Power Platform Consulting
Company in Dubai", a service techand sells), aiu.ae is `publisher_list` (its two results are "AI Companies UAE" lists; nothing in the
evidence says university).

Replay of the real runs (stored upstream outputs, the fixed classification and result nodes re-run, private tool `trial_tools/rexec.js`):

| | techand.ai Trial | after | devaicon.com Trial | after |
|---|---|---|---|---|
| rows | 79 | 57 | 81 | 56 |
| direct | 31 | 23 | 29 | 25 |
| adjacent | 20 (+ seen 0/20) | 5 | 23 | 2 |
| job_board / education / media / directory | 7 / 0 / 2 / 3 | 6 / 5 / 2 / 3 | 2 / 0 / 1 / 9 | 2 / 0 / 1 / 9 |
| evidence-less adjacent rows | 20 | 0 | 19 | 0 |

michaelpage.ae, talentmate.com, staffconnect.ae, jobrapido.com, trabajo.org -> `job_board`; vatupdate.com -> `media`; thehubofknowledge.com,
edoxi.com, nobleprog.ae, lumifywork.com -> `education`; yellowpages-uae.com, digitalagencies.ae -> `directory`; intwo.cloud, edly.io,
drcsystems.com, bluechipgulf.ae, competenza.ae, emtech.ae, raccoongang.com stay `direct`; qeemahcloud.com, hlbhamt.com, visionet.com,
gostride.ventures -> `adjacent`.

## 8. Keyword research Trial bugs (production executions 11730 techand.ai, 11731 devaicon.com, 2026-11-08)

**Root cause (one, everywhere): the IF-branch read.** n8n resolves `$('IF').all()` without a branch index to the IF output that leads to the
reading node (walking upstream); every KI node that both hangs on its IF's false output and reads the IF's requests through a helper
(`all(n) => $(n).all()`) read the EMPTY false branch. Section 182 (d84466c4) only catches literal reads, so it fixed Comp SERP Picture only.
On the real executions the answers were all there and fine (no wrong field name, no 40501: 10 autocomplete + Labs ideas / suggestions /
related answered 20000; 47 + 5 retried results pages answered; overview / intent / Ads answered), but:
- Research Candidates read 0 requests -> discovery "the keyword lists could not be read" (794 / 572 rows billed and dropped);
- Research Picture -> volume `ok` with 0 rows (every volume null); Research SERP Picture -> 56 / 51 of 60 results pages "not read" and the
  Ads volumes dropped; Research Result -> traffic potential and referring domains dropped; so no clusters (every row a head), mostly unknown
  verdicts. About $0.42 / $0.38 of DataForSEO was billed for answers nothing read.
- The competitors run had the same defect in Comp Candidates (Labs overlap / sizes / referring domains) and Comp Result (homepages,
  profiles, sitemaps).

Fixes: every KI helper reads `.all(0)`; `build_ki.py` refuses a KI node that names an IF and reads through a helper (or the IF itself) without
a branch index; the harness now resolves branches the way n8n does (`harness.js setWiring`: walk upstream, the first connection from the IF
decides; the false branch is empty), which made KIE2 fail exactly as production did (10 checks) before the fix. KIE2-15 replays the REAL
envelopes of execution 11731 (trimmed, no headers or keys: `harness/fixtures/ki_trial/devaicon_research_2026-11-08.json`): discovery ok
with autocomplete and Labs rows, both live results pages read.

Also: Strength for a search whose own page was not read (all but the top 60) is read against the median referring domains of the results
pages read in the market (+/- 0.2), instead of "not judged"; the career gate refuses any search with a job / career / pay / course word
unless the site sells recruitment or training ("software development company sharjah careers" passed; "... jobs" was gated as navigational).

Replay of the real research runs with the fixes: techand discovery 794 rows, volumes (overview 47 + Ads 159), 55 of the replayed top 60
results pages read, referring domains 23, verdicts go 2 / months 14 / hard 263 / not judged 21 (techand has 24 referring domains against a
market median of 968), 5 striking; devaicon discovery 572, Ads 68, referring domains 66, hard 255 / not judged 45. (The replay re-ranks the
top 60 with the discovery rows production never read, so some of its top 60 were not bought on production: the fixed run buys its own.)

Checks: build exit 0, second build byte-identical; full harness **18318 passed, 0 failed**; app shared **1145 passed**, shared and web `tsc`
clean. No paid call was made; production was read only (executions over the tunnel, through the API key, nothing printed).
