#!/usr/bin/env python3
"""fix_phantom_pages.py — one-off: gives back the `seo_ladders` rows that claim a page nobody wrote (R1, 2026-10-13).

A ladder row goes to `writing` the moment the plan starts its page run. When that run is refused — the day's AI budget guard refused
execution 500 of the re-rating run — or dies before the page exists, the row keeps saying `writing`, and three features then report a
page that does not exist: the ladder plan promises it, the Rank Tracker says "already written — publish it", and the Content Cadence
counts it among the pages waiting for publication and pauses the site's writing on the pile-up limit.

From this deploy on the engine does it by itself (*Refused Ladder Row* → *Release Ladder Row* on the refusal path, and the three
features count a page as written only when `seo_content_log` says `written`). This script is for the rows that were already stuck
before that node existed.

It never assumes a state: the dry run (the default) reads the live `seo_ladders` and `seo_content_log` rows and prints exactly what it
would change, row by row, with the reason, plus the `writing` rows it is keeping and why. A row whose page was written since — the
refused runs of 2026-10-13 were re-run successfully the next morning, so "service industry erp software" now has its `written` row —
is listed as kept and left untouched. Read that output before using --apply.

    python3 fix_phantom_pages.py                             # dry run (default): prints every row it would give back
    python3 fix_phantom_pages.py --domain techand.ai         # one website only
    python3 fix_phantom_pages.py --ladder lad_mv5pjt5y4aoa   # one ladder only
    python3 fix_phantom_pages.py --apply                     # writes status = planned + status_note (one PATCH per row, by row id)

A row is given back only when it is `writing`, has no published URL of its own, and no `seo_content_log` row for the same website and
keyword says `written` or `published`. A row whose page really was written is never touched, and nothing but `status` and
`status_note` is written, so the plan, the word target and the dates stay as they are.

`status_note` is a column added with R1: run `sync_tables.py` (or `apply_env.py`) on the deploy before using --apply.

Reads and writes through the n8n public API (key N8N_API_KEY from n8n/.env or app/.env), like release_stale_runs.py and sync_tables.py.
"""
import json, os, re, sys, urllib.parse, urllib.request
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from env_settings import load_env
from ladder_common import LADDER_TABLE, LOG_TABLE

BASE = os.environ.get('N8N_PUBLIC_URL', 'http://localhost:5678').rstrip('/') + '/api/v1'


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


def rows(key, tid, limit=6000):
    out, cursor = [], None
    while len(out) < limit:
        page = call(key, '/data-tables/%s/rows?limit=250%s' % (tid, '&cursor=' + urllib.parse.quote(cursor) if cursor else ''))
        out.extend(page.get('data', []))
        cursor = page.get('nextCursor')
        if not cursor:
            break
    return out


normd = lambda v: re.sub(r'[/?#].*$', '', re.sub(r'^www\.', '', re.sub(r'^https?://', '', str(v or '').strip().lower())))
normk = lambda v: re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9]+', ' ', str(v or '').lower())).strip()


def plan(ladders, logs, domain='', ladder_id=''):
    """Returns (phantom, kept): phantom are (row, why) rows saying `writing` with no written page behind them."""
    written = set()
    for l in logs:
        if str(l.get('status') or '') in ('written', 'published') or str(l.get('published_url') or '').strip():
            written.add((normd(l.get('domain')), normk(l.get('keyword'))))
    phantom, kept = [], []
    for r in ladders:
        if domain and normd(r.get('domain')) != normd(domain):
            continue
        if ladder_id and str(r.get('ladder_id') or '') != ladder_id:
            continue
        if str(r.get('status') or '') != 'writing':
            continue
        if str(r.get('published_url') or '').strip():
            kept.append((r, 'it has a published URL')); continue
        if (normd(r.get('domain')), normk(r.get('keyword'))) in written:
            kept.append((r, 'seo_content_log says the page was written')); continue
        phantom.append((r, 'no seo_content_log row says `written` for this website and keyword'))
    return phantom, kept


def main():
    argv = sys.argv[1:]
    apply = '--apply' in argv
    domain = ladder_id = ''
    if '--domain' in argv:
        i = argv.index('--domain'); domain = argv[i + 1] if i + 1 < len(argv) else ''
    if '--ladder' in argv:
        i = argv.index('--ladder'); ladder_id = argv[i + 1] if i + 1 < len(argv) else ''
    key = api_key()
    if not key:
        print('fix_phantom_pages: no N8N_API_KEY in n8n/.env or app/.env'); return 2
    lid, gid = table_id(key, LADDER_TABLE), table_id(key, LOG_TABLE)
    if not lid:
        print('fix_phantom_pages: the table %s does not exist yet — nothing to do' % LADDER_TABLE); return 0
    ladders, logs = rows(key, lid), (rows(key, gid) if gid else [])
    phantom, kept = plan(ladders, logs, domain, ladder_id)
    print('fix_phantom_pages: %d ladder row(s), %d content-log row(s); %d row(s) claim a page nobody wrote, %d `writing` row(s) are real'
          % (len(ladders), len(logs), len(phantom), len(kept)))
    today = datetime.now(timezone.utc).date().isoformat()
    for r, why in phantom:
        print('  %s id %-4s %-22s rung %-2s "%s" (%s) — %s'
              % ('WOULD GIVE BACK' if not apply else 'GIVE BACK      ', r.get('id'), r.get('ladder_id'), r.get('rung'),
                 r.get('keyword'), normd(r.get('domain')), why))
    for r, why in kept:
        print('  keeping        id %-4s "%s": %s' % (r.get('id'), r.get('keyword'), why))
    if not apply:
        print('\ndry run (default): nothing was written. Re-run with --apply to set these %d row(s) back to `planned`.' % len(phantom))
        return 0
    failed = 0
    for r, why in phantom:
        note = ('given back %s by fix_phantom_pages.py: %s. The page was not written; it is planned again.' % (today, why))[:480]
        body = {'filter': {'type': 'and', 'filters': [{'columnName': 'id', 'condition': 'eq', 'value': r['id']}]},
                'data': {'status': 'planned', 'status_note': note}}
        try:
            call(key, '/data-tables/%s/rows/update' % lid, 'PATCH', body)
        except Exception as e:
            failed += 1; print('  FAILED row %s: %s' % (r.get('id'), str(e)[:160]))
    print('fix_phantom_pages: gave back %d row(s)%s — the cadence, the Rank Tracker and the ladder plan stop promising those pages'
          % (len(phantom) - failed, (', %d failed' % failed) if failed else ''))
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
