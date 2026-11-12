import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { holdOf, type Me, type Org } from '@seo/shared';
import { GuideProvider } from '@/components/guide';
import { TooltipProvider } from '@/components/ui/overlay';
import { ReportView } from '@/components/reports';
import { holdFormBase } from '@/components/reports/content';
import { makeCan, OrgContext } from '@/lib/context';
import { qk } from '@/lib/queries';
import { ThemeProvider } from '@/lib/theme';
import { ORG_ID, report, text } from './renderReport';

// Client reports 2026-11-11 (techand.ai, ladder "crm service provider", run 8f0a4bc3 / request 12477): "Write it anyway" on a ladder page
// the ladder stopped went out as a loose page (keyword, the verdict's "Service Page", country, holdAck). It now carries the held run's own
// ladder fields and page type, and the hold box says whose page it is.

const STOP_PAYLOAD = {
  keyword: 'what is a crm company', verdict: 'AVOID', score: 22, recommended_page: 'Service Page', country: 'United Arab Emirates', html: null, markdown: null,
  ladder_id: 'lad_mw0goinsniv1', ladder_rung: 2, ladder_head: 'crm service provider', page_run: null, meta: null, verdict_acknowledged: false, hold_shadow: null,
  hold: {
    held: true, mode: 'enforce', score: 22, threshold: 50, kinds: ['ladder_stop'], duplicates: [], alternatives: [],
    reasons: ['This page of your keyword ladder "crm service provider" is stopped: our check advised against this page (AVOID, score 22). Nothing was written for it; choose "Write it anyway" if you want this page all the same.'],
    ladder_stop: { band: 'avoid', rung: 2, reason: 'our check advised against this page (AVOID, score 22)', ladder_id: 'lad_mw0goinsniv1' },
    rule: 'A page waits for your OK when our verdict scores its keyword under 40 out of 100.', next: 'Nothing was written and only the check was charged.',
  },
};
const RUN_INPUT = {
  mode: 'keyword', siteId: 'site-1', keyword: 'what is a crm company', country: 'United Arab Emirates', pageType: 'Guide', goal: 'leads', tone: 'Professional and direct',
  ladder: { id: 'lad_mw0goinsniv1', head: 'crm service provider', rung: 2, pageNo: 2 }, receiveReport: true, receiveContent: true,
};
const RUN_ID = 'b3af6cae-5f4c-479e-80bb-d64b48d911a8';

const org = { id: ORG_ID, name: 'Test Co', slug: 'test-co', industry: '', size: '1-10', website: 'techand.ai', monthlyBudgetUsd: 25, disabled: false, onboardingStep: 'done', onboardedAt: '2026-10-02T00:00:00.000Z', createdAt: '2026-10-02T00:00:00.000Z', role: 'owner' } as Org;
const me = { user: { id: 'u1', email: 'owner@example.org', name: 'Owner' }, orgs: [], platformAdmin: false } as unknown as Me;

function render(withRun: boolean): string {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (withRun) qc.setQueryData(qk.run(ORG_ID, RUN_ID), { run: { id: RUN_ID, input: RUN_INPUT }, reports: [] });
  return renderToString(
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          <GuideProvider>
            <MemoryRouter>
              <OrgContext.Provider value={{ me, org, role: 'owner', sites: [], can: makeCan('owner') }}>
                <ReportView report={report('content', STOP_PAYLOAD, { runId: RUN_ID })} />
              </OrgContext.Provider>
            </MemoryRouter>
          </GuideProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}
const prefills = (html: string) =>
  [...html.matchAll(/href="([^"]+)"/g)]
    .map((m) => m[1].replace(/&amp;/g, '&'))
    .filter((l) => l.includes('/tools/keyword'))
    .map((l) => {
      const q = new URLSearchParams(l.slice(l.indexOf('?') + 1)).get('prefill') ?? '';
      return q ? (JSON.parse(decodeURIComponent(escape(atob(q)))) as Record<string, unknown>) : {};
    });

describe('"Write it anyway" on a ladder page the ladder stopped', () => {
  it('the hold box says whose page it is', () => {
    const t = text(render(true)).replace(/ \./g, '.');   // React's text separators
    expect(t).toContain('Needs your OK: "what is a crm company", a page of your keyword ladder "crm service provider" (rung 2), scored 22');
    expect(t).toContain('This is a page of your keyword ladder "crm service provider" (rung 2).');
    expect(t).toContain('Write it anyway');
    expect(t.slice(t.indexOf('Needs your OK'))).not.toMatch(/[–—…]/);
  });
  it('with the held run loaded: its own ladder fields and page type, and the acknowledgement', () => {
    const p = prefills(render(true));
    expect(p).toEqual([{ keyword: 'what is a crm company', country: 'United Arab Emirates', pageType: 'Guide', ladder: RUN_INPUT.ladder, holdAck: { score: 22 } }]);
  });
  it('before the run is loaded (or with none): the ladder the report names, page number 0, the verdict\'s page type', () => {
    const p = prefills(render(false));
    expect(p).toEqual([{ keyword: 'what is a crm company', country: 'United Arab Emirates', pageType: 'Service Page', ladder: { ...RUN_INPUT.ladder, pageNo: 0 }, holdAck: { score: 22 } }]);
  });
  it('holdFormBase: a page outside a ladder keeps the report\'s values; another ladder\'s run input is not used', () => {
    const plain = holdOf({ hold: { ...STOP_PAYLOAD.hold, kinds: ['score'], ladder_stop: undefined } })!;
    expect(holdFormBase(plain, { keyword: 'k', pageType: 'Service Page', country: 'X' }, RUN_INPUT)).toEqual({ keyword: 'k', pageType: 'Service Page', country: 'X', ladder: null });
    const h = holdOf(STOP_PAYLOAD)!;
    expect(holdFormBase(h, { keyword: 'k', pageType: 'Service Page', country: 'X' }, { ...RUN_INPUT, ladder: { ...RUN_INPUT.ladder, id: 'lad_other0001' } })).toEqual({ keyword: 'k', pageType: 'Service Page', country: 'X', ladder: null });
    expect(holdFormBase(h, { keyword: 'k', pageType: 'Service Page', country: 'X' }, { ...RUN_INPUT, pageType: 'Nonsense' }).pageType).toBe('Service Page');
  });
});
