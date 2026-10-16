#!/usr/bin/env python3
"""fix_phantom_pages.py — one-off: the `seo_ladders` rows that claim a page nobody wrote (R1, 2026-10-13; rule corrected 2026-10-14).

A ladder row goes to `writing` the moment the plan starts its page run. When that run is refused — the day's AI budget guard refused
execution 500 of the re-rating run — or dies before the page exists, the row keeps saying `writing`, and three features then report a
page that does not exist: the ladder plan promises it, the Rank Tracker says "already written — publish it", and the Content Cadence
counts it among the pages waiting for publication and pauses the site's writing on the pile-up limit.

From this deploy on the engine does it by itself (*Refused Ladder Row* → *Release Ladder Row* on the refusal path, and the three
features count a page as written only when `seo_content_log` says `written`). This script is for the rows that were already stuck
before that node existed.

**The rule this script was born with was wrong and would have destroyed real work.** It called a `writing` row a phantom when no
`seo_content_log` row said `written`. Ladder pages only reach the content log from v4.14 (deployed 2026-10-12 14:00 Asia/Karachi), so
on the live tables that rule flagged four pages that had really been written and are waiting for the owner's publication decision
(FIX_PLAN **O9**): "uae e invoicing penalties" (no log row at all), "e invoicing uae fta" and "peppol uae" (log rows saying `started`)
and "vendor invoice automation dynamics 365" (no log row). Setting them back to `planned` would have told the system four real pages do
not exist, and the Content Cadence would have written them again at ≈ $1.20 each — duplicating pages the owner is still deciding about.

So **absence now needs positive evidence**. A row is a phantom only when *nothing anywhere* says a page exists, and only when every
source could be read:
  1. `seo_content_log` — any status, not only `written`. A `started` row is evidence that a page run happened for that keyword, so the
     row is ambiguous, never a phantom.
  2. the web app's `reports` table — every finished run posts a callback that lands there; a `content` report with
     `summary->>'hasPage' = 'true'` is a page the app received. Read **read-only** (`default_transaction_read_only`), over psycopg,
     `psql`, or `docker exec` into the app's Postgres container.
  3. **n8n's executions** — a page/content run naming that keyword whose *Blog Package* carries an article. This is the only source
     that proves the oldest pages (the 2026-10-02 runs delivered to the test callback, before the app existed).
  4. a **date guard**: a row whose `start_date` predates ladder-page logging cannot be judged by the content log's silence. Such a row
     is a phantom only when the execution history still reaches back past its start date *and* names a run for that keyword that
     produced no page.
  5. the **O9 belt and braces**: a row whose keyword is one of the owner's pending-publication pages is never touched, whatever the
     evidence says.
If a source cannot be reached, the script says so and calls **nothing** a phantom.

    python3 fix_phantom_pages.py                             # dry run (default): the verdict for every `writing` row, with its evidence
    python3 fix_phantom_pages.py --domain techand.ai         # one website only
    python3 fix_phantom_pages.py --ladder lad_mv5pjt5y4aoa   # one ladder only
    python3 fix_phantom_pages.py --apply                     # writes status = planned + status_note on the phantoms (one PATCH per row)
    python3 fix_phantom_pages.py --mark-written              # dry run: the honest status for the rows whose page is proven
    python3 fix_phantom_pages.py --mark-written --apply      # writes it

`--mark-written` is the other half of the repair: `writing` is wrong for a page that exists and waits for the owner. It is the
**smallest accurate change**, because `seo_content_log.status` — not the ladder row — is what every feature reads as proof that a page
exists (Cadence_Plan's pile-up guard, Tracker_Report's "publish it", Site_Metrics' "written, not published yet", Publish Candidates,
the app's `waiting` state). So it:
  * upserts the `seo_content_log` row for the page to `status: written` (by site_id + keyword, exactly the table's columns), keeping the
    run that opened the row (`request_id`, `started_at`) or, for a page that was never logged, carrying the proof's own id and date;
  * leaves the ladder row at **`writing`** and only fills its `status_note` with the evidence and the page's URL. There is no stored
    ladder status meaning "written, awaiting the owner": `planned` / `writing` / `set_aside` / `published` are the four the engine
    writes, and `writing` + a `written` log row is exactly how all of them read "written, not published yet". The app's `waiting`
    state is derived from that pair, not stored. Inventing a fifth status would make Publish Candidates stop watching the page for
    publication.
It never writes a `published_url` (nothing is live) and never touches a row whose page is not proven.

`status_note` is a column added with R1: run `sync_tables.py` (or `apply_env.py`) on the deploy before using --apply.

Reads and writes through the n8n public API (key N8N_API_KEY from n8n/.env, app/.env, the process environment or --env-file), like
release_stale_runs.py and sync_tables.py. The app's Postgres is only ever read.
Tests: `test_fix_phantom_pages.py` beside this file (S64 — the rule is pure Python, so it cannot run in the JS harness).
"""
import json, os, re, shutil, subprocess, sys, urllib.parse, urllib.request
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from env_settings import load_env
from ladder_common import LADDER_TABLE, LOG_TABLE, LOG_COLS

BASE = os.environ.get('N8N_PUBLIC_URL', 'http://localhost:5678').rstrip('/') + '/api/v1'

# v4.14 (FIX_PLAN D5, commit 1ddb9c1, deployed 2026-10-12 14:01 +05:00 = 09:01 UTC): before this, a keyword-ladder page run wrote no
# `seo_content_log` row at all, so the content log's silence about an older row says nothing about whether its page exists.
LOG_SINCE = '2026-10-12T09:00:00+00:00'
# The workflows whose executions write pages (the Content Cadence and the app spawn runs of the main workflow; they write no page
# themselves). *Blog Package* carrying an article is the proof that a page came out of a run — Content_Log_Row.js reads the same node.
PAGE_WORKFLOWS = ['SEOagentV4Full01']
PAGE_NODE, LOG_NODE, REFUSED_NODE = 'Blog Package', 'Content Log Row', 'Mark Run Refused'
# FIX_PLAN O9 (owner track): the pages that are written, not published, and waiting for the owner's decision — named by the live
# Content Cadence run (exec 506: "6 written pages waiting for publication"). None of them is ever touched by this script.
O9_PENDING = {
    'uae e invoicing penalties': 'O9 says: do NOT publish this one — refresh the live /insights article instead',
    'e invoicing uae fta': 'O9: waiting for the owner\'s publication decision',
    'peppol uae': 'O9: waiting for the owner\'s publication decision',
    'vendor invoice automation dynamics 365': 'O9: waiting for the owner\'s publication decision',
    'erp software uae': 'O9: publish only after D10 (placeholders resolved), then report it with `published`',
    'service industry erp software': 'O9: waiting for the owner\'s publication decision',
}
APP_DB_DEFAULT = 'postgres://seo:seo@127.0.0.1:5433/seo'   # the dev stack (app/compose.dev.yml maps the db container to 5433)


# ---------------------------------------------------------------- n8n public API

def api_key(env_file=''):
    # the environment first, then n8n/.env (or --env-file: in a git worktree the untracked .env is not checked out), then app/.env
    for k in (os.environ.get('N8N_API_KEY'), (load_env(env_file) if env_file else load_env()).get('N8N_API_KEY')):
        if k:
            return k
    p = os.path.join(HERE, '..', '..', 'app', '.env')
    if os.path.exists(p):
        for line in open(p, encoding='utf-8'):
            if line.startswith('N8N_API_KEY='):
                return line.split('=', 1)[1].strip().strip('"').strip("'")
    return ''


def call(key, path, method='GET', body=None, timeout=120):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'X-N8N-API-KEY': key, 'Content-Type': 'application/json', 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
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


def parse_at(v):
    s = str(v or '').strip().replace('Z', '+00:00')
    try:
        d = datetime.fromisoformat(s)
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def is_true(v):
    return v is True or str(v).strip().lower() == 'true'


def iso_z(v):
    """The timestamps the engine writes: 2026-10-02T14:39:09.064Z. Postgres' '… 22:22:23.7+00' and a bare date come out the same way;
    a stamp that is already in that shape is passed through untouched."""
    s = str(v or '').strip()
    if re.match(r'^\d{4}-\d\d-\d\dT[\d:]+(\.\d+)?Z$', s):
        return s
    d = parse_at(s.replace(' ', 'T', 1))
    return d.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z') if d else s


# ---------------------------------------------------------------- source 2: the app's reports table (READ ONLY)

APP_QUERY = ("select r.id, coalesce(s.domain,''), coalesce(r.payload->>'keyword',''), coalesce(r.summary->>'hasPage',''), r.status, r.received_at "
             "from reports r left join sites s on s.id = r.site_id where r.stage = 'content' order by r.received_at")


def app_db_url(cli=''):
    if cli:
        return cli
    if os.environ.get('DATABASE_URL'):
        return os.environ['DATABASE_URL']
    p = os.path.join(HERE, '..', '..', 'app', '.env')
    if os.path.exists(p):
        for line in open(p, encoding='utf-8'):
            if line.startswith('DATABASE_URL='):
                return line.split('=', 1)[1].strip().strip('"').strip("'")
    return APP_DB_DEFAULT


def _db_parts(url):
    u = urllib.parse.urlparse(url)
    host, port = u.hostname or '127.0.0.1', u.port or 5432
    if host in ('db', 'postgres', 'app-db'):   # the compose URL is container-internal: from the Mac the db is published on 5433
        host, port = '127.0.0.1', 5433
    return {'host': host, 'port': port, 'user': urllib.parse.unquote(u.username or 'seo'),
            'password': urllib.parse.unquote(u.password or ''), 'db': (u.path or '/seo').lstrip('/') or 'seo'}


def _db_container(port):
    """The app's Postgres container, by the port it publishes (so the reports can be read with no psql on the Mac)."""
    if not shutil.which('docker'):
        return ''
    try:
        out = subprocess.run(['docker', 'ps', '--format', '{{.Names}}\t{{.Ports}}\t{{.Image}}'], capture_output=True, text=True, timeout=30).stdout
    except Exception:
        return ''
    for line in out.splitlines():
        f = line.split('\t')
        if len(f) >= 3 and 'postgres' in f[2] and (':%d->' % port) in f[1]:
            return f[0]
    return ''


def app_reports(url, verbose=True):
    """Every `content` report the app received, read-only. Returns (list, note) — (None, why) when the table cannot be read."""
    p = _db_parts(url)
    where = 'postgres %s:%s/%s' % (p['host'], p['port'], p['db'])   # never the password
    ro = {'options': '-c default_transaction_read_only=on'}
    rows_out, how = None, ''
    try:                                                            # 1. psycopg, when it happens to be installed
        import psycopg                                              # noqa
        with psycopg.connect(host=p['host'], port=p['port'], user=p['user'], password=p['password'], dbname=p['db'],
                             connect_timeout=10, options=ro['options']) as c:
            c.read_only = True
            with c.cursor() as cur:
                cur.execute(APP_QUERY)
                rows_out, how = [tuple(str(x) for x in r) for r in cur.fetchall()], 'psycopg'
    except ImportError:
        pass
    except Exception as e:
        return None, 'the app reports table could not be read over psycopg (%s): %s' % (where, str(e)[:120])
    if rows_out is None:
        env = dict(os.environ, PGPASSWORD=p['password'], PGOPTIONS='-c default_transaction_read_only=on')
        args = ['-U', p['user'], '-d', p['db'], '-At', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-c', APP_QUERY]
        if shutil.which('psql'):                                    # 2. psql on the PATH
            cmd, how = ['psql', '-h', p['host'], '-p', str(p['port'])] + args, 'psql'
        else:                                                       # 3. psql inside the app's Postgres container
            name = _db_container(p['port'])
            if not name:
                return None, ('the app reports table could not be read: no psycopg, no psql and no running Postgres container on port %s '
                              '(start the app dev stack, or pass --db-url)' % p['port'])
            cmd, how = ['docker', 'exec', '-e', 'PGPASSWORD=' + p['password'], '-e', 'PGOPTIONS=-c default_transaction_read_only=on',
                        name, 'psql'] + args, 'docker exec ' + name
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=120, env=env)
        except Exception as e:
            return None, 'the app reports table could not be read (%s): %s' % (how, str(e)[:120])
        if r.returncode != 0:
            return None, 'the app reports table could not be read (%s): %s' % (how, (r.stderr or '').strip().splitlines()[-1][:160] if r.stderr else 'exit %d' % r.returncode)
        rows_out = [l.split('\t') for l in r.stdout.splitlines() if l.strip()]
    out = []
    for f in rows_out:
        if len(f) < 6:
            continue
        out.append({'id': f[0], 'domain': normd(f[1]), 'keyword': f[2], 'has_page': str(f[3]).strip().lower() == 'true',
                    'status': f[4], 'received_at': f[5]})
    if verbose:
        print('  app reports      : %d `content` report(s) read read-only (%s, %s)' % (len(out), how, where))
    return out, ''


# ---------------------------------------------------------------- source 3: n8n's executions

def exec_evidence(key, keys, workflows=None, verbose=True, cache=''):
    """Reads the page-writing workflows' executions. Returns ({kwkey: {...}}, note) — (None, why) when they cannot be read.

    `keys` are the (domain, keyword) pairs still looking for evidence. The result also carries `oldest`: the start of the earliest
    execution the history still holds, which is how far back a verdict of "no run ever wrote this page" can honestly reach."""
    wfs = workflows or PAGE_WORKFLOWS
    listed = []
    try:
        for wf in wfs:
            cursor = None
            while True:
                page = call(key, '/executions?limit=250&workflowId=' + urllib.parse.quote(wf) + ('&cursor=' + urllib.parse.quote(cursor) if cursor else ''))
                listed.extend(page.get('data', []))
                cursor = page.get('nextCursor')
                if not cursor:
                    break
    except Exception as e:
        return None, "n8n's executions could not be listed: %s" % str(e)[:140]
    if not listed:
        return None, "n8n's executions hold no run of %s — nothing can be judged by them" % ', '.join(wfs)
    starts = sorted(str(e.get('startedAt') or '') for e in listed if e.get('startedAt'))
    found = {k: {'pages': [], 'runs': [], 'refused': []} for k in keys}
    seen = json.load(open(cache)) if cache and os.path.exists(cache) else {}
    todo = sorted(listed, key=lambda e: str(e.get('startedAt') or ''), reverse=True)
    if verbose:
        print('  n8n executions   : %d run(s) of %s, reading each run\'s data (slow)…' % (len(listed), ', '.join(wfs)), flush=True)
    for e in todo:
        if all(f['pages'] for f in found.values()):
            break                                                   # every candidate already has a page: stop reading
        eid = str(e.get('id'))
        rec = seen.get(eid)
        if rec is None:
            try:
                raw = call(key, '/executions/%s?includeData=true' % eid, timeout=300)
            except Exception as ex:
                return None, "n8n's execution %s could not be read (%s) — the run that wrote a page may be invisible" % (eid, str(ex)[:100])
            rd = (((raw.get('data') or {}).get('resultData') or {}).get('runData')) or {}

            def first(node):
                try:
                    return rd[node][0]['data']['main'][0][0]['json'] or {}
                except Exception:
                    return {}
            ni, bp, cl = first('Normalize Input'), first(PAGE_NODE), first(LOG_NODE)
            rec = {'id': eid, 'started': str(raw.get('startedAt') or ''), 'status': str(raw.get('status') or ''),
                   'keyword': str(ni.get('keyword') or ''), 'domain': normd(ni.get('domain')), 'mode': str(ni.get('mode') or ''),
                   'page': bool(str(bp.get('article_html') or bp.get('article_markdown') or bp.get('page_markdown') or '').strip())
                           or str(cl.get('status') or '') == 'written',
                   'refused': REFUSED_NODE in rd}
            seen[eid] = rec
            if cache:
                json.dump(seen, open(cache, 'w'))
        k = (rec['domain'], normk(rec['keyword']))
        if k not in found:
            continue
        where = 'n8n execution %s (%s)' % (rec['id'], rec['started'] or '?')   # the full stamp: --mark-written dates the page by it
        if rec['page']:
            found[k]['pages'].append(where + ' wrote the page')
        elif rec['refused']:
            found[k]['refused'].append(where + ' was refused before writing anything')
        else:
            found[k]['runs'].append(where + ' ran without writing a page')
    return {'by_key': found, 'oldest': starts[0] if starts else '', 'count': len(listed)}, ''


# ---------------------------------------------------------------- the rule (pure: tested by test_fix_phantom_pages.py)

def judge(ladders, logs, reports, execs, domain='', ladder_id=''):
    """Returns (phantom, kept): phantom are the `writing` rows nothing anywhere can account for.

    `logs`   — `seo_content_log` rows, or None when the table could not be read.
    `reports`— the app's `content` reports (dicts with keyword / domain / has_page), or None when unreachable.
    `execs`  — the result of exec_evidence(), or None when n8n's executions could not be read.
    A row is a phantom only when every source was readable, none of them knows of a page, the execution history reaches back past the
    row's own start date, and — for a row written before ladder pages were logged — a run for that keyword is on record with no page.
    """
    missing = []
    if logs is None:
        missing.append('`%s` could not be read' % LOG_TABLE)
    if reports is None:
        missing.append("the app's reports table could not be read")
    if execs is None:
        missing.append("n8n's executions could not be read")
    blocked = '; '.join(missing)
    log_rows, rep_rows = list(logs or []), list(reports or [])
    since = parse_at(LOG_SINCE)
    oldest_exec = parse_at((execs or {}).get('oldest'))
    phantom, kept = [], []
    for r in ladders:
        if domain and normd(r.get('domain')) != normd(domain):
            continue
        if ladder_id and str(r.get('ladder_id') or '') != ladder_id:
            continue
        if str(r.get('status') or '') != 'writing':
            continue
        key = (normd(r.get('domain')), normk(r.get('keyword')))
        o9 = O9_PENDING.get(key[1], '')   # belt and braces: such a row is never touched, whatever the evidence says
        if str(r.get('published_url') or '').strip():
            kept.append((r, 'it has a published URL', [])); continue
        if is_true(r.get('page_exists')):
            kept.append((r, 'the page already existed before the run (page_exists)', [])); continue
        # 1. the content log — any status. `written` / `published` prove a page; `started` proves a run happened, which is enough to
        #    refuse: ladder pages were not logged before v4.14, so a `started` row may be all a real page ever left behind.
        proofs, ambiguous = [], []
        for l in log_rows:
            if (normd(l.get('domain')), normk(l.get('keyword'))) != key:
                continue
            st = str(l.get('status') or '')
            if st in ('written', 'published') or str(l.get('published_url') or '').strip():
                proofs.append('%s row %s says `%s`' % (LOG_TABLE, l.get('id'), st or 'published'))
            else:
                ambiguous.append('%s row %s says `%s` — a page run was started for it' % (LOG_TABLE, l.get('id'), st or '(empty)'))
        # 2. the app's reports: a finished content run that carried a page
        for x in rep_rows:
            if normk(x.get('keyword')) != key[1] or (x.get('domain') and normd(x.get('domain')) != key[0]):
                continue
            if x.get('has_page'):
                proofs.append('the app received a finished page for it (report %s, %s)' % (str(x.get('id'))[:8], iso_z(x.get('received_at'))))
        # 3. n8n's executions: a page run that produced an article
        ev = ((execs or {}).get('by_key') or {}).get(key) or {'pages': [], 'runs': [], 'refused': []}
        proofs.extend(ev['pages'])
        o9_line = ['FIX_PLAN O9 — this row is never touched: %s' % o9] if o9 else []
        if proofs:
            kept.append((r, proofs[0], proofs + ambiguous + o9_line)); continue
        # 4. the owner's pending-publication pages: never touched even when no source can prove the page any more
        if o9:
            kept.append((r, 'it is one of the owner\'s pending-publication pages — FIX_PLAN O9 (%s)' % o9, ambiguous)); continue
        if ambiguous:
            kept.append((r, ambiguous[0] + ' (it cannot be called a phantom)', ambiguous)); continue
        # nothing says a page exists — now every reason NOT to trust that silence
        if blocked:
            kept.append((r, 'no source knows of a page, but ' + blocked + ' — nothing is called a phantom on a partial reading', [])); continue
        start = parse_at(r.get('start_date'))
        if not start:
            kept.append((r, 'no source knows of a page, but the row has no readable start_date (%r), so neither date guard can be '
                            'applied to it' % str(r.get('start_date') or '')[:40], [])); continue
        if oldest_exec and start < oldest_exec:
            kept.append((r, 'the execution history only reaches back to %s, after this row started (%s): a run that wrote the page '
                            'would be invisible' % (str((execs or {}).get('oldest'))[:19], str(r.get('start_date'))[:19]), [])); continue
        if since and start < since and not (ev['refused'] or ev['runs']):
            kept.append((r, 'it started before ladder pages were logged (%s) and no execution for this keyword is left to judge it by: '
                            'the content log\'s silence proves nothing' % LOG_SINCE[:10], [])); continue
        why = ('nothing anywhere says a page exists: no %s row, no finished page in the app\'s reports, and %s'
               % (LOG_TABLE, '; '.join(ev['refused'] + ev['runs']) if (ev['refused'] or ev['runs']) else 'no page run for this keyword in n8n\'s executions'))
        phantom.append((r, why, ev['refused'] + ev['runs']))
    return phantom, kept


# ---------------------------------------------------------------- the honest status for a page that exists

def mark_plan(kept, logs, now_iso=''):
    """The smallest accurate change for every `writing` row whose page is proven: the content-log row says `written` (that is what
    every feature reads as proof a page exists), and the ladder row keeps `writing` but finally says why in its note."""
    now_iso = now_iso or datetime.now(timezone.utc).isoformat()
    cols = [c for c, _t in LOG_COLS]
    out = []
    for r, why, proofs in kept:
        if not proofs or not any(('wrote the page' in p) or ('says `written`' in p) or ('says `published`' in p) or ('finished page' in p) for p in proofs):
            continue                                                # only a page that is PROVEN gets a status
        dom, kw = normd(r.get('domain')), str(r.get('keyword') or '').strip()
        mine = [l for l in (logs or []) if (normd(l.get('domain')), normk(l.get('keyword'))) == (dom, normk(kw))]
        mine.sort(key=lambda l: str(l.get('started_at') or ''), reverse=True)
        prior = mine[0] if mine else None
        if prior and str(prior.get('status') or '') in ('written', 'published'):
            continue                                                # the log already says it
        joined = ' '.join(proofs)
        # the page's own date: the row the run opened, else the proof's own timestamp, else the ladder row's start
        stamp = (re.search(r'\((?:report [0-9a-f]{8}, )?(\d{4}-\d\d-\d\d(?:[T ][\d:.+Z-]*)?)\)', joined) or [None, ''])[1]
        when = iso_z(str((prior or {}).get('started_at') or '') or stamp or str(r.get('start_date') or ''))
        site_id = str((prior or {}).get('site_id') or '') or next((str(l.get('site_id')) for l in (logs or []) if normd(l.get('domain')) == dom and l.get('site_id')), '') \
            or 'site_' + re.sub(r'[^a-z0-9]+', '-', dom)
        proof_id = (re.search(r'n8n execution (\d+)', joined) or re.search(r'report ([0-9a-f]{8})', joined) or [None, ''])[1]
        row = {'site_id': site_id, 'domain': dom, 'keyword': str((prior or {}).get('keyword') or kw),
               'source': str((prior or {}).get('source') or 'ladder'), 'page_type': str((prior or {}).get('page_type') or r.get('page_type') or ''),
               'existing_page_url': str((prior or {}).get('existing_page_url') or ''),
               'rung': int((prior or {}).get('rung') or r.get('rung') or 0) or 0, 'ladder_id': str(r.get('ladder_id') or ''),
               'request_id': str((prior or {}).get('request_id') or proof_id or ''), 'started_at': when, 'status': 'written',
               'published_url': '', 'published_at': '', 'week': str((prior or {}).get('week') or when)[:10], 'qa_reasons': ''}   # R111: the column exists since 2026-10-16; a proven page carries no failed-QA reasons
        note = ('written %s, awaiting the owner\'s publication decision%s. Proof: %s. Page: %s'
                % (str(when)[:10], ' (FIX_PLAN O9)' if normk(kw) in O9_PENDING else '',
                   next((p for p in proofs if 'wrote the page' in p or 'finished page' in p), proofs[0]),
                   str(r.get('target_url') or '').strip() or '(no URL on the row)'))
        if normk(kw) in O9_PENDING:
            note += '. ' + O9_PENDING[normk(kw)]
        out.append({'row': r, 'log': {k: row[k] for k in cols if k in row}, 'exists': prior, 'note': note[:480], 'proofs': proofs})
    return out


# ---------------------------------------------------------------- CLI

def arg(argv, name, default=''):
    if name in argv:
        i = argv.index(name)
        return argv[i + 1] if i + 1 < len(argv) else default
    return default


def main():
    argv = sys.argv[1:]
    apply = '--apply' in argv
    mark = '--mark-written' in argv
    domain, ladder_id = arg(argv, '--domain'), arg(argv, '--ladder')
    env_file, db_url, cache = arg(argv, '--env-file'), arg(argv, '--db-url'), arg(argv, '--exec-cache')
    key = api_key(env_file)
    if not key:
        print('fix_phantom_pages: no N8N_API_KEY in n8n/.env, app/.env, the environment or --env-file'); return 2
    lid, gid = table_id(key, LADDER_TABLE), table_id(key, LOG_TABLE)
    if not lid:
        print('fix_phantom_pages: the table %s does not exist yet — nothing to do' % LADDER_TABLE); return 0
    ladders = rows(key, lid)
    print('fix_phantom_pages: %d ladder row(s); reading every source that could know of a page' % len(ladders))
    logs = rows(key, gid) if gid else None
    print('  %-17s: %s' % (LOG_TABLE, ('%d row(s)' % len(logs)) if logs is not None else 'MISSING — the table does not exist'))
    reports, rep_note = app_reports(db_url or app_db_url())
    if rep_note:
        print('  app reports      : UNREADABLE — ' + rep_note)
    cand = {(normd(r.get('domain')), normk(r.get('keyword'))) for r in ladders
            if str(r.get('status') or '') == 'writing' and (not domain or normd(r.get('domain')) == normd(domain))
            and (not ladder_id or str(r.get('ladder_id') or '') == ladder_id)}
    execs, exec_note = exec_evidence(key, cand, cache=cache) if cand else ({'by_key': {}, 'oldest': '', 'count': 0}, '')
    if exec_note:
        print('  n8n executions   : UNREADABLE — ' + exec_note)
    elif execs:
        print('  n8n executions   : %d run(s) read, the history reaches back to %s' % (execs['count'], str(execs['oldest'])[:19]))
    phantom, kept = judge(ladders, logs, reports, execs, domain, ladder_id)
    today = datetime.now(timezone.utc).date().isoformat()
    print('\n%d `writing` row(s): %d claim a page nobody wrote, %d are accounted for' % (len(phantom) + len(kept), len(phantom), len(kept)))
    for r, why, proofs in phantom:
        print('  %s id %-4s %-22s rung %-2s "%s" (%s)\n        why: %s'
              % ('WOULD GIVE BACK' if not apply else 'GIVE BACK      ', r.get('id'), r.get('ladder_id'), r.get('rung'),
                 r.get('keyword'), normd(r.get('domain')), why))
    for r, why, proofs in kept:
        print('  keeping         id %-4s "%s"\n        %s' % (r.get('id'), r.get('keyword'), why))
        o9x = [p for p in proofs if p.startswith('FIX_PLAN O9')]        # the O9 line is always printed, however much evidence there is
        for p in [p for p in proofs[1:] if p not in o9x][:3] + o9x:
            print('        also: %s' % p)
    if mark:
        plans = mark_plan(kept, logs)
        print('\n--mark-written: %d row(s) whose page is proven get an honest status (`writing` stays, the content log says `written`)' % len(plans))
        for p in plans:
            r = p['row']
            print('  %s id %-4s "%s"' % ('WOULD MARK' if not apply else 'MARK      ', r.get('id'), r.get('keyword')))
            print('        %s %s: status `written`, started_at %s, request_id %s'
                  % ('update' if p['exists'] else 'insert', LOG_TABLE + (' row %s' % p['exists'].get('id') if p['exists'] else ''),
                     p['log']['started_at'][:19], p['log']['request_id'] or '(none)'))
            print('        %s row %s: status stays `writing`, status_note = "%s"' % (LADDER_TABLE, r.get('id'), p['note']))
    if not apply:
        print('\ndry run (default): nothing was written.')
        if phantom:
            print('Re-run with --apply to set those %d row(s) back to `planned`.' % len(phantom))
        if mark:
            print('Re-run with --mark-written --apply to write the honest status.')
        elif kept:
            print('Add --mark-written to see the honest status for the rows whose page is proven.')
        return 0
    failed = 0
    for r, why, _p in phantom:
        note = ('given back %s by fix_phantom_pages.py: %s. The page was not written; it is planned again.' % (today, why))[:480]
        body = {'filter': {'type': 'and', 'filters': [{'columnName': 'id', 'condition': 'eq', 'value': r['id']}]},
                'data': {'status': 'planned', 'status_note': note}}
        try:
            call(key, '/data-tables/%s/rows/update' % lid, 'PATCH', body)
        except Exception as e:
            failed += 1; print('  FAILED row %s: %s' % (r.get('id'), str(e)[:160]))
    if phantom:
        print('fix_phantom_pages: gave back %d row(s)%s — the cadence, the Rank Tracker and the ladder plan stop promising those pages'
              % (len(phantom) - failed, (', %d failed' % failed) if failed else ''))
    if mark:
        if not gid:
            print('fix_phantom_pages: %s does not exist — the honest status cannot be written' % LOG_TABLE); return 1
        for p in mark_plan(kept, logs):
            r = p['row']
            try:
                call(key, '/data-tables/%s/rows/upsert' % gid, 'POST',
                     {'filter': {'type': 'and', 'filters': [{'columnName': 'site_id', 'condition': 'eq', 'value': p['log']['site_id']},
                                                            {'columnName': 'keyword', 'condition': 'eq', 'value': p['log']['keyword']}]},
                      'data': p['log'], 'returnData': False})
                call(key, '/data-tables/%s/rows/update' % lid, 'PATCH',
                     {'filter': {'type': 'and', 'filters': [{'columnName': 'id', 'condition': 'eq', 'value': r['id']}]},
                      'data': {'status_note': p['note']}})
                print('  marked id %-4s "%s" written' % (r.get('id'), r.get('keyword')))
            except Exception as e:
                failed += 1; print('  FAILED row %s: %s' % (r.get('id'), str(e)[:160]))
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
