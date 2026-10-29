import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { deliveryOf, type Me, type Org, type PageReviewView } from '@seo/shared';
import { GuideProvider } from '@/components/guide';
import { TooltipProvider } from '@/components/ui/overlay';
import { ReviewBody } from '@/components/reports/review/ReviewPanels';
import { makeCan, OrgContext } from '@/lib/context';
import { ThemeProvider } from '@/lib/theme';
import { text } from './renderReport';

// W0-B (2026-10-29, owner decision D2): a delivered page the website already has a page for. The review says so, names the page, offers
// the update run (the Write a page form with that page's address) and the client's reason, which is saved once and shown as saved.

vi.mock('@/components/reports/article', async (orig) => ({ ...(await orig<typeof import('@/components/reports/article')>()), ArticleViewer: () => null }));

const BC = 'https://www.novaand-demo.com/dynamics-365-business-central-uae';
const org = { id: 'org-test', name: 'Test Co', slug: 'test-co', role: 'owner' } as unknown as Org;
const me = { user: { id: 'u1', email: 'owner@example.org', name: 'Owner' }, orgs: [], platformAdmin: false } as unknown as Me;
const render = (el: React.ReactNode, role: 'owner' | 'viewer' = 'owner') =>
  renderToString(
    <ThemeProvider>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })}>
        <TooltipProvider>
          <GuideProvider>
            <MemoryRouter>
              <OrgContext.Provider value={{ me, org, role, sites: [], can: makeCan(role) }}>{el}</OrgContext.Provider>
            </MemoryRouter>
          </GuideProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
const page = { id: 'rep-1', siteId: 'site-1', siteDomain: 'novaand-demo.com', stage: 'content', status: 'completed', title: 'Page', summary: {}, receivedAt: '2026-10-29T00:00:00Z', scheduled: false, files: [], runId: null, payload: {} } as never;
const DUP = `This website already has a page for the same search: ${BC}. Publish this text as an update of that page, or tell us how the new page differs`;
const view = (decision: NonNullable<PageReviewView['duplicate']>['decision'] = null): PageReviewView => ({
  reportId: 'rep-1',
  siteId: 'site-1',
  keyword: 'ms 365 erp',
  delivery: deliveryOf({ qa_delivery_status: 'not_ready', qa_blocking: [{ code: 'duplicate_page', text: DUP, action: 'rewrite it as an update of that page' }], qa_client_questions: [], qa_grade: { score: 92 } }),
  questions: [],
  answers: {},
  delivered: { markdown: '# MS 365 ERP\n\nText.\n', title: 'MS 365 ERP', metaDescription: '', metaDescriptionNote: '', slug: 'ms-365-erp-uae' },
  clientVersion: null,
  finalize: { status: 'none', runId: null, reportId: null, error: null, startedAt: null, quote: { credits: 9, usd: 0.03 }, needed: !!decision, reason: '' },
  approval: null,
  publish: { status: 'not_published', url: null, at: null },
  stage: 'not_ready',
  isFinal: false,
  finalOf: null,
  people: { u1: 'Owner' },
  duplicate: { pages: [{ url: BC, title: 'Business Central ERP Solutions in UAE' }], decision, rewrite: { keyword: 'ms 365 erp', pageType: 'Service Page', country: 'United Arab Emirates' } },
});

describe('your website already has a page for this search', () => {
  it('names the page and the two ways out, in plain words', () => {
    const t = text(render(<ReviewBody view={view()} report={page} />));
    expect(t).toContain('Your website already has a page for this search');
    expect(t).toContain('Business Central ERP Solutions in UAE');
    expect(t).toContain('Rewrite it as an update of your page');
    expect(t).toContain('Or tell us how this page differs');
    expect(t).toContain('keeps a limit for fit');
    const own = t.slice(t.indexOf('Your website already has a page'), t.indexOf('Or tell us how this page differs') + 400);
    expect(own).not.toMatch(/[—–“”‘’…]/);
  });
  it('"Rewrite it as an update" opens the Write a page form with that page\'s address (a normal page run, priced on the form)', () => {
    const html = render(<ReviewBody view={view()} report={page} />);
    const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, '&')).filter((l) => l.includes('/tools/keyword')).map((l) => {
      const q = new URLSearchParams(l.slice(l.indexOf('?') + 1)).get('prefill') ?? '';
      return q ? decodeURIComponent(escape(atob(q))) : '';
    });
    expect(links.some((l) => l.includes('"existingPageUrl":"' + BC + '"') && l.includes('"keyword":"ms 365 erp"'))).toBe(true);
  });
  it('a saved reason is shown as saved, with who gave it, and can be taken back', () => {
    const t = text(render(<ReviewBody view={view({ choice: 'differs', reason: 'This page is about the apps we license, not about ERP projects.', at: '2026-10-29T10:00:00Z', by: 'u1' })} report={page} />));
    expect(t).toContain('by Owner');
    expect(t).toContain('Make the final version to apply it');
    expect(t).toContain('Take my reason back');
  });
  it('a viewer sees the page but not the update button', () => {
    const t = text(render(<ReviewBody view={view()} report={page} />, 'viewer'));
    expect(t).toContain('Your website already has a page for this search');
    expect(t).not.toContain('Rewrite it as an update of your page');
  });
  it('no card when the website has no such page', () => {
    const t = text(render(<ReviewBody view={{ ...view(), duplicate: null }} report={page} />));
    expect(t).not.toContain('Your website already has a page for this search');
  });
});
