"""kit_inline.py: the one rule for inlining a shared kit WITHOUT its whole-line comments (CR17 deploy, 2026-11-18).

Why: the Keyword Intelligence workflow inlines seven kits into ~38 Code nodes each. With the CR17 competitor roles it reached 17.5 MB
and production's n8n refused the update (HTTP 413 Payload Too Large, limit 16 MiB). Whole-line `//` comments carry no code, so
build_ki.py inlines the kits without them (the kit files keep every comment).

The lints that cut an inlined kit out of a node before judging the node's own code (gate_lint, state_lint) must recognise this
form too, or they would read kit code as the node's own (the hole gate_lint had on 2026-10-15). They call `forms(src)`.
"""


def code_lines(js):
    """The kit without whole-line // comments and blank lines, or None when a template literal does not close (then the caller
    keeps the kit as it is). A line is a comment only outside every string and template literal."""
    out, in_tpl = [], False
    for line in js.split('\n'):
        stripped = line.strip()
        if not in_tpl and (stripped.startswith('//') or not stripped):
            continue
        out.append(line)
        i, q = 0, None   # ' " ` state across the line; outside quotes, // ends the code on this line
        while i < len(line):
            c = line[i]
            if in_tpl:
                if c == '\\':
                    i += 2
                    continue
                if c == '`':
                    in_tpl = False
            elif q:
                if c == '\\':
                    i += 2
                    continue
                if c == q:
                    q = None
            elif c in '\'"':
                q = c
            elif c == '`':
                in_tpl = True
            elif line.startswith('//', i):
                break
            i += 1
    return None if in_tpl else '\n'.join(out)


def forms(src):
    """Every form a kit's text can take inside a generated node: as written, rstripped, and without its comment lines."""
    out = [src, src.rstrip('\n')]
    c = code_lines(src.rstrip('\n'))
    if c:
        out.append(c)
    return out
