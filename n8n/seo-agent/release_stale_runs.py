#!/usr/bin/env python3
"""release_stale_runs.py — one-off: releases `seo_run_ledger` reservations that no run will ever settle (P34-5, 2026-10-12).

Every execution of the main workflow appends one row to `seo_run_ledger` *before* the limits are checked (D1) and settles it at the end
(status `done`). A run that dies without reaching its last node leaves the row `reserved` for ever, and Rate Limit keeps counting its
estimate against the day's AI budget. The Phase 3 + 4 live check lost two 200-page audits that way: the n8n JavaScript task runner
stopped answering, both executions were cancelled at the 90-minute timeout, and rows 26 and 27 still hold their reservation
(11 rows, $0.77 in total, on 2026-10-12).

From this deploy on the workflow does it by itself: *Release Stale Runs* marks a reservation older than `CONFIG.run_stale_hours`
(2 hours) as `stale`, and Rate Limit leaves stale rows out of the count and of the budget. This script is for the rows that were
already stuck before that node existed, and for a one-off clean-up after an incident.

    python3 release_stale_runs.py                       # dry run (default): prints every row it would release
    python3 release_stale_runs.py --hours 2             # the age limit (default 2, the same as CONFIG.run_stale_hours)
    python3 release_stale_runs.py --apply               # writes status = stale (one PATCH per row, by row id)
    python3 release_stale_runs.py --run 459 --apply     # one execution's row only

A row is released only when it is still `reserved` and older than the age limit. `done`, `refused` and `stale` rows are never touched,
and nothing but `status` is written, so the reservation's own figures stay readable in the table.

Reads and writes through the n8n public API (key N8N_API_KEY from n8n/.env or app/.env), like sync_tables.py and fix_ladder_hosts.py.
"""
import json, os, sys, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from env_settings import load_env
from ladder_common import RUN_LEDGER_TABLE

BASE = os.environ.get('N8N_PUBLIC_URL', 'http://localhost:5678').rstrip('/') + '/api/v1'
DEFAULT_HOURS = 2.0   # keep in step with CONFIG.run_stale_hours in Normalize Input (build_v4.py section 43)


def api_key():
    k = load_env().get('N8N_API_KEY')
    if k:
        return k
    p = os.path.join(HERE, '..', '..', 'app', '.env')
    if os.path.exists(p):
        for line in open(p, encoding='utf-8'):
            if line.startswith('N8N_API_KEY='):
                return line.split('=', 1)[1].strip().strip('"').strip("'")
    return ''


def call(key, path, method='GET', body=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'X-N8N-API-KEY': key, 'Content-Type': 'application/json', 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read() or b'null')


def table_id(key, name):
    cursor = None
    while True:
        page = call(key, '/data-tables?limit=100' + ('&cursor=' + urllib.parse.quote(cursor) if cursor else ''))
        for t in page.get('data', []):
            if t.get('name') == name:
                return t['id']
        cursor = page.get('nextCursor')
        if not cursor:
            return ''


def rows(key, tid, limit=4000):
    out, cursor = [], None
    while len(out) < limit:
        page = call(key, '/data-tables/%s/rows?limit=250%s' % (tid, '&cursor=' + urllib.parse.quote(cursor) if cursor else ''))
        out.extend(page.get('data', []))
        cursor = page.get('nextCursor')
        if not cursor:
            break
    return out


def parse_at(v):
    s = str(v or '').strip().replace('Z', '+00:00')
    try:
        d = datetime.fromisoformat(s)
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def plan(ledger, hours, only_run=''):
    """Returns (stale, left): stale are (row, age_hours) rows still reserved and older than the age limit."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    stale, left = [], []
    for r in ledger:
        if only_run and str(r.get('run_id') or '') != str(only_run):
            continue
        if str(r.get('status') or '') != 'reserved':
            left.append((r, 'status %s' % (r.get('status') or '-'))); continue
        at = parse_at(r.get('created_at'))
        if not at:
            left.append((r, 'no readable created_at')); continue
        age = (datetime.now(timezone.utc) - at).total_seconds() / 3600.0
        if at >= cutoff:
            left.append((r, 'only %.1f h old (the limit is %.1f h)' % (age, hours))); continue
        stale.append((r, age))
    return stale, left


def main():
    argv = sys.argv[1:]
    apply = '--apply' in argv
    hours, only_run = DEFAULT_HOURS, ''
    if '--hours' in argv:
        i = argv.index('--hours')
        hours = float(argv[i + 1]) if i + 1 < len(argv) else DEFAULT_HOURS
    if '--run' in argv:
        i = argv.index('--run')
        only_run = argv[i + 1] if i + 1 < len(argv) else ''
    key = api_key()
    if not key:
        print('release_stale_runs: no N8N_API_KEY in n8n/.env or app/.env'); return 2
    tid = table_id(key, RUN_LEDGER_TABLE)
    if not tid:
        print('release_stale_runs: the table %s does not exist yet — nothing to do' % RUN_LEDGER_TABLE); return 0
    ledger = rows(key, tid)
    stale, left = plan(ledger, hours, only_run)
    held = sum(float(r.get('est_usd') or 0) for r, _ in stale)
    print('release_stale_runs: %d ledger row(s); %d reservation(s) older than %.1f h hold $%.2f of the budget estimate, %d left alone'
          % (len(ledger), len(stale), hours, held, len(left)))
    for r, age in stale:
        print('  %s run %s  mode %-14s key %-28s $%-6s reserved %s (%.1f h ago)%s'
              % ('WOULD RELEASE' if not apply else 'RELEASE      ', r.get('run_id'), r.get('mode') or '-', str(r.get('key') or '-')[:28],
                 r.get('est_usd'), str(r.get('created_at') or '')[:19], age, '  heavy ' + str(r.get('domain') or '') if r.get('heavy') else ''))
    if not apply:
        print('\ndry run (default): nothing was written. Re-run with --apply to mark these %d row(s) `stale`.' % len(stale))
        return 0
    failed = 0
    for r, _age in stale:
        body = {'filter': {'type': 'and', 'filters': [{'columnName': 'id', 'condition': 'eq', 'value': r['id']}]}, 'data': {'status': 'stale'}}
        try:
            call(key, '/data-tables/%s/rows/update' % tid, 'PATCH', body)
        except Exception as e:
            failed += 1; print('  FAILED row %s: %s' % (r.get('id'), str(e)[:120]))
    print('release_stale_runs: released %d row(s)%s — $%.2f of the budget estimate is free again'
          % (len(stale) - failed, (', %d failed' % failed) if failed else '', held))
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
