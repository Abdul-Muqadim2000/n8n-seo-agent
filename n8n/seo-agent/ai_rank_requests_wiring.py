"""AIR (docs/ai-ranking-2026-11-05/DESIGN.md §2.I / §6.6, frozen in CONTRACTS.md §4 / §6): the requests AIR makes to outside services in the AI
Growth workflow (wave 2): DataForSEO LLM Mentions (monthly), fan-out results pages (Google and Bing) through the SERP cache, Bing Webmaster
stats, Common Crawl CDX, Brave Search. SerpApi Copilot was NOT approved (owner, 2026-11-06) and is not built (no node, no credential).

OWNER: package P5 (integrations; fixes/P5.md). Called by P4's ai_rank_wiring.wire() between `Load Link Prospects (Rank)` (src) and
`AI Rank Plan` (dst). The chain (every node `onError: continueRegularOutput`; each request node answers [{ skip: true }] when it has nothing,
so its IF sends nothing and the chain goes on; one branch of each IF carries items, so every node runs once):

    src -> AI Rank Requests (plan: on sites only)
        -> AI Rank Mention Requests -> Any AI Rank Mentions? -> AI Rank Mentions Call  [in-200 gate, no node retry]   (DataForSEO, paid)
        -> AI Rank Bing Requests    -> Any AI Rank Bing?     -> AI Rank Bing Call      [retry rule]                  (Bing Webmaster, free)
        -> AI Rank SERP Requests    -> Any AI Rank SERP?     -> AI Rank SERP Call      [in-200 gate, no node retry]   (DataForSEO, paid)
        -> AI Rank CC Requests      -> Any AI Rank CC?       -> AI Rank CC Collections [retry rule]                  (Common Crawl, free)
        -> AI Rank CC Index Requests -> Any AI Rank CC Index? -> AI Rank CC Index Call [retry rule]                  (Common Crawl, free)
        -> AI Rank Brave Requests   -> Any AI Rank Brave?    -> AI Rank Brave Call     [retry rule]                  (Brave, keyed)
        -> AI Rank Fetched (one item per on site: CONTRACTS.md §6 + cache_rows) -> AI Rank Fetch Rows -> Any AI Rank Fetch Rows?
        -> Save AI Rank Fetch Cache (seo_cache upsert by key) -> dst

Rules (CONTRACTS.md §4 / §5 / §6, held by harness AI1-AI10):
  * nothing outside is read for a site in shadow or off: the planner plans only where AIRF.mayPay (mode `on`, not killed), so the shadow
    golden (AP3) keeps every outside request identical to the off run;
  * paid DataForSEO calls go through G.in200_gate (dfs_gate.splice) with no node-level retry (retry_lint's N3 rule strips it); free and keyed
    calls carry retry_lint.RETRY;
  * Brave: the key SEO_BRAVE_API_KEY is baked as BRAVE_ENABLED (env_settings.py). Without it the planner and the request node are built with
    `false` and never ask for a Brave search; the node and its credential reference stay in the workflow (as the Bing and Ahrefs nodes do),
    so the import never fails;
  * `AI Rank Fetched` states `cost_usd` (DataForSEO, once per task id); the ledger settle reads it (measured = 'Growth Metrics|AI Rank Fetched');
  * no node calls generativelanguage.googleapis.com or serpapi.com (AIRW0-6 / AI10).
"""
import json

import retry_lint
from env_settings import BRAVE_ENABLED
from ladder_common import DT_TYPE, DT_VERSION, dt_upsert_params_keys, CACHE_TABLE, CACHE_COLS

X = dict(onError='continueRegularOutput')
IFX = '{{ !$json.skip && !$json.error }}'
BING = ('httpQueryAuth', 'SEOcredBingWebm', 'Bing Webmaster API')
BRAVE = ('httpHeaderAuth', 'SEOcredBraveApi1', 'Brave Search API')
# (call, request node, IF, HTTP node, kind) in chain order; kind: dfs (paid, gated) | get (JSON) | text (full response, text)
CALLS = [
    ('mentions', 'AI Rank Mention Requests', 'Any AI Rank Mentions?', 'AI Rank Mentions Call', 'dfs'),
    ('bing', 'AI Rank Bing Requests', 'Any AI Rank Bing?', 'AI Rank Bing Call', 'get'),
    ('serp', 'AI Rank SERP Requests', 'Any AI Rank SERP?', 'AI Rank SERP Call', 'dfs'),
    ('cc', 'AI Rank CC Requests', 'Any AI Rank CC?', 'AI Rank CC Collections', 'get'),
    ('cc_index', 'AI Rank CC Index Requests', 'Any AI Rank CC Index?', 'AI Rank CC Index Call', 'text'),
    ('brave', 'AI Rank Brave Requests', 'Any AI Rank Brave?', 'AI Rank Brave Call', 'get'),
]
GATED = {'AI Rank Mentions Call': ('the pages AI answers cite for the website\'s topic, and its own mention count (LLM Mentions)', 'task'),
         'AI Rank SERP Call': ('the results pages of the searches the AI engines run for its questions', 'results page')}
CC_UA = 'AlaventraAIR/1.0 (Common Crawl index presence check)'
# the nodes of this chain, for the harness (AI1-AI10) and the docs; the in-200 gate adds five nodes behind each gated call
NODES = ['AI Rank Requests'] + [x for c in CALLS for x in c[1:4]] + ['AI Rank Fetched', 'AI Rank Fetch Rows', 'Any AI Rank Fetch Rows?', 'Save AI Rank Fetch Cache']

FETCH_ROWS_JS = ('// AIR (P5): the seo_cache rows AI Rank Fetched kept for the websites in mode on - the Google results pages (the shared SERP cache, with\n'
                 '// the site id), this week\'s budget marker, the month\'s LLM Mentions marker, the Common Crawl reading - with exactly the table\'s\n'
                 '// columns, one row per key (the last wins). [{ skip: true }] when there is none, so its IF sends nothing.\n'
                 'const COLS = ' + json.dumps([c for c, _ in CACHE_COLS]) + ';\n'
                 "const rows = []; try { for (const i of $('AI Rank Fetched').all()) for (const r of (((i && i.json) || {}).cache_rows || [])) rows.push(Object.fromEntries(COLS.map(c => [c, r[c] === undefined ? null : r[c]]))); } catch (e) {}\n"
                 'const one = new Map(); for (const r of rows) if (r.key) one.set(r.key, r);\n'
                 'return one.size ? [...one.values()].map(r => ({ json: r })) : [{ json: { skip: true } }];')


def _bake(n, subs):
    js = n['parameters']['jsCode']
    for k, v in subs:
        assert js.count(k) == 1, 'AIR P5: %s carries %r %d times (expected once)' % (n['name'], k, js.count(k))
        js = js.replace(k, v)
    n['parameters']['jsCode'] = js
    return n


def _get(G, name, pos, cred=None, text=False, interval=300, timeout=30000, headers=None):
    params = {'method': 'GET', 'url': '={{ $json.url }}',
              'options': {'batching': {'batch': {'batchSize': 1, 'batchInterval': interval}}, 'timeout': timeout,
                          'response': {'response': ({'fullResponse': True, 'neverError': True, 'responseFormat': 'text'} if text else {'neverError': True})}}}
    if headers:
        params.update({'sendHeaders': True, 'headerParameters': {'parameters': [{'name': k, 'value': v} for k, v in headers.items()]}})
    extra = {}
    if cred:
        kind, cid, cname = cred
        params.update({'authentication': 'genericCredentialType', 'genericAuthType': kind})
        extra['credentials'] = {kind: {'id': cid, 'name': cname}}
    return G.node(name, 'n8n-nodes-base.httpRequest', 4.5, params, pos, onError='continueRegularOutput', **retry_lint.RETRY, **extra)


def wire_requests(G, src, dst, pos):
    """G: the AI Growth `WF`; src: 'Load Link Prospects (Rank)'; dst: 'AI Rank Plan'; pos: [x, y] for the request nodes."""
    x0, y0 = pos
    at = lambda c, r=0: [x0 + c * 220, y0 + 440 + r * 220]
    brave = 'true' if BRAVE_ENABLED else 'false'
    _bake(G.code('AI Rank Requests', 'AI_Rank_Requests.js', at(0), **X), [('__AIR_BRAVE_ON__', brave)])
    G.chain(src, 'AI Rank Requests', CALLS[0][1])
    for i, (call, req, iff, http, kind) in enumerate(CALLS):
        c = 1 + 3 * i
        _bake(G.code(req, 'AI_Rank_Calls.js', at(c), **X), [("'__AIR_CALL__'", json.dumps(call)), ('__AIR_BRAVE_ON__', brave)])
        n = G.iff(iff, IFX, at(c + 1)); n.update(X)
        if kind == 'dfs':
            G.dfs_http(http, at(c + 2, -1), batch=1, interval=300, timeout=90000)
        elif call == 'bing':
            _get(G, http, at(c + 2, -1), cred=BING, interval=400)
        elif call == 'brave':
            _get(G, http, at(c + 2, -1), cred=BRAVE, interval=1100, timeout=20000, headers={'Accept': 'application/json'})
        else:
            _get(G, http, at(c + 2, -1), text=(kind == 'text'), interval=1000, timeout=60000, headers={'User-Agent': CC_UA})
        G.link(req, iff); G.link(iff, http, 0)
        nxt = CALLS[i + 1][1] if i + 1 < len(CALLS) else 'AI Rank Fetched'
        G.link(iff, nxt, 1); G.link(http, nxt)
    c = 1 + 3 * len(CALLS)
    G.code('AI Rank Fetched', 'AI_Rank_Fetched.js', at(c), **X)
    G.code('AI Rank Fetch Rows', FETCH_ROWS_JS, at(c + 1), **X)
    n = G.iff('Any AI Rank Fetch Rows?', IFX, at(c + 2)); n.update(X)
    G.node('Save AI Rank Fetch Cache', DT_TYPE, DT_VERSION, dt_upsert_params_keys(CACHE_TABLE, CACHE_COLS, ['key']), at(c + 2, -1), alwaysOutputData=True, **X)
    G.chain('AI Rank Fetched', 'AI Rank Fetch Rows', 'Any AI Rank Fetch Rows?')
    G.link('Any AI Rank Fetch Rows?', 'Save AI Rank Fetch Cache', 0); G.link('Any AI Rank Fetch Rows?', dst, 1); G.link('Save AI Rank Fetch Cache', dst)
    # the in-200 gate around each paid call, now that every connection and every reader (AI Rank Fetched) exists; the splice re-points
    # AI Rank Fetched's reads of the call to the merged answers. The gate's own nodes get the AIR rule too: a failure there becomes an
    # { error } item (AI Rank Fetched then cannot pair the call and reads nothing of it), never a stopped run before Growth Report.
    for http, (what, unit) in GATED.items():
        g = G.in200_gate(http, what, unit)
        for nm in g['chain']:
            nd = next(n for n in G.N if n['name'] == nm)
            nd.setdefault('onError', 'continueRegularOutput')
