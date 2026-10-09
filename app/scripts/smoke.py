"""API integration test against a running app (dev stack: docker compose -f compose.dev.yml up -d). Free: no run reaches a paid n8n step.

    python3 app/scripts/smoke.py [--base http://localhost:4000] [--db seo-platform-dev-db-1]

Covers sign-up / login / logout, password reset, e-mail verification gate, CSRF guard, company isolation, roles (viewer / member /
admin), invitations, site rules (duplicate, unverified gate), the monthly budget guard (402), the callback token and the guards of the
keyword-ladder controls and of the keyword check (no valid write or paid check reaches n8n). Test users are
created with random e-mails under example.org and removed at the end (with their companies)."""
import argparse, json, os, secrets, subprocess, sys, urllib.error, urllib.parse, urllib.request
from api import Api

p = argparse.ArgumentParser(); p.add_argument('--base', default='http://localhost:4000'); p.add_argument('--db', default='seo-platform-dev-db-1')
args = p.parse_args()
TAG = secrets.token_hex(3)
fails = []

def check(label, cond, detail=''):
    print(('PASS ' if cond else 'FAIL ') + label + ('' if cond else f'  -> {detail}'))
    if not cond: fails.append(label)

def sql(q):
    r = subprocess.run(['docker', 'exec', args.db, 'psql', '-U', 'seo', '-d', 'seo', '-tAc', q], capture_output=True, text=True)
    return r.stdout.strip()

def user(name):
    a = Api(args.base); email = f'{name}-{TAG}@example.org'
    s, me = a.post('/api/auth/signup', {'name': name.title(), 'email': email, 'password': 'smoke-test-pass-1'})
    check(f'signup {name}', s == 200 and me['user']['email'] == email, me)
    return a, email

try:
    owner, owner_email = user('owner')
    s, _ = owner.call('POST', '/api/orgs', None)  # no body, but has the header -> validation
    raw = urllib.request.Request(args.base + '/api/orgs', data=b'{"name":"x"}', method='POST', headers={'content-type': 'application/json'})
    try:
        owner.op.open(raw); csrf = 200
    except urllib.error.HTTPError as e:
        csrf = e.code
    check('mutation without X-Requested-With is refused', csrf == 403, csrf)

    s, org = owner.post('/api/orgs', {'name': f'Smoke Co {TAG}', 'size': '2-10'}); O = org['id']
    check('create company (owner)', s == 200 and org['role'] == 'owner' and org['onboardingStep'] == 'website', org)
    s, site = owner.post(f'/api/orgs/{O}/sites', {'domain': f'smoke-{TAG}.example-shop.com', 'country': 'Germany'}); S = site.get('id')
    check('add website', s == 200 and site['verifiedAt'] is None, site)
    s, dup = owner.post(f'/api/orgs/{O}/sites', {'domain': f'https://www.smoke-{TAG}.example-shop.com/', 'country': 'Germany'})
    check('duplicate website refused (409)', s == 409, dup)
    s, d = owner.get(f'/api/orgs/{O}/sites/{S}/data/overview')
    check('dashboards need a verified domain (403)', s == 403, d)
    # never post a valid run here: it would reach n8n and cost money. Invalid bodies (validation 400) are safe.
    s, prov = owner.get('/api/auth/providers')
    if prov.get('requireEmailVerification'):
        s, d = owner.post(f'/api/orgs/{O}/runs', {'mode': 'verdict', 'siteId': None, 'keyword': 'smoke test keyword', 'country': 'Narnia'})
        check('invalid run refused before any e-mail check (400)', s == 400, d)
    else:
        check('e-mail verification is off (ACCOUNT_EMAILS=false): no e-mail gate to test', True)

    # e-mail verification through a real token
    s, r = owner.post('/api/auth/resend-verification')
    check('resend verification', s == 200, r)
    # the token is only in the e-mail; mark verified directly for the rest of the test
    sql(f"update users set email_verified_at=now() where email='{owner_email}'")
    s, d = owner.post(f'/api/orgs/{O}/runs', {'mode': 'audit', 'siteId': S, 'country': 'Germany'})
    check('site runs need a verified site (403)', s == 403 and 'Verify that you own' in d.get('error', ''), d)
    sql(f"update sites set verified_at=now(), verification_method='dns' where id='{S}'")
    # v4.10: link uploads (Search Console export -> n8n seo_link_imports; free, no run)
    s, d = owner.post(f'/api/orgs/{O}/sites/{S}/backlinks/import', {'csv': 'Target page,Incoming links\nhttps://smoke-' + TAG + '.example-shop.com/,3\n'})
    check('link upload: the "Top linked pages" table is refused with a plain message (400)', s == 400 and 'your own pages' in d.get('error', ''), d)
    s, d = owner.post(f'/api/orgs/{O}/sites/{S}/backlinks/import', {'csv': 'Linking page,Last crawled\nhttps://blog.smoke-partner.example.net/post,2026-09-28\nhttps://news.smoke-press.example.org/a,Sep 21, 2026\n', 'fileName': 'latest.csv'})
    check('link upload: Search Console "Latest links" stored (2 rows, 2 sites)', s == 200 and d.get('source') == 'gsc_latest' and d.get('rows') == 2 and d.get('domains') == 2, d)
    s, d = owner.get(f'/api/orgs/{O}/sites/{S}/data/backlinks')
    check('link upload: the backlinks dashboard lists the upload', s == 200 and any(i.get('source') == 'gsc_latest' and i.get('rows') == 2 for i in d.get('imports', [])), d.get('imports') if isinstance(d, dict) else d)
    sql(f"update organizations set monthly_budget_usd=0.5 where id='{O}'")
    s, d = owner.post(f'/api/orgs/{O}/runs', {'mode': 'keyword', 'siteId': S, 'keyword': 'smoke test keyword', 'country': 'Germany'})
    check('monthly budget guard (402)', s == 402 and d.get('code') == 'budget', d)
    s, d = owner.post(f'/api/orgs/{O}/runs', {'mode': 'keyword', 'siteId': S, 'keyword': 'x', 'country': 'Narnia'})
    check('run validation returns field errors (400)', s == 400 and 'country' in (d.get('fields') or {}), d)

    # ownership and Google data (review fixes 2026-10-03)
    S2 = owner.post(f'/api/orgs/{O}/sites', {'domain': f'second-{TAG}.example-shop.com', 'country': 'Germany'})[1]['id']
    s, d = owner.get(f'/api/orgs/{O}/sites/{S2}/google')
    check('Google connection info needs a verified site (403)', s == 403, d)
    s, d = owner.post(f'/api/orgs/{O}/sites/{S2}/verify', {'method': 'search_console'})
    check('service-account access is not proof of ownership (400)', s == 400 and d.get('code') == 'use_google', d)
    s, d = owner.patch(f'/api/orgs/{O}/sites/{S}', {'ga4PropertyId': '543096312'})
    check("a GA4 property of another domain is refused (400)", s == 400 and 'ga4PropertyId' in (d.get('fields') or {}), d)
    s, d = owner.patch(f'/api/orgs/{O}/budget', {'monthlyBudgetUsd': 99999})
    check('owners cannot raise the budget past the cap (400)', s == 400, d)

    # roles and invitations
    member, member_email = user('member')
    stranger, _ = user('stranger')
    s, inv = owner.post(f'/api/orgs/{O}/invitations', {'email': member_email, 'role': 'viewer'})
    check('invite (admin)', s == 200 and inv.get('inviteUrl', '').count('/invite/') == 1, inv)
    token = inv['inviteUrl'].rsplit('/', 1)[1]
    s, prev = stranger.get(f'/api/invitations/{token}')
    check('invitation preview', s == 200 and prev['valid'] and prev['role'] == 'viewer', prev)
    s, d = stranger.post(f'/api/invitations/{token}/accept')
    check('invitation is bound to its e-mail (403)', s == 403, d)
    s, d = member.post(f'/api/invitations/{token}/accept')
    check('accept invitation', s == 200 and d.get('orgId') == O, d)
    s, d = member.post(f'/api/orgs/{O}/runs', {'mode': 'verdict', 'siteId': None, 'keyword': 'abc keyword', 'country': 'Germany'})
    check('viewer cannot start runs (403)', s == 403, d)
    s, d = member.post(f'/api/orgs/{O}/sites/{S}/keywords/assess', {'keyword': 'smoke viewer keyword'})
    check('viewer cannot check keywords (403)', s == 403, d)
    s, d = member.get(f'/api/orgs/{O}/sites/{S}/keywords/recommended')
    check('viewer reads the recommended keywords (none yet)', s == 200 and d.get('reportId') is None and d.get('keywords') == [], d)
    s, d = member.post(f'/api/orgs/{O}/sites', {'domain': f'other-{TAG}.example-shop.com', 'country': 'Germany'})
    check('viewer cannot add websites (403)', s == 403, d)
    uid = sql(f"select id from users where email='{member_email}'")
    s, d = owner.patch(f'/api/orgs/{O}/members/{uid}', {'role': 'member'})
    check('admin changes a role', s == 200, d)
    s, d = member.post(f'/api/orgs/{O}/sites', {'domain': f'other-{TAG}.example-shop.com', 'country': 'Germany'})
    check('member still cannot add websites (403)', s == 403, d)
    s, d = member.get(f'/api/orgs/{O}/sites')
    check('member reads the company websites', s == 200 and len(d) == 2, d)
    s, d = member.patch(f'/api/orgs/{O}/budget', {'monthlyBudgetUsd': 999})
    check('only the owner sets the budget (403)', s == 403, d)

    # keyword-ladder controls (admins, verified site, the ladder must be the domain's); no valid write: nothing lands in n8n
    s, d = member.patch(f'/api/orgs/{O}/sites/{S}/ladders/lad_smoke', {'mode': 'manual'})
    check('member cannot change a ladder (403)', s == 403, d)
    s, d = member.patch(f'/api/orgs/{O}/sites/{S}/automation', {'maxWaiting': 4})
    check('member cannot change the pipeline settings (403)', s == 403, d)
    s, d = owner.patch(f'/api/orgs/{O}/sites/{S2}/ladders/lad_smoke', {'mode': 'manual'})
    check('ladder controls need a verified site (403)', s == 403, d)
    s, d = owner.patch(f'/api/orgs/{O}/sites/{S}/ladders/lad_smoke', {'mode': 'manual'})
    check('a ladder that is not the domain\'s is 404', s == 404, d)
    s, d = owner.delete(f'/api/orgs/{O}/sites/{S}/ladders/lad_smoke')
    check('deleting a ladder that is not the domain\'s is 404', s == 404, d)
    s, d = owner.patch(f'/api/orgs/{O}/sites/{S}/ladders/lad_smoke', {'status': 'stuck'})
    check('a ladder cannot be set to stuck (400)', s == 400, d)
    s, d = owner.patch(f'/api/orgs/{O}/sites/{S}/automation', {'maxActiveLadders': 9})
    check('pipeline settings are range-checked (400)', s == 400 and 'maxActiveLadders' in (d.get('fields') or {}), d)
    # keyword checks (the "New keyword ladder" flow): every request here is refused or answered from the database before n8n is
    # called (a real check costs money): validation, unverified site, the stored answer of the last 7 days, the daily limit, the budget
    A = f'/api/orgs/{O}/sites/{S}/keywords/assess'
    s, d = owner.post(A, {'keyword': 'x'})
    check('keyword check: validation (400)', s == 400 and 'keyword' in (d.get('fields') or {}), d)
    s, d = member.post(A, {'keyword': 'smoke member keyword', 'country': 'Narnia'})
    check('keyword check: a member gets field errors (400)', s == 400 and 'country' in (d.get('fields') or {}), d)
    s, d = owner.post(f'/api/orgs/{O}/sites/{S2}/keywords/assess', {'keyword': 'smoke keyword'})
    check('keyword check: needs a verified site (403)', s == 403, d)
    sql(f"update organizations set monthly_budget_usd=0 where id='{O}'")
    sql(f"""insert into keyword_checks (org_id, site_id, keyword, country, status, result, cost_usd) values ('{O}', '{S}', 'smoke cached keyword', 'Germany', 'done', '{{"ok":true,"keyword":"smoke cached keyword","difficulty_for_you":"easy","plan_type":"direct","months":"2-4","fit":2}}', 0.03)""")
    s, d = owner.post(A, {'keyword': 'Smoke  Cached Keyword'})
    check('keyword check: the same keyword within 7 days is the stored answer, free', s == 200 and d.get('cached') is True and d['result'].get('difficultyForYou') == 'easy', d)
    s, d = owner.post(A, {'keyword': 'smoke budget keyword'})
    check('keyword check: over the monthly budget (402) before n8n', s == 402 and d.get('code') == 'budget', d)
    s, u = owner.get(f'/api/orgs/{O}/usage')
    check('usage counts keyword checks in the month', s == 200 and u.get('keywordChecks') == {'checks': 1, 'usd': 0.03} and abs(u.get('estimatedUsd', 0) - 0.03) < 1e-9, u)
    sql(f"insert into keyword_checks (org_id, site_id, keyword, country, status, cost_usd) select '{O}', '{S}', 'smoke limit ' || g, 'Germany', 'failed', 0 from generate_series(1, 30) g")
    s, d = owner.post(A, {'keyword': 'smoke limit keyword'})
    check('keyword check: 30 a day per company (429) before n8n', s == 429 and d.get('code') == 'check_limit', d)
    sql(f"delete from keyword_checks where org_id='{O}' and keyword like 'smoke limit %'")
    sql(f"update organizations set monthly_budget_usd=0.5 where id='{O}'")
    s, d = owner.patch(f'/api/orgs/{O}/sites/{S}/automation', {'autoStartLadders': 'yes'})
    check('"Choose keywords for me" is a boolean (400)', s == 400, d)

    owner_id = sql(f"select id from users where email='{owner_email}'")
    s, d = owner.delete(f'/api/orgs/{O}/members/{owner_id}')
    check('the owner cannot leave (403)', s == 403, d)

    # isolation: another company sees nothing of this one
    s, d = stranger.get(f'/api/orgs/{O}')
    check('other company: company is 404', s == 404, d)
    s, d = stranger.get(f'/api/orgs/{O}/sites/{S}/data/overview')
    check('other company: dashboards are 404', s == 404, d)
    s, d = stranger.get(f'/api/orgs/{O}/runs')
    check('other company: runs are 404', s == 404, d)
    s, d = stranger.patch(f'/api/orgs/{O}/sites/{S}/ladders/lad_smoke', {'mode': 'manual'})
    check('other company: ladder controls are 404', s == 404, d)
    s, d = stranger.post(f'/api/orgs/{O}/sites/{S}/keywords/assess', {'keyword': 'smoke stranger keyword'})
    check('other company: keyword checks are 404', s == 404, d)
    s, d = stranger.get(f'/api/orgs/{O}/sites/{S}/keywords/recommended')
    check('other company: recommended keywords are 404', s == 404, d)
    s, d = stranger.post(f'/api/orgs/{O}/sites/{S}/backlinks/import', {'csv': 'Linking page\nhttps://x.example.net/\n'})
    check('other company: link uploads are 404', s == 404, d)
    s, org2 = stranger.post('/api/orgs', {'name': f'Rival {TAG}'})
    extra = [stranger.post('/api/orgs', {'name': f'Rival {TAG} {i}'})[0] for i in range(3)]
    check('companies per person are capped', extra[:2] == [200, 200] and extra[2] == 403, extra)
    s, d = stranger.post(f"/api/orgs/{org2['id']}/sites", {'domain': f'smoke-{TAG}.example-shop.com', 'country': 'Germany'})
    check('a domain verified by another company cannot be added (409)', s == 409 and d.get('code') == 'domain_claimed', d)

    # callback token
    s, d = Api(args.base).call('POST', '/api/hooks/n8n/' + 'x' * 32, {'stage': 'content'})
    check('callbacks with an unknown token are 404', s == 404, d)
    hook = sql(f"select hook_token from organizations where id='{O}'")
    s, d = Api(args.base).call('POST', '/api/hooks/n8n/' + hook, {'stage': 'site_description', 'domain': f'smoke-{TAG}.example-shop.com', 'request_id': 'none', 'description': {'business_name': 'Smoke', 'one_line_summary': 'Test'}})
    check('callback with the company token is stored', s == 200 and d.get('ok'), d)
    s, reps = owner.get(f'/api/orgs/{O}/reports')
    check('the stored report is listed for the company', s == 200 and len(reps) == 1 and reps[0]['scheduled'], reps)
    s, reps2 = stranger.get(f"/api/orgs/{org2['id']}/reports")
    check('…and not for another company', s == 200 and reps2 == [], reps2)

    # password reset and logout
    s, d = owner.post('/api/auth/forgot', {'email': owner_email})
    check('forgot password answers ok', s == 200, d)
    s, d = Api(args.base).post('/api/auth/forgot', {'email': f'nobody-{TAG}@example.org'})
    check('forgot password does not reveal unknown e-mails', s == 200, d)
    s, d = owner.post('/api/auth/reset', {'token': 'invalid-token-1234567890', 'password': 'another-pass-22'})
    check('invalid reset token refused', s == 400, d)
    s, d = owner.post('/api/auth/logout')
    s, d = owner.get('/api/me')
    check('logged out', s == 200 and d is None, d)
    s, d = owner.post('/api/auth/login', {'email': owner_email, 'password': 'wrong-password-1'})
    check('wrong password refused (401)', s == 401, d)
    s, d = owner.post('/api/auth/login', {'email': owner_email, 'password': 'smoke-test-pass-1'})
    check('login again', s == 200, d)
finally:
    # the smoke upload's rows in n8n (seo_link_imports), through the n8n public API (key from n8n/.env, never printed)
    try:
        key = next((l.split('=', 1)[1].strip().strip('"').strip("'") for l in open(os.path.join(os.path.dirname(__file__), '..', '..', 'n8n', '.env')) if l.startswith('N8N_API_KEY=')), '')
        n8n = os.environ.get('N8N_PUBLIC_URL', 'http://localhost:5678').rstrip('/') + '/api/v1'
        req = lambda path, method='GET': json.load(urllib.request.urlopen(urllib.request.Request(n8n + path, method=method, headers={'X-N8N-API-KEY': key, 'Accept': 'application/json'}), timeout=20) or [])
        if key:
            tid = next((t['id'] for t in req('/data-tables?limit=100')['data'] if t['name'] == 'seo_link_imports'), None)
            if tid: urllib.request.urlopen(urllib.request.Request(n8n + f'/data-tables/{tid}/rows/delete?filter=' + urllib.parse.quote(json.dumps({'type': 'and', 'filters': [{'columnName': 'domain', 'condition': 'eq', 'value': f'smoke-{TAG}.example-shop.com'}]}, separators=(',', ':')), safe=''), method='DELETE', headers={'X-N8N-API-KEY': key}), timeout=20)
    except Exception as e:
        print('note: could not remove the smoke upload rows from n8n:', str(e)[:120])
    sql(f"delete from organizations where name like '%{TAG}%'")
    sql(f"delete from users where email like '%-{TAG}@example.org'")

print(f"\n{'ALL PASSED' if not fails else str(len(fails)) + ' FAILED: ' + ', '.join(fails)}")
sys.exit(1 if fails else 0)
