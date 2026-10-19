"""Credits, end to end against a running app (app/docs/CREDITS.md): the real server, the real Postgres, and the n8n stand-in
(scripts/stub_n8n.py) in place of the engine — nothing reaches n8n, DataForSEO or Claude, nothing costs money.

    # 1. the stand-in, on the dev network, its port on the host for this script
    docker run -d --name credits-stub --network seo-platform-dev_default -p 18099:8099 \
      -v "$PWD/scripts":/srv:ro python:3.12-alpine python3 -I /srv/stub_n8n.py
    # 2. the dev server pointed at it, with a test platform admin (an override beside compose.dev.yml)
    #    services: { server: { environment: { N8N_BASE_URL: http://credits-stub:8099, N8N_API_KEY: stub, SEO_API_KEY: stub,
    #                CALLBACK_BASE_URL: http://server:4000, PLATFORM_ADMIN_EMAILS: credits-admin@example.org, CREDIT_GUARD: 'false' } } }
    python3 app/scripts/credits_e2e.py [--base http://localhost:4000] [--stub http://localhost:18099] [--db seo-platform-dev-db-1]

Walks one company through: welcome credits → a quoted, held, charged analysis (charged from the engine's ledger row through the cost
sync, never above its quote) → a schedule's work as autopilot → credits kept for autopilot (refused, then allowed) → the on-demand limit
→ a failed run not charged → out of credits: the guard pauses the website's schedules (the stand-in's Site Admin sees it) → Buy credits
→ the admin confirms it → the guard resumes them → the activity and its CSV → and a sweep of every customer answer for provider cost.
The test company, its people and the admin are deleted at the end and the platform settings restored."""
import argparse, json, re, secrets, subprocess, sys, time, urllib.request
from api import Api

p = argparse.ArgumentParser()
p.add_argument('--base', default='http://localhost:4000')
p.add_argument('--stub', default='http://localhost:18099')
p.add_argument('--db', default='seo-platform-dev-db-1')
p.add_argument('--dbname', default='seo')
p.add_argument('--admin', default='credits-admin@example.org')
args = p.parse_args()
TAG = secrets.token_hex(3)
fails = []


def check(label, cond, detail=''):
    print(('PASS ' if cond else 'FAIL ') + label + ('' if cond else f'  -> {str(detail)[:400]}'))
    if not cond:
        fails.append(label)


def sql(q):
    r = subprocess.run(['docker', 'exec', args.db, 'psql', '-U', 'seo', '-d', args.dbname, '-tAc', q], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr)
    return r.stdout.strip()


def stub(method, path, body=None):
    req = urllib.request.Request(args.stub + path, data=json.dumps(body).encode() if body is not None else None, method=method, headers={'content-type': 'application/json'})
    with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req, timeout=20) as r:
        return json.loads(r.read() or b'{}')


LEDGER_TABLE = next(t['id'] for t in stub('GET', '/api/v1/data-tables')['data'] if t['name'] == 'seo_run_ledger')


def ledger_row(run_id, key, mode, usd, domain=''):
    now = time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime())
    stub('POST', f'/api/v1/data-tables/{LEDGER_TABLE}/rows', {'data': [{'run_id': run_id, 'key': key, 'mode': mode, 'status': 'done', 'domain': domain, 'ai_usd': 0,
                                                                       'dfs_usd': usd, 'measured_usd': usd, 'estimated_usd': 0, 'settled_at': now, 'created_at': now}]})


def no_provider_cost(label, obj):
    """no key naming dollars of cost, no Claude / DataForSEO split, no '$' amount in any string (pack prices are allowed by key)"""
    bad = []

    def walk(o, path=''):
        if isinstance(o, dict):
            for k, v in o.items():
                kl = k.lower()
                if kl in ('priceusd', 'percreditusd', 'creditvalueusd', 'packs', 'requests'):  # what the customer pays for a pack
                    continue
                if ('usd' in kl or 'dataforseo' in kl or kl.startswith('claude') or kl in ('run_ledger', 'cost_usd', 'enginecostbasis')) and v not in (None, 0, '', [], {}):
                    bad.append(f'{path}.{k}')
                walk(v, f'{path}.{k}')
        elif isinstance(o, list):
            for i, v in enumerate(o):
                walk(v, f'{path}[{i}]')
        elif isinstance(o, str) and '$' in o and any(c.isdigit() for c in o.split('$', 1)[1][:3]):
            bad.append(f'{path}: {o[:80]}')

    walk(obj)
    check(f'no provider cost in {label}', not bad, bad[:5])


def billing():
    return owner.get(f'/api/orgs/{O}/billing')[1]


def sync():
    s, r = admin.post('/api/admin/costs/sync')
    check('cost sync ran', s == 200 and r.get('ok'), r)
    return r


def guard():
    s, r = admin.post('/api/admin/credits/guard')
    check('credit guard ran', s == 200, r)
    return r


def start(mode='verdict', kw=None):
    return owner.post(f'/api/orgs/{O}/runs', {'mode': mode, 'keyword': kw or f'crm software {secrets.token_hex(2)}', 'country': 'United States'})


def site_admin_calls(domain):
    return [x['site_admin'] for x in stub('GET', '/__publish_checks')['data'] if isinstance(x, dict) and 'site_admin' in x and x['site_admin'].get('domain') == domain]


saved = None
O = None
try:
    admin = Api(args.base)
    s, _ = admin.post('/api/auth/signup', {'name': 'Credits Admin', 'email': args.admin, 'password': 'credits-e2e-pass-1'})
    if s != 200:
        s, _ = admin.post('/api/auth/login', {'email': args.admin, 'password': 'credits-e2e-pass-1'})
    sql(f"update users set email_verified_at = now() where email = '{args.admin}'")
    s, saved = admin.get('/api/admin/settings')
    check('the test admin reaches the admin panel', s == 200, saved)
    s, st = admin.put('/api/admin/settings', {**{k: v for k, v in saved.items() if k not in ('updatedAt', 'updatedBy')}, 'creditValueUsd': 0.05, 'markup': 3, 'signupCredits': 200, 'enforceForNewCompanies': True})
    check('settings: $0.05 a credit, 3x, 200 welcome credits, enforced', s == 200, st)

    owner = Api(args.base)
    email = f'credits-owner-{TAG}@example.org'
    s, _ = owner.post('/api/auth/signup', {'name': 'Owner', 'email': email, 'password': 'credits-e2e-pass-1'})
    sql(f"update users set email_verified_at = now() where email = '{email}'")
    s, org = owner.post('/api/orgs', {'name': f'Credits Co {TAG}'})
    O = org['id']
    domain = f'credits-{TAG}.example-shop.com'
    s, site = owner.post(f'/api/orgs/{O}/sites', {'domain': domain, 'country': 'United States'})
    S = site['id']
    # the website verified and tracked, the company a day old (engine money settles "now"; money spent before a company existed is never debited)
    sql(f"update sites set verified_at = now() - interval '2 days', verification_method = 'dns', tracking_status = 'active' where id = '{S}'")
    sql(f"update organizations set created_at = now() - interval '1 day' where id = '{O}'")

    b = billing()
    check('welcome: 200 credits, enforced, status ok', b['balance'] == 200 and b['enforced'] and b['status'] in ('ok', 'low', 'critical'), b)
    check('welcome credits are a lot that expires', b['lots'] and b['lots'][0]['source'] == 'signup' and b['lots'][0]['expiresAt'], b['lots'])
    check('the website has an autopilot forecast in credits', b['sites'] and b['sites'][0]['forecastMonthly'] > 100, b['sites'])
    s, costs = owner.get(f'/api/orgs/{O}/costs')
    check('/costs carries the credit rate (60 per unit)', costs.get('creditRate') == 60, costs.get('creditRate'))

    # --- an on-demand analysis: quoted, held, charged what it used --- (keep for autopilot off for now: the reserve is tested below)
    owner.put(f'/api/orgs/{O}/billing/limits', {'onDemandMonthly': None, 'autopilotMonthly': None, 'reserveForAutopilot': False})
    s, r = start()
    run = r.get('run', r)
    check('a verdict starts', s == 200 and run.get('id'), r)
    quoted = sql(f"select quoted_credits from runs where id = '{run['id']}'")
    check('it is quoted 12 credits', quoted in ('12', '12.0'), quoted)
    check('the quote is held while it runs', billing()['held'] == 12, billing()['held'])
    started = stub('GET', '/__started')['data'][-1]
    rid = sql(f"select request_id from runs where id = '{run['id']}'")
    exec1 = f'e2e-{TAG}-1'
    hook = urllib.request.Request(re.sub(r'^https?://[^/]+', args.base, started['callback_url']),  # the engine's callback, sent from here
                                  data=json.dumps({'status': 'completed', 'stage': 'content', 'request_id': rid, 'execution_id': exec1, 'keyword': 'crm', 'run_ledger': {'dataforseo_usd': 0.04, 'ai_usd': 0.06, 'run_id': exec1}}).encode(),
                                  method='POST', headers={'content-type': 'application/json'})
    with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(hook, timeout=20) as h:
        check('the engine callback is accepted', h.status == 200)
    ledger_row(exec1, f'app:{O}', 'verdict', 0.10)
    sync()
    b = billing()
    check('charged 6 credits (3x $0.10 at $0.05), not the 12 quoted', b['balance'] == 194 and b['held'] == 0 and b['month']['onDemandUsed'] == 6, {k: b[k] for k in ('balance', 'held')} | {'month': b['month']})
    s, runs = owner.get(f'/api/orgs/{O}/runs')
    no_provider_cost('the runs list', runs)
    s, rd = owner.get(f'/api/orgs/{O}/runs/{run["id"]}')
    no_provider_cost('the run page', rd)
    rep = sql(f"select id from reports where run_id = '{run['id']}' limit 1")
    s, report = owner.get(f'/api/orgs/{O}/reports/{rep}')
    check('the report opens', s == 200, report)
    no_provider_cost('the report', report)

    # --- a schedule's work is autopilot ---
    ledger_row(f'e2e-{TAG}-2', 'schedule:ai_pulse', 'ai_pulse', 0.20, domain)
    sync()
    b = billing()
    check('a schedule uses 12 credits as autopilot', b['month']['autopilotUsed'] == 12 and b['balance'] == 182, b['month'])
    check('the website shows what its autopilot used', b['sites'][0]['usedThisMonth'] == 12, b['sites'])

    # --- credits kept for autopilot ---
    owner.put(f'/api/orgs/{O}/billing/limits', {'onDemandMonthly': None, 'autopilotMonthly': None, 'reserveForAutopilot': True})
    b = billing()
    s, r = start()
    if b['onDemandAvailable'] < 12:
        check('refused: the credits are kept for autopilot (402, reason reserve)', s == 402 and r.get('reason') == 'reserve', r)
        no_provider_cost('the refusal', r)
    else:
        check('enough beside the reserve: started', s == 200, r)
    owner.put(f'/api/orgs/{O}/billing/limits', {'onDemandMonthly': None, 'autopilotMonthly': None, 'reserveForAutopilot': False})
    s, r = start()
    check('allowed once "keep for autopilot" is off', s == 200, r)
    failed_run = r.get('run', r)['id']

    # --- a failed run is not charged ---
    sql(f"update runs set status = 'failed', completed_at = now() where id = '{failed_run}'")
    rid2 = sql(f"select request_id from runs where id = '{failed_run}'")
    exec3 = f'e2e-{TAG}-3'
    sql(f"insert into reports (org_id, run_id, stage, status, title, request_id, payload) values ('{O}', '{failed_run}', 'content', 'failed', 'x', '{rid2}', '{json.dumps({'request_id': rid2, 'execution_id': exec3})}')")
    ledger_row(exec3, f'app:{O}', 'verdict', 0.30)
    sync()
    note = sql(f"select note from credit_ledger where ref_key = 'cost:engine:{exec3}'")
    check('a failed run is recorded "Not charged"', note.startswith('Not charged'), note)
    check('balance unchanged by the failed run', billing()['balance'] == 182, billing()['balance'])

    # --- the on-demand limit ---
    owner.put(f'/api/orgs/{O}/billing/limits', {'onDemandMonthly': 10, 'autopilotMonthly': None, 'reserveForAutopilot': False})
    s, r = start()
    check('refused over the on-demand limit (402, reason on_demand_limit)', s == 402 and r.get('reason') == 'on_demand_limit', r)
    owner.put(f'/api/orgs/{O}/billing/limits', {'onDemandMonthly': None, 'autopilotMonthly': None, 'reserveForAutopilot': True})

    # --- out of credits: the schedules pause ---
    admin.post(f'/api/admin/companies/{O}/credits', {'kind': 'adjust', 'credits': -500, 'note': 'e2e: drain'})
    check('balance below zero', billing()['balance'] < 0, billing()['balance'])
    s, r = start()
    check('an analysis is refused at zero (402, balance)', s == 402 and r.get('reason') == 'balance', r)
    guard()
    paused = sql(f"select tracking_status || '/' || coalesce(credits_paused_reason, '') from sites where id = '{S}'")
    check('the guard paused the website (reason balance)', paused == 'paused/balance', paused)
    check('the engine was told to pause it', any(c.get('action') == 'pause' for c in site_admin_calls(domain)), site_admin_calls(domain))
    b = billing()
    check('the page says paused', b['status'] == 'paused' and b['sites'][0]['pausedForCredits'], {k: b[k] for k in ('status',)} | {'sites': b['sites']})

    # --- Buy credits → the admin confirms → resumed ---
    s, req = owner.post(f'/api/orgs/{O}/billing/requests', {'packId': 'standard', 'note': f'PO {TAG}'})
    check('a pack is requested (2,000 credits, $100)', s == 200 and req['credits'] == 2000 and req['priceUsd'] == 100 and req['status'] == 'pending', req)
    s, reqs = admin.get('/api/admin/credit-requests')
    check('the admin sees it', any(x['id'] == req['id'] for x in reqs), reqs)
    s, g = admin.post(f'/api/admin/companies/{O}/credits', {'kind': 'grant', 'credits': 2000, 'paidUsd': 100, 'expires': 'pack', 'requestId': req['id']})
    check('the admin confirms it', s == 200, g)
    b = billing()
    check('the pack arrived, valid 12 months', any(l['source'] == 'pack' and l['credits'] == 2000 and l['expiresAt'] for l in b['lots']), b['lots'])
    check('the request is fulfilled', b['requests'][0]['status'] == 'fulfilled', b['requests'])
    guard()
    check('the guard resumed the website', sql(f"select tracking_status from sites where id = '{S}'") == 'active')
    check('the engine was told to resume it', any(c.get('action') == 'resume' for c in site_admin_calls(domain)))

    # --- activity, CSV, and the sweep ---
    s, act = owner.get(f'/api/orgs/{O}/billing/activity')
    kinds = {x['kind'] for x in act['rows']}
    check('the activity names usage, a grant and a pack', {'usage', 'pack'} <= kinds, kinds)
    check('autopilot / on-demand on each usage row', all(x['origin'] in ('autopilot', 'on_demand') for x in act['rows'] if x['kind'] == 'usage'), act['rows'][:3])
    s, csv = owner.get(f'/api/orgs/{O}/billing/activity.csv', raw=True)
    csv = csv.decode() if isinstance(csv, bytes) else str(csv)
    check('the CSV downloads with its header', s == 200 and csv.startswith('date,type,what,website,source,credits,balance_after'), csv[:120])
    check('the CSV has no dollar figure', '$' not in csv)
    no_provider_cost('the Credits page', billing())
    no_provider_cost('the activity', act)
    s, orgv = owner.get(f'/api/orgs/{O}')
    no_provider_cost('the company', orgv)
finally:
    try:
        if O:
            sql(f"delete from organizations where id = '{O}'")
        sql(f"delete from users where email like 'credits-owner-{TAG}@example.org'")
        if saved:
            admin.put('/api/admin/settings', {k: v for k, v in saved.items() if k not in ('updatedAt', 'updatedBy')})
    except Exception as e:  # cleanup must not hide the result
        print('cleanup:', e)

print(f'\n{"ALL PASSED" if not fails else f"{len(fails)} FAILED: " + "; ".join(fails)}')
sys.exit(1 if fails else 0)
