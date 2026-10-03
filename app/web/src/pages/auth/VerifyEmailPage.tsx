import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { Callout, Spinner } from '@/components/ui/feedback';
import { errorMessage } from '@/lib/api';
import { qk, usePost } from '@/lib/queries';
import { AuthCard } from './shared';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const verify = usePost<{ token: string }>('/api/auth/verify-email');
  const qc = useQueryClient();
  const sent = useRef(false);

  useEffect(() => {
    if (token && !sent.current) {
      sent.current = true;
      verify.mutate({ token }, { onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }) });
    }
  }, [token, verify, qc]);

  return (
    <AuthCard title="Confirm your e-mail">
      {!token && <Callout tone="warning">This link is missing its code. Open the link from the e-mail again.</Callout>}
      {verify.isPending && <Spinner label="Confirming…" />}
      {verify.isSuccess && (
        <div className="flex items-start gap-3 text-sm text-ink-2">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-good-text" />
          Your e-mail is confirmed. You can start analyses now.
        </div>
      )}
      {verify.isError && <Callout tone="critical">{errorMessage(verify.error)} You can send a new link from your account page.</Callout>}
      <ButtonLink to="/" className="mt-6 w-full" size="lg">
        Continue
      </ButtonLink>
    </AuthCard>
  );
}
