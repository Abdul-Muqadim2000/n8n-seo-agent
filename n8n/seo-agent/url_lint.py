"""D15 (system review of 2026-10-11, FIX_PLAN.md): one canonical host for every URL the agent emits.

Every URL we hand out or store (ladder target_url, internal links, canonical / schema URLs, the IndexNow key file, Bing
submissions, Link Builder targets, audit candidates, profile delivery links) must be built with the site model's canonical
host -- `SM.siteUrl(model, path)` from `v5/code/_site_model.js` (SITE_MODEL_SPEC.md) -- not glued together from the bare
domain, which 308-redirects on a www site and made the audit flag "links pointing to redirects".

This lint runs at the end of the builders over the generated Code nodes and fails the build when a node still writes
`'https://' + domain` (or `+ dom` / `+ site_host` / `` `https://${domain}` ``). API payloads keep the bare domain through
`SM.apiTarget(model)`, which this lint does not touch.
"""
import re

# 'https://' or 'http://' (with or without a 'www.' of its own) glued to an expression naming the site's own bare domain
_OWN = r'(?:domain|dom|site_host|site_domain|d)'
_CONCAT = re.compile(r"""(['"])https?://(?:www\.)?\1\s*\+\s*(?:[A-Za-z_$][\w$]*\s*\.\s*)*""" + _OWN + r"\b")
_TEMPLATE = re.compile(r"`https?://(?:www\.)?\$\{\s*(?:[A-Za-z_$][\w$]*\s*\.\s*)*" + _OWN + r"\s*[}+]")

# The allow-list: nodes that must name a host themselves, with the reason. Keep it small -- everything else goes through the kit.
ALLOW = {
    # the three nodes that *find* the canonical host: they probe both hosts on purpose, before any model exists
    'Build Probes': 'host probes: apex and www are requested side by side (no redirects followed) to see which host is canonical',
    'Content Probes': 'robots / sitemap / llms.txt are read on the audited host before Analyze Probes has decided the canonical one',
    'Analyze Probes': 'decides canonical_host and words the www / non-www findings, which have to name both hosts (D6)',
}


def findings(nodes, where):
    """nodes: iterable of (node name, jsCode). Returns a list of human-readable findings."""
    out = []
    for name, src in nodes:
        if name in ALLOW or not src:
            continue
        for rx in (_CONCAT, _TEMPLATE):
            for m in rx.finditer(src):
                line = src.count('\n', 0, m.start()) + 1
                out.append('%s / %s (line %d): %s -- build it with SM.siteUrl(model, path) (D15, SITE_MODEL_SPEC.md)'
                           % (where, name, line, src[m.start():m.start() + 60].split('\n')[0]))
    return out


def check(workflow, where=None):
    """Lints one workflow dict (or a list of nodes) and raises AssertionError on the first node that builds its own host."""
    if isinstance(workflow, dict):
        nodes = [(n['name'], (n.get('parameters') or {}).get('jsCode', '')) for n in workflow.get('nodes', [])
                 if n.get('type') == 'n8n-nodes-base.code']
        where = where or workflow.get('name') or workflow.get('id') or 'workflow'
    else:
        nodes = list(workflow)
        where = where or 'nodes'
    bad = findings(nodes, where)
    assert not bad, 'D15 canonical-host lint: %d node(s) build a site URL by hand\n  ' % len(bad) + '\n  '.join(bad)
    return len(nodes)
