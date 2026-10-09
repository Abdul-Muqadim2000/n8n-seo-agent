#!/usr/bin/env python3
"""sync_tables.py — adds the columns a newer build expects to the Data Tables that already exist in n8n (v4.9).
The workflows' "Ensure … Table" nodes create a missing table with every column, but they leave an existing table as it is, so a column
added to ladder_common.py would never reach a live table. This script compares every <NAME>_TABLE / <NAME>_COLS pair in ladder_common.py with
the live columns (n8n public API, key N8N_API_KEY from n8n/.env or app/.env) and adds the missing ones. Rows keep their data; new columns are empty.
Run by apply_env.py; on its own: python3 sync_tables.py [--dry-run]"""
import json, os, sys, urllib.request, urllib.error
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import ladder_common as LC
from env_settings import load_env
BASE = os.environ.get('N8N_PUBLIC_URL', 'http://localhost:5678').rstrip('/') + '/api/v1'

def api_key():
    k = load_env().get('N8N_API_KEY')
    if k: return k
    p = os.path.join(HERE, '..', '..', 'app', '.env')
    if os.path.exists(p):
        for line in open(p, encoding='utf-8'):
            if line.startswith('N8N_API_KEY='): return line.split('=', 1)[1].strip().strip('"').strip("'")
    return ''

def call(key, path, method='GET', body=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None, headers={'X-N8N-API-KEY': key, 'Content-Type': 'application/json', 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r: return json.loads(r.read() or b'null')

def expected():
    out = {}
    for name in dir(LC):
        if name.endswith('_TABLE') and isinstance(getattr(LC, name), str):
            cols = getattr(LC, name[:-6] + '_COLS', None)
            if cols: out[getattr(LC, name)] = cols
    return out

def main():
    dry = '--dry-run' in sys.argv
    key = api_key()
    if not key: print('sync_tables: no N8N_API_KEY in n8n/.env or app/.env; skipped (new columns reach only tables created from now on)'); return 0
    try: tables = call(key, '/data-tables?limit=250').get('data', [])
    except Exception as e: print('sync_tables: n8n API not reachable (' + str(e)[:120] + '); skipped'); return 0
    want, added, failed = expected(), [], []
    for t in tables:
        cols = want.get(t.get('name'))
        if not cols: continue
        have = {c.get('name') for c in (t.get('columns') or [])}
        if not have:
            try: have = {c.get('name') for c in (call(key, '/data-tables/%s/columns' % t['id']) or [])}
            except Exception: pass
        for name, typ in cols:
            if name in have: continue
            if dry: added.append(t['name'] + '.' + name + ' (dry run)'); continue
            try: call(key, '/data-tables/%s/columns' % t['id'], 'POST', {'name': name, 'type': typ}); added.append(t['name'] + '.' + name)
            except urllib.error.HTTPError as e:
                if e.code == 409: continue   # created meanwhile
                failed.append(t['name'] + '.' + name + ' (' + str(e.code) + ')')
            except Exception as e: failed.append(t['name'] + '.' + name + ' (' + str(e)[:60] + ')')
    print('sync_tables:', ('added ' + ', '.join(added)) if added else 'every live table has its columns', ('| FAILED: ' + ', '.join(failed)) if failed else '')
    return 1 if failed else 0

if __name__ == '__main__': sys.exit(main())
