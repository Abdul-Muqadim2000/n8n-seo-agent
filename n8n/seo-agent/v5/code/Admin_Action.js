// Site admin: delete | pause | resume | cadence (pages_per_week 0-3) | unpublish (keyword) | monitors (AI visibility / backlinks / monthly audit settings)
// | prospect (prospect_domain + status contacted / replied / won / rejected / ignored / new, note, contact_email; replied: v4.13) | ai_prompts (add custom questions, switch some off) — by site_id or domain.
// The table-ensure nodes before this one output table objects, so the request is read from the trigger (live finding 2026-10-02).
let t = {}; try { t = (($('Admin Run').first() || {}).json) || {}; } catch (e) { t = ($input.first() || {}).json || {}; }
if (t.body && typeof t.body === 'object') t = { ...t, ...t.body };
const action = String(t.action || '').toLowerCase();
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const domain = normD(t.domain) || String(t.site_id || '').replace(/^site_/, '').replace(/-/g, '.');
const site_id = String(t.site_id || '').trim() || (normD(t.domain) ? 'site_' + normD(t.domain).replace(/[^a-z0-9]+/g, '-') : '');
if (!['delete', 'pause', 'resume', 'cadence', 'unpublish', 'monitors', 'prospect', 'ai_prompts', 'content_groups'].includes(action)) throw new Error('action must be delete, pause, resume, cadence, unpublish, monitors, prospect, ai_prompts or content_groups');
if (!site_id) throw new Error('site_id or domain is required');
const pages = Math.min(3, Math.max(0, Number(t.pages_per_week == null ? t.blogs_per_week : t.pages_per_week) || 0));
if (action === 'cadence' && t.pages_per_week == null && t.blogs_per_week == null) throw new Error('pages_per_week (0-3) is required for action cadence');
const keyword = String(t.keyword || '').trim().toLowerCase().replace(/\s+/g, ' ');
if (action === 'unpublish' && !keyword) throw new Error('keyword is required for action unpublish');
const prospect_domain = normD(t.prospect_domain);
const pstatus = String(t.status || '').toLowerCase();
if (action === 'prospect' && !prospect_domain) throw new Error('prospect_domain is required for action prospect');
if (action === 'prospect' && pstatus && !['new', 'contacted', 'replied', 'won', 'rejected', 'ignored'].includes(pstatus)) throw new Error('status must be new, contacted, replied, won, rejected or ignored');
// G6 (2026-10-18): the owner manages the whole panel — add (text, or { prompt, persona, cluster, stage, market, pinned }: up to 500 at once, a
// CSV import from the app), edit (persona / cluster / stage / market of a stored question; NEW WORDING is a new question and the old one is
// switched off, so a trend never compares two different questions), remove (switch off), enable (switch back on), pin / unpin
const S6 = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const asQ = (x) => (x && typeof x === 'object') ? { prompt: S6(x.prompt, 300), persona: S6(x.persona, 40), cluster: S6(x.cluster, 60).toLowerCase(), stage: S6(x.stage, 20).toLowerCase(), market: S6(x.market, 8), pinned: x.pinned === true || String(x.pinned) === 'true' } : { prompt: S6(x, 300), persona: '', cluster: '', stage: '', market: '', pinned: false };
const add_prompts = (Array.isArray(t.add) ? t.add : (Array.isArray(t.prompts) ? t.prompts : [])).map(asQ).filter(x => x.prompt.length >= 10).slice(0, 500);
const off_prompts = (Array.isArray(t.remove) ? t.remove : []).map(x => String(x).trim()).filter(Boolean).slice(0, 500);
const on_prompts = (Array.isArray(t.enable) ? t.enable : []).map(x => String(x).trim()).filter(Boolean).slice(0, 500);
const pin_prompts = (Array.isArray(t.pin) ? t.pin : []).map(x => String(x).trim()).filter(Boolean).slice(0, 500);
const unpin_prompts = (Array.isArray(t.unpin) ? t.unpin : []).map(x => String(x).trim()).filter(Boolean).slice(0, 500);
const edit_prompts = (Array.isArray(t.edit) ? t.edit : []).filter(x => x && typeof x === 'object' && String(x.prompt_id || '').trim()).map(x => ({ prompt_id: String(x.prompt_id).trim(), ...asQ(x), prompt: S6(x.prompt, 300), pinned: x.pinned === undefined ? undefined : (x.pinned === true || String(x.pinned) === 'true') })).slice(0, 500);
if (action === 'ai_prompts' && !add_prompts.length && !off_prompts.length && !on_prompts.length && !pin_prompts.length && !unpin_prompts.length && !edit_prompts.length) throw new Error('add (questions to track), edit, remove, enable, pin or unpin (prompt ids or texts) is required for action ai_prompts');
// B7-5 (W3-D): content_groups = [{ name, pattern }] -- a regular expression per group over the page path (case-insensitive); [] clears them
const rawGroups = Array.isArray(t.content_groups) ? t.content_groups : (Array.isArray(t.groups) ? t.groups : null);
if (action === 'content_groups' && !rawGroups) throw new Error('content_groups (a list of { name, pattern }; an empty list clears the groups) is required for action content_groups');
const content_groups = (rawGroups || []).map(g => ({ name: String(g && g.name || '').trim().slice(0, 60), pattern: String(g && g.pattern || '').trim().slice(0, 200) })).filter(g => g.name && g.pattern).slice(0, 12);
if (action === 'content_groups') for (const g of content_groups) { if (/(\+|\*|\})\)?[+*{]/.test(g.pattern)) throw new Error('content group "' + g.name + '": nested repetition in the pattern is refused'); try { new RegExp(g.pattern, 'i'); } catch (e) { throw new Error('content group "' + g.name + '": not a valid regular expression'); } }
const content_groups_json = JSON.stringify(content_groups);
const monitors = (t.monitors && typeof t.monitors === 'object') ? t.monitors : (action === 'monitors' ? t : {});
return [{ json: { action, site_id, domain: normD(t.domain) || '', status: action === 'pause' ? 'paused' : 'active', pages_per_week: pages, cadence_status: pages > 0 ? 'active' : 'off', keyword, prospect_domain, prospect_type: String(t.type || '').toLowerCase(), prospect_status: pstatus, contact_email: /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(t.contact_email || '').trim()) ? String(t.contact_email).trim().toLowerCase() : '', note: t.note == null ? null : String(t.note).slice(0, 500), add_prompts, off_prompts, on_prompts, pin_prompts, unpin_prompts, edit_prompts, monitors, content_groups_json, updated_at: new Date().toISOString(), request_id: String(t.request_id || '') } }];
