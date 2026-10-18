import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { IntegrationsOverview, Me, Org, Role, Site } from '@seo/shared';
import { GuideProvider } from '@/components/guide';
import { TooltipProvider } from '@/components/ui/overlay';
import { IntegrationsTab, IntegrationsView, mcpSnippets } from '@/pages/settings/_components/integrations/IntegrationsTab';
import { TicketButton } from '@/components/site/TicketButton';
import { makeCan, OrgContext } from '@/lib/context';
import { qk } from '@/lib/queries';
import { ThemeProvider } from '@/lib/theme';
import { text } from './renderReport';

// G4 (app/docs/INTEGRATIONS.md): Company settings → Integrations and the "Create ticket" button, rendered with the contexts they
// really get. What must hold: every connector shows its state, no secret is ever on the page, a company that cannot store secrets is
// told so, a member sees no admin screen, and a finding with a ticket shows the ticket's key and state.

const ORG = 'org-g4';
const org = { id: ORG, name: 'Northwind', slug: 'northwind', industry: '', size: '1-10', website: 'northwind.example', monthlyBudgetUsd: 25, disabled: false, onboardingStep: 'done', onboardedAt: '2026-10-02T00:00:00.000Z', createdAt: '2026-10-02T00:00:00.000Z', role: 'owner' } as Org;
const me = { user: { id: 'u1', email: 'owner@example.org', name: 'Owner' }, orgs: [], platformAdmin: false } as unknown as Me;
const site = { id: 'site-1', orgId: ORG, domain: 'northwind.example' } as Site;

const overview = (over: Partial<IntegrationsOverview> = {}): IntegrationsOverview => ({
  secretsReady: true,
  appUrl: 'https://app.example.com',
  endpoints: [
    { id: 'ep-1', name: '#seo-alerts', format: 'slack', urlHost: 'hooks.slack.com', urlHint: 'Xk9z', hasSecret: false, events: ['alert.raised', 'run.failed'], websiteIds: [], enabled: true, disabledReason: '', consecutiveFailures: 0, createdAt: '2026-10-17T08:00:00.000Z', lastSuccessAt: '2026-10-17T09:00:00.000Z', lastFailureAt: null },
    { id: 'ep-2', name: 'Warehouse', format: 'json', urlHost: 'hooks.northwind.example', urlHint: 'ook1', hasSecret: true, events: ['rank.changed'], websiteIds: ['site-1'], enabled: false, disabledReason: 'hooks.northwind.example answered 410 Gone: the address was removed on their side.', consecutiveFailures: 1, createdAt: '2026-10-17T08:00:00.000Z', lastSuccessAt: null, lastFailureAt: '2026-10-17T09:00:00.000Z' },
  ],
  deliveries: [
    { id: 'd-1', endpointId: 'ep-1', endpointName: '#seo-alerts', eventId: 'e1', eventType: 'alert.raised', status: 'sent', attempts: 1, lastStatusCode: 200, lastError: '', createdAt: '2026-10-17T09:00:00.000Z', deliveredAt: '2026-10-17T09:00:01.000Z', nextAttemptAt: null },
    { id: 'd-2', endpointId: 'ep-2', endpointName: 'Warehouse', eventId: 'e2', eventType: 'rank.changed', status: 'gave_up', attempts: 2, lastStatusCode: 410, lastError: 'hooks.northwind.example answered 410', createdAt: '2026-10-17T09:00:00.000Z', deliveredAt: null, nextAttemptAt: null },
  ],
  integrations: [
    { id: 'i-1', kind: 'jira', name: 'Jira Cloud', config: { siteUrl: 'https://northwind.atlassian.net', projectKey: 'SEO', projectName: 'Website' }, secretHint: 'token …a1b2', status: 'ok', lastError: '', lastCheckedAt: '2026-10-17T09:00:00.000Z', lastRunAt: null, nextRunAt: null, createdAt: '2026-10-17T08:00:00.000Z' },
    { id: 'i-2', kind: 's3', name: 'R2', config: { provider: 'r2', bucket: 'nw-seo', prefix: 'alaventra', format: 'ndjson', tables: ['rank_history', 'runs'], schedule: 'daily', hour: 3 }, secretHint: 'key AKID…1234', status: 'ok', lastError: '', lastCheckedAt: null, lastRunAt: '2026-10-17T03:00:00.000Z', nextRunAt: '2026-10-18T03:00:00.000Z', createdAt: '2026-10-17T08:00:00.000Z' },
  ],
  exportRuns: [{ id: 'x-1', integrationId: 'i-2', trigger: 'schedule', status: 'ok', tables: [{ table: 'rank_history', rows: 120, bytes: 9000, object: 'alaventra/rank_history/dt=2026-10-17/rank_history-x-1.ndjson', truncated: false, error: '' }], startedAt: '2026-10-17T03:00:00.000Z', finishedAt: '2026-10-17T03:00:05.000Z', error: '' }],
  issues: [],
  ...over,
});

function render(node: ReactNode, role: Role = 'owner', seed?: (qc: QueryClient) => void) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  seed?.(qc);
  return text(
    renderToString(
      <ThemeProvider>
        <QueryClientProvider client={qc}>
          <TooltipProvider>
            <GuideProvider>
              <MemoryRouter>
                <OrgContext.Provider value={{ me, org: { ...org, role }, role, sites: [site], can: makeCan(role) }}>{node}</OrgContext.Provider>
              </MemoryRouter>
            </GuideProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>,
    ),
  );
}

describe('Company settings → Integrations', () => {
  it('shows every connector with its state, routing and logs', () => {
    const t = render(<IntegrationsView data={overview()} />);
    for (const s of ['Alerts and events', '#seo-alerts', 'Slack', 'Signed JSON', 'every website', 'northwind.example', 'answered 410 Gone', 'Delivery log', 'Gave up', 'Issue trackers', 'Jira Cloud', 'Website · token …a1b2', 'Linear', 'Asana', 'Data export', 'nw-seo/alaventra', 'Daily, 03:00 UTC', 'rank_history: 120 rows', 'Looker Studio', 'AI assistants (MCP)'])
      expect(t, s).toContain(s);
  });

  it('never shows a secret or a whole webhook address', () => {
    const t = render(<IntegrationsView data={overview()} />);
    expect(t).not.toMatch(/hooks\.slack\.com\/services/);
    expect(t).not.toMatch(/whsec_|ATATT|lin_api_[A-Za-z0-9]{6}/);
    expect(t).toContain('hooks.slack.com …Xk9z');
  });

  it('a server without the encryption key says nothing can be connected', () => {
    expect(render(<IntegrationsView data={overview({ secretsReady: false, endpoints: [], integrations: [], deliveries: [], exportRuns: [] })} />)).toContain('Connections cannot be stored on this server yet');
  });

  it('the AI-assistant snippets carry this app’s MCP address', () => {
    const s = mcpSnippets('https://app.example.com');
    expect(s.claudeCode).toContain('https://app.example.com/api/v1/mcp');
    expect(JSON.parse(s.claudeDesktop).mcpServers.alaventra.args).toContain('https://app.example.com/api/v1/mcp');
    expect(JSON.parse(s.openai)).toMatchObject({ type: 'mcp', require_approval: 'always' });
  });

  it('a member sees why, not the admin screen', () => {
    const t = render(<IntegrationsTab />, 'member');
    expect(t).toContain('Only owners and admins manage integrations');
    expect(t).not.toContain('Alerts and events');
  });
});

describe('Create ticket', () => {
  const src = { type: 'finding' as const, auditId: 'aud_1', findingKey: 'content|no h1' };
  const issues = (items: unknown[], trackers: unknown[]) => (qc: QueryClient) => qc.setQueryData([...qk.org(ORG), 'issues', 'site-1'], { items, trackers });

  it('nothing without a connected tracker', () => {
    expect(render(<TicketButton siteId="site-1" source={src} />, 'member', issues([], []))).toBe('');
  });
  it('a button once a tracker is connected', () => {
    expect(render(<TicketButton siteId="site-1" source={src} />, 'member', issues([], [{ kind: 'jira', name: 'Jira Cloud', target: 'Website', status: 'ok' }]))).toContain('Create ticket');
  });
  it('the ticket’s key and its state in the tracker once it exists — for a viewer too', () => {
    const issue = { id: 'l1', websiteId: 'site-1', kind: 'jira', sourceKey: 'finding:site-1:content|no h1', sourceTitle: 'Pages with no H1', remoteKey: 'SEO-42', remoteUrl: 'https://northwind.atlassian.net/browse/SEO-42', remoteStatus: 'In Review', remoteState: 'in_progress', status: 'created', createdAt: '', syncedAt: '' };
    const t = render(<TicketButton siteId="site-1" source={src} />, 'viewer', issues([issue], [{ kind: 'jira', name: 'Jira Cloud', target: 'Website', status: 'ok' }]));
    expect(t).toContain('SEO-42');
    expect(t).toContain('In Review');
    expect(t).not.toContain('Create ticket');
  });
  it('a viewer cannot create one', () => {
    expect(render(<TicketButton siteId="site-1" source={src} />, 'viewer', issues([], [{ kind: 'jira', name: 'Jira Cloud', target: 'Website', status: 'ok' }]))).toBe('');
  });
});
