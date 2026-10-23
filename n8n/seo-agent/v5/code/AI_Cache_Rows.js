// The brand names AI uses for competitors, learned this run (seo_cache key ai_brands:<site>, upsert by key; exact columns).
// F1a (2026-10-23, PROD_STATE.md section 5): a learned name points to an ENTITY, not to whichever domain one answer showed. EDICOM -> edicomgroup.com
// and Edicom -> edicom.com were two "competitors"; Pagero and Thomson Reuters were two more. Before the row is saved every name is re-pointed
// to its entity's id (_ai_entities.js: subdomains, country / brand variants, one spelling per name, "formerly X" seen in this run's answers),
// and the names of businesses this run read as a PLATFORM or a SOURCE leave ai_brands (which every reader takes for a rival: AI Metrics'
// rival set, the fit gate's "other brand") for a second row, ai_entities:<site> = { id: { r: role, n: [names], d: [domains], k: times seen } },
// which the parser reads back so the next run resolves those names without calling them rivals.
/*__AI_ENTITIES__*/
const rows = $('AI Metrics').all().flatMap(i => i.json.cache_rows || []);
const plans = (() => { try { return $('AI Plan').all().map(i => i.json).filter(p => !p.nothing_to_do); } catch (e) { return []; } })();
let answers = []; try { answers = $('Apply Analysis').all().map(i => i.json).filter(r => r && r.site_id && r.entities_json); } catch (e) {}
let cache = []; try { cache = $('Load Cache (AI)').all().map(i => i.json); } catch (e) {}
const now = new Date().toISOString();
const out = [];
const sites = new Set([...rows.filter(r => /^ai_brands:/.test(String(r.key))).map(r => String(r.key).slice(10)), ...answers.map(r => r.site_id)]);
const made = new Map(), extra = [];
for (const site of sites) {
  const p = plans.find(x => x.site_id === site) || { site_id: site, domain: '', aliases: {}, competitors: [], configured_competitors: [] };
  const brandRow = rows.find(r => r.key === 'ai_brands:' + site);
  let aliases = {}; try { aliases = brandRow ? JSON.parse(brandRow.value || '{}') : { ...(p.aliases || {}) }; } catch (e) { aliases = { ...(p.aliases || {}) }; }
  const book = AIE.bookOf(cache, site);
  // this run's entities: roles counted per id, names and domains gathered
  const seen = new Map();
  for (const a of answers.filter(x => x.site_id === site)) for (const e of AIE.entitiesOf(a)) { if (!e || !e.id || e.role === 'self') continue;
    const k = String(e.id).toLowerCase(); const x = seen.get(k) || { id: e.id, roles: {}, names: new Set() }; x.roles[e.role] = (x.roles[e.role] || 0) + 1; if (e.name) x.names.add(String(e.name)); seen.set(k, x); }
  const roleOf = (id) => { const x = seen.get(String(id).toLowerCase()); if (x) return Object.entries(x.roles).sort((a, b) => b[1] - a[1])[0][0]; const b = book[id]; return b && b.r ? b.r : ''; };
  // every learned name -> the id of its entity, under the same rules the parser uses
  const D = AIE.dir({ ...p, aliases, run_id: 'cache_' + site }, book);
  const canon = (dom) => { const r = AIE.regD(dom); if (!r) return dom; const root = D.find('d:' + r); return D.idOfRoot.get(root) || r; };
  const brands = {}; const nextBook = { ...book };
  for (const [name, dom] of Object.entries(aliases)) { if (!name || !dom) continue; const id = /\./.test(String(dom)) ? canon(String(dom)) : String(dom); const role = roleOf(id);
    if (role && role !== 'competitor') { const b = nextBook[id] || { r: role, n: [], d: [] }; b.r = role; b.n = [...new Set([...(b.n || []), name])].slice(0, 12); if (/\./.test(id)) b.d = [...new Set([...(b.d || []), id])]; nextBook[id] = b; continue; }
    brands[name] = id; }
  for (const x of seen.values()) { const role = roleOf(x.id); if (!/\./.test(String(x.id))) continue; const b = nextBook[x.id] || { r: role, n: [], d: [] };
    b.r = role; b.n = [...new Set([...(b.n || []), ...[...x.names].filter(n => n && !/\./.test(n))])].slice(0, 12); b.d = [...new Set([...(b.d || []), String(x.id)])]; b.k = (Number(b.k) || 0) + 1; nextBook[x.id] = b; }
  const keys = Object.keys(nextBook).slice(-300); const trimmed = Object.fromEntries(keys.map(k => [k, nextBook[k]]));
  if (brandRow || JSON.stringify(brands) !== JSON.stringify(p.aliases || {})) made.set('ai_brands:' + site, { key: 'ai_brands:' + site, kind: 'ai', site_id: site, value: JSON.stringify(brands), updated_at: now });
  if (JSON.stringify(trimmed) !== JSON.stringify(book)) extra.push({ key: 'ai_entities:' + site, kind: 'ai', site_id: site, value: JSON.stringify(trimmed), updated_at: now });
}
// the rows in the order AI Metrics gave them (a learned-names row re-pointed in place), the new ones after
for (const r of rows) out.push(made.has(r.key) ? made.get(r.key) : r);
for (const [k, r] of made) if (!rows.some(x => x.key === k)) out.push(r);
out.push(...extra);
return out.length ? out.map(r => ({ json: r })) : [{ json: { skip: true } }];
