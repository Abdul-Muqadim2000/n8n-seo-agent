# Area 3 — Content creation & QA, against the best tool available in October 2026

**Pass run 2026-10-15** under `BENCHMARK_PROGRAM.md`. Score on the books: **6.0**
(`../system-review-2026-10-13/SCORECARD.md`), which predates **R11 / R25 / G2 / G5 / G30 / G31 / G33** and the whole of this pass,
so it is not a description of what the content run does today. What follows reads **the node code** and the **2026-10-14** run
(`RESULTS.md` here, executions 535–581, the page is **554**) as "what we do", and the frozen
`../system-review-2026-10-11/CRITERIA_keywords_content.md` §2 (criteria C1–C17) as the yardstick. The CRITERIA file is untouched.

Every competitor claim carries a URL that was **opened in this pass** (§8). Where a thing could not be verified without a paid seat
it says so. Two defects below were **proved by running the shipped node code**, not inferred from a register — the probes are now
harness scenario **S78**.

> **A correction to the brief this pass was given.** `v5/code/_draft_qa.js` was listed as content-QA evidence. It is not: it is the
> **outreach e-mail** gate (L2), and it has nothing to do with articles. The article gate is `Content_QA.js` (576 lines) plus
> `Originality_Check.js`, `_claims.js`, `_sources.js`, `_coverage.js`, `_shingle.js`, `_style_guide.js` and `_page_type.js`.

---

## 1. The leader today

**The rubric names Surfer / Clearscope. For *scoring* that is still right. For a *gate* it is wrong, and the gate is the thing this
area is actually judged on.**

Both named tools are alive and documented into October 2026, and both remain the reference implementation for term-coverage
scoring. But both have repositioned around AI-search visibility — Clearscope now sells **Tracked Queries** as its unit of value and
its navigation reads Expand / Discover / Write / Optimize / Protect / Localize / Linking; Surfer added an **AI Search Score** on
2026-10-01. Neither is primarily a content-QA tool any more.

And neither of them — nor Ahrefs, Semrush, Frase, Jasper or Writer — **refuses anything**. Every one is advisory scoring. The one
vendor in this market with documented block-before-publish behaviour is **Markup AI**, which is **Acrolinx rebranded** (acrolinx.com
now serves Markup AI content; footer: "Acrolinx is a trademark of Markup AI Europe GmbH", © 2026). It is absent from the rubric, and
it is our real competitor: it is the only product that shares our premise that a quality check should be able to say *no*.

| Tool | What it leads on, October 2026 | Verified |
|---|---|---|
| **Markup AI** (ex-Acrolinx) | **Blocks low-quality content before it publishes** via API, MCP and a GitHub Action; deterministic scores; 15 named agents across Brand / Quality / **Citability**; **ships an n8n node** | [acrolinx.com](https://www.acrolinx.com/), [markup.ai](http://markup.ai/), [GitHub Action](https://docs.markup.ai/github-action), [agents](https://docs.markup.ai/agents.md), [n8n recipe](https://docs.markup.ai/recipes/n8n), [pricing](https://markup.ai/pricing) |
| **Surfer** | Content Score 0–100 against the **top 20 pages**, now split into **SEO Score + AI Search Score** (Facts Coverage, Upfront Intent Alignment) | [what is Content Score](https://docs.surferseo.com/en/articles/5700317-what-is-content-score) (dated 2026-10-01), [FAQ](https://docs.surferseo.com/en/articles/6109757-answering-your-most-frequent-content-score-questions), [pricing](https://surferseo.com/pricing/) |
| **Clearscope** | Content Grade A++…F from term importance 1–10 across scraped SERP pages; new **AI Term Presence** | [how grading works](https://www.clearscope.io/support/articles/how-does-clearscope-grade-your-content), [pricing](https://www.clearscope.io/pricing) |
| **Semrush SWA** | Four sub-scores incl. **Readability target taken from the top-10 competitors** and **Originality via Copyleaks** | [KB 814](https://www.semrush.com/kb/814-seo-writing-assistant) |
| **Ahrefs AI Content Helper** | AI-derived **topics**, not term counts; explicitly says keyword stuffing will not raise the score | [help article](https://help.ahrefs.com/en/articles/9879434-about-the-new-ai-content-helper) (dated 2026-09-03) |
| **Originality.ai** | The only cheap vendor with a real **fact / hallucination checker**: per sentence, **fetches URLs itself** | [fact checker](https://originality.ai/fact-hallucination-checker), [its benchmark](https://originality.ai/blog/ai-fact-checking-accuracy) |

**Gone from the comparison.** **Writer.com has left this market** — writer.com is now "the enterprise AI platform for agentic work",
with no fact-checking, citations or hallucination detection anywhere on it; the 2023 Knowledge Graph validator the rubric alludes to
is not described in 2026. **MarketMuse** still serves a standalone site but publishes no pricing (its acquisition by Siteimprove is
search-result evidence only, not verified here).

---

## 2. What the leaders do, mechanism by mechanism

**Surfer.** Content Score compares against the **top 20 pages** for the query, not domains. Inputs named in the doc: main and
partial keywords, NLP terms, "True Density", title / H1 / headers, length against the SERP, image alt and OG, hidden metadata,
internal links, and E-E-A-T for YMYL. Bands are **0–33 low / 34–66 partial / 67–100 optimum**, and the FAQ tells customers **not** to
chase 100 — aim 10–20 points above competitors, "70 or higher is a solid, realistic goal". Two things are worth naming precisely:
the **weights and the formula are not published**, "True Density" is **named but never defined**, and **Google NLP is never
mentioned** — the rubric's assumption of a Google NLP integration is not supported by Surfer's own current documentation. Its
published correlation is **Spearman ρ = 0.28** over 1,000,000 SERP entries (vendor-run, correlational).
The **AI Search Score** added 2026-10-01 is the genuinely new idea: **Facts Coverage** (how completely the page covers the facts and
entities AI answers tend to include) and **Upfront Intent Alignment** (whether the primary question is answered early).

**Clearscope.** Scrapes top-ranking content, scores each term by frequency across competitor articles into an **importance of 1–10**,
and updates the grade live as terms are used. Its own docs **contradict each other on readability** — the readability article says
Flesch Reading Ease, the editor guide says Flesch-Kincaid grade level — it does not publish the full A++…F scale, does not name a
target grade, and does not state how many SERP results it reads. "Aim for A" is third-party folklore, not Clearscope guidance.

**Markup AI — the mechanism that matters.** Content is reviewed **before it reaches publication** across Brand / Quality /
Citability. The GitHub Action (`markupai/content-guardian-action@v2`) derives a risk level per file from its worst issue, rolls up to
the worst across files, and **sets the commit status from the overall risk**, which feeds branch protection — so the gate is
assembled from a commit status plus a policy, not from a built-in threshold. Two design choices are worth stealing outright:
numeric scoring is **optional per organisation**, and without it you get the risk assessment alone **"with no fabricated scores"**;
and its **AI Voice agent explicitly does not adjudicate authorship** — it flags clichéd phrasing, uniform sentence rhythm and
repetitive structure as a **style** defect. Its n8n recipe's recommended gate is literally *"no High severity issues"*.

**What nobody does.** No vendor fetched in this pass blocks on an unsupported factual claim, a hallucinated statistic, a missing
citation, an AI-detection score or plagiarism. Markup AI's **Source Authority** flags *unattributed* statistics and vague research
references — it does **not** check that a cited source exists, is authoritative, or supports the claim. Its **Claims** agent flags
risky *phrasing* ("guaranteed results") with no verification step. Originality.ai's checker is the closest real mechanism, and it
**fetches URLs it finds itself rather than checking the URL you cited**; its own benchmark reports **86.69% accuracy**, falling to
**82.7% on AVeriTeC** (real-world claims), and — the limitation that matters most for a gate — it has **no "No Evidence" output, so
every claim without a clear verdict was excluded from the benchmark**. That is precisely the case a publishing gate must handle.

**Google, and it moved in our favour.** `using-gen-ai-content` (**last updated 2026-10-01**) now states that generative models
"predict a likely sequence of words" rather than retrieve facts, and that **"it is critical to manually factcheck and review all
AI-generated content for accuracy"** — explicitly including title elements, meta descriptions, structured data and image alt text.
`creating-helpful-content` (2026-10-05) calls large amounts of generative text without oversight **low effort**. Scaled content abuse
still applies **"no matter how it's created"** (spam policies, 2026-08-28). And the new `ai-optimization-guide` (2026-07-10) tells
sites to **ignore llms.txt** and warns that **"no third-party tool has access to our internal ranking or AI systems"** — we already
got that one right: `AI_Readiness.js` reports llms.txt and schema but deliberately **does not score** them.

---

## 3. What we do, from the live evidence

The content run is the most expensive thing in the system (≈ $0.80) and the longest (8.7 min at execution **554**). Its gate is
`Content QA` → `Originality Check` → `Needs Revision?` → *Editor* or delivery, with the **Critic** running once *before* the first
Content QA. Execution 554 is the best evidence we have, and most of it is good:

- **The gate refuses, and says why.** Round 1 reported "needs another editing round"; round 2 exhausted `qa_max_rounds` and reported
  `passed: false, publishable: false, not_ready: true`, label **"did not pass the quality check — not ready to publish"**, with the
  **last** round's counts, six named reasons, and the file name `…-2026-10-14-DRAFT.doc` (R11).
- **Originality is real** (G5): 2,489 eight-word windows compared against 8 pages (6 competitor, 2 own), highest overlap **0%**, with
  the basis stated — and `passed: null`, never "clean", when no page text was available.
- **Coverage is measured against a named best competitor** (G33): 88% against a 90% target taken from whizlabs.com at 94%, with the
  missing terms and the missing subtopic listed.
- Three images produced (G30); no FAQPage emitted (G2); every internal link on the canonical host and nothing linking to an unwritten
  page (D9 / D15).

Two things were still wrong in that delivered draft, and this pass found the cause of one of them.

**The shipped page that shows it.** `harness/sample-output/LIVE-ladder-page-uae-e-invoicing-penalties.md` — 3,013 words — carries
**43 × `[Price]`**, including every cell of the **Fine** column of its own comparison table, under a correct citation of the
Ministry of Finance decision **that states every one of those fines**. The page reads: *"Failing to implement the Electronic
Invoicing System or appoint an Accredited Service Provider costs [Price] per month or part month."* That is not a hallucination
being caught. That is a verified figure being destroyed. And those 43 tokens are exactly what put `placeholder_count` over `PH_MAX`
(5) and had the page refused as not publishable — **the mask manufactured the refusal**.

### Proved by running the node code (both are now S78)

**(i) The money mask knew less than the figure check beside it.** §3 of `Content_QA.js` runs first and rewrites `md`
irreversibly, judging an amount only against `prev.facts` plus the customer's own text. §9b, forty lines later, checks every *other*
figure against the full corpus the run fetched — facts (text + claim + title), the brief's evidence plan **and the competitor pages**
— and keeps whatever a cited source states. A probe put three AED amounts and the percentage "42%" in one paragraph, every one of
them verbatim in the cited `mof.gov.ae` text the run had read. **The percentage survived. All seven currency amounts became
`[Price]`.** Two checks, one sentence, one source, opposite verdicts.

**(ii) A price *verb* decided a statutory *subject*.** The guard was `(big || OTHER_WORDS) && !PRICE_WORDS`, and `costs` is a
PRICE_WORD — so "the penalty **costs** AED 5,000 per month" was treated as our own pricing and **erased**, instead of being put in
front of the reviewer as `[Confirm: AED 5,000]`. `[Price]` carries no value, so the owner was told only that "a `[Price]` is
somewhere in the copy" and could never confirm or reject the number that had been removed.

**(iii) A gate that failed became a label.** `Content QA` finalises the delivery gate — `quality`, `not_ready`, `quality_label`,
`publishable`, the reasons — and `Originality Check` runs **after** it, flipping only `passed` / `passed_copy` / `editor_needed`. On
any round but the last the editor loop still fired, so it was invisible. On the **last** round it was not. A probe fed the real node
a draft **100% identical to a competitor page** with `rounds_left: 0`:

```
originality.passed : false   highest: 100%
qa.passed          : false
qa.publishable     : true
qa.not_ready       : false
qa.quality_label   : "passed the quality check"
qa.quality         : {"passed":true,"publishable":true,"label":"passed the quality check","reasons":[]}
```

Those exact fields drive the Word file's status line, the `-DRAFT` file name, the package's "DID NOT PASS" banner, `meta.json`, the
callback and the app. **A plagiarised page was delivered labelled as having passed its quality check** — the precise inversion of
the bar this programme sets. (The Word report's own Originality row did print "EXCEEDED", so the document and the machine-readable
delivery beside it contradicted each other.)

---

## 4. The gap

| What they do | What we do | Does it matter for the customer's outcome? | Criterion |
|---|---|---|---|
| Markup AI **blocks before publish**, with the gate assembled from a commit status + branch protection | We refuse: `not_ready` → `-DRAFT` file name, banner, reasons, and the app refuses to deliver a not-ready report **with no override even on manual send** | **We are ahead.** Ours is the stricter of the two, and it is the only one that cannot be clicked past | C9 |
| Nobody gates on **verified fact**. Markup AI detects *missing* attribution; Originality.ai fetches *its own* URLs and excludes "no evidence" from its accuracy claim | We check every figure in a cited sentence **against the text of the page that sentence cites**, and hold what it does not carry as `[Confirm: …]` | **We are ahead**, and Google's 2026-10-01 update makes it the named requirement | C3 |
| Surfer compares against the **top 20**; "aim 10–20 points above competitors", 70 is the realistic goal | Coverage is measured against the **best** competitor page's own coverage, clamped 60–90% (G33) — but the overall bar is a flat **80 of 100** with no competitor comparison of the score itself | Low. Our coverage half is arguably better targeted; the flat 80 is arbitrary but harmless | C1, C8 |
| Semrush derives the **readability target from the top-10 competitors**; Ahrefs' own data shows mean FRE varies 69.7 (food) → 49.6 (engineering) | Absolute bands: `flesch >= 40 && avgSentence <= 22` → 15 points, `>= 30` → 10, else 4 | Medium. A single absolute band is **wrong by construction** across topics, and we already hold the competitor text to derive one | C7 |
| Surfer's **AI Search Score**: Facts Coverage + **Upfront Intent Alignment** (is the primary question answered early) | We compute `ai_ready` — words before the quick answer, question headings, fan-out coverage — **only when the run carries an `ai_target`** | Medium. The same check is valuable on every page, not only AI-target pages | C7, new |
| Clearscope / Surfer re-score **live, after every edit** | `Content QA` re-runs each round, but the **Critic never sees the edited draft** — the judgement half of the gate runs once, before the editor | Medium. The editor can introduce exactly the problems the critic would catch, and nothing looks again | C9 |
| Semrush runs **Copyleaks** plagiarism against the whole web | We compare 8-word windows against **the pages this run read** only | Low–medium, and honest: `passed: null` when nothing could be compared. Whole-web checking is a paid API | C5 |
| Surfer ships an **AI detector** (and a humanizer beside it) | Nothing | **No** — see §5(c) | C6 |
| Jasper / Writer / Markup AI enforce a **stored brand style guide** | `_style_guide.js` is stored, injected into three prompts and checked in QA (G31) — but **has never run with real data**: execution 554 carried `style_guide: null` | Medium, and **owner-blocked** (O1 / O2) | C17 |
| Everyone pushes to a CMS | Blog package + WordPress built and off | Medium, owner decision **G13** | C16 |

### Where the leaders are wrong, or simply have nothing, and we are right

- **AI detection.** Surfer sells a detector **and a humanizer marketed as bypassing Turnitin, Copyleaks and GPTZero** — a vendor
  selling both ends of the arms race has told you the score is not a gate. Markup AI reached the same conclusion honestly and made
  its AI check a *style* flag that does not adjudicate authorship. We have neither, which is the correct position.
- **Fabricated scores.** Markup AI makes numeric scoring optional so that an organisation that does not want one gets the risk
  assessment "with no fabricated scores". Our `passed: null` for an originality check with nothing to compare against, and R18's
  `NOT_CHECKED` with no score, are the same instinct applied earlier.
- **llms.txt.** Google's 2026-07-10 guide tells sites to ignore it. `AI_Readiness.js` already reports it without scoring it.

---

## 5. What to build

### (a) In reach now

1. **The money mask reads the same corpus as the figure check beside it** (~S). *Built this pass — B3-1.*
2. **A statutory amount is never erased as a price, and what is erased is named** (~S). *Built this pass — B3-2.*
3. **The originality verdict re-decides the delivery gate it invalidated** (~S). *Built this pass — B3-3.*
4. **A readability band taken from the SERP, not from a constant** (~M, free). We already hold the competitor page text in
   `Analyze Competitor Pages`; computing its Flesch and scoring the draft against that band costs nothing and removes a check that
   is wrong by construction on technical topics. Report it with its basis, exactly as coverage now is.
5. **Upfront intent alignment on every page, not only AI-target pages** (~S, free). The code exists inside the `ai_target` branch;
   lifting `words_before_answer` and the question-heading count out of it applies Surfer's newest idea to every draft.
6. **Re-run the critic on the edited draft when a round was spent** (~M, **costs money** — see (b)). Listed here because the wiring
   is trivial; it is the cost that makes it a decision.

### (b) Needs money or an owner decision

- **G31 / O1 / O2 — fill techand.ai's business profile and style guide.** Free, blocking, and already asked for four times. Until
  it is done, C4 and C17 cannot be scored from evidence and every page ships with bracketed byline fields.
- **A second critic pass after the editor** (B3-5). One extra Sonnet call per round, ≈ $0.02–0.05 a page. The owner decides whether
  the judgement half of the gate is worth re-running on the text that will actually be published.
- **Whole-web plagiarism** (C5 at 10). Copyleaks or similar, per-word pricing. Our in-run check covers the realistic failure mode
  (copying the pages the writer was shown); whole-web covers the one we cannot cause.
- **G13 — a CMS target.** Unchanged.
- **C9 at 10 — a validated score.** Surfer publishes ρ = 0.28 over a million SERP entries. We cannot publish a correlation without
  months of our own published-page outcomes (G17). Not buildable this quarter; buildable eventually, and worth saying so.
- **Markup AI as a bought component** ($249–$999/mo, and it ships an n8n node). Worth naming because it is the only
  block-before-publish product on the market — but its agents check style, terminology and attribution *presence*, not fact, so it
  would add brand-consistency checking to a gate that is already stricter than it on the thing that matters. **Recommendation: no.**

### (c) Deliberately not worth it

- **An AI-detection gate. No, and the evidence is now overwhelming.** EMNLP 2026 (135,389 document pairs, 13 detectors) found
  false-positive rates on genuine human text ranging **0.0% to 100.0%**; an ACM 2026 paper found **9–15%** of unmodified human
  originals flagged and **under 4%** of AI text still flagged after a cheap humanizer (>96% false-negative); and detector scores
  correlate with long words and academic vocabulary rather than authorship. Older work puts the mean false-positive rate on
  **non-native English** essays at 61.3%. A detector would be unreliable, trivially defeated, and discriminatory. The defensible
  version of this check is the one we already have: a banned-phrase list, a specificity floor and a critic — i.e. AI-*sounding*
  prose treated as a style defect, never as an authorship verdict.
- **Keyword density as a target.** Ahrefs says plainly that stuffing will not raise its score. Ours is a ceiling (a warning above
  2%), which is the right shape; nothing to add.
- **An absolute readability threshold as a gate.** The only two primary studies on readability and ranking (Portent, 5.8M pages;
  Ahrefs, 15,000 keywords) both report **no correlation** — and neither publishes a coefficient. Keep Flesch as a reported figure
  and a soft warning; never let it refuse a page.
- **Chasing a Content Score of 100.** Surfer's own FAQ tells customers not to.

---

## 6. What this pass built

Build section **68**, harness scenario **S78** (13 new assertions; harness **4583 passed, 0 failed**, from a 4569 baseline).
Files: `v5/code/Content_QA.js`, `v5/code/Originality_Check.js`, `build_v4.py` section 68, `harness/scenarios_v5.js` S78.

- **B3-1.** The source corpus (`srcText`) is built **once, in a new §2b above the money mask**, instead of twice in two different
  shapes; an amount is kept when a source cited **in that same sentence** states it — exactly §9b's rule — and the source is named in
  `sourced_amounts`, in the auto-fix line and in a new "Amounts kept" row of the Word report. A link target is full of full stops, so
  sentence boundaries are now taken on a shadow copy with link targets blanked: without that, the citation was being cut off the very
  sentence that needed it (found by the probe, not by reading).
- **B3-2.** A fine, penalty, threshold, levy, duty, violation or sanction is **never** our price, so a price verb can no longer erase
  it — it becomes `[Confirm: …]` and the reviewer sees the number. Every amount the mask does remove is reported with the sentence it
  came from, in `masked_amounts` and in the `placeholder_note` the owner already reads (R25's channel).
- **B3-3.** `Originality Check` re-decides `publishable`, `not_ready`, `quality_label`, `not_ready_reasons` and the nested `quality`
  object when it fails — "not ready to publish" with the reason when no round is left, "needs another editing round" when one is —
  and leaves the gate untouched when it passes.

What the mask does to the live penalties page after this: the three fines it masked under a correct `mof.gov.ae` citation are kept
with the source named, the unsourced cap is held as `[Confirm: …]` rather than destroyed, and only a genuinely invented price still
becomes `[Price]` — reported by value. **The page's refusal was largely an artefact of its own QA.**

---

## 7. The one change that would most improve the customer's outcome

**Stop destroying figures that the source we cited actually states** — that single defect turned a correctly researched, correctly
cited page into 43 `[Price]` tokens, pushed it over the placeholder limit, and had the system refuse its own good work; it is fixed
here, and it is the difference between a page the customer can publish and a draft they must rebuild by hand.

---

## 8. Sources opened for this section

- **Markup AI / Acrolinx** — [acrolinx.com](https://www.acrolinx.com/), [markup.ai](http://markup.ai/), [pricing](https://markup.ai/pricing), [agents](https://docs.markup.ai/agents.md), [Source Authority](https://docs.markup.ai/agents/source-authority.md), [Claims](https://docs.markup.ai/agents/generic-claims.md), [AI Voice](https://docs.markup.ai/agents/ai-voice-detector.md), [GitHub Action](https://docs.markup.ai/github-action), [n8n recipe](https://docs.markup.ai/recipes/n8n)
- **Surfer** — [what is Content Score](https://docs.surferseo.com/en/articles/5700317-what-is-content-score) (2026-10-01), [Content Score FAQ](https://docs.surferseo.com/en/articles/6109757-answering-your-most-frequent-content-score-questions), [Humanizer & AI Detector](https://docs.surferseo.com/en/articles/9396434-surfer-s-humanizer-and-ai-detector) (2026-10-10), [Content Score study](https://surferseo.com/blog/surfer-content-score-study), [pricing](https://surferseo.com/pricing/)
- **Clearscope** — [how grading works](https://www.clearscope.io/support/articles/how-does-clearscope-grade-your-content), [readability](https://www.clearscope.io/support/articles/how-does-the-readability-score-work), [editor guide](https://www.clearscope.io/support/getting-started-editor), [pricing](https://www.clearscope.io/pricing)
- **Semrush** — [KB 814 SEO Writing Assistant](https://www.semrush.com/kb/814-seo-writing-assistant); **Ahrefs** — [AI Content Helper](https://help.ahrefs.com/en/articles/9879434-about-the-new-ai-content-helper) (2026-09-03); **Frase** — [pricing](https://www.frase.io/pricing/); **Jasper** — [pricing](https://www.jasper.ai/pricing); **Writer** — [writer.com](https://writer.com); **MarketMuse** — [marketmuse.com](https://www.marketmuse.com/)
- **Fact-checking** — [Originality.ai fact & hallucination checker](https://originality.ai/fact-hallucination-checker), [its benchmark](https://originality.ai/blog/ai-fact-checking-accuracy) (2026-05-21, vendor-run), [pricing](https://originality.ai/pricing), [GPTZero hallucination check](https://gptzero.me/news/check-for-ai-hallucinations/) (2026-05-26)
- **Google** — [using generative AI content](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content) (2026-10-01), [creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) (2026-10-05), [spam policies](https://developers.google.com/search/docs/essentials/spam-policies) (2026-08-28), [2024 core update & spam policies](https://developers.google.com/search/blog/2024/03/core-update-spam-policies), [AI content, 2023](https://developers.google.com/search/blog/2023/02/google-search-and-ai-content), [AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) (2026-07-10)
- **AI detection** — [Park, Jeong & Kim, EMNLP 2026, arXiv 2608.26710](https://arxiv.org/abs/2608.26710) (135,389 pairs, 13 detectors, FPR 0.0–100.0%), [Karr Jr et al., arXiv 2608.11256](https://arxiv.org/abs/2608.11256) (v3 2026-10-13), [Pudasaini et al., arXiv 2603.23146](https://arxiv.org/abs/2603.23146), [background](https://en.wikipedia.org/wiki/Artificial_intelligence_content_detection), [GPTZero vs Copyleaks vs Originality](https://gptzero.me/news/gptzero-vs-copyleaks-vs-originality/) (competitor-run)
- **Readability and ranking** — [Portent, 5.8M pages](https://portent.com/blog/content/study-how-content-readability-affects-seo-and-rankings.htm), [Ahrefs, Flesch Reading Ease](https://ahrefs.com/blog/flesch-reading-ease/) — both 2021, no 2025–2026 replication found, and **neither publishes a coefficient**

**Not verified** (no page opened, or blocked, so nothing above rests on them): **Copyleaks** — every page returns HTTP 403 to an
automated fetch, so its accuracy figures are *not verified, inferred from* the GPTZero competitor benchmark; the **MarketMuse /
Siteimprove** acquisition; the **Acrolinx → Markup AI** rebrand date and funding (the rebrand itself **is** verified by fetch);
Writesonic; the **Grammarly → Superhuman** parent rebrand; Semrush ContentShake's folding into "Content Toolkit".

---

## 9. Proposed register rows

For `../system-review-2026-10-11/FIX_PLAN.md` §3.14 — the orchestrator moves these in; this agent edited no register.

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| B3-1 | **The money mask judged an amount against a narrower corpus than the figure check forty lines below it**, and ran first, rewriting the draft for good. A probe on the shipped node put three AED fines and "42%" in one sentence, every one of them verbatim in the cited `mof.gov.ae` text the run had fetched: the percentage survived, all seven currency amounts became `[Price]`. The delivered penalties page carries **43 × [Price]**, its own Fine column included, under a correct citation of the decision that states every fine — and those tokens are what put it over `PH_MAX` and had it refused | **High** (the system destroys verified figures, then refuses the page for carrying the holes it made) | `v5/code/Content_QA.js` §2b / §3 | build the source corpus once above the mask; keep an amount a source cited **in that sentence** states, naming the source; take sentence boundaries on a shadow copy with link targets blanked, so a full stop in a URL cannot cut the citation off its own sentence | fixed 2026-10-15 (build section 68, S78); not deployed |
| B3-2 | **A price verb decided a statutory subject.** The guard was `(big \|\| OTHER_WORDS) && !PRICE_WORDS` and `costs` is a price word, so "the penalty **costs** AED 5,000 per month" was erased as if it were our own pricing instead of being shown to the reviewer as `[Confirm: AED 5,000]`. `[Price]` carries no value, so the owner was told only that a `[Price]` was somewhere in the copy | **High** | `v5/code/Content_QA.js` §3 | a fine, penalty, threshold, levy, duty, violation or sanction always keeps its number as `[Confirm: …]`; every amount the mask does remove is reported with its sentence in `masked_amounts` and in the owner's `placeholder_note` | fixed 2026-10-15 (build section 68, S78); not deployed |
| B3-3 | **A gate that failed became a label.** `Originality Check` runs after `Content QA` has finalised the delivery gate and flipped only `passed`. On the last round a draft **100% identical to a competitor page** came out `publishable: true`, `not_ready: false`, `quality.label: "passed the quality check"` — the fields the `-DRAFT` file name, the package banner, `meta.json`, the callback and the app all read, while the Word report's own Originality row said EXCEEDED | **High** (a plagiarised page delivered as having passed; the exact inversion of the programme's bar) | `v5/code/Originality_Check.js` | re-decide `publishable`, `not_ready`, `quality_label`, the reasons and the nested `quality` object when the check fails; leave them untouched when it passes | fixed 2026-10-15 (build section 68, S78); not deployed |
| B3-4 | **The readability band is a constant.** `flesch >= 40 && avgSentence <= 22` scores 15 of 15 on every topic, while Ahrefs' own data puts mean FRE at 69.7 for food and 49.6 for engineering, and Semrush derives its target from the top-10 competitors. A single absolute band is wrong by construction | Medium | `Content_QA.js` §11 / §15 | compute the competitor pages' Flesch from the text `Analyze Competitor Pages` already holds and score the draft against that band, reported with its basis as coverage now is; keep it a warning, never a refusal | open — in reach, ~M, free |
| B3-5 | **The critic never reviews the edited draft.** It runs once, before the editor; round 2's `Content QA` has `critique === null`, so the critic's problems do not even enter round 2's warnings. The judgement half of the gate never sees the text that will actually be published, while Surfer and Clearscope re-score live after every edit | Medium | the content chain (`Critic` → `Parse Critique` → `Content QA`) | re-run the critic on the editor's output when a round was spent — the wiring is trivial, the cost (one Sonnet call per round, ≈ $0.02–0.05 a page) is the decision | open (owner: cost) |
| B3-6 | **Upfront intent alignment is computed only for AI-target pages.** `words_before_answer`, the question-heading count and fan-out coverage sit inside the `if (AT)` branch, so a page without an `ai_target` is never checked for whether it answers its own question early — which Surfer added to its Content Score on 2026-10-01 as half of the AI Search Score | Medium | `Content_QA.js` §14 (`ai_ready`) | lift the answer-position and question-heading checks out of the `ai_target` branch and apply them to every draft | open — in reach, ~S, free |
| B3-7 | **Nothing outside the engine can ask "is this page publishable?"** Markup AI exposes the gate as an API, an MCP and a GitHub Action whose commit status feeds branch protection, and recommends "no High severity issues" as the rule. Ours is reachable only by running a $0.80 content run | Low–Medium | the app / `build_api.py` | expose the deterministic half of the gate (everything but the Claude calls) as a read-only check over supplied markdown; overlaps area 12's read-API item | open — overlaps area 12 |
| B3-8 | **A refresh does not re-check the facts.** C3 at 10 asks for every claim "re-checked at refresh"; the figure check runs on the draft of a run, so a page rewritten through `existing_page_url` re-checks, but a page merely *refreshed* by the cadence's decay path is not re-verified against its own cited sources | Medium | the refresh path (area 4's cadence, `Content_QA` §9b) | on a refresh, re-fetch the cited sources and re-run §9b over the live page's figures; coordinate with area 4 | open (overlaps area 4) |
| B3-9 | **The content score has never been validated against an outcome.** Surfer publishes ρ = 0.28 over 1,000,000 SERP entries; ours is an unweighted sum of six sub-scores with a bar of 80 that nothing justifies | Medium, **data-blocked** | — | needs months of our own published-page outcomes (**G17**); until then, say in the report that the score is a construct, not a prediction | open (needs G17) |
| B3-10 | **No AI-content detection — and that is the decision, not an omission.** EMNLP 2026 (135,389 pairs, 13 detectors) reports false-positive rates of 0.0–100.0% on genuine human text; ACM 2026 reports 9–15% of unmodified human originals flagged and <4% of AI text flagged after a cheap humanizer; older work puts the mean FPR on non-native English at 61.3%. Surfer sells a detector and a humanizer in the same product | — | — | **deliberate no.** Keep the defensible form we already have — banned phrases, a specificity floor, the critic — i.e. AI-*sounding* prose as a style defect, never an authorship verdict, exactly as Markup AI's AI Voice agent frames it | closed — will not build |
| B3-11 | **The style guide has never run with real data.** G31 is built, injected into three prompts and checked in QA, but execution 554 carried `style_guide: null` and `style_notes: []`, so C17 cannot be scored from evidence | Medium, **owner-blocked** | — | **O1 / O2**: fill techand.ai's business profile and style guide | open (owner) |
| B3-12 | **Google's Search Console Generative AI performance report is not read.** Shipped June 2026, free, first-party — and Google's own AI optimization guide (2026-07-10) names it as the measurement to use while warning that "no third-party tool has access to our internal ranking or AI systems" | Medium | the Site Tracker / AI visibility chain | read the generative-AI performance report alongside the existing Search Console pull; overlaps areas 7 and 8 | open — overlaps areas 7 / 8 |
