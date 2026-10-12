#!/usr/bin/env python3
"""fix_ladder_hosts.py — one-off: puts every stored `seo_ladders.target_url` on its site's canonical host (P2-3 / D15, 2026-10-12).

Rows written before the one site model (SITE_MODEL_SPEC.md) glued their target URL together as 'https://' + domain. On a www site the
bare host 308-redirects, so the Site Tracker quoted "publish at https://techand.ai/e-invoicing-uae-fta/" while the page, its schema and
every link of the same run were on www (Phase 2 live check §3, P2-3: 17 of techand.ai's 18 rows). The code that writes new rows is fixed;
this script repairs the rows that already exist.

The canonical host per domain comes from `seo_sites.canonical_host` (written by the weekly site-model resolver). A domain without a
model row, a URL on another domain and a URL already on the canonical host are left untouched; nothing but `target_url` is written.

    python3 fix_ladder_hosts.py                 # dry run (default): prints every row it would change
    python3 fix_ladder_hosts.py --apply         # writes them (one PATCH per row, by row id)
    python3 fix_ladder_hosts.py --domain techand.ai [--apply]

Reads and writes through the n8n public API (key N8N_API_KEY from n8n/.env or app/.env), like sync_tables.py.
"""
import json, os, re, sys, urllib.parse, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from env_settings import load_env
from ladder_common import LADDER_TABLE, SITES_TABLE

BASE = os.environ.get('N8N_PUBLIC_URL', 'http://localhost:5678').rstrip('/') + '/api/v1'


def api_key():
    k = load_env().get('N8N_API_KEY')
    if k:
        return k
    p = os.path.join(HERE, '..', '..', 'app', '.env')
    if os.path.exists(p):
        for line in open(p, encoding='utf-8'):
            if line.startswith('N8N_API_KEY='):
                return line.split('=', 1)[1].strip().strip('"').strip("'")
    return ''


def call(key, path, method='GET', body=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'X-N8N-API-KEY': key, 'Content-Type': 'application/json', 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read() or b'null')


def table_id(key, name):
    cursor, out = None, None
    while out is None:
        page = call(key, '/data-tables?limit=100' + ('&cursor=' + urllib.parse.quote(cursor) if cursor else ''))
        for t in page.get('data', []):
            if t.get('name') == name:
                return t['id']
        cursor = page.get('nextCursor')
        if not cursor:
            return ''
    return ''


def rows(key, tid, limit=2000):
    out, cursor = [], None
    while len(out) < limit:
        page = call(key, '/data-tables/%s/rows?limit=250%s' % (tid, '&cursor=' + urllib.parse.quote(cursor) if cursor else ''))
        out.extend(page.get('data', []))
        cursor = page.get('nextCursor')
        if not cursor:
            break
    return out


norm_host = lambda v: re.sub(r':\d+$', '', re.sub(r'[/?#].*$', '', re.sub(r'^https?://', '', str(v or '').strip().lower())))
bare = lambda v: re.sub(r'^www\.', '', norm_host(v))
host_of = lambda u: norm_host((re.match(r'^https?://([^/?#]+)', str(u or '').strip(), re.I) or [None, ''])[1])
path_of = lambda u: (re.sub(r'^https?://[^/]*', '', str(u or '').strip(), flags=re.I) or '/')


def plan(ladders, sites, only_domain=''):
    """Returns (changes, skipped): changes are (row, new_url, why)."""
    canon = {}
    for s in sites:
        d, h = bare(s.get('domain')), norm_host(s.get('canonical_host'))
        if d and h and bare(h) == d:
            canon[d] = h
    changes, skipped = [], []
    for r in ladders:
        url, dom = str(r.get('target_url') or '').strip(), bare(r.get('domain'))
        if only_domain and dom != bare(only_domain):
            continue
        if not url or not url.lower().startswith(('http://', 'https://')):
            skipped.append((r, 'no target_url')); continue
        host = host_of(url)
        if not dom or bare(host) != dom:
            skipped.append((r, 'URL is not on the site\'s own domain (%s)' % (host or '-'))); continue
        want = canon.get(dom)
        if not want:
            skipped.append((r, 'no canonical_host stored for %s (run the Site Tracker once)' % dom)); continue
        if host == want and url.startswith('https://'):
            continue
        changes.append((r, 'https://' + want + path_of(url), '%s -> %s' % (host, want)))
    return changes, skipped


def main():
    apply = '--apply' in sys.argv
    only = ''
    if '--domain' in sys.argv:
        i = sys.argv.index('--domain')
        only = sys.argv[i + 1] if i + 1 < len(sys.argv) else ''
    key = api_key()
    if not key:
        print('fix_ladder_hosts: no N8N_API_KEY in n8n/.env or app/.env'); return 2
    lid, sid = table_id(key, LADDER_TABLE), table_id(key, SITES_TABLE)
    if not lid:
        print('fix_ladder_hosts: the table %s does not exist yet — nothing to do' % LADDER_TABLE); return 0
    ladders, sites = rows(key, lid), (rows(key, sid) if sid else [])
    changes, skipped = plan(ladders, sites, only)
    print('fix_ladder_hosts: %d ladder row(s), %d site row(s) with a canonical host; %d to rewrite, %d left alone'
          % (len(ladders), sum(1 for s in sites if s.get('canonical_host')), len(changes), len(skipped)))
    for r, new, why in changes:
        print('  %s %s rung %s "%s"\n    %s\n    -> %s   (%s)' % ('WOULD FIX' if not apply else 'FIX      ', r.get('ladder_id'), r.get('rung'), r.get('keyword'), r.get('target_url'), new, why))
    for r, why in skipped[:20]:
        print('  skip      %s "%s": %s' % (r.get('ladder_id'), r.get('keyword'), why))
    if not apply:
        print('\ndry run (default): nothing was written. Re-run with --apply to write these %d row(s).' % len(changes))
        return 0
    failed = 0
    for r, new, _why in changes:
        body = {'filter': {'type': 'and', 'filters': [{'columnName': 'id', 'condition': 'eq', 'value': r['id']}]}, 'data': {'target_url': new}}
        try:
            call(key, '/data-tables/%s/rows/update' % lid, 'PATCH', body)
        except Exception as e:
            failed += 1; print('  FAILED row %s: %s' % (r.get('id'), str(e)[:120]))
    print('fix_ladder_hosts: wrote %d row(s)%s' % (len(changes) - failed, (', %d failed' % failed) if failed else ''))
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
