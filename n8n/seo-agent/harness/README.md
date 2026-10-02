# SEO Agent — offline test harness

Runs every Code node of the workflow in a real Node.js runtime against realistic fixtures
(DataForSEO, Jina Reader, PageSpeed, LLM outputs) **without calling any paid API**.

```bash
# from n8n/seo-agent/harness — uses the Node runtime inside the running n8n container
docker cp . n8n-n8n-1:/tmp/harness && docker exec -u root n8n-n8n-1 chown -R node:node /tmp/harness
docker exec n8n-n8n-1 sh -c 'cd /tmp/harness && CODE_DIR=/tmp/harness/code_v4 OUT_DIR=/tmp/harness/out node scenarios_v5.js'
docker cp n8n-n8n-1:/tmp/harness/out ./sample-output   # generated .doc reports (HTML) for eyeballing
```

* `harness.js` — mini n8n executor: mocks `$input`, `$('Node')`, `$runIndex`, `$getWorkflowStaticData`.
* `fixtures.js` — response shapes for every external call; edit to reproduce a customer's site.
* `scenarios_v5.js` — all five product modes + edge cases (blocked site, empty SERP, truncated LLM output, apex→www redirect).
* `fixtures_live/` — real DataForSEO responses captured on 2026-10-02 (LLM engines, AI Overview / AI Mode, LLM Mentions, Backlinks, Content Analysis, Business Data; no account data); `fixtures_monitors.js` builds the monitor fixtures from them (S19-S21).
* Scenarios S0-S22 cover every mode, the trackers, the cadence, the E-E-A-T page types (S16-S18), the growth monitors (S19-S22) and the v4.6 reuse rules (editor gate, domain-age cache, rank deferral, trend / SERP reuse, monthly AI engines, quarterly link gap, change-aware audits): 514 node runs, 0 failed on 2026-10-02.
* `code_v4/` — the Code-node sources extracted from `workflows/SEO_Agent_v4.json` (regenerate with `python3 ../build_v4.py`; the API workflow comes from `python3 ../build_api.py`).

Add a scenario whenever you change a Code node; the run must end with `0 failed`.
