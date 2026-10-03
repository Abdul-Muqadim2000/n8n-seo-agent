import { toast } from 'sonner';
import type { Me } from '@seo/shared';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { errorMessage } from '@/lib/api';
import { usePost, useProviders } from '@/lib/queries';

/** Runs (tracking, audits, profile saves) need a confirmed e-mail address: says so and offers a new link. */
export function EmailVerifyNotice({ me, className, action = 'Tracking, audits and profile saves' }: { me: Me; className?: string; action?: string }) {
  const resend = usePost<void, { ok: boolean; sent: boolean }>('/api/auth/resend-verification', [['me']]);
  const providers = useProviders();
  if (me.user.emailVerified || !providers.data?.requireEmailVerification) return null;
  return (
    <Callout
      tone="warning"
      className={className}
      title="Confirm your e-mail address first"
      action={
        <Button
          size="sm"
          variant="secondary"
          loading={resend.isPending}
          onClick={() =>
            resend.mutate(undefined, {
              onSuccess: (r) =>
                r.sent
                  ? toast.success(`A new link is on its way to ${me.user.email}`)
                  : toast.info('No e-mail was sent', { description: 'Your address may already be confirmed (reload the page), or e-mail is not set up on this server.' }),
              onError: (e) => toast.error(errorMessage(e)),
            })
          }
        >
          Resend link
        </Button>
      }
    >
      {action} start once {me.user.email} is confirmed. Open the link we sent you, then come back here.
    </Callout>
  );
}
