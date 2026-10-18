import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Bell, Briefcase, Building2, Download, Globe, Plus, ShieldCheck, Users, Wallet } from 'lucide-react';
import { formatUsd, ROLE_LABELS, type AgencyClient, type AgencyOverviewRow, type Role } from '@seo/shared';
import { GuideButton } from '@/components/guide';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Callout, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Input, Select } from '@/components/ui/field';
import { Meter, PageHeader, scoreTone, StatTile } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/overlay';
import { DataTable, type Column } from '@/components/ui/table';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { agencyOverviewCsvUrl, useAgencyOverview, useAssignStaff, useClients, useClientStaff, useCreateClient, useEnableAgency } from '@/lib/queries';
import { fmtAgo } from '@/lib/utils';

/**
 * G5 (app/docs/WHITE_LABEL.md §1.6): an agency's clients — every client website in one table (health, rankings movement, clicks,
 * AI visibility, alerts, approvals waiting, spend against budget), the client workspaces with who of the agency can open them, and
 * a new client. A standard company sees what agency mode is and, as its owner, turns it on.
 */
export default function ClientsPage() {
  const { org } = useOrgCtx();
  if (org.kind !== 'agency') return <AgencyIntro />;
  return <AgencyClients />;
}

function AgencyIntro() {
  const { org, can } = useOrgCtx();
  const enable = useEnableAgency(org.id);
  return (
    <div>
      <PageHeader icon={<Briefcase />} title="Clients" description="Run your clients’ SEO from one place, under your own brand." />
      <Card>
        <EmptyState
          icon={<Briefcase className="size-5" />}
          title={org.kind === 'client' ? 'This is a client workspace' : 'Turn this company into an agency'}
          description={
            org.kind === 'client'
              ? 'Client workspaces belong to an agency; the agency manages its clients from its own Clients page.'
              : 'An agency holds a workspace per client — its own websites, budget and people — with your team switching between them, one table of every client website, client logins, your brand and your own portal address.'
          }
          action={
            org.kind === 'standard' && can('owner') ? (
              <Button loading={enable.isPending} onClick={() => enable.mutate(undefined, { onSuccess: () => toast.success(`${org.name} is now an agency`), onError: (e) => toast.error(errorMessage(e)) })}>
                Turn on agency mode
              </Button>
            ) : org.kind === 'standard' ? (
              <span className="text-sm text-ink-3">Only the owner can turn this on.</span>
            ) : undefined
          }
        />
      </Card>
    </div>
  );
}

const pct = (v: number | null) => (v == null ? '–' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`);

function AgencyClients() {
  const { org, can } = useOrgCtx();
  const admin = can('admin');
  const overview = useAgencyOverview(org.id);
  const clients = useClients(org.id);
  const [creating, setCreating] = useState(false);
  const [staffFor, setStaffFor] = useState<AgencyClient | null>(null);
  const rows = overview.data?.rows ?? [];
  const totals = useMemo(() => {
    const byClient = new Map<string, AgencyOverviewRow>();
    for (const r of rows) if (!byClient.has(r.clientId)) byClient.set(r.clientId, r);
    const spend = [...byClient.values()].reduce((t, r) => t + r.spentUsd, 0);
    const budget = [...byClient.values()].reduce((t, r) => t + r.budgetUsd, 0);
    return {
      clients: byClient.size,
      sites: rows.filter((r) => r.siteId).length,
      alerts: rows.reduce((t, r) => t + r.alerts14d, 0),
      approvals: rows.reduce((t, r) => t + r.approvalsWaiting, 0),
      spend,
      budget,
    };
  }, [rows]);

  const columns: Column<AgencyOverviewRow>[] = [
    {
      key: 'client',
      header: 'Client · website',
      sortValue: (r) => `${r.clientName} ${r.domain ?? ''}`.toLowerCase(),
      cell: (r) => (
        <span className="block min-w-0">
          <Link to={paths.org(r.clientId)} className="block truncate font-medium text-ink hover:text-accent-text hover:underline">
            {r.clientName}
          </Link>
          {r.domain && r.siteId ? (
            <Link to={paths.site(r.clientId, r.siteId)} className="block truncate text-xs text-ink-3 hover:text-accent-text">
              {r.domain}
              {!r.verified && ' · not verified'}
            </Link>
          ) : (
            <span className="block text-xs text-ink-3">No website yet</span>
          )}
        </span>
      ),
    },
    {
      key: 'health',
      header: 'Health',
      align: 'right',
      sortValue: (r) => r.healthScore ?? -1,
      cell: (r) =>
        r.healthScore == null ? (
          <span className="text-ink-3">–</span>
        ) : (
          <span className="inline-flex flex-col items-end">
            <StatusBadge tone={scoreTone(r.healthScore) === 'accent' ? 'neutral' : scoreTone(r.healthScore)}>{String(Math.round(r.healthScore))}</StatusBadge>
            {r.healthAt && <span className="mt-0.5 text-[11px] text-ink-3">{fmtAgo(r.healthAt)}</span>}
          </span>
        ),
    },
    {
      key: 'rank',
      header: 'Rankings',
      align: 'right',
      hideOnMobile: true,
      sortValue: (r) => (r.rankGains ?? 0) - (r.rankDrops ?? 0),
      cell: (r) =>
        r.rankGains == null && r.rankDrops == null ? (
          <span className="text-ink-3">–</span>
        ) : (
          <span className="tabular text-[13px]">
            <span className="text-good-text">▲ {r.rankGains ?? 0}</span> <span className="text-critical-text">▼ {r.rankDrops ?? 0}</span>
          </span>
        ),
    },
    { key: 'clicks', header: 'Clicks', align: 'right', hideOnMobile: true, sortValue: (r) => r.clicksPct ?? -1e9, cell: (r) => <span className="tabular">{pct(r.clicksPct)}</span> },
    {
      key: 'ai',
      header: 'AI visibility',
      align: 'right',
      hideOnMobile: true,
      sortValue: (r) => r.aiVisibility ?? r.aiMentionRate ?? -1,
      cell: (r) => <span className="tabular">{r.aiVisibility != null ? Math.round(r.aiVisibility) : r.aiMentionRate != null ? `${Math.round(r.aiMentionRate * 100)}%` : '–'}</span>,
    },
    {
      key: 'alerts',
      header: 'Alerts',
      align: 'right',
      sortValue: (r) => r.alerts14d + r.approvalsWaiting,
      cell: (r) => (
        <span className="inline-flex flex-wrap justify-end gap-1">
          {r.alerts14d > 0 && <StatusBadge tone="warning">{`${r.alerts14d} alert${r.alerts14d === 1 ? '' : 's'}`}</StatusBadge>}
          {r.approvalsWaiting > 0 && <Badge tone="accent">{`${r.approvalsWaiting} to approve`}</Badge>}
          {r.alerts14d === 0 && r.approvalsWaiting === 0 && <span className="text-ink-3">–</span>}
        </span>
      ),
    },
    {
      key: 'spend',
      header: 'Spend this month',
      align: 'right',
      hideOnMobile: true,
      sortValue: (r) => (r.budgetUsd ? r.spentUsd / r.budgetUsd : 0),
      cell: (r) => (
        <span className="inline-flex w-32 flex-col items-end gap-1">
          <span className="tabular text-[13px]">
            {formatUsd(r.spentUsd)} <span className="text-ink-3">of {formatUsd(r.budgetUsd, 0)}</span>
          </span>
          <Meter value={r.budgetUsd ? (r.spentUsd / r.budgetUsd) * 100 : 0} tone={r.budgetUsd && r.spentUsd / r.budgetUsd > 0.9 ? 'warning' : 'accent'} label={`Spend of ${r.clientName}`} />
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        icon={<Briefcase />}
        title="Clients"
        description="Every client’s websites in one table. Open a client to work in its workspace."
        actions={
          <>
            {admin && (
              <a href={agencyOverviewCsvUrl(org.id)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink-2 shadow-card transition-colors duration-150 ease-brand hover:bg-surface-2 hover:text-ink" download>
                <Download className="size-4" aria-hidden /> Export CSV
              </a>
            )}
            {admin && (
              <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
                New client
              </Button>
            )}
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Clients" value={String(totals.clients)} icon={<Building2 className="size-4" />} />
        <StatTile label="Websites" value={String(totals.sites)} icon={<Globe className="size-4" />} />
        <StatTile label="Alerts, last 14 days" value={String(totals.alerts)} icon={<Bell className="size-4" />} hint={totals.approvals ? `${totals.approvals} waiting for client approval` : undefined} />
        <StatTile label="Spend this month" value={formatUsd(totals.spend)} icon={<Wallet className="size-4" />} hint={`of ${formatUsd(totals.budget, 0)} in budgets`} />
      </div>
      {overview.isError ? (
        <Card>
          <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
        </Card>
      ) : !overview.data ? (
        <Skeleton className="h-72" />
      ) : rows.length ? (
        <Card className="mb-6">
          <CardBody>
            <DataTable rows={rows} columns={columns} rowKey={(r) => `${r.clientId}:${r.siteId ?? ''}`} initialSort={{ key: 'client', dir: 'asc' }} searchable={rows.length > 8} searchPlaceholder="Search clients and websites…" />
          </CardBody>
        </Card>
      ) : (
        <Card className="mb-6">
          <EmptyState
            icon={<Building2 className="size-5" />}
            title="No clients yet"
            description="Create a workspace for your first client, add their website, then invite their people to the portal."
            action={
              admin ? (
                <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
                  New client
                </Button>
              ) : undefined
            }
          />
        </Card>
      )}

      {clients.data && clients.data.clients.length > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
            <h2 className="font-display text-base font-semibold tracking-[-0.01em] text-ink">Client workspaces</h2>
            <GuideButton id="invite-clients" />
          </div>
          <ul className="divide-y divide-line px-5 pb-2">
            {clients.data.clients.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link to={paths.org(c.id)} className="font-medium text-ink hover:text-accent-text hover:underline">
                    {c.name}
                  </Link>
                  <p className="text-xs text-ink-3">
                    {c.sites} website{c.sites === 1 ? '' : 's'} · {c.clientPeople} client login{c.clientPeople === 1 ? '' : 's'} · your role {ROLE_LABELS[c.role].toLowerCase()}
                    {c.clientApproval && ' · approves before publishing'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {admin && (
                    <Button size="sm" variant="secondary" icon={<Users className="size-4" />} onClick={() => setStaffFor(c)}>
                      Team access
                    </Button>
                  )}
                  <Link to={paths.settings(c.id, 'team')} className="inline-flex h-8 items-center rounded-md px-2.5 text-[13px] font-medium text-accent-text hover:bg-accent-soft">
                    Client logins
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <NewClientDialog open={creating} onOpenChange={setCreating} />
      <StaffDialog client={staffFor} onClose={() => setStaffFor(null)} />
    </div>
  );
}

function NewClientDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { org } = useOrgCtx();
  const create = useCreateClient(org.id);
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('25');
  const [website, setWebsite] = useState('');
  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setName('');
      setWebsite('');
      create.reset();
    }
  };
  const submit = () =>
    create.mutate(
      { name: name.trim(), monthlyBudgetUsd: Number(budget) || 0, website: website.trim() },
      {
        onSuccess: (c) => {
          toast.success(`${c.name} created`);
          close(false);
        },
      },
    );
  const fields: Record<string, string> = create.error instanceof ApiRequestError ? create.error.fields : {};
  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="New client"
      description="A workspace of its own: websites, budget, reports and the client’s logins. Your owners and admins reach it at once."
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button type="submit" form="new-client" loading={create.isPending} disabled={name.trim().length < 2}>
            Create client
          </Button>
        </>
      }
    >
      <form
        id="new-client"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        noValidate
      >
        <Field label="Client name" error={fields.name}>
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Trading" autoFocus maxLength={120} />}
        </Field>
        <Field label="Monthly budget (USD)" hint="The most this client’s analyses may cost a month." error={fields.monthlyBudgetUsd}>
          {(p) => <Input {...p} type="number" min={0} step={1} value={budget} onChange={(e) => setBudget(e.target.value)} />}
        </Field>
        <Field label="Website" optional hint="You add and verify the website inside the workspace.">
          {(p) => <Input {...p} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="acme.com" />}
        </Field>
        {create.isError && !Object.keys(fields).length && <Callout tone="critical">{errorMessage(create.error)}</Callout>}
      </form>
    </Dialog>
  );
}

const ACCESS_CHOICES: { value: '' | 'viewer' | 'member' | 'admin'; label: string }[] = [
  { value: '', label: 'No access' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin' },
];

function StaffDialog({ client, onClose }: { client: AgencyClient | null; onClose: () => void }) {
  const { org } = useOrgCtx();
  const staff = useClientStaff(org.id, client?.id ?? null);
  const assign = useAssignStaff(org.id, client?.id ?? '');
  return (
    <Dialog
      open={!!client}
      onOpenChange={(o) => !o && onClose()}
      title={`Team access to ${client?.name ?? ''}`}
      description="Owners and admins of the agency reach every client. Give members and viewers the clients they work on."
      wide
      footer={<Button onClick={onClose}>Done</Button>}
    >
      {staff.isError ? (
        <ErrorState error={staff.error} />
      ) : !staff.data ? (
        <Skeleton className="h-40" />
      ) : (
        <ul className="divide-y divide-line">
          {staff.data.staff.map((s) => (
            <li key={s.userId} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{s.name}</p>
                <p className="truncate text-xs text-ink-3">
                  {s.email} · {ROLE_LABELS[s.agencyRole]} of the agency
                </p>
              </div>
              {s.access === 'inherited' ? (
                <Badge icon={<ShieldCheck className="size-3" aria-hidden />}>{`${ROLE_LABELS[s.role as Role]}, every client`}</Badge>
              ) : (
                <div className="w-36">
                  <Select
                    aria-label={`Access of ${s.name} to ${client?.name ?? 'this client'}`}
                    value={s.role ?? ''}
                    disabled={assign.isPending}
                    onChange={(e) =>
                      assign.mutate(
                        { userId: s.userId, role: (e.target.value || null) as 'admin' | 'member' | 'viewer' | null },
                        { onSuccess: () => toast.success(`Access of ${s.name} updated`), onError: (err) => toast.error(errorMessage(err)) },
                      )
                    }
                    className="h-8 text-[13px]"
                  >
                    {ACCESS_CHOICES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
