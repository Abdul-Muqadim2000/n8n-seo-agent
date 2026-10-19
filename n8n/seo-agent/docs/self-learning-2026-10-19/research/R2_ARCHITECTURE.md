# R2 — Architecture for a per-client self-learning loop (memory, RAG, feedback learning)

Research for the self-learning product plan, 2026-10-19. Scope: what memory / retrieval / learning architecture Alaventra should use
for a weekly loop that grades its own past outputs against outcomes and client feedback, stores what it learned, and uses it in later
runs, on our real stack (n8n 2.41.4 on one GCP e2-medium with 4 GB, Postgres 17, Fastify + Drizzle app).

Source marks: **[V]** = opened and read in this session (the statement is from that page); **[U]** = third-party, vendor-authored,
contested, or not opened — treat as unverified. Repo facts are marked **[repo]** with the file.

---

## 0. Verdict in one page

1. **Do not start with RAG or a vector store.** The learning problem is ~80% *numbers* (did this kind of keyword reach the top 20 for
   this site? does this audit finding type get confirmed or rejected by this client? which pitch type gets replies?) and that is
   statistics, not retrieval. The other ~20% is a *small* amount of text per client (corrected facts, rules distilled from rejected
   drafts, two or three approved exemplars). Anthropic's own guidance: if the knowledge base is under ~200,000 tokens, skip RAG and put
   it all in the prompt (with prompt caching) [V] (anthropic.com/news/contextual-retrieval). One client's learnings will be a few
   thousand tokens for a long time.
2. **Retrieval earns its place in exactly two jobs, later (phase 3):** (a) *page/keyword similarity* — cannibalisation, "this site
   already has a page for that", near-duplicate AI-panel questions and briefs — which is the family behind R34/R35/R36 (literal
   query-to-page matching); (b) choosing exemplars once a client has more approved outputs than fit in a prompt (~>50). For both,
   **pgvector in the Postgres we already run** is the right tool; no new database.
3. **"Memory" should be a versioned, approved, per-tenant *policy pack*** (rules + fact corrections + calibrations + suppressions +
   exemplar ids), compiled by the app, published to n8n the way `seo_ladder_settings` already is, injected into prompts in a bounded
   block and into Code nodes as numbers, and **stamped on every output** (which pack version produced this). This is LangMem's
   "procedural + semantic memory, formed in the background" [V], made enterprise-safe.
4. **Learning math:** Beta-Binomial / Gamma-Poisson posteriors per tenant with **partial pooling toward a global prior** (cold start
   with few clients), Thompson sampling only where we really choose among options and get fast binary feedback (outreach pitch / subject
   variants), and **calibrated LLM-as-judge** for the outcomes that come too slowly (page quality). No automatic prompt rewriting in
   production; prompt optimisation is an *offline* engineering activity gated by the eval harness.
5. **Do not build:** Mem0 / Zep-Graphiti / Letta as a service, Qdrant / Weaviate / Pinecone, a local embedding server on this VM,
   n8n chat-memory nodes for this, a shared cross-tenant vector index, fine-tuning, embeddings in n8n Data Tables.

---

## 1. Agent / LLM memory architectures in 2026 — what works vs demos

### 1.1 The taxonomy (useful vocabulary, not a product choice)

| Type | What it holds | LangMem definition [V] | Our equivalent |
|---|---|---|---|
| **Semantic** | facts | "stores the essential facts and other information that ground an agent's responses"; as a *collection* (many records) or a *profile* (one document with a fixed schema) | business profile, site model, **fact corrections** ("we do not offer payroll", "founded 2019") |
| **Episodic** | past experiences | "preserves successful interactions as learning examples that guide future behavior" | approved pages / approved outreach drafts as exemplars; rejected drafts with the reason |
| **Procedural** | how to behave | system prompts / rules "refined over time through feedback" | per-client rules ("never use 'cheap'", "always cite the MoF source for VAT figures"), suppressions, calibrated thresholds |

LangMem also distinguishes **hot-path** writing (the agent writes memory during the task: immediate, adds latency, the agent decides)
from **background** writing (a separate LLM pass reviews finished work: no latency, higher recall, delayed) [V]
(langchain-ai.github.io/langmem/concepts/conceptual_guide). **Our loop is weekly and batch: background formation only.** No engine
run should write to memory on the hot path.

### 1.2 Reflection (Reflexion, Generative Agents)

- **Reflexion** (Shinn et al. 2023): agents "verbally reflect on task feedback signals" and store reflections in an episodic buffer
  used in the next trial; 91% pass@1 on HumanEval vs 80% for GPT-4 [V] (arxiv.org/abs/2303.11366). Important context: the feedback
  there is a *unit test* — a fast, exact, external signal. Reflection works when the grader is trustworthy; it amplifies a wrong grader.
- **Generative Agents** (Park et al. 2023): a memory stream scored by recency (exponential decay, factor 0.995) + importance (LLM-rated
  1–10) + relevance (cosine similarity), min-max normalised and summed with all weights 1; reflections generated when the summed
  importance of recent events exceeds 150 [V] (arxiv.org/html/2304.03442). This is a believability simulation, not a production
  pattern; the scoring idea (recency × importance × relevance) is reusable for *which learnings to keep in a bounded block*.
- **Lesson for us:** a reflection step is only as good as the outcome signal it reflects on. Our signals are slow (rankings move over
  weeks to months) and confounded (Google updates, seasonality, competitors). So reflection must be **evidence-bound**: an LLM may
  *phrase* a candidate rule only from a statistically supported pattern or an explicit client statement, and it cites the evidence rows.

### 1.3 Memory products

| Product | What it is | Evidence | Fit for us |
|---|---|---|---|
| **Mem0** | extract-and-update memory layer (vector, optional graph) | Paper: vs full-context, "91% lower p95 latency" and ">90% token cost" saving on LOCOMO; graph variant ~2% better than base [V] (arxiv.org/abs/2504.19413). Head-to-head numbers vs Zep are **disputed between the vendors** [U] (mem0.ai blog; developersdigest 2026) | Built for chat personalisation (user said X). Our memories are structured outcomes, not chat. Adds a service + sub-processor. **No.** |
| **Zep / Graphiti** | temporal knowledge graph memory | DMR 94.8% vs MemGPT 93.4%; up to 18.5% on LongMemEval [V] (arxiv.org/abs/2501.13956). Graphiti needs **Neo4j 5.26 or FalkorDB** (Kuzu deprecated), OpenAI by default, works best with structured-output models [V] (github.com/getzep/graphiti) | A graph DB on a 4 GB VM with ~0.7 GB headroom is not realistic; temporal facts we need ("ranked #8 on 2026-10-05") are already rows with dates. **No.** |
| **Letta (MemGPT)** | stateful agent server with self-editing memory blocks | Letta's own test: a plain **filesystem agent scored 74.0% on LoCoMo vs Mem0-graph 68.5%**, and Letta says current memory benchmarks "may not be very meaningful" — memory quality depends more on context management than on the retrieval mechanism [V] (letta.com/blog/benchmarking-ai-agent-memory) | We do not run long-lived chat agents; our runs are workflows. **No**, but its finding supports the "simple store + good context" approach. |
| **LangMem** | library: memory managers + prompt optimiser | Concepts above [V]; latency in Mem0's paper: LangMem search p50 17.99 s / p95 59.82 s [V via Mem0 paper excerpt in search; U as a fair comparison] | Python/LangGraph; we are JS/n8n. Borrow the concepts only. |
| **Anthropic memory tool** (`memory_20250818`) | client-side file store under `/memories` that Claude views/creates/edits; you implement storage; available on Claude 4+ models, no beta header needed; you must block path traversal; cap file sizes; expire stale files [V] (platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool) | Designed for long-running agents that manage their own notes. Letting the model edit a client's memory unsupervised is the opposite of what an auditable enterprise loop needs. **Not for the engine's runs.** Possibly useful later for an interactive "ask Alaventra" assistant, backed by the same approved pack (read-only). |

### 1.4 Anthropic's guidance that applies directly

- "Find the simplest solution possible, and only increase complexity when needed"; add complexity "only when it demonstrably improves
  outcomes"; frameworks "can hide prompts and responses" [V] (anthropic.com/research/building-effective-agents). The **evaluator-optimizer**
  pattern works "when there are clear evaluation criteria and when feedback measurably improves results" [V] — which is the test every
  learned change must pass.
- Context is "a finite resource with diminishing marginal returns"; aim for the smallest set of high-signal tokens; **structured
  note-taking** outside the context window; hybrid of pre-retrieval for speed plus just-in-time loading [V]
  (anthropic.com/engineering/effective-context-engineering-for-ai-agents). → A per-client learnings block with a hard token budget,
  ranked by evidence strength, beats "retrieve top-k chunks".

### 1.5 What works in production vs demos (synthesis)

Works: (1) **structured, typed memory** with a schema (profile-style) over free-text blobs; (2) **background** consolidation on a
schedule; (3) memory that is **small enough to read whole**; (4) **explicit provenance** and the ability to delete it; (5) memory
that changes *numbers and gates*, measured by evals. Demo-ware: self-editing agents with unbounded memory, graph memory for data that
is already relational, benchmark leadership claims (the leading vendors dispute each other's LoCoMo numbers [U]).

---

## 2. RAG / vector store choice for a small multi-tenant deployment

### 2.1 pgvector — the choice, when we need vectors

- **Version: 0.8.7** [V] (github.com/pgvector/pgvector). HNSW (better speed/recall, slower build, more memory, can be built on an empty
  table) and IVFFlat (needs data first) [V]. `halfvec` halves storage; HNSW over halfvec up to 4,000 dims [V].
- **Filtering pitfall:** with an approximate index the filter runs *after* the index scan — a filter matching 10% of rows with default
  `ef_search=40` returns ~4 rows [V]. 0.8.0+ has **iterative index scans** (`hnsw.iterative_scan = strict_order | relaxed_order`, stops at
  `hnsw.max_scan_tuples` 20,000) [V]. For selective filters, "an ordinary index on the filter column can give exact search"; for tenant
  isolation use **list partitioning or separate tables rather than a shared approximate index** [V].
- **Build memory:** builds are much faster when the graph fits `maintenance_work_mem`, but do not set it so high it exhausts the server;
  in Docker, `--shm-size` must be at least that large [V]. Our Postgres container: `mem_limit 448m`, `shared_buffers 96MB`,
  `maintenance_work_mem 48MB`, `shm_size 128m` [repo `deploy/gcp/compose.prod.yml`].
- **Our scale means no ANN index at first.** Example: 20 clients × 3,000 items × 512-dim halfvec (1 KB each) ≈ 60 MB total; one tenant's
  3,000 rows scanned exactly with a btree on `(company_id, site_id, kind)` is milliseconds. Exact search = perfect recall and perfect
  tenant filtering. Add HNSW (per-partition) only past ~50k rows per tenant. (Sizing is our estimate.)
- **Image change needed:** production runs `postgres:17-alpine` [repo], which does not ship pgvector. The official image
  `pgvector/pgvector` has `0.8.7-pg17`, `0.8.7-pg17-bookworm`, `0.8.7-pg17-trixie` tags (Debian-based; no alpine tag seen) [V]
  (hub.docker.com tags API). **Risk:** moving an existing data directory from an alpine (musl) image to a Debian (glibc) image can change
  text collation order, which silently corrupts text btree indexes until `REINDEX` [U — well-known Postgres hazard, not verified in this
  session]. Safer: a 10-line Dockerfile `FROM postgres:17-alpine` that compiles pgvector 0.8.7 (`make && make install`), so libc does not
  change; or switch images with a planned `REINDEX DATABASE` and the backup/restore scripts in `deploy/gcp/`.
- **Tenant isolation in Postgres:** RLS with `ENABLE ROW LEVEL SECURITY`; table owners bypass RLS unless `FORCE ROW LEVEL SECURITY`;
  superusers and `BYPASSRLS` roles always bypass; with no policy, default deny [V] (postgresql.org/docs/17/ddl-rowsecurity.html). The app
  has **no RLS today** (no `ROW LEVEL SECURITY` in `app/server/drizzle/*.sql`) [repo]; isolation is application-level. The learning
  tables are a good place to introduce RLS first (new tables, no legacy queries): app connects as a non-owner role, sets
  `SET LOCAL app.company_id = …` per transaction, policy `company_id = current_setting('app.company_id')::uuid`.

### 2.2 Alternatives (and why not)

- **Qdrant**: good multitenancy — one collection, payload `group_id`, `is_tenant: true` index (v1.11+), per-tenant HNSW via `payload_m=16,
  m=0`, tiered multitenancy v1.16+ [V] (qdrant.tech/documentation/guides/multiple-partitions). Excellent product; wrong for us: another
  stateful service, another backup, another RAM budget, and our data is relational already.
- **Weaviate / Pinecone / Milvus / Chroma**: same argument; Pinecone adds a US sub-processor for client content. n8n has nodes for all of
  them [V] — node availability is not a reason.
- **Hybrid search (BM25 + vector)**: in Postgres, the simple tier is built-in full-text search (`tsvector`) + pgvector fused with
  **Reciprocal Rank Fusion** (k≈60); the better-ranking tier is ParadeDB `pg_search` (true BM25 as an index type) [U — ParadeDB and
  third-party pages; versions differ] (paradedb.com/blog/hybrid-search-in-postgresql-the-missing-manual). For SEO similarity, lexical
  signal matters a lot (exact entity / product names), so **if** we retrieve, do FTS + vector + RRF; skip `pg_search` (another extension
  to build). Anthropic measured that contextual embeddings + contextual BM25 cut top-20 retrieval failures 5.7% → 2.9%, and adding a
  reranker → 1.9% [V] (anthropic.com/news/contextual-retrieval).
- **Reranking**: Voyage `rerank-2.5` $0.05/M tokens, `rerank-2.5-lite` $0.02/M, 200M free tokens [V] (docs.voyageai.com/docs/pricing);
  Cohere Rerank 3.5 ≈ $2 per 1,000 searches [U]. n8n's vector store nodes have a "Rerank Results" option needing a reranker node; the
  only reranker node listed is **Reranker Cohere** [V]. At our corpus sizes a reranker is unnecessary; reconsider only with a measured
  retrieval failure rate.

### 2.3 Embedding models and cost (2026)

| Model | Price / 1M tokens | Notes |
|---|---|---|
| Voyage `voyage-4-lite` | **$0.02** (200M free tokens) | 32k context; output dims 256/512/1024/2048 (Matryoshka); int8/binary outputs; `input_type` query/document [V] (docs.voyageai.com/docs/pricing, /docs/embeddings) |
| Voyage `voyage-4` | $0.06 (200M free) | same features [V]; Batch API −33% [V] |
| Voyage `voyage-4-large` | $0.12 (200M free) | [V] |
| OpenAI `text-embedding-3-small` / `-3-large` | $0.02 / $0.13 | no newer OpenAI embedding model listed [V] (developers.openai.com/api/docs/pricing) |
| Cohere Embed v4 | ≈ $0.12 | [U] third-party listings only |
| EmbeddingGemma 300M (open) | free, self-host | MTEB multilingual 61.15, English v2 69.67 (Google-reported); quantized said to run in < 200 MB RAM [U] (arxiv.org/pdf/2509.20354; third-party) |
| BGE-M3 (open, MIT) | free, self-host | 100+ languages, dense+sparse+multi-vector, ~560M params [U] |

**Volume estimate (ours):** 20 clients × (50 pages × 3k tokens + 2k short items × 50 tokens) ≈ 5M tokens initial, ~1M/month after
→ **$0.10 initial, $0.02/month on voyage-4-lite**, inside the free 200M tokens for years. Cost is irrelevant; the decision is
**sub-processor + data residency** (client page text leaves for Voyage/OpenAI) versus **RAM on our VM**.

**Local on the 4 GB VM?** Container limits today: caddy 96m + postgres 448m + n8n 1200m + runners 512m + app 384m + gotenberg 384m +
searxng 256m ≈ **3.28 GiB of 4 GB** [repo `compose.prod.yml`]. A quantized 300M model at ~200–400 MB plus an inference server is
*possible* but would squeeze n8n, which already needs its headroom for heavy runs (the compose notes 25–42 MB JSON serialised per heavy
run). **Recommendation: hosted API (`voyage-4-lite`, 512 dims, halfvec), called from the app server**; revisit local when the VM is
upsized or for an enterprise client that forbids the sub-processor. n8n has **no Voyage embeddings node** in its node list (it has
OpenAI, Cohere, Gemini, Vertex, Bedrock, Azure, Mistral, HuggingFace, Ollama — Ollama offers only all-minilm 384-d and
nomic-embed-text 768-d) [V] (docs.n8n.io/llms.txt, embeddingsollama page) — another reason to embed in the app, via HTTP.

### 2.4 What n8n 2.x supports natively, and why we mostly don't use it

- **Vector store root nodes:** PGVector, Qdrant, Pinecone, Supabase, Weaviate, Milvus, MongoDB Atlas, Redis, Chroma, Azure AI Search,
  Oracle, Zep, Simple (in-memory) [V] (docs.n8n.io/llms.txt). **PGVector node**: modes Get Many / Insert / Retrieve (as vector store for a
  chain) / Retrieve (as tool for an AI Agent); metadata filters are **AND-only**; optional collections table; custom id/vector/content/
  metadata column names; Rerank option; **no documented distance strategy or index configuration** [V]
  (docs.n8n.io/.../n8n-nodes-langchain.vectorstorepgvector).
- **Memory sub-nodes**: Simple Memory, Postgres / Redis / MongoDB Chat Memory, Motorhead, Xata, Zep, Chat Memory Manager — all
  **conversation history keyed by a session key** with a "context window length" in interactions [V]
  (docs.n8n.io/.../memorypostgreschat; how-memory-works). They are chat memory, not learning memory. **Do not use them for this.**
- **Data Tables**: total storage capped (default 200 MiB, ours raised to 1 GiB via `N8N_DATA_TABLES_MAX_SIZE_BYTES`) [V + repo];
  **no vector type**; a Code node cannot read Data Tables directly [V] (docs.n8n.io/build/work-with-data/data-tables.md). Data Tables are
  fine for the *published, compiled* policy pack (one small row per site); not for embeddings or the signal history.
- Why the app and not n8n for retrieval: the AND-only filter + no index control + no RLS means tenant isolation would rest on every
  workflow author remembering a metadata filter. One typed function in the app (`similar(companyId, siteId, kind, text)`) under RLS is
  safer and testable. n8n calls it over HTTP (the internal-API pattern already used).

---

## 3. Where retrieval genuinely helps in an SEO system — and where it is the wrong tool

### 3.1 Genuine uses (ranked by value for us)

1. **Cannibalisation / "already covered" check** — embed the site's page inventory (`seo_pages`: title + H1 + first 300 words) and every
   proposed keyword / brief / ladder rung / AI answer page; flag cosine above a calibrated threshold, **combined** with the SERP-overlap
   clustering we already run (B2-4: top-7 at 40%) and lexical match. This attacks the R34/R35/R36 family directly (a ladder blind to a
   live "AI Consulting" page; literal query-to-page matching). The threshold itself is *learned* (statistics, §4) from client
   confirmations ("yes, that's the same page" / "no, different intent").
2. **Near-duplicate detection inside our own outputs** — AI question panel at 3–500 questions (dedupe paraphrases before paying to ask
   them), outreach drafts (do not send a client's two prospects the same pitch), briefs across ladders (the "no overlap" safety rule).
3. **Exemplar selection** — few-shot from the client's **approved** pages / approved outreach for the same page type and intent. Under
   ~50 approved items per client, select by **metadata** (page type, language, recency, approval) — no vectors. Above that, kNN on the
   brief embedding.
4. **Prospect similarity as a scoring feature** — "this prospect resembles the 6 that replied" (kNN over prospect page embeddings), fed
   into the prospect score as *one feature with a measured weight*. Phase 4 at the earliest; needs reply volume.

### 3.2 Wrong tool — use deterministic injection or statistics

- **Corrected facts** ("we are not a payroll provider", "our VAT figure is from MoF 2026") must be applied **every time**; retrieval may
  miss them and the error recurs. → Write them into the business profile / `_claims.js` fact set (semantic memory, *profile* style), and
  the QA gate checks against them. Never "retrieve facts if similar".
- **Rules from rejected drafts** → distilled (LLM proposes, human approves) into a short rules list in the pack, always injected. Raw
  rejected drafts are evidence, not prompt content.
- **Brand voice** → the existing style guide (`seo_profiles.style_*`) + 2–3 approved exemplar paragraphs. Always injected.
- **Anything numeric** — keyword reach calibration, KD-to-outcome mapping, CTR curves, decay detection, reply rates, finding precision,
  AI mention rates, cost estimates. Vectors do not average, shrink, or produce intervals. This is §4. (We already do this well: Wilson
  intervals, Poisson decay tests, Holm-corrected alerts, "no winner under 30 sends".)
- **Time-ordered facts** (rank history, what changed after a Google update) → SQL over dated rows, not a temporal knowledge graph.

---

## 4. Learning-from-feedback patterns

### 4.1 Base unit: per-tenant Bayesian estimates with partial pooling

- **Why:** with few clients and few outcomes each, per-client estimates are noisy (no pooling overfits) and one global number ignores
  the client (complete pooling underfits). Hierarchical models let small groups "shrink towards the [global] average" while data-rich
  groups stay near their own estimate [V] (PyMC radon example, pymc.io multilevel_modeling).
- **Implementation (no MCMC needed):** empirical-Bayes **Beta-Binomial** for rates (reached top-20 within 12 weeks; finding confirmed;
  reply received; question mentions us) and **Gamma-Poisson** for counts. Global prior `Beta(α₀, β₀)` fitted (method of moments) from
  opted-in tenants per *bucket* (e.g., `kw.reach_top20 | reach_band | intent | lang`), scaled to a prior strength `m` (e.g. 10
  pseudo-observations); tenant posterior `Beta(α₀·m/(α₀+β₀) + s, β₀·m/(α₀+β₀) + f)`. Ships as ~60 lines of TypeScript; the interval comes
  free (Beta quantiles), which keeps our "no rate without its n and interval" invariant.
- **Time:** discount older observations (weight `γ^weeks`, γ≈0.97) so the posterior follows drift; freeze or down-weight windows around
  confirmed Google core updates (we keep `v5/data/seo_events.json` — and it must be correct; two invented updates were found 2026-10-15).
- **Delayed and censored outcomes:** an SEO outcome can take months (our assumption; the Google page we opened does not state a
  timeframe [V: absence]). Treat "not yet reached by week w" as *censored*, not failure: count a failure only after the window closes; use
  **leading indicators** with short windows (indexed in 14 days, first impressions in 28 days, entered top 50) as separate, faster
  metrics.

### 4.2 Choosing among options: Thompson sampling, where it fits

- Thompson sampling balances exploiting what is known against exploring to improve future performance, and is computationally cheap
  [V] (Russo et al., arxiv.org/abs/1707.02038). **Hierarchical Thompson sampling (HierTS)** treats multi-task / federated settings as
  tasks sharing a hierarchical prior; "the regret decreases with a more informative prior" [V] (Hong et al., arxiv.org/abs/2111.06929)
  — the formal version of "global prior shrunk per tenant".
- **Fits:** outreach pitch type / subject variant / follow-up timing (binary reply in days, dozens of sends a month per client); which
  opportunity source to spend the weekly 10 drafts on (journalist request vs resource page vs broken link). **Doesn't fit:** keyword
  choice (outcome too slow, too confounded, each keyword is a one-shot) — there, use posteriors to *rank and explain*, not to explore at
  random. Exploration in SEO costs a client a page.
- Guardrails: minimum n before any arm is shown as better (we already require 30 sends), floor/ceiling on traffic share per arm,
  owner-visible, and *suggest* not *auto-switch* for anything the client sees.

### 4.3 Preference learning from approve / edit / reject

- Capture every human decision with a **reason code** (closed list per artifact: "wrong fact", "off-brand tone", "wrong page type",
  "already covered", "too salesy", "not our market", "other: text") plus optional free text, and keep **(model output, human-edited
  output)** pairs. Edit distance is a cheap signal of how wrong a draft was.
- Use: (a) reason-code rates per tenant → Beta posteriors → which QA checks to tighten for that client; (b) LLM *reflection* proposes
  candidate rules from clustered reasons + edit pairs ("in 5 of 7 edits the client replaced 'solution' with the product name") → human
  approves → rule enters the pack; (c) approved outputs become exemplars. No reward models, no fine-tuning (DPO etc. need far more pairs
  than one client produces, and fine-tuning hosted Claude is not our lever).

### 4.4 Prompt optimisation from feedback (DSPy, TextGrad, OPRO) — offline only

- **OPRO**: an LLM proposes new candidate prompts from a meta-prompt holding previous candidates and their scores; best prompts beat
  human ones by up to 8% (GSM8K) and up to 50% (BBH) [V] (arxiv.org/abs/2309.03409). **TextGrad**: backpropagates natural-language
  feedback through a compound system; GPQA 51→55%, ~20% relative on LeetCode-Hard [V] (arxiv.org/abs/2406.07496). **DSPy**:
  BootstrapFewShot (demos), COPRO (instructions), **MIPROv2** (instructions + demos, Bayesian optimisation), SIMBA, **GEPA** (reflective
  prompt evolution with textual feedback), BootstrapFinetune; the docs say ~10 examples → BootstrapFewShot, 50+ → random search, and
  "200 examples or more to prevent overfitting" before MIPROv2 [V] (DSPy docs, raw GitHub optimizers.md).
- **Why automatic rewriting in production is risky for us:** (1) **data volume** — one client yields tens of graded pages, not 200; (2)
  **overfitting to the metric / judge** (the optimiser learns what the judge likes; Goodhart); (3) **cross-tenant regressions** — our
  prompts are shared by every client, so a rewrite tuned on one client's feedback changes everyone's output; (4) **non-reviewability** —
  SOC2 CC8.1 expects changes to be authorised, tested, approved and documented before production [U, AICPA wording via secondary
  sources]; (5) **our invariants** (lineage, gates, refusals) live partly in prompt text; an optimiser can delete a refusal clause
  that no metric rewards; (6) stack fit — DSPy/TextGrad are Python; our prompts are `v5/prompts/*.txt` built into n8n JSON.
- **Allowed use:** engineers run OPRO/GEPA-style search *offline* on the pooled, labelled eval set, and a winning prompt ships as an
  ordinary `v5/prompts` change through `build_v4.py` + harness + review. Per-client adaptation happens only through the bounded,
  approved learnings block — not by mutating the shared prompt.

### 4.5 LLM-as-judge, calibrated

- Strong LLM judges reach >80% agreement with human preferences (≈ human-human agreement) but show **position, verbosity and
  self-enhancement bias** [V] (Zheng et al., arxiv.org/abs/2306.05685). Validators need validating; users' criteria **drift** as they see
  outputs, so alignment is iterative [V] (Shankar et al., arxiv.org/abs/2404.12272).
- Anthropic's eval guidance: prefer **deterministic graders where possible**, model graders "closely calibrated with human experts",
  give the judge an "Unknown" exit, **one isolated judge per dimension**, start with **20–50 tasks from real failures**, regression evals
  should pass ~100%, and "reading transcripts is how you verify that your eval is measuring what actually matters" [V]
  (anthropic.com/engineering/demystifying-evals-for-ai-agents).
- **For us:** most grading is deterministic and already exists (Content QA counts, claims vs facts, publish check, link check, audit
  re-check on the live site). Use a judge only for what has no code check (helpfulness vs the brief, tone vs style guide), per
  dimension, with "unknown", on a **different model tier than the writer** where possible, and report **judge-vs-owner agreement
  (Cohen's κ) monthly** on a sampled set; a judge whose κ drops below a threshold stops counting as a learning signal.

### 4.6 Eval-driven development

- The harness (7,125 passing scenarios) and `ACCURACY_SET.md` (S49 fails the build under 95%) are already regression gates [repo
  CLAUDE.md]. Extend: **every policy pack version must pass a replay** — the tenant's frozen fixtures (last N briefs/findings) re-run with
  the new pack through the affected Code nodes (cheap, offline) and, for prompt-affecting learnings, a small sampled live replay with the
  judge; the pack activates only if no regression metric falls and its target metric improves or holds.

---

## 5. Enterprise requirements

| Requirement | Design |
|---|---|
| **Tenant isolation** | `company_id` + `site_id` NOT NULL on every learning row; RLS with `FORCE`, app connects as non-owner, `SET LOCAL app.company_id` per transaction [V PG docs]; vectors in the same RLS tables, exact search per tenant, never a shared ANN index without partitioning [V pgvector]. OWASP LLM08 names cross-tenant retrieval leakage, **embedding inversion** ("recover significant amounts of source information") and poisoning as the risks; mitigations: permission-aware stores, partitioning, source validation, "detailed immutable logs of retrieval activities" [V] (genai.owasp.org LLM08:2025). Embeddings are therefore as sensitive as the text. |
| **Opt-in global learning** | Only **numeric aggregates** cross tenants (counts per bucket → global Beta prior). Never text, exemplars, rules, URLs, keywords, or embeddings. A bucket feeds the global prior only with **≥ k = 5 contributing tenants and ≥ n = 30 observations** (k-anonymity style threshold); optional Laplace noise on counts later (differential privacy; NIST SP 800-226, March 2025, is the guide to evaluating DP claims [V] csrc.nist.gov/pubs/sp/800/226/final). Opt-in flag per company, default **off** for enterprise plans, on for self-serve only if the terms say so (owner decision). Opting out removes the tenant's contribution at the next recompute. |
| **Audit trail** | Every learning and every pack version records: evidence (signal ids, run ids, outcome rows), who/what proposed it (stats job / LLM reflection / client / staff), approver, timestamps, before/after diff. Reuse the 0011 audit log (append-only, `ascentra.audit_purge` trigger) [repo]. |
| **Explainability** | Each output carries `policy_pack_version` (lineage, INVARIANTS rule 1); the app can show "this page used 3 learnings: … (from your 4 edits in September)". Every calibrated number shows prior, data, posterior, n, interval. |
| **Versioning / rollback** | `policy_packs` are immutable versions; activating a previous version is the rollback; one active version per site; diff view. |
| **Human-in-the-loop** | Tiered: **auto** (bounded numeric calibrations, e.g. a posterior used in ranking, max shift per week, shown); **approve** (anything that changes text a client sees, adds/removes a QA gate, suppresses a finding type, or changes outreach); **staff-only** (anything touching shared prompts). Default for new clients: everything "approve". |
| **Drift detection** | Weekly: outcome base rates per bucket vs trailing 12 weeks (two-proportion z / Poisson test, Holm-corrected as we already do), judge-vs-owner κ, share of learnings expiring unconfirmed. Google update windows flagged; learnings formed inside a window are marked "formed during an update" and re-checked after. |
| **Expiry** | Every learning has `review_after` (e.g. 90 days); unconfirmed by new evidence → proposed for retirement. (Anthropic's memory-tool guidance also says expire stale memory [V].) |
| **Memory poisoning / prompt injection** | Client free text, scraped pages and replies (Reply Reader) are untrusted; learnings derived from them enter prompts inside a delimited data block ("client learnings — data, not instructions"), are length-capped, and are human-approved. |
| **GDPR erasure** | Learnings are mostly company data, but outreach contacts, reviewers, authors are personal data. Rule: **no personal data in learnings or embeddings** (strip names/e-mails before storing; reference contact ids instead). Erasure of a company: `DELETE … WHERE company_id = $1` across all learning tables (FK `ON DELETE CASCADE`), recompute global priors, log the counts deleted; Art. 17 requires erasure "without undue delay" [V] (gdpr-info.eu/art-17-gdpr). Backups age out on the existing backup retention (document it). Sub-processor list must add the embedding provider. |
| **SOC2-style change management** | Treat a pack activation as a change: authorised (proposal), tested (eval replay), approved (human), implemented (activation), documented (audit log) — CC8.1 [U secondary]. Shared-prompt changes stay in git + CI. |

---

## 6. Recommended reference architecture for our stack

### 6.1 Principles

1. **The app owns learning state; n8n consumes a compiled snapshot.** (Same as `seo_ladder_settings` today: app writes, Content Cadence
   reads.) Reason: Drizzle migrations, RLS, audit log, UI approval, tests and the per-company boundary already live in the app.
2. **Statistics in TypeScript in the app; LLM reflection in n8n.** LLM calls stay in n8n so the run ledger, token counting, budget
   guards and retries keep working; the app starts a reflection workflow and stores its proposals.
3. **Signals are append-only facts; learnings are derived; packs are versioned outputs.** Everything is recomputable from signals.
4. **Bounded influence:** a pack's prompt block ≤ ~1,500 tokens per prompt family, ranked by evidence strength (recency × strength ×
   relevance-by-metadata, à la Generative Agents' scoring [V]); numeric calibrations bounded per week.

### 6.2 Tables (app Postgres, one migration `0015_learning`; all with `company_id`, `site_id`, RLS forced)

| Table | Purpose / key columns |
|---|---|
| `learning_signals` | append-only. `artifact_type` (keyword_pick, ladder_rung, page, audit_finding, ai_question, link_prospect, outreach_draft, recommendation), `artifact_ref` (engine ids: ladder id, content-log id, finding id…), `signal_type` (outcome / feedback / judge / leading_indicator), `metric` (e.g. `reached_top20_12w`, `finding_confirmed`, `reply`), `value` numeric, `censored` bool, `reason_code`, `note` (PII-stripped), `source` (gsc, rank_tracker, reply_reader, user, judge, live_recheck), `observed_at`, `run_id`, `evidence` jsonb. Unique on (artifact_ref, metric, observed window) for idempotency. |
| `learning_stats` | materialised posterior per tenant × `metric_key` (bucketed): `s`, `f`, weighted counts, `prior_alpha/beta`, `post_mean`, `ci_lo/ci_hi`, `n`, `window_start`, `computed_at`, `stats_version`. |
| `global_priors` | per `metric_key`: `alpha`, `beta`, `tenants_n`, `n`, `computed_at`, `method`; **no company_id**; written only by the aggregation job from opted-in tenants meeting k/n thresholds. |
| `learnings` | candidate + active items. `kind` (rule, fact_correction, exemplar, suppression, calibration, threshold), `scope` (prompt family / Code node / page type / language), `text` (≤ 300 chars), `structured` jsonb, `evidence_refs`, `strength`, `proposed_by` (stats_job / reflection_run id / user id / staff), `status` (proposed → approved → active → retired / rejected), `approved_by/at`, `review_after`, `supersedes_id`. |
| `policy_packs` | immutable versions: `version`, `content` jsonb (compiled rules per prompt family, fact corrections, exemplar refs, calibrations, suppressions), `content_hash`, `status` (draft / evaluated / active / superseded / rolled_back), `eval_run_id`, `activated_by/at`. One active per site. |
| `learning_eval_runs` | pack id, eval-set version, metrics before/after, pass/fail, cost. |
| `content_embeddings` *(phase 3)* | `kind` (site_page, brief, keyword, ai_question, prospect, approved_output), `ref`, `text_hash`, `model`, `dim`, `embedding halfvec(512)`, `tsv tsvector`; btree `(company_id, site_id, kind)`; no HNSW until a tenant passes ~50k rows. |

Plus columns: `companies.global_learning_opt_in` (bool, default false), and in n8n Data Tables a single new table **`seo_policy_packs`**
(domain, version, content_json, hash) written by the app on activation — added through `ladder_common.py` + `sync_tables.py`.

### 6.3 Services and flows

```
Weekly (Sunday, app job LEARNING_JOBS; not Monday — avoid the Monday schedule window):
 1 Collect   app reads outcomes from n8n Data Tables via the public API it already uses for dashboards
             (seo_rank_history, seo_content_log, seo_audit_findings.checked, seo_ai_visibility / seo_ai_daily,
              seo_link_outreach, seo_link_impact, seo_listings) + app tables (approvals, edits, outreach replies)
             -> learning_signals (idempotent upserts; censoring rules; PII strip)
 2 Compute   TS stats module: per-tenant Beta/Gamma posteriors with global prior, decay, update-window flags
             -> learning_stats; aggregation job -> global_priors (opted-in, k>=5, n>=30)
 3 Propose   numeric: posteriors crossing a bound -> calibration / suppression candidates (auto-tier or approve-tier)
             text:    app POSTs clustered reasons + edit pairs to n8n "Learning Reflector" workflow (Claude Sonnet,
                      ledgered, budgeted) -> candidate rules with cited evidence ids -> learnings (status proposed)
 4 Review    app "What Alaventra learned" page per site: approve / edit / reject; staff queue for shared-prompt ideas
 5 Evaluate  compile draft pack -> replay eval (harness-style fixtures + sampled judge) -> learning_eval_runs
 6 Activate  pack active -> written to n8n seo_policy_packs (domain row) -> audit log entry
At run time (n8n):
   Normalize Input / a shared _policy_pack.js kit loads the domain's active pack (one Data Table get),
   - injects rules / fact corrections / exemplars into prompts as a delimited <client_learnings> block (prompt-cached),
   - exposes calibrations + suppressions to Code nodes (reach, finding filter, prospect score),
   - stamps policy_pack_version into every callback, ledger row and report (lineage).
```

**Signal capture first (UI):** a thumbs + reason-code control on every artifact the app shows (keyword verdict, ladder rung, page,
finding, AI question, prospect, outreach draft, recommendation). Without labels the loop learns nothing; this is the highest-value,
lowest-risk first step.

### 6.4 Phases

| Phase | Build | Acceptance |
|---|---|---|
| **P0 — capture (1–2 sessions)** | migration (signals, opt-in flag), reason-code UI on every artifact, weekly Collect job, outcome joins with censoring | signals for every artifact type on techand.ai; no behaviour change |
| **P1 — measure (1–2)** | stats module + global priors + read-only "What we learned" page (posteriors with n and intervals) | numbers reproducible from signals; unit tests on the math |
| **P2 — apply, gated (2–3)** | learnings + packs + Reflector workflow + approval UI + eval replay + `_policy_pack.js` + lineage stamp + harness scenarios + a lint that every prompt-family node reads the pack through the kit | a rejected-draft reason becomes an approved rule and the next page obeys it; rollback restores prior output; erasure test deletes everything for a company |
| **P3 — similarity (1–2)** | pgvector (alpine-compiled image), `content_embeddings`, app `similar()` with FTS + vector + RRF, cannibalisation check in ladder/keyword/cadence paths, panel dedupe | R34-style case caught on the 2026-10-15 fixtures; threshold learned from confirmations |
| **P4 — choose (later)** | Thompson sampling for outreach pitch/subject/timing with existing min-n rules; exemplar kNN when a client passes ~50 approved outputs | arms' posteriors visible; no auto-switch without owner setting |

### 6.5 What NOT to build (and why)

- **No memory product** (Mem0, Zep/Graphiti, Letta, LangMem): built for chat personalisation; Graphiti needs Neo4j/FalkorDB; vendor
  benchmark claims are disputed; adds a sub-processor and a service the 4 GB VM cannot host. Our memory is relational.
- **No separate vector DB** (Qdrant, Weaviate, Pinecone, Milvus, Chroma): pgvector in the existing Postgres covers our scale with
  exact search and RLS.
- **No vectors before P3, and no RAG for facts, rules or voice**: they must always apply; inject them deterministically.
- **No local embedding model on this VM** (≈ 0.7 GB headroom; n8n needs it). Hosted `voyage-4-lite` at ~$0.02/month.
- **No embeddings or signal history in n8n Data Tables** (no vector type, shared size cap, Code nodes cannot read them, no RLS).
- **No n8n AI Agent memory nodes** for learning (session chat history only).
- **No hot-path memory writes** from engine runs and **no model-edited memory** (Anthropic memory tool) for client learnings.
- **No automatic prompt rewriting in production, no per-tenant forks of shared prompts, no fine-tuning.** Offline prompt search →
  normal code change → harness.
- **No cross-tenant text/exemplar/embedding sharing**, ever; only thresholded numeric aggregates, opt-in.
- **No bandit on keyword selection** (outcomes too slow and confounded; exploration costs a client a page).
- **No unbounded learnings block** (cap tokens; expire; rank by evidence).

### 6.6 Open questions for the owner

1. Global learning: default opt-in for self-serve, opt-out for enterprise? (Needs a Terms clause.)
2. Embedding sub-processor (Voyage vs OpenAI) and data residency stance for EU/UAE clients.
3. Who reviews "approve"-tier learnings for managed clients — the client, Alaventra staff, or both?
4. Outcome windows per metric (e.g. top-20 within 12 weeks) — product promise vs statistical honesty.

---

## Sources

Opened this session [V]:
- Anthropic — Building effective agents: https://www.anthropic.com/research/building-effective-agents
- Anthropic — Effective context engineering for AI agents: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Anthropic — Memory tool docs: https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
- Anthropic — Contextual retrieval: https://www.anthropic.com/news/contextual-retrieval
- Anthropic — Demystifying evals for AI agents: https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- LangMem conceptual guide: https://langchain-ai.github.io/langmem/concepts/conceptual_guide/
- Mem0 paper: https://arxiv.org/abs/2504.19413
- Zep paper: https://arxiv.org/abs/2501.13956 ; Graphiti README: https://github.com/getzep/graphiti
- Letta, benchmarking agent memory: https://www.letta.com/blog/benchmarking-ai-agent-memory
- Reflexion: https://arxiv.org/abs/2303.11366 ; Generative Agents: https://arxiv.org/html/2304.03442
- pgvector README (v0.8.7): https://github.com/pgvector/pgvector ; Docker tags: https://hub.docker.com/v2/repositories/pgvector/pgvector/tags?page_size=50&name=pg17
- PostgreSQL 17 row security: https://www.postgresql.org/docs/17/ddl-rowsecurity.html
- Qdrant multitenancy: https://qdrant.tech/documentation/guides/multiple-partitions/
- Voyage pricing: https://docs.voyageai.com/docs/pricing ; Voyage embeddings: https://docs.voyageai.com/docs/embeddings
- OpenAI pricing: https://developers.openai.com/api/docs/pricing
- n8n docs index: https://docs.n8n.io/llms.txt ; PGVector node: https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.vectorstorepgvector/ ; Postgres Chat Memory: https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.memorypostgreschat/ ; How memory works: https://docs.n8n.io/build/integrate-ai/understand-ai-components/how-memory-works.md ; Data tables: https://docs.n8n.io/build/work-with-data/data-tables.md ; Embeddings Ollama: https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.embeddingsollama/
- Thompson sampling tutorial: https://arxiv.org/abs/1707.02038 ; Hierarchical Bayesian Bandits: https://arxiv.org/abs/2111.06929
- PyMC multilevel modeling: https://www.pymc.io/projects/examples/en/latest/generalized_linear_models/multilevel_modeling.html
- LLM-as-a-judge (MT-Bench): https://arxiv.org/abs/2306.05685 ; Who validates the validators: https://arxiv.org/abs/2404.12272
- DSPy optimizers: https://raw.githubusercontent.com/stanfordnlp/dspy/main/docs/docs/learn/optimization/optimizers.md
- OPRO: https://arxiv.org/abs/2309.03409 ; TextGrad: https://arxiv.org/abs/2406.07496
- OWASP LLM08:2025: https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/
- GDPR Art. 17: https://gdpr-info.eu/art-17-gdpr/ ; NIST SP 800-226: https://csrc.nist.gov/pubs/sp/800/226/final ; EDPB Opinion 28/2024 (landing page only): https://www.edpb.europa.eu/our-work-tools/our-documents/opinion-board-art-64/opinion-282024-certain-data-protection-aspects_en

Unverified / third-party [U]:
- Mem0 vs Zep LoCoMo figures and disputes: https://mem0.ai/blog/zep-vs-mem0-which-ai-memory-layer-should-you-choose ; https://www.developersdigest.tech/blog/best-ai-agent-memory-providers-2026
- ParadeDB hybrid search: https://paradedb.com/blog/hybrid-search-in-postgresql-the-missing-manual
- EmbeddingGemma: https://arxiv.org/pdf/2509.20354 (figures via search summary) ; BGE-M3 via https://wz-it.com/en/blog/best-embedding-models-german/
- Cohere Embed v4 / Rerank 3.5 prices: https://developer.puter.com/tutorials/cohere-api-pricing/
- SOC 2 CC8.1 wording: https://hicomply.com/soc-2/soc-2-controls-change-management-cc8 ; https://sprinto.com/blog/soc-2/change-management/
- musl→glibc collation / REINDEX hazard when changing the Postgres base image: general Postgres knowledge, not checked this session.
