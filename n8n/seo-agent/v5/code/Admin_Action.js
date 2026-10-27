// Site admin: delete | pause | resume | cadence (pages_per_week 0-3) | unpublish (keyword) | monitors (AI visibility / backlinks / monthly audit settings)
// | facts (business_facts, the client's own facts about the business, stored on seo_sites; P1 2026-10-20; H3 2026-10-28: + fact_answers)
// | market (country: name or ISO-2 of the main workflow's COUNTRIES; MKT 2026-10-27, AUDIT M2): the market every weekly job measures the website
//   in (seo_sites country / location_code / language_code). Rank history and past rows stay as they are: the next checks start a new baseline.
// | prospect (prospect_domain + status contacted / replied / won / rejected / ignored / new, note, contact_email; replied: v4.13) | ai_prompts (add custom questions, switch some off) — by site_id or domain.
// The table-ensure nodes before this one output table objects, so the request is read from the trigger (live finding 2026-10-02).
/*__AI_MEASURE__*/
/*__FACT_ANSWERS__*/
/*__COUNTRIES__*/
let t = {}; try { t = (($('Admin Run').first() || {}).json) || {}; } catch (e) { t = ($input.first() || {}).json || {}; }
if (t.body && typeof t.body === 'object') t = { ...t, ...t.body };
const action = String(t.action || '').toLowerCase();
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const domain = normD(t.domain) || String(t.site_id || '').replace(/^site_/, '').replace(/-/g, '.');
const site_id = String(t.site_id || '').trim() || (normD(t.domain) ? 'site_' + normD(t.domain).replace(/[^a-z0-9]+/g, '-') : '');
if (!['delete', 'pause', 'resume', 'cadence', 'unpublish', 'monitors', 'prospect', 'ai_prompts', 'content_groups', 'facts', 'market'].includes(action)) throw new Error('action must be delete, pause, resume, cadence, unpublish, monitors, prospect, ai_prompts, content_groups, facts or market');
// MKT (2026-10-27): the website's market, read from the same COUNTRIES table Normalize Input uses (never a code the caller sends)
const countryRaw = String(t.country == null ? '' : t.country).trim();
const marketName = countryRaw ? (Object.keys(COUNTRIES).find(n => n.toLowerCase() === countryRaw.toLowerCase()) || Object.keys(COUNTRIES).find(n => String(COUNTRIES[n].iso).toUpperCase() === countryRaw.toUpperCase()) || '') : '';
if (action === 'market' && !marketName) throw new Error('country (one of ' + Object.keys(COUNTRIES).join(', ') + ', or its ISO-2 code) is required for action market');
const market = marketName ? { country: marketName, location_code: Number(COUNTRIES[marketName].code), language_code: String(COUNTRIES[marketName].lang || 'en'), country_iso: String(COUNTRIES[marketName].iso) } : { country: '', location_code: 0, language_code: '', country_iso: '' };
// P1 (2026-10-20): the business facts the client saved in the app, so the Content Cadence and the readiness rule (v5/code/_readiness.js) read them
if (action === 'facts' && t.business_facts == null) throw new Error('business_facts (text; an empty text clears them) is required for action facts');
const business_facts = String(t.business_facts == null ? '' : t.business_facts).trim().slice(0, 2000);
// H3 (2026-10-28, page review): with the facts the app may send the client's answers to the questions on written pages (fact_key -> { decision,
// text }), kept once per website (seo_sites.fact_answers_json) and carried by every later page run (FA.forRun). Only a request that sends the key
// writes the column: a facts save without it never clears the answers. An empty object clears them.
const fact_answers_sent = action === 'facts' && t.fact_answers !== undefined && t.fact_answers !== null;
if (fact_answers_sent && (Array.isArray(t.fact_answers) || (typeof t.fact_answers !== 'object' && !/^\s*\{/.test(String(t.fact_answers))))) throw new Error('fact_answers must be an object fact_key -> { decision, text }');
const FAP = fact_answers_sent ? FA.parse(t.fact_answers) : { answers: {}, dropped: 0 };
const fact_answers_json = fact_answers_sent ? JSON.stringify(FAP.answers) : '';
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
const asQ = (x) => (x && typeof x === 'object') ? { prompt: S6(x.prompt, 300), persona: S6(x.persona, 40), cluster: S6(x.cluster, 60).toLowerCase(), stage: S6(x.stage, 20).toLowerCase(), market: S6(x.market, 8), pinned: x.pinned === true || String(x.pinned) === 'true', keyword: S6(x.keyword, 120) } : { prompt: S6(x, 300), persona: '', cluster: '', stage: '', market: '', pinned: false, keyword: '' };   // F2 (E9): the owner's own search phrase, when given
const add_prompts = (Array.isArray(t.add) ? t.add : (Array.isArray(t.prompts) ? t.prompts : [])).map(asQ).filter(x => x.prompt.length >= 10).slice(0, 500);
const off_prompts = (Array.isArray(t.remove) ? t.remove : []).map(x => String(x).trim()).filter(Boolean).slice(0, 500);
const on_prompts = (Array.isArray(t.enable) ? t.enable : []).map(x => String(x).trim()).filter(Boolean).slice(0, 500);
const pin_prompts = (Array.isArray(t.pin) ? t.pin : []).map(x => String(x).trim()).filter(Boolean).slice(0, 500);
const unpin_prompts = (Array.isArray(t.unpin) ? t.unpin : []).map(x => String(x).trim()).filter(Boolean).slice(0, 500);
// AI-FOCUS (2026-10-27): accept (a question the engine proposed starts being asked) and retire (the owner retires a question: kept with its history, never asked)
const accept_prompts = (Array.isArray(t.accept) ? t.accept : []).map(x => String(x).trim()).filter(Boolean).slice(0, 500);
const retire_prompts = (Array.isArray(t.retire) ? t.retire : []).map(x => String(x).trim()).filter(Boolean).slice(0, 500);
const edit_prompts = (Array.isArray(t.edit) ? t.edit : []).filter(x => x && typeof x === 'object' && String(x.prompt_id || '').trim()).map(x => ({ prompt_id: String(x.prompt_id).trim(), ...asQ(x), prompt: S6(x.prompt, 300), pinned: x.pinned === undefined ? undefined : (x.pinned === true || String(x.pinned) === 'true') })).slice(0, 500);
if (action === 'ai_prompts' && !add_prompts.length && !off_prompts.length && !on_prompts.length && !pin_prompts.length && !unpin_prompts.length && !edit_prompts.length && !accept_prompts.length && !retire_prompts.length) throw new Error('add (questions to track), edit, remove, enable, pin, unpin, accept or retire (prompt ids or texts) is required for action ai_prompts');
// B7-5 (W3-D): content_groups = [{ name, pattern }] -- a regular expression per group over the page path (case-insensitive); [] clears them
const rawGroups = Array.isArray(t.content_groups) ? t.content_groups : (Array.isArray(t.groups) ? t.groups : null);
if (action === 'content_groups' && !rawGroups) throw new Error('content_groups (a list of { name, pattern }; an empty list clears the groups) is required for action content_groups');
const content_groups = (rawGroups || []).map(g => ({ name: String(g && g.name || '').trim().slice(0, 60), pattern: String(g && g.pattern || '').trim().slice(0, 200) })).filter(g => g.name && g.pattern).slice(0, 12);
if (action === 'content_groups') for (const g of content_groups) { if (/(\+|\*|\})\)?[+*{]/.test(g.pattern)) throw new Error('content group "' + g.name + '": nested repetition in the pattern is refused'); try { new RegExp(g.pattern, 'i'); } catch (e) { throw new Error('content group "' + g.name + '": not a valid regular expression'); } }
const content_groups_json = JSON.stringify(content_groups);
const monitors = (t.monitors && typeof t.monitors === 'object') ? t.monitors : (action === 'monitors' ? t : {});
// W2-E2 (2026-10-23, docs/ai-visibility-2026-10-23/fixes/W2-E2.md): the owner's AI alert rules - [{ id, metric, scope, direction, threshold_points, enabled }] -
// checked by the engine's own rule (a bad rule is refused with its reason, nothing is stored); [] or '' clears them. The share-of-voice set: competitor ids.
{ const raw = monitors.ai_alert_rules_json !== undefined ? monitors.ai_alert_rules_json : monitors.ai_alert_rules;
  if (raw !== undefined && raw !== null) { delete monitors.ai_alert_rules; monitors.ai_alert_rules_json = (raw === '' || (Array.isArray(raw) && !raw.length)) ? '' : JSON.stringify(AVX.validateRules(typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch (e) { throw new Error('ai_alert_rules_json is not valid JSON'); } })() : raw)); }
  if (monitors.ai_sov_set !== undefined && monitors.ai_sov_set !== null) monitors.ai_sov_set = (Array.isArray(monitors.ai_sov_set) ? monitors.ai_sov_set : String(monitors.ai_sov_set).split(/[\n,;]+/)).map(x => String(x).trim()).filter(Boolean)
    .map(x => /\./.test(x) ? normD(x) : x.slice(0, 60)).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).slice(0, 20).join(', '); }
return [{ json: { fact_answers_sent, fact_answers_json, fact_answers_count: Object.keys(FAP.answers).length, fact_answers_dropped: FAP.dropped, action, site_id, domain: normD(t.domain) || '', status: action === 'pause' ? 'paused' : 'active', pages_per_week: pages, cadence_status: pages > 0 ? 'active' : 'off', keyword, prospect_domain, prospect_type: String(t.type || '').toLowerCase(), prospect_status: pstatus, contact_email: /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(t.contact_email || '').trim()) ? String(t.contact_email).trim().toLowerCase() : '', note: t.note == null ? null : String(t.note).slice(0, 500), add_prompts, off_prompts, on_prompts, pin_prompts, unpin_prompts, edit_prompts, accept_prompts, retire_prompts, monitors, content_groups_json, business_facts, market_country: market.country, market_location_code: market.location_code, market_language_code: market.language_code, market_iso: market.country_iso, updated_at: new Date().toISOString(), request_id: String(t.request_id || '') } }];
