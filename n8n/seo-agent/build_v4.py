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
FIT_GATE_SRC = _rd0('code/_fit_gate.js').rstrip('\n'); SERP_OBS_SRC = _rd0('code/_serp_obs.js').rstrip('\n')   # 2026-10-11: the keyword fit gate (D4 / D8) and the results-page observation rules (D26), one copy each
SITE_MODEL_SRC = _rd0('code/_site_model.js').rstrip('\n')   # 2026-10-12 (G19, SITE_MODEL_SPEC.md): the one site model (canonical host, name, NAP, services, pages, facts)
SOURCES_SRC = _rd0('code/_sources.js').rstrip('\n'); ANCHOR_SRC = _rd0('code/_anchor.js').rstrip('\n')   # 2026-10-11: source quality, figure lookup and link cleaning (G4) and the anchor words of a link to our own page (D9)
PAGE_TYPE_SRC = _rd0('code/_page_type.js').rstrip('\n')   # 2026-10-12 (D10): the page type as one of the form's fixed options, with the verdict's free text kept as page_notes
GSC_QUERIES_SRC = _rd0('code/_gsc_queries.js').rstrip('\n')   # 2026-10-12 (G9 / D24): the Search Console query rules (scraper queries, brand split, anonymised share)
KW_INPUTS_SRC = _rd0('code/_kw_inputs.js').rstrip('\n')   # 2026-10-13 (G8): the discovery inputs -- Search Console seeds, calibrated traffic potential, SERP-overlap clusters, the live-check cap
RADIUS_SRC = _rd0('code/_radius.js').rstrip('\n')   # 2026-10-13 (G32): the topic radius -- which topics are within reach, which are a stretch, on what evidence (needs the reach kit in the same node)
import seo_events   # 2026-10-13 (G12 / G29): the dated event registry and the lineage / annotation / change-test kits, one copy each
rd = lambda p: seo_events.inline(_rd0(p)).replace('/*__REACH__*/', _rd0('code/_reach.js').rstrip('\n')).replace('/*__PUBLISH_ROWS__*/', _rd0('code/_publish_rows.js').rstrip('\n')).replace('/*__RDAP__*/', _rd0('code/_rdap.js').rstrip('\n')).replace('/*__FIT_GATE__*/', FIT_GATE_SRC).replace('/*__SERP_OBS__*/', SERP_OBS_SRC).replace('/*__SITE_MODEL__*/', SITE_MODEL_SRC).replace('/*__SOURCES__*/', SOURCES_SRC).replace('/*__ANCHOR__*/', ANCHOR_SRC).replace('/*__PAGE_TYPE__*/', PAGE_TYPE_SRC).replace('/*__GSC_QUERIES__*/', GSC_QUERIES_SRC).replace('/*__KW_INPUTS__*/', KW_INPUTS_SRC).replace('/*__RADIUS__*/', RADIUS_SRC)   # shared kits (reach, published-page rows, RDAP, fit gate, SERP observations, site model, sources, anchors, page types, Search Console queries, discovery inputs), one copy each, inlined where a node asks for them
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
# v4.12 (AI_GROWTH_SPEC.md): an AI answer target — the question AI assistants answer without this business, the searches they run first, the pages
# they cite and the businesses they name — set by the Content Cadence (AI pages) or the app's "Write the page" on an AI question. The brief and the
# copywriter write the page to be the one they cite (answer first, one section per search, neutral comparison, sourced figures, a visible date).
patch('Normalize Input', "const wordpress_url = String(p2.wordpress_url || '').trim();",
      "const wordpress_url = String(p2.wordpress_url || '').trim();\nconst AT = (p2.ai_target && typeof p2.ai_target === 'object' && !Array.isArray(p2.ai_target)) ? p2.ai_target : null;\nconst atList = (v) => (Array.isArray(v) ? v : String(v || '').split(/\\s*\\|\\s*|\\n/)).map(x => String(x == null ? '' : x).trim()).filter(Boolean);\nconst ai_target = AT && String(AT.question || '').trim().length >= 8 ? { question: String(AT.question).trim().slice(0, 300), kind: AT.kind === 'refresh' ? 'refresh' : 'answer', target_id: String(AT.target_id || '').slice(0, 120),\n  fanout: atList(AT.fanout).slice(0, 8).map(x => x.slice(0, 200)), competitors: atList(AT.competitors).slice(0, 8).map(x => x.slice(0, 80)),\n  sources: (Array.isArray(AT.sources) ? AT.sources : []).filter(x => x && (x.u || x.url)).slice(0, 6).map(x => ({ url: String(x.u || x.url).slice(0, 300), title: String(x.t || x.title || '').slice(0, 140) })) } : null;")
patch('Normalize Input', "    ladder_links,\n    force_content: !!p2.force_content,", "    ladder_links,\n    ai_target,\n    force_content: !!p2.force_content,")
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
const monitor_input = {}; for (const k of ['ai_visibility', 'ai_pulse', 'ai_growth', 'link_builder', 'backlinks', 'audit_monthly', 'audit_js']) if (MI[k] !== undefined) monitor_input[k] = !!MI[k] && !/^(false|0|no|off)$/i.test(String(MI[k]));
if (MI.ai_engines !== undefined) monitor_input.ai_engines = asArray(MI.ai_engines).map(e => String(e).toLowerCase().trim()).filter(e => ['chatgpt', 'perplexity', 'gemini', 'claude', 'ai_overview', 'ai_mode', 'copilot'].includes(e)).join(', ');
if (MI.ai_prompts_max !== undefined) monitor_input.ai_prompts_max = Math.min(50, Math.max(3, parseInt(MI.ai_prompts_max, 10) || 20));   // v4.9: up to 50 questions
if (MI.ai_pages_month !== undefined) monitor_input.ai_pages_month = Math.min(8, Math.max(0, parseInt(MI.ai_pages_month, 10) || 0));   // v4.12: AI answer / refresh pages a month
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
# 26. CONCURRENCY-SAFE GUARDS (v4.14, 2026-10-11, FIX_PLAN D1) + RDAP PARSED (D7). Rate Limit kept its counters in workflow static data: parallel
#     executions read the same old value and the last one to finish overwrote the others (live: 8 app runs + 3 spawns counted as 5, $0.67 of
#     ≈ $3.0 estimated). Now every execution appends ONE row to the new Data Table seo_run_ledger before the check (Run Ledger Row -> Reserve Run
#     Ledger), Load Run Ledger reads the period's rows once, and Rate Limit counts the rows with a lower id than its own (row order decides ties;
#     refused rows and the Keyword Check's rows never count; a finished run counts what it settled). A refused run marks its row (Mark Run
#     Refused), the report nodes settle it at the end (Settle Run Ledger: status done, settled_usd). Limits and keys are unchanged (6 / day per
#     e-mail, 40 / day per app company, 150 / day in total, ai_budget_usd per period, internal spawns keyed by their marker). The Keyword Check
#     runs the same pattern (build_api.py: Run Ledger Row (Assess) -> Reserve -> Load -> Assess Limit). The table is created on first use
#     (Ensure Run Ledger Table); sync_tables.py only adds columns to existing tables.
#     D7: the RDAP answer (rdap+json as text under `data`) is parsed by v5/code/_rdap.js in RDAP Results and Domain Ages (the `rd` lambda inlines
#     it), so paid WHOIS runs only for the domains RDAP cannot date.
# =============================================================================
from ladder_common import RUN_LEDGER_TABLE, RUN_LEDGER_COLS, dt_get_all_where_params
_rlc = code('Rate Limit')
_m_key = re.search(r"(// Internal spawns[^\n]*\nconst internal = [^\n]*\nconst fromApp = [^\n]*\nconst key = [^\n]*\n)", _rlc)
_m_est = re.search(r"(// ---- estimated Claude spend guard ----\n.*?\nif \(d\.need_site_description\) est \+= EST\.describe;\n)", _rlc, re.S)
assert _m_key and _m_est, 'Rate Limit: the key / estimate blocks were not found'
_lr = rd('code/Run_Ledger_Row.js').replace('/*__KEY__*/', _m_key.group(1).rstrip('\n')).replace('/*__EST__*/', _m_est.group(1).rstrip('\n'))
assert '/*__' not in _lr and 'const key = ' in _lr and 'const EST = {' in _lr
_ni = pos('Normalize Input'); LX26, LY26 = _ni[0] - 880, _ni[1] + 112
add_node('Ensure Run Ledger Table', DT_TYPE, DT_VERSION, dt_create_params(RUN_LEDGER_TABLE, RUN_LEDGER_COLS), [LX26, LY26], {'onError': 'continueRegularOutput', 'executeOnce': True})
add_node('Run Ledger Row', 'n8n-nodes-base.code', 2, {'jsCode': _lr}, [LX26 + 220, LY26])
add_node('Reserve Run Ledger', DT_TYPE, DT_VERSION, dt_insert_params(RUN_LEDGER_TABLE, RUN_LEDGER_COLS), [LX26 + 440, LY26], {'onError': 'continueRegularOutput', 'alwaysOutputData': True})
# the period's rows in one filtered read: today's for a daily budget, the month's for a monthly one (ISO strings compare as text)
add_node('Load Run Ledger', DT_TYPE, DT_VERSION, dt_get_all_where_params(RUN_LEDGER_TABLE, [('created_at', 'gte', "={{ String($('Run Ledger Row').first().json.created_at).slice(0, $('Normalize Input').first().json.ai_budget_period === 'day' ? 10 : 7) }}")]), [LX26 + 660, LY26], dict(LOAD18))
_rl_srcs = sorted({s for s, o in conns.items() for lists in o.values() for l in lists for t in l if t['node'] == 'Rate Limit'})
assert _rl_srcs == ['Normalize Input'], _rl_srcs
disconnect('Normalize Input', 'Rate Limit')
for a, b in [('Normalize Input', 'Ensure Run Ledger Table'), ('Ensure Run Ledger Table', 'Run Ledger Row'), ('Run Ledger Row', 'Reserve Run Ledger'), ('Reserve Run Ledger', 'Load Run Ledger'), ('Load Run Ledger', 'Rate Limit')]:
    connect(a, b)
patch('Rate Limit', "// Simple abuse guard: limits runs per requester and per day (state lives in workflow static data;\n// it persists only for active/production executions, not manual test runs).\n",
      "// Abuse and spend guard: limits runs per requester and per day. v4.14 (D1): counted from the run ledger (seo_run_ledger, one appended row per\n// execution), so parallel executions cannot overwrite each other's counts (they did with workflow static data until 2026-10-11).\n")
patch('Rate Limit', "const d = $input.first().json;\n", "const d = { ...$('Normalize Input').first().json };   // v4.14: the input is the run ledger (Load Run Ledger); the request comes from Normalize Input\n")
patch('Rate Limit', """let store;
try { store = $getWorkflowStaticData('global'); } catch (e) { store = {}; }
if (!store.rate || store.rate.day !== today) store.rate = { day: today, total: 0, keys: {} };

const used = store.rate.keys[key] || 0;
if (store.rate.total >= LIMITS.global_per_day) {""",
      """// v4.14 (D1): this execution reserved its ledger row before this check (Run Ledger Row -> Reserve Run Ledger); only the rows with a LOWER id
// count, so row order decides ties and no run slips past while another is counting. Refused rows and the Keyword Check's rows never count.
let mine = {}; try { mine = $('Reserve Run Ledger').first().json || {}; } catch (e) {}
let ledger = []; try { ledger = $('Load Run Ledger').all().map(i => i.json).filter(r => r && r.run_id && !r.error); } catch (e) {}
const myId = Number(mine.id);
const earlier = ledger.filter(r => r.mode !== 'assess' && r.status !== 'refused' && (myId > 0 ? Number(r.id) < myId : String(r.run_id) !== String($execution.id)));
const todayRows = earlier.filter(r => String(r.created_at || '').slice(0, 10) === today);
const used = todayRows.filter(r => String(r.key || '').toLowerCase() === key && !['published', 'checkin', 'profile'].includes(r.mode)).length;
if (todayRows.length >= LIMITS.global_per_day) {""")
patch('Rate Limit', "if (!['published', 'checkin', 'profile'].includes(d.mode)) store.rate.keys[key] = used + 1;\nstore.rate.total += 1;\n", "")
patch('Rate Limit', """const period = (d.ai_budget_period === 'day') ? today : today.slice(0, 7);
if (!store.ai_budget || store.ai_budget.period !== period) store.ai_budget = { period, spent_est: 0, runs: 0 };
const budget = Number(d.ai_budget_usd || 0);""",
      """const period = (d.ai_budget_period === 'day') ? today : today.slice(0, 7);
const spent_est = +earlier.filter(r => String(r.created_at || '').startsWith(period)).reduce((s, r) => s + (r.status === 'done' ? (Number(r.settled_usd) || 0) : (Number(r.est_usd) || 0)), 0).toFixed(2);   // a finished run counts what it settled, a running or crashed one its reservation
const budget = Number(d.ai_budget_usd || 0);""")
patch('Rate Limit', "if (budget > 0 && store.ai_budget.spent_est + est + __room > budget) {", "if (budget > 0 && spent_est + est + __room > budget) {")
patch('Rate Limit', "(estimated $' + store.ai_budget.spent_est.toFixed(2) + ' of $'", "(estimated $' + spent_est.toFixed(2) + ' of $'")
patch('Rate Limit', """store.ai_budget.spent_est = +(store.ai_budget.spent_est + est).toFixed(2);
store.ai_budget.runs += 1;
d.ai_spend_estimate_usd = est;
d.ai_budget_used_est_usd = store.ai_budget.spent_est;""", """d.ai_spend_estimate_usd = est;
d.ai_budget_used_est_usd = +(spent_est + est).toFixed(2);""")
assert '$getWorkflowStaticData' not in code('Rate Limit') and 'store.' not in code('Rate Limit'), 'Rate Limit still uses static data'
# a refused run (validation error or limit) marks its row before the error path; the Data Table node outputs the row, so the request is restored after it
assert [t['node'] for t in conns['Input OK?']['main'][1]] == ['Error Via API?'], conns['Input OK?']['main'][1]
disconnect('Input OK?', 'Error Via API?')
_io = pos('Input OK?')
add_node('Mark Run Refused', DT_TYPE, DT_VERSION, dt_update_params(RUN_LEDGER_TABLE, RUN_LEDGER_COLS, [('run_id', '={{ $execution.id }}')], {'status': 'refused'}), [_io[0] - 110, _io[1] + 440], {'onError': 'continueRegularOutput', 'alwaysOutputData': True, 'executeOnce': True})
add_node('Refused Input', 'n8n-nodes-base.code', 2, {'jsCode': "// v4.14 (D1): the ledger row is marked refused; the refused request (Rate Limit's item) continues to the error path — a Data Table node outputs the row, not its input.\nreturn [{ json: $('Rate Limit').first().json }];"}, [_io[0] + 110, _io[1] + 440])
connect('Input OK?', 'Mark Run Refused', 1); connect('Mark Run Refused', 'Refused Input'); connect('Refused Input', 'Error Via API?')
# the report nodes (they already compute run_ledger) settle the row at the end: status done, settled_usd = the reserved Claude estimate
_ends = sorted(nm for nm in nodes if 'const run_ledger = {' in nodes[nm]['parameters'].get('jsCode', ''))
assert {'Build Word File', 'Build Full Report', 'Build Audit Report', 'Build Keyword File', 'Build Ladder Report'} <= set(_ends), _ends
_bw = pos('Build Word File')
# P1-1 (2026-10-12, LIVE_CHECK_phase1_2026-10-12.md §3): the settle node hung off the five report builders only, so every short mode (describe,
# backlinks / AI visibility, track, published, check-in, profile, case study, and the audit started from the form) left its row `reserved` for
# ever (live: rows 1-8 and 11). Each of those branches passes through exactly one node on its way out — the node feeding its "Via Webhook (…)?"
# split, so the API and the form variant are both covered — and that node settles the row too. The update matches `status = reserved`, so a row
# can be settled only once and a refused row (Mark Run Refused wrote `refused` first) is never turned into a finished one.
SETTLE_ENDS = {'describe': 'Build Description Page', 'track': 'Start Site Tracker', 'published': 'Published Delivery', 'checkin': 'Check-in Delivery',
               'profile': 'Profile Delivery', 'case_study': 'Case Study Delivery', 'monitor': 'Monitor Started', 'audit_form': 'Spawn Audit Run'}
add_node('Settle Run Ledger', DT_TYPE, DT_VERSION, dt_update_params(RUN_LEDGER_TABLE, RUN_LEDGER_COLS, [('run_id', '={{ $execution.id }}'), ('status', 'reserved')], {'status': 'done', 'settled_usd': "={{ Number($('Run Ledger Row').first().json.est_usd) || 0 }}"}), [_bw[0] + 220, _bw[1] + 300], {'onError': 'continueRegularOutput', 'alwaysOutputData': True, 'executeOnce': True})
for nm in _ends + sorted(SETTLE_ENDS.values()):
    assert nm in nodes, 'settle end missing: ' + nm
    connect(nm, 'Settle Run Ledger')
sticky("""### Run ledger (v4.14, D1 — concurrency-safe guards)
Every execution appends one row to **seo_run_ledger** (run_id, key, mode, est_usd, created_at, status, settled_usd) *before* **Rate Limit** counts, so parallel executions no longer overwrite each other's counters (workflow static data did: 8 runs counted as 5). Rate Limit counts the period's rows with a lower id than its own (row order decides ties), skips refused rows and the Keyword Check's rows, and refuses over the same limits as before (6 / day per e-mail, 40 / day per app company, 150 / day in total, `ai_budget_usd` per period). A refused run marks its row (**Mark Run Refused**); every branch settles it at its own end (**Settle Run Ledger**: done, settled_usd) — P1-1: the short modes used to leave the row `reserved` for ever. The settle update matches `status = reserved`, so a row settles once and a refused row stays refused. One insert + one filtered read per run; the table is created on first use.""", LX26 - 40, LY26 - 300, 940, 240, 6)
log('Concurrency-safe guards (v4.14, D1): one seo_run_ledger row per execution reserved before Rate Limit; counts and the AI budget come from the ledger rows with a lower id (row order decides ties, refused rows skipped, finished runs count what they settled); the row is marked refused / settled; limits and keys unchanged; the Keyword Check counts the same way')
log('RDAP parsed (D7): the rdap+json text answer under `data` is read (v5/code/_rdap.js) in RDAP Results and Domain Ages, so paid WHOIS runs only for the domains RDAP cannot date')
# 27. AUDIT CORRECTNESS (2026-10-11, system review FIX_PLAN.md D2 / D6 / D17 / D18 / D24): the live whole-system test found the audit
#     giving wrong advice — a High "www and non-www not consolidated" on a site whose apex 308-redirects to www (DataForSEO's
#     test_canonicalization taken at face value), "duplicate meta tags" on 45 of 47 pages (three Next.js theme-color tags that differ by
#     `media`), the audit diff comparing a technical audit with a full report ("25 fixed", ranking and AI findings among them — fixed in
#     v5/code/Audit_Diff.js), the fix pack's robots.txt opening /api/ and /admin/ to the AI search bots (v5/code/Fix_Pack.js), the author
#     finding listed twice (HTML analysis + content review), "capped at 85" shown next to a score of 68, and scraper queries (site:, inurl:,
#     quoted AND / OR) among the top Search Console queries (v5/code/GSC_Audit_Findings.js). Here: the v3 nodes Analyze Probes, Build Site
#     Issues and the two report builders.
# =============================================================================
# ---- D6 + D18: Analyze Probes reads the homepage's canonical tag and counts its duplicate <meta> tags (tags that differ by `media` are distinct) ----
patch('Analyze Probes', "const MAIN = 'home_content';   // the homepage as browsers get it (redirects followed)\n", r"""const MAIN = 'home_content';   // the homepage as browsers get it (redirects followed)
// D18 (2026-10-11): DataForSEO's duplicate_meta_tags counts <meta> tags that differ only by `media` (Next.js theme-color light / dark) as duplicates;
// the homepage HTML is counted here and Build Site Issues drops or qualifies the finding with it. Properties that may repeat (og:image, article:tag …) are skipped.
const metaDuplicates = (html) => { const seen = {}; const REPEATABLE = /^(og:image|og:image:[a-z_]+|og:video|og:video:[a-z_]+|og:audio|og:audio:[a-z_]+|og:locale:alternate|article:tag|article:author|book:author|book:tag|video:tag|video:actor|music:[a-z:_]+)$/i;
  for (const tag of (String(html || '').match(/<meta\b[^>]*>/gi) || [])) { const nm = (tag.match(/\b(?:name|property|http-equiv)\s*=\s*["']?([^"'\s>]+)/i) || [])[1]; if (!nm || REPEATABLE.test(nm)) continue; const media = (tag.match(/\bmedia\s*=\s*["']([^"']*)["']/i) || [])[1] || ''; const k = nm.toLowerCase() + '|' + media.toLowerCase().replace(/\s+/g, ''); seen[k] = (seen[k] || 0) + 1; }
  return Object.entries(seen).filter(([, n]) => n > 1).map(([k, n]) => ({ tag: k.split('|')[0], count: n })); };
const homeHtml18 = (R[MAIN] || {}).status === 200 ? String((R[MAIN] || {}).body || '') : '';
const homepage_meta = { checked: /<meta\b/i.test(homeHtml18), duplicates: homeHtml18 ? metaDuplicates(homeHtml18) : [] };
""")
patch('Analyze Probes', """const canonical_host = apexToWww ? 'www.' + domain : domain;
if (apexToWww) {
  if (www.status === 200) works.push('One canonical host: https://' + domain + ' 301-redirects to https://www.' + domain);
""", r"""const canonical_host = apexToWww ? 'www.' + domain : domain;
// D6 (2026-10-11): the host finding is raised only when both hosts answer 200 with no redirect, or when a redirect's target and the homepage's own
// canonical tag disagree — never from DataForSEO's test_canonicalization alone (false on techand.ai while its apex 308-redirects to www). The fix
// is worded after the host the canonical tags name.
const canonTag = (String((R[MAIN] || {}).body || '').match(/<link\b[^>]*>/gi) || []).find(t => /\brel\s*=\s*["']?canonical\b/i.test(t)) || '';
const canonHref = (canonTag.match(/\bhref\s*=\s*["']([^"']+)["']/i) || [])[1] || '';
const canonical_tag_host = String((canonHref.match(/^https?:\/\/([^\/?#]+)/i) || [])[1] || '').toLowerCase();
const WWW = 'www.' + domain;
const hostFix = (preferred) => preferred === WWW ? 'Keep one host: 301-redirect https://' + domain + '/ to https://' + WWW + '/ (the canonical tags already name www) and keep every canonical tag on the www URL.'
  : preferred === domain ? 'Keep one host: 301-redirect https://' + WWW + '/ to https://' + domain + '/ (the canonical tags already name the bare domain) and keep every canonical tag on it.'
  : 'Pick one host, make every canonical tag name it, and 301-redirect the other host to it.';
const hostFinding = (evidence, preferred) => add('Crawlability & Indexing', 'High', 'www and non-www versions are not consolidated', evidence, 'Two hosts answering for the same pages split links and ranking signals between them, and Google may index the one you did not intend.', hostFix(preferred));
let hosts_consolidated = null;
if (apexToWww) {
  if (www.status === 200) { if (canonical_tag_host && canonical_tag_host === domain) { hosts_consolidated = false; hostFinding('https://' + domain + '/ redirects (' + home.status + ') to https://' + WWW + '/, but the homepage canonical tag points to ' + canonHref, canonical_tag_host); } else { hosts_consolidated = true; works.push('One canonical host: https://' + domain + ' redirects (' + home.status + ') to https://' + WWW + (canonical_tag_host === WWW ? ', and the canonical tags agree' : '')); } }
""")
patch('Analyze Probes', """  } else if (www.status >= 300 && www.status < 400) {
    const loc = h('www_https', 'location');
    if (loc.includes('//' + domain)) works.push('www redirects to the main domain (' + www.status + ')');
    else add('Crawlability & Indexing', 'Medium', 'www redirects somewhere unexpected', 'https://www.' + domain + ' → ' + loc, 'Signals may be split between hosts.', 'Redirect www directly to https://' + domain + '/ with a 301.');
  } else if (www.status === 200) {
    add('Crawlability & Indexing', 'High', 'www and non-www both serve the site (duplicate host)', 'https://www.' + domain + ' and https://' + domain + ' both return 200', 'Two copies of every page split links and ranking signals.', 'Add a 301 redirect from www to https://' + domain + '/ (or the reverse) so only one host answers with 200.');
  }
""", r"""  } else if (www.status >= 300 && www.status < 400) {
    const loc = h('www_https', 'location');
    if (loc.includes('//' + domain)) { if (canonical_tag_host === WWW) { hosts_consolidated = false; hostFinding('https://' + WWW + '/ redirects (' + www.status + ') to ' + loc + ', but the homepage canonical tag points to ' + canonHref, canonical_tag_host); } else { hosts_consolidated = true; works.push('www redirects to the main domain (' + www.status + ')' + (canonical_tag_host === domain ? ', and the canonical tags agree' : '')); } }
    else add('Crawlability & Indexing', 'Medium', 'www redirects somewhere unexpected', 'https://www.' + domain + ' → ' + loc, 'Signals may be split between hosts.', 'Redirect www directly to https://' + domain + '/ with a 301.');
  } else if (www.status === 200) {
    hosts_consolidated = false;
    hostFinding('https://' + WWW + '/ and https://' + domain + '/ both return 200 with no redirect' + (canonical_tag_host ? '; the homepage canonical tag names ' + canonical_tag_host : '; the homepage has no canonical tag'), canonical_tag_host);
  }
""")
patch('Analyze Probes', "      measurements: {\n        canonical_host,\n", "      measurements: {\n        canonical_host,\n        hosts: { apex_status: home.status || 0, apex_location: homeLoc || '', www_status: www.status || 0, www_location: h('www_https', 'location') || '', canonical_tag_host, consolidated: hosts_consolidated },\n        homepage_meta,\n")
# ---- D6: Build Site Issues no longer raises the host finding from DataForSEO's domain check ----
patch('Build Site Issues', "addDomain(dc.test_canonicalization === false, 'Crawlability & Indexing', 'High', 'www and non-www versions are not consolidated', 'If both versions do not resolve to one canonical host, links and signals are split.', 'Make the www version redirect (301) to the main domain with a valid certificate for both hostnames.', 'Crawler canonicalization test failed');\n",
      "// D6 (2026-10-11): the www / non-www finding comes from the host probes (Analyze Probes: both hosts 200, or a redirect that disagrees with the canonical tag), never from dc.test_canonicalization alone\n")
# ---- D18: the duplicate-meta finding is verified on the homepage HTML ----
patch('Build Site Issues', "// ===== 2. Strict custom checks =====\n", r"""// ===== 1b. D18 (2026-10-11): DataForSEO's "duplicate meta tags" verified on the homepage HTML (tags that differ by `media` are not duplicates) =====
{ const hm = (probe.measurements || {}).homepage_meta; const i18 = findings.findIndex(f => f.title === 'Duplicate meta tags on the same page');
  if (hm && hm.checked && i18 >= 0) { const homeFlagged = pages.some(p => p.checks && p.checks.duplicate_meta_tags === true && /^https?:\/\/[^\/]+\/?$/.test(String(p.url || '')));
    if (hm.duplicates.length) { findings[i18].evidence += '; verified on the homepage: ' + hm.duplicates.map(d => '<meta ' + d.tag + '> ×' + d.count).join(', '); findings[i18].fix = 'Keep a single ' + hm.duplicates.map(d => '<meta ' + d.tag + '>').join(' / ') + ' tag per page in the template (tags that differ by a media attribute, such as theme-color for light and dark, are fine).'; }
    else if (homeFlagged) { findings.splice(i18, 1); whatWorks.push('No duplicate meta tags on the homepage (the crawler counted tags that differ only by a media attribute, such as theme-color for light and dark)'); } } }

// ===== 2. Strict custom checks =====
""")
# ---- D24: one finding per issue, and the cap message only when the cap lowered the score ----
patch('Build Site Issues', "findings.push(...(input.extra_findings || []));\n", r"""findings.push(...(input.extra_findings || []));

// ===== 4b. D24 (2026-10-11): one finding per issue — the HTML analysis and the AI content review both reported "no named author". The same
// title (as written) always merges; the same title with numbers ignored, or the same topic, merges when one of the two is the content
// review's (two measured findings that differ by a number or a word stay apart). The merged finding keeps the higher severity and the
// measured side's evidence, sample pages and scoring. =====
{ const asWritten = (t) => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const normT = (t) => asWritten(t).replace(/\d[\d,.%]*/g, '#').replace(/[^a-z#\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const TOPICS = [['author', /\b(authors?|bylines?|authored)\b/], ['sources', /\b(cites?|cited|citations?|sources?|references?)\b/], ['proof', /\b(case stud(?:y|ies)|testimonials?|proof)\b/], ['pricing', /\bpric(?:e|es|ing)\b/], ['freshness', /\b(fresh(?:ness)?|outdated|stale|last reviewed)\b/]];
  const topicOf = (f) => { const t = normT(f.title); const hit = TOPICS.find(([, re]) => re.test(t)); return hit ? f.category + '|topic:' + hit[0] : null; };
  const kept = []; const at = new Map();
  for (const f of findings) { const exact = f.category + '|' + asWritten(f.title); const loose = f.category + '|~' + normT(f.title); const topic = topicOf(f);
    let idx = at.has(exact) ? at.get(exact) : null;
    for (const k of [loose, topic]) if (idx == null && k != null && at.has(k) && (f.source === 'ai_review' || kept[at.get(k)].source === 'ai_review')) idx = at.get(k);
    if (idx == null) { at.set(exact, kept.length); for (const k of [loose, topic]) if (k != null && !at.has(k)) at.set(k, kept.length); kept.push(f); continue; }
    const p = kept[idx]; const measured = (p.scoring === false && f.scoring !== false) ? f : p; const other = measured === p ? f : p;
    const severity = SEV_ORDER[f.severity] < SEV_ORDER[p.severity] ? f.severity : p.severity;
    kept[idx] = { ...measured, severity, evidence: [measured.evidence, other.evidence && other.evidence !== measured.evidence ? (other.source === 'ai_review' ? 'content review: ' : '') + other.evidence : ''].filter(Boolean).join('; '), sample_urls: [...new Set([...(measured.sample_urls || []), ...(other.sample_urls || [])])].slice(0, 10), merged_titles: [...(p.merged_titles || [p.title]), f.title] };
    for (const k of [exact, loose, topic]) if (k != null) at.set(k, idx); }
  findings.splice(0, findings.length, ...kept); }
""")
patch('Build Site Issues', "const health_score = Math.min(raw_score, cap);\n", "const health_score = Math.min(raw_score, cap);\nif (cap >= raw_score) cap_reason = '';   // D24 (2026-10-11): the cap is reported only when it lowered the score (\"capped at 85\" was shown next to a 68)\n")
patch('Build Site Issues', "      score_cap: cap < 100 ? cap : null,\n", "      score_cap: cap < raw_score ? cap : null,\n")
# ---- D24: the reports say how many scraper queries were left out of the top queries ----
for _rn in ('Build Audit Report', 'Build Full Report'):
    patch(_rn, '    if ((sc.top_pages || []).length) h += `<table class="ct"><tr><th>Top page</th>',
          '    if ((sc.scraper_queries || {}).count) h += `<p class="small">${n2(sc.scraper_queries.count)} scraper ${sc.scraper_queries.count === 1 ? \'query\' : \'queries\'} (search operators such as site: or inurl:, ${n2(sc.scraper_queries.impressions)} impressions) left out of the top queries: they come from SEO tools and scrapers, not from customers.</p>`;\n'
          '    if ((sc.top_pages || []).length) h += `<table class="ct"><tr><th>Top page</th>')
assert 'report_type || \'\') === curType' in code('Audit Diff'), 'Audit Diff: same-type comparison not inlined'
assert "const freedList" in code('Fix Pack'), 'Fix Pack: robots.txt edit rules not inlined'
assert 'scraper_queries' in code('GSC Audit Findings'), 'GSC Audit Findings: scraper queries not inlined'
log('Audit correctness (2026-10-11, FIX_PLAN D2 / D6 / D17 / D18 / D24): the audit diff compares only audits of the same report type (a technical audit with only a full report stored is a baseline; findings outside the categories the type scores are never "fixed"); the www / non-www finding comes from the host probes only (both hosts 200, or a redirect that disagrees with the homepage canonical tag; the fix names the canonical host) — never from DataForSEO\'s test_canonicalization; "duplicate meta tags" is verified on the homepage HTML (tags that differ by media are distinct; the finding names the duplicated tags or is dropped); the fix pack edits the live robots.txt (an AI-search group only when those bots are blocked, with the * group\'s path rules copied in; otherwise the file comes back unchanged with a comment); one finding per issue (HTML analysis + content review merged, higher severity kept); the cap message only when the cap lowered the score; Search Console queries with search operators are counted apart as scraper queries and left out of the top queries')
# 28. KEYWORD FIT, LADDER STATE AND HONEST OBSERVATIONS (2026-10-11, system review FIX_PLAN D4 / D8 / D16 / D26 / G3):
#     D4  the full report recommended "fta login" (90,500/mo), "fta", "emaratax", "emirates id", "emirates id status" as keyword gaps (exec 370):
#         Analyze Keywords (v3 code) filtered nothing on intent, brand or government terms. One shared fit gate (v5/code/_fit_gate.js, inlined
#         through /*__FIT_GATE__*/ into Rank Keywords, Ladder Pool, Ladder Plan, Brief Context and patched into Analyze Keywords here) refuses
#         navigational, government / portal and other-brand searches with a reason each; the gap, the easy wins and the opportunities use it,
#         site_keywords.refused lists what was left out and the full report says so.
#     D8  "facts erp" (FACTS ERP, facts.ae on the results page) became a rung-2 post (exec 352): the gate's "other brand" rule in Ladder Pool /
#         Ladder Plan / Brief Context, and the relevance prompt is told the brands.
#     D16 the Rank Tracker's next step follows the ladder's state (Tracker_Report.js, built by build_ladder_extras.py).
#     D26 an AI Overview is one observation at one time (the plan said "none", the page run minutes later "cites 11 domains"): _serp_obs.js
#         (/*__SERP_OBS__*/) in the digest, the keyword strategy and the ladder report; the keyword report's row is patched here.
#     G3  the 2025 Ahrefs figures (1.74% / 40.8%) and an uncalibrated chance band per plan (_reach.js; app/shared/src/keywords.ts mirrors it).
#     The learned AI brand names (seo_cache ai_brands:<site_id>) are read with the description and the reach (one cache read per run).
# =============================================================================
patch('Analyze Keywords', "const notWinning = ideas.filter(k => !k.your_position || k.your_position > 10);",
      "// 2026-10-11 (FIX_PLAN D4): the shared fit gate — government / portal / navigational / other-brand searches are never recommended\n" + FIT_GATE_SRC + "\n"
      "let cacheRowsAK = []; try { cacheRowsAK = $('Load Site Cache').all().map(i => i.json); } catch (e) { cacheRowsAK = []; }\n"
      "const fitCtxAK = { own_domain: base.domain || '', competitors: (base.competitors || []).map(String), serp_domains: comps.map(c => c.domain).filter(d => !(base.competitors || []).includes(d)), brands: fitLearnedBrands(cacheRowsAK), protect: [...seeds, ...(base.services || []), String(base.business || '').slice(0, 400)] };\n"
      "const refused = [];\n"
      "const fitsAK = (k) => { const g = fitGate(k.keyword, { ...fitCtxAK, intent: k.intent }); if (!g.ok) refused.push({ keyword: k.keyword, volume: k.volume, reason: g.reason, detail: g.detail }); return g.ok; };\n"
      "const notWinning = ideas.filter(k => !k.your_position || k.your_position > 10);\n"
      "const notWinningFit = notWinning.filter(fitsAK);")
patch('Analyze Keywords', "  opportunities_by_intent[x] = notWinning.filter(k => k.intent === x)", "  opportunities_by_intent[x] = (x === 'navigational' ? notWinning : notWinningFit).filter(k => k.intent === x)")
patch('Analyze Keywords', "const easy_wins = notWinning\n", "const easy_wins = notWinningFit\n")
patch('Analyze Keywords', "const keyword_gap = notWinning.filter(k => k.competitors.length && (!k.your_position || k.your_position > 20))", "const keyword_gap = notWinningFit.filter(k => k.competitors.length && (!k.your_position || k.your_position > 20))")
patch('Analyze Keywords', "      keyword_gap,\n      striking_distance\n    },", "      keyword_gap,\n      striking_distance,\n      refused: refused.slice(0, 40)\n    },")
assert 'function fitGate(' in code('Analyze Keywords') and 'notWinningFit' in code('Analyze Keywords')
# the full report says what the gap left out on purpose
patch('Build Full Report', "    : '<p>No keyword gap found.</p>');",
      "    : '<p>No keyword gap found.</p>');\n  if ((sk.refused || []).length) html += '<p class=\"small\">Left out of the gap on purpose: ' + sk.refused.length + ' searches for government portals, logins or other companies\\' brands (e.g. ' + sk.refused.slice(0, 5).map(r => esc(r.keyword) + ' — ' + esc(r.reason)).join(', ') + ').</p>';")
# D26: the keyword report's results-page row says when the AI Overview was (not) seen; the observation rules are prefixed to the v3 node
setcode('Build Word File', SERP_OBS_SRC + '\n' + code('Build Word File'))
patch('Build Word File', "      ['AI Overview', aio.present ? 'Shown — cites ' + esc((aio.cited_domains || []).join(', ') || 'unknown sources') : 'Not shown for this query'],",
      "      ['AI Overview', esc(aioObserved([{ seen: aio.present == null ? null : !!aio.present, at: aio.seen_at || sf.checked_at }]).text.replace(/^./, c => c.toUpperCase())) + (aio.present ? '. In that check it cited ' + esc((aio.cited_domains || []).join(', ') || 'unknown sources') + '.' : '')],")
# the learned AI brand names come with the one cache read per run (desc: + reach: + ai_brands:)
_lsc26 = nodes['Load Site Cache']['parameters']
assert _lsc26['matchType'] == 'anyCondition' and len(_lsc26['filters']['conditions']) == 2
_lsc26['filters']['conditions'].append({'keyName': 'key', 'condition': 'eq', 'keyValue': "={{ 'ai_brands:site_' + " + SITE_ID_EXPR + " }}"})
# every node that asked for a kit got it, and no placeholder is left
for _n in ('Rank Keywords', 'Ladder Pool', 'Ladder Plan', 'Brief Context', 'Analyze Keywords'): assert 'function fitGate(' in code(_n), _n + ': fit gate not inlined'
for _n in [x for x in ('Analyze Competitor Pages', 'Clean Competitor Pages') if x in nodes] + ['Build Keyword Strategy', 'Build Ladder Report', 'Build Word File']: assert 'const aioObserved' in code(_n), _n + ': observation rules not inlined'
assert 'reachChanceText(plan)' in code('Ladder Plan') and 'reachBaseRateText()' in code('Build Ladder Report') and 'reachBaseRateText()' in code('Build Keyword Strategy')
assert not any('/*__FIT_GATE__*/' in n['parameters'].get('jsCode', '') or '/*__SERP_OBS__*/' in n['parameters'].get('jsCode', '') for n in nodes.values()), 'kit placeholder left'
# harness shims (S34): the two kits as runnable scripts, one item per keyword / observation set
os.makedirs(OUT_CODE, exist_ok=True)
open(os.path.join(OUT_CODE, '_fit_gate.js'), 'w').write("// harness shim (written by build_v4.py section 26): the fit gate, run per item like a Code node — { keyword, intent, ctx } -> fitGate's answer\n" + FIT_GATE_SRC +
    "\nreturn $input.all().map(i => { const j = i.json || {}; return { json: { keyword: j.keyword, ...fitGate(j.keyword, { ...(j.ctx || {}), intent: j.intent }), brands_text: fitBrandList(j.ctx || {}, (j.ctx || {}).protect) } }; });\n")
open(os.path.join(OUT_CODE, '_serp_obs.js'), 'w').write("// harness shim (written by build_v4.py section 26): the results-page observation rules — { serp, at, obs } -> { seen_at, clock, count, seen, text }\n" + SERP_OBS_SRC +
    "\nreturn $input.all().map(i => { const j = i.json || {}; return { json: { seen_at: j.serp ? serpSeenAt(j.serp) : null, clock: j.at ? obsClock(j.at) : null, ...aioObserved(j.obs || []) } }; });\n")
log('System review fixes (2026-10-11, FIX_PLAN D4 / D8 / D16 / D26 / G3): one shared keyword fit gate (navigational, government / portal, other brands — competitor and results-page domain labels, learned AI brand names, SERP dominance; v5/code/_fit_gate.js) in Analyze Keywords, Rank Keywords, Ladder Pool, Ladder Plan and Brief Context with a reason per refusal (site_keywords.refused, keyword_strategy.refused, ladder refused_keywords); the relevance prompt is told the brands; the Rank Tracker\'s next step follows the ladder state (write / publish / rungs / improve); an AI Overview is a timed observation ("seen in the check at …", "seen in N of M checks"; v5/code/_serp_obs.js) in the digest, the verdict rules, the keyword report, the keyword strategy and the ladder report; the 2025 Ahrefs base rate (1.74% / 40.8%) with an uncalibrated chance band per plan (_reach.js, app mirror)')

# =============================================================================
# 29. WHAT THE PHASE 1 LIVE CHECK FOUND (P1-1 … P1-5, 2026-10-12, docs/system-review-2026-10-11/LIVE_CHECK_phase1_2026-10-12.md §3).
#     P1-1 short runs never settled their ledger row (wired in section 26, above); checked here: every mode reaches Settle Run Ledger, and the
#          wiring is written to harness/ledger_wiring.json for the harness (S36).
#     P1-2 link-farm pages still filled "Links lost" and drove the referring-sites drop alert — v5/code/Parse_Backlinks.js.
#     P1-3 the scraper-query rule missed "-site:…" and lower-case and / or, so 4 of 10 top queries were scrapers — v5/code/GSC_Audit_Findings.js.
#     P1-4 the full report's §4a still recommended "fta login", "emaratax", "fta portal" and brands such as "character ai": the fit gate ran on
#          the gap and the easy wins only, the navigational bucket was deliberately left ungated, and the matching finding ("No rankings for
#          navigational searches") counted the same terms. The gate now runs on every list the customer is shown; a keyword the site itself
#          ranks for on page 2 keeps its own-brand rows (that is the owner's own name, worth fixing), and the navigational finding is dropped:
#          no page of this site should chase another company's brand searches.
#     P1-5 §4a printed DataForSEO's float32 CPCs raw (8.84000015258789) — rounded to 2 decimals, as the keyword strategy already does.
# =============================================================================
# ---- P1-4: every keyword list the full report shows runs through the fit gate ----
patch('Analyze Keywords', "  opportunities_by_intent[x] = (x === 'navigational' ? notWinning : notWinningFit).filter(k => k.intent === x)",
      "  opportunities_by_intent[x] = notWinningFit.filter(k => k.intent === x)   // P1-4 (2026-10-12): the navigational bucket was ungated and recommended fta login / emaratax / other brands")
patch('Analyze Keywords', """const striking_distance = you.keywords.filter(k => k.position >= 11 && k.position <= 20)""",
      """// P1-4: page-2 keywords are shown as "quick wins", so they run through the gate too — but a search for the site's OWN brand stays (ranking
// 11-20 for your own name is a real problem to fix, not a keyword to drop)
const fitsOwnAK = (k) => { const g = fitGate(k.keyword, { ...fitCtxAK, intent: k.intent }); if (g.ok || g.reason === 'own brand') return true; refused.push({ keyword: k.keyword, volume: k.volume, reason: g.reason, detail: g.detail }); return false; };
const striking_distance = you.keywords.filter(k => k.position >= 11 && k.position <= 20).filter(fitsOwnAK)""")
patch('Analyze Keywords', """INTENTS.forEach(x => {
  const med = median(comps.map(c => c.by_intent[x]));""",
      """INTENTS.filter(x => x !== 'navigational').forEach(x => {   // P1-4: "no rankings for navigational searches" counted other companies' brands — never a goal for this site
  const med = median(comps.map(c => c.by_intent[x]));""")
patch('Analyze Keywords', "      refused: refused.slice(0, 40)\n", "      refused: refused.filter((r, i, a) => a.findIndex(x => x.keyword === r.keyword) === i).slice(0, 40)\n")
assert 'fitsOwnAK' in code('Analyze Keywords') and "x === 'navigational' ? notWinning" not in code('Analyze Keywords')
# ---- P1-5: the intent tables round the CPC (DataForSEO sends float32: 8.84000015258789) ----
patch('Build Full Report', "const diffLabel = (v) =>", "const cpcTxt = (c) => (c == null || c === '' || isNaN(c)) ? 'N/A' : (Math.round(Number(c) * 100) / 100).toFixed(2);   // P1-5 (2026-10-12): DataForSEO CPCs are float32\nconst diffLabel = (v) =>")
patch('Build Full Report', "<td>${k.cpc == null ? 'N/A' : k.cpc}</td>", "<td>${cpcTxt(k.cpc)}</td>")
# ---- P1-1: no mode may leave its ledger row reserved; the wiring goes to the harness (S36) ----
def _reach(start):
    seen, stack = set(), [start]
    while stack:
        n = stack.pop()
        if n in seen: continue
        seen.add(n)
        for lst in (conns.get(n, {}).get('main') or []):
            for t in (lst or []): stack.append(t['node'])
    return seen
_settle_all = set(_ends) | set(SETTLE_ENDS.values())
_rm_out = conns['Route Mode']['main']
_mode_settles = {}
for _i, _rule in enumerate(nodes['Route Mode']['parameters']['rules']['values']):
    _mname = _rule.get('outputKey') or ('output' + str(_i))
    _tg = [t['node'] for t in (_rm_out[_i] if _i < len(_rm_out) else [])]
    _rc = set().union(*[_reach(t) for t in _tg]) if _tg else set()
    _mode_settles[_mname] = sorted(_rc & _settle_all)
    assert _mode_settles[_mname], 'P1-1: mode "' + _mname + '" never reaches Settle Run Ledger'
_sn, _mr = nodes['Settle Run Ledger']['parameters'], nodes['Mark Run Refused']['parameters']
json.dump({'settle_node': 'Settle Run Ledger', 'settle_from': sorted(s for s, o in conns.items() for l in (o.get('main') or []) for t in (l or []) if t['node'] == 'Settle Run Ledger'),
           'settle_conditions': [[c['keyName'], c['keyValue']] for c in _sn['filters']['conditions']], 'settle_values': _sn['columns']['value'],
           'refused_conditions': [[c['keyName'], c['keyValue']] for c in _mr['filters']['conditions']], 'refused_values': _mr['columns']['value'],
           'modes': _mode_settles}, open(os.path.join(HERE0, 'harness', 'ledger_wiring.json'), 'w'), indent=1)
log('Phase 1 live-check defects (2026-10-12, P1-1 … P1-5): every mode settles its run-ledger row (the short modes left it reserved for ever) and the settle update matches status = reserved, so a row settles once and a refused row stays refused; link-farm pages never count as lost, never produce reclaim advice and never drive the referring-sites drop alert (Parse_Backlinks.js); the scraper-query rule catches "-site:", lower-case and / or and quoted or bracketed groups (GSC_Audit_Findings.js); the keyword fit gate runs on the opportunities by intent and the page-2 quick wins as well, and "no rankings for navigational searches" is gone; the full report rounds CPCs to 2 decimals')
# 30. ONE SITE MODEL (G19, 2026-10-12, system review FIX_PLAN.md; SITE_MODEL_SPEC.md): features shared no canonical host, no business
#     name / NAP, no page inventory and no business facts, so their advice contradicted itself (D5, D10, D11, D15, D22). One model now
#     holds them: v5/code/_site_model.js (marker /*__SITE_MODEL__*/) with SM.from / siteUrl / apiTarget / name / nap / services / pages /
#     facts / matchPage / toRow, stored in the new seo_sites columns (canonical_host, business_name, logo_url, nap_json, services_json,
#     nav_pages_json, business_facts, cta, brand_names, competitors, accreditation, model_updated_at) and the new table seo_pages.
#     Resolvers: the Site Tracker weekly (build_site_tracker.py) and, on demand, here before Route Mode - a model younger than
#     SM.FRESH_DAYS (7) is reused, otherwise the homepage is read once (redirects followed) and the rebuilt model is kept in seo_cache
#     ('model:<site_id>'); seo_sites is never written here, because a row there would start the weekly paid runs for an untracked site.
# =============================================================================
from ladder_common import PAGES_TABLE, PAGES_COLS
SITE_KEY30 = "={{ 'site_' + " + SITE_ID_EXPR + " }}"
_ucd30 = pos('Use Cached Description'); MX30, MY30 = _ucd30[0], _ucd30[1] - 260
disconnect('Use Cached Description', 'Need Site Read?')
add_node('Ensure Sites Table (Model)', DT_TYPE, DT_VERSION, dt_create_params(SITES_TABLE, SITES_COLS), [MX30 + 220, MY30], {'onError': 'continueRegularOutput', 'executeOnce': True})
add_node('Ensure Pages Table (Model)', DT_TYPE, DT_VERSION, dt_create_params(PAGES_TABLE, PAGES_COLS), [MX30 + 440, MY30], {'onError': 'continueRegularOutput', 'executeOnce': True})
add_node('Load Site Row (Model)', DT_TYPE, DT_VERSION, dt_get_where_params(SITES_TABLE, 'site_id', 'eq', SITE_KEY30), [MX30 + 660, MY30], LOAD18)
add_node('Load Profile (Model)', DT_TYPE, DT_VERSION, dt_get_where_params(PROFILE_TABLE, 'site_id', 'eq', SITE_KEY30), [MX30 + 880, MY30], LOAD18)
add_node('Site Model Plan', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Site_Model_Plan.js')}, [MX30 + 1100, MY30])
if_node('Need Homepage (Model)?', "{{ !$json.skip }}", [MX30 + 1320, MY30])
add_node('Fetch Homepage (Model)', 'n8n-nodes-base.httpRequest', 4.5, {'url': '={{ $json.url }}', 'sendHeaders': True,
    'headerParameters': {'parameters': [{'name': 'User-Agent', 'value': 'Mozilla/5.0 (compatible; SEO-Agent/4.15)'}, {'name': 'Accept', 'value': 'text/html,application/xhtml+xml'}]},
    'options': {'timeout': 20000, 'redirect': {'redirect': {'followRedirects': True, 'maxRedirects': 5}}, 'response': {'response': {'fullResponse': True, 'neverError': True, 'responseFormat': 'text'}}}},
    [MX30 + 1540, MY30 - 120], {'alwaysOutputData': True, 'onError': 'continueRegularOutput', 'retryOnFail': True, 'maxTries': 2, 'waitBetweenTries': 2000})
add_node('Site Model', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Site_Model.js')}, [MX30 + 1760, MY30])
add_node('Model Cache Row', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Model_Cache_Row.js')}, [MX30 + 1980, MY30])
if_node('New Site Model?', "{{ !$json.skip }}", [MX30 + 2200, MY30])
add_node('Save Site Model', DT_TYPE, DT_VERSION, dt_upsert_params(CACHE_TABLE, CACHE_COLS, 'key'), [MX30 + 2420, MY30 - 120], {'onError': 'continueRegularOutput', 'alwaysOutputData': True})
add_node('Restore Site Model', 'n8n-nodes-base.code', 2, {'jsCode': "// The run continues with the request item and its site model (a Data Table node outputs the stored row, not the run's item).\nreturn [{ json: $('Site Model').first().json }];"}, [MX30 + 2640, MY30])
for a, b in [('Use Cached Description', 'Ensure Sites Table (Model)'), ('Ensure Sites Table (Model)', 'Ensure Pages Table (Model)'), ('Ensure Pages Table (Model)', 'Load Site Row (Model)'),
             ('Load Site Row (Model)', 'Load Profile (Model)'), ('Load Profile (Model)', 'Site Model Plan'), ('Site Model Plan', 'Need Homepage (Model)?'),
             ('Fetch Homepage (Model)', 'Site Model'), ('Site Model', 'Model Cache Row'), ('Model Cache Row', 'New Site Model?'), ('Save Site Model', 'Restore Site Model'), ('Restore Site Model', 'Need Site Read?')]:
    connect(a, b)
connect('Need Homepage (Model)?', 'Fetch Homepage (Model)', 0); connect('Need Homepage (Model)?', 'Site Model', 1)
connect('New Site Model?', 'Save Site Model', 0); connect('New Site Model?', 'Restore Site Model', 1)
# the stored model comes with the one cache read per run (desc: + reach: + ai_brands: + model:)
_lsc30 = nodes['Load Site Cache']['parameters']
assert _lsc30['matchType'] == 'anyCondition' and len(_lsc30['filters']['conditions']) == 3
_lsc30['filters']['conditions'].append({'keyName': 'key', 'condition': 'eq', 'keyValue': "={{ 'model:site_' + " + SITE_ID_EXPR + " }}"})
for _n in ('Site Model Plan', 'Site Model', 'Model Cache Row'): assert 'const SM = (() => {' in code(_n), _n + ': site model kit not inlined'
assert not any('/*__SITE_MODEL__*/' in n['parameters'].get('jsCode', '') for n in nodes.values()), 'site model placeholder left'
# harness shim (S35): the kit as a runnable script, one call per item
os.makedirs(OUT_CODE, exist_ok=True)
open(os.path.join(OUT_CODE, '_site_model.js'), 'w').write("// harness shim (written by build_v4.py section 30): the site model kit - { site_row, extras, path, keyword } -> the model and what SM answers about it\n" + SITE_MODEL_SRC +
    "\nreturn $input.all().map(i => { const j = i.json || {}; const model = j.model || SM.from(j.site_row || {}, j.extras || {});\n"
    "  return { json: { model, row: SM.toRow(model), columns: SM.COLUMNS, site_url: SM.siteUrl(model, j.path === undefined ? '/' : j.path), api_target: SM.apiTarget(model), name: SM.name(model),\n"
    "    nap: SM.nap(model), services: SM.services(model), pages: SM.pages(model), facts: SM.facts(model), match: j.keyword === undefined ? null : SM.matchPage(model, j.keyword),\n"
    "    page_rows: SM.pageRows(model), fresh: SM.isFresh(model, j.fresh_days), age_days: SM.ageDays(model), stored: SM.stored(j.site_row || {}) } }; });\n")
sticky("""### One site model (G19, v4.15)
Every workflow reads the same facts about a site through **SM** (`v5/code/_site_model.js`): the **canonical host** (every URL we emit), the business **name / logo / NAP** (profile -> homepage Organization / LocalBusiness schema -> Google Business Profile -> what the app sent), the **services** and nav pages, the **page inventory** (`seo_pages`), the **business facts** and call to action, the brand names, the competitors and the accreditation status. Stored in the `seo_sites` model columns, resolved **weekly** by the Site Tracker and **on demand** here (reused for 7 days, else the homepage is read once; the rebuilt model is cached in `seo_cache` `model:`). See `SITE_MODEL_SPEC.md`.""", MX30 + 220, MY30 - 220, 1100, 180, 5)
log('One site model (G19, 2026-10-12): v5/code/_site_model.js (SM.from / siteUrl / apiTarget / name / nap / services / pages / facts / matchPage / toRow) with the new seo_sites columns (canonical_host, business_name, logo_url, nap_json, services_json, nav_pages_json, business_facts, cta, brand_names, competitors, accreditation, model_updated_at) and the new table seo_pages; resolved weekly in the Site Tracker and on demand before Route Mode (reused 7 days, rebuilt from the homepage, cached in seo_cache model:)')
# 31. EVERY WRITTEN PAGE IS LOGGED (v4.14, 2026-10-11, FIX_PLAN D5): the pile-up guard undercounted the pages waiting to be published,
#     because pages written by a keyword ladder were never in seo_content_log — only the Content Cadence and the web app wrote a row.
#     The cadence counted 2 pages waiting while 4 were written and unpublished, and planned 2 more for the Monday after (exec 380).
#     Every content run ends in this workflow, so the row is written here for all three: Blog Package (the article exists) branches into
#     Content Log Row, which reads the stored rows and upserts one row per site + keyword (status started -> written; "I published a
#     page" and the Site Tracker's publish detection set published). Delivery is untouched: the branch hangs beside it.
# =============================================================================
from ladder_common import LOG_TABLE as LOG31, LOG_COLS as LOGC31
_bp31 = pos('Blog Package')
LOAD31 = {'alwaysOutputData': True, 'executeOnce': True, 'onError': 'continueRegularOutput'}
add_node('Ensure Log Table (Run)', DT_TYPE, DT_VERSION, dt_create_params(LOG31, LOGC31), [_bp31[0] + 220, _bp31[1] - 220], {'onError': 'continueRegularOutput'})
add_node('Load Content Log (Run)', DT_TYPE, DT_VERSION, dt_get_all_params(LOG31), [_bp31[0] + 440, _bp31[1] - 220], LOAD31)
add_node('Content Log Row', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Content_Log_Row.js')}, [_bp31[0] + 660, _bp31[1] - 220])
if_node('Log This Page?', "{{ !$json.skip }}", [_bp31[0] + 880, _bp31[1] - 220])
add_node('Save Content Log (Run)', DT_TYPE, DT_VERSION, dt_upsert_params_keys(LOG31, LOGC31, ['site_id', 'keyword']), [_bp31[0] + 1100, _bp31[1] - 220], {'onError': 'continueRegularOutput', 'alwaysOutputData': True})
for a, b in [('Blog Package', 'Ensure Log Table (Run)'), ('Ensure Log Table (Run)', 'Load Content Log (Run)'), ('Load Content Log (Run)', 'Content Log Row')]:
    connect(a, b)
connect('Content Log Row', 'Log This Page?'); connect('Log This Page?', 'Save Content Log (Run)', 0)
assert [t['node'] for t in conns['Blog Package']['main'][0]][-1] == 'Ensure Log Table (Run)', 'content log branch not last on Blog Package'
assert "rowsOf('Load Content Log (Run)')" in code('Content Log Row'), 'Content Log Row must read the stored rows explicitly (a Data Table node outputs the table, not the item)'
assert "$('Blog Package')" in code('Content Log Row'), 'Content Log Row must check that a page was written (report-only runs take the same delivery path)'
sticky("""### Every written page is logged (v4.14, FIX_PLAN D5)
`Blog Package` -> **Content Log Row** -> **Save Content Log (Run)**: one `seo_content_log` row per content run, upserted by `site_id` + `keyword`, status **written**. Ladder page runs were invisible before (only the Content Cadence and the web app wrote rows), so the **pile-up guard** undercounted the pages waiting to be published. The row keeps what the opening row knows (`source`, the week, the last published URL); "I published a page" and the Site Tracker's publish detection set `published`.""",
    _bp31[0] + 180, _bp31[1] - 460, 900, 200, 6)
log('Every written page is logged (v4.14, FIX_PLAN D5): the main workflow upserts one seo_content_log row per content run (ladder page runs, the app\'s "Write now", the Content Cadence) by site_id + keyword with status written, so the Content Cadence\'s pile-up guard sees every page that waits to be published')
# 32. CONTENT CORRECTNESS (2026-10-11, system review FIX_PLAN D9 / G2 / G4):
#     D9  the Direct-plan main page was published first and linked twice each to 3 pages that do not exist, and "Guides in this series"
#         used lowercase keyword strings as anchors ("Facts erp") (exec 365). A ladder page is a link target only when the site really has
#         it (sitemap / crawl); everything else travels as `planned_link_targets`, is described in the brief without a link_to, is stripped
#         from the copy by Content QA, is left out of the "Guides in this series" block and the ItemList, and is listed in meta.json as
#         `links_to_add_when_published`. The Rank Tracker reminds the owner, with the anchor, the week a planned page goes live.
#         Anchors come from v5/code/_anchor.js: the page's title, else the title-cased keyword with the acronyms kept ("Facts ERP").
#     G2  FAQPage schema is no longer emitted and no FAQ block is scored (Google stopped showing FAQ rich results on 2026-05-07):
#         Content QA scores question headings answered directly instead, AI Readiness dropped its FAQ check (its weight moved to the
#         question headings, total still 100) and the brief / copywriter / critic / editor prompts ask for question headings, not an FAQ.
#     G4  figures were never matched to their sources: a weak source (trangotech.com) was cited 3 times and a Statista link kept
#         `?srsltid=` (exec 365). v5/code/_sources.js cleans every link (utm_*, srsltid, gclid, fbclid) in the copy, the package and the
#         schema, ranks a source (primary / research / press / vendor documentation / weak) and looks every figure of a cited sentence up
#         in the text that source actually gave us (fact snippets, the evidence plan, the competitor pages we read), in any format.
#         A figure that is not there becomes [Confirm: ...]; a weak domain may be cited once; the critic prompt carries the same list.
# =============================================================================
# D9: the writer may only link to a ladder page the site already has; the rest are planned link targets
patch('Collect Site URLs', "// Ladder page runs: the other ladder pages (top page, sibling) are link targets even when they are planned and not live yet",
      "// Ladder page runs: the other ladder pages (top page, sibling) are link targets - but only the ones the site really has.\n// 2026-10-11 (FIX_PLAN D9): a page the ladder has only planned is not a link target; it travels as planned_link_targets so the brief can\n// describe it, Content QA can strip any link to it and the blog package can list it as a link to add once it is published.")
patch('Collect Site URLs', "const candidates2 = candidates.filter(c => !ladderUrls.has(String(c.url).replace(/\\/$/, '')));",
      "const liveUrls = new Set(pages.map(p => String(p.url).replace(/\\/$/, '')));\n"
      "const ladderLive = ladderLinks.filter(l => liveUrls.has(String(l.url).replace(/\\/$/, ''))).map(l => ({ ...l, planned: false }));\n"
      "const ladderPlanned = ladderLinks.filter(l => !liveUrls.has(String(l.url).replace(/\\/$/, ''))).map(l => ({ ...l, planned: true }));\n"
      "const candidates2 = candidates.filter(c => !ladderUrls.has(String(c.url).replace(/\\/$/, '')));")
patch('Collect Site URLs', "...ladderLinks.filter(l => String(l.url).replace(/\\/$/, '') !== home.replace(/\\/$/, '')), ...candidates2],",
      "...ladderLive.filter(l => String(l.url).replace(/\\/$/, '') !== home.replace(/\\/$/, '')), ...candidates2],\n    planned_link_targets: ladderPlanned,")
assert 'planned_link_targets' in code('Collect Site URLs') and 'ladderLive' in code('Collect Site URLs')
# the kits reached the nodes that asked for them, and no placeholder is left anywhere
for _n in ('Content QA', 'Blog Package', 'Collect Facts'): assert 'const SRC = (() =>' in code(_n), _n + ': source kit not inlined'
for _n in ('Content QA', 'Blog Package', 'Brief Context'): assert 'function anchorText(' in code(_n), _n + ': anchor kit not inlined'
assert not any('/*__SOURCES__*/' in n['parameters'].get('jsCode', '') or '/*__ANCHOR__*/' in n['parameters'].get('jsCode', '') for n in nodes.values()), 'kit placeholder left'
# G2: nothing emits or scores FAQPage any more, and no prompt asks for an FAQ section
for _n in ('Content QA', 'AI Readiness'):
    if _n in nodes: assert '"FAQPage"' not in code(_n) and "'FAQPage'" not in code(_n), _n + ': FAQPage still emitted'
assert 'validFaqs.length >= 5' not in code('Content QA') and 'answeredQuestions >= 3' in code('Content QA'), 'Content QA still scores an FAQ block'
for _p in ('prompts/copywriter.txt', 'prompts/strategy_brief.txt', 'prompts/critic.txt', 'prompts/editor.txt'):
    assert 'FAQPage' not in rd(_p) and '## Frequently Asked Questions' not in rd(_p), _p + ': still asks for an FAQ section'
# G4: the critic is told what a usable source is
assert 'SOURCE QUALITY' in rd('prompts/critic.txt')
# harness shims (S38): the two kits as runnable scripts, one item in -> one answer out
os.makedirs(OUT_CODE, exist_ok=True)
open(os.path.join(OUT_CODE, '_sources.js'), 'w').write("// harness shim (written by build_v4.py section 32): the source kit - { url?, text?, figure?, source? } -> clean / tier / figures / hasFigure\n" + SOURCES_SRC +
    "\nreturn $input.all().map(i => { const j = i.json || {}; return { json: { url: j.url == null ? null : SRC.clean(j.url), host: j.url ? SRC.host(j.url) : '', tier: j.url ? SRC.tier(j.url) : '', figures: SRC.figures(j.text || ''), found: (j.figure != null && j.source != null) ? SRC.hasFigure(SRC.valueOf(j.figure), j.source) : null } }; });\n")
open(os.path.join(OUT_CODE, '_anchor.js'), 'w').write("// harness shim (written by build_v4.py section 32): the anchor kit - { keyword?, title?, url? } -> the words a link uses\n" + ANCHOR_SRC +
    "\nreturn $input.all().map(i => ({ json: { anchor: anchorText(i.json || {}), title_case: titleCaseKeyword((i.json || {}).keyword || '') } }));\n")
log('Content correctness (2026-10-11, FIX_PLAN D9 / G2 / G4): only a page the site really has is a link target (Collect Site URLs splits the ladder links into live and planned_link_targets; Content QA strips links to planned pages, the hub block and the ItemList list the live ones only, meta.json carries links_to_add_when_published and the Rank Tracker reminds the owner the week one goes live), anchors come from the page title or the title-cased keyword with the acronyms kept (v5/code/_anchor.js); no FAQPage schema and no FAQ block scored anywhere (question headings answered directly instead, in Content QA, AI Readiness and the brief / copywriter / critic / editor prompts); every figure of a cited sentence is looked up in the text that source gave us and marked [Confirm: ...] when it is not there, a source with no independent authority may be cited once, and utm_* / srsltid / gclid / fbclid are stripped from every link in the copy, the package and the schema (v5/code/_sources.js)')
# 33. THE SITE DESCRIPTION READS THE WHOLE SITE (2026-10-11, system review FIX_PLAN D22): only the homepage was ever read, so most of what a
#     business sells was invisible. Live on techand.ai: `describe` listed 8 services and left out Business Central, CRM and Power Platform (all
#     on /whatwedo/), the Keyword Check scored "business central partner uae" at fit 1, and the critic called the site's real delivery stages
#     ("Assess & Envision", "Run & Optimise") invented. Now Clean Site Text keeps the homepage's own menu links (nav_pages: same host, max 12,
#     with their link text, taken from the raw Jina markdown before the links are stripped), Nav Pages Plan picks up to 5 service / section
#     pages, Read Nav Pages fetches them (one request each, 20 s, no retry) and Site Pages hands the describer the homepage plus those pages —
#     a page that fails or is blocked is skipped. The services and the page list travel with the description (`products_or_services`,
#     `pages_read`, `nav_pages`, `site_facts`: the headings of every page read), so the 30-day seo_cache row, the Keyword Check (Assess Result)
#     and the content pipeline all carry the full list; `pages_read` also dates the row, so a homepage-only description stored before this
#     change is read again instead of trusted (Use Cached Description). The critic is given those facts and may no longer call a claim found on
#     the website invented (critic.txt + Parse Critique, which drops such claims and renames the rest "unverified").
#     Cost: the extra pages go through the same free Jina Reader credential; the describer stays one Haiku call with a longer input
#     (≈ $0.01 instead of ≈ $0.005) and the run grows by roughly 20-35 s, once per site per 30 days.
# =============================================================================
_sdp = pos('Site Describer'); _srk = pos('Site Read OK?')
# a. the homepage's own menu links, from the raw markdown Clean Site Text still holds
patch('Clean Site Text', """return [{
  json: {
    ...input,
    page_title: pageTitle,
    site_text: text,
    read_ok
  }
}];""", """// D22 (2026-10-11): the homepage's own header / menu links, so the service pages can be read too (same host, max 12, with their link text).
// Taken from the raw markdown before the links are stripped; the n8n Code sandbox has no URL constructor, so hosts come from a regex.
const NAV = { max: 12, header_chars: 3500, text_chars: 80 };
const navHost = (u) => ((String(u || '').match(/^https?:\\/\\/([^\\/?#]+)/i) || [])[1] || '').toLowerCase().replace(/^www\\./, '').replace(/:\\d+$/, '');
const navSelf = navHost(((raw.match(/^URL Source:\\s*(\\S+)/m) || [])[1]) || '') || String(input.domain || '').toLowerCase().replace(/^www\\./, '');
const navBody = raw.replace(/^Title:.*$/m, '').replace(/^URL Source:.*$/m, '').replace(/^Markdown Content:\\s*$/m, '');
const navFirstH = navBody.search(/^#{1,3}\\s/m);   // the menu sits above the first heading; below it a link is only a nav page if it looks like one
const NAV_SERVICE = /(service|solution|product|offering|expertise|capabilit|industr|platform|technolog|consult|what-?we-?do|whatwedo)/i;
const nav_pages = []; const navSeen = new Set();
for (const [region, inHeader] of [[navBody.slice(0, navFirstH > 0 ? Math.min(navFirstH, NAV.header_chars) : NAV.header_chars), true], [navBody, false]]) {
  for (const m of region.matchAll(/\\[([^\\]\\n]{1,120})\\]\\((https?:\\/\\/[^)\\s]+)\\)/g)) {
    if (nav_pages.length >= NAV.max) break;
    const label = m[1].replace(/[*_`#!]/g, '').replace(/\\s+/g, ' ').trim();
    const url = m[2].replace(/[.,;]+$/, '').replace(/[?#].*$/, '');
    if (navHost(url) !== navSelf || !navSelf) continue;
    const path = url.replace(/^https?:\\/\\/[^\\/?#]*/i, '') || '/';
    if (path === '/' || /\\.(pdf|jpe?g|png|gif|svg|webp|avif|mp4|mp3|zip|docx?|xlsx?|pptx?|css|js|xml|ico)$/i.test(path)) continue;
    const key = path.replace(/\\/+$/, '').toLowerCase() || '/';
    if (navSeen.has(key)) continue;
    if (!inHeader && !NAV_SERVICE.test(path) && !NAV_SERVICE.test(label)) continue;   // below the header only service-looking links count
    navSeen.add(key);
    nav_pages.push({ url, text: label.slice(0, NAV.text_chars), path: key, in_header: inHeader });
  }
  if (nav_pages.length >= NAV.max) break;
}

return [{
  json: {
    ...input,
    page_title: pageTitle,
    site_text: text,
    read_ok,
    nav_pages
  }
}];""")
# b. the menu pages: pick, read, merge
add_node('Nav Pages Plan', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Nav_Pages_Plan.js')}, [_srk[0] + 180, _srk[1] + 160])
if_node('Nav Pages To Read?', "{{ !$json.skip }}", [_srk[0] + 360, _srk[1] + 160])
add_node('Read Nav Pages', 'n8n-nodes-base.httpRequest', 4.5, {'url': '=https://r.jina.ai/{{ $json.url }}', 'authentication': 'genericCredentialType', 'genericAuthType': 'httpHeaderAuth',
    'sendHeaders': True, 'headerParameters': {'parameters': [{'name': 'X-Remove-Selector', 'value': 'script, style, form, [class*="cookie"], [id*="cookie"], [class*="consent"], [id*="consent"], [id*="onetrust"]'}, {'name': 'X-Retain-Images', 'value': 'none'}]},
    'options': {'batching': {'batch': {'batchSize': 1, 'batchInterval': 1500}}, 'response': {'response': {'responseFormat': 'text', 'outputPropertyName': 'page_text'}}, 'timeout': 20000}},
    [_srk[0] + 540, _srk[1] + 160], {'onError': 'continueRegularOutput', 'alwaysOutputData': True})
slot('Read Nav Pages', 'jina')
add_node('Site Pages', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Site_Pages.js')}, [_srk[0] + 720, _srk[1] + 160], {'alwaysOutputData': True})
disconnect('Site Read OK?', 'Site Describer')
connect('Site Read OK?', 'Nav Pages Plan', 0)
connect('Nav Pages Plan', 'Nav Pages To Read?')
connect('Nav Pages To Read?', 'Read Nav Pages', 0)
connect('Nav Pages To Read?', 'Site Pages', 1)
connect('Read Nav Pages', 'Site Pages')
connect('Site Pages', 'Site Describer')
# c. the describer reads every page it was given, and names every service
assert 'Below is the text content of the homepage' in nodes['Site Describer']['parameters']['text'], 'Site Describer: unexpected v3 prompt'
set_prompt('Site Describer', 'site_describer.txt')
# d. the services, the pages read and what the site says about itself travel with the description (and into the 30-day cache row)
patch('Parse Description', "const prev = $('Clean Site Text').first().json;\nconst desc = parseAgentJson($input.first().json.output);",
      """// D22 (2026-10-11): the description is written from the homepage AND the menu pages that were read (Site Pages). What those pages say stays
// with it — the pages read, the site's own menu links and the headings the critic may not call invented — and goes into the 30-day seo_cache
// row, where `pages_read` also marks the description as written by this version (an older, homepage-only row is read again).
let prev; try { prev = $('Site Pages').first().json; } catch (e) { prev = $('Clean Site Text').first().json; }
const desc = parseAgentJson($input.first().json.output);
const homeUrl = 'https://' + String(prev.domain || '').replace(/^https?:\\/\\//, '');
desc.pages_read = (prev.site_pages && prev.site_pages.length ? prev.site_pages : [{ url: homeUrl, title: prev.page_title || '', kind: 'homepage' }])
  .map(p => ({ url: p.url, title: String(p.title || '').slice(0, 120), kind: p.kind || 'page' })).slice(0, 8);
desc.nav_pages = (prev.nav_pages || []).slice(0, 12).map(p => ({ url: p.url, text: String(p.text || '').slice(0, 80) }));
desc.site_facts = [...new Set([...(desc.products_or_services || []), ...(desc.unique_selling_points || []), ...(prev.site_facts || [])]
  .map(x => String(x == null ? '' : x).trim()).filter(x => x.length >= 3))].slice(0, 50).map(x => x.slice(0, 120));""")
patch('Parse Description', "    site_text: undefined,   // lamba text aage nahi chahiye",
      "    site_text: undefined,   // lamba text aage nahi chahiye\n    pages_text: undefined, site_pages: undefined, site_facts: undefined, nav_pages: undefined,   // D22: kept inside site_description")
# e. the describe page says which pages were read
patch('Build Description Page', "      <b>Brand Tone:</b> ${esc(s.tone_of_brand)}</p>",
      "      <b>Brand Tone:</b> ${esc(s.tone_of_brand)}<br>\n      <b>Pages read:</b> ${(s.pages_read || []).length ? (s.pages_read || []).map(p => esc(p.title || p.url)).join(', ') : 'homepage'}</p>")
# f. the agents' prompts next to the Code nodes, so the harness can check what a prompt always carries (S42, D22)
os.makedirs(OUT_CODE, exist_ok=True)
for _n in nodes.values():
    if _n['type'] == '@n8n/n8n-nodes-langchain.agent':
        open(os.path.join(OUT_CODE, re.sub(r'[^A-Za-z0-9_.-]+', '_', _n['name']) + '.prompt.txt'), 'w').write(_n['parameters']['text'])
assert nodes['Read Nav Pages'].get('credentials'), 'Read Nav Pages: credential slot missing'
assert 'nav_pages' in code('Clean Site Text') and 'site_facts' in code('Parse Description') and "$('Site Pages')" in code('Parse Description')
assert conns['Site Read OK?']['main'][0][0]['node'] == 'Nav Pages Plan' and conns['Site Pages']['main'][0][0]['node'] == 'Site Describer'
log('Site description (2026-10-11, FIX_PLAN D22): the homepage AND up to 5 of its own menu pages are read (Clean Site Text keeps nav_pages -> Nav Pages Plan -> Read Nav Pages (Jina, one request each, no retry) -> Site Pages; a page that fails or is blocked is skipped), the describer must name every service it finds, and the services, the pages read, the menu links and the site\'s headings travel with the description into the 30-day cache (`pages_read` also makes a homepage-only row written before this change stale), so the Keyword Check\'s topic fit (Assess Result) and the content pipeline see the full service list; the critic is given the site facts and may no longer call a claim found on the website invented (critic.txt + Parse Critique: such claims are dropped, the rest renamed "unverified")')

# 34. A PAGE SOMEONE CAN PUBLISH (2026-10-11 system review, FIX_PLAN D10): the live ladder page of execution 365 held 30 x [Price] and
#     20 x [Timeline], "[Your Business Name]", [Office address] and [Phone number] in its schema - although techand.ai's homepage states
#     Tech&, the DAFZA address and the phone number - and ran 3,952 words against the 2,100 the verdict asked for. Content QA scored it 91
#     and passed it. Five changes, one per cause:
#       1. Content QA takes the business name, logo and NAP from the site model (G19: profile -> homepage Organization / LocalBusiness
#          schema -> Google Business Profile) and passes the merged profile on, so the package's NAP block and author box use it too.
#       2. Brief Context says whether price or timeline facts exist at all (SM.facts), and the brief may only build the page on cost or
#          timeline when they do (angle_rules in the prompt; *Parse Brief* drops such an angle, information gain and table column when
#          they do not).
#       3. *Parse Brief* clamps target_word_count to the verdict's own target when it named one ("a service page of about 2,100 words"),
#          else to the competitor analysis' recommended count, +/- 10%, and scales the outline's section targets with it.
#       4. Content QA fails a draft with more than 5 placeholders (review notes with a colon - [Confirm: ...], [Owner: ...],
#          [Author insight: ...] - do not count) or more than 25% over target, and the editor is told how to fix both.
#       5. The page type becomes one of the form's fixed options (v5/code/_page_type.js, marker /*__PAGE_TYPE__*/) in *Parse Verdict*,
#          *Parse Analysis* and the ladder plan; the free text the verdict wrote ("Service Page (ERP implementation UAE) with built-in
#          vendor-neutral comparison, cost and compliance sections") travels on as page_notes and reaches the brief.
# =============================================================================
# 5: the verdict's free-text page type -> one fixed option + page_notes
patch('Parse Verdict', "const allowed = ['GO', 'GO_WITH_CHANGES', 'AVOID'];",
      PAGE_TYPE_SRC + "\n// 2026-10-12 (FIX_PLAN D10): the verdict answers in free text; the fixed option decides the length band, the schema and\n// meta.json, and the sentence itself travels on as page_notes so the brief still hears what the verdict asked for.\nconst allowed = ['GO', 'GO_WITH_CHANGES', 'AVOID'];")
patch('Parse Verdict', "    recommended_page: verdict.recommended_page || prev.page_type,",
      "    recommended_page: PT.of(verdict.recommended_page || prev.page_type, prev.page_type),\n    page_notes: PT.notes(verdict.recommended_page, PT.of(verdict.recommended_page || prev.page_type, prev.page_type)),")
assert 'const PT = (() =>' in code('Parse Verdict') and 'PT.notes(' in code('Parse Verdict')
# 3 + 2: the brief's length and angle are held to what the data supports
patch('Parse Brief', "// Word count check\nconst totalWords = (brief.outline || []).reduce((s, sec) => s + (Number(sec.target_words) || 0), 0);",
      rd('code/_brief_guard.js').rstrip('\n') + "\n\n// Word count check\nconst totalWords = (brief.outline || []).reduce((s, sec) => s + (Number(sec.target_words) || 0), 0);")
patch('Parse Brief', "    content_brief: brief,\n    brief_outline_words: totalWords",
      "    content_brief: brief,\n    brief_outline_words: totalWords,\n    brief_adjustments: adjustments")
assert 'brief_adjustments' in code('Parse Brief') and 'verdictWords' in code('Parse Brief')
# 5 (b): the length band is read from the fixed option, not from free text
assert 'PT.of(' in code('Parse Analysis') and 'const PT = (() =>' in code('Parse Analysis'), 'Parse Analysis: page type kit not inlined'
assert 'PT.of(' in code('Ladder Plan') and 'page_notes' in code('Ladder Plan'), 'Ladder Plan: page type not normalised'
# 1 + 4: Content QA reads the site model and refuses a page nobody can publish
for _n35 in ('Content QA', 'Brief Context'):
    assert 'const SM = (() => {' in code(_n35), _n35 + ': site model kit not inlined (D10)'
assert "$('Site Model').first().json.site_model" in code('Content QA') and 'placeholder_count > PH_MAX' in code('Content QA'), 'Content QA: D10 gate missing'
assert 'angle_rules' in code('Brief Context') and 'pricing_facts' in code('Brief Context'), 'Brief Context: angle facts missing'
assert "{{ $json.angle_rules || '' }}" in nodes['Strategy Brief']['parameters']['text'], 'the brief prompt does not carry the angle rules'
assert 'at most 5 bracketed placeholders' in nodes['Strategy Brief']['parameters']['text']
assert 'At most 5 placeholders in the whole page' in nodes['Copywriter']['parameters']['text']
assert 'Too many placeholders to publish' in nodes['Editor']['parameters']['text']
# harness shim (S41): the page-type kit as a runnable script, one item in -> one answer out
os.makedirs(OUT_CODE, exist_ok=True)
open(os.path.join(OUT_CODE, '_page_type.js'), 'w').write("// harness shim (written by build_v4.py section 35): the page type kit - { page_type?, default? } -> the fixed option and the free text kept as notes\n" + PAGE_TYPE_SRC +
    "\nreturn $input.all().map(i => { const j = i.json || {}; const type = PT.of(j.page_type, j.default); return { json: { page_type: type, page_notes: PT.notes(j.page_type, type), types: PT.TYPES } }; });\n")
_cq35 = pos('Content QA')
sticky("""### A page someone can publish (FIX_PLAN D10)
The business **name / logo / NAP** come from the **site model** (profile -> homepage `Organization` / `LocalBusiness` schema -> Google Business Profile), not from the business profile alone, and the merged profile travels on to the package's NAP block and author box. A **cost or timeline angle** needs price or timeline facts (`SM.facts`): without them *Parse Brief* drops that angle, its information gain and the table column. *Parse Brief* **clamps the length** to the verdict's own target ("about 2,100 words"), else to the competitor analysis' recommendation, +/-10%, and scales the outline with it. **Content QA fails** a draft with more than **5 placeholders** (notes with a colon do not count) or more than **25% over target**. The **page type** is one of the form's fixed options (`v5/code/_page_type.js`); the verdict's sentence travels as `page_notes`.""",
    _cq35[0] - 60, _cq35[1] + 320, 1100, 220, 3)
log('A page someone can publish (2026-10-11 system review, FIX_PLAN D10): Content QA takes the business name, logo and NAP from the site model (profile -> homepage Organization / LocalBusiness schema -> Google Business Profile), passes the merged profile to the package and fails a draft with more than 5 placeholders (review notes with a colon do not count) or more than 25% over target; Brief Context says whether price or timeline facts exist and Parse Brief drops a cost / timeline angle, its information gain and its table column when they do not; Parse Brief clamps target_word_count to the verdict\'s own target, else to the competitor analysis\' recommendation, +/- 10%, and scales the outline with it; the page type is normalised to the form\'s fixed options everywhere (v5/code/_page_type.js) with the verdict\'s free text kept as page_notes')

# 35. ONE CANONICAL HOST FOR EVERY URL WE EMIT (2026-10-11, system review FIX_PLAN.md D15; SITE_MODEL_SPEC.md §6): ladder target URLs,
#     internal links, schema and canonical URLs, the pages we fetch for the client, the sitemap we look for in Search Console, the IndexNow
#     key file, Bing submissions, Link Builder targets, audit candidates and the profile e-mail all used to be glued together as
#     'https://' + domain. On techand.ai that bare host 308-redirects to www, so the agent handed out redirecting URLs and its own audit
#     flagged "links pointing to redirects". Every one of them now goes through SM.siteUrl(model, path) of the one site model, which knows
#     the canonical host; API payloads (DataForSEO targets, Bing site names, Search Console properties) keep the bare domain through
#     SM.apiTarget or their own property form. The v5 Code nodes carry the marker themselves; the nodes inherited from v3 get the kit and
#     the helper here. Build-time lint: url_lint.py fails the build when a node still builds a host by hand (allow-list: only the three
#     probe nodes that *resolve* the host; Blog Package was taken off it by P2-3, 2026-10-12).
# =============================================================================
import url_lint
PRELUDE33 = ("// D15 (system review 2026-10-11): every URL we emit uses the site model's canonical host (SITE_MODEL_SPEC.md §6) -- the bare domain\n"
             "// 308-redirects on a www site. With no model (an older run) or another site's domain, the bare domain keeps today's behaviour.\n"
             "let SITE_MODEL = null; try { SITE_MODEL = $('Site Model').first().json.site_model || null; } catch (e) {}\n"
             "const siteUrlOf = (dom, path) => SM.siteUrl(SITE_MODEL && SITE_MODEL.domain && SITE_MODEL.domain === SM.helpers.bare(dom) ? SITE_MODEL : { domain: dom }, path);\n")
def with_site_model(name):   # the kit + the helper in front of a node inherited from v3
    assert 'const SM = (() => {' not in code(name), name + ': site model kit already inlined'
    setcode(name, SITE_MODEL_SRC + '\n' + PRELUDE33 + code(name))
for _n33 in ('Collect Site URLs', 'Pick Key Pages', 'URLs To Check', 'PS Targets', 'Analyze PageSpeed', 'Analyze HTML', 'Parse Sitemap Index', 'Competitor Homes'):
    with_site_model(_n33)
# the internal links the copywriter may use, and the home page the brief quotes
patch('Collect Site URLs', "const home = ctx.domain ? 'https://' + ctx.domain + '/' : '';", "const home = ctx.domain ? siteUrlOf(ctx.domain, '/') : '';")
# the audit: the pages we measure and the URLs the findings name
patch('Pick Key Pages', "pick.unshift({ url: 'https://' + domain + '/', kind: 'home' });", "pick.unshift({ url: siteUrlOf(domain, '/'), kind: 'home' });")
patch('URLs To Check', "if (url && url.startsWith('/')) url = 'https://' + d.domain + url;", "if (url && url.startsWith('/')) url = siteUrlOf(d.domain, url);")
patch('URLs To Check', "out.push({ json: { url: 'https://' + d.domain + '/', purpose: 'none' } });", "out.push({ json: { url: siteUrlOf(d.domain, '/'), purpose: 'none' } });")
patch('PS Targets', "url: 'https://' + i.json.domain + '/'", "url: siteUrlOf(i.json.domain, '/')")   # your site: the model; a competitor: its own bare domain, as before
patch('Analyze PageSpeed', "sample_urls: ['https://' + base.domain + '/']", "sample_urls: [siteUrlOf(base.domain, '/')]")
patch('Analyze HTML', "if (c.startsWith('/')) c = 'https://' + domain + c;", "if (c.startsWith('/')) c = siteUrlOf(domain, c);")
patch('Parse Sitemap Index', "const base = 'https://' + ctx.domain;", "const base = siteUrlOf(ctx.domain, '/').replace(/[/]$/, '');")
patch('Competitor Homes', "url: 'https://' + c.domain + '/'", "url: siteUrlOf(c.domain, '/')")   # a competitor's own home page: no model, same URL as before
url_lint.check({'nodes': list(nodes.values()), 'name': 'SEO Agent v4'})
log("One canonical host for every URL we emit (2026-10-11, FIX_PLAN D15): the ladder's target_url, internal links, the page and home URLs in the schema, the client pages we read, the Search Console sitemap, audit candidates, the IndexNow key file, Bing submissions, Link Builder targets and the profile e-mail are built with SM.siteUrl(model, path) of the one site model (canonical host), while API payloads keep the bare domain; AI Growth no longer votes on site_host; build-time lint url_lint.py (allow-list: Build Probes / Content Probes / Analyze Probes)")

# =============================================================================
# 34. BLIND TO EXISTING PAGES (2026-10-12, system review FIX_PLAN D11; SITE_MODEL_SPEC.md section 6): the agent recommended writing a page the
#     website already had. The 2026-10-01 ladder planned "uae e invoicing penalties" as a NEW page although
#     /insights/the-cost-of-non-compliance-uae-e-invoicing-penalties-mitigation-costs had been live since 2026-08-21 (AI readiness 90, known to
#     AI Growth) - Ladder Plan matched slug tokens with Jaccard >= 0.5, so 3 keyword words in a 9-word slug scored 0.33 and missed it, and the
#     Rank Tracker and the Site Tracker then said "publish it", which would cannibalise the live page.
#     The Site Tracker now keeps a weekly page inventory in seo_pages (the sitemap it already reads for every site, the Search Console pages
#     with the queries they get impressions for, AI Growth's key pages, the pages found live) and the model carries it (SM.withPages).
#     Every consumer asks SM.matchPage(model, keyword) - a hit means "improve / refresh THAT page", never a second page:
#       * Ladder Plan: status 'improve' with the real URL (findExisting),
#       * discovery (Rank Keywords / Keyword Strategy): the keyword is labelled `covered_by` and named in the report,
#       * Rank Tracker (Tracker Report): the next step names the live page instead of "publish it",
#       * Site Tracker (Site Metrics + site_brief.txt): "refresh the existing page",
#       * Content Cadence (Cadence Plan): a ladder page becomes a refresh, an opportunity post is left out.
#     Here: the inventory is loaded with the on-demand model, so a run on a tracked site sees it before Route Mode.
# =============================================================================
_lpm = pos('Load Profile (Model)')
add_node('Load Pages (Model)', DT_TYPE, DT_VERSION, dt_get_where_params(PAGES_TABLE, 'site_id', 'eq', SITE_KEY30), [_lpm[0] + 110, _lpm[1] + 160], LOAD18)
disconnect('Load Profile (Model)', 'Site Model Plan')
connect('Load Profile (Model)', 'Load Pages (Model)'); connect('Load Pages (Model)', 'Site Model Plan')
assert "'Load Pages (Model)'" in code('Site Model'), 'Site Model does not read the page inventory'
for _n in ('Ladder Plan', 'Rank Keywords', 'Build Keyword Strategy'):
    assert 'SM.matchPage' in code(_n) or 'ks.covered' in code(_n), _n + ': the page inventory is not used'
for _n in ('Ladder Plan', 'Rank Keywords'): assert 'const SM = (() => {' in code(_n), _n + ': site model kit not inlined'
assert 'j >= 0.5' not in code('Ladder Plan'), 'Ladder Plan still matches existing pages by Jaccard'
assert not any('/*__SITE_MODEL__*/' in n['parameters'].get('jsCode', '') for n in nodes.values()), 'site model placeholder left'
sticky("""### The pages the site already has (D11, v4.15)
The Site Tracker writes a **page inventory** per website into `seo_pages` every Monday (the sitemap, the Search Console pages with the queries they get impressions for, AI Growth's key pages, the pages found live) and *Load Pages (Model)* brings it into this run's site model. **Ladder Plan**, **discovery**, the **Rank Tracker**, the **Site Tracker** and the **Content Cadence** all ask `SM.matchPage(model, keyword)` first: a page answers a search when 75% of the keyword's meaningful words are in its slug or title, or when it already gets impressions for that exact query. A hit means *refresh that page* \u2014 never a second page for the same search.""", _lpm[0] - 220, _lpm[1] + 320, 1100, 180, 4)
log('Blind to existing pages fixed (2026-10-12, FIX_PLAN D11): the Site Tracker keeps the website\'s page inventory in seo_pages (sitemap read for every site + Search Console pages and their queries + AI Growth key pages + pages found live, only changed rows written), the site model carries it on demand (Load Pages (Model) -> SM.withPages) and Ladder Plan, discovery, the Rank Tracker, the Site Tracker brief and the Content Cadence ask SM.matchPage before recommending a page: a live page that already answers the search means improve / refresh that URL, never "publish it"')

# =============================================================================
# 36. WHAT THE NUMBERS ARE ALLOWED TO SAY (2026-10-12, system review FIX_PLAN.md D20 / D21 / G9 / G24 / G28). Five places where the agent said
#     more than its data supported:
#       * D20 discovery: the top pick "e invoicing" overlapped the running ladder head "e invoicing in uae" with no warning, a card claimed an
#         "AI Overview present" that its own live check had not found, "who ranks now" repeated domains and the callback carried float32 CPCs.
#         Discovery now loads the site's own ladders (Load Domain Ladders (Discovery), archived ones skipped) and marks every keyword a ladder
#         head or rung covers; the AI Overview line comes from the LIVE check ("seen on <date>") while the undated Labs value is labelled
#         historical; the top domains are deduplicated before the first five are taken; the callback rounds CPCs to 2 decimals.
#       * D21: a sparse Google Trends series (zero most weeks) produced "+1,200%" in the weekly brief. Parse Trends now returns change_pct null
#         for a sparse series (stored rows included), Brief Input leaves the percentage out and the prompt says "too little search data".
#       * G9 Search Console depth: 500 query rows and 100 page rows were a sample. Every row is read now (25,000 per request, further pages
#         through GSC More Requests / GSC Query (More), max_gsc_pages per kind), the queries Google withholds are reported as the anonymised
#         share (period totals minus the sum of the rows), brand and non-brand are split with seo_monitors / the site model's brand names, and
#         the operator-query rule the audit uses is now the shared kit v5/code/_gsc_queries.js (GQ) in both places.
#       * G24: the audit reports crawl coverage — "crawled X of Y known URLs (sitemap union the Search Console pages)" — and flags under 90%,
#         because every finding's share is otherwise a share of an unknown sample.
#       * G28: a traffic alert fired on a fixed 30%. It now needs a statistically real change (two-sample Poisson z, 95%, v5/code/_site_stats.js
#         ST.change, the same idea as the AI Pulse's _ai_stats.js), enough events in both periods together and a size worth reporting; a large
#         move inside sampling noise becomes an "info" alert worded "Watch:" and Google's update dates are named as context.
#     The Site Tracker nodes are wired in build_site_tracker.py; here: the discovery ladder load, the audit's coverage line in both reports.
# =============================================================================
# ---------- A. D20: the site's own keyword ladders, loaded in discovery as well (the ladder path has them since v4.8) ----------
_sdd = pos('Seed List'); DX36, DY36 = _sdd[0], _sdd[1] + 560
DOMAIN_SEED = "={{ String($('Seed List').first().json.domain || '').toLowerCase() }}"
add_node('Ensure Ladder Table (Discovery)', DT_TYPE, DT_VERSION, dt_create_params(LADDER_TABLE, LADDER_COLS), [DX36, DY36], {'onError': 'continueRegularOutput', 'executeOnce': True})
add_node('Load Domain Ladders (Discovery)', DT_TYPE, DT_VERSION, dt_get_any_params(LADDER_TABLE, [('domain', DOMAIN_SEED), ('domain', "={{ 'www.' + String($('Seed List').first().json.domain || '').toLowerCase() }}")]), [DX36 + 220, DY36], LOAD18)
add_node('Ensure Ladder Settings Table (Discovery)', DT_TYPE, DT_VERSION, dt_create_params(LADDER_SETTINGS_TABLE, LADDER_SETTINGS_COLS), [DX36 + 440, DY36], {'onError': 'continueRegularOutput', 'executeOnce': True})
add_node('Load Ladder Settings (Discovery)', DT_TYPE, DT_VERSION, dt_get_any_params(LADDER_SETTINGS_TABLE, [('domain', DOMAIN_SEED), ('site_id', "={{ 'site_' + String($('Seed List').first().json.domain || '').toLowerCase().replace(/^www\\./, '').replace(/[^a-z0-9]+/g, '-') }}")]), [DX36 + 660, DY36], LOAD18)
disconnect('Seed List', 'Reach Requests (Discovery)')
for a, b in [('Seed List', 'Ensure Ladder Table (Discovery)'), ('Ensure Ladder Table (Discovery)', 'Load Domain Ladders (Discovery)'), ('Load Domain Ladders (Discovery)', 'Ensure Ladder Settings Table (Discovery)'),
             ('Ensure Ladder Settings Table (Discovery)', 'Load Ladder Settings (Discovery)'), ('Load Ladder Settings (Discovery)', 'Reach Requests (Discovery)')]:
    connect(a, b)
assert "'Load Domain Ladders (Discovery)'" in code('Rank Keywords') and "'Load Ladder Settings (Discovery)'" in code('Rank Keywords'), 'Rank Keywords does not read the discovery ladder load'
assert 'ladder_covered' in code('Build Keyword Strategy') and 'ladder_covered' in code('Build Ideas Response'), 'the ladder overlap is not reported'
assert "new Set(organic.map(o => normD(o.domain))" in code('Build Keyword Strategy'), 'the live top domains are not deduplicated before the first five'
# ---------- B. G24: the crawl-coverage line in the technical audit and in the full report ----------
_cov_old = ("`<h3>Site structure (from the crawl)</h3><p>${n2(st.crawled_pages)} pages crawled, ${n2(st.indexable_pages)} indexable"
            "${st.within_3_clicks_pct != null ? '; ' + st.within_3_clicks_pct + '% of pages are within 3 clicks of the homepage' : ''}.</p>`")
_cov_new = _cov_old + " + (st.crawl_coverage && st.crawl_coverage.text ? `<p>${e2(st.crawl_coverage.text)}.${st.crawl_coverage.coverage_pct != null && st.crawl_coverage.coverage_pct < 90 ? ' Every share below is a share of the pages that were crawled, not of the whole site.' : ''}</p>` : '')"
for _n36 in ('Build Audit Report', 'Build Full Report'):
    patch(_n36, _cov_old, _cov_new)
assert 'crawl_coverage' in code('GSC Audit Findings'), 'G24: the audit does not compute crawl coverage'
assert 'const GQ = (() => {' in code('GSC Audit Findings'), 'G9: the shared Search Console query rules are not inlined into the audit'
assert not any('/*__GSC_QUERIES__*/' in n['parameters'].get('jsCode', '') for n in nodes.values()), 'Search Console query kit placeholder left'
sticky("""### What the numbers are allowed to say (D20 / D21 / G9 / G24 / G28, v4.15)
**Discovery** loads the site's own **keyword ladders** (*Load Domain Ladders (Discovery)*): a keyword a ladder head or rung already covers is marked `ladder_covered` and is never the next thing to write — one search, one page. An **AI Overview** is claimed only from the *live* check, with the date it was seen; the undated stored value is labelled *historical*. Top domains are deduplicated before the first five, and callback CPCs are rounded to 2 decimals.
**Audit:** *GSC Audit Findings* reports **crawl coverage** — crawled X of Y known URLs (sitemap ∪ the Search Console pages) — and flags under 90%, so nobody reads a finding's share as a share of the whole site.
**Site Tracker** (built in `build_site_tracker.py`): every Search Console row is read (25,000 per request + further pages), the withheld queries are reported as the **anonymised share**, **brand / non-brand** is split with the known brand names, scraper queries are counted apart with the audit's own rule (`_gsc_queries.js`), a **sparse** Trends series carries no percentage, and a traffic alert needs a **statistically real** change (`_site_stats.js`, two-sample Poisson z, 95%) — a big move at low volume is a "Watch", not a fall.""", DX36 - 40, DY36 + 160, 1180, 260, 3)
log('What the numbers are allowed to say (2026-10-12, FIX_PLAN D20 / D21 / G9 / G24 / G28): discovery loads the site\'s own ladders and marks every keyword a ladder head or rung covers (one search, one page), the AI Overview line comes from the live check with its date while the undated Labs value is labelled historical, the live top domains are deduplicated before the first five and callback CPCs are rounded to 2 decimals; a sparse Google Trends series carries no percentage anywhere (Parse Trends -> Brief Input -> prompt); Search Console is read in full (25,000 rows per request plus further pages) with the anonymised share, a brand / non-brand split and the audit\'s own scraper-query rule as the shared kit v5/code/_gsc_queries.js; the audit reports crawl coverage (sitemap union Search Console pages) and flags under 90%; site-tracking alerts fire on a two-sample Poisson z-test with minimum volumes and Google update dates as context (v5/code/_site_stats.js), a large move inside sampling noise is reported as "Watch"')
# =============================================================================
# 41. WHAT SPEED THE VISITORS FEEL, WHAT TO FIX FIRST, AND AN ALERT THAT ARRIVES (2026-10-12, system review FIX_PLAN.md G7 / G26 / D25b / D25c)
#     G7  Core Web Vitals came from one Lighthouse lab run of the homepage, in full reports only, while Google's page-experience signal uses
#         the p75 of 28 days of real-user field data. The audit now reads the **Chrome UX Report** per template (homepage, a service page, a
#         blog post) on phone and desktop, falls back to the whole-site (origin) figures for a page with too little traffic, carries a low
#         weight in the score (unscored where the lab run already scores the same thing) and names its source and collection period in both
#         audit reports. The CrUX API is free and uses the PageSpeed key, but it has to be *enabled* in that Google project: when it is not,
#         the audit says "not available" with the one step that fixes it and never fails.
#     G26 The fix list was ordered by severity label alone, so a Critical on one unvisited page outranked a High on every page that earns the
#         traffic, and cosmetic items could sit at the top. Priority is now severity x the share of pages affected x the clicks and
#         impressions those pages get in Search Console x their place in the site (v5/code/_impact.js), in bands: pages Google cannot index
#         first, cosmetic items never first, notes about missing data last. Severities are unchanged and still shown; both reports say in one
#         sentence why the first item is first, and the weight is stored on every finding row so the app orders the same way.
#     D25b The Error Handler had one channel, *Email Ops*, and it failed with a connection error on 2026-10-10 and again on 2026-10-12. Every
#         alert is now recorded in the new Data Table seo_ops_alerts *before* anything is sent (the record of last resort) and then goes to a
#         webhook that needs no SMTP (SEO_ALERT_WEBHOOK_URL in n8n/.env: Slack / Teams / anything that takes a POST) as well as the e-mail.
#         Repeats of the same failure within 30 minutes are counted on the row but not re-sent; an unset channel is skipped; no channel can
#         fail the run.
#     D25c October's check-in was still the 2026-10-02 test row, so the reminder stopped asking. A check-in can now be marked as a test (the
#         form's last question, the API's is_test, a test caller, or a note that marks it: v5/code/_checkin_test.js) and a test never counts
#         as the month's answer - the Site Tracker leaves it out of the monthly check, so the reminder keeps asking, and a test answer of
#         "yes" to a manual action no longer raises a critical alert.
# =============================================================================
import url_lint as _ul41, retry_lint as _rl41
from ladder_common import OPS_ALERTS_TABLE, OPS_ALERTS_COLS
from env_settings import ENV as _ENV41
ALERT_WEBHOOK_URL = _ENV41.get('SEO_ALERT_WEBHOOK_URL') or ''
IMPACT_SRC = rd('code/_impact.js').rstrip('\n')
CHECKIN_TEST_SRC = rd('code/_checkin_test.js').rstrip('\n')
OPS_ALERT_SRC = rd('code/_ops_alert.js').rstrip('\n')

# ---------- A. G7: the Chrome UX Report per template, between the entity check and the scoring ----------
_ec41 = pos('Entity Check'); CX, CY = _ec41[0] + 220, _ec41[1]
disconnect('Entity Check', 'Build Site Issues')
add_node('CrUX Targets', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/CrUX_Requests.js')}, [CX, CY])
if_node('Any CrUX?', '{{ !$json.skip }}', [CX + 220, CY])
add_node('Fetch CrUX', 'n8n-nodes-base.httpRequest', 4.5, {
    'method': 'POST', 'url': '={{ $json.endpoint }}', 'authentication': 'genericCredentialType', 'genericAuthType': 'httpHeaderAuth',
    'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify($json.body) }}',
    'options': {'batching': {'batch': {'batchSize': 1, 'batchInterval': 400}}, 'timeout': 30000, 'response': {'response': {'neverError': True, 'fullResponse': True}}}},
    [CX + 440, CY - 120], dict(onError='continueRegularOutput', **_rl41.RETRY))
nodes['Fetch CrUX']['credentials'] = {'httpHeaderAuth': {'id': 'SEOcredPageSpeed', 'name': 'Google PageSpeed'}}
add_node('Analyze CrUX', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Analyze_CrUX.js')}, [CX + 660, CY])
for _a, _b in [('Entity Check', 'CrUX Targets'), ('CrUX Targets', 'Any CrUX?'), ('Fetch CrUX', 'Analyze CrUX'), ('Analyze CrUX', 'Build Site Issues')]:
    connect(_a, _b)
connect('Any CrUX?', 'Fetch CrUX', 0); connect('Any CrUX?', 'Analyze CrUX', 1)
assert 'const SM = (() => {' in code('CrUX Targets'), 'CrUX Targets: site model kit not inlined'

# the scored audit carries the field data, and says what it could not measure
patch('Build Site Issues', "      entity: input.entity || null,\n", "      entity: input.entity || null,\n      crux: input.crux || null,\n")
patch('Build Site Issues', "if (!input.pagespeed) not_assessed.push('Core Web Vitals (LCP, CLS, INP) from Google PageSpeed and real users');",
      "if (!input.pagespeed) not_assessed.push('Core Web Vitals in a lab test (Google PageSpeed / Lighthouse) and the speed comparison with competitors');\n"
      "if (!(input.crux && input.crux.available)) not_assessed.push('Core Web Vitals from real Chrome users per template (Chrome UX Report, 75th percentile): ' + ((input.crux && input.crux.not_available) || 'not collected in this run'));")

# ---------- B. G26: order every finding by likely impact ----------
setcode('Build Site Issues', IMPACT_SRC + '\n' + code('Build Site Issues'))
patch('Build Site Issues', """// ===== 6. Sort =====
findings.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || ((b.affected_pct || 0) - (a.affected_pct || 0)));""",
      """// ===== 6. Order by likely impact (G26, 2026-10-12): severity x the share of pages affected x the clicks and impressions those pages
// get in Search Console x their place in the site. Index blockers first, cosmetic items never first, notes about missing data last.
// The severity label is unchanged and stays visible; the scoring below still groups by severity, so no score changes because of the order.
IMP.rank(findings, { total_pages: total, search_console: input.search_console || null,
  key_pages: [...(((input.html_analysis || {}).sampled_pages) || []).map(p => (p && p.url) || p), ...(((input.search_console || {}).top_pages) || []).slice(0, 5).map(p => p.page || p.url)].filter(Boolean) });""")
patch('Build Site Issues', "      weights: WEIGHTS,\n", "      weights: WEIGHTS,\n      priority_method: IMP.method,\n      priority_first: IMP.firstReason(findings),\n")
# the stored finding rows keep the weight, so the app's lists and recommendations order the same way
_fr41 = code('Finding Rows')
assert _fr41.count("affected_count: Number(f.affected_count) || 0 }));") == 1, 'Finding Rows: row shape moved'
setcode('Finding Rows', _fr41.replace("affected_count: Number(f.affected_count) || 0 }));",
        "affected_count: Number(f.affected_count) || 0, impact: Number(f.impact) || 0, impact_basis: String(f.impact_basis || '').slice(0, 400) }));"))

# ---------- C. both audit reports: the field data per template, and why the first fix is first ----------
CWV_SECTION_JS = r"""// ---- Core Web Vitals per template, from real Chrome users (G7, 2026-10-12) ----
const cwvSection = (a) => {
  const c = a.crux || null;
  const e2 = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const p2 = (u) => String(u || '').replace(/^https?:\/\/[^\/]+/, '') || '/';
  let h = `<h3>Core Web Vitals per template (real Chrome users)</h3>`;
  if (!c) return h + `<p>Not measured per template in this run.</p>`;
  const TH = c.thresholds || { lcp: 2500, inp: 200, cls: 0.1 };
  if (!c.available) return h + `<p><b>Not available:</b> ${e2(c.not_available)}.${c.not_available_fix ? ' ' + e2(c.not_available_fix) : ''}</p>`
    + `<p class="small">Source: Chrome UX Report (field data). Limits: LCP ${(TH.lcp / 1000).toFixed(1)} s, INP ${TH.inp} ms, CLS ${TH.cls.toFixed(2)} at the 75th percentile.</p>`;
  const cell = (v, limit, fmt) => v == null ? '<td>—</td>' : `<td${v > limit ? ' style="color:#b91c1c;font-weight:bold"' : ''}>${fmt(v)}</td>`;
  const secs = (ms) => (Math.round(ms / 100) / 10).toFixed(1) + ' s';
  const rows = [];
  for (const t of (c.templates || [])) for (const ff of ['phone', 'desktop']) {
    const d = t.devices ? t.devices[ff] : null;
    if (!d) continue;
    rows.push(d.available
      ? `<tr><td>${e2(t.label)}</td><td>${e2(p2(t.url))}</td><td>${ff}</td>` + cell(d.lcp_ms, TH.lcp, secs) + cell(d.inp_ms, TH.inp, (v) => Math.round(v) + ' ms') + cell(d.cls, TH.cls, (v) => Number(v).toFixed(2))
        + `<td>${d.verdict ? (d.verdict.pass ? '<span class="ok">passes</span>' : '<span class="bad">fails ' + d.verdict.failed.join(', ').toUpperCase() + '</span>') : '—'}</td>`
        + `<td class="small">${d.level === 'origin' ? 'whole site (this page has too little traffic)' : 'this page'}${d.period && d.period.last ? ', ' + e2(d.period.first) + ' to ' + e2(d.period.last) : ''}</td></tr>`
      : `<tr><td>${e2(t.label)}</td><td>${e2(p2(t.url))}</td><td>${ff}</td><td colspan="5" class="small">${e2(d.not_available || 'no field data')}</td></tr>`);
  }
  h += rows.length ? `<table class="ct"><tr><th>Template</th><th>Page</th><th>Device</th><th>LCP</th><th>INP</th><th>CLS</th><th>Verdict</th><th>Source</th></tr>` + rows.join('') + `</table>` : `<p>No template could be measured.</p>`;
  h += `<p class="small">Source: <b>Chrome UX Report field data</b> — what real Chrome users measured, at the 75th percentile of the 28 days`
    + `${c.collection_period && c.collection_period.last ? ' ending ' + e2(c.collection_period.last) : ''}. Google's limits: LCP ${(TH.lcp / 1000).toFixed(1)} s, INP ${TH.inp} ms, CLS ${TH.cls.toFixed(2)}.`
    + `${(c.templates_missing || []).length ? ' No page of these templates was found in the crawl: ' + e2(c.templates_missing.join(', ')) + '.' : ''}`
    + ` These figures carry a low weight in the health score; lab measurements (Lighthouse / PageSpeed) are shown separately where this report has them.</p>`;
  return h;
};
// ---- why the first fix is first (G26, 2026-10-12) ----
const prioNote = (a) => {
  const e2 = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return a.priority_first ? `<p class="small"><b>Ordered by likely impact.</b> ${e2(a.priority_first)}</p>` : '';
};
"""
_FIX_LI = "top.map(f => `<li><b>${esc(f.title)}</b>${f.evidence ? ' <span class=\"small\">(' + esc(f.evidence) + ')</span>' : ''}<br>${esc(f.fix)}</li>`)"
_FIX_LI_NEW = "top.map(f => `<li><b>${esc(f.title)}</b> <span class=\"badge\" style=\"background:${SEV_COLOR[f.severity]}\">${esc(f.severity)}</span>${f.evidence ? ' <span class=\"small\">(' + esc(f.evidence) + ')</span>' : ''}<br>${esc(f.fix)}${f.impact_basis ? '<br><span class=\"small\">Why here: ' + esc(f.impact_basis) + ' · impact score ' + esc(f.impact) + '</span>' : ''}</li>`)"
for _rn41 in ('Build Audit Report', 'Build Full Report'):
    patch(_rn41, "const findings = a.findings || [];", CWV_SECTION_JS + "const findings = a.findings || [];")
    patch(_rn41, "'<h3>Fix These First</h3><ol>'", "'<h3>Fix These First</h3>' + prioNote(a) + '<ol>'")
    patch(_rn41, _FIX_LI, _FIX_LI_NEW)
    patch(_rn41, "    search_console: a.search_console || null,", "    search_console: a.search_console || null,\n    crux: a.crux || null,\n    priority_method: a.priority_method || '',\n    priority_first: a.priority_first || '',")
# where each report shows the table and the methodology line
patch('Build Audit Report', "html += `<h3>Key Measurements</h3><table class=\"kv\">` + msRows.map(r => `<tr><td class=\"k\">${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('') + `</table>`;",
      "html += `<h3>Key Measurements</h3><table class=\"kv\">` + msRows.map(r => `<tr><td class=\"k\">${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('') + `</table>`;\nhtml += cwvSection(a);")
patch('Build Audit Report', "html += `<h2>7. Methodology</h2>\n<p>${esc(a.scoring_method)}</p>", "html += `<h2>7. Methodology</h2>\n<p>${esc(a.scoring_method)}</p>\n${a.priority_method ? '<p><b>How the fix list is ordered:</b> ' + esc(a.priority_method) + '</p>' : ''}")
patch('Build Full Report', "html += '<h3>Findings</h3>' + findingsBlock(byCat('Performance'));", "html += cwvSection(a) + '<h3>Findings</h3>' + findingsBlock(byCat('Performance'));")
patch('Build Full Report', "html += `<h2 class=\"pb\">16. Methodology & Data Sources</h2><p>${esc(a.scoring_method)}</p>", "html += `<h2 class=\"pb\">16. Methodology & Data Sources</h2><p>${esc(a.scoring_method)}</p>\n${a.priority_method ? '<p><b>How the fix list is ordered:</b> ' + esc(a.priority_method) + '</p>' : ''}")
# the API callback carries both (the app shows the speed figures and orders its own lists by the same weight)
patch('Build Audit Response', "top_issues: d.top_issues,", "top_issues: d.top_issues, crux: d.crux || null, priority_method: d.priority_method || '', priority_first: d.priority_first || '',")

# ---------- D. D25b: a second alert channel, and a row so a failure is never lost ----------
_eh41 = os.path.join(HERE0, 'workflows', 'SEO_Agent_Error_Handler.json')
_ehw41 = json.load(open(_eh41, encoding='utf-8')); _ehl41 = _ehw41 if isinstance(_ehw41, list) else [_ehw41]
_ehwf = _ehl41[0]
_ehn = {n['name']: n for n in _ehwf['nodes']}
_ehc = _ehwf.setdefault('connections', {})
_ehnid = lambda nm: str(uuid.uuid5(NS, 'errorhandler:' + nm))
def _eh_add(name, ntype, version, params, position, extra=None):
    n = _ehn.get(name) or {}
    n.update({'parameters': params, 'id': n.get('id') or _ehnid(name), 'name': name, 'type': ntype, 'typeVersion': version, 'position': position})
    for k in ('onError', 'retryOnFail', 'maxTries', 'waitBetweenTries', 'alwaysOutputData', 'executeOnce', 'credentials'):
        n.pop(k, None)
    if extra: n.update(extra)
    _ehn[name] = n; return n
def _eh_link(src, dst, out=0):
    outs = _ehc.setdefault(src, {}).setdefault('main', [])
    while len(outs) <= out: outs.append([])
    if not any(t['node'] == dst for t in outs[out]): outs[out].append({'node': dst, 'type': 'main', 'index': 0})
_eh_src = lambda p: rd(p).replace('/*__OPS_ALERT__*/', OPS_ALERT_SRC).replace('__ALERT_WEBHOOK_URL__', ALERT_WEBHOOK_URL).replace('__OPS_EMAIL__', OPS_EMAIL)
# the alert payload gains the execution mode (the webhook body and the row carry it)
_fa41 = _ehn['Format Alert']['parameters']['jsCode']
if 'mode,' not in _fa41:
    assert _fa41.count("execution_url: url, message: msg } }];") == 1, 'Format Alert: return shape moved'
    _ehn['Format Alert']['parameters']['jsCode'] = _fa41.replace("execution_url: url, message: msg } }];", "execution_url: url, message: msg, mode, when } }];")
_EHY = 0
_eh_add('Ensure Ops Alerts Table', DT_TYPE, DT_VERSION, dt_create_params(OPS_ALERTS_TABLE, OPS_ALERTS_COLS), [480, _EHY], {'onError': 'continueRegularOutput'})
_eh_add('Load Ops Alerts', DT_TYPE, DT_VERSION, dt_get_all_params(OPS_ALERTS_TABLE), [700, _EHY], {'onError': 'continueRegularOutput', 'alwaysOutputData': True})
_eh_add('Alert Record', 'n8n-nodes-base.code', 2, {'jsCode': _eh_src('code/Alert_Record.js')}, [920, _EHY])
_eh_add('Save Ops Alert', DT_TYPE, DT_VERSION, dt_upsert_params(OPS_ALERTS_TABLE, OPS_ALERTS_COLS, 'alert_key'), [1140, _EHY], {'onError': 'continueRegularOutput', 'alwaysOutputData': True})
_eh_add('Alert Channels', 'n8n-nodes-base.code', 2, {'jsCode': _eh_src('code/Alert_Channels.js')}, [1360, _EHY])
_ehif41 = {'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'loose', 'version': 3},
                  'conditions': [{'id': _ehnid('Send Webhook?:cond'), 'leftValue': '={{ $json.send_webhook }}', 'rightValue': '', 'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}], 'combinator': 'and'}, 'looseTypeValidation': True, 'options': {}}
_eh_add('Send Webhook?', 'n8n-nodes-base.if', 2.3, _ehif41, [1580, _EHY - 140])
_eh_add('Post Alert Webhook', 'n8n-nodes-base.httpRequest', 4.5, {
    'method': 'POST', 'url': '={{ $json.webhook_url }}', 'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify($json.webhook_body) }}',
    'options': {'timeout': 15000, 'response': {'response': {'neverError': True}}}}, [1800, _EHY - 140], dict(onError='continueRegularOutput', **_rl41.RETRY))
_eh_add('Send Email?', 'n8n-nodes-base.if', 2.3, {'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'loose', 'version': 3},
        'conditions': [{'id': _ehnid('Send Email?:cond'), 'leftValue': '={{ $json.send_email }}', 'rightValue': '', 'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}], 'combinator': 'and'}, 'looseTypeValidation': True, 'options': {}}, [1580, _EHY + 140])
# the e-mail keeps its own retries, reads the alert from Format Alert (its input is the channel decision now) and can no longer fail the run
_eho = _ehn['Email Ops']
_eho['parameters'].update({'fromEmail': SENDER, 'toEmail': OPS_EMAIL, 'subject': "={{ $('Format Alert').first().json.subject }}", 'html': "={{ $('Format Alert').first().json.html }}"})
_eho.update({'retryOnFail': True, 'maxTries': 3, 'waitBetweenTries': 5000, 'onError': 'continueRegularOutput'})
_eho['position'] = [1800, _EHY + 140]
_ehc.pop('Format Alert', None)
for _a, _b in [('Format Alert', 'Ensure Ops Alerts Table'), ('Ensure Ops Alerts Table', 'Load Ops Alerts'), ('Load Ops Alerts', 'Alert Record'),
               ('Alert Record', 'Save Ops Alert'), ('Save Ops Alert', 'Alert Channels'), ('Alert Channels', 'Send Webhook?'), ('Alert Channels', 'Send Email?'),
               ('Send Webhook?', 'Post Alert Webhook'), ('Send Email?', 'Email Ops')]:
    _eh_link(_a, _b)
_ehn['Note']['parameters']['content'] = """## SEO Agent — Error Handler
Attach this as **Settings → Error workflow** on every SEO Agent workflow (the builders set it).

Three channels, in this order (D25b, 2026-10-12):
1. **seo_ops_alerts** (Data Table) — every alert is recorded *first*, with the repeat count, so a failure is never lost even when both senders are down. This is the record ops reads after an outage.
2. **Post Alert Webhook** — a POST to `SEO_ALERT_WEBHOOK_URL` from `n8n/.env` (Slack / Teams incoming webhook, or any endpoint). No SMTP involved: this is the channel that still works when the mail server refuses the connection, as it did on 2026-10-10 and 2026-10-12. Unset = skipped.
3. **Email Ops** — the ops address (`SEO_OPS_EMAIL`), 3 tries 5 s apart, and it can no longer fail the run.

The same failure within 30 minutes is counted on its row and not re-sent. The web app's failure watcher (`app/server/src/services/engineFailures.ts`) reads failed executions from n8n independently of all three.
The payload has the execution id, a link to open it, the failed node and the error message. It does **not** contain the customer's form data (n8n error triggers only carry execution metadata)."""
_ehwf['nodes'] = list(_ehn.values())
_ehnames41 = set(_ehn)
for _s41, _o41 in _ehc.items():
    assert _s41 in _ehnames41, 'error handler: connection source missing: ' + _s41
    for _lst41 in _o41.get('main', []):
        for _t41 in _lst41: assert _t41['node'] in _ehnames41, 'error handler: connection target missing: ' + _t41['node']
_rl41.check(_ehwf, _ehwf.get('name') or 'SEO Agent — Error Handler')
_ul41.check(_ehwf, _ehwf.get('name') or 'SEO Agent — Error Handler')
json.dump(_ehw41, open(_eh41, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
os.makedirs(OUT_CODE, exist_ok=True)
for _n41 in _ehwf['nodes']:
    if _n41['type'] == 'n8n-nodes-base.code':
        open(os.path.join(OUT_CODE, 'EH__' + re.sub(r'[^A-Za-z0-9_.-]+', '_', _n41['name']) + '.js'), 'w').write(_n41['parameters']['jsCode'])
# the same two nodes with a webhook URL configured: the harness has no n8n/.env, so this copy plays the channel a filled .env gives (S48)
for _nm41, _fp41 in (('Alert Record', 'code/Alert_Record.js'), ('Alert Channels', 'code/Alert_Channels.js')):
    open(os.path.join(OUT_CODE, 'EH__' + _nm41.replace(' ', '_') + '_Webhook.js'), 'w').write(
        rd(_fp41).replace('/*__OPS_ALERT__*/', OPS_ALERT_SRC).replace('__ALERT_WEBHOOK_URL__', 'https://hooks.example.test/seo-agent-alerts').replace('__OPS_EMAIL__', OPS_EMAIL))

# ---------- E. D25c: a test check-in never satisfies the month ----------
setcode('Parse Check-in', code('Parse Check-in').replace('/*__CHECKIN_TEST__*/', CHECKIN_TEST_SRC))
assert 'const CK = (() => {' in code('Parse Check-in'), 'Parse Check-in: the check-in test kit was not inlined'
patch('Normalize Input', "const checkin_notes = String(pick(p2, 'notes') || p2.notes || '').trim().slice(0, 1000);",
      "const checkin_notes = String(pick(p2, 'notes') || p2.notes || '').trim().slice(0, 1000);\nconst checkin_is_test = yes(pick(p2, 'test submission') || p2.checkin_is_test || p2.is_test);   // D25c: a test check-in is recorded but never counts as the month's answer")
patch('Normalize Input', "    checkin_notes,\n", "    checkin_notes,\n    checkin_is_test,\n")
nodes['Page Check-in']['parameters']['formFields']['values'].insert(5, {'fieldLabel': 'Is this a test submission?', 'fieldType': 'dropdown', 'fieldOptions': {'values': [{'option': 'No'}, {'option': 'Yes — do not count it as this month’s check-in'}]}})
_ca41 = nodes['Checkin Alert?']['parameters']['conditions']['conditions'][0]
assert _ca41['leftValue'].count('manual_action') == 1, 'Checkin Alert?: condition moved'
_ca41['leftValue'] = "={{ !$('Parse Check-in').first().json.checkin_is_test && !!(($('Parse Check-in').first().json.checkin_row || {}).manual_action || ($('Parse Check-in').first().json.checkin_row || {}).security_issue) }}"

# what the harness checks (S48): the channels, their order and the fact that the webhook does not hang off the e-mail node
json.dump({'table': OPS_ALERTS_TABLE, 'webhook_setting': 'SEO_ALERT_WEBHOOK_URL', 'webhook_configured': bool(ALERT_WEBHOOK_URL),
           'nodes': [_n41['name'] for _n41 in _ehwf['nodes'] if _n41['type'] != 'n8n-nodes-base.stickyNote'],
           'connections': {_s41: [[_t41['node'] for _t41 in _l41] for _l41 in _o41.get('main', [])] for _s41, _o41 in _ehc.items()},
           'email': {'name': 'Email Ops', 'onError': _eho.get('onError'), 'retryOnFail': bool(_eho.get('retryOnFail')), 'maxTries': _eho.get('maxTries'),
                     'reads_alert_from': "$('Format Alert')" in json.dumps(_eho['parameters'])},
           'webhook': {'name': 'Post Alert Webhook', 'onError': _ehn['Post Alert Webhook'].get('onError'), 'retryOnFail': bool(_ehn['Post Alert Webhook'].get('retryOnFail')),
                       'maxTries': _ehn['Post Alert Webhook'].get('maxTries'), 'uses_smtp': False},
           'checkin_alert_gate': nodes['Checkin Alert?']['parameters']['conditions']['conditions'][0]['leftValue']},
          open(os.path.join(HERE0, 'harness', 'ops_alert_wiring.json'), 'w'), indent=1, sort_keys=True)
_ul41.check({'nodes': list(nodes.values()), 'name': 'SEO Agent v4'})
sticky("""### Core Web Vitals per template, and the order of the fix list (G7 / G26, 2026-10-12)
**CrUX Targets → Fetch CrUX → Analyze CrUX** (between the entity check and the scoring, both audit types): the Chrome UX Report's p75 for the homepage, a service page and a blog post, on phone and desktop, with the whole-site (origin) figures as the fallback for a page with too little traffic. Free, on the PageSpeed key — but the **Chrome UX Report API must be enabled** in that Google project; when it is not, the audit reports "not available" with that one step and never fails. Low weight in the score (unscored where the full report's Lighthouse run already scores speed), and both reports name the source and the 28-day period.
**Impact priority** (`v5/code/_impact.js`): severity × the share of pages affected × the clicks and impressions those pages get in Search Console × their place in the site. Index blockers first, cosmetic items never first, notes about missing data last; the severity labels are unchanged, the weight is stored on every `seo_audit_findings` row, and both reports say why the first item is first.""", CX - 60, CY - 360, 1040, 300, 4)
log('Core Web Vitals from the Chrome UX Report per template (2026-10-12, FIX_PLAN G7): CrUX Targets -> Fetch CrUX -> Analyze CrUX read the p75 of LCP / INP / CLS for the homepage, a service page and a blog post on phone and desktop in both audit types, fall back to the whole-site (origin) figures, degrade to "not available" with the enabling step when the CrUX API is off in the PageSpeed key\'s project, carry a low weight (unscored where the Lighthouse run already scores speed) and name their source and 28-day period in both reports')
log('Impact-weighted priority for every audit finding (2026-10-12, FIX_PLAN G26): severity x pages affected x the Search Console clicks and impressions of those pages x their place in the site (v5/code/_impact.js), with index blockers first, cosmetic items never first and missing-data notes last; severities stay visible, both reports explain why the first fix is first, and the weight plus its one-line basis are stored on every seo_audit_findings row for the app')
log('A second ops alert channel and a durable record (2026-10-12, FIX_PLAN D25b): the Error Handler records every alert in seo_ops_alerts before sending, then posts to SEO_ALERT_WEBHOOK_URL (Slack / Teams / any POST endpoint, no SMTP) as well as e-mailing the ops address; repeats of the same failure within 30 minutes are counted but not re-sent, an unset channel is skipped and no channel can fail the run')
log('A test check-in can never pass as the month\'s Search Console check-in (2026-10-12, FIX_PLAN D25c): the form asks, the API takes is_test, a test caller or a note that marks the row counts too (v5/code/_checkin_test.js); the row is stored with is_test, the Site Tracker leaves it out of the monthly check so the reminder keeps asking, and a test "yes" raises no critical alert')

# =============================================================================
# 37. ONE RETRY RULE FOR EVERY EXTERNAL HTTP NODE (2026-10-12, system review FIX_PLAN G1, with D19 and D23 as its live cases).
#     Retries differed by builder and by node: build_monitors.py's `get_http` had none (the Ahrefs DR lookup died on a single
#     EAI_AGAIN and was never retried - D23), `HTTP_X` allowed 2 tries 3 s apart, and the nodes inherited from the v3 export
#     carried `retryOnFail` with n8n's defaults or nothing at all (`Keyword Data`, `PageSpeed`, `Find Competitors`, `AI Demand`,
#     the probes, the sitemap reads, the Gotenberg renders ...). Now every `httpRequest` node that calls something outside this
#     machine and can be repeated without a side effect retries 3 times, 5 s apart (retry_lint.RETRY, set in the HTTP helpers of
#     every builder and applied here to the nodes this build inherits or adds by hand). The allow-list (retry_lint.ALLOW) holds
#     the nodes that must NOT be retried, each with its reason: the callbacks that deliver a report to the customer's app insert
#     a report row per POST, and the WordPress draft writes content. Outreach e-mail is never sent from n8n (the app's sender
#     owns it), so no node here needs that exception.
#     n8n fires `retryOnFail` only when a node *fails*, so the rule covers DNS blips, resets, timeouts and 5xx answers but never
#     an error inside an HTTP 200 - DataForSEO answers 40000 / 50000 that way. Those need a code-level retry gate: section 25
#     has one for the two SERP paths, and build_monitors.py now has one for the paid AI paths (*AI Retry Requests* ->
#     *Wait Before AI Retry* -> *Run AI Retries* -> *Merge AI Answers*, D19) in the AI Visibility Tracker and the AI Pulse. The
#     backlink DataForSEO paths keep the node-level rule plus the two-miss loss rule for now (a gate there has to move the
#     response-reading nodes onto a merged node: left as a follow-up in FIX_PLAN G1).
#     Build-time lint: retry_lint.check runs at the end of every builder (next to url_lint) and fails the build when an external
#     HTTP node carries no retry, or a weaker one than the rule, and is not on the allow-list.
# =============================================================================
import retry_lint
_g1_changed = retry_lint.apply_rule(nodes.values())
for _g1 in ('Read Website', 'SERP Top 10', 'Keyword Data', 'PageSpeed', 'RDAP Lookup', 'Fetch GBP', 'Read Nav Pages', 'Render PDF Report', 'Fetch Published Page', 'Run Reach Requests'):
    assert _g1 in nodes, _g1 + ': node missing (G1 retry rule)'
    assert nodes[_g1].get('maxTries') == 3 and nodes[_g1].get('waitBetweenTries') == 5000, _g1 + ': the retry rule did not reach it'
assert len(_g1_changed) >= 45, 'G1: only %d HTTP nodes were normalised - the retry rule should reach every external call' % len(_g1_changed)
for _g1 in ('POST Callback', 'POST Rejection'):   # the two report callbacks stay without a retry, on purpose
    assert _g1 in retry_lint.ALLOW and not nodes[_g1].get('retryOnFail'), _g1 + ': a report callback must not be retried'
# the lint has to bite: a new HTTP node without a retry is a finding, an allow-listed one is not
assert retry_lint.findings([{'type': 'n8n-nodes-base.httpRequest', 'name': 'Lint Self Test'}], 'self test'), 'the retry lint does not bite'
assert not retry_lint.findings([{'type': 'n8n-nodes-base.httpRequest', 'name': 'POST Callback'}], 'self test'), 'the retry lint ignores its allow-list'
retry_lint.check({'nodes': list(nodes.values()), 'name': 'SEO Agent v4'})
log('One retry rule for every external HTTP node (2026-10-12, FIX_PLAN G1): every httpRequest node that reads from outside retries 3 times, 5 s apart (%d nodes normalised in the main workflow, the HTTP helpers of every builder changed), the report callbacks and the WordPress draft are on the documented allow-list because they are not idempotent, the paid AI paths get a code-level retry gate for task errors inside an HTTP 200 (AI Retry Requests -> Wait Before AI Retry -> Run AI Retries -> Merge AI Answers, in the AI Visibility Tracker and the AI Pulse) next to the SERP gates of section 25, and the build fails when a new external HTTP node has no retry (retry_lint.py)' % len(_g1_changed))
# 39. THE SEVEN DEFECTS OF THE PHASE 2 LIVE CHECK (P2-1 … P2-7, 2026-10-12; docs/system-review-2026-10-11/LIVE_CHECK_phase2_2026-10-12.md
#     §3). Every one of them passed the harness and failed on techand.ai:
#       P2-1 *Nav Pages Plan* read the menu from *Clean Site Text*'s markdown links (one /insights/ article on techand.ai, rightly skipped),
#            so the describer read the homepage alone although the site model held the real 12-entry menu from the raw HTML. It takes the
#            model's nav_pages first now, Clean Site Text's list behind it, fragments collapsed (/industries#bfsi = /industries).
#       P2-2 the model is built BEFORE the describer runs and nothing wrote the services back, so services_json was "[]" everywhere: the kit
#            reads the describer's own `products_or_services`, *Model Services Row* re-saves the model after *Parse Description* (below), and
#            the Site Tracker reads the stored descriptions (*Load Descriptions (Site)*) into its weekly model.
#       P2-3 the delivered meta.json still said "publish at https://techand.ai/…" (bare host, 308): Blog Package builds its URLs with
#            SM.siteUrl, it is no longer on url_lint.py's allow-list, Site Metrics puts every URL it PROMISES on the canonical host, and
#            fix_ladder_hosts.py rewrites the 17 stored rows once.
#       P2-4 an inline // comment swallowed Site Plan's `.map(...)`, so the weekly report said "(undefined days ago)".
#       P2-5 `verdict` was blind to the page inventory: *Client Page Requests* / *Collect Client Pages* set `existing_page` from
#            SM.matchPage, verdict.txt forbids a new page for it, and *Parse Verdict* leads the changes with "improve that URL".
#       P2-6 the author box Blog Package attaches carried 11 bracketed fields while QA reported 0 placeholders: Content QA counts them as
#            `profile_placeholders`, the page does not pass with them, and the editor is not sent to fix what only the owner can.
#       P2-7 a "Write now" run had no word target at all (no *Parse Analysis*, no verdict): the ladder row stores the verdict's own count
#            (`seo_ladders.target_words`), the app and *Spawn Page Runs* pass it as `ladder_words` and *Parse Brief* clamps to it.
# =============================================================================
# P2-1: the menu comes from the site model
assert "$('Site Model').first().json.site_model" in code('Nav Pages Plan') and 'navMerged' in code('Nav Pages Plan'), 'Nav Pages Plan does not read the model menu (P2-1)'
# P2-2: the model is re-saved with the services the describer found (after the description's own cache row)
_rd39 = pos('Restore Description')
disconnect('Restore Description', 'Route Mode')
add_node('Model Services Row', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Model_Services_Row.js')}, [_rd39[0] + 220, _rd39[1]])
if_node('New Model Services?', "{{ !$json.skip }}", [_rd39[0] + 440, _rd39[1]])
add_node('Save Model Services', DT_TYPE, DT_VERSION, dt_upsert_params(CACHE_TABLE, CACHE_COLS, 'key'), [_rd39[0] + 660, _rd39[1] - 120], {'onError': 'continueRegularOutput', 'alwaysOutputData': True})
add_node('Restore Model Services', 'n8n-nodes-base.code', 2, {'jsCode': "// The run continues with the fresh description (a Data Table upsert outputs the stored row, not the run's item).\nreturn [{ json: $('Restore Description').first().json }];"}, [_rd39[0] + 880, _rd39[1]])
for _a39, _b39 in [('Restore Description', 'Model Services Row'), ('Model Services Row', 'New Model Services?'), ('Save Model Services', 'Restore Model Services'), ('Restore Model Services', 'Route Mode')]:
    connect(_a39, _b39)
connect('New Model Services?', 'Save Model Services', 0); connect('New Model Services?', 'Restore Model Services', 1)
assert conns['Restore Description']['main'][0][0]['node'] == 'Model Services Row' and conns['Restore Model Services']['main'][0][0]['node'] == 'Route Mode'
assert 'const SM = (() => {' in code('Model Services Row'), 'Model Services Row: site model kit not inlined'
assert 'products_or_services' in SITE_MODEL_SRC and 'products_or_services' in code('Site Model'), 'the model still ignores the describer services (P2-2)'
# P2-3: every URL the package hands over is on the canonical host, and the lint watches it from now on
assert 'const SM = (() => {' in code('Blog Package') and "siteUrlOf(dom, '/' + slug + '/')" in code('Blog Package'), 'Blog Package: suggested_url is not built with the model (P2-3)'
assert 'Blog Package' not in url_lint.ALLOW, 'Blog Package must not be on the canonical-host allow-list any more (P2-3)'
assert 'ownUrl(p.url)' in code('Blog Package') and 'ownUrlQA(p.url)' in code('Content QA'), 'the planned-page URLs are not on the canonical host (P2-3)'
# P2-4: the comment sits at the end of the statement, so the .map() runs
assert '.map(b => ({ keyword: b.keyword, started_at:' in rd('code/Site_Plan.js'), 'Site Plan: pending_publish has no days (P2-4)'
# P2-5: the verdict improves a page the site already has
patch('Parse Verdict', "const allowed = ['GO', 'GO_WITH_CHANGES', 'AVOID'];\nif (!allowed.includes(verdict.verdict)) verdict.verdict = 'GO_WITH_CHANGES';",
      "const allowed = ['GO', 'GO_WITH_CHANGES', 'AVOID'];\nif (!allowed.includes(verdict.verdict)) verdict.verdict = 'GO_WITH_CHANGES';\n\n" + rd('code/_verdict_existing.js').rstrip('\n'))
patch('Parse Verdict', "    verdict_changes: verdict.what_must_change || [],", "    verdict_changes,\n    existing_page_action,")
assert 'existing_page_action' in code('Parse Verdict') and 'NEW_URL_RE' in code('Parse Verdict'), 'Parse Verdict: the existing page is not enforced (P2-5)'
assert 'SM.matchPage' in code('Client Page Requests') and 'inventoryPage' in code('Collect Client Pages'), 'the verdict path still ignores the page inventory (P2-5)'
assert 'THE SITE ALREADY HAS A PAGE FOR THIS SEARCH' in nodes['Verdict Agent']['parameters']['text'] and 'never recommend a new page' in nodes['Verdict Agent']['parameters']['text'].lower(), 'verdict.txt does not forbid a second page (P2-5)'
# P2-6: the author box the package attaches is counted, and shown where the owner reads the verdict
assert 'profile_placeholders' in code('Content QA') and 'passed_copy && profile_placeholders === 0' in code('Content QA'), 'Content QA does not count the author box (P2-6)'
assert 'editor_needed = !passed_copy' in code('Content QA'), 'Content QA: the editor round must follow the copy, not the owner fields (P2-6)'
patch('Build Word File', "qa_summary: qa.passed == null ? '' : (qa.passed ? 'Quality check passed' : 'Quality check: ' + (qa.warnings || []).length + ' item(s) to review'),",
      "qa_summary: qa.passed == null ? '' : (qa.passed ? 'Quality check passed' : 'Quality check: ' + ((qa.warnings || []).length + (qa.profile_placeholders ? 1 : 0)) + ' item(s) to review'),")
patch('Build Word File', "    ['Status', qa.passed ? '<span class=\"ok\">Passed</span>' : '<span class=\"bad\">Needs review</span>'],",
      "    ['Status', qa.passed ? '<span class=\"ok\">Passed</span>' : '<span class=\"bad\">Needs review</span>'],\n"
      "    ...(qa.profile_placeholders ? [['Fields only you can fill', '<span class=\"bad\">' + num(qa.profile_placeholders) + ' bracketed field(s) in the byline / author box / Person schema \\u2014 set up the business profile</span>']] : []),")
assert 'Fields only you can fill' in code('Build Word File'), 'the report does not show the author-box fields (P2-6)'
# P2-7: the ladder's own word target travels with every page run
patch('Normalize Input', "    ladder_links,\n    ai_target,", "    ladder_links,\n    ladder_words: Math.max(0, Math.round(Number(p2.ladder_words) || 0)),   // P2-7: the word count the ladder verdict set for this page\n    ai_target,")
assert 'ladder_words' in code('Normalize Input') and 'ladderWords' in code('Parse Brief'), 'the ladder word target does not reach the brief (P2-7)'
assert 'target_words' in code('Ladder Rows') and 'top.target_words' in code('Ladder Plan') and 'ladder_words' in code('Spawn Page Runs'), 'the ladder row has no word target (P2-7)'
assert ('target_words', 'number') in LADDER_COLS, 'seo_ladders has no target_words column (P2-7; run sync_tables.py after deploying)'
url_lint.check({'nodes': list(nodes.values()), 'name': 'SEO Agent v4'})
_mv39 = pos('Model Services Row')
sticky("""### The Phase 2 live check (P2-1 … P2-7, 2026-10-12)
Seven defects that passed the harness and failed live. The **menu** the describer reads comes from the site model's raw-HTML `nav_pages` (P2-1); the **services** the describer finds are written back into the model here (*Model Services Row*) and read by the Site Tracker from the stored description, so `services_json` is no longer `[]` (P2-2); every URL the **package** promises is on the canonical host and `url_lint.py` now watches Blog Package too (P2-3, stored rows: `fix_ladder_hosts.py`); the weekly report counts **days** again (P2-4); a `verdict` for a search one of the site's pages already answers **improves that URL** (P2-5); the **author box**'s bracketed fields are counted as `profile_placeholders` and keep the page from passing, without forcing an editor round (P2-6); and the **length** the ladder verdict set is stored on the row and clamps every later page run (P2-7).""",
    _mv39[0] - 40, _mv39[1] + 200, 1100, 220, 7)
log('Phase 2 live-check defects (2026-10-12, P2-1 … P2-7): the describer reads the menu from the site model\'s raw-HTML nav pages instead of the markdown links; the services the describer finds are saved back into the model (Model Services Row -> seo_cache model:) and the Site Tracker reads the stored descriptions, so seo_sites.services_json and the brief\'s facts.website.services are filled; the blog package\'s suggested_url and every planned-page URL use SM.siteUrl (Blog Package is no longer on the canonical-host allow-list) while Site Metrics puts the URLs it promises on the canonical host and fix_ladder_hosts.py rewrites the stored ladder rows once; the weekly site report prints the real day count again (the inline comment no longer swallows the map); a verdict for a keyword one of the site\'s pages already answers reads that page, improves it and may not recommend a second URL; Content QA counts the author / reviewer box the package attaches (profile_placeholders: the page does not pass with them, the editor is not sent to fix them); and the word count the ladder verdict set is stored on the ladder row (target_words), passed by the app, the cadence and Spawn Page Runs as ladder_words and clamped in Parse Brief')

# =============================================================================
# 42. A FIX LIST A CUSTOMER CAN ACT ON (2026-10-12, FIX_PLAN.md §3.9 G18-2; measured in ACCURACY_SET.md §6)
#     The accuracy set measures a second number next to precision: **useful precision**, the share of the findings shown that are worth a
#     customer's time. It was 75% — 10 of the 40 findings shown on the three labelled sites were true and still not worth reading: the link
#     count of nav-heavy pages, a title one character over 60, "light content" on section index pages, a URL whose rename would cost a
#     published article its rankings, a cosmetic tag. Nothing here is deleted, suppressed or taken out of the score: the minor band
#     (`IMP.isMinor`, Low / Info severity, never an index blocker, lowest impact or one of the measured low-value rules) is **folded** into
#     one "Minor items (N)" line in both audit reports and in the app, and both say how many were folded. `f.minor` travels inside
#     `site_audit.findings`, `minor_count` in the audit payload and the callback; the app derives the same rule from the stored severity and
#     impact (`app/shared/src/findings.ts` — mirror of `v5/code/_impact.js`), so no Data Table column changes.
# =============================================================================
MINOR_SECTION_JS = r"""// ---- the minor band folded into one line (G18-2, 2026-10-12) ----
const minorOf = (list) => (list || []).filter(f => f && f.minor === true);
const minorBlock = (list, where) => {
  const e2 = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const m = minorOf(list);
  if (!m.length) return '';
  const row = (f) => `<tr><td><b>${e2(f.title)}</b></td><td class="small">${e2(f.category)} · ${e2(f.severity)}</td>`
    + `<td class="small">${f.scope === 'site' ? 'Whole website' : e2((f.affected_count || 0) + ' page' + ((f.affected_count || 0) === 1 ? '' : 's'))}</td>`
    + `<td class="small">${e2(f.fix || '')}${f.evidence ? '<br>' + e2(f.evidence) : ''}</td></tr>`;
  return `<details open class="minorfold"><summary><b>Minor items (${m.length})</b> — true, and the lowest impact of this audit`
    + `${where ? ' in ' + e2(where) : ''}: one line each instead of a section each, so the list above is the one to act on. Nothing is left out of the score or of the stored findings.</summary>`
    + `<table class="ct"><tr><th>Item</th><th>Area</th><th>Pages</th><th>What to do</th></tr>${m.map(row).join('')}</table></details>`;
};
"""
for _rn42 in ('Build Audit Report', 'Build Full Report'):
    patch(_rn42, "const findings = a.findings || [];", MINOR_SECTION_JS + "const findings = a.findings || [];")
# the technical audit: section 4 lists the main findings per severity, the minor ones in one folded line at the end
patch('Build Audit Report', """for (const sev of SEV) {
  const list = findings.filter(f => f.severity === sev);
  if (!list.length) continue;""",
      """const mainFindings = findings.filter(f => f.minor !== true);
if (minorOf(findings).length) html += `<p class="small">${esc(a.minor_note || '')}</p>`;
for (const sev of SEV) {
  const list = mainFindings.filter(f => f.severity === sev);
  if (!list.length) continue;""")
patch('Build Audit Report', "// ---------- 5. Action plan ----------", "html += minorBlock(findings);\n\n// ---------- 5. Action plan ----------")
# the action plan's polish phase names the main items and counts the folded ones instead of repeating them
patch('Build Audit Report', """const phase = (title, sevs, when) => {
  const list = findings.filter(f => sevs.includes(f.severity));""",
      """const phase = (title, sevs, when) => {
  const list = findings.filter(f => sevs.includes(f.severity) && f.minor !== true);""")
patch('Build Audit Report', "  phase('Phase 3 — Polish', ['Low', 'Info'], 'when time allows');",
      "  phase('Phase 3 — Polish', ['Low', 'Info'], 'when time allows') +\n"
      "  (minorOf(findings).length ? `<p class=\"small\">Plus ${minorOf(findings).length} minor item(s), folded into one line in section 4.</p>` : '');")
# the full report: every category block folds its own minor items
patch('Build Full Report', """const findingsBlock = (list) => list.length
  ? SEV.map(s => list.filter(f => f.severity === s).map(card).join('')).join('')
  : '<p class="okline">No issues found in this area.</p>';""",
      """const findingsBlock = (list, where) => list.length
  ? (SEV.map(s => list.filter(f => f.severity === s && f.minor !== true).map(card).join('')).join('') + minorBlock(list, where)) || '<p class="okline">Only minor items in this area.</p>'
  : '<p class="okline">No issues found in this area.</p>';""")
assert code('Build Full Report').count('findingsBlock(byCat(') >= 5, 'Build Full Report: the findings blocks moved (G18-2)'
# the scored audit carries the count and the one-line note, for the reports, the callback and the app
patch('Build Site Issues', "      priority_method: IMP.method,\n      priority_first: IMP.firstReason(findings),\n",
      "      priority_method: IMP.method,\n      priority_first: IMP.firstReason(findings),\n"
      "      minor_count: IMP.fold(findings).folded,\n      minor_note: IMP.foldNote(IMP.fold(findings).folded),\n")
for _rn42b in ('Build Audit Report', 'Build Full Report'):
    patch(_rn42b, "    priority_first: a.priority_first || '',", "    priority_first: a.priority_first || '',\n    minor_count: a.minor_count || 0,\n    minor_note: a.minor_note || '',")
patch('Build Audit Response', "top_issues: d.top_issues, crux: d.crux || null,",
      "top_issues: d.top_issues, minor_count: d.minor_count || 0, minor_note: d.minor_note || '', crux: d.crux || null,")
assert 'IMP.fold(findings).folded' in code('Build Site Issues') and 'f.minor = isMinor(f)' in code('Build Site Issues'), 'Build Site Issues: the minor band is not computed (G18-2)'
assert 'minorBlock(findings)' in code('Build Audit Report') and 'minorBlock(list, where)' in code('Build Full Report'), 'the reports do not fold the minor items (G18-2)'
_bsi42 = pos('Build Site Issues')
sticky("""### Minor items are folded, not hidden (G18-2, 2026-10-12)
The accuracy set measured **useful precision 75%**: 10 of the 40 findings shown on the three labelled sites were true and not worth a customer's time (the link count of a navigation page, a title one character over 60, "light content" on an index page, a URL rename that would cost rankings, a cosmetic tag).
`IMP.isMinor` (`v5/code/_impact.js`) marks the **minor band** — Low / Info, never an index blocker, the lowest impact or one of those measured rules — and every finding carries `minor`. Both audit reports list the main findings as before and fold the minor ones into one **"Minor items (N)"** line with the count and the reason; the Action Plan counts them instead of repeating them; `minor_count` travels in the callback and the app's technical page folds the same rows (`app/shared/src/findings.ts`, the same rule over the stored severity and impact).
Nothing is suppressed: the findings are scored, stored and listed inside the folded line.""",
    _bsi42[0] - 40, _bsi42[1] + 240, 1100, 240, 6)
log('A fix list a customer can act on (2026-10-12, FIX_PLAN G18-2, measured in ACCURACY_SET.md): the minor band (IMP.isMinor in v5/code/_impact.js: Low / Info severity, never an index blocker, the lowest impact or one of the low-value rules the accuracy set measured - nav-heavy link counts, a title one character over 60, light content on index pages, long or messy URLs) is folded into one "Minor items (N)" line in the technical audit report (section 4) and per category in the full report, with the count and the reason, while the Action Plan counts them instead of repeating them; every finding carries f.minor, site_audit carries minor_count / minor_note, the audit callback passes them on, and the app folds the same rows with the same rule over the stored severity and impact (app/shared/src/findings.ts) - nothing is dropped from the score, the stored rows or the folded list')

# =============================================================================
# 43. WHAT THE PHASE 3 + 4 LIVE CHECK FOUND (P34-1 … P34-6, 2026-10-12; docs/system-review-2026-10-11/LIVE_CHECK_phase34_2026-10-12.md
#     §3). Two of the six live in this builder; the other four are in v5/code (P34-1 drafts: _drafts.js + Earned_Media / Growth_Metrics /
#     Growth_Report / Prospect_Rows / AI_Metrics / Outreach_Jobs; P34-2 listings: _outreach_kit.js namesUs + _listings.js listingClaim +
#     LB_Assemble; P34-3 the fact gate: Analyst_Jobs; P34-6 the business name: _monitor_sites.js).
#     P34-4: the full SEO report's "Link opportunities" list came straight out of DataForSEO's domain_intersection with no gate at all,
#       so it told the owner to "reach out with a listing request, partnership or useful resource" to **mof.gov.ae** (a ministry you join
#       by accreditation), **backlinkcheckers.space** and **buyhighda.space** (sites that sell links) — while the Backlink Monitor, on
#       the same data, refused 39 of 42 with a reason. Analyze Backlinks now reads the same kits (v5/code/_link_kit.js +
#       _outreach_kit.js): OK.noPitch (government, link sellers, wires, gambling, mailbox providers, data brokers, infrastructure,
#       statistics pages, a spam score of 30+, an accredited-provider list without the accreditation), LK.footprints over the gap rows
#       and OK.gapTopic's 25% topic rule. Nothing is hidden: every domain stays in `authority.gap` with `pitch` and `reason`, the report
#       prints the reason next to it, and the finding names only the domains that may be pitched.
#     P34-5: executions 459 and 461 (two 200-page audits of the same site, started 2 seconds apart) hung when the n8n JavaScript task
#       runner stopped answering and were cancelled at the 90-minute execution timeout. Their seo_run_ledger rows stayed `reserved` for
#       ever, so they kept counting $0.77 against the $6/day budget estimate. Two guards: a reservation older than
#       CONFIG.run_stale_hours (2) is released — marked `stale` by *Release Stale Runs* and left out of Rate Limit's count and budget —
#       and a second heavy crawl of the same site while one is running is refused with the reason (the ledger row now carries `domain`
#       and `heavy`). release_stale_runs.py clears rows left over from before this deploy (--dry-run by default).
# =============================================================================
LK_SRC = _rd0('code/_link_kit.js').rstrip('\n'); OK_SRC = _rd0('code/_outreach_kit.js').rstrip('\n')
assert 'function noPitch' in OK_SRC and 'function gapTopic' in OK_SRC, 'the outreach kit has no gap gate (P34-4)'
assert 'const LK = (() => {' not in code('Analyze Backlinks'), 'Analyze Backlinks: the link kit is already inlined'
setcode('Analyze Backlinks', LK_SRC + '\n' + OK_SRC + '\n' + code('Analyze Backlinks'))
patch('Analyze Backlinks', """const gapItems = gapRes.tasks?.[0]?.result?.[0]?.items || [];
const gap = gapItems.map(it => {
  const vals = Object.values(it.domain_intersection || {});
  const first = vals[0] || {};
  return { referring_domain: first.target || first.domain || it.domain || it.referring_domain || null, rank: first.rank ?? null, links_to_competitors: vals.length };
}).filter(g => g.referring_domain).slice(0, 25);""",
      """// P34-4 (live 2026-10-12): this list used to be DataForSEO's answer, unfiltered, and recommended a ministry and two link sellers.
// The Link Builder's gates now run on it too (v5/code/_outreach_kit.js, the same rules the Backlink Monitor applies): who is never
// pitched, and whether anything ties the domain to this site's topics. Every domain stays in the list, with the reason.
const gapItems = gapRes.tasks?.[0]?.result?.[0]?.items || [];
const kwOf = (k) => String((k && (k.keyword || k.query)) || k || '');
const sk0 = base.site_keywords || {};
const gapTopics = [base.keyword, base.business, base.business_type, String(base.domain || '').split('.')[0].replace(/[^a-z0-9]+/gi, ' '),
  ...(sk0.seeds || []).slice(0, 10).map(kwOf), ...(sk0.keyword_gap || []).slice(0, 10).map(kwOf), ...(sk0.easy_wins || []).slice(0, 10).map(kwOf),
  ...(sk0.striking_distance || []).slice(0, 10).map(kwOf)].filter(Boolean).join(' ');
const gapTld = ({ GB: 'uk' })[base.country_iso] || String(base.country_iso || '').toLowerCase();
const weAreAccredited = OK.accredited(base.accreditation || ((base.profile || {}).accreditation));
const gap0 = gapItems.map(it => {
  const vals = Object.values(it.domain_intersection || {});
  const first = vals[0] || {};
  return { referring_domain: first.target || first.domain || it.domain || it.referring_domain || null, rank: first.rank ?? null, links_to_competitors: vals.length,
    spam_score: first.backlinks_spam_score ?? null, title: String(first.title || '').slice(0, 160) };
}).filter(g => g.referring_domain).slice(0, 25);
const gapFarms = LK.footprints(gap0.map(g => ({ ref_domain: LK.refKey(g.referring_domain), from_url: 'https://' + g.referring_domain + '/', anchor: '', page_title: g.title })), { domain: base.domain, brands: [String(base.business || '')] });
const gap = gap0.map(g => {
  const farm = gapFarms.get(LK.refKey(g.referring_domain)) || '';
  const no = farm || OK.noPitch(g.referring_domain, { spam: g.spam_score, title: g.title, accredited: weAreAccredited });
  const t = no ? { ok: false, why: '' } : OK.gapTopic(g.referring_domain, { topics: gapTopics, title: g.title, country_tld: gapTld, topic_label: String(base.keyword || 'your topics') });
  return { ...g, pitch: !no && t.ok, reason: no || t.why };
});
const gapPitch = gap.filter(g => g.pitch);""")
patch('Analyze Backlinks', """if (gap.length) {
  F('Medium', 'Link opportunities: sites that link to competitors but not to you',
    gap.length + ' domains. Top: ' + gap.slice(0, 5).map(g => g.referring_domain).join(', '),
    'Sites that already link to your competitors are the most likely to link to you.',
    'Reach out to these sites with a listing request, partnership or useful resource.');
}""",
      """if (gapPitch.length) {
  F('Medium', 'Link opportunities: sites that link to competitors but not to you',
    gapPitch.length + ' of ' + gap.length + ' domains are worth a pitch. Top: ' + gapPitch.slice(0, 5).map(g => g.referring_domain).join(', ')
      + (gap.length > gapPitch.length ? '. ' + (gap.length - gapPitch.length) + ' are left out (e.g. ' + gap.filter(g => !g.pitch).slice(0, 3).map(g => g.referring_domain + ' — ' + g.reason).join('; ') + ')' : ''),
    'Sites that already link to your competitors are the most likely to link to you.',
    'Reach out to these sites with a listing request, partnership or useful resource. The ones left out are not worth asking: a government list is joined by applying, and a site that sells links passes nothing on.');
} else if (gap.length) {
  F('Info', 'No link opportunities worth a pitch in this gap',
    'All ' + gap.length + ' sites that link to your competitors are government portals, link sellers or off topic for you (e.g. ' + gap.slice(0, 3).map(g => g.referring_domain + ' — ' + g.reason).join('; ') + ')',
    'A link is only worth asking for when the site is a real publisher on your subject; the rest pass nothing on or need an application.',
    'Earn links from partner directories, industry associations, suppliers and press on your own subject instead.');
}""")
assert 'OK.noPitch' in code('Analyze Backlinks') and 'LK.footprints' in code('Analyze Backlinks'), 'Analyze Backlinks: the gap gate is not wired (P34-4)'
# the report prints the reason next to every domain it leaves out
patch('Build Full Report', """    au.gap.slice(0, 20).map(g => `<tr><td>${esc(g.referring_domain)}</td><td>${num(g.links_to_competitors)}</td></tr>`).join('') + `</table>`;""",
      """    au.gap.slice(0, 20).map(g => `<tr><td>${esc(g.referring_domain)}${g.pitch === false ? `<div class="small">not pitched: ${esc(g.reason || 'off topic')}</div>` : ''}</td><td>${num(g.links_to_competitors)}</td></tr>`).join('') + `</table>`;""")
log('The full report\'s link gap is gated like the Link Builder\'s prospects (2026-10-12, P34-4): Analyze Backlinks reads the link and outreach kits and refuses government portals, link sellers ("backlink", "dofollow", "high da" in the name), press wires, gambling, mailbox providers, data brokers, infrastructure, statistics pages, a spam score of 30+, an accredited-provider list without the accreditation on file, link-farm footprints and domains with no tie to the site\'s topics (OK.gapTopic, the 25% rule); every domain stays in the list with its reason, the report prints it, and the Medium finding names only the domains worth a pitch (Info when none is)')


# ---- P34-5: a reservation nobody settled is released, and one heavy crawl per site at a time ----
from ladder_common import dt_update_where_params
patch('Normalize Input', "  ladder_pages_default: 1,          // ladder mode: pages written immediately (1-3; each page is its own content run)",
      "  // P34-5 (2026-10-12): how long a run may hold its budget reservation before it is released as `stale` (two audits killed by the\n"
      "  // task runner held $0.77 of the day's estimate for ever), and the crawl size from which only one audit of a site may run at a time.\n"
      "  run_stale_hours: 2,\n"
      "  heavy_audit_pages: 100,\n"
      "  ladder_pages_default: 1,          // ladder mode: pages written immediately (1-3; each page is its own content run)")
patch('Normalize Input', "    ai_budget_usd: CONFIG.ai_budget_usd,\n    ai_budget_period: CONFIG.ai_budget_period,\n",
      "    ai_budget_usd: CONFIG.ai_budget_usd,\n    ai_budget_period: CONFIG.ai_budget_period,\n    run_stale_hours: CONFIG.run_stale_hours,\n    heavy_audit_pages: CONFIG.heavy_audit_pages,\n")
# the reservation says which site it is working on and whether it is a heavy crawl
patch('Run Ledger Row', "return [{ json: { run_id: String($execution.id), key, mode: String(d.mode || ''), est_usd: +Number(est || 0).toFixed(4), created_at: new Date().toISOString(), status: 'reserved', settled_usd: 0 } }];",
      "// P34-5: the row says which site the run is working on and whether it is a heavy crawl, so Rate Limit can refuse a second large\n"
      "// audit of the same site while one is running (two 200-page audits of techand.ai at once stalled the n8n task runner, 2026-10-12).\n"
      "const HEAVY_PAGES = Number(d.heavy_audit_pages) > 0 ? Number(d.heavy_audit_pages) : 100;\n"
      "const heavy = d.mode === 'audit' && (Number(d.crawl_max_pages) || 0) >= HEAVY_PAGES;\n"
      "return [{ json: { run_id: String($execution.id), key, mode: String(d.mode || ''), est_usd: +Number(est || 0).toFixed(4), created_at: new Date().toISOString(), status: 'reserved', settled_usd: 0,\n"
      "  domain: String(d.domain || '').toLowerCase(), heavy } }];")
_STALE_EXPR = "={{ new Date(Date.now() - (Number($('Normalize Input').first().json.run_stale_hours) || 2) * 3600000).toISOString() }}"
_lrp = pos('Load Run Ledger')
add_node('Release Stale Runs', DT_TYPE, DT_VERSION, dt_update_where_params(RUN_LEDGER_TABLE, RUN_LEDGER_COLS, [('status', 'eq', 'reserved'), ('created_at', 'lt', _STALE_EXPR)], {'status': 'stale'}),
         [_lrp[0] + 110, _lrp[1] + 150], {'onError': 'continueRegularOutput', 'alwaysOutputData': True, 'executeOnce': True})
disconnect('Load Run Ledger', 'Rate Limit')
connect('Load Run Ledger', 'Release Stale Runs'); connect('Release Stale Runs', 'Rate Limit')
patch('Rate Limit', """let mine = {}; try { mine = $('Reserve Run Ledger').first().json || {}; } catch (e) {}
let ledger = []; try { ledger = $('Load Run Ledger').all().map(i => i.json).filter(r => r && r.run_id && !r.error); } catch (e) {}
const myId = Number(mine.id);
const earlier = ledger.filter(r => r.mode !== 'assess' && r.status !== 'refused' && (myId > 0 ? Number(r.id) < myId : String(r.run_id) !== String($execution.id)));""",
      """let mine = {}; try { mine = $('Reserve Run Ledger').first().json || {}; } catch (e) {}
let ledger = []; try { ledger = $('Load Run Ledger').all().map(i => i.json).filter(r => r && r.run_id && !r.error); } catch (e) {}
const myId = Number(mine.id);
// P34-5 (live 2026-10-12): a run that never settles must not hold the budget for ever. Executions 459 and 461 were cancelled at the
// 90-minute timeout after the n8n task runner stopped answering, and their rows stayed `reserved`, counting $0.77 against the $6/day
// estimate with nothing running. A reservation older than run_stale_hours is released: *Release Stale Runs* marks it `stale` in the
// table, and it is left out of the counts and the budget here whether that update got through or not.
const STALE_H = Number(d.run_stale_hours) > 0 ? Number(d.run_stale_hours) : 2;
const staleBefore = Date.now() - STALE_H * 3600000;
const isStale = (r) => { const st = String(r.status || ''); if (st === 'stale') return true;
  const t = Date.parse(String(r.created_at || '')); return st === 'reserved' && t > 0 && t < staleBefore; };
const earlier = ledger.filter(r => r.mode !== 'assess' && r.status !== 'refused' && !isStale(r) && (myId > 0 ? Number(r.id) < myId : String(r.run_id) !== String($execution.id)));
d.ledger_stale_released = ledger.filter(isStale).length;""")
patch('Rate Limit', """if (used >= perKey && !['published', 'checkin', 'profile'].includes(d.mode)) {   // reporting a published page or a check-in costs nothing and is never blocked
  return [{ json: { ...d, validation_error: 'You have reached the daily limit of ' + perKey + ' runs. Please try again tomorrow.' } }];
}""",
      """if (used >= perKey && !['published', 'checkin', 'profile'].includes(d.mode)) {   // reporting a published page or a check-in costs nothing and is never blocked
  return [{ json: { ...d, validation_error: 'You have reached the daily limit of ' + perKey + ' runs. Please try again tomorrow.' } }];
}

// ---- P34-5: one heavy crawl of a site at a time ----
// Two 200-page audits of the same site, started two seconds apart, stalled the JavaScript task runner and were both cancelled at the
// execution timeout 90 minutes later; re-run one after the other they finished in 4 and 11 minutes. A second heavy audit of the same
// site is refused while the first one holds its reservation (a stale one no longer counts, so a crashed run never blocks the site).
const yesNo = (v) => v === true || /^(true|1|yes|on)$/i.test(String(v == null ? '' : v));
const myDomain = String(mine.domain || d.domain || '').toLowerCase();
if (yesNo(mine.heavy) && myDomain) {
  const busy = earlier.find(r => String(r.status || '') === 'reserved' && yesNo(r.heavy) && String(r.domain || '').toLowerCase() === myDomain);
  if (busy) {
    const since = String(busy.created_at || '').slice(11, 16);
    return [{ json: { ...d, validation_error: 'A large audit of ' + myDomain + ' is already running' + (since ? ' (started ' + since + ' UTC)' : '') + '. Two big crawls of the same website at once overload the crawler and both time out, so this one was not started. Wait for the first to finish — a 200-page audit usually takes 5 to 15 minutes — and start this one again, or ask for fewer pages.' } }];
  }
}""")
assert 'isStale' in code('Rate Limit') and 'A large audit of' in code('Rate Limit'), 'Rate Limit: the P34-5 guards are not wired'
assert 'heavy' in code('Run Ledger Row') and 'run_stale_hours: CONFIG.run_stale_hours' in code('Normalize Input'), 'P34-5: the ledger row or the config is not wired'
# the wiring the harness checks (S51), next to the settle / refuse nodes of section 29
_rel = nodes['Release Stale Runs']['parameters']
_lw_path = os.path.join(HERE0, 'harness', 'ledger_wiring.json')
_lw = json.load(open(_lw_path))
_lw.update({'release_node': 'Release Stale Runs',
            'release_from': sorted(s for s, o in conns.items() for l in (o.get('main') or []) for t in (l or []) if t['node'] == 'Release Stale Runs'),
            'release_to': [t['node'] for l in (conns['Release Stale Runs']['main'] or []) for t in (l or [])],
            'release_conditions': [[c['keyName'], c['condition'], c['keyValue']] for c in _rel['filters']['conditions']],
            'release_values': _rel['columns']['value'],
            'stale_hours': 2, 'heavy_audit_pages': 100})
json.dump(_lw, open(_lw_path, 'w'), indent=1)
_rlp = pos('Rate Limit')
sticky("""### A reservation nobody settles, and one heavy crawl per site (P34-5, 2026-10-12)
Two 200-page audits of the same site started two seconds apart; the n8n **JavaScript task runner** stopped answering, both executions hung and were cancelled at the 90-minute timeout, and their `seo_run_ledger` rows stayed **reserved** — holding $0.77 of the $6/day estimate with nothing running.
**Released:** *Release Stale Runs* marks every reservation older than `CONFIG.run_stale_hours` (2) as `stale`, and **Rate Limit** leaves stale rows out of the day's count and of the budget whether that update got through or not. `release_stale_runs.py` clears the rows left from before this deploy (`--dry-run` by default).
**Refused:** the reservation now carries `domain` and `heavy` (mode `audit` from `CONFIG.heavy_audit_pages` pages up), and a second heavy audit of the same site is refused while the first one is still reserved, with the reason and how long to wait.""",
    _rlp[0] - 40, _rlp[1] + 320, 940, 240, 6)
log('Runs that never settle and concurrent heavy audits (2026-10-12, P34-5): CONFIG.run_stale_hours (2) releases a seo_run_ledger reservation nobody settled — Release Stale Runs marks it `stale` and Rate Limit leaves stale rows out of the day\'s count and of the AI budget (two cancelled 200-page audits held $0.77 for ever) — and the reservation carries the domain and whether it is a heavy crawl (mode audit from CONFIG.heavy_audit_pages pages up), so a second large audit of the same site while one is running is refused with the reason and the time to wait instead of stalling the task runner; release_stale_runs.py clears rows left from before the deploy (--dry-run by default)')

# =============================================================================
# 44. WHAT THE KEYWORD RESEARCH IS ALLOWED TO USE (2026-10-13, system review FIX_PLAN.md G8; criteria K2 / K4 / K6 / K7 in
#     docs/system-review-2026-10-11/CRITERIA_keywords_content.md). Keyword research scored 5/10: the data sources were good but four
#     things the leaders do were missing, and all four can be had from data the run already holds.
#       * K6 first-party demand: Search Console was read by the weekly tracker and the content cadence only. Discovery started from
#         what an AI model guessed the business sells, so the searches the site ALREADY gets impressions for never reached the paid
#         pulls. *Load Query History (Discovery)* reads the stored rows (seo_query_history, newest 28-day period) and *Search Console
#         Seeds (Discovery)* keeps two kinds -- a query no live page answers (the D11 page inventory decides, SM.matchPage; the page
#         Search Console reports is the fallback while no inventory exists) and a striking-distance query (position 8-20) -- drops
#         brand and scraper queries with the weekly report's own rules (GQ) and inserts them into the seed list behind the primary
#         seed. They ride on the pulls the research makes anyway: no new call, no extra cost.
#       * K2 traffic potential: "~270/mo" was volume x click loss x 0.3 everywhere -- a model on a provider estimate that is itself
#         50-70% off for a single keyword, printed with no hint of that. KWI.calibrate now starts from the site's own measured
#         impressions and clicks where Search Console has them, never reports less than the clicks the site already gets, and labels
#         every number `calibrated` / `modelled` / `unknown` in the report, the callback and the app. Without Search Console data the
#         number is bit-for-bit the old one.
#       * K7 clustering: clusters came from the AI's topic label. KWI.serpClusters groups keywords that share at least 3 of the head
#         keyword's top-10 URLs -- from the live checks' full top 10 plus the competitors' ranking URLs the run already fetched -- and
#         names each group by its head keyword with the shared results pages, so one page can target the whole group.
#       * K4 live SERP checks: fixed at 8, so the intent and page type of everything else came from the AI label alone. The limit is
#         CONFIG.live_serp_checks (16 by default, hard cap 25, about $0.002 a check: ~$0.032 a run instead of ~$0.016), and the
#         per-topic cap grows with it so a wider check cannot become one topic's list.
# =============================================================================
from ladder_common import QUERY_TABLE, QUERY_COLS
# ---------- A. the live-check limit, configurable like every other limit ----------
patch('Normalize Input', "  ladder_pages_default: 1,          // ladder mode: pages written immediately (1-3; each page is its own content run)",
      "  // G8 / K4 (2026-10-13): how many keywords discovery checks live on Google for intent, page type and who ranks. One check is a\n"
      "  // DataForSEO live-advanced SERP at depth 10 (about $0.002), so 16 costs ~$0.032 a run; KWI.liveChecks caps it at 25.\n"
      "  live_serp_checks: 16,\n"
      "  ladder_pages_default: 1,          // ladder mode: pages written immediately (1-3; each page is its own content run)")
patch('Normalize Input', "    run_stale_hours: CONFIG.run_stale_hours,\n", "    run_stale_hours: CONFIG.run_stale_hours,\n    live_serp_checks: CONFIG.live_serp_checks,\n")
assert 'live_serp_checks: CONFIG.live_serp_checks' in code('Normalize Input'), 'G8: the live-check limit does not reach the run'
# ---------- B. the site's own Search Console queries, loaded in discovery and turned into seeds ----------
_sdq = pos('Seed List'); QX44, QY44 = _sdq[0], _sdq[1] + 820
DOMAIN_SEED44 = "={{ String($('Seed List').first().json.domain || '').toLowerCase() }}"
_q_load = dt_get_any_params(QUERY_TABLE, [('domain', DOMAIN_SEED44), ('domain', "={{ 'www.' + String($('Seed List').first().json.domain || '').toLowerCase() }}")])
# the table only grows (one row per site, query and week): the newest rows are enough, and Search Console Seeds keeps only the newest period
_q_load.update({'returnAll': False, 'limit': 300, 'orderBy': True, 'orderByColumn': 'period_end', 'orderByDirection': 'DESC'})
add_node('Ensure Query Table (Discovery)', DT_TYPE, DT_VERSION, dt_create_params(QUERY_TABLE, QUERY_COLS), [QX44, QY44], {'onError': 'continueRegularOutput', 'executeOnce': True})
add_node('Load Query History (Discovery)', DT_TYPE, DT_VERSION, _q_load, [QX44 + 220, QY44], LOAD18)
add_node('Search Console Seeds (Discovery)', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/GSC_Seeds_Discovery.js')}, [QX44 + 440, QY44])
disconnect('Load Ladder Settings (Discovery)', 'Reach Requests (Discovery)')
for a, b in [('Load Ladder Settings (Discovery)', 'Ensure Query Table (Discovery)'), ('Ensure Query Table (Discovery)', 'Load Query History (Discovery)'),
             ('Load Query History (Discovery)', 'Search Console Seeds (Discovery)'), ('Search Console Seeds (Discovery)', 'Reach Requests (Discovery)')]:
    connect(a, b)
for _n44 in ('Search Console Seeds (Discovery)', 'Collect Research', 'Rank Keywords', 'Build Keyword Strategy', 'Priority Keywords'):
    assert 'const KWI = (() => {' in code(_n44), _n44 + ': the discovery-input kit is not inlined (G8)'
assert not any('/*__KW_INPUTS__*/' in n['parameters'].get('jsCode', '') for n in nodes.values()), 'discovery-input kit placeholder left'
assert 'const GQ = (() => {' in code('Search Console Seeds (Discovery)') and 'const SM = (() => {' in code('Search Console Seeds (Discovery)'), 'G8: the seeds node needs the Search Console query rules and the site model'
assert "$('Search Console Seeds (Discovery)')" in code('Research Requests') and "$('Search Console Seeds (Discovery)')" in code('Collect Research'), 'G8: the research does not read the Search Console seeds'
assert 'KWI.liveChecks(' in code('Priority Keywords') and 'KWI.liveChecks(' in code('Rank Keywords'), 'G8 / K4: the live-check limit is not applied in both places'
assert 'KWI.calibrate(' in code('Collect Research') and "traffic_basis: cal.traffic_basis" in code('Collect Research'), 'G8 / K2: the traffic estimate is not calibrated or not labelled'
assert 'KWI.serpClusters(' in code('Rank Keywords') and 'KWI.serpClusters(' in code('Build Keyword Strategy'), 'G8 / K7: the SERP-overlap clusters are not built'
assert 'Searches that share a results page' in code('Build Keyword Strategy') and 'Searches your website already appears for' in code('Build Keyword Strategy'), 'G8: the report does not show the new inputs'
assert 'search_console' in code('Build Ideas Response') and 'serp_clusters' in code('Build Ideas Response') and 'traffic_basis' in code('Build Ideas Response'), 'G8: the callback does not carry the new inputs'
sticky("""### What the keyword research is allowed to use (G8, criteria K2 / K4 / K6 / K7)
**Your own Search Console searches seed the research** (*Load Query History (Discovery)* → *Search Console Seeds (Discovery)*): the newest 28-day period, brand and SEO-tool queries dropped with the weekly report's own rules, keeping the searches **no page of yours answers** (page inventory, `SM.matchPage`) and the ones you rank **8-20** for. They go into the seed list behind the primary seed and ride on the pulls the research makes anyway — **no new call**.
**Traffic potential says what it is:** `calibrated` where Search Console measured that exact search on your site (impressions and clicks over 28 days, never below the clicks you already get), `modelled` from the provider's volume everywhere else, `unknown` when there is neither. Without Search Console data the number is unchanged.
**Clusters by shared results pages** (`KWI.serpClusters`): keywords that share **≥ 3** of the head keyword's top-10 URLs are one group named after that head keyword — one page can target them all.
**Live results-page checks**: `CONFIG.live_serp_checks` (**16**, hard cap 25, ~$0.002 each → ~$0.032 a run) instead of a fixed 8, with the per-topic cap growing with it.""",
    QX44 - 40, QY44 + 160, 1180, 260, 3)
log('What the keyword research is allowed to use (2026-10-13, FIX_PLAN G8, criteria K2 / K4 / K6 / K7): the site\'s own Search Console queries seed discovery (Load Query History (Discovery) -> Search Console Seeds (Discovery): the newest period, brand and scraper queries dropped with the weekly report\'s rules, the searches no live page answers (SM.matchPage page inventory, the Search Console page as the fallback) and the striking-distance ones at position 8-20, inserted behind the primary seed with their measured impressions, clicks and position -- no new API call); traffic potential is calibrated against those measurements where they exist, never below the clicks the site already gets, and every number is labelled calibrated / modelled / unknown in the report, the callback and the app (v5/code/_kw_inputs.js KWI.calibrate); keywords that share at least 3 of a head keyword\'s top-10 URLs form one SERP-overlap cluster named after it, from the live checks plus the competitors\' ranking URLs the run already fetched (KWI.serpClusters), so one page can target the group; and the live intent / page-type check is CONFIG.live_serp_checks (16 by default, hard cap 25, about $0.002 a check) instead of a fixed 8, with the per-topic cap growing with the limit')
# 46. ORIGINAL WORDS, REAL IMAGES, AND A COVERAGE TARGET SOMEBODY SET (2026-10-13, system review FIX_PLAN.md G5 / G30 / G33;
#     CRITERIA_keywords_content.md C5 / C13 / C1). Content scored 5/10 against Surfer and Clearscope, and originality 1/10.
#     G5: nothing ever compared the finished draft with the pages it was written from. Semrush does it with Copyleaks and the convention
#       is 10-15% overlap, so *Originality Check* (between *Content QA* and *Needs Revision?*) measures the share of the draft's 8-word
#       windows that one single page also carries (v5/code/_shingle.js) against every competitor page this run read (*Analyze Competitor
#       Pages*) and the site's own pages it read (*Collect Client Pages* -- the inventory page that matches the keyword is read as the
#       "existing" page, P2-5). Over CONFIG.originality_max_overlap_pct (15) the quality check fails, the editor is sent in with the
#       passage quoted and the source named, and the report and meta.json say against which page and by how much. The page this run is
#       improving is the exception: a rewrite is meant to keep that page's text, so its overlap is reported, never counted. The rest of
#       the inventory (D11) has no text in hand, so a page aimed at the same search is reported as a duplicate target, by title and slug.
#     G30: the package only described three images ("no images produced"), leaving every page with three gaps before publishing. *Image
#       Cards* builds one HTML card per planned image from the page's own content (hero: the H1 over the business name; in-body: the
#       section's heading with the three to five points that section makes), *Render Images* turns each into WebP through the Gotenberg
#       service already in compose.override.yml (`/forms/chromium/screenshot/html`, free, local, ~0.3 s a card, no JavaScript, no
#       licence) and *Attach Images* attaches them under the planned file names with the planned alt text, dimensions and Open Graph
#       image, lists them in meta.json and rewrites the "create the three images" checklist step. A card the renderer cannot produce
#       keeps its place in the plan with the reason: the run never fails over a picture.
#     G33: the coverage bar was a silent 100% of the term list. *Parse Analysis* now picks the page to beat -- the competitor page that
#       uses most of the shared terms -- and publishes the target (its coverage, kept inside 60-90% by CVG.target), its own headings as
#       the subtopics to cover and its depth; the brief states it, and *Content QA* measures that same page on its own term list, scores
#       the 25 coverage points against the target, warns about the subtopics it covers and we do not, and reports coverage as a figure
#       with its basis. A target read off competitor pages, never a promise about rankings.
# =============================================================================
COVERAGE_SRC = _rd0('code/_coverage.js').rstrip('\n'); SHINGLE_SRC = _rd0('code/_shingle.js').rstrip('\n')
assert 'const CVG = (() => {' in COVERAGE_SRC and 'const SHG = (() => {' in SHINGLE_SRC, 'the coverage / originality kits are missing'
rd46 = lambda p: rd(p).replace('/*__COVERAGE__*/', COVERAGE_SRC).replace('/*__SHINGLE__*/', SHINGLE_SRC)

# ---------- G33: the coverage target travels from Parse Analysis to the brief and the quality check ----------
setcode('Parse Analysis', rd46('code/Parse_Analysis.js'))
setcode('Content QA', rd46('code/Content_QA.js'))
set_prompt('Strategy Brief', 'strategy_brief.txt')
set_prompt('Copywriter', 'copywriter.txt')
assert 'const CVG = (() => {' in code('Parse Analysis') and 'const CVG = (() => {' in code('Content QA'), 'the coverage kit is not inlined'
assert 'coverage_digest' in nodes['Strategy Brief']['parameters']['text'], 'the brief prompt carries no coverage target (G33)'
# the brief keeps the target even when the model ignores it: the number and the subtopics are set here, not asked for
patch('Parse Brief', """// Word count check
const totalWords = (brief.outline || []).reduce((s, sec) => s + (Number(sec.target_words) || 0), 0);""",
      """// 3. the coverage target is the best competitor's, measured in Parse Analysis (FIX_PLAN G33, 2026-10-13): it is written into the brief
//    here rather than taken from the model's answer, so Content QA judges the page against a number nobody could talk away. The target
//    is what that one page covers (clamped 60-90%), not an average, and it is a target read off competitor pages -- not a promise.
const covT = prev.coverage_target && typeof prev.coverage_target === 'object' ? prev.coverage_target : null;
if (covT && covT.target_pct) {
  brief.coverage_target = { target_pct: covT.target_pct, best_competitor: covT.best || null, average_pct: covT.average_pct ?? null,
    terms_total: covT.terms_total ?? null, subtopics: covT.subtopics || [], basis: covT.basis || '' };
  const have = new Set((brief.terms_to_use || []).map(t => String((t && t.term) || t || '').toLowerCase().trim()).filter(Boolean));
  const want = Math.ceil((covT.terms_total || 0) * covT.target_pct / 100);
  if (have.size < want) {   // the writer cannot reach the target with a shorter list than the target itself needs
    const add = (covT.terms || []).filter(t => !have.has(String(t).toLowerCase())).slice(0, Math.min(10, want - have.size));
    if (add.length) { brief.terms_to_use = [...(brief.terms_to_use || []), ...add.map(t => ({ term: t, min_count: 1 }))];
      adjustments.push('Added ' + add.length + ' shared term(s) to terms_to_use: the coverage target of ' + covT.target_pct + '% needs at least ' + want + ' of the ' + covT.terms_total + ' terms'); }
  }
  const missing = (covT.subtopics || []).filter(s => !(brief.outline || []).some(o => {
    const h = String((o && (o.h2 + ' ' + (o.key_points || []).join(' '))) || '').toLowerCase();
    const T = String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\\s+/).filter(w => w.length > 3);
    return T.length ? T.filter(w => h.includes(w)).length / T.length >= 0.6 : true; }));
  if (missing.length) { brief.coverage_target.subtopics_not_in_outline = missing.slice(0, 8);
    adjustments.push(missing.length + ' subtopic(s) of the best competitor page are not in the outline: ' + missing.slice(0, 4).join('; ')); }
}

// Word count check
const totalWords = (brief.outline || []).reduce((s, sec) => s + (Number(sec.target_words) || 0), 0);""")
assert 'coverage_target' in code('Parse Brief'), 'Parse Brief does not carry the coverage target (G33)'

# ---------- G5: the originality check, between Content QA and Needs Revision? ----------
patch('Normalize Input', "  run_stale_hours: 2,",
      "  // G5 (2026-10-13): how much of a draft may be word for word the same as ONE page it was written from (the 10-15% convention of\n"
      "  // the similarity checkers). Over this, *Originality Check* fails the quality check and the editor rewrites those passages.\n"
      "  originality_max_overlap_pct: 15,\n"
      "  run_stale_hours: 2,")
patch('Normalize Input', "    run_stale_hours: CONFIG.run_stale_hours,", "    originality_max_overlap_pct: CONFIG.originality_max_overlap_pct,\n    run_stale_hours: CONFIG.run_stale_hours,")
_cqa = pos('Content QA')
add_node('Originality Check', 'n8n-nodes-base.code', 2, {'jsCode': rd46('code/Originality_Check.js')}, [_cqa[0] + 110, _cqa[1] + 180])
disconnect('Content QA', 'Needs Revision?')
connect('Content QA', 'Originality Check'); connect('Originality Check', 'Needs Revision?')
assert 'const SHG = (() => {' in code('Originality Check') and 'const SM = (() =>' in code('Originality Check'), 'the originality node is missing a kit'
# the report and the package say what was measured
patch('Build Word File', """    ['Topic coverage', qa.coverage_pct != null ? qa.coverage_pct + '% of the terms top-ranking pages share' : 'N/A'],""",
      """    ['Topic coverage', qa.coverage && qa.coverage.basis ? esc(qa.coverage.basis) + (qa.coverage.subtopics_missing && qa.coverage.subtopics_missing.length ? ' · subtopics still missing: ' + esc(qa.coverage.subtopics_missing.slice(0, 3).join('; ')) : '') : (qa.coverage_pct != null ? qa.coverage_pct + '% of the terms top-ranking pages share' : 'N/A')],
    ['Originality', qa.originality ? (qa.originality.passed === null ? 'Could not be checked: no competitor or own page text was available in this run'
      : (qa.originality.highest_pct != null ? qa.originality.highest_pct + '% of the page matches ' + esc(qa.originality.highest_source || 'another page') + ' word for word (limit ' + qa.originality.threshold_pct + '%' + (qa.originality.passed ? '' : ' — EXCEEDED') + ')' : 'No overlap found')
        + ' · ' + esc(qa.originality.basis)) : 'N/A'],""")
patch('Build Word File', "    page_markdown: md || undefined, content_brief_slug: brief.slug || '',",
      "    content_originality: qa.originality || null, content_coverage: qa.coverage || null,\n    page_markdown: md || undefined, content_brief_slug: brief.slug || '',")
setcode('Blog Package', rd46('code/Blog_Package.js'))
assert "originality: d.content_originality" in code('Blog Package'), 'the package does not carry the originality figure (G5)'

# ---------- G30: the three planned images are produced ----------
# Gotenberg's screenshot route answers with the image file itself; the service is already in n8n/compose.override.yml for the PDF
# reports and is reachable only from inside this machine. One request per card, each a few hundred milliseconds, no cost at all.
_bpp = pos('Blog Package')
_bp_targets = [t['node'] for t in conns['Blog Package']['main'][0]]
if_node('Make Images?', "{{ !!$json.article_meta && ($json.article_meta.images || []).length > 0 }}", [_bpp[0] + 170, _bpp[1] + 170])
add_node('Image Cards', 'n8n-nodes-base.code', 2, {'jsCode': rd46('code/Image_Cards.js')}, [_bpp[0] + 340, _bpp[1] + 170])
add_node('Render Images', 'n8n-nodes-base.httpRequest', 4.5,
         {'method': 'POST', 'url': 'http://gotenberg:3000/forms/chromium/screenshot/html', 'sendBody': True, 'contentType': 'multipart-form-data',
          'bodyParameters': {'parameters': [{'parameterType': 'formBinaryData', 'name': 'files', 'inputDataFieldName': 'html'},
                                            {'name': 'format', 'value': 'webp'},
                                            {'name': 'width', 'value': '={{ $json.width }}'},
                                            {'name': 'height', 'value': '={{ $json.height }}'},
                                            {'name': 'clip', 'value': 'true'},
                                            {'name': 'optimizeForSpeed', 'value': 'true'},
                                            {'name': 'skipNetworkIdleEvent', 'value': 'true'}]},
          'options': {'timeout': 60000, 'response': {'response': {'responseFormat': 'file', 'outputPropertyName': 'image'}}}},
         [_bpp[0] + 510, _bpp[1] + 170], {'onError': 'continueRegularOutput', **retry_lint.RETRY})
add_node('Attach Images', 'n8n-nodes-base.code', 2, {'jsCode': rd46('code/Attach_Images.js')}, [_bpp[0] + 680, _bpp[1] + 170])
for _t in _bp_targets: disconnect('Blog Package', _t)
connect('Blog Package', 'Make Images?')
connect('Make Images?', 'Image Cards', 0)
connect('Image Cards', 'Render Images'); connect('Render Images', 'Attach Images')
for _t in _bp_targets:
    connect('Attach Images', _t)          # with images
    connect('Make Images?', _t, 1)        # a report-only run passes through untouched
# the images travel with everything else the customer gets: the e-mail, the API callback and the app's report files
_sr46 = nodes['Send Report']['parameters']['options']
assert _sr46['fileAttachments'] == "={{ ['pdf', 'data', 'article_html', 'article_md', 'meta_json'].filter(k => $binary[k]).join(',') }}", 'Send Report: unexpected attachment list'
_sr46['fileAttachments'] = "={{ ['pdf', 'data', 'article_html', 'article_md', 'meta_json'].concat(Object.keys($binary).filter(k => /^image_\\d+$/.test(k)).sort()).filter(k => $binary[k]).join(',') }}"
patch('Build Webhook Response', """const docData = bin ? await b64('data', bin) : null;""",
      """const docData = bin ? await b64('data', bin) : null;
// G30 (2026-10-13): the produced images (WebP cards built from this page) travel in the callback like the PDF; the app stores every
// embedded file of a callback and offers it for download next to the article.
const imgPlan = ((d.article_meta || {}).images) || [];
const images = [];
for (const k of Object.keys(item.binary || {}).filter(x => /^image_\\d+$/.test(x)).sort()) {
  const b = item.binary[k]; const data = await b64(k, b);
  const plan = imgPlan.find(p => p && p.binary_key === k) || {};
  if (data) images.push({ data, fileName: b.fileName || (k + '.webp'), mimeType: b.mimeType || 'image/webp',
    alt_text: plan.alt_text || '', caption: plan.caption || '', width: plan.width ?? null, height: plan.height ?? null, purpose: plan.purpose || '' });
}""")
patch('Build Webhook Response', "    meta: d.article_meta || null,", "    meta: d.article_meta || null,\n    images: images.length ? images : null,")
assert 'images.length ? images : null' in code('Build Webhook Response'), 'the callback carries no images (G30)'

url_lint.check({'nodes': list(nodes.values()), 'name': 'SEO Agent v4'})
retry_lint.check({'nodes': list(nodes.values()), 'name': 'SEO Agent v4'})
sticky("""### Original words, real images, a coverage target (G5 / G30 / G33, 2026-10-13)
**Originality (G5).** *Originality Check* sits between *Content QA* and *Needs Revision?* and measures the share of the draft's **8-word windows** that one single page also carries, against every competitor page this run read and the site's own pages it read. Over **`originality_max_overlap_pct` (15)** the quality check fails: the editor gets the passage quoted and the page named. The page being improved is exempt (a rewrite keeps its text); other inventory pages are reported as **duplicate targets** by title and slug.
**Images (G30).** *Image Cards* → *Render Images* (Gotenberg `/forms/chromium/screenshot/html`, local and free) → *Attach Images*: the hero and the two in-body figures are produced as **WebP** from the page's own content, under the planned file names, alt text and sizes, listed in `meta.json`, attached to the e-mail and sent in the callback. A card that cannot be rendered stays a plan with its reason.
**Coverage (G33).** The target is the **best** competitor's term coverage (clamped 60-90%), with its subtopics and depth: stated in the brief, scored in the quality check, reported with its basis.""",
    _bpp[0] + 150, _bpp[1] + 330, 940, 250, 4)
log('Original words, produced images and a coverage target from the best competitor (2026-10-13, FIX_PLAN G5 / G30 / G33): the new Originality Check node measures 8-word shingle overlap between the finished draft and every competitor page and own page the run read (v5/code/_shingle.js), fails the quality check over CONFIG.originality_max_overlap_pct (15) against any single page with the passage quoted and the source named, exempts the page the run is improving and reports the rest of the inventory as duplicate targets by title; Image Cards / Render Images / Attach Images produce the hero and the two in-body images as WebP cards from the page\'s own content through the local Gotenberg screenshot route (free, no API, no licence), attach them under the planned file names with the planned alt text and dimensions, list them in meta.json and in the callback and rewrite the publish checklist, while a failed render leaves the plan in place; and the coverage target is now the best competitor page\'s term coverage (v5/code/_coverage.js, clamped 60-90%) with its subtopics and depth, written into the brief by Parse Brief, scored by Content QA\'s 25 coverage points and reported with its basis in the report, meta.json and the app')
# 45. GOOGLE'S OWN VIEW OF EVERY KEY PAGE, AND A FIX THAT IS CHECKED IN DAYS (2026-10-13, system review FIX_PLAN.md G25 / G11)
#     G25 The audit asked Search Console's URL Inspection about 25 crawled pages and the weekly Site Tracker about 20 ladder pages, so most
#         of a site was never seen through Google's eyes and the reports said "sampled pages" without ever saying what the sample left out.
#         Google's quota is **2,000 inspections a day and 600 a minute per property** (developers.google.com/webmaster-tools/limits), which is
#         far more than these sites have pages. The audit now asks about up to PW.PER_AUDIT (100) of its indexable pages, the weekly run
#         rotates through every key page oldest-inspection-first within PW.PER_RUN (150) and stores each answer on the page's own
#         seo_page_watch row, and both report **per page**: index state, the canonical Google chose against the one the page names, the last
#         crawl, mobile usability and the rich results detected. What the budget did not reach, what failed and what access is missing is
#         printed as **"not checked"** with the reason - never as "fine" and never as "not indexed" (v5/code/_page_watch.js).
#     G11 The audit was the only thing that ever verified a fix, so a page that went noindex on the 3rd stayed broken until the 1st of the
#         next month. The new daily workflow **SEO Agent - Page Watch** (build_site_tracker.py) fetches each site's key pages raw every
#         morning and alerts the same day; marking a finding fixed in the app re-checks that finding on those pages within a day. Both
#         audit reports say so where the fix list starts, so nobody waits for the next audit to learn whether it worked.
# =============================================================================
import url_lint as _ul45
PAGE_WATCH_SRC = rd('code/_page_watch.js').rstrip('\n')

# ---- A. the audit asks about every important page it can, inside the quota, oldest first ----
setcode('GSC Audit Plan', PAGE_WATCH_SRC + '\n' + code('GSC Audit Plan'))
patch('GSC Audit Plan', """const sample = [...indexable].sort((a, b) => (isHome(b.url) - isHome(a.url)) || ((a.depth ?? 9) - (b.depth ?? 9)) || (b.inbound - a.inbound)).filter(p => { const k = key(inspectUrl(p)); if (seenInspect.has(k)) return false; seenInspect.add(k); return true; }).slice(0, 25);""",
      """// G25 (2026-10-13, FIX_PLAN): every indexable page is a candidate, ordered home page first, then click depth, then inbound links, and
// the run asks about as many as its share of Google's quota allows (2,000 URL inspections a day and 600 a minute per property). What the
// budget does not reach is carried as `inspect_budget.skipped` and printed as "not checked", never left silently out of a "sample".
const ranked = [...indexable].sort((a, b) => (isHome(b.url) - isHome(a.url)) || ((a.depth ?? 9) - (b.depth ?? 9)) || (b.inbound - a.inbound)).filter(p => { const k = key(inspectUrl(p)); if (seenInspect.has(k)) return false; seenInspect.add(k); return true; });
const inspectPlan = PW.inspectBudget(ranked.map((p, i) => ({ url: inspectUrl(p), weight: ranked.length - i })), PW.PER_AUDIT);
const sample = inspectPlan.take.map(p => p.url);
const inspect_budget = { note: inspectPlan.note, cap: inspectPlan.limit, quota: inspectPlan.quota, candidates: ranked.length, asked: sample.length,
  skipped: inspectPlan.skipped.slice(0, 25).map(p => p.url), skipped_total: inspectPlan.skipped.length };""")
patch('GSC Audit Plan', "pages: pages.map(p => ({ url: p.url, status: p.status, depth: p.depth, inbound: p.inbound, orphan: p.orphan, indexable: indexable.includes(p) })), sample: sample.map(inspectUrl),",
      "pages: pages.map(p => ({ url: p.url, status: p.status, depth: p.depth, inbound: p.inbound, orphan: p.orphan, indexable: indexable.includes(p) })), sample, inspect_budget,")

# a fresh audit's finding rows carry the re-check columns empty: the state belongs to the audit that is current, and the row keeps
# exactly the columns ladder_common.py defines (the Data Table node auto-maps every field it is given)
_fr45 = code('Finding Rows')
_FR_OLD = "affected_count: Number(f.affected_count) || 0, impact: Number(f.impact) || 0, impact_basis: String(f.impact_basis || '').slice(0, 400) }));"
assert _fr45.count(_FR_OLD) == 1, 'Finding Rows: the row shape moved'
_FR_NEW = ("affected_count: Number(f.affected_count) || 0, impact: Number(f.impact) || 0, impact_basis: String(f.impact_basis || '').slice(0, 400),\n"
           "  recheck_state: '', recheck_requested_at: '', recheck_at: '', recheck_rule: '', recheck_note: '' }));   // G11: filled when the owner marks it fixed and the daily watch answers")
setcode('Finding Rows', _fr45.replace(_FR_OLD, _FR_NEW))

# ---- B. what Google said per page, with mobile usability and what was not checked ----
setcode('GSC Audit Findings', PAGE_WATCH_SRC + '\n' + code('GSC Audit Findings'))
patch('GSC Audit Findings', """  const insp = (byKind.inspect || []).map(x => { const r = x.r || {}; const ir = (r.inspectionResult || {}).indexStatusResult || null; const rr = (r.inspectionResult || {}).richResultsResult || null;
    return { url: x.q.inspect_url, error: r.error ? gErr(r) : (ir ? null : 'no result'), verdict: ir ? ir.verdict || '' : '', coverage: ir ? ir.coverageState || '' : '', indexed: ir ? ir.verdict === 'PASS' : null, robots: ir ? ir.robotsTxtState || '' : '', last_crawl: ir ? ir.lastCrawlTime || '' : '', google_canonical: ir ? ir.googleCanonical || '' : '', user_canonical: ir ? ir.userCanonical || '' : '', rich: rr && rr.detectedItems ? rr.detectedItems.map(d => d.richResultType).filter(Boolean) : [] }; });""",
      """  // G25 (2026-10-13): one reading per inspected page — index state, the canonical Google chose, the last crawl, mobile usability and the
  // rich results — through the shared kit, which also classifies a permission error or an exhausted quota as "not checked" (never "not indexed").
  const insp = (byKind.inspect || []).map(x => { const o = PW.inspection(x.r || {});
    return { url: x.q.inspect_url, error: o.ok ? null : o.error, not_checked: o.not_checked || '', error_kind: o.error_kind || '', verdict: o.verdict, coverage: o.coverage,
      indexed: o.ok ? o.indexed : null, robots: o.robots, last_crawl: o.last_crawl, google_canonical: o.google_canonical, user_canonical: o.user_canonical,
      mobile_usable: o.mobile_usable, mobile_issues: o.mobile_issues, rich_verdict: o.rich_verdict, rich: o.rich_results }; });""")
patch('GSC Audit Findings', """    const rich = [...new Set(ok.flatMap(i => i.rich))]; search_console.rich_results = rich; if (rich.length) works.push('Google detects rich results on sampled pages: ' + rich.join(', '));
    const errCount = insp.length - ok.length; if (errCount) search_console.inspection_errors = errCount;""",
      """    const rich = [...new Set(ok.flatMap(i => i.rich))]; search_console.rich_results = rich; if (rich.length) works.push('Google detects rich results on sampled pages: ' + rich.join(', '));
    const errCount = insp.length - ok.length; if (errCount) search_console.inspection_errors = errCount;
    // G25: mobile-first indexing has been complete since 2024-07-05, so a page Google calls not mobile-usable is a real ranking problem
    const mobBad = ok.filter(i => i.mobile_usable === false);
    if (mobBad.length) F('High', 'Pages Google reports as not mobile-friendly', 'Google indexes the mobile version of every page: what its phone crawler cannot use properly cannot rank well.', 'Fix the issues Search Console lists for these URLs (viewport, text size, tap targets, content wider than the screen), then re-inspect them.', mobBad.slice(0, 3).map(i => path(i.url) + ': ' + (i.mobile_issues || []).slice(0, 2).join('; ')).join(' | ').slice(0, 300), mobBad.map(i => i.url), mobBad.length, Math.round(mobBad.length / ok.length * 100));
    else if (ok.some(i => i.mobile_usable === true)) works.push('Google reports every inspected page as mobile-friendly');""")
patch('GSC Audit Findings', """  search_console.inspections = insp;""",
      """  search_console.inspections = insp;
  // G25: the index picture, with the pages the quota did not reach counted apart and named (PW.coverage never says "fine" about a page nobody asked about)
  const _ib = plan.inspect_budget || null;
  search_console.index_coverage = { ...PW.coverage(insp.map(i => ({ ok: !i.error, error: i.error || '', indexed: i.indexed, verdict: i.verdict, coverage: i.coverage,
      canonical_ok: (!i.google_canonical || !i.user_canonical) ? null : same(i.google_canonical, i.user_canonical), mobile_usable: i.mobile_usable, rich_results: i.rich, not_checked: i.not_checked || '' })),
      { not_checked: _ib ? _ib.skipped_total : 0, not_checked_reason: _ib && _ib.skipped_total ? 'the audit\\'s share of Google\\'s daily quota was used up; the weekly run inspects them, oldest first' : '', quota_note: _ib ? _ib.note : '' }),
    candidates: _ib ? _ib.candidates : insp.length, cap: _ib ? _ib.cap : null,
    pages: insp.filter(i => !i.error).slice(0, 100).map(i => ({ url: i.url, indexed: i.indexed, verdict: i.verdict, coverage: i.coverage, last_crawl: i.last_crawl,
      google_canonical: i.google_canonical, canonical_ok: (!i.google_canonical || !i.user_canonical) ? null : same(i.google_canonical, i.user_canonical), mobile_usable: i.mobile_usable, rich_results: i.rich })),
    not_checked_pages: [...insp.filter(i => i.error).map(i => ({ url: i.url, reason: i.not_checked || i.error })), ...((_ib && _ib.skipped) || []).map(u => ({ url: u, reason: 'not checked in this audit: the pages rotate through Google\\'s daily quota, oldest first' }))].slice(0, 25) };""")

# ---- C. both audit reports: the page-level index view, and the sentence about verification ----
IDX_SECTION_JS = r"""// ---- what Google says about each key page (G25, 2026-10-13) ----
const indexSection = (sc) => {
  const e3 = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const p3 = (u) => String(u || '').replace(/^https?:\/\/[^\/]+/, '') || '/';
  const ic = sc.index_coverage || null;
  if (!ic) return '';
  let h = `<h3>Google's index view of the key pages (URL Inspection)</h3><p>${e3(ic.text)}.</p>`;
  if ((ic.pages || []).length) {
    h += `<table class="ct"><tr><th>Page</th><th>In Google</th><th>State</th><th>Google's canonical</th><th>Last crawl</th><th>Mobile</th><th>Rich results</th></tr>`
      + ic.pages.slice(0, 25).map(p => `<tr><td>${e3(p3(p.url))}</td><td>${p.indexed === true ? '<span class="ok">yes</span>' : p.indexed === false ? '<span class="bad">no</span>' : '—'}</td><td>${e3(p.coverage || p.verdict || '—')}</td>`
        + `<td>${p.canonical_ok === false ? '<span class="bad">' + e3(p3(p.google_canonical)) + '</span>' : p.canonical_ok === true ? 'same as ours' : '—'}</td>`
        + `<td>${e3(String(p.last_crawl || '').slice(0, 10) || '—')}</td><td>${p.mobile_usable === true ? 'ok' : p.mobile_usable === false ? '<span class="bad">issues</span>' : '—'}</td>`
        + `<td>${e3((p.rich_results || []).join(', ') || '—')}</td></tr>`).join('') + `</table>`;
    if (ic.pages.length > 25) h += `<p class="small">${ic.pages.length - 25} more inspected pages are in the data behind this report.</p>`;
  }
  if ((ic.not_checked_pages || []).length) h += `<p class="small"><b>Not checked (${ic.not_checked}):</b> ` + ic.not_checked_pages.slice(0, 8).map(x => e3(p3(x.url))).join(', ')
    + (ic.not_checked_pages.length > 8 ? ' …' : '') + ` — ${e3(ic.not_checked_reason || ic.not_checked_pages[0].reason)}. Nothing is claimed about these pages.</p>`;
  if (ic.quota_note) h += `<p class="small">${e3(ic.quota_note)}</p>`;
  return h;
};
// ---- how a fix is verified (G11, 2026-10-13) ----
const fixWatchNote = () => `<p class="small"><b>After you fix something:</b> mark it done in the dashboard and the daily key-page watch re-checks that exact item on your key pages within a day (status, noindex, canonical, title, robots.txt) and shows the result — it does not wait for the next monthly audit.</p>`;
"""
_IDX_OLD = """    const covRows = Object.entries(sc.coverage || {});
    if (covRows.length) h += `<p>Index coverage of ${n2((sc.inspections || []).length)} sampled pages: ` + covRows.map(([k, v]) => `${n2(v)} × ${e2(k)}`).join(', ') + ((sc.rich_results || []).length ? `. Rich results detected: ${e2(sc.rich_results.join(', '))}` : '') + `.</p>`;"""
_IDX_NEW = """    const covRows = Object.entries(sc.coverage || {});
    if (covRows.length) h += `<p>Index coverage of ${n2((sc.inspections || []).length)} inspected pages: ` + covRows.map(([k, v]) => `${n2(v)} × ${e2(k)}`).join(', ') + ((sc.rich_results || []).length ? `. Rich results detected: ${e2(sc.rich_results.join(', '))}` : '') + `.</p>`;
    h += indexSection(sc);   // G25: page by page — in Google's index, the canonical it chose, its last crawl, mobile usability, rich results"""
for _rn45 in ('Build Audit Report', 'Build Full Report'):
    patch(_rn45, "const findings = a.findings || [];", IDX_SECTION_JS + "const findings = a.findings || [];")
    patch(_rn45, _IDX_OLD, _IDX_NEW)
    patch(_rn45, "'<h3>Fix These First</h3>' + prioNote(a) + '<ol>'", "'<h3>Fix These First</h3>' + prioNote(a) + fixWatchNote() + '<ol>'")
# the app's technical page reads the same picture from the callback
patch('Build Audit Response', "coverage: d.search_console.coverage, not_indexed: d.search_console.not_indexed,",
      "coverage: d.search_console.coverage, index_coverage: d.search_console.index_coverage || null, not_indexed: d.search_console.not_indexed,")

# harness shim (S53): the kit as a runnable script — one item in, one answer out
os.makedirs(OUT_CODE, exist_ok=True)
open(os.path.join(OUT_CODE, '_page_watch.js'), 'w').write(
    "// harness shim (written by build_v4.py section 45): the page-watch kit - { res?, robots_res?, prev?, now?, finding?, pages?, pages_budget?, cap?, inspection? }\n"
    "// -> the signals of one fetch, the robots.txt reading, the changes against the stored row, a finding re-check, the inspection budget and one inspection answer\n"
    + PAGE_WATCH_SRC +
    "\nreturn $input.all().map(i => { const j = i.json || {};\n"
    "  const rb = j.robots_res === undefined ? null : PW.robotsRead(j.robots_res);\n"
    "  const sig = j.res === undefined ? null : PW.signals(j.res);\n"
    "  const now = j.now === undefined ? sig : j.now;\n"
    "  return { json: { signals: sig, robots: rb ? { ok: rb.ok, status: rb.status, hash: rb.hash, length: rb.length, error: rb.error, rules: rb.rules,\n"
    "      blocks: (j.block_urls || []).map(u => ({ url: u, blocked: rb.blocks ? rb.blocks(u) : null })) } : null,\n"
    "    robots_change: j.prev_hash === undefined ? null : PW.robotsChange(j.prev_hash, rb || j.robots || null),\n"
    "    changes: now === null ? [] : PW.compare(j.prev === undefined ? null : j.prev, now, { url: j.url, robots_blocked: j.robots_blocked, robots_blocked_before: j.robots_blocked_before }),\n"
    "    state: now === null ? '' : PW.state(PW.compare(j.prev === undefined ? null : j.prev, now, { url: j.url, robots_blocked: j.robots_blocked, robots_blocked_before: j.robots_blocked_before }), now),\n"
    "    recheck: j.finding === undefined ? null : PW.recheck(j.finding, j.pages || []),\n"
    "    rule: j.finding === undefined ? null : (PW.recheckRule(j.finding) || {}).rule || '',\n"
    "    budget: j.pages_budget === undefined ? null : (() => { const b = PW.inspectBudget(j.pages_budget, j.cap, { used: j.used }); return { take: b.take.map(p => p.url), skipped: b.skipped.map(p => p.url), limit: b.limit, quota: b.quota, note: b.note }; })(),\n"
    "    inspection: j.inspection === undefined ? null : PW.inspection(j.inspection),\n"
    "    coverage: j.inspections === undefined ? null : PW.coverage(j.inspections, j.coverage_opts || {}),\n"
    "    hash: j.hash_text === undefined ? '' : PW.hash(j.hash_text), limits: { quota: PW.QUOTA_PER_DAY, per_minute: PW.QUOTA_PER_MINUTE, per_run: PW.PER_RUN, per_audit: PW.PER_AUDIT } } }; });\n")

# ---- D. the asserts and the notes ----
for _n45 in ('GSC Audit Plan', 'GSC Audit Findings'):
    assert 'const PW = (() => {' in code(_n45), _n45 + ': the page-watch kit is not inlined'
assert 'PW.inspectBudget(' in code('GSC Audit Plan'), 'G25: the audit does not budget its inspections'
assert 'index_coverage' in code('GSC Audit Findings') and 'mobile_usable' in code('GSC Audit Findings'), 'G25: the audit does not report Google\'s view per page'
for _n45 in ('Build Audit Report', 'Build Full Report'):
    assert 'indexSection(sc)' in code(_n45) and 'fixWatchNote()' in code(_n45), _n45 + ': the index view or the verification note is missing'
_ul45.check({'nodes': list(nodes.values()), 'name': 'SEO Agent v4'})
_gp45 = pos('GSC Audit Plan')
sticky("""### Google's own view of every key page, and a fix checked in days (G25 / G11, 2026-10-13)
**URL Inspection within the quota:** Google allows **2,000 inspections a day and 600 a minute per property**. The audit asks about up to **100** of its indexable pages (home page first, then click depth, then inbound links) and the weekly Site Tracker rotates through **every** key page, **oldest inspection first**, up to 150 a run — each answer stored on the page's row in `seo_page_watch`, which is what makes the rotation possible. Both reports print, per page: in Google's index or not, the state, **the canonical Google chose** against ours, the last crawl, **mobile usability** and the rich results. Whatever the budget did not reach, whatever failed and missing access are printed as **"not checked"** with the reason — never as "fine", never as "not indexed" (`v5/code/_page_watch.js`).
**Checked in days, not months:** the daily **SEO Agent — Page Watch** (05:45, free: one GET per key page + robots.txt) alerts on a page gone, a `noindex`, a moved canonical, a changed title or a changed robots.txt the same day, and re-checks any finding the owner marks as fixed on those pages within a day. Both audit reports say so where the fix list starts.""",
    _gp45[0] - 40, _gp45[1] - 420, 1180, 320, 5)
log('Google\'s own view of every key page, inside the quota (2026-10-13, FIX_PLAN G25): the audit inspects up to 100 of its indexable pages and the weekly Site Tracker rotates through every key page oldest-inspection-first (up to 150 a run, stored per page in seo_page_watch) inside Google\'s 2,000-a-day / 600-a-minute URL Inspection quota; both reports print per page whether it is in Google\'s index, the canonical Google chose against ours, the last crawl, mobile usability (a new High finding when Google reports issues) and the rich results, and everything the budget, a failure or missing access left out is printed as "not checked" with its reason instead of being hidden inside the word "sample"')
log('A daily key-page watch and a fix re-checked in days (2026-10-13, FIX_PLAN G11): the new workflow SEO Agent — Page Watch (build_site_tracker.py, every morning 05:45, free — one plain GET per key page plus robots.txt, max 25 pages a site) compares status, a redirect that appeared, noindex, the canonical, the title and the robots.txt fingerprint (seo_cache `watch:<site_id>`) with the stored reading and alerts the same day in seo_console_alerts plus, for the serious ones, seo_ops_alerts and the alert webhook (D25b\'s path, deduped); a failed fetch is "not checked" and never overwrites the stored reading; "I fixed this" in the app marks the finding (seo_audit_findings.recheck_state) and the next watch answers that one finding on those pages — fixed, still open, or not checkable without the full audit — and both audit reports say so where the fix list starts')

# =============================================================================
# 47. ANNOTATIONS, CHANGE TESTS AND LINEAGE ON EVERY NUMBER (2026-10-13, system review FIX_PLAN.md G12 + G29; criteria 3.4 / 3.5 /
#     2.12 / 3.11 in docs/system-review-2026-10-11/CRITERIA_technical_tracking_reporting_ai_links.md). Reporting scored 4.5/10 and
#     change tests scored 0:
#       * G12 annotations: a chart that falls in mid-September 2025 looks like a ranking disaster until you know that is the week
#         Google stopped serving 100 results on one page. Rank Ranger and Search Console both mark such events; we marked nothing.
#         `v5/data/seo_events.json` is now THE dated place for Google updates and data breaks — inlined into `_annotations.js` (the
#         marks), into `_site_stats.js` (the alert context G28 already printed) and written out as
#         `app/shared/src/seo-events.generated.ts` for the app's charts, so engine and dashboards mark the same dates. AN.marks()
#         computes a mark per published page (seo_content_log.published_at), per technical audit with the findings it cleared
#         (seo_audits), and per registry event overlapping the window; a date with no event produces nothing.
#       * G12 change tests: the Link Builder measured what a won link did against a control group of the site's other pages. That
#         comparison is now `_change_test.js` (CT) and measures a PAGE CHANGE the same way — LB Assemble writes `kind: page_change`
#         rows into seo_link_impact from the content log's publish dates, and the Link Builder report reads them under "What your
#         page changes did". Verdicts stay graded and weak: likely helped / possibly helped / no clear effect yet / too early to
#         tell / can't tell. Nothing says a change caused a move.
#       * G29 lineage: the AI-visibility report stated its sample sizes and ranges; everywhere else "1,240 impressions" and "#8" sat
#         side by side with no hint that one is a 28-day Google count and the other one live sample. `_lineage.js` (LN) carries
#         source / period / sample / basis as structured fields beside every figure group, renders one short note under the figures
#         and a "Where these numbers come from" table at the end of the weekly, AI-visibility, AI-growth, backlink, link-building,
#         rank-tracker, ladder-plan and full reports, and travels in the callbacks so the app shows the same words. The vocabulary is
#         the one already in use (G6 "modelled, not measured", G8 calibrated / modelled / unknown, G28 ranges, G26 impact_basis).
#         Where lineage is genuinely unknown the note reads "source not recorded" — never a borrowed source.
# =============================================================================
LINEAGE_SRC47 = seo_events.LINEAGE_SRC
# ---------- A. the full SEO report: a figure-level lineage table before the methodology section ----
setcode('Build Full Report', LINEAGE_SRC47 + '\n' + code('Build Full Report'))
_LIN47 = """// G29 (2026-10-13): every figure group of this report with its source, period and sample (LN, v5/code/_lineage.js)
const _sc47 = a.search_console || {};
const lineage = [
  LN.of('Health score and the findings', 'crawl', { basis: 'modelled', period: LN.asOf(a.audited_at || today), sample: LN.sample(a.pages_crawled, 'pages crawled'),
    note: 'our own 0-100 score: points off per finding by severity (the table below), not a Google figure' }),
  _sc47.connected
    ? LN.of('Clicks, impressions and index coverage', 'gsc', { basis: 'measured', period: 'the last 28 days', sample: LN.sample((_sc47.totals || {}).impressions, 'impressions'), note: 'property ' + String(_sc47.property || '') })
    : LN.unknown('Clicks, impressions and index coverage', String(_sc47.error || 'Search Console is not connected for this site')),
  LN.of('Searches per month, difficulty, cost per click and traffic estimates', 'kwdata', { basis: 'estimated', period: 'the provider\\'s latest 12-month average',
    sample: LN.sample((a.keyword_ideas || a.keywords || []).length, 'keywords'), note: 'provider estimates for ' + String(d.country || '') + ', not measurements of your site' }),
  LN.of('Backlinks and referring domains', 'backlink_index', { basis: 'reported', period: LN.asOf(today), sample: LN.sample((a.backlinks || {}).referring_domains, 'referring domains'),
    note: 'one crawler\\'s index of the web: it finds much of the web, never all of it' }),
  LN.of('Core Web Vitals (real users)', 'crux', { basis: 'measured', period: 'the last 28 days of Chrome visits', sample: 'all Chrome visitors Google could aggregate',
    note: 'where a page or template has too few visits the report says so instead of showing a figure' }),
  LN.of('Lighthouse scores and speed savings', 'pagespeed', { basis: 'one_sample', period: LN.asOf(today), sample: 'one simulated mobile load per page tested' }),
  LN.of('Domain age', 'rdap', { basis: 'reported', period: LN.asOf(today), sample: LN.sample(((a.domain_ages || {}).rows || []).length || undefined, 'domains looked up'), note: 'the registry record, cached for a year' }),
];
html += '<h2 class="pb">' + '16a. Where these numbers come from</h2>'
  + '<table class="ct"><tr><th>Figure</th><th>Source</th><th>Period</th><th>Sample</th><th>How it was arrived at</th></tr>'
  + lineage.map(l => '<tr><td>' + esc(l.figure) + '</td><td>' + esc(l.source_label) + '</td><td>' + esc(l.period || '—') + '</td><td>' + esc(l.sample || '—') + '</td><td>' + esc([l.basis_label, l.note].filter(Boolean).join(' — ')) + '</td></tr>').join('')
  + '</table><p class="small">A figure marked "modelled, not measured" is computed, not counted; "source not recorded" means the figure reached this report without its source and should be treated as unverified.</p>';
"""
patch('Build Full Report', '// ---------- 16. Methodology ----------', _LIN47 + '// ---------- 16. Methodology ----------')
patch('Build Full Report', "    health_score: a.health_score,", "    health_score: a.health_score,\n    lineage,")
assert 'const LN = (() => {' in code('Build Full Report') and 'Where these numbers come from' in code('Build Full Report'), 'G29: the full report has no lineage'
# ---------- B. nothing left unresolved, and the kits really reached the nodes that ask for them ----------
for _m47 in ('/*__LINEAGE__*/', '/*__ANNOTATIONS__*/', '/*__CHANGE_TEST__*/', '/*__SEO_EVENTS__*/', '/*__GOOGLE_UPDATES__*/'):
    assert not any(_m47 in n['parameters'].get('jsCode', '') for n in nodes.values()), 'G12 / G29: placeholder left: ' + _m47
assert 'const LN = (() => {' in code('Build Ladder Report') and 'Where these numbers come from' in code('Build Ladder Report'), 'G29: the ladder plan has no lineage'
# ---------- C. harness shims (S56): each kit as a runnable script, one call per item ----------
os.makedirs(OUT_CODE, exist_ok=True)
open(os.path.join(OUT_CODE, '_lineage.js'), 'w').write(
    "// harness shim (written by build_v4.py section 47): the lineage kit — { figure, source, period, sample, basis, note } -> the structured fields, the one-line note and the report block\n"
    + LINEAGE_SRC47 + "\nreturn $input.all().map(i => { const j = i.json || {};\n"
    "  const l = j.unknown ? LN.unknown(j.figure, j.why) : LN.of(j.figure, j.source, j);\n"
    "  return { json: { ...l, line: LN.note(l), html: LN.html(l), block: LN.block([l]), sources: Object.keys(LN.SOURCES), bases: Object.keys(LN.BASIS), missing: LN.MISSING,\n"
    "    range: j.range === undefined ? null : LN.range(j.range), as_of: j.as_of === undefined ? null : LN.asOf(j.as_of), sample_text: j.sample_n === undefined ? null : LN.sample(j.sample_n, j.sample_unit) } }; });\n")
open(os.path.join(OUT_CODE, '_annotations.js'), 'w').write(
    "// harness shim (written by build_v4.py section 47): the annotation kit — { from, to, published, audits, links } -> the dated marks of that window\n"
    + seo_events.ANNOTATIONS_SRC + "\nreturn $input.all().map(i => { const j = i.json || {}; const marks = AN.marks(j);\n"
    "  return { json: { marks, html: AN.html(marks), breaks: AN.breakBetween(j.from, j.to), updates: AN.UPDATES, data_breaks: AN.BREAKS, registry_updated: AN.EVENTS.updated } }; });\n")
open(os.path.join(OUT_CODE, '_change_test.js'), 'w').write(
    "// harness shim (written by build_v4.py section 47): the change test — { weeks, base, now, others, joint, kind } -> the control-group reading and its graded verdict\n"
    + seo_events.CHANGE_TEST_SRC + "\nreturn $input.all().map(i => { const j = i.json || {};\n"
    "  return { json: { ...CT.compare(j), labels: CT.LABELS, method: CT.method, min_weeks: CT.MIN_WEEKS, min_others: CT.MIN_OTHERS } }; });\n")
# ---------- D. the same dated registry for the app's charts (generated, committed) ----------
seo_events.write_app_ts()
sticky("""### Annotations, change tests and lineage (G12 + G29)
**Every chart is marked** with what happened: pages that went live (`seo_content_log.published_at`), technical audits with the findings they cleared (`seo_audits`), **Google updates** and **data breaks** (the num=100 break of September 2025) — from one dated file, `v5/data/seo_events.json`, inlined into `_annotations.js`, `_site_stats.js` and the app (`seo-events.generated.ts`). Add an update there and rebuild; a date with no event produces no mark.
**A page change is read like a won link**: `_change_test.js` (CT) compares the page's own move with the site's **other pages** over the same weeks (`seo_link_impact`, `kind: page_change`). Verdicts stay graded — *likely helped · possibly helped · no clear effect yet · too early to tell · can't tell* — and nothing ever says a change **caused** a move.
**Every figure carries its lineage** (`_lineage.js`): source, period, sample and how it was arrived at, as fields beside the value, one short note under the figures and a **"Where these numbers come from"** table in the weekly, AI-visibility, AI-growth, backlink, link-building, rank-tracker, ladder-plan and full reports. Modelled numbers say so; where the source was never recorded it reads **"source not recorded"**.""",
    pos('Build Full Report')[0] - 40, pos('Build Full Report')[1] + 360, 1180, 280, 4)
log('Annotations, change tests and lineage on every number (2026-10-13, FIX_PLAN G12 + G29; criteria 3.4 / 3.5 / 2.12 / 3.11): one dated event registry (v5/data/seo_events.json) feeds the chart marks (v5/code/_annotations.js: published pages from seo_content_log, audit fixes from seo_audits, Google updates and the September 2025 num=100 data break), the G28 alert context (_site_stats.js) and the app (app/shared/src/seo-events.generated.ts); the Link Builder\'s control-group impact became the shared change test (v5/code/_change_test.js) and now also reads what a PAGE CHANGE did (seo_link_impact kind=page_change + change columns, "What your page changes did" in the Link Builder report) with graded verdicts and no causal wording; and every figure group in the weekly, AI-visibility, AI-growth, backlink, link-building, rank-tracker, ladder-plan and full reports carries its source, period, sample and basis (v5/code/_lineage.js) inline and in a "Where these numbers come from" table, with "source not recorded" where the lineage is genuinely unknown')

# =============================================================================
# 48. WHAT THE RE-RATING RUN FOUND (R1 … R9, 2026-10-13; docs/system-review-2026-10-13/RESULTS.md §3.2).
#     R1 (High) a page run the day's AI budget guard refused left its seo_ladders row saying "writing", and within 90 seconds the ladder plan
#         promised the page, the Rank Tracker said "already written — publish it" and the Content Cadence counted it among 6 pages waiting and
#         paused the site (exec 500, row 19 "service industry erp software"). The refusal path now sets the row back to `planned` with the
#         reason (*Refused Ladder Row* -> *Release Ladder Row*), the plan says "started now" instead of promising a delivered page, and the
#         cadence / Rank Tracker / Site Tracker count a page as written only when seo_content_log says `written`.
#         fix_phantom_pages.py repairs the rows left from before this fix (--dry-run by default).
#     R2  *Audit Diff* filtered only the PREVIOUS findings through the categories the audit type scores, so a Schema finding — which a
#         technical audit declares "not assessed" — was reported **new** at every audit and never moved the score (exec 513 vs 497).
#     R3  the Keyword Check's topic fit failed twice on "business central partner uae" and shipped `fit: null` with the money spent.
#     R4  the Link Builder's competitor gate read only the prospect's page, so flick.network (#1 for the ladder head that same run) passed.
#     R5  the Error Handler could not read a trigger-mode failure: node, message and execution were all lost (exec 516).
#     R6  no ops alert had ever recorded a delivery: all three rows sat at `delivered: pending`, two of them already accepted by Gmail.
#     R7  the verdict and the ladder still asked for FAQPage schema, which G2 removed from everything we write.
#     R8  rung pages carried `target_words: 0`, so P2-7's clamp protected only the page the verdict measured.
#     R9  the ledger counted Claude money only and knew nothing of the schedules: the monitors now reserve and settle their own rows
#         (build_monitors.py / build_site_tracker.py / build_ladder_extras.py) and every row carries a DataForSEO estimate — the audits
#         carried est_usd 0 although each crawl cost $0.09.
#     Also: the guard's refusal text shown in the app was developer language ("Raise ai_budget_usd in Normalize Input").
# =============================================================================
# ---- R1: a refused ladder page run gives its row back ----
_r48 = pos('Refused Input')
add_node('Refused Ladder Row', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Refused_Ladder_Row.js')}, [_r48[0] + 220, _r48[1] + 200])
if_node('Ladder Row To Reset?', "{{ !$json.skip }}", [_r48[0] + 440, _r48[1] + 200])
add_node('Release Ladder Row', DT_TYPE, DT_VERSION, dt_update_params(LADDER_TABLE, LADDER_COLS,
    [('ladder_id', '={{ $json.ladder_id }}'), ('keyword', '={{ $json.keyword }}')], {'status': '={{ $json.status }}', 'status_note': '={{ $json.status_note }}'}),
    [_r48[0] + 660, _r48[1] + 200], {'onError': 'continueRegularOutput', 'alwaysOutputData': True})
connect('Refused Input', 'Refused Ladder Row'); connect('Refused Ladder Row', 'Ladder Row To Reset?'); connect('Ladder Row To Reset?', 'Release Ladder Row', 0)
assert [t['node'] for t in conns['Refused Input']['main'][0]] == ['Error Via API?', 'Refused Ladder Row'], conns['Refused Input']['main'][0]
# the cadence mark clears an earlier refusal note (one source: v5/code/Ladder_Marks.js writes status_note: '')
assert "status_note: ''" in rd('code/Ladder_Marks.js') and 'status_note' in rd('code/Ladder_Rows.js'), 'R1: the ladder rows carry no status_note'
assert ('status_note', 'string') in LADDER_COLS, 'R1: seo_ladders has no status_note column (run sync_tables.py after deploying)'

# the harness reads the wiring (S57): the refusal path really reaches the seo_ladders update, on ladder_id + keyword
_lw48p = os.path.join(HERE0, 'harness', 'ledger_wiring.json')
_lw48 = json.load(open(_lw48p)) if os.path.exists(_lw48p) else {}
_rlr48 = nodes['Release Ladder Row']['parameters']
_lw48['ladder_release'] = {'from': 'Refused Input', 'code': 'Refused Ladder Row', 'gate': 'Ladder Row To Reset?', 'update': 'Release Ladder Row',
                           'table': LADDER_TABLE, 'conditions': [c['keyName'] for c in _rlr48['filters']['conditions']],
                           'values': sorted(_rlr48['columns']['value'].keys())}
json.dump(_lw48, open(_lw48p, 'w'), indent=1, sort_keys=True)

# ---- R9: every ledger row carries this run's DataForSEO estimate, beside the Claude one ----
DFS_EST_JS = """

// ---- estimated DataForSEO spend (R9, 2026-10-13) ----
// The ledger counted Claude money only: both technical audits of the re-rating run carried est_usd 0 although each 200-page crawl cost $0.09
// measured, and nothing recorded what a run spends at DataForSEO. Measured on techand.ai (2026-10-11 and 2026-10-13): a 200-page crawl $0.09,
// a full report about $1.00 (crawl + Labs + competitors + domain ages), a content run $0.08, a verdict $0.06, discovery $0.15, a ladder $0.12,
// an on-demand AI check $0.60, a paid backlink check $0.50 (free_only: nothing). `ai_budget_usd` still guards Claude money only — this is
// carried on the row, settled with the measured run_ledger.dataforseo_usd and reported, so the real spend per day is finally countable.
const DFS_EST = { crawl: 0.09, full: 1.0, content: 0.08, verdict: 0.06, discover: 0.15, ladder: 0.12, ai_visibility: 0.6, backlinks: 0.5 };
let dfs_est = 0;
if (d.mode === 'audit') dfs_est = d.include_full_report ? DFS_EST.full : DFS_EST.crawl;
else if (d.mode === 'discover') dfs_est = DFS_EST.discover + (d.include_full_report ? DFS_EST.full : 0);
else if (d.mode === 'keyword') dfs_est = d.verdict_only ? DFS_EST.verdict : DFS_EST.content;
else if (d.mode === 'ladder') dfs_est = DFS_EST.ladder;
else if (d.mode === 'ai_visibility') dfs_est = DFS_EST.ai_visibility;
else if (d.mode === 'backlinks') dfs_est = d.free_only ? 0 : DFS_EST.backlinks;
dfs_est = +Number(dfs_est).toFixed(4);
"""
for _n48 in ('Rate Limit', 'Run Ledger Row'):
    patch(_n48, "if (d.need_site_description) est += EST.describe;\n", "if (d.need_site_description) est += EST.describe;\n" + DFS_EST_JS)
# the row's keys stay in the table's own order (the harness compares them with table_cols.json)
# the new columns go at the end, so the row's keys stay in seo_run_ledger's own order (the harness compares them with table_cols.json)
patch('Run Ledger Row', "  domain: String(d.domain || '').toLowerCase(), heavy } }];", "  domain: String(d.domain || '').toLowerCase(), heavy, dfs_est_usd: dfs_est, dfs_usd: 0 } }];")
# the period's DataForSEO estimate travels with the run (the reports and the app show what a day really costs)
patch('Rate Limit', "d.ai_spend_estimate_usd = est;", "d.ai_spend_estimate_usd = est;\nd.dfs_spend_estimate_usd = dfs_est;\nd.dfs_budget_used_est_usd = +(earlier.filter(r => String(r.created_at || '').startsWith(period)).reduce((s, r) => s + (Number(r.dfs_usd) || Number(r.dfs_est_usd) || 0), 0) + dfs_est).toFixed(2);")
nodes['Settle Run Ledger']['parameters']['columns']['value']['dfs_usd'] = "={{ Number($('Run Ledger Row').first().json.dfs_est_usd) || 0 }}"
assert 'dfs_est_usd' in code('Run Ledger Row') and 'dfs_usd' in nodes['Settle Run Ledger']['parameters']['columns']['value'], 'R9: the DataForSEO estimate is not on the ledger row'
assert 'dfs_est_usd' in rd('code/Assess_Ledger_Row.js'), "R9: the Keyword Check's reservation has no DataForSEO estimate"
assert ('dfs_est_usd', 'number') in RUN_LEDGER_COLS and ('dfs_usd', 'number') in RUN_LEDGER_COLS, 'R9: seo_run_ledger has no DataForSEO columns'

# ---- the refusal the customer reads (RESULTS §3.2, "also seen") ----
patch('Rate Limit', "Raise ai_budget_usd in Normalize Input when you are ready to continue.' } }];",
      "Nothing was charged and nothing was started: this analysis can run again ' + (d.ai_budget_period === 'day' ? 'tomorrow' : 'next month') + ', or the daily limit for this website can be raised first.' } }];")
assert 'ai_budget_usd in Normalize Input' not in code('Rate Limit'), 'the refusal still speaks to developers'

# ---- R2: the diff's summary ends in one full stop ----
patch('Build Audit Report', "${e2(D.summary)}.</p>`;", "${e2(D.summary).replace(/\\.$/, '')}.</p>`;")
patch('Build Full Report', "${e2(D.summary)}.</p>`;", "${e2(D.summary).replace(/\\.$/, '')}.</p>`;")
assert 'const inScope = (f) =>' in code('Audit Diff') and '.filter(inScope);' in code('Audit Diff'), 'R2: the current findings are not filtered through the audit type\'s categories'
assert 'not_compared' in code('Audit Diff'), 'R2: the diff does not say which categories it did not compare'

# ---- R6: the delivery result goes back on the alert row ----
_eh_add('Alert Delivery', 'n8n-nodes-base.code', 2, {'jsCode': _eh_src('code/Alert_Delivery.js')}, [2020, _EHY])
_eh_add('Save Alert Delivery', DT_TYPE, DT_VERSION, dt_update_params(OPS_ALERTS_TABLE, OPS_ALERTS_COLS, [('alert_key', '={{ $json.alert_key }}')],
    {'delivered': '={{ $json.delivered }}', 'channels': '={{ $json.channels }}', 'notes': '={{ $json.notes }}'}), [2240, _EHY],
    {'onError': 'continueRegularOutput', 'alwaysOutputData': True})
# every path through the two channel gates reaches it, so a row never stays "pending" for a delivery that can never come. It may run more
# than once (one branch each); data only accumulates inside an execution, so the last run is the one that saw both channels.
for _a48, _b48, _o48x in [('Post Alert Webhook', 'Alert Delivery', 0), ('Send Webhook?', 'Alert Delivery', 1),
                          ('Email Ops', 'Alert Delivery', 0), ('Send Email?', 'Alert Delivery', 1), ('Alert Delivery', 'Save Alert Delivery', 0)]:
    _eh_link(_a48, _b48, _o48x)
assert 'R5' in _ehn['Format Alert']['parameters']['jsCode'] and 'tr.error' in _ehn['Format Alert']['parameters']['jsCode'], 'R5: Format Alert cannot read a trigger-mode failure'
_ehwf['nodes'] = list(_ehn.values())
_ehnames48 = set(_ehn)
for _s48, _o48 in _ehc.items():
    assert _s48 in _ehnames48, _s48
    for _l48 in _o48.get('main', []):
        for _t48 in _l48: assert _t48['node'] in _ehnames48, _t48['node']
_rl41.check(_ehwf, _ehwf.get('name') or 'SEO Agent — Error Handler')
_ul41.check(_ehwf, _ehwf.get('name') or 'SEO Agent — Error Handler')
json.dump(_ehw41, open(_eh41, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
for _n48 in _ehwf['nodes']:
    if _n48['type'] == 'n8n-nodes-base.code':
        open(os.path.join(OUT_CODE, 'EH__' + re.sub(r'[^A-Za-z0-9_.-]+', '_', _n48['name']) + '.js'), 'w').write(_n48['parameters']['jsCode'])
open(os.path.join(OUT_CODE, 'EH__Alert_Delivery_Webhook.js'), 'w').write(
    rd('code/Alert_Delivery.js').replace('/*__OPS_ALERT__*/', OPS_ALERT_SRC).replace('__ALERT_WEBHOOK_URL__', 'https://hooks.example.test/seo-agent-alerts').replace('__OPS_EMAIL__', OPS_EMAIL))
_ops48 = json.load(open(os.path.join(HERE0, 'harness', 'ops_alert_wiring.json')))
_ops48['nodes'] = [_n48['name'] for _n48 in _ehwf['nodes'] if _n48['type'] != 'n8n-nodes-base.stickyNote']
_ops48['connections'] = {_s48: [[_t48['node'] for _t48 in _l48] for _l48 in _o48.get('main', [])] for _s48, _o48 in _ehc.items()}
_ops48['delivery'] = {'code': 'Alert Delivery', 'row_update': 'Save Alert Delivery', 'writes': ['delivered', 'channels', 'notes'],
                      'from': sorted(_s48 for _s48, _o48 in _ehc.items() for _l48 in _o48.get('main', []) for _t48 in _l48 if _t48['node'] == 'Alert Delivery')}
json.dump(_ops48, open(os.path.join(HERE0, 'harness', 'ops_alert_wiring.json'), 'w'), indent=1, sort_keys=True)

# ---- R4: the competitor gate as a runnable shim (S57): one item in, the refusal and the rival it matched out ----
open(os.path.join(OUT_CODE, '_outreach_gate.js'), 'w').write(
    "// harness shim (written by build_v4.py section 48, R4): the Link Builder's competitor gate - { type, domain, competitors, serp_rivals, title, text, terms } -> the refusal and the rival it matched\n"
    + LK_SRC + '\n' + OK_SRC + "\nreturn $input.all().map(i => { const j = i.json || {}; return { json: { refusal: OK.sellsSame(j), rival: OK.rivalOf(j) } }; });\n")

# ---- R3 / R4 / R7 / R8: the asserts on the code and prompts the other builders and kits carry ----
assert 'FIT_UNKNOWN' in rd('code/Assess_Response.js') and 'plainRan' in rd('code/Assess_Response.js'), 'R3: an unknown fit is still only a warning'
assert 'rivalOf' in rd('code/_outreach_kit.js') and 'serp_rivals' in rd('code/LB_Plan.js') and 'serp_rivals: p.serp_rivals' in rd('code/LB_Assemble.js'), 'R4: the competitor gate does not see the SERP rivals'
_v48 = rd('prompts/verdict.txt')
assert 'Never ask for FAQ schema' in _v48 and all('Never ask for FAQ schema' in _l for _l in _v48.splitlines() if 'FAQPage' in _l), 'R7: verdict.txt may name FAQPage only in the line that forbids it'
assert 'noFaqSchema' in code('Parse Verdict'), 'R7: Parse Verdict does not strip FAQPage advice'
assert 'rungWordTarget' in code('Ladder Plan') and 'pg.target_words = rungWordTarget' in code('Ladder Plan'), 'R8: the rung pages carry no word target'
# R1's consumers: a page counts as written only when the content log says so
assert "l.status !== 'written'" in rd('code/Cadence_Plan.js') and 'writtenOf' in rd('code/Cadence_Plan.js'), 'R1: the cadence still counts unwritten pages'
assert 'writtenLog' in rd('code/Tracker_Report.js') and 'writtenKw' in rd('code/Site_Plan.js') and 'p.written' in rd('code/Site_Metrics.js'), 'R1: a tracker still reports an unwritten page'
_rr48 = pos('Release Ladder Row')
sticky("""### What the re-rating run found (R1 … R9, 2026-10-13)
**R1 (High):** a page run the day's AI budget refused left its `seo_ladders` row at **writing**, and the ladder plan, the Rank Tracker and the Content Cadence then all reported a page that does not exist (exec 500 / row 19). **Refused Ladder Row → Release Ladder Row** puts the row back to `planned` with the reason, the plan promises nothing before the run is accepted, and all three features count a page as written only when `seo_content_log` says **written**. `fix_phantom_pages.py` repairs the rows left from before (dry run by default).
**R9:** every scheduled run now reserves and settles its own `seo_run_ledger` row (AI Visibility, AI Pulse, AI Growth, Backlink Monitor, Audit Scheduler, Link Builder, Rank Tracker, Site Tracker, Content Cadence), and every row carries a **DataForSEO estimate** beside the Claude one — both audits used to carry `est_usd: 0` while each crawl cost $0.09.
**R2** same category set on both sides of the audit diff · **R3** the topic fit retries in plain text and an unknown fit is in the label · **R4** a prospect on a competitor's or a SERP rival's registrable domain is refused (a "best X" list still passes) · **R5** a trigger-mode failure keeps its node, message and workflow · **R6** `seo_ops_alerts.delivered` records the channel that carried the alert · **R7** an FAQ section, never FAQPage schema · **R8** a rung page gets its length from the pages that rank for its ladder.""",
    _rr48[0] - 120, _rr48[1] + 180, 1120, 260, 3)
log('What the re-rating run found (2026-10-13, R1 … R9): a budget-refused ladder page run sets its row back to planned with the reason (Refused Ladder Row -> Release Ladder Row) and the cadence, Rank Tracker and Site Tracker count a page as written only when seo_content_log says written, so no feature promises a page nobody wrote (R1, repair script fix_phantom_pages.py); the audit diff filters current and previous findings through the same category set and names what it did not compare, with Schema deliberately out of a technical audit\'s weights (R2); the Keyword Check\'s topic fit has a 1,200-token budget, a three-scalar schema and a plain-text retry, and an unknown fit is in the label, not only in the warnings (R3); the Link Builder refuses a prospect whose registrable domain is a declared competitor or a SERP rival of ours while a "best X" list stays pitchable (R4); the Error Handler reads a trigger-mode failure (trigger.error message / description / cause and the node it names) (R5); the delivery result and the carrying channel go back on the seo_ops_alerts row (R6); no verdict asks for FAQPage schema any more, only an FAQ section (R7); a rung page takes its word target from the pages that rank for its ladder\'s topic (R8); every scheduled run reserves and settles a seo_run_ledger row and every row carries a DataForSEO estimate, settled with the measured amount where the run knows it (R9); and the budget refusal the customer reads is no longer "Raise ai_budget_usd in Normalize Input"')
# 49. A TOPIC RADIUS SOMEBODY CAN SEE, AND A STUCK LADDER THAT GETS RE-PLANNED (2026-10-13, system review FIX_PLAN.md G32 and L3;
#     criteria K12 / K13 in CRITERIA_keywords_content.md, REP 3.6 in CRITERIA_technical_tracking_reporting_ai_links.md)
#     * G32 topic radius: the research and the ladder plan now carry a RADIUS block (v5/code/_radius.js, one kit for both, on top of the
#       reach kit): every topic is "within reach" / "a stretch" / "out of reach for now" with the evidence behind the verdict — the
#       difficulty against the measured reach, a position the site already holds, a page it already has, a service it sells. It is
#       SHOWN, never enforced: `Rank Keywords` -> `keyword_strategy.topic_radius` + a section in the Keyword Strategy report,
#       `Ladder Plan` -> `ladder.topic_radius` / `head_radius` + a note and a section in the ladder plan report.
#     * G32 re-plan: a ladder that has not moved for the configured number of weeks (`seo_monitors.stuck_weeks`, empty = 8, 2-26) gets a
#       re-plan PROPOSAL in the Rank Tracker (v5/code/_replan.js, wired in build_ladder_extras.py): improve the page that exists instead
#       of writing another, write the easier supporting keyword, change the rung order, or stop — each with its reason and evidence, and
#       `applied: false` on every one of them. Nothing the owner approved is rewritten anywhere.
#     * L3 Link Builder PDF: wired in build_monitors.py (LB Doc -> Prepare / Render / Attach PDF LB -> the e-mail attachment and the
#       callback), so the weekly Link Builder result is a document like the other reports'.
# =============================================================================
for _n49 in ('Rank Keywords', 'Ladder Plan'):
    assert 'const RAD = (() => {' in code(_n49), _n49 + ': the topic-radius kit (_radius.js) is not inlined'
    assert 'function difficultyForYou(' in code(_n49), _n49 + ': the radius kit needs the reach kit in the same node'
    assert 'RAD.of({' in code(_n49), _n49 + ': the topic radius is not built'
assert 'topic_radius' in code('Build Keyword Strategy') and 'Your topic radius' in code('Build Keyword Strategy'), 'G32: the keyword strategy report has no topic-radius block'
assert 'topic_radius' in code('Build Ladder Report') and 'Your topic radius' in code('Build Ladder Report'), 'G32: the ladder plan report has no topic-radius block'
assert not any('/*__RADIUS__*/' in n['parameters'].get('jsCode', '') for n in nodes.values()), 'G32: radius placeholder left'
# harness shims (S58): the two kits as runnable scripts, one call per item (the radius kit needs the reach kit beside it)
os.makedirs(OUT_CODE, exist_ok=True)
open(os.path.join(OUT_CODE, '_radius.js'), 'w').write(
    "// harness shim (written by build_v4.py section 49, G32): the topic radius — { reach, topics, services, pages, site_topics } -> every topic's verdict with its evidence\n"
    + _rd0('code/_reach.js').rstrip('\n') + '\n' + RADIUS_SRC + "\nreturn $input.all().map(i => { const j = i.json || {}; const rad = RAD.of(j);\n"
    "  return { json: { ...rad, rows: RAD.rows(rad), labels: RAD.LABEL, picked: j.pick === undefined ? null : RAD.pick(rad, j.pick),\n"
    "    picked_line: j.pick === undefined ? '' : RAD.line(RAD.pick(rad, j.pick)) } }; });\n")
open(os.path.join(OUT_CODE, '_replan.js'), 'w').write(
    "// harness shim (written by build_v4.py section 49, G32): the re-plan proposal — { weeks, stuck_weeks, won, improved, head, pages, later, reach } -> the proposal, its reason and its evidence\n"
    + _rd0('code/_replan.js').rstrip('\n') + "\nreturn $input.all().map(i => { const j = i.json || {}; const rp = RP.propose(j);\n"
    "  return { json: { ...rp, html: RP.block(rp), actions: (rp.options || []).map(o => o.action), weeks_setting: RP.weeks(j.stuck_weeks), default_weeks: RP.WEEKS } }; });\n")
sticky("""### Topic radius and the re-plan of a stuck ladder (G32) · the Link Builder's PDF (L3)
**Topic radius** (`_radius.js`, one kit for the research and the ladder): every topic is **within reach**, **a stretch** or **out of reach for now**, with the evidence printed next to the verdict — its difficulty against your measured reach, a position you already hold, a page you already have, a service you sell. A topic whose difficulty is inside the reach but which nothing you sell or write about names is a **stretch**, not a "now". It is shown with the plan and never enforced on it.
**A stuck ladder gets a proposal** (`_replan.js`, in the Rank Tracker): after the configured weeks without a position gain (`seo_monitors.stuck_weeks`, empty = 8) the weekly e-mail and the callback carry a re-plan — improve the page that already answers the search, write the easier supporting keyword, change the rung order, or stop — each with its reason and its evidence, and each marked **not applied**: a person accepts one in the app, nothing is rewritten for them.
**The Link Builder's week as a PDF** (L3): *LB Doc* + Gotenberg, attached to the e-mail and carried in the callback.""",
    pos('Build Keyword Strategy')[0] - 40, pos('Build Keyword Strategy')[1] + 420, 1180, 280, 6)
log('Topic radius and stuck-ladder re-plan (2026-10-13, FIX_PLAN G32; criteria K12 / K13): one radius kit (v5/code/_radius.js) draws the site\'s topic radius in the keyword research (keyword_strategy.topic_radius + a report section) and in the ladder plan (ladder.topic_radius, head_radius, a plan note and a report section) — within reach / a stretch / out of reach for now, with the evidence behind each verdict, shown and never enforced; the Rank Tracker turns a stuck ladder (seo_monitors.stuck_weeks, empty = 8, 2-26) into a re-plan proposal (v5/code/_replan.js: improve the existing page, the easier keyword, a different order, or stop) with reasons, evidence and applied: false; and the Link Builder\'s weekly result is now a PDF (L3, build_monitors.py: LB Doc -> Gotenberg -> e-mail attachment + callback)')
# 50. THE SIX DEFECTS THE RE-RATING'S COMPLETION RUNS FOUND (R10 … R15, 2026-10-13;
#     docs/system-review-2026-10-13/RESULTS.md §3.2, register rows in docs/system-review-2026-10-11/FIX_PLAN.md §3.11).
#     R10 (High) Google retired the Mobile Usability report, so all 45 URL Inspection answers of exec 523 came back
#          `mobileUsabilityResult: {"verdict": "VERDICT_UNSPECIFIED"}` — and the audit read that as "not mobile-friendly": a **High**
#          finding on 45 of 47 pages with an **empty** evidence string ("/:  | /whatwedo/ai-automation: "), ranked second of 60 by impact
#          and reported "new" by every diff. `PW.inspection` now answers **not checked** for anything but a FAIL that names an issue
#          (v5/code/_page_watch.js), the finding needs a real issue list and a non-empty evidence string, and both reports print the
#          sentence "Search Console no longer answers mobile usability". Its second half was just as wrong: the basis claimed "about 720
#          clicks and 22,860 impressions in the last 28 days" for a property that measured **38 clicks and 5,295 impressions** — the site
#          average per page multiplied by the pages affected, with no cap. `IMP.rank` (v5/code/_impact.js) now caps **every** finding's
#          clicks / impressions basis at Search Console's own 28-day totals and says so in the line when the cap bit.
#     R11 (High) exec 521 delivered a page with 12 placeholders: QA round 1 failed on 6, the editor ran, round 2 came back with **12**
#          (11 × [Price], 1 × [Number]) and 40% coverage against a target of 68 — and because `qa_max_rounds: 2` was reached the page went
#          out, the owner told only "Quality check: 6 item(s) to review" with nothing saying the gate had failed. Content QA now carries the
#          gate itself (`quality`, `not_ready`, `rounds_left`, the reasons) and the delivery — the Word report, `meta.json`, the e-mail, the
#          callback and the app payload — carries the **last** round's counts under the label *"did not pass the quality check — not ready
#          to publish"*; the work is still delivered, as a draft, and `qa_max_rounds` is unchanged. The mask that caused it is fixed too: a
#          passage the draft itself declares illustrative or hypothetical keeps its figures (live, "40 fee-earners at an average rate of
#          [Price] per hour" and "billings of [Price] a week (40 × 22.5 × [Price])" destroyed a worked example's arithmetic), while an
#          unsourced real price still becomes [Price].
#     R12 (Medium) 11 of 25 rows of discovery's "Searches your website already appears for" read "no page of yours answers this search"
#          while the same row named a live 200-OK page of the site, one of them ranking #6.2: `KWI.gscSeeds` decided with `SM.matchPage`
#          alone and ignored the URL Search Console itself reports. A URL on this site is now the answering page with its own label — "the
#          page that gets the impressions does not target this search" — and the kit, not the report, owns that wording.
#     R13 (Medium) §4a of the full report still offered "ai" (165,000/mo), "character ai", "google ai", "humanize ai", "meta ai",
#          "blackbox ai", "mh enterprises uae" and "microsoft ai", and the gap kept "mofa attestation dubai" and "how to check emirates id
#          status with passport number", under a High finding telling the owner to build pages for them: the gate only refused classes
#          somebody had listed. The fit gate now measures **topic distance** on the same 25% bar the outreach gate uses (`fitTopic` in
#          v5/code/_fit_gate.js: place names and generic words count for neither side, a keyword left with nothing but them is "too broad"),
#          *Analyze Keywords* hands it the site's own topics, every refusal is printed with its reason under §4a, and a bucket that empties
#          says why instead of disappearing.
#     R14 (Medium) exec 526 printed `"Tech&" by name (you) | 19,579 answers | 16,421,600 AI searches` as the first row of "Market-wide:
#          every AI answer in the database", directly under the headline "Market-wide share 0% — 0 AI answers cite you", while the run's own
#          54 samples named the business 0 times and the next row was microsoft.com with 1,897 — the index matched the 4-letter name inside
#          the whole "tech" family (P34-2's collapse again). `you` now comes from a **domain** match only, and a name-only row is dropped
#          with its reason when the name is under the brand-token bar or claims orders of magnitude more than the measurement, else kept and
#          labelled "matched by name only, not to your website" and left out of the share arithmetic (v5/code/_ai_stats.js `indexNameRow`).
#     R15 (Medium) the same write-now ladder page was delivered as `service-industry-erp-software-uae` while its ladder row (the link map,
#          the siblings' up-links and the Rank Tracker) said `/service-industry-erp-software/`, and `meta.links_to_add_when_published` came
#          back `[]` although the app had sent two `planned: true` ladder links. The planned URL now travels with every ladder page run
#          (`ladder_target_url`: the app's "Write now", *Spawn Page Runs* and the Content Cadence), *Parse Brief* and Content QA keep that
#          slug, the package publishes at that exact URL, and every planned ladder link is listed as a link to add once it is live.
# =============================================================================
# ---------- A. R10: Google's "no data" is not a finding, and no basis is bigger than the property ----------
patch('GSC Audit Findings', "const F = (severity, title, why, fix, evidence, urls, count, pct) => findings.push({",
      "const F = (severity, title, why, fix, evidence, urls, count, pct) => (severity !== 'Info' && !/[A-Za-z0-9]/.test(String(evidence == null ? '' : evidence)))\n"
      "  ? null   // R10 (2026-10-13): a finding with nothing behind it is not a finding — live, \"Pages Google reports as not mobile-friendly\" was raised with the evidence \"/:  | /whatwedo/ai-automation: \" on 45 of 47 pages\n"
      "  : findings.push({")
patch('GSC Audit Findings', "notIdx.map(i => i.coverage).filter((v, k, a) => a.indexOf(v) === k).join('; ')",
      "(notIdx.map(i => i.coverage).filter(Boolean).filter((v, k, a) => a.indexOf(v) === k).join('; ') || (notIdx.length + ' of ' + ok.length + ' inspected pages are not in Google\\'s index (Search Console gave no reason for them)'))")
_R10_OLD = """    // G25: mobile-first indexing has been complete since 2024-07-05, so a page Google calls not mobile-usable is a real ranking problem
    const mobBad = ok.filter(i => i.mobile_usable === false);
    if (mobBad.length) F('High', 'Pages Google reports as not mobile-friendly', 'Google indexes the mobile version of every page: what its phone crawler cannot use properly cannot rank well.', 'Fix the issues Search Console lists for these URLs (viewport, text size, tap targets, content wider than the screen), then re-inspect them.', mobBad.slice(0, 3).map(i => path(i.url) + ': ' + (i.mobile_issues || []).slice(0, 2).join('; ')).join(' | ').slice(0, 300), mobBad.map(i => i.url), mobBad.length, Math.round(mobBad.length / ok.length * 100));
    else if (ok.some(i => i.mobile_usable === true)) works.push('Google reports every inspected page as mobile-friendly');"""
_R10_NEW = """    // G25 + R10 (2026-10-13, re-rating §3.11): mobile-first indexing has been complete since 2024-07-05, so a page Google really calls
    // not mobile-usable is a ranking problem — but Google RETIRED the Mobile Usability report and the API now answers
    // VERDICT_UNSPECIFIED with no issue list for every page (45 of 45 live). That is NOT CHECKED, never "not mobile-friendly": the
    // finding needs a FAIL that names at least one issue (PW.inspection decides) and an evidence string with something in it.
    const mobBad = ok.filter(i => i.mobile_usable === false && (i.mobile_issues || []).length);
    const mobEvidence = mobBad.slice(0, 3).map(i => path(i.url) + ': ' + (i.mobile_issues || []).slice(0, 2).join('; ')).join(' | ').slice(0, 300);
    const mobChecked = ok.filter(i => i.mobile_usable !== null).length;
    search_console.mobile_usability = { checked: mobChecked, not_checked: ok.length - mobChecked, with_issues: mobBad.length,
      note: mobChecked ? '' : String(((ok.find(i => i.mobile_note) || {}).mobile_note) || 'Search Console no longer answers mobile usability (Google retired the Mobile Usability report), so it was not checked.') };
    if (mobBad.length && mobEvidence) F('High', 'Pages Google reports as not mobile-friendly', 'Google indexes the mobile version of every page: what its phone crawler cannot use properly cannot rank well.', 'Fix the issues Search Console lists for these URLs (viewport, text size, tap targets, content wider than the screen), then re-inspect them.', mobEvidence, mobBad.map(i => i.url), mobBad.length, Math.round(mobBad.length / ok.length * 100));
    else if (mobChecked && ok.some(i => i.mobile_usable === true)) works.push('Google reports the ' + mobChecked + ' page(s) it still answers about as mobile-friendly');"""
patch('GSC Audit Findings', _R10_OLD, _R10_NEW)
for _n50 in ('Build Audit Report', 'Build Full Report'):
    patch(_n50, "  if (ic.quota_note) h += `<p class=\"small\">${e3(ic.quota_note)}</p>`;",
          "  if (ic.mobile_note) h += `<p class=\"small\"><b>Mobile usability:</b> ${e3(ic.mobile_note)} Nothing is claimed about it either way.</p>`;   // R10 (2026-10-13): \"no data\" is not \"not mobile-friendly\"\n"
          "  if (ic.quota_note) h += `<p class=\"small\">${e3(ic.quota_note)}</p>`;")
assert 'const mobEvidence' in code('GSC Audit Findings') and 'mobile_usability' in code('GSC Audit Findings'), 'R10: the mobile finding is unchanged'
assert "const capped = false" not in code('Build Site Issues') and 'capped at everything the whole website measured' in code('Build Site Issues'), 'R10: the impact basis is not capped'

# ---------- B. R11: a page that fails the quality check is delivered as a draft, and says so everywhere ----------
patch('Build Word File', "    ['Status', qa.passed ? '<span class=\"ok\">Passed</span>' : '<span class=\"bad\">Needs review</span>'],",
      "    ['Status', qa.passed ? '<span class=\"ok\">Passed</span>' : qa.not_ready ? '<span class=\"bad\">Did not pass \\u2014 not ready to publish</span>' : '<span class=\"bad\">Needs review</span>'],\n"
      "    ...(qa.not_ready ? [['Why it is not ready', '<span class=\"bad\">' + (qa.not_ready_reasons || []).map(esc).join('<br>') + '</span>']] : []),   // R11 (2026-10-13): the LAST round's reasons, on the page the owner reads first")
patch('Build Word File', "    qa_summary: qa.passed == null ? '' : (qa.passed ? 'Quality check passed' : 'Quality check: ' + ((qa.warnings || []).length + (qa.profile_placeholders ? 1 : 0)) + ' item(s) to review'),",
      "    // R11 (2026-10-13, re-rating §3.11): the summary is this (the LAST) round's, and when the rounds ran out with the gate still failing it says the page is not ready\n"
      "    qa_summary: qa.passed == null ? '' : (qa.passed ? 'Quality check passed'\n"
      "      : qa.not_ready ? 'Did not pass the quality check \\u2014 not ready to publish (round ' + qa.round + ' of ' + qa.max_rounds + '): ' + ((qa.not_ready_reasons || []).slice(0, 3).join('; ') || ((qa.warnings || []).length + ' item(s) to review'))\n"
      "        : 'Quality check: ' + ((qa.warnings || []).length + (qa.profile_placeholders ? 1 : 0)) + ' item(s) to review'),\n"
      "    qa_publishable: qa.passed == null ? null : !!qa.passed,\n"
      "    qa_not_ready: !!qa.not_ready, qa_label: qa.quality_label || '', qa_reasons: qa.not_ready_reasons || [], qa_quality: qa.quality || null,\n"
      "    qa_round: qa.round == null ? null : qa.round, qa_max_rounds: qa.max_rounds == null ? null : qa.max_rounds,\n"
      "    qa_placeholders: qa.placeholders_total == null ? null : qa.placeholders_total,\n"
      "    content_links_to_add: qa.links_to_add_when_published || [],   // R15: every planned ladder / cluster link, for the package\n"
      "    ladder_target_url: d.ladder_target_url || '',")
# the file name says it too, so a draft cannot be mistaken for a finished page on disk
patch('Build Word File', "const fileName = prefix + '-' + safe + '-' + today + '.doc';",
      "const fileName = prefix + '-' + safe + '-' + today + (qa.not_ready ? '-DRAFT' : '') + '.doc';   // R11 (2026-10-13)")
_BP_META_OLD = "const meta = { title, h1: h1 || title, slug, suggested_url: dom ? siteUrlOf(dom, '/' + slug + '/') : '/' + slug + '/',"
_BP_META_NEW = """// R15 (2026-10-13, re-rating §3.11): a ladder page is published at the URL its ladder row planned — the row's link map, the siblings'
// up-links and the Rank Tracker all use it, so a different suggested URL leaves every stored link pointing nowhere.
const plannedPageUrl = (d.ladder_id && String(d.ladder_target_url || '').trim()) ? ownUrl(String(d.ladder_target_url).trim()) : '';
// R15: the links to add once a planned page is live — the ladder's planned pages as well as a hub's cluster pages (Content QA built the list)
const plannedLinks = (Array.isArray(d.content_links_to_add) && d.content_links_to_add.length)
  ? d.content_links_to_add.filter(p => p && p.url).map(p => ({ keyword: p.keyword || '', planned_url: SRC.clean(ownUrl(p.url)), anchor: p.anchor || anchorText(p), role: p.role || '', note: 'Not published yet: add this link from this page once the page is live.' }))
  : HPplanned.map(p => ({ keyword: p.keyword || '', planned_url: SRC.clean(p.url), anchor: anchorText(p), role: p.role || p.ladder || '', note: 'Not published yet: add this link from this page once the page is live.' }));
const meta = { title, h1: h1 || title, slug, suggested_url: plannedPageUrl || (dom ? siteUrlOf(dom, '/' + slug + '/') : '/' + slug + '/'),"""
patch('Blog Package', _BP_META_OLD, _BP_META_NEW)
patch('Blog Package', "  links_to_add_when_published: HPplanned.map(p => ({ keyword: p.keyword || '', planned_url: SRC.clean(p.url), anchor: anchorText(p), note: 'Not published yet: add this link from this page once the page is live.' })),",
      "  links_to_add_when_published: plannedLinks,")
patch('Blog Package', "word_count: words, content_score: d.content_score == null ? null : d.content_score, qa_summary: d.qa_summary || '',",
      "word_count: words, content_score: d.content_score == null ? null : d.content_score, qa_summary: d.qa_summary || '',\n"
      "  // R11 (2026-10-13): the package says whether this page may be published as it is, with the last quality round's counts and reasons\n"
      "  publishable: d.qa_publishable == null ? null : !!d.qa_publishable, quality: d.qa_quality || null,")
patch('Blog Package', "if (HPplanned.length) extra.push('\"links_to_add_when_published\" lists ' + HPplanned.length + ' page(s) this hub does NOT link to yet because they are not published: add the link with the anchor given once each one is live (the weekly ladder e-mail reminds you)');",
      "if (plannedLinks.length) extra.push('\"links_to_add_when_published\" lists ' + plannedLinks.length + ' page(s) this page does NOT link to yet because they are not published: add the link with the anchor given once each one is live (the weekly ladder e-mail reminds you)');")
patch('Blog Package', "const extra = [];", "const extra = [];\nif (d.qa_not_ready) extra.push('This page DID NOT PASS the quality check (' + (d.qa_label || 'not ready to publish') + '): ' + ((d.qa_reasons || []).slice(0, 3).join('; ') || 'see the report') + ' \\u2014 finish those points before you publish it');\nif (plannedPageUrl) extra.push('Publish it at ' + plannedPageUrl + ': that is the URL this keyword ladder planned, and the other pages of the ladder already link to it');")
patch('Build Webhook Response', "    qa_summary: d.qa_summary || null,",
      "    qa_summary: d.qa_summary || null,\n"
      "    // R11 (2026-10-13): the app shows the last quality round's verdict, not a count of warnings\n"
      "    qa_publishable: d.qa_publishable == null ? null : !!d.qa_publishable,\n"
      "    qa_not_ready: !!d.qa_not_ready, qa_label: d.qa_label || null, qa_reasons: d.qa_reasons || [], qa_quality: d.qa_quality || null,")
assert 'qa_not_ready' in code('Build Word File') and 'qa_not_ready' in code('Build Webhook Response') and 'publishable: d.qa_publishable' in code('Blog Package'), 'R11: the delivery does not carry the gate'
assert 'quality_label' in code('Content QA') and 'illustrativeZones' in code('Content QA'), 'R11: Content QA has no gate or no illustrative zones'

# ---------- C. R13: every keyword list runs through the topic bar, and the refusals are printed ----------
patch('Analyze Keywords', "brands: fitLearnedBrands(cacheRowsAK), protect: [...seeds, ...(base.services || []), String(base.business || '').slice(0, 400)] };",
      "brands: fitLearnedBrands(cacheRowsAK), protect: [...seeds, ...(base.services || []), String(base.business || '').slice(0, 400)],\n"
      "  // R13 (2026-10-13, re-rating §3.11): topic distance on the same 25% bar the outreach gate uses — §4a offered \"ai\" (165,000/mo),\n"
      "  // \"character ai\", \"google ai\", \"meta ai\", \"mh enterprises uae\" and the gap kept \"mofa attestation dubai\" because the gate only\n"
      "  // refused classes somebody had listed. The topics are the site's own: its services, its description and this run's seeds.\n"
      "  topics: [...(base.services || []), String(base.business || '').slice(0, 600), ...seeds, ...(((base.site_description || {}).products_or_services) || []).map(String)],\n"
      "  topic_label: 'what this website sells' };")
patch('Analyze Keywords', "const fitsAK = (k) => { const g = fitGate(k.keyword, { ...fitCtxAK, intent: k.intent }); if (!g.ok) refused.push({ keyword: k.keyword, volume: k.volume, reason: g.reason, detail: g.detail }); return g.ok; };",
      "const fitsAK = (k) => { const g = fitGate(k.keyword, { ...fitCtxAK, intent: k.intent }); if (!g.ok) refused.push({ keyword: k.keyword, volume: k.volume, intent: k.intent || '', reason: g.reason, detail: g.detail }); return g.ok; };")
patch('Analyze Keywords', "if (g.ok || g.reason === 'own brand') return true; refused.push({ keyword: k.keyword, volume: k.volume, reason: g.reason, detail: g.detail }); return false; };",
      "if (g.ok || g.reason === 'own brand') return true; refused.push({ keyword: k.keyword, volume: k.volume, intent: k.intent || '', reason: g.reason, detail: g.detail }); return false; };")
patch('Build Full Report', "  html += `<h2>4a. Keyword Opportunities by Search Intent</h2>`;",
      "  // R13 (2026-10-13): a bucket the gate emptied says so with the reasons, instead of reading like a market with no demand\n"
      "  const refusedAK = (sk.refused || []);\n"
      "  const refusedIn = (i) => refusedAK.filter(r => String(r.intent || '') === i);\n"
      "  html += `<h2>4a. Keyword Opportunities by Search Intent</h2>`;")
patch('Build Full Report', "      : '<p>No keywords with measurable search volume found for this intent.</p>');",
      "      : '<p>' + (refusedIn(i).length\n"
      "        ? 'Every keyword this research found for this intent was left out on purpose: ' + refusedIn(i).slice(0, 4).map(r => esc(r.keyword) + ' \\u2014 ' + esc(r.detail || r.reason)).join('; ') + '.'\n"
      "        : 'No keywords with measurable search volume found for this intent.') + '</p>');")
patch('Build Full Report', "  if ((sk.easy_wins || []).length) {",
      "  if (refusedAK.length) html += `<p class=\"small\"><b>Left out of the lists above on purpose (${refusedAK.length}):</b> ` + refusedAK.slice(0, 12).map(r => esc(r.keyword) + ' \\u2014 ' + esc(r.detail || r.reason)).join('; ')\n"
      "    + (refusedAK.length > 12 ? ' \\u2026' : '') + `. No page of this website should chase another company's brand, a government portal or login, or a subject beyond what you sell.</p>`;\n"
      "  if ((sk.easy_wins || []).length) {")
patch('Build Full Report', "html += '<p class=\"small\">Left out of the gap on purpose: ' + sk.refused.length + ' searches for government portals, logins or other companies\\' brands (e.g. '",
      "html += '<p class=\"small\">Left out of the gap on purpose: ' + sk.refused.length + ' searches no page of this website should target (e.g. '")
assert "topic_label: 'what this website sells'" in code('Analyze Keywords') and 'function fitTopic(' in code('Analyze Keywords'), 'R13: the topic bar is not wired into Analyze Keywords'
# R12: the report prints the kit's own reason per row, so it can never word a row itself
assert "q.why ||" in code('Build Keyword Strategy') and 'mismatch' in code('Build Keyword Strategy'), 'R12: the keyword strategy still words the reason itself'
assert "kinds.push('page_mismatch')" in code('Search Console Seeds (Discovery)'), 'R12: the discovery seeds have no page-mismatch class'
assert 'refusedIn(i)' in code('Build Full Report'), 'R13: the full report does not say what was left out'

# ---------- D. R15: the planned URL travels with every ladder page run ----------
patch('Normalize Input', "   // P2-7: the word count the ladder verdict set for this page\n",
      "   // P2-7: the word count the ladder verdict set for this page\n"
      "    ladder_target_url: /^https?:\\/\\/\\S+$/i.test(String(p2.ladder_target_url || '').trim()) ? String(p2.ladder_target_url).trim().slice(0, 300) : '',   // R15: the URL the ladder planned for this page\n")
patch('Parse Brief', "// Word count check",
      """// 4. R15 (2026-10-13, re-rating §3.11): a ladder page keeps the URL its ladder row planned. Live, the row said
//    `…/service-industry-erp-software/` while the page was delivered as `service-industry-erp-software-uae`: the ladder's link map, the
//    sibling pages' up-links and the Rank Tracker's weekly check all use the row, so publishing at the suggested URL would have left
//    every one of them pointing at a URL that never exists.
const ladderUrlPB = String(prev.ladder_target_url || '').trim();
if (prev.ladder_id && ladderUrlPB) {
  const slugPB = ladderUrlPB.replace(/^https?:\\/\\/[^\\/]+/, '').replace(/[?#].*$/, '').replace(/^\\/+|\\/+$/g, '').split('/').filter(Boolean).pop() || '';
  const asked = String(brief.slug || '').replace(/^\\/|\\/$/g, '');
  if (slugPB && slugPB !== asked) { adjustments.push('Slug "' + (asked || 'unset') + '" -> "' + slugPB + '": the keyword ladder planned this page at ' + ladderUrlPB + ', and its link map, the other rung pages and the rank tracking all use that URL'); brief.slug = slugPB; }
}

// Word count check""")
assert 'ladder_target_url' in code('Normalize Input') and 'ladderUrlPB' in code('Parse Brief'), 'R15: the planned URL does not reach the brief'
assert 'plannedPageUrl' in code('Blog Package') and 'ladderPlannedUrl' in code('Content QA'), 'R15: the planned URL does not reach the page'

# ---------- E. harness shim (S59): the impact kit as a runnable script ----------
os.makedirs(OUT_CODE, exist_ok=True)
open(os.path.join(OUT_CODE, '_impact.js'), 'w').write(
    "// harness shim (written by build_v4.py section 50): the impact kit - { findings, total_pages, search_console, key_pages } -> every\n"
    "// finding with its weight, band, traffic basis (capped at the property's measured totals, R10) and the one line that explains it\n"
    + IMPACT_SRC + "\nreturn $input.all().map(i => { const j = i.json || {};\n"
    "  const list = IMP.rank(JSON.parse(JSON.stringify(j.findings || [])), { total_pages: j.total_pages, search_console: j.search_console || null, key_pages: j.key_pages || [] });\n"
    "  const folded = IMP.fold(list);\n"
    "  return { json: { findings: list, first_reason: IMP.firstReason(list), method: IMP.method, minor: folded.minor.map(f => f.title), folded: folded.folded, fold_note: IMP.foldNote(folded.folded) } }; });\n")

sticky("""### The six defects the re-rating found (R10-R15, 2026-10-13)
**R10** Google retired the Mobile Usability report: `VERDICT_UNSPECIFIED`, a missing result or a FAIL with no issue list is **not checked** (`PW.inspection`), never "not mobile-friendly", and a finding with an empty evidence string is never raised. **Every** finding's clicks / impressions basis is now **capped at Search Console's own 28-day totals** (`IMP.rank`) - the live run claimed 720 clicks and 22,860 impressions for a site that measured 38 and 5,295.
**R11** A run that uses up `qa_max_rounds` with the gate still failing is delivered **as a draft**: the Word report, `meta.json`, the e-mail, the callback and the app all carry the **last** round's counts under "did not pass the quality check - not ready to publish". A passage the draft labels **illustrative** keeps its figures (the mask destroyed a worked example's arithmetic); unsourced real prices are still masked.
**R12** A Search Console row that names a page of this site is answered **by that page** - "the page that gets the impressions does not target this search" - never "no page of yours answers this search".
**R13** The fit gate measures **topic distance** (25%, the outreach bar) over every intent bucket and the gap; refusals are printed with their reasons and an emptied bucket says why.
**R14** The market-wide AI table identifies you by **domain**; a name-only row is dropped or labelled "not matched to your website" and never counted.
**R15** A ladder page keeps the **URL its ladder planned** (`ladder_target_url`) and lists every planned ladder link under `links_to_add_when_published`.""",
    pos('Content QA')[0] - 40, pos('Content QA')[1] + 420, 1180, 420, 3)
log('The six defects the re-rating\'s completion runs found (R10-R15, 2026-10-13; docs/system-review-2026-10-13/RESULTS.md §3.2): Google\'s retired mobile-usability answer (VERDICT_UNSPECIFIED, a missing result, a FAIL with no issues) is "not checked" instead of a High "not mobile-friendly" finding on every page, a finding with an empty evidence string is never raised and every finding\'s clicks / impressions basis is capped at the property\'s measured 28-day totals (v5/code/_page_watch.js, _impact.js); a content run that exhausts qa_max_rounds with the gate still failing is delivered as a DRAFT labelled "did not pass the quality check - not ready to publish" with the LAST round\'s counts in the Word report, meta.json, the e-mail, the callback and the app payload, and the price mask leaves the figures of a passage the draft itself declares illustrative (v5/code/Content_QA.js); a Search Console row that names a live page of the site is answered by that page with its own label instead of "no page of yours answers this search" (v5/code/_kw_inputs.js); the fit gate measures topic distance on the outreach gate\'s 25% bar over every intent bucket and the keyword gap, prints every refusal with its reason and says why a bucket is empty (v5/code/_fit_gate.js fitTopic, Analyze Keywords, Build Full Report); the AI market-wide index identifies the owner by domain only and drops or labels a name-only row that the measurement cannot support (v5/code/_ai_stats.js indexNameRow, AI_Metrics.js, AI_Report.js); and a ladder page keeps the URL its ladder row planned (ladder_target_url through Normalize Input, Parse Brief, Content QA and the package) and carries every planned ladder link in links_to_add_when_published')

# =============================================================================
# 51. CLAUDE'S COST IS A NUMBER, AND THE ESTIMATES COME FROM THE MONEY (2026-10-13, system review FIX_PLAN.md G23 + the estimate
#     recalibration the re-rating measured; docs/system-review-2026-10-13/RESULTS.md §0b / §1 / §2.10).
#     Two things about this engine's own money were not true.
#     (a) **Claude's spend was a range, not a number.** Strategy Brief, Copywriter and Editor run on Opus with `streaming: true` (the
#         Anthropic SDK requires it above ~21k tokens), and a streaming call reports no token usage at all — the delivered run carried only
#         `tokenUsageEstimate`, which a Code node cannot read either (usage rides the ai_languageModel connection). So the re-rating could
#         put the page run's Claude cost no closer than "$1.6-3.0" (2026-10-11) / "$0.44 of $1.00 estimated" (2026-10-13), and worse,
#         `seo_run_ledger.settled_usd` stored the per-mode RESERVATION while the guard, the app and the review all read it as a measured
#         cost. Now every Claude call of a run is priced from what the run really knows — the characters its prompt interpolated, the
#         characters it answered with and the thinking budget of its effort level (v5/code/_cost_cal.js, the call table baked from the real
#         model nodes so a model or token change reaches the cost) — and the figure travels as `run_ledger.ai_cost` with `estimated: true`
#         and a basis in words. *Run Ledger Settle* then settles the row with the measured and the estimated money kept apart
#         (`ai_usd`, `measured_usd`, `estimated_usd`, `cost_basis`), so no reader can mistake one for the other again.
#     (b) **The per-mode estimates were up to 13x away from the money**, which is why the day's guard refused five customer runs that cost
#         a fraction of what it held back: `ai_visibility` reserved $0.06 and cost $0.79, backlinks $0.04 for $0.37, the full report $0.25
#         for $0.41, and the written page reserved $1.23 for about $0.46. Both tables are recalibrated from the measured runs (every value
#         above the figure beside it in _cost_cal.js, never below) and are now SELF-CORRECTING: *Cost Calibration Row* -> *Save Cost
#         Calibration* moves the mode's rolling figure in seo_cache (`cost:ai:<mode>` / `cost:dfs:<mode>`) toward what the run cost, and
#         the guard reserves max(rolling x CC.HEADROOM, the recent maximum) — it may fall as a mode gets cheaper but can never sit below
#         what the mode has actually cost. *Load Cost Calibration* reads those rows once per run, before the guard counts.
#     (c) **The monthly reconciliation.** A character-based figure still needs a reality check the engine cannot do itself, so
#         reconcile_claude_cost.py compares a month of ledger rows with the owner's Anthropic Console usage export and writes one
#         correction factor per model family into `cost:factor:claude`, which CC.callCost applies from the next run on.
# =============================================================================
from ladder_common import CACHE_TABLE as CACHE_TABLE51, CACHE_COLS as CACHE_COLS51
COST_SRC = _rd0('code/_cost_cal.js').rstrip('\n')
_rd51 = lambda f: rd(f).replace('/*__COST_CAL__*/', COST_SRC)

# ---------- A. every Claude call of this workflow, baked from the real nodes ----------
# The prompt text is an n8n expression, so the characters it sends are the template plus the fields it interpolates — not the whole input
# item (Brief Context alone carries the competitor pages). Both are read here: `$json.<path>` from the agent's own main input and
# `$('Node').first().json.<path>` from wherever else the prompt reaches. Nested paths collapse into their root-most prefix so a field is
# never counted twice.
def _roots51(paths):
    out = []
    for p in sorted(paths, key=lambda s: (s.count('.'), s)):
        if not any(p == q or p.startswith(q + '.') for q in out): out.append(p)
    return sorted(out)
_LOOPS51 = {'Editor', 'Critic'}   # these run once per QA round (Content QA counts them as qa_round)
_AI_CALLS51 = []
for _mn51, _m51 in sorted(nodes.items()):
    if _m51['type'] != '@n8n/n8n-nodes-langchain.lmChatAnthropic': continue
    _o51 = _m51['parameters'].get('options', {})
    _model51 = _m51['parameters']['model']['value']
    for _ag51 in [t['node'] for l in conns.get(_mn51, {}).get('ai_languageModel', [[]]) for t in l]:
        _txt51 = str(nodes[_ag51]['parameters'].get('text', ''))
        assert _txt51, 'G23: agent ' + _ag51 + ' has no prompt text'
        _own51 = _roots51(re.findall(r"\$json\.([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)", _txt51))
        _oth51 = sorted({(a, b) for a, b in re.findall(r"\$\('([^']+)'\)\.(?:first\(\)|item)\.json\.([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)", _txt51)})
        _in51 = sorted({s for s, o in conns.items() for l in o.get('main', []) for t in l if t['node'] == _ag51})
        _AI_CALLS51.append({'node': _ag51, 'model': _model51, 'max_tokens': int(_o51.get('maxTokensToSample') or 0),
                            'effort': _o51.get('effort') or '', 'streaming': bool(_o51.get('streaming')),
                            'template_chars': len(_txt51), 'input': _in51[0] if _in51 else '', 'fields': _own51,
                            'from': [[a, b] for a, b in _oth51], 'loop': _ag51 in _LOOPS51})
assert len(_AI_CALLS51) >= 11, _AI_CALLS51
assert sum(1 for c in _AI_CALLS51 if c['streaming']) == 3, 'G23: the three streaming Opus nodes are not what the cost code thinks they are'
assert {c['node'] for c in _AI_CALLS51 if c['streaming']} == {'Strategy Brief', 'Copywriter', 'Editor'}, 'G23: the streaming nodes moved'

AI_COST_JS51 = """
// ---- what Claude cost this run (G23, 2026-10-13): priced per call from what the run can actually see ----
// A streaming call reports no token usage, so there is nothing to read; what the run does know is the prompt it built, the answer it got
// and the thinking budget of the node's effort level. Every figure here is an ESTIMATE and says so (ai_cost.estimated / .basis), and the
// per-model correction factors the monthly reconciliation writes into seo_cache are applied before the prices are.
const __calRows = () => { try { return $('Load Cost Calibration').all().map(i => i.json).filter(r => r && r.key && !r.error); } catch (e) { return []; } };
const __AI_CALLS = __AI_CALLS_JSON__;
const __chars = (v) => v == null ? 0 : (typeof v === 'string' ? v.length : JSON.stringify(v).length);
const __at = (o, p) => String(p).split('.').reduce((v, k) => (v == null ? v : v[k]), o);
const __jsonOf = (n) => { try { return ($(n).all() || []).map(i => (i && i.json) || {}); } catch (e) { return null; } };
const __qaRounds = () => { try { return Math.max(1, Number($('Content QA').first().json.qa_round) || 1); } catch (e) { return 1; } };
const __costCalls = [];
for (const c of __AI_CALLS) {
  const answers = __jsonOf(c.node);
  if (!answers || !answers.length) continue;   // the node did not run in this execution
  let prompt_chars = c.template_chars;
  const own = c.input ? (__jsonOf(c.input) || [])[0] : null;
  for (const f of c.fields) prompt_chars += __chars(__at(own || {}, f));
  for (const p of c.from) prompt_chars += __chars(__at((__jsonOf(p[0]) || [])[0] || {}, p[1]));
  const output_chars = answers.reduce((s, j) => s + (typeof j.output === 'string' ? j.output.length : __chars(j)), 0);
  __costCalls.push({ node: c.node, model: c.model, max_tokens: c.max_tokens, effort: c.effort, streaming: c.streaming,
    prompt_chars, output_chars, calls: answers.length * (c.loop ? __qaRounds() : 1) });
}
run_ledger.ai_cost = CC.runCost(__costCalls, CC.readCal(__calRows()).factors);
run_ledger.ai_usd = run_ledger.ai_cost.usd;
run_ledger.ai_cost_estimated = run_ledger.ai_cost.estimated;
"""
_ends51 = sorted(nm for nm in nodes if 'const run_ledger = {' in nodes[nm]['parameters'].get('jsCode', ''))
assert {'Build Word File', 'Build Full Report', 'Build Audit Report', 'Build Keyword File', 'Build Ladder Report'} <= set(_ends51), _ends51
for _n51 in _ends51:
    patch(_n51, "run_ledger.dataforseo_usd = +run_ledger.dataforseo_usd.toFixed(4);",
          "run_ledger.dataforseo_usd = +run_ledger.dataforseo_usd.toFixed(4);\n" + AI_COST_JS51.replace('__AI_CALLS_JSON__', json.dumps(_AI_CALLS51)))
    setcode(_n51, COST_SRC + '\n' + code(_n51))
    assert 'CC.runCost' in code(_n51) and 'const CC = (() =>' in code(_n51), _n51

# ---------- B. the stored calibration, read once before the guard counts ----------
_ert51 = pos('Ensure Run Ledger Table')
add_node('Ensure Cost Cache', DT_TYPE, DT_VERSION, dt_create_params(CACHE_TABLE51, CACHE_COLS51), [_ert51[0], _ert51[1] + 160], {'onError': 'continueRegularOutput', 'executeOnce': True})
add_node('Load Cost Calibration', DT_TYPE, DT_VERSION, dt_get_where_params(CACHE_TABLE51, 'kind', 'eq', 'cost'), [_ert51[0] + 110, _ert51[1] + 160], dict(LOAD18))
disconnect('Ensure Run Ledger Table', 'Run Ledger Row')
for _a51, _b51 in [('Ensure Run Ledger Table', 'Ensure Cost Cache'), ('Ensure Cost Cache', 'Load Cost Calibration'), ('Load Cost Calibration', 'Run Ledger Row')]:
    connect(_a51, _b51)

# ---------- C. the guard's estimate: one source, recalibrated, self-correcting ----------
_CHAIN51 = re.compile(r"// ---- estimated Claude spend guard ----\n.*?\ndfs_est = \+Number\(dfs_est\)\.toFixed\(4\);\n", re.S)
NEW_EST51 = """// ---- what this run reserves, in Claude money and in DataForSEO money (G23, 2026-10-13) ----
// Both per-mode tables used to be typed in this node and were never checked against the money: the re-rating measured them up to 13x out
// (`ai_visibility` reserved $0.06 and cost $0.79; backlinks $0.04 for $0.37; the written page $1.23 for about $0.46), which is why the day's
// guard refused five customer runs that would each have cost a fraction of what it held back. They now live once, in v5/code/_cost_cal.js,
// recalibrated from the measured runs of 2026-10-12 / 13, and CC.pick resolves this request against the SELF-CORRECTING figures the settles
// write into seo_cache (`cost:ai:<mode>` / `cost:dfs:<mode>`, read by Load Cost Calibration): the shipped default until the mode has settled
// runs, then its rolling figure with a quarter of headroom -- and never below what the mode has actually cost in its last runs.
const CAL = CC.readCal(__calRows());
const __ai = CC.pick('ai', d, CAL), __dfs = CC.pick('dfs', d, CAL);
let est = __ai.usd;          // Claude money: what ai_budget_usd guards
let dfs_est = __dfs.usd;     // DataForSEO money: carried on the row, settled with the measured amount (R9)
"""
CAL_HEAD51 = ("// G23 (2026-10-13): the shared cost kit (v5/code/_cost_cal.js) and the stored per-mode calibration this node prices with.\n"
              + COST_SRC
              + "\nconst __calRows = () => { try { return $('Load Cost Calibration').all().map(i => i.json).filter(r => r && r.key && !r.error); } catch (e) { return []; } };\n")
for _n51 in ('Rate Limit', 'Run Ledger Row'):
    _c51 = code(_n51)
    assert len(_CHAIN51.findall(_c51)) == 1, 'G23: the estimate block of ' + _n51 + ' did not match exactly once'
    setcode(_n51, CAL_HEAD51 + _CHAIN51.sub(lambda m: NEW_EST51, _c51))
    # the tables and the mode chain live in the kit now (inside its IIFE), not in the node
    assert "est = EST.describe" not in code(_n51) and "dfs_est = DFS_EST." not in code(_n51), 'G23: ' + _n51 + ' still resolves a mode with its own chain'
    assert "CC.pick('ai', d, CAL)" in code(_n51) and "CC.pick('dfs', d, CAL)" in code(_n51), 'G23: ' + _n51 + ' does not price the request through the kit'
patch('Rate Limit', "const __room = d.mode === 'case_study' ? EST.content : 0;   // reject the intake at once when the case-study page could not run today",
      "const __room = __ai.room;   // reject the case-study intake at once when the page run it spawns could not run today")
patch('Rate Limit', "d.dfs_spend_estimate_usd = dfs_est;",
      "d.dfs_spend_estimate_usd = dfs_est;\nd.cost_estimate_source = __ai.source;   // 'calibrated' once the mode has settled runs, 'default' until then\nd.cost_estimate_basis = __ai.basis;")
patch('Run Ledger Row', "  domain: String(d.domain || '').toLowerCase(), heavy, dfs_est_usd: dfs_est, dfs_usd: 0 } }];",
      "  domain: String(d.domain || '').toLowerCase(), heavy, dfs_est_usd: dfs_est, dfs_usd: 0,\n"
      "  // G23: the estimate keys this run is priced on (Claude|DataForSEO) and the honest split, which only a settle can fill in\n"
      "  cost_mode: __ai.key + '|' + __dfs.key, ai_usd: 0, measured_usd: 0, estimated_usd: +(Number(est || 0) + Number(dfs_est || 0)).toFixed(4),\n"
      "  cost_basis: 'reserved: Claude $' + Number(est || 0).toFixed(4) + ' ESTIMATED (' + __ai.basis + '), DataForSEO $' + Number(dfs_est || 0).toFixed(4) + ' ESTIMATED (' + __dfs.basis + ') - nothing measured yet' } }];")

# ---------- D. the settle: measured and estimated money kept apart, and the estimate taught ----------
_from51 = sorted({s for s, o in conns.items() for l in o.get('main', []) for t in l if t['node'] == 'Settle Run Ledger'})
assert len(_from51) >= 13, _from51
_sp51 = pos('Settle Run Ledger')
add_node('Run Ledger Settle', 'n8n-nodes-base.code', 2, {'jsCode': _rd51('code/Run_Ledger_Settle.js').replace('__ENDS__', json.dumps(_ends51))},
         [_sp51[0] - 200, _sp51[1] + 140], {'executeOnce': True})
for _s51 in _from51:
    disconnect(_s51, 'Settle Run Ledger'); connect(_s51, 'Run Ledger Settle')
connect('Run Ledger Settle', 'Settle Run Ledger')
nodes['Settle Run Ledger']['parameters']['columns']['value'].update({
    'settled_usd': '={{ $json.settled_usd }}', 'dfs_usd': '={{ $json.dfs_usd }}', 'ai_usd': '={{ $json.ai_usd }}',
    'cost_mode': '={{ $json.cost_mode }}', 'measured_usd': '={{ $json.measured_usd }}', 'estimated_usd': '={{ $json.estimated_usd }}',
    'cost_basis': '={{ $json.cost_basis }}'})
add_node('Cost Calibration Row', 'n8n-nodes-base.code', 2, {'jsCode': _rd51('code/Cost_Calibration_Row.js')}, [_sp51[0] + 220, _sp51[1] + 140], {'executeOnce': True})
if_node('Calibration To Save?', "{{ !$json.skip }}", [_sp51[0] + 440, _sp51[1] + 140])
add_node('Save Cost Calibration', DT_TYPE, DT_VERSION, dt_upsert_params(CACHE_TABLE51, CACHE_COLS51, 'key'), [_sp51[0] + 660, _sp51[1] + 140],
         {'onError': 'continueRegularOutput', 'alwaysOutputData': True})
connect('Settle Run Ledger', 'Cost Calibration Row'); connect('Cost Calibration Row', 'Calibration To Save?'); connect('Calibration To Save?', 'Save Cost Calibration', 0)

# ---------- E. harness shims and wiring (S60) ----------
open(os.path.join(OUT_CODE, '_cost_cal.js'), 'w').write(
    "// harness shim (written by build_v4.py section 51, G23): the shared cost kit as a runnable script. One item in, one call out:\n"
    "// { call: 'runCost' | 'callCost' | 'pick' | 'estOf' | 'calRow' | 'split' | 'readCal' | 'tables', ... }\n"
    + COST_SRC + """
return $input.all().map(i => { const j = i.json || {}; const fn = String(j.call || ''); const cal = CC.readCal(j.rows || []);
  if (fn === 'runCost') return { json: CC.runCost(j.calls || [], j.factors || cal.factors) };
  if (fn === 'callCost') return { json: CC.callCost(j.call_spec || {}, j.factors || cal.factors) };
  if (fn === 'pick') return { json: CC.pick(j.kind, j.request || {}, cal) };
  if (fn === 'estOf') return { json: CC.estOf(j.kind, j.key, cal) };
  if (fn === 'calRow') return { json: CC.calRow(j.kind, j.mode, j.amount, cal, !!j.measured) };
  if (fn === 'split') return { json: CC.split(j.ai || {}, j.dfs || {}) };
  if (fn === 'readCal') return { json: cal };
  if (fn === 'tables') return { json: { EST: CC.EST, DFS_EST: CC.DFS_EST, PRICES: CC.PRICES, UNKNOWN: CC.UNKNOWN, CHARS_PER_TOKEN: CC.CHARS_PER_TOKEN,
    THINK_SHARE: CC.THINK_SHARE, ALPHA: CC.ALPHA, HEADROOM: CC.HEADROOM, KEEP: CC.KEEP, CAP: CC.CAP, FACTOR_KEY: CC.FACTOR_KEY } };
  return { json: { error: 'unknown call ' + fn } }; });
""")
_cw51 = {'ai_calls': _AI_CALLS51,
         'intake': {'from': 'Ensure Run Ledger Table', 'ensure': 'Ensure Cost Cache', 'load': 'Load Cost Calibration',
                    'to': 'Run Ledger Row', 'table': CACHE_TABLE51, 'kind': 'cost'},
         'settle': {'code': 'Run Ledger Settle', 'update': 'Settle Run Ledger', 'from': _from51, 'ends': _ends51,
                    'writes': sorted(nodes['Settle Run Ledger']['parameters']['columns']['value'].keys()),
                    'match': [c['keyName'] for c in nodes['Settle Run Ledger']['parameters']['filters']['conditions']]},
         'calibrate': {'code': 'Cost Calibration Row', 'gate': 'Calibration To Save?', 'save': 'Save Cost Calibration',
                       'table': CACHE_TABLE51, 'match': [c['keyName'] for c in nodes['Save Cost Calibration']['parameters']['filters']['conditions']]}}
json.dump(_cw51, open(os.path.join(HERE0, 'harness', 'cost_wiring.json'), 'w'), indent=1, sort_keys=True)

# ---------- F. the asserts ----------
assert "'cost:ai:'" not in COST_SRC and "calKey = (kind, mode)" in COST_SRC, 'G23: the calibration key is not built in one place'
assert ('cost_mode', 'string') in RUN_LEDGER_COLS and ('ai_usd', 'number') in RUN_LEDGER_COLS and ('measured_usd', 'number') in RUN_LEDGER_COLS \
    and ('estimated_usd', 'number') in RUN_LEDGER_COLS and ('cost_basis', 'string') in RUN_LEDGER_COLS, \
    'G23: seo_run_ledger cannot say which part of a cost was measured (add the columns in ladder_common.py, then sync_tables.py on the next deploy)'
assert 'ai_visibility: 0.14' in COST_SRC and 'ai_visibility: 0.95' in COST_SRC, 'G23: ai_visibility still reserves the $0.06 that cost $0.79'
assert 'dfs_est_usd: 0.034' in rd('code/Assess_Ledger_Row.js'), "G23: the Keyword Check still reserves less than a check has measured"
assert 'cost_mode' in rd('code/Monitor_Ledger_Row.js') and 'cost_basis' in rd('code/Monitor_Ledger_Settle.js'), 'G23: a scheduled run settles without saying what was measured'
assert os.path.exists(os.path.join(HERE0, 'reconcile_claude_cost.py')), 'G23: the monthly reconciliation script is missing'
_rc51 = open(os.path.join(HERE0, 'reconcile_claude_cost.py'), encoding='utf-8').read()
assert '--apply' in _rc51 and 'dry run' in _rc51.lower() and 'cost:factor:claude' in _rc51, 'G23: the reconciliation does not write the factors the guard reads'
_cal51 = pos('Save Cost Calibration')
sticky("""### What Claude costs, and where the estimates come from (G23, 2026-10-13)
**The three Opus nodes stream** (`streaming: true`, required above ~21k tokens), and a streaming call reports **no token usage at all** — so the page run's Claude cost could only ever be stated as a range, and `settled_usd` stored the *reservation* while every reader took it for a measured cost. Each call is now priced from what the run really knows: the characters its prompt interpolated, the characters it answered with and the thinking budget of its effort level (`v5/code/_cost_cal.js`, the call table baked from the real model nodes). It travels as `run_ledger.ai_cost` with **`estimated: true`** and a basis in words, and **Run Ledger Settle** writes `ai_usd`, `dfs_usd`, `measured_usd`, `estimated_usd` and `cost_basis` — measured and estimated money are never added up as one figure.
**The estimates now come from the money.** They were up to **13x** out (`ai_visibility` reserved $0.06 and cost $0.79; backlinks $0.04 for $0.37; the page $1.23 for $0.46), which is why the guard refused five runs that cost a fraction of the reservation. Both tables are recalibrated from the measured runs and **self-correcting**: **Cost Calibration Row → Save Cost Calibration** moves each mode's rolling figure in `seo_cache` (`cost:ai:<mode>` / `cost:dfs:<mode>`) toward what the run cost, and the guard reserves `max(rolling x 1.25, the recent maximum)` — it may fall as a mode gets cheaper, never below what the mode actually cost.
**Once a month** the owner downloads the Anthropic Console usage export (CSV or JSON) and runs `reconcile_claude_cost.py` (dry run by default): it compares the month's ledger rows with the export per model, prints the correction factor and, with `--apply`, writes it to `cost:factor:claude`, which every price then goes through.""",
    _cal51[0] - 120, _cal51[1] + 180, 1120, 280, 6)
log("Claude's cost is a number and the estimates come from the money (2026-10-13, FIX_PLAN G23 + the re-rating's recalibration): every "
    "Claude call of a run is priced from the characters its prompt interpolated, the characters it answered with and the thinking budget of "
    "its effort level (v5/code/_cost_cal.js, the call table baked from the real model nodes - the three Opus nodes stream and report no token "
    "usage at all), the figure rides on run_ledger.ai_cost labelled estimated with its basis, and Run Ledger Settle settles the row with "
    "ai_usd / dfs_usd / measured_usd / estimated_usd / cost_basis so a measured amount is never added to an estimate; the per-mode tables "
    "(up to 13x out: ai_visibility reserved $0.06 and cost $0.79, backlinks $0.04 for $0.37, the page $1.23 for $0.46) are recalibrated from "
    "the measured runs of 2026-10-12 / 13 and self-correct on every settle (Load Cost Calibration -> Cost Calibration Row -> Save Cost "
    "Calibration, seo_cache cost:ai:<mode> / cost:dfs:<mode>: the rolling figure with a quarter of headroom, never below what the mode "
    "recently cost); and reconcile_claude_cost.py (dry run by default) reconciles a month of ledger rows against the owner's Anthropic "
    "Console usage export and writes one correction factor per model into cost:factor:claude")
# 53. A STORED RUNG NOBODY REVISITED, ALERTS ON STATISTICS, A PRE-RELEASE CHECK, AND TWO SMALL LIES (2026-10-13, system review
#     FIX_PLAN.md R16 / G28 / G27 and the re-rating's "Also seen"):
#       * R16 — the fit gate (D4 / D8) stops a NEW keyword, but nothing ever revisited the rows already stored: `seo_ladders` still
#         held rung 2 of lad_mv40b6s9h5a8 as "facts erp" (facts.ae, a competing UAE ERP vendor), `status: planned`, so the Rank
#         Tracker's delivered report of 2026-10-12 listed it and the Content Cadence would have written it. The gate now also runs on
#         the READ path: `fitStored` (added to `v5/code/_fit_gate.js`, never restructured) is the same gate plus the one rule a stored
#         row needs — a rung whose page is already written or published is kept and flagged, never silently dropped. The Content
#         Cadence leaves a set-aside rung out of what it writes (`set_aside` with the reason in the note and the callback) and marks
#         the row `set_aside` through *Ladder Marks*, so the app and the next run see the same thing; the Rank Tracker buys no check
#         for it and names it with its reason instead of asking for the page. `fix_brand_rungs.py` repairs the rows that exist today
#         (dry run by default; it never touches a rung whose page is written).
#       * G28 — the last fixed threshold in the site tracking. Clicks, impressions and sessions have been tested against their own
#         baseline since 2026-10-12 (`_site_stats.js`, two-sample Poisson z, minimum volumes, Google-update context), but a keyword's
#         position still alerted on "5 places while it was in the top 10" with no volume at all: Search Console's position is an
#         impression-weighted 28-day average, so five places on 12 impressions is one search. `ST.position` needs
#         `alert_min_position_impressions` (50) in BOTH periods before it calls a move real and tests the same keyword's clicks over
#         the same two periods; `ST.tested` puts the source, the two periods, the test and the confidence into every alert's words.
#       * G27 — a pre-release check: `POST /webhook/seo-prerelease` (built in `build_api.py`, workflow `SEOagentPreRel1`) runs the
#         key-page checks (G11) against a staging host or a URL list and answers `{ verdict, exit_code, failures, counts }`. It has no
#         Data Table node and no sub-workflow call, so it cannot write anything for a site, and whatever a staging host cannot answer
#         (index coverage, real-user speed, positions) comes back as `not_checked` with the reason.
#       * the re-rating's "Also seen", two of them: a ladder row stored before D10 carried free text as its page type and it travelled
#         unchanged into the brief, the schema and the content log — *Normalize Input* now maps it through the page-type kit and keeps
#         the sentence as `page_notes` with a note saying what happened; and the fix pack repeated the site's own LinkedIn `sameAs`
#         (the schema's spelling and the footer link's both survived the exact-string Set), so profiles are deduped by identity and the
#         file says which ones the homepage already lists and which are genuinely new.
# =============================================================================
# ---------- A. the page type of a row stored before D10 never reaches the brief as free text ----------
setcode('Normalize Input', PAGE_TYPE_SRC + "\n// 2026-10-13 (re-rating §3.2 \"Also seen\"): a ladder row written before D10 carries free text as its page type\n// (\"Service Page (ERP implementation UAE) with built-in vendor-neutral comparison…\"), and the cadence / \"Write now\" body passed it\n// straight on. PT.of maps anything to one of the form's options, PT.notes keeps the sentence for the brief.\n" + code('Normalize Input'))
patch('Normalize Input', "const pageType = (mode === 'case_study' || /case stud/i.test(pageType0)) ? 'Case Study' : /pillar|hub/i.test(pageType0) ? 'Pillar Page' : /^local/i.test(pageType0) ? 'Local Page' : (pageType0 || 'Service Page');",
      "const pageType = mode === 'case_study' ? 'Case Study' : PT.of(pageType0, 'Service Page');\n"
      "const page_notes = PT.notes(pageType0, pageType);   // the sentence itself, for the brief (strategy_brief.txt prints it)\n"
      "const page_type_note = (pageType0 && !PT.TYPES.includes(pageType0)) ? 'The page type \"' + pageType0.slice(0, 120) + '\" is not one of the page types we write, so it was read as \"' + pageType + '\"' + (page_notes ? ' and the rest kept as a note for the brief' : '') + '.' : '';")
patch('Normalize Input', "    page_type: pageType,", "    page_type: pageType,\n    page_notes,\n    page_type_note,")
assert 'const PT = (() => {' in code('Normalize Input') and 'PT.of(pageType0' in code('Normalize Input'), 'page type: Normalize Input does not normalise it'
# ---------- B. R16: the gate is part of the kit, and the harness can run it on a stored row ----------
assert 'const fitStored = ' in FIT_GATE_SRC and 'fitStoredLive' in FIT_GATE_SRC, 'R16: _fit_gate.js has no fitStored'
os.makedirs(OUT_CODE, exist_ok=True)
open(os.path.join(OUT_CODE, '_fit_stored.js'), 'w').write(
    "// harness shim (written by build_v4.py section 53): the fit gate over a STORED ladder row (R16) — { row, ctx } -> { ok, live, flagged, reason, detail, note }\n"
    + FIT_GATE_SRC + "\nreturn $input.all().map(i => { const j = i.json || {}; const row = j.row || j; const ctx = j.ctx || {};\n"
    "  return { json: { ...fitStored(row, ctx), keyword: row.keyword || '', gate: fitGate(row.keyword || '', ctx) } }; });\n")
# ---------- C. the fix pack never offers a profile the homepage already lists ----------
assert 'const profKey = ' in code('Fix Pack') and 'sameAs_new' in code('Fix Pack') and 'nothing new to add there' in code('Fix Pack'), 'fix pack: the sameAs profiles are not deduped by identity'
sticky("""### A stored rung nobody revisited, alerts on statistics, and a pre-release check (R16 · G28 · G27)
**R16 — the gate also reads what is already stored.** The keyword fit gate stopped new keywords; `seo_ladders` still held *"facts erp"* (a competitor's brand) as a planned rung, so the Rank Tracker reported it and the cadence would have written it. `fitStored` (in `_fit_gate.js`) now runs on the **read** path: the Content Cadence leaves such a rung out with its reason and marks the row **`set_aside`**, the Rank Tracker buys no check for it and names it instead of asking for the page. A rung whose page is already written is **kept and flagged**, never dropped. `fix_brand_rungs.py` repairs today's rows (dry run by default).
**G28 — the last fixed threshold is gone.** A keyword's position is an impression-weighted 28-day average: five places on 12 impressions is one search, not a drop. `ST.position` needs **50 impressions in both periods** before it calls a move real, tests the same keyword's clicks (Poisson z) and every alert now says **what was tested, over what period and how sure it is** (`ST.tested`), with Google's update dates as context.
**G27 — a pre-release check for CI.** `POST /webhook/seo-prerelease` runs the key-page checks (status, redirect, `noindex`, robots.txt, canonical, title, H1, description) against a **staging host or URL list** and answers `{ verdict, exit_code, failures, counts }`. It **writes nothing** (no Data Table node, no sub-workflow), and index coverage, real-user speed and positions come back as **`not_checked` with the reason** — a staging URL Google has never seen cannot be asked.
**Also:** a page type stored as free text is mapped to one of the form's options (the sentence kept as `page_notes`), and the fix pack no longer asks you to add a `sameAs` profile your homepage already lists.""",
    pos('Normalize Input')[0] - 40, pos('Normalize Input')[1] + 420, 1180, 300, 3)
log('A stored rung nobody revisited (2026-10-13, FIX_PLAN R16): the fit gate now also runs over the rows stored before it existed (fitStored in v5/code/_fit_gate.js) — the Content Cadence leaves a set-aside rung ("facts erp" -> facts.ae) out of what it writes, names it with its reason in the note and the callback and marks the ladder row `set_aside` through Ladder Marks; the Rank Tracker buys no position check for it and reports it with the reason instead of asking for the page; a rung whose page is already written is kept and only flagged; and fix_brand_rungs.py repairs the stored rows (dry run by default, never touching a rung whose page is written or published)')
log('Alerts on statistics, not on fixed percentages (2026-10-13, FIX_PLAN G28): the keyword-position alert was the last fixed threshold in the site tracking (5 places while the keyword was in the top 10, at any volume) — ST.position (v5/code/_site_stats.js) now needs alert_min_position_impressions (50) impressions in both 28-day periods before a move is called real, tests the same keyword\'s clicks over the same periods (two-sample Poisson z) and reports a big move on too little data as a "Watch" info line; every traffic and position alert carries ST.tested: the source, the two periods, the test and how sure it is, plus the Google update dates of the period from v5/data/seo_events.json')
log('A pre-release check a CI job can read (2026-10-13, FIX_PLAN G27): the new workflow SEO Agent — Pre-release Check (build_api.py, SEOagentPreRel1, POST /webhook/seo-prerelease, synchronous and free) runs the key-page checks of the daily watch (status, redirect, noindex, robots.txt, one canonical / title / H1, description) against a staging host or an explicit URL list and answers { verdict, exit_code, summary, counts, failures, warnings, not_checked, pages }; it has no Data Table node and no sub-workflow call, so it can never create a ladder row, a content-log row or an audit, and index coverage, real-user speed and positions come back as "not checked" with the reason because a staging URL Google has never seen cannot be asked')
log('Two small lies from the re-rating ("Also seen", 2026-10-13): a ladder row stored before D10 carried free text as its page type and it travelled unchanged into the brief, the schema and the content log — Normalize Input maps it through v5/code/_page_type.js, keeps the sentence as page_notes and says in page_type_note what it did; and the fix pack repeated the site\'s own LinkedIn sameAs (the schema spelling and the footer link both survived the exact-string Set), so profiles are deduped by identity and organization.jsonld says which ones the homepage already lists and which are genuinely new')
# 54. WHAT EXISTS ONLY AFTER JAVASCRIPT (2026-10-13, system review FIX_PLAN.md G14; CRITERIA_technical… 1.4)
#     The audit crawl can render JavaScript (DataForSEO on-page, `enable_javascript`), so a page whose heading, text, canonical or links
#     are written by a script looked perfectly healthy to us — while every crawler that does NOT render (all of today's AI crawlers, and
#     Google on its first pass) sees an empty shell. Nobody ever compared the two readings.
#     Each audit now reads its key pages **twice**: the raw first response (*Fetch Raw Pages*, a plain GET) and the page after its scripts
#     ran (*Render Key Pages*, the Jina Reader render path of v5/code/Render_Requests.js, `X-Return-Format: html`; the JavaScript crawl
#     stands in only when it really rendered). *Render Diff* reads title, main heading, canonical link, robots meta, link count and text
#     length from both with the same parser, flags what exists only after JavaScript and prints which of the two every figure came from.
#     Two rules it keeps: URLs are compared host-agnostically (a www. crawl URL against a bare canonical is not a mismatch), and a reading
#     that failed is **"not checked" with the reason** — never "no difference". Both fetches are free and capped at
#     CONFIG.render_diff_pages (5) pages per audit; both carry the G1 retry rule.
# =============================================================================
import retry_lint as _rl54
LK_SRC54 = _rd0('code/_link_kit.js').rstrip('\n')

# how many key pages are read twice (free; the cap travels with the run like every other limit)
patch('Normalize Input', "  live_serp_checks: 16,\n",
      "  live_serp_checks: 16,\n"
      "  // G14 (2026-10-13): how many key pages of an audit are read twice — the raw first response and the rendered page — so the\n"
      "  // report can say what only exists after JavaScript. Both fetches are free (a plain GET and one render); 5 covers the homepage\n"
      "  // plus the four pages Search Console says earn the most.\n"
      "  render_diff_pages: 5,\n")
patch('Normalize Input', "    heavy_audit_pages: CONFIG.heavy_audit_pages,\n", "    heavy_audit_pages: CONFIG.heavy_audit_pages,\n    render_diff_pages: CONFIG.render_diff_pages,\n")

# ---------- the chain, between the speed figures and the scoring (both audit types pass through it) ----------
_ac54 = pos('Analyze CrUX'); RX, RY = _ac54[0] + 220, _ac54[1]
disconnect('Analyze CrUX', 'Build Site Issues')
add_node('Render Diff Targets', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Render_Diff_Targets.js')}, [RX, RY])
if_node('Any Render Diff?', '{{ !$json.skip }}', [RX + 220, RY])
add_node('Render Key Pages', 'n8n-nodes-base.httpRequest', 4.5, {
    'url': '=https://r.jina.ai/{{ $json.url }}', 'authentication': 'genericCredentialType', 'genericAuthType': 'httpHeaderAuth',
    'sendHeaders': True, 'headerParameters': {'parameters': [
        {'name': 'X-Return-Format', 'value': 'html'},   # the HTML after the scripts ran, with the links and their rel attributes
        {'name': 'X-Engine', 'value': 'browser'},
        {'name': 'X-No-Cache', 'value': 'true'},
        {'name': 'X-Timeout', 'value': '45'}]},
    'options': {'batching': {'batch': {'batchSize': 1, 'batchInterval': 4000}}, 'timeout': 60000,
                'response': {'response': {'fullResponse': True, 'neverError': True, 'responseFormat': 'text'}}}},
    [RX + 440, RY - 160], dict(onError='continueRegularOutput', alwaysOutputData=True, **_rl54.RETRY))
nodes['Render Key Pages']['credentials'] = {'httpHeaderAuth': {'id': 'SEOcredJinaReade', 'name': 'Jina Reader'}}
add_node('Raw Page Targets', 'n8n-nodes-base.code', 2, {'jsCode': rd('code/Raw_Page_Targets.js')}, [RX + 660, RY - 160])
add_node('Fetch Raw Pages', 'n8n-nodes-base.httpRequest', 4.5, {
    'url': '={{ $json.url }}', 'sendHeaders': True, 'headerParameters': {'parameters': [
        {'name': 'User-Agent', 'value': 'Mozilla/5.0 (compatible; SEOAgentAudit/1.0; +https://www.google.com/bot.html)'},
        {'name': 'Accept', 'value': 'text/html,application/xhtml+xml'}]},
    'options': {'batching': {'batch': {'batchSize': 1, 'batchInterval': 500}}, 'timeout': 20000,
                'redirect': {'redirect': {'followRedirects': True, 'maxRedirects': 5}},
                'response': {'response': {'fullResponse': True, 'neverError': True, 'responseFormat': 'text'}}}},
    [RX + 880, RY - 160], dict(onError='continueRegularOutput', alwaysOutputData=True, **_rl54.RETRY))
add_node('Render Diff', 'n8n-nodes-base.code', 2, {'jsCode': LK_SRC54 + '\n' + rd('code/Render_Diff.js')}, [RX + 1100, RY])
for _a54, _b54 in [('Analyze CrUX', 'Render Diff Targets'), ('Render Diff Targets', 'Any Render Diff?'),
                   ('Render Key Pages', 'Raw Page Targets'), ('Raw Page Targets', 'Fetch Raw Pages'),
                   ('Fetch Raw Pages', 'Render Diff'), ('Render Diff', 'Build Site Issues')]:
    connect(_a54, _b54)
connect('Any Render Diff?', 'Render Key Pages', 0); connect('Any Render Diff?', 'Render Diff', 1)

# ---------- the scored audit carries the diff, and says when it could not be made ----------
patch('Build Site Issues', "      crux: input.crux || null,\n", "      crux: input.crux || null,\n      render_diff: input.render_diff || null,\n")
patch('Build Site Issues', "if (!input.content_review) not_assessed.push('Content quality and E-E-A-T review (authors, case studies, claims, pricing)');",
      "if (!(input.render_diff && input.render_diff.available)) not_assessed.push('What crawlers see before JavaScript runs (the first response against the rendered page, per key page): ' + ((input.render_diff && input.render_diff.not_available) || 'not collected in this run'));\n"
      "if (!input.content_review) not_assessed.push('Content quality and E-E-A-T review (authors, case studies, claims, pricing)');")

# ---------- both audit reports: the figure-by-figure table, with the reading each number came from ----------
RD_SECTION_JS = r"""// ---- what crawlers see before JavaScript runs (G14, 2026-10-13) ----
const renderDiffSection = (a) => {
  const rdf = a.render_diff || null;
  const e3 = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const val = (v) => { const s = String(v == null ? '' : v); return s ? e3(s).slice(0, 110) : '—'; };
  let h = `<h3>What crawlers see before JavaScript runs</h3>`;
  if (!rdf) return h + `<p>Not checked in this run.</p>`;
  if (!rdf.available) return h + `<p><b>Not checked:</b> ${e3(rdf.not_available)}.</p>`;
  const rows = [];
  for (const p of (rdf.pages || [])) {
    if (!p.checked) { rows.push(`<tr><td>${e3(p.path)}</td><td colspan="4" class="small"><b>not checked</b> — ${e3(p.not_checked)}</td></tr>`); continue; }
    for (const f of (p.figures || [])) {
      if (f.state === 'same' || f.state === 'absent') continue;
      rows.push(`<tr><td>${e3(p.path)}</td><td>${e3(f.figure)}</td><td>${val(f.raw)}</td><td>${val(f.rendered)}</td><td class="small">${e3(f.from)}</td></tr>`);
    }
  }
  h += rows.length
    ? `<table class="ct"><tr><th>Page</th><th>Figure</th><th>In the first response</th><th>After JavaScript</th><th>Taken from</th></tr>` + rows.join('') + `</table>`
    : `<p><span class="ok">No difference</span> on any of the ${rdf.pages_checked} key page(s) checked: title, main heading, canonical link, robots rule, links and text are all in the first response.</p>`;
  h += `<p class="small">${e3(rdf.method)} ${rdf.pages_checked} page(s) read twice${rdf.pages_not_checked ? `, ${rdf.pages_not_checked} not checked (the reason is in the table)` : ''}${rdf.rendered_source === 'crawl_js' ? '; the rendered reading came from the JavaScript crawl' : ''}. AI crawlers do not run JavaScript, so anything listed as coming from the rendered page is invisible to them.</p>`;
  return h;
};
"""
for _rn54 in ('Build Audit Report', 'Build Full Report'):
    patch(_rn54, "const findings = a.findings || [];", RD_SECTION_JS + "const findings = a.findings || [];")
    patch(_rn54, "    search_console: a.search_console || null,\n    crux: a.crux || null,", "    search_console: a.search_console || null,\n    crux: a.crux || null,\n    render_diff: a.render_diff || null,")
patch('Build Audit Report', "html += cwvSection(a);", "html += cwvSection(a);\nhtml += renderDiffSection(a);")
patch('Build Full Report', "html += cwvSection(a) + '<h3>Findings</h3>' + findingsBlock(byCat('Performance'));",
      "html += cwvSection(a) + renderDiffSection(a) + '<h3>Findings</h3>' + findingsBlock(byCat('Performance'));")
patch('Build Audit Response', "crux: d.crux || null,", "crux: d.crux || null, render_diff: d.render_diff || null,")

assert 'const LK = (() => {' in code('Render Diff'), 'Render Diff: the link kit is not inlined (G14)'
assert 'const SM = (() => {' in code('Render Diff Targets'), 'Render Diff Targets: the site model kit is not inlined (G14)'
assert nodes['Render Key Pages'].get('credentials'), 'Render Key Pages: Jina credential slot missing (G14)'
for _hn54 in ('Render Key Pages', 'Fetch Raw Pages'):
    assert not _rl54.weak(nodes[_hn54]), _hn54 + ': the G1 retry rule is missing'
assert 'renderDiffSection' in code('Build Audit Report') and 'renderDiffSection' in code('Build Full Report'), 'the render diff is not in both audit reports'
# the two lints run again here: both new HTTP nodes were added after the last pass (G1 retry rule, D15 canonical host)
url_lint.check({'nodes': list(nodes.values()), 'name': 'SEO Agent v4'})
retry_lint.check({'nodes': list(nodes.values()), 'name': 'SEO Agent v4'})
log('What exists only after JavaScript (2026-10-13, FIX_PLAN G14): every audit reads up to CONFIG.render_diff_pages (5) key pages twice — the raw first response (Fetch Raw Pages, a plain GET) and the page after its scripts ran (Render Key Pages, the Jina render path, with the JavaScript crawl standing in only when it really rendered) — and Render Diff compares title, main heading, canonical link, robots meta, link count and text length with one parser, flags what exists only after JavaScript as a High / Medium finding plus an AI Search Readiness finding, and prints which of the two readings every figure came from in both audit reports and in the callback; URLs are compared host-agnostically (a www. crawl URL against a bare canonical is not a mismatch) and a reading that failed is "not checked" with the reason (bot challenge, HTTP error, DNS, empty body), never "no difference"')

# ---------- G31: a style guide that is stored, used in every writing prompt and checked (FIX_PLAN.md G31; criterion CAD C17) ----------
#     Nothing stored how the customer writes. The brand's own written form ("Tech&", never "Tech and" or "techand"), the spelling variant
#     (the market the page targets decided it, so a UAE site writing American English was corrected into British English on every page),
#     the words they do not want used and the tone existed nowhere, so no prompt carried them and no check caught a draft that broke them.
#     **Where it is stored: the site's business profile row (`seo_profiles.style_*`)** — not app site settings — for three reasons: every
#     content run, the Content Cadence and the AI pages already load that row (*Load Profile (Brief)*), so the guide costs no new read, node
#     or API call; it is already the one "how we present ourselves" record (author, reviewer, NAP), editable through the existing `profile`
#     mode and the app's profile form; and Content QA can only score a rule that lives in the engine's own store (the app's `sites.tone` is
#     a free-text prompt hint that reaches content runs only and cannot be checked).
#     v5/code/_style_guide.js (ST) holds all of it: ST.from(row, defaults) builds the guide (spelling and tone fall back to the market /
#     the request), ST.block(guide) is the HOUSE STYLE paragraph the brief, copywriter and editor prompts print, and ST.check(markdown)
#     runs the mechanical checks. The brand's own name written wrongly is a real quality finding (a warning, so the editor corrects it and
#     the page does not pass as it is); the spelling variant, the words to avoid and the tone are **advice** — reported beside the page like
#     the other notes, never a reason on their own for a page to be "not ready".
STYLE_SRC = _rd0('code/_style_guide.js').rstrip('\n')
assert 'const ST = (() => {' in STYLE_SRC and 'function check(' in STYLE_SRC, 'the style kit has no check (G31)'
for _sn54 in ('Brief Context', 'Content QA', 'Profile Delivery'):
    assert 'const ST = (() => {' not in code(_sn54), _sn54 + ': the style kit is already inlined'
    setcode(_sn54, STYLE_SRC + '\n' + code(_sn54))

# A. the intake: the six fields on the profile form / `style` in the API body, and a style guide alone is enough to submit the form
insert_fields('Page Profile', 'Logo URL (optional)', [
    {'fieldLabel': 'How your brand name is written', 'placeholder': 'exactly as it must appear, e.g. Tech& (never "Tech and" or "techand")'},
    {'fieldLabel': 'Spelling', 'placeholder': 'British English or American English - leave empty to follow the market you target'},
    {'fieldLabel': 'Words to avoid', 'placeholder': 'comma separated, e.g. cutting-edge, synergy, solutions provider'},
    {'fieldLabel': 'How you want to sound', 'placeholder': 'e.g. plain and direct, no hype, never an exclamation mark'},
    {'fieldLabel': 'Other style rules', 'fieldType': 'textarea', 'placeholder': 'anything else every page must follow'}])
nodes['Page Profile']['parameters']['options']['formDescription'] = nodes['Page Profile']['parameters']['options']['formDescription'].replace(
    'and local pages carry your verified name, address, phone and hours (LocalBusiness schema).',
    'and local pages carry your verified name, address, phone and hours (LocalBusiness schema). The style guide at the bottom is followed by every page we write and checked before delivery.')
patch('Normalize Input', "const A = obj(p2.author), R = obj(p2.reviewer), AD = obj(p2.address), CS = obj(p2.case_study), VI = obj(p2.video);",
      "const A = obj(p2.author), R = obj(p2.reviewer), AD = obj(p2.address), CS = obj(p2.case_study), VI = obj(p2.video), STY = obj(p2.style);   // G31: the stored style guide")
patch('Normalize Input', "  reviewer_name: s0(R.name || revParts[0], 120), reviewer_job_title: s0(R.job_title || R.title || revParts.slice(1).join(', '), 160), reviewer_url: s0(R.url || revUrl, 400)\n};",
      "  reviewer_name: s0(R.name || revParts[0], 120), reviewer_job_title: s0(R.job_title || R.title || revParts.slice(1).join(', '), 160), reviewer_url: s0(R.url || revUrl, 400),\n"
      "  // G31 (2026-10-13): how this customer writes. The spelling variant is empty unless they chose one, and then it beats the market default.\n"
      "  style_brand_form: s0(STY.brand_form || STY.brandForm || p2.style_brand_form || lab('How your brand name is written'), 160),\n"
      "  style_brand_wrong: asArray(STY.brand_wrong || STY.brandWrong || p2.style_brand_wrong).map(x => s0(x, 80)).filter(Boolean).slice(0, 12).join(', '),\n"
      "  style_spelling: s0(STY.spelling || p2.style_spelling || lab('Spelling'), 40),\n"
      "  style_avoid: asArray(STY.avoid || STY.avoid_words || STY.avoidWords || p2.style_avoid || lab('Words to avoid')).map(x => s0(x, 60)).filter(Boolean).slice(0, 40).join(', '),\n"
      "  style_tone: s0(STY.tone || p2.style_tone || lab('How you want to sound'), 300),\n"
      "  style_notes: s0(STY.notes || p2.style_notes || lab('Other style rules'), 600)\n};")
patch('Normalize Input', "if (mode === 'profile' && !['author_name', 'business_name', 'street_address', 'phone', 'reviewer_name'].some(k => profile_input[k])) throw new Error('Please fill in at least the author name or the business details.');",
      "if (mode === 'profile' && !['author_name', 'business_name', 'street_address', 'phone', 'reviewer_name', 'style_brand_form', 'style_spelling', 'style_avoid', 'style_tone'].some(k => profile_input[k])) throw new Error('Please fill in at least the author name, the business details or your style guide.');")
patch('Normalize Input', "    profile_input: (mode === 'profile' || profile_input.author_name || profile_input.reviewer_name) ? profile_input : null,",
      "    profile_input: (mode === 'profile' || profile_input.author_name || profile_input.reviewer_name || profile_input.style_brand_form) ? profile_input : null,")

# B. the row that is stored (the upsert maps exactly the table columns)
patch('Profile Row', "'reviewer_name', 'reviewer_job_title', 'reviewer_url'];",
      "'reviewer_name', 'reviewer_job_title', 'reviewer_url',\n  'style_brand_form', 'style_brand_wrong', 'style_spelling', 'style_avoid', 'style_tone', 'style_notes'];   // G31 (2026-10-13): the stored style guide")
patch('Profile Delivery', "const summary = (stored ?", "const style_guide = ST.from(r, {});   // G31: what is on file about how they write\nconst summary = (stored ?")
patch('Profile Delivery', "const plain = summary + (missE.length ?",
      "const style_line = style_guide.on_file\n"
      "  ? 'House style on file: ' + [style_guide.brand_form ? 'the name written \"' + style_guide.brand_form + '\"' : '', style_guide.spelling ? style_guide.spelling + ' spelling' : '', style_guide.avoid.length ? style_guide.avoid.length + ' word(s) to avoid' : '', style_guide.tone ? 'tone \"' + style_guide.tone + '\"' : ''].filter(Boolean).join(', ') + '. Every new page follows it and the quality check reports a draft that breaks it.'\n"
      "  : 'No style guide on file yet: how your name is written, the spelling variant, words to avoid and the tone. Fill it in once and every page follows it.';\n"
      "const plain = summary + '\\n\\n' + style_line + (missE.length ?")
patch('Profile Delivery', "eeat_score: score(eeat), local_score: score(local), schema_preview: { person, local_business: localBusiness }, stored, store_error, summary, plain, status: 'completed', stage: 'profile' } }];",
      "eeat_score: score(eeat), local_score: score(local), schema_preview: { person, local_business: localBusiness }, style_guide, style_line, stored, store_error, summary, plain, status: 'completed', stage: 'profile' } }];")
patch('Build Profile Response', "schema_preview: p.schema_preview,", "schema_preview: p.schema_preview, style_guide: p.style_guide || null, style_line: p.style_line || '',")

# C. the guide reaches every writing prompt (the brief, the copywriter and the editor already print $json.spelling / $json.tone)
patch('Brief Context', "return [{ json: { ...d, site_profile, author, reviewer, proof_library, page_role, article_like, hub_pages, hub_pages_planned: hub_planned, video, case_study: cs, local_area: area,",
      "// G31 (2026-10-13): the stored style guide. A spelling variant the customer chose beats the one the target market implies, and their\n"
      "// own tone beats the request's; both travel as `spelling` / `tone`, which the brief, copywriter and editor prompts already print.\n"
      "const style_guide = ST.from(P, { spelling: s(d.spelling), tone: s(d.tone) });\n"
      "return [{ json: { ...d, style_guide, spelling: style_guide.spelling_effective || s(d.spelling), tone: style_guide.tone || s(d.tone),\n"
      "  site_profile, author, reviewer, proof_library, page_role, article_like, hub_pages, hub_pages_planned: hub_planned, video, case_study: cs, local_area: area,")
for _pn54, _anchor54 in (('Strategy Brief', 'PAGE DETAILS\nTarget Keyword:'), ('Copywriter', 'PAGE\nTarget Keyword:'), ('Editor', 'TARGET\nPrimary keyword:')):
    _t54 = nodes[_pn54]['parameters']['text']
    assert _t54.count(_anchor54) == 1, _pn54 + ': prompt anchor moved (G31)'
    nodes[_pn54]['parameters']['text'] = _t54.replace(_anchor54, "{{ ($json.style_guide || {}).prompt_block || '' }}\n\n" + _anchor54)
    assert 'style_guide' in nodes[_pn54]['parameters']['text'], _pn54 + ': the house style block is missing (G31)'

# D. the mechanical check, next to the other quality checks: the brand's name is a warning, the rest is advice
patch('Content QA', "// FIX_PLAN D10: a page nobody can publish never passes — more than PH_MAX placeholders, or more than 25% over the brief's target (which is",
      "// G31 (2026-10-13): the customer's stored style guide, checked mechanically (v5/code/_style_guide.js). The brand's own name written\n"
      "// wrongly is a real quality finding and goes into `warnings`, so the editor corrects it and the page does not pass as it is. The\n"
      "// spelling variant, the words to avoid and the tone are advice: they are reported beside the page and never make it \"not ready\".\n"
      "const style_guide = prev.style_guide || null;\n"
      "const style = ST.check(md, style_guide);\n"
      "for (const e of style.errors) warnings.push(e);\n"
      "const style_notes = [...style.notes];\n"
      "\n"
      "// FIX_PLAN D10: a page nobody can publish never passes — more than PH_MAX placeholders, or more than 25% over the brief's target (which is")
patch('Content QA', "schema_types: blocks.map(b => b.type), eeat_notes, page_role: role, auto_fixes: fixes, warnings } } }];",
      "schema_types: blocks.map(b => b.type), eeat_notes, style, style_notes, style_guide: style_guide && style_guide.on_file ? style_guide : null, page_role: role, auto_fixes: fixes, warnings } } }];")

# E. the report and the package say what the style guide asked for and what the draft did with it
patch('Build Word File', "  parts.push(h2('Author, Trust & Page Extras') + kv(extraRows) + ((qa.eeat_notes || []).length ? '<h3>Before publishing</h3>' + ul(qa.eeat_notes) : ''));",
      """  parts.push(h2('Author, Trust & Page Extras') + kv(extraRows) + ((qa.eeat_notes || []).length ? '<h3>Before publishing</h3>' + ul(qa.eeat_notes) : ''));
  // ---- G31: the customer's own style guide, and what the draft did with it ----
  const sg = qa.style_guide || null, st = qa.style || null;
  if (sg || (st && (st.notes || []).length)) {
    const sgRows = [];
    if (sg && sg.brand_form) sgRows.push(['Brand name is written', esc(sg.brand_form) + ((sg.wrong_forms || []).length ? ' <span class="small">(never ' + sg.wrong_forms.map(w => esc(w)).join(', ') + ')</span>' : '')]);
    if (sg && sg.spelling_effective) sgRows.push(['Spelling', esc(sg.spelling_effective) + ' <span class="small">(' + esc(sg.spelling_source || 'house style') + ')</span>']);
    if (sg && (sg.avoid || []).length) sgRows.push(['Words to avoid', esc(sg.avoid.join(', '))]);
    if (sg && sg.tone) sgRows.push(['Tone', esc(sg.tone)]);
    if (sg && sg.notes) sgRows.push(['Other rules', esc(sg.notes)]);
    const brandErr = st && (st.brand || []).length ? st.brand.map(b => 'The name was written "' + b.found + '" ' + b.count + ' time(s)') : [];
    parts.push(h2('Your Style Guide') + (sgRows.length ? kv(sgRows) : '<p>No style guide on file: set the brand\\'s written form, the spelling variant, words to avoid and the tone once, and every page follows them.</p>')
      + (brandErr.length ? '<h3>Corrected before delivery</h3>' + ul(brandErr) : '')
      + ((st && (st.notes || []).length) ? '<h3>Style notes (advice, not blockers)</h3>' + ul(st.notes) : (sgRows.length ? '<p class="ok">The draft matches every mechanical rule of your style guide.</p>' : '')));
  }""")
patch('Build Word File', "content_brief_video_placement: brief.video_placement || '', eeat_notes: qa.eeat_notes || [], page_type: d.page_type || ''",
      "content_brief_video_placement: brief.video_placement || '', eeat_notes: qa.eeat_notes || [], style_notes: qa.style_notes || [], style_guide: qa.style_guide || null, page_type: d.page_type || ''")
patch('Blog Package', "eeat_notes: Array.isArray(d.eeat_notes) ? d.eeat_notes : [],", "eeat_notes: Array.isArray(d.eeat_notes) ? d.eeat_notes : [],\n  style_notes: Array.isArray(d.style_notes) ? d.style_notes : [],   // G31: the style advice travels with the package (meta.json)")

assert "ST.check(md, style_guide)" in code('Content QA') and 'ST.from(P,' in code('Brief Context'), 'the style guide is not wired into the content run (G31)'
assert 'style_brand_form' in code('Profile Row') and 'style_brand_form' in code('Normalize Input'), 'the style guide is not stored (G31)'
log('A style guide that is stored, used and checked (2026-10-13, FIX_PLAN G31): the brand\'s written form ("Tech&"), extra wrong forms, the spelling variant, the words to avoid, the tone and any further rule live on the site\'s business profile row (seo_profiles.style_*, filled through the profile form / API `style`), so every run that already loads the profile carries them at no extra cost; v5/code/_style_guide.js (ST) turns the row into the HOUSE STYLE paragraph the Strategy Brief, Copywriter and Editor prompts print and overrides the market-derived spelling and the requested tone, and Content QA checks it mechanically — the brand\'s own name written wrongly is a quality warning the editor must fix, while the spelling variant, the words to avoid and exclamation marks against a stated tone are advice printed in the report and the package (meta.json) that can never on its own make a page "not ready"')

# 52. THE LAST FOUR LINK-BUILDER GAPS (2026-10-13, system review FIX_PLAN.md L4 / L5 / L6 / L7)
#     * L5 two more free sources. **Podcast guest opportunities**: a free podcast directory is searched for the site's topics once a
#       month, every show's RSS feed is read (the feed's <link> is the only place that names the show's OWN website), that website is
#       fetched, and the show becomes a prospect only when it is on topic, still publishing, says somewhere that it takes guests and
#       has a contact on its own domain — an address on a podcast platform or a free mailbox belongs to nobody we could write to about
#       the show. `SEO_PODCASTINDEX_API_KEY` / `_SECRET` are in n8n/.env.seo.example as placeholders: the Podcast Index API signs every
#       request with sha1(key + secret + unix time), which no n8n credential can produce and no node may compute (a node would have to
#       hold the secret, and $env is blocked in nodes on this instance), so the free directory is read today — `PC.shows()` already
#       takes both answers, so only the URL changes when a signing step exists. **Journalist digests** (HARO / Source of Sources)
#       arrive in the customer's own mailbox, so the web app parses them (app/shared/src/digest.ts, the inbox poller) and writes one
#       `digest` prospect per request; with no mailbox connected nothing arrives and nothing happens (fix-plan O4). Both kinds go
#       through the same gates as every other prospect: OK.noPitch, the declared-competitor check, the topic fit, the draft gate.
#     * L6 **linkable-asset ideas**: the competitors' most-linked pages (DataForSEO `backlinks/domain_pages`, monthly, about $0.02 a
#       competitor) are grouped into the kinds of page that earn links in this market — data study, free tool, template, definitive
#       guide — and at most four ideas are offered, each with the competitor pages that prove it and the referring domains they hold.
#       An idea says what it is based on and what the work is; it is never presented as a promise of links.
#     * L7 **subject-line A/B**: the writer gives every sequence a second subject in the other style (style A names what we found,
#       style B asks the one question), the draft gate checks it like the first, and the drafts of a batch take the two in turn, so the
#       two styles go out in equal numbers. Reading them is the app's job (app/shared/src/outreach.ts), and the rule is one
#       implementation shared with v5/code/_ab.js: **under 30 first e-mails per variant nothing may be called better** — the counts are
#       shown with "not enough sends yet". This changes which subject a draft carries, never what is sent: every pitch still waits for
#       a person's approval.
#     * L4 (Gmail / Microsoft 365 OAuth mailboxes) is entirely in the web app (app/server/src/services/mailOauth.ts and the Mailboxes
#       tab): n8n never holds a customer's mailbox.
# =============================================================================
_L52 = {p: open(os.path.join(HERE0, 'v5', 'code', p + '.js')).read() for p in ('_podcast', '_ab', 'LB_Plan', 'LB_Source_Requests', 'LB_Page_Requests', 'LB_Second_Requests', 'LB_DFS_Requests', 'LB_Assemble', 'LB_Draft_QA', 'LB_Rows', 'LB_Report', '_outreach_kit')}
_P52 = open(os.path.join(HERE0, 'v5', 'prompts', 'link_outreach.txt')).read()
# L5: the podcast chain is three hops — search (Sources) -> feed (Pages) -> the show's own site and its contact page (Second)
assert "add(p, 'podcast_search', PC.searchUrl(" in _L52['LB_Source_Requests'], 'L5: no podcast search'
assert "'podcast_feed'" in _L52['LB_Page_Requests'] and "PC.shows(" in _L52['LB_Page_Requests'], 'L5: the shows are not read'
assert "'podcast_site'" in _L52['LB_Second_Requests'] and 'PC.feed(' in _L52['LB_Second_Requests'], "L5: the show's own site is never fetched"
assert "no contact on the show" in _L52['LB_Assemble'] and 'PC.guestSignal(' in _L52['LB_Assemble'], 'L5: the podcast gates are missing'
assert "x.type === 'digest'" in _L52['LB_Assemble'], 'L5: digest requests never become pitches'
assert "['reclaim', 'digest'].includes(x.type)" in _L52['LB_Page_Requests'], 'L5: a digest prospect has no page of its own to fetch'
for _k in ('digest', 'podcast'):
    assert _k in _L52['_outreach_kit'].split('SELL_EXEMPT = new Set(')[1].split(')')[0], 'L5: ' + _k + ' is not exempt from the vendor check'
    assert _k in _P52, 'L5: the writer is not told about ' + _k
assert 'PC.INDEX' not in _L52['LB_Source_Requests'] and 'PC.searchUrl(t, false)' in _L52['LB_Source_Requests'], 'L5: the signed Podcast Index path cannot be used yet (no node may hold the secret)'
# L6: the competitors' most-linked pages, the kinds, and the evidence under every idea
assert 'domain_pages/live' in _L52['LB_DFS_Requests'] and "kind: 'pages'" in _L52['LB_DFS_Requests'], 'L6: domain_pages is never asked for'
assert "(r.kind || 'broken') !== 'broken'" in _L52['LB_Page_Requests'], 'L6: the two DataForSEO answers are not told apart'
assert 'ASSET_KINDS' in _L52['LB_Assemble'] and 'asset_ideas' in _L52['LB_Assemble'] and 'basis:' in _L52['LB_Assemble'], 'L6: no asset ideas'
assert 'Assets that earn links in your market' in _L52['LB_Report'] and 'no asset is a promise of links' in _L52['LB_Report'], 'L6: the ideas are not reported with their basis'
# L7: two subjects, both checked, taken in turn; the 30-send rule in one place
assert 'subject_b' in _P52 and 'subject_b' in _L52['LB_Draft_QA'], 'L7: no second subject'
assert 'AB.altOk(' in _L52['LB_Draft_QA'] and 'AB.variantFor(' in _L52['LB_Rows'], 'L7: the variants are not assigned or not checked'
assert 'MIN_SENDS = 30' in _L52['_ab'] and 'not enough sends yet' in _L52['_ab'], 'L7: the 30-send rule is missing'
# the harness shims (S61): each kit as a runnable script, one call per item
os.makedirs(OUT_CODE, exist_ok=True)
open(os.path.join(OUT_CODE, '_ab.js'), 'w').write(
    "// harness shim (written by build_v4.py section 52): the subject-line A/B rule — { variants: [{ variant, subject, sent, replied }] }\n"
    "// -> the counts per variant, whether they may be read at all, and the one line the app shows\n"
    + _L52['_ab'] + "\nreturn $input.all().map(i => { const j = i.json || {};\n"
    "  return { json: { ...AB.read(j), alt_why: j.alt === undefined ? null : AB.altOk(j.alt, j.first), variant_for: [0, 1, 2, 3].map(AB.variantFor) } }; });\n")
open(os.path.join(OUT_CODE, '_podcast.js'), 'w').write(
    "// harness shim (written by build_v4.py section 52): the podcast kit — a search answer (Apple or Podcast Index), an RSS feed, the\n"
    "// guest signal and the staleness rule\n"
    + _L52['_podcast'] + "\nreturn $input.all().map(i => { const j = i.json || {};\n"
    "  return { json: { shows: j.search ? PC.shows(j.search) : [], feed: j.xml ? PC.feed(j.xml) : null, guest: j.texts ? PC.guestSignal(j.texts) : null,\n"
    "    stale: j.last === undefined ? null : PC.stale(j.last, j.now), url: PC.searchUrl(j.topic || 'e invoicing uae', !!j.signed), stale_days: PC.STALE_DAYS } }; });\n")
log('Two more free link sources, asset ideas from the market, and two subjects a batch (2026-10-13, FIX_PLAN L5 / L6 / L7): podcast shows that take guests (a free directory a month -> the show\'s RSS feed -> its own website; pitched only when it is on topic, still publishing, says it takes guests and has a contact on its own domain) and journalist digests (HARO / Source of Sources, parsed by the app from the customer\'s own mailbox into `digest` prospects, nothing until a mailbox is connected) both run through the same gates as every other prospect; the competitors\' most-linked pages (DataForSEO domain_pages, monthly) become at most four linkable-asset ideas, each with the pages that prove it and the referring domains they hold and never a promise of links; and the writer gives every sequence a second subject in the other style, which the draft gate checks and LB Rows hands out in turn (A, B, A, B) so the app can read the reply rate per style, with no verdict under 30 first e-mails per variant (v5/code/_ab.js, mirrored in app/shared/src/outreach.ts). The Podcast Index key stays a placeholder in .env.seo.example: its signed requests need the secret inside a node, which this instance does not allow')


# =============================================================================
# 56. THE ANSWER THAT ARRIVED WITH HTTP 200 AND WAS STILL A FAILURE (2026-10-14, system review FIX_PLAN.md §3.12 R18 / R19 / R24;
#     evidence docs/system-review-2026-10-14/RESULTS.md §2.3, §2.4 and §3.3)
#       * R18. n8n's `retryOnFail` fires only when a node FAILS. DataForSEO answers a dead task with HTTP 200 and `status_code`
#         40101 ("Internal SE Server Error."); Google's URL Inspection answers HTTP 200 with an `error` object. Both look like
#         success. The only gate that ever looked inside a 200 was `AI_Retry_Requests.js` (the AI paths) and the **50000-only**
#         IF of section 25 — so in execution 549 `SERP Top 10` and `Facts SERP` both returned **40101**, were billed $0.002 each,
#         **ran once**, and the run still planned a ladder, scored it "winnable / GO_WITH_CHANGES 68" and wrote a page on a
#         results page nobody had seen. The rule now lives in one kit (`v5/code/_dfs_retry.js`, RT), every gate uses it, each gate
#         pauses and re-sends once (SERP, facts search, keyword data) — and, the half that matters more, **where the retry fails
#         too the evidence is `unavailable` and the verdict carries no number**: no score, no expected visits, no time to rank,
#         and the reason in the first line of the reasons. A feasibility verdict computed from a SERP that errored twice is worse
#         than no verdict.
#       * R19. In execution 550, 31 of 45 URL inspections failed with "Internal error encountered.", were never re-sent, and the
#         audit's indexing picture rested on 14 pages; the diff then reported `affected 4` against `affected_before 15` as an
#         improvement **without saying the sample had shrunk from 25 pages to 14** (the full report 18 minutes later inspected all
#         45 with 0 failures and found 18 not indexed). Now: *Inspect Retry Plan* → *Wait Before Inspect Retry* →
#         *GSC Audit Query (Retry)* re-sends what a second attempt can fix, every inspection finding carries `checked` /
#         `checked_of` and says so in its evidence, the count is stored on the finding row, and the diff **refuses to print a
#         delta** when the two numbers were measured on samples more than 20% apart (RT.comparable) — it says the sample moved.
#       * R24. One report said three things about schema: a Medium finding ranked 8th by impact ("Structured data with errors",
#         26 of 47 pages), `not_assessed: ["Structured data (schema) …"]` and `not_compared: ["Schema"]`, while `Schema` was in
#         neither `category_scores` nor `weights`. **The decision: a technical audit does not assess schema, so it emits no Schema
#         finding.** It has only DataForSEO's yes/no `has_micromarkup_errors` flag per page — no property, nothing the owner can
#         act on beyond "go and validate" — which is exactly why the audit's own `not_assessed` list says so. The flag's count now
#         travels into that one line, and a general guard drops any scored finding in a category this audit type does not weight,
#         so the three statements cannot diverge again. The full SEO report, which reads the HTML and checks the schema URLs,
#         keeps Schema weighted (12) and compared.
# =============================================================================
DFS_RETRY_SRC = rd('code/_dfs_retry.js').rstrip('\n')
# the one condition an IF node can carry (it cannot call the kit): the same four cases as RT.dfs, checked by harness S66
_FAIL56 = ("($json.error || Number($json.status_code) >= 40000 || !Array.isArray($json.tasks)"
           " || !Number((($json.tasks || [])[0] || {}).status_code)"
           " || Number((($json.tasks || [])[0] || {}).status_code) >= 40000"
           " || (Number((($json.tasks || [])[0] || {}).status_code) === 20000 && !(((($json.tasks || [])[0] || {}).result) || [])[0]))")
# the provider's own message decides whether asking again can help: a dead search engine can, a wrong field or a used-up quota cannot.
# The two regular expressions are RT.TRANSIENT and RT.PERMANENT of v5/code/_dfs_retry.js, and harness S66 fails if they ever differ.
_MSG56 = "String((((($json.tasks || [])[0] || {}).status_message) || $json.status_message || ($json.error && ($json.error.message || $json.error)) || ''))"
_TRANSIENT56 = (r"/internal (?:se )?server error|internal error|server error|timeout|timed out|temporar|try again|unavailable|"
                r"backend|deadline exceeded|connection|socket|econn|eai_again|rate limit|too many requests|\b(?:429|500|502|503|504)\b/i")
_PERMANENT56 = (r"/permission|forbidden|unauthor|invalid[_ ]grant|credential|not found|no access|invalid field|unknown field|"
                r"unsupported|quota|resource_exhausted|insufficient funds|payment|balance/i")
DFS_FAILED56 = ("{{ !!" + _FAIL56 + " && (!" + _PERMANENT56 + ".test(" + _MSG56 + ") || " + _TRANSIENT56 + ".test(" + _MSG56 + ")) }}")

# ---------- A. every DataForSEO gate takes the widened rule, and pauses before the second attempt ----------
_W56 = 5   # seconds between the two attempts (the AI gate waits 20 s for a batch of up to 24; one call needs less)
def _wait56(name, at):
    # `unit` is written out although typeVersion 1.1 defaults to seconds: the Wait node of @version 1 defaults to HOURS, so an
    # implicit unit is one typeVersion away from pausing a customer's run for five hours.
    return add_node(name, 'n8n-nodes-base.wait', 1.1, {'amount': _W56, 'unit': 'seconds'}, at, {'webhookId': nid(name + ':hook')})
for _gate, _retry, _wait in (('SERP Failed?', 'SERP Top 10 (Retry)', 'Wait Before SERP Retry'),
                             ('Facts SERP Failed?', 'Facts SERP (Retry)', 'Wait Before Facts Retry')):
    _c56 = nodes[_gate]['parameters']['conditions']['conditions'][0]
    assert '50000' in _c56['leftValue'] and '40000' not in _c56['leftValue'], _gate + ': the gate is not the 50000-only one of section 25'
    _c56['leftValue'] = '=' + DFS_FAILED56
    _p56 = pos(_retry)
    _wait56(_wait, [_p56[0] - 150, _p56[1]])
    disconnect(_gate, _retry); connect(_gate, _wait, 0); connect(_wait, _retry)
    assert [t['node'] for l in conns[_gate]['main'] for t in l][0] == _wait, _gate

def dfs_gate56(first, dst, gate, retry, wait, base_ref, dy=220):
    """One DataForSEO call, its in-200 gate, a pause and one second attempt (the shape section 25 gave the SERP calls)."""
    assert [t['node'] for l in conns[first]['main'] for t in l] == [dst], first + ': unexpected outputs'
    p0 = pos(first)
    if_node(gate, DFS_FAILED56, [p0[0] + 110, p0[1] + dy])
    _wait56(wait, [p0[0] + 300, p0[1] + dy])
    rn = copy.deepcopy(nodes[first]); rn['name'] = retry; rn['id'] = nid(retry); rn['position'] = [p0[0] + 490, p0[1] + dy]
    body = rn['parameters']['jsonBody']
    assert body.count('$json.') >= 3 and '$json.keyword' in body, retry + ': body anchors'
    rn['parameters']['jsonBody'] = body.replace('$json.', base_ref + '.')   # the gate's item is the failed answer; the request is read upstream
    rn['onError'] = 'continueRegularOutput'; rn.update(retry_lint.RETRY)
    assert rn.get('credentials'), retry + ': credential slot'
    nodes[retry] = rn
    disconnect(first, dst); connect(first, gate); connect(gate, wait, 0); connect(gate, dst, 1); connect(wait, retry); connect(retry, dst)

dfs_gate56('Keyword Data', 'Has Domain (Authority)?', 'Keyword Data Failed?', 'Keyword Data (Retry)', 'Wait Before Keyword Data Retry',
           "$('Parse Analysis').first().json")
assert "$('Parse Analysis').first().json.keyword" in nodes['Keyword Data (Retry)']['parameters']['jsonBody']
# the cost ledger counts the third retry too (a failed DataForSEO task is billed 0, a retried one is billed once)
_ln56 = [nm for nm in nodes if "const __LEDGER_NODES = ['SERP Top 10', " in nodes[nm]['parameters'].get('jsCode', '')]
assert len(_ln56) >= 4, _ln56
for nm in _ln56: patch(nm, "'Keyword Data', 'Candidate SERP'", "'Keyword Data', 'Keyword Data (Retry)', 'Candidate SERP'")
# the harness shims: each gate's exact condition, run per item like a Code node (S66 compares them with RT.dfs)
os.makedirs(OUT_CODE, exist_ok=True)
for _g56 in ('SERP Failed?', 'Facts SERP Failed?', 'Keyword Data Failed?'):
    open(os.path.join(OUT_CODE, re.sub(r'[^A-Za-z0-9_.-]+', '_', _g56) + '.js'), 'w').write(
        "// harness shim (written by build_v4.py section 56): the IF node's condition, true = take the retry branch (R18)\n"
        "return $input.all().map(i => { const $json = i.json; return { json: { retry: " + DFS_FAILED56[2:-2].strip() + " } }; });\n")
open(os.path.join(OUT_CODE, '_dfs_retry.js'), 'w').write(
    "// harness shim (written by build_v4.py section 56): the in-200 retry kit — { answer, retry, api, expect, now, before } -> the\n"
    "// verdict on one answer, what the two attempts add up to, the sentence a report prints, the evidence block, and the sample test\n"
    + DFS_RETRY_SRC + "\nreturn $input.all().map(i => { const j = i.json || {};\n"
    "  const o = { api: j.api || 'dataforseo', expect: j.expect };\n"
    "  const v = RT.check(j.answer, o); const st = RT.one(j.answer, j.retry === undefined ? null : j.retry, o);\n"
    "  return { json: { ...v, stats: { ...st, answers: undefined }, note: RT.note(st, j.unit || 'request'),\n"
    "    evidence: RT.evidence(j.what || 'the answer', st, { unit: j.unit || 'request' }),\n"
    "    comparable: j.now === undefined ? null : RT.comparable(j.now, j.before), drift_limit: RT.MAX_SAMPLE_DRIFT } }; });\n")

# ---------- B. what was actually seen travels with the data (RT.evidence), so a later node can refuse to score on it ----------
setcode('Analyze Competitor Pages', DFS_RETRY_SRC + '\n' + code('Analyze Competitor Pages'))
patch('Analyze Competitor Pages', """let serpItems = []; let seCount = null; let serpError = ''; let seenAt = new Date().toISOString();
try {
  let sj; try { sj = $('SERP Top 10 (Retry)').first().json; } catch (e) { sj = $('SERP Top 10').first().json; }
  sj = sj || {}; const t0 = (Array.isArray(sj.tasks) ? sj.tasks[0] : null) || {};
  if (sj.error || Number(sj.status_code) >= 40000 || !Array.isArray(sj.tasks) || Number(t0.status_code) >= 40000)
    serpError = String((sj.error && (sj.error.message || sj.error)) || t0.status_message || sj.status_message || 'no answer').slice(0, 120);
  const res = (t0.result || [])[0] || {}; serpItems = res.items || []; seCount = res.se_results_count ?? null; seenAt = serpSeenAt(sj);
} catch (e) { serpItems = []; serpError = 'no answer'; }""",
"""let serpItems = []; let seCount = null; let serpError = ''; let seenAt = new Date().toISOString();
// R18 (2026-10-14): the first answer and the retry's, judged by the one shared rule (RT, v5/code/_dfs_retry.js). A task error inside
// an HTTP 200 is a failure, whatever its number — the 50000-only test of section 25 let 40101 through twice in execution 549.
let serpStats = { asked: 1, answered: 0, failed: 1, failed_first: 1, retried: 0, retry_answered: 0, reasons: ['no answer'], answers: [{}] };
try {
  const first0 = (() => { try { return $('SERP Top 10').first().json; } catch (e) { return null; } })();
  const retry0 = (() => { try { return $('SERP Top 10 (Retry)').first().json; } catch (e) { return null; } })();
  serpStats = RT.one(first0, retry0);
  const sj = serpStats.answers[0] || {}; const t0 = (Array.isArray(sj.tasks) ? sj.tasks[0] : null) || {};
  if (serpStats.failed) serpError = String(serpStats.reasons[0] || 'no answer').slice(0, 160);
  const res = (t0.result || [])[0] || {}; serpItems = res.items || []; seCount = res.se_results_count ?? null; seenAt = serpSeenAt(sj);
} catch (e) { serpItems = []; serpError = 'no answer'; }
const serp_evidence = RT.evidence('the live Google results for this keyword', serpStats, { unit: 'search' });""")
patch('Analyze Competitor Pages', "if (serpError) Object.assign(serp_features, { unavailable: true, error: serpError, ai_overview: { present: null, text: '', cited_domains: [], seen_at: null } });",
      "if (serpError) Object.assign(serp_features, { unavailable: true, error: serpError, ai_overview: { present: null, text: '', cited_domains: [], seen_at: null } });\n"
      "Object.assign(serp_features, { attempts: 1 + (serpStats.retried || 0), retried: !!serpStats.retried });")
patch('Analyze Competitor Pages', "return [{ json: { ...input, competitors, competitors_read: competitors.length, retried_pages, avg_competitor_words: avg, failed_pages: failed,",
      "return [{ json: { ...input, competitors, competitors_read: competitors.length, retried_pages, avg_competitor_words: avg, failed_pages: failed, serp_evidence,")
patch('Analyze Competitor Pages', "const serpDigest = serpError ? 'LIVE GOOGLE RESULTS: unavailable for this run (the search data provider failed: ' + serpError + ').",
      "const serpDigest = serpError ? 'LIVE GOOGLE RESULTS: unavailable for this run (the search data provider failed' + (serpStats.retried ? ', twice: the search was sent again once and failed again' : '') + ': ' + serpError + ').")

setcode('Collect Facts', DFS_RETRY_SRC + '\n' + code('Collect Facts'))
patch('Collect Facts', """const prev = $('Analyze Competitor Pages').first().json;
const res = $input.first().json || {};
const items = res.tasks?.[0]?.result?.[0]?.items || [];""",
"""const prev = $('Analyze Competitor Pages').first().json;
// R18 (2026-10-14): the facts search gets the same gate as the keyword's SERP. When both attempts fail, "no statistics were found"
// would be a lie — nothing was searched — so the run carries `facts_evidence.unavailable` instead.
const factsStats = RT.one((() => { try { return $('Facts SERP').first().json; } catch (e) { return $input.first().json || {}; } })(),
                          (() => { try { return $('Facts SERP (Retry)').first().json; } catch (e) { return null; } })());
const facts_evidence = RT.evidence('the statistics search for this keyword', factsStats, { unit: 'search' });
const res = factsStats.answers[0] || $input.first().json || {};
const items = res.tasks?.[0]?.result?.[0]?.items || [];""")
patch('Collect Facts', "return [{ json: { ...prev, facts: kept.slice(0, 10), facts_found: facts.length,",
      "return [{ json: { ...prev, facts: kept.slice(0, 10), facts_found: facts.length, facts_evidence,")

setcode('Merge Keyword Data', DFS_RETRY_SRC + '\n' + code('Merge Keyword Data'))
patch('Merge Keyword Data', "let res = {}; try { res = $('Keyword Data').first().json || {}; } catch (e) { res = $input.first().json || {}; }",
      """// R18 (2026-10-14): the keyword's own search data goes through the same gate — the retry's answer when it came, and an honest
// "could not be read" when neither attempt did (live 549: items_count 0 beside two failed SERP calls, and the run scored anyway).
const kdStats = RT.one((() => { try { return $('Keyword Data').first().json; } catch (e) { return $input.first().json || {}; } })(),
                       (() => { try { return $('Keyword Data (Retry)').first().json; } catch (e) { return null; } })());
const keyword_data_evidence = RT.evidence('search volume, difficulty and cost per click for this keyword', kdStats, { unit: 'request' });
const res = kdStats.answers[0] || {};""")
patch('Merge Keyword Data', """} : {
  note: 'Keyword data not available for this keyword/country'
};""",
"""} : {
  note: keyword_data_evidence.unavailable
    ? 'Search data for this keyword could not be read: ' + (keyword_data_evidence.error || 'no answer') + (kdStats.retried ? ' (the request was sent again once and failed again)' : '') + '. This is not "no demand": nothing was measured.'
    : 'Keyword data not available for this keyword/country'
};""")
patch('Merge Keyword Data', """    keyword_data,
    site_authority""", """    keyword_data,
    keyword_data_evidence,
    site_authority""")

# ---------- C. the refusal: no score on evidence nobody could read ----------
patch('Parse Verdict', "const EXP = (prev.existing_page && prev.existing_page.url) ? prev.existing_page : null;",
"""// ---- R18 (2026-10-14, FIX_PLAN §3.12): a feasibility score computed on a results page nobody could read ----
// Execution 549: both SERP calls answered 40101 inside an HTTP 200, were billed, ran once — and the run still said
// "winnable, GO_WITH_CHANGES 68" and wrote a page. The retry is wired above; when it fails too, the competition was never seen,
// so there is no verdict and no number — only what was tried, and the suggestion to run the check again.
const EV56 = (() => {
  const sf = prev.serp_features || {}; const ev = prev.serp_evidence || null; const kd = prev.keyword_data_evidence || null;
  const out = !!(sf.unavailable || (ev && ev.unavailable));
  const why = String((ev && ev.error) || sf.error || 'no answer from the search data provider').slice(0, 160);
  const again = (ev && ev.retried) ? ' The search was sent again once and failed again.' : '';
  return {
    withheld: out,
    evidence: { serp: out ? 'unavailable' : 'read', error: out ? why : '', asked: ev ? ev.asked : 1, checked: ev ? ev.checked : (out ? 0 : 1),
      retried: ev ? ev.retried : 0, keyword_data: (kd && kd.unavailable) ? 'unavailable' : 'read' },
    reason: out ? 'No score is given for this keyword: the live Google results could not be read (' + why + ').' + again
      + ' Nobody has seen the pages that rank, the featured snippet or the AI Overview, so any number here would be invented. Run the check again.' : ''
  };
})();
const EXP = (prev.existing_page && prev.existing_page.url) ? prev.existing_page : null;""")
patch('Parse Verdict', """    verdict: verdict.verdict,
    verdict_score: verdict.score ?? null,
    verdict_reasons: verdict.reasons || [],""",
"""    verdict: EV56.withheld ? 'NOT_CHECKED' : verdict.verdict,
    verdict_score: EV56.withheld ? null : (verdict.score ?? null),
    verdict_evidence: EV56.evidence,
    score_withheld: EV56.withheld,
    score_withheld_reason: EV56.reason,
    verdict_reasons: EV56.withheld ? [EV56.reason, ...(verdict.reasons || [])] : (verdict.reasons || []),""")
patch('Parse Verdict', """    expected_visits_top3: verdict.expected_monthly_visits_top3 ?? null,
    time_to_rank_months: verdict.time_to_rank_months ?? null""",
"""    expected_visits_top3: EV56.withheld ? null : (verdict.expected_monthly_visits_top3 ?? null),
    time_to_rank_months: EV56.withheld ? null : (verdict.time_to_rank_months ?? null)""")
# the keyword report and the callback say "not scored", never "N/A" beside a verdict that was never formed
patch('Build Word File', "const verdictLabel = { GO: 'GO — Target This Keyword', GO_WITH_CHANGES: 'GO, WITH CHANGES', AVOID: 'AVOID' }[d.verdict] || esc(d.verdict);",
      "const verdictLabel = { GO: 'GO — Target This Keyword', GO_WITH_CHANGES: 'GO, WITH CHANGES', AVOID: 'AVOID', NOT_CHECKED: 'NOT CHECKED — the live Google results could not be read' }[d.verdict] || esc(d.verdict);")
patch('Build Word File', """    ['Score', d.verdict_score != null ? d.verdict_score + '/100' : 'N/A'],
    ['Recommended Page Type', esc(d.recommended_page || d.page_type || 'N/A')],
    ['Expected visits/month at #1-3', d.expected_visits_top3 != null ? num(d.expected_visits_top3) : 'N/A'],
    ['Time to rank', d.time_to_rank_months != null ? d.time_to_rank_months + ' months' : 'N/A']""",
"""    ['Score', d.verdict_score != null ? d.verdict_score + '/100' : (d.score_withheld ? 'not scored — the live Google results could not be read' : 'N/A')],
    ['Recommended Page Type', esc(d.recommended_page || d.page_type || 'N/A')],
    ['Expected visits/month at #1-3', d.expected_visits_top3 != null ? num(d.expected_visits_top3) : (d.score_withheld ? 'not estimated' : 'N/A')],
    ['Time to rank', d.time_to_rank_months != null ? d.time_to_rank_months + ' months' : (d.score_withheld ? 'not estimated' : 'N/A')]""")
patch('Build Webhook Response', "    score: d.verdict_score,", "    score: d.verdict_score,\n    score_withheld: !!d.score_withheld,\n    evidence: d.verdict_evidence || null,")
# the ladder plan prints the same refusal where it would otherwise print "winnable (verdict …, 68/100)"
patch('Build Ladder Report', "(f.score != null ? ' (verdict ' + esc(f.verdict) + ', ' + f.score + '/100)' : '')",
      "(f.score != null ? ' (verdict ' + esc(f.verdict) + ', ' + f.score + '/100)' : (f.verdict === 'NOT_CHECKED' ? ' — not scored: the live Google results could not be read in this run, so the competition was never seen' : ''))")

# ---------- D. R19: the failed inspections, asked again; and a count nobody can mistake for a sample ----------
_gq56 = pos('GSC Audit Query')
add_node('Inspect Retry Plan', 'n8n-nodes-base.code', 2, {'jsCode': DFS_RETRY_SRC + '\n' + rd('code/Inspect_Retry_Plan.js')}, [_gq56[0] + 110, _gq56[1] + 220])
if_node('Any Inspect Retries?', '{{ !$json.skip }}', [_gq56[0] + 300, _gq56[1] + 220])
_wait56('Wait Before Inspect Retry', [_gq56[0] + 490, _gq56[1] + 220])
_rq56 = copy.deepcopy(nodes['GSC Audit Query']); _rq56['name'] = 'GSC Audit Query (Retry)'; _rq56['id'] = nid('GSC Audit Query (Retry)')
_rq56['position'] = [_gq56[0] + 680, _gq56[1] + 220]
assert _rq56.get('credentials') and _rq56['parameters']['url'] == '={{ $json.url }}', 'GSC Audit Query: the request shape moved'
_rq56.update(retry_lint.RETRY); _rq56['onError'] = 'continueRegularOutput'
nodes['GSC Audit Query (Retry)'] = _rq56
disconnect('GSC Audit Query', 'GSC Sitemaps (Audit)')
connect('GSC Audit Query', 'Inspect Retry Plan'); connect('Inspect Retry Plan', 'Any Inspect Retries?')
connect('Any Inspect Retries?', 'Wait Before Inspect Retry', 0); connect('Any Inspect Retries?', 'GSC Sitemaps (Audit)', 1)
connect('Wait Before Inspect Retry', 'GSC Audit Query (Retry)'); connect('GSC Audit Query (Retry)', 'GSC Sitemaps (Audit)')
assert nodes['GSC Sitemaps (Audit)'].get('executeOnce'), 'GSC Sitemaps (Audit) must still run once whatever reaches it'

setcode('GSC Audit Findings', DFS_RETRY_SRC + '\n' + code('GSC Audit Findings'))
patch('GSC Audit Findings', "const reqs = grab('GSC Audit Requests'); const res = grab('GSC Audit Query'); const plan1 = reqs[0] || {};",
"""const reqs = grab('GSC Audit Requests');
// R19 (2026-10-14, FIX_PLAN §3.12): the answers of the second attempt take the failed ones' place before anything is counted
// (31 of 45 inspections failed live in execution 550 and were never re-sent; the diff then called the 14 that answered an improvement).
const retryQ = grab('Inspect Retry Plan').filter(q => q && !q.skip);
const retryR = grab('GSC Audit Query (Retry)');
const expectOf = (q) => (q && q.kind === 'inspect') ? 'inspectionResult' : '';
const res = grab('GSC Audit Query').slice();
let inspect_retried = 0, inspect_retry_answered = 0;
retryQ.forEach((q, k) => {
  const i = Number(q.retry_of); const a = retryR[k]; if (!Number.isFinite(i) || a === undefined) return;
  const isInspect = (reqs[i] || {}).kind === 'inspect'; if (isInspect) inspect_retried++;
  if (RT.google(a, expectOf(reqs[i])).ok) { res[i] = a; if (isInspect) inspect_retry_answered++; }
});
const plan1 = reqs[0] || {};""")
patch('GSC Audit Findings', "  const ok = insp.filter(i => !i.error); const coverage = {};",
"""  const _f19 = findings.length;   // R19: every finding below is measured on the pages Google actually answered for
  const ok = insp.filter(i => !i.error); const coverage = {};""")
patch('GSC Audit Findings', """    else if (mobChecked && ok.some(i => i.mobile_usable === true)) works.push('Google reports the ' + mobChecked + ' page(s) it still answers about as mobile-friendly');
  }
}""",
"""    else if (mobChecked && ok.some(i => i.mobile_usable === true)) works.push('Google reports the ' + mobChecked + ' page(s) it still answers about as mobile-friendly');
  }
  // ---- R19: how many pages each of those numbers was measured on, said out loud and carried into the stored row and the diff ----
  const inspection_stats = { asked: insp.length, checked: ok.length, failed: insp.length - ok.length,
    failed_first: (insp.length - ok.length) + inspect_retry_answered, retried: inspect_retried, retry_answered: inspect_retry_answered,
    reasons: [...new Set(insp.filter(i => i.error).map(i => String(i.not_checked || i.error)))].slice(0, 3) };
  inspection_stats.note = RT.note({ ...inspection_stats, answered: inspection_stats.checked }, 'page');   // the kit counts "answered", the audit calls it "checked"
  search_console.inspection_stats = inspection_stats;
  for (let _i = _f19; _i < findings.length; _i++) {
    const f = findings[_i]; f.checked = ok.length; f.checked_of = insp.length;
    f.evidence = String(f.evidence || '') + ' (measured on the ' + ok.length + ' of ' + insp.length + ' page(s) Google answered for'
      + (inspection_stats.failed ? '; ' + inspection_stats.failed + ' could not be checked' + (inspect_retried ? ' even after being asked again' : '') : '') + ')';
  }
  if (insp.length && inspection_stats.failed) {
    F('Info', 'Google could not answer for part of the key pages', 'Everything this report says about indexing was measured on the pages Search Console answered for: the rest are unknown, not fine.',
      'Nothing to fix on the site: run the audit again later, or open those URLs in Search Console\\'s URL inspection yourself.',
      inspection_stats.note || (inspection_stats.failed + ' of ' + insp.length + ' URL inspections failed'),
      insp.filter(i => i.error).map(i => i.url), inspection_stats.failed, Math.round(inspection_stats.failed / insp.length * 100));
    findings[findings.length - 1].scoring = false;   // a note about missing data, never a deduction
  }
}""")

# the stored finding row keeps the sample size, so the next audit can tell a real change from a different sample
patch('Finding Rows', "affected_count: Number(f.affected_count) || 0, impact: Number(f.impact) || 0,",
      "affected_count: Number(f.affected_count) || 0, checked: Number(f.checked) || 0, impact: Number(f.impact) || 0,")
assert ('checked', 'number') in AUDIT_FINDINGS_COLS, 'R19: seo_audit_findings needs a `checked` column (ladder_common.py) — run sync_tables.py after deploying'

setcode('Audit Diff', DFS_RETRY_SRC + '\n' + code('Audit Diff'))
patch('Audit Diff', "const open = [...curKeys.entries()].filter(([k]) => prevKeys.has(k)).map(([k, f]) => { const p = prevKeys.get(k); return { title: f.title, category: f.category, severity: f.severity, was: p.severity, affected: f.affected_count ?? null, affected_before: Number(p.affected_count) || null }; }).sort((x, y) => SEV[x.severity] - SEV[y.severity]);",
"""// R19 (2026-10-14, FIX_PLAN §3.12): two counts measured on samples of different sizes are not a change. The technical audit of
// execution 550 reported "15 → 4 affected" as an improvement because 31 of 45 URL inspections had failed and the sample had
// shrunk from 25 pages to 14 — nobody said so. Where the samples differ by more than RT.MAX_SAMPLE_DRIFT (20%), or where the
// earlier audit did not record its sample at all, the delta is not printed: the report says the sample moved.
const open = [...curKeys.entries()].filter(([k]) => prevKeys.has(k)).map(([k, f]) => {
  const p = prevKeys.get(k);
  const now = f.affected_count ?? null; const before = Number(p.affected_count) || null;
  const checked = f.checked == null ? null : Number(f.checked); const checkedBefore = Number(p.checked) || null;
  const cmp = (checked || checkedBefore) ? RT.comparable(checked, checkedBefore) : { comparable: true, why: '' };
  const moved = !cmp.comparable;
  return { title: f.title, category: f.category, severity: f.severity, was: p.severity, affected: now,
    affected_before: moved ? null : before, checked: checked, checked_before: checkedBefore, sample_changed: moved,
    sample_note: moved ? ((now == null ? '?' : now) + ' now against ' + (before == null ? '?' : before) + ' before, but ' + cmp.why) : '' };
}).sort((x, y) => SEV[x.severity] - SEV[y.severity]);
const sample_moved = open.filter(f => f.sample_changed).length;""")
patch('Audit Diff', """  score_delta: (Number(a.health_score) || 0) - (Number(prev.health_score) || 0), fixed, new: added, open, not_compared,
  summary: fixed.length + ' fixed · ' + added.length + ' new · ' + open.length + ' still open (compared with the ' + labelOf(curType) + ' of ' + String(prev.audited_at).slice(0, 10) + ')'""",
"""  score_delta: (Number(a.health_score) || 0) - (Number(prev.health_score) || 0), fixed, new: added, open, not_compared, sample_moved,
  summary: fixed.length + ' fixed · ' + added.length + ' new · ' + open.length + ' still open (compared with the ' + labelOf(curType) + ' of ' + String(prev.audited_at).slice(0, 10) + ')'
    + (sample_moved ? '. ' + sample_moved + ' finding(s) are not compared as numbers: they were measured on a different number of pages this time (how many is shown with each).' : '')""")
# R2's note on Schema is now one line shorter: a technical audit does not emit the finding at all (R24, below)
patch('Audit Diff', "//   The decision on Schema: a technical audit does NOT get a Schema weight. It only reads DataForSEO's `has_micromarkup_errors` flag per page --\n"
      "//   it never validates a single property, which is why its own `not_assessed` list says \"Structured data (schema) and HTML-level checks\". A flag\n"
      "//   with no detail cannot carry a score, so Schema stays in the full report's weights only; a technical audit keeps showing the finding as an\n"
      "//   observation and the diff leaves it out of fixed / new / still-open on BOTH sides.",
      "//   The decision on Schema (R24, 2026-10-14): a technical audit does NOT get a Schema weight -- it only reads DataForSEO's\n"
      "//   `has_micromarkup_errors` flag per page, never a single property -- and since 2026-10-14 it does not emit a Schema finding either\n"
      "//   (Build Site Issues drops it and says so in `not_assessed`). Schema is assessed, weighted and compared in the full SEO report only.\n"
      "//   This filter stays for the rows older audits stored, so a finding outside the current weights is never called \"fixed\" or \"new\".")
# both audit reports print the moved sample instead of a delta drawn from unlike numbers
for _rn56 in ('Build Audit Report', 'Build Full Report'):
    patch(_rn56, "f.title + (f.affected != null && f.affected_before != null && f.affected !== f.affected_before ? ' — ' + f.affected_before + ' → ' + f.affected + ' affected' : '')",
          "f.title + (f.sample_changed ? ' — not compared: ' + (f.sample_note || 'measured on a different number of pages') : (f.affected != null && f.affected_before != null && f.affected !== f.affected_before ? ' — ' + f.affected_before + ' → ' + f.affected + ' affected' : ''))")

# ---------- E. R24: one story about schema (and about every other category the audit does not weight) ----------
_bsi56 = code('Build Site Issues')
_w56a = _bsi56.index('const WEIGHTS = isFull ? {')
_w56b = _bsi56.index('\n};\n', _w56a) + len('\n};\n')
WEIGHTS_BLOCK56 = _bsi56[_w56a:_w56b]
assert "'Schema': 12" in WEIGHTS_BLOCK56 and WEIGHTS_BLOCK56.count('isFull') == 1, 'R24: the weights block moved'
setcode('Build Site Issues', _bsi56.replace(WEIGHTS_BLOCK56, "// (the weights are declared above section 5b: a category this audit type does not weight must not reach the fix list either — R24)\n"))
patch('Build Site Issues', "// ===== 6. Order by likely impact (G26, 2026-10-12)",
"""// ===== 5b. R24 (2026-10-14, FIX_PLAN §3.12): one story about every category =====
// The audit of execution 550 said three different things about schema in one report: a Medium finding ranked 8th by impact
// ("Structured data with errors", 26 of 47 pages), `not_assessed: ["Structured data (schema) …"]`, and `not_compared: ["Schema"]`
// — while Schema appeared in neither `category_scores` nor `weights`. A technical audit has only the crawler's yes/no
// `has_micromarkup_errors` flag per page: no property, nothing to act on, nothing a score could be built from. So it assesses no
// schema, emits no schema finding, and says so once, in `not_assessed`, with the flag's count. The full SEO report — which reads
// the HTML and checks every schema URL — keeps Schema weighted and compared. This guard keeps the three statements together: a
// scored finding in a category this audit type does not weight is not emitted at all, it is named in `not_assessed`.
""" + WEIGHTS_BLOCK56 + """const unassessed_cats = {};
for (let i = findings.length - 1; i >= 0; i--) {
  const f = findings[i];
  if (f.scoring === false || f.severity === 'Info' || WEIGHTS[f.category]) continue;
  unassessed_cats[f.category] = (unassessed_cats[f.category] || 0) + 1;
  findings.splice(i, 1);
}

// ===== 6. Order by likely impact (G26, 2026-10-12)""")
patch('Build Site Issues', """  if (affected.length > 0) {
    // A handful of broken URLs on a big site is serious but not "Critical" unless the homepage or >=3% of pages are hit""",
"""  // R24 (2026-10-14): a technical audit does not assess structured data, so it emits no Schema finding — the count goes into the
  // one line that speaks about schema there, `not_assessed`.
  if (!isFull && c.cat === 'Schema') { if (affected.length > 0) schema_flag = { pages: affected.length, total }; continue; }
  if (affected.length > 0) {
    // A handful of broken URLs on a big site is serious but not "Critical" unless the homepage or >=3% of pages are hit""")
patch('Build Site Issues', "const findings = [];\nconst whatWorks = [];",
      "const findings = [];\nconst whatWorks = [];\nlet schema_flag = null;   // R24: the crawl's structured-data flag, reported in `not_assessed` by a technical audit")
patch('Build Site Issues', "if (!isFull) not_assessed.push('Structured data (schema) and HTML-level checks');",
"""if (!isFull) not_assessed.push('Structured data (schema) and HTML-level checks: a technical audit reads only the crawler\\'s yes/no flag per page'
  + (schema_flag ? ' (it flagged ' + schema_flag.pages + ' of ' + schema_flag.total + ' crawled pages)' : '')
  + ', never a single property, so schema is not scored, not listed as a finding and not compared here — the full SEO report checks it');
for (const _cat of Object.keys(unassessed_cats)) not_assessed.push(_cat + ': ' + unassessed_cats[_cat] + ' observation(s) from the crawl, in a category this report does not weight — not listed as findings and not compared');""")

# ---------- F. the asserts: nothing half-wired, and the lints green over the new nodes ----------
for _n56 in ('Analyze Competitor Pages', 'Collect Facts', 'Merge Keyword Data', 'GSC Audit Findings', 'Audit Diff', 'Inspect Retry Plan'):
    assert 'const RT = (() => {' in code(_n56), _n56 + ': the in-200 retry kit is not inlined'
for _n56 in ('SERP Top 10 (Retry)', 'Facts SERP (Retry)', 'Keyword Data (Retry)', 'GSC Audit Query (Retry)'):
    assert nodes[_n56].get('credentials') and nodes[_n56].get('retryOnFail'), _n56
for _g56, _w56b2, _r56 in (('SERP Failed?', 'Wait Before SERP Retry', 'SERP Top 10 (Retry)'), ('Facts SERP Failed?', 'Wait Before Facts Retry', 'Facts SERP (Retry)'),
                           ('Keyword Data Failed?', 'Wait Before Keyword Data Retry', 'Keyword Data (Retry)'), ('Any Inspect Retries?', 'Wait Before Inspect Retry', 'GSC Audit Query (Retry)')):
    assert [t['node'] for t in conns[_g56]['main'][0]] == [_w56b2] and [t['node'] for t in conns[_w56b2]['main'][0]] == [_r56], _g56 + ': gate -> wait -> retry is not wired'
    assert '40000' in json.dumps(nodes[_g56]['parameters']) or _g56 == 'Any Inspect Retries?', _g56 + ': the gate still only looks for 50000'
assert code('Build Site Issues').count('const WEIGHTS = isFull ? {') == 1, 'R24: the weights are declared twice'
assert 'unassessed_cats' in code('Build Site Issues') and 'schema_flag' in code('Build Site Issues'), 'R24: the schema decision did not reach Build Site Issues'
assert 'NOT_CHECKED' in code('Parse Verdict') and 'score_withheld' in code('Build Word File'), 'R18: the refusal did not reach the report'
retry_lint.record_gate('SEO Agent v4', ['GSC Audit Query', 'Inspect Retry Plan', 'Any Inspect Retries?', 'Wait Before Inspect Retry', 'GSC Audit Query (Retry)', 'GSC Sitemaps (Audit)'])
url_lint.check({'nodes': list(nodes.values()), 'name': 'SEO Agent v4'})
retry_lint.check({'nodes': list(nodes.values()), 'name': 'SEO Agent v4'})
sticky("""### An answer that arrived with HTTP 200 and was still a failure (R18 / R19 / R24)
**One rule, one kit** (`v5/code/_dfs_retry.js`): DataForSEO answers a dead task with `status_code` 40101 inside an HTTP 200 and Google's URL Inspection with an `error` object — n8n's `retryOnFail` never sees either. Every gate (SERP, facts search, keyword data, URL inspection) now judges the answer with `RT`, **pauses and asks once more**, and never re-sends what a second attempt cannot fix (permission, property, quota).
**Where the retry fails too, nothing is scored on it.** The evidence is `unavailable`, the keyword verdict is **NOT CHECKED** with no score, no expected visits and no time to rank, and the first reason says why. A verdict computed on a results page nobody saw is worse than no verdict.
**Counts carry their sample.** Every indexing finding says how many pages Google actually answered for, the number is stored on the finding row, and the next audit **refuses to print a delta** when the two counts were measured on samples more than 20% apart — it says the sample moved.
**Schema, once:** a technical audit does not assess it (it has only the crawler's yes/no flag), so it emits no Schema finding and says so in "not assessed". The full SEO report assesses, weights and compares it.""",
    pos('Build Site Issues')[0] - 40, pos('Build Site Issues')[1] + 340, 1180, 300, 3)
log('An answer that arrived with HTTP 200 and was still a failure (2026-10-14, FIX_PLAN §3.12 R18 / R19 / R24): the in-200 retry rule moved out of the AI path into one kit (v5/code/_dfs_retry.js) that every DataForSEO and Search Console gate uses — the SERP, facts and keyword-data gates now fire on ANY task error (40101 passed the 50000-only test of section 25 twice in exec 549), each pauses and re-sends once, and the audit re-sends the URL inspections Google failed (31 of 45 in exec 550) unless a second attempt cannot help; where the retry fails too the evidence is marked unavailable and the keyword verdict is NOT_CHECKED with no score, no expected visits and no time to rank (a feasibility verdict on a SERP nobody saw is worse than none); every indexing finding carries how many pages Google answered for, the count is stored on the finding row (seo_audit_findings.checked), and the diff prints "not compared: the sample moved" instead of a delta when the two counts came from samples more than 20% apart; and a technical audit emits no Schema finding at all (it reads only the crawler\'s yes/no flag), naming the flag count in not_assessed, so the report can no longer say three different things about schema')

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

