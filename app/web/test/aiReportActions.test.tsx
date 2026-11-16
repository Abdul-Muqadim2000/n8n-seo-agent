import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { Me, Org } from '@seo/shared';
import { TooltipProvider } from '@/components/ui/overlay';
import { ActionRunButton } from '@/components/reports/actions';
import { prefillFromApiBody } from '@/components/reports/meta';
import { makeCan, OrgContext } from '@/lib/context';
import { qk } from '@/lib/queries';
import { decodePrefill } from '@/lib/utils';
import { ThemeProvider } from '@/lib/theme';
import { text } from './renderReport';

// Review 2026-11-16 (M1): the AI visibility REPORT's "Write this page" started the old run: the panel topic as keyword, no AI target, a
// comparison as a "Blog Post", and a write button for a question whose page was already written. It now goes through the shared resolver.

const DUBAI = 'Which companies offer the best AI automation services for businesses in Dubai?';
const org = { id: 'org-1', name: 'Devaicon', slug: 'devaicon', role: 'owner' } as unknown as Org;
const me = { user: { id: 'u1', email: 'o@devaicon.com', name: 'Owner' }, orgs: [], platformAdmin: false } as unknown as Me;
const site = { id: 'site-1', domain: 'devaicon.com', country: 'United Arab Emirates', verifiedAt: '2026-11-01T00:00:00Z' };
// what a report stored before the engine fix carries
const OLD = { priority: 1, type: 'content', action: `Win the answer to "${DUBAI}"`, keyword: 'ai automation services',
  api_body: { mode: 'keyword', keyword: 'ai automation services', page_type: 'Comparison Page', ai_target: { question: DUBAI, kind: 'answer', target_id: 'ait_devaicon-com_q_dubai', fanout: ['ai automation companies dubai'], sources: [], competitors: ['rival.ae'] } } };
const aiData = (targets: unknown[] = [], pagesWritten: unknown[] = []) => ({
  prompts: [{ promptId: 'q_dubai', prompt: DUBAI, keyword: 'best ai automation services dubai', topic: 'ai automation services', kind: 'compare' }],
  report: null, growth: { targets }, pagesWritten,
});
function render(node: ReactNode, data?: unknown, withSite = true): string {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (data) qc.setQueryData(qk.siteData('site-1', 'ai', 'answers=summary'), data);
  return renderToString(
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          <MemoryRouter>
            <OrgContext.Provider value={{ me, org, role: 'owner', sites: withSite ? ([site] as never) : [], can: makeCan('owner') }}>{node}</OrgContext.Provider>
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}
const prefillOf = (html: string) => {
  const m = html.match(/href="([^"]+)"/);
  const u = new URL(m![1].replace(/&amp;/g, '&'), 'https://x.test');
  return { mode: u.pathname.split('/').pop(), prefill: decodePrefill(u.searchParams.get('prefill')) };
};

describe('the AI visibility report\'s action button', () => {
  it('an older report\'s topic keyword becomes the question\'s own search, with its AI target, as a guide', () => {
    const html = render(<ActionRunButton action={OLD} siteId="site-1" />, aiData());
    expect(text(html)).toContain('Write this page');
    const { mode, prefill } = prefillOf(html);
    expect(mode).toBe('keyword');
    expect(prefill).toMatchObject({ keyword: 'best ai automation services dubai', pageType: 'Guide', aiTarget: { question: DUBAI, kind: 'answer', targetId: 'ait_devaicon-com_q_dubai' } });
  });
  it('no write button for a question whose page is written: "I published it"; live: "See the page"', () => {
    const written = render(<ActionRunButton action={OLD} siteId="site-1" />, aiData([{ targetId: 'ait_devaicon-com_q_dubai', promptId: 'q_dubai', question: DUBAI, keyword: 'best ai automation services dubai', kind: 'answer', state: 'written' }]));
    expect(text(written)).toContain('I published it');
    expect(text(written)).not.toContain('Write this page');
    expect(prefillOf(written).mode).toBe('published');
    const live = render(<ActionRunButton action={OLD} siteId="site-1" />, aiData([], [{ keyword: 'best ai automation services dubai', status: 'published', publishedUrl: 'https://devaicon.com/insights/ai-automation-dubai', source: 'ai_answer' }]));
    expect(text(live)).toContain('See the page');
    expect(text(live)).not.toContain('Write this page');
  });
  it('the report\'s own question grid corrects the keyword when the website is not one of this company\'s', () => {
    const html = render(<ActionRunButton action={OLD} siteId={null} aiQuestions={[{ promptId: 'q_dubai', prompt: DUBAI, keyword: 'best ai automation services dubai', topic: 'ai automation services' }]} />, undefined, false);
    expect(prefillOf(html).prefill).toMatchObject({ keyword: 'best ai automation services dubai', aiTarget: { question: DUBAI } });
  });
  it('the engine\'s publish action opens "I published it"', () => {
    const html = render(<ActionRunButton action={{ priority: 1, type: 'publish', action: `Publish your page for "${DUBAI}"`, keyword: 'best ai automation services dubai' }} siteId="site-1" />, aiData());
    expect(text(html)).toContain('I published it');
  });
  it('prefillFromApiBody keeps the AI target and never turns a comparison into a blog post', () => {
    expect(prefillFromApiBody(OLD.api_body)?.prefill).toMatchObject({ pageType: 'Guide', aiTarget: { question: DUBAI, kind: 'answer' } });
    expect(prefillFromApiBody({ mode: 'keyword', keyword: 'x y', page_type: 'Comparison Page' })?.prefill.pageType).toBe('Blog Post');
  });
});
