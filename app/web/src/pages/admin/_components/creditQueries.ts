// The admin panel's credit reads that have no hook in lib/queries.ts: a company's credit lots and the credits its runs used beyond their
// quotes. Keys start with 'admin', so every admin mutation (a grant, a plan change) refreshes them too.
import { useQuery } from '@tanstack/react-query';
import type { AdminPeriod, CreditLot } from '@seo/shared';
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
