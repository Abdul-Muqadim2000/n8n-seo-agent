#!/usr/bin/env python3
"""ai_rank_reset.py - roll one website back from the AI-ranking algorithm (AIR, docs/ai-ranking-2026-11-05/DESIGN.md §4.5, package P4).

The setting itself is changed through Site Admin `monitors` (`ai_rank_mode`: off / shadow / on; AIRF.validate refuses anything else) or,
for every site at once and without a deploy, with the kill switch row `seo_cache` key `air:kill`, value `1`. This script clears what an
`on` period leaves behind that would otherwise wait to expire:

  * `seo_ai_prompts.core_until` stamps of the site (AIR's one column; empty = today's focus rules) -> emptied;
  * the protect row `seo_cache` key `air:protect:<site_id>` (the cadence's "do not rewrite this cited page") -> deleted;
  * with --purge-air: the site's rows in the five seo_ai_rank_* tables -> deleted (its history; the priors are shared and kept).

Rows already handed on stay where they are and are handled as before: `seo_ai_targets` rows with origin ai_rank are reclaimed by AI Growth on
its next run (its writer sets origin null), `seo_link_prospects` rows with origin ai_rank are ordinary ai_source prospects for the Link Builder.

    python3 ai_rank_reset.py --site site_example-com              # dry run (default): what it would change, writes nothing
    python3 ai_rank_reset.py --site site_example-com --apply      # does it
    python3 ai_rank_reset.py --site site_example-com --purge-air [--apply]

Reads and writes through the n8n public API (N8N_API_KEY from n8n/.env or app/.env; N8N_PUBLIC_URL for a remote instance), like
fix_ai_pages_hosts.py. Prints counts and ids only, never a row's content or a secret.
"""
import json, os, sys, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from fix_ladder_hosts import api_key, call, table_id, rows
from ladder_common import (AI_PROMPTS_TABLE, CACHE_TABLE, AI_RANK_RUNS_TABLE, AI_RANK_QUESTIONS_TABLE, AI_RANK_ACTIONS_TABLE, AI_RANK_SOURCES_TABLE)

AIR_SITE_TABLES = [AI_RANK_RUNS_TABLE, AI_RANK_QUESTIONS_TABLE, AI_RANK_ACTIONS_TABLE, AI_RANK_SOURCES_TABLE]


def flt(*conds):
    return json.dumps({'type': 'and', 'filters': [{'columnName': c, 'condition': 'eq', 'value': v} for c, v in conds]}, separators=(',', ':'))


def plan(site, prompts, cache, air):
    """-> (prompt ids whose core_until is set, protect keys present, {table: n rows of the site})."""
    core = [p.get('prompt_id') for p in prompts if p.get('site_id') == site and str(p.get('core_until') or '').strip()]
    protect = [c.get('key') for c in cache if c.get('key') == 'air:protect:' + site]
    return core, protect, {t: len([r for r in rs if r.get('site_id') == site]) for t, rs in air.items()}


def main(argv=None):
    a = list(sys.argv[1:] if argv is None else argv)
    apply, purge = '--apply' in a, '--purge-air' in a
    site = a[a.index('--site') + 1] if '--site' in a and a.index('--site') + 1 < len(a) else ''
    if not site.startswith('site_'):
        print('ai_rank_reset: --site site_<domain> is required (the seo_sites id, e.g. site_example-com)'); return 2
    key = api_key()
    if not key:
        print('ai_rank_reset: no N8N_API_KEY in n8n/.env or app/.env'); return 2
    pid, cid = table_id(key, AI_PROMPTS_TABLE), table_id(key, CACHE_TABLE)
    air_ids = {t: table_id(key, t) for t in AIR_SITE_TABLES}
    prompts = rows(key, pid, limit=10000) if pid else []
    cache = rows(key, cid, limit=10000) if cid else []
    air = {t: (rows(key, i, limit=20000) if i else []) for t, i in air_ids.items()} if purge else {}
    core, protect, counts = plan(site, prompts, cache, air)
    print('ai_rank_reset: %s: %d question(s) with a core_until stamp, %d protect row(s)%s'
          % (site, len(core), len(protect), ('; AIR rows ' + ', '.join('%s %d' % (t, n) for t, n in counts.items())) if purge else ''))
    if not apply:
        print('dry run (default): nothing was written. Re-run with --apply.'); return 0
    failed = 0
    for p in core:
        try: call(key, '/data-tables/%s/rows/update' % pid, 'PATCH', {'filter': json.loads(flt(('site_id', site), ('prompt_id', p))), 'data': {'core_until': None}})
        except Exception as e: failed += 1; print('  FAILED core_until %s: %s' % (p, str(e)[:120]))
    for k in protect:
        try: call(key, '/data-tables/%s/rows/delete?filter=%s' % (cid, urllib.parse.quote(flt(('key', k)))), 'DELETE')
        except Exception as e: failed += 1; print('  FAILED protect row: %s' % str(e)[:120])
    for t, i in (air_ids.items() if purge else []):
        if not i or not counts.get(t): continue
        try: call(key, '/data-tables/%s/rows/delete?filter=%s' % (i, urllib.parse.quote(flt(('site_id', site)))), 'DELETE')
        except Exception as e: failed += 1; print('  FAILED purge %s: %s' % (t, str(e)[:120]))
    print('ai_rank_reset: done, %d failed' % failed)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
