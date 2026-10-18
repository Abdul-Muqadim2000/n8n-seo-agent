#!/usr/bin/env python3
"""fix_not_ready_drafts.py — one-off: the `seo_content_log` rows that say `written` for a page whose LAST quality round failed (R111,
re-rating 2026-10-15, written 2026-10-16).

Until this deploy *Content Log Row* wrote `status: written` whenever the blog package held article text, whatever the page's final quality
verdict was — and nine readers turn `written` into "publish it": the weekly site report's top action ("P1 Publish the written page for
"ai consulting" … I published it"), the Rank Tracker's "already written — publish it", the cadence's pile-up note, the Claude site brief.
From this deploy on the row says `not_ready` (with the last round's reasons in the new `qa_reasons` column) when the verdict is "did not
pass the quality check — not ready to publish". This script is for the rows written before that: it gives them the status their own run
decided.

**Absence needs positive evidence**, exactly as in fix_phantom_pages.py: a row is marked only when the run that wrote it says its last
quality round failed. Sources, in order:
  1. **n8n's executions** of the main workflow: the newest page run for that website + keyword whose *Blog Package* carries the verdict
     (`qa_not_ready`, `qa_reasons`), and — when both are known — whose request id is the row's own. A run that PASSED keeps the row
     `written`.
  2. the **dossier record** (`docs/system-review-2026-10-15/defects/D_app_reporting.md`, R111): the two drafts the re-rating saw fail —
     "ai consulting" (exec 616, request 609) and "azure api management monetization" (exec 554, request 548). Used only when the
     executions hold no verdict for the row (pruned history, or unreadable), and only for a row whose request id is the one recorded.
  3. never touched, whatever any source says: rows 3 and 4 of the live table ("erp software uae", "service industry erp software"),
     which the dossier records as passed / "items to review", not failed.
A row that is `published`, `started`, already `not_ready`, or has a published URL is never touched. Nothing else is inferred: a row with no
verdict anywhere stays `written`.

    python3 fix_not_ready_drafts.py                       # dry run (default): the verdict for every `written` row, with its evidence
    python3 fix_not_ready_drafts.py --domain techand.ai   # one website only
    python3 fix_not_ready_drafts.py --apply               # writes status = not_ready + qa_reasons on the failed drafts (one PATCH per row)

`qa_reasons` is a column added with R111: run `sync_tables.py` (or `apply_env.py`) on the deploy before using --apply; the script refuses
to write when the table does not have it yet. Reads and writes through the n8n public API (key N8N_API_KEY), like fix_phantom_pages.py.
Tests: `test_fix_not_ready_drafts.py` beside this file (the rule is pure Python).
"""
import os, sys, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from ladder_common import LOG_TABLE, LOG_COLS
from fix_phantom_pages import api_key, call, table_id, rows, normd, normk, arg

PAGE_WORKFLOWS = ['SEOagentV4Full01']
PAGE_NODE, INPUT_NODE = 'Blog Package', 'Normalize Input'
# the dossier's record (R111): the two drafts the 2026-10-15 re-rating saw fail their last quality round, with the run that wrote each
DOSSIER_FAILED = {
    ('techand.ai', 'ai consulting'): {'request_id': '609', 'where': 'the dossier (R111): page run exec 616, request 609, "did not pass the quality check — not ready to publish (round 2 of 2)"',
                                      'reasons': ['it covers 60% of the terms the best-ranking page covers, against a target of 90%',
                                                  'External links to sources not in the evidence plan: centralbank.ae, difc.com, adgm.com — verify each one']},
    ('techand.ai', 'azure api management monetization'): {'request_id': '548', 'where': 'the dossier (R111): page run exec 554 (2026-10-14), request 548, "did not pass the quality check — not ready to publish"',
                                                          'reasons': ['the last quality round did not pass: see the page report of request 548 for its reasons']},
}
# rows 3 and 4 of the live table: passed, or "items to review" — never failed (the dossier's "Watch out")
KEEP_WRITTEN = {('techand.ai', 'erp software uae'): 'the dossier (R111): its last quality round passed / had items to review — it stays `written`',
                ('techand.ai', 'service industry erp software'): 'the dossier (R111): its last quality round passed / had items to review — it stays `written`'}


def exec_verdicts(key, keys, verbose=True):
    """The newest page run's quality verdict per (domain, keyword). Returns ({key: verdict}, note); (None, why) when unreadable."""
    listed = []
    try:
        for wf in PAGE_WORKFLOWS:
            cursor = None
            while True:
                page = call(key, '/executions?limit=250&workflowId=' + urllib.parse.quote(wf) + ('&cursor=' + urllib.parse.quote(cursor) if cursor else ''))
                listed.extend(page.get('data', []))
                cursor = page.get('nextCursor')
                if not cursor:
                    break
    except Exception as e:
        return None, "n8n's executions could not be listed: %s" % str(e)[:140]
    found = {}
    if verbose:
        print("  n8n executions   : %d run(s) of %s, reading each run's data (slow)…" % (len(listed), ', '.join(PAGE_WORKFLOWS)), flush=True)
    for e in sorted(listed, key=lambda x: str(x.get('startedAt') or ''), reverse=True):
        if all(k in found for k in keys):
            break
        try:
            raw = call(key, '/executions/%s?includeData=true' % e.get('id'), timeout=300)
        except Exception as ex:
            return None, "n8n's execution %s could not be read (%s)" % (e.get('id'), str(ex)[:100])
        rd = (((raw.get('data') or {}).get('resultData') or {}).get('runData')) or {}

        def first(node):
            try:
                return rd[node][0]['data']['main'][0][0]['json'] or {}
            except Exception:
                return {}
        ni, bp = first(INPUT_NODE), first(PAGE_NODE)
        k = (normd(ni.get('domain')), normk(ni.get('keyword')))
        if k not in keys or k in found or bp.get('qa_not_ready') is None:
            continue                                                    # no page, or no verdict on the package: not evidence
        found[k] = verdict(bp, str(ni.get('request_id') or ''), 'n8n execution %s (%s)' % (e.get('id'), str(raw.get('startedAt') or '?')[:19]))
    return found, ''


def verdict(package, request_id, where):
    """One run's verdict, read from its Blog Package (the fields *Build Word File* sets from the final quality round)."""
    return {'not_ready': package.get('qa_not_ready') is True, 'reasons': [str(x) for x in (package.get('qa_reasons') or []) if str(x).strip()],
            'request_id': request_id, 'where': where}


# ---------------------------------------------------------------- the rule (pure: tested by test_fix_not_ready_drafts.py)

def judge(logs, execs, domain='', known=None, keep=None):
    """Returns (mark, kept). mark: [(row, {'status': 'not_ready', 'qa_reasons': …}, why)]; kept: [(row, why)] for every `written` row.

    `execs` — {(domain, keyword): verdict} from exec_verdicts(), or None when n8n's executions could not be read."""
    known = DOSSIER_FAILED if known is None else known
    keep = KEEP_WRITTEN if keep is None else keep
    mark, kept = [], []
    for r in logs or []:
        if domain and normd(r.get('domain')) != normd(domain):
            continue
        if str(r.get('status') or '') != 'written' or str(r.get('published_url') or '').strip():
            continue                                                    # only a row that claims "passed, waiting to be published"
        k = (normd(r.get('domain')), normk(r.get('keyword')))
        rid = str(r.get('request_id') or '')
        if k in keep:
            kept.append((r, keep[k])); continue
        ev = (execs or {}).get(k)
        if ev and ev.get('request_id') and rid and ev['request_id'] != rid:
            ev = None                                                   # the newest verdict belongs to another run of the keyword
        if ev:
            if ev['not_ready']:
                mark.append((r, {'status': 'not_ready', 'qa_reasons': '; '.join(ev['reasons'])[:1500]},
                             'its last quality round failed: %s%s' % (ev['where'], (' — ' + '; '.join(ev['reasons'][:2]))[:300] if ev['reasons'] else '')))
            else:
                kept.append((r, 'its last quality round passed: ' + ev['where']))
            continue
        kn = known.get(k)
        if kn and (not kn.get('request_id') or not rid or kn['request_id'] == rid):
            mark.append((r, {'status': 'not_ready', 'qa_reasons': '; '.join(kn['reasons'])[:1500]},
                         'its last quality round failed: %s%s' % (kn['where'], '' if execs is not None else " (n8n's executions could not be read)")))
            continue
        kept.append((r, 'no quality verdict on record for its run — nothing is called a failed draft on silence'
                        + ('' if execs is not None else " (n8n's executions could not be read)")))
    return mark, kept


def main():
    argv = sys.argv[1:]
    apply = '--apply' in argv
    domain, env_file = arg(argv, '--domain'), arg(argv, '--env-file')
    key = api_key(env_file)
    if not key:
        print('fix_not_ready_drafts: no N8N_API_KEY in n8n/.env, app/.env, the environment or --env-file'); return 2
    gid = table_id(key, LOG_TABLE)
    if not gid:
        print('fix_not_ready_drafts: the table %s does not exist yet — nothing to do' % LOG_TABLE); return 0
    logs = rows(key, gid)
    cand = {(normd(r.get('domain')), normk(r.get('keyword'))) for r in logs
            if str(r.get('status') or '') == 'written' and (not domain or normd(r.get('domain')) == normd(domain))}
    print('fix_not_ready_drafts: %d %s row(s), %d say `written`' % (len(logs), LOG_TABLE, len(cand)))
    execs, note = exec_verdicts(key, cand) if cand else ({}, '')
    if note:
        print("  n8n executions   : UNREADABLE — " + note + ' (only the dossier record is used)')
    mark, kept = judge(logs, execs, domain)
    for r, data, why in mark:
        print('  %s id %-4s "%s" (%s)\n        why: %s' % ('WOULD MARK not_ready' if not apply else 'MARK not_ready      ', r.get('id'), r.get('keyword'), normd(r.get('domain')), why))
    for r, why in kept:
        print('  keeping              id %-4s "%s"\n        %s' % (r.get('id'), r.get('keyword'), why))
    if not apply:
        print('\ndry run (default): nothing was written.' + ('\nRe-run with --apply to mark those %d row(s) `not_ready` (run sync_tables.py first: the qa_reasons column).' % len(mark) if mark else ''))
        return 0
    if logs and not any('qa_reasons' in r for r in logs):
        print('fix_not_ready_drafts: %s has no qa_reasons column yet — run sync_tables.py (or apply_env.py) first; nothing was written' % LOG_TABLE); return 1
    failed = 0
    for r, data, why in mark:
        body = {'filter': {'type': 'and', 'filters': [{'columnName': 'id', 'condition': 'eq', 'value': r['id']}]}, 'data': {c: data[c] for c in data if c in [x for x, _t in LOG_COLS]}}
        try:
            call(key, '/data-tables/%s/rows/update' % gid, 'PATCH', body)
        except Exception as e:
            failed += 1; print('  FAILED row %s: %s' % (r.get('id'), str(e)[:160]))
    print('fix_not_ready_drafts: marked %d row(s) not_ready%s — the readers now say "fix it and run it again", never "publish it"'
          % (len(mark) - failed, (', %d failed' % failed) if failed else ''))
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
