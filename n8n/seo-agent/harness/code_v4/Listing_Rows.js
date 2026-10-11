// The listings checklist (seo_listings, upsert by site + listing) (exact columns)
const COLS = ["site_id", "domain", "listing_id", "name", "category", "status", "profile_url", "rel", "competitors", "submit_url", "priority", "why", "checked_at", "submitted_at", "note"];
const rows = $('LB Rows').all().flatMap(i => i.json.listing_rows || []).map(r => Object.fromEntries(COLS.map(c => [c, r[c] === undefined ? null : r[c]])));
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true } }];