import { useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { ROLE_LABELS } from '@seo/shared';
import { Button, ButtonLink } from '@/components/ui/button';
import { Callout, PageLoader } from '@/components/ui/feedback';
import { errorMessage } from '@/lib/api';
import { paths } from '@/lib/paths';
import { qk, useInvitation, useMe, usePost } from '@/lib/queries';
import { AuthCard } from './shared';

export default function AcceptInvitePage() {
  const { token = '' } = useParams();
  const inv = useInvitation(token);
  const me = useMe();
  const accept = usePost<Record<string, never>, { orgId: string }>(`/api/invitations/${token}/accept`);
  const qc = useQueryClient();
  const navigate = useNavigate();

  if (inv.isPending || me.isPending) return <PageLoader />;
  if (inv.isError || !inv.data)
    return (
      <AuthCard title="Invitation not found">
        <Callout tone="warning">{errorMessage(inv.error)} Ask the person who invited you to send a new invitation.</Callout>
        <ButtonLink to={me.data ? '/' : paths.login()} variant="secondary" size="lg" className="mt-5 w-full">
          {me.data ? 'Go to your dashboard' : 'Go to sign in'}
        </ButtonLink>
      </AuthCard>
    );
  const i = inv.data;
  const here = `/invite/${token}`;

  return (
    <AuthCard
      title={`Join ${i.orgName}`}
      subtitle={`${i.inviterName ?? 'A teammate'} invited ${i.email} to the company as ${ROLE_LABELS[i.role].toLowerCase()}.`}
    >
      <div className="mb-6 flex items-center gap-3 rounded-lg border border-line bg-surface-2 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink-3 shadow-card" aria-hidden>
          <Building2 className="size-5" />
        </span>
        <div className="text-sm">
          <div className="font-medium text-ink">{i.orgName}</div>
          <div className="text-ink-3">Role: {ROLE_LABELS[i.role]}</div>
        </div>
      </div>
      {!i.valid ? (
        <Callout tone="warning">{i.reason ?? 'This invitation is no longer valid.'}</Callout>
      ) : !me.data ? (
        <div className="space-y-3">
          <ButtonLink to={`/signup?next=${encodeURIComponent(here)}&email=${encodeURIComponent(i.email)}`} size="lg" className="w-full">
            Create an account to join
          </ButtonLink>
          <ButtonLink to={paths.login(here)} variant="secondary" size="lg" className="w-full">
            I already have an account
          </ButtonLink>
        </div>
      ) : me.data.user.email !== i.email ? (
        <Callout tone="warning">
          You are signed in as {me.data.user.email}, but this invitation is for {i.email}. Sign out and sign in with the invited address.
        </Callout>
      ) : (
        <>
          {accept.isError && (
            <Callout tone="critical" className="mb-4">
              {errorMessage(accept.error)}
            </Callout>
          )}
          <Button
            size="lg"
            className="w-full"
            loading={accept.isPending}
            onClick={() =>
              accept.mutate({} as Record<string, never>, {
                onSuccess: async (r) => {
                  await qc.invalidateQueries({ queryKey: qk.me });
                  navigate(paths.org(r.orgId), { replace: true });
                },
              })
            }
          >
            Accept and open the dashboard
          </Button>
        </>
      )}
    </AuthCard>
  );
}
