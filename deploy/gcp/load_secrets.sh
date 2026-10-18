#!/usr/bin/env bash
# load_secrets.sh — puts the production settings into Secret Manager as three secrets (one per file, so they stay inside the free
# six active versions): <NAME>-n8n-env (your n8n/.env), <NAME>-app-env (your app/.env) and <NAME>-prod-env (what only production has:
# the domain, database passwords, the n8n encryption key, the Vercel origin secret ...). The VM's startup script writes them to
# /mnt/data/secrets on every boot.
#
#   deploy/gcp/load_secrets.sh                         dry run: shows which KEYS would be stored / generated / changed (never a value)
#   deploy/gcp/load_secrets.sh --apply                 stores them (a new version only for a file that changed; older versions destroyed)
#   options: --domain example.com   switch the domain (default: keep the stored one, else 34-18-208-219.sslip.io)
#            --reuse-local-n8n-key  take N8N_ENCRYPTION_KEY from the local n8n container (n8n-n8n-1), so the migrated credentials
#                                   and the n8n API key keep working (migrate_data.md); only when the stored prod-env has none yet
#            --app-frontend caddy|vercel   who answers app.<domain> (default: keep, else caddy)
#            --set KEY=VALUE        set / override one prod-env key (repeatable), e.g. --set APP_IMAGE_TAG=2026-10-18
#
# Passwords and tokens that already exist in the stored prod-env are KEPT: regenerating a database password after the first boot
# would lock the app and n8n out of their own databases. Nothing here prints a value; the files it writes live in a private temp
# directory that is deleted on exit.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
export ROOT
# the settings files live in the main checkout (a git worktree has none: .env is git-ignored); override with N8N_ENV_FILE / APP_ENV_FILE
MAIN=$(dirname "$(git -C "$ROOT" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || echo "$ROOT/.git")")
export N8N_ENV_FILE=${N8N_ENV_FILE:-$MAIN/n8n/.env}
export APP_ENV_FILE=${APP_ENV_FILE:-$MAIN/app/.env}
export PROJECT=${PROJECT:-alaventra-prod}
export REGION=${REGION:-me-central1}
export NAME=${NAME:-alaventra}
# default: gcloud in Docker with your login (gcloud-docker.sh); GCLOUD=gcloud to use a local Cloud SDK
export GCLOUD=${GCLOUD:-$ROOT/deploy/gcp/gcloud-docker.sh gcloud}
export N8N_CONTAINER=${N8N_CONTAINER:-n8n-n8n-1}
WORK=$(mktemp -d "${TMPDIR:-/tmp}/alaventra-secrets.XXXXXX")
chmod 700 "$WORK"
trap 'rm -rf "$WORK"' EXIT
export WORK
python3 - "$@" <<'PY'
import hashlib, json, os, secrets, shlex, subprocess, sys

ROOT, WORK, PROJECT, REGION, NAME = (os.environ[k] for k in ('ROOT', 'WORK', 'PROJECT', 'REGION', 'NAME'))
G = shlex.split(os.environ['GCLOUD'])
args = sys.argv[1:]
apply = '--apply' in args
def opt(flag):
    return args[args.index(flag) + 1] if flag in args and args.index(flag) + 1 < len(args) else None
sets = [args[i + 1] for i, a in enumerate(args) if a == '--set' and i + 1 < len(args)]

def gcloud(*a, input=None):
    return subprocess.run(G + list(a) + ['--project=' + PROJECT], capture_output=True, text=True, input=input)

def parse(text):
    out = {}
    for line in text.splitlines():
        s = line.strip()
        if not s or s.startswith('#') or '=' not in s: continue
        k, v = s.split('=', 1)
        out[k.strip()] = v
    return out

def read_file(p):
    if not os.path.exists(p): sys.exit('missing ' + p + ' (it is the source of the ' + os.path.basename(p) + ' secret)')
    return open(p, encoding='utf-8').read()

# ---- n8n.env: your n8n/.env without the dev-only n8n sandbox service and the runner settings production sets itself ----
DROP = ('SANDBOX_', 'N8N_SANDBOX', 'N8N_INSTANCE_AI', 'INSTANCE_AI', 'N8N_RUNNERS_')
n8n_src = read_file(os.environ['N8N_ENV_FILE'])
n8n_lines = [l for l in n8n_src.splitlines() if not any(l.strip().startswith(p) for p in DROP)]
n8n_lines = [l for l in n8n_lines if not l.strip().startswith('SEO_LINKGRAPH=')] + ['SEO_LINKGRAPH=off']
n8n_env = '\n'.join(n8n_lines).rstrip('\n') + '\n'
n8n_vars = parse(n8n_env)
app_env = read_file(os.environ['APP_ENV_FILE'])

# ---- prod.env: kept from the stored version, generated when missing ----
cur = gcloud('secrets', 'versions', 'access', 'latest', '--secret=' + NAME + '-prod-env')
stored = parse(cur.stdout) if cur.returncode == 0 else {}
prod, notes = dict(stored), []
def gen(k, n=24):
    if not prod.get(k):
        prod[k] = secrets.token_hex(n); notes.append(k + ': generated')
for k in ('POSTGRES_SUPERUSER_PASSWORD', 'N8N_DB_PASSWORD', 'APP_DB_PASSWORD', 'N8N_RUNNERS_AUTH_TOKEN', 'SEARXNG_SECRET'): gen(k)
gen('ORIGIN_SECRET', 32)
if not prod.get('N8N_ENCRYPTION_KEY'):
    if '--reuse-local-n8n-key' in args:
        r = subprocess.run(['docker', 'exec', os.environ['N8N_CONTAINER'], 'cat', '/home/node/.n8n/config'], capture_output=True, text=True)
        key = (json.loads(r.stdout or '{}').get('encryptionKey') if r.returncode == 0 else '') or ''
        if not key: sys.exit('could not read the local n8n encryption key from ' + os.environ['N8N_CONTAINER'])
        prod['N8N_ENCRYPTION_KEY'] = key; notes.append('N8N_ENCRYPTION_KEY: taken from the local n8n (credentials and API keys carry over)')
    else:
        gen('N8N_ENCRYPTION_KEY'); notes[-1] += ' (NEW instance key: migrated credentials and the n8n API key will not decrypt - see migrate_data.md)'
dom = opt('--domain')
if dom: prod['DOMAIN'] = dom.strip().lower().rstrip('.')
prod.setdefault('DOMAIN', '34-18-208-219.sslip.io')
fe = opt('--app-frontend')
if fe:
    if fe not in ('caddy', 'vercel'): sys.exit('--app-frontend must be caddy or vercel')
    prod['APP_FRONTEND'] = fe
prod.setdefault('APP_FRONTEND', 'caddy')
prod.setdefault('ACME_EMAIL', os.environ.get('ACME_EMAIL', 'muqadim2000@gmail.com'))
prod.setdefault('BACKUP_BUCKET', PROJECT + '-backups')
prod['N8N_VERSION'] = n8n_vars.get('N8N_VERSION') or prod.get('N8N_VERSION') or '2.41.4'
prod['GENERIC_TIMEZONE'] = n8n_vars.get('GENERIC_TIMEZONE') or prod.get('GENERIC_TIMEZONE') or 'America/New_York'
for kv in sets:
    k, _, v = kv.partition('=')
    if not k or not v: sys.exit('--set needs KEY=VALUE')
    prod[k.strip()] = v.strip(); notes.append(k.strip() + ': set from the command line')
ORDER = ['DOMAIN', 'APP_FRONTEND', 'ACME_EMAIL', 'BACKUP_BUCKET', 'N8N_VERSION', 'GENERIC_TIMEZONE']
prod_env = '# Alaventra production settings (deploy/gcp/load_secrets.sh). Never commit.\n' + ''.join(
    k + '=' + prod[k] + '\n' for k in ORDER + sorted(k for k in prod if k not in ORDER))

for k in ('SEO_API_KEY', 'N8N_API_KEY', 'SEO_ANTHROPIC_API_KEY', 'SEO_DATAFORSEO_LOGIN'):
    if not n8n_vars.get(k): print('  ! n8n/.env has no ' + k + ' - the engine or the app will miss it')
if not parse(app_env).get('MAILBOX_KEY'): print('  ! app/.env has no MAILBOX_KEY - mailboxes, CMS and two-step secrets cannot be stored (RESUME §9)')

def sha(t): return hashlib.sha256(t.encode()).hexdigest()
changed = 0
for sid, text in ((NAME + '-prod-env', prod_env), (NAME + '-n8n-env', n8n_env), (NAME + '-app-env', app_env)):
    keys = sorted(parse(text))
    exists = gcloud('secrets', 'describe', sid).returncode == 0
    old = cur.stdout if sid.endswith('-prod-env') and cur.returncode == 0 else (
        gcloud('secrets', 'versions', 'access', 'latest', '--secret=' + sid).stdout if exists else '')
    same = exists and sha(old) == sha(text)
    print('%s: %d keys (%s) - %s' % (sid, len(keys), ', '.join(keys[:6]) + (', ...' if len(keys) > 6 else ''),
          'unchanged' if same else ('NEW VERSION' if exists else 'NEW SECRET')))
    if same: continue
    changed += 1
    if not apply: continue
    path = os.path.join(WORK, sid)
    with open(path, 'w', encoding='utf-8') as f: f.write(text)
    os.chmod(path, 0o600)
    if not exists:
        r = gcloud('secrets', 'create', sid, '--replication-policy=user-managed', '--locations=' + REGION, '--data-file=' + path,
                   '--labels=app=alaventra')
    else:
        r = gcloud('secrets', 'versions', 'add', sid, '--data-file=' + path)
    if r.returncode != 0: sys.exit('could not store ' + sid + ': ' + r.stderr.strip()[-300:])
    # keep the newest two versions (the one before is the way back); destroy the rest so the free tier holds
    v = gcloud('secrets', 'versions', 'list', sid, '--filter=state!=DESTROYED', '--format=value(name.basename())', '--sort-by=~createTime')
    for old_v in [x for x in v.stdout.split() if x][2:]:
        gcloud('secrets', 'versions', 'destroy', old_v, '--secret=' + sid, '--quiet')
for n in notes: print('  ' + n)
print(('stored: %d secret(s) changed.' % changed) if apply else
      ('dry run: %d secret(s) would change. Run with --apply to store them.' % changed))
if apply and changed:
    print('the VM reads them at boot; to apply now: deploy/gcp/vm.sh restart-stack  (or reboot the VM)')
PY
