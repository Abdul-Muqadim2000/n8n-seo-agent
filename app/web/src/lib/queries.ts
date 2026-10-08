import { keepPreviousData, useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import type {
  AdminOrg,
  AdminResult,
  AiData,
  AlertsData,
  AuthProviders,
  BacklinksData,
  ContentData,
  GoogleConnection,
  Invitation,
  InvitationPreview,
  KeywordCheck,
  LadderCard,
  LadderDetail,
  LinkImportSummary,
  Me,
  Member,
  Org,
  OverviewData,
  Page,
  PipelineData,
  RankingsData,
  Recommendation,
  RecommendedKeywords,
  Report,
  ReportDetail,
  Run,
  SearchData,
  Site,
  SiteAutomation,
  SiteAutomationInput,
  SiteSettingsData,
  SiteVerificationInfo,
  TechnicalData,
  Usage,
  VerifyResult,
} from '@seo/shared';
import { api, ApiRequestError } from './api';

// One hook per endpoint (API.md). Query keys: ['me'], ['org', orgId, ...], ['site', siteId, ...].

const noRetryOn4xx = (count: number, err: unknown) => !(err instanceof ApiRequestError && err.status >= 400 && err.status < 500) && count < 2;

export const qk = {
  me: ['me'] as const,
  org: (orgId: string) => ['org', orgId] as const,
  sites: (orgId: string) => ['org', orgId, 'sites'] as const,
  site: (siteId: string) => ['site', siteId] as const,
  siteData: (siteId: string, page: string, extra?: unknown) => ['site', siteId, 'data', page, extra ?? null] as const,
  /** under the site's data key: a run started for the website refreshes it too */
  ladder: (siteId: string, ladderId: string) => ['site', siteId, 'data', 'ladder', ladderId] as const,
  runs: (orgId: string, filters?: unknown) => ['org', orgId, 'runs', filters ?? null] as const,
  run: (orgId: string, runId: string) => ['org', orgId, 'run', runId] as const,
  reports: (orgId: string, filters?: unknown) => ['org', orgId, 'reports', filters ?? null] as const,
  report: (orgId: string, reportId: string) => ['org', orgId, 'report', reportId] as const,
};

// ---------- auth & account ----------
export const useProviders = () => useQuery({ queryKey: ['providers'], queryFn: () => api<AuthProviders>('/api/auth/providers'), staleTime: Infinity });

export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: async () => {
      try {
        return await api<Me | null>('/api/me');
      } catch (e) {
        if (e instanceof ApiRequestError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 60_000,
    retry: noRetryOn4xx,
  });
}

export function useAuthMutation<TBody>(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TBody) => api<Me>(path, { method: 'POST', body }),
    onSuccess: (me) => qc.setQueryData(qk.me, me),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api('/api/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(qk.me, null);
    },
  });
}

export function usePost<TBody, TRes = { ok: boolean }>(path: string, invalidate?: readonly unknown[][]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TBody) => api<TRes>(path, { method: 'POST', body }),
    onSuccess: () => invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k })),
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string }) => api<Me>('/api/me', { method: 'PATCH', body }),
    onSuccess: (me) => qc.setQueryData(qk.me, me),
  });
}

// ---------- companies ----------
export const useOrg = (orgId: string | undefined) =>
  useQuery({ queryKey: qk.org(orgId ?? ''), queryFn: () => api<Org>(`/api/orgs/${orgId}`), enabled: !!orgId, retry: noRetryOn4xx });

export function useCreateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api<Org>('/api/orgs', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }),
  });
}

export function useUpdateOrg(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api<Org>(`/api/orgs/${orgId}`, { method: 'PATCH', body }),
    onSuccess: (org) => {
      qc.setQueryData(qk.org(orgId), org);
      qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useDeleteOrg(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (confirm: string) => api<{ ok: boolean }>(`/api/orgs/${orgId}`, { method: 'DELETE', body: { confirm } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }),
  });
}

export function useOnboardingStep(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { step: string; done?: boolean }) => api<Org>(`/api/orgs/${orgId}/onboarding`, { method: 'PATCH', body }),
    onSuccess: (org) => {
      qc.setQueryData(qk.org(orgId), org);
      qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export function useSetBudget(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { monthlyBudgetUsd: number }) => api<Org>(`/api/orgs/${orgId}/budget`, { method: 'PATCH', body }),
    onSuccess: (org) => {
      qc.setQueryData(qk.org(orgId), org);
      qc.invalidateQueries({ queryKey: [...qk.org(orgId), 'usage'] });
    },
  });
}

export const useUsage = (orgId: string) => useQuery({ queryKey: [...qk.org(orgId), 'usage'], queryFn: () => api<Usage>(`/api/orgs/${orgId}/usage`) });

export const useMembers = (orgId: string) =>
  useQuery({ queryKey: [...qk.org(orgId), 'members'], queryFn: () => api<{ members: Member[]; invitations: Invitation[] }>(`/api/orgs/${orgId}/members`) });

export function useTeamMutation<TBody>(orgId: string, method: 'POST' | 'PATCH' | 'DELETE', path: (b: TBody) => string, body?: (b: TBody) => unknown) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: TBody) => api<Invitation | { ok: boolean }>(path(b), { method, body: body ? body(b) : undefined }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...qk.org(orgId), 'members'] }),
  });
}

export const useInvitation = (token: string) =>
  useQuery({ queryKey: ['invitation', token], queryFn: () => api<InvitationPreview>(`/api/invitations/${token}`), retry: noRetryOn4xx });

// ---------- sites ----------
export const useSites = (orgId: string | undefined) =>
  useQuery({ queryKey: qk.sites(orgId ?? ''), queryFn: () => api<Site[]>(`/api/orgs/${orgId}/sites`), enabled: !!orgId });

export const useSite = (orgId: string, siteId: string | undefined) =>
  useQuery({ queryKey: qk.site(siteId ?? ''), queryFn: () => api<Site>(`/api/orgs/${orgId}/sites/${siteId}`), enabled: !!siteId, retry: noRetryOn4xx });

export function useCreateSite(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api<Site>(`/api/orgs/${orgId}/sites`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.sites(orgId) }),
  });
}

export function useUpdateSite(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api<Site>(`/api/orgs/${orgId}/sites/${siteId}`, { method: 'PATCH', body }),
    onSuccess: (site) => {
      qc.setQueryData(qk.site(siteId), site);
      qc.invalidateQueries({ queryKey: qk.sites(orgId) });
      qc.invalidateQueries({ queryKey: [...qk.site(siteId), 'google'] });
    },
  });
}

export function useDeleteSite(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api(`/api/orgs/${orgId}/sites/${siteId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.sites(orgId) }),
  });
}

export const useVerification = (orgId: string, siteId: string) =>
  useQuery({ queryKey: [...qk.site(siteId), 'verification'], queryFn: () => api<SiteVerificationInfo>(`/api/orgs/${orgId}/sites/${siteId}/verification`), retry: noRetryOn4xx });

export function useVerifySite(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { method: 'search_console' | 'dns' | 'meta' }) => api<VerifyResult>(`/api/orgs/${orgId}/sites/${siteId}/verify`, { method: 'POST', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.site(siteId) });
      qc.invalidateQueries({ queryKey: qk.sites(orgId) });
    },
  });
}

export const useGoogleConnection = (orgId: string, siteId: string, enabled = true) =>
  useQuery({ queryKey: [...qk.site(siteId), 'google'], queryFn: () => api<GoogleConnection>(`/api/orgs/${orgId}/sites/${siteId}/google`), enabled, staleTime: 30_000, retry: noRetryOn4xx });

export function useSiteAdmin(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api<AdminResult>(`/api/orgs/${orgId}/sites/${siteId}/admin`, { method: 'POST', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.site(siteId) });
      qc.invalidateQueries({ queryKey: qk.sites(orgId) });
    },
  });
}

/** v4.10: upload a Search Console Links export (or another tool's backlink CSV) for the Backlink Monitor */
export function useLinkImport(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { csv: string; fileName?: string }) => api<LinkImportSummary>(`/api/orgs/${orgId}/sites/${siteId}/backlinks/import`, { method: 'POST', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.siteData(siteId, 'backlinks') });
    },
  });
}

// ---------- dashboards ----------
type DataPages = {
  overview: OverviewData;
  pipeline: PipelineData;
  search: SearchData;
  rankings: RankingsData;
  content: ContentData;
  technical: TechnicalData;
  ai: AiData;
  backlinks: BacklinksData;
  alerts: AlertsData;
  settings: SiteSettingsData;
};

export function useSiteData<P extends keyof DataPages>(orgId: string, siteId: string, page: P, params?: Record<string, string | undefined>, opts?: Partial<UseQueryOptions<DataPages[P]>>) {
  const qs = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString() : '';
  return useQuery({
    queryKey: qk.siteData(siteId, page, qs),
    queryFn: () => api<DataPages[P]>(`/api/orgs/${orgId}/sites/${siteId}/data/${page}${qs ? `?${qs}` : ''}`),
    placeholderData: keepPreviousData,
    retry: noRetryOn4xx,
    staleTime: 60_000,
    ...opts,
  });
}

/** One keyword ladder: its pages (the climb), timeline, results and reports. 404 when the ladder does not exist. */
export const useLadder = (orgId: string, siteId: string, ladderId: string) =>
  useQuery({
    queryKey: qk.ladder(siteId, ladderId),
    queryFn: () => api<LadderDetail>(`/api/orgs/${orgId}/sites/${siteId}/data/ladders/${encodeURIComponent(ladderId)}`),
    enabled: !!ladderId,
    retry: noRetryOn4xx,
    staleTime: 60_000,
  });

// ---------- keyword ladders and the pipeline's settings (admins; n8n seo_ladder_settings) ----------
/** every cached read of the website's pipeline (the page, its ladders) */
const pipelineKey = (siteId: string) => [...qk.site(siteId), 'data', 'pipeline'] as const;

/** Auto / Manual, Pause / Resume of one ladder; the pipeline and the ladder page refresh after it. */
export function useUpdateLadder(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ladderId, ...body }: { ladderId: string; mode?: 'auto' | 'manual'; status?: 'active' | 'paused' }) =>
      api<LadderCard>(`/api/orgs/${orgId}/sites/${siteId}/ladders/${encodeURIComponent(ladderId)}`, { method: 'PATCH', body }),
    onSuccess: (card) => {
      // the card at once (it is the server's answer), then everything that depends on it (queued ladders, this week, Needs you)
      qc.setQueriesData<PipelineData>({ queryKey: pipelineKey(siteId) }, (d) => (d ? { ...d, ladderCards: d.ladderCards.map((c) => (c.id === card.id ? card : c)) } : d));
      qc.setQueryData<LadderDetail>(qk.ladder(siteId, card.id), (d) => (d ? { ...d, ...card } : d));
      return qc.invalidateQueries({ queryKey: [...qk.site(siteId), 'data'] });
    },
  });
}

/** The ladders' new priority order (every ladder once). Shown at once; put back if the server refuses. */
export function useReorderLadders(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ladderIds: string[]) => api<LadderCard[]>(`/api/orgs/${orgId}/sites/${siteId}/ladders/order`, { method: 'PUT', body: { ladderIds } }),
    onMutate: async (ladderIds) => {
      await qc.cancelQueries({ queryKey: pipelineKey(siteId) });
      const before = qc.getQueriesData<PipelineData>({ queryKey: pipelineKey(siteId) });
      qc.setQueriesData<PipelineData>({ queryKey: pipelineKey(siteId) }, (d) => {
        if (!d) return d;
        const byId = new Map(d.ladderCards.map((c) => [c.id, c]));
        const cards = ladderIds.map((id, i) => byId.get(id) && { ...byId.get(id)!, priority: i + 1 }).filter((c): c is LadderCard => !!c);
        return { ...d, ladderCards: cards.length === d.ladderCards.length ? cards : d.ladderCards };
      });
      return { before };
    },
    onError: (_e, _v, ctx) => ctx?.before.forEach(([k, v]) => qc.setQueryData(k, v)),
    onSuccess: (cards) => qc.setQueriesData<PipelineData>({ queryKey: pipelineKey(siteId) }, (d) => (d ? { ...d, ladderCards: cards } : d)),
    onSettled: () => qc.invalidateQueries({ queryKey: [...qk.site(siteId), 'data'] }),
  });
}

/** Deletes a keyword ladder in the SEO engine (its pages, settings and rank checks). */
export function useDeleteLadder(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ladderId: string) => api<void>(`/api/orgs/${orgId}/sites/${siteId}/ladders/${encodeURIComponent(ladderId)}`, { method: 'DELETE' }),
    onSuccess: (_r, ladderId) => {
      qc.removeQueries({ queryKey: qk.ladder(siteId, ladderId) });
      qc.setQueriesData<PipelineData>({ queryKey: pipelineKey(siteId) }, (d) => (d ? { ...d, ladderCards: d.ladderCards.filter((c) => c.id !== ladderId) } : d));
      return qc.invalidateQueries({ queryKey: [...qk.site(siteId), 'data'] });
    },
  });
}

/** The website's pipeline settings (default mode, opportunity posts, ladders at a time, the pile-up limit). */
export function useUpdateAutomation(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SiteAutomationInput) => api<SiteAutomation>(`/api/orgs/${orgId}/sites/${siteId}/automation`, { method: 'PATCH', body }),
    onSuccess: (automation) => {
      qc.setQueriesData<PipelineData>({ queryKey: pipelineKey(siteId) }, (d) => (d ? { ...d, automation } : d));
      return qc.invalidateQueries({ queryKey: [...qk.site(siteId), 'data'] });
    },
  });
}

// ---------- choosing the keyword of a new ladder (PIPELINE_FEATURE_SPEC.md §5) ----------
/** The website's recommended keywords (its latest keyword strategy report; free). */
export const useRecommendedKeywords = (orgId: string, siteId: string) =>
  useQuery({
    queryKey: qk.siteData(siteId, 'keywords-recommended'),
    queryFn: () => api<RecommendedKeywords>(`/api/orgs/${orgId}/sites/${siteId}/keywords/recommended`),
    retry: noRetryOn4xx,
    staleTime: 60_000,
  });

/** Checks one keyword for the website (paid, about $0.05; the same keyword of the last 7 days is answered free). */
export function useAssessKeyword(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { keyword: string; country?: string }) => api<KeywordCheck>(`/api/orgs/${orgId}/sites/${siteId}/keywords/assess`, { method: 'POST', body }),
    onSuccess: (check) => {
      // a paid check counts in the month's spend
      if (!check.cached) qc.invalidateQueries({ queryKey: [...qk.org(orgId), 'usage'] });
    },
  });
}

export const useRecommendations = (orgId: string, siteId: string) =>
  useQuery({
    queryKey: qk.siteData(siteId, 'recommendations'),
    queryFn: () => api<Recommendation[]>(`/api/orgs/${orgId}/sites/${siteId}/recommendations`),
    retry: noRetryOn4xx,
    staleTime: 60_000,
  });

// ---------- runs & reports ----------
export interface RunFilters {
  siteId?: string;
  mode?: string;
  status?: string;
  cursor?: string;
  limit?: number;
}

export function useRuns(orgId: string, filters: RunFilters = {}, refetchInterval?: number) {
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString();
  return useQuery({
    queryKey: qk.runs(orgId, qs),
    queryFn: () => api<Page<Run>>(`/api/orgs/${orgId}/runs${qs ? `?${qs}` : ''}`),
    placeholderData: keepPreviousData,
    refetchInterval,
  });
}

export function useRun(orgId: string, runId: string) {
  return useQuery({
    queryKey: qk.run(orgId, runId),
    queryFn: () => api<{ run: Run; reports: Report[] }>(`/api/orgs/${orgId}/runs/${runId}`),
    retry: noRetryOn4xx,
    // keep polling while n8n is working on it (a run that does not exist or is not yours is not polled)
    refetchInterval: (q) => {
      if (!q.state.data && q.state.error instanceof ApiRequestError && q.state.error.status >= 400 && q.state.error.status < 500) return false;
      const s = q.state.data?.run.status;
      return s === 'completed' || s === 'failed' ? false : 10_000;
    },
  });
}

export function useStartRun(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api<Run>(`/api/orgs/${orgId}/runs`, { method: 'POST', body }),
    onSuccess: (run) => {
      qc.invalidateQueries({ queryKey: ['org', orgId, 'runs'] });
      qc.invalidateQueries({ queryKey: [...qk.org(orgId), 'usage'] });
      // the website's pipeline knows the run at once (running now, page logged, off the blog queue): no second "Write now"
      if (run.siteId) qc.invalidateQueries({ queryKey: ['site', run.siteId, 'data'] });
      // a tracking run changes the website (status, keywords, posts per week); a profile run changes its settings data
      if (run.siteId && (run.mode === 'track' || run.mode === 'profile')) {
        qc.invalidateQueries({ queryKey: qk.sites(orgId) });
        qc.invalidateQueries({ queryKey: qk.site(run.siteId) });
      }
    },
  });
}

export function useReports(orgId: string, filters: { siteId?: string; stage?: string; limit?: number } = {}) {
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString();
  return useQuery({ queryKey: qk.reports(orgId, qs), queryFn: () => api<Report[]>(`/api/orgs/${orgId}/reports${qs ? `?${qs}` : ''}`), placeholderData: keepPreviousData });
}

export const useReport = (orgId: string, reportId: string | undefined) =>
  useQuery({ queryKey: qk.report(orgId, reportId ?? ''), queryFn: () => api<ReportDetail>(`/api/orgs/${orgId}/reports/${reportId}`), enabled: !!reportId, staleTime: Infinity, retry: noRetryOn4xx });

// ---------- platform admin ----------
export const useAdminOrgs = (enabled: boolean) => useQuery({ queryKey: ['admin', 'orgs'], queryFn: () => api<AdminOrg[]>('/api/admin/orgs'), enabled });

export function useAdminUpdateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, ...body }: { orgId: string; monthlyBudgetUsd: number; disabled?: boolean }) => api<AdminOrg>(`/api/admin/orgs/${orgId}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'orgs'] }),
  });
}
