"""Integration test of the read API (B5-11) and the publish check (B3-7) against a running app server and the n8n stand-in.

    python3 app/scripts/api_v1_check.py --base http://localhost:4100 --stub http://localhost:8099 --db seo-platform-dev-db-1 --dbname seo_w3g

The server must use the stub (`N8N_BASE_URL` = the stub, any `N8N_API_KEY` / `SEO_API_KEY`), because the test seeds audit rows into
it and reads back what the app forwarded to the publish-check webhook. Free: nothing reaches the real engine. Covers: keys shown
once and stored hashed, the key resolving to ONE company (every website / run / report / file / audit of the other company is a 404),
an unverified website's audits (403), pagination, the finding comparison (same-type previous audit, the sample-moved rule, fixed vs no
longer seen, evidence or null), `ready` on reports, the publish check (forwarding, own-domain rule, validation, scope), revocation,
a malformed key never falling back to the cookie, the session route with X-Org-Id, the MCP endpoint, and the rate limit.
Test users and companies are removed at the end."""
import argparse, json, secrets, subprocess, sys, urllib.error, urllib.request
from api import Api

p = argparse.ArgumentParser()
p.add_argument('--base', default='http://localhost:4100'); p.add_argument('--stub', default='http://localhost:8099')
p.add_argument('--db', default='seo-platform-dev-db-1'); p.add_argument('--dbname', default='seo')
args = p.parse_args()
TAG = secrets.token_hex(3)
fails = []


def check(label, cond, detail=''):
    print(('PASS ' if cond else 'FAIL ') + label + ('' if cond else f'  -> {str(detail)[:400]}'))
    if not cond: fails.append(label)


def sql(q):
    r = subprocess.run(['docker', 'exec', args.db, 'psql', '-U', 'seo', '-d', args.dbname, '-tAc', q], capture_output=True, text=True)
    return r.stdout.strip()


def raw(method, path, token=None, body=None, headers=None, api=None):
    """a request with an optional Bearer key and NO X-Requested-With (what a script sends)"""
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(args.base + path, data=data, method=method)
    req.add_header('accept', 'application/json')
    if data is not None: req.add_header('content-type', 'application/json')
    if token: req.add_header('authorization', 'Bearer ' + token)
    for k, v in (headers or {}).items(): req.add_header(k, v)
    op = api.op if api else urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with op.open(req, timeout=60) as r:
            b = r.read(); return r.status, (json.loads(b) if b and 'json' in (r.headers.get('content-type') or '') else b)
    except urllib.error.HTTPError as e:
        b = e.read()
        try: return e.code, json.loads(b)
        except Exception: return e.code, b[:300]


def stub(path, body=None):
    req = urllib.request.Request(args.stub + path, data=json.dumps(body).encode() if body is not None else None, method='POST' if body is not None else 'GET', headers={'content-type': 'application/json'})
    with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req, timeout=20) as r: return json.loads(r.read())


def table_id(name):
    return next(t['id'] for t in stub('/api/v1/data-tables')['data'] if t['name'] == name)


def user(name):
    a = Api(args.base); email = f'{name}-{TAG}@example.org'
    s, me = a.post('/api/auth/signup', {'name': name.title(), 'email': email, 'password': 'api-test-pass-1'})
    check(f'signup {name}', s == 200, me)
    sql(f"update users set email_verified_at=now() where email='{email}'")
    return a


try:
    A, B = user('alpha'), user('bravo')
    OA = A.post('/api/orgs', {'name': f'Alpha Co {TAG}', 'size': '2-10'})[1]['id']
    OB = B.post('/api/orgs', {'name': f'Bravo Co {TAG}', 'size': '2-10'})[1]['id']
    DA, DB, DU = f'alpha-{TAG}.example-shop.com', f'bravo-{TAG}.example-shop.com', f'unverified-{TAG}.example-shop.com'
    SA = A.post(f'/api/orgs/{OA}/sites', {'domain': DA, 'country': 'Germany'})[1]['id']
    SU = A.post(f'/api/orgs/{OA}/sites', {'domain': DU, 'country': 'Germany'})[1]['id']
    SB = B.post(f'/api/orgs/{OB}/sites', {'domain': DB, 'country': 'Germany'})[1]['id']
    sql(f"update sites set verified_at=now(), verification_method='dns' where id in ('{SA}','{SB}')")

    # seed: a run + report + file in each company (straight into the app's tables: no engine run)
    def seed(org, site, payload, title):
        run = sql(f"insert into runs (org_id, site_id, mode, title, status, input, estimated_cost_usd) values ('{org}','{site}','audit','{title}','completed','{{}}',0.09) returning id").splitlines()[0]
        rep = sql(f"insert into reports (org_id, run_id, site_id, stage, status, title, payload) values ('{org}','{run}','{site}','content','completed','{title}','{json.dumps(payload)}'::jsonb) returning id").splitlines()[0]
        f = sql(f"insert into files (org_id, report_id, field, kind, file_name, mime_type, size, data) values ('{org}','{rep}','pdf','txt','note.txt','text/plain',5,decode('68656c6c6f','hex')) returning id").splitlines()[0]
        return run, rep, f
    RA, PA, FA = seed(OA, SA, {'stage': 'content', 'status': 'completed', 'qa_not_ready': True, 'qa_reasons': ['12 placeholders left']}, 'Alpha draft')
    RA2, PA2, _ = seed(OA, SA, {'stage': 'content', 'status': 'completed'}, 'Alpha page')
    RB, PB, FB = seed(OB, SB, {'stage': 'content', 'status': 'completed'}, 'Bravo page')

    # seed the stub: two technical audits of Alpha (previous, current) and one of Bravo
    au, fi = table_id('seo_audits'), table_id('seo_audit_findings')
    aud = lambda d, i, at, t='technical': {'site_id': 's', 'domain': d, 'audit_id': i, 'audited_at': at, 'report_type': t, 'health_score': 70, 'grade': 'Fair', 'pages_crawled': 25, 'findings': 3, 'critical': 0, 'high': 1, 'medium': 2, 'low': 0, 'scheduled': False, 'request_id': ''}
    stub(f'/api/v1/data-tables/{au}/rows', {'data': [aud(DA, 'aud_a1', '2026-09-01T00:00:00Z'), aud(DA, 'aud_full', '2026-09-15T00:00:00Z', 'full'), aud(DA, 'aud_a2', '2026-10-01T00:00:00Z'), aud(DB, 'aud_b1', '2026-10-01T00:00:00Z')]})
    fr = lambda d, a, key, title, n, checked=25, sev='High', **x: {'site_id': 's', 'domain': d, 'audit_id': a, 'audited_at': '', 'finding_key': key, 'category': 'On-Page', 'severity': sev, 'title': title, 'affected_count': n, 'checked': checked, **x}
    stub(f'/api/v1/data-tables/{fi}/rows', {'data': [
        fr(DA, 'aud_a1', 'k1', 'Pages without a meta description', 6), fr(DA, 'aud_a1', 'k2', 'Your brand is not named in AI answers', 0, sev='Medium'),
        fr(DA, 'aud_a1', 'k3', 'Slow pages', 9), fr(DA, 'aud_a1', 'k5', 'Broken links', 4, sev='Medium'),
        fr(DA, 'aud_full', 'kf', 'A full-report-only finding', 1),
        fr(DA, 'aud_a2', 'k1', 'Pages without a meta description', 4, checked=24, evidence='/delivery and /returns return an empty description', sample_urls=json.dumps([f'https://{DA}/delivery', f'https://{DA}/returns'])),
        fr(DA, 'aud_a2', 'k3', 'Slow pages', 5, checked=14), fr(DA, 'aud_a2', 'k4', 'Missing H1', 2, sev='Low'),
        fr(DB, 'aud_b1', 'kb', 'Bravo finding', 1)]})

    # ---- keys ----
    s, k = A.post(f'/api/orgs/{OA}/api-keys', {'name': 'CI'})
    TA = k.get('token', '') if isinstance(k, dict) else ''
    check('key created by the owner; the token is returned once, with a prefix', s == 200 and TA.startswith('asc_') and len(TA) == 47 and k['prefix'] == TA[:12], k)
    check('only the hash is stored', sql(f"select count(*) from api_keys where token_hash = encode(sha256('{TA}'::bytea),'hex')") == '1' and sql(f"select count(*) from api_keys where token_hash = '{TA}'") == '0')
    s, lst = A.get(f'/api/orgs/{OA}/api-keys')
    check('the key list never shows a token', s == 200 and TA not in json.dumps(lst) and lst['items'][0]['state'] == 'active', lst)
    s, kr = A.post(f'/api/orgs/{OA}/api-keys', {'name': 'Looker', 'scopes': ['read'], 'expiresInDays': 30}); TR = kr.get('token', '')
    TB = B.post(f'/api/orgs/{OB}/api-keys', {'name': 'B'})[1]['token']
    s, d = B.get(f'/api/orgs/{OA}/api-keys')
    check("another company's key list is not found (404)", s == 404, d)

    # ---- one company per key ----
    s, me = raw('GET', '/api/v1', TA)
    check('GET /api/v1 names the key\'s company', s == 200 and me['company']['id'] == OA and me['auth'] == 'api_key', me)
    s, ws = raw('GET', '/api/v1/websites', TA)
    check('websites: only the company\'s own', s == 200 and {w['id'] for w in ws['items']} == {SA, SU}, ws)
    for label, path in [('website', f'/api/v1/websites/{SB}'), ('audits', f'/api/v1/websites/{SB}/audits'), ('audit', f'/api/v1/websites/{SB}/audits/aud_b1'),
                        ('run', f'/api/v1/runs/{RB}'), ('report', f'/api/v1/reports/{PB}'), ('file', f'/api/v1/files/{FB}'),
                        ('runs filtered by its website', f'/api/v1/runs?websiteId={SB}'), ('reports filtered by its website', f'/api/v1/reports?websiteId={SB}')]:
        s, d = raw('GET', path, TA)
        check(f"cross-company: the other company's {label} is 404", s == 404, (s, d))
    s, d = raw('GET', f'/api/v1/websites/{SA}/audits/aud_b1', TA)
    check("cross-company: the other company's audit id under our website is 404", s == 404, d)
    s, d = raw('GET', '/api/v1/reports', TA)
    check('reports: only the company\'s own', s == 200 and {r['id'] for r in d['items']} == {PA, PA2}, d)
    s, d = raw('GET', '/api/v1/runs', TB)
    check('the other key sees only its own runs', s == 200 and [r['id'] for r in d['items']] == [RB], d)

    # ---- data ----
    s, d = raw('GET', f'/api/v1/websites/{SU}/audits', TA)
    check('an unverified website\'s audits: 403 website_unverified', s == 403 and d.get('code') == 'website_unverified', d)
    s, d = raw('GET', f'/api/v1/websites/{SA}/audits?limit=2', TA)
    check('audits newest first, paged', s == 200 and [a['id'] for a in d['items']] == ['aud_a2', 'aud_full'] and d['nextCursor'], d)
    s, d2 = raw('GET', f'/api/v1/websites/{SA}/audits?limit=2&cursor={d.get("nextCursor")}', TA)
    check('audits page 2 is the last', s == 200 and [a['id'] for a in d2['items']] == ['aud_a1'] and d2['nextCursor'] is None, d2)
    s, d = raw('GET', f'/api/v1/websites/{SA}/audits?cursor=junk!!', TA)
    check('a junk cursor starts from the top, no error', s == 200 and d['items'][0]['id'] == 'aud_a2', d)
    s, ad = raw('GET', f'/api/v1/websites/{SA}/audits/aud_a2', TA)
    F = {f['key']: f for f in ad.get('findings', [])} if isinstance(ad, dict) else {}
    check('audit: compared with the previous audit of the SAME type (not the full report between)', s == 200 and ad['comparedWith'] == 'aud_a1', ad)
    check('finding open, with its previous count, checked and evidence', F.get('k1', {}).get('status') == 'open' and F['k1']['previousAffected'] == 6 and F['k1']['checked'] == 24 and F['k1']['evidence'].startswith('/delivery') and len(F['k1']['sampleUrls']) == 2, F.get('k1'))
    check('a count on a sample that moved >20% is not compared', F.get('k3', {}).get('previousAffected') is None and 'sample moved' in (F.get('k3', {}).get('notCompared') or ''), F.get('k3'))
    check('a new finding is new; a row without evidence answers null', F.get('k4', {}).get('status') == 'new' and F['k4']['evidence'] is None, F.get('k4'))
    check('gone: fixed; gone after one outside reading: no longer seen (never fixed)', F.get('k5', {}).get('status') == 'fixed' and F.get('k2', {}).get('status') == 'no_longer_seen', (F.get('k5'), F.get('k2')))
    check('the full report\'s findings are not mixed in', 'kf' not in F, list(F))
    s, d = raw('GET', f'/api/v1/websites/{SA}/audits/aud_a2?severity=low&status=new', TA)
    check('filters: severity + status', s == 200 and [f['key'] for f in d['findings']] == ['k4'], d)
    s, d = raw('GET', f'/api/v1/reports/{PA}', TA)
    check('a QA-failed draft is not ready, with the reason', s == 200 and d['ready']['ok'] is False and d['ready']['code'] == 'not_ready' and '12 placeholders' in d['ready']['reason'] and d['payload'].get('qa_not_ready') is True, d)
    s, d = raw('GET', f'/api/v1/reports/{PA2}', TA)
    check('a finished report is ready', s == 200 and d['ready']['ok'] is True, d)
    s, d = raw('GET', f'/api/v1/reports?limit=1', TA)
    s2, d2 = raw('GET', f'/api/v1/reports?limit=1&cursor={d.get("nextCursor")}', TA)
    check('reports paged by keyset, no overlap', s == 200 and s2 == 200 and len(d['items']) == 1 and len(d2['items']) == 1 and d['items'][0]['id'] != d2['items'][0]['id'] and d2['nextCursor'] is None, (d, d2))
    for what, expect in [('websites', {SA, SU}), ('runs', {RA, RA2})]:
        s, d = raw('GET', f'/api/v1/{what}?limit=1', TA)
        s2, d2 = raw('GET', f'/api/v1/{what}?limit=1&cursor={d.get("nextCursor")}', TA)
        got = {x['id'] for x in d.get('items', []) + d2.get('items', [])} if s == 200 and s2 == 200 else set()
        check(f'{what} paged by keyset: two pages, both rows, then the end', got == expect and d2.get('nextCursor') is None, (s, s2, d2))
    s, d = raw('GET', f'/api/v1/runs/{RA}', TA)
    check('a run with its cost basis and its reports', s == 200 and d['run']['cost']['basis'] == 'app_estimate' and [r['id'] for r in d['reports']] == [PA], d)
    s, d = raw('GET', f'/api/v1/files/{FA}', TA)
    check('a file of our own report', s == 200 and d == b'hello', (s, d))

    # ---- the publish check ----
    words = ' '.join(['word'] * 320)
    s, d = raw('POST', '/api/v1/publish-check', TA, {'markdown': '# Title\n\n' + words, 'keyword': 'erp uae', 'domain': 'https://www.' + DA + '/'})
    last = stub('/__publish_checks')['data'][-1]
    check('publish check with a key, no CSRF header: n8n\'s verdict passed on', s == 200 and d.get('publishable') is True and d.get('exit_code') == 0, d)
    check('the domain is normalised to the company\'s own website', last.get('domain') == DA and last.get('keyword') == 'erp uae', last)
    s, d = raw('POST', '/api/v1/publish-check', TA, {'markdown': '# T\n\n' + words, 'keyword': 'x', 'domain': DB})
    check("a check in another company's name is refused (400)", s == 400 and 'domain' in (d.get('fields') or {}), d)
    s, d = raw('POST', '/api/v1/publish-check', TA, {'markdown': 'too short', 'keyword': 'x'})
    check('a page under 50 words is refused before n8n (400, field)', s == 400 and 'markdown' in (d.get('fields') or {}), d)
    s, d = raw('POST', '/api/v1/publish-check', TR, {'markdown': words, 'keyword': 'x'})
    check('a read-only key cannot run a publish check (403)', s == 403 and d.get('code') == 'scope_missing', d)
    s, d = A.post(f'/api/orgs/{OA}/sites/{SA}/publish-check', {'markdown': '# T\n\n' + ' '.join(['word'] * 80), 'keyword': 'erp uae'})
    last = stub('/__publish_checks')['data'][-1]
    check('the app form: not publishable, with reasons and not_checked', s == 200 and d.get('publishable') is False and d.get('exit_code') == 1 and d.get('reasons') and d.get('not_checked'), d)
    check('the app form fills the website\'s domain and country', last.get('domain') == DA and last.get('country') == 'Germany', last)
    s, d = B.post(f'/api/orgs/{OA}/sites/{SA}/publish-check', {'markdown': words, 'keyword': 'x'})
    check("the app form of another company's website is 404", s == 404, d)

    # ---- sessions, bad keys, revocation ----
    s, d = raw('GET', '/api/v1/websites', None, headers={'x-org-id': OA}, api=A)
    check('the session reads with X-Org-Id', s == 200 and {w['id'] for w in d['items']} == {SA, SU}, d)
    s, d = raw('GET', '/api/v1/websites', None, headers={'x-org-id': OB}, api=A)
    check("the session cannot name another company (404)", s == 404, d)
    s, d = raw('GET', '/api/v1/websites', 'asc_not-a-real-key', headers={'x-org-id': OA}, api=A)
    check('a malformed key is 401 even with a valid session cookie (no fallback)', s == 401 and d.get('code') == 'api_key_invalid', d)
    s, d = raw('GET', '/api/v1/websites', 'asc_' + 'x' * 43)
    check('an unknown key is 401', s == 401 and d.get('code') == 'api_key_invalid', d)
    s, d = raw('GET', '/api/v1/websites')
    check('no credentials is 401', s == 401, d)
    kid = next(x['id'] for x in A.get(f'/api/orgs/{OA}/api-keys')[1]['items'] if x['name'] == 'Looker')
    s, d = A.delete(f'/api/orgs/{OA}/api-keys/{kid}')
    s2, d2 = raw('GET', '/api/v1/websites', TR)
    check('a revoked key is refused at once', s == 200 and d['state'] == 'revoked' and s2 == 401, (d, d2))
    s, d = B.delete(f'/api/orgs/{OA}/api-keys/{kid}')
    check("another company cannot revoke our key (404)", s == 404, d)
    sql(f"update api_keys set expires_at = now() - interval '1 minute' where name='B' and org_id='{OB}'")
    s, d = raw('GET', '/api/v1/websites', TB)
    check('an expired key is refused', s == 401, d)

    # ---- MCP ----
    rpc = lambda m, params=None, i=1: raw('POST', '/api/v1/mcp', TA, {'jsonrpc': '2.0', 'id': i, 'method': m, **({'params': params} if params is not None else {})})
    s, d = rpc('initialize', {'protocolVersion': '2025-06-18', 'capabilities': {}, 'clientInfo': {'name': 'test', 'version': '1'}})
    check('MCP initialize', s == 200 and d['result']['protocolVersion'] == '2025-06-18' and 'tools' in d['result']['capabilities'], d)
    s, d = raw('POST', '/api/v1/mcp', TA, {'jsonrpc': '2.0', 'method': 'notifications/initialized'})
    check('MCP notification: 202, no body', s == 202, (s, d))
    s, d = rpc('tools/list')
    names = [t['name'] for t in d.get('result', {}).get('tools', [])]
    check('MCP tools/list', s == 200 and {'list_websites', 'get_audit', 'publish_check'} <= set(names), d)
    s, d = rpc('tools/call', {'name': 'list_websites', 'arguments': {}})
    check('MCP list_websites: our websites only', s == 200 and {w['id'] for w in d['result']['structuredContent']['items']} == {SA, SU}, d)
    s, d = rpc('tools/call', {'name': 'get_audit', 'arguments': {'websiteId': SB, 'auditId': 'aud_b1'}})
    check("MCP get_audit of the other company's website: an error result, no data", s == 200 and d['result']['isError'] is True and 'Bravo' not in json.dumps(d), d)
    s, d = raw('POST', '/api/v1/mcp', None, {'jsonrpc': '2.0', 'id': 1, 'method': 'tools/list'}, headers={'x-requested-with': 'fetch'}, api=A)
    check('MCP needs a key (a session is not enough)', s == 401, d)
    s, d = raw('POST', '/api/v1/mcp', TA, {'jsonrpc': '2.0', 'id': 1, 'method': 'tools/list'}, headers={'origin': 'https://evil.example.net'})
    check('MCP refuses a foreign Origin', s == 403, d)

    # ---- rate limit ----
    codes = [raw('GET', '/api/v1', TA)[0] for _ in range(125)]
    check('rate limit: 429 after 120 a minute per key', 429 in codes and codes.index(429) >= 100, codes[-10:])
finally:
    sql(f"delete from organizations where name like '%{TAG}%'")
    sql(f"delete from users where email like '%-{TAG}@example.org'")

print(f"\n{'ALL PASSED' if not fails else str(len(fails)) + ' FAILED: ' + ', '.join(fails)}")
sys.exit(1 if fails else 0)
