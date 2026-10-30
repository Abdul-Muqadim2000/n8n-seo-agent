# Page quality: deploy readiness review (2026-10-31)

Independent pre-deploy review of `feature/seo-agent-v4.5` at **`a7280008`** (merge of `origin/main` = Index coverage, PR #48 / #49), PR
**https://github.com/Abdul-Muqadim2000/n8n-seo-agent/pull/50**, against what production runs. Read-only: production was not touched, nothing
was deployed, nothing was merged into `main`. This file supersedes WAVE06.md section 5.6 (its rollback targets are stale, finding B1).

**What production runs** (Index coverage RESUME on `feature/indexing`, "WAVE 2 DEPLOYED 2026-10-30 ~19:25 UTC"):

| Part | Production | Notes |
|---|---|---|
| API (VM `/mnt/data/repo`) | `feature/indexing` **`05002d55`**, image `alaventra-app:local` | migration 0025 is the last one |
| Web (Vercel) | `main` **`5f4b0744`** (PR #49) | |
| Engine (n8n) | the committed workflows of `05002d55` (`deploy_engine.py --no-build`) | identical to `main` `5f4b0744`'s workflows (`git diff 8c0bc5ef 05002d55 -- n8n/seo-agent/workflows` and `05002d55..5f4b0744` are empty); credential `SEOcredGoogleSvcW` added that day; dispatcher mode `start` |

## 1. Verdict: GO, with conditions

**No code blocker.** The merge keeps all of Index coverage, the change needs no migration, no Data Table column, no new workflow, no new
credential and no new environment variable, and the API-first order is safe in both directions. Deploy when the conditions below hold.

**Conditions (do not deploy until each is true):**

| # | Condition | How (free) |
|---|---|---|
| C1 | The commit you deploy is the reviewed one plus documents only | `git diff --stat a7280008 <DEPLOY_SHA>` lists only `*.md` files (this file at least) |
| C2 | The deploy window is quiet (section 2.3) | not 10:00-13:30 UTC (after 2026-11-01; 09:00-12:30 UTC before), not 01:15-02:00 UTC, and the deploy guard's dry run passes |
| C3 | Production's reader credential reads pages (owner step of 2026-10-30) | pre-check P3 (section 4); not re-verified by this review because production was not touched |
| C4 | You accept the client-visible credit effects of D8 (finding N1) | look at `/admin` credit status of enforced companies before and after |

**Blockers found and how they are handled**

- **B1 (fixed by this file): WAVE06 section 5.6's rollback targets are stale.** It names API `fd32c0b4` and engine `5987fe9d`. Those are
  Index coverage *wave 1*; production moved to wave 2 (`05002d55`) on 2026-10-30. Rolling back to them would also roll back Index coverage
  wave 2 (the site-links step, "I asked Google", the sitemap switch and its credential use). Use section 6 of this file.
- **B2 (fixed by this file): the timing rule in WAVE06 section 5.3 says 09:15 UTC.** US daylight time ends on **Sunday 2026-11-01**. From
  then the daily jobs fire one hour later in UTC (section 2.3).

## 2. What was checked

### 2.1 Nothing of Index coverage was lost in the merge

- **Files**: of the 325 files `main` changed since the merge base `71e9d97c`, 36 differ in `a7280008` from `main`. For each hand-written one,
  every line `main` added is present in `a7280008`, except two deliberate merges of both sides: the guide count on the guided-setup page
  (`71` on main, `87` = 71 + 16 page-quality guides) and the CLAUDE.md status heading (re-labelled "previous"). The other 34 are generated
  files (workflows, `harness/code_v4`, lint baselines), rebuilt from the merged sources.
- **No file deleted** between production's `05002d55` and `a7280008` (`git diff --name-status`: 0 `D` rows).
- **Workflows**: all 32 workflow files exist on both sides with the same ids; **no node of `main` is missing** in `a7280008` (the W07-A
  renames keep every old name: the HTTP node became `<name> (reader)` and the fallback Code node took the old name).
  `SEO_Agent_Index_Coverage.json`: same 194 nodes, same connections; one node differs (`Ledger Settle (Index)`), and only by the shared
  kit `_complete.js` that page quality changed. Site Admin, the Schedule Catch-up, the Cycle Dispatcher, the API front door and the Site
  Kickoff are **byte-identical** to production.
- **Deploy inputs identical to production**: `ladder_common.py` (Data Table columns), `sync_tables.py`, `sync_credentials.py`,
  `deploy_manifest.json` (29 workflows, 27 published, `never_deploy` 2), `deploy_guard.py`, `env_settings.py`, everything in `deploy/`,
  `app/server/drizzle` (last migration `0025`), `app/server/src/config.ts`, `app/.env.example`, `n8n/.env.seo.example`.
- **Credentials**: the set of credential ids the workflows reference is the same in `05002d55` and `a7280008` (no new one, none dropped).
- **Reproducible build**: a fresh `git archive` of `a7280008` built with the real `n8n/.env` (`build_v4.py`, exit 0) gives workflow
  files **byte-identical** to the committed ones. So `deploy_engine.py --no-build` deploys exactly what was tested, and a default
  `deploy_engine.py` (which builds first) would deploy the same bytes.
- **Tests**: the integrator's run on the merge (commit message of `a7280008`): engine harness 16287 / 0; app typecheck clean; shared
  1056, server 1593 (46 skipped), web 305; web build OK. **CI on PR #50**: engine (build + lints + harness) green, app (typecheck, unit
  tests, build) green, images green, secret scan green. The red checks are pre-existing or not about this change (finding N6).
- Not in the branch, harmless: `f7fe4137` on `feature/indexing` (Index coverage RESUME text only).

### 2.2 What each page-quality change needs at deploy

| Change | Engine workflows | Data Table columns | App migration | App env / Secret Manager | Order |
|---|---|---|---|---|---|
| Waves 0-0.6 (meta description, weaving, regulatory dates, sources, byline, grade, final files, exclusions, CTA ending, failed runs) | main v4, Page Finalize, Site Tracker, + kit lines in others | none (new *values* `held` / `failed` in `seo_content_log.status`) | none | none | API first |
| W0-D hold ("Needs your OK"), D17 shadow | main v4 (Parse Verdict, Need Content?) | none | none | none | API first (it renders holds and sends `hold_ack`) |
| D8 price (114 / 9 credits) | none (engine estimates unchanged, finding N2) | none | none | none | API, then web |
| W06-C `sections_removed` on finalize | main v4, Page Finalize | none | none | none | API first: an engine without the field ignores it, an app without it sends none |
| W07-A reader fallback + one ops alert | main v4, AI Visibility (+11 nodes), Backlink Monitor (+11 nodes) | none (`seo_ops_alerts` exists) | none | alert webhook substituted by `deploy_engine.py` as today | any |
| W07-B separate page identity | main v4 | none | none | none | any |

Expected `deploy_engine.py` update list (workflows whose committed JSON differs from production's): main v4 (+53 nodes, 75 changed),
Page Finalize (+4), AI Visibility (+11), Backlink Monitor (+11), Site Tracker, Rank Tracker, Link Builder, AI Growth, AI Pulse, AI Pilot,
Audit Scheduler, Content Cadence, Index Coverage, Keyword Check, Page Watch, Publish Check, Publish WordPress, Reply Reader (18). The
dry run may list fewer if a workflow's remote copy only differs by the substituted alert webhook. Nothing missing remotely, so no
`--create-missing`; no `--credentials`.

### 2.3 Deploy guard and timing

- `deploy_engine.py` runs the deploy guard first: it **refuses** while a Cycle Dispatcher job is starting or a website's cycle or "Coming up"
  preview is due within 15 minutes, **reports** running jobs, and refuses if it cannot read `seo_cycle_jobs` / `seo_cycles`. Do not pass
  `--force`. The dispatcher is in mode `start` on production, so the guard is live.
- The guard does **not** see the three daily crons (n8n time zone America/New_York, `compose.prod.yml` `GENERIC_TIMEZONE`):

  | Cron | New York | UTC until Sat 2026-10-31 | UTC from Sun 2026-11-01 |
  |---|---|---|---|
  | Index Coverage (`SEOagentIndexCv1`), then its watch execution about 50 min later | 05:15 | 09:15 | **10:15** |
  | Page Watch | 05:45 | 09:45 | **10:45** |
  | AI Pulse | 06:30 | 10:30 | **11:30** |
  | Nightly backup (systemd, UTC) | | 01:30 | 01:30 |

  Keep 2 hours clear after Index Coverage (WAVE06 rule): **do not deploy 10:00-13:30 UTC** from 2026-11-01 (09:00-12:30 UTC before), nor
  01:15-02:00 UTC. Good window: 14:00-22:00 UTC on a day with no website cycle due in the next 15 minutes (the dry run says so).
- The API step restarts only the app container (seconds); callbacks n8n posts during the swap can fail, so keep it outside the windows above too.

### 2.4 D17: automatic runs are in shadow mode (verified in code)

- **Holds**: `Parse_Verdict.js` line 203 `CFG.automatic: 'shadow'`; line 206 automatic = `client_ip` starting `cadence:` `ladder:`
  `tracker:` `casestudy:` `audit:`; line 261 `mode = automatic ? 'shadow' : 'enforce'`; `held` only when mode is `enforce`; `hold_shadow`
  and `would_hold` go to the run and its callback. The page is written as before.
- **Second read**: `_critic_reread.js` lines 38 / 41 / 96: the same prefixes and every ladder page are `shadow` (advice only).
- **Grade fit floor**: `_grade.js` lines 295 / 413: recorded, not applied, for automatic runs.
- **Who starts automatic page runs**: the Content Cadence (started by the Cycle Dispatcher) uses `cadence:`; ladder spawns `ladder:`;
  case-study spawns `casestudy:`. The app always sends `app:<company>` (`server/src/n8n/client.ts`), so app-started runs (including
  "Write it anyway", ladder "Write now", approved proposals) are asked, as designed.
- **Two guards that are not holds do apply to automatic runs, by design** (finding N3): W07-A's stop when the reader refused and the
  fallback failed for the pages the decision needs (`Parse_Verdict.js` line 368 `pages_unread_stop: HOLD.applies`, router *Need
  Content?*; the content-log row becomes `failed`, so it is tried again), and the grade's fit floor when two or more sections were taken
  out (`_grade.js` line 413 `!RMrec`, a label, nothing is withheld).
- `discover:` (a form / API discovery that ticks "page content") is not in the shadow list: a person started it, so it is asked.

### 2.5 D8: the credit price change

Consistent in the app and its copy:

- `app/shared/src/cost.ts` line 75 `content.measured 1.9`, line 148 `QUOTE_FLOOR_KEYS = {content}`, line 171 `HOLD_CHECK_USD = 0.15`;
  `server/src/services/runCredits.ts` `heldQuote` (a held run is charged the check, at most what it was quoted).
- Copy: pricing page examples (`pricing.ts` lines 167-168: about 114 / about 9), credits FAQ (line 428), changelog 4.7, the two mockups
  (`AiGrowthMockup.tsx`, `platform/screens.tsx`), the app's cadence default `cadence.ts` line 95 `defaultPageUsd: 1.9`, and the forecast
  of automatic pages (`constants.ts` `blogPostEach = modeCostUsd('keyword')` = $1.90).

Not consistent (finding N2): the engine's own estimate of a page is unchanged (`_cost_cal.js` `EST.content 0.8` + `DFS_EST.content 0.04`
= $0.84 by default, or the rolling figure production has learned from settled runs). That figure still drives what "Coming up" and its
e-mail show (`comingUp.ts` line 199, `est_usd` from *Cadence Plan*) and the quote of runs the engine starts (`runCredits.ts` `quoteOf(
engineCostEstimateUsd)`), so an autopilot page can show fewer credits than 114 there, and is capped at that figure. Not a blocker; an
owner decision for a follow-up.

### 2.6 Jina reader credential and Secret Manager

- WAVE06 section 10 records the owner's step of 2026-10-30: production's credential `SEOcredJinaReade` holds the new key; Secret
  Manager's `alaventra-n8n-env` still holds the old one. This review did not read production; pre-check P3 confirms it for free.
- **The old key in Secret Manager does not reach the running engine**: n8n reads credentials from its own database (no `$env` in nodes),
  production runs the stock `n8nio/n8n` image (no release step that re-imports credentials), the app does not use the reader key, and
  this deploy does not run `load_secrets.sh` or `deploy_engine.py --credentials`. A restore from backup keeps the new key (it is in the
  n8n database). So the Secret Manager copy is an owner housekeeping decision, not a deploy blocker.
- If the reader refuses anyway after the deploy, W07-A reads the pages without the key or directly, and raises one ops alert.

## 3. Findings that do not block the deploy

| # | Severity | Finding | Where | What to do |
|---|---|---|---|---|
| N1 | Medium (clients see it) | D8 more than doubles the monthly forecast of automatic pages ($0.84 -> $1.90 a page). For companies with credits enforced, more of the balance is "kept for your websites' automatic work", on-demand runs can be refused sooner, a page run now needs about 114 credits available, and the credit guard can send "low" / "critical" runway e-mails sooner. Pausing still depends on the real balance and real usage only. | `shared/src/constants.ts` `blogPostEach`, `server/src/services/billing.ts` (forecast, `creditStatus`) | Read `/admin` credit status of every enforced company before and after; top up or tell the client if one turns low |
| N2 | Low | Engine page estimate not moved with D8 (section 2.5) | `v5/code/_cost_cal.js` lines 217 / 232, `app/server/src/services/comingUp.ts` line 199, `runCredits.ts` line 65 | Follow-up: align the engine's `EST.content` or apply the app's floor to engine-started quotes |
| N3 | Low | Shadow scope: the two non-hold guards of section 2.4 also apply to automatic runs | `Parse_Verdict.js` line 368, `_grade.js` line 413 | None (intended); mention in the D17 review after two cycles |
| N4 | Low | Form / API discovery pages (`discover:`) are held like person-started runs, but outside the app nobody can press "Write it anyway" | `v5/code/Spawn_Followups.js` line 7 | Accept (the app is the product), or add `discover:` to the shadow list later |
| N5 | Low | CodeQL: 113 new alerts on the PR. 77 are in harness test code, 15 "incomplete HTML attribute sanitization" in `v5/code/Blog_Package.js` (engine-built pages), 3 "polynomial regular expression" in app code run on page text: `app/shared/src/meta-description.ts` line 19 (`/\s+$/`), `app/shared/src/page-review.ts` lines 24 and 113 | CodeQL check on PR #50 | Follow-up; inputs are signed-in users' and the engine's page text, bounded by the body limit |
| N6 | Info | Red CI checks are pre-existing: real-Postgres `cmsRoutes` (17 of 18 fail, the same on `main` `5f4b0744`), npm audit (fast-uri, fastify), dependency review (dependency graph not enabled on the repository) | GitHub Actions | None for this deploy |
| N7 | Info | The VM boots on metadata `alaventra-ref` = `feature/seo-agent-v4.5`, which already holds the merge. A preemption checks out the new code but keeps the existing app image (it builds only when the image is missing). If the image were missing it would build the new API before the engine: that is the intended order, so safe | `deploy/gcp/startup.sh` lines 20, 105-106, 140-143 | After the PR is merged, consider pointing `alaventra-ref` at `main` |
| N8 | Info | Index coverage follow-ups (a) "ask Google" marks and (b) the two capability pages' reading (its RESUME, 2026-10-30) are not built; nothing in this deploy changes them | | None |

## 4. Owner-run deploy sequence

Fill in once: `DEPLOY_SHA` = the head of PR #50 when you deploy (C1).

**Pre-checks (free, from the Mac main checkout):**

```bash
cd ~/n8n_devaicon
git fetch origin && git checkout feature/seo-agent-v4.5 && git pull --ff-only
DEPLOY_SHA=$(git rev-parse HEAD); echo $DEPLOY_SHA
git diff --stat a7280008 $DEPLOY_SHA                    # P1: only .md files
git status --porcelain n8n/seo-agent/workflows          # P2: empty
gh pr checks 50                                         # engine + app jobs green (N6 reds are known)
```

P3, the reader credential (free, reads only execution data; prints status codes, never a key). With `deploy/gcp/tunnel.sh` open in another
terminal:

```bash
python3 - <<'EOF'
import json, sys, urllib.request
sys.path.insert(0, 'n8n/seo-agent'); import env_settings
key = env_settings.load_env().get('N8N_API_KEY')
def get(p):
    r = urllib.request.Request('http://localhost:15678/api/v1/' + p, headers={'X-N8N-API-KEY': key})
    return json.load(urllib.request.urlopen(r, timeout=60))
for wf in ('SEOagentV4Full01', 'SEOagentAIVisib1'):
    for e in get('executions?workflowId=%s&limit=3&includeData=true' % wf).get('data', []):
        rd = (((e.get('data') or {}).get('resultData') or {}).get('runData') or {})
        for name in ('Read Website', 'Read Client Pages', 'Read Competitor Pages', 'Read Site (AI)'):
            for run in rd.get(name, []):
                items = ((run.get('data') or {}).get('main') or [[]])[0] or []
                bad = sum(1 for i in items if '402' in json.dumps(i.get('json', {}))[:4000] or 'Balance' in json.dumps(i.get('json', {}))[:4000])
                print(wf, e.get('id'), e.get('startedAt'), name, 'items', len(items), 'refused-looking', bad)
EOF
```

Expect `refused-looking 0` on runs started after 2026-10-30 15:00 UTC. If they show 402, put the new key into production's credential first.

P4, on the VM: `df -h /mnt/data` (the app image build needs about 2 GB free).

**Step 1. Backup** (on the VM: `gcloud compute ssh alaventra-vm-1 --zone me-central1-a --tunnel-through-iap`)

```bash
sudo bash /mnt/data/repo/deploy/gcp/backup.sh
sudo bash /mnt/data/repo/deploy/gcp/restore.sh --list | head -4     # note the two file names (app-<ts>.dump, n8n-<ts>.dump)
```

**Step 2. API first** (on the VM)

```bash
cd /mnt/data/repo/deploy/gcp
C="docker compose -p alaventra --env-file /mnt/data/secrets/prod.env -f compose.prod.yml"
E="sudo DATA_DIR=/mnt/data SECRETS_DIR=/mnt/data/secrets"
sudo git -C /mnt/data/repo rev-parse --short HEAD                          # what the running image was built from (expect 05002d55)
IMG=$(sudo docker inspect --format '{{.Config.Image}}' alaventra-app-1); echo $IMG
sudo docker tag "$IMG" alaventra-app:rollback-05002d55                     # keeps the running image for a rollback without a rebuild
sudo git -C /mnt/data/repo fetch --quiet origin feature/seo-agent-v4.5
sudo git -C /mnt/data/repo checkout --quiet --force <DEPLOY_SHA>
$E $C up -d --build app
$E $C ps app                                                               # healthy
curl -fsS https://api.alaventra.com/api/health
curl -s -o /dev/null -w '%{http_code}\n' https://api.alaventra.com/api/orgs/00000000-0000-0000-0000-000000000000/sites/00000000-0000-0000-0000-000000000000/data/indexing   # 401
$E $C logs --tail 50 app                                                   # no migration ran, no error
```

**Step 3. Web**: merge PR #50 into `main` (GitHub). Vercel deploys `main`. Only after step 2 is healthy.

**Step 4. Engine** (Mac main checkout at `DEPLOY_SHA`; `deploy/gcp/tunnel.sh` open in another terminal)

```bash
python3 deploy/gcp/deploy_engine.py --no-build          # dry run: guard passes, sync_tables adds nothing, 0 missing, about 18 to update (2.2), no never_deploy active
python3 deploy/gcp/deploy_engine.py --no-build --apply  # no --force, no --credentials, no --create-missing
python3 deploy/gcp/deploy_engine.py --no-build          # again: nothing left to update, everything published
```

## 5. Post-deploy checks (free)

Within 15 minutes:

1. App: `/api/health` ok; the Indexing route answers 401 signed out; the Indexing page loads in the app.
2. Web: the pricing page shows "about 114 credits" and "about 9 credits"; a "Write a page" form shows the 114-credit quote and the hold rule line.
3. Engine: 27 workflows active (`GET /api/v1/workflows?active=true`), `SEOagentIndexCv1` and `SEOagentCycleDsp` among them; the
   `seo_cache` row `cycle:last` updated within 5 minutes; no Schedule Catch-up watchdog alert.
4. A free probe of the reader key answers 200 (as in WAVE06 section 10).

Within the first day:

5. No `error` execution in the first hour (`GET /api/v1/executions?status=error&limit=20`), and no new `seo_ops_alerts` row named
   "The page reader refused reads".
6. The next Index Coverage run (10:15 UTC from 2026-11-01) and its watch execution succeed; AI Pulse and Page Watch succeed.
7. `/admin`: credit status of every company with credits enforced, compared with before (N1).
8. The first paid page run of a client is the real live check: its report (grade, any "Needs work" reason, final version files). The
   first automatic page run's callback carries `hold_shadow` / `would_hold` when the hold would have fired.

Then:

9. D17: set a reminder two cadence cycles after the deploy date to read the `would_hold` lines and the first 20 would-be holds (WAVE06 5.4).
10. Tutorials: add the WAVE06 section 6 list as one row to `alaventra/TUTORIALS_BACKLOG.md` in the video-skills repo.

## 6. Rollback

Roll back the engine first if the problem is in pages; the API and web only if the problem is in the app.

- **Engine** (Mac; tunnel open). Production's previous engine is the committed workflows of `05002d55`:

  ```bash
  git worktree add /tmp/engine-rollback 05002d55
  cd /tmp/engine-rollback && python3 deploy/gcp/deploy_engine.py --no-build          # dry run
  python3 deploy/gcp/deploy_engine.py --no-build --apply
  cd - && git worktree remove /tmp/engine-rollback
  ```

  `deploy_engine.py` reads `n8n/.env` from the main checkout, so it works from a worktree. No column to remove; `held` / `failed`
  content-log rows stay readable. For one workflow only, n8n's workflow history in the editor (tunnel) also holds the previous version.
- **API** (VM, no rebuild):

  ```bash
  sudo docker tag alaventra-app:rollback-05002d55 "$IMG"     # $IMG as printed in step 2 (alaventra-app:local unless APP_IMAGE_TAG is set)
  sudo git -C /mnt/data/repo checkout --quiet --force 05002d55
  $E $C up -d app
  ```

  If the tag is missing: `checkout 05002d55` then `$E $C up -d --build app`. No migration to undo.
- **Web**: Vercel "Instant Rollback" to the deployment of `5f4b0744`, then revert the merge on `main` (`git revert -m 1 <merge sha>`
  through a PR) so the next `main` deploy does not bring it back.
- **Data**: only if rows were damaged: `sudo bash /mnt/data/repo/deploy/gcp/restore.sh /mnt/data/backups/<file from step 1> --yes`
  (`--only app` or `--only n8n`). Page quality writes no new table.
- Order when everything goes back: engine, then API, then web (the old engine with the new API is the tested state of section 2.2).
