# G5 white-label client portal for agencies — hand-off (2026-10-18)

Branch `worktree-agent-aaa2e2a52e09f5be6`, based on `feature/seo-agent-v4.5`; last merged at 4c2cc01 (after G4 integrations and the
Phase D fixes). Design, threat model and operator manual: `app/docs/WHITE_LABEL.md`; endpoints: `app/API.md` ("Agencies and the
client portal"). **Nothing from the brief is left open in code.**

## Done (committed)

| Commit | What |
|---|---|
| f8d1353 | 1/4 server + shared: `shared/src/agency.ts` (org kinds, client roles ranked below viewer, `clientWorkspaceRole`, colour tokens at WCAG AA in light + dark, branding / mail / approval schemas, portal host rules, `clientSafePayload`), audit category `agency`; `auth/access.ts` `orgAccess` (inherited / assigned / client roles, portal-host scoping); services `agency`, `brandOf`, `approvals`, `portalHosts` (host gate, DNS proof, re-check / lapse, TLS ask, hand-off), `portalMail`, `portalDocs` + `docRebrand`, `portalShell`; `routes/agency.ts`; orgs / runs / sites / data / sso / scim / cms / link building / report delivery / share links changed; 37 route + unit tests |
| 7f5afcb | 2/4 web: `lib/portal.tsx` (brand at run time), the client portal (own sidebar, portal pages only, Save as PDF, Approvals), Clients page, Branding / Portal address / Client e-mail settings, portal sign-in + hand-off page, share footer; four guides; 10 render tests |
| 7babaff | 3/4 API.md, README, `.env.example`, Agency mode card, the business site (Agency client portal capability + mockup, agencies solution, pricing PLACEHOLDER rows, changelog 2026-10-18) |
| 1cd9ab9 | branded verification / password e-mails for client people; the portal re-check timer |
| 0c40c84 | browser pass (69 visits, all clean) + its three fixes |
| b15c14d | merge of `feature/seo-agent-v4.5` (G4): **G5 migration is now `server/drizzle/0013_g5_white_label.sql`** (after `0012_g4_integrations`) |
| (last) | after the merge: G4's ticket queries no longer requested by client people; browser pass re-run on the merged build (69 visits, all clean); this note |

## Checks (merged tree)

- Typecheck clean: shared, server, web. Web build clean.
- Tests: shared **484** passed (2 skipped); server **494** passed (46 skipped: the real-Postgres suites without their switch); web **42**.
  G5's own: `server/test/agency.test.ts` 19, `portalHosts.test.ts` 11, `portalDocs.test.ts` 7, `shared/src/agency.test.ts` 32,
  `web/test/agencyPortal.test.tsx` 10.
- Real Postgres (throwaway `gap-g5-db`, fresh databases, migrations 0000-0013): CMS 18, G4 integrations 16, crawlers 12 — all pass.
- Browser pass `scripts/g5_browser_pass.mjs` against a throwaway stack (own Postgres, `stub_n8n.py`, the API serving the built app on
  :4000; the portal host mapped in Chromium): **69 visits** at 1440 / 390, light / dark — 0 console errors, 0 failed requests, 0
  overflow, an h1 on every page, no text under AA, and **no "Ascentra" on any client-facing page** (portal sign-in, dashboards,
  reports, report page, approvals, the guard redirect, the shared report, a client person on the app host). Screenshots and
  `results.json` in `docs/browser-pass/g5/`. Prepared in the database (no real DNS / domain here): the client's website and the portal
  address marked verified. Everything else went through the UI or the API.

## Owner decisions / inputs

- Pricing: which plan includes agency mode, any per-client price (rows marked PLACEHOLDER in `marketing/content/pricing.ts`).
- Operator: `PORTAL_CNAME_TARGET`, a reverse proxy with on-demand TLS asking `/api/portal/tls-allow` (`WHITE_LABEL.md` §5),
  `APP_EXTRA_HOSTS`, `PORTAL_STRICT_HOSTS` (on by default with an https `APP_URL` — list every host the app must answer on first).
- Whether the engine should print the agency's name into its PDFs (an engine change). Today a white-label client gets no engine PDF
  and uses Save as PDF on the report page; Word / zip / text files are rebranded by the app.
- The TXT label is `_portal-verification` (no product name in DNS); change `PORTAL_TXT_LABEL` before launch if a branded label is wanted.

## Merge hotspots

`server/src/db/schema.ts`, `server/drizzle/meta/_journal.json` + `0013_snapshot.json` (renumber after the newest), `server/src/auth/access.ts`
(`orgAccess`), `server/src/app.ts` (host gate hook, route registration, portal index), `server/src/index.ts` (timer),
`server/src/routes/{orgs,runs,sites,data,linkBuilder,auth,me,mfa}.ts`, `server/src/services/{reportDelivery,shareLinks,sso,scim,me,cms/service}.ts`,
`server/src/lib/mailer.ts`, `shared/src/{constants,api,schemas,identity,share,guides,index}.ts`, `web/src/components/layout/{OrgLayout,Brand,AuthGate,SiteLayout}.tsx`,
`web/src/components/insight/cards.tsx`, `web/src/components/ui/feedback.tsx`, `web/src/lib/{queries,paths,engine-cal}.ts`, `web/src/router.tsx`,
`web/src/main.tsx`, `web/src/pages/settings/{OrgSettingsPage,_components/SettingsCard}.tsx`, `web/src/pages/runs/{ReportPage,ReportsPage}.tsx`,
`web/src/pages/share/SharedReportPage.tsx`, `web/src/components/guide/GuidePanel.tsx`, marketing `features.ts` / `changelog.ts` /
`pricing.ts` / `solutions.ts` / `CapabilityMap.tsx` / `CapabilityScreen.tsx` / `FeatureVisual.tsx`.
