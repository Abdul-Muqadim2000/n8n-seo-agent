import type { ReactNode } from 'react';
import type { PipelineNotice, Warning } from '@seo/shared';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { Checkbox } from '@/components/ui/field';

/**
 * MKT (2026-10-27, mismatch audit §2.2): THE way a warning is shown, everywhere (tool forms, the 409 dialog, the website's banner). It is
 * the forms' old PipelineNotices (a Callout per warning, the "... anyway" tick) with one more choice: **Accept**, the system's correction
 * (`accept`, or the pipeline's own plan `usePlan`). Links are optional so the dialog can render it outside the company layout.
 */

export type ShownWarning = PipelineNotice & Partial<Pick<Warning, 'code' | 'severity' | 'accept'>>;

export function Warnings({
  warnings,
  acked,
  onToggle,
  onAccept,
  accepted = [],
  busy,
  linkFor,
  renderLink,
}: {
  warnings: readonly ShownWarning[];
  /** the warning ids answered with "Continue anyway" */
  acked: readonly string[];
  onToggle: (id: string, on: boolean) => void;
  /** Accept: apply the warning's correction (absent = no Accept button) */
  onAccept?: (w: ShownWarning) => void;
  /** warnings already corrected (their Accept is done) */
  accepted?: readonly string[];
  /** the id whose Accept is running */
  busy?: string | null;
  /** where a warning's link goes (absent = no links, e.g. in the dialog) */
  linkFor?: (w: ShownWarning) => string | null;
  renderLink?: (to: string, label: string) => ReactNode;
}) {
  if (!warnings.length) return null;
  return (
    <div className="space-y-3" aria-live="polite">
      {warnings.map((w) => {
        const to = linkFor && w.link ? linkFor(w) : null;
        const acceptLabel = w.accept?.label ?? w.usePlan?.label;
        const done = accepted.includes(w.id);
        return (
          <Callout key={w.id} tone={done ? 'good' : w.tone} title={w.title}>
            <p>{w.body}</p>
            {((acceptLabel && onAccept) || (to && renderLink)) && (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                {acceptLabel && onAccept && (
                  <Button type="button" size="sm" variant={done ? 'ghost' : 'secondary'} disabled={done} loading={busy === w.id} onClick={() => onAccept(w)}>
                    {done ? 'Done' : acceptLabel}
                  </Button>
                )}
                {to && renderLink && w.link && renderLink(to, w.link.label)}
              </div>
            )}
            {w.confirm && !done && <Checkbox className="mt-3" checked={acked.includes(w.id)} onChange={(e) => onToggle(w.id, e.target.checked)} label={w.confirm} />}
          </Callout>
        );
      })}
    </div>
  );
}

/** The warnings still holding an action: a warning with a "... anyway" choice, neither accepted nor ticked. */
export const openWarnings = <W extends ShownWarning>(warnings: readonly W[], acked: readonly string[], accepted: readonly string[] = []): W[] =>
  warnings.filter((w) => w.tone === 'warning' && !!w.confirm && !acked.includes(w.id) && !accepted.includes(w.id));
