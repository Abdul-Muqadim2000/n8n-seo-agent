import { useState } from 'react';
import { toast } from 'sonner';
import { Clock, Coins, ShoppingCart } from 'lucide-react';
import { formatCredits, formatUsd, type BillingOverview, type CreditPurchaseRequest, type PricedPack } from '@seo/shared';
import { Badge, StatusBadge, type Tone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardBody } from '@/components/ui/card';
import { Callout } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { Dialog } from '@/components/ui/overlay';
import { IconTile } from '@/components/insight';
import { errorMessage } from '@/lib/api';
import { useOrgCtx } from '@/lib/context';
import { useCancelCreditRequest, useRequestCredits } from '@/lib/queries';
import { fmtAgo, fmtDate } from '@/lib/utils';
import { SettingsCard } from '../SettingsCard';

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
          ? 'Choose a pack. The Alaventra team confirms your request and sends the invoice; the credits are added to your balance when it is confirmed.'
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
              <p className="mt-3 font-mono text-[15px] font-medium tabular text-ink">{formatUsd(p.priceUsd)}</p>
              <p className="text-xs text-ink-3">
                <span className="font-mono tabular">{perCredit(p)}</span> a credit
              </p>
              {admin && (
                <Button className="mt-4" size="sm" variant="secondary" onClick={() => setPack(p)} disabled={waiting.length >= 3} aria-label={`Buy ${formatCredits(p.credits)} for ${formatUsd(p.priceUsd)}`}>
                  Buy
                </Button>
              )}
            </div>
          ))}
        </div>
        {admin && waiting.length >= 3 && <Callout tone="info">You have three requests waiting. Cancel one, or wait until the Alaventra team confirms them, to ask for another pack.</Callout>}

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
                      {formatCredits(r.credits)} · <span className="font-mono tabular">{formatUsd(r.priceUsd)}</span>
                    </p>
                    <p className="truncate text-xs text-ink-3">
                      Asked {fmtAgo(r.createdAt)}
                      {r.requestedBy ? ` by ${r.requestedBy}` : ''}
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
                      onClick={() => cancel.mutate(r.id, { onSuccess: () => toast.success('Request cancelled'), onError: (e) => toast.error(errorMessage(e)) })}
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
      description={pack ? `${formatUsd(pack.priceUsd)}, invoiced to ${org.name}.` : undefined}
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
