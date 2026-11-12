# Client reports 2026-11-11 (devaicon.com, techand.ai, production)

Seven reports (`Alaventra issues.docx`), the day after the 2026-11-10 fixes. Each was investigated on production data first (read-only;
one paid ranking measurement of $0.32 and one live finalize test of $0.01 were run with the owner's approval). Findings files of the
investigators are kept in the session scratchpad (N2, N45, N6, N7); this README is the record.

## Verdicts

| # | Report | Verdict | What we found |
|---|---|---|---|
| 1 | Published pages still show the old score; the page check does not grade the live page | **Right** | Yesterday's fix only labelled our grade "version we delivered". Nothing graded the page actually live. The address part is resolved: all four re-checks of 11-11 were verified and their notes cleared. |
| 2 | Ladder keyword "not in top 50" but on Google's first page as a blog post | **Wrong for a neutral search** | 24 paid readings (Pakistan, Lahore, Multan; computer and phone; google.com.pk and gl=PK; live and queue; depth 100): the blog post ranks #59-#71 on a computer and #33-#61 on a phone; the main keyword is not in the top ~100 anywhere, nor in any SERP block. Search Console's 10 impressions at #4.7 come from anonymised searches (likely the client's own, personalised). The tracker missed nothing. The app gave the client no way to see this. |
| 3 | "Same search" verdict after AI visibility said write a guide; answering never moves the score | **Fixed yesterday, not yet re-made** | The screenshot is the final version of 10 Nov (before the fix). Live test today with the same request on production: 59 "Not ready" -> **83 "needs work"**, duplicate resolved (other market), the unsupported claim rewritten, the rest advice ($0.01). A final version made before the fix could not be re-made ("Nothing changed"). |
| 4 | Bing Webmaster connected but "Missing"; spam score 56 "High" with spam links | **Right (Bing), number real but "High" wrong** | Bing is read with our one key, whose account lists techand.ai only; our guide told clients to add the site to their own account and said it would be picked up, which is false; "check now" answered 409. The 56 is DataForSEO's score of the linking pages (devaicon's own is 0); those pages are automatic report pages and farms Google ignores. |
| 5 | 1,288 links, "not checked": spam, referral, real? | **Right to be confused** | 774 automatic report pages (bottraffic.site, sitereport.space, scamadviser ...), 506 farms, 5 listings, 1 real link, 3 unknown. Page-less rows from the referring-domains list were valued 50-52 on defaults, so 775 were "Best"; "Lost 220" was 0 real links; "Not checked yet" for rows nobody can open. |
| 6 | Asked Google to index nearly every page; still a High issue, not re-checked since 28 Oct | **Partly right** | Indexing is read daily (14 runs since 29 Oct), but the Technical page showed the 28 Oct audit as it was. Of the audit's 15 pages, 8 are in Google now, 3 are out on purpose (cookies, privacy, a moved page), 4 are still unknown to Google and were never offered for "Ask Google". The next automatic audit is 27 Nov (monthly cycle). |
| 7 | techand: the pipeline avoids the ladder keywords it chose, repeats content with the same score, errors each run | **Partly right** | The ladder plan and the page verdict use different tests (the client's head "crm service provider" had 10 searches a month and a generic pool). 3 of 4 "duplicates" are a page and its final version (copied score, unlabelled). The 4th: "Write it anyway" on an AVOID hold could never write (engine router ignored the acknowledgement) and charged 6.27 credits for nothing. One cadence run on 11-05 crashed silently; the weekly backlinks watch never settled its cost row. |

## Engine (deployed with this record)

- **185** the Page Finalize grades the LIVE page (`grade_only` + `grade_live`): the page reader reads it (with the W07-A fallback and alert),
  the hero H1 is restored, the editor is never called, a failed read is refused. Ledger lint: the read is exempt only in this no_gate workflow.
- **186** "Write it anyway" passes an AVOID (`verdict_acknowledged`); the backlinks watch settles on quiet weeks.
- **187** the audit's indexing finding: policy / utility and redirected pages are named, not counted; unit "pages inspected in Search
  Console"; the whole list on the finding row.
- **188** backlinks: `LK.isAutoReport` labels automatic report pages (value capped 5); farms and those never Best / at risk / lost / fetched;
  page-less rows valued below average.

## App (deployed with this record)

Live page grade on the content card (job, migration 0026 `page_reviews.live_grade` / `live_graded_at`, free, 3 per 10 minutes); the
Technical page's indexing finding follows the daily index check; Backlinks "What your links are" (five kinds), spam score explained,
"Check Bing now" (`POST .../backlinks/bing/check`, `BING_SHARE_EMAIL`), corrected Bing guide; ladder "What Google showed" with the top 10
and "Open this search on Google"; "Write it anyway" on a ladder page sends the ladder; final versions made before 2026-11-10 19:30 UTC
with a review / duplicate blocker can be re-made once for free; final versions labelled in the Content table; the Bing site-task check
asks Bing.

## Owner items

- Set `BING_SHARE_EMAIL` (the Microsoft account that owns the production Bing key) and confirm which account it is; accept access requests.
- Refund 6.27 credits to Techand Systems (ledger seq 359, run 8f0a4bc3: the "Write it anyway" that could not write); optional goodwill
  68.75 credits (seq 103, execution 3751, the second rewrite of one page in one cadence run on 10-29).
- Decide: warn or refuse a typed ladder head with 10 or fewer searches; screen rung candidates with the buyer-fit model (KI, 10cb6f5e).
- Optional data repair (backlinks): label the 774 automatic rows and clear 217 farm rows at risk now instead of at the next full run.
- Client notes: their ladder keyword is not on page one in a neutral search (what they see is personalised); four old pages are still
  unknown to Google and can be asked through Search Console's URL inspection; the paired Content rows are a page and its final version.

## Open (not built today)

- The Indexing area does not yet offer the four never-asked pages for "Ask Google" by itself (at most 5 a week).
- The Rank Tracker reads depth 50 on a computer only: phone positions, depth 100 for pages last read at 0, the normal-priority queue
  for exact addresses, and SERP features as places (N2 E1-E5); queue latency was 14-20 minutes today, not the 86-118 s in QUEUE.md (tell KI).
- A cadence page run that crashes is closed by the watcher after days but never re-queued (owner decision).
- Backlinks: drop rows DataForSEO no longer reports on a complete full run (headline stays 1,288 until ~Feb 2027); source shares from
  the stored sources; store DataForSEO's own target spam score (N45 E4 E5 E7).
