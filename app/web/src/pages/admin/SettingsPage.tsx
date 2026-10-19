import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { toast } from 'sonner';
import { Calculator, Coins, Settings } from 'lucide-react';
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
import { credits, money, workedExample } from './lib';

type Values = z.input<typeof platformSettingsSchema>;

export default function AdminSettingsPage() {
  const q = useAdminSettings();
  return (
    <>
      <AdminPageHeader icon={<Settings />} title="Settings" description="How runs turn into credits, what new companies start with, and the password reset tool." />
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

function SettingsForm({ s }: { s: PlatformSettings }) {
  const save = useAdminSaveSettings();
  const form = useForm<Values, unknown, z.output<typeof platformSettingsSchema>>({
    resolver: zodResolver(platformSettingsSchema),
    defaultValues: { creditValueUsd: s.creditValueUsd, markup: s.markup, signupCredits: s.signupCredits, enforceForNewCompanies: s.enforceForNewCompanies },
  });
  useEffect(() => {
    form.reset({ creditValueUsd: s.creditValueUsd, markup: s.markup, signupCredits: s.signupCredits, enforceForNewCompanies: s.enforceForNewCompanies });
  }, [s, form]);
  const [exampleCost, setExampleCost] = useState(0.8);
  const creditValue = Number(form.watch('creditValueUsd'));
  const markup = Number(form.watch('markup'));
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
        <div className="border-t border-line px-5">
          <Controller
            control={form.control}
            name="enforceForNewCompanies"
            render={({ field }) => (
              <SwitchRow
                title="Enforce credits for new companies"
                description="On: a new company’s runs are refused when its balance cannot cover them. Off: credits are counted but never block a run. Existing companies keep their own setting."
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
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
        </div>
        {save.isError && !(save.error instanceof ApiRequestError && Object.keys(save.error.fields).length) && (
          <div className="px-5 pb-4">
            <Callout tone="critical">{errorMessage(save.error)}</Callout>
          </div>
        )}
      </SettingsCard>
    </form>
  );
}
