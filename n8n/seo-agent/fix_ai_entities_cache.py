#!/usr/bin/env python3
"""fix_ai_entities_cache.py: one-off purge of the stored AI entity names that are not businesses (F-53, AIR P3, 2026-11-06).

The AI Visibility Tracker learns names from AI answers into `seo_cache`:
  * `ai_brands:<site_id>`   = { name: domain }                         (every reader takes these names for rivals)
  * `ai_entities:<site_id>` = { id: { r: role, n: [names], d: [domains], k } }   (the parser scans these names in every later answer)
Before F-53 a heading, a table label, a plan step, a date, a price or a regulator could be learned there ("Scalability" -> a vendor's domain,
"Phase 2", "AED 20k-100k"), and once stored such a name is looked for in every answer and counted as a competitor for ever. The parser now
refuses those names (AIE.junkName in v5/code/_ai_entities.js) and never scans a stored one; this script removes them from the rows already
stored, so the reports and the rival sets stop carrying them at once instead of waiting for the next runs to overwrite the rows.

  * a name of `ai_brands:` that is junk                         -> removed from the row's JSON;
  * a name in an `ai_entities:` entry's `n` list that is junk   -> removed; an entry whose id is not a domain and is junk -> removed;
  * every other entry, and every other row, is left as it is. A row with nothing to remove is not written.

    python3 fix_ai_entities_cache.py                     # dry run (default): lists the rows and the names it would remove, writes nothing
    python3 fix_ai_entities_cache.py --site site_x-com   # one site only
    python3 fix_ai_entities_cache.py --apply             # writes the cleaned values (one PATCH per row, by row id)
    python3 fix_ai_entities_cache.py --self-test         # checks the rule on harness/accuracy/ai_entities_junk.json, no network

The word lists (the category words GEN and HEADING_WORDS) are READ from v5/code/_ai_entities.js, so the two can never list different words;
the few patterns (money, dates, plan steps, regulators, free zones, places) are mirrored below and held to the engine by the shared case file
harness/accuracy/ai_entities_junk.json (harness AF4 runs the same cases through AIE.junkName). Reads and writes through the n8n public API
(key N8N_API_KEY from n8n/.env or app/.env), like fix_ladder_hosts.py. Prints no secret and no answer text; the owner runs it (dry run first).
"""
import json, os, re, sys, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
KIT = os.path.join(HERE, 'v5', 'code', '_ai_entities.js')
CASES = os.path.join(HERE, 'harness', 'accuracy', 'ai_entities_junk.json')


def _words(src, start):
    """The space-separated words of a JS string expression `(' ... ' + ' ... ')` that begins at `start` in the kit."""
    i = src.index(start); j = src.index(').split(', i)
    return set(w for part in re.findall(r"'([^']*)'", src[i:j]) for w in part.split() if w)


def load_rule():
    src = open(KIT, encoding='utf-8').read()
    gen = _words(src, "const GEN = new Set((")
    head = _words(src, "const HEADING_WORDS = (")
    stop = set(re.findall(r"'([a-z]+)'", src[src.index('const STOPW = new Set(['):src.index('const splits')]))
    deny = re.search(r"const DENY = /\^\(([^)]*)\)\$/i;", src).group(1)
    return gen, head, stop, re.compile('^(' + deny + ')$', re.I)


GEN, HEAD, STOPW, DENY = load_rule()
MONEY = re.compile(r'(?:\b(?:aed|usd|sar|qar|kwd|bhd|omr|egp|inr|pkr|eur|gbp|dhs?|dirhams?|riyals?|rupees?)\b|[$€£₹])\s*[\d.,]+|\d[\d.,]*\s*(?:k|m|bn|aed|usd|sar|dhs?|million|billion|thousand)\b', re.I)
MONTH = r'(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?'
DATE = re.compile(r'^(?:\d{1,2}(?:st|nd|rd|th)?\s+' + MONTH + r'(?:,?\s+\d{2,4})?|' + MONTH + r'\s+\d{1,4}(?:,?\s+\d{4})?|(?:q[1-4]|h[12]|fy\s?\d{2,4})(?:\s+\d{2,4})?)$', re.I)
STEP = re.compile(r'^(?:phase|step|stage|tier|level|option|wave|part|week|month|year|day|round|milestone|module|scenario|case|example|type|model|plan)\s*(?:\d+|[ivx]+|[a-d])?$', re.I)
ANSWER = re.compile(r'^(yes|no|maybe|none|n/a|na|tbd|varies|depends|optional|required|included|unlimited|custom)$', re.I)
FZ_ONLY = re.compile(r'^(?:dmcc|difc|adgm|dso|jafza|dafza|rakez|ifza|kezad|shams|saif ?zone|hamriyah|dwtc|dic|dmc)$', re.I)
PLACE = re.compile(r'\b(bay|oasis|marina|downtown|district|street|road|tower|towers|island|islands|jumeirah|deira|karama|barsha|internet city|media city|knowledge park|free ?zone|freezone|emirate|province|governorate|county)\b', re.I)
CORP = re.compile(r'(?:^|\s)(?:llc|l\.l\.c\.?|ltd\.?|limited|inc\.?|corp\.?|corporation|fz-?llc|fze|fzco|fzc|fz|llp|dmcc|jlt|gmbh|plc|pvt|pte|s\.a\.?|ag|bv|technologies|technology|tech|solutions|systems|consulting|consultants|consultancy|services|group|labs|partners|software|global|international|mea|me|accountants|digital|studio|studios|agency|ventures|holding|holdings|infotech|softwares|it)\.?$', re.I)


def _splits(w):
    n = len(w); ok = [False] * (n + 1); ok[0] = True
    for i in range(1, n + 1):
        for j in range(max(0, i - 20), i):
            if ok[j] and i - j >= 2 and w[j:i] in GEN:
                ok[i] = True; break
    return ok[n]


def common_word(w):
    x = re.sub(r'[^a-z0-9]', '', w.lower())
    if not x or len(x) < 3:
        return True
    return x in GEN or re.sub(r's$', '', x) in GEN or _splits(x)


def heading_word(w):
    x = re.sub(r'[^\w]', '', w.lower(), flags=re.U).replace('_', '')
    if not x:
        return True
    if x.isdigit() or DENY.match(x) or x in STOPW:
        return True
    return common_word(x) or x in HEAD or re.sub(r's$', '', x) in HEAD or re.sub(r'(?<=[a-z]{3})(es|ies)$', '', x) in HEAD


def junk(name):
    """The engine's AIE.junkName, for the stored names: money, a date or a step, an answer word, a free zone alone, only heading words, a place."""
    n = re.sub(r'\s+', ' ', re.sub(r'[*_`]+', '', str(name or ''))).strip()
    if not n:
        return True
    if MONEY.search(n) or DATE.match(n) or STEP.match(n) or ANSWER.match(n) or FZ_ONLY.match(n):
        return True
    w = [x for x in re.split(r'[\s\-–—/]+', n) if x]
    def direct(x0):
        x = re.sub(r'[^\w]', '', x0.lower(), flags=re.U).replace('_', '')
        return not x or len(x) < 3 or x.isdigit() or bool(DENY.match(x)) or x in STOPW or x in GEN or re.sub(r's$', '', x) in GEN or x in HEAD or re.sub(r's$', '', x) in HEAD
    if not w or (all(heading_word(x) for x in w) and not (len(w) >= 2 and CORP.search(n) and any(not direct(x) for x in w))):
        return True
    if PLACE.search(n) and not CORP.search(n):
        return True
    return False


def is_domain(x):
    return bool(re.match(r'^[a-z0-9-]+(\.[a-z0-9-]+)+$', str(x or '').strip(), re.I))


def plan(cache_rows, only_site=''):
    """-> [(row, new_value_json, removed_names)] for the rows that carry at least one junk name."""
    out = []
    for r in cache_rows:
        key = str(r.get('key') or '')
        if not (key.startswith('ai_brands:') or key.startswith('ai_entities:')):
            continue
        if only_site and key.split(':', 1)[1] != only_site:
            continue
        try:
            val = json.loads(r.get('value') or '{}')
        except Exception:
            continue
        if not isinstance(val, dict):
            continue
        removed = []
        if key.startswith('ai_brands:'):
            keep = {}
            for name, dom in val.items():
                if junk(name):
                    removed.append(name)
                else:
                    keep[name] = dom
        else:
            keep = {}
            for eid, e in val.items():
                if not isinstance(e, dict):
                    keep[eid] = e; continue
                if not is_domain(eid) and junk(eid):
                    removed.append(eid); continue
                names = [n for n in (e.get('n') or []) if not junk(n)]
                removed += [n for n in (e.get('n') or []) if junk(n)]
                keep[eid] = dict(e, n=names)
        if removed:
            out.append((r, json.dumps(keep, separators=(',', ':'), ensure_ascii=False), removed))
    return out


def self_test():
    cases = json.load(open(CASES, encoding='utf-8'))['cases']
    bad = [(n, want) for n, want in cases if junk(n) != want]
    rows = [{'id': 1, 'key': 'ai_brands:site_a-example', 'value': json.dumps({'Scalability': 'vendor.example', 'Lumora': 'lumora.example'})},
            {'id': 2, 'key': 'ai_entities:site_a-example', 'value': json.dumps({'Phase 2': {'r': 'competitor', 'n': ['Phase 2']}, 'kestrel.example': {'r': 'competitor', 'n': ['Kestrel Labs', 'Initial Cost'], 'd': ['kestrel.example']}})},
            {'id': 3, 'key': 'ai_brands:site_b-example', 'value': json.dumps({'Quillbyte': 'quillbyte.example'})},
            {'id': 4, 'key': 'serp:x|2784|en|desktop', 'value': '{}'}]
    p = plan(rows)
    rows_ok = [x[0]['id'] for x in p] == [1, 2] and p[0][2] == ['Scalability'] and sorted(p[1][2]) == ['Initial Cost', 'Phase 2'] and 'Kestrel Labs' in p[1][1]
    print('fix_ai_entities_cache self-test: %d of %d junk cases agree with harness/accuracy/ai_entities_junk.json; plan picks rows %s'
          % (len(cases) - len(bad), len(cases), [x[0]['id'] for x in p]))
    for n, want in bad:
        print('  DISAGREES: %r expected %s' % (n, 'junk' if want else 'a business'))
    return 0 if not bad and rows_ok else 1


def main():
    if '--self-test' in sys.argv:
        return self_test()
    from fix_ladder_hosts import api_key, call, table_id, rows
    from ladder_common import CACHE_TABLE
    apply = '--apply' in sys.argv
    only = sys.argv[sys.argv.index('--site') + 1] if '--site' in sys.argv and sys.argv.index('--site') + 1 < len(sys.argv) else ''
    key = api_key()
    if not key:
        print('fix_ai_entities_cache: no N8N_API_KEY in n8n/.env or app/.env'); return 2
    tid = table_id(key, CACHE_TABLE)
    if not tid:
        print('fix_ai_entities_cache: the table %s does not exist - nothing to do' % CACHE_TABLE); return 0
    todo = plan(rows(key, tid, limit=5000), only)
    print('fix_ai_entities_cache: %d row(s) carry names that are not businesses' % len(todo))
    for r, _new, removed in todo:
        print('  %s row %s %s: remove %d name(s): %s' % ('WOULD CLEAN' if not apply else 'CLEAN      ', r.get('id'), r.get('key'), len(removed), ', '.join(sorted(set(removed)))[:600]))
    if not apply:
        print('\ndry run (default): nothing was written. Re-run with --apply to clean %d row(s).' % len(todo)); return 0
    failed = 0
    for r, new, _removed in todo:
        body = {'filter': {'type': 'and', 'filters': [{'columnName': 'id', 'condition': 'eq', 'value': r['id']}]}, 'data': {'value': new}}
        try:
            call(key, '/data-tables/%s/rows/update' % tid, 'PATCH', body)
        except Exception as e:
            failed += 1; print('  FAILED row %s: %s' % (r.get('id'), str(e)[:120]))
    print('fix_ai_entities_cache: done, %d failed' % failed)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
