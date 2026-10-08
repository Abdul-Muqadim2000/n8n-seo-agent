#!/usr/bin/env python3
"""apply_env.py — the one command after editing n8n/.env (new client, new keys, new mail address):
1. rebuilds every workflow with the .env settings (brand, sender, ops address, service-account e-mail),
2. writes the n8n credential records from .env (sync_credentials.py, literal values),
3. imports the generated workflows, publishes the standard set (Console Alerts only when SEO_IMAP_PASSWORD is set),
4. adds the columns a newer build expects to the Data Tables that already exist (sync_tables.py, v4.9),
5. restarts n8n and waits for it.
Usage: python3 apply_env.py [--no-build] [--no-restart]"""
import json, os, subprocess, sys, time, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); N8N_DIR = os.path.join(HERE, '..'); CONTAINER, PROJECT = 'n8n-n8n-1', 'wo1WpMiHjdduGvfl'
sys.path.insert(0, HERE); from env_settings import load_env
WORKFLOWS = ['SEO_Agent_v4.json', 'SEO_Agent_API.json', 'SEO_Agent_Error_Handler.json', 'SEO_Agent_Rank_Tracker.json', 'SEO_Agent_Site_Tracker.json', 'SEO_Agent_Site_Admin.json', 'SEO_Agent_Content_Cadence.json', 'SEO_Agent_Console_Alerts.json', 'SEO_Agent_Publish_WordPress.json', 'SEO_Agent_AI_Visibility.json', 'SEO_Agent_AI_Pulse.json', 'SEO_Agent_Backlink_Monitor.json', 'SEO_Agent_Audit_Scheduler.json', 'SEO_Agent_Admin_API.json', 'SEO_Agent_Keyword_Check.json']
PUBLISH = ['SEOagentV4Full01', 'SEOagentAPIentry', 'SEOagentErrHandl', 'SEOagentTracker1', 'SEOagentSiteTrk1', 'SEOagentSiteAdm1', 'SEOagentCadence1', 'SEOagentAIVisib1', 'SEOagentAIPulse1', 'SEOagentBacklnk1', 'SEOagentAuditSc1', 'SEOagentAdminAPI', 'SEOagentAssess']
def sh(cmd, **kw): return subprocess.run(cmd, check=True, text=True, capture_output=True, **kw)
args = sys.argv[1:]
if '--no-build' not in args:
    r = subprocess.run([sys.executable, os.path.join(HERE, 'build_v4.py')], cwd=HERE, capture_output=True, text=True)
    if r.returncode != 0: print(r.stdout[-2000:], r.stderr[-2000:]); sys.exit('build failed')
    print('built:', [l for l in r.stdout.splitlines() if l.startswith('wrote')][-1])
subprocess.run([sys.executable, os.path.join(HERE, 'sync_credentials.py')], check=True)
env = load_env()
for f in WORKFLOWS:
    p = os.path.join(HERE, 'workflows', f)
    if not os.path.exists(p): continue
    sh(['docker', 'cp', p, CONTAINER + ':/tmp/' + f])
    r = sh(['docker', 'exec', CONTAINER, 'sh', '-c', 'n8n import:workflow --input=/tmp/' + f + ' --projectId=' + PROJECT + ' 2>&1 | tail -1'])
    print(f + ':', r.stdout.strip())
    subprocess.run(['docker', 'exec', '-u', 'root', CONTAINER, 'rm', '-f', '/tmp/' + f])
ids = PUBLISH + (['SEOagentConsole1'] if env.get('SEO_IMAP_PASSWORD') else [])
for wid in ids:
    sh(['docker', 'exec', CONTAINER, 'sh', '-c', 'n8n publish:workflow --id=' + wid + ' >/dev/null 2>&1 || true'])
print('published:', ', '.join(ids) + ('' if env.get('SEO_IMAP_PASSWORD') else '  (Console Alerts stays unpublished: SEO_IMAP_PASSWORD is empty)'))
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
