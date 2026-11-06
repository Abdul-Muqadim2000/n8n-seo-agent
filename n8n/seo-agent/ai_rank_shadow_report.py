#!/usr/bin/env python3
"""ai_rank_shadow_report.py - the owner's weekly read of the AI-ranking algorithm in shadow (docs/ai-ranking-2026-11-05/DESIGN.md §2.H, §4.4
step 2, §7.2 stage 2; package P4).

READ-ONLY. It reads AIR's run rows and actions, and the tables a shadow site must leave alone, and writes ONE HTML file to the private folder
(default ~/seo-agent-secrets/ai-ranking-2026-11-05/shadow/; a path inside the repository is refused: client data never enters the public repo).

Per website and week: the mode, the error (a kit not built is named), AIR's chosen actions beside the current logic's (old_json), the
comparison, the memo; and the gate to the next rollout step (DESIGN §4.4):
  * writes outside the AIR tables while the site is not `on`: seo_ai_targets / seo_link_prospects rows with origin ai_rank, seo_ai_prompts
    rows with source ai_rank, seo_cache air:protect rows -> must be 0;
  * the AI Growth ledger rows (seo_run_ledger, mode ai_growth): settled money and run time per run (shadow must not move them);
  * errors other than "kit not built";
  * plan stability: Jaccard of the top-5 chosen actions week to week (gate: at least 0.6 unless a stage changed).

    python3 ai_rank_shadow_report.py                         # through the n8n public API (GET only; N8N_API_KEY, N8N_PUBLIC_URL)
    python3 ai_rank_shadow_report.py --from-dir <dir>        # offline: a folder of seo_*.json table dumps, or an ai_rank_replay.js output
    python3 ai_rank_shadow_report.py --out <file.html> [--site site_x] [--weeks 6]

Prints counts and the output path only, never a row's content or a secret.
"""
import html, json, os, sys, glob, datetime

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
DEFAULT_OUT = os.path.expanduser('~/seo-agent-secrets/ai-ranking-2026-11-05/shadow')
TABLES = ['seo_ai_rank_runs', 'seo_ai_rank_actions', 'seo_monitors', 'seo_ai_targets', 'seo_link_prospects', 'seo_ai_prompts', 'seo_cache', 'seo_run_ledger']
esc = lambda s: html.escape('' if s is None else str(s))


def P(s, d):
    if isinstance(s, (dict, list)): return s
    try:
        v = json.loads(s or '')
        return d if v is None else v
    except Exception:
        return d


def load_api():
    from fix_ladder_hosts import api_key, table_id, rows
    key = api_key()
    if not key: raise SystemExit('ai_rank_shadow_report: no N8N_API_KEY in n8n/.env or app/.env (or use --from-dir)')
    out = {}
    for t in TABLES:
        tid = table_id(key, t)
        out[t] = rows(key, tid, limit=20000) if tid else []
    return out


def load_dir(d):
    out = {t: [] for t in TABLES}
    for f in glob.glob(os.path.join(d, 'seo_*.json')):
        t = os.path.basename(f)[:-5]
        try: v = json.load(open(f, encoding='utf-8'))
        except Exception: continue
        if t in out: out[t] = v if isinstance(v, list) else (v.get('data') or [])
    for f in sorted(glob.glob(os.path.join(d, 'replay_*.json'))):   # an ai_rank_replay.js output folder: its run rows and actions
        try: r = json.load(open(f, encoding='utf-8'))
        except Exception: continue
        if r.get('run_row'): out['seo_ai_rank_runs'].append(r['run_row'])
        out['seo_ai_rank_actions'].extend(r.get('actions') or [])
    return out


def jaccard(a, b):
    a, b = set(a), set(b)
    return None if not a and not b else len(a & b) / float(len(a | b))


def build(t, only='', weeks=8):
    modes = {m.get('site_id'): str(m.get('ai_rank_mode') or 'off').strip().lower() or 'off' for m in t['seo_monitors']}
    runs = [r for r in t['seo_ai_rank_runs'] if not only or r.get('site_id') == only]
    sites = sorted({r.get('site_id') for r in runs} | {s for s, m in modes.items() if m in ('shadow', 'on') and (not only or s == only)})
    out, totals = [], {'outside': 0, 'errors': 0, 'kit_missing': 0, 'runs': 0}
    for s in sites:
        mode = modes.get(s, 'off')
        rs = sorted([r for r in runs if r.get('site_id') == s], key=lambda r: str(r.get('checked_at')))[-weeks:]
        outside = 0 if mode == 'on' else (
            sum(1 for r in t['seo_ai_targets'] if r.get('site_id') == s and r.get('origin') == 'ai_rank')
            + sum(1 for r in t['seo_link_prospects'] if r.get('site_id') == s and r.get('origin') == 'ai_rank')
            + sum(1 for r in t['seo_ai_prompts'] if r.get('site_id') == s and r.get('source') == 'ai_rank')
            + sum(1 for r in t['seo_cache'] if r.get('key') == 'air:protect:' + str(s)))
        ledger = sorted([r for r in t['seo_run_ledger'] if str(r.get('mode')) == 'ai_growth' and (str(r.get('key') or '').endswith(str(s)[5:]) or r.get('site_id') == s)],
                        key=lambda r: str(r.get('created_at')))[-weeks:]
        weeks_out, prev_top = [], None
        for r in rs:
            chosen = P(r.get('chosen_json'), []) or []
            top = [str(a.get('action_id') or a.get('lever')) for a in chosen[:5]]
            stab = jaccard(prev_top, top) if prev_top is not None else None
            prev_top = top
            err = str(r.get('error') or '')
            totals['runs'] += 1
            if err.startswith('kit not built'): totals['kit_missing'] += 1
            elif err: totals['errors'] += 1
            weeks_out.append({'at': str(r.get('checked_at'))[:10], 'mode': r.get('mode'), 'error': err, 'chosen': chosen, 'old': P(r.get('old_json'), {}) or {},
                              'compare': P(r.get('compare_json'), None), 'memo': P(r.get('memo_json'), None), 'stability': stab, 'exec_id': r.get('exec_id')})
        totals['outside'] += outside
        out.append({'site_id': s, 'mode': mode, 'outside': outside, 'weeks': weeks_out, 'ledger': [{'at': str(l.get('created_at'))[:16], 'usd': l.get('settled_usd'), 'status': l.get('status'),
                    'secs': secs(l.get('created_at'), l.get('settled_at'))} for l in ledger]})
    return out, totals


def secs(a, b):
    try:
        f = lambda x: datetime.datetime.fromisoformat(str(x).replace('Z', '+00:00'))
        return round((f(b) - f(a)).total_seconds())
    except Exception:
        return None


def render(sites, totals, source):
    li = lambda xs, f: ('<ol>' + ''.join('<li>' + f(x) + '</li>' for x in xs[:8]) + '</ol>') if xs else '<p class="mu">none</p>'
    body = ''
    for s in sites:
        body += '<section><h2>%s <span class="mu">mode %s</span></h2>' % (esc(s['site_id']), esc(s['mode']))
        body += '<p>Rows written outside the AIR tables while not on: <b>%d</b> (must be 0).</p>' % s['outside']
        body += '<h3>AI Growth runs (ledger)</h3>' + li(s['ledger'], lambda l: '%s: $%s, %s, %s s' % (esc(l['at']), esc(l['usd']), esc(l['status']), esc(l['secs'])))
        for w in reversed(s['weeks']):
            body += '<h3>%s <span class="mu">%s%s</span></h3>' % (esc(w['at']), esc(w['mode']), (', plan stability %.2f' % w['stability']) if w['stability'] is not None else '')
            if w['error']: body += '<p><b>%s</b></p>' % esc(w['error'])
            body += '<div class="cols"><div><h4>AIR\'s plan</h4>' + li(w['chosen'], lambda a: esc(a.get('lever')) + ' ' + esc(a.get('executor')) + ' &rarr; ' + esc(a.get('sink')) + ' ' + esc(json.dumps(a.get('ref') or {}))) + '</div>'
            body += '<div><h4>The current logic</h4>' + li((w['old'] or {}).get('actions') or [], lambda a: esc(a.get('type')) + ': ' + esc(a.get('action'))) + '</div></div>'
            body += '<p>' + (esc(json.dumps(w['compare'])) if w['compare'] else '<span class="mu">Not compared yet (decision kit not built).</span>') + '</p>'
            if w['memo']:
                body += ''.join('<h4>%s</h4><ul>%s</ul>' % (esc(p.get('title')), ''.join('<li>%s</li>' % esc(l.get('text')) for l in p.get('lines') or [])) for p in w['memo'].get('parts') or [])
        body += '</section>'
    return ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>AIR shadow report</title>'
            '<style>:root{--bg:#fff;--fg:#14171f;--mu:#5b6270;--ln:#e3e6ec}@media (prefers-color-scheme: dark){:root{--bg:#12141a;--fg:#e8eaf0;--mu:#9aa1ad;--ln:#2a2e38}}'
            'body{background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif;max-width:1100px;margin:0 auto;padding:16px}section{border-top:1px solid var(--ln);padding:12px 0}'
            '.mu{color:var(--mu)}.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}</style></head><body><h1>AIR shadow report</h1>'
            '<p class="mu">Source: %s. %d run(s); %d with a kit not built yet; %d other error(s); %d row(s) written outside the AIR tables by a site that is not on.</p>%s</body></html>'
            % (esc(source), totals['runs'], totals['kit_missing'], totals['errors'], totals['outside'], body))


def main(argv=None):
    a = list(sys.argv[1:] if argv is None else argv)
    arg = lambda k, d='': a[a.index(k) + 1] if k in a and a.index(k) + 1 < len(a) else d
    src_dir = arg('--from-dir')
    out = arg('--out') or os.path.join(DEFAULT_OUT, 'shadow_%s.html' % datetime.date.today().isoformat())
    if os.path.abspath(out).startswith(REPO + os.sep):
        print('ai_rank_shadow_report: the output is inside the repository; client data stays in the private folder'); return 2
    t = load_dir(src_dir) if src_dir else load_api()
    sites, totals = build(t, arg('--site'), int(arg('--weeks', '8') or 8))
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    open(out, 'w', encoding='utf-8').write(render(sites, totals, 'a local folder' if src_dir else 'the n8n API (read only)'))
    print('ai_rank_shadow_report: %d site(s), %d run(s), %d kit-not-built, %d other error(s), %d row(s) outside the AIR tables; wrote %s'
          % (len(sites), totals['runs'], totals['kit_missing'], totals['errors'], totals['outside'], out))
    return 1 if totals['outside'] else 0


if __name__ == '__main__':
    sys.exit(main())
