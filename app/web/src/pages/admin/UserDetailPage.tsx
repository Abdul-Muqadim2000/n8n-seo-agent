import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, Play, UserX, Wallet } from 'lucide-react';
import { ADMIN_ROLES } from '@seo/shared';
import { CountUp, MetricCard, Stagger } from '@/components/insight';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Select } from '@/components/ui/field';
import { Avatar, KeyValue } from '@/components/ui/misc';
import { type Column } from '@/components/ui/table';
import { pageTitle } from '@/components/layout/Brand';
import { useDocumentTitle } from '@/components/layout/useDocumentTitle';
import { toastError } from '@/lib/api';
import { useAdminRemoveMembership, useAdminRuns, useAdminSetMembership, useAdminUsers, useMe } from '@/lib/queries';
import { fmtAgo, fmtDate, fmtDateTime } from '@/lib/utils';
import { useAdminPeriod } from './AdminLayout';
import { AdminCard, ConfirmDialog, FlushTable, Num, SplitLine } from './_components/kit';
import { RunsTable } from './_components/runs';
import { roleLabel, UserActions, UserFlags, type AdminRole } from './_components/users';
import { adminPaths, money, PERIOD_LABELS, withPeriod } from './lib';

type Membership = { id: string; name: string; role: string };

export default function AdminUserDetailPage() {
  const { userId = '' } = useParams();
  const [period] = useAdminPeriod();
  const navigate = useNavigate();
  const users = useAdminUsers(period);
  const user = useMemo(() => users.data?.find((u) => u.id === userId), [users.data, userId]);
  const me = useMe();
  const setRole = useAdminSetMembership();
  const remove = useAdminRemoveMembership();
  const [removing, setRemoving] = useState<Membership | null>(null);
  const runs = useAdminRuns({ period, q: user?.email, limit: 20 }, !!user);
  useDocumentTitle(pageTitle(user?.name ?? 'User', 'Platform admin'));

  const back = (
    <Link to={withPeriod(adminPaths.users, period)} className="group mb-4 inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-ink-3 transition-colors hover:text-ink">
      <ArrowLeft className="size-4 transition-transform duration-200 ease-brand group-hover:-translate-x-0.5" aria-hidden />
      Users
    </Link>
  );
  if (users.isPending)
    return (
      <div className="space-y-6" aria-busy>
        <Skeleton className="h-16 w-80" />
        <Skeleton className="h-64" />
      </div>
    );
  if (users.isError)
    return (
      <>
        {back}
        <Card>
          <ErrorState titleAs="h1" error={users.error} onRetry={() => users.refetch()} title="Could not load this person" />
        </Card>
      </>
    );
  if (!user)
    return (
      <>
        {back}
        <Card>
          <EmptyState titleAs="h1" icon={<UserX className="size-5" />} title="No such user" description="The account was deleted, or the link is wrong." />
        </Card>
      </>
    );

  const self = me.data?.user.id === user.id;
  const cols: Column<Membership>[] = [
    {
      key: 'name',
      header: 'Company',
      sortValue: (c) => c.name.toLowerCase(),
      cell: (c) => (
        <Link to={withPeriod(adminPaths.company(c.id), period)} className="font-medium hover:text-accent-text">
          {c.name}
        </Link>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (c) => (
        <div className="w-[118px]">
        <Select
          aria-label={`Role in ${c.name}`}
          value={c.role}
          disabled={setRole.isPending}
          className="h-8 text-[13px]"
          onChange={(e) => {
            // read the choice now: the controlled select falls back to the stored role before the answer arrives
            const role = e.target.value as AdminRole;
            setRole.mutate(
              { userId: user.id, orgId: c.id, role },
              { onSuccess: () => toast.success(`${user.name} is now ${roleLabel(role)} in ${c.name}`), onError: (err) => toastError(err) },
            );
          }}
        >
          {ADMIN_ROLES.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </Select>
        </div>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (c) => (
        <Button variant="ghost" size="sm" onClick={() => setRemoving(c)} disabled={self} aria-label={`Remove ${user.name} from ${c.name}`}>
          Remove
        </Button>
      ),
    },
  ];
  const runRows = runs.data?.pages.flatMap((p) => p.rows).filter((r) => r.userEmail === user.email) ?? [];

  return (
    <>
      {back}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <Avatar name={user.name} size={44} className="mt-0.5" />
          <div className="min-w-0">
            <h1 className="font-display text-2xl leading-tight font-semibold tracking-[-0.02em] text-ink">{user.name}</h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
              <span className="break-all font-mono">{user.email}</span>
              <UserFlags u={user} />
              {self && <span className="text-xs">(you)</span>}
            </p>
          </div>
        </div>
        <UserActions user={user} afterDelete={() => navigate(withPeriod(adminPaths.users, period), { replace: true })} />
      </div>

      <Stagger className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <AdminCard title="Account" className="lg:col-span-2">
            <KeyValue
              items={[
                { label: 'Created', value: <Num>{fmtDate(user.createdAt)}</Num> },
                { label: 'Last sign-in', value: <Num>{user.lastLoginAt ? `${fmtDateTime(user.lastLoginAt)} · ${fmtAgo(user.lastLoginAt)}` : 'never'}</Num> },
                { label: 'E-mail', value: user.emailVerified ? 'verified' : 'not verified yet' },
                { label: 'Signs in with', value: [user.hasPassword && 'password', user.google && 'Google'].filter(Boolean).join(', ') || 'nothing set up yet' },
                { label: 'Two-step verification', value: user.mfa ? 'on' : 'off' },
                { label: 'Active sessions', value: <Num>{user.activeSessions}</Num> },
                { label: 'Platform admin', value: user.platformAdmin ? 'yes' : 'no' },
              ]}
            />
          </AdminCard>
          <div className="grid gap-3">
            <MetricCard
              label="Cost of their runs"
              icon={<Wallet />}
              value={<CountUp value={user.cost.totalUsd} format={(v) => money(v)} />}
              info="Runs this person started in the app. Runs started by schedules belong to the company."
              meta={<SplitLine items={[{ label: 'Claude', value: money(user.cost.claudeUsd) }, { label: 'DFS', value: money(user.cost.dataforseoUsd) }]} />}
            />
            <MetricCard label="Runs started" icon={<Play />} value={<CountUp value={user.runs} format={(v) => Math.round(v).toLocaleString('en-US')} />} meta={PERIOD_LABELS[period]} />
          </div>
        </div>

        <AdminCard title="Companies" description={`${user.companies.length} membership${user.companies.length === 1 ? '' : 's'}`} bodyClassName="px-0 pb-0 pt-3">
          <FlushTable rows={user.companies} columns={cols} rowKey={(c) => c.id} initialSort={{ key: 'name', dir: 'asc' }} empty="Not in any company. Use Actions > Add to a company." />
        </AdminCard>

        <AdminCard title="Recent runs they started" description={PERIOD_LABELS[period]} bodyClassName="px-0 pb-0 pt-3">
          {runs.isPending ? <Skeleton className="mx-5 mb-5 h-32" /> : runs.isError ? <ErrorState error={runs.error} onRetry={() => runs.refetch()} title="Could not load the runs" /> : <RunsTable rows={runRows} flush empty="No run started by them in this period." />}
        </AdminCard>
      </Stagger>

      <ConfirmDialog
        open={!!removing}
        onClose={() => {
          setRemoving(null);
          remove.reset();
        }}
        title={removing ? `Remove ${user.name} from ${removing.name}?` : ''}
        description="They lose access to this company's websites, runs and reports. Their account stays."
        confirmLabel="Remove"
        danger
        pending={remove.isPending}
        error={remove.error}
        onConfirm={() =>
          removing &&
          remove.mutate(
            { userId: user.id, orgId: removing.id },
            {
              onSuccess: () => {
                toast.success(`${user.name} removed from ${removing.name}`);
                setRemoving(null);
              },
            },
          )
        }
      />
    </>
  );
}
