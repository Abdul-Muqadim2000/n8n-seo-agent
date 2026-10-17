import { toast } from 'sonner';
import { Laptop, LogOut, MonitorSmartphone, ShieldCheck, Smartphone } from 'lucide-react';
import type { SessionView } from '@seo/shared';
import { IconTile } from '@/components/insight';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/feedback';
import { errorMessage } from '@/lib/api';
import { useRevokeOtherSessions, useRevokeSession, useSessions } from '@/lib/queries';
import { fmtAgo, fmtDate } from '@/lib/utils';
import { SettingsCard } from './SettingsCard';

const METHOD: Record<SessionView['authMethod'], string> = { password: 'Password', google: 'Google', sso: 'Single sign-on' };

/** G1: "Where you're signed in" — every device with a live session; sign one out, or every other one. */
export function SessionsSection() {
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const others = useRevokeOtherSessions();
  const items = sessions.data?.items ?? [];
  const otherCount = items.filter((s) => !s.current).length;
  return (
    <SettingsCard
      icon={<MonitorSmartphone />}
      title="Where you’re signed in"
      description="Devices with an open session. Sign out any you do not recognise, then change your password."
      actions={
        otherCount > 0 ? (
          <Button
            size="sm"
            variant="secondary"
            loading={others.isPending}
            onClick={() =>
              window.confirm(`Sign out ${otherCount} other device${otherCount === 1 ? '' : 's'}?`) &&
              others.mutate(undefined, { onSuccess: (r) => toast.success(`${r.revoked} device${r.revoked === 1 ? '' : 's'} signed out`), onError: (e) => toast.error(errorMessage(e)) })
            }
          >
            <LogOut /> Sign out all others
          </Button>
        ) : undefined
      }
    >
      <div className="px-5 pt-4 pb-5">
        {!sessions.data ? (
          <Skeleton className="h-28" />
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {items.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span className="flex min-w-0 items-start gap-3">
                  <IconTile size="sm" tone={s.current ? 'blue' : 'neutral'}>
                    {/iOS|Android/.test(s.device) ? <Smartphone /> : <Laptop />}
                  </IconTile>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                      {s.device}
                      {s.current && <StatusBadge tone="good">This device</StatusBadge>}
                      {s.mfa && (
                        <Badge>
                          <ShieldCheck className="size-3" aria-hidden /> Two-step
                        </Badge>
                      )}
                    </span>
                    <span className="block text-[13px] leading-snug text-ink-3">
                      {METHOD[s.authMethod]} · signed in {fmtDate(s.createdAt)} · active {fmtAgo(s.lastSeenAt)}
                      {s.ip ? <span className="font-mono"> · {s.ip}</span> : null}
                    </span>
                  </span>
                </span>
                {!s.current && (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={revoke.isPending && revoke.variables === s.id}
                    onClick={() => revoke.mutate(s.id, { onSuccess: () => toast.success(`${s.device} signed out`), onError: (e) => toast.error(errorMessage(e)) })}
                  >
                    Sign out
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </SettingsCard>
  );
}
