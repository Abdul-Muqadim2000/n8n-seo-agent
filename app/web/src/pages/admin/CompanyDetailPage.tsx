import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowLeft, Ban, CalendarClock, ChevronDown, Coins, Download, Inbox, Pencil, Play, Plus, RotateCcw, Send, SlidersHorizontal, Trash2, TrendingUp, Wallet } from 'lucide-react';
import { ADMIN_ROLES, CREDIT_SOURCE_LABEL, ROLE_LABELS, type AdminCompanyDetail, type AdminMember, type AdminModeCost, type AdminPurchaseRequest, type AdminSiteRow, type CreditEntry, type CreditLot, type InvoiceView } from '@seo/shared';
import { CountUp, MetricCard, Stagger } from '@/components/insight';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink, buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Callout, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Input, Select } from '@/components/ui/field';
import { Dialog, Menu, MenuItem, MenuSeparator } from '@/components/ui/overlay';
import { type Column } from '@/components/ui/table';
import { Switch } from '@/components/ui/tabs';
import { ApiRequestError, errorMessage, toastError } from '@/lib/api';
import { useAdminCompany, useAdminCompanyCredits, useAdminCreditRequests, useAdminDeleteCompany, useAdminRemoveMembership, useAdminSetMembership, useAdminSettings, useAdminUpdateCompany, useCancelAdminCreditRequest, useMe } from '@/lib/queries';
import { fmtAgo, fmtDate, fmtDateTime } from '@/lib/utils';
import { pageTitle } from '@/components/layout/Brand';
import { useDocumentTitle } from '@/components/layout/useDocumentTitle';
import { useAdminPeriod } from './AdminLayout';
import { AdminCard, CompanyStatus, FlushTable, ConfirmDialog, CostSplitCell, CreditDialog, DailyCostChart, Money, Num, RowTile, SplitLine, type CreditKind, type CreditRequestPreset } from './_components/kit';
import { useAdminCompanyAbsorbed, useAdminCompanyInvoices, useAdminCompanyLots, useAdminSendInvoice } from './_components/creditQueries';
import { RunsTable } from './_components/runs';
import { adminPaths, credits, marginPct, modeLabel, money, nextFirstOfMonth, PERIOD_LABELS, signedCredits, signedMoney, withPeriod } from './lib';
import { CreditBookCard, useAdminUnits } from './_components/units';

const KIND_LABEL: Record<CreditEntry['kind'], string> = { grant: 'Grant', adjust: 'Adjustment', usage: 'Usage', refund: 'Refund', plan: 'Plan credits', expire: 'Expired' };

export default function AdminCompanyDetailPage() {
  const { companyId = '' } = useParams();
  const [period] = useAdminPeriod();
  const q = useAdminCompany(companyId, period);
  if (q.isPending)
    return (
      <div className="space-y-6" aria-busy>
        <Skeleton className="h-16 w-80" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  if (q.isError || !q.data)
    return (
      <>
        <BackLink />
        <Card>
          <ErrorState titleAs="h1" error={q.error} onRetry={() => q.refetch()} title="Could not load this company" />
        </Card>
      </>
    );
  return <CompanyDetail c={q.data} loading={q.isPlaceholderData} />;
}

function BackLink() {
  const [period] = useAdminPeriod();
  return (
    <Link to={withPeriod(adminPaths.companies, period)} className="group mb-4 inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-ink-3 transition-colors hover:text-ink">
      <ArrowLeft className="size-4 transition-transform duration-200 ease-brand group-hover:-translate-x-0.5" aria-hidden />
      Companies
    </Link>
  );
}

type Dlg = { type: 'credit'; kind: CreditKind; request?: CreditRequestPreset } | { type: 'edit' } | { type: 'toggle' } | { type: 'enforce' } | { type: 'delete' } | null;

function CompanyDetail({ c, loading }: { c: AdminCompanyDetail; loading: boolean }) {
  const [period] = useAdminPeriod();
  const [dlg, setDlg] = useState<Dlg>(null);
  const close = () => setDlg(null);
  const ledger = useAdminCompanyCredits(c.id);
  const entries = ledger.data ?? c.creditEntries;
  const m = c.money;
  const [units] = useAdminUnits();
  // the Credits / USD switch: an entry's dollars at the credit value in force when it was written (usage stores it), else today's
  const cvNow = c.credits.book?.creditValueUsd ?? 0;
  const usdOf = (e: CreditEntry, n: number) => n * (typeof e.ref?.creditValueUsd === 'number' ? e.ref.creditValueUsd : cvNow);

  const ledgerCols: Column<CreditEntry>[] = [
    { key: 'at', header: 'When', sortValue: (e) => e.createdAt, cell: (e) => <Num className="whitespace-nowrap text-ink-2">{fmtDateTime(e.createdAt)}</Num> },
    { key: 'kind', header: 'Kind', sortValue: (e) => e.kind, cell: (e) => <Badge tone={e.kind === 'grant' ? 'accent' : 'neutral'}>{KIND_LABEL[e.kind]}</Badge> },
    {
      key: 'credits',
      header: units === 'usd' ? 'Credits ($ list)' : 'Credits',
      align: 'right',
      sortValue: (e) => e.credits,
      cell: (e) => (
        <Num className={e.credits < 0 ? 'text-ink-2' : 'text-good-text'} title={units === 'usd' ? `${signedCredits(e.credits)} credits` : undefined}>
          {units === 'usd' ? signedMoney(usdOf(e, e.credits)) : signedCredits(e.credits)}
        </Num>
      ),
    },
    { key: 'paid', header: 'Paid', align: 'right', sortValue: (e) => e.paidUsd, cell: (e) => (e.paidUsd ? <Money value={e.paidUsd} /> : <Num className="text-ink-3">-</Num>) },
    {
      key: 'note',
      header: 'Note',
      cell: (e) => (
        <span className="block min-w-[160px] max-w-[320px] text-[13px] leading-snug">
          {e.note || (e.ref?.mode ? modeLabel(e.ref.mode) : '-')}
          {e.ref?.domain && <span className="block font-mono text-[11px] text-ink-3">{e.ref.domain}</span>}
        </span>
      ),
    },
    { key: 'actor', header: 'By', hideOnMobile: true, cell: (e) => <span className="text-[13px] text-ink-2">{e.actor ?? (e.kind === 'usage' ? 'run' : '-')}</span> },
    { key: 'after', header: 'Balance after', align: 'right', sortValue: (e) => e.balanceAfter, cell: (e) => <Num>{units === 'usd' ? money(e.balanceAfter * cvNow, { digits: 2 }) : credits(e.balanceAfter)}</Num> },
  ];

  const modeCols: Column<AdminModeCost>[] = [
    { key: 'mode', header: 'Mode', sortValue: (r) => modeLabel(r.mode), cell: (r) => <span className="text-[13px]">{modeLabel(r.mode)}</span> },
    { key: 'runs', header: 'Runs', align: 'right', sortValue: (r) => r.runs, cell: (r) => <Num>{r.runs}</Num> },
    { key: 'cost', header: 'Cost', align: 'right', sortValue: (r) => r.cost.totalUsd, cell: (r) => <CostSplitCell cost={r.cost} /> },
    { key: 'credits', header: units === 'usd' ? 'Credits ($ list)' : 'Credits', align: 'right', sortValue: (r) => r.credits, cell: (r) => <Num>{units === 'usd' ? money(r.credits * cvNow, { digits: 2 }) : credits(r.credits)}</Num>, hideOnMobile: true },
  ];

  const siteCols: Column<AdminSiteRow>[] = [
    { key: 'domain', header: 'Website', sortValue: (s) => s.domain, cell: (s) => <span className="font-mono text-[13px]">{s.domain}</span> },
    { key: 'verified', header: 'Verified', cell: (s) => (s.verified ? <StatusBadge tone="good">Verified</StatusBadge> : <StatusBadge tone="warning">Not verified</StatusBadge>) },
    { key: 'tracking', header: 'Tracking', hideOnMobile: true, cell: (s) => <span className="text-[13px] text-ink-2">{s.trackingStatus || '-'}</span> },
    { key: 'cost', header: 'Cost', align: 'right', sortValue: (s) => s.cost.totalUsd, cell: (s) => <CostSplitCell cost={s.cost} /> },
    { key: 'since', header: 'Added', hideOnMobile: true, sortValue: (s) => s.createdAt, cell: (s) => <Num className="text-ink-2">{fmtDate(s.createdAt)}</Num> },
  ];

  return (
    <>
      <BackLink />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <RowTile name={c.name} muted={c.disabled} className="mt-0.5 size-11 rounded-xl text-sm" />
          <div className="min-w-0">
            <AdminTitle name={c.name} />
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
              <span className="font-mono">{c.slug}</span>
              <span aria-hidden>·</span>
              <span>since {fmtDate(c.createdAt)}</span>
              <span aria-hidden>·</span>
              <span>budget {money(c.monthlyBudgetUsd, { digits: 0 })} / month</span>
              <CompanyStatus row={c} />
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button icon={<Plus className="size-4" />} onClick={() => setDlg({ type: 'credit', kind: 'grant' })}>
            Add credits
          </Button>
          <Menu
            trigger={
              <Button variant="secondary" icon={<ChevronDown className="size-4" />}>
                More
              </Button>
            }
          >
            <MenuItem icon={<SlidersHorizontal className="size-4" />} onSelect={() => setDlg({ type: 'credit', kind: 'adjust' })}>
              Adjust balance
            </MenuItem>
            <MenuItem icon={<RotateCcw className="size-4" />} onSelect={() => setDlg({ type: 'credit', kind: 'refund' })}>
              Refund credits
            </MenuItem>
            <MenuItem icon={<Pencil className="size-4" />} onSelect={() => setDlg({ type: 'edit' })}>
              Edit name and budget
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Ban className="size-4" />} onSelect={() => setDlg({ type: 'toggle' })}>
              {c.disabled ? 'Enable company' : 'Disable company'}
            </MenuItem>
            <MenuItem danger icon={<Trash2 className="size-4" />} onSelect={() => setDlg({ type: 'delete' })}>
              Delete company
            </MenuItem>
          </Menu>
        </div>
      </div>

      <Stagger className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
          <MetricCard
            label="Credits balance"
            icon={<Coins />}
            tone={c.credits.balance < 0 ? 'critical' : 'blue'}
            value={units === 'usd' ? <CountUp value={c.credits.book?.remainingListUsd ?? 0} format={(v) => money(v, { digits: 2 })} /> : <CountUp value={c.credits.balance} format={credits} />}
            meta={
              <SplitLine
                items={
                  units === 'usd'
                    ? [
                        { label: 'bought', value: money(c.credits.book?.boughtUsd ?? 0, { digits: 2 }) },
                        { label: 'used', value: money(c.credits.book?.usedListUsd ?? 0, { digits: 2 }) },
                      ]
                    : [
                        { label: 'granted', value: credits(c.credits.grantedInPeriod) },
                        { label: 'used', value: credits(c.credits.usedInPeriod) },
                      ]
                }
              />
            }
          />
          <MetricCard
            label="Cost to us"
            icon={<Wallet />}
            value={<CountUp value={m.cost.totalUsd} format={(v) => money(v)} />}
            meta={
              <SplitLine
                items={[
                  { label: 'Claude', value: money(m.cost.claudeUsd) },
                  { label: 'DFS', value: money(m.cost.dataforseoUsd) },
                ]}
              />
            }
          />
          <MetricCard label="Revenue" icon={<TrendingUp />} value={<CountUp value={m.revenueUsd} format={(v) => money(v, { digits: 2 })} />} meta={<SplitLine items={[{ label: 'list value', value: money(m.listValueUsd) }]} />} />
          <MetricCard
            label="Margin"
            icon={<Coins />}
            tone={m.marginUsd < 0 ? 'critical' : 'blue'}
            value={<CountUp value={m.marginUsd} format={(v) => money(v, { digits: 2 })} />}
            meta={m.marginPct == null ? 'No revenue in this period' : <SplitLine items={[{ label: 'margin', value: marginPct(m.marginPct) }]} />}
          />
          <MetricCard
            label="Runs"
            icon={<Play />}
            value={<CountUp value={c.runs} format={(v) => Math.round(v).toLocaleString('en-US')} />}
            meta={<SplitLine items={[{ label: 'failed', value: c.failedRuns }, { label: 'last', value: c.lastRunAt ? fmtAgo(c.lastRunAt) : 'never' }]} />}
          />
        </div>

        <Card className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
          <div className="min-w-0 max-w-2xl">
            <p className="text-sm font-medium text-ink">Enforce credits</p>
            <p className="mt-0.5 text-[13px] leading-snug text-ink-3">
              {c.credits.enforced
                ? 'On: an analysis is refused when the balance cannot cover it, and the websites\' schedules pause when credits run out (they resume when credits are added). The dollar budget does not apply.'
                : 'Off: credits are counted for every run, but nothing is refused or paused for a low balance. The monthly dollar budget (provider cost) and the company\'s own credit limits can still stop a run.'}
            </p>
          </div>
          <Switch checked={c.credits.enforced} onCheckedChange={() => setDlg({ type: 'enforce' })} label="Enforce credits" />
        </Card>

        <WaitingRequests c={c} onConfirm={(r) => setDlg({ type: 'credit', kind: 'grant', request: r })} />

        {c.credits.book && <CreditBookCard book={c.credits.book} description={units === 'usd' ? undefined : `${PERIOD_LABELS[period]}: every credit that came in, went out and is left.`} />}

        <div className="grid gap-4 xl:grid-cols-2">
          <PlanCard c={c} />
          <AbsorbedCard c={c} />
        </div>

        <DailyCostChart daily={c.daily} loading={loading} description={`${PERIOD_LABELS[period]}: this company's cost by provider and the payments recorded.`} />

        <div className="grid gap-4 xl:grid-cols-2">
          <AdminCard title="Cost by mode" description={PERIOD_LABELS[period]} bodyClassName="px-0 pb-0 pt-3">
            <FlushTable rows={c.byMode} columns={modeCols} rowKey={(r) => r.mode} initialSort={{ key: 'cost', dir: 'desc' }} empty="No runs in this period." />
          </AdminCard>
          <MembersCard c={c} />
        </div>

        <AdminCard title="Credit ledger" description="Every grant, adjustment, refund and run that moved the balance, newest first." bodyClassName="px-0 pb-0 pt-3">
          {ledger.isError && <Callout tone="warning" className="mx-5 mb-3">Showing the latest entries only: {errorMessage(ledger.error)}</Callout>}
          <FlushTable rows={entries} columns={ledgerCols} rowKey={(e) => e.id} initialSort={{ key: 'at', dir: 'desc' }} pageSize={15} empty="No credit has moved yet." />
        </AdminCard>

        <LotsCard c={c} />

        <InvoicesCard c={c} />

        <AdminCard title="Websites" description={`${c.sites_.length} website${c.sites_.length === 1 ? '' : 's'}`} bodyClassName="px-0 pb-0 pt-3">
          <FlushTable rows={c.sites_} columns={siteCols} rowKey={(s) => s.id} initialSort={{ key: 'cost', dir: 'desc' }} empty="No website yet." />
        </AdminCard>

        <AdminCard
          title="Recent runs"
          actions={
            <ButtonLink variant="link" to={withPeriod(`${adminPaths.runs}?orgId=${c.id}`, period)} className="text-[13px]">
              All runs of {c.name}
            </ButtonLink>
          }
          bodyClassName="px-0 pb-0 pt-3"
        >
          <RunsTable rows={c.recentRuns} flush hideCompany empty="No run in this period." />
        </AdminCard>
      </Stagger>

      {dlg?.type === 'credit' && <CreditDialog company={c} kind={dlg.kind} request={dlg.request} onClose={close} />}
      {dlg?.type === 'edit' && <EditCompanyDialog c={c} onClose={close} />}
      {dlg?.type === 'toggle' && <ToggleDialog c={c} onClose={close} />}
      {dlg?.type === 'enforce' && <EnforceDialog c={c} onClose={close} />}
      {dlg?.type === 'delete' && <DeleteDialog c={c} onClose={close} />}
    </>
  );
}

// ---------- credits: the plan, waiting requests, lots, what runs used beyond their quotes ----------
function PlanCard({ c }: { c: AdminCompanyDetail }) {
  const update = useAdminUpdateCompany();
  const settings = useAdminSettings();
  const current = c.planMonthlyCredits ?? 0;
  const [value, setValue] = useState(String(current));
  const n = Number(value);
  const valid = value.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 10_000_000;
  const dirty = valid && n !== current;
  const next = nextFirstOfMonth();
  const cv = settings.data?.creditValueUsd;
  const save = () =>
    update.mutate(
      { id: c.id, planMonthlyCredits: n },
      {
        onSuccess: () => toast.success(n > 0 ? `${c.name}: ${credits(n)} plan credits a month` : `${c.name}: no plan`),
      },
    );
  return (
    <AdminCard
      title="Plan"
      description="Credits granted on the 1st of every month. 0 = no plan."
      actions={<CalendarClock className="size-4 text-ink-3" aria-hidden />}
    >
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Monthly credits" className="w-44" error={value.trim() !== '' && !valid ? 'A whole number from 0' : undefined}>
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              className="font-mono"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && dirty) save();
              }}
            />
          )}
        </Field>
        <Button onClick={save} loading={update.isPending} disabled={!dirty}>
          Save plan
        </Button>
        {dirty && (
          <Button variant="ghost" onClick={() => setValue(String(current))}>
            Discard
          </Button>
        )}
      </div>
      <div className="mt-3 space-y-1 text-[13px] leading-snug text-ink-3">
        {current > 0 ? (
          <p>
            Now <Num className="text-ink-2">{credits(current)}</Num> credits a month
            {cv != null && <> (list value {money(current * cv, { digits: 2 })})</>} · next credits on <Num className="text-ink-2">{fmtDate(next.toISOString())}</Num>.
          </p>
        ) : (
          <p>No plan: the company runs on its welcome credits and the packs it buys.</p>
        )}
        <p>
          A new plan's first month is granted at once (once per calendar month); a changed amount applies from the next 1st. Unused plan credits{' '}
          {settings.data ? (settings.data.planRollover ? 'roll over one month, then expire.' : 'expire at the end of their month.') : 'follow the rollover setting.'}
        </p>
      </div>
      {update.isError && <Callout tone="critical" className="mt-3">{errorMessage(update.error)}</Callout>}
    </AdminCard>
  );
}

function AbsorbedCard({ c }: { c: AdminCompanyDetail }) {
  const [period] = useAdminPeriod();
  const q = useAdminCompanyAbsorbed(c.id, period);
  const a = q.data;
  return (
    <AdminCard title="Absorbed over quotes" description={`${PERIOD_LABELS[period]}: credits runs would have used beyond their quote. Not charged; the cost is ours.`}>
      {q.isPending ? (
        <Skeleton className="h-16" />
      ) : q.isError || !a ? (
        <Callout tone="warning">Could not read it: {errorMessage(q.error)}</Callout>
      ) : (
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <p className="font-display text-2xl leading-none font-semibold text-ink">{credits(a.credits)}</p>
            <p className="mt-1.5 text-xs text-ink-3">credits · {a.runs} run{a.runs === 1 ? '' : 's'} capped</p>
          </div>
          <div>
            <p className="font-display text-2xl leading-none font-semibold text-ink">{money(a.listUsd)}</p>
            <p className="mt-1.5 text-xs text-ink-3">at the credit value</p>
          </div>
          <div>
            <p className="font-display text-2xl leading-none font-semibold text-ink">{money(a.costUsd)}</p>
            <p className="mt-1.5 text-xs text-ink-3">≈ provider cost (÷ {a.markup})</p>
          </div>
        </div>
      )}
    </AdminCard>
  );
}

function WaitingRequests({ c, onConfirm }: { c: AdminCompanyDetail; onConfirm: (r: CreditRequestPreset) => void }) {
  const q = useAdminCreditRequests('pending');
  const cancel = useCancelAdminCreditRequest();
  const [cancelling, setCancelling] = useState<AdminPurchaseRequest | null>(null);
  const rows = (q.data ?? []).filter((r) => r.orgId === c.id);
  if (!rows.length) return null;
  const cols: Column<AdminPurchaseRequest>[] = [
    { key: 'pack', header: 'Pack', cell: (r) => <span className="text-[13px]"><Num>{credits(r.credits)}</Num> credits <span className="font-mono text-[11px] text-ink-3">{r.packId}</span></span> },
    { key: 'price', header: 'Price', align: 'right', cell: (r) => <Money value={r.priceUsd} digits={2} /> },
    {
      key: 'by',
      header: 'Requested by',
      hideOnMobile: true,
      cell: (r) => (
        <span className="block min-w-[140px] text-[13px] text-ink-2">
          {r.requestedBy ?? '-'}
          {r.note && <span className="block text-xs text-ink-3">{r.note}</span>}
        </span>
      ),
    },
    { key: 'when', header: 'When', hideOnMobile: true, cell: (r) => <Num className="whitespace-nowrap text-ink-2">{fmtAgo(r.createdAt)}</Num> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (r) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" onClick={() => onConfirm(r)}>
            Confirm and add credits
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCancelling(r)}>
            Cancel
          </Button>
        </div>
      ),
    },
  ];
  return (
    <AdminCard
      title={`Credit request${rows.length === 1 ? '' : 's'} waiting`}
      description="Invoice the pack, then confirm it here once paid: the credits are added and the payment is recorded as revenue."
      actions={<Inbox className="size-4 text-ink-3" aria-hidden />}
      bodyClassName="px-0 pb-0 pt-3"
    >
      <FlushTable rows={rows} columns={cols} rowKey={(r) => r.id} empty="Nothing waiting." />
      <ConfirmDialog
        open={!!cancelling}
        onClose={() => {
          setCancelling(null);
          cancel.reset();
        }}
        title={cancelling ? `Cancel the ${credits(cancelling.credits)}-credit request?` : ''}
        description="The customer sees it as cancelled and can ask again. No credits are added."
        confirmLabel="Cancel request"
        danger
        pending={cancel.isPending}
        error={cancel.error}
        onConfirm={() =>
          cancelling &&
          cancel.mutate(cancelling.id, {
            onSuccess: () => {
              toast.success('Request cancelled');
              setCancelling(null);
            },
          })
        }
      />
    </AdminCard>
  );
}

function LotsCard({ c }: { c: AdminCompanyDetail }) {
  const q = useAdminCompanyLots(c.id);
  const now = Date.now();
  const state = (l: CreditLot) => (l.expiresAt && new Date(l.expiresAt).getTime() <= now ? 'expired' : l.remaining <= 0 ? 'used' : 'live');
  const cols: Column<CreditLot>[] = [
    {
      key: 'source',
      header: 'Source',
      cell: (l) => (
        <span className="block min-w-[150px] text-[13px]">
          {CREDIT_SOURCE_LABEL[l.source] ?? l.source}
          {l.note && <span className="block text-xs text-ink-3">{l.note}</span>}
        </span>
      ),
    },
    { key: 'credits', header: 'Credits', align: 'right', cell: (l) => <Num>{credits(l.credits)}</Num> },
    { key: 'remaining', header: 'Remaining', align: 'right', cell: (l) => <Num className={l.remaining > 0 ? 'text-ink' : 'text-ink-3'}>{credits(l.remaining)}</Num> },
    {
      key: 'expires',
      header: 'Expires',
      cell: (l) => {
        const s = state(l);
        return (
          <span className="flex flex-wrap items-center gap-1.5 whitespace-nowrap">
            <Num className="text-ink-2">{l.expiresAt ? fmtDate(l.expiresAt) : 'Never'}</Num>
            {s === 'expired' && <Badge tone="neutral">Expired</Badge>}
            {s === 'used' && <Badge tone="neutral">Used up</Badge>}
          </span>
        );
      },
    },
    { key: 'added', header: 'Added', hideOnMobile: true, cell: (l) => <Num className="whitespace-nowrap text-ink-2">{fmtDate(l.createdAt)}</Num> },
  ];
  return (
    <AdminCard
      title="Credit lots"
      description="Where the balance comes from. Lots still holding credits first, in the order they are used (soonest to expire first); then used-up or expired lots of the last 90 days."
      bodyClassName="px-0 pb-0 pt-3"
    >
      {q.isError && <Callout tone="warning" className="mx-5 mb-3">Could not read the lots: {errorMessage(q.error)}</Callout>}
      {q.isPending ? (
        <div className="px-5 pb-5">
          <Skeleton className="h-24" />
        </div>
      ) : (
        <FlushTable rows={q.data ?? []} columns={cols} rowKey={(l) => l.id} pageSize={10} empty="No credits have arrived yet." />
      )}
    </AdminCard>
  );
}

/** the company's invoices: one per paid grant, e-mailed with it; download the PDF or send it again to today's owners and admins */
function InvoicesCard({ c }: { c: AdminCompanyDetail }) {
  const q = useAdminCompanyInvoices(c.id);
  const send = useAdminSendInvoice(c.id);
  const cols: Column<InvoiceView>[] = [
    { key: 'number', header: 'Invoice', sortValue: (i) => i.number, cell: (i) => <Num className="whitespace-nowrap text-ink">{i.number}</Num> },
    { key: 'at', header: 'Issued', sortValue: (i) => i.issuedAt, cell: (i) => <Num className="whitespace-nowrap text-ink-2">{fmtDate(i.issuedAt)}</Num> },
    { key: 'credits', header: 'Credits', align: 'right', sortValue: (i) => i.credits, cell: (i) => <Num>{credits(i.credits)}</Num> },
    { key: 'amount', header: 'Paid', align: 'right', sortValue: (i) => i.amountUsd, cell: (i) => <Money value={i.amountUsd} /> },
    {
      key: 'emailed',
      header: 'E-mailed',
      hideOnMobile: true,
      cell: (i) =>
        i.emailedAt ? (
          <span className="block min-w-[160px] text-[13px] text-ink-2">
            {fmtDate(i.emailedAt)}
            <span className="block truncate text-xs text-ink-3">{i.emailedTo.join(', ')}</span>
          </span>
        ) : (
          <Badge tone="warning">Not sent</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (i) => (
        <span className="flex justify-end gap-1.5">
          <a href={`/api/admin/invoices/${i.id}/pdf`} className={buttonClass('secondary', 'sm')} download={`${i.number}.pdf`} aria-label={`Download invoice ${i.number}`}>
            <Download className="size-4" aria-hidden />
            PDF
          </a>
          <Button
            size="sm"
            variant="secondary"
            icon={<Send className="size-4" />}
            loading={send.isPending && send.variables === i.id}
            onClick={() =>
              send.mutate(i.id, {
                onSuccess: (r) => toast.success(`Invoice ${r.number} sent to ${r.emailedTo.join(', ')}`),
                onError: (e) => toastError(e),
              })
            }
            aria-label={`Send invoice ${i.number} again`}
          >
            Send again
          </Button>
        </span>
      ),
    },
  ];
  return (
    <AdminCard title="Invoices" description="One for every grant that recorded a payment, numbered per year. E-mailed with its PDF to the owners and admins when issued." bodyClassName="px-0 pb-0 pt-3">
      {q.isError && <Callout tone="warning" className="mx-5 mb-3">Could not read the invoices: {errorMessage(q.error)}</Callout>}
      {q.isPending ? (
        <div className="px-5 pb-5">
          <Skeleton className="h-16" />
        </div>
      ) : (
        <FlushTable rows={q.data ?? []} columns={cols} rowKey={(i) => i.id} initialSort={{ key: 'at', dir: 'desc' }} pageSize={10} empty="No invoice yet. Add credits with a payment to issue one." />
      )}
    </AdminCard>
  );
}

function AdminTitle({ name }: { name: string }) {
  useDocumentTitle(pageTitle(name, 'Platform admin'));
  return <h1 className="font-display text-2xl leading-tight font-semibold tracking-[-0.02em] text-balance text-ink">{name}</h1>;
}

function MembersCard({ c }: { c: AdminCompanyDetail }) {
  const me = useMe();
  const setRole = useAdminSetMembership();
  const remove = useAdminRemoveMembership();
  const [removing, setRemoving] = useState<AdminMember | null>(null);
  const cols: Column<AdminMember>[] = [
    {
      key: 'name',
      header: 'Person',
      sortValue: (u) => u.name.toLowerCase(),
      cell: (u) => (
        <Link to={adminPaths.user(u.userId)} className="block min-w-[160px] rounded-md hover:text-accent-text">
          <span className="block truncate font-medium">
            {u.name}
            {u.suspended && <StatusBadge tone="critical" className="ml-2 align-middle">Suspended</StatusBadge>}
          </span>
          <span className="block truncate text-xs text-ink-3">{u.email}</span>
        </Link>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      sortValue: (u) => u.role,
      cell: (u) => (
        <div className="w-[118px]">
        <Select
          aria-label={`Role of ${u.name}`}
          value={u.role}
          disabled={setRole.isPending}
          className="h-8 text-[13px]"
          onChange={(e) => {
            // read the choice now: the controlled select falls back to the stored role before the answer arrives
            const role = e.target.value as (typeof ADMIN_ROLES)[number];
            setRole.mutate(
              { userId: u.userId, orgId: c.id, role },
              { onSuccess: () => toast.success(`${u.name} is now ${ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}`), onError: (err) => toastError(err) },
            );
          }}
        >
          {ADMIN_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r}
            </option>
          ))}
        </Select>
        </div>
      ),
    },
    { key: 'joined', header: 'Joined', hideOnMobile: true, sortValue: (u) => u.joinedAt, cell: (u) => <Num className="text-ink-2">{fmtDate(u.joinedAt)}</Num> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (u) => (
        <Button variant="ghost" size="sm" onClick={() => setRemoving(u)} aria-label={`Remove ${u.name} from ${c.name}`} disabled={u.userId === me.data?.user.id}>
          Remove
        </Button>
      ),
    },
  ];
  return (
    <AdminCard title="Members" description={`${c.members_.length} people`} bodyClassName="px-0 pb-0 pt-3">
      <FlushTable rows={c.members_} columns={cols} rowKey={(u) => u.userId} initialSort={{ key: 'name', dir: 'asc' }} empty="Nobody is in this company." />
      <ConfirmDialog
        open={!!removing}
        onClose={() => {
          setRemoving(null);
          remove.reset();
        }}
        title={removing ? `Remove ${removing.name} from ${c.name}?` : ''}
        description="They lose access to this company's websites, runs and reports. Their account stays."
        confirmLabel="Remove"
        danger
        pending={remove.isPending}
        error={remove.error}
        onConfirm={() =>
          removing &&
          remove.mutate(
            { userId: removing.userId, orgId: c.id },
            {
              onSuccess: () => {
                toast.success(`${removing.name} removed from ${c.name}`);
                setRemoving(null);
              },
            },
          )
        }
      />
    </AdminCard>
  );
}

const editSchema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(120),
  monthlyBudgetUsd: z.number({ message: 'Enter an amount' }).min(0, 'At least 0').max(100000, 'At most 100,000'),
});

function EditCompanyDialog({ c, onClose }: { c: AdminCompanyDetail; onClose: () => void }) {
  const update = useAdminUpdateCompany();
  const form = useForm<z.input<typeof editSchema>, unknown, z.output<typeof editSchema>>({ resolver: zodResolver(editSchema), defaultValues: { name: c.name, monthlyBudgetUsd: c.monthlyBudgetUsd } });
  const submit = form.handleSubmit((v) =>
    update.mutate(
      { id: c.id, ...v },
      {
        onSuccess: () => {
          toast.success(`${v.name}: budget ${money(v.monthlyBudgetUsd, { digits: 0 })} a month`);
          onClose();
        },
        onError: (e) => {
          if (e instanceof ApiRequestError) for (const [k, msg] of Object.entries(e.fields)) form.setError(k as 'name', { message: msg });
        },
      },
    ),
  );
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Edit ${c.name}`}
      description="The monthly budget caps what the company's runs may cost us each calendar month; runs over it are refused."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="admin-company-form" loading={update.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form id="admin-company-form" onSubmit={submit} noValidate className="space-y-4">
        <Field label="Company name" error={form.formState.errors.name?.message}>
          {(p) => <Input {...p} {...form.register('name')} />}
        </Field>
        <Field label="Monthly budget (USD)" error={form.formState.errors.monthlyBudgetUsd?.message}>
          {(p) => <Input {...p} type="number" inputMode="decimal" min={0} max={100000} step={1} className="font-mono" {...form.register('monthlyBudgetUsd', { valueAsNumber: true })} />}
        </Field>
        {update.isError && !(update.error instanceof ApiRequestError && Object.keys(update.error.fields).length) && <Callout tone="critical">{errorMessage(update.error)}</Callout>}
      </form>
    </Dialog>
  );
}

function ToggleDialog({ c, onClose }: { c: AdminCompanyDetail; onClose: () => void }) {
  const update = useAdminUpdateCompany();
  const disable = !c.disabled;
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title={disable ? `Disable ${c.name}?` : `Enable ${c.name}?`}
      description={
        disable
          ? 'Its members can no longer start runs, and its schedules stop. Dashboards and reports stay readable, and nothing is deleted.'
          : 'Its members can start runs again, within the monthly budget and, when enforced, the credit balance.'
      }
      confirmLabel={disable ? 'Disable company' : 'Enable company'}
      danger={disable}
      pending={update.isPending}
      error={update.error}
      onConfirm={() =>
        update.mutate(
          { id: c.id, disabled: disable },
          {
            onSuccess: () => {
              toast.success(disable ? `${c.name} is disabled` : `${c.name} is enabled`);
              onClose();
            },
          },
        )
      }
    />
  );
}

function EnforceDialog({ c, onClose }: { c: AdminCompanyDetail; onClose: () => void }) {
  const update = useAdminUpdateCompany();
  const on = !c.credits.enforced;
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title={on ? `Enforce credits for ${c.name}?` : `Stop enforcing credits for ${c.name}?`}
      description={
        on
          ? `From now on a run is refused when the balance cannot cover it. The balance is ${credits(c.credits.balance)} credits${c.credits.balance <= 0 ? ', so every run will be refused until credits are added' : ''}.`
          : 'Credits keep being counted, but a low balance no longer stops a run. Only the monthly budget does.'
      }
      confirmLabel={on ? 'Enforce credits' : 'Stop enforcing'}
      pending={update.isPending}
      error={update.error}
      onConfirm={() =>
        update.mutate(
          { id: c.id, creditsEnforced: on },
          {
            onSuccess: () => {
              toast.success(on ? `${c.name}: credits are enforced` : `${c.name}: credits are counted, not enforced`);
              onClose();
            },
          },
        )
      }
    />
  );
}

function DeleteDialog({ c, onClose }: { c: AdminCompanyDetail; onClose: () => void }) {
  const del = useAdminDeleteCompany();
  const navigate = useNavigate();
  const [period] = useAdminPeriod();
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title={`Delete ${c.name}?`}
      description={`This deletes the company, its ${c.sites} website${c.sites === 1 ? '' : 's'} with their keyword ladders in the engine, its runs, reports and credit ledger. Members keep their accounts. This cannot be undone.`}
      confirmLabel="Delete company"
      danger
      typed={c.slug}
      pending={del.isPending}
      error={del.error}
      onConfirm={() =>
        del.mutate(
          { id: c.id, confirm: c.slug },
          {
            onSuccess: () => {
              toast.success(`${c.name} is deleted`);
              navigate(withPeriod(adminPaths.companies, period), { replace: true });
            },
          },
        )
      }
    >
      <Callout tone="critical" title="Permanent">
        Revenue already recorded for this company stays in the platform totals.
      </Callout>
    </ConfirmDialog>
  );
}

