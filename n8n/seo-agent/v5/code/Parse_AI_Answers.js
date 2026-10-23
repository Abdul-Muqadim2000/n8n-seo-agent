// One row per question x engine for seo_ai_answers: did the answer mention the brand, cite one of your pages, at which rank among the businesses
// it names, which competitors / businesses appeared, which sources it cited, the brands it named in order (ChatGPT's brand list, learned brand
// names, domains) and the searches the engine ran to write it (fan-out queries: the content AI looks for). The database views (market, index) are
// read by AI Metrics, not stored here. Engines: chatgpt / gemini (LLM scraper: the real chat interfaces), perplexity / claude (LLM Responses;
// Gemini through LLM Responses before v4.9), ai_overview / ai_mode (SERP), copilot (v4.12: the Copilot Search summary in Bing's results). Shared by the AI
// Visibility Tracker and the AI Pulse. v4.12: `cited_urls` keeps the exact third-party pages each answer cited (with their titles) — the earned-media targets.
// Rows carry `_text` (the answer, for the Answer Analyst); the nodes that save them keep only the table columns.
/*__AI_STATS__*/
/*__AI_ENTITIES__*/
/*__AI_ANSWER_DATA__*/
const reqs = $('AI Requests').all().map(i => i.json);
const resps = $input.all().map(i => i.json || {});
if (!reqs.length || reqs[0].skip) return [{ json: { skip: true } }];
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
let cacheRows = []; try { cacheRows = $('Load Cache (AI)').all().map(i => i.json); } catch (e) {}   // F1a: the entities learned in earlier runs (ai_entities:<site>)
const now = new Date().toISOString();
const hostOf = (u) => { const m = String(u || '').match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };   // no URL constructor in the n8n sandbox
const cleanUrl = cleanCiteUrl;   // D19: one page one URL (host without www., no fragment, no tracking parameters) -- _ai_stats.js
const DB_ENGINES = /^(market|index_)/;
const rows = [];
reqs.forEach((q, i) => {
  if (DB_ENGINES.test(q.engine)) return;
  const plan = plans.find(p => p.site_id === q.site_id) || { site_id: q.site_id, brand_names: [q.domain], competitors: [], configured_competitors: [], domain: q.domain, aliases: {} };
  const r = resps[i] || {}; const task = (r.tasks || [])[0] || {}; const res = (task.result || [])[0] || null;
  let text = '', cites = [], answered = false, error = '', fanout = [], entities = [];
  if (r.error || !task.status_code) error = String((r.error && (r.error.message || r.error)) || 'no response').slice(0, 200);
  else if (task.status_code !== 20000) error = String(task.status_message || task.status_code).slice(0, 200);
  else if (res) {
    fanout = (res.fan_out_queries || []).map(String).filter(Boolean);
    if (q.engine === 'chatgpt' || (q.engine === 'gemini' && (res.markdown != null || (res.items || []).some(x => /^gemini_/.test(String(x && x.type)))))) {   // LLM scraper: the real chat interface
      text = String(res.markdown || (res.items || []).map(x => x.markdown || x.text || '').join('\n'));
      cites = [...(res.sources || []), ...(res.items || []).flatMap(x => x.sources || [])].map(s => ({ url: s.url, title: s.title || '', host: hostOf(s.url) || String(s.domain || '').replace(/^www\./, '') }));
      entities = [...(res.brand_entities || []), ...(res.items || []).flatMap(x => x.brand_entities || [])].map(b => String((b && (b.title || b.markdown)) || '').trim()).filter(Boolean);
      answered = !!text;
    } else if (q.engine === 'ai_overview' || q.engine === 'ai_mode' || q.engine === 'copilot') {   // Copilot Search: the ai_overview item of Bing's results
      const ao = (res.items || []).find(x => x && x.type === 'ai_overview');
      if (ao) { text = String(ao.markdown || (ao.items || []).map(x => x.markdown || x.text || '').join('\n'));
        const refs = [...(ao.references || []), ...(ao.items || []).flatMap(x => x.references || [])];
        cites = refs.map(x => ({ url: x.url, title: x.title || x.source || '', host: hostOf(x.url) || String(x.domain || '').replace(/^www\./, '') })); answered = !!(text || cites.length); }
    } else {   // llm_responses: sections with text + annotations (Gemini annotations point to a Google redirect; their title is the source domain)
      const secs = (res.items || []).flatMap(it => it.sections || []);
      text = secs.map(s => s.text || '').join('');
      cites = secs.flatMap(s => s.annotations || []).map(a => { const direct = a.direct_url || ''; let h = hostOf(direct || a.url); if (/vertexaisearch\.cloud\.google\.com/.test(h) && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(String(a.title || '').trim())) h = String(a.title).trim().toLowerCase().replace(/^www\./, ''); return { url: direct || (/vertexaisearch/.test(String(a.url)) ? '' : a.url), title: /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(String(a.title || '').trim()) ? '' : String(a.title || ''), host: h }; });
      answered = !!text;
    }
  }
  // F1a (2026-10-23, ENGINE_AUDIT E3 E4 E5 E8, PROD_STATE.md section 5): who the answer names is read by the entity kit (_ai_entities.js):
  // one entity per business (subdomains, country / brand variants, learned names and "formerly X" fold in), a role per entity (self,
  // competitor, platform, source, other), and the client's place among the businesses the answer offers. Only competitors are listed as
  // competitors: a cited directory, a government body or the client's own platform no longer is (E3), a short configured name is found
  // (E4), a common-word domain label is not the client (E5), and "small business" is not business.com (E8).
  const isOurs = (h) => !!h && (h === plan.domain || h.endsWith('.' + plan.domain));
  const D = AIE.dir({ ...plan, brand_names: AIE.ownNames(plan) }, AIE.bookOf(cacheRows, plan.site_id));
  const X = AIE.read({ text, cites, entities }, D);
  const ourAt = X.ourAt;
  const ourUrls = [...new Set([...cites.filter(c => isOurs(c.host) && c.url).map(c => cleanUrl(c.url))])];
  const cited = X.cited;
  const named = X.named;
  const mentioned = named || cited;
  const ents = X.entities;
  const compE = ents.filter(e => e.role === 'competitor').sort((a, b) => (a.position == null ? 1e9 + a.at : a.position) - (b.position == null ? 1e9 + b.at : b.position));
  const rank = named ? X.position : 0;   // position among the businesses the answer offers; 0 = not named (a citation alone is not a recommendation)
  const sources = [...new Set(cites.map(c => c.host).filter(Boolean))];
  // the exact third-party pages cited (not yours, not search engines): where to be named so the next answer names you
  const seenU = new Set(); const cited_urls = cites.filter(c => c.url && c.host && !isOurs(c.host) && !/(^|\.)(google|bing|vertexaisearch\.cloud\.google)\.com$/.test(c.host)).map(c => ({ u: cleanUrl(c.url).slice(0, 300), t: citeTitle(c.title) })).filter(c => !seenU.has(c.u) && seenU.add(c.u)).slice(0, 8);
  const at = ourAt >= 0 ? ourAt : 0;
  const short = q.run_kind === 'pulse';
  const vis = X.vis;
  const excerpt = vis ? vis.slice(Math.max(0, at - 160), at + (short ? 200 : 340)).replace(/\s+/g, ' ').trim() : '';
  const brands = ents.filter(e => (e.role === 'self' || e.role === 'competitor' || e.role === 'platform') && e.at < Infinity).sort((a, b) => a.at - b.at).map(e => e.name);
  const entitiesC = AIE.compact(ents);
  // W2-E1 (2026-10-23, WAVE2_CONTRACTS.md §1): the answer's own data, kept instead of thrown away - the full text, every source cited in order,
  // the pages read but not cited, the searches run, product / ad / local cards and the model (_ai_answer_data.js; '' = the engine reports none)
  const W2 = AAD.answerFields({ engine: q.engine, res, answered, text, cites, fanout, isOurs, ownNames: AIE.ownNames(plan), entities: X.entities, sameEntity: AIE.sameEntity });
  rows.push({ site_id: q.site_id, domain: q.domain, run_id: q.run_id, checked_at: now, prompt_id: q.prompt_id, prompt: q.prompt, kind: q.kind, topic: q.topic || '', engine: q.engine,
    answered, mentioned: answered && mentioned, cited: answered && cited, rank: answered ? (rank || 0) : 0, our_urls: ourUrls.join(' '), competitors: compE.map(e => e.id).slice(0, 12).join(', '),
    sources: sources.slice(0, 15).join(', '), excerpt: excerpt.slice(0, short ? 360 : 520), cost: Number(task.cost) || 0, error,
    run_kind: q.run_kind || 'weekly', sentiment: '', brands: brands.slice(0, 12).join(', '), issues: '', fanout: fanout.slice(0, 6).join(' | ').slice(0, 600), cited_urls: cited_urls.length ? JSON.stringify(cited_urls) : '',
    // F1a: the answer-row contract (agreed with F1b): named = the brand is named in the text; position = 1-based place among self + competitors
    // in order of first mention (null when not named); entities = every business with its role; mentioned stays named OR cited
    named: answered && named, position: answered && named ? X.position : null, entities_json: answered && entitiesC.length ? JSON.stringify(entitiesC) : '',
    ...W2,   // W2-E1
    entities: answered ? entitiesC : [],
    _text: answered ? text.replace(/\s+/g, ' ').slice(0, 2400) : '' });
});
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];
