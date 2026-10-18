"""A9 (2026-10-16, re-rating 2026-10-15 family F6 — "a cost the system reports about itself is what happened").

Three pieces every builder shares, so the fix reaches every path at once (three fixes of 2026-10-15 failed live because they reached one
path of several — R77, R79, R47):

* `answer_expr(src)` — R47 = R69 = R80. The *Prompt For Count (…)* Set node sent `String(output)` to Anthropic's free token counter, so a
  STRUCTURED answer (every agent with an output parser: 16 of them) reached it as the 15 characters "[object Object]" and was counted as
  4-6 tokens, labelled "measured". The answer is now sent the way it reached the run: text as text, a parsed object as its JSON.
* `count_chain(...)` / `bake_calls(...)` — R82. The same free counter behind an agent of a workflow that is not built by build_monitors.py's
  `WF` class (the Site Tracker's *Site Brief*), and its call table baked into that workflow's settle.
* `callback_after_settle(...)` — R115. A monitor posted its callback BEFORE it settled its ledger (exec 623: *POST AI Report* 1.1 s before
  *Ledger Settle (AI)*), so the callback could only carry the report item's DataForSEO-only `cost_usd` and the app showed it as the whole
  "actual" cost. The POST now waits for the settle: a Merge node joins the callback items (input 0) with the settle's answer (input 1) —
  n8n's v1 order holds a two-input node until both inputs have data — and *Callback Ledger (…)* puts the settled figure on every callback
  item as `run_ledger`, in the field names the main workflow's callbacks already carry.
"""
import json
import os
import re
import uuid

import retry_lint
from ladder_common import ANTHROPIC_COUNT_URL

ANTHROPIC_CRED = {'anthropicApi': {'id': 'SEOcredAnthropic', 'name': 'Anthropic (SEO Agent)'}}
_NS = uuid.UUID('a9c0571e-5e1f-4c4b-9f0d-2d6b1f6a9e15')


def answer_expr(src):
    """The `__answer` value of a *Prompt For Count (…)* node: the answer as the model returned it. `src` is the expression that reads the
    agent's `output` (`$json.output`, or `$('Agent').first().json.output`). Text stays text; a parsed object is sent as its JSON, which is
    what the parser read out of the model's own words (key order and whitespace can differ by a token or two, never by the whole answer)."""
    return "={{ ((o) => o == null ? '' : typeof o === 'string' ? o : JSON.stringify(o))(" + src + ") }}"


# A-28 / B-8 (re-rating 2026-10-17): the counter was sent the user prompt alone, but an n8n Tools Agent (v3.1) with an output parser
# sends more: a system message holding these formatting instructions and ONE tool, `format_final_json_response`, whose input schema is
# the parser's schema (wrapped in `output`) — and Anthropic adds its tool-use system prompt whenever a tool is offered. That is the
# 834-955 tokens a call the count missed against n8n's own `tokenUsage` (Reply Reader 1,025 counted vs 1,859; describe 3,876 vs 4,831;
# Content Reviewer 10,392 vs 11,276). Text copied from the n8n 2.41.4 image (@n8n/n8n-nodes-langchain dist, ToolsAgent/V3/helpers/
# runAgent.js `formatting_instructions`, ToolsAgent/common.js `getTools`); an agent with no parser and no system message sends neither.
AGENT_FORMAT_INSTRUCTIONS = ('IMPORTANT: For your response to user, you MUST use the `format_final_json_response` tool with your complete '
                             'answer formatted according to the required schema. Do not attempt to format the JSON manually - always use '
                             'this tool. Your response will be rejected if it is not properly formatted through this tool. Only use this '
                             'tool once you are ready to provide your final answer.')
AGENT_PARSER_TOOL_DESC = ('Use this tool to format your final response to the user in a structured JSON format. This tool validates your '
                          'output against a schema to ensure it meets the required format. ONLY use this tool when you have completed all '
                          'necessary reasoning and are ready to provide your final answer. Do not use this tool for intermediate steps or '
                          'for asking questions. The output from this tool will be directly returned to the user.')


def _no_double_braces(s):
    """An n8n expression ends at the first `}}`: a JSON literal spliced into one must never contain two braces in a row."""
    while '}}' in s or '{{' in s:
        s = s.replace('}}', '} }').replace('{{', '{ {')
    return s


def count_frame(nodes, conns, agent):
    """The `system` and `tools` the agent really sends, as a JS fragment (`, system: "...", tools: [...]`) to splice into the two
    count_tokens bodies of its chain, so the counted prompt is the prompt that was billed. '' for an agent without an output parser."""
    parsers = sorted({s for s, outs in conns.items() for l in (outs.get('ai_outputParser') or []) for t in (l or []) if t['node'] == agent})
    if not parsers:
        return ''
    assert len(parsers) == 1, 'A-28: ' + agent + ' has ' + str(len(parsers)) + ' output parsers'
    p = nodes[parsers[0]]['parameters']
    assert p.get('schemaType') == 'manual', 'A-28: ' + parsers[0] + ' is not a manual JSON schema (' + str(p.get('schemaType')) + ')'
    sys_msg = ((nodes[agent]['parameters'].get('options') or {}).get('systemMessage'))
    system = (str(sys_msg) + '\n\n' if sys_msg else '') + AGENT_FORMAT_INSTRUCTIONS
    tool = {'name': 'format_final_json_response', 'description': AGENT_PARSER_TOOL_DESC,
            'input_schema': {'type': 'object', 'properties': {'output': json.loads(p['inputSchema'])}, 'required': ['output']}}
    return _no_double_braces(', system: ' + json.dumps(system) + ', tools: ' + json.dumps([tool]))


COUNT_FRAME_MARK = '/*__A28_FRAME__*/'


def fill_count_frames(nodes, conns):
    """Replace the placeholder a builder left in its *Count Prompt / Count Answer (Agent)* bodies with the agent's frame. Returns how
    many bodies it filled (the main workflow's builder places the mark early and fills it at WRITE, after its parser edits)."""
    done = 0
    for name, n in nodes.items():
        m = re.match(r'^Count (?:Prompt|Answer) \((.+)\)$', name)
        body = str((n.get('parameters') or {}).get('jsonBody') or '')
        if not m or COUNT_FRAME_MARK not in body:
            continue
        n['parameters']['jsonBody'] = body.replace(COUNT_FRAME_MARK, count_frame(nodes, conns, m.group(1)))
        done += 1
    return done


def count_frame_ok(body, frame):
    """True when a count body carries the agent's frame (the build check for every count node)."""
    return not frame or frame in str(body or '')


def answer_expr_ok(value):
    """True when a `__answer` expression serialises an object instead of stringifying it (the build check for every workflow)."""
    v = str(value or '')
    return 'JSON.stringify(o)' in v and not re.search(r"String\(\s*\$[^)]*\.output", v)


def _node(name, ntype, ver, params, pos, **extra):
    n = {'parameters': params, 'id': str(uuid.uuid5(_NS, name)), 'name': name, 'type': ntype, 'typeVersion': ver, 'position': pos}
    n.update(extra)
    return n


def _link(conns, a, b, out=0, index=0):
    outs = conns.setdefault(a, {}).setdefault('main', [])
    while len(outs) <= out:
        outs.append([])
    outs[out].append({'node': b, 'type': 'main', 'index': index})


def _roots(paths):
    out = []
    for p in sorted(paths, key=lambda s: (s.count('.'), s)):
        if not any(p == q or p.startswith(q + '.') for q in out):
            out.append(p)
    return sorted(out)


def count_chain(wfobj, agents=None):
    """The free count_tokens chain behind each Claude agent of `wfobj` (or only `agents`), on the MAIN path (R17's lesson), exactly the
    shape build_monitors.py's WF.count_chain builds: Prompt For Count -> Count Prompt -> Count Answer -> After Count -> what the agent
    fed before. Returns the call table the workflow's settle prices with (Monitor_Ledger_Settle.js `AI_CALLS`)."""
    nodes, conns = {n['name']: n for n in wfobj['nodes']}, wfobj['connections']
    table = []
    for mn, m in sorted(nodes.items()):
        if m['type'] != '@n8n/n8n-nodes-langchain.lmChatAnthropic':
            continue
        o = m['parameters'].get('options') or {}
        model = m['parameters']['model']['value']
        for ag in [t['node'] for l in ((conns.get(mn) or {}).get('ai_languageModel') or [[]]) for t in (l or [])]:
            if agents is not None and ag not in agents:
                continue
            txt = str(nodes[ag]['parameters'].get('text') or '')
            assert txt.startswith('='), 'R82: ' + ag + "'s prompt is not an expression"
            pre = sorted({s for s, outs in conns.items() for l in (outs.get('main') or []) for t in (l or []) if t['node'] == ag})
            assert len(pre) == 1, 'R82: ' + ag + ' has ' + str(len(pre)) + ' main inputs, so $json is not one node'
            fed = pre[0]
            branch = next((i for i, l in enumerate((conns.get(fed) or {}).get('main') or []) if any(t['node'] == ag for t in (l or []))), None)
            assert branch is not None, 'R82: no main connection from ' + fed + ' to ' + ag
            ref = "$('" + fed + "').item.json"
            prompt = re.sub(r'\$json\b', lambda _m: ref, txt)
            assert '$json.' not in prompt and prompt != txt, 'R82: ' + ag + "'s prompt still reads $json after the rewrite"
            set_n, cp = 'Prompt For Count (' + ag + ')', 'Count Prompt (' + ag + ')'
            ca, af = 'Count Answer (' + ag + ')', 'After Count (' + ag + ')'
            assert not any(x in nodes for x in (set_n, cp, ca, af)), 'R82: ' + ag + ' is already counted'
            px, py = nodes[ag]['position']
            own, mdl = "$('" + set_n + "').item.json", json.dumps(model) + count_frame(nodes, conns, ag)   # A-28: the system + tool it sends
            http = lambda name, body, at: _node(name, 'n8n-nodes-base.httpRequest', 4.5, {
                'method': 'POST', 'url': ANTHROPIC_COUNT_URL,
                'authentication': 'predefinedCredentialType', 'nodeCredentialType': 'anthropicApi',
                'sendHeaders': True, 'headerParameters': {'parameters': [{'name': 'anthropic-version', 'value': '2023-06-01'}]},
                'sendBody': True, 'specifyBody': 'json', 'jsonBody': body,
                'options': {'timeout': 20000, 'response': {'response': {'neverError': True}}}}, at,
                credentials=dict(ANTHROPIC_CRED), onError='continueRegularOutput', alwaysOutputData=True, **retry_lint.RETRY)
            wfobj['nodes'].extend([
                _node(set_n, 'n8n-nodes-base.set', 3.4, {'mode': 'manual', 'includeOtherFields': True, 'options': {}, 'assignments': {'assignments': [
                    {'id': str(uuid.uuid5(_NS, ag + ':prompt')), 'name': '__prompt', 'value': prompt, 'type': 'string'},
                    {'id': str(uuid.uuid5(_NS, ag + ':answer')), 'name': '__answer', 'value': answer_expr('$json.output'), 'type': 'string'}]}},
                    [px, py + 320], onError='continueRegularOutput', alwaysOutputData=True),
                http(cp, '={{ JSON.stringify({ model: ' + mdl + ', messages: [{ role: "user", content: String($json.__prompt || "") }] }) }}',
                     [px + 200, py + 320]),
                http(ca, '={{ JSON.stringify({ model: ' + mdl + ', messages: ['
                     + '{ role: "user", content: String(' + own + '.__prompt || "") }, '
                     + '{ role: "assistant", content: String(' + own + '.__answer || "") }] }) }}', [px + 400, py + 320]),
                _node(af, 'n8n-nodes-base.code', 2, {'jsCode':
                    "// R82 (2026-10-16, monitor_cost.count_chain): the two free token counts are taken; hand " + ag + "'s own items back\n"
                    "// to the pipeline, unchanged and in order, so nothing downstream sees the counter (the R17 resume pattern).\n"
                    "return $('" + ag + "').all();\n"}, [px + 600, py + 320])])
            outs = (conns.get(ag) or {}).get('main') or []
            assert len(outs) == 1, 'R82: ' + ag + ' has ' + str(len(outs)) + ' main outputs'
            succ = [t['node'] for t in (outs[0] or [])]
            assert succ, 'R82: ' + ag + ' feeds nothing'
            conns[ag]['main'] = [[]]
            for a, b in ((ag, set_n), (set_n, cp), (cp, ca), (ca, af)):
                _link(conns, a, b)
            for s in succ:
                _link(conns, af, s)
            table.append({'node': ag, 'model': model, 'model_node': mn, 'max_tokens': int(o.get('maxTokensToSample') or 0),
                          'effort': o.get('effort') or '', 'streaming': bool(o.get('streaming')),
                          'template_chars': len(txt), 'input': fed, 'branch': branch, 'ref': ref,
                          'fields': _roots(re.findall(r"\$json\.([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)", txt)),
                          'from': [[a, b] for a, b in sorted({(a, b) for a, b in re.findall(
                              r"\$\('([^']+)'\)\.(?:first\(\)|item)\.json\.([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)", txt)})],
                          'count_prompt': cp, 'count_answer': ca, 'count_set': set_n, 'count_resume': af,
                          'count_rounds': 0, 'count_per_item': True, 'after': succ})
    return table


def bake_calls(wfobj, settle_code, table, cal=''):
    """Bake the call table (and the cost-factor node, '' for none) into a monitor settle built from Monitor_Ledger_Settle.js."""
    n = next(x for x in wfobj['nodes'] if x['name'] == settle_code)
    src = n['parameters']['jsCode']
    assert '/*__AI_CALLS__*/[]' in src and "/*__CAL__*/''" in src, 'R82: ' + settle_code + ' has nowhere to learn its Claude calls'
    n['parameters']['jsCode'] = (src.replace('/*__AI_CALLS__*/[]', json.dumps(table, sort_keys=True), 1)
                                 .replace("/*__CAL__*/''", json.dumps(cal), 1))


# ---------------------------------------------------------------------------------------------------------------------------------
# R115: the callback after the settle
# ---------------------------------------------------------------------------------------------------------------------------------
def _read(v5_dir, f):
    return open(os.path.join(v5_dir, 'code', f), encoding='utf-8').read()


def ledger_cb_src(v5_dir):
    """The run_ledger kit (v5/code/_ledger_cb.js), for every node that turns a settle into the callback's `run_ledger`."""
    return _read(v5_dir, '_ledger_cb.js').rstrip('\n')


def _outs(conns, n):
    return [t['node'] for l in ((conns.get(n) or {}).get('main') or []) for t in (l or [])]


def _reach(conns, starts, stop=()):
    seen, stack = set(starts), list(starts)
    while stack:
        cur = stack.pop()
        if cur in stop:
            continue
        for t in _outs(conns, cur):
            if t not in seen:
                seen.add(t)
                stack.append(t)
    return seen


def callback_after_settle(wfobj, wiring, has_cb, post, v5_dir, declared_ends):
    """Move a monitor's callback behind its settle (R115). Called at WRITE time, after ledger_mainline() has built the settle chain.

    Before: <builder> -> Has Callback (X)? -> POST … ; <report end> -> … -> Ledger Settle (X) (n8n's v1 order ran whichever branch sat
    higher on the canvas first — the callback, in exec 623).
    After:  <builder> -> Ledger Join (X) [input 0];  Ledger Settle (X) -> Ledger Join (X) [input 1];  Ledger Join (X) -> Callback
            Ledger (X) -> Has Callback (X)? -> POST … . The Merge holds until both inputs have data, so the POST cannot run before the
            settle; *Callback Ledger (X)* reads the settle and puts its figure on the callback as `run_ledger`.
    Two loose ends had to be handled, each asserted rather than assumed:
      * a POST that ledger_mainline() wired into the settle chain as a loose end (the Content Cadence's) would now loop back into the
        settle it waits for — that edge is removed;
      * a builder that is NOT downstream of the declared report end (the Cadence's *Cadence Status*, whose run reached the settle only
        through that POST) feeds the settle chain itself, so its run still settles. A second settle run is harmless (*Settle Run
        Ledger* matches `status = reserved`), and *Callback Ledger* posts once: it returns nothing once *Has Callback* has run."""
    tag = wiring['reserve'][len('Run Ledger Row ('):-1]
    nodes, conns = {n['name']: n for n in wfobj['nodes']}, wfobj['connections']
    settle_code, entry = 'Ledger Settle (' + tag + ')', wiring.get('balance_end') or ('DFS Balance End (' + tag + ')')
    join, cbl = 'Ledger Join (' + tag + ')', 'Callback Ledger (' + tag + ')'
    for nm in (has_cb, post, settle_code, entry):
        assert nm in nodes, 'R115: ' + nm + ' is missing from ' + str(wfobj.get('name'))
    assert join not in nodes and cbl not in nodes, 'R115: the callback of ' + str(wfobj.get('name')) + ' already waits for the settle'
    # the builders: whatever fed Has Callback, with the output index each one fed it from
    preds = []
    for s, o in list(conns.items()):
        for i, lst in enumerate(o.get('main') or []):
            if any(t['node'] == has_cb for t in (lst or [])):
                preds.append([s, i])
                o['main'][i] = [t for t in lst if t['node'] != has_cb]
    assert preds, 'R115: nothing feeds ' + has_cb
    # the POST no longer feeds the settle chain (it would loop back into the settle it now waits for)
    if post in conns:
        conns[post]['main'] = [[t for t in (lst or []) if t['node'] not in (entry, settle_code)] for lst in (conns[post].get('main') or [])]
    # every builder's run reaches the settle: a builder the declared report end does not lead to feeds the settle chain itself
    declared = [e for e in (declared_ends or []) if e in nodes and e != post]
    assert declared, 'R115: ' + str(wfobj.get('name')) + ' declares no report end that feeds its settle'
    from_ends = _reach(conns, declared, stop={settle_code, entry})
    fed_direct = []
    for p, i in preds:
        if p not in from_ends and p not in declared:
            _link(conns, p, entry, i)
            fed_direct.append(p)
    hx, hy = nodes[has_cb]['position']
    wfobj['nodes'].append(_node(join, 'n8n-nodes-base.merge', 3.2, {'mode': 'append'}, [hx - 440, hy + 120]))
    # C-1 (re-rating 2026-10-17): the schedule of this workflow, so its callback can say the run was late (CU.lateRun)
    from ladder_common import _schedule_of
    sched = dict(_schedule_of(wfobj) or {})
    if sched.get('cron'):
        _mn, _hr, _dom, _mon, _dow = sched['cron'].split()
        sched['kind'] = 'monthly' if _dom != '*' else ('weekly' if _dow != '*' else 'daily')
    code = (_read(v5_dir, 'Callback_Ledger.js').replace('/*__LEDGER_CB__*/', ledger_cb_src(v5_dir))
            .replace('/*__CATCHUP__*/', _read(v5_dir, '_catchup.js').rstrip('\n')).replace('__SCHED_JSON__', json.dumps(sched))
            .replace('__SETTLE__', settle_code).replace('__HAS_CALLBACK__', has_cb).replace('__PREDS__', json.dumps(preds)))
    for ph in ('/*__LEDGER_CB__*/', '/*__CATCHUP__*/', '__SCHED_JSON__', '__SETTLE__', '__HAS_CALLBACK__', '__PREDS__'):
        assert ph not in code, ph + ' left in ' + cbl
    wfobj['nodes'].append(_node(cbl, 'n8n-nodes-base.code', 2, {'jsCode': code}, [hx - 220, hy + 120]))
    for p, i in preds:
        _link(conns, p, join, i, 0)
    _link(conns, settle_code, join, 0, 1)
    _link(conns, join, cbl)
    _link(conns, cbl, has_cb)
    wiring.setdefault('callbacks', []).append({'has_callback': has_cb, 'post': post, 'join': join, 'ledger': cbl, 'settle': settle_code,
                                               'preds': preds, 'fed_settle_directly': fed_direct})
    return wiring['callbacks'][-1]


RAN_LATE_MARK = '/*__RAN_LATE__*/'


def schedule_with_kind(wfobj):
    """The workflow's schedule ({trigger, cron, tz, wf}) plus `kind` (daily / weekly / monthly), as Callback Ledger and RL read it."""
    from ladder_common import _schedule_of
    sched = dict(_schedule_of(wfobj) or {})
    if sched.get('cron'):
        _mn, _hr, _dom, _mon, _dow = sched['cron'].split()
        sched['kind'] = 'monthly' if _dom != '*' else ('weekly' if _dow != '*' else 'daily')
    return sched


def bake_ran_late(wfobj, v5_dir):
    """F-L (2026-10-18, C-1 follow-up): fill RAN_LATE_MARK in every Code node of `wfobj` with the catch-up kit, the workflow's own SCHED
    and the RL kit (v5/code/_ran_late.js). Returns the names of the nodes it baked (asserted by the caller)."""
    sched = schedule_with_kind(wfobj)
    assert sched.get('cron'), 'F-L: ' + str(wfobj.get('name')) + ' carries the ran-late mark but has no schedule to be late against'
    src = _read(v5_dir, '_catchup.js').rstrip('\n') + '\nconst SCHED = ' + json.dumps(sched) + ';\n' + _read(v5_dir, '_ran_late.js').rstrip('\n')
    baked = []
    for n in wfobj['nodes']:
        if n.get('type') == 'n8n-nodes-base.code' and RAN_LATE_MARK in str(n['parameters'].get('jsCode') or ''):
            n['parameters']['jsCode'] = n['parameters']['jsCode'].replace(RAN_LATE_MARK, src)
            baked.append(n['name'])
    return baked


def triggers_of(wfobj):
    return [n['name'] for n in wfobj['nodes'] if str(n.get('type') or '').lower().endswith(('trigger', 'webhook'))
            or n['type'] in ('n8n-nodes-base.scheduleTrigger', 'n8n-nodes-base.executeWorkflowTrigger', 'n8n-nodes-base.manualTrigger')]


def prove_after_settle(wfobj, cb):
    """The order proof (build section 55's kind, on the generated graph): (1) the POST is reachable from the triggers; (2) with the Join
    taken out it is not — every path to it passes through the Join; (3) the Join is a Merge whose input 1 is fed by the settle code and by
    nothing else, and whose input 0 carries the builders; n8n's v1 order holds a two-input node until both inputs have data, so the POST
    cannot run before the settle. Returns the facts; the caller asserts them."""
    conns, nodes = wfobj['connections'], {n['name']: n for n in wfobj['nodes']}
    trig = triggers_of(wfobj)
    into = {0: set(), 1: set()}
    for s, o in conns.items():
        for lst in (o.get('main') or []):
            for t in (lst or []):
                if t['node'] == cb['join']:
                    into.setdefault(int(t.get('index') or 0), set()).add(s)
    jn = nodes.get(cb['join']) or {}
    return {'reachable': cb['post'] in _reach(conns, trig),
            'bypass': cb['post'] in _reach(conns, trig, stop={cb['join']}),
            'merge': jn.get('type') == 'n8n-nodes-base.merge' and (jn.get('parameters') or {}).get('mode') == 'append',
            'input1': sorted(into.get(1, set())), 'input0': sorted(into.get(0, set())),
            'settle': cb['settle'], 'preds': [p for p, _ in cb['preds']]}
