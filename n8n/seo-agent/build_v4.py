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

patch('URLs To Check', "const seen = new Set();", "// Only probe public http(s) URLs (schema can point anywhere, including internal hosts)\nconst publicUrl = (u) => { try { const x = new URL(u); const h = x.hostname.toLowerCase(); if (!/^https?:$/.test(x.protocol) || !h.includes('.')) return false; if (/^(\\d{1,3}\\.){3}\\d{1,3}$/.test(h) || h.includes(':')) return false; if (/(^|\\.)(localhost|local|internal|localdomain|lan|corp|intranet|test|invalid)$/.test(h)) return false; return true; } catch (e) { return false; } };\nconst seen = new Set();")
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
rd = lambda p: open(os.path.join(V5, p), encoding='utf-8').read()
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
SENDER = 'Dev SEO <kinnngahmed@gmail.com>'
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

# ---------- AI budget cap raised at the user's request (2026-10-01) to finish the system test; lower it again when done ----------
patch('Normalize Input', "  ai_budget_usd: 3,                 // estimated Claude spend allowed per budget period (see Rate Limit); raise when ready",
      "  ai_budget_usd: 10,                // estimated Claude spend allowed per budget period (see Rate Limit); raised from 3 on 2026-10-01 at the user's request to finish the system test — the Anthropic Console workspace limit is the hard cap")

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
for _s in ('build_api.py', 'build_ladder_extras.py'):
    _r = subprocess.run([sys.executable, os.path.join(HERE0, _s)], cwd=HERE0)
    assert _r.returncode == 0, _s + ' failed'

