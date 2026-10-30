"""W07-A (2026-10-31, docs/page-quality-2026-10-29/WAVE06.md "Open resilience item"): the page reader's fallback and its ops alert.

Every HTTP node that reads a page through the reader (credential SEOcredJinaReade) is renamed `<name> (reader)` and followed by a Code node
that takes its old name (v5/code/Reader_Fallback.js + the RD kit, v5/code/_reader.js). Every node that read `$('<name>')`, and every
connection that left it, now meets the Code node: the same items in the same order, the refused ones read again another way. One alert chain
per workflow (Reader Refusals -> ... -> Save Reader Alert Delivery) is fed by every fallback node and raises one ops alert per refusal.

Used by build_v4.py (section 179, the main workflow) and build_monitors.py (the AI Visibility Tracker and the Backlink Monitor), so the rule is
written once. `find_readers` is how a builder finds them: by the credential id, never by a list of names, so a new reader node cannot be missed.
"""
import json
import uuid

from ladder_common import (read_v5, inline_kits, DT_TYPE, DT_VERSION, OPS_ALERTS_TABLE, OPS_ALERTS_COLS, ALERT_WEBHOOK_PLACEHOLDER,
                           dt_get_where_params, dt_upsert_params, dt_update_params, _if_params)
import retry_lint

CRED_ID = 'SEOcredJinaReade'
READER_HOST = 'r.jina.ai'
SUFFIX = ' (reader)'
_NS = uuid.UUID('3b9d1f6e-7a52-4c0e-9f1a-2d6c8e4b5a17')
ALERT_NODES = ['Reader Refusals', 'Any Reader Refusal?', 'Load Ops Alerts (Reader)', 'Reader Alert Plan', 'Save Reader Alert',
               'Reader Alert Send', 'Send Reader Alert?', 'Post Reader Alert', 'Reader Alert Delivery', 'Save Reader Alert Delivery']


def _kit(name):
    return read_v5('code/' + name).rstrip('\n')


def find_readers(wf):
    """Every HTTP node that reads through the page reader (its credential, or the reader's host in its URL)."""
    out = []
    for n in wf['nodes']:
        if n.get('type') != 'n8n-nodes-base.httpRequest' or n['name'].endswith(SUFFIX):
            continue
        cred = json.dumps(n.get('credentials') or {})
        url = str((n.get('parameters') or {}).get('url') or '')
        if CRED_ID in cred or READER_HOST in url:
            out.append(n['name'])
    return out


def _preds(conns, name):
    out = []
    for src, o in conns.items():
        for idx, lst in enumerate((o or {}).get('main') or []):
            for t in (lst or []):
                if t['node'] == name:
                    out.append((src, idx))
    return out


def _js_str(s):
    return json.dumps(str(s))[1:-1].replace("'", "\\'")


def wrap(wf, name, label, target='q.url', domain="''", links=False, reqs=None):
    """Renames reader `name` to `name (reader)` and puts the fallback Code node `name` behind it. Returns the fallback node."""
    nodes = {n['name']: n for n in wf['nodes']}
    conns = wf['connections']
    http = nodes[name]
    assert http['type'] == 'n8n-nodes-base.httpRequest', 'W07-A: ' + name + ' is not an HTTP node'
    raw = name + SUFFIX
    assert raw not in nodes, 'W07-A: ' + name + ' is already wrapped'
    p = http.get('parameters') or {}
    resp = (((p.get('options') or {}).get('response') or {}).get('response')) or {}
    fmt = {h['name']: h['value'] for h in (((p.get('headerParameters') or {}).get('parameters')) or []) if h.get('name')}
    html = str(fmt.get('X-Return-Format', '')).lower() == 'html'
    full = bool(resp.get('fullResponse'))
    prop = resp.get('outputPropertyName') or ('' if full else 'data')
    prop = str(prop).lstrip('=')
    # the request items: the reader's one predecessor (aligned by position, as every reader of these nodes already assumes)
    pr = _preds(conns, name)
    assert reqs or len(pr) == 1, 'W07-A: ' + name + ' must have exactly one predecessor, has ' + str(pr)
    assert reqs or pr[0][1] == 0, 'W07-A: ' + name + ' is fed from output ' + str(pr[0][1]) + ' of ' + pr[0][0] + ' ($().all() reads output 0)'
    req_node = reqs or pr[0][0]
    # rename the HTTP node and move its outgoing connections to the fallback node
    http['name'] = raw
    out = conns.pop(name, None)
    for src, o in conns.items():
        for lst in (o or {}).get('main') or []:
            for t in (lst or []):
                if t['node'] == name:
                    t['node'] = raw
    code = (read_v5('code/Reader_Fallback.js')
            .replace('/*__LINK_KIT__*/', _kit('_link_kit.js')).replace('/*__CLIENT_RENDER__*/', _kit('_client_render.js'))
            .replace('/*__READER__*/', _kit('_reader.js'))
            .replace('__READER__', raw).replace("'__REQS__'", "'" + _js_str(req_node) + "'").replace("'__NAME__'", "'" + _js_str(name) + "'")
            .replace('__NAME__', name).replace("'__MODE__'", "'" + ('html' if html else 'text') + "'").replace('(mode __MODE__)', '(mode ' + ('html' if html else 'text') + ')')
            .replace('__FULL__', 'true' if full else 'false').replace("'__PROP__'", "'" + _js_str(prop) + "'")
            .replace('__HEADERS__', json.dumps(fmt, ensure_ascii=False)).replace('__LINKS__', 'true' if links else 'false')
            .replace('(q) => __TARGET__', '(q) => ' + target).replace('(q) => __DOMAIN__', '(q) => ' + domain)
            .replace("'__LABEL__'", "'" + _js_str(label) + "'").replace('__LABEL__', label))
    for marker in ('__READER__', '__REQS__', '__NAME__', '__MODE__', '__FULL__', '__PROP__', '__HEADERS__', '__LINKS__', '__TARGET__', '__DOMAIN__', '__LABEL__'):
        assert marker not in code, 'W07-A: ' + marker + ' left in the fallback of ' + name
    x, y = http['position']
    node = {'parameters': {'jsCode': code}, 'id': str(uuid.uuid5(_NS, str(wf.get('id') or wf.get('name')) + ':' + name)), 'name': name,
            'type': 'n8n-nodes-base.code', 'typeVersion': 2, 'position': [x + 110, y + 120]}
    if http.get('alwaysOutputData'):
        node['alwaysOutputData'] = True
    wf['nodes'].append(node)
    conns[raw] = {'main': [[{'node': name, 'type': 'main', 'index': 0}]]}
    if out is not None:
        conns[name] = out
    return node


def alert_chain(wf, feeders, ops_alert_src=None):
    """One alert chain per workflow, fed by every fallback node (a side branch: nothing on the main path waits for it)."""
    nodes = {n['name']: n for n in wf['nodes']}
    conns = wf['connections']
    for nm in ALERT_NODES:
        assert nm not in nodes, 'W07-A: ' + nm + ' already exists in ' + str(wf.get('name'))
    wname = str(wf.get('name') or '')
    nid = lambda n: str(uuid.uuid5(_NS, str(wf.get('id') or wname) + ':' + n))
    fx = [nodes[f]['position'] for f in feeders]
    bx, by = min(p[0] for p in fx), min(p[1] for p in fx) - 900
    pos = lambda i: [bx + 220 * i, by]

    def src(f):
        s = inline_kits(read_v5('code/' + f)).replace('/*__READER__*/', _kit('_reader.js'))
        return s.replace('__ALERT_WEBHOOK_URL__', ALERT_WEBHOOK_PLACEHOLDER).replace('__WORKFLOW__', _js_str(wname))

    add = lambda spec: wf['nodes'].append(spec)
    code = lambda n, f, i, **kw: add({'parameters': {'jsCode': src(f)}, 'id': nid(n), 'name': n, 'type': 'n8n-nodes-base.code', 'typeVersion': 2, 'position': pos(i), **kw})
    iff = lambda n, expr, i: add({'parameters': _if_params(nid(n + ':cond'), expr), 'id': nid(n), 'name': n, 'type': 'n8n-nodes-base.if', 'typeVersion': 2.3, 'position': pos(i)})
    code('Reader Refusals', 'Reader_Refusals.js', 0, onError='continueRegularOutput')
    iff('Any Reader Refusal?', '{{ !$json.skip }}', 1)
    add({'parameters': dt_get_where_params(OPS_ALERTS_TABLE, 'alert_key', 'eq', '={{ $json.alert_key }}'), 'id': nid('Load Ops Alerts (Reader)'),
         'name': 'Load Ops Alerts (Reader)', 'type': DT_TYPE, 'typeVersion': DT_VERSION, 'position': pos(2), 'onError': 'continueRegularOutput', 'alwaysOutputData': True})
    code('Reader Alert Plan', 'Reader_Alert_Plan.js', 3, onError='continueRegularOutput', executeOnce=True)
    add({'parameters': dt_upsert_params(OPS_ALERTS_TABLE, OPS_ALERTS_COLS, 'alert_key'), 'id': nid('Save Reader Alert'), 'name': 'Save Reader Alert',
         'type': DT_TYPE, 'typeVersion': DT_VERSION, 'position': pos(4), 'onError': 'continueRegularOutput', 'alwaysOutputData': True})
    code('Reader Alert Send', 'Reader_Alert_Send.js', 5, onError='continueRegularOutput', executeOnce=True)
    iff('Send Reader Alert?', '{{ $json.send_webhook }}', 6)
    add({'parameters': {'method': 'POST', 'url': '={{ $json.webhook_url }}', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify($json.webhook_body) }}',
                        'options': {'timeout': 15000, 'response': {'response': {'fullResponse': True, 'neverError': True}}}},
         'id': nid('Post Reader Alert'), 'name': 'Post Reader Alert', 'type': 'n8n-nodes-base.httpRequest', 'typeVersion': 4.5, 'position': pos(7),
         'onError': 'continueRegularOutput', 'alwaysOutputData': True, **retry_lint.RETRY})
    code('Reader Alert Delivery', 'Reader_Alert_Delivery.js', 8, onError='continueRegularOutput')
    add({'parameters': dt_update_params(OPS_ALERTS_TABLE, OPS_ALERTS_COLS, [('alert_key', '={{ $json.alert_key }}')],
             {'delivered': '={{ $json.delivered }}', 'channels': '={{ $json.channels }}', 'severity': '={{ $json.severity }}',
              'attempts': '={{ $json.attempts }}', 'last_attempt_at': '={{ $json.last_attempt_at }}', 'next_attempt_at': '={{ $json.next_attempt_at }}',
              'attempt_log': '={{ $json.attempt_log }}', 'notes': '={{ $json.notes }}'}),
         'id': nid('Save Reader Alert Delivery'), 'name': 'Save Reader Alert Delivery', 'type': DT_TYPE, 'typeVersion': DT_VERSION, 'position': pos(9),
         'onError': 'continueRegularOutput', 'alwaysOutputData': True})

    def link(a, b, out=0):
        o = conns.setdefault(a, {}).setdefault('main', [])
        while len(o) <= out:
            o.append([])
        if not any(t['node'] == b for t in o[out]):
            o[out].append({'node': b, 'type': 'main', 'index': 0})
    for f in feeders:
        link(f, 'Reader Refusals')
    for a, b in (('Reader Refusals', 'Any Reader Refusal?'), ('Load Ops Alerts (Reader)', 'Reader Alert Plan'), ('Reader Alert Plan', 'Save Reader Alert'),
                 ('Save Reader Alert', 'Reader Alert Send'), ('Reader Alert Send', 'Send Reader Alert?'), ('Post Reader Alert', 'Reader Alert Delivery'),
                 ('Reader Alert Delivery', 'Save Reader Alert Delivery')):
        link(a, b)
    link('Any Reader Refusal?', 'Load Ops Alerts (Reader)', 0)
    link('Send Reader Alert?', 'Post Reader Alert', 0)
    return ALERT_NODES


def apply(wf, specs):
    """specs: {reader name: dict(label=..., target=..., domain=..., links=...)}. Every reader the workflow has must be named in specs
    (a reader nobody wrapped is a read path with no fallback), and every spec must be a reader. Returns the wiring record."""
    found = find_readers(wf)
    assert sorted(found) == sorted(specs), 'W07-A: %s reads through the page reader at %s, the fallback covers %s' % (wf.get('name'), sorted(found), sorted(specs))
    fb = []
    for name in found:
        s = specs[name]
        wrap(wf, name, s['label'], target=s.get('target', 'q.url'), domain=s.get('domain', "''"), links=s.get('links', False), reqs=s.get('reqs'))
        fb.append(name)
    alert_chain(wf, fb)
    return {'workflow': wf.get('name'), 'readers': {n: {'http': n + SUFFIX, 'label': specs[n]['label']} for n in fb}, 'alert': ALERT_NODES}
