// G25 (2026-10-13): what Google said about each key page, stored on the page's own seo_page_watch row (exact table columns — the Data Table
// node auto-maps every field it is given). The row is what makes the rotation possible: the next weekly run inspects the pages with the
// oldest `inspect_at` first, so every key page is seen within Google's 2,000-a-day quota instead of the same 20 every week.
// A page the budget did not reach is not written at all (its stored inspection stays as it was, with its own date); a failed inspection
// keeps the last answer and records why today's attempt did not happen.
/*__PAGE_WATCH__*/
const insp = (() => { try { return $('Parse Inspection').all().map(i => i.json).filter(x => x && !x.skip && !x.skipped && x.url); } catch (e) { return []; } })();
const sites = $('Resolve Properties').all().map(i => i.json);
const stored = (() => { try { return $('Load Page Watch (Site)').all().map(i => i.json).filter(r => r && r.site_id && r.url); } catch (e) { return []; } })();
const S = (v) => String(v == null ? '' : v).trim();
const ukey = PW.helpers.ukey;
const rows = insp.map(x => {
  const s = sites[x.site_idx] || {};
  const prev = stored.find(r => r.site_id === x.site_id && ukey(r.url) === ukey(x.url)) || {};
  const failed = !!x.inspect_error;
  return {
    site_id: S(x.site_id) || S(s.site_id), domain: S(s.domain), url: S(x.url).slice(0, 500), kind: S(x.kind) || S(prev.kind) || 'page',
    weight: Number(prev.weight) || 0, checked_at: S(prev.checked_at), status: Number(prev.status) || 0, location: S(prev.location),
    noindex: prev.noindex === true, noindex_source: S(prev.noindex_source), canonical: S(prev.canonical), canonical_ok: prev.canonical_ok === true,
    title: S(prev.title), title_hash: S(prev.title_hash), titles: Number(prev.titles) || 0, description: S(prev.description), h1: S(prev.h1), h1s: Number(prev.h1s) || 0,
    robots_blocked: prev.robots_blocked === true, robots_hash: S(prev.robots_hash), state: S(prev.state), changes: S(prev.changes),
    last_change_at: S(prev.last_change_at), changed_count: Number(prev.changed_count) || 0, error: S(prev.error),
    // what Google said (or why we could not ask)
    inspect_at: failed ? S(prev.inspect_at) : S(x.checked_at),
    index_state: failed ? S(prev.index_state) : S(x.verdict),
    indexed: failed ? S(prev.indexed) : (x.indexed === true ? 'yes' : x.indexed === false ? 'no' : ''),
    coverage: failed ? S(prev.coverage) : S(x.coverage),
    google_canonical: failed ? S(prev.google_canonical) : S(x.google_canonical),
    last_crawl: failed ? S(prev.last_crawl) : S(x.last_crawl),
    mobile: failed ? S(prev.mobile) : (x.mobile_usable === true ? 'pass' : x.mobile_usable === false ? 'fail' : ''),
    rich_results: failed ? S(prev.rich_results) : (x.rich_results || []).join(', ').slice(0, 300),
    inspect_error: failed ? S(x.not_checked || x.inspect_error).slice(0, 300) : '',
  };
}).filter(r => r.site_id && r.url);
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true, reason: 'no inspection to store' } }];
