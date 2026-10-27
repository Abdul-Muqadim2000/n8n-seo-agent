# R2 - Market and evidence research: how the leaders get from AI draft to a page you can publish

Date: 2026-10-27. Scope: the "every page is not ready to publish" problem. Method: web research on the vendors' own docs, changelogs and
help pages (opened, not summarised from memory), Google's own documentation, and independent or semi-independent studies. Each claim
is labelled **[doc]** (vendor documentation / changelog, describes what the product does), **[vendor claim]** (marketing numbers or
self-run studies), **[evidence]** (primary source from Google, a court/regulator, peer-reviewed or a dataset study with its method
published) or **[thin]** (little or nothing public found; do not rely on it).

The owner's idea (fix everything ourselves, ask the client only what only the client knows, then produce the final version) was
treated as a hypothesis, not a requirement. Section 6 compares it with the other flows the market uses and picks one.

---

## 0. Why every page fails today (context, read from our code)

This is not the research, but it decides what the research is for.

- `v5/code/Content_QA.js:989`: `passed_copy = warnings.length === 0 && content_score >= 80 && lenOk && ...`. **Every warning is a
  blocker.** "Comparison table missing", "Meta title is 61 characters", "Only 3 H2 sections", "Primary keyword used only 2 time(s)",
  "Quick answer is 92 words", a readability note: any one of them keeps the page from passing.
- `Content_QA.js:990`: `passed` also needs zero body brackets, zero author-profile placeholders and zero open claims. Any unsupported
  statement about the client becomes a `[Confirm: ...]` bracket, and any bracket means "not ready".
- `Content_QA.js:1004-1007`: `qa_max_rounds` is 2 (`build_v4.py:786`) and the fix step is a full editor rewrite. When the rounds run
  out the page is delivered as "not ready, finish by hand" (`not_ready`). Our own live run exec 521 showed a full rewrite can make
  things worse (6 placeholders became 12).

No product in the market gates publishing on SEO-structure checks. They gate (if at all) on facts, brand and legal rules, and they
present the SEO score as guidance. Section 1 shows this tool by tool.

---

## 1. Best practice to copy, ranked

Ranked by (impact on page quality and client experience) x (strength of the evidence behind it).

1. **Separate blockers from advice, and only let facts, trust and legal problems block.** Every SEO score in the market is advisory:
   Surfer's Content Score is "guidance and benchmarks" with no threshold that blocks; Clearscope says its term ranges are "a guide rather
   than a rule"; Conductor's score "provides actionable insights"; MarketMuse calls its target "the recommended minimum". Google says it
   has no preferred word count and that keyword placement in URLs has "hardly any effect". The things that do carry risk are invented
   facts (Google 2026-10-01: "critical to manually factcheck... before publishing"; Moffatt v. Air Canada; FTC fake-review rule) and
   scaled low-value content (spam policy). [evidence + doc]
2. **Capture the client's business facts once, as a reusable knowledge base, and write only from it.** Surfer Brand Knowledge
   (auto-generated from the site, then edited by the client), Jasper Knowledge Base + Product IQ ("source of truth for every product"),
   Writer Knowledge Graph, Conductor Knowledge Sources, AirOps Brand Kit ("a governed source of brand truth"), Profound Knowledge Bases +
   Context Manager (Sept 2026). This is the universal pattern of 2025-2026. [doc]
3. **Never invent a client fact; when one is missing, write the sentence without it.** No vendor documents a "generic wording" fallback
   explicitly, but Writer's own help page says its model "has no way to confirm facts" so a human must verify; Google's guidance says the
   same of all generative models. A claim we cannot back is a liability we hand the client (Air Canada was held to its chatbot's invented
   policy). Rewriting unsupported claims neutrally costs nothing and removes the bracket entirely. [evidence]
4. **Auto-fix with small, targeted edits, not full rewrites, and stop after a fixed budget.** Surfer Auto-Optimize "makes fewer
   changes by skipping areas that are already handled" (2026-05-18) and adds missing facts/entities "in one click"; Search Atlas rewrites
   "weak sections" at passage level. Our own data: a full second rewrite inflated length and placeholders. [doc + own evidence]
5. **Put a human approval step at the end, with the evidence in front of the human.** AirOps Human Review pauses the run, lets the
   reviewer edit and accept or cancel, and passes the result downstream as a variable; Profound added Human Review nodes (2026-07-31) and
   a docs layer to "read it, edit it, comment on it, and approve it"; Search Atlas OTTO has an "approval mode". Google's 2026-10-01 text
   now makes manual review "critical". Approval should be one click on a page already safe to publish, not a writing job. [doc + evidence]
6. **Ask the client few questions, prefilled, at the moment they matter, with a safe default if they do not answer.** Form research:
   every added field costs completion (Baymard: 8 checkout fields are enough for most sites; SurveyMonkey: drop-off rises fastest over
   the first 15 questions), people accept good defaults (NN/g), and reminders work up to 2-3 contacts (Dillman). [evidence]
7. **Ask for experience, not just facts.** Google's helpful-content self-assessment asks for "original information, reporting,
   research, or analysis" and "first-hand expertise"; the GEO paper (KDD 2024) found adding sources, quotations and statistics raised
   visibility in generative answers by 30-40%, while keyword stuffing did worse than doing nothing. The 2026 SME-interview tools
   (Hello Gordon, dbrief) exist for exactly this. One good proof point per page is worth more than any term-coverage gain. [evidence]
8. **Set SEO targets as ranges from the pages that rank, and aim for "the same ballpark", not a maximum.** Ahrefs' own study of five
   content-score tools found "weak correlations everywhere" and "scoring in the same ballpark as top-ranking pages is enough"; Surfer
   says "don't chase 100"; MarketMuse suggests word count within about +-10% of target. [evidence + doc]

---

## 2. Comparison table: the tools on (a)-(e)

(a) company facts: source and enforcement; (b) asking humans / SMEs and feeding answers back; (c) scoring and what blocks;
(d) auto-fix; (e) approval, publishing and status labels.

| Tool | (a) Company facts | (b) Asking humans / SMEs | (c) Quality scoring, blocking | (d) Auto-fix | (e) Approval / publish / statuses |
|---|---|---|---|---|---|
| **Surfer** (Content Editor, Surfy, Auto-Optimize) | **Brand Knowledge** (GA to all 2025-10-23): business description, industry, topics, audience, competitors, auto-generated from the site, editable, one per workspace, on by default for new editors [doc]. Per-article **Custom Knowledge** up to 5,000 chars, plus insights/sources per H2/H3 [doc]. No documented claim verification. | No question flow. The writer pastes knowledge or notes per heading before generation. | Content Score 0-100 = SEO Score + AI Search Score (Facts Coverage + Upfront Intent Alignment; unified 2026-05-04). Benchmarks: 67+ "optimum", "aim 10-20 points above competitors", "don't chase 100". Built from the top 20 pages. **Nothing blocks.** [doc] | **Auto-Optimize**: one click; since 2026-05-18 skips what is already covered and shifts to AI-search gaps; adds missing entities/facts (2026-01-05) [doc]. Humanizer + AI Detector via API [doc]. | WordPress plugin connected to Content Editor (2026-10-05); API + MCP (2026-08) for agents to plan, generate, score, optimise [doc]. No approval statuses documented. |
| **Clearscope** | None documented (optimiser, not a generator). | None. | Letter grade to A++ from term coverage weighted by importance (1-10) across top results; word count from the median of top results; Flesch readability. Term ranges are "a guide rather than a rule" [doc]. **Nothing blocks.** | None (manual editing in the editor; grade updates live). | None. |
| **MarketMuse** (Siteimprove since 2024-10-31) | None documented for client facts. | None documented. | Content Score 0-100 from topic mentions (max 2 points per topic); **Target Content Score** = "the recommended minimum"; scores relative to competitors; word count within about +-10% of target. Docs warn scoring "only detects mentions", you "still need a proper narrative" [doc]. Advisory. | Topic-model colour coding; no automatic loop documented. | Via Siteimprove governance (brand consistency, tone checks) [doc, thin on publish flow]. |
| **Frase** | Brand voice / style rules (punctuation, tone, structure) [doc, thin]. No knowledge base found. | None found. | Topic score from top 20 results, "your count / competitor average" per term, terms can be excluded; newer split SEO / GEO / combined score with red-yellow-green [doc]. Advisory. | AI writer drafts to the outline; no documented fix loop. | Not documented. [thin] |
| **Jasper** (Brand Voice, Knowledge, IQ, Agents, Grid) | **Jasper IQ**: Brand IQ (voice, style guide), **Product IQ** ("source of truth for every product"), **Knowledge Base** with connectors (SharePoint, Drive, Salesforce) to "ground every output" [doc]. Checks work against brand rules and "flags off-brand language" [doc]. | No documented SME question flow. Grid (2025-11-04) orchestrates pipelines; no approval gate documented [thin]. | Brand compliance flags; no SEO score of its own found. | 100+ agents; brand guardrails applied "automatically... at scale" [vendor claim]. | Not documented. |
| **Writer.com** (Knowledge Graph, claim detection, guardrails) | **Knowledge Graph**: graph-based RAG over connected company sources (Confluence, Drive, SharePoint, Notion) [doc/third-party]. Terminology and style rules [doc]. AI Studio **guardrails** block/log policy violations before or after the model call (Enterprise) [doc]. | **Claim detection**: highlights statistics, quotes and anecdotes that "might need to be fact-checked"; the help page says the model "has no way to confirm facts" and a human editor should verify before publication [doc]. Older KG beta suggested replacement statements with the source for accept/reject [press 2023]. | Brand/terminology checks, claims highlighted. Guardrails can block (compliance), not SEO. | Suggested replacements accept/reject [press 2023]. | Not documented for publishing. |
| **AirOps** (workflows, Power Agents, Human Review) | **Brand Kit** ("a governed source of brand truth") + **Knowledge Base** lookups inside workflows [doc]. | **Human Review step**: run pauses (state pending), reviewer edits markdown or selects values, then **accepts or cancels**; the reviewed output is a variable used by the next steps; in a Grid each row shows "Review Needed" [doc]. "Review checkpoints let an expert give feedback during a workflow" [doc]. | No single gate; teams build their own checks as steps. | Power Agents (forkable prebuilt workflows: SERP analysis, briefs, articles, refreshes) [doc]. Re-run on source change (Parallel case study) [vendor claim]. | Approved content pushed to Webflow / WordPress [doc]. |
| **Search Atlas** (Content Genius, OTTO) | OTTO reads "your knowledge graph" plus site, competitors, GA, GSC, GBP [doc]; Content Genius builds a *topical* knowledge graph from web research, not documented as client facts [doc]. | None documented. | Semantic Grader; "95%+ SEO scores" [vendor claim]. | Passage-level rewrites of "weak sections"; microagents for POV, lists [doc]. | "Review and publish, or let Search Atlas ship it for you"; OTTO has autopilot plus an **approval mode** to review each change [doc]. |
| **Conductor** (Writing Assistant / Creator) | **Knowledge Sources**: up to 5 files or text per draft, used automatically; **Content Profiles** store voice, style, audience and compliance requirements [doc]. | None beyond statuses and assignment. | Content Score (beta) on topical coverage and intent; "provides actionable insights"; nothing blocks [doc]. | User-triggered Generate / Revise; no automatic loop [doc]. | Draft **statuses and assignees** (values not listed) [doc]. |
| **BrightEdge** (Copilot, Content Advisor, Autopilot) | Not documented. | Drafts "ready for human refinement" (2023) [doc]. | Content Advisor "a way to check any draft before it goes live" [doc]. | Autopilot "zero-touch" for technical SEO, not content [doc]. | Writer finalises and publishes. [thin for 2026] |
| **seoClarity** (Content Fusion) | Not documented. | Not documented. | Real-time content score, briefs [third-party review]. | Sia / GenAI assist [third-party]. | Docs / Word plugins. [thin] |
| **Profound** (Agents) | **Knowledge Bases** (brand docs, pages, sources) + **Brand Kits** (Enterprise); **Context Manager** (2026-09) [doc]. | **Human Review node** (2026-07-31): agent pauses mid-run and alerts the reviewer [doc]; docs layer to read, edit, comment, approve [doc]. | Not documented as a gate. | 14 content templates, refreshes, translations [vendor claim]. | Direct CMS publishing (WordPress, Webflow, Contentful, Sanity, Framer...): create posts, update, manage drafts [doc]. |
| **Contently / Siteimprove** | Brand consistency checks on tone and style (Siteimprove) [doc]. | Contently: invite SMEs (no login needed) to review with deadlines and versions; fact-check early in review [doc, 2023]. | Governance policies. | n/a | Editorial workflow statuses [doc]. |
| **SME-interview tools** (Hello Gordon by FOMO.ai, Jan 2026; dbrief) | The expert's own words become the source. | **Adaptive voice interviews** (structured / focused / conversational), AI follow-ups, outreach and reminders; content generated from the transcript [press release / vendor]. | n/a | n/a | n/a |

**What the table says.**
- **Nobody blocks on SEO metrics.** Every score (Surfer, Clearscope, MarketMuse, Frase, Conductor) is advisory. We are the only product
  that refuses a page for a 61-character title or a missing table.
- **Company facts come from a stored, client-editable knowledge layer** (Surfer, Jasper, Writer, Conductor, AirOps, Profound). Ours
  exists (`seo_profiles`, business facts, case studies, site model); the gap is how we use it when it is incomplete.
- **Claim handling is "flag for a human"** (Writer). Nobody auto-verifies claims about the client; we already do more (`_claims.js`,
  `CL.commitments`), but we turn the result into a bracket instead of a safe sentence.
- **Human-in-the-loop is a pause point in the pipeline whose answer flows back automatically** (AirOps, Profound). That is the
  mechanism the owner described; the market uses it for *review and approval*, not for *fact gathering*.
- **Asking SMEs structured questions is a separate, young category** (Hello Gordon, dbrief, 2026). None of the SEO suites has it.
  It is an opening for us.

---

## 3. Evidence: what matters for ranking and AI answers (2025-2026)

### 3.1 Google's own documentation
- **AI content is judged by quality, not production method**; using AI "primarily to manipulate search rankings" violates the spam
  policies. [Google Search Central blog, 2023-02-08](https://developers.google.com/search/blog/2023/02/google-search-and-ai-content)
- **Updated 2026-10-01**: "It is critical to manually factcheck and review all AI-generated content for accuracy and trustworthiness
  before publishing." Models "don't retrieve facts, but predict a likely sequence of words"; the review covers `<title>`, meta
  description, structured data and image alt text; "using generative AI tools... to generate many pages without adding value for users
  may violate Google's spam policy on scaled content abuse"; disclosure of how content was made "can help give your readers more
  context". [Using generative AI content](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content),
  [SERoundtable on the change](https://www.seroundtable.com/google-updates-ai-content-guidelines-factcheck-review-42217.html)
- **Scaled content abuse**: "many pages are generated for the primary purpose of manipulating search rankings and not helping users...
  no matter how it's created"; first example: "Using generative AI tools or other similar tools to generate many pages without adding
  value for users". [Spam policies](https://developers.google.com/search/docs/essentials/spam-policies),
  [March 2024 announcement](https://developers.google.com/search/blog/2024/03/core-update-spam-policies)
- **Helpful content self-assessment**: on a preferred word count: "No, we don't". Asks whether content provides "original information,
  reporting, research, or analysis", demonstrates "first-hand expertise", or is "mainly summarizing what others have to say without
  adding much value"; "Of these aspects, trust is most important"; asks whether automation is "self-evident to visitors through
  disclosures". [Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- **SEO Starter Guide, "things you shouldn't focus on"**: "The length of the content alone doesn't matter for ranking purposes";
  keywords in domain or URL path "have hardly any effect"; heading order "doesn't matter" for Search; E-E-A-T is not a ranking factor;
  Google's language matching relates a page to queries without the exact terms; keyword stuffing is spam.
  [SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- **Quality rater guidelines (Jan 2025, extended Sept 2025)**: main content that is "auto or AI generated... with little to no effort,
  little to no originality, and little to no added value" is rated Lowest. Raters do not change rankings directly; they train the
  evaluation. [Search Engine Land](https://searchengineland.com/google-quality-raters-content-ai-generated-454161),
  [Semrush summary](https://www.semrush.com/blog/google-expands-rules-on-low-value-content)
- Helpful content became part of core ranking in March 2024; the August 2024 core update aimed to show "more content that people find
  genuinely useful" and "small or independent sites that are creating useful, original content".
  [August 2024 core update](https://developers.google.com/search/blog/2024/08/august-2024-core-update)

**Implication for Alaventra.** Google's two hard lines are (1) accuracy, with a human check, and (2) adding value at scale. Length,
term counts and keyword placement are explicitly *not* lines. Our gate is strict on the second kind and lets the first kind turn into
brackets the client has to resolve.

### 3.2 Word count vs topical coverage
- **Ahrefs, ~174,000 pages cited in AI Overviews (Dec 2025)**: Spearman 0.04 between word count and being cited, 0.04 with citation
  position, "essentially zero"; 53.4% of cited pages are under 1,000 words. [Ahrefs](https://ahrefs.com/blog/short-vs-long-content-in-ai-overviews) [evidence, dataset study]
- **Surfer (~1M pages, July 2025)**: length factors dropped to zero weight in their model.
  [Surfer](https://surferseo.com/blog/word-count-does-not-matter-for-seo) [vendor study]
- Google: no preferred length (above). Conclusion: a length band is a sanity check for "did the writer cover the subject", never a
  publishing gate.

### 3.3 Term-frequency / content-score tools: correlation and limits
- **Ahrefs study of Surfer, Frase, NeuronWriter, Clearscope, AI Content Helper** (20 keywords, Spearman + Kendall averaged; updated
  2025-05-21): "weak correlations everywhere"; "'weak' doesn't mean 'useless'"; "Keyword density is not topic coverage"; "scoring in
  the same ballpark as top-ranking pages is enough"; scores can be gamed (100 by pasting the keyword list) and "can't help you craft
  unique content". The author works for Ahrefs, which sells one of the tools. [Ahrefs](https://ahrefs.com/blog/seo-content-score-study/)
- Vendor-cited figures: Surfer 0.28 / 0.26 vs Clearscope 0.17-0.18 (Originality.ai, Surfer internal); Clearscope cites the Ahrefs
  study as .30 vs .27 in its favour. Every figure sits in roughly 0.17-0.30. [Clearscope rebuttal](https://www.clearscope.io/blog/clearscope-vs-surferseo) [vendor claims]
- **Limit**: correlation over top results, small samples, scores built from the same SERP they are correlated with (circular).
  Use coverage as a "did we miss a subtopic" check, never as a pass mark.

### 3.4 What moves AI answers
- **GEO paper** (Aggarwal et al., KDD 2024): Cite Sources, Quotation Addition and Statistics Addition gave "a relative improvement of
  30-40% on the Position-Adjusted Word Count metric"; fluency/readability edits 15-30%; Keyword Stuffing "offer[s] little to no
  improvement" and did 10% worse than baseline on Perplexity. [arXiv 2311.09735](https://arxiv.org/html/2311.09735v3) [evidence, peer-reviewed]
- **"Information gain"**: Google's patent US 11,354,342 exists; Google has never confirmed it is used. On-Page.ai's July 2026 study
  found cited and uncited ranking pages "statistically indistinguishable on originality" (p = .07), against its own commercial interest.
  [On-Page.ai study](https://api.on-page.ai/research/ai-citation-study),
  [Similarweb explainer](https://aisearch.similarweb.com/blog/information-gain/) Treat information gain as editorial good sense, not a
  measured signal.
- Ahrefs (75k brands): branded web mentions correlate 0.664 with AI Overview visibility vs 0.218 for backlinks; i.e. off-page
  reputation matters more than on-page term counts. [separate Ahrefs study, seen only as quoted in search results; not opened]

### 3.5 Titles and meta descriptions
- Google rewrote 76% of displayed titles in Q1 2025 (one consultant's study, 24,886 results) and ~63% of meta descriptions (Ahrefs
  2020). Exact-length rules for titles and descriptions are display hygiene, safe to auto-fix, never worth blocking a page.
  [Ahrefs meta description study](https://ahrefs.com/blog/meta-description-study/) [study, older]

### 3.6 The risk of invented facts (legal and trust)
- **Moffatt v. Air Canada, 2024 BCCRT 149**: the airline was liable for a refund policy its website chatbot made up; the tribunal
  rejected "the chatbot is a separate entity" and found negligent misrepresentation. What a site says, however it was generated, is
  the business's statement. [ABA Business Law Today](https://www.americanbar.org/groups/business_law/resources/business-law-today/2024-february/bc-tribunal-confirms-companies-remain-liable-information-provided-ai-chatbot/),
  [McCarthy Tetrault](https://www.mccarthy.ca/en/insights/blogs/techlex/moffatt-v-air-canada-misrepresentation-ai-chatbot) [evidence, tribunal]
- **FTC rule on fake reviews and testimonials** (final 2024-08-14, in force 2024-10-21): bans fake testimonials "including those
  generated by artificial intelligence", civil penalties per violation (USD 51,744 in 2024, inflation-adjusted).
  [FTC press release](https://www.ftc.gov/news-events/news/press-releases/2024/08/federal-trade-commission-announces-final-rule-banning-fake-reviews-testimonials) [evidence, regulation]
- **FTC substantiation**: companies must be able to substantiate every express and implied claim (Operation AI Comply, continued into
  2026). The Rytr order (AI tool that generated reviews) was set aside on 2025-12-22, but the FTC stated that people who *use* AI to
  break the law remain liable, i.e. the client who publishes an invented testimonial, and plausibly the vendor that wrote it.
  [Holland & Knight, Aug 2026](https://www.hklaw.com/en/insights/publications/2026/08/operation-ai-comply-2-years-later-continued-enforcement),
  [Parker Poe on Rytr](https://www.parkerpoe.com/news/2025/12/ftc-reopens-and-vacates-prior-order-against-ai) [evidence, legal commentary]
- **Conclusion**: invented client facts (locations, team, clients, numbers, guarantees, certifications, testimonials, case results) are
  the one category that must never reach a page. Everything else is a quality trade-off.

---

## 4. Client-input UX: asking without frustrating

Evidence first, then the patterns that follow from it.

- **Fewer questions.** Baymard: most checkouts need only 8 fields; the average is 11.3 (2024); fields matter more than steps.
  [Baymard](https://baymard.com/blog/checkout-flow-average-form-fields). SurveyMonkey (100k surveys): the sharpest drop-off per extra
  question is within the first 15. [SurveyMonkey](https://www.surveymonkey.com/curiosity/survey_questions_and_completion_rates/).
  JMIR 2023: a shorter survey cut drop-off from 65.7% to 20.2% with almost the same start rate.
  [JMIR](https://jmir.org/2023/1/e48236)
- **Defaults are accepted.** NN/g: "optimize the default user experience, since that's what most users stick to"; pre-fill what you
  can predict; never pick defaults that serve the vendor. [NN/g, The Power of Defaults](https://www.nngroup.com/articles/the-power-of-defaults/)
- **Reminders work, a few times.** Multiple contacts are the strongest lever for response (Dillman's tailored design); gains fade after
  2-3 reminders. [Dillman via UNCW text](https://people.uncw.edu/maumem/soc500/ch4.pdf),
  [summary](https://www.intotheminds.com/blog/en/online-survey-reminders/) [secondary]
- **Experts will talk, not write.** SME-interview practice: prepare questions, record more than you need, never ask the expert to write;
  2026 tools run adaptive voice interviews (Hello Gordon, dbrief). [Marketing Dive](https://www.marketingdive.com/press-release/20260129-fomoai-introduces-hello-gordon-the-first-ai-interviewer-for-experts-and-t-1),
  [Marketing AI Institute](https://www.marketingaiinstitute.com/blog/ai-agent-interviewer)

**Patterns to use (each traced to the evidence above):**

1. **Business facts once, reused everywhere.** One "What we can say about you" profile (locations, years, team size, named people and
   roles, clients you may name, numbers you are happy to publish, certifications, guarantees, prices / "no prices"), auto-filled from
   the site like Surfer's Brand Knowledge, confirmed by the client in one sitting. Every later page draws on it, so per-page questions
   fall towards zero over time.
2. **At most 3-5 questions per page, ordered by value.** Ask only what changes the page materially (a proof point, a local detail, a
   number). Never ask what the site, the profile or a public source already answers.
3. **Prefilled, confirm-or-correct.** Each question shows our best guess and where it came from ("Your About page says 2015. Still
   right?"): one tap to confirm, inline edit to correct. Confirmation is faster than recall.
4. **"Leave it general" on every question.** A visible, respectable choice: "Write it without this" (the page then uses neutral wording
   that makes no claim). Never "skip" as a failure.
5. **Inline confirm/deny on the page itself.** Show each sentence that states something about the client, highlighted, with Keep /
   Change / Remove, like a tracked change. The client approves claims in context instead of decoding `[Confirm: ...]`.
6. **A deadline with a safe default.** "If we do not hear back by Thursday, we will publish the general version." Two reminders at most.
   Never let a page wait forever because a question went unanswered.
7. **Answers go into the profile, not just the page.** "Use this on future pages too" is on by default, so each answer pays off again.
8. **Experience prompts, not forms, for proof.** For pages that need first-hand content (case study, local page, service page), offer a
   5-minute guided interview (typed or voice) with follow-ups, instead of a list of blank fields.
9. **Tell them why, in one line.** "Pages with a real example are more likely to be quoted by AI answers" is true (GEO paper) and makes
   the ask feel like help, not homework.

---

## 5. Options compared (the owner's hypothesis and the alternatives)

| Option | How it works | Page quality | Client experience | Risk | Verdict |
|---|---|---|---|---|---|
| **A. Today**: strict gate, every warning blocks, deliver "not ready" | Brackets, warnings, finish by hand | Mixed: SEO hygiene high, but pages never go live | Bad: every page is homework | Low legal risk, high churn risk | Replace |
| **B. Owner's hypothesis**: auto-fix all, ask the client a short fact list, then produce the final | Gate holds until the client answers | High when answered | Good if the list is short; still blocks every page on the client | Pages stall when clients are slow | Close, but blocking on answers is the weak spot |
| **C. Publish with confidence levels / auto-publish** (Search Atlas "let us ship it", OTTO autopilot) | Publish automatically, flag low-confidence parts | Varies; risk of generic pages at scale | Best convenience | Google 2026-10-01 says manual review is "critical"; scaled content abuse; liability for claims | Only as an opt-in for clients who accept it, and only for claim-free pages |
| **D. SME interview first** (Hello Gordon, dbrief style) | Interview before writing, write from the transcript | Highest originality and E-E-A-T | Good for engaged clients; heavy for weekly cadence | Low | Use for proof-heavy page types and as the one-time onboarding capture |
| **E. Human review of the whole draft** (AirOps, Profound review nodes) | Pause for an editor to read and edit everything | High | Heavy for SMB clients without editors | Low | Keep as the final approval, but make it one click, not an edit job |

**Recommendation: a hybrid of B, D and E, "safe by default, stronger with your input".** The change from the hypothesis is one point:
**an unanswered question never blocks.** Every page is first produced in a version that is safe to publish (no unverified client
claims, every SEO hygiene item auto-fixed), and the client's answers *upgrade* it rather than *unlock* it. The exceptions are page types
whose whole value is the client's proof (case study, local page, team/author page, pricing page): those wait for the facts, because a
generic case study is worthless and a generic local page is the doorway pattern Google calls spam.

Why not pure B: blocking every page on the client recreates today's frustration with a nicer form, and the cadence stalls whenever a
client is slow. Why not C: Google's own 2026-10-01 guidance, the liability evidence and the scaled-content policy all say a human looks
before publishing. Why not pure E: our clients are not editors; asking them to read and fix 2,000 words is exactly the complaint.

---

## 6. Recommended target workflow for Alaventra

### 6.1 States a page goes through (customer-facing labels in plain words)

| # | Internal state | What the client sees | What happens |
|---|---|---|---|
| 1 | `planned` | Planned for <date> | Topic chosen (ladder / cadence). If the page type needs proof (6.4), questions go out now, **before** writing, with the facts profile prefilled. |
| 2 | `writing` | Being written | Draft from brief + verified facts only. Unknown client facts are written neutrally, never invented, never bracketed. |
| 3 | `checking` | Being checked | Graded checks (6.2). |
| 4 | `fixing` | Being improved | Targeted auto-fixes (6.3), at most 2 rounds, then deterministic fixes. |
| 5a | `ready_for_approval` | **Ready to publish, waiting for your OK** | No blocker left. Shows the review summary: what was checked, every statement about the client and its source, the advice items left. Optional "Make it stronger: 3 quick questions". |
| 5b | `needs_your_facts` | **Needs 3 answers from you** (with due date) | Only for proof-dependent page types, or when a blocker cannot be fixed without the client (e.g. the page's main promise is a claim we cannot back). Each question prefilled, each with "leave it general" unless the page type cannot exist without it. |
| 6 | `finalising` | Adding your answers | Answers saved to the facts profile; the affected sections are regenerated (not the whole page); checks re-run. Back to 5a. |
| 7 | `approved` / `scheduled` | Approved, publishing <date> | Client approval (one click; or auto-approval for clients who opted in, claim-free pages only). Audit trail: who approved, when, which version. |
| 8 | `published` -> `live_verified` | Live | Existing Publish Check confirms the live page; if it fails, it says so (never "published" on a 404). |
| - | `held` | Paused: <reason> | Only for true stops (budget, pile-up guard, client paused). Never "not ready, finish by hand". |

Deadline rule for 5b: two reminders, then the page either goes to 5a in its general version (most types) or stays held with a clear
reason (proof-only types). The client can always answer later; the page is then updated (refresh) rather than having waited.

### 6.2 What blocks, what is fixed, what is advice

**Blockers (the page cannot reach `ready_for_approval`):**
- A statement about the client (location, team, people, clients, numbers, years, results, certifications, guarantees, prices,
  timelines, testimonials, awards) with no source in the facts profile, the client's own pages or the client's answers. *Normal path: the
  fixer rewrites it neutrally, so this blocker almost never reaches the client.*
- A figure about the world that the cited source does not support (existing `_sources.js` check). Normal path: drop the figure or the
  sentence.
- Unfilled placeholder text of any kind (`[Price]`, `[Name]`, `[Confirm...]`). Under this design the writer is told never to emit them;
  if one appears, the fixer removes it.
- A broken link after the fixer tried to replace it (normal path: replace with the verified page, or unlink).
- Wrong brand, a competitor's name presented as ours, an off-topic or excluded section, near-duplicate of a competitor page
  (existing originality gate), a page that duplicates the client's own live page (cannibalisation).
- Legal/safety: fake testimonial or review, unqualified medical / legal / financial promise, guarantee not on file.
- Cut-off page (existing completeness check).

**Auto-fixed, never shown as a problem unless the fix fails (then advice):**
- Keyword in title / H1 / first 100 words; meta title and description length; slug format; quick answer length and position; question
  headings; one H1; duplicate FAQ; call to action last; internal links to the client's existing pages (only verified URLs); alt text;
  schema validated.

**Advice (shown in the summary, never blocks):**
- Length outside the band of ranking pages (unless under ~50% of the band's low end, which means the page is not covering its subject:
  then one targeted "expand these sections" fix, and advice if still short).
- Term / subtopic coverage below the best competitor's (target: "the same ballpark", e.g. within 10-15 points of the best page, never
  a maximum).
- Comparison table missing, H2 count, readability band, passive voice, sentence length, specificity per 100 words.
- "Would be stronger with": a real example, a number, a quote from the team (the optional questions).

A single 0-100 score may stay as a summary for the client, but the gate is the blocker list, not the score.

### 6.3 Auto-fix loop
1. **Deterministic fixes first** (code, no model): metadata lengths, keyword placement in title/H1/intro, slug, removing placeholder
   tokens, unlinking dead links, swapping a dead internal link for the verified live URL. Free and cannot regress.
2. **Targeted section edits** (model, per section, with the failing check named): rewrite unsupported client claims neutrally; expand a
   thin section; add a missing subtopic as a section; move the quick answer up. Pass only the section and the facts it may use.
3. **Re-check only what changed**, plus the blocker list on the whole page.
4. **Budget**: 2 rounds of step 2. If a blocker survives, the page goes to `needs_your_facts` with a specific question, or the section is
   removed if the page reads well without it. No full-page rewrite at the end (our own evidence: it regressed placeholders and length).

### 6.4 What is asked, and when
- **Once, at onboarding (and refreshed quarterly)**: the facts profile (section 4, pattern 1), prefilled from the site, confirm-or-
  correct, plus an optional 10-minute guided interview for proof (2-3 stories of work done, typical results, how they work, what they
  will not promise).
- **Per page, before writing, only for proof-dependent types** (case study, local page, author/team page, pricing/offer page, a service
  page whose keyword is about guarantees or results): 3-5 questions; no general fallback for a case study's core facts.
- **Per page, after writing, optional for every other type**: "Make it stronger" with up to 3 questions, each tied to a specific
  sentence or section and each with "leave it general".
- **Never asked**: anything in the profile, on the client's site, or in a public source; SEO mechanics (terms, length, headings); edits
  the system can make.

### 6.5 How answers produce the final version
1. Answers are validated (type, range, e.g. a year, a city from a list, a number) and stored in the facts profile with source
   "client answer, <date>, <user>" so later pages use them too.
2. Only the sections that use the answer are regenerated (the question carried the section id and the sentence it improves).
3. The blocker list re-runs on the whole page; advice re-computed.
4. The page returns to `ready_for_approval` with a diff ("3 sentences changed using your answers").
5. Approval -> publish -> live check, as today.

### 6.6 Evidence ledger shown at approval
For each statement about the client: the sentence, its source (profile field / own page URL / answer and date), and Keep / Change /
Remove. For each external figure: the source URL. This is the "manual fact check and review" Google now asks for, reduced to a 1-2
minute task, and it is the audit trail an enterprise buyer will want.

---

## 7. Gaps and caveats in this research
- BrightEdge and seoClarity publish little about 2026 content generation; their rows are thin. Frase's knowledge features were not
  found. Jasper's approval gates in Grid are not documented publicly.
- Most product capabilities come from vendor docs; no independent test of any tool's fact enforcement was found.
- Correlation studies of content scores are small or vendor-run; the strongest dataset evidence is Ahrefs' AI Overview length study.
- The "generic wording instead of asking" fallback is our design inference from the evidence (Google accuracy guidance, liability
  cases, form research); no vendor documents it as a feature, which is also why it is a differentiator.
- Local legal regimes beyond the US/Canada examples (UAE consumer protection, EU UCPD) were not researched here; the principle
  (a business is liable for what its site says) is general but should be checked per market before marketing claims are made.
