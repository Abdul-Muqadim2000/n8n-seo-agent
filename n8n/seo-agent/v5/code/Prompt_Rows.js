// Prompt rows for seo_ai_prompts (upsert by prompt_id; exact table columns): the Prompt Writer's new questions (Claude), or template questions when
// the writer failed or did not run, plus the stored questions whose monthly AI search volume was looked up this run (v4.9). The wording of a stored
// question never changes, so the trend always compares the same questions.
const plans = $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
let jobs = []; try { jobs = $('Prompt Jobs').all().map(i => i.json).filter(j => !j.skip); } catch (e) {}
let outs = []; try { outs = $('Prompt Writer').all().map(i => i.json); } catch (e) {}
let dreq = [], dres = []; try { dreq = $('Discovery Requests').all().map(i => i.json); dres = $('Run Discovery').all().map(i => i.json || {}); } catch (e) {}
const parse = (raw) => { if (raw && typeof raw === 'object') return raw; const s = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, ''); try { return JSON.parse(s); } catch (e) { const a = s.indexOf('{'), b = s.lastIndexOf('}'); try { return JSON.parse(s.slice(a, b + 1)); } catch (e2) { return null; } } };
const hash = (t) => { let h = 5381; for (const c of String(t)) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return h.toString(36); };
const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const now = new Date().toISOString(); const rows = [];
const KINDS = ['recommend', 'choose', 'cost', 'compare', 'problem', 'brand'], STAGES = ['awareness', 'consideration', 'decision', 'brand'], ORIGINS = ['market', 'search', 'writer'];
const STAGE_OF = { recommend: 'decision', cost: 'decision', choose: 'consideration', compare: 'consideration', problem: 'awareness', brand: 'brand', custom: 'consideration' };
// monthly AI search volume per search phrase (AI Keyword Data), per site
const volumes = new Map();
dreq.forEach((q, i) => { if (q.kind !== 'volume') return; const t = ((dres[i] || {}).tasks || [])[0] || {}; if (t.status_code !== 20000) return;
  const m = volumes.get(q.site_id) || new Map(); for (const it of (((t.result || [])[0] || {}).items || [])) if (it && it.keyword) m.set(String(it.keyword).toLowerCase().trim(), Number(it.ai_search_volume) || 0); volumes.set(q.site_id, m); });
const COLS = (r) => ({ prompt_id: r.prompt_id, site_id: r.site_id, domain: r.domain, prompt: r.prompt, kind: r.kind, topic: r.topic, keyword: r.keyword, source: r.source, status: r.status || 'active', created_at: r.created_at,
  stage: r.stage || '', cluster: r.cluster || '', volume: r.volume == null || Number.isNaN(r.volume) ? null : Number(r.volume), origin: r.origin || '', updated_at: now });
for (const p of plans) {
  const vol = volumes.get(p.site_id) || new Map();
  // stored questions: new volume (and a stage / cluster for questions written before v4.9)
  for (const q of p.prompts) { const k = String(q.keyword || '').toLowerCase().trim(); const v = vol.has(k) ? vol.get(k) : null;
    if (v === null && q.stage && q.cluster) continue;
    if (v === null && q.kind === 'brand' && q.stage) continue;
    rows.push(COLS({ ...q, site_id: p.site_id, domain: p.domain, status: 'active', volume: v !== null ? v : q.volume, stage: q.stage || STAGE_OF[q.kind] || 'consideration', cluster: q.cluster || q.topic || '' })); }
  if (!p.need_prompts) continue;
  const ji = jobs.findIndex(j => j.site_id === p.site_id);
  const got = ji >= 0 && outs[ji] && !outs[ji].error ? parse(outs[ji].output) : null;
  let qs = (got && Array.isArray(got.prompts) ? got.prompts : []).filter(q => q && q.prompt && String(q.prompt).length >= 12).map(q => { const kind = KINDS.includes(String(q.kind).toLowerCase()) ? String(q.kind).toLowerCase() : 'recommend';
    return { prompt: String(q.prompt).trim().slice(0, 300), kind, topic: String(q.cluster || q.topic || '').slice(0, 120), keyword: String(q.keyword || q.cluster || q.topic || '').toLowerCase().slice(0, 120), source: 'auto',
      stage: STAGES.includes(String(q.stage).toLowerCase()) ? String(q.stage).toLowerCase() : STAGE_OF[kind], cluster: String(q.cluster || q.topic || '').toLowerCase().slice(0, 60), origin: ORIGINS.includes(String(q.origin).toLowerCase()) ? String(q.origin).toLowerCase() : 'writer' }; });
  if (!qs.length) {   // template fallback: the same buyer journey, less natural wording
    const where = p.country ? ' in ' + (p.city || p.country) : '';
    for (const t of (p.topics.length ? p.topics : [p.domain.split('.')[0]]).slice(0, 4)) qs.push({ prompt: 'Which companies offer ' + t + where + '? Recommend the best options with their websites.', kind: 'recommend', topic: t, keyword: t, source: 'template', stage: 'decision', cluster: t, origin: 'template' }, { prompt: 'How do I choose a provider for ' + t + where + ', and what should it cost?', kind: 'choose', topic: t, keyword: t + ' cost', source: 'template', stage: 'consideration', cluster: t, origin: 'template' });
    if (!p.prompts.some(x => x.kind === 'brand')) qs.unshift({ prompt: 'What is ' + (p.business_name || p.domain) + ' (' + p.domain + ') and what does it offer?', kind: 'brand', topic: 'brand', keyword: p.business_name || p.domain.split('.')[0], source: 'template', stage: 'brand', cluster: 'brand', origin: 'template' });
  }
  const have = new Set(p.prompts.map(x => norm(x.prompt))); let added = 0;
  for (const q of qs) { if (added >= p.prompts_needed) break; if (have.has(norm(q.prompt))) continue; have.add(norm(q.prompt)); added++;
    rows.push(COLS({ prompt_id: 'p_' + hash(p.site_id + '|' + norm(q.prompt)), site_id: p.site_id, domain: p.domain, prompt: q.prompt, kind: q.kind, topic: q.topic, keyword: q.keyword || q.topic, source: q.source, status: 'active', created_at: now,
      stage: q.stage, cluster: q.cluster, volume: vol.has(String(q.keyword || '').toLowerCase().trim()) ? vol.get(String(q.keyword || '').toLowerCase().trim()) : null, origin: q.origin, fresh: true })); }
}
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];
