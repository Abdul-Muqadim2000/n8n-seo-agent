import { useEffect, useRef, useState } from 'react';
import { Fingerprint, LifeBuoy, Lock, Smartphone } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';
import type { StepUpMethod } from '@seo/shared';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { ApiRequestError, errorMessage } from '@/lib/api';

/** what a confirmation sends: a code, a recovery code, a passkey assertion or (step-up only) the password */
export type FactorInput =
  | { method: 'totp'; code: string }
  | { method: 'recovery'; code: string }
  | { method: 'webauthn'; response: Record<string, unknown> }
  | { method: 'password'; password: string };

const LABEL: Record<Exclude<StepUpMethod, 'signin'>, { label: string; icon: typeof Smartphone }> = {
  totp: { label: 'Use your authenticator app', icon: Smartphone },
  webauthn: { label: 'Use a passkey', icon: Fingerprint },
  recovery: { label: 'Use a recovery code', icon: LifeBuoy },
  password: { label: 'Use your password', icon: Lock },
};

/**
 * G1: the second step of a sign-in, the company's "confirm it is you" gate and the step-up dialog all use this one form. It starts
 * with the strongest method the person has (passkey, then app, then password) and offers the others as links.
 */
export function MfaChallengeForm({
  methods,
  onVerify,
  webauthnOptions,
  submitLabel = 'Continue',
}: {
  methods: StepUpMethod[];
  onVerify: (input: FactorInput) => Promise<void>;
  /** fetches a passkey challenge for this attempt */
  webauthnOptions?: () => Promise<unknown>;
  submitLabel?: string;
}) {
  const usable = methods.filter((m): m is Exclude<StepUpMethod, 'signin'> => m !== 'signin');
  const first = usable.includes('webauthn') ? 'webauthn' : usable.includes('totp') ? 'totp' : usable[0];
  const [method, setMethod] = useState(first);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue('');
    setError(null);
    if (method !== 'webauthn') input.current?.focus();
  }, [method]);

  const run = async (f: FactorInput) => {
    setBusy(true);
    setError(null);
    try {
      await onVerify(f);
    } catch (e) {
      setError(errorMessage(e));
      // a voided challenge cannot take another attempt
      if (e instanceof ApiRequestError && ['mfa_flow_locked', 'mfa_flow_missing', 'stepup_locked'].includes(e.code ?? '')) setBusy(true);
      else setBusy(false);
      return;
    }
    setBusy(false);
  };

  const passkey = async () => {
    if (!webauthnOptions) return;
    setBusy(true);
    setError(null);
    try {
      const optionsJSON = (await webauthnOptions()) as Parameters<typeof startAuthentication>[0]['optionsJSON'];
      const response = await startAuthentication({ optionsJSON });
      setBusy(false);
      await run({ method: 'webauthn', response: response as unknown as Record<string, unknown> });
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error && e.name === 'NotAllowedError' ? 'The passkey prompt was closed or timed out. Try again.' : errorMessage(e));
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (method === 'totp') return void run({ method, code: value.replace(/\s/g, '') });
    if (method === 'recovery') return void run({ method, code: value });
    if (method === 'password') return void run({ method, password: value });
  };

  if (methods.includes('signin') && !usable.length) return null;

  return (
    <div className="space-y-4">
      {method === 'webauthn' ? (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-ink-2">Use the passkey on this device, your phone or your security key.</p>
          <Button size="lg" className="w-full" onClick={() => void passkey()} loading={busy}>
            <Fingerprint /> Use a passkey
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field
            label={method === 'totp' ? '6-digit code from your authenticator app' : method === 'recovery' ? 'Recovery code' : 'Your password'}
            hint={method === 'recovery' ? 'One of the ten codes you saved. Each works once.' : undefined}
          >
            {(p) => (
              <Input
                {...p}
                ref={input}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                type={method === 'password' ? 'password' : 'text'}
                inputMode={method === 'totp' ? 'numeric' : undefined}
                autoComplete={method === 'totp' ? 'one-time-code' : method === 'password' ? 'current-password' : 'off'}
                maxLength={method === 'totp' ? 7 : method === 'recovery' ? 24 : 200}
                placeholder={method === 'totp' ? '123456' : method === 'recovery' ? 'ABCD-EFGH-IJKL-MNOP' : undefined}
                className={method === 'password' ? undefined : 'font-mono tracking-[0.2em]'}
                autoFocus
              />
            )}
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!value.trim()}>
            {submitLabel}
          </Button>
        </form>
      )}
      {error && <Callout tone="critical">{error}</Callout>}
      {usable.length > 1 && (
        <div className="flex flex-col items-start gap-1.5 border-t border-line pt-3">
          {usable
            .filter((m) => m !== method)
            .map((m) => {
              const { label, icon: Icon } = LABEL[m];
              return (
                <button key={m} type="button" onClick={() => setMethod(m)} className="inline-flex items-center gap-1.5 rounded-sm text-[13px] font-medium text-accent-text underline-offset-4 hover:underline">
                  <Icon className="size-3.5" aria-hidden /> {label}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}

