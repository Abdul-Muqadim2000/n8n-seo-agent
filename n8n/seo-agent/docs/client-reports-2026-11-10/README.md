# Client reports 2026-11-10 (devaicon.com, production)

Five reports from the client (`Issues.docx`, with screenshots), each checked on production data before any fix. Production was only read
during the investigation (app Postgres in read-only transactions, n8n Data Tables and executions over the tunnel, curl of the live pages).
Engine: build section 184, harness `scenarios_client_1110.js` (CR1-CR4) plus W0H7b and a KF2 case. App: see the app commit.

## Verdicts

| # | Client said | Verdict | Root cause |
|---|---|---|---|
| 1 | Published pages still show the old score although I fixed the issues myself before publishing; I fixed the address issue but it still shows the old address | **Right** | (a) the card's `grade NN/100` is the grade of the version WE delivered, never of the live page; nothing on the card said so or showed what the live check measured. (b) every old address now answers 301 to its `/services/` address (curl 2026-11-10), but the publish check never read the old address, so "Re-check page" (run twice for bfsi on 11-10, 09:55 and 10:01) kept answering "sent at another address than the page it updates" and the note stayed. |
| 2 | Ladder "ai automation services pakistan": both keywords "not in the top 50", but Google shows the first on page one | **Our reading is correct, the app hid the rest** | Rank Tracker read google.com.pk (location 2586), desktop, depth 50 on 11-08: devaicon.com is in none of the 50 results (all traced through the goto breadcrumb). A signed-in local search is personalised. But the ladder page summed only query-level Search Console rows (anonymised for tiny keywords: "0 times shown") and ignored the page-level rows (10 impressions at #4.7, 1 at #10), counted a reading taken before the page was live, and never said how we check. Full notes: investigator I2. |
| 3 | I approved the weekly item but it still says it waits, with a past date | **Right** | The card is the frozen plan of the 11-06 run, still titled "Coming up" on 11-10; approved items sat under "Waits for your OK" with a tick although nothing was written; the pile-up banner was plan-time (false when the run started). The approved AI refresh "ai industrial automation pakistan" was **never written**: its question was retired from the panel at 01:03 (asked in PK-en, the site's market is AE-en), AI Growth then marked the target skipped with the false reason "no longer lost", and the cadence dropped the approval without a word (`approved_not_written` was empty). |
| 4 | Re-check page still does not load the right address | **Right** | Same as 1(b). |
| 5 | The AI section said "publish as a guide", the page then said it is the same as my published page; answering the questions never updates the score, on all page types | **Right on both** | (a) the AI growth plan chose a new answer page for "Which companies offer the best AI automation services for businesses in Dubai?"; the check before writing skips duplicates for AI pages, the check after writing held it as a hard blocker; and the duplicate rule drops words under 3 letters, so "ai automation services" (UAE) matched "AI Automation Services in Pakistan" on "automation services" alone. (b) 6 of the last 9 pages were held at 59 by second-read findings and every final version kept 59: a high "claim" finding blocked whatever it said (3 of the 8 real findings were true sentences flagged for something missing elsewhere), and finalize never touched the flagged sentence (known since 2026-11-03, never fixed). |

## Engine fixes (section 184)

- **A. The move behind a 301.** *Updated Address Plan* -> *Has Updated Address?* -> *Fetch Updated Address* (no redirect follow) -> *Publish Check*.
  `verifyPublished` accepts an update published at a new address when the old address answers 301 / 308 to it (absolute or relative
  Location); 302, a redirect elsewhere or an unread address keep the old answer. A verified re-check clears `publish_note` (existing rule).
  A home page is never "the page it updates" for a move: a home-page update published at its own address is judged and recorded as a page
  of its own. Title, heading, description and text are read with HTML entities decoded (`&amp;` failed "Title tag uses the keyword").
- **B. Duplicates by market.** `DUP.targets(..., { market })`: a page whose title / heading / address names only places outside the run's
  market, for a keyword naming none, goes to `other_market` (advice: link the two), never a target. The gazetteer is the fit gate's own
  `FIT_PLACES_SRC`, injected by `kit_src.py` (one table). Parse Verdict and Originality Check pass the market; Originality Check treats a
  duplicate of an AI answer page as advice (as Parse Verdict already did); Finalize Verdict re-judges a carried duplicate by market.
- **C. Second-read claims.** A high "claim" finding blocks only when its words say the statement is unsupported by what is on file
  (`RR.unsupported`: explicit words, or a sentence naming the facts on file with a limit). On the eight real findings: the five unsupported
  ones block, the three "something missing elsewhere" ones are advice; the W05-A acceptance set is unchanged (K3, K5, K8 block). Finalize
  re-judges carried findings (`RR.textError`: non-errors become advice, shown, no 59) and gives the editor a task per finding that still
  blocks and is still on the page: rewrite the sentence to what the facts support, or remove it (never a sentence the client wrote). It stays
  open while its words are on the page, so a refused edit changes nothing.
- **D. Approvals never vanish.** Cadence Plan reports an approval whose item is no longer offered (and not skipped) as
  `approved_not_written` reason `no_longer_offered` with a plain detail; Cadence Note forwards `approved_not_written` in the callback;
  Growth Plan stores "the question was taken off your AI panel: <retire reason>" instead of "no longer lost" for a retired question.
  Open (not changed, golden-pinned): a target absent from the gap list while still named in 0 answers is still stored "no longer lost".

## Checks

Build exit 0 (main workflow 838 nodes). Harness **18581 passed, 0 failed** (run in a throwaway `n8nio/n8n:2.41.4` with `app/` mounted at
`/app`; the KI scenarios read it).

## Deployed 2026-11-10 (Tuesday, ~19:25-19:36 UTC)

- Backup `gs://alaventra-prod-backups/pg/2026-11-10/{app,n8n}-2026-11-10T192434Z.dump`.
- Before: production node-diffed against the build = only this commit's nodes (plus the alert-webhook placeholder the deploy substitutes).
- Engine: `deploy_engine.py --no-build --apply` (guard ok, no new column, 14 updated, 29 published); after: prod == build (0 unexpected).
- API on the VM: 4d4a3c69 -> 28f8de07, `up -d --build app`, healthy, 0 restarts; rollback image `alaventra-app:rollback-4d4a3c69`.
- Web: PR #64 to main (the owner merges; Vercel deploys).
- Not done: clearing the four stale publish notes directly in `seo_content_log` was refused by the permission classifier. Not needed:
  the client's "Re-check page" now verifies these pages and clears the note, and the app shows "Moved: ... redirects here" after the
  next daily redirect check.
- App checks: typecheck clean, shared 1174, server 2070 (46 skipped), web 359, web build OK. Tutorials backlog row added (video-skills 12a1d5f).

## Deploy and repair (plan, kept for the record)

1. Merge origin/main, node-diff production against the build (feedback-engine-deploy-check-prod-first), backup, then
   `deploy/gcp/deploy_engine.py --no-build --apply` over the tunnel; API on the VM; web through a PR to main (owner merges).
2. After the engine is live: run the free publish check again for the four moved pages (`/services/engagement-models`,
   `/services/industries-bfsi`, `/services/capabilities-application-software-development`, `/services/capabilities-consulting-transformation`)
   so their notes clear; nothing else is repaired. The approved AI refresh is not re-queued (off-market question, page 2 weeks old).
3. Client notes: the live title of the bfsi page passes now; three moved pages use no content images and one uses another site's
   Open Graph image (infinite.com); the ladder ranking is neutral country-level Google, not their own signed-in search.
