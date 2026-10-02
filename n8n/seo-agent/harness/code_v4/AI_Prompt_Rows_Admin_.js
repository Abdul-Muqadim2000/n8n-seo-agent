// Site Admin "ai_prompts": adds custom buyer questions (source custom, tracked weekly before the automatic ones) and switches questions off
// (by prompt id or exact text). Exact seo_ai_prompts columns; upsert by prompt_id.
const a = $('Admin Action').first().json;
let rows = []; try { rows = $('Load AI Prompts (Admin)').all().map(i => i.json).filter(x => x && x.site_id === a.site_id); } catch (e) {}
const hash = (t) => { let h = 5381; for (const c of String(t)) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return h.toString(36); };
const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const out = [];
for (const q of a.add_prompts) { const id = 'p_' + hash(a.site_id + '|' + norm(q)); const old = rows.find(r => r.prompt_id === id);
  out.push({ prompt_id: id, site_id: a.site_id, domain: a.domain || (old || {}).domain || '', prompt: q, kind: 'custom', topic: (old || {}).topic || '', keyword: (old || {}).keyword || norm(q).split(' ').slice(0, 5).join(' '), source: 'custom', status: 'active', created_at: (old || {}).created_at || a.updated_at }); }
for (const x of a.off_prompts) for (const r of rows.filter(r => r.prompt_id === x || norm(r.prompt) === norm(x))) out.push({ prompt_id: r.prompt_id, site_id: r.site_id, domain: r.domain, prompt: r.prompt, kind: r.kind, topic: r.topic, keyword: r.keyword, source: r.source, status: 'off', created_at: r.created_at });
return out.length ? out.map(r => ({ json: r })) : [{ json: { skip: true } }];
