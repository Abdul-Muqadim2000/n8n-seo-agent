import { Download, FileText, Receipt } from 'lucide-react';
import { formatCredits, type BillingOverview } from '@seo/shared';
import { StatusBadge } from '@/components/ui/badge';
import { buttonClass } from '@/components/ui/button';
import { CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { IconTile } from '@/components/insight';
import { useOrgCtx } from '@/lib/context';
import { fmtDate } from '@/lib/utils';
import { SettingsCard } from '../SettingsCard';

// The company's invoices (app/docs/CREDITS.md "Invoices"): one for every credit purchase the Alaventra team confirmed, e-mailed to
// the owners and admins with the PDF attached when it was issued, and kept here to download again.

const price = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function InvoicesCard({ b }: { b: BillingOverview }) {
  const { org } = useOrgCtx();
  // an API server older than the web app sends no list (the web deploys first): no invoices, not a crash
  const invoices = b.invoices ?? [];
  return (
    <SettingsCard icon={<Receipt />} title="Invoices" description="An invoice for every credit purchase, also e-mailed to the owners and admins when the payment is confirmed.">
      <CardBody>
        {invoices.length ? (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <IconTile size="sm" tone="blue">
                  <FileText />
                </IconTile>
                <div className="min-w-[12rem] flex-1">
                  <p className="text-sm font-medium text-ink">
                    <span className="font-mono tabular">{inv.number}</span> · {formatCredits(inv.credits)} · <span className="font-mono tabular">{price(inv.amountUsd)}</span>
                  </p>
                  <p className="truncate text-xs text-ink-3">
                    {fmtDate(inv.issuedAt)}
                    {inv.emailedTo.length ? ` · e-mailed to ${inv.emailedTo.join(', ')}` : ''}
                  </p>
                </div>
                <span className="ml-auto flex items-center gap-2">
                  <StatusBadge tone="good">Paid</StatusBadge>
                  <a href={`/api/orgs/${org.id}/billing/invoices/${inv.id}/pdf`} className={buttonClass('secondary', 'sm')} download={`${inv.number}.pdf`} aria-label={`Download invoice ${inv.number} as PDF`}>
                    <Download className="size-4" aria-hidden />
                    PDF
                  </a>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Receipt className="size-5" />} title="No invoices yet" description="When you buy credits, the invoice appears here and is e-mailed to your owners and admins." className="py-8" />
        )}
      </CardBody>
    </SettingsCard>
  );
}
