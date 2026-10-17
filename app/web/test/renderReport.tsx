import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { Me, Org, ReportDetail, ReportFile } from '@seo/shared';
import { GuideProvider } from '@/components/guide';
import { TooltipProvider } from '@/components/ui/overlay';
import { ReportView } from '@/components/reports';
import { makeCan, OrgContext } from '@/lib/context';
import { ThemeProvider } from '@/lib/theme';

// Renders one stored report the way the report page does (inside the company layout's context), to HTML in Node.

export const ORG_ID = 'org-test';
const org = { id: ORG_ID, name: 'Test Co', slug: 'test-co', industry: '', size: '1-10', website: 'techand.ai', monthlyBudgetUsd: 25, disabled: false, onboardingStep: 'done', onboardedAt: '2026-10-02T00:00:00.000Z', createdAt: '2026-10-02T00:00:00.000Z', role: 'owner' } as Org;
const me = { user: { id: 'u1', email: 'owner@example.org', name: 'Owner' }, orgs: [], platformAdmin: false } as unknown as Me;

export function report(stage: string, payload: Record<string, unknown>, extra: Partial<ReportDetail> = {}): ReportDetail {
  return {
    id: 'rep-1',
    runId: null,
    siteId: 'site-1',
    siteDomain: 'techand.ai',
    stage,
    status: 'progress',
    title: stage,
    summary: {},
    receivedAt: '2026-10-17T16:42:24.000Z',
    scheduled: true,
    files: [] as ReportFile[],
    payload: { stage, domain: 'techand.ai', ...payload },
    ...extra,
  };
}

export function renderReport(r: ReportDetail, children?: ReactNode): string {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToString(
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          <GuideProvider>
            <MemoryRouter>
              <OrgContext.Provider value={{ me, org, role: 'owner', sites: [], can: makeCan('owner') }}>
                <ReportView report={r} />
                {children}
              </OrgContext.Provider>
            </MemoryRouter>
          </GuideProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

/** the visible text of rendered HTML (tags dropped, entities decoded enough for assertions) */
export const text = (html: string): string =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
