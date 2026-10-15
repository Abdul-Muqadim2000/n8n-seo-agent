# Browser pass — 2026-10-15 (B-R2)

The register's line was *"no run has ever exercised the app UI"* (`n8n/seo-agent/docs/system-review-2026-10-11/FIX_PLAN.md`
§3.14, B-R2; the benchmark calls it item **a5** in `docs/system-review-2026-10-14/BENCHMARKS_2026-10-14.md` §5(a)). This is that run.
A real browser drove the real dev stack as a new customer — sign-up, onboarding, the dashboards, a report and the shared report —
at **1440 × 900 and 375 × 812**, in **light and dark**.

**Result: 54 visits, 0 console errors, 0 failed requests, 0 pages with horizontal overflow, an `h1` on every page, and no text
under the WCAG AA contrast ratio.** Four defects were found and fixed on the way (below); three more observations are recorded
without a fix.

Re-run it with `app/scripts/browser_pass.mjs` (the command is in the file's header comment). Screenshots:
**`app/docs/browser-pass/<name>-<size>-<theme>.png`**; the per-visit checks are in **`app/docs/browser-pass/results.json`**.

## What was driven, and how

| | |
|---|---|
| Stack | `docker compose -f app/compose.dev.yml up -d` — web 5173, API 4000, Postgres 5433, all from this worktree |
| Browser | `mcr.microsoft.com/playwright:v1.55.0-noble` (Chromium 1187) on the `seo-platform-dev_default` network, reaching the app at `http://web:5173` |
| Account | **its own**, created through the sign-up form: `b-r2-pass-<tag>@example.org`, company "Northwind Trading", websites `br2-demo.example-shop.com` / `br2-demo2.example-shop.com`. No existing account was signed into — driving the owner's has been refused as impersonation and that refusal stands |
| Money | none. No run was started; the two reports were posted to the company's **own** callback hook (`POST /api/hooks/n8n/<token>`), the way `scripts/smoke.py` does it. No engine step, no paid API |
| Themes | `colorScheme: 'light' \| 'dark'` on the browser context (the app follows the system setting unless a theme is picked) |
| Checked on every visit | console errors, failed requests and HTTP ≥ 400, `scrollWidth − clientWidth` (horizontal overflow), the presence of an `h1`, and every text node's contrast against its effective background (AA: 4.5:1, or 3:1 for large text) |

### Prepared outside the browser, and why

Two things a browser cannot honestly do for a domain nobody owns. Both are named here so the evidence is not read as more than it is.

1. **Ownership.** `sites.verified_at` was set directly in the dev database. A DNS TXT record cannot be added to
   `example-shop.com`, and dashboards are locked until a site is verified. The verification *screen* itself is real (screenshot 05).
2. **The engine.** A git worktree has no `n8n/.env` (it is gitignored), so the app has no n8n API key: every dashboard answers
   **503** and four `smoke.py` checks fail on `N8N_API_KEY is not configured`. A small stand-in for the n8n public API
   (Data Tables + executions, in memory, started by hand, outside the repo) was used instead, holding **one `seo_profiles` row** for
   the test domain. That is what makes the brand chain in screenshots 20–22 real rather than mocked: the server really reads a
   profile row, really takes two fields of it, and the page really draws them. The dashboards therefore show their **empty states**,
   which is what a new customer sees anyway.
   The stand-in is `scripts/stub_n8n.py` (its header says how to start it and how to point the dev server at it). The logo image
   itself is served by the browser (`page.route`) so the pass does not depend on the public internet; the host in the profile does
   not resolve, which is exactly what screenshot 21 needs.

## What passed

| Screens | Sizes · themes | Screenshots |
|---|---|---|
| Marketing home, sign-up, onboarding steps 1–3 (company, website, verify ownership) | 1440 light | `01`–`05` |
| Dashboards: overview, recommendations, search & traffic, rankings, content, technical health, AI visibility, backlinks, alerts, pipeline | 1440 light · 375 light · 1440 dark | `06`–`15` |
| Reports list, a finished report (technical audit), a report the run marked **not ready** | 1440 light · 375 light · 1440 dark | `16`–`18` |
| "Share this report" dialog — create, expiry, the live links with their open counts | 1440 light | `19` |
| **The shared report, branded** (B-R2): the customer's logo and name at the top, ours one line at the bottom | 1440 light · 1440 dark · 375 light · 375 dark | `20` |
| **The shared report when the logo fails to load**: the monogram, no broken image, nothing else changed | 1440 light · 1440 dark | `21` |
| **The shared report of a draft**: the run's own caveat above the first figure | 1440 light · 375 light | `22` |
| **A link that was never issued**: the same 404 wording a revoked link gets, with no report | 1440 light | `23` |

The share page was opened in a **fresh browser context with no cookies and no storage** every time — the way the person it is sent
to opens it.

## Defects found, and fixed

| # | What | Where | Fix |
|---|---|---|---|
| **BP-1** | **A shared report printed our field names to a client**: "HealthScore", "ScoreDelta", "NotReadyToPublish". The page's label helper only replaced underscores, while the summary keys are camelCase | `web/src/pages/share/SharedReportPage.tsx` | the same rule the app uses everywhere else ("healthScore" → "Health score"), plus an outright name for the few keys no rule can make readable (`qa` → "Quality check") |
| **BP-2** | **The headline figures led with the wrong number.** `summary` is stored as `jsonb`, which sorts its keys by length, so a shared audit opened with "Score delta 4" and put "Health score 78" last | `server/src/services/shareLinks.ts` | the order is taken from `summarize()` — the one place that decides what a stage's headline figures are — with anything stored but no longer produced kept at the end |
| **BP-3** | **A dead share link showed a page with no `h1`.** Every other page in the app has one | `web/src/pages/share/SharedReportPage.tsx` | the refusal now carries the page's heading ("This link does not work") with the reason under it |
| **BP-4** | **The dev stack served stale server code.** `tsx watch` never saw a change: macOS bind mounts deliver no file-system events into the container, and the API kept running the code it started with. Found the hard way — a browser pass was run against a server that had not picked up the change being tested. The web container has had `VITE_POLL` since the beginning; the server had nothing | `compose.dev.yml` | `CHOKIDAR_USEPOLLING: '1'` on the server service, proven by touching a file and watching it reload |

A fifth, outside this area, was fixed because it would have failed a CI run for no reason: **`server/test/runIdempotency.test.ts` was
flaky** — it resets the module registry and then re-imports the whole runs service from cold, which took over 5 s twice under load
and failed the suite. Its one slow test now carries an explicit 30 s timeout; the assertions were never the slow part.

## Observations, not fixed

1. **The draft caveat is worded for the owner**, not for the reader: "… so it is waiting in the app rather than going out as
   finished work." It is accurate and short, and it comes from the one delivery rule (B-R1) that must not be duplicated — but a
   client holding a link has no app to wait in. Worth a second sentence in that rule's wording, not a second rule.
2. **Two full-page screenshot artefacts, not defects.** A sandboxed `iframe` does not paint in a full-page screenshot (the page
   preview in `18` is blank; CLAUDE.md records the same thing), and a fixed step bar is painted at its viewport position over a
   taller page (`05`). Both behave normally in a live browser.
3. **The report list does not carry the "not ready" mark** that the report page carries so clearly (`summary.notReadyToPublish`
   exists and nothing renders it). Owner-side only, and out of this item's scope.

## Checks after the changes

| | |
|---|---|
| Typecheck | `shared`, `server`, `web` — clean |
| Unit tests | **shared 265** (11 new in `brand.test.ts`), **server 254** (11 new in `shareBrand.test.ts`) |
| Web build | clean |
| `scripts/smoke.py` | **ALL PASSED** — with the stand-in engine (`scripts/stub_n8n.py`) running. Without it, four checks fail on `N8N_API_KEY is not configured`, in any worktree, with or without this change (the same `n8n/.env` gap as B-F5). The cleanup note at the end of a smoke run ("could not remove the smoke upload rows from n8n") has the same cause |

## What this pass did **not** cover

- **Any paid or engine-backed path**: no run was started, so no tool form was submitted, no keyword check, no ladder, no live
  Search Console / GA4 / DataForSEO data. Every dashboard here is an empty state.
- **The dashboards with data in them.** A chart, a ranking table or a findings list with real rows was never rendered, because the
  data would have to come from the engine's Data Tables.
- **Google sign-in, e-mail verification, password reset, invitations and the team flows** (dev SMTP is off; links appear in the
  server log).
- **Settings that write** — company, website, mailboxes, delivery, budgets — and everything behind them, including the Link
  Builder and the tools pages.
- **375 px in dark**, except on the shared report, and **1440 dark** for onboarding: the dashboards were shot at 1440 light,
  375 light and 1440 dark only.
- **Safari and Firefox.** Chromium only.
- **Keyboard-only navigation and a screen reader.** The contrast check is automated and node-by-node; it is not an audit.
