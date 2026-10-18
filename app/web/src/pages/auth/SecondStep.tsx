import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Me, MfaMethod } from '@seo/shared';
import { GuideButton } from '@/components/guide';
import { MfaChallengeForm, type FactorInput } from '@/components/identity/MfaChallengeForm';
import { api } from '@/lib/api';
import { qk } from '@/lib/queries';
import { AuthCard } from './shared';

/** G1: the second step of a sign-in (after the password, Google or SSO). No session exists until it succeeds. */
export function SecondStep({ methods, emailHint, next, onCancel }: { methods: MfaMethod[]; emailHint: string; next?: string; onCancel: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const verify = async (f: FactorInput) => {
    const r = await api<Me & { next: string; recoveryCodesLeft: number | null }>('/api/auth/mfa/verify', { method: 'POST', body: f });
    const { next: serverNext, recoveryCodesLeft, ...me } = r;
    qc.setQueryData(qk.me, me);
    if (recoveryCodesLeft != null)
      toast.warning(`${recoveryCodesLeft} recovery code${recoveryCodesLeft === 1 ? '' : 's'} left`, { description: 'Make new ones under Your account → Two-step verification.' });
    navigate(next ?? serverNext ?? '/', { replace: true });
  };
  return (
    <AuthCard
      title="Confirm it is you"
      subtitle={`Two-step verification is on for ${emailHint}.`}
      footer={
        <span className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <button type="button" onClick={onCancel} className="font-medium text-accent-text hover:underline">
            Back to sign in
          </button>
          <GuideButton id="two-step-verification" variant="link" label="Lost your phone?" />
        </span>
      }
    >
      <MfaChallengeForm methods={methods} onVerify={verify} webauthnOptions={() => api('/api/auth/mfa/webauthn/options', { method: 'POST' })} submitLabel="Sign in" />
    </AuthCard>
  );
}
