"""G1 (system review of 2026-10-11, FIX_PLAN.md): one retry rule for every external HTTP node.

Before this, retries differed by builder: `build_monitors.py`'s `get_http` had none (the Ahrefs DR lookup died on one
EAI_AGAIN and was never retried -- D23), `HTTP_X` allowed 2 tries 3 s apart, the nodes inherited from the v3 export had
`retryOnFail` with n8n's defaults or nothing at all, and the nodes added by hand had whatever the patch wrote.

**The rule** (`RETRY`): every `httpRequest` node that calls something outside this machine and can be repeated without a
side effect retries **3 times, 5 seconds apart**. n8n fires `retryOnFail` only when the node *fails*, so the rule covers
DNS blips, resets, timeouts and 5xx answers -- never an error inside an HTTP 200 (DataForSEO answers `40000` / `50000`
that way), which needs a code-level retry gate instead (`build_v4.py` section 25 for the SERP paths, the *AI Retry
Requests* gate of section 37 / D19 for the AI paths).

**The lint** (`check`): run at the end of every builder, next to `url_lint.check`. It fails the build when an
`httpRequest` node carries no retry (or a weaker one than the rule) and is not on the allow-list below, so a new node
cannot quietly ship without one.
"""
import json
import os

RETRY = {'retryOnFail': True, 'maxTries': 3, 'waitBetweenTries': 5000}

# The allow-list: nodes that must NOT be retried, each with its reason. Keep it small -- everything else takes the rule.
#  * the callbacks that deliver a report to the customer's app are not idempotent: every POST inserts a report row
#    (app/server/src/services/runs.ts `ingestCallback`), so a retry after a timeout the app already committed would
#    show the customer the same report twice. A callback that never arrives is caught by the app's failure watcher.
#  * writing to a customer's CMS creates content: a retry can publish a second draft.
#  * outreach e-mail is never sent from n8n at all (the app's sender owns it, LINK_BUILDER_SPEC.md §6), so no node here
#    needs that exception; it is named so the rule stays explicit.
ALLOW = {
    'POST Callback': 'callback to the customer app: every POST inserts a report (not idempotent)',
    'POST Rejection': 'callback to the customer app: every POST inserts a report (not idempotent)',
    'POST AI Report': 'callback to the customer app: every POST inserts a report (not idempotent)',
    'POST Pulse Report': 'callback to the customer app: every POST inserts a report (not idempotent)',
    'POST BL Report': 'callback to the customer app: every POST inserts a report (not idempotent)',
    'POST Growth Report': 'callback to the customer app: every POST inserts a report (not idempotent)',
    'POST LB Report': 'callback to the customer app: every POST inserts a report (not idempotent)',
    'POST Site Report': 'callback to the customer app: every POST inserts a report (not idempotent)',
    'POST Cadence Note': 'callback to the customer app: every POST inserts a report (not idempotent)',
    'POST Alert': 'callback to the customer app: every POST inserts a report (not idempotent)',
    'POST Progress': 'callback to the customer app: every POST inserts a report (not idempotent)',
    'Create WP Draft': "writes to the customer's WordPress: a retry can publish a second draft",
}
HTTP_TYPE = 'n8n-nodes-base.httpRequest'
# the code-level retry gates (D19): the chain a builder wired, recorded for the harness (S44) because the generated workflow JSON is
# not copied into the container with the harness
GATES = {}


def record_gate(where, chain):
    """B-A10: a workflow has as many gate chains as it has DataForSEO calls, so this EXTENDS (it used to replace, which is why
    section 70 had to re-pass section 56's chain by hand). Order is kept, names are not repeated."""
    out = list(GATES.get(where) or [])
    for n in chain:
        if n not in out:
            out.append(n)
    GATES[where] = out


# ---- Rule 3 of docs/system-review-2026-10-14/INVARIANTS.md: an external call that fails says so ----
# n8n's retryOnFail fires only when a node *fails*. DataForSEO answers most of its failures inside an HTTP 200
# (`status_code` 40101, 50000 ...), so those nodes need a code-level gate as well (`v5/code/_dfs_retry.js`, R18).
# R18 was exactly this hole: the gate existed on the AI path only, the test matched 50000, and 40101 passed through
# twice -- a whole ladder was planned, scored "winnable 68" and written on a results page nobody had seen.
#
# This is a RATCHET, not a big-bang rule. `in200_coverage` reports every DataForSEO node and whether a registered gate
# chain covers it; `check_in200` fails the build when a node appears that the baseline does not already excuse, so the
# debt is visible, cannot grow, and shrinks as gates are added. Delete a name from the baseline once its gate lands.
#
# B-A10 (2026-10-15): two changes, both made while paying the debt down.
#   * **The baseline carries a REASON** (`{workflow: {node: why}}`; the old `{workflow: [node]}` is still read). A node that stays
#     on the list because a gate would be the wrong answer for it -- a free balance probe, a poll that already re-asks in its own
#     loop -- is a *decision*, and a decision with no reason written beside it cannot be told apart from a debt nobody got to. An
#     excused node STAYS on the ratchet; only a node that gains its gate is deleted, and then for ever.
#   * **`check_all` walks every generated workflow.** Until B-A10 this check ran on the main workflow alone, so the 19 DataForSEO
#     nodes in the other eleven workflows were measured once and then guarded by nothing: a new ungated call in the Backlink
#     Monitor or the Site Tracker would have passed the build in silence. Build section 75 runs it over the whole directory,
#     after the sub-builds, which is the first moment every workflow exists on disk.
DFS_MARK = ('dataforseo', 'SEOcredDataForSE')
_BASELINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'harness', 'in200_baseline.json')
# not owned by this ratchet: the v3 export is the build's INPUT, the test callback receiver is maintained by hand
NOT_GENERATED = ('SEO_Agent_v3_original_export.json', 'SEO_Agent_Test_Callback_Receiver.json')


def _entries(value):
    """One baseline entry, either shape -> {node: why}."""
    return dict(value) if isinstance(value, dict) else {n: '' for n in (value or [])}


def load_baseline():
    base = json.load(open(_BASELINE)) if os.path.exists(_BASELINE) else {}
    return {k: _entries(v) for k, v in base.items()}


def is_dfs(node):
    """True when this node talks to DataForSEO, by URL or by credential."""
    if node.get('type') != HTTP_TYPE:
        return False
    blob = json.dumps(node.get('parameters') or {}) + json.dumps(node.get('credentials') or {})
    return any(m.lower() in blob.lower() for m in DFS_MARK)


def in200_coverage(workflow, where=None):
    """-> (gated, ungated) node names for the DataForSEO calls of one workflow."""
    where = where or workflow.get('name') or ''
    covered = set()
    for chain in GATES.values():
        covered.update(chain)
    # B-A10: the chains recorded by the OTHER builders live in harness/retry_wiring.json -- they are written by separate
    # processes, so the main build's in-memory GATES can never hold them. Merge them always, not only when GATES is empty
    # (that `if not covered` was why check_all could not be run from build_v4.py at all).
    if os.path.exists(_WIRING):
        for chain in (json.load(open(_WIRING)).get('ai_gate') or {}).values():
            covered.update(chain)
    gated, ungated = [], []
    for n in workflow.get('nodes') or []:
        if not is_dfs(n):
            continue
        (gated if n.get('name') in covered else ungated).append(n.get('name'))
    return sorted(gated), sorted(ungated)


def _known(base, where):
    """The baseline entry for this workflow; the builders call with a short name and the file keys by the full one."""
    if where in base:
        return _entries(base[where])
    for k, v in base.items():
        if k.startswith(where) or where.startswith(k):
            return _entries(v)
    return {}


def check_in200(workflow, where=None):
    """Fail the build when a DataForSEO node appears that no gate covers and the baseline does not already name."""
    where = where or workflow.get('name') or ''
    gated, ungated = in200_coverage(workflow, where)
    known = _known(json.load(open(_BASELINE)) if os.path.exists(_BASELINE) else {}, where)
    new = [n for n in ungated if n not in known]
    assert not new, (
        'INVARIANTS rule 3 (in-200 retry gate): %d new DataForSEO node(s) in "%s" with no gate: %s\n'
        '  Wire them through v5/code/_dfs_retry.js -- dfs_gate.splice() is the whole shape -- and record the chain with '
        'retry_lint.record_gate(), or, only with a reason written in its `why`, add them to harness/in200_baseline.json.'
        % (len(new), where, ', '.join(new)))
    return gated, ungated


def check_all(workflows_dir, gates=None):
    """B-A10: the ratchet over EVERY generated workflow, not only the one the main build holds in memory.
    `gates` is {workflow name: [chain]} recorded by the builders (harness/retry_wiring.json carries it between processes).
    -> {workflow: {'gated': [...], 'ungated': [...], 'excused': {...}}}, and it fails the build on an ungated node the
    baseline does not name, or on a baseline entry for a node that no longer exists (a stale excuse is a lie too)."""
    base = json.load(open(_BASELINE)) if os.path.exists(_BASELINE) else {}
    out, missing = {}, []
    seen_wf = set()
    for fn in sorted(os.listdir(workflows_dir)):
        if not fn.endswith('.json') or fn in NOT_GENERATED:
            continue
        data = json.load(open(os.path.join(workflows_dir, fn), encoding='utf-8'))
        for wf in (data if isinstance(data, list) else [data]):
            where = wf.get('name') or fn
            if gates is not None:
                covered = set()
                for chain in (gates.get(where) or {}).values() if isinstance(gates.get(where), dict) else []:
                    covered.update(chain)
                for chain in (gates.get(where) or []) if isinstance(gates.get(where), list) else []:
                    covered.update(chain if isinstance(chain, list) else [chain])
                gated = sorted(n['name'] for n in wf.get('nodes') or [] if is_dfs(n) and n.get('name') in covered)
                ungated = sorted(n['name'] for n in wf.get('nodes') or [] if is_dfs(n) and n.get('name') not in covered)
            else:
                gated, ungated = in200_coverage(wf, where)
            if not gated and not ungated:
                continue
            seen_wf.add(where)
            known = _known(base, where)
            new = [n for n in ungated if n not in known]
            assert not new, (
                'INVARIANTS rule 3 (in-200 retry gate): %d DataForSEO node(s) in "%s" (%s) with no gate and no baseline '
                'entry: %s\n  Wire them through v5/code/_dfs_retry.js -- dfs_gate.splice() is the whole shape -- and record '
                'the chain with retry_lint.record_gate(), or, only with a reason written in its `why`, add them to '
                'harness/in200_baseline.json.' % (len(new), where, fn, ', '.join(new)))
            stale = [n for n in known if n not in ungated and n not in gated]
            missing += ['%s / %s' % (where, n) for n in stale]
            out[where] = {'gated': gated, 'ungated': ungated,
                          'excused': {n: known[n] for n in ungated if known.get(n)},
                          'unexplained': [n for n in ungated if not known.get(n)]}
    assert not missing, (
        'INVARIANTS rule 3: harness/in200_baseline.json still excuses %d node(s) that no generated workflow has any more: %s\n'
        '  A name leaves the baseline for ever once its gate lands -- delete these rows.' % (len(missing), ', '.join(missing)))
    for where in base:
        assert where in seen_wf, 'INVARIANTS rule 3: the baseline names a workflow no build writes: %r' % where
    return out


def write_baseline(entries):
    """Record today's ungated nodes so the ratchet can only tighten. Run by the builders, never by hand."""
    base = json.load(open(_BASELINE)) if os.path.exists(_BASELINE) else {}
    for where, ungated in entries.items():
        known = _entries(base.get(where))
        base[where] = {n: known[n] for n in ungated if n in known}   # a gate that landed leaves the baseline for ever
    json.dump(base, open(_BASELINE, 'w'), indent=1, sort_keys=True)
    return base


def needs(node):
    """True when this node is an external HTTP call that the rule applies to."""
    return node.get('type') == HTTP_TYPE and node.get('name') not in ALLOW


def weak(node):
    """The reason this node breaks the rule, or '' when it keeps it."""
    if not node.get('retryOnFail'):
        return 'no retryOnFail'
    tries, wait = node.get('maxTries'), node.get('waitBetweenTries')
    if not isinstance(tries, int) or tries < RETRY['maxTries']:
        return 'maxTries %s (the rule is %d)' % (tries, RETRY['maxTries'])
    if not isinstance(wait, int) or wait < RETRY['waitBetweenTries']:
        return 'waitBetweenTries %s (the rule is %d ms)' % (wait, RETRY['waitBetweenTries'])
    return ''


def apply_rule(nodes):
    """Puts the rule on every node it applies to. Returns the names changed (the builders set it in their HTTP helpers;
    this is for the nodes inherited from the v3 export, which carry n8n's defaults)."""
    changed = []
    for n in nodes:
        if needs(n) and weak(n):
            n.update(RETRY)
            changed.append(n['name'])
    return changed


def findings(nodes, where):
    out = []
    for n in nodes:
        if not needs(n):
            continue
        why = weak(n)
        if why:
            out.append('%s / %s: %s -- give it retry_lint.RETRY (3 tries, 5 s apart) or name it in retry_lint.ALLOW with the reason'
                       % (where, n['name'], why))
    return out


_WIRING = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'harness', 'retry_wiring.json')


def record(where, nodes):
    """Writes what the harness checks (S44): every external HTTP node of this workflow with its retry settings, the rule and the
    allow-list. Merged into harness/retry_wiring.json by workflow name, so a single builder run keeps the other workflows' rows."""
    try:
        data = json.load(open(_WIRING))
    except Exception:
        data = {}
    data['rule'] = RETRY
    data['allow'] = ALLOW
    # the lint's own self-test, recorded for the harness (S44): it must flag a node without a retry and respect the allow-list
    data['selftest'] = {'flags_node_without_retry': bool(findings([{'type': HTTP_TYPE, 'name': 'Lint Self Test'}], 'self test')),
                        'flags_weaker_retry': bool(findings([{'type': HTTP_TYPE, 'name': 'Lint Self Test', 'retryOnFail': True, 'maxTries': 2, 'waitBetweenTries': 3000}], 'self test')),
                        'honours_allow_list': not findings([{'type': HTTP_TYPE, 'name': sorted(ALLOW)[0]}], 'self test'),
                        'ignores_other_nodes': not findings([{'type': 'n8n-nodes-base.code', 'name': 'Lint Self Test'}], 'self test')}
    wfs = data.setdefault('workflows', {})
    wfs[where] = [{'name': n['name'], 'retryOnFail': bool(n.get('retryOnFail')), 'maxTries': n.get('maxTries'),
                   'waitBetweenTries': n.get('waitBetweenTries'), 'allowed': n['name'] in ALLOW} for n in nodes if n.get('type') == HTTP_TYPE]
    if where in GATES: data.setdefault('ai_gate', {})[where] = GATES[where]
    os.makedirs(os.path.dirname(_WIRING), exist_ok=True)
    json.dump(data, open(_WIRING, 'w'), indent=1, sort_keys=True)


def check(workflow, where=None):
    """Lints one workflow dict (or a list of nodes) and fails the build on the first external HTTP node without a retry."""
    if isinstance(workflow, dict):
        nodes = workflow.get('nodes', [])
        where = where or workflow.get('name') or workflow.get('id') or 'workflow'
    else:
        nodes = list(workflow)
        where = where or 'nodes'
    bad = findings(nodes, where)
    assert not bad, 'G1 retry lint: %d external HTTP node(s) without the retry rule\n  ' % len(bad) + '\n  '.join(bad)
    record(where, nodes)
    return sum(1 for n in nodes if n.get('type') == HTTP_TYPE)
