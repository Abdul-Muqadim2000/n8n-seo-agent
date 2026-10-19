import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { toast } from 'sonner';
import { Check, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { adminCreateUserSchema, ADMIN_ROLES, type AdminCreatedUser, type AdminUserRow } from '@seo/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Callout, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Checkbox, Field, Input, Select } from '@/components/ui/field';
import { CopyButton } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/overlay';
import { DataTable, type Column } from '@/components/ui/table';
import { Segmented } from '@/components/ui/tabs';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { useAdminCompanies, useAdminCreateUser, useAdminUsers } from '@/lib/queries';
import { fmtAgo } from '@/lib/utils';
import { useAdminPeriod } from './AdminLayout';
import { AdminPageHeader, CostSplitCell, Num } from './_components/kit';
import { roleLabel, UserActions, UserFlags } from './_components/users';
import { adminPaths, PERIOD_LABELS, withPeriod } from './lib';

export default function AdminUsersPage() {
  const [period] = useAdminPeriod();
  const q = useAdminUsers(period);
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);

  const columns: Column<AdminUserRow>[] = [
    {
      key: 'name',
      header: 'Person',
      sortValue: (u) => u.name.toLowerCase(),
      cell: (u) => (
        <Link to={withPeriod(adminPaths.user(u.id), period)} onClick={(e) => e.stopPropagation()} className="block min-w-[180px] rounded-md hover:text-accent-text">
          <span className="block truncate font-medium">{u.name}</span>
          <span className="block truncate text-xs text-ink-3">{u.email}</span>
        </Link>
      ),
    },
    {
      key: 'companies',
      header: 'Companies',
      sortValue: (u) => u.companies.length,
      cell: (u) =>
        u.companies.length ? (
          <span className="block min-w-[160px] max-w-[260px] text-[13px] leading-snug">
            {u.companies.slice(0, 2).map((c) => (
              <span key={c.id} className="block truncate">
                {c.name} <span className="text-xs text-ink-3">· {roleLabel(c.role)}</span>
              </span>
            ))}
            {u.companies.length > 2 && <span className="block text-xs text-ink-3">+{u.companies.length - 2} more</span>}
          </span>
        ) : (
          <span className="text-[13px] text-ink-3">none</span>
        ),
    },
    { key: 'last', header: 'Last sign-in', sortValue: (u) => u.lastLoginAt ?? '', cell: (u) => <Num className="whitespace-nowrap text-ink-2">{u.lastLoginAt ? fmtAgo(u.lastLoginAt) : 'never'}</Num>, hideOnMobile: true },
    {
      key: 'security',
      header: 'Sign-in',
      hideOnMobile: true,
      sortValue: (u) => (u.mfa ? 1 : 0),
      cell: (u) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-ink-2">
          {u.emailVerified && <Check className="size-3.5 text-good-text" aria-label="E-mail verified" />}
          {u.mfa ? (
            <Badge tone="neutral" icon={<ShieldCheck className="size-3" aria-hidden />}>
              2-step
            </Badge>
          ) : null}
          <span>{[u.hasPassword && 'password', u.google && 'Google'].filter(Boolean).join(' · ') || 'no method yet'}</span>
        </span>
      ),
    },
    { key: 'sessions', header: 'Sessions', align: 'right', sortValue: (u) => u.activeSessions, cell: (u) => <Num>{u.activeSessions}</Num>, hideOnMobile: true },
    { key: 'cost', header: 'Cost of their runs', align: 'right', sortValue: (u) => u.cost.totalUsd, cell: (u) => <CostSplitCell cost={u.cost} /> },
    { key: 'flags', header: 'Status', sortValue: (u) => (u.suspended ? 2 : u.emailVerified ? 0 : 1), cell: (u) => <UserFlags u={u} /> },
    { key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right', cell: (u) => <span onClick={(e) => e.stopPropagation()}><UserActions user={u} compact /></span> },
  ];

  return (
    <>
      <AdminPageHeader
        icon={<Users />}
        title="Users"
        description={`Everyone with an account: their companies, how they sign in, and what the runs they started cost us · ${PERIOD_LABELS[period]}.`}
        actions={
          <Button icon={<UserPlus className="size-4" />} onClick={() => setAdding(true)}>
            Add user
          </Button>
        }
      />
      {q.isPending ? (
        <div className="space-y-3" aria-busy>
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-96" />
        </div>
      ) : q.isError ? (
        <Card>
          <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load the users" />
        </Card>
      ) : !q.data.length ? (
        <Card>
          <EmptyState icon={<Users className="size-5" />} title="No users yet" description="People appear here when they sign up or you add them." action={<Button onClick={() => setAdding(true)}>Add user</Button>} />
        </Card>
      ) : (
        <DataTable
          rows={q.data}
          columns={columns}
          rowKey={(u) => u.id}
          initialSort={{ key: 'last', dir: 'desc' }}
          pageSize={25}
          searchable
          searchPlaceholder="Search name, e-mail, company..."
          searchText={(u) => `${u.name} ${u.email} ${u.companies.map((c) => c.name).join(' ')}`}
          onRowClick={(u) => navigate(withPeriod(adminPaths.user(u.id), period))}
          toolbar={
            <p className="ml-auto text-xs text-ink-3">
              {q.data.length} people · {q.data.filter((u) => u.suspended).length} suspended · {q.data.filter((u) => u.mfa).length} with 2-step
            </p>
          }
        />
      )}
      {adding && <AddUserDialog onClose={() => setAdding(false)} />}
    </>
  );
}

type CreateValues = z.input<typeof adminCreateUserSchema>;

function AddUserDialog({ onClose }: { onClose: () => void }) {
  const [period] = useAdminPeriod();
  const companies = useAdminCompanies(period);
  const create = useAdminCreateUser();
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [done, setDone] = useState<AdminCreatedUser | null>(null);
  const form = useForm<CreateValues, unknown, z.output<typeof adminCreateUserSchema>>({
    resolver: zodResolver(adminCreateUserSchema),
    defaultValues: { name: '', email: '', role: 'member', markVerified: true, orgId: undefined, newCompanyName: undefined },
  });
  const err = form.formState.errors;
  const submit = form.handleSubmit((v) => {
    const body = { ...v, orgId: mode === 'existing' ? v.orgId || undefined : undefined, newCompanyName: mode === 'new' ? v.newCompanyName?.trim() || undefined : undefined };
    if (mode === 'existing' && !body.orgId) return form.setError('orgId', { message: 'Choose a company' });
    if (mode === 'new' && !body.newCompanyName) return form.setError('newCompanyName', { message: 'Enter the company name' });
    create.mutate(body, {
      onSuccess: (r) => {
        toast.success(`${r.user.email} is added`);
        setDone(r);
      },
      onError: (e) => {
        if (e instanceof ApiRequestError) for (const [k, m] of Object.entries(e.fields)) form.setError(k as keyof CreateValues, { message: m });
      },
    });
  });

  if (done)
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()} title={`${done.user.name} is added`} description="App e-mail is off: send them this link yourself. They choose their own password with it." footer={<Button onClick={onClose}>Done</Button>}>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs text-ink-2">{done.setPasswordUrl}</code>
            <CopyButton text={done.setPasswordUrl} />
          </div>
          <p className="text-[13px] text-ink-3">
            The link works for {done.expiresInHours} hours and only once. {done.user.companies.length ? `Member of ${done.user.companies.map((c) => `${c.name} (${roleLabel(c.role)})`).join(', ')}.` : ''}
          </p>
        </div>
      </Dialog>
    );

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Add a user"
      description="No password is chosen for them: you get a link that lets them set their own."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="admin-add-user" loading={create.isPending}>
            Add user
          </Button>
        </>
      }
    >
      <form id="admin-add-user" onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={err.name?.message}>
            {(p) => <Input {...p} autoFocus autoComplete="off" {...form.register('name')} />}
          </Field>
          <Field label="E-mail" error={err.email?.message}>
            {(p) => <Input {...p} type="email" autoComplete="off" {...form.register('email')} />}
          </Field>
        </div>
        <div>
          <Segmented
            label="Add them to"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'existing', label: 'Existing company' },
              { value: 'new', label: 'New company' },
            ]}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_150px]">
          {mode === 'existing' ? (
            <Field label="Company" error={err.orgId?.message}>
              {(p) => (
                <Select {...p} disabled={companies.isPending} {...form.register('orgId', { setValueAs: (v: string) => v || undefined })}>
                  <option value="">{companies.isPending ? 'Loading...' : 'Choose a company'}</option>
                  {(companies.data ?? [])
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </Select>
              )}
            </Field>
          ) : (
            <Field label="New company name" error={err.newCompanyName?.message}>
              {(p) => <Input {...p} autoComplete="off" {...form.register('newCompanyName', { setValueAs: (v: string) => (v?.trim() ? v : undefined) })} />}
            </Field>
          )}
          <Field label="Role" error={err.role?.message}>
            {(p) => (
              <Select {...p} {...form.register('role')}>
                {ADMIN_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Checkbox label="Mark the e-mail verified" description="You vouch for the address; otherwise they confirm it when they first sign in." {...form.register('markVerified')} />
        {create.isError && !(create.error instanceof ApiRequestError && Object.keys(create.error.fields).length) && <Callout tone="critical">{errorMessage(create.error)}</Callout>}
      </form>
    </Dialog>
  );
}
