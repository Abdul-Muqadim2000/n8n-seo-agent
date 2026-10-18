# Marketing audit — does the business site advertise what ships? (2026-10-18)

Asked by the owner: "have we advertised these in our business pages? Look into the business pages and add what's missing about our
stuff." Scope: the public site in `app/web/src/marketing/` (registries `content/*.ts`, pages `pages/*.tsx`, mockups and diagrams in
`components/`). Source of truth for "shipped": the specs in `n8n/seo-agent/*_SPEC.md`, `app/README.md`, `app/API.md`, `app/docs/*.md`,
`n8n/seo-agent/HANDOVER.md` and `n8n/seo-agent/docs/system-review-2026-10-17/RESUME.md`. Rule kept: real, shipped capabilities only,
customer language, nothing promised that is deliberately not built.

Branch `worktree-agent-ad53a4111ec7bf11b` (from `feature/seo-agent-v4.5` at `261c3e9`).

## 1. Inventory

Where-on-the-site codes: **R** registry entry (`features.ts`, which also feeds the capability page `/platform/<slug>`, the mega-menu,
the footer and the Home grid) · **P** `/platform` (map, loop, sources) · **H** Home sections · **W** `/how-it-works` (stages + the week
schedule) · **S** solutions · **$** pricing tiers / comparison matrix · **Sec** `/security` · **C** changelog.

| # | Capability (customer view) | Ships — proof | On the site before this audit | Gap → what was done |
|---|---|---|---|---|
| 1 | Keyword research, verdicts, difficulty for your site, plan types, topic fit, Search Console seeds, measured vs modelled, SERP grouping, topic radius | `PIPELINE_FEATURE_SPEC.md`, CLAUDE.md status 10-13 / 10-15 | R `keyword-research`, W stage 2, $ matrix, C | Covered |
| 2 | Keyword Check (synchronous: difficulty for your site, plan type, topic fit) | `SEOagentAssess`, `app/API.md` `…/keywords/assess` | R (one benefit line) | Covered |
| 3 | Keyword ladders + Pipeline, Auto / Manual, priority, pile-up guard, re-plan proposals, cannibalisation, own move vs SERP churn, mobile, share of voice | `LADDER_FEATURE_SPEC.md`, `PIPELINE_FEATURE_SPEC.md`, status 10-17 | R `keyword-ladders`, R `autopilot`, H spotlight, $ | Covered |
| 4 | Content engine: writer / critic / editor, fact gate, originality, dead-link / outbound link check, placeholders held, images, style guide, E-E-A-T, page types, publish check (also outside a run) | status 10-13…10-18, `SEOagentPubCheck` | R `content`, $, C 10-18 | Covered |
| 5 | Content cadence (weekly posts, refresh of decaying pages, striking distance, trends) | `TRACKING_FEATURE_SPEC.md`, status 10-15 | R `autopilot`, W schedule | Covered |
| 6 | **AI answer page of the week** written by the cadence (questions to win) | `AI_GROWTH_SPEC.md` §2 Content Cadence | Nowhere (only "pages written to win them" on Home) | **Added**: autopilot benefit, the new AI growth page |
| 7 | CMS publishing: WordPress (Yoast / Rank Math), Webflow, Contentful, signed webhook; drafts by default; owner/admin publishes live; QA-failed / bracketed pages refused | `app/docs/CMS_PUBLISHING.md` | R `content` + `autopilot` FAQ, W stage 4, P sources, $, C 10-18, Sec FAQ | Covered |
| 8 | Technical audits: crawl 200/500/1000 + JS, Search Console coverage + URL Inspection, CrUX, render diff, hreflang, fix pack, impact order, minor-items fold, monthly + diff, skip when unchanged | `MONITORS_FEATURE_SPEC.md`, status 10-12…10-17 | R `technical-audits`, $, W schedule | Covered |
| 9 | Pre-release check for CI; daily key-page check (Page Watch, 05:45 daily); "I fixed this" re-check | status 10-13, HANDOVER | R `technical-audits`, $ | **Schedule gap**: the daily key-page check was missing from the week schedule on `/how-it-works` → **added** |
| 10 | Rank tracking: whole results page (AI Overview citation, snippet, PAA, local pack, video), competitors above you, share of voice, phone + desktop, cannibalisation, tracked keywords' own report | status 10-12 / 10-15 / 10-17 | R `keyword-ladders`, R `site-tracking`, $ | Covered |
| 11 | Site tracking: Search Console (incl. Discover / News), content groups, GA4, Trends, decay test, annotations, change test, brand demand | `TRACKING_FEATURE_SPEC.md`, status 10-17 | R `site-tracking`, $, C 10-17 | Covered |
| 12 | AI visibility: panel ≤ 50, six engines, daily pulse, Wilson ranges, per-engine tests, Holm correction, GA4 AI revenue, wrong-claim corrections, fetcher-eye readiness | `AI_VISIBILITY_SPEC.md`, status 10-17 | R `ai-visibility`, H spotlight, $, C | Covered |
| 13 | **AI growth** — weekly: new / updated pages to Bing Webmaster + IndexNow, AI readiness score of key pages (answer first, visible date, sources, raw HTML), questions to win (answer page / refresh / ladder page), earned media (the exact pages AI cites without naming you + drafts), Wikidata check | `AI_GROWTH_SPEC.md` (built + live 2026-10-10), `app/README.md` "AI growth (v4.12)" | Only two $ matrix rows, one Home "surfaces" line (which over-claimed "the moment they go live" — submission is weekly), one changelog highlight. **No capability page, no registry entry, not in the schedule, no changelog entry for its release** | **Added** registry entry + capability page `/platform/ai-growth` with its own mockup; Monday 09:30 in the week schedule; Growth tier line; Home Bing line corrected; changelog entry 2026-10-10; B2B solution help line |
| 14 | Backlinks from nine sources + own link check, values, farms written off, free-only mode, link imports | `BACKLINKS_SPEC.md` | R `backlinks`, H spotlight, $, P sources | **Out of date**: the FAQ "Does Alaventra send outreach e-mails? … Sending stays with your team" is no longer true (the app sends approved pitches from the customer's mailbox); the Home spotlight said "follow-ups after 7 and 14 days" (the link builder's sequence is +4 / +8 working days) → **corrected**, outreach moved to the link-building page |
| 15 | **Link Builder**: opportunities (journalist requests, HARO / SOS digests, podcasts, resource pages, broken links, competitors' broken links, our old 404 URLs → redirects), qualification + never-pitched rules, contacts on the prospect's own domain, our page + link text (never a keyword), drafted sequences (first + 2 follow-ups, A/B subjects), draft gate, listings checklist, linkable-asset ideas, impact with a control group, weekly PDF | `LINK_BUILDER_SPEC.md` (v4.13, 2026-10-11 + L1–L7 2026-10-12/13) | Spread across ~10 benefit lines of the backlinks page and seven $ matrix rows. **No capability page; no changelog entry for the 2026-10-11 release** | **Added** registry entry + capability page `/platform/link-building` with its own mockup; Monday 11:00 in the week schedule; changelog entry 2026-10-11; local-business solution help line (listings) |
| 16 | **Outreach sent from the customer's own mailbox** with rules: approve each (default) or automatic (owner only), Mon–Fri window, warm-up 5 / 10 / limit, 4–9 min apart, footer with postal address + opt-out, EU / UK source line, consent gate (DE / AT / SA, named UAE people), MX check, suppression list, bounce pause; **Reply Reader** (class, summary, return date, suggested answer, link checked at once) | `LINK_BUILDER_SPEC.md` §2 "App", `app/API.md` outreach section | Mailbox OAuth was on the backlinks page; the sender rules, consent gate and footer appeared **nowhere**; the Reply Reader only as one $ row | **Added** to the link-building page (benefits + FAQs) and a security FAQ |
| 17 | Crawler-log + AI-crawler analytics (upload or Logpush / Vercel / Fastly / Akamai; verified by published ranges / DNS; impostors apart) | `app/docs/LOG_ANALYTICS.md` | R `crawler-analytics`, $, S in-house, Sec, C 10-18 | Covered. Sources list on `/platform` lacked the log sources → **added** |
| 18 | Reports: full report PDF / Word, Monday report, Search Console alert watcher, monthly check-in, one ranked to-do list, lineage on every number, share links, branded shared reports | status 10-13 / 10-15 | R `reports`, $ | Covered |
| 19 | Report delivery: schedule, e-mail + signed webhook, held-back reports, delivery log | `app/README.md` "Report delivery" | R `report-delivery`, $ | Covered |
| 20 | Read API + MCP + write API (start runs, scopes, idempotency, dry run), signed event webhooks, Slack / Teams, Jira / Linear / Asana, S3 / GCS / R2 / BigQuery export, Looker Studio | `app/docs/INTEGRATIONS.md` | R `integrations`, P sources, $, C 10-18 | Covered. Security page lacked API-key / secret handling → **added** a group |
| 21 | Enterprise identity: two-step (TOTP, passkeys, security keys), sessions, idle sign-out, audit log, SSO OIDC + SAML, SCIM | `app/docs/IDENTITY.md` | R `enterprise`, Sec, $, C 10-18 | Covered on those pages. **Home "Enterprise-ready" band** still listed only roles / ownership / budget / isolation → **added** SSO + SCIM and two-step + audit log. P sources lacked the identity providers → **added** |
| 22 | White-label agency portal: client workspaces, client logins (viewer / approver), approvals, branding with AA contrast, custom domain, branded e-mail | `app/docs/WHITE_LABEL.md` | R `agency-portal`, S agencies, $, C 10-18 | Covered. Security page lacked the custom-domain proof / certificate guard → **added** to "Website ownership" |
| 23 | Guided setup (27 guides) | status 10-14 | R `guided-setup`, $ | Covered |
| 24 | Cost shown per run, budgets under a lock, platform spend limit, no repeated paid work, free-only backlinks | status 10-15, `app/shared/src/cost.ts` | W cost section, $ cost controls, Sec, R `enterprise` | Covered |
| 25 | **Schedule catch-up**: a scheduled run that did not fire still runs once the system is back (within the week), and its report says it ran late | `n8n/seo-agent/HANDOVER.md` §000, `build_catchup.py` (2026-10-16) | **Nowhere** | **Added**: autopilot benefit + FAQ, a note under the week schedule, a $ matrix row, changelog entry 2026-10-16 |
| 26 | Business profile, case-study intake, local pages, video pages, hub pages | `REVIEW.md` §3h, status 10-02 | R `content`, S local / B2B | Covered |

### Out-of-date or hard-coded copy found

| Where | What it said | Fixed to |
|---|---|---|
| `/platform` loop section | "How the ten fit together." (there were 15 capabilities, now 17) | the registry count (`capabilityCount`) |
| `/solutions` matrix heading | "Four starting points" (hard-coded) | the solutions count, in words |
| `/platform/backlinks` FAQ | "Does Alaventra send outreach e-mails? It drafts … Sending stays with your team" | sends approved pitches from your own mailbox; points to link building |
| Home "Backlinks" spotlight | "follow-ups after 7 and 14 days — sent from your own mailbox" | pitches you approve, sent from your own mailbox, follow-ups in the same thread |
| Home "Every place people look for you" | Bing: "New pages sent to Bing the moment they go live" (submission is weekly, IndexNow needs the key file) | "New and updated pages sent to Bing every week, and through IndexNow once your key file is up" |
| `/how-it-works` week schedule | 6 runs (pulse, five Monday runs, audit) | + daily key-page check 05:45, + AI growth Mon 09:30, + link building Mon 11:00, + the catch-up note |
| Home bento grid | first and seventh cards wide (written for 10 cards; with 17 the last row was ragged) | wide cards chosen so every row is full whatever the count |

### Not advertised on purpose (deliberately not built, or not shipped)

Automatic publishing without a person (drafts by default; the cadence never auto-publishes), edge / CDN fix deployment (design note
only), a native Slack app (incoming webhooks + Teams Workflows only), SOC 2 / ISO 27001 / DPA (no claim; RESUME §6 lists SOC 2 / DPA as
an owner decision), Snowflake / Redshift connectors (S3 covers them; not named), two-way ticket sync, Copilot as a default engine
(opt-in only; the six-engine count is kept), Brave-side rank checks, Bing AI Performance import (no API — the AI page already says so),
billing / Stripe (not built; pricing stays PLACEHOLDER).

## 2. What was added (step 2)

See the commit list in §4. Summary:
- Registry: **`ai-growth`** and **`link-building`** (17 capabilities), each with benefits, steps, facts, FAQs, a story, and a mockup
  drawn in code with sample data (`AiGrowthMockup`, `OutreachMockup`). Autopilot: AI answer page of the week + the schedule catch-up.
  Backlinks: outreach lines moved to link building, the stale FAQ fixed. AI visibility: links to AI growth.
- `/platform`: capability map gets a "Grow" layer; loop map includes AI growth, link building, delivery and integrations; sources add
  IndexNow, your mailbox, your logs and sign-in providers; the count is the registry's.
- `/how-it-works`: the real schedule (daily key-page check, AI growth, link building) and the catch-up note; the publish / track stages
  name Bing + IndexNow and link building.
- Home (section-scoped edits only): enterprise band +2 items, Bing line, backlinks spotlight line, bento layout for any count.
- Solutions: new **Enterprise teams** solution (`/solutions/enterprise`); B2B + local get AI growth / link-building lines; the count is
  computed.
- Pricing: Growth tier lines for AI growth; matrix row for the schedule catch-up and for outreach rules.
- Security: new group "Keys, secrets and connections"; custom portal domains under "Website ownership"; client logins under "Roles and
  access"; FAQ on e-mail sent for you.
- Changelog: entries for 2026-10-10 (AI growth), 2026-10-11 (link building + Reply Reader), 2026-10-16 (missed schedules caught up).

## 3. Checks (step 3)

All in `node:22-bookworm-slim` with the repo mounted, on the final tree:
- `npx tsc -p web/tsconfig.json --noEmit` — clean.
- `npm -w web test` — 7 files, **42 passed**.
- `npx -w web vite build` — built.
- Browser pass (`mcr.microsoft.com/playwright:v1.55.0-noble`) against a **throwaway static server** of `app/web/dist` on a private
  Docker network (SPA fallback, `/api/*` answered 401 as for a visitor; never the `seo-platform-dev-*` containers): **33 routes**
  (the fixed pages + every `/platform/*` and `/solutions/*` link the footer carries) × 390 / 1440 × light / dark = **132 visits, 0
  problems** — no console or page errors, no failed requests, no horizontal overflow, exactly one h1, no 404 page. **35 internal links**
  found on those pages all resolve. The only console lines are the expected 401s of `/api/*` for a signed-out visitor (264).
- The Platform mega-menu grew to 17 items and ran to 887 px of a 900 px window (it would have run off a 768 px laptop screen): it now
  shows three columns from 1280 px and can never be taller than the window — bottom at 639 px on 1280×720, 1366×768 and 1440×900.
- Close-up screenshots checked by eye: both new mockups at 390 (light and dark), the week schedule, the Home grid (every row full),
  the capability map with its Grow layer, `/solutions` with the odd fifth card laid out across both columns.

## 4. Commits and results

On `worktree-agent-ad53a4111ec7bf11b`:
- `4228699` this audit (inventory)
- `8177d9a` AI growth and link building capability pages + mockups; autopilot catch-up and AI page; backlinks copy corrected; changelog
- `61c39e1` the real week schedule and sources on `/how-it-works` and `/platform`
- `30c732b` Home: enterprise band, Bing line, outreach line, bento for any count
- `6c8b573` Solutions: enterprise teams page, AI growth / link-building help lines, computed counts
- `82f1fbc` Pricing and security
- `97e922e` mega-menu fit, two copy fixes found in the browser pass, this file's results

## 5. For the owner to decide

- Plan placement of AI growth and link building (matrix already puts them on Growth; kept, no new placement invented).
- Whether the Home hero "New" pill should move from "AI Pulse" (2026-10-08) to a newer release — left untouched because another session
  edits the hero.
- **Found outside the marketing site, not changed:** the app's "Add your site to Bing Webmaster Tools" guide
  (`app/shared/src/guides.ts`, id `bing-webmaster`) says "Copilot and ChatGPT search read Bing’s index". The 2026-10-15 benchmark found
  OpenAI's crawler docs never mention Bing and removed that claim from the AI Growth report; the guide still carries it. The marketing
  copy here says only Copilot.
- An Enterprise solution page now exists; it promises nothing beyond the shipped identity / integration / audit-log features, but the
  "Talk to sales" path and its e-mail address are still PLACEHOLDER.
