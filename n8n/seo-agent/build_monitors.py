#!/usr/bin/env python3
"""Builds the growth monitors (v4.5): SEO Agent — AI Visibility Tracker (weekly), SEO Agent — Backlink Monitor (weekly watch, full report on the
website's monthly cycle) and SEO Agent — Audit Scheduler (the monthly technical re-audit). Since 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §4) none
of them has a schedule of its own: each website runs them in its own 7-day cycle, started by the Cycle Dispatcher through *Manual Run* with
`trigger: 'cycle'` (ST.cycleOf, v5/code/_site_time.js); the AI Pulse (daily) keeps its cron.
All three read the sites from seo_sites + seo_ladders and their settings from seo_monitors, run on demand through *Manual Run*
({ domain | site_id, email?, callback_url?, country?, location_code?, competitors? }) and write their Code nodes to harness/code_v4."""
import json, os, re, uuid
import url_lint   # D15 (2026-10-11 system review): the canonical-host lint
import env_settings as _env   # B-F5 (2026-10-15): a build with no n8n/.env must refuse, not bake its fallbacks
_env.require_settings('build_monitors.py')
import retry_lint   # G1 (2026-10-11 system review): one retry rule for every external HTTP node
import dfs_gate     # B-A10 (2026-10-15): INVARIANTS rule 3 — the in-200 retry gate, one shape for every DataForSEO call
import monitor_cost # A9 (2026-10-16, F6): the count_tokens answer expression, and the callback that waits for the settle (R115)
from ladder_common import (DT_TYPE, DT_VERSION, dt_create_params, dt_insert_params, dt_get_all_params, dt_upsert_params, dt_upsert_params_keys,
                           SITES_TABLE, SITES_COLS, LADDER_TABLE, LADDER_COLS, LOG_TABLE, LOG_COLS, PROFILE_TABLE, PROFILE_COLS, CASE_TABLE, CASE_COLS,
                           MONITORS_TABLE, MONITORS_COLS, AI_PROMPTS_TABLE, AI_PROMPTS_COLS, AI_ANSWERS_TABLE, AI_ANSWERS_COLS, AI_VIS_TABLE, AI_VIS_COLS,
                           BL_SNAP_TABLE, BL_SNAP_COLS, PROSPECT_TABLE, PROSPECT_COLS, AUDITS_TABLE, AUDITS_COLS, CACHE_TABLE, CACHE_COLS, dt_get_where_params,
                           AI_DAILY_TABLE, AI_DAILY_COLS, QUERY_TABLE, dt_get_all_where_params, dt_delete_where_params,
                           LINKS_TABLE, LINKS_COLS, LINK_IMPORTS_TABLE, LINK_IMPORTS_COLS, LINK_GRAPH_TABLE, LINK_GRAPH_COLS,
                           AI_PAGES_TABLE, AI_PAGES_COLS, AI_TARGETS_TABLE, AI_TARGETS_COLS, AI_GROWTH_TABLE, AI_GROWTH_COLS,
                           LINK_OUTREACH_TABLE, LINK_OUTREACH_COLS, LISTINGS_TABLE, LISTINGS_COLS, LINK_IMPACT_TABLE, LINK_IMPACT_COLS, HISTORY_TABLE, METRICS_TABLE,
                           RUN_LEDGER_TABLE, RUN_LEDGER_COLS, dt_update_params, monitor_ledger_js, LEDGER_EST,   # R9 (2026-10-13): every scheduled run reserves and settles a ledger row
                           ledger_mainline,   # R17 (2026-10-14): and reserves it on the MAIN path, before the first paid call
                           ledger_tag,   # B-C2 (2026-10-15): …and settles a MEASURED Claude figure into it, not the reservation
                           site_time_src, CYCLES_TABLE)   # 2026-10-19: the website's calendar (ST) and its cycle row (seo_cycles)
from env_settings import SENDER, ENV, BRAND, OPS_EMAIL
BING_ON = bool((ENV.get('SEO_BING_WEBMASTER_API_KEY') or '').strip())   # v4.10: optional free sources, baked in at build time (apply_env.py rebuilds)
AHREFS_ON = bool((ENV.get('SEO_AHREFS_API_KEY') or '').strip())
HERE = os.path.dirname(os.path.abspath(__file__)); V5 = os.path.join(HERE, 'v5'); OUT = os.path.join(HERE, 'workflows'); CODE = os.path.join(HERE, 'harness', 'code_v4')
rd = lambda p: open(os.path.join(V5, p), encoding='utf-8').read()
MAIN_WF = json.load(open(os.path.join(OUT, 'SEO_Agent_v4.json')))[0]
FORM_PATH = next(n for n in MAIN_WF['nodes'] if n['name'] == 'Start Form')['webhookId']
BASE_URL = os.environ.get('N8N_PUBLIC_URL', 'http://localhost:5678').rstrip('/')
FORM_URL, API_URL = BASE_URL + '/form/' + FORM_PATH, BASE_URL + '/webhook/seo-keyword-check'
_NI = next(n for n in MAIN_WF['nodes'] if n['name'] == 'Normalize Input')['parameters']['jsCode']
_COUNTRIES = re.search(r"\nconst COUNTRIES = \{.*?\n\};", _NI, re.S); assert _COUNTRIES, 'Normalize Input: COUNTRIES not found'
import seo_events   # 2026-10-13 (G12 / G29): the dated event registry and the lineage / annotation / change-test kits
def src(p):   # a Code node source with the shared snippets inlined
    s = seo_events.inline(rd('code/' + p))
    s = s.replace('/*__MONITOR_SITES__*/', rd('code/_monitor_sites.js')).replace('/*__REPORT_KIT__*/', rd('code/_report_kit.js')).replace('/*__AI_STATS__*/', rd('code/_ai_stats.js'))
    s = s.replace('/*__SITE_TIME__*/', site_time_src())   # 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §4.8): the website's calendar and the cycle run (ST), inside _monitor_sites.js or on its own
    s = s.replace('/*__GONE__*/', rd('code/_gone.js').rstrip('\n'))   # RV-1 (2026-10-21): the pages that no longer answer, one message in every report
    s = s.replace('/*__SITE_MODEL__*/', rd('code/_site_model.js').rstrip('\n'))   # G19 (SITE_MODEL_SPEC.md): the one site model, one copy per node that asks for it
    s = s.replace('/*__FIT_GATE__*/', rd('code/_fit_gate.js').rstrip('\n'))   # B-G1 / B-G2 (2026-10-15): the fit gate, on the READ path too (FITR, INVARIANTS rule 2)
    s = s.replace('/*__AI_ACCESS_KIT__*/', rd('code/_ai_access_kit.js').rstrip('\n'))   # B9-9: the one robots.txt matcher (AI Access + Growth Robots)
    s = s.replace('/*__DRAFTS__*/', rd('code/_drafts.js').rstrip('\n'))   # P34-1: which stored outreach draft may still be offered
    s = s.replace('/*__PODCAST__*/', rd('code/_podcast.js').rstrip('\n'))   # L5: podcast guest opportunities (free directory, the show's own feed and site)
    s = s.replace('/*__AB__*/', rd('code/_ab.js').rstrip('\n'))   # L7: two subjects a batch, and no verdict under 30 sends per variant
    s = s.replace('/*__DFS_RETRY__*/', rd('code/_dfs_retry.js').rstrip('\n'))   # R18 / R19 / B-L4 / B-L5: the in-200 retry rule and the two like-for-like guards (RT.comparable, RT.likeForLike)
    s = s.replace('/*__LINK_KIT__*/', rd('code/_link_kit.js')).replace('/*__OUTREACH_KIT__*/', rd('code/_outreach_kit.js')).replace('/*__LISTINGS__*/', rd('code/_listings.js')).replace('/*__CLAIMS__*/', rd('code/_claims.js')).replace('/*__DRAFT_QA__*/', rd('code/_draft_qa.js')).replace('__BING_ENABLED__', 'true' if BING_ON else 'false').replace('__AHREFS_ENABLED__', 'true' if AHREFS_ON else 'false')
    s = s.replace('/*__AI_ENTITIES__*/', rd('code/_ai_entities.js').rstrip('\n'))   # F1a (2026-10-23): who an AI answer names - one entity per business, its role, the client's position (ENGINE_AUDIT E3 E4 E5 E8 E10 E16)
    s = s.replace('__AI_ANSWERS_COLS__', json.dumps([c for c, _ in AI_ANSWERS_COLS]))   # F2 (2026-10-23): AI Answer Rows / AI Analysed Rows write exactly the table's columns
    s = s.replace('/*__AI_PANEL__*/', rd('code/_ai_panel.js').rstrip('\n'))   # G6 (2026-10-18): the AI question panel at scale (limits, markets, strata, chunks, the one cost formula)
    s = s.replace('/*__RIVALS__*/', rd('code/_rivals.js').rstrip('\n'))   # C-2 / C-8 (2026-10-17): the one rival set and the category-provider rule (inside the outreach kit, and in AI Metrics)
    s = s.replace('/*__COUNTRIES__*/', "// ---- countries: copied from the main workflow's Normalize Input by build_monitors.py (DataForSEO location code = 2000 + ISO numeric) ----" + _COUNTRIES.group(0))
    assert '/*__' not in s and '_ENABLED__' not in s, p + ': placeholder left'
    return s.replace('__FORM_URL__', FORM_URL).replace('__API_URL__', API_URL)
LEDGER_WIRING = {}   # R9: workflow name -> its ledger nodes; merged into harness/ledger_wiring.json at the end (S57)

# ---- B-C2 (2026-10-15, build section 84): the free token counter behind every Claude agent of a scheduled workflow ---------------
# The engine has 22 Claude agents. Eight live in the main workflow and have been counted by Anthropic's free `count_tokens` since build
# sections 62 and 76; the eleven in the other workflows were never priced from tokens at all — a monitor settled its RESERVATION
# (`CC.aiRun` with no figure), so the Claude cost it reported to the owner and to the day's guard was a guess wearing the clothes of a
# measurement. The seven agents of the six workflows built here are counted now, by the same two free calls on the same MAIN path.
from ladder_common import ANTHROPIC_COUNT_URL as COUNT_URL   # one definition of the free endpoint; _ai_nodes_of excludes it by URL
AI_CALLS = {}   # workflow name -> its Claude call table, baked from the real agent nodes and read by that workflow's settle


def _roots(paths):
    """`{'facts', 'facts.name'}` -> `['facts']`: a field is counted once, at its root-most prefix (build section 51's rule)."""
    out = []
    for p in sorted(paths, key=lambda s: (s.count('.'), s)):
        if not any(p == q or p.startswith(q + '.') for q in out): out.append(p)
    return sorted(out)
NS = uuid.UUID('5e0a9e1e-2a1f-4c0b-9d8e-0000a9e0c0de')
SMTP = {'smtp': {'id': 'SEOcredSmtpGmail', 'name': 'Gmail SMTP (SEO Agent)'}}
DFS = {'httpBasicAuth': {'id': 'SEOcredDataForSE', 'name': 'DataForSEO'}}
ANTHROPIC = {'anthropicApi': {'id': 'SEOcredAnthropic', 'name': 'Anthropic (SEO Agent)'}}
GOOGLE = {'googleApi': {'id': 'SEOcredGoogleSvc', 'name': 'Google Service Account (SEO Agent)'}}
ARR = {'type': 'array', 'items': {'type': 'string'}}
LOAD = dict(alwaysOutputData=True, executeOnce=True, onError='continueRegularOutput')
HTTP_X = dict(onError='continueRegularOutput', **retry_lint.RETRY)   # G1: one retry rule (3 tries, 5 s apart) for every external HTTP node

class WF:
    def __init__(self, wid, name, prefix, timeout, code_prefix=''):   # code_prefix: harness file prefix when node names repeat another workflow's (AI Pulse)
        self.wid, self.name, self.prefix, self.timeout, self.N, self.C, self.code_prefix = wid, name, prefix, timeout, [], {}, code_prefix
    def nid(self, name): return str(uuid.uuid5(NS, self.prefix + ':' + name))
    def node(self, name, ntype, ver, params, pos, **extra):
        n = {'parameters': params, 'id': self.nid(name), 'name': name, 'type': ntype, 'typeVersion': ver, 'position': pos}; n.update(extra); self.N.append(n); return n
    def code(self, name, file, pos, **extra): return self.node(name, 'n8n-nodes-base.code', 2, {'jsCode': src(file) if file.endswith('.js') else file}, pos, **extra)
    def iff(self, name, expr, pos):
        return self.node(name, 'n8n-nodes-base.if', 2.3, {'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'loose', 'version': 3}, 'conditions': [{'id': self.nid(name + ':c'), 'leftValue': '=' + expr, 'rightValue': '', 'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}], 'combinator': 'and'}, 'looseTypeValidation': True, 'options': {}}, pos)
    def ensure(self, name, table, cols, pos): return self.node(name, DT_TYPE, DT_VERSION, dt_create_params(table, cols), pos, onError='continueRegularOutput')
    def load(self, name, table, pos): return self.node(name, DT_TYPE, DT_VERSION, dt_get_all_params(table), pos, **LOAD)
    def dfs_http(self, name, pos, batch=1, interval=300, timeout=90000):
        return self.node(name, 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': '={{ $json.endpoint }}', 'authentication': 'genericCredentialType', 'genericAuthType': 'httpBasicAuth', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify($json.body) }}',
            'options': {'batching': {'batch': {'batchSize': batch, 'batchInterval': interval}}, 'timeout': timeout}}, pos, credentials=DFS, **HTTP_X)
    def agent(self, name, prompt, schema, pos, max_tokens=8192, model=('claude-sonnet-5-5', 'Claude Sonnet 5.5')):   # v4.13: a cheaper model (no extended thinking) for short classification
        self.node(name, '@n8n/n8n-nodes-langchain.agent', 3.1, {'promptType': 'define', 'text': '=' + rd('prompts/' + prompt), 'hasOutputParser': True, 'options': {}}, pos, retryOnFail=True, maxTries=2, waitBetweenTries=3000, onError='continueRegularOutput')
        opts = {'maxTokensToSample': max_tokens, 'thinking': True, 'thinkingMode': 'adaptive', 'effort': 'low'} if 'sonnet' in model[0] or 'opus' in model[0] else {'maxTokensToSample': max_tokens}
        self.node('Claude — ' + name, '@n8n/n8n-nodes-langchain.lmChatAnthropic', 1.6, {'model': {'__rl': True, 'mode': 'list', 'value': model[0], 'cachedResultName': model[1]}, 'options': opts}, [pos[0] - 100, pos[1] + 200], credentials=ANTHROPIC)
        self.node('Parser — ' + name, '@n8n/n8n-nodes-langchain.outputParserStructured', 1.3, {'schemaType': 'manual', 'inputSchema': json.dumps(schema)}, [pos[0] + 120, pos[1] + 200])
        self.C['Claude — ' + name] = {'ai_languageModel': [[{'node': name, 'type': 'ai_languageModel', 'index': 0}]]}
        self.C['Parser — ' + name] = {'ai_outputParser': [[{'node': name, 'type': 'ai_outputParser', 'index': 0}]]}
    def count_node(self, name, body, pos):
        """One free `/v1/messages/count_tokens` call. Free or not it is an EXTERNAL HTTP call, so it carries the retry rule
        (INVARIANTS rule 3) and can never fail a run: `neverError` keeps a non-200 out of the error path, `continueRegularOutput`
        keeps a transport failure out of it, and `alwaysOutputData` means the next node still runs. A call that does not answer
        simply has no `input_tokens`, and its call falls back to characters with that basis (rule 1)."""
        return self.node(name, 'n8n-nodes-base.httpRequest', 4.5, {
            'method': 'POST', 'url': COUNT_URL,
            'authentication': 'predefinedCredentialType', 'nodeCredentialType': 'anthropicApi',
            'sendHeaders': True, 'headerParameters': {'parameters': [{'name': 'anthropic-version', 'value': '2023-06-01'}]},
            'sendBody': True, 'specifyBody': 'json', 'jsonBody': body,
            'options': {'timeout': 20000, 'response': {'response': {'neverError': True}}}}, pos,
            credentials=ANTHROPIC, onError='continueRegularOutput', alwaysOutputData=True, **retry_lint.RETRY)

    def count_chain(self):
        """B-C2 (2026-10-15, build section 84): put the two free counts on the MAIN path behind every Claude agent of this workflow
        and return the call table its settle prices with. Called at WRITE time, when every connection exists.

        Four things this had to get right, and each one is asserted rather than assumed:
          * **the chain is on the main path, never beside it.** R17's lesson: n8n's v1 order runs a side branch last, or not at all.
            *After Count (…)* hands the agent's own items straight back, so nothing downstream ever sees the counter.
          * **the prompt is re-read against the node that FED the agent.** The agent's prompt is an expression over `$json`; one node
            later `$json` is the agent's answer. Every monitor agent is fed one job item per SITE, so the reference is `.item` through
            pairedItem (`$('X').first()` would price site 1's prompt for all of them) — and the output index it hangs off is recorded
            for the fallback read, because `$('X').all()` defaults to the output the ACTIVE node is connected to and the settle is
            connected to none of these (the trap that caught section 62 out with *Keyword Seeds* on output 1 of *Route Mode*).
          * **the agent's own prompt is not touched.** Only a copy of the expression goes into the Set node, so the prompt the model
            receives is byte-for-byte what it was.
          * **every call is on the main path**, because these agents do not loop: one job in, one answer out, so the counter sees all
            of them and `rounds` can carry no cap."""
        nodes = {n['name']: n for n in self.N}
        table = []
        for mn, m in sorted(nodes.items()):
            if m['type'] != '@n8n/n8n-nodes-langchain.lmChatAnthropic': continue
            o = m['parameters'].get('options') or {}
            model = m['parameters']['model']['value']
            for ag in [t['node'] for l in ((self.C.get(mn) or {}).get('ai_languageModel') or [[]]) for t in (l or [])]:
                assert ag in nodes, 'B-C2: ' + self.name + ' wires ' + mn + ' to a missing agent ' + ag
                txt = str(nodes[ag]['parameters'].get('text') or '')
                assert txt.startswith('='), 'B-C2: ' + ag + "'s prompt is not an expression"
                pre = sorted({s for s, outs in self.C.items() for l in (outs.get('main') or []) for t in (l or []) if t['node'] == ag})
                assert len(pre) == 1, 'B-C2: ' + ag + ' has ' + str(len(pre)) + ' main inputs, so $json is not one node'
                fed = pre[0]
                branch = next((i for i, l in enumerate((self.C.get(fed) or {}).get('main') or []) if any(t['node'] == ag for t in (l or []))), None)
                assert branch is not None, 'B-C2: no main connection from ' + fed + ' to ' + ag
                ref = "$('" + fed + "').item.json"
                prompt = re.sub(r'\$json\b', lambda _m: ref, txt)
                assert '$json.' not in prompt and prompt != txt, 'B-C2: ' + ag + "'s prompt still reads $json after the rewrite"
                set_n, cp = 'Prompt For Count (' + ag + ')', 'Count Prompt (' + ag + ')'
                ca, af = 'Count Answer (' + ag + ')', 'After Count (' + ag + ')'
                px, py = nodes[ag]['position']
                # what the agent really sent and what it really answered, one item per call. It fails open like the rest of the chain:
                # an expression that cannot resolve leaves __prompt empty and the count comes back with no input_tokens.
                self.node(set_n, 'n8n-nodes-base.set', 3.4, {'mode': 'manual', 'includeOtherFields': True, 'options': {}, 'assignments': {'assignments': [
                    {'id': str(uuid.uuid5(NS, 'bc2:' + self.prefix + ':' + ag + ':prompt')), 'name': '__prompt', 'value': prompt, 'type': 'string'},
                    {'id': str(uuid.uuid5(NS, 'bc2:' + self.prefix + ':' + ag + ':answer')), 'name': '__answer',
                     'value': monitor_cost.answer_expr('$json.output'), 'type': 'string'}]}},   # R47 / R80 (2026-10-16): an object as its JSON
                    [px, py + 320], onError='continueRegularOutput', alwaysOutputData=True)
                mdl, own = json.dumps(model) + monitor_cost.count_frame(nodes, self.C, ag), "$('" + set_n + "').item.json"   # A-28: the system + tool it sends
                self.count_node(cp, '={{ JSON.stringify({ model: ' + mdl + ', messages: [{ role: "user", content: String($json.__prompt || "") }] }) }}',
                                [px + 200, py + 320])
                self.count_node(ca, '={{ JSON.stringify({ model: ' + mdl + ', messages: ['
                                + '{ role: "user", content: String(' + own + '.__prompt || "") }, '
                                + '{ role: "assistant", content: String(' + own + '.__answer || "") }] }) }}', [px + 400, py + 320])
                self.code(af, "// B-C2 (2026-10-15, build section 84): the two free token counts are taken; hand " + ag + "'s own items\n"
                              "// back to the pipeline, unchanged and in order, so nothing downstream sees the counter (the R17 resume pattern).\n"
                              "return $('" + ag + "').all();\n", [px + 600, py + 320])
                outs = (self.C.get(ag) or {}).get('main') or []
                assert len(outs) == 1, 'B-C2: ' + ag + ' has ' + str(len(outs)) + ' main outputs'
                succ = [t['node'] for t in (outs[0] or [])]
                assert succ, 'B-C2: ' + ag + ' feeds nothing'
                self.C[ag]['main'] = [[]]
                self.link(ag, set_n); self.chain(set_n, cp, ca, af)
                for s in succ: self.link(af, s)
                table.append({'node': ag, 'model': model, 'model_node': mn, 'max_tokens': int(o.get('maxTokensToSample') or 0),   # R57: its runs price a retry
                              'effort': o.get('effort') or '', 'streaming': bool(o.get('streaming')),
                              'template_chars': len(txt), 'input': fed, 'branch': branch, 'ref': ref,
                              'fields': _roots(re.findall(r"\$json\.([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)", txt)),
                              'from': [[a, b] for a, b in sorted({(a, b) for a, b in re.findall(
                                  r"\$\('([^']+)'\)\.(?:first\(\)|item)\.json\.([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)", txt)})],
                              'count_prompt': cp, 'count_answer': ca, 'count_set': set_n, 'count_resume': af,
                              'count_rounds': 0,        # no cap: every call of a monitor agent is on the main path (it does not loop)
                              'count_per_item': True, 'after': succ})
        return table

    def bake_calls(self):
        """B-C2: the call table and the calibration node go into this workflow's settle, which is the only node that prices them."""
        w, tag = LEDGER_WIRING[self.name], ledger_tag(LEDGER_WIRING[self.name])
        n = next(x for x in self.N if x['name'] == 'Ledger Settle (' + tag + ')')
        src_js, table = n['parameters']['jsCode'], AI_CALLS[self.name]
        assert '/*__AI_CALLS__*/[]' in src_js and "/*__CAL__*/''" in src_js, 'B-C2: ' + self.name + "'s settle has nowhere to learn its Claude calls"
        # both defaults are valid JS on their own (`[]` and `''`), so a workflow whose builder has not been taught this keeps exactly
        # R31's behaviour instead of carrying a placeholder into a running node
        n['parameters']['jsCode'] = (src_js.replace('/*__AI_CALLS__*/[]', json.dumps(table, sort_keys=True), 1)
                                     .replace("/*__CAL__*/''", json.dumps(w['cost_cal']), 1))
        # the pricing table and R31's "did any model run" sweep must name the same agents, or one of the two is stale
        assert sorted(c['node'] for c in table) == sorted(w['ai_nodes']), \
            'B-C2: ' + self.name + ' prices ' + str([c['node'] for c in table]) + ' but sweeps ' + str(w['ai_nodes'])
        w['ai_calls'] = table

    def pdf_chain(self, tag, pos, keep_extra=False):
        x, y = pos
        self.code('Prepare PDF ' + tag, "// Copy of each report HTML named index.html for the PDF renderer (Gotenberg requires that exact file name); one item per site.\nreturn $input.all().map(item => { const doc = (item.binary || {}).data; if (!doc) return item; return { json: item.json, binary: { ...(item.binary || {}), html: { ...doc, fileName: 'index.html', mimeType: 'text/html', fileExtension: 'html' } } }; });", [x, y])
        self.node('Render PDF ' + tag, 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': 'http://gotenberg:3000/forms/chromium/convert/html', 'sendBody': True, 'contentType': 'multipart-form-data',
            'bodyParameters': {'parameters': [{'parameterType': 'formBinaryData', 'name': 'files', 'inputDataFieldName': 'html'}, {'name': 'paperWidth', 'value': '8.27'}, {'name': 'paperHeight', 'value': '11.69'}, {'name': 'marginTop', 'value': '0.5'}, {'name': 'marginBottom', 'value': '0.5'}, {'name': 'marginLeft', 'value': '0.5'}, {'name': 'marginRight', 'value': '0.5'}, {'name': 'printBackground', 'value': 'true'}]},
            'options': {'timeout': 120000, 'response': {'response': {'responseFormat': 'file', 'outputPropertyName': 'pdf'}}}}, [x + 220, y], onError='continueRegularOutput', **retry_lint.RETRY)
        self.code('Attach PDF ' + tag, "// Attach the PDF (when the renderer succeeded) next to the report's other files, per site; a renderer failure never fails the run.\nconst src = $('Prepare PDF " + tag + "').all(); const got = $input.all();\nreturn src.map((s, i) => { const g = got[i] || {}; const pdf = (g.binary && g.binary.pdf && !(g.json && g.json.error)) ? g.binary.pdf : null;\n  const name = String(s.json.file_name || 'report.html').replace(/\\.html?$/i, '') + '.pdf'; const binary = { ...(s.binary || {}) }; delete binary.html;\n  if (pdf) binary.pdf = { ...pdf, fileName: name, mimeType: 'application/pdf', fileExtension: 'pdf' };\n  return { json: { ...s.json, pdf_ready: !!pdf, pdf_file_name: pdf ? name : null }, binary }; });", [x + 440, y])
    def deliver(self, tag, pos, attach_expr):
        x, y = pos
        # R115 (2026-10-16): remembered, so write() can put this callback behind the run's settle once the settle chain exists
        self.deliveries = list(getattr(self, 'deliveries', [])) + [tag]
        self.iff('Has Email (' + tag + ')?', '{{ !!$json.email }}', [x, y])
        self.node('Send ' + tag + ' Report', 'n8n-nodes-base.emailSend', 2.1, {'fromEmail': SENDER, 'toEmail': '={{ $json.email }}', 'subject': '={{ $json.subject }}', 'emailFormat': 'html', 'html': '={{ $json.html }}', 'options': {'appendAttribution': False, **({'fileAttachments': attach_expr} if attach_expr else {})}}, [x + 220, y], credentials=SMTP, onError='continueRegularOutput', retryOnFail=True, maxTries=3, waitBetweenTries=5000)
        self.iff('Has Callback (' + tag + ')?', '{{ !!$json.callback_url }}', [x + 220, y + 200])
        self.node('POST ' + tag + ' Report', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': '={{ $json.callback_url }}', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify($json) }}', 'options': {'timeout': 30000}}, [x + 440, y + 200], onError='continueRegularOutput')
        self.link('Has Email (' + tag + ')?', 'Send ' + tag + ' Report'); self.link('Has Callback (' + tag + ')?', 'POST ' + tag + ' Report')
    def ai_retry_gate(self, pos, nxt, batch=10, interval=200, timeout=150000):
        """D19 (2026-10-11 system review): DataForSEO reports a task error inside an HTTP 200 (status_code 40000 / 50000), which n8n's
        retryOnFail never sees, so 7 of 42 AI requests of execution 362 / 363 were simply missing from the week's figures. Every failed
        request is re-sent once after a pause and the answers are merged back in order before `nxt` (*Parse AI Answers*). Only the failed
        requests are re-sent, so the retry costs at most what the failures cost (a failed DataForSEO task is billed 0)."""
        x, y = pos
        self.code('AI Retry Requests', 'AI_Retry_Requests.js', [x, y])
        self.iff('Any AI Retries?', '{{ !$json.skip }}', [x + 220, y])
        self.node('Wait Before AI Retry', 'n8n-nodes-base.wait', 1.1, {'amount': 20}, [x + 440, y - 110], webhookId=self.nid('Wait Before AI Retry:hook'))
        self.dfs_http('Run AI Retries', [x + 660, y - 110], batch=batch, interval=interval, timeout=timeout)
        self.code('Merge AI Answers', 'Merge_AI_Answers.js', [x + 880, y])
        self.link('Run AI Requests', 'AI Retry Requests'); self.link('AI Retry Requests', 'Any AI Retries?')
        self.link('Any AI Retries?', 'Wait Before AI Retry', 0); self.link('Any AI Retries?', 'Merge AI Answers', 1)
        self.chain('Wait Before AI Retry', 'Run AI Retries', 'Merge AI Answers')
        self.link('Merge AI Answers', nxt)
        retry_lint.record_gate(self.name, ['Run AI Requests', 'AI Retry Requests', 'Any AI Retries?', 'Wait Before AI Retry', 'Run AI Retries', 'Merge AI Answers', nxt])

    def run_ledger(self, mode, tag, plan, ends, pos, measured=''):
        """R9 (2026-10-13, re-rating): one seo_run_ledger row per scheduled run — reserved as a SIDE BRANCH off the plan node (a Data Table
        node answers with the row it wrote, not with its input, so the ledger must never sit in the workflow's own data path) and settled at
        the end with the DataForSEO cost the run measured. The row carries a DataForSEO estimate beside the Claude one, so the main
        workflow's daily guard finally sees what the schedules spend; a monitor itself is never refused by it."""
        x, y = pos
        row_node = 'Run Ledger Row (' + tag + ')'
        reserve_js, settle_js = monitor_ledger_js(V5, mode, plan, row_node, measured)
        self.node('Ensure Run Ledger (' + tag + ')', DT_TYPE, DT_VERSION, dt_create_params(RUN_LEDGER_TABLE, RUN_LEDGER_COLS), [x, y], onError='continueRegularOutput', executeOnce=True)
        self.code(row_node, reserve_js, [x + 220, y], executeOnce=True)
        self.node('Reserve Run Ledger (' + tag + ')', DT_TYPE, DT_VERSION, dt_insert_params(RUN_LEDGER_TABLE, RUN_LEDGER_COLS), [x + 440, y], onError='continueRegularOutput', alwaysOutputData=True, executeOnce=True)
        self.code('Ledger Settle (' + tag + ')', settle_js, [x + 220, y + 160], executeOnce=True)
        # the update matches status = reserved, so a row settles once and a refused row stays refused (P1-1's rule in the main workflow)
        self.node('Settle Run Ledger (' + tag + ')', DT_TYPE, DT_VERSION, dt_update_params(RUN_LEDGER_TABLE, RUN_LEDGER_COLS,
            [('run_id', '={{ $execution.id }}'), ('status', 'reserved')],
            # G23 (2026-10-13): the settle also records which part of the money was measured and which estimated, in figures and in words
            {'status': 'done', 'settled_usd': '={{ $json.settled_usd }}', 'dfs_usd': '={{ $json.dfs_usd }}', 'ai_usd': '={{ $json.ai_usd }}',
             'cost_mode': '={{ $json.cost_mode }}', 'measured_usd': '={{ $json.measured_usd }}', 'estimated_usd': '={{ $json.estimated_usd }}',
             'cost_basis': '={{ $json.cost_basis }}'}), [x + 440, y + 160],
            onError='continueRegularOutput', alwaysOutputData=True, executeOnce=True)
        # B-C2 (2026-10-15): the per-model correction factors the monthly reconciliation writes into seo_cache (`cost:factor:claude`,
        # reconcile_claude_cost.py). The main workflow has priced through them since section 51; a monitor priced through nothing,
        # because it settled a reservation. Now that it settles a measurement it reads the same factors, so one engine reports one
        # price. Free (a local table) and fail-open: no rows, or no table yet, and the Anthropic list prices stand.
        cal_node = 'Load Cost Factors (' + tag + ')'
        self.node(cal_node, DT_TYPE, DT_VERSION, dt_get_where_params(CACHE_TABLE, 'kind', 'eq', 'cost'), [x, y + 160], **LOAD)
        self.chain(plan, 'Ensure Run Ledger (' + tag + ')', row_node, 'Reserve Run Ledger (' + tag + ')')
        for e in ends: self.link(e, cal_node)
        self.chain(cal_node, 'Ledger Settle (' + tag + ')', 'Settle Run Ledger (' + tag + ')')
        LEDGER_WIRING[self.name] = {'mode': mode, 'plan': plan, 'reserve': row_node, 'settle': 'Settle Run Ledger (' + tag + ')',
                                    'settle_from': list(ends), 'measured': measured, 'est': LEDGER_EST[mode],
                                    'cost_cal': cal_node,   # B-C2: where the settle reads the reconciliation's correction factors
                                    'resume': 'After Run Ledger (' + tag + ')'}   # R17: the node that hands the plan's items back

    def sticky(self, content, pos, w, h, color=5): return self.node('Note', 'n8n-nodes-base.stickyNote', 1, {'content': content, 'height': h, 'width': w, 'color': color}, pos)
    def link(self, a, b, out=0):
        outs = self.C.setdefault(a, {}).setdefault('main', [])
        while len(outs) <= out: outs.append([])
        outs[out].append({'node': b, 'type': 'main', 'index': 0})
    def chain(self, *names):
        for a, b in zip(names, names[1:]): self.link(a, b)
    def in200_gate(self, http, what, unit='request', **kw):
        """B-A10 (2026-10-15, INVARIANTS rule 3): the in-200 retry gate around one DataForSEO call — DataForSEO reports most of
        its failures inside an HTTP 200, which `retryOnFail` never sees. One shape for every call (dfs_gate.py), spliced after the
        workflow's connections are made, so whatever read the call now reads the merged answers and their evidence."""
        g = dfs_gate.splice({'name': self.name, 'nodes': self.N, 'connections': self.C}, http, V5, what=what, unit=unit,
                            code_dir=CODE, code_prefix=self.code_prefix, **kw)
        retry_lint.record_gate(self.name, g['chain'])
        return g
    def write(self, fname):
        # R17 (2026-10-14, FIX_PLAN §3.12): the reserve chain goes on the MAIN path, now that every connection of this workflow is made
        # B-C2 (2026-10-15, build section 84): and so does the free token counter behind every Claude agent — only in a workflow that
        # HAS a ledger row, because a measurement with nowhere to settle is a number nobody reads.
        if self.name in LEDGER_WIRING:
            AI_CALLS[self.name] = self.count_chain()
            _declared = list(LEDGER_WIRING[self.name]['settle_from'])   # R115: the report ends run_ledger() was given, before the loose ends join
            ledger_mainline({'id': self.wid, 'name': self.name, 'nodes': self.N, 'connections': self.C}, LEDGER_WIRING[self.name])
            self.bake_calls()   # after ledger_mainline: it is what fills in __AI_NODES__, and the two lists are asserted equal
            # R115 (2026-10-16, re-rating D-19): the callback is posted AFTER the settle and carries the settled run_ledger — it used to
            # leave 1.1 s before the settle (exec 623) with the report's DataForSEO-only cost_usd as its only figure
            for _tag in getattr(self, 'deliveries', []):
                monitor_cost.callback_after_settle({'id': self.wid, 'name': self.name, 'nodes': self.N, 'connections': self.C},
                                                   LEDGER_WIRING[self.name], 'Has Callback (' + _tag + ')?', 'POST ' + _tag + ' Report', V5, _declared)
        # F-L (2026-10-18): the "ran late" notice where a workflow has no Callback Ledger (the Audit Scheduler hands it to its audits)
        _rl = monitor_cost.bake_ran_late({'id': self.wid, 'name': self.name, 'nodes': self.N, 'connections': self.C}, V5) \
            if any(monitor_cost.RAN_LATE_MARK in str((n.get('parameters') or {}).get('jsCode') or '') for n in self.N) else []
        assert sorted(_rl) == sorted({'SEO Agent — Audit Scheduler': ['Audits To Start']}.get(self.name, [])), 'F-L: ' + self.name + ' baked the ran-late notice into ' + str(_rl)
        names = {n['name'] for n in self.N}; assert len(names) == len(self.N), 'duplicate node names in ' + fname
        for s, outs in self.C.items():
            assert s in names, s
            for lists in outs.values():
                for lst in lists:
                    for t in lst: assert t['node'] in names, t['node']
        for n in self.N:   # every DataForSEO node and model node carries its credential
            if n['type'] == 'n8n-nodes-base.httpRequest' and n['parameters'].get('authentication') == 'genericCredentialType': assert n.get('credentials'), n['name']
            if n['type'] == '@n8n/n8n-nodes-langchain.lmChatAnthropic': assert n.get('credentials'), n['name']
            if n['type'] == 'n8n-nodes-base.httpRequest' and n['parameters'].get('authentication') == 'predefinedCredentialType': assert n.get('credentials'), n['name']
        w = {'id': self.wid, 'name': self.name, 'active': False, 'settings': {'executionOrder': 'v1', 'errorWorkflow': 'SEOagentErrHandl', 'executionTimeout': self.timeout, 'saveDataErrorExecution': 'all', 'saveDataSuccessExecution': 'all'}, 'tags': [], 'nodes': self.N, 'connections': self.C}
        url_lint.check(w, self.name)   # D15: no node builds a site URL by hand (url_lint.py)
        retry_lint.check(w, self.name)   # G1: every external HTTP node carries the retry rule (retry_lint.py)
        retry_lint.check_in200(w, self.name)   # B-A10: and the in-200 gate on top, because a 200 can still be a failure
        json.dump([w], open(os.path.join(OUT, fname), 'w'), indent=2, ensure_ascii=False)
        os.makedirs(CODE, exist_ok=True)
        for n in self.N:
            if n['type'] == 'n8n-nodes-base.code': open(os.path.join(CODE, self.code_prefix + re.sub(r'[^A-Za-z0-9_.-]+', '_', n['name']) + '.js'), 'w').write(n['parameters']['jsCode'])
            if n['type'] == '@n8n/n8n-nodes-langchain.agent': open(os.path.join(CODE, self.code_prefix + re.sub(r'[^A-Za-z0-9_.-]+', '_', n['name']) + '.prompt.txt'), 'w').write(n['parameters']['text'])   # the harness checks what a prompt always carries (S33, D14)
        print('wrote', fname + ':', len(self.N), 'nodes')
at = lambda c, r: [c * 220, r * 220]
# 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §4.8, owner decision D2): the seven weekly workflows and the Audit Scheduler lost their Schedule
# Trigger. A website's week starts on the day it set up and repeats every 7 days at 06:00 in its own time zone; the Cycle Dispatcher starts
# each job of a cycle through the workflow's own *Manual Run* with the cycle payload (plan §14.2). Build section 98 fails the build if one of
# them gets a Schedule Trigger back. Only the AI Pulse (daily) and the Page Watch (daily) keep a cron.
CYCLE_ENTRY = "`{ trigger: 'cycle', domain, site_id, cycle_key, job, monthly, scheduled_for, request_id }`"

# =============================================================================
# 1. AI VISIBILITY TRACKER (v4.5; v4.9: bigger panel with stages / clusters / demand, daily pulse samples, Answer Analyst, GA4 revenue, crawler access, market-wide index)
# =============================================================================
A = WF('SEOagentAIVisib1', 'SEO Agent — AI Visibility Tracker', 'aivis', 3600)
A.node('Manual Run', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, {'inputSource': 'passthrough'}, at(0, 1))
ens = [('Ensure Monitors Table', MONITORS_TABLE, MONITORS_COLS), ('Ensure AI Prompts Table', AI_PROMPTS_TABLE, AI_PROMPTS_COLS), ('Ensure AI Answers Table', AI_ANSWERS_TABLE, AI_ANSWERS_COLS), ('Ensure AI Visibility Table', AI_VIS_TABLE, AI_VIS_COLS),
       ('Ensure Prospects Table', PROSPECT_TABLE, PROSPECT_COLS), ('Ensure Sites Table', SITES_TABLE, SITES_COLS), ('Ensure Profiles Table', PROFILE_TABLE, PROFILE_COLS), ('Ensure AI Daily Table', AI_DAILY_TABLE, AI_DAILY_COLS), ('Ensure Cache Table', CACHE_TABLE, CACHE_COLS)]
for i, (nm, t, c) in enumerate(ens): A.ensure(nm, t, c, at(1 + i, 0))
loads = [('Load Sites', SITES_TABLE), ('Load Ladders', LADDER_TABLE), ('Load Monitors', MONITORS_TABLE), ('Load Profiles', PROFILE_TABLE), ('Load AI Prompts', AI_PROMPTS_TABLE), ('Load AI Visibility', AI_VIS_TABLE), ('Load Link Prospects', PROSPECT_TABLE)]
from ladder_common import OPS_ALERTS_TABLE, OPS_ALERTS_COLS   # F2 (2026-10-23): a stopped split run's ops alerts
SINCE = lambda days: '={{ new Date(Date.now() - ' + str(days) + ' * 864e5).toISOString() }}'
# F2 (2026-10-23, ENGINE_AUDIT.md E12): every execution used to load the answers of EVERY site for 6.2 days and the whole prompt / visibility
# / prospect / page tables — memory and stored execution data growing with customers x panel on a 4 GB VM. A start names its website (a cycle
# job, an on-demand check, the next part of a split run, a resume), so every read of a per-site AI table is filtered by it SERVER-side
# (`site_id like <site_id>`: n8n's Data Table "contains", `_` escaped; a start that names no website reads `%`, every site, as before) and the
# run's answers by the run too (`run_id like <continue_run>`). Date windows cap what a site's history can bring: 60 days of weekly rows,
# 15 of pulse days, 35 of Search Console queries, 6.2 of run answers. AI Plan still filters exactly in code (a `like` can match a longer id).
SITE_SCOPE = ("={{ ((t) => String(t.site_id || '').trim() || (String(t.domain || '').trim() ? 'site_' + String(t.domain).toLowerCase().trim()"
              ".replace(/^https?:\\/\\//, '').replace(/^www\\./, '').replace(/[\\/?#].*$/, '').replace(/[^a-z0-9]+/g, '-') : '%'))"
              "(Object.assign({}, $('Manual Run').first().json || {}, ($('Manual Run').first().json || {}).body || {})) }}")
RUN_SCOPE = "={{ String(($('Manual Run').first().json || {}).continue_run || '').trim() || '%' }}"
SCOPED = {'Load AI Prompts': [], 'Load AI Visibility': [('checked_at', 'gte', SINCE(60))], 'Load Link Prospects': []}
for i, (nm, t) in enumerate(loads):
    if nm in SCOPED: A.node(nm, DT_TYPE, DT_VERSION, dt_get_all_where_params(t, [('site_id', 'like', SITE_SCOPE)] + SCOPED[nm]), at(1 + i, 1), **LOAD)
    else: A.load(nm, t, at(1 + i, 1))
A.node('Load AI Daily', DT_TYPE, DT_VERSION, dt_get_all_where_params(AI_DAILY_TABLE, [('site_id', 'like', SITE_SCOPE), ('checked_at', 'gte', SINCE(15))]), at(8, 1), **LOAD)
A.node('Load Cache (AI)', DT_TYPE, DT_VERSION, dt_get_all_where_params(CACHE_TABLE, [('kind', 'eq', 'ai'), ('site_id', 'like', SITE_SCOPE)]), at(9, 1), **LOAD)
A.node('Load Query History', DT_TYPE, DT_VERSION, dt_get_all_where_params(QUERY_TABLE, [('site_id', 'like', SITE_SCOPE), ('checked_at', 'gte', SINCE(35))]), at(10, 1), **LOAD)
# G6 (2026-10-18): the answers earlier executions of an unfinished split run stored (a run is resumed for at most 6 days; the pulse's rows are
# not this run's). AI Plan reads which questions x engines are answered, AI Metrics measures the whole run over them in its last execution.
A.node('Load AI Run Answers', DT_TYPE, DT_VERSION, dt_get_all_where_params(AI_ANSWERS_TABLE, [('site_id', 'like', SITE_SCOPE), ('run_id', 'like', RUN_SCOPE), ('run_kind', 'neq', 'pulse'), ('checked_at', 'gte', SINCE(6.2))]), at(10, 2), **LOAD)
loads += [('Load AI Daily', None), ('Load Cache (AI)', None), ('Load Query History', None), ('Load AI Run Answers', None)]
# RV-1 (2026-10-21): the page inventory with what each address answered (seo_pages.http_status, written by the Site Tracker), so the report never
# lists a page that answers 404 as "your cited page" and the brief never builds on one
from ladder_common import PAGES_TABLE as _PAGES_TABLE_RV1
A.node('Load Pages (AI)', DT_TYPE, DT_VERSION, dt_get_all_where_params(_PAGES_TABLE_RV1, [('site_id', 'like', SITE_SCOPE)]), at(11, 2), **LOAD); loads += [('Load Pages (AI)', None)]   # F2 (E12)
A.code('AI Plan', 'AI_Plan.js', at(11, 1)); A.iff('Any Sites (AI)?', '{{ !$json.nothing_to_do }}', at(12, 1)); A.node('Nothing To Do (AI)', 'n8n-nodes-base.noOp', 1, {}, at(13, 2))
A.code('Site Text Jobs', 'Site_Text_Jobs.js', at(13, -2)); A.iff('Need Site Text?', '{{ !$json.skip }}', at(14, -2))
A.node('Read Site (AI)', 'n8n-nodes-base.httpRequest', 4.5, {'url': '=https://r.jina.ai/https://{{ $json.domain }}', 'authentication': 'genericCredentialType', 'genericAuthType': 'httpHeaderAuth', 'sendHeaders': True, 'headerParameters': {'parameters': [{'name': 'X-Retain-Images', 'value': 'none'}]}, 'options': {'response': {'response': {'responseFormat': 'text', 'outputPropertyName': 'site_text'}}, 'timeout': 30000}}, at(15, -3), credentials={'httpHeaderAuth': {'id': 'SEOcredJinaReade', 'name': 'Jina Reader'}}, onError='continueRegularOutput', **retry_lint.RETRY)
A.code('Discovery Requests', 'Discovery_Requests.js', at(16, -2)); A.iff('Any Discovery?', '{{ !$json.skip }}', at(17, -2)); A.dfs_http('Run Discovery', at(18, -3), batch=4, interval=300, timeout=120000)
A.code('Prompt Jobs', 'Prompt_Jobs.js', at(19, -2)); A.iff('Any Prompt Jobs?', '{{ !$json.skip }}', at(20, -2))
A.agent('Prompt Writer', 'ai_prompts.txt', {'type': 'object', 'properties': {'prompts': {'type': 'array', 'items': {'type': 'object', 'properties': {'prompt': {'type': 'string'}, 'kind': {'type': 'string'}, 'stage': {'type': 'string'}, 'cluster': {'type': 'string'}, 'keyword': {'type': 'string'}, 'origin': {'type': 'string'}, 'persona': {'type': 'string'}}, 'required': ['prompt']}}}, 'required': ['prompts']}, at(21, -3))   # G6: + persona (one job per market x buyer role)
A.code('Prompt Rows', 'Prompt_Rows.js', at(22, -2)); A.iff('Any Prompt Rows?', '{{ !$json.skip }}', at(23, -2))
A.node('Save Prompts', DT_TYPE, DT_VERSION, dt_upsert_params_keys(AI_PROMPTS_TABLE, AI_PROMPTS_COLS, ['site_id', 'prompt_id']),   # F2 (E15): unique per site
 at(24, -3), onError='continueRegularOutput')
A.code('Traffic Requests', 'Traffic_Requests.js', at(13, 0)); A.iff('Any GA4 (AI)?', '{{ !$json.skip }}', at(14, 0))
A.node('GA4 AI Report', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': '={{ $json.url }}', 'authentication': 'predefinedCredentialType', 'nodeCredentialType': 'googleApi', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify($json.body) }}',
    'options': {'batching': {'batch': {'batchSize': 1, 'batchInterval': 150}}, 'timeout': 60000, 'response': {'response': {'neverError': True}}}}, at(15, -1), credentials=GOOGLE, **HTTP_X)
A.code('Access Requests', 'Access_Requests.js', at(16, 0)); A.iff('Any Access?', '{{ !$json.skip }}', at(17, 0))
A.node('Fetch Access', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'GET', 'url': '={{ $json.url }}', 'sendHeaders': True, 'headerParameters': {'parameters': [{'name': 'User-Agent', 'value': '={{ $json.ua }}'}, {'name': 'Accept', 'value': 'text/html,text/plain,*/*'}]},
    'options': {'batching': {'batch': {'batchSize': 4, 'batchInterval': 200}}, 'timeout': 20000, 'redirect': {'redirect': {'followRedirects': True, 'maxRedirects': 5}}, 'response': {'response': {'fullResponse': True, 'neverError': True, 'responseFormat': 'text'}}}}, at(18, -1), onError='continueRegularOutput', **retry_lint.RETRY)
A.code('AI Access', 'AI_Access.js', at(19, 0))
A.code('AI Requests', 'AI_Requests.js', at(20, 0)); A.iff('Any AI Requests?', '{{ !$json.skip }}', at(21, 0))
A.dfs_http('Run AI Requests', at(22, -1), batch=10, interval=200, timeout=150000)
A.code('Parse AI Answers', 'Parse_AI_Answers.js', at(23, 0))
A.code('Analyst Jobs', 'Analyst_Jobs.js', at(24, 0)); A.iff('Any Analyst Jobs?', '{{ !$json.skip }}', at(25, 0))
A.agent('Answer Analyst', 'answer_analyst.txt', {'type': 'object', 'properties': {'answers': {'type': 'array', 'items': {'type': 'object', 'properties': {'n': {'type': 'number'}, 'brands': {'type': 'array', 'items': {'type': 'object', 'properties': {'name': {'type': 'string'}, 'domain': {'type': 'string'}, 'role': {'type': 'string'}}, 'required': ['name']}}, 'sentiment': {'type': 'string'}, 'why': {'type': 'string'}, 'wrong': {'type': 'array', 'items': {'type': 'object', 'properties': {'claim': {'type': 'string'}, 'correct': {'type': 'string'}}, 'required': ['claim']}}}, 'required': ['n']}}, 'descriptors': ARR}, 'required': ['answers']}, at(26, -1))
A.code('Apply Analysis', 'Apply_Analysis.js', at(27, 0)); A.iff('Any Answer Rows?', '{{ !$json.skip }}', at(28, 0))
# F2 (2026-10-23, ENGINE_AUDIT.md E11): the answers are stored the moment they are parsed, BEFORE the Answer Analyst; the analyst's reading is
# written back over the rows it changed (Update AI Answers, upsert on run_id + prompt_id + engine). A part that dies in the analyst keeps them.
A.code('AI Answer Rows', 'AI_Answer_Rows.js', at(23, 1)); A.iff('Any Raw Answers?', '{{ !$json.skip }}', at(23, 2))
A.node('Save AI Answers', DT_TYPE, DT_VERSION, dt_insert_params(AI_ANSWERS_TABLE, AI_ANSWERS_COLS), at(24, 2), onError='continueRegularOutput')
A.code('AI Analysed Rows', 'AI_Analysed_Rows.js', at(28, 1))
A.node('Update AI Answers', DT_TYPE, DT_VERSION, dt_upsert_params_keys(AI_ANSWERS_TABLE, AI_ANSWERS_COLS, ['run_id', 'prompt_id', 'engine']), at(29, -1), onError='continueRegularOutput')
# F2 (2026-10-23, ENGINE_AUDIT.md E1): nothing is paid before the run's state row records the keys this part is about to send (and is read back)
A.code('AI Asking State', 'AI_Asking_State.js', at(21, 1)); A.iff('Any Asking State?', '{{ !$json.skip }}', at(21, 2))
A.node('Save Asking State', DT_TYPE, DT_VERSION, dt_upsert_params(CACHE_TABLE, CACHE_COLS, 'key'), at(21, 3), onError='continueRegularOutput', alwaysOutputData=True)
A.code('AI Requests Go', 'AI_Requests_Go.js', at(22, 2)); A.iff('Go AI Requests?', '{{ !$json.skip }}', at(22, 3))
# F2 (E1): a stopped run's ops alerts, recorded before anything is sent (the run's own alert sweep delivers them), and the callers told now (E17)
A.code('Run Alert Rows', 'AI_Run_Alert_Rows.js', at(33, 1)); A.iff('Any Run Alerts?', '{{ !$json.skip }}', at(33, 2))
A.node('Save Run Alert', DT_TYPE, DT_VERSION, dt_upsert_params(OPS_ALERTS_TABLE, OPS_ALERTS_COLS, 'alert_key'), at(33, 3), onError='continueRegularOutput', alwaysOutputData=True)
_notice_post = lambda nm, pos: A.node(nm, 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': '={{ $json.callback_url }}', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify($json.body) }}', 'options': {'timeout': 30000}}, pos, onError='continueRegularOutput', retryOnFail=True, maxTries=3, waitBetweenTries=5000)
for _nm, _src_node, _pos in [('Stop Notices (AI)', 'AI Chunk Handoff', at(34, 1)), ('Open Run Notices (AI)', 'AI Plan', at(12, -1)), ('Busy Notices (AI)', 'AI Plan', at(12, 3))]:
    A.code(_nm, src('AI_Run_Notices.js').replace('__NOTICE_SRC__', _src_node), _pos)
    A.iff('Tell ' + _nm[:-5] + '?', '{{ !$json.skip }}', [_pos[0] + 110, _pos[1]])
    _notice_post('Post ' + _nm[:-5], [_pos[0] + 220, _pos[1]])
# G6 (2026-10-18): the hand-off between the executions of a split weekly run — the run's state row, and the start of the next execution
A.code('AI Chunk Handoff', 'AI_Chunk_Handoff.js', at(30, 0))
A.code('Run State Rows', "// G6: the split runs' state rows for seo_cache (upsert by key; exact columns).\nconst rows = $('AI Chunk Handoff').all().map(i => (i.json || {}).state_row).filter(Boolean);\nreturn rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];", at(31, 0))
A.iff('Any Run State?', '{{ !$json.skip }}', at(32, 0))
A.node('Save Run State', DT_TYPE, DT_VERSION, dt_upsert_params(CACHE_TABLE, CACHE_COLS, 'key'), at(33, -1), onError='continueRegularOutput')
A.code('Next Chunk Starts', "// G6: one start item per site whose run continues (Manual Run reads domain / site_id + continue_run; parent_run_id keeps the run guard from\n// taking this execution's open ledger row for a twin). The state row is saved first, so the next execution finds what is answered.\nconst out = $('AI Chunk Handoff').all().map(i => (i.json || {}).next).filter(Boolean);\nreturn out.length ? out.map(j => ({ json: j })) : [{ json: { skip: true } }];", at(34, 0))
A.iff('Any Next Chunk?', '{{ !$json.skip }}', at(35, 0))
A.node('Start Next Chunk', 'n8n-nodes-base.executeWorkflow', 1.2, {'source': 'database', 'workflowId': {'__rl': True, 'mode': 'id', 'value': 'SEOagentAIVisib1'}, 'mode': 'each', 'options': {'waitForSubWorkflow': False}}, at(36, -1), onError='continueRegularOutput')
A.code('AI Metrics', 'AI_Metrics.js', at(10, 3)); A.iff('Any Final Sites?', '{{ !$json.skip }}', at(10, 4)); A.code('AI Vis Rows', 'AI_Vis_Rows.js', at(11, 3))
A.code('Chunk Part Done', "// G6: every site of this execution continues its split run in another execution — nothing to measure, report or deliver here.\nreturn [{ json: { done: true, part: true, note: ($('AI Metrics').first().json || {}).reason || '' } }];", at(11, 5))
A.node('Save AI Visibility', DT_TYPE, DT_VERSION, dt_insert_params(AI_VIS_TABLE, AI_VIS_COLS), at(12, 3), onError='continueRegularOutput')
A.code('AI Prospect Rows', 'AI_Prospect_Rows.js', at(13, 3)); A.iff('Any AI Prospects?', '{{ !$json.skip }}', at(14, 3))
A.node('Save AI Prospects', DT_TYPE, DT_VERSION, dt_upsert_params_keys(PROSPECT_TABLE, PROSPECT_COLS, ['site_id', 'prospect_domain', 'type']), at(15, 2), onError='continueRegularOutput')
A.code('AI Cache Rows', 'AI_Cache_Rows.js', at(16, 3)); A.iff('Any Cache Rows?', '{{ !$json.skip }}', at(17, 3))
A.node('Save AI Cache', DT_TYPE, DT_VERSION, dt_upsert_params(CACHE_TABLE, CACHE_COLS, 'key'), at(18, 2), onError='continueRegularOutput')
# G6 (2026-10-18): kept 120 days (was 400). A 500-question panel stores ~3,000 answer rows (~6.9 MB) a week and n8n holds ALL its Data Tables
# in 200 MB by default (N8N_DATA_TABLES_MAX_SIZE_BYTES); the weekly figures, segments and panel of every run stay in seo_ai_visibility for good.
A.node('Prune Old Answers', DT_TYPE, DT_VERSION, dt_delete_where_params(AI_ANSWERS_TABLE, [('checked_at', 'lt', SINCE(120))]), at(19, 3), onError='continueRegularOutput', alwaysOutputData=True, executeOnce=True)
A.code('AI Brief Input', 'AI_Brief_Input.js', at(20, 3))
A.agent('AI Brief', 'ai_brief.txt', {'type': 'object', 'properties': {'headline': {'type': 'string'}, 'summary': {'type': 'string'}, 'actions': {'type': 'array', 'items': {'type': 'object', 'properties': {'priority': {'type': 'number'}, 'action': {'type': 'string'}, 'why': {'type': 'string'}}, 'required': ['action']}}, 'watch': ARR}, 'required': ['headline', 'summary', 'actions']}, at(21, 3))
A.code('AI Report', 'AI_Report.js', at(22, 3)); A.pdf_chain('AI', at(23, 3))
A.code('Build AI Callback', 'Build_AI_Callback.js', at(26, 4)); A.deliver('AI', at(26, 3), "={{ $binary.pdf ? 'pdf' : 'data' }}")
A.chain(*[e[0] for e in ens], *[l[0] for l in loads], 'AI Plan', 'Any Sites (AI)?'); A.link('Manual Run', ens[0][0])
A.link('Any Sites (AI)?', 'Open Run Notices (AI)', 0); A.chain('Open Run Notices (AI)', 'Tell Open Run Notices?'); A.link('Tell Open Run Notices?', 'Post Open Run Notices', 0); A.link('Tell Open Run Notices?', 'Site Text Jobs', 1); A.link('Post Open Run Notices', 'Site Text Jobs')   # F2 (E17)
A.chain('Site Text Jobs', 'Need Site Text?'); A.link('Need Site Text?', 'Read Site (AI)', 0); A.link('Need Site Text?', 'Discovery Requests', 1); A.link('Read Site (AI)', 'Discovery Requests'); A.link('Any Sites (AI)?', 'Busy Notices (AI)', 1)
A.chain('Busy Notices (AI)', 'Tell Busy Notices?'); A.link('Tell Busy Notices?', 'Post Busy Notices', 0); A.link('Tell Busy Notices?', 'Nothing To Do (AI)', 1); A.link('Post Busy Notices', 'Nothing To Do (AI)')   # F2 (E17)
A.chain('Discovery Requests', 'Any Discovery?'); A.link('Any Discovery?', 'Run Discovery', 0); A.link('Any Discovery?', 'Prompt Jobs', 1); A.link('Run Discovery', 'Prompt Jobs')
A.chain('Prompt Jobs', 'Any Prompt Jobs?'); A.link('Any Prompt Jobs?', 'Prompt Writer', 0); A.link('Any Prompt Jobs?', 'Prompt Rows', 1); A.link('Prompt Writer', 'Prompt Rows')
A.chain('Prompt Rows', 'Any Prompt Rows?'); A.link('Any Prompt Rows?', 'Save Prompts', 0); A.link('Any Prompt Rows?', 'Traffic Requests', 1); A.link('Save Prompts', 'Traffic Requests')
A.chain('Traffic Requests', 'Any GA4 (AI)?'); A.link('Any GA4 (AI)?', 'GA4 AI Report', 0); A.link('Any GA4 (AI)?', 'Access Requests', 1); A.link('GA4 AI Report', 'Access Requests')
A.chain('Access Requests', 'Any Access?'); A.link('Any Access?', 'Fetch Access', 0); A.link('Any Access?', 'AI Access', 1); A.link('Fetch Access', 'AI Access')
A.chain('AI Access', 'AI Requests', 'Any AI Requests?'); A.link('Any AI Requests?', 'AI Asking State', 0); A.link('Any AI Requests?', 'Parse AI Answers', 1)
# F2 (E1): record -> save -> read back -> pay
A.chain('AI Asking State', 'Any Asking State?'); A.link('Any Asking State?', 'Save Asking State', 0); A.link('Any Asking State?', 'AI Requests Go', 1); A.link('Save Asking State', 'AI Requests Go')
A.chain('AI Requests Go', 'Go AI Requests?'); A.link('Go AI Requests?', 'Run AI Requests', 0); A.link('Go AI Requests?', 'AI Chunk Handoff', 1)
A.ai_retry_gate(at(22, 1), 'Parse AI Answers')   # D19: task errors inside an HTTP 200 are re-sent once, then merged back in order
# F2 (E11): Parse -> store -> analyse -> write back what the analyst changed -> hand off
A.chain('Parse AI Answers', 'AI Answer Rows', 'Any Raw Answers?'); A.link('Any Raw Answers?', 'Save AI Answers', 0); A.link('Any Raw Answers?', 'Analyst Jobs', 1); A.link('Save AI Answers', 'Analyst Jobs')
A.chain('Analyst Jobs', 'Any Analyst Jobs?'); A.link('Any Analyst Jobs?', 'Answer Analyst', 0); A.link('Any Analyst Jobs?', 'Apply Analysis', 1); A.link('Answer Analyst', 'Apply Analysis')
A.chain('Apply Analysis', 'AI Analysed Rows', 'Any Answer Rows?'); A.link('Any Answer Rows?', 'Update AI Answers', 0); A.link('Any Answer Rows?', 'AI Chunk Handoff', 1); A.link('Update AI Answers', 'AI Chunk Handoff')
A.chain('AI Chunk Handoff', 'Run State Rows', 'Any Run State?'); A.link('Any Run State?', 'Save Run State', 0); A.link('Any Run State?', 'Run Alert Rows', 1); A.link('Save Run State', 'Run Alert Rows')
A.chain('Run Alert Rows', 'Any Run Alerts?'); A.link('Any Run Alerts?', 'Save Run Alert', 0); A.link('Any Run Alerts?', 'Stop Notices (AI)', 1); A.link('Save Run Alert', 'Stop Notices (AI)')
A.chain('Stop Notices (AI)', 'Tell Stop Notices?'); A.link('Tell Stop Notices?', 'Post Stop Notices', 0); A.link('Tell Stop Notices?', 'Next Chunk Starts', 1); A.link('Post Stop Notices', 'Next Chunk Starts')
A.chain('Next Chunk Starts', 'Any Next Chunk?'); A.link('Any Next Chunk?', 'Start Next Chunk', 0); A.link('Any Next Chunk?', 'AI Metrics', 1); A.link('Start Next Chunk', 'AI Metrics')
A.chain('AI Metrics', 'Any Final Sites?'); A.link('Any Final Sites?', 'AI Vis Rows', 0); A.link('Any Final Sites?', 'Chunk Part Done', 1)
A.chain('AI Vis Rows', 'Save AI Visibility', 'AI Prospect Rows', 'Any AI Prospects?'); A.link('Any AI Prospects?', 'Save AI Prospects', 0); A.link('Any AI Prospects?', 'AI Cache Rows', 1); A.link('Save AI Prospects', 'AI Cache Rows')
A.chain('AI Cache Rows', 'Any Cache Rows?'); A.link('Any Cache Rows?', 'Save AI Cache', 0); A.link('Any Cache Rows?', 'Prune Old Answers', 1); A.link('Save AI Cache', 'Prune Old Answers')
A.chain('Prune Old Answers', 'AI Brief Input', 'AI Brief', 'AI Report', 'Prepare PDF AI', 'Render PDF AI', 'Attach PDF AI', 'Has Email (AI)?'); A.link('Attach PDF AI', 'Build AI Callback'); A.link('Build AI Callback', 'Has Callback (AI)?')
A.run_ledger('ai_visibility', 'AI', 'AI Plan', ['AI Report', 'Chunk Part Done'], at(12, 7), measured='AI Metrics|AI Chunk Handoff')   # G6: a part of a split run ends at Chunk Part Done and states its money in the hand-off
# B-A10 (2026-10-15, INVARIANTS rule 3): the monthly question-discovery pull is the one paid call outside the AI gate D19 built.
# Its failure is silent by construction — *Prompt Jobs* simply finds no new questions — so a 40101 inside a 200 shrinks next
# month's panel with nobody told, and a smaller panel is exactly what B-L4 had to stop being read as a fall in visibility.
A.in200_gate('Run Discovery', 'the questions buyers ask AI assistants about this topic', 'question')
A.sticky(f"""## SEO Agent — AI Visibility Tracker (v4.5, v4.9)
**Once a week in each website's own cycle** (job 1 of the cycle, before the Site Tracker, whose report shows the summary; *Manual Run* {CYCLE_ENTRY}; the monthly full run only when the dispatcher passes `monthly: true`) and on demand (*Manual Run* `{{ domain | site_id, email?, callback_url?, country?, location_code?, competitors?, topics? }}`; form option "Check my AI visibility" / API `mode: ai_visibility`). The **AI Pulse** workflow asks the same panel every other day on the fast engines; this run adds its samples to the week's figures.
Per site (`seo_sites` + ladder domains; settings in `{MONITORS_TABLE}`: engines, questions (3-50, default 20), daily pulse, competitors, brand names): a stable **question panel** (`{AI_PROMPTS_TABLE}`: buyer stage, topic cluster, monthly AI search volume; written by Claude from the topics, **real questions from the AI-answer database** and the site's long Search Console queries; custom ones through Site Admin `ai_prompts`) is asked to **ChatGPT** and **Gemini** (the real chat interfaces, LLM scraper $0.004), **Perplexity** (sonar, localised, $0.006), **Google AI Mode** ($0.004) and the **AI Overview** of the matching search ($0.002); **Claude** (Haiku + web search, $0.025), the brand question, question discovery and the **market-wide index** (LLM Mentions: your share vs the competitors across the 387M-question database) on the month's first run.
*Answer Analyst* (Claude) reads the answers that matter: brands named in order (a competitor without a website counts; learned names in `{CACHE_TABLE}` `ai_brands:`), sentiment, **wrong claims** vs the business profile. *AI Metrics*: 7-day rates with **95% ranges** (weekly + pulse samples), changes tested for significance, **visibility score** (position + demand weighted), share of voice, stages / topics, fan-out searches, perception, **AI referral visits / key events / revenue** (GA4, service account), **AI crawler access** (robots.txt per bot, llms.txt, CDN block test), lost questions with demand and ready API bodies, alerts, actions → `{AI_VIS_TABLE}` (+ `ai_source` prospects) → Claude brief → report (e-mail + PDF + callback `stage: ai_visibility`). Answers older than 400 days are pruned.""", [-40, -1000], 1500, 460)
# F1a (2026-10-23, E10): the Prompt Writer names no company (comparisons included), and Prompt Rows refuses a question that does (harness F1A-E10)
assert 'no company or product names at all' in rd('prompts/ai_prompts.txt') and 'AIE.vendorIn(q.prompt' in rd('code/Prompt_Rows.js'), 'F1a E10: the panel gate against vendor-naming questions is gone'
A.write('SEO_Agent_AI_Visibility.json')
# F2 (2026-10-23): the tracker's wiring and its Data Table filters, for harness scenarios_f2.js (F2-6: answers stored before the analyst, the record
# before paying, every AI-table read scoped to the site). Proves the GENERATED wiring, read back from the file just written.
_f2wf = json.load(open(os.path.join(OUT, 'SEO_Agent_AI_Visibility.json'))); _f2wf = _f2wf[0] if isinstance(_f2wf, list) else _f2wf
json.dump({'connections': _f2wf['connections'], 'filters': {n['name']: (n.get('parameters') or {}).get('filters') for n in _f2wf['nodes'] if n.get('type') == DT_TYPE}},
          open(os.path.join(HERE, 'harness', 'ai_vis_wiring.json'), 'w'), indent=1, sort_keys=True)

# =============================================================================
# 1b. AI PULSE (v4.9): the question panel on the fast engines every day except each website's own cycle day (2026-10-19; was: except Monday)
# =============================================================================
Q = WF('SEOagentAIPulse1', 'SEO Agent — AI Pulse', 'aipulse', 2400, code_prefix='Pulse__')
# 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §4.8): every day 06:30 (was 0,2-6: Monday was everyone's weekly run). Pulse Plan skips each website on
# ITS cycle day (its local weekday == seo_cycles.cycle_weekday in seo_cycles.tz; Monday when it has no cycle row), when its weekly run asks the same engines.
Q.node('Daily Schedule', 'n8n-nodes-base.scheduleTrigger', 1.2, {'rule': {'interval': [{'field': 'cronExpression', 'expression': '30 6 * * *'}]}}, at(0, 0))
Q.node('Manual Run', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, {'inputSource': 'passthrough'}, at(0, 1))
ens = [('Ensure Monitors Table', MONITORS_TABLE, MONITORS_COLS), ('Ensure AI Answers Table', AI_ANSWERS_TABLE, AI_ANSWERS_COLS), ('Ensure AI Daily Table', AI_DAILY_TABLE, AI_DAILY_COLS), ('Ensure Cache Table', CACHE_TABLE, CACHE_COLS)]
for i, (nm, t, c) in enumerate(ens): Q.ensure(nm, t, c, at(1 + i, 0))
loads = [('Load Sites', SITES_TABLE), ('Load Ladders', LADDER_TABLE), ('Load Monitors', MONITORS_TABLE), ('Load Profiles', PROFILE_TABLE), ('Load AI Prompts', AI_PROMPTS_TABLE), ('Load AI Visibility', AI_VIS_TABLE)]
for i, (nm, t) in enumerate(loads): Q.load(nm, t, at(1 + i, 1))
Q.node('Load AI Daily', DT_TYPE, DT_VERSION, dt_get_all_where_params(AI_DAILY_TABLE, [('checked_at', 'gte', SINCE(15))]), at(7, 1), **LOAD)
Q.node('Load Cache (AI)', DT_TYPE, DT_VERSION, dt_get_where_params(CACHE_TABLE, 'kind', 'eq', 'ai'), at(8, 1), **LOAD)
Q.load('Load Cycles', CYCLES_TABLE, at(8, 2))   # 2026-10-19: each website's cycle weekday and time zone (seo_cycles) - its own cycle day is skipped
# G6 (2026-10-18): the daily safety net for a split weekly AI visibility run whose chain of executions broke — started again from where it stopped
Q.code('AI Run Resume', 'AI_Run_Resume.js', at(9, 3)); Q.iff('Any Run To Resume?', '{{ !$json.skip }}', at(10, 3))
Q.node('Resume AI Run', 'n8n-nodes-base.executeWorkflow', 1.2, {'source': 'database', 'workflowId': {'__rl': True, 'mode': 'id', 'value': 'SEOagentAIVisib1'}, 'mode': 'each', 'options': {'waitForSubWorkflow': False}}, at(11, 3), onError='continueRegularOutput')
# (after the pulse's own ledger row: a start of another run is spending, and section 55 proves nothing spends before the reservation)
Q.code('AI Plan', 'Pulse_Plan.js', at(9, 1)); Q.iff('Any Sites (Pulse)?', "{{ !$('AI Plan').first().json.nothing_to_do }}", at(10, 1)); Q.node('Nothing To Do (Pulse)', 'n8n-nodes-base.noOp', 1, {}, at(11, 2))
Q.code('AI Requests', 'AI_Requests.js', at(11, 0)); Q.iff('Any AI Requests?', '{{ !$json.skip }}', at(12, 0))
Q.dfs_http('Run AI Requests', at(13, -1), batch=10, interval=200, timeout=150000)
Q.code('Parse AI Answers', 'Parse_AI_Answers.js', at(14, 0)); Q.code('Pulse Metrics', 'Pulse_Metrics.js', at(15, 0))
Q.code('Pulse Answer Rows', "// Today's answer rows for seo_ai_answers (run_kind pulse; exact columns, short excerpts; kept 35 days).\nconst rows = $('Pulse Metrics').all().flatMap(i => i.json.answer_rows || []);\nreturn rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];", at(16, 0))
Q.iff('Any Pulse Answers?', '{{ !$json.skip }}', at(17, 0))
Q.node('Save AI Answers', DT_TYPE, DT_VERSION, dt_insert_params(AI_ANSWERS_TABLE, AI_ANSWERS_COLS), at(18, -1), onError='continueRegularOutput')
Q.code('AI Daily Rows', "// One seo_ai_daily row per site and reading (exact columns). The weekly AI visibility run adds them to its figures.\n// R95 (2026-10-16, re-rating C-19): the upsert key was site + date, so a same-day ON-DEMAND pulse (exec 630, 19:42) replaced that day's SCHEDULED\n// reading (exec 593, 11:11) and the week counted the day once, with the later sample. An on-demand reading now gets its own run_id, so it is\n// stored beside the scheduled one (upsert by site + date + run_id); a scheduled re-run of the same day still replaces only the scheduled row.\nconst rows = $('Pulse Metrics').all().map(i => (i.json.daily_row ? { ...i.json.daily_row, run_id: i.json.on_demand ? String(i.json.daily_row.run_id || 'pulse') + '_on_demand_' + $execution.id : i.json.daily_row.run_id } : null)).filter(r => r && r.samples > 0);\nreturn rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];", at(19, 0))
Q.iff('Any Daily Rows?', '{{ !$json.skip }}', at(20, 0))
AI_DAILY_KEYS = ['site_id', 'date', 'run_id']   # R95: one row per site, day AND reading (scheduled: pulse_<day>_<site>; on demand: + the execution)
Q.node('Save AI Daily', DT_TYPE, DT_VERSION, dt_upsert_params_keys(AI_DAILY_TABLE, AI_DAILY_COLS, AI_DAILY_KEYS), at(21, -1), onError='continueRegularOutput')
# G6 (2026-10-18): kept 21 days (was 35) — a 500-question panel's daily sample stores up to ~900 rows a morning; the daily figures stay in seo_ai_daily
Q.node('Prune Pulse Answers', DT_TYPE, DT_VERSION, dt_delete_where_params(AI_ANSWERS_TABLE, [('run_kind', 'eq', 'pulse'), ('checked_at', 'lt', SINCE(21))]), at(22, 0), onError='continueRegularOutput', alwaysOutputData=True, executeOnce=True)
Q.code('Pulse Alerts', "// Sites with something to report (an alert, or an on-demand run): the e-mail and the callback (stage ai_pulse). Quiet days send nothing.\nconst out = $('Pulse Metrics').all().map(i => i.json).filter(m => (m.alerts || []).length || m.on_demand).map(m => { const { daily_row, answer_rows, ...rest } = m; return { json: rest }; });\nreturn out.length ? out : [{ json: { skip: true } }];", at(23, 0))
Q.iff('Any Pulse Alerts?', '{{ !$json.skip }}', at(24, 0)); Q.deliver('Pulse', at(25, -1), None)
# F-ENG (2026-10-20): every website gets its pulse - the websites one execution cannot hold (15, or one morning's request limit) are handed to the
# next part of the chain, started after this part's answers and daily rows are saved (one part at a time: the run guard keeps the pulse's
# mode-only twin rule, and `parent_run_id` keeps it from taking this execution's own reservation for a twin)
Q.code('Next Pulse Part', "// F-ENG (2026-10-20): the next part of this morning's pulse (Pulse Plan's `pulse_next`: the websites after the last one this part took),\n// started through the workflow's own Manual Run. None when every website was served.\nconst n = ($('AI Plan').first().json || {}).pulse_next;\nreturn n && n.pulse_part ? [{ json: n }] : [{ json: { skip: true } }];", at(23, 2))
Q.iff('Any Next Pulse Part?', '{{ !$json.skip }}', at(24, 2))
Q.node('Start Next Pulse Part', 'n8n-nodes-base.executeWorkflow', 1.2, {'source': 'database', 'workflowId': {'__rl': True, 'mode': 'id', 'value': 'SEOagentAIPulse1'}, 'mode': 'once', 'options': {'waitForSubWorkflow': False}}, at(25, 2), onError='continueRegularOutput')
Q.chain('Daily Schedule', *[e[0] for e in ens], *[l[0] for l in loads], 'Load AI Daily', 'Load Cache (AI)', 'Load Cycles', 'AI Plan', 'AI Run Resume', 'Any Run To Resume?'); Q.link('Manual Run', ens[0][0])
Q.link('Any Run To Resume?', 'Resume AI Run', 0); Q.link('Any Run To Resume?', 'Any Sites (Pulse)?', 1); Q.link('Resume AI Run', 'Any Sites (Pulse)?')
Q.link('Any Sites (Pulse)?', 'AI Requests', 0); Q.link('Any Sites (Pulse)?', 'Nothing To Do (Pulse)', 1)
Q.chain('AI Requests', 'Any AI Requests?'); Q.link('Any AI Requests?', 'Run AI Requests', 0); Q.link('Any AI Requests?', 'Parse AI Answers', 1)
Q.ai_retry_gate(at(13, 1), 'Parse AI Answers')   # D19: the pulse re-sends a failed task once too (its figures are the week's samples)
Q.chain('Parse AI Answers', 'Pulse Metrics', 'Pulse Answer Rows', 'Any Pulse Answers?'); Q.link('Any Pulse Answers?', 'Save AI Answers', 0); Q.link('Any Pulse Answers?', 'AI Daily Rows', 1); Q.link('Save AI Answers', 'AI Daily Rows')
Q.chain('AI Daily Rows', 'Any Daily Rows?'); Q.link('Any Daily Rows?', 'Save AI Daily', 0); Q.link('Any Daily Rows?', 'Prune Pulse Answers', 1); Q.link('Save AI Daily', 'Prune Pulse Answers')
Q.chain('Prune Pulse Answers', 'Next Pulse Part', 'Any Next Pulse Part?'); Q.link('Any Next Pulse Part?', 'Start Next Pulse Part', 0); Q.link('Any Next Pulse Part?', 'Pulse Alerts', 1); Q.link('Start Next Pulse Part', 'Pulse Alerts')
Q.chain('Pulse Alerts', 'Any Pulse Alerts?'); Q.link('Any Pulse Alerts?', 'Has Email (Pulse)?', 0); Q.link('Any Pulse Alerts?', 'Has Callback (Pulse)?', 0)
Q.run_ledger('ai_pulse', 'Pulse', 'AI Plan', ['Pulse Alerts'], at(10, 4), measured='Pulse Metrics')
LEDGER_WIRING[Q.name]['daily_upsert_keys'] = list(AI_DAILY_KEYS)   # R95: the harness (S117) replays the upsert with the keys the node uses
Q.sticky(f"""## SEO Agent — AI Pulse (v4.9)
**Every day 06:30** (cron `30 6 * * *`), each website skipped on **its own cycle day** (`seo_cycles`: its local weekday in its time zone; Monday for a website with no cycle row), when its weekly AI Visibility run asks the same engines; the rotation counts the six other mornings from that day; and on demand (*Manual Run* `{{ domain | site_id, email?, callback_url? }}`). Per site with AI visibility and `ai_pulse` on (`{MONITORS_TABLE}`; default on): the whole question panel (`{AI_PROMPTS_TABLE}`, no brand question) on **ChatGPT** and **Gemini** (the real chat interfaces) and **Google AI Mode** — $0.004 each, about $0.24 a day for 20 questions. AI answers change from one ask to the next; seven samples a week per question and engine give rates with a narrow 95% range and catch a real change within a day.
Shares *AI Requests* and *Parse AI Answers* with the weekly tracker (same node names). *Pulse Metrics* → one `{AI_DAILY_TABLE}` row per site and day (counts per engine / question / competitor / source; the weekly report adds them) + the answers (`{AI_ANSWERS_TABLE}`, run_kind pulse, kept 35 days). **Alerts only when something really changed** (z-test at 99% vs the past week, a business suddenly named in 30%+ of answers, a question where you were named first for 3 days and are now missing) → e-mail + callback `stage: ai_pulse`. Quiet days send nothing.""", [-40, -560], 1300, 330)
Q.write('SEO_Agent_AI_Pulse.json')

# =============================================================================
# 2. BACKLINK MONITOR
# =============================================================================
B = WF('SEOagentBacklnk1', 'SEO Agent — Backlink Monitor', 'blmon', 3600)
B.node('Manual Run', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, {'inputSource': 'passthrough'}, at(0, 1))
ens = [('Ensure Monitors Table', MONITORS_TABLE, MONITORS_COLS), ('Ensure Snapshots Table', BL_SNAP_TABLE, BL_SNAP_COLS), ('Ensure Prospects Table', PROSPECT_TABLE, PROSPECT_COLS), ('Ensure Sites Table', SITES_TABLE, SITES_COLS),
       ('Ensure Profiles Table', PROFILE_TABLE, PROFILE_COLS), ('Ensure Case Table', CASE_TABLE, CASE_COLS), ('Ensure Log Table', LOG_TABLE, LOG_COLS),
       ('Ensure Backlinks Table', LINKS_TABLE, LINKS_COLS), ('Ensure Link Imports Table', LINK_IMPORTS_TABLE, LINK_IMPORTS_COLS), ('Ensure Link Graph Table', LINK_GRAPH_TABLE, LINK_GRAPH_COLS)]
for i, (nm, t, c) in enumerate(ens): B.ensure(nm, t, c, at(1 + i, 0))
loads = [('Load Sites', SITES_TABLE), ('Load Ladders', LADDER_TABLE), ('Load Monitors', MONITORS_TABLE), ('Load Profiles', PROFILE_TABLE), ('Load Backlink Snapshots', BL_SNAP_TABLE), ('Load Link Prospects', PROSPECT_TABLE), ('Load Content Log', LOG_TABLE), ('Load Case Studies', CASE_TABLE),
         ('Load Backlinks', LINKS_TABLE), ('Load Link Imports', LINK_IMPORTS_TABLE), ('Load Link Graph', LINK_GRAPH_TABLE), ('Load AI Visibility (BL)', AI_VIS_TABLE)]   # C-2 (2026-10-17): the AI-named rivals
for i, (nm, t) in enumerate(loads): B.load(nm, t, at(1 + i, 1))
B.node('Load Cache (BL Rivals)', DT_TYPE, DT_VERSION, dt_get_where_params(CACHE_TABLE, 'kind', 'eq', 'ai'), at(12, 2), **LOAD)   # C-2: the Answer Analyst's learned names (ai_brands:)
B.code('BL Plan', 'BL_Plan.js', at(12, 1)); B.iff('Any Sites (BL)?', '{{ !$json.nothing_to_do }}', at(13, 1)); B.node('Nothing To Do (BL)', 'n8n-nodes-base.noOp', 1, {}, at(14, 2))
# DataForSEO (as before + v4.10 link details, anchors, most-linked pages, competitors' new links)
B.code('BL Requests', 'BL_Requests.js', at(14, 0)); B.dfs_http('Run BL Requests', at(15, 0), batch=4, interval=300, timeout=120000)
B.code('Gap Requests', 'Gap_Requests.js', at(16, 0)); B.iff('Any Gap?', '{{ !$json.skip }}', at(17, 0)); B.dfs_http('Run Gap Requests', at(18, -1), timeout=120000)
# v4.10 free sources (BACKLINKS_SPEC.md §3): Wikipedia, Hacker News, web search, GDELT news, Bing Webmaster Tools, GA4 referrals
BOT_UA = 'SEOAgentLinkMonitor/4.10 (' + BRAND + '; backlink monitor; mailto:' + OPS_EMAIL + ')'
BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
def get_http(name, pos, url='={{ $json.url }}', batch=1, interval=300, timeout=30000, headers=None, cred=None, text=False, out_prop=None, method='GET', body=None):
    params = {'method': method, 'url': url, 'options': {'batching': {'batch': {'batchSize': batch, 'batchInterval': interval}}, 'timeout': timeout, 'redirect': {'redirect': {'followRedirects': True, 'maxRedirects': 10}},
        'response': {'response': ({'fullResponse': True, 'neverError': True, 'responseFormat': 'text'} if text else {'neverError': True, **({'responseFormat': 'text', 'outputPropertyName': out_prop} if out_prop else {})})}}}
    if headers: params.update({'sendHeaders': True, 'headerParameters': {'parameters': [{'name': k, 'value': v} for k, v in headers.items()]}})
    if body: params.update({'sendBody': True, 'specifyBody': 'json', 'jsonBody': body})
    extra = {}
    if cred: kind, cid, cname = cred; params.update({'authentication': 'genericCredentialType', 'genericAuthType': kind}); extra['credentials'] = {kind: {'id': cid, 'name': cname}}
    return B.node(name, 'n8n-nodes-base.httpRequest', 4.5, params, pos, onError='continueRegularOutput', **retry_lint.RETRY, **extra)   # G1: the one retry rule
BING = ('httpQueryAuth', 'SEOcredBingWebm', 'Bing Webmaster API')
AHREFS = ('httpHeaderAuth', 'SEOcredAhrefsDR', 'Ahrefs (free Domain Rating)')
JINA = ('httpHeaderAuth', 'SEOcredJinaReade', 'Jina Reader')
B.code('Source Requests', 'Source_Requests.js', at(19, 0)); B.iff('Any Sources?', '{{ !$json.skip }}', at(20, 0)); get_http('Fetch Sources', at(21, -1), headers={'User-Agent': BOT_UA, 'Accept': 'application/json'})
B.code('News Requests', 'News_Requests.js', at(22, 0)); B.iff('Any News?', '{{ !$json.skip }}', at(23, 0)); get_http('Fetch News', at(24, -1), interval=5500, headers={'User-Agent': BOT_UA})
B.code('Bing Sites', 'Bing_Sites.js', at(25, 0)); B.iff('Any Bing Sites?', '{{ !$json.skip }}', at(26, 0)); get_http('Fetch Bing Sites', at(27, -1), cred=BING)
B.code('Bing Requests', 'Bing_Requests.js', at(28, 0)); B.iff('Any Bing?', '{{ !$json.skip }}', at(29, 0)); get_http('Fetch Bing Counts', at(30, -1), interval=400, cred=BING)
B.code('Bing Link Requests', 'Bing_Link_Requests.js', at(31, 0)); B.iff('Any Bing Links?', '{{ !$json.skip }}', at(32, 0)); get_http('Fetch Bing', at(33, -1), interval=400, cred=BING)
B.code('Referral Requests', 'Referral_Requests.js', at(34, 0)); B.iff('Any GA4 (BL)?', '{{ !$json.skip }}', at(35, 0))
B.node('GA4 Referrals', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': '={{ $json.url }}', 'authentication': 'predefinedCredentialType', 'nodeCredentialType': 'googleApi', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify($json.body) }}',
    'options': {'batching': {'batch': {'batchSize': 1, 'batchInterval': 150}}, 'timeout': 60000, 'response': {'response': {'neverError': True}}}}, at(36, -1), credentials=GOOGLE, **HTTP_X)
# one list of referrers, the pages to check, the check itself (fetch + render), authority, the Link Analyst
B.code('Link Merge', 'Link_Merge.js', at(37, 0))
B.code('Locate Requests', 'Locate_Requests.js', at(38, 0)); B.iff('Any Locate?', '{{ !$json.skip }}', at(39, 0)); get_http('Fetch Locate', at(40, -1), batch=2, interval=500)
B.code('Verify Requests', 'Verify_Requests.js', at(41, 0)); B.iff('Any Verify?', '{{ !$json.skip }}', at(42, 0))
get_http('Fetch Linking Pages', at(43, -1), batch=8, interval=250, timeout=20000, text=True, headers={'User-Agent': BROWSER_UA, 'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.8'})
B.code('Render Requests', 'Render_Requests.js', at(44, 0)); B.iff('Any Render?', '{{ !$json.skip }}', at(45, 0))
get_http('Render Pages', at(46, -1), url='={{ $json.render_url }}', batch=2, interval=500, timeout=60000, out_prop='data', cred=JINA, headers={'X-Return-Format': 'html', 'X-Timeout': '25'})
B.code('Verify Links', 'Verify_Links.js', at(47, 0))
B.code('Authority Requests', 'Authority_Requests.js', at(48, 0)); B.iff('Any Authority?', '{{ !$json.skip }}', at(49, 0)); B.dfs_http('Run Authority', at(50, -1), timeout=120000)
B.code('DR Requests', 'DR_Requests.js', at(51, 0)); B.iff('Any DR?', '{{ !$json.skip }}', at(52, 0)); get_http('Fetch DR', at(53, -1), method='POST', body='={{ JSON.stringify($json.body) }}', timeout=60000, cred=AHREFS)
B.code('Link Analyst Jobs', 'Link_Analyst_Jobs.js', at(54, 0)); B.iff('Any Link Analyst?', '{{ !$json.skip }}', at(55, 0))
B.agent('Link Analyst', 'link_analyst.txt', {'type': 'object', 'properties': {'links': {'type': 'array', 'items': {'type': 'object', 'properties': {'n': {'type': 'number'}, 'type': {'type': 'string'}, 'relevance': {'type': 'number'}, 'note': {'type': 'string'}}, 'required': ['n', 'type']}}}, 'required': ['links']}, at(56, -1))
B.code('Parse Backlinks', 'Parse_Backlinks.js', at(57, 0))
# outreach: jobs (new drafts by score + follow-ups), contacts from the prospects' own pages, the writer, the pipeline
B.code('Outreach Jobs', 'Outreach_Jobs.js', at(58, 0)); B.code('Contact Requests', 'Contact_Requests.js', at(59, 0)); B.iff('Any Contacts?', '{{ !$json.skip }}', at(60, 0))
get_http('Fetch Contacts', at(61, -1), batch=6, interval=250, timeout=15000, text=True, headers={'User-Agent': BROWSER_UA, 'Accept': 'text/html,*/*;q=0.8'})
B.code('Outreach Input', 'Outreach_Input.js', at(62, 0)); B.iff('Any Outreach?', '{{ !$json.skip }}', at(63, 0))
B.agent('Outreach Writer', 'outreach.txt', {'type': 'object', 'properties': {'drafts': {'type': 'array', 'items': {'type': 'object', 'properties': {'prospect_domain': {'type': 'string'}, 'followup': {'type': 'number'}, 'subject': {'type': 'string'}, 'body': {'type': 'string'}}, 'required': ['prospect_domain', 'body']}}}, 'required': ['drafts']}, at(64, -1))
B.code('Prospect Rows', 'Prospect_Rows.js', at(65, 0)); B.iff('Any Prospect Rows?', '{{ !$json.skip }}', at(66, 0))
B.node('Save Prospects', DT_TYPE, DT_VERSION, dt_upsert_params_keys(PROSPECT_TABLE, PROSPECT_COLS, ['site_id', 'prospect_domain', 'type']), at(67, -1), onError='continueRegularOutput')
B.code('Ledger Rows', 'Ledger_Rows.js', at(68, 0)); B.iff('Any Ledger Rows?', '{{ !$json.skip }}', at(69, 0))
B.node('Save Backlinks', DT_TYPE, DT_VERSION, dt_upsert_params_keys(LINKS_TABLE, LINKS_COLS, ['site_id', 'ref_domain']), at(70, -1), onError='continueRegularOutput')
B.code('BL Snapshot Rows', 'BL_Snapshot_Rows.js', at(14, 3)); B.node('Save BL Snapshot', DT_TYPE, DT_VERSION, dt_insert_params(BL_SNAP_TABLE, BL_SNAP_COLS), at(15, 3), onError='continueRegularOutput')
B.code('BL Report', 'BL_Report.js', at(16, 3)); B.pdf_chain('BL', at(17, 3))
B.code('Build BL Callback', 'Build_BL_Callback.js', at(20, 4)); B.deliver('BL', at(20, 3), "={{ ['pdf', 'prospects_csv', 'disavow_txt'].filter(k => $binary[k]).join(',') || 'data' }}")
B.chain(*[e[0] for e in ens], *[l[0] for l in loads], 'Load Cache (BL Rivals)', 'BL Plan', 'Any Sites (BL)?'); B.link('Manual Run', ens[0][0])
B.link('Any Sites (BL)?', 'BL Requests', 0); B.link('Any Sites (BL)?', 'Nothing To Do (BL)', 1)
def step(code, iff, http, nxt):   # code -> IF -> (http) -> next; the IF's false branch skips the request
    B.link(code, iff); B.link(iff, http, 0); B.link(iff, nxt, 1); B.link(http, nxt)
B.iff('Any BL Requests?', '{{ !$json.skip }}', at(15, 1))   # v4.10: none on a free-sources-only check
step('BL Requests', 'Any BL Requests?', 'Run BL Requests', 'Gap Requests')
step('Gap Requests', 'Any Gap?', 'Run Gap Requests', 'Source Requests')
step('Source Requests', 'Any Sources?', 'Fetch Sources', 'News Requests')
step('News Requests', 'Any News?', 'Fetch News', 'Bing Sites')
step('Bing Sites', 'Any Bing Sites?', 'Fetch Bing Sites', 'Bing Requests')
step('Bing Requests', 'Any Bing?', 'Fetch Bing Counts', 'Bing Link Requests')
step('Bing Link Requests', 'Any Bing Links?', 'Fetch Bing', 'Referral Requests')
step('Referral Requests', 'Any GA4 (BL)?', 'GA4 Referrals', 'Link Merge')
B.link('Link Merge', 'Locate Requests')
step('Locate Requests', 'Any Locate?', 'Fetch Locate', 'Verify Requests')
step('Verify Requests', 'Any Verify?', 'Fetch Linking Pages', 'Render Requests')
step('Render Requests', 'Any Render?', 'Render Pages', 'Verify Links')
B.link('Verify Links', 'Authority Requests')
step('Authority Requests', 'Any Authority?', 'Run Authority', 'DR Requests')
step('DR Requests', 'Any DR?', 'Fetch DR', 'Link Analyst Jobs')
step('Link Analyst Jobs', 'Any Link Analyst?', 'Link Analyst', 'Parse Backlinks')
B.chain('Parse Backlinks', 'Outreach Jobs', 'Contact Requests')
step('Contact Requests', 'Any Contacts?', 'Fetch Contacts', 'Outreach Input')
step('Outreach Input', 'Any Outreach?', 'Outreach Writer', 'Prospect Rows')
step('Prospect Rows', 'Any Prospect Rows?', 'Save Prospects', 'Ledger Rows')
step('Ledger Rows', 'Any Ledger Rows?', 'Save Backlinks', 'BL Snapshot Rows')
B.chain('BL Snapshot Rows', 'Save BL Snapshot', 'BL Report', 'Prepare PDF BL', 'Render PDF BL', 'Attach PDF BL', 'Has Email (BL)?'); B.link('Attach PDF BL', 'Build BL Callback'); B.link('Build BL Callback', 'Has Callback (BL)?')
B.run_ledger('backlinks', 'BL', 'BL Plan', ['BL Report'], at(13, 6), measured='Parse Backlinks')
# B-A10 (2026-10-15, INVARIANTS rule 3): the three paid DataForSEO pulls of the link ledger. Each one's failure is a silent
# shrinking of the ledger — *Parse Backlinks* counts what came back, so a pull that failed inside a 200 looks like a site with
# fewer links, which is the shape R20 / B-L5 exist to stop ("not compared" instead of an arrow). A second attempt costs nothing
# when the first failed (a failed task is billed 0), and `result()` prices both attempts, each task once.
B.in200_gate('Run BL Requests', 'the link profile this check is built on', 'pull')
B.in200_gate('Run Gap Requests', 'the sites linking to competitors but not to you', 'pull')
B.in200_gate('Run Authority', "the referring sites' authority and spam scores", 'pull')
B.sticky(f"""## SEO Agent — Backlink Monitor (v4.5; v4.10 every source merged + our own link check — BACKLINKS_SPEC.md)
**Once a week in each website's own cycle** (job 2; *Manual Run* {CYCLE_ENTRY} plus `light`): a light watch (links lost / new since the last check, spam, the valuable links re-checked on their pages) that e-mails only when an **important link was lost** (two misses in a row) or spam arrived; the website's **monthly cycle** (`monthly: true`) is the full report. On demand: *Manual Run* `{{ domain | site_id, light?, email?, callback_url? }}`; form option "Check my backlinks" / API `mode: backlinks`.
**Sources**: DataForSEO Backlinks (summary, lost, new; full runs: referring domains, one link per domain with details, anchors, most-linked pages, broken, history, Content Analysis mentions, competitors' new links, the quarterly gap); **free**: Bing Webmaster Tools (GetUrlLinks; when SEO_BING_WEBMASTER_API_KEY is set: {'on' if BING_ON else 'off'}), the Search Console Links exports uploaded in the app (`{LINK_IMPORTS_TABLE}`), GA4 referrals (links that send visits), the Common Crawl web graph (`{LINK_GRAPH_TABLE}`, monthly linkgraph job), Wikipedia, Hacker News, GDELT news, web search (SearXNG: mentions, "best X" lists, `site:` lookups); Ahrefs Domain Rating (free key; {'on' if AHREFS_ON else 'off'}).
**Link check**: the linking pages are fetched (browser user agent; Jina renders bot-blocked / JavaScript pages): found / missing / gone / blocked, rel, placement, noindex, canonical. **Lost = two misses in a row**, with the reason. *Link Analyst* (Claude) labels the link type and relevance. Values per link: SEO / referral / brand. Ledger → `{LINKS_TABLE}` (changed rows only).
Prospects (`{PROSPECT_TABLE}`): lost / mention (checked on the page) / list / comp_new / gap (DataForSEO + Common Crawl) / reclaim / ai_source, scored value × likelihood; contacts from the prospects' own pages; first drafts (8 a month) + follow-ups after 7 and 14 days; **won** only when the link is found. Snapshot → `{BL_SNAP_TABLE}`. Report: e-mail + PDF + `prospects.csv` + `disavow-candidates.txt` (review only) + callback `stage: backlinks`.""", [-40, -760], 1500, 440)
B.write('SEO_Agent_Backlink_Monitor.json')

# =============================================================================
# 3. AUDIT SCHEDULER
# =============================================================================
S = WF('SEOagentAuditSc1', 'SEO Agent — Audit Scheduler', 'audsc', 900)
S.node('Manual Run', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, {'inputSource': 'passthrough'}, at(0, 1))
ens = [('Ensure Monitors Table', MONITORS_TABLE, MONITORS_COLS), ('Ensure Audits Table', AUDITS_TABLE, AUDITS_COLS), ('Ensure Sites Table', SITES_TABLE, SITES_COLS), ('Ensure Profiles Table', PROFILE_TABLE, PROFILE_COLS), ('Ensure Cache Table', CACHE_TABLE, CACHE_COLS)]
for i, (nm, t_, c) in enumerate(ens): S.ensure(nm, t_, c, at(1 + i, 0))
loads = [('Load Sites', SITES_TABLE), ('Load Ladders', LADDER_TABLE), ('Load Monitors', MONITORS_TABLE), ('Load Profiles', PROFILE_TABLE), ('Load Audits', AUDITS_TABLE)]
for i, (nm, t_) in enumerate(loads): S.load(nm, t_, at(1 + i, 1))
S.node('Load Cache (Audit)', DT_TYPE, DT_VERSION, dt_get_where_params(CACHE_TABLE, 'kind', 'eq', 'sitemap'), at(6, 1), **LOAD)
S.code('Audit Candidates', 'Audit_Candidates.js', at(7, 1)); S.iff('Any Candidates?', '{{ !$json.nothing_to_do }}', at(8, 1))
S.node('Fetch Sitemap (Schedule)', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'GET', 'url': '={{ $json.sitemap_url }}', 'sendHeaders': True, 'headerParameters': {'parameters': [{'name': 'User-Agent', 'value': 'Mozilla/5.0 (compatible; SEO-Agent/4.6)'}, {'name': 'Accept', 'value': 'application/xml,text/xml,*/*'}]},
    'options': {'timeout': 45000, 'redirect': {'redirect': {'followRedirects': True, 'maxRedirects': 5}}, 'response': {'response': {'fullResponse': True, 'neverError': True, 'responseFormat': 'text'}}}}, at(9, 0), onError='continueRegularOutput', **retry_lint.RETRY)
S.code('Audit Schedule Plan', 'Audit_Sched_Plan.js', at(10, 1))
S.code('Fingerprint Rows', "// The sitemap fingerprints to store (seo_cache, upsert by key; exact columns), for started and skipped sites alike.\nconst rows = $('Audit Schedule Plan').all().map(i => i.json.cache_row).filter(Boolean);\nreturn rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];", at(11, 1))
S.iff('Any Fingerprints?', '{{ !$json.skip }}', at(12, 1))
S.node('Save Fingerprints', DT_TYPE, DT_VERSION, dt_upsert_params(CACHE_TABLE, CACHE_COLS, 'key'), at(13, 0), onError='continueRegularOutput', alwaysOutputData=True)
S.code('Audits To Start', "// Only the audits that are due; the others are listed with the reason they were skipped.\n"
       "// F-L (2026-10-18, re-rating 2026-10-17 C-1 follow-up): the audits report through the main workflow, so a scheduler run that ran late (the\n"
       "// catch-up started it for a missed 1st of the month, or the schedule fired hours late; since 2026-10-19 a cycle job that started hours after its\n"
       "// cycle was due) hands `ran_late` to each audit it starts; Normalize\n"
       "// Input keeps it for a scheduled request only and Run Cost (Callback) marks the report: `ran_late`, the box, the subject.\n"
       "/*__RAN_LATE__*/\nconst ran_late = RL.of(SCHED, ['Manual Run']);\n"
       "const plan = $('Audit Schedule Plan').all().map(i => i.json); const due = plan.filter(p => p.run && p.body);\nreturn due.length ? due.map(p => ({ json: { body: ran_late.late ? { ...p.body, ran_late } : p.body, domain: p.domain, why: p.why, ran_late } })) : [{ json: { nothing_to_do: true, skipped: plan.map(p => p.domain + ': ' + p.why), ran_late } }];", at(14, 1))
S.iff('Any Audits Due?', '{{ !$json.nothing_to_do }}', at(15, 1))
S.node('Start Scheduled Audits', 'n8n-nodes-base.executeWorkflow', 1.2, {'source': 'database', 'workflowId': {'__rl': True, 'mode': 'id', 'value': 'SEOagentV4Full01'}, 'mode': 'each', 'options': {'waitForSubWorkflow': False}}, at(16, 0), onError='continueRegularOutput')
S.code('Audits Started', "// What was started (each audit delivers its own report, diff and fix pack) and what was skipped, with the reason.\nconst plan = $('Audit Schedule Plan').all().map(i => i.json);\nreturn [{ json: { started: plan.filter(p => p.run).map(p => p.domain + ': ' + p.why), skipped: plan.filter(p => !p.run).map(p => p.domain + ': ' + p.why), at: new Date().toISOString() } }];", at(17, 0))
S.node('Nothing Due', 'n8n-nodes-base.noOp', 1, {}, at(16, 2))
S.chain(*[e[0] for e in ens], *[l[0] for l in loads], 'Load Cache (Audit)', 'Audit Candidates', 'Any Candidates?'); S.link('Manual Run', ens[0][0])
S.link('Any Candidates?', 'Fetch Sitemap (Schedule)', 0); S.link('Any Candidates?', 'Nothing Due', 1)
S.chain('Fetch Sitemap (Schedule)', 'Audit Schedule Plan', 'Fingerprint Rows', 'Any Fingerprints?'); S.link('Any Fingerprints?', 'Save Fingerprints', 0); S.link('Any Fingerprints?', 'Audits To Start', 1); S.link('Save Fingerprints', 'Audits To Start')
S.chain('Audits To Start', 'Any Audits Due?'); S.link('Any Audits Due?', 'Start Scheduled Audits', 0); S.link('Any Audits Due?', 'Audits Started', 1); S.link('Start Scheduled Audits', 'Audits Started')
S.run_ledger('audit_schedule', 'Audit', 'Audit Schedule Plan', ['Audits Started'], at(10, 4))
S.sticky(f"""## SEO Agent — Audit Scheduler (v4.6: no repeated audits)
**In each website's monthly cycle** (owner decision D2, 2026-10-19: day one, then the first cycle on or after the website's monthly date; *Manual Run* {CYCLE_ENTRY} with `job: 'audit'` — a cycle run with `monthly: false` audits nothing) and on demand (*Manual Run* `{{ domain | site_id }}` always audits). Per site with `audit_monthly` on (`{MONITORS_TABLE}`): the sitemap is read (free) and its fingerprint (URLs + lastmod dates, or the sitemap index entries) compared with the one stored at the last check (`{CACHE_TABLE}`, key `sitemap:<site>`). **Audit only when** the site changed, 60+ days passed since the last audit (safety net for theme / plugin / server changes a sitemap does not show), the site was never audited, or no sitemap (or an index without dates) is readable (then monthly as before). Unchanged sites are skipped — the weekly Site Tracker keeps watching indexing in Search Console. Started audits run as their own executions (internal key `audit:`), compare themselves with the previous audit and deliver the report with the **fix pack**.""", [-40, -420], 1150, 240)
S.write('SEO_Agent_Audit_Scheduler.json')


# =============================================================================
# 4. AI GROWTH (v4.12, AI_GROWTH_SPEC.md): the weekly work that gets a site named and cited in AI answers — not only measured
# =============================================================================
G = WF('SEOagentAIGrow1', 'SEO Agent — AI Growth', 'aigrow', 2400)
G.node('Manual Run', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, {'inputSource': 'passthrough'}, at(0, 1))
ens = [('Ensure Monitors Table', MONITORS_TABLE, MONITORS_COLS), ('Ensure AI Pages Table', AI_PAGES_TABLE, AI_PAGES_COLS), ('Ensure AI Targets Table', AI_TARGETS_TABLE, AI_TARGETS_COLS),
       ('Ensure AI Growth Table', AI_GROWTH_TABLE, AI_GROWTH_COLS), ('Ensure Prospects Table', PROSPECT_TABLE, PROSPECT_COLS), ('Ensure Cache Table', CACHE_TABLE, CACHE_COLS)]
for i, (nm, t, c) in enumerate(ens): G.ensure(nm, t, c, at(1 + i, 0))
loads = [('Load Sites', SITES_TABLE), ('Load Ladders', LADDER_TABLE), ('Load Monitors', MONITORS_TABLE), ('Load Profiles', PROFILE_TABLE), ('Load AI Visibility', AI_VIS_TABLE), ('Load AI Prompts', AI_PROMPTS_TABLE),
         ('Load Content Log', LOG_TABLE), ('Load Query History', QUERY_TABLE), ('Load AI Pages', AI_PAGES_TABLE), ('Load AI Targets', AI_TARGETS_TABLE), ('Load AI Growth', AI_GROWTH_TABLE), ('Load Link Prospects (Growth)', PROSPECT_TABLE),
         ('Load Cycles', CYCLES_TABLE)]   # 2026-10-19: the website's time zone (seo_cycles) - the Wikidata check outside a cycle is monthly in ITS calendar
for i, (nm, t) in enumerate(loads): G.load(nm, t, at(1 + i, 1))
G.node('Load AI Answers', DT_TYPE, DT_VERSION, dt_get_all_where_params(AI_ANSWERS_TABLE, [('checked_at', 'gte', SINCE(8))]), at(13, 1), **LOAD)
G.node('Load Cache (Growth)', DT_TYPE, DT_VERSION, dt_get_where_params(CACHE_TABLE, 'kind', 'eq', 'ai'), at(14, 1), **LOAD)
G.code('Growth Plan', 'Growth_Plan.js', at(15, 1)); G.iff('Any Sites (Growth)?', '{{ !$json.nothing_to_do }}', at(16, 1)); G.node('Nothing To Do (Growth)', 'n8n-nodes-base.noOp', 1, {}, at(17, 2))
def g_http(name, pos, url='={{ $json.url }}', batch=1, interval=300, timeout=30000, headers=None, cred=None, text=False, method='GET', body=None):
    params = {'method': method, 'url': url, 'options': {'batching': {'batch': {'batchSize': batch, 'batchInterval': interval}}, 'timeout': timeout, 'redirect': {'redirect': {'followRedirects': True, 'maxRedirects': 10}},
        'response': {'response': ({'fullResponse': True, 'neverError': True, 'responseFormat': 'text'} if text else {'neverError': True})}}}
    if headers: params.update({'sendHeaders': True, 'headerParameters': {'parameters': [{'name': k, 'value': v} for k, v in headers.items()]}})
    if body: params.update({'sendBody': True, 'specifyBody': 'json', 'jsonBody': body})
    extra = {}
    if cred: kind, cid, cname = cred; params.update({'authentication': 'genericCredentialType', 'genericAuthType': kind}); extra['credentials'] = {kind: {'id': cid, 'name': cname}}
    return G.node(name, 'n8n-nodes-base.httpRequest', 4.5, params, pos, onError='continueRegularOutput', **retry_lint.RETRY, **extra)   # G1: the one retry rule
WIKI_UA = 'SEOAgentAIGrowth/4.12 (' + BRAND + '; entity check; mailto:' + OPS_EMAIL + ')'
# B9-3 (2026-10-15, benchmark area 9): robots.txt first, because what the AI search fetchers may read decides whether a readiness
# score means anything and whether a page is worth a submission slot. One free GET per site, retried by the shared rule.
G.code('Robots Requests (Growth)', 'Growth_Robots_Requests.js', at(16, 0)); G.iff('Any Robots (Growth)?', '{{ !$json.skip }}', at(16, -1))
g_http('Fetch Robots (Growth)', at(16, -2), timeout=15000, text=True, headers={'User-Agent': BOT_UA, 'Accept': 'text/plain,*/*'})
G.code('Robots Verdicts (Growth)', 'Growth_Robots.js', at(16, -3))
G.code('Page Requests (Growth)', 'Growth_Page_Requests.js', at(17, 0)); G.iff('Any Pages (Growth)?', '{{ !$json.skip }}', at(18, 0))
g_http('Fetch Key Pages', at(19, -1), batch=4, interval=300, timeout=20000, text=True, headers={'User-Agent': BROWSER_UA, 'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.8'})
G.code('Fetcher Requests (Growth)', 'Growth_Fetcher_Requests.js', at(19, 1)); G.iff('Any Fetchers (Growth)?', '{{ !$json.skip }}', at(19, 2))
g_http('Fetch As AI Bots (Growth)', at(19, 3), batch=4, interval=300, timeout=20000, text=True, headers={'User-Agent': '={{ $json.ua }}', 'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8'})
G.code('Earned Requests', 'Growth_Earned_Requests.js', at(20, 0)); G.iff('Any Earned?', '{{ !$json.skip }}', at(21, 0))
g_http('Fetch Cited Pages', at(22, -1), batch=4, interval=300, timeout=20000, text=True, headers={'User-Agent': BROWSER_UA, 'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.8'})
G.code('Bing Sites (Growth)', 'Growth_Bing_Sites.js', at(23, 0)); G.iff('Any Bing (Growth)?', '{{ !$json.skip }}', at(24, 0)); g_http('Fetch Bing Sites (Growth)', at(25, -1), cred=BING)
G.code('Bing Growth Requests', 'Growth_Bing_Requests.js', at(26, 0)); G.iff('Any Bing Requests (Growth)?', '{{ !$json.skip }}', at(27, 0)); g_http('Fetch Bing Growth', at(28, -1), interval=400, cred=BING)
G.code('Bing Submit Requests', 'Growth_Bing_Submit.js', at(29, 0)); G.iff('Any Bing Submit?', '{{ !$json.skip && !$json.dry_run }}', at(30, 0))   # R94: a dry run (a test) never reaches SubmitUrlBatch
g_http('Submit to Bing', at(31, -1), method='POST', body='={{ JSON.stringify($json.body) }}', interval=600, cred=BING)
G.code('IndexNow Key Requests', 'Growth_IndexNow_Keys.js', at(32, 0)); G.iff('Any IndexNow Keys?', '{{ !$json.skip }}', at(33, 0)); g_http('Fetch IndexNow Key', at(34, -1), timeout=15000, text=True, headers={'User-Agent': BOT_UA})
G.code('IndexNow Requests', 'Growth_IndexNow_Submit.js', at(35, 0)); G.iff('Any IndexNow?', '{{ !$json.skip && !$json.dry_run }}', at(36, 0))   # R94: nor IndexNow
g_http('Submit IndexNow', at(37, -1), method='POST', body='={{ JSON.stringify($json.body) }}', text=True, headers={'Content-Type': 'application/json; charset=utf-8'})
G.code('Entity Requests', 'Growth_Entity_Requests.js', at(38, 0)); G.iff('Any Entity?', '{{ !$json.skip }}', at(39, 0)); g_http('Fetch Wikidata', at(40, -1), interval=1100, headers={'User-Agent': WIKI_UA, 'Accept': 'application/json'})
G.code('AI Readiness', 'AI_Readiness.js', at(41, 0)); G.code('Earned Media', 'Earned_Media.js', at(42, 0))
G.code('AI Outreach Input', 'AI_Outreach_Input.js', at(43, 0)); G.iff('Any AI Outreach?', '{{ !$json.skip }}', at(44, 0))
G.agent('AI Outreach Writer', 'ai_outreach.txt', {'type': 'object', 'properties': {'drafts': {'type': 'array', 'items': {'type': 'object', 'properties': {'n': {'type': 'number'}, 'subject': {'type': 'string'}, 'body': {'type': 'string'}}, 'required': ['n', 'body']}}}, 'required': ['drafts']}, at(45, -1), max_tokens=6000)
G.code('Growth Metrics', 'Growth_Metrics.js', at(46, 0))
def exact_rows(name, comment, key, cols, pos, single=False):
    pick = "i.json." + key + " ? [i.json." + key + "] : []" if single else "i.json." + key + " || []"
    G.code(name, '// ' + comment + ' (exact columns)\nconst COLS = ' + json.dumps([c for c, _ in cols]) + ';\nconst rows = $(\'Growth Metrics\').all().flatMap(i => ' + pick + ').map(r => Object.fromEntries(COLS.map(c => [c, r[c] === undefined ? null : r[c]])));\nreturn rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];', pos)
# R92 part 6 (2026-10-16, re-rating defect C-16): the upsert key is (site_id, url), so a page written under the bare host and the same
# page under www are two rows — the 17 bare-host rows of 2026-10-10/11 stayed beside their www twins. The key is normalised here: a URL on
# the site's own domain is put on the site model's canonical host (Growth Plan `site_host`) before the upsert, and two variants of one
# page in one run are one row. The stale rows already stored are repaired by fix_ai_pages_hosts.py (dry run by default).
G.code('AI Page Rows', '// Key pages checked this week (seo_ai_pages, upsert by site + url) (exact columns)\n'
       '// R92 part 6: the URL in the upsert key is on the canonical host, whatever host the page was read under\n'
       'const COLS = ' + json.dumps([c for c, _ in AI_PAGES_COLS]) + ';\n'
       "const plans = (() => { try { return $('Growth Plan').all().map(i => i.json).filter(p => p && p.site_id); } catch (e) { return []; } })();\n"
       "const hostFor = new Map(plans.map(p => [p.site_id, String(p.site_host || '').toLowerCase().replace(/\\.$/, '')]));\n"
       "const bare = (h) => String(h || '').toLowerCase().replace(/^www\\./, '');\n"
       "const canon = (r) => { const h = hostFor.get(r.site_id) || ''; const m = String(r.url || '').match(/^https?:\\/\\/([^\\/?#]+)(.*)$/i);\n"
       "  if (!h || !m || bare(m[1]) !== bare(h)) return r.url; return 'https://' + h + (m[2] || '/'); };\n"
       "const rows = $('Growth Metrics').all().flatMap(i => i.json.page_rows || []).map(r => ({ ...r, url: canon(r) })).map(r => Object.fromEntries(COLS.map(c => [c, r[c] === undefined ? null : r[c]])));\n"
       "const one = new Map(); for (const r of rows) one.set(r.site_id + '|' + r.url, r);   // two variants of one page in one run: one row, the last read wins (as the upsert would)\n"
       "const out = [...one.values()];\n"
       "return out.length ? out.map(r => ({ json: r })) : [{ json: { skip: true } }];", at(47, 0)); G.iff('Any AI Page Rows?', '{{ !$json.skip }}', at(48, 0))
G.node('Save AI Pages', DT_TYPE, DT_VERSION, dt_upsert_params_keys(AI_PAGES_TABLE, AI_PAGES_COLS, ['site_id', 'url']), at(49, -1), onError='continueRegularOutput')
exact_rows('AI Target Rows', 'The questions to win (seo_ai_targets, upsert by target_id; the Content Cadence writes the queued ones)', 'target_rows', AI_TARGETS_COLS, at(50, 0)); G.iff('Any AI Target Rows?', '{{ !$json.skip }}', at(51, 0))
G.node('Save AI Targets', DT_TYPE, DT_VERSION, dt_upsert_params_keys(AI_TARGETS_TABLE, AI_TARGETS_COLS, ['target_id']), at(52, -1), onError='continueRegularOutput')
exact_rows('Growth Prospect Rows', 'Earned-media prospects (seo_link_prospects type ai_source, upsert by site + domain + type; statuses and contacts kept)', 'prospect_rows', PROSPECT_COLS, at(53, 0)); G.iff('Any Growth Prospects?', '{{ !$json.skip }}', at(54, 0))
G.node('Save Growth Prospects', DT_TYPE, DT_VERSION, dt_upsert_params_keys(PROSPECT_TABLE, PROSPECT_COLS, ['site_id', 'prospect_domain', 'type']), at(55, -1), onError='continueRegularOutput')
exact_rows('Growth Cache Rows', "The site's IndexNow key (seo_cache indexnow:<site_id>)", 'cache_rows', CACHE_COLS, at(56, 0)); G.iff('Any Growth Cache?', '{{ !$json.skip }}', at(57, 0))
G.node('Save Growth Cache', DT_TYPE, DT_VERSION, dt_upsert_params_keys(CACHE_TABLE, CACHE_COLS, ['key']), at(58, -1), onError='continueRegularOutput')
exact_rows('AI Growth Row', 'One seo_ai_growth row per site and run', 'growth_row', AI_GROWTH_COLS, at(59, 0), single=True); G.iff('Any Growth Row?', '{{ !$json.skip }}', at(60, 0))
G.node('Save AI Growth', DT_TYPE, DT_VERSION, dt_insert_params(AI_GROWTH_TABLE, AI_GROWTH_COLS), at(61, -1), onError='continueRegularOutput')
G.code('Growth Report', 'Growth_Report.js', at(62, 0))
G.code('Build Growth Callback', "// Callback payload per site (stage ai_growth): the summary; the table rows stay in n8n.\nreturn $input.all().map(i => { const { html, page_rows, target_rows, prospect_rows, growth_row, cache_rows, ...rest } = i.json; return { json: rest }; });", at(63, 1))
G.deliver('Growth', at(63, 0), None)
G.chain(*[e[0] for e in ens], *[l[0] for l in loads], 'Load AI Answers', 'Load Cache (Growth)', 'Growth Plan', 'Any Sites (Growth)?'); G.link('Manual Run', ens[0][0])
G.link('Any Sites (Growth)?', 'Robots Requests (Growth)', 0); G.link('Any Sites (Growth)?', 'Nothing To Do (Growth)', 1)
def gstep(code, iff, http, nxt): G.link(code, iff); G.link(iff, http, 0); G.link(iff, nxt, 1); G.link(http, nxt)
# B9-3: robots.txt is read and judged before any page is scored or submitted
gstep('Robots Requests (Growth)', 'Any Robots (Growth)?', 'Fetch Robots (Growth)', 'Robots Verdicts (Growth)')
G.link('Robots Verdicts (Growth)', 'Page Requests (Growth)')
# B9-8: each key page a second time as the AI answer fetchers (a CDN rule can turn them away while robots.txt allows them)
G.link('Page Requests (Growth)', 'Any Pages (Growth)?'); G.link('Any Pages (Growth)?', 'Fetch Key Pages', 0); G.link('Any Pages (Growth)?', 'Earned Requests', 1); G.link('Fetch Key Pages', 'Fetcher Requests (Growth)')
gstep('Fetcher Requests (Growth)', 'Any Fetchers (Growth)?', 'Fetch As AI Bots (Growth)', 'Earned Requests')
gstep('Earned Requests', 'Any Earned?', 'Fetch Cited Pages', 'Bing Sites (Growth)')
gstep('Bing Sites (Growth)', 'Any Bing (Growth)?', 'Fetch Bing Sites (Growth)', 'Bing Growth Requests')
gstep('Bing Growth Requests', 'Any Bing Requests (Growth)?', 'Fetch Bing Growth', 'Bing Submit Requests')
gstep('Bing Submit Requests', 'Any Bing Submit?', 'Submit to Bing', 'IndexNow Key Requests')
gstep('IndexNow Key Requests', 'Any IndexNow Keys?', 'Fetch IndexNow Key', 'IndexNow Requests')
gstep('IndexNow Requests', 'Any IndexNow?', 'Submit IndexNow', 'Entity Requests')
gstep('Entity Requests', 'Any Entity?', 'Fetch Wikidata', 'AI Readiness')
G.chain('AI Readiness', 'Earned Media', 'AI Outreach Input')
gstep('AI Outreach Input', 'Any AI Outreach?', 'AI Outreach Writer', 'Growth Metrics')
G.link('Growth Metrics', 'AI Page Rows')
gstep('AI Page Rows', 'Any AI Page Rows?', 'Save AI Pages', 'AI Target Rows')
gstep('AI Target Rows', 'Any AI Target Rows?', 'Save AI Targets', 'Growth Prospect Rows')
gstep('Growth Prospect Rows', 'Any Growth Prospects?', 'Save Growth Prospects', 'Growth Cache Rows')
gstep('Growth Cache Rows', 'Any Growth Cache?', 'Save Growth Cache', 'AI Growth Row')
gstep('AI Growth Row', 'Any Growth Row?', 'Save AI Growth', 'Growth Report')
G.link('Growth Report', 'Has Email (Growth)?'); G.link('Growth Report', 'Build Growth Callback'); G.link('Build Growth Callback', 'Has Callback (Growth)?')
G.run_ledger('ai_growth', 'Growth', 'Growth Plan', ['Growth Report'], at(16, 4), measured='Growth Metrics')
G.sticky(f"""## SEO Agent — AI Growth (v4.12, AI_GROWTH_SPEC.md)
**Once a week in each website's own cycle** (job 5: after the AI Visibility Tracker and the Site Tracker, before the Content Cadence; *Manual Run* {CYCLE_ENTRY}; the Wikidata check only when `monthly: true`) and on demand (*Manual Run* `{{{{ domain | site_id, email?, callback_url? }}}}`). Per site with AI visibility and `ai_growth` on (`{MONITORS_TABLE}`; default on): the work that gets the business **named and cited** in AI answers.
**Indexing**: new / updated pages and key pages Bing has not crawled → **Bing Webmaster Tools SubmitUrlBatch** (the index **Bing and Microsoft Copilot** answer from; OpenAI documents OAI-SearchBot, not Bing, for ChatGPT search; key SEO_BING_WEBMASTER_API_KEY: {'on' if BING_ON else 'off'}) and **IndexNow** once the site hosts its key file (`{CACHE_TABLE}` `indexnow:`; Bing, Yandex, Naver, Seznam, Yep — not Google, and a submission "does not guarantee immediate indexing"). **B9-2**: every page sent in the last 45 days is asked about again (GetUrlInfo) and the report says how many Bing has **since crawled** — measured, or "not available" with the reason. **B9-3**: `robots.txt` is read first (*Robots Verdicts (Growth)*) and judged per page for OAI-SearchBot / ChatGPT-User / PerplexityBot / Claude-SearchBot / Googlebot / Bingbot — a page no AI fetcher may read gets **no readiness score** and is not submitted. **AI readiness** of up to 12 key pages a week (`{AI_PAGES_TABLE}`): raw HTML without JavaScript, answer in the first ~200 characters, visible update date ≤ 90 days, question headings, sourced figures, lists, author; Bing's crawl state (GetUrlInfo).
**Questions to win** (`{AI_TARGETS_TABLE}`): every lost question of the latest AI visibility run → a new answer page or a refresh of the page the site has; the **Content Cadence** writes the queued ones (`ai_pages_month`, default 2) with the question, the AI's searches and its sources. **B9-4**: a target is **won** only when at least 2 answers of the last 8 days (weekly + pulse) named the business, with the count printed — and a won question that is lost again goes back in the queue with both dates and an alert. **B9-5**: a page AI cited in earlier weekly checks and in neither of the last two is raised as a refresh, with the counts. **Earned media**: the exact third-party pages AI cited in answers that did not name the business, fetched (do they name you / your competitors?), one action per kind, drafts for the 3 most valuable (*AI Outreach Writer*), kept as prospects (`{PROSPECT_TABLE}` ai_source) for the Backlink Monitor's contacts and follow-ups. **Entity**: Wikidata monthly. Run row → `{AI_GROWTH_TABLE}`; report e-mail + callback `ai_growth`. Cost: Claude for the drafts (~$0.03 a site); everything else is free.""", [-40, -420], 1100, 300, 6)
G.write('SEO_Agent_AI_Growth.json')

# =============================================================================
# 5. LINK BUILDER (v4.13, LINK_BUILDER_SPEC.md): getting links, not only listing them — new opportunities, qualification, contacts, our page
#    and the link text, drafted sequences (the web app sends them from the customer's mailbox), the listings checklist, redirects, impact
# =============================================================================
def x_http(W, name, pos, url='={{ $json.url }}', batch=1, interval=300, timeout=30000, headers=None, cred=None, text=False, method='GET', body=None):
    params = {'method': method, 'url': url, 'options': {'batching': {'batch': {'batchSize': batch, 'batchInterval': interval}}, 'timeout': timeout, 'redirect': {'redirect': {'followRedirects': True, 'maxRedirects': 10}},
        'response': {'response': ({'fullResponse': True, 'neverError': True, 'responseFormat': 'text'} if text else {'neverError': True})}}}
    if headers: params.update({'sendHeaders': True, 'headerParameters': {'parameters': [{'name': k, 'value': v} for k, v in headers.items()]}})
    if body: params.update({'sendBody': True, 'specifyBody': 'json', 'jsonBody': body})
    extra = {}
    if cred: kind, cid, cname = cred; params.update({'authentication': 'genericCredentialType', 'genericAuthType': kind}); extra['credentials'] = {kind: {'id': cid, 'name': cname}}
    return W.node(name, 'n8n-nodes-base.httpRequest', 4.5, params, pos, onError='continueRegularOutput', **retry_lint.RETRY, **extra)   # G1: the one retry rule
LB_UA = 'SEOAgentLinkBuilder/4.13 (' + BRAND + '; link opportunities; mailto:' + OPS_EMAIL + ')'
PAGE_H = {'User-Agent': BROWSER_UA, 'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.8'}
API_KEY_CRED = {'httpHeaderAuth': {'id': 'SEOcredApiHeader', 'name': 'SEO API Key'}}
from ladder_common import PAGES_TABLE   # R93 (2026-10-16): the Link Builder reads the page inventory for our pages' real titles
L = WF('SEOagentLinkBld1', 'SEO Agent — Link Builder', 'linkbld', 3600)
L.node('Manual Run', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, {'inputSource': 'passthrough'}, at(0, 1))
ens = [('Ensure Monitors Table', MONITORS_TABLE, MONITORS_COLS), ('Ensure Prospects Table', PROSPECT_TABLE, PROSPECT_COLS), ('Ensure Link Outreach Table', LINK_OUTREACH_TABLE, LINK_OUTREACH_COLS),
       ('Ensure Listings Table', LISTINGS_TABLE, LISTINGS_COLS), ('Ensure Link Impact Table', LINK_IMPACT_TABLE, LINK_IMPACT_COLS), ('Ensure Cache Table', CACHE_TABLE, CACHE_COLS)]
for i, (nm, t, c) in enumerate(ens): L.ensure(nm, t, c, at(1 + i, 0))
loads = [('Load Sites', SITES_TABLE), ('Load Ladders', LADDER_TABLE), ('Load Monitors', MONITORS_TABLE), ('Load Profiles', PROFILE_TABLE), ('Load Link Prospects', PROSPECT_TABLE), ('Load Link Outreach', LINK_OUTREACH_TABLE),
         ('Load Listings', LISTINGS_TABLE), ('Load Link Impact', LINK_IMPACT_TABLE), ('Load Backlinks', LINKS_TABLE), ('Load Backlink Snapshots', BL_SNAP_TABLE), ('Load Content Log', LOG_TABLE), ('Load AI Targets', AI_TARGETS_TABLE),
         ('Load Pages (LB)', PAGES_TABLE), ('Load AI Visibility (LB)', AI_VIS_TABLE), ('Load Cycles', CYCLES_TABLE)]   # 2026-10-19: the website's time zone (pitches per page per month). C-2 (2026-10-17): the AI-named rivals. R93 (2026-10-16): our pages' real titles (seo_pages), so a target page is never named by a search query
for i, (nm, t) in enumerate(loads): L.load(nm, t, at(1 + i, 1))
L.node('Load Query History', DT_TYPE, DT_VERSION, dt_get_all_where_params(QUERY_TABLE, [('period_end', 'gte', SINCE(200))]), at(13, 1), **LOAD)
L.node('Load Rank History', DT_TYPE, DT_VERSION, dt_get_all_where_params(HISTORY_TABLE, [('checked_at', 'gte', SINCE(60))]), at(14, 1), **LOAD)
L.node('Load Cache (Links)', DT_TYPE, DT_VERSION, dt_get_where_params(CACHE_TABLE, 'kind', 'eq', 'linkbld'), at(15, 1), **LOAD)
L.node('Load Cache (LB Rivals)', DT_TYPE, DT_VERSION, dt_get_where_params(CACHE_TABLE, 'kind', 'eq', 'ai'), at(15, 2), **LOAD)   # C-2: the Answer Analyst's learned names (ai_brands:)
L.code('LB Plan', 'LB_Plan.js', at(16, 1)); L.iff('Any Sites (LB)?', '{{ !$json.nothing_to_do }}', at(17, 1)); L.node('Nothing To Do (LB)', 'n8n-nodes-base.noOp', 1, {}, at(18, 2))
L.code('LB Source Requests', 'LB_Source_Requests.js', at(18, 0)); x_http(L, 'Fetch LB Sources', at(19, 0), interval=1500, text=True, headers={'User-Agent': LB_UA, 'Accept': 'application/json'})
L.code('LB DFS Requests', 'LB_DFS_Requests.js', at(20, 0)); L.iff('Any LB DFS?', '{{ !$json.skip }}', at(21, 0)); L.dfs_http('Run LB DFS', at(22, -1), timeout=120000)
L.code('LB Page Requests', 'LB_Page_Requests.js', at(23, 0)); L.iff('Any LB Pages?', '{{ !$json.skip }}', at(24, 0)); x_http(L, 'Fetch LB Pages', at(25, -1), batch=4, interval=300, timeout=20000, text=True, headers=PAGE_H)
L.code('LB Second Requests', 'LB_Second_Requests.js', at(26, 0)); L.iff('Any LB Second?', '{{ !$json.skip }}', at(27, 0)); x_http(L, 'Fetch LB Second', at(28, -1), batch=6, interval=200, timeout=12000, text=True, headers=PAGE_H)
L.code('LB Assemble', 'LB_Assemble.js', at(29, 0))
L.code('LB Writer Input', 'LB_Writer_Input.js', at(30, 0)); L.iff('Any LB Writing?', '{{ !$json.skip }}', at(31, 0))
L.agent('Outreach Sequence Writer', 'link_outreach.txt', {'type': 'object', 'properties': {'sequences': {'type': 'array', 'items': {'type': 'object', 'properties': {'n': {'type': 'number'}, 'subject_b': {'type': 'string'}, 'steps': {'type': 'array', 'items': {'type': 'object', 'properties': {'step': {'type': 'number'}, 'subject': {'type': 'string'}, 'body': {'type': 'string'}}, 'required': ['step', 'body']}}}, 'required': ['n', 'steps']}},
    'skip': {'type': 'array', 'items': {'type': 'object', 'properties': {'n': {'type': 'number'}, 'reason': {'type': 'string'}}, 'required': ['n']}}}, 'required': ['sequences']}, at(32, -1), max_tokens=16000)
L.code('LB Draft QA', 'LB_Draft_QA.js', at(33, -1))   # L2 (system review 2026-10-11): the deterministic gate every drafted e-mail passes
L.code('LB Rows', 'LB_Rows.js', at(33, 0))
def l_rows(name, comment, key, cols, pos):
    L.code(name, '// ' + comment + ' (exact columns)\nconst COLS = ' + json.dumps([c for c, _ in cols]) + ";\nconst rows = $('LB Rows').all().flatMap(i => i.json." + key + " || []).map(r => Object.fromEntries(COLS.map(c => [c, r[c] === undefined ? null : r[c]])));\nreturn rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];", pos)
l_rows('Outreach Rows', 'Qualified prospects, contacts, our page, the link text and the drafted sequences (seo_link_outreach, upsert by site + prospect + type)', 'outreach_rows', LINK_OUTREACH_COLS, at(34, 0)); L.iff('Any Outreach Rows?', '{{ !$json.skip }}', at(35, 0))
L.node('Save Link Outreach', DT_TYPE, DT_VERSION, dt_upsert_params_keys(LINK_OUTREACH_TABLE, LINK_OUTREACH_COLS, ['site_id', 'prospect_domain', 'type']), at(36, -1), onError='continueRegularOutput')
l_rows('LB Prospect Rows', 'New prospects of the new kinds (journalist requests, resource pages, broken links; seo_link_prospects, upsert by site + domain + type)', 'prospect_rows', PROSPECT_COLS, at(37, 0)); L.iff('Any LB Prospects?', '{{ !$json.skip }}', at(38, 0))
L.node('Save LB Prospects', DT_TYPE, DT_VERSION, dt_upsert_params_keys(PROSPECT_TABLE, PROSPECT_COLS, ['site_id', 'prospect_domain', 'type']), at(39, -1), onError='continueRegularOutput')
l_rows('Listing Rows', 'The listings checklist (seo_listings, upsert by site + listing)', 'listing_rows', LISTINGS_COLS, at(40, 0)); L.iff('Any Listing Rows?', '{{ !$json.skip }}', at(41, 0))
L.node('Save Listings', DT_TYPE, DT_VERSION, dt_upsert_params_keys(LISTINGS_TABLE, LISTINGS_COLS, ['site_id', 'listing_id']), at(42, -1), onError='continueRegularOutput')
l_rows('Impact Rows', 'What each won link and each page change did for its page (seo_link_impact, kind link | page_change, upsert by site + linking site + page)', 'impact_rows', LINK_IMPACT_COLS, at(43, 0)); L.iff('Any Impact Rows?', '{{ !$json.skip }}', at(44, 0))
L.node('Save Link Impact', DT_TYPE, DT_VERSION, dt_upsert_params_keys(LINK_IMPACT_TABLE, LINK_IMPACT_COLS, ['site_id', 'ref_domain', 'target_url']), at(45, -1), onError='continueRegularOutput')
l_rows('LB Cache Rows', 'When the monthly searches last ran (seo_cache linkbld:<site>)', 'cache_rows', CACHE_COLS, at(46, 0)); L.iff('Any LB Cache?', '{{ !$json.skip }}', at(47, 0))
L.node('Save LB Cache', DT_TYPE, DT_VERSION, dt_upsert_params_keys(CACHE_TABLE, CACHE_COLS, ['key']), at(48, -1), onError='continueRegularOutput')
L.code('LB Report', 'LB_Report.js', at(49, 0))
# L3 (2026-10-13, FIX_PLAN.md L3; criterion REP 3.6): the whole week as one printable document -> PDF through Gotenberg, as the AI (l.164)
# and backlink (l.296) reports do. The e-mail keeps its summary HTML (json.html) and attaches the PDF; a renderer failure leaves the run
# intact (Render PDF LB is continueRegularOutput) and the HTML document goes out instead. The callback carries the PDF for the app.
L.code('LB Doc', 'LB_Doc.js', at(50, 0)); L.pdf_chain('LB', at(51, 0))
L.code('Build LB Callback', 'Build_LB_Callback.js', at(54, 1))
L.deliver('LB', at(54, 0), "={{ $binary.pdf ? 'pdf' : 'data' }}")
L.chain(*[e[0] for e in ens], *[l[0] for l in loads], 'Load Query History', 'Load Rank History', 'Load Cache (Links)', 'Load Cache (LB Rivals)', 'LB Plan', 'Any Sites (LB)?'); L.link('Manual Run', ens[0][0])
L.link('Any Sites (LB)?', 'LB Source Requests', 0); L.link('Any Sites (LB)?', 'Nothing To Do (LB)', 1)
L.chain('LB Source Requests', 'Fetch LB Sources', 'LB DFS Requests')
def lstep(code, iff, http, nxt): L.link(code, iff); L.link(iff, http, 0); L.link(iff, nxt, 1); L.link(http, nxt)
lstep('LB DFS Requests', 'Any LB DFS?', 'Run LB DFS', 'LB Page Requests')
lstep('LB Page Requests', 'Any LB Pages?', 'Fetch LB Pages', 'LB Second Requests')
lstep('LB Second Requests', 'Any LB Second?', 'Fetch LB Second', 'LB Assemble')
L.chain('LB Assemble', 'LB Writer Input')
L.link('LB Writer Input', 'Any LB Writing?'); L.link('Any LB Writing?', 'Outreach Sequence Writer', 0); L.link('Any LB Writing?', 'LB Rows', 1)
L.chain('Outreach Sequence Writer', 'LB Draft QA', 'LB Rows')   # L2: the writer's sequences are checked before they reach the rows
L.link('LB Rows', 'Outreach Rows')
lstep('Outreach Rows', 'Any Outreach Rows?', 'Save Link Outreach', 'LB Prospect Rows')
lstep('LB Prospect Rows', 'Any LB Prospects?', 'Save LB Prospects', 'Listing Rows')
lstep('Listing Rows', 'Any Listing Rows?', 'Save Listings', 'Impact Rows')
lstep('Impact Rows', 'Any Impact Rows?', 'Save Link Impact', 'LB Cache Rows')
lstep('LB Cache Rows', 'Any LB Cache?', 'Save LB Cache', 'LB Report')
L.chain('LB Report', 'LB Doc', 'Prepare PDF LB', 'Render PDF LB', 'Attach PDF LB')   # L3
L.link('Attach PDF LB', 'Has Email (LB)?'); L.link('Attach PDF LB', 'Build LB Callback'); L.link('Build LB Callback', 'Has Callback (LB)?')
# R82 (2026-10-16, re-rating C-6): the Link Builder settled its $0.05 reservation "ESTIMATED" while *Run LB DFS* reported $0.0498. Its
# one paid call is measured now from the gate's merged answers (each answer's own `__dfs_cost_usd`); the leading '!' says it is the
# workflow's ONLY paid call, so a week with no DataForSEO pull settles $0 rather than the reservation.
L.run_ledger('link_builder', 'LB', 'LB Plan', ['LB Report'], at(17, 4), measured='!Run LB DFS Answers')
# B-A10 (2026-10-15, INVARIANTS rule 3): the one paid DataForSEO pull of the week's link building — competitors' broken links
# and their most-linked pages. A failure inside a 200 is a week with fewer opportunities and nobody told; the whole point of
# this workflow is the pitch it ends with, so the evidence behind one has to be evidence that was really read.
L.in200_gate('Run LB DFS', "the competitors' links and most-linked pages this week's opportunities come from", 'pull')
L.sticky(f"""## SEO Agent — Link Builder (v4.13, LINK_BUILDER_SPEC.md)
**Once a week in each website's own cycle** (job 7: after the Backlink Monitor and AI Growth; *Manual Run* {CYCLE_ENTRY}) and on demand (*Manual Run* `{{{{ domain | site_id, free_only?, callback_url?, request_id? }}}}`, started by **SEO Agent — Link Builder API** `POST /webhook/seo-link-builder`). Per site with `link_builder` on (`{MONITORS_TABLE}`, default on).
**New opportunities** (free): journalist requests (#journorequest on Bluesky, matched to the topics), **journalist digests** (HARO / Source of Sources, read from the customer's own mailbox by the web app and written here as `digest` prospects — nothing arrives until a mailbox is connected), **podcast shows that take guests** (monthly: a free podcast directory → the show's RSS feed → the show's own website; pitched only when it is on topic, still publishing, says it takes guests and has a contact on its own domain), resource pages (web search), dead links on resource / list pages, our old URLs from the Wayback Machine that now 404 (redirects), the listings checklist (own and competitors' pages, member lists, guessed profiles); monthly **competitors' broken backlinks** and their **most-linked pages** (DataForSEO, ≈ $0.07 + ≈ $0.02 a competitor) — the second gives the **linkable-asset ideas** (data study / free tool / template / definitive guide), each tied to the competitor pages that prove it and the referring domains they hold, and never a promise of links. **Every prospect** (also the Backlink Monitor's and AI Growth's) qualified (gone / blocked / sells links / language / already linking), with the evidence to quote, up to 3 contacts, the recipient's country, **our page and the link text** (topic match × position band × links needed, paced). **Outreach Sequence Writer** (Claude): ≤ 10 sequences a week (first e-mail + 2 follow-ups; journalists: 1), then the **draft gate** (*LB Draft QA*, L2): claims against the facts on file, no bracket left to fill, the address on their own domain, a real quote from their page, one link to the page we chose on the canonical host, length and one clear ask, the words we never use, the business name as the site model has it — a draft that fails is held as `needs_edit` with its reasons. **Two subjects a batch** (L7): the writer gives every sequence a second subject in the other style, the drafts take the two in turn (A, B, A, B …) and the app shows the reply rate per style — with **no verdict under 30 first e-mails per variant**. Nothing is sent here: the **web app** sends from the customer's own mailbox after approval.
Rows: `{LINK_OUTREACH_TABLE}`, `{PROSPECT_TABLE}` (new kinds), `{LISTINGS_TABLE}`, `{LINK_IMPACT_TABLE}` (what each won link did, vs the site's other pages), `{CACHE_TABLE}` linkbld:; report + callback `link_builder`.
**The week as a PDF** (L3): *LB Doc* writes the whole week as one printable document — what to do this week, every opportunity with its qualification, the contacts found on the prospects' own domains, our page and the link text per prospect, each drafted sequence with its status (a held one with the reasons), the listings checklist, the redirects, what the links and the page changes did, and where every figure came from — and *Render PDF LB* turns it into a PDF through Gotenberg: attached to the e-mail and carried in the callback, so the app offers it like the other reports' PDFs. A renderer failure never fails the run (the HTML document goes out instead).""", [-40, -420], 1100, 320, 6)
L.write('SEO_Agent_Link_Builder.json')

# =============================================================================
# 5b. LINK BUILDER API (v4.13): the web app's "Find opportunities now" — answered at once (202), the Link Builder starts as its own
#     execution through its Manual Run. A separate workflow: n8n starts a workflow that calls ITSELF from the inherited webhook trigger and
#     runs nothing (live 2026-10-11, execution 293), so the door and the work are two workflows, like the Admin API and Site Admin.
# =============================================================================
LA = WF('SEOagentLinkBAPI', 'SEO Agent — Link Builder API', 'linkbapi', 120)
LA.node('Link Builder API', 'n8n-nodes-base.webhook', 2, {'httpMethod': 'POST', 'path': 'seo-link-builder', 'authentication': 'headerAuth', 'responseMode': 'responseNode', 'options': {}}, at(0, 4), webhookId=str(uuid.uuid5(NS, 'linkbapi:webhook')), credentials=API_KEY_CRED)
LA.code('LB API Validate', 'LB_API_Validate.js', at(1, 4)); LA.iff('LB API OK?', '{{ $json.ok }}', at(2, 4))
LA.node('Respond LB Accepted', 'n8n-nodes-base.respondToWebhook', 1.1, {'respondWith': 'json', 'responseBody': "={{ JSON.stringify({ ok: true, status: 'accepted', stage: 'link_builder_started', request_id: $json.request_id, domain: $json.domain }) }}", 'options': {'responseCode': 202}}, at(3, 3))
LA.code('LB Payload', "// The run's input (Manual Run of the Link Builder): only the fields it reads.\nconst v = $('LB API Validate').first().json;\nreturn [{ json: { domain: v.domain, site_id: v.site_id, free_only: v.free_only, callback_url: v.callback_url, email: '', request_id: v.request_id } }];", at(4, 3))
LA.node('Start Link Builder', 'n8n-nodes-base.executeWorkflow', 1.2, {'source': 'database', 'workflowId': {'__rl': True, 'mode': 'id', 'value': 'SEOagentLinkBld1'}, 'mode': 'once', 'options': {'waitForSubWorkflow': False}}, at(5, 3))
LA.node('Respond LB Bad Request', 'n8n-nodes-base.respondToWebhook', 1.1, {'respondWith': 'json', 'responseBody': '={{ JSON.stringify({ ok: false, error: $json.error }) }}', 'options': {'responseCode': 400}}, at(3, 5))
# answer first, then start the run (the API entry's order): a sub-workflow started before the webhook answers ran no node (live 2026-10-11, executions 295 / 297)
LA.chain('Link Builder API', 'LB API Validate', 'LB API OK?'); LA.link('LB API OK?', 'Respond LB Accepted', 0); LA.link('LB API OK?', 'Respond LB Bad Request', 1)
LA.chain('Respond LB Accepted', 'LB Payload', 'Start Link Builder')
LA.sticky("""## SEO Agent — Link Builder API (v4.13)
`POST /webhook/seo-link-builder` (header X-API-Key, credential **SEO API Key**): `{ domain | site_id, free_only?, callback_url?, request_id? }` → 202 at once; starts **SEO Agent — Link Builder** (`SEOagentLinkBld1`) through its Manual Run; the report arrives through the callback (stage `link_builder`).""", [-40, -300], 700, 160, 6)
LA.write('SEO_Agent_Link_Builder_API.json')

# =============================================================================
# 5c. SITE KICKOFF (2026-10-19; rewritten the same day for the per-website cycle, SCHEDULING_KEYWORDS_PLAN.md §4.7 / §14.3): the web app
#     calls it once "Track my site" is set up. It no longer starts the weekly jobs itself - a restart killed its chain of waiting
#     sub-workflows and nobody resumed it - it writes the website's seo_cycles row (anchor, time zone, cycle 0 due now, what the app already
#     ran) and the Cycle Dispatcher (build_cycle.py) starts cycle 0 within five minutes with the scheduled semantics. Answered after the
#     write, so the answer carries the cycle key and the due time; a refusal is answered 409 with its reason, a failed save 500.
# =============================================================================
from ladder_common import CYCLES_TABLE, CYCLES_COLS, CATCHUP_SRC
_KO_TZ = (ENV.get('GENERIC_TIMEZONE') or '').strip() or 'America/New_York'   # the engine's zone: the default for a website that sends none
_KO_COLS = json.dumps([c for c, _t in CYCLES_COLS])
def _ko_src(f):
    """A kickoff node's source with the catch-up's time rule and the cycle kit inlined (the dispatcher's own newCycleRow builds the row)."""
    s = (rd('code/' + f).replace('/*__CATCHUP__*/', CATCHUP_SRC).replace('/*__CYCLE__*/', rd('code/_cycle.js').rstrip('\n'))
         .replace('__TZ__', _KO_TZ).replace('__CYCLES_COLS__', _KO_COLS))
    assert '/*__' not in s and '__TZ__' not in s and '__CYCLES_COLS__' not in s, f + ': placeholder left'
    return s
KO = WF('SEOagentKickoff1', 'SEO Agent — Site Kickoff', 'kickoff', 120)
KO.node('Site Kickoff API', 'n8n-nodes-base.webhook', 2, {'httpMethod': 'POST', 'path': 'seo-site-kickoff', 'authentication': 'headerAuth', 'responseMode': 'responseNode', 'options': {}}, at(0, 4), webhookId=str(uuid.uuid5(NS, 'kickoff:webhook')), credentials=API_KEY_CRED)
KO.code('Kickoff Validate', _ko_src('Kickoff_Validate.js'), at(1, 4)); KO.iff('Kickoff OK?', '{{ $json.ok }}', at(2, 4))
KO.node('Respond Kickoff Bad Request', 'n8n-nodes-base.respondToWebhook', 1.1, {'respondWith': 'json', 'responseBody': '={{ JSON.stringify({ ok: false, error: $json.error }) }}', 'options': {'responseCode': 400}}, at(3, 5))
KO.ensure('Ensure Cycles (Kickoff)', CYCLES_TABLE, CYCLES_COLS, at(3, 3))
KO.load('Load Sites (Kickoff)', SITES_TABLE, at(4, 3))
KO.load('Load Cycles (Kickoff)', CYCLES_TABLE, at(5, 3))
KO.code('Kickoff Plan', _ko_src('Kickoff_Plan.js'), at(6, 3)); KO.iff('Kickoff Refused?', '{{ $json.refused === true }}', at(7, 3))
KO.node('Respond Kickoff Refused', 'n8n-nodes-base.respondToWebhook', 1.1, {'respondWith': 'json', 'responseBody': "={{ JSON.stringify({ ok: false, status: 'refused', stage: 'site_kickoff_refused', code: $json.code, error: $json.reason, domain: $json.domain, site_id: $json.site_id, request_id: $json.request_id }) }}", 'options': {'responseCode': 409}}, at(8, 2))
KO.iff('Kickoff Dry Run?', '{{ $json.dry_run === true }}', at(8, 4))
KO.node('Respond Kickoff Dry Run', 'n8n-nodes-base.respondToWebhook', 1.1, {'respondWith': 'json', 'responseBody': "={{ JSON.stringify({ ok: true, status: 'dry_run', stage: 'site_kickoff_dry_run', site_id: $json.site_id, domain: $json.domain, cycle_key: $json.cycle_key, next_due_at: $json.next_due_at, exists: $json.exists, would_write: $json.row, request_id: $json.request_id }) }}", 'options': {'responseCode': 200}}, at(9, 3))
# the row, exact seo_cycles columns (a Data Table upsert maps every input field), upserted by site_id
KO.code('Kickoff Cycle Row', "// the website's seo_cycles row as the plan built it, exact columns (upserted by site_id)\nconst COLS = " + _KO_COLS + ";\nconst r = $('Kickoff Plan').first().json.row || {};\nreturn [{ json: Object.fromEntries(COLS.map(c => [c, r[c]])) }];", at(9, 5))
KO.node('Save Kickoff Cycle', DT_TYPE, DT_VERSION, dt_upsert_params(CYCLES_TABLE, CYCLES_COLS, 'site_id'), at(10, 5), onError='continueRegularOutput', alwaysOutputData=True)
KO.code('Kickoff Saved', "// the answer is given only after the row is saved: a save that failed is a 500 with the reason (nothing will start), never a 202\nconst p = $('Kickoff Plan').first().json; const s = $input.first().json || {};\nconst ok = !s.error && (String(s.site_id || '') === p.site_id || Number(s.id) > 0);\nconst { row, ...rest } = p;\nreturn [{ json: { ...rest, saved: ok, error: ok ? '' : 'the cycle row of ' + p.domain + ' could not be saved (' + String((s.error && (s.error.message || s.error)) || 'no row came back').slice(0, 160) + '): nothing will start; send the kickoff again' } }];", at(11, 5))
KO.iff('Kickoff Saved?', '{{ $json.saved === true }}', at(12, 5))
KO.node('Respond Kickoff Accepted', 'n8n-nodes-base.respondToWebhook', 1.1, {'respondWith': 'json', 'responseBody': "={{ JSON.stringify({ ok: true, status: 'accepted', stage: 'site_kickoff_started', site_id: $json.site_id, cycle_key: $json.cycle_key, next_due_at: $json.next_due_at, domain: $json.domain, request_id: $json.request_id }) }}", 'options': {'responseCode': 202}}, at(13, 4))
KO.node('Respond Kickoff Failed', 'n8n-nodes-base.respondToWebhook', 1.1, {'respondWith': 'json', 'responseBody': "={{ JSON.stringify({ ok: false, status: 'error', stage: 'site_kickoff_failed', error: $json.error, site_id: $json.site_id, request_id: $json.request_id }) }}", 'options': {'responseCode': 500}}, at(13, 6))
KO.chain('Site Kickoff API', 'Kickoff Validate', 'Kickoff OK?'); KO.link('Kickoff OK?', 'Ensure Cycles (Kickoff)', 0); KO.link('Kickoff OK?', 'Respond Kickoff Bad Request', 1)
KO.chain('Ensure Cycles (Kickoff)', 'Load Sites (Kickoff)', 'Load Cycles (Kickoff)', 'Kickoff Plan', 'Kickoff Refused?')
KO.link('Kickoff Refused?', 'Respond Kickoff Refused', 0); KO.link('Kickoff Refused?', 'Kickoff Dry Run?', 1)
KO.link('Kickoff Dry Run?', 'Respond Kickoff Dry Run', 0); KO.link('Kickoff Dry Run?', 'Kickoff Cycle Row', 1)
KO.chain('Kickoff Cycle Row', 'Save Kickoff Cycle', 'Kickoff Saved', 'Kickoff Saved?'); KO.link('Kickoff Saved?', 'Respond Kickoff Accepted', 0); KO.link('Kickoff Saved?', 'Respond Kickoff Failed', 1)
KO.sticky("""## SEO Agent — Site Kickoff (2026-10-19; the per-website cycle, SCHEDULING_KEYWORDS_PLAN.md §4.7)
`POST /webhook/seo-site-kickoff` (header X-API-Key, credential **SEO API Key**): `{ domain | site_id, anchor_at?, tz?, skip_jobs?, jobs?, force?, dry_run?, request_id? }`. For a website the engine tracks and that is not paused, it writes the website's **`seo_cycles`** row: `anchor_at` (default now; within the last 6 days), the owner's time zone `tz` (default the engine's; an unknown zone is refused 400), weekday = the anchor's local weekday, cycles at 06:00 local, monthly day = the anchor's day (at most the 28th), **cycle 0 due at the anchor**, and `skip_jobs` (what the app already ran; the old `jobs` = only these, so every other job is skipped in cycle 0). The **Cycle Dispatcher** starts cycle 0 within five minutes, job by job, with the scheduled semantics. Answer **202** `{ ok, status: 'accepted', stage: 'site_kickoff_started', site_id, cycle_key, next_due_at }` once the row is saved; **409** with the reason when refused (not tracked, paused, already started without `force`); **500** when the save failed; `dry_run: true` writes nothing and answers 200 with the row it would write. `force: true` starts cycle 0 again from the new anchor (the same local day is the same cycle, so a job already done is not run twice).""", [-40, -300], 900, 240, 6)
KO.write('SEO_Agent_Site_Kickoff.json')

# =============================================================================
# 6. REPLY READER (v4.13): the web app sends one reply to a link-building e-mail; Claude Haiku classifies it and suggests the answer;
#    pages named in the reply are checked for our link at once (synchronous; POST /webhook/seo-reply-read, header X-API-Key)
# =============================================================================
RR = WF('SEOagentReplyRd1', 'SEO Agent — Reply Reader', 'replyrd', 180)
RR.node('Reply Webhook', 'n8n-nodes-base.webhook', 2, {'httpMethod': 'POST', 'path': 'seo-reply-read', 'authentication': 'headerAuth', 'responseMode': 'responseNode', 'options': {}}, at(0, 0), webhookId=str(uuid.uuid5(NS, 'replyrd:webhook')), credentials=API_KEY_CRED)
RR.code('Reply Input', 'Reply_Input.js', at(1, 0)); RR.iff('Reply OK?', '{{ $json.ok }}', at(2, 0))
RR.code('Reply Link Requests', 'Reply_Link_Requests.js', at(3, 0)); RR.iff('Any Reply Pages?', '{{ !$json.skip }}', at(4, 0)); x_http(RR, 'Fetch Reply Pages', at(5, -1), timeout=15000, text=True, headers=PAGE_H)
RR.code('Reply Classify Input', 'Reply_Classify_Input.js', at(6, 0))
RR.agent('Reply Reader', 'reply_reader.txt', {'type': 'object', 'properties': {'class': {'type': 'string'}, 'summary': {'type': 'string'}, 'return_date': {'type': 'string'}, 'referral_email': {'type': 'string'}, 'referral_name': {'type': 'string'}, 'needs_you': {'type': 'boolean'}, 'suggested_reply': {'type': 'string'}}, 'required': ['class', 'summary']},
    at(7, -1), max_tokens=1500, model=('claude-haiku-4-5-20251001', 'Claude Haiku 4.5'))
RR.code('Reply Result', 'Reply_Result.js', at(8, 0))
RR.node('Respond Reply', 'n8n-nodes-base.respondToWebhook', 1.1, {'respondWith': 'json', 'responseBody': '={{ JSON.stringify($json) }}', 'options': {'responseCode': 200}}, at(9, 0))
RR.node('Respond Reply Bad Request', 'n8n-nodes-base.respondToWebhook', 1.1, {'respondWith': 'json', 'responseBody': '={{ JSON.stringify({ ok: false, error: $json.error }) }}', 'options': {'responseCode': 400}}, at(3, 2))
RR.code('Reply Plan', '// W3-F: the request that passed the check - the run ledger reserves its row here, before the first model call\nreturn $input.all();', at(2, 1))
RR.chain('Reply Webhook', 'Reply Input', 'Reply OK?'); RR.link('Reply OK?', 'Reply Plan', 0); RR.link('Reply OK?', 'Respond Reply Bad Request', 1); RR.link('Reply Plan', 'Reply Link Requests')
RR.link('Reply Link Requests', 'Any Reply Pages?'); RR.link('Any Reply Pages?', 'Fetch Reply Pages', 0); RR.link('Any Reply Pages?', 'Reply Classify Input', 1); RR.link('Fetch Reply Pages', 'Reply Classify Input')
RR.chain('Reply Classify Input', 'Reply Reader', 'Reply Result', 'Respond Reply')
# W3-F (2026-10-17): the Reply Reader's Haiku call was recorded nowhere - no seo_run_ledger row at all. The reservation sits on the main path behind the
# request check (a bad request reserves nothing), before the first model call; the settle runs beside the answer. `no_gate`: the web app is waiting
# for the answer, so what else is running never refuses a reply (the row is still kept, and counted, like any other).
RR.run_ledger('reply_read', 'Reply', 'Reply Plan', ['Reply Result'], at(10, 4))
LEDGER_WIRING[RR.name]['no_gate'] = True; LEDGER_WIRING[RR.name]['no_dfs'] = True   # no DataForSEO here: the two balance probes are no-ops
RR.sticky("""## SEO Agent — Reply Reader (v4.13, LINK_BUILDER_SPEC.md §2)
`POST /webhook/seo-reply-read` (header X-API-Key, credential **SEO API Key**), synchronous. Body: `{ domain, prospect_domain, page_url?, business, signer, facts?, our_subject, our_body, reply_from, reply_subject, reply_text }`. The web app calls it for every reply a person wrote (bounces and automatic replies are sorted by headers in the app). Pages on the prospect's site named in the reply (and the page we pitched) are fetched and checked for our link at once. **Claude Haiku 4.5** (≈ $0.001): class (says_linked / interested / question / wants_payment / link_swap / not_now / declined / unsubscribe / wrong_person / out_of_office / other), one-line summary, return date, referred contact, suggested answer. An opt-out is never missed (rule fallback).""", [-40, -360], 900, 220, 6)
RR.write('SEO_Agent_Reply_Reader.json')

# R9: the monitors' ledger wiring goes into the same harness file the main workflow's wiring uses (S36 / S57)
_lw9 = os.path.join(HERE, 'harness', 'ledger_wiring.json')
_lwj = json.load(open(_lw9)) if os.path.exists(_lw9) else {}
_lwj.setdefault('monitors', {}).update(LEDGER_WIRING)   # the Rank Tracker and the Site Tracker add their own rows from their builders
json.dump(_lwj, open(_lw9, 'w'), indent=1, sort_keys=True)
print('ledger wiring: ' + str(len(LEDGER_WIRING)) + ' scheduled workflows reserve and settle a run-ledger row')

# the harness compares rows with the table columns defined here (v4.12): harness/table_cols.json
from ladder_common import RUN_LEDGER_COLS, SITES_COLS, PAGES_COLS, LADDER_COLS, HISTORY_COLS   # v4.14 (D1); v4.15 (G19) site model + page inventory; P2-7 ladder word target; v4.16 (G6) rank history
from ladder_common import CHECKIN_COLS, OPS_ALERTS_COLS, AUDIT_FINDINGS_COLS   # D25c / D25b / G26 (2026-10-12)
from ladder_common import PAGE_WATCH_COLS, ALERTS_COLS   # G11 + G25 (2026-10-13): the daily key-page watch rows and the alert rows it writes
from ladder_common import PROFILE_COLS   # G31 (2026-10-13): the business profile row, now with the stored style guide
json.dump({'RUN_LEDGER': [c for c, _ in RUN_LEDGER_COLS], 'AI_PAGES': [c for c, _ in AI_PAGES_COLS], 'AI_TARGETS': [c for c, _ in AI_TARGETS_COLS], 'AI_GROWTH': [c for c, _ in AI_GROWTH_COLS], 'PROSPECT': [c for c, _ in PROSPECT_COLS],
           'CACHE': [c for c, _ in CACHE_COLS], 'AI_ANSWERS': [c for c, _ in AI_ANSWERS_COLS], 'AI_PROMPTS': [c for c, _ in AI_PROMPTS_COLS], 'MONITORS': [c for c, _ in MONITORS_COLS], 'LINK_OUTREACH': [c for c, _ in LINK_OUTREACH_COLS], 'LISTINGS': [c for c, _ in LISTINGS_COLS], 'LINK_IMPACT': [c for c, _ in LINK_IMPACT_COLS], 'LINKS': [c for c, _ in LINKS_COLS], 'SITES': [c for c, _ in SITES_COLS], 'PAGES': [c for c, _ in PAGES_COLS],
           'LOG': [c for c, _ in LOG_COLS], 'LADDER': [c for c, _ in LADDER_COLS], 'HISTORY': [c for c, _ in HISTORY_COLS], 'AUDIT_FINDINGS': [c for c, _ in AUDIT_FINDINGS_COLS], 'CHECKIN': [c for c, _ in CHECKIN_COLS], 'OPS_ALERTS': [c for c, _ in OPS_ALERTS_COLS], 'PAGE_WATCH': [c for c, _ in PAGE_WATCH_COLS], 'CONSOLE_ALERTS': [c for c, _ in ALERTS_COLS], 'PROFILE': [c for c, _ in PROFILE_COLS]}, open(os.path.join(HERE, 'harness', 'table_cols.json'), 'w'), indent=1)   # G19 site model + D5 content log: the rows these nodes write

# ---- G6 (2026-10-18, AI_VISIBILITY_SPEC.md §10): ONE table of AI-panel cost cases, held by the engine and the app ----------------------
# v5/data/ai_panel_cost_cases.json is written by harness/ai_panel_cases.js from AIP.cost (v5/code/_ai_panel.js). It is copied to the harness
# (S211 runs every case through the generated AIP.cost) and to app/shared (cost.aipanel.test.ts runs every case through estimateAiPanelCost),
# so a price or a formula changed on one side and not the other fails a test on the side that did not change.
_g6 = json.load(open(os.path.join(V5, 'data', 'ai_panel_cost_cases.json'), encoding='utf-8'))
json.dump(_g6, open(os.path.join(HERE, 'harness', 'ai_panel_cost_cases.json'), 'w'), indent=1)
_g6_app = os.path.normpath(os.path.join(HERE, '..', '..', 'app', 'shared', 'src', 'ai-panel-cost-cases.generated.ts'))
if os.path.isdir(os.path.dirname(_g6_app)):
    open(_g6_app, 'w', encoding='utf-8').write('// GENERATED by n8n/seo-agent/build_monitors.py from n8n/seo-agent/v5/data/ai_panel_cost_cases.json - do not edit by hand.\n'
        '// G6 (2026-10-18): the golden cases of the AI-panel cost formula. The engine (AIP.cost, harness S211) and the app (estimateAiPanelCost,\n'
        '// cost.aipanel.test.ts) are both held to them; regenerate with `node harness/ai_panel_cases.js` after a price or formula change.\n'
        'export const AI_PANEL_COST_CASES = ' + json.dumps(_g6, indent=1, ensure_ascii=False) + ' as const;\n')
_g6_rt = re.search(r"const PRICE = (\{[^}]+\});", rd('code/_ai_panel.js'))
assert _g6_rt and json.loads(re.sub(r'(\w+):', r'"\1":', _g6_rt.group(1))) == _g6['prices'], 'G6: v5/data/ai_panel_cost_cases.json is stale against AIP.PRICE - run node harness/ai_panel_cases.js'
print('G6: the AI-panel cost table (' + str(len(_g6['cases'])) + ' cases) copied to the harness and the app')
