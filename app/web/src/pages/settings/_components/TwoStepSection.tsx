import { useState } from 'react';
import { toast } from 'sonner';
import { Download, Fingerprint, LifeBuoy, Plus, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';
import type { MfaStatus, TotpEnrolment } from '@seo/shared';
import { GuideButton } from '@/components/guide';
import { IconTile } from '@/components/insight';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout, Skeleton } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { CopyButton } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/overlay';
import { errorMessage } from '@/lib/api';
import { useMfaStatus, usePasskeyOptions, usePasskeyRegister, usePasskeyRemove, useRegenerateRecoveryCodes, useTotpConfirm, useTotpDisable, useTotpStart } from '@/lib/queries';
import { downloadText, fmtAgo, fmtDate } from '@/lib/utils';
import { SettingsCard } from './SettingsCard';

/** G1: the person's own second factors — authenticator app, passkeys, recovery codes (Your account → Two-step verification). */
export function TwoStepSection() {
  const status = useMfaStatus();
  const [codes, setCodes] = useState<string[] | null>(null);
  const s = status.data;
  return (
    <SettingsCard
      icon={<ShieldCheck />}
      title="Two-step verification"
      description="After your password (or Google), confirm it is you with your phone or a passkey. A stolen password is then not enough."
      actions={s ? s.enabled ? <StatusBadge tone="good">On</StatusBadge> : <StatusBadge tone={s.requiredBy.length ? 'critical' : 'neutral'}>Off</StatusBadge> : undefined}
      className="scroll-mt-20"
    >
      <div id="security" className="space-y-4 px-5 pt-4 pb-5">
        {!s ? (
          <Skeleton className="h-40" />
        ) : (
          <>
            {s.requiredBy.length > 0 && !s.enabled && (
              <Callout tone="warning" title={`${s.requiredBy.join(', ')} require${s.requiredBy.length === 1 ? 's' : ''} two-step verification`}>
                Set up an authenticator app or a passkey below to open {s.requiredBy.length === 1 ? 'it' : 'them'} again.
              </Callout>
            )}
            <ul className="divide-y divide-line rounded-xl border border-line">
              <TotpRow s={s} onCodes={setCodes} />
              <PasskeysRow s={s} onCodes={setCodes} />
              <RecoveryRow s={s} onCodes={setCodes} />
            </ul>
            <GuideButton id="two-step-verification" variant="link" />
          </>
        )}
      </div>
      <RecoveryCodesDialog codes={codes} onClose={() => setCodes(null)} />
    </SettingsCard>
  );
}

function Row({ icon, title, detail, children, on }: { icon: React.ReactNode; title: string; detail: React.ReactNode; children?: React.ReactNode; on: boolean }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <span className="flex min-w-0 items-start gap-3">
        <IconTile size="sm" tone={on ? 'blue' : 'neutral'}>
          {icon}
        </IconTile>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-ink">{title}</span>
          <span className="block text-[13px] leading-snug text-ink-3">{detail}</span>
        </span>
      </span>
      <span className="flex shrink-0 flex-wrap items-center gap-2">{children}</span>
    </li>
  );
}

function TotpRow({ s, onCodes }: { s: MfaStatus; onCodes: (c: string[]) => void }) {
  const start = useTotpStart();
  const disable = useTotpDisable();
  const [enrol, setEnrol] = useState<TotpEnrolment | null>(null);
  const begin = () => start.mutate(undefined, { onSuccess: setEnrol, onError: (e) => toast.error(errorMessage(e)) });
  const remove = () => {
    if (!window.confirm('Remove the authenticator app? You will no longer be asked for its codes.')) return;
    disable.mutate(undefined, { onSuccess: () => toast.success('Authenticator app removed'), onError: (e) => toast.error(errorMessage(e)) });
  };
  return (
    <Row
      icon={<Smartphone />}
      on={s.totp.enabled}
      title="Authenticator app"
      detail={s.totp.enabled ? `On since ${fmtDate(s.totp.enabledAt!)}` : s.totpAvailable ? 'A 6-digit code from Google Authenticator, Microsoft Authenticator, 1Password…' : 'Not available on this server yet (it has no key to store app secrets). Use a passkey.'}
      >
      {s.totp.enabled ? (
        <Button size="sm" variant="ghost" onClick={remove} loading={disable.isPending}>
          <Trash2 /> Remove
        </Button>
      ) : (
        <Button size="sm" variant="secondary" onClick={begin} loading={start.isPending} disabled={!s.totpAvailable}>
          Set up
        </Button>
      )}
      <TotpDialog enrol={enrol} onClose={() => setEnrol(null)} onCodes={onCodes} />
    </Row>
  );
}

function TotpDialog({ enrol, onClose, onCodes }: { enrol: TotpEnrolment | null; onClose: () => void; onCodes: (c: string[]) => void }) {
  const confirm = useTotpConfirm();
  const [code, setCode] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    confirm.mutate(code.replace(/\s/g, ''), {
      onSuccess: (r) => {
        setCode('');
        onClose();
        toast.success('Two-step verification is on');
        if (r.newRecoveryCodes) onCodes(r.newRecoveryCodes);
      },
    });
  };
  return (
    <Dialog open={!!enrol} onOpenChange={(o) => !o && onClose()} title="Set up your authenticator app" description="Scan the code with the app, then type the 6-digit code it shows.">
      {enrol && (
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            {/* a QR code must stay dark on light to scan: it sits on a white tile in both themes */}
            <img src={`data:image/svg+xml;utf8,${encodeURIComponent(enrol.qrSvg)}`} alt="QR code to scan with your authenticator app" className="size-44 shrink-0 rounded-lg border border-line bg-white p-2" />
            <div className="min-w-0 space-y-2 text-sm text-ink-2">
              <p>Cannot scan it? Add an account by hand, choose “time-based”, and type this key:</p>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <code className="min-w-0 max-w-full break-all rounded-md border bg-surface-2 px-2 py-1 font-mono text-xs">{enrol.secret.match(/.{1,4}/g)?.join(' ')}</code>
                <CopyButton text={enrol.secret} label="Copy key" />
              </div>
            </div>
          </div>
          <Field label="Code from the app" error={confirm.isError ? errorMessage(confirm.error) : undefined}>
            {(p) => (
              <Input {...p} value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="123456" className="font-mono tracking-[0.2em]" autoFocus />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={confirm.isPending} disabled={code.replace(/\s/g, '').length !== 6}>
              Turn on
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

function PasskeysRow({ s, onCodes }: { s: MfaStatus; onCodes: (c: string[]) => void }) {
  const options = usePasskeyOptions();
  const register = usePasskeyRegister();
  const remove = usePasskeyRemove();
  const [busy, setBusy] = useState(false);
  const supported = typeof window !== 'undefined' && 'PublicKeyCredential' in window;

  const add = async () => {
    const name = window.prompt('Name this passkey (for example "MacBook Touch ID" or "YubiKey")', 'My passkey')?.trim();
    if (!name) return;
    setBusy(true);
    try {
      const optionsJSON = (await options.mutateAsync()) as unknown as Parameters<typeof startRegistration>[0]['optionsJSON'];
      const response = await startRegistration({ optionsJSON });
      const r = await register.mutateAsync({ name, response: response as unknown as Record<string, unknown> });
      toast.success('Passkey added');
      if (r.newRecoveryCodes) onCodes(r.newRecoveryCodes);
    } catch (e) {
      if (!(e instanceof Error && e.name === 'NotAllowedError')) toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex min-w-0 items-start gap-3">
          <IconTile size="sm" tone={s.passkeys.length ? 'blue' : 'neutral'}>
            <Fingerprint />
          </IconTile>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-ink">Passkeys and security keys</span>
            <span className="block text-[13px] leading-snug text-ink-3">{supported ? 'Fingerprint, face or screen lock on this device, your phone, or a hardware key.' : 'This browser cannot use passkeys.'}</span>
          </span>
        </span>
        <Button size="sm" variant="secondary" onClick={() => void add()} loading={busy} disabled={!supported}>
          <Plus /> Add a passkey
        </Button>
      </div>
      {s.passkeys.length > 0 && (
        <ul className="mt-3 space-y-2 sm:pl-11">
          {s.passkeys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-2/40 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-sm text-ink">{k.name}</span>
                <span className="block text-xs text-ink-3">
                  Added {fmtDate(k.createdAt)} · {k.lastUsedAt ? `used ${fmtAgo(k.lastUsedAt)}` : 'not used yet'}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {k.synced && <Badge>Synced</Badge>}
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove ${k.name}`}
                  onClick={() => window.confirm(`Remove "${k.name}"?`) && remove.mutate(k.id, { onSuccess: () => toast.success('Passkey removed'), onError: (e) => toast.error(errorMessage(e)) })}
                >
                  <Trash2 />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function RecoveryRow({ s, onCodes }: { s: MfaStatus; onCodes: (c: string[]) => void }) {
  const regen = useRegenerateRecoveryCodes();
  const low = s.enabled && s.recoveryCodes.remaining <= 3;
  return (
    <Row
      icon={<LifeBuoy />}
      on={s.recoveryCodes.remaining > 0}
      title="Recovery codes"
      detail={s.enabled ? `${s.recoveryCodes.remaining} of ${s.recoveryCodes.total} left. Each works once if you lose your phone.` : 'You get ten when you set up your first method.'}
    >
      {low && <StatusBadge tone="warning">Running low</StatusBadge>}
      <Button
        size="sm"
        variant="secondary"
        disabled={!s.enabled}
        loading={regen.isPending}
        onClick={() =>
          window.confirm('Make ten new codes? The old ones stop working.') &&
          regen.mutate(undefined, { onSuccess: (r) => r.newRecoveryCodes && onCodes(r.newRecoveryCodes), onError: (e) => toast.error(errorMessage(e)) })
        }
      >
        New codes
      </Button>
    </Row>
  );
}

/** shown once, right after the codes are made: the server keeps only their hashes */
export function RecoveryCodesDialog({ codes, onClose }: { codes: string[] | null; onClose: () => void }) {
  const text = codes ? `Alaventra recovery codes (each works once)\n\n${codes.join('\n')}\n` : '';
  return (
    <Dialog
      open={!!codes}
      onOpenChange={(o) => !o && window.confirm('Have you saved your recovery codes? They will not be shown again.') && onClose()}
      title="Save your recovery codes"
      description="If you lose your phone or passkey, each of these lets you sign in once. This is the only time they are shown."
      footer={
        <>
          <CopyButton text={codes?.join('\n') ?? ''} label="Copy all" />
          <Button variant="secondary" onClick={() => downloadText('alaventra-recovery-codes.txt', text)}>
            <Download /> Download
          </Button>
          <Button onClick={onClose}>I saved them</Button>
        </>
      }
    >
      {codes && (
        <ul className="grid grid-cols-1 gap-2 rounded-lg border border-line bg-surface-2/40 p-3 font-mono text-sm tabular sm:grid-cols-2">
          {codes.map((c) => (
            <li key={c} className="text-ink">
              {c}
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
