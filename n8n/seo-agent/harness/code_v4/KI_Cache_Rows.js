// KI Cache Rows (E2, DESIGN.md §7): the answers this run paid for, kept for their lifetime (seo_cache kind `ki`, key ki:<site>:<what>:..., one
// row per site so a company only reads its own), and the results pages it read (serp:<keyword>|<location>|<language>|<device>, the shared day
// cache every path reads). Exactly the seo_cache columns; the last row of a key wins. A failed read is never stored.
const p = $('KI Plan').first().json || {};
let r = {}; try { r = $(p.kind === 'keyword_research' ? 'Research Result' : 'Comp Result').first().json || {}; } catch (e) { r = {}; }
const COLS = ['key', 'kind', 'site_id', 'value', 'updated_at'];
const by = new Map();
for (const row of [...(r.cache_rows || []), ...(r.serp_cache_rows || [])]) if (row && row.key) { const o = {}; for (const c of COLS) o[c] = row[c] == null ? '' : String(row[c]); by.set(o.key, o); }
const rows = [...by.values()];
return rows.length ? rows.map(j => ({ json: j })) : [{ json: { skip: true, reason: 'nothing new to keep: every answer came from the cache' } }];
