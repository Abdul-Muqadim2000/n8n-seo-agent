import { useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { toast } from 'sonner';
import { eachDayOfInterval, endOfMonth, format, isValid, min as minDate, parseISO } from 'date-fns';
import { Activity, Building2, CalendarDays, ChartNoAxesColumn, Clock, Globe, Mail, PiggyBank, Play, Plus, Search, Settings, Trash2, UserPlus, Users, Wallet } from 'lucide-react';
import {
  COMPANY_SIZES,
  compactNumber,
  createOrgSchema,
  formatUsd,
  inviteSchema,
  MODES,
  ROLE_LABELS,
  type Invitation,
  type ModeId,
  type Member,
  type Role,
  type Usage,
} from '@seo/shared';
import { BarsChart, ChartCard } from '@/components/charts';
import { applyServerErrors } from '@/components/site/helpers';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardFooter } from '@/components/ui/card';
import { Callout, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { ChoiceCard, Field, Input, Select } from '@/components/ui/field';
import { Avatar, CopyButton, Meter, PageHeader } from '@/components/ui/misc';
import { CountUp, IconTile, MetricCard, ScoreRing, Stagger } from '@/components/insight';
import { ModeGlyph } from '@/components/reports/meta';
import { Dialog } from '@/components/ui/overlay';
import { DataTable, type Column } from '@/components/ui/table';
import { LinkTabs } from '@/components/ui/tabs';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { qk, useDeleteOrg, useMembers, useSetBudget, useTeamMutation, useUpdateOrg, useUsage } from '@/lib/queries';
import { fmtAgo, fmtDate, fmtDay } from '@/lib/utils';
import { RoleChip, ROLE_ICON, SettingsCard } from './_components/SettingsCard';

const TABS = [
  { id: 'company', label: 'Company', description: 'Your company’s details, websites and setup.' },
  { id: 'team', label: 'Team', description: 'Who can see and change your company’s SEO work.' },
  { id: 'usage', label: 'Usage & budget', description: 'What this month’s analyses cost, and the monthly budget that caps them.' },
] as const;

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: 'Everything, including the budget and deleting the company.',
  admin: 'Websites, website settings and the team. Starts analyses.',
  member: 'Starts analyses and sees every dashboard and report.',
  viewer: 'Sees dashboards and reports. Cannot start analyses.',
};

const sizeLabel = (s: string) => (s === 'Just me' ? s : `${s.replace('-', '–')} people`);

export default function OrgSettingsPage() {
  const { tab } = useParams();
  const { org } = useOrgCtx();
  const current = TABS.find((t) => t.id === tab);
  if (!current) return <Navigate to={paths.settings(org.id, 'company')} replace />;
  return (
    <div>
      <PageHeader icon={<Building2 />} title="Company settings" description={current.description} eyebrow={org.name} />
      <LinkTabs className="mb-6" items={TABS.map((t) => ({ to: paths.settings(org.id, t.id), label: t.label }))} />
      {current.id === 'company' && <CompanyTab />}
      {current.id === 'team' && <TeamTab />}
      {current.id === 'usage' && <UsageTab />}
    </div>
  );
}

// ---------------- company ----------------

type OrgValues = z.input<typeof createOrgSchema>;
type OrgOutput = z.output<typeof createOrgSchema>;

function CompanyTab() {
  const { org, sites, can } = useOrgCtx();
  const admin = can('admin');
  const update = useUpdateOrg(org.id);
  const [error, setError] = useState<unknown>(null);
  const form = useForm<OrgValues, unknown, OrgOutput>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: {
      name: org.name,
      industry: org.industry,
      size: (COMPANY_SIZES.find((s) => s === org.size) ?? '') as OrgValues['size'],
      website: org.website,
    },
  });
  const errors = form.formState.errors;
  const submit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      const saved = await update.mutateAsync(v);
      form.reset({ name: saved.name, industry: saved.industry, size: (COMPANY_SIZES.find((s) => s === saved.size) ?? '') as OrgValues['size'], website: saved.website });
      toast.success('Company details saved');
    } catch (e) {
      if (!applyServerErrors(e, form.setError)) setError(e);
    }
  });

  return (
    <Stagger className="max-w-3xl space-y-5">
      {!org.onboardedAt && admin && (
        <Callout
          tone="info"
          title="Setup is not finished"
          action={
            <ButtonLink size="sm" variant="secondary" to={paths.onboarding(org.id, org.onboardingStep === 'done' ? undefined : org.onboardingStep)}>
              Continue setup
            </ButtonLink>
          }
        >
          Pick up the guided setup where you left off: verification, profile and tracking.
        </Callout>
      )}

      <SettingsCard icon={<Building2 />} title="Company details" description={`Created ${fmtDate(org.createdAt)} · your role: ${ROLE_LABELS[org.role]}`}>
        <form onSubmit={submit} noValidate>
          <CardBody>
            <fieldset disabled={!admin} className="space-y-5">
              <Field label="Company name" error={errors.name?.message}>
                {(p) => <Input {...p} autoComplete="organization" {...form.register('name')} />}
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Industry" optional error={errors.industry?.message}>
                  {(p) => <Input {...p} {...form.register('industry')} />}
                </Field>
                <Field label="Company size" optional error={errors.size?.message}>
                  {(p) => (
                    <Select {...p} {...form.register('size')}>
                      <option value="">Not set</option>
                      {COMPANY_SIZES.map((s) => (
                        <option key={s} value={s}>
                          {sizeLabel(s)}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
              <Field label="Main website" optional error={errors.website?.message}>
                {(p) => <Input {...p} inputMode="url" placeholder="example.com" {...form.register('website')} />}
              </Field>
              {error != null && <Callout tone="critical">{errorMessage(error)}</Callout>}
            </fieldset>
          </CardBody>
          {admin && (
            <CardFooter>
              <Button type="submit" loading={update.isPending} disabled={!form.formState.isDirty}>
                Save changes
              </Button>
            </CardFooter>
          )}
        </form>
      </SettingsCard>

      <SettingsCard
        icon={<Globe />}
        title="Websites"
        description="Each website has its own dashboard, settings and tracking."
        actions={
          admin ? (
            <ButtonLink to={paths.newSite(org.id)} size="sm" variant="secondary" icon={<Plus className="size-4" />}>
              Add a website
            </ButtonLink>
          ) : undefined
        }
      >
        <CardBody>
          {sites.length ? (
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
              {sites.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors duration-150 ease-brand hover:bg-surface-2/50">
                  <IconTile size="sm" tone={s.verifiedAt ? 'blue' : 'neutral'}>
                    <Globe />
                  </IconTile>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{s.domain}</span>
                  {s.verifiedAt ? <StatusBadge tone="good">Verified</StatusBadge> : <StatusBadge tone="warning">Not verified</StatusBadge>}
                  {s.trackingStatus === 'active' ? (
                    <StatusBadge tone="good">Tracking</StatusBadge>
                  ) : s.trackingStatus === 'paused' ? (
                    <StatusBadge tone="warning">Paused</StatusBadge>
                  ) : (
                    <Badge>Not tracked</Badge>
                  )}
                  <ButtonLink to={paths.site(org.id, s.id, 'settings/business')} variant="ghost" size="sm" icon={<Settings className="size-3.5" />}>
                    Settings
                  </ButtonLink>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-3">No websites yet.</p>
          )}
        </CardBody>
      </SettingsCard>

      {can('owner') && <DeleteCompanyCard />}
    </Stagger>
  );
}

function DeleteCompanyCard() {
  const { org, sites } = useOrgCtx();
  const remove = useDeleteOrg(org.id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const matches = typed.trim() === org.name;

  const confirm = () => {
    setFieldError(undefined);
    remove.mutate(typed.trim(), {
      onSuccess: () => {
        setOpen(false);
        toast.success(`${org.name} was deleted`);
        navigate('/', { replace: true });
        qc.removeQueries({ queryKey: qk.org(org.id) });
      },
      onError: (e) => {
        if (e instanceof ApiRequestError && e.fields.confirm) setFieldError(e.fields.confirm);
      },
    });
  };

  return (
    // the danger zone sits apart from the everyday settings
    <SettingsCard danger className="mt-5" icon={<Trash2 />} title="Danger zone" description="Only the owner sees this.">
      <CardBody className="space-y-2 text-sm leading-relaxed text-ink-2">
        <p>
          Deleting <strong className="font-medium text-ink">{org.name}</strong> stops the weekly tracking, monitors and blog posts of its{' '}
          {sites.length === 1 ? 'website' : `${sites.length} websites`} and deletes every run, report and file in this app, along with the team’s access. The SEO engine’s
          own history of the websites stays.
        </p>
      </CardBody>
      <CardFooter className="rounded-b-xl border-critical/25 bg-critical-soft/40">
        <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setOpen(true)}>
          Delete company…
        </Button>
      </CardFooter>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setTyped('');
            setFieldError(undefined);
          }
        }}
        title={`Delete ${org.name}?`}
        description="This cannot be undone."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirm} loading={remove.isPending} disabled={!matches}>
              Delete company
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={<>Type the company name, <span className="font-semibold">{org.name}</span>, to confirm</>} error={fieldError}>
            {(p) => <Input {...p} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" placeholder={org.name} />}
          </Field>
          {remove.isError && !fieldError && <Callout tone="critical">{errorMessage(remove.error)}</Callout>}
        </div>
      </Dialog>
    </SettingsCard>
  );
}

// ---------------- team ----------------

function TeamTab() {
  const { org, me, can } = useOrgCtx();
  const admin = can('admin');
  const members = useMembers(org.id);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const setRole = useTeamMutation<{ userId: string; role: Role }>(org.id, 'PATCH', (b) => `/api/orgs/${org.id}/members/${b.userId}`, (b) => ({ role: b.role }));
  const removeMember = useTeamMutation<{ userId: string }>(org.id, 'DELETE', (b) => `/api/orgs/${org.id}/members/${b.userId}`);
  const revoke = useTeamMutation<{ id: string }>(org.id, 'DELETE', (b) => `/api/orgs/${org.id}/invitations/${b.id}`);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirm, setConfirm] = useState<Member | null>(null);
  const [pendingRole, setPendingRole] = useState<string | null>(null);

  const changeRole = (m: Member, role: Role) => {
    setPendingRole(m.userId);
    setRole.mutate(
      { userId: m.userId, role },
      {
        onSuccess: () => toast.success(`${m.name} is now ${ROLE_LABELS[role].toLowerCase()}`),
        onError: (e) => toast.error(errorMessage(e)),
        onSettled: () => setPendingRole(null),
      },
    );
  };

  const leaving = confirm?.userId === me.user.id;
  const doRemove = () => {
    if (!confirm) return;
    removeMember.mutate(
      { userId: confirm.userId },
      {
        onSuccess: async () => {
          setConfirm(null);
          if (leaving) {
            await qc.invalidateQueries({ queryKey: qk.me });
            toast.success(`You left ${org.name}`);
            navigate('/', { replace: true });
          } else toast.success(`${confirm.name} was removed`);
        },
      },
    );
  };

  // the role control (a select for admins, a badge otherwise); its own column from md up, under the e-mail on phones
  const roleCell = (m: Member) =>
    admin && m.role !== 'owner' && m.userId !== me.user.id ? (
      <div className="w-32">
        <Select
          aria-label={`Role of ${m.name}`}
          value={m.role}
          disabled={pendingRole === m.userId}
          onChange={(e) => changeRole(m, e.target.value as Role)}
          className="h-8 text-[13px]"
        >
          {(['admin', 'member', 'viewer'] as const).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
      </div>
    ) : (
      <RoleChip role={m.role} />
    );

  const columns: Column<Member>[] = [
    {
      key: 'name',
      header: 'Member',
      sortValue: (m) => m.name.toLowerCase(),
      cell: (m) => (
        <span className="flex min-w-0 items-center gap-3">
          <Avatar name={m.name} src={m.avatarUrl} size={36} />
          <span className="min-w-0">
            <span className="flex items-center gap-2 font-medium text-ink">
              <span className="truncate">{m.name}</span>
              {m.userId === me.user.id && <Badge tone="accent">You</Badge>}
            </span>
            <span className="block truncate text-xs text-ink-3">{m.email}</span>
            <span className="mt-1.5 block md:hidden">{roleCell(m)}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      hideOnMobile: true,
      sortValue: (m) => ['owner', 'admin', 'member', 'viewer'].indexOf(m.role),
      cell: roleCell,
    },
    {
      key: 'joinedAt',
      header: 'Joined',
      hideOnMobile: true,
      sortValue: (m) => m.joinedAt,
      cell: (m) => (
        <span className="inline-flex items-center gap-1.5 text-ink-2">
          <CalendarDays className="size-3.5 shrink-0 text-ink-3" aria-hidden />
          {fmtDate(m.joinedAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (m) =>
        m.role === 'owner' ? null : m.userId === me.user.id ? (
          <Button variant="ghost" size="sm" onClick={() => setConfirm(m)}>
            Leave
          </Button>
        ) : admin ? (
          <Button variant="ghost" size="sm" onClick={() => setConfirm(m)} aria-label={`Remove ${m.name}`}>
            Remove
          </Button>
        ) : null,
    },
  ];

  if (members.isPending)
    return (
      <div className="space-y-3" aria-busy>
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-56" />
      </div>
    );
  if (members.isError)
    return (
      <Card>
        <ErrorState error={members.error} onRetry={() => members.refetch()} title="Could not load the team" />
      </Card>
    );
  const { members: list, invitations } = members.data;

  return (
    <Stagger className="space-y-6">
      <SettingsCard
        icon={<Users />}
        title={`Members (${list.length})`}
        description="Everyone here sees all websites of the company. What they can change depends on their role."
        actions={
          admin ? (
            <Button size="sm" icon={<UserPlus className="size-4" />} onClick={() => setInviteOpen(true)}>
              Invite people
            </Button>
          ) : undefined
        }
      >
        <CardBody>
          <DataTable rows={list} columns={columns} rowKey={(m) => m.userId} initialSort={{ key: 'role', dir: 'asc' }} searchable={list.length > 8} searchPlaceholder="Search members…" />
          <h3 className="mt-6 mb-2.5 text-xs font-medium text-ink-3">What each role can do</h3>
          <dl className="grid gap-2.5 sm:grid-cols-2">
            {(['owner', 'admin', 'member', 'viewer'] as const).map((r) => (
              <div key={r} className="flex items-start gap-3 rounded-lg border border-line p-3 transition-colors duration-150 ease-brand hover:border-line-strong">
                <IconTile size="sm" tone={r === 'owner' ? 'blue' : 'neutral'}>
                  {ROLE_ICON[r]}
                </IconTile>
                <div className="min-w-0">
                  <dt className="text-[13px] font-medium text-ink">{ROLE_LABELS[r]}</dt>
                  <dd className="mt-0.5 text-[13px] leading-snug text-ink-3">{ROLE_DESCRIPTIONS[r]}</dd>
                </div>
              </div>
            ))}
          </dl>
        </CardBody>
      </SettingsCard>

      {admin && (
        <SettingsCard icon={<Mail />} title={`Open invitations (${invitations.length})`} description="Invitation links work for 7 days. A new invitation to the same address replaces the old link.">
          <CardBody>
            {invitations.length ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {invitations.map((i) => (
                  <li key={i.id} className="flex flex-col rounded-xl border border-line bg-surface p-4 shadow-card transition-[border-color,box-shadow] duration-200 ease-brand hover:border-line-strong hover:shadow-raised">
                    <div className="flex items-start gap-3">
                      <IconTile size="md">
                        <Mail />
                      </IconTile>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium break-all text-ink">{i.email}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <RoleChip role={i.role} />
                          <span className="inline-flex h-6 items-center gap-1 rounded-md bg-surface-2 px-2 text-xs text-ink-2">
                            <Clock className="size-3 shrink-0 text-ink-3" aria-hidden />
                            Expires {fmtAgo(i.expiresAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                      <span className="text-xs text-ink-3">Invited by {i.invitedBy ?? '–'}</span>
                      {admin ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={revoke.isPending && revoke.variables?.id === i.id}
                          onClick={() =>
                            revoke.mutate({ id: i.id }, { onSuccess: () => toast.success(`Invitation for ${i.email} withdrawn`), onError: (e) => toast.error(errorMessage(e)) })
                          }
                        >
                          Withdraw
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Mail className="size-5" />}
                title="No open invitations"
                description="Invite colleagues so they can follow the dashboards and start analyses."
                action={
                  <Button variant="secondary" icon={<UserPlus className="size-4" />} onClick={() => setInviteOpen(true)}>
                    Invite people
                  </Button>
                }
                className="py-8"
              />
            )}
          </CardBody>
        </SettingsCard>
      )}

      {admin && <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />}

      <Dialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={leaving ? `Leave ${org.name}?` : `Remove ${confirm?.name ?? ''}?`}
        description={
          leaving
            ? 'You lose access to its websites, dashboards and reports. An admin can invite you again.'
            : `${confirm?.name ?? 'They'} lose access to ${org.name} immediately. You can invite them again later.`
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={doRemove} loading={removeMember.isPending}>
              {leaving ? 'Leave company' : 'Remove'}
            </Button>
          </>
        }
      >
        {removeMember.isError && <Callout tone="critical">{errorMessage(removeMember.error)}</Callout>}
      </Dialog>
    </Stagger>
  );
}

type InviteValues = z.input<typeof inviteSchema>;
type InviteOutput = z.output<typeof inviteSchema>;

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { org } = useOrgCtx();
  const invite = useTeamMutation<InviteOutput>(org.id, 'POST', () => `/api/orgs/${org.id}/invitations`, (b) => b);
  const [created, setCreated] = useState<Invitation | null>(null);
  const [error, setError] = useState<unknown>(null);
  const form = useForm<InviteValues, unknown, InviteOutput>({ resolver: zodResolver(inviteSchema), defaultValues: { email: '', role: 'member' } });
  const role = form.watch('role') ?? 'member';

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setCreated(null);
      setError(null);
      form.reset({ email: '', role: 'member' });
    }
  };

  const submit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      const inv = (await invite.mutateAsync(v)) as Invitation;
      setCreated(inv);
      toast.success(`Invitation created for ${inv.email}`);
    } catch (e) {
      if (!applyServerErrors(e, form.setError)) setError(e);
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={created ? 'Invitation ready' : `Invite someone to ${org.name}`}
      description={created ? undefined : 'They get an e-mail with a link to join. The link works for 7 days.'}
      footer={
        created ? (
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setCreated(null);
                form.reset({ email: '', role });
              }}
            >
              Invite another
            </Button>
            <Button onClick={() => close(false)}>Done</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" form="invite-form" loading={invite.isPending}>
              Create invitation
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className="space-y-4 text-sm text-ink-2">
          <p>
            We sent an invitation to <strong className="font-medium text-ink">{created.email}</strong> as {ROLE_LABELS[created.role].toLowerCase()}. If e-mail is not set up on
            this server, or it does not arrive, send them this link yourself:
          </p>
          {created.inviteUrl ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line-strong bg-surface-2 px-3 py-2">
              <code className="min-w-0 flex-1 break-all font-mono text-[13px] text-ink">{created.inviteUrl}</code>
              <CopyButton text={created.inviteUrl} label="Copy link" />
            </div>
          ) : (
            <Callout tone="warning">The server did not return a link. Withdraw the invitation and create it again.</Callout>
          )}
          <p className="text-[13px] text-ink-3">The link is shown only now. They must sign in with this e-mail address to accept it.</p>
        </div>
      ) : (
        <form id="invite-form" onSubmit={submit} noValidate className="space-y-4">
          <Field label="E-mail address" error={form.formState.errors.email?.message}>
            {(p) => <Input {...p} type="email" autoComplete="off" placeholder="colleague@company.com" autoFocus {...form.register('email')} />}
          </Field>
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink" id="invite-role-label">
              Role
            </p>
            <div role="radiogroup" aria-labelledby="invite-role-label" className="space-y-2">
              {(['admin', 'member', 'viewer'] as const).map((r) => (
                <ChoiceCard key={r} selected={role === r} onSelect={() => form.setValue('role', r)} title={ROLE_LABELS[r]} description={ROLE_DESCRIPTIONS[r]} icon={<span className="[&_svg]:size-4">{ROLE_ICON[r]}</span>} />
              ))}
            </div>
          </div>
          {error != null && <Callout tone="critical">{errorMessage(error)}</Callout>}
        </form>
      )}
    </Dialog>
  );
}

// ---------------- usage ----------------

const usdAxis = (v: number) => formatUsd(v, 0);

function monthLabel(month: string): string {
  const d = parseISO(`${month}-01`);
  return isValid(d) ? format(d, 'MMMM yyyy') : month;
}

/** Every day of the month so far (days without runs show as zero, so gaps are visible). */
function dailyRows(u: Usage) {
  const start = parseISO(`${u.month}-01`);
  if (!isValid(start)) return u.daily;
  const end = minDate([endOfMonth(start), new Date()]);
  if (end < start) return u.daily;
  const by = new Map(u.daily.map((d) => [d.date, d]));
  return eachDayOfInterval({ start, end }).map((day) => {
    const key = format(day, 'yyyy-MM-dd');
    const d = by.get(key);
    return { date: key, runs: d?.runs ?? 0, estimatedUsd: d?.estimatedUsd ?? 0 };
  });
}

function UsageTab() {
  const { org, sites, can } = useOrgCtx();
  const usage = useUsage(org.id);
  const daily = useMemo(() => (usage.data ? dailyRows(usage.data) : []), [usage.data]);

  if (usage.isPending)
    return (
      <div className="space-y-5" aria-busy>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  if (usage.isError)
    return (
      <Card>
        <ErrorState error={usage.error} onRetry={() => usage.refetch()} title="Could not load usage" />
      </Card>
    );

  const u = usage.data;
  const pct = u.budgetUsd > 0 ? Math.round((u.estimatedUsd / u.budgetUsd) * 100) : u.estimatedUsd > 0 ? 100 : 0;
  const tone = pct >= 90 ? 'critical' : pct >= 70 ? 'warning' : 'accent';
  const tracked = sites.filter((s) => s.trackingStatus === 'active').length;
  const checks = u.keywordChecks ?? { checks: 0, usd: 0 };
  const byMode = [
    ...u.byMode.map((m) => ({ label: MODES[m.mode]?.title ?? m.mode, runs: m.runs, estimatedUsd: m.estimatedUsd })),
    // keyword checks of the "New keyword ladder" flow count in the budget too
    ...(checks.checks ? [{ label: 'Keyword checks', runs: checks.checks, estimatedUsd: checks.usd }] : []),
  ].sort((a, b) => b.estimatedUsd - a.estimatedUsd);

  return (
    <Stagger className="space-y-5">
      <p className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-[13px] font-medium text-ink-2 shadow-card">
        <CalendarDays className="size-3.5 text-accent-text" aria-hidden />
        {monthLabel(u.month)}
      </p>
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Spent this month"
          icon={<Wallet />}
          tone={tone === 'accent' ? 'blue' : tone}
          visual={
            <span className="flex items-center gap-3">
              <ScoreRing label="Share of the monthly budget used" value={Math.min(pct, 100)} tone={tone} display={`${pct}%`} valueText={`${pct}% of the budget used`} size={60} />
              <span className="font-display text-[26px] leading-none font-semibold tracking-[-0.01em] text-ink">
                <CountUp value={u.estimatedUsd} format={(v) => formatUsd(v)} />
              </span>
            </span>
          }
          meta={
            <>
              {pct}% of the {formatUsd(u.budgetUsd)} budget · measured so far {formatUsd(u.actualUsd)}
            </>
          }
        />
        <MetricCard
          label="Left this month"
          icon={<PiggyBank />}
          value={<CountUp value={u.remainingUsd} format={(v) => formatUsd(v)} />}
          sparkline={
            <span className="flex h-full items-center">
              <Meter value={u.budgetUsd > 0 ? (u.remainingUsd / u.budgetUsd) * 100 : 0} tone={tone} label="Share of the monthly budget left" />
            </span>
          }
          meta="Runs that would go over the budget are refused."
        />
        <MetricCard
          label="Analyses this month"
          icon={<Play />}
          value={<CountUp value={u.runs} format={compactNumber} />}
          meta={`Runs started from the app (failed runs are not counted)${checks.checks ? `, plus ${checks.checks} keyword check${checks.checks === 1 ? '' : 's'} (${formatUsd(checks.usd)})` : ''}.`}
          to={paths.runs(org.id)}
        />
        <MetricCard
          label="Monitoring per month"
          icon={<Activity />}
          value={<CountUp value={u.monitoringMonthlyUsd} format={(v) => formatUsd(v)} />}
          meta={`Estimate for weekly tracking and monitors of ${tracked} tracked ${tracked === 1 ? 'website' : 'websites'}; not counted in the budget.`}
        />
      </div>

      {pct >= 90 && (
        <Callout tone={pct >= 100 ? 'critical' : 'warning'} title={pct >= 100 ? 'The monthly budget is used up' : 'The monthly budget is almost used up'}>
          New analyses are refused once they would go over {formatUsd(u.budgetUsd)}. {can('owner') ? 'Raise the budget below.' : 'Ask the owner of your company to raise it.'}
        </Callout>
      )}

      {u.runs === 0 && !checks.checks ? (
        <Card>
          <EmptyState
            icon={<Wallet className="size-5" />}
            title="No analyses this month yet"
            description="Spend by analysis type and by day appears here as soon as someone starts an analysis."
            action={can('member') ? <ButtonLink to={paths.tools(org.id)}>Run an analysis</ButtonLink> : undefined}
          />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <ChartCard
            title={<ChartTitle icon={<ChartNoAxesColumn />}>Spend by analysis</ChartTitle>}
            description="Estimated cost this month"
            loading={usage.isFetching}
            table={{
              columns: [
                { key: 'label', label: 'Analysis' },
                { key: 'runs', label: 'Runs', align: 'right' },
                { key: 'estimatedUsd', label: 'Estimated spend', align: 'right', format: (v) => formatUsd(Number(v)) },
              ],
              rows: byMode,
            }}
          >
            <SpendBars rows={byMode} />
          </ChartCard>
          <ChartCard
            title={<ChartTitle icon={<CalendarDays />}>Daily spend</ChartTitle>}
            description="Estimated cost per day"
            loading={usage.isFetching}
            table={{
              columns: [
                { key: 'date', label: 'Day', format: (v) => fmtDate(String(v)) },
                { key: 'runs', label: 'Runs', align: 'right' },
                { key: 'estimatedUsd', label: 'Estimated spend', align: 'right', format: (v) => formatUsd(Number(v)) },
              ],
              rows: daily.filter((d) => d.runs > 0),
            }}
          >
            <BarsChart
              data={daily}
              categoryKey="date"
              series={[{ key: 'estimatedUsd', label: 'Estimated spend', format: (v) => formatUsd(v) }]}
              valueFormat={usdAxis}
              categoryFormat={(v) => fmtDay(String(v))}
            />
          </ChartCard>
        </div>
      )}

      <BudgetCard usage={u} />
    </Stagger>
  );
}

/** A chart card title with its icon tile (as on the site dashboards). */
function ChartTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-3">
      <IconTile size="sm">{icon}</IconTile>
      <span className="min-w-0">{children}</span>
    </span>
  );
}

/** The mode a "spend by analysis" row is about (rows carry the tool's title), for its icon. */
const modeByTitle = (label: string) => (Object.keys(MODES) as ModeId[]).find((id) => MODES[id].title === label);

/** Spend by analysis as ranked bars: icon, name, runs, the amount and a bar against the biggest item. */
function SpendBars({ rows }: { rows: { label: string; runs: number; estimatedUsd: number }[] }) {
  const max = Math.max(0, ...rows.map((r) => r.estimatedUsd));
  return (
    <ul className="space-y-3.5 pt-1" aria-label="Estimated spend by analysis">
      {rows.map((r) => {
        const mode = modeByTitle(r.label);
        const w = max > 0 ? Math.max(2, (r.estimatedUsd / max) * 100) : 0;
        return (
          <li key={r.label} className="flex items-center gap-3">
            {mode ? <ModeGlyph mode={mode} size="sm" /> : (
              <IconTile size="sm">
                <Search />
              </IconTile>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate font-medium text-ink">{r.label}</span>
                <span className="shrink-0 tabular text-ink-2">
                  <span className="font-medium text-ink">{formatUsd(r.estimatedUsd)}</span>
                  <span className="text-ink-3">
                    {' '}
                    · {r.runs} {r.runs === 1 ? 'run' : 'runs'}
                  </span>
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <div className="h-full rounded-full bg-accent transition-[width] duration-700 ease-brand" style={{ width: `${w}%` }} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function BudgetCard({ usage }: { usage: Usage }) {
  const { org, can } = useOrgCtx();
  const owner = can('owner');
  const setBudget = useSetBudget(org.id);
  const [value, setValue] = useState(String(org.monthlyBudgetUsd));
  const [err, setErr] = useState<string | null>(null);

  const save = () => {
    const n = Number(value);
    if (!value.trim() || !Number.isFinite(n) || n < 0 || n > 100000) {
      setErr('Enter an amount between 0 and 100,000');
      return;
    }
    setErr(null);
    setBudget.mutate(
      { monthlyBudgetUsd: Math.round(n * 100) / 100 },
      { onSuccess: (o) => toast.success(`Monthly budget set to ${formatUsd(o.monthlyBudgetUsd)}`), onError: (e) => setErr(errorMessage(e)) },
    );
  };

  return (
    <SettingsCard
      className="max-w-3xl"
      icon={<Wallet />}
      title="Monthly budget"
      description="Caps what analyses started from the app may cost each calendar month (estimates). Weekly monitoring is shown above as a separate estimate."
    >
      <CardBody>
        {owner ? (
          <Field label="Budget per month (USD)" hint={`Used this month: ${formatUsd(usage.estimatedUsd)}.`} error={err ?? undefined} className="max-w-sm">
            {(p) => (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-3" aria-hidden>
                    $
                  </span>
                  <Input {...p} type="number" inputMode="decimal" min={0} max={100000} step={1} value={value} onChange={(e) => setValue(e.target.value)} className="pl-7" />
                </div>
                <Button onClick={save} loading={setBudget.isPending} disabled={Number(value) === org.monthlyBudgetUsd}>
                  Save
                </Button>
              </div>
            )}
          </Field>
        ) : (
          <p className="text-sm text-ink-2">
            The budget is <span className="font-medium text-ink">{formatUsd(org.monthlyBudgetUsd)}</span> per month. Only the owner of {org.name} can change it.
          </p>
        )}
      </CardBody>
    </SettingsCard>
  );
}
