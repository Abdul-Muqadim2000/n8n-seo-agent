import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { buildIndexingData, type IndexPageRow } from '@seo/shared';
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
const data = (o: { rolling?: boolean } = {}) =>
  buildIndexingData({
    rows,
    runs: [{ run_at: '2026-10-28T07:00:00Z', backlog_left: 1, inspected: 6 }],
    events: [o.rolling ? { event_id: 'c1', kind: 'core', status: 'rolling_out', title: 'October 2026 core update', started_at: '2026-10-20' } : { event_id: 'c0', kind: 'core', status: 'complete', title: 'August 2026 core update', started_at: '2026-08-20', ended_at: '2026-09-05', url: 'https://status.search.google.com/x' }],
    impacts: [{ event_id: 'c0', event_title: 'August 2026 core update', compared_at: '2026-09-12', dropped: 1, stable: 3, gained: 1, pages_json: JSON.stringify([{ url: U('/old'), before_clicks: 10, after_clicks: 1, state: 'dropped' }]) }],
    settings,
  });
const props = { orgId: 'org-1', siteId: 'site-1', domain: D };

describe('Indexing page', () => {
  it('with data: hero, lanes, a group with its three sentences and its step, drop-outs, updates, settings', () => {
    const html = wrap(<Indexing d={data()} {...props} member />);
    const t = text(html);
    expect(t).toContain('Google has 1 of your 6 pages that should be in search');
    expect(t).toContain('Existing pages checked: 5 of 6, about 1 day to check the rest');
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
    for (const s of ['Google has 31 of the 40 pages', '4 pages need you', '1 dropped out', '/pricing', 'Your page tells Google to leave it out', 'October 2026 core update is rolling out', 'The report as text']) expect(t).toContain(s);
    expect(t).not.toContain('NaN');
  });
});
