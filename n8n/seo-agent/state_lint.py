"""INVARIANTS rule 4 (docs/system-review-2026-10-14/INVARIANTS.md): nothing is promised until it exists, and nothing exists until
it is delivered.

~8 of the 81 defects came from this one class, and they are the ones a customer feels directly: a page delivered with 50
placeholders (D10), and again with 12 after its own gate had failed twice (R11); a ladder row claiming a page nobody wrote (R1 --
`fix_phantom_pages.py` is still in the repository); a masked figure shipped without telling the owner (R25); 23 reports that
reached the app and no human (B-R1); an alert recorded as sent that was never sent (R6 / R30); a **404 from a revoked webhook
recorded as a delivery** (B-F2); Page Watch posting its digest and writing nothing back, so its rows sat `pending` for ever
(B-F3); and a draft 100% identical to a competitor's page that came out `publishable: true` / `not_ready: false` / "passed the
quality check", because the originality gate ran after *Content QA* had finalised those fields and flipped only an internal flag
(B3-3).

**The rule.** A record says a thing exists only when the thing exists, proven by the artefact and not by the run having started. A
delivery is complete when something outside the system acknowledges it. A quality gate that fails is a refusal, not a label.

**The lint.** Like `retry_lint.py`, `gate_lint.py` and `lineage_lint.py`, and like build section 55's ordering proof, it walks the
GENERATED workflows -- not the sources -- because that is where the question is decided: a guard is only a guard in the nodes it
was inlined into. Four checks:

  A. **promise**   a node may not mint a forward state (`written`, `published`) into a Data Table row without reading the evidence
                   for it. Two halves: the shared row builder `publishedRows()` must be HANDED the proof and refuses to advance
                   the state without it (a rule, no baseline), and a node that mints a forward state inline must carry the
                   evidence tokens for that state (a ratchet).
  B. **reversal**  a state that promises work in progress must have a way back: some node writes the row back to `planned` WITH a
                   reason, so a refused run cannot leave a row claiming a page nobody wrote (R1).
  C. **delivery**  a node may not write `delivered` to a value that means "somebody has it" without judging a status code, and an
                   HTTP node it reads may not be `neverError` without `fullResponse` -- that combination is literally how a 404
                   was recorded as a delivery (B-F2). A workflow that OPENS a delivery record must also contain the node that
                   settles it (B-F3).
  D. **verdict**   a gate that refuses must reach every field a consumer reads. B3-3 happened because `publishable`, `not_ready`
                   and `quality.label` were finalised by one node and the failing gate only touched another field, so the
                   filename, the package banner, `meta.json`, the callback and the app all said the page had passed.

**What it PROVES** (no baseline, a new breach fails the build): that no caller of the published-row builder can omit the proof;
that the builder still refuses without it; that the reversal path for a `writing` row exists; that no node can record a delivery
without reading a status code; that no delivery POST can be `neverError` without `fullResponse`; that a workflow which opens a
delivery record also settles it; and that no node downstream of a verdict node can touch one verdict field without setting all of
them.

**What it only RATCHETS**: check A's second half -- `harness/rule4_baseline.json` names every node that mints a forward state
inline without the evidence tokens, each with a `why`. And, inside a node that passes, the lint does not prove that the row it
wrote is the row the evidence covers: reading `statusCode` says the node was built to look, not that it looked at this page. The
app-side half of B-R1 (a report that reaches the app and no human) is enforced in `app/`, not here, and is out of this lint's
reach by construction -- it is named in the baseline's note rather than silently implied.
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
WF_DIR = os.path.join(HERE, 'workflows')
V5_CODE = os.path.join(HERE, 'v5', 'code')
BASELINE = os.path.join(HERE, 'harness', 'rule4_baseline.json')
RECORD = os.path.join(HERE, 'harness', 'rule4.json')
CODE_TYPE = 'n8n-nodes-base.code'
DT_TYPE = 'n8n-nodes-base.dataTable'
HTTP_TYPE = 'n8n-nodes-base.httpRequest'
WRITE_OPS = ('insert', 'upsert', 'update')
# the build's inputs, not its outputs: the v3 export is what build_v4.py reads, the callback receiver is kept by hand for tests
NOT_GENERATED = ('SEO_Agent_v3_original_export.json', 'SEO_Agent_Test_Callback_Receiver.json')

# A shared kit is inlined verbatim into every node that uses it and brings its own `status:` lines, its own `statusCode` and its
# own `delivered:` with it. gate_lint learnt this the hard way within hours of landing -- it counted a node that merely INLINED a
# kit as guarded -- so every question below is asked of the node's OWN code, with the `const XX = (() => { ... })();` kits cut out
# first. The one exception is stated where it is made: a question that is ABOUT a kit reads the whole source.
_KIT = re.compile(r'(?ms)^const [A-Z]{2,4} = \(\(\) => \{.*?^\}\)\(\);[ \t]*$')
_SHARED = None


def _shared_sources():
    """Every shared source in v5/code/ that the builders inline verbatim (`_*.js`), longest first so a kit that contains another
    is removed before its parts. Both the file as written and its rstripped form, because build_v4.py rstrips what it inlines and
    build_monitors.py does not -- the same two forms gate_lint cuts."""
    global _SHARED
    if _SHARED is None:
        out = []
        for f in sorted(os.listdir(V5_CODE)):
            if not f.startswith('_') or not f.endswith('.js'):
                continue
            s = open(os.path.join(V5_CODE, f), encoding='utf-8').read()
            if len(s) > 200:                      # a stub too short to matter would cut real code out of a node
                out.extend([s, s.rstrip('\n')])
        _SHARED = sorted(set(out), key=len, reverse=True)
    return _SHARED


def own_code(js):
    """The node's OWN code. Every shared kit comes out first.

    This is the hole gate_lint had within hours of landing, and A1 had it too until it was broken on purpose: renaming every
    `published_url` in *Site Plan* left the lint still finding `published_url` -- in `_page_watch.js`, which that node merely
    inlines. A node judged on text it did not write is a lint that lies."""
    for src in _shared_sources():
        if src in js:
            js = js.replace(src, '')
    return _KIT.sub('', js)


# ---- A. the forward states, and what proves each one ------------------------------------------------------------------------
# The state machine is `planned -> writing -> written -> published`. Only the two that CLAIM AN ARTEFACT EXISTS are evidence-
# bearing: `written` says a page was written, `published` says a page is live. `writing` claims work in progress, not a thing, and
# is covered by check B instead (its failure mode is a row that never comes back, which is R1).
PROMISES = [
    {'state': 'written',
     'evidence': ('article_html', 'page_markdown', "$('Blog Package')", "$('Build Word File')"),
     'why': 'D10 / R1: a row saying a page was written while no page was written is read by the ladder plan, the Rank Tracker and '
            "the Content Cadence as a page that exists -- the cadence paused itself on pages nobody had",
     'how': "read the artefact itself -- the page text from the node that produced it -- and emit no row when it is empty "
            "(*Content Log Row* does exactly this: no article_html and no page_markdown means 'report only')"},
    {'state': 'published',
     'evidence': ('statusCode', 'published_url', 'publishedRows(', 'detected'),
     'why': 'a row saying a page is live, written from the owner having SAID so, is the same promise with a different author',
     'how': 'read what proves the page is live: the status of a fetch of that URL, or a stored published_url something already '
            'confirmed'},
]

# The shared row builder. It is inlined by the build into *Publish Check* (the owner reports a page) and *Detect Published* (the
# Site Tracker finds one), so that a reported page and a detected page are stored identically -- which means a hole in it is a
# hole in both. The rule: it must be HANDED the proof, and it must refuse to advance the state without it.
BUILDERS = [
    {'name': 'publishedRows(', 'kit': '_publish_rows.js', 'proof': 'live',
     # the needles are CODE, never prose: `o.live` alone was satisfied by the kit's own comment, which proves nothing
     'defines': ('function publishedRows(', 'const live = o.live === true;'),
     'refuses': ("status: live ? 'published'",),
     'why': "*Publish Check* called it unconditionally: an owner reporting a page whose URL answered 404 still got "
            "`status: 'published'`, `published_url`, `page_exists: true` in seo_content_log and seo_ladders -- while the very "
            'same run told them "the page could not be fetched"',
     'how': 'pass `live:` (what proved the page is there) at every call site; the builder keeps the row at its earlier state and '
            'says why when the proof is absent'},
]

# A Data Table node can mint a forward state WITHOUT any code at all: `defineBelow` writes the literal straight into the row, so
# nothing the Code-node checks above look at can see it. *Mark Case Study Published* did exactly that -- it set
# `status: 'published'` on the case study the moment the owner clicked "I published a page", with no gate of any kind between it
# and the claim. Its twin in the Site Tracker (*Mark Case Study Published (Detect)*) sits behind an IF, which is what makes the
# difference visible. The rule: a node that mints a forward state in its own parameters must sit behind an IF that reads the
# proof.
DT_MINTS = ('written', 'published')
PROOF_WORDS = ('live', 'skip', 'detected', 'page_exists', 'error', 'found')
DT_MINT_WHY = ('a Data Table node writes its literal into the row with no code in between, so nothing above can refuse it: '
               '*Mark Case Study Published* marked the case study live the moment the owner said so, whatever the page answered')
DT_MINT_HOW = ('put the write behind an IF that reads what proved it (*Any Case Studies Detected?* and *Ladder Page?* both do), '
               'or let a Code node build the row so the state can be refused there')

# ---- B. a state that promises work must have a way back ---------------------------------------------------------------------
REVERSALS = [
    {'table': 'seo_ladders', 'forward': 'writing', 'back': 'planned', 'reason': 'status_note',
     'why': 'R1: the budget guard refused execution 500 and row 19 stayed "writing", so within 90 seconds the ladder plan '
            'promised the page, the Rank Tracker said "already written -- publish it" and the cadence counted it among the '
            'pages waiting for publication and paused itself. fix_phantom_pages.py exists because of this.',
     'how': 'keep a node that writes the row back to `planned` with its reason in `status_note` (*Refused Ladder Row*)'},
]

# ---- C. a delivery is recorded only on an acknowledgement -------------------------------------------------------------------
# What opens a delivery record, and what settles one. Both are kit entry points, so a rename breaks the build rather than the rule.
DELIVERY = {
    'opens': 'OA.plan(', 'opens_kit': '_ops_alert.js',
    'settles': 'AR.posted(', 'settles_kit': '_alert_retry.js',
    'defines': {'_ops_alert.js': ('const OA = (() =>', "delivered: notify ? 'pending'"),
                '_alert_retry.js': ('const AR = (() =>', 'const posted = (item)', 'Number(x.statusCode)')},
    'table': 'seo_ops_alerts',
}
# the column that says who has it, and the values that mean "nobody has it yet" -- writing one of those is opening a record, not
# claiming a delivery (AR.carried / OA.carried use the same list)
NOT_YET = ("'pending'", "'deduped'", "'failed'", "'not_sent'", "'abandoned'")
WRITES_DELIVERY = re.compile(r"\bdelivered\s*:")
# the three ways a node can be reading the acknowledgement: the receipt reader itself, the sweep's settle (which calls it per
# response), or the status code read by hand
JUDGES_STATUS = ('AR.posted(', 'AR.settle(', 'statusCode')

# ---- D. a gate's verdict must reach every field a consumer reads ------------------------------------------------------------
VERDICTS = [
    {'gate': 'content quality', 'verdict_node': 'Content QA',
     # the fields *Content QA* finalises AND something downstream reads. `passed` is the internal flag B3-3 flipped on its own.
     'flag': 'passed',
     'fields': ('publishable', 'not_ready', 'quality_label', 'not_ready_reasons', 'quality'),
     'why': 'B3-3: the originality gate ran AFTER *Content QA* had finalised the delivery gate and set only `qa.passed`, so a '
            'draft 100% identical to a competitor page came out `publishable: true`, `not_ready: false`, '
            '"passed the quality check" -- which is what the -DRAFT file name, the package banner, meta.json, the callback and '
            'the app all read. A gate that fails is a refusal, not a label.',
     'how': 'set every one of those fields when the gate refuses (v5/code/Originality_Check.js does it), never only the flag'},
]


def _workflows():
    for f in sorted(os.listdir(WF_DIR)):
        if not f.endswith('.json') or f in NOT_GENERATED:
            continue
        for w in json.load(open(os.path.join(WF_DIR, f), encoding='utf-8')):
            yield f, w


def _table(node):
    p = node.get('parameters') or {}
    return ((p.get('dataTableId') or {}).get('value')) or p.get('tableName')


def _edges(w):
    """-> (downstream, upstream) by main connection."""
    down, up = {}, {}
    for s, o in (w.get('connections') or {}).items():
        for lst in (o.get('main') or []):
            for t in (lst or []):
                down.setdefault(s, []).append(t['node'])
                up.setdefault(t['node'], []).append(s)
    return down, up


def _reach(start, edges):
    seen, stack = set(), list(start)
    while stack:
        u = stack.pop()
        if u in seen:
            continue
        seen.add(u)
        stack.extend(edges.get(u, []))
    return seen


def _own_writes(nm, down, nodes, writes):
    """The tables THIS node's rows are written to: a forward walk that does not pass THROUGH another Code node, because once
    another Code node has built the rows they are no longer this node's.

    Found by breaking the delivery check: every chain in a scheduled workflow ends at *Settle Run Ledger* and at the alert-retry
    sweep's own `seo_ops_alerts` write, so a transitive walk said *Watch Ops Delivery* still wrote its result back after its only
    write-back had been cut -- which is B-F3 passing a lint written to stop B-F3."""
    out, seen, stack = set(), set(), list(down.get(nm, []))
    while stack:
        u = stack.pop()
        if u in seen:
            continue
        seen.add(u)
        if u in writes:
            out.add(writes[u])
        if (nodes.get(u) or {}).get('type') == CODE_TYPE:
            continue
        stack.extend(down.get(u, []))
    return out


def _reads(js):
    """Every node this Code node names with $('...') — how a Code node takes another node's output in n8n."""
    return set(re.findall(r"\$\(\s*'([^']+)'\s*\)", js)) | set(re.findall(r'\$\(\s*"([^"]+)"\s*\)', js))


def survey(workflows=None):
    """-> {'promise': [...], 'builders': [...], 'reversal': [...], 'delivery': [...], 'verdict': [...]} over the generated
    workflows. Every row carries `ok` and, when it is False, `fail` in words."""
    wfs = list(workflows if workflows is not None else _workflows())
    out = {'promise': [], 'builders': [], 'stored': [], 'reversal': [], 'delivery': [], 'verdict': []}
    back_seen = {}
    for _f, w in wfs:
        wname = w.get('name') or ''
        nodes = {n['name']: n for n in (w.get('nodes') or [])}
        down, up = _edges(w)
        code = {nm: ((n.get('parameters') or {}).get('jsCode') or '') for nm, n in nodes.items() if n.get('type') == CODE_TYPE}
        writes = {nm: _table(n) for nm, n in nodes.items()
                  if n.get('type') == DT_TYPE and (n.get('parameters') or {}).get('operation') in WRITE_OPS}

        # ---------- A. a forward state minted into a stored row ----------
        for nm, raw in sorted(code.items()):
            js = own_code(raw)
            reaches = _reach([nm], down) & set(writes)
            if not reaches:
                continue                     # it never becomes a stored row: it is not making a promise
            for p in PROMISES:
                if not re.search(r"""status\s*:\s*['"]%s['"]""" % p['state'], js):
                    continue
                ev = [e for e in p['evidence'] if e in js]
                # the tables it writes itself if it writes any, else the ones its rows reach — the first is what a reader needs
                tbl = sorted(_own_writes(nm, down, nodes, writes)) or sorted({writes[r] for r in reaches})
                out['promise'].append({'workflow': wname, 'node': nm, 'state': p['state'], 'evidence_found': ev,
                                       'tables': tbl, 'ok': bool(ev), 'why': p['why'], 'how': p['how'],
                                       'fail': '' if ev else ('mints status "%s" into %s and reads none of the evidence for it (%s)'
                                                              % (p['state'], ', '.join(tbl[:4]), ', '.join(p['evidence'])))})
            # ---------- A2. every call of the shared row builder passes its proof ----------
            for b in BUILDERS:
                # the builder's own definition is inlined into the node and is not a call site
                for call in re.finditer(r'(?<!function )' + re.escape(b['name']), js):
                    arg = js[call.end():call.end() + 600].split('}')[0] + '}'
                    # `live: x` or the shorthand `live` — both hand the proof over; naming it is the point
                    passed = re.search(r'\b%s\s*[,:}]' % b['proof'], arg) is not None
                    out['builders'].append({'workflow': wname, 'node': nm, 'builder': b['name'], 'ok': passed,
                                            'why': b['why'], 'how': b['how'],
                                            'fail': '' if passed else ('calls %s without passing `%s:` — the row claims the page '
                                                                       'exists on nothing but the caller having asked'
                                                                       % (b['name'], b['proof']))})

        # ---------- A3. a forward state minted by a Data Table node's own parameters ----------
        for nm, n in sorted(nodes.items()):
            if nm not in writes:
                continue
            cols = ((n.get('parameters') or {}).get('columns') or {})
            if cols.get('mappingMode') != 'defineBelow':
                continue
            minted = sorted(k for k, v in (cols.get('value') or {}).items() if isinstance(v, str) and v in DT_MINTS)
            if not minted:
                continue
            # EVERY main path into this write must pass an IF that reads the proof -- not merely one of them. Proved the hard
            # way while breaking the lint on purpose: leaving the old direct connection in place beside the new gated one left
            # the node reachable both ways, and a detector that asked "is there a proof IF anywhere upstream?" said yes and
            # passed a node a run could still reach ungated. A lint that claims more than it proves is the failure rule 4
            # exists to stop, so the question is asked of every path.
            gates, unproven = [], []

            def _proven(n, seen):
                if n in seen:
                    return True                  # a loop adds no new way in
                seen = seen | {n}
                t = (nodes.get(n) or {}).get('type')
                if t == 'n8n-nodes-base.if':
                    gates.append(n)
                    if any(re.search(r'\b%s\b' % p, json.dumps(nodes[n].get('parameters') or {})) for p in PROOF_WORDS):
                        return True              # this path is refused here when the proof is missing
                if t == CODE_TYPE or not up.get(n):
                    unproven.append(n)           # the row was built here, or the path starts here: nothing refused it
                    return False
                return all(_proven(u, seen) for u in up.get(n, []))

            ok = bool(up.get(nm)) and all(_proven(u, {nm}) for u in up.get(nm, []))
            proven = sorted({g for g in gates
                             if any(re.search(r'\b%s\b' % p, json.dumps(nodes[g].get('parameters') or {})) for p in PROOF_WORDS)})
            out['stored'].append({'workflow': wname, 'node': nm, 'table': writes[nm], 'mints': minted, 'gates': sorted(set(gates)),
                                  'proven_by': proven, 'ok': ok, 'why': DT_MINT_WHY, 'how': DT_MINT_HOW,
                                  'fail': '' if ok else ('writes %s into %s as a literal, and a path reaches it (through %s) with '
                                                         'no IF that reads the proof (%s)'
                                                         % (', '.join('%s="%s"' % (k, (cols.get('value') or {})[k]) for k in minted),
                                                            writes[nm], ', '.join(sorted(set(unproven))[:3]) or 'the trigger',
                                                            ', '.join(PROOF_WORDS)))})

        # ---------- B. the way back (collected across workflows: the refusal may live in another one) ----------
        for r in REVERSALS:
            for nm, raw in code.items():
                js = own_code(raw)
                # the row must actually be written back to THAT table, and it must carry its reason as a field of the row --
                # `status_note` as a substring of something else is not a reason anyone will read (found by breaking this check)
                if not re.search(r"""status\s*:\s*['"]%s['"]""" % r['back'], js):
                    continue
                if not re.search(r'\b%s\s*[,:}]' % r['reason'], js):
                    continue
                if r['table'] in _own_writes(nm, down, nodes, writes):
                    back_seen.setdefault(r['table'] + '|' + r['forward'], []).append(wname + ' / ' + nm)

        # ---------- C. a delivery recorded on an acknowledgement ----------
        for nm, raw in sorted(code.items()):
            js = own_code(raw)
            if not WRITES_DELIVERY.search(js):
                continue
            # it must reach a write OF THE DELIVERY TABLE. "Any table" is not enough: every chain in a scheduled workflow ends
            # at *Settle Run Ledger*, so cutting the write-back to seo_ops_alerts left the node still "reaching a write" and
            # the lint passed on a workflow that had just reintroduced B-F3. Found by breaking it.
            if DELIVERY['table'] not in _own_writes(nm, down, nodes, writes):
                continue
            # an OPENER writes only the "nobody has it yet" values; anything else is a claim and needs a status code
            values = set(re.findall(r"\bdelivered\s*:\s*([^,\n]+)", js))
            opener = DELIVERY['opens'] in js and all(
                any(v in str(val) for v in NOT_YET) or '?' in str(val) for val in values)
            judges = [t for t in JUDGES_STATUS if t in js]
            # Every HTTP node this node reads must be able to answer with a status code at all. "Reads" is $('Name') AND the
            # node's own direct upstream, because `$input.first()` is how *Watch Ops Delivery* takes the POST's answer -- found
            # by breaking this check: stripping `fullResponse` off *Post Watch Alert* passed a lint that only looked for $().
            blind = []
            for src in _reads(raw) | set(up.get(nm, [])):
                n = nodes.get(src)
                if not n or n.get('type') != HTTP_TYPE:
                    continue
                resp = (((n.get('parameters') or {}).get('options') or {}).get('response') or {}).get('response') or {}
                if resp.get('neverError') and not resp.get('fullResponse'):
                    blind.append(src)
            ok = bool(judges) and not blind if not opener else not blind
            out['delivery'].append({'workflow': wname, 'node': nm, 'opener': opener, 'judges': judges,
                                    'blind_sources': sorted(blind), 'ok': ok,
                                    'why': 'B-F2: *Post Alert Webhook* was neverError with no fullResponse, so a 404 from a '
                                           'revoked Slack hook arrived as an item with no error and was written down as a '
                                           'delivery. R6 / R30: an alert recorded as sent that was never sent.',
                                    'how': "judge the POST on its status code (AR.posted reads `statusCode`), and give the HTTP "
                                           "node `fullResponse: true` whenever it is `neverError`",
                                    'fail': '' if ok else (
                                        ('writes `delivered` without reading a status code; ' if not judges and not opener else '')
                                        + ('reads %s, which is neverError with no fullResponse, so a 404 arrives looking like a '
                                           'success' % ', '.join(blind) if blind else ''))})
        # C3: a workflow that OPENS a delivery record must contain the node that settles it
        openers = sorted(nm for nm, raw in code.items() if DELIVERY['opens'] in own_code(raw))
        settlers = sorted(nm for nm, raw in code.items()
                          if DELIVERY['settles'] in own_code(raw)
                          and DELIVERY['table'] in _own_writes(nm, down, nodes, writes))
        if openers:
            out['delivery'].append({'workflow': wname, 'node': '(workflow)', 'opener': True, 'opens': openers,
                                    'settles': settlers, 'ok': bool(settlers),
                                    'why': 'B-F3: Page Watch posted its digest and wrote nothing back, so every row it opened '
                                           'sat at `delivered: "pending"` for ever and the delivery rate could never be measured',
                                    'how': 'follow the POST with a node that calls %s and writes the result back to %s'
                                           % (DELIVERY['settles'], DELIVERY['table']),
                                    'fail': '' if settlers else ('opens a delivery record (%s) and no node settles it from a '
                                                                 'status code' % ', '.join(openers))})

        # ---------- D. a gate's verdict reaches every field a consumer reads ----------
        for v in VERDICTS:
            if v['verdict_node'] not in nodes:
                continue
            # the editor loop runs back into *Content QA*, so the verdict node is downstream of itself: it is the node that
            # FINALISES the verdict, never a later gate of it
            later = (_reach(down.get(v['verdict_node'], []), down) & set(code)) - {v['verdict_node']}
            for nm in sorted(later):
                js = own_code(code[nm])
                touched = [f for f in (v['fields'] + (v['flag'],)) if _assigns(js, f)]
                if not touched:
                    continue                 # not a gate: it only reads the verdict
                missing = [f for f in v['fields'] if not _assigns(js, f)]
                out['verdict'].append({'workflow': wname, 'node': nm, 'gate': v['gate'], 'touched': touched,
                                       'missing': missing, 'ok': not missing, 'why': v['why'], 'how': v['how'],
                                       'fail': '' if not missing else (
                                           'runs after *%s* and sets %s but not %s — the fields the file name, the package '
                                           'banner, meta.json, the callback and the app read keep saying the page passed'
                                           % (v['verdict_node'], ', '.join(touched), ', '.join(missing)))})

    for r in REVERSALS:
        key = r['table'] + '|' + r['forward']
        out['reversal'].append({'table': r['table'], 'forward': r['forward'], 'back': r['back'],
                                'writers': sorted(set(back_seen.get(key) or [])), 'ok': bool(back_seen.get(key)),
                                'why': r['why'], 'how': r['how'],
                                'fail': '' if back_seen.get(key) else (
                                    'a row can be moved to "%s" and nothing can move it back to "%s" with a reason in `%s`'
                                    % (r['forward'], r['back'], r['reason']))})
    return out


def _assigns(js, field):
    """Does this node SET the verdict's field ON THE VERDICT (rather than read it, or name something else the same)?

    Deliberately narrow: only an assignment to the carried verdict object counts -- `qa.publishable = false`,
    `content_qa.publishable =`, `qa['publishable'] =`. *Blog Package* writes `publishable: d.qa_publishable` into the package it
    hands out: that is a CONSUMER copying the verdict forward under its own name, not a gate changing it, and a detector that
    could not tell the two apart would make this check noise instead of a rule."""
    return bool(re.search(r"""\b(?:qa|content_qa)\s*(?:\.\s*%s|\[\s*['"]%s['"]\s*\])\s*=[^=]""" % (field, field), js))


_CQ_LITERAL = re.compile(r'content_qa\s*:\s*\{')


def _defines(js, field):
    """Does the VERDICT node emit this field? It builds the verdict as one object literal (`content_qa: { ..., publishable:
    passed, not_ready, quality_label, ... }`), with shorthand properties, so the question is asked of that literal and not of the
    whole node."""
    m = _CQ_LITERAL.search(js)
    if not m:
        return _assigns(js, field)
    depth, i = 1, m.end()
    while i < len(js) and depth:
        depth += 1 if js[i] == '{' else (-1 if js[i] == '}' else 0)
        i += 1
    block = js[m.end():i]
    return bool(re.search(r'\b%s\s*[,:}\n]' % field, block))


def _kits_define():
    """A guard is only a guard while the thing the lint looks for exists: a rename must break the build, not the rule."""
    bad = []
    for b in BUILDERS:
        src = open(os.path.join(V5_CODE, b['kit']), encoding='utf-8').read()
        for needle in b['defines'] + b['refuses']:
            if needle not in src:
                bad.append('v5/code/%s no longer carries %r — the published-row builder was renamed or its refusal removed, so '
                           'state_lint.BUILDERS is stale' % (b['kit'], needle))
    for kit, needles in DELIVERY['defines'].items():
        src = open(os.path.join(V5_CODE, kit), encoding='utf-8').read()
        for needle in needles:
            if needle not in src:
                bad.append('v5/code/%s no longer carries %r — the delivery record keeps no receipt, so state_lint.DELIVERY is '
                           'stale' % (kit, needle))
    return bad


def _verdict_fields_are_real(workflows=None):
    """The declared verdict fields must be the ones the verdict node WRITES and something downstream READS. A field list that
    rots is a lint that checks nothing: B3-3 was a field nobody had thought about."""
    bad = []
    for _f, w in (workflows if workflows is not None else list(_workflows())):
        nodes = {n['name']: n for n in (w.get('nodes') or [])}
        code = {nm: ((n.get('parameters') or {}).get('jsCode') or '') for nm, n in nodes.items() if n.get('type') == CODE_TYPE}
        down, _up = _edges(w)
        for v in VERDICTS:
            if v['verdict_node'] not in code:
                continue
            vjs = own_code(code[v['verdict_node']])
            for f in v['fields']:
                if not _defines(vjs, f):
                    bad.append('%s no longer sets %r, so state_lint.VERDICTS is stale' % (v['verdict_node'], f))
            later = (_reach(down.get(v['verdict_node'], []), down) & set(code)) - {v['verdict_node']}
            for f in v['fields']:
                # read downstream directly, or carried on under its delivered name (`qa_publishable`, `qa_label`, ...)
                if not any(re.search(r'\b%s\b' % f, code[nm]) or re.search(r'\bqa_%s\b' % f.replace('quality_', ''), code[nm])
                           for nm in later):
                    bad.append('nothing downstream of %s reads %r any more, so state_lint.VERDICTS is stale (drop it, or the '
                               'lint is guarding a field no consumer has)' % (v['verdict_node'], f))
    return bad


def counts(sv):
    return {k: {'subject': len(rows), 'pass': sum(1 for r in rows if r['ok'])} for k, rows in sorted(sv.items())}


def check(write_record=True):
    """Fails the build on a new breach of rule 4. Returns (survey, the baselined debt that is still unpaid)."""
    bad = _kits_define() + _verdict_fields_are_real()
    assert not bad, 'INVARIANTS rule 4 (nothing is promised until it exists): \n  ' + '\n  '.join(bad)
    sv = survey()
    base = json.load(open(BASELINE, encoding='utf-8')) if os.path.exists(BASELINE) else {}
    known = {k for k, v in base.items() if isinstance(v, dict)}
    new, unpaid = [], []
    for kind, rows in sorted(sv.items()):
        for row in rows:
            if row['ok']:
                continue
            key = kind + ' :: ' + row.get('workflow', '') + ' / ' + row.get('node', row.get('table', ''))
            if kind != 'promise':
                # only check A's inline half is ratchetable: everything else is a rule, and a rule has no debt
                new.append('%s\n     %s\n     why it matters: %s\n     the fix: %s' % (key, row['fail'], row['why'], row['how']))
                continue
            unpaid.append(key)
            if key not in known:
                new.append('%s\n     %s\n     why it matters: %s\n     the fix: %s' % (key, row['fail'], row['why'], row['how']))
    assert not new, (
        'INVARIANTS rule 4 (nothing is promised until it exists, and nothing exists until it is delivered): %d breach(es).\n  '
        % len(new) + '\n  '.join(new)
        + '\n  Fix it as described. Only a `promise` row may be deferred, and only with a reason and a register row if it is a '
          'defect: add it to harness/rule4_baseline.json.')
    gone = sorted(k for k in known if k not in set(unpaid))
    assert not gone, ('INVARIANTS rule 4: harness/rule4_baseline.json names %d row(s) that no longer breach anything: %s\n'
                      '  Remove them (a node that was fixed, renamed or deleted leaves the ratchet for ever).'
                      % (len(gone), ', '.join(gone)))
    if write_record:
        write_baseline(unpaid)
        json.dump({'rows': sv, 'unpaid': sorted(unpaid), 'counts': counts(sv), 'selftest': selftest()},
                  open(RECORD, 'w'), indent=1, sort_keys=True)
    return sv, unpaid


def write_baseline(unpaid):
    """The ratchet can only tighten: a row that no longer breaches leaves the baseline for ever, and a new breach never enters it
    here (it fails the build first, which is the point). Same shape as retry_lint / gate_lint / lineage_lint."""
    base = json.load(open(BASELINE, encoding='utf-8')) if os.path.exists(BASELINE) else {}
    for key in list(base):
        if not isinstance(base[key], dict):   # the file's own `_note`, which is prose for whoever opens it
            continue
        if key not in set(unpaid):
            del base[key]
    os.makedirs(os.path.dirname(BASELINE), exist_ok=True)
    json.dump(base, open(BASELINE, 'w'), indent=1, sort_keys=True)
    return base


def seed_baseline():
    """Run once, by hand, to record today's debt. Never called by a build."""
    sv = survey()
    base = {}
    for row in sv['promise']:
        if row['ok']:
            continue
        base['promise :: ' + row['workflow'] + ' / ' + row['node']] = {'why': row['fail'], 'state': row['state']}
    json.dump(base, open(BASELINE, 'w'), indent=1, sort_keys=True)
    return base


# ---- the lint's own self-test, recorded for harness S84 (the harness runs JS, not this file) -------------------------------
def selftest():
    """Six ways of breaking rule 4, each one caught, beside the healthy case of each. Build section 74 asserts it; S84 reads it."""
    def wf(nodes, conns=None):
        return [('x.json', {'name': 'W', 'nodes': nodes, 'connections': conns or {}})]

    def js(nm, src):
        return {'name': nm, 'type': CODE_TYPE, 'parameters': {'jsCode': src}}

    def dt(nm, table, op='upsert'):
        return {'name': nm, 'type': DT_TYPE,
                'parameters': {'operation': op, 'dataTableId': {'__rl': True, 'mode': 'name', 'value': table}}}

    def http(nm, never, full):
        return {'name': nm, 'type': HTTP_TYPE,
                'parameters': {'options': {'response': {'response': {'neverError': never, 'fullResponse': full}}}}}

    res = {}

    # ---- 1. a forward state minted with, and without, the artefact that proves it ----
    save = dt('Save Log', 'seo_content_log')
    for name, src, expect in (
            ('a_written_row_that_read_the_page', "const p = $('Blog Package').first().json;\n"
             "if (!p.article_html) return [{ json: { skip: true } }];\nreturn [{ json: { status: 'written' } }];", True),
            ('a_written_row_that_read_nothing', "return [{ json: { status: 'written' } }];", False)):
        sv = survey(wf([js('Log Row', src), save], {'Log Row': {'main': [[{'node': 'Save Log'}]]}}))
        row = (sv['promise'] or [{}])[0]
        res[name] = {'ok': row.get('ok'), 'caught': row.get('ok') is expect, 'fail': row.get('fail', '')}

    # ---- 2. the shared row builder called with and without its proof ----
    for name, src, expect in (
            ('published_rows_handed_the_proof',
             "const r = publishedRows({ url, keyword, live, now });\nreturn [{ json: r.log_row }];", True),
            ('published_rows_called_on_nothing',
             "const r = publishedRows({ url, keyword, now });\nreturn [{ json: r.log_row }];", False)):
        sv = survey(wf([js('Check', src), save], {'Check': {'main': [[{'node': 'Save Log'}]]}}))
        row = (sv['builders'] or [{}])[0]
        res[name] = {'ok': row.get('ok'), 'caught': row.get('ok') is expect, 'fail': row.get('fail', '')}

    # ---- 2b. a Data Table node minting the state itself, behind a gate and in front of none ----
    def dt_lit(nm, table):
        return {'name': nm, 'type': DT_TYPE,
                'parameters': {'operation': 'update', 'dataTableId': {'__rl': True, 'mode': 'name', 'value': table},
                               'columns': {'mappingMode': 'defineBelow', 'value': {'status': 'published'}}}}

    def if_node(nm, expr):
        return {'name': nm, 'type': 'n8n-nodes-base.if',
                'parameters': {'conditions': {'conditions': [{'leftValue': expr}]}}}

    rows = js('Rows', "return [{ json: { url } }];")
    mark = dt_lit('Mark Published', 'seo_case_studies')
    for name, nodes2b, conns2b, expect in (
            ('a_table_node_behind_a_gate_that_reads_the_proof',
             [rows, if_node('Page Live?', "={{ $('Check').first().json.live }}"), mark],
             {'Rows': {'main': [[{'node': 'Page Live?'}]]}, 'Page Live?': {'main': [[{'node': 'Mark Published'}]]}}, True),
            ('a_table_node_that_mints_published_with_no_gate_at_all',
             [rows, mark], {'Rows': {'main': [[{'node': 'Mark Published'}]]}}, False),
            # the hole this check had until it was broken on purpose: the gate is there AND the old direct path is still wired,
            # so a run can still reach the write ungated. One proof IF upstream is not enough; every path needs one.
            ('a_gate_added_while_the_old_direct_path_is_left_wired',
             [rows, if_node('Page Live?', "={{ $('Check').first().json.live }}"), mark],
             {'Rows': {'main': [[{'node': 'Page Live?'}, {'node': 'Mark Published'}]]},
              'Page Live?': {'main': [[{'node': 'Mark Published'}]]}}, False)):
        sv = survey(wf(nodes2b, conns2b))
        row = (sv['stored'] or [{}])[0]
        res[name] = {'ok': row.get('ok'), 'caught': row.get('ok') is expect, 'fail': row.get('fail', '')}

    # ---- 3. a "writing" row with and without a way back ----
    ladders = dt('Save Ladder', 'seo_ladders')
    for name, src, expect in (
            ('a_refusal_puts_the_row_back', "return [{ json: { status: 'planned', status_note: 'refused: ' + why } }];", True),
            ('nothing_puts_the_row_back', "return [{ json: { status: 'writing' } }];", False)):
        sv = survey(wf([js('Marks', src), ladders], {'Marks': {'main': [[{'node': 'Save Ladder'}]]}}))
        row = (sv['reversal'] or [{}])[0]
        res[name] = {'ok': row.get('ok'), 'caught': row.get('ok') is expect, 'fail': row.get('fail', '')}

    # ---- 4. a delivery recorded from a status code, and one recorded from a blind POST (B-F2) ----
    ops = dt('Save Alert', 'seo_ops_alerts')
    conn4 = {'Delivery': {'main': [[{'node': 'Save Alert'}]]}}
    body4 = "const r = AR.posted($('Post Alert').first());\nreturn [{ json: { delivered: r.ok ? 'webhook' : 'failed' } }];"
    for name, never, full, expect in (('a_delivery_judged_on_its_status_code', True, True, True),
                                      ('a_404_from_a_revoked_webhook_counted_as_a_delivery', True, False, False)):
        sv = survey(wf([js('Delivery', body4), http('Post Alert', never, full), ops], conn4))
        row = next((r for r in sv['delivery'] if r['node'] == 'Delivery'), {})
        res[name] = {'ok': row.get('ok'), 'caught': row.get('ok') is expect, 'fail': row.get('fail', '')}
    blind4 = "return [{ json: { delivered: 'webhook' } }];"
    sv = survey(wf([js('Delivery', blind4), http('Post Alert', True, True), ops], conn4))
    row = next((r for r in sv['delivery'] if r['node'] == 'Delivery'), {})
    res['a_delivery_recorded_without_reading_anything'] = {'ok': row.get('ok'), 'caught': row.get('ok') is False,
                                                           'fail': row.get('fail', '')}

    # ---- 5. a workflow that opens a delivery record and never settles it (B-F3) ----
    open5 = "const p = OA.plan(alert, rows, CFG);\nreturn [{ json: p.row }];"
    settle5 = "const r = AR.posted($('Post Alert').first());\nreturn [{ json: { delivered: r.ok ? 'webhook' : 'failed' } }];"
    conn5 = {'Opener': {'main': [[{'node': 'Save Alert'}]]}, 'Settle': {'main': [[{'node': 'Save Alert'}]]}}
    for name, nodes5, expect in (
            ('the_digest_is_posted_and_settled', [js('Opener', open5), js('Settle', settle5), http('Post Alert', True, True), ops], True),
            ('the_digest_is_posted_and_nothing_written_back', [js('Opener', open5), http('Post Alert', True, True), ops], False)):
        sv = survey(wf(nodes5, conn5))
        row = next((r for r in sv['delivery'] if r['node'] == '(workflow)'), {})
        res[name] = {'ok': row.get('ok'), 'caught': row.get('ok') is expect, 'fail': row.get('fail', '')}

    # ---- 6. a later gate that refuses on one field only (B3-3) ----
    whole = ("qa.passed = false;\nqa.publishable = false;\nqa.not_ready = true;\nqa.quality_label = 'did not pass';\n"
             "qa.not_ready_reasons = [reason];\nqa.quality = { passed: false };")
    conn6 = {'Content QA': {'main': [[{'node': 'Originality Check'}]]}}
    for name, src, expect in (('a_later_gate_that_refuses_everywhere', whole, True),
                              ('a_later_gate_that_flips_one_internal_flag', 'qa.passed = false;', False)):
        sv = survey(wf([js('Content QA', whole), js('Originality Check', src)], conn6))
        row = (sv['verdict'] or [{}])[0]
        res[name] = {'ok': row.get('ok'), 'caught': row.get('ok') is expect, 'missing': row.get('missing', []),
                     'fail': row.get('fail', '')}

    # ---- 7. the guards rename themselves, so the lint would silently check nothing ----
    import copy as _c
    saved = _c.deepcopy(BUILDERS[0])
    BUILDERS[0]['defines'] = ('function thisWasRenamed(',)
    res['the_builder_renames_itself'] = {'caught': bool(_kits_define())}
    BUILDERS[0].update(saved)
    saved2 = dict(VERDICTS[0])
    VERDICTS[0]['fields'] = VERDICTS[0]['fields'] + ('a_field_nobody_has',)
    res['the_verdict_field_list_goes_stale'] = {'caught': bool(_verdict_fields_are_real())}
    VERDICTS[0].update(saved2)
    return res


if __name__ == '__main__':
    import sys
    if '--seed' in sys.argv:
        print(json.dumps(seed_baseline(), indent=1))
    elif '--survey' in sys.argv:
        s = survey()
        for kind, rows in sorted(s.items()):
            for r in rows:
                print('%-10s %-26s %-30s %s' % (kind, (r.get('workflow') or r.get('table') or '')[:26],
                                                (r.get('node') or r.get('forward') or '')[:30],
                                                'ok' if r['ok'] else 'FAILS: ' + r['fail'][:150]))
        print(json.dumps(counts(s), indent=1))
    else:
        s, u = check(write_record=False)
        print(json.dumps(counts(s), indent=1))
        print('unpaid:', json.dumps(u, indent=1))
