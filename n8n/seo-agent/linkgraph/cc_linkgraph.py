#!/usr/bin/env python3
"""cc_linkgraph.py — the Common Crawl web graph for the Backlink Monitor (v4.10, BACKLINKS_SPEC.md §3.4). Free; runs as the `linkgraph`
container next to n8n (compose.override.yml) or by hand.

What it does, once per graph release (Common Crawl publishes a domain-level graph about monthly, each covering three crawls: ~133M domains,
~2.1B domain-to-domain links, with harmonic-centrality and PageRank positions):
1. reads the sites the Backlink Monitor watches and their competitors from the n8n Data Tables (seo_sites, seo_ladders, seo_monitors, the
   latest seo_backlink_snapshots) and the referrers already in the ledger (seo_backlinks);
2. streams the graph files (domain vertices 0.9 GB, edges 8 GB, ranks 2.3 GB, all gzip; nothing is kept on disk; a broken connection resumes
   with an HTTP Range request) and keeps only the links that point to those sites and competitors;
3. writes per site to seo_link_graph: the site's referring domains (kind link), the domains that link to a competitor but not to the site
   (kind gap, links_to = the competitors) and a free authority rank for the ledger's other referrers (kind rank); hc_pos / pr_pos = position
   among all domains by harmonic centrality / PageRank (1 = best); the site's previous rows are replaced;
4. remembers the release and the target set in seo_cache (key linkgraph:state), so it runs again only for a new release or new targets.

The graph has no anchors, dates or nofollow flags: the Backlink Monitor's own link check fills those in. Links in the graph are any
hyperlinks Common Crawl saw (also images / scripts), so a domain here is "links to you somewhere", confirmed or not by the check.

Usage:
  python3 cc_linkgraph.py --once                 run now if a release / the targets changed (else nothing)
  python3 cc_linkgraph.py --once --force         run now regardless
  python3 cc_linkgraph.py                        stay up; check once a day at LINKGRAPH_HOUR (UTC, default 2)
  python3 cc_linkgraph.py --list                 show the sites and competitors it would look up (reads n8n), then stop
  python3 cc_linkgraph.py --once --dry-run --targets techand.ai:complyance.io,cleartax.com --base-url http://localhost:8000/ --out result.json
Environment: LINKGRAPH_ENABLED (on; "off" = the container stops at once), N8N_URL (http://n8n:5678), N8N_API_KEY, N8N_PROJECT_ID (wo1WpMiHjdduGvfl), LINKGRAPH_HOUR (2), LINKGRAPH_MAX_LINKS (5000),
LINKGRAPH_MAX_GAP (150), LINKGRAPH_BASE_URL (https://data.commoncrawl.org/), LINKGRAPH_UA (contact for Common Crawl's logs).
"""
import gzip, hashlib, io, json, os, re, sys, time, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
try:
    from ladder_common import LINK_GRAPH_TABLE, LINK_GRAPH_COLS, CACHE_TABLE   # one source of truth for the table columns
except Exception:   # the job copied somewhere else: same columns
    LINK_GRAPH_TABLE, CACHE_TABLE = 'seo_link_graph', 'seo_cache'
    LINK_GRAPH_COLS = [('site_id', 'string'), ('domain', 'string'), ('release', 'string'), ('kind', 'string'), ('ref_domain', 'string'), ('hc_pos', 'number'), ('pr_pos', 'number'), ('n_hosts', 'number'), ('links_to', 'string'), ('checked_at', 'string')]

ENV = os.environ.get
N8N = (ENV('N8N_URL') or 'http://n8n:5678').rstrip('/') + '/api/v1'
KEY = ENV('N8N_API_KEY') or ''
PROJECT = ENV('N8N_PROJECT_ID') or 'wo1WpMiHjdduGvfl'
BASE = (ENV('LINKGRAPH_BASE_URL') or 'https://data.commoncrawl.org/').rstrip('/') + '/'
INFO = ENV('LINKGRAPH_INFO_URL') or 'https://index.commoncrawl.org/graphinfo.json'
UA = ENV('LINKGRAPH_UA') or 'SEOAgentLinkGraph/4.10 (backlink monitor; monthly, one pass per release)'
MAX_LINKS, MAX_GAP, MAX_RANKS = int(ENV('LINKGRAPH_MAX_LINKS') or 5000), int(ENV('LINKGRAPH_MAX_GAP') or 150), 3000
HOUR = int(ENV('LINKGRAPH_HOUR') or 2)

def log(*a): print(datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S'), *a, flush=True)

# ---------------- n8n public API (Data Tables) ----------------
def api(path, method='GET', body=None, timeout=60):
    req = urllib.request.Request(N8N + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json', 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
        return json.loads(raw) if raw else {}

def table_ids():
    out, cursor = {}, None
    while True:
        page = api('/data-tables?limit=100' + ('&cursor=' + urllib.parse.quote(cursor) if cursor else ''))
        for t in page.get('data', []): out[t['name']] = t['id']
        cursor = page.get('nextCursor')
        if not cursor: return out

def rows(ids, name, filters=None, max_rows=200000):
    if name not in ids: return []
    out, cursor = [], None
    while len(out) < max_rows:
        q = {'limit': '250'}
        if filters: q['filter'] = json.dumps({'type': 'and', 'filters': filters}, separators=(',', ':'))
        if cursor: q['cursor'] = cursor
        page = api('/data-tables/%s/rows?%s' % (ids[name], urllib.parse.urlencode(q, quote_via=urllib.parse.quote)))   # n8n refuses '+' for spaces in filter
        out += page.get('data', [])
        cursor = page.get('nextCursor')
        if not cursor: break
    return out

def ensure_table(ids, name, cols):
    if name in ids: return ids[name]
    try:
        t = api('/data-tables', 'POST', {'name': name, 'columns': [{'name': c, 'type': t} for c, t in cols], 'projectId': PROJECT})
        ids[name] = t['id']; return t['id']
    except urllib.error.HTTPError as e:
        if e.code != 409: raise
        ids.update(table_ids()); return ids[name]

def delete_rows(tid, filters):
    api('/data-tables/%s/rows/delete?filter=%s' % (tid, urllib.parse.quote(json.dumps({'type': 'and', 'filters': filters}, separators=(',', ':')), safe='')), 'DELETE')

def insert_rows(tid, data):
    for i in range(0, len(data), 500): api('/data-tables/%s/rows' % tid, 'POST', {'data': data[i:i + 500], 'returnType': 'count'}, timeout=120)

# ---------------- what to look up ----------------
def norm(d):
    d = str(d or '').strip().lower()
    d = re.sub(r'^https?://', '', d); d = re.sub(r'^www\.', '', d); d = re.split(r'[/?#:]', d)[0]
    return d.rstrip('.')

def listof(v): return [x.strip() for x in re.split(r'[\n,;]+', str(v or '')) if x.strip()]

def site_id_for(d): return 'site_' + re.sub(r'[^a-z0-9]+', '-', d)

def flag(v, default=True):
    if v is None or v == '': return default
    return not (v is False or str(v).lower() in ('false', '0', 'no', 'off'))

def targets_from_n8n(ids):
    """{site_id: {'domain', 'competitors': [...], 'ledger': [...]}} for every site with the backlink monitor on."""
    sites = {}
    for r in rows(ids, 'seo_sites'):
        d = norm(r.get('domain'))
        if d and str(r.get('status') or 'active') != 'paused': sites.setdefault(d, r.get('site_id') or site_id_for(d))
    for r in rows(ids, 'seo_ladders'):
        d = norm(r.get('domain'))
        if d: sites.setdefault(d, site_id_for(d))
    mons = {r.get('site_id'): r for r in rows(ids, 'seo_monitors')}
    snaps = rows(ids, 'seo_backlink_snapshots')
    ledger = rows(ids, 'seo_backlinks')
    out = {}
    for d, sid in sites.items():
        m = mons.get(sid) or {}
        if not flag(m.get('backlinks'), True): continue
        comps = [norm(x) for x in listof(m.get('competitors'))]
        if not comps:   # the competitors the Backlink Monitor found (Labs) and kept in its last full snapshot
            full = sorted([s for s in snaps if s.get('site_id') == sid and s.get('mode') == 'full'], key=lambda s: str(s.get('checked_at')), reverse=True)
            if full:
                try: comps = [norm(c.get('domain')) for c in json.loads(full[0].get('competitors_json') or '[]')]
                except Exception: comps = []
        comps = [c for c in dict.fromkeys(comps) if c and c != d][:5]
        refs = [norm(r.get('ref_domain')) for r in ledger if r.get('site_id') == sid and r.get('kind', 'web') == 'web']
        out[sid] = {'domain': d, 'competitors': comps, 'ledger': [x for x in dict.fromkeys(refs) if x][:MAX_RANKS]}
    return out

def rev(d): return '.'.join(reversed(d.split('.')))

# ---------------- streaming the graph ----------------
class RangeReader(io.RawIOBase):
    """A file-like view of a remote file that reconnects with an HTTP Range request when the connection drops (an 8 GB download at a few
    MB/s takes hours; a restart from zero would never finish)."""
    def __init__(self, url, tries=30):
        self.url, self.pos, self.tries, self.resp, self.total = url, 0, tries, None, None
    def readable(self): return True
    def _open(self):
        req = urllib.request.Request(self.url, headers={'User-Agent': UA, **({'Range': 'bytes=%d-' % self.pos} if self.pos else {})})
        self.resp = urllib.request.urlopen(req, timeout=120)
        cr = self.resp.headers.get('Content-Range') or ''
        m = re.search(r'/(\d+)$', cr)
        if m: self.total = int(m.group(1))
        elif self.total is None and self.resp.headers.get('Content-Length'): self.total = self.pos + int(self.resp.headers['Content-Length'])
    def readinto(self, b):
        for attempt in range(self.tries):
            try:
                if self.resp is None: self._open()
                n = self.resp.readinto(b)
                if not n and self.total is not None and self.pos < self.total:   # the server closed the stream early without an error
                    raise ConnectionError('stream ended at %d of %d bytes' % (self.pos, self.total))
                self.pos += n or 0
                return n
            except (urllib.error.URLError, ConnectionError, TimeoutError, OSError) as e:
                self.resp = None
                if attempt + 1 >= self.tries: raise
                log('  connection dropped at byte %d (%s); resuming in %ds' % (self.pos, str(e)[:80], min(60, 5 * (attempt + 1))))
                time.sleep(min(60, 5 * (attempt + 1)))
        return 0

def lines(url):
    raw = io.BufferedReader(RangeReader(url), buffer_size=1 << 20)
    return io.BufferedReader(gzip.GzipFile(fileobj=raw), buffer_size=1 << 20)

def latest_release():
    req = urllib.request.Request(INFO, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r: info = json.loads(r.read())
    return info[0]['id']

def files(release):
    p = BASE + 'projects/hyperlinkgraph/%s/domain/%s-domain-' % (release, release)
    return p + 'vertices.txt.gz', p + 'edges.txt.gz', p + 'ranks.txt.gz'

def compute(release, sites):
    """Streams the three files; returns {site_id: [rows]} plus stats."""
    vertices, edges, ranks = files(release)
    t0 = time.time()
    want = {}   # reversed name -> plain domain (sites + competitors)
    for s in sites.values():
        for d in [s['domain']] + s['competitors']: want[rev(d).encode()] = d
    # 1. ids of the targets
    ids = {}
    for n, line in enumerate(lines(vertices)):
        parts = line.rstrip(b'\n').split(b'\t')
        if len(parts) >= 2 and parts[1] in want: ids[parts[0]] = want[parts[1]]
        if n % 20_000_000 == 0 and n: log('  vertices pass 1: %dM lines, %d of %d targets found' % (n // 1_000_000, len(ids), len(want)))
    log('targets found in the graph: %d of %d (%s)' % (len(ids), len(want), ', '.join(sorted(set(want.values()) - set(ids.values()))) or 'all'))
    if not ids: return {}, {'release': release, 'targets': 0}
    # 2. who links to them
    inlinks = {d: set() for d in ids.values()}
    tails = {k + b'\n': v for k, v in ids.items()}
    for n, line in enumerate(lines(edges)):
        i = line.rfind(b'\t')
        d = tails.get(line[i + 1:])
        if d is not None:
            src = line[:i]
            if src not in ids or ids[src] != d: inlinks[d].add(src)
        if n % 100_000_000 == 0 and n: log('  edges: %dM lines (%.0f min)' % (n // 1_000_000, (time.time() - t0) / 60))
    need = set().union(*inlinks.values()) if inlinks else set()
    log('linking domains collected: %d' % len(need))
    # 3. their names
    names = {}
    for line in lines(vertices):
        parts = line.rstrip(b'\n').split(b'\t')
        if len(parts) >= 2 and parts[0] in need: names[parts[0]] = rev(parts[1].decode('utf-8', 'replace'))
    links = {d: {names[x] for x in s if x in names} for d, s in inlinks.items()}
    # 4. ranks for the linking domains, the targets and the ledger's referrers
    rank_want = set().union(*links.values()) | set(want.values()) | {r for s in sites.values() for r in s['ledger']}
    rank_rev = {rev(d).encode(): d for d in rank_want}
    rank = {}
    for n, line in enumerate(lines(ranks)):
        if line.startswith(b'#'): continue
        parts = line.rstrip(b'\n').split(b'\t')
        if len(parts) >= 5 and parts[4] in rank_rev:
            rank[rank_rev[parts[4]]] = (int(parts[0]), int(parts[2]), int(parts[5]) if len(parts) > 5 and parts[5].isdigit() else 0)
    log('ranks found: %d of %d (%.0f min in all)' % (len(rank), len(rank_want), (time.time() - t0) / 60))
    return build_rows(release, sites, links, rank), {'release': release, 'targets': len(ids), 'linking': len(need), 'minutes': round((time.time() - t0) / 60, 1)}

def build_rows(release, sites, links, rank):
    now = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    big = 10 ** 12
    out = {}
    for sid, s in sites.items():
        d = s['domain']; own = links.get(d, set())
        row = lambda kind, ref, links_to='': {'site_id': sid, 'domain': d, 'release': release, 'kind': kind, 'ref_domain': ref, 'hc_pos': (rank.get(ref) or (0, 0, 0))[0], 'pr_pos': (rank.get(ref) or (0, 0, 0))[1], 'n_hosts': (rank.get(ref) or (0, 0, 0))[2], 'links_to': links_to, 'checked_at': now}
        rs = [row('link', r) for r in sorted(own, key=lambda r: (rank.get(r) or (big,))[0])[:MAX_LINKS]]
        gap = {}
        for c in s['competitors']:
            for r in links.get(c, set()):
                if r not in own and r != d and r not in s['competitors']: gap.setdefault(r, []).append(c)
        rs += [row('gap', r, ','.join(cs)) for r, cs in sorted(gap.items(), key=lambda kv: (-len(kv[1]), (rank.get(kv[0]) or (big,))[0]))[:MAX_GAP]]
        rs += [row('rank', r) for r in s['ledger'] if r not in own and r in rank][:MAX_RANKS]
        rs.append(row('summary', d, ','.join('%s=%d' % (t, len(links.get(t, set()))) for t in [d] + s['competitors'])))
        out[sid] = rs
    return out

# ---------------- state and the run ----------------
def state(ids):
    if CACHE_TABLE not in ids: return {}
    r = rows(ids, CACHE_TABLE, [{'columnName': 'key', 'condition': 'eq', 'value': 'linkgraph:state'}])
    try: return json.loads(r[0]['value']) if r else {}
    except Exception: return {}

def save_state(ids, st):
    tid = ensure_table(ids, CACHE_TABLE, [('key', 'string'), ('kind', 'string'), ('site_id', 'string'), ('value', 'string'), ('updated_at', 'string')])
    delete_rows(tid, [{'columnName': 'key', 'condition': 'eq', 'value': 'linkgraph:state'}])
    insert_rows(tid, [{'key': 'linkgraph:state', 'kind': 'linkgraph', 'site_id': '', 'value': json.dumps(st), 'updated_at': datetime.now(timezone.utc).isoformat()}])

def run_once(force=False, dry=False, targets=None, out=None, release=None):
    if targets:
        sites = {}
        for part in targets.split(';'):
            d, _, comps = part.partition(':')
            sites[site_id_for(norm(d))] = {'domain': norm(d), 'competitors': [norm(c) for c in comps.split(',') if c.strip()], 'ledger': []}
        ids = {}
    else:
        if not KEY: log('no N8N_API_KEY: nothing to do'); return 1
        ids = table_ids(); sites = targets_from_n8n(ids)
    if not sites: log('no site with the backlink monitor on'); return 0
    release = release or latest_release()
    tkey = hashlib.sha1(json.dumps(sorted((s['domain'], sorted(s['competitors'])) for s in sites.values())).encode()).hexdigest()[:12]
    st = state(ids) if ids else {}
    if not force and st.get('release') == release and st.get('targets') == tkey:
        log('release %s already processed for these targets: nothing to do' % release); return 0
    log('release %s, %d site(s): %s' % (release, len(sites), '; '.join(s['domain'] + (' vs ' + ', '.join(s['competitors']) if s['competitors'] else '') for s in sites.values())))
    result, stats = compute(release, sites)
    if out: json.dump({'stats': stats, 'rows': result}, open(out, 'w'), indent=1)
    if dry: log('dry run: %s' % json.dumps(stats)); return 0
    tid = ensure_table(ids, LINK_GRAPH_TABLE, LINK_GRAPH_COLS)
    for sid, rs in result.items():
        delete_rows(tid, [{'columnName': 'site_id', 'condition': 'eq', 'value': sid}])
        insert_rows(tid, rs)
        log('  %s: %d links, %d gap, %d ranks written' % (sid, sum(r['kind'] == 'link' for r in rs), sum(r['kind'] == 'gap' for r in rs), sum(r['kind'] == 'rank' for r in rs)))
    save_state(ids, {'release': release, 'targets': tkey, 'finished_at': datetime.now(timezone.utc).isoformat(), **stats})
    log('done: %s' % json.dumps(stats))
    return 0

def main():
    a = sys.argv[1:]
    opt = lambda k: a[a.index(k) + 1] if k in a else None
    kw = dict(force='--force' in a, dry='--dry-run' in a, targets=opt('--targets'), out=opt('--out'), release=opt('--release'))
    global BASE
    if opt('--base-url'): BASE = opt('--base-url').rstrip('/') + '/'
    if '--list' in a:
        for sid, t in targets_from_n8n(table_ids()).items(): print(sid, t['domain'], 'competitors:', ', '.join(t['competitors']) or '-', '| ledger referrers:', len(t['ledger']))
        return 0
    if '--once' in a: return run_once(**kw)
    if str(ENV('LINKGRAPH_ENABLED') or 'on').lower() in ('off', 'false', '0', 'no'): log('LINKGRAPH_ENABLED is off: stopping'); return 0
    log('linkgraph job up: checks for a new Common Crawl graph release every day at %02d:00 UTC' % HOUR)
    while True:
        now = datetime.now(timezone.utc)
        wait = ((HOUR - now.hour) % 24) * 3600 - now.minute * 60 - now.second
        time.sleep(wait if wait > 0 else 24 * 3600 + wait)
        try: run_once()
        except Exception as e: log('run failed: %s' % str(e)[:300])

if __name__ == '__main__':
    sys.exit(main() or 0)
