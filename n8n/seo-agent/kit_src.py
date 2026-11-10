"""Kit sources assembled from more than one file (client reports 2026-11-10): one copy of each table, inlined where a kit needs it."""
import re

FIT_PLACES_MARKER = '/*__FIT_PLACES_SRC__*/[]'


def fit_places_literal(fit_gate_src):
    """The array literal of FIT_PLACES_SRC in v5/code/_fit_gate.js (the gazetteer of the fit gate)."""
    m = re.search(r'const FIT_PLACES_SRC = (\[[\s\S]*?\]\]);', fit_gate_src)
    assert m, 'kit_src: _fit_gate.js has no FIT_PLACES_SRC array'
    lit = m.group(1)
    assert "['AE'," in lit and "['PK'," in lit, 'kit_src: FIT_PLACES_SRC lost its countries'
    return lit


def dup_src(read):
    """v5/code/_dup_targets.js with the fit gate's gazetteer in place of its marker. `read(path)` reads a v5 file."""
    src = read('code/_dup_targets.js')
    assert src.count(FIT_PLACES_MARKER) == 1, 'kit_src: _dup_targets.js must carry %s once' % FIT_PLACES_MARKER
    return src.replace(FIT_PLACES_MARKER, fit_places_literal(read('code/_fit_gate.js'))).rstrip('\n')
