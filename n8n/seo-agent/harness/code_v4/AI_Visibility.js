const base = $('Parse Content Review').first().json;
const qs = $('AI Queries').all().map(i => i.json);
const serps = $('AI SERP').all().map(i => i.json);
const prompts = $('LLM Prompts').all().map(i => i.json);
const answers = $input.all().map(i => i.json);

const ours = base.domain;
const brandTok = String((qs[0] || {}).brand_name || ours.split('.')[0]).toLowerCase();
const compDomains = ((base.competitor_benchmark || {}).rows || []).filter(r => !r.is_you).map(r => r.domain);
const norm = (d) => String(d || '').toLowerCase().replace(/^www\./, '');
const matches = (d, target) => { d = norm(d); return d === target || d.endsWith('.' + target); };
const hostOf = (u) => norm(String(u || '').replace(/^https?:\/\//, '').split(/[\/?#]/)[0]);

// ---------- Google results ----------
let indexEstimate = null;
const rows = qs.map((q, i) => {
  const res = serps[i]?.tasks?.[0]?.result?.[0] || {};
  const items = res.items || [];
  if (q.type === 'index') { indexEstimate = res.se_results_count ?? null; }
  const aio = items.find(x => x.type === 'ai_overview');
  const refs = [];
  if (aio) {
    (aio.references || []).forEach(r => refs.push(r.domain || r.url));
    (aio.items || []).forEach(it => (it.references || []).forEach(r => refs.push(r.domain || r.url)));
  }
  const cited = [...new Set(refs.filter(Boolean).map(r => hostOf(String(r).includes('://') ? r : 'https://' + r)))];
  const organic = items.filter(x => x.type === 'organic');
  const pos = (target) => { const o = organic.find(x => matches(x.domain, target)); return o ? o.rank_group : null; };
  const compPos = {};
  compDomains.forEach(c => compPos[c] = pos(c));
  return {
    query: q.query, type: q.type,
    ai_overview: !!aio,
    cited_domains: cited.slice(0, 10),
    you_cited: cited.some(c => matches(c, ours)),
    competitors_cited: compDomains.filter(c => cited.some(x => matches(x, c))),
    your_position: pos(ours),
    competitor_positions: compPos,
    serp_features: [...new Set(items.map(x => x.type))].filter(t => t !== 'organic')
  };
}).filter(r => r.type !== 'index');

// ---------- LLM answers (DataForSEO LLM Responses) ----------
const llm = prompts.map((p, i) => {
  const j = answers[i] || {};
  const task = j.tasks?.[0] || {};
  const result = task.result?.[0] || null;
  const items = (result && result.items) || [];
  const texts = [];
  const urls = [];
  items.forEach(it => (it.sections || []).forEach(s => {
    if (s.text) texts.push(s.text);
    (s.annotations || []).forEach(a => { if (a.url) urls.push(a.url); });
  }));
  const text = texts.join('\n');
  const domainsInText = [...new Set([...(text.match(/\b([a-z0-9-]+\.)+[a-z]{2,}\b/gi) || []).map(norm), ...urls.map(hostOf)])]
    .filter(d => d && !/^(openai|perplexity|google|bing|wikipedia|linkedin|facebook|youtube|reddit|x|twitter|instagram)\.(com|org|ai)$/.test(d));
  const mentionsYou = domainsInText.some(d => matches(d, ours)) || new RegExp('\\b' + brandTok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(text);
  const notFound = /could not find|couldn't find|no information|not familiar|unable to find|don't have (any )?information/i.test(text);
  return {
    platform: p.platform, kind: p.kind, prompt: p.prompt,
    ok: !!result && !j.error && !(task.status_code >= 40000),
    error: j.error ? (j.error.message || String(j.error)).slice(0, 120) : (task.status_code >= 40000 ? task.status_message : ''),
    answer: text.slice(0, 1200),
    cited_sources: [...new Set(urls.map(hostOf))].slice(0, 10),
    domains_mentioned: domainsInText.slice(0, 12),
    mentions_you: mentionsYou,
    not_found: notFound && !mentionsYou,
    competitors_mentioned: compDomains.filter(c => domainsInText.some(d => matches(d, c))),
    cost_usd: task.cost ?? null
  };
});

const findings = [];
const works = [];
const F = (severity, title, evidence, why, fix) => findings.push({
  category: 'AI Search Readiness', severity, title, evidence, why, fix,
  sample_urls: [], affected_count: null, affected_pct: 100, scope: 'site'
});

const who = llm.find(x => x.kind === 'who');
if (who && who.ok) {
  if (who.not_found || !who.mentions_you) F('High', 'ChatGPT cannot describe the company', 'Asked "what is ' + brandTok + ' (' + ours + ')" with web search on: ' + (who.answer.slice(0, 220) || 'no answer'),
    'If AI assistants cannot identify you from your own site and third-party mentions, they will not recommend or cite you.',
    'Publish a clear About page and Organization schema, and build consistent third-party profiles (directories, LinkedIn, review sites, Wikidata) using one exact brand name.');
  else works.push('ChatGPT (with web search) correctly identifies the company');
}
const recs = llm.filter(x => x.kind === 'recommend' && x.ok);
recs.forEach(r => {
  const platform = r.platform === 'chat_gpt' ? 'ChatGPT' : 'Perplexity';
  if (!r.mentions_you && r.domains_mentioned.length) {
    F('High', platform + ' recommends other providers, not you',
      'For "' + r.prompt.slice(0, 120) + '…" ' + platform + ' listed: ' + r.domains_mentioned.slice(0, 6).join(', ') + (r.competitors_mentioned.length ? ' (including competitors ' + r.competitors_mentioned.join(', ') + ')' : ''),
      'Buyers increasingly ask AI assistants for shortlists; not being named means not being considered.',
      'Get listed where AI answers draw their sources: the directories and review sites cited (' + (r.cited_sources.slice(0, 4).join(', ') || 'see report') + '), plus comparison and "best X" pages that name you.');
  } else if (r.mentions_you) works.push(platform + ' includes you when recommending providers in your category');
});
const failed = llm.filter(x => !x.ok);
if (failed.length === llm.length && llm.length) {
  findings.push({ category: 'AI Search Readiness', severity: 'Info', title: 'AI assistant checks did not return results', evidence: failed.map(f => f.platform + ': ' + (f.error || 'no data')).join('; '), why: 'The LLM Responses API (DataForSEO AI Optimization) needs to be enabled on the account.', fix: 'Enable the AI Optimization API in DataForSEO and re-run.', sample_urls: [], affected_count: null, affected_pct: 100, scope: 'site', scoring: false });
}

const aioMissed = rows.filter(r => r.ai_overview && !r.you_cited && r.type !== 'brand');
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

const brandRow = rows.find(r => r.type === 'brand');
if (brandRow) {
  if (brandRow.your_position == null || brandRow.your_position > 3) {
    F('High', 'Site does not rank at the top for its own brand name',
      'Search "' + brandRow.query + '": your position ' + (brandRow.your_position || 'not in top 20'),
      'If people cannot find you by name, every other channel (ads, referrals, AI) leaks visitors.',
      'Use one consistent brand name everywhere, add Organization schema with alternateName, and build branded mentions.');
  } else works.push('Ranks #' + brandRow.your_position + ' for its brand name');
}

// Index coverage estimate (site: operator vs crawl)
const crawled = base.pages_crawled || null;
if (indexEstimate != null && crawled) {
  if (indexEstimate < crawled * 0.5) {
    findings.push({ category: 'Crawlability & Indexing', severity: 'High', title: 'Far fewer pages indexed than crawled', evidence: 'Google site: estimate ' + indexEstimate + ' vs ' + crawled + ' crawlable pages', why: 'Pages that are not indexed cannot rank. This is an estimate; confirm in Search Console.', fix: 'Check Search Console → Pages for "Crawled – currently not indexed" and "Discovered – currently not indexed", improve internal links and content depth on those URLs.', sample_urls: [], affected_count: null, affected_pct: 100, scope: 'site' });
  } else if (indexEstimate > crawled * 3) {
    findings.push({ category: 'Crawlability & Indexing', severity: 'Medium', title: 'Many more URLs indexed than the crawl found (index bloat)', evidence: 'Google site: estimate ' + indexEstimate + ' vs ' + crawled + ' crawlable pages', why: 'Old, parameter or tag URLs that stay indexed dilute crawl budget and quality signals.', fix: 'Review indexed URLs in Search Console; noindex or remove thin/duplicate URLs and fix the sitemap.', sample_urls: [], affected_count: null, affected_pct: 100, scope: 'site' });
  } else works.push('Google indexes roughly as many pages as the crawl found (' + indexEstimate + ' estimated)');
}

return [{
  json: {
    ...base,
    ai_visibility: {
      brand_name: brandTok,
      queries: rows,
      llm_answers: llm,
      index_estimate: indexEstimate,
      note: 'AI assistant checks are live answers from ChatGPT (web search on) and Perplexity via the DataForSEO LLM Responses API; each run may differ slightly. Google AI Overview data comes from a live search.'
    },
    extra_findings: [...(base.extra_findings || []), ...findings],
    extra_works: [...(base.extra_works || []), ...works]
  }
}];
