// AIR (P5): the seo_cache rows AI Rank Fetched kept for the websites in mode on - the Google results pages (the shared SERP cache, with
// the site id), this week's budget marker, the month's LLM Mentions marker, the Common Crawl reading - with exactly the table's
// columns, one row per key (the last wins). [{ skip: true }] when there is none, so its IF sends nothing.
const COLS = ["key", "kind", "site_id", "value", "updated_at"];
const rows = []; try { for (const i of $('AI Rank Fetched').all()) for (const r of (((i && i.json) || {}).cache_rows || [])) rows.push(Object.fromEntries(COLS.map(c => [c, r[c] === undefined ? null : r[c]]))); } catch (e) {}
const one = new Map(); for (const r of rows) if (r.key) one.set(r.key, r);
return one.size ? [...one.values()].map(r => ({ json: r })) : [{ json: { skip: true } }];