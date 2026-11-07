#!/usr/bin/env python3
"""Builds SEO Agent - Keyword Intelligence (SEOagentKIntel1): Competitors and Keyword research (docs/keyword-intel-2026-11-08/DESIGN.md,
frozen in CONTRACTS.md). Run at the end of build_v4.py with the other sub-builds.

W0 (2026-11-08) is the SKELETON every later package codes against: the API front door (build_api.py) hands it the requests of modes
`competitors` and `keyword_research` (Execute Workflow, no wait, after the 202), and it

  1. reads the request the way the front door forwards it (`{ headers, body }`, body = the app's payload, CONTRACTS.md §3);
  2. reads the website's seo_monitors row (ki_mode) and the kill switch seo_cache `ki:kill` (any read error = killed: fails closed);
  3. answers the final callback `ki_competitors` / `ki_research` with `status: refused` and the reason: `killed`, `ki_off` (mode empty / off,
     or the settings could not be read), or `not_available_yet` (Trial or On: the worker is built by E2).

It calls no paid API, writes no table and reserves nothing (a refusal before any spend), so no run-ledger row: E2's worker adds the ledger on
the main path (build section 55's proof is extended to it then), the rate limit, the budget and balance guard and the four KI tables.
Code nodes are also written to harness/code_v4 for the offline harness (scenarios_ki_w0.js)."""
import json, os, re, uuid
import env_settings as _env   # B-F5: a build with no n8n/.env refuses, unless the offline build is deliberate
_env.require_settings('build_ki.py')
import url_lint      # D15: no node builds a site URL by hand
import retry_lint    # G1: one retry rule for every external HTTP node (the callback is on its allow-list: a POST inserts a report)
from ladder_common import (DT_TYPE, DT_VERSION, dt_get_all_where_params, MONITORS_TABLE, CACHE_TABLE, freeze_ids)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'workflows'); CODE = os.path.join(HERE, 'harness', 'code_v4')
WID, NAME, FILE = 'SEOagentKIntel1', 'SEO Agent - Keyword Intelligence', 'SEO_Agent_Keyword_Intelligence.json'
RULE_VERSION = 'ki-1'
KILL_KEY = 'ki:kill'
STAGES = {'competitors': 'ki_competitors', 'keyword_research': 'ki_research'}
NS = uuid.UUID('6c1e0b7a-4d2f-4a9e-b3c1-0000ce110de1')
nid = lambda name: str(uuid.uuid5(NS, 'kintel:' + name))

N, C = [], {}
def node(name, ntype, ver, params, pos, **extra):
    assert not any(n['name'] == name for n in N), 'duplicate node ' + name
    n = {'parameters': params, 'id': nid(name), 'name': name, 'type': ntype, 'typeVersion': ver, 'position': pos}; n.update(extra); N.append(n); return n
def code(name, src, pos, **extra): return node(name, 'n8n-nodes-base.code', 2, {'jsCode': src}, pos, **extra)
def iff(name, expr, pos):
    return node(name, 'n8n-nodes-base.if', 2.3, {'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'loose', 'version': 3},
        'conditions': [{'id': nid(name + ':c'), 'leftValue': '=' + expr, 'rightValue': '', 'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}],
        'combinator': 'and'}, 'looseTypeValidation': True, 'options': {}}, pos)
def link(a, b, out=0):
    outs = C.setdefault(a, {}).setdefault('main', [])
    while len(outs) <= out: outs.append([])
    outs[out].append({'node': b, 'type': 'main', 'index': 0})
def chain(*names):
    for a, b in zip(names, names[1:]): link(a, b)
at = lambda c, r: [c * 220, r * 220]
LOAD = dict(alwaysOutputData=True, executeOnce=True, onError='continueRegularOutput')

KI_INPUT = r"""// KI W0 (2026-11-08, docs/keyword-intel-2026-11-08/CONTRACTS.md §3): the request as the API front door forwards it ({ headers, body }, the body
// being the app's payload: mode, keyword, country, domain, email, callback_url, business, customers, competitors, seeds, ki_force, request_id).
// Pure reading and normalising: nothing is decided here. No URL constructor (the n8n sandbox has none): hosts by regex.
const raw = $input.first().json || {};
const b = (raw.body && typeof raw.body === 'object' && !Array.isArray(raw.body)) ? raw.body : raw;
const S = (v) => (v == null ? '' : String(v)).trim();
const mode = S(b.mode).toLowerCase();
const kind = mode === 'competitors' || mode === 'keyword_research' ? mode : '';
const STAGE = { competitors: 'ki_competitors', keyword_research: 'ki_research' };
const normD = (x) => S(x).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#:].*$/, '');
const domain = normD(b.domain);
const list = (v) => (Array.isArray(v) ? v : S(v).split(/[\n,;]+/)).map(S).filter(Boolean);
const uniq = (a) => a.filter((x, i) => a.indexOf(x) === i);
const competitors = uniq(list(b.competitors).map(normD).filter(x => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(x) && x !== domain)).slice(0, 5);
const seeds = uniq(list(b.seeds).map(x => x.replace(/\s+/g, ' ').toLowerCase().slice(0, 120))).slice(0, 20);
const cb = S(b.callback_url);
const callbackOk = /^(https:\/\/\S+|http:\/\/(localhost|127\.0\.0\.1|host\.docker\.internal|n8n)(:\d+)?\/\S*)$/.test(cb);
return [{ json: {
  kind, mode, stage: STAGE[kind] || 'ki_competitors', rule_version: '__RULE_VERSION__',
  domain, site_id: domain ? 'site_' + domain.replace(/[^a-z0-9]+/g, '-') : '',
  request_id: S(b.request_id), run_id: S($execution.id), client_ip: S(b.client_ip), country: S(b.country),
  competitors, seeds, ki_force: b.ki_force === true || /^(true|1|yes)$/i.test(S(b.ki_force)),
  callback_url: callbackOk ? cb : '', started_at: new Date().toISOString()
} }];"""

KI_GATE = r"""// KI W0 (2026-11-08, docs/keyword-intel-2026-11-08/CONTRACTS.md §1 / §4): may this website run keyword intelligence, and the callback that says so.
// The kill switch (seo_cache `ki:kill` = 1) stops every run; a kill switch that could not be read counts as ON (fails closed). The website's
// ki_mode must be trial or on; empty, off, anything else, or a settings row that could not be read is off. W0 is the skeleton: a run that
// passes both is still refused with `not_available_yet` until E2 builds the worker. Nothing here spends, writes a table or reserves money.
const q = $('KI Input').first().json || {};
const S = (v) => (v == null ? '' : String(v)).trim();
const rowsOf = (n) => { try { return $(n).all().map(i => (i && i.json) || {}); } catch (e) { return null; } };
const kill = rowsOf('Load Kill Switch (KI)');
const killUnread = kill === null || kill.some(r => r && r.error);
const killed = killUnread || kill.some(r => S(r.key) === '__KILL_KEY__' && /^(1|true|on|yes)$/i.test(S(r.value)));
const mons = rowsOf('Load Monitors (KI)');
const monUnread = mons === null || mons.some(r => r && r.error);
const mon = (mons || []).find(r => r && q.site_id && S(r.site_id) === q.site_id) || {};
const stored = S(mon.ki_mode).toLowerCase();
const kiMode = monUnread ? 'off' : (stored === 'trial' || stored === 'on' ? stored : 'off');
const reason = killed ? 'killed' : (kiMode === 'off' || !q.kind) ? 'ki_off' : 'not_available_yet';
const NOTE = {
  killed: 'Keyword intelligence is paused for every website (seo_cache ' + '__KILL_KEY__' + (killUnread ? ' could not be read, so it counts as on' : ' is on') + '). Nothing ran and nothing was spent.',
  ki_off: 'Keyword intelligence is not switched on for this website (seo_monitors.ki_mode is ' + (monUnread ? 'unreadable' : (stored ? '"' + stored + '"' : 'empty')) + '). Nothing ran and nothing was spent.',
  not_available_yet: 'Keyword intelligence is switched on (' + kiMode + ') but the analysis is not built yet. Nothing ran and nothing was spent.',
};
const LABELS = { measured: 'measured', provider_estimate: 'estimate from the data provider', modelled: 'our estimate', inferred: 'AI judgement' };
const base = { stage: q.stage, status: 'refused', reason, note: NOTE[reason], request_id: q.request_id, run_id: q.run_id, domain: q.domain, market: '',
  mode: kiMode, rule_version: q.rule_version, sections: [], summary: {}, labels: LABELS, run_ledger: null,
  run_cost_estimate_usd: 0, run_cost_estimate_basis: 'refused before any paid call: no search data was read and no model was asked', run_cost_estimate_state: 'measured' };
const body = q.kind === 'keyword_research'
  ? { ...base, clusters: [], striking: [], questions: [], gaps_summary: {}, plan: [] }
  : { ...base, competitors: [], listings: [], platforms: [] };
return [{ json: { callback_url: q.callback_url, callback_body: body, refused: true, reason, ki_mode: kiMode, killed } }];"""

_sub = lambda s: s.replace('__RULE_VERSION__', RULE_VERSION).replace('__KILL_KEY__', KILL_KEY)
for _ph in ('__RULE_VERSION__', '__KILL_KEY__'):
    assert _ph not in _sub(KI_INPUT) + _sub(KI_GATE), _ph + ' left in a node of ' + NAME

node('Manual Run', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, {'inputSource': 'passthrough'}, at(0, 0))
code('KI Input', _sub(KI_INPUT), at(1, 0))
node('Load Monitors (KI)', DT_TYPE, DT_VERSION, dt_get_all_where_params(MONITORS_TABLE, [('site_id', 'eq', "={{ $('KI Input').first().json.site_id }}")]), at(2, 0), **LOAD)
node('Load Kill Switch (KI)', DT_TYPE, DT_VERSION, dt_get_all_where_params(CACHE_TABLE, [('key', 'eq', KILL_KEY)]), at(3, 0), **LOAD)
code('KI Gate', _sub(KI_GATE), at(4, 0), executeOnce=True)
iff('Has Callback (KI)?', '{{ !!$json.callback_url }}', at(5, 0))
node('POST KI Report', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': '={{ $json.callback_url }}', 'sendBody': True, 'specifyBody': 'json',
     'jsonBody': '={{ JSON.stringify($json.callback_body) }}', 'options': {'timeout': 30000}}, at(6, 0), onError='continueRegularOutput')
node('Note', 'n8n-nodes-base.stickyNote', 1, {'content': """## SEO Agent - Keyword Intelligence (KI W0 skeleton, 2026-11-08)
Started by the API front door (`SEOagentAPIentry`, Execute Workflow, no wait) for modes **competitors** and **keyword_research** (docs/keyword-intel-2026-11-08/CONTRACTS.md).

W0 answers every request with the final callback `ki_competitors` / `ki_research`, `status: refused`, and a reason: `killed` (seo_cache `ki:kill` = 1, or unreadable), `ki_off` (seo_monitors.ki_mode empty / off / unreadable) or `not_available_yet` (Trial / On: the worker is the next package, E2).

No paid call, no table write, nothing reserved.""", 'height': 300, 'width': 620, 'color': 4}, at(0, -2))
chain('Manual Run', 'KI Input', 'Load Monitors (KI)', 'Load Kill Switch (KI)', 'KI Gate', 'Has Callback (KI)?')
link('Has Callback (KI)?', 'POST KI Report', 0)

wfobj = {'id': WID, 'name': NAME, 'active': False,
         'settings': {'executionOrder': 'v1', 'errorWorkflow': 'SEOagentErrHandl', 'executionTimeout': 900, 'saveDataErrorExecution': 'all', 'saveDataSuccessExecution': 'all'},
         'tags': [], 'nodes': N, 'connections': C}
url_lint.check(wfobj, NAME)
retry_lint.check(wfobj, NAME)
retry_lint.check_in200(wfobj, NAME)

# ---- proofs on the generated workflow (W0: the skeleton spends nothing and writes nothing; E2 replaces these with the worker's) ----
names = {n['name'] for n in N}; assert len(names) == len(N), 'duplicate node names in ' + NAME
outs = lambda nd: [t['node'] for lst in ((C.get(nd) or {}).get('main') or []) for t in (lst or [])]
for s_, o_ in C.items():
    assert s_ in names, s_
    for lists in o_.values():
        for lst in lists:
            for t in lst: assert t['node'] in names, t['node']
_seen, _todo = set(), ['Manual Run']
while _todo:
    _n = _todo.pop()
    if _n in _seen: continue
    _seen.add(_n); _todo.extend(outs(_n))
_orphans = sorted(n['name'] for n in N if n['type'] != 'n8n-nodes-base.stickyNote' and n['name'] not in _seen)
assert not _orphans, 'nodes no door reaches: ' + str(_orphans)
_writes = [n['name'] for n in N if n['type'] == DT_TYPE and (n['parameters'].get('operation') not in ('get',))]
assert not _writes, 'KI W0: the skeleton writes no table: ' + str(_writes)
_paid = [n['name'] for n in N if n['type'] == 'n8n-nodes-base.httpRequest' and n['name'] != 'POST KI Report']
assert not _paid, 'KI W0: the skeleton calls nothing but the callback: ' + str(_paid)
assert not any('langchain' in n['type'] or 'dataforseo' in json.dumps(n).lower() for n in N), 'KI W0: no model and no DataForSEO call in the skeleton'
assert outs('KI Input') == ['Load Monitors (KI)'] and outs('Load Kill Switch (KI)') == ['KI Gate'], 'KI W0: the gate reads the settings and the kill switch first'
assert 'POST KI Report' in retry_lint.ALLOW, 'KI W0: the callback must be on retry_lint\'s allow-list (a POST inserts a report)'

wfobj = freeze_ids(wfobj)
json.dump([wfobj], open(os.path.join(OUT, FILE), 'w'), indent=2, ensure_ascii=False)
os.makedirs(CODE, exist_ok=True)
# the harness reads every code node by name; a name another workflow already uses would overwrite its file
_others = set()
for fn in os.listdir(OUT):
    if fn.endswith('.json') and fn != FILE:
        for w in json.load(open(os.path.join(OUT, fn), encoding='utf-8')):
            _others |= {n['name'] for n in w.get('nodes', []) if n.get('type') == 'n8n-nodes-base.code'}
_clash = sorted(n['name'] for n in N if n['type'] == 'n8n-nodes-base.code' and n['name'] in _others)
assert not _clash, 'code node names shared with another workflow (harness/code_v4 would be overwritten): ' + str(_clash)
for n in wfobj['nodes']:
    if n['type'] == 'n8n-nodes-base.code': open(os.path.join(CODE, re.sub(r'[^A-Za-z0-9_.-]+', '_', n['name']) + '.js'), 'w').write(n['parameters']['jsCode'])
# what the harness checks (scenarios_ki_w0.js): the wiring, the stages, the callback
json.dump({'workflow': WID, 'name': NAME, 'file': FILE, 'rule_version': RULE_VERSION, 'kill_key': KILL_KEY, 'stages': STAGES,
           'nodes': sorted(n['name'] for n in N if n['type'] != 'n8n-nodes-base.stickyNote'),
           'connections': {s_: [[t_['node'] for t_ in l_] for l_ in o_.get('main', [])] for s_, o_ in sorted(C.items())},
           'callback': {'post': 'POST KI Report', 'body': next(n for n in N if n['name'] == 'POST KI Report')['parameters']['jsonBody'],
                        'retry': bool(next(n for n in N if n['name'] == 'POST KI Report').get('retryOnFail'))},
           'settings': wfobj['settings']},
          open(os.path.join(HERE, 'harness', 'ki_wiring.json'), 'w'), indent=1, sort_keys=True)
print('wrote', FILE + ':', len(N), 'nodes (KI W0 skeleton: refuses every run with its reason, spends nothing)')
