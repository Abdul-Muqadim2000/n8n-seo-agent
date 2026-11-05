"""AIR (the AI-ranking algorithm, docs/ai-ranking-2026-11-05/DESIGN.md §2.0 / §6.5, frozen in CONTRACTS.md §4): the side branch of the
AI Growth workflow between `Save AI Growth` and `Growth Report`.

OWNER: package P4 (shadow plumbing). W0 (the contract commit) wrote this skeleton: it makes exactly the two links the old
`gstep('AI Growth Row', 'Any Growth Row?', 'Save AI Growth', 'Growth Report')` made after the IF, so the generated graph is the same as
before AIR. build_monitors.py itself links `AI Growth Row -> Any Growth Row?` and `Any Growth Row? (true) -> Save AI Growth`.

P4 replaces the body with:
    after_iff (false, output 1) -> AI Rank Gate      and      after_save -> AI Rank Gate
    AI Rank Gate -> Any AI Rank? -- false --> end
                               \\-- true --> Ensure AI Rank ... Tables -> loads -> ai_rank_requests_wiring.wire_requests(G, 'Load Link
                                   Prospects (Rank)', 'AI Rank Plan', pos) -> AI Rank Plan -> row builders -> saves -> end
Rules P4 must keep (CONTRACTS.md §4): every AIR node onError continueRegularOutput; with every site off only `AI Rank Gate` and
`Any AI Rank?` execute; the chain always reaches `end` exactly once per run (the AIR golden test, harness scenarios_air_golden.js).
"""


def wire(G, after_iff, after_save, end, pos):
    """G: the AI Growth `WF` of build_monitors.py; after_iff: 'Any Growth Row?' (its output 0 is already linked to after_save);
    after_save: 'Save AI Growth'; end: 'Growth Report'; pos: [x, y] where the AIR nodes may start (at(60, 3)).
    W0 skeleton: the graph is identical to the one before AIR."""
    G.link(after_iff, end, 1)
    G.link(after_save, end)
