import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { AiRankSettings, Me, Org, SiteTask } from '@seo/shared';
import { GuideProvider } from '@/components/guide';
import { TooltipProvider } from '@/components/ui/overlay';
import { AiRankingCard } from '@/components/site/AiRankingCard';
import { SiteTaskRow } from '@/components/site/SiteTasks';
import { makeCan, OrgContext, SiteContext } from '@/lib/context';
import { ThemeProvider } from '@/lib/theme';
import { text } from './renderReport';

// Review C (2026-11-06): RC-4 (a company owner sees AI ranking read-only while it is rolling out; a platform admin gets the editor), RC-9
// (no card at all when the engine does not store the setting), RC-3 (an AI ranking step checked on an address shows the address field).

const org = { id: 'org-1', name: 'Nova Works', slug: 'nova', role: 'owner' } as unknown as Org;
const site = { id: 'site-1', domain: 'novaand-demo.com', verifiedAt: '2026-11-01T00:00:00Z' };
const meOf = (platformAdmin: boolean) => ({ user: { id: 'u1', email: 'o@novaand-demo.com', name: 'Owner' }, orgs: [], platformAdmin }) as unknown as Me;
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
const S = (mode: AiRankSettings['mode']): AiRankSettings => ({ mode, reserve: false, fanoutN: 0, mentions: false, brave: false });

describe('the AI ranking card', () => {
  it('a company owner: read-only, the trial reads as Off, with the rolling-out note; no Save button', () => {
    const t = wrap(<AiRankingCard initial={S('shadow')} admin />);
    expect(t).toContain('AI ranking is rolling out to selected websites');
    expect(t).not.toContain('Save AI ranking');
    expect(t).not.toContain('Trial');
    expect(wrap(<AiRankingCard initial={S('on')} admin />)).toMatch(/On.*We act on the plan/);
  });
  it('a platform admin: the editor with Trial and the paid readings', () => {
    const t = wrap(<AiRankingCard initial={S('off')} admin />, true);
    expect(t).toContain('Save AI ranking');
    expect(t).toContain('Trial');
    expect(t).toContain('Paid readings');
  });
  it('an engine that does not store the setting: no card', () => {
    expect(wrap(<AiRankingCard initial={undefined} admin />, true)).not.toContain('AI ranking');
  });
});

describe('an AI ranking step checked on an address', () => {
  const task: SiteTask = {
    key: 'ai_rank:L12:p:aip_1', kind: 'ai_rank', state: 'todo', reopened: false, doneAt: null, lastCheck: null, severity: 'info',
    title: 'A LinkedIn article by a named person', detail: 'How we check it: paste its address below.', values: [], guide: 'ai-rank-earned-mention', guideVars: {}, skipped: null,
    address: { required: true, label: 'The address of your LinkedIn article', value: '' },
  };
  it('shows the address field beside "check now"', () => {
    const t = wrap(<ul><SiteTaskRow task={task} /></ul>);
    expect(t).toContain('The address of your LinkedIn article');
    expect(t).toContain("I've done it, check now");
  });
});
