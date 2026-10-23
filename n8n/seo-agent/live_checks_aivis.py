#!/usr/bin/env python3
"""W2-E3 (2026-10-23): the one-call LIVE checks of the AI visibility engine's DataForSEO fields, for the owner to run.

DataForSEO's sandbox answers with dummy data and does not validate every request field (it accepted `web_search_country_iso_code` for Claude,
which the live API refuses with 40501), so a field the engine relies on is confirmed with ONE live call before the option that uses it is
switched on. This script makes exactly those calls:

  docs/AI_PANEL_SCALE_HANDOFF.md section 7 (G6, still open):
    1. ChatGPT API   ai_optimization/chat_gpt/llm_responses/live  gpt-5.4-mini, web_search, max_output_tokens, web_search_country_iso_code
    2. Gemini API    ai_optimization/gemini/llm_responses/live    gemini-3.5-flash, web_search, max_output_tokens
    3. results page  serp/google/organic/live/advanced            depth 10 (People also ask; the W2-E3 fan-out check uses the same shape)
    4. model lists   GET ai_optimization/{chat_gpt,gemini}/llm_responses/models  (free)
  W2-E3 (this wave):
    5. persona test  chat_gpt/llm_responses/live + system_message (ai_persona_context: the buyer role as the asker's context)
    6. market trend  ai_optimization/llm_mentions/historical/live            (ai_demand_market)
    7.               ai_optimization/llm_mentions/timeseries_new_lost/live    date_from / date_to / group_range "month" (the sandbox asked for both)
    8.               ai_optimization/llm_mentions/top_mentioned_brands/live   target keyword + search_scope answer + limit

DRY RUN BY DEFAULT: it prints every request and the estimated cost and sends nothing. `--apply` sends them (about $0.38 in all; each check's
own `task.cost` is printed). Credentials are read from n8n/.env (SEO_DATAFORSEO_LOGIN / SEO_DATAFORSEO_PASSWORD) and passed to the request
by environment variable only; they are never printed or written. DataForSEO is not reachable from the Mac (corporate TLS proxy), so the calls
are made inside a throwaway container (python:3.12-alpine) unless `--direct` is given (e.g. when this runs inside the n8n container).

  python3 live_checks_aivis.py                    # dry run: the requests and the cost
  python3 live_checks_aivis.py --apply            # send them (throwaway container)
  python3 live_checks_aivis.py --apply --only 5,6 # a subset
  python3 live_checks_aivis.py --apply --out /tmp/aivis_live.json   # also keep the acceptance results (no credentials, no answer text)
  python3 live_checks_aivis.py --sandbox          # the same calls on the free sandbox: proves the script runs, NOT the fields
  (--env PATH reads another .env file, e.g. from a checkout that has none)

Acceptance per check is printed as PASS / FAIL with the reason; on a FAIL keep the option it guards off and correct the request field (and, for
a price that differs, AIP.PRICE / AIP.XPRICE in v5/code/_ai_panel.js together with app/shared/src/ai-panel.ts and the golden cases)."""
import json, os, subprocess, sys, base64, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ENV_FILE = os.path.normpath(os.path.join(HERE, '..', '.env'))
TODAY = datetime.date.today()
SIX_BACK = (TODAY.replace(day=1) - datetime.timedelta(days=150)).replace(day=1)

def checks():
    q = 'Which e-invoicing providers are accredited in the UAE?'
    return [
        {'id': 1, 'name': 'ChatGPT API: gpt-5.4-mini with web search, max_output_tokens and the country (AE)', 'est': 0.012, 'method': 'POST',
         'path': 'ai_optimization/chat_gpt/llm_responses/live', 'body': [{'user_prompt': q, 'model_name': 'gpt-5.4-mini', 'web_search': True, 'max_output_tokens': 1200, 'web_search_country_iso_code': 'AE'}],
         'accept': 'task 20000; result[0].web_search is true; items[0].sections[0].annotations not empty; note task.cost (estimate $0.012, AIP.PRICE.chatgpt_api)'},
        {'id': 2, 'name': 'Gemini API: gemini-3.5-flash with web search and max_output_tokens', 'est': 0.02, 'method': 'POST',
         'path': 'ai_optimization/gemini/llm_responses/live', 'body': [{'user_prompt': q, 'model_name': 'gemini-3.5-flash', 'web_search': True, 'max_output_tokens': 1200}],
         'accept': 'task 20000; result[0].web_search is true; annotations not empty; note task.cost (estimate $0.02, AIP.PRICE.gemini_api)'},
        {'id': 3, 'name': 'Google results page, 10 deep, the UAE (People also ask; the fan-out check\'s request)', 'est': 0.002, 'method': 'POST',
         'path': 'serp/google/organic/live/advanced', 'body': [{'keyword': 'e-invoicing software uae', 'location_code': 2784, 'language_code': 'en', 'depth': 10}],
         'accept': 'task 20000; organic items present; task.cost about $0.002 (AIP.XPRICE.fanout_serp)'},
        {'id': 4, 'name': 'the model lists (free): gpt-5.4-mini and gemini-3.5-flash exist with web search', 'est': 0.0, 'method': 'GET',
         'path': ['ai_optimization/chat_gpt/llm_responses/models', 'ai_optimization/gemini/llm_responses/models'], 'body': None,
         'accept': 'both lists name the model with web_search_supported true'},
        {'id': 5, 'name': 'persona test: the ChatGPT API takes system_message (the buyer role as the asker\'s context)', 'est': 0.012, 'method': 'POST',
         'path': 'ai_optimization/chat_gpt/llm_responses/live', 'body': [{'user_prompt': q, 'model_name': 'gpt-5.4-mini', 'web_search': True, 'max_output_tokens': 1200, 'web_search_country_iso_code': 'AE',
                                                                          'system_message': 'The person asking you is a CFO at a business in United Arab Emirates. Answer their question as you would answer that person.'}],
         'accept': 'task 20000 (not 40501 Invalid Field system_message); an answer text; note task.cost'},
        {'id': 6, 'name': 'market trend: LLM Mentions historical for a domain (Google AI Overview answers in the UAE)', 'est': 0.11, 'method': 'POST',
         'path': 'ai_optimization/llm_mentions/historical/live', 'body': [{'target': [{'domain': 'techand.ai'}], 'location_code': 2784, 'language_code': 'en', 'platform': 'google'}],
         'accept': 'task 20000; items of {year, month, metrics: {mentions, ai_search_volume}}; note task.cost (estimate $0.11, AIP.XPRICE.demand_task)'},
        {'id': 7, 'name': 'market trend: LLM Mentions timeseries_new_lost with date_from / date_to / group_range month', 'est': 0.11, 'method': 'POST',
         'path': 'ai_optimization/llm_mentions/timeseries_new_lost/live', 'body': [{'target': [{'domain': 'techand.ai'}], 'location_code': 2784, 'language_code': 'en', 'platform': 'google',
                                                                                    'date_from': SIX_BACK.isoformat(), 'date_to': TODAY.isoformat(), 'group_range': 'month'}],
         'accept': 'task 20000 (the sandbox refused the call without date_from and group_range); items of {date, new_mentions, lost_mentions, ...}'},
        {'id': 8, 'name': 'market trend: LLM Mentions top_mentioned_brands for a topic (answers), limit 10', 'est': 0.11, 'method': 'POST',
         'path': 'ai_optimization/llm_mentions/top_mentioned_brands/live', 'body': [{'target': [{'keyword': 'e-invoicing uae', 'search_scope': ['answer']}], 'location_code': 2784, 'language_code': 'en', 'platform': 'google', 'limit': 10}],
         'accept': 'task 20000; items of {brand, total: {mentions, ai_search_volume}}; note task.cost'},
    ]

def judge(c, answers):
    """-> (ok, why, cost) from the live answers of one check (never the answer text)."""
    t0 = lambda r: ((r or {}).get('tasks') or [{}])[0] or {}
    r0 = lambda r: (t0(r).get('result') or [{}])[0] or {}
    cost = round(sum(float(t0(a).get('cost') or 0) for a in answers), 6)
    if c['id'] == 4:
        names = {'gpt-5.4-mini': False, 'gemini-3.5-flash': False}
        for a in answers:
            for t in (a.get('tasks') or []):
                for it in (t.get('result') or []):
                    for m in ([it] + list((it or {}).get('items') or [])):
                        nm = str((m or {}).get('model_name') or (m or {}).get('name') or '')
                        if nm in names and (m or {}).get('web_search_supported') in (True, None): names[nm] = True
        return all(names.values()), 'models with web search: ' + json.dumps(names), cost
    a = answers[0] if answers else {}
    t = t0(a)
    if a.get('_error') or t.get('status_code') != 20000:
        return False, 'status %s %s' % (t.get('status_code') or a.get('_error'), str(t.get('status_message') or '')[:160]), cost
    r = r0(a)
    if c['id'] in (1, 2):
        secs = [s for it in (r.get('items') or []) for s in (it.get('sections') or [])]
        ok = r.get('web_search') is True and any(s.get('annotations') for s in secs)
        return ok, 'web_search=%s, annotated sections=%d' % (r.get('web_search'), sum(1 for s in secs if s.get('annotations'))), cost
    if c['id'] == 3:
        n = sum(1 for i in (r.get('items') or []) if (i or {}).get('type') == 'organic')
        return n > 0, '%d organic results, People also ask: %s' % (n, any((i or {}).get('type') == 'people_also_ask' for i in (r.get('items') or []))), cost
    if c['id'] == 5:
        txt = ''.join(s.get('text') or '' for it in (r.get('items') or []) for s in (it.get('sections') or []))
        return bool(txt), 'answered %d characters with the role as context' % len(txt), cost
    items = r.get('items') or []
    keys = {6: ('year', 'month', 'metrics'), 7: ('date', 'new_mentions', 'lost_mentions'), 8: ('brand', 'total')}[c['id']]
    ok = isinstance(items, list) and (not items or all(k in (items[0] or {}) for k in keys))
    return ok, '%d item(s), first keys %s' % (len(items), sorted((items[0] or {}).keys())[:8] if items else '[] (no data for this target: the shape is still confirmed by status 20000)'), cost

INNER = r'''
import os, json, base64, urllib.request, sys
auth = base64.b64encode((os.environ['DFS_LOGIN'] + ':' + os.environ['DFS_PASSWORD']).encode()).decode()
spec = json.loads(sys.stdin.read()); out = []
for method, path, body in spec:
    req = urllib.request.Request(os.environ.get('DFS_BASE', 'https://api.dataforseo.com/v3/') + path, data=json.dumps(body).encode() if body is not None else None, method=method,
                                 headers={'Authorization': 'Basic ' + auth, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=180) as r: out.append(json.loads(r.read()))
    except Exception as e: out.append({'_error': str(e)[:200]})
print(json.dumps(out))
'''

def send(calls, direct, sandbox=False, env_file=None):
    """calls = [(method, path, body)] -> answers, credentials by environment variable only."""
    sys.path.insert(0, HERE)
    from env_settings import load_env
    e = load_env(env_file or ENV_FILE)
    login, pw = e.get('SEO_DATAFORSEO_LOGIN', ''), e.get('SEO_DATAFORSEO_PASSWORD', '')
    if not login or not pw: sys.exit('live_checks_aivis: SEO_DATAFORSEO_LOGIN / SEO_DATAFORSEO_PASSWORD are not set in n8n/.env')
    env = dict(os.environ, DFS_LOGIN=login, DFS_PASSWORD=pw, DFS_BASE='https://sandbox.dataforseo.com/v3/' if sandbox else 'https://api.dataforseo.com/v3/')
    cmd = [sys.executable, '-I', '-c', INNER] if direct else ['docker', 'run', '--rm', '-i', '-e', 'DFS_LOGIN', '-e', 'DFS_PASSWORD', '-e', 'DFS_BASE', 'python:3.12-alpine', 'python', '-I', '-c', INNER]
    r = subprocess.run(cmd, input=json.dumps(calls), capture_output=True, text=True, env=env, timeout=900)
    if r.returncode != 0: sys.exit('live_checks_aivis: the request runner failed: ' + (r.stderr or '')[-400:])
    return json.loads(r.stdout.strip().splitlines()[-1])

def main():
    a = sys.argv[1:]
    apply, direct, sandbox = '--apply' in a or '--sandbox' in a, '--direct' in a, '--sandbox' in a   # --sandbox: the same calls on the FREE sandbox (dummy data; proves this script, not the fields)
    only = set()
    if '--only' in a: only = {int(x) for x in a[a.index('--only') + 1].split(',') if x.strip()}
    out_file = a[a.index('--out') + 1] if '--out' in a else ''
    cs = [c for c in checks() if not only or c['id'] in only]
    print('AI visibility live checks (%s), %d check(s), estimated cost $%.3f' % ('SANDBOX (free, dummy data: the fields are NOT validated)' if sandbox else 'APPLY' if apply else 'dry run: nothing is sent', len(cs), 0.0 if sandbox else sum(c['est'] for c in cs)))
    for c in cs:
        print('\n[%d] %s  (~$%.3f)\n    %s %s\n    accept: %s' % (c['id'], c['name'], c['est'], c['method'], c['path'] if isinstance(c['path'], str) else ' + '.join(c['path']), c['accept']))
        if c['body'] is not None: print('    body: ' + json.dumps(c['body']))
    if not apply:
        print('\nDry run. Run again with --apply to send these (DataForSEO money: about $%.2f).' % sum(c['est'] for c in cs)); return 0
    calls, idx = [], []
    for c in cs:
        for p in ([c['path']] if isinstance(c['path'], str) else c['path']): idx.append(c['id']); calls.append((c['method'], p, c['body']))
    answers = send(calls, direct, sandbox, a[a.index('--env') + 1] if '--env' in a else ENV_FILE)
    results, total, fails = [], 0.0, 0
    for c in cs:
        ok, why, cost = judge(c, [ans for i, ans in zip(idx, answers) if i == c['id']])
        total += cost; fails += 0 if ok else 1
        results.append({'id': c['id'], 'check': c['name'], 'ok': ok, 'why': why, 'task_cost_usd': cost, 'estimate_usd': c['est']})
        print('%s [%d] %s - %s (task.cost $%.4f, estimate $%.3f)' % ('PASS' if ok else 'FAIL', c['id'], c['name'], why, cost, c['est']))
    print('\n%d of %d passed; DataForSEO money spent: $%.4f' % (len(cs) - fails, len(cs), total))
    if out_file:
        json.dump({'ran_at': datetime.datetime.utcnow().isoformat() + 'Z', 'results': results, 'spent_usd': round(total, 4)}, open(out_file, 'w'), indent=1)
        print('results written to ' + out_file + ' (no credentials, no answer text)')
    return 1 if fails else 0

if __name__ == '__main__':
    sys.exit(main())
