#!/usr/bin/env python3
"""Builds SEO Agent v4 from the v3 export by applying explicit, asserted patches."""
import json, copy, uuid, os, re, sys
HERE0 = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.isfile(os.path.join(HERE0, 'workflows', 'SEO_Agent_v3_original_export.json'))
SRC = os.path.join(HERE0, 'workflows', 'SEO_Agent_v3_original_export.json') if PROJECT else '../wf/seo_wf.json'
OUT_JSON = os.path.join(HERE0, 'workflows', 'SEO_Agent_v4.json') if PROJECT else 'SEO_Agent_v4.json'
OUT_CODE = os.path.join(HERE0, 'harness', 'code_v4') if PROJECT else 'code_v4'
OUT_CHANGES = os.path.join(HERE0, 'CHANGES_v3_to_v4.md') if PROJECT else 'CHANGES.md'
d = json.load(open(SRC)); w = d[0] if isinstance(d, list) else d
nodes = {n['name']: n for n in w['nodes']}
conns = w['connections']
CHANGES = []
def log(s): CHANGES.append(s); print(' +', s)

def code(name): return nodes[name]['parameters']['jsCode']
def setcode(name, c): nodes[name]['parameters']['jsCode'] = c
def patch(name, old, new, count=1):
    c = code(name)
    assert c.count(old) == count, f'[{name}] expected {count}x, found {c.count(old)}x: {old[:80]!r}'
    setcode(name, c.replace(old, new))
def connect(src, dst, out=0, inp=0, ctype='main'):
    outs = conns.setdefault(src, {}).setdefault(ctype, [])
    while len(outs) <= out: outs.append([])
    if not any(t['node'] == dst and t.get('index', 0) == inp for t in outs[out]):
        outs[out].append({'node': dst, 'type': ctype, 'index': inp})
def disconnect(src, dst):
    for ctype, outs in conns.get(src, {}).items():
        for lst in outs: lst[:] = [t for t in lst if t['node'] != dst]
def rename(old, new):
    n = nodes.pop(old); n['name'] = new; nodes[new] = n
    if old in conns: conns[new] = conns.pop(old)
    for src, outs in conns.items():
        for ctype, lists in outs.items():
            for lst in lists:
                for t in lst:
                    if t['node'] == old: t['node'] = new
    for nm in nodes:  # expression references
        p = json.dumps(nodes[nm]['parameters']); q = p.replace(f"$('{old}')", f"$('{new}')")
        if p != q: nodes[nm]['parameters'] = json.loads(q)
NS = uuid.UUID('5e0a9e1e-2a1f-4c0b-9d8e-seoagent0001'.replace('seoagent0001', '0000a9e0c0de'))
def nid(name): return str(uuid.uuid5(NS, name))
def add_node(name, ntype, version, params, pos, extra=None):
    n = {'parameters': params, 'id': nid(name), 'name': name, 'type': ntype, 'typeVersion': version, 'position': pos}
    if extra: n.update(extra)
    nodes[name] = n; return n
def if_node(name, expr, pos):
    return add_node(name, 'n8n-nodes-base.if', 2.3, {'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'loose', 'version': 3}, 'conditions': [{'id': nid(name + ':cond'), 'leftValue': '=' + expr, 'rightValue': '', 'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}], 'combinator': 'and'}, 'looseTypeValidation': True, 'options': {}}, pos)
def pos(name): return nodes[name]['position']

# =============================================================================
# 1. INTAKE: non-throwing validation, friendly error page / 400, API 202 ack
# =============================================================================
c = code('Normalize Input')
assert c.count('return [{\n  json: {\n    mode,') == 1
c = c.replace("if (via_webhook && include_audit && !email) throw new Error('Audits requested via the API need an email address.');",
              "if (via_webhook && include_audit && !email) throw new Error('Audits requested via the API need an email address.');\nif (via_webhook && !callback_url && !email) throw new Error('API requests need a callback_url (https) or an email address so the result can be delivered.');")
c = c.replace("    started_at: new Date().toISOString()\n", "    started_at: new Date().toISOString(),\n    validation_error: ''\n")
# honour the "What do you want to receive?" checkboxes in keyword mode
old = """  if (mode === 'keyword' && !verdict_only) {
    // "I know my keyword" always produces the page content; the keyword report is on by default too
    include_content = true;
    if (!wants.length) include_seo_report = true;
  }"""
new = """  if (mode === 'keyword' && !verdict_only && !wants.length) {
    // Nothing ticked under "What do you want to receive?" -> default to both deliverables
    include_content = true;
    include_seo_report = true;
  }"""
assert old in c; c = c.replace(old, new)
c = """// v4: validation errors no longer crash the run. They are returned as { validation_error } and shown to the
// user (form completion page) or returned as HTTP 400 (API). See "Input OK?" right after Rate Limit.
let __via_webhook = false;
try { $('Start Form').first(); } catch (e) { __via_webhook = true; }
const __main = () => {
""" + c + """
};
try { return __main(); }
catch (e) {
  return [{ json: { validation_error: String(e && e.message || e).replace(/^Error:\\s*/, ''), via_webhook: __via_webhook, mode: null, brand: 'Dev SEO' } }];
}
"""
setcode('Normalize Input', c)
log('Normalize Input: validation errors returned as data (not thrown); API needs callback_url or email; keyword mode honours the deliverable checkboxes')

c = code('Rate Limit')
c = c.replace("const d = $input.first().json;\n", "const d = $input.first().json;\nif (d.validation_error) return [{ json: d }];          // pass validation errors straight through\n")
c = c.replace("  throw new Error('This service has reached its daily capacity. Please try again tomorrow.');", "  return [{ json: { ...d, validation_error: 'This service has reached its daily capacity. Please try again tomorrow.' } }];")
c = c.replace("  throw new Error('You have reached the daily limit of ' + LIMITS.per_key_per_day + ' runs. Please try again tomorrow.');", "  return [{ json: { ...d, validation_error: 'You have reached the daily limit of ' + LIMITS.per_key_per_day + ' runs. Please try again tomorrow.' } }];")
assert 'throw new Error' not in c
setcode('Rate Limit', c)
log('Rate Limit: limit hits returned as validation_error instead of crashing')

rl = pos('Rate Limit')
if_node('Input OK?', "{{ !$json.validation_error }}", [rl[0] + 220, rl[1]])
if_node('Error Via API?', "{{ !!$json.via_webhook }}", [rl[0] + 440, rl[1] + 260])
add_node('API Reject', 'n8n-nodes-base.code', 2, {'jsCode': """// An API request failed validation inside the main run. Tell the caller through callback_url;
// with no callback_url, fail loudly so the error workflow alerts ops.
const d = $input.first().json;
if (!d.callback_url) throw new Error('API request rejected (no callback_url to notify): ' + d.validation_error);
return [{ json: { status: 'rejected', request_id: d.request_id || null, execution_id: $execution.id, error: d.validation_error, callback_url: d.callback_url } }];"""}, [rl[0] + 660, rl[1] + 200])
add_node('POST Rejection', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': '={{ $json.callback_url }}', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify({ status: $json.status, request_id: $json.request_id, execution_id: $json.execution_id, error: $json.error }) }}', 'options': {'timeout': 20000}}, [rl[0] + 880, rl[1] + 200], {'onError': 'continueRegularOutput'})
add_node('Show Input Error', 'n8n-nodes-base.form', 2.5, {'operation': 'completion', 'completionTitle': 'Something needs fixing', 'completionMessage': '={{ $json.validation_error }} — please go back and try again.', 'options': {}}, [rl[0] + 660, rl[1] + 380])
disconnect('Rate Limit', 'Need Site Read?')
connect('Rate Limit', 'Input OK?')
connect('Input OK?', 'Need Site Read?', 0)
connect('Input OK?', 'Error Via API?', 1)
connect('Error Via API?', 'API Reject', 0)
connect('API Reject', 'POST Rejection')
connect('Error Via API?', 'Show Input Error', 1)
# The webhook itself moves to the separate "SEO Agent — API" workflow (n8n forbids Respond-to-Webhook nodes
# downstream of a Form Trigger). The main workflow is entered through an Execute Workflow Trigger instead.
wpos = pos('Webhook Trigger')
disconnect('Webhook Trigger', 'Normalize Input'); del nodes['Webhook Trigger']; conns.pop('Webhook Trigger', None)
add_node('API Entry', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, {'inputSource': 'passthrough'}, wpos)
connect('API Entry', 'Normalize Input')
patch('Normalize Input', "    callback_url,\n    run_page_check:", "    callback_url,\n    request_id: String(p2.request_id || ''),\n    run_page_check:")
log('API: webhook moved to the separate "SEO Agent — API" workflow, which answers 202/400 immediately and starts this workflow through "API Entry"; validation failures inside the run are POSTed to callback_url ("API Reject"); form users see validation messages on a proper page')

# fix the dead response path
disconnect('Respond to Webhook', 'Has Callback?')
del nodes['Respond to Webhook']; conns.pop('Respond to Webhook', None)
connect('Build Webhook Response', 'Has Callback?')
patch('Build Webhook Response', "  json: {\n    verdict: d.verdict,", "  json: {\n    status: 'completed',\n    request_id: d.request_id || null,\n    execution_id: $execution.id,\n    verdict: d.verdict,")
log('API: removed orphaned "Respond to Webhook"; Build Webhook Response -> Has Callback? -> POST Callback now actually runs')

# =============================================================================
# 2. SITE READ: skip the LLM when the homepage could not be read
# =============================================================================
cst = pos('Clean Site Text'); sd = pos('Site Describer')
if_node('Site Read OK?', "{{ !!$json.read_ok }}", [cst[0] + 200, cst[1]])
add_node('Describe Fallback', 'n8n-nodes-base.code', 2, {'jsCode': """// The homepage could not be read (blocked, timeout, empty). Do not call the LLM with nothing; carry on with what the user typed.
const prev = $input.first().json;
const nc = 'Not clear from website';
return [{ json: {
  ...prev,
  site_text: undefined,
  site_read_failed: true,
  site_description: {
    business_name: prev.domain, one_line_summary: 'The website could not be read automatically', business_description: prev.business || nc,
    industry: nc, products_or_services: [], target_audience: prev.audience ? [prev.audience] : [], unique_selling_points: [], location_served: prev.country || nc,
    tone_of_brand: nc, suggested_meta_title: '', suggested_meta_description: '', seed_keywords: []
  },
  business: prev.business || '',
  audience: prev.audience || ''
} }];"""}, [cst[0] + 420, cst[1] + 220])
disconnect('Clean Site Text', 'Site Describer')
connect('Clean Site Text', 'Site Read OK?')
connect('Site Read OK?', 'Site Describer', 0)
connect('Site Read OK?', 'Describe Fallback', 1)
connect('Describe Fallback', 'Route Mode')
patch('Build Description Page', "<div class=\"wrap\">\n  <h1>${esc(s.business_name || d.domain)}</h1>", "<div class=\"wrap\">\n  ${d.site_read_failed ? '<div class=\"card\" style=\"border-color:#f59e0b;background:#fffbeb\"><b>We could not read ' + esc(d.domain) + ' automatically.</b> The site may block automated readers or was too slow to respond. The details below are limited to what you told us.</div>' : ''}\n  <h1>${esc(s.business_name || d.domain)}</h1>")
log('Site read: new "Site Read OK?" gate; unreadable sites skip the Site Describer LLM call and get an honest fallback')

# =============================================================================
# 3. LLM CONFIG: token limits, drop ignored temperature
# =============================================================================
for name, n in nodes.items():
    if n['type'] == '@n8n/n8n-nodes-langchain.lmChatAnthropic':
        opts = n['parameters'].setdefault('options', {})
        opts.pop('temperature', None)
        opts['maxTokensToSample'] = 16384 if name in ('Claude — Copywriter', 'Claude — Editor') else 8192
log('Claude nodes: max tokens 16384 (Copywriter, Editor) / 8192 (others) instead of the 4096 default; removed temperature (ignored on Sonnet 5+)')

# =============================================================================
# 4. CODE FIXES
# =============================================================================
patch('Pick Top 6', "try { base = $('Hand Off To Keyword').first().json; }\ncatch (e) { base = $('Route Mode').first().json; }", "try { base = $('Prepare Keyword Run').first().json; }\ncatch (e) { base = $('Route Mode').first().json; }")
log('Pick Top 6: removed reference to non-existent node "Hand Off To Keyword"')

patch('AI Queries', "const brandName = String(((base.content_review || {}).business_context || '').match(/^([A-Z][\\w&.-]+(?:\\s[A-Z][\\w&.-]+){0,2})/) || [])[1] || base.domain.split('.')[0];",
      "const __brandMatch = String((base.content_review || {}).business_context || '').match(/^([A-Z][\\w&.-]+(?:\\s[A-Z][\\w&.-]+){0,2})/);\nconst brandName = (__brandMatch && __brandMatch[1]) || base.domain.split('.')[0];")
log('AI Queries: brand-name regex bug fixed (String(match)[1] returned a single letter, e.g. "o")')

patch('Content QA', "const density = totalWords ? +(kwCount * kw.split(/\\s+/).length / totalWords * 100).toFixed(2) : 0;", "const density = totalWords ? +(kwCount / totalWords * 100).toFixed(2) : 0;   // mentions per 100 words (industry convention)")
patch('Content QA', "if (density > 2.5) warnings.push", "if (density > 2) warnings.push")
patch('Content QA', "// 3. No business details given -> invented prices become [Price]\nif (!prev.business) {", "// 3. Prices are placeholders unless the user themselves typed prices into the business description\nconst userGavePrices = /\\d/.test(String(prev.business || '')) && /(\\$|£|€|₹|\\b(aed|sar|pkr|inr|usd|gbp|eur|zar|brl|mxn|rs)\\b)/i.test(String(prev.business || ''));\nif (!userGavePrices) {")
log('Content QA: keyword density now mentions-based (was inflated 2-3x, forcing needless Editor rounds); invented prices always become [Price] unless the user supplied prices')

patch('Pick Key Pages', "pages.filter(p => !isHome(p.url) && !isLegal(p.url) && !isArticle(p.url) && !isContact(p.url) && !isAbout(p.url))", "const isHub = (u) => /\\/(insights|blog|news|articles?|guides?|tag|category|author)\\/?$/i.test(u);\npages.filter(p => !isHome(p.url) && !isLegal(p.url) && !isArticle(p.url) && !isHub(p.url) && !isContact(p.url) && !isAbout(p.url))")
log('Pick Key Pages: blog/news hub pages no longer sampled as "service" pages')

patch('URLs To Check', "const seen = new Set();", "// Only probe public http(s) URLs (schema can point anywhere, including internal hosts)\nconst publicUrl = (u) => { const m = String(u || '').trim().match(/^(https?):\\/\\/(?:[^@\\/?#]*@)?([^\\/?#]+)/i); if (!m) return false; const hp = m[2].toLowerCase(); if (hp.includes(':') || hp.startsWith('[')) return false; const h = hp; if (!h.includes('.')) return false; if (/^(\\d{1,3}\\.){3}\\d{1,3}$/.test(h)) return false; if (/(^|\\.)(localhost|local|internal|localdomain|lan|corp|intranet|test|invalid)$/.test(h)) return false; return true; };   // regex parser: the n8n Code sandbox has no URL constructor\nconst seen = new Set();")
patch('URLs To Check', "  if (!url || seen.has(url)) continue;", "  if (!url || seen.has(url) || !publicUrl(url)) continue;")
log('URLs To Check: SSRF guard — only public http(s) hosts are HEAD-checked')

patch('Schema Findings', "category: 'Schema', severity: isLogo ? 'Critical' : 'Medium',", "category: 'Schema', severity: /organization logo/i.test(u.purpose) ? 'Critical' : (isLogo ? 'High' : 'Medium'),")
log('Schema Findings: only a broken Organization logo is Critical; a broken article publisher logo is High')

patch('Competitor Analysis', "  F('Critical', 'The site does not rank in Google’s top 10 for any keyword',", "  F('High', 'The site does not rank in Google’s top 10 for any keyword',")
patch('Competitor Analysis', "  F('Info', 'No competitors could be identified', 'No overlapping domains found for ' + base.country,\n    'Competitor comparisons in this report are limited.', 'Add up to 3 competitors in the form for a full comparison.');",
      "  findings.push({ category: 'Authority', severity: 'Info', title: 'No competitors could be identified', evidence: 'No overlapping domains found for ' + base.country, why: 'Competitor comparisons in this report are limited.', fix: 'Add up to 3 competitors in the form for a full comparison.', sample_urls: [], affected_count: null, affected_pct: 100, scope: 'site', scoring: false });")
log('Competitor Analysis: "no top-10 rankings" is High (a business outcome, not a site defect) so it no longer caps the score; data-availability notes are not scored')

patch('Analyze Backlinks', "  F('Info', 'Backlink data not available', 'Backlinks API returned: ' + (rows[0] && rows[0].error || 'no data'),\n    'Backlink numbers need the DataForSEO Backlinks API to be active.', 'Activate the Backlinks API to include link authority in the next report.');",
      "  findings.push({ category: 'Authority', severity: 'Info', title: 'Backlink data not available', evidence: 'Backlinks API returned: ' + (rows[0] && rows[0].error || 'no data'), why: 'Backlink numbers need the DataForSEO Backlinks API to be active.', fix: 'Activate the Backlinks API to include link authority in the next report.', sample_urls: [], affected_count: null, affected_pct: 100, scope: 'site', scoring: false });")
patch('Analyze PageSpeed', "fix: 'Check the API key and try again.', sample_urls: [], affected_count: null, affected_pct: 100, scope: 'site' });", "fix: 'Check the API key and try again.', sample_urls: [], affected_count: null, affected_pct: 100, scope: 'site', scoring: false });")
patch('Parse Content Review', "fix: 'Re-run the report; if this repeats, the pages may block automated readers.',\n    sample_urls: [], affected_count: null, affected_pct: 100, scope: 'site' });", "fix: 'Re-run the report; if this repeats, the pages may block automated readers.',\n    sample_urls: [], affected_count: null, affected_pct: 100, scope: 'site', scoring: false });")
patch('Parse Content Review', "fix: 'Re-run the report.', sample_urls: [], affected_count: null, affected_pct: 100, scope: 'site' });", "fix: 'Re-run the report.', sample_urls: [], affected_count: null, affected_pct: 100, scope: 'site', scoring: false });")
log('Scoring: "API/data not available" notes no longer deduct points from the customer\'s score')

# AI Visibility: one finding for all AI Overview misses instead of one per query
old = code('AI Visibility')
start = old.index("rows.forEach(r => {\n  if (r.ai_overview && !r.you_cited && r.competitors_cited.length) {")
end = old.index("const brandRow = rows.find(r => r.type === 'brand');")
new_block = """const aioMissed = rows.filter(r => r.ai_overview && !r.you_cited && r.type !== 'brand');
const aioWithComp = aioMissed.filter(r => r.competitors_cited.length);
if (aioWithComp.length) {
  F('High', 'Competitors are cited in Google AI Overviews, you are not',
    aioWithComp.map(r => '"' + r.query + '": AI Overview cites ' + r.competitors_cited.join(', ')).join('; '),
    'AI Overviews sit above normal results and take clicks; competitors named there are shortlisted before you are seen.',
    'Publish clear, well-sourced 40-70 word answer blocks on these topics, use question-style headings, and strengthen entity signals (Organization schema, consistent profiles).');
} else if (aioMissed.length) {
  F('Medium', 'Google shows AI Overviews for your key searches and does not cite you',
    aioMissed.map(r => '"' + r.query + '" (cited: ' + (r.cited_domains.slice(0, 4).join(', ') || 'sources not listed') + ')').join('; '),
    'These queries already have an AI answer; pages that are not cited lose visibility.',
    'Add a concise answer block, question-style headings and primary-source citations on the relevant pages.');
}
rows.filter(r => r.you_cited).forEach(r => works.push('Cited in Google AI Overview for "' + r.query + '"'));

"""
setcode('AI Visibility', old[:start] + new_block + old[end:])
log('AI Visibility: AI Overview misses merged into one finding (was one High per query = double penalty)')

# =============================================================================
# 5. PROBES: split host probes (no redirects) from content probes (follow redirects)
# =============================================================================
setcode('Build Probes', """// Host probes: raw responses WITHOUT following redirects, to see how apex/www/http resolve.
// Content probes (robots, sitemap, llms.txt, crawler access) live in "Content Probes" and DO follow redirects.
const d = $('Check Crawl').first().json;
const domain = d.domain;
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
return [
  { id: 'home',      url: 'https://' + domain + '/',       ua: CHROME, accept: 'text/html' },
  { id: 'www_https', url: 'https://www.' + domain + '/',   ua: CHROME, accept: 'text/html' },
  { id: 'www_http',  url: 'http://www.' + domain + '/',    ua: CHROME, accept: 'text/html' },
  { id: 'apex_http', url: 'http://' + domain + '/',        ua: CHROME, accept: 'text/html' }
].map(p => ({ json: p }));""")
bp = pos('Build Probes'); rp = pos('Run Probes'); ap = pos('Analyze Probes')
add_node('Content Probes', 'n8n-nodes-base.code', 2, {'jsCode': """// Content probes: what browsers, search crawlers and AI crawlers actually receive (redirects followed).
const d = $('Check Crawl').first().json;
const domain = d.domain;
const home = 'https://' + domain + '/';
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const probes = [
  { id: 'home_content', url: home,                                ua: CHROME, accept: 'text/html' },
  { id: 'home_repeat',  url: home,                                ua: CHROME, accept: 'text/html' },
  { id: 'robots',       url: 'https://' + domain + '/robots.txt',  ua: CHROME, accept: 'text/plain' },
  { id: 'sitemap',      url: 'https://' + domain + '/sitemap.xml', ua: CHROME, accept: 'application/xml' },
  { id: 'llms',         url: 'https://' + domain + '/llms.txt',    ua: CHROME, accept: 'text/plain' },
  { id: 'markdown',     url: home,                                ua: CHROME, accept: 'text/markdown' }
];
const BOTS = {
  'GPTBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
  'OAI-SearchBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot',
  'ChatGPT-User': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
  'ClaudeBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  'PerplexityBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  'Googlebot': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Bingbot': 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'CCBot': 'CCBot/2.0 (https://commoncrawl.org/faq/)',
  'Amazonbot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)',
  'Applebot': 'Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)',
  'Meta-ExternalAgent': 'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)'
};
for (const [name, ua] of Object.entries(BOTS)) probes.push({ id: 'bot:' + name, url: home, ua, accept: 'text/html' });
return probes.map(p => ({ json: p }));"""}, [rp[0] + 200, rp[1] + 200])
rcp = copy.deepcopy(nodes['Run Probes']); rcp['name'] = 'Run Content Probes'; rcp['id'] = nid('Run Content Probes'); rcp['position'] = [rp[0] + 400, rp[1] + 200]
rcp['parameters']['options'].pop('redirect', None)
nodes['Run Content Probes'] = rcp
disconnect('Run Probes', 'Analyze Probes')
connect('Run Probes', 'Content Probes'); connect('Content Probes', 'Run Content Probes'); connect('Run Content Probes', 'Analyze Probes')

setcode('Analyze Probes', r"""const base = $('Check Crawl').first().json;
const domain = base.domain;
const probes = [...$('Build Probes').all(), ...$('Content Probes').all()].map(i => i.json);
const results = [...$('Run Probes').all(), ...$('Run Content Probes').all()].map(i => i.json);
const crawled = $('Get Crawled Pages').first().json.tasks?.[0]?.result?.[0]?.items || [];

const R = {};
probes.forEach((p, i) => {
  const r = results[i] || {};
  R[p.id] = { url: p.url, status: r.statusCode || 0, headers: r.headers || {}, body: String(r.body || r.data || ''), error: r.error ? (r.error.message || JSON.stringify(r.error)).slice(0, 200) : '' };
});
const h = (id, name) => {
  const hs = (R[id] || {}).headers || {};
  const k = Object.keys(hs).find(x => x.toLowerCase() === name.toLowerCase());
  return k ? String(hs[k]) : '';
};
const MAIN = 'home_content';   // the homepage as browsers get it (redirects followed)

const findings = [];
const works = [];
const add = (category, severity, title, evidence, why, fix) =>
  findings.push({ category, severity, title, evidence, why, fix, affected_count: null, affected_pct: 100, sample_urls: [], scope: 'site' });

// 1. Which host is canonical? Host probes did NOT follow redirects.
const home = R.home || {}, www = R.www_https || {};
const homeLoc = h('home', 'location');
const apexToWww = home.status >= 300 && home.status < 400 && /^https?:\/\/www\./i.test(homeLoc);
const canonical_host = apexToWww ? 'www.' + domain : domain;
if (apexToWww) {
  if (www.status === 200) works.push('One canonical host: https://' + domain + ' 301-redirects to https://www.' + domain);
  else if (!www.status || www.error) add('Security', 'Critical', 'Homepage redirects to www, but www does not load', 'https://' + domain + ' → ' + homeLoc + ' failed: ' + (www.error || 'no response'), 'Every visitor and crawler is sent to a host that does not answer, so the site is effectively down.', 'Fix the certificate/DNS for www.' + domain + ' or redirect apex to a host that works. Verify: https://www.' + domain + ' returns 200.');
  else if (www.status >= 300 && www.status < 400) add('Crawlability & Indexing', 'High', 'Redirect chain or loop between apex and www', 'https://' + domain + ' → ' + homeLoc + ' → ' + h('www_https', 'location'), 'Multi-hop redirects slow every first visit and can loop.', 'Make apex redirect in one hop to the final URL, and make sure the final URL returns 200.');
} else if (home.status >= 300 && home.status < 400 && homeLoc && !homeLoc.includes(domain)) {
  add('Crawlability & Indexing', 'High', 'Homepage redirects to a different domain', 'https://' + domain + '/ → ' + homeLoc, 'Ranking signals are handed to another host; the audit target may be the wrong domain.', 'Audit the destination domain instead, or remove the redirect if it is unintended.');
} else {
  if (!www.status || www.error) {
    const viaHttp = h('www_http', 'location');
    add('Security', 'High', 'The www version of the site fails to load securely',
      'https://www.' + domain + ' failed: ' + (www.error || 'no response') + (viaHttp ? '. http://www.' + domain + ' redirects to ' + viaHttp : ''),
      'Anyone who types www, or clicks a www link in an ad, email or business card, sees a browser security error instead of your site.',
      'Add the www hostname to your hosting/CDN so it gets a valid certificate and 301-redirects to https://' + domain + ', or remove the www DNS record. Verify: https://www.' + domain + ' should load or redirect without an SSL error.');
  } else if (www.status >= 300 && www.status < 400) {
    const loc = h('www_https', 'location');
    if (loc.includes('//' + domain)) works.push('www redirects to the main domain (' + www.status + ')');
    else add('Crawlability & Indexing', 'Medium', 'www redirects somewhere unexpected', 'https://www.' + domain + ' → ' + loc, 'Signals may be split between hosts.', 'Redirect www directly to https://' + domain + '/ with a 301.');
  } else if (www.status === 200) {
    add('Crawlability & Indexing', 'High', 'www and non-www both serve the site (duplicate host)', 'https://www.' + domain + ' and https://' + domain + ' both return 200', 'Two copies of every page split links and ranking signals.', 'Add a 301 redirect from www to https://' + domain + '/ (or the reverse) so only one host answers with 200.');
  }
}
const apexHttpLoc = h('apex_http', 'location');
if (R.apex_http && R.apex_http.status === 200) add('Security', 'High', 'HTTP version of the homepage does not redirect to HTTPS', 'http://' + domain + '/ returns 200', 'Browsers mark the page as not secure and two versions of the site can be indexed.', 'Add a sitewide 301 redirect from http:// to https://.');
else if (R.apex_http && R.apex_http.status >= 300 && R.apex_http.status < 400 && /^https:/i.test(apexHttpLoc)) works.push('HTTP redirects to HTTPS');

// 2. Caching & server response (measured on the page browsers actually receive)
const cc = h(MAIN, 'cache-control');
const cacheHdr = h(MAIN, 'x-vercel-cache') || h(MAIN, 'cf-cache-status') || h(MAIN, 'x-cache') || '';
const cacheHdr2 = h('home_repeat', 'x-vercel-cache') || h('home_repeat', 'cf-cache-status') || h('home_repeat', 'x-cache') || '';
const homePage = crawled.find(p => String(p.url || '').replace(/\/$/, '').replace(/^https?:\/\/(www\.)?/, '') === domain) || {};
const rawT = homePage.page_timing ? homePage.page_timing.waiting_time : null;
const ttfb = rawT && rawT > 0 ? Math.round(rawT) : null;

if (/no-store|private/i.test(cc)) {
  add('Performance', 'High', 'HTML cannot be cached by the CDN (no-store / private)',
    'Cache-Control: ' + cc + (cacheHdr ? '; CDN cache status on two requests: ' + cacheHdr + ' / ' + cacheHdr2 : '') + (ttfb != null ? '; homepage server wait ' + ttfb + 'ms' : ''),
    'Every visit forces the server to rebuild the page from scratch, which slows the first byte for every user and hurts Core Web Vitals. This is sometimes intentional (carts, logged-in areas) — confirm before changing.',
    'Remove the setting that forces dynamic rendering (for Next.js: force-dynamic, or cookies()/headers() in server components) or enable revalidation so the CDN can cache HTML. Verify: repeat requests should show a cache HIT.');
} else if (cc) {
  works.push('HTML is cacheable (Cache-Control: ' + cc + ')');
}
if (ttfb != null) {
  if (ttfb > 800) add('Performance', 'High', 'Slow server response (TTFB)', 'Homepage server wait time ' + ttfb + 'ms (good is under 200ms)', 'A slow first byte delays everything else and hurts LCP.', 'Enable CDN/edge caching and host close to your main audience.');
  else if (ttfb > 500) add('Performance', 'Medium', 'Server response could be faster', 'Homepage server wait time ' + ttfb + 'ms', 'Slower first byte delays page rendering.', 'Enable caching and review hosting region.');
  else works.push('Fast server response (' + ttfb + 'ms)');
}

// 3. Security headers
const missing = [];
if (!h(MAIN, 'strict-transport-security')) missing.push('Strict-Transport-Security (HSTS)');
if (!h(MAIN, 'content-security-policy')) missing.push('Content-Security-Policy');
if (!h(MAIN, 'x-content-type-options')) missing.push('X-Content-Type-Options');
if (!h(MAIN, 'x-frame-options') && !/frame-ancestors/i.test(h(MAIN, 'content-security-policy'))) missing.push('X-Frame-Options');
if (!h(MAIN, 'referrer-policy')) missing.push('Referrer-Policy');
if (missing.length) {
  add('Security', missing.some(m => m.includes('HSTS')) ? 'Medium' : 'Low', 'Missing security headers',
    'Not found: ' + missing.join(', '), 'Security headers protect visitors. They are not a direct ranking factor but show a well-maintained site.',
    'Add the missing headers in your hosting or CDN configuration; start Content-Security-Policy in Report-Only mode.');
} else works.push('All key security headers are present');

// 4. robots.txt
const robotsText = R.robots.status === 200 ? R.robots.body : '';
const aiBlocked = [];
if (robotsText) {
  const blocks = robotsText.split(/\n(?=\s*user-agent\s*:)/i);
  for (const b of blocks) {
    const agents = (b.match(/user-agent\s*:\s*(.+)/gi) || []).map(x => x.split(':')[1].trim().toLowerCase());
    const disallowAll = /disallow\s*:\s*\/\s*($|\n)/i.test(b);
    if (!disallowAll) continue;
    if (agents.includes('*')) add('Crawlability & Indexing', 'Critical', 'robots.txt blocks all crawlers', 'User-agent: * with Disallow: /', 'Search engines are told not to crawl the site at all.', 'Remove "Disallow: /" for User-agent: * unless the site is intentionally hidden.');
    ['gptbot', 'oai-searchbot', 'chatgpt-user', 'claudebot', 'perplexitybot', 'google-extended', 'ccbot'].forEach(bot => { if (agents.includes(bot)) aiBlocked.push(bot); });
  }
  if (!/sitemap\s*:/i.test(robotsText)) add('Crawlability & Indexing', 'Low', 'robots.txt does not list the sitemap', 'No "Sitemap:" line found', 'Crawlers find the sitemap faster when it is listed.', 'Add "Sitemap: https://' + canonical_host + '/sitemap.xml" to robots.txt.');
  else works.push('robots.txt lists the sitemap');
} else if (R.robots.status && R.robots.status !== 404) {
  add('Crawlability & Indexing', 'Medium', 'robots.txt returns an unexpected status', '/robots.txt returned ' + R.robots.status, 'A 5xx or blocked robots.txt can make Google pause crawling the whole site.', 'Serve robots.txt with 200 (or 404 if you have none).');
}
if (aiBlocked.length) add('AI Search Readiness', 'Medium', 'robots.txt blocks some AI crawlers', 'Blocked: ' + aiBlocked.join(', '), 'Blocked AI crawlers cannot use your pages as sources in AI answers. This can be intentional, so confirm it is a business decision.', 'Allow search-related AI crawlers (e.g. OAI-SearchBot, PerplexityBot) if you want to be cited in AI answers.');

// 5. Sitemap
const norm = (u) => String(u || '').trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
const sm = R.sitemap;
const locs = sm.status === 200 ? (sm.body.match(/<loc>\s*([^<\s]+)\s*<\/loc>/gi) || []).map(x => x.replace(/<\/?loc>/gi, '').trim()) : [];
const isIndex = /<sitemapindex/i.test(sm.body);
if (locs.length && !isIndex) {
  works.push('XML sitemap lists ' + locs.length + ' URLs');
  const sitemapSet = new Set(locs.map(norm));
  const notInSitemap = crawled.filter(p => p.status_code === 200 && !sitemapSet.has(norm(p.url))).map(p => p.url);
  if (notInSitemap.length) {
    findings.push({ category: 'Crawlability & Indexing', severity: 'Low', title: 'Indexable pages missing from the sitemap',
      evidence: notInSitemap.length + ' live pages are not in sitemap.xml',
      why: 'Search engines rely on the sitemap to discover and prioritise pages.', fix: 'Add these URLs to the sitemap, or noindex them if they should not rank.',
      affected_count: notInSitemap.length, affected_pct: Math.round(notInSitemap.length / Math.max(1, crawled.length) * 100), sample_urls: notInSitemap.slice(0, 10), scope: 'page' });
  } else works.push('Every live page is listed in the sitemap');
} else if (isIndex) {
  works.push('Sitemap index found');
}

// 6. llms.txt & Markdown
const llms = R.llms;
if (llms.status === 200 && llms.body.length > 100 && !/<html/i.test(llms.body)) {
  works.push('llms.txt exists (' + llms.body.length + ' characters)');
} else {
  add('AI Search Readiness', 'Low', 'No llms.txt file', 'https://' + domain + '/llms.txt returned ' + (llms.status || 'no response'),
    'llms.txt gives AI tools a clean summary of your site. Google does not use it; it is a low-cost extra for AI agents, not a ranking lever.',
    'Optionally publish /llms.txt with a short site summary and links to your key pages.');
}
if (/markdown/i.test(h('markdown', 'content-type'))) works.push('Site serves Markdown to AI agents on request');

// 7. AI / search crawler access (compared with what a browser receives)
const browserLen = (R[MAIN] || {}).body.length || 1;
const bots = probes.filter(p => p.id.startsWith('bot:'));
const blockedBots = [];
for (const b of bots) {
  const r = R[b.id];
  const name = b.id.slice(4);
  const ratio = r.body.length / browserLen;
  if (!r.status || r.status >= 400 || ratio < 0.3) blockedBots.push(name + ' (' + (r.status || 'no response') + (r.status && r.status < 400 ? ', ' + Math.round(ratio * 100) + '% of content' : '') + ')');
}
if (blockedBots.length) {
  add('AI Search Readiness', 'High', 'Some search and AI crawlers are blocked or get less content',
    blockedBots.join('; '), 'Blocked crawlers cannot index or cite your pages in search and AI answers.',
    'Check firewall, bot-protection and CDN rules so these crawlers receive the same page as browsers.');
} else {
  works.push('All ' + bots.length + ' search and AI crawlers tested (GPTBot, ClaudeBot, PerplexityBot, Googlebot and more) receive the full page');
}

return [{
  json: {
    ...base,
    canonical_host,
    probe: {
      findings,
      what_works: works,
      measurements: {
        canonical_host,
        cache_control: cc || null,
        cache_status: [cacheHdr, cacheHdr2].filter(Boolean),
        homepage_ttfb_ms: ttfb,
        server: h(MAIN, 'server') || null,
        sitemap_urls: locs.length,
        crawled_urls: crawled.length
      },
      note: 'AI crawler checks use the crawler user-agent only; real crawlers are also verified by IP, so a pass here means no user-agent based blocking.'
    }
  }
}];""")
patch('Build Site Issues', "if (probe.findings.some(f => /www version/i.test(f.title))) {", "if (probe.findings.some(f => /www/i.test(f.title))) {")
patch('Build Site Issues', "addDomain(dc.test_https_redirect === false, 'Security', 'High', 'HTTP does not redirect to HTTPS',", "addDomain(dc.test_https_redirect === false && !probe.findings.some(f => /HTTP version/i.test(f.title)), 'Security', 'High', 'HTTP does not redirect to HTTPS',")
log('Probes: split into host probes (no redirects) + content probes (redirects followed). Sites whose apex 301s to www are no longer flagged as "duplicate host"; headers, cache and crawler checks now measure the real page')

# =============================================================================
# 6. SCORING CALIBRATION (Build Site Issues)
# =============================================================================
patch('Build Site Issues', "  { key: 'is_broken', cat: 'Crawlability & Indexing', sev: 'Critical', title: 'Broken pages', why:", "  { key: 'is_broken', cat: 'Crawlability & Indexing', sev: 'Critical', title: 'Broken pages (4xx, 5xx or timeout)', why:")
patch('Build Site Issues', "  { key: 'is_4xx_code', cat: 'Crawlability & Indexing', sev: 'Critical', title: 'Pages returning 4xx errors', why: 'Users and search engines hit dead ends.', fix: 'Restore the pages or redirect them, and remove internal links pointing to them.' },\n  { key: 'is_5xx_code', cat: 'Crawlability & Indexing', sev: 'Critical', title: 'Pages returning server errors (5xx)', why: 'Server errors can cause pages to drop out of the index.', fix: 'Check server logs and hosting configuration for these URLs.' },\n", "")
patch('Build Site Issues', """    findings.push({
      category: c.cat, severity: c.sev, title: c.title, why: c.why, fix: c.fix,
      evidence: affected.length + ' of ' + total + ' crawled pages',""", """    // A handful of broken URLs on a big site is serious but not "Critical" unless the homepage or >=3% of pages are hit
    let sev = c.sev;
    if (sev === 'Critical' && affected.length / total < 0.03 && !affected.some(p => /^https?:\\/\\/[^\\/]+\\/?$/.test(p.url))) sev = 'High';
    findings.push({
      category: c.cat, severity: sev, title: c.title, why: c.why, fix: c.fix,
      evidence: affected.length + ' of ' + total + ' crawled pages',""")
patch('Build Site Issues', """const exp = di.ssl_info?.certificate_expiration_date;
if (exp) {
  const days = Math.round((new Date(exp) - new Date()) / 86400000);
  if (days < 30) findings.push({ category: 'Security', severity: 'High', title: 'SSL certificate expires in ' + days + ' days', why: 'An expired certificate blocks visitors with a security warning.', fix: 'Renew the certificate or confirm auto-renewal is working.', evidence: 'Expiry date ' + exp.slice(0, 10), affected_count: null, affected_pct: 100, sample_urls: [], scope: 'site' });
}""", """const exp = di.ssl_info?.certificate_expiration_date;
if (exp) {
  const days = Math.round((new Date(exp) - new Date()) / 86400000);
  const issuer = String(di.ssl_info?.certificate_issuer || '');
  const autoRenew = /let'?s encrypt|zerossl|buypass|google trust|cloudflare|amazon|sectigo.*acme/i.test(issuer);   // 90-day certs renew ~30 days out
  const sev = days < 0 ? 'Critical' : days < 7 ? 'Critical' : (days < 14 || (!autoRenew && days < 30)) ? 'High' : null;
  if (sev) findings.push({ category: 'Security', severity: sev, title: days < 0 ? 'SSL certificate has expired' : 'SSL certificate expires in ' + days + ' days', why: 'An expired certificate blocks visitors with a security warning.', fix: autoRenew ? 'Check that automatic renewal (' + issuer + ') is still working.' : 'Renew the certificate or confirm auto-renewal is working.', evidence: 'Expiry date ' + exp.slice(0, 10) + (issuer ? ', issuer ' + issuer : ''), affected_count: null, affected_pct: 100, sample_urls: [], scope: 'site' });
}""")
patch('Build Site Issues', """for (const cat of Object.keys(WEIGHTS)) {
  let score = 100;
  for (const f of findings.filter(f => f.category === cat)) {
    if (f.scoring === false) continue;                       // AI-written content findings are listed, not scored
    const pct = f.affected_pct == null ? 100 : f.affected_pct;
    const factor = f.scope === 'site' ? 1 : (0.6 + 0.4 * (pct / 100));
    score -= (PEN2[f.severity] || 0) * factor;
  }
  category_scores[cat] = Math.max(0, Math.round(score));
}""", """const DECAY = 0.7;   // each further finding of the same severity in a category counts 70% of the previous one
for (const cat of Object.keys(WEIGHTS)) {
  let score = 100;
  const seenSev = {};
  const list = findings.filter(f => f.category === cat && f.scoring !== false)
    .sort((a, b) => (SEV_ORDER[a.severity] - SEV_ORDER[b.severity]) || ((b.affected_pct || 0) - (a.affected_pct || 0)));
  for (const f of list) {
    const pct = f.affected_pct == null ? 100 : f.affected_pct;
    const factor = f.scope === 'site' ? 1 : (0.6 + 0.4 * (pct / 100));
    const n = seenSev[f.severity] = (seenSev[f.severity] || 0) + 1;
    score -= (PEN2[f.severity] || 0) * factor * Math.pow(DECAY, n - 1);
  }
  category_scores[cat] = Math.max(0, Math.round(score));
}""")
patch('Build Site Issues', "else if (scored.High >= 2) { cap = 85; cap_reason = scored.High + ' high-priority issues found — score capped at 85 until fixed'; }", "else if (scored.High >= 5) { cap = 85; cap_reason = scored.High + ' high-priority issues found — score capped at 85 until fixed'; }")
patch('Build Site Issues', "'Each category starts at 100. Findings written by the AI content review are listed but do not change the score. Each other finding deducts Critical 30, High 15, Medium 7, Low 3, Info 1 points, scaled by the share of pages affected (60%-100% of the penalty); site-wide issues take the full penalty. The score is the weighted average of category scores, capped at 70 with one critical issue, 60 with two or more, and 85 with two or more high-priority issues.'",
      "'Each category starts at 100. Findings written by the AI content review, and notes about data that could not be collected, are listed but do not change the score. Each other finding deducts Critical 30, High 15, Medium 7, Low 3, Info 1 points, scaled by the share of pages affected (60%-100% of the penalty); site-wide issues take the full penalty. Within a category, each further finding of the same severity counts 70% of the previous one, so many small issues cannot zero a category on their own. The score is the weighted average of category scores, capped at 70 with one critical issue, 60 with two or more, and 85 with five or more high-priority issues.'")
log("Scoring: merged duplicate broken-page checks; tiny shares of broken pages are High not Critical; diminishing returns per severity; Let's Encrypt-style certs not flagged at <30 days; High cap at 5+ (was 2+)")

# =============================================================================
# 7. LANGUAGE CODES in the audit pipeline (were hard-coded 'en')
# =============================================================================
def patch_param(name, key, old, new):
    p = nodes[name]['parameters']; assert p[key].count(old) == 1, f'{name}.{key}: {old!r} not found once'; p[key] = p[key].replace(old, new)
patch_param('Find Competitors', 'jsonBody', "language_code: 'en'", "language_code: $json.language_code || 'en'")
patch_param('Domain Overview', 'jsonBody', "language_code: 'en'", "language_code: $('Schema Findings').first().json.language_code || 'en'")
patch_param('Ranked Keywords', 'jsonBody', "language_code: 'en'", "language_code: $('Competitor Analysis').first().json.language_code || 'en'")
patch_param('Keyword Ideas', 'jsonBody', "language_code: 'en'", "language_code: $('Competitor Analysis').first().json.language_code || 'en'")
patch_param('Fallback SERP', 'jsonBody', "language_code: 'en'", "language_code: $('Schema Findings').first().json.language_code || 'en'")
log('Audit pipeline: DataForSEO calls use the market language (de/fr/es/it/nl/pt) instead of hard-coded English')

# =============================================================================
# 8. NAMES, SETTINGS, DOCUMENTATION
# =============================================================================
rename('Form', 'Download Report')
rename('OpenAI Chat Model2', 'Site Describer Model (OpenAI)')
w['settings'].update({'executionTimeout': 3600, 'saveManualExecutions': True, 'saveDataErrorExecution': 'all', 'saveDataSuccessExecution': 'all', 'saveExecutionProgress': True})
log('Settings: 60-minute execution timeout, progress saved (Wait-node resumes survive restarts); "Form" renamed "Download Report"')

def sticky(content, x, y, wdt, hgt, color=4):
    add_node('Note ' + str(len([n for n in nodes.values() if n['type'] == 'n8n-nodes-base.stickyNote']) + 1), 'n8n-nodes-base.stickyNote', 1, {'content': content, 'height': hgt, 'width': wdt, 'color': color}, [x, y])
allx = [n['position'][0] for n in nodes.values()]; ally = [n['position'][1] for n in nodes.values()]
sticky("""## SEO Agent v4 — read me first
**Modes:** I know my keyword · Suggest keywords · Describe my website · Audit my website · Check if my keyword is right. Same pipeline via the API: the separate workflow **SEO Agent — API** owns `POST /webhook/seo-keyword-check` (header auth; body: `mode`, `keyword`, `country`, `domain`, `business`, `email`, `callback_url`), answers **202 immediately**, and starts this workflow through *API Entry*. Results are POSTed to `callback_url` (or emailed). n8n does not allow Respond-to-Webhook nodes downstream of a Form Trigger, which is why the API lives in its own workflow.

**Credentials to attach before the first run** (none are attached in this copy):
1. DataForSEO — HTTP Basic Auth (22 HTTP nodes)
2. Jina Reader — Header Auth `Authorization: Bearer …` (Read Website, Read Competitor Pages, Read Competitor Homes)
3. Google PageSpeed — Header Auth `X-Goog-Api-Key` (PageSpeed)
4. Gmail OAuth2 (Send Report, Send Audit Report)
5. Form basic auth (Start Form) · Webhook header auth (Webhook Trigger)
6. Claude / OpenAI model nodes (or n8n AI gateway)

**Config** lives at the top of *Normalize Input* (brand, crawl size, QA rounds, countries). Rate limits are in *Rate Limit*.
**Error handling:** set Settings → Error workflow to "SEO Agent — Error Handler" so failed runs page you.
**Testing without spending API credits:** the harness in `n8n/seo-agent/harness/` runs every Code node against fixtures.""", min(allx) - 40, min(ally) - 620, 760, 560, 4)
ip = pos('Normalize Input')
sticky("""### Intake & validation
Forms / webhook → **Normalize Input** (one normalised object: mode, keyword, domain, country codes, deliverables) → **Rate Limit** → **Input OK?**
Validation problems are *data*, not crashes: form users get a "Something needs fixing" page; API requests that fail here are reported to their callback_url. (The API workflow already rejects malformed requests with 400 and acknowledges good ones with 202.)""", ip[0] - 60, ip[1] - 300, 620, 220, 6)
kp = pos('Prepare Keyword Run')
sticky("""### Keyword pipeline (keyword / verdict / discover-chained)
Sitemap → real internal-link candidates + existing-page detection → SERP (top 30, PAA, AI Overview) → read 6 competitor pages (Jina) → **Competitor Analyzer** → keyword metrics → **Verdict** (GO / GO_WITH_CHANGES / AVOID) → **Strategy Brief** → **Copywriter** → **Content QA** (deterministic checks + schema) → **Editor** (max 1 revision) → Word file → download / email / API callback.
Cost per run ≈ 5 DataForSEO calls + 6 Jina reads + 4–5 Claude calls (Sonnet). Claude nodes have max_tokens 16k/8k.""", kp[0] - 60, kp[1] - 320, 760, 240, 5)
sc = pos('Start Crawl')
sticky("""### Site audit (technical) — DataForSEO On-Page crawl
Start Crawl (≤200 pages, resources loaded, micromarkup validated) → poll every 60 s (max 25 min) → pages + extra reports (duplicate tags, non-indexable, redirect chains) → **host probes** (apex/www/http, no redirects) + **content probes** (robots, sitemap, llms.txt, 11 crawler user-agents, redirects followed) → **Analyze Probes**.
Technical-only reports go straight to **Build Site Issues**.""", sc[0] - 60, sc[1] - 300, 760, 220, 3)
pk = pos('Pick Key Pages')
sticky("""### Full SEO Report modules (sequential today — candidates for parallel sub-workflows)
Key-page HTML & schema → competitor discovery (Labs + live SERPs) → domain overview & age → ranked keywords / keyword ideas / gap → backlinks & link gap → PageSpeed (you + competitors) → E-E-A-T content review (Claude) → AI visibility (brand SERP, site: estimate, AI Overviews, live ChatGPT/Perplexity answers).
Every module appends to `extra_findings` / `extra_works`; **Build Site Issues** scores and ranks everything.""", pk[0] - 60, pk[1] - 320, 900, 220, 7)
bsi = pos('Build Site Issues')
sticky("""### Scoring & reports
Categories start at 100; deductions Critical 30 / High 15 / Medium 7 / Low 3 / Info 1, scaled by share of pages affected, with 70% diminishing returns per severity inside a category. Data-availability notes and AI-written content findings are listed but never scored. Caps: 1 critical → 70, 2+ → 60, 5+ high → 85.
Reports are Word-compatible `.doc` (HTML). Consider real DOCX/PDF for enterprise clients.""", bsi[0] - 60, bsi[1] - 300, 760, 220, 2)
log('Added 6 sticky notes documenting the pipeline, credentials, config and scoring')


# =============================================================================
# 8b. v4.1 — cost ledger, PDF reports, RDAP domain age, model refresh, credential slots, smaller fixes
# =============================================================================
LEDGER = r"""
// ---- run ledger: DataForSEO spend, AI calls, duration (internal; appears on the final item and in the API callback) ----
const __LEDGER_NODES = ['SERP Top 10', 'Keyword Data', 'Candidate SERP', 'Discover Ideas', 'Start Crawl', 'Get Crawl Summary', 'Get Crawled Pages', 'Run Crawl Extras', 'Find Competitors', 'Fallback SERP', 'Domain Overview', 'DataForSEO Whois', 'Ranked Keywords', 'Keyword Ideas', 'Backlink Summary', 'Backlink Gap', 'AI SERP', 'Ask LLMs'];
const __AI_NODES = ['Site Describer', 'Keyword Seeds', 'Competitor Analyzer', 'Verdict Agent', 'Strategy Brief', 'Copywriter', 'Editor', 'Content Reviewer'];
const run_ledger = { dataforseo_usd: 0, dataforseo_calls: 0, by_node: {}, ai_calls: 0, ai_nodes: [], started_at: null, finished_at: new Date().toISOString(), duration_min: null };
for (const n of __LEDGER_NODES) {
  let items = []; try { items = $(n).all(); } catch (e) { continue; }
  for (const it of items) {
    const j = (it && it.json) || {}; let c = 0;
    if (Array.isArray(j.tasks)) { for (const t of j.tasks) c += Number((t && t.cost) || 0); } else if (j.cost) { c += Number(j.cost) || 0; }
    run_ledger.dataforseo_calls++;
    if (c) { run_ledger.dataforseo_usd += c; run_ledger.by_node[n] = +((run_ledger.by_node[n] || 0) + c).toFixed(4); }
  }
}
for (const n of __AI_NODES) { try { const k = $(n).all().length; if (k) { run_ledger.ai_calls += k; run_ledger.ai_nodes.push(n); } } catch (e) {} }
try { run_ledger.started_at = $('Normalize Input').first().json.started_at || null; } catch (e) {}
if (run_ledger.started_at) run_ledger.duration_min = +(((Date.now() - new Date(run_ledger.started_at)) / 60000).toFixed(1));
run_ledger.dataforseo_usd = +run_ledger.dataforseo_usd.toFixed(4);
"""
for name, anchor in [('Build Word File', "  json: {\n    keyword: d.keyword,"), ('Build Full Report', "  json: {\n    brand: d.brand || 'Dev SEO',\n    report_title: 'Full SEO Report',"), ('Build Audit Report', "  json: {\n    brand: d.brand || 'Dev SEO',\n    report_title: 'Site Audit',"), ('Build Keyword File', "  json: { ...d, result_html: undefined, file_name: fileName },")]:
    c = code(name)
    assert c.count(anchor) == 1, name
    c = LEDGER + c.replace(anchor, anchor.replace("json: {", "json: {\n    run_ledger,", 1) if 'Keyword File' not in name else "  json: { ...d, result_html: undefined, file_name: fileName, run_ledger },")
    setcode(name, c)
patch('Build Webhook Response', "    qa_summary: d.qa_summary || null,", "    qa_summary: d.qa_summary || null,\n    run_ledger: d.run_ledger || null,")
log('Run ledger: every report node now records DataForSEO spend per node, AI call count and run duration (run_ledger on the final item and in the API callback)')

# ---- PDF rendering via Gotenberg (compose.override.yml); Word-compatible .doc kept as fallback ----
PREP = r"""// Copy of the report HTML named index.html for the PDF renderer (Gotenberg requires that exact file name)
const item = $input.first();
const doc = (item.binary || {}).data;
if (!doc) return [item];
return [{ json: item.json, binary: { data: doc, html: { ...doc, fileName: 'index.html', mimeType: 'text/html', fileExtension: 'html' } } }];"""
ATTACH = r"""// Merge the PDF (when the renderer succeeded) with the original Word-compatible file. Never fails the run.
const src = $('__PREP__').first();
const got = $input.first() || {};
const pdf = got.binary && got.binary.pdf && !(got.json && got.json.error) ? got.binary.pdf : null;
const name = String(src.json.file_name || 'report.doc').replace(/\.doc$/i, '') + '.pdf';
const binary = {};
if (src.binary && src.binary.data) binary.data = src.binary.data;
if (pdf) binary.pdf = { ...pdf, fileName: name, mimeType: 'application/pdf', fileExtension: 'pdf' };
return [{ json: { ...src.json, pdf_ready: !!pdf, pdf_file_name: pdf ? name : null, pdf_error: pdf ? null : String((got.json && got.json.error && (got.json.error.message || got.json.error)) || 'renderer returned no file').slice(0, 200) }, binary }];"""
def add_pdf_chain(src, suffix, targets):
    sp = pos(src); x, y = sp[0] + 200, sp[1] + 160
    prep, conv, att = 'Prepare PDF ' + suffix, 'Render PDF ' + suffix, 'Attach PDF ' + suffix
    add_node(prep, 'n8n-nodes-base.code', 2, {'jsCode': PREP}, [x, y])
    add_node(conv, 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': 'http://gotenberg:3000/forms/chromium/convert/html', 'sendBody': True, 'contentType': 'multipart-form-data',
        'bodyParameters': {'parameters': [{'parameterType': 'formBinaryData', 'name': 'files', 'inputDataFieldName': 'html'}, {'name': 'paperWidth', 'value': '8.27'}, {'name': 'paperHeight', 'value': '11.69'}, {'name': 'marginTop', 'value': '0.6'}, {'name': 'marginBottom', 'value': '0.6'}, {'name': 'marginLeft', 'value': '0.6'}, {'name': 'marginRight', 'value': '0.6'}, {'name': 'printBackground', 'value': 'true'}]},
        'options': {'timeout': 120000, 'response': {'response': {'responseFormat': 'file', 'outputPropertyName': 'pdf'}}}}, [x + 220, y], {'onError': 'continueRegularOutput'})
    add_node(att, 'n8n-nodes-base.code', 2, {'jsCode': ATTACH.replace('__PREP__', prep)}, [x + 440, y])
    for t in targets: disconnect(src, t)
    connect(src, prep); connect(prep, conv); connect(conv, att)
    for t in targets: connect(att, t)
add_pdf_chain('Build Word File', 'Report', ['Has Email?', 'Deliver Via Download?'])
disconnect('Build Full Report', 'Send Audit Report'); disconnect('Build Audit Report', 'Send Audit Report')
add_pdf_chain('Build Full Report', 'Audit', [])
connect('Build Audit Report', 'Prepare PDF Audit'); connect('Attach PDF Audit', 'Send Audit Report')
add_pdf_chain('Build Keyword File', 'Ideas', ['Download Keyword Ideas', 'Discover Extras?', 'Discover Audit?'])
for gm in ('Send Report', 'Send Audit Report'):
    nodes[gm]['parameters']['options']['attachmentsUi'] = {'attachmentsBinary': [{'property': "={{ $binary.pdf ? 'pdf,data' : 'data' }}"}]}
for fm in ('Download Report', 'Download Keyword Ideas'):
    nodes[fm]['parameters']['inputDataFieldName'] = "={{ $binary.pdf ? 'pdf' : 'data' }}"
patch('Build Webhook Response', "const bin = item.binary && item.binary.data ? item.binary.data : null;", "const bin = item.binary && item.binary.data ? item.binary.data : null;\nconst pdfBin = item.binary && item.binary.pdf ? item.binary.pdf : null;")
patch('Build Webhook Response', "    file: bin ? {", "    pdf: pdfBin ? { data: pdfBin.data, fileName: pdfBin.fileName || d.pdf_file_name, mimeType: 'application/pdf' } : null,\n    file: bin ? {")
log('PDF reports: every report (keyword, keyword ideas, site audit, full report) is rendered to PDF by Gotenberg; PDF is the download and first email attachment, the .doc stays as fallback; renderer failures never fail the run')

# ---- RDAP fallback for domain age (DataForSEO WHOIS rarely covers ccTLDs such as .ae/.pk) ----
wp = pos('DataForSEO Whois')
add_node('RDAP Lookup', 'n8n-nodes-base.httpRequest', 4.5, {'url': "=https://rdap.org/domain/{{ $('Pick Competitors').item.json.domain }}", 'sendHeaders': True, 'headerParameters': {'parameters': [{'name': 'Accept', 'value': 'application/rdap+json, application/json'}]}, 'options': {'timeout': 15000, 'response': {'response': {'neverError': True}}}}, [wp[0] + 200, wp[1] + 160], {'onError': 'continueRegularOutput'})
disconnect('DataForSEO Whois', 'Competitor Analysis'); connect('DataForSEO Whois', 'RDAP Lookup'); connect('RDAP Lookup', 'Competitor Analysis')
patch('Competitor Analysis', "const ages = $input.all().map(i => i.json);", "const ages = $('DataForSEO Whois').all().map(i => i.json);\nconst rdaps = $input.all().map(i => i.json);   // free RDAP lookup, fills the gaps in DataForSEO WHOIS")
patch('Competitor Analysis', "  const rdap = (ages[i]?.events || []).find(e => /registration/i.test(e.eventAction || ''));", "  const rdap = (((rdaps[i] || {}).events) || []).find(e => /registration/i.test(e.eventAction || ''));")
log('Domain age: free RDAP lookup added as a fallback to DataForSEO WHOIS (covers .ae, .pk, .de and other ccTLDs)')

# ---- smarter competitor-discovery queries (H1s of shallow service pages instead of raw titles) ----
setcode('Fallback Queries', r"""// Queries used to discover competitors on Google: what this site's key pages are about, taken from H1s/titles of shallow pages.
const base = $('Schema Findings').first().json;
const pages = $('Get Crawled Pages').first().json.tasks?.[0]?.result?.[0]?.items || [];
const brand = String(base.domain || '').split('.')[0].toLowerCase();
const isHome = (u) => /^https?:\/\/[^\/]+\/?$/.test(u || '');
const skip = (u) => /privacy|cookie|terms|security|legal|contact|about|insights|blog|news|careers|team|faq|login|cart|thank|404|sitemap|\/tag\/|\/category\/|\/author\//i.test(u || '');
const clean = (t) => String(t || '').split(/\s[|\-–—:]\s/)[0].replace(/[^\w\s&\-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const generic = /^(page|home|homepage|welcome|untitled|services?|products?|solutions?|our (services|work|products)|index|overview)\b/;
const ok = (q) => { const w = q ? q.split(' ').length : 0; return w >= 2 && w <= 7 && !generic.test(q) && !(brand.length > 3 && q.includes(brand)); };
const scored = [];
pages.filter(p => p.url && !isHome(p.url) && !skip(p.url) && (p.status_code == null || p.status_code === 200)).forEach(p => {
  const m = p.meta || {};
  const cands = [clean(((m.htags || {}).h1 || [])[0]), clean(m.title)].filter(ok);
  if (cands.length) scored.push({ q: cands[0], depth: p.click_depth ?? 9, links: m.inbound_links_count || 0 });
});
scored.sort((a, b) => a.depth - b.depth || b.links - a.links);
const queries = [];
for (const s of scored) { if (!queries.includes(s.q)) queries.push(s.q); if (queries.length >= 3) break; }
if (!queries.length) {
  const home = pages.find(p => isHome(p.url));
  const q = clean(home && home.meta && ((((home.meta.htags || {}).h1 || [])[0]) || home.meta.title));
  if (ok(q)) queries.push(q);
}
if (!queries.length) return [{ json: { query: brand + ' services' } }];
return queries.map(q => ({ json: { query: q } }));""")
log('Competitor discovery: queries come from H1s/titles of shallow service pages, skipping generic or brand-only strings')

# ---- topic clusters: same intent, bounded size ----
patch('Build Keyword Suggestions', "    if (shared >= need && shared > 0) { home = c; break; }", "    if (shared >= need && shared > 0 && c.intent === k.intent && c.keywords.length < 12) { home = c; break; }")
patch('Build Keyword Suggestions', "  else clusters.push({ head: k.keyword, tokens: t, keywords: [k], volume: k.volume });", "  else clusters.push({ head: k.keyword, tokens: t, keywords: [k], volume: k.volume, intent: k.intent });")
log('Keyword ideas: topic clusters now require the same search intent and are capped at 12 keywords')

# ---- form copy, email escaping, client IP in rate-limit key ----
for f in nodes['Page Keyword']['parameters']['formFields']['values']:
    if f['fieldLabel'] == 'Email me the report': f['placeholder'] = 'Recommended: content takes 5-10 minutes; we email the files if you close this page'
nodes['Send Report']['parameters']['message'] = nodes['Send Report']['parameters']['message'].replace("<b>{{ $json.keyword }}</b>", "<b>{{ String($json.keyword).replace(/&/g, '&amp;').replace(/</g, '&lt;') }}</b>")
patch('Normalize Input', "    request_id: String(p2.request_id || ''),", "    request_id: String(p2.request_id || ''),\n    client_ip: String(p2.client_ip || ''),")
patch('Rate Limit', "const key = (d.email || d.domain || d.keyword || 'anon').toLowerCase();", "const key = (d.email || d.client_ip || d.domain || d.keyword || 'anon').toLowerCase();")
log('Small fixes: keyword form recommends an email (long runs), keyword escaped in the HTML email, API rate limit keyed by client IP when no email')

# ---- model refresh: Sonnet 5.5 everywhere, Haiku 4.5 for the cheap site-description step; one vendor ----
for n in nodes.values():
    if n['type'] == '@n8n/n8n-nodes-langchain.lmChatAnthropic':
        n['parameters']['model'] = {'__rl': True, 'mode': 'list', 'value': 'claude-sonnet-5-5', 'cachedResultName': 'Claude Sonnet 5.5'}
old_model = 'Site Describer Model (OpenAI)'
del nodes[old_model]; conns.pop(old_model, None)
add_node('Claude — Site Describer', '@n8n/n8n-nodes-langchain.lmChatAnthropic', 1.6, {'model': {'__rl': True, 'mode': 'list', 'value': 'claude-haiku-4-5-20251001', 'cachedResultName': 'Claude Haiku 4.5'}, 'options': {'maxTokensToSample': 4096}}, [pos('Site Describer')[0], pos('Site Describer')[1] + 200])
conns['Claude — Site Describer'] = {'ai_languageModel': [[{'node': 'Site Describer', 'type': 'ai_languageModel', 'index': 0}]]}
log('Models: all agents on Claude Sonnet 5.5 (current Sonnet, same price as Sonnet 5); Site Describer moved from OpenAI gpt-5-mini to Claude Haiku 4.5 — one vendor, one credential')

# ---- credential slots: fixed ids so credentials imported with these ids attach automatically ----
CRED = {'dataforseo': ('httpBasicAuth', 'SEOcredDataForSE', 'DataForSEO'), 'jina': ('httpHeaderAuth', 'SEOcredJinaReade', 'Jina Reader'),
        'psi': ('httpHeaderAuth', 'SEOcredPageSpeed', 'Google PageSpeed'), 'anthropic': ('anthropicApi', 'SEOcredAnthropic', 'Anthropic (SEO Agent)'),
        'form': ('httpBasicAuth', 'SEOcredFormLogin', 'SEO Form Login')}
def slot(node, key):
    t, i, nm = CRED[key]; nodes[node]['credentials'] = {t: {'id': i, 'name': nm}}
for n in list(nodes.values()):
    p = n['parameters']
    if n['type'] == 'n8n-nodes-base.httpRequest' and p.get('authentication') == 'genericCredentialType':
        url = str(p.get('url', ''))
        if p.get('genericAuthType') == 'httpBasicAuth': slot(n['name'], 'dataforseo')
        elif 'jina.ai' in url: slot(n['name'], 'jina')
        elif 'googleapis' in url: slot(n['name'], 'psi')
    if n['type'] == '@n8n/n8n-nodes-langchain.lmChatAnthropic': slot(n['name'], 'anthropic')
slot('Start Form', 'form')
log('Credential slots pre-wired (DataForSEO, Jina Reader, Google PageSpeed, Anthropic, form login); Gmail must be connected in the UI (OAuth)')

nodes['Note 5']['parameters']['content'] = nodes['Note 5']['parameters']['content'].replace("Reports are Word-compatible `.doc` (HTML). Consider real DOCX/PDF for enterprise clients.", "Reports are rendered to **PDF** by the Gotenberg service (`compose.override.yml`); the Word-compatible `.doc` is kept as fallback and second attachment. Run cost (DataForSEO spend per node, AI calls, duration) is in `run_ledger` on the final item and in the API callback.")
nodes['Note 1']['parameters']['content'] = nodes['Note 1']['parameters']['content'].replace("6. Claude / OpenAI model nodes (or n8n AI gateway)", "6. Anthropic API key — credential \"Anthropic (SEO Agent)\" (all 8 model nodes)\n7. PDF rendering needs the `gotenberg` service from compose.override.yml (falls back to .doc if it is down)")


# ---- cosmetic: round medians shown in evidence strings (12.850000000000001 years) ----
patch('Competitor Analysis', "const med = {\n  organic_keywords: median(comps.map(c => c.organic_keywords)),", "const r1 = (v) => v == null ? null : Math.round(v * 10) / 10;\nconst med = {\n  organic_keywords: median(comps.map(c => c.organic_keywords)),")
patch('Competitor Analysis', "  domain_age_years: median(comps.map(c => c.domain_age_years))\n};", "  domain_age_years: r1(median(comps.map(c => c.domain_age_years)))\n};")
patch('Competitor Analysis', "    'Estimated monthly organic visits: ' + base.domain + ' ' + (you.est_monthly_traffic || 0) + ' vs competitor median ' + Math.round(med.est_monthly_traffic),", "    'Estimated monthly organic visits: ' + base.domain + ' ' + (you.est_monthly_traffic || 0) + ' vs competitor median ' + Math.round(med.est_monthly_traffic).toLocaleString('en-GB'),")
log('Cosmetic: medians in evidence text are rounded (no 12.850000000000001 years)')


# =============================================================================
# 8c. v5 — SEO METHODOLOGY UPGRADE
#   discovery: multi-source research (ideas + long-tail + related + competitor rankings) -> opportunity score ->
#              AI relevance screen -> topic clusters & content plan -> AI search demand -> live SERP check
#   content:   client pages + verified facts + competitor term model -> richer brief -> Opus copywriter with thinking
#              -> critic -> deterministic QA with content score -> up to 2 editor rounds
# =============================================================================
HERE = os.path.dirname(os.path.abspath(__file__))
V5 = next(p for p in [os.path.join(HERE, 'v5'), os.path.join(HERE, '..', 'v5')] if os.path.isdir(p))
_rd0 = lambda p: open(os.path.join(V5, p), encoding='utf-8').read()
rd = lambda p: _rd0(p).replace('/*__REACH__*/', _rd0('code/_reach.js').rstrip('\n')).replace('/*__PUBLISH_ROWS__*/', _rd0('code/_publish_rows.js').rstrip('\n'))   # v4.8: the shared reach rules and published-page rows (one copy each) are inlined where a node asks for them
def set_prompt(name, file): nodes[name]['parameters']['text'] = '=' + rd('prompts/' + file)
def set_schema(parser_name, schema): nodes[parser_name]['parameters']['inputSchema'] = json.dumps(schema, ensure_ascii=False)
def get_schema(parser_name): return json.loads(nodes[parser_name]['parameters']['inputSchema'])
DFS_HTTP = lambda: {'method': 'POST', 'url': '={{ $json.endpoint }}', 'authentication': 'genericCredentialType', 'genericAuthType': 'httpBasicAuth', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify($json.body) }}', 'options': {'batching': {'batch': {'batchSize': 1, 'batchInterval': 400}}, 'timeout': 90000}}
def agent_bundle(name, prompt_file, model_name, model_id, model_label, max_tokens, effort, parser_name, schema, pos_):
    add_node(name, '@n8n/n8n-nodes-langchain.agent', 3.1, {'promptType': 'define', 'text': '=' + rd('prompts/' + prompt_file), 'hasOutputParser': True, 'options': {}}, pos_, {'retryOnFail': True, 'maxTries': 2, 'waitBetweenTries': 3000})
    opts = {'maxTokensToSample': max_tokens}
    if effort: opts.update({'thinking': True, 'thinkingMode': 'adaptive', 'effort': effort})
    add_node(model_name, '@n8n/n8n-nodes-langchain.lmChatAnthropic', 1.6, {'model': {'__rl': True, 'mode': 'list', 'value': model_id, 'cachedResultName': model_label}, 'options': opts}, [pos_[0] - 100, pos_[1] + 200])
    add_node(parser_name, '@n8n/n8n-nodes-langchain.outputParserStructured', 1.3, {'schemaType': 'manual', 'inputSchema': json.dumps(schema, ensure_ascii=False)}, [pos_[0] + 120, pos_[1] + 200])
    conns[model_name] = {'ai_languageModel': [[{'node': name, 'type': 'ai_languageModel', 'index': 0}]]}
    conns[parser_name] = {'ai_outputParser': [[{'node': name, 'type': 'ai_outputParser', 'index': 0}]]}
ARR = {'type': 'array', 'items': {'type': 'string'}}

# ---------- A. intake: goal, tone, CTA, business facts; 3 QA rounds ----------
patch('Normalize Input', "  qa_max_rounds: 2,", "  qa_max_rounds: 2,   // one editor pass: live tests showed a second pass inflates length without raising the score")
patch('Normalize Input', "const pageType = String(pick(p2, 'page', 'type') || '').trim() || 'Service Page';",
      "const pageType = String(pick(p2, 'page', 'type') || '').trim() || 'Service Page';\nconst business_facts = String(pick(p2, 'facts') || p2.business_facts || '').trim().slice(0, 2000);\nconst cta = String(pick(p2, 'call', 'action') || p2.cta || '').trim().slice(0, 200);\nconst tone = String(pick(p2, 'tone') || '').trim();\nconst goalRaw = String(pick(p2, 'goal') || '').toLowerCase();\nconst goal = /sell|sales/.test(goalRaw) ? 'sales' : /traffic|educat|rank/.test(goalRaw) ? 'traffic' : /brand/.test(goalRaw) ? 'brand' : 'leads';")
patch('Normalize Input', "    page_type: pageType,\n", "    page_type: pageType,\n    business_facts,\n    cta,\n    tone,\n    goal,\n")
FACTS = {'fieldLabel': 'Business facts to include (optional)', 'fieldType': 'textarea', 'placeholder': 'Real facts we may state: services, locations, years, certifications, partners, team size, awards, pricing model, proof. Anything not listed becomes a [placeholder].'}
CTA = {'fieldLabel': 'Main call to action (optional)', 'placeholder': 'e.g. Book a free scoping call'}
TONE = {'fieldLabel': 'Tone of voice', 'fieldType': 'dropdown', 'fieldOptions': {'values': [{'option': 'Professional and direct'}, {'option': 'Friendly and plain-spoken'}, {'option': 'Bold and confident'}, {'option': 'Technical and precise'}, {'option': 'Premium and understated'}]}}
GOAL = {'fieldLabel': 'Content goal', 'fieldType': 'dropdown', 'fieldOptions': {'values': [{'option': 'Get leads and enquiries'}, {'option': 'Sell online'}, {'option': 'Rank and educate (traffic)'}, {'option': 'Build the brand'}]}}
def insert_fields(form, after_label, fields):
    vals = nodes[form]['parameters']['formFields']['values']
    i = next(i for i, f in enumerate(vals) if f['fieldLabel'] == after_label) + 1
    for f in reversed(fields): vals.insert(i, copy.deepcopy(f))
insert_fields('Page Keyword', 'Existing page URL (optional)', [FACTS, CTA, TONE, GOAL])
insert_fields('Page Discover', 'Website Domain', [GOAL, FACTS])
log('v5 intake: goal, tone of voice, call to action and real business facts collected (form + API); up to 2 editor rounds')

# ---------- B. keyword discovery pipeline ----------
set_prompt('Keyword Seeds', 'keyword_seeds.txt')
set_schema('Parser — Keyword Seeds', {'type': 'object', 'properties': {'primary_seed': {'type': 'string'}, 'seed_groups': {'type': 'object'}, 'services': ARR, 'seeds': ARR}, 'required': ['primary_seed', 'seed_groups']})
setcode('Seed List', rd('code/Seed_List.js'))
for old in ['Discover Ideas', 'Rank Candidates', 'Build Keyword Suggestions']:
    for src in list(conns.keys()): disconnect(src, old)
    del nodes[old]; conns.pop(old, None)
sl = pos('Seed List'); X, Y = sl[0] + 220, sl[1]
add_node('Research Requests', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Research_Requests.js')}, [X, Y]); X += 220
add_node('Run Research', 'n8n-nodes-base.httpRequest', 4.5, DFS_HTTP(), [X, Y], {'onError': 'continueRegularOutput', 'retryOnFail': True, 'maxTries': 2, 'waitBetweenTries': 3000}); X += 220
add_node('Competitor Keyword Requests', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Competitor_Keyword_Requests.js')}, [X, Y]); X += 220
add_node('Run Competitor Keywords', 'n8n-nodes-base.httpRequest', 4.5, DFS_HTTP(), [X, Y], {'onError': 'continueRegularOutput'}); X += 220
add_node('Collect Research', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Collect_Research.js')}, [X, Y]); X += 220
add_node('Relevance Chunks', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Relevance_Chunks.js')}, [X, Y]); X += 220
agent_bundle('Keyword Relevance', 'keyword_relevance.txt', 'Claude — Keyword Relevance', 'claude-sonnet-5-5', 'Claude Sonnet 5.5', 16384, 'low', 'Parser — Keyword Relevance',
  {'type': 'object', 'properties': {'items': {'type': 'array', 'items': {'type': 'object', 'properties': {'keyword': {'type': 'string'}, 'relevance': {'type': 'number'}, 'intent': {'type': 'string'}, 'page_type': {'type': 'string'}, 'topic': {'type': 'string'}}, 'required': ['keyword', 'relevance']}}}, 'required': ['items']}, [X, Y]); X += 260
add_node('Rank Keywords', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Rank_Keywords.js')}, [X, Y]); X += 220
add_node('AI Demand', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': 'https://api.dataforseo.com/v3/ai_optimization/ai_keyword_data/keywords_search_volume/live', 'authentication': 'genericCredentialType', 'genericAuthType': 'httpBasicAuth', 'sendBody': True, 'specifyBody': 'json',
  'jsonBody': "={{ JSON.stringify([{ keywords: (($json.keyword_strategy || {}).keywords || []).slice(0, 100).map(k => k.keyword), location_code: $json.location_code, language_code: $json.language_code || 'en' }]) }}", 'options': {'timeout': 60000, 'response': {'response': {'neverError': True}}}}, [X, Y], {'onError': 'continueRegularOutput'}); X += 220
add_node('Priority Keywords', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Priority_Keywords.js')}, [X, Y]); X += 220
nodes['Candidate SERP']['position'] = [X, Y]; X += 220
add_node('Build Keyword Strategy', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Build_Keyword_Strategy.js')}, [X, Y]); X += 220
nodes['Build Keyword File']['position'] = [X, Y]
for a, b in [('Seed List', 'Research Requests'), ('Research Requests', 'Run Research'), ('Run Research', 'Competitor Keyword Requests'), ('Competitor Keyword Requests', 'Run Competitor Keywords'), ('Run Competitor Keywords', 'Collect Research'), ('Collect Research', 'Relevance Chunks'), ('Relevance Chunks', 'Keyword Relevance'), ('Keyword Relevance', 'Rank Keywords'), ('Rank Keywords', 'AI Demand'), ('AI Demand', 'Priority Keywords'), ('Priority Keywords', 'Candidate SERP'), ('Candidate SERP', 'Build Keyword Strategy'), ('Build Keyword Strategy', 'Build Keyword File')]:
    connect(a, b)
patch('Seed From Suggestion', "const page_type = intent === 'informational' ? 'Blog Post' : 'Service Page';", "const page_type = pick.page_type || (intent === 'informational' ? 'Blog Post' : 'Service Page');")
log('v5 discovery: seeds by buyer motive -> 7 research pulls (ideas, long-tail, related, competitors who rank) -> opportunity score (traffic potential x winnability x value x goal intent x trend) -> AI relevance screen -> topic clusters & content plan -> AI search demand -> live SERP check on the priority keywords')

# ---------- C. content pipeline ----------
cu = pos('Collect Site URLs')
if_node('Read Client Pages?', "{{ !!$json.domain }}", [cu[0] + 200, cu[1]])
add_node('Client Page Requests', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Client_Page_Requests.js')}, [cu[0] + 400, cu[1] - 160])
rcp = copy.deepcopy(nodes['Read Competitor Pages']); rcp['name'] = 'Read Client Pages'; rcp['id'] = nid('Read Client Pages'); rcp['position'] = [cu[0] + 600, cu[1] - 160]
rcp['parameters']['options']['batching']['batch']['batchInterval'] = 2500
nodes['Read Client Pages'] = rcp
add_node('Collect Client Pages', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Collect_Client_Pages.js')}, [cu[0] + 800, cu[1] - 160])
disconnect('Collect Site URLs', 'SERP Top 10')
connect('Collect Site URLs', 'Read Client Pages?'); connect('Read Client Pages?', 'Client Page Requests', 0); connect('Read Client Pages?', 'SERP Top 10', 1)
connect('Client Page Requests', 'Read Client Pages'); connect('Read Client Pages', 'Collect Client Pages'); connect('Collect Client Pages', 'SERP Top 10')
setcode('Clean Competitor Pages', rd('code/Clean_Competitor_Pages.js'))
ccp = pos('Clean Competitor Pages')
fs = copy.deepcopy(nodes['SERP Top 10']); fs['name'] = 'Facts SERP'; fs['id'] = nid('Facts SERP'); fs['position'] = [ccp[0] + 200, ccp[1] + 180]
fs['parameters']['jsonBody'] = '={{ JSON.stringify([{ keyword: String($json.keyword).replace(/\\b(in|near|for)\\b/g, \' \').replace(/\\b(uae|dubai|abu dhabi|sharjah|saudi|riyadh|jeddah|pakistan|karachi|lahore|india|mumbai|delhi|uk|london|usa|australia|sydney|canada|toronto|singapore|south africa|germany|berlin|france|paris|spain|madrid|italy|netherlands|brazil|mexico|ireland|dublin|new zealand)\\b/gi, \' \').replace(/\\s+/g, \' \').trim() + \' statistics \' + new Date().getFullYear(), location_code: $json.location_code, language_code: $json.language_code || \'en\', depth: 20 }]) }}'
fs['onError'] = 'continueRegularOutput'; nodes['Facts SERP'] = fs
add_node('Collect Facts', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Collect_Facts.js')}, [ccp[0] + 400, ccp[1] + 180])
disconnect('Clean Competitor Pages', 'Competitor Analyzer')
connect('Clean Competitor Pages', 'Facts SERP'); connect('Facts SERP', 'Collect Facts'); connect('Collect Facts', 'Competitor Analyzer')
patch('Parse Analysis', "const prev = $('Clean Competitor Pages').first().json;", "const prev = $('Collect Facts').first().json;")
set_prompt('Competitor Analyzer', 'competitor_analyzer.txt')
sc = get_schema('Parser — Competitor Analyzer')
for k in ['information_gain_opportunities', 'reader_questions', 'winning_formats', 'trust_signals_needed', 'existing_page_gaps']: sc['properties'][k] = ARR
set_schema('Parser — Competitor Analyzer', sc)
# site authority for the verdict
kd = pos('Keyword Data')
if_node('Has Domain (Authority)?', "{{ !!$json.domain }}", [kd[0] + 180, kd[1]])
sa = copy.deepcopy(nodes['Domain Overview']); sa['name'] = 'Site Authority'; sa['id'] = nid('Site Authority'); sa['position'] = [kd[0] + 360, kd[1] - 160]
sa['parameters']['jsonBody'] = "={{ JSON.stringify([{ target: $json.domain, location_code: $json.location_code, language_code: $json.language_code || 'en' }]) }}"
sa['parameters']['options'] = {'response': {'response': {'neverError': True}}, 'timeout': 60000}; sa['onError'] = 'continueRegularOutput'; nodes['Site Authority'] = sa
disconnect('Keyword Data', 'Merge Keyword Data')
connect('Keyword Data', 'Has Domain (Authority)?'); connect('Has Domain (Authority)?', 'Site Authority', 0); connect('Has Domain (Authority)?', 'Merge Keyword Data', 1); connect('Site Authority', 'Merge Keyword Data')
patch('Merge Keyword Data', "const prev = $('Parse Analysis').first().json;\nconst res = $input.first().json || {};",
      "const prev = $('Parse Analysis').first().json;\nlet res = {}; try { res = $('Keyword Data').first().json || {}; } catch (e) { res = $input.first().json || {}; }\nlet site_authority = null;\ntry { const m = $('Site Authority').first().json?.tasks?.[0]?.result?.[0]?.items?.[0]?.metrics?.organic; if (m) site_authority = { organic_keywords: m.count ?? 0, top3: (m.pos_1 || 0) + (m.pos_2_3 || 0), top10: (m.pos_1 || 0) + (m.pos_2_3 || 0) + (m.pos_4_10 || 0), est_monthly_traffic: Math.round(m.etv || 0) }; } catch (e) {}")
patch('Merge Keyword Data', "    competitors_summary,\n    keyword_data\n", "    competitors_summary,\n    keyword_data,\n    site_authority\n")
set_prompt('Verdict Agent', 'verdict.txt')
sv = get_schema('Parser — Verdict'); sv['properties'].update({'what_must_change': ARR, 'expected_monthly_visits_top3': {'type': 'number'}, 'time_to_rank_months': {'type': 'number'}}); set_schema('Parser — Verdict', sv)
patch('Parse Verdict', "    secondary_keywords: verdict.secondary_keywords || []\n  }", "    secondary_keywords: verdict.secondary_keywords || [],\n    verdict_changes: verdict.what_must_change || [],\n    expected_visits_top3: verdict.expected_monthly_visits_top3 ?? null,\n    time_to_rank_months: verdict.time_to_rank_months ?? null\n  }")
set_prompt('Strategy Brief', 'strategy_brief.txt')
sb = get_schema('Parser — Strategy Brief')
OBJ = lambda props: {'type': 'array', 'items': {'type': 'object', 'properties': props}}
sb['properties'].update({'title_variants': ARR, 'meta_variants': ARR, 'audience_pain_points': ARR, 'objections': ARR, 'reading_level': {'type': 'string'}, 'information_gain': ARR,
  'snippet_targets': OBJ({'question': {'type': 'string'}, 'answer': {'type': 'string'}}), 'terms_to_use': OBJ({'term': {'type': 'string'}, 'min_count': {'type': 'number'}}),
  'evidence_plan': OBJ({'fact': {'type': 'string'}, 'source_url': {'type': 'string'}}), 'client_facts': ARR, 'proof_elements': ARR, 'voice_rules': ARR})
sb['properties']['outline']['items']['properties'].update({'format': {'type': 'string'}, 'evidence': ARR})
sb['properties']['comparison_table']['properties']['rows_hint'] = {'type': 'string'}
sb['properties']['image_suggestions'] = OBJ({'placement': {'type': 'string'}, 'purpose': {'type': 'string'}, 'subject': {'type': 'string'}, 'alt_text': {'type': 'string'}, 'caption': {'type': 'string'}, 'filename': {'type': 'string'}})
set_schema('Parser — Strategy Brief', sb)
set_prompt('Copywriter', 'copywriter.txt')
cw = pos('Copywriter')
agent_bundle('Critic', 'critic.txt', 'Claude — Critic', 'claude-sonnet-5-5', 'Claude Sonnet 5.5', 16384, 'medium', 'Parser — Critic',
  {'type': 'object', 'properties': {'score': {'type': 'number'}, 'verdict': {'type': 'string'}, 'strengths': ARR, 'problems': OBJ({'severity': {'type': 'string'}, 'location': {'type': 'string'}, 'issue': {'type': 'string'}, 'fix': {'type': 'string'}}), 'banned_phrases_found': ARR, 'unsupported_claims': ARR, 'missing_brief_items': ARR, 'revision_instructions': {'type': 'string'}}, 'required': ['score', 'verdict', 'problems', 'revision_instructions']}, [cw[0] + 240, cw[1] + 260])
add_node('Parse Critique', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Parse_Critique.js')}, [cw[0] + 500, cw[1] + 260])
disconnect('Copywriter', 'Content QA')
connect('Copywriter', 'Critic'); connect('Critic', 'Parse Critique'); connect('Parse Critique', 'Content QA')
setcode('Content QA', rd('code/Content_QA.js'))
set_prompt('Editor', 'editor.txt')
# report additions
patch('Build Word File', "    ['Recommended Page Type', esc(d.recommended_page || d.page_type || 'N/A')]\n  ]) +", "    ['Recommended Page Type', esc(d.recommended_page || d.page_type || 'N/A')],\n    ['Expected visits/month at #1-3', d.expected_visits_top3 != null ? num(d.expected_visits_top3) : 'N/A'],\n    ['Time to rank', d.time_to_rank_months != null ? d.time_to_rank_months + ' months' : 'N/A']\n  ]) +")
patch('Build Word File', "  '<h3>Why</h3>' + ul(d.verdict_reasons) +", "  '<h3>Why</h3>' + ul(d.verdict_reasons) +\n  ((d.verdict_changes && d.verdict_changes.length) ? '<h3>What must change first</h3>' + ul(d.verdict_changes) : '') +")
patch('Build Word File', "    ['Schema generated', esc((qa.schema_types || []).join(', ') || 'None')]\n  ]) +",
      "    ['Schema generated', esc((qa.schema_types || []).join(', ') || 'None')],\n    ['Content score', qa.content_score != null ? '<b>' + qa.content_score + '/100</b>' + (qa.score_breakdown ? ' (structure ' + qa.score_breakdown.structure + '/25, topic coverage ' + qa.score_breakdown.coverage + '/25, readability ' + qa.score_breakdown.readability + '/15, specificity ' + qa.score_breakdown.specificity + '/10, clean language ' + qa.score_breakdown.clean_language + '/10, length ' + qa.score_breakdown.length + '/15)' : '') : 'N/A'],\n    ['Topic coverage', qa.coverage_pct != null ? qa.coverage_pct + '% of the terms top-ranking pages share' : 'N/A'],\n    ['Readability', qa.readability ? 'Flesch ' + qa.readability.flesch + ' · ' + qa.readability.avg_sentence_words + ' words per sentence · passive voice ' + qa.readability.passive_pct + '%' : 'N/A'],\n    ['Filler phrases left', (qa.banned_phrases || []).length ? esc(qa.banned_phrases.map(b => b.phrase).slice(0, 6).join(', ')) : 'none'],\n    ['Editorial review', qa.critic_score != null ? qa.critic_score + '/100 — ' + esc(qa.critic_verdict || '') : 'N/A']\n  ]) +")
patch('Build Word File', "  if (schemaBlocks.length) {\n    parts.push(h2('Structured Data (JSON-LD)', true) +",
      "  const tc = (qa.term_coverage || []);\n  if (tc.length) parts.push(h2('Topic Coverage vs Top-Ranking Pages') + '<p class=\"small\">Terms the top pages share and how often this page uses them.</p><table class=\"ct\"><tr><th>Term</th><th>Target</th><th>Found</th><th></th></tr>' + tc.slice(0, 30).map(t => '<tr><td>' + esc(t.term) + '</td><td>' + t.target + '</td><td>' + t.found + '</td><td>' + (t.ok ? '<span class=\"ok\">ok</span>' : '<span class=\"bad\">add</span>') + '</td></tr>').join('') + '</table>');\n  const srcs = (qa.sources_cited || []);\n  if (srcs.length) parts.push(h2('Sources Cited') + '<table class=\"ct\"><tr><th>Anchor</th><th>URL</th></tr>' + srcs.map(s => '<tr><td>' + esc(s.anchor) + '</td><td>' + esc(s.url) + '</td></tr>').join('') + '</table>');\n  const tv = (brief.title_variants || []), mv = (brief.meta_variants || []);\n  if (tv.length || mv.length) parts.push(h2('Title & Meta Alternatives') + (tv.length ? '<h3>Titles</h3>' + ul(tv) : '') + (mv.length ? '<h3>Meta descriptions</h3>' + ul(mv) : ''));\n  if (d.critique && ((d.critique.strengths || []).length || (d.critique.problems || []).length)) parts.push(h2('Editorial Review') + kv([['Score', (d.critique.score != null ? d.critique.score + '/100' : 'N/A') + ' — ' + esc(d.critique.verdict || '')]]) + ((d.critique.strengths || []).length ? '<h3>Strengths</h3>' + ul(d.critique.strengths) : '') + ((d.critique.problems || []).length ? '<h3>Issues raised (addressed by the editor)</h3>' + ul(d.critique.problems.slice(0, 8).map(p => '[' + p.severity + '] ' + p.issue)) : ''));\n  if (schemaBlocks.length) {\n    parts.push(h2('Structured Data (JSON-LD)', true) +")
log('v5 content: client pages read for real facts; competitor term model, questions and statistics; verified facts with sources from a second search; site authority in the verdict (plus expected visits and time to rank); richer brief (pain points, objections, information gain, evidence plan, terms, snippet targets); rewritten copywriter rules; editorial critic; QA content score (structure, coverage, readability, specificity, clean language, length); report shows coverage, sources, alternatives and the review')

# ---------- D. models with adaptive thinking ----------
def model(name, mid, label, max_tokens, effort):
    n = nodes[name]; n['parameters']['model'] = {'__rl': True, 'mode': 'list', 'value': mid, 'cachedResultName': label}
    # the Anthropic SDK requires streaming when max_tokens implies a request longer than 10 minutes (> ~21k tokens)
    n['parameters']['options'] = {'maxTokensToSample': max_tokens, **({'streaming': True} if max_tokens > 21000 else {}), **({'thinking': True, 'thinkingMode': 'adaptive', 'effort': effort} if effort else {})}
model('Claude — Copywriter', 'claude-opus-5-5', 'Claude Opus 5.5', 32768, 'medium')    # medium effort: 2-3x faster than high, no truncation seen
model('Claude — Editor', 'claude-opus-5-5', 'Claude Opus 5.5', 32768, 'medium')
model('Claude — Strategy Brief', 'claude-opus-5-5', 'Claude Opus 5.5', 24576, 'medium')  # JSON brief: medium effort, generous budget
model('Claude — Competitor Analyzer', 'claude-sonnet-5-5', 'Claude Sonnet 5.5', 16384, 'medium')
model('Verdict Chat Model', 'claude-sonnet-5-5', 'Claude Sonnet 5.5', 16384, 'medium')
model('Anthropic Chat Model', 'claude-sonnet-5-5', 'Claude Sonnet 5.5', 16384, 'medium')
model('Claude — Content Reviewer', 'claude-sonnet-5-5', 'Claude Sonnet 5.5', 16384, 'medium')
log('v5 models: Opus 5.5 with adaptive thinking (effort high) for brief, copywriter and editor; Sonnet 5.5 with thinking for analysis, verdict, seeds, critic and content review; Haiku 4.5 for the site description')

# ---------- E. credential slots for the new nodes ----------
for n in list(nodes.values()):
    p = n['parameters']
    if n['type'] == 'n8n-nodes-base.httpRequest' and p.get('authentication') == 'genericCredentialType':
        url = str(p.get('url', ''))
        if p.get('genericAuthType') == 'httpBasicAuth': slot(n['name'], 'dataforseo')
        elif 'jina.ai' in url: slot(n['name'], 'jina')
        elif 'googleapis' in url: slot(n['name'], 'psi')
    if n['type'] == '@n8n/n8n-nodes-langchain.lmChatAnthropic': slot(n['name'], 'anthropic')

# ---------- F. notes ----------
nodes['Note 3']['parameters']['content'] = """### Keyword pipeline (keyword / verdict / discover-chained)
Sitemap -> real internal-link candidates + existing-page detection -> **client pages read** (existing page, homepage, one service page: real facts, not placeholders) -> SERP (top 30, PAA, AI Overview, forum threads) -> 6 competitor pages (Jina, 9k chars each) -> **term model** (phrases the top pages share), questions, statistics -> **verified facts** with sources (second search) -> **Competitor Analyzer** (information gain, reader questions, winning formats) -> keyword metrics + **site authority** -> **Verdict** (GO / GO_WITH_CHANGES / AVOID, expected visits, time to rank) -> **Strategy Brief** (Opus, thinking) -> **Copywriter** (Opus, thinking; strict specificity and anti-filler rules) -> **Critic** (Sonnet) -> **Content QA** (content score 0-100: structure, topic coverage, readability, specificity, clean language, length) -> **Editor** (Opus, up to 2 rounds) -> PDF + Word -> download / email / API callback."""
nodes['Note 3']['parameters']['height'] = 300
sticky("""### Keyword discovery ("Suggest keywords")
Seeds by buyer motive (services, problems, comparisons, pricing, local, audience) -> 7 DataForSEO pulls: keyword ideas (600, relevance order), long-tail suggestions x3, related searches x2, live SERP -> keywords the 3 closest competitors rank for -> one pool with volume, difficulty, CPC, trend, **SERP features** and top-10 link strength -> **opportunity score** = traffic potential (volume after AI-Overview/snippet click loss) x winnability x commercial value x intent weight for the goal x trend -> **AI relevance screen** (2 core / 1 adjacent / 0 drop; intent; page type; topic label) -> topic clusters with Now/Next/Later tiers -> **AI search demand** (ChatGPT & co) -> live SERP check of the 8 priority keywords -> Keyword Strategy report (PDF).
The goal-fit keyword feeds the content pipeline when the user also asked for content.""", pos('Seed List')[0] - 60, pos('Seed List')[1] - 340, 900, 260, 5)


# =============================================================================
# 8d. AI spend guard — estimated Claude spend per run, hard stop at CONFIG.ai_budget_usd (belt and braces next to the
#     Anthropic Console workspace limit). Estimates are conservative per run type; static data persists for production runs.
# =============================================================================
patch('Normalize Input', "  default_country: 'United States'\n};", "  default_country: 'United States',\n  ai_budget_usd: 3,                 // estimated Claude spend allowed per budget period (see Rate Limit); raise when ready\n  ai_budget_period: 'day'           // 'day' | 'month' — daily window while testing; the Anthropic Console workspace limit is the hard cap\n};")
patch('Normalize Input', "    qa_max_rounds: CONFIG.qa_max_rounds,\n", "    qa_max_rounds: CONFIG.qa_max_rounds,\n    ai_budget_usd: CONFIG.ai_budget_usd,\n    ai_budget_period: CONFIG.ai_budget_period,\n")
patch('Rate Limit', "store.rate.keys[key] = used + 1;\nstore.rate.total += 1;",
      """store.rate.keys[key] = used + 1;
store.rate.total += 1;

// ---- estimated Claude spend guard ----
// Conservative per-run estimates (USD) for the AI steps only; DataForSEO spend is tracked separately in run_ledger.
const EST = { content: 1.2, discover: 0.35, verdict: 0.2, full: 0.25, site_audit: 0, describe: 0.03 };
let est = 0;
if (d.mode === 'site_description') est = EST.describe;
else if (d.mode === 'audit') est = d.include_full_report ? EST.full : EST.site_audit;
else if (d.mode === 'discover') est = EST.discover + (d.include_content ? EST.content : 0) + (d.include_full_report ? EST.full : 0);
else if (d.mode === 'keyword') est = d.verdict_only ? EST.verdict : EST.content;
if (d.need_site_description) est += EST.describe;
const period = (d.ai_budget_period === 'day') ? today : today.slice(0, 7);
if (!store.ai_budget || store.ai_budget.period !== period) store.ai_budget = { period, spent_est: 0, runs: 0 };
const budget = Number(d.ai_budget_usd || 0);
if (budget > 0 && store.ai_budget.spent_est + est > budget) {
  return [{ json: { ...d, validation_error: 'The AI budget for this ' + (d.ai_budget_period || 'month') + ' is used up (estimated $' + store.ai_budget.spent_est.toFixed(2) + ' of $' + budget + '; this run would add about $' + est.toFixed(2) + '). Raise ai_budget_usd in Normalize Input when you are ready to continue.' } }];
}
store.ai_budget.spent_est = +(store.ai_budget.spent_est + est).toFixed(2);
store.ai_budget.runs += 1;
d.ai_spend_estimate_usd = est;
d.ai_budget_used_est_usd = store.ai_budget.spent_est;""")
log('AI spend guard: Rate Limit estimates Claude spend per run and refuses new runs once the period estimate would exceed ai_budget_usd (set to $3 for testing)')


# =============================================================================
# 8e. testing convenience: a local http callback (n8n calling itself) is accepted; https stays mandatory otherwise
# =============================================================================
patch('Normalize Input', "if (callback_url && !/^https:\\/\\/[^\\s]+$/.test(callback_url)) throw new Error('callback_url must be an https URL.');",
      "if (callback_url && !/^(https:\\/\\/[^\\s]+|http:\\/\\/(localhost|127\\.0\\.0\\.1|host\\.docker\\.internal|n8n)(:\\d+)?\\/[^\\s]*)$/.test(callback_url)) throw new Error('callback_url must be an https URL (plain http is allowed only for localhost while testing).');")
log('API: callback_url may be a local http URL while testing (localhost / host.docker.internal); https required otherwise')


# =============================================================================
# 8f. e-mail via SMTP (Gmail App Password) instead of Gmail OAuth — no browser consent, fully automatable
# =============================================================================
from env_settings import SENDER, BRAND, OPS_EMAIL, SA_EMAIL   # from n8n/.env at build time (run apply_env.py after editing .env)
for gm in ('Send Report', 'Send Audit Report'):
    g = nodes[gm]; gp = g['parameters']
    g['type'] = 'n8n-nodes-base.emailSend'; g['typeVersion'] = 2.1
    g['parameters'] = {'fromEmail': SENDER, 'toEmail': gp['sendTo'], 'subject': gp['subject'], 'emailFormat': 'html', 'html': gp['message'],
                       'options': {'attachments': "={{ $binary.pdf ? 'pdf,data' : 'data' }}", 'appendAttribution': False}}
    g['credentials'] = {'smtp': {'id': 'SEOcredSmtpGmail', 'name': 'Gmail SMTP (SEO Agent)'}}
    g['onError'] = 'continueRegularOutput'   # a mail failure must not kill a finished run; the error is visible in the execution
log('E-mail: Gmail OAuth nodes replaced by SMTP Send Email nodes (credential "Gmail SMTP (SEO Agent)", Google App Password); PDF + Word attached')
nodes['Note 1']['parameters']['content'] = nodes['Note 1']['parameters']['content'].replace('4. Gmail OAuth2 (Send Report, Send Audit Report)', '4. Gmail SMTP — credential "Gmail SMTP (SEO Agent)": smtp.gmail.com:465, your Gmail address + a Google App Password (Send Report, Send Audit Report)')


# =============================================================================
# 8g. fixes from live test 1: request_id must survive the report builders; the API callback must carry the real PDF
#     bytes (n8n keeps HTTP binaries on disk and leaves a reference in .data); ledger covers every DataForSEO node
# =============================================================================
patch('Build Word File', "    keyword: d.keyword,\n    country: d.country,", "    request_id: d.request_id || null,\n    keyword: d.keyword,\n    country: d.country,")
for nm in ('Build Full Report', 'Build Audit Report'):
    patch(nm, "    domain: a.domain,\n    email: d.email,", "    domain: a.domain,\n    email: d.email,\n    request_id: d.request_id || null,\n    callback_url: d.callback_url || '',\n    via_webhook: !!d.via_webhook,")
patch('Build Webhook Response', "const bin = item.binary && item.binary.data ? item.binary.data : null;\nconst pdfBin = item.binary && item.binary.pdf ? item.binary.pdf : null;",
      "const bin = item.binary && item.binary.data ? item.binary.data : null;\nconst pdfBin = item.binary && item.binary.pdf ? item.binary.pdf : null;\n// Binary content: code-created binaries carry base64 in .data; binaries written by HTTP nodes are stored on disk and .data\n// is only a reference, so read the bytes through the helper and fall back to .data when it already looks like base64.\nconst b64 = async (prop, b) => { try { const buf = await this.helpers.getBinaryDataBuffer(0, prop); if (buf && buf.length) return buf.toString('base64'); } catch (e) {} return (b && b.data && String(b.data).length > 100) ? b.data : null; };\nconst docData = bin ? await b64('data', bin) : null;\nconst pdfData = pdfBin ? await b64('pdf', pdfBin) : null;")
patch('Build Webhook Response', "    pdf: pdfBin ? { data: pdfBin.data, fileName: pdfBin.fileName || d.pdf_file_name, mimeType: 'application/pdf' } : null,", "    pdf: pdfData ? { data: pdfData, fileName: pdfBin.fileName || d.pdf_file_name, mimeType: 'application/pdf' } : null,")
patch('Build Webhook Response', "    file: bin ? {\n      data: bin.data,", "    file: docData ? {\n      data: docData,")
for nm in ('Build Word File', 'Build Full Report', 'Build Audit Report', 'Build Keyword File'):
    patch(nm, "'Fallback SERP', 'Domain Overview', 'DataForSEO Whois', 'Ranked Keywords', 'Keyword Ideas', 'Backlink Summary', 'Backlink Gap', 'AI SERP', 'Ask LLMs'];", "'Fallback SERP', 'Domain Overview', 'DataForSEO Whois', 'Ranked Keywords', 'Keyword Ideas', 'Backlink Summary', 'Backlink Gap', 'AI SERP', 'Ask LLMs', 'Facts SERP', 'Site Authority', 'Run Research', 'Run Competitor Keywords', 'AI Demand'];")
log('Live-test fixes: request_id kept through every report builder; API callback carries real PDF/Word bytes; ledger counts all DataForSEO nodes')


# =============================================================================
# 8h. live-test round 2: browser-engine retry for blocked competitor pages; API-mode delivery for describe / discover / audit
# =============================================================================
rcp0 = pos('Read Competitor Pages')
add_node('Find Blocked Pages', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Find_Blocked_Pages.js')}, [rcp0[0] + 200, rcp0[1] + 180])
if_node('Any Blocked?', "{{ ($json.blocked_count || 0) > 0 }}", [rcp0[0] + 400, rcp0[1] + 180])
add_node('Blocked Page Items', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Blocked_Page_Items.js')}, [rcp0[0] + 600, rcp0[1] + 320])
rt = copy.deepcopy(nodes['Read Competitor Pages']); rt['name'] = 'Retry Blocked Pages'; rt['id'] = nid('Retry Blocked Pages'); rt['position'] = [rcp0[0] + 800, rcp0[1] + 320]
rt['parameters']['headerParameters']['parameters'] = [{'name': 'X-Engine', 'value': 'browser'}, {'name': 'X-Proxy', 'value': 'auto'}, {'name': 'X-No-Cache', 'value': 'true'}, {'name': 'X-Timeout', 'value': '45'}, {'name': 'X-Retain-Images', 'value': 'none'}, {'name': 'X-Remove-Selector', 'value': 'header, nav, footer, aside, form, [class*="cookie"], [id*="cookie"], [class*="consent"], [id*="consent"], [id*="onetrust"], [class*="newsletter"], [class*="menu"]'}]
rt['parameters']['options']['timeout'] = 65000; rt['parameters']['options']['batching']['batch']['batchInterval'] = 4000
nodes['Retry Blocked Pages'] = rt
rename('Clean Competitor Pages', 'Analyze Competitor Pages')
setcode('Analyze Competitor Pages', rd('code/Clean_Competitor_Pages.js'))
disconnect('Read Competitor Pages', 'Analyze Competitor Pages')
connect('Read Competitor Pages', 'Find Blocked Pages'); connect('Find Blocked Pages', 'Any Blocked?')
connect('Any Blocked?', 'Blocked Page Items', 0); connect('Blocked Page Items', 'Retry Blocked Pages'); connect('Retry Blocked Pages', 'Analyze Competitor Pages')
connect('Any Blocked?', 'Analyze Competitor Pages', 1)
log('Competitor reads: pages blocked by bot protection are retried through Jina browser engine + proxy pool and merged before analysis')
# API-mode delivery: form "completion" nodes only for form runs; callbacks otherwise
bdp = pos('Build Description Page')
if_node('Via Webhook (Describe)?', "{{ !!$json.via_webhook }}", [bdp[0] + 200, bdp[1]])
add_node('Build Describe Response', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Build_Describe_Response.js')}, [bdp[0] + 400, bdp[1] - 160])
disconnect('Build Description Page', 'Show Description')
connect('Build Description Page', 'Via Webhook (Describe)?'); connect('Via Webhook (Describe)?', 'Build Describe Response', 0); connect('Via Webhook (Describe)?', 'Show Description', 1); connect('Build Describe Response', 'Has Callback?')
api_ = pos('Attach PDF Ideas')
if_node('Via Webhook (Ideas)?', "{{ !!$json.via_webhook }}", [api_[0] + 200, api_[1] - 160])
add_node('Build Ideas Response', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Build_Ideas_Response.js')}, [api_[0] + 400, api_[1] - 320])
disconnect('Attach PDF Ideas', 'Download Keyword Ideas')
connect('Attach PDF Ideas', 'Via Webhook (Ideas)?'); connect('Via Webhook (Ideas)?', 'Build Ideas Response', 0); connect('Via Webhook (Ideas)?', 'Download Keyword Ideas', 1); connect('Build Ideas Response', 'Has Callback?')
apa = pos('Attach PDF Audit')
if_node('Via Webhook (Audit)?', "{{ !!$json.via_webhook }}", [apa[0] + 200, apa[1] + 160])
add_node('Build Audit Response', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Build_Audit_Response.js')}, [apa[0] + 400, apa[1] + 160])
connect('Attach PDF Audit', 'Via Webhook (Audit)?'); connect('Via Webhook (Audit)?', 'Build Audit Response', 0); connect('Build Audit Response', 'Has Callback?')
patch('Build Webhook Response', "    status: 'completed',\n    request_id: d.request_id || null,", "    status: 'completed',\n    stage: 'content',\n    request_id: d.request_id || null,")
log('API mode: describe, discover and audit runs deliver through the callback (stage: site_description / keyword_strategy / site_audit / full_report / content) instead of hitting form-only nodes')


# =============================================================================
# 8i. live-test round 2: API callers deliver via callback, so e-mail is only mandatory when there is no callback;
#     validation errors keep callback_url / request_id so the rejection can be delivered; audit e-mail only when an address exists
# =============================================================================
patch('Normalize Input', "if (mode === 'audit' && !email) throw new Error('Email is required — the audit report is sent by email.');",
      "const deliverable = !!email || (via_webhook && !!callback_url);   // a callback is a valid delivery channel for API callers\nif (mode === 'audit' && !deliverable) throw new Error('Email is required — the audit report is sent by email.');")
patch('Normalize Input', "if (mode === 'discover' && (include_content || include_seo_report || include_audit) && !email) {", "if (mode === 'discover' && (include_content || include_seo_report || include_audit) && !deliverable) {")
patch('Normalize Input', "if (via_webhook && include_audit && !email) throw new Error('Audits requested via the API need an email address.');", "")
patch('Normalize Input', "  return [{ json: { validation_error: String(e && e.message || e).replace(/^Error:\\s*/, ''), via_webhook: __via_webhook, mode: null, brand: 'Dev SEO' } }];",
      "  // keep the delivery fields so the rejection can still be reported to the caller\n  let __raw = {}; try { const r = $input.first().json || {}; __raw = (r.body && typeof r.body === 'object' && !Array.isArray(r.body)) ? r.body : r; } catch (e2) {}\n  const __cb = String(__raw.callback_url || '').trim();\n  const __cbOk = /^(https:\\/\\/[^\\s]+|http:\\/\\/(localhost|127\\.0\\.0\\.1|host\\.docker\\.internal|n8n)(:\\d+)?\\/[^\\s]*)$/.test(__cb) ? __cb : '';\n  return [{ json: { validation_error: String(e && e.message || e).replace(/^Error:\\s*/, ''), via_webhook: __via_webhook, mode: null, brand: 'Dev SEO', callback_url: __cbOk, request_id: String(__raw.request_id || ''), email: String(__raw.email || '').trim().toLowerCase() } }];")
sar = pos('Send Audit Report')
if_node('Has Email (Audit)?', "{{ !!$json.email }}", [sar[0] - 200, sar[1] + 160])
disconnect('Attach PDF Audit', 'Send Audit Report')
connect('Attach PDF Audit', 'Has Email (Audit)?'); connect('Has Email (Audit)?', 'Send Audit Report', 0)
log('Delivery rules: API callers may rely on the callback alone (e-mail optional); rejections keep callback_url/request_id; audit e-mail only when an address was given')

setcode('Parse Analysis', rd('code/Parse_Analysis.js'))
log('Live-test round 3: recommended length clamped by page type (900-2,400 service/landing, 1,200-3,000 guides); 6-9 sections; copywriter/editor forbid production notes and length overrun; QA strips pre-H1 notes, matches keyword/term variants, trusts government and vendor sources, fails pages >25% off target; one editor pass; Opus at medium effort')

# =============================================================================
# 10. KEYWORD LADDER — "Rank my site for a keyword" mode, discovery choice step, rank-tracker registration (Data Tables),
#     optional WordPress drafts. Decisions (2026-10-01): weekly tracking, next rung = recommend only, store = n8n Data Tables,
#     1 page written per run (up to 3), WordPress off by default (CONFIG.wordpress_publish).
# =============================================================================
from ladder_common import LADDER_TABLE, HISTORY_TABLE, LADDER_COLS, HISTORY_COLS, DT_TYPE, DT_VERSION, dt_create_params, dt_insert_params

# ---------- A. intake: new start option, form page, normalisation ----------
nodes['Start Form']['parameters']['formFields']['values'][0]['fieldOptions']['values'].append({'option': 'Rank my site for a keyword'})
nodes['Start Form']['parameters']['formDescription'] += ' Or name the keyword you want to rank for and get a step-by-step ladder of pages: the first page written now, positions tracked weekly.'
nodes['Choose Path']['parameters']['rules']['values'].append({'conditions': {'options': {'caseSensitive': False, 'leftValue': '', 'typeValidation': 'strict', 'version': 3}, 'conditions': [{'id': nid('Choose Path:ladder'), 'leftValue': "={{ $json['What do you want?'] }}", 'rightValue': 'Rank my site for a keyword', 'operator': {'type': 'string', 'operation': 'equals'}}], 'combinator': 'and'}, 'renameOutput': True, 'outputKey': 'ladder'})
conns['Choose Path']['main'].insert(5, [{'node': 'Page Ladder', 'type': 'main', 'index': 0}])
COUNTRY_FIELD = copy.deepcopy(next(f for f in nodes['Page Keyword']['parameters']['formFields']['values'] if f['fieldLabel'] == 'Target Country'))
add_node('Page Ladder', 'n8n-nodes-base.form', 2.5, {'formFields': {'values': [
    {'fieldLabel': 'Keyword you want to rank for', 'placeholder': 'e.g. e invoicing in uae — the destination, not necessarily the first page we write', 'requiredField': True},
    {'fieldLabel': 'Website Domain', 'placeholder': 'example.com (required: the ladder is planned for your site)', 'requiredField': True},
    COUNTRY_FIELD,
    {'fieldLabel': 'What does your business do?', 'placeholder': 'e.g. We implement e-invoicing and ERP software for UAE companies'},
    {'fieldLabel': 'Who are your customers?', 'placeholder': 'e.g. SMEs, finance teams, accountants'},
    copy.deepcopy(FACTS), copy.deepcopy(GOAL), copy.deepcopy(TONE), copy.deepcopy(CTA),
    {'fieldLabel': 'Pages to write now', 'fieldType': 'dropdown', 'fieldOptions': {'values': [{'option': '1 (recommended)'}, {'option': '2'}, {'option': '3'}]}},
    {'fieldLabel': 'Email me the plan and the pages', 'fieldType': 'email', 'placeholder': 'Required: the plan takes 5-8 minutes, each page 8-12 minutes; everything is e-mailed', 'requiredField': True}
]}, 'options': {'formTitle': 'Rank my site for a keyword', 'formDescription': 'We check whether the keyword is realistic for your site, plan a ladder of 8-12 pages from winnable long-tail terms up to the destination, write the first page now and track positions every week.'}}, [448, 560])
connect('Page Ladder', 'Normalize Input')
nodes['Unmatched Choice']['parameters']['jsCode'] = "throw new Error('Please choose one of the 6 options (I know my keyword / Suggest keywords / Just describe my website / Audit my website / Check if my keyword is right / Rank my site for a keyword).');"
patch('Normalize Input', "  ai_budget_period: 'day'           // 'day' | 'month' — daily window while testing; the Anthropic Console workspace limit is the hard cap\n};",
      "  ai_budget_period: 'day',          // 'day' | 'month' — daily window while testing; the Anthropic Console workspace limit is the hard cap\n  ladder_pages_default: 1,          // ladder mode: pages written immediately (1-3; each page is its own content run)\n  ladder_tracker_cadence: 'weekly', // the Rank Tracker workflow runs weekly; 'monthly' is documentation only until its schedule is changed\n  ladder_auto_next_rung: false,     // false = the tracker recommends the next rung (one-click form link + API body); true is not wired\n  wordpress_publish: false          // true + wordpress_url in the request = every generated page is also created as a WordPress DRAFT\n};")
patch('Normalize Input', "else if (choice.includes('audit')) mode = 'audit';", "else if (choice.includes('audit')) mode = 'audit';\nelse if (choice.includes('rank my site') || choice.includes('ladder')) mode = 'ladder';")
patch('Normalize Input', "  else if (m === 'describe') mode = 'site_description';", "  else if (m === 'describe') mode = 'site_description';\n  else if (m === 'ladder') mode = 'ladder';")
patch('Normalize Input', "let existing_page_url = String(pick(p2, 'existing') || '').trim();",
      "const pagesRaw = parseInt(String(pick(p2, 'pages to write') || p2.pages_now || CONFIG.ladder_pages_default), 10);\nconst pages_now = Math.min(3, Math.max(1, isNaN(pagesRaw) ? CONFIG.ladder_pages_default : pagesRaw));\nconst ladder_links = Array.isArray(p2.ladder_links) ? p2.ladder_links.filter(l => l && l.url).slice(0, 20) : [];\nconst wordpress_url = String(p2.wordpress_url || '').trim();\nlet existing_page_url = String(pick(p2, 'existing') || '').trim();")
patch('Normalize Input', "} else if (mode === 'keyword' || mode === 'discover') {", "} else if (mode === 'ladder') {\n  include_seo_report = true; include_content = true;   // used by the page runs the ladder spawns (mode keyword)\n} else if (mode === 'keyword' || mode === 'discover') {")
patch('Normalize Input', "if (mode === 'audit' && !deliverable) throw new Error('Email is required — the audit report is sent by email.');",
      "if (mode === 'audit' && !deliverable) throw new Error('Email is required — the audit report is sent by email.');\nif (mode === 'ladder' && !keyword) throw new Error('Please enter the keyword you want to rank for.');\nif (mode === 'ladder' && !domain) throw new Error('Website Domain is required: the ladder is planned for your site.');\nif (mode === 'ladder' && !deliverable) throw new Error('Please add your email — the ladder plan and the pages are sent by email.');")
patch('Normalize Input', "  (mode === 'keyword' && !!domain && !business);", "  (mode === 'keyword' && !!domain && !business) ||\n  (mode === 'ladder' && !business);")
patch('Normalize Input', "    run_page_check: domain !== '' && (features.some(f => f.includes('page exists')) || !!existing_page_url),",
      "    run_page_check: domain !== '' && (features.some(f => f.includes('page exists')) || !!existing_page_url || mode === 'ladder'),\n    pages_now,\n    ladder_id: String(p2.ladder_id || (mode === 'ladder' ? 'lad_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) : '')),\n    ladder_rung: (p2.ladder_rung != null && p2.ladder_rung !== '') ? Number(p2.ladder_rung) : null,\n    ladder_head: String(p2.ladder_head || ''),\n    ladder_links,\n    force_content: !!p2.force_content,\n    publish_wordpress: !!CONFIG.wordpress_publish && !!wordpress_url,\n    wordpress_url,\n    tracker_cadence: CONFIG.ladder_tracker_cadence,\n    auto_next_rung: !!CONFIG.ladder_auto_next_rung,")
patch('Rate Limit', "const EST = { content: 1.2, discover: 0.35, verdict: 0.2, full: 0.25, site_audit: 0, describe: 0.03 };", "const EST = { content: 1.2, discover: 0.35, verdict: 0.2, full: 0.25, site_audit: 0, describe: 0.03, ladder: 0.55 };   // ladder = verdict + relevance screen; its page runs are separate executions and are counted on their own")
patch('Rate Limit', "else if (d.mode === 'keyword') est = d.verdict_only ? EST.verdict : EST.content;", "else if (d.mode === 'keyword') est = d.verdict_only ? EST.verdict : EST.content;\nelse if (d.mode === 'ladder') est = EST.ladder;")
log('Ladder intake: start option "Rank my site for a keyword" + form page (destination keyword, domain, business, pages to write now 1-3, e-mail); API mode "ladder" with pages_now; CONFIG flags for pages, tracker cadence, auto next rung and WordPress; ladder page runs carry ladder_id / rung / head / links / force_content')

# ---------- B. routing: ladder runs the keyword pipeline on the head term up to the verdict, then branches ----------
nodes['Route Mode']['parameters']['rules']['values'].append({'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'loose', 'version': 3}, 'conditions': [{'id': nid('Route Mode:ladder'), 'leftValue': "={{ $json.mode === 'ladder' }}", 'rightValue': '', 'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}], 'combinator': 'and'}, 'renameOutput': True, 'outputKey': 'ladder'})
conns['Route Mode']['main'].insert(4, [{'node': 'Prepare Keyword Run', 'type': 'main', 'index': 0}])
patch('Prepare Keyword Run', "pipeline_source: d.pipeline_source || (d.mode === 'discover' ? 'discover' : 'form'),", "pipeline_source: d.pipeline_source || (d.mode === 'discover' ? 'discover' : d.mode === 'ladder' ? 'ladder' : (d.ladder_id ? 'ladder_page' : 'form')),")
patch('Collect Site URLs', "const home = ctx.domain ? 'https://' + ctx.domain + '/' : '';",
      "const home = ctx.domain ? 'https://' + ctx.domain + '/' : '';\n// Ladder page runs: the other ladder pages (top page, sibling) are link targets even when they are planned and not live yet\nconst ladderLinks = (ctx.ladder_links || []).filter(l => l && l.url).map(l => ({ url: l.url, path: l.path || (String(l.url).replace(/^https?:\\/\\/[^\\/]+/i, '') || '/'), ladder: l.role || 'ladder', about: l.keyword || '', planned: !!l.planned }));\nconst ladderUrls = new Set(ladderLinks.map(l => String(l.url).replace(/\\/$/, '')));\nconst candidates2 = candidates.filter(c => !ladderUrls.has(String(c.url).replace(/\\/$/, '')));")
patch('Collect Site URLs', "    internal_link_candidates: home ? [{ url: home, path: '/' }, ...candidates] : candidates,", "    internal_link_candidates: [...(home ? [{ url: home, path: '/' }] : []), ...ladderLinks.filter(l => String(l.url).replace(/\\/$/, '') !== home.replace(/\\/$/, '')), ...candidates2],")
vr = nodes['Verdict Router']['parameters']
vr['conditions']['conditions'] = [{'id': nid('Verdict Router:cond'), 'leftValue': "={{ $json.verdict === 'AVOID' && !$json.force_content }}", 'rightValue': '', 'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}]
vr['conditions']['options']['typeValidation'] = 'loose'; vr['looseTypeValidation'] = True
pv = pos('Parse Verdict')
if_node('Ladder Mode?', "{{ $json.mode === 'ladder' }}", [pv[0] + 160, pv[1] + 190])
disconnect('Parse Verdict', 'Verdict Router')
connect('Parse Verdict', 'Ladder Mode?'); connect('Ladder Mode?', 'Ladder Requests', 0); connect('Ladder Mode?', 'Verdict Router', 1)
log('Ladder routing: Route Mode sends ladder runs into the keyword pipeline (sitemap, client pages, SERP, competitors, keyword data, site authority, verdict on the head term); "Ladder Mode?" after Parse Verdict branches into the ladder chain; rung page runs force content even on an AVOID verdict and may link to planned ladder pages')

# ---------- C. ladder chain: research -> pool -> AI relevance -> plan -> report -> PDF -> Data Tables -> delivery + page runs ----------
LEDGER_L = LEDGER.replace("'AI SERP', 'Ask LLMs'];", "'AI SERP', 'Ask LLMs', 'Facts SERP', 'Site Authority', 'Run Research', 'Run Competitor Keywords', 'AI Demand', 'Run Ladder Research'];").replace("'Editor', 'Content Reviewer'];", "'Editor', 'Content Reviewer', 'Keyword Relevance', 'Ladder Keyword Relevance', 'Critic'];")
LX, LY = pv[0] - 400, pv[1] + 760
X = LX
add_node('Ladder Requests', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Ladder_Requests.js')}, [X, LY]); X += 220
add_node('Run Ladder Research', 'n8n-nodes-base.httpRequest', 4.5, DFS_HTTP(), [X, LY], {'onError': 'continueRegularOutput', 'retryOnFail': True, 'maxTries': 2, 'waitBetweenTries': 3000}); X += 220
add_node('Ladder Pool', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Ladder_Pool.js')}, [X, LY]); X += 220
add_node('Ladder Relevance Chunks', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Relevance_Chunks.js')}, [X, LY]); X += 220
agent_bundle('Ladder Keyword Relevance', 'keyword_relevance.txt', 'Claude — Ladder Relevance', 'claude-sonnet-5-5', 'Claude Sonnet 5.5', 16384, 'low', 'Parser — Ladder Relevance',
  {'type': 'object', 'properties': {'items': {'type': 'array', 'items': {'type': 'object', 'properties': {'keyword': {'type': 'string'}, 'relevance': {'type': 'number'}, 'intent': {'type': 'string'}, 'page_type': {'type': 'string'}, 'topic': {'type': 'string'}}, 'required': ['keyword', 'relevance']}}}, 'required': ['items']}, [X, LY]); X += 260
add_node('Ladder Plan', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Ladder_Plan.js')}, [X, LY]); X += 220
add_node('Build Ladder Report', 'n8n-nodes-base.code', 2, {'jsCode': LEDGER_L + rd('code/Build_Ladder_Report.js')}, [X, LY]); X += 220
for a, b in [('Ladder Requests', 'Run Ladder Research'), ('Run Ladder Research', 'Ladder Pool'), ('Ladder Pool', 'Ladder Relevance Chunks'), ('Ladder Relevance Chunks', 'Ladder Keyword Relevance'), ('Ladder Keyword Relevance', 'Ladder Plan'), ('Ladder Plan', 'Build Ladder Report')]:
    connect(a, b)
add_pdf_chain('Build Ladder Report', 'Ladder', [])
apl = pos('Attach PDF Ladder'); X, Y = apl[0] + 220, apl[1]
add_node('Ensure Ladder Table', DT_TYPE, DT_VERSION, dt_create_params(LADDER_TABLE, LADDER_COLS), [X, Y], {'onError': 'continueRegularOutput'}); X += 220
add_node('Ensure History Table', DT_TYPE, DT_VERSION, dt_create_params(HISTORY_TABLE, HISTORY_COLS), [X, Y], {'onError': 'continueRegularOutput'}); X += 220
add_node('Ladder Rows', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Ladder_Rows.js')}, [X, Y]); X += 220
add_node('Save Ladder Rows', DT_TYPE, DT_VERSION, dt_insert_params(LADDER_TABLE, LADDER_COLS), [X, Y], {'onError': 'continueRegularOutput'}); X += 220
add_node('Ladder Delivery', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Ladder_Delivery.js')}, [X, Y]); X += 220
for a, b in [('Attach PDF Ladder', 'Ensure Ladder Table'), ('Ensure Ladder Table', 'Ensure History Table'), ('Ensure History Table', 'Ladder Rows'), ('Ladder Rows', 'Save Ladder Rows'), ('Save Ladder Rows', 'Ladder Delivery')]:
    connect(a, b)
# delivery: page runs (separate executions), e-mail, download (form) or callback (API)
add_node('Spawn Page Runs', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Spawn_Page_Runs.js')}, [X, Y - 200])
add_node('Start Page Runs', 'n8n-nodes-base.executeWorkflow', 1.2, {'source': 'database', 'workflowId': {'__rl': True, 'mode': 'id', 'value': 'SEOagentV4Full01'}, 'mode': 'each', 'options': {'waitForSubWorkflow': False}}, [X + 220, Y - 200], {'onError': 'continueRegularOutput'})
if_node('Has Email (Ladder)?', "{{ !!$json.email }}", [X, Y])
slr = copy.deepcopy(nodes['Send Report']); slr['name'] = 'Send Ladder Report'; slr['id'] = nid('Send Ladder Report'); slr['position'] = [X + 220, Y]
slr['parameters']['subject'] = '=Your keyword ladder plan for "{{ $json.keyword }}" — {{ $json.brand }}'
slr['parameters']['html'] = ("=<p>Hi,</p><p>Your <b>keyword ladder plan</b> for <b>{{ String($json.keyword).replace(/&/g, '&amp;').replace(/</g, '&lt;') }}</b> on <b>{{ $json.domain }}</b> ({{ $json.country }}) is attached.</p>"
    "<p>{{ $json.qa_summary }}. {{ ($json.ladder && $json.ladder.feasibility) ? 'Destination: ' + $json.ladder.feasibility.status + ' (verdict ' + $json.ladder.feasibility.verdict + ($json.ladder.feasibility.score != null ? ', ' + $json.ladder.feasibility.score + '/100' : '') + ').' : '' }}</p>"
    "<p>{{ ($json.ladder && $json.ladder.write_now && $json.ladder.write_now.length) ? 'The first page(s) — ' + $json.ladder.write_now.map(w => '\"' + w.keyword + '\"').join(', ') + ' — are being written now and arrive as separate e-mails within about 15 minutes.' : '' }}</p>"
    "<p>{{ $json.tracking_registered ? 'Positions are checked weekly; you will receive a progress e-mail with the next rung to work on.' : 'Note: the ladder could not be registered for tracking (' + ($json.store_error || 'Data Tables unavailable') + ').' }}</p><p>Regards,<br>{{ $json.brand }}</p>")
nodes['Send Ladder Report'] = slr
if_node('Via Webhook (Ladder)?', "{{ !!$json.via_webhook }}", [X, Y + 200])
add_node('Build Ladder Response', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Build_Ladder_Response.js')}, [X + 220, Y + 200])
add_node('Download Ladder Plan', 'n8n-nodes-base.form', 2.5, {'operation': 'completion', 'respondWith': 'returnBinary', 'completionTitle': 'Your keyword ladder plan is ready', 'completionMessage': 'The plan is downloading. The first page is being written now and will be e-mailed within about 15 minutes; positions are checked weekly.', 'options': {}, 'inputDataFieldName': "={{ $binary.pdf ? 'pdf' : 'data' }}"}, [X + 220, Y + 380])
connect('Ladder Delivery', 'Spawn Page Runs'); connect('Spawn Page Runs', 'Start Page Runs')
connect('Ladder Delivery', 'Has Email (Ladder)?'); connect('Has Email (Ladder)?', 'Send Ladder Report', 0)
connect('Ladder Delivery', 'Via Webhook (Ladder)?'); connect('Via Webhook (Ladder)?', 'Build Ladder Response', 0); connect('Via Webhook (Ladder)?', 'Download Ladder Plan', 1); connect('Build Ladder Response', 'Has Callback?')
# page runs carry the ladder id into their report, e-mail and callback
patch('Build Word File', "    keyword_data: d.keyword_data || null\n  },\n  binary: {", "    keyword_data: d.keyword_data || null,\n    ladder_id: d.ladder_id || '', ladder_rung: d.ladder_rung ?? null, ladder_head: d.ladder_head || '',\n    publish_wordpress: !!d.publish_wordpress, wordpress_url: d.wordpress_url || '',\n    page_markdown: d.publish_wordpress ? md : undefined, content_brief_slug: brief.slug || '', schema_blocks: d.publish_wordpress ? schemaBlocks : undefined\n  },\n  binary: {")
patch('Build Webhook Response', "    stage: 'content',\n", "    stage: 'content',\n    ladder_id: d.ladder_id || null,\n    ladder_rung: d.ladder_rung ?? null,\n    ladder_head: d.ladder_head || null,\n")
sr = nodes['Send Report']['parameters']; assert sr['html'].count('<p>Regards,<br>{{ $json.brand }}</p>') == 1
sr['html'] = sr['html'].replace('<p>Regards,<br>{{ $json.brand }}</p>', "{{ $json.ladder_id ? '<p><b>Keyword ladder:</b> this page is rung ' + $json.ladder_rung + ' on the way to \"' + String($json.ladder_head).replace(/</g, '&lt;') + '\". Publish it at the planned URL; its position is checked weekly.</p>' : '' }}<p>Regards,<br>{{ $json.brand }}</p>")
log('Ladder chain: 4 DataForSEO pulls around the head term (long-tail, related, ideas for head + services, keywords the site ranks for) -> topic-filtered pool with opportunity score -> AI relevance screen anchored on the head term -> rung assignment by difficulty (1: <=25 long-tail, 2: 26-45, 3: 46-60, top = head), one page per topic cluster (2-4 per rung, 8-12 pages), existing-page matching, internal link map (up / sideways / down), timeline in months, feasibility with alternative tops, link and trust requirements -> Keyword Ladder Plan (PDF + Word) -> rows into Data Table "seo_ladders" (tables created on first use) -> e-mail / download / callback (stage ladder_plan) -> the first page(s) start as separate content runs tagged with the ladder')

# ---------- D. discovery choice step (form only) ----------
bks = pos('Build Keyword Strategy')
nodes['Build Keyword File']['position'] = [bks[0] + 880, bks[1]]
if_node('Choice Step?', "{{ !$json.via_webhook && !!($json.include_content || $json.include_seo_report) && (($json.choice_options || []).length > 1) }}", [bks[0] + 220, bks[1]])
add_node('Choose Keyword', 'n8n-nodes-base.form', 2.5, {'defineForm': 'json', 'jsonOutput': "={{ JSON.stringify([{ fieldLabel: 'Which keyword should we write for?', fieldType: 'dropdown', fieldOptions: { values: ($json.choice_options || []).map(o => ({ option: o })) }, requiredField: true }]) }}",
  'options': {'formTitle': 'Choose your keyword', 'formDescription': "={{ 'Your keyword strategy is ready (the report follows). Pick the keyword for the page we write now, or let the system choose for your goal. System suggestion: ' + ((($json.keyword_strategy || {}).pipeline_keyword) ? '\"' + $json.keyword_strategy.pipeline_keyword.keyword + '\" — ' + ($json.keyword_strategy.pipeline_keyword.why || '') : 'none') }}", 'buttonLabel': 'Write this one'}}, [bks[0] + 440, bks[1] - 160])
add_node('Apply Choice', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Apply_Choice.js')}, [bks[0] + 660, bks[1] - 160])
disconnect('Build Keyword Strategy', 'Build Keyword File')
connect('Build Keyword Strategy', 'Choice Step?'); connect('Choice Step?', 'Choose Keyword', 0); connect('Choose Keyword', 'Apply Choice'); connect('Apply Choice', 'Build Keyword File'); connect('Choice Step?', 'Build Keyword File', 1)
log('Discovery choice step (form only): after the keyword strategy, a "Choose your keyword" page lists the priority keywords (keyword · searches/mo · difficulty · intent · page type) plus "Let the system choose"; the pick replaces the pipeline keyword and is shown in the report. API callers keep choosing through mode keyword / ladder')

# ---------- E. optional WordPress drafts (sub-workflow "SEO Agent — Publish to WordPress", off unless CONFIG.wordpress_publish + wordpress_url) ----------
apr = pos('Attach PDF Report')
if_node('Publish To WordPress?', "{{ !!$json.publish_wordpress && !!$json.wordpress_url && !!$json.page_markdown }}", [apr[0] + 220, apr[1] + 160])
add_node('Publish WordPress Draft', 'n8n-nodes-base.executeWorkflow', 1.2, {'source': 'database', 'workflowId': {'__rl': True, 'mode': 'id', 'value': 'SEOagentWordPres'}, 'mode': 'once', 'options': {'waitForSubWorkflow': False}}, [apr[0] + 440, apr[1] + 160], {'onError': 'continueRegularOutput'})
connect('Attach PDF Report', 'Publish To WordPress?'); connect('Publish To WordPress?', 'Publish WordPress Draft', 0)
log('WordPress (optional, off): finished pages can be created as WordPress drafts (title, slug, excerpt, HTML, JSON-LD, Yoast/RankMath meta) through the sub-workflow SEOagentWordPres; enable with CONFIG.wordpress_publish and a wordpress_url in the request, and attach the "WordPress (SEO Agent)" credential')

# ---------- AI budget cap: 3 → 10 on 2026-10-01 to finish the system test; set to 6 on 2026-10-02 at the user's request ----------
patch('Normalize Input', "  ai_budget_usd: 3,                 // estimated Claude spend allowed per budget period (see Rate Limit); raise when ready",
      "  ai_budget_usd: 6,                 // estimated Claude spend allowed per budget period (see Rate Limit); 3 → 10 on 2026-10-01 for the system test, 6 since 2026-10-02 at the user's request — the Anthropic Console workspace limit is the hard cap")

# ---------- credential slots for the nodes created in this section (the generic pass in 8c-E ran before they existed) ----------
for n in list(nodes.values()):
    p = n['parameters']
    if n['type'] == 'n8n-nodes-base.httpRequest' and p.get('authentication') == 'genericCredentialType':
        url = str(p.get('url', ''))
        if p.get('genericAuthType') == 'httpBasicAuth': slot(n['name'], 'dataforseo')
        elif 'jina.ai' in url: slot(n['name'], 'jina')
        elif 'googleapis' in url: slot(n['name'], 'psi')
    if n['type'] == '@n8n/n8n-nodes-langchain.lmChatAnthropic': slot(n['name'], 'anthropic')
assert nodes['Claude — Ladder Relevance'].get('credentials') and nodes['Run Ladder Research'].get('credentials'), 'ladder credential slots missing'
# every model node and every DataForSEO/Jina/PageSpeed HTTP node must carry a credential slot, or the live run fails at that node
for n in nodes.values():
    if n['type'] == '@n8n/n8n-nodes-langchain.lmChatAnthropic': assert n.get('credentials'), 'model without credential: ' + n['name']
    if n['type'] == 'n8n-nodes-base.httpRequest' and n['parameters'].get('authentication') == 'genericCredentialType': assert n.get('credentials'), 'http node without credential: ' + n['name']

# ---------- F. notes ----------
nodes['Note 1']['parameters']['content'] = nodes['Note 1']['parameters']['content'].replace("**Modes:** I know my keyword · Suggest keywords · Describe my website · Audit my website · Check if my keyword is right.", "**Modes:** I know my keyword · Suggest keywords · Describe my website · Audit my website · Check if my keyword is right · **Rank my site for a keyword** (ladder).")
sticky("""### Keyword ladder ("Rank my site for a keyword", API mode `ladder`)
The head term runs through the keyword pipeline up to the **Verdict** (feasibility, site authority, alternatives). Then: 4 DataForSEO pulls around the head term -> topic-filtered pool with opportunity score -> **AI relevance** anchored on the head term -> **rungs by difficulty** (1: <=25 long-tail, 2: 26-45, 3: 46-60, top = head), one page per topic cluster, 8-12 pages, existing pages matched from the sitemap and current rankings -> **internal link map** (up / sideways / down) -> timeline -> **Keyword Ladder Plan** (PDF + Word).
Rows go to the Data Table `seo_ladders` (created on first use); the **Rank Tracker** workflow checks positions weekly, writes `seo_rank_history` and e-mails the next rung (recommend-only). The first page(s) start as separate content runs (`Start Page Runs` -> API Entry) tagged with ladder_id / rung, and link to the planned top page and sibling. WordPress drafts: sub-workflow `SEOagentWordPres`, off by default.""", LX - 60, LY - 360, 980, 300, 5)


# =============================================================================
# 11. FORM FLOWS — live finding (2026-10-01): a Form "completion" page ENDS the execution; branches still queued never run.
#     So every follow-up that must happen after a download/"started" page runs as its own execution (API Entry), and the
#     completion node is always the last step of a form flow.
# =============================================================================
SELF_RUN = lambda name, pos_, mode='each': add_node(name, 'n8n-nodes-base.executeWorkflow', 1.2, {'source': 'database', 'workflowId': {'__rl': True, 'mode': 'id', 'value': 'SEOagentV4Full01'}, 'mode': mode, 'options': {'waitForSubWorkflow': False}}, pos_, {'onError': 'continueRegularOutput'})
# --- discovery follow-ups (keyword report / content for the chosen keyword, site audit) ---
for old in ['Discover Extras?', 'Discover Audit?', 'Seed From Suggestion']:
    for src in list(conns.keys()): disconnect(src, old)
    del nodes[old]; conns.pop(old, None)
api_ = pos('Attach PDF Ideas')
add_node('Spawn Follow-ups', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Spawn_Followups.js')}, [api_[0] + 200, api_[1] - 420])
SELF_RUN('Start Follow-up Runs', [api_[0] + 420, api_[1] - 420])
conns['Attach PDF Ideas']['main'][0].insert(0, {'node': 'Spawn Follow-ups', 'type': 'main', 'index': 0})   # first in order, and topmost on the canvas
connect('Spawn Follow-ups', 'Start Follow-up Runs')
patch('Normalize Input', "    pages_now,\n", "    pages_now,\n    pipeline_source: String(p2.pipeline_source || ''),\n    chosen_keyword_reason: String(p2.chosen_keyword_reason || '').slice(0, 300),\n")
# --- audit through the form: spawn the audit, show "started" at once ---
for src in list(conns.keys()): disconnect(src, 'From Audit Form?')
del nodes['From Audit Form?']; conns.pop('From Audit Form?', None)
sc_ = pos('Start Crawl')
if_node('Audit Via Form?', "{{ !$json.via_webhook }}", [sc_[0] - 240, sc_[1] + 200])
add_node('Spawn Audit Run', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Spawn_Audit_Run.js')}, [sc_[0] - 40, sc_[1] + 330])
SELF_RUN('Start Audit Run', [sc_[0] + 180, sc_[1] + 330], 'once')
nodes['Audit Started']['position'] = [sc_[0] + 400, sc_[1] + 330]
nodes['Audit Started']['parameters']['completionMessage'] = "=We are now auditing {{ $('Normalize Input').first().json.domain }}. This usually takes 5–15 minutes. Your report will be emailed to {{ $('Normalize Input').first().json.email }} as soon as it is ready. You can close this page."
rm_outs = conns['Route Mode']['main']; rm_outs[3] = [{'node': 'Audit Via Form?', 'type': 'main', 'index': 0}]
connect('Audit Via Form?', 'Spawn Audit Run', 0); connect('Spawn Audit Run', 'Start Audit Run'); connect('Start Audit Run', 'Audit Started')
connect('Audit Via Form?', 'Start Crawl', 1)
# --- estimates: follow-ups are counted by their own executions; a report-only keyword run is cheaper than a content run ---
patch('Rate Limit', "describe: 0.03, ladder: 0.55 };", "describe: 0.03, ladder: 0.55, report: 0.3 };")
patch('Rate Limit', "else if (d.mode === 'discover') est = EST.discover + (d.include_content ? EST.content : 0) + (d.include_full_report ? EST.full : 0);", "else if (d.mode === 'discover') est = EST.discover;   // report / content / audit follow-ups run as their own executions and are counted there")
patch('Rate Limit', "else if (d.mode === 'keyword') est = d.verdict_only ? EST.verdict : EST.content;", "else if (d.mode === 'keyword') est = d.verdict_only ? EST.verdict : (d.include_content ? EST.content : EST.report);")
# --- the WordPress gate must run before the e-mail / download step (order follows canvas position) ---
apr_ = pos('Attach PDF Report')
nodes['Publish To WordPress?']['position'] = [apr_[0] + 220, apr_[1] - 220]; nodes['Publish WordPress Draft']['position'] = [apr_[0] + 440, apr_[1] - 220]
conns['Attach PDF Report']['main'][0].sort(key=lambda t: {'Publish To WordPress?': 0, 'Has Email?': 1, 'Deliver Via Download?': 2}.get(t['node'], 9))
for n in nodes.values():
    if n['type'] == 'n8n-nodes-base.stickyNote' and 'Keyword discovery ("Suggest keywords")' in n['parameters']['content']:
        n['parameters']['content'] = n['parameters']['content'].replace("The goal-fit keyword feeds the content pipeline when the user also asked for content.", "**Form users** pick the keyword on the \"Choose your keyword\" page. Report / content / audit follow-ups start as **separate executions** (Spawn Follow-ups → API Entry) because a form completion page ends the execution it is in; the download page is therefore the last step, and API callers get one callback per stage with the same request_id.")
log('Form flows: a Form completion page ends the execution (live finding), so discovery follow-ups (keyword report / content for the chosen keyword, site audit) and form-requested audits now run as separate executions through API Entry; the download / "audit started" page is always the last step; WordPress gate ordered before the delivery step; Rate Limit estimates per execution (report-only keyword run $0.30)')


# =============================================================================
# 12. SITE TRACKING (v4.3) — "Track my site" (form option + API mode "track"): registers the site in the Data Table seo_sites and starts the
#     Site Tracker workflow at once (Search Console, GA4, Google Trends, live SERP checks; weekly e-mail / callback, see build_site_tracker.py).
#     Domains with a keyword ladder are tracked automatically by the Site Tracker; nothing to register for them.
# =============================================================================
from ladder_common import SITES_TABLE, SITES_COLS, dt_upsert_params
nodes['Start Form']['parameters']['formFields']['values'][0]['fieldOptions']['values'].append({'option': 'Track my site (rankings & traffic)'})
nodes['Start Form']['parameters']['formDescription'] += ' Or track your site: real Search Console and Analytics data every week, with the next actions.'
nodes['Choose Path']['parameters']['rules']['values'].append({'conditions': {'options': {'caseSensitive': False, 'leftValue': '', 'typeValidation': 'strict', 'version': 3}, 'conditions': [{'id': nid('Choose Path:track'), 'leftValue': "={{ $json['What do you want?'] }}", 'rightValue': 'Track my site (rankings & traffic)', 'operator': {'type': 'string', 'operation': 'equals'}}], 'combinator': 'and'}, 'renameOutput': True, 'outputKey': 'track'})
conns['Choose Path']['main'].insert(6, [{'node': 'Page Track', 'type': 'main', 'index': 0}])
add_node('Page Track', 'n8n-nodes-base.form', 2.5, {'formFields': {'values': [
    {'fieldLabel': 'Website Domain', 'placeholder': 'example.com', 'requiredField': True},
    copy.deepcopy(COUNTRY_FIELD),
    {'fieldLabel': 'Search terms to track (optional)', 'fieldType': 'textarea', 'placeholder': 'One per line, up to 20: the searches you care about. Keyword-ladder terms are tracked automatically.'},
    {'fieldLabel': 'GA4 property ID (optional)', 'placeholder': 'e.g. 123456789 (Analytics → Admin → Property details). Leave empty: it is detected from the site URL once access is granted.'},
    {'fieldLabel': 'Email me the weekly report', 'fieldType': 'email', 'placeholder': 'Required: the first report arrives within minutes, then every Monday', 'requiredField': True}
]}, 'options': {'formTitle': 'Track my site', 'formDescription': 'Every Monday: clicks, impressions, positions and traffic from your own Search Console and Google Analytics, the keywords within reach of page 1, pages losing traffic, whether your new pages are indexed, search trends, and what to do next. The first report explains which Google account to add so real data flows in.'}}, [448, 760])
connect('Page Track', 'Normalize Input')
nodes['Unmatched Choice']['parameters']['jsCode'] = "throw new Error('Please choose one of the 7 options (I know my keyword / Suggest keywords / Just describe my website / Audit my website / Check if my keyword is right / Rank my site for a keyword / Track my site).');"
patch('Normalize Input', "else if (choice.includes('rank my site') || choice.includes('ladder')) mode = 'ladder';", "else if (choice.includes('rank my site') || choice.includes('ladder')) mode = 'ladder';\nelse if (choice.includes('track')) mode = 'track';")
patch('Normalize Input', "  else if (m === 'ladder') mode = 'ladder';", "  else if (m === 'ladder') mode = 'ladder';\n  else if (m === 'track') mode = 'track';")
patch('Normalize Input', "const keyword  = String(pick(p2, 'keyword') || '')", "const keyword  = (mode === 'track' ? '' : String(pick(p2, 'keyword') || ''))")
patch('Normalize Input', "const pagesRaw = parseInt(", "const track_keywords = asArray(pick(p2, 'terms to track') || p2.keywords || p2.track_keywords).flatMap(k => String(k).split(/[\\n,;]+/)).map(k => k.trim().toLowerCase().replace(/\\s+/g, ' ')).filter(Boolean).filter((k, i, a) => a.indexOf(k) === i).slice(0, 20);\nconst ga4_property_id = String(pick(p2, 'ga4') || '').replace(/^properties\\//, '').replace(/[^0-9]/g, '').slice(0, 16);\nconst pagesRaw = parseInt(")
patch('Normalize Input', "if (mode === 'ladder' && !deliverable) throw new Error('Please add your email — the ladder plan and the pages are sent by email.');",
      "if (mode === 'ladder' && !deliverable) throw new Error('Please add your email — the ladder plan and the pages are sent by email.');\nif (mode === 'track' && !domain) throw new Error('Website Domain is required: tracking is set up for your site.');\nif (mode === 'track' && !deliverable) throw new Error('Please add your email — the weekly tracking report is sent by email.');")
patch('Normalize Input', "    pages_now,\n    pipeline_source:", "    pages_now,\n    track_keywords,\n    ga4_property_id,\n    pipeline_source:")
patch('Rate Limit', "describe: 0.03, ladder: 0.55, report: 0.3 };", "describe: 0.03, ladder: 0.55, report: 0.3, track: 0 };   // track: the Site Tracker's brief runs in its own execution (~$0.03 per site per week)")
patch('Rate Limit', "else if (d.mode === 'ladder') est = EST.ladder;", "else if (d.mode === 'ladder') est = EST.ladder;\nelse if (d.mode === 'track') est = EST.track;")
nodes['Route Mode']['parameters']['rules']['values'].append({'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'loose', 'version': 3}, 'conditions': [{'id': nid('Route Mode:track'), 'leftValue': "={{ $json.mode === 'track' }}", 'rightValue': '', 'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}], 'combinator': 'and'}, 'renameOutput': True, 'outputKey': 'track'})
conns['Route Mode']['main'].insert(5, [{'node': 'Ensure Sites Table (Track)', 'type': 'main', 'index': 0}])
rm_ = pos('Route Mode'); TX, TY = rm_[0] + 300, rm_[1] + 1000
add_node('Ensure Sites Table (Track)', DT_TYPE, DT_VERSION, dt_create_params(SITES_TABLE, SITES_COLS), [TX, TY], {'onError': 'continueRegularOutput'})
add_node('Site Row (Track)', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Site_Row_Track.js')}, [TX + 220, TY])
add_node('Save Site (Track)', DT_TYPE, DT_VERSION, dt_upsert_params(SITES_TABLE, SITES_COLS, 'site_id'), [TX + 440, TY], {'onError': 'continueRegularOutput'})
add_node('Tracker Payload (Track)', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Tracker_Payload_Track.js')}, [TX + 660, TY])
add_node('Start Site Tracker', 'n8n-nodes-base.executeWorkflow', 1.2, {'source': 'database', 'workflowId': {'__rl': True, 'mode': 'id', 'value': 'SEOagentSiteTrk1'}, 'mode': 'once', 'options': {'waitForSubWorkflow': False}}, [TX + 880, TY], {'onError': 'continueRegularOutput'})
if_node('Via Webhook (Track)?', "{{ !!$('Normalize Input').first().json.via_webhook }}", [TX + 1100, TY])
add_node('Build Track Response', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Build_Track_Response.js')}, [TX + 1320, TY - 120])
add_node('Tracking Started', 'n8n-nodes-base.form', 2.5, {'operation': 'completion', 'completionTitle': "=Tracking is set up for {{ $('Normalize Input').first().json.domain }}", 'completionMessage': "=Your first performance report is being prepared now and will be e-mailed to {{ $('Normalize Input').first().json.email }} within a few minutes, then every Monday. It tells you which Google account to add to Search Console and Google Analytics so your real search data flows in. You can close this page.", 'options': {}}, [TX + 1320, TY + 120])
for a, b in [('Ensure Sites Table (Track)', 'Site Row (Track)'), ('Site Row (Track)', 'Save Site (Track)'), ('Save Site (Track)', 'Tracker Payload (Track)'), ('Tracker Payload (Track)', 'Start Site Tracker'), ('Start Site Tracker', 'Via Webhook (Track)?'), ('Build Track Response', 'Has Callback?')]:
    connect(a, b)
connect('Via Webhook (Track)?', 'Build Track Response', 0); connect('Via Webhook (Track)?', 'Tracking Started', 1)
nodes['Note 1']['parameters']['content'] = nodes['Note 1']['parameters']['content'].replace("· **Rank my site for a keyword** (ladder).", "· **Rank my site for a keyword** (ladder) · **Track my site** (weekly Search Console / GA4 / Trends report through the Site Tracker workflow).")
sticky("""### Track my site (form option / API mode `track`, v4.3)
Registers the site in the Data Table `seo_sites` (upsert by site id: domain, country, search terms to track, GA4 property id, e-mail / callback) and starts **SEO Agent — Site Tracker** at once for this site; the tracker then runs every Monday. The form ends on "Tracking is set up"; API callers get `stage: site_tracker_setup` and later one `stage: site_tracker` callback per weekly report. Domains with a keyword ladder are tracked automatically.""", TX - 60, TY - 420, 900, 240, 5)
log('Site tracking (v4.3): start option "Track my site (rankings & traffic)" + form page (domain, country, search terms, GA4 property id, e-mail); API mode "track" (keywords, ga4_property_id); rows upserted into seo_sites and the Site Tracker workflow started at once; completion page / callback stage site_tracker_setup')


# =============================================================================
# 13. CONTENT CADENCE + "I PUBLISHED A PAGE" (v4.3): blog package on every content run (article HTML + Markdown + meta.json, CMS-agnostic),
#     configurable blog posts per week per site (seo_cadence; written every Monday by SEO Agent — Content Cadence), published-URL feedback
#     (live publish check, content log, ladder row, link suggestions), internal spawns exempt from the per-address rate limit.
# =============================================================================
from ladder_common import LOG_TABLE, LOG_COLS, CADENCE_TABLE, CADENCE_COLS, QUERY_TABLE, dt_get_all_params, dt_upsert_params_keys, dt_update_params
FORM_URL_MAIN = os.environ.get('N8N_PUBLIC_URL', 'http://localhost:5678').rstrip('/') + '/form/' + nodes['Start Form']['webhookId']
# ---------- A. blog package on every content run ----------
patch('Build Word File', "    page_markdown: d.publish_wordpress ? md : undefined, content_brief_slug: brief.slug || '', schema_blocks: d.publish_wordpress ? schemaBlocks : undefined",
      "    page_markdown: md || undefined, content_brief_slug: brief.slug || '', schema_blocks: schemaBlocks, content_score: qa.content_score == null ? null : qa.content_score, language_name: d.language_name || 'English', language_code: d.language_code || 'en', content_images: Array.isArray(brief.image_suggestions) ? brief.image_suggestions : []")
apr13 = pos('Attach PDF Report')
add_node('Blog Package', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Blog_Package.js')}, [apr13[0] + 110, apr13[1] - 460])
_targets = [t['node'] for t in conns['Attach PDF Report']['main'][0]]
for _t in _targets: disconnect('Attach PDF Report', _t)
connect('Attach PDF Report', 'Blog Package')
for _t in _targets: connect('Blog Package', _t)
nodes['Send Report']['parameters']['options']['attachmentsUi'] = {'attachmentsBinary': [{'property': "={{ ['pdf', 'data', 'article_html', 'article_md', 'meta_json'].filter(k => $binary[k]).join(',') }}"}]}
sr13 = nodes['Send Report']['parameters']; assert sr13['html'].count('<p>Regards,<br>{{ $json.brand }}</p>') == 1
sr13['html'] = sr13['html'].replace('<p>Regards,<br>{{ $json.brand }}</p>', "{{ $json.article_meta ? '<p><b>Ready to publish:</b> the article is attached as <b>' + $json.article_slug + '.html</b> and <b>' + $json.article_slug + '.md</b>, with <b>' + $json.article_slug + '.meta.json</b> (title, slug, meta description, keywords, internal links, schema). Publish it in your CMS, then report the link through the <a href=\"" + FORM_URL_MAIN + "\">form</a> (\"I published a page\") or the API (mode published) so indexing and positions are tracked.</p>' : '' }}<p>Regards,<br>{{ $json.brand }}</p>")
patch('Build Webhook Response', "    emailed_to: d.email || null,", "    markdown: d.page_markdown || null,\n    html: d.article_html || null,\n    meta: d.article_meta || null,\n    emailed_to: d.email || null,")
# ---------- B. internal spawns are not charged against the owner's daily runs; reporting a published page is free ----------
patch('Rate Limit', "const key = (d.email || d.client_ip || d.domain || d.keyword || 'anon').toLowerCase();", "// Internal spawns (ladder page runs, content cadence) are keyed by their marker, not the owner's e-mail: they are capped by the AI budget guard and their own weekly limits.\nconst internal = /^(ladder|cadence|tracker):/.test(String(d.client_ip || ''));\nconst key = (internal ? d.client_ip : (d.email || d.client_ip || d.domain || d.keyword || 'anon')).toLowerCase();")
patch('Rate Limit', "if (used >= LIMITS.per_key_per_day) {", "if (used >= LIMITS.per_key_per_day && d.mode !== 'published') {   // reporting a published page costs nothing and is never blocked")
patch('Rate Limit', "store.rate.keys[key] = used + 1;", "if (d.mode !== 'published') store.rate.keys[key] = used + 1;")
patch('Rate Limit', "describe: 0.03, ladder: 0.55, report: 0.3, track: 0 };", "describe: 0.03, ladder: 0.55, report: 0.3, track: 0, published: 0 };")
patch('Rate Limit', "else if (d.mode === 'track') est = EST.track;", "else if (d.mode === 'track') est = EST.track;\nelse if (d.mode === 'published') est = EST.published;")
# ---------- C. "I published a page": form option, page, normalisation, chain ----------
nodes['Start Form']['parameters']['formFields']['values'][0]['fieldOptions']['values'].append({'option': 'I published a page'})
nodes['Choose Path']['parameters']['rules']['values'].append({'conditions': {'options': {'caseSensitive': False, 'leftValue': '', 'typeValidation': 'strict', 'version': 3}, 'conditions': [{'id': nid('Choose Path:published'), 'leftValue': "={{ $json['What do you want?'] }}", 'rightValue': 'I published a page', 'operator': {'type': 'string', 'operation': 'equals'}}], 'combinator': 'and'}, 'renameOutput': True, 'outputKey': 'published'})
conns['Choose Path']['main'].insert(7, [{'node': 'Page Published', 'type': 'main', 'index': 0}])
add_node('Page Published', 'n8n-nodes-base.form', 2.5, {'formFields': {'values': [
    {'fieldLabel': 'Website Domain', 'placeholder': 'example.com', 'requiredField': True},
    {'fieldLabel': 'Keyword of the page', 'placeholder': 'the keyword the page was written for (as in the e-mail subject)', 'requiredField': True},
    {'fieldLabel': 'Published page URL', 'placeholder': 'https://example.com/blog/your-new-page/', 'requiredField': True}
]}, 'options': {'formTitle': 'I published a page', 'formDescription': 'Tell us where the page went live. We check the live page (title, meta description, H1, canonical, schema, indexability), record it, suggest pages to link from, and the trackers follow its indexing and positions from the next Monday.', 'buttonLabel': 'Record it'}}, [448, 960])
connect('Page Published', 'Normalize Input')
nodes['Unmatched Choice']['parameters']['jsCode'] = "throw new Error('Please choose one of the 8 options (I know my keyword / Suggest keywords / Just describe my website / Audit my website / Check if my keyword is right / Rank my site for a keyword / Track my site / I published a page).');"
patch('Normalize Input', "else if (choice.includes('track')) mode = 'track';", "else if (choice.includes('track')) mode = 'track';\nelse if (choice.includes('published')) mode = 'published';")
patch('Normalize Input', "if (mode !== 'site_description' && !c) throw new Error('Please select a Target Country.');", "if (mode !== 'site_description' && mode !== 'published' && !c) throw new Error('Please select a Target Country.');   // a published-page report needs no market")
patch('Normalize Input', "  else if (m === 'track') mode = 'track';", "  else if (m === 'track') mode = 'track';\n  else if (m === 'published') mode = 'published';")
patch('Normalize Input', "const pagesRaw = parseInt(", "const published_url = String(pick(p2, 'published', 'url') || p2.published_url || p2.url || '').trim();\nconst content_request_id = String(p2.content_request_id || '').trim();\nconst blogs_per_week = Math.min(3, Math.max(0, parseInt(String(pick(p2, 'posts per week') || p2.blogs_per_week || '0'), 10) || 0));\nconst pagesRaw = parseInt(")
patch('Normalize Input', "if (mode === 'track' && !deliverable) throw new Error('Please add your email — the weekly tracking report is sent by email.');",
      "if (mode === 'track' && !deliverable) throw new Error('Please add your email — the weekly tracking report is sent by email.');\nif (mode === 'published' && !domain) throw new Error('Website Domain is required.');\nif (mode === 'published' && !/^https?:\\/\\/\\S+$/i.test(published_url)) throw new Error('Please enter the full URL of the published page (https://...).');\nif (mode === 'published') { const __m = published_url.match(/^https?:\\/\\/(?:[^@\\/?#]*@)?([^\\/?#:]+)/i); const __h = __m ? __m[1].toLowerCase().replace(/^www\\./, '') : ''; if (!(__h === domain || __h.endsWith('.' + domain))) throw new Error('The published URL must be on ' + domain + '.'); }\nif (mode === 'published' && !keyword && !content_request_id) throw new Error('Please enter the keyword of the page (as in the e-mail) or the content request id.');")
patch('Normalize Input', "    track_keywords,\n    ga4_property_id,\n", "    track_keywords,\n    ga4_property_id,\n    blogs_per_week,\n    published_url,\n    content_request_id,\n")
nodes['Route Mode']['parameters']['rules']['values'].append({'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'loose', 'version': 3}, 'conditions': [{'id': nid('Route Mode:published'), 'leftValue': "={{ $json.mode === 'published' }}", 'rightValue': '', 'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}], 'combinator': 'and'}, 'renameOutput': True, 'outputKey': 'published'})
conns['Route Mode']['main'].insert(6, [{'node': 'Ensure Log Table (Published)', 'type': 'main', 'index': 0}])
PX, PY = TX, TY + 420
LOAD13 = {'alwaysOutputData': True, 'executeOnce': True, 'onError': 'continueRegularOutput'}
add_node('Ensure Log Table (Published)', DT_TYPE, DT_VERSION, dt_create_params(LOG_TABLE, LOG_COLS), [PX, PY], {'onError': 'continueRegularOutput'})
add_node('Fetch Published Page', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'GET', 'url': "={{ $('Normalize Input').first().json.published_url }}", 'sendHeaders': True, 'headerParameters': {'parameters': [{'name': 'User-Agent', 'value': 'Mozilla/5.0 (compatible; SEO-Agent/4.3; +https://github.com/n8n-io/n8n)'}, {'name': 'Accept', 'value': 'text/html,application/xhtml+xml'}]},
    'options': {'timeout': 45000, 'redirect': {'redirect': {'followRedirects': True, 'maxRedirects': 5}}, 'response': {'response': {'fullResponse': True, 'neverError': True, 'responseFormat': 'text'}}}}, [PX + 220, PY], {'onError': 'continueRegularOutput', 'executeOnce': True})   # 45 s: a WordPress 404 page on a slow host took longer than 20 s live
add_node('Load Content Log (Published)', DT_TYPE, DT_VERSION, dt_get_all_params(LOG_TABLE), [PX + 440, PY], LOAD13)
add_node('Load Ladders (Published)', DT_TYPE, DT_VERSION, dt_get_all_params(LADDER_TABLE), [PX + 660, PY], LOAD13)
add_node('Load Query History (Published)', DT_TYPE, DT_VERSION, dt_get_all_params(QUERY_TABLE), [PX + 880, PY], LOAD13)
add_node('Publish Check', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Publish_Check.js')}, [PX + 1100, PY])
add_node('Published Log Row', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Published_Log_Row.js')}, [PX + 1320, PY])
add_node('Save Published (Log)', DT_TYPE, DT_VERSION, dt_upsert_params_keys(LOG_TABLE, LOG_COLS, ['site_id', 'keyword']), [PX + 1540, PY], {'onError': 'continueRegularOutput', 'alwaysOutputData': True})
add_node('Published Ladder Row', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Published_Ladder_Row.js')}, [PX + 1760, PY])
if_node('Ladder Page?', "{{ !$json.skip }}", [PX + 1980, PY])
add_node('Mark Ladder Published', DT_TYPE, DT_VERSION, dt_update_params(LADDER_TABLE, LADDER_COLS, [('ladder_id', '={{ $json.ladder_id }}'), ('keyword', '={{ $json.keyword }}')], {'status': '={{ $json.status }}', 'target_url': '={{ $json.target_url }}', 'page_exists': '={{ $json.page_exists }}'}), [PX + 2200, PY - 120], {'onError': 'continueRegularOutput', 'alwaysOutputData': True})
add_node('Published Delivery', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Published_Delivery.js')}, [PX + 2420, PY])
if_node('Via Webhook (Published)?', "{{ !!$('Normalize Input').first().json.via_webhook }}", [PX + 2640, PY])
add_node('Build Published Response', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Build_Published_Response.js')}, [PX + 2860, PY - 120])
add_node('Published Recorded', 'n8n-nodes-base.form', 2.5, {'operation': 'completion', 'completionTitle': "=Recorded: {{ $json.keyword }}", 'completionMessage': "={{ $json.plain }}", 'options': {}}, [PX + 2860, PY + 120])
for a, b in [('Ensure Log Table (Published)', 'Fetch Published Page'), ('Fetch Published Page', 'Load Content Log (Published)'), ('Load Content Log (Published)', 'Load Ladders (Published)'), ('Load Ladders (Published)', 'Load Query History (Published)'), ('Load Query History (Published)', 'Publish Check'),
             ('Publish Check', 'Published Log Row'), ('Published Log Row', 'Save Published (Log)'), ('Save Published (Log)', 'Published Ladder Row'), ('Published Ladder Row', 'Ladder Page?'), ('Mark Ladder Published', 'Published Delivery'), ('Published Delivery', 'Via Webhook (Published)?'), ('Build Published Response', 'Has Callback?')]:
    connect(a, b)
connect('Ladder Page?', 'Mark Ladder Published', 0); connect('Ladder Page?', 'Published Delivery', 1)
connect('Via Webhook (Published)?', 'Build Published Response', 0); connect('Via Webhook (Published)?', 'Published Recorded', 1)
# ---------- C2. no URL constructor in the n8n Code sandbox (live finding 2026-10-02): Pick Top 6 stripped tracking parameters with new URL() inside a try/catch, so it silently kept them ----------
patch('Pick Top 6', "const cleanUrl = (u) => {\n  try {\n    const x = new URL(u);\n    ['srsltid', 'utm_source', 'utm_medium', 'utm_campaign', 'gclid', 'fbclid'].forEach(p => x.searchParams.delete(p));\n    return x.toString();\n  } catch (e) { return u; }\n};",
      "const cleanUrl = (u) => { const s = String(u || ''); const i = s.indexOf('?'); if (i < 0) return s; const rest = s.slice(i + 1); const hi = rest.indexOf('#'); const hash = hi >= 0 ? rest.slice(hi) : ''; const q = (hi >= 0 ? rest.slice(0, hi) : rest).split('&').filter(p => p && !/^(srsltid|utm_source|utm_medium|utm_campaign|gclid|fbclid)=/i.test(p)); return s.slice(0, i) + (q.length ? '?' + q.join('&') : '') + hash; };   // regex version: the n8n Code sandbox has no URL constructor")
# ---------- D. blog posts per week on "Track my site" ----------
nodes['Page Track']['parameters']['formFields']['values'].insert(4, {'fieldLabel': 'Blog posts per week', 'fieldType': 'dropdown', 'fieldOptions': {'values': [{'option': '0 (off)'}, {'option': '1'}, {'option': '2'}, {'option': '3'}]}})
add_node('Ensure Cadence Table (Track)', DT_TYPE, DT_VERSION, dt_create_params(CADENCE_TABLE, CADENCE_COLS), [TX + 110, TY - 160], {'onError': 'continueRegularOutput'})
add_node('Cadence Row (Track)', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Cadence_Row_Track.js')}, [TX + 550, TY - 160])
add_node('Save Cadence (Track)', DT_TYPE, DT_VERSION, dt_upsert_params(CADENCE_TABLE, CADENCE_COLS, 'site_id'), [TX + 770, TY - 160], {'onError': 'continueRegularOutput', 'alwaysOutputData': True})
disconnect('Ensure Sites Table (Track)', 'Site Row (Track)'); connect('Ensure Sites Table (Track)', 'Ensure Cadence Table (Track)'); connect('Ensure Cadence Table (Track)', 'Site Row (Track)')
disconnect('Save Site (Track)', 'Tracker Payload (Track)'); connect('Save Site (Track)', 'Cadence Row (Track)'); connect('Cadence Row (Track)', 'Save Cadence (Track)'); connect('Save Cadence (Track)', 'Tracker Payload (Track)')
nodes['Tracking Started']['parameters']['completionMessage'] = "=Your first performance report is being prepared now and will be e-mailed to {{ $('Normalize Input').first().json.email }} within a few minutes, then every Monday. {{ $('Normalize Input').first().json.blogs_per_week ? 'Every Monday the Content Cadence also writes ' + $('Normalize Input').first().json.blogs_per_week + ' blog page(s) for you (HTML + Markdown + meta.json); publish them and report the links with \"I published a page\". ' : '' }}The report tells you which Google account to add to Search Console and Google Analytics so your real search data flows in. You can close this page."
# ---------- E. notes ----------
nodes['Note 1']['parameters']['content'] = nodes['Note 1']['parameters']['content'].replace("· **Track my site** (weekly Search Console / GA4 / Trends report through the Site Tracker workflow).", "· **Track my site** (weekly Search Console / GA4 / Trends report through the Site Tracker workflow; blog posts per week through the Content Cadence workflow) · **I published a page** (publish check + tracking of the live URL).")
sticky("""### Blog package, content cadence and "I published a page" (v4.3)
Every content run now also delivers the article as **HTML + Markdown + meta.json** (`Blog Package`: title, slug, meta description, keywords, headings, internal links, schema, word count, content score, publish checklist) by e-mail and in the callback (`markdown`, `html`, `meta`). The owner publishes in **any CMS**.
"Track my site" takes **blog posts per week** (0-3 → `seo_cadence`); the workflow **SEO Agent — Content Cadence** writes them every Monday (ladder rung → striking-distance query → rising trend) and logs them in `seo_content_log`.
"I published a page" (form / API `mode: published`): fetches the live page, checks title / meta description / H1 / canonical / noindex / JSON-LD / length, upserts the content-log row with the URL, marks the ladder row published with the real URL, suggests pages to link from; the Site Tracker inspects the page and tracks the keyword from the next Monday. Internal spawns (`ladder:` / `cadence:` keys) do not consume the owner's 6 public runs per day.""", TX - 60, TY + 160, 1100, 300, 5)
log('Content cadence + published pages (v4.3): blog package (article HTML, Markdown, meta.json) on every content run; "Blog posts per week" on Track my site (seo_cadence, written weekly by SEO Agent — Content Cadence); "I published a page" form option / API mode published (live publish check, content log, ladder row, link suggestions); internal spawns exempt from the per-address rate limit; reporting a published page is free')


# =============================================================================
# 14. SEARCH CONSOLE IN THE AUDIT (v4.3): submitted-sitemap status, index coverage of the key pages (URL inspection), a 28-day search
#     performance snapshot, the site's sitemap compared with the crawl, and a site-structure summary. Runs for the technical audit and the
#     full report; without Search Console access it still does the sitemap / structure part and notes what could not be checked.
# =============================================================================
GOOGLE14 = {'googleApi': {'id': 'SEOcredGoogleSvc', 'name': 'Google Service Account (SEO Agent)'}}
G14_GET = lambda url: {'method': 'GET', 'url': url, 'authentication': 'predefinedCredentialType', 'nodeCredentialType': 'googleApi', 'options': {'batching': {'batch': {'batchSize': 1, 'batchInterval': 150}}, 'timeout': 60000, 'response': {'response': {'neverError': True}}}}
G14_POST = lambda url: {'method': 'POST', 'url': url, 'authentication': 'predefinedCredentialType', 'nodeCredentialType': 'googleApi', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify($json.body) }}', 'options': {'batching': {'batch': {'batchSize': 1, 'batchInterval': 150}}, 'timeout': 60000, 'response': {'response': {'neverError': True}}}}
PLAIN14 = lambda url: {'method': 'GET', 'url': url, 'sendHeaders': True, 'headerParameters': {'parameters': [{'name': 'User-Agent', 'value': 'Mozilla/5.0 (compatible; SEO-Agent/4.3)'}, {'name': 'Accept', 'value': 'application/xml,text/xml,*/*'}]}, 'options': {'timeout': 45000, 'redirect': {'redirect': {'followRedirects': True, 'maxRedirects': 5}}, 'response': {'response': {'fullResponse': True, 'neverError': True, 'responseFormat': 'text'}}}}
HX14 = {'onError': 'continueRegularOutput', 'retryOnFail': True, 'maxTries': 2, 'waitBetweenTries': 3000}
bsi14 = pos('Build Site Issues'); AX, AY = bsi14[0] - 2420, bsi14[1] + 1120
disconnect('Full Report?', 'Build Site Issues'); disconnect('AI Visibility', 'Build Site Issues')
add_node('GSC Audit Plan', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/GSC_Audit_Plan.js')}, [AX, AY])
add_node('Fetch Sitemap (Audit)', 'n8n-nodes-base.httpRequest', 4.5, PLAIN14('={{ $json.sitemap_url }}'), [AX + 220, AY], {'onError': 'continueRegularOutput', 'executeOnce': True, 'retryOnFail': True, 'maxTries': 2, 'waitBetweenTries': 3000})
add_node('Sitemap Children (Audit)', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Sitemap_Children_Audit.js')}, [AX + 440, AY])
if_node('Any Sitemap Children?', "{{ !$json.skip }}", [AX + 660, AY])
add_node('Fetch Sitemap Children (Audit)', 'n8n-nodes-base.httpRequest', 4.5, PLAIN14('={{ $json.url }}'), [AX + 880, AY - 120], {'onError': 'continueRegularOutput'})
add_node('GSC Sites (Audit)', 'n8n-nodes-base.httpRequest', 4.5, G14_GET('https://www.googleapis.com/webmasters/v3/sites'), [AX + 1100, AY], {'credentials': GOOGLE14, 'executeOnce': True, **HX14})
add_node('GSC Audit Requests', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/GSC_Audit_Requests.js')}, [AX + 1320, AY])
if_node('GSC Audit?', "{{ !$json.skip }}", [AX + 1540, AY])
add_node('GSC Audit Query', 'n8n-nodes-base.httpRequest', 4.5, G14_POST('={{ $json.url }}'), [AX + 1760, AY - 120], {'credentials': GOOGLE14, **HX14})
add_node('GSC Sitemaps (Audit)', 'n8n-nodes-base.httpRequest', 4.5, G14_GET("={{ $('GSC Audit Requests').first().json.sitemaps_url }}"), [AX + 1980, AY - 120], {'credentials': GOOGLE14, 'executeOnce': True, **HX14})
add_node('GSC Audit Findings', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/GSC_Audit_Findings.js')}, [AX + 2200, AY])
connect('Full Report?', 'GSC Audit Plan', 1); connect('AI Visibility', 'GSC Audit Plan')
for a, b in [('GSC Audit Plan', 'Fetch Sitemap (Audit)'), ('Fetch Sitemap (Audit)', 'Sitemap Children (Audit)'), ('Sitemap Children (Audit)', 'Any Sitemap Children?'), ('Fetch Sitemap Children (Audit)', 'GSC Sites (Audit)'), ('GSC Sites (Audit)', 'GSC Audit Requests'), ('GSC Audit Requests', 'GSC Audit?'), ('GSC Audit Query', 'GSC Sitemaps (Audit)'), ('GSC Sitemaps (Audit)', 'GSC Audit Findings'), ('GSC Audit Findings', 'Build Site Issues')]:
    connect(a, b)
connect('Any Sitemap Children?', 'Fetch Sitemap Children (Audit)', 0); connect('Any Sitemap Children?', 'GSC Sites (Audit)', 1)
connect('GSC Audit?', 'GSC Audit Query', 0); connect('GSC Audit?', 'GSC Audit Findings', 1)
# scoring node: carry the new blocks into site_audit; note the missing data when not connected
patch('Build Site Issues', "      what_works: whatWorks,\n", "      what_works: whatWorks,\n      search_console: input.search_console || null,\n      site_structure: input.site_structure || null,\n")
patch('Build Site Issues', "if (!input.ai_visibility) not_assessed.push('AI answer visibility (AI Overviews, ChatGPT brand mentions)');", "if (!input.ai_visibility) not_assessed.push('AI answer visibility (AI Overviews, ChatGPT brand mentions)');\nif (!(input.search_console && input.search_console.connected)) not_assessed.push('Search Console: submitted sitemaps, index coverage and search performance (connect the service account to the property)');")
# report section (both report types) and API fields
SC_SECTION_JS = r"""// ---- Search Console & site structure section (v4.3) ----
const scSection = (a, num) => {
  const sc = a.search_console || {}, st = a.site_structure || {};
  const e2 = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const n2 = (v) => (Number(v) || 0).toLocaleString('en-GB');
  const p2 = (u) => String(u || '').replace(/^https?:\/\/[^\/]+/, '') || '/';
  let h = `<h2 class="pb">${num}. Search Console &amp; Site Structure</h2>`;
  if (st.crawled_pages != null) {
    const db = st.depth_buckets || {}; const sm = st.sitemap || {};
    h += `<h3>Site structure (from the crawl)</h3><p>${n2(st.crawled_pages)} pages crawled, ${n2(st.indexable_pages)} indexable${st.within_3_clicks_pct != null ? '; ' + st.within_3_clicks_pct + '% of pages are within 3 clicks of the homepage' : ''}.</p>` +
      `<table class="ct"><tr><th>Clicks from home</th><th>0</th><th>1</th><th>2</th><th>3</th><th>4+</th></tr><tr><td>Pages</td><td>${n2(db[0])}</td><td>${n2(db[1])}</td><td>${n2(db[2])}</td><td>${n2(db[3])}</td><td>${n2(db['4+'])}</td></tr></table>` +
      ((st.sections || []).length ? `<table class="ct"><tr><th>Section</th><th>Pages crawled</th></tr>` + st.sections.map(s => `<tr><td>${e2(s.section)}</td><td>${n2(s.pages)}</td></tr>`).join('') + `</table>` : '') +
      `<p>XML sitemap: ${sm.status === 200 ? n2(sm.urls) + ' URLs' + (sm.is_index ? ' (index of ' + n2(sm.children) + ' sitemaps)' : '') : 'not readable at ' + e2(sm.url)}${st.indexable_not_in_sitemap ? '; ' + n2(st.indexable_not_in_sitemap) + ' indexable pages missing from it' : ''}${st.sitemap_only ? '; ' + n2(st.sitemap_only) + ' sitemap URLs that no internal link reaches' : ''}${st.sitemap_broken ? '; ' + n2(st.sitemap_broken) + ' sitemap URLs not returning 200' : ''}.</p>`;
  }
  h += `<h3>Google Search Console</h3>`;
  if (!sc.connected) h += `<p>Not connected (${e2(sc.error || 'no access')}). Add the service account as a Full user of the property in Search Console to get submitted-sitemap status, index coverage and search performance in this audit.</p>`;
  else {
    const t = sc.totals;
    h += `<p>Property <b>${e2(sc.property)}</b> (${e2(sc.permission)}).</p>`;
    if (t) h += `<p>Last 28 days (${e2(t.period.start)} to ${e2(t.period.end)}): <b>${n2(t.clicks)}</b> clicks, <b>${n2(t.impressions)}</b> impressions, CTR ${(t.ctr * 100).toFixed(2)}%, average position ${t.position}; ${n2(sc.pages_with_impressions)} pages and ${n2(sc.queries_with_impressions)} queries with impressions.</p>`;
    h += `<table class="ct"><tr><th>Submitted sitemap</th><th>URLs</th><th>Last read</th><th>Errors</th><th>Warnings</th></tr>` + ((sc.sitemaps || []).length ? sc.sitemaps.map(s => `<tr><td>${e2(s.path)}</td><td>${n2(s.urls)}</td><td>${e2(String(s.downloaded || '').slice(0, 10) || (s.pending ? 'pending' : '—'))}</td><td>${n2(s.errors)}</td><td>${n2(s.warnings)}</td></tr>`).join('') : `<tr><td colspan="5">none submitted${sc.sitemaps_error ? ' (' + e2(sc.sitemaps_error) + ')' : ''}</td></tr>`) + `</table>`;
    const covRows = Object.entries(sc.coverage || {});
    if (covRows.length) h += `<p>Index coverage of ${n2((sc.inspections || []).length)} sampled pages: ` + covRows.map(([k, v]) => `${n2(v)} × ${e2(k)}`).join(', ') + ((sc.rich_results || []).length ? `. Rich results detected: ${e2(sc.rich_results.join(', '))}` : '') + `.</p>`;
    if ((sc.not_indexed || []).length) h += `<table class="ct"><tr><th>Not indexed</th><th>Reason</th></tr>` + sc.not_indexed.slice(0, 10).map(x => `<tr><td>${e2(p2(x.url))}</td><td>${e2(x.reason)}</td></tr>`).join('') + `</table>`;
    if ((sc.top_queries || []).length) h += `<table class="ct"><tr><th>Top query</th><th>Clicks</th><th>Impressions</th><th>Position</th></tr>` + sc.top_queries.slice(0, 10).map(q => `<tr><td>${e2(q.query)}</td><td>${n2(q.clicks)}</td><td>${n2(q.impressions)}</td><td>${q.position}</td></tr>`).join('') + `</table>`;
    if ((sc.top_pages || []).length) h += `<table class="ct"><tr><th>Top page</th><th>Clicks</th><th>Impressions</th><th>Position</th></tr>` + sc.top_pages.slice(0, 10).map(q => `<tr><td>${e2(p2(q.page))}</td><td>${n2(q.clicks)}</td><td>${n2(q.impressions)}</td><td>${q.position}</td></tr>`).join('') + `</table>`;
  }
  return h;
};
"""
patch('Build Audit Report', "const findings = a.findings || [];", SC_SECTION_JS + "const findings = a.findings || [];")
patch('Build Audit Report', "<li>Issues Found</li><li>Action Plan</li><li>Not Assessed in This Audit</li><li>Methodology</li></ol>", "<li>Issues Found</li><li>Action Plan</li><li>Search Console &amp; Site Structure (5b)</li><li>Not Assessed in This Audit</li><li>Methodology</li></ol>")
patch('Build Audit Report', "// ---------- 6. Not assessed ----------", "html += scSection(a, '5b');\n\n// ---------- 6. Not assessed ----------")
patch('Build Audit Report', "    health_score: a.health_score,", "    health_score: a.health_score,\n    search_console: a.search_console || null,\n    site_structure: a.site_structure || null,")
patch('Build Full Report', "const findings = a.findings || [];", SC_SECTION_JS + "const findings = a.findings || [];")
_c = code('Build Full Report'); assert _c.count("'Images, Security & Technical', '") == 1, 'full report TOC anchor'
setcode('Build Full Report', _c.replace("'Images, Security & Technical', '", "'Images, Security & Technical', 'Search Console & Site Structure (12b)', '", 1))
patch('Build Full Report', "// ---------- 13. What works ----------", "html += scSection(a, '12b');\n\n// ---------- 13. What works ----------")
patch('Build Full Report', "    health_score: a.health_score,", "    health_score: a.health_score,\n    search_console: a.search_console || null,\n    site_structure: a.site_structure || null,")
patch('Build Audit Response', "domain: d.domain, health_score: d.health_score,", "domain: d.domain, health_score: d.health_score,\n  search_console: d.search_console ? { connected: d.search_console.connected, property: d.search_console.property, error: d.search_console.error || null, totals: d.search_console.totals, sitemaps: d.search_console.sitemaps, coverage: d.search_console.coverage, not_indexed: d.search_console.not_indexed, canonical_mismatch: d.search_console.canonical_mismatch, top_queries: d.search_console.top_queries, top_pages: d.search_console.top_pages, rich_results: d.search_console.rich_results } : null,\n  site_structure: d.site_structure || null,")
for n in list(nodes.values()):
    if n['type'] == 'n8n-nodes-base.httpRequest' and n['parameters'].get('authentication') == 'predefinedCredentialType': assert n.get('credentials'), 'google node without credential: ' + n['name']
sticky("""### Search Console in the audit (v4.3)
Both audit types now read the site's `/sitemap.xml` (+ up to 3 child sitemaps) and, with the service account, Search Console: the **submitted sitemaps** (errors, warnings, last read), a **28-day search snapshot** (totals, top pages and queries, pages shown but never clicked), and **URL inspection** of up to 25 key pages (index coverage, robots blocks, Google-chosen canonicals, rich results). `GSC Audit Findings` adds the findings (category Crawlability & Indexing), a site-structure summary (clicks from home, sections, sitemap vs crawl: indexable pages missing from the sitemap, sitemap URLs without internal links, non-200 sitemap URLs) and the report section "Search Console & Site Structure". Without access the audit still runs and lists Search Console under "Not assessed".""", AX - 60, AY - 320, 980, 260, 5)
log('Search Console in the audit (v4.3): submitted-sitemap status, index coverage of the key pages (URL inspection), 28-day search snapshot, sitemap-vs-crawl comparison and site-structure summary for both audit types; report section "Search Console & Site Structure"; API callback carries search_console and site_structure')


# =============================================================================
# 15. MONTHLY SEARCH CONSOLE CHECK-IN (v4.3): the owner answers two questions (manual action? security issue?) and uploads the Pages report
#     export — the items Google offers no API for. Form option + API mode "checkin"; one row per site and month (seo_console_checkins); a
#     reported manual action / security issue also becomes a console alert; the Monday report reminds until the month's check-in exists.
# =============================================================================
from ladder_common import ALERTS_TABLE, ALERTS_COLS, CHECKIN_TABLE, CHECKIN_COLS
nodes['Start Form']['parameters']['formFields']['values'][0]['fieldOptions']['values'].append({'option': 'Search Console check-in (monthly)'})
nodes['Choose Path']['parameters']['rules']['values'].append({'conditions': {'options': {'caseSensitive': False, 'leftValue': '', 'typeValidation': 'strict', 'version': 3}, 'conditions': [{'id': nid('Choose Path:checkin'), 'leftValue': "={{ $json['What do you want?'] }}", 'rightValue': 'Search Console check-in (monthly)', 'operator': {'type': 'string', 'operation': 'equals'}}], 'combinator': 'and'}, 'renameOutput': True, 'outputKey': 'checkin'})
conns['Choose Path']['main'].insert(8, [{'node': 'Page Check-in', 'type': 'main', 'index': 0}])
add_node('Page Check-in', 'n8n-nodes-base.form', 2.5, {'formFields': {'values': [
    {'fieldLabel': 'Website Domain', 'placeholder': 'example.com', 'requiredField': True},
    {'fieldLabel': 'Any manual action in Search Console?', 'fieldType': 'dropdown', 'fieldOptions': {'values': [{'option': 'No'}, {'option': 'Yes'}]}, 'requiredField': True},
    {'fieldLabel': 'Any security issue in Search Console?', 'fieldType': 'dropdown', 'fieldOptions': {'values': [{'option': 'No'}, {'option': 'Yes'}]}, 'requiredField': True},
    {'fieldLabel': 'Notes (optional)', 'fieldType': 'textarea', 'placeholder': 'What Search Console shows, e.g. the manual action reason or the pages it names'},
    {'fieldLabel': 'Pages report export (optional CSV)', 'fieldType': 'file', 'multipleFiles': False, 'acceptFileTypes': '.csv'},
    {'fieldLabel': 'Email (optional)', 'fieldType': 'email', 'placeholder': 'only if you want a copy of the next report at a different address'}
]}, 'options': {'formTitle': 'Search Console check-in', 'formDescription': 'Once a month: open Search Console → Security & Manual Actions, then Pages. Answer the two questions and, if you can, upload the Pages report export (Pages → Export → CSV, the Table file). Google offers no API for these, so this check-in keeps them in your Monday report.', 'buttonLabel': 'Record check-in'}}, [448, 1160])
add_node('Check-in Intake', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Checkin_Intake.js')}, [700, 1160])
connect('Page Check-in', 'Check-in Intake'); connect('Check-in Intake', 'Normalize Input')
nodes['Unmatched Choice']['parameters']['jsCode'] = "throw new Error('Please choose one of the 9 options (I know my keyword / Suggest keywords / Just describe my website / Audit my website / Check if my keyword is right / Rank my site for a keyword / Track my site / I published a page / Search Console check-in).');"
patch('Normalize Input', "else if (choice.includes('published')) mode = 'published';", "else if (choice.includes('published')) mode = 'published';\nelse if (choice.includes('check-in') || choice.includes('checkin')) mode = 'checkin';")
patch('Normalize Input', "  else if (m === 'published') mode = 'published';", "  else if (m === 'published') mode = 'published';\n  else if (m === 'checkin' || m === 'check-in') mode = 'checkin';")
patch('Normalize Input', "if (mode !== 'site_description' && mode !== 'published' && !c) throw new Error('Please select a Target Country.');   // a published-page report needs no market", "if (!['site_description', 'published', 'checkin'].includes(mode) && !c) throw new Error('Please select a Target Country.');   // published-page reports and check-ins need no market")
patch('Normalize Input', "const pagesRaw = parseInt(", "const yes = (v) => /^(y|true|1)/i.test(String(v == null ? '' : v).trim());\nconst checkin_manual_action = yes(pick(p2, 'manual action') || p2.manual_action);\nconst checkin_security_issue = yes(pick(p2, 'security issue') || p2.security_issue);\nconst checkin_notes = String(pick(p2, 'notes') || p2.notes || '').trim().slice(0, 1000);\nconst checkin_csv_text = String(p2.pages_csv_text || p2.pages_csv || '').slice(0, 400000);\nconst pagesRaw = parseInt(")
patch('Normalize Input', "if (mode === 'published' && !domain) throw new Error('Website Domain is required.');", "if (mode === 'checkin' && !domain) throw new Error('Website Domain is required.');\nif (mode === 'published' && !domain) throw new Error('Website Domain is required.');")
patch('Normalize Input', "    published_url,\n    content_request_id,\n", "    published_url,\n    content_request_id,\n    checkin_manual_action,\n    checkin_security_issue,\n    checkin_notes,\n    checkin_csv_text,\n")
patch('Rate Limit', "if (used >= LIMITS.per_key_per_day && d.mode !== 'published') {   // reporting a published page costs nothing and is never blocked", "if (used >= LIMITS.per_key_per_day && !['published', 'checkin'].includes(d.mode)) {   // reporting a published page or a check-in costs nothing and is never blocked")
patch('Rate Limit', "if (d.mode !== 'published') store.rate.keys[key] = used + 1;", "if (!['published', 'checkin'].includes(d.mode)) store.rate.keys[key] = used + 1;")
patch('Rate Limit', "describe: 0.03, ladder: 0.55, report: 0.3, track: 0, published: 0 };", "describe: 0.03, ladder: 0.55, report: 0.3, track: 0, published: 0, checkin: 0 };")
patch('Rate Limit', "else if (d.mode === 'published') est = EST.published;", "else if (d.mode === 'published') est = EST.published;\nelse if (d.mode === 'checkin') est = EST.checkin;")
nodes['Route Mode']['parameters']['rules']['values'].append({'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'loose', 'version': 3}, 'conditions': [{'id': nid('Route Mode:checkin'), 'leftValue': "={{ $json.mode === 'checkin' }}", 'rightValue': '', 'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}], 'combinator': 'and'}, 'renameOutput': True, 'outputKey': 'checkin'})
conns['Route Mode']['main'].insert(7, [{'node': 'Ensure Checkin Table', 'type': 'main', 'index': 0}])
KX, KY = TX, TY + 840
LOAD15 = {'onError': 'continueRegularOutput', 'alwaysOutputData': True}
add_node('Ensure Checkin Table', DT_TYPE, DT_VERSION, dt_create_params(CHECKIN_TABLE, CHECKIN_COLS), [KX, KY], {'onError': 'continueRegularOutput'})
add_node('Ensure Alerts Table (Check-in)', DT_TYPE, DT_VERSION, dt_create_params(ALERTS_TABLE, ALERTS_COLS), [KX + 220, KY], {'onError': 'continueRegularOutput'})
add_node('Parse Check-in', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Parse_Checkin.js')}, [KX + 440, KY])
add_node('Checkin Row', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Checkin_Row.js')}, [KX + 660, KY])
add_node('Save Check-in', DT_TYPE, DT_VERSION, dt_upsert_params_keys(CHECKIN_TABLE, CHECKIN_COLS, ['site_id', 'month']), [KX + 880, KY], LOAD15)
if_node('Checkin Alert?', "{{ !!(($('Parse Check-in').first().json.checkin_row || {}).manual_action || ($('Parse Check-in').first().json.checkin_row || {}).security_issue) }}", [KX + 1100, KY])
add_node('Alert From Checkin', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Alert_From_Checkin.js')}, [KX + 1320, KY - 120])
add_node('Save Check-in Alert', DT_TYPE, DT_VERSION, dt_upsert_params(ALERTS_TABLE, ALERTS_COLS, 'message_id'), [KX + 1540, KY - 120], LOAD15)
add_node('Check-in Delivery', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Checkin_Delivery.js')}, [KX + 1760, KY])
if_node('Via Webhook (Check-in)?', "{{ !!$('Normalize Input').first().json.via_webhook }}", [KX + 1980, KY])
add_node('Build Check-in Response', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Build_Checkin_Response.js')}, [KX + 2200, KY - 120])
add_node('Check-in Recorded', 'n8n-nodes-base.form', 2.5, {'operation': 'completion', 'completionTitle': "=Check-in recorded for {{ $json.domain }}", 'completionMessage': "={{ $json.plain }}", 'options': {}}, [KX + 2200, KY + 120])
for a, b in [('Ensure Checkin Table', 'Ensure Alerts Table (Check-in)'), ('Ensure Alerts Table (Check-in)', 'Parse Check-in'), ('Parse Check-in', 'Checkin Row'), ('Checkin Row', 'Save Check-in'), ('Save Check-in', 'Checkin Alert?'), ('Alert From Checkin', 'Save Check-in Alert'), ('Save Check-in Alert', 'Check-in Delivery'), ('Check-in Delivery', 'Via Webhook (Check-in)?'), ('Build Check-in Response', 'Has Callback?')]:
    connect(a, b)
connect('Checkin Alert?', 'Alert From Checkin', 0); connect('Checkin Alert?', 'Check-in Delivery', 1)
connect('Via Webhook (Check-in)?', 'Build Check-in Response', 0); connect('Via Webhook (Check-in)?', 'Check-in Recorded', 1)
nodes['Note 1']['parameters']['content'] = nodes['Note 1']['parameters']['content'].replace("· **I published a page** (publish check + tracking of the live URL).", "· **I published a page** (publish check + tracking of the live URL) · **Search Console check-in** (monthly: manual action / security issue / Pages report export, the items Google offers no API for).")
sticky("""### Monthly Search Console check-in (form / API `mode: checkin`, v4.3)
Google exposes no API for manual actions, security issues and the site-wide Pages (index coverage) report. The owner answers two questions and uploads the Pages export once a month (reminded in every Monday report until done); the CSV is parsed (`Parse Check-in`: reasons × pages, URL lists or the chart) into `seo_console_checkins`, a reported manual action / security issue also lands in `seo_console_alerts`, and the Site Tracker shows it with fix steps. The automatic counterpart is the **Console Alerts** workflow (IMAP watcher on the agent's mailbox). Check-ins are free and never rate-limited.""", KX - 60, KY - 360, 1000, 240, 5)
log('Monthly Search Console check-in (v4.3): form option with CSV upload + API mode checkin; seo_console_checkins (one row per site and month); reported manual action / security issue -> seo_console_alerts; Monday report reminds until the month is covered; Console Alerts mail watcher as the automatic path')


# =============================================================================
# 16. ENV-BASED SETTINGS (v4.3): brand, sender and ops address come from n8n/.env (SEO_BRAND, SEO_MAIL_FROM, SEO_OPS_EMAIL) with the old
#     literals as fallbacks; credentials reference .env through {{ $env.X }} expressions (sync_credentials.py).
# =============================================================================
patch('Normalize Input', "  brand: 'Dev SEO',                 // shown on reports and emails", "  brand: " + json.dumps(BRAND) + ",   // from n8n/.env (SEO_BRAND) at build time; shown on reports and e-mails")
# the Error Handler is a static workflow: sender and ops recipient from .env
_eh = os.path.join(HERE0, 'workflows', 'SEO_Agent_Error_Handler.json'); _ehw = json.load(open(_eh, encoding='utf-8')); _ehl = _ehw if isinstance(_ehw, list) else [_ehw]
for _n in _ehl[0]['nodes']:
    if _n['type'].endswith('emailSend') and _n['name'] == 'Email Ops': _n['parameters']['fromEmail'] = SENDER; _n['parameters']['toEmail'] = OPS_EMAIL; _n.update({'retryOnFail': True, 'maxTries': 3, 'waitBetweenTries': 5000})
json.dump(_ehw, open(_eh, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
log('Settings from n8n/.env at build time: brand (SEO_BRAND), sender (SEO_MAIL_FROM), ops address (SEO_OPS_EMAIL), service-account e-mail (SEO_GOOGLE_SA_EMAIL); credentials are written from .env by sync_credentials.py; apply_env.py does all of it in one command')


# =============================================================================
# 17. IMAGE PLAN (v4.3): the brief's three images (hero + two in-body) are carried into the blog package as <figure> placeholders, the
#     images / featured_image / open_graph blocks of meta.json and a richer table in the report; the publish check verifies the live images.
# =============================================================================
patch('Build Word File', "    parts.push(h2('Image Suggestions') + '<table class=\"ct\"><tr><th>Placement</th><th>Alt text</th></tr>' +\n      imgs.map(i => '<tr><td>' + esc(i.placement) + '</td><td>' + esc(i.alt_text) + '</td></tr>').join('') + '</table>');",
      "    parts.push(h2('Image Plan') + '<p>Three images per page: a hero (also the featured and Open Graph image, 1200×630 for sharing) and two in-body visuals. Save them as WebP under the suggested file names and keep the alt text.</p><table class=\"ct\"><tr><th>Placement</th><th>Purpose</th><th>What it shows</th><th>Alt text</th><th>File name</th></tr>' +\n      imgs.map(i => '<tr><td>' + esc(i.placement) + '</td><td>' + esc(i.purpose || '') + '</td><td>' + esc(i.subject || '') + (i.caption ? '<br><i>' + esc(i.caption) + '</i>' : '') + '</td><td>' + esc(i.alt_text) + '</td><td>' + esc(i.filename || '') + '</td></tr>').join('') + '</table>');")
log('Image plan (v4.3): the brief specifies a hero + two in-body images (purpose, subject, alt, caption, file name); the blog package carries <figure> placeholders and images / featured_image / open_graph in meta.json; the publish check verifies the live images (count, alt, topic in alt, file names, dimensions, modern format, og:image)')


# =============================================================================
# 18. E-E-A-T AND PAGE TYPES (v4.4, 2026-10-02): one business profile per site (author, expert reviewer, address / NAP) loaded by every
#     content run -> byline, author box, Person schema; pillar / hub pages (ladder top page or page type "Pillar / hub page") with a linked
#     table of contents, cluster summaries and a "Guides in this series" block; case studies from a short intake form (stored as proof that
#     later pages cite); local pages with LocalBusiness schema and a verified NAP block; VideoObject schema + transcript for pages with a video.
# =============================================================================
from ladder_common import PROFILE_TABLE, PROFILE_COLS, CASE_TABLE, CASE_COLS, dt_get_where_params
# ---------- A. intake: two new start options, their form pages, normalisation ----------
nodes['Start Form']['parameters']['formFields']['values'][0]['fieldOptions']['values'] += [{'option': 'Write a case study'}, {'option': 'Set up my business profile (author & address)'}]
nodes['Start Form']['parameters']['formDescription'] += ' Turn a real project into a case study, and set up your business profile once so every page carries its author and address.'
for _key, _label in [('case_study', 'Write a case study'), ('profile', 'Set up my business profile (author & address)')]:
    _i = len(nodes['Choose Path']['parameters']['rules']['values'])
    nodes['Choose Path']['parameters']['rules']['values'].append({'conditions': {'options': {'caseSensitive': False, 'leftValue': '', 'typeValidation': 'strict', 'version': 3}, 'conditions': [{'id': nid('Choose Path:' + _key), 'leftValue': "={{ $json['What do you want?'] }}", 'rightValue': _label, 'operator': {'type': 'string', 'operation': 'equals'}}], 'combinator': 'and'}, 'renameOutput': True, 'outputKey': _key})
    conns['Choose Path']['main'].insert(_i, [{'node': 'Page Case Study' if _key == 'case_study' else 'Page Profile', 'type': 'main', 'index': 0}])
nodes['Unmatched Choice']['parameters']['jsCode'] = "throw new Error('Please choose one of the 11 options (I know my keyword / Suggest keywords / Just describe my website / Audit my website / Check if my keyword is right / Rank my site for a keyword / Track my site / I published a page / Search Console check-in / Write a case study / Set up my business profile).');"
COUNTRY18 = copy.deepcopy(next(f for f in nodes['Page Keyword']['parameters']['formFields']['values'] if f['fieldLabel'] == 'Target Country'))
add_node('Page Case Study', 'n8n-nodes-base.form', 2.5, {'formFields': {'values': [
    {'fieldLabel': 'Website Domain', 'placeholder': 'example.com', 'requiredField': True}, COUNTRY18,
    {'fieldLabel': 'Service you delivered', 'placeholder': 'e.g. Odoo ERP implementation — the service this case study proves', 'requiredField': True},
    {'fieldLabel': 'Client name or description', 'placeholder': 'e.g. Northwind Foods, or "a Dubai food distributor"', 'requiredField': True},
    {'fieldLabel': 'May we name the client?', 'fieldType': 'dropdown', 'fieldOptions': {'values': [{'option': 'Yes, name them'}, {'option': 'No, keep them anonymous'}]}, 'requiredField': True},
    {'fieldLabel': 'Client industry', 'placeholder': 'e.g. food distribution'},
    {'fieldLabel': 'Client location', 'placeholder': 'e.g. Dubai, UAE'},
    {'fieldLabel': 'The challenge', 'fieldType': 'textarea', 'placeholder': 'What was wrong before you started, in the client\'s words if possible (systems, manual work, deadlines, cost).', 'requiredField': True},
    {'fieldLabel': 'What you did', 'fieldType': 'textarea', 'placeholder': 'Approach, modules or services, team, tools, the main steps.', 'requiredField': True},
    {'fieldLabel': 'Timeline', 'placeholder': 'e.g. 14 weeks, March to June 2026'},
    {'fieldLabel': 'Results (with numbers)', 'fieldType': 'textarea', 'placeholder': 'Before -> after: e.g. month-end close from 9 days to 3; 99.6% of e-invoices accepted first time; 2 finance staff hours saved per day.', 'requiredField': True},
    {'fieldLabel': 'Client quote (optional)', 'fieldType': 'textarea', 'placeholder': 'Verbatim, approved by the client'},
    {'fieldLabel': 'Quote by (name, role)', 'placeholder': 'e.g. Sara Khan, Finance Director'},
    {'fieldLabel': 'Keyword for this page (optional)', 'placeholder': 'default: "<service> case study"'},
    {'fieldLabel': 'Email me the case study', 'fieldType': 'email', 'requiredField': True}
]}, 'options': {'formTitle': 'Write a case study', 'formDescription': 'Five minutes of facts about a real project. We write the case study page (story, results table, quote, lessons, schema) and e-mail it as a ready-to-publish article. The facts are also stored as proof: later pages for your site may cite them. Only what you enter here is stated as fact.', 'buttonLabel': 'Write it'}}, [448, 1360])
add_node('Page Profile', 'n8n-nodes-base.form', 2.5, {'formFields': {'values': [
    {'fieldLabel': 'Website Domain', 'placeholder': 'example.com', 'requiredField': True},
    {'fieldLabel': 'Author name', 'placeholder': 'the person who signs the articles'},
    {'fieldLabel': 'Author job title', 'placeholder': 'e.g. Head of Tax Technology'},
    {'fieldLabel': 'Author credentials and experience', 'fieldType': 'textarea', 'placeholder': 'e.g. ACCA; 12 years in UAE VAT; led 40 ERP rollouts for distributors'},
    {'fieldLabel': 'Author bio', 'fieldType': 'textarea', 'placeholder': '2-3 sentences: what the author does, for whom, and what they have done'},
    {'fieldLabel': 'Author profile links (one per line)', 'fieldType': 'textarea', 'placeholder': 'https://yourdomain.com/team/name/\nhttps://www.linkedin.com/in/name/'},
    {'fieldLabel': 'Author photo URL (optional)', 'placeholder': 'https://yourdomain.com/images/author-name.webp'},
    {'fieldLabel': 'Topics the author knows best', 'placeholder': 'e.g. e-invoicing, UAE VAT, ERP implementation'},
    {'fieldLabel': 'Expert reviewer (optional)', 'placeholder': 'Name, job title, profile URL — for finance, legal or health topics'},
    {'fieldLabel': 'Company name', 'placeholder': 'exactly as on your Google Business Profile'},
    {'fieldLabel': 'Category (for local search)', 'placeholder': 'e.g. Accounting firm, IT consultancy, Dental clinic'},
    {'fieldLabel': 'Street address', 'placeholder': 'e.g. Office 1203, Aspect Tower, Business Bay'},
    {'fieldLabel': 'City'}, {'fieldLabel': 'Region / state / emirate'}, {'fieldLabel': 'Postal code'},
    {**copy.deepcopy(COUNTRY18), 'fieldLabel': 'Country', 'requiredField': False},
    {'fieldLabel': 'Phone', 'placeholder': '+971 4 000 0000'},
    {'fieldLabel': 'Public e-mail on the website', 'placeholder': 'hello@yourdomain.com'},
    {'fieldLabel': 'Opening hours', 'placeholder': 'Mo-Fr 09:00-18:00 (this format becomes schema)'},
    {'fieldLabel': 'Areas you serve', 'placeholder': 'e.g. Dubai, Abu Dhabi, Sharjah'},
    {'fieldLabel': 'Google Maps link (optional)'},
    {'fieldLabel': 'Logo URL (optional)'},
    {'fieldLabel': 'Email (optional)', 'fieldType': 'email', 'placeholder': 'not needed: the result is shown on the next page'}
]}, 'options': {'formTitle': 'Set up my business profile', 'formDescription': 'Once per website. Every page we write for it then carries a real author (byline, author box, Person schema: Google\'s E-E-A-T signals) and local pages carry your verified name, address, phone and hours (LocalBusiness schema). Send the form again to change anything: empty fields keep what is stored, "-" clears a field.', 'buttonLabel': 'Save profile'}}, [448, 1560])
connect('Page Case Study', 'Normalize Input'); connect('Page Profile', 'Normalize Input')
# page types and per-page extras on "I know my keyword"
_pt = next(f for f in nodes['Page Keyword']['parameters']['formFields']['values'] if f['fieldLabel'] == 'Page Type')
_pt['fieldOptions']['values'] += [{'option': 'Guide'}, {'option': 'Pillar / hub page'}, {'option': 'Local page (city or area)'}]
insert_fields('Page Keyword', 'Existing page URL (optional)', [{'fieldLabel': 'City or area (local pages only)', 'placeholder': 'e.g. Dubai Marina — for "Local page" only'},
    {'fieldLabel': 'Video URL for this page (optional)', 'placeholder': 'YouTube or Vimeo link — embedded with VideoObject schema'},
    {'fieldLabel': 'Video transcript (optional)', 'fieldType': 'textarea', 'placeholder': 'Paste the transcript (YouTube Studio → Subtitles → Download). Lines like "0:45 Setting up" become key moments.'}])
patch('Normalize Input', "else if (choice.includes('check-in') || choice.includes('checkin')) mode = 'checkin';", "else if (choice.includes('check-in') || choice.includes('checkin')) mode = 'checkin';\nelse if (choice.includes('case study')) mode = 'case_study';\nelse if (choice.includes('business profile')) mode = 'profile';")
patch('Normalize Input', "  else if (m === 'checkin' || m === 'check-in') mode = 'checkin';", "  else if (m === 'checkin' || m === 'check-in') mode = 'checkin';\n  else if (m === 'case_study' || m === 'case-study' || m === 'casestudy') mode = 'case_study';\n  else if (m === 'profile') mode = 'profile';")
patch('Normalize Input', "if (!['site_description', 'published', 'checkin'].includes(mode) && !c)", "if (!['site_description', 'published', 'checkin', 'profile'].includes(mode) && !c)")
patch('Normalize Input', "const keyword  = (mode === 'track' ? '' :", "let keyword  = (mode === 'track' || mode === 'profile' ? '' :")
patch('Normalize Input', "const pageType = String(pick(p2, 'page', 'type') || '').trim() || 'Service Page';",
      "const pageType0 = String(pick(p2, 'page', 'type') || '').trim();\nconst pageType = (mode === 'case_study' || /case stud/i.test(pageType0)) ? 'Case Study' : /pillar|hub/i.test(pageType0) ? 'Pillar Page' : /^local/i.test(pageType0) ? 'Local Page' : (pageType0 || 'Service Page');")
patch('Normalize Input', "const pagesRaw = parseInt(", r"""// ---- v4.4: business profile (author, reviewer, address), case-study intake, local pages, video ----
const lab = (label) => { const v = p2[label]; return v == null ? '' : String(v).trim(); };   // exact form labels: several new labels share words with older ones
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
const s0 = (v, n) => String(v == null ? '' : v).trim().slice(0, n || 400);
const urlOk = (u) => /^https?:\/\/\S+$/i.test(String(u || ''));
const A = obj(p2.author), R = obj(p2.reviewer), AD = obj(p2.address), CS = obj(p2.case_study), VI = obj(p2.video);
const authorLinks = (Array.isArray(A.same_as) ? A.same_as : String(A.same_as || A.links || lab('Author profile links (one per line)')).split(/[\s,]+/)).map(x => String(x).trim()).filter(urlOk).slice(0, 8);
const authorUrl = s0(A.url, 400) || authorLinks.find(u => cleanDomain(u) === domain) || '';   // the author page on the site; LinkedIn & co. go to sameAs (an update without a page link keeps the stored one)
const revText = lab('Expert reviewer (optional)'); const revUrl = (revText.match(/https?:\/\/\S+/) || [''])[0]; const revParts = revText.replace(/https?:\/\/\S+/, '').split(',').map(x => x.trim()).filter(Boolean);
const profile_input = {
  business_name: s0(p2.business_name || lab('Company name'), 160), business_type: s0(p2.business_type || lab('Category (for local search)'), 80), logo_url: s0(p2.logo_url || lab('Logo URL (optional)'), 400),
  street_address: s0(AD.street || AD.street_address || p2.street_address || lab('Street address'), 200), city: s0(AD.city || (mode === 'profile' ? p2.city : '') || lab('City'), 100),
  region: s0(AD.region || p2.region || lab('Region / state / emirate'), 100), postal_code: s0(AD.postal_code || p2.postal_code || lab('Postal code'), 30),
  country_code: mode === 'profile' ? (c ? c.iso : s0(AD.country, 2).toUpperCase()) : '', phone: s0(p2.phone || lab('Phone'), 40), public_email: s0(p2.public_email || lab('Public e-mail on the website'), 120),
  opening_hours: s0(p2.opening_hours || lab('Opening hours'), 200), price_range: s0(p2.price_range, 20),
  service_areas: asArray(p2.service_areas || lab('Areas you serve')).map(x => s0(x, 80)).filter(Boolean).slice(0, 20).join(', '), map_url: s0(p2.map_url || lab('Google Maps link (optional)'), 400),
  author_name: s0(A.name || p2.author_name || lab('Author name'), 120), author_job_title: s0(A.job_title || A.title || lab('Author job title'), 160), author_credentials: s0(A.credentials || lab('Author credentials and experience'), 600),
  author_bio: s0(A.bio || lab('Author bio'), 1200), author_url: authorUrl, author_image_url: s0(A.image_url || A.image || lab('Author photo URL (optional)'), 400),
  author_same_as: authorLinks.filter(u => u !== authorUrl).join(' '), author_knows_about: asArray(A.knows_about || lab('Topics the author knows best')).map(x => s0(x, 80)).filter(Boolean).slice(0, 12).join(', '),
  reviewer_name: s0(R.name || revParts[0], 120), reviewer_job_title: s0(R.job_title || R.title || revParts.slice(1).join(', '), 160), reviewer_url: s0(R.url || revUrl, 400)
};
for (const k of ['logo_url', 'author_url', 'author_image_url', 'reviewer_url', 'map_url']) if (profile_input[k] && profile_input[k] !== '-' && !urlOk(profile_input[k])) throw new Error('Please enter full links (https://...) for the logo, author page, photo, reviewer and map.');
const csIn = mode === 'case_study' || Object.keys(CS).length > 0;
const pubRaw = CS.client_public != null ? String(CS.client_public) : lab('May we name the client?');
const case_study = csIn ? { client_name: s0(CS.client_name || CS.client || lab('Client name or description'), 160), client_public: !/^(no|false|0|anonymous)/i.test(pubRaw.trim() || 'yes'),
  industry: s0(CS.industry || lab('Client industry'), 100), location: s0(CS.location || lab('Client location'), 100), service: s0(CS.service || lab('Service you delivered'), 160),
  challenge: s0(CS.challenge || lab('The challenge'), 2000), solution: s0(CS.solution || CS.what_we_did || lab('What you did'), 3000), timeline: s0(CS.timeline || lab('Timeline'), 200),
  results: s0(CS.results || lab('Results (with numbers)'), 2000), quote: s0(CS.quote || lab('Client quote (optional)'), 600), quote_by: s0(CS.quote_by || lab('Quote by (name, role)'), 160) } : null;
if (mode === 'case_study' && !keyword && case_study && case_study.service) keyword = (case_study.service + ' case study').toLowerCase().replace(/\s+/g, ' ').trim();
const case_id = String(p2.case_id || (mode === 'case_study' ? 'cs_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) : ''));
let local_area = s0(p2.local_area || lab('City or area (local pages only)'), 80);
if (pageType === 'Local Page' && !local_area) { const g = keyword.match(/\b(?:in|near|around)\s+([a-z][a-z .'-]{2,40})$/i); if (g) local_area = g[1].trim().replace(/\b\w/g, ch => ch.toUpperCase()); }
const video_url = s0(VI.url || p2.video_url || lab('Video URL for this page (optional)'), 400);
if (video_url && !urlOk(video_url)) throw new Error('The video URL must be a full link (https://...).');
const ytm = video_url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i); const vim = video_url.match(/vimeo\.com\/(?:video\/)?(\d{6,12})/i);
const video = video_url ? { url: video_url, provider: ytm ? 'youtube' : vim ? 'vimeo' : 'file', id: ytm ? ytm[1] : vim ? vim[1] : '',
  embed_url: ytm ? 'https://www.youtube.com/embed/' + ytm[1] : vim ? 'https://player.vimeo.com/video/' + vim[1] : '',
  fetch_url: ytm ? 'https://www.youtube.com/watch?v=' + ytm[1] : vim ? 'https://vimeo.com/api/oembed.json?url=' + encodeURIComponent('https://vimeo.com/' + vim[1]) : '',
  thumbnail_url: s0(VI.thumbnail_url, 400) || (ytm ? 'https://i.ytimg.com/vi/' + ytm[1] + '/hqdefault.jpg' : ''), title: s0(VI.title || p2.video_title, 200), description: s0(VI.description || p2.video_description, 2000),
  transcript: String(VI.transcript || p2.video_transcript || lab('Video transcript (optional)') || '').trim().slice(0, 60000), upload_date: s0(VI.upload_date || p2.video_upload_date, 40), duration: s0(VI.duration || p2.video_duration, 20), placement: s0(VI.placement, 160) } : null;
const pagesRaw = parseInt(""")
patch('Normalize Input', "if (mode === 'checkin' && !domain) throw new Error('Website Domain is required.');",
      "if (mode === 'checkin' && !domain) throw new Error('Website Domain is required.');\nif (mode === 'profile' && !domain) throw new Error('Website Domain is required: the profile belongs to your site.');\n"
      "if (mode === 'profile' && !['author_name', 'business_name', 'street_address', 'phone', 'reviewer_name'].some(k => profile_input[k])) throw new Error('Please fill in at least the author name or the business details.');\n"
      "if (mode === 'case_study' && !domain) throw new Error('Website Domain is required: the case study is written for your site.');\n"
      "if (mode === 'case_study' && !keyword) throw new Error('Please enter the service you delivered (or a keyword for the page).');\n"
      "if (mode === 'case_study' && !(case_study.challenge && case_study.solution && case_study.results)) throw new Error('Please describe the challenge, what you did and the results: the case study states only these facts.');\n"
      "if (mode === 'case_study' && !deliverable) throw new Error('Please add your email — the case study is sent by email.');\n"
      "if (mode === 'keyword' && !verdict_only && pageType === 'Local Page' && !local_area) throw new Error('Please enter the city or area for a local page (or put it in the keyword, e.g. \"accountant in dubai marina\").');")
patch('Normalize Input', "    checkin_csv_text,\n", "    checkin_csv_text,\n    profile_input: (mode === 'profile' || profile_input.author_name || profile_input.reviewer_name) ? profile_input : null,\n    case_study,\n    case_id,\n    local_area,\n    video,\n")
patch('Rate Limit', "const internal = /^(ladder|cadence|tracker):/.test(String(d.client_ip || ''));", "const internal = /^(ladder|cadence|tracker|casestudy):/.test(String(d.client_ip || ''));")
patch('Rate Limit', "if (used >= LIMITS.per_key_per_day && !['published', 'checkin'].includes(d.mode)) {", "if (used >= LIMITS.per_key_per_day && !['published', 'checkin', 'profile'].includes(d.mode)) {")
patch('Rate Limit', "if (!['published', 'checkin'].includes(d.mode)) store.rate.keys[key] = used + 1;", "if (!['published', 'checkin', 'profile'].includes(d.mode)) store.rate.keys[key] = used + 1;")
patch('Rate Limit', "published: 0, checkin: 0 };", "published: 0, checkin: 0, profile: 0, case_study: 0 };")
patch('Rate Limit', "else if (d.mode === 'checkin') est = EST.checkin;", "else if (d.mode === 'checkin') est = EST.checkin;\nelse if (d.mode === 'profile') est = EST.profile;\nelse if (d.mode === 'case_study') est = EST.case_study;   // the page itself runs as its own execution and is counted there")
patch('Rate Limit', "if (budget > 0 && store.ai_budget.spent_est + est > budget) {", "const __room = d.mode === 'case_study' ? EST.content : 0;   // reject the intake at once when the case-study page could not run today\nif (budget > 0 && store.ai_budget.spent_est + est + __room > budget) {")
patch('Rate Limit', "this run would add about $' + est.toFixed(2) + ').", "this run would add about $' + (est + __room).toFixed(2) + ').")
# ---------- B. routing + the profile chain (free, never rate-limited) ----------
from ladder_common import LOG_TABLE as LOG18, LOG_COLS as LOGC18
def route18(key, target):
    _i = len(nodes['Route Mode']['parameters']['rules']['values'])
    nodes['Route Mode']['parameters']['rules']['values'].append({'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'loose', 'version': 3}, 'conditions': [{'id': nid('Route Mode:' + key), 'leftValue': "={{ $json.mode === '" + key + "' }}", 'rightValue': '', 'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}], 'combinator': 'and'}, 'renameOutput': True, 'outputKey': key})
    conns['Route Mode']['main'].insert(_i, [{'node': target, 'type': 'main', 'index': 0}])
route18('profile', 'Ensure Profile Table'); route18('case_study', 'Ensure Case Table')
SITE18 = "={{ 'site_' + String($('Normalize Input').first().json.domain || 'none').toLowerCase().replace(/[^a-z0-9]+/g, '-') }}"
LOAD18 = {'alwaysOutputData': True, 'executeOnce': True, 'onError': 'continueRegularOutput'}
FX, FY = TX, TY + 1260
add_node('Ensure Profile Table', DT_TYPE, DT_VERSION, dt_create_params(PROFILE_TABLE, PROFILE_COLS), [FX, FY], {'onError': 'continueRegularOutput'})
add_node('Load Profile (Profile)', DT_TYPE, DT_VERSION, dt_get_where_params(PROFILE_TABLE, 'site_id', 'eq', SITE18), [FX + 220, FY], LOAD18)
add_node('Profile Row', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Profile_Row.js')}, [FX + 440, FY])
add_node('Save Profile', DT_TYPE, DT_VERSION, dt_upsert_params(PROFILE_TABLE, PROFILE_COLS, 'site_id'), [FX + 660, FY], {'onError': 'continueRegularOutput', 'alwaysOutputData': True})
add_node('Profile Delivery', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Profile_Delivery.js')}, [FX + 880, FY])
if_node('Via Webhook (Profile)?', "{{ !!$('Normalize Input').first().json.via_webhook }}", [FX + 1100, FY])
add_node('Build Profile Response', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Build_Profile_Response.js')}, [FX + 1320, FY - 120])
add_node('Profile Saved', 'n8n-nodes-base.form', 2.5, {'operation': 'completion', 'completionTitle': "=Business profile saved for {{ $json.domain }}", 'completionMessage': "={{ $json.plain }}", 'options': {}}, [FX + 1320, FY + 120])
for a, b in [('Ensure Profile Table', 'Load Profile (Profile)'), ('Load Profile (Profile)', 'Profile Row'), ('Profile Row', 'Save Profile'), ('Save Profile', 'Profile Delivery'), ('Profile Delivery', 'Via Webhook (Profile)?'), ('Build Profile Response', 'Has Callback?')]:
    connect(a, b)
connect('Via Webhook (Profile)?', 'Build Profile Response', 0); connect('Via Webhook (Profile)?', 'Profile Saved', 1)
# ---------- C. the case-study chain: store the intake, log the page, start the page run (own execution), confirm ----------
CX, CY = TX, TY + 1680
add_node('Ensure Case Table', DT_TYPE, DT_VERSION, dt_create_params(CASE_TABLE, CASE_COLS), [CX, CY], {'onError': 'continueRegularOutput'})
add_node('Ensure Log Table (Case)', DT_TYPE, DT_VERSION, dt_create_params(LOG18, LOGC18), [CX + 220, CY], {'onError': 'continueRegularOutput'})
add_node('Case Study Row', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Case_Study_Row.js')}, [CX + 440, CY])
add_node('Save Case Study', DT_TYPE, DT_VERSION, dt_upsert_params(CASE_TABLE, CASE_COLS, 'case_id'), [CX + 660, CY], {'onError': 'continueRegularOutput', 'alwaysOutputData': True})
add_node('Case Study Log Row', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Case_Study_Log_Row.js')}, [CX + 880, CY])
add_node('Log Case Study', DT_TYPE, DT_VERSION, dt_upsert_params_keys(LOG18, LOGC18, ['site_id', 'keyword']), [CX + 1100, CY], {'onError': 'continueRegularOutput', 'alwaysOutputData': True})
add_node('Spawn Case Study Run', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Spawn_Case_Study_Run.js')}, [CX + 1320, CY])
add_node('Start Case Study Run', 'n8n-nodes-base.executeWorkflow', 1.2, {'source': 'database', 'workflowId': {'__rl': True, 'mode': 'id', 'value': 'SEOagentV4Full01'}, 'mode': 'once', 'options': {'waitForSubWorkflow': False}}, [CX + 1540, CY], {'onError': 'continueRegularOutput'})
add_node('Case Study Delivery', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Case_Study_Delivery.js')}, [CX + 1760, CY])
if_node('Via Webhook (Case Study)?', "{{ !!$('Normalize Input').first().json.via_webhook }}", [CX + 1980, CY])
add_node('Build Case Study Response', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Build_Case_Study_Response.js')}, [CX + 2200, CY - 120])
add_node('Case Study Started', 'n8n-nodes-base.form', 2.5, {'operation': 'completion', 'completionTitle': "=Your case study is being written", 'completionMessage': "={{ $json.plain }}", 'options': {}}, [CX + 2200, CY + 120])
for a, b in [('Ensure Case Table', 'Ensure Log Table (Case)'), ('Ensure Log Table (Case)', 'Case Study Row'), ('Case Study Row', 'Save Case Study'), ('Save Case Study', 'Case Study Log Row'), ('Case Study Log Row', 'Log Case Study'), ('Log Case Study', 'Spawn Case Study Run'),
             ('Spawn Case Study Run', 'Start Case Study Run'), ('Start Case Study Run', 'Case Study Delivery'), ('Case Study Delivery', 'Via Webhook (Case Study)?'), ('Build Case Study Response', 'Has Callback?')]:
    connect(a, b)
connect('Via Webhook (Case Study)?', 'Build Case Study Response', 0); connect('Via Webhook (Case Study)?', 'Case Study Started', 1)
# a published case study becomes linkable proof (status + URL on its row; no row = nothing to update)
_spl = pos('Save Published (Log)')
add_node('Mark Case Study Published', DT_TYPE, DT_VERSION, dt_update_params(CASE_TABLE, CASE_COLS, [('site_id', "={{ $('Publish Check').first().json.log_row.site_id }}"), ('keyword', "={{ $('Publish Check').first().json.log_row.keyword }}")], {'status': 'published', 'page_url': "={{ $('Publish Check').first().json.published_url }}"}), [_spl[0] + 110, _spl[1] + 200], {'onError': 'continueRegularOutput', 'alwaysOutputData': True})
disconnect('Save Published (Log)', 'Published Ladder Row'); connect('Save Published (Log)', 'Mark Case Study Published'); connect('Mark Case Study Published', 'Published Ladder Row')
# ---------- D. content runs: profile + case studies + video details -> Brief Context -> Strategy Brief ----------
SITE18B = "={{ 'site_' + String($('Parse Verdict').first().json.domain || 'none').toLowerCase().replace(/[^a-z0-9]+/g, '-') }}"
nc18 = pos('Need Content?'); BX, BY = nc18[0] - 220, nc18[1] + 420
add_node('Load Profile (Brief)', DT_TYPE, DT_VERSION, dt_get_where_params(PROFILE_TABLE, 'site_id', 'eq', SITE18B), [BX, BY], LOAD18)
add_node('Load Case Studies (Brief)', DT_TYPE, DT_VERSION, dt_get_where_params(CASE_TABLE, 'site_id', 'eq', SITE18B), [BX + 200, BY], LOAD18)
if_node('Has Video?', "{{ !!(($('Parse Verdict').first().json.video || {}).fetch_url) }}", [BX + 400, BY])
add_node('Fetch Video Details', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'GET', 'url': "={{ $('Parse Verdict').first().json.video.fetch_url }}", 'sendHeaders': True, 'headerParameters': {'parameters': [{'name': 'User-Agent', 'value': 'Mozilla/5.0 (compatible; SEO-Agent/4.4)'}, {'name': 'Accept-Language', 'value': 'en'}]},
    'options': {'timeout': 20000, 'redirect': {'redirect': {'followRedirects': True, 'maxRedirects': 5}}, 'response': {'response': {'fullResponse': True, 'neverError': True, 'responseFormat': 'text'}}}}, [BX + 600, BY - 120], {'onError': 'continueRegularOutput', 'executeOnce': True})
add_node('Brief Context', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Brief_Context.js')}, [BX + 800, BY])
disconnect('Need Content?', 'Strategy Brief')
_nc_out = conns['Need Content?']['main']; _nc_out[0] = [{'node': 'Load Profile (Brief)', 'type': 'main', 'index': 0}]
for a, b in [('Load Profile (Brief)', 'Load Case Studies (Brief)'), ('Load Case Studies (Brief)', 'Has Video?'), ('Fetch Video Details', 'Brief Context'), ('Brief Context', 'Strategy Brief')]:
    connect(a, b)
connect('Has Video?', 'Fetch Video Details', 0); connect('Has Video?', 'Brief Context', 1)
patch('Parse Brief', "const prev = $('Parse Verdict').first().json;   // includes verdict + keyword data + site context", "const prev = $('Brief Context').first().json;   // Parse Verdict + business profile, proof, page role, hub pages, video (v4.4)")
sb18 = get_schema('Parser — Strategy Brief')
sb18['properties']['experience_notes'] = ARR; sb18['properties']['video_placement'] = {'type': 'string'}
sb18['properties']['outline']['items']['properties']['link_to'] = {'type': 'string'}
set_schema('Parser — Strategy Brief', sb18)
# length bands for the new page types (hub pages are longer, case studies and local pages shorter)
patch('Parse Analysis', "const isGuide = /blog|guide|article/.test(pt);\nconst lo = isGuide ? 1200 : 900, hi = isGuide ? 3000 : 2400;",
      "const isGuide = /blog|guide|article/.test(pt);\nconst isHub = /pillar|hub/.test(pt) || Number(prev.ladder_rung) === 4, isShort = /case stud|local/.test(pt);   // v4.4 page types\nconst lo = isHub ? 1800 : isShort ? 800 : isGuide ? 1200 : 900, hi = isHub ? 3500 : isShort ? 1800 : isGuide ? 3000 : 2400;")
# ---------- E. report + package fields ----------
patch('Build Word File', "content_images: Array.isArray(brief.image_suggestions) ? brief.image_suggestions : []",
      "content_images: Array.isArray(brief.image_suggestions) ? brief.image_suggestions : [],\n    page_role: d.page_role || 'standard', article_like: d.article_like == null ? null : !!d.article_like, author: d.author || null, reviewer: d.reviewer || null, site_profile: d.site_profile || null, hub_pages: d.hub_pages || [], video: d.video || null, case_study: d.case_study || null, case_id: d.case_id || '', local_area: d.local_area || '', content_brief_video_placement: brief.video_placement || '', eeat_notes: qa.eeat_notes || [], page_type: d.page_type || ''")
patch('Build Word File', "  const tc = (qa.term_coverage || []);\n  if (tc.length) parts.push(h2('Topic Coverage vs Top-Ranking Pages')",
      """  // ---- v4.4: author, trust and page extras ----
  const au = d.author || null, rv = d.reviewer || null, role = d.page_role || 'standard', vid = d.video || null, hp = d.hub_pages || [];
  const extraRows = [['Page role', esc({ hub: 'Hub / pillar page (table of contents, cluster summaries, "Guides in this series")', case_study: 'Case study (snapshot box, facts from the intake only)', local: 'Local page for ' + (d.local_area || '[City]') + ' (verified NAP block, LocalBusiness schema)', standard: 'Standard page' }[role] || role)],
    ['Author (byline, author box, Person schema)', au ? esc(au.name + (au.job_title ? ', ' + au.job_title : '')) + (au.url ? ' · ' + esc(au.url) : '') : '<span class="bad">No author on file — [placeholders] in the package; set up the business profile</span>'],
    ['Expert reviewer', rv ? esc(rv.name + (rv.job_title ? ', ' + rv.job_title : '')) : 'none'],
    ['Experience notes', (brief.experience_notes || []).length ? ul(brief.experience_notes) : 'none']];
  if (role === 'hub') extraRows.push(['Cluster pages linked', hp.length ? ul(hp.map(p => (p.keyword || p.url) + ' — ' + p.url + (p.planned ? ' (planned)' : ''))) : 'none found']);
  if (vid) extraRows.push(['Video', esc((vid.title || vid.url) + (vid.minutes ? ' · ' + vid.minutes + ' min' : '') + (vid.upload_date ? ' · uploaded ' + String(vid.upload_date).slice(0, 10) : '')) + ((vid.chapters || []).length ? ' · ' + vid.chapters.length + ' key moments' : '') + ' · transcript ' + (vid.transcript ? 'included' : '<span class="bad">missing</span>')]);
  if (d.case_study) extraRows.push(['Case study', esc((d.case_study.client_public === false ? 'anonymised client' : d.case_study.client_name) + ' · ' + (d.case_study.service || '') + (d.case_study.timeline ? ' · ' + d.case_study.timeline : ''))]);
  parts.push(h2('Author, Trust & Page Extras') + kv(extraRows) + ((qa.eeat_notes || []).length ? '<h3>Before publishing</h3>' + ul(qa.eeat_notes) : ''));
  const tc = (qa.term_coverage || []);
  if (tc.length) parts.push(h2('Topic Coverage vs Top-Ranking Pages')""")
# ---------- F. cadence: the ladder's top page links down to every rung page (was 6) so the hub lists the whole cluster ----------
# (Cadence_Plan.js, v5/code — edited in place)
# ---------- G. notes ----------
nodes['Note 1']['parameters']['content'] = nodes['Note 1']['parameters']['content'].replace("the items Google offers no API for).", "the items Google offers no API for) · **Write a case study** (intake → stored proof + case-study page run) · **Set up my business profile** (author, reviewer, address: byline, author box, Person / LocalBusiness schema on every page).", 1)
sticky("""### E-E-A-T and page types (v4.4)
**Business profile** (form / API `mode: profile`, `seo_profiles`): author (name, title, credentials, bio, profile links, photo, topics), expert reviewer, business name / category / address / phone / hours / areas. Every content run loads it (*Load Profile (Brief)*) → byline + author box + **Person** schema (+ **WebPage reviewedBy**), LocalBusiness for local pages. **Case studies** (form / API `mode: case_study`, `seo_case_studies`): the intake is stored as proof (later pages cite it, linked once published) and the page runs as its own execution (page type Case Study, snapshot box). **Hub pages**: the ladder's top page or page type "Pillar / hub page" → section per cluster page with `link_to`, linked table of contents, "Guides in this series", ItemList. **Local pages**: page type "Local page" + city/area → local rules in the brief, verified NAP block, LocalBusiness + Service(areaServed). **Video**: `video_url` (+ transcript) → YouTube page / Vimeo oEmbed read for upload date and duration, embed + transcript in the package, **VideoObject** with key moments. *Brief Context* builds all of it before the Strategy Brief; the publish check verifies it on the live page.""", BX - 60, BY + 220, 1100, 300, 5)
log('E-E-A-T and page types (v4.4): business profile mode (author, reviewer, NAP; seo_profiles) loaded by every content run -> byline, author box, Person / WebPage reviewedBy schema, experience notes in the brief; case-study intake (seo_case_studies, stored proof cited by later pages, page run spawned, published status tracked); hub pages (ladder top page or "Pillar / hub page": cluster sections with link_to, linked table of contents, Guides in this series, ItemList); local pages (city/area, verified NAP block, LocalBusiness + Service areaServed); video pages (YouTube / Vimeo details, embed + transcript, VideoObject with key moments); publish check verifies author, date, TOC, cluster links, NAP and video on the live page')


# =============================================================================
# 19. GROWTH MONITORS (v4.5, 2026-10-02): on-demand "Check my AI visibility" / "Check my backlinks" (form + API) starting the new monitor workflows
#     (build_monitors.py), monitor settings per site on "Track my site" (seo_monitors), and the audit upgrades: crawl size / JavaScript options,
#     brand & entity check (Google Business Profile), audit history with the "since the last audit" diff, internal-link suggestions and the fix pack.
#     Also: every e-mail attaches files through `fileAttachments` (live finding: Send Email 2.1 ignores `attachmentsUi`; `attachments` is inline).
# =============================================================================
from ladder_common import (MONITORS_TABLE, MONITORS_COLS, AUDITS_TABLE, AUDITS_COLS, AUDIT_FINDINGS_TABLE, AUDIT_FINDINGS_COLS)
# ---------- A. intake: two new start options + pages; normalisation of monitor settings, crawl options, schedule flag ----------
nodes['Start Form']['parameters']['formFields']['values'][0]['fieldOptions']['values'] += [{'option': 'Check my AI visibility'}, {'option': 'Check my backlinks'}]
nodes['Start Form']['parameters']['formDescription'] += ' Check how ChatGPT, Perplexity, Gemini and Google AI answer your buyers\' questions, and watch your backlinks.'
for _key, _label, _page in [('ai_visibility', 'Check my AI visibility', 'Page AI Visibility'), ('backlinks', 'Check my backlinks', 'Page Backlinks')]:
    _i = len(nodes['Choose Path']['parameters']['rules']['values'])
    nodes['Choose Path']['parameters']['rules']['values'].append({'conditions': {'options': {'caseSensitive': False, 'leftValue': '', 'typeValidation': 'strict', 'version': 3}, 'conditions': [{'id': nid('Choose Path:' + _key), 'leftValue': "={{ $json['What do you want?'] }}", 'rightValue': _label, 'operator': {'type': 'string', 'operation': 'equals'}}], 'combinator': 'and'}, 'renameOutput': True, 'outputKey': _key})
    conns['Choose Path']['main'].insert(_i, [{'node': _page, 'type': 'main', 'index': 0}])
nodes['Unmatched Choice']['parameters']['jsCode'] = "throw new Error('Please choose one of the 13 options (I know my keyword / Suggest keywords / Just describe my website / Audit my website / Check if my keyword is right / Rank my site for a keyword / Track my site / I published a page / Search Console check-in / Write a case study / Set up my business profile / Check my AI visibility / Check my backlinks).');"
COMP19 = {'fieldLabel': 'Competitors (optional)', 'placeholder': 'up to 3 competitor domains, comma-separated, e.g. rival1.com, rival2.ae'}
add_node('Page AI Visibility', 'n8n-nodes-base.form', 2.5, {'formFields': {'values': [{'fieldLabel': 'Website Domain', 'placeholder': 'example.com', 'requiredField': True}, copy.deepcopy(COUNTRY18), {'fieldLabel': 'Main services or products (optional)', 'placeholder': 'e.g. e-invoicing implementation, Odoo ERP — the topics buyers ask AI about'}, COMP19,
    {'fieldLabel': 'Email me the report', 'fieldType': 'email', 'requiredField': True}]}, 'options': {'formTitle': 'Check my AI visibility', 'formDescription': 'We ask the questions your buyers ask ChatGPT, Perplexity, Gemini, Claude and Google AI Mode, and check Google\'s AI Overviews: are you recommended, are your pages cited, who wins instead and which sources the assistants trust. The report arrives by e-mail in about 10 minutes.', 'buttonLabel': 'Check it'}}, [448, 1760])
add_node('Page Backlinks', 'n8n-nodes-base.form', 2.5, {'formFields': {'values': [{'fieldLabel': 'Website Domain', 'placeholder': 'example.com', 'requiredField': True}, copy.deepcopy(COUNTRY18), COMP19,
    {'fieldLabel': 'Email me the report', 'fieldType': 'email', 'requiredField': True}]}, 'options': {'formTitle': 'Check my backlinks', 'formDescription': 'Links gained and lost, links pointing to broken pages, spam, unlinked brand mentions and the sites that link to your competitors but not to you, with outreach drafts. The report arrives by e-mail in about 5 minutes.', 'buttonLabel': 'Check it'}}, [448, 1960])
connect('Page AI Visibility', 'Normalize Input'); connect('Page Backlinks', 'Normalize Input')
insert_fields('Page Track', 'Blog posts per week', [COMP19])
_pa = nodes['Page Audit']['parameters']['formFields']['values']; _ri = next(i for i, f in enumerate(_pa) if f['fieldLabel'] == 'Report type') + 1
_pa.insert(_ri, {'fieldLabel': 'Render JavaScript', 'fieldType': 'dropdown', 'fieldOptions': {'values': [{'option': 'No (standard)'}, {'option': 'Yes, the site is built with JavaScript (slower)'}]}})
_pa.insert(_ri, {'fieldLabel': 'Pages to crawl', 'fieldType': 'dropdown', 'fieldOptions': {'values': [{'option': '200 (standard)'}, {'option': '500'}, {'option': '1000'}]}})
patch('Normalize Input', "else if (choice.includes('business profile')) mode = 'profile';", "else if (choice.includes('business profile')) mode = 'profile';\nelse if (choice.includes('ai visibility')) mode = 'ai_visibility';\nelse if (choice.includes('backlink')) mode = 'backlinks';")
patch('Normalize Input', "  else if (m === 'profile') mode = 'profile';", "  else if (m === 'profile') mode = 'profile';\n  else if (m === 'ai_visibility' || m === 'ai-visibility' || m === 'ai') mode = 'ai_visibility';\n  else if (m === 'backlinks' || m === 'links') mode = 'backlinks';")
patch('Normalize Input', "const pagesRaw = parseInt(", r"""// ---- v4.5: monitor settings (Track my site / API `monitors`), audit crawl options, scheduled audits ----
const MI = obj(p2.monitors);
const monitor_input = {}; for (const k of ['ai_visibility', 'ai_pulse', 'backlinks', 'audit_monthly', 'audit_js']) if (MI[k] !== undefined) monitor_input[k] = !!MI[k] && !/^(false|0|no|off)$/i.test(String(MI[k]));
if (MI.ai_engines !== undefined) monitor_input.ai_engines = asArray(MI.ai_engines).map(e => String(e).toLowerCase().trim()).filter(e => ['chatgpt', 'perplexity', 'gemini', 'claude', 'ai_overview', 'ai_mode'].includes(e)).join(', ');
if (MI.ai_prompts_max !== undefined) monitor_input.ai_prompts_max = Math.min(50, Math.max(3, parseInt(MI.ai_prompts_max, 10) || 20));   // v4.9: up to 50 questions
if (MI.audit_pages !== undefined) monitor_input.audit_pages = Math.min(1000, Math.max(50, parseInt(MI.audit_pages, 10) || 200));
if (MI.brand_names !== undefined) monitor_input.brand_names = asArray(MI.brand_names).join(', ');
const topics = asArray(p2.topics || lab('Main services or products (optional)')).map(x => String(x).trim().toLowerCase()).filter(x => x.length >= 3).slice(0, 6);
const crawlRaw = String(p2.crawl_pages || pick(p2, 'pages to crawl') || '').match(/\d+/);
const crawl_pages = crawlRaw ? Math.min(1000, Math.max(50, parseInt(crawlRaw[0], 10))) : CONFIG.crawl_max_pages;
const crawl_js_req = p2.crawl_js !== undefined ? (!!p2.crawl_js && !/^(false|0|no)$/i.test(String(p2.crawl_js))) : /^yes/i.test(String(pick(p2, 'javascript') || ''));
if (crawl_js_req && crawl_pages > 500) throw new Error('JavaScript rendering is limited to 500 pages per audit (it is about 10x slower); choose 500 or fewer pages.');
const pagesRaw = parseInt(""")
patch('Normalize Input', "if (mode === 'case_study' && !domain) throw new Error('Website Domain is required: the case study is written for your site.');",
      "if (mode === 'case_study' && !domain) throw new Error('Website Domain is required: the case study is written for your site.');\nif ((mode === 'ai_visibility' || mode === 'backlinks') && !domain) throw new Error('Website Domain is required.');\nif ((mode === 'ai_visibility' || mode === 'backlinks') && !deliverable) throw new Error('Please add your email — the report is sent by email.');")
patch('Normalize Input', "    crawl_max_pages: CONFIG.crawl_max_pages,\n    crawl_js: CONFIG.crawl_js,", "    crawl_max_pages: crawl_pages,\n    crawl_js: crawl_js_req || CONFIG.crawl_js,\n    scheduled: !!p2.scheduled,\n    monitor_input,\n    topics,")
patch('Rate Limit', "const internal = /^(ladder|cadence|tracker|casestudy):/.test(String(d.client_ip || ''));", "const internal = /^(ladder|cadence|tracker|casestudy|audit):/.test(String(d.client_ip || ''));")
patch('Rate Limit', "profile: 0, case_study: 0 };", "profile: 0, case_study: 0, ai_visibility: 0.06, backlinks: 0.04 };   // monitors: DataForSEO is the main cost (~$0.60 / ~$0.30 per check); Claude writes the questions, the brief and outreach drafts")
patch('Rate Limit', "else if (d.mode === 'case_study') est = EST.case_study;", "else if (d.mode === 'case_study') est = EST.case_study;\nelse if (d.mode === 'ai_visibility') est = EST.ai_visibility;\nelse if (d.mode === 'backlinks') est = EST.backlinks;")
patch('Check Crawl', "if ($runIndex > 25) {", "const __maxPolls = Math.min(50, 25 + Math.ceil(Math.max(0, (base.crawl_max_pages || 200) - 200) / 40) + (base.crawl_js ? 10 : 0));   // bigger / JavaScript crawls get more time (v4.5)\nif ($runIndex > __maxPolls) {")
# ---------- B. routing: the on-demand monitor runs ----------
route18('ai_visibility', 'Monitor Start'); route18('backlinks', 'Monitor Start')
MX, MY = TX, TY + 2100
add_node('Monitor Start', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Monitor_Start.js')}, [MX, MY])
if_node('AI Visibility Run?', "{{ $('Normalize Input').first().json.mode === 'ai_visibility' }}", [MX + 220, MY])
add_node('Start AI Visibility', 'n8n-nodes-base.executeWorkflow', 1.2, {'source': 'database', 'workflowId': {'__rl': True, 'mode': 'id', 'value': 'SEOagentAIVisib1'}, 'mode': 'once', 'options': {'waitForSubWorkflow': False}}, [MX + 440, MY - 120], {'onError': 'continueRegularOutput'})
add_node('Start Backlink Monitor', 'n8n-nodes-base.executeWorkflow', 1.2, {'source': 'database', 'workflowId': {'__rl': True, 'mode': 'id', 'value': 'SEOagentBacklnk1'}, 'mode': 'once', 'options': {'waitForSubWorkflow': False}}, [MX + 440, MY + 120], {'onError': 'continueRegularOutput'})
add_node('Monitor Started', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Monitor_Started.js')}, [MX + 660, MY])
if_node('Via Webhook (Monitor)?', "{{ !!$('Normalize Input').first().json.via_webhook }}", [MX + 880, MY])
add_node('Build Monitor Response', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Build_Monitor_Response.js')}, [MX + 1100, MY - 120])
add_node('Monitor Check Started', 'n8n-nodes-base.form', 2.5, {'operation': 'completion', 'completionTitle': "={{ $json.mode === 'ai_visibility' ? 'Your AI visibility check has started' : 'Your backlink check has started' }}", 'completionMessage': "={{ $json.plain }}", 'options': {}}, [MX + 1100, MY + 120])
connect('Monitor Start', 'AI Visibility Run?'); connect('AI Visibility Run?', 'Start AI Visibility', 0); connect('AI Visibility Run?', 'Start Backlink Monitor', 1)
connect('Start AI Visibility', 'Monitor Started'); connect('Start Backlink Monitor', 'Monitor Started'); connect('Monitor Started', 'Via Webhook (Monitor)?')
connect('Via Webhook (Monitor)?', 'Build Monitor Response', 0); connect('Via Webhook (Monitor)?', 'Monitor Check Started', 1); connect('Build Monitor Response', 'Has Callback?')
# ---------- C. "Track my site": monitor settings row ----------
_sc = pos('Save Cadence (Track)')
add_node('Ensure Monitors Table (Track)', DT_TYPE, DT_VERSION, dt_create_params(MONITORS_TABLE, MONITORS_COLS), [_sc[0] + 110, _sc[1] - 180], {'onError': 'continueRegularOutput'})
add_node('Load Monitors (Track)', DT_TYPE, DT_VERSION, dt_get_where_params(MONITORS_TABLE, 'site_id', 'eq', SITE18), [_sc[0] + 330, _sc[1] - 180], LOAD18)
add_node('Monitor Row (Track)', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Monitor_Row_Track.js')}, [_sc[0] + 550, _sc[1] - 180])
add_node('Save Monitors (Track)', DT_TYPE, DT_VERSION, dt_upsert_params(MONITORS_TABLE, MONITORS_COLS, 'site_id'), [_sc[0] + 770, _sc[1] - 180], {'onError': 'continueRegularOutput', 'alwaysOutputData': True})
disconnect('Save Cadence (Track)', 'Tracker Payload (Track)')
for a, b in [('Save Cadence (Track)', 'Ensure Monitors Table (Track)'), ('Ensure Monitors Table (Track)', 'Load Monitors (Track)'), ('Load Monitors (Track)', 'Monitor Row (Track)'), ('Monitor Row (Track)', 'Save Monitors (Track)'), ('Save Monitors (Track)', 'Tracker Payload (Track)')]:
    connect(a, b)
# ---------- D. audit: brand & entity check (between the Search Console step and the scoring) ----------
patch('Analyze Probes', "        sitemap_urls: locs.length,\n", "        sitemap_urls: locs.length,\n        robots_txt: robotsText.slice(0, 20000),\n        ai_crawlers_blocked: aiBlocked,\n        llms_txt_present: llms.status === 200 && llms.body.length > 100 && !/<html/i.test(llms.body),\n")
SITE_AUDIT19 = "={{ 'site_' + String($('Check Crawl').first().json.domain || 'none').toLowerCase().replace(/[^a-z0-9]+/g, '-') }}"
_gf = pos('GSC Audit Findings'); EX, EY = _gf[0], _gf[1] + 360
disconnect('GSC Audit Findings', 'Build Site Issues')
add_node('Load Profile (Audit)', DT_TYPE, DT_VERSION, dt_get_where_params(PROFILE_TABLE, 'site_id', 'eq', SITE_AUDIT19), [EX, EY], LOAD18)
add_node('GBP Request', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/GBP_Request.js')}, [EX + 220, EY])
if_node('Look Up GBP?', "{{ !$json.skip }}", [EX + 440, EY])
add_node('Fetch GBP', 'n8n-nodes-base.httpRequest', 4.5, DFS_HTTP(), [EX + 660, EY - 120], {'onError': 'continueRegularOutput', 'retryOnFail': True, 'maxTries': 2, 'waitBetweenTries': 3000})
add_node('Entity Check', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Entity_Check.js')}, [EX + 880, EY])
for a, b in [('GSC Audit Findings', 'Load Profile (Audit)'), ('Load Profile (Audit)', 'GBP Request'), ('GBP Request', 'Look Up GBP?'), ('Fetch GBP', 'Entity Check'), ('Entity Check', 'Build Site Issues')]:
    connect(a, b)
connect('Look Up GBP?', 'Fetch GBP', 0); connect('Look Up GBP?', 'Entity Check', 1)
slot('Fetch GBP', 'dataforseo')
patch('Build Site Issues', "      site_structure: input.site_structure || null,\n", "      site_structure: input.site_structure || null,\n      entity: input.entity || null,\n")
# ---------- E. audit: history, diff, internal links, fix pack (between the scoring and the report) ----------
_bs = pos('Build Site Issues'); HX, HY = _bs[0], _bs[1] + 400
disconnect('Build Site Issues', 'Is Full Report?')
add_node('Ensure Audits Table', DT_TYPE, DT_VERSION, dt_create_params(AUDITS_TABLE, AUDITS_COLS), [HX, HY], {'onError': 'continueRegularOutput'})
add_node('Ensure Findings Table', DT_TYPE, DT_VERSION, dt_create_params(AUDIT_FINDINGS_TABLE, AUDIT_FINDINGS_COLS), [HX + 200, HY], {'onError': 'continueRegularOutput'})
add_node('Load Audit History', DT_TYPE, DT_VERSION, dt_get_where_params(AUDITS_TABLE, 'site_id', 'eq', SITE_AUDIT19), [HX + 400, HY], LOAD18)
add_node('Load Audit Findings', DT_TYPE, DT_VERSION, dt_get_where_params(AUDIT_FINDINGS_TABLE, 'site_id', 'eq', SITE_AUDIT19), [HX + 600, HY], LOAD18)
add_node('Audit Diff', 'n8n-nodes-base.code', 2, {'jsCode': "const __scored = $('Build Site Issues').first();   // the scored audit (the input here is the last table load)\n" + rd('code/Audit_Diff.js').replace("const d = $input.first().json;", "const d = __scored.json;")}, [HX + 800, HY])
add_node('Audit Row', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Audit_Row.js')}, [HX + 1000, HY])
add_node('Save Audit', DT_TYPE, DT_VERSION, dt_insert_params(AUDITS_TABLE, AUDITS_COLS), [HX + 1200, HY], {'onError': 'continueRegularOutput', 'alwaysOutputData': True})
add_node('Finding Rows', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Finding_Rows.js')}, [HX + 1400, HY])
if_node('Any Finding Rows?', "{{ !$json.skip }}", [HX + 1600, HY])
add_node('Save Findings', DT_TYPE, DT_VERSION, dt_insert_params(AUDIT_FINDINGS_TABLE, AUDIT_FINDINGS_COLS), [HX + 1800, HY - 120], {'onError': 'continueRegularOutput', 'alwaysOutputData': True})
add_node('Fix Pack', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Fix_Pack.js')}, [HX + 2000, HY])
add_node('Zip Fix Pack', 'n8n-nodes-base.compression', 1.1, {'operation': 'compress', 'binaryPropertyName': "={{ $json.fix_props.join(',') }}", 'outputFormat': 'zip', 'fileName': "=fix-pack-{{ $json.site_id.replace(/^site_/, '') }}.zip", 'binaryPropertyOutput': 'fix_pack_zip'}, [HX + 2200, HY], {'onError': 'continueRegularOutput'})
add_node('Restore Audit Item', 'n8n-nodes-base.code', 2, {'jsCode': "// The audit item with the fix-pack files and, when zipping worked, fix-pack.zip for the e-mail (the Compression node replaces the item's binaries).\nconst f = $('Fix Pack').first(); let zip = null; try { const z = $input.first(); zip = z && z.binary && z.binary.fix_pack_zip && !(z.json && z.json.error) ? z.binary.fix_pack_zip : null; } catch (e) {}\nreturn [{ json: { ...f.json, fix_pack_zipped: !!zip }, binary: { ...(f.binary || {}), ...(zip ? { fix_pack_zip: { ...zip, mimeType: 'application/zip' } } : {}) } }];"}, [HX + 2400, HY])
for a, b in [('Build Site Issues', 'Ensure Audits Table'), ('Ensure Audits Table', 'Ensure Findings Table'), ('Ensure Findings Table', 'Load Audit History'), ('Load Audit History', 'Load Audit Findings'), ('Load Audit Findings', 'Audit Diff'), ('Audit Diff', 'Audit Row'), ('Audit Row', 'Save Audit'), ('Save Audit', 'Finding Rows'), ('Finding Rows', 'Any Finding Rows?'), ('Save Findings', 'Fix Pack'), ('Fix Pack', 'Zip Fix Pack'), ('Zip Fix Pack', 'Restore Audit Item'), ('Restore Audit Item', 'Is Full Report?')]:
    connect(a, b)
connect('Any Finding Rows?', 'Save Findings', 0); connect('Any Finding Rows?', 'Fix Pack', 1)
# report sections: since the last audit, internal links, brand & entity, fix pack (both report types)
DIFF_SECTION_JS = r"""// ---- v4.5 sections: since the last audit, internal links to add, brand & entity, fix pack ----
const v45Section = (a, num) => {
  const e2 = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const p2 = (u) => String(u || '').replace(/^https?:\/\/[^\/]+/, '') || '/';
  const D = a.audit_diff || {}; const IL = a.internal_links || []; const E = a.entity || {}; const FP = a.fix_pack || {};
  let h = `<h2 class="pb">${num}. Progress, Links, Brand & Fix Pack</h2><h3>Since the last audit</h3>`;
  if (D.baseline !== false) h += `<p>${e2(D.summary || 'First audit stored.')}</p>`;
  else {
    h += `<p>Previous audit ${e2(String(D.previous.audited_at).slice(0, 10))} (${D.days_since} days ago): score ${D.previous.health_score} → <b>${a.health_score}</b> (${D.score_delta > 0 ? '+' : ''}${D.score_delta}). ${e2(D.summary)}.</p>`;
    const rows = [...D.fixed.slice(0, 15).map(f => ['<span class="ok">fixed</span>', f.severity, f.title]), ...D.new.slice(0, 15).map(f => ['<span class="bad">new</span>', f.severity, f.title]), ...D.open.slice(0, 15).map(f => ['still open', f.severity + (f.was && f.was !== f.severity ? ' (was ' + f.was + ')' : ''), f.title + (f.affected != null && f.affected_before != null && f.affected !== f.affected_before ? ' — ' + f.affected_before + ' → ' + f.affected + ' affected' : '')])];
    if (rows.length) h += `<table class="ct"><tr><th>Status</th><th>Severity</th><th>Finding</th></tr>` + rows.map(r => `<tr><td>${r[0]}</td><td>${e2(r[1])}</td><td>${e2(r[2])}</td></tr>`).join('') + `</table>`;
  }
  h += `<h3>Internal links to add</h3>`;
  h += IL.length ? `<p>Pages with few or no links pointing to them, and strong pages on the same topic that can link to them (also in the fix pack as internal-links.csv).</p><table class="ct"><tr><th>On page</th><th>Link to</th><th>Anchor text</th><th>Why</th></tr>` + IL.slice(0, 15).map(l => `<tr><td>${e2(p2(l.from_url))}</td><td>${e2(p2(l.to_url))}</td><td>${e2(l.anchor)}</td><td>${e2(l.reason)}</td></tr>`).join('') + `</table>` : `<p>No page needs extra internal links.</p>`;
  h += `<h3>Brand & entity consistency</h3>`;
  if (!E.business_name) h += `<p>Not checked: no business name on file. Set up the business profile so name, address and phone can be compared with Google Business Profile.</p>`;
  else { const g = E.gbp; h += `<table class="ct"><tr><th></th><th>Google Business Profile</th><th>Your site / profile</th></tr><tr><td>Name</td><td>${e2(g ? g.title : 'not found')}</td><td>${e2(E.business_name)}</td></tr><tr><td>Phone</td><td>${e2(g ? g.phone : '—')}</td><td>${e2([(E.homepage_org || {}).telephone, ...(E.homepage_phones || [])].filter(Boolean).slice(0, 2).join(', ') || '—')}</td></tr><tr><td>Website</td><td>${e2(g ? g.website : '—')}</td><td>${e2(a.domain)}</td></tr>` + (g ? `<tr><td>Rating</td><td>${e2(g.rating != null ? g.rating + '★ (' + (g.reviews || 0) + ' reviews)' : '—')}${g.claimed ? '' : ' · <span class="bad">unclaimed</span>'}</td><td></td></tr>` : '') + `<tr><td>Official profiles (sameAs)</td><td colspan="2">${e2(((E.homepage_org || {}).sameAs || []).join(', ') || 'none in the homepage schema')}</td></tr></table>`; }
  h += `<h3>Fix pack (attached)</h3>` + ((FP.files || []).length ? `<table class="ct"><tr><th>File</th><th>What to do with it</th></tr>` + FP.files.map(f => `<tr><td>${e2(f.name)}</td><td>${e2(f.purpose)}</td></tr>`).join('') + `</table>` : `<p>No files.</p>`);
  return h;
};
"""
patch('Build Audit Report', "const findings = a.findings || [];", DIFF_SECTION_JS + "const findings = a.findings || [];")
patch('Build Audit Report', "html += scSection(a, '5b');\n", "html += scSection(a, '5b');\nhtml += v45Section(a, '5c');\n")
patch('Build Audit Report', "<li>Search Console &amp; Site Structure (5b)</li>", "<li>Search Console &amp; Site Structure (5b)</li><li>Progress, Links, Brand &amp; Fix Pack (5c)</li>")
patch('Build Full Report', "const findings = a.findings || [];", DIFF_SECTION_JS + "const findings = a.findings || [];")
patch('Build Full Report', "html += scSection(a, '12b');\n", "html += scSection(a, '12b');\nhtml += v45Section(a, '12c');\n")
_c = code('Build Full Report'); assert _c.count("'Search Console & Site Structure (12b)', '") == 1
setcode('Build Full Report', _c.replace("'Search Console & Site Structure (12b)', '", "'Search Console & Site Structure (12b)', 'Progress, Links, Brand & Fix Pack (12c)', '", 1))
# the PDF attach step keeps the fix pack; the e-mail and the callback carry it
patch('Attach PDF Audit', "return [{ json:", "let __fp = {}; try { __fp = $('Restore Audit Item').first().binary || {}; } catch (e) {}\nif (__fp.fix_pack_zip) binary.fix_pack_zip = __fp.fix_pack_zip; else for (const k of Object.keys(__fp)) if (k.startsWith('fix_')) binary[k] = __fp[k];\nreturn [{ json:") if code('Attach PDF Audit').count("return [{ json:") == 1 else None
_sar = nodes['Send Audit Report']['parameters']
_sar['options'].pop('attachments', None); _sar['options']['fileAttachments'] = "={{ ['pdf', 'data', ...($binary.fix_pack_zip ? ['fix_pack_zip'] : Object.keys($binary).filter(k => k.startsWith('fix_')))].filter(k => $binary[k]).join(',') }}"
assert _sar['html'].count('<p>The full report is attached.</p>') == 1
_sar['html'] = _sar['html'].replace('<p>The full report is attached.</p>', "<p>The full report is attached{{ $binary.fix_pack_zip || $binary.fix_robots ? ', with the <b>fix pack</b> (robots.txt, llms.txt, redirect map, schema files, internal links to add; see README.txt)' : '' }}.</p>{{ (() => { try { const D = $('Restore Audit Item').first().json.site_audit.audit_diff; return D && D.baseline === false ? '<p><b>Since the last audit (' + String(D.previous.audited_at).slice(0, 10) + '):</b> score ' + D.previous.health_score + ' → ' + $json.health_score + '; ' + D.summary + '.</p>' : ''; } catch (e) { return ''; } })() }}")
patch('Build Audit Response', "  site_structure: d.site_structure || null,", "  site_structure: d.site_structure || null,\n  ...(() => { try { const r = $('Restore Audit Item').first().json; const a = r.site_audit || {}; return { audit_id: r.audit_id, audit_diff: a.audit_diff || null, internal_links: a.internal_links || [], entity: a.entity || null, fix_pack: r.fix_pack || null }; } catch (e) { return {}; } })(),")
# ---------- F. every e-mail attaches real files (fileAttachments); inline `attachments` and the ignored `attachmentsUi` are dropped ----------
for _n in nodes.values():
    if _n['type'] != 'n8n-nodes-base.emailSend': continue
    _o = _n['parameters'].setdefault('options', {})
    if _n['name'] == 'Send Report': _o['fileAttachments'] = "={{ ['pdf', 'data', 'article_html', 'article_md', 'meta_json'].filter(k => $binary[k]).join(',') }}"
    elif 'fileAttachments' not in _o and (_o.get('attachments') or _o.get('attachmentsUi')): _o['fileAttachments'] = "={{ ['pdf', 'data'].filter(k => $binary[k]).join(',') }}"
    _o.pop('attachments', None); _o.pop('attachmentsUi', None)
    _n['retryOnFail'] = True; _n['maxTries'] = 3; _n['waitBetweenTries'] = 5000   # live finding 2026-10-02: a transient DNS failure (EAI_AGAIN smtp.gmail.com) lost two e-mails
# ---------- G. full report: the link gap read the wrong field (domain_intersection items carry the linking domain in `target`) ----------
patch('Analyze Backlinks', "referring_domain: first.domain || it.domain || it.referring_domain || null", "referring_domain: first.target || first.domain || it.domain || it.referring_domain || null")
# ---------- H. notes ----------
nodes['Note 1']['parameters']['content'] = nodes['Note 1']['parameters']['content'].replace("· **Set up my business profile**", "· **Check my AI visibility** / **Check my backlinks** (on-demand runs of the AI Visibility Tracker / Backlink Monitor) · **Set up my business profile**", 1)
sticky("""### Growth monitors and audit upgrades (v4.5)
**Workflows** (build_monitors.py): *AI Visibility Tracker* (Mon 07:00: buyer questions × ChatGPT / Perplexity / Gemini / Claude / Google AI Mode + AI Overviews → mention & citation rate, share of voice, sources AI trusts, lost questions), *Backlink Monitor* (Mon 07:30 light watch, monthly full report: lost / new / broken / spam, link gap, unlinked mentions, prospects with outreach drafts) and *Audit Scheduler* (1st of the month: technical re-audit per site). Settings per site in `seo_monitors` ("Track my site" competitors / API `monitors`, Site Admin `monitors`). Form / API `ai_visibility` and `backlinks` start a run at once.
**Every audit** now: crawl size 200 / 500 / 1000 and JavaScript rendering; **brand & entity check** against the Google Business Profile (name, phone, website, claimed) and the homepage Organization schema (sameAs); stored in `seo_audits` / `seo_audit_findings` → **since the last audit** (fixed / new / still open, score change); **internal links to add**; **fix pack** (robots.txt, llms.txt, redirect map, schema, internal-links.csv, README; zipped for the e-mail, text in the callback).""", HX - 60, HY + 220, 1150, 260, 5)
log('Growth monitors (v4.5): on-demand modes ai_visibility / backlinks (form + API) starting the new AI Visibility Tracker / Backlink Monitor workflows; monitor settings per site on Track my site (seo_monitors); audits: crawl size and JavaScript options, brand & entity check (Google Business Profile, Organization sameAs), audit history (seo_audits, seo_audit_findings) with the since-the-last-audit diff, internal-link suggestions and a fix pack (robots.txt, llms.txt, redirect map, schema, internal links; zipped); every e-mail attaches files through fileAttachments; full-report link gap reads the linking domain from `target`')


# =============================================================================
# 20. NO REPEATED WORK (v4.6, 2026-10-02): what the database already knows is reused instead of paid for again; nothing an SEO result needs is
#     dropped. Full report: domain registration dates cached (seo_cache 'age:<domain>', 365 days) and looked up free through RDAP first, paid
#     WHOIS only for the gaps (WHOIS was $0.48 of a $1.02 report). Keyword / ladder / cadence runs: the homepage description is reused for
#     30 days ('desc:<domain>'). Content: the editor pass is skipped only when the draft already passes every SEO check (style notes only).
# =============================================================================
from ladder_common import CACHE_TABLE, CACHE_COLS
# ---------- A. domain ages: cache -> RDAP (free) -> WHOIS (paid, only what RDAP cannot answer) ----------
_wp = pos('DataForSEO Whois'); AX20, AY20 = _wp[0] - 220, _wp[1] + 420
disconnect('Domain Overview', 'DataForSEO Whois'); disconnect('DataForSEO Whois', 'RDAP Lookup'); disconnect('RDAP Lookup', 'Competitor Analysis')
add_node('Ensure Cache Table (Ages)', DT_TYPE, DT_VERSION, dt_create_params(CACHE_TABLE, CACHE_COLS), [AX20, AY20], {'onError': 'continueRegularOutput', 'executeOnce': True})
add_node('Load Age Cache', DT_TYPE, DT_VERSION, dt_get_where_params(CACHE_TABLE, 'kind', 'eq', 'age'), [AX20 + 220, AY20], LOAD18)
add_node('Age Lookup Plan', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Age_Lookup_Plan.js')}, [AX20 + 440, AY20])
if_node('Need Age Lookup?', "{{ !$json.skip }}", [AX20 + 660, AY20])
nodes['RDAP Lookup']['position'] = [AX20 + 880, AY20 - 120]
nodes['RDAP Lookup']['parameters']['url'] = "=https://rdap.org/domain/{{ $json.domain }}"
add_node('RDAP Results', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/RDAP_Results.js')}, [AX20 + 1100, AY20 - 120])
if_node('Need WHOIS?', "{{ !$json.skip }}", [AX20 + 1320, AY20 - 120])
nodes['DataForSEO Whois']['position'] = [AX20 + 1540, AY20 - 240]; nodes['DataForSEO Whois']['onError'] = 'continueRegularOutput'
assert "$('Pick Competitors').item.json.domain" in nodes['DataForSEO Whois']['parameters']['jsonBody']
nodes['DataForSEO Whois']['parameters']['jsonBody'] = nodes['DataForSEO Whois']['parameters']['jsonBody'].replace("$('Pick Competitors').item.json.domain", "$json.domain")
add_node('Domain Ages', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Domain_Ages.js')}, [AX20 + 1760, AY20])
add_node('Age Rows', 'n8n-nodes-base.code', 2, {'jsCode': "// New registration dates to store (seo_cache, upsert by key; exact columns).\nconst rows = $input.first().json.rows || [];\nreturn rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];"}, [AX20 + 1980, AY20])
if_node('Any New Ages?', "{{ !$json.skip }}", [AX20 + 2200, AY20])
add_node('Save Ages', DT_TYPE, DT_VERSION, dt_upsert_params(CACHE_TABLE, CACHE_COLS, 'key'), [AX20 + 2420, AY20 - 120], {'onError': 'continueRegularOutput', 'alwaysOutputData': True})
for a, b in [('Domain Overview', 'Ensure Cache Table (Ages)'), ('Ensure Cache Table (Ages)', 'Load Age Cache'), ('Load Age Cache', 'Age Lookup Plan'), ('Age Lookup Plan', 'Need Age Lookup?'),
             ('RDAP Lookup', 'RDAP Results'), ('RDAP Results', 'Need WHOIS?'), ('DataForSEO Whois', 'Domain Ages'), ('Domain Ages', 'Age Rows'), ('Age Rows', 'Any New Ages?'), ('Save Ages', 'Competitor Analysis')]:
    connect(a, b)
connect('Need Age Lookup?', 'RDAP Lookup', 0); connect('Need Age Lookup?', 'Domain Ages', 1); connect('Need WHOIS?', 'DataForSEO Whois', 0); connect('Need WHOIS?', 'Domain Ages', 1)
connect('Any New Ages?', 'Save Ages', 0); connect('Any New Ages?', 'Competitor Analysis', 1)
patch('Competitor Analysis', "const ages = $('DataForSEO Whois').all().map(i => i.json);\nconst rdaps = $input.all().map(i => i.json);   // free RDAP lookup, fills the gaps in DataForSEO WHOIS",
      "const AGES = $('Domain Ages').first().json.ages || {};   // v4.6: stored registration dates; free RDAP first, paid WHOIS only for the gaps")
patch('Competitor Analysis', "  const w = ages[i]?.tasks?.[0]?.result?.[0]?.items?.[0] || null;\n  const rdap = (((rdaps[i] || {}).events) || []).find(e => /registration/i.test(e.eventAction || ''));\n  const regRaw = (w && (w.created_datetime || w.created_date)) || (rdap && rdap.eventDate) || null;",
      "  const regRaw = (AGES[String(c.domain || '').toLowerCase()] || {}).registered || null;")
# ---------- B. homepage description: reused for 30 days, saved after every fresh read ----------
_ns = pos('Need Site Read?'); DX20, DY20 = _ns[0] - 660, _ns[1] - 260
disconnect('Input OK?', 'Need Site Read?')
add_node('Ensure Cache Table (Site)', DT_TYPE, DT_VERSION, dt_create_params(CACHE_TABLE, CACHE_COLS), [DX20, DY20], {'onError': 'continueRegularOutput', 'executeOnce': True})
add_node('Load Site Cache', DT_TYPE, DT_VERSION, dt_get_where_params(CACHE_TABLE, 'key', 'eq', "={{ 'desc:' + String($('Rate Limit').first().json.domain || 'none').toLowerCase() }}"), [DX20 + 220, DY20], LOAD18)
add_node('Use Cached Description', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Use_Cached_Description.js')}, [DX20 + 440, DY20])
_ib = conns['Input OK?']['main'][0]; _ib.insert(0, {'node': 'Ensure Cache Table (Site)', 'type': 'main', 'index': 0})
for a, b in [('Ensure Cache Table (Site)', 'Load Site Cache'), ('Load Site Cache', 'Use Cached Description'), ('Use Cached Description', 'Need Site Read?')]:
    connect(a, b)
_pd = pos('Parse Description')
disconnect('Parse Description', 'Route Mode')
add_node('Description Cache Row', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Description_Cache_Row.js')}, [_pd[0], _pd[1] + 200])
add_node('Save Description', DT_TYPE, DT_VERSION, dt_upsert_params(CACHE_TABLE, CACHE_COLS, 'key'), [_pd[0] + 220, _pd[1] + 200], {'onError': 'continueRegularOutput', 'alwaysOutputData': True})
add_node('Restore Description', 'n8n-nodes-base.code', 2, {'jsCode': "// The run continues with the fresh description (the Data Table upsert outputs the stored row, not the run's item).\nreturn [{ json: $('Parse Description').first().json }];"}, [_pd[0] + 440, _pd[1] + 200])
for a, b in [('Parse Description', 'Description Cache Row'), ('Description Cache Row', 'Save Description'), ('Save Description', 'Restore Description'), ('Restore Description', 'Route Mode')]:
    connect(a, b)
# ---------- C. content: one editor pass only when it can still improve the page (Content_QA.js computes editor_needed) ----------
_nr = nodes['Needs Revision?']['parameters']['conditions']['conditions'][0]
assert _nr['leftValue'] == "={{ $json.content_qa.passed === false && $json.qa_round < ($json.qa_max_rounds || 2) }}"
_nr['leftValue'] = "={{ $json.content_qa.passed === false && $json.content_qa.editor_needed !== false && $json.qa_round < ($json.qa_max_rounds || 2) }}"
sticky("""### No repeated work (v4.6)
**Domain ages** (full report): stored in `seo_cache` for a year; looked up through free RDAP first, paid WHOIS only for what RDAP cannot answer. **Homepage description**: reused for 30 days by keyword / ladder / cadence runs ("Just describe my website" always reads fresh; typed details always win). **Editor pass**: skipped only when the draft already scores 90+, the review rates it 85+ with no high-severity problem and only style notes remain; every SEO check still forces it.""", AX20 - 40, AY20 + 200, 900, 180, 6)
log('No repeated work (v4.6): domain registration dates cached a year (seo_cache) with free RDAP before paid WHOIS; the homepage description reused for 30 days; the editor pass runs only when the draft misses an SEO check or the review finds a real problem')

# =============================================================================
# 21. WEB APP REQUESTS (v4.7, 2026-10-03): the React app (app/, multi-company) calls the API front door from one server, so every request
#     would share one client IP key (6 runs/day for all companies together). The app sends `X-Forwarded-For: app:<company id>`; Quick
#     Validate turns that into client_ip, and the Rate Limit keys those runs per company with their own daily cap (the app enforces each
#     company's monthly budget before it calls n8n). The global daily cap and the AI budget guard still apply to everything.
# =============================================================================
patch('Rate Limit', "const LIMITS = { per_key_per_day: 6, global_per_day: 150 };",
      "const LIMITS = { per_key_per_day: 6, global_per_day: 150, per_app_company_per_day: 40 };   // app: requests from the web app, keyed per company (v4.7)")
patch('Rate Limit', "const key = (internal ? d.client_ip : (d.email || d.client_ip || d.domain || d.keyword || 'anon')).toLowerCase();",
      "const fromApp = /^app:[a-z0-9-]{6,64}$/i.test(String(d.client_ip || ''));   // the web app: one key per company, whoever's e-mail gets the copy\n"
      "const key = ((internal || fromApp) ? d.client_ip : (d.email || d.client_ip || d.domain || d.keyword || 'anon')).toLowerCase();\n"
      "const perKey = fromApp ? LIMITS.per_app_company_per_day : LIMITS.per_key_per_day;")
patch('Rate Limit', "if (used >= LIMITS.per_key_per_day && !['published', 'checkin', 'profile'].includes(d.mode)) {",
      "if (used >= perKey && !['published', 'checkin', 'profile'].includes(d.mode)) {")
patch('Rate Limit', "validation_error: 'You have reached the daily limit of ' + LIMITS.per_key_per_day + ' runs. Please try again tomorrow.'",
      "validation_error: 'You have reached the daily limit of ' + perKey + ' runs. Please try again tomorrow.'")
log('Web app requests (v4.7): X-Forwarded-For app:<company> keys the Rate Limit per company (40 runs/day) instead of one shared IP key; global cap and AI budget unchanged')


# =============================================================================
# 22. THE RIGHT KEYWORD AND THE RIGHT PLAN (v4.8, 2026-10-03, PIPELINE_FEATURE_SPEC §5, §9.1 items 3-4): every ladder and every discovery with a
#     website is measured against the site's REACH (the difficulty it already wins; v5/code/_reach.js, one copy inlined everywhere; seo_cache
#     'reach:<site_id>', 30 days). Ladder: rungs relative to reach, plan type from the main keyword's difficulty for this site (direct = main page
#     first / short / full / none), keywords of the site's other ladders never planned again, a duplicate main keyword refused, and one
#     seo_ladder_settings row per new ladder. Discovery: labels (difficulty for your site, plan, months) and Now / Next / Later from reach.
#     The synchronous keyword check (SEOagentAssess) is built in build_api.py.
# =============================================================================
from ladder_common import LADDER_SETTINGS_TABLE, LADDER_SETTINGS_COLS, dt_get_any_params
SITE_ID_EXPR = "String($('Rate Limit').first().json.domain || 'none').toLowerCase().replace(/^www\\./, '').replace(/[^a-z0-9]+/g, '-')"
# ---------- A. one cache read per run: the homepage description AND the site's reach ----------
_lsc = nodes['Load Site Cache']['parameters']
assert _lsc['matchType'] == 'allConditions' and len(_lsc['filters']['conditions']) == 1 and _lsc['filters']['conditions'][0]['keyValue'].startswith("={{ 'desc:'")
_lsc['matchType'] = 'anyCondition'
_lsc['filters']['conditions'].append({'keyName': 'key', 'condition': 'eq', 'keyValue': "={{ 'reach:site_' + " + SITE_ID_EXPR + " }}"})
# ---------- B. ladder: the site's other ladders and their settings, loaded before the research ----------
_lr = pos('Ladder Requests'); LX22, LY22 = _lr[0] - 880, _lr[1] + 260
disconnect('Ladder Mode?', 'Ladder Requests')
DOMAIN_PV = "={{ String($('Parse Verdict').first().json.domain || '').toLowerCase() }}"
add_node('Ensure Ladder Table (Plan)', DT_TYPE, DT_VERSION, dt_create_params(LADDER_TABLE, LADDER_COLS), [LX22, LY22], {'onError': 'continueRegularOutput', 'executeOnce': True})
add_node('Load Domain Ladders', DT_TYPE, DT_VERSION, dt_get_any_params(LADDER_TABLE, [('domain', DOMAIN_PV), ('domain', "={{ 'www.' + String($('Parse Verdict').first().json.domain || '').toLowerCase() }}")]), [LX22 + 220, LY22], LOAD18)
add_node('Ensure Ladder Settings Table (Ladder)', DT_TYPE, DT_VERSION, dt_create_params(LADDER_SETTINGS_TABLE, LADDER_SETTINGS_COLS), [LX22 + 440, LY22], {'onError': 'continueRegularOutput', 'executeOnce': True})
add_node('Load Domain Ladder Settings', DT_TYPE, DT_VERSION, dt_get_any_params(LADDER_SETTINGS_TABLE, [('domain', DOMAIN_PV), ('site_id', "={{ 'site_' + String($('Parse Verdict').first().json.domain || '').toLowerCase().replace(/^www\\./, '').replace(/[^a-z0-9]+/g, '-') }}")]), [LX22 + 660, LY22], LOAD18)
connect('Ladder Mode?', 'Ensure Ladder Table (Plan)', 0)
for a, b in [('Ensure Ladder Table (Plan)', 'Load Domain Ladders'), ('Load Domain Ladders', 'Ensure Ladder Settings Table (Ladder)'), ('Ensure Ladder Settings Table (Ladder)', 'Load Domain Ladder Settings'), ('Load Domain Ladder Settings', 'Ladder Requests')]:
    connect(a, b)
# ---------- C. ladder: a newly measured reach is stored for discovery and the keyword check ----------
_lp = pos('Ladder Plan')
disconnect('Ladder Plan', 'Build Ladder Report')
add_node('Reach Row (Ladder)', 'n8n-nodes-base.code', 2, {'jsCode': "// v4.8: a newly measured reach goes to seo_cache ('reach:<site_id>', 30 days) for discovery and the keyword check (exact columns).\nconst r = $('Ladder Plan').first().json.reach_cache_row;\nreturn [{ json: r || { skip: true } }];"}, [_lp[0], _lp[1] + 220])
if_node('New Reach (Ladder)?', "{{ !$json.skip }}", [_lp[0] + 220, _lp[1] + 220])
add_node('Save Reach (Ladder)', DT_TYPE, DT_VERSION, dt_upsert_params(CACHE_TABLE, CACHE_COLS, 'key'), [_lp[0] + 440, _lp[1] + 360], {'onError': 'continueRegularOutput', 'alwaysOutputData': True})
connect('Ladder Plan', 'Reach Row (Ladder)'); connect('Reach Row (Ladder)', 'New Reach (Ladder)?')
connect('New Reach (Ladder)?', 'Save Reach (Ladder)', 0); connect('New Reach (Ladder)?', 'Build Ladder Report', 1); connect('Save Reach (Ladder)', 'Build Ladder Report')
# ---------- D. ladder: rows only for a planned ladder; then its seo_ladder_settings row (+ priorities that keep the existing order) ----------
_lw = pos('Ladder Rows')
disconnect('Ladder Rows', 'Save Ladder Rows'); disconnect('Save Ladder Rows', 'Ladder Delivery')
if_node('Any Ladder Rows?', "{{ !$json.skip }}", [_lw[0] + 110, _lw[1] + 200])
add_node('Ladder Settings Rows', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Ladder_Settings_Rows.js')}, [_lw[0] + 330, _lw[1] + 200])
if_node('Any Settings Rows?', "{{ !$json.skip }}", [_lw[0] + 550, _lw[1] + 200])
add_node('Save Ladder Settings', DT_TYPE, DT_VERSION, dt_upsert_params(LADDER_SETTINGS_TABLE, LADDER_SETTINGS_COLS, 'ladder_id'), [_lw[0] + 770, _lw[1] + 200], {'onError': 'continueRegularOutput', 'alwaysOutputData': True})
connect('Ladder Rows', 'Any Ladder Rows?'); connect('Any Ladder Rows?', 'Save Ladder Rows', 0); connect('Any Ladder Rows?', 'Ladder Delivery', 1)
connect('Save Ladder Rows', 'Ladder Settings Rows'); connect('Ladder Settings Rows', 'Any Settings Rows?')
connect('Any Settings Rows?', 'Save Ladder Settings', 0); connect('Any Settings Rows?', 'Ladder Delivery', 1); connect('Save Ladder Settings', 'Ladder Delivery')
# e-mail and form page for a refused ladder (duplicate main keyword / not realistic) and the plan for this site
_sl = nodes['Send Ladder Report']['parameters']
_old = "<p>{{ $json.tracking_registered ? 'Positions are checked weekly; you will receive a progress e-mail with the next rung to work on.' : 'Note: the ladder could not be registered for tracking (' + ($json.store_error || 'Data Tables unavailable') + ').' }}</p>"
assert _sl['html'].count(_old) == 1
_sl['html'] = _sl['html'].replace(_old, "<p>{{ ($json.ladder && $json.ladder.label) ? 'Plan for your site: ' + $json.ladder.label + ' (reach ' + $json.ladder.reach + ').' : '' }}</p>"
    "<p>{{ ($json.ladder && $json.ladder.planned === false) ? 'No ladder was planned. ' + String(($json.ladder.refusal || {}).message || '').replace(/</g, '&lt;') : ($json.tracking_registered ? 'Positions are checked weekly; you will receive a progress e-mail with the next rung to work on.' : 'Note: the ladder could not be registered for tracking (' + ($json.store_error || 'Data Tables unavailable') + ').') }}</p>")
_dl = nodes['Download Ladder Plan']['parameters']
assert _dl['completionMessage'].startswith('The plan is downloading. The first page is being written now')
_dl['completionMessage'] = "={{ ($json.ladder && $json.ladder.planned === false) ? 'The plan is downloading. No ladder was planned: ' + (($json.ladder.refusal || {}).message || '') : 'The plan is downloading. " + _dl['completionMessage'][len('The plan is downloading. '):].replace("'", "\\'") + "' }}"
# ---------- E. discovery with a website: the site's reach before the research (stored -> no call; else two DataForSEO Labs calls) ----------
_sd = pos('Seed List'); RX22, RY22 = _sd[0], _sd[1] + 300
disconnect('Seed List', 'Research Requests')
add_node('Reach Requests (Discovery)', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Reach_Requests_Discovery.js')}, [RX22, RY22])
if_node('Measure Reach?', "{{ !$json.skip }}", [RX22 + 220, RY22])
add_node('Run Reach Requests', 'n8n-nodes-base.httpRequest', 4.5, {'method': 'POST', 'url': '={{ $json.endpoint }}', 'authentication': 'genericCredentialType', 'genericAuthType': 'httpBasicAuth', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify($json.body) }}', 'options': {'timeout': 60000}}, [RX22 + 440, RY22 - 120], {'onError': 'continueRegularOutput', 'retryOnFail': True, 'maxTries': 2, 'waitBetweenTries': 3000})
add_node('Reach (Discovery)', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Reach_Discovery.js')}, [RX22 + 660, RY22])
if_node('New Reach (Discovery)?', "{{ !!$json.save }}", [RX22 + 880, RY22])
add_node('Reach Row (Discovery)', 'n8n-nodes-base.code', 2, {'jsCode': "// v4.8: the newly measured reach, exact seo_cache columns ('reach:<site_id>', 30 days).\nreturn [{ json: $input.first().json.cache_row }];"}, [RX22 + 1100, RY22 - 120])
add_node('Save Reach (Discovery)', DT_TYPE, DT_VERSION, dt_upsert_params(CACHE_TABLE, CACHE_COLS, 'key'), [RX22 + 1320, RY22 - 120], {'onError': 'continueRegularOutput', 'alwaysOutputData': True})
slot('Run Reach Requests', 'dataforseo')
connect('Seed List', 'Reach Requests (Discovery)'); connect('Reach Requests (Discovery)', 'Measure Reach?')
connect('Measure Reach?', 'Run Reach Requests', 0); connect('Measure Reach?', 'Reach (Discovery)', 1); connect('Run Reach Requests', 'Reach (Discovery)')
connect('Reach (Discovery)', 'New Reach (Discovery)?'); connect('New Reach (Discovery)?', 'Reach Row (Discovery)', 0); connect('New Reach (Discovery)?', 'Research Requests', 1)
connect('Reach Row (Discovery)', 'Save Reach (Discovery)'); connect('Save Reach (Discovery)', 'Research Requests')
patch('Build Keyword File', "'Run Competitor Keywords', 'AI Demand'];", "'Run Competitor Keywords', 'AI Demand', 'Run Reach Requests'];")
assert nodes['Run Reach Requests'].get('credentials'), 'reach request without credential'
# every node that inlines the reach rules really got them (and no placeholder is left anywhere)
for _n in ('Ladder Plan', 'Build Ladder Report', 'Ladder Settings Rows', 'Reach Requests (Discovery)', 'Reach (Discovery)', 'Rank Keywords', 'Build Keyword Strategy'):
    assert 'function reachFrom(' in code(_n), _n + ': reach rules not inlined'
assert not any('/*__REACH__*/' in n['parameters'].get('jsCode', '') for n in nodes.values()), 'reach placeholder left'
sticky("""### The right keyword and the right plan (v4.8)
**Reach** = the difficulty the site already wins (75th percentile of its top-10 keywords' difficulty, else by size), stored 30 days in `seo_cache` (`reach:<site_id>`), shared by the ladder, discovery and the keyword check (`v5/code/_reach.js`). **Ladder**: the site's other ladders are loaded first (their keywords are never planned again; a duplicate main keyword is refused); rungs relative to reach (1 ≤ reach, 2 ≤ +15, 3 ≤ +30); the main keyword's difficulty for this site picks the plan — **direct** (main page first + 2-3 pages), **short** (3-5 pages, then the main page), **full** (rungs, main page last; very hard = stretch) or **none** (not realistic: alternatives only); one `seo_ladder_settings` row per new ladder (mode from the `_site` row, after the existing ladders). **Discovery**: every keyword labelled for this site; Now = easy or reachable.""", LX22 - 40, LY22 + 160, 980, 240, 6)
log('Pipeline phase 3 (v4.8): the site\'s reach (75th-percentile difficulty of its top-10 keywords, else by size; seo_cache reach:<site_id>, 30 days, one shared copy in v5/code/_reach.js); ladder: rungs relative to reach, plan type from the main keyword\'s difficulty for this site (direct: main page first / short / full / none = alternatives only), other ladders\' keywords excluded, duplicate main keyword refused, plan_type / reach / difficulty_for_you in the plan, report ("Why this plan") and callback, one seo_ladder_settings row per new ladder; discovery: difficulty for your site, plan and months per keyword, Now = easy or reachable')


# =============================================================================
# 23. PUBLISH DETECTION (v4.8, 2026-10-03, PIPELINE_FEATURE_SPEC §6.5, phase 4): the weekly Site Tracker finds written pages that went live
#     (sitemap: planned slug, then title / H1) and stores them exactly like "I published a page" does. The rows come from one shared builder
#     (v5/code/_publish_rows.js) inlined into Publish Check here and into Detect Published in build_site_tracker.py.
# =============================================================================
assert 'function publishedRows(' in code('Publish Check'), 'Publish Check: published-page rows not inlined'
assert not any('/*__PUBLISH_ROWS__*/' in n['parameters'].get('jsCode', '') for n in nodes.values()), 'publish-rows placeholder left'
log('Publish detection (v4.8, pipeline phase 4): the Site Tracker reads each site\'s sitemap (index + up to 5 child sitemaps) when pages are written but not published (content log "started" within 120 days, ladder rows "writing"), matches them by planned slug, then by <title> / first <h1> (at most 15 page fetches per site and week), and marks them published in seo_content_log / seo_ladders (and seo_case_studies) with the same row builder as "I published a page" (v5/code/_publish_rows.js); callback field detected_published and a report section')


# =============================================================================
# 24. BACKLINKS FROM EVERY SOURCE (v4.10, 2026-10-08, BACKLINKS_SPEC.md): the on-demand backlink check takes `free_only` (API) — the
#     Backlink Monitor then reads only the free sources (Bing, the Search Console upload, GA4, Common Crawl, Wikipedia, HN, news, web
#     search) and checks the pages itself: no DataForSEO, no Claude, $0. The monitor itself is built in build_monitors.py.
# =============================================================================
patch('Normalize Input', "    monitor_input,\n    topics,", "    monitor_input,\n    topics,\n    free_only: mode === 'backlinks' && /^(true|1|yes|on)$/i.test(String(p2.free_only ?? '')),")
patch('Rate Limit', "else if (d.mode === 'backlinks') est = EST.backlinks;", "else if (d.mode === 'backlinks') est = d.free_only ? 0 : EST.backlinks;   // v4.10: free sources only = no paid call")
log('Backlinks from every source (v4.10): the on-demand backlink check (form / API mode backlinks) passes free_only to the Backlink Monitor (free sources + own link check only, $0); the monitor merges DataForSEO, Bing Webmaster Tools, the Search Console upload, GA4 referrals, the Common Crawl web graph, Wikipedia, Hacker News, GDELT news and web search, checks the linking pages itself (lost = two misses, with the reason) and scores every link (SEO / referral / brand)')

# =============================================================================
# 25. SEARCH DATA OUTAGES (2026-10-09, live test T2, REVIEW §5c K3 / D1 / P2): DataForSEO answered the live SERP endpoint with
#     `status_code 50000 "Internal Server Error."` inside an HTTP 200 (tasks: null) for every verdict / page call and 5 of 8 discovery
#     checks — n8n's retryOnFail never fires on an HTTP 200, so the run went on with no competitors, no facts and a results-page digest
#     that said "FEATURED SNIPPET: none / AI OVERVIEW: not shown" (the verdict then claimed "no featured snippet, PAA or AI Overview
#     appears"). Now: one retry of the keyword's SERP and of the facts search when the answer is such a server error (an IF in front of
#     a copy of the node), a failed answer is "unavailable" in the digest, serp_features, the report and the discovery's live checks
#     (Clean_Competitor_Pages.js, Build_Keyword_Strategy.js), and a top-level error counts as a research failure (Collect_Research.js).
# =============================================================================
SERP_FAILED = "{{ !!($json.error || Number($json.status_code) >= 50000 || Number((($json.tasks || [])[0] || {}).status_code) >= 50000) }}"
for first, retry, gate, base_ref, dst in [('SERP Top 10', 'SERP Top 10 (Retry)', 'SERP Failed?', "$('Collect Site URLs').first().json", 'Pick Top 6'),
                                          ('Facts SERP', 'Facts SERP (Retry)', 'Facts SERP Failed?', "$('Analyze Competitor Pages').first().json", 'Collect Facts')]:
    assert [t['node'] for l in conns[first]['main'] for t in l] == [dst], first + ': unexpected outputs'
    p0 = pos(first)
    if_node(gate, SERP_FAILED, [p0[0] + 110, p0[1] + 200])
    rn = copy.deepcopy(nodes[first]); rn['name'] = retry; rn['id'] = nid(retry); rn['position'] = [p0[0] + 330, p0[1] + 200]
    body = rn['parameters']['jsonBody']
    assert body.count('$json.') >= 3 and '$json.keyword' in body, retry + ': body anchors'
    rn['parameters']['jsonBody'] = body.replace('$json.', base_ref + '.')   # the gate's item is the failed answer; read the request from upstream
    rn['onError'] = 'continueRegularOutput'; rn['retryOnFail'] = True
    assert rn.get('credentials'), retry + ': credential slot'
    nodes[retry] = rn
    disconnect(first, dst); connect(first, gate); connect(gate, retry, 0); connect(gate, dst, 1); connect(retry, dst)
assert "$('Collect Site URLs').first().json.keyword" in nodes['SERP Top 10 (Retry)']['parameters']['jsonBody']
assert "$('Analyze Competitor Pages').first().json.keyword" in nodes['Facts SERP (Retry)']['parameters']['jsonBody']
os.makedirs(OUT_CODE, exist_ok=True)   # harness shims: the gates' exact condition, run per item like a Code node (S29)
for _g in ('SERP Failed?', 'Facts SERP Failed?'):
    open(os.path.join(OUT_CODE, re.sub(r'[^A-Za-z0-9_.-]+', '_', _g) + '.js'), 'w').write(
        "// harness shim (written by build_v4.py section 25): the IF node's condition, true = take the retry branch\n"
        "return $input.all().map(i => { const $json = i.json; return { json: { retry: " + SERP_FAILED[2:-2].strip() + " } }; });\n")
# the cost ledger counts the retries (a failed call costs 0)
_ln = [nm for nm in nodes if "const __LEDGER_NODES = ['SERP Top 10', " in nodes[nm]['parameters'].get('jsCode', '')]
assert len(_ln) >= 4, _ln
for nm in _ln: patch(nm, "const __LEDGER_NODES = ['SERP Top 10', ", "const __LEDGER_NODES = ['SERP Top 10', 'SERP Top 10 (Retry)', 'Facts SERP (Retry)', ")
# the ledger's AI steps also count the discovery's relevance review and the page's critic (the app showed "AI steps 1" for a
# discovery with 4 Claude calls, and no Critic on page runs; the ladder copy already had them)
_AI0 = "const __AI_NODES = ['Site Describer', 'Keyword Seeds', 'Competitor Analyzer', 'Verdict Agent', 'Strategy Brief', 'Copywriter', 'Editor', 'Content Reviewer'];"
_ai = [nm for nm in nodes if _AI0 in nodes[nm]['parameters'].get('jsCode', '')]
assert {'Build Word File', 'Build Keyword File'} <= set(_ai), _ai
for nm in _ai: patch(nm, _AI0, _AI0.replace("'Content Reviewer'];", "'Content Reviewer', 'Keyword Relevance', 'Critic'];"))
# the keyword report says the results page could not be read instead of "None / Not shown for this query"
patch('Build Word File', "  if (sf) {\n    const aio = sf.ai_overview || {};",
      "  if (sf && sf.unavailable) {\n    parts.push(h2('What the Results Page Looks Like') + '<div class=\"note\">The live Google results could not be read for this run (search data provider: ' + esc(sf.error || 'no answer') + '). Featured snippet, People Also Ask, AI Overview and the competitor pages are unknown, not absent.</div>');\n  } else if (sf) {\n    const aio = sf.ai_overview || {};")
# the callback's `markdown` is the clean article of the blog package (the web app saves it as <slug>.md); it was the raw draft with
# the "Title: / Meta Description:" lines and the copywriter's [Image: …] markers (live P2, 2026-10-09)
patch('Build Webhook Response', "    markdown: d.page_markdown || null,", "    markdown: d.article_markdown || d.page_markdown || null,")
log('Search data outages (2026-10-09): one retry of the keyword SERP and the facts search when DataForSEO answers a server error (50000 inside HTTP 200); a failed SERP is "unavailable" (digest, serp_features, keyword report, discovery live checks + research_failures), never "no snippet / no AI Overview"; CPC rounded in the discovery and ladder reports')

# =============================================================================
# 9. WRITE
# =============================================================================
w['nodes'] = list(nodes.values())
w['name'] = 'SEO Agent v4 — Audit, Keywords, Verdict & Content'
w['active'] = False
for k in ['id', 'versionId', 'activeVersionId', 'versionCounter', 'triggerCount', 'sourceWorkflowId', 'shared', 'versionMetadata', 'updatedAt', 'createdAt', 'isArchived', 'nodeGroups', 'staticData', 'pinData', 'meta']:
    w.pop(k, None)
w['tags'] = []
w['id'] = 'SEOagentV4Full01'
w['settings']['errorWorkflow'] = 'SEOagentErrHandl'
# sanity: every connection target exists
names = set(nodes)
for src, outs in list(conns.items()):
    assert src in names, f'connection source missing: {src}'
    for ctype, lists in outs.items():
        for lst in lists:
            for t in lst: assert t['node'] in names, f'connection target missing: {t["node"]} (from {src})'
json.dump([w], open(OUT_JSON, 'w'), indent=2, ensure_ascii=False)
os.makedirs(OUT_CODE, exist_ok=True)
for n in nodes.values():
    if n['type'] == 'n8n-nodes-base.code':
        open(os.path.join(OUT_CODE, re.sub(r'[^A-Za-z0-9_.-]+', '_', n['name']) + '.js'), 'w').write(n['parameters']['jsCode'])
open(OUT_CHANGES, 'w').write('\n'.join('- ' + c for c in CHANGES) + '\n')
print(f'\nwrote {OUT_JSON}: {len(nodes)} nodes, {sum(len(l) for o in conns.values() for ls in o.values() for l in ls)} connections')

# the API front door and the ladder extras (Rank Tracker, WordPress publisher, test runner) are generated alongside
import subprocess
for _s in ('build_api.py', 'build_ladder_extras.py', 'build_site_tracker.py', 'build_monitors.py'):
    _r = subprocess.run([sys.executable, os.path.join(HERE0, _s)], cwd=HERE0)
    assert _r.returncode == 0, _s + ' failed'

