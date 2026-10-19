import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { MfaMethod } from '@seo/shared';
import { Callout, PageLoader } from '@/components/ui/feedback';
import { api } from '@/lib/api';
import { AuthCard, safeNext } from './shared';
import { SecondStep } from './SecondStep';

/** G1: /login/mfa, the second step after "Continue with Google" or single sign-on (the server redirects here with a challenge cookie). */
export default function MfaPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const flow = useQuery({ queryKey: ['mfa-flow'], queryFn: () => api<{ methods: MfaMethod[]; emailHint: string; next: string }>('/api/auth/mfa'), retry: false, staleTime: Infinity });
  if (flow.isLoading) return <PageLoader />;
  if (!flow.data)
    return (
      <AuthCard title="Sign in again" subtitle="This sign-in has expired or was already used.">
        <Callout tone="info">For your security the second step waits five minutes. Start again from the sign-in page.</Callout>
        <Link to="/login" className="mt-5 inline-block font-medium text-accent-text hover:underline">
          Back to sign in
        </Link>
      </AuthCard>
    );
  return (
    <SecondStep
      methods={flow.data.methods}
      emailHint={flow.data.emailHint}
      next={next ?? flow.data.next}
      onCancel={() => {
        void api('/api/auth/mfa/cancel', { method: 'POST' }).catch(() => undefined);
        navigate('/login', { replace: true });
      }}
    />
  );
}
