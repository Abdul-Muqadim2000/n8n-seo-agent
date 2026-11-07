# KI FX-L: the engine fix round (2026-11-08, branch `ki/fxl`)

Work in progress. Section 1 is final (committed first so the app fixer FX-A can merge it); the rest follows with the fixes.

## 1. Contract constants (engine = source of truth; `app/shared/src/ki.ts` mirrors, `harness/fixtures/ki_parity.json` holds both)

| What | Rule | Where |
|---|---|---|
| Verdict words | `go` Go, `months` Takes a few months, `hard` **Hard for your website now** (the app's existing wording), `gated` Not for you, **new `unknown` Not judged yet** (tone neutral): no Win, or a Win read with an unknown Strength whose range crosses a verdict line. Never shown as Hard. | `KI_VERDICT_IDS` / `KI_VERDICTS` / `KI_VERDICT_TONE`, `kiVerdict` (missing Win -> `unknown`), fixture `verdicts` + case "Win not computed" |
| Gate reasons | `seo_ki_keywords.gate_reason` holds ONE code ('' when the row passes): `other_market`, `career`, `other_brand`, `government`, `portal`, `navigational`, `own_brand`, `off_topic`, `too_broad`, `empty`, `low_fit`, `avoid`. The engine's sentence goes to the NEW column `gate_detail` (ladder_common `KI_KW_COLS`, synced by `sync_tables.py`). The app maps each code to its own words. | `KI_GATE_REASON_IDS`, `KiGateReason`, `KI_GATE_FIELDS = { code: 'gate_reason', detail: 'gate_detail', pass_code: '' }`, `KiKeywordRow.gate_detail`; fixture `gate_reasons`, `gate_fields` |
| Current rows (supersede) | After every keyword-research run that wrote rows, the engine DELETES the site x market rows of `seo_ki_keywords` and `seo_ki_gaps` whose `run_id` is not this run's (a user's gap status is carried to the new row by keyword key, not gap_id). A reader also keeps only rows whose `run_id` equals the latest `seo_ki_runs` row of kind `keyword_research` with status `ok` or `partial` (safety net if a delete failed). No new column. | `KI_ROW_CURRENT`; fixture `row_current` |
| Striking distance | Search Console position 8-20 with >= 100 impressions in 28 days; >= 30 on a small site = a site whose own 28-day impressions total is under 5,000. The total is `seo_site_metrics.impressions` of the latest period (else the sum of the stored query rows of the newest period). The web must read `row.striking` (engine-computed) and use `kiIsStriking` only where no row exists. | `KI_STRIKING`, `kiIsStriking`; fixture `striking` |
| Basis words | `inferred` = "our reading of the results" (no model is called; "AI judgement" is gone). | `KI_BASIS`; fixture `basis_labels`; engine `KI.label`, `KIW.LABELS` |
| Cost rows | Claude 0 for `competitors` and `keyword_research` (the worker calls no model); search data unchanged ($0.35 / $0.90). | `cost.ts` COST_TABLE, `_cost_cal.js` EST |

For FX-A to map (app/server, app/web are theirs): every Record keyed by KiVerdict now needs `unknown`; the verdict component's tone for
`unknown`; gate reason words per code (read `gate_reason` as a code, show `gate_detail` only as the detail); filter keyword / gap reads by
`KI_ROW_CURRENT`; the web striking fallback (`web/src/lib/ki.ts kiStrikingOf`) to `kiIsStriking` with the site total; "Hard for your site
now" copy in guides / marketing (`shared/src/guides.ts`, `web/src/marketing/content/features.ts`, changelog) to "Hard for your website now".
