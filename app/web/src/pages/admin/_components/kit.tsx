// Building blocks of the platform admin panel: money and credit cells (Geist Mono), status and certainty badges, the daily cost chart,
// the provider bill card, the confirm dialog (typed confirmation for deletes) and the credit dialog. Built on the app's own kit.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { z } from 'zod';
import { CircleDashed, CheckCircle2, Info, Receipt } from 'lucide-react';
import {
  adminCreditSchema,
  creditsFor,
  type AdminCompanyRow,
  type AdminDailyPoint,
  type CreditPurchaseRequest,
  type CostCertainty,
  type CostSplit,
  type ProviderBill,
} from '@seo/shared';
import { BarsChart, ChartCard, StackedBarsLineChart, type Series } from '@/components/charts';
import { Segmented } from '@/components/ui/tabs';
import { DataTable } from '@/components/ui/table';
import { InfoTip } from '@/components/insight';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Callout } from '@/components/ui/feedback';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Dialog } from '@/components/ui/overlay';
import { PageHeader } from '@/components/ui/misc';
import { pageTitle } from '@/components/layout/Brand';
import { useDocumentTitle } from '@/components/layout/useDocumentTitle';
import { runCost } from '@/lib/prices';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { useAdminCompanyCredit, useAdminSettings } from '@/lib/queries';
import { cn, fmtDateTime, fmtDay } from '@/lib/utils';
import { axisUsd, balanceAfter, credits, cumulative, estimatedShare, expiresValue, initials, marginPct, money, ratioLabel, signedCredits, type ExpiryChoice } from '../lib';

export function AdminPageHeader({ title, description, actions, icon, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; icon?: ReactNode; eyebrow?: ReactNode }) {
  useDocumentTitle(pageTitle(title, 'Platform admin'));
  return <PageHeader title={title} description={description} actions={actions} icon={icon} eyebrow={eyebrow} />;
}

/** a number in Geist Mono with tabular figures */
export function Num({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <span className={cn('font-mono text-[13px] tabular', className)} title={title}>
      {children}
    </span>
  );
}

export function Money({ value, className, digits }: { value: number | null | undefined; className?: string; digits?: number }) {
  return <Num className={cn(value != null && value < 0 && 'text-critical-text', className)}>{money(value, { digits })}</Num>;
}

/** total on top, the provider split below (C = Claude, D = DataForSEO), the estimated part of Claude named */
export function CostSplitCell({ cost, align = 'right' }: { cost: CostSplit | null | undefined; align?: 'left' | 'right' }) {
  if (!cost) return <Num className="text-ink-3">not settled</Num>;
  const est = estimatedShare(cost);
  return (
    <span className={cn('inline-flex flex-col leading-tight', align === 'right' ? 'items-end' : 'items-start')}>
      <Money value={cost.totalUsd} className="text-ink" />
      <span className="mt-0.5 whitespace-nowrap font-mono text-[11px] text-ink-3 tabular" title={`Claude ${money(cost.claudeUsd)} · DataForSEO ${money(cost.dataforseoUsd)}`}>
        C {money(cost.claudeUsd)} · D {money(cost.dataforseoUsd)}
        {est != null && est > 0.005 && <span className="ml-1">({Math.round(est * 100)}% est.)</span>}
      </span>
    </span>
  );
}

const CERTAINTY: Record<CostCertainty, { label: string; tone: 'neutral' | 'accent'; icon: ReactNode; tip: string }> = {
  measured: { label: 'Measured', tone: 'neutral', icon: <CheckCircle2 className="size-3" aria-hidden />, tip: 'The providers’ own usage figures.' },
  'partly estimated': { label: 'Part estimated', tone: 'accent', icon: <Info className="size-3" aria-hidden />, tip: 'Part of the Claude cost is priced by the engine from text, because streaming model calls report no usage.' },
  estimated: { label: 'Estimated', tone: 'accent', icon: <Info className="size-3" aria-hidden />, tip: 'Priced by the engine from text and quotes; no provider figure.' },
  'not reported': { label: 'Not reported', tone: 'neutral', icon: <CircleDashed className="size-3" aria-hidden />, tip: 'The engine reported no cost for this run.' },
};

export function CertaintyBadge({ certainty }: { certainty: CostCertainty }) {
  const c = CERTAINTY[certainty] ?? CERTAINTY['not reported'];
  return (
    <span title={c.tip}>
      <Badge tone={c.tone} icon={c.icon}>
        {c.label}
      </Badge>
    </span>
  );
}

export function MarginValue({ marginUsd, pct, revenueUsd }: { marginUsd: number; pct: number | null; revenueUsd: number }) {
  return (
    <span className="inline-flex flex-col items-end leading-tight">
      <Money value={marginUsd} className={marginUsd >= 0 && revenueUsd > 0 ? 'text-ink' : undefined} />
      <span className="mt-0.5 font-mono text-[11px] text-ink-3 tabular">{marginPct(pct)}</span>
    </span>
  );
}

export function CompanyStatus({ row }: { row: Pick<AdminCompanyRow, 'disabled' | 'credits'> }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {row.disabled ? <StatusBadge tone="critical">Disabled</StatusBadge> : <StatusBadge tone="good">Active</StatusBadge>}
      {row.credits.enforced && <Badge tone="accent">Credits enforced</Badge>}
    </span>
  );
}

export function RowTile({ name, muted, className }: { name: string; muted?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold',
        muted ? 'bg-surface-2 text-ink-3' : 'bg-ink-surface text-on-ink dark:bg-surface-3 dark:text-ink',
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/** a titled card section of an admin page */
export function AdminCard({ title, description, actions, children, className, bodyClassName, info }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string; info?: ReactNode }) {
  return (
    <Card className={cn('min-w-0', className)}>
      <CardHeader
        title={
          info ? (
            <span className="inline-flex items-center gap-1">
              {title}
              {info}
            </span>
          ) : (
            title
          )
        }
        description={description}
        actions={actions}
      />
      <div className={cn('px-5 pb-5 pt-3', bodyClassName)}>{children}</div>
    </Card>
  );
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// ---------- the daily cost chart ----------
// Revenue arrives in lumps (a grant on one day) while cost trickles in daily, so one per-day scale flattens the cost to nothing. Two
// views: running totals (cost stacked by provider, revenue as the line: the gap between them is the margin so far) and cost per day
// (stacked by provider, no revenue). The table view lists every day with its revenue either way.
const usdSeries = (key: string, label: string, shape: 'rect' | 'line'): Series => ({ key, label, format: (v) => money(v), shape });
const COST_SERIES: Series[] = [usdSeries('claudeUsd', 'Claude', 'rect'), usdSeries('dataforseoUsd', 'DataForSEO', 'rect')];
const REVENUE_SERIES = usdSeries('revenueUsd', 'Revenue', 'line');

export function DailyCostChart({ daily, loading, title = 'Cost and revenue', description, className }: { daily: AdminDailyPoint[]; loading?: boolean; title?: ReactNode; description?: ReactNode; className?: string }) {
  const [view, setView] = useState<'total' | 'day'>('total');
  const rows = useMemo(() => (view === 'total' ? cumulative(daily) : daily) as unknown as Record<string, unknown>[], [daily, view]);
  const table = daily as unknown as Record<string, unknown>[];
  return (
    <ChartCard
      className={className}
      title={title}
      description={
        description ??
        (view === 'total'
          ? 'Running totals in USD: cost to us stacked by provider, revenue recorded with credit grants as the line. The gap is the margin so far.'
          : 'Cost to us per day in USD, stacked by provider. Revenue arrives with grants; it is in the table view.')
      }
      series={view === 'total' ? [...COST_SERIES, REVENUE_SERIES] : COST_SERIES}
      loading={loading}
      actions={
        <Segmented
          size="sm"
          label="Chart view"
          value={view}
          onChange={setView}
          options={[
            { value: 'total', label: 'Running total' },
            { value: 'day', label: 'Cost per day' },
          ]}
        />
      }
      table={{
        columns: [
          { key: 'date', label: 'Day', format: (v) => <Num>{String(v)}</Num> },
          { key: 'claudeUsd', label: 'Claude', align: 'right', format: (v) => <Money value={Number(v)} /> },
          { key: 'dataforseoUsd', label: 'DataForSEO', align: 'right', format: (v) => <Money value={Number(v)} /> },
          { key: 'revenueUsd', label: 'Revenue', align: 'right', format: (v) => <Money value={Number(v)} /> },
          { key: 'runs', label: 'Runs', align: 'right', format: (v) => <Num>{String(v)}</Num> },
        ],
        rows: [...table].reverse(),
      }}
    >
      {!daily.length ? (
        <p className="flex h-[260px] items-center justify-center text-sm text-ink-3">No cost and no revenue in this period.</p>
      ) : view === 'total' ? (
        <StackedBarsLineChart data={rows} xKey="date" bars={COST_SERIES} line={REVENUE_SERIES} yFormat={axisUsd} xFormat={(v) => fmtDay(String(v))} />
      ) : (
        <BarsChart data={rows} categoryKey="date" series={COST_SERIES} stacked valueFormat={axisUsd} categoryFormat={(v) => fmtDay(String(v))} height={260} />
      )}
    </ChartCard>
  );
}

// ---------- what a provider billed vs what we attributed ----------
const PROVIDER_NAME = { anthropic: 'Claude (Anthropic)', dataforseo: 'DataForSEO' } as const;
const SOURCE_LABEL = { provider: 'from the provider', 'engine-ledger': 'from the engine ledger', unavailable: 'not readable' } as const;

export function ProviderBillCard({ bill, attributedSplit }: { bill: ProviderBill; attributedSplit?: { estimatedUsd?: number } }) {
  const billed = bill.billedUsd;
  const diff = billed != null ? billed - bill.attributedUsd : null;
  return (
    <Card className="flex min-w-0 flex-col p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
          <Receipt className="size-4 text-ink-3" aria-hidden />
          {PROVIDER_NAME[bill.provider]}
        </span>
        {bill.source === 'provider' ? (
          <StatusBadge tone="good">Bill read</StatusBadge>
        ) : bill.source === 'engine-ledger' ? (
          <Badge tone="accent" icon={<Info className="size-3" aria-hidden />}>
            Ledger only
          </Badge>
        ) : (
          <StatusBadge tone="neutral">No bill</StatusBadge>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-ink-3">Billed</dt>
          <dd className="mt-0.5 font-display text-xl font-semibold text-ink">{billed == null ? <span className="text-ink-3">not available</span> : money(billed)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Attributed to runs</dt>
          <dd className="mt-0.5 font-display text-xl font-semibold text-ink">{money(bill.attributedUsd)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Billed ÷ attributed</dt>
          <dd className="mt-0.5">
            <Num>{ratioLabel(bill.ratio)}</Num>
            {diff != null && <Num className="ml-2 text-ink-3">{diff >= 0 ? `+${money(diff)}` : money(diff)} unexplained</Num>}
          </dd>
        </div>
        {bill.provider === 'dataforseo' && (
          <div>
            <dt className="text-xs text-ink-3">Balance now</dt>
            <dd className="mt-0.5">
              <Money value={bill.balanceUsd ?? null} />
            </dd>
          </div>
        )}
        {bill.provider === 'anthropic' && attributedSplit?.estimatedUsd != null && (
          <div>
            <dt className="text-xs text-ink-3">Of which estimated</dt>
            <dd className="mt-0.5">
              <Money value={attributedSplit.estimatedUsd} />
            </dd>
          </div>
        )}
      </dl>
      <p className="mt-auto border-t border-line pt-2.5 text-xs leading-snug text-ink-3">
        {bill.note}
        <span className="block pt-1 font-mono text-[11px]">
          {SOURCE_LABEL[bill.source]}
          {bill.asOf ? ` · as of ${fmtDateTime(bill.asOf)}` : ''}
        </span>
      </p>
    </Card>
  );
}

// ---------- confirm ----------
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  danger,
  typed,
  typedLabel,
  onConfirm,
  pending,
  error,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  /** the exact text the person must type before the action is possible (a slug, an e-mail) */
  typed?: string;
  typedLabel?: ReactNode;
  onConfirm: () => void;
  pending?: boolean;
  error?: unknown;
  children?: ReactNode;
}) {
  const [value, setValue] = useState('');
  useEffect(() => {
    if (!open) setValue('');
  }, [open]);
  const ok = typed == null || value.trim() === typed;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={pending} disabled={!ok}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {(children || typed != null || error != null) && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (ok && !pending) onConfirm();
          }}
        >
          {children}
          {typed != null && (
            <Field
              label={
                // one inline span: the label is a flex row, so loose text and code would wrap as separate columns
                <span>{typedLabel ?? <>Type <code className="break-all font-mono text-[13px]">{typed}</code> to confirm</>}</span>
              }
            >
              {(p) => <Input {...p} value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" spellCheck={false} className="font-mono" />}
            </Field>
          )}
          {error != null && <Callout tone="critical">{errorMessage(error)}</Callout>}
        </form>
      )}
    </Dialog>
  );
}

// ---------- credits ----------
export type CreditKind = 'grant' | 'adjust' | 'refund';
const CREDIT_COPY: Record<CreditKind, { title: string; action: string; description: string }> = {
  grant: { title: 'Add credits', action: 'Add credits', description: 'Credits the company can spend on runs. Record the payment received, or 0 for free or promotional credits.' },
  adjust: { title: 'Adjust the balance', action: 'Adjust balance', description: 'Correct the balance up (positive) or down (negative). No payment is recorded.' },
  refund: { title: 'Refund credits', action: 'Refund credits', description: 'Give back credits that runs used (for example, a run that failed on our side). No payment is recorded.' },
};
type CreditValues = z.input<typeof adminCreditSchema>;

/** A customer's "Buy credits" request the dialog fulfils: the grant is pre-filled with its pack and price, and sends its id. */
export type CreditRequestPreset = Pick<CreditPurchaseRequest, 'id' | 'packId' | 'credits' | 'priceUsd' | 'requestedBy' | 'note'>;

export function CreditDialog({
  company,
  kind,
  onClose,
  request,
}: {
  /** the balance is shown when known (the requests page does not read it) */
  company: Pick<AdminCompanyRow, 'id' | 'name'> & { credits?: Pick<AdminCompanyRow['credits'], 'balance'> };
  kind: CreditKind;
  onClose: () => void;
  request?: CreditRequestPreset;
}) {
  const save = useAdminCompanyCredit();
  const settings = useAdminSettings();
  const copy = request ? { title: 'Confirm a credit request', action: 'Confirm and add credits', description: 'Adds the pack the customer asked for and records the payment as revenue. Confirm it once the invoice is paid.' } : CREDIT_COPY[kind];
  const form = useForm<CreditValues, unknown, z.output<typeof adminCreditSchema>>({
    resolver: zodResolver(adminCreditSchema),
    defaultValues: request
      ? { kind: 'grant', credits: request.credits, paidUsd: request.priceUsd, note: `${request.packId} pack${request.note ? ` · ${request.note}` : ''}`.slice(0, 500), expires: 'pack', requestId: request.id }
      : { kind, paidUsd: 0, note: '', expires: 'pack' },
  });
  const [expiry, setExpiry] = useState<ExpiryChoice>('pack');
  const [days, setDays] = useState(90);
  useEffect(() => {
    form.setValue('expires', expiresValue(expiry, days), { shouldValidate: form.formState.isSubmitted });
  }, [expiry, days, form]);
  const balance = company.credits?.balance;
  const amount = Number(form.watch('credits'));
  const paid = Number(form.watch('paidUsd') ?? 0);
  const has = Number.isFinite(amount) && amount !== 0;
  const after = has && balance != null ? balanceAfter(balance, kind, amount) : null;
  const pageCredits = settings.data ? creditsFor(runCost('keyword'), settings.data) : null;
  const pages = after != null && pageCredits ? Math.floor(after / pageCredits) : null;
  const packMonths = settings.data?.packExpiryMonths ?? 12;
  const submit = form.handleSubmit((v) =>
    save.mutate(
      { id: company.id, ...v },
      {
        onSuccess: (entry) => {
          toast.success(`${company.name}: ${signedCredits(entry?.credits ?? v.credits)} credits · balance ${credits(entry?.balanceAfter ?? after)}${request ? ' · request fulfilled' : ''}`);
          onClose();
        },
        onError: (e) => {
          if (e instanceof ApiRequestError) for (const [k, m] of Object.entries(e.fields)) form.setError(k as keyof CreditValues, { message: m });
        },
      },
    ),
  );
  const err = form.formState.errors;
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`${copy.title} · ${company.name}`}
      description={copy.description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="admin-credit-form" loading={save.isPending} disabled={!has}>
            {copy.action}
          </Button>
        </>
      }
    >
      <form id="admin-credit-form" onSubmit={submit} noValidate className="space-y-4">
        {request && (
          <Callout tone="info">
            {request.requestedBy ?? 'The customer'} asked for the {credits(request.credits)}-credit pack ({money(request.priceUsd, { digits: 2 })}). Confirming adds the credits and marks the
            request fulfilled.
          </Callout>
        )}
        <div className={cn('grid gap-4', kind === 'grant' && 'sm:grid-cols-2')}>
          <Field label="Credits" error={err.credits?.message} hint={kind === 'adjust' ? 'Negative to take credits away.' : undefined}>
            {(p) => <Input {...p} type="number" inputMode="decimal" step="any" autoFocus className="font-mono" {...form.register('credits', { valueAsNumber: true })} />}
          </Field>
          {kind === 'grant' && (
            <Field label="Payment received ($)" error={err.paidUsd?.message} hint="Counted as revenue. 0 = free or promotional.">
              {(p) => <Input {...p} type="number" inputMode="decimal" min={0} step="0.01" className="font-mono" {...form.register('paidUsd', { valueAsNumber: true })} />}
            </Field>
          )}
        </div>
        {kind === 'grant' && (
          <div className={cn('grid gap-4', expiry === 'days' && 'sm:grid-cols-2')}>
            <Field label="Expires" error={expiry === 'days' ? undefined : err.expires?.message} hint={expiry === 'never' ? 'For corrections and goodwill: these credits never expire.' : undefined}>
              {(p) => (
                <Select {...p} value={expiry} onChange={(e) => setExpiry(e.target.value as ExpiryChoice)}>
                  <option value="pack">Pack expiry ({packMonths} month{packMonths === 1 ? '' : 's'})</option>
                  <option value="never">Never</option>
                  <option value="days">After a number of days</option>
                </Select>
              )}
            </Field>
            {expiry === 'days' && (
              <Field label="Days" error={err.expires?.message}>
                {(p) => (
                  <Input {...p} type="number" inputMode="numeric" min={1} max={3650} step={1} className="font-mono" value={Number.isFinite(days) ? days : ''} onChange={(e) => setDays(e.target.value === '' ? Number.NaN : Number(e.target.value))} />
                )}
              </Field>
            )}
          </div>
        )}
        <Field label="Note" optional error={err.note?.message}>
          {(p) => <Textarea {...p} rows={2} placeholder={kind === 'grant' ? 'Invoice 2026-114, bank transfer' : 'Why'} {...form.register('note')} />}
        </Field>
        <div className="rounded-lg border border-line bg-surface-2/60 px-4 py-3 text-sm">
          {balance != null && (
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="text-ink-3">Balance now</span>
              <Num>{credits(balance)}</Num>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-3">This change</span>
            <Num>{has ? signedCredits(kind === 'adjust' ? amount : Math.abs(amount)) : '–'}</Num>
          </div>
          {balance != null && (
            <div className="mt-1 flex items-center justify-between gap-3 border-t border-line pt-1.5 font-medium">
              <span className="text-ink">Balance after</span>
              <Num className={cn('text-ink', after != null && after < 0 && 'text-critical-text')}>{after == null ? '–' : credits(after)}</Num>
            </div>
          )}
          {pages != null && pageCredits != null && (
            <p className="mt-2 text-xs text-ink-3">
              Balance after ≈ {pages.toLocaleString('en-US')} written pages at {credits(pageCredits)} credits each (a page costs us about {money(runCost('keyword'), { digits: 2 })}).
            </p>
          )}
          {kind === 'grant' && has && Number.isFinite(paid) && paid > 0 && settings.data && (
            <p className="mt-1 text-xs text-ink-3">
              List value {money(Math.abs(amount) * settings.data.creditValueUsd)} · paid {money(paid)}
            </p>
          )}
        </div>
        {save.isError && !(save.error instanceof ApiRequestError && Object.keys(save.error.fields).length) && <Callout tone="critical">{errorMessage(save.error)}</Callout>}
      </form>
    </Dialog>
  );
}

/** a dense "label · value" line under a KPI */
export function SplitLine({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5">
      {items.map((i) => (
        <span key={i.label} className="whitespace-nowrap">
          {i.label} <Num className="text-[12px] text-ink-2">{i.value}</Num>
        </span>
      ))}
    </span>
  );
}

export function EstimatedTip() {
  return (
    <InfoTip label="About estimated Claude cost">
      Streaming model calls report no usage, so the engine prices those from text and the thinking budget. That part is an estimate and is shown apart; a provider bill is
      never replaced by an estimate.
    </InfoTip>
  );
}

/** a DataTable flush with the edges of the card it sits in (the card's own border frames it; the pager gets the card's padding) */
export function FlushTable<T>(props: React.ComponentProps<typeof DataTable<T>>) {
  return (
    <DataTable
      {...props}
      className={cn(
        '[&>.relative]:rounded-none [&>.relative]:rounded-b-xl [&>.relative]:border-x-0 [&>.relative]:border-b-0 [&>div:not(.relative)]:px-5 [&>div:not(.relative)]:pb-3',
        props.className,
      )}
    />
  );
}
