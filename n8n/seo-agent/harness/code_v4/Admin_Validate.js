// Same rules as Admin Action (Site Admin), answered as a 400 instead of a failed execution.
const raw = $input.first().json || {};
const b = (raw.body && typeof raw.body === 'object' && !Array.isArray(raw.body)) ? raw.body : {};
const action = String(b.action || '').toLowerCase();
const errors = [];
if (!['delete', 'pause', 'resume', 'cadence', 'unpublish', 'monitors', 'prospect', 'ai_prompts', 'content_groups', 'facts', 'market'].includes(action)) errors.push('action must be delete, pause, resume, cadence, unpublish, monitors, prospect, ai_prompts, content_groups, facts or market');
if (action === 'market' && (typeof b.country !== 'string' || !b.country.trim())) errors.push('country (a country name or ISO-2 code) is required for action market');   // MKT (2026-10-27): Site Admin checks it against COUNTRIES
if (action === 'facts' && (b.business_facts == null || typeof b.business_facts !== 'string')) errors.push('business_facts (text; an empty text clears them) is required for action facts');   // P1 (2026-10-20)
if (action === 'content_groups' && !Array.isArray(b.content_groups)) errors.push('content_groups (a list of {name, pattern}; [] clears them) is required for action content_groups');
if (!b.site_id && !b.domain) errors.push('site_id or domain is required');
if (action === 'cadence' && b.pages_per_week == null && b.blogs_per_week == null) errors.push('pages_per_week (0-3) is required for action cadence');
if (action === 'unpublish' && !b.keyword) errors.push('keyword is required for action unpublish');
if (action === 'prospect' && !b.prospect_domain) errors.push('prospect_domain is required for action prospect');
if (action === 'prospect' && b.status && !['new', 'contacted', 'replied', 'won', 'rejected', 'ignored'].includes(String(b.status).toLowerCase())) errors.push('status must be new, contacted, replied, won, rejected or ignored');
if (action === 'ai_prompts' && !['add', 'remove', 'enable', 'pin', 'unpin', 'edit'].some(k => Array.isArray(b[k]) && b[k].length)) errors.push('add (questions to track), edit, remove, enable, pin or unpin (prompt ids or texts) is required for action ai_prompts');   // G6 (2026-10-18): the panel manager
if (action === 'ai_prompts' && ['add', 'remove', 'enable', 'pin', 'unpin', 'edit'].some(k => Array.isArray(b[k]) && b[k].length > 500)) errors.push('at most 500 questions per change');
return [{ json: { ok: errors.length === 0, error: errors.join('; '), action, forward: { ...b, action, request_id: String(b.request_id || ('admin-' + $execution.id)) } } }];