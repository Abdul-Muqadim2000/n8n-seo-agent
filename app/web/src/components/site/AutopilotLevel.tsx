// "How much should we do on our own?" (SCHEDULING_KEYWORDS_PLAN.md §5.5) after onboarding: the three levels with each one's monthly
// forecast, the save, and the notice when the auto-pause dropped the level to 1 after rejected pages (with the way back).
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Bot, Hand, PenSquare } from 'lucide-react';
import { AUTOPILOT_LEVELS, autopilotMonthlyUsd, DEFAULT_AUTOPILOT_LEVEL, REJECT_LIMIT, REJECT_WINDOW, type AutopilotLevel, type MonitorSettings } from '@seo/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { ChoiceCard } from '@/components/ui/field';
import { toastError } from '@/lib/api';
import { creditsLabel } from '@/lib/credits';
import { fmtDate } from '@/lib/utils';
import { useUpdateAutomation } from '@/lib/queries';
import { completeMonitors } from './MonitorSettingsFields';

export const LEVEL_ICON: Record<AutopilotLevel, ReactNode> = { 1: <Hand className="size-4" />, 2: <PenSquare className="size-4" />, 3: <Bot className="size-4" /> };

/** The three levels as radio cards, each with its monthly forecast (the same rows as the settings card and the Credits page). */
export function LevelChoices({
  value,
  onChange,
  monitors,
  pagesPerWeek,
  writing,
  ranking = false,
  disabled,
  labelledBy,
}: {
  value: AutopilotLevel;
  onChange: (l: AutopilotLevel) => void;
  monitors: Partial<MonitorSettings> | null | undefined;
  pagesPerWeek: number;
  /** a keyword the client chose still has pages to write */
  writing: boolean;
  /** the website has a keyword ladder (its weekly rank check is in the forecast, as on the Credits page) */
  ranking?: boolean;
  disabled?: boolean;
  labelledBy?: string;
}) {
  const m = completeMonitors(monitors ?? {});
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : 'How much should we do on our own?'} className="grid gap-2">
      {AUTOPILOT_LEVELS.map((l) => (
        <ChoiceCard
          key={l.level}
          selected={value === l.level}
          onSelect={() => onChange(l.level)}
          disabled={disabled}
          icon={LEVEL_ICON[l.level]}
          title={`${l.level}. ${l.label}`}
          badge={l.level === DEFAULT_AUTOPILOT_LEVEL ? <Badge tone="accent">Recommended</Badge> : undefined}
          description={
            <>
              {l.summary}
              <span className="mt-1 block text-ink-3">About {creditsLabel(autopilotMonthlyUsd(m, pagesPerWeek, { level: l.level, writing, ranking }))} a month with your current settings.</span>
            </>
          }
        />
      ))}
    </div>
  );
}

/** The level picker with its save (admins), used in Website settings and the Pipeline's settings. */
export function AutopilotLevelPicker({
  orgId,
  siteId,
  level,
  dropped,
  monitors,
  pagesPerWeek,
  writing,
  ranking = false,
  admin,
  onSaved,
}: {
  orgId: string;
  siteId: string;
  level: AutopilotLevel;
  /** the auto-pause dropped the level to 1 (and from which level) */
  dropped: { at: string; from: number } | null;
  monitors: Partial<MonitorSettings> | null | undefined;
  pagesPerWeek: number;
  writing: boolean;
  ranking?: boolean;
  admin: boolean;
  onSaved?: () => void;
}) {
  const save = useUpdateAutomation(orgId, siteId);
  const [value, setValue] = useState<AutopilotLevel>(level);
  const submit = (l: AutopilotLevel = value) =>
    save.mutate(
      { autopilotLevel: l },
      {
        onSuccess: () => {
          toast.success(`Autopilot level ${l}: ${AUTOPILOT_LEVELS.find((x) => x.level === l)!.label}`, { description: 'Your next weekly run uses it. Coming up shows what it means before anything is written.' });
          onSaved?.();
        },
        onError: (e) => toastError(e, 'The level was not saved'),
      },
    );
  const from = dropped ? (Math.min(3, Math.max(2, dropped.from)) as AutopilotLevel) : null;
  return (
    <div className="space-y-4">
      {dropped && from && level === 1 && (
        <Callout
          tone="warning"
          title="We now write only for your keywords"
          action={
            admin ? (
              <Button size="sm" variant="secondary" loading={save.isPending && value === from} onClick={() => (setValue(from), submit(from))}>
                Back to level {from}
              </Button>
            ) : undefined
          }
        >
          <span className="flex items-start gap-1.5">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              You marked {REJECT_LIMIT} of the last {REJECT_WINDOW} pages we chose on our own as not what you wanted, so on {fmtDate(dropped.at)} we went from level {dropped.from} to
              level 1. Raise it again when you are ready.
            </span>
          </span>
        </Callout>
      )}
      <LevelChoices value={value} onChange={setValue} monitors={monitors} pagesPerWeek={pagesPerWeek} writing={writing} ranking={ranking} disabled={!admin} />
      {admin && (
        <div className="flex justify-end">
          <Button size="sm" loading={save.isPending} disabled={value === level} onClick={() => submit()}>
            Save level
          </Button>
        </div>
      )}
    </div>
  );
}
