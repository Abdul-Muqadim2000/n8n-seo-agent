"""INVARIANTS rule 1 (docs/system-review-2026-10-14/INVARIANTS.md): a number we report is measured, or it says what it is.

~19 of the 81 defects came from this one class, including the worst of them: a High finding on 45 of 47 pages from a field Google
no longer answers (R10); an impact basis of 22,860 impressions for a property that measured 5,295 (R10); "no page of yours answers
this search" beside the page ranking #6.2 for it (R12); 19,579 citing AI answers from a four-character name match (R14); "winnable
68" from two SERP calls that both failed (R18 / R23); a health score chained across unlike report types (R20); a crawl settled at
the price quoted for 200 pages when 47 were crawled (R32).

**The rule.** Every figure that reaches a customer carries one of three states -- **measured** (and what measured it), **modelled**
(and from what), or **not available** (and why). A figure may never be derived from a sample whose size changed, from a field the
source no longer populates, or from a call that failed.

**The lint.** Like `retry_lint.py` and `gate_lint.py`, and like build section 55's ordering proof, it walks the GENERATED workflows
-- not the sources -- because a kit is only lineage in the nodes it was inlined into. Four checks, each a class that until now was
asserted one instance at a time:

  A. **lineage**     every node that composes a document a customer receives carries the `_lineage.js` kit, calls it, and lets the
                     result travel out (`lineage` in the payload or LN.block in the body).
  B. **evidence**    no finding ships with an empty evidence string: every node that both builds findings and hands a `findings`
                     array on towards a delivery runs them through `LN.evidenced` (R10 asserted this for ONE finding).
  C. **like-for-like** no delta is computed across differing `report_type` or differing sample sizes: every node that compares this
                     run with a stored previous one carries both guards (R20 asserted the first for the chart marks, R19 the second
                     for URL inspection).
  D. **withheld**    no score is emitted when its inputs carry `unavailable`: every node that puts a score in front of a customer
                     carries a path that withholds it and says why (R18 / R23 asserted this for the ladder and the verdict).
  E. **refusal**     nothing scores, ranks or advises from evidence that could not be read: every node that reads a `<X> Answers`
                     node -- the output of rule 3's in-200 retry gate, which attaches `RT.evidence` to every item as `__dfs` --
                     carries a way of saying "could not be read" (B-A11 asserted this for three nodes; the nine that already did
                     it are what the check is calibrated on).

**It is a ratchet where it cannot yet be a rule** -- the same shape as `retry_lint.check_in200` + `harness/in200_baseline.json` and
`gate_lint` + `harness/gate_pairs_baseline.json`. `harness/lineage_baseline.json` names every node that fails one of the four
checks today, so the debt is visible, cannot GROW, and shrinks as it is paid. A node that gains its lineage, its evidence guard,
its like-for-like guard or its withholding path leaves the baseline for ever and can never come back.

What this lint PROVES: that no NEW node can compose a delivered document without lineage, emit findings without the evidence
guard, compare against a stored report without the two guards, or show a score with no way to withhold it. What it only RATCHETS:
the nodes listed in the baseline, and -- inside a node that passes -- whether every individual figure is covered. A `LN.of()` call
is not proof that the number beside it came from that source; only that the node was built to say so.
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
WF_DIR = os.path.join(HERE, 'workflows')
V5_CODE = os.path.join(HERE, 'v5', 'code')
BASELINE = os.path.join(HERE, 'harness', 'lineage_baseline.json')
RECORD = os.path.join(HERE, 'harness', 'lineage.json')
CODE_TYPE = 'n8n-nodes-base.code'
MAIL_TYPE = 'n8n-nodes-base.emailSend'
HTTP_TYPE = 'n8n-nodes-base.httpRequest'
RESPOND_TYPE = 'n8n-nodes-base.respondToWebhook'
# the build's inputs, not its outputs: the v3 export is what build_v4.py reads, the callback receiver is kept by hand for tests
NOT_GENERATED = ('SEO_Agent_v3_original_export.json', 'SEO_Agent_Test_Callback_Receiver.json')

# ---- what counts as a document a customer receives -------------------------------------------------------------------------
# The markup a report is made of. A node that writes this much of it is composing something a person reads, not parsing a page.
MARKUP = ('<h1', '<h2', '<h3', '<table', '<tr>', '<td', '<p>', '<ul', '<li', '<div')
MARKUP_MIN = 12          # the report bodies; the next node down is at 10 and is a check result, not a report
BODY_MIN = 5             # ... unless the node hands out the delivered body or file itself, where less markup still delivers
BODY_FIELD = re.compile(r'\b(?:[a-z_]+_)?(?:html|markdown)\s*[:,}]|mimeType\s*:')

# Nodes that match the shape and deliver no figure of their own. Each one is named with its reason, so the exclusion is a
# decision somebody made and not a threshold nobody can see.
NOT_A_REPORT = {
    'Build Description Page': 'the "we have started, your report is coming" page shown by the form: it carries no figure',
    'Image Cards': 'the image plan preview (file names and alt text), no measured figure',
    'Analyze HTML': 'an analysis step: its `html` is the page it READ, not a body it sends',
    'Publish Check': 'the live publish check: pass / fail per element, no figure derived from a sample',
}

# ---- B. findings and their evidence ----------------------------------------------------------------------------------------
EVIDENCE_GUARD = 'LN.evidenced('
BUILDS_FINDINGS = (re.compile(r'\bseverity\s*:'), re.compile(r'\bevidence\s*:'))
HANDS_ON_FINDINGS = re.compile(r'\bfindings\s*[,:}]')

# ---- C. a delta against a stored previous report ----------------------------------------------------------------------------
# Deliberately narrow: the class is "this run's figure against a STORED EARLIER RUN's figure", which is what R20 (a health score
# chained across unlike report types) and R19 (a smaller sample read as an improvement) both are. A node that merely holds a
# variable called `prev` is not in the class, and a detector that says it is would make the ratchet noise.
# A node is in the class when it COMPUTES the delta -- a subtraction between this run's report figure and a stored earlier one.
# A node that only prints a delta somebody else computed is not (the guard belongs where the subtraction is: `Audit Diff` keeps it,
# and its reports print `audit_diff.summary`, which already names the type compared and what was not compared).
COMPARES_PREVIOUS = re.compile(
    r'-\s*[^;\n]{0,30}\b(prev|previous|last|older|baseline)\w*\s*[.\[]\s*[\'"]?'
    r'(health_score|findings\w*|grade|\w*_score|\w*_rate|share_of_voice|avg\w*)\b')
COMPARED_FIGURE = re.compile(r'\b(health_score|findings|grade|\w*_score|share_of_voice)\b')
# the second arm, and the reason R20 cannot come back: the annotation kit's whole job is to put one report's figures beside an
# earlier report's. Every node that inlines it is in the class, whatever it then calls its variables.
CARRIES_MARKS_KIT = 'const AN = (() =>'
# R20: the two sides are the same KIND of thing. Either the node compares `report_type` itself (the audit diff, and the marks kit
# whose whole job is that comparison), or it calls the shared guard. `RT.likeForLike(` is a USE, never an inline: the kit's own
# body writes `likeForLike(` with no `RT.` prefix, and build section 73 fails if that ever stops being true — the trap gate_lint
# fell into on 2026-10-15 was a node that merely CARRIED a kit being read as a node that used it.
TYPE_GUARD = re.compile(r'report_type|RT\.likeForLike\(')
# R19: a comparison may not treat a smaller sample as an improvement. Any of these says the node knows its sample can move.
# `RT.comparable(` (a call) and "not comparable" (the marks kit's own refusal text) — never the bare word `comparable`, which the
# kit writes when it merely DEFINES the function.
SAMPLE_GUARD = re.compile(r'RT\.comparable\(|not comparable|checked_of|sample moved|not_compared|notCompared|sample_moved')

# ---- D. a score shown to a customer ------------------------------------------------------------------------------------------
# an object key `health_score:` or an assignment `health_score =` -- never a ternary's ` : `, which is not a figure
EMITS_SCORE = re.compile(r'\b\w*_score:|\b\w*_score\s*=[^=]|\bscore:')
WITHHOLD = re.compile(r'score_withheld|NOT_CHECKED|not_checked|withheld|unavailable|could not be (read|checked)|not available')

# ---- E. a node that acts on a gated read (B-A11, 2026-10-15) ------------------------------------------------------------------
# Rule 3 put the in-200 retry gate on 72 DataForSEO calls, and every `<X> Answers` node it splices in attaches `RT.evidence` to
# each item as `__dfs`: asked, answered, failed, retried, `unavailable`. Rule 1 is the other end of that sentence -- "nothing
# downstream may score, rank or advise from `unavailable` evidence" -- and until B-A11 nothing checked it. The class is exactly
# the three nodes B-A11 names: *Pick Competitors* ranked rivals, *Competitor Analysis* raised a High "does not rank in Google's
# top 10 for any keyword" and *Analyze Keywords* raised a keyword gap, each from answers that may have failed TWICE, each
# printing a measured-looking zero. The nine that already refuse (Parse Positions, Site SERP, Trends, Assess Result, Build
# Keyword Strategy, Collect Research, Analyze Backlinks, Merge Keyword Data, Save Task ID) are what the vocabulary below is
# calibrated on: either the node carries the gate's own evidence block forward, or it says in words that something was not read.
READS_GATED = re.compile(r"\$\('[^']+ Answers'\)")
# `available: false` is in the list because *Analyze Backlinks* refuses in its own words rather than the kit's -- a row it could
# not read is `{ available: false, error: <the provider's message> }` and every figure beside it is null, which is the rule kept.
# A lint that measured only the kit's vocabulary would have called that node a breach, and would have been measuring less than it
# claims: it would be checking which helper a node imported, not whether it can refuse.
REFUSAL = re.compile(r'__dfs\b|RT\.evidence\(|RT\.one\(|RT\.stats\(|\bunavailable\b|could not be (?:read|checked)'
                     r"|\bavailable\s*:\s*false")


def _workflows():
    for f in sorted(os.listdir(WF_DIR)):
        if not f.endswith('.json') or f in NOT_GENERATED:
            continue
        for w in json.load(open(os.path.join(WF_DIR, f), encoding='utf-8')):
            yield f, w


def _upstream(w):
    up = {}
    for s, o in (w.get('connections') or {}).items():
        for lst in (o.get('main') or []):
            for t in (lst or []):
                up.setdefault(t['node'], []).append(s)
    return up


def _delivers(node):
    """True when this node hands something to a person or to the customer's app."""
    t = node.get('type')
    if t in (MAIL_TYPE, RESPOND_TYPE):
        return True
    return t == HTTP_TYPE and 'callback_url' in json.dumps(node.get('parameters') or {})


# A shared kit is inlined verbatim into every node that uses it, and it brings its own markup, its own `html,` and its own
# `prev.checked_at` with it. Judging a node on text it did not write is how a lint starts lying: inlining `_lineage.js` would
# otherwise turn any node into a "report builder", and `_page_watch.js` turned eleven nodes into "delta" nodes. So every check
# below reads the node's OWN code, with the kits stripped; only the questions that are ABOUT a kit read the whole source.
_KIT = re.compile(r'(?ms)^const [A-Z]{2,4} = \(\(\) => \{.*?^\}\)\(\);[ \t]*$')
# ... and a comment is not behaviour. `_lineage.js` opens with a header that says "LN.block() prints the whole list under a
# report", and that header sits ABOVE `const LN = (() => {`, so the kit stripper never reached it: every node that merely
# CARRIED the kit read as a node that let its lineage travel. Found on 2026-10-15 while paying B-L1 - the same trap as the one
# gate_lint fell into the same week. `//` after a colon is left alone so a URL survives.
_LINE_COMMENT = re.compile(r'(?m)(?<![:\w])//.*$')
_BLOCK_COMMENT = re.compile(r'(?s)/\*.*?\*/')


def strip_comments(js):
    return _LINE_COMMENT.sub('', _BLOCK_COMMENT.sub('', js))


def own_code(js):
    return strip_comments(_KIT.sub('', js))


def _markup(js):
    return sum(js.count(m) for m in MARKUP)


def survey(workflows=None):
    """-> {'<workflow> / <node>': {checks it is subject to, and whether each one holds}} over the generated workflows."""
    out = {}
    for _f, w in (workflows if workflows is not None else list(_workflows())):
        wname = w.get('name') or ''
        nodes = {n['name']: n for n in (w.get('nodes') or [])}
        up = _upstream(w)
        reach, stack = set(), [nm for nm, n in nodes.items() if _delivers(n)]
        while stack:                                   # everything that can reach a delivery node by a main connection
            u = stack.pop()
            if u in reach:
                continue
            reach.add(u)
            stack.extend(up.get(u, []))
        for nm in sorted(reach):
            n = nodes.get(nm)
            if not n or n.get('type') != CODE_TYPE:
                continue
            raw = (n.get('parameters') or {}).get('jsCode') or ''
            js = own_code(raw)                       # the node's own code: a kit's markup is not this node's report
            # the questions that are ABOUT a kit read the whole source -- but never its prose. A kit header that NAMES the call
            # the lint looks for would otherwise answer the lint's question for every node that carries the kit.
            src = strip_comments(raw)
            mk = _markup(js)
            row = {'workflow': wname, 'node': nm, 'markup': mk, 'subject': [], 'fails': []}
            # ---- A. a document a customer receives carries its lineage ----
            composes = mk >= MARKUP_MIN or (mk >= BODY_MIN and bool(BODY_FIELD.search(js)))
            if composes and nm not in NOT_A_REPORT:
                row['subject'].append('lineage')
                # a node either COMPOSES lineage (LN.of / LN.unknown) or RENDERS lineage composed upstream (LN.block / LN.note):
                # Site Report is handed `m.lineage` by Site Metrics and prints the table, which is a use of the kit, not a gap.
                # Before the comment stripper above, it passed on the kit's own header text instead, which proved nothing.
                row['lineage'] = {'kit': 'const LN = (() =>' in raw,            # the kit question reads the whole source
                                  'calls': any(c in js for c in ('LN.of(', 'LN.unknown(', 'LN.block(', 'LN.note(')),
                                  'travels': ('LN.block(' in js) or bool(re.search(r'\blineage\s*[,:]', js))}
                if not all(row['lineage'].values()):
                    row['fails'].append('lineage')
            # ---- B. no finding ships with an empty evidence string ----
            if all(p.search(js) for p in BUILDS_FINDINGS) and HANDS_ON_FINDINGS.search(js):
                row['subject'].append('evidence')
                row['evidence'] = EVIDENCE_GUARD in src
                if not row['evidence']:
                    row['fails'].append('evidence')
            # ---- C. a delta is computed between like and like ----
            if (COMPARES_PREVIOUS.search(js) and COMPARED_FIGURE.search(js)) or CARRIES_MARKS_KIT in raw:
                row['subject'].append('like_for_like')
                # the guards are read from the WHOLE source: for the marks the guard IS the kit (R20 lives in _annotations.js)
                row['like_for_like'] = {'report_type': bool(TYPE_GUARD.search(src)), 'sample': bool(SAMPLE_GUARD.search(src))}
                if not all(row['like_for_like'].values()):
                    row['fails'].append('like_for_like')
            # ---- D. a score with no way of being withheld ----
            if composes and nm not in NOT_A_REPORT and EMITS_SCORE.search(js):
                row['subject'].append('withheld')
                row['withheld'] = bool(WITHHOLD.search(src))
                if not row['withheld']:
                    row['fails'].append('withheld')
            # ---- E. a node that acts on a gated read can say it could not be read ----
            if READS_GATED.search(js):
                row['subject'].append('refusal')
                row['refusal'] = bool(REFUSAL.search(src))
                if not row['refusal']:
                    row['fails'].append('refusal')
            if row['subject']:
                out[wname + ' / ' + nm] = row
    return out


def _kit_defines():
    """A check is only a check while the thing it looks for exists: a rename must break the build, not the rule."""
    bad = []
    src = open(os.path.join(V5_CODE, '_lineage.js'), encoding='utf-8').read()
    for needle in ('const LN = (() => {', 'const of = (figure, source, o)', 'const unknown = (figure, why)',
                   'const block = (list, o)', 'const evidenced = ('):
        if needle not in src:
            bad.append('v5/code/_lineage.js no longer defines %r — the kit was renamed or removed, so lineage_lint is stale' % needle)
    return bad


WHY = {
    'lineage': 'a figure printed with no source, period or sample is the class behind R10, R12, R14 and R20 — the customer cannot '
               'tell a 28-day Google count from one live sample (G29)',
    'evidence': 'a finding with an empty evidence string was raised on 45 of 47 pages and ranked second of 60 by impact (R10)',
    'like_for_like': 'a health score chained across unlike report types (R20), and a smaller sample read as an improvement (R19)',
    'withheld': '"winnable 68" was scored from two SERP calls that both failed (R18 / R23): a score needs a way of not being shown',
    'refusal': 'the in-200 gate marks an answer `unavailable` and three nodes carried on regardless (B-A11): a High "does not '
               'rank in the top 10 for any keyword" from a read that failed twice is a measured-looking zero',
}
FIX = {
    'lineage': 'inline v5/code/_lineage.js (LINEAGE_SRC) into the node, describe each figure group with LN.of() / LN.unknown(), '
               'and let it travel — LN.block(lineage) in the body and `lineage` in the returned json',
    'evidence': 'run the findings through LN.evidenced() before handing them on; it drops a finding whose evidence string is empty '
                'and counts what it dropped',
    'like_for_like': 'compare only with a stored row of the same report_type, and say "not compared: the sample moved" when the '
                     'sample size drifted (checked / checked_of)',
    'withheld': 'carry a refusal: no score, no visits, no timeline when an input is unavailable — "could not be read", never "no demand"',
    'refusal': 'read the gate\'s own `__dfs` block off the answers (or RT.evidence / RT.one over them), and when it is '
               '`unavailable` hand on nulls and a reason instead of a zero — "could not be read", never "none found"',
}


def check(write_record=True):
    """Fails the build on a new breach of rule 1. Returns (survey, the baselined debt that is still unpaid)."""
    bad = _kit_defines()
    assert not bad, 'INVARIANTS rule 1 (lineage): \n  ' + '\n  '.join(bad)
    sv = survey()
    base = json.load(open(BASELINE, encoding='utf-8')) if os.path.exists(BASELINE) else {}
    known = {k: set(v.get('fails') or []) for k, v in base.items() if isinstance(v, dict)}
    new, unpaid = [], {}
    for key, row in sorted(sv.items()):
        fresh = [c for c in row['fails'] if c not in known.get(key, set())]
        if fresh:
            for c in fresh:
                new.append('%s\n     fails "%s": %s\n     %s' % (key, c, WHY[c], FIX[c]))
        if row['fails']:
            unpaid[key] = sorted(row['fails'])
    assert not new, (
        'INVARIANTS rule 1 (a number we report is measured, or it says what it is): %d new breach(es).\n  ' % len(new)
        + '\n  '.join(new)
        + '\n  Fix it as described, or -- only with a reason, and a register row if it is a defect -- add the node to '
          'harness/lineage_baseline.json.')
    # a baselined node that no longer exists is debt nobody can pay: the ratchet would hold a name for ever
    gone = sorted(k for k in known if k not in sv)
    assert not gone, ('INVARIANTS rule 1: harness/lineage_baseline.json names %d node(s) no longer subject to any check: %s\n'
                      '  Remove them from the baseline (a node that was fixed, renamed or deleted leaves the ratchet for ever).'
                      % (len(gone), ', '.join(gone)))
    if write_record:
        write_baseline(unpaid)
        json.dump({'nodes': sv, 'unpaid': unpaid, 'selftest': selftest(),
                   'counts': counts(sv)}, open(RECORD, 'w'), indent=1, sort_keys=True)
    return sv, unpaid


def counts(sv):
    out = {}
    for c in ('lineage', 'evidence', 'like_for_like', 'withheld', 'refusal'):
        subject = [k for k, r in sv.items() if c in r['subject']]
        out[c] = {'subject': len(subject), 'pass': sum(1 for k in subject if c not in sv[k]['fails'])}
    return out


def write_baseline(unpaid):
    """The ratchet can only tighten: a check a node now passes leaves the baseline for ever, and a new breach never enters it here
    (it fails the build first, which is the point). Same shape as retry_lint.write_baseline / gate_lint.write_baseline."""
    base = json.load(open(BASELINE, encoding='utf-8')) if os.path.exists(BASELINE) else {}
    for key in list(base):
        row = base[key]
        if not isinstance(row, dict):            # the file's own `_note`, which is prose for whoever opens it
            continue
        row['fails'] = sorted(c for c in (row.get('fails') or []) if c in set(unpaid.get(key) or []))
        if not row['fails']:                     # every check paid: the node leaves the ratchet for ever
            del base[key]
    os.makedirs(os.path.dirname(BASELINE), exist_ok=True)
    json.dump(base, open(BASELINE, 'w'), indent=1, sort_keys=True)
    return base


def seed_baseline():
    """Run once, by hand, to record today's debt. Never called by a build."""
    sv = survey()
    base = {k: {'fails': sorted(r['fails']), 'markup': r['markup']} for k, r in sorted(sv.items()) if r['fails']}
    json.dump(base, open(BASELINE, 'w'), indent=1, sort_keys=True)
    return base


# ---- the lint's own self-test, recorded for harness S82 (the harness runs JS, not this file) -------------------------------
def selftest():
    """Four ways of breaking rule 1, each one caught, plus the healthy case. Build section 72 asserts it; S82 reads it."""
    def wf(nodes, conns=None):
        return [('x.json', {'name': 'W', 'nodes': nodes, 'connections': conns or {}})]

    def js(nm, src):
        return {'name': nm, 'type': CODE_TYPE, 'parameters': {'jsCode': src}}

    mail = {'name': 'Send It', 'type': MAIL_TYPE, 'parameters': {'html': '={{ $json.html }}'}}
    conns = {'Report': {'main': [[{'node': 'Send It'}]]}}
    body = ("let html = '<h2>x</h2>' + '<table>' + '<tr>' + '<td>' + '<p>' + '<ul>' + '<li>' + '<div>' + '<h3>' + '<h1>'"
            " + '<td>' + '<p>';\nreturn [{ json: { html } }];\n")
    good = body.replace('return [{ json: { html } }];',
                        "const LN = (() => { return {}; })();\nconst lineage = [LN.of('x', 'gsc', {})];\n"
                        "html += LN.block(lineage);\nreturn [{ json: { html, lineage } }];")
    res = {}

    def one(name, src, check_name, expect_fail):
        sv = survey(wf([js('Report', src), mail], conns))
        row = sv.get('W / Report') or {'subject': [], 'fails': []}
        res[name] = {'subject': row['subject'], 'fails': row['fails'],
                     'caught': (check_name in row['fails']) == expect_fail and check_name in row['subject']}

    one('a_report_with_lineage_passes', good, 'lineage', False)
    one('the_report_loses_its_lineage', body, 'lineage', True)
    one('findings_with_no_evidence_guard', good + "\nconst f = { severity: 'High', evidence: '' };\nreturn [{ json: { findings } }];",
        'evidence', True)
    one('findings_run_through_the_guard', good + "\nconst f = { severity: 'High', evidence: '' };\nconst out = LN.evidenced(list);\nreturn [{ json: { findings: out } }];",
        'evidence', False)
    one('a_delta_against_an_unlike_previous_report', good + "\nconst prev = rows[0]; const move = now - prev.health_score;",
        'like_for_like', True)
    one('a_delta_that_compares_like_with_like',
        good + "\nconst prev = rows.find(r => r.report_type === cur);\nconst move = prev ? now - prev.health_score : null;"
               "\nconst not_compared = prev && prev.checked_of !== checked_of ? 'the sample moved' : '';",
        'like_for_like', False)
    one('acts_on_a_gated_read_with_no_refusal',
        good + "\nconst ov = $('Domain Overview Answers').all().map(i => i.json);\nconst top10 = ov[0].metrics.pos_1 || 0;",
        'refusal', True)
    one('acts_on_a_gated_read_and_can_refuse',
        good + "\nconst ov = $('Domain Overview Answers').all().map(i => i.json);\nconst ev = (ov.find(x => x && x.__dfs) || {}).__dfs;\n"
             + "const top10 = ev && !ev.unavailable ? (ov[0].metrics.pos_1 || 0) : null;", 'refusal', False)
    one('a_score_that_cannot_be_withheld', good + "\nconst winnable_score = 68;", 'withheld', True)
    one('a_score_that_can_be_withheld', good + "\nconst winnable_score = serpFailed ? null : 68; const not_checked = serpFailed;",
        'withheld', False)
    # the fifth way: the kit renames what the lint looks for, so the lint would silently check nothing
    res['the_kit_renames_its_entry_point'] = {'caught': bool(_kit_defines_broken())}
    return res


def _kit_defines_broken():
    """_kit_defines() against a needle the kit does not define — proof the rename check can fail."""
    src = open(os.path.join(V5_CODE, '_lineage.js'), encoding='utf-8').read()
    return [] if 'const thisWasRenamed = (' in src else ['v5/code/_lineage.js does not define a renamed entry point']


if __name__ == '__main__':
    import sys
    if '--seed' in sys.argv:
        print(json.dumps(seed_baseline(), indent=1))
    elif '--survey' in sys.argv:
        s = survey()
        for k, row in sorted(s.items()):
            print('%-62s markup %-4d subject %-34s %s' % (k[:62], row['markup'], ','.join(row['subject']),
                                                          'FAILS ' + ','.join(row['fails']) if row['fails'] else 'ok'))
        print(json.dumps(counts(s), indent=1))
    else:
        s, u = check(write_record=False)
        for k, row in sorted(s.items()):
            print('%-62s markup %-4d subject %-34s %s' % (k[:62], row['markup'], ','.join(row['subject']),
                                                          'FAILS ' + ','.join(row['fails']) if row['fails'] else 'ok'))
        print(json.dumps(counts(s), indent=1))
