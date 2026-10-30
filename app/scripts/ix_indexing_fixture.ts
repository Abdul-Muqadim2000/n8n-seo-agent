// Index coverage browser pass (2026-10-29): writes the sample answer of GET …/data/indexing that ix_indexing_shots.mjs serves, built by the
// app's own rule (buildIndexingData) from sample engine rows. Sample data only (novaand-demo.com), no real customer.
//   npx tsx scripts/ix_indexing_fixture.ts <out.json> [rolling | fixwave | failed | final | reserve]
// fix wave 1: `fixwave` adds pages fixed on the site (fix_seen_at), pages to ask Google about (ask_google), a sitemap read only in part, a
// newest run that could not read Search Console (the figures from the run before) and an update rolling out; `failed` is a website whose
// every run so far could not read Search Console.
// final browser check (2026-10-30, fix waves 2 and 3): `final` adds pages Google still sees with the problem after a fix we saw
// (`fix_failed_at`), a step fixed on the site and waiting for Google, five pages to ask Google about (six marked), the sitemap step
// (Search Console reports errors in the sitemap), a newest run that could not check the website (`checked: false`, an internal error in
// its note), null positions in an update's impact and an update rolling out; it also writes, beside <out.json>, the Steps on your
// website (`-tasks.json`, through deriveSiteTasks), the Recommendations (`-recs.json`, through the server's indexingRecommendations) and
// two index_coverage reports (`-report.json`, `-report-failed.json`). `reserve`: the newest run is a reservation (a check not finished).
// wave 2 (2026-10-30, DESIGN_WAVE2 §3): `wave2` is devaicon.com's shape (anonymised): pages the home page already links to that Google has
// not visited (wait), pages that need a link (one step with pairs), the seven /industries/* pages whose canonical names /industries outside
// the sitemap, policy pages, pages to ask Google about (one asked and waiting, one read again and now in search), sitemap submission on with
// Full access and a submission Google read; `wave2-restricted`: the same with read-only access. Both also write `-tasks.json`,
// `-recs.json` and `-settings.json` (Tracking & monitors with the switch on).
// wave 2 review (W1 / W7): `wave2-will` (Search Console lists no sitemap, the engine says it will submit it), `wave2-blocked` (Full access,
// switch on, no sitemap listed, the engine will not submit: no readable sitemap), `wave2-refused` (Full access, but Google refused the last
// submission).
import { writeFileSync } from 'node:fs';
import { buildIndexingData, indexingCauseReadings, indexingLinksReading, indexingSitemapReading, indexSitemapState, indexRunOf, isSiteFixCause, type IndexPageRow, type IndexSiteFixCause } from '../shared/src/indexing';
import { deriveSiteTasks, type StoredSiteTask } from '../shared/src/site-tasks';
import type { Recommendation } from '../shared/src/data';
import { indexingRecommendations } from '../server/src/services/recommendations';

const D = 'novaand-demo.com';
const U = (p: string) => `https://www.${D}${p}`;
const day = (d: number) => new Date(Date.UTC(2026, 9, 29) - d * 864e5).toISOString();

if ((process.argv[3] ?? '').startsWith('wave2')) {
  const variant = (process.argv[3] ?? '').replace(/^wave2-?/, '');
  const restricted = variant === 'restricted';
  const now = new Date();
  const ago = (d: number) => new Date(now.getTime() - d * 864e5).toISOString();
  const R: Partial<IndexPageRow>[] = [];
  const put = (path: string, o: Partial<IndexPageRow>) => R.push({ site_id: 'site_novaand-demo-com', domain: D, url: U(path), lane: 'existing', state: 'not_indexed', in_sitemap: true, inspect_at: ago(1), ...o });
  for (const p of ['/', '/capabilities', '/capabilities/ai-strategy', '/capabilities/data-platforms', '/capabilities/open-edx-services', '/insights/data-sovereignty', '/contact', '/insights', '/industries'])
    put(p, { state: 'indexed', cause: 'indexed', action: 'none', impressions_28d: 60 });
  const home = JSON.stringify([U('/')]);
  for (const p of ['/whatwedo', '/about-devaicon', '/capabilities/cloud', '/capabilities/ml-ops', '/insights/agentic-ai', '/insights/rag-in-practice'])
    put(p, { cause: p.startsWith('/insights') ? 'discovered_not_crawled' : 'unknown_to_google', action: 'wait', linked_by: home, note: 'Already linked from your website (/) and listed in your sitemap. Google has not visited it yet, which is common for a young website.' });
  for (const p of ['/careers/frontend-engineer', '/careers/data-engineer']) put(p, { cause: 'unknown_to_google', action: 'wait', linked_by: JSON.stringify([U('/careers')]) });
  put('/capabilities/open-edx-services/hosting', { cause: 'unknown_to_google', action: 'links', impressions_28d: 3, link_from: JSON.stringify([{ url: U('/capabilities/open-edx-services'), title: 'Open edX services' }]) });
  put('/capabilities/open-edx-services/plugins', { cause: 'unknown_to_google', action: 'links', impressions_28d: 1, link_from: JSON.stringify([{ url: U('/capabilities/open-edx-services'), title: 'Open edX services' }]) });
  put('/insights/sovereign-cloud-checklist', { cause: 'discovered_not_crawled', action: 'links', link_from: JSON.stringify([{ url: U('/insights/data-sovereignty'), title: 'Data sovereignty' }]) });
  for (const slug of ['bfsi', 'hospitality', 'manufacturing', 'retail', 'public-sector', 'nonprofit', 'professional-services'])
    put(`/industries/${slug}`, { state: 'excluded', cause: 'canonical_elsewhere', action: 'site_fix', in_sitemap: false, page_canonical: U('/industries'), title: `${slug.replace(/-/g, ' ')} technology`, note: 'This page tells Google it is a copy of /industries, so Google shows that page instead. If this page should be found on its own, point its canonical tag to itself and add it to your sitemap.' });
  for (const p of ['/privacy', '/cookies', '/security']) put(p, { state: 'excluded', cause: 'low_value', action: 'leave_out', note: 'Policy and utility pages do not need to be in Google.' });
  put('/capabilities/engagement-models', { cause: 'crawled_not_indexed', action: 'quality', title: 'Engagement models | Nova&', coverage: 'Crawled - currently not indexed' });
  // pages to ask Google about: two marked, one of them asked two days ago; one asked last week that Google read again and put in search
  for (const r of R) if (r.url === U('/capabilities/cloud')) Object.assign(r, { ask_google: true, impressions_28d: 4 });
  for (const r of R) if (r.url === U('/capabilities/ml-ops')) Object.assign(r, { ask_google: true, asked_google_at: ago(2) });
  for (const r of R) if (r.url === U('/capabilities/data-platforms')) Object.assign(r, { asked_google_at: ago(9), google_read_after_ask_at: ago(6) });
  const sm = restricted
    ? { submitted: 1, submitted_errors: 0, read: 1, complete: true, checked: true, permission: 'siteRestrictedUser', submit: { on: true, gate: 'not_full_access', will_submit: false, blocked: 'not_full_access' } }
    : variant === 'will'
      ? { submitted: 0, submitted_errors: 0, read: 1, complete: true, checked: true, permission: 'siteFullUser', permission_full: true, submit: { on: true, gate: 'ok', will_submit: true, blocked: '' } }
      : variant === 'blocked'
        ? { submitted: 0, submitted_errors: 0, read: 0, complete: true, checked: true, permission: 'siteFullUser', permission_full: true, submit: { on: true, gate: 'ok', will_submit: false, blocked: 'no_sitemap' } }
        : variant === 'refused'
          ? { submitted: 0, submitted_errors: 0, read: 1, complete: true, checked: true, permission: 'siteFullUser', permission_full: true, submit: { on: true, gate: 'denied_before', will_submit: false, blocked: 'refused' }, submissions: [{ path: U('/sitemap.xml'), at: ago(4), status: 'denied', reason: 'not_listed', http_status: 403 }] }
          : { submitted: 1, submitted_errors: 0, read: 1, complete: true, checked: true, permission: 'siteFullUser', submit: { on: true, gate: 'ok', will_submit: false, blocked: 'unchanged' }, submissions: [{ path: U('/sitemap.xml'), at: ago(3), status: 'ok', reason: '' }], list: [{ path: U('/sitemap.xml'), lastSubmitted: ago(3), lastDownloaded: ago(2) }] };
  const runs = [{ run_at: ago(0.2), known: R.length, indexed: 9, inspected: R.length, by_cause_json: JSON.stringify({ unknown_to_google: 7, discovered_not_crawled: 3, canonical_elsewhere: 7, low_value: 3, crawled_not_indexed: 1 }), by_action_json: JSON.stringify({ wait: 8, links: 3, site_fix: 7, leave_out: 3, quality: 1 }), freeze: false, sitemaps_json: JSON.stringify(sm) }];
  const readCauses = [...new Set(R.map((r) => String(r.cause ?? '')).filter(isSiteFixCause))] as IndexSiteFixCause[];
  const submitOn = true;
  // wave 2 review W1: the step goes away only when the engine says it will submit (the server's rule, services/siteTasks.ts)
  const smState = indexSitemapState(runs.map(indexRunOf), submitOn);
  const auto = submitOn && smState.willSubmit;
  const sitemapBlocked = submitOn ? smState.blocked : '';
  const links = indexingLinksReading(R, { runAt: runs[0].run_at });
  // the links step was checked once by the client: one of the three links is in place
  const stored: StoredSiteTask[] = [];
  const first = deriveSiteTasks({ domain: D, indexnow: null, access: null, reclaim: null, indexing: { runAt: runs[0].run_at, causes: indexingCauseReadings(R, { read: readCauses }), sitemap: indexingSitemapReading(runs as never), links, sitemapAuto: auto, sitemapBlocked } }, []);
  const lt = first.find((t) => t.key === 'indexing:links');
  if (lt) stored.push({ key: lt.key, kind: 'index_links', payload: { pairs: lt.values.map((v, i) => ({ target: v.value, source: [U('/capabilities/open-edx-services'), U('/capabilities/open-edx-services'), U('/insights/data-sovereignty')][i], since: runs[0].run_at })), total: 3 }, lastCheck: { at: ago(0.1), ok: false, message: '1 of 3 links found. /capabilities/open-edx-services has no link to /capabilities/open-edx-services/plugins yet. /insights/data-sovereignty has no link to /insights/sovereign-cloud-checklist yet.', by: 'you', who: 'Sample Owner' }, doneAt: null, skippedAt: null, skippedBy: null, createdAt: ago(0.15) });
  const tasks = deriveSiteTasks({ domain: D, indexnow: null, access: null, reclaim: null, indexing: { runAt: runs[0].run_at, causes: indexingCauseReadings(R, { read: readCauses }), sitemap: indexingSitemapReading(runs as never), links, sitemapAuto: auto, sitemapBlocked } }, stored);
  const d = buildIndexingData({ taskKeys: new Set(tasks.map((t) => t.key)), rows: R, runs, events: [], impacts: [], settings: { on: true, dailyCap: 300 }, sitemapSubmit: submitOn });
  const out = process.argv[2];
  const base = out.replace(/\.json$/, '');
  writeFileSync(out, JSON.stringify(d));
  writeFileSync(`${base}-tasks.json`, JSON.stringify(tasks));
  const recs: Recommendation[] = [];
  indexingRecommendations({ on: true, runAt: d.checkedAt, freeze: { on: false, reason: '' }, siteFix: [], other: [], quality: [{ url: U('/capabilities/engagement-models'), title: 'Engagement models | Nova&', impressions28d: 0 }], askGoogle: d.askGoogle.filter((p) => !p.askedGoogleAt).map((p) => ({ url: p.url, title: p.title })) }, tasks, [], (r) => recs.push(r));
  writeFileSync(`${base}-recs.json`, JSON.stringify(recs));
  const monitors = { aiVisibility: true, aiEngines: ['chatgpt', 'perplexity', 'gemini'], aiPromptsMax: 20, aiPulse: true, aiPersonas: [], aiMarkets: [], aiPulseMode: 'auto', aiPulsePerWeek: 0, aiGrowth: true, aiPagesPerMonth: 2, backlinks: true, linkBuilder: true, auditMonthly: true, auditPages: 200, auditJs: false, brandNames: [], indexWatch: true, indexDailyCap: 300, indexSitemapSubmit: submitOn, competitors: [], updatedAt: ago(1) };
  writeFileSync(`${base}-settings.json`, JSON.stringify({ tracking: { tracked: true, status: 'active', gscProperty: `sc-domain:${D}`, ga4PropertyId: null, lastRunAt: ago(1), lastStatus: 'success', keywords: [], reportsToThisApp: true }, monitors, cadence: { pagesPerWeek: 1, status: 'active' }, profile: null, readiness: { ready: true, profileReady: true, factsReady: true, missing: [], missingText: '' }, contentGroups: [] }));
  console.log(`wrote ${out}: ${d.totals.known} pages, ${d.groups.length} groups, ${tasks.length} steps, ${recs.length} recommendations`);
  process.exit(0);
}
const rows: Partial<IndexPageRow>[] = [];
const add = (n: number, o: (i: number) => Partial<IndexPageRow>) => {
  for (let i = 0; i < n; i++) rows.push({ site_id: 'site_novaand-demo-com', domain: D, lane: 'existing', state: 'not_indexed', in_sitemap: true, inspect_at: day(1 + (i % 5)), ...o(i) });
};
add(38, (i) => ({ url: U(i ? `/services/item-${i}` : '/'), state: 'indexed', cause: 'indexed', action: 'none', impressions_28d: 400 - i * 9, evidence: i % 2 ? 'search' : 'inspection' }));
add(3, (i) => ({ url: U(['/pricing', '/contact', '/about/team'][i]), cause: 'noindex', action: 'site_fix', impressions_28d: [120, 40, 6][i], noindex: i === 0 ? 'header' : 'meta', http_status: 200, coverage: "Excluded by 'noindex' tag", note: 'This page tells Google to leave it out. Remove the noindex instruction.' }));
add(2, (i) => ({ url: U(['/old-offer', '/events/2025'][i]), cause: 'not_found', action: 'site_fix', http_status: 404, impressions_28d: [14, 3][i], dropped_at: i === 0 ? day(2) : '' }));
add(31, (i) => ({ url: U(`/blog/post-${i + 1}`), cause: 'crawled_not_indexed', action: 'quality', title: `Guide ${i + 1} to e-invoicing | Nova&`, coverage: 'Crawled - currently not indexed', words: 380 + i * 10, checks: i < 3 ? 4 : 1, needs_person: i < 3, last_crawl: day(9) }));
add(4, (i) => ({ url: U(`/guides/peppol-${i}`), cause: 'discovered_not_crawled', action: 'links', coverage: 'Discovered - currently not indexed', link_from: JSON.stringify([{ url: U('/'), title: 'Home' }, { url: U('/services/item-2'), title: 'E-invoicing services' }]) }));
add(2, (i) => ({ url: U(`/services/item-${i + 1}?ref=menu`), cause: 'google_chose_other', action: 'duplicate', google_canonical: U(`/services/item-${i + 1}`), merge_into: U(`/services/item-${i + 1}`) }));
add(6, (i) => ({ url: U(`/tag/topic-${i}`), state: 'excluded', cause: 'low_value', action: 'leave_out', in_sitemap: false }));
add(3, (i) => ({ url: U(`/blog/new-${i}`), lane: 'new', cause: 'wait_new', action: 'wait', published_at: day(i + 2), coverage: 'URL is unknown to Google' }));
add(2, (i) => ({ url: U(`/blog/fresh-${i}`), lane: 'new', state: 'indexed', cause: 'indexed', action: 'none', published_at: day(10 + i) }));
add(120, (i) => ({ url: U(`/resources/doc-${i}`), state: 'unknown', cause: '', action: '', inspect_at: '' }));

const mode = process.argv[3] ?? '';
const rolling = mode === 'rolling' || mode === 'fixwave' || mode === 'final';
if (mode === 'final') {
  // R1: Google read /pricing and /contact again after the fix we saw and still sees the noindex (the engine clears `fix_seen_at` then,
  // and such a page is never marked to ask Google about; the note is the engine's own sentence, _index_kit.js)
  for (const r of rows) if (r.cause === 'noindex' && (r.url === U('/pricing') || r.url === U('/contact'))) Object.assign(r, { fix_seen_at: '', fix_failed_at: day(1), inspect_at: day(1), note: `Google read this page again on ${day(1).slice(0, 10)}, after the change we saw on your site, and still sees the same problem.` });
  // N4: both not-found pages fixed on the site, Google has not read them again yet (their step is done, waiting for Google)
  for (const r of rows) if (r.cause === 'not_found') Object.assign(r, { action: 'wait', fix_seen_at: day(0), inspect_at: day(4), ask_google: r.url === U('/old-offer') });
  add(3, (i) => ({ url: U(`/blog/launch-${i}`), lane: 'new', cause: 'wait_new', action: 'wait', published_at: day(3 + i), ask_google: true, impressions_28d: 0 }));
  // a sixth page marked: the app shows five at most
  add(1, () => ({ url: U('/guides/peppol-basics'), cause: 'discovered_not_crawled', action: 'links', ask_google: true, impressions_28d: 0 }));
  add(1, () => ({ url: U('/legacy/odd'), cause: 'unclassified', action: 'review', coverage: 'Something new from Google' }));
  add(1, () => ({ url: U('/team/old-hire'), cause: 'redirect_error', action: 'site_fix', http_status: 0, coverage: 'Redirect error', impressions_28d: 2 }));
}
if (mode === 'fixwave') {
  add(2, (i) => ({ url: U(['/about', '/careers'][i]), cause: 'noindex', action: 'wait', inspect_at: day(9), fix_seen_at: day(0), ask_google: i === 0, note: 'Fixed on your site. Waiting for Google to read it again.' }));
  add(2, (i) => ({ url: U(`/blog/launch-${i}`), lane: 'new', cause: 'wait_new', action: 'wait', published_at: day(9 + i), ask_google: true }));
  add(1, () => ({ url: U('/legacy/odd'), cause: 'unclassified', action: 'none', coverage: 'Something new from Google' }));
  add(2, (i) => ({ url: U(`/resources/failed-${i}`), state: 'error', cause: 'not_checked', action: 'none' }));
}
const failedNote = 'Search Console refused access for this property, so pages were not checked.';
const runs = Array.from({ length: 6 }, (_, i) => ({
  run_at: day(i), known: rows.length, indexed: 40 - i, backlog_left: 120 + i * 300, inspected: 300, by_cause_json: '{}', freeze: rolling && i < 2, freeze_reason: rolling && i < 2 ? 'The October 2026 core update is rolling out.' : '',
  sitemaps_json: JSON.stringify({ submitted: 1, submitted_errors: 0, read: 3, capped: false, errors: mode === 'fixwave' ? [{ url: U('/sitemap-2.xml'), error: 'HTTP 500' }] : [] }),
}));
if (mode === 'final') {
  // the sitemap step: the newest run that read Search Console's list counts 2 errors in the submitted sitemap
  for (const r of runs) r.sitemaps_json = JSON.stringify({ submitted: 1, submitted_errors: 2, read: 3, capped: false, errors: [], complete: true, checked: true });
  // a run that could not check the website: its figures are the last check's (fix wave 1), an internal error in its note (R5)
  runs.unshift({ run_at: '2026-10-29T09:15:00.000Z', known: rows.length, indexed: 40, backlog_left: 120, inspected: 0, by_cause_json: '{}', freeze: true, freeze_reason: 'The October 2026 core update is rolling out.', note: 'diagnosis failed: TypeError x.y is undefined. The figures are from the last check.', sitemaps_json: JSON.stringify({ checked: false }) } as never);
}
if (mode === 'reserve') runs.unshift({ run_at: '2026-10-29T08:40:00.000Z', known: 0, indexed: 0, backlog_left: 0, inspected: 0, by_cause_json: '{}', freeze: false, freeze_reason: '', sitemaps_json: JSON.stringify({ reservation: true }) } as never);
if (mode === 'fixwave') runs.unshift({ run_at: '2026-10-29T09:15:00.000Z', known: 0, indexed: 0, backlog_left: 0, inspected: 0, by_cause_json: '{}', freeze: true, freeze_reason: 'The October 2026 core update is rolling out.', note: failedNote, sitemaps_json: '' } as never);
if (mode === 'failed') rows.length = 0;
// the steps first (a group links to its step only when one exists)
const goodRun = runs.find((r) => r.inspected) ?? runs[0];
const read = [...new Set(rows.map((r) => String(r.cause ?? '')).filter(isSiteFixCause))] as IndexSiteFixCause[];
const stored: StoredSiteTask[] = mode === 'final'
  ? [
      // a step stored earlier whose cause the newest reading lists nowhere any more (done by the daily index check)
      { key: 'indexing:robots_blocked', kind: 'indexing', payload: { cause: 'robots_blocked', urls: [U('/private/a')], total: 1 }, lastCheck: null, doneAt: null, skippedAt: null, skippedBy: null, createdAt: day(20) },
      { key: 'indexing:not_found', kind: 'indexing', payload: { cause: 'not_found', urls: [U('/old-offer'), U('/events/2025')], total: 2 }, lastCheck: null, doneAt: null, skippedAt: null, skippedBy: null, createdAt: day(12) },
    ]
  : [];
const tasks = deriveSiteTasks(
  { domain: D, indexnow: null, access: null, reclaim: null, indexing: { runAt: String(goodRun.run_at), causes: indexingCauseReadings(rows, { read }), sitemap: indexingSitemapReading(runs as never) } },
  stored,
);
const d = buildIndexingData({
  taskKeys: new Set(tasks.map((t) => t.key)),
  rows,
  runs: mode === 'failed' ? [{ run_at: day(0), known: 0, inspected: 0, note: failedNote }, { run_at: day(1), known: 0, inspected: 0, note: failedNote }] : runs,
  events: [
    ...(rolling ? [{ event_id: 'core-2026-10', source: 'status_dashboard', kind: 'core', title: 'October 2026 core update', started_at: day(6), status: 'rolling_out', url: 'https://status.search.google.com/' }] : []),
    { event_id: 'spam-2026-09', source: 'status_dashboard', kind: 'spam', title: 'September 2026 spam update', started_at: day(40), ended_at: day(33), status: 'complete', url: 'https://status.search.google.com/' },
    { event_id: 'core-2026-08', source: 'status_dashboard', kind: 'core', title: 'August 2026 core update', started_at: day(70), ended_at: day(55), status: 'complete', url: 'https://status.search.google.com/' },
  ],
  impacts: [
    { event_id: 'core-2026-08', event_title: 'August 2026 core update', compared_at: day(48), before_from: day(98), before_to: day(71), after_from: day(55), after_to: day(48), pages: 30, dropped: 2, stable: 25, gained: 3, pages_json: JSON.stringify([{ url: U('/blog/post-4'), before_clicks: 40, after_clicks: 9, before_pos: mode === 'final' ? null : 8.2, after_pos: mode === 'final' ? '' : 14.5, segment: 'dropped', state: 'not_indexed' }, { url: U('/blog/post-7'), before_clicks: 22, after_clicks: 11, before_pos: 6.1, after_pos: mode === 'final' ? null : 9.3, segment: 'dropped', state: 'indexed' }]), note: 'Only pages with at least 50 impressions before are compared.' },
  ],
  settings: { on: true, dailyCap: 300 },
});
writeFileSync(process.argv[2], JSON.stringify(d));
if (mode === 'final') {
  const base = process.argv[2].replace(/\.json$/, '');
  writeFileSync(`${base}-tasks.json`, JSON.stringify(tasks));
  const recs: Recommendation[] = [];
  const quality = d.groups.filter((g) => g.action === 'quality').flatMap((g) => g.pages);
  indexingRecommendations(
    {
      on: true,
      runAt: d.checkedAt,
      // the recommendations are shown after the update (no freeze) so the "Improve this page" item is seen too
      freeze: { on: false, reason: '' },
      siteFix: [],
      other: d.groups.filter((g) => g.action === 'links' || g.action === 'duplicate' || g.action === 'quality').filter((g) => g.cause !== 'other' && g.cause !== 'fixed_on_site').map((g) => ({ action: g.action as 'links', cause: g.cause as never, total: g.count })),
      quality: quality.slice(0, 3).map((p) => ({ url: p.url, title: p.title, impressions28d: p.impressions28d })),
      askGoogle: d.askGoogle.map((p) => ({ url: p.url, title: p.title })),
    },
    tasks,
    [],
    (r) => recs.push(r),
  );
  writeFileSync(`${base}-recs.json`, JSON.stringify(recs));
  const summary = {
    known: d.totals.known, indexed: d.totals.indexed, not_indexed: 44, excluded: 6, unknown: d.totals.unknown, backlog_left: d.totals.backlogLeft, new_pages: 8, new_indexed: 2,
    by_action: { site_fix: 4, quality: 31, duplicate: 2, links: 4, wait: 7, leave_out: 6 },
    by_cause: { noindex: 3, redirect_error: 1, crawled_not_indexed: 31, discovered_not_crawled: 4, google_chose_other: 2, unclassified: 1, low_value: 6, wait_new: 6 },
    dropped: [{ url: U('/old-offer'), at: day(2).slice(0, 10), cause: 'not_found' }, { url: U('/team/old-hire'), at: day(1).slice(0, 10), cause: 'redirect_error' }],
    freeze: true, freeze_reason: '',
    events: [
      { title: 'October 2026 core update', kind: 'core', status: 'rolling_out', started_at: day(6).slice(0, 10) },
      { title: 'Search Essentials spam policies', kind: 'policy_doc', status: 'changed', started_at: day(15).slice(0, 10) },
      { title: 'August 2026 core update', kind: 'core', status: 'complete', started_at: day(70).slice(0, 10), ended_at: day(55).slice(0, 10) },
    ],
    impact: { event_title: 'August 2026 core update', dropped: 2, stable: 25, gained: 3 },
  };
  const rep = (id: string, title: string, payload: Record<string, unknown>, status = 'complete') => ({
    id, runId: null, siteId: '00000000-0000-0000-0000-0000000000b2', siteDomain: D, stage: 'index_coverage', status, title, summary: {}, receivedAt: '2026-10-29T09:20:00.000Z', scheduled: true, files: [],
    payload: { stage: 'index_coverage', domain: D, ...payload },
  });
  writeFileSync(`${base}-report.json`, JSON.stringify(rep('00000000-0000-0000-0000-00000000c001', `Index coverage: ${D}`, { status: 'complete', summary, cost: { usd: 0 } })));
  writeFileSync(`${base}-report-failed.json`, JSON.stringify(rep('00000000-0000-0000-0000-00000000c002', `Index coverage: ${D}`, { status: 'complete', summary: { ...summary, failed: true, checked: false, note: 'diagnosis failed: TypeError x.y is undefined. The figures are from the last check.', figures_from: 'last_check', dropped: [], events: [] }, cost: { usd: 0 } })));
}
console.log(`wrote ${process.argv[2]}: ${d.totals.known} pages, ${d.groups.length} groups`);
