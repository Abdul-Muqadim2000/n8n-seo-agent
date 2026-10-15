"""INVARIANTS rule 2 (docs/system-review-2026-10-14/INVARIANTS.md): a gate runs on the way in **and** on the way out.

~16 defects came from this one class -- link-farm pages ranked as best links (D3), a competitor's brand planned as a rung (D8, and
again as R16 because the rows already stored were never revisited), stored hosts that stayed wrong (P2-3), a prospect on a rival's
subdomain (R21), a rung planned before the gate existed (R16), pages promised but never written (R1 / R15).

**The rule.** Stored data predates every gate we will ever write, so a read path that trusts storage is a gate that does not exist.
A gate applied where a row is WRITTEN must also be applied where that row is READ BACK.

**The lint.** Like `retry_lint.py`, and like build section 55's ordering proof, it walks the GENERATED workflows -- not the sources
-- because that is where the question is actually decided: a kit is only a gate in the nodes it was inlined into.

For each pair below it finds, across every generated workflow:
  * the writers: a Data Table node that inserts / upserts / updates the table, and the Code node feeding it;
  * the readers: every Code node that names a Data Table `get` node on that table (the loaders are chained in a preamble, so a
    consumer takes its rows with `rowsOf('Load Ladders')` / `$('Load Ladders')`, which is what identifies it);
and fails the build when a reader carries no call to the gate's read entry point.

**It is a ratchet, not a big bang** -- the same shape as `retry_lint.check_in200` + `harness/in200_baseline.json`. Most of today's
readers are unguarded; `harness/gate_pairs_baseline.json` names them, so the debt is visible, cannot GROW, and shrinks as gates are
added. A reader that gains its gate leaves the baseline for ever. Three of the baselined rows are real defects, not noise, and are
registered as such (FIX_PLAN §3.15 B-F6 / B-F7 / B-F8): *AI Plan*, *Growth Plan* and *Site Plan* each feed stored ladder keywords
into what they buy and what they ask an AI engine, with no fit gate between -- the exact shape of R16, which was fixed for the Rank
Tracker and the Content Cadence only.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
WF_DIR = os.path.join(HERE, 'workflows')
V5_CODE = os.path.join(HERE, 'v5', 'code')
BASELINE = os.path.join(HERE, 'harness', 'gate_pairs_baseline.json')
RECORD = os.path.join(HERE, 'harness', 'gate_pairs.json')
CODE_TYPE = 'n8n-nodes-base.code'
DT_TYPE = 'n8n-nodes-base.dataTable'
WRITE_OPS = ('insert', 'upsert', 'update')
# the build's inputs, not its outputs: the untouched v3 export is read by build_v4.py and never generated
NOT_GENERATED = ('SEO_Agent_v3_original_export.json',)

# ---- the pairs, each derived from the kit that defines the gate -------------------------------------------------------------
# `write` / `read` are the entry points the kit exports. Where a gate has one entry point used on both sides (the link kit, the
# competitor gate) they are the same string, and the rule reads "a reader must call the same gate the writer called".
PAIRS = [
    # B-G1..B-G3 (2026-10-15): the read path may call `fitStored` itself, as R16's two callers do, or the shared loop that wraps it
    # (`FITR.rungs`, _fit_gate.js) that the four later readers use. Both ARE the gate; a node that only inlines the kit is neither.
    {'gate': 'keyword fit', 'kit': '_fit_gate.js', 'defines': ('function fitGate(', 'const fitStored =', 'const FITR = {'),
     'write': 'fitGate(', 'read': ('fitStored(', 'FITR.rungs('), 'tables': ('seo_ladders',),
     'why': 'a rung stored before the gate existed is still a competitor brand, a government portal or an off-topic search (D4 / D8 / R16)'},
    {'gate': 'link spam / footprint', 'kit': '_link_kit.js', 'defines': ('function footprints(', 'const isSearchPage ='),
     'write': 'LK.footprints', 'read': 'LK.footprints', 'tables': ('seo_backlinks',),
     'why': 'a link-farm or scraper page already in the ledger is read back as one of the best links (D3)'},
    {'gate': 'competitor', 'kit': '_outreach_kit.js', 'defines': ('function sellsSame(', 'LK.regDomain('),
     'write': 'OK.sellsSame', 'read': 'OK.sellsSame', 'tables': ('seo_link_prospects', 'seo_link_outreach'),
     'why': 'a prospect stored before the gate (or on a rival subdomain) is pitched anyway (R21)'},
]


def _reads(pair):
    """The read entry point(s): calling any one of them IS running the gate on the way out."""
    r = pair['read']
    return list(r) if isinstance(r, (list, tuple)) else [r]


def _kit_src(pair):
    """The kit text as the builders inline it — with and without the trailing newline, because build_v4.py rstrips it and
    build_monitors.py does not."""
    s = open(os.path.join(V5_CODE, pair['kit']), encoding='utf-8').read()
    return [s, s.rstrip('\n')]


def _own(js, pair):
    """The node's OWN code: the inlined kit cut out first.

    B-G1..B-G3 (2026-10-15): a kit DOCUMENTS its own entry points — `_fit_gate.js` defines `function fitGate(` and, since the shared
    read path `FITR` was added beside it, calls `fitStored(` inside itself. Searching the whole node therefore found the gate in
    every node that merely inlines the kit, and two readers that call neither (*Ladder Plan*, *Rank Keywords*) flipped to "gated"
    without a line changing. A lint that passes while the call is gone is worse than no lint, so the kit comes out before the
    question is asked — on the write side as well, which had the same hole.
    """
    for src in _kit_src(pair):
        if src and src in js:
            return js.replace(src, '')
    return js


def _workflows():
    for f in sorted(os.listdir(WF_DIR)):
        if not f.endswith('.json') or f in NOT_GENERATED:
            continue
        for w in json.load(open(os.path.join(WF_DIR, f), encoding='utf-8')):
            yield f, w


def _table(node):
    p = node.get('parameters') or {}
    return ((p.get('dataTableId') or {}).get('value')) or p.get('tableName')


def survey(workflows=None):
    """-> {'<gate> | <table>': {'writers': [...], 'readers': {'<wf> / <node>': gated?}}} over the generated workflows."""
    out = {}
    wfs = list(workflows if workflows is not None else _workflows())
    for pair in PAIRS:
        for table in pair['tables']:
            key = pair['gate'] + ' | ' + table
            writers, readers = [], {}
            for _f, w in wfs:
                wname = w.get('name') or ''
                loaders, writes = [], []
                for n in w.get('nodes') or []:
                    if n.get('type') != DT_TYPE or _table(n) != table:
                        continue
                    op = (n.get('parameters') or {}).get('operation')
                    if op == 'get':
                        loaders.append(n['name'])
                    elif op in WRITE_OPS:
                        writes.append(n['name'])
                if not loaders and not writes:
                    continue
                upstream = {}
                for s, o in (w.get('connections') or {}).items():
                    for lst in (o.get('main') or []):
                        for t in (lst or []):
                            upstream.setdefault(t['node'], []).append(s)
                code = {n['name']: ((n.get('parameters') or {}).get('jsCode') or '')
                        for n in (w.get('nodes') or []) if n.get('type') == CODE_TYPE}
                # the writers: every Code node on the path that produced the rows being written. The node feeding a Data Table
                # node is usually an IF ("Any Ladder Rows?") and the gate sits further back, so the walk is transitive -- the
                # question it answers is "was the gate anywhere on the way in?", which is the half of rule 2 we already keep.
                for wn in writes:
                    seen, stack = set(), list(upstream.get(wn, []))
                    while stack:
                        up = stack.pop()
                        if up in seen:
                            continue
                        seen.add(up)
                        if up in code and pair['write'] in _own(code[up], pair):
                            writers.append(wname + ' / ' + up)
                        stack.extend(upstream.get(up, []))
                for nm, js in code.items():              # every Code node that takes this table's rows from a loader
                    if any(("'" + ld + "'") in js for ld in loaders):
                        own = _own(js, pair)
                        readers[wname + ' / ' + nm] = any(r in own for r in _reads(pair))
            out[key] = {'gate': pair['gate'], 'table': table, 'write': pair['write'], 'read': ' or '.join(_reads(pair)),
                        'why': pair['why'], 'writers': sorted(set(writers)), 'readers': dict(sorted(readers.items()))}
    return out


def _kits_define():
    """A gate is only a gate while its entry points exist: a rename must break the build, not the rule."""
    bad = []
    for pair in PAIRS:
        src = open(os.path.join(V5_CODE, pair['kit']), encoding='utf-8').read()
        for needle in pair['defines']:
            if needle not in src:
                bad.append('%s: v5/code/%s no longer defines %r — the gate was renamed or removed, so gate_lint.PAIRS is stale'
                           % (pair['gate'], pair['kit'], needle))
    return bad


def check(write_record=True):
    """Fails the build on a read path that trusts storage. Returns (survey, the baselined debt that is still unpaid)."""
    bad = _kits_define()
    assert not bad, 'INVARIANTS rule 2 (gate pairs): \n  ' + '\n  '.join(bad)
    sv = survey()
    base = json.load(open(BASELINE, encoding='utf-8')) if os.path.exists(BASELINE) else {}
    new, unpaid = [], {}
    for key, row in sorted(sv.items()):
        known = set(((base.get(key) if isinstance(base.get(key), dict) else {}) or {}).get('ungated') or [])
        if not row['writers']:
            # the gate is not applied on the way in either: there is no pair to check, and nothing to be lulled by
            continue
        gated = [r for r, ok in row['readers'].items() if ok]
        ungated = [r for r, ok in row['readers'].items() if not ok]
        assert gated or not row['readers'], (
            'INVARIANTS rule 2 (gate pairs): the %s gate is applied where %s is written (%s) and on NO read path at all.\n'
            '  %s\n  Readers: %s' % (row['gate'], row['table'], ', '.join(row['writers']), row['why'],
                                     ', '.join(row['readers']) or 'none'))
        fresh = [r for r in ungated if r not in known]
        if fresh:
            new.append('%s: %d read path(s) take %s rows and never call %s: %s\n     (written through %s. %s)'
                       % (key, len(fresh), row['table'], row['read'], ', '.join(fresh),
                          ', '.join(row['writers']), row['why']))
        if ungated:
            unpaid[key] = sorted(ungated)
    assert not new, (
        'INVARIANTS rule 2 (gate pairs): %d new read path(s) trust stored data a gate refuses on the way in.\n  ' % len(new)
        + '\n  '.join(new)
        + '\n  Call the gate on the read path (R16 did it for the Rank Tracker: v5/code/_fit_gate.js `fitStored`), or -- only with'
          '\n  a reason, and a register row if it is a defect -- add the node to harness/gate_pairs_baseline.json.')
    if write_record:
        write_baseline(unpaid)
        json.dump({'pairs': sv, 'unpaid': unpaid,
                   'selftest': selftest()}, open(RECORD, 'w'), indent=1, sort_keys=True)
    return sv, unpaid


def write_baseline(unpaid):
    """The ratchet can only tighten: a reader that gained its gate leaves the baseline for ever, and a new one never enters it
    here (it fails the build first, which is the point). Same shape as retry_lint.write_baseline."""
    base = json.load(open(BASELINE, encoding='utf-8')) if os.path.exists(BASELINE) else {}
    for key, row in base.items():
        if not isinstance(row, dict):     # the file's own `_note`, which is prose for whoever opens it
            continue
        still = [r for r in (row.get('ungated') or []) if r in set(unpaid.get(key) or [])]
        row['ungated'] = sorted(still)
    os.makedirs(os.path.dirname(BASELINE), exist_ok=True)
    json.dump(base, open(BASELINE, 'w'), indent=1, sort_keys=True)
    return base


def seed_baseline():
    """Run once, by hand, to record today's debt. Never called by a build."""
    sv = survey()
    base = {}
    for key, row in sorted(sv.items()):
        if not row['writers']:
            continue
        ungated = sorted(r for r, ok in row['readers'].items() if not ok)
        if ungated:
            base[key] = {'why': row['why'], 'read_entry': row['read'], 'ungated': ungated}
    json.dump(base, open(BASELINE, 'w'), indent=1, sort_keys=True)
    return base


# ---- the lint's own self-test, recorded for harness S79 (the harness runs JS, not this file) --------------------------------
def selftest():
    """Three ways of breaking rule 2, each one caught. Build section 69 prints the result; S79 asserts it."""
    def wf(name, nodes, conns):
        return ('x.json', {'name': name, 'nodes': nodes, 'connections': conns})

    def dt(nm, table, op):
        return {'name': nm, 'type': DT_TYPE,
                'parameters': {'operation': op, 'dataTableId': {'__rl': True, 'mode': 'name', 'value': table}}}

    def js(nm, src):
        return {'name': nm, 'type': CODE_TYPE, 'parameters': {'jsCode': src}}

    ok = [wf('W', [dt('Load Ladders', 'seo_ladders', 'get'), dt('Save Ladder Rows', 'seo_ladders', 'insert'),
                   js('Plan', "fitGate(k, ctx); return rows;"),
                   js('Read', "const r = rowsOf('Load Ladders'); fitStored(row, ctx);")],
            {'Plan': {'main': [[{'node': 'Save Ladder Rows'}]]}})]
    gone = [wf('W', [dt('Load Ladders', 'seo_ladders', 'get'), dt('Save Ladder Rows', 'seo_ladders', 'insert'),
                     js('Plan', "fitGate(k, ctx); return rows;"),
                     js('Read', "const r = rowsOf('Load Ladders'); // no gate")],
             {'Plan': {'main': [[{'node': 'Save Ladder Rows'}]]}})]
    added = ok + [wf('V', [dt('Load Ladders', 'seo_ladders', 'get'),
                           js('New Reader', "const r = rowsOf('Load Ladders'); return r;")], {})]
    res = {}
    for nm, wfs in (('a_gated_pair_passes', ok), ('the_only_reader_loses_its_gate', gone), ('a_new_ungated_reader_appears', added)):
        s = survey(wfs)
        row = s['keyword fit | seo_ladders']
        gated = [r for r, g in row['readers'].items() if g]
        ungated = sorted(r for r, g in row['readers'].items() if not g)
        res[nm] = {'writers': row['writers'], 'gated': sorted(gated), 'ungated': ungated,
                   'caught': bool(row['writers']) and bool(ungated)}
    # the third way: a gate whose kit no longer defines its entry point
    import copy as _c
    saved = _c.deepcopy(PAIRS[0])
    PAIRS[0]['defines'] = ('function thisWasRenamed(',)
    res['the_kit_renames_its_entry_point'] = {'caught': bool(_kits_define())}
    PAIRS[0].update(saved)
    return res


if __name__ == '__main__':
    import sys
    if '--seed' in sys.argv:
        print(json.dumps(seed_baseline(), indent=1))
    else:
        s, u = check(write_record=False)
        for k, row in sorted(s.items()):
            print('%-42s writers %-2d readers %d, of them gated %d'
                  % (k, len(row['writers']), len(row['readers']), sum(1 for v in row['readers'].values() if v)))
        print('unpaid:', json.dumps(u, indent=1))
