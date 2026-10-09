// Sites whose question panel is short get one Prompt Writer job each (Claude writes the buyer questions once; they are stored and reused weekly).
// v4.9: the writer also gets real questions to start from — what people ask AI about the topic (the AI-answer database, with monthly AI search
// volume) and the long / question-shaped searches the site already appears for (Search Console) — so the panel mirrors real demand.
const jobs = $('AI Plan').all().map(i => i.json).filter(p => p.need_prompts && !p.nothing_to_do);
if (!jobs.length) return [{ json: { skip: true } }];
let reads = [], texts = []; try { reads = $('Site Text Jobs').all().map(i => i.json).filter(j => !j.skip); texts = $('Read Site (AI)').all().map(i => String((i.json || {}).site_text || '')); } catch (e) {}
const textOf = (id) => { const k = reads.findIndex(r => r.site_id === id); return k >= 0 ? (texts[k] || '').replace(/\n{3,}/g, '\n\n').slice(0, 3500) : ''; };
let dreq = [], dres = []; try { dreq = $('Discovery Requests').all().map(i => i.json); dres = $('Run Discovery').all().map(i => i.json || {}); } catch (e) {}
const discovered = (siteId) => { const out = [];
  dreq.forEach((q, i) => { if (q.site_id !== siteId || q.kind !== 'discover') return; const t = ((dres[i] || {}).tasks || [])[0] || {}; if (t.status_code !== 20000) return;
    for (const it of (((t.result || [])[0] || {}).items || [])) { const qq = String(it.question || '').replace(/\s+/g, ' ').trim(); if (qq.split(' ').length < 3 || qq.length > 220) continue;
      out.push({ question: qq, volume: Number(it.ai_search_volume) || 0, platform: q.platform, brands: (it.brand_entities || []).map(b => b.title).filter(Boolean).slice(0, 4) }); } });
  const seen = new Set(); return out.sort((a, b) => b.volume - a.volume).filter(x => { const k = x.question.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 15); };
return jobs.map(p => ({ json: { site_id: p.site_id, domain: p.domain, business_name: p.business_name || p.domain, business_type: p.business_type || '', country: p.country || '', city: p.city || '',
  topics: p.topics, count: p.prompts_needed, existing: p.prompts.map(x => x.prompt), has_brand_prompt: p.prompts.some(x => x.kind === 'brand'), site_text: textOf(p.site_id),
  market_questions: discovered(p.site_id).map(x => x.question + ' (' + x.volume + '/mo' + (x.brands.length ? '; AI names ' + x.brands.join(', ') : '') + ')'),
  search_questions: (p.gsc_questions || []).map(x => x.query + ' (' + x.impressions + ' impressions)') } }));
