# Web app conventions

React 19 + TypeScript + Vite, React Router 7 (data router, lazy pages), TanStack Query 5, react-hook-form + zod (schemas from
`@seo/shared`), Tailwind CSS 4 with design tokens, Radix primitives, Recharts 3, lucide-react icons, sonner toasts.

## Where things are
- `src/lib/queries.ts` — one hook per API endpoint (`useSiteData(orgId, siteId, 'search')`, `useStartRun(orgId)`, `useSiteAdmin(...)`, …). Add hooks here, never `fetch` in a page.
- `src/lib/api.ts` — `api()` fetch wrapper, `ApiRequestError` (`status`, `message`, `fields`), `errorMessage(e)`, `fileUrl(orgId, fileId, download?)`.
- `src/lib/context.tsx` — `useOrgCtx()` → `{ me, org, role, sites, can(minRole) }` inside `/o/:orgId`; `useSiteCtx()` → `{ site }` inside `/o/:orgId/sites/:siteId`.
- `src/lib/paths.ts` — every in-app URL (`paths.site(orgId, siteId, 'search')`, `paths.tool(orgId, 'keyword', { siteId, prefill })`, `paths.run(orgId, runId)`, …).
- `src/lib/utils.ts` — `cn`, `fmtDate`, `fmtDay`, `fmtDateTime`, `fmtAgo`, `fmtBytes`, `encodePrefill/decodePrefill`, `downloadText`.
- `@seo/shared` — types (`Site`, `Run`, `Report`, `SearchData`, …), schemas (`RUN_SCHEMAS`, `createSiteSchema`, …), constants (`MODES`, `COUNTRIES`, `PAGE_TYPES`, `TONES`, `GOALS`, `AI_ENGINES`, `STAGE_LABELS`), formatters (`compactNumber`, `formatPercent`, `formatUsd`, `formatPosition`, `pctChange`, `splitList`).
- `src/components/ui/*` — the kit: `Button`/`ButtonLink`, `Field` (label + control + hint + error, render prop gives `id` and aria), `Input`, `Textarea`, `Select` (native), `Checkbox`, `ChoiceCard`, `Card`/`CardHeader`/`CardBody`/`CardFooter`/`Section`, `Badge`/`StatusBadge`/`RunStatusBadge` + `severityTone`/`verdictTone`, `Dialog`, `Menu`/`MenuItem`, `Tooltip`, `Popover`, `Tabs`/`TabList`/`Tab`/`TabPanel`, `LinkTabs`, `Segmented`, `Switch`/`SwitchRow`, `DataTable` (sort, search, paging), `TagInput` (string lists), `PageHeader`, `StatTile`, `Delta`, `Meter` + `scoreTone`, `CopyButton`, `Avatar`, `KeyValue`, `ExternalLink`, `Spinner`, `PageLoader`, `Skeleton`, `EmptyState`, `Callout`, `ErrorState`.
- `src/components/charts` — `ChartCard` (title, legend, chart/table toggle, `loading` keeps the old render dimmed), `TimeSeriesChart` (line/area, `invertY` for positions), `BarsChart` (columns / horizontal / stacked), `Sparkline`, `ShareBars`, `Legend`, `SERIES_COLORS`.

## Rules
- Pages default-export one component; the router lazy-loads them by path (`src/router.tsx`).
- Colours only through tokens (`bg-surface`, `text-ink-2`, `border-line`, `text-accent-text`, `bg-good-soft`, …). No hex in components. Light/dark both work automatically.
- Status colours (good / warning / serious / critical) only for status, always with an icon + label (`StatusBadge`). Series colours only through `SERIES_COLORS` in fixed order.
- Charts: one y-axis (two measures of different scale = two charts), legend for 2+ series, a `table` view on every `ChartCard`, positions plotted with `invertY`. Prefer a `StatTile` when the story is one number.
- Numbers: `compactNumber` for big values, `tabular` class in table columns, proportional figures in tiles.
- Loading: first load → `Skeleton` blocks shaped like the content (or `PageLoader`); refetch → keep the old content (`placeholderData` is on) and pass `loading` to `ChartCard`. Errors → `ErrorState` with retry. No data yet → `EmptyState` that says what will fill it and offers the action that does (e.g. "Start tracking", "Run an audit").
- Forms: `useForm({ resolver: zodResolver(schema), defaultValues })`, errors from `formState.errors` into `Field error=`, server field errors (`ApiRequestError.fields`) back into the form with `setError`. Submit buttons get `loading`. Toast on success (`toast.success`).
- Roles: hide or disable what the user cannot do (`can('member')` to start runs, `can('admin')` for site and team settings, `can('owner')` for budget). The server enforces it anyway.
- Mobile: every page works at 375px (stack grids with `sm:`/`lg:` breakpoints, tables scroll horizontally, no fixed widths).
- Accessibility: labels on every control (`Field` does it), `aria-label` on icon buttons, keyboard reachable menus/dialogs (Radix does it), never colour alone.
- Copy: plain, short, specific ("Search Console is not connected yet — add the service account as a user"), sentence case, no exclamation marks.
