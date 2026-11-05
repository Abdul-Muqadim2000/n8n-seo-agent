"""AIR (the AI-ranking algorithm, docs/ai-ranking-2026-11-05/DESIGN.md §2.0 / §6.5, frozen in CONTRACTS.md §4): the side branch of the
AI Growth workflow between `Save AI Growth` and `Growth Report`.

OWNER: package P4 (shadow plumbing). The graph it adds (every AIR node `onError: continueRegularOutput`):

    Any Growth Row? (false) --+
    Save AI Growth -----------+--> AI Rank Gate -> Any AI Rank? --false--> Growth Report
                                                     \\--true--> Load AI Rank Cache -> AI Rank Live -> Any AI Rank Live? --false--> Growth Report
                                                                                           \\--true--> Ensure AI Rank {Runs,Questions,Actions,Sources,Priors} Table
       -> Load AI Rank Questions -> ... -> Load Link Prospects (Rank) -> [ai_rank_requests_wiring.wire_requests (P5)] -> AI Rank Plan
       -> AI Rank Run Row / Question Rows / Action Rows / Source Rows / Prior Rows (+ saves; shadow and on)
       -> AI Rank Target Rows / Prospect Rows / Prompt Rows + Core Rows / Cache Rows / Growth Patch (+ saves; `on` only)
       -> Prune AI Rank Actions -> Prune AI Rank Sources -> Growth Report          (Growth Report runs exactly once per run)

Rules (CONTRACTS.md §4 / §5, held by harness AIRG* and AP*):
  * with every site off, only `AI Rank Gate` and `Any AI Rank?` execute (the gate reads nothing: no table read is added to an off run);
  * the kill switch (seo_cache `air:kill`) is read right after the gate's IF (`Load AI Rank Cache` + `AI Rank Live`), see CONTRACTS.md D17;
  * shadow writes the five seo_ai_rank_* tables only; the sink builders return [{ skip: true }] unless the site is `on`;
  * every builder reads `AI Rank Plan` explicitly; every chain reaches `end` once.
"""
import json
from ladder_common import (DT_TYPE, DT_VERSION, dt_create_params, dt_insert_params, dt_get_all_where_params, dt_get_where_params, dt_upsert_params_keys,
                           dt_update_params, dt_delete_where_params,
                           AI_RANK_RUNS_TABLE, AI_RANK_RUNS_COLS, AI_RANK_QUESTIONS_TABLE, AI_RANK_QUESTIONS_COLS, AI_RANK_ACTIONS_TABLE, AI_RANK_ACTIONS_COLS,
                           AI_RANK_SOURCES_TABLE, AI_RANK_SOURCES_COLS, AI_RANK_PRIORS_TABLE, AI_RANK_PRIORS_COLS, AIR_ONLY_COLS,
                           AI_TARGETS_TABLE, AI_TARGETS_COLS, PROSPECT_TABLE, PROSPECT_COLS, AI_PROMPTS_TABLE, AI_PROMPTS_COLS, CACHE_TABLE, CACHE_COLS,
                           AI_GROWTH_TABLE, AI_GROWTH_COLS, AI_ANSWERS_TABLE, INDEX_PAGES_TABLE, AI_DAILY_TABLE, LISTINGS_TABLE, LINK_OUTREACH_TABLE)
import ai_rank_requests_wiring

X = dict(onError='continueRegularOutput')
LOAD = dict(alwaysOutputData=True, executeOnce=True, onError='continueRegularOutput')
SINCE = lambda days: '={{ new Date(Date.now() - ' + str(days) + ' * 864e5).toISOString() }}'
# the website the start names, else every website ('%'); `eq` for a named site (an exact match), `like '%'` otherwise - the same rule as
# build_monitors.py's SITE_SCOPE / scoped() (F2 E12, R-E2), copied here because this module is imported by build_monitors.py
_SITE = ("((t) => String(t.site_id || '').trim() || (String(t.domain || '').trim() ? 'site_' + String(t.domain).toLowerCase().trim()"
         ".replace(/^https?:\\/\\//, '').replace(/^www\\./, '').replace(/[\\/?#].*$/, '').replace(/[^a-z0-9]+/g, '-') : '%'))"
         "(Object.assign({}, $('Manual Run').first().json || {}, ($('Manual Run').first().json || {}).body || {}))")
SITE_EQ = ('site_id', "={{ (" + _SITE + ") === '%' ? 'like' : 'eq' }}", '={{ ' + _SITE + ' }}')
IFX = '{{ !$json.skip && !$json.error }}'
AIR_TABLES = [('Ensure AI Rank Runs Table', AI_RANK_RUNS_TABLE, AI_RANK_RUNS_COLS), ('Ensure AI Rank Questions Table', AI_RANK_QUESTIONS_TABLE, AI_RANK_QUESTIONS_COLS),
              ('Ensure AI Rank Actions Table', AI_RANK_ACTIONS_TABLE, AI_RANK_ACTIONS_COLS), ('Ensure AI Rank Sources Table', AI_RANK_SOURCES_TABLE, AI_RANK_SOURCES_COLS),
              ('Ensure AI Rank Priors Table', AI_RANK_PRIORS_TABLE, AI_RANK_PRIORS_COLS)]
COLS = lambda cols: [c for c, _ in cols]
# builder name, WHICH, its columns, its IF, its save node -> (table, how)
BUILDERS = [
    ('AI Rank Run Row', 'runs', COLS(AI_RANK_RUNS_COLS), 'Any AI Rank Run Row?', 'Save AI Rank Run', ('insert', AI_RANK_RUNS_TABLE, AI_RANK_RUNS_COLS, None)),
    ('AI Rank Question Rows', 'questions', COLS(AI_RANK_QUESTIONS_COLS), 'Any AI Rank Questions?', 'Save AI Rank Questions', ('upsert', AI_RANK_QUESTIONS_TABLE, AI_RANK_QUESTIONS_COLS, ['site_id', 'prompt_id'])),
    ('AI Rank Action Rows', 'actions', COLS(AI_RANK_ACTIONS_COLS), 'Any AI Rank Actions?', 'Save AI Rank Actions', ('upsert', AI_RANK_ACTIONS_TABLE, AI_RANK_ACTIONS_COLS, ['action_id'])),
    ('AI Rank Source Rows', 'sources', COLS(AI_RANK_SOURCES_COLS), 'Any AI Rank Sources?', 'Save AI Rank Sources', ('upsert', AI_RANK_SOURCES_TABLE, AI_RANK_SOURCES_COLS, ['site_id', 'url_key'])),
    ('AI Rank Prior Rows', 'priors', COLS(AI_RANK_PRIORS_COLS), 'Any AI Rank Priors?', 'Save AI Rank Priors', ('upsert', AI_RANK_PRIORS_TABLE, AI_RANK_PRIORS_COLS, ['prior_id'])),
    # `on` only (the builder returns [{ skip: true }] for a site in shadow)
    ('AI Rank Target Rows', 'targets', COLS(AI_TARGETS_COLS), 'Any AI Rank Targets?', 'Save AI Rank Targets', ('upsert', AI_TARGETS_TABLE, AI_TARGETS_COLS, ['target_id'])),
    ('AI Rank Prospect Rows', 'prospects', COLS(PROSPECT_COLS), 'Any AI Rank Prospects?', 'Save AI Rank Prospects', ('upsert', PROSPECT_TABLE, PROSPECT_COLS, ['site_id', 'prospect_domain', 'type'])),
    # D10: core_until has one writer (Set Core Until); the proposed questions leave it out
    ('AI Rank Prompt Rows', 'proposed', [c for c in COLS(AI_PROMPTS_COLS) if c not in AIR_ONLY_COLS['AI_PROMPTS']], 'Any AI Rank Proposed?', 'Save AI Rank Proposed',
     ('insert', AI_PROMPTS_TABLE, [(c, t) for c, t in AI_PROMPTS_COLS if c not in AIR_ONLY_COLS['AI_PROMPTS']], None)),
    ('AI Rank Core Rows', 'core', ['site_id', 'prompt_id', 'core_until'], 'Any AI Rank Core?', 'Set Core Until',
     ('update', AI_PROMPTS_TABLE, AI_PROMPTS_COLS, ([('prompt_id', '={{ $json.prompt_id }}'), ('site_id', '={{ $json.site_id }}')], {'core_until': '={{ $json.core_until }}'}))),
    ('AI Rank Cache Rows', 'cache', COLS(CACHE_COLS), 'Any AI Rank Cache?', 'Save AI Rank Cache', ('upsert', CACHE_TABLE, CACHE_COLS, ['key'])),
    ('AI Rank Growth Patch', 'growth', ['site_id', 'run_id', 'actions_json'], 'Any AI Rank Growth Patch?', 'Patch AI Growth Actions',
     ('update', AI_GROWTH_TABLE, AI_GROWTH_COLS, ([('site_id', '={{ $json.site_id }}'), ('run_id', '={{ $json.run_id }}')], {'actions_json': '={{ $json.actions_json }}'}))),
]
# the nodes of the side branch, for the harness (AP11) and the docs
NODES = (['AI Rank Gate', 'Any AI Rank?', 'Load AI Rank Cache', 'AI Rank Live', 'Any AI Rank Live?'] + [e[0] for e in AIR_TABLES]
         + ['Load AI Rank Questions', 'Load AI Rank Actions', 'Load AI Rank Sources', 'Load AI Rank Priors', 'Load AI Rank Runs', 'Load Index Pages (Rank)',
            'Load SERP Cache (Rank)', 'Load AI Daily (Rank)', 'Load AI Answers (Rank)', 'Load Listings (Rank)', 'Load Link Outreach (Rank)', 'Load Link Prospects (Rank)', 'AI Rank Plan']
         + [x for b in BUILDERS for x in (b[0], b[3], b[4])] + ['Prune AI Rank Actions', 'Prune AI Rank Sources'])
SHADOW_TABLES = [t for _, t, _ in AIR_TABLES]


def wire(G, after_iff, after_save, end, pos):
    """G: the AI Growth `WF` of build_monitors.py; after_iff: 'Any Growth Row?' (its output 0 is already linked to after_save);
    after_save: 'Save AI Growth'; end: 'Growth Report'; pos: [x, y] where the AIR nodes start (at(60, 3))."""
    x0, y0 = pos
    at = lambda c, r=0: [x0 + c * 220, y0 + r * 220]
    def iff(name, expr, p):
        n = G.iff(name, expr, p); n.update(X); return n
    # ---- the gate: the only AIR nodes an off run executes ----
    G.code('AI Rank Gate', 'AI_Rank_Gate.js', at(0), **X)
    iff('Any AI Rank?', IFX, at(1))
    G.link(after_iff, 'AI Rank Gate', 1); G.link(after_save, 'AI Rank Gate'); G.link('AI Rank Gate', 'Any AI Rank?'); G.link('Any AI Rank?', end, 1)
    # ---- the kill switch (D17): read only when a site would run ----
    G.node('Load AI Rank Cache', DT_TYPE, DT_VERSION, dt_get_where_params(CACHE_TABLE, 'kind', 'eq', 'air'), at(2), **LOAD)
    G.code('AI Rank Live', 'AI_Rank_Live.js', at(3), **X)
    iff('Any AI Rank Live?', IFX, at(4))
    G.link('Any AI Rank?', 'Load AI Rank Cache', 0); G.chain('Load AI Rank Cache', 'AI Rank Live', 'Any AI Rank Live?'); G.link('Any AI Rank Live?', end, 1)
    # ---- the five AIR tables, then what AIR reads that AI Growth did not load already ----
    for i, (nm, t, c) in enumerate(AIR_TABLES): G.node(nm, DT_TYPE, DT_VERSION, dt_create_params(t, c), at(5 + i, 1), onError='continueRegularOutput', executeOnce=True)
    loads = [('Load AI Rank Questions', dt_get_all_where_params(AI_RANK_QUESTIONS_TABLE, [SITE_EQ])),
             ('Load AI Rank Actions', dt_get_all_where_params(AI_RANK_ACTIONS_TABLE, [SITE_EQ])),
             ('Load AI Rank Sources', dt_get_all_where_params(AI_RANK_SOURCES_TABLE, [SITE_EQ])),
             ('Load AI Rank Priors', {'resource': 'row', 'operation': 'get', 'dataTableId': {'__rl': True, 'mode': 'name', 'value': AI_RANK_PRIORS_TABLE}, 'returnAll': True, 'options': {}}),
             ('Load AI Rank Runs', dt_get_all_where_params(AI_RANK_RUNS_TABLE, [SITE_EQ, ('checked_at', 'gte', SINCE(84))])),
             ('Load Index Pages (Rank)', dt_get_all_where_params(INDEX_PAGES_TABLE, [SITE_EQ])),
             ('Load SERP Cache (Rank)', dt_get_where_params(CACHE_TABLE, 'kind', 'eq', 'serp')),
             ('Load AI Daily (Rank)', dt_get_all_where_params(AI_DAILY_TABLE, [SITE_EQ, ('checked_at', 'gte', SINCE(60))])),
             ('Load AI Answers (Rank)', dt_get_all_where_params(AI_ANSWERS_TABLE, [SITE_EQ, ('checked_at', 'gte', SINCE(28))])),   # P1: the source graph reads 28 days
             ('Load Listings (Rank)', dt_get_all_where_params(LISTINGS_TABLE, [SITE_EQ])),
             ('Load Link Outreach (Rank)', dt_get_all_where_params(LINK_OUTREACH_TABLE, [SITE_EQ])),
             ('Load Link Prospects (Rank)', dt_get_all_where_params(PROSPECT_TABLE, [SITE_EQ]))]
    for i, (nm, params) in enumerate(loads): G.node(nm, DT_TYPE, DT_VERSION, params, at(10 + i, 1), **LOAD)
    G.link('Any AI Rank Live?', AIR_TABLES[0][0], 0)
    G.chain(*[e[0] for e in AIR_TABLES], *[l[0] for l in loads])
    ai_rank_requests_wiring.wire_requests(G, loads[-1][0], 'AI Rank Plan', at(21, 2))
    G.code('AI Rank Plan', 'AI_Rank_Plan.js', at(22), **X)
    # ---- the builders and their saves (gstep's shape: builder -> IF -> save -> next; IF false -> next) ----
    for i, (bname, which, cols, ifname, save, (op, table, tcols, key)) in enumerate(BUILDERS):
        n = G.code(bname, 'AI_Rank_Rows.js', at(23 + 2 * i), **X)
        js = n['parameters']['jsCode']
        assert js.count("'__AIR_WHICH__'") == 1 and js.count('__AIR_COLS__') == 1, 'AIR: AI_Rank_Rows.js lost its placeholders'
        n['parameters']['jsCode'] = js.replace("'__AIR_WHICH__'", json.dumps(which)).replace('__AIR_COLS__', json.dumps(cols))
        # the run row carries an `error` column by design (the kit that was missing): its IF asks for the row, not for the absence of `error`
        iff(ifname, '{{ !$json.skip && !!$json.run_id }}' if which == 'runs' else IFX, at(24 + 2 * i))
        if op == 'insert': params = dt_insert_params(table, tcols)
        elif op == 'upsert': params = dt_upsert_params_keys(table, tcols, key)
        else: params = dt_update_params(table, tcols, key[0], key[1])
        # a save always hands on an item (an update that matched no row answers with nothing, which would end the run before the report)
        G.node(save, DT_TYPE, DT_VERSION, params, at(24 + 2 * i, -1), alwaysOutputData=True, **X)
        if i == 0: G.link('AI Rank Plan', bname)
        G.link(bname, ifname); G.link(ifname, save, 0)
        nxt = BUILDERS[i + 1][0] if i + 1 < len(BUILDERS) else 'Prune AI Rank Actions'
        G.link(ifname, nxt, 1); G.link(save, nxt)
    # ---- size (CONTRACTS.md §2.2): expired actions and sources nobody cited for 120 days are removed; then the report, once ----
    G.node('Prune AI Rank Actions', DT_TYPE, DT_VERSION, dt_delete_where_params(AI_RANK_ACTIONS_TABLE, [SITE_EQ, ('status', 'eq', 'expired'), ('updated_at', 'lt', SINCE(120))]),
           at(23 + 2 * len(BUILDERS)), **dict(LOAD))
    G.node('Prune AI Rank Sources', DT_TYPE, DT_VERSION, dt_delete_where_params(AI_RANK_SOURCES_TABLE, [SITE_EQ, ('last_seen', 'lt', SINCE(120))]),
           at(24 + 2 * len(BUILDERS)), **dict(LOAD))
    G.chain('Prune AI Rank Actions', 'Prune AI Rank Sources', end)
