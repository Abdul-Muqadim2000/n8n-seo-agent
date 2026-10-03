#!/usr/bin/env python3
"""Exports what build_docs.py needs from the running n8n into docs/runs/: the node trace of chosen executions (nodes_<id>.tsv, one line per
node in execution order: name, runs, items, time, error), their metadata (appended to list.tsv) and the published state of every workflow
(workflow_state.json). Reads N8N_API_KEY from n8n/.env (never printed). Usage: python3 capture_runs.py 132 136 140 ..."""
import json, os, sys, urllib.request
from env_settings import load_env
HERE = os.path.dirname(os.path.abspath(__file__)); RUNS = os.path.join(HERE, 'docs', 'runs'); os.makedirs(RUNS, exist_ok=True)
KEY = load_env().get('N8N_API_KEY', ''); BASE = 'http://localhost:5678/api/v1'
def get(path):
    req = urllib.request.Request(BASE + path, headers={'X-N8N-API-KEY': KEY})
    with urllib.request.urlopen(req, timeout=60) as r: return json.loads(r.read().decode('utf-8'))
if not KEY: sys.exit('N8N_API_KEY missing in n8n/.env')
# published state of every workflow
state = {w['id']: {'name': w['name'], 'active': bool(w.get('active'))} for w in get('/workflows?limit=250').get('data', [])}
json.dump(state, open(os.path.join(RUNS, 'workflow_state.json'), 'w'), indent=1)
print('workflow states:', sum(1 for v in state.values() if v['active']), 'published of', len(state))
# execution traces
lst = os.path.join(RUNS, 'list.tsv'); known = set()
if os.path.exists(lst): known = {l.split('\t')[0] for l in open(lst) if l.strip()}
ts = lambda s: str(s or '-').replace('T', ' ').replace('Z', '')[:23]
for eid in sys.argv[1:]:
    e = get(f'/executions/{eid}?includeData=true'); rd = (((e.get('data') or {}).get('resultData') or {}).get('runData')) or {}
    rows = []
    for name, runs in rd.items():
        items = sum(len(o or []) for r in runs for o in ((r.get('data') or {}).get('main') or []))
        ms = sum(int(r.get('executionTime') or 0) for r in runs); err = next((str((r.get('error') or {}).get('message', ''))[:240] for r in runs if r.get('error')), '')
        rows.append((min(int(r.get('startTime') or 0) for r in runs), name, len(runs), items, ms, err))
    rows.sort()
    with open(os.path.join(RUNS, f'nodes_{eid}.tsv'), 'w') as f:
        for _, name, n, items, ms, err in rows: f.write(f"{name}\truns={n}\titems={items}\t{ms}ms" + (f"\t{err}" if err else '') + '\n')
    last = ((e.get('data') or {}).get('resultData') or {}).get('lastNodeExecuted', '')
    if str(eid) not in known:
        with open(lst, 'a') as f: f.write('\t'.join([str(eid), e.get('workflowId', ''), e.get('status', ''), e.get('mode', ''), ts(e.get('startedAt')), ts(e.get('stoppedAt')), last]) + '\n')
    print(f'execution {eid}: {e.get("workflowId")} {e.get("status")} {len(rows)} nodes')
