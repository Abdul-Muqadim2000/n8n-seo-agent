// Build section 194 (client report 2026-11-17, devaicon.com F10): our stored rows follow a page that moved permanently. Watch Compare
// confirmed today's moves (a 301 / 308 seen on two reads to a working page of the same site, never the home page: MV.confirm); this node
// turns them into the row updates of the four tables that name a page by its address: the ladder rung (seo_ladders.target_url, published
// rows only), the content log (seo_content_log.published_url), the AI question it answers (seo_ai_targets.page_url) and its AI readiness row
// (seo_ai_pages: the old row is renamed, or dropped when the new address already has its own). A ladder or content-log row never follows onto
// an address that is already the page of ANOTHER search (one search, one page): it is refused and listed with the reason. A move of the host
// only (bare -> www) changes no row: every address is compared without the host's www already. Free, no fetch.
/*__MOVES__*/
const sites = $('Watch Compare').all().map(i => i.json).filter(s => s && !s.skip);
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const S = (v) => String(v == null ? '' : v).trim();
const ladders = rowsOf('Load Ladders (Watch)').filter(r => r.ladder_id);
const logs = rowsOf('Load Content Log (Watch)').filter(r => r.keyword);
const targets = rowsOf('Load AI Targets (Watch)').filter(r => r.target_id);
const aiPages = rowsOf('Load AI Pages (Watch)').filter(r => r.url);
const out = { ladders: [], logs: [], targets: [], ai_pages_update: [], ai_pages_delete: [], refused: [], sites: [] };
for (const s of sites) {
  const moves = (s.moves_today || []).filter(m => S(m.from) && S(m.to) && MV.helpers.ukey(m.from) !== MV.helpers.ukey(m.to));
  if (!moves.length) continue;
  const p = MV.plan(moves, { ladders, logs, targets, aiPages }, { domain: s.domain, site_id: s.site_id });
  for (const k of ['ladders', 'logs', 'targets', 'ai_pages_update', 'ai_pages_delete', 'refused']) out[k].push(...p[k]);
  out.sites.push({ site_id: s.site_id, domain: s.domain, moves: moves.length, rows: p.ladders.length + p.logs.length + p.targets.length + p.ai_pages_update.length + p.ai_pages_delete.length, refused: p.refused.length });
}
const total = out.ladders.length + out.logs.length + out.targets.length + out.ai_pages_update.length + out.ai_pages_delete.length;
return [{ json: { ...out, total, skip: total === 0, reason: total ? '' : (out.refused.length ? 'every move was refused: ' + out.refused.map(r => r.key + ' (' + r.reason + ')').join('; ').slice(0, 300) : 'no page moved today') } }];
