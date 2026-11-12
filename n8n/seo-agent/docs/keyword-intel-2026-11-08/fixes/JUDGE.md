# KI-JUDGE: Claude Opus 5.5 judges who is searching (2026-11-12, owner chose Opus 5.5)

## Why
The word rules (KI-GATE2) reached 78.5% precision on the 800 labelled Trial searches but only 58% on 196 searches they were never tuned on;
the results page's shape alone added 1-2 points. A model reading each search with its top 5 results, measured offline on the same sets
(GATE2.md, last section): **89.9% right on the unseen searches, 93.9% of the right ones kept** (Opus 5.5; Haiku 5.5 83.2% / 95.6%).

## What changed
- **Soft and hard stops** (`_ki.js` KI.gate): a word rule about who is searching (job / course / exam wording, documentation, a packaged
  product the site does not sell, too broad, low fit, an event, a company searched by name) is a *soft* opinion; another market or
  language, AVOID, own brand, government, portal, navigational, another company's brand, and job / salary words are *final*.
- **Research Candidates** keeps soft-stopped searches (`soft_gate` carries the rule's opinion), so they are enriched and their results
  pages read; final stops are never enriched, read or judged.
- **Every kept search's results page** is read through the queue (`CAPS.top_m` 60 -> 300, $0.0006 a page; estimate: queue price + 30 live).
- **The judge** (`Research Judge Requests` -> `Any Research Judge?` -> `Run Research Judge` -> `Research Judge Retry Plan` ->
  `Any Research Judge Retries?` -> `Wait Before Judge Retry` 20 s -> `Run Research Judge (Retry)` -> `Research Judge Picture`), between the
  results pages and the traffic step: one Messages call per 40 searches (`claude-opus-5-5`, effort low, structured JSON output limited to
  seven labels, server-side refusal fallback `fallbacks: "default"` with beta `server-side-fallback-2026-07-01`), six at a time, through the
  engine's credential `SEOcredAnthropic`. No node-level retry (a re-sent call is billed again): the plan re-sends only calls with no usable
  answer, once; a refusal is not retried. The site is described only by stored data (domain, market, its services, 600 characters of its
  business facts); the brief tells the model the searches and titles are data to classify, and the answer is a closed set of labels.
- **Research Result**: the judge decides every search it labelled (pass keeps it; job -> career, practitioner, other_market, off_topic,
  other_brand, not_a_search stop it, the detail says it was read from the search and its top results), except a search a final rule stopped
  after its results page was read; a search it could not label keeps the soft opinion. New gate reason `not_a_search` (app words added).
- **Money**: `KIW.judgeCost` prices each answer's own token counts at Opus 5.5 list prices ($4 / $20 per million, cache read $0.20); the
  run row's `cost_claude_usd` and the ledger settle's Claude figure carry it as measured. Estimates: `_cost_cal.js` EST and
  `LEDGER_EST` keyword_research ai 0.45, app `cost.ts` ai 0.45 (a keyword research run for an On client now quotes Claude too).
- **Switch**: `seo_cache` `ki:kill` = `judge` turns only the judge off (every website); `1` still stops keyword intelligence.
- Section `judge` (ok / partial / missing / skipped) says how many searches were judged and why the rest were not.

## Tests
KIJ-1..9 (scenarios_ki_e2.js): wiring and headers, the request body, final stops never judged, the judge overruling the words both ways,
one retry of failed calls only, a refusal, measured money on the row and the ledger, the switch, strict answer reading. KIE2-8 updated (a
soft stop is read and judged, and says so). The fake judge mirrors the word rules by default so the older scenarios keep their meaning.
Harness 19143 / 0; app shared 1226, server 2097, web 374, typecheck clean.

## Live check (next)
Trial re-run on both sites: the judge's section ok, every kept search judged, cost about $0.30-0.45 a run; then an independent label of
what passed (the honest measure).
