#!/usr/bin/env python3
"""apply_env.py — the one command after editing n8n/.env (new client, new keys, new mail address):
1. rebuilds every workflow with the .env settings (brand, sender, ops address, service-account e-mail),
2. writes the n8n credential records from .env (sync_credentials.py, literal values),
3. imports the generated workflows, publishes the standard set (Console Alerts only when SEO_IMAP_PASSWORD is set),
4. adds the columns a newer build expects to the Data Tables that already exist (sync_tables.py, v4.9),
5. restarts n8n and waits for it.
The deploy guard (2026-10-19, SCHEDULING_KEYWORDS_PLAN.md §4.8; deploy_guard.py, shared with deploy/gcp/deploy_engine.py): it refuses while a
Cycle Dispatcher job is starting or running, or a website's cycle or "Coming up" preview is due in the next 15 minutes - read from
seo_cycle_jobs / seo_cycles through n8n's public API (N8N_API_KEY). An import re-publishes every workflow and a restart kills what is
running; the dispatcher retries a killed job, but that costs one of its three attempts. If the tables cannot be read it refuses too, and says
why. --force overrides it, loudly (--force-monday, the flag of the old Monday 07:00-12:00 rule, is the same flag).
Usage: python3 apply_env.py [--no-build] [--no-restart] [--force]"""
import json, os, shutil, subprocess, sys, tempfile, time, urllib.error, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); N8N_DIR = os.path.join(HERE, '..'); CONTAINER, PROJECT = 'n8n-n8n-1', 'wo1WpMiHjdduGvfl'
sys.path.insert(0, HERE); from env_settings import load_env
from ladder_common import ALERT_WEBHOOK_PLACEHOLDER
import deploy_guard
MANIFEST = json.load(open(os.path.join(HERE, 'deploy_manifest.json'), encoding='utf-8'))   # shared with n8n/deploy/release.mjs
WORKFLOWS, PUBLISH = MANIFEST['workflows'], MANIFEST['publish']
def sh(cmd, **kw): return subprocess.run(cmd, check=True, text=True, capture_output=True, **kw)
args = sys.argv[1:]
N8N_API_BASE = os.environ.get('N8N_PUBLIC_URL', 'http://localhost:5678').rstrip('/') + '/api/v1'   # the local n8n (sync_tables.py's setting)
def n8n_api(method, path):
    """n8n's public API on this machine, for the deploy guard: (status, json). The key is read here and sent only to n8n; it is never printed."""
    key = (os.environ.get('N8N_API_KEY') or load_env().get('N8N_API_KEY') or '').strip()
    if not key: raise RuntimeError('no N8N_API_KEY in n8n/.env')
    req = urllib.request.Request(N8N_API_BASE + path, method=method, headers={'X-N8N-API-KEY': key, 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=20) as r: return r.status, json.loads(r.read() or b'null')
    except urllib.error.HTTPError as e: return e.code, None
if __name__ == '__main__':
    _refusal = deploy_guard.check(n8n_api, args)
    if _refusal: sys.exit(_refusal)
if '--no-build' not in args:
    r = subprocess.run([sys.executable, os.path.join(HERE, 'build_v4.py')], cwd=HERE, capture_output=True, text=True)
    if r.returncode != 0: print(r.stdout[-2000:], r.stderr[-2000:]); sys.exit('build failed')
    print('built:', [l for l in r.stdout.splitlines() if l.startswith('wrote')][-1])
subprocess.run([sys.executable, os.path.join(HERE, 'sync_credentials.py')], check=True)
env = load_env()
# R29 (2026-10-14, FIX_PLAN §3.12, secret handling): SEO_ALERT_WEBHOOK_URL is a bearer URL (anyone holding a Slack incoming webhook can post
# into the channel) and this repository is PUBLIC, so build_v4.py bakes ALERT_WEBHOOK_PLACEHOLDER into the node code instead of the value.
# The real URL is substituted HERE, into a copy outside the repository, after the build and before the import: the deployed instance gets a
# working channel and workflows/*.json and harness/code_v4/*.js never carry the secret. An unset setting leaves the placeholder in place,
# which the ops-alert kit reads as "no webhook configured" (OA.cfgUrl) — exactly what an empty setting meant before.
SECRETS = {ALERT_WEBHOOK_PLACEHOLDER: (env.get('SEO_ALERT_WEBHOOK_URL') or '').strip()}
_tmp = tempfile.mkdtemp(prefix='seo-agent-import-')
_subst = []
def for_import(path, fname):
    """The file to hand to the import: the repository's own file, or a substituted copy in a temp directory outside it."""
    text = open(path, encoding='utf-8').read()
    hits = [ph for ph, val in SECRETS.items() if val and ph in text]
    if not hits: return path
    for ph in hits: text = text.replace(ph, json.dumps(SECRETS[ph])[1:-1])   # JSON-escaped: the workflow file is JSON
    out = os.path.join(_tmp, fname)
    open(out, 'w', encoding='utf-8').write(text)
    _subst.append(fname + ' (' + ', '.join(hits) + ')')
    return out
for f in WORKFLOWS:
    p = os.path.join(HERE, 'workflows', f)
    if not os.path.exists(p): continue
    sh(['docker', 'cp', for_import(p, f), CONTAINER + ':/tmp/' + f])
    r = sh(['docker', 'exec', CONTAINER, 'sh', '-c', 'n8n import:workflow --input=/tmp/' + f + ' --projectId=' + PROJECT + ' 2>&1 | tail -1'])
    print(f + ':', r.stdout.strip())
    subprocess.run(['docker', 'exec', '-u', 'root', CONTAINER, 'rm', '-f', '/tmp/' + f])
shutil.rmtree(_tmp, ignore_errors=True)   # R29: the substituted copies never outlive the import
print('secrets substituted at import time (never written to the repository): ' + ('; '.join(_subst) if _subst else
      'nothing' + ('' if SECRETS[ALERT_WEBHOOK_PLACEHOLDER] else ' — SEO_ALERT_WEBHOOK_URL is empty, so the webhook channel stays unconfigured')))
hold = {a.split('=', 1)[1] for a in args if a.startswith('--except=')}   # e.g. --except=SEOagentReplyRd1: imported but left unpublished
ids = [w for w in PUBLISH + (['SEOagentConsole1'] if env.get('SEO_IMAP_PASSWORD') else []) if w not in hold]
for wid in ids:
    sh(['docker', 'exec', CONTAINER, 'sh', '-c', 'n8n publish:workflow --id=' + wid + ' >/dev/null 2>&1 || true'])
print('published:', ', '.join(ids) + ('' if env.get('SEO_IMAP_PASSWORD') else '  (Console Alerts stays unpublished: SEO_IMAP_PASSWORD is empty)') + (('  held back: ' + ', '.join(sorted(hold))) if hold else ''))
subprocess.run([sys.executable, os.path.join(HERE, 'sync_tables.py')])   # new columns on existing Data Tables (reports, never fails the apply)
if '--no-restart' not in args:
    subprocess.run(['docker', 'compose', 'up', '-d', 'n8n'], cwd=N8N_DIR, capture_output=True, text=True)
    subprocess.run(['docker', 'compose', 'restart', 'n8n'], cwd=N8N_DIR, capture_output=True, text=True)
    for _ in range(60):
        try:
            if urllib.request.urlopen('http://localhost:5678/healthz', timeout=3).status == 200: print('n8n is up'); break
        except Exception: pass
        time.sleep(3)
    else: print('n8n did not answer within 3 minutes; check docker compose logs n8n')
