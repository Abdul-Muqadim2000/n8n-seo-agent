#!/usr/bin/env python3
"""fix_ai_panel_focus.py: one-off correction of a website's AI question panel to its focus (AI-FOCUS, 2026-10-27,
docs/ai-panel-focus-2026-10-27/RESEARCH_AND_DESIGN.md §6).

devaicon.com (Pakistan) typed "open edx provider" once at onboarding, then worked only on a keyword ladder about AI automation. Its
10-question panel was written on the setup day, before the ladder existed, in the UAE, and asked about Open edX every week and every pulse
morning. The deployed engine fixes this by itself on the website's next weekly AI check (v5/code/_ai_focus.js: a panel with no trend yet whose
automatic questions are all in another market is replaced at once, and the questions follow the ladder) - but only once the website's own
market is right (Site Admin `market`, the mismatch fix M2) and only for what the engine can see. This script does the owner's part of §6.3
without waiting for a weekly run, and shows what is there:

  1. --retire "open edx"     retires the AUTOMATIC questions whose search phrase, topic or wording contains the phrase (status `retired`,
                             retired_at, retire_reason; the history and the answers stay; the owner's own and pinned questions are never touched)
  2. --untrack "open edx provider"   removes a tracked keyword from seo_sites.keywords (so it does not come back as a topic)
  3. --pulse-scope focus     the daily check asks only the questions about the keywords the client works on (seo_monitors.ai_pulse_scope)
  then the next weekly AI check writes the questions the focus needs (7 for the ladder and its page, 2 for a declared service on a panel of 10),
  in the website's market, at the same price (no extra spend).

    python3 fix_ai_panel_focus.py --domain devaicon.com                                        # dry run: prints the panel, the market, the ladders
    python3 fix_ai_panel_focus.py --domain devaicon.com --retire "open edx" --untrack "open edx provider" --pulse-scope focus          # dry run of the changes
    python3 fix_ai_panel_focus.py --domain devaicon.com --retire "open edx" --untrack "open edx provider" --pulse-scope focus --apply  # writes them

Reads and writes through the n8n public API (key N8N_API_KEY from the environment, n8n/.env or app/.env), like fix_brand_rungs.py. Nothing is
deleted. Production is written only with --apply, against the instance N8N_PUBLIC_URL names (default http://localhost:5678).
"""
import argparse, datetime, json, os, sys, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from env_settings import load_env
from ladder_common import AI_PROMPTS_TABLE, SITES_TABLE, MONITORS_TABLE, LADDER_TABLE, LADDER_SETTINGS_TABLE

BASE = os.environ.get('N8N_PUBLIC_URL', 'http://localhost:5678').rstrip('/') + '/api/v1'


def api_key():
    k = os.environ.get('N8N_API_KEY') or load_env().get('N8N_API_KEY')
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
    cursor = None
    while True:
        page = call(key, '/data-tables?limit=100' + ('&cursor=' + urllib.parse.quote(cursor) if cursor else ''))
        for t in page.get('data', []):
            if t.get('name') == name:
                return t['id']
        cursor = page.get('nextCursor')
        if not cursor:
            return ''


def rows(key, tid, column, value, limit=5000):
    """every row whose `column` equals `value` (filtered server-side, compact JSON as n8n's filter wants it)"""
    flt = json.dumps({'type': 'and', 'filters': [{'columnName': column, 'condition': 'eq', 'value': value}]}, separators=(',', ':'))
    out, cursor = [], None
    while tid and len(out) < limit:
        page = call(key, '/data-tables/%s/rows?limit=250&filter=%s%s' % (tid, urllib.parse.quote(flt), '&cursor=' + urllib.parse.quote(cursor) if cursor else ''))
        out.extend(page.get('data', []))
        cursor = page.get('nextCursor')
        if not cursor:
            break
    return out


def update(key, tid, row_id, data):
    body = {'filter': {'type': 'and', 'filters': [{'columnName': 'id', 'condition': 'eq', 'value': row_id}]}, 'data': data}
    return call(key, '/data-tables/%s/rows/update' % tid, 'PATCH', body)


def owner_q(p):
    return str(p.get('source') or '') == 'custom' or p.get('pinned') is True or str(p.get('pinned')).lower() == 'true'


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--domain', required=True)
    ap.add_argument('--retire', action='append', default=[], help='retire the automatic questions about this phrase (repeatable)')
    ap.add_argument('--untrack', action='append', default=[], help='remove this tracked keyword (repeatable)')
    ap.add_argument('--pulse-scope', choices=['focus', 'all'], default=None)
    ap.add_argument('--apply', action='store_true', help='write the changes (default: dry run)')
    a = ap.parse_args(argv)
    key = api_key()
    if not key:
        print('N8N_API_KEY is not set (environment, n8n/.env or app/.env)'); return 2
    dom = a.domain.lower().strip().replace('https://', '').replace('http://', '').replace('www.', '').split('/')[0]
    site_id = 'site_' + ''.join(c if c.isalnum() else '-' for c in dom)
    t_prompts, t_sites, t_mon = table_id(key, AI_PROMPTS_TABLE), table_id(key, SITES_TABLE), table_id(key, MONITORS_TABLE)
    t_lad, t_set = table_id(key, LADDER_TABLE), table_id(key, LADDER_SETTINGS_TABLE)
    site = (rows(key, t_sites, 'site_id', site_id) or [{}])[0]
    prompts = rows(key, t_prompts, 'site_id', site_id)
    mons = (rows(key, t_mon, 'site_id', site_id) or [{}])[0]
    ladders = rows(key, t_lad, 'domain', dom)
    settings = rows(key, t_set, 'site_id', site_id)
    print('%s (%s): engine market %s / location %s / language %s; tracked keywords: %s' % (dom, site_id, site.get('country') or '?', site.get('location_code') or '?', site.get('language_code') or '?', site.get('keywords') or '-'))
    print('  panel size %s, pulse %s, pulse scope %s, focus %s' % (mons.get('ai_prompts_max') or '(default)', 'off' if str(mons.get('ai_pulse')).lower() == 'false' else 'on', mons.get('ai_pulse_scope') or 'all', mons.get('ai_focus_mode') or 'on'))
    st = {s.get('ladder_id'): s.get('status') for s in settings}
    for lid in sorted({l.get('ladder_id') for l in ladders if l.get('ladder_id')}):
        head = next((l.get('head_keyword') for l in ladders if l.get('ladder_id') == lid), '')
        print('  ladder %s "%s" (%s)' % (lid, head, st.get(lid) or 'active'))
    live = [p for p in prompts if str(p.get('status') or 'active') == 'active']
    print('  %d question(s) asked now:' % len(live))
    for p in live:
        print('    %-20s %-6s %-7s %s' % (p.get('prompt_id'), p.get('market') or '-', 'owner' if owner_q(p) else p.get('kind') or '', str(p.get('prompt'))[:110]))
    if str(site.get('location_code') or '') in ('2784',) and dom == 'devaicon.com':
        print('\n  NOTE: the engine still measures this website in the UAE (2784). Set its market first: Site Admin {"action": "market", "domain": "%s", "country": "Pakistan"}' % dom)
    now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
    plan = []
    for ph in [x.lower().strip() for x in a.retire if x.strip()]:
        for p in live:
            text = ' '.join(str(p.get(k) or '') for k in ('keyword', 'cluster', 'topic', 'prompt')).lower()
            if p.get('kind') == 'brand' or owner_q(p) or ph not in text:
                continue
            plan.append(('retire', t_prompts, p.get('id'), {'status': 'retired', 'retired_at': now, 'retire_reason': 'the website no longer works on ' + ph, 'focus_state': 'out'}, p.get('prompt_id') + ' "' + str(p.get('prompt'))[:80] + '"'))
    if a.untrack and site.get('id'):
        kws = [k.strip() for k in str(site.get('keywords') or '').split(',') if k.strip()]
        drop = {x.lower().strip() for x in a.untrack}
        keep = [k for k in kws if k.lower() not in drop]
        if keep != kws:
            plan.append(('untrack', t_sites, site.get('id'), {'keywords': ', '.join(keep)}, 'tracked keywords: ' + (', '.join(keep) or '(none)')))
    if a.pulse_scope and mons.get('id') and str(mons.get('ai_pulse_scope') or '') != a.pulse_scope:
        plan.append(('pulse', t_mon, mons.get('id'), {'ai_pulse_scope': a.pulse_scope}, 'the daily check asks: ' + ('the focus questions' if a.pulse_scope == 'focus' else 'every question')))
    print('\n%s %d change(s):' % ('Writing' if a.apply else 'Would write', len(plan)))
    for kind, _t, rid, data, what in plan:
        print('  %-8s row %-6s %s' % (kind, rid, what))
    if not a.apply:
        print('\ndry run (default): nothing was written. Re-run with --apply. The next weekly AI check then writes the questions the focus needs, at the same price.')
        return 0
    failed = 0
    for kind, tid, rid, data, what in plan:
        try:
            update(key, tid, rid, data)
        except Exception as e:
            failed += 1; print('  FAILED %s row %s: %s' % (kind, rid, str(e)[:120]))
    print('fix_ai_panel_focus: wrote %d change(s)%s' % (len(plan) - failed, (', %d failed' % failed) if failed else ''))
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
