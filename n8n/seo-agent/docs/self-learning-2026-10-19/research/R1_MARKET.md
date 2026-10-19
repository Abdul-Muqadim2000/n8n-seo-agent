# R1 — What the market actually ships that learns from outcomes (research, 2026-10-19)

**Question.** Which leading SEO, content, AI-visibility and marketing platforms *actually* ship something that learns from outcomes or feedback in October 2026? For each:
- what learns, from which signal, per customer or global;
- how changes are shown, approved and undone;
- how a new customer is handled (cold start), and what guardrails exist;
- whether the claims are backed by evidence.

**Purpose.** Input for Alaventra's weekly per-client "self-learning" feature.

**Method.**
- Every claim comes from a page opened with WebFetch on 2026-10-19 (vendor help centres, developer docs and changelogs first, then vendor product pages and press releases).
- Research was split three ways and merged here:
  - enterprise SEO suites;
  - content and AI-visibility tools;
  - closed-loop systems outside SEO.
- Key claims from the delegated parts were spot-checked against the source before merging:
  - Frase Content Guard;
  - SearchPilot's "business not science" article;
  - Google Ads learning status;
  - Statsig CUPED.

**Tags used on every row.**
- **VERIFIED** — the behaviour is documented on an opened help, doc or changelog page.
- **MARKETING CLAIM** — on an opened page, but only as product marketing, a press release or a vendor-run study.
- **UNVERIFIED** — seen only in a search snippet or on a third-party page, or the page would not open.

**Pages that could not be read:**
- Jasper and Yext help centres (403);
- Meta Business Help Center (renders no body);
- help.salesforce.com (CSS error page) and developer.salesforce.com (403);
- the Botify 2025 agentic-workflows press release (403);
- the SplitSignal knowledge base (it now redirects to enterprise.semrush.com).

---

## 1. Headline findings

1. **No vendor ships, in its documentation, a per-customer loop where the outcomes of its own advice change what it recommends next for that customer.**
   - This holds for every SEO / content / AI-visibility vendor checked (Search Atlas, BrightEdge, seoClarity, Botify, Conductor, Semrush / Adobe, Ahrefs, Surfer, Clearscope, MarketMuse, Frase, Jasper, Writer, Profound, SearchPilot, Siteimprove, Yext, HubSpot).
   - "Learns" in their marketing means one of four things:
     - (a) static or manually edited context: brand voice, knowledge graphs, memories;
     - (b) global models tuned by the vendor;
     - (c) thumbs up/down sent to the product team or an admin log;
     - (d) outcome monitoring with no causal test.
2. **Causal measurement of an SEO change exists only as formal split tests on large page templates:**
   - SearchPilot: neural Bayesian counterfactual with credible intervals;
   - Botify PageWorkers: t-test, about 300 pages × 10 clicks a day, 30 days;
   - seoClarity Split Tester: method not named;
   - Semrush SplitSignal: counterfactual model; its documentation has now disappeared.
   
   None of these works for a typical small or mid client site.
3. **"Too small to tell" is said out loud by almost nobody in SEO.**
   - SearchPilot says "an inconclusive result is not a proof of no effect".
   - Botify labels results "Inconclusive".
   - Everyone else shows raw deltas, uplift percentages or "recovery timelines" with no sample size or interval.
   - Search Atlas tells customers a post-change dip is "completely normal" and not to roll back for 21–45 days.
4. **Outside SEO, the closed-loop leaders all publish:**
   - hard minimum-data floors before automation turns on;
   - a visible "Learning" status with the reason it was reset;
   - change history with undo;
   - randomised experiments or holdouts as the only proof of uplift.
   
   Examples: Google Ads, Meta, Optimizely, Statsig, Amazon Personalize.
   
   Even they stop short of proving, per customer, that their learning helped:
   - Google's experiment default is an 80% CI;
   - Meta's lift studies are gated behind a sales rep;
   - bandits are documented as giving "no statistical significance".
5. **The best shipped pieces to copy are scattered across vendors; nobody combines them:**
   - SearchPilot's honest statistics;
   - Frase's diff + confidence bar + "statistic edits always wait for a human";
   - Search Atlas's per-fix undeploy and batching;
   - Profound's graded tool approvals and version restore;
   - Intercom's weekly gap recommendations ranked by real demand, where a rejection is remembered;
   - Google's auto-apply queue, history and 30-day undo;
   - Statsig's eligibility gates and guardrails.

---

## 2. Enterprise SEO platforms

### 2.1 Search Atlas — OTTO SEO

| Question | Finding | Status |
|---|---|---|
| What acts | OTTO is installed with a pixel and deploys on-page fixes (titles, meta, headings, internal links, schema). The changes are rendered client-side, so they do not appear in the CMS. [help.searchatlas.com OTTO setup](https://help.searchatlas.com/en/articles/11880172-otto-setup-functionality-and-deployment) | VERIFIED (help index + article titles) |
| Default autonomy | Marketing page: OTTO "runs on autopilot and deploys optimizations on its own"; "Turn on approval mode to review each change". [searchatlas.com/otto-seo](https://searchatlas.com/otto-seo/) | MARKETING CLAIM (the help docs agree that approval is optional) |
| What "learns" | Marketing: OTTO "analyzes Google data, competitors, and behavior patterns to adjust strategies automatically". No help article describes a loop that changes OTTO's behaviour based on how its own past deployments performed. [searchatlas.com/otto-seo](https://searchatlas.com/otto-seo/) | MARKETING CLAIM; outcome learning UNVERIFIED |
| Score | The "Optimization Score" is a "live health indicator, not a progress tracker". It is recalculated from a weekly rescan, and fixed issues are flagged again if they come back. It is a checklist and health score, not an outcome score. [help: Optimization Score and Weekly Refresh](https://help.searchatlas.com/hc/searchatlas-help/articles/1786754473-understanding-otto-s-optimization-score-and-weekly-refresh) (updated 2026-09-30) | VERIFIED |
| Outcome reading | After bulk changes the help centre says a dip is "completely normal". It gives a timeline (days 1–7 volatile, 7–21 stabilising, "full recovery and improvement are typically visible" in days 21–45, investigate after 45) and tells users to check metrics weekly, not daily. It warns: "Rolling back optimizations during the volatility window is one of the most common reasons sites fail to recover." No statistics, no control group, no per-change attribution. [help: Metric Recovery After Bulk Changes](https://help.searchatlas.com/hc/searchatlas-help/articles/1786754398-otto-optimization-understanding-metric-recovery-after-bulk-changes) | VERIFIED |
| Change log / undo | There is a Deployed Fixes / Activity list with page, change type and timestamp, filterable. You can Undeploy one fix or a selected group ("Rolling back a fix only reverts that specific change"), and redeploy later. The help article notes there is no full audit export and no dedicated bulk-rollback control. [help: Manage, Find and Rollback](https://help.searchatlas.com/hc/searchatlas-help/articles/1786755072-manage-find-and-rollback-otto-seo-deployments) (updated 2026-09-30) | VERIFIED |
| Guardrails | Autopilot deploys "in grouped batches to protect site stability and allow incremental review" and to make it "easier to trace which change caused a problem". The batch size is "managed on the backend" and not shown to the user. [help: Autopilot Bulk Deployment Limits](https://help.searchatlas.com/hc/searchatlas-help/articles/1786754707-understanding-otto-autopilot-bulk-deployment-limits). Content Strategy can auto-publish content changes; "depending on your account configuration" you may be able to switch to manual. Reverting those changes is not documented ("type 'human teammate'"). [help: Control Auto-Deployed Content Strategy Changes](https://help.searchatlas.com/hc/searchatlas-help/articles/1786754489-control-auto_deployed-content-strategy-changes) | VERIFIED |
| Claims vs evidence | "99% reduction in manual SEO tasks", "100X faster", "30K+ websites" — no baseline, period or method. [searchatlas.com/otto-seo](https://searchatlas.com/otto-seo/) | MARKETING CLAIM |

**Takeaway:** Search Atlas has the most complete *undo* story in the category (per-fix undeploy, batching so a fault can be traced). It does not attribute outcomes to individual changes. The "recovery timeline" is guidance telling the customer to wait, with no per-site test behind it. This is the opposite of a learning loop: a fall is read as "normal" by default.

### 2.2 BrightEdge — Site Agents Suite (formerly Autopilot), Copilot, Agent Edge

| Question | Finding | Status |
|---|---|---|
| Product | The Autopilot product page now reads "BrightEdge Site Agents Suite … Previously Known as Autopilot". It has three agents: **Site Agent** (internal links, "builds and places those links automatically"), **Schema Agent** (JSON-LD, "generates and deploys that code automatically as pages change") and **Publishing Agent** (titles / meta / H1 into WordPress or Drupal; "A person confirms every change before it goes live"). [brightedge.com/products/autopilot](https://www.brightedge.com/products/autopilot) | VERIFIED (vendor page) |
| Learning | The only statement is "Machine learning and AI power that history" (ten years of automation). The page does not say what is learned, from which signal, or per site. Rollback and monitoring are not described. [same](https://www.brightedge.com/products/autopilot) | Learning UNVERIFIED |
| Outcome claims | "Improve keyword rankings" and "toward page one", with no data. The WordPress plugin claims "over 1,000 brands" and a "deep-learning engine" but documents no approval or rollback. [wordpress.org/plugins/brightedge-autopilot](https://wordpress.org/plugins/brightedge-autopilot) | MARKETING CLAIM |
| Agent Edge (2026-08) | Recognises AI-agent requests at the CDN and serves agent-formatted content, with a "continuous loop" of agent-activity reporting. Results are before/after case figures (Arm: about 90% smaller payload, "more than doubled" agent traffic; Bloomfire: +30% AI referrals) with no control and no baseline period. [martechcube 2026-08-27](https://www.martechcube.com/brightedge-launches-agent-edge-as-97-of-websites-lack-ai-readiness/) | MARKETING CLAIM |

**Takeaway:** BrightEdge automates actions (links, schema), gates only the visible text changes behind a person, and publishes no outcome attribution. Its "self-driving" claims come with no documented feedback signal.

### 2.3 seoClarity — ClarityAutomate, SEO Split Tester, ArcAI 3.0, Sia

| Question | Finding | Status |
|---|---|---|
| Split testing | The SEO Split Tester (part of ClarityAutomate, edge-deployed through a JS snippet, middleware or API) lets you "identify test and control groups, deploy the test, and analyze the results". It has "built-in statistical analysis and correlation models" (the method is not named), "roll back changes instantly", and access controls for who can publish and on which pages. [seoclarity.net SEO split testing tool](https://seoclarity.net/seo-automation/seo-split-testing-tool) | VERIFIED (vendor page); statistical method UNVERIFIED |
| Result reading | Blog: seoClarity "automatically analyzes the results and clearly shows you whether the test achieved positive or negative results". It mentions t-tests / chi-squared / ANOVA for manual work but does not say which one it uses. [seoClarity blog](https://www.seoclarity.net/blog/how-to-analyze-the-results-of-your-seo-split-tests) | UNVERIFIED (search summary; page not opened) |
| ArcAI 3.0 (2026-04-01) | "Deploys specialized agents to produce enterprise-ready content briefs and optimizations", prompt-research automation, a "human-in-the-loop foundation". There is no statement about measuring the effect of actions or about learning. [seoClarity news](https://www.seoclarity.net/resources/news/seoclarity-launches-arcai-3.0-to-reclaim-brand-narrative-in-ai-search) | VERIFIED (press release) |
| Sia | Generative assistant for titles, meta, outlines, bulk tagging and translation, guided by user-built "Content Profiles". It does not learn from outcomes. [kb.seoclarity.net Sia settings](https://kb.seoclarity.net/portal/en/kb/articles/sia-settings) | UNVERIFIED (from search summary only) |

### 2.4 Botify — Activation (PageWorkers), agentic workflows, Agentic Feeds

| Question | Finding | Status |
|---|---|---|
| Split testing | PageWorkers "randomly determines which pages to optimize vs. which to preserve as the control group". A test needs **about 300 pages of one template with ≥ 10 clicks a day**, and only one test can run per template. It analyses after **30 days** (extendable). Method: **Student's t-test** on daily average clicks per page. The **top 5% pages by clicks are excluded**. It checks group disparity before the start. Outcomes are labelled **Positive / Negative / Running / Inconclusive** ("No significant discrepancy exists between the control and variant groups"). [Botify KB: About PageWorkers Split Testing](https://support.botify.com/en/articles/9108760) (2024-03-27) | VERIFIED |
| Evaluating non-test changes | RealKeywords reports filter by optimisation scope (in vs out of scope), branded vs unbranded, keyword winners and losers. "They do not indicate whether the URLs have been optimized." There is no before/after statistic for non-test changes. [Botify KB: Evaluating PageWorkers optimizations](https://support.botify.com/en/articles/12618538-evaluating-pageworkers-optimizations) (2025-10-20) | VERIFIED |
| Monitoring | Real-time success rate of deployed optimisations over the last 24 h. [Botify KB: Monitoring PageWorkers](https://support.botify.com/en/articles/9108758-monitoring-pageworkers-optimizations) | UNVERIFIED (search summary) |
| Agents | 2025-02 "agentic workflows" for content optimisation (press release blocked, 403). 2026-03 **Agentic Feeds** (product feeds for shopping agents; tech preview, GA H2 2026). [businesswire 2026-03-23](https://www.businesswire.com/news/home/20260323764887/en) | UNVERIFIED (not opened) |

**Takeaway:** Botify publishes the most honest statistics in enterprise SEO testing. It states the minimum sample, the test, the window and an "Inconclusive" verdict, and it trims outliers. It uses that rigour only inside formal split tests on big templates (300+ pages), which a small client site cannot run.

### 2.5 Conductor — Writing Assistant, AgentStack (2026-04)

| Question | Finding | Status |
|---|---|---|
| "Training" | "Training your AI assistant" means **per-draft setup**: curate ≥ 7 comparison pages, edit the brief, upload Knowledge Sources, build Content Profiles (audience, voice, usage rules). Nothing in the docs says the system learns from feedback, edits or outcomes. Post-publish measurement is not described, and the AI Content Score is pre-publish. [conductor.com docs: workflows for new and existing content](https://www.conductor.com/docs/platform/learning-center/tutorials/platform-conductor-workflows-for-new-and-existing-content/) | VERIFIED |
| Human review | "Your team reviews and edits every draft before publishing." [support.conductor.com Writing Assistant](https://support.conductor.com/writing-assistant) | UNVERIFIED (search summary) |
| AgentStack | APIs, MCP server, apps in ChatGPT / Claude / Copilot, turnkey agents ("insight to published, optimised content in under three minutes"), board-ready decks, sentiment, crawler monitoring. Approvals, memory and outcome learning are not mentioned. [martechvibe 2026-04-21](https://martechvibe.com/article/conductor-unveils-agentstack-to-scale-aeo-in-ai-search) | VERIFIED (press coverage); "90% less reporting time" is a MARKETING CLAIM |

### 2.6 Semrush (Adobe since 2026-04) — Copilot, Enterprise AIO, SplitSignal, Adobe LLM Optimizer

| Question | Finding | Status |
|---|---|---|
| Ownership | Adobe completed the acquisition on 2026-04-28; Semrush sits in the "brand visibility" part of Adobe CX Enterprise. [news.adobe.com](https://news.adobe.com/news/2026/04/adobe-completes-semrush-acquisition) | UNVERIFIED (search summary; page not opened) |
| Copilot | Recommendations from six tools (Site Audit, Position Tracking, Backlinks, Organic Rankings, Keyword Gap, Backlink Gap), "tailored individually for each unique project". Thumbs up/down "will help our **product team** fine-tune Copilot's recommendations", so feedback is **global**, not per-customer learning. [Semrush blog 2024-03-19](https://www.semrush.com/blog/copilot-ai-seo-assistant/). The Copilot KB article (kb/1425) now redirects to a generic tools page, so its current status is UNVERIFIED. | VERIFIED (2024 blog) |
| Enterprise | "AI Optimization (AIO) … giving clear optimization actions"; "Adobe Brand Visibility" combines Semrush data with "Adobe's agentic optimization capabilities". Case figures (Picsart +124% impressions) without method. SplitSignal is not mentioned. [enterprise.semrush.com](https://enterprise.semrush.com/) | VERIFIED page; results MARKETING CLAIM |
| SplitSignal | Semrush's SEO split tester: cohort split on 100+ days of GSC history; needs 300+ templated pages and 100K sessions/month per test group (site > 500K sessions/month). [Semrush blog FAQ 2021](https://www.semrush.com/blog/top-faqs-for-seo-split-testing-with-splitsignal/). A search summary of KB 1148 describes a **Bayesian structural time-series counterfactual** with prediction-interval quality labels ("good / fair / poor"), but the KB pages now **redirect to enterprise.semrush.com**. | Method UNVERIFIED (KB removed); whether it is still sold UNVERIFIED |
| Adobe LLM Optimizer — Optimize at Edge | Side-by-side preview ("read-only simulation for review"), edit, deploy to the CDN for AI agents only. **Rollback** returns the AI-only version "within minutes". If the source page changes, it "pause[s] the optimization and flag[s] it for human review". Impact: only "Performance can be tracked in the Adobe Brand Visibility ecosystem"; no before/after, control or learning loop. Trial: one opportunity, 10 pages. [experienceleague.adobe.com](https://experienceleague.adobe.com/en/docs/llm-optimizer/using/resources/optimize-at-edge/overview) | VERIFIED |

### 2.7 Ahrefs — Brand Radar, AI Content Helper, Agent A / Letaido

| Question | Finding | Status |
|---|---|---|
| Brand Radar | Index of 481M+ prompts "modeled from real user searches" plus Custom Prompts checked daily. Metrics: mentions, citations, AI share of voice, estimated impressions. It recommends sources and fan-out content gaps. **It does not claim to measure the effect of your actions**, and it shows **no confidence intervals or sample-size caveats**. [ahrefs.com/brand-radar](https://ahrefs.com/brand-radar) | VERIFIED |
| AI Content Helper | Grades a draft against top-ranking pages (topical gaps), has an intent split and Ask AI. No outcome-based scoring, no learning, no post-publish tracking ("Content Inventory … Soon"). [ahrefs.com/ai-content-helper](https://www.ahrefs.com/ai-content-helper) | VERIFIED |
| Brand kits (beta) | Domain plus up to 3 example articles generate editable voice guidelines. The user can add "examples of content that performs well" by hand. Nothing is learned automatically from results or ratings. [help.ahrefs.com brand kits](https://help.ahrefs.com/en/articles/12927693-what-are-brand-kits-and-how-can-they-be-used) (2026-09-03) | VERIFIED |
| Agent A / Letaido (2026) | Scheduled cloud automations (for example monthly refresh of 5 data-driven posts → WordPress drafts → "Approve all"). Recommended practice: "Run it manually the first time", "Pick the level of trust you're comfortable with; you can loosen it later". One verify-after-act example: after a fix PR is merged, "a fresh crawl to confirm the issue was resolved". [ahrefs.com/blog/automated-seo](https://ahrefs.com/blog/automated-seo/) (2026-06-05). Letaido: "reusable brand memory and playbooks" for consistency of tone, and re-runs on errors; no claim of measuring the effect of its own work. [ahrefs.com/de/letaido](https://ahrefs.com/de/letaido) | VERIFIED |

### 2.8 Adjacent: AirOps (content refresh with measurement)

AirOps is included because it is the closest shipped "act, then measure" loop in content. Pages are picked for refresh by impressions, clicks and citation performance. The **diff view "shows what was added and why"**, every change is accepted, rejected or revised by a person, and a Campaign **Measurement tab "tracked publication dates and changes in impressions, citations, and other results"**. No baseline method or control group is described. [airops.com blog 2026-08-06](https://www.airops.com/blog/how-airops-uses-airops) — VERIFIED (vendor blog).

---

## 3. Content, AI-visibility and marketing platforms

### 3.1 Surfer

- **What learns:** nothing is documented.
  - The Content Score is computed from the current results page: terms that appear consistently across top pages; the score may not update if competitors come from fewer than 3 domains. [docs.surferseo.com content score](https://docs.surferseo.com/en/articles/5700365-how-to-use-content-score-inside-content-editor) — UNVERIFIED (snippet)
- **Evidence for the score:** one study run by Surfer itself, a Spearman ρ = 0.28 correlation over about 1M SERP entries.
  - It still calls the score "one of the strongest controllable signals", which reads a cause into a correlation. [surferseo.com study](https://surferseo.com/blog/surfer-content-score-study) — MARKETING CLAIM
- **Outcome tracking:**
  - With Search Console connected, Content Audit monitors position, traffic and impressions daily and alerts. [docs: connect GSC](https://docs.surferseo.com/en/articles/8985467-why-you-should-connect-your-gsc-to-surfer) — VERIFIED
  - The WordPress plugin imports the past 7 days every Monday and shows week-to-week gains.
  - **Gain alerts (≥ 2 positions, or not ranked → ranked) fire only for posts optimised in Surfer's editor.** Drop alerts cover every post. [docs: WordPress plugin GSC](https://docs.surferseo.com/en/articles/9071098-track-your-performance-with-the-wordpress-plugin-google-search-integration) — VERIFIED
  - This is the closest thing on the market to "content you optimised with us gained X". It has no control, no baseline model, no interval and no "too small to tell".

### 3.2 Clearscope

- **Content Decay:** last-90-day clicks compared with the same 90 days a year earlier, shown as a "seasonal difference" and "seasonal growth" with a sparkline. Negative values make a page a refresh candidate.
  - It has no thresholds and no test, and it does not check whether a refresh worked. [clearscope.io content decay](https://www.clearscope.io/support/content-decay) — VERIFIED
- **Notices:** orphaned-page notices (internal-link thresholds the user sets) and freshness notices (a month interval the user sets). [Clearscope March 2024 updates](https://www.clearscope.io/blog/march-2024-product-updates) — VERIFIED
- **"Protect":** 404 / indexing / decay / striking-distance alerts. No learning is described. [clearscope.io/product/protect](https://www.clearscope.io/product/protect) — MARKETING CLAIM

### 3.3 MarketMuse (owned by Siteimprove)

- **The only content scorer that personalises to the customer's own performance.**
  - **Topic Authority** (−100 to +100) is computed per site from coverage breadth and depth plus current and historical search performance.
  - **Personalized Difficulty** = Difficulty − Topic Authority.
  - The formula, the other factors and the refresh frequency are not published. [docs.marketmuse.com](https://docs.marketmuse.com/reference/personalized-difficulty-and-topic-authority/) — VERIFIED
- It is a per-site metric recalculated from data. It is not a feedback loop on its own recommendations.

### 3.4 Frase

- **Brand voice:** set by hand; "Refine the profile any time". [frase.io brand voice](https://www.frase.io/features/brand-voice.md) — VERIFIED (product page)
- **Content Guard:** the most complete monitor → diagnose → draft → approve loop among the content tools.
  - It "Tracks each guarded page against its Search Console performance and the results outranking it."
  - It drafts the fix as a diff; "Each change carries a confidence score."
  - **Approval:** "By default every drafted fix waits in your review queue". You can "auto-apply the low-risk edits above a confidence bar you set". **"Substantial changes and statistic edits always wait for a human."**
  - **Revert:** "Approve it, edit it, or revert it from one screen".
  - How the confidence score is computed is not documented. [frase.io content guard](https://www.frase.io/features/content-guard.md) — VERIFIED (re-checked 2026-10-19)
- **Decay trigger:** default −20% traffic over 8 weeks, adjustable per page priority.
  - Five diagnosed causes, including algorithm updates matched to known update dates.
  - Seasonality is acknowledged but not handled.
  - After the fix, only "Frase keeps watching". [frase.io blog 2026-03-23](https://www.frase.io/blog/content-decay-how-to-fix-ranking-drops-automatically) — MARKETING CLAIM

### 3.5 Jasper

- **Jasper IQ:** Marketing IQ "fine-tuned to proven best practices" (a fixed tuning) + Brand IQ + Product IQ + Knowledge Base, kept current by connectors.
  - "Does not use your data to train AI models". [jasper.ai/jasper-iq](https://www.jasper.ai/jasper-iq) — VERIFIED (product page)
- **Brand Voice:** built from up to 8 examples. [help.jasper.ai](https://help.jasper.ai/hc/en-us/articles/18618693085339-Brand-Voice) — UNVERIFIED (403)
- **"Memories":** no current documentation found. — UNVERIFIED
- **May 2026:** Grid History, a run log with status, user, test or production mode, and duration. [jasper.ai May 2026](https://jasper.ai/blog/may-2026-product-update) — VERIFIED
- **September 2026:** IQ **source tracking** (each Brand Voice / Style Guide page lists its sources with dates). Studio agents can be **tested and documented before a new version is activated**. [jasper.ai Sept 2026](https://www.jasper.ai/blog/september-2026-product-update) — VERIFIED
- **No learning from performance.**

### 3.6 Writer

- **Knowledge Graph:** graph RAG with inline citations, updated by hand or by connectors. No learning from usage. [dev.writer.com KG concepts](https://dev.writer.com/home/knowledge-graph-concepts.md) — VERIFIED
- **Agent observability:**
  - Usage, latency, tokens and spend.
  - Session logs are admin-only and opt-in, kept 7–180 days.
  - End users can **flag** responses. [dev.writer.com agent observability](https://dev.writer.com/home/agent-observability.md) — VERIFIED
- **Feedback:** thumbs up/down plus a comment, seen by admins with the prompt and output and exportable. **Nothing says it improves the agent.** [support.writer.com](https://support.writer.com/articles/1873730832-writer-agent-session-logs-and-user-feedback) — VERIFIED
- **Guardrails:** Bedrock / Azure content safety, run before, during or after the call; on a violation it blocks only. [dev.writer.com guardrails](https://dev.writer.com/home/guardrails.md) — VERIFIED
- **"Self-evolving" model:** a 2024 beta tested with two customers; no GA documentation found. [HFS Research](https://www.hfsresearch.com/research/self-learning-llm-costs-enterprise-ai/) — MARKETING CLAIM (second-hand)

### 3.7 Profound

- **Agents:**
  - Triggered by schedule, by app events, by a web monitor, or by a Profound metric crossing a threshold.
  - Each run shows its reasoning and tool calls, with run history and **version history with restore**. [docs.tryprofound.com agents](https://docs.tryprofound.com/agents/about) — VERIFIED
- **Approval levels:** "Allow once / Allow for this task / Always allow". Task-level grants do not carry over to triggered runs.
  - "Most teams start with a review step and automate publishing once they're confident."
  - Output varies because each run reasons from scratch. **No memory, no learning from results.** [docs.tryprofound.com agents FAQ](https://docs.tryprofound.com/agents/faq) — VERIFIED
- **Actions (2025-07):** measuring "the impact of individual content changes" and "experimentation tools" were announced as **future** work. [tryprofound.com introducing Actions](https://www.tryprofound.com/blog/introducing-actions) — VERIFIED (as not shipped then)
- **Watched Pages:** citation trend per page after an update.
  - "Patterns tend to be more meaningful over 7-30 day windows" is the only noise caveat. No method, significance or sample size. [tryprofound.com citations](https://www.tryprofound.com/features/answer-engine-insights/citations) — MARKETING CLAIM
- **Aim (2026-07):** a background agent that surfaces "the opportunities worth acting on". No impact measurement. [Profound changelog](https://product.tryprofound.com/changelog/profound-aim-pages-and-more) — VERIFIED

### 3.8 SearchPilot (the statistical benchmark)

- **Method:** a counterfactual forecast of the variant pages "if they had been left alone".
  - It is built from all pages' history plus the control pages after the change; "a similar Bayesian approach to Causal Impact", but neural.
  - Credible intervals are bootstrapped from many random shuffles.
  - "Smart bucketing" balances traffic, variability and seasonality. Outliers are removed or flagged for a person.
  - **Search Console rank and click data are rejected for verdicts** ("not reliable enough to generate statistical confidence correctly on most SEO tests"). [searchpilot.com how we analyse](https://www.searchpilot.com/resources/blog/how-searchpilot-analyses-test-data) — VERIFIED
- **Validation and display:**
  - Vendor figure: 5% false positives in A/A tests; the model is re-trained per test and checked against thousands of historical tests. — MARKETING CLAIM
  - A winner is called only when "even the bottom end of the credible interval is positive". — VERIFIED
  - **Ready To Test** checks before launch: "enough pages with enough traffic, and high enough correlation". — VERIFIED
  - **Advanced Analysis** estimates whether early results will last and how much longer to run. — VERIFIED
  - [searchpilot.com/data-analysts](https://www.searchpilot.com/data-analysts)
- **Crawl state:** Googlebot crawl data separates "a change that hasn't been seen by Google yet" from an inconclusive test. [searchpilot.com/for-seo-geeks](https://www.searchpilot.com/for-seo-geeks) — VERIFIED
- **Decision rules:**
  - "An inconclusive result is not a proof of no effect."
  - "The 95% threshold is in itself entirely arbitrary."
  - "default to deploy" cheap changes backed by strong hypotheses.
  - Quoting Lukas Vermeer: "deploy if you like, but don't claim you have learned something". [searchpilot.com business-not-science](https://www.searchpilot.com/resources/blog/business-not-science) (updated 2025-04-07) — VERIFIED (re-checked)
- **Intervals:** reported at a level chosen "based on commercial context", for example 90%, and broken down by page type, traffic tier and device. [SearchPilot maths post, updated 2026-10-05](https://www.searchpilot.com/resources/blog/the-math-behind-searchpilot-how-seo-a/b-testing-actually-works) — VERIFIED
- **Publishing practice:**
  - The case-study library tags results Winning / Negative / Inconclusive, so losses are published. [case studies](https://www.searchpilot.com/resources/case-studies)
  - Readers vote on a prediction before the result is revealed. [example](https://www.searchpilot.com/resources/case-studies/seo-split-test-lessons-confidence-messaging) — VERIFIED
- **Scale needed:** test page sets typically carry "over 1,000 organic sessions daily". [for-seo-geeks](https://www.searchpilot.com/for-seo-geeks) — VERIFIED
- **What learns:** a *global* model, refined over the customer base's test library. Learning is not per client.

### 3.9 Siteimprove

- **Spring '26:** a Content Writing & Optimization Agent, PDF and accessibility agents, and AEO share of voice. No measurement of the agents' impact, no learning, no approvals described. [siteimprove.com spring 2026](https://www.siteimprove.com/launch/spring-2026-release/) — MARKETING CLAIM
- **AEO insights (2026-04):** "Revenue attribution tied to AI visibility", with no method given. [siteimprove press](https://www.siteimprove.com/press/siteimprove-launches-advanced-aeo-insights-for-ai-visibility/) — MARKETING CLAIM

### 3.10 Yext (Scout, Action Center)

- **Scout:** "Recommends the actions most likely to improve your visibility" and handles "tracking what works". [yext.com/platform/scout](https://www.yext.com/platform/scout) — MARKETING CLAIM
- **Action rule** (help centre snippet only):
  - An action is created when a location's metric is more than 10% off a *local* competitor benchmark.
  - It resolves only when the location beats the benchmark on all related indicators.
  - It reappears if performance drops again.
  - A "What's driving these actions" drawer explains each one. [help.yext.com Scout Actions](https://help.yext.com/hc/en-us/articles/40926919045531-Scout-Actions) — UNVERIFIED (403)
- **Action Center (GA 2026-08):** governance for all Yext agents. Claims "+186% citations" with no method. [finviz / press](https://finviz.com/news/387393/yext-expands-agentic-capabilities-to-grow-ai-visibility-for-enterprise-brands-and-small-businesses) — MARKETING CLAIM

### 3.11 HubSpot Breeze

- **Assistant memory:**
  - It "Can remember important information about a user"; the user can view and delete memories (Breeze > More > Memories).
  - **Saved memories are cited as sources** when used.
  - Where thumbs feedback goes is not documented. [knowledge.hubspot.com breeze assistant](https://knowledge.hubspot.com/ai/use-breeze-assistant) — VERIFIED
- **Customer agent outcomes:**
  - Resolution counts only when no qualifying handoff follows within 72 h, so the current week lags. The docs warn: "Deflections do not always indicate resolution".
  - **Source Usage** ranks each knowledge source by usage × resolution rate (Top performer / Underperformer / Underutilized / Low impact).
  - Thumbs-down, rep flags and knowledge gaps become **coaching opportunities** that a person resolves or dismisses. No automatic learning. [knowledge.hubspot.com analyze customer agent](https://knowledge.hubspot.com/customer-agent/analyze-your-customer-agents-performance) — VERIFIED
- **Agent output review:** a "Needs approval" status; each run shows its trigger, status, credits, thinking steps and sources. [knowledge.hubspot.com review agent output](https://knowledge.hubspot.com/ai/review-agent-output) — VERIFIED
- **Predictive lead scoring:** the one real outcome-trained model. It is a "Blackbox machine learning" model; it is "not possible to know exactly how each input contributes". [knowledge.hubspot.com predictive scoring](https://knowledge.hubspot.com/articles/kcs_article/contacts/determine-likelihood-to-close-with-predictive-lead-scoring) — VERIFIED

---

## 4. Closed-loop systems outside SEO worth copying

### 4.1 Google Ads — Smart Bidding, Performance Max, recommendations

- **What learns:** per-account and per-campaign bidding models fitted on reported conversions, on top of global models. [answer 6268637](https://support.google.com/google-ads/answer/6268637) — VERIFIED
- **Hard data floors (cold start):** Target ROAS needs, for example, 15 conversions in 30 days on Search / Shopping, 50 in 35 days on Demand Gen, 30 in 30 days on Video Action. [answer 6268637](https://support.google.com/google-ads/answer/6268637) — VERIFIED
- **"Learning" status with its reason:**
  - Calibration takes "a few conversion cycles (1-2 typically)".
  - The status names its trigger: **New strategy / Setting change / Composition change / Ad group target change**.
  - "Our algorithms continue to learn even when the bidding status no longer shows 'Learning'." [answer 13020501](https://support.google.com/google-ads/answer/13020501) — VERIFIED (re-checked)
- **Performance Max:** run new campaigns at least 6 weeks; allow 1–2 weeks after significant changes; frequent edits "can reset the learning phase". [answer 11385582](https://support.google.com/google-ads/answer/11385582?hl=en) — VERIFIED
- **Human-supplied context:**
  - **Seasonality adjustments** for short known events (1–7 days ideal; not for more than 14 days). [answer 10369906](https://support.google.com/google-ads/answer/10369906) — VERIFIED
  - **Data exclusions** for broken tracking. Use them rarely and briefly, and "Don't remove data exclusions you've already applied". [answer 10370710](https://support.google.com/google-ads/answer/10370710?hl=en) — VERIFIED
- **Experiments (the only proof of uplift):**
  - Traffic split, 50% recommended, cookie- or search-based. "Apply" copies the winner into the campaign. [answer 6261395](https://support.google.com/google-ads/answer/6261395)
  - **80% confidence by default** (adjustable); run 2–3 weeks. [answer 6318747](https://support.google.com/google-ads/answer/6318747?hl=en)
  - PMax experiments come in three kinds: uplift, upgrade and optimization. They are offered only "when you have eligible campaigns … with enough conversions volume". [answer 12997711](https://support.google.com/google-ads/answer/12997711) — VERIFIED
- **Optimization score:** "an estimate of how well your account is set to perform", made of per-recommendation uplift estimates. In effect it measures *adoption of advice*, not performance. [answer 9061546](https://support.google.com/google-ads/answer/9061546) — VERIFIED
- **Auto-apply:**
  - Opt in per bundle or per recommendation type; eligibility is checked daily; a queue shows what will run.
  - **It never raises budgets**, and it can be turned off at any time.
  - A History tab shows when each type was enabled and how many times it applied this week, and a weekly e-mail summarises. [answer 10279006](https://support.google.com/google-ads/answer/10279006), [answer 10276359](https://support.google.com/google-ads/answer/10276359?hl=en) — VERIFIED
- **Change history:**
  - 2 years of history; **Undo for most changes within 30 days**.
  - Changes that cannot be reverted are marked "Changes can't be undone". [answer 2454137](https://support.google.com/google-ads/answer/2454137?hl=en) — VERIFIED

### 4.2 Meta Advantage+

- **API learning-stage object:**
  - LEARNING / SUCCESS / FAIL ("isn't generating enough results to exit the learning phase").
  - Conversions are counted "since the time of its last significant edit", and `last_sig_edit_ts` records it.
  - New *dynamic* learning-phase thresholds are set per ad set. [developers.facebook.com learning stage info](https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-learning-stage-info/) — VERIFIED
- **The "~50 optimization events in 7 days" rule** and the list of "significant edits": third-party sources only; the official page would not render. [portent.com](https://portent.com/blog/paid-social/everything-you-need-to-know-about-facebooks-learning-phase.htm) — UNVERIFIED
- **Conversion Lift:**
  - A randomised holdout.
  - The cells cannot be changed after the study starts.
  - Access is "currently limited. Please contact your Meta Representative". [developers.facebook.com lift studies](https://developers.facebook.com/docs/marketing-api/guides/lift-studies/) — VERIFIED

### 4.3 Optimizely

- **Stats Engine:**
  - False discovery rate control with a tiered Benjamini–Hochberg procedure. The primary metric is protected from the secondary metrics. [docs FDR](https://docs.optimizely.com/experimentation-strategy/docs/false-discovery-rate-control) — VERIFIED
  - Sequential: no fixed sample size is needed in advance. Run at least one business cycle (7 days); the default significance is 90%. [docs how long](https://docs.optimizely.com/experimentation-strategy/docs/how-long-to-run-an-experiment) — VERIFIED
  - Confidence intervals are hidden until minimum visitors and conversions are reached.
  - "Avoid repeatedly segmenting your results and looking for a segment that is significant". [docs significance](https://docs.optimizely.com/experimentation-strategy/docs/statistical-significance) — VERIFIED
- **Bandits:** "MAB optimizations do not generate statistical significance". They suit short, temporary experiences. [docs distribution methods](https://docs.optimizely.com/experimentation-strategy/docs/experimentation-distribution-methods) — VERIFIED
- **Contextual bandit:**
  - Explore / exploit is set by a slider (for example 10 / 90).
  - Only the primary metric is optimised.
  - The results page is "(Currently in development.)". [docs CMAB](https://docs.optimizely.com/feature-experimentation/docs/run-contextual-multi-armed-bandits) — VERIFIED
- **Agent Platform (formerly Opal):** a program-overview agent e-mails KPIs, winners and "key learnings" against a prior period, with no review step described. [docs agent](https://docs.optimizely.com/agent-platform/docs/experimentation-program-overview-agent) — VERIFIED

### 4.4 Statsig

- **CUPED (variance reduction):**
  - Applied only if "More than 100 units have pre-exposure values" and "More than 5% of units have pre-exposure values"; otherwise results are left unadjusted.
  - The pre-exposure window is the 7 days before each user's own exposure. [docs CUPED](https://docs.statsig.com/experiments/statistical-methods/methodologies/cuped) — VERIFIED (re-checked)
- **Sequential testing (mSPRT):**
  - The interval is drawn wider early and narrows as data comes in.
  - "Early decisions often produce underpowered lift estimates with high uncertainty." [docs sequential](https://docs.statsig.com/experiments/advanced-setup/sequential-testing) — VERIFIED
- **Decision framework:** one primary metric plus guardrails gives **Roll out / Discuss / Do not roll out**. It "highlights recommended actions but doesn't enforce them". [docs decision framework](https://docs.statsig.com/experiments/templates/decision-framework) — VERIFIED
- **Holdouts:** they measure "what all your launches together did". Size 1–2%, run 3–6 months. [docs holdouts](https://docs.statsig.com/holdouts) — VERIFIED
- **Autotune:**
  - A Bayesian bandit that optimises a single metric.
  - Needs 100+ samples, or 1,000+ for the contextual version.
  - To judge it, wrap it in an A/B test with a 50/50 or 90/10 holdback. [docs autotune](https://docs.statsig.com/autotune), [monitoring](https://docs.statsig.com/autotune/monitoring) — VERIFIED

### 4.5 Intercom Fin

- **Outcome definition:**
  - A resolution is counted when the customer confirms, or "exits the conversation without requesting further assistance (assumed resolution)".
  - Greetings, unanswered clarifying questions and handoffs do not count.
  - This is also the billing unit, which makes it a generous definition. [intercom help Fin resolutions](https://www.intercom.com/help/en/articles/8205718-fin-resolutions) — VERIFIED
- **CX Score:**
  - An ML score from 1 to 5 per conversation, from six named reasons, with "No hidden formula or weighting".
  - A per-conversation summary "explains why each score was given".
  - Benchmarks need at least 75 Fin conversations. [fin.ai CX score](https://fin.ai/help/en/articles/13975974-understand-customer-experience-at-scale-with-the-cx-score) — VERIFIED
- **How Fin improves:**
  - **Weekly** recommendations are mined from the conversations Fin could not answer: content, data and action gaps.
  - Impact is shown as "the number of related conversations" and the period they cover, and the list is sorted by it.
  - A person chooses Accept / Mark as done / Reject. A handled item "won't reappear again". [fin.ai optimize](https://fin.ai/help/en/articles/13975978-optimize-fin-instantly-with-the-help-of-ai) — VERIFIED
- **Tests before going live:**
  - Simulations judge procedures against success criteria the user defines.
  - Batch tests hold up to 50 questions.
  - **"Answer ratings in Batch test do not train Fin"**, so evaluation and training are kept apart. [intercom help simulations vs batch](https://www.intercom.com/help/en/articles/14077180-simulations-vs-batch-tests-vs-previews) — VERIFIED
- **No built-in A/B test of content changes:** improvement is not shown causally.

### 4.6 Salesforce Agentforce / Einstein

- **Testing Center:**
  - A sandbox that checks an agent's topic, actions and responses against ground truth, using LLM-as-judge evaluations.
  - Start with 10–20 scenarios and retest after every change to data, permissions, actions or prompts. [salesforce.com blog](https://www.salesforce.com/blog/agentforce-testing-center-usecase-blog/), [Trailhead](https://trailhead.salesforce.com/content/learn/modules/agentforce-testing-tools-and-strategies/refine-your-agents-using-a-five-step-testing-strategy) — VERIFIED (blog and Trailhead, not help docs)
- **Observability:** session-level tracing, quality scores and near-real-time alerts. "Continuous optimization loop" is promised, but no automated change is described. [salesforce.com observability](https://www.salesforce.com/agentforce/observability) — VERIFIED (product page)
- **Trust Layer:**
  - Prompts, responses and trust signals are logged in Data Cloud as an audit trail.
  - "Feedback can be used for improving prompt templates" — by people. [help.tableau.com Trust Layer](https://help.tableau.com/current/tableau/en-us/tableau_gai_einstein_trust_layer.htm) — VERIFIED

### 4.7 Amazon Personalize (minimum data and exploration)

- **Minimum data:** 1,000 interactions and 25 users with at least 2 interactions each before training. [AWS limits](https://docs.aws.amazon.com/personalize/latest/dg/limits.html) — VERIFIED
- **New data:** bulk data is used only after the next training; domain recommenders retrain weekly. [AWS new data](https://docs.aws.amazon.com/personalize/latest/dg/how-new-data-influences-recommendations.html) — VERIFIED
- **Exploration:** `explorationWeight` defaults to 0.3 ("At zero, no exploration occurs"). [AWS exploration](https://docs.aws.amazon.com/personalize/latest/dg/create-recommender-configure-exploration.html) — VERIFIED

---

## (a) Capabilities × vendors

**Legend:**
- **Y** = documented on an opened page.
- **P** = partial or limited (see the notes).
- **C** = marketing claim only.
- **—** = not found.
- **U** = seen only in a snippet; not verified.

| Capability | Search Atlas | BrightEdge | seoClarity | Botify | Conductor | Semrush/Adobe | Ahrefs | Surfer | Clearscope | MarketMuse | Frase | Jasper | Writer | Profound | SearchPilot | Siteimprove | Yext | HubSpot | Google Ads | Meta | Optimizely | Statsig | Intercom Fin | Agentforce |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Acts on the site / output automatically | Y | Y | Y (edge) | Y (edge) | P (agents → drafts) | Y (edge, AI only) | P (drafts) | — | — | — | P (opt-in auto-apply) | P | P | P (agents) | Y (tests) | C | C | P | Y | Y | Y | Y | Y | Y |
| Per-customer learning from *outcomes* changes future advice | C | C | — | — | — | — | — | — | — | P (Topic Authority metric) | — | — | — | — | — (global model) | — | U (local benchmarks) | P (lead scoring only) | Y (bidding) | Y (delivery) | P (bandits) | P (Autotune) | — | — |
| Explicit feedback (thumbs, flags) captured | — | — | — | — | — | Y (to product team) | — | — | — | — | — | — | Y (admin log) | — | — | — | — | Y (coaching queue) | — | — | — | — | Y | Y |
| Feedback turned into a queue a person works through | — | — | — | — | — | — | — | — | — | — | Y (review queue) | — | P (flagged) | — | — | — | U | Y | — | — | — | — | Y (weekly, rejection remembered) | P |
| Measures the effect of its own changes after the fact | P (recovery timeline) | C | P (split tests) | P (split tests / scope reports) | — | — | P (re-crawl verify) | P (gain alerts, editor-optimised posts only) | P (YoY decay) | — | C | — | — | P (watched pages) | Y (causal) | C | C | P | Y (experiments) | Y (lift, gated) | Y | Y | P (resolution rate) | P |
| Control group / counterfactual | — | — | Y (method unnamed) | Y (t-test) | — | U (SplitSignal) | — | — | — | — | — | — | — | — | Y | — | — | — | Y | Y | Y | Y | — | — |
| Interval / sample size shown | — | — | U | P (thresholds) | — | U | — | — | — | — | P (confidence score, method undisclosed) | — | — | P ("7-30 day windows") | Y | — | — | — | Y (80% default) | — | Y | Y | P (75-conversation floor) | — |
| "Inconclusive / too small to tell" as a verdict | — | — | — | Y | — | U | — | — | — | — | — | — | — | — | Y | — | — | — | Y (no significance) | Y (Learning limited, U) | Y | Y | — | — |
| Minimum-data floor before automation | — | — | — | Y (300 pages × 10 clicks) | — | U (300 pages) | — | — | — | — | — | — | — | — | Y (Ready To Test) | — | — | — | Y | Y | P | Y | Y | — |
| Visible "Learning" status + reset reasons | — | — | — | — | — | — | — | — | — | — | — | — | — | — | P (not crawled vs inconclusive) | — | — | — | Y | Y | — | — | — | — |
| Approval before going live | Y (optional) | P (Publishing Agent only) | Y | Y | Y (drafts) | P | Y | n/a | n/a | n/a | Y (default) | — | — | Y (graded) | Y | — | U | Y | Y (auto-apply opt-in) | — | — | Y | Y | — |
| Change log + per-change undo | Y | — | Y ("instantly") | — | — | Y (edge rollback) | — | — | — | — | Y (pre-ship) | P (Grid History) | P (logs) | Y (version restore) | Y | — | — | P | Y (30 days) | — | — | — | — | Y (audit trail) |
| Explanation per recommendation | — | — | — | — | — | P | — | — | — | — | Y (diff) | — | Y (citations) | Y (reasoning) | Y | — | U (driver drawer) | Y (sources, memories cited) | Y (uplift estimate) | — | — | — | Y (CX reasons) | Y (traces) |
| Guardrail metrics that block a rollout | — | — | — | — | — | — | — | — | — | — | Y (statistics edits always human) | — | Y (content safety) | — | P | — | — | — | Y (never raises budget) | — | Y (primary protected) | Y | — | Y (trust layer) |
| Pre-release test of a changed recipe/agent | — | — | — | Y (group disparity check) | — | Y (preview) | Y ("run manually first") | — | — | — | — | Y (test before activate) | — | — | Y | — | — | — | — | — | — | — | Y (simulations) | Y (Testing Center) |
| Seasonality / data-exclusion controls | — | — | — | — | — | U | — | — | P (YoY window) | — | — | — | — | — | Y (bucketing) | — | — | — | Y | — | — | — | — | — |
| Long-running holdout of "the system itself" | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | P (lift) | — | Y | — | — |

---

## (b) Gaps nobody fills that a small platform could own

1. **Per-client outcome ledger for the system's own advice.**
   - Every recommendation, page, fix, link and outreach angle the system produced would be one row: what was advised, when it shipped, what happened, against what control, with what interval.
   - It would answer "of the 23 things we did for you, 4 measurably helped, 1 hurt, 18 too early or too small to tell".
   - Surfer comes closest, with gain alerts on its editor-optimised posts only, and it has no control.
2. **Honest small-sample verdicts in an SEO product.**
   - Show N, the window and the interval, and refuse to call a result below a floor.
   - SearchPilot and Botify do this only for enterprise split tests on 300+ page templates. **No tool says "too small to tell" for a 50-page client site**, which is where the three real clients actually are.
3. **Learning per client, using the platform's own data as the starting estimate before the client has enough.**
   - Everyone else either learns globally (SearchPilot's model, Surfer's SERP scores) or not at all.
   - A per-client estimate that starts from the pooled estimate of all clients and moves toward the client's own data as it accumulates (partial pooling), shown as "using defaults until you have N pages", fills the cold-start gap honestly.
4. **Visible "what changed because of what we learned", with one-click undo of the *learned rule*, not just of a page change.**
   - Search Atlas undoes fixes; Google undoes account changes; Profound restores agent versions.
   - **Nobody shows or reverses a learned preference** ("we now write comparison pages first for you because 3 of 3 beat guides; undo").
5. **Separating "not seen by Google yet", "too early", "inconclusive" and "no effect".**
   - Only SearchPilot separates crawl state from a null result. Every monitoring tool collapses these into one delta.
6. **Seasonality and shock handling in outcome reading.**
   - Clearscope uses a raw YoY delta; Frase admits seasonality "can mimic decay"; Search Atlas tells users to wait 45 days.
   - Nobody in SEO offers Google-style "data exclusions" (a tracking outage, a core update week) or adjusts the expected baseline from control pages.
7. **Learning from the customer's edits and rejections.**
   - Every brand voice (Jasper, Frase, Ahrefs, Conductor, HubSpot) is edited by hand.
   - Nobody turns "the owner rewrote the intro every time" or "rejected this outreach angle 3 times" into a proposed rule, with the evidence shown and approval required.
8. **A pre-release replay for a changed recipe.**
   - Jasper tests agent versions before activation, and Agentforce and Intercom run simulations.
   - No SEO tool replays a learned change against the client's last briefs through its QA gates before it goes live.
9. **A holdout that measures the learning loop itself.**
   - Only Statsig (and Netflix-style holdbacks) does this. No SEO vendor can show that its "AI learning" beats its own defaults.
10. **Publishing losses.**
    - SearchPilot publishes negative and inconclusive tests. No SEO platform's client report lists the advice that *did not* work and what the system stopped doing because of it.

---

## (c) The 10 most important design lessons for Alaventra's self-learning feature

1. **Make every output a measurable unit with a pre-registered outcome and maturity window.**
   - For each page, fix, ladder rung, link or outreach angle, record at creation time:
     - the one primary metric (for example clicks or impressions to the target URL, rank band, AI citation);
     - the date it becomes judgeable: about 8 weeks after first being indexed for pages, 4 weeks for fixes, never at week 1.
   - Rationale: Google judges in conversion cycles; PMax wants 6 weeks; SearchPilot separates "not crawled yet" from inconclusive. *Weekly observation, slow judgement.*
2. **Always compare with a control, or say "can't tell".**
   - Use the client's untouched comparable pages as the counterfactual (the same idea as SearchPilot's and Botify's control groups and `seo_link_impact`).
   - Hold back roughly 10–20% of eligible items on the current recipe when a learned change applies (Statsig's 90/10).
   - With no valid control, the verdict is "can't tell", never "worked".
3. **Publish hard data floors per lever and show them.**
   - Copy Google's 15 conversions in 30 days, Statsig's CUPED gate (>100 units and >5%), Personalize's 1,000 interactions and Botify's 300 pages × 10 clicks: our learner needs a stated minimum before it adjusts a lever for a client.
   - For example: ≥ N matured units of that type, and an interval that excludes 0.
   - Below the floor, the client gets the pooled default, and the UI says "not enough of your own data yet: using the default (from M sites)".
4. **Use statistics that survive weekly peeking and many comparisons.**
   - Use sequential, always-valid intervals (Statsig's mSPRT, Optimizely's Stats Engine) or a fixed evaluation horizon.
   - Use one primary metric per lever, with false-discovery control across levers and clients (Optimizely's tiered Benjamini–Hochberg; we already Holm-correct AI alerts).
   - Never search segments for a winner.
   - Report credible or confidence intervals, and use "inconclusive ≠ no effect" wording (SearchPilot).
5. **Show a learning status with reasons, and define what resets it.**
   - Each learned preference shows LEARNING / LEARNED / NOT ENOUGH DATA / PAUSED, plus a trigger and a timestamp (Google's New / Setting / Composition change; Meta's `last_sig_edit_ts`).
   - Resets: site migration, CMS / host / domain change, owner goal or market change, a confirmed core-update window.
   - Let the owner, or the system with evidence, mark weeks as **data exclusions** (tracking outage, Search Console gap) and **seasonal events**. Use them rarely, keep the excluded data in reports but out of learning, and never remove an exclusion silently (Google's rules).
6. **Learned rules are visible, explained and reversible as rules.**
   - Every rule, for example "for this client comparison pages outperform guides", shows:
     - its evidence (which units, outcome, N, interval, control);
     - what it changes next week;
     - a toggle and an **undo** that restores the previous recipe, with a history.
   - This combines Search Atlas's per-fix undeploy, Profound's version restore, Google's 30-day undo with "can't be undone" stated, and Intercom's per-item "why" summaries.
   - Avoid an adoption-based "optimization score": Google's measures advice taken, not results.
7. **Auto-apply only by opt-in category, with a queue, a weekly summary and hard limits.**
   - Copy Google's model: per-category opt-in, a visible daily queue, a History tab, a weekly digest. Copy Frase's confidence bar for low-risk items.
   - Never auto-apply anything that **spends more** (Google: "never raises budgets") or **publishes externally** (outreach sends, live page publishing).
   - Never auto-apply **changes to figures or claims**: "statistic edits always wait for a human" (Frase).
   - Default to approval; "loosen it later" (Ahrefs, Profound).
8. **Guardrail metrics can block a learned change.**
   - A lever that wins its primary metric but hurts a guardrail goes to "Discuss" with the owner, never to auto-apply. Statsig's Roll out / Discuss / Do not roll out is the model.
   - Guardrails: site-wide clicks, index / crawl health, brand-query clicks, AI mention rate, outreach complaints, cost per page.
   - Batch deployments so a fault can be traced to its change (Search Atlas).
9. **Turn explicit signals into a human work queue first; learn from them second, with approval.**
   - Owner edits, rejections, thumbs and failed QA become weekly items ranked by evidence count (Intercom ranks by "related conversations"; HubSpot has coaching opportunities and source usage × resolution).
   - A rejected item does not come back.
   - Repeated patterns become a *proposed* rule the owner approves.
   - Keep evaluation data apart from training data ("ratings in Batch test do not train Fin").
10. **Prove the loop itself, replay before release, and publish the losses.**
    - Before a learned recipe change ships for a client, replay it against that client's last briefs through the existing QA gates, the way Jasper tests agent versions and Agentforce / Intercom run simulations.
    - Keep a small long-running platform holdout (Statsig: 1–2%, 3–6 months) on default recipes, so we can say whether learning beats defaults.
    - In every client report, list what worked, what did not, what was too small to tell, and what the system stopped doing. SearchPilot shows losses publicly; nobody in SEO puts them in a client report.
    - Every learner decision goes to an audit table with what was observed, the old and new value, the confidence, auto or approved, who approved, and a rollback pointer (Salesforce Trust Layer / Meta API learning state).
