# Keyword intelligence programme (KI), started 2026-11-08

Owner's ask (2026-11-08): keyword selection is the weak point. We do not do real competitor analysis, nor research what people actually
search for to find a service. Make this the best in the market at enterprise grade: full R&D with several agents, evaluate the current
keyword system (much already exists: users give their own words and we tell them right or wrong, etc.), then implement engine + frontend.
Hard rules: no production user affected, no other function affected, everything works.

The owner shared two research notes and said they may be wrong: material only, not a spec. Condensed in `OWNER_MATERIAL.md`.

## Phases
1. R&D + audit (read-only, parallel agents): R1 engine keyword audit, R2 app keyword audit, R3 production output evaluation,
   R4 market leaders and methods, R5 DataForSEO capability probe (sandbox shapes, prices).
2. DESIGN.md (one design, owner decisions marked), CONTRACTS.md.
3. Build in waves (worktrees), behind a per-site flag, off/shadow/on pattern as AIR.
4. Independent reviews, fix round, browser pass, offline replay on production data.
5. Merge origin/main, node-diff production, backup, deploy (flag off first).

## Files
- `OWNER_MATERIAL.md` the owner's research, condensed
- `R1_ENGINE_AUDIT.md`, `R2_APP_AUDIT.md`, `R3_PROD_OUTPUTS.md`, `R4_MARKET.md`, `R5_DATAFORSEO.md`
- `DESIGN.md`, `CONTRACTS.md`, `fixes/*.md`, `REVIEW_*.md`, `RESUME.md`
