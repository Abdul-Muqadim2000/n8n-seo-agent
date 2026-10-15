#!/usr/bin/env python3
"""Builds the ladder extras: SEO Agent — Rank Tracker (weekly), SEO Agent — Publish to WordPress (optional, inactive),
SEO Agent — Test Runner (local testing only). Code nodes are also written to harness/code_v4 for the offline harness."""
import json, os, re, uuid, sys
import url_lint   # D15 (2026-10-11 system review): the canonical-host lint
import env_settings as _env   # B-F5 (2026-10-15): a build with no n8n/.env must refuse, not bake its fallbacks
_env.require_settings('build_ladder_extras.py')
import retry_lint   # G1 (2026-10-11 system review): one retry rule for every external HTTP node
import dfs_gate     # B-A10 (2026-10-15): INVARIANTS rule 3 — the in-200 retry gate, one shape for every DataForSEO call
from ladder_common import (LADDER_TABLE, HISTORY_TABLE, LADDER_COLS, HISTORY_COLS, LOG_TABLE, PAGES_TABLE, PAGES_COLS, SITES_TABLE, SITES_COLS,
                           MONITORS_TABLE, MONITORS_COLS, DT_TYPE, DT_VERSION, dt_create_params, dt_insert_params, dt_get_all_params, dt_get_where_params,
                           RUN_LEDGER_TABLE, RUN_LEDGER_COLS, dt_update_params, monitor_ledger_js, LEDGER_EST,   # R9 (2026-10-13)
                           ledger_mainline)   # R17 (2026-10-14): the reserve chain sits on the MAIN path, before the first paid call
HERE = os.path.dirname(os.path.abspath(__file__))
V5 = os.path.join(HERE, 'v5'); OUT = os.path.join(HERE, 'workflows'); CODE = os.path.join(HERE, 'harness', 'code_v4')
_rd0 = lambda p: open(os.path.join(V5, p), encoding='utf-8').read()
# shared kits, one copy each, inlined where a node asks for them (2026-10-11, FIX_PLAN D9: the anchor words a link to our own page uses;
# G6: _serp_obs.js carries the observation rules a results-page reading must be worded with, _rank_serp.js reads the page itself)
import seo_events   # 2026-10-13 (G12 / G29): the dated event registry and the lineage / annotation / change-test kits
rd = lambda p: (seo_events.inline(_rd0(p)).replace('/*__ANCHOR__*/', _rd0('code/_anchor.js').rstrip('\n'))
                .replace('/*__SITE_MODEL__*/', _rd0('code/_site_model.js').rstrip('\n'))
                .replace('/*__SERP_OBS__*/', _rd0('code/_serp_obs.js').rstrip('\n'))
                .replace('/*__FIT_GATE__*/', _rd0('code/_fit_gate.js').rstrip('\n'))   # R16 (build_v4.py section 53): the gate also reads the rungs stored before it existed
                .replace('/*__RANK_SERP__*/', _rd0('code/_rank_serp.js').rstrip('\n'))
                .replace('/*__REPLAN__*/', _rd0('code/_replan.js').rstrip('\n')))   # G32: the re-plan proposal for a stuck ladder
NS = uuid.UUID('5e0a9e1e-2a1f-4c0b-9d8e-0000a9e0c0de')
nid = lambda name: str(uuid.uuid5(NS, 'extras:' + name))
MAIN_WF = json.load(open(os.path.join(OUT, 'SEO_Agent_v4.json')))[0]
FORM_PATH = next(n for n in MAIN_WF['nodes'] if n['name'] == 'Start Form')['webhookId']
BASE_URL = os.environ.get('N8N_PUBLIC_URL', 'http://localhost:5678').rstrip('/')
FORM_URL, API_URL = BASE_URL + '/form/' + FORM_PATH, BASE_URL + '/webhook/seo-keyword-check'
SMTP = {'smtp': {'id': 'SEOcredSmtpGmail', 'name': 'Gmail SMTP (SEO Agent)'}}
DFS = {'httpBasicAuth': {'id': 'SEOcredDataForSE', 'name': 'DataForSEO'}}
from env_settings import SENDER, BRAND, OPS_EMAIL, SA_EMAIL   # from n8n/.env at build time (run apply_env.py after editing .env)

def wf(wid, name, nodes, conns, settings=None):
    return {'id': wid, 'name': name, 'active': False, 'settings': {'executionOrder': 'v1', 'errorWorkflow': 'SEOagentErrHandl', 'executionTimeout': 1800, 'saveDataErrorExecution': 'all', 'saveDataSuccessExecution': 'all', **(settings or {})}, 'tags': [], 'nodes': nodes, 'connections': conns}
def node(name, ntype, ver, params, pos, **extra):
    n = {'parameters': params, 'id': nid(name), 'name': name, 'type': ntype, 'typeVersion': ver, 'position': pos}; n.update(extra); return n
def code(name, src, pos, **extra): return node(name, 'n8n-nodes-base.code', 2, {'jsCode': src}, pos, **extra)
def iff(name, expr, pos):
    return node(name, 'n8n-nodes-base.if', 2.3, {'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'loose', 'version': 3}, 'conditions': [{'id': nid(name + ':c'), 'leftValue': '=' + expr, 'rightValue': '', 'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}], 'combinator': 'and'}, 'looseTypeValidation': True, 'options': {}}, pos)
def sticky(name, content, pos, w, h, color=5): return node(name, 'n8n-nodes-base.stickyNote', 1, {'content': content, 'height': h, 'width': w, 'color': color}, pos)
def link(conns, a, b, out=0):
    outs = conns.setdefault(a, {}).setdefault('main', [])
    while len(outs) <= out: outs.append([])
    outs[out].append({'node': b, 'type': 'main', 'index': 0})
LEDGER_WIRING = {}   # R9: filled in when the Rank Tracker's ledger nodes are added, below

def write(wfobj, fname):
    # R17 (2026-10-14, FIX_PLAN §3.12): the reserve chain goes on the MAIN path, now that every connection of this workflow is made
    if wfobj.get('name') in LEDGER_WIRING: ledger_mainline(wfobj, LEDGER_WIRING[wfobj['name']])
    url_lint.check(wfobj, wfobj.get('name') or fname)   # D15: no node builds a site URL by hand (url_lint.py)
    retry_lint.check(wfobj, wfobj.get('name') or fname)   # G1: every external HTTP node carries the retry rule (retry_lint.py)
    for _n in wfobj['nodes']:   # e-mails retry a transient SMTP / DNS failure (live finding 2026-10-02: EAI_AGAIN smtp.gmail.com)
        if _n['type'] == 'n8n-nodes-base.emailSend': _n.update({'retryOnFail': True, 'maxTries': 3, 'waitBetweenTries': 5000})
    names = {n['name'] for n in wfobj['nodes']}
    for src, outs in wfobj['connections'].items():
        assert src in names, src
        for lst in outs['main']:
            for t in lst: assert t['node'] in names, t['node']
    json.dump([wfobj], open(os.path.join(OUT, fname), 'w'), indent=2, ensure_ascii=False)
    os.makedirs(CODE, exist_ok=True)
    for n in wfobj['nodes']:
        if n['type'] == 'n8n-nodes-base.code': open(os.path.join(CODE, re.sub(r'[^A-Za-z0-9_.-]+', '_', n['name']) + '.js'), 'w').write(n['parameters']['jsCode'])
    print('wrote', fname + ':', len(wfobj['nodes']), 'nodes')

# =============================================================================
# 1. SEO Agent — Rank Tracker (weekly; recommend-only)
# =============================================================================
DFS_HTTP = {'method': 'POST', 'url': '={{ $json.endpoint }}', 'authentication': 'genericCredentialType', 'genericAuthType': 'httpBasicAuth', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify($json.body) }}', 'options': {'batching': {'batch': {'batchSize': 1, 'batchInterval': 300}}, 'timeout': 90000}}
tracker_report = rd('code/Tracker_Report.js').replace('__FORM_URL__', FORM_URL).replace('__API_URL__', API_URL)
N = []; C = {}
N.append(node('Weekly Schedule', 'n8n-nodes-base.scheduleTrigger', 1.2, {'rule': {'interval': [{'field': 'weeks', 'weeksInterval': 1, 'triggerAtDay': [1], 'triggerAtHour': 8, 'triggerAtMinute': 0}]}}, [0, 0]))
N.append(node('Manual Run', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, {'inputSource': 'passthrough'}, [0, 220]))
N.append(node('Ensure Ladder Table', DT_TYPE, DT_VERSION, dt_create_params(LADDER_TABLE, LADDER_COLS), [240, 100], onError='continueRegularOutput'))
N.append(node('Ensure History Table', DT_TYPE, DT_VERSION, dt_create_params(HISTORY_TABLE, HISTORY_COLS), [460, 100], onError='continueRegularOutput'))
N.append(node('Load Ladders', DT_TYPE, DT_VERSION, dt_get_all_params(LADDER_TABLE), [680, 100], alwaysOutputData=True, executeOnce=True, onError='continueRegularOutput'))
N.append(node('Load History', DT_TYPE, DT_VERSION, dt_get_all_params(HISTORY_TABLE), [900, 100], alwaysOutputData=True, executeOnce=True, onError='continueRegularOutput'))
# v4.8: publish dates for the Stuck flag. R1 (2026-10-13): every row, not only the published ones — the report must be able to tell a page that
# was really written (`written`) from a ladder row that only says `writing` (live: it told the owner to publish a page nobody had written).
N.append(node('Load Content Log (Tracker)', DT_TYPE, DT_VERSION, dt_get_all_params(LOG_TABLE), [1010, 260], alwaysOutputData=True, executeOnce=True, onError='continueRegularOutput'))
# D11 (2026-10-12, FIX_PLAN): the site's page inventory, so the next step never says "publish it" for a search a live page already answers
N.append(node('Ensure Pages Table (Tracker)', DT_TYPE, DT_VERSION, dt_create_params(PAGES_TABLE, PAGES_COLS), [1010, 400], onError='continueRegularOutput'))
N.append(node('Load Pages (Tracker)', DT_TYPE, DT_VERSION, dt_get_all_params(PAGES_TABLE), [1120, 400], alwaysOutputData=True, executeOnce=True, onError='continueRegularOutput'))
# G6 (2026-10-12, FIX_PLAN): the site's competitors, so each check records the competitors' positions and the share of voice from the
# same SERP answer. The one site model merges seo_monitors.competitors with the seo_sites model column (SITE_MODEL_SPEC.md).
N.append(node('Ensure Sites Table (Tracker)', DT_TYPE, DT_VERSION, dt_create_params(SITES_TABLE, SITES_COLS), [1010, 540], onError='continueRegularOutput'))
N.append(node('Load Sites (Tracker)', DT_TYPE, DT_VERSION, dt_get_all_params(SITES_TABLE), [1120, 540], alwaysOutputData=True, executeOnce=True, onError='continueRegularOutput'))
N.append(node('Ensure Monitors Table (Tracker)', DT_TYPE, DT_VERSION, dt_create_params(MONITORS_TABLE, MONITORS_COLS), [1010, 680], onError='continueRegularOutput'))
N.append(node('Load Monitors (Tracker)', DT_TYPE, DT_VERSION, dt_get_all_params(MONITORS_TABLE), [1120, 680], alwaysOutputData=True, executeOnce=True, onError='continueRegularOutput'))
N.append(code('Tracker Plan', rd('code/Tracker_Plan.js'), [1120, 100]))
N.append(iff('Any Checks?', '{{ !$json.nothing_to_do }}', [1340, 100]))
N.append(node('SERP Check', 'n8n-nodes-base.httpRequest', 4.5, DFS_HTTP, [1560, 0], credentials=DFS, onError='continueRegularOutput', **retry_lint.RETRY))
N.append(code('Parse Positions', rd('code/Parse_Positions.js'), [1780, 0]))
N.append(node('Save History', DT_TYPE, DT_VERSION, dt_insert_params(HISTORY_TABLE, HISTORY_COLS), [2000, 0], onError='continueRegularOutput'))
N.append(code('Tracker Report', tracker_report, [2220, 0], executeOnce=True))
N.append(iff('Has Report?', '{{ !$json.nothing_to_do }}', [2440, 0]))
N.append(iff('Has Email (Tracker)?', '{{ !!$json.email }}', [2660, -100]))
N.append(node('Send Progress Email', 'n8n-nodes-base.emailSend', 2.1, {'fromEmail': SENDER, 'toEmail': '={{ $json.email }}', 'subject': '={{ $json.subject }}', 'emailFormat': 'html', 'html': '={{ $json.html }}', 'options': {'appendAttribution': False}}, [2880, -100], credentials=SMTP, onError='continueRegularOutput'))
N.append(iff('Has Callback (Tracker)?', '{{ !!$json.callback_url }}', [2660, 120]))
N.append(node('POST Progress', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': '={{ $json.callback_url }}', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': "={{ JSON.stringify({ status: 'progress', stage: 'rank_tracker', request_id: $json.request_id || null, ladder_id: $json.ladder_id, domain: $json.domain, head_keyword: $json.head_keyword, checked_at: $json.checked_at, positions: $json.positions, rungs: $json.rungs, gains: $json.gains, drops: $json.drops, serp_summary: $json.serp_summary, next_step: $json.next_step, links_to_add: $json.links_to_add || [], api_body: $json.api_body, done: $json.done, won: !!$json.won, stuck: !!$json.stuck }) }}", 'options': {'timeout': 20000}}, [2880, 120], onError='continueRegularOutput'))
N.append(node('Nothing To Track', 'n8n-nodes-base.noOp', 1, {}, [1560, 260]))
N.append(sticky('Note', f"""## SEO Agent — Rank Tracker
Runs **weekly (Monday 08:00)** and on demand through *Manual Run* (Execute Workflow Trigger). Reads every ladder from the Data Table `{LADDER_TABLE}` (written by the ladder mode of SEO Agent v4; both tables are created on first use), checks the Google top 50 for each page's primary keyword and the head term (DataForSEO SERP live, about $0.015 per keyword; a 9-page ladder costs about $0.60 per month), appends `{HISTORY_TABLE}`, and sends one progress e-mail / callback per ladder: positions vs the previous check, rungs in the top 10 / top 3, drops of 5+ positions, and the **recommended next rung** with a form link and a ready-to-send API body (recommend-only mode).
Guardrails: at most 15 keywords per ladder and 120 checks per run; once its top page has held the top 3 for 4 consecutive checks (failed checks skipped) a ladder is **won** and checked **monthly** (main keyword + published pages, v4.8) so a drop is noticed; a drop below the top 3 brings it back to weekly checks.
v4.8: the callback carries display-only flags per ladder for the web app (the e-mail is unchanged): `won` (main keyword in the top 3 in each of the last 4 checks, this one included) and `stuck` (pages published, the first 8+ weeks ago — dates from `{LOG_TABLE}` — and none improved its position over the last 8 weeks).
**v4.16 (G6, 2026-10-12 system review): the whole results page, from the same call.** Every check now stores what the page showed — AI Overview (shown, and whether it cites us), featured snippet, People Also Ask, local pack, video, shopping —, the **top-10 domains with their positions**, the **tracked competitors' positions** (`{MONITORS_TABLE}` + the `{SITES_TABLE}` model column, merged by the one site model), a **share of voice** modelled on a published CTR curve, and a compact **snapshot of the top 10** (URLs + trimmed titles) as proof of the reading (`v5/code/_rank_serp.js`; columns `device` / `features_json` / `competitors_json` / `snapshot_json` / `share_of_voice`). All of it is free: it comes out of the SERP answer the check already pays for.
The only new spend is the **mobile check** of the ladder's main keywords (top rung + main page, at most 2 a ladder, once a week; a run started by hand inside 6 days reuses the last one): one more depth-50 call each, the measured **$0.015**, so about **$0.13 a month** for a ladder next to the ~$0.60 it costs today. Only 13% of sites hold the same position on both devices (Semrush, 50k keywords), so a desktop-only position is one most visitors never see. A **won** ladder's mobile check follows its monthly rhythm.
Wording rules: a call that failed stores `unavailable` and leaves every flag null — "check again", exactly as position -1, never "no AI Overview"; an AI Overview Google loads asynchronously comes back without its sources (loading them costs extra, which we do not buy), so "cites you" is then **unknown**, never "no"; the share of voice always travels with the sentence that says it is modelled, not measured clicks.
**v4.17 (B6-7, 2026-10-15): the keywords YOU named are watched too.** `{SITES_TABLE}.keywords` - the list from the tracking form or "Track my site" - is a second source beside the ladders, reported as its own weekly mail ("[Tracked keywords] ...") with the same depth: position, the reading's date, share of voice, how much the results page itself moved, who is above you. **Read first, buy second:** a results page the weekly site check already read less than 10 days ago is read, not bought again, and a keyword that is also a ladder rung is checked once, with the ladder. What is bought is capped at **10 a website and 30 a run**, oldest reading first (the measured $0.015 each, so at most ~$0.15 a website a week), and every keyword the cap did not reach is named with the cap and its last reading. The same keyword rule that guards the stored rungs runs over the list, so a competitor's brand typed into a form is set aside with its reason instead of being tracked. Its readings are stored under `watch_<site_id>`.
Form: {FORM_URL} · API: {API_URL}""", [-40, -560], 1000, 600))
for a, b in [('Weekly Schedule', 'Ensure Ladder Table'), ('Manual Run', 'Ensure Ladder Table'), ('Ensure Ladder Table', 'Ensure History Table'), ('Ensure History Table', 'Load Ladders'), ('Load Ladders', 'Load History'), ('Load History', 'Load Content Log (Tracker)'), ('Load Content Log (Tracker)', 'Ensure Pages Table (Tracker)'), ('Ensure Pages Table (Tracker)', 'Load Pages (Tracker)'),
                 ('Load Pages (Tracker)', 'Ensure Sites Table (Tracker)'), ('Ensure Sites Table (Tracker)', 'Load Sites (Tracker)'),
                 ('Load Sites (Tracker)', 'Ensure Monitors Table (Tracker)'), ('Ensure Monitors Table (Tracker)', 'Load Monitors (Tracker)'),
                 ('Load Monitors (Tracker)', 'Tracker Plan'), ('Tracker Plan', 'Any Checks?'), ('SERP Check', 'Parse Positions'), ('Parse Positions', 'Save History'), ('Save History', 'Tracker Report'), ('Tracker Report', 'Has Report?')]:
    link(C, a, b)
link(C, 'Any Checks?', 'SERP Check', 0); link(C, 'Any Checks?', 'Nothing To Track', 1)
link(C, 'Has Report?', 'Has Email (Tracker)?', 0); link(C, 'Has Report?', 'Has Callback (Tracker)?', 0)
link(C, 'Has Email (Tracker)?', 'Send Progress Email', 0); link(C, 'Has Callback (Tracker)?', 'POST Progress', 0)
# G6 (2026-10-12, FIX_PLAN): the two kits the tracker path needs must really be inlined (a left-over placeholder would ship a broken node),
# and the row Save History receives must be exactly the table's columns (the Data Table node auto-maps every input field).
_tracker_nodes = {n['name']: n['parameters'].get('jsCode', '') for n in N if n['type'] == 'n8n-nodes-base.code'}
for _n in ('Parse Positions', 'Tracker Report'):
    assert 'const RS = (() => {' in _tracker_nodes[_n], _n + ': the results-page kit (_rank_serp.js) is not inlined'
    assert 'const aioObserved' in _tracker_nodes[_n], _n + ': the observation rules (_serp_obs.js) are not inlined'
assert 'const SM = (() => {' in _tracker_nodes['Tracker Plan'], 'Tracker Plan: the site model kit is not inlined (needed for the competitor list)'
assert not any(m in src for src in _tracker_nodes.values() for m in ('/*__RANK_SERP__*/', '/*__SERP_OBS__*/', '/*__SITE_MODEL__*/', '/*__ANCHOR__*/', '/*__REPLAN__*/', '/*__FIT_GATE__*/')), 'kit placeholder left in the Rank Tracker'
# G32 (2026-10-13, FIX_PLAN): the stuck ladder's re-plan proposal, and the proof that it only proposes
assert 'const RP = (() => {' in _tracker_nodes['Tracker Report'], 'Tracker Report: the re-plan kit (_replan.js) is not inlined'
assert 'RP.propose(' in _tracker_nodes['Tracker Report'] and 'RP.block(replan)' in _tracker_nodes['Tracker Report'], 'Tracker Report: the re-plan proposal is not built or not shown'
assert 'applied: false' in _tracker_nodes['Tracker Report'], 'G32: a re-plan must say that nothing was applied'
# R16 (2026-10-13, FIX_PLAN §3.11, build_v4.py section 53): a stored rung that names another company is set aside, not checked and not reported as a page to write
assert 'const fitStored = ' in _tracker_nodes['Tracker Plan'] and 'fitStored(p, fitCtx)' in _tracker_nodes['Tracker Plan'], 'R16: the Rank Tracker does not run the fit gate over the stored rungs'
assert 'const fitStored = ' in _tracker_nodes['Tracker Report'] and 'serp_domains: doms' in _tracker_nodes['Tracker Report'], 'R16: the Rank Tracker report does not judge the rungs against the results page it just read'
assert 'set_aside_pages' in _tracker_nodes['Tracker Plan'] and 'set_aside_pages' in _tracker_nodes['Tracker Report'] and 'Set aside' in _tracker_nodes['Tracker Report'], 'R16: the set-aside rungs do not reach the report'
for _c, _t in HISTORY_COLS:
    assert _c + ':' in _tracker_nodes['Parse Positions'], 'Parse Positions does not write the seo_rank_history column ' + _c
# ---- R9 (2026-10-13, re-rating): the Rank Tracker reserves and settles a seo_run_ledger row too (exec 505 had none, although the week's SERP
# checks are paid DataForSEO calls). Hung BESIDE *Tracker Plan*: a Data Table node answers with the row it wrote, not with its input. ----
# B6-7 (2026-10-15): the settle takes the figure the in-200 gate MEASURED for exactly these calls instead of the reservation it made.
# *Tracker Report* carries it on its first item as `cost_usd` (Monitor_Ledger_Settle's costOf reads that key); a run whose evidence
# block could not be read carries none, so `measured` stays null and the settle says so rather than inventing a figure.
_lrr, _lrs = monitor_ledger_js(V5, 'rank_tracker', 'Tracker Plan', 'Run Ledger Row (Tracker)', 'Tracker Report')
# the reservation counts CHECKS, not sites, so its own sentence has to say so (INVARIANTS rule 1: a figure carries its basis)
_lrr = _lrr.replace("' site(s) x the per-site figure), DataForSEO $'", "' keyword check(s) x the measured per-check price), DataForSEO $'")
assert 'keyword check(s) x the measured per-check price' in _lrr, 'B6-7: the Rank Tracker ledger row still calls its checks sites'
N.append(node('Ensure Run Ledger (Tracker)', DT_TYPE, DT_VERSION, dt_create_params(RUN_LEDGER_TABLE, RUN_LEDGER_COLS), [1230, 480], onError='continueRegularOutput', executeOnce=True))
N.append(node('Run Ledger Row (Tracker)', 'n8n-nodes-base.code', 2, {'jsCode': _lrr}, [1450, 480], executeOnce=True))
N.append(node('Reserve Run Ledger (Tracker)', DT_TYPE, DT_VERSION, dt_insert_params(RUN_LEDGER_TABLE, RUN_LEDGER_COLS), [1670, 480], onError='continueRegularOutput', alwaysOutputData=True, executeOnce=True))
N.append(node('Ledger Settle (Tracker)', 'n8n-nodes-base.code', 2, {'jsCode': _lrs}, [1450, 640], executeOnce=True))
N.append(node('Settle Run Ledger (Tracker)', DT_TYPE, DT_VERSION, dt_update_params(RUN_LEDGER_TABLE, RUN_LEDGER_COLS,
    [('run_id', '={{ $execution.id }}'), ('status', 'reserved')],
    # R31 (2026-10-14, FIX_PLAN §3.13): the honest split the settle computes (G23) never reached the row here — only the status and two
    # figures were written back. The same columns build_monitors.py writes are written now.
    {'status': 'done', 'settled_usd': '={{ $json.settled_usd }}', 'dfs_usd': '={{ $json.dfs_usd }}', 'ai_usd': '={{ $json.ai_usd }}',
     'cost_mode': '={{ $json.cost_mode }}', 'measured_usd': '={{ $json.measured_usd }}', 'estimated_usd': '={{ $json.estimated_usd }}',
     'cost_basis': '={{ $json.cost_basis }}'}),
    [1670, 640], onError='continueRegularOutput', alwaysOutputData=True, executeOnce=True))
for a, b in [('Tracker Plan', 'Ensure Run Ledger (Tracker)'), ('Ensure Run Ledger (Tracker)', 'Run Ledger Row (Tracker)'), ('Run Ledger Row (Tracker)', 'Reserve Run Ledger (Tracker)'),
             ('Tracker Report', 'Ledger Settle (Tracker)'), ('Ledger Settle (Tracker)', 'Settle Run Ledger (Tracker)')]:
    link(C, a, b)
LEDGER_WIRING['SEO Agent — Rank Tracker'] = {'mode': 'rank_tracker', 'plan': 'Tracker Plan', 'reserve': 'Run Ledger Row (Tracker)',
                                             'settle': 'Settle Run Ledger (Tracker)', 'settle_from': ['Tracker Report'], 'measured': 'Tracker Report', 'est': LEDGER_EST['rank_tracker'],
                                             'resume': 'After Run Ledger (Tracker)'}   # R17 (2026-10-14): hands Tracker Plan's items back
# ---- B-A10 (2026-10-15, INVARIANTS rule 3): the week's rank checks go through the in-200 retry gate ----
# The reading side was already honest (RS.read counts a task error inside a 200 as failed, position -1 is "check again" and never
# "does not rank") — what was missing was the second attempt. A week's position, the trend it feeds and the "won" rule all rest on
# this one call, so a provider-side failure that nobody re-sends is a week of a ladder's history lost for $0.015.
_wf_tracker = wf('SEOagentTracker1', 'SEO Agent — Rank Tracker', N, C)
_gt = dfs_gate.splice(_wf_tracker, 'SERP Check', V5, what='the live Google results for the week\'s tracked keywords',
                      unit='keyword check', code_dir=CODE)
retry_lint.record_gate('SEO Agent — Rank Tracker', _gt['chain'])
# and it is SAID: the progress note names what could not be read, so a smaller week is not read as a fall (R19's rule)
_tr9 = next(n for n in _wf_tracker['nodes'] if n['name'] == 'Tracker Report')
_js9 = _tr9['parameters']['jsCode']
_anchor9 = "const plan = $('Tracker Plan').all().map(i => i.json).filter(p => p && !p.nothing_to_do);"
assert _js9.count(_anchor9) == 1, 'B-A10: the Rank Tracker report does not start from the plan any more'
_js9 = _js9.replace(_anchor9, _anchor9 + "\n"
    "// B-A10 (2026-10-15, INVARIANTS rule 3): what the week's checks really did — asked, answered, failed, sent again — read from\n"
    "// the gate's own evidence block. A week measured on fewer keywords than the last one is not a fall, and now it says so.\n"
    "const checkEvidence = (() => { try { return $('SERP Check Answers').first().json.__dfs || null; } catch (e) { return null; } })();", 1)
_sum9 = "head_line: headSerp ? headSerp.line : '', mobile_checked: rowsK.filter(r => (mobiles.get(r.keyword) || {}).fresh).length };"
assert _js9.count(_sum9) == 1, 'B-A10: the Rank Tracker summary does not end where it used to'
_js9 = _js9.replace(_sum9, "head_line: headSerp ? headSerp.line : '', mobile_checked: rowsK.filter(r => (mobiles.get(r.keyword) || {}).fresh).length,\n"
    "    checks: checkEvidence ? { asked: checkEvidence.asked, read: checkEvidence.checked, failed: checkEvidence.failed,\n"
    "      sent_again: checkEvidence.retried, answered_on_retry: checkEvidence.retry_answered, unavailable: checkEvidence.unavailable,\n"
    "      note: checkEvidence.note || '', cost_usd: checkEvidence.cost_usd ?? null, cost_basis: checkEvidence.cost_basis || '' } : null };", 1)
_tr9['parameters']['jsCode'] = _js9
assert "$('SERP Check Answers')" in _js9 and 'checks: checkEvidence' in _js9, 'B-A10: the Rank Tracker report cannot see what the checks did'
# ---- B6-1 / B6-2 / B6-3 / B6-5 (2026-10-15, benchmark area 6 - docs/system-review-2026-10-14/BENCH_AREA6_rank_tracking.md) ----
# A position is one reading of one results page at one moment; the leaders answer "what happened on a volatile day" with a
# market-wide index (Semrush Sensor 0-10, AccuRanker's Google Grump over ~1,000,000 keywords). Ours now answers it for THIS
# keyword, measured from the snapshots the check already stores, and every move is printed with it.
_rs6 = _rd0('code/_rank_serp.js')
assert 'const AIO_KEEP = [0.420, 0.492, 0.536,' in _rs6 and 'ORGANIC_LEFT_WITH_AIO' not in _rs6, \
    'B6-1: the share of voice still cuts every position by the flat April 2025 AI Overview factor'
assert 'https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/' in _rs6 and 'December 2025 data (published 2026-02-04)' in _rs6, \
    'B6-1: a measured click loss must carry the study and the date it was measured on'
assert 'const churn = (prev, cur, o) =>' in _rs6 and 'const churnNone = (reason) =>' in _rs6, 'B6-2: the page-movement kit is missing'
assert "churnNone('no earlier reading of this results page is stored" in _rs6, 'B6-2: a missing earlier reading must not come back as no movement'
assert "stated rule, not a measurement" in _rs6, 'B6-2: the still / some / high labels must say they are a rule and not a measurement'
_tr6 = _tracker_nodes['Tracker Report']
for _a6, _m6 in (("const changes = new Map(rowsK.map(r => [r.keyword,", 'B6-2: the report does not measure how much each results page moved'),
                 ('const drops = rowsK.filter(r => r.delta != null && r.delta <= -5).map(withMove);', 'B6-2: a drop is still printed with nothing beside it'),
                 ('const gains = rowsK.filter(r => r.delta != null && r.delta >= 5).map(withMove);', 'B6-2: a gain is still printed with nothing beside it'),
                 ('RS.churnNone(\'no check was bought for this keyword this week', 'B6-2: a keyword nobody checked this week must say so, not report no movement'),
                 ('const updateLine = sinceMarks.length ?', 'B6-3: a Google update inside the compared window is not named'),
                 ('const staleRead = (r) =>', 'B6-2: the "Before" column never says how old it is'),
                 ('const costHtml = (() => {', 'B6-5: the week\'s checks are costed for nobody (criterion 2.14)'),
                 ('serp_change: changes.get(r.keyword) || null', 'B6-2: the movement never reaches the app through the callback'),
                 ("LN.unknown('How much the results page itself moved'", 'B6-2: the new figure has no lineage row for the case where it could not be measured')):
    assert _a6 in _tr6, _m6
assert "page_movement: { compared:" in _tr6 and "labels_basis: RS.CHURN.labels_basis" in _tr6, 'B6-2: the ladder summary carries no movement figure with its basis'
assert 'The provider reported no cost for these calls' in _tr6, 'B6-5: a cost the provider did not report must not be invented'
# ---- B6-7 (2026-10-15, benchmark area 6 - BENCH_AREA6_rank_tracking.md gap G6-8 / section 7, register row B6-7) ----
# A rank tracker tracks whatever keyword list you give it. Ours tracked `seo_ladders` and nothing else, so the thirty searches a
# business names when it sets tracking up were not watched by the tracker bought for exactly that. `seo_sites.keywords` is now a
# second source with its own cap, its own cost line and the same read-path gate; the ladder series is untouched.
_tp7 = next(n for n in _wf_tracker['nodes'] if n['name'] == 'Tracker Plan')['parameters']['jsCode']
_tr7 = next(n for n in _wf_tracker['nodes'] if n['name'] == 'Tracker Report')['parameters']['jsCode']
for _a7, _m7 in (("const kwList = (v) =>", 'B6-7: the plan does not read the keywords the customer named'),
                 ("FITR.rungs(kws.map(k =>", 'B6-7 (INVARIANTS rule 2): a stored keyword reaches a paid check without the fit gate'),
                 ("const wid = 'watch_' + sid;", 'B6-7: a reading of ours cannot be told from the weekly site check\'s'),
                 ("LIMITS.watch_site_days", 'B6-7: the plan would buy a results page the weekly site check already bought'),
                 ("already.has(d + '|' + k)", 'B6-7: a keyword that is both a rung and on the list would be bought twice'),
                 ("max_watch_per_site", 'B6-7: the customer\'s list is unbounded'),
                 ("watchHeld.push(", 'B6-7: a keyword the cap did not reach is dropped without a reason'),
                 ("max_watch_per_run", 'B6-7: one run\'s spend on the customer lists is unbounded')):
    assert _a7 in _tp7, _m7
assert 'protect' not in _tp7.split('FITR.ctx({ own_domain: d')[1].split('})')[0], \
    'B6-7: the customer\'s own keywords are protected from the gate, so the gate can never judge them'
for _a7, _m7 in (("const watchMeta = ((plan[0] || {}).watch) || null;", 'B6-7: the report never sees the customer\'s keyword list'),
                 ("watchlist: true", 'B6-7: the watched keywords are not reported'),
                 ("RS.churnNone('no live reading of this results page is stored", 'B6-7: a keyword nobody read must not come back as no movement'),
                 ("Not checked this week", 'B6-7: the keywords the cap did not reach are not named'),
                 ("Set aside by the keyword rule", 'B6-7: a set-aside keyword is not shown with its reason'),
                 ("No check was bought for your keyword list this week", 'B6-7: a week that bought nothing must say so, not invent a cost'),
                 ("The provider reported no cost for these calls, so none is shown.", 'B6-7: a cost nobody reported must not be invented'),
                 ("out[0].json.cost_usd = Number(ev.cost_usd)", 'B6-7 / R28: the run settles its reservation instead of what it measured')):
    assert _a7 in _tr7, _m7
assert "'check again', not \"not ranking\"" in _tr7 or 'that is "check again", not "not ranking"' in _tr7, \
    'B6-7 (INVARIANTS rule 1 / R18): a keyword whose results page could not be read must not read as "not ranking"'
retry_lint.check_in200(_wf_tracker)
write(_wf_tracker, 'SEO_Agent_Rank_Tracker.json')
# R31 (2026-10-14): written AFTER the workflow, because ledger_mainline() fills `ai_nodes` (the Claude nodes the settle checks) and
# `balance` (the free account reading) into the wiring entry at write time.
_lw9 = os.path.join(HERE, 'harness', 'ledger_wiring.json')
_lwj = json.load(open(_lw9)) if os.path.exists(_lw9) else {}
_lwj.setdefault('monitors', {}).update(LEDGER_WIRING)
json.dump(_lwj, open(_lw9, 'w'), indent=1, sort_keys=True)
# harness shim (S47): the results-page kit as a runnable script, one call per item
os.makedirs(CODE, exist_ok=True)
open(os.path.join(CODE, '_rank_serp.js'), 'w').write(
    "// harness shim (written by build_ladder_extras.py, G6): the results-page kit — { serp, domain, competitors, device, max } -> what RS reads from one answer\n"
    + _rd0('code/_serp_obs.js').rstrip('\n') + '\n' + _rd0('code/_rank_serp.js').rstrip('\n') + "\n"
    "return $input.all().map(i => { const j = i.json || {}; const a = RS.read(j.serp); const mine = RS.ourRank(a, j.domain);\n"
    "  const features = RS.features(a, j.domain); const landscape = RS.landscape(a, j.domain, j.competitors || [], mine.position);\n"
    "  const voice = RS.voice(landscape, features, j.domain, mine.position); const snapshot = RS.snapshot(a, landscape, features, j.device || 'desktop');\n"
    "  return { json: { read: { ok: a.ok, error: a.error, seen_at: a.seen_at, results_count: a.results_count }, rank: mine, types: RS.typeList(a),\n"
    "    features, landscape, voice, snapshot, packed: RS.pack(snapshot, j.max || 1800), chips: RS.featureChips(features),\n"
    "    line: RS.featureLine(features, j.obs || []), method: RS.METHOD, ctr: RS.CTR, aio_keep: RS.AIO_KEEP,\n"
    # B6-2 (2026-10-15, benchmark area 6): how much the results page itself moved, from the two stored snapshots (S88)
    "    change: RS.churn(j.prev_snapshot === undefined ? null : j.prev_snapshot, j.cur_snapshot === undefined ? RS.pack(snapshot, j.max || 1800) : j.cur_snapshot, j.churn_opts || {}),\n"
    "    change_text: RS.churnText(RS.churn(j.prev_snapshot === undefined ? null : j.prev_snapshot, j.cur_snapshot === undefined ? RS.pack(snapshot, j.max || 1800) : j.cur_snapshot, j.churn_opts || {})),\n"
    "    move_note: RS.moveNote(j.delta === undefined ? null : j.delta, RS.churn(j.prev_snapshot === undefined ? null : j.prev_snapshot, j.cur_snapshot === undefined ? RS.pack(snapshot, j.max || 1800) : j.cur_snapshot, j.churn_opts || {})) } }; });\n")

# =============================================================================
# 2. SEO Agent — Publish to WordPress (optional; stays inactive, called through Execute Workflow)
# =============================================================================
N = []; C = {}
N.append(node('From Content Run', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, {'inputSource': 'passthrough'}, [0, 0]))
N.append(code('Build WP Draft', rd('code/Build_WP_Draft.js'), [240, 0]))
N.append(node('Create WP Draft', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': "={{ $json.wordpress_url + '/wp-json/wp/v2/posts' }}", 'authentication': 'predefinedCredentialType', 'nodeCredentialType': 'wordpressApi', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify($json.wp_payload) }}', 'options': {'timeout': 60000, 'response': {'response': {'neverError': True}}}}, [480, 0], credentials={'wordpressApi': {'id': 'SEOcredWordPress', 'name': 'WordPress (SEO Agent)'}}, onError='continueRegularOutput'))
N.append(code('WP Result', """// Normalised result of the draft creation (inspect it in the execution; nothing else depends on it).
const r = $input.first().json || {};
const src = $('Build WP Draft').first().json;
const ok = !!r.id && !r.error && !r.code;
return [{ json: { ok, post_id: r.id || null, link: r.link || null, status: r.status || null, slug: r.slug || null, edit_link: ok ? src.wordpress_url + '/wp-admin/post.php?post=' + r.id + '&action=edit' : null,
  error: ok ? null : String((r.error && (r.error.message || r.error)) || r.message || r.code || 'no post id returned').slice(0, 300), keyword: src.keyword, ladder_id: src.ladder_id, request_id: src.request_id } }];""", [720, 0]))
N.append(sticky('Note', """## SEO Agent — Publish to WordPress (optional)
Called by SEO Agent v4 after a page is finished when `CONFIG.wordpress_publish` is true **and** the request carries `wordpress_url` (API field; add a form field if needed). Creates a **draft** post through the WordPress REST API: title, slug, excerpt (meta description), HTML content with internal links, JSON-LD blocks, and Yoast / RankMath meta keys (`_yoast_wpseo_title`, `_yoast_wpseo_metadesc`, `rank_math_title`, `rank_math_description`; the plugin must expose them to the REST API, otherwise WordPress ignores the `meta` object silently).
Credential: **WordPress (SEO Agent)** (id SEOcredWordPress): site URL, username and an Application Password. The sub-workflow must be **published** (n8n 2.x refuses to execute unpublished sub-workflows).""", [-40, -300], 820, 240, 7))
for a, b in [('From Content Run', 'Build WP Draft'), ('Build WP Draft', 'Create WP Draft'), ('Create WP Draft', 'WP Result')]: link(C, a, b)
write(wf('SEOagentWordPres', 'SEO Agent — Publish to WordPress', N, C), 'SEO_Agent_Publish_WordPress.json')

# =============================================================================
# 3. SEO Agent — Test Runner (local testing: starts any SEO Agent workflow with a JSON body; own test key; delete when done)
# =============================================================================
N = []; C = {}
N.append(node('Test Webhook', 'n8n-nodes-base.webhook', 2, {'httpMethod': 'POST', 'path': 'seo-test-run', 'authentication': 'headerAuth', 'responseMode': 'responseNode', 'options': {}}, [0, 0], webhookId='3f1c8e2a-5b7d-5c4e-9a1f-7e2d4b6c8a01', credentials={'httpHeaderAuth': {'id': 'SEOcredApiTest01', 'name': 'SEO API Key (test)'}}))
N.append(code('Route Test', """// body.workflow picks the target (default: SEO Agent v4); the rest of the body is forwarded like the API does.
const raw = $input.first().json || {}; const b = (raw.body && typeof raw.body === 'object') ? raw.body : {};
const target = String(b.workflow || 'SEOagentV4Full01');
const request_id = String(b.request_id || $execution.id);
return [{ json: { target, request_id, forward: { headers: raw.headers || {}, body: { ...b, workflow: undefined, request_id, client_ip: 'test-runner' } } } }];""", [240, 0]))
N.append(node('Respond Started', 'n8n-nodes-base.respondToWebhook', 1.1, {'respondWith': 'json', 'responseBody': "={{ JSON.stringify({ status: 'started', target: $json.target, request_id: $json.request_id }) }}", 'options': {'responseCode': 202}}, [480, 0]))
N.append(code('Prepare Forward', 'return [{ json: $input.first().json.forward }];', [720, 0]))
N.append(node('Run Target', 'n8n-nodes-base.executeWorkflow', 1.2, {'source': 'database', 'workflowId': {'__rl': True, 'mode': 'id', 'value': "={{ $('Route Test').first().json.target }}"}, 'mode': 'once', 'options': {'waitForSubWorkflow': False}}, [960, 0]))
N.append(sticky('Note', """## SEO Agent — Test Runner (testing only)
`POST /webhook/seo-test-run` with header `X-API-Key` = credential **SEO API Key (test)**. Body: the normal API body plus optional `workflow` (default SEOagentV4Full01; `SEOagentTracker1` runs the rank tracker now). Answers 202 and starts the target in the background. It bypasses the API front door's Quick Validate on purpose. **Deactivate or delete after testing.**""", [-40, -260], 760, 200, 3))
for a, b in [('Test Webhook', 'Route Test'), ('Route Test', 'Respond Started'), ('Respond Started', 'Prepare Forward'), ('Prepare Forward', 'Run Target')]: link(C, a, b)
write(wf('SEOagentTestRun1', 'SEO Agent — Test Runner', N, C, {'errorWorkflow': 'SEOagentErrHandl'}), 'SEO_Agent_Test_Runner.json')
