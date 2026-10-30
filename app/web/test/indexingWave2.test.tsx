import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { buildIndexingData, indexDayText, type IndexPageRow, type IndexRunRow } from '@seo/shared';
import { GuideProvider } from '@/components/guide';
import { TooltipProvider } from '@/components/ui/overlay';
import { ThemeProvider } from '@/lib/theme';
import { Indexing } from '@/pages/site/IndexingPage';
import { completeMonitors, SitemapAccessLine } from '@/components/site/MonitorSettingsFields';
import { renderReport, report, text } from './renderReport';

// Index coverage wave 2 (DESIGN_WAVE2 §3), the web half, on devaicon-shaped rows (anonymised: novaand-demo.com): pages the website already
// links to wait for Google in their own group (no step, no suggestions); the pages that need a link link to their step; policy pages never
// offer "Improve this page"; "I asked Google" for members only and the page's state after it; the sitemap card with Google's access, the
// warning and the guide, and the submissions; the sitemap switch in Tracking & monitors; the report counts the pages that need a link from
// the action, not from the reason.

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
const RUN = '2026-10-30T06:00:00Z';
const settings = { on: true, dailyCap: 300 };
const props = { orgId: 'org-1', siteId: 'site-1', domain: D };
const page = (o: Partial<IndexPageRow>): Partial<IndexPageRow> => ({ lane: 'existing', state: 'not_indexed', inspect_at: RUN, ...o });
const rows: Partial<IndexPageRow>[] = [
  page({ url: U('/whatwedo'), cause: 'unknown_to_google', action: 'wait', linked_by: JSON.stringify([U('/')]), in_sitemap: true }),
  page({ url: U('/capabilities/cloud'), cause: 'discovered_not_crawled', action: 'wait', linked_by: JSON.stringify([U('/')]), ask_google: true, impressions_28d: 4 }),
  page({ url: U('/capabilities/open-edx-services/hosting'), cause: 'unknown_to_google', action: 'links', link_from: JSON.stringify([{ url: U('/capabilities/open-edx-services'), title: 'Open edX' }]) }),
  page({ url: U('/industries/bfsi'), cause: 'canonical_elsewhere', action: 'site_fix', in_sitemap: false, page_canonical: U('/industries') }),
  page({ url: U('/privacy'), cause: 'low_value', action: 'leave_out', state: 'excluded' }),
  page({ url: U('/cookies'), cause: 'crawled_not_indexed', action: 'quality' }),
  page({ url: U('/blog/peppol'), cause: 'crawled_not_indexed', action: 'quality', title: 'Peppol in the UAE' }),
];
const sitemaps = (o: Record<string, unknown>): Partial<IndexRunRow> => ({ run_at: RUN, known: 7, inspected: 7, sitemaps_json: JSON.stringify({ submitted: 1, read: 1, complete: true, ...o }) });
const data = (o: { run?: Partial<IndexRunRow>; submit?: boolean; extra?: Partial<IndexPageRow>[] } = {}) =>
  buildIndexingData({ rows: [...rows, ...(o.extra ?? [])], runs: [o.run ?? { run_at: RUN, known: 7, inspected: 7 }], events: [], impacts: [], settings, sitemapSubmit: o.submit, now: Date.parse('2026-11-02T00:00:00Z') });

describe('Indexing page, wave 2', () => {
  it('already linked pages wait for Google in their own group; the pages that need a link open their step', () => {
    const html = wrap(<Indexing d={data()} {...props} member />);
    const t = text(html);
    expect(t).toContain('Google has not visited these yet');
    expect(t).toContain('Your website already links to these pages');
    expect(t).toContain('links from other websites');
    // the canonical pages outside the sitemap have their own words and open the canonical step
    expect(t).toContain('Pages that say they are a copy of another page');
    expect(t).toContain('Policy and utility pages: fine to leave out');
    expect(t).not.toMatch(/[–—…]|get indexed|guarantee|we submit your pages|we ask google/i);
  });
  it('a policy page is never "Improve this page", an article is', () => {
    const html = wrap(<Indexing d={data()} {...props} member />);
    const improve = [...html.matchAll(/prefill=([^"&]+)/g)].map((m) => JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1]))))).existingPageUrl);
    expect(improve).toContain(U('/blog/peppol'));
    expect(improve).not.toContain(U('/cookies'));
  });
  it('"I asked Google" for members only; after it the page waits for Google, then says when Google read it', () => {
    // the panel's own sentence names the button once; the button is the second
    const count = (t: string) => (t.match(/I asked Google/g) ?? []).length;
    expect(count(text(wrap(<Indexing d={data()} {...props} member />)))).toBe(2);
    expect(count(text(wrap(<Indexing d={data()} {...props} member={false} />)))).toBe(1);
    const asked = data();
    const at = new Date(Date.now() - 2 * 864e5).toISOString();
    const waiting = text(wrap(<Indexing d={{ ...asked, askGoogle: asked.askGoogle.map((p) => ({ ...p, askedGoogleAt: at })) }} {...props} member />));
    expect(waiting).toContain(`Waiting for Google to read it again (you asked on ${indexDayText(at)}).`);
    expect(count(waiting)).toBe(1);
    const read = data({ extra: [page({ url: U('/capabilities/ai'), state: 'indexed', cause: 'indexed', action: 'none', asked_google_at: '2026-10-28T10:00:00Z', google_read_after_ask_at: '2026-10-30T02:00:00Z' })] });
    const t = text(wrap(<Indexing d={read} {...props} member />));
    expect(t).toContain('Google read it again on 30 Oct. It is in Google search now.');
    // a press the daily check did not keep: "Not recorded", and the button is back
    const lost = data();
    const lt = text(wrap(<Indexing d={{ ...lost, askGoogle: lost.askGoogle.map((p) => ({ ...p, askNotRecorded: '2026-10-29T10:00:00Z' })) }} {...props} member />));
    expect(lt).toContain('Not recorded');
    expect(lt).toContain('You told us on 29 Oct that you asked Google, but the daily index check did not keep it.');
    expect((lt.match(/I asked Google/g) ?? []).length).toBe(3);
  });
  it('the sitemap card: read-only access warns and offers the Full access guide; Full access lists each submission and Google\'s read date', () => {
    const restricted = text(wrap(<Indexing d={data({ run: sitemaps({ permission: 'siteRestrictedUser' }), submit: true })} {...props} member />));
    expect(restricted).toContain('Google gives us read-only access');
    expect(restricted).toContain('Give us Full access in Search Console, or submit it yourself.');
    expect(restricted).toContain('Give us Full access');
    const full = text(
      wrap(
        <Indexing
          d={data({ run: sitemaps({ permission: 'siteFullUser', submissions: [{ path: U('/sitemap.xml'), at: '2026-10-30T06:05:00Z', status: 'ok', reason: '' }], list: [{ path: U('/sitemap.xml'), lastSubmitted: '2026-10-30T06:05:00Z', lastDownloaded: '2026-10-31T02:00:00Z' }] }), submit: true })}
          {...props}
          member
        />,
      ),
    );
    expect(full).toContain('Sitemap submission is on');
    expect(full).toContain('We can submit your sitemap');
    expect(full).toContain('/sitemap.xml');
    expect(full).toContain('Google read your sitemap on');
    // ENGINE_BUILD wave 2 contract 11: no sitemap in Search Console, switch on, and (wave 2 review W1) the engine says it will submit it
    const will = text(wrap(<Indexing d={data({ run: sitemaps({ permission: 'siteFullUser', permission_full: true, submitted: 0, submit: { on: true, will_submit: true, blocked: '' } }), submit: true })} {...props} member />));
    expect(will).toContain('We will submit it on the next daily check; there is nothing to do on your side.');
    // switched off, Full access and nothing submitted: no card at all
    expect(text(wrap(<Indexing d={data({ run: sitemaps({ permission: 'siteFullUser' }) })} {...props} member />))).not.toContain('Your sitemap in Search Console');
  });
});

describe('Tracking & monitors, the sitemap switch', () => {
  it('kept only when stored or chosen; the access line in its three states', () => {
    expect(completeMonitors({}).indexSitemapSubmit).toBeUndefined();
    expect(completeMonitors({ indexSitemapSubmit: true }).indexSitemapSubmit).toBe(true);
    const line = (info: Parameters<typeof SitemapAccessLine>[0]['info'], on = true) => text(wrap(<SitemapAccessLine info={info} domain={D} on={on} />));
    expect(line({ access: 'full', at: RUN })).toContain('We can submit your sitemap');
    expect(line({ access: 'restricted', at: RUN })).toContain('Google gives us read-only access, so we cannot submit your sitemap');
    expect(line(null)).toContain('We will know after the next daily check');
  });
  it('the switch is off unless chosen, and says what it does and nothing more', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../src/components/site/MonitorSettingsFields.tsx', import.meta.url), 'utf8');
    expect(src).toContain('Let Alaventra submit your sitemap to Google');
    expect(src).toContain('checked={value.indexSitemapSubmit ?? false}');
    expect(src).toContain('We only read your Search Console, unless you switch this on, which lets us submit your sitemap and nothing else.');
  });
});

describe('the read-only promise, rewritten everywhere it appears', () => {
  it('the connection screens and the business site say the new sentence and no longer promise read-only', async () => {
    const { readFileSync } = await import('node:fs');
    const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
    const SENTENCE = 'We only read your Search Console, unless you switch on sitemap submission, which lets us submit your sitemap and nothing else.';
    for (const f of ['components/site/ServiceAccountSteps.tsx', 'components/site/GoogleConnectionPanel.tsx', 'marketing/pages/SecurityPage.tsx']) expect(src(f), f).toContain(SENTENCE);
    expect(src('components/site/ServiceAccountSteps.tsx')).not.toContain('we never change anything');
    const sec = src('marketing/pages/SecurityPage.tsx');
    expect(sec).not.toContain('it never writes to them');
    expect(sec).not.toContain('asks Google for read access only');
    const features = src('marketing/content/features.ts');
    expect(features).not.toContain('Nothing is submitted to Google for you');
    expect(features).toContain('which lets us submit your sitemap and nothing else');
    expect(src('marketing/content/changelog.ts')).toContain("version: '4.6'");
  });
});

describe('index_coverage report, wave 2', () => {
  it('counts the pages that need a link from the action, never the pages already linked under "Google has not found it yet"', () => {
    const t = text(
      renderReport(
        report('index_coverage', {
          status: 'complete',
          summary: { known: 30, indexed: 9, not_indexed: 20, by_action: { links: 2, wait: 16, site_fix: 1 }, by_cause: { unknown_to_google: 12, discovered_not_crawled: 6, canonical_elsewhere: 1 }, dropped: [], events: [], impact: {} },
          cost: { usd: 0 },
        }),
      ),
    );
    expect(t).toContain('Need a link from another page of yours 2');
    expect(t).not.toContain('Google has not found it yet');
    expect(t).not.toContain('Google knows it but has not read it yet');
  });
});
