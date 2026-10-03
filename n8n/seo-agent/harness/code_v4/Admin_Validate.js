// Same rules as Admin Action (Site Admin), answered as a 400 instead of a failed execution.
const raw = $input.first().json || {};
const b = (raw.body && typeof raw.body === 'object' && !Array.isArray(raw.body)) ? raw.body : {};
const action = String(b.action || '').toLowerCase();
const errors = [];
if (!['delete', 'pause', 'resume', 'cadence', 'unpublish', 'monitors', 'prospect', 'ai_prompts'].includes(action)) errors.push('action must be delete, pause, resume, cadence, unpublish, monitors, prospect or ai_prompts');
if (!b.site_id && !b.domain) errors.push('site_id or domain is required');
if (action === 'cadence' && b.pages_per_week == null && b.blogs_per_week == null) errors.push('pages_per_week (0-3) is required for action cadence');
if (action === 'unpublish' && !b.keyword) errors.push('keyword is required for action unpublish');
if (action === 'prospect' && !b.prospect_domain) errors.push('prospect_domain is required for action prospect');
if (action === 'prospect' && b.status && !['new', 'contacted', 'won', 'rejected', 'ignored'].includes(String(b.status).toLowerCase())) errors.push('status must be new, contacted, won, rejected or ignored');
if (action === 'ai_prompts' && !(Array.isArray(b.add) && b.add.length) && !(Array.isArray(b.remove) && b.remove.length)) errors.push('add (questions to track) or remove (prompt ids or texts) is required for action ai_prompts');
return [{ json: { ok: errors.length === 0, error: errors.join('; '), action, forward: { ...b, action, request_id: String(b.request_id || ('admin-' + $execution.id)) } } }];