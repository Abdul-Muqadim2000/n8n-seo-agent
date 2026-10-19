import { Bot, KeyRound, LineChart } from 'lucide-react';
import { Link } from 'react-router';
import type { IntegrationsOverview } from '@seo/shared';
import { CardBody } from '@/components/ui/card';
import { Callout, ErrorState, Skeleton } from '@/components/ui/feedback';
import { CopyButton } from '@/components/ui/misc';
import { GuideButton } from '@/components/guide';
import { useOrgCtx } from '@/lib/context';
import { useIntegrations } from '@/lib/integrations';
import { paths } from '@/lib/paths';
import { SettingsCard } from '../SettingsCard';
import { ExportsCard } from './ExportsCard';
import { TrackersCard } from './TrackersCard';
import { WebhooksCard } from './WebhooksCard';

/**
 * G4 (2026-10-17, app/docs/INTEGRATIONS.md) — Company settings → Integrations: alerts and events to Slack / Teams / your systems,
 * issue trackers, the warehouse export, and how to connect Looker Studio and AI assistants. Owners and admins only: every one of
 * these sends the company's data out of the app or writes into its tools.
 */

export const mcpSnippets = (appUrl: string) => ({
  claudeCode: `claude mcp add --transport http alaventra ${appUrl}/api/v1/mcp --header "Authorization: Bearer asc_..."`,
  claudeDesktop: JSON.stringify(
    { mcpServers: { alaventra: { command: 'npx', args: ['-y', 'mcp-remote', `${appUrl}/api/v1/mcp`, '--header', 'Authorization:${ALAVENTRA_AUTH}'], env: { ALAVENTRA_AUTH: 'Bearer asc_...' } } } },
    null,
    2,
  ),
  openai: JSON.stringify({ type: 'mcp', server_label: 'alaventra', server_url: `${appUrl}/api/v1/mcp`, headers: { Authorization: 'Bearer asc_...' }, require_approval: 'always' }, null, 2),
});

function Snippet({ label, code }: { label: string; code: string }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-ink-2">{label}</span>
        <CopyButton text={code} label="Copy" />
      </div>
      <pre className="max-w-full overflow-x-auto rounded-md border border-line bg-surface-2 p-3 font-mono text-xs leading-relaxed text-ink">{code}</pre>
    </div>
  );
}

export function ConnectToolsCard({ data }: { data: IntegrationsOverview }) {
  const { org } = useOrgCtx();
  const s = mcpSnippets(data.appUrl);
  return (
    <>
      <SettingsCard
        icon={<LineChart />}
        title="Looker Studio"
        description="Chart your rankings, Search Console and GA4 figures, audit findings, AI visibility and backlinks next to the rest of your reporting."
        actions={<GuideButton id="looker-studio-connector" vars={{ appUrl: data.appUrl }} />}
      >
        <CardBody className="space-y-2 text-sm text-ink-2">
          <p>
            Alaventra’s Looker Studio connector reads the same tables as the data export, one website at a time, with a read-only API key. Create the key under{' '}
            <Link to={paths.settings(org.id, 'api')} className="font-medium text-accent-text hover:underline">
              API access
            </Link>{' '}
            (only “Read”), then follow the guide to add the connector.
          </p>
          <p className="text-ink-3">Your app address for the connector: <code className="font-mono">{data.appUrl}</code></p>
        </CardBody>
      </SettingsCard>
      <SettingsCard
        icon={<Bot />}
        title="AI assistants (MCP)"
        description="Ask Claude or ChatGPT about your SEO data, and let them start analyses with the company’s credits."
        info="A key with only “Read” lets an assistant read. A key with “Start analyses” also lets it start runs: it must preview the price in credits first and may not accept a duplicate warning you have not seen. Every run it starts shows the key’s name."
        actions={<GuideButton id="mcp-assistant" vars={{ appUrl: data.appUrl }} />}
      >
        <CardBody className="space-y-4">
          <Snippet label="Claude Code" code={s.claudeCode} />
          <Snippet label="Claude Desktop (claude_desktop_config.json)" code={s.claudeDesktop} />
          <Snippet label="OpenAI Responses API / Agents SDK (tools)" code={s.openai} />
          <p className="flex items-center gap-1.5 text-[13px] text-ink-3">
            <KeyRound className="size-3.5" aria-hidden /> Replace asc_... with a key from API access.
          </p>
        </CardBody>
      </SettingsCard>
    </>
  );
}

export function IntegrationsView({ data }: { data: IntegrationsOverview }) {
  return (
    <div className="max-w-4xl space-y-5">
      {!data.secretsReady && (
        <Callout tone="warning" title="Connections cannot be stored on this server yet">
          Every token and address is kept encrypted, and this server has no encryption key set (MAILBOX_KEY). Ask the platform administrator to set it; until then nothing can be connected.
        </Callout>
      )}
      <WebhooksCard data={data} />
      <TrackersCard data={data} />
      <ExportsCard data={data} />
      <ConnectToolsCard data={data} />
    </div>
  );
}

export function IntegrationsTab() {
  const { org, can } = useOrgCtx();
  const admin = can('admin');
  const q = useIntegrations(org.id, admin);
  if (!admin)
    return (
      <Callout tone="info" title="Only owners and admins manage integrations">
        Ask an owner or admin of {org.name} to connect Slack, Teams, your issue tracker or a data export. Once a tracker is connected you can send findings to it from the Technical page.
      </Callout>
    );
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (q.isLoading || !q.data) return <Skeleton className="h-96" />;
  return <IntegrationsView data={q.data} />;
}
