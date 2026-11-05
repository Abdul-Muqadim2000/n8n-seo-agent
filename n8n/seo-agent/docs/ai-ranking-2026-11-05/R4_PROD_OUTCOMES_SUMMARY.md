# R4: Production outcomes of AI visibility and AI Growth (sanitized summary, 2026-11-05)

Read-only review of production for the two live clients: a Microsoft Dynamics / e-invoicing partner in the UAE ("client T",
techand.ai) and a custom AI and software firm with offices in Sharjah and Pakistan ("client D", devaicon.com). The full report with
answer texts, URLs and contacts is private (owner's secrets folder, `ai-ranking-2026-11-05/PROD_OUTCOMES.md`).

Method: n8n public API (GET only) over an IAP tunnel, read-only SQL on the app database, and free public checks (client sites,
RDAP, Brave `site:`, Common Crawl, Wikidata, the pages the AI answers cite). Nothing was written, started or paid for. Bing and
DuckDuckGo refuse scripted queries and Clutch / GoodFirms answer 403, so those were read from Bing Webmaster data or left
unverified.

The programme has run for **11 days**, not since 10-23: the first AI runs were on 2026-10-25. Client T has had 3 weekly AI runs,
client D 2.

## 1. Outcome

| | Client T | Client D |
|---|---|---|
| Non-brand answers read (6 engines, weekly + daily pulse) | 471 | 248 |
| Named in | 8 (1.7%) | 1 (0.4%) |
| Named on "who are the best providers" questions | 1 of 143 | 1 of 108 |
| On the current panel | a few citations of 2 blog posts | **0 of 171** |
| ChatGPT, non-brand | 0 of 133 | 0 of 69 |
| AI referral sessions (GA4) | 0 | 0 |

- Every engine names both clients when asked about them by name (5 of 5 each). Being known is not the problem; being retrieved
  and recommended is.
- All 8 of client T's hits are citations of two of its own informational blog posts (an "is Microsoft 365 an ERP" explainer and a
  PDF e-invoicing article), mostly in Gemini and Google AI Mode / AI Overviews. None is a recommendation.
- Client D's one hit was Gemini, once, on a question that was later retired.

## 2. Root causes, ranked

Categories: (a) measurement artefact, (b) action recommended but not executed, (c) executed but too early, (d) lever not pulled,
(e) client fundamentals.

1. **(e) No retrievable footprint, no third-party mentions.** Client D: about 53 Google impressions in 28 days, 0 captures in the
   latest Common Crawl, 1 page in Brave (used by Claude), not in Bing Webmaster, 1 real referring domain, no Wikidata item, domain
   17 months old, and Google reads the brand as a similar-looking word. Client T: retrievable (Bing crawled 17 of 17 submitted
   pages) but ranks 20 to 50 for its commercial queries, domain 8.5 months old, one real follow link (an industry directory), no
   Wikidata item, and a 4-character brand name the AI indexes cannot match. Search-grounded engines name only what they retrieve.
2. **(d) The deciding lever is not pulled: the cited lists and directories.** Answers to "best providers in [country]" questions
   are built from listicles and service directories: in client D's market, 10 such pages account for most citations (one directory
   cited in 22 of 171 answers); in client T's, partner listicles written by rival partners plus a government registry. Neither
   client is on any of the 11 lists checked. The system rejected 45 of 54 AI-cited pages as "not a fit", mostly because the list's
   author is a rival; its listings checklist is built for software products (G2, Capterra, Product Hunt) rather than service firms
   (Clutch, The Manifest, DesignRush, Sortlist, the Microsoft partner directory, the national registry), and 25 of 27 checklist
   items were never checked.
3. **(a) The question panel measures the wrong things and keeps changing.** All 38 questions were written by the model; none has
   search or AI demand data. Client D's panel moved to Pakistan although both keywords the client chose are UAE / GCC ones (the
   market came from a profile field and a ladder rung). Client T's panel retired 9 of 22 questions in 11 days, **including the one
   that produced 5 of its 8 hits**. Only one week pair in 11 days was comparable.
4. **(a) Too few samples to detect change.** 9 to 11 questions per client; with 0 hits the weekly 95% upper bound is 20 to 31%.
   The daily pulse adds days on the same questions (3 engines), Claude is asked once a month. The set-up can only detect a jump
   to about one question in four.
5. **(b) The system did not do what it said.** Reports said "Queued: the Monday content run writes it (2 AI pages a month)". In
   practice the 2-pages-a-week budget always went to keyword-ladder pages; AI targets became manual suggestions; **0 of 20 AI
   targets were written**. AI Growth also set aside client T's best-cited question as too broad. A ladder rung rewrote client T's
   only AI-cited page twice for other keywords.
6. **(b) Waiting on setup or the client.** No mailbox connected, so 0 outreach was ever sent (0 sequences, 0 messages). Client D
   not in Bing Webmaster (asked since 10-30). No Wikidata item for either. One redirect task open. Crawler logs not connected.
7. **(c) Too early for what was done.** IndexNow verified (10-29 / 10-30), client D fixed its robots.txt and llms.txt (404 on 10-25,
   present on 10-30), 4 and 6 pages published, client T's submitted pages crawled by Bing. Pages must be indexed and rank before
   search-grounded answers can use them; 7 to 13 days of exposure cannot show on a 9-question panel. Client T's two cited blog
   posts show the path works for informational questions once a page ranks.
8. **(a) Noise in the reporting.** The headline pools answers to retired questions (client D's "1.4%" is 0 of 44 on the current
   panel), junk "competitors" are counted (sentence fragments, place names, ERP vendors; no declared competitors), the market
   keyword and the panel disagree, earned-media lists lag the panel. Confirms production review findings F-08, F-37, F-38, F-53,
   F-81, F-85; F-12 (pulse billing) and F-03 (stale 404 advice) are real but not causes of the missing outcome.

## 3. What the new algorithm must do differently

| Cause | Change |
|---|---|
| 1 Footprint | Measure retrievability first: for each question, take the engines' fan-out queries and check whether the client is indexed and ranks for them in Google, Bing and Brave. Report it as the leading metric. Say plainly when AI visibility cannot be expected yet. |
| 2 Cited sources | Build the plan from the source gap: every page and directory the answers cite, whether the client is on it, and one action each (get listed, ask to be added, publish the page type the answer cites). Keep lists written by rivals. Add service-firm directories and registries with submit and verify. |
| 3 Panel | Freeze a core panel for at least 8 weeks; take the market from the site and the client's chosen keywords; use real demand where it exists; score "recommendation" and "informational" questions separately; never retire a question that names or cites the client. |
| 4 Power | Show what change the panel can detect; add distinct questions on winnable informational topics rather than more days on the same ones; track leading indicators (indexed, ranking for fan-out queries, on cited lists). |
| 5 Execution | Reserve content slots for AI targets or stop promising them; never let a ladder rewrite a page AI already cites. |
| 6 Blockers | Show client blockers (mailbox, Bing Webmaster, Wikidata, directories, redirects) with an owner and a date; a drafted pitch is not progress. |
| 8 Reporting | Headline only on the current panel; competitor entities must be businesses in the client's category; declare competitors at setup. |

## 4. Counts for reference

- Data read: 735 AI answers, 38 panel questions, 5 weekly visibility rows, 16 pulse days, 5 AI Growth runs, 20 AI targets,
  23 AI-readiness page rows, 84 outreach rows, 27 listings, 15 content-log rows, 460 Search Console query rows, 153 cached Google
  result pages.
- AI-readiness of key pages: client T 19 pages, mean 80; client D 4 pages, mean 67.5. Readiness was not the constraint.
- Google result pages cached by the system (top 30): client T appears in 1 of 153 readings (position 16); client D in none (47 Pakistan readings and its UAE ones).
</content>
</invoke>
