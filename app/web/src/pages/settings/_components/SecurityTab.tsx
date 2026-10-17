import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ScrollText, ShieldCheck, Users } from 'lucide-react';
import { AUDIT_RETENTION_CHOICES, DEFAULT_SECURITY_POLICY, retentionLabel, type Member, type SecurityPolicy } from '@seo/shared';
import { GuideButton } from '@/components/guide';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardBody, CardFooter } from '@/components/ui/card';
import { Callout, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Select } from '@/components/ui/field';
import { Avatar } from '@/components/ui/misc';
import { SwitchRow } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/ui/table';
import { errorMessage } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { useMembers, useSaveSecurityPolicy, useSecurityPolicy } from '@/lib/queries';
import { RoleChip, SettingsCard } from './SettingsCard';

/**
 * G1: the company's security policy (Company settings → Security): two-step verification for everyone and what counts as a second
 * step, and who has it. Admins and the owner change it; a change asks the person to confirm it is them (step-up).
 */
export function SecurityTab() {
  const { org, can, me } = useOrgCtx();
  const admin = can('admin');
  const policy = useSecurityPolicy(org.id);
  const save = useSaveSecurityPolicy(org.id);
  const [draft, setDraft] = useState<SecurityPolicy>(DEFAULT_SECURITY_POLICY);
  useEffect(() => {
    if (policy.data) setDraft(policy.data);
  }, [policy.data]);

  if (policy.error) return <ErrorState error={policy.error} onRetry={() => void policy.refetch()} />;
  if (!policy.data) return <Skeleton className="h-64 max-w-4xl" />;

  const dirty = JSON.stringify(draft) !== JSON.stringify(policy.data);
  const set = (p: Partial<SecurityPolicy>) => setDraft((d) => ({ ...d, ...p }));
  const submit = () =>
    save.mutate(draft, {
      onSuccess: () => toast.success('Security settings saved'),
      onError: (e) => toast.error(errorMessage(e)),
    });

  return (
    <div className="max-w-4xl space-y-5">
      <SettingsCard
        icon={<ShieldCheck />}
        title="Two-step verification"
        description="Ask every member for a second step after their password, Google or single sign-on."
        actions={<GuideButton id="require-two-step" />}
      >
        <CardBody className="divide-y divide-line">
          {!me.user.mfaEnabled && !policy.data.requireMfa && admin && (
            <Callout tone="info" className="mb-3">
              Turn on two-step verification for your own account first (Your account → Two-step verification); then you can require it for everyone.
            </Callout>
          )}
          <SwitchRow
            title="Require two-step verification"
            description="Members without it see nothing of this company until they set it up."
            checked={draft.requireMfa}
            disabled={!admin || (!me.user.mfaEnabled && !policy.data.requireMfa)}
            onCheckedChange={(v) => set({ requireMfa: v })}
          />
          <SwitchRow
            title="Single sign-on counts as two-step"
            description="Sign-ins through your company’s identity provider count, because it enforces its own MFA."
            checked={draft.mfaTrustSso}
            disabled={!admin || !draft.requireMfa}
            onCheckedChange={(v) => set({ mfaTrustSso: v })}
          />
          <SwitchRow
            title="Google sign-in counts as two-step"
            description="Only if your Google Workspace enforces 2-Step Verification: we cannot see whether a Google account has it."
            checked={draft.mfaTrustGoogle}
            disabled={!admin || !draft.requireMfa}
            onCheckedChange={(v) => set({ mfaTrustGoogle: v })}
          />
        </CardBody>
        {admin && (
          <CardFooter className="justify-end gap-2">
            <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(policy.data!)}>
              Discard
            </Button>
            <Button onClick={submit} disabled={!dirty} loading={save.isPending}>
              Save
            </Button>
          </CardFooter>
        )}
      </SettingsCard>
      <SettingsCard icon={<ScrollText />} title="Records" description="How long the audit log keeps what happened in this company.">
        <CardBody>
          <Field label="Keep audit events for" hint="Older events are removed once a day. Many security reviews ask for at least a year." className="max-w-xs">
            {(p) => (
              <Select {...p} value={String(draft.auditRetentionDays)} disabled={!admin} onChange={(e) => set({ auditRetentionDays: Number(e.target.value) })}>
                {AUDIT_RETENTION_CHOICES.map((d) => (
                  <option key={d} value={d}>
                    {retentionLabel(d)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </CardBody>
        {admin && (
          <CardFooter className="justify-end gap-2">
            <Button onClick={submit} disabled={!dirty} loading={save.isPending}>
              Save
            </Button>
          </CardFooter>
        )}
      </SettingsCard>
      {admin && <MembersMfa requireMfa={policy.data.requireMfa} />}
    </div>
  );
}

function MembersMfa({ requireMfa }: { requireMfa: boolean }) {
  const { org } = useOrgCtx();
  const members = useMembers(org.id);
  if (!members.data) return <Skeleton className="h-48" />;
  const rows = members.data.members;
  const off = rows.filter((m) => !m.mfaEnabled).length;
  const columns: Column<Member>[] = [
    {
      key: 'name',
      header: 'Member',
      cell: (m) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar name={m.name} src={m.avatarUrl} size={26} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-ink">{m.name}</span>
            <span className="block truncate text-xs text-ink-3">{m.email}</span>
          </span>
        </span>
      ),
      sortValue: (m) => m.name,
    },
    { key: 'role', header: 'Role', cell: (m) => <RoleChip role={m.role} /> },
    {
      key: 'mfa',
      header: 'Two-step',
      cell: (m) => (m.mfaEnabled ? <StatusBadge tone="good">On</StatusBadge> : <StatusBadge tone={requireMfa ? 'critical' : 'warning'}>Off</StatusBadge>),
      sortValue: (m) => (m.mfaEnabled ? 1 : 0),
    },
  ];
  return (
    <SettingsCard icon={<Users />} title="Who has two-step verification" description={off ? `${off} of ${rows.length} members have no second step yet.` : `All ${rows.length} members have a second step.`}>
      <CardBody>
        <DataTable rows={rows} columns={columns} rowKey={(m) => m.userId} pageSize={20} />
      </CardBody>
      {off > 0 && (
        <CardFooter>
          <p className="text-sm text-ink-2">Send them the setup guide:</p>
          <GuideButton id="two-step-verification" />
        </CardFooter>
      )}
    </SettingsCard>
  );
}
