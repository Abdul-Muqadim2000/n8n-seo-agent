// Index coverage browser pass (2026-10-29): writes the sample answer of GET …/data/indexing that ix_indexing_shots.mjs serves, built by the
// app's own rule (buildIndexingData) from sample engine rows. Sample data only (novaand-demo.com), no real customer.
//   npx tsx scripts/ix_indexing_fixture.ts <out.json> [rolling]
import { writeFileSync } from 'node:fs';
import { buildIndexingData, type IndexPageRow } from '../shared/src/indexing';

const D = 'novaand-demo.com';
const U = (p: string) => `https://www.${D}${p}`;
const day = (d: number) => new Date(Date.UTC(2026, 9, 29) - d * 864e5).toISOString();
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

const rolling = process.argv[3] === 'rolling';
const d = buildIndexingData({
  rows,
  runs: Array.from({ length: 6 }, (_, i) => ({ run_at: day(i), known: rows.length, indexed: 40 - i, backlog_left: 120 + i * 300, inspected: 300, by_cause_json: '{}', freeze: rolling && i === 0, freeze_reason: rolling && i === 0 ? 'The October 2026 core update is rolling out.' : '' })),
  events: [
    ...(rolling ? [{ event_id: 'core-2026-10', source: 'status_dashboard', kind: 'core', title: 'October 2026 core update', started_at: day(6), status: 'rolling_out', url: 'https://status.search.google.com/' }] : []),
    { event_id: 'spam-2026-09', source: 'status_dashboard', kind: 'spam', title: 'September 2026 spam update', started_at: day(40), ended_at: day(33), status: 'complete', url: 'https://status.search.google.com/' },
    { event_id: 'core-2026-08', source: 'status_dashboard', kind: 'core', title: 'August 2026 core update', started_at: day(70), ended_at: day(55), status: 'complete', url: 'https://status.search.google.com/' },
  ],
  impacts: [
    { event_id: 'core-2026-08', event_title: 'August 2026 core update', compared_at: day(48), before_from: day(98), before_to: day(71), after_from: day(55), after_to: day(48), pages: 30, dropped: 2, stable: 25, gained: 3, pages_json: JSON.stringify([{ url: U('/blog/post-4'), before_clicks: 40, after_clicks: 9, state: 'dropped' }, { url: U('/blog/post-7'), before_clicks: 22, after_clicks: 11, state: 'dropped' }]), note: 'Only pages with at least 50 impressions before are compared.' },
  ],
  settings: { on: true, dailyCap: 300 },
});
writeFileSync(process.argv[2], JSON.stringify(d));
console.log(`wrote ${process.argv[2]}: ${d.totals.known} pages, ${d.groups.length} groups`);
