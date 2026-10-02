// One row per question x engine for seo_ai_answers (exact columns): did the answer mention the brand, cite one of your pages, at which rank
// among the businesses it names, which competitors / businesses appeared and which sources it cited. The market view (LLM Mentions) is
// read by AI Metrics, not stored here. Engines: chatgpt (llm_scraper), perplexity / gemini / claude (llm_responses), ai_overview / ai_mode (SERP).
const reqs = $('AI Requests').all().map(i => i.json);
const resps = $input.all().map(i => i.json || {});
if (!reqs.length || reqs[0].skip) return [{ json: { skip: true } }];
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const now = new Date().toISOString();
const hostOf = (u) => { const m = String(u || '').match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };   // no URL constructor in the n8n sandbox
const cleanUrl = (u) => String(u || '').replace(/[?&](utm_[a-z]+|srsltid)=[^&#]*/gi, '').replace(/\?&/, '?').replace(/\?$/, '');
const DOMAIN_RE = /\b((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|ai|co|ae|sa|qa|om|kw|bh|eg|uk|de|fr|es|it|nl|in|pk|sg|au|ca|nz|za|br|mx|us|biz|info|tech|app|cloud|global|digital|solutions|consulting|agency|me))\b/gi;
// sources AI cites that are not businesses competing for the client's buyers (they are PR / listing targets instead)
const GENERIC = /(^|\.)(wikipedia\.org|wikimedia\.org|youtube\.com|youtu\.be|linkedin\.com|facebook\.com|instagram\.com|x\.com|twitter\.com|tiktok\.com|reddit\.com|quora\.com|medium\.com|github\.com|google\.com|goo\.gl|bing\.com|apple\.com|amazon\.com|forbes\.com|reuters\.com|bloomberg\.com|gulfnews\.com|khaleejtimes\.com|thenationalnews\.com|zawya\.com|arabianbusiness\.com|gartner\.com|g2\.com|capterra\.com|trustpilot\.com|clutch\.co|glassdoor\.com|indeed\.com|statista\.com|pwc\.com|kpmg\.com|deloitte\.com|ey\.com|vertexaisearch\.cloud\.google\.com|chatgpt\.com|openai\.com|perplexity\.ai|anthropic\.com|claude\.ai|gemini\.google\.com)$|\.gov(\.[a-z]{2})?$|\.edu(\.[a-z]{2})?$|\.ac\.[a-z]{2}$|(^|\.)u\.ae$|\.int$/i;
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rows = [];
reqs.forEach((q, i) => {
  if (q.engine === 'market') return;
  const plan = plans.find(p => p.site_id === q.site_id) || { brand_names: [q.domain], competitors: [], domain: q.domain };
  const r = resps[i] || {}; const task = (r.tasks || [])[0] || {}; const res = (task.result || [])[0] || null;
  let text = '', cites = [], answered = false, error = '';
  if (r.error || !task.status_code) error = String((r.error && (r.error.message || r.error)) || 'no response').slice(0, 200);
  else if (task.status_code !== 20000) error = String(task.status_message || task.status_code).slice(0, 200);
  else if (res) {
    if (q.engine === 'chatgpt') { text = String(res.markdown || (res.items || []).map(x => x.markdown || x.text || '').join('\n')); cites = (res.sources || []).map(s => ({ url: s.url, host: hostOf(s.url) || String(s.domain || '').replace(/^www\./, '') })); answered = !!text; }
    else if (q.engine === 'ai_overview' || q.engine === 'ai_mode') {
      const ao = (res.items || []).find(x => x && x.type === 'ai_overview');
      if (ao) { text = String(ao.markdown || (ao.items || []).map(x => x.markdown || x.text || '').join('\n'));
        const refs = [...(ao.references || []), ...(ao.items || []).flatMap(x => x.references || [])];
        cites = refs.map(x => ({ url: x.url, host: hostOf(x.url) || String(x.domain || '').replace(/^www\./, '') })); answered = !!(text || cites.length); }
    } else {   // llm_responses: sections with text + annotations (Gemini annotations point to a Google redirect; their title is the source domain)
      const secs = (res.items || []).flatMap(it => it.sections || []);
      text = secs.map(s => s.text || '').join('');
      cites = secs.flatMap(s => s.annotations || []).map(a => { let h = hostOf(a.url); if (/vertexaisearch\.cloud\.google\.com/.test(h) && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(String(a.title || '').trim())) h = String(a.title).trim().toLowerCase().replace(/^www\./, ''); return { url: /vertexaisearch/.test(String(a.url)) ? '' : a.url, host: h }; });
      answered = !!text;
    }
  }
  const low = text.toLowerCase().replace(/[?&](utm_[a-z]+|srsltid)=[^\s)&\]]*/g, '');   // ChatGPT tags every link with utm_source=chatgpt.com
  const brandRes = plan.brand_names.map(b => new RegExp('(^|[^a-z0-9])' + esc(String(b).toLowerCase()) + '($|[^a-z0-9])', 'i'));
  const firstAt = (res_) => { let best = -1; for (const re of res_) { const m = low.match(re); if (m && (best < 0 || m.index < best)) best = m.index; } return best; };
  const ourAt = firstAt(brandRes);
  const isOurs = (h) => !!h && (h === plan.domain || h.endsWith('.' + plan.domain));
  const ourUrls = [...new Set(cites.filter(c => isOurs(c.host) && c.url).map(c => cleanUrl(c.url)))];
  const cited = cites.some(c => isOurs(c.host));
  const mentioned = ourAt >= 0 || cited;
  // businesses named in the answer: configured competitors (domain or name) + business domains written in the text or linked from it
  const named = new Map();
  for (const c of plan.competitors) { const lab = c.split('.')[0]; const at = firstAt([new RegExp('(^|[^a-z0-9])' + esc(c) + '($|[^a-z0-9])', 'i'), ...(lab.length >= 5 ? [new RegExp('(^|[^a-z0-9])' + esc(lab) + '($|[^a-z0-9])', 'i')] : [])]); if (at >= 0 || cites.some(x => x.host === c || x.host.endsWith('.' + c))) named.set(c, at >= 0 ? at : 1e9); }
  for (const m of low.matchAll(DOMAIN_RE)) { const d = m[1].replace(/^www\./, ''); if (isOurs(d) || GENERIC.test(d) || named.has(d)) continue; named.set(d, m.index); }
  for (const c of cites) { const d = c.host; if (!d || isOurs(d) || GENERIC.test(d) || named.has(d)) continue; const lab = d.split('.')[0]; const at2 = lab.length >= 4 ? low.indexOf(lab) : -1; named.set(d, at2 >= 0 ? at2 : 1e9); }   // businesses cited as sources
  const others = [...named.entries()].sort((a, b) => a[1] - b[1]);
  const rank = ourAt >= 0 ? 1 + others.filter(([, at]) => at < ourAt).length : 0;   // position among the businesses the answer names; 0 = not named (a citation alone is not a recommendation)
  const sources = [...new Set(cites.map(c => c.host).filter(Boolean))];
  const at = ourAt >= 0 ? ourAt : 0;
  const excerpt = text ? text.slice(Math.max(0, at - 160), at + 340).replace(/\s+/g, ' ').trim() : '';
  rows.push({ site_id: q.site_id, domain: q.domain, run_id: q.run_id, checked_at: now, prompt_id: q.prompt_id, prompt: q.prompt, kind: q.kind, topic: q.topic || '', engine: q.engine,
    answered, mentioned: answered && mentioned, cited: answered && cited, rank: answered ? rank : 0, our_urls: ourUrls.join(' '), competitors: others.map(([d]) => d).slice(0, 12).join(', '),
    sources: sources.slice(0, 15).join(', '), excerpt: excerpt.slice(0, 520), cost: Number(task.cost) || 0, error });
});
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];
