// Index coverage: one cause per page (DESIGN §4), its action class and the client's sentence, the history of every state change, drop-outs
// (indexed -> not indexed, on an inspection, never on missing impressions), "needs a person" after 4 unchanged re-checks, internal-link
// suggestions for pages Google has not found or crawled, and the run's figures. Readings, in order of trust: today's inspection, a Site
// Tracker inspection of the last 3 days (reused), impressions in the last 28 days of data, the stored reading. A failed inspection is "not
// checked": a page with an earlier reading keeps it (and is tried again tomorrow), a page with none is `error / not_checked` - never "not indexed".
// One item per website; a website that fails here is reported with the reason and the others go on.
/*__PAGE_WATCH__*/
/*__INDEX_KIT__*/
const S = (v) => String(v == null ? '' : v).trim();
const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const now = Date.now(); const nowIso = new Date(now).toISOString();
const TZ = '__ENGINE_TZ__';
const grab = (n) => { try { return $(n).all().map(i => i.json); } catch (e) { return []; } };
const inv = grab('Index Inventory').filter(x => x && x.site_id);
const g = grab('Google Events')[0] || {};
const fr = g.freeze || { freeze: false };
const probeReqs = grab('Index Probe Requests').filter(q => q && !q.skip);
const reqs = probeReqs.concat(grab('Index Inspect Requests').filter(q => q && !q.skip));
const res = grab('Inspect URL (Probe)').slice(0, probeReqs.length).concat(grab('Inspect URL (Index)'));
const fresh = new Map(); reqs.forEach((q, i) => fresh.set(q.site_id + '|' + IX.key(q.inspect_url), IX.readInspection(res[i] || {})));
const fq = grab('Page Fetch Requests').filter(q => q && !q.skip); const f1 = grab('Fetch Page (Index)');
const hq = grab('Fetch Hop Requests').filter(q => q && !q.skip); const f2 = grab('Fetch Page (Final)');
const finals = new Map(); hq.forEach((q, i) => finals.set(q.first_index, f2[i] || {}));
const fetches = new Map(); fq.forEach((q, i) => fetches.set(q.site_id + '|' + IX.key(q.url), IX.readFetch(q.url, f1[i] || {}, finals.get(i) || null)));
const dow = (() => { try { return new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(new Date(now)); } catch (e) { return new Date(now).toUTCString().slice(0, 3); } })();
const news = { started: g.started || [], completed: g.completed || [], policy: g.policy_news || null };
const out = [];
for (const v of inv) {
  const s = v.site || {}; const base = { site_id: v.site_id, domain: v.domain, callback_url: S(s.callback_url), request_id: S(s.request_id), on_demand: !!s.on_demand, cap: n0(s.cap) };
  if (v.no_access || v.failed) {
    out.push({ json: { ...base, upserts: [], history: [], all: [], dropped: [], counts: { inspected: 0, reused: 0, fetched: 0, errors: 0 }, failed: true,
      why: S(v.why) || 'not checked', plan: {}, freeze: fr } });
    continue;
  }
  try {
    const ctx = { now, watch_since: v.watch_since, freeze: fr, sitemap_read: (v.sitemap || {}).read > 0, has_sitemap: (v.sitemap || {}).urls > 0 };
    const rows = []; const dropped = []; const c = { inspected: 0, reused: 0, fetched: 0, errors: 0, quota: false, access: false };
    for (const p of (v.pages || [])) {
      const k = IX.key(p.url); const prev = p._prev || null; const prevState = S(prev && prev.state);
      const fi = fresh.get(v.site_id + '|' + k) || null; const reuse = !fi && p._reuse ? p._reuse : null; const f = fetches.get(v.site_id + '|' + k) || null;
      const row = { ...p };
      if (fi) { c.inspected++; if (!fi.ok) { c.errors++; if (fi.error_kind === 'quota') c.quota = true; if (fi.error_kind === 'access') c.access = true; } }
      if (reuse) c.reused++;
      if (f) c.fetched++;
      const reading = (fi && fi.ok) ? fi : reuse;
      if (reading) {
        Object.assign(row, { verdict: S(reading.verdict), coverage: S(reading.coverage), google_canonical: S(reading.google_canonical), last_crawl: S(reading.last_crawl),
          inspect_at: fi ? nowIso : S(reading.at), evidence: fi ? 'inspection' : 'site_tracker' });
        if (fi) Object.assign(row, { indexing_state: S(fi.indexing_state), robots_state: S(fi.robots), page_fetch_state: S(fi.page_fetch_state), crawled_as: S(fi.crawled_as),
          user_canonical: S(fi.user_canonical), referring_count: n0(fi.referring_count), google_sitemaps: n0(fi.google_sitemaps) });
      }
      if (f) Object.assign(row, { fetch_at: nowIso, ...(f.ok ? { http_status: f.http_status, final_url: f.final_url, noindex: f.noindex, page_canonical: f.page_canonical, words: f.words,
        title: S(f.title) || S(row.title) } : {}) });
      let d = null;
      if (fi && !fi.ok) {
        if (prevState && !/^(unknown|error)$/.test(prevState)) { row.next_check_at = new Date(now + IX.DAY).toISOString(); row._why = S(fi.not_checked); }
        else d = { state: 'error', cause: 'not_checked', action: 'none', merge_into: '' };
        if (d) row._why = S(fi.not_checked);
      } else if (reading || (f && f.ok)) {
        const basis = reading || IX.storedReading(prev);
        if (!(row._evidence_search && !reading)) d = IX.diagnose(row, basis, f && f.ok ? f : null, ctx);
      }
      if (d) {
        Object.assign(row, { state: d.state, cause: d.cause, action: d.action, merge_into: S(d.merge_into), host_only: !!d.host_only });
        if (reading) row.checks = (prev && S(prev.cause) === d.cause && S(prev.inspect_at)) ? n0(prev.checks) + 1 : 1;
        if (row.state === 'indexed') row.indexed_since = prevState === 'indexed' ? (S(prev.indexed_since) || nowIso) : nowIso; else row.indexed_since = '';
        if (prevState === 'indexed' && (row.state === 'not_indexed' || row.state === 'excluded') && reading) { row.dropped_at = nowIso; dropped.push({ url: row.url, at: nowIso, cause: row.cause }); }
        row.next_check_at = IX.nextCheck(row, ctx);
      } else if (!S(row.action)) row.action = 'none';
      row.needs_person = ['site_fix', 'links', 'quality', 'duplicate'].includes(S(row.action)) && n0(row.checks) > IX.CFG.person_after;
      rows.push(row);
    }
    // internal links for the pages Google has not found or crawled: existing indexed pages on the same topic
    for (const r of rows) r.link_from = r.action === 'links' ? JSON.stringify(IX.linkSuggestions(r, rows)) : '';
    for (const r of rows) { if (r.state === 'indexed' && !S(r.cause)) r.action = 'none'; r.note = IX.noteOf(r, { freeze: fr }); r.updated_at = nowIso; }
    const upserts = [], history = [];
    for (const r of rows) {
      const o = IX.rowOut(r);
      if (IX.changed(r._prev, o)) upserts.push(o);
      const pr = r._prev;
      if ((!pr && o.state !== 'unknown') || (pr && (S(pr.state) !== o.state || S(pr.cause) !== o.cause)))
        history.push({ site_id: o.site_id, url: o.url, at: nowIso, state: o.state, cause: o.cause, evidence: o.evidence, verdict: o.verdict, coverage: o.coverage });
    }
    const all = rows.map(r => ({ url: r.url, state: S(r.state), cause: S(r.cause), action: S(r.action), lane: S(r.lane), needs_person: !!r.needs_person, note: S(r.note),
      merge_into: S(r.merge_into), final_url: S(r.final_url), http_status: n0(r.http_status) }));
    out.push({ json: { ...base, upserts, history, all, dropped: dropped.slice(0, IX.CFG.dropped_max), counts: c, plan: v.plan || {}, freeze: fr, sitemap: v.sitemap || {}, gsc_sitemaps: v.gsc_sitemaps,
      search: v.search || {}, quota_stop: !!v.quota_stop || c.quota, access_lost: c.access, capped: !!v.capped, failed: false } });
  } catch (e) {
    out.push({ json: { ...base, upserts: [], history: [], all: [], dropped: [], counts: { inspected: 0, reused: 0, fetched: 0, errors: 0 }, failed: true,
      why: 'diagnosis failed: ' + S(e && e.message).slice(0, 160), plan: {}, freeze: fr } });
  }
}
const monday = dow === 'Mon';
return out.length ? out.map(o => ({ json: { ...o.json, monday, news_today: news.started.length + news.completed.length + (news.policy ? 1 : 0) } })) : [{ json: { skip: true, reason: 'no website' } }];
