#!/usr/bin/env python3
"""Generates docs/SEO_Agent_v4.2_Developer_Guide.html (+ .pdf through the Gotenberg service): how the agent works,
every workflow and node explained, build/test/deploy procedure, and the live system test of 2026-10-01 with the node
trace of every run. Node descriptions are derived from the workflow JSON (leading comments of Code nodes, HTTP targets,
IF conditions, agent prompts) plus a short hand-written text per stage."""
import json, os, re, html, glob, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); WF = os.path.join(HERE, 'workflows'); DOCS = os.path.join(HERE, 'docs'); RUNS = os.path.join(DOCS, 'runs')
os.makedirs(DOCS, exist_ok=True)
E = lambda s: html.escape(str(s if s is not None else ''))
def load(f): d = json.load(open(os.path.join(WF, f))); return d[0] if isinstance(d, list) else d
WORKFLOWS = [('SEO_Agent_v4.json', 'SEO Agent v4 — Audit, Keywords, Verdict & Content', 'main workflow: every mode, the keyword ladder, delivery'),
             ('SEO_Agent_API.json', 'SEO Agent — API', 'webhook front door: validates, answers 202/400, starts the main workflow'),
             ('SEO_Agent_Rank_Tracker.json', 'SEO Agent — Rank Tracker', 'weekly position checks for every ladder, progress e-mail / callback'),
             ('SEO_Agent_Publish_WordPress.json', 'SEO Agent — Publish to WordPress', 'optional: generated page → WordPress draft (inactive sub-workflow)'),
             ('SEO_Agent_Error_Handler.json', 'SEO Agent — Error Handler', 'error workflow: e-mails ops when a run fails'),
             ('SEO_Agent_Test_Callback_Receiver.json', 'SEO Agent — Test Callback Receiver', 'testing: stores API callbacks as executions'),
             ('SEO_Agent_Test_Runner.json', 'SEO Agent — Test Runner', 'testing only: starts any SEO Agent workflow with a JSON body (kept unpublished)')]
WFS = {f: load(f) for f, _, _ in WORKFLOWS}
MAIN = WFS['SEO_Agent_v4.json']

# ---------------------------------------------------------------- stages of the main workflow (hand-written context)
STAGES = [
 ('Entry points & forms', 'A six-option public form (basic auth) or the Execute Workflow Trigger "API Entry", which the API front door, the ladder page runs, the discovery follow-ups and the audit-form spawns all use. Each form option opens its own page of fields.',
  ['Start Form', 'Choose Path', 'Page Keyword', 'Page Discover', 'Page Describe', 'Page Audit', 'Page Verdict', 'Page Ladder', 'Unmatched Choice', 'API Entry']),
 ('Intake, validation & guards', 'Normalize Input turns any form page or API body into one normalised object (mode, keyword, domain, country codes, deliverables, ladder fields, CONFIG values). Validation problems are returned as data, not thrown; Rate Limit enforces the per-address daily limit and the estimated Claude budget; Input OK? routes errors to a form page or to the caller\'s callback.',
  ['Normalize Input', 'Rate Limit', 'Input OK?', 'Error Via API?', 'API Reject', 'POST Rejection', 'Show Input Error']),
 ('Site read & description', 'When the business is not described, the homepage is read through Jina Reader and summarised by Claude Haiku into a structured site description (services, audience, USPs, seed keywords); unreadable sites get an honest fallback.',
  ['Need Site Read?', 'Read Website', 'Clean Site Text', 'Site Read OK?', 'Site Describer', 'Claude — Site Describer', 'Parser — Site Describer', 'Parse Description', 'Describe Fallback', 'Route Mode', 'Unmatched Mode']),
 ('Describe mode', 'Renders the site description page (form) or posts it to the callback (API).',
  ['Build Description Page', 'Via Webhook (Describe)?', 'Build Describe Response', 'Show Description']),
 ('Keyword discovery', 'Seeds by buyer motive → seven DataForSEO Labs pulls (ideas, long-tail, related, live SERP, competitor rankings) → one pool with an opportunity score → Claude relevance screen → clusters, quick wins, questions → AI search demand → live SERP check of the priority keywords → Keyword Strategy report (Word + PDF). Form users then pick the keyword on "Choose your keyword"; the follow-ups they ticked (report / content / audit) start as separate executions.',
  ['Keyword Seeds', 'Anthropic Chat Model', 'Parser — Keyword Seeds', 'Seed List', 'Research Requests', 'Run Research', 'Competitor Keyword Requests', 'Run Competitor Keywords', 'Collect Research', 'Relevance Chunks', 'Keyword Relevance', 'Claude — Keyword Relevance', 'Parser — Keyword Relevance', 'Rank Keywords', 'AI Demand', 'Priority Keywords', 'Candidate SERP', 'Build Keyword Strategy', 'Choice Step?', 'Choose Keyword', 'Apply Choice', 'Build Keyword File', 'Prepare PDF Ideas', 'Render PDF Ideas', 'Attach PDF Ideas', 'Spawn Follow-ups', 'Start Follow-up Runs', 'Via Webhook (Ideas)?', 'Build Ideas Response', 'Download Keyword Ideas']),
 ('Keyword pipeline: research', 'Used by keyword, verdict and ladder runs. Sitemaps give real internal-link targets and detect an existing page; the client\'s own pages are read for facts; the live SERP (top 30, PAA, AI Overview) picks competitors whose pages are read (with a browser-engine retry for bot-protected pages) and distilled into a term model, questions and statistics; a second search collects verified facts with sources; Claude analyses the competition; keyword metrics and site authority complete the picture.',
  ['Prepare Keyword Run', 'Has Domain?', 'Fetch Sitemap Index', 'Parse Sitemap Index', 'Fetch Sitemaps', 'Collect Site URLs', 'Read Client Pages?', 'Client Page Requests', 'Read Client Pages', 'Collect Client Pages', 'SERP Top 10', 'Pick Top 6', 'Read Competitor Pages', 'Find Blocked Pages', 'Any Blocked?', 'Blocked Page Items', 'Retry Blocked Pages', 'Analyze Competitor Pages', 'Facts SERP', 'Collect Facts', 'Competitor Analyzer', 'Claude — Competitor Analyzer', 'Parser — Competitor Analyzer', 'Parse Analysis', 'Keyword Data', 'Has Domain (Authority)?', 'Site Authority', 'Merge Keyword Data']),
 ('Verdict', 'Claude Sonnet weighs demand, difficulty, link strength, intent, SERP features and the site\'s authority into GO / GO_WITH_CHANGES / AVOID with reasons, what must change, expected visits and time to rank. Ladder runs branch here; AVOID stops content unless the run is a forced ladder page.',
  ['Verdict Agent', 'Verdict Chat Model', 'Parser — Verdict', 'Parse Verdict', 'Ladder Mode?', 'Verdict Router', 'Need Content?']),
 ('Content generation & QA', 'Opus writes the brief and the page from the research; Sonnet critiques; the deterministic QA computes a content score (structure, topic coverage, readability, specificity, clean language, length), fixes what it can and asks the Opus editor for one revision when needed.',
  ['Strategy Brief', 'Claude — Strategy Brief', 'Parser — Strategy Brief', 'Parse Brief', 'Copywriter', 'Claude — Copywriter', 'Critic', 'Claude — Critic', 'Parser — Critic', 'Parse Critique', 'Content QA', 'Needs Revision?', 'Editor', 'Claude — Editor']),
 ('Report & delivery (keyword / content)', 'The Word-compatible report (verdict, keyword overview, SERP features, competitor analysis, page content, QA, schema) is rendered to PDF by Gotenberg and delivered by e-mail, form download or API callback; the optional WordPress gate runs first.',
  ['Build Word File', 'Prepare PDF Report', 'Render PDF Report', 'Attach PDF Report', 'Publish To WordPress?', 'Publish WordPress Draft', 'Has Email?', 'Send Report', 'Deliver Via Download?', 'Download Report', 'Is Webhook?', 'Build Webhook Response', 'Has Callback?', 'POST Callback']),
 ('Keyword ladder', 'Four DataForSEO pulls around the head term → topic-filtered pool with opportunity score → Claude relevance anchored on the head term → rungs by difficulty (1: ≤25 long-tail, 2: 26-45, 3: 46-60, top = head), one page per topic cluster, existing pages matched, internal link map, timeline, feasibility → Keyword Ladder Plan (Word + PDF) → rows into the Data Table seo_ladders → delivery → the first page(s) start as separate content runs.',
  ['Ladder Requests', 'Run Ladder Research', 'Ladder Pool', 'Ladder Relevance Chunks', 'Ladder Keyword Relevance', 'Claude — Ladder Relevance', 'Parser — Ladder Relevance', 'Ladder Plan', 'Build Ladder Report', 'Prepare PDF Ladder', 'Render PDF Ladder', 'Attach PDF Ladder', 'Ensure Ladder Table', 'Ensure History Table', 'Ladder Rows', 'Save Ladder Rows', 'Ladder Delivery', 'Spawn Page Runs', 'Start Page Runs', 'Has Email (Ladder)?', 'Send Ladder Report', 'Via Webhook (Ladder)?', 'Build Ladder Response', 'Download Ladder Plan']),
 ('Technical audit: crawl & probes', 'Form audits are spawned as their own execution so the "started" page can show at once. DataForSEO On-Page crawls up to 200 pages (polled every minute, 25 minutes max); extra reports list duplicate tags, non-indexable pages and redirect chains; host probes (no redirects) and content probes (robots, sitemap, llms.txt, 11 crawler user-agents) measure what browsers and crawlers really get.',
  ['Audit Via Form?', 'Spawn Audit Run', 'Start Audit Run', 'Audit Started', 'Start Crawl', 'Save Task ID', 'Wait 1 min', 'Get Crawl Summary', 'Check Crawl', 'Crawl Done?', 'Get Crawled Pages', 'Crawl Extra Requests', 'Run Crawl Extras', 'Collect Crawl Extras', 'Build Probes', 'Run Probes', 'Content Probes', 'Run Content Probes', 'Analyze Probes', 'Full Report?']),
 ('Full report modules', 'Key-page HTML and schema checks, competitor discovery (Labs + live SERPs), domain overview and age (WHOIS + RDAP), ranked keywords and gaps, backlinks and link gap, PageSpeed for you and competitors, an E-E-A-T content review by Claude, and AI visibility (brand SERP, AI Overviews, live ChatGPT/Perplexity answers).',
  ['Pick Key Pages', 'Fetch Page HTML', 'Analyze HTML', 'URLs To Check', 'Check Schema URLs', 'Schema Findings', 'Find Competitors', 'Fallback Queries', 'Fallback SERP', 'Pick Competitors', 'Domain Overview', 'DataForSEO Whois', 'RDAP Lookup', 'Competitor Analysis', 'KW Targets', 'Ranked Keywords', 'Keyword Ideas', 'Analyze Keywords', 'BL Targets', 'Backlink Summary', 'Backlink Gap', 'Analyze Backlinks', 'PS Targets', 'PageSpeed', 'Analyze PageSpeed', 'Competitor Homes', 'Read Competitor Homes', 'Build Content Prompt', 'Content Reviewer', 'Claude — Content Reviewer', 'Parser — Content Reviewer', 'Parse Content Review', 'AI Queries', 'AI SERP', 'LLM Prompts', 'Ask LLMs', 'AI Visibility']),
 ('Scoring & audit delivery', 'Build Site Issues scores every finding (Critical 30 / High 15 / Medium 7 / Low 3 / Info 1, scaled by share of pages, 70% diminishing returns, caps) into a health score and grade; the Site Audit or Full SEO Report is rendered to PDF and e-mailed / posted to the callback.',
  ['Build Site Issues', 'Is Full Report?', 'Build Full Report', 'Build Audit Report', 'Prepare PDF Audit', 'Render PDF Audit', 'Attach PDF Audit', 'Via Webhook (Audit)?', 'Build Audit Response', 'Has Email (Audit)?', 'Send Audit Report']),
]
MANUAL = {  # Code nodes without a leading comment
 'Clean Site Text': 'Strips the Jina Reader markdown of navigation, images and boilerplate; sets read_ok and the page title.',
 'Build Description Page': 'Renders the site-description result page (HTML) for the form, with a warning when the site could not be read.',
 'Pick Top 6': 'Picks up to 8 organic competitor URLs from the live SERP, skipping the client\'s own domain, social sites, marketplaces, job boards, courses and software vendors.',
 'Merge Keyword Data': 'Merges keyword metrics (volume, CPC, difficulty, intent, trend, competitor link strength) and the site authority into the context for the verdict.',
 'Save Task ID': 'Stores the DataForSEO On-Page task id; throws a clear error when the crawl could not be started.',
 'Check Crawl': 'Reads the crawl summary; sets crawl_finished / progress; aborts after 25 polls with "took too long".',
 'Build Site Issues': 'Turns crawled pages, probes and every module\'s extra findings into scored findings, category scores, caps, health score and grade.',
 'Analyze Probes': 'Interprets host and content probes: canonical host and redirects, caching and TTFB, security headers, robots.txt, sitemap, llms.txt, crawler access.',
 'Pick Key Pages': 'Chooses the homepage, service pages and articles whose HTML and schema get inspected (hub pages excluded).',
 'Analyze HTML': 'Checks titles, descriptions, headings, canonical, Open Graph, schema presence and sameAs links on the key pages.',
 'URLs To Check': 'Collects image and profile URLs from JSON-LD for a HEAD check (public http(s) hosts only — SSRF guard).',
 'Schema Findings': 'Turns broken schema URLs into findings (Organization logo Critical, publisher logo High).',
 'Pick Competitors': 'Combines Labs competitors with live-SERP competitors into up to 3 domains plus the client.',
 'Competitor Analysis': 'Benchmarks organic keywords, top-10 rankings, traffic and domain age against the competitors (RDAP fills WHOIS gaps).',
 'KW Targets': 'One item per domain for the ranked-keywords pull.',
 'Analyze Keywords': 'Keyword gap, easy wins and striking-distance keywords from ranked keywords and keyword ideas.',
 'BL Targets': 'One item per domain for the backlink summary.',
 'Analyze Backlinks': 'Referring domains and link gap per competitor; marks data unavailable when the Backlinks API is off.',
 'PS Targets': 'One item per domain for PageSpeed Insights.',
 'Analyze PageSpeed': 'Core Web Vitals and performance scores for you and the competitors → findings.',
 'Competitor Homes': 'Competitor homepages to read for the content review.',
 'Build Content Prompt': 'Assembles the E-E-A-T content-review prompt from your pages and the competitors\' homepages.',
 'AI Visibility': 'Brand SERP, site: index estimate, AI Overview citations and live LLM answers → findings and what works.',
 'Unmatched Choice': 'Guard: unknown form option.', 'Unmatched Mode': 'Guard: unknown mode after routing.',
 'Build Webhook Response': 'API callback payload for content runs: status, stage, ladder fields, verdict, keyword data, QA summary, run ledger, PDF and Word bytes.',
 'Build Word File': 'Builds the keyword report / page content document (Word-compatible HTML): verdict, keyword overview, SERP features, competitor analysis, the page content with meta tags, QA results, topic coverage, sources, title/meta alternatives, editorial review and JSON-LD; computes the run ledger (DataForSEO spend per node, AI calls, duration).',
 'Build Full Report': 'Builds the Full SEO Report document from the scored audit: health score and grade, top issues, every module\'s findings and what works, competitor benchmark, keywords, backlinks, PageSpeed, content review, AI visibility, methodology; computes the run ledger.',
 'Build Audit Report': 'Builds the technical Site Audit document (scored findings by category, what works, measurements, methodology); computes the run ledger.',
 'Build Keyword File': 'Wraps the Keyword Strategy HTML into the Word-compatible file with a dated file name; computes the run ledger.',
 'Build Ladder Report': 'Builds the Keyword Ladder Plan document: one-page summary, feasibility with alternatives, the ladder per rung (pages, supporting keywords, difficulty, your position, existing or planned URL), internal link map, pages written now, requirements, tracking, later keywords, method; slims the item and computes the run ledger.'}
DFS = {'keyword_overview': 'keyword metrics', 'domain_rank_overview': 'site authority / domain overview', 'ranked_keywords': 'keywords a domain ranks for', 'keyword_suggestions': 'long-tail suggestions', 'related_keywords': 'related searches', 'keyword_ideas': 'keyword ideas', 'serp/google/organic/live/advanced': 'live Google SERP', 'on_page/task_post': 'start On-Page crawl', 'on_page/summary': 'crawl summary', 'on_page/pages': 'crawled pages', 'competitors_domain': 'Labs competitors', 'whois': 'WHOIS', 'backlinks/summary': 'backlink summary', 'backlinks/domain_intersection': 'backlink gap', 'ai_keyword_data': 'AI search demand', 'llm_responses': 'live LLM answers', 'rdap.org': 'RDAP domain registration', 'pagespeedonline': 'PageSpeed Insights', 'r.jina.ai': 'Jina Reader (page → markdown)', 'gotenberg': 'Gotenberg HTML → PDF'}

def describe(n):
    t = n['type']; p = n.get('parameters', {})
    if t == 'n8n-nodes-base.code':
        if n['name'] in MANUAL: return MANUAL[n['name']]
        src = p.get('jsCode', '').lstrip(); lines = []
        for l in src.split('\n'):
            l = l.strip()
            if l.startswith('//'): lines.append(l[2:].strip())
            elif lines: break
            elif l: break
        txt = ' '.join(lines)
        return re.sub(r'\s+', ' ', txt)[:420] or 'Code node.'
    if t == 'n8n-nodes-base.httpRequest':
        url = str(p.get('url', '')); label = next((v for k, v in DFS.items() if k in url), '')
        if url.startswith('={{ $json.endpoint'): label = 'DataForSEO endpoint chosen per item (endpoint/body in the item)'
        cred = ', '.join(v.get('name', '') for v in (n.get('credentials') or {}).values())
        return f"HTTP {p.get('method', 'GET')} {E(url.replace('={{', '{{'))[:110]}" + (f" — {label}" if label else '') + (f" (credential: {cred})" if cred else '')
    if t == 'n8n-nodes-base.if':
        c = p.get('conditions', {}).get('conditions', [])
        return 'Routes on: ' + ' AND '.join(str(x.get('leftValue', '')).replace('={{', '{{') + (' ' + x['operator'].get('operation', '') + ' ' + str(x.get('rightValue', '')) if x.get('operator', {}).get('type') == 'string' else '') for x in c)
    if t == 'n8n-nodes-base.switch':
        return 'Switch: outputs ' + ', '.join(r.get('outputKey', '?') for r in p.get('rules', {}).get('values', [])) + (' + fallback' if p.get('options', {}).get('fallbackOutput') else '')
    if t == '@n8n/n8n-nodes-langchain.agent':
        txt = re.sub(r'\{\{.*?\}\}', '…', str(p.get('text', '')).lstrip('=')); first = re.split(r'(?<=[.!?])\s', txt.strip())[0]
        return 'AI agent with structured output. Prompt starts: "' + first[:260] + '"'
    if t == '@n8n/n8n-nodes-langchain.lmChatAnthropic':
        o = p.get('options', {}); m = p.get('model', {}).get('value', '')
        return f"Claude model node: {m}; max tokens {o.get('maxTokensToSample')}" + (f"; adaptive thinking ({o.get('effort')})" if o.get('thinking') else '') + ('; streaming' if o.get('streaming') else '')
    if t == '@n8n/n8n-nodes-langchain.outputParserStructured':
        try: keys = list(json.loads(p.get('inputSchema', '{}')).get('properties', {}).keys())
        except Exception: keys = []
        return 'Structured output parser; fields: ' + ', '.join(keys[:14]) + ('…' if len(keys) > 14 else '')
    if t in ('n8n-nodes-base.form', 'n8n-nodes-base.formTrigger'):
        if p.get('operation') == 'completion': return 'Form completion page: "' + str(p.get('completionTitle') or p.get('respondWith', '')) + '"' + (' (returns the file for download)' if p.get('respondWith') == 'returnBinary' else '') + '. Ends the form flow (the execution stays in waiting).'
        if p.get('defineForm') == 'json': return 'Form page defined from JSON at runtime: ' + str(p.get('jsonOutput', ''))[:140].replace('={{', '{{')
        return 'Form page with fields: ' + ', '.join(f.get('fieldLabel', '') for f in p.get('formFields', {}).get('values', []))
    if t == 'n8n-nodes-base.executeWorkflow':
        return f"Execute Workflow → {p.get('workflowId', {}).get('value', '')} (mode {p.get('mode', 'once')}, wait={p.get('options', {}).get('waitForSubWorkflow', True)}) — starts a separate execution"
    if t == 'n8n-nodes-base.executeWorkflowTrigger': return 'Execute Workflow Trigger (passthrough): entry for runs started by another workflow or the API front door.'
    if t == 'n8n-nodes-base.webhook': return f"Webhook {p.get('httpMethod')} /webhook/{p.get('path')} ({p.get('authentication', 'none')} auth)"
    if t == 'n8n-nodes-base.respondToWebhook': return 'Responds to the webhook: ' + str(p.get('responseBody', ''))[:120].replace('={{', '{{') + f" (HTTP {p.get('options', {}).get('responseCode', 200)})"
    if t == 'n8n-nodes-base.emailSend': return f"Sends e-mail via SMTP to {str(p.get('toEmail', '')).replace('={{', '{{')}; subject: {str(p.get('subject', '')).replace('={{', '{{')[:90]}"
    if t == 'n8n-nodes-base.wait': return 'Waits ' + str(p.get('amount', '')) + ' ' + str(p.get('unit', '')) + ' (execution is persisted while waiting).'
    if t == 'n8n-nodes-base.dataTable': return f"Data Table: {p.get('resource')} {p.get('operation')} — table {p.get('tableName') or p.get('dataTableId', {}).get('value')}"
    if t == 'n8n-nodes-base.scheduleTrigger': return 'Schedule trigger: ' + json.dumps(p.get('rule', {}).get('interval', []))
    if t == 'n8n-nodes-base.noOp': return 'No operation (branch end).'
    if t == 'n8n-nodes-base.errorTrigger': return 'Error Trigger: receives failed executions of workflows that name this one as their error workflow.'
    return t.split('.')[-1]
TYPE_SHORT = {'n8n-nodes-base.code': 'Code', 'n8n-nodes-base.httpRequest': 'HTTP Request', 'n8n-nodes-base.if': 'IF', 'n8n-nodes-base.switch': 'Switch', '@n8n/n8n-nodes-langchain.agent': 'AI Agent', '@n8n/n8n-nodes-langchain.lmChatAnthropic': 'Anthropic model', '@n8n/n8n-nodes-langchain.outputParserStructured': 'Output parser', 'n8n-nodes-base.form': 'Form page', 'n8n-nodes-base.formTrigger': 'Form trigger', 'n8n-nodes-base.executeWorkflow': 'Execute Workflow', 'n8n-nodes-base.executeWorkflowTrigger': 'Execute Workflow Trigger', 'n8n-nodes-base.webhook': 'Webhook', 'n8n-nodes-base.respondToWebhook': 'Respond to Webhook', 'n8n-nodes-base.emailSend': 'Send Email', 'n8n-nodes-base.wait': 'Wait', 'n8n-nodes-base.dataTable': 'Data Table', 'n8n-nodes-base.scheduleTrigger': 'Schedule Trigger', 'n8n-nodes-base.noOp': 'No Op', 'n8n-nodes-base.errorTrigger': 'Error Trigger', 'n8n-nodes-base.stickyNote': 'Sticky note'}
def node_table(nodes, show_cred=True):
    rows = []
    for n in nodes:
        cred = ', '.join(v.get('name', '') for v in (n.get('credentials') or {}).values())
        rows.append(f"<tr><td class='nm'>{E(n['name'])}</td><td>{E(TYPE_SHORT.get(n['type'], n['type'].split('.')[-1]))}</td><td>{describe(n) if n['type'] in ('n8n-nodes-base.httpRequest',) else E(describe(n))}{('<br><span class=cred>credential: ' + E(cred) + '</span>') if (cred and show_cred and n['type'] != 'n8n-nodes-base.httpRequest') else ''}</td></tr>")
    return "<table class='nodes'><tr><th>Node</th><th>Type</th><th>What it does</th></tr>" + ''.join(rows) + '</table>'

# ---------------------------------------------------------------- run traces
def read_nodes(eid):
    f = os.path.join(RUNS, f'nodes_{eid}.tsv')
    if not os.path.exists(f): return [], ''
    out, err = [], ''
    for l in open(f):
        l = l.rstrip('\n')
        if l.startswith('EXECUTION ERROR'): err = l; continue
        parts = l.split('\t')
        if len(parts) >= 4: out.append({'node': parts[0], 'runs': parts[1].replace('runs=', ''), 'items': parts[2].replace('items=', ''), 'ms': parts[3], 'error': parts[4] if len(parts) > 4 else ''})
    return out, err
def read_out(eid, kind, keys):
    f = os.path.join(RUNS, f'out_{eid}_{kind}.txt')
    if not os.path.exists(f): return {}
    t = open(f).read(); s = t.find('{')
    if s < 0: return {}
    try: j = json.loads(t[s:t.rfind('}') + 1])
    except Exception: return {}
    return {k: j.get(k) for k in keys if k in j}
RUN_LIST = []
if os.path.exists(os.path.join(RUNS, 'list.tsv')):
    for l in open(os.path.join(RUNS, 'list.tsv')):
        p = l.rstrip('\n').split('\t')
        if len(p) >= 6: RUN_LIST.append({'id': p[0], 'wf': p[1], 'status': p[2], 'mode': p[3], 'started': p[4], 'stopped': p[5], 'last': p[6] if len(p) > 6 else '', 'error': p[7] if len(p) > 7 else ''})
RUN_BY_ID = {r['id']: r for r in RUN_LIST}
RUNS_DOC = [  # (execution id, title, how it was started, result text)
 ('16', 'Test 1 — Technical site audit of techand.ai', 'Test Runner → API Entry; body: mode audit, report_type "Site Audit (technical issues only)", country AE, e-mail + callback', 'Pass. Crawl of the site (DataForSEO On-Page, 5 polls), probes, scoring → health score 70/100 (1 Critical: broken pages; www not consolidated; HTML not cacheable). PDF + Word e-mailed (Gmail SMTP answered 250 OK, 208 KB) and posted to the callback.', 'audit', ['stage', 'health_score', 'grade', 'issue_counts', 'top_issues', 'run_ledger']),
 ('18', 'Test 2 — Keyword discovery for techand.ai', 'Test Runner → API Entry; body: mode discover, domain techand.ai, country AE, goal leads, e-mail + callback (no business text → site read + Claude Haiku description)', 'Pass. 624 keywords researched → 240 AI-screened → 126 relevant → 46 clusters; start-with pick "e invoicing" (1,900 searches/mo, KD 9, CPC $7.95; tax.gov.ae and mof.gov.ae rank; AI Overview present); AI search demand 64/mo. 88 KB PDF in the callback.', 'ideas', ['stage', 'summary', 'start_with', 'run_ledger']),
 ('21', 'Test 3 — Full SEO report for techand.ai', 'Test Runner → API Entry; body: mode audit, report_type "Full SEO Report", e-mail + callback', 'Pass. Crawl + probes + key-page HTML/schema + competitor discovery + domain overview/WHOIS/RDAP + ranked keywords + backlinks + PageSpeed + Claude content review + AI visibility → health score 64/100 (1 Critical, 22 High). 443 KB e-mail (250 OK) and callback.', 'audit', ['stage', 'health_score', 'grade', 'issue_counts', 'top_issues', 'run_ledger']),
 ('23', 'Test 4a — Ladder for "e invoicing in uae" (first attempt)', 'Test Runner → API Entry; body: mode ladder, keyword "e invoicing in uae", domain techand.ai, pages_now 1, e-mail + callback', 'Failed at "Ladder Keyword Relevance": the two nodes created by the ladder section had no credential slot (the build\'s credential pass ran before they existed). Verdict before the failure: GO_WITH_CHANGES 74/100. Fixed in the build (slot pass + assertions; "Ladder Pool" now stops with a clear message when every research pull fails).', None, []),
 ('27', 'Test 4b — Ladder for "e invoicing in uae" (retry)', 'Same body as 4a after the fix', 'Pass end to end in 5.6 min. Verdict GO_WITH_CHANGES 72/100 (KD 2, 880/mo, competitors average 5 referring domains). Ladder: 9 pages — rung 1 "uae e invoicing penalties", "e invoicing uae fta", "accredited service provider for e invoicing in uae", "uae e invoicing requirements"; rung 2 "e invoicing uae 2026", "list of asp for e invoicing in uae", "is e invoicing mandatory in uae", "e invoicing service providers in uae"; rung 3 empty; top page months 6-9. Data Tables created on first use, 9 rows stored; plan e-mailed (123 KB) and posted to the callback (72 KB PDF); first page run spawned.', 'ladder', ['stage', 'ladder_id', 'head', 'feasibility', 'timeline', 'write_now', 'stats', 'tracking_registered', 'stored_rows', 'run_ledger']),
 ('31', 'Test 4c (first attempt) — spawned rung-1 page run', 'Spawned by execution 27 through API Entry (mode keyword, force_content, ladder fields)', 'Rejected by the AI budget guard, by design: the day\'s estimate stood at $1.83 and the content run adds $1.20 (> $3). The rejection was POSTed to the callback with the ladder\'s request_id.', None, []),
 ('29', 'Test 5 — Error handler check', 'Test Runner → API Entry; body: mode verdict without callback or e-mail (invalid on purpose)', 'The run failed at "API Reject" as intended; the error workflow (execution 30) e-mailed ops (250 OK). Finding: in n8n 2.x an error workflow must be published; it had never fired before.', None, []),
 ('35', 'Test 6 — Rank Tracker manual run', 'Test Runner → Rank Tracker "Manual Run"', 'Pass. 9 keywords checked (Google SERP live), 9 seo_rank_history rows written, progress e-mail (250 OK) and callback (stage rank_tracker); recommendation "work on rung 1". Measured $0.028 per keyword at depth 100 → depth set to 50.', 'tracker', ['ladder_id', 'subject', 'rungs', 'next_step', 'done']),
 ('38', 'Test 7 — Form path: "Check if my keyword is right"', 'Public form (basic auth) driven with curl: start page → Page Verdict → run → download', 'Pass. 2.9 min; verdict GO_WITH_CHANGES 72/100 for "e invoicing in uae"; PDF download page served ("Your report is ready") and the same PDF e-mailed (76 KB, 250 OK).', 'report', ['report_type', 'verdict', 'verdict_score', 'recommended_page', 'pdf_file_name', 'run_ledger']),
 ('40', 'Form path: ladder page with an invalid domain', 'Public form: "Rank my site for a keyword" → Page Ladder with domain 10.0.0.1', 'Pass (validation). Normalize Input rejected the domain; the "Something needs fixing" page showed "Please enter a public website address like example.com". No paid call.', None, []),
 ('41', 'Test 8 — Form path: discovery + "Choose your keyword"', 'Public form: "Suggest keywords for my business" with Keyword Report ticked', 'Choice step passed: the JSON-defined dropdown rendered live (system suggestion + 7 keywords), option 4 "e invoicing implementation" was applied (chosen_by user) and the ideas download page was served. The chained keyword report never ran because the completion node ran first and ended the execution → redesigned (follow-ups are spawned, completion last).', None, []),
 ('42', 'Test 9 — Form path: audit after the fix', 'Public form: "Audit my website" → Page Audit (technical)', 'Pass. "Your audit has started" page served within seconds; the audit itself ran as execution 43 (spawned).', None, []),
 ('43', 'Test 9 — the spawned technical audit', 'Spawned by execution 42 through API Entry (mode audit, e-mail)', 'Pass. 4.4 min, health score 70/100, PDF + Word e-mailed (208 KB, 250 OK).', 'audit', ['stage', 'health_score', 'grade', 'run_ledger']),
 ('44', 'Test 10 — Form path: discovery with Site Audit ticked', 'Public form: "Suggest keywords for my business" + Extra Features "Site Audit"', 'Stopped by the per-address rate limit (6 runs per e-mail per day); the validation page showed the limit message. Not bypassed.', None, []),
 ('46', 'Test 4c — the ladder\'s first page, after the cap was raised', 'Test Runner → API Entry; the body Spawn Page Runs produces (mode keyword, keyword "uae e invoicing penalties", page_type Blog Post, force_content, ladder_id, rung 1, ladder_links; callback only)', 'Pass end to end in 10.3 min: verdict GO_WITH_CHANGES 62/100 for the rung keyword; first draft content score 83 (2,434 words vs 1,800, critic 58) → one Opus editor pass → final score 85/100, 12 H2s, 6 internal links incl. the ladder\'s planned top page and sibling; callback carries ladder_id / ladder_rung / ladder_head with the 187 KB PDF and 52 KB Word file.', 'content', ['stage', 'ladder_id', 'ladder_rung', 'ladder_head', 'verdict', 'score', 'qa_summary', 'run_ledger']),
]
def run_section(eid, title, how, result, kind, keys):
    meta = RUN_BY_ID.get(eid, {}); nodes, err = read_nodes(eid)
    out = read_out(eid, kind, keys) if kind else {}
    dur = ''
    if meta.get('started') and meta.get('stopped') and meta['stopped'] != '-':
        from datetime import datetime
        try: a = datetime.fromisoformat(meta['started'].replace(' ', 'T')); b = datetime.fromisoformat(meta['stopped'].replace(' ', 'T')); dur = f"{(b - a).total_seconds() / 60:.1f} min"
        except Exception: pass
    h = f"<h3>Execution {eid}: {E(title)}</h3><table class='kv'><tr><td class='k'>Started through</td><td>{E(how)}</td></tr><tr><td class='k'>n8n execution</td><td>{E(meta.get('wf', ''))} · status <b>{E(meta.get('status', ''))}</b> · {E(meta.get('started', ''))} → {E(meta.get('stopped', ''))}{(' · ' + dur) if dur else ''} · last node: {E(meta.get('last', ''))}</td></tr><tr><td class='k'>Result</td><td>{E(result)}</td></tr>"
    if out: h += f"<tr><td class='k'>Key output fields</td><td><pre>{E(json.dumps(out, indent=1, ensure_ascii=False)[:3200])}</pre></td></tr>"
    if nodes:
        failed = [n for n in nodes if n['error']]
        h += f"<tr><td class='k'>Nodes executed ({len(nodes)})</td><td class='trace'>" + ' → '.join(f"{E(n['node'])}" + (f" <span class=small>×{n['runs']}</span>" if n['runs'] != '1' else '') + (f" <span class=bad>✗</span>" if n['error'] else '') for n in nodes) + (f"<br><span class=bad>Error: {E(failed[0]['error'][:220])}</span>" if failed else '') + (f"<br><span class=bad>{E(err[:220])}</span>" if err and not failed else '') + '</td></tr>'
    return h + '</table>'

# ---------------------------------------------------------------- REVIEW extracts (test log + roadmap)
review = open(os.path.join(HERE, 'REVIEW.md'), encoding='utf-8').read()
def md_table(block):
    rows = [l for l in block.strip().split('\n') if l.startswith('|') and not re.match(r'^\|[-| ]+\|$', l)]
    out = '<table class="ct">'
    for i, r in enumerate(rows):
        cells = [c.strip() for c in r.strip('|').split(' | ')]
        cells = [re.sub(r'`([^`]*)`', r'<code>\1</code>', re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', E(c))) for c in cells]
        out += '<tr>' + ''.join(('<th>' if i == 0 else '<td>') + c + ('</th>' if i == 0 else '</td>') for c in cells) + '</tr>'
    return out + '</table>'
m = re.search(r'## 5c\. Live test log\n(.*?)\n## ', review, re.S); testlog = md_table(m.group(1)) if m else ''
m = re.search(r'## 6\. Roadmap to "best in class"\n(.*?)\n## 7\.', review, re.S); roadmap = m.group(1) if m else ''
roadmap_html = '<ol>' + ''.join('<li>' + re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', E(re.sub(r'^\d+\.\s*', '', l))) + '</li>' for l in roadmap.strip().split('\n') if re.match(r'^\d+\.', l)) + '</ol>'
norm = next(n for n in MAIN['nodes'] if n['name'] == 'Normalize Input')['parameters']['jsCode']
cfg = re.search(r'const CONFIG = \{(.*?)\n\};', norm, re.S); cfg_txt = cfg.group(0) if cfg else ''
rate = next(n for n in MAIN['nodes'] if n['name'] == 'Rate Limit')['parameters']['jsCode']
lim = re.search(r'const LIMITS = .*?;', rate).group(0); est = re.search(r'const EST = .*?;', rate).group(0)
from ladder_common import LADDER_COLS, HISTORY_COLS, LADDER_TABLE, HISTORY_TABLE
creds = {}
for f, _, _ in WORKFLOWS:
    for n in WFS[f]['nodes']:
        for t, c in (n.get('credentials') or {}).items(): creds.setdefault((c.get('id'), c.get('name'), t), set()).add(n['name'])

# ---------------------------------------------------------------- HTML
css = """
@page { size: A4; margin: 16mm 14mm; }
body { font-family: Calibri, Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.45; color: #1e293b; }
.cover { background: #0F172A; color: #fff; padding: 36px 34px; margin: -6px 0 24px; page-break-after: always; min-height: 560px; }
.cover .brand { font-size: 10pt; letter-spacing: 2px; text-transform: uppercase; color: #93C5FD; }
.cover h1 { font-size: 28pt; margin: 10px 0 6px; color: #fff; border: 0; } .cover p { color: #CBD5E1; } .cover .by { color: #93C5FD; margin-top: 40px; }
h1 { color: #0F172A; font-size: 19pt; border-bottom: 3px solid #0F172A; padding-bottom: 5px; margin-top: 28px; page-break-before: always; }
h1.first { page-break-before: auto; }
h2 { color: #1E3A8A; font-size: 14pt; margin-top: 22px; border-bottom: 1px solid #CBD5E1; padding-bottom: 3px; }
h3 { color: #334155; font-size: 11.5pt; margin: 18px 0 6px; }
p { margin: 0 0 8px; } code, pre { font-family: Consolas, Menlo, monospace; font-size: 8.6pt; } pre { background: #F1F5F9; padding: 8px 10px; white-space: pre-wrap; border-left: 3px solid #1E3A8A; }
table { border-collapse: collapse; width: 100%; margin: 8px 0 14px; page-break-inside: auto; } tr { page-break-inside: avoid; }
th { background: #1E3A8A; color: #fff; text-align: left; padding: 5px 7px; font-size: 9pt; } td { border: 1px solid #CBD5E1; padding: 5px 7px; vertical-align: top; font-size: 9pt; }
.kv td.k { width: 150px; background: #EEF2FF; font-weight: bold; } .nodes td.nm { width: 165px; font-weight: bold; } .nodes td:nth-child(2) { width: 105px; color: #475569; }
.cred { color: #0369a1; font-size: 8.5pt; } .small { color: #64748B; font-size: 8.5pt; } .bad { color: #B91C1C; font-weight: bold; } .ok { color: #15803D; font-weight: bold; }
.note { border-left: 4px solid #D97706; background: #FFFBEB; padding: 8px 12px; margin: 10px 0; } .callout { border-left: 4px solid #1E3A8A; background: #F1F5F9; padding: 8px 12px; margin: 10px 0; }
.trace { font-size: 8.4pt; line-height: 1.6; } .report { border: 1px solid #CBD5E1; padding: 10px 16px; background: #fff; margin: 8px 0 16px; } .report .rlabel { font-size: 8.5pt; color: #64748B; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; } .report .rcover { background: #0F172A; color: #fff; padding: 14px 18px; margin-bottom: 12px; } .report .rcover .brand { color: #93C5FD; font-size: 9pt; letter-spacing: 2px; text-transform: uppercase; } .report .rtitle { font-size: 17pt; font-weight: bold; color: #fff; margin: 4px 0; } .report .rcover .sub, .report .rcover .by { color: #CBD5E1; } .report h2 { page-break-before: auto; font-size: 13pt; } .report h2.rh1 { font-size: 15pt; color: #0F172A; } .report .content h2 { font-size: 12.5pt; } .report .kv td.k { width: 170px; } .report .ph { background: #FEF3C7; color: #92400E; } .report .code { background: #0F172A; color: #E2E8F0; padding: 10px; font-family: Consolas, monospace; font-size: 8pt; white-space: pre-wrap; } .report .fq { font-weight: bold; margin-top: 10px; } .report .fa { margin-left: 12px; color: #334155; } .report .w { max-width: none; padding: 0; } .report .pill { display: inline-block; background: #e0e7ff; color: #1e3a8a; border-radius: 20px; padding: 1px 8px; font-size: 8.5pt; margin: 1px 4px 1px 0; } .report .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; margin: 6px 0; } .report .t th { background: #1E3A8A; color: #fff; } .report .t td { border: 1px solid #CBD5E1; } .report .muted { color: #64748b; font-size: 9pt; } .generated { border: 1px solid #CBD5E1; padding: 14px 18px; background: #FCFCFD; } .generated h2.page { page-break-before: auto; font-size: 15pt; color: #0F172A; border: 0; } .generated h3.page { font-size: 12.5pt; color: #1E3A8A; } .generated h4.page { font-size: 11pt; } ul, ol { margin: 4px 0 10px 20px; } li { margin-bottom: 3px; } .toc li { margin-bottom: 2px; }
"""
P = []
P.append(f"""<div class="cover"><div class="brand">Developer guide &amp; live test report</div><h1>SEO Agent v4.2 on n8n</h1>
<p>How the agent works, every workflow and node explained, how to build, test and deploy it, and the results of the full system test run on techand.ai on 2026-10-01 (keyword ladder, discovery, audits, full report, rank tracker, form path, e-mail, API).</p>
<p>Instance: n8n 2.41.4 (Docker Compose, SQLite, Gotenberg PDF service), project <code style="color:#93C5FD">wo1WpMiHjdduGvfl</code>. Source of truth: <code style="color:#93C5FD">n8n/seo-agent/</code> (build scripts, prompts, Code nodes, harness, workflows JSON).</p>
<p class="by">Generated by build_docs.py · {E(__import__('datetime').date.today().isoformat())}</p></div>""")
P.append("""<h1 class="first">Contents</h1><ol class="toc">
<li>What the agent does</li><li>Architecture and workflows</li><li>Repository, build, test and deploy</li><li>Configuration, guards and credentials</li><li>Data model (Data Tables) and API contract</li>
<li>Main workflow, stage by stage, with every node</li><li>The other workflows and their nodes</li><li>Offline test harness</li><li>Live system test 2026-10-01: runs, nodes executed, results</li><li>Findings, fixes and roadmap</li><li>Appendix A: node inventory</li><li>Appendix B: the page generated in the live test</li><li>Appendix C: everything the live test generated, and what it was used for</li></ol>""")
P.append("""<h1>1. What the agent does</h1>
<p>The SEO Agent is an enterprise SEO automation built as n8n workflows. One public form (or one API call) gives a customer:</p>
<ul><li><b>I know my keyword</b> — competitor research, a GO / GO_WITH_CHANGES / AVOID verdict, a keyword report and a finished, QA-checked page (Word + PDF).</li>
<li><b>Suggest keywords for my business</b> — multi-source keyword research with an opportunity score, AI relevance screen, topic clusters, AI search demand and a live SERP check; form users then pick the keyword to write for.</li>
<li><b>Just describe my website</b> — a structured description of the site from its homepage.</li>
<li><b>Audit my website</b> — a technical Site Audit (crawl, probes, scoring) or a Full SEO Report (plus competitors, keywords, backlinks, PageSpeed, E-E-A-T content review, AI visibility).</li>
<li><b>Check if my keyword is right</b> — the verdict alone.</li>
<li><b>Rank my site for a keyword</b> (new, v4.2) — the <b>keyword ladder</b>: feasibility of the destination keyword, a ladder of 8-12 pages from winnable long-tail terms up to the head term with an internal link map and timeline, the first page written now, weekly position tracking with the recommended next rung.</li></ul>
<p>Data comes from DataForSEO (SERP, Labs, On-Page, Backlinks, WHOIS, AI Optimization), Jina Reader (pages → markdown), Google PageSpeed Insights and RDAP; reasoning from Claude (Opus 5.5 for brief, copy and editing; Sonnet 5.5 for analysis, verdicts, relevance and critique; Haiku 4.5 for the site description). Reports are rendered to PDF by Gotenberg and delivered by e-mail (Gmail SMTP), form download or API callback.</p>""")
P.append("<h1>2. Architecture and workflows</h1><p>Seven workflows live in the n8n project. The main workflow holds every mode; the others are small and single-purpose. Sub-runs (ladder pages, discovery follow-ups, form audits) are started through <i>API Entry</i> as separate executions, which keeps form flows short and lets every stage deliver on its own.</p><table class='ct'><tr><th>Workflow</th><th>Id</th><th>Role</th><th>Nodes</th><th>State</th></tr>" + ''.join(f"<tr><td><b>{E(name)}</b></td><td><code>{E(WFS[f]['id'])}</code></td><td>{E(role)}</td><td>{len([n for n in WFS[f]['nodes'] if n['type'] != 'n8n-nodes-base.stickyNote'])}</td><td>{'active' if WFS[f]['id'] in ('SEOagentV4Full01', 'SEOagentAPIentry', 'SEOagentTracker1', 'SEOagentErrHandl', 'SEOagentCallback') else 'inactive (on purpose)'}</td></tr>" for f, name, role in WORKFLOWS) + "</table>" + """
<h2>How a request flows</h2><ol>
<li><b>Entry</b>: form page (basic auth) or <code>POST /webhook/seo-keyword-check</code> (header auth) → the API workflow validates, answers 202 and starts the main workflow through <i>API Entry</i>.</li>
<li><b>Intake</b>: <i>Normalize Input</i> → <i>Rate Limit</i> (per-address limit, estimated Claude budget) → <i>Input OK?</i> (errors become a form page or a callback rejection).</li>
<li><b>Site read</b> when needed (Jina + Claude Haiku) → <i>Route Mode</i>.</li>
<li><b>Mode pipeline</b> (discovery · keyword/verdict/ladder · audit · describe) → report builder → Gotenberg PDF.</li>
<li><b>Delivery</b>: e-mail (SMTP), form completion page (download) or callback JSON with PDF/Word bytes; the run ledger (DataForSEO spend per node, AI calls, duration) rides along.</li>
<li><b>Follow-ups as separate executions</b>: ladder pages, discovery report/content/audit, form audits (a form completion page ends its execution, so nothing may be queued behind it).</li></ol>
<div class="callout"><b>Design rules learned the hard way (all enforced in the build):</b> every model node and every DataForSEO/Jina/PageSpeed HTTP node carries a credential slot; Code nodes read binaries with <code>getBinaryDataBuffer</code>; thinking tokens count against max tokens (brief 24k, copy/edit 32k, streaming on above ~21k); Form completion nodes are always last; error workflows must be published; script-created Webhook nodes need a <code>webhookId</code>.</div>""")
P.append(f"""<h1>3. Repository, build, test and deploy</h1>
<table class='ct'><tr><th>Path</th><th>Purpose</th></tr>
<tr><td><code>build_v4.py</code></td><td>Builds the main workflow from the v3 export with asserted, anchored patches (sections 1-11); writes <code>workflows/SEO_Agent_v4.json</code>, <code>harness/code_v4/</code>, <code>CHANGES_v3_to_v4.md</code>; then runs <code>build_api.py</code> and <code>build_ladder_extras.py</code>.</td></tr>
<tr><td><code>build_api.py</code> · <code>build_ladder_extras.py</code> · <code>ladder_common.py</code></td><td>API front door; Rank Tracker, WordPress publisher, Test Runner; shared Data Table columns.</td></tr>
<tr><td><code>v5/prompts/*.txt</code> · <code>v5/code/*.js</code></td><td>Agent prompts and new Code nodes (read by the build). Edit here, never in the JSON.</td></tr>
<tr><td><code>harness/</code></td><td>Offline test harness: runs every Code node in the n8n container's Node against fixtures (no paid calls). Must end "0 failed".</td></tr>
<tr><td><code>workflows/*.json</code></td><td>Generated workflow JSON (import with the ids inside). <code>SEO_Agent_v3_original_export.json</code> is the untouched source.</td></tr>
<tr><td><code>REVIEW.md</code> · <code>LADDER_FEATURE_SPEC.md</code> · <code>docs/</code></td><td>Findings, every change, live test log, roadmap; the ladder spec with decisions; this guide and the exported run traces.</td></tr></table>
<h2>Build</h2><pre>cd n8n/seo-agent &amp;&amp; python3 build_v4.py        # check the exit code: patches assert the exact text they replace</pre>
<h2>Test (offline)</h2><pre>cd harness
docker cp . n8n-n8n-1:/tmp/harness &amp;&amp; docker exec -u root n8n-n8n-1 chown -R node:node /tmp/harness
docker exec n8n-n8n-1 sh -c 'cd /tmp/harness &amp;&amp; CODE_DIR=/tmp/harness/code_v4 OUT_DIR=/tmp/harness/out node scenarios_v5.js'   # expect "161 passed, 0 failed"</pre>
<h2>Deploy</h2><pre>docker exec n8n-n8n-1 n8n import:workflow --input=/tmp/SEO_Agent_v4.json --projectId=wo1WpMiHjdduGvfl   # upsert by id
# activation: POST /api/v1/workflows/&lt;id&gt;/activate with an n8n API key, or without a key:
docker exec n8n-n8n-1 n8n publish:workflow --id=SEOagentV4Full01 &amp;&amp; docker restart n8n-n8n-1            # CLI publish takes effect after a restart
# verify without logging in: GET /form/&lt;Start Form webhookId&gt; → 401 (registered, auth required); POST /webhook/seo-keyword-check → 403</pre>
<p>Credentials are created/updated without the UI through <code>n8n import:credentials --input=&lt;json&gt; --projectId=…</code> (upsert by id, encrypted on import). Never export or print credentials.</p>""")
P.append(f"""<h1>4. Configuration, guards and credentials</h1>
<h2>CONFIG (top of <i>Normalize Input</i>)</h2><pre>{E(cfg_txt)}</pre>
<h2>Rate Limit</h2><pre>{E(lim)}\n{E(est)}</pre>
<p>Keys: e-mail, else client IP (API) or the ladder/discover tag, else domain or keyword. The AI budget is an estimate-based guard (streaming model calls report no token usage); the Anthropic Console workspace limit is the real cap. The cap was raised 3 → 10 at the user's request on 2026-10-01 to finish the system test.</p>
<h2>Credentials (fixed ids, pre-wired in the JSON)</h2><table class='ct'><tr><th>Credential</th><th>Type</th><th>Id</th><th>Used by</th></tr>""" + ''.join(f"<tr><td><b>{E(name)}</b></td><td>{E(t)}</td><td><code>{E(cid)}</code></td><td>{E(', '.join(sorted(ns)))}</td></tr>" for (cid, name, t), ns in sorted(creds.items(), key=lambda x: x[0][1] or '')) + "</table><p>Also: the API caller secret is the header credential \"SEO API Key\" (X-API-Key) on the API workflow; the form login is the basic-auth credential \"SEO Form Login\". The SMTP credential needs a Google App Password.</p>")
P.append(f"""<h1>5. Data model and API contract</h1>
<h2>Data Tables (created on first use by the Data Table node, referenced by name)</h2>
<table class='ct'><tr><th>Table</th><th>Columns</th><th>Written by</th><th>Read by</th></tr>
<tr><td><b>{LADDER_TABLE}</b></td><td>{E(', '.join(c + ' (' + t + ')' for c, t in LADDER_COLS))}</td><td>Ladder Rows → Save Ladder Rows (one row per ladder page; status planned / writing)</td><td>Rank Tracker (Load Ladders)</td></tr>
<tr><td><b>{HISTORY_TABLE}</b></td><td>{E(', '.join(c + ' (' + t + ')' for c, t in HISTORY_COLS))}</td><td>Rank Tracker (Parse Positions → Save History; position 0 = not in top 50, -1 = check failed)</td><td>Rank Tracker (deltas, stop rule)</td></tr></table>
<h2>API</h2><p><code>POST /webhook/seo-keyword-check</code>, header <code>X-API-Key</code>. Body: <code>mode</code> (keyword | verdict | audit | discover | describe | ladder), <code>keyword</code>, <code>country</code> (name or ISO-2), <code>domain</code>, <code>business</code>, <code>customers</code>, <code>business_facts</code>, <code>cta</code>, <code>tone</code>, <code>goal</code>, <code>page_type</code>, <code>competitors</code>, <code>receive</code> ["Keyword Report", "Page Content"], <code>report_type</code>, <code>pages_now</code> (ladder, 1-3), <code>wordpress_url</code>, <code>email</code>, <code>callback_url</code> (https; http only for localhost while testing). Answers <b>202</b> {{status: accepted, request_id, estimated_minutes}} or <b>400</b>.</p>
<p>Callbacks (POST to callback_url, same request_id): <code>stage</code> = site_description · keyword_strategy · content (verdict, keyword data, QA summary, ladder_id/rung/head when part of a ladder, run_ledger, pdf + file as base64) · site_audit · full_report · ladder_plan (head, feasibility, rungs, top_page, link_map, timeline, write_now, requirements, stats, pdf/file) · rank_tracker (progress; positions, rungs, gains, drops, next_step with a ready-to-send api_body). Rejections: {{status: rejected, request_id, error}}.</p>
<p>Ladder page runs carry <code>force_content</code>, <code>ladder_id</code>, <code>ladder_rung</code>, <code>ladder_head</code>, <code>ladder_page_no</code>, <code>ladder_links</code> (top page + sibling; planned pages are allowed link targets).</p>""")
# main workflow stages
P.append("<h1>6. Main workflow, stage by stage</h1><p>Every node of <b>SEO Agent v4</b> grouped by stage, in pipeline order. Descriptions come from the node itself (leading comment of the Code, HTTP target, IF condition, agent prompt, form fields) so they stay true to the build.</p>")
nodes_by_name = {n['name']: n for n in MAIN['nodes']}
covered = set()
for title, intro, names in STAGES:
    ns = [nodes_by_name[x] for x in names if x in nodes_by_name]; covered.update(n['name'] for n in ns)
    P.append(f"<h2>{E(title)}</h2><p>{E(intro)}</p>" + node_table(ns))
rest = [n for n in MAIN['nodes'] if n['name'] not in covered and n['type'] != 'n8n-nodes-base.stickyNote']
if rest: P.append("<h2>Other nodes</h2>" + node_table(rest))
P.append("<h1>7. The other workflows</h1>")
for f, name, role in WORKFLOWS[1:]:
    w = WFS[f]; ns = [n for n in w['nodes'] if n['type'] != 'n8n-nodes-base.stickyNote']
    P.append(f"<h2>{E(name)} <span class=small>({E(w['id'])})</span></h2><p>{E(role)}.</p>" + node_table(ns))
P.append("""<h1>8. Offline test harness</h1><p><code>harness/scenarios_v5.js</code> runs every Code node of the workflows against realistic fixtures (DataForSEO, Jina, PageSpeed, LLM outputs) in the n8n container's Node runtime, with a mini n8n executor (<code>$input</code>, <code>$('Node')</code>, <code>$runIndex</code>, static data, <code>getBinaryDataBuffer</code>). Scenarios: validation and rate limit; keyword mode (full content pipeline, truncated output, AVOID path, empty SERP); verdict; describe; discovery (research pool, relevance, clusters, strategy report, choice step, spawned follow-ups); full report and technical audit (crawl, probes incl. apex→www, HTML/schema, competitors, keywords, backlinks, PageSpeed, content review, AI visibility, scoring); S7 ladder (validation, API and page-run normalisation, ladder links as candidates, requests, pool, relevance, rung bands, link map, timeline, report, PDF, Data Table rows with exact columns, delivery, spawned payload round-trip, callback, store failure, all-pulls-failed stop); S8 tracker (plan, positions, history columns, second check with gains/drops, stop rule, no ladders); S9 WordPress payload. Last run: <b>161 node runs, 0 failed</b>. Generated reports land in <code>harness/sample-output/</code>; live samples are prefixed <code>LIVE-</code>.</p>""")
P.append("<h1>9. Live system test 2026-10-01</h1><p>All runs used the user's real inputs: domain <b>techand.ai</b>, keyword <b>e invoicing in uae</b>, country United Arab Emirates, e-mail kinnngahmed@gmail.com. API-style runs were started through the Test Runner (same path as the API front door's <i>Start SEO Run</i>); form runs were driven with curl against the public form. Each section lists the nodes n8n executed, in order, from the execution data.</p>")
for eid, title, how, result, kind, keys in RUNS_DOC: P.append(run_section(eid, title, how, result, kind, keys))
P.append("""<h2>Budget ledger of the session</h2><table class='ct'><tr><th>#</th><th>Run</th><th>Claude (guard estimate)</th><th>DataForSEO (ledger)</th><th>Outcome</th></tr>
<tr><td>1</td><td>Technical audit</td><td>$0.00</td><td>$0.09</td><td>Pass, 5.4 min, score 70, e-mail 250 OK</td></tr>
<tr><td>2</td><td>Keyword discovery</td><td>$0.38</td><td>$0.22</td><td>Pass, 2.0 min, callback 88 KB PDF</td></tr>
<tr><td>3</td><td>Full SEO report</td><td>$0.25</td><td>$1.02</td><td>Pass, 8.1 min, score 64, e-mail 443 KB</td></tr>
<tr><td>4a</td><td>Ladder attempt 1</td><td>~$0.23</td><td>~$0.05</td><td>Failed (credential slot) → fixed</td></tr>
<tr><td>4b</td><td>Ladder retry</td><td>$0.58</td><td>$0.12</td><td>Pass, 5.6 min, 9 pages, 9 rows, e-mail + callback</td></tr>
<tr><td>4c</td><td>Ladder page (content)</td><td>$1.20</td><td>$0.02</td><td>First blocked by the $3 cap (by design); passed after the cap was raised to $10: 10.3 min, score 85</td></tr>
<tr><td>5</td><td>Error handler</td><td>$0</td><td>$0</td><td>Pass after publishing the error workflow</td></tr>
<tr><td>6</td><td>Rank tracker</td><td>$0</td><td>$0.25</td><td>Pass, 9 keywords, e-mail + callback</td></tr>
<tr><td>7</td><td>Form: verdict</td><td>$0.20</td><td>$0.02</td><td>Pass, 2.9 min, download + e-mail</td></tr>
<tr><td>8</td><td>Form: discovery + choice</td><td>$0.35</td><td>$0.22</td><td>Choice step pass; follow-up never ran → redesign</td></tr>
<tr><td>9</td><td>Form: audit (spawned)</td><td>$0</td><td>$0.09</td><td>Pass, started page instant, 4.4 min, e-mail</td></tr>
<tr><td>10</td><td>Form: discovery + audit</td><td>$0</td><td>$0</td><td>Stopped by the 6-runs-per-e-mail limit (by design)</td></tr>
<tr><td colspan=2><b>Total</b></td><td><b>≈ $3.20 (estimates)</b></td><td><b>≈ $2.10</b></td><td>DataForSEO balance was $32.6 before the day</td></tr></table>""")
P.append("<h2>Full test log (from REVIEW.md §5c)</h2>" + testlog)
P.append("""<h1>10. Findings, fixes and roadmap</h1><h2>Found and fixed during this test</h2><ul>
<li><b>Credential slots for new nodes.</b> The two ladder nodes created after the build's credential pass had none; the build now re-runs the pass and asserts every model / data node carries one.</li>
<li><b>Error workflow never fired.</b> In n8n 2.x an error workflow must be published; <i>SEO Agent — Error Handler</i> had been imported unpublished. Published and verified with a deliberate failure.</li>
<li><b>Form completion pages end the execution.</b> Branches still queued (discovery report/content/audit, the audit "started" page order) never ran. Follow-ups are now spawned as separate executions; completion nodes are last; the WordPress gate runs before delivery.</li>
<li><b>Tracker cost.</b> $0.028 per keyword at depth 100 → depth 50 (~$0.015).</li>
<li><b>Ladder robustness.</b> Coarse AI topic labels are split per page type and capped at 6 keywords; an empty research pool stops with a clear message.</li></ul>
<h2>Observations for tuning</h2><ul>
<li>Generated pages still overrun the length target (2,458 vs 1,800 words after one editor pass) — the same tendency as the earlier content test; consider a hard trim step in QA.</li>
<li>Discovery priorities depend on the seed source: the API run that read the site found "e invoicing" (1,900/mo), the form run with a business text found only low-volume finance terms; blend both seed sources.</li>
<li>The "e-invoicing uae" cluster landed in tier Later in the API discovery although it carried the highest opportunity; let opportunity override the goal-aware slot cap.</li>
<li>WHOIS was $0.48 of the $1.02 full-report spend; query RDAP first.</li>
<li>When a ladder page run is rejected by a guard and the user left an e-mail but no callback, only ops is told; e-mail the user too.</li></ul>
<h2>Roadmap (REVIEW.md §6)</h2>""" + roadmap_html)
P.append("<h1>11. Appendix A: node inventory</h1>")
for f, name, role in WORKFLOWS:
    w = WFS[f]; ns = sorted([n for n in w['nodes'] if n['type'] != 'n8n-nodes-base.stickyNote'], key=lambda n: (n['position'][1], n['position'][0]))
    P.append(f"<h2>{E(name)}</h2><table class='ct'><tr><th>Node</th><th>Type</th><th>Version</th><th>Credential</th><th>Position</th></tr>" + ''.join(f"<tr><td>{E(n['name'])}</td><td>{E(TYPE_SHORT.get(n['type'], n['type']))}</td><td>{E(n['typeVersion'])}</td><td>{E(', '.join(v.get('name', '') for v in (n.get('credentials') or {}).values()))}</td><td class=small>{n['position'][0]}, {n['position'][1]}</td></tr>" for n in ns) + '</table>')
# ---------------------------------------------------------------- Appendix B: the generated page (live sample)
def md_to_html(md):
    esc = lambda x: html.escape(x)
    def inline(t):
        t = esc(t); t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t); t = re.sub(r'\[([^\[\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', t); return t
    out, lst, tbl = [], None, False
    for raw in md.split('\n'):
        l = raw.strip()
        if l.startswith('|'):
            if re.match(r'^\|[\s:|-]+\|$', l): continue
            cells = [c.strip() for c in l.strip('|').split('|')]
            if not tbl: out.append('<table class="ct"><tr>' + ''.join('<th>' + inline(c) + '</th>' for c in cells) + '</tr>'); tbl = True
            else: out.append('<tr>' + ''.join('<td>' + inline(c) + '</td>' for c in cells) + '</tr>')
            continue
        if tbl: out.append('</table>'); tbl = False
        if not l:
            if lst: out.append('</' + lst + '>'); lst = None
            continue
        m = re.match(r'^(#{1,4})\s+(.+)$', l)
        if m:
            if lst: out.append('</' + lst + '>'); lst = None
            lvl = min(4, len(m.group(1)) + 1); out.append(f'<h{lvl} class="page">' + inline(m.group(2)) + f'</h{lvl}>'); continue
        m = re.match(r'^[-*]\s+(.+)$', l)
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
        if re.match(r'^(Title|Meta Description|Slug|Primary Keyword|Secondary Keywords):', l): out.append('<p class="small"><b>' + inline(l.split(':', 1)[0]) + ':</b> ' + inline(l.split(':', 1)[1].strip()) + '</p>'); continue
        if l.startswith('<script'): continue
        out.append('<p>' + inline(l) + '</p>')
    if lst: out.append('</' + lst + '>')
    if tbl: out.append('</table>')
    return '\n'.join(out)
sample_md = os.path.join(HERE, 'harness', 'sample-output', 'LIVE-ladder-page-uae-e-invoicing-penalties.md')
if os.path.exists(sample_md):
    md = open(sample_md, encoding='utf-8').read()
    md = re.sub(r'<script type="application/ld\+json">[\s\S]*?</script>', '', md)
    P.append("<h1>12. Appendix B: the page generated in the live test</h1><p>The ladder's first page, \"uae e invoicing penalties\" (rung 1, Blog Post), exactly as the content pipeline delivered it on 2026-10-01 (execution 46): Opus brief and copy, Sonnet critique, deterministic QA, one Opus editor pass. Content score 85/100; text in [square brackets] is a placeholder the client must replace; the two internal links to the ladder's planned top page and sibling are part of the ladder design. JSON-LD blocks are omitted here (they are in the report files under <code>harness/sample-output/LIVE-ladder-page-uae-e-invoicing-penalties.*</code>).</p><div class='generated'>" + md_to_html(md) + "</div>")
    P.append("<p class='small'>Other live samples in the same folder: the Keyword Ladder Plan (PDF, Word, callback JSON), the form verdict download, the \"Choose your keyword\" and ladder form pages, and the rank-tracker progress e-mail.</p>")
# ---------------------------------------------------------------- Appendix C: everything the live test generated, and what it was used for
import base64
FULL = os.path.join(RUNS, 'full'); SAMPLES = os.path.join(HERE, 'harness', 'sample-output')
def fj(eid, node):
    f = os.path.join(FULL, f"{eid}_{re.sub(r'[^A-Za-z0-9_]', '', node.replace(' ', '_'))}.json")
    if not os.path.exists(f): return {}
    try: return json.load(open(f, encoding='utf-8'))
    except Exception: return {}
def jblock(obj, limit=2600):
    t = json.dumps(obj, indent=1, ensure_ascii=False)
    return "<pre>" + E(t[:limit]) + (f"\n… ({len(t) - limit:,} more characters in docs/runs/full)" if len(t) > limit else '') + "</pre>"
def tbl(rows, cols, limit=40):
    if not rows: return "<p class=small>none</p>"
    h = "<table class='ct'><tr>" + ''.join(f"<th>{E(c[0])}</th>" for c in cols) + "</tr>"
    for r in rows[:limit]:
        h += "<tr>" + ''.join("<td>" + E(c[1](r) if callable(c[1]) else r.get(c[1], '')) + "</td>" for c in cols) + "</tr>"
    return h + "</table>" + (f"<p class=small>{len(rows) - limit} more rows not shown.</p>" if len(rows) > limit else '')
def embed_report(html_doc, label):
    """Embeds a generated Word-compatible report (its own HTML) inside the guide without breaking the page layout."""
    if not html_doc: return "<p class=small>report not available</p>"
    body = re.search(r'<body[^>]*>([\s\S]*)</body>', html_doc)
    b = body.group(1) if body else html_doc
    b = re.sub(r'<style[\s\S]*?</style>', '', b); b = re.sub(r'<!--\[if[\s\S]*?<!\[endif\]-->', '', b)
    b = b.replace('class="cover"', 'class="rcover"').replace('<h1 class="title">', '<div class="rtitle">')
    b = re.sub(r'<h1([^>]*)>', r'<h2 class="rh1"\1>', b); b = b.replace('</h1>', '</h2>')
    b = re.sub(r'<div class="rtitle">([^<]*)</h2>', r'<div class="rtitle">\1</div>', b)   # the renamed cover title
    b = b.replace('class="pb"', 'class="rpb"')
    return f"<div class='report'><div class='rlabel'>Delivered report: {E(label)}</div>{b}</div>"
def save_sample(name, data):
    try: open(os.path.join(SAMPLES, name), 'wb').write(data); return True
    except Exception: return False
def callback_files(eid, base):
    b = (fj(eid, 'Callback Webhook').get('json') or {}).get('body') or {}
    doc = base64.b64decode(b['file']['data']) if b.get('file') else b''
    pdf = base64.b64decode(b['pdf']['data']) if b.get('pdf') else b''
    if doc: save_sample(base + '.doc.html', doc)
    if pdf: save_sample(base + '.pdf', pdf)
    slim = {k: v for k, v in b.items() if k not in ('file', 'pdf')}
    if slim: save_sample(base + '.callback.json', json.dumps(slim, indent=1, ensure_ascii=False).encode())
    return doc.decode('utf-8', 'ignore') if doc else '', slim
def inline_doc(eid, node):
    bn = (fj(eid, node).get('binary') or {}).get('data') or {}
    try: return base64.b64decode(bn.get('data', '')).decode('utf-8', 'ignore') if bn.get('data') else ''
    except Exception: return ''
SEV = lambda f: f.get('severity', '')
FIND_COLS = [('Severity', SEV), ('Category', 'category'), ('Finding', 'title'), ('Evidence', lambda f: str(f.get('evidence', ''))[:160]), ('Fix', lambda f: str(f.get('fix', ''))[:160])]
KW_COLS = [('Keyword', 'keyword'), ('Searches/mo', lambda k: k.get('volume')), ('KD', lambda k: k.get('kd')), ('CPC', lambda k: k.get('cpc')), ('Intent', 'intent'), ('Page type', 'page_type'), ('Opportunity', lambda k: k.get('opportunity', k.get('pre_score')))]
C = []
C.append("""<h1>13. Appendix C: everything the live test generated, and what it was used for</h1>
<p>Every artefact below was produced on 2026-10-01 for techand.ai and the keyword "e invoicing in uae". For each run: the inputs, the intermediate data each node produced (with the downstream step that consumed it), and the delivered report exactly as the customer received it. Full JSON of every item is in <code>docs/runs/full/</code>; the delivered files are in <code>harness/sample-output/LIVE-*</code>.</p>""")

# ---- Run 18: discovery
sd = (fj(18, 'Parse Description').get('json') or {}).get('site_description') or {}
seeds = fj(18, 'Seed List').get('json') or {}
res = (fj(18, 'Collect Research').get('json') or {}).get('research') or {}
ks = (fj(18, 'Build Keyword Strategy').get('json') or {}).get('keyword_strategy') or {}
ideas_doc, ideas_cb = callback_files(19, 'LIVE-keyword-strategy-techand')
C.append("<h2>Run 18 — Keyword discovery (API, techand.ai, goal leads)</h2>")
C.append("<h3>Site description (Site Describer, Claude Haiku) → used by Keyword Seeds, the relevance screen and every later prompt as the business context</h3>" + jblock(sd, 2200))
C.append("<h3>Seeds by buyer motive (Keyword Seeds, Claude Sonnet → Seed List) → used by Research Requests for the seven DataForSEO pulls</h3>" + jblock({k: seeds.get(k) for k in ('primary_seed', 'seed_groups', 'services')}, 2200))
C.append(f"<h3>Research pool (Collect Research) → scored candidates for the AI relevance screen</h3><p>Pool {E(res.get('pool_size'))} keywords from {E(res.get('requests'))} pulls; by source {E(json.dumps(res.get('by_source')))}; failures: {E(json.dumps(res.get('failures')))}. Top candidates before the AI screen:</p>" + tbl(res.get('candidates') or [], KW_COLS, 20))
C.append(f"<h3>Keyword strategy (Rank Keywords + Build Keyword Strategy) → the report, the API callback and the form's choice step</h3><p>{E(ks.get('total_relevant'))} relevant of {E(ks.get('ai_reviewed'))} AI-reviewed; {len(ks.get('clusters') or [])} clusters; goal {E(ks.get('goal'))}. Priority keywords (live-checked on Google):</p>" + tbl(ks.get('priority') or [], KW_COLS + [('Who ranks now', lambda k: ', '.join(((k.get('live') or {}).get('top_domains') or [])[:3]))], 12) + "<p>Content plan (clusters with tiers):</p>" + tbl(ks.get('clusters') or [], [('Tier', 'tier'), ('Topic', 'topic'), ('Primary keyword', 'primary_keyword'), ('Page type', 'page_type'), ('Keywords', lambda c: c.get('keyword_count')), ('Searches/mo', lambda c: c.get('total_volume')), ('KD', lambda c: c.get('primary_kd'))], 25) + "<p>AI search demand (DataForSEO AI keyword data):</p>" + tbl(((ks.get('ai_demand') or {}).get('top') or []), [('Keyword', 'keyword'), ('AI searches/mo', lambda k: k.get('ai_search_volume')), ('Google searches/mo', lambda k: k.get('google_volume'))], 10))
C.append("<h3>Delivered: Keyword Strategy report (PDF 88 KB + Word) → posted to the callback (stage keyword_strategy)</h3>" + embed_report(ideas_doc, 'keyword-ideas-techand-ai-2026-10-01.doc'))

# ---- Run 16: technical audit
probe = (fj(16, 'Analyze Probes').get('json') or {}).get('probe') or {}
sa16 = (fj(16, 'Build Site Issues').get('json') or {}).get('site_audit') or {}
audit_doc, audit_cb = callback_files(24, 'LIVE-technical-audit-techand')
C.append("<h2>Run 16 — Technical site audit (API, techand.ai)</h2>")
C.append("<h3>Crawl, extras and probes → findings for the scorer</h3><p>Probe measurements: " + E(json.dumps(probe.get('measurements'))) + "</p><p>Probe findings:</p>" + tbl(probe.get('findings') or [], FIND_COLS, 20) + "<p>What works (probes): " + E('; '.join(probe.get('what_works') or [])) + "</p>")
C.append(f"<h3>Scored audit (Build Site Issues) → the Site Audit report, the e-mail subject and the callback</h3><p>Health score <b>{E(sa16.get('health_score'))}/100</b> ({E(sa16.get('grade'))}); raw {E(sa16.get('raw_score'))}, cap {E(sa16.get('score_cap'))}; category scores {E(json.dumps(sa16.get('category_scores')))}; issue counts {E(json.dumps(sa16.get('issue_counts')))}.</p>" + tbl(sa16.get('findings') or [], FIND_COLS, 45) + "<p>What works: " + E('; '.join((sa16.get('what_works') or [])[:25])) + "</p>")
C.append("<h3>Delivered: Site Audit report (PDF + Word) → e-mailed to kinnngahmed@gmail.com (250 OK) and posted to the callback (stage site_audit)</h3>" + embed_report(audit_doc, 'site-audit-techand-ai-2026-10-01.doc'))

# ---- Run 21: full report
sa21 = (fj(21, 'Build Site Issues').get('json') or {}).get('site_audit') or {}
ca = (fj(21, 'Competitor Analysis').get('json') or {}).get('competitor_benchmark') or {}
ak = (fj(21, 'Analyze Keywords').get('json') or {}).get('site_keywords') or {}
ab = (fj(21, 'Analyze Backlinks').get('json') or {}).get('authority') or {}
ap = (fj(21, 'Analyze PageSpeed').get('json') or {}).get('pagespeed') or {}
pcr = fj(21, 'Parse Content Review').get('json') or {}
av = (fj(21, 'AI Visibility').get('json') or {}).get('ai_visibility') or {}
full_doc, full_cb = callback_files(25, 'LIVE-full-seo-report-techand')
C.append("<h2>Run 21 — Full SEO report (API, techand.ai)</h2>")
C.append("<h3>Competitor benchmark (Find Competitors / Fallback SERP / Domain Overview / WHOIS + RDAP → Competitor Analysis) → Authority findings and the report's benchmark table</h3>" + tbl(ca.get('rows') or [], [('Domain', 'domain'), ('Organic keywords', lambda r: r.get('organic_keywords')), ('Top 10', lambda r: r.get('top10')), ('Est. visits/mo', lambda r: r.get('est_monthly_traffic')), ('Domain age (y)', lambda r: r.get('domain_age_years')), ('Method', 'method')]))
C.append("<h3>Keywords (Ranked Keywords + Keyword Ideas → Analyze Keywords) → keyword gap, easy wins, striking distance</h3>" + tbl(ak.get('domains') or [], [('Domain', 'domain'), ('Ranked keywords', lambda d: d.get('total')), ('Top 10', lambda d: d.get('top10'))]) + f"<p>Keyword gap {len(ak.get('keyword_gap') or [])}, easy wins {len(ak.get('easy_wins') or [])}, striking distance {len(ak.get('striking_distance') or [])}. Easy wins:</p>" + tbl(ak.get('easy_wins') or [], [('Keyword', 'keyword'), ('Searches/mo', lambda k: k.get('search_volume', k.get('volume'))), ('KD', lambda k: k.get('keyword_difficulty', k.get('kd'))), ('Position', lambda k: k.get('position'))], 12))
C.append("<h3>Backlinks (Backlink Summary + Backlink Gap → Analyze Backlinks)</h3><p>Available: " + E(ab.get('available')) + "</p>" + tbl(ab.get('rows') or [], [('Domain', 'domain'), ('Referring domains', lambda r: r.get('referring_domains')), ('Backlinks', lambda r: r.get('backlinks')), ('You', lambda r: 'yes' if r.get('is_you') else '')]) + "<p>Link gap (domains linking to competitors, not to you):</p>" + tbl(ab.get('gap') or [], [('Referring domain', 'referring_domain'), ('Links to competitors', lambda g: g.get('links_to_competitors')), ('Rank', lambda g: g.get('rank'))], 12))
C.append("<h3>PageSpeed (Google PageSpeed Insights → Analyze PageSpeed) → Performance findings</h3>" + tbl(ap.get('rows') or [], [('Domain', 'domain'), ('Performance score', lambda r: r.get('score')), ('LCP (field)', lambda r: (r.get('field') or {}).get('lcp')), ('CLS (field)', lambda r: (r.get('field') or {}).get('cls')), ('INP (field)', lambda r: (r.get('field') or {}).get('inp')), ('Available', lambda r: r.get('available'))]))
C.append("<h3>E-E-A-T content review (Claude Sonnet, Content Reviewer → Parse Content Review) → listed findings (not scored)</h3>" + tbl([f for f in (pcr.get('extra_findings') or []) if f.get('source') == 'ai_review'], FIND_COLS, 15))
C.append("<h3>AI visibility (brand SERP, AI Overviews, live ChatGPT / Perplexity answers → AI Visibility) → AI Search Readiness findings</h3>" + jblock({k: av.get(k) for k in ('brand_name', 'index_estimate', 'queries', 'llm_answers')}, 3200))
C.append(f"<h3>Scored report (Build Site Issues) → Full SEO Report, e-mail and callback</h3><p>Health score <b>{E(sa21.get('health_score'))}/100</b> ({E(sa21.get('grade'))}); category scores {E(json.dumps(sa21.get('category_scores')))}; issue counts {E(json.dumps(sa21.get('issue_counts')))}; not assessed: {E(json.dumps(sa21.get('not_assessed')))}.</p>" + tbl(sa21.get('findings') or [], FIND_COLS, 70))
C.append("<h3>Delivered: Full SEO Report (PDF + Word, 443 KB e-mail) → e-mailed and posted to the callback (stage full_report)</h3>" + embed_report(full_doc, 'full-seo-report-techand-ai-2026-10-01.doc'))

# ---- Run 27: ladder
pv27 = fj(27, 'Parse Verdict').get('json') or {}
lp = fj(27, 'Ladder Pool').get('json') or {}
ladder = (fj(27, 'Ladder Plan').get('json') or {}).get('ladder') or {}
ladder_doc, ladder_cb = callback_files(33, 'LIVE-ladder-plan-e-invoicing-in-uae')
C.append("<h2>Run 27 — Keyword ladder for \"e invoicing in uae\" (API, techand.ai, pages_now 1)</h2>")
C.append("<h3>Head-term research (sitemap, client pages, SERP, competitor pages, facts, Competitor Analyzer, keyword data, site authority) → Verdict</h3>" + jblock({'keyword_data': pv27.get('keyword_data'), 'site_authority': pv27.get('site_authority'), 'competitor_analysis (excerpt)': {k: (pv27.get('competitor_analysis') or {}).get(k) for k in ('search_intent', 'ranking_page_types', 'recommended_word_count', 'content_gaps', 'unique_angle', 'feasibility_note')}}, 3000))
C.append("<h3>Verdict on the head term (Claude Sonnet) → feasibility of the ladder, alternatives, the top page type</h3>" + jblock({k: pv27.get(k) for k in ('verdict', 'verdict_score', 'verdict_reasons', 'verdict_changes', 'recommended_page', 'secondary_keywords', 'expected_visits_top3', 'time_to_rank_months')}, 3600))
C.append(f"<h3>Ladder research pool (Ladder Requests → Run Ladder Research → Ladder Pool) → the AI relevance screen</h3><p>Pool {E((lp.get('research') or {}).get('pool_size'))} keywords; by source {E(json.dumps((lp.get('research') or {}).get('by_source')))}; site rankings found {E((lp.get('site_rankings') or {}).get('count'))}; head tokens {E(json.dumps(lp.get('head_tokens')))}.</p>" + tbl(((lp.get('research') or {}).get('candidates') or []), KW_COLS + [('Your position', lambda k: k.get('your_position'))], 20))
C.append("<h3>Ladder plan (Ladder Plan) → the plan report, the Data Table rows, the page runs and the tracker</h3>" + ''.join(f"<p><b>Rung {r.get('rung')}</b> ({E(r.get('label'))}, months {E(r.get('months'))}, {E(r.get('available'))} keywords available):</p>" + tbl(r.get('pages') or [], [('#', lambda p: p.get('page_no')), ('Page (primary keyword)', 'keyword'), ('Supporting', lambda p: ', '.join(p.get('supporting') or [])), ('Type', 'page_type'), ('Searches/mo', lambda p: p.get('total_volume')), ('KD', lambda p: p.get('kd')), ('You today', lambda p: p.get('your_position')), ('URL', 'target_url'), ('Status', 'status')]) for r in (ladder.get('rungs') or [])) + "<p><b>Top page:</b> " + E(json.dumps({k: (ladder.get('top') or {}).get(k) for k in ('keyword', 'page_type', 'volume', 'kd', 'target_url', 'exists', 'months')})) + "</p><p>Internal link map:</p>" + tbl(ladder.get('link_map') or [], [('From', 'from'), ('To', 'to'), ('Type', 'type')], 40) + "<p>Requirements:</p>" + tbl(ladder.get('requirements') or [], [('Item', 'item'), ('Detail', 'detail')]) + "<p>Stats: " + E(json.dumps(ladder.get('stats'))) + "</p>")
C.append("<h3>Delivered: Keyword Ladder Plan (PDF 72 KB + Word) → e-mailed (123 KB, 250 OK), posted to the callback (stage ladder_plan), 9 rows written to seo_ladders, first page run spawned</h3>" + embed_report(ladder_doc, 'keyword-ladder-e-invoicing-in-uae-2026-10-01.doc'))

# ---- Run 35: tracker
tr = fj(35, 'Tracker Report').get('json') or {}
_, tr_cb = callback_files(36, 'LIVE-tracker-progress-e-invoicing-in-uae')
C.append("<h2>Run 35 — Rank Tracker (manual run)</h2><h3>Positions (SERP Check → Parse Positions → seo_rank_history) and the recommendation (Tracker Report) → progress e-mail and callback (stage rank_tracker)</h3>" + tbl(tr.get('positions') or [], [('Rung', lambda p: p.get('rung')), ('Keyword', 'keyword'), ('Position now', lambda p: p.get('position')), ('Previous', lambda p: p.get('previous')), ('Delta', lambda p: p.get('delta')), ('URL', 'url')]) + "<p>Rungs: " + E(json.dumps(tr.get('rungs'))) + "</p><p>Next step: " + E((tr.get('next_step') or {}).get('text')) + "</p><p>Ready-to-send API body for the next page: </p>" + jblock(tr.get('api_body'), 900) + "<h3>Delivered: progress e-mail (250 OK)</h3><div class='report'>" + (tr.get('html') or '') + "</div>")

# ---- Run 46: the ladder page (content)
n46 = fj(46, 'Normalize Input').get('json') or {}
cu46 = fj(46, 'Collect Site URLs').get('json') or {}
cp46 = fj(46, 'Collect Client Pages').get('json') or {}
acp = fj(46, 'Analyze Competitor Pages').get('json') or {}
cf = fj(46, 'Collect Facts').get('json') or {}
pa = fj(46, 'Parse Analysis').get('json') or {}
mk = fj(46, 'Merge Keyword Data').get('json') or {}
pv46 = fj(46, 'Parse Verdict').get('json') or {}
pb = fj(46, 'Parse Brief').get('json') or {}
pcq = fj(46, 'Parse Critique').get('json') or {}
qa46 = fj(46, 'Content QA').get('json') or {}
content_doc, content_cb = callback_files(47, 'LIVE-ladder-page-uae-e-invoicing-penalties')
C.append("<h2>Run 46 — The ladder's first page: \"uae e invoicing penalties\" (content run spawned by the ladder)</h2>")
C.append("<h3>Normalised input (Normalize Input) → every later node</h3>" + jblock({k: n46.get(k) for k in ('mode', 'keyword', 'page_type', 'domain', 'country', 'business', 'audience', 'goal', 'include_content', 'include_seo_report', 'force_content', 'ladder_id', 'ladder_rung', 'ladder_head', 'ladder_links', 'via_webhook', 'callback_url')}, 2600))
C.append(f"<h3>Site pages (Fetch Sitemaps → Collect Site URLs) → internal-link candidates for the brief and the QA</h3><p>{E(cu46.get('site_urls_count'))} URLs in the sitemap; existing page: {E(json.dumps(cu46.get('existing_page')))}. Candidates (ladder pages first):</p>" + tbl(cu46.get('internal_link_candidates') or [], [('URL', 'url'), ('Ladder role', lambda c: c.get('ladder', '')), ('Planned', lambda c: 'yes' if c.get('planned') else '')], 12))
C.append(f"<h3>Client pages (Read Client Pages → Collect Client Pages) → real facts and trust signals for the brief</h3><p>{E(cp46.get('client_pages_read'))} pages read; signals: {E(json.dumps(cp46.get('client_signals')))}</p>")
C.append(f"<h3>Competitor pages (SERP Top 10 → Pick Top 6 → Read Competitor Pages → Analyze Competitor Pages) → term model, questions and statistics for the analyzer and the QA coverage check</h3><p>{E(acp.get('competitors_read'))} competitor pages read (avg {E(acp.get('avg_competitor_words'))} words); SERP features: {E(json.dumps((acp.get('serp_features') or {}).get('features_present')))}; AI Overview cites {E(json.dumps(((acp.get('serp_features') or {}).get('ai_overview') or {}).get('cited_domains')))}.</p>" + tbl(acp.get('competitors') or [], [('Rank', lambda c: c.get('rank')), ('Domain', 'domain'), ('Title', lambda c: str(c.get('title', ''))[:80]), ('Words', lambda c: c.get('word_count'))]) + "<p>Term model (top shared terms): " + E(', '.join(f"{t.get('term')} ({t.get('docs')})" for t in (acp.get('term_model') or [])[:25])) + "</p><p>Competitor questions: " + E(' · '.join((acp.get('competitor_questions') or [])[:10])) + "</p>")
C.append("<h3>Verified facts (Facts SERP → Collect Facts) → the brief's evidence plan; only these numbers may appear with a source</h3>" + tbl(cf.get('facts') or [], [('Fact', lambda f: str(f.get('fact', ''))[:200]), ('Source', 'source'), ('Authority', 'authority'), ('URL', 'url')], 15))
C.append("<h3>Competitor analysis (Claude Sonnet, Competitor Analyzer → Parse Analysis) → verdict and brief</h3>" + jblock(pa.get('competitor_analysis'), 3600))
C.append("<h3>Keyword data and site authority (Keyword Data, Site Authority → Merge Keyword Data) → verdict</h3>" + jblock({'keyword_data': mk.get('keyword_data'), 'site_authority': mk.get('site_authority')}, 2200))
C.append("<h3>Verdict (Claude Sonnet) → brief; force_content keeps the page even on AVOID</h3>" + jblock({k: pv46.get(k) for k in ('verdict', 'verdict_score', 'verdict_reasons', 'verdict_changes', 'recommended_page', 'secondary_keywords', 'expected_visits_top3', 'time_to_rank_months')}, 3400))
C.append("<h3>Content brief (Claude Opus, Strategy Brief → Parse Brief) → the only instruction the copywriter gets</h3>" + jblock(pb.get('content_brief'), 7000))
C.append("<h3>Editorial critique of the first draft (Claude Sonnet, Critic → Parse Critique) → revision instructions for the editor</h3>" + jblock(pcq.get('critique'), 3200))
C.append("<h3>Content QA after the editor pass (Content QA) → report's quality section, qa_summary in e-mail/callback</h3>" + jblock({k: (qa46.get('content_qa') or {}).get(k) for k in ('content_score', 'score_breakdown', 'passed', 'main_content_words', 'target_word_count', 'coverage_pct', 'keyword_mentions', 'keyword_density_pct', 'h2_count', 'faq_count', 'internal_links', 'external_links', 'readability', 'banned_phrases', 'warnings', 'auto_fixes', 'schema_types', 'critic_score', 'critic_verdict')}, 3600))
C.append("<h3>Delivered: keyword report + page content (PDF 187 KB + Word 52 KB) → posted to the callback (stage content, with ladder_id / rung / head). The page itself is also in Appendix B.</h3>" + embed_report(content_doc, 'seo-report-and-content-uae-e-invoicing-penalties-2026-10-01.doc'))

# ---- Run 38: form verdict
pv38 = fj(38, 'Parse Verdict').get('json') or {}
verdict_doc = inline_doc(38, 'Attach PDF Report')
if verdict_doc: save_sample('LIVE-form-verdict-e-invoicing-in-uae.doc.html', verdict_doc.encode())
C.append("<h2>Run 38 — Form path: \"Check if my keyword is right\" for \"e invoicing in uae\"</h2><h3>Verdict (Claude Sonnet) → report, download page and e-mail</h3>" + jblock({k: pv38.get(k) for k in ('verdict', 'verdict_score', 'verdict_reasons', 'verdict_changes', 'recommended_page', 'secondary_keywords', 'expected_visits_top3', 'time_to_rank_months')}, 3400) + "<h3>Delivered: Keyword Verdict report → form download (\"Your report is ready\") and e-mail (76 KB, 250 OK)</h3>" + embed_report(verdict_doc, 'keyword-verdict-e-invoicing-in-uae-2026-10-01.doc'))

# ---- Run 41: form discovery + choice
ks41 = (fj(41, 'Build Keyword Strategy').get('json') or {})
ac41 = fj(41, 'Apply Choice').get('json') or {}
C.append("<h2>Run 41 — Form path: discovery with the \"Choose your keyword\" step</h2><p>Business text given on the form (no site read). Choice options shown on the form page:</p><ul>" + ''.join(f"<li>{E(o)}</li>" for o in (ks41.get('choice_options') or [])) + f"</ul><p>User's pick: <b>{E(ac41.get('chosen_keyword'))}</b> (chosen_by {E(ac41.get('chosen_by'))}); it replaced the system suggestion <b>{E(((ks41.get('keyword_strategy') or {}).get('pipeline_keyword') or {}).get('keyword'))}</b> as the pipeline keyword and in the report. Priority keywords of this run:</p>" + tbl(((ks41.get('keyword_strategy') or {}).get('priority') or []), KW_COLS, 8) + "<p>The keyword-ideas download page was served; the chained report did not run in this execution (completion ended it) — the redesigned flow spawns it as its own run.</p>")

# ---- Run 43: spawned audit from the form; Run 30: ops alert
a43 = fj(43, 'Attach PDF Audit').get('json') or {}
audit43_doc = inline_doc(43, 'Attach PDF Audit')
if audit43_doc: save_sample('LIVE-form-audit-techand.doc.html', audit43_doc.encode())
fa = fj(30, 'Format Alert').get('json') or {}
C.append(f"<h2>Run 43 — Form path: technical audit started from the form (spawned execution)</h2><p>Same report type as run 16; health score <b>{E(a43.get('health_score'))}/100</b> ({E(a43.get('grade'))}), issue counts {E(json.dumps(a43.get('issue_counts')))}; top issues: {E(' · '.join(a43.get('top_issues') or []))}. E-mailed to kinnngahmed@gmail.com (208 KB, 250 OK); saved as <code>LIVE-form-audit-techand.doc.html</code>.</p>")
C.append("<h2>Run 29/30 — Error handler check</h2><p>A deliberate API request without callback or e-mail made <i>API Reject</i> throw; the Error Handler's <i>Format Alert</i> produced the ops e-mail below (sent, 250 OK).</p><p><b>Subject:</b> " + E(fa.get('subject')) + "</p><div class='report'>" + (fa.get('html') or '') + "</div>")
P.extend(C)

doc = f"<!DOCTYPE html><html><head><meta charset='utf-8'><title>SEO Agent v4.2 — Developer Guide and Live Test Report</title><style>{css}</style></head><body>{''.join(P)}</body></html>"
out_html = os.path.join(DOCS, 'SEO_Agent_v4.2_Developer_Guide.html'); open(out_html, 'w', encoding='utf-8').write(doc)
print('wrote', out_html, len(doc) // 1024, 'KB;', sum(len([n for n in WFS[f]['nodes'] if n['type'] != 'n8n-nodes-base.stickyNote']) for f, _, _ in WORKFLOWS), 'nodes documented')
