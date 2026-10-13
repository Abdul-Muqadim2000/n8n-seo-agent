#!/usr/bin/env python3
"""fix_brand_rungs.py — one-off: sets aside the stored ladder rungs no page of the site should ever target (R16, 2026-10-13).

The keyword fit gate (FIX_PLAN D4 / D8) stops a NEW keyword, but nothing ever revisited the rows already in `seo_ladders`: rung 2 of
`lad_mv40b6s9h5a8` still held **"facts erp"** (facts.ae, a competing UAE ERP vendor) with `status: planned`, so the Rank Tracker's
delivered report of 2026-10-12 listed it and the Content Cadence would have written that page. The engine now runs the gate on the read
path too (`fitStored` in `v5/code/_fit_gate.js`, build_v4.py section 53), so nothing new slips through and the cadence marks such a row
`set_aside` the next time it runs. This script repairs the rows that exist today, without waiting for a Monday.

What it does: every `seo_ladders` row goes through the gate's brand / government / portal branches, with the word lists and the regexes
READ OUT OF `v5/code/_fit_gate.js` so there is one source of truth (nothing is copied here). The evidence is what is stored:
  * the site's own domain (an "own brand" keyword),
  * the competitors the owner declared (`seo_monitors.competitors`, `seo_sites.competitors`),
  * the domains that were really on this keyword's results page, from `seo_rank_history` (`competitors_json`, `snapshot_json`) — the
    same evidence the live gate uses, which is how facts.ae is recognised without anybody having typed it anywhere.
A row whose page is already **written or published** (`status` writing / published, `page_exists`, or a `seo_content_log` row with a
published URL) is NEVER touched: that page is live work, and the reports flag it instead. Only `status` is written, to `set_aside` —
the reason is printed here and recomputed by the engine on every run, so nothing depends on a column that does not exist.

    python3 fix_brand_rungs.py                      # dry run (default): prints every row it would change and every row it keeps, with the reason
    python3 fix_brand_rungs.py --apply              # writes them (one PATCH per row, by row id)
    python3 fix_brand_rungs.py --domain techand.ai  # one site
    python3 fix_brand_rungs.py --ladder lad_mv40b6s9h5a8 --apply
    python3 fix_brand_rungs.py --brand facts.ae     # evidence you have that nothing stored carries yet: treat this domain as a competitor for this run

`--brand` exists because the gate never guesses. A rung whose results page was last read before the G6 columns existed (2026-10-12) has no
stored evidence, so the script keeps it and says so — "facts erp" is exactly that case until the next Rank Tracker run stores its results
page. Naming the domain on the command line supplies that evidence once; the engine reaches the same conclusion by itself from the next run.

Reads and writes through the n8n public API (key N8N_API_KEY from n8n/.env or app/.env), like fix_ladder_hosts.py and sync_tables.py.
"""
import json, os, re, sys, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from env_settings import load_env
from ladder_common import LADDER_TABLE, SITES_TABLE, MONITORS_TABLE, LOG_TABLE, HISTORY_TABLE

BASE = os.environ.get('N8N_PUBLIC_URL', 'http://localhost:5678').rstrip('/') + '/api/v1'
GATE = os.path.join(HERE, 'v5', 'code', '_fit_gate.js')
LIVE_STATUSES = ('writing', 'published')
NEW_STATUS = 'set_aside'


# ---------------------------------------------------------------- the n8n API (same shape as fix_ladder_hosts.py)
def api_key():
    k = os.environ.get('N8N_API_KEY') or load_env().get('N8N_API_KEY')   # the environment first, so the script also runs from a git worktree with no .env
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


def rows(key, tid, limit=5000):
    out, cursor = [], None
    while tid and len(out) < limit:
        page = call(key, '/data-tables/%s/rows?limit=250%s' % (tid, '&cursor=' + urllib.parse.quote(cursor) if cursor else ''))
        out.extend(page.get('data', []))
        cursor = page.get('nextCursor')
        if not cursor:
            break
    return out


# ---------------------------------------------------------------- the gate's own rules, read from v5/code/_fit_gate.js
def load_rules(path=GATE):
    """The word lists and regexes of the shared kit, so this script and the engine can never drift apart."""
    src = open(path, encoding='utf-8').read()
    def words(name):
        m = re.search(r'const %s = new Set\(\[(.*?)\]\);' % name, src, re.S)
        assert m, '%s not found in %s' % (name, path)
        return set(re.findall(r"'([^']*)'", m.group(1)))
    def rx(name):
        m = re.search(r'const %s = /(.*)/([a-z]*);\s*$' % name, src, re.M)
        assert m, '%s not found in %s' % (name, path)
        return re.compile(m.group(1), re.I if 'i' in m.group(2) else 0)
    cfg = re.search(r'const FIT_CFG = \{\s*min_label:\s*(\d+),\s*serp_top:\s*(\d+),\s*serp_hold:\s*(\d+)', src)
    assert cfg, 'FIT_CFG not found in ' + path
    return {
        'min_label': int(cfg.group(1)), 'serp_top': int(cfg.group(2)), 'serp_hold': int(cfg.group(3)),
        'STOP': words('FIT_STOP'), 'GEO': words('FIT_GEO'), 'GENERIC': words('FIT_GENERIC'),
        'GOV_WORDS': rx('FIT_GOV_WORDS'), 'GOV_NAMES': rx('FIT_GOV_NAMES'), 'PORTAL': rx('FIT_PORTAL'),
        'CONTENT': rx('FIT_CONTENT'), 'PARTNER': rx('FIT_PARTNER'), 'COMPARE': rx('FIT_COMPARE'),
    }


def tokens(s, R):
    out = []
    for t in re.split(r'[^a-z0-9.]+', str(s or '').lower().replace('’', '').replace("'", '')):
        t = t.strip('.')
        if len(t) > 1 and t not in R['STOP']:
            out.append(t)
    return out


host_of = lambda d: re.sub(r'^(www|m|app|en|ar)\.', '', re.sub(r':\d+$', '', re.sub(r'[/?#].*$', '', re.sub(r'^https?://', '', str(d or '').strip().lower()))))


def labels(domain, protect, R):
    h = host_of(domain)
    if not h:
        return []
    first = h.split('.')[0]
    parts, seen = [], set()
    for p in [first] + re.split(r'[-_]', first):
        p = re.sub(r'[^a-z0-9]', '', p)
        if p and p not in seen:
            seen.add(p); parts.append(p)
    return [p for p in parts if len(p) >= R['min_label'] and p not in R['GENERIC'] and p not in R['GEO'] and p not in protect]


def fit_gate(keyword, ctx, R):
    """The gate's branches that stored evidence can answer: own brand, government, portal, other brand.

    `navigational` (the search data's own label) and G19's relevance hook are not stored on a ladder row, so they are not judged here —
    the engine judges them on every read. Returns (ok, reason, detail).
    """
    kw = re.sub(r'\s+', ' ', str(keyword or '').lower()).strip()
    toks = tokens(kw, R)
    squashed = ''.join(toks)
    if not toks:
        return False, 'empty', 'no keyword'
    protect = set()
    for p in ctx.get('protect') or []:
        protect.update(tokens(p, R))
    padded = ' ' + kw + ' '
    content, partner, compare, portal = (bool(R[k].search(padded)) for k in ('CONTENT', 'PARTNER', 'COMPARE', 'PORTAL'))
    for l in labels(ctx.get('own_domain'), set(), R):
        if l in toks or l in squashed:
            return False, 'own brand', 'names the website itself (%s)' % l
    gw = R['GOV_WORDS'].search(padded)
    if gw and not content:
        return False, 'government', 'a public body, not a topic (%s)' % (gw.group(1) or gw.group(0)).strip()
    gn = R['GOV_NAMES'].search(padded)
    if gn:
        body = (gn.group(1) or gn.group(0)).strip()
        btoks = tokens(body, R)
        rest = [t for t in toks if t not in btoks and t not in R['GEO'] and not re.match(r'^(check|checking|card|number|no|online|status)$', t)]
        if not rest or (portal and not content):
            return False, 'government', 'a public body or an identity document, not a topic (%s)' % body
    if portal and not content:
        return False, 'portal', "a login, portal, status or application task: people want the owner's own site"
    rescue = partner or compare
    def leads(l):
        if l not in toks:
            return False
        i = toks.index(l)
        return i == 0 or (i + 1 < len(toks) and (toks[i + 1] in R['GENERIC'] or toks[i + 1] in protect))
    for d in ctx.get('competitors') or []:
        for l in labels(d, protect, R):
            if (l in toks or l in squashed) and not compare:
                return False, 'other brand', 'names a competitor: %s (%s)' % (l, host_of(d))
    for d in ctx.get('serp_domains') or []:
        for l in labels(d, protect, R):
            if l in toks and leads(l) and not rescue:
                return False, 'other brand', 'names another company on the results page: %s (%s)' % (l, host_of(d))
    serp = [host_of(d) for d in (ctx.get('serp') or [])][:R['serp_top']]
    if len(serp) >= R['serp_hold']:
        for h in set(serp):
            n = serp.count(h)
            if n >= R['serp_hold'] and any(l in toks for l in labels(h, protect, R)):
                return False, 'other brand', '%s holds %d of the top %d results: a brand query' % (h, n, len(serp))
    return True, '', ''


# ---------------------------------------------------------------- the plan
bare = lambda v: re.sub(r'^www\.', '', host_of(v))
normk = lambda s: re.sub(r'[^a-z0-9]+', ' ', str(s or '').lower()).strip()


def serp_evidence(hist):
    """The domains that were really on this keyword's results page, in rank order (seo_rank_history)."""
    best = {}
    for h in hist:
        for col in ('competitors_json', 'snapshot_json'):
            try:
                o = json.loads(h.get(col) or 'null')
            except Exception:
                o = None
            if not isinstance(o, dict):
                continue
            for x in (o.get('above') or []) + (o.get('competitors') or []):
                d, p = bare(x.get('d') or x.get('domain')), x.get('p') or x.get('position')
                if d and isinstance(p, (int, float)) and p > 0:
                    best[d] = min(best.get(d, 999), p)
            for x in (o.get('top') or []):
                d, p = bare(x.get('u') or x.get('url')), x.get('p') or x.get('position')
                if d and isinstance(p, (int, float)) and p > 0:
                    best[d] = min(best.get(d, 999), p)
    return [d for d, _ in sorted(best.items(), key=lambda kv: kv[1])]


def plan(ladders, sites, monitors, logs, history, R, only_domain='', only_ladder='', brands=()):
    """Returns (changes, keeps): changes are (row, reason, detail); keeps are (row, why)."""
    published = set()
    for l in logs:
        if str(l.get('status') or '') == 'published' or str(l.get('published_url') or '').strip():
            published.add((bare(l.get('domain')), normk(l.get('keyword'))))
    changes, keeps = [], []
    heads = {}
    for r in ladders:
        heads.setdefault(bare(r.get('domain')), set()).add(str(r.get('head_keyword') or ''))
    for r in ladders:
        dom = bare(r.get('domain'))
        kw = str(r.get('keyword') or '').strip()
        if only_domain and dom != bare(only_domain):
            continue
        if only_ladder and str(r.get('ladder_id') or '') != only_ladder:
            continue
        status = str(r.get('status') or 'planned').lower()
        if status == NEW_STATUS:
            keeps.append((r, 'already set aside')); continue
        if status in LIVE_STATUSES or r.get('page_exists') in (True, 'true') or (dom, normk(kw)) in published:
            why = ('its page is already written (status %s)' % status) if status in LIVE_STATUSES \
                else 'the site already has a live page for it (page_exists)' if r.get('page_exists') in (True, 'true') \
                else 'a page for it is published (seo_content_log)'
            keeps.append((r, why + ': the reports flag it, nothing is changed')); continue
        site = next((s for s in sites if bare(s.get('domain')) == dom), {})
        mon = next((m for m in monitors if (site.get('site_id') and m.get('site_id') == site.get('site_id')) or bare(m.get('domain')) == dom), {})
        comps = [c for c in re.split(r'[,\s]+', ' '.join([str(mon.get('competitors') or ''), str(site.get('competitors') or ''), ' '.join(brands)])) if c and bare(c) != dom]
        hist = [h for h in history if normk(h.get('keyword')) == normk(kw) and (not h.get('ladder_id') or h.get('ladder_id') == r.get('ladder_id'))]
        serp = serp_evidence(hist)
        try:
            services = json.loads(site.get('services_json') or '[]')
        except Exception:
            services = []
        ctx = {'own_domain': dom, 'competitors': comps, 'serp_domains': serp, 'serp': serp,
               'protect': list(heads.get(dom, set())) + [s for s in services if isinstance(s, str)]}
        ok, reason, detail = fit_gate(kw, ctx, R)
        if ok:
            keeps.append((r, 'passes the keyword rule'))
        else:
            changes.append((r, reason, detail + ('' if serp else ' [no stored results page for this keyword: judged on the declared competitors alone]')))
    return changes, keeps


def main():
    apply = '--apply' in sys.argv
    arg = lambda flag: (sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv and sys.argv.index(flag) + 1 < len(sys.argv) else '')
    only, only_ladder = arg('--domain'), arg('--ladder')
    brands = [sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == '--brand' and i + 1 < len(sys.argv)]   # evidence given on the command line
    key = api_key()
    if not key:
        print('fix_brand_rungs: no N8N_API_KEY in n8n/.env or app/.env'); return 2
    R = load_rules()
    lid = table_id(key, LADDER_TABLE)
    if not lid:
        print('fix_brand_rungs: the table %s does not exist yet — nothing to do' % LADDER_TABLE); return 0
    ladders = rows(key, lid)
    sites = rows(key, table_id(key, SITES_TABLE))
    monitors = rows(key, table_id(key, MONITORS_TABLE))
    logs = rows(key, table_id(key, LOG_TABLE))
    history = rows(key, table_id(key, HISTORY_TABLE))
    changes, keeps = plan(ladders, sites, monitors, logs, history, R, only, only_ladder, brands)
    print('fix_brand_rungs: %d ladder row(s) read, %d site row(s), %d rank-history row(s)%s; %d to set aside, %d kept'
          % (len(ladders), len(sites), len(history), (' + competitors given on the command line: ' + ', '.join(brands)) if brands else '', len(changes), len(keeps)))
    for r, reason, detail in changes:
        print('  %s %s rung %s "%s" (status %s)\n      %s: %s\n      -> status %s' % (
            'SET ASIDE' if apply else 'WOULD SET ASIDE', r.get('ladder_id'), r.get('rung'), r.get('keyword'), r.get('status'), reason, detail, NEW_STATUS))
    for r, why in keeps:
        print('  keep      %s rung %s "%s": %s' % (r.get('ladder_id'), r.get('rung'), r.get('keyword'), why))
    if not apply:
        print('\ndry run (default): nothing was written. Re-run with --apply to set aside these %d row(s).' % len(changes))
        return 0
    failed = 0
    for r, _reason, _detail in changes:
        body = {'filter': {'type': 'and', 'filters': [{'columnName': 'id', 'condition': 'eq', 'value': r['id']}]}, 'data': {'status': NEW_STATUS}}
        try:
            call(key, '/data-tables/%s/rows/update' % lid, 'PATCH', body)
        except Exception as e:
            failed += 1; print('  FAILED row %s: %s' % (r.get('id'), str(e)[:120]))
    print('fix_brand_rungs: wrote %d row(s)%s' % (len(changes) - failed, (', %d failed' % failed) if failed else ''))
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
