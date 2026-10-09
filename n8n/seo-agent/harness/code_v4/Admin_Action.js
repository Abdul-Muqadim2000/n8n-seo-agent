// Site admin: delete | pause | resume | cadence (pages_per_week 0-3) | unpublish (keyword) | monitors (AI visibility / backlinks / monthly audit settings)
// | prospect (prospect_domain + status contacted / won / rejected / ignored / new, note, contact_email) | ai_prompts (add custom questions, switch some off) — by site_id or domain.
// The table-ensure nodes before this one output table objects, so the request is read from the trigger (live finding 2026-10-02).
let t = {}; try { t = (($('Admin Run').first() || {}).json) || {}; } catch (e) { t = ($input.first() || {}).json || {}; }
if (t.body && typeof t.body === 'object') t = { ...t, ...t.body };
const action = String(t.action || '').toLowerCase();
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const domain = normD(t.domain) || String(t.site_id || '').replace(/^site_/, '').replace(/-/g, '.');
const site_id = String(t.site_id || '').trim() || (normD(t.domain) ? 'site_' + normD(t.domain).replace(/[^a-z0-9]+/g, '-') : '');
if (!['delete', 'pause', 'resume', 'cadence', 'unpublish', 'monitors', 'prospect', 'ai_prompts'].includes(action)) throw new Error('action must be delete, pause, resume, cadence, unpublish, monitors, prospect or ai_prompts');
if (!site_id) throw new Error('site_id or domain is required');
const pages = Math.min(3, Math.max(0, Number(t.pages_per_week == null ? t.blogs_per_week : t.pages_per_week) || 0));
if (action === 'cadence' && t.pages_per_week == null && t.blogs_per_week == null) throw new Error('pages_per_week (0-3) is required for action cadence');
const keyword = String(t.keyword || '').trim().toLowerCase().replace(/\s+/g, ' ');
if (action === 'unpublish' && !keyword) throw new Error('keyword is required for action unpublish');
const prospect_domain = normD(t.prospect_domain);
const pstatus = String(t.status || '').toLowerCase();
if (action === 'prospect' && !prospect_domain) throw new Error('prospect_domain is required for action prospect');
if (action === 'prospect' && pstatus && !['new', 'contacted', 'won', 'rejected', 'ignored'].includes(pstatus)) throw new Error('status must be new, contacted, won, rejected or ignored');
const add_prompts = (Array.isArray(t.add) ? t.add : (Array.isArray(t.prompts) ? t.prompts : [])).map(x => String(typeof x === 'object' ? x.prompt : x).trim()).filter(x => x.length >= 10).slice(0, 15);
const off_prompts = (Array.isArray(t.remove) ? t.remove : []).map(x => String(x).trim()).filter(Boolean);
if (action === 'ai_prompts' && !add_prompts.length && !off_prompts.length) throw new Error('add (questions to track) or remove (prompt ids or texts) is required for action ai_prompts');
const monitors = (t.monitors && typeof t.monitors === 'object') ? t.monitors : (action === 'monitors' ? t : {});
return [{ json: { action, site_id, domain: normD(t.domain) || '', status: action === 'pause' ? 'paused' : 'active', pages_per_week: pages, cadence_status: pages > 0 ? 'active' : 'off', keyword, prospect_domain, prospect_type: String(t.type || '').toLowerCase(), prospect_status: pstatus, contact_email: /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(t.contact_email || '').trim()) ? String(t.contact_email).trim().toLowerCase() : '', note: t.note == null ? null : String(t.note).slice(0, 500), add_prompts, off_prompts, monitors, updated_at: new Date().toISOString(), request_id: String(t.request_id || '') } }];
