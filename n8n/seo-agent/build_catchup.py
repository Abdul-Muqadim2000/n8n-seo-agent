#!/usr/bin/env python3
"""Builds SEO Agent — Schedule Catch-up (SEOagentCatchUp1): R94 of the 2026-10-15 re-rating (docs/system-review-2026-10-15/defects/C_monitors.md).

Five of the ten schedules had never fired on their own and the rest fired late. (Since 2026-10-19 only the two daily crons - the AI Pulse and
the Page Watch - are left: the weekly workflows and the Audit Scheduler run in each website's own cycle, started by the Cycle Dispatcher.) n8n keeps a cron fire in memory only: a restart, a deploy
or a re-activation re-arms every schedule for its NEXT future time, so a fire that was due and not yet delivered is thrown away (the
2026-10-12 16:38 deploy restart dropped five Monday runs), and while the Mac sleeps the VM's timers stop, so fires arrive late.

This workflow is the catch-up. Two entry points: n8n's own *Instance Started* event (n8nTrigger `init`: every schedule has just been
re-armed, so a past fire not yet run is certainly lost) and an hourly sweep (a schedule re-published after its due time loses the fire
too, and a fire left hanging by sleep is started once it is `late_minutes` late). For each of the ten schedules - read from the GENERATED
workflows by this script, so the table cannot drift - it computes the latest due time in the instance's time zone, reads the workflow's
executions through n8n's public API (mode `trigger` = fired by its own schedule; an on-demand run does not count, an owner decision) and
the catch-up's own records, and starts a missed run ONCE through the workflow's own manual entry with no site (so the run covers every
site exactly as the schedule does) - recording the idempotency key `catchup:<workflow id>:<due ISO>` in seo_cache BEFORE the start.
Bounded: never one due before the catch-up first ran, at most two starts a sweep 30 s apart and never more than the run guard has
room for; every start still passes the started workflow's own gate.
C-1 (re-rating 2026-10-17, High): the hourly sweep 728 was cancelled by its 900 s time-out because n8n counts it in wall-clock time and
the Mac slept 44 minutes inside one short Code node; and only fires due in the last 36 h were replayed, so a slept-through Monday was
lost for good. Now: no time-out, a plan older than 10 min is never acted on, a sweep every 15 minutes, the claim read back after the
record (two sweeps racing start a fire once), a record no run followed retried, a slot due for its whole period, and the started run's
report says it ran late and why (CU.lateRun in every Callback Ledger).
The decision is the pure kit v5/code/_catchup.js (harness S126-S129, S150-S152); build_v4.py section 98 proves the wiring.
"""
import json, os, re
import env_settings as _env   # B-F5: a build with no n8n/.env refuses, unless the offline build is deliberate
_env.require_settings('build_catchup.py')
import url_lint, retry_lint
from env_settings import ENV
from ladder_common import (DT_TYPE, DT_VERSION, CACHE_TABLE, CACHE_COLS, RUN_LEDGER_TABLE, RUN_GUARD_SRC, dt_create_params, dt_upsert_params,
                           dt_get_where_params, dt_get_all_where_params, node_id, freeze_ids, read_v5)

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'workflows'); CODE = os.path.join(HERE, 'harness', 'code_v4')
WID, NAME, FILE = 'SEOagentCatchUp1', 'SEO Agent — Schedule Catch-up', 'SEO_Agent_Schedule_Catchup.json'
CODE_PREFIX = 'Catchup__'
# The instance's time zone. n8n reads GENERIC_TIMEZONE; unset, it is America/New_York (confirmed on the triggers' own output, execs
# 593 / 449 / 451). n8n/compose.yml now sets it explicitly with this same default, and build section 98 asserts the two agree.
DEFAULT_TZ = 'America/New_York'
TZ = (ENV.get('GENERIC_TIMEZONE') or '').strip() or DEFAULT_TZ
N8N_API = ((ENV.get('SEO_N8N_API_URL') or '').strip() or 'http://localhost:5678/api/v1').rstrip('/')   # n8n's own API, from inside its container
EXEC_LIMIT = 250   # the public API's page maximum: one page covers far more than the 36 h a catch-up looks back
CRED = {'httpHeaderAuth': {'id': 'SEOcredN8nApiKey', 'name': 'n8n API (SEO Agent catch-up)'}}   # sync_credentials.py, from N8N_API_KEY
# 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §4.8, owner decision D2): the seven weekly workflows and the Audit Scheduler have no cron any more -
# each website runs them in its own 7-day cycle, and a missed or crashed cycle job is the Cycle Dispatcher's own due row (record-then-start,
# the most recent missed cycle once). The catch-up keeps the two daily crons. The dispatcher's own 5-minute sweep is durable by itself (its
# state is in seo_cycles / seo_cycle_jobs, and n8n's Instance Started sweeps it too), so it is never a schedule this planner replays.
EXPECTED = ('SEOagentAIPulse1', 'SEOagentPageWch1')
NOT_REPLAYED = ('SEOagentCycleDsp',)   # the Cycle Dispatcher (build_cycle.py): its sweep is not a slot to replay
# A dry run (a test through *Catch-up Run*) starts only the workflows that honour `dry_run`: AI Growth (no Bing / IndexNow submission,
# R94) and the Content Cadence (plans, writes nothing). Every other workflow spends for real, so a dry run never starts it.
DRY_RUN_OK = {'SEOagentAIGrow1': [('Bing Submit Requests', 'DRY_RUN'), ('IndexNow Requests', 'DRY_RUN')],
              'SEOagentCadence1': [('Cadence Plan', 'dry_run')]}
# the kit's defaults, repeated here so a reader of the workflow sees the numbers; harness S127 runs the generated node with them
# C-1 (re-rating 2026-10-17): a slot stays due for its whole period (not 36 h / 20 h), a held fire is started at 30 min late (not 6 h),
# two starts a sweep every 15 minutes (not three an hour), three attempts, and a record no run followed is retried.
CONFIG = {'next_gap_hours': {'daily': 2, 'weekly': 12, 'monthly': 48},
          'grace_minutes': 1, 'fired_slack_minutes': 5, 'late_minutes': 30, 'max_starts': 2, 'max_attempts': 3, 'refusal_minutes': 20,
          'confirm_minutes': 10, 'stale_plan_minutes': 10, 'count_on_demand': False}
SWEEP = 'Sweep (every 15 min)'
SWEEP_CRON = '7,22,37,52 * * * *'
NOT_GENERATED = ('SEO_Agent_v3_original_export.json', 'SEO_Agent_Test_Callback_Receiver.json')


def cron_of(iv, where):
    """The n8n Schedule Trigger interval as a five-field cron (what n8n's toCronExpression builds, minus its seconds)."""
    f = iv.get('field')
    if f == 'cronExpression':
        parts = str(iv['expression']).split()
        assert len(parts) in (5, 6), where + ': cron "' + iv['expression'] + '" has neither five nor six fields'
        return ' '.join(parts[-5:])
    assert 'triggerAtHour' in iv and 'triggerAtMinute' in iv, where + ': a schedule without an explicit hour and minute fires at a ' \
        'random time n8n picks per node; the catch-up cannot know it - set triggerAtHour / triggerAtMinute'
    if f == 'weeks':
        assert int(iv.get('weeksInterval', 1)) == 1, where + ': every-N-weeks schedules are not taught to the catch-up planner'
        days = ','.join(str(d) for d in (iv.get('triggerAtDay') or [])) or '*'
        return '%d %d * * %s' % (int(iv['triggerAtMinute']), int(iv['triggerAtHour']), days)
    if f == 'days':
        assert int(iv.get('daysInterval', 1)) == 1, where + ': every-N-days schedules are not taught to the catch-up planner'
        return '%d %d * * *' % (int(iv['triggerAtMinute']), int(iv['triggerAtHour']))
    raise AssertionError(where + ': schedule field "' + str(f) + '" is not taught to the catch-up planner (v5/code/_catchup.js)')


def kind_of(cron):
    _m, _h, dom, _mon, dow = cron.split()
    if dom != '*':
        return 'monthly'
    return 'weekly' if dow != '*' and re.fullmatch(r'\d', dow) else 'daily'


def main_targets(wf, name):
    return sorted(t['node'] for lst in ((wf['connections'].get(name) or {}).get('main') or []) for t in (lst or []))


def schedules():
    """Every generated workflow with a Schedule Trigger: its cron, its manual entry (the Execute Workflow Trigger that feeds the SAME first
    node as the schedule, so a catch-up start runs the schedule's own path) and its ledger mode (the run guard's twin check)."""
    wiring = json.load(open(os.path.join(HERE, 'harness', 'ledger_wiring.json'), encoding='utf-8')).get('monitors') or {}
    out = []
    for fn in sorted(os.listdir(OUT)):
        if not fn.endswith('.json') or fn in NOT_GENERATED or fn == FILE:
            continue
        for wf in json.load(open(os.path.join(OUT, fn), encoding='utf-8')):
            trig = [n for n in wf['nodes'] if n['type'] == 'n8n-nodes-base.scheduleTrigger']
            if not trig or wf['id'] in NOT_REPLAYED:
                continue
            assert len(trig) == 1, fn + ': more than one Schedule Trigger'
            ivs = trig[0]['parameters']['rule']['interval']
            assert len(ivs) == 1, fn + ': a Schedule Trigger with ' + str(len(ivs)) + ' rules'
            cron = cron_of(ivs[0], fn)
            first = main_targets(wf, trig[0]['name'])
            entries = [n['name'] for n in wf['nodes'] if n['type'] == 'n8n-nodes-base.executeWorkflowTrigger' and main_targets(wf, n['name']) == first]
            assert len(entries) == 1, fn + ': no manual entry (Execute Workflow Trigger) feeds the schedule\'s own first node ' + str(first) + \
                ' - a catch-up start would not run the schedule\'s path'
            assert wf['name'] in wiring, fn + ': ' + wf['name'] + ' has no ledger row (harness/ledger_wiring.json), so the run guard cannot see it'
            for node, token in DRY_RUN_OK.get(wf['id'], []):
                code = next(n for n in wf['nodes'] if n['name'] == node)['parameters']['jsCode']
                assert token in code, fn + ': ' + node + ' no longer reads dry_run - a dry-run catch-up must not start it'
            out.append({'id': wf['id'], 'name': wf['name'], 'label': wf['name'].replace('SEO Agent — ', ''), 'mode': wiring[wf['name']]['mode'],
                        'cron': cron, 'kind': kind_of(cron), 'tz': (wf.get('settings') or {}).get('timezone') or TZ, 'entry_node': entries[0],
                        'trigger_node': trig[0]['name'], 'dry_run_ok': wf['id'] in DRY_RUN_OK})
    ids = sorted(s['id'] for s in out)
    assert ids == sorted(EXPECTED), 'R94: the scheduled workflows are ' + str(ids) + ', expected the two daily crons ' + str(sorted(EXPECTED)) + \
        ' - a weekly workflow runs in each website\'s cycle and has no cron (2026-10-19); a new daily schedule must be added to EXPECTED here (and to apply_env.PUBLISH)'
    return out


SCHED = schedules()


def watched():
    """C-16: the workflow whose trigger is a long-lived mail connection (the Search Console mail watcher). Its IMAP trigger drops when the
    Mac wakes without DNS and n8n's own re-activation is tried once and fails, while the API keeps saying `active: true`."""
    found = []
    for fn in sorted(os.listdir(OUT)):
        if not fn.endswith('.json') or fn in NOT_GENERATED or fn == FILE:
            continue
        for wf in json.load(open(os.path.join(OUT, fn), encoding='utf-8')):
            for n in wf['nodes']:
                if n['type'] == 'n8n-nodes-base.emailReadImap':
                    found.append({'id': wf['id'], 'name': wf['name'], 'trigger_node': n['name'], 'file': fn})
    assert len(found) == 1, 'C-16: expected one workflow with an IMAP trigger (the Search Console mail watcher), found ' + str(found)
    return found[0]


WATCH = watched()
try:   # the time zone must be one the platform knows, or every due time is wrong
    from zoneinfo import ZoneInfo
    ZoneInfo(TZ)
except ImportError:
    pass


def src(file):
    s = read_v5('code/' + file)
    s = s.replace('/*__CATCHUP__*/', read_v5('code/_catchup.js').rstrip('\n')).replace('/*__RUN_GUARD__*/', RUN_GUARD_SRC)
    slim = [{k: v for k, v in x.items() if k not in ('name', 'trigger_node')} for x in SCHED]
    s = s.replace('__SCHEDULES__', json.dumps(slim, ensure_ascii=False)).replace('__CONFIG__', json.dumps(CONFIG))
    s = s.replace('__TZ__', TZ).replace('__N8N_API__', N8N_API).replace('__EXEC_LIMIT__', str(EXEC_LIMIT))
    s = s.replace('__WATCH__', json.dumps({k: WATCH[k] for k in ('id', 'name', 'trigger_node')}, ensure_ascii=False))
    left = re.findall(r'/\*__[A-Z_]+__\*/|__(?:SCHEDULES|CONFIG|TZ|N8N_API|EXEC_LIMIT|WATCH)__', s)
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


def api_get(name, url_expr, pos):
    """A read of n8n's own public API: idempotent, so the one retry rule applies (G1); neverError + fullResponse so the planner reads
    the status code (a 401 is "could not be read", never "nothing happened")."""
    return node(name, 'n8n-nodes-base.httpRequest', 4.5, {'method': 'GET', 'url': url_expr, 'authentication': 'genericCredentialType', 'genericAuthType': 'httpHeaderAuth',
        'options': {'batching': {'batch': {'batchSize': 1, 'batchInterval': 150}}, 'timeout': 20000, 'response': {'response': {'fullResponse': True, 'neverError': True}}}},
        pos, credentials=CRED, onError='continueRegularOutput', alwaysOutputData=True, **retry_lint.RETRY)


def link(a, b, out=0):
    lists = C.setdefault(a, {}).setdefault('main', [])
    while len(lists) <= out: lists.append([])
    lists[out].append({'node': b, 'type': 'main', 'index': 0})


LOAD = dict(alwaysOutputData=True, executeOnce=True, onError='continueRegularOutput')
SAVE = dict(onError='continueRegularOutput', alwaysOutputData=True)
# ---- the three doors ----
node('Instance Started', 'n8n-nodes-base.n8nTrigger', 1, {'events': ['init']}, at(0, 0))
node('Let n8n Start', 'n8n-nodes-base.wait', 1.1, {'amount': 45, 'unit': 'seconds'}, at(1, 0), webhookId=node_id(NAME, 'Let n8n Start:hook'))
node(SWEEP, 'n8n-nodes-base.scheduleTrigger', 1.2, {'rule': {'interval': [{'field': 'cronExpression', 'expression': SWEEP_CRON}]}}, at(1, 1))
node('Catch-up Run', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, {'inputSource': 'passthrough'}, at(1, 2))
code('Catch-up Entry', 'Catchup_Entry.js', at(2, 1))
# ---- the evidence ----
node('Ensure Cache Table (Catch-up)', DT_TYPE, DT_VERSION, dt_create_params(CACHE_TABLE, CACHE_COLS), at(3, 1), onError='continueRegularOutput', alwaysOutputData=True, executeOnce=True)
node('Load Catch-up Records', DT_TYPE, DT_VERSION, dt_get_where_params(CACHE_TABLE, 'kind', 'eq', 'catchup'), at(4, 1), **LOAD)
node('Load Run Ledger (Catch-up)', DT_TYPE, DT_VERSION, dt_get_all_where_params(RUN_LEDGER_TABLE, [('created_at', 'gte', '={{ new Date(Date.now() - 40 * 3600000).toISOString() }}')]), at(5, 1), **LOAD)
code('Catch-up Targets', 'Catchup_Targets.js', at(6, 1))
api_get('Read Workflows (Catch-up)', '={{ $json.wf_url }}', at(7, 1))
code('Execution Requests (Catch-up)', 'Catchup_Exec_Requests.js', at(8, 1))
api_get('Read Executions (Catch-up)', '={{ $json.url }}', at(9, 1))
code('Catch-up Plan', 'Catchup_Plan.js', at(10, 1))
# ---- the catch-up's own state, then the starts: RECORD, then start, one at a time ----
code('Catch-up State Rows', 'Catchup_State_Rows.js', at(11, 1)); iff('Any State?', '{{ !$json.skip }}', at(12, 1))
node('Save Catch-up State', DT_TYPE, DT_VERSION, dt_upsert_params(CACHE_TABLE, CACHE_COLS, 'key'), at(13, 0), **SAVE)
code('Catch-up Start Items', 'Catchup_Start_Items.js', at(14, 1)); iff('Any Starts?', '{{ !$json.skip }}', at(15, 1))
node('Loop Catch-ups', 'n8n-nodes-base.splitInBatches', 3, {'batchSize': 1, 'options': {}}, at(16, 1))
code('Catch-up Record Row', 'Catchup_Record_Row.js', at(17, 2))
node('Save Catch-up Record', DT_TYPE, DT_VERSION, dt_upsert_params(CACHE_TABLE, CACHE_COLS, 'key'), at(18, 2), **SAVE)
# C-1: read the record back after the save - the claim on it says which sweep starts the fire when two sweeps race
node('Confirm Claim', DT_TYPE, DT_VERSION, dt_get_where_params(CACHE_TABLE, 'key', 'eq', "={{ $('Catch-up Record Row').first().json.key }}"), at(18, 3), **LOAD)
code('Catch-up Payload', 'Catchup_Payload.js', at(19, 2)); iff('Recorded?', '{{ !$json.skip }}', at(20, 2))
# answer first, then run (CLAUDE.md): the start does not wait for the run - the started workflow is its own execution, with its own
# timeout, ledger row and gate; every target is published by apply_env.py (build section 98 checks it)
node('Start Missed Run', 'n8n-nodes-base.executeWorkflow', 1.2, {'source': 'database', 'workflowId': {'__rl': True, 'mode': 'id', 'value': '={{ $json.workflow_id }}'},
     'mode': 'once', 'options': {'waitForSubWorkflow': False}}, at(21, 1), onError='continueRegularOutput', alwaysOutputData=True)
code('Catch-up Start Result', 'Catchup_Start_Result.js', at(22, 1))
node('Save Start Result', DT_TYPE, DT_VERSION, dt_upsert_params(CACHE_TABLE, CACHE_COLS, 'key'), at(23, 1), **SAVE)
node('Space Starts', 'n8n-nodes-base.wait', 1.1, {'amount': 30, 'unit': 'seconds'}, at(24, 1), webhookId=node_id(NAME, 'Space Starts:hook'))
code('Catch-up Report', 'Catchup_Report.js', at(17, 0))
node('Save Catch-up Report', DT_TYPE, DT_VERSION, dt_upsert_params(CACHE_TABLE, CACHE_COLS, 'key'), at(18, 0), **SAVE)
# ---- C-16 (re-rating 2026-10-17): the mail watcher's watchdog, last in the sweep (every catch-up start has happened by then) ----
from ladder_common import OPS_ALERTS_TABLE
api_get('Read Mailbox Workflow (Watchdog)', '=' + N8N_API + '/workflows/' + WATCH['id'] + '?excludePinnedData=true', at(19, -1))
node('Load Mailbox Alerts (Watchdog)', DT_TYPE, DT_VERSION, dt_get_where_params(OPS_ALERTS_TABLE, 'workflow', 'eq', WATCH['name']), at(20, -1), **LOAD)
code('Watchdog Plan', 'Watchdog_Plan.js', at(21, -1)); iff('Mailbox Down?', '{{ !$json.skip }}', at(22, -1)); iff('Deactivate First?', "{{ $json.action === 'reactivate' }}", at(23, -2))


def api_post(name, url_expr, pos):
    """deactivate / activate through n8n's public API. Both are idempotent (a second activate of an active workflow changes nothing), so the
    one retry rule applies; neverError + fullResponse so the result node reads the status code and n8n's own reason (a 400 when the IMAP
    server cannot be reached is "not listening", never "re-activated")."""
    return node(name, 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': url_expr, 'authentication': 'genericCredentialType', 'genericAuthType': 'httpHeaderAuth',
        'options': {'timeout': 30000, 'response': {'response': {'fullResponse': True, 'neverError': True}}}},
        pos, credentials=CRED, onError='continueRegularOutput', alwaysOutputData=True, executeOnce=True, **retry_lint.RETRY)


api_post('Deactivate Mailbox', "={{ $('Watchdog Plan').first().json.deactivate_url }}", at(24, -2))
api_post('Activate Mailbox', "={{ $('Watchdog Plan').first().json.activate_url }}", at(25, -1))
code('Watchdog Result', 'Watchdog_Result.js', at(26, -1))
node('Save Watchdog State', DT_TYPE, DT_VERSION, dt_upsert_params(CACHE_TABLE, CACHE_COLS, 'key'), at(27, -1), **SAVE)
code('Watchdog Alarm', 'Watchdog_Alarm.js', at(28, -1))

link('Instance Started', 'Let n8n Start'); link('Let n8n Start', 'Catch-up Entry'); link(SWEEP, 'Catch-up Entry'); link('Catch-up Run', 'Catch-up Entry')
for a, b in [('Catch-up Entry', 'Ensure Cache Table (Catch-up)'), ('Ensure Cache Table (Catch-up)', 'Load Catch-up Records'), ('Load Catch-up Records', 'Load Run Ledger (Catch-up)'),
             ('Load Run Ledger (Catch-up)', 'Catch-up Targets'), ('Catch-up Targets', 'Read Workflows (Catch-up)'), ('Read Workflows (Catch-up)', 'Execution Requests (Catch-up)'),
             ('Execution Requests (Catch-up)', 'Read Executions (Catch-up)'), ('Read Executions (Catch-up)', 'Catch-up Plan'), ('Catch-up Plan', 'Catch-up State Rows'),
             ('Catch-up State Rows', 'Any State?'), ('Save Catch-up State', 'Catch-up Start Items'), ('Catch-up Start Items', 'Any Starts?'),
             ('Catch-up Record Row', 'Save Catch-up Record'), ('Save Catch-up Record', 'Confirm Claim'), ('Confirm Claim', 'Catch-up Payload'), ('Catch-up Payload', 'Recorded?'),
             ('Start Missed Run', 'Catch-up Start Result'), ('Catch-up Start Result', 'Save Start Result'), ('Save Start Result', 'Space Starts'),
             ('Space Starts', 'Loop Catch-ups'), ('Catch-up Report', 'Save Catch-up Report')]:
    link(a, b)
link('Any State?', 'Save Catch-up State', 0); link('Any State?', 'Catch-up Start Items', 1)
link('Any Starts?', 'Loop Catch-ups', 0); link('Any Starts?', 'Catch-up Report', 1)
link('Loop Catch-ups', 'Catch-up Report', 0); link('Loop Catch-ups', 'Catch-up Record Row', 1)   # splitInBatches v3: 0 = done, 1 = loop
link('Recorded?', 'Start Missed Run', 0); link('Recorded?', 'Loop Catch-ups', 1)
for a, b in [('Save Catch-up Report', 'Read Mailbox Workflow (Watchdog)'), ('Read Mailbox Workflow (Watchdog)', 'Load Mailbox Alerts (Watchdog)'),
             ('Load Mailbox Alerts (Watchdog)', 'Watchdog Plan'), ('Watchdog Plan', 'Mailbox Down?'), ('Deactivate Mailbox', 'Activate Mailbox'),
             ('Activate Mailbox', 'Watchdog Result'), ('Watchdog Result', 'Save Watchdog State'), ('Save Watchdog State', 'Watchdog Alarm')]:
    link(a, b)
link('Mailbox Down?', 'Deactivate First?', 0); link('Mailbox Down?', 'Watchdog Result', 1)
link('Deactivate First?', 'Deactivate Mailbox', 0); link('Deactivate First?', 'Activate Mailbox', 1)

table = '\n'.join('| %s | `%s` | %s | %s |' % (s['label'], s['cron'], s['kind'], s['entry_node']) for s in SCHED)
node('Note', 'n8n-nodes-base.stickyNote', 1, {'width': 1500, 'height': 520, 'color': 6, 'content': """## SEO Agent — Schedule Catch-up (R94, 2026-10-16)
A cron fire lives only in n8n's memory: a **restart, a deploy or a re-publish re-arms every schedule for its NEXT time**, so a fire that was due and not yet delivered is lost (the 2026-10-12 16:38 deploy restart dropped five Monday runs), and while the Mac sleeps the timers stop, so fires arrive late.
**Doors:** *Instance Started* (n8n's own `init` event; waits 45 s for the instance to settle) — every schedule has just been re-armed, so a past fire not yet run is certainly lost; *""" + SWEEP + """* (`""" + SWEEP_CRON + """`) — a schedule re-published after its due time lost its fire too, and a fire left hanging by sleep is started once it is """ + str(CONFIG['late_minutes']) + """ min late (its delayed timer is then refused by its own run guard); *Catch-up Run* — a test (`{ plan_only?, dry_run?, now? }`; `now` only with `plan_only`). No execution time-out (C-1: n8n counts it in wall-clock time, so a Mac asleep mid-node cancelled sweep 728); instead a plan older than """ + str(CONFIG['stale_plan_minutes']) + """ min is never acted on.
**Evidence:** n8n's public API (credential *n8n API (SEO Agent catch-up)* from `N8N_API_KEY`): the workflow (on? last published = schedule re-armed) and its executions — mode `trigger` is a fire; an on-demand run does **not** count as the week's scheduled run (owner decision, `count_on_demand`). The catch-up's own records in `seo_cache` (`catchup:<workflow>:<due ISO>`), the live reservations in `seo_run_ledger`.
**Start:** RECORD the key (with this execution's claim), read it back (*Confirm Claim*: two sweeps racing start a fire once), THEN start the workflow through its own manual entry with no site (`{ trigger: 'catchup', scheduled_for, why, late_min }` - its report says it ran late and why), so it runs every site exactly as its schedule does and passes its own ledger row and concurrency gate; at most """ + str(CONFIG['max_starts']) + """ a sweep, 30 s apart, never more than the run guard has room for. A slot stays due for its whole period (a Monday run missed on Monday is the week's run until the next Monday, a monthly one all month) unless its next fire is close, never one due before the catch-up first ran. A start that failed, was refused, never appeared (the sweep stopped after recording it) or was cancelled before it finished is tried again, """ + str(CONFIG['max_attempts']) + """ attempts in all. A dry run (`catchup_dry:` keys) starts only AI Growth (no Bing / IndexNow submission) and the Content Cadence (plans only).
**Record:** `seo_cache` `catchup:last` (tests: `catchup:last_test`) — one line per schedule with its due time and verdict. Successful executions are not kept (every 15 minutes).
Time zone **""" + TZ + """** (GENERIC_TIMEZONE, set in n8n/compose.yml).

| Workflow | cron | kind | manual entry |
|---|---|---|---|
""" + table}, [-40, -720])

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
# what the harness reads (S126-S129) and build section 98 extends: the schedule table as baked, and the settings it was baked with
json.dump({'workflow': {'id': WID, 'name': NAME, 'file': FILE}, 'tz': TZ, 'default_tz': DEFAULT_TZ, 'n8n_api': N8N_API, 'credential': CRED['httpHeaderAuth']['id'],
           'config': CONFIG, 'exec_limit': EXEC_LIMIT, 'schedules': SCHED, 'watchdog': WATCH},
          open(os.path.join(HERE, 'harness', 'catchup_wiring.json'), 'w'), indent=1, sort_keys=True)
print('wrote', FILE + ':', len(N), 'nodes;', len(SCHED), 'schedules caught up (' + TZ + ')')
