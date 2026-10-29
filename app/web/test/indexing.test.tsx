import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { buildIndexingData, INDEX_CAUSE_INFO, type IndexPageRow } from '@seo/shared';
import { GuideProvider } from '@/components/guide';
import { TooltipProvider } from '@/components/ui/overlay';
import { ThemeProvider } from '@/lib/theme';
import { Indexing } from '@/pages/site/IndexingPage';
import { SITE_NAV } from '@/components/layout/OrgLayout';
import { renderReport, report, text } from './renderReport';

// The Indexing page (Index coverage, 2026-10-29) renders from one answer: could not read, before the first check, switched off, and with
// data (groups with what it means / what we do / what you do, the step link, "Improve this page" only when allowed, drop-outs, Google
// updates, the settings card); and the index_coverage report. Client text anonymised (novaand-demo.com).

const wrap = (node: ReactNode) =>
  renderToString(
    <ThemeProvider>
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <GuideProvider>
            <MemoryRouter>{node}</MemoryRouter>
          </GuideProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );

const D = 'novaand-demo.com';
const U = (p: string) => `https://${D}${p}`;
const rows: Partial<IndexPageRow>[] = [
  { url: U('/'), lane: 'existing', state: 'indexed', cause: 'indexed', action: 'none', impressions_28d: 80 },
  { url: U('/services'), lane: 'existing', state: 'not_indexed', cause: 'noindex', action: 'site_fix', impressions_28d: 30, inspect_at: '2026-10-28T06:00:00Z', in_sitemap: true },
  { url: U('/blog/peppol'), lane: 'existing', state: 'not_indexed', cause: 'crawled_not_indexed', action: 'quality', title: 'Peppol in the UAE | Nova&' },
  { url: U('/guide'), lane: 'new', state: 'not_indexed', cause: 'unknown_to_google', action: 'links', link_from: JSON.stringify([{ url: U('/'), title: 'Home' }]) },
  { url: U('/old'), lane: 'existing', state: 'not_indexed', cause: 'not_found', action: 'site_fix', dropped_at: '2026-10-27T00:00:00Z' },
  { url: U('/tag/x'), lane: 'existing', state: 'excluded', cause: 'low_value', action: 'leave_out' },
  { url: U('/later'), lane: 'existing', state: 'unknown' },
];
const settings = { on: true, dailyCap: 300 };
const INDEX_UNCLASSIFIED_LABEL = INDEX_CAUSE_INFO.unclassified.label;
const data = (o: { rolling?: boolean } = {}) =>
  buildIndexingData({
    rows,
    runs: [{ run_at: '2026-10-28T07:00:00Z', backlog_left: 1, inspected: 6, known: 7, freeze: !!o.rolling }],
    events: [o.rolling ? { event_id: 'c1', kind: 'core', status: 'rolling_out', title: 'October 2026 core update', started_at: '2026-10-20' } : { event_id: 'c0', kind: 'core', status: 'complete', title: 'August 2026 core update', started_at: '2026-08-20', ended_at: '2026-09-05', url: 'https://status.search.google.com/x' }],
    impacts: [{ event_id: 'c0', event_title: 'August 2026 core update', compared_at: '2026-09-12', dropped: 1, stable: 3, gained: 1, pages_json: JSON.stringify([{ url: U('/old'), before_clicks: 10, after_clicks: 1, state: 'dropped' }]) }],
    settings,
  });
const props = { orgId: 'org-1', siteId: 'site-1', domain: D };

describe('Indexing page', () => {
  it('with data: hero, lanes, a group with its three sentences and its step, drop-outs, updates, settings', () => {
    const html = wrap(<Indexing d={data()} {...props} member />);
    const t = text(html);
    expect(t).toContain('Google has 1 of the 5 pages we checked that should be in search (1 not checked yet)');
    expect(t).toContain('Existing pages checked: 5 of 6, about 1 day to check the rest at 300 a day');
    for (const s of ['New pages', 'Existing pages', 'Your page tells Google to leave it out', 'What it means', 'What we do', 'What you do', 'Open the step', '/services', 'Dropped out of Google search', '/old', 'Google updates', 'August 2026 core update', 'lost ground', 'Pages checked with Google a day', '300']) expect(t).toContain(s);
    expect(t).toContain('Improve this page');
    expect(html).toContain('/o/org-1/sites/site-1/pipeline#site-tasks');
    // "Improve this page" opens the Write-a-page form with the page's address (the click is the approval)
    const m = html.match(/\/o\/org-1\/tools\/keyword\?site=site-1&amp;prefill=([^"&]+)/);
    expect(m).toBeTruthy();
    expect(JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m![1])))))).toEqual({ keyword: 'Peppol in the UAE', existingPageUrl: U('/blog/peppol') });
    expect(t).not.toContain('NaN');
    expect(t).not.toContain('undefined');
    expect(t).not.toMatch(/[–—…]|get indexed|guarantee/i);
  });
  it('while a Google update rolls out: the banner, and no "Improve this page"', () => {
    const t = text(wrap(<Indexing d={data({ rolling: true })} {...props} member />));
    expect(t).toContain('October 2026 core update is rolling out');
    expect(t).not.toContain('Improve this page');
  });
  it('a viewer sees everything but no "Improve this page"', () => {
    expect(text(wrap(<Indexing d={data()} {...props} member={false} />))).not.toContain('Improve this page');
  });
  it('could not read, before the first check, and switched off', () => {
    expect(text(wrap(<Indexing d={{ status: 'unreadable', error: 'We could not read your index check just now.' }} {...props} member />))).toContain('We could not read your index check');
    const empty = buildIndexingData({ rows: [], runs: [], events: [], impacts: [], settings });
    expect(text(wrap(<Indexing d={empty} {...props} member />))).toContain('Your first index check is on its way');
    expect(text(wrap(<Indexing d={{ ...empty, settings: { on: false, dailyCap: 300 } }} {...props} member />))).toContain('The daily index check is off');
  });
  it('sits next to Technical health in the menu', () => {
    const i = SITE_NAV.findIndex((x) => x.to === 'technical');
    expect(SITE_NAV[i + 1]).toMatchObject({ to: 'indexing', label: 'Indexing' });
  });
});

describe('index_coverage report', () => {
  it('renders the summary, the drop-outs and the update', () => {
    const t = text(
      renderReport(
        report('index_coverage', {
          status: 'complete',
          summary: { known: 40, indexed: 31, not_indexed: 6, backlog_left: 3, new_pages: 2, new_indexed: 1, by_action: { site_fix: 2, quality: 1, links: 1 }, by_cause: { noindex: 2, crawled_not_indexed: 1 }, dropped: [{ url: U('/pricing'), at: '2026-10-28', cause: 'noindex' }], freeze: true, freeze_reason: '', events: [{ title: 'October 2026 core update', kind: 'core', status: 'rolling_out', started_at: '2026-10-20' }], impact: {} },
          report_markdown: '# Index coverage\nGoogle has 31 of 40 pages.',
          cost: { usd: 0 },
        }),
      ),
    );
    for (const s of ['Google has 31 of the 37 pages we checked that should be in search (3 not checked yet)', '4 pages need you', '1 dropped out', '/pricing', 'Your page tells Google to leave it out', 'October 2026 core update is rolling out', 'The report as text']) expect(t).toContain(s);
    expect(t).not.toContain('NaN');
  });
});

// ---------------------------------------------------------------- fix wave 1 (REVIEW_APP.md)
describe('Indexing page, fix wave 1', () => {
  const run = { run_at: '2026-10-29T09:00:00Z', known: 3, inspected: 3 };
  it('A3: pages that could not be checked, or were left out for a reason Google does not explain, are never under "In search"', () => {
    const d = buildIndexingData({ rows: [{ url: U('/'), state: 'indexed', action: 'none' }, { url: U('/a'), state: 'error', cause: 'not_checked', action: 'none' }, { url: U('/b'), state: 'not_indexed', cause: 'unclassified', action: 'none' }], runs: [run], events: [], impacts: [], settings });
    const t = text(wrap(<Indexing d={d} {...props} member />));
    const i = t.indexOf('Could not be checked');
    expect(i).toBeGreaterThan(-1);
    expect(t.slice(i, i + 60)).not.toContain('In search');
    expect(t).toContain('Could not check, we try again');
    expect(t).toContain('Check in Search Console');
  });
  it('A4: a run that could not read Search Console shows its note, never "No page needs you"', () => {
    const d = buildIndexingData({ rows: [], runs: [{ run_at: '2026-10-29T09:00:00Z', note: 'Search Console refused access for this property, so pages were not checked.' }], events: [], impacts: [], settings });
    const t = text(wrap(<Indexing d={d} {...props} member />));
    expect(t).toContain('refused access');
    expect(t).not.toContain('No page needs you right now');
    const withPages = buildIndexingData({ rows, runs: [{ run_at: '2026-10-29T09:00:00Z', note: 'Search Console refused access for this property, so pages were not checked.' }, { run_at: '2026-10-28T07:00:00Z', known: 7, inspected: 6 }], events: [], impacts: [], settings });
    const t2 = text(wrap(<Indexing d={withPages} {...props} member />));
    expect(t2).toContain('Our last check could not read Search Console');
    expect(t2).toContain('Our last check could not read Search Console, so these figures are from the check of');
  });
  it('fix seen on the site, pages to ask Google about, and a sitemap read only in part', () => {
    const d = buildIndexingData({
      rows: [
        { url: U('/fixed'), state: 'not_indexed', cause: 'noindex', action: 'wait', inspect_at: '2026-10-20T06:00:00Z', fix_seen_at: '2026-10-29T06:00:00Z', ask_google: true },
        { url: U('/new'), lane: 'new', state: 'not_indexed', cause: 'wait_new', action: 'wait', ask_google: true },
      ],
      runs: [{ ...run, sitemaps_json: JSON.stringify({ submitted: 1, read: 3, capped: false, errors: [{ url: U('/s2.xml'), error: '500' }] }) }],
      events: [],
      impacts: [],
      settings,
    });
    const t = text(wrap(<Indexing d={d} {...props} member />));
    for (const s of ['Fixed on your site, waiting for Google', 'Ask Google to read these pages again', 'We never do it for you', '/new', 'We could not read your whole sitemap']) expect(t).toContain(s);
  });
  it('A12: the pages that lost ground after an update are listed (by the engine\'s segment)', () => {
    const d = buildIndexingData({ rows, runs: [run], events: [], impacts: [{ event_id: 'c0', event_title: 'August 2026 core update', compared_at: '2026-09-12', dropped: 1, pages_json: JSON.stringify([{ url: U('/lost'), segment: 'dropped', state: 'indexed', before_clicks: 10, after_clicks: 1 }]) }], settings });
    const t = text(wrap(<Indexing d={d} {...props} member />));
    expect(t).toContain('/lost');
    expect(t).toContain('10 clicks before, 1 after');
  });
});

describe('index_coverage report, fix wave 1', () => {
  it('A18: lists only what needs the client, every reason in words', () => {
    const t = text(renderReport(report('index_coverage', { status: 'complete', summary: { known: 10, indexed: 5, not_indexed: 3, excluded: 2, unknown: 0, by_action: { leave_out: 2, retry: 1 }, by_cause: { low_value: 2, not_checked: 1, unclassified: 1, brand_new_code: 1 }, dropped: [], events: [], impact: {} }, cost: { usd: 0 } })));
    expect(t).not.toContain('Left out on purpose');
    expect(t).not.toContain('Could not be checked');
    expect(t).not.toContain('brand new code');
    expect(t).not.toContain('unclassified');
    expect(t).toContain(INDEX_UNCLASSIFIED_LABEL);
  });
});

// ---------------------------------------------------------------- fix wave 2 (REVIEW_2.md)
describe('fix wave 2: a check that could not read the website (N-app-6 / N12)', () => {
  const failedSummary = { failed: true, checked: false, note: 'Search Console refused access for this property, so pages were not checked.' };
  it('the report says it could not check, shows the note, and marks any figures as the last check\'s', () => {
    const t = text(renderReport(report('index_coverage', { status: 'complete', summary: { ...failedSummary, known: 40, indexed: 31, not_indexed: 6, backlog_left: 3, by_action: { site_fix: 2 }, by_cause: { noindex: 2 }, dropped: [], events: [], impact: {} }, cost: { usd: 0 } })));
    expect(t).toContain('We could not check techand.ai this time');
    expect(t).toContain('refused access');
    expect(t).toContain('In Google search (last check)');
    expect(t).toContain('from the last check that read your website');
    expect(t).not.toContain('Google has 31 of');
    expect(t).not.toContain('Nothing needs you this time');
  });
  it('a failed report with no figures at all shows no counts', () => {
    const t = text(renderReport(report('index_coverage', { status: 'complete', summary: { ...failedSummary, dropped: [], events: [], impact: {} }, cost: { usd: 0 } })));
    expect(t).toContain('We could not check techand.ai this time');
    expect(t).toContain('There are no figures to show yet');
    expect(t).not.toContain('In Google search');
  });
  it('an internal error text in the note is never shown', () => {
    const t = text(renderReport(report('index_coverage', { status: 'complete', summary: { failed: true, note: 'diagnosis failed: TypeError x is undefined', dropped: [], events: [], impact: {} }, cost: { usd: 0 } })));
    expect(t).not.toContain('TypeError');
    expect(t).toContain('Something went wrong on our side');
  });
  it('the page: a newest run that did not read the website says "Could not check" over the earlier figures', () => {
    const d = buildIndexingData({ rows, runs: [{ run_at: '2026-10-29T09:00:00Z', known: 7, note: 'The website did not answer.', sitemaps_json: JSON.stringify({ checked: false }) }, { run_at: '2026-10-28T07:00:00Z', known: 7, inspected: 6 }], events: [], impacts: [], settings });
    const t = text(wrap(<Indexing d={d} {...props} member />));
    expect(t).toContain('Could not check');
    expect(t).toContain('last check');
    expect(t).toContain('so these figures are from the check of');
  });
});

describe('fix wave 2: copy (N-app-9)', () => {
  it('no "we ask Google" and no "every page checked every day" in the app\'s strings', async () => {
    const { readFileSync } = await import('node:fs');
    const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
    const files = ['components/site/MonitorSettingsFields.tsx', 'pages/site/IndexingPage.tsx', 'components/site/SiteTasks.tsx', 'components/reports/indexing.tsx', 'marketing/content/changelog.ts'].map(src).join('\n');
    expect(files).not.toMatch(/we ask google|asked google about|the daily check covers every page|we check each one ourselves, every day/i);
  });
});

// ---------------------------------------------------------------- fix wave 3 (REVIEW_3.md R5)
describe('fix wave 3: a failed run\'s report (R5)', () => {
  it('says "from the last check" once and never shows a fragment of an internal error', () => {
    const note = 'We could not check this website today: inventory failed: TypeError x.y. The figures are from the last check.';
    const t = text(renderReport(report('index_coverage', { status: 'complete', summary: { failed: true, checked: false, note, figures_from: 'last_check', known: 40, indexed: 31, not_indexed: 6, backlog_left: 3, by_action: { site_fix: 2 }, by_cause: { noindex: 2 }, dropped: [], events: [], impact: {} }, cost: { usd: 0 } })));
    expect((t.match(/from the last check/gi) ?? []).length).toBe(1);
    expect(t).not.toMatch(/TypeError|x\.y| y\. |failed:/);
    expect(t).toContain('Something went wrong on our side');
    expect(t).toContain('In Google search (last check)');
  });
});
