#!/usr/bin/env python3
"""Builds SEO Agent — Cycle Dispatcher (SEOagentCycleDsp): the per-website 7-day cycle (2026-10-19, docs/SCHEDULING_KEYWORDS_PLAN.md §4).

Every website gets its own week: cycle 0 starts within five minutes of its setup (Site Kickoff writes its seo_cycles row) and every later
cycle at 06:00 in the website's own time zone on its own weekday. This workflow replaces the seven Monday crons: a sweep every 5 minutes
reads the schedule table (seo_cycles, seo_cycle_jobs), each website's own settings, the run ledger and n8n's executions of the runs it
started, and starts each website's jobs one after the other in today's Monday order, each through its workflow's own Manual Run with
`trigger: 'cycle'` (plan §14.2). It is built from what we already trust: Site Kickoff's job list and its "read the site's own settings"
rule, the catch-up's record-then-start with the claim read back (two sweeps racing start a job once), the run ledger as the record of
what finished (`cycle:<cycle_key>:<job>` settled = done), and the catch-up's C-1 rules (no execution time-out - n8n counts it in
wall-clock time and a sleeping VM cancelled sweep 728 - and a plan older than 10 minutes is never acted on).
Three doors: n8n's own *Instance Started* (a restart only delays a cycle to the next sweep; a job it killed is read off its ledger row
and retried), the 5-minute *Cycle Sweep*, and *Cycle Run* (a test: { dry_run?, plan_only?, now? }; `now` only with dry_run).
The switch: seo_cache `cycle:mode` = {"mode":"start"} starts jobs; with no row (the default) it only plans and reports, so a deploy can
never start customer work by itself. The workflow is built INACTIVE and is not in the publish list (deploy_manifest.json): the owner
activates it, reads one plan-only sweep's report, then flips the mode (plan §10 steps 5 and 8).
The decision is the pure kit v5/code/_cycle.js (harness scenarios_cycle.js); build_v4.py section 140 proves the wiring.
"""
import json, os, re
import env_settings as _env   # B-F5: a build with no n8n/.env refuses, unless the offline build is deliberate
_env.require_settings('build_cycle.py')
import url_lint, retry_lint
from env_settings import ENV
from ladder_common import (DT_TYPE, DT_VERSION, CACHE_TABLE, CACHE_COLS, RUN_LEDGER_TABLE, RUN_LEDGER_COLS, dt_update_params, RUN_GUARD_SRC, CATCHUP_SRC, SITES_TABLE, MONITORS_TABLE,
                           CADENCE_TABLE, LADDER_TABLE, LADDER_SETTINGS_TABLE, CYCLES_TABLE, CYCLES_COLS, CYCLE_JOBS_TABLE, CYCLE_JOBS_COLS, SKIPS_TABLE, SKIPS_COLS,
                           dt_create_params, dt_upsert_params, dt_get_all_params, dt_get_where_params, dt_get_all_where_params, dt_delete_where_params,
                           node_id, freeze_ids, read_v5)

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'workflows'); CODE = os.path.join(HERE, 'harness', 'code_v4')
WID, NAME, FILE = 'SEOagentCycleDsp', 'SEO Agent — Cycle Dispatcher', 'SEO_Agent_Cycle_Dispatcher.json'
CODE_PREFIX = 'Cycle__'
# the engine's own zone (a website without one is adopted in it); the catch-up's setting, read the same way (build_catchup.py)
DEFAULT_TZ = 'America/New_York'
TZ = (ENV.get('GENERIC_TIMEZONE') or '').strip() or DEFAULT_TZ
N8N_API = ((ENV.get('SEO_N8N_API_URL') or '').strip() or 'http://localhost:5678/api/v1').rstrip('/')   # n8n's own API, from inside its container
EXEC_LIMIT = 100   # one page of a workflow's newest executions: far more than start in the 10 minutes a start is looked for
CRED = {'httpHeaderAuth': {'id': 'SEOcredN8nApiKey', 'name': 'n8n API (SEO Agent catch-up)'}}   # the catch-up's credential (sync_credentials.py, N8N_API_KEY)
SWEEP, SWEEP_CRON = 'Cycle Sweep (every 5 min)', '3-58/5 * * * *'   # offset from the catch-up's 7,22,37,52 so the two never sweep in the same minute
LEDGER_DAYS, JOBS_DAYS = 2, 40   # the ledger rows an outcome is read from; the job rows a plan reads (older ones are finished or set aside)
STALE_PLAN_MINUTES = 10
# the kit's defaults, repeated here so a reader of the workflow sees the numbers; harness CY13+ runs the generated node with them
CONFIG = {'local_time': '06:00', 'spacing_days': 3, 'next_gap_hours': 12, 'preview_hours': 48, 'preview_min_lead_hours': 6, 'max_starts': 2, 'max_inflight': 2,
          'max_attempts': 3, 'refusal_hours': 24, 'confirm_minutes': 10, 'retention_days': 120, 'engine_tz': TZ}
CYCLES_TS = os.path.join(HERE, '..', '..', 'app', 'shared', 'src', 'cycles.ts')


def kit_jobs():
    """The kit's job order as written in v5/code/_cycle.js."""
    src = read_v5('code/_cycle.js')
    block = src[src.index('const JOBS = ['):src.index('];', src.index('const JOBS = ['))]
    return [{'job': j, 'workflow_id': w} for j, w in re.findall(r"\{ job: '(\w+)', workflow_id: '(\w+)'", block)]


def ts_jobs():
    """The contract's job order (app/shared/src/cycles.ts CYCLE_JOBS), read as text; None when the app tree is not here."""
    if not os.path.exists(CYCLES_TS):
        return None
    src = open(CYCLES_TS, encoding='utf-8').read()
    a = src.index('export const CYCLE_JOBS = ['); block = src[a:src.index('] as const', a)]
    return [{'job': j, 'workflow_id': w} for j, w in re.findall(r"\{ job: '(\w+)', workflowId: '(\w+)' \}", block)]


def ts_consts():
    """The contract's constants the kit mirrors (CYCLE_LOCAL_TIME, PREVIEW_HOURS_BEFORE), read as text; None without the app tree."""
    if not os.path.exists(CYCLES_TS):
        return None
    src = open(CYCLES_TS, encoding='utf-8').read()
    lt = re.search(r"export const CYCLE_LOCAL_TIME = '([0-9:]+)'", src); ph = re.search(r'export const PREVIEW_HOURS_BEFORE = (\d+);', src)
    assert lt and ph, 'app/shared/src/cycles.ts no longer defines CYCLE_LOCAL_TIME / PREVIEW_HOURS_BEFORE where the build reads them'
    return {'local_time': lt.group(1), 'preview_hours': int(ph.group(1)), 'cycle_key': "cyc:${siteId}:${localDate}" in src}


JOBS = kit_jobs()
assert len(JOBS) == 8, 'the cycle kit lists %d jobs, expected the eight of the plan (§4.3)' % len(JOBS)
TS = ts_jobs()
assert TS is None or TS == JOBS, 'app/shared/src/cycles.ts CYCLE_JOBS and v5/code/_cycle.js JOBS disagree: %s vs %s' % (TS, JOBS)
TS_CONSTS = ts_consts()
_kit_src = read_v5('code/_cycle.js')
assert TS_CONSTS is None or (("local_time: '%s'," % TS_CONSTS['local_time']) in _kit_src and ('preview_hours: %d,' % TS_CONSTS['preview_hours']) in _kit_src
                              and TS_CONSTS['cycle_key']), 'app/shared/src/cycles.ts and v5/code/_cycle.js disagree on the local time, the preview hours or the cycle key: ' + str(TS_CONSTS)
WORKFLOW_IDS = sorted({j['workflow_id'] for j in JOBS})


def targets():
    """Each job's workflow, from the GENERATED files: it must exist and have a Manual Run (an Execute Workflow Trigger) for the start."""
    found = {}
    for fn in sorted(os.listdir(OUT)):
        if not fn.endswith('.json') or fn == FILE:
            continue
        for wf in json.load(open(os.path.join(OUT, fn), encoding='utf-8')):
            if wf.get('id') in WORKFLOW_IDS:
                entries = [n['name'] for n in wf['nodes'] if n['type'] == 'n8n-nodes-base.executeWorkflowTrigger']
                assert len(entries) == 1, '%s (%s): a cycle start needs exactly one Manual Run (Execute Workflow Trigger), found %s' % (wf['id'], fn, entries)
                found[wf['id']] = {'file': fn, 'name': wf['name'], 'entry_node': entries[0]}
    missing = [w for w in WORKFLOW_IDS if w not in found]
    assert not missing, 'the cycle starts workflows that were not generated: %s' % missing
    return found


TARGETS = targets()


def src(file):
    s = read_v5('code/' + file)
    s = (s.replace('/*__CATCHUP__*/', CATCHUP_SRC).replace('/*__RUN_GUARD__*/', RUN_GUARD_SRC).replace('/*__CYCLE__*/', read_v5('code/_cycle.js').rstrip('\n'))
         .replace('/*__FIT_GATE__*/', read_v5('code/_fit_gate.js').rstrip('\n'))   # INVARIANTS rule 2: the stored rungs are read through the gate
         .replace('__CONFIG__', json.dumps(CONFIG, sort_keys=True)).replace('__TZ__', TZ).replace('__N8N_API__', N8N_API).replace('__EXEC_LIMIT__', str(EXEC_LIMIT))
         .replace('__WORKFLOW_IDS__', json.dumps(WORKFLOW_IDS)).replace('__CYCLES_COLS__', json.dumps([c for c, _t in CYCLES_COLS]))
         .replace('__CYCLE_JOBS_COLS__', json.dumps([c for c, _t in CYCLE_JOBS_COLS])).replace('__STALE_PLAN_MINUTES__', str(STALE_PLAN_MINUTES)))
    left = re.findall(r'/\*__[A-Z_]+__\*/|__(?:CONFIG|TZ|N8N_API|EXEC_LIMIT|WORKFLOW_IDS|CYCLES_COLS|CYCLE_JOBS_COLS|STALE_PLAN_MINUTES)__', s)
    assert not left, file + ': placeholder left ' + str(left)
    return s


N, C = [], {}
at = lambda c, r: [c * 220, r * 220]


def node(name, ntype, ver, params, pos, **extra):
    n = {'parameters': params, 'id': node_id(NAME, name), 'name': name, 'type': ntype, 'typeVersion': ver, 'position': pos}
    n.update(extra); N.append(n); return n


def code(name, file, pos, **extra): return node(name, 'n8n-nodes-base.code', 2, {'jsCode': src(file)}, pos, **extra)


def iff(name, expr, pos):
    return node(name, 'n8n-nodes-base.if', 2.3, {'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'loose', 'version': 3},
        'conditions': [{'id': node_id(NAME, name + ':c'), 'leftValue': '=' + expr, 'rightValue': '', 'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}],
        'combinator': 'and'}, 'looseTypeValidation': True, 'options': {}}, pos)


def link(a, b, out=0):
    lists = C.setdefault(a, {}).setdefault('main', [])
    while len(lists) <= out: lists.append([])
    lists[out].append({'node': b, 'type': 'main', 'index': 0})


LOAD = dict(alwaysOutputData=True, executeOnce=True, onError='continueRegularOutput')
SAVE = dict(onError='continueRegularOutput', alwaysOutputData=True)
ago = lambda days: '={{ new Date(Date.now() - %d * 86400000).toISOString() }}' % days
# ---- the three doors ----
node('Instance Started', 'n8n-nodes-base.n8nTrigger', 1, {'events': ['init']}, at(0, 0))
node('Let n8n Start (Cycle)', 'n8n-nodes-base.wait', 1.1, {'amount': 45, 'unit': 'seconds'}, at(1, 0), webhookId=node_id(NAME, 'Let n8n Start:hook'))
node(SWEEP, 'n8n-nodes-base.scheduleTrigger', 1.2, {'rule': {'interval': [{'field': 'cronExpression', 'expression': SWEEP_CRON}]}}, at(1, 1))
node('Cycle Run', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, {'inputSource': 'passthrough'}, at(1, 2))
code('Cycle Entry', 'Cycle_Entry.js', at(2, 1))
# ---- the tables (created on first use; new columns reach an existing table through sync_tables.py) and the evidence ----
node('Ensure Cycles Table', DT_TYPE, DT_VERSION, dt_create_params(CYCLES_TABLE, CYCLES_COLS), at(3, 1), **LOAD)
node('Ensure Cycle Jobs Table', DT_TYPE, DT_VERSION, dt_create_params(CYCLE_JOBS_TABLE, CYCLE_JOBS_COLS), at(4, 1), **LOAD)
node('Ensure Skips Table', DT_TYPE, DT_VERSION, dt_create_params(SKIPS_TABLE, SKIPS_COLS), at(5, 1), **LOAD)
node('Ensure Cache Table (Cycle)', DT_TYPE, DT_VERSION, dt_create_params(CACHE_TABLE, CACHE_COLS), at(6, 1), **LOAD)
node('Load Cycle Mode', DT_TYPE, DT_VERSION, dt_get_where_params(CACHE_TABLE, 'key', 'eq', 'cycle:mode'), at(7, 1), **LOAD)
node('Load Cycles', DT_TYPE, DT_VERSION, dt_get_all_params(CYCLES_TABLE), at(8, 1), **LOAD)
node('Load Cycle Jobs', DT_TYPE, DT_VERSION, dt_get_all_where_params(CYCLE_JOBS_TABLE, [('updated_at', 'gte', ago(JOBS_DAYS))]), at(9, 1), **LOAD)
node('Load Sites (Cycle)', DT_TYPE, DT_VERSION, dt_get_all_params(SITES_TABLE), at(10, 1), **LOAD)
node('Load Monitors (Cycle)', DT_TYPE, DT_VERSION, dt_get_all_params(MONITORS_TABLE), at(11, 1), **LOAD)
node('Load Cadence (Cycle)', DT_TYPE, DT_VERSION, dt_get_all_params(CADENCE_TABLE), at(12, 1), **LOAD)
node('Load Ladder Settings (Cycle)', DT_TYPE, DT_VERSION, dt_get_all_params(LADDER_SETTINGS_TABLE), at(13, 1), **LOAD)
node('Load Ladders (Cycle)', DT_TYPE, DT_VERSION, dt_get_all_params(LADDER_TABLE), at(14, 1), **LOAD)
node('Load Run Ledger (Cycle)', DT_TYPE, DT_VERSION, dt_get_all_where_params(RUN_LEDGER_TABLE, [('created_at', 'gte', ago(LEDGER_DAYS))]), at(15, 1), **LOAD)
code('Cycle Exec Requests', 'Cycle_Exec_Requests.js', at(16, 1)); iff('Any Exec Reads?', '{{ !$json.skip }}', at(17, 1))
# a read of n8n's own public API: idempotent, so the one retry rule applies (G1); neverError + fullResponse so the plan reads the status
# code (a 401 is "could not be read", never "nothing happened")
node('Read Executions (Cycle)', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'GET', 'url': '={{ $json.url }}', 'authentication': 'genericCredentialType', 'genericAuthType': 'httpHeaderAuth',
     'options': {'batching': {'batch': {'batchSize': 1, 'batchInterval': 150}}, 'timeout': 20000, 'response': {'response': {'fullResponse': True, 'neverError': True}}}},
     at(18, 0), credentials=CRED, onError='continueRegularOutput', alwaysOutputData=True, **retry_lint.RETRY)
code('Cycle Plan', 'Cycle_Plan.js', at(19, 1))
# ---- what changed, written before anything starts: the websites' cycle rows, then the job rows (outcomes, skips, markers) ----
code('Cycle State Rows', 'Cycle_State_Rows.js', at(20, 1)); iff('Any Cycle Rows?', '{{ !$json.skip }}', at(21, 1))
node('Save Cycle Rows', DT_TYPE, DT_VERSION, dt_upsert_params(CYCLES_TABLE, CYCLES_COLS, 'site_id'), at(22, 0), **SAVE)
code('Cycle Job Rows', 'Cycle_Job_Rows.js', at(23, 1)); iff('Any Job Rows?', '{{ !$json.skip }}', at(24, 1))
node('Save Cycle Job Rows', DT_TYPE, DT_VERSION, dt_upsert_params(CYCLE_JOBS_TABLE, CYCLE_JOBS_COLS, 'key'), at(25, 0), **SAVE)
# a reservation whose run n8n reports crashed / canceled is released (`stale`, what Release Stale Runs writes after 2 h), so its retry is not
# refused as its own twin; only a row still `reserved` is touched
code('Cycle Release Rows', 'Cycle_Release_Rows.js', at(25, 2)); iff('Any Releases?', '{{ !$json.skip }}', at(25, 3))
node('Release Dead Runs', DT_TYPE, DT_VERSION, dt_update_params(RUN_LEDGER_TABLE, RUN_LEDGER_COLS, [('run_id', '={{ $json.run_id }}'), ('status', 'reserved')], {'status': 'stale'}),
     at(26, 3), **SAVE)
# ---- the starts: RECORD, read the claim back, then start - one at a time ----
code('Cycle Start Items', 'Cycle_Start_Items.js', at(26, 1)); iff('Any Cycle Starts?', '{{ !$json.skip }}', at(27, 1))
node('Loop Cycle Starts', 'n8n-nodes-base.splitInBatches', 3, {'batchSize': 1, 'options': {}}, at(28, 1))
code('Cycle Record Row', 'Cycle_Record_Row.js', at(29, 2))
node('Save Cycle Record', DT_TYPE, DT_VERSION, dt_upsert_params(CYCLE_JOBS_TABLE, CYCLE_JOBS_COLS, 'key'), at(30, 2), **SAVE)
node('Confirm Cycle Claim', DT_TYPE, DT_VERSION, dt_get_where_params(CYCLE_JOBS_TABLE, 'key', 'eq', "={{ $('Cycle Record Row').first().json.key }}"), at(31, 2), **LOAD)
code('Cycle Payload', 'Cycle_Payload.js', at(32, 2)); iff('Cycle Recorded?', '{{ !$json.skip }}', at(33, 2))
# answer first, then run (CLAUDE.md): the start does not wait for the run - the started workflow is its own execution with its own ledger
# row and run guard; every target is published by the deploy (build section 140 checks it). The workflow id comes from the saved record.
node('Start Cycle Job', 'n8n-nodes-base.executeWorkflow', 1.2, {'source': 'database', 'workflowId': {'__rl': True, 'mode': 'id', 'value': "={{ $('Cycle Record Row').first().json.workflow_id }}"},
     'mode': 'once', 'options': {'waitForSubWorkflow': False}}, at(34, 1), onError='continueRegularOutput', alwaysOutputData=True)
code('Cycle Start Result', 'Cycle_Start_Result.js', at(35, 1))
node('Save Cycle Start Result', DT_TYPE, DT_VERSION, dt_upsert_params(CYCLE_JOBS_TABLE, CYCLE_JOBS_COLS, 'key'), at(36, 1), **SAVE)
node('Space Cycle Starts', 'n8n-nodes-base.wait', 1.1, {'amount': 20, 'unit': 'seconds'}, at(37, 1), webhookId=node_id(NAME, 'Space Cycle Starts:hook'))
# ---- retention, the record of the sweep, and the alarm last ----
code('Cycle Retention', 'Cycle_Retention.js', at(29, 0)); iff('Retain?', '{{ !$json.skip }}', at(30, 0))
node('Delete Old Cycle Jobs', DT_TYPE, DT_VERSION, dt_delete_where_params(CYCLE_JOBS_TABLE, [('updated_at', 'lt', '={{ $json.before }}')]), at(31, -1), **SAVE)
code('Cycle Report', 'Cycle_Report.js', at(32, 0))
node('Save Cycle Report', DT_TYPE, DT_VERSION, dt_upsert_params(CACHE_TABLE, CACHE_COLS, 'key'), at(33, 0), **SAVE)
code('Cycle Alarm', 'Cycle_Alarm.js', at(34, 0))

link('Instance Started', 'Let n8n Start (Cycle)'); link('Let n8n Start (Cycle)', 'Cycle Entry'); link(SWEEP, 'Cycle Entry'); link('Cycle Run', 'Cycle Entry')
for a, b in [('Cycle Entry', 'Ensure Cycles Table'), ('Ensure Cycles Table', 'Ensure Cycle Jobs Table'), ('Ensure Cycle Jobs Table', 'Ensure Skips Table'),
             ('Ensure Skips Table', 'Ensure Cache Table (Cycle)'), ('Ensure Cache Table (Cycle)', 'Load Cycle Mode'), ('Load Cycle Mode', 'Load Cycles'),
             ('Load Cycles', 'Load Cycle Jobs'), ('Load Cycle Jobs', 'Load Sites (Cycle)'), ('Load Sites (Cycle)', 'Load Monitors (Cycle)'),
             ('Load Monitors (Cycle)', 'Load Cadence (Cycle)'), ('Load Cadence (Cycle)', 'Load Ladder Settings (Cycle)'), ('Load Ladder Settings (Cycle)', 'Load Ladders (Cycle)'),
             ('Load Ladders (Cycle)', 'Load Run Ledger (Cycle)'), ('Load Run Ledger (Cycle)', 'Cycle Exec Requests'), ('Cycle Exec Requests', 'Any Exec Reads?'),
             ('Read Executions (Cycle)', 'Cycle Plan'), ('Cycle Plan', 'Cycle State Rows'), ('Cycle State Rows', 'Any Cycle Rows?'),
             ('Save Cycle Rows', 'Cycle Job Rows'), ('Cycle Job Rows', 'Any Job Rows?'), ('Save Cycle Job Rows', 'Cycle Release Rows'),
             ('Cycle Release Rows', 'Any Releases?'), ('Release Dead Runs', 'Cycle Start Items'),
             ('Cycle Start Items', 'Any Cycle Starts?'), ('Cycle Record Row', 'Save Cycle Record'), ('Save Cycle Record', 'Confirm Cycle Claim'),
             ('Confirm Cycle Claim', 'Cycle Payload'), ('Cycle Payload', 'Cycle Recorded?'), ('Start Cycle Job', 'Cycle Start Result'),
             ('Cycle Start Result', 'Save Cycle Start Result'), ('Save Cycle Start Result', 'Space Cycle Starts'), ('Space Cycle Starts', 'Loop Cycle Starts'),
             ('Cycle Retention', 'Retain?'), ('Delete Old Cycle Jobs', 'Cycle Report'), ('Cycle Report', 'Save Cycle Report'), ('Save Cycle Report', 'Cycle Alarm')]:
    link(a, b)
link('Any Exec Reads?', 'Read Executions (Cycle)', 0); link('Any Exec Reads?', 'Cycle Plan', 1)
link('Any Cycle Rows?', 'Save Cycle Rows', 0); link('Any Cycle Rows?', 'Cycle Job Rows', 1)
link('Any Job Rows?', 'Save Cycle Job Rows', 0); link('Any Job Rows?', 'Cycle Release Rows', 1)
link('Any Releases?', 'Release Dead Runs', 0); link('Any Releases?', 'Cycle Start Items', 1)
link('Any Cycle Starts?', 'Loop Cycle Starts', 0); link('Any Cycle Starts?', 'Cycle Retention', 1)
link('Loop Cycle Starts', 'Cycle Retention', 0); link('Loop Cycle Starts', 'Cycle Record Row', 1)   # splitInBatches v3: 0 = done, 1 = loop
link('Cycle Recorded?', 'Start Cycle Job', 0); link('Cycle Recorded?', 'Loop Cycle Starts', 1)
link('Retain?', 'Delete Old Cycle Jobs', 0); link('Retain?', 'Cycle Report', 1)

table = '\n'.join('| %d | %s | `%s` | %s |' % (i + 1, j['job'], j['workflow_id'], TARGETS[j['workflow_id']]['entry_node']) for i, j in enumerate(JOBS))
node('Note', 'n8n-nodes-base.stickyNote', 1, {'width': 1500, 'height': 600, 'color': 6, 'content': """## SEO Agent — Cycle Dispatcher (2026-10-19, SCHEDULING_KEYWORDS_PLAN.md §4)
**The week belongs to the website.** Cycle 0 starts within five minutes of setup (Site Kickoff writes the website's `seo_cycles` row; a tracked website with no row is adopted here, anchored now, in """ + TZ + """). Every later cycle is due at **06:00 in the website's own time zone** on the first local date at least 3 days after the last cycle started that is its weekday (+7 days when the weekday is unchanged). The UTC time is derived each time from the stored intent (zone, weekday, local time), so DST never moves it. Cycle key `cyc:<site_id>:<local due date>`.
**Doors:** *Instance Started* (waits 45 s for n8n to settle), *""" + SWEEP + """* (`""" + SWEEP_CRON + """`, offset from the catch-up), *Cycle Run* — a test `{ dry_run?, plan_only?, now? }` (`now` only with `dry_run`; a dry run writes nothing and starts nothing). No execution time-out (C-1); a plan older than """ + str(STALE_PLAN_MINUTES) + """ min is never acted on.
**Mode:** `seo_cache` `cycle:mode` = `{"mode":"start"}` starts jobs. No row, `plan_only` or anything unreadable: it plans and reports only (the safe default, flipped by the owner at go-live).
**Each sweep:** the most recent due cycle only (a website more than a cycle overdue runs once; a cycle due less than 12 h before the next is skipped and recorded); the jobs in order, each starting only when every earlier one is done, skipped or gave up; monthly extras on the first cycle on or after the website's monthly date (its start day, at most the 28th) — 12 a year; the "Coming up" preview (the cadence with `preview: true`) 48 h before every cycle except cycle 0. Paused websites are skipped; on resume the most recent due cycle runs once.
**Starts:** RECORD the job row `starting` with this execution's claim, read it back (*Confirm Cycle Claim*), THEN start the workflow's own Manual Run with `{ trigger: 'cycle', domain, site_id, cycle_key, job, monthly, scheduled_for, request_id, light?, preview? }`; at most """ + str(CONFIG['max_starts']) + """ a sweep, """ + str(CONFIG['max_inflight']) + """ in flight, never into a refusal the run guard would give (its live runs, a twin of the same work for the same website), most overdue first.
**Outcomes from the ledger** (`cycle:<cycle_key>:<job>`): settled = done (handed off counts; `:part<n>` rows of a split run are progress, never done); refused for capacity = tried again without spending an attempt, for at most 24 h; account too low = gave up; a reservation past 2 h, a run n8n crashed or cancelled (its reservation is released at once, `stale`, so the retry is not refused as its twin), or a record with no run after 10 min = failed, three attempts, then gave up — and the run fails at *Cycle Alarm* so the Error Handler raises the ops alert. `seo_cycle_jobs` keeps 120 days.
**Record:** `seo_cache` `cycle:last` (tests: `cycle:last_test`). Successful executions are not kept (every 5 minutes).

| # | job | workflow | Manual Run |
|---|---|---|---|
""" + table}, [-40, -820])

w = {'id': WID, 'name': NAME, 'active': False, 'settings': {'executionOrder': 'v1', 'errorWorkflow': 'SEOagentErrHandl', 'executionTimeout': -1,
     'saveDataErrorExecution': 'all', 'saveDataSuccessExecution': 'none'}, 'tags': [], 'nodes': N, 'connections': C}
names = {n['name'] for n in N}; assert len(names) == len(N), 'duplicate node names'
for s_, outs in C.items():
    assert s_ in names, s_
    for lists in outs.values():
        for lst in lists:
            for t in lst: assert t['node'] in names, t['node']
for n in N:
    if n['type'] == 'n8n-nodes-base.httpRequest': assert n.get('credentials'), n['name']
url_lint.check(w, NAME)
retry_lint.check(w, NAME)
freeze_ids(w)
json.dump([w], open(os.path.join(OUT, FILE), 'w'), indent=2, ensure_ascii=False)
os.makedirs(CODE, exist_ok=True)
for n in N:
    if n['type'] == 'n8n-nodes-base.code':
        open(os.path.join(CODE, CODE_PREFIX + re.sub(r'[^A-Za-z0-9_.-]+', '_', n['name']) + '.js'), 'w').write(n['parameters']['jsCode'])
# what the harness reads (CY scenarios) and build section 140 extends: the settings the workflow was baked with
json.dump({'workflow': {'id': WID, 'name': NAME, 'file': FILE}, 'tz': TZ, 'default_tz': DEFAULT_TZ, 'n8n_api': N8N_API, 'credential': CRED['httpHeaderAuth']['id'],
           'config': CONFIG, 'exec_limit': EXEC_LIMIT, 'sweep_cron': SWEEP_CRON, 'jobs': JOBS, 'cycles_ts_jobs': TS, 'cycles_ts_consts': TS_CONSTS, 'targets': TARGETS,
           'cycles_cols': [c for c, _t in CYCLES_COLS], 'cycle_jobs_cols': [c for c, _t in CYCLE_JOBS_COLS], 'ledger_days': LEDGER_DAYS, 'jobs_days': JOBS_DAYS,
           'stale_plan_minutes': STALE_PLAN_MINUTES},
          open(os.path.join(HERE, 'harness', 'cycle_wiring.json'), 'w'), indent=1, sort_keys=True)
print('wrote', FILE + ':', len(N), 'nodes; the cycle of', len(JOBS), 'jobs (' + TZ + '), inactive')
