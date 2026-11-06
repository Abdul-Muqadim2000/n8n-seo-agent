# AI ranking (AIR) browser pass, 2026-11-06

Worktree `.claude/worktrees/air-integ`, head `395bafa5`. Stack: compose project `airtest` (own Postgres, API, Vite web), torn down with `down -v`. No n8n: a small mock of n8n's Data Tables API and Site Admin webhook served seeded `seo_monitors`, `seo_ai_rank_runs`, `seo_ai_rank_actions`, `seo_ai_prompts`, `seo_ai_visibility` and `seo_sites` rows (it also applied `monitors` saves). One `ai_growth` callback with `ai_rank` v2 steps was posted to the company hook. Users: `owner@example.org` (company owner, site set On, later Trial) and `admin@example.com` (in `PLATFORM_ADMIN_EMAILS`, site set to Trial). Playwright 1.55 image, Chromium, 1440 and 390 px, light and dark. Screenshots (private, with test data): `~/seo-agent-secrets/ai-ranking-2026-11-05/browser/`.

Per visit: console errors, HTTP >= 400, horizontal scroll (`scrollWidth - clientWidth`). Result for all 15 page/state combinations x 4 viewports/themes: **0 console errors, 0 failed requests, 0 horizontal overflow.**

## Checks

| # | Check | Result |
|---|---|---|
| 1 | AI ranking card, owner (not platform admin), site On: read-only, badge "On", plain text, "How AI ranking works" guide link | PASS |
| 2 | Same, site in Trial: owner sees "Off" with "AI ranking is rolling out to selected websites. Ask us if you would like it for this one." | PASS |
| 3 | Owner API calls: `aiRank.mode` / `reserve` -> 403 with the rolling-out note; `fanoutN` -> 403; `rank-shadow` -> 403 | PASS |
| 4 | Platform admin card: Off / Trial / On editor, reserve switch (114 credits), paid readings block (admins only); On click shows "starts acting from the next weekly run"; Save -> toast "AI ranking saved", read back kept | PASS |
| 5 | AI visibility page, On site: "AI ranking plan" with steps (who does it, state), weekly note (5 plain sections), "2 won, about 90 credits each"; no ids, no "AIR", no `$`, no `_usd`, no memo/cost keys in the served JSON | PASS |
| 6 | AI visibility page, Trial site, owner: no plan shown | PASS |
| 7 | Platform-admin trial view ("AI ranking trial (platform admins only)", Show/Hide): weeks, overlap, expected gain, AI ranking's list vs the current plan | PASS (see D3) |
| 8 | Site steps with address field: "not a url", `http://127.0.0.1/x`, `https://user:pw@...`, `ftp://...` each refused with a plain message and no request to the page; a valid https address is checked and answers "does not name your business yet (we looked for ...)" | PASS |
| 9 | "Show me how" on all 4 steps (Bing, passage, earned mention, monthly AI reports) opens the guide panel; works at 390 px dark with no overflow | PASS (see D2) |
| 10 | Pipeline page with an On site: "Steps on your website" 4 to do, sections intact | PASS |
| 11 | Marketing `/changelog` entry "AI ranking, rolling out" and `/platform/ai-growth` ("rolling out to selected websites on request", FAQ) | PASS |
| 12 | Copy scan of every page text (em/en dash, curly quotes, ellipsis, "AIR", ids, vendor/table names) and of the added source lines | PASS for customer text; D3 for admin text. Hits for "Claude"/"ChatGPT" are the existing named AI assistants, not new strings |

## Defects

**D1 (Medium) The AI ranking card is missing on a website that is not tracked yet.** The card is rendered only in the tracked branch of the Tracking tab (`SiteSettingsPage.tsx`, near line 302); the untracked "Start weekly tracking" view has none, so a platform admin cannot set Trial before the site's first tracking save. Repro: site with no `seo_sites` row, Website settings > Tracking & monitors. Shot: none needed (`o-settings-tracking-*` from the first run had no card). Guess: render `AiRankingCard` in the untracked branch too, or document that tracking comes first.

**D2 (Low) "{{domain}}" printed in a guide.** The guide "Upload your AI reports from Bing and Search Console" shows the line `Someone with access to {{domain}} in Bing Webmaster Tools or Search Console` unreplaced. Repro: Pipeline > "Steps on your website" > the monthly AI reports step > Show me how. Guess: `who` in `app/shared/src/guides.ts` (~line 1827) is not run through the placeholder fill that `title` / `body` get (see `components/guide/`). Shot: `o-guide-3` was read as text only; `o-guide-0-1440-light.png` shows another guide for layout.

**D3 (Low) Engine wording reaches the admin trial view.** The comparison note shows "AIR picks more questions the site can win" and "AI ranking's own model". Admin only and labelled so, but it is an engine string passed through; the app could map or drop it. Guess: `AiRankShadowPanel` in `pages/site/_components/ai-rank.tsx` prints `compare.note` raw.

**D4 (Low, observation) An On website with no AI visibility check yet shows no plan.** `AiVisibilityPage.tsx` returns the "No AI visibility check yet" empty state before the AI ranking section, so a newly On site with a plan sees nothing until the first check. Probably acceptable; confirm intent.

Not tested: real n8n round trip (site admin save to engine), tutorials, tablet widths, mobile screenshots of every dark/light pair were taken but only a sample was viewed by eye (`o-ai-390-dark.png`, `o-guide-0-390-dark.png`).

## Screenshots
`o-settings-tracking-{1440,390}-{light,dark}.png`, `o-ai-{1440,390}-{light,dark}.png`, `o-pipeline-{1440,390}-{light,dark}.png`, `a-settings-tracking-*`, `a-ai-trial-*`, `mkt-changelog-*`, `mkt-ai-growth-*`, `o-settings-trial-readonly-*`, `o-ai-trial-hidden-*`, `o-pipeline-trial-*` (all four viewport/theme combinations each), plus `o-steps-address-1440-light.png`, `o-guide-{0,1,2,3}-1440-light.png`, `o-guide-0-390-dark.png`, `a-trial-open-1440-light.png`, `a-ai-ranking-saved-1440-light.png`.
