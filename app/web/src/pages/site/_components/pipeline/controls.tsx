// The person's controls over the keyword ladders (admins): Auto / Manual, Pause / Resume, the priority order, delete — and the
// website's pipeline settings. Everything is written to the SEO engine's ladder settings and read by the Monday run.
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Hand, PauseCircle, Play, Settings2, Trash2, Zap } from 'lucide-react';
import { MAX_ACTIVE_LADDERS, MAX_WAITING_PAGES, siteAutomationFormSchema, type LadderCard, type LadderMode, type SiteAutomation, type SiteAutomationForm } from '@seo/shared';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { Field, Select } from '@/components/ui/field';
import { Dialog } from '@/components/ui/overlay';
import { Segmented, Switch } from '@/components/ui/tabs';
import { errorMessage } from '@/lib/api';
import { useOrgCtx, useSiteCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { useDeleteLadder, useReorderLadders, useUpdateAutomation, useUpdateLadder } from '@/lib/queries';
import { cn } from '@/lib/utils';

/** One plain sentence per mode. */
export const MODE_HELP: Record<LadderMode, string> = {
  auto: 'Auto: its pages are written on Mondays, in priority order.',
  manual: 'Manual: each page waits for your OK under Needs you.',
};

export const MODE_OPTIONS = (size: 'sm' | 'md') => [
  { value: 'auto' as const, label: <><Zap className={size === 'sm' ? 'size-3' : 'size-3.5'} aria-hidden />Auto</> },
  { value: 'manual' as const, label: <><Hand className={size === 'sm' ? 'size-3' : 'size-3.5'} aria-hidden />Manual</> },
];

/** Auto / Manual for one ladder. */
export function LadderModeSwitch({ ladder, size = 'sm', className }: { ladder: Pick<LadderCard, 'id' | 'head' | 'mode'>; size?: 'sm' | 'md'; className?: string }) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const update = useUpdateLadder(org.id, site.id);
  // shown at once; back to the saved mode if the change fails
  const [pending, setPending] = useState<LadderMode | null>(null);
  const value = pending ?? ladder.mode;
  const change = (mode: LadderMode) => {
    setPending(mode);
    update.mutate(
      { ladderId: ladder.id, mode },
      {
        onSuccess: () => toast.success(mode === 'manual' ? `“${ladder.head}” is Manual: each page waits for your OK` : `“${ladder.head}” is Auto: its pages are written on Mondays`),
        onError: (e) => toast.error(errorMessage(e)),
        onSettled: () => setPending(null),
      },
    );
  };
  return <Segmented label={`Writing mode of the keyword ladder “${ladder.head}”`} size={size} value={value} onChange={change} options={MODE_OPTIONS(size)} disabled={update.isPending} className={className} />;
}

/** Pause / Resume for one ladder (not for a won ladder: nothing more is written for it anyway). */
export function LadderPauseButton({ ladder, size = 'sm' }: { ladder: Pick<LadderCard, 'id' | 'head' | 'status'>; size?: 'sm' | 'md' }) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const update = useUpdateLadder(org.id, site.id);
  if (ladder.status === 'won') return null;
  const paused = ladder.status === 'paused';
  const go = () =>
    update.mutate(
      { ladderId: ladder.id, status: paused ? 'active' : 'paused' },
      {
        onSuccess: () => toast.success(paused ? `“${ladder.head}” resumed: back in its place in the order` : `“${ladder.head}” paused: no new pages, positions are still checked`),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  return (
    <Button variant="secondary" size={size} icon={paused ? <Play className="size-4" /> : <PauseCircle className="size-4" />} loading={update.isPending} onClick={go}>
      {paused ? 'Resume' : 'Pause'}
    </Button>
  );
}

/** Move up / Move down in the priority order (the order of `cards`). */
export function LadderMoveButtons({ cards, index }: { cards: LadderCard[]; index: number }) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const reorder = useReorderLadders(org.id, site.id);
  const c = cards[index];
  const move = (to: number) => {
    const ids = cards.map((x) => x.id);
    ids.splice(index, 1);
    ids.splice(to, 0, c.id);
    reorder.mutate(ids, {
      onSuccess: () => toast.success(`“${c.head}” is now number ${to + 1}`),
      onError: (e) => toast.error(errorMessage(e)),
    });
  };
  const btn = 'size-8';
  return (
    <span className="inline-flex gap-1">
      <Button variant="secondary" size="icon" className={btn} disabled={index === 0 || reorder.isPending} onClick={() => move(index - 1)} aria-label={`Move “${c.head}” up`} title="Move up: gets the weekly posts earlier">
        <ArrowUp className="size-4" />
      </Button>
      <Button variant="secondary" size="icon" className={btn} disabled={index === cards.length - 1 || reorder.isPending} onClick={() => move(index + 1)} aria-label={`Move “${c.head}” down`} title="Move down: gets the weekly posts later">
        <ArrowDown className="size-4" />
      </Button>
    </span>
  );
}

/** Delete a ladder, after a confirmation that says what is removed. */
export function DeleteLadderButton({ ladder }: { ladder: Pick<LadderCard, 'id' | 'head' | 'counts'> }) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const navigate = useNavigate();
  const remove = useDeleteLadder(org.id, site.id);
  const [open, setOpen] = useState(false);
  const written = ladder.counts.published + ladder.counts.waiting + ladder.counts.writing;
  const confirm = () =>
    remove.mutate(ladder.id, {
      onSuccess: () => {
        setOpen(false);
        toast.success(`The keyword ladder “${ladder.head}” was deleted`);
        navigate(paths.site(org.id, site.id, 'pipeline'), { replace: true });
      },
    });
  return (
    <>
      <Button variant="ghost" size="sm" className="text-critical-text hover:text-critical-text" icon={<Trash2 className="size-4" />} onClick={() => setOpen(true)}>
        Delete
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete the keyword ladder “${ladder.head}”?`}
        description="This cannot be undone. To work on this keyword again later, plan a new ladder."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" icon={<Trash2 className="size-4" />} loading={remove.isPending} onClick={confirm}>
              Delete ladder
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm leading-relaxed text-ink-2">
          <p className="font-medium text-ink">Removed from the SEO engine:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>the plan: {ladder.counts.total} pages, and the pages not written yet are no longer written on Mondays;</li>
            <li>its settings (Auto / Manual, priority);</li>
            <li>its weekly rank checks and its position history.</li>
          </ul>
          <p className="font-medium text-ink">Kept:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>{written ? `the ${written === 1 ? 'page' : `${written} pages`} already written, in your reports and on the Content page` : 'your reports, including the ladder plan'};</li>
            <li>published pages stay on your website.</li>
          </ul>
          {remove.isError && <Callout tone="critical">{errorMessage(remove.error)}</Callout>}
        </div>
      </Dialog>
    </>
  );
}

// ---------- the website's pipeline settings ----------
const DEFAULTS: SiteAutomation = { defaultMode: 'auto', opportunities: 'auto', autoStartLadders: false, maxActiveLadders: 2, maxWaiting: 3 };
type Form = SiteAutomationForm;
const range = (r: { min: number; max: number }) => Array.from({ length: r.max - r.min + 1 }, (_, i) => r.min + i);

function SettingRow({ title, help, children, className }: { title: string; help: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6', className)}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{help}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** "Pipeline settings" button + dialog (admins). */
export function PipelineSettingsButton({ automation, autoStartEnabled = true }: { automation: SiteAutomation | undefined; autoStartEnabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" icon={<Settings2 className="size-4" />} onClick={() => setOpen(true)}>
        Pipeline settings
      </Button>
      {open && <PipelineSettingsDialog automation={automation ?? DEFAULTS} autoStartEnabled={autoStartEnabled} onClose={() => setOpen(false)} />}
    </>
  );
}

function PipelineSettingsDialog({ automation, autoStartEnabled, onClose }: { automation: SiteAutomation; autoStartEnabled: boolean; onClose: () => void }) {
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const save = useUpdateAutomation(org.id, site.id);
  const current: Form = {
    defaultMode: automation.defaultMode,
    opportunities: automation.opportunities,
    autoStartLadders: automation.autoStartLadders,
    maxActiveLadders: automation.maxActiveLadders,
    maxWaiting: automation.maxWaiting,
  };
  const { control, handleSubmit, formState, reset } = useForm<Form>({ resolver: zodResolver(siteAutomationFormSchema), defaultValues: current });
  const submit = handleSubmit((v) =>
    save.mutate(v, {
      onSuccess: () => {
        toast.success('Pipeline settings saved: the next Monday run uses them');
        onClose();
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );
  const isDefault = (Object.keys(current) as (keyof Form)[]).every((k) => current[k] === DEFAULTS[k]);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Pipeline settings"
      description={`How the weekly run works for ${site.domain}. Changes count from the next Monday.`}
      footer={
        <>
          {!isDefault && (
            <Button variant="ghost" className="mr-auto" onClick={() => reset({ defaultMode: 'auto', opportunities: 'auto', autoStartLadders: false, maxActiveLadders: 2, maxWaiting: 3 }, { keepDefaultValues: true })}>
              Use the recommended values
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} disabled={!formState.isDirty} onClick={submit}>
            Save
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="divide-y divide-line">
        <SettingRow title="New keyword ladders" help="Auto writes their pages on Mondays; Manual waits for your OK on each page. You can change it per ladder." className="pt-0">
          <Controller name="defaultMode" control={control} render={({ field }) => <Segmented label="New keyword ladders" value={field.value} onChange={field.onChange} options={MODE_OPTIONS('md')} />} />
        </SettingRow>
        <SettingRow title="Opportunity posts" help="Posts for searches close to page one and rising searches. Auto fills the weekly posts the ladders leave free; Manual only suggests them.">
          <Controller name="opportunities" control={control} render={({ field }) => <Segmented label="Opportunity posts" value={field.value} onChange={field.onChange} options={MODE_OPTIONS('md')} />} />
        </SettingRow>
        <SettingRow
          title="Choose keywords for me"
          help="When fewer ladders than your limit are being written, start the next recommended keyword that is easy or reachable for your site. Each new ladder costs about $1.80 plus its weekly pages."
        >
          <Controller
            name="autoStartLadders"
            control={control}
            render={({ field }) => (
              <span className="flex flex-col items-start gap-1 sm:items-end">
                <span className="inline-flex items-center gap-2">
                  <Switch checked={field.value} onCheckedChange={field.onChange} label="Choose keywords for me" />
                  <span className="text-[13px] text-ink-2">{field.value ? 'On' : 'Off'}</span>
                </span>
                {field.value && !autoStartEnabled && <span className="max-w-[14rem] text-xs leading-snug text-ink-3 sm:text-right">Automatic starts are not switched on for this platform yet: the setting is kept and applies once they are.</span>}
              </span>
            )}
          />
        </SettingRow>
        <SettingRow title="Ladders written at the same time" help="Focus wins: the first ladders in the order get the weekly posts, the others wait as Queued. Recommended: 2.">
          <Controller
            name="maxActiveLadders"
            control={control}
            render={({ field, fieldState }) => (
              <Field error={fieldState.error?.message} className="w-36">
                {(p) => (
                  <Select {...p} aria-label="Ladders written at the same time" value={field.value} onChange={(e) => field.onChange(Number(e.target.value))}>
                    {range(MAX_ACTIVE_LADDERS).map((n) => (
                      <option key={n} value={n}>
                        {n === 1 ? '1 ladder' : `${n} ladders`}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
          />
        </SettingRow>
        <SettingRow title="Stop writing when pages wait to be published" help="No new page is written while this many pages wait for you to publish them: it saves paying for pages nobody puts live. Recommended: 3." className="pb-0">
          <Controller
            name="maxWaiting"
            control={control}
            render={({ field, fieldState }) => (
              <Field error={fieldState.error?.message} className="w-36">
                {(p) => (
                  <Select {...p} aria-label="Stop writing when this many pages wait" value={field.value} onChange={(e) => field.onChange(Number(e.target.value))}>
                    {range(MAX_WAITING_PAGES).map((n) => (
                      <option key={n} value={n}>
                        {n === 1 ? '1 page' : `${n} pages`}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
          />
        </SettingRow>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
