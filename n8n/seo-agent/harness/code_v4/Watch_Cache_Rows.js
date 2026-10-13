// G11 (2026-10-13): the site's watch fingerprint in seo_cache (`watch:<site_id>`, kind `watch`) — the robots.txt hash the next day compares
// against, when the watch last ran and what it saw. It sits beside the sitemap fingerprints the audit scheduler uses (v4.6).
// A run that could not read robots.txt keeps the stored hash: a skipped read must never overwrite a fingerprint (otherwise the next day
// would report a change that never happened, or miss one that did).
const sites = $('Watch Compare').all().map(i => i.json).filter(s => s && !s.skip);
const S = (v) => String(v == null ? '' : v).trim();
const rows = sites.map(s => {
  const r = s.robots || {};
  const hash = r.ok && S(r.hash) ? S(r.hash) : S(r.prev_hash);
  return { key: 'watch:' + s.site_id, kind: 'watch', site_id: s.site_id, updated_at: s.checked_at, value: JSON.stringify({
    checked_at: s.checked_at, domain: s.domain, robots_hash: hash, robots_status: Number(r.status) || 0, robots_read: r.ok !== false,
    pages_watched: s.summary.pages_watched, pages_checked: s.summary.pages_checked, pages_not_checked: s.summary.pages_not_checked,
    changed: s.summary.changed, worst: s.summary.worst, rechecks: s.summary.rechecks,
  }).slice(0, 4000) };
});
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true, reason: 'no site was watched' } }];
