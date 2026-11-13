# Readiness review 2026-11-12: production data, fixes, new clients

Owner ask: go through all production data so far and every fix made, make sure the fixes run right, compare with the market, fix what is
critical, so official new clients can be onboarded. Done as survey -> plan -> code -> independent review -> deploy, with several agents.
The private working files (snapshot, findings with client data, reviews) are outside the repo: `~/seo-agent-secrets/prod-review-2026-11-12/`
(`REGISTER.md` is the merged list).

## How it was checked
- A read-only snapshot of production at ~13:50 UTC (every app table without secret columns, every engine Data Table, 546 executions of the
  last 14 days, the 93 failed / crashed / running ones decoded, logs).
- Six survey agents: engine run health (S1), what the clients see (S2), whether each fix since 2026-11-05 works on production (S3), the 85
  findings of the 2026-10-31 review (S4: 10 fixed, 9 partly, 64 open, 2 cannot tell), onboarding readiness for a new client (S5), the market
  in November 2026 (S6).
- Coders on separate branches, each branch reviewed by an independent adversarial reviewer, the review fixes applied, then one merged
  build, the full harness and the full app suites on the merged result.

## Found and fixed on production directly
- **Boot disk 99% full (281 MB free)**: gotenberg's container `/tmp` held ~2 GB of request dirs, the docker build cache 2.7 GB, six old
  rollback images ~3 GB, the journal 700 MB. Cleaned to 71% (5.4 GB free); gotenberg recreated (stateless).

## Fixed in code (branch `ready/2026-11-12`)
| Area | Fix |
|---|---|
| Infra | `deploy/gcp/hygiene.sh`: daily boot-disk hygiene (gotenberg request dirs > 2 h, build cache > 3 days, rollback images beyond 3, journal cap 300 MB) and an alarm to the ops webhook at 85% disk or no complete nightly backup in 30 h; installed by `startup.sh`. `backup.sh` never leaves a `.part` dump |
| Security (F-01) | `/api/hooks/*` was public on the API host: Caddy ran every `handle` before the bare `respond`. Now a first `handle` block (route order verified with `caddy adapt`); engine callbacks use the internal network |
| Security (S2-10) | the company callback address (hook token) is stripped from every client payload (reports, API v1 / MCP, portal, dashboards) and at ingest; owners / admins can renew it (`POST /api/orgs/:orgId/hook-token/rotate`, 48 h grace, conditional update, re-route of engine rows on a late callback; migration 0027) |
| Billing (S2-01) | internal Keyword-intelligence Trial runs were billed to clients: the cost sync now bills a KI row only through its app run; Trial and unreported KI rows are platform spend |
| Billing (S2-02 / F-11) | a final version was charged twice (app run + engine row through the domain fallback): the engine row is tied to its app run once; the free re-make costs 0; unmatched rows (live grades, tests) are platform spend; the re-price entry carries its run |
| Client view (S2-08) | runs that stop show one plain sentence; raw engine text is for platform admins only |
| Client view (S1-05 / S3-03) | a page run that never finished (`started` older than 3 h, the 2 h run limit + margin) is no page and never "waiting to be published" |
| Client view (S3-06) | an archived ladder cannot be resumed (409, no button) and every ladder status change is audited |
| Advice (F-07) | "What do you sell?" keeps commas inside a service, up to 120 characters (app and engine) |
| Advice (F-10) | recommendations and the engine's fit gate refuse searches for another site's address and the client's own brand (whole words only) |
| Advice (F-06) | recommendations never offer a second paid page for a search the site already has ("Improve the existing page") |
| Advice (F-29) | a placeholder job title ("User") is refused in the form and never printed in bylines, schema or signatures |
| Advice (S3-05 / F-03) | the live page grade checks the address it calls a duplicate (a same-page hop keeps it, a moved page follows its target, a 404 needs two reads); stale 404s are re-read weekly and cleared by a 200; 301 advice only for pages confirmed gone by two reads; the live title comes from the page |
| Advice (S3-04) | a second-read finding is resolved when the editor rewrote the table row / list item holding the claim (lost >= 30% of its words); prose keeps the old rule |
| Advice (S2-07) | the rank report never advises a stopped rung, a "-2" copy or a paused / archived ladder's pages |
| Advice (F-05) | the home page is never planned as a ladder page; when it already ranks top 20 it stays the main page, improved by hand |
| Reliability (S1-06) | the Strategy Brief parser repairs its own format (Haiku fixer) before a page run fails |
| Web (F-42) | `robots.txt` + `sitemap.xml` (124 addresses) for the business site; `app.` host disallows crawling |

## Writing slots (plan P1, branch `fix/page-slots`): DEPLOYED 2026-11-13 ~10:05-10:15 UTC
Live probe on the isolated alvrun stack first (`reviews/A0_probe.md` in the private folder, $0): waits with two writers, survives an n8n
restart, hands off after ~40 min keeping its place, admitted within one look when a slot frees, never more than 2 writing, dead waiters
expire after ~50 min. Production: backup pg/2026-11-13/*T100145Z; API at b84591b8 (rollback image alaventra-app:rollback-a4a04b0b); engine
23 updated, 4 ledger columns synced (page, request_id, keyword, queued_at), node diff prod == build; first runs after the deploy wrote
the new columns and settled. `PAGE_IN_FLIGHT_HOURS` and `CADENCE_IN_FLIGHT_HOURS` are 8 with `Cadence_Plan.js`. Watch the next cadence
day (techand.ai Thu 2026-11-19): at most 2 page rows `reserved` at once, no `canceled` page runs.

### Original note (before the deploy)
Nothing limits how many page runs write at once: on 2026-11-12 three cadence pages started together and all hit the 1 h limit at 90-100%
(another session raised the limit to 2 h the same day). P1 gates every page run at 2 writing at once, the rest wait in order (n8n does not
restart the time limit on resume, so a waiting run hands off to a new execution after 40 min). It touches every workflow and has not run
live: it needs the $0 production probe in the branch's deploy checklist before it ships; it is needed before onboarding more than ~4-5
clients. When it ships, `PAGE_IN_FLIGHT_HOURS` 3 -> 8 and `CADENCE_IN_FLIGHT_HOURS` 2 -> 8 go with it.

## Still open (not code, or later)
Owner: credits (Devaicon ~2 days left, two credit requests pending 6-8 days), refunds of the Trial and double final-version charges, MX + SPF
for alaventra.com, final Privacy / Terms + DPA, a payment provider, invoice seller address + tax id, Google OAuth client, VM size for 10-20
sites, Vercel plan, token rotation after this deploy. Engineering later: F-12 AI Pulse days covering several sites not billed, S1-02
Postgres write volume, spend of crashed runs recorded $0, callback nodes without retry, sign-up abuse vs the shared platform cap, admin
routes without a second factor, the first audit / AI visibility / rank reading at launch instead of after the first weekly cycle, scheduled
report delivery on by default.
