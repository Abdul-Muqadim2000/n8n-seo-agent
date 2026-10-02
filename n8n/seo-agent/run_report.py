#!/usr/bin/env python3
"""Builds a styled, self-contained HTML report of a live run for people outside the build: what the system was asked, every step it ran
(grouped into plain-language stages, with timings), what each step produced, the ranking plan, the page it wrote, the quality checks, the
cost, and the documents it delivered (embedded). Reads the executions and the test callback receiver from the running n8n through the
public API (N8N_API_KEY from n8n/.env, never printed).

Usage: python3 run_report.py --exec <ladder execution id> [--exec <page-run execution id> ...] [--out docs/run-reports/<name>.html]"""
import argparse, base64, datetime, html, json, os, re, sys, urllib.request
from env_settings import load_env
HERE = os.path.dirname(os.path.abspath(__file__))
KEY = load_env().get('N8N_API_KEY', ''); BASE = 'http://localhost:5678/api/v1'
E = lambda s: html.escape(str(s if s is not None else ''))

def get(path):
    req = urllib.request.Request(BASE + path, headers={'X-N8N-API-KEY': KEY})
    with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read().decode('utf-8'))

# ---------------------------------------------------------------- stage map (shared with the developer guide)
_src = open(os.path.join(HERE, 'build_docs.py'), encoding='utf-8').read()
_ns = {}; exec(_src[_src.index('STAGES = ['):_src.index('MANUAL = {')], _ns)
STAGE_OF = {n: title for title, _, names in _ns['STAGES'] for n in names}
PLAIN = {  # developer-guide stage -> (plain title, what it means for the business)
 'Entry points & forms': ('Request received', 'The request arrived through the API (the same door a website form or a partner system uses).'),
 'Intake, validation & guards': ('Request checked', 'The input is cleaned and validated; the daily run limit and the AI spending guard are checked before anything is spent.'),
 'Site read & description': ('Business understood', 'The system works out what the business sells and to whom, from the homepage (or a description stored in the last 30 days).'),
 'Keyword pipeline: research': ('Market researched', 'Live Google results, the competing pages, verified facts with sources, search demand and the site\'s own pages are collected and analysed.'),
 'Verdict': ('Decision: is the keyword worth it?', 'An AI analyst weighs demand, difficulty, competition and the site\'s strength and decides GO, GO WITH CHANGES or AVOID.'),
 'Keyword ladder': ('Ranking plan built', 'Instead of attacking the hardest keyword head-on, the system plans a ladder of easier, related pages that build authority up to the main keyword, and starts writing the first page.'),
 'Content context: profile, proof, page role, video (v4.4)': ('Brand context loaded', 'The business profile (author, reviewer, address) and stored case studies are loaded so the page carries real expertise and proof.'),
 'Content generation & QA': ('Page written and quality-checked', 'A content strategist writes the brief, a copywriter writes the page, an editor critiques it, and automatic quality control scores it and asks for one revision if needed.'),
 'Report & delivery (keyword / content)': ('Results packaged and delivered', 'The report, the page (HTML, Markdown, metadata) and a PDF are produced and delivered to the caller.'),
}
def stage_of(name):
    s = STAGE_OF.get(name, 'Other steps')
    return 'Intake, validation & guards' if s == 'Entry points & forms' else s   # 'request received' and 'request checked' read as one stage

# ---------------------------------------------------------------- execution helpers
class Run:
    def __init__(self, eid):
        self.eid = str(eid); self.e = get(f'/executions/{eid}?includeData=true')
        self.rd = (((self.e.get('data') or {}).get('resultData') or {}).get('runData')) or {}
        self.start = self.e.get('startedAt'); self.stop = self.e.get('stoppedAt'); self.status = self.e.get('status')
    def items(self, node, run=-1, out=None):
        rs = self.rd.get(node) or []
        if not rs: return []
        r = rs[run] if -len(rs) <= run < len(rs) else rs[-1]
        outs = ((r.get('data') or {}).get('main') or [])
        sel = outs if out is None else [outs[out]] if out < len(outs) else []
        return [i.get('json') or {} for o in sel for i in (o or [])]
    def first(self, node, run=-1):
        it = self.items(node, run); return it[0] if it else {}
    def nruns(self, node): return len(self.rd.get(node) or [])
    def trace(self):
        rows = []
        for name, rs in self.rd.items():
            st = min(int(r.get('startTime') or 0) for r in rs); en = max(int(r.get('startTime') or 0) + int(r.get('executionTime') or 0) for r in rs)
            err = str((rs[-1].get('error') or {}).get('message', ''))[:200] if rs[-1].get('error') else ''   # an error only when the last attempt failed
            retried = next((str((r.get('error') or {}).get('message', ''))[:120] for r in rs[:-1] if r.get('error')), '')
            items = sum(len(o or []) for r in rs for o in ((r.get('data') or {}).get('main') or []))
            rows.append({'node': name, 'start': st, 'end': en, 'ms': sum(int(r.get('executionTime') or 0) for r in rs), 'runs': len(rs), 'items': items, 'error': err, 'retried': retried, 'stage': stage_of(name)})
        return sorted(rows, key=lambda r: r['start'])
    def minutes(self):
        try: return (datetime.datetime.fromisoformat(self.stop.replace('Z', '+00:00')) - datetime.datetime.fromisoformat(self.start.replace('Z', '+00:00'))).total_seconds() / 60
        except Exception: return None
    def tokens(self):
        """Measured Claude token usage (non-streaming model calls report it; streaming calls do not)."""
        out = {}
        for name, rs in self.rd.items():
            for r in rs:
                for k, v in (r.get('data') or {}).items():
                    if k != 'ai_languageModel': continue
                    for o in v or []:
                        for i in o or []:
                            tu = (i.get('json') or {}).get('tokenUsage')
                            if tu: out.setdefault(name, {'in': 0, 'out': 0}); out[name]['in'] += tu.get('promptTokens', 0); out[name]['out'] += tu.get('completionTokens', 0)
        return out

def stages_of(run):
    """Ordered stages with their nodes, wall-clock duration and node time."""
    st = {}
    for r in run.trace():
        s = st.setdefault(r['stage'], {'nodes': [], 'start': r['start'], 'end': r['end']})
        s['nodes'].append(r); s['start'] = min(s['start'], r['start']); s['end'] = max(s['end'], r['end'])
    return sorted(st.items(), key=lambda kv: kv[1]['start'])

def callbacks(t0, t1):
    """Bodies the test callback receiver got between t0 and t1 (ISO strings)."""
    out = []
    for e in get('/executions?workflowId=SEOagentCallback&limit=40').get('data', []):
        if not (t0 <= (e.get('startedAt') or '') <= t1): continue
        x = get(f"/executions/{e['id']}?includeData=true"); rd = x['data']['resultData']['runData']
        for name, rs in rd.items():
            for i in ((rs[0].get('data') or {}).get('main') or [[]])[0] or []:
                b = (i.get('json') or {}).get('body')
                if isinstance(b, dict) and b.get('stage') and b.get('status') != 'rejected': out.append(b)
    return out

# ---------------------------------------------------------------- formatting helpers
def money(v): return '—' if v is None else ('$' + format(v, '.2f') if v >= 0.1 or v == 0 else '$' + format(v, '.3f'))
def num(v):
    try: return format(int(round(float(v))), ',')
    except Exception: return E(v) if v not in (None, '') else '—'
def mins(m): return '—' if m is None else (f'{m * 60:.0f} s' if m < 1 else f'{m:.1f} min')
def secs(ms): return (f'{ms / 60000:.1f} min' if ms >= 90000 else f'{ms / 1000:.1f} s') if ms >= 1000 else f'{ms} ms'
def steps(n): return f"{n} step{'s' if n != 1 else ''}"
def clip(s, n):
    s = str(s or ''); return s if len(s) <= n else s[:n].rsplit(' ', 1)[0].rstrip(',;') + '…'
def pill(text, kind='neutral'): return f"<span class='pill {kind}'>{E(text)}</span>"
VERDICT_KIND = {'GO': 'good', 'GO_WITH_CHANGES': 'warn', 'AVOID': 'bad'}
def verdict_pill(v): return pill(str(v or '—').replace('_', ' '), VERDICT_KIND.get(v, 'neutral'))
def kv(rows): return "<table class='kv'>" + ''.join(f"<tr><th>{E(k)}</th><td>{v}</td></tr>" for k, v in rows if v not in (None, '', '—')) + "</table>"
def table(head, rows, cls=''):
    if not rows: return "<p class='muted'>none</p>"
    return f"<div class='tw'><table class='t {cls}'><thead><tr>" + ''.join(f"<th>{E(h)}</th>" for h in head) + "</tr></thead><tbody>" + ''.join("<tr>" + ''.join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows) + "</tbody></table></div>"
def ul(items): return "<ul>" + ''.join(f"<li>{E(i)}</li>" for i in items if i) + "</ul>" if items else ''
def bar(label, val, maxv):
    pct = 0 if not maxv else max(0, min(100, 100 * float(val or 0) / maxv))
    return f"<div class='bar'><span class='bl'>{E(label)}</span><span class='bt'><span class='bf' style='width:{pct:.0f}%'></span></span><span class='bv'>{num(val)} / {maxv}</span></div>"
def kd_label(kd):
    try: kd = float(kd)
    except Exception: return ''
    return 'very easy' if kd <= 14 else 'easy' if kd <= 29 else 'possible' if kd <= 49 else 'hard' if kd <= 69 else 'very hard'

def md_to_html(md):
    """The page's Markdown → HTML for the preview (headings, lists, tables, links, bold)."""
    def inline(t):
        t = E(t); t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t); t = re.sub(r'\[([^\[\]]+)\]\(([^)]+)\)', r"<a href='\2' target='_blank' rel='noopener'>\1</a>", t); return t
    out, lst, tbl = [], None, False
    for raw in md.split('\n'):
        l = raw.strip()
        if re.match(r'^(Title|Meta Description|Slug|Primary Keyword|Secondary Keywords):', l): continue
        if l.startswith('|'):
            if re.match(r'^\|[\s:|-]+\|$', l): continue
            cells = [c.strip() for c in l.strip('|').split('|')]
            if not tbl: out.append("<div class='tw'><table class='t'><thead><tr>" + ''.join('<th>' + inline(c) + '</th>' for c in cells) + '</tr></thead><tbody>'); tbl = True
            else: out.append('<tr>' + ''.join('<td>' + inline(c) + '</td>' for c in cells) + '</tr>')
            continue
        if tbl: out.append('</tbody></table></div>'); tbl = False
        if not l:
            if lst: out.append('</' + lst + '>'); lst = None
            continue
        m = re.match(r'^(#{1,4})\s+(.+)$', l)
        if m:
            if lst: out.append('</' + lst + '>'); lst = None
            lvl = min(4, len(m.group(1))); out.append(f'<h{lvl}>' + inline(m.group(2)) + f'</h{lvl}>'); continue
        m = re.match(r'^[-*]\s+(.+)$', l) or None
        if m:
            if lst != 'ul':
                if lst: out.append('</' + lst + '>')
                out.append('<ul>'); lst = 'ul'
            out.append('<li>' + inline(m.group(1)) + '</li>'); continue
        m = re.match(r'^\d+\.\s+(.+)$', l)
        if m:
            if lst != 'ol':
                if lst: out.append('</' + lst + '>')
                out.append('<ol>'); lst = 'ol'
            out.append('<li>' + inline(m.group(1)) + '</li>'); continue
        if lst: out.append('</' + lst + '>'); lst = None
        if l.startswith('<script') or l.startswith('<figure') or l.startswith('</figure') or l.startswith('<!--'): continue
        out.append('<p>' + inline(l) + '</p>')
    if lst: out.append('</' + lst + '>')
    if tbl: out.append('</tbody></table></div>')
    return '\n'.join(out)

# ---------------------------------------------------------------- what each stage produced
def produced(run, stage):
    P = []
    if stage == 'Intake, validation & guards':
        n = run.first('Normalize Input'); r = run.first('Rate Limit')
        P.append(kv([('Mode', E(n.get('mode'))), ('Keyword', E(n.get('keyword'))), ('Website', E(n.get('domain'))), ('Market', E(n.get('country'))), ('Goal', E(n.get('goal'))),
                     ('Ladder page', ('rung ' + E(n.get('ladder_rung')) + ' of the ladder for "' + E(n.get('ladder_head')) + '"') if n.get('ladder_rung') else None),
                     ('Delivery', 'callback to the test receiver (no e-mail)' if n.get('callback_url') and not n.get('email') else E(n.get('email') or n.get('callback_url'))),
                     ('AI spending guard', f"this run estimated at {money(r.get('ai_spend_estimate_usd'))}; {money(r.get('ai_budget_used_est_usd'))} used of the ${E(n.get('ai_budget_usd'))} daily cap" if r else None)]))
    elif stage == 'Site read & description':
        d = run.first('Route Mode') or run.first('Use Cached Description'); sd = d.get('site_description') or {}
        src = ('reused from the store (saved ' + E(d.get('site_description_cached')) + ')') if d.get('site_description_cached') else ('read from the homepage' if run.nruns('Read Website') else ('taken over from the run that started this one' if run.first('Normalize Input').get('ladder_id') else 'described in the request'))
        P.append(kv([('Source', src), ('Business', E(sd.get('business_name'))), ('In one line', E(sd.get('one_line_summary'))), ('Industry', E(sd.get('industry'))),
                     ('Services', E(clip(', '.join(sd.get('products_or_services') or []), 300))), ('Audience', E(', '.join(sd.get('target_audience') or [])))]))
    elif stage == 'Keyword pipeline: research':
        cu = run.first('Collect Site URLs'); cp = run.first('Collect Client Pages'); acp = run.first('Analyze Competitor Pages'); cf = run.first('Collect Facts'); mk = run.first('Merge Keyword Data')
        kd = mk.get('keyword_data') or {}; sa = mk.get('site_authority') or {}; sf = acp.get('serp_features') or {}
        P.append("<div class='grid3'>" + ''.join(f"<div class='mini'><div class='mv'>{v}</div><div class='ml'>{E(l)}</div></div>" for v, l in [
            (num(kd.get('search_volume')), 'searches per month'), (f"{num(kd.get('keyword_difficulty'))}<small>/100</small>", 'difficulty (' + kd_label(kd.get('keyword_difficulty')) + ')'),
            (num(acp.get('competitors_read')), 'competitor pages read'), (num(len(cf.get('facts') or [])), 'verified facts with sources'),
            (num(cu.get('site_urls_count')), 'pages found on the site'), (num(sa.get('top10')) if sa else '—', 'site keywords in Google top 10')] if v not in ('—', '0')) + "</div>")
        comps = acp.get('competitors') or []
        if comps: P.append("<h4>Who ranks today (Google top results, read in full)</h4>" + table(['#', 'Website', 'Page title', 'Words'], [[E(c.get('rank')), E(c.get('domain')), E(str(c.get('title', ''))[:90]), num(c.get('word_count'))] for c in comps[:8]]))
        if sf.get('people_also_ask'): P.append("<h4>Questions people ask Google</h4>" + ul(sf.get('people_also_ask')[:6]))
        aio = (sf.get('ai_overview') or {})
        if aio.get('cited_domains'): P.append("<p><b>Google AI Overview</b> shown; it cites: " + E(', '.join(aio.get('cited_domains')[:8])) + "</p>")
        facts = cf.get('facts') or []
        if facts: P.append("<h4>Verified facts the page may use (each with its source)</h4>" + table(['Fact', 'Source'], [[E(re.sub(r'\s*(Read more|\.\.\.|…)+\s*$', '…', str(f.get('claim') or f.get('fact') or '')[:220])), E(f.get('source'))] for f in facts[:6]]))
        bs = kd.get('competitor_backlink_strength') or {}
        if bs: P.append(f"<p class='muted'>Competing pages average {num(bs.get('avg_referring_domains'))} referring domains (sites linking to them), so the link barrier is {'low' if (bs.get('avg_referring_domains') or 0) < 15 else 'moderate' if (bs.get('avg_referring_domains') or 0) < 50 else 'high'}.</p>")
    elif stage == 'Verdict':
        v = run.first('Parse Verdict')
        P.append(f"<p class='verdict'>{verdict_pill(v.get('verdict'))} <span class='score'>{num(v.get('verdict_score'))}<small>/100</small></span></p>")
        P.append(kv([('Expected visits / month at positions 1-3', num(v.get('expected_visits_top3'))), ('Expected time to rank', (E(v.get('time_to_rank_months')) + ' months') if v.get('time_to_rank_months') else None),
                     ('Recommended page type', E(v.get('recommended_page')))]))
        if v.get('verdict_reasons'): P.append("<h4>Why</h4>" + ul(v.get('verdict_reasons')[:5]))
        if v.get('verdict_changes'): P.append("<h4>What must change to win</h4>" + ul(v.get('verdict_changes')[:5]))
    elif stage == 'Keyword ladder':
        L = run.first('Ladder Plan').get('ladder') or {}; st = L.get('stats') or {}; pool = (run.first('Ladder Pool').get('research') or {})
        P.append("<div class='grid3'>" + ''.join(f"<div class='mini'><div class='mv'>{v}</div><div class='ml'>{E(l)}</div></div>" for v, l in [
            (num(st.get('pool_size') or pool.get('pool_size')), 'related keywords researched'), (num(st.get('relevant')), 'judged relevant by the AI screen'), (num(st.get('pages_total')), 'pages in the plan'),
            (num(st.get('keywords_covered')), 'keywords covered'), (num(st.get('traffic_potential_total')), 'monthly visits potential (est.)'), (num(len(run.items('Ladder Rows'))), 'rows saved for weekly tracking')]) + "</div>")
        P.append(ladder_html(L))
        if L.get('requirements'): P.append("<h4>What else it needs to win</h4>" + ul([r.get('item', '') + ': ' + r.get('detail', '') for r in L['requirements'][:5]]))
        sp = run.items('Spawn Page Runs')
        if sp: P.append("<p><b>Writing started now:</b> " + E(', '.join('"' + str((s.get('body') or s).get('keyword', '')) + '"' for s in sp if isinstance(s, dict))) + " — written in its own run (below).</p>")
    elif stage == 'Content context: profile, proof, page role, video (v4.4)':
        b = run.first('Brief Context')
        P.append(kv([('Page role', E(b.get('page_role'))), ('Author on file', E((b.get('author') or {}).get('name')) or 'none yet (placeholders in the author box)'), ('Case studies on file', num(len(b.get('proof_library') or []))), ('Hub pages linked', num(len(b.get('hub_pages') or [])))]))
    elif stage == 'Content generation & QA':
        P.append(content_html(run))
    elif stage == 'Report & delivery (keyword / content)':
        bp = run.first('Blog Package'); m = bp.get('article_meta') or {}
        P.append(kv([('Report', 'Word-compatible report + PDF (rendered by Gotenberg)'), ('Blog package', 'article HTML, Markdown and meta.json (SEO title, description, slug, schema, image plan, Open Graph)' if bp else None),
                     ('Delivered to', 'the callback (test receiver); no e-mail was sent')]))
    return ''.join(P)

STATUS = {'new': 'planned', 'planned': 'planned', 'writing': 'being written', 'published': 'published'}
def ladder_html(L):
    rows = []
    for r in L.get('rungs') or []:
        for p in r.get('pages') or []:
            rows.append([f"<span class='rung r{E(r.get('rung'))}'>{'Top' if r.get('rung') == 4 else 'Rung ' + str(r.get('rung'))}</span>", '<b>' + E(p.get('keyword')) + '</b>' + (f"<div class='muted small'>also: {E(', '.join((p.get('supporting') or [])[:3]))}</div>" if p.get('supporting') else ''),
                         E(p.get('page_type')), num(p.get('volume')), (num(p.get('kd')) + '<div class=\'muted small\'>' + kd_label(p.get('kd')) + '</div>') if p.get('kd') is not None else "<span class='muted'>n/a</span>",
                         "<span class='nw'>months " + '–'.join(str(x) for x in (r.get('months') or [])) + '</span>' if r.get('months') else '—', pill('existing page', 'good') if p.get('exists') else pill(STATUS.get(p.get('status'), p.get('status') or 'planned'), 'good' if p.get('status') in ('writing', 'published') else 'neutral')])
    top = L.get('top') or L.get('top_page') or {}
    if top:
        tkd = top.get('kd') if top.get('kd') is not None else (L.get('head') or {}).get('kd')
        rows.append(["<span class='rung r4'>Top</span>", '<b>' + E(top.get('keyword') or (L.get('head') or {}).get('keyword')) + '</b><div class=\'muted small\'>the main page every step links up to</div>', E(top.get('page_type')), num(top.get('volume') or (L.get('head') or {}).get('volume')),
                     (num(tkd) + '<div class=\'muted small\'>' + kd_label(tkd) + '</div>') if tkd is not None else '—', "<span class='nw'>months " + '–'.join(str(x) for x in ((L.get('timeline') or [{}])[-1].get('months') or [])) + '</span>', pill(STATUS.get(top.get('status'), top.get('status') or 'planned'), 'neutral')])
    f = L.get('feasibility') or {}
    head = (f"<p>Main keyword <b>\"{E((L.get('head') or {}).get('keyword'))}\"</b>: {num((L.get('head') or {}).get('volume'))} searches a month, difficulty {num((L.get('head') or {}).get('kd'))}/100. "
            f"Feasibility: {pill(f.get('status') or '—', 'good' if f.get('status') == 'winnable' else 'warn')}. Pages link upward to the top page and sideways to their neighbours ({num(len(L.get('link_map') or []))} planned internal links).</p>")
    return "<h4>The ladder: easier pages first, each one lifting the next</h4>" + head + table(['Step', 'Keyword (page topic)', 'Page type', 'Searches / mo', 'Difficulty', 'When', 'Status'], rows, 'ladder')

def content_html(run):
    P = []
    pb = run.first('Parse Brief').get('content_brief') or {}
    if pb:
        P.append("<h4>1 · The brief (content strategist)</h4>" + kv([('Headline (H1)', E(pb.get('h1'))), ('Search intent', E(pb.get('search_intent'))), ('Target length', num(pb.get('target_word_count')) + ' words'),
            ('Unique angle', E(pb.get('unique_angle'))), ('Sections planned', num(len(pb.get('outline') or []))), ('FAQs planned', num(len(pb.get('faqs') or []))), ('Facts to cite', num(len(pb.get('evidence_plan') or [])))]))
        if pb.get('outline'): P.append("<details><summary>Planned outline</summary>" + ul([(o.get('h2') or o.get('heading') or '') if isinstance(o, dict) else str(o) for o in pb['outline']]) + "</details>")
    draft = run.first('Copywriter').get('output') or ''
    if draft: P.append(f"<h4>2 · The first draft (copywriter)</h4><p>{num(len(str(draft).split()))} words written to the brief.</p>")
    c = run.first('Parse Critique').get('critique') or {}
    if c:
        P.append(f"<h4>3 · Editorial review (critic)</h4><p>Score <b>{num(c.get('score'))}/100</b> · verdict {pill(c.get('verdict') or '—', 'good' if c.get('verdict') == 'publish' else 'warn')}</p>")
        if c.get('strengths'): P.append("<div class='two'><div><b>Strengths</b>" + ul(c['strengths'][:4]) + "</div><div><b>Problems raised</b>" + ul([('[' + str(p.get('severity', '')) + '] ' + str(p.get('issue', ''))) for p in (c.get('problems') or [])[:5]]) + "</div></div>")
    qn = run.nruns('Content QA')
    if qn:
        q1 = run.first('Content QA', 0).get('content_qa') or {}; qf = run.first('Content QA', -1).get('content_qa') or {}
        ed = run.nruns('Editor')
        P.append("<h4>4 · Automatic quality control" + (" and one revision by the editor" if ed else '') + "</h4>")
        if ed and qn > 1: P.append(f"<p>First draft scored <b>{num(q1.get('content_score'))}</b>; after the editor's revision the page scores <b>{num(qf.get('content_score'))}/100</b>.</p>")
        elif not ed and q1.get('editor_needed') is False: P.append(f"<p>The draft passed every SEO check (score <b>{num(q1.get('content_score'))}</b>), so the editor pass was skipped.</p>")
        else: P.append(f"<p>Final score <b>{num(qf.get('content_score'))}/100</b>.</p>")
        b = qf.get('score_breakdown') or {}
        P.append("<div class='bars'>" + ''.join(bar(lbl, b.get(k), mx) for k, lbl, mx in [('structure', 'Structure (title, headings, FAQs, table, links)', 25), ('coverage', 'Topic coverage vs top pages', 25), ('readability', 'Readability', 15), ('specificity', 'Specific, concrete detail', 10), ('clean_language', 'No filler / AI clichés', 10), ('length', 'Length on target', 15)]) + "</div>")
        P.append(kv([('Words (main content)', num(qf.get('main_content_words')) + ' (target ' + num(qf.get('target_word_count')) + ')'), ('Topic coverage', num(qf.get('coverage_pct')) + '% of the terms top pages share'),
            ('Readability', ('Flesch ' + E((qf.get('readability') or {}).get('flesch')) + ', ' + E((qf.get('readability') or {}).get('avg_sentence_words')) + ' words per sentence') if qf.get('readability') else None),
            ('FAQs', num(qf.get('faq_count'))), ('Internal links', num(qf.get('internal_links'))), ('Sources cited', num(len(qf.get('sources_cited') or []))), ('Structured data generated', E(', '.join(qf.get('schema_types') or [])))]))
        if qf.get('warnings'): P.append("<details><summary>Items left for a human to review (" + str(len(qf['warnings'])) + ")</summary>" + ul([w[:260] for w in qf['warnings']]) + "</details>")
    return ''.join(P)

# ---------------------------------------------------------------- page
CSS = """
:root{--bg:#F5F7FB;--card:#FFFFFF;--ink:#0F172A;--ink2:#334155;--muted:#64748B;--line:#E2E8F0;--navy:#0B1F3A;--accent:#2563EB;--accent2:#0EA5E9;--good:#15803D;--goodbg:#DCFCE7;--warn:#B45309;--warnbg:#FEF3C7;--bad:#B91C1C;--badbg:#FEE2E2;--chip:#EEF2FF}
*{box-sizing:border-box}html{background:var(--bg)}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:1120px;margin:0 auto;padding:0 20px}
header.hero{background:linear-gradient(135deg,#0B1F3A 0%,#13315C 60%,#1E4C8A 100%);color:#fff;padding:44px 0 92px}
.hero .eyebrow{letter-spacing:.14em;text-transform:uppercase;font-size:12px;color:#93C5FD;font-weight:600}
.hero h1{font-size:34px;line-height:1.2;margin:10px 0 8px;font-weight:800}.hero p{color:#CBD5E1;max-width:820px;margin:0}
.hero .meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}.hero .meta span{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);padding:4px 10px;border-radius:999px;font-size:13px;color:#E2E8F0}
.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-top:-64px}
.kpi{background:var(--card);border-radius:14px;padding:16px 16px 14px;box-shadow:0 10px 30px rgba(15,23,42,.08);border:1px solid var(--line)}
.kpi .l{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;font-weight:600}.kpi .v{font-size:26px;font-weight:800;margin-top:4px;line-height:1.15}.kpi .v small{font-size:14px;color:var(--muted);font-weight:600}.kpi .s{font-size:13px;color:var(--ink2);margin-top:4px}
section{margin:34px 0}h2{font-size:22px;margin:0 0 6px;font-weight:800}h2+.lead{color:var(--ink2);margin:0 0 16px}h3{font-size:18px;margin:0}h4{font-size:15px;margin:18px 0 8px;color:var(--navy)}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:22px;box-shadow:0 2px 8px rgba(15,23,42,.04)}
.summary p{margin:0 0 10px}.summary ul{margin:6px 0 0 18px;padding:0}
.flow{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;align-items:stretch}
.step{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 12px 10px;position:relative}
.step .n{width:26px;height:26px;border-radius:50%;background:var(--accent);color:#fff;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center}
.step .t{font-weight:700;font-size:14px;margin-top:8px;line-height:1.3}.step .d{color:var(--muted);font-size:12.5px;margin-top:4px}
.run-head{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;align-items:baseline;margin:6px 0 14px}.run-head .muted{font-size:14px}
.stage{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:12px;padding:18px 20px;margin:14px 0;break-inside:avoid-page}
.stage .sh{display:flex;justify-content:space-between;gap:12px;align-items:baseline;flex-wrap:wrap}.stage .sh .badge{font-size:12.5px;color:var(--muted)}
.stage .why{color:var(--ink2);margin:6px 0 4px}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0}.mini{background:#F8FAFC;border:1px solid var(--line);border-radius:10px;padding:10px 12px}.mini .mv{font-size:22px;font-weight:800}.mini .mv small{font-size:13px;color:var(--muted)}.mini .ml{font-size:12.5px;color:var(--muted)}
.tw{overflow-x:auto}table.t{border-collapse:collapse;width:100%;font-size:13.5px;margin:6px 0 10px}table.t th{background:#F1F5F9;text-align:left;padding:8px 10px;font-weight:700;color:var(--ink2);border-bottom:1px solid var(--line);white-space:nowrap}table.t td{padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}table.t tr:nth-child(even) td{background:#FAFBFD}
table.kv{border-collapse:collapse;width:100%;font-size:14px;margin:8px 0}table.kv th{width:250px;text-align:left;color:var(--muted);font-weight:600;padding:6px 10px 6px 0;vertical-align:top}table.kv td{padding:6px 0}
.pill{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12.5px;font-weight:700;background:var(--chip);color:#3730A3}.pill.good{background:var(--goodbg);color:var(--good)}.pill.warn{background:var(--warnbg);color:var(--warn)}.pill.bad{background:var(--badbg);color:var(--bad)}
.verdict{font-size:16px;margin:8px 0}.verdict .score{font-weight:800;font-size:22px;margin-left:8px}.verdict .score small{color:var(--muted);font-size:13px}
.rung{display:inline-block;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700;white-space:nowrap}.r1{background:#DCFCE7;color:#166534}.r2{background:#E0F2FE;color:#075985}.r3{background:#FEF3C7;color:#92400E}.r4{background:#EDE9FE;color:#5B21B6}
.bars{margin:10px 0}.bar{display:grid;grid-template-columns:280px 1fr 70px;gap:10px;align-items:center;font-size:13.5px;margin:6px 0}.bt{height:10px;background:#E2E8F0;border-radius:999px;overflow:hidden}.bf{display:block;height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:999px}.bv{color:var(--muted);text-align:right}
.two{display:grid;grid-template-columns:1fr 1fr;gap:16px}.two ul{margin:6px 0 0 18px;padding:0}
.muted{color:var(--muted)}.nw{white-space:nowrap}.small{font-size:12.5px}
details{margin:8px 0}details summary{cursor:pointer;color:var(--accent);font-weight:600;font-size:14px}details[open] summary{margin-bottom:6px}
.serp{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px 18px;max-width:680px}.serp .u{color:#202124;font-size:13px}.serp .ti{color:#1a0dab;font-size:19px;line-height:1.3;margin:2px 0}.serp .de{color:#4d5156;font-size:14px}
.article{background:#fff;border:1px solid var(--line);border-radius:14px;padding:30px 36px;max-height:900px;overflow:auto;font-size:15.5px;line-height:1.7}.article h1{font-size:28px;line-height:1.25;margin:0 0 12px}.article h2{font-size:21px;margin:26px 0 8px}.article h3{font-size:17px;margin:18px 0 6px}.article a{color:var(--accent)}.article ul,.article ol{padding-left:22px}
iframe.doc{width:100%;height:880px;border:1px solid var(--line);border-radius:12px;background:#fff}
.files{display:flex;flex-wrap:wrap;gap:10px;margin:10px 0}.files a{display:inline-flex;align-items:center;gap:6px;background:var(--navy);color:#fff;text-decoration:none;padding:8px 14px;border-radius:10px;font-weight:600;font-size:14px}
.note{border-left:4px solid var(--warn);background:var(--warnbg);padding:12px 16px;border-radius:8px;color:#78350F}
.trace td:nth-child(3),.trace td:nth-child(4),.trace td:nth-child(5){white-space:nowrap}
footer{color:var(--muted);font-size:13px;padding:30px 0 50px;border-top:1px solid var(--line);margin-top:40px}
@media (max-width:900px){.kpis{grid-template-columns:repeat(2,1fr)}.grid3{grid-template-columns:repeat(2,1fr)}.two{grid-template-columns:1fr}.bar{grid-template-columns:1fr 1fr 60px}table.kv th{width:150px}.hero h1{font-size:26px}.article{padding:20px}}
@media print{header.hero{-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:28px 0 80px}.kpi,.card,.stage{box-shadow:none}.article{max-height:none;overflow:visible}iframe.doc{display:none}.noprint{display:none}section{break-inside:auto}}
"""

def placeholder_note(md, price_issue=False):
    ph = re.findall(r'\[(?!Statistic\])([A-Z][^\[\]]{1,60})\](?!\()', md)   # [Price], [Author insight: …]; not link texts
    if not ph: return ''
    kinds = {}
    for p in ph: k = p.split(':')[0].strip(); kinds[k] = kinds.get(k, 0) + 1
    if price_issue and set(kinds) == {'Price'}:
        return ("<div class='note' style='margin-top:12px'><b>" + str(len(ph)) + " amounts shown as [Price]:</b> these are the official fine amounts from the verified sources (AED per month, per invoice). "
                "The safeguard that stops the system from inventing a client's own prices masked them too; this test found it, and the fix is described under Notes. Fill them back in before publishing.</div>")
    return ("<div class='note' style='margin-top:12px'><b>Left for the business to fill before publishing (" + str(len(ph)) + "):</b> " + E(', '.join(f'{k} ×{n}' if n > 1 else k for k, n in sorted(kinds.items(), key=lambda x: -x[1])[:10]))
            + ". The system never invents prices, names or credentials it cannot verify; it leaves a marked placeholder instead.</div>")
def run_label(r, runs):
    mode = r.first('Normalize Input').get('mode')
    return f"Run {runs.index(r) + 1} — " + ('ranking plan' if mode == 'ladder' else 'page: ' + str(r.first('Normalize Input').get('keyword') or ''))
def build(runs, cbs, title, subtitle):
    L_run = next((r for r in runs if r.first('Normalize Input').get('mode') == 'ladder'), None)
    P_runs = [r for r in runs if r is not L_run]
    L = L_run.first('Ladder Plan').get('ladder') if L_run else {}
    v = (L_run or runs[0]).first('Parse Verdict')
    page = P_runs[0] if P_runs else None
    qf = (page.first('Content QA', -1).get('content_qa') or {}) if page else {}
    meta = (page.first('Content QA', -1).get('meta') or {}) if page else {}
    article_md = (page.first('Content QA', -1).get('output') or '') if page else ''
    total_min = sum(r.minutes() or 0 for r in runs)
    ledgers = [b.get('run_ledger') for b in cbs if b.get('run_ledger')]
    dfs = sum(float(l.get('dataforseo_usd') or 0) for l in ledgers)
    ai_est = sum(float(r.first('Rate Limit').get('ai_spend_estimate_usd') or 0) for r in runs)
    st = (L or {}).get('stats') or {}
    n_ph = len(re.findall(r'\[(?!Statistic\])([A-Z][^\[\]]{1,60})\](?!\()', article_md))
    facts_txt = ' '.join(str(f.get('claim') or '') for f in (page.first('Collect Facts').get('facts') or [])) if page else ''
    price_issue = '[Price]' in article_md and bool(re.search(r'AED\s?\d', facts_txt))
    n_steps = len([x for x in (L or {}).get('rungs') or [] if x.get('pages')]) + (1 if (L or {}).get('top') else 0)   # rungs with pages + the top page
    n_pages = st.get('pages_total') or sum(len(x.get('pages') or []) for x in (L or {}).get('rungs') or [])
    kws = list(dict.fromkeys(str(p.get('keyword')) for x in sorted((L or {}).get('rungs') or [], key=lambda x: x.get('rung') or 0) for p in x.get('pages') or []))   # plan order
    domain = (L_run or runs[0]).first('Normalize Input').get('domain'); head = (L or {}).get('head', {}).get('keyword') or v.get('keyword')
    when = datetime.datetime.fromisoformat(runs[0].start.replace('Z', '+00:00'))
    H = []
    H.append(f"""<header class='hero'><div class='wrap'><div class='eyebrow'>SEO Agent · live run report</div><h1>{E(title)}</h1><p>{E(subtitle)}</p>
<div class='meta'><span>{when.strftime('%d %B %Y, %H:%M')} UTC</span><span>Website: {E(domain)}</span><span>Market: {E((L_run or runs[0]).first('Normalize Input').get('country'))}</span><span>{len(runs)} automated runs · {sum(len(r.rd) for r in runs)} steps executed</span><span>Status: {'completed' if all(r.status == 'success' for r in runs) else 'see notes'}</span></div></div></header>""")
    # KPIs
    k = [('Decision', verdict_pill(v.get('verdict')) + f" <small>{num(v.get('verdict_score'))}/100</small>", 'for "' + E(head) + '"'),
         ('Ranking plan', f"{num(n_pages)} <small>pages</small>", f"{n_steps} steps up to the main keyword"),
         ('Page written', f"{num(qf.get('main_content_words'))} <small>words</small>" if qf else '—', f"quality score {num(qf.get('content_score'))}/100" if qf else 'not part of this run'),
         ('Time', f"{total_min:.0f} <small>min</small>", 'fully automatic, no human input'),
         ('Cost', f"{money(dfs + ai_est)}", f"data {money(dfs)} + AI {money(ai_est)} (est.)")]
    H.append("<div class='wrap'><div class='kpis'>" + ''.join(f"<div class='kpi'><div class='l'>{E(a)}</div><div class='v'>{b}</div><div class='s'>{c}</div></div>" for a, b, c in k) + "</div>")
    # summary
    reasons = (v.get('verdict_reasons') or [])[:2]
    first_page = ((L or {}).get('write_now') or [{}])[0].get('keyword') if L else None
    H.append(f"""<section><h2>Summary</h2><div class='card summary'>
<p>We asked the SEO Agent to <b>get {E(domain)} ranking on Google for "{E(head)}"</b> in {E((L_run or runs[0]).first('Normalize Input').get('country'))}. Nobody touched the system after the request; it researched, decided, planned and wrote on its own and delivered everything in {total_min:.0f} minutes.</p>
<ul><li><b>Decision:</b> {E(str(v.get('verdict') or '').replace('_', ' '))} ({num(v.get('verdict_score'))}/100). {E(reasons[0][:330]) if reasons else ''}</li>
<li><b>Plan:</b> rather than competing for the main keyword straight away, the system planned <b>{num(n_pages)} pages</b> in {n_steps} steps, starting with easier, related searches ({E(', '.join(kws[:4]))}{'…' if len(kws) > 4 else ''}) that lead up to the main page. The plan was saved, so rankings are checked automatically every week.</li>
{f"<li><b>First page:</b> \"{E(meta.get('title'))}\", {num(qf.get('main_content_words'))} words, quality score {num(qf.get('content_score'))}/100, with sources, FAQs, a comparison table and structured data for Google (topic: \"{E(first_page)}\"){(', ready for a final review; this test found that a safeguard masked the ' + str(n_ph) + ' fine amounts in it as [Price] (see Notes)') if price_issue else ((', ready for a final human review: ' + str(n_ph) + ' marked placeholders to fill before publishing') if n_ph else ', ready to publish')}.</li>" if qf else ''}
<li><b>Cost:</b> {money(dfs + ai_est)} for the whole run (search data {money(dfs)}, AI writing and analysis about {money(ai_est)}).</li>
<li><b>Next, automatically:</b> weekly rank checks for every page in the plan; when a step reaches the top 10, the next page is recommended; the weekly content schedule writes the next pages.</li></ul></div></section>""")
    # how it works
    H.append("<section><h2>How the system worked, step by step</h2><p class='lead'>Each box is a stage of the automated pipeline; the numbers are the real timings of this run. Below, every stage shows what it produced.</p>")
    for r in runs:
        stg = [(s, d) for s, d in stages_of(r) if s not in ('Other steps',)]
        label = 'Run 1 — research, decision and ranking plan' if r is L_run else 'Run ' + str(runs.index(r) + 1) + ' — writing the first page of the plan (started automatically by run 1)'
        H.append(f"<div class='run-head'><h3>{E(label)}</h3><span class='muted'>n8n execution {E(r.eid)} · {mins(r.minutes())} · {len(r.rd)} steps</span></div><div class='flow'>" +
                 ''.join(f"<div class='step'><div class='n'>{i + 1}</div><div class='t'>{E(PLAIN.get(s, (s, ''))[0])}</div><div class='d'>{secs(d['end'] - d['start'])} · {steps(len(d['nodes']))}</div></div>" for i, (s, d) in enumerate(stg)) + "</div>")
        for i, (s, d) in enumerate(stg):
            t, why = PLAIN.get(s, (s, ''))
            body = produced(r, s)
            H.append(f"<div class='stage'><div class='sh'><h3>{i + 1}. {E(t)}</h3><span class='badge'>{secs(d['end'] - d['start'])} · {steps(len(d['nodes']))}</span></div><p class='why'>{E(why)}</p>{body}"
                     f"<details><summary>Technical detail: the {steps(len(d['nodes']))} in the workflow</summary>" + table(['Step (n8n node)', 'Runs', 'Items out', 'Time'], [[E(n['node']) + (f" <span class='pill bad'>error</span>" if n['error'] else '') + (f" <span class='pill warn'>retried</span>" if n.get('retried') else ''), num(n['runs']), num(n['items']), secs(n['ms'])] for n in d['nodes']], 'trace') + "</details></div>")
    H.append("</section>")
    # the page
    if article_md:
        slug = meta.get('slug') or ''
        H.append(f"""<section><h2>The page the system wrote</h2><p class='lead'>How it would appear in Google, and the full text as delivered (also delivered as HTML, Markdown and a PDF report).</p>
<div class='serp'><div class='u'>{E(domain)} › {E(slug)}</div><div class='ti'>{E(meta.get('title'))}</div><div class='de'>{E(meta.get('description'))}</div></div>
<p class='muted small'>Title {num(qf.get('meta_title_length'))} characters (limit 60) · description {num(qf.get('meta_description_length'))} characters (limit 155)</p>
<p class='muted small noprint'>The full page is below (scroll inside the frame).</p><div class='article'>{md_to_html(article_md)}</div>{placeholder_note(article_md, price_issue)}</section>""")
    # delivered documents
    docs = []
    for b in cbs:
        f = b.get('file') or {}; p = b.get('pdf') or {}
        name = {'ladder_plan': 'Keyword Ladder Plan', 'content': 'Keyword report + page content'}.get(b.get('stage'), b.get('stage'))
        docs.append((name, b.get('stage'), f, p))
    if docs:
        H.append("<section><h2>What was delivered</h2><p class='lead'>The documents the caller received, exactly as delivered. Download buttons give the PDFs; the documents are shown below.</p><div class='files noprint'>" +
                 ''.join(f"<a download='{E((p.get('fileName') or (n + '.pdf')))}' href='data:application/pdf;base64,{p.get('data')}'>⬇ {E(n)} (PDF)</a>" for n, s, f, p in docs if p.get('data')) + "</div>")
        H.append(table(['Delivery (callback stage)', 'Contents'], [[E(s), E(n) + (' — PDF ' + num(len(base64.b64decode(p['data'])) // 1024) + ' KB' if p.get('data') else '')] for n, s, f, p in docs]))
        for n, s, f, p in docs:
            if f.get('data'):
                try: docu = base64.b64decode(f['data']).decode('utf-8', 'ignore')
                except Exception: docu = ''
                if docu: H.append(f"<details class='noprint'><summary>Open the delivered document: {E(n)}</summary><iframe class='doc' sandbox='' srcdoc=\"{html.escape(docu, quote=True)}\"></iframe></details>")
        H.append("</section>")
    # cost and time
    rows = []
    for r in runs:
        lg = next((b.get('run_ledger') for b in cbs if b.get('run_ledger') and str(b.get('execution_id', '')) == r.eid), None) or {}
        toks = r.tokens(); tin = sum(x['in'] for x in toks.values()); tout = sum(x['out'] for x in toks.values())
        rows.append([E(run_label(r, runs)), mins(r.minutes()), money(lg.get('dataforseo_usd')) + f" <span class='muted small'>({num(lg.get('dataforseo_calls'))} calls)</span>" if lg else '—',
                     money(float(r.first('Rate Limit').get('ai_spend_estimate_usd') or 0)), num(lg.get('ai_calls')) if lg else '—', (num(tin) + ' in / ' + num(tout) + ' out') if toks else '—'])
    H.append("<section><h2>Time and cost</h2><p class='lead'>Search data is billed per request (DataForSEO, measured). AI cost is the system's own estimate per run type; the long writing calls stream their output and do not report token counts, so only the analysis calls are measured.</p>" +
             table(['Run', 'Duration', 'Search data (measured)', 'AI (estimate)', 'AI calls', 'AI tokens measured'], rows) + "</section>")
    # notes
    notes = []
    errs = [(r.eid, n) for r in runs for n in r.trace() if n['error']]
    for eid, n in errs: notes.append(f"Execution {eid}: step \"{n['node']}\" failed: {n['error']}")
    for r in runs:
        for n in r.trace():
            if n.get('retried'): notes.append(f"Execution {r.eid}: the AI call in \"{n['node']}\" was cut off once by the provider (\"{n['retried']}\") and retried automatically; the retry succeeded, and the run took longer because of it.")
    if page and '[Price]' in article_md:
        facts_txt = ' '.join(str(f.get('claim') or '') for f in page.first('Collect Facts').get('facts') or [])
        amts = sorted(set(re.findall(r'AED\s?\d[\d,.]*(?:\s?(?:million|m))?', facts_txt)))[:4]
        if amts: notes.append('Found by this test: the safeguard that stops the system from inventing a client\'s prices also replaced amounts that came from verified sources (the official fines, e.g. ' + ', '.join(amts) + ') with [Price], including in the meta description. Fix proposed: keep amounts that appear in the verified facts, mask only unsourced prices.')
    if L_run: notes.append('This run created a new ladder for "' + str(head) + '" next to the one planned on 2026-10-01; one of the two should be removed so the weekly tracker does not check the same keywords twice.')
    if notes: H.append("<section><h2>Notes</h2><div class='note'>" + ul(notes) + "</div></section>")
    H.append(f"<footer>Generated by run_report.py from the n8n execution data ({', '.join('execution ' + r.eid for r in runs)}) on {datetime.datetime.now(datetime.timezone.utc).strftime('%d %B %Y, %H:%M')} UTC. SEO Agent v4.6 · n8n.</footer></div>")
    return ("<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>SEO Agent Run Report</title>"
            "<link rel='preconnect' href='https://fonts.googleapis.com'><link href='https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap' rel='stylesheet'>"
            f"<style>{CSS}</style><script>window.addEventListener('beforeprint',()=>document.querySelectorAll('details').forEach(d=>d.open=true));</script></head><body>" + ''.join(H) + "</body></html>")

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--exec', action='append', required=True); ap.add_argument('--out'); ap.add_argument('--title'); ap.add_argument('--subtitle')
    a = ap.parse_args()
    if not KEY: sys.exit('N8N_API_KEY missing in n8n/.env')
    runs = [Run(x) for x in a.exec]
    t0 = min(r.start for r in runs); t1 = max((r.stop or r.start) for r in runs)
    t1p = (datetime.datetime.fromisoformat(t1.replace('Z', '+00:00')) + datetime.timedelta(minutes=2)).isoformat().replace('+00:00', 'Z')
    ids = {r.eid for r in runs}
    cbs = [b for b in callbacks(t0, t1p) if str(b.get('execution_id') or '') in ids]   # only what these runs delivered
    head = next((r.first('Ladder Plan').get('ladder', {}).get('head', {}).get('keyword') for r in runs if r.nruns('Ladder Plan')), None) or runs[0].first('Normalize Input').get('keyword')
    dom = runs[0].first('Normalize Input').get('domain')
    title = a.title or f'Getting {dom} to rank for "{head}"'
    sub = a.subtitle or 'What the SEO Agent did, step by step, from one request: research, a go / no-go decision, a ranking plan and a finished page, with timings, costs and every document it delivered.'
    out = a.out or os.path.join(HERE, 'docs', 'run-reports', f"{runs[0].start[:10]}-{re.sub(r'[^a-z0-9]+', '-', str(head).lower()).strip('-')}.html")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w', encoding='utf-8').write(build(runs, cbs, title, sub))
    print('wrote', out, os.path.getsize(out) // 1024, 'KB;', len(cbs), 'callbacks;', sum(len(r.rd) for r in runs), 'steps')
