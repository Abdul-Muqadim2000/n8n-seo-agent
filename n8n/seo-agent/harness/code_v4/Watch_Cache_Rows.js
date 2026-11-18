// G11 (2026-10-13): the site's watch fingerprint in seo_cache (`watch:<site_id>`, kind `watch`) — the robots.txt hash the next day compares
// against, when the watch last ran and what it saw. It sits beside the sitemap fingerprints the audit scheduler uses (v4.6).
// A run that could not read robots.txt keeps the stored hash: a skipped read must never overwrite a fingerprint (otherwise the next day
// would report a change that never happened, or miss one that did).
// Build section 194 (client report 2026-11-17, F5): robots.txt is stored as a state the next day reads: its state (ok / missing / unreachable /
// a web page), and the LAST GOOD file - its fingerprint (of the parsed rules, `robots_v` 2), its rules as text and as one line per rule, and
// when it was last seen - so "missing" can say which rules stopped applying and "back" can say whether the rules are the same. A missing file
// keeps the last good copy; a file nobody could read changes nothing at all.
const sites = $('Watch Compare').all().map(i => i.json).filter(s => s && !s.skip);
const S = (v) => String(v == null ? '' : v).trim();
const rows = sites.map(s => {
  const r = s.robots || {};
  const P = s.robots_prev || {};
  const read = r.ok !== false && S(r.state) !== 'unresolved' && S(r.state) !== 'not_read';
  const good = read && S(r.state) === 'ok';
  const legacyHash = S(r.prev_hash);
  const facts = (good ? (r.facts || []) : (Array.isArray(P.facts) ? P.facts : [])).reduce((a, f) => (a.join('|').length + String(f).length < 1500 ? a.concat([String(f)]) : a), []);
  const v = {
    checked_at: s.checked_at, domain: s.domain,
    robots_v: good ? 2 : (Number(P.v) || (read ? 2 : 0)),
    robots_state: read ? S(r.state) : S(P.state),
    robots_status: read ? (Number(r.status) || 0) : (Number(P.status) || 0),
    robots_hash: good ? S(r.hash) : (S(P.hash) || legacyHash),
    robots_text: (good ? S(r.text) : S(P.text)).slice(0, 1500),
    robots_facts: facts,
    robots_last_good_hash: good ? S(r.hash) : S(P.last_good_hash),
    robots_last_good_at: good ? s.checked_at : S(P.last_good_at),
    robots_bad_runs: !read ? (Number(P.bad_runs) || 0) : S(r.state) === 'unreachable' ? (S(P.state) === 'unreachable' ? (Number(P.bad_runs) || 0) + 1 : 1) : 0,
    robots_read: read,
    pages_watched: s.summary.pages_watched, pages_checked: s.summary.pages_checked, pages_not_checked: s.summary.pages_not_checked,
    changed: s.summary.changed, worst: s.summary.worst, rechecks: s.summary.rechecks, moved: s.summary.moved || 0,
  };
  let value = JSON.stringify(v);
  if (value.length > 4000) value = JSON.stringify({ ...v, robots_text: '', robots_facts: [] });   // never a cut JSON: the rules text goes first
  return { key: 'watch:' + s.site_id, kind: 'watch', site_id: s.site_id, updated_at: s.checked_at, value };
});
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true, reason: 'no site was watched' } }];
