// The admin panel's credit reads that have no hook in lib/queries.ts: a company's credit lots and the credits its runs used beyond their
// quotes. Keys start with 'admin', so every admin mutation (a grant, a plan change) refreshes them too.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminPeriod, CreditLot, InvoiceView } from '@seo/shared';
import { api, ApiRequestError } from '@/lib/api';
import type { AdminAbsorbed } from '../lib';

const noRetryOn4xx = (count: number, err: unknown) => !(err instanceof ApiRequestError && err.status >= 400 && err.status < 500) && count < 2;

export const useAdminCompanyLots = (id: string) =>
  useQuery({ queryKey: ['admin', 'lots', id], queryFn: () => api<CreditLot[]>(`/api/admin/companies/${id}/lots`), retry: noRetryOn4xx });

export const useAdminCompanyAbsorbed = (id: string, period: AdminPeriod) =>
  useQuery({
    queryKey: ['admin', 'absorbed', id, period],
    queryFn: () => api<AdminAbsorbed>(`/api/admin/companies/${id}/absorbed${period === 'month' ? '' : `?period=${period}`}`),
    retry: noRetryOn4xx,
  });

/** a company's invoices (paid grants), newest first; a grant refreshes them like every admin read */
export const useAdminCompanyInvoices = (id: string) =>
  useQuery({ queryKey: ['admin', 'invoices', id], queryFn: () => api<InvoiceView[]>(`/api/admin/companies/${id}/invoices`), retry: noRetryOn4xx });

/** e-mails an invoice again to the company's owners and admins of today */
export function useAdminSendInvoice(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: string) => api<InvoiceView>(`/api/admin/invoices/${invoiceId}/send`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'invoices', companyId] }),
  });
}
