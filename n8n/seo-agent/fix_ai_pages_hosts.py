#!/usr/bin/env python3
"""fix_ai_pages_hosts.py — one-off: one `seo_ai_pages` row per page, on the site's canonical host (R92 part 6, 2026-10-16).

`seo_ai_pages` is upserted on (site_id, url) with the URL as it was read, so the rows AI Growth wrote on 2026-10-10 / 11 under the bare
host (`https://techand.ai/...`) stayed beside the rows written since 2026-10-12 under `https://www.techand.ai/...` — the same pages twice
(re-rating 2026-10-15, defects/C_monitors.md R92 part 6). The workflow now puts the URL on the canonical host before the upsert
(build_monitors.py, *AI Page Rows*); this script repairs the rows that already exist:

  * a row on another host of the site's own domain whose page ALSO has a row on the canonical host -> deleted (the canonical row is
    the one every run since has updated);
  * such a row with no canonical twin -> its `url` is rewritten onto the canonical host (one PATCH by row id);
  * a row on the canonical host, on another domain, or for a site with no stored canonical host -> left alone.

    python3 fix_ai_pages_hosts.py                    # dry run (default): prints what it would delete / rewrite, writes nothing
    python3 fix_ai_pages_hosts.py --apply            # does it
    python3 fix_ai_pages_hosts.py --domain techand.ai [--apply]

The canonical host per domain comes from `seo_sites.canonical_host` (the weekly site-model resolver). Reads and writes through the n8n
public API (key N8N_API_KEY from n8n/.env or app/.env), like fix_ladder_hosts.py. Prints no secret.
"""
import json, os, re, sys, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from fix_ladder_hosts import api_key, call, table_id, rows, norm_host, bare, host_of, path_of
from ladder_common import AI_PAGES_TABLE, SITES_TABLE


def page_key(u):
    """The page a URL names, host-agnostic: no scheme, no www., no fragment, no trailing slash."""
    return re.sub(r'/+$', '', re.sub(r'#.*$', '', re.sub(r'^www\.', '', re.sub(r'^https?://', '', str(u or '').strip().lower()))))


def plan(page_rows, sites, only_domain=''):
    """-> (deletes, rewrites, skipped): deletes are (row, twin, why); rewrites are (row, new_url, why)."""
    canon = {}
    for s in sites:
        d, h = bare(s.get('domain')), norm_host(s.get('canonical_host'))
        if d and h and bare(h) == d:
            canon[d] = h
    by_site_key = {}
    for r in page_rows:
        by_site_key.setdefault((r.get('site_id'), page_key(r.get('url'))), []).append(r)
    deletes, rewrites, skipped = [], [], []
    for r in page_rows:
        url, dom = str(r.get('url') or '').strip(), bare(r.get('domain'))
        if only_domain and dom != bare(only_domain):
            continue
        host = host_of(url)
        if not url or not host:
            skipped.append((r, 'no URL')); continue
        if not dom or bare(host) != dom:
            skipped.append((r, 'URL is not on the site\'s own domain (%s)' % host)); continue
        want = canon.get(dom)
        if not want:
            skipped.append((r, 'no canonical_host stored for %s (run the Site Tracker once)' % dom)); continue
        if host == want:
            continue
        twins = [t for t in by_site_key.get((r.get('site_id'), page_key(url)), []) if t is not r and host_of(t.get('url')) == want]
        if twins:
            twin = sorted(twins, key=lambda t: str(t.get('checked_at') or t.get('submitted_at') or ''))[-1]
            deletes.append((r, twin, '%s duplicates %s (checked %s vs %s)' % (host, want, str(r.get('checked_at') or '-')[:10], str(twin.get('checked_at') or '-')[:10])))
        else:
            rewrites.append((r, 'https://' + want + path_of(url), '%s -> %s' % (host, want)))
    return deletes, rewrites, skipped


def main():
    apply = '--apply' in sys.argv
    only = ''
    if '--domain' in sys.argv:
        i = sys.argv.index('--domain')
        only = sys.argv[i + 1] if i + 1 < len(sys.argv) else ''
    key = api_key()
    if not key:
        print('fix_ai_pages_hosts: no N8N_API_KEY in n8n/.env or app/.env'); return 2
    pid, sid = table_id(key, AI_PAGES_TABLE), table_id(key, SITES_TABLE)
    if not pid:
        print('fix_ai_pages_hosts: the table %s does not exist yet — nothing to do' % AI_PAGES_TABLE); return 0
    page_rows, sites = rows(key, pid, limit=5000), (rows(key, sid) if sid else [])
    deletes, rewrites, skipped = plan(page_rows, sites, only)
    print('fix_ai_pages_hosts: %d page row(s); %d duplicate(s) on another host to delete, %d to move onto the canonical host, %d left alone'
          % (len(page_rows), len(deletes), len(rewrites), len(skipped)))
    for r, twin, why in deletes:
        print('  %s row %s %s\n    keeps row %s %s   (%s)' % ('WOULD DELETE' if not apply else 'DELETE      ', r.get('id'), r.get('url'), twin.get('id'), twin.get('url'), why))
    for r, new, why in rewrites:
        print('  %s row %s %s\n    -> %s   (%s)' % ('WOULD MOVE  ' if not apply else 'MOVE        ', r.get('id'), r.get('url'), new, why))
    for r, why in skipped[:20]:
        print('  skip         row %s %s: %s' % (r.get('id'), r.get('url'), why))
    if not apply:
        print('\ndry run (default): nothing was written. Re-run with --apply to delete %d and move %d row(s).' % (len(deletes), len(rewrites)))
        return 0
    failed = 0
    for r, _twin, _why in deletes:
        flt = json.dumps({'type': 'and', 'filters': [{'columnName': 'id', 'condition': 'eq', 'value': r['id']}]}, separators=(',', ':'))
        try:
            call(key, '/data-tables/%s/rows/delete?filter=%s' % (pid, urllib.parse.quote(flt)), 'DELETE')
        except Exception as e:
            failed += 1; print('  FAILED delete row %s: %s' % (r.get('id'), str(e)[:120]))
    for r, new, _why in rewrites:
        body = {'filter': {'type': 'and', 'filters': [{'columnName': 'id', 'condition': 'eq', 'value': r['id']}]}, 'data': {'url': new}}
        try:
            call(key, '/data-tables/%s/rows/update' % pid, 'PATCH', body)
        except Exception as e:
            failed += 1; print('  FAILED move row %s: %s' % (r.get('id'), str(e)[:120]))
    print('fix_ai_pages_hosts: done, %d failed' % failed)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
