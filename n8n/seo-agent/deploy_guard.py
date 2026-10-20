"""deploy_guard.py — the one deploy guard of the per-website cycle (2026-10-19, docs/SCHEDULING_KEYWORDS_PLAN.md §4.8), used by both Python deploy
paths: apply_env.py (the local n8n) and deploy/gcp/deploy_engine.py (production, over the IAP tunnel). n8n/deploy/release.mjs (the container
image's release step, where Python may be absent) asks the same question of CYC.deployWindow, read out of the generated dispatcher.

Until 2026-10-19 the guard refused Monday 07:00-12:00 New York, because every weekly cron fired then and a restart threw a due fire away
(R94). The weekly crons are gone: each website's jobs are started by the Cycle Dispatcher from a durable table, so a restart only delays a
job to the next sweep, and a job a restart kills is seen in the run ledger and retried. The rule (F-ENG 2026-10-20, made precise so it
does not refuse almost always once many websites run):

    REFUSE while a dispatcher job is STARTING - between the dispatcher's claim (its seo_cycle_jobs row) and the run's ledger row - or a
    cycle / "Coming up" preview of an active website is due in the next 15 minutes (or became due in the last 10, so the sweep is about to
    start it). A restart in those moments can leave a start nobody can confirm, or push a due start late.
    REPORT, never refuse, a job that is RUNNING: it is safe. A restart kills it, the dispatcher sees the dead run at its next sweep and
    starts it again (one of its three attempts).
    A `starting` row older than 15 minutes (the dispatcher's 10-minute confirm window + one sweep) is a start that never happened, and a
    `running` row older than 2 h 10 min a crashed run: both are ignored, and counted. `--force` overrides loudly (`--force-monday`, the
    old flag, is the same). If the tables cannot be read, the deploy is refused unless `--force`, with the reason - a guard that cannot see
    is not a guard.

The rule is `deploy_window()`, pure, and the same question the cycle kit answers in JavaScript (v5/code/_cycle.js CYC.deployWindow).
Build section 140 runs this one on harness/deploy_window_cases.json; harness CY12 runs the kit's on the same cases and compares the
answers, so the two cannot drift. Nothing here prints a key: the API caller is handed in.
"""
import datetime as _dt
import json as _json
import urllib.parse as _up

WINDOW_MINUTES = 15          # a cycle or preview due this soon holds a deploy (CYC.DEPLOY.window_minutes)
LOOKBACK_MINUTES = 10        # ... and one that became due this recently (the next sweep is about to start it)
STARTING_MINUTES = 15        # a `starting` row older than this is a start that never happened (the 10-minute confirm window + one sweep)
STALE_HOURS = 2              # the run guard's rule (RG.STALE_HOURS): a running row older than this + CONFIRM was a crashed run
CONFIRM_MINUTES = 10         # the dispatcher's confirm window (CYC.DEFAULTS.confirm_minutes)
FORCE_FLAGS = ('--force', '--force-monday')
TABLES = ('seo_cycle_jobs', 'seo_cycles')
MAX_PAGES = 40               # 40 x 250 rows: far more open jobs and websites than exist; more is "could not be read", never "nothing"


def _ms(v):
    s = str(v or '').strip()
    if not s:
        return 0
    try:
        d = _dt.datetime.fromisoformat(s.replace('Z', '+00:00'))
    except ValueError:
        return 0
    if d.tzinfo is None:
        d = d.replace(tzinfo=_dt.timezone.utc)
    return int(d.timestamp() * 1000)


def _iso(ms):
    return _dt.datetime.fromtimestamp(ms / 1000, _dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.') + '%03dZ' % (ms % 1000)


def _dom(x):
    s = str(x or '').strip().lower()
    for p in ('https://', 'http://'):
        if s.startswith(p):
            s = s[len(p):]
    if s.startswith('www.'):
        s = s[4:]
    for ch in '/?#':
        s = s.split(ch)[0]
    return s


def deploy_window(jobs, cycles, now, minutes=WINDOW_MINUTES):
    """-> {busy, starting: [{key, job, status, since}], running: [...], due: [{site_id, domain, what, at}], ignored_stale: [key], minutes,
    reason, note}. `now`: an aware datetime, epoch ms or ISO text. The JavaScript twin is CYC.deployWindow; busy = starting or due."""
    now_ms = now if isinstance(now, (int, float)) else (int(now.timestamp() * 1000) if isinstance(now, _dt.datetime) else _ms(now))
    win = (minutes if minutes and minutes > 0 else WINDOW_MINUTES) * 60000
    stale_run, stale_start = STALE_HOURS * 3600000 + CONFIRM_MINUTES * 60000, STARTING_MINUTES * 60000
    st = lambda r: str(r.get('status') or '').strip()
    open_ = [r for r in (jobs or []) if r and str(r.get('job') or '').strip() != 'cycle' and st(r) in ('starting', 'running')]

    def fresh(r):
        t = _ms(r.get('updated_at')) or _ms(r.get('started_at'))
        return bool(t) and now_ms - t <= (stale_start if st(r) == 'starting' else stale_run)
    view = lambda r: {'key': str(r.get('key') or '').strip(), 'job': str(r.get('job') or '').strip(), 'status': st(r),
                      'since': str(r.get('updated_at') or '').strip() or str(r.get('started_at') or '').strip()}
    starting = sorted((view(r) for r in open_ if st(r) == 'starting' and fresh(r)), key=lambda j: j['key'])
    running = sorted((view(r) for r in open_ if st(r) == 'running' and fresh(r)), key=lambda j: j['key'])
    ignored = [str(r.get('key') or '').strip() for r in open_ if not fresh(r)]
    due = []
    for r in (cycles or []):
        if not r or (str(r.get('status') or '').strip().lower() or 'active') != 'active':
            continue
        for what, at in (('cycle', _ms(r.get('next_due_at'))), ('preview', _ms(r.get('next_preview_at')))):
            if at and now_ms - LOOKBACK_MINUTES * 60000 <= at <= now_ms + win:
                due.append({'site_id': str(r.get('site_id') or '').strip(), 'domain': _dom(r.get('domain')), 'what': what, 'at': _iso(at)})
    due.sort(key=lambda d: (d['at'], d['site_id']))
    busy = bool(starting or due)
    parts = []
    if starting:
        parts.append("%d dispatcher job(s) starting, between the claim and the run's ledger row (%s)" % (len(starting), ', '.join(j['key'] for j in starting[:5])))
    if due:
        parts.append('%d cycle / preview start(s) due by %s (%s)' % (len(due), _iso(now_ms + win), ', '.join(d['domain'] + ' ' + d['what'] + ' ' + d['at'] for d in due[:5])))
    note = ('%d job(s) running (%s): not a reason to wait - a restart kills a running job, the dispatcher sees the dead run at its next sweep and '
            'starts it again (one of its three attempts)' % (len(running), ', '.join(j['key'] for j in running[:5]))) if running else ''
    reason = '; '.join(parts) if busy else 'nothing starting and nothing due in the next %d min' % round(win / 60000)
    return {'busy': busy, 'starting': starting, 'running': running, 'due': due, 'ignored_stale': ignored, 'minutes': round(win / 60000),
            'reason': reason, 'note': note}


def read_tables(api):
    """`api(method, path) -> (status, json)` against n8n's public API (/api/v1 is the caller's). -> (jobs, cycles, error).
    A table that does not exist yet is empty (an instance the dispatcher never ran on has nothing in flight); any other answer is an error."""
    st, page = api('GET', '/data-tables?limit=100')
    if st != 200 or not isinstance(page, dict):
        return None, None, 'n8n answered %s to the Data Table list' % st
    ids, cursor, n = {}, page.get('nextCursor'), 0
    for t in page.get('data') or []:
        ids[t.get('name')] = t.get('id')
    while cursor and n < MAX_PAGES:
        st, page = api('GET', '/data-tables?limit=100&cursor=' + _up.quote(str(cursor)))
        if st != 200 or not isinstance(page, dict):
            return None, None, 'n8n answered %s to the Data Table list (page %d)' % (st, n + 2)
        for t in page.get('data') or []:
            ids[t.get('name')] = t.get('id')
        cursor, n = page.get('nextCursor'), n + 1

    def rows(name, flt):
        tid = ids.get(name)
        if not tid:
            return [], ''
        out, cur, pages = [], None, 0
        q = '&filter=' + _up.quote(_json.dumps(flt, separators=(',', ':'))) if flt else ''
        while True:
            st, pg = api('GET', '/data-tables/%s/rows?limit=250%s%s' % (tid, q, '&cursor=' + _up.quote(str(cur)) if cur else ''))
            if st != 200 or not isinstance(pg, dict):
                return None, 'n8n answered %s reading %s' % (st, name)
            out.extend(pg.get('data') or [])
            cur, pages = pg.get('nextCursor'), pages + 1
            if not cur:
                return out, ''
            if pages >= MAX_PAGES:
                return None, '%s has more than %d rows to read' % (name, MAX_PAGES * 250)
    open_filter = {'type': 'or', 'filters': [{'columnName': 'status', 'condition': 'eq', 'value': 'starting'},
                                             {'columnName': 'status', 'condition': 'eq', 'value': 'running'}]}
    jobs, err = rows('seo_cycle_jobs', open_filter)
    if err:
        return None, None, err
    cycles, err = rows('seo_cycles', None)
    if err:
        return None, None, err
    return jobs, cycles, ''


def check(api, args, now=None, say=print):
    """The guard as both deploy scripts run it. -> None when the deploy may go ahead; otherwise the refusal text (the caller exits with it).
    `args`: the script's argv (a force flag overrides, loudly)."""
    force = next((f for f in FORCE_FLAGS if f in (args or [])), '')
    now = now or _dt.datetime.now(_dt.timezone.utc)
    try:
        jobs, cycles, err = read_tables(api)
    except Exception as e:   # the API is unreachable (n8n not running, the tunnel not open)
        jobs, cycles, err = None, None, 'n8n\'s public API could not be reached (%s)' % str(e)[:160]
    if err:
        if force:
            say('!' * 100 + '\nDEPLOY GUARD OVERRIDDEN (%s): the cycle tables could not be read (%s), so nobody knows whether a website\'s job is '
                'running. Deploying anyway: a job this kills is retried by the Cycle Dispatcher (it costs one attempt).\n' % (force, err) + '!' * 100)
            return None
        return ('Deploy guard: refusing - the cycle tables could not be read (%s), so a running website job cannot be ruled out. Check that n8n is '
                'up and N8N_API_KEY is valid; or pass --force if you know nothing is running (a killed job is retried, at the cost of one attempt).' % err)
    w = deploy_window(jobs, cycles, now)
    if w['note']:
        say('deploy guard: ' + w['note'])
    if not w['busy']:
        say('deploy guard: ok - ' + w['reason'] + (' (%d stale open row(s) ignored)' % len(w['ignored_stale']) if w['ignored_stale'] else ''))
        return None
    if force:
        say('!' * 100 + '\nDEPLOY GUARD OVERRIDDEN (%s): %s. Deploying anyway: a start this restart interrupts is failed by the Cycle Dispatcher and '
            'started again at its next sweep (one attempt of three), and a due cycle starts up to 5 minutes late.\n' % (force, w['reason']) + '!' * 100)
        return None
    return ('Deploy guard: refusing now - %s. A deploy restarts or re-publishes the workflows: a start in flight could not be confirmed and a due '
            'start would run late. This clears within minutes (a start takes seconds to reach its ledger row; a due cycle starts at the next sweep). '
            'Try again shortly, or pass --force (the dispatcher retries what the deploy interrupts, at the cost of one attempt).' % w['reason'])
