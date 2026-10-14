#!/usr/bin/env python3
"""reconcile_claude_cost.py — the monthly reality check on Claude's cost (G23, 2026-10-13).

Three of this engine's model nodes stream (Strategy Brief, Copywriter, Editor on Opus; `streaming: true` is required above ~21k
tokens), and **a streaming call reports no token usage at all**. Nothing inside a run can read what it really spent, so
`v5/code/_cost_cal.js` prices every call from the characters its prompt interpolated, the characters it answered with and the thinking
budget of its effort level. That is a good estimate and it is labelled one everywhere — but an estimate needs a reality check, and the
only place the truth lives is the owner's Anthropic Console.

Once a month, then:

  1. The owner downloads the month's **cost** data from the Console (Cost page → export, or the Usage & Cost Admin API
     `GET /v1/organizations/cost_report?starting_at=…&ending_at=…&group_by[]=description`, which needs an **Admin** API key — this
     script never asks for one, never reads one and never calls Anthropic).
  2. This script compares it with what the engine *thought* it spent on each model family that month
     (`seo_cache` rows `cost:model:opus` / `:sonnet` / `:haiku`, written by *Cost Calibration Row*).
  3. It prints the correction factor per family and, with `--apply`, writes them to the one row the guard reads,
     `seo_cache` `cost:factor:claude`. From the next run on, `CC.callCost` multiplies that family's prices by its factor, so the
     estimates — and the per-mode reservations that are calibrated from them — carry the real prices.

    python3 reconcile_claude_cost.py --export cost_report.json                  # dry run (default): prints the comparison
    python3 reconcile_claude_cost.py --export cost.csv --month 2026-10          # a month other than the one the export covers
    python3 reconcile_claude_cost.py --export cost_report.json --apply          # writes cost:factor:claude
    python3 reconcile_claude_cost.py --export cost_report.json --ledger         # also list the month's seo_run_ledger rows

WHAT THE EXPORT MAY LOOK LIKE
-----------------------------
**JSON** — exactly what the Cost API returns (documented 2026-10): a top-level `data` list of time buckets, each with `starting_at`,
`ending_at` and a `results` list whose items carry `amount`, `currency`, `model`, `description`, `cost_type`, `token_type`. Note the
documented unit: **`amount` is a decimal string in the lowest currency unit** — "123.45" in USD means $1.23 — so this script divides
JSON amounts by 100 unless the item carries an explicit dollar field (`amount_usd` / `cost_usd`). A bare list of result items, or an
object with `results`/`items`/`rows`, is accepted too.

**CSV** — the Console's own download is not a documented schema, so this script matches the obvious column names, case- and
space-insensitively, and prints which ones it used:

  * the model:     `model`, `model_id`, `model_name`, or parsed out of `description` ("Claude Opus 5.5 Usage - Input Tokens")
  * the money:     `cost_usd`, `usd`, `cost`, `amount_usd`, `total_cost`, `spend`  → taken as **dollars**
                   `amount` (with `currency` = USD)                                → taken as **cents**, per the API's unit
  * the date:      `date`, `day`, `starting_at`, `start_time`, `bucket`, `timestamp`, `period`  (only `YYYY-MM` is used)

Anything the script cannot read it says so about and leaves out of the totals, rather than guessing.

WHAT IT NEVER DOES
------------------
It never prints, stores or asks for an API key of any kind, it never calls the Anthropic API, and without `--apply` it writes nothing.
Reads and writes go through the n8n public API (`N8N_API_KEY` from n8n/.env or app/.env), like sync_tables.py and release_stale_runs.py.
"""
import csv, io, json, os, re, sys, urllib.parse, urllib.request
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from env_settings import load_env
from ladder_common import CACHE_TABLE, RUN_LEDGER_TABLE

BASE = os.environ.get('N8N_PUBLIC_URL', 'http://localhost:5678').rstrip('/') + '/api/v1'
FACTOR_KEY = 'cost:factor:claude'        # keep in step with CC.FACTOR_KEY in v5/code/_cost_cal.js
MODEL_PREFIX = 'cost:model:'             # keep in step with CC.MODEL_PREFIX
FAMILIES = ('opus', 'sonnet', 'haiku', 'other')
MIN_USD = 0.05        # below this the month is too small to correct a price from: one cheap month must not swing the guard
FACTOR_MIN, FACTOR_MAX = 0.2, 5.0        # a factor outside this is a reading error, not a price change
USD_COLS = ('cost_usd', 'usd', 'cost', 'amount_usd', 'total_cost', 'spend', 'cost_in_usd')
CENT_COLS = ('amount',)
MODEL_COLS = ('model', 'model_id', 'model_name', 'modelid')
DATE_COLS = ('date', 'day', 'starting_at', 'start_time', 'bucket', 'timestamp', 'period', 'month')
DESC_COLS = ('description', 'line_item', 'item', 'name')


def family_of(model):
    """The model family a price belongs to — the same rule as CC.family in v5/code/_cost_cal.js."""
    m = str(model or '').lower()
    if 'opus' in m: return 'opus'
    if 'sonnet' in m: return 'sonnet'
    if 'haiku' in m: return 'haiku'
    if 'fable' in m or 'mythos' in m: return 'other'
    return 'other'


# ---------------------------------------------------------------- the export
def _norm(k):
    return re.sub(r'[^a-z0-9]+', '_', str(k or '').strip().lower()).strip('_')


def _month_of(v):
    m = re.search(r'(\d{4})-(\d{2})', str(v or ''))
    return '%s-%s' % (m.group(1), m.group(2)) if m else ''


def _usd_of(row, note):
    """Dollars from one export row. `amount` is cents (the Cost API's documented unit); the *_usd columns are dollars."""
    for c in USD_COLS:
        if c in row and str(row[c]).strip() not in ('', 'None'):
            try: return float(str(row[c]).replace('$', '').replace(',', '').strip()), c
            except ValueError: pass
    for c in CENT_COLS:
        if c in row and str(row[c]).strip() not in ('', 'None'):
            cur = str(row.get('currency') or 'USD').upper()
            if cur not in ('USD', ''):
                note.add('amounts in %s were left out (only USD is reconciled)' % cur); return None, ''
            try: return float(str(row[c]).replace(',', '').strip()) / 100.0, c + ' (cents)'
            except ValueError: pass
    return None, ''


def read_export(path):
    """-> (per-family USD, month seen, notes, how many rows were read / skipped)."""
    raw = open(path, encoding='utf-8-sig').read()
    rows = []
    stripped = raw.lstrip()
    if stripped.startswith('{') or stripped.startswith('['):
        doc = json.loads(raw)
        if isinstance(doc, dict):
            buckets = doc.get('data') or doc.get('results') or doc.get('items') or doc.get('rows') or []
        else:
            buckets = doc
        for b in buckets:
            if isinstance(b, dict) and isinstance(b.get('results'), list):
                for r in b['results']:
                    r = dict(r); r.setdefault('starting_at', b.get('starting_at') or b.get('ending_at') or '')
                    rows.append(r)
            elif isinstance(b, dict):
                rows.append(b)
    else:
        rows = list(csv.DictReader(io.StringIO(raw)))
    by_family, months, notes, used, skipped = defaultdict(float), defaultdict(float), set(), 0, 0
    cols = set()
    for raw_row in rows:
        row = {_norm(k): v for k, v in (raw_row or {}).items()}
        usd, col = _usd_of(row, notes)
        if usd is None:
            skipped += 1; continue
        cols.add(col)
        model = next((row[c] for c in MODEL_COLS if row.get(c)), '')
        if not model:
            model = next((row[c] for c in DESC_COLS if row.get(c)), '')
        if not model:
            notes.add('%d row(s) name no model and were counted under "other"' % 1)
        fam = family_of(model)
        by_family[fam] += usd
        month = next((_month_of(row[c]) for c in DATE_COLS if row.get(c) and _month_of(row[c])), '')
        if month: months[month] += usd
        used += 1
    if cols: notes.add('money read from: ' + ', '.join(sorted(cols)))
    if skipped: notes.add('%d row(s) carried no readable amount and were left out' % skipped)
    month = max(months.items(), key=lambda kv: kv[1])[0] if months else ''
    return {k: round(v, 4) for k, v in by_family.items()}, month, sorted(notes), used, skipped


# ---------------------------------------------------------------- n8n
def api_key():
    k = load_env().get('N8N_API_KEY')
    if k: return k
    p = os.path.join(HERE, '..', '..', 'app', '.env')
    if os.path.exists(p):
        for line in open(p, encoding='utf-8'):
            if line.startswith('N8N_API_KEY='):
                return line.split('=', 1)[1].strip().strip('"').strip("'")
    return ''


def call(key, path, method='GET', body=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'X-N8N-API-KEY': key, 'Content-Type': 'application/json', 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read() or b'null')


def table_id(key, name):
    cursor = None
    while True:
        page = call(key, '/data-tables?limit=100' + ('&cursor=' + urllib.parse.quote(cursor) if cursor else ''))
        for t in page.get('data', []):
            if t.get('name') == name: return t['id']
        cursor = page.get('nextCursor')
        if not cursor: return ''


def rows_of(key, tid, limit=6000):
    out, cursor = [], None
    while len(out) < limit:
        page = call(key, '/data-tables/%s/rows?limit=250%s' % (tid, '&cursor=' + urllib.parse.quote(cursor) if cursor else ''))
        out.extend(page.get('data', []))
        cursor = page.get('nextCursor')
        if not cursor: break
    return out


def engine_months(cache_rows):
    """What the engine estimated per model family, from the seo_cache rows Cost Calibration Row writes."""
    out = {}
    for r in cache_rows:
        k = str(r.get('key') or '')
        if not k.startswith(MODEL_PREFIX): continue
        try: v = json.loads(str(r.get('value') or '{}')) or {}
        except Exception: v = {}
        out[k[len(MODEL_PREFIX):]] = {'month': str(v.get('month') or ''), 'usd': float(v.get('usd') or 0), 'runs': int(v.get('runs') or 0)}
    return out


# ---------------------------------------------------------------- the comparison
def factors(real, engine, month):
    """-> (factor per family, one explanation line per family)."""
    out, why = {}, []
    for fam in FAMILIES:
        r = round(float(real.get(fam) or 0), 4)
        e = engine.get(fam) or {}
        em, eu = str(e.get('month') or ''), round(float(e.get('usd') or 0), 4)
        if not r and not eu:
            continue
        if em and month and em != month:
            why.append('%-7s $%-9.4f real, but the engine\'s figure is for %s, not %s — not corrected' % (fam, r, em or '-', month)); continue
        if eu < MIN_USD:
            why.append('%-7s $%-9.4f real vs $%.4f estimated — under $%.2f, too small to set a price from' % (fam, r, eu, MIN_USD)); continue
        if r <= 0:
            why.append('%-7s the export has no %s cost at all while the engine estimated $%.4f — check the export, not corrected' % (fam, fam, eu)); continue
        f = round(r / eu, 4)
        if f < FACTOR_MIN or f > FACTOR_MAX:
            why.append('%-7s factor %.2fx ($%.4f real vs $%.4f estimated) is outside %.1f-%.1fx — a reading error, not a price change; not applied'
                       % (fam, f, r, eu, FACTOR_MIN, FACTOR_MAX)); continue
        out[fam] = f
        why.append('%-7s $%-9.4f real vs $%-9.4f estimated over %d run(s)  ->  factor %.3fx (%+.0f%%)'
                   % (fam, r, eu, int(e.get('runs') or 0), f, (f - 1) * 100))
    return out, why


def main():
    argv = sys.argv[1:]
    apply = '--apply' in argv
    export = month = ''
    if '--export' in argv:
        i = argv.index('--export'); export = argv[i + 1] if i + 1 < len(argv) else ''
    if '--month' in argv:
        i = argv.index('--month'); month = argv[i + 1] if i + 1 < len(argv) else ''
    if not export or not os.path.exists(export):
        print(__doc__.strip().split('WHAT THE EXPORT')[0])
        print('reconcile_claude_cost: give it the Anthropic Console export with --export <file.json|file.csv>')
        return 2
    real, export_month, notes, used, skipped = read_export(export)
    month = month or export_month
    key = api_key()
    if not key:
        print('reconcile_claude_cost: no N8N_API_KEY in n8n/.env or app/.env'); return 2
    cache_tid = table_id(key, CACHE_TABLE)
    if not cache_tid:
        print('reconcile_claude_cost: the table %s does not exist yet — run the engine once first' % CACHE_TABLE); return 0
    cache_rows = rows_of(key, cache_tid)
    engine = engine_months(cache_rows)

    print('reconcile_claude_cost: %s — %d export row(s) read%s' % (month or 'month unknown', used, (', %d left out' % skipped) if skipped else ''))
    for n in notes: print('  note: ' + n)
    print('  Anthropic says:   ' + (', '.join('%s $%.4f' % (k, v) for k, v in sorted(real.items())) or 'nothing readable'))
    print('  this engine says: ' + (', '.join('%s $%.4f (%s, %d run(s))' % (k, v['usd'], v['month'] or '-', v['runs']) for k, v in sorted(engine.items())) or 'nothing recorded yet'))
    fac, why = factors(real, engine, month)
    print('')
    for line in why: print('  ' + line)
    if '--ledger' in argv:
        led_tid = table_id(key, RUN_LEDGER_TABLE)
        led = [r for r in (rows_of(key, led_tid) if led_tid else []) if str(r.get('created_at') or '').startswith(month)] if month else []
        tot_ai = sum(float(r.get('ai_usd') or r.get('settled_usd') or 0) for r in led)
        tot_dfs = sum(float(r.get('dfs_usd') or 0) for r in led)
        meas = sum(float(r.get('measured_usd') or 0) for r in led)
        print('\n  %s: %d row(s) in %s — Claude $%.4f (estimated), DataForSEO $%.4f, of which $%.4f is measured money'
              % (RUN_LEDGER_TABLE, len(led), month, tot_ai, tot_dfs, meas))
    if not fac:
        print('\nnothing to correct: no family had both a readable real cost and an estimate of this month worth correcting.')
        return 0
    old = next((r for r in cache_rows if str(r.get('key') or '') == FACTOR_KEY), None)
    value = {'month': month, 'note': 'reconciled against the Anthropic Console export %s' % os.path.basename(export),
             'source': 'reconcile_claude_cost.py', 'updated_at': __import__('datetime').datetime.utcnow().isoformat() + 'Z'}
    value.update(fac)
    print('\n  %s -> %s' % (FACTOR_KEY, json.dumps({k: v for k, v in sorted(value.items())})))
    if old:
        print('  (replacing %s)' % str(old.get('value'))[:160])
    if not apply:
        print('\ndry run (default): nothing was written. Re-run with --apply to store these factor(s); every Claude price goes through them from the next run on.')
        return 0
    body = {'filter': {'type': 'and', 'filters': [{'columnName': 'key', 'condition': 'eq', 'value': FACTOR_KEY}]},
            'data': {'key': FACTOR_KEY, 'kind': 'cost', 'site_id': '', 'value': json.dumps(value), 'updated_at': value['updated_at']}}
    try:
        if old: call(key, '/data-tables/%s/rows/update' % cache_tid, 'PATCH', {'filter': body['filter'], 'data': body['data']})
        else: call(key, '/data-tables/%s/rows' % cache_tid, 'POST', {'data': [body['data']]})
    except Exception as e:
        print('  FAILED to write %s: %s' % (FACTOR_KEY, str(e)[:160])); return 1
    print('\nreconcile_claude_cost: wrote %s. The per-mode estimates recalibrate themselves from the corrected figures as runs settle.' % FACTOR_KEY)
    return 0


if __name__ == '__main__':
    sys.exit(main())
