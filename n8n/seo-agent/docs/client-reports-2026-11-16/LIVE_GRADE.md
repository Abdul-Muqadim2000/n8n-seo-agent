# Live page grade explained (client reports 2026-11-16, build section 191)

Branch `fix/live-grade-1116` (based on `feature/seo-agent-v4.5` = production). **Not deployed.** Engine + API + web.

## 1. The report and what was wrong

A client (devaicon.com) published two pages we delivered at 98 and 97 (shown as "95+"); the Content card then read "Live page grade
84/100 · needs work" and the publish check failed its image checks. The investigation (private: `~/seo-agent-secrets/client-reports-2026-11-16/
INV2_live_grade.md`) found:

* The 84 is a correct reading of the page that is live, and that page is **the client's own rewrite**: 0 of 161 (agentic) and 11 of 149
  (governed) of our sentences of 8+ words are on it. 10 / 9 of the 14 / 13 points lost are the rewrite (long sentences and long words,
  readability 3 of 10; the main search phrase twice; no source cited).
* 4 / 4 points were **our own measuring**: the literal "Quick answer:" label (the live page opens with a direct answer without it) and the
  site template's questions accordion after the article read as "FAQ is the last section". On techand.ai the same kind of artefact: a CMS
  table without header cells flattened by the page reader into run-on lines ("no comparison table", 28-word "sentences") and the site name
  the CMS appends to the title tag ("Meta title is 64 characters").
* The card showed none of this, and "95+" is a label for 98 / 97.
* The final version's HTML (rendered by the app) dropped the images' width and height and lazy-loaded the hero.
* The publish check read the whole page: "related articles" cards and a "book a session" avatar counted as content images (a page with one
  real image passed "at least 2 images" and failed "alt text" on decorative `alt=""` thumbnails), and a page with no image failed six image
  checks for one cause.

## 2. What changed

### Engine (`n8n/seo-agent/v5/code`, build section 191)

| Plan | File | Change |
|---|---|---|
| E1 | `Finalize_Live_Body.js` | `live_read.kept_pct` / `kept_sentences` / `delivered_sentences`: the sentences of 8+ words of `delivered_markdown` (the newest version the app sends) found word for word, normalised, in the text read. `live_read.tables` passes `grade_live.tables` to Content QA. A reader line that starts with the words of one of the page's own table rows (`grade_live.table_rows`) and has no terminal punctuation is put back as a Markdown table row (`table_rows_restored`), so it is a table again and no sentence. |
| E1 | `Content_QA.js` | `readability.longest` (the 5 longest sentences over 22 words, at most 200 characters), `structure_checks` (each of the 10 structure checks with its plain reason when it fails), `live_adjustments`, `live`. Output only for drafts. |
| E1 | `Finalize_Verdict.js`, `_grade.js` | For `grade_only`: basis "measured on the live page <url> as read on <day>, with the same check as the version we delivered"; next step "Change it on your website, then press Re-check" (`GR.deliver(del, grade, { live })`; not-ready and ready wordings too, never "the editor"); new body fields `live_parts`, `readability`, `live_adjustments`. |
| E2 (live only) | `Content_QA.js` | (i) a direct answer without the label counts: the first prose paragraph after the H1 (headings, images, bylines and list items passed over, within 200 words), 35-90 words, naming 60% of the search's words or defining something ("X is"); (ii) a trailing questions section is set aside before "FAQ last" and "call to action last"; (iii) the table check passes when the page has a `<table>` (publish check `page_signals.tables`); (iv) a trailing " &#124; Site name" / " - Site name" that matches the business name or the domain label is left out of the 60-character title check. Each relaxation is listed in `live_adjustments`. |
| E2 (every run) | `Content_QA.js`, `_grade.js` | An FAQ heading is one that IS the questions section (an H2 that starts with "Frequently asked questions", "FAQ" or "FAQs"), for the duplicate-FAQ warning and the FAQ-last check; an image (`![alt](url)`) is never a link, a source or a weak-source repeat (it was listed in `sources_cited`, and a second untitled image was unlinked to `!alt`). |
| E3 | `Publish_Check.js` | Images read in the article (`<article>`, else `<main>`, else from the H1 to "Related ..." / `<footer>`), with `<footer>` / `<aside>` / `<nav>` inside it left out; `alt=""` in a link or a class size of 64 px or less = decorative (counted apart); no content image = one failed check "Images in the article" (the other five image checks only apply to a page with images); "Images hosted on your website" fails for an image from Google Images, LinkedIn, Facebook, Instagram, Pinterest, X or Bing; a CSS background hero and the images we delivered (request `delivered_images`, by file name) are named; `page_signals.article_words`, `tables`, `table_rows`; "Enough content" says "N words in the article (M words on the whole page, menus included)" (A4). |
| E3 | `build_v4.py` | Normalize Input passes `delivered_images` (file names, at most 10); section 191 asserts the pieces above. |

`Publish_Check_Verdict.js` (named in the plan) is the CI publish-check webhook (B3-7), not "I published a page": no change was needed there.

### App

| Plan | File | Change |
|---|---|---|
| A1 | `shared/src/page-review.ts` | `renderArticleHtml(md, schemaBlocks, images)` / `renderMarkdown(md, { images })`: every image gets `width` / `height` from `meta.images` by file name; the first image `loading="eager" fetchpriority="high"`, the others `loading="lazy" decoding="async"`; `finalReportPayload` passes `meta.images`. The editor preview is unchanged. |
| A2 | `shared/src/live-grade.ts` | `PageLiveGrade` keeps `breakdown`, `max`, `parts`, `needs_work`, `advisory` (8), `next_step`, `readability` (with `longest`), `kept_pct`, `kept_sentences`, `delivered_sentences`, `adjustments`, `delivered` (jsonb, no migration); `liveGradeView` fills empty values for grades stored before. `liveGradeBody` sends `grade_live.tables` / `table_rows` when the check read them. `deliveredGradeOf(payload)` (exact score, parts, image count) and `deliveredImageNames(payload)`. |
| A2 | `server/src/services/liveGrade.ts`, `data.ts`, `runs.ts` | The job stores `delivered` from the newest version's payload; `publishChecks` reads `page_signals.tables` / `table_rows` and `images.count`; the publish-check request carries `delivered_images` (from the content report). |
| A3 | `web/.../content-status.ts`, `review-status.tsx`, `ContentPage.tsx` | The grade line shows the engine's reading ("needs work: readability"); `liveGradeDetail`: "The live page is your own version: N% of the text we delivered is on it" (under half), "Where the live page lost points (change these on your website, then press Re-check)" with each part against the version we delivered and its fix (most points lost first), "Show the N longest sentences", "Not counted against your page"; beside a live grade the delivered grade is its number (98, not "95+"); `liveCheckText` groups the image checks ("images (6 checks)", "no images in the article") and says the images we made are ready in the page's report. |
| A4 | engine | One article word count on the check (above). |

Marketing: changelog 4.14 "Live page grades that explain themselves"; the content capability's live-check line (`features.ts`).

## 3. Contract (engine and app)

Request (`POST /webhook/seo-page-finalize`, live grade):

```
grade_only: true
grade_live: { url, h1, title,
              tables?: number,          // <table> elements in the live article (publish check page_signals.tables)
              table_rows?: string[] }   // the text of each row, cells joined by spaces, at most 60 x 160 characters
delivered_markdown                      // unchanged: the newest version's Markdown, now also used for kept_pct
```

Answer (200, `grade_only: true`), new fields beside the usual FinalizeResult:

```
live_read: { ok, url, title, words, reason,
             kept_pct: number | null,      // % of the delivered sentences of 8+ words on the live page (null: nothing to compare)
             kept_sentences, delivered_sentences, tables, table_rows_restored }
live_parts: [{ dim, label, points, max, reasons: string[] (<= 5, empty when no point lost), fix }]   // structure, coverage,
             // readability, specificity, clean_language, sources, fit
readability: { flesch, avg_sentence_words, long_sentences, longest: [{ text (<= 200), words }] (<= 5) }
live_adjustments: [{ code: direct_answer | faq_last | table | title_site_name, text }]
grade.basis           // "measured on the live page <url> as read on <day>, with the same check as the version we delivered (...)"
delivery.next_step    // "... Change it on your website, then press Re-check."
```

Publish check (`mode: published`): request `delivered_images: string[]` (file names); answer `images` gains `decorative`, `read_from`,
`background`, `borrowed[]`, `delivered { sent, on_page, missing[] }`, `advice[]`; `page_signals` gains `article_words`, `tables`,
`table_rows`; checks "Images in the article" (no content image) and "Images hosted on your website" are new. Older stored checks keep
their six image names; the app groups them.

Stored (`page_reviews.live_grade`): the fields listed in A2, every one optional. An engine from before section 191 answers without them
and the grade is stored as before; a grade stored before renders as before (no explanation block).

## 4. Evidence by numbers

Private replay (`~/seo-agent-secrets/client-reports-2026-11-16/inv2/replay191/`, the production inputs of executions 13659 / 13698 and
today's live HTML through the built node code; the same replay on the base commit reproduces 84 / 84 exactly):

| | Recorded | After | Parts | Our text on the page |
|---|---|---|---|---|
| Agentic page | 84, structure 14 | **88**, structure 18 (direct answer, questions section not counted) | readability 3 of 10, structure 18 of 20 (search phrase twice), sources 12 of 15 (no source) | 0% (0 of 186) |
| Governed page | 84, structure 16 | **88**, structure 20 (same two) | readability 3 of 10, coverage 13 of 15, sources 12 of 15 | 6% (10 of 161) |

Both stay "Needs work: readability" (3 of 10: the client's prose; the 5 longest sentences are 40 / 39 / 36 / 32 / 30 and 60 / 43 / 42 /
42 / 40 words). Publish check on today's HTML: agentic 10 of 18 (six image failures) -> 10 of 13 with one "Images in the article" (a
LinkedIn background hero, none of the 3 images we made); governed 16 of 18 ("5 content images", "4 without alt") -> 15 of 19 with true
readings: 1 content image, no width / height, not WebP, loaded from Google Images, none of our 3 images.

## 5. Tests

* Harness `scenarios_client_1116.js`: LG1 (kept_pct 0 on a rewrite, >= 90 on our own text read back; basis, next step, live_parts,
  longest; a final version has none of it), LG2 (live: label-free answer and template questions score as the labelled text without them,
  flattened table rows restored and no longer long sentences, site name out of the title length; the same texts as a final version are
  graded as before), LG2b (every run: "FAQ" inside a heading, image links), LG3 (publish check on two synthetic pages shaped like the live
  ones, and one with two of our images on a CDN). On the base commit 22 of the new assertions fail and two scenarios abort; after: all pass. `scenarios_w0c.js`' wiring check
  accepts the `{ live }` option. Full harness **19742 passed, 0 failed** (base 19620).
* App: `live-grade.test.ts` (an engine answer shaped like execution 13659, synthetic text; old rows; delivered grade and image names; table
  rows in the request), `page-review.test.ts` (A1; the first final image is now eager, the preview unchanged), `contentRows.test.ts`
  (`imagesFound`), web `liveGrade.test.ts` (`liveGradeDetail`, the engine's label, the exact delivered grade, grouped image checks) and
  `liveReadings.test.ts` (grouped image checks).

## 6. Production effect (after deploy)

A live grade is free (no model call, no search data; one page-reader read). Pressing "Re-check page" on each of the two pages (a free
publish check) re-grades them: expected 88 / 88 "Needs work: readability", the card naming the client's own version (0% / 6%), the parts
and the sentences to shorten, and the publish check naming the missing images and the Google Images thumbnail. Not changed here: the live
grade still grades the meta description the request carries (the live one is equal on both pages).
