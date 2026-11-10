import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { ComingUpItem, ComingUpView, Me, Org, Site } from '@seo/shared';
import { approveToast, ComingUp, ComingUpSummary, comingUpHeading, pileupBanner, resultLine, type LiveQueue } from '@/pages/site/_components/pipeline/coming-up';
import { qk } from '@/lib/queries';
import { makeCan, OrgContext, SiteContext } from '@/lib/context';
import { GuideProvider } from '@/components/guide';
import { TooltipProvider } from '@/components/ui/overlay';
import { ThemeProvider } from '@/lib/theme';
import { text } from './renderReport';

// I3 (2026-11-10, devaicon.com): "I approved the weekly item but it still shows wait; wait for what? It shows I approved it and shows a
// past date." The card of the 11-06 run, seen on Tuesday 11-10: it must say the run is done, what it wrote and when the next plan comes,
// keep the approval out of "Waits for your OK", tick only a page that was written, and drop the plan-time pile-up banner.

const ORG = 'org-i3';
const me = { user: { id: 'u1', email: 'client@devaicon.com', name: 'Client' }, orgs: [{ id: ORG, name: 'Devaicon', role: 'owner' }], platformAdmin: false } as unknown as Me;
const org = { id: ORG, name: 'Devaicon', slug: 'devaicon', industry: '', size: '1-10', website: 'devaicon.com', monthlyBudgetUsd: 25, disabled: false, onboardingStep: 'done', onboardedAt: null, createdAt: '2026-10-01T00:00:00.000Z', role: 'owner' } as Org;
const site = {
  id: '6a1f0d2e-1111-4c1d-9a8b-0c1d2e3f4a5b', orgId: ORG, domain: 'devaicon.com', n8nSiteId: 'site_devaicon-com', country: 'United Arab Emirates', business: 'AI development', customers: '', goal: 'leads', tone: '', cta: '',
  businessFacts: '', competitors: [], brandNames: [], keywords: [], ga4PropertyId: '', gscProperty: '', blogsPerWeek: 0, verifiedAt: '2026-10-01T00:00:00.000Z', verificationMethod: 'dns', trackingStatus: 'active',
  trackingStartedAt: '2026-10-02T00:00:00.000Z', createdAt: '2026-10-01T00:00:00.000Z', timezone: 'Asia/Karachi', services: [], cycleWeekday: 5, autopilotLevel: 2,
} as unknown as Site;

const SUGGESTION = 'ai industrial automation pakistan';
const approvedItem = (o: Partial<ComingUpItem> = {}): ComingUpItem => ({
  itemKey: SUGGESTION, keyword: SUGGESTION, source: 'ai_refresh', pageType: 'Guide', existingPageUrl: 'https://devaicon.com/insights/ai-in-industrial-automation', ladderId: '', rung: 0,
  why: 'AI answers this question without you', auto: false, credits: 80, aiTarget: null, decision: { decision: 'approve', scope: 'cycle', by: 'client@devaicon.com', at: '2026-11-05T15:45:00.000Z' },
  canSkip: false, canApprove: false, recheck: false, held: false, ...o,
});
const view = (o: Partial<ComingUpView> = {}): ComingUpView => ({
  available: true, cycleKey: 'cyc:site_devaicon-com:2026-11-06', cycleDate: '2026-11-06', scheduledFor: '2026-11-06T01:00:00.000Z', receivedAt: '2026-11-04T01:03:00.000Z', level: 2, pagesPerWeek: 2,
  waitingForKeyword: false, pausedReason: 'pileup', reason: '3 written pages are waiting to be published (limit 3)', items: [], suggestions: [approvedItem({ result: { state: 'not_written', at: null, reportId: null, message: 'Not written in that run.' } })],
  refused: [], autoCredits: 0, canDecide: true, closed: true, approvedNotWritten: [], recheckLadders: [], budget: null, waitingForProfile: false, missingText: '',
  phase: 'done',
  outcome: { known: true, at: '2026-11-06T01:28:15.000Z', pages: [{ keyword: 'ai app development companies', source: 'ladder', approved: false, state: 'written', at: '2026-11-06T01:46:19.000Z', reportId: 'rep-page-1' }], pausedReason: '', waitingPublish: 1, note: '' },
  nextPreviewAt: '2026-11-11T01:00:00.000Z', nextDueAt: '2026-11-13T01:00:00.000Z',
  ...o,
});
// the live state on Tuesday: one page waits (it needs a fix), the limit is 3, so no pile-up
const liveNow: LiveQueue = { paused: null, waiting: [{ keyword: 'ai automation services', startedAt: '2026-11-10T14:54:00.000Z', days: 0, needsFix: true }] };

function render(node: ReactNode, v: ComingUpView, role: 'owner' | 'viewer' = 'owner') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(qk.me, me);
  qc.setQueryData(qk.org(ORG), org);
  qc.setQueryData(qk.sites(ORG), [site]);
  qc.setQueryData(qk.siteData(site.id, 'coming-up'), v);
  return text(
    renderToString(
      <ThemeProvider>
        <QueryClientProvider client={qc}>
          <TooltipProvider>
            <GuideProvider>
              <MemoryRouter>
                <OrgContext.Provider value={{ me, org: { ...org, role }, role, sites: [site], can: makeCan(role) }}>
                  <SiteContext.Provider value={{ site }}>{node}</SiteContext.Provider>
                </OrgContext.Provider>
              </MemoryRouter>
            </GuideProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>,
    ),
  );
}

const fmt = (iso: string) => new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Karachi' }).format(new Date(iso));

describe('I3: the card of a run that is done', () => {
  it('the devaicon.com card on Tuesday: "Last weekly run", what it wrote, the next plan and run; the approval in its own group, not written, no tick, no banner', () => {
    const t = render(<ComingUp queue={liveNow} onWrite={() => undefined} />, view());
    expect(t).toMatch(/Last weekly run: Friday,? (6 November|November 6)/);
    expect(t).not.toContain('Coming up on');
    expect(t).toContain('It wrote 1 page: "ai app development companies".');
    expect(t).toMatch(/Your next plan arrives on Wednesday,? (11 November|November 11), two days before the run on Friday,? (13 November|November 13)\./);
    expect(t).toContain('Written in this run');
    expect(t).toContain('Open the page');
    expect(t).toContain('Approved by you');
    expect(t).not.toContain('Waits for your OK');
    expect(t).toContain('Not written');
    expect(t).toContain('Not written in that run.');
    expect(t).toContain('Write it now');
    expect(t).not.toContain('Writing is paused');
    expect(t).not.toMatch(/—|…|[“”]/);
  });
  it('the green tick is drawn only for pages that were written', () => {
    const notWritten = renderToStringCount(view({ outcome: { ...view().outcome!, pages: [] } }));
    expect(notWritten).toBe(0);
    const written = renderToStringCount(view({ outcome: { ...view().outcome!, pages: [] }, suggestions: [approvedItem({ result: { state: 'written', at: '2026-11-06T01:50:00.000Z', reportId: 'rep-2', message: '' } })] }));
    expect(written).toBe(1);
  });
  it('the reason the engine gives (no_longer_offered) shows on the row', () => {
    const msg = `Your OK for "${SUGGESTION}" was not used: the question left your AI panel because it is about Pakistan and your market is the UAE. Use Write it now if you still want this page.`;
    const t = render(<ComingUp queue={liveNow} />, view({ suggestions: [approvedItem({ result: { state: 'not_written', at: null, reportId: null, message: msg } })] }));
    expect(t).toContain(msg);
  });
  it('a run that wrote nothing because pages waited, or with no report of it, says so plainly', () => {
    const fmtd = (v: ComingUpView) => comingUpHeading(v, 'Friday 6 November', 'Friday', fmt).description;
    expect(fmtd(view({ outcome: { known: true, at: null, pages: [], pausedReason: 'pileup', waitingPublish: 3, note: '' } }))).toMatch(/^It wrote nothing new: 3 pages waited to be published\. Your next plan/);
    expect(fmtd(view({ outcome: { known: false, at: null, pages: [], pausedReason: '', waitingPublish: 0, note: '' } }))).toMatch(/^What it wrote is on Content and under Reports\./);
    expect(fmtd(view({ outcome: { known: true, at: null, pages: [], pausedReason: '', waitingPublish: 0, note: 'Nothing left to write this week' } }))).toMatch(/^It wrote nothing: nothing left to write this week\./);
    expect(fmtd(view({ nextPreviewAt: null, nextDueAt: null }))).toMatch(/The next plan arrives two days before the next run\.$/);
  });
  it('a running run says so and shows no banner; the Overview line stays hidden once the run started', () => {
    const running = view({ phase: 'running', outcome: null, suggestions: [approvedItem()] });
    const t = render(<ComingUp queue={liveNow} />, running);
    expect(t).toMatch(/Running now: the weekly run of Friday/);
    expect(t).toContain('This weekly run has started');
    expect(t).toContain('Approved by you');
    expect(t).not.toContain('Writing is paused');
    expect(render(<ComingUpSummary />, running)).toBe('');
  });
});

describe('I3: the card of a run still to come', () => {
  const upcoming = (o: Partial<ComingUpView> = {}) => view({ phase: 'upcoming', closed: false, outcome: null, suggestions: [approvedItem({ canSkip: true, result: undefined })], ...o });
  it('an approval is never under "Waits for your OK"; skipped items go under "Skipped"', () => {
    const skipped = approvedItem({ itemKey: 'b', keyword: 'crm for clinics', decision: { decision: 'skip', scope: 'cycle', by: 'x', at: '' }, canApprove: true, canSkip: true });
    const waiting = approvedItem({ itemKey: 'c', keyword: 'erp for schools', decision: null, canApprove: true, canSkip: true });
    const t = render(<ComingUp queue={liveNow} />, upcoming({ suggestions: [approvedItem({ canSkip: true, result: undefined }), skipped, waiting] }));
    const at = (s: string) => t.indexOf(s);
    expect(at('Approved by you')).toBeGreaterThan(-1);
    expect(at('Approved by you')).toBeLessThan(at(SUGGESTION));
    expect(at('Waits for your OK')).toBeGreaterThan(at(SUGGESTION));
    expect(at('Waits for your OK')).toBeLessThan(at('erp for schools'));
    expect(at('Skipped')).toBeLessThan(at('crm for clinics'));
    expect(at('Skipped')).toBeGreaterThan(at('erp for schools'));
  });
  it('the banner follows the live state: none when the pile-up is over (it says so), the waiting pages named when it holds', () => {
    expect(pileupBanner(upcoming(), liveNow)).toEqual({ tone: 'info', title: 'No pages wait to be published any more', body: 'This run is not paused: it picks its pages when it starts.' });
    const held: LiveQueue = { paused: { reason: 'pileup', waiting: 3, max: 3 }, waiting: [{ keyword: 'a', startedAt: '', days: 3 }, { keyword: 'b', startedAt: '', days: 2 }, { keyword: 'ai automation services', startedAt: '', days: 0, needsFix: true }] };
    expect(pileupBanner(upcoming(), held)).toEqual({
      tone: 'warning',
      title: 'Writing is paused: 3 pages wait to be published',
      body: '"a", "b", "ai automation services" (needs a fix). Your limit is 3. Publish them, or fix the ones that need a fix, and the weekly pages continue.',
    });
    expect(pileupBanner(upcoming({ pausedReason: '' }), liveNow)).toBeNull();
    expect(pileupBanner(upcoming(), undefined)?.title).toBe('Writing is paused: pages wait to be published');
    expect(pileupBanner(view(), held)).toBeNull();
    expect(pileupBanner(view({ phase: 'running' }), held)).toBeNull();
    const t = render(<ComingUp queue={held} />, upcoming());
    expect(t).toContain('Writing is paused: 3 pages wait to be published');
    expect(t).toContain('Written once the pages that wait are published');
  });
  it('the approve toast never promises "this run" while writing is paused', () => {
    expect(approveToast('x', false)).toEqual({ title: '"x" will be written in this run' });
    expect(approveToast('x', true).title).toBe('"x" is approved: it is written once the pages that wait are published');
    expect(approveToast('x', true).description).toMatch(/approve it again in the next plan/);
  });
  it('an older server (no phase) keeps the old titles', () => {
    const old = upcoming({ phase: undefined });
    expect(comingUpHeading(old, 'Friday 6 November', 'Friday', fmt).title).toBe('Coming up on Friday 6 November');
    expect(comingUpHeading({ ...old, closed: true }, 'Friday 6 November', 'Friday', fmt).title).toBe('Running now: the weekly run of Friday 6 November');
  });
  it('result lines in plain words', () => {
    expect(resultLine({ state: 'written', at: '', reportId: 'r', message: '' }, 'Friday 6 November')).toBe('Written on Friday 6 November.');
    expect(resultLine({ state: 'started', at: '', reportId: null, message: '' }, '')).toBe('Started in that run: the page arrives under Reports when it is ready.');
    expect(resultLine({ state: 'not_written', at: null, reportId: null, message: '' }, '')).toBe('Not written in that run.');
  });
});

/** How many green ticks the done card draws (the tick is the only text-good-text icon sized size-4). */
function renderToStringCount(v: ComingUpView): number {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData(qk.me, me);
  qc.setQueryData(qk.org(ORG), org);
  qc.setQueryData(qk.sites(ORG), [site]);
  qc.setQueryData(qk.siteData(site.id, 'coming-up'), v);
  const html = renderToString(
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          <GuideProvider>
            <MemoryRouter>
              <OrgContext.Provider value={{ me, org, role: 'owner', sites: [site], can: makeCan('owner') }}>
                <SiteContext.Provider value={{ site }}>
                  <ComingUp queue={liveNow} />
                </SiteContext.Provider>
              </OrgContext.Provider>
            </MemoryRouter>
          </GuideProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return (html.match(/class="[^"]*size-4 text-good-text[^"]*"/g) ?? []).length;
}
