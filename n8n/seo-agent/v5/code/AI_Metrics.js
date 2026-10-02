// Per site: how often AI answers mention / cite the business, share of voice against the competitors, rank in recommendation lists, the
// per-engine picture, the sources AI trusts (PR and listing targets), your pages it cites, the questions where competitors win (content gaps),
// the monthly market view (LLM Mentions), week-over-week changes, alerts and ranked actions. Also the seo_ai_visibility row and
// 'ai_source' rows for the link-prospect pipeline (seo_link_prospects; existing statuses kept).
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
let rows = []; try { rows = $('Parse AI Answers').all().map(i => i.json).filter(r => !r.skip && r.engine); } catch (e) {}
let reqs = [], resps = []; try { reqs = $('AI Requests').all().map(i => i.json); resps = $('Run AI Requests').all().map(i => i.json || {}); } catch (e) {}
let prospects = []; try { prospects = $('Load Link Prospects').all().map(i => i.json).filter(x => x && x.prospect_domain); } catch (e) {}
const GENERIC_SOCIAL = /(^|\.)(youtube\.com|linkedin\.com|facebook\.com|instagram\.com|x\.com|twitter\.com|tiktok\.com|reddit\.com|quora\.com|wikipedia\.org|medium\.com)$/i;
const MEDIA = /(^|\.)(gulfnews|khaleejtimes|thenationalnews|zawya|arabianbusiness|gulfbusiness|reuters|bloomberg|forbes|cnbc|bbc|ft|wsj|techcrunch|entrepreneur|economist|businessinsider|thenational|arabnews|timesofindia|dawn)\.[a-z.]+$/i;
const DIRECTORY = /(^|\.)(g2|capterra|clutch|trustpilot|goodfirms|getapp|softwareadvice|crunchbase|yelp|sortlist|designrush|themanifest|[a-z-]*yellowpages[a-z-]*|[a-z-]*directory[a-z-]*)\.[a-z.]+$/i;
const AUTHORITY = /(^|\.)(deloitte|pwc|kpmg|ey|gartner|forrester|mckinsey|accenture|statista|bcg|bain|idc)\.[a-z.]+$/i;
const kindOf = (d) => GOV.test(d) ? 'official' : GENERIC_SOCIAL.test(d) ? 'platform' : MEDIA.test(d) ? 'media' : DIRECTORY.test(d) ? 'directory' : AUTHORITY.test(d) ? 'authority' : 'site';
const GOV = /\.gov(\.[a-z]{2})?$|(^|\.)u\.ae$|\.int$|\.edu(\.[a-z]{2})?$/i;
const pct = (a, b) => b ? Math.round(1000 * a / b) / 10 : 0;
const ENG = { chatgpt: 'ChatGPT', perplexity: 'Perplexity', gemini: 'Gemini', claude: 'Claude', ai_overview: 'Google AI Overview', ai_mode: 'Google AI Mode' };
const FORM_URL = '__FORM_URL__', API_URL = '__API_URL__';
return plans.map(p => {
  const Rall = rows.filter(r => r.site_id === p.site_id);
  // the brand question ("what is <brand>?") only measures recognition: rates, share of voice and competitors use the buyer questions
  const RB = Rall.filter(r => r.kind === 'brand'), R = Rall.filter(r => r.kind !== 'brand');
  const ans = R.filter(r => r.answered); const ansAll = Rall.filter(r => r.answered);
  const errors = Rall.filter(r => r.error).length;
  const mentioned = ans.filter(r => r.mentioned).length, cited = ans.filter(r => r.cited).length;
  const ranks = ans.filter(r => r.rank > 0).map(r => r.rank);
  // competitors: configured ones always; plus businesses AI names in at least 2 answers (auto-detected rivals)
  const counts = new Map();
  for (const r of ans) for (const d of String(r.competitors || '').split(/,\s*/).filter(Boolean)) counts.set(d, (counts.get(d) || 0) + 1);
  const comp = [...new Set([...p.configured_competitors, ...[...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([d]) => d)])].slice(0, 8)
    .map(d => ({ domain: d, mentions: counts.get(d) || 0, auto: !p.configured_competitors.includes(d) }));
  const compTotal = comp.reduce((s, c) => s + c.mentions, 0);
  const share_of_voice = pct(mentioned, mentioned + compTotal);
  comp.forEach(c => { c.share = pct(c.mentions, mentioned + compTotal); });
  // per engine
  const engines = {};
  for (const e of p.engines) { const er = R.filter(r => r.engine === e), ea = er.filter(r => r.answered); const eb = RB.filter(r => r.engine === e && r.answered);
    engines[e] = { name: ENG[e] || e, asked: er.length, answered: ea.length, mentioned: ea.filter(r => r.mentioned).length, cited: ea.filter(r => r.cited).length, mention_rate: pct(ea.filter(r => r.mentioned).length, ea.length), citation_rate: pct(ea.filter(r => r.cited).length, ea.length), errors: Rall.filter(r => r.engine === e && r.error).length, knows_brand: eb.length ? eb.some(r => r.mentioned) : null }; }
  const aio = R.filter(r => r.engine === 'ai_overview');
  const aio_presence = pct(aio.filter(r => r.answered).length, aio.length), aio_citation_rate = pct(aio.filter(r => r.cited).length, aio.filter(r => r.answered).length);
  // sources AI cites (not you, not a competitor): where to get listed / featured
  const src = new Map();
  for (const r of ansAll) for (const h of String(r.sources || '').split(/,\s*/).filter(Boolean)) { if (h === p.domain || h.endsWith('.' + p.domain) || comp.some(c => c.domain === h)) continue; const s = src.get(h) || { domain: h, citations: 0, engines: new Set(), topics: new Set() }; s.citations++; s.engines.add(ENG[r.engine] || r.engine); if (r.topic) s.topics.add(r.topic); src.set(h, s); }
  const sources = [...src.values()].sort((a, b) => b.citations - a.citations).slice(0, 15).map(s => ({ domain: s.domain, citations: s.citations, engines: [...s.engines], topics: [...s.topics].slice(0, 3), kind: kindOf(s.domain) }));
  const pages = new Map(); for (const r of ansAll) for (const u of String(r.our_urls || '').split(/\s+/).filter(Boolean)) pages.set(u, (pages.get(u) || 0) + 1);
  const our_pages = [...pages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([url, n]) => ({ url, citations: n }));
  // per question: who wins
  const byQ = new Map();
  for (const r of Rall) { const q = byQ.get(r.prompt_id) || { prompt: r.prompt, kind: r.kind, topic: r.topic, engines: {}, competitors: new Set(), sources: new Set() }; q.engines[r.engine] = !r.answered ? (r.error ? 'error' : 'none') : r.cited ? 'cited' : r.mentioned ? 'mentioned' : 'absent';
    if (r.answered) { String(r.competitors || '').split(/,\s*/).filter(Boolean).forEach(d => q.competitors.add(d)); String(r.sources || '').split(/,\s*/).filter(Boolean).forEach(d => q.sources.add(d)); } byQ.set(r.prompt_id, q); }
  const questions = [...byQ.entries()].map(([id, q]) => ({ prompt_id: id, prompt: q.prompt, kind: q.kind, topic: q.topic, engines: q.engines, won: Object.values(q.engines).some(v => v === 'cited' || v === 'mentioned'), competitors: [...q.competitors].slice(0, 6), sources: [...q.sources].filter(h => h !== p.domain).slice(0, 5) }));
  const gaps = questions.filter(q => !q.won && q.kind !== 'brand' && q.competitors.length).slice(0, 8);
  const brandQ = questions.find(q => q.kind === 'brand');
  const bAns = RB.filter(r => r.answered); const brand = { asked: RB.length, answered: bAns.length, known: bAns.filter(r => r.mentioned).length, engines: bAns.filter(r => r.mentioned).map(r => ENG[r.engine] || r.engine) };
  const brand_known = bAns.length ? brand.known * 2 >= bAns.length : null;
  // market view: domains AI answers cite for the main topic (LLM Mentions, monthly)
  let market = null; const mi = reqs.findIndex(q => q.site_id === p.site_id && q.engine === 'market');
  if (mi >= 0) { const t = ((resps[mi] || {}).tasks || [])[0] || {}; const res = (t.result || [])[0] || null;
    const items = (res && res.items) || []; const tot = res && res.total ? ((res.total.platform || [])[0] || {}) : {};
    const list = items.map(x => ({ domain: String(x.key || '').replace(/^www\./, ''), mentions: ((x.location || [])[0] || {}).mentions || x.mentions || 0, ai_search_volume: ((x.location || [])[0] || {}).ai_search_volume || x.ai_search_volume || 0 })).filter(x => x.domain);
    market = { keyword: p.market_keyword, checked_at: p.checked_at.slice(0, 10), total_mentions: tot.mentions || null, ai_search_volume: tot.ai_search_volume || null, top: list.slice(0, 12), you: list.findIndex(x => x.domain === p.domain || x.domain.endsWith('.' + p.domain)) + 1 || null, error: t.status_code && t.status_code !== 20000 ? t.status_message : null }; }
  else if (p.previous && p.previous.market) market = { ...p.previous.market, carried: true };
  // changes vs last week, alerts
  const prev = p.previous; const mention_rate = pct(mentioned, ans.length), citation_rate = pct(cited, ans.length);
  const delta = prev ? { mention_rate: +(mention_rate - prev.mention_rate).toFixed(1), citation_rate: +(citation_rate - prev.citation_rate).toFixed(1), share_of_voice: +(share_of_voice - prev.share_of_voice).toFixed(1) } : null;
  const alerts = [];
  if (delta && delta.mention_rate <= -15) alerts.push({ level: 'high', text: 'AI mentions dropped ' + Math.abs(delta.mention_rate) + ' points to ' + mention_rate + '% of answers.' });
  if (prev && prev.engines) for (const [e, v] of Object.entries(prev.engines)) if ((v.cited || 0) > 0 && engines[e] && engines[e].answered && !engines[e].cited) alerts.push({ level: 'medium', text: (ENG[e] || e) + ' no longer cites any of your pages (cited ' + v.cited + ' times last time).' });
  if (brand_known === false) alerts.push({ level: 'medium', text: 'Only ' + brand.known + ' of ' + brand.answered + ' AI assistants recognise ' + (p.business_name || p.domain) + ' when asked about it directly.' });
  if (ans.length && errors > Rall.length / 2) alerts.push({ level: 'low', text: errors + ' of ' + R.length + ' AI requests failed; this week\'s numbers are partial.' });
  // actions, most valuable first
  const actions = [];
  for (const g of gaps.slice(0, 3)) actions.push({ priority: 1, type: 'content', action: 'Win the answer to "' + g.prompt + '"', why: 'AI recommends ' + g.competitors.slice(0, 3).join(', ') + ' here and not you' + (g.sources.length ? '; it relies on ' + g.sources.slice(0, 3).join(', ') : '') + '.', keyword: g.topic || g.prompt,
    api_body: { mode: 'keyword', keyword: (g.topic || g.prompt).toLowerCase().slice(0, 80), country: p.country, domain: p.domain, page_type: g.kind === 'compare' ? 'Guide' : 'Service Page', receive: ['Keyword Report', 'Page Content'] } });
  const VERB = { site: 'Get featured on ', media: 'Pitch an expert comment to ', directory: 'Get listed (with reviews) on ' };
  for (const s of sources.filter(s => VERB[s.kind] && s.citations >= 2).slice(0, 4)) actions.push({ priority: 2, type: s.kind === 'site' ? 'pr' : s.kind, action: VERB[s.kind] + s.domain, why: 'AI answers cite it ' + s.citations + ' times (' + s.engines.join(', ') + ')' + (s.topics.length ? ' for ' + s.topics.join(', ') : '') + (s.kind === 'site' ? '. A guest article, a comparison mention or a quote there feeds the answers directly.' : s.kind === 'media' ? '. Assistants quote news coverage: offer data, a deadline explainer or a client story.' : '. Assistants lean on these lists when they recommend providers.') });
  const plat = sources.filter(s => s.kind === 'platform').slice(0, 2);
  if (plat.length) actions.push({ priority: 3, type: 'platform', action: 'Publish where AI looks: ' + plat.map(s => s.domain).join(', '), why: 'AI answers cite these platforms ' + plat.reduce((n, s) => n + s.citations, 0) + ' times for your topics (e.g. a short explainer video, a LinkedIn article, an answer in a relevant thread).' });
  const off = sources.filter(s => s.kind === 'official').slice(0, 2);
  if (off.length) actions.push({ priority: 3, type: 'official', action: 'Be listed on ' + off.map(s => s.domain).join(', '), why: 'Official sources AI trusts for this topic; registry listings (e.g. accredited-provider lists) are cited directly.' });
  if (brand_known === false) actions.push({ priority: 2, type: 'entity', action: 'Make the brand recognisable to AI', why: 'Complete the business profile, add Organization schema with sameAs (LinkedIn, Google Business Profile), keep name / address / phone identical everywhere, publish an About page and get listed on the sources above.' });
  if (cited === 0 && ans.length) actions.push({ priority: 2, type: 'citable', action: 'Give AI something to cite', why: 'No answer cited your pages. Pages with a direct 40-60 word answer, a dated fact table and clear headings (every page the agent writes has them) are the ones assistants quote.' });
  // seo_ai_visibility row (exact columns) and ai_source prospects (status kept when the prospect already exists)
  const J = (o) => JSON.stringify(o);
  const vis_row = { site_id: p.site_id, domain: p.domain, run_id: p.run_id, checked_at: p.checked_at, prompts: byQ.size, answers: ansAll.length, mention_rate, citation_rate, share_of_voice, avg_rank: ranks.length ? +(ranks.reduce((a, b) => a + b, 0) / ranks.length).toFixed(1) : 0,
    aio_presence, aio_citation_rate, engines_json: J(engines), competitors_json: J(comp), sources_json: J(sources), pages_json: J(our_pages), gaps_json: J(gaps.map(g => ({ prompt: g.prompt, competitors: g.competitors, sources: g.sources }))), market_json: market ? J(market) : '',
    market_month: market && !market.carried && !market.error ? p.checked_at.slice(0, 7) : ((prev && prev.market_month) || ''), cost_usd: +(Rall.reduce((s, r) => s + (Number(r.cost) || 0), 0) + (mi >= 0 ? (Number((((resps[mi] || {}).tasks || [])[0] || {}).cost) || 0) : 0)).toFixed(4), alerts: alerts.map(a => a.level + ': ' + a.text).join(' | ') };
  const now = p.checked_at;
  const prospect_rows = sources.filter(s => !['platform', 'authority'].includes(s.kind) && s.citations >= 1).slice(0, 10).map(s => { const old = prospects.find(x => x.site_id === p.site_id && x.prospect_domain === s.domain && x.type === 'ai_source') || {};
    return { site_id: p.site_id, domain: p.domain, prospect_domain: s.domain, type: 'ai_source', rank: Number(old.rank) || 0, spam_score: Number(old.spam_score) || 0, detail: 'Cited ' + s.citations + 'x in AI answers (' + s.engines.join(', ') + ')' + (s.topics.length ? ' about ' + s.topics.join(', ') : ''), source_url: '', target_url: old.target_url || '',
      status: old.status || 'new', first_seen: old.first_seen || now, last_seen: now, won_at: old.won_at || '', outreach_subject: old.outreach_subject || '', outreach_body: old.outreach_body || '', note: old.note || ({ official: 'official source: ask to be listed', media: 'news site: pitch a story or expert comment', directory: 'directory / review site: get listed' }[s.kind] || '') }; });
  return { json: { ...p, metrics: { asked: R.length, answered: ans.length, errors, mentioned, cited, mention_rate, citation_rate, share_of_voice, avg_rank: vis_row.avg_rank, aio_presence, aio_citation_rate, brand_known, brand, delta },
    engines, competitors: comp, sources, our_pages, questions, gaps, market, alerts, actions: actions.slice(0, 8), vis_row, prospect_rows, cost_usd: vis_row.cost_usd, form_url: FORM_URL, api_url: API_URL } };
});
