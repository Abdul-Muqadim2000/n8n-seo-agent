# Client report 2026-11-17 (devaicon.com, production)

One document from devaicon.com ("Alaventra Platform Diagnosis Issues" + four questions): 5 critical claims (C1-C5), 2 major (M1-M2), 10
functional defects (F1-F10) and 4 questions (Q1-Q4). The client said its diagnoses "might be wrong", so every claim was first verified on
production (read-only snapshot of both databases, 2026-11-17 ~14:00 UTC, plus execution payloads and the public pages; no paid call).
Investigation files, handoffs, repair scripts and the integration record are private (client data):
`~/seo-agent-secrets/client-reports-2026-11-17/` (REPORT, BRIEF, INV_1..INV_7, PLAN, BUILD_RULES, HANDOFF_A..I, INTEGRATION, tools/).
Built by nine package agents in worktrees (A site, B account, C index, D watch, E links, F competitors, G ladder, H recommendations,
I credits), merged on `fix/cr17-integration` in the order B A C D G F E H I, then one integration pass (the seams between packages, one
combined app migration, marketing, docs, full tests). **Not deployed** (deploy steps at the end).

## Verdicts

| Claim | Verdict | One line |
|---|---|---|
| C1 legal drafts | **Right** (+ gaps: no terms acceptance, no self-delete, ~50 engine tables never purged on delete) | payments are manual invoices, not cards |
| C2 client-side shell | **Right** (llms.txt was a soft-404 200, not a 404) | prerender with React Router's own data-mode tools |
| C3 health ignores indexing | **Right** (the score is crawl-only; 20 of 47 in Google) | label it "Technical health" + a "Pages in Google" figure |
| C4 link building | **Right, worse** (0 won by outreach; bebee / github "won" by a domain match; 14 of 20 targets the homepage) | won gate, quality gate, real link text, deep target, one status |
| C5 competitors | **Partly** (LinkedIn / Clutch / edX came from the Link Builder's left-out wording, not keyword research; Open edX is a real service; KI drift was to generic software development) | one role classifier, one competitor list |
| M1 trust | **Partly** (the headers ARE sent; no MX for alaventra.com; the status host fails TLS) | dated facts, HSTS, security.txt |
| M2 credit economics | **Right numbers**, forecast ~3x too high; 118 + 143 credits of our own KI Trial runs still charged | ledger-based forecast, cost per outcome, top-up request |
| F1 raw template text | **Right** (both clients) | plain lever sentences + a shared client-copy guard |
| F2 index step on a 301 address | **Right** (an AI-ranking L04 step, not Index coverage) | AI ranking follows moves |
| F3 add 301s to the sitemap | **Right** (general) | a fresh redirect beats an older "indexed" reading |
| F4 root-level planned addresses | **Right** (both sites) | `LRU.folderFor` |
| F5 Page Watch noise | **Right** (robots: a 404 page hashed as rules; 301s we asked for raised High; nothing ever resolved) | severity by what Google does + an alert lifecycle |
| F6 indexing numbers | **Right** (a -1 marker shown, a stale audit basis, Google's all-address count unlabelled) | one population, named |
| F7 credits 1,002 vs 1,028 | **Partly** (same data; a count-up animation caught mid-way) | one usage function, no animated money |
| F8 keywords 0 vs 7 | **Right** (an empty save kept the old list in the app and cleared it in the engine) | one tracked-keyword definition, empty clears |
| F9 pitch counts | **Right** (general: three populations) | `link-status.ts` |
| F10 page-keyword mapping | **Partly** (half fixed on 11-16; rows still on 301 addresses) | rows follow permanent redirects |
| Q1 not indexed | **Partly** (asking works: 9 of 10 in within a day; recommendations never close, no resolved state) | Index coverage owns indexing asks; validation; resolved list |
| Q2 questions inside service pages | **Right** (the contradiction is ours) | one decision per question; "Questions this page answers" |
| Q3 AI visibility vs the write form | **Right** (a stale weekly target beat the live page) | one resolver, re-settled on publish |
| Q4 recommendations not resolvable | **Right** | recommendation states + a rule per family + one card per issue |

## Engine (built, not deployed)

- **193 (C index: F2, F3, F6, Q1, C3)**: `_index_kit.js` freshness guard (a permanent redirect our read saw after Google's last crawl
  makes the address `redirect`; 404 / noindex over a non-soft reading needs two reads >= 20 h apart; a 302 / 307 is never a move);
  "indexed, not in the sitemap" only on our own direct 200 read; redirected addresses leave the sitemap advice; ask-Google prefers the
  pages old addresses now redirect to; `summarize` carries the app's population (`should_be` / `in_google`). AI ranking (`_ai_rank_diag.js`,
  `_ai_rank_learn.js` L04 verify) follows a move one hop and refuses an index step on a moved or left-out address. Build Site Issues:
  Google's-view findings are listed but not scored ("Technical health" counts what our crawl can verify).
- **194 (D watch: F5, F6 alerts, F10)**: `_page_watch.js` robots.txt state machine (ok / missing / unreachable / html / unresolved /
  not_read, parsed rules, the fingerprint of the rules not the bytes), redirect verdict by where it lands (a 301 to a good page of the site
  is an Info "page moved", "the redirect your Steps on your website asked for" when it is), one open alert per condition that is seen
  again, resolved with its reason, or marked seen; new `_moves.js` (a move confirmed on two reads follows into the ladder, the content
  log, AI targets and AI readiness rows, refused when the new address is another search's page); the Rank Tracker and the publish check
  know a moved or capital-letter address.
- **195 (E links: C4, F9)**: one won rule `LK.wonCheck` (we wrote to them AND our own reading found the link on a clean page; job boards,
  profiles, code hosts, farms, scrapers, search pages, noindex are junk); Link Builder qualification with job listings, low authority,
  spam score and a 40% topic floor against the site's topics and services; `pickTarget` aims at the service page that sells their topic,
  holds the pitch when no page of ours fits (never the homepage); real link text (`anchor_text`); stored rows re-judged every run and one
  verdict per website (`reason_code`, `OK.DOMAIN_CODES`); the signer is a person or `[Your name]`; Earned Media's "names you" is no longer
  a won link.
- **196 (F competitors: C5)**: `CMP.role` (competitor, listing, also_ranks, authority, software, your_platform, not_competitor) used by
  the Link Builder (`OK.competitorCheck`), AI visibility (entity rule c17f: a new baseline), AI Growth, backlinks and the pulse;
  `CMP.oneList` = the declared competitors + the client's KI choices - "not a competitor"; keyword research picks balanced across the
  site's services (`KI.balance`); Site Admin accepts `not_competitor` for any domain; prospects from retired AI questions get `retired_at`.
- **197 (G ladder: F4, Q2, Q3)**: `LRU.folderFor` (where the client published our pages of that kind, then the live inventory; >= 3
  pages and >= 60%, a service page never in a blog folder) in Ladder Plan, Cadence Plan (+ app mirror) and Content QA; AI targets settle
  when a page that answers them goes live (Publish Check and Detect Published branches, $0); the page package lists the questions it answers.
- **198 (H recommendations: F1)**: every AI-ranking lever has one plain client sentence (`why`), the arithmetic kept apart as
  `score_note`; plain provider errors in research; the index action without an arrow.
- **199 (I credits: F8)**: the weekly site report's "Tracked keywords: N searches we check on Google" (ladder + your list, each once).
- **200 (B account: C1)**: one purge list in `ladder_common.py` (`SITE_PURGE` 50 tables, `SITE_KEEP` 4 with a reason; the build fails on
  an unclassified table); Site Admin's delete purges every table by exact domain / `www.` / site id, only for a domain the caller named.
- **Integration**: `OK.reasonCode` / `linkReasonCode` know the competitor gate's codes (`competitor_list`, `listing`, `your_platform`,
  `software`; `competitor_list` is a website-level verdict); the Link Builder stores `competitorCheck(o).code` where it re-judges a stored
  ready row; retired prospects are skipped in LB Plan, LB Page Requests and LB Assemble, and a new prospect row carries `retired_at: ''`.
- Data Table columns (reach production through `sync_tables.py` at deploy): `seo_console_alerts` condition_key, last_seen_at, count,
  resolved_at, resolution, ack_by, ack_at; `seo_page_watch` moved_to; `seo_link_outreach` anchor_text, reason_code;
  `seo_ai_visibility` software_json; `seo_ki_keywords` service; `seo_link_prospects` retired_at.

## App (built, not deployed)

- **A (C2, M1, C1 facts)**: the public site is prerendered at build time (`react-dom/static`, hydration guarded by an exact-path marker),
  Organization / WebSite / SoftwareApplication JSON-LD, sitemap lastmod, a real `/llms.txt`, real 404s (Vercel `cleanUrls`, app prefixes
  rewritten to `app.html`), HSTS on www / api / hooks, Permissions-Policy on the API, security.txt; new `/subprocessors` and
  `/data-retention`; the Security page's "Where your data lives" and "Not yet", dated.
- **B (C1)**: terms acceptance at sign-up (e-mail and Google; `LEGAL_VERSION` in `@seo/shared`, the legal pages read it), "Delete my
  account" (plan first, refusals, step-up, the person's own companies deleted, the others left), engine history purged on website and
  company delete, legal links in our e-mails.
- **C (F6, Q1, C3)**: `inGooglePopulation` (one population), "Technical health" + "Pages in Google" on the Overview, Technical health and
  Indexing pages; Indexing reasons in five families with what to do now, a validation per page (Search Console's waiting / passed /
  failed), "Resolved recently"; a sitemap step on a moved address closes as "Not needed any more".
- **D (F5, F6)**: `shared/src/alerts.ts` (open / seen / resolved, `openAlertCount`, the check-in -1 marker never a number); Alerts page
  Open / Resolved, "Mark as seen" (`POST .../data/alerts/seen`).
- **E (C4, F9)**: `shared/src/link-status.ts`, one state per pitch and every count from it (Links page, Backlinks, Pipeline,
  Recommendations); "I sent it myself" (manual sequences, follow-up reminders, 25 first e-mails a week a company); the app's "won" is a
  claim until our check finds the link.
- **F (C5)**: `competitor-roles.ts` (generated from CMP), one competitor list in Site settings (up to 5), `PATCH .../competitors/:domain`,
  "Not a competitor" on AI visibility and Rankings, "Software and platforms AI names", keyword research by service.
- **G (Q2, Q3, F4)**: `ai-question-action.ts` page list with moves, `aiAnsweredView` ("Answered by /x, live since ..."), one decision for
  the AI page, the write form and the recommendations; folder-aware planned addresses in the cadence mirror.
- **H (F1, Q4)**: `client-copy.ts` (the client-text guard), `recommendation-rules.ts` (why / how / how we check, per family),
  `recommendation_states` + `recommendationStates.ts` (To do / Waiting for Google / Resolved / Dismissed, synced on read), one card per
  issue, priority from the queue score.
- **I (M2, F7, F8)**: `creditUsage` (one figure everywhere), a forecast from the ledger with two runways and cost per outcome, the
  low-balance warning two weeks ahead, an automatic top-up request (no payment provider, no overdraft), the daily pulse cost attributed
  per website (billing unchanged), tracked keywords defined once and an empty list clears.
- **Integration wiring**: recommendations read `openAlertCount` (D), the link status counts with the new mailbox wording and never offer
  to win back a link from a junk page (`junkLinkSite`, the engine's job-board list held equal by a test) (E), `indexingSupersedesAudit` and
  `healthLabelFor` (C), the AI page's own inputs `aiQuestionInputsOf` (G), `rankings.tracked.total` (I); the recommendation states read
  each package's own check (`recommendationVerifiers.ts`: Index coverage's reason and validation, our own link reading, the link status
  counts, the AI question resolver); the left-out list prints the competitor gate's words by code; retired prospects are never offered;
  the check-in figure uses Index coverage's one wording; the retention facts and the Security page match what B shipped.
- **Migration** `0028_cr17_client_report.sql` (additive only: `recommendation_states`, `users.terms_version` / `terms_accepted_at`,
  `outreach_sequences.manual`, `organizations.auto_top_up_*`, `credit_purchase_requests.auto`).
- Marketing: changelog 4.18, benefit lines on technical audits, index coverage, site tracking, link building, AI visibility,
  competitors, content, reports and enterprise, a credit rule on /pricing. Tutorials backlog rows (video-skills c99484a).

## Checks (integration branch)

See `INTEGRATION.md` (private) for the exact numbers of the final run: engine build exit 0, full harness, app typecheck, shared / server /
web tests, web build with the prerender.

## Data repairs (scripts ready, NOT run; dry run by default, each refuses on drift)

In order, after the engine deploy (the first two need the columns `sync_tables.py` adds):
1. `repair_d.py`: resolves the stale Page Watch alerts (devaicon 2, 3, 4, 8, 13-16; techand 6, 7, 11, 12) with their reason, notes on 9
   ops alerts, moves the ladder / content-log / AI-target rows of the Pakistan service page to its /services/ address, removes 3 AI
   readiness rows of old addresses (techand 1 renamed).
2. `repair_e.py`: 3 wrong "won" prospects (two bebee, one github) and their impact row, 4 outreach rows to their website verdict.
3. `repair_c.py`: the AI-ranking L04 step on the moved /engagement-models (self-heals at the next AI ranking run).
4. `repair_g.py`: ladder row 53 to its /services/ address (`--target37` optional).
5. `repair_f.py`: 24 prospects of retired AI questions (`retired_at`), 6 outreach rows relabelled (listing / your_platform).
6. `repair_i_keywords.py`: devaicon's app keyword list emptied to match the engine (one row).
Owner decisions, not run: `repair_i_refunds.py` (our KI Trial runs: Devaicon 118.47, Techand 143.16; double-charged final versions
9.38 / 7.57) and `repair_b_purge.py` (backfill for already deleted websites: nothing to do on the snapshot).

## Owner decisions (defaults chosen, nothing blocks the deploy)

- Legal: counsel's Privacy / Terms / DPA (then bump `LEGAL_VERSION`); terms for SSO / SCIM / admin-created people (not asked today);
  immediate deletion (no grace period); keep the run ledger after a delete or anonymise it.
- Trust facts: MX for alaventra.com (security@, sales@, support@, partners@ bounce); delete the EU pre-wipe disk snapshots before any
  "data stays in Doha" line (the backups row then can say 21 days); vendor DPA locations; HSTS preload; an `app.` -> `www.` redirect of
  marketing paths; a status page; re-check the trust facts within 120 days (a test fails after that).
- Prices before `offers` JSON-LD; the 2,000 requested / 1,000 granted pack mismatch (a 1,000 pack at $50?); refunds (above); pulse
  billing stays "single site" (`PULSE_BILLING`); no overdraft while a request is pending.
- Link building: 25 first e-mails a week by hand, the footer clients paste, the floors (topic 0.4, authority 40 of 1,000, spam 30, won
  evidence 35 days); ask both clients to set a real person as author (until then pitches are "Needs your edit").
- Competitors: global consultancies classed as competitors; lead services default (declared, else the first two); the Open edX market
  for devaicon; tell devaicon its 5 chosen competitors were not used outside the Competitors page until now.
- Recommendations: "AI names you" and "spammy links" are measures, not to-dos; the dismiss reasons and the 90-day comeback; the 17
  lever sentences; High >= 1.0 / Medium >= 0.35.
- Indexing / watch: the labels ("Technical health", "Pages in Google", "Not needed any more"); whether moved addresses are re-read now and
  then; an optional `seo_content_log.moved_from`.
- Pre-existing: techand.ai's duplicate CRM guide; re-archive ladder `lad_mvpd7x01f657`.

## Deploy (not done; the owner's go-ahead first)

Engine first, then the API, then the web; never on a Monday 07:00-16:00 UTC. The exact commands are in `INTEGRATION.md`:
1. Backup (`deploy/gcp/backup.sh` on the VM).
2. Merge `origin/main` into the branch, rebuild, node-diff production against main (production == main before the deploy).
3. `deploy_engine.py --apply` (sync_tables adds the 12 columns above; Page Watch, Rank Tracker, Site Tracker, Site Admin, Link Builder,
   AI Visibility, Pulse, Pilot, Backlinks, Audit, Growth, KI, Index coverage, Prerelease and the main workflow change).
4. API on the VM: checkout + `up -d --build app` (migration 0028 runs at start); Caddy reload for the hooks host headers.
5. Web: PR to main (Vercel); then the public-site curl checks of HANDOFF_A.
6. Repairs in the order above (dry run, then `--apply`).
