# Ascentra in-app design spec (D0, 2026-10-09) — for the page agents

Goal: every page answers in 5 seconds **how am I doing → what changed → what should I do next**, with more colour inside the
brand and **zero functional change**. Reference implementation: `app/web/src/pages/site/OverviewPage.tsx` (read it first).
Also read `app/web/CONVENTIONS.md` (tokens, brand, a11y, mobile rules still apply).

## Primitives — `import { … } from '@/components/insight'`
| Primitive | Use it for |
|---|---|
| `PageHeader icon={<NavIcon/>}` (`@/components/ui/misc`) | Every page. `icon` = the page's sidebar icon (`OrgLayout.tsx` `SITE_NAV`), shown in a solid blue tile; `description` = one-line purpose; `actions` = the primary action. |
| `SummaryHero tone="blue" \| "ink"` + `HeroStat` + `HeroNextStep` + `HeroLink` | One per page, top: `eyebrow` (scope · period), `title` = a headline sentence built from the data, `description` = one supporting line, `aside` = `HeroNextStep` (top action), `stats` = 2–4 `HeroStat`s. Blue for dashboards; ink for reports / runs / documents. Children switch to on-dark colours automatically (sparklines too). |
| `MetricCard` | One number that matters: `icon`, `label`, `value` (wrap numbers in `CountUp`), `delta` (`Delta`), `deltaLabel` ("vs last month"), `sparkline` (`Sparkline`), `visual` (a `ScoreRing` instead of the big value), `info` (how it is measured), `meta` (facts behind it, chips allowed), `onClick`/`to` (whole card clickable, arrow nudges). Grid: `grid grid-cols-2 gap-3 xl:grid-cols-4` (2 per row on phones). |
| `ScoreRing` | 0–100 scores (health, setup progress, a rate). `tone="auto"` = 80+ good / 60+ warning / else critical — always say the grade in words nearby. `display`/`suffix` for "12.5%", "3/5", "/100". |
| `InsightItem` (in `<ul className="divide-y divide-line">`) | A finding / recommendation / alert row: `tone` tile (status tones get their own icon), `meta` chips (priority, category), `title` (`clampTitle` + `titleAttr`), `description` one line, `detail` behind "Details" (animated), `action`; `actionPosition="side"` in full-width lists. |
| `ActionCard` | Standalone "do this / go here" card (icon tile, title, one line, optional action); `to`/`onClick` makes the whole card a link. |
| `InfoTip` | A "?" after a label: explanations of how a number is measured or what a term means. Opens on hover, focus and tap. Never hide the number itself. |
| `Collapsible` / `DisclosureButton` + `CollapsePanel` | Secondary text, long explanations, raw details. Closed content stays in the DOM (inert). |
| `ProgressSteps` | Setup checklists (numbered step cards, done = green check, open = action). |
| `ProgressBar` | "3 of 6 published" (label + value + `Meter`). |
| `DistributionBar` / `DistributionLegend` | A whole split into ordered buckets (positions, severities) with `SEQ[5]` (strongest) → `SEQ[1]`, `var(--surface-3)` for "none / not yet". |
| `TrendChip` + `trendOf()` | Word-level trends ("Rising", "Entered top 10") where there is no single delta number. |
| `IconTile tone=…` | Visual anchor: `blue` (default), `solid`, `ink`, `good` / `warning` / `serious` / `critical`, `neutral`, `on-dark`. Sizes `xs sm md lg`. |
| `Stagger` | Wrap the page body (`<Stagger className="space-y-6">`) or a card grid: children fade up 60ms apart. |
| `CountUp` | Key figures (hero, metric cards, big counts). `format` = the same formatter the page used (`compactNumber`, `pct`, `v.toFixed(1)`). |
| Kit upgrades (`pages/site/_components/kit.tsx`) | `Panel icon` now renders a blue tile (`iconTone` to change), `Panel info` / `SectionHeading icon info` add tiles and InfoTips. |
| Existing kit (unchanged) | `StatTile`, `Delta`, `Meter`, `Badge`/`StatusBadge`, `Callout`, `EmptyState`, `Tooltip`, `Card`, `ChartCard` (`title` accepts a node: tile + text + InfoTip, see `ChartTitle` in Overview). |

## Page anatomy (top to bottom)
1. `PageHeader` (icon, title, purpose, primary action). 2. Notices (`Callout`: paused, errors) and setup (`ProgressSteps`) if
incomplete. 3. `SummaryHero`: the headline sentence + 2–4 stats + next step. 4. Metric row: 3–4 `MetricCard`s. 5. "What to do next"
list (`InsightItem`s). 6. Main grid: charts (`ChartCard`, 2/3) + a related list (1/3). 7. Secondary lists / tables. 8. Details,
history, raw data (behind `Collapsible` or at the bottom). Wrap 2–8 in one `Stagger`. Gaps: `space-y-6`, grids `gap-4` (`gap-3` for
metric rows). Give `DataGate` a `skeleton` shaped like this anatomy (see `OverviewSkeleton`).

## Patterns
- **List of findings** (audit issues, alerts, link problems): `Panel` (tile icon, count in `description`) → `ul.divide-y` of
  `InsightItem tone={severityTone(sev)}` + `StatusBadge` in `meta`; evidence in `description`; long text in `detail`; fix button
  in `action`. Optionally a `DistributionBar` of severities above the list (critical/serious/warning use status colours only here
  because they *are* status, with labels in the legend).
- **Table of keywords**: keep `DataTable` (sorting, search, paging unchanged); add colour inside cells only: position as a small
  pill, `PositionMove` / `Delta` for change, `TrendChip` for trend words, `StatusBadge` for verdicts. Put a `MetricCard` row
  (tracked, top 3, top 10, movers) and a `DistributionBar` above the table.
- **Report summary**: `SummaryHero tone="ink"` — eyebrow = report type · date, title = the verdict / headline sentence, stats = the
  report's headline values, aside = `HeroNextStep` with the main download / follow-up. Below: `InsightItem` lists for findings.
- **Empty state**: `EmptyState` with an `icon` (the section's icon), what will fill it and the action that does; inside heroes and
  metric cards keep "–" plus the existing hint text.
- **Settings form**: no hero. `PageHeader icon` + `Section`s; give each `Section` title an `IconTile size="sm"` only if it helps
  scanning; explanations → `InfoTip` next to the field label or `Field hint`; status of a setting → `StatusBadge`; risky
  settings → `Callout tone="warning"`. Never move or rename fields.

## Colour rules
- Ascentra Blue is the only accent. **No gradients, no new hues, no hex in components.** Colour comes from: the solid blue hero
  (dark mode switches it to `accent-soft` navy automatically), blue icon tiles (`bg-accent-soft text-accent-text`), the blue
  ramp `SEQ` for intensity, status tokens for meaning (good / warning / serious / critical — always with icon + word), and
  `SERIES_COLORS` in fixed order for chart categories.
- One solid hero per page. Inside it use only `text-on-ink`, `text-on-ink-2` (ink tone), `ring-line-on-ink`, `bg-on-ink/10`,
  `text-accent-on-ink`; buttons: `secondary` (white) on blue, `primary` on ink.
- Text never takes a series colour; status colour never decorates a non-status thing (category tiles stay `blue`).
- Check light and dark at 1440 and 375 for every page.

## Motion rules
- `Stagger` on the page body, `CountUp` on key figures, `ScoreRing` draws in, `Collapsible` slides (220ms), hover lift
  (`-translate-y-0.5` + `shadow-raised`) on clickable cards, arrow nudge (`translate-x-0.5`) on links. Easing `ease-brand`;
  150–250ms UI, 400–900ms reveals. Reduced motion: everything instant (global rule in `index.css` + `prefersReducedMotion()`).
- No animation library; no looping animations except loaders/skeletons.

## No-functional-change checklist (tick every item before handing back)
- [ ] Hooks, queries, mutations, `DataGate`, `enabled`/`placeholderData`, query keys: untouched.
- [ ] Every condition (`can(...)`, `if (!x)`, empty / loading / error branches) still decides the same thing.
- [ ] Handlers, `navigate(...)`, `paths.*`, `page(...)`, `tool(...)` targets, form submit / `setError` / toasts: identical.
- [ ] Props passed to data components (`ChartCard` `table`/`series`/`data`, `DataTable` columns/rows, `ReportList`,
      `RecommendationButton`, forms) unchanged — only `title` / `description` / `className` / wrappers.
- [ ] Every piece of text/number shown before is still on the page (visible, in an `InfoTip`, a `Collapsible` or a `title`).
- [ ] Only markup and className changed in page files; `@seo/shared`, `lib/*`, `charts/index.tsx`, routes untouched.
- [ ] `tsc` + `npm run build -w @seo/web` pass; screenshots 1440/375 × light/dark; keyboard: Tab reaches every card link,
      InfoTip and toggle with a visible ring; no horizontal scroll at 375.

## Screenshots with data (read-only)
`scratchpad/D0/run.sh shot.js <tag> <page|all> 1440,375 light,dark` (pages listed in `shot.js`; `VARIANT=rich|empty|paused|real`
fills the Overview with a fuller / empty history; every non-GET API call is blocked; the session is cached in `D0/state.json`
because login is rate limited). `ix.js` / `kbd.js` show hover, focus, tap and disclosure checks.
