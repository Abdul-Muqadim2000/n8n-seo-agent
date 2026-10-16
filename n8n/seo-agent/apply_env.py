#!/usr/bin/env python3
"""apply_env.py — the one command after editing n8n/.env (new client, new keys, new mail address):
1. rebuilds every workflow with the .env settings (brand, sender, ops address, service-account e-mail),
2. writes the n8n credential records from .env (sync_credentials.py, literal values),
3. imports the generated workflows, publishes the standard set (Console Alerts only when SEO_IMAP_PASSWORD is set),
4. adds the columns a newer build expects to the Data Tables that already exist (sync_tables.py, v4.9),
5. restarts n8n and waits for it.
R94 (2026-10-16): it refuses to run inside the Monday window of the weekly schedules (07:00-12:00 in GENERIC_TIMEZONE, i.e. 11:00-16:00 UTC
in summer): an import re-publishes every workflow and a restart re-arms every schedule for its NEXT time, so a weekly run that is due or
running late is thrown away. --force-monday overrides it (the Schedule Catch-up then starts what the restart threw away).
Usage: python3 apply_env.py [--no-build] [--no-restart] [--force-monday]"""
import json, os, shutil, subprocess, sys, tempfile, time, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); N8N_DIR = os.path.join(HERE, '..'); CONTAINER, PROJECT = 'n8n-n8n-1', 'wo1WpMiHjdduGvfl'
sys.path.insert(0, HERE); from env_settings import load_env
from ladder_common import ALERT_WEBHOOK_PLACEHOLDER
WORKFLOWS = ['SEO_Agent_v4.json', 'SEO_Agent_API.json', 'SEO_Agent_Error_Handler.json', 'SEO_Agent_Rank_Tracker.json', 'SEO_Agent_Site_Tracker.json', 'SEO_Agent_Page_Watch.json', 'SEO_Agent_Site_Admin.json', 'SEO_Agent_Content_Cadence.json', 'SEO_Agent_Console_Alerts.json', 'SEO_Agent_Publish_WordPress.json', 'SEO_Agent_AI_Visibility.json', 'SEO_Agent_AI_Pulse.json', 'SEO_Agent_AI_Growth.json', 'SEO_Agent_Backlink_Monitor.json', 'SEO_Agent_Audit_Scheduler.json', 'SEO_Agent_Admin_API.json', 'SEO_Agent_Keyword_Check.json', 'SEO_Agent_Link_Builder.json', 'SEO_Agent_Link_Builder_API.json', 'SEO_Agent_Reply_Reader.json', 'SEO_Agent_Prerelease.json', 'SEO_Agent_Schedule_Catchup.json', 'SEO_Agent_Publish_Check.json']
PUBLISH = ['SEOagentV4Full01', 'SEOagentAPIentry', 'SEOagentErrHandl', 'SEOagentTracker1', 'SEOagentSiteTrk1', 'SEOagentPageWch1', 'SEOagentSiteAdm1', 'SEOagentCadence1', 'SEOagentAIVisib1', 'SEOagentAIPulse1', 'SEOagentAIGrow1', 'SEOagentBacklnk1', 'SEOagentAuditSc1', 'SEOagentAdminAPI', 'SEOagentAssess', 'SEOagentLinkBld1', 'SEOagentLinkBAPI', 'SEOagentReplyRd1', 'SEOagentPreRel1', 'SEOagentCatchUp1', 'SEOagentPubCheck']
def sh(cmd, **kw): return subprocess.run(cmd, check=True, text=True, capture_output=True, **kw)
args = sys.argv[1:]
# R94 (2026-10-16, defects/C_monitors.md): every n8n restart discards a due fire - the crons re-arm for their next future time, and the
# import below re-publishes every workflow, which does the same. The weekly runs fall on Monday 07:00-11:00 in the instance's time zone
# and arrive late while the Mac sleeps (the 2026-10-12 16:38 deploy dropped five of them), so a deploy inside that window is refused.
DEFAULT_TZ = 'America/New_York'   # what n8n uses with GENERIC_TIMEZONE unset; n8n/compose.yml sets the same default explicitly
def deploy_window(now_utc=None, tz_name=None):
    """-> (inside, start_utc, end_utc): Monday 07:00-12:00 in the schedules' time zone (the weekly crons are 07:00-11:00, plus an hour
    for a run in progress); 11:00-16:00 UTC when the time zone database is not available. Build section 98 self-tests it."""
    import datetime as _dt
    now = now_utc or _dt.datetime.now(_dt.timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        tz = ZoneInfo(tz_name or DEFAULT_TZ)
        loc = now.astimezone(tz)
        start = loc.replace(hour=7, minute=0, second=0, microsecond=0) - _dt.timedelta(days=loc.weekday())
        end = start.replace(hour=12)
        a, b = start.astimezone(_dt.timezone.utc), end.astimezone(_dt.timezone.utc)
    except Exception:
        monday = (now - _dt.timedelta(days=now.weekday())).replace(minute=0, second=0, microsecond=0)
        a, b = monday.replace(hour=11), monday.replace(hour=16)
    return (a <= now < b), a, b
if __name__ == '__main__' and '--force-monday' not in args:
    _in94, _a94, _b94 = deploy_window(tz_name=(load_env().get('GENERIC_TIMEZONE') or '').strip() or DEFAULT_TZ)
    if _in94:
        sys.exit('R94: refusing to deploy now: Monday ' + _a94.strftime('%H:%M') + '-' + _b94.strftime('%H:%M') + ' UTC is when the weekly '
                 'schedules fire, and an import or a restart throws away a run that is due or late. Deploy after ' + _b94.strftime('%H:%M')
                 + ' UTC, or pass --force-monday (the Schedule Catch-up then starts what the restart threw away).')
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
