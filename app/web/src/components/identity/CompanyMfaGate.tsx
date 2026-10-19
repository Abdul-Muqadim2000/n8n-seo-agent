import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import type { StepUpMethod } from '@seo/shared';
import { GuideButton } from '@/components/guide';
import { StatusScreen } from '@/components/layout/StatusScreen';
import { ButtonLink } from '@/components/ui/button';
import { api, type ApiRequestError } from '@/lib/api';
import { MfaChallengeForm, type FactorInput } from './MfaChallengeForm';

export const COMPANY_MFA_CODES = ['mfa_enrolment_required', 'mfa_verification_required'];

/**
 * G1: the full page a member sees when their company requires two-step verification and this session has not passed it. Set one
 * up, or confirm with the one they have. Nothing of the company loads until then (the server refuses every company route).
 */
export function CompanyMfaGate({ error }: { error: ApiRequestError }) {
  const qc = useQueryClient();
  const verify = error.code === 'mfa_verification_required';
  const methods = useQuery({ queryKey: ['step-up-methods'], queryFn: () => api<{ methods: StepUpMethod[] }>('/api/auth/step-up'), enabled: verify });
  const done = async (f: FactorInput) => {
    await api('/api/auth/step-up', { method: 'POST', body: f, noStepUp: true });
    await qc.invalidateQueries({ queryKey: ['org'] });
  };
  return (
    <StatusScreen
      icon={<ShieldCheck className="size-6" />}
      title={verify ? 'Confirm it is you' : 'Set up two-step verification'}
      actions={
        verify ? undefined : (
          <>
            <ButtonLink to="/account#security">Set it up now</ButtonLink>
            <GuideButton id="two-step-verification" />
          </>
        )
      }
    >
      <p>{error.message}</p>
      {verify && methods.data && (
        <div className="mt-6 text-left">
          <MfaChallengeForm
            methods={methods.data.methods.filter((m) => m !== 'password' && m !== 'signin')}
            onVerify={done}
            webauthnOptions={() => api('/api/auth/step-up/webauthn/options', { method: 'POST', noStepUp: true })}
            submitLabel="Confirm"
          />
        </div>
      )}
    </StatusScreen>
  );
}
