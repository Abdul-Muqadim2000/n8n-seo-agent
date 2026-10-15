# Area 9 — AI growth (getting named and cited: the *acting* half), against the best tool available in October 2026

**Pass run 2026-10-15** under `BENCHMARK_PROGRAM.md`. Score on the books: **6.5**
(`../system-review-2026-10-13/SCORECARD.md` §2.9), capped there by three things: the IndexNow key file missing (O6), *"nothing
submitted"*, and *"no win measured"*. What follows reads the code and the live runs of **2026-10-14** (exec **573 → 574**,
`RESULTS.md` §2.6), **2026-10-13** (exec **509 → 511**, `../system-review-2026-10-13/RESULTS.md` §2.5) and **2026-10-10**
(`AI_GROWTH_SPEC.md` §6) as "what we do", and the frozen `../system-review-2026-10-11/CRITERIA_technical_tracking_reporting_ai_links.md`
§4A (4A.7–4A.10) as the yardstick. The CRITERIA file is untouched.

Every competitor claim below carries a URL **opened in this pass** (listed in §8). Where a mechanism sits behind a paid seat it says
so instead of asserting it. *Measuring* AI visibility is area 8 and is not scored here.

---

## 0. Read this first — the area's problem is not a missing feature

Everything the brief listed as built is built, and I verified each in the generated workflow: AI readiness of the key pages, Bing
`SubmitUrlBatch` + crawl state, IndexNow, questions to win, earned media with drafts, Wikidata, the AI page of the week in the
Content Cadence, and **B-G2's gate** (`FITR.rungs` is in *Growth Plan*, with the set-aside list printed in the report). None of
them is broken.

What this pass found instead is **six claims the engine was making that its own data did not support** — the rule-1 and rule-4
classes, in the one area where they are hardest to see, because nobody can check an AI answer by looking at it:

1. The report told customers a Bing submission reaches **ChatGPT search**. OpenAI's own crawler documentation says
   OAI-SearchBot is what surfaces pages in ChatGPT search and **never mentions Bing**.
2. **"16 pages sent to Bing"** was the headline of a week's work (2026-10-10), **2** in exec 574, **0** in exec 511 — and no run
   has ever reported whether a single one of them was crawled. A submission is a notification; IndexNow's own FAQ says so in
   those words.
3. **"12 key pages scored, average 77/100"** (exec 574) was measured with a Chrome User-Agent, and robots.txt was never read on
   this path. A page every AI fetcher is forbidden to touch could score 90 and be submitted on top of it.
4. A target became **won** because its question was absent from the latest run's gap list — one observation, which also happens
   when the question was **not asked at all** — and a stored `won` row **stayed won for ever**, even while the gap list said the
   question was lost again.
5. The Content Cadence marks a target **`writing`** and stamps `written_at` when it *starts* a page run; nothing ever sets
   `written`, and nothing writes the row back if the run is refused. That is R1's class in the one table R1 did not cover.
6. Refreshes were ranked by age and by our own readiness score — never by **citation decay**, which is what the leaders rank them
   by and which we already hold the data for.

All six are fixed in this pass (§6). None of them needed a new data source or a cent.

---

## 1. The leader today

**The rubric names Profound Actions / AthenaHQ. Both companies are alive and still the right comparison — but "Profound Actions"
as a product name is two generations old.**

| Tool | What it is in October 2026 | Verified |
|---|---|---|
| **Profound** | *Actions* (10 Jul 2025) was a **brief generator**. The 2026 product is **Aim**, launched 2 Jul 2026 — "an always-on background agent" that turns signals into Projects and routes them to **Agents** (Research, Content Optimization, Content Creation, Reporting & Monitoring, Automation, **Outreach & Distribution**), with an **AI Marketer** that "identifies the work worth doing, drafts it, and pings you for approval". Around it: Answer Engine Insights, Prompt Volumes, **Shopping** (SKU-level ChatGPT Shopping), **Agent Analytics** (how bots view and cite your pages), **FactCheck**, Sentiment, Context Manager | [Actions](https://www.tryprofound.com/blog/introducing-actions), [Aim launch](https://www.tryprofound.com/newsroom/profound-launches-aim-to-transform-ai-search-data-into-marketing-execution), [product page](https://www.tryprofound.com/) |
| **AthenaHQ** | "The command center for AEO and GEO": tracking across 11+ models, citation-source analysis, content-gap identification that "tells you exactly what to fix with on-page and off-page actions", PR alerts and press kits, Knowledge Base / claim review (Enterprise). An "Athena AI agent" and a "Content optimization agent" are **named but not explained**. The only publishing it documents is **through the customer's own CMS** (Shopify, Webflow, Framer). Essential free (300 credits), Starter **$295/month** (3,600 credits), Enterprise custom; "1 credit = 1 AI response" | [athenahq.ai](https://athenahq.ai/) |

**What they actually take as action** — mechanism, not promise:

- **Briefs and drafts, staged for a human.** Profound: Actions produced "AI-aligned topic suggestions, heading structures,
  secondary keywords, stats AI is already citing, and tone guidance", and the launch post states plainly **"We don't generate
  content for you."** A year later Aim does draft — and the release's one control sentence is that it routes work to agents
  *"while keeping marketers in control of every approval"*.
- **Rewrite what is losing citations.** Profound's AEO/SEO capability line: "Rewrites pages with declining citations and **stages
  them in the CMS**" — staged, not published.
- **Correct what the models get wrong.** Profound's PR line: "Traces inaccurate claims to publishers, **drafts corrections**, and
  tracks which were updated." Gartner's 2026 market guide (quoted in the frozen criteria) calls accuracy checks mandatory.
- **Publish only through the customer's own system.** AthenaHQ's single publishing path is a Shopify/Webflow/Framer connection.

**What they refuse to automate** — this is the part worth copying:

- Nobody claims to place a citation, buy a mention, or write on a third-party site. The ceiling everywhere is **draft → human
  approves → the customer's own channel**.
- Profound's own 2025 line ("We don't generate content for you") and the 2026 one ("every approval") are the same stance a year
  apart, through a funding round and a product rewrite.
- Google's spam policies say why this is not timidity: scaled content abuse is "many pages … generated for the primary purpose of
  manipulating search rankings", "**no matter how it's created**"; link spam includes "**using automated programs or services to
  create links to your site**"; and spam now explicitly covers attempts "to **manipulate generative AI responses in Google
  Search**". A tool that manufactured citations would be building its customers a penalty.

**One correction to the rubric's own text** (programme rule 1; the CRITERIA file is unchanged, the old statement kept beside the
new one):

- Old (4A, leaders): *"Profound Actions"*. New, 2026-10-15: Actions was a brief generator (10 Jul 2025); the acting product is
  **Aim + Agents + AI Marketer** (2 Jul 2026), and the approval gate is explicit in the launch release. Scoring against "Actions"
  understates the leader: it drafts and stages inside a CMS now.

---

## 2. What the leaders do that is mechanically different from us

| Mechanism | Them | Us (before this pass) |
|---|---|---|
| **Prioritised action queue** | Aim: "explains what changed, why it matters, and the business impact", then creates Projects with briefs and tasks | Ranked actions in the weekly report with a priority, the reason and an API body that writes the page |
| **Refresh by citation decay** | Profound rewrites "pages with declining citations" and stages them | Refresh when the page is older than 90 days or scores under 70 — **age and our own score, never decay** |
| **Accuracy / correction loop** | FactCheck + the PR agent: trace a wrong claim to the publisher, draft the correction, track which were updated | Area 8 counts `accuracy_issues`; **AI Growth takes no action on them at all** |
| **Crawler analytics** | Agent Analytics: how the bots actually view, cite and refer to your pages (server-side) | robots.txt rules + one homepage fetch per bot (area 8). No log data — the customer's host would have to send it |
| **Shopping / feeds** | SKU-level ChatGPT Shopping tracking | Nothing (our customers are service businesses; see §5c) |
| **Submission to the indexes** | **Neither leader does it.** Not in Profound's product list, not in AthenaHQ's | Bing `SubmitUrlBatch` + crawl state, IndexNow, Wikidata — still the thing we do that they do not |
| **The approval gate** | "pings you for approval", "staged in the CMS" | Nothing is sent or published here either: drafts are handed to the Link Builder and the app sends after approval (D12/L2) |

---

## 3. What we do, from the live evidence

| Mechanism | What the runs actually produced |
|---|---|
| **Key pages (readiness)** | Exec 511: 12 pages, average **78/100**; exec 574: 12 pages, average **77** ("was 78"); 2026-10-10: 12 pages scoring **52–90**. Scored on raw HTML with the site model's name and host |
| **Bing** | 2026-10-10: **16 pages submitted** (2 never crawled); exec 511: in the account, **"0 URLs to submit"**; exec 574: **2 submitted**. Bing's crawl state read per audited page (GetUrlInfo) |
| **IndexNow** | Key issued 2026-10-10; `key_missing` in both later runs — the file still 404s (O6). **Nothing has ever been sent through IndexNow** |
| **Questions to win** | Exec 511: 7 questions (5 queued, 1 mapped to the ladder keyword "one search, one page", 1 skipped); exec 574: **6 queued** |
| **Earned media** | Exec 511 and 574: **15 third-party pages AI cites without naming the owner**, **9 handed to the Link Builder** "(one writer)", `drafts_written: 0`; government sources get "apply … or cite it", not a pitch |
| **Entity** | Wikidata checked monthly; `found: false` both runs |
| **Wins** | **None. Not one target has ever been marked `won`**, and the scorecard caps 4A.9 at 6 for exactly that |
| **The loop end to end** | Target queued → the cadence writes the AI page of the week → the target is marked `writing` → … and there the chain stops: nothing sets `written`, and `won` was decided by a gap list |

**And what the owner could not tell from any of it:** whether the 16, 2 and 0 pages submitted over three weeks ever reached an
index; whether the pages scored 77/100 can be read by an assistant at all; and whether anything the loop has done has been won or
lost, because the only two outcomes it could print were "queued" and (never) "won".

---

## 4. The gap

| # | What the leader does | What we did | Does it change the customer's outcome? | Criterion |
|---|---|---|---|---|
| **G9-1** | Neither leader submits to an index at all | Bing + IndexNow + Wikidata — **but the report claimed the Bing submission reaches "ChatGPT search, Copilot"**, which OpenAI's own documentation does not support | **Yes.** A customer who believes a weekly Bing submission is how they get into ChatGPT will stop doing the thing that does work (being cited on third-party pages) | 4A.10 |
| **G9-2** | — (nobody submits, so nobody follows up) | 16 / 2 / 0 pages submitted across three weeks, **no run ever asked what became of them**, although `GetUrlInfo` is free and already called | **Yes.** It is the difference between "we did something" and "it worked", and it is the rule-4 bar in this area | 4A.10 |
| **G9-3** | Profound Agent Analytics reads how the bots really fetch the pages | Readiness measured with a **browser User-Agent**; robots.txt never consulted on this path | **Yes.** The whole score is an answer to "can an assistant read and quote this page", asked without checking whether an assistant may fetch it | 4A.8 / readiness |
| **G9-4** | Profound: pages with **declining citations** are the refresh queue | Refresh by age (90 days) and by our own score (< 70) | Yes — decay is the signal that the page *used to work*, and we store every weekly run's cited pages already | 4A.9 |
| **G9-5** | Aim "measures how completed work changes targeted metrics and refines later recommendations" | A win was one observation from a gap list, and once won it could never be lost | **Yes, and it is the one the scorecard already punishes** ("no win measured"). A win that cannot be lost is worse than no win | 4A.9 |
| **G9-6** | Profound FactCheck + PR: a wrong claim is traced to the publisher and a correction is drafted | Area 8 counts accuracy issues; **AI Growth does nothing with them**, although it already fetches the exact pages AI cited | Yes — Gartner calls accuracy checks mandatory, and a wrong claim about a business is the most expensive AI answer there is | 4A.5 → 4A.9 |
| **G9-7** | Bing's **AI Performance** report (public preview 11 Feb 2026) and its **Topics Portfolio** beta (13 Oct 2026) give a site its real Copilot citations, grounding queries and "opportunity queries where other sites appear but yours does not" — free, in the account we already read | We never mention it. The documented Bing Webmaster API has **no method that returns it** | Some. It is first-party citation data, better than our modelled question value — but it cannot be read by API, only by the owner | 4A.10 |
| **G9-8** | — | Our AI target state machine promises: `writing` is written when a run *starts*, `written` is never set by anything, and a refused run leaves the row claiming work in progress for ever | Yes — the R1 class, in the one table R1 did not cover | rule 4 |

### Where the leaders are weaker, and we are right

1. **We submit at all.** Neither Profound nor AthenaHQ has a Bing / IndexNow / Wikidata path. For a small site with no authority
   that is the cheapest thing that exists, and it is free.
2. **One writer, and nothing is sent.** Every earned-media prospect goes through the Link Builder's gates (no government portal,
   no competitor, no bare homepage, a real quote from their page), and the app sends only after a human approves. The leaders say
   "approval" in marketing copy; ours is enforced in the draft gate and proved in the harness.
3. **Refusals with reasons.** "Government site: you get on its lists by applying or being accredited, not by a pitch" is a better
   answer than a pitch, and nothing in either leader's documentation describes an equivalent.
4. **The gate on stored rows.** B-G2 made a stored ladder rung pass the fit gate before it can become a question to win.
5. **After this pass: a score that can be withheld, and a win that can be lost.** Neither vendor documents either.

---

## 5. What to build

### (a) In reach now

| # | Item | Size | Status |
|---|---|---|---|
| **a1** | **Say what a submission actually reaches**, in the sources' own words, and never call a notification an indexing | S | **Built** (§6, B9-1) |
| **a2** | **Follow every submission up**: ask Bing about each page submitted in the last 45 days that it has not crawled, and report how many it has *since* crawled | M | **Built** (§6, B9-2) |
| **a3** | **Read robots.txt before scoring or submitting**: no score when no AI fetcher may read the page, a capped score and the block as the first fix when some may not, "not checked" when robots.txt could not be read | M | **Built** (§6, B9-3) |
| **a4** | **A win measured on the answers** (≥ 2 of the last 8 days naming the business, the count printed), and a won question that is lost again goes back in the queue with an alert | M | **Built** (§6, B9-4) |
| **a5** | **Citation decay as a refresh signal**, from the weekly runs we already store | S | **Built** (§6, B9-5) |
| **a6** | **A `writing` row believed only against the page run that proves it** (read-path half) | S | **Built** (§6, B9-6) |
| **a7** | **The correction loop (G9-6)**: for every wrong claim area 8 records, name the third-party pages the answers cited, quote the claim and the true fact from the profile, and raise a correction target — drafted by the Link Builder's one writer, never sent | M | Register row **B9-7** |
| **a8** | **Fetch the key pages as the AI fetchers do** (G9-3's second half): robots.txt may allow what a CDN refuses. The AI Visibility Tracker already does this for the homepage; readiness needs it per key page | S–M | Register row **B9-8** |
| **a9** | **One robots kit**: `AI_Access.js` (area 8) and `Growth_Robots.js` now carry the same matcher. Two copies of a rule is how two answers start | S | Register row **B9-9** |
| **a10** | **Point the owner at Bing's AI Performance / Topics Portfolio** from the weekly report — free first-party Copilot citation data in the account we already read, which no API returns | S | Register row **B9-10** |

### (b) Needs money, an owner decision or data we do not have

| # | Item | Cost | Who decides |
|---|---|---|---|
| **b1** | **The IndexNow key file** (O6, open since 2026-10-10). Until it is uploaded, the whole IndexNow half is inert: a key was issued three times and nothing has ever been sent | $0, 5 minutes | Owner |
| **b2** | **The business profile** (O1/O2). Six outreach drafts are held on "[Your name]" and the AI fact check switched itself off | $0 | Owner |
| **b3** | **More AI pages a month.** `ai_pages_month` is 2 and the queue holds 6 questions: at today's rate the queue takes three months to clear. Each page ≈ $1.20 | ≈ $1.20 a page | Owner, per site |
| **b4** | **Crawler analytics from server logs** (G9-3 / Profound Agent Analytics). techand.ai is on Vercel: a log drain would give real AI-fetcher hits | hosting-side work | Owner |
| **b5** | **G16, the first live send.** Nine prospects are qualified and drafted and nothing has ever been sent to anyone | $0, a mailbox | Owner |

### (c) Deliberately not worth it

| # | Item | Why not |
|---|---|---|
| **c1** | **Writing pages "for AI" at volume** | Google's spam policies define scaled content abuse as many pages made mainly to manipulate rankings, "no matter how it's created", and now cover attempts "to manipulate generative AI responses in Google Search". The cadence's one page a week with a quality gate is the defensible shape |
| **c2** | **Anything that manufactures a citation or a mention** — self-ranking listicles, AI-only page versions at the CDN, prompt injection in page text | Recorded as refused in `AI_GROWTH_SPEC.md` §1 and still refused. Neither leader does it either; the ceiling everywhere is draft → human → the customer's own channel |
| **c3** | **Product-feed submission (ChatGPT Shopping)** | Profound tracks it at SKU level because its customers sell products. Ours are service businesses with no catalogue; the work is real and the audience is zero today. Revisit when a customer sells products |
| **c4** | **Scoring schema and llms.txt** | Unchanged from v4.12 and still right: schema ±2%, 97% of llms.txt files never fetched. They are reported at weight 0 |
| **c5** | **Our own "AI visibility index" across the market** | Area 8's territory, and the same argument as area 6's c1: an index on other people's prompts answers a question the owner did not ask |

---

## 6. What this pass built

**Build section 82, harness S92** (25 new assertions, 45 new harness results with the node runs; **5038 → 5083 passed, 0 failed**; build exit 0 with
`SEO_BUILD_ALLOW_DEFAULTS=1`, because a git worktree has no `n8n/.env`; **nothing deployed**). The AI Growth workflow goes from 98
to **102 nodes** — the four new ones are *Robots Requests (Growth)* → *Any Robots (Growth)?* → *Fetch Robots (Growth)* →
*Robots Verdicts (Growth)*, ahead of everything that scores or submits.

**B9-1 — what a submission reaches, in the sources' words.** "N page(s) sent to Bing (ChatGPT search, Copilot)" is gone from the
report, the node comments and the sticky, and the build fails if the phrase comes back. The report now says Bing's index is what
**Bing and Microsoft Copilot** answer from, that IndexNow notifies **Amazon, Bing, Naver, Seznam, Yandex and Yep — not Google**,
that **OpenAI documents OAI-SearchBot**, not Bing, for ChatGPT search, and that submitting "does not guarantee immediate
indexing" (IndexNow's own words). "Sent" is never dressed up as "indexed".

**B9-2 — a submission is followed up.** *Growth Plan* collects every page submitted in the last **45 days** that Bing has not
crawled (cap 15) and *Bing Growth Requests* asks `GetUrlInfo` about each one, each request carrying **why** it is being asked.
*Growth Metrics* then measures the outcome from Bing's own answer — submitted, **since crawled**, still waiting with how many days
each has waited, and how many were not asked about — and the report prints it with its lineage. With Bing off or the site outside
the account it is **not available with the reason**, never estimated from the submissions themselves (the build asserts that
refusal path). A page still uncrawled 30+ days after it was sent is re-sent; one sent 10 days ago is left alone.

**B9-3 — the readiness score answers the question it claims to.** `robots.txt` is read once per site (free, retried) and matched
per page by Google's documented rules — most specific group, longest rule, Allow wins a tie — for OAI-SearchBot, ChatGPT-User,
PerplexityBot, Claude-SearchBot, Googlebot and Bingbot. Closed to **all six**: **no score at all**, the rule quoted, a high alert
for a key page, and the page is sent to **neither** Bing nor IndexNow (the refusal is kept with its reason). Closed to **some**:
the score is capped at 60 and the block is the first thing to fix. The check is weight 0, so the 100 points still add up, and a
withheld score is out of the average rather than counted as a zero. A robots.txt answering 5xx is **"not checked"** — never
"allowed", never "blocked". **The gate is proved in the wiring, not only in the code**: the build walks `main` from the triggers
with *Robots Verdicts (Growth)* deleted and fails if *AI Readiness*, *Bing Submit Requests* or *IndexNow Requests* is still
reachable (R17's lesson; broken on purpose, it caught it).

**B9-4 — a win is measured, and a win can be lost.** A target is `won` only when at least **2 of the answers of the last 8 days**
(the weekly run and the daily pulse both write them) named the business; the count and the engines travel into the reason, the
report and the alert. One naming answer of two is "too few to call it won (at least 2 needed)". A question **nobody asked** is not
a win and not a dropped row — it waits with that reason, because absent-from-the-gap-list also covers not-asked. And a stored
`won` row whose question is lost again returns to the queue with both dates, the observation and a **medium alert**; the build
refuses the old expression that let `won` outlive the loss.

**B9-5 — decay.** A page cited in earlier weekly checks and in **neither of the last two** is raised as a refresh with the counts
and the date it was last cited, measured from the runs already stored. Under three stored runs, or with fewer than two earlier
sightings, it says nothing at all.

**B9-6 — `writing` is believed only against the page run that proves it.** A target marked `writing` by the cadence is matched to
its `seo_content_log` row by `request_id`; without a row that says written or published, after 14 days the question is queued again
with the reason and a medium alert. (The write-side release belongs to the Content Cadence — area 4 — and is registered.)

Files: `v5/code/Growth_Robots_Requests.js` (new), `v5/code/Growth_Robots.js` (new), `v5/code/Growth_Plan.js`,
`v5/code/AI_Readiness.js`, `v5/code/Growth_Bing_Requests.js`, `v5/code/Growth_Bing_Submit.js`,
`v5/code/Growth_IndexNow_Submit.js`, `v5/code/Growth_Metrics.js`, `v5/code/Growth_Report.js`, `build_monitors.py` (AI Growth nodes
and sticky only), `build_v4.py` section 82, `harness/scenarios_v5.js` S92 (and one S29 assertion that asserted the old,
one-observation win).

---

## 7. The one change that would most improve the customer's outcome

**Make the loop prove its own outcomes** — a submission followed through to a crawl, a readiness score that is withheld when no
assistant may read the page, and a win that is counted on the answers and can be lost again; because this area's whole value is
telling an owner whether the work is working, and until this pass every number it printed described what we *did*, not what
*happened*.

---

## 8. Sources opened for this section

- Profound — [Introducing Actions](https://www.tryprofound.com/blog/introducing-actions) (10 Jul 2025: briefs with headings, secondary keywords and "stats AI is already citing"; CMS integrations listed as planned; **"We don't generate content for you"**), [Profound launches Aim](https://www.tryprofound.com/newsroom/profound-launches-aim-to-transform-ai-search-data-into-marketing-execution) (2 Jul 2026: "an always-on background agent"; Projects with briefs and tasks; "while keeping marketers in control of every approval"), [product page](https://www.tryprofound.com/) (Answer Engine Insights, Prompt Volumes, Shopping, Agent Analytics, FactCheck, Sentiment, Benchmarking, Command Center, Context Manager; Agents by category incl. Outreach & Distribution; AI Marketer "identifies the work worth doing, drafts it, and pings you for approval"; "rewrites pages with declining citations and stages them in the CMS"; "traces inaccurate claims to publishers, drafts corrections, and tracks which were updated")
- AthenaHQ — [athenahq.ai](https://athenahq.ai/) ("the command center for AEO and GEO"; "tells you what to fix" with on-page and off-page actions; agents named but not explained; publishing only via Shopify/Webflow/Framer; Essential free / Starter $295 a month / Enterprise custom; "1 credit = 1 AI response")
- OpenAI — [Bots and crawlers](https://developers.openai.com/api/docs/bots) ("OAI-SearchBot is used to surface websites in search results in ChatGPT's search features"; opted-out sites "will not be shown in ChatGPT search answers … though can still appear as navigational links"; ~24 hours for a robots.txt change to take effect; **Bing is not mentioned anywhere on the page**)
- IndexNow — [FAQ](https://www.indexnow.org/faq) (Amazon, Bing, Naver, Seznam.cz, Yandex, Yep; "Submitting a URL does not guarantee immediate indexing"; each engine "makes its own decision about whether to index it"; no published rate limits; ≤ 10,000 URLs per request)
- Microsoft — [Bing Webmaster blog feed](https://blogs.bing.com/webmaster/feed) ("Introducing AI Performance in Bing Webmaster Tools Public Preview", 11 Feb 2026; "Introducing Topics Portfolio (Beta) in AI Performance", 13 Oct 2026), [Topics Portfolio](https://blogs.bing.com/webmaster/2026/10/introducing-topics-portfolio-beta-in-ai-performance/) (grounding queries clustered into topics; Topic Size, Sites Cited, Queries; **"Top Opportunity Queries"** where other sites appear and yours does not; 1/2/3-month windows; no API or export mentioned), [IWebmasterApi reference](https://learn.microsoft.com/en-us/dotnet/api/microsoft.bing.webmaster.api.interfaces.iwebmasterapi) (the documented method list — `SubmitUrlBatch`, `GetUrlInfo`, `GetUrlSubmissionQuota`, `GetCrawlIssues`, `GetFeeds` … — contains **no AI / citation method**)
- Google — [Spam policies for Google web search](https://developers.google.com/search/docs/essentials/spam-policies) (scaled content abuse: "many pages are generated for the primary purpose of manipulating search rankings", "no matter how it's created", "using generative AI tools or other similar tools to generate many pages without adding value for users"; link spam: "using automated programs or services to create links to your site"; spam includes attempts "to manipulate generative AI responses in Google Search")

**Not verified** (no page opened, or behind a paid seat — nothing above rests on them): Profound's pricing and funding; what Aim's
agents do once a customer approves them; whether AthenaHQ's two named agents execute anything; Bing AI Performance's exact metric
list (only the Topics Portfolio post and the feed were opened); and the widely repeated claim that ChatGPT search draws on Bing's
index — **no first-party source for it was found, and OpenAI's own crawler page does not say it**, which is why B9-1 no longer says
it either.

---

## 9. Proposed register rows

For `../system-review-2026-10-11/FIX_PLAN.md` §3.14 — the orchestrator moves these in; this agent edited no register.

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| B9-1 | **The weekly report told customers a Bing submission reaches ChatGPT search** ("N page(s) sent to Bing (ChatGPT search, Copilot)", in the report, two node comments and the sticky). OpenAI's own crawler documentation says OAI-SearchBot surfaces pages in ChatGPT search and never mentions Bing; IndexNow's FAQ says a submission "does not guarantee immediate indexing" and lists six engines, Google not among them | **High** (a claim a customer plans around, with no source behind it) | `v5/code/Growth_Report.js`, `Growth_Metrics.js`, `Growth_Plan.js`, `Growth_Bing_Submit.js`, `Growth_IndexNow_Submit.js`, `build_monitors.py` sticky | say Bing and Microsoft Copilot for Bing's index, list IndexNow's engines, quote the no-guarantee sentence, and never call a notification an indexing; the build fails if the phrase returns | fixed 2026-10-15 (build section 82, S92); not deployed |
| B9-2 | **No run ever asked what became of a submitted page.** 16 pages were sent on 2026-10-10, 2 in exec 574, 0 in exec 511, and `GetUrlInfo` — free, already called for the readiness rotation — was never asked about any of them. "Pages sent" was the headline of a week's work with no outcome behind it | **High** (INVARIANTS rule 4: nothing exists until it is delivered) | `v5/code/Growth_Plan.js`, `Growth_Bing_Requests.js`, `Growth_Metrics.js`, `Growth_Report.js` | a 45-day follow-up list; `GetUrlInfo` for each, carrying why; the report states submitted / since crawled / still waiting with days / not asked, or "not available" with the reason; the run row keeps it | fixed 2026-10-15 (build section 82, S92); not deployed |
| B9-3 | **"Can AI read and quote this page?" was answered by a browser.** The key pages were fetched with a Chrome User-Agent and robots.txt was never read on this path, so a page every AI fetcher is forbidden to touch could score 90/100 (exec 574's average of 77 was computed this way) and be submitted to Bing and IndexNow on top | **High** (the area's headline figure, measured without its main input) | `v5/code/Growth_Robots_Requests.js` + `Growth_Robots.js` (new), `AI_Readiness.js`, `Growth_Bing_Submit.js`, `Growth_IndexNow_Submit.js`, `Growth_Metrics.js`, `Growth_Report.js`, `build_monitors.py` | robots.txt read first and matched per page for the six answer fetchers; no score when all are blocked (the rule quoted, a high alert, no submission), capped at 60 when some are; unreadable robots.txt is "not checked"; the build proves the node is on the main path by deleting it | fixed 2026-10-15 (build section 82, S92); not deployed |
| B9-4 | **A win was one observation, and once won it could never be lost.** A target became `won` because its question was absent from the latest gap list — which also covers a question nobody asked — and a stored `won` row survived the question being lost again, because the status expression preferred the stored value. Not one win has ever been recorded, so no customer saw it; the next one would have been unfalsifiable | **High** (4A.9's own subject) | `v5/code/Growth_Plan.js`, `Growth_Metrics.js`, `Growth_Report.js` | a win needs ≥ 2 naming answers of the last 8 days (weekly + pulse), with the count and engines in the reason, the report and the alert; a question lost again returns to the queue with both dates and a medium alert; "not asked" is its own reason | fixed 2026-10-15 (build section 82, S92); not deployed |
| B9-5 | **The refresh queue had no decay in it.** Refreshes were chosen by age (90 days) and by our own readiness score, while the leader's queue is "pages with declining citations" — and every weekly run's cited pages are already stored | Medium | `v5/code/Growth_Plan.js`, `Growth_Metrics.js` | a page cited in earlier weekly checks and in neither of the last two is raised with the counts and the date it was last cited; silent under three stored runs | fixed 2026-10-15 (build section 82, S92); not deployed |
| B9-6 | **`writing` was a promise nobody kept.** The Content Cadence marks an AI target `writing` and stamps `written_at` when it *starts* a page run; nothing ever sets `written`; and a refused or failed run leaves the row claiming work in progress for ever, so the question is never queued again — R1's class in the one table R1 did not cover | Medium–High | read path: `v5/code/Growth_Plan.js`, `Growth_Metrics.js` (done). **Write path: `build_site_tracker.py` *Mark AI Target Writing* / the cadence's refusal branch — area 4, open** | the read path believes a `writing` row only against a `seo_content_log` row for the same `request_id` that says written or published; after 14 days without one the question is queued again with the reason and a medium alert | read half fixed 2026-10-15 (build section 82, S92); **write half open (area 4)** |
| B9-7 | **A wrong claim about the business triggers no action.** Area 8 records `accuracy_issues` and the perception data; AI Growth, which already fetches the exact third-party pages the answers cited, does nothing with them. Profound traces inaccurate claims to the publisher, drafts a correction and tracks which were updated; Gartner's 2026 guide calls accuracy checks mandatory | Medium–High | `v5/code/Growth_Plan.js` (read `seo_ai_visibility.perception_json`), `Earned_Media.js` | raise a correction target per wrong claim: the claim, the true fact from the profile, and the cited pages that carry it — drafted by the Link Builder's one writer, never sent, and nothing claimed that the facts on file do not carry | open — in reach, ~M |
| B9-8 | **Readiness still fetches as a browser.** robots.txt may allow what a CDN refuses: the AI Visibility Tracker compares a browser fetch with each AI fetcher on the **homepage only**, and the key pages of this workflow are never fetched that way | Medium | `build_monitors.py` (AI Growth), `AI_Readiness.js` | fetch each key page a second time as the answer fetchers (the site is the customer's own, and area 8 already does it for the homepage); a page that answers a browser and refuses the fetchers is a high finding, not a score | open — in reach, ~S–M |
| B9-9 | **Two copies of the robots.txt matcher** — `AI_Access.js` (area 8) and `Growth_Robots.js` (this pass; area 8's file was out of this agent's scope). Two copies of a rule is how two answers start | Low | `v5/code/_ai_access_kit.js` (new), both callers | one kit, inlined in both, with the parser, the group selection and the longest-rule match in a single place | open — in reach, ~S |
| B9-10 | **Bing's own AI citation data is never mentioned to the owner.** AI Performance (public preview 11 Feb 2026) and its Topics Portfolio beta (13 Oct 2026) give real Copilot citations, grounding queries and "opportunity queries where other sites appear but yours does not", free, in the Bing account we already read — and the documented Webmaster API returns none of it | Low–Medium | `v5/code/Growth_Report.js` | name the report and what it shows, beside our own modelled question list, with the honest line that no API returns it | open — in reach, ~S |
| B9-11 | **The IndexNow key file is still missing** (O6, open since 2026-10-10): a key has been issued three times and nothing has ever been sent through IndexNow | Medium | the owner's web server | upload `https://www.techand.ai/<key>.txt`; the app's "Check the file" verifies it in one click | open (owner) |
| B9-12 | **`ai_pages_month` is 2 against a queue of 6 questions**, so at today's rate the queue takes three months to clear; each page is ≈ $1.20 | Medium | `seo_monitors.ai_pages_month` per site | an owner decision per site, with the cost stated — not a code change | open (owner) |

