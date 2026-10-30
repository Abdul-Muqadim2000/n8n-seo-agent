import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import type {
  AnswerDecision,
  FactAnswer,
  FactAnswers,
  PageReviewView,
  ApiKeyCreate,
  ApiKeyView,
  PublishCheckInput,
  PublishCheckResult,
  DeliveryReport,
  AdminResult,
  AiData,
  AlertsData,
  AuthProviders,
  BacklinksData,
  ContentData,
  GoogleConnection,
  Invitation,
  InvitationPreview,
  DnsCheck,
  KeywordCheck,
  LadderCard,
  LadderDetail,
  LinkBuildingData,
  LinkImportSummary,
  LinkSettings,
  MailboxView,
  MailProviderInfo,
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
  JoinedRunResult,
  SearchData,
  Site,
  SiteAutomation,
  SiteAutomationInput,
  SiteSettingsData,
  SiteVerificationInfo,
  TechnicalData,
  OutreachStep,
  VerifyResult,
  DeliveryRecord,
  DeliverySettings,
  DeliverySettingsInput,
  AuditEventView,
  SessionView,
  SsoOverview,
  MfaStatus,
  SecurityPolicy,
  TotpEnrolment,
  CmsConnectionCreate,
  CmsConnectionUpdate,
  CmsConnectionView,
  CmsPublishInput,
  CmsPublishResult,
  CmsReportState,
  CmsSiteState,
  CmsTestResultView,
  CrawlerData,
  IndexHistoryEntry,
  IndexingData,
  IndexPage,
  IndexPagesPage,
  CrawlerSettingsInput,
  LogPushKeyCreated,
  LogUploadAccepted,
  AgencyClient,
  AgencyOverviewRow,
  ApprovalCandidate,
  ApprovalView,
  Branding,
  BrandingResponse,
  ClientBranding,
  PortalDomainCheck,
  PortalDomainView,
  PortalMailView,
  StaffAccess,
  AdminActivityRow,
  AdminCompanyDetail,
  AdminCompanyRow,
  AdminCostSyncResult,
  AdminCreatedUser,
  AdminOverview,
  AdminPeriod,
  AdminRunsPage,
  AdminUserRow,
  CreditEntry,
  PlatformSettings,
  adminCompanyUpdateSchema,
  adminCreateUserSchema,
  adminCreditSchema,
  adminDeleteUserSchema,
  adminMembershipSchema,
  adminUpdateUserSchema,
  platformSettingsSchema,
  BillingOverview,
  CreditActivityPage,
  CreditLimits,
  CreditPurchaseRequest,
  AdminPurchaseRequest,
  ComingUpDecisionResult,
  ComingUpView,
  ContentFeedbackResult,
  CycleWeekdayResult,
  KeywordProposalList,
  KeywordProposalView,
  ResearchStartResult,
  SiteCycleView,
} from '@seo/shared';
import type { z } from 'zod';
import { api, ApiRequestError, directCredentials, directUrl } from './api';

// One hook per endpoint (API.md). Query keys: ['me'], ['org', orgId, ...], ['site', siteId, ...].

export const noRetryOn4xx = (count: number, err: unknown) => !(err instanceof ApiRequestError && err.status >= 400 && err.status < 500) && count < 2;

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
    // with the API down (a 503), the failed query must stay failed: by default every component that starts reading it retries it,
    // which puts it back to pending, RootRoute then swaps the home page for its loader, the header unmounts, the retry fails and
    // the header mounts again: an endless loop of /api/me behind "Loading..." (alaventra.com, 2026-10-18). A reload or an explicit
    // refetch still tries again.
    retryOnMount: false,
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

// ---------- credits (app/docs/CREDITS.md) ----------
export const useBilling = (orgId: string, opts: { enabled?: boolean } = {}) =>
  useQuery({ queryKey: [...qk.org(orgId), 'billing'], queryFn: () => api<BillingOverview>(`/api/orgs/${orgId}/billing`), enabled: opts.enabled ?? true, staleTime: 60_000, retry: noRetryOn4xx });

export const useCreditActivity = (orgId: string, origin: 'all' | 'autopilot' | 'on_demand' | 'account') =>
  useInfiniteQuery({
    queryKey: [...qk.org(orgId), 'billing', 'activity', origin],
    queryFn: ({ pageParam }) => api<CreditActivityPage>(`/api/orgs/${orgId}/billing/activity?origin=${origin}&limit=50${pageParam ? `&cursor=${pageParam}` : ''}`),
    initialPageParam: '' as string,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export function useSetCreditLimits(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreditLimits) => api<CreditLimits>(`/api/orgs/${orgId}/billing/limits`, { method: 'PUT', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...qk.org(orgId), 'billing'] }),
  });
}

export function useRequestCredits(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { packId: string; note?: string }) => api<CreditPurchaseRequest>(`/api/orgs/${orgId}/billing/requests`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...qk.org(orgId), 'billing'] }),
  });
}

export function useCancelCreditRequest(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<CreditPurchaseRequest>(`/api/orgs/${orgId}/billing/requests/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...qk.org(orgId), 'billing'] }),
  });
}

// the platform admin's side of "Buy credits"
export const useAdminCreditRequests = (status: 'pending' | 'all' = 'pending') =>
  useQuery({ queryKey: ['admin', 'credit-requests', status], queryFn: () => api<AdminPurchaseRequest[]>(`/api/admin/credit-requests?status=${status}`), retry: noRetryOn4xx });

export function useCancelAdminCreditRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<AdminPurchaseRequest>(`/api/admin/credit-requests/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'credit-requests'] }),
  });
}

// B-R1: where this company's finished reports are pushed, and the log of what went out (or was held, with the reason).
export interface DeliveryOverview {
  settings: DeliverySettings;
  nextAt: string | null;
  /** this server has a mail account, so the e-mail channel can actually send */
  mailReady: boolean;
  /** a webhook signing secret is stored */
  signingReady: boolean;
  recent: DeliveryRecord[];
}

export const useDelivery = (orgId: string) =>
  useQuery({ queryKey: [...qk.org(orgId), 'delivery'], queryFn: () => api<DeliveryOverview>(`/api/orgs/${orgId}/delivery`) });

export function useSaveDelivery(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: DeliverySettingsInput) => api<DeliveryOverview>(`/api/orgs/${orgId}/delivery`, { method: 'PUT', body }),
    onSuccess: (d) => qc.setQueryData([...qk.org(orgId), 'delivery'], d),
  });
}

export function useTestDelivery(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ delivered: boolean; outcomes: { channel: string; ok: boolean; target: string; error: string }[] }>(`/api/orgs/${orgId}/delivery/test`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...qk.org(orgId), 'delivery'] }),
  });
}

// ---- B5-11: company API keys (Company settings -> API access) ----
export const useApiKeys = (orgId: string, enabled = true) =>
  useQuery({ queryKey: [...qk.org(orgId), 'api-keys'], queryFn: () => api<{ items: ApiKeyView[]; max: number }>(`/api/orgs/${orgId}/api-keys`), enabled });

export function useCreateApiKey(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ApiKeyCreate) => api<ApiKeyView & { token: string }>(`/api/orgs/${orgId}/api-keys`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...qk.org(orgId), 'api-keys'] }),
  });
}

export function useRevokeApiKey(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) => api<ApiKeyView>(`/api/orgs/${orgId}/api-keys/${keyId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...qk.org(orgId), 'api-keys'] }),
  });
}

/** B3-7: "Check a page before you publish", free, synchronous, writes nothing. */
export function usePublishCheck(orgId: string, siteId: string) {
  return useMutation({
    mutationFn: (body: PublishCheckInput) => api<PublishCheckResult>(`/api/orgs/${orgId}/sites/${siteId}/publish-check`, { method: 'POST', body }),
  });
}

/** Sends one report now, to the channels already set up. The server still refuses a report the run marked not ready. */
export function useDeliverReport(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reportId: string) => api<{ delivered: boolean; reason: string }>(`/api/orgs/${orgId}/reports/${reportId}/deliver`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...qk.org(orgId), 'delivery'] }),
  });
}

export const useMembers = (orgId: string) =>
  useQuery({ queryKey: [...qk.org(orgId), 'members'], queryFn: () => api<{ members: Member[]; invitations: Invitation[] }>(`/api/orgs/${orgId}/members`) });

export function useTeamMutation<TBody>(orgId: string, method: 'POST' | 'PATCH' | 'DELETE', path: (b: TBody) => string, body?: (b: TBody) => unknown) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: TBody) => api<Invitation | { ok: boolean }>(path(b), { method, body: body ? body(b) : undefined }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...qk.org(orgId), 'members'] }),
  });
}

/** `viewer` (the signed-in user's id, or null) is in the key: the answer depends on who asks (D-11, joined from it already) */
export const useInvitation = (token: string, viewer: string | null = null) =>
  useQuery({ queryKey: ['invitation', token, viewer], queryFn: () => api<InvitationPreview>(`/api/invitations/${token}`), retry: noRetryOn4xx, staleTime: 0 });

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
    mutationFn: (body: { csv: string; fileName?: string }) => api<LinkImportSummary>(`/api/orgs/${orgId}/sites/${siteId}/backlinks/import`, { method: 'POST', body, direct: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.siteData(siteId, 'backlinks') });
    },
  });
}

// ---------- AI visibility wave 2 (W2-A, 2026-10-23) ----------
const aiBase = (orgId: string, siteId: string) => `/api/orgs/${orgId}/sites/${siteId}`;
const aiQs = (params: Record<string, string | number | undefined>) => new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString();

/** One page of a run's answers (the latest unless `run`), filtered, with the filter's rates */
export function useAiAnswers(orgId: string, siteId: string, params: Record<string, string | number | undefined>, enabled = true) {
  const qs = aiQs(params);
  return useQuery({
    queryKey: qk.siteData(siteId, 'ai-answers', qs),
    queryFn: () => api<import('@seo/shared').AiAnswersPage>(`${aiBase(orgId, siteId)}/data/ai/answers${qs ? `?${qs}` : ''}`),
    placeholderData: keepPreviousData,
    retry: noRetryOn4xx,
    staleTime: 60_000,
    enabled,
  });
}
/** One question across the stored runs */
export function useAiQuestion(orgId: string, siteId: string, promptId: string | null) {
  return useQuery({
    queryKey: qk.siteData(siteId, 'ai-question', promptId),
    queryFn: () => api<import('@seo/shared').AiQuestionHistory>(`${aiBase(orgId, siteId)}/data/ai/questions/${encodeURIComponent(promptId ?? '')}`),
    enabled: !!promptId,
    retry: noRetryOn4xx,
    staleTime: 60_000,
  });
}
export type AiImportOverview = { source: string; rows: number; from: string; to: string; citations: number; impressions: number; clicks: number; importedAt: string; fileName: string };
export function useAiImports(orgId: string, siteId: string, enabled = true) {
  return useQuery({
    queryKey: qk.siteData(siteId, 'ai-imports'),
    queryFn: () => api<{ sources: AiImportOverview[] }>(`${aiBase(orgId, siteId)}/data/ai/imports`),
    retry: noRetryOn4xx,
    staleTime: 60_000,
    enabled,
  });
}
/** Upload a Bing AI Performance / Search Console AI export */
export function useAiImport(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { csv: string; fileName?: string; source?: '' | 'bing_ai' | 'gsc_ai'; periodEnd?: string; dateOrder?: '' | 'dmy' | 'mdy' }) => api<import('@seo/shared').AiImportSummary>(`${aiBase(orgId, siteId)}/ai/import`, { method: 'POST', body, direct: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.siteData(siteId, 'ai-imports') }),
  });
}
/** W2-FIX (2026-10-23): the AI repeat pilot's latest price and result (admins); polled while the engine's answer is awaited */
export function useAiPilot(orgId: string, siteId: string, opts: { enabled?: boolean; poll?: boolean } = {}) {
  return useQuery({
    queryKey: qk.siteData(siteId, 'ai-pilot'),
    queryFn: () => api<import('@seo/shared').AiPilotState>(`${aiBase(orgId, siteId)}/ai/pilot`),
    retry: noRetryOn4xx,
    enabled: opts.enabled ?? true,
    refetchInterval: opts.poll ? 5_000 : false,
  });
}
/** Ask the engine for the pilot's price (confirm false) or start it on the owner's confirmation (confirm true) */
export function useAiPilotStart(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (confirm: boolean) => api<{ ok: boolean; requestId: string; confirm: boolean }>(`${aiBase(orgId, siteId)}/ai/pilot`, { method: 'POST', body: { confirm } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.siteData(siteId, 'ai-pilot') }),
  });
}
/** Delete questions from the AI panel (admins) */
export function useAiPromptDelete(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api<{ ok: boolean; deleted: number }>(`${aiBase(orgId, siteId)}/ai/prompts/delete`, { method: 'POST', body: { ids } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.site(siteId) }),
  });
}
/** A CSV download of the AI page (the server streams it; the browser saves it) */
// R-A12: a top-level download straight from the API (the proxy has size and time limits; the cookie is shared on the parent domain)
export const aiExportUrl = (orgId: string, siteId: string, kind: string, filter: Record<string, string>) => directUrl(`${aiBase(orgId, siteId)}/data/ai/export?${aiQs({ kind, ...filter })}`);

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

export function useSiteData<P extends keyof DataPages>(orgId: string, siteId: string, page: P, params0?: Record<string, string | undefined>, opts?: Partial<UseQueryOptions<DataPages[P]>>) {
  // R-A9: this web pages the AI answers through /data/ai/answers, so it asks /data/ai for the summary only (an API without the flag's
  // support sends every answer, which the answers section then pages itself)
  const params = page === 'ai' ? { answers: 'summary', ...params0 } : params0;
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
export const useRecommendedKeywords = (orgId: string, siteId: string, opts?: { enabled?: boolean; poll?: boolean }) =>
  useQuery({
    queryKey: qk.siteData(siteId, 'keywords-recommended'),
    queryFn: () => api<RecommendedKeywords>(`/api/orgs/${orgId}/sites/${siteId}/keywords/recommended`),
    retry: noRetryOn4xx,
    staleTime: 60_000,
    enabled: opts?.enabled ?? true,
    // keyword-first: while the background research runs, look again every 10 s (the onboarding step and the new-ladder page wait on it)
    refetchInterval: opts?.poll ? (q) => (q.state.data?.status === 'running' ? 10_000 : false) : undefined,
  });

/** Checks one keyword for the website (paid, about $0.05; the same keyword checked in the last few hours by the same engine rules is answered free). */
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

// ---------- keyword-first: the website's cycle, Coming up, keyword proposals, research, feedback (API.md, 2026-10-19) ----------
/** Everything on the website's dashboards that a keyword-first decision can change (the pipeline, Coming up, proposals, the cycle). */
const refreshAutopilot = (qc: ReturnType<typeof useQueryClient>, siteId: string) => qc.invalidateQueries({ queryKey: [...qk.site(siteId), 'data'] });

/** The website's weekly cycle: its weekday, the next cycles and the jobs of the current one. */
export const useSiteCycle = (orgId: string, siteId: string, enabled = true) =>
  useQuery({
    queryKey: qk.siteData(siteId, 'cycle'),
    queryFn: () => api<SiteCycleView>(`/api/orgs/${orgId}/sites/${siteId}/cycle`),
    enabled,
    retry: noRetryOn4xx,
    staleTime: 60_000,
  });

/** Moves the website's weekly cycle to another weekday (admins). 409 `cycle_not_started` before its first cycle. */
export function useSetCycleWeekday(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (weekday: number) => api<CycleWeekdayResult>(`/api/orgs/${orgId}/sites/${siteId}/cycle`, { method: 'PATCH', body: { weekday } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.site(siteId) });
      qc.invalidateQueries({ queryKey: qk.sites(orgId) });
      return refreshAutopilot(qc, siteId);
    },
  });
}

/** The latest "Coming up" plan (made two days before each cycle) with the client's decisions on it. */
export const useComingUp = (orgId: string, siteId: string, enabled = true) =>
  useQuery({
    queryKey: qk.siteData(siteId, 'coming-up'),
    queryFn: () => api<ComingUpView>(`/api/orgs/${orgId}/sites/${siteId}/coming-up`),
    enabled,
    retry: noRetryOn4xx,
    staleTime: 60_000,
  });

/** Skip or approve one item of the "Coming up" plan, for this cycle or always. 409 once the cycle started. */
export function useComingUpDecision(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { itemKey: string; decision: 'skip' | 'approve'; scope: 'cycle' | 'always' }) =>
      api<ComingUpDecisionResult>(`/api/orgs/${orgId}/sites/${siteId}/coming-up/decisions`, { method: 'POST', body }),
    onSuccess: (r) => {
      // the item at once (the server's answer), then everything that depends on it
      qc.setQueryData<ComingUpView>(qk.siteData(siteId, 'coming-up'), (d) =>
        d ? { ...d, items: d.items.map((i) => (i.itemKey === r.item.itemKey ? r.item : i)), suggestions: d.suggestions.map((i) => (i.itemKey === r.item.itemKey ? r.item : i)) } : d,
      );
      return refreshAutopilot(qc, siteId);
    },
  });
}

/** The keywords we propose (levels 1-2: suggestions) or announced (level 3: they start on their own unless changed). */
export const useKeywordProposals = (orgId: string, siteId: string, enabled = true) =>
  useQuery({
    queryKey: qk.siteData(siteId, 'keyword-proposals'),
    queryFn: () => api<KeywordProposalList>(`/api/orgs/${orgId}/sites/${siteId}/keyword-proposals`),
    enabled,
    retry: noRetryOn4xx,
    staleTime: 60_000,
  });

export type ProposalAction = { id: string; action: 'approve' } | { id: string; action: 'skip' } | { id: string; action: 'swap'; keyword: string };
export type ProposalResult = { proposal: KeywordProposalView; runId?: string; next?: KeywordProposalView | null };

/** Approve now, skip, or start a different keyword instead (409 `keyword_not_suitable` carries the keyword check). */
export function useProposalAction(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: ProposalAction) =>
      api<ProposalResult>(`/api/orgs/${orgId}/sites/${siteId}/keyword-proposals/${a.id}/${a.action}`, { method: 'POST', body: a.action === 'swap' ? { keyword: a.keyword } : {} }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org', orgId, 'runs'] });
      qc.invalidateQueries({ queryKey: [...qk.org(orgId), 'usage'] });
      return refreshAutopilot(qc, siteId);
    },
  });
}

/** Starts the website's keyword research in the background (free once, at setup). 409 `research_not_free` otherwise. */
export function useStartResearch(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<ResearchStartResult>(`/api/orgs/${orgId}/sites/${siteId}/research/start`, { method: 'POST', body: {} }),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.siteData(siteId, 'keywords-recommended') }),
  });
}

/** "Not what I wanted" on a written page. The answer says whether it dropped the website's autopilot level. */
export function useContentFeedback(orgId: string, reportId: string, siteId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { reason: string }) => api<ContentFeedbackResult>(`/api/orgs/${orgId}/reports/${reportId}/feedback`, { method: 'POST', body: { verdict: 'reject', reason: body.reason } }),
    onSuccess: () => {
      if (!siteId) return;
      qc.invalidateQueries({ queryKey: qk.site(siteId) });
      qc.invalidateQueries({ queryKey: qk.sites(orgId) });
      return refreshAutopilot(qc, siteId);
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

// ---------- link building (v4.13, n8n/seo-agent/LINK_BUILDER_SPEC.md) ----------
/** A company opt-out (the address itself is not kept: `hint` is masked). */
export interface Suppression {
  id: string;
  kind: 'email' | 'domain';
  hint: string;
  reason: string;
  createdAt: string;
}
/** POST .../mailboxes/:id/test */
export interface MailboxTestResult {
  ok: boolean;
  smtp: { ok: boolean; error: string | null };
  imap: { ok: boolean; error: string | null };
  dns: DnsCheck;
}

const mailboxesKey = (orgId: string) => [...qk.org(orgId), 'mailboxes'] as const;
const suppressionsKey = (orgId: string) => [...qk.org(orgId), 'suppressions'] as const;
/** under the site's data key: a run started for the website refreshes it too */
const linkBuildingKey = (siteId: string) => qk.siteData(siteId, 'link-building');
/** every website's link-building board (they list the company's mailboxes and the opt-out count) */
const anyLinkBuilding = { predicate: (q: { queryKey: readonly unknown[] }) => q.queryKey[0] === 'site' && q.queryKey[2] === 'data' && q.queryKey[3] === 'link-building' };

// Drafts marked "not a fit" in this session: the server reads the engine's prospect rows through a 60-second cache and lists a rejected
// prospect's draft until then, so a refetch must not bring the card back.
const dismissedDrafts = new Set<string>();
const draftKey = (siteId: string, prospectDomain: string, type: string) => `${siteId}|${prospectDomain}|${type}`;

/** A website's link building: drafts to approve, sequences, replies, listings, redirects, impact, settings, KPIs. */
export const useLinkBuilding = (orgId: string, siteId: string) =>
  useQuery({
    queryKey: linkBuildingKey(siteId),
    queryFn: () => api<LinkBuildingData>(`/api/orgs/${orgId}/sites/${siteId}/link-building`),
    select: (d: LinkBuildingData) => (dismissedDrafts.size ? { ...d, drafts: d.drafts.filter((x) => !dismissedDrafts.has(draftKey(siteId, x.prospectDomain, x.type))) } : d),
    placeholderData: keepPreviousData,
    retry: noRetryOn4xx,
    staleTime: 30_000,
  });

/** A mutation on the website's link building; the board refreshes after it (and after a failure: the state may have moved on). */
function useLinkMutation<TBody, TRes = { ok: boolean }>(orgId: string, siteId: string, call: (b: TBody) => { method: 'POST' | 'PATCH'; path: string; body?: unknown }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: TBody) => {
      const c = call(b);
      return api<TRes>(`/api/orgs/${orgId}/sites/${siteId}/link-building${c.path}`, { method: c.method, body: c.body ?? {} });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: linkBuildingKey(siteId) }),
  });
}

/** Approve each / automatic (owner only), the mailbox, the automatic daily limit (admins). */
export function useUpdateLinkSettings(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<LinkSettings>) => api<LinkSettings>(`/api/orgs/${orgId}/sites/${siteId}/link-building/settings`, { method: 'PATCH', body }),
    onSuccess: (settings) => {
      qc.setQueryData<LinkBuildingData>(linkBuildingKey(siteId), (d) => (d ? { ...d, settings } : d));
      return qc.invalidateQueries({ queryKey: linkBuildingKey(siteId) });
    },
  });
}

/** Approves a drafted sequence (edited text): it waits for the mailbox's sending window. 409 codes: no_mailbox, no_address, suppressed, consent_needed. */
export const useApproveOutreach = (orgId: string, siteId: string) =>
  useLinkMutation<{ prospectDomain: string; type: string; toEmail: string; steps: OutreachStep[]; consent: boolean; mailboxId?: string | null }, { ok: boolean; id: string }>(orgId, siteId, (body) => ({ method: 'POST', path: '/approve', body }));

/** "Not a fit": the draft leaves the list at once (the engine's prospect becomes rejected). */
export function useDismissOutreach(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { prospectDomain: string; type: string }) => api<{ ok: boolean }>(`/api/orgs/${orgId}/sites/${siteId}/link-building/dismiss`, { method: 'POST', body }),
    onSuccess: (_r, b) => {
      dismissedDrafts.add(draftKey(siteId, b.prospectDomain, b.type));
      qc.setQueryData<LinkBuildingData>(linkBuildingKey(siteId), (d) => (d ? { ...d, drafts: d.drafts.filter((x) => !(x.prospectDomain === b.prospectDomain && x.type === b.type)) } : d));
    },
  });
}

/** Edits the unsent steps (or the address before the first e-mail) of a sequence. */
export const useUpdateSequence = (orgId: string, siteId: string) =>
  useLinkMutation<{ id: string; steps?: OutreachStep[]; toEmail?: string }>(orgId, siteId, ({ id, ...body }) => ({ method: 'PATCH', path: `/sequences/${id}`, body }));

/** Pause / resume / stop a sequence. */
export const useSequenceAction = (orgId: string, siteId: string) =>
  useLinkMutation<{ id: string; action: 'pause' | 'resume' | 'cancel' }>(orgId, siteId, ({ id, action }) => ({ method: 'POST', path: `/sequences/${id}/${action}` }));

/** Sends the person's answer now, in the same thread. */
export const useSequenceReply = (orgId: string, siteId: string) =>
  useLinkMutation<{ id: string; body: string }>(orgId, siteId, ({ id, body }) => ({ method: 'POST', path: `/sequences/${id}/reply`, body: { body } }));

/** Won (the link check confirms it) or not a fit. */
export const useSequenceOutcome = (orgId: string, siteId: string) =>
  useLinkMutation<{ id: string; status: 'won' | 'rejected' }>(orgId, siteId, ({ id, status }) => ({ method: 'POST', path: `/sequences/${id}/outcome`, body: { status } }));

/** A listing the person handles themselves: submitted / listed / not relevant / missing again. */
export const useListingStatus = (orgId: string, siteId: string) =>
  useLinkMutation<{ listingId: string; status: 'submitted' | 'listed' | 'ignored' | 'missing'; note?: string }>(orgId, siteId, ({ listingId, ...body }) => ({ method: 'POST', path: `/listings/${encodeURIComponent(listingId)}`, body }));

/** "Find opportunities now" (admins): starts the Link Builder for this website; the report arrives by callback. */
export function useRunLinkBuilder(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { freeOnly: boolean }) => api<{ ok: boolean; requestId: string | null }>(`/api/orgs/${orgId}/sites/${siteId}/link-building/run`, { method: 'POST', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org', orgId, 'runs'] });
      qc.invalidateQueries({ queryKey: [...qk.org(orgId), 'usage'] });
    },
  });
}

// mailboxes (company settings: members read, admins change)
export const useMailboxes = (orgId: string, enabled = true) =>
  useQuery({ queryKey: mailboxesKey(orgId), queryFn: () => api<MailboxView[]>(`/api/orgs/${orgId}/mailboxes`), enabled, retry: noRetryOn4xx });

function useMailboxMutation<TBody, TRes>(orgId: string, call: (b: TBody) => { method: 'POST' | 'PATCH' | 'DELETE'; path: string; body?: unknown }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: TBody) => {
      const c = call(b);
      return api<TRes>(`/api/orgs/${orgId}/mailboxes${c.path}`, { method: c.method, body: c.body });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: mailboxesKey(orgId) });
      qc.invalidateQueries(anyLinkBuilding);
    },
  });
}

/** Connects a mailbox: the server logs in to SMTP and IMAP first (400 mailbox_test_failed with the reason; 503 no_key). */
export const useCreateMailbox = (orgId: string) => useMailboxMutation<Record<string, unknown>, MailboxView>(orgId, (body) => ({ method: 'POST', path: '', body }));
/** Changes a mailbox; a new password (or host / port / username) is tested before it is saved. */
export const useUpdateMailbox = (orgId: string) =>
  useMailboxMutation<{ id: string } & Record<string, unknown>, MailboxView>(orgId, ({ id, ...body }) => ({ method: 'PATCH', path: `/${id}`, body }));
export const useTestMailbox = (orgId: string) => useMailboxMutation<{ id: string }, MailboxTestResult>(orgId, ({ id }) => ({ method: 'POST', path: `/${id}/test`, body: {} }));
export const useMailboxAction = (orgId: string) =>
  useMailboxMutation<{ id: string; action: 'pause' | 'resume' }, { ok: boolean }>(orgId, ({ id, action }) => ({ method: 'POST', path: `/${id}/${action}`, body: {} }));
export const useDeleteMailbox = (orgId: string) => useMailboxMutation<{ id: string }, { ok: boolean; revoked?: boolean; note?: string }>(orgId, ({ id }) => ({ method: 'DELETE', path: `/${id}` }));

// L4: mailboxes connected with OAuth. The providers this installation has an app for, and the consent URL to send the person to.
export const useMailProviders = (orgId: string, enabled = true) =>
  useQuery({ queryKey: [...mailboxesKey(orgId), 'providers'], queryFn: () => api<MailProviderInfo[]>(`/api/orgs/${orgId}/mailbox-oauth/providers`), enabled, retry: noRetryOn4xx, staleTime: 300_000 });
export const useStartMailboxOauth = (orgId: string) =>
  useMutation({ mutationFn: (body: { provider: string; label?: string }) => api<{ url: string }>(`/api/orgs/${orgId}/mailbox-oauth/start`, { method: 'POST', body }) });

// the company's opt-out list
export const useSuppressions = (orgId: string, enabled = true) =>
  useQuery({ queryKey: suppressionsKey(orgId), queryFn: () => api<Suppression[]>(`/api/orgs/${orgId}/suppressions`), enabled, retry: noRetryOn4xx });

function useSuppressionMutation<TBody>(orgId: string, call: (b: TBody) => { method: 'POST' | 'DELETE'; path: string; body?: unknown }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: TBody) => {
      const c = call(b);
      return api<{ ok: boolean }>(`/api/orgs/${orgId}/suppressions${c.path}`, { method: c.method, body: c.body });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: suppressionsKey(orgId) });
      qc.invalidateQueries(anyLinkBuilding);
    },
  });
}
export const useAddSuppression = (orgId: string) => useSuppressionMutation<{ value: string; kind: 'email' | 'domain' }>(orgId, (body) => ({ method: 'POST', path: '', body }));
export const useDeleteSuppression = (orgId: string) => useSuppressionMutation<{ id: string }>(orgId, ({ id }) => ({ method: 'DELETE', path: `/${id}` }));

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
    queryFn: () => api<{ run: Run; reports: Report[]; joined?: JoinedRunResult }>(`/api/orgs/${orgId}/runs/${runId}`),
    retry: noRetryOn4xx,
    // keep polling while n8n is working on it (a run that does not exist or is not yours is not polled); R-A3: a check joined to the
    // open run is looked at once a minute until that run's report has arrived
    refetchInterval: (q) => {
      if (!q.state.data && q.state.error instanceof ApiRequestError && q.state.error.status >= 400 && q.state.error.status < 500) return false;
      const s = q.state.data?.run.status;
      if (s === 'joined') return q.state.data?.run.lastStage === 'joined_open_run' && q.state.data.joined && !q.state.data.joined.reportId ? 60_000 : false;
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

// ---------- platform admin (/admin; contract in shared/src/admin.ts) ----------
/** every admin figure is derived from the same records: a change anywhere refreshes all of them (the delivery report is its own) */
const isAdminData = (q: { queryKey: readonly unknown[] }) => q.queryKey[0] === 'admin' && q.queryKey[1] !== 'delivery';
function useAdminMutation<TVars, TRes>(fn: (v: TVars) => Promise<TRes>, forget?: (v: TVars) => (readonly unknown[])[]) {
  const qc = useQueryClient();
  // not awaited: a delete refetches the list the open page reads, which unmounts that page's dialog; awaiting the refetch would drop
  // the caller's own onSuccess (toast, navigate away) because its component is gone by then (found in the 2026-10-18 browser pass)
  return useMutation({
    mutationFn: fn,
    onSuccess: (_r, v) => {
      // a deleted record's own queries are left out: the open page is leaving, and refetching it would only answer 404
      const gone = forget?.(v) ?? [];
      const isGone = (key: readonly unknown[]) => gone.some((g) => JSON.stringify(key.slice(0, g.length)) === JSON.stringify(g));
      void qc.invalidateQueries({ predicate: (q) => isAdminData(q) && !isGone(q.queryKey) });
    },
  });
}
const qsOf = (o: Record<string, string | number | null | undefined>) => {
  const s = new URLSearchParams(Object.entries(o).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString();
  return s ? `?${s}` : '';
};

export const useAdminOverview = (period: AdminPeriod) =>
  useQuery({ queryKey: ['admin', 'overview', period], queryFn: () => api<AdminOverview>(`/api/admin/overview${qsOf({ period })}`), placeholderData: keepPreviousData, retry: noRetryOn4xx });

export const useAdminCompanies = (period: AdminPeriod, enabled = true) =>
  useQuery({ queryKey: ['admin', 'companies', period], queryFn: () => api<AdminCompanyRow[]>(`/api/admin/companies${qsOf({ period })}`), placeholderData: keepPreviousData, enabled, retry: noRetryOn4xx });

export const useAdminCompany = (id: string, period: AdminPeriod) =>
  useQuery({ queryKey: ['admin', 'company', id, period], queryFn: () => api<AdminCompanyDetail>(`/api/admin/companies/${id}${qsOf({ period })}`), placeholderData: keepPreviousData, retry: noRetryOn4xx });

export const useAdminCompanyCredits = (id: string) =>
  useQuery({ queryKey: ['admin', 'credits', id], queryFn: () => api<CreditEntry[]>(`/api/admin/companies/${id}/credits`), retry: noRetryOn4xx });

export const useAdminUpdateCompany = () =>
  useAdminMutation(({ id, ...body }: { id: string } & z.input<typeof adminCompanyUpdateSchema>) => api<AdminCompanyRow>(`/api/admin/companies/${id}`, { method: 'PATCH', body }));

export const useAdminCompanyCredit = () =>
  useAdminMutation(({ id, ...body }: { id: string } & z.output<typeof adminCreditSchema>) => api<CreditEntry>(`/api/admin/companies/${id}/credits`, { method: 'POST', body }));

export const useAdminDeleteCompany = () =>
  useAdminMutation(
    ({ id, confirm }: { id: string; confirm: string }) => api<{ ok: boolean }>(`/api/admin/companies/${id}`, { method: 'DELETE', body: { confirm } }),
    ({ id }) => [
      ['admin', 'company', id],
      ['admin', 'credits', id],
    ],
  );

export const useAdminUsers = (period: AdminPeriod) =>
  useQuery({ queryKey: ['admin', 'users', period], queryFn: () => api<AdminUserRow[]>(`/api/admin/users${qsOf({ period })}`), placeholderData: keepPreviousData, retry: noRetryOn4xx });

export const useAdminCreateUser = () => useAdminMutation((body: z.output<typeof adminCreateUserSchema>) => api<AdminCreatedUser>('/api/admin/users', { method: 'POST', body }));

export const useAdminUpdateUser = () =>
  useAdminMutation(({ id, ...body }: { id: string } & z.input<typeof adminUpdateUserSchema>) => api<AdminUserRow>(`/api/admin/users/${id}`, { method: 'PATCH', body }));

/** 409 `sole_owner` / `sole_member_companies` carry `companies` (ApiRequestError.data); the latter is resent with `soleCompanies` */
export const useAdminDeleteUser = () =>
  useAdminMutation(({ id, ...body }: { id: string } & z.input<typeof adminDeleteUserSchema>) =>
    api<{ deletedCompanies?: { id: string; name: string }[]; keptCompanies?: { id: string; name: string }[] }>(`/api/admin/users/${id}`, { method: 'DELETE', body }),
  );

/** re-reads the engine's cost ledger now (it is otherwise read on a schedule) */
export const useAdminCostSync = () => useAdminMutation((_: void) => api<AdminCostSyncResult>('/api/admin/costs/sync', { method: 'POST', body: {} }));

export const useAdminRevokeSessions = () => useAdminMutation((id: string) => api<{ ok: boolean; revoked?: number }>(`/api/admin/users/${id}/sessions/revoke`, { method: 'POST' }));

export const useAdminSetMembership = () =>
  useAdminMutation(({ userId, ...body }: { userId: string } & z.output<typeof adminMembershipSchema>) => api<{ ok: boolean }>(`/api/admin/users/${userId}/memberships`, { method: 'PUT', body }));

export const useAdminRemoveMembership = () =>
  useAdminMutation(({ userId, orgId }: { userId: string; orgId: string }) => api<{ ok: boolean }>(`/api/admin/users/${userId}/memberships/${orgId}`, { method: 'DELETE' }));

export type AdminRunFilters = { period: AdminPeriod; q?: string; orgId?: string; status?: 'all' | 'failed' | 'running' | 'done'; origin?: 'all' | 'app' | 'schedule'; limit?: number };

/** the runs across every company, newest first, a page at a time (`nextCursor`) */
export const useAdminRuns = (f: AdminRunFilters, enabled = true) =>
  useInfiniteQuery({
    queryKey: ['admin', 'runs', f],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => api<AdminRunsPage>(`/api/admin/runs${qsOf({ ...f, q: f.q?.trim() || undefined, cursor: pageParam })}`),
    getNextPageParam: (last) => last.nextCursor,
    placeholderData: keepPreviousData,
    enabled,
    retry: noRetryOn4xx,
  });

export const useAdminSettings = () => useQuery({ queryKey: ['admin', 'settings'], queryFn: () => api<PlatformSettings>('/api/admin/settings'), retry: noRetryOn4xx });

export const useAdminSaveSettings = () => useAdminMutation((body: z.output<typeof platformSettingsSchema>) => api<PlatformSettings>('/api/admin/settings', { method: 'PUT', body }));

export const useAdminActivity = (limit: number) =>
  useQuery({ queryKey: ['admin', 'activity', limit], queryFn: () => api<AdminActivityRow[]>(`/api/admin/activity${qsOf({ limit })}`), placeholderData: keepPreviousData, retry: noRetryOn4xx });

/** G21: runs delivered / runs started per week, the schedule fires that left no execution behind, and how ops alerts went out. */
export const useAdminDelivery = (enabled: boolean) =>
  useQuery({ queryKey: ['admin', 'delivery'], queryFn: () => api<DeliveryReport>('/api/admin/delivery'), enabled, staleTime: 60_000 });

// ---------- G1 identity: two-step verification, security policy ----------
type NewCodes = { newRecoveryCodes: string[] | null };

export const useMfaStatus = () => useQuery({ queryKey: ['me', 'mfa'], queryFn: () => api<MfaStatus>('/api/me/mfa') });

/** every identity change refreshes the person's status and their /api/me (mfaEnabled) */
function useIdentityMutation<TBody, TRes>(fn: (b: TBody) => Promise<TRes>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }) });
}

export const useTotpStart = () => useMutation({ mutationFn: () => api<TotpEnrolment>('/api/me/mfa/totp/start', { method: 'POST' }) });
export const useTotpConfirm = () => useIdentityMutation((code: string) => api<MfaStatus & NewCodes>('/api/me/mfa/totp/confirm', { method: 'POST', body: { code } }));
export const useTotpDisable = () => useIdentityMutation((_: void) => api<MfaStatus>('/api/me/mfa/totp', { method: 'DELETE' }));
export const useRegenerateRecoveryCodes = () => useIdentityMutation((_: void) => api<NewCodes>('/api/me/mfa/recovery-codes', { method: 'POST' }));
export const usePasskeyOptions = () => useMutation({ mutationFn: () => api<Record<string, unknown>>('/api/me/mfa/passkeys/options', { method: 'POST' }) });
export const usePasskeyRegister = () =>
  useIdentityMutation((b: { name: string; response: Record<string, unknown> }) => api<MfaStatus & NewCodes>('/api/me/mfa/passkeys', { method: 'POST', body: b }));
export const usePasskeyRemove = () => useIdentityMutation((id: string) => api<MfaStatus>(`/api/me/mfa/passkeys/${id}`, { method: 'DELETE' }));

export const useSessions = () => useQuery({ queryKey: ['me', 'sessions'], queryFn: () => api<{ items: SessionView[] }>('/api/me/sessions') });
export const useRevokeSession = () => useIdentityMutation((id: string) => api<{ ok: boolean; signedOutHere: boolean }>(`/api/me/sessions/${id}`, { method: 'DELETE' }));
export const useRevokeOtherSessions = () => useIdentityMutation((_: void) => api<{ ok: boolean; revoked: number }>('/api/me/sessions/revoke-others', { method: 'POST' }));

export const useSso = (orgId: string, enabled = true) => useQuery({ queryKey: [...qk.org(orgId), 'sso'], queryFn: () => api<SsoOverview>(`/api/orgs/${orgId}/sso`), enabled });
/** every SSO change answers with fresh state or nothing: refetch the overview */
export function useSsoMutation<TBody, TRes = unknown>(orgId: string, fn: (b: TBody) => Promise<TRes>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: [...qk.org(orgId), 'sso'] }) });
}

export type AuditFilters = { category?: string; actor?: string; outcome?: string; from?: string; to?: string };
export type AuditPage = { items: AuditEventView[]; nextCursor: string | null; actors?: { id: string; label: string }[]; retentionDays: number };
export const auditQs = (f: AuditFilters) => new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
export function useAuditLog(orgId: string, filters: AuditFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: [...qk.org(orgId), 'audit', filters],
    queryFn: ({ pageParam }) => {
      const qs = auditQs({ ...filters, ...(pageParam ? { before: pageParam } : {}) } as AuditFilters);
      return api<AuditPage>(`/api/orgs/${orgId}/audit${qs ? `?${qs}` : ''}`);
    },
    initialPageParam: '',
    getNextPageParam: (p) => p.nextCursor ?? undefined,
    enabled,
  });
}

export const useSecurityPolicy = (orgId: string) => useQuery({ queryKey: [...qk.org(orgId), 'security'], queryFn: () => api<SecurityPolicy>(`/api/orgs/${orgId}/security`) });
export function useSaveSecurityPolicy(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: SecurityPolicy) => api<SecurityPolicy>(`/api/orgs/${orgId}/security`, { method: 'PUT', body: p }),
    onSuccess: (p) => {
      qc.setQueryData([...qk.org(orgId), 'security'], p);
      qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}
// ---------- G2: CMS publishing (app/docs/CMS_PUBLISHING.md) ----------
const cmsKey = (siteId: string) => ['site', siteId, 'cms'] as const;

export const useCmsConnections = (orgId: string, siteId: string) =>
  useQuery({ queryKey: [...cmsKey(siteId), 'connections'], queryFn: () => api<{ items: CmsConnectionView[] }>(`/api/orgs/${orgId}/sites/${siteId}/cms/connections`), retry: noRetryOn4xx });

/** The website's CMS items and recent attempts (Content page); off when the site is not verified. */
export const useCmsSiteState = (orgId: string, siteId: string, enabled = true) =>
  useQuery({ queryKey: [...cmsKey(siteId), 'state'], queryFn: () => api<CmsSiteState>(`/api/orgs/${orgId}/sites/${siteId}/cms/state`), enabled, retry: noRetryOn4xx, staleTime: 30_000 });

export const useCmsReportState = (orgId: string, reportId: string) =>
  useQuery({ queryKey: [...qk.report(orgId, reportId), 'cms'], queryFn: () => api<CmsReportState>(`/api/orgs/${orgId}/reports/${reportId}/cms`), retry: noRetryOn4xx });

function useCmsInvalidate(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: cmsKey(siteId) });
    qc.invalidateQueries({ queryKey: ['org', orgId, 'report'] });
  };
}

export function useCreateCmsConnection(orgId: string, siteId: string) {
  const done = useCmsInvalidate(orgId, siteId);
  return useMutation({
    mutationFn: (body: CmsConnectionCreate) => api<{ connection: CmsConnectionView; signingSecret?: string }>(`/api/orgs/${orgId}/sites/${siteId}/cms/connections`, { method: 'POST', body }),
    onSuccess: done,
  });
}

export function useUpdateCmsConnection(orgId: string, siteId: string) {
  const done = useCmsInvalidate(orgId, siteId);
  return useMutation({
    mutationFn: ({ id, ...body }: CmsConnectionUpdate & { id: string }) => api<CmsConnectionView>(`/api/orgs/${orgId}/sites/${siteId}/cms/connections/${id}`, { method: 'PATCH', body }),
    onSuccess: done,
  });
}

export function useDeleteCmsConnection(orgId: string, siteId: string) {
  const done = useCmsInvalidate(orgId, siteId);
  return useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/api/orgs/${orgId}/sites/${siteId}/cms/connections/${id}`, { method: 'DELETE' }),
    onSuccess: done,
  });
}

export function useTestCmsConnection(orgId: string, siteId: string) {
  const done = useCmsInvalidate(orgId, siteId);
  return useMutation({
    mutationFn: (id: string) => api<CmsTestResultView>(`/api/orgs/${orgId}/sites/${siteId}/cms/connections/${id}/test`, { method: 'POST' }),
    onSuccess: done,
  });
}

export function useCmsPublish(orgId: string, reportId: string, siteId: string) {
  const done = useCmsInvalidate(orgId, siteId);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CmsPublishInput) => api<CmsPublishResult>(`/api/orgs/${orgId}/reports/${reportId}/cms/publish`, { method: 'POST', body }),
    onSuccess: (r) => {
      done();
      // a live page started the engine's publish check: the website's pipeline and runs change
      if (r.engine.runId) {
        qc.invalidateQueries({ queryKey: ['org', orgId, 'runs'] });
        qc.invalidateQueries({ queryKey: ['site', siteId, 'data'] });
      }
    },
  });
}

export function useCmsRefresh(orgId: string, reportId: string, siteId: string) {
  const done = useCmsInvalidate(orgId, siteId);
  return useMutation({
    mutationFn: (connectionId: string) => api<CmsPublishResult>(`/api/orgs/${orgId}/reports/${reportId}/cms/refresh`, { method: 'POST', body: { connectionId } }),
    onSuccess: done,
  });
}

// ---------- gap #6: crawlers from the site's own logs (app/docs/LOG_ANALYTICS.md) ----------
const crawlersKey = (siteId: string) => [...qk.site(siteId), 'crawlers'] as const;

/** The Crawlers page; polls every 5 s while a log file is waiting or being read. */
export function useCrawlers(orgId: string, siteId: string, days: number) {
  return useQuery({
    queryKey: [...crawlersKey(siteId), days],
    queryFn: () => api<CrawlerData>(`/api/orgs/${orgId}/sites/${siteId}/crawlers?days=${days}`),
    placeholderData: keepPreviousData,
    retry: noRetryOn4xx,
    staleTime: 60_000,
    refetchInterval: (q) => (q.state.data?.ingests.some((i) => i.status === 'queued' || i.status === 'processing') ? 5000 : false),
  });
}

/**
 * Uploads one log file as a raw stream (never read into memory here or on the server). XMLHttpRequest, not fetch: it reports upload
 * progress. Same CSRF header as every other change.
 */
export function uploadLog(orgId: string, siteId: string, file: File, onProgress: (sent: number, total: number) => void): Promise<LogUploadAccepted> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    // straight to the API server (API_ORIGIN): a log file can be hundreds of MB, more than a proxy in front accepts
    xhr.open('POST', directUrl(`/api/orgs/${orgId}/sites/${siteId}/crawlers/upload?name=${encodeURIComponent(file.name)}`));
    xhr.withCredentials = directCredentials() === 'include';
    xhr.setRequestHeader('x-requested-with', 'fetch');
    xhr.setRequestHeader('content-type', 'application/octet-stream');
    xhr.setRequestHeader('accept', 'application/json');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total);
    };
    xhr.onerror = () => reject(new ApiRequestError(0, 'The upload was interrupted. Check your connection and try again.'));
    xhr.onload = () => {
      let data: { error?: string; code?: string; fields?: Record<string, string> } & Partial<LogUploadAccepted> = {};
      try {
        data = JSON.parse(xhr.responseText || '{}');
      } catch {
        /* keep {} */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as LogUploadAccepted);
      else reject(new ApiRequestError(xhr.status, data.error || `Upload failed (${xhr.status})`, data.fields ?? {}, data.code));
    };
    xhr.send(file);
  });
}

export function useUploadLog(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { file: File; onProgress: (sent: number, total: number) => void }) => uploadLog(orgId, siteId, a.file, a.onProgress),
    onSuccess: () => qc.invalidateQueries({ queryKey: crawlersKey(siteId) }),
  });
}

export function useCreatePushKey(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<LogPushKeyCreated>(`/api/orgs/${orgId}/sites/${siteId}/crawlers/push-key`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: crawlersKey(siteId) }),
  });
}

export function useRevokePushKey(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ ok: boolean }>(`/api/orgs/${orgId}/sites/${siteId}/crawlers/push-key`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: crawlersKey(siteId) }),
  });
}

export function useCrawlerSettings(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CrawlerSettingsInput) => api<CrawlerSettingsInput>(`/api/orgs/${orgId}/sites/${siteId}/crawlers/settings`, { method: 'PUT', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: crawlersKey(siteId) }),
  });
}

export function useDeleteCrawlerData(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (confirm: string) => api<{ ok: boolean }>(`/api/orgs/${orgId}/sites/${siteId}/crawlers/data`, { method: 'DELETE', body: { confirm } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: crawlersKey(siteId) }),
  });
}

export const crawlerExportUrl = (orgId: string, siteId: string, kind: 'daily' | 'pages' | 'hits', days: number) => `/api/orgs/${orgId}/sites/${siteId}/crawlers/export?kind=${kind}&days=${days}`;

// ---------- G5: agencies, client workspaces and the client portal (app/docs/WHITE_LABEL.md) ----------
const agencyKey = (orgId: string) => [...qk.org(orgId), 'agency'] as const;

export function useEnableAgency(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<Org>(`/api/orgs/${orgId}/agency`, { method: 'POST' }),
    onSuccess: (org) => {
      qc.setQueryData(qk.org(orgId), org);
      qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export const useClients = (orgId: string, enabled = true) =>
  useQuery({ queryKey: [...agencyKey(orgId), 'clients'], queryFn: () => api<{ clients: AgencyClient[] }>(`/api/orgs/${orgId}/clients`), enabled, retry: noRetryOn4xx });

export function useCreateClient(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; website?: string }) => api<Org>(`/api/orgs/${orgId}/clients`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: agencyKey(orgId) }),
  });
}

export const useClientStaff = (orgId: string, clientId: string | null) =>
  useQuery({
    queryKey: [...agencyKey(orgId), 'staff', clientId],
    queryFn: () => api<{ staff: StaffAccess[] }>(`/api/orgs/${orgId}/clients/${clientId}/staff`),
    enabled: !!clientId,
  });

export function useAssignStaff(orgId: string, clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { userId: string; role: 'admin' | 'member' | 'viewer' | null }) =>
      api<{ staff: StaffAccess[] }>(`/api/orgs/${orgId}/clients/${clientId}/staff/${b.userId}`, { method: 'PUT', body: { role: b.role } }),
    onSuccess: (r) => {
      qc.setQueryData([...agencyKey(orgId), 'staff', clientId], r);
      qc.invalidateQueries({ queryKey: [...agencyKey(orgId), 'clients'] });
    },
  });
}

export const useAgencyOverview = (orgId: string, enabled = true) =>
  useQuery({
    queryKey: [...agencyKey(orgId), 'overview'],
    queryFn: () => api<{ rows: AgencyOverviewRow[]; generatedAt: string }>(`/api/orgs/${orgId}/agency/overview`),
    enabled,
    placeholderData: keepPreviousData,
  });
export const agencyOverviewCsvUrl = (orgId: string) => `/api/orgs/${orgId}/agency/overview.csv`;

export const useBranding = (orgId: string) => useQuery({ queryKey: [...qk.org(orgId), 'branding'], queryFn: () => api<BrandingResponse>(`/api/orgs/${orgId}/branding`) });

export function useSaveBranding(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Branding> | Partial<ClientBranding>) => api<BrandingResponse>(`/api/orgs/${orgId}/branding`, { method: 'PUT', body }),
    onSuccess: (r) => {
      qc.setQueryData([...qk.org(orgId), 'branding'], r);
      qc.invalidateQueries({ queryKey: qk.org(orgId), exact: true });
    },
  });
}

export function useClientSettings(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { clientApproval: boolean }) => api<Org>(`/api/orgs/${orgId}/client-settings`, { method: 'PUT', body }),
    onSuccess: (org) => {
      qc.setQueryData(qk.org(orgId), org);
      qc.invalidateQueries({ queryKey: [...qk.org(orgId), 'branding'] });
    },
  });
}

export const usePortalMail = (orgId: string) => useQuery({ queryKey: [...qk.org(orgId), 'portal-mail'], queryFn: () => api<PortalMailView>(`/api/orgs/${orgId}/portal/mail`) });

export function useSavePortalMail(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { senderName: string; replyTo: string; fromMailboxId: string | null; dkimSelector: string }) =>
      api<PortalMailView>(`/api/orgs/${orgId}/portal/mail`, { method: 'PUT', body }),
    onSuccess: (r) => qc.setQueryData([...qk.org(orgId), 'portal-mail'], r),
  });
}

export function useCheckPortalMail(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<PortalMailView>(`/api/orgs/${orgId}/portal/mail/check`, { method: 'POST' }),
    onSuccess: (r) => qc.setQueryData([...qk.org(orgId), 'portal-mail'], r),
  });
}

export const usePortalDomains = (orgId: string) =>
  useQuery({ queryKey: [...qk.org(orgId), 'portal-domains'], queryFn: () => api<{ domains: PortalDomainView[]; cnameTarget: string | null }>(`/api/orgs/${orgId}/portal/domains`) });

export function usePortalDomainMutations(orgId: string) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: [...qk.org(orgId), 'portal-domains'] });
  return {
    claim: useMutation({ mutationFn: (host: string) => api<PortalDomainView>(`/api/orgs/${orgId}/portal/domains`, { method: 'POST', body: { host } }), onSuccess: refresh }),
    verify: useMutation({
      mutationFn: (id: string) => api<{ domain: PortalDomainView; check: PortalDomainCheck }>(`/api/orgs/${orgId}/portal/domains/${id}/verify`, { method: 'POST' }),
      onSuccess: refresh,
    }),
    release: useMutation({ mutationFn: (id: string) => api<{ ok: boolean }>(`/api/orgs/${orgId}/portal/domains/${id}`, { method: 'DELETE' }), onSuccess: refresh }),
  };
}

const approvalsKey = (orgId: string) => [...qk.org(orgId), 'approvals'] as const;
export const useApprovals = (orgId: string) =>
  useQuery({ queryKey: approvalsKey(orgId), queryFn: () => api<{ items: ApprovalView[]; canDecide: boolean }>(`/api/orgs/${orgId}/approvals`), refetchInterval: 60_000 });
export const useApprovalCandidates = (orgId: string, enabled: boolean) =>
  useQuery({ queryKey: [...approvalsKey(orgId), 'candidates'], queryFn: () => api<{ items: ApprovalCandidate[] }>(`/api/orgs/${orgId}/approvals/candidates`), enabled });

export function useApprovalMutations(orgId: string) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: approvalsKey(orgId) });
  return {
    request: useMutation({
      mutationFn: (b: { kind: 'page' | 'outreach'; itemId: string; siteId: string | null; title: string; note: string }) =>
        api<ApprovalView>(`/api/orgs/${orgId}/approvals`, { method: 'POST', body: b }),
      onSuccess: refresh,
    }),
    decide: useMutation({
      mutationFn: (b: { id: string; decision: 'approved' | 'changes_requested'; note: string }) =>
        api<ApprovalView>(`/api/orgs/${orgId}/approvals/${b.id}/decide`, { method: 'POST', body: { decision: b.decision, note: b.note } }),
      onSuccess: refresh,
    }),
    withdraw: useMutation({ mutationFn: (id: string) => api<{ ok: boolean }>(`/api/orgs/${orgId}/approvals/${id}/withdraw`, { method: 'POST' }), onSuccess: refresh }),
  };
}

export const usePortalHandoff = () =>
  useMutation({ mutationFn: (host: string) => api<{ url: string; expiresInSeconds: number }>('/api/portal/handoff', { method: 'POST', body: { host } }) });

// ---------- H3 (2026-10-28): the review of a written page (questions, the client's version, the final version, approval) ----------
// Contract: @seo/shared page-review.ts. Every mutation answers the whole review, which replaces the cached one; the website's content
// board and pipeline (Needs you) and its stored business facts are refreshed after it.
const reviewKey = (orgId: string, reportId: string) => [...qk.report(orgId, reportId), 'review'] as const;
const factsKey = (siteId: string) => [...qk.site(siteId), 'facts'] as const;

/** The review of one page report; polls every 5 s while the final version is being made. */
export const usePageReview = (orgId: string, reportId: string, enabled = true) =>
  useQuery({
    queryKey: reviewKey(orgId, reportId),
    queryFn: () => api<PageReviewView>(`/api/orgs/${orgId}/reports/${reportId}/review`),
    enabled: enabled && !!reportId,
    retry: noRetryOn4xx,
    refetchInterval: (q) => (q.state.data?.finalize.status === 'running' ? 5_000 : false),
  });

function useReviewMutation<TBody>(orgId: string, reportId: string, call: (b: TBody) => { method: 'POST' | 'PUT' | 'DELETE'; path: string; body?: unknown }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: TBody) => {
      const c = call(b);
      return api<PageReviewView>(`/api/orgs/${orgId}/reports/${reportId}/review${c.path}`, c.method === 'DELETE' ? { method: 'DELETE' } : { method: c.method, body: c.body ?? {} });
    },
    onSuccess: (v, _b) => {
      qc.setQueryData(reviewKey(orgId, reportId), v);
      if (v.siteId) {
        qc.invalidateQueries({ queryKey: ['site', v.siteId, 'data'] });
        qc.invalidateQueries({ queryKey: factsKey(v.siteId) });
      }
      // a final version is a new report, a run is charged: the runs list and the usage move
      if (v.finalize.status === 'running') {
        qc.invalidateQueries({ queryKey: ['org', orgId, 'runs'] });
        qc.invalidateQueries({ queryKey: [...qk.org(orgId), 'usage'] });
      }
    },
  });
}

export interface ReviewAnswerInput {
  questionId: string;
  decision: AnswerDecision;
  text?: string;
}
export const useSaveAnswers = (orgId: string, reportId: string) =>
  useReviewMutation<ReviewAnswerInput[]>(orgId, reportId, (answers) => ({ method: 'PUT', path: '/answers', body: { answers } }));
export const useAcceptPrefilled = (orgId: string, reportId: string) => useReviewMutation<void>(orgId, reportId, () => ({ method: 'POST', path: '/accept-prefilled' }));
export const useSaveVersion = (orgId: string, reportId: string) => useReviewMutation<string>(orgId, reportId, (markdown) => ({ method: 'PUT', path: '/version', body: { markdown } }));
export const useRevertVersion = (orgId: string, reportId: string) => useReviewMutation<void>(orgId, reportId, () => ({ method: 'DELETE', path: '/version' }));
export const useFinalizePage = (orgId: string, reportId: string) => useReviewMutation<void>(orgId, reportId, () => ({ method: 'POST', path: '/finalize' }));
/** W0-B (D2): the client's reason for publishing a page beside the website's page for the same search; null takes it back. */
export const useDuplicateDecision = (orgId: string, reportId: string) =>
  useReviewMutation<{ choice: 'differs' | null; reason?: string }>(orgId, reportId, (b) => ({ method: 'PUT', path: '/decision', body: b }));
export const useApprovePage = (orgId: string, reportId: string) =>
  useReviewMutation<{ versionReportId?: string }>(orgId, reportId, (b) => ({ method: 'POST', path: '/approve', body: b ?? {} }));

/** The website's stored business facts (answers kept once, reused by every later page). */
export const useSiteFacts = (orgId: string, siteId: string, enabled = true) =>
  useQuery({ queryKey: factsKey(siteId), queryFn: () => api<{ facts: FactAnswers }>(`/api/orgs/${orgId}/sites/${siteId}/facts`), enabled, retry: noRetryOn4xx });

export function useSaveFact(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, decision, text }: { key: string; decision: FactAnswer['decision']; text: string }) =>
      api<{ facts: FactAnswers }>(`/api/orgs/${orgId}/sites/${siteId}/facts/${encodeURIComponent(key)}`, { method: 'PUT', body: { decision, text } }),
    onSuccess: (r) => qc.setQueryData(factsKey(siteId), r),
  });
}
export function useDeleteFact(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => api<{ facts: FactAnswers }>(`/api/orgs/${orgId}/sites/${siteId}/facts/${encodeURIComponent(key)}`, { method: 'DELETE' }),
    onSuccess: (r) => qc.setQueryData(factsKey(siteId), r),
  });
}

// ---------- Index coverage (2026-10-29, app/API.md "Index coverage") ----------
const indexingKey = (siteId: string) => [...qk.site(siteId), 'indexing'] as const;

/** The Indexing page in one answer; `status: 'unreadable'` when the engine's data could not be read (the page says so). */
export function useIndexing(orgId: string, siteId: string) {
  return useQuery({
    queryKey: indexingKey(siteId),
    queryFn: () => api<IndexingData | { status: 'unreadable'; error: string }>(`/api/orgs/${orgId}/sites/${siteId}/data/indexing`),
    placeholderData: keepPreviousData,
    retry: noRetryOn4xx,
    staleTime: 60_000,
  });
}

/** wave 2 (DESIGN_WAVE2 §3.2): "I asked Google" for one page (members and up); the page then waits for Google's next reading. */
export function useAskedGoogle(orgId: string, siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => api<{ page: IndexPage }>(`/api/orgs/${orgId}/sites/${siteId}/data/indexing/asked-google`, { method: 'POST', body: { url } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: indexingKey(siteId) }),
  });
}

/** One page of a group's addresses (only when the group is opened past its first 25). */
export function useIndexingPages(orgId: string, siteId: string, q: { lane: string; action: string; cause: string; page: number } | null) {
  return useQuery({
    queryKey: [...indexingKey(siteId), 'pages', q],
    queryFn: () =>
      api<IndexPagesPage & { status: 'ok' | 'unreadable' }>(
        `/api/orgs/${orgId}/sites/${siteId}/data/indexing/pages?${new URLSearchParams({ lane: q!.lane, action: q!.action, cause: q!.cause, page: String(q!.page), pageSize: '25' })}`,
      ),
    enabled: !!q,
    placeholderData: keepPreviousData,
    retry: noRetryOn4xx,
    staleTime: 60_000,
  });
}

/** What happened to one page over time (read when its row is opened). */
export function useIndexingHistory(orgId: string, siteId: string, url: string | null) {
  return useQuery({
    queryKey: [...indexingKey(siteId), 'history', url],
    queryFn: () => api<{ status: 'ok' | 'unreadable'; history: IndexHistoryEntry[] }>(`/api/orgs/${orgId}/sites/${siteId}/data/indexing/history?url=${encodeURIComponent(url!)}`),
    enabled: !!url,
    retry: noRetryOn4xx,
    staleTime: 60_000,
  });
}
