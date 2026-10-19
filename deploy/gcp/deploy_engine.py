#!/usr/bin/env python3
"""deploy_engine.py — puts the SEO engine (the generated n8n workflows) on the PRODUCTION n8n, through n8n's public API over the IAP
tunnel. It is apply_env.py for a remote instance: no `docker exec`, no restart.

  deploy/gcp/tunnel.sh                         (other terminal: http://localhost:15678 -> the VM's n8n)
  python3 deploy/gcp/deploy_engine.py          dry run: builds, compares with the remote, says what it would update / publish
  python3 deploy/gcp/deploy_engine.py --apply  updates every workflow, publishes the standard set, adds missing Data Table columns

  --no-build            use the generated workflows/*.json as they are (default: run build_v4.py first, which needs n8n/.env)
  --credentials         also rewrite the credential records from n8n/.env (PATCH by their fixed ids; values never printed)
  --create-missing      a workflow or credential the remote does not have yet is imported through IAP SSH with n8n's CLI
                        (the public API cannot create a record with a fixed id; the workflows reference each other by id)
  --n8n-url URL         default http://localhost:15678
  --force               deploy while a website's cycle job is in flight or due anyway (the deploy guard, below); --force-monday,
                        the flag of the old Monday rule, is the same flag

What it does, in order (each step says what it found):
 1. the deploy guard (n8n/seo-agent/deploy_guard.py, shared with apply_env.py; SCHEDULING_KEYWORDS_PLAN.md §4.8): refuses while a Cycle
    Dispatcher job is starting or running, or a website's cycle or "Coming up" preview is due in the next 15 minutes - read from
    seo_cycle_jobs / seo_cycles through the remote n8n's public API. An update re-publishes workflows and can kill a running job (the
    dispatcher retries it, at the cost of one attempt). Tables that cannot be read refuse too, with the reason. --force overrides, loudly
 2. builds with the owner's settings (build_v4.py, exit code checked) unless --no-build
 3. for each workflow of deploy_manifest.json: substitutes the alert webhook (R29: the real URL only ever exists in memory and on
    the instance), then PUT /api/v1/workflows/<id> when the content differs. n8n 2.41.4 makes a PUT on a published workflow live at
    once (verified 2026-10-18 on a scratch instance: activeVersionId follows the new versionId)
 4. POST /api/v1/workflows/<id>/activate for the manifest's publish set (+ publish_when_imap when SEO_IMAP_PASSWORD is set) - idempotent
 5. --credentials: PATCH /api/v1/credentials/<id> for every credential sync_credentials.py defines whose values are set
 6. sync_tables.py against the remote (new Data Table columns), with the same key
The API key is N8N_API_KEY from n8n/.env (it stays valid on the server when the instance key was carried over by the migration), or
N8N_REMOTE_API_KEY from the environment. Nothing prints a key, a credential value or the alert webhook.
"""
import ast, datetime as dt, json, os, subprocess, sys, urllib.error, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
ENGINE = os.path.join(REPO, 'n8n', 'seo-agent')
PROJECT_ID_N8N = 'wo1WpMiHjdduGvfl'   # the n8n project of the workflows and Data Tables (carried over by the migration)
args = sys.argv[1:]
APPLY = '--apply' in args
def opt(flag, default=None):
    return args[args.index(flag) + 1] if flag in args and args.index(flag) + 1 < len(args) else default
URL = opt('--n8n-url', os.environ.get('N8N_REMOTE_URL', 'http://localhost:15678')).rstrip('/')


def main_checkout():
    """n8n/.env lives in the main checkout only (a git worktree has none)."""
    try:
        common = subprocess.run(['git', '-C', REPO, 'rev-parse', '--path-format=absolute', '--git-common-dir'],
                                capture_output=True, text=True, check=True).stdout.strip()
        return os.path.dirname(common)
    except Exception:
        return REPO


ENV_FILE = os.environ.get('N8N_ENV_FILE') or os.path.join(main_checkout(), 'n8n', '.env')


def load_env(path=ENV_FILE):
    env = {}
    if not os.path.exists(path): return env
    for line in open(path, encoding='utf-8'):
        line = line.rstrip('\n')
        if not line or line.lstrip().startswith('#') or '=' not in line: continue
        k, v = line.split('=', 1); k, v = k.strip(), v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in '"\'': v = v[1:-1]
        env[k] = v
    return env


def literal(path, *names):
    """Module-level constants of a script, read without running it (apply_env.py builds and deploys when imported)."""
    out = {}
    for n in ast.parse(open(path, encoding='utf-8').read()).body:
        if isinstance(n, ast.Assign):
            for t in n.targets:
                if isinstance(t, ast.Name) and t.id in names: out[t.id] = ast.literal_eval(n.value)
    return out


sys.path.insert(0, ENGINE)
import deploy_guard   # the one deploy guard, shared with apply_env.py (build section 131 self-tests it)


ENV = load_env()
KEY = os.environ.get('N8N_REMOTE_API_KEY') or ENV.get('N8N_API_KEY') or ''


def api(method, path, body=None):
    req = urllib.request.Request(URL + '/api/v1' + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json', 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        txt = e.read().decode('utf-8', 'replace')
        try: return e.code, json.loads(txt)
        except Exception: return e.code, {'message': txt[:300]}


def ssh_import(kind, payload_path):
    """--create-missing: n8n's CLI on the VM, fed through IAP SSH stdin (import:workflow / import:credentials upsert by id)."""
    gcloud = os.environ.get('GCLOUD') or (os.path.join(HERE, 'gcloud-docker.sh') + ' gcloud')
    vm, zone, project = os.environ.get('VM', 'alaventra-vm-1'), os.environ.get('ZONE', 'me-central1-a'), os.environ.get('PROJECT', 'alaventra-prod')
    remote = ("sudo docker exec -i alaventra-n8n-1 sh -c 'cat > /tmp/in.json && n8n import:%s --input=/tmp/in.json --projectId=%s"
              " 2>&1 | tail -1; rm -f /tmp/in.json'" % (kind, PROJECT_ID_N8N))
    with open(payload_path, 'rb') as f:
        r = subprocess.run(gcloud.split() + ['compute', 'ssh', vm, '--zone=' + zone, '--project=' + project, '--tunnel-through-iap',
                                             '--quiet', '--command', remote], stdin=f, capture_output=True, text=True)
    return r.returncode, (r.stdout.strip().splitlines() or [''])[-1]


def main():
    say = print
    say('deploy_engine: %s -> %s (%s)' % (os.path.relpath(ENGINE, REPO), URL, 'APPLY' if APPLY else 'dry run'))
    if not KEY: sys.exit('no n8n API key: N8N_API_KEY in ' + ENV_FILE + ' or N8N_REMOTE_API_KEY in the environment')
    try:
        st, health = api('GET', '/workflows?limit=1')
    except Exception as e:   # urllib.error.URLError: nothing listens on the tunnel's port
        st = 'no answer (%s)' % str(e)[:120]
    if st != 200:
        sys.exit('the remote n8n public API answered %s at %s (tunnel open? deploy/gcp/tunnel.sh; key valid there?)' % (st, URL))
    # 1. the deploy guard, read from the remote instance's own cycle tables (never prints the key)
    refusal = deploy_guard.check(api, args, now=dt.datetime.now(dt.timezone.utc), say=say)
    if refusal:
        sys.exit(refusal)

    # 2. build
    if '--no-build' not in args:
        if not os.path.exists(os.path.join(ENGINE, '..', '.env')):
            sys.exit('build needs n8n/.env next to the engine (run from the main checkout), or pass --no-build to deploy the committed files')
        r = subprocess.run([sys.executable, 'build_v4.py'], cwd=ENGINE, capture_output=True, text=True)
        if r.returncode != 0:
            print(r.stdout[-1500:], r.stderr[-1500:]); sys.exit('build failed (exit %d)' % r.returncode)
        say('built: ' + ([l for l in r.stdout.splitlines() if l.startswith('wrote')] or ['ok'])[-1])

    # the one deploy list (deploy_manifest.json, also read by apply_env.py and n8n/deploy/release.mjs)
    manifest = json.load(open(os.path.join(ENGINE, 'deploy_manifest.json'), encoding='utf-8'))
    consts = {'WORKFLOWS': manifest['workflows'], 'PUBLISH': manifest['publish']}
    placeholder = literal(os.path.join(ENGINE, 'ladder_common.py'), 'ALERT_WEBHOOK_PLACEHOLDER')['ALERT_WEBHOOK_PLACEHOLDER']
    hook = (ENV.get('SEO_ALERT_WEBHOOK_URL') or '').strip()
    updated, same, missing, failed = [], [], [], []
    for fname in consts['WORKFLOWS']:
        p = os.path.join(ENGINE, 'workflows', fname)
        if not os.path.exists(p): continue
        text = open(p, encoding='utf-8').read()
        if hook and placeholder in text: text = text.replace(placeholder, json.dumps(hook)[1:-1])   # R29: in memory only
        wf = json.loads(text); wf = wf[0] if isinstance(wf, list) else wf
        wid = wf['id']
        st, cur = api('GET', '/workflows/' + wid)
        if st == 404:
            missing.append((fname, wid, text)); say('  missing remotely: %s (%s)' % (wid, fname)); continue
        if st != 200:
            failed.append(wid + ' GET ' + str(st)); continue
        body = {'name': wf['name'], 'nodes': wf['nodes'], 'connections': wf['connections'], 'settings': wf.get('settings') or {}}
        unchanged = (json.dumps(cur.get('nodes'), sort_keys=True) == json.dumps(wf['nodes'], sort_keys=True)
                     and json.dumps(cur.get('connections'), sort_keys=True) == json.dumps(wf['connections'], sort_keys=True)
                     and cur.get('name') == wf['name'])
        if unchanged: same.append(wid); continue
        if not APPLY: updated.append(wid); say('  would update %s (%s, %d nodes)' % (wid, fname, len(wf['nodes']))); continue
        st, r = api('PUT', '/workflows/' + wid, body)
        if st == 200: updated.append(wid); say('  updated %s (%s, %d nodes)' % (wid, fname, len(wf['nodes'])))
        else: failed.append('%s PUT %s: %s' % (wid, st, str((r or {}).get('message'))[:200]))
    say('workflows: %d %s, %d unchanged, %d missing remotely' % (len(updated), 'updated' if APPLY else 'to update', len(same), len(missing)))

    if missing and '--create-missing' in args:
        for fname, wid, text in missing:
            if not APPLY: say('  would import %s through IAP SSH' % wid); continue
            tmp = os.path.join(os.environ.get('TMPDIR', '/tmp'), 'alaventra-' + wid + '.json')
            fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, 'w', encoding='utf-8') as f: f.write(text)
            try: rc, last = ssh_import('workflow', tmp)
            finally: os.unlink(tmp)
            (say if rc == 0 else failed.append)('  imported %s: %s' % (wid, last) if rc == 0 else wid + ' import failed: ' + last)
    elif missing:
        say('  (missing workflows are created by the migration - migrate_data.md - or by --create-missing)')

    # 4. publish
    publish = list(consts['PUBLISH']) + (list(manifest.get('publish_when_imap') or []) if ENV.get('SEO_IMAP_PASSWORD') else [])
    hold = {x.split('=', 1)[1] for x in args if x.startswith('--except=')}
    # The public API refuses to publish a workflow whose Execute Workflow nodes call an unpublished sub-workflow ("Please publish all
    # referenced sub-workflows first"; the CLI's publish:workflow does not check). So: passes until nothing moves, and a referenced
    # sub-workflow that is not in the list (the WordPress publisher, which only has an Execute Workflow Trigger) is published first.
    import re
    pub_ok, todo, extra, last_err = [], [w for w in publish if w not in hold], [], {}
    if not APPLY:
        pub_ok = todo
    for _pass in range(6 if APPLY else 0):
        progressed, nxt = False, []
        for wid in todo:
            st, r = api('POST', '/workflows/%s/activate' % wid)
            if st == 200:
                pub_ok.append(wid); progressed = True; continue
            msg = str((r or {}).get('message'))
            m = re.search(r'references workflow (\S+) .*not published', msg)
            if m and m.group(1) not in todo and m.group(1) not in pub_ok and m.group(1) not in hold:
                extra.append(m.group(1)); nxt.insert(0, m.group(1)); progressed = True
            last_err[wid] = '%s (%s: %s)' % (wid, st, msg[:160])
            nxt.append(wid)
        todo = list(dict.fromkeys(nxt))
        if not todo or not progressed: break
    pub_fail = [last_err[w] for w in todo] if APPLY else []
    say('published: %d%s%s%s' % (len(pub_ok), ' (would publish)' if not APPLY else '',
        (' (incl. referenced sub-workflows: ' + ', '.join(extra) + ')') if extra else '', ('; FAILED: ' + '; '.join(pub_fail)) if pub_fail else ''))
    failed += pub_fail

    # 5. credentials
    if '--credentials' in args:
        sys.path.insert(0, ENGINE)
        import sync_credentials as SC
        done, skipped, cmiss = [], [], []
        for cid, name, ctype, secrets_, fixed in SC.CREDS:
            if any(not ENV.get(v) for v in secrets_.values()): skipped.append(cid); continue
            data = dict(fixed)
            for field, var in secrets_.items(): data[field] = SC.PREFIX.get((cid, field), '') + ENV[var]
            if not APPLY: done.append(cid); continue
            st, r = api('PATCH', '/credentials/' + cid, {'name': name, 'type': ctype, 'data': data})
            if st == 200: done.append(cid)
            elif st == 404: cmiss.append((cid, name, ctype, data))
            else: failed.append('credential %s PATCH %s' % (cid, st))
        if cmiss and '--create-missing' in args and APPLY:
            tmp = os.path.join(os.environ.get('TMPDIR', '/tmp'), 'alaventra-creds.json')
            fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, 'w', encoding='utf-8') as f: json.dump([{'id': c, 'name': n, 'type': t, 'data': d} for c, n, t, d in cmiss], f)
            try: rc, last = ssh_import('credentials', tmp)
            finally: os.unlink(tmp)
            (done.extend(c for c, *_ in cmiss) if rc == 0 else failed.append('credential import failed: ' + last))
        elif cmiss:
            say('  credentials missing remotely: ' + ', '.join(c for c, *_ in cmiss) + ' (--create-missing imports them)')
        say('credentials: %d %s, %d skipped (empty in n8n/.env)' % (len(done), 'written' if APPLY else 'to write', len(skipped)))

    # 6. Data Table columns
    if APPLY:
        r = subprocess.run([sys.executable, os.path.join(ENGINE, 'sync_tables.py')], capture_output=True, text=True,
                           env=dict(os.environ, N8N_PUBLIC_URL=URL, N8N_API_KEY=KEY))
        say((r.stdout or r.stderr).strip()[-600:])
    else:
        r = subprocess.run([sys.executable, os.path.join(ENGINE, 'sync_tables.py'), '--dry-run'], capture_output=True, text=True,
                           env=dict(os.environ, N8N_PUBLIC_URL=URL, N8N_API_KEY=KEY))
        say((r.stdout or r.stderr).strip()[-600:])
    if failed:
        say('FAILED:\n  ' + '\n  '.join(failed)); sys.exit(1)
    say('done.' if APPLY else 'dry run done. Run again with --apply.')


if __name__ == '__main__':
    main()
