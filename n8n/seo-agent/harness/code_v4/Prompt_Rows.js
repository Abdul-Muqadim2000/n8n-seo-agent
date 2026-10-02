// New prompt rows for seo_ai_prompts: the Prompt Writer's questions (Claude), or template questions when the writer failed or did not run.
// Exact table columns. Existing prompts are never rewritten, so the weekly trend compares the same questions.
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
let jobs = []; try { jobs = $('Prompt Jobs').all().map(i => i.json).filter(j => !j.skip); } catch (e) {}
let outs = []; try { outs = $('Prompt Writer').all().map(i => i.json); } catch (e) {}
const parse = (raw) => { if (raw && typeof raw === 'object') return raw; const s = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, ''); try { return JSON.parse(s); } catch (e) { const a = s.indexOf('{'), b = s.lastIndexOf('}'); try { return JSON.parse(s.slice(a, b + 1)); } catch (e2) { return null; } } };
const hash = (t) => { let h = 5381; for (const c of String(t)) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return h.toString(36); };
const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const now = new Date().toISOString(); const rows = [];
const KINDS = ['recommend', 'choose', 'cost', 'compare', 'problem', 'brand'];
for (const p of plans) {
  if (!p.need_prompts) continue;
  const ji = jobs.findIndex(j => j.site_id === p.site_id);
  const got = ji >= 0 && outs[ji] && !outs[ji].error ? parse(outs[ji].output) : null;
  let qs = (got && Array.isArray(got.prompts) ? got.prompts : []).filter(q => q && q.prompt && String(q.prompt).length >= 12).map(q => ({ prompt: String(q.prompt).trim().slice(0, 300), kind: KINDS.includes(String(q.kind).toLowerCase()) ? String(q.kind).toLowerCase() : 'recommend', topic: String(q.topic || '').slice(0, 120), keyword: String(q.keyword || q.topic || '').toLowerCase().slice(0, 120), source: 'auto' }));
  if (!qs.length) {   // template fallback: the same buyer journey, less natural wording
    const where = p.country ? ' in ' + (p.city || p.country) : '';
    for (const t of (p.topics.length ? p.topics : [p.domain.split('.')[0]]).slice(0, 4)) qs.push({ prompt: 'Which companies offer ' + t + where + '? Recommend the best options with their websites.', kind: 'recommend', topic: t, keyword: t, source: 'template' }, { prompt: 'How do I choose a provider for ' + t + where + ', and what should it cost?', kind: 'choose', topic: t, keyword: t + ' cost', source: 'template' });
    if (!p.prompts.some(x => x.kind === 'brand')) qs.unshift({ prompt: 'What is ' + (p.business_name || p.domain) + ' (' + p.domain + ') and what does it offer?', kind: 'brand', topic: 'brand', keyword: p.business_name || p.domain.split('.')[0], source: 'template' });
  }
  const have = new Set(p.prompts.map(x => norm(x.prompt)));
  for (const q of qs) { if (rows.filter(r => r.site_id === p.site_id).length >= p.prompts_needed) break; if (have.has(norm(q.prompt))) continue; have.add(norm(q.prompt));
    rows.push({ prompt_id: 'p_' + hash(p.site_id + '|' + norm(q.prompt)), site_id: p.site_id, domain: p.domain, prompt: q.prompt, kind: q.kind, topic: q.topic, keyword: q.keyword || q.topic, source: q.source, status: 'active', created_at: now }); }
}
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];
