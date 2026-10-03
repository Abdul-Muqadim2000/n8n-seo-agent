/*__REACH__*/
// v4.8 (PIPELINE_FEATURE_SPEC §9.1): the new ladder's row in seo_ladder_settings, written once its seo_ladders rows are stored (upsert by ladder_id,
// exact table columns). mode = the website's default (its '_site' row) else 'auto'; priority = after every existing ladder of the site (highest
// priority + 1); status 'active'; plan_type and reach from the plan; source 'ladder'. Existing ladders of the site without a priority (no row yet)
// get one that keeps today's order — after the prioritised ones, oldest first — with mode / status left empty (= the site default, active),
// so the new ladder really comes after them. A row the app already wrote for this ladder keeps its mode, priority, status, source and created_at.
const d = $('Attach PDF Ladder').first().json; const L = d.ladder || {};
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error && Object.keys(r).length); } catch (e) { return []; } };
let stored = 0; try { stored = $('Save Ladder Rows').all().filter(i => i.json && !i.json.error && Object.keys(i.json).length).length; } catch (e) { stored = 0; }
const id = String(L.ladder_id || '');
if (!id || L.planned === false || !stored) return [{ json: { skip: true } }];
const lc = (v) => String(v == null ? '' : v).toLowerCase().trim();
const domain = reachDomain(L.domain || d.domain); const site_id = reachSiteId(domain);
const now = new Date().toISOString();
const settings = rowsOf('Load Domain Ladder Settings').filter(r => r.ladder_id && (r.site_id === site_id || reachDomain(r.domain) === domain));
const siteRow = settings.find(r => String(r.ladder_id) === '_site') || null;
const settingOf = new Map(settings.filter(r => String(r.ladder_id) !== '_site').map(r => [String(r.ladder_id), r]));
const prio = (r) => (r && Number(r.priority) >= 1) ? Number(r.priority) : null;
const row = (o) => ({ ladder_id: o.ladder_id, site_id, domain, head_keyword: o.head_keyword || '', mode: o.mode || '', priority: o.priority == null ? null : Number(o.priority), status: o.status || '',
  plan_type: o.plan_type || '', reach: o.reach == null || o.reach === '' ? null : Number(o.reach), source: o.source || '', opportunities: o.opportunities || '', auto_start: o.auto_start === true || lc(o.auto_start) === 'true',
  max_active: o.max_active == null || o.max_active === '' ? null : Number(o.max_active), max_waiting: o.max_waiting == null || o.max_waiting === '' ? null : Number(o.max_waiting), created_at: o.created_at || now, updated_at: now });
// the site's other ladders (from seo_ladders), oldest first
const starts = new Map();
for (const r of rowsOf('Load Domain Ladders')) { const lid = String(r.ladder_id || ''); if (!lid || lid === id || reachDomain(r.domain) !== domain) continue;
  const s = String(r.start_date || ''); if (!starts.has(lid) || (s && s < starts.get(lid).start)) starts.set(lid, { start: s, head: String(r.head_keyword || (Number(r.rung) === 4 ? r.keyword : '') || starts.get(lid)?.head || '') }); }
const existing = [...starts.entries()].map(([lid, x]) => ({ ladder_id: lid, start: x.start, head: x.head, st: settingOf.get(lid) || null }));
let top = Math.max(0, ...[...settingOf.values()].map(r => prio(r) || 0));   // every priority of the site, the app's own row for this ladder included
const out = [];
for (const e of existing.filter(e => !prio(e.st)).sort((a, b) => a.start.localeCompare(b.start) || a.ladder_id.localeCompare(b.ladder_id))) {
  top += 1;
  out.push(row(e.st ? { ...e.st, priority: top } : { ladder_id: e.ladder_id, head_keyword: e.head, mode: '', priority: top, status: '', plan_type: '', reach: null, source: 'system' }));
}
const own = settingOf.get(id) || null;
const siteMode = siteRow && ['auto', 'manual'].includes(lc(siteRow.mode)) ? lc(siteRow.mode) : 'auto';
out.push(row({ ladder_id: id, head_keyword: (L.head || {}).keyword || d.keyword || '', mode: own && ['auto', 'manual'].includes(lc(own.mode)) ? lc(own.mode) : siteMode,
  priority: prio(own) || top + 1, status: own && lc(own.status) ? lc(own.status) : 'active', plan_type: L.plan_type || '', reach: L.reach, source: own && own.source ? own.source : 'ladder',
  opportunities: own ? own.opportunities : '', auto_start: own ? own.auto_start : false, max_active: own ? own.max_active : null, max_waiting: own ? own.max_waiting : null, created_at: own && own.created_at ? own.created_at : now }));
return out.map(r => ({ json: r }));
