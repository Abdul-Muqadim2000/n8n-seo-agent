// Sites whose prompt set is short get one Prompt Writer job each (Claude writes the buyer questions once; they are stored and reused weekly).
const jobs = $('AI Plan').all().map(i => i.json).filter(p => p.need_prompts && !p.nothing_to_do);
if (!jobs.length) return [{ json: { skip: true } }];
let reads = [], texts = []; try { reads = $('Site Text Jobs').all().map(i => i.json).filter(j => !j.skip); texts = $('Read Site (AI)').all().map(i => String((i.json || {}).site_text || '')); } catch (e) {}
const textOf = (id) => { const k = reads.findIndex(r => r.site_id === id); return k >= 0 ? (texts[k] || '').replace(/\n{3,}/g, '\n\n').slice(0, 3500) : ''; };
return jobs.map(p => ({ json: { site_id: p.site_id, domain: p.domain, business_name: p.business_name || p.domain, business_type: p.business_type || '', country: p.country || '', city: p.city || '',
  topics: p.topics, count: p.prompts_needed, existing: p.prompts.map(x => x.prompt), has_brand_prompt: p.prompts.some(x => x.kind === 'brand'), site_text: textOf(p.site_id) } }));
