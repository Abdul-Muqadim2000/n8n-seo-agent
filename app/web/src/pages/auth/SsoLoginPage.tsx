import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { KeyRound } from 'lucide-react';
import { emailField } from '@seo/shared';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { api, errorMessage } from '@/lib/api';
import { AuthCard, GOOGLE_ERRORS, safeNext } from './shared';

/** G1: /login/sso — "Sign in with SSO": the work address decides which company's identity provider to go to. */
export default function SsoLoginPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [error, setError] = useState<string | null>(params.get('error') ? (GOOGLE_ERRORS[params.get('error')!] ?? null) : null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = emailField.safeParse(email);
    if (!v.success) return setError('Enter your work e-mail address.');
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ sso: boolean; url?: string; orgName?: string }>('/api/sso/discover', { method: 'POST', body: { email: v.data } });
      if (!r.sso || !r.url) {
        setBusy(false);
        return setError(GOOGLE_ERRORS.sso_none);
      }
      window.location.assign(`${r.url}${next ? `&next=${encodeURIComponent(next)}` : ''}`);
    } catch (err) {
      setBusy(false);
      setError(errorMessage(err));
    }
  };
  return (
    <AuthCard
      title="Sign in with SSO"
      subtitle="Use your company’s identity provider (Okta, Microsoft Entra ID, Google Workspace…)."
      footer={
        <Link to={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="font-medium text-accent-text hover:underline">
          Sign in another way
        </Link>
      }
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
        <Field label="Work e-mail">{(p) => <Input {...p} type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />}</Field>
        {error && <Callout tone="critical">{error}</Callout>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          <KeyRound /> Continue
        </Button>
      </form>
    </AuthCard>
  );
}
