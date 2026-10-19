import { useEffect, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { toast } from 'sonner';
import { AlertTriangle, Calculator, Coins, Package, Plus, Settings, Trash2 } from 'lucide-react';
import { DEFAULT_PLATFORM_SETTINGS, platformSettingsSchema, type PlatformSettings } from '@seo/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Callout, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { SwitchRow } from '@/components/ui/tabs';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { useAdminSaveSettings, useAdminSettings } from '@/lib/queries';
import { runCost } from '@/lib/prices';
import { fmtDateTime } from '@/lib/utils';
import { AdminPageHeader, Num } from './_components/kit';
import { ResetLinkCard } from './_components/tools';
import { SettingsCard } from '@/pages/settings/_components/SettingsCard';
import { credits, money, multipleLabel, packEconomics, rateSentence, workedExample } from './lib';

type Values = z.input<typeof platformSettingsSchema>;

export default function AdminSettingsPage() {
  const q = useAdminSettings();
  return (
    <>
      <AdminPageHeader icon={<Settings />} title="Settings" description="How runs turn into credits, the packs customers can buy, what new companies start with, and the password reset tool." />
      {q.isPending ? (
        <Skeleton className="h-80" />
      ) : q.isError || !q.data ? (
        <Card>
          <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load the settings" />
        </Card>
      ) : (
        <SettingsForm s={q.data} />
      )}
      <ResetLinkCard className="mt-6" />
    </>
  );
}

const formValues = (s: PlatformSettings): Values => ({
  creditValueUsd: s.creditValueUsd,
  markup: s.markup,
  signupCredits: s.signupCredits,
  enforceForNewCompanies: s.enforceForNewCompanies,
  // an older server (or a fixture) may answer without the credit fields: the defaults fill them
  creditPacks: (s.creditPacks ?? DEFAULT_PLATFORM_SETTINGS.creditPacks).map((p) => ({ ...p })),
  packExpiryMonths: s.packExpiryMonths ?? DEFAULT_PLATFORM_SETTINGS.packExpiryMonths,
  planRollover: s.planRollover ?? DEFAULT_PLATFORM_SETTINGS.planRollover,
  signupExpiryDays: s.signupExpiryDays ?? DEFAULT_PLATFORM_SETTINGS.signupExpiryDays,
});

function SettingsForm({ s }: { s: PlatformSettings }) {
  const save = useAdminSaveSettings();
  const form = useForm<Values, unknown, z.output<typeof platformSettingsSchema>>({
    resolver: zodResolver(platformSettingsSchema),
    defaultValues: formValues(s),
  });
  useEffect(() => {
    form.reset(formValues(s));
  }, [s, form]);
  const packs = useFieldArray({ control: form.control, name: 'creditPacks' });
  const [exampleCost, setExampleCost] = useState(0.8);
  const creditValue = Number(form.watch('creditValueUsd'));
  const markup = Number(form.watch('markup'));
  const watchedPacks = form.watch('creditPacks') ?? [];
  const valid = Number.isFinite(creditValue) && creditValue > 0 && Number.isFinite(markup) && markup >= 1;
  const ex = valid ? workedExample(exampleCost, { creditValueUsd: creditValue, markup }) : null;
  const page = valid ? workedExample(runCost('keyword'), { creditValueUsd: creditValue, markup }) : null;
  const err = form.formState.errors;
  const submit = form.handleSubmit((v) =>
    save.mutate(v, {
      onSuccess: () => toast.success('Settings saved. New runs use them; past runs keep the credits they used.'),
      onError: (e) => {
        if (e instanceof ApiRequestError) for (const [k, m] of Object.entries(e.fields)) form.setError(k as keyof Values, { message: m });
      },
    }),
  );
  const packsError = err.creditPacks?.message ?? err.creditPacks?.root?.message;

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <SettingsCard icon={<Coins />} title="Credits" description="A run uses cost × markup ÷ credit value credits. The same run always uses the same credits, whatever the provider bills later.">
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-3">
          <Field label="Credit value ($)" hint="List price of one credit." error={err.creditValueUsd?.message}>
            {(p) => <Input {...p} type="number" inputMode="decimal" step="0.001" min={0.001} className="font-mono" {...form.register('creditValueUsd', { valueAsNumber: true })} />}
          </Field>
          <Field label="Markup (×)" hint="1 = at cost." error={err.markup?.message}>
            {(p) => <Input {...p} type="number" inputMode="decimal" step="0.1" min={1} className="font-mono" {...form.register('markup', { valueAsNumber: true })} />}
          </Field>
          <Field label="Sign-up credits" hint="What a new company starts with." error={err.signupCredits?.message}>
            {(p) => <Input {...p} type="number" inputMode="numeric" step="1" min={0} className="font-mono" {...form.register('signupCredits', { valueAsNumber: true })} />}
          </Field>
        </div>
        {valid && (
          <p className="-mt-1 px-5 pb-4 text-[13px] text-ink-3">
            <Num className="text-[13px] text-ink-2">{rateSentence({ creditValueUsd: creditValue, markup })}</Num>.
          </p>
        )}
        <div className="border-t border-line px-5">
          <Controller
            control={form.control}
            name="enforceForNewCompanies"
            render={({ field }) => (
              <SwitchRow
                title="Enforce credits for new companies"
                description="On: a new company's runs are refused when its balance cannot cover them. Off: credits are counted but never block a run. Existing companies keep their own setting."
                checked={!!field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>
        <div className="border-t border-line bg-surface-2/50 px-5 py-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
            <Calculator className="size-4 text-ink-3" aria-hidden />
            Worked example
          </p>
          {ex ? (
            <div className="space-y-2 text-sm text-ink-2">
              <div className="flex flex-wrap items-center gap-2">
                <span>A run that costs us</span>
                <label className="sr-only" htmlFor="example-cost">
                  Example run cost in dollars
                </label>
                <Input
                  id="example-cost"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={Number.isFinite(exampleCost) ? exampleCost : ''}
                  onChange={(e) => setExampleCost(Number(e.target.value))}
                  className="h-8 w-24 font-mono"
                />
                <span>
                  uses <Num className="font-semibold text-ink">{credits(ex.credits)}</Num> credits = <Num className="font-semibold text-ink">{money(ex.listUsd)}</Num> at list price, margin{' '}
                  <Num className="font-semibold text-ink">{money(ex.marginUsd)}</Num>
                  {ex.marginPct != null && <Num className="text-ink-3"> ({ex.marginPct.toFixed(0)}%)</Num>}.
                </span>
              </div>
              {page && (
                <p className="text-[13px] text-ink-3">
                  A written page (about {money(runCost('keyword'), { digits: 2 })} to us) uses {credits(page.credits)} credits; 100 credits buy about {page.credits > 0 ? Math.floor(100 / page.credits) : 0} of them.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-ink-3">Enter a credit value above 0 and a markup of at least 1.</p>
          )}
        </div>
      </SettingsCard>

      <SettingsCard
        icon={<Package />}
        title="Packs and expiry"
        description="The packs customers can ask for on their Credits page, and how long credits last. A discount lowers the margin on that pack's credits below the markup."
      >
        <div className="px-5 py-4">
          <div className="hidden gap-3 pb-1.5 text-xs font-medium text-ink-3 sm:grid sm:grid-cols-[minmax(0,1fr)_120px_100px_minmax(0,1.2fr)_36px]">
            <span>Pack id</span>
            <span>Credits</span>
            <span>Discount %</span>
            <span>Price · margin</span>
            <span className="sr-only">Remove</span>
          </div>
          <ul className="space-y-3 sm:space-y-2">
            {packs.fields.map((f, i) => {
              const w = watchedPacks[i];
              const pe = err.creditPacks?.[i];
              const econ =
                valid && w && Number.isFinite(Number(w.credits)) && Number(w.credits) > 0
                  ? packEconomics({ id: String(w.id ?? ''), credits: Number(w.credits), discountPct: Number(w.discountPct ?? 0) || 0 }, { creditValueUsd: creditValue, markup })
                  : null;
              return (
                <li key={f.id} className="grid grid-cols-2 items-start gap-3 rounded-lg border border-line p-3 sm:grid-cols-[minmax(0,1fr)_120px_100px_minmax(0,1.2fr)_36px] sm:border-0 sm:p-0">
                  <Field label={<span className="sm:sr-only">Pack id</span>} error={pe?.id?.message} className="col-span-2 sm:col-span-1">
                    {(p) => <Input {...p} autoComplete="off" spellCheck={false} className="font-mono" placeholder="standard" {...form.register(`creditPacks.${i}.id` as const)} />}
                  </Field>
                  <Field label={<span className="sm:sr-only">Credits</span>} error={pe?.credits?.message}>
                    {(p) => <Input {...p} type="number" inputMode="numeric" min={10} step={1} className="font-mono" {...form.register(`creditPacks.${i}.credits` as const, { valueAsNumber: true })} />}
                  </Field>
                  <Field label={<span className="sm:sr-only">Discount %</span>} error={pe?.discountPct?.message}>
                    {(p) => <Input {...p} type="number" inputMode="decimal" min={0} max={50} step={1} className="font-mono" {...form.register(`creditPacks.${i}.discountPct` as const, { valueAsNumber: true })} />}
                  </Field>
                  <div className="col-span-2 min-w-0 text-[13px] leading-snug sm:col-span-1 sm:pt-2">
                    {econ ? (
                      <>
                        <span className="text-ink-2">
                          <Num className="text-ink">{money(econ.priceUsd, { digits: 2 })}</Num> · <Num>{money(econ.perCreditUsd)}</Num> a credit · <Num className={econ.belowMarkup ? 'text-warning-text' : 'text-ink'}>{multipleLabel(econ.multiple)}</Num> cost
                        </span>
                        {econ.belowMarkup && (
                          <span className="mt-0.5 flex items-start gap-1 text-xs text-warning-text">
                            <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                            This pack earns {multipleLabel(econ.multiple)} the provider cost, not {multipleLabel(markup)}.
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-ink-3">-</span>
                    )}
                  </div>
                  <div className="col-span-2 flex justify-end sm:col-span-1 sm:pt-0.5">
                    <Button variant="ghost" size="sm" disabled={packs.fields.length <= 1} onClick={() => packs.remove(i)} aria-label={`Remove pack ${w?.id || i + 1}`} icon={<Trash2 className="size-4" />}>
                      <span className="sm:sr-only">Remove</span>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          {packsError && <Callout tone="critical" className="mt-3">{packsError}</Callout>}
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            icon={<Plus className="size-4" />}
            disabled={packs.fields.length >= 8}
            onClick={() => packs.append({ id: `pack${packs.fields.length + 1}`, credits: 1000, discountPct: 0 })}
          >
            Add a pack
          </Button>
        </div>
        <div className="grid gap-4 border-t border-line px-5 py-4 sm:grid-cols-2">
          <Field label="A pack lasts (months)" hint="From the day it is confirmed." error={err.packExpiryMonths?.message}>
            {(p) => <Input {...p} type="number" inputMode="numeric" min={1} max={60} step={1} className="font-mono" {...form.register('packExpiryMonths', { valueAsNumber: true })} />}
          </Field>
          <Field label="Welcome credits last (days)" hint="0 = they never expire." error={err.signupExpiryDays?.message}>
            {(p) => <Input {...p} type="number" inputMode="numeric" min={0} max={3650} step={1} className="font-mono" {...form.register('signupExpiryDays', { valueAsNumber: true })} />}
          </Field>
        </div>
        <div className="border-t border-line px-5">
          <Controller
            control={form.control}
            name="planRollover"
            render={({ field }) => (
              <SwitchRow
                title="Plan credits roll over one month"
                description="On: a plan's unused monthly credits stay one more month, then expire. Off: they expire at the end of their month. Applies to plan credits granted from now on."
                checked={!!field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>
      </SettingsCard>

      <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <p className="text-xs text-ink-3">
          {s.updatedAt ? (
            <>
              Last changed {fmtDateTime(s.updatedAt)}
              {s.updatedBy ? ` by ${s.updatedBy}` : ''}
            </>
          ) : (
            <>Never changed: the defaults ({money(DEFAULT_PLATFORM_SETTINGS.creditValueUsd)} a credit, ×{DEFAULT_PLATFORM_SETTINGS.markup}).</>
          )}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={!form.formState.isDirty || save.isPending} onClick={() => form.reset()}>
            Discard
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!form.formState.isDirty}>
            Save settings
          </Button>
        </div>
        {save.isError && !(save.error instanceof ApiRequestError && Object.keys(save.error.fields).length) && (
          <Callout tone="critical" className="w-full">
            {errorMessage(save.error)}
          </Callout>
        )}
      </Card>
    </form>
  );
}
