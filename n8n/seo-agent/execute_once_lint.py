"""P1 review B1 (2026-11-12): an executeOnce Code node sees ONE input item.

n8n slices an executeOnce node's input to its first item before the node runs (n8n-core workflow-execute.js `handleExecuteOnce`, applied
in `runNode`), and the task runner builds `$input` from that sliced input. A Code node that is executeOnce and reads `$input.all()`,
`$input.last()`, `$input.item` or `$items()` therefore sees one row where it expects many. That is how the first version of *Page Slot*
admitted every page run (reproduced on n8n 2.41.4: four ledger rows in, one seen, "0 page runs writing"). The offline harness runs the code
without node settings, so only this lint can see it.

**The rule**: a Code node with executeOnce reads its many rows BY NAME (`$('Node').all()`, which is never sliced), or is not executeOnce
(a Code node in "run once for all items" mode already runs once). `$input.first()` and `$json` are fine.

**The check**: walks the GENERATED workflows, cuts the inlined kits (`const XX = (() => { ... })();`) and comments out of each node's code,
and fails the build on any executeOnce Code node that reads its input as many items, unless it is named in `harness/execute_once_baseline.json`
with the reason it is harmless (the nodes found when the lint landed; a ratchet: an entry that no longer breaks the rule is reported too).

**What it does not look at**: a node that reads many items through a variable (`const inp = $input; inp.all()`), and nodes of any type other
than Code (a Data Table or HTTP node with executeOnce makes one request; that is what it is for).
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
WF_DIR = os.path.join(HERE, 'workflows')
BASELINE = os.path.join(HERE, 'harness', 'execute_once_baseline.json')
NOT_GENERATED = ('SEO_Agent_v3_original_export.json', 'SEO_Agent_Test_Callback_Receiver.json')
_KIT = re.compile(r'(?ms)^const [A-Z]{2,5} = \(\(\) => \{.*?^\}\)\(\);[ \t]*$')
_COMMENT = re.compile(r'//[^\n]*')
_MANY = re.compile(r'\$input\.(?:all|last)\(|\$input\.item\b|\$items\(')


def own_code(src):
    return _COMMENT.sub('', _KIT.sub('', src or ''))


def offenders(wf_dir=WF_DIR):
    out = []
    for f in sorted(os.listdir(wf_dir)):
        if not f.endswith('.json') or f in NOT_GENERATED:
            continue
        d = json.load(open(os.path.join(wf_dir, f), encoding='utf-8'))
        for w in (d if isinstance(d, list) else [d]):
            for n in w.get('nodes', []):
                if n.get('type') != 'n8n-nodes-base.code' or not n.get('executeOnce'):
                    continue
                hits = sorted(set(m.group(0) for m in _MANY.finditer(own_code((n.get('parameters') or {}).get('jsCode')))))
                if hits:
                    out.append({'workflow': f, 'node': n['name'], 'reads': hits})
    return out


def check(wf_dir=WF_DIR):
    found = offenders(wf_dir)
    base = json.load(open(BASELINE, encoding='utf-8'))
    known = {(b['workflow'], b['node']) for b in base['nodes']}
    new = [o for o in found if (o['workflow'], o['node']) not in known]
    assert not new, ('execute_once_lint (P1 review B1): an executeOnce Code node reads its input as many items, but n8n hands it only the first '
                     'item. Read the rows by name ($(\'Node\').all()) or drop executeOnce: %s' % json.dumps(new))
    gone = sorted(k for k in known if k not in {(o['workflow'], o['node']) for o in found})
    # self-test: the rule bites on the shape that broke Page Slot
    probe = own_code("// a comment with $input.all()\nconst rows = $input.all().map(i => i.json);")
    assert _MANY.search(probe), 'execute_once_lint: the self-test does not bite'
    assert not _MANY.search(own_code("const rows = $('Load Page Slots').all(); const a = $input.first().json;")), 'execute_once_lint: by-name reads must pass'
    print('execute_once_lint (P1 review B1): %d executeOnce Code nodes read many input items, all %d on the baseline with a reason%s'
          % (len(found), len(known), ('; no longer offending (remove from the baseline): ' + str(gone)) if gone else ''))
    return found


if __name__ == '__main__':
    for o in offenders():
        print(o)
