// One row per question x engine for seo_ai_answers: did the answer mention the brand, cite one of your pages, at which rank among the businesses
// it names, which competitors / businesses appeared, which sources it cited, the brands it named in order (ChatGPT's brand list, learned brand
// names, domains) and the searches the engine ran to write it (fan-out queries: the content AI looks for). The database views (market, index) are
// read by AI Metrics, not stored here. Engines: chatgpt / gemini (LLM scraper: the real chat interfaces), perplexity / claude (LLM Responses;
// Gemini through LLM Responses before v4.9), ai_overview / ai_mode (SERP). Shared by the AI Visibility Tracker and the AI Pulse.
// Rows carry `_text` (the answer, for the Answer Analyst); the nodes that save them keep only the table columns.
/*__AI_STATS__*/
const reqs = $('AI Requests').all().map(i => i.json);
const resps = $input.all().map(i => i.json || {});
if (!reqs.length || reqs[0].skip) return [{ json: { skip: true } }];
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const now = new Date().toISOString();
const hostOf = (u) => { const m = String(u || '').match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };   // no URL constructor in the n8n sandbox
const cleanUrl = (u) => String(u || '').replace(/[?&](utm_[a-z]+|srsltid)=[^&#]*/gi, '').replace(/\?&/, '?').replace(/\?$/, '');
const DOMAIN_RE = /\b((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|ai|co|ae|sa|qa|om|kw|bh|eg|uk|de|fr|es|it|nl|in|pk|sg|au|ca|nz|za|br|mx|us|biz|info|tech|app|cloud|global|digital|solutions|consulting|agency|me))\b/gi;
// sources AI cites that are not businesses competing for the client's buyers (they are PR / listing targets instead)
const GENERIC = /(^|\.)(wikipedia\.org|wikimedia\.org|youtube\.com|youtu\.be|linkedin\.com|facebook\.com|instagram\.com|x\.com|twitter\.com|tiktok\.com|reddit\.com|quora\.com|medium\.com|github\.com|google\.com|goo\.gl|bing\.com|apple\.com|amazon\.com|forbes\.com|reuters\.com|bloomberg\.com|gulfnews\.com|khaleejtimes\.com|thenationalnews\.com|zawya\.com|arabianbusiness\.com|gartner\.com|g2\.com|capterra\.com|trustpilot\.com|clutch\.co|glassdoor\.com|indeed\.com|statista\.com|pwc\.com|kpmg\.com|deloitte\.com|ey\.com|vertexaisearch\.cloud\.google\.com|chatgpt\.com|openai\.com|perplexity\.ai|anthropic\.com|claude\.ai|gemini\.google\.com|gstatic\.com)$|\.gov(\.[a-z]{2})?$|\.edu(\.[a-z]{2})?$|\.ac\.[a-z]{2}$|(^|\.)u\.ae$|\.int$/i;
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (t) => new RegExp('(^|[^a-z0-9])' + esc(String(t).toLowerCase()) + '($|[^a-z0-9])', 'i');
const DB_ENGINES = /^(market|index_)/;
const rows = [];
reqs.forEach((q, i) => {
  if (DB_ENGINES.test(q.engine)) return;
  const plan = plans.find(p => p.site_id === q.site_id) || { brand_names: [q.domain], competitors: [], domain: q.domain, aliases: {} };
  const r = resps[i] || {}; const task = (r.tasks || [])[0] || {}; const res = (task.result || [])[0] || null;
  let text = '', cites = [], answered = false, error = '', fanout = [], entities = [];
  if (r.error || !task.status_code) error = String((r.error && (r.error.message || r.error)) || 'no response').slice(0, 200);
  else if (task.status_code !== 20000) error = String(task.status_message || task.status_code).slice(0, 200);
  else if (res) {
    fanout = (res.fan_out_queries || []).map(String).filter(Boolean);
    if (q.engine === 'chatgpt' || (q.engine === 'gemini' && (res.markdown != null || (res.items || []).some(x => /^gemini_/.test(String(x && x.type)))))) {   // LLM scraper: the real chat interface
      text = String(res.markdown || (res.items || []).map(x => x.markdown || x.text || '').join('\n'));
      cites = [...(res.sources || []), ...(res.items || []).flatMap(x => x.sources || [])].map(s => ({ url: s.url, host: hostOf(s.url) || String(s.domain || '').replace(/^www\./, '') }));
      entities = [...(res.brand_entities || []), ...(res.items || []).flatMap(x => x.brand_entities || [])].map(b => String((b && (b.title || b.markdown)) || '').trim()).filter(Boolean);
      answered = !!text;
    } else if (q.engine === 'ai_overview' || q.engine === 'ai_mode') {
      const ao = (res.items || []).find(x => x && x.type === 'ai_overview');
      if (ao) { text = String(ao.markdown || (ao.items || []).map(x => x.markdown || x.text || '').join('\n'));
        const refs = [...(ao.references || []), ...(ao.items || []).flatMap(x => x.references || [])];
        cites = refs.map(x => ({ url: x.url, host: hostOf(x.url) || String(x.domain || '').replace(/^www\./, '') })); answered = !!(text || cites.length); }
    } else {   // llm_responses: sections with text + annotations (Gemini annotations point to a Google redirect; their title is the source domain)
      const secs = (res.items || []).flatMap(it => it.sections || []);
      text = secs.map(s => s.text || '').join('');
      cites = secs.flatMap(s => s.annotations || []).map(a => { const direct = a.direct_url || ''; let h = hostOf(direct || a.url); if (/vertexaisearch\.cloud\.google\.com/.test(h) && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(String(a.title || '').trim())) h = String(a.title).trim().toLowerCase().replace(/^www\./, ''); return { url: direct || (/vertexaisearch/.test(String(a.url)) ? '' : a.url), host: h }; });
      answered = !!text;
    }
  }
  const low = text.toLowerCase().replace(/[?&](utm_[a-z]+|srsltid)=[^\s)&\]]*/g, '');   // ChatGPT tags every link with utm_source=chatgpt.com
  const brandRes = plan.brand_names.map(wordRe);
  const firstAt = (res_) => { let best = -1; for (const re of res_) { const m = low.match(re); if (m && (best < 0 || m.index < best)) best = m.index + (m[1] ? m[1].length : 0); } return best; };
  const ourAt = firstAt(brandRes);
  const isOurs = (h) => !!h && (h === plan.domain || h.endsWith('.' + plan.domain));
  const ourUrls = [...new Set(cites.filter(c => isOurs(c.host) && c.url).map(c => cleanUrl(c.url)))];
  const cited = cites.some(c => isOurs(c.host));
  const mentioned = ourAt >= 0 || cited;
  // businesses named in the answer: configured competitors (domain or name), brand names learned for them (aliases), the engine's own brand list,
  // and business domains written in the text or linked from it
  const named = new Map();
  const put = (d, at) => { if (!d || isOurs(d)) return; if (!named.has(d) || at < named.get(d)) named.set(d, at); };
  for (const c of plan.competitors) { const lab = c.split('.')[0]; const at = firstAt([wordRe(c), ...(lab.length >= 5 ? [wordRe(lab)] : [])]); if (at >= 0 || cites.some(x => x.host === c || x.host.endsWith('.' + c))) put(c, at >= 0 ? at : 1e9); }
  const ourNames = new Set(plan.brand_names.map(b => String(b).toLowerCase()));
  for (const [name, dom] of Object.entries(plan.aliases || {})) { if (String(name).length < 4 || ourNames.has(String(name).toLowerCase())) continue; const at = firstAt([wordRe(name)]); if (at >= 0) put(dom && /\./.test(dom) ? dom : String(name), at); }
  for (const e of entities) { if (ourNames.has(e.toLowerCase()) || brandRes.some(re => re.test(e.toLowerCase()))) continue; const dom = Object.entries(plan.aliases || {}).find(([n]) => n.toLowerCase() === e.toLowerCase()); const at = firstAt([wordRe(e)]); put(dom && /\./.test(dom[1]) ? dom[1] : e, at >= 0 ? at : 1e8); }
  for (const m of low.matchAll(DOMAIN_RE)) { const d = m[1].replace(/^www\./, ''); if (isOurs(d) || GENERIC.test(d)) continue; put(d, m.index); }
  for (const c of cites) { const d = c.host; if (!d || isOurs(d) || GENERIC.test(d) || named.has(d)) continue; const lab = d.split('.')[0]; const at2 = lab.length >= 4 ? low.indexOf(lab) : -1; put(d, at2 >= 0 ? at2 : 1e9); }   // businesses cited as sources
  const others = [...mergeBrands([...named.entries()], plan.aliases).entries()].map(([k, v]) => [k, Math.min(...v)]).sort((a, b) => a[1] - b[1]);   // a brand name and its website are one business
  const rank = ourAt >= 0 ? 1 + others.filter(([, at]) => at < ourAt).length : 0;   // position among the businesses the answer names; 0 = not named (a citation alone is not a recommendation)
  const sources = [...new Set(cites.map(c => c.host).filter(Boolean))];
  const at = ourAt >= 0 ? ourAt : 0;
  const short = q.run_kind === 'pulse';
  const excerpt = text ? text.slice(Math.max(0, at - 160), at + (short ? 200 : 340)).replace(/\s+/g, ' ').trim() : '';
  const brands = [...(ourAt >= 0 ? [[plan.brand_names.find(b => !/\./.test(b)) || plan.domain, ourAt]] : []), ...others.filter(([, a]) => a < 1e9)].sort((a, b) => a[1] - b[1]).map(([d]) => d);
  rows.push({ site_id: q.site_id, domain: q.domain, run_id: q.run_id, checked_at: now, prompt_id: q.prompt_id, prompt: q.prompt, kind: q.kind, topic: q.topic || '', engine: q.engine,
    answered, mentioned: answered && mentioned, cited: answered && cited, rank: answered ? rank : 0, our_urls: ourUrls.join(' '), competitors: others.map(([d]) => d).slice(0, 12).join(', '),
    sources: sources.slice(0, 15).join(', '), excerpt: excerpt.slice(0, short ? 360 : 520), cost: Number(task.cost) || 0, error,
    run_kind: q.run_kind || 'weekly', sentiment: '', brands: brands.slice(0, 12).join(', '), issues: '', fanout: fanout.slice(0, 6).join(' | ').slice(0, 600),
    _text: answered ? text.replace(/\s+/g, ' ').slice(0, 2400) : '' });
});
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];
