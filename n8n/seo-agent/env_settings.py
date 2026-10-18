"""Reads n8n/.env (the SEO_* settings) for the builders: brand, sender, ops address and the Google service-account e-mail are baked into
the generated workflows at build time (n8n blocks $env access in nodes by default, so the workflows carry literals). Run
`python3 apply_env.py` after editing .env: it rebuilds, syncs the credentials and re-imports."""
import os
HERE = os.path.dirname(os.path.abspath(__file__)); ENV_FILE = os.path.join(HERE, '..', '.env')
def load_env(path=ENV_FILE):
    env = {}
    if not os.path.exists(path): return env
    for line in open(path, encoding='utf-8'):
        line = line.rstrip('\n')
        if not line or line.lstrip().startswith('#') or '=' not in line: continue
        k, v = line.split('=', 1); k = k.strip(); v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in '"\'': v = v[1:-1]
        env[k] = v
    return env
ENV = load_env()
BRAND = ENV.get('SEO_BRAND') or 'Alaventra'
SENDER = ENV.get('SEO_MAIL_FROM') or 'Dev SEO <kinnngahmed@gmail.com>'
OPS_EMAIL = ENV.get('SEO_OPS_EMAIL') or 'kinnngahmed@gmail.com'
SA_EMAIL = ENV.get('SEO_GOOGLE_SA_EMAIL') or ''

# =============================================================================
# B-F5 (2026-10-15, FIX_PLAN §3.15): a build with no settings file must refuse, not bake its fallbacks
# -----------------------------------------------------------------------------
# `load_env()` returns {} when the file is missing and says nothing about it, so every value below silently became its fallback --
# brand "Dev SEO", a sender and an ops address belonging to nobody, an EMPTY Google service-account e-mail -- and the build exited 0
# having baked them into eleven workflows. `n8n/.env` is gitignored, so a git worktree never has one: every worktree agent of the five
# days to 2026-10-15 built that way, and the only thing that contained it was "always rebuild in the main worktree after a merge" --
# which the id churn of build_api.py hid, because a defaults-bake could not be told from a fresh uuid4 on every node by eye.
# The build refuses now. `SEO_BUILD_ALLOW_DEFAULTS=1` (or `--no-env` on the builder's command line) is the deliberate offline build:
# it is allowed, it is loud, and it says in the log exactly which settings it is inventing.
# =============================================================================
BAKED = (
    ('SEO_BRAND', 'the brand name printed on every report, e-mail and PDF'),
    ('SEO_MAIL_FROM', 'the From: identity of every e-mail the engine sends'),
    ('SEO_OPS_EMAIL', 'the address an ops alert is sent to'),
    ('SEO_GOOGLE_SA_EMAIL', 'the Google service account Search Console and GA4 are read with (empty = no Google data at all)'),
)
# Settings that are optional by design but still change the generated workflows when absent: the build says which way they went, so a
# log makes it obvious that this build turned a source off. They are NOT required -- the file being there is what is required.
FLAGS = ('SEO_BING_WEBMASTER_API_KEY', 'SEO_AHREFS_API_KEY')


def _opted_out(argv=None):
    import sys as _sys
    v = (os.environ.get('SEO_BUILD_ALLOW_DEFAULTS') or '').strip().lower()
    if v and v not in ('0', 'no', 'false', 'off'):
        return 'SEO_BUILD_ALLOW_DEFAULTS'
    if '--no-env' in list(argv if argv is not None else _sys.argv[1:]):
        return '--no-env'
    return ''


opted_out = _opted_out   # build_v4.py passes the decision on to the four sub-builds it spawns, so they never have to guess it


def require_settings(builder, path=ENV_FILE, env=None, argv=None, raise_only=False, quiet=False):
    """Called by every builder before it writes a workflow. Returns the state it checked; raises SystemExit (or RuntimeError when
    `raise_only`, which is how the build self-tests it) when the settings file is missing or a baked setting is empty."""
    env = ENV if env is None else env
    out = _opted_out(argv)
    missing = [(k, why) for k, why in BAKED if not (env.get(k) or '').strip()]
    present = os.path.exists(path)
    state = {'builder': builder, 'path': os.path.normpath(path), 'file_present': present, 'opt_out': out,
             'missing': [k for k, _w in missing], 'refused': False,
             'flags': {k: bool((env.get(k) or '').strip()) for k in FLAGS}}
    if present and not missing:
        return state
    state['refused'] = not out
    if out:
        if quiet:
            return state
        print('  ! %s: building WITHOUT the settings file (%s). These are invented, not yours: %s%s'
              % (builder, out, ', '.join(k for k, _w in missing) or 'none',
                 '' if present else ' — and ' + state['path'] + ' does not exist'))
        for k in FLAGS:
            if not (env.get(k) or '').strip():
                print('    · %s is not set, so the source it switches on is baked OFF' % k)
        return state
    lines = ['', '=' * 100,
             'BUILD REFUSED (B-F5): %s cannot bake the settings it is asked to bake.' % builder,
             '  settings file: %s  —  %s' % (state['path'], 'present' if present else 'DOES NOT EXIST'), '']
    if not present:
        lines += ['  A git worktree never has n8n/.env: it is gitignored, so it exists only in the main checkout.',
                  '  Without it the build does not fail — it bakes a brand, a sender, an ops address and an EMPTY Google',
                  '  service-account e-mail into eleven workflows, and exits 0. That is what this refusal is for.', '']
    for k, why in missing:
        lines.append('  not set: %-28s %s' % (k, why))
    lines += ['',
              '  What to do, whichever applies:',
              '    * building to deploy  -> build in the main checkout (or copy n8n/.env there, never commit it), then',
              '                             `python3 apply_env.py`, which rebuilds with the settings and imports.',
              '    * building to test code (the harness, a lint, a diff) -> say so:',
              '                             SEO_BUILD_ALLOW_DEFAULTS=1 python3 %s        (or pass --no-env)' % builder,
              '                             The workflows it writes carry invented identities: do not import or commit them.',
              '=' * 100, '']
    msg = '\n'.join(lines)
    if raise_only:
        raise RuntimeError(msg)
    raise SystemExit(msg)


def guard_selftest():
    """What build section 69 records for harness S79: the refusal has to fire, and both opt-outs have to work.

    The whole self-test runs with the ambient opt-out REMOVED and restored afterwards — otherwise a build run under
    `SEO_BUILD_ALLOW_DEFAULTS=1` (which is how anyone tests this code from a worktree) would self-test nothing: every refusal
    case would come back `refused: False` and the assertion that proves the refusal would be the thing that fails."""
    import tempfile
    ambient = os.environ.pop('SEO_BUILD_ALLOW_DEFAULTS', None)
    try:
        return _guard_selftest_body(tempfile)
    finally:
        if ambient is not None:
            os.environ['SEO_BUILD_ALLOW_DEFAULTS'] = ambient


def _guard_selftest_body(tempfile):
    good = {k: 'x' for k, _w in BAKED}
    res = {}
    with tempfile.NamedTemporaryFile(suffix='.env') as t:
        for name, kw in (('missing_file', dict(path=os.path.join(os.path.dirname(t.name), '__no_such_env__'), env=good)),
                         ('empty_setting', dict(path=t.name, env={k: '' for k, _w in BAKED})),
                         ('one_empty_setting', dict(path=t.name, env=dict(good, SEO_GOOGLE_SA_EMAIL=''))),
                         ('all_present', dict(path=t.name, env=good))):
            try:
                st = require_settings('selftest', argv=[], raise_only=True, **kw)
                res[name] = {'refused': False, 'missing': st['missing']}
            except RuntimeError as e:
                res[name] = {'refused': True, 'says_path': os.path.normpath(kw['path']) in str(e),
                             'says_what_to_do': 'SEO_BUILD_ALLOW_DEFAULTS=1' in str(e),
                             'missing': [k for k, _w in BAKED if not (kw['env'].get(k) or '').strip()]}
        # both opt-outs: the same refused call must come back instead of raising, once for the flag and once for the variable
        nowhere = os.path.join(os.path.dirname(t.name), '__no_such_env__')
        for name, argv, var in (('opt_out_flag', ['--no-env'], None), ('opt_out_variable', [], '1')):
            if var is not None:
                os.environ['SEO_BUILD_ALLOW_DEFAULTS'] = var
            try:
                st = require_settings('selftest', path=nowhere, env={}, argv=argv, raise_only=True, quiet=True)
                res[name] = {'refused': False, 'opt_out': st['opt_out'], 'missing': st['missing']}
            except RuntimeError:
                res[name] = {'refused': True}
            finally:
                if var is not None:
                    os.environ.pop('SEO_BUILD_ALLOW_DEFAULTS', None)
    # the recorded path is the RELATIVE one on purpose (R29's lesson): a file the harness reads must not carry the building machine
    return {'baked': [k for k, _w in BAKED], 'flags': list(FLAGS), 'env_file': 'n8n/.env', 'cases': res}


# A builder that forgets to call require_settings is the hole this was written to close, so importing these settings from a
# `build_*.py` IS the call. (Only the builders match: run_report.py, sync_tables.py, fix_brand_rungs.py and the other scripts read
# `load_env()` for an API key and must keep working from a worktree with no .env, which is why the guard is not in `load_env`.)
def _auto_guard():
    import sys as _sys
    who = os.path.basename((_sys.argv or [''])[0] or '')
    if who.startswith('build_') and who.endswith('.py'):
        require_settings(who)


_auto_guard()
