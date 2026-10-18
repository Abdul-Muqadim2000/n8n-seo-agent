import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { StepUpMethod } from '@seo/shared';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/overlay';
import { api, setStepUpHandler } from '@/lib/api';
import { MfaChallengeForm, type FactorInput } from './MfaChallengeForm';

/**
 * G1 step-up: when a security-relevant change answers `reauth_required`, this dialog asks once for a second factor (or the password,
 * for people without one) and the request is retried. People who signed in with Google or SSO and have neither are sent to sign in
 * again. Mounted once at the root (main.tsx).
 */
export function StepUpProvider({ children }: { children: ReactNode }) {
  const [methods, setMethods] = useState<StepUpMethod[] | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const ask = useCallback(
    (m: StepUpMethod[]) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setMethods(m);
      }),
    [],
  );

  useEffect(() => {
    setStepUpHandler(ask);
    return () => setStepUpHandler(null);
  }, [ask]);

  const close = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setMethods(null);
  };

  const verify = async (f: FactorInput) => {
    await api('/api/auth/step-up', { method: 'POST', body: f, noStepUp: true });
    close(true);
  };

  const signInAgain = async () => {
    const here = window.location.pathname + window.location.search;
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    window.location.assign(`/login?next=${encodeURIComponent(here)}`);
  };

  const onlySignIn = !!methods && methods.every((m) => m === 'signin');

  return (
    <>
      {children}
      <Dialog
        open={!!methods}
        onOpenChange={(o) => !o && close(false)}
        title={
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-accent-text" aria-hidden /> Confirm it is you
          </span>
        }
        description={onlySignIn ? 'This change needs a fresh sign-in. Sign in again, then repeat it.' : 'This is a security change. Confirm it is you to continue; it stays confirmed for 10 minutes.'}
        footer={
          onlySignIn ? (
            <>
              <Button variant="ghost" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button onClick={() => void signInAgain()}>Sign in again</Button>
            </>
          ) : undefined
        }
      >
        {methods && !onlySignIn && (
          <MfaChallengeForm
            methods={methods}
            onVerify={verify}
            webauthnOptions={() => api('/api/auth/step-up/webauthn/options', { method: 'POST', noStepUp: true })}
            submitLabel="Confirm"
          />
        )}
      </Dialog>
    </>
  );
}
