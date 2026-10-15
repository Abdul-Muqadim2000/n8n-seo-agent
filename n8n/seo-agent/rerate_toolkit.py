#!/usr/bin/env python3
"""Re-rating toolkit (FIX_PLAN §5.2), first used for the 2026-10-15 re-rating. Sends every run the way the web app sends it and reads back what happened.

Secrets (API keys, the company's hook token / callback URL, DataForSEO login) are read from the MAIN repo's n8n/.env and the app DB
and are NEVER printed: every function that could echo one redacts it. Do not add prints of them.

Usage (from anywhere):  python3 rr.py <command> [args]
  balance [label]                    DataForSEO balance (+ today's spend), appended to files/spend.jsonl with the label
  site                               techand.ai's app site context (what the app would send)
  start <json|@file>                 POST the API front door (/webhook/seo-keyword-check) as the app: X-Forwarded-For app:<org>,
                                     company callback added, domain/country filled. Prints the 202 answer (request_id = API exec id)
  assess <keyword>                   the Keyword Check (synchronous), body built exactly as the app's assessBody(); saves the answer
  reply <json|@file>                 the Reply Reader (synchronous); saves the answer
  admin <json|@file>                 Site Admin API (/webhook/seo-site-admin)
  linkbuilder <json|@file>           Link Builder API (/webhook/seo-link-builder), company callback added
  prerelease <json|@file>            pre-release check (/webhook/seo-prerelease), synchronous; saves the answer
  testrun <workflowId> <json|@file>  Test Runner (/webhook/seo-test-run): starts a monitor on demand. Test Runner must be active.
  activate <workflowId> | deactivate <workflowId> | active <workflowId>
  execs [after_id]                   executions with id > after_id (default: last 30): id, workflow, status, mode, start, stop
  wait <id> [<id> ...]               poll until those executions are finished (max 40 min), prints final status
  exec <id>                          save the full execution (with data) to files/exec-<id>.json; print per-node status / items
  node <id> <node name> [maxchars]   print a node's output items (from the saved or fetched execution)
  claude <id> [<id> ...]             Claude calls per execution: model, tokens in/out, measured (tokenUsage) vs estimate
  reports [since_iso]                the app's reports for the company since (default today 00:00 UTC)
  report <report_id>                 save one report payload to files/report-<id>.json, print stage/title/summary
  rows <table> [filter_json] [limit] Data Table rows (n8n public API)
  ledger [since_iso]                 seo_run_ledger rows created since
Files go to FILES (default: docs/system-review-2026-10-15/files/, git-ignored). Set RR_FILES to a new review folder's files/ for the next run.
ORG / SITE below are the dev app's techand.ai company and site (identifiers, not secrets).
"""
import json, os, sys, time, subprocess, urllib.request, urllib.error, urllib.parse, datetime

MAIN = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))   # the repo root (this file is n8n/seo-agent/)
sys.path.insert(0, MAIN + '/n8n/seo-agent')
from env_settings import load_env  # noqa: E402

E = load_env(MAIN + '/n8n/.env')
N8N = 'http://localhost:5678'
ORG = '046e47e8-e935-4a05-b27e-7fd171ad10d0'          # app company "Techand Test Co" (owner: test account owner@example.org)
SITE = '090a8d66-dd60-4002-acee-cc847e2485dc'         # app site techand.ai
FILES = os.environ.get('RR_FILES') or MAIN + '/n8n/seo-agent/docs/system-review-2026-10-15/files'
os.makedirs(FILES, exist_ok=True)
OP = urllib.request.build_opener(urllib.request.ProxyHandler({}))
SECRETS = [v for k, v in E.items() if v and len(v) >= 8 and any(s in k for s in ('KEY', 'PASSWORD', 'SECRET', 'TOKEN', 'WEBHOOK'))]


def now():
    return datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def redact(s):
    s = str(s)
    for v in SECRETS + [_hook_token_cache[0]] if _hook_token_cache[0] else SECRETS:
        if v and v in s:
            s = s.replace(v, '***')
    import re
    s = re.sub(r'/api/hooks/n8n/[A-Za-z0-9_\-]+', '/api/hooks/n8n/***', s)
    return s


def out(o):
    print(redact(json.dumps(o, indent=1, ensure_ascii=False) if not isinstance(o, str) else o))


_hook_token_cache = [None]


def psql(q):
    r = subprocess.run(['docker', 'exec', 'seo-platform-dev-db-1', 'sh', '-c', 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "$Q"'],
                       capture_output=True, text=True, env={**os.environ, 'Q': q})
    if r.returncode:
        raise SystemExit('psql failed: ' + r.stderr[:300])
    return r.stdout


def psql_q(q):
    r = subprocess.run(['docker', 'exec', '-e', 'Q=' + q, 'seo-platform-dev-db-1', 'sh', '-c', 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "$Q"'],
                       capture_output=True, text=True)
    if r.returncode:
        raise SystemExit('psql failed: ' + r.stderr[:300])
    return r.stdout


def hook_token():
    if not _hook_token_cache[0]:
        _hook_token_cache[0] = psql_q(f"select hook_token from organizations where id='{ORG}'").strip()
    return _hook_token_cache[0]


def callback_url():
    return 'http://host.docker.internal:4000/api/hooks/n8n/' + hook_token()


def site():
    return json.loads(psql_q(f"select row_to_json(t) from (select domain,country,business,customers,goal,tone,cta,business_facts,competitors,brand_names,keywords,ga4_property_id,gsc_property,blogs_per_week from sites where id='{SITE}') t"))


def http(method, url, body=None, headers=None, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    if data is not None:
        req.add_header('content-type', 'application/json')
    t0 = time.time()
    try:
        with OP.open(req, timeout=timeout) as r:
            b = r.read(); st = r.status
    except urllib.error.HTTPError as e:
        b = e.read(); st = e.code
    try:
        j = json.loads(b) if b else None
    except Exception:
        j = b[:2000].decode('utf-8', 'replace')
    return st, j, round(time.time() - t0, 2)


def api(p, method='GET', body=None, timeout=120):
    st, j, _ = http(method, N8N + '/api/v1' + p, body, {'X-N8N-API-KEY': E['N8N_API_KEY'], 'accept': 'application/json'}, timeout)
    if st >= 400:
        raise SystemExit(f'n8n API {method} {p} -> {st}: {redact(j)}')
    return j


def load_body(a):
    if a.startswith('@'):
        return json.load(open(a[1:]))
    return json.loads(a)


def save(name, obj):
    p = os.path.join(FILES, name)
    with open(p, 'w') as f:
        f.write(redact(json.dumps(obj, indent=1, ensure_ascii=False)))
    return p


# ---------------- DataForSEO balance ----------------
def balance(label=''):
    js = r"""const a='Basic '+Buffer.from(process.env.L+':'+process.env.P).toString('base64');
fetch('https://api.dataforseo.com/v3/appendix/user_data',{headers:{Authorization:a}}).then(r=>r.json()).then(j=>{const r=((j.tasks||[])[0]||{}).result||[];const m=(r[0]||{}).money||{};
console.log(JSON.stringify({status:j.status_code,balance:m.balance,today_total:((m.statistics||{}).day||{}).total,today:((m.statistics||{}).day||{}).value}))}).catch(e=>console.log(JSON.stringify({error:String(e)})))"""
    r = subprocess.run(['docker', 'exec', '-e', 'L', '-e', 'P', 'n8n-n8n-1', 'node', '-e', js], capture_output=True, text=True,
                       env={**os.environ, 'L': E.get('SEO_DATAFORSEO_LOGIN', ''), 'P': E.get('SEO_DATAFORSEO_PASSWORD', '')})
    try:
        j = json.loads(r.stdout.strip().splitlines()[-1])
    except Exception:
        j = {'error': redact(r.stderr[:300])}
    j['at'] = now(); j['label'] = label
    with open(os.path.join(FILES, 'spend.jsonl'), 'a') as f:
        f.write(json.dumps(j) + '\n')
    out(j)
    return j


# ---------------- starting runs ----------------
def start(body):
    s = site()
    b = {'domain': s['domain'], 'country': s['country'], 'email': '', 'business': s['business'], 'customers': s['customers'], **body}
    b['callback_url'] = callback_url()
    st, j, dt = http('POST', N8N + '/webhook/seo-keyword-check', b, {'x-api-key': E['SEO_API_KEY'], 'x-forwarded-for': 'app:' + ORG}, 60)
    rec = {'at': now(), 'kind': 'start', 'mode': b.get('mode'), 'keyword': b.get('keyword'), 'status': st, 'answer': j, 'secs': dt,
           'body': {k: v for k, v in b.items() if k != 'callback_url'}}
    with open(os.path.join(FILES, 'starts.jsonl'), 'a') as f:
        f.write(redact(json.dumps(rec)) + '\n')
    out(rec)
    return rec


def assess(keyword, country=None):
    s = site()
    # what the app sends: existing ladder keywords + services (case-study services); the app reads them from n8n tables
    existing = []
    try:
        for r in rows('seo_ladders', {'type': 'and', 'filters': [{'columnName': 'domain', 'condition': 'eq', 'value': s['domain']}]}, 2000):
            for k in ('head_keyword', 'keyword'):
                if r.get(k): existing.append(str(r[k]))
    except SystemExit:
        pass
    services = []
    try:
        for r in rows('seo_case_studies', {'type': 'and', 'filters': [{'columnName': 'domain', 'condition': 'eq', 'value': s['domain']}]}, 50):
            if r.get('service'): services.append(r['service'])
    except SystemExit:
        pass
    existing = sorted({k.strip().lower() for k in existing if 2 <= len(k.strip()) <= 120})[:300]
    b = {'keyword': keyword, 'country': country or s['country'], 'domain': s['domain'], 'services': services[:20], 'existing_keywords': existing}
    if s['business'].strip():
        b['business'] = s['business'].strip()[:1500]
    st, j, dt = http('POST', N8N + '/webhook/seo-keyword-assess', b, {'x-api-key': E['SEO_API_KEY'], 'x-forwarded-for': 'app:' + ORG}, 120)
    rec = {'at': now(), 'kind': 'assess', 'keyword': keyword, 'status': st, 'secs': dt, 'body': b, 'answer': j}
    p = save('assess-' + keyword.replace(' ', '-') + '.json', rec)
    out({'status': st, 'secs': dt, 'saved': p, 'answer': j})
    return rec


def sync_post(path, body, name, key='SEO_API_KEY', add_cb=False, timeout=180):
    b = dict(body)
    if add_cb:
        b.setdefault('domain', 'techand.ai'); b['callback_url'] = callback_url()
    st, j, dt = http('POST', N8N + path, b, {'x-api-key': E[key]}, timeout)
    rec = {'at': now(), 'kind': name, 'status': st, 'secs': dt, 'body': {k: v for k, v in b.items() if k != 'callback_url'}, 'answer': j}
    with open(os.path.join(FILES, 'starts.jsonl'), 'a') as f:
        f.write(redact(json.dumps(rec)) + '\n')
    out(rec)
    return rec


def testrun(wf, body):
    b = {'workflow': wf, 'domain': 'techand.ai', **body}
    b.setdefault('callback_url', callback_url())
    return sync_post('/webhook/seo-test-run', b, 'testrun:' + wf, key='SEO_API_KEY_TEST', timeout=60)


# ---------------- reading back ----------------
def execs(after=None):
    r = api('/executions?limit=100')['data']
    if after is not None:
        r = [e for e in r if int(e['id']) > int(after)]
    else:
        r = r[:30]
    for e in sorted(r, key=lambda e: int(e['id'])):
        print(e['id'], e['workflowId'], e['status'], e['mode'], e.get('startedAt'), e.get('stoppedAt'))
    return r


def wait(ids, maxmin=40):
    t0 = time.time(); left = set(map(str, ids))
    while left and time.time() - t0 < maxmin * 60:
        for i in list(left):
            e = api(f'/executions/{i}')
            if e.get('finished') or e.get('status') in ('success', 'error', 'crashed', 'canceled') or e.get('stoppedAt'):
                print(i, e['workflowId'], e['status'], e.get('startedAt'), e.get('stoppedAt')); left.discard(i)
        if left:
            time.sleep(15)
    if left:
        print('still running after', maxmin, 'min:', sorted(left))


def get_exec(i):
    p = os.path.join(FILES, f'exec-{i}.json')
    if os.path.exists(p):
        return json.load(open(p))
    e = api(f'/executions/{i}?includeData=true', timeout=300)
    if e.get('stoppedAt'):
        save(f'exec-{i}.json', e)
    return e


def run_data(e):
    return (((e.get('data') or {}).get('resultData') or {}).get('runData')) or {}


def exec_summary(i):
    e = get_exec(i); rd = run_data(e)
    print(f"exec {i} wf={e.get('workflowId')} status={e.get('status')} {e.get('startedAt')} -> {e.get('stoppedAt')} nodes_run={len(rd)}")
    err = ((e.get('data') or {}).get('resultData') or {}).get('error')
    if err:
        print('ERROR:', redact(json.dumps(err)[:1500]))
    for name, runs in rd.items():
        for k, r in enumerate(runs):
            items = sum(len(x or []) for x in ((r.get('data') or {}).get('main') or []))
            st = r.get('executionStatus') or ''
            er = r.get('error')
            print(f"  {name} [{k}] {st} items={items} {r.get('executionTime')}ms" + (f" ERROR {redact(str(er.get('message') if isinstance(er, dict) else er))[:200]}" if er else ''))


def node_out(i, name, maxc=6000):
    rd = run_data(get_exec(i))
    if name not in rd:
        raise SystemExit('no node ' + name + ' in exec ' + str(i) + '; nodes: ' + ', '.join(rd.keys()))
    res = []
    for r in rd[name]:
        for br in ((r.get('data') or {}).get('main') or []):
            for it in (br or []):
                res.append(it.get('json'))
        for kk in ('ai_languageModel',):
            for br in ((r.get('data') or {}).get(kk) or []):
                for it in (br or []):
                    res.append({'_' + kk: it.get('json')})
    s = json.dumps(res, indent=1, ensure_ascii=False)
    print(redact(s[:int(maxc)]))
    if len(s) > int(maxc):
        print(f'... ({len(s)} chars total)')
    return res


PRICES = {'opus': (4.0, 20.0), 'sonnet': (2.0, 10.0), 'haiku': (1.0, 5.0)}   # $/M tokens in/out: Opus 5.5, Sonnet 5.5, Haiku 4.5 official list prices (verified 2026-10-15; same as v5/code/_cost_cal.js)


def claude(ids):
    """Per execution: every Claude call, its model, tokens, and whether n8n reported a measured tokenUsage or only an estimate."""
    grand = {'measured_usd': 0.0, 'estimated_usd': 0.0, 'calls': 0}
    for i in ids:
        e = get_exec(i); rd = run_data(e)
        models = {}
        for n in ((e.get('workflowData') or {}).get('nodes') or []):
            p = n.get('parameters') or {}
            m = p.get('model')
            if isinstance(m, dict): m = m.get('value') or m.get('cachedResultName')
            if m: models[n['name']] = str(m)
        for name, runs in rd.items():
            for r in runs:
                for br in ((r.get('data') or {}).get('ai_languageModel') or []):
                    for it in (br or []):
                        j = it.get('json') or {}
                        tu = j.get('tokenUsage'); te = j.get('tokenUsageEstimate')
                        u = tu or te or {}
                        pin, pout = int(u.get('promptTokens', 0) or 0), int(u.get('completionTokens', 0) or 0)
                        m = models.get(name, '?'); fam = next((f for f in PRICES if f in m.lower()), None)
                        usd = (pin * PRICES[fam][0] + pout * PRICES[fam][1]) / 1e6 if fam else 0.0
                        grand['measured_usd' if tu else 'estimated_usd'] += usd; grand['calls'] += 1
                        print(f"exec {i} | {name} | {m} | {'MEASURED' if tu else 'ESTIMATE'} | in {pin} out {pout} | ${usd:.4f}")
    grand = {k: (round(v, 4) if isinstance(v, float) else v) for k, v in grand.items()}
    print('TOTAL', json.dumps(grand))
    return grand


def reports(since=None):
    since = since or datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d 00:00:00+00')
    q = f"select row_to_json(t) from (select id, stage, status, title, request_id, scheduled, received_at, left(summary::text, 300) as summary from reports where org_id='{ORG}' and received_at >= '{since}' order by received_at) t"
    rs = [json.loads(l) for l in psql_q(q).splitlines() if l.strip()]
    for r in rs:
        out(r)
    return rs


def report(rid):
    r = json.loads(psql_q(f"select row_to_json(t) from (select * from reports where id='{rid}' and org_id='{ORG}') t"))
    p = save(f'report-{rid}.json', r)
    out({'saved': p, 'stage': r.get('stage'), 'title': r.get('title'), 'request_id': r.get('request_id'), 'summary': str(r.get('summary'))[:1500]})
    return r


def tables():
    o = {}; cur = None
    while True:
        j = api('/data-tables?limit=100' + (('&cursor=' + cur) if cur else ''))
        for t in j['data']:
            o[t['name']] = t['id']
        cur = j.get('nextCursor')
        if not cur:
            return o


def rows(name, flt=None, limit=200):
    tid = tables()[name]; q = {'limit': str(min(int(limit), 250))}
    if flt:
        q['filter'] = json.dumps(flt, separators=(',', ':'))
    res = []; cur = None
    while True:
        qq = dict(q)
        if cur:
            qq['cursor'] = cur
        j = api(f'/data-tables/{tid}/rows?' + urllib.parse.urlencode(qq, quote_via=urllib.parse.quote))
        res += j['data']; cur = j.get('nextCursor')
        if not cur or len(res) >= int(limit):
            return res


def ledger(since=None):
    since = since or datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT00:00:00Z')
    rs = [r for r in rows('seo_run_ledger', None, 5000) if str(r.get('created_at', '')) >= since]
    for r in sorted(rs, key=lambda r: r.get('id', 0)):
        print(json.dumps({k: r.get(k) for k in ('id', 'run_id', 'mode', 'key', 'status', 'created_at', 'est_usd', 'dfs_est_usd', 'settled_usd', 'dfs_usd', 'ai_usd', 'measured_usd', 'estimated_usd', 'domain', 'heavy', 'refusal', 'reason') if k in r}))
    return rs


def main(a):
    if not a:
        print(__doc__); return
    c = a[0]
    if c == 'balance': balance(' '.join(a[1:]))
    elif c == 'site': out(site())
    elif c == 'start': start(load_body(a[1]))
    elif c == 'assess': assess(' '.join(a[1:]))
    elif c == 'reply': rec = sync_post('/webhook/seo-reply-read', load_body(a[1]), 'reply'); save('reply-' + str(int(time.time())) + '.json', rec)
    elif c == 'admin': sync_post('/webhook/seo-site-admin', load_body(a[1]), 'admin')
    elif c == 'linkbuilder': sync_post('/webhook/seo-link-builder', load_body(a[1]), 'linkbuilder', add_cb=True)
    elif c == 'prerelease': rec = sync_post('/webhook/seo-prerelease', load_body(a[1]), 'prerelease'); save('prerelease-' + str(int(time.time())) + '.json', rec)
    elif c == 'testrun': testrun(a[1], load_body(a[2]) if len(a) > 2 else {})
    elif c in ('activate', 'deactivate'): out(api(f'/workflows/{a[1]}/{c}', 'POST', {}) and {'workflow': a[1], c: 'ok', 'at': now()})
    elif c == 'active': out({'workflow': a[1], 'active': api(f'/workflows/{a[1]}').get('active')})
    elif c == 'execs': execs(a[1] if len(a) > 1 else None)
    elif c == 'wait': wait(a[1:])
    elif c == 'exec': exec_summary(a[1])
    elif c == 'node': node_out(a[1], a[2], a[3] if len(a) > 3 else 6000)
    elif c == 'claude': claude(a[1:])
    elif c == 'reports': reports(a[1] if len(a) > 1 else None)
    elif c == 'report': report(a[1])
    elif c == 'rows':
        for r in rows(a[1], json.loads(a[2]) if len(a) > 2 and a[2] else None, int(a[3]) if len(a) > 3 else 50):
            out(r)
    elif c == 'ledger': ledger(a[1] if len(a) > 1 else None)
    else:
        print(__doc__)


if __name__ == '__main__':
    main(sys.argv[1:])
