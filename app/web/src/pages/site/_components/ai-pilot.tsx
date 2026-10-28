// W2-FIX (2026-10-23): the AI repeat pilot. An assistant can answer the same question differently each time it is asked, so the weekly figures
// need to know how much an engine's answer moves between asks. The pilot asks 10 of the website's questions 10 times on each engine that answers
// anew and says how many asks a week each question needs. It is priced first (the engine's own quote) and runs only when an admin confirms that
// price; nothing starts it on a schedule.
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Repeat } from 'lucide-react';
import type { AiPilotQuote } from '@seo/shared';
import { toastError } from '@/lib/api';
import { quoteLabel } from '@/lib/credits';
import { useAiPilot, useAiPilotStart } from '@/lib/queries';
import { fmtDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { Dialog } from '@/components/ui/overlay';
import { Panel, useSitePage } from './kit';
import { engineLabel } from './ai';

/** a quote that arrived after the request asked for it (the request id the engine echoes), and is still confirmable */
export function quoteState(q: AiPilotQuote | null, validHours: number, now = Date.now()): 'none' | 'stale' | 'refused' | 'ready' {
  if (!q) return 'none';
  if (!q.canConfirm) return 'refused';
  return now - Date.parse(q.receivedAt) > validHours * 3_600_000 ? 'stale' : 'ready';
}

export function AiPilotPanel() {
  const { org, site, can } = useSitePage();
  const isAdmin = can('admin');
  const [waiting, setWaiting] = useState<{ requestId: string; confirm: boolean } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const st = useAiPilot(org.id, site.id, { enabled: isAdmin, poll: !!waiting });
  const start = useAiPilotStart(org.id, site.id);
  const d = st.data;
  const q = d?.quote ?? null;
  const r = d?.result ?? null;
  // the engine's answer to OUR request has arrived (it echoes the request id): stop polling
  const arrived = !!waiting && (waiting.confirm ? r : q)?.requestId === waiting.requestId;
  useEffect(() => { if (arrived) setWaiting(null); }, [arrived]);
  if (!isAdmin) return null;
  const state = quoteState(q, d?.quoteValidHours ?? 24);

  const ask = (confirm: boolean) =>
    start.mutate(confirm, {
      onSuccess: (x) => {
        setWaiting({ requestId: x.requestId, confirm });
        setConfirming(false);
        toast.success(confirm ? 'The pilot has started. Its result appears here when it finishes.' : 'Asking the engine for the price. It appears here shortly.');
      },
      onError: (e) => { setConfirming(false); toastError(e); },
    });

  return (
    <Panel
      title="Repeat pilot"
      icon={<Repeat />}
      description="How much each assistant's answer changes when the same question is asked again"
      info="The pilot asks 10 of your questions 10 times each on every engine that answers anew each time (not the AI Overview or Copilot). It then tells you how many asks a week each question needs on each engine for a figure within 5 points. It runs once, only when you confirm its price."
      actions={
        <Button size="sm" variant="secondary" loading={start.isPending && !confirming} disabled={!!waiting} onClick={() => ask(false)}>
          {q ? 'Get a new price' : 'Get the price'}
        </Button>
      }
    >
      {waiting && (
        <Callout tone="info" className="mb-3">
          {waiting.confirm ? 'The pilot is running. This panel refreshes on its own when the result arrives.' : 'Waiting for the price from the engine.'}
        </Callout>
      )}
      {!q && !waiting && <p className="text-sm text-ink-2">Nothing has been priced yet. Getting the price costs nothing and asks nothing.</p>}
      {q && (
        <div className="space-y-2 text-sm">
          <p className="text-ink">
            {q.questions > 0 && q.engines.length > 0 ? (
              <>
                {q.questions} questions, {q.repeats} times each, on {q.engines.map((e) => engineLabel(e)).join(', ')}: {q.requests} answers, about <b>{quoteLabel(q.priceUsd)}</b>, once.
              </>
            ) : (
              'The engine could not price a pilot for this website.'
            )}
          </p>
          <p className="text-xs text-ink-3">Priced {fmtDateTime(q.receivedAt)}{state === 'stale' ? `; older than ${d?.quoteValidHours ?? 24} hours, get a new price before you confirm` : ''}.</p>
          {state === 'refused' && <Callout tone="warning">{q.reason || 'The pilot cannot run for this website right now.'}</Callout>}
          {state === 'ready' && (
            <Button size="sm" disabled={!!waiting} onClick={() => setConfirming(true)}>
              Run the pilot for about {quoteLabel(q.priceUsd)}
            </Button>
          )}
        </div>
      )}
      {r && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="text-[13px] font-medium text-ink">Last result, {fmtDateTime(r.receivedAt)}</p>
          {r.note && <p className="mt-1 text-xs text-ink-3">{r.note}</p>}
          <ul className="mt-2 divide-y divide-line text-sm">
            {r.byEngine.map((e) => (
              <li key={e.engine} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
                <span className="text-ink">{engineLabel(e.engine)}</span>
                <span className="text-ink-2">
                  {e.repeats == null ? 'ask more questions instead' : `${e.repeats} ask${e.repeats === 1 ? '' : 's'} per question a week`}
                  <span className="text-xs text-ink-3"> · {e.answers} answers{e.rate != null ? `, named in ${e.rate}%` : ''}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        title={q ? `Run the repeat pilot for about ${quoteLabel(q.priceUsd)}?` : 'Run the repeat pilot?'}
        description={q ? `${q.requests} answers from ${q.engines.length} engine${q.engines.length === 1 ? '' : 's'}, asked once. Credits are taken for what the pilot really uses, close to this price. Your weekly checks are not changed.` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button loading={start.isPending} onClick={() => ask(true)}>Run the pilot</Button>
          </>
        }
      />
    </Panel>
  );
}
