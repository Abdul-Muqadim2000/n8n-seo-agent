#!/usr/bin/env python3
"""G6 (2026-10-18): cut the harness fixture fixtures_live/g6_live.json.gz from the saved executions 776 (weekly AI visibility, techand.ai) and
779 (AI Pulse) of the 2026-10-17 re-rating (docs/system-review-2026-10-17/files/, git-ignored, in the MAIN checkout). Run by hand; the
harness only reads the result. Every row is cut to techand.ai; callback URLs (they carry a company's hook token), e-mail addresses and
anything that looks like a token are removed, so the fixture is safe in a public repository.

    python3 harness/capture_g6.py /path/to/docs/system-review-2026-10-17/files
"""
import gzip, json, os, re, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else '/Users/abdul.muqadim/n8n_devaicon/n8n/seo-agent/docs/system-review-2026-10-17/files'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures_live', 'g6_live.json.gz')
SITE, DOMAIN = 'site_techand-ai', 'techand.ai'
EMAIL = re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')


def scrub(v):
    if isinstance(v, dict):
        out = {}
        for k, x in v.items():
            if k in ('callback_url', 'email', 'contact_email', 'public_email', 'phone', 'street_address'):
                out[k] = '' if isinstance(x, str) else x
                continue
            out[k] = scrub(x)
        return out
    if isinstance(v, list):
        return [scrub(x) for x in v]
    if isinstance(v, str):
        v = re.sub(r'/api/hooks/n8n/[A-Za-z0-9_-]+', '/api/hooks/n8n/<token>', v)
        v = EMAIL.sub('<email>', v)
        return v
    return v


def mine(rows):
    keep = []
    for j in rows:
        sid, dom = str(j.get('site_id') or ''), str(j.get('domain') or '').lower().replace('www.', '')
        key = str(j.get('key') or '')
        if sid == SITE or dom == DOMAIN or key.endswith(':' + SITE) or (not sid and not dom and not key):
            keep.append(j)
    return keep


def node_out(rd, name, i=0):
    try:
        return [x['json'] for x in rd[name][0]['data']['main'][i]]
    except (KeyError, IndexError, TypeError):
        return None


def cut(execf, names, site_only=True):
    rd = json.load(open(os.path.join(SRC, execf)))['data']['resultData']['runData']
    out = {}
    for n in names:
        rows = node_out(rd, n)
        if rows is None:
            continue
        if site_only and n.startswith('Load'):
            rows = mine(rows)
        out[n] = scrub(rows)
    return out


LOADS = ['Load Sites', 'Load Ladders', 'Load Monitors', 'Load Profiles', 'Load AI Prompts', 'Load AI Visibility', 'Load AI Daily', 'Load Cache (AI)']
w = cut('exec-776.json', ['Manual Run'] + LOADS + ['Load Query History', 'AI Plan', 'AI Requests', 'Apply Analysis'])
# keep the query history small: the long / question-shaped ones are all AI Plan reads
w['Load Query History'] = [q for q in (w.get('Load Query History') or []) if len(str(q.get('query') or '').split()) >= 4][:120]
w['Load AI Visibility'] = sorted(w.get('Load AI Visibility') or [], key=lambda r: str(r.get('checked_at')))[-3:]
p = cut('exec-779.json', ['Manual Run'] + LOADS + ['AI Plan', 'AI Requests', 'Pulse Metrics'])
p['Load AI Visibility'] = sorted(p.get('Load AI Visibility') or [], key=lambda r: str(r.get('checked_at')))[-2:]
for m in p.get('Pulse Metrics') or []:
    m.pop('html', None); m.pop('answer_rows', None)
fx = {'source': 'executions 776 (weekly AI visibility, 2026-10-17 16:29) and 779 (AI Pulse, 16:34) on techand.ai, re-rating 2026-10-17', 'weekly': w, 'pulse': p}
blob = json.dumps(fx, ensure_ascii=False)
assert '/api/hooks/n8n/' not in blob.replace('/api/hooks/n8n/<token>', ''), 'a hook token is left'
assert not EMAIL.search(blob.replace('<email>', '')), 'an e-mail address is left'
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with gzip.open(OUT, 'wt', encoding='utf-8') as f:
    f.write(blob)
print('wrote', OUT, len(blob), 'bytes;', {k: len(v) for k, v in w.items() if isinstance(v, list)}, {k: len(v) for k, v in p.items() if isinstance(v, list)})
