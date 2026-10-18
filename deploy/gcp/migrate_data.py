#!/usr/bin/env python3
"""migrate_data.py — moves the local data to the production VM (migrate_data.md has the why and the order).

  python3 deploy/gcp/migrate_data.py                 dry run: checks versions, counts every local Data Table / app table, says what it would do
  python3 deploy/gcp/migrate_data.py --apply         the app database, then the n8n entities, with row counts before and after
  options: --n8n-only | --app-only   one half
           --with-history            also n8n's execution history (excluded by default: it is most of the 1.3 GB and pruned anyway)

n8n (SQLite 2.41.4 locally -> Postgres 2.41.4 on the VM), n8n's supported path for its version (`n8n export:entities` /
`n8n import:entities`, https://docs.n8n.io/deploy/host-n8n/configure-n8n/use-the-command-line):
  1. local: `n8n export:entities` inside the running container (it only reads) -> entities.zip, encrypted with the instance key
  2. the VM: the zip over IAP SSH stdin; n8n + runners stopped; `n8n import:entities --truncateTables` run as the Postgres superuser
     (it switches session_replication_role); every table it created is then handed to the n8n role (postgres/fix_owner.sql) - without
     that n8n can neither write a Data Table row nor add a column; n8n started again
  3. counts: every Data Table locally (SQLite, read-only) and on the VM (Postgres), table by table; the run fails on any difference
  The VM must run with the LOCAL instance key (load_secrets.sh --reuse-local-n8n-key): the credentials and n8n's own signing keys are
  stored encrypted with it, and n8n 2.41.4 refuses to start on them with another key ("Deployment key 'signing.hmac' cannot be read").
App (Postgres 17 -> Postgres 17): `pg_dump -Fc` of the local dev database (seo-platform-dev-db-1, db seo), restored into a fresh `app`
  database owned by the app role (--no-owner --role=app) with the app stopped; exact row counts per table before and after.

Nothing printed is a secret: counts, table names and n8n's one-line results only.
Test knobs (used for the scratch rehearsal, see migrate_data.md §5): SOURCE_DIR=<copy of ~/.n8n> reads a COPY instead of exec-ing into
the running container; MIGRATE_TARGET_LOCAL=1 + MIGRATE_REMOTE_PREFIX + MIGRATE_DIR run the "VM" side against a local compose project.
"""
import json, os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
args = sys.argv[1:]
APPLY = '--apply' in args
DO_N8N = '--app-only' not in args
DO_APP = '--n8n-only' not in args
PROJECT = os.environ.get('PROJECT', 'alaventra-prod')
ZONE = os.environ.get('ZONE', 'me-central1-a')
VM = os.environ.get('VM', 'alaventra-vm-1')
LOCAL_N8N = os.environ.get('N8N_CONTAINER', 'n8n-n8n-1')
SOURCE_DIR = os.environ.get('SOURCE_DIR', '')
N8N_IMAGE = 'docker.io/n8nio/n8n:' + os.environ.get('N8N_VERSION', '2.41.4')
LOCAL_APP_DB = os.environ.get('APP_DB_CONTAINER', 'seo-platform-dev-db-1')
GCLOUD = (os.environ.get('GCLOUD') or (os.path.join(HERE, 'gcloud-docker.sh') + ' gcloud')).split()
TARGET_LOCAL = os.environ.get('MIGRATE_TARGET_LOCAL') == '1'
MDIR = os.environ.get('MIGRATE_DIR', '/mnt/data/migrate')
REMOTE_PREFIX = os.environ.get('MIGRATE_REMOTE_PREFIX') or (
    'cd /mnt/data/repo/deploy/gcp && export DATA_DIR=/mnt/data SECRETS_DIR=/mnt/data/secrets && '
    'C="docker compose -p alaventra --env-file /mnt/data/secrets/prod.env -f compose.prod.yml" && '
    'SU=$(grep -E "^POSTGRES_SUPERUSER_PASSWORD=" /mnt/data/secrets/prod.env | cut -d= -f2-) && ')
SQLITE = '/usr/local/lib/node_modules/n8n/node_modules/sqlite3'


def sh(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def local_n8n(*cmd, entry='n8n'):
    """a command against the local n8n data: exec in the running container, or (SOURCE_DIR) a throwaway container on a copy"""
    if SOURCE_DIR:
        return sh(['docker', 'run', '--rm', '--network', 'none', '-v', SOURCE_DIR + ':/home/node/.n8n', '--entrypoint', entry, N8N_IMAGE] + list(cmd))
    return sh(['docker', 'exec', LOCAL_N8N, entry] + list(cmd))


def remote(script, stdin_path=None, stdin_text=None):
    """bash on the VM as root through IAP SSH (or locally for the rehearsal); stdin from a file or a text"""
    script = REMOTE_PREFIX + script
    if TARGET_LOCAL:
        base = ['bash', '-c', script]
    else:
        base = GCLOUD + ['compute', 'ssh', VM, '--zone=' + ZONE, '--project=' + PROJECT, '--tunnel-through-iap', '--quiet',
                         '--command', "sudo bash -c '" + script.replace("'", "'\"'\"'") + "'"]
    if stdin_path:
        with open(stdin_path, 'rb') as f: r = subprocess.run(base, stdin=f, capture_output=True)
        return r.returncode, r.stdout.decode('utf-8', 'replace') + r.stderr.decode('utf-8', 'replace')
    r = subprocess.run(base, input=stdin_text or '', capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr


LOCAL_COUNTS_JS = r"""
const sqlite3 = require('%s');
const db = new sqlite3.Database('/home/node/.n8n/database.sqlite', sqlite3.OPEN_READONLY);
db.all('select id, name from data_table', async (e, rows) => {
  if (e) { console.log('ERR ' + e.message); return; }
  const out = {};
  for (const r of rows) out[r.name] = await new Promise((ok) => db.get('select count(*) n from "data_table_user_' + r.id + '"', (e2, x) => ok(e2 ? -1 : x.n)));
  console.log('COUNTS ' + JSON.stringify(out));
  db.close();
});""" % SQLITE
REMOTE_DT_COUNTS_SQL = r"""DO $$ DECLARE r record; n bigint; o jsonb := '{}'::jsonb; BEGIN
FOR r IN SELECT id, name FROM data_table LOOP EXECUTE format('SELECT count(*) FROM %I', 'data_table_user_' || r.id) INTO n;
o := o || jsonb_build_object(r.name, n); END LOOP; RAISE NOTICE 'COUNTS %', o::text; END $$;"""
APP_COUNTS_SQL = r"""DO $$ DECLARE r record; n bigint; o jsonb := '{}'::jsonb; BEGIN
FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP EXECUTE format('SELECT count(*) FROM public.%I', r.tablename) INTO n;
o := o || jsonb_build_object(r.tablename, n); END LOOP; RAISE NOTICE 'COUNTS %', o::text; END $$;"""
FIX_OWNER_SQL = open(os.path.join(HERE, 'postgres', 'fix_owner.sql'), encoding='utf-8').read()


def counts_of(text):
    m = re.search(r'COUNTS (\{.*\})', text or '')
    return json.loads(m.group(1)) if m else None


def compare(a, b, what):
    if b is None:
        print('  ! %s: no counts from the VM' % what); return False
    diff = {k: (a.get(k), b.get(k)) for k in sorted(set(a) | set(b)) if a.get(k) != b.get(k)}
    print('  %s: %d tables / %d rows locally, %d tables / %d rows on the VM: %s' % (
        what, len(a), sum(a.values()), len(b), sum(b.values()), 'IDENTICAL' if not diff else 'DIFFERENT ' + json.dumps(diff)))
    return not diff


def migrate_n8n():
    print('== n8n')
    ver = (local_n8n('--version').stdout.strip().splitlines() or ['?'])[-1]
    dbt = (local_n8n('DB_TYPE', entry='printenv').stdout.strip() or 'sqlite') if not SOURCE_DIR else 'sqlite (copy)'
    print('  local n8n %s, database %s' % (ver, dbt))
    before = counts_of(local_n8n('-e', LOCAL_COUNTS_JS, entry='node').stdout)
    if before is None: sys.exit('could not count the local Data Tables')
    print('  local Data Tables: %d tables, %d rows' % (len(before), sum(before.values())))
    hist = ['--includeExecutionHistoryDataTables=true'] if '--with-history' in args else []
    if not APPLY:
        print('  would: export:entities %s-> zip -> VM -> import:entities --truncateTables (as superuser) -> fix_owner.sql -> count' % (' '.join(hist) + ' ' if hist else ''))
        return True
    tmpd = tempfile.mkdtemp(prefix='alaventra-migrate-', dir=os.environ.get('TMPDIR'))
    zpath = os.path.join(tmpd, 'entities.zip')
    try:
        if SOURCE_DIR:
            r = local_n8n('export:entities', '--outputDir=/home/node/.n8n/alaventra-export', *hist)
            os.replace(os.path.join(SOURCE_DIR, 'alaventra-export', 'entities.zip'), zpath)
            os.rmdir(os.path.join(SOURCE_DIR, 'alaventra-export'))
        else:
            r = sh(['docker', 'exec', LOCAL_N8N, 'sh', '-c', 'rm -rf /tmp/alaventra-export && n8n export:entities --outputDir=/tmp/alaventra-export ' + ' '.join(hist)])
            if sh(['docker', 'cp', LOCAL_N8N + ':/tmp/alaventra-export/entities.zip', zpath]).returncode != 0: sys.exit('could not copy entities.zip out')
            sh(['docker', 'exec', '-u', 'root', LOCAL_N8N, 'rm', '-rf', '/tmp/alaventra-export'])
        print('  export: %s; entities.zip %.1f MB' % ([l.strip() for l in r.stdout.splitlines() if 'Total entities' in l][-1:] or ['done'], os.path.getsize(zpath) / 1e6))
        # the import runs as n8n's user (uid 1000) and unpacks next to the zip; chown is a no-op where it is not allowed (rehearsal on a Mac)
        rc, out = remote('mkdir -p %s && cat > %s/entities.zip && chmod 600 %s/entities.zip && { chown -R 1000:1000 %s 2>/dev/null || true; }'
                         % (MDIR, MDIR, MDIR, MDIR), stdin_path=zpath)
        if rc != 0: sys.exit('upload failed: ' + out[-300:])
    finally:
        for f in os.listdir(tmpd): os.unlink(os.path.join(tmpd, f))
        os.rmdir(tmpd)
    rc, out = remote(
        '$C stop n8n runners </dev/null >/dev/null 2>&1; '
        '$C run -T --rm --no-deps -e DB_POSTGRESDB_USER=postgres -e DB_POSTGRESDB_PASSWORD="$SU" -v ' + MDIR + ':/import n8n '
        'import:entities --inputDir=/import --truncateTables=true </dev/null 2>&1 | grep -E "validation|Error|rror:|Total|completed|success" | tail -5; '
        '$C exec -T postgres psql -U postgres -d n8n -q -v ON_ERROR_STOP=1 2>&1 | tail -3; '
        'rm -f ' + MDIR + '/entities.zip; $C up -d n8n runners </dev/null 2>&1 | tail -1', stdin_text=FIX_OWNER_SQL)
    print('  VM: ' + ' | '.join(l.strip() for l in out.splitlines() if l.strip())[-700:])
    rc, out = remote('$C exec -T postgres psql -U postgres -d n8n -q 2>&1', stdin_text=REMOTE_DT_COUNTS_SQL)
    return compare(before, counts_of(out), 'Data Tables')


def migrate_app():
    print('== app database')
    r = subprocess.run(['docker', 'exec', '-i', LOCAL_APP_DB, 'psql', '-U', 'seo', '-d', 'seo', '-q'], input=APP_COUNTS_SQL, capture_output=True, text=True)
    before = counts_of(r.stdout + r.stderr)
    if before is None: sys.exit('could not count the local app database (' + LOCAL_APP_DB + ')')
    print('  local app database: %d tables, %d rows' % (len(before), sum(before.values())))
    if not APPLY:
        print('  would: pg_dump -Fc -> VM -> stop app -> recreate database app -> pg_restore --no-owner --role=app -> start app -> count')
        return True
    tmpd = tempfile.mkdtemp(prefix='alaventra-migrate-', dir=os.environ.get('TMPDIR'))
    dump = os.path.join(tmpd, 'app.dump')
    try:
        fd = os.open(dump, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, 'wb') as f:
            r = subprocess.run(['docker', 'exec', LOCAL_APP_DB, 'pg_dump', '-U', 'seo', '-d', 'seo', '-Fc', '--no-owner', '--no-acl'], stdout=f, stderr=subprocess.PIPE)
        if r.returncode != 0: sys.exit('pg_dump failed: ' + r.stderr.decode()[-300:])
        print('  app.dump: %.1f MB' % (os.path.getsize(dump) / 1e6))
        rc, out = remote(
            '$C stop app </dev/null >/dev/null 2>&1; '
            '$C exec -T postgres psql -U postgres -d postgres -q -c "DROP DATABASE IF EXISTS app WITH (FORCE)" -c "CREATE DATABASE app OWNER app" </dev/null && '
            '$C exec -T postgres pg_restore -U postgres -d app --no-owner --no-acl --role=app --exit-on-error && '
            '$C up -d app </dev/null 2>&1 | tail -1', stdin_path=dump)
        print('  VM: ' + ' | '.join(l.strip() for l in out.splitlines() if l.strip())[-500:])
        if rc != 0: return False
    finally:
        for f in os.listdir(tmpd): os.unlink(os.path.join(tmpd, f))
        os.rmdir(tmpd)
    rc, out = remote('$C exec -T postgres psql -U postgres -d app -q 2>&1', stdin_text=APP_COUNTS_SQL)
    return compare(before, counts_of(out), 'app tables')


def main():
    print('migrate_data: local -> %s (%s)' % ('local rehearsal target' if TARGET_LOCAL else VM, 'APPLY' if APPLY else 'dry run'))
    ok = True
    if DO_APP: ok = migrate_app() and ok
    if DO_N8N: ok = migrate_n8n() and ok
    if APPLY and ok:
        print('next: python3 deploy/gcp/deploy_engine.py --apply (the current build), then STOP the local engine '
              '(cd n8n && docker compose stop n8n) - otherwise every scheduled run happens twice')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
