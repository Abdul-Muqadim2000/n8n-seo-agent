import { useState } from 'react';
import { toast } from 'sonner';
import { Clock, Coins, ShoppingCart } from 'lucide-react';
import { formatCredits, formatUsd, type BillingOverview, type CreditPurchaseRequest, type PricedPack } from '@seo/shared';
import { Badge, StatusBadge, type Tone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardBody } from '@/components/ui/card';
import { Callout } from '@/components/ui/feedback';
import { Field, Input, Select } from '@/components/ui/field';
import { Dialog } from '@/components/ui/overlay';
import { IconTile } from '@/components/insight';
import { errorMessage, toastError } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { useCancelCreditRequest, useRequestCredits, useSetAutoTopUp } from '@/lib/queries';
import { fmtAgo, fmtDate } from '@/lib/utils';
import { SettingsCard } from '../SettingsCard';

/** a pack's price, as the customer pays it: "$1,000.00" (formatUsd has no thousands separator) */
const price = (usd: number) => '$' + usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Buying credits (app/docs/CREDITS.md §1 "Buying credits"): there is no card payment yet. An owner or admin asks for a pack; the
// Alaventra team confirms it, sends the invoice and adds the credits. Pack prices are the only dollars a customer sees.

const REQUEST_STATUS: Record<CreditPurchaseRequest['status'], { label: string; tone: Tone }> = {
  pending: { label: 'Waiting for confirmation', tone: 'warning' },
  fulfilled: { label: 'Credits added', tone: 'good' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

/** "$0.05", "$0.045", "$0.0425": as many decimals as the price of one credit needs (2 to 4) */
const perCredit = (p: PricedPack) => {
  const whole = (k: number) => Math.abs(p.perCreditUsd * k - Math.round(p.perCreditUsd * k)) < 1e-9;
  return formatUsd(p.perCreditUsd, whole(100) ? 2 : whole(1000) ? 3 : 4);
};

export function BuyCreditsCard({ b, id }: { b: BillingOverview; id?: string }) {
  const { org, can } = useOrgCtx();
  const admin = can('admin');
  const [pack, setPack] = useState<PricedPack | null>(null);
  const cancel = useCancelCreditRequest(org.id);
  const waiting = b.requests.filter((r) => r.status === 'pending');

  return (
    <SettingsCard
      icon={<ShoppingCart />}
      title="Buy credits"
      description={
        admin
          ? 'Choose a pack. The Alaventra team sends you the payment details; when the payment is confirmed, the credits are added to your balance and the invoice is e-mailed to your owners and admins.'
          : 'Ask an owner or admin of your company to buy credits.'
      }
    >
      <CardBody className="space-y-5">
        <div id={id} className="grid scroll-mt-6 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
          {b.packs.map((p) => (
            <div key={p.id} className="flex flex-col rounded-xl border border-line bg-surface p-4 shadow-card transition-[border-color,box-shadow] duration-200 ease-brand hover:border-line-strong hover:shadow-raised">
              <div className="flex items-center justify-between gap-2">
                <IconTile size="sm">
                  <Coins />
                </IconTile>
                {p.discountPct > 0 && <Badge tone="accent">{p.discountPct}% off</Badge>}
              </div>
              <p className="mt-3 font-display text-2xl leading-none font-semibold tracking-[-0.01em] text-ink">{formatCredits(p.credits, { unit: false })}</p>
              <p className="mt-1 text-[13px] text-ink-3">credits</p>
              <p className="mt-3 font-mono text-[15px] font-medium tabular text-ink">{price(p.priceUsd)}</p>
              <p className="text-xs text-ink-3">
                <span className="font-mono tabular">{perCredit(p)}</span> a credit
              </p>
              {admin && (
                <Button className="mt-4" size="sm" variant="secondary" onClick={() => setPack(p)} disabled={waiting.length >= 3} aria-label={`Buy ${formatCredits(p.credits)} for ${price(p.priceUsd)}`}>
                  Buy
                </Button>
              )}
            </div>
          ))}
        </div>
        {admin && waiting.length >= 3 && <Callout tone="info">You have three requests waiting. Cancel one, or wait until the Alaventra team confirms them, to ask for another pack.</Callout>}

        <AutoTopUp b={b} admin={admin} />

        {b.requests.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-medium text-ink-3">Your requests</h3>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
              {b.requests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <IconTile size="sm" tone={r.status === 'pending' ? 'blue' : 'neutral'}>
                    <Clock />
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">
                      {formatCredits(r.credits)} · <span className="font-mono tabular">{price(r.priceUsd)}</span>
                      {r.auto && (
                        <Badge tone="neutral" className="ml-2">
                          Automatic
                        </Badge>
                      )}
                    </p>
                    {/* CR17-I: what the confirmation really added, when it differs from the pack asked for */}
                    {r.status === 'fulfilled' && r.granted && (r.granted.credits !== r.credits || r.granted.paidUsd !== r.priceUsd) && (
                      <p className="text-xs text-ink-2">
                        Added: {formatCredits(r.granted.credits)} for <span className="font-mono tabular">{price(r.granted.paidUsd)}</span>
                      </p>
                    )}
                    <p className="truncate text-xs text-ink-3">
                      Asked {fmtAgo(r.createdAt)}
                      {r.auto ? ' automatically, as your top-up setting says' : r.requestedBy ? ` by ${r.requestedBy}` : ''}
                      {r.resolvedAt && r.status !== 'pending' ? ` · ${r.status === 'fulfilled' ? 'added' : 'cancelled'} ${fmtDate(r.resolvedAt)}` : ''}
                      {r.note ? ` · ${r.note}` : ''}
                    </p>
                  </div>
                  <StatusBadge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</StatusBadge>
                  {admin && r.status === 'pending' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={cancel.isPending && cancel.variables === r.id}
                      onClick={() => cancel.mutate(r.id, { onSuccess: () => toast.success('Request cancelled'), onError: (e) => toastError(e) })}
                      aria-label={`Cancel the request for ${formatCredits(r.credits)}`}
                    >
                      Cancel
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
      {admin && <BuyDialog pack={pack} onClose={() => setPack(null)} />}
    </SettingsCard>
  );
}

function BuyDialog({ pack, onClose }: { pack: PricedPack | null; onClose: () => void }) {
  const { org } = useOrgCtx();
  const request = useRequestCredits(org.id);
  const [note, setNote] = useState('');
  const close = () => {
    onClose();
    setNote('');
    request.reset();
  };
  const submit = () => {
    if (!pack) return;
    request.mutate(
      { packId: pack.id, note: note.trim() },
      {
        onSuccess: () => {
          toast.success(`Request sent for ${formatCredits(pack.credits)}. The Alaventra team will confirm it and send the invoice.`);
          close();
        },
      },
    );
  };
  return (
    <Dialog
      open={!!pack}
      onOpenChange={(o) => !o && close()}
      title={pack ? `Buy ${formatCredits(pack.credits)}` : 'Buy credits'}
      description={pack ? `${price(pack.priceUsd)}, invoiced to ${org.name}.` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button onClick={submit} loading={request.isPending}>
            Send request
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <p className="text-sm leading-relaxed text-ink-2">
          The Alaventra team confirms your request and sends the invoice. The credits are added to your balance when the request is confirmed; you can cancel it until
          then.
        </p>
        <Field label="Purchase-order number or note" optional hint="The Alaventra team sees it with your request, for your invoice." error={note.length > 500 ? 'At most 500 characters' : undefined}>
          {(p) => <Input {...p} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} autoComplete="off" placeholder="PO-2026-114" />}
        </Field>
        {request.isError && <Callout tone="critical">{errorMessage(request.error)}</Callout>}
      </form>
    </Dialog>
  );
}

/**
 * CR17-I (client report 2026-11-17, M2): "When credits run low, ask for a top-up". No card payment exists yet, so it files the same request
 * a person would (one per low spell: under two weeks of credits left), tells your owners and admins and the Alaventra team, and the team
 * confirms it. Off by default; owners and admins choose the pack.
 */
function AutoTopUp({ b, admin }: { b: BillingOverview; admin: boolean }) {
  const { org } = useOrgCtx();
  const save = useSetAutoTopUp(org.id);
  const current = b.autoTopUp ?? null;
  if (!admin && !current) return null;
  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field
          label="When credits run low, ask for a top-up"
          hint="When less than two weeks of credits are left, we send a request for this pack for you, once, and tell your owners and admins. The Alaventra team confirms it as usual; you can cancel it until then."
          className="min-w-0 flex-1"
        >
          {(p) => (
            <Select
              {...p}
              value={current?.packId ?? ''}
              disabled={!admin || save.isPending}
              onChange={(e) =>
                save.mutate(e.target.value || null, {
                  onSuccess: (r) => toast.success(r.autoTopUp ? `We will ask for ${formatCredits(r.autoTopUp.credits)} when credits run low` : 'Automatic top-up switched off'),
                  onError: (err) => toastError(err),
                })
              }
            >
              <option value="">Off: I buy credits myself</option>
              {b.packs.map((p2) => (
                <option key={p2.id} value={p2.id}>
                  {formatCredits(p2.credits)} for {price(p2.priceUsd)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      {current && !current.armed && <p className="mt-2 text-xs text-ink-3">A request was sent for this low spell. The next one is sent after your balance has recovered.</p>}
    </div>
  );
}
