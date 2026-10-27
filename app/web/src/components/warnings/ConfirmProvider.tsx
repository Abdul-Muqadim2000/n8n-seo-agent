import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Warning } from '@seo/shared';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/overlay';
import { api, errorMessage, setConfirmHandler, type ConfirmAnswer } from '@/lib/api';
import { paths } from '@/lib/paths';
import { openWarnings, Warnings } from './Warnings';

/**
 * MKT (2026-10-27, mismatch audit §2.2): the server said "check this first" (409 `confirm_needed`) to a request from anywhere in the app:
 * a run, a keyword check, a proposal, a website save, an AI question. One dialog shows the warnings with the same two choices as the forms
 * (Accept, Continue anyway) and the request is sent again with the answers. Mounted once at the root (main.tsx), like StepUpProvider.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [warnings, setWarnings] = useState<Warning[] | null>(null);
  const resolver = useRef<((a: ConfirmAnswer) => void) | null>(null);

  const ask = useCallback(
    (w: Warning[]) =>
      new Promise<ConfirmAnswer>((resolve) => {
        resolver.current?.(null);
        resolver.current = resolve;
        setWarnings(w);
      }),
    [],
  );

  useEffect(() => {
    setConfirmHandler(ask);
    return () => setConfirmHandler(null);
  }, [ask]);

  const close = (a: ConfirmAnswer) => {
    resolver.current?.(a);
    resolver.current = null;
    setWarnings(null);
  };

  return (
    <>
      {children}
      <Dialog
        open={!!warnings}
        onOpenChange={(o) => !o && close(null)}
        wide
        title={
          <span className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-warning-text" aria-hidden /> Check this first
          </span>
        }
        description="This does not match what we know about your website. Accept the correction, or continue anyway: your choice is recorded."
      >
        {warnings && <ConfirmBody warnings={warnings} onDone={close} />}
      </Dialog>
    </>
  );
}

/** The dialog's content: every warning with Accept / Continue anyway, then Cancel / Continue. Exported for tests. */
export function ConfirmBody({ warnings, onDone }: { warnings: Warning[]; onDone: (a: ConfirmAnswer) => void }) {
  const [acked, setAcked] = useState<string[]>([]);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [set, setSet] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = openWarnings(warnings, acked, accepted);

  const accept = async (w: Warning) => {
    const c = w.accept?.change;
    if (!c) return;
    setError(null);
    if (c.kind === 'fields') {
      setSet((s) => ({ ...s, ...c.set }));
      setAccepted((a) => [...a, w.id]);
      return;
    }
    if (c.kind === 'link') {
      // the correction needs the person on another page: the request is not sent, the page opens
      onDone(null);
      const site = window.location.pathname.match(/^\/o\/([^/]+)\/sites\/([^/]+)/);
      if (c.tool && site) window.location.assign(paths.tool(site[1]!, c.tool, { siteId: site[2] }));
      else if (c.sitePage && site) window.location.assign(paths.site(site[1]!, site[2]!, c.sitePage));
      return;
    }
    setBusy(w.id);
    try {
      await api(c.path, { method: c.method, body: c.body ?? {}, noConfirm: true });
      setAccepted((a) => [...a, w.id]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <Warnings
        warnings={warnings}
        acked={acked}
        accepted={accepted}
        busy={busy}
        onToggle={(id, on) => setAcked((a) => (on ? [...a, id] : a.filter((x) => x !== id)))}
        onAccept={(w) => void accept(w as Warning)}
      />
      {error && <p className="text-sm text-critical-text">{error}</p>}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button disabled={open.length > 0 || !!busy} onClick={() => onDone({ acknowledge: acked.filter((id) => !accepted.includes(id)), set })}>
          Continue
        </Button>
      </div>
      {open.length > 0 && <p className="text-right text-xs text-ink-3">Accept the correction or tick "anyway" for each warning to continue.</p>}
    </div>
  );
}
