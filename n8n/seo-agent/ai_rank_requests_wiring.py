"""AIR (docs/ai-ranking-2026-11-05/DESIGN.md §2.I / §6.6, frozen in CONTRACTS.md §4): the requests AIR makes to outside services in the AI
Growth workflow (wave 2): DataForSEO LLM Mentions (monthly), fan-out results pages through the SERP cache, Bing Webmaster stats, Common Crawl
CDX, Brave Search. SerpApi Copilot was NOT approved (owner, 2026-11-06) and must not be built.

OWNER: package P5 (integrations). Called by P4's ai_rank_wiring.wire() between `Load Link Prospects (Rank)` (src) and `AI Rank Plan` (dst).
W0 skeleton: a straight link, so the plan runs with no outside reading (shadow wave 1 reads stored data only).

P5 replaces the body with: src -> AI Rank Requests (planner) -> per-integration IF / HTTP / gate nodes -> AI Rank Fetched -> dst.
Rules (CONTRACTS.md §4 + §6): paid DataForSEO calls through G.in200_gate with no node-level retry; free calls with retry_lint.RETRY;
nothing paid while the site is in shadow; `AI Rank Fetched` states `cost_usd` (the ledger settle reads it: measured =
'Growth Metrics|AI Rank Fetched'); no node calls generativelanguage.googleapis.com.
"""


def wire_requests(G, src, dst, pos):
    """G: the AI Growth `WF`; src: 'Load Link Prospects (Rank)'; dst: 'AI Rank Plan'; pos: [x, y] for the request nodes.
    W0 skeleton: one link, no request node."""
    G.link(src, dst)
