"""B-A10 (2026-10-15, FIX_PLAN.md §3.14; docs/system-review-2026-10-14/INVARIANTS.md **rule 3**): the in-200 retry gate, as a
splice any builder can apply, instead of a shape hand-wired once per path.

**The defect.** DataForSEO reports most of its failures *inside* an HTTP 200 (`status_code` 40101, 50000, or a task that answers
20000 with no result), so n8n's `retryOnFail` -- which only fires when a node *fails* -- never sees them. R18 is the proof of what
that costs: in execution 549 both *SERP Top 10* and *Facts SERP* came back 40101 inside a 200, nothing was re-sent, and a ladder
was planned, scored "winnable 68" and written on a results page nobody had ever seen. R18 fixed three chains by hand
(`build_v4.py` section 56) and `retry_lint.check_in200` then measured the rest: **49 DataForSEO nodes across 12 workflows** sat
outside a recorded gate.

**The shape.** Identical for every call, which is the point -- a rule that is re-typed per path is a rule that will be forgotten:

    <X>  ->  <X> Retry Plan  ->  Any <X> Retries?  --true-->  Wait Before <X> Retry  ->  <X> (Retry)  ->  <X> Answers  -> dst
                                                   --false------------------------------------------>  <X> Answers

* *<X> Retry Plan* pairs the requests with the answers and asks `RT.plan` (v5/code/_dfs_retry.js) which of them a second attempt
  can help: a provider-side failure can, a wrong field or an exhausted quota cannot. **It refuses to re-send anything at all when
  the requests and the answers cannot be paired one to one** -- re-sending the wrong request is worse than not retrying.
* *<X> (Retry)* is a byte copy of the call, so the retry items (which `RT.plan` copies from the original request items) resolve
  `$json....` exactly as the first attempt did. No body is rewritten, which is the one place the hand-wired version could slip.
* *<X> Answers* puts each retry's answer in the failed one's place (`RT.merge`), counts what really happened (`RT.stats`) and
  attaches `__dfs` -- the `RT.evidence` block -- to every item, so **rule 1** holds downstream: a call that failed twice is
  `unavailable`, and nothing may score, rank or advise from it.

**The money (R28 / R31 / R32 / R33 are the precedent).** A retry must not double-charge. Two halves:
  1. a failed DataForSEO task is billed 0, so re-sending a failure costs nothing;
  2. where both attempts *were* billed (a task that answers 20000 with an empty result is real work), `__dfs.cost_usd` sums
     **both attempts and counts each task once by its own id** -- the same `__dfsOnce` rule the run ledger has used since R28.
     The builders put both HTTP nodes on their ledger's node list, so the money is counted once and never missed.
  `retry_empty=False` is the third half, for a call that *creates* a paid task (`on_page/task_post`): there, a second attempt is
  a second crawl, so only an envelope or task error is ever re-sent and an empty result never is.
"""
import copy
import json
import os
import re

from ladder_common import node_id

WAIT_SECONDS = 5          # the pause before the second attempt (the AI gate waits 20 s for a batch of up to 24; one call needs less)
MAX_RETRIES = 24          # never re-send more than this many of one batch, whatever failed
HTTP_TYPE = 'n8n-nodes-base.httpRequest'


def _kit(v5_dir):
    return open(os.path.join(v5_dir, 'code', '_dfs_retry.js'), encoding='utf-8').read().rstrip('\n')


def plan_js(v5_dir, http, requests_node, max_retries=MAX_RETRIES, retry_empty=True, what='', branch=0):
    """The *<X> Retry Plan* node: which of this call's answers a second attempt can help.
    `branch` is the output of the requests node the call is wired to: `$('IF').all()` reads output 0, so a call hanging off an
    IF's FALSE branch (Start Crawl does) would otherwise be paired with the items that went the other way."""
    allcall = ".all()" if not branch else ".all(%d)" % int(branch)
    only = ('' if retry_empty else
            ",\n  // this call CREATES a paid task (on_page/task_post), so a second attempt is a second crawl: only an envelope or\n"
            "  // task error is ever re-sent, never a task that answered 20000 with an empty result (that one did the work and was billed).\n"
            "  only: (q, f) => !f.code || f.code >= 40000")
    return (_kit(v5_dir) + '\n'
            "// B-A10 (2026-10-15, INVARIANTS rule 3): the second attempt for *" + http + "*. DataForSEO answers a dead task with HTTP 200,\n"
            "// which n8n's retryOnFail never sees (R18: a ladder was planned, scored and written on two results pages that both failed).\n"
            "// Only the failed requests are re-sent, once, after a pause - a failed DataForSEO task is billed 0, so the retry can cost at\n"
            "// most what the failures cost, and *" + http + " Answers* counts both attempts once per task id (R28).\n"
            "const reqs = (() => { try { return $('" + requests_node + "')" + allcall + ".map(i => (i && i.json) || {}); } catch (e) { return []; } })();\n"
            "const live = reqs.filter(r => r && !r.skip);\n"
            "const answers = $input.all().map(i => (i && i.json) || {});\n"
            "if (!live.length || !answers.length) return [{ json: { skip: true, is_retry: false, reason: 'nothing was asked' } }];\n"
            "// a request re-sent in the wrong place is worse than a request not re-sent: when the two lists cannot be paired one to one,\n"
            "// nothing is sent again and the evidence stays what the first attempt made it (INVARIANTS rule 3's honest half).\n"
            "if (live.length !== answers.length) return [{ json: { skip: true, is_retry: false, unpaired: true,\n"
            "  reason: 'the ' + live.length + ' request(s) and the ' + answers.length + ' answer(s) could not be paired, so nothing was sent again' } }];\n"
            "const p = RT.plan(live, answers, { max: " + str(int(max_retries)) + only + " });\n"
            "if (!p.items.length) return [{ json: { skip: true, is_retry: false, failed: p.failed, reasons: p.reasons,\n"
            "  reason: p.failed ? 'nothing can be gained by asking again: ' + (p.permanent[0] || p.reasons[0] || 'the provider refused') : 'every request answered' } }];\n"
            "p.items[0].retry_total = p.items.length; p.items[0].failed_total = p.failed;\n"
            "return p.items.map(j => ({ json: j }));\n")


def answers_js(v5_dir, http, plan_node, retry_node, what, unit='request'):
    """The *<X> Answers* node: the merged answers, what really happened, and what it cost -- each task once."""
    return (_kit(v5_dir) + '\n'
            "// B-A10 (2026-10-15, INVARIANTS rule 3 + rule 1): the first answers of *" + http + "* with each retry's answer in the failed\n"
            "// one's place, and `__dfs` - the evidence block - on every item, so a call that failed TWICE is `unavailable` and nothing\n"
            "// downstream may score, rank or advise from it. `__dfs.cost_usd` is both attempts counted once per task id (R28).\n"
            "const first = (() => { try { return $('" + http + "').all().map(i => (i && i.json) || {}); } catch (e) { return []; } })();\n"
            "const retryItems = (() => { try { return $('" + plan_node + "').all().map(i => (i && i.json) || {}).filter(x => x && x.is_retry); } catch (e) { return []; } })();\n"
            "const retryAnswers = (() => { try { return $('" + retry_node + "').all().map(i => (i && i.json) || {}); } catch (e) { return []; } })();\n"
            "const stats = RT.stats(first, {}, retryItems, retryAnswers);\n"
            "const ev = RT.evidence(" + json.dumps(what) + ", stats, { unit: " + json.dumps(unit) + " });\n"
            "// R28: a task's cost counts once, by its own id, across BOTH attempts - a figure that is money that moved, never a quote\n"
            "const seen = new Set(); let spent = 0; let noId = 0;\n"
            "for (const a of [...first, ...retryAnswers]) {\n"
            "  for (const t of (Array.isArray((a || {}).tasks) ? a.tasks : [])) {\n"
            "    const c = Number((t || {}).cost || 0); if (!c) continue;\n"
            "    const id = String((t || {}).id || '');\n"
            "    if (!id) { noId++; spent += c; continue; }\n"
            "    if (seen.has(id)) continue;\n"
            "    seen.add(id); spent += c;\n"
            "  }\n"
            "}\n"
            "ev.cost_usd = +spent.toFixed(4); ev.tasks = seen.size + noId;\n"
            "ev.cost_basis = 'measured: ' + ev.tasks + ' task(s) at what each reported, counted once by task id across both attempts'\n"
            "  + (noId ? ' (' + noId + ' with no task id of their own)' : '') + '.';\n"
            "// and the same figure PER ITEM, because a caller that prices one site or one keyword reads its own answer: the merged item\n"
            "// is the retry's, so without this the first attempt's money (a task that answered 20000 with an empty result did the work\n"
            "// and was billed) would simply disappear from that row.\n"
            "const retryFor = new Map(); (retryItems || []).forEach((q, k) => { const i = Number(q && q.retry_of); if (Number.isFinite(i)) retryFor.set(i, (retryAnswers || [])[k]); });\n"
            "// the same dedupe rule as above, inside the item: a provider that repeats a task id across the two attempts is one task.\n"
            "const pairCost = (a, b) => { const ids = new Set(); let c = 0;\n"
            "  for (const r of [a, b]) for (const t of (Array.isArray((r || {}).tasks) ? r.tasks : [])) {\n"
            "    const v = Number((t || {}).cost || 0); if (!v) continue; const id = String((t || {}).id || '');\n"
            "    if (id) { if (ids.has(id)) continue; ids.add(id); } c += v; }\n"
            "  return +c.toFixed(4); };\n"
            "const out = (stats.answers || []).map((a, i) => ({ ...(a || {}), __dfs: ev,\n"
            "  __dfs_cost_usd: pairCost(first[i], retryFor.get(i)) }));\n"
            "return out.length ? out.map(j => ({ json: j })) : [{ json: { __dfs: ev, __dfs_cost_usd: 0 } }];\n")


def _no_comments(js):
    """JavaScript with its comments taken out, so a node is judged on what it runs and not on what it says about itself.
    A `//` right after a colon is spared, so a URL inside a string survives (lineage_lint.py learned the same lesson)."""
    out = re.sub(r'/\*.*?\*/', ' ', js, flags=re.S)
    return re.sub(r'(?<!:)//[^\n]*', ' ', out)


def _parent_of(conns, http):
    """-> (name, branch) of the one node whose main output feeds this call, and nothing else."""
    found = []
    for s, o in conns.items():
        for bi, lst in enumerate((o or {}).get('main') or []):
            for t in (lst or []):
                if t.get('node') == http:
                    found.append((s, bi))
    assert len(found) == 1, 'B-A10: %r is fed by %d nodes (%s) -- the gate pairs requests to answers, so it needs exactly one' % (http, len(found), found)
    return found[0]


def splice(wf, http, v5_dir, what, unit='request', code_dir=None, code_prefix='', max_retries=MAX_RETRIES,
           retry_empty=True, repoint=True, ignore=(), dy=180, dx=190):
    """Puts the gate around one DataForSEO call, in place. -> the chain, for retry_lint.record_gate()."""
    name = wf.get('name') or ''
    nodes = wf['nodes']
    conns = wf.setdefault('connections', {})
    by_name = {n['name']: n for n in nodes}
    node = by_name.get(http)
    assert node is not None, 'B-A10: no node called %r in %r' % (http, name)
    assert node.get('type') == HTTP_TYPE, 'B-A10: %r is not an HTTP node' % http
    requests_node, branch = _parent_of(conns, http)
    dsts = [dict(t) for lst in ((conns.get(http) or {}).get('main') or []) for t in (lst or [])]
    assert dsts, 'B-A10: %r feeds nothing, so there is nothing to gate' % http

    plan_node, if_node, wait_node = http + ' Retry Plan', 'Any ' + http + ' Retries?', 'Wait Before ' + http + ' Retry'
    retry_node, ans_node = http + ' (Retry)', http + ' Answers'
    for nm in (plan_node, if_node, wait_node, retry_node, ans_node):
        assert nm not in by_name, 'B-A10: %r already exists in %r' % (nm, name)
    x, y = node.get('position') or [0, 0]

    def _add(nm, ntype, ver, params, pos, **extra):
        n = {'parameters': params, 'id': node_id(name, nm), 'name': nm, 'type': ntype, 'typeVersion': ver, 'position': list(pos)}
        n.update(extra)
        nodes.append(n)
        by_name[nm] = n
        return n

    _add(plan_node, 'n8n-nodes-base.code', 2,
         {'jsCode': plan_js(v5_dir, http, requests_node, max_retries, retry_empty, what, branch)}, [x + dx, y + dy])
    _add(if_node, 'n8n-nodes-base.if', 2.3,
         {'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'loose', 'version': 3},
                         'conditions': [{'id': node_id(name, if_node + ':c'), 'leftValue': '={{ $json.is_retry === true }}',
                                         'rightValue': '', 'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}],
                         'combinator': 'and'}, 'looseTypeValidation': True, 'options': {}}, [x + 2 * dx, y + dy])
    # `unit` is written out although typeVersion 1.1 defaults to seconds: the Wait node of @version 1 defaults to HOURS, and an
    # implicit unit is one typeVersion away from pausing a customer's run for five hours.
    _add(wait_node, 'n8n-nodes-base.wait', 1.1, {'amount': WAIT_SECONDS, 'unit': 'seconds'}, [x + 3 * dx, y + dy],
         webhookId=node_id(name, wait_node + ':hook'))
    rn = copy.deepcopy(node)
    rn['name'] = retry_node
    rn['id'] = node_id(name, retry_node)
    rn['position'] = [x + 4 * dx, y + dy]
    rn['onError'] = 'continueRegularOutput'
    nodes.append(rn)
    by_name[retry_node] = rn
    _add(ans_node, 'n8n-nodes-base.code', 2,
         {'jsCode': answers_js(v5_dir, http, plan_node, retry_node, what, unit)}, [x + 5 * dx, y])

    def _link(a, b, out=0, index=0):
        outs = conns.setdefault(a, {}).setdefault('main', [])
        while len(outs) <= out:
            outs.append([])
        outs[out].append({'node': b, 'type': 'main', 'index': index})

    conns[http] = {'main': [[{'node': plan_node, 'type': 'main', 'index': 0}]]}
    _link(plan_node, if_node)
    _link(if_node, wait_node, 0)
    _link(if_node, ans_node, 1)
    _link(wait_node, retry_node)
    _link(retry_node, ans_node)
    for t in dsts:
        _link(ans_node, t['node'], 0, t.get('index', 0))

    moved = 0
    if repoint:
        # Every node that read the call by name now reads the MERGED answers -- otherwise the retry's answer would be written,
        # paid for, and then ignored by the one node that needed it.
        #   `$('X')` is not the only way a node names another, and finding that out is most of why this is a lint and not a
        # `str.replace`: *Parse Backlinks* -- the node that prices the whole run -- reads three of its DataForSEO calls through
        # a helper, `all('Run BL Requests')`, and *LB Assemble* through `pair('LB DFS Requests', 'Run LB DFS')`. So the rule is
        # the name in ARGUMENT position, in either quote; and anything still holding it afterwards fails the build BY NAME
        # instead of being guessed at. Prose is not a reference: *Ladder Pool* throws 'Check the DataForSEO credential on
        # "Run Ladder Research"', and *Research Requests* opens with a comment naming it -- comments go before the check, which
        # is the lesson lineage_lint.py learned the hard way the same day.
        arg = re.compile(r"""([([,]\s*)(['"])%s\2(\s*[),\]])""" % re.escape(http))
        left = []
        skip = set(ignore) | {plan_node, ans_node, retry_node}
        for n in nodes:
            if n['name'] in skip:
                continue
            js = (n.get('parameters') or {}).get('jsCode')
            if not js:
                continue
            if '__LEDGER_NODES' in js:
                # the run ledger names the HTTP nodes ON PURPOSE -- it prices the calls, and a Code node has no `tasks`. The
                # retries are added to that list beside them (R28's `__dfsOnce` then counts each task once).
                continue
            was = js
            js = arg.sub(lambda m: m.group(1) + m.group(2) + ans_node + m.group(2) + m.group(3), js)
            if js != was:
                n['parameters']['jsCode'] = js
                moved += 1
            if arg.search(_no_comments(js)):
                left.append(n['name'])
        assert not left, ('B-A10: %r is still named in %s after the gate was spliced in, in a form this does not understand -- '
                          'point it at %r (the merged answers) by hand, or the retry will be paid for and ignored.'
                          % (http, ', '.join(sorted(set(left))), ans_node))
    if code_dir:
        os.makedirs(code_dir, exist_ok=True)
        for nm in (plan_node, ans_node):
            fn = code_prefix + re.sub(r'[^A-Za-z0-9_.-]+', '_', nm) + '.js'
            open(os.path.join(code_dir, fn), 'w', encoding='utf-8').write(by_name[nm]['parameters']['jsCode'])
    return {'chain': [http, plan_node, if_node, wait_node, retry_node, ans_node], 'answers': ans_node,
            'retry': retry_node, 'plan': plan_node, 'requests': requests_node, 'branch': branch,
            'repointed': moved, 'dsts': [t['node'] for t in dsts]}
