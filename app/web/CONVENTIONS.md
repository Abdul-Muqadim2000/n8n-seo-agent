# Web app conventions

React 19 + TypeScript + Vite, React Router 7 (data router, lazy pages), TanStack Query 5, react-hook-form + zod (schemas from
`@seo/shared`), Tailwind CSS 4 with design tokens, Radix primitives, Recharts 3, lucide-react icons, sonner toasts.

Logged-in pages follow **`DESIGN.md`** (insight kit `@/components/insight`, page anatomy, colour / motion rules, the local building blocks to reuse).

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

## Setup guides ("Show me how")

**Rule: wherever the app asks a person for something it cannot get itself — a Google permission, a DNS record, a file on their site,
an app password, facts about their business — the ask carries a guide.** No exceptions: if you add a field, a callout or an empty
state that asks for something, add or reuse a guide in the same change.

- Content is data in **`shared/src/guides.ts`** (`@seo/shared/guides` — deliberately *not* re-exported from the `@seo/shared` barrel,
  so the catalogue stays out of the entry chunk). One `Guide` = one job: `why` it matters, `where` it happens, `who` can do it,
  `minutes`, numbered `steps` (body, `copy` values, `link`, `note`, `warn`, per-provider `choices`), `done`, `trouble`, `related`,
  `keywords`. Bodies use a tiny markup — `**click this**`, `` `type this` ``, `[label](https://…)` — and `{{placeholders}}` filled
  from the caller's values (each declared in `vars` with an `example`, so a guide always reads sensibly).
- Triggers: `GuideButton` from `@/components/guide` — `variant="chip"` next to a heading, a callout (`action=`) or an empty state,
  `variant="link"` in a `Field labelAction`, `variant="icon"` where there is no room. Pass the website's real values
  (`vars={{ domain: site.domain, … }}`) and, when the app can finish the job, `finish={{ label: 'Check now', onClick }}`.
- The panel (`components/guide/GuidePanel.tsx`, lazy-loaded) shows one step at a time with ticks kept in `localStorage`, copy
  buttons on every value, provider tabs, "If it does not work", related guides, **Copy all steps** and **Send to a colleague**
  (mailto with the steps and the values filled in — the person with DNS access is usually someone else).
- Recommendations get theirs automatically: map the recommendation id in `GUIDE_FOR_RECOMMENDATION`.
- `GuideIndexButton` (sidebar, onboarding header) opens the searchable catalogue.
- Tests: `shared/src/guides.test.ts` (ids, placeholders declared and used, https links, closed markup, plain-text export, search).
  Run the browser check in `app/scripts/` style against the dev stack when the panel itself changes.

## Cost figures

**Rule: never write a per-mode price into a component, a test or a second table.** `shared/src/cost.ts` is the one table (it mirrors
the engine's calibrated figures); `MODES[mode].costUsd`, `estimateRunCost()` and `MONITOR_COSTS` all read it. To show what a run
costs, call `runCostEstimate(run)` and render `COST_SOURCE_LABEL[cost.source]` beside the number with `cost.basis` behind an
`InfoTip` — a figure shown without saying whether it is actual, the engine's estimate or ours is a bug.
The `partial` source (R102 / R115) is a settled figure with **no model-call part** — label it "search data only", never "actual",
show it to 3 decimals like a measured figure, and never add it to a measured total (the usage page keeps `actualPartialUsd` apart).

## Pages a client sees (the shared report)

`/share/:token` is the one page in the app that a person outside the company opens, so two rules apply only there and must not be
broken by a tidy-up:

- **It carries the customer's mark, not ours.** `ShareBrand` draws their business name and logo at the head of the page and in the
  browser tab; our name is one line in the footer and never above the fold. The values come from `SharedReport.brand` (the server
  reads `seo_profiles`) — never add a second place to store a logo, and never render one that `brandLogoUrl()` refused. Every
  fallback has to look finished: no logo, a logo that 404s, a logo drawn for white paper on our dark theme (it sits on a white tile),
  and a company that has filled in nothing at all (its initials).
- **It never shows a key the engine stores.** A headline figure is labelled in words ("Health score", not `healthScore`); a key no
  rule can make readable is named outright in `NAMED`. The same goes for any value that is an internal code.
- **It never looks more finished than the run was.** `SharedReport.caveat` is rendered above the figures whenever the run marked
  the work unfinished. The rule behind it is `deliveryDecision` (B-R1) — one rule for the e-mail and the link.

Evidence that these hold, at 1440 and 375, light and dark: `../BROWSER_PASS.md`.

## Brand (Ascentra) — for every UI change
Full guide: `brand/BRAND.md`; the app's tokens are in `src/index.css` (light + dark).
- Name: **Ascentra** in all UI copy ("SEO Agent" is only the internal engine name). The logo is always one of the supplied SVGs in
  `public/brand/` (`components/layout/Brand.tsx` in the app, `marketing/components/Logo.tsx` on the business site): never live text,
  never redrawn, recoloured, rotated, stretched, outlined or shadowed; never animate single rays (fading / moving / scaling the whole
  logo is fine). **One exception, approved by the owner on 2026-10-18:** the "wing wave" of `components/brand/AscentraMark.tsx` —
  the supplied path split into its 33 rays unchanged, one colour, a band of *opacity* running from the sun to the wing tip and back to
  the exact mark (static under reduced motion). Only for the loader (`PageLoader`) and large faint decorative marks (home hero,
  `CtaBand`); never on the logo lockups (header, footer, app shell, documents), never a per-ray colour, position, scale or rotation.
- Colour: tokens only (no hex, no Tailwind palette colours like `blue-500`). Ascentra Blue (`accent`) is the only accent — no second
  accent and **no gradients** (`linear-gradient`, `bg-gradient-*`, `from-*` / `to-*`); the neutral `--shimmer` skeleton token and CSS
  masks are the only exceptions. About 70% white / paper, 20% ink, 10% blue. Inside ink bands use the `on-ink` tokens
  (`text-on-ink`, `text-on-ink-2`, `border-line-on-ink`, `text-accent-on-ink`). Check light **and** dark.
- Type: `font-display` (Sora 600) for headings and KPI values — H1 `tracking-[-0.02em]`, other headings `-0.01em`, sentence case;
  Geist for UI text (14–16px, line height 1.5); `font-mono` (Geist Mono) for numbers, code and small eyebrows. Fonts are self-hosted
  (`@fontsource-variable/*` in `main.tsx`) because the production CSP blocks font CDNs.
- Shape: radius `rounded-md` 6 / `rounded-lg` 10 / `rounded-xl` 14; `shadow-card` on cards, `shadow-overlay` on popovers and floating
  panels.
- States: every interactive element has hover, active and a visible `:focus-visible` ring (global in `index.css`; don't remove
  outlines); hover is never the only signal.
- Motion: CSS transitions / keyframes only (no animation library), easing `ease-brand` (`cubic-bezier(.2,.7,.2,1)`), 150–250ms for UI,
  400–700ms for reveals (`animate-fade-in`, `animate-fade-up`, `animate-scale-in`). Everything must be still under
  `prefers-reduced-motion: reduce` (instant reveal, no movement).
- CSP (`server/src/app.ts`): no external scripts, styles, fonts, iframes or embeds and no inline `<script>` — JSON-LD
  (`type="application/ld+json"`) data blocks are fine; remote `https:` images are allowed.
- Copy: plain, specific, calm; no exclamation marks; capability facts only (no invented customers, logos, ratings or results).

## Business site (`src/marketing/`)
- Routes: public pages in `src/router.tsx` (`marketingPages`, under the lazy `MarketingLayout`, which also loads `marketing.css`); `/`
  is `marketing/RootRoute.tsx` (visitors get the marketing home as its own lazy chunk, signed-in users `HomeRedirect`). Slug pages
  (`/platform/:slug`, `/solutions/:slug`) have a `slugGuard` loader, so an unknown slug is the 404 page. App pages never load the
  marketing chunks — keep marketing code out of `src/components` and `src/pages`.
- Content lives in registries (`marketing/content/`), not in pages: `features.ts`, `solutions.ts`, `pricing.ts` (prices are
  `// PLACEHOLDER — confirm`), `changelog.ts`, `site.ts` (name, e-mails, nav, footer, integrations), `images.ts` (all photos, Unsplash
  placeholders).
- Kit (`marketing/components/index.ts`): `Section` (tone `page` / `surface` / `ink` — children read it with `useSectionTone()` and switch
  to on-ink colours), `Container`, `SectionHeading`, `Eyebrow`, `Reveal` (scroll reveal, `index` staggers) / `useInView`, `FeatureCard`,
  `IconTile`, `FactGrid` / `Stat` (numbers count up), `Faq` (`schema` adds FAQPage JSON-LD), `CtaBand`, `Photo`, `BrowserFrame`,
  `IntegrationMarquee`, `Logo`, the mockups (sample data, drawn in code, always labelled "Sample data") and diagrams.
  `FeatureVisual kind=…` renders the mockup or diagram a registry entry names (`visual` / `diagram`); the platform pages use
  `platform/CapabilityScreen` (adds `screen` and the browser frame). Mockups must fit their card at 375px — reduce columns with
  container queries (`@container`, `@min-[24rem]:…`) instead of a fixed `min-w` that clips.
- `useSeo({ title, description, path })` on every page: title "<title> — Ascentra", meta description, Open Graph and canonical.
- Motion: `marketing.css` / `platform/platform.css` hold the reveal, draw-in and marquee classes (`mk-*`); each has a static
  `prefers-reduced-motion: reduce` rule — add one for every new animation.
- **Adding a capability** (every new product functionality gets one, see the root `CLAUDE.md`):
  1. Add an entry to `features` in `content/features.ts` (slug, name, shortName, tagline, summary, icon, benefits, steps, facts,
     faqs, related, image from `images.ts`, visual — a new mockup goes in `components/mockups/` + a `VisualKey` + a `FeatureVisual`
     case). It then appears on the Home capability grid, the Platform page and its sticky index, the Platform mega-menu, the footer
     and its own `/platform/<slug>` page (the slug guard and "Capability NN / total" follow automatically).
  2. Place the slug in a layer in `components/platform/CapabilityMap.tsx` (`GROUPS`) and give it an app path in
     `components/platform/CapabilityScreen.tsx` (`APP_PATH`).
  3. The capability count in the copy ("Ten capabilities. One system.", "All ten capabilities", the Platform description) comes from
     `capabilityCount` / `CapabilityCount` in `features.ts` — never type the number into page copy.
  4. Add a `changelog.ts` entry (newest first, `features: [slug]`).
  5. If it matters to a team or a plan: link it from the relevant `solutions.ts` entries (`helps`) and add rows to the comparison
     table / plan lists in `pricing.ts`.
  6. Check `/`, `/platform`, `/platform/<slug>` at 375 and 1440 in light and dark, with reduced motion on and off.

## Audit log

Every new admin write (a connection, a key, a setting, an upload or deletion that changes what the company has) calls `audit()` from `server/src/services/audit.ts` with an action listed in `AUDIT_ACTIONS` (`shared/src/identity.ts`), no secret in its details, and the route test asserts the event.
