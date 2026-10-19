import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { toast } from 'sonner';
import { Briefcase, Building2, CalendarDays, Clock, Globe, Mail, Plus, Settings, Trash2, UserPlus, Users } from 'lucide-react';
import {
  COMPANY_SIZES,
  createOrgSchema,
  inviteSchema,
  ROLE_LABELS,
  CLIENT_ROLES,
  isClientRole,
  type Invitation,
  type OrgKind,
  type Member,
  type Role,
} from '@seo/shared';
import { applyServerErrors } from '@/components/site/helpers';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardFooter } from '@/components/ui/card';
import { Callout, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { ChoiceCard, Field, Input, Select } from '@/components/ui/field';
import { Avatar, CopyButton, PageHeader } from '@/components/ui/misc';
import { IconTile, Stagger } from '@/components/insight';
import { Dialog } from '@/components/ui/overlay';
import { DataTable, type Column } from '@/components/ui/table';
import { LinkTabs } from '@/components/ui/tabs';
import { GuideButton } from '@/components/guide';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { qk, useDeleteOrg, useMembers, useProviders, useTeamMutation, useUpdateOrg } from '@/lib/queries';
import { fmtAgo, fmtDate } from '@/lib/utils';
import { RoleChip, ROLE_ICON, SettingsCard } from './_components/SettingsCard';
import { DeliveryTab } from './_components/DeliveryTab';
import { MailboxesTab } from './_components/MailboxesTab';
import { ApiKeysTab } from './_components/ApiKeysTab';
import { IntegrationsTab } from './_components/integrations/IntegrationsTab';
import { SecurityTab } from './_components/SecurityTab';
import { AuditTab } from './_components/AuditTab';
import { SsoTab } from './_components/SsoTab';
import { BrandingTab, ClientMailTab, PortalDomainTab } from './_components/AgencyTabs';
import { CreditsTab } from './_components/credits/CreditsTab';

const TABS = [
  { id: 'company', label: 'Company', description: 'Your company\'s details, websites and setup.' },
  { id: 'team', label: 'Team', description: 'Who can see and change your company\'s SEO work.' },
  { id: 'credits', label: 'Credits', description: 'Your credit balance, what your websites and analyses use, buying credits and your own limits.' },
  { id: 'delivery', label: 'Report delivery', description: 'Where your finished reports are sent, and on what schedule.' },
  { id: 'mailboxes', label: 'Mailboxes', description: 'The mailboxes link-building pitches go out from, and your opt-out list.' },
  { id: 'api', label: 'API access', description: 'Keys that let a script, a BI tool or an AI assistant read your data and, if you allow it, start analyses.' },
  { id: 'integrations', label: 'Integrations', description: 'Slack and Teams alerts, Jira / Linear / Asana tickets, exports to your warehouse, Looker Studio and AI assistants.' },
  { id: 'security', label: 'Security', description: 'Two-step verification for everyone, who has it, and how long records are kept.' },
  { id: 'sso', label: 'Single sign-on', description: 'Sign in through your identity provider (Okta, Entra ID, Google Workspace), on your own e-mail domains.' },
  { id: 'audit', label: 'Audit log', description: 'Who did what, when and from where: sign-ins, team, settings, keys and sharing.' },
  // G5: an agency's portal for its clients, and a client workspace's own branding and approval rule
  { id: 'branding', label: 'Branding', description: 'The name, logo and colour your clients see instead of ours.', kinds: ['agency', 'client'] },
  { id: 'portal', label: 'Portal address', description: 'Your clients\' portal on your own domain, such as seo.youragency.com.', kinds: ['agency'] },
  { id: 'client-mail', label: 'Client e-mail', description: 'Who e-mails to your clients come from, and where their replies go.', kinds: ['agency'] },
] as const satisfies readonly { id: string; label: string; description: string; kinds?: readonly OrgKind[] }[];
const tabShown = (t: (typeof TABS)[number], kind: OrgKind) => !('kinds' in t) || (t.kinds as readonly OrgKind[]).includes(kind);

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: 'Everything, including the credit limits and deleting the company.',
  admin: 'Websites, website settings and the team. Starts analyses.',
  member: 'Starts analyses and sees every dashboard and report.',
  viewer: 'Sees dashboards and reports. Cannot start analyses.',
  client_approver: 'The client\'s portal: dashboards, reports and recommendations, and approves pages and outreach.',
  client_viewer: 'The client\'s portal: dashboards, reports and recommendations. Read only.',
};

const sizeLabel = (s: string) => (s === 'Just me' ? s : `${s.replace('-', '-')} people`);

export default function OrgSettingsPage() {
  const { tab } = useParams();
  const { org } = useOrgCtx();
  // the tab was "Usage & budget" until credits replaced the dollar budget: old links land on Credits
  if (tab === 'usage') return <Navigate to={paths.settings(org.id, 'credits')} replace />;
  const current = TABS.find((t) => t.id === tab && tabShown(t, org.kind));
  if (!current) return <Navigate to={paths.settings(org.id, 'company')} replace />;
  return (
    <div>
      <PageHeader icon={<Building2 />} title="Company settings" description={current.description} eyebrow={org.name} />
      <LinkTabs className="mb-6" items={TABS.filter((t) => tabShown(t, org.kind)).map((t) => ({ to: paths.settings(org.id, t.id), label: t.label }))} />
      {current.id === 'company' && <CompanyTab />}
      {current.id === 'team' && <TeamTab />}
      {current.id === 'credits' && <CreditsTab />}
      {current.id === 'delivery' && <DeliveryTab />}
      {current.id === 'mailboxes' && <MailboxesTab />}
      {current.id === 'api' && <ApiKeysTab />}
      {current.id === 'integrations' && <IntegrationsTab />}
      {current.id === 'security' && <SecurityTab />}
      {current.id === 'sso' && <SsoTab />}
      {current.id === 'audit' && <AuditTab />}
      {current.id === 'branding' && <BrandingTab />}
      {current.id === 'portal' && <PortalDomainTab />}
      {current.id === 'client-mail' && <ClientMailTab />}
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

      {/* G5: an agency runs client workspaces under its own brand */}
      {org.kind !== 'client' && (
        <SettingsCard
          icon={<Briefcase />}
          title={org.kind === 'agency' ? 'Agency' : 'Agency mode'}
          description={
            org.kind === 'agency'
              ? 'This company is an agency: it holds a workspace per client, with client logins and your brand.'
              : 'For agencies: a workspace per client, client logins, one table of every client website, your brand and your own portal address.'
          }
          actions={
            <ButtonLink to={paths.clients(org.id)} size="sm" variant="secondary">
              {org.kind === 'agency' ? 'Open clients' : 'Learn more'}
            </ButtonLink>
          }
        />
      )}

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
          {sites.length === 1 ? 'website' : `${sites.length} websites`} and deletes every run, report and file in this app, along with the team's access. The SEO engine's
          own history of the websites stays.
        </p>
      </CardBody>
      <CardFooter className="rounded-b-xl border-critical/25 bg-critical-soft/40">
        <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setOpen(true)}>
          Delete company...
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
  // G5: in a client workspace a client person is one of the client roles; an agency member's access is set from the agency
  const roleChoices = (m: Member): readonly Role[] => (isClientRole(m.role) ? CLIENT_ROLES : org.kind === 'client' ? [] : (['admin', 'member', 'viewer'] as const));
  const roleCell = (m: Member) =>
    admin && m.role !== 'owner' && m.userId !== me.user.id && roleChoices(m).length ? (
      <div className="w-32">
        <Select
          aria-label={`Role of ${m.name}`}
          value={m.role}
          disabled={pendingRole === m.userId}
          onChange={(e) => changeRole(m, e.target.value as Role)}
          className="h-8 text-[13px]"
        >
          {roleChoices(m).map((r) => (
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
              {m.deactivated && <StatusBadge tone="warning">Deactivated</StatusBadge>}
              {(m.provisionedBy === 'scim' || m.provisionedBy === 'jit') && <Badge>{m.provisionedBy === 'scim' ? 'SCIM' : 'SSO'}</Badge>}
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
      sortValue: (m) => ['owner', 'admin', 'member', 'viewer', 'client_approver', 'client_viewer'].indexOf(m.role),
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
        description={
          org.kind === 'client'
            ? 'The client\'s own people see this workspace as their portal. Your agency\'s owners and admins reach it already; give other agency members access from the agency\'s Clients page.'
            : 'Everyone here sees all websites of the company. What they can change depends on their role.'
        }
        actions={
          admin ? (
            <Button size="sm" icon={<UserPlus className="size-4" />} onClick={() => setInviteOpen(true)}>
              Invite people
            </Button>
          ) : undefined
        }
      >
        <CardBody>
          <DataTable rows={list} columns={columns} rowKey={(m) => m.userId} initialSort={{ key: 'role', dir: 'asc' }} searchable={list.length > 8} searchPlaceholder="Search members..." />
          <h3 className="mt-6 mb-2.5 text-xs font-medium text-ink-3">What each role can do</h3>
          <dl className="grid gap-2.5 sm:grid-cols-2">
            {(org.kind === 'client' ? CLIENT_ROLES : (['owner', 'admin', 'member', 'viewer'] as const)).map((r) => (
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
                      <span className="text-xs text-ink-3">Invited by {i.invitedBy ?? '-'}</span>
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

/** D-10: "We sent an invitation" was said on a server that sends no e-mail; this says what really happened. */
export function InvitationSentNote({ email, role, emailed }: { email: string; role: Role; emailed: boolean }) {
  return emailed ? (
    <p>
      We e-mailed an invitation to <strong className="font-medium text-ink">{email}</strong> as {ROLE_LABELS[role].toLowerCase()}. If it does not arrive, send them this link
      yourself:
    </p>
  ) : (
    <p>
      The invitation for <strong className="font-medium text-ink">{email}</strong> as {ROLE_LABELS[role].toLowerCase()} is ready. This app sends no e-mail, so nothing has been
      sent: send them this link yourself.
    </p>
  );
}

type InviteValues = z.input<typeof inviteSchema>;
type InviteOutput = z.output<typeof inviteSchema>;

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { org } = useOrgCtx();
  const mailOn = useProviders().data?.email === true;   // D-10: account e-mails (invitations) are sent by this server
  const invite = useTeamMutation<InviteOutput>(org.id, 'POST', () => `/api/orgs/${org.id}/invitations`, (b) => b);
  const [created, setCreated] = useState<Invitation | null>(null);
  const [error, setError] = useState<unknown>(null);
  // G5: a client workspace invites the client's own people (client roles); a company invites staff
  const choices: readonly Role[] = org.kind === 'client' ? CLIENT_ROLES : (['admin', 'member', 'viewer'] as const);
  const first = org.kind === 'client' ? 'client_viewer' : 'member';
  const form = useForm<InviteValues, unknown, InviteOutput>({ resolver: zodResolver(inviteSchema), defaultValues: { email: '', role: first } });
  const role = form.watch('role') ?? first;

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setCreated(null);
      setError(null);
      form.reset({ email: '', role: first });
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
      description={created ? undefined : mailOn ? 'They get an e-mail with a link to join. The link works for 7 days.' : 'You get a link to send them yourself (this app sends no e-mail). The link works for 7 days.'}
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
          <InvitationSentNote email={created.email} role={created.role} emailed={created.emailed ?? mailOn} />
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
          <Field
            label="E-mail address"
            labelAction={<GuideButton id="invite-team" variant="link" label="Which role do they need?" />}
            error={form.formState.errors.email?.message}
          >
            {(p) => <Input {...p} type="email" autoComplete="off" placeholder="colleague@company.com" autoFocus {...form.register('email')} />}
          </Field>
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink" id="invite-role-label">
              Role
            </p>
            <div role="radiogroup" aria-labelledby="invite-role-label" className="space-y-2">
              {choices.map((r) => (
                <ChoiceCard key={r} selected={role === r} onSelect={() => form.setValue('role', r as InviteValues['role'])} title={ROLE_LABELS[r]} description={ROLE_DESCRIPTIONS[r]} icon={<span className="[&_svg]:size-4">{ROLE_ICON[r]}</span>} />
              ))}
            </div>
          </div>
          {error != null && <Callout tone="critical">{errorMessage(error)}</Callout>}
        </form>
      )}
    </Dialog>
  );
}
