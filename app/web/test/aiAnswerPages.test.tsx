import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { AI_CLIENT_TEXT_BANNED, aiTargetView, type AiGrowth, type AiTargetStat, type Me, type Org } from '@seo/shared';
import { GuideProvider } from '@/components/guide';
import { TooltipProvider } from '@/components/ui/overlay';
import { AiGrowthSection } from '@/pages/site/_components/ai-growth';
import { AiRankActionList } from '@/pages/site/_components/ai-rank';
import { makeCan, OrgContext, SiteContext } from '@/lib/context';
import { ThemeProvider } from '@/lib/theme';
import { text } from './renderReport';

// Client report 2026-11-16 (devaicon.com, issue 1, F11): the AI visibility page showed `set_aside`, "cad_20261113_devaicon-com_2",
// "seo_content_log row" and "AI ranking (L06): ... expected gain 0.0119 over $9.63 (client time at $25 an hour)". The panel now renders the
// server's plain state; the engine's note is for platform admins only, behind a disclosure.

const org = { id: 'org-1', name: 'Devaicon', slug: 'devaicon', role: 'owner' } as unknown as Org;
const site = { id: 'site-1', domain: 'devaicon.com', country: 'United Arab Emirates', verifiedAt: '2026-11-01T00:00:00Z' };
const meOf = (platformAdmin: boolean) => ({ user: { id: 'u1', email: 'o@devaicon.com', name: 'Owner' }, orgs: [], platformAdmin }) as unknown as Me;
const wrap = (node: ReactNode, platformAdmin = false) =>
  text(
    renderToString(
      <ThemeProvider>
        <QueryClientProvider client={new QueryClient()}>
          <TooltipProvider>
            <GuideProvider>
              <MemoryRouter>
                <OrgContext.Provider value={{ me: meOf(platformAdmin), org, role: 'owner', sites: [], can: makeCan('owner') }}>
                  <SiteContext.Provider value={{ site } as never}>{node}</SiteContext.Provider>
                </OrgContext.Provider>
              </MemoryRouter>
            </GuideProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>,
    ),
  );
const RAW41 = 'a page run (cad_20261113_devaicon-com_2) was started on 2026-11-13; nothing has been written yet — this row moves to "written" only against a seo_content_log row for that run';
const RAWAIR = 'AI ranking (L06): Refresh the ranking page for the searches the engines run: 5 cell(s), expected gain 0.0119 over $9.63 (client time at $25 an hour), typical 30 days';
// what the server sends (data.ts targetStat): the plain view, and the engine's text only to a platform admin
const stat = (o: Partial<AiTargetStat>, raw: string, admin: boolean, logs: Parameters<typeof aiTargetView>[1] = []): AiTargetStat => {
  const base = { targetId: o.targetId ?? 't', question: o.question ?? 'Q?', keyword: o.keyword ?? 'k', kind: o.kind ?? 'answer', pageUrl: o.pageUrl ?? '', pageType: 'Guide', fanout: [], sources: [], competitors: [], stage: '', value: 1, status: o.status ?? 'queued', reason: '', writtenAt: '', wonAt: '', updatedAt: '2026-11-13T01:28:00Z' } as AiTargetStat;
  const v = aiTargetView({ status: base.status, kind: base.kind, keyword: base.keyword, pageUrl: base.pageUrl, reason: raw, requestId: o.status === 'writing' ? 'cad_20261113_devaicon-com_2' : '', updatedAt: base.updatedAt, origin: /^AI ranking/.test(raw) ? 'ai_rank' : '' }, logs);
  return { ...base, reason: v.sentence, state: v.state, badge: v.badge, tone: v.tone, statePageUrl: v.pageUrl, viaLadder: v.viaLadder, hidden: v.hidden, ...(admin ? { adminReason: raw } : {}) };
};
const growth = (admin: boolean): AiGrowth => ({
  checkedAt: '2026-11-13T09:00:00Z',
  submitted: { bing: { enabled: true, inAccount: true, submitted: 0, quota: null, error: '' }, indexnow: { keyUrl: '', key: '', verified: true, submitted: 0, error: '' } },
  pagesChecked: 0, avgScore: null, pages: [], earned: [], entity: null, actions: [], alerts: [], pagesPerMonth: 2, writtenThisMonth: 1,
  targets: [
    stat({ targetId: 't41', question: 'Governed vs autonomous AI agents: which is safer?', keyword: 'governed vs autonomous ai agents', status: 'writing' }, RAW41, admin, [
      { keyword: 'governed vs autonomous ai agents', request_id: 'cad_20261113_devaicon-com_2', status: 'published', published_url: 'https://devaicon.com/insights/governed-vs-autonomous-ai-agents', published_at: '2026-11-13T11:08:00Z', source: 'ai_answer' },
    ]),
    stat({ targetId: 't42', question: 'Which AI project engagement model fits a startup?', keyword: 'ai project engagement models', status: 'set_aside' }, 'not a search this website should target: 0% of its own words match (25% is the bar): project. (off topic)', admin),
    stat({ targetId: 't36', question: 'Which companies offer the best AI automation services in Dubai?', keyword: 'best ai automation services dubai', kind: 'refresh', pageUrl: 'https://devaicon.com/ai-automation-services-pakistan', status: 'queued' }, RAWAIR, admin),
  ],
});

describe('Questions to win, as the client reads it', () => {
  it('no internal ids, table names, lever ids, money or raw statuses; a live page shows as published', () => {
    const t = wrap(<AiGrowthSection growth={growth(false)} inputs={{ targets: growth(false).targets, market: 'United Arab Emirates' }} />);
    expect(t).toContain('Published');
    expect(t).toContain('Not for this website');
    expect(t).toContain('Chosen by AI ranking');
    expect(t).not.toContain('Being written');
    expect(t).not.toContain('set_aside');
    expect(t).not.toContain('Engine note');
    for (const re of AI_CLIENT_TEXT_BANNED) expect(t, String(re)).not.toMatch(re);
    // the queued refresh offers "Improve the page", the live and the set-aside ones offer nothing to write
    expect(t.match(/Improve the page/g)?.length).toBe(1);
    expect(t).not.toContain('Write it now');
  });
  it('a platform admin can open the engine\'s own note', () => {
    const t = wrap(<AiGrowthSection growth={growth(true)} inputs={{ targets: growth(true).targets }} />, true);
    expect(t).toContain('Engine note (platform admins only)');
    expect(t).toContain('cad_20261113_devaicon-com_2');
  });
});

describe('the AI ranking steps', () => {
  const action = { actionId: '', lever: 'L06', label: 'Refresh the page that ranks for the question', executor: 'auto' as const, status: 'queued', sink: '', scope: '', questions: [], engines: [], targetStage: '', why: '', url: 'https://devaicon.com/x' };
  it('a client reads no engine note; a platform admin finds it behind a disclosure', () => {
    expect(wrap(<AiRankActionList actions={[action]} />)).not.toContain('Engine note');
    const t = wrap(<AiRankActionList actions={[{ ...action, why: RAWAIR }]} rawWhy />, true);
    expect(t).toContain('Engine note (platform admins only)');
  });
});
