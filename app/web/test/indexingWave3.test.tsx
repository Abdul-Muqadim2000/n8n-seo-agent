import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { buildIndexingData, type IndexPageRow, type IndexRunRow } from '@seo/shared';
import { GuideProvider } from '@/components/guide';
import { TooltipProvider } from '@/components/ui/overlay';
import { ThemeProvider } from '@/lib/theme';
import { Indexing } from '@/pages/site/IndexingPage';
import { renderReport, report, text } from './renderReport';

// Index coverage wave 3 (DESIGN_WAVE3 §3), the web half, on devaicon-shaped rows (anonymised: novaand-demo.com): the waiting group as a
// to-do with "Do first" and "What we checked" on each page; "Needs you: Google has not visited after 3 weeks" with its steps and guides
// (a short page during a Google update: no Improve button); the policy card with "This is an important page"; "Fine to leave out" and "Undo"
// for members only; the report's new figures.

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
const RUN = '2026-11-12T05:15:00Z';
const settings = { on: true, dailyCap: 300 };
const props = { orgId: 'org-1', siteId: 'site-1', domain: D };
const page = (o: Partial<IndexPageRow>): Partial<IndexPageRow> => ({ lane: 'existing', state: 'not_indexed', inspect_at: RUN, http_status: 200, in_sitemap: true, ...o });
const wait = (path: string, o: Partial<IndexPageRow> = {}) => page({ url: U(path), cause: 'unknown_to_google', action: 'wait', linked_by: JSON.stringify([U('/')]), link_depth: 1, linked_n: 2, robots_ok: 'yes', words: 700, ...o });
const rows: Partial<IndexPageRow>[] = [
  wait('/industries/retail', { priority: 1, ask_google: true }),
  wait('/industries/public-sector', { priority: 2, robots_ok: '', indexnow_at: '2026-11-10T05:15:00Z' }),
  wait('/careers/dev', { priority: 7, link_depth: 2, linked_by: JSON.stringify([U('/careers')]), linked_n: 1 }),
  wait('/insights/agentic-ai', { priority: 3, escalated_at: '2026-11-11T05:15:00Z', escalate_why: 'not_asked,short_page,sitemap_no_dates', words: 240 }),
  page({ url: U('/privacy'), cause: 'low_value', action: 'leave_out', state: 'excluded' }),
  page({ url: U('/cookies'), cause: 'low_value', action: 'leave_out', state: 'excluded' }),
  wait('/careers/old', { type_override: 'utility' }),
];
const run = (freeze = false): Partial<IndexRunRow> => ({ run_at: RUN, known: 7, inspected: 7, freeze, sitemaps_json: JSON.stringify({ submitted: 1, read: 1, complete: true, dates: { urls: 30, with_lastmod: 0, distinct: 0 } }) });
const data = (freeze = false) => buildIndexingData({ rows, runs: [run(freeze)], events: [], impacts: [], settings, now: Date.parse('2026-11-12T12:00:00Z') });

describe('Indexing page, wave 3', () => {
  it('the waiting group is a to-do: the summary, "Do first", and what we checked on each page ("not checked" never as passed)', () => {
    const t = text(wrap(<Indexing d={data()} {...props} member />));
    expect(t).toContain('Google has not visited 3 pages. 2 matter most. Do these 3 things: ask Google to read 1 page today; add dates to your sitemap; link 1 page from your home page or menu.');
    expect(t).toContain('Do first');
    expect(t).toContain('What we checked: Opens (200) · Can be indexed (no noindex) · robots.txt allows it · In your sitemap · Linked from your home page (2 pages) · 700 words');
    expect(t).toContain('robots.txt: not checked');
    expect(t).toContain('Sent to Bing 10 Nov');
    expect(t).not.toContain('Nothing on these pages');
    // a page Google has not visited is "Not visited yet", and its group is a to-do, never "Give it time"
    expect(t).toContain('Not visited yet');
    expect(t).not.toContain('Give it time');
  });
  it('Needs you after 3 weeks: the reasons as steps with their guides, and "I asked Google" on the page', () => {
    const html = wrap(<Indexing d={data()} {...props} member />);
    const t = text(html);
    expect(t).toContain('Needs you: Google has not visited after 3 weeks');
    expect(t).toContain('Google has not visited this page in the 3 weeks we have watched it.');
    expect(t).toContain('Ask Google to read it in Search Console, then press I asked Google here.');
    expect(t).toContain('The page is short (240 words): add what a buyer needs to know.');
    expect(t).toContain('Add the date each page last changed to your sitemap.');
    expect(t).toContain('Not visited after 3 weeks');
    // the escalated page is listed once, not also under "Google has not visited these yet"
    expect((t.match(/\/insights\/agentic-ai/g) ?? []).length).toBe(1);
    const improve = [...html.matchAll(/prefill=([^"&]+)/g)].map((m) => JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1]))))).existingPageUrl);
    expect(improve).toContain(U('/insights/agentic-ai'));
  });
  it('while a Google update rolls out a short page waits for it, with no Improve button', () => {
    const html = wrap(<Indexing d={data(true)} {...props} member />);
    expect(text(html)).toContain("add what a buyer needs to know, after Google's update finishes.");
    const improve = [...html.matchAll(/prefill=([^"&]+)/g)].map((m) => JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1]))))).existingPageUrl);
    expect(improve).not.toContain(U('/insights/agentic-ai'));
  });
  it('the policy card names its pages; members get "This is an important page", "Fine to leave out" and "Undo"; viewers get none', () => {
    const t = text(wrap(<Indexing d={data()} {...props} member />));
    expect(t).toContain('2 pages look like policy pages (privacy, cookies). They do not need to be in Google. If one of them should rank, press This is an important page.');
    expect(t).toContain('You may also leave them out of your sitemap; it is optional.');
    expect(t).toContain('This is an important page');
    expect(t).toContain('Fine to leave out');
    expect(t).toContain('Pages you marked as fine to leave out');
    expect(t).toContain('You marked this page as fine to leave out of Google.');
    expect(t).toContain('Undo');
    const viewer = text(wrap(<Indexing d={data()} {...props} member={false} />));
    // the card's own sentence names the button; the buttons themselves are for members
    const n = (x: string, w: RegExp) => (x.match(w) ?? []).length;
    expect(n(t, /This is an important page/g) - n(viewer, /This is an important page/g)).toBe(2);
    expect(n(viewer, /Fine to leave out/g)).toBe(0);
    // the three waiting pages and the escalated one
    expect(n(t, /Fine to leave out/g)).toBe(4);
    expect(n(t, /\bUndo\b/g) - n(viewer, /\bUndo\b/g)).toBe(1);
    // two "I asked Google" buttons for a member (the ask panel's page and the escalated page), none for a viewer
    const count = (x: string) => (x.match(/I asked Google/g) ?? []).length;
    expect(count(t) - count(viewer)).toBe(2);
  });
  it('copy: no dashes, curly quotes, "..." or promises', () => {
    const t = text(wrap(<Indexing d={data()} {...props} member />));
    expect(t).not.toMatch(/[–—…‘’“”]|guarantee|instant|get indexed/i);
  });
});

describe('index_coverage report, wave 3', () => {
  it('shows waiting, needs you after 3 weeks, asked, read after asking, sent to Bing, do first and the sitemap dates', () => {
    const t = text(
      renderReport(
        report('index_coverage', {
          status: 'complete',
          summary: {
            known: 40,
            indexed: 18,
            not_indexed: 22,
            by_action: { wait: 13, leave_out: 2 },
            by_cause: { unknown_to_google: 13 },
            dropped: [],
            events: [],
            impact: {},
            waiting: 12,
            escalated: 1,
            asked_waiting: 2,
            read_after_ask_7d: 9,
            indexnow_sent: 31,
            do_first: [{ url: U('/industries/retail'), why: 'not_asked' }, { url: U('/insights/agentic-ai'), why: 'Linked only from one page.' }],
            sitemap_dates: { urls: 40, with_lastmod: 0, distinct: 0 },
          },
          cost: { usd: 0 },
        }),
      ),
    );
    expect(t).toContain('Pages Google has not visited yet');
    expect(t).toContain('Waiting for a first visit 12');
    expect(t).toContain('Need you after 3 weeks 1');
    expect(t).toContain('Asked Google, not read yet 2');
    expect(t).toContain('Read within 7 days of asking 9');
    expect(t).toContain('Sent to Bing 31');
    expect(t).toMatch(/\/industries\/retail\s*: not asked about in Search Console yet/);
    expect(t).toMatch(/\/insights\/agentic-ai\s*: Linked only from one page\./);
    expect(t).toContain('Your sitemap lists 40 pages and gives no date for any of them.');
  });
  it('an older report without the new figures shows no such block', () => {
    const t = text(renderReport(report('index_coverage', { status: 'complete', summary: { known: 40, indexed: 18, not_indexed: 22, by_action: { wait: 13 }, by_cause: {}, dropped: [], events: [], impact: {} }, cost: { usd: 0 } })));
    expect(t).not.toContain('Pages Google has not visited yet');
  });
});
