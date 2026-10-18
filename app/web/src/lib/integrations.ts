import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ExportDestinationInput,
  ExportRunView,
  IntegrationsOverview,
  IntegrationView,
  IssueCreateInput,
  IssueLinkView,
  TrackerConnectInput,
  TrackerKind,
  WebhookDeliveryView,
  WebhookEndpointInput,
  WebhookEndpointView,
} from '@seo/shared';
import { api } from './api';
import { qk } from './queries';

/**
 * G4 (2026-10-17, app/docs/INTEGRATIONS.md): the queries of Company settings → Integrations and of the "Create ticket" buttons.
 * Kept out of queries.ts so the integrations stay one file to read.
 */

const key = (orgId: string) => [...qk.org(orgId), 'integrations'] as const;
const issuesKey = (orgId: string, siteId?: string | null) => [...qk.org(orgId), 'issues', siteId ?? 'all'] as const;

export const useIntegrations = (orgId: string, enabled = true) =>
  useQuery({ queryKey: key(orgId), queryFn: () => api<IntegrationsOverview>(`/api/orgs/${orgId}/integrations`), enabled });

function useOrgMutation<V, R>(orgId: string, fn: (v: V) => Promise<R>, also: (orgId: string) => readonly unknown[][] = () => []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key(orgId) });
      for (const k of also(orgId)) void qc.invalidateQueries({ queryKey: k });
    },
  });
}

// ---- event webhooks ----
export const useCreateEndpoint = (orgId: string) =>
  useOrgMutation(orgId, (body: WebhookEndpointInput) => api<{ endpoint: WebhookEndpointView; secret: string | null }>(`/api/orgs/${orgId}/webhooks`, { method: 'POST', body }));
export const useUpdateEndpoint = (orgId: string) =>
  useOrgMutation(orgId, (v: { id: string; body: Partial<Pick<WebhookEndpointView, 'name' | 'events' | 'websiteIds' | 'enabled'>> }) =>
    api<WebhookEndpointView>(`/api/orgs/${orgId}/webhooks/${v.id}`, { method: 'PATCH', body: v.body }),
  );
export const useDeleteEndpoint = (orgId: string) => useOrgMutation(orgId, (id: string) => api<{ deleted: true }>(`/api/orgs/${orgId}/webhooks/${id}`, { method: 'DELETE' }));
export const useTestEndpoint = (orgId: string) =>
  useOrgMutation(orgId, (id: string) => api<{ ok: boolean; status: number | null; error: string }>(`/api/orgs/${orgId}/webhooks/${id}/test`, { method: 'POST' }));
export const useRotateSecret = (orgId: string) =>
  useOrgMutation(orgId, (id: string) => api<{ endpoint: WebhookEndpointView; secret: string }>(`/api/orgs/${orgId}/webhooks/${id}/rotate-secret`, { method: 'POST' }));
export const useRedeliver = (orgId: string) =>
  useOrgMutation(orgId, (id: string) => api<WebhookDeliveryView | null>(`/api/orgs/${orgId}/webhook-deliveries/${id}/redeliver`, { method: 'POST' }));

// ---- connectors ----
export const useConnectTracker = (orgId: string) =>
  useOrgMutation(orgId, (body: TrackerConnectInput) => api<IntegrationView>(`/api/orgs/${orgId}/integrations/trackers`, { method: 'POST', body }), (o) => [[...qk.org(o), 'issues']]);
export const useConnectExport = (orgId: string) => useOrgMutation(orgId, (body: ExportDestinationInput) => api<IntegrationView>(`/api/orgs/${orgId}/integrations/exports`, { method: 'POST', body }));
export const useUpdateExport = (orgId: string) =>
  useOrgMutation(orgId, (v: { id: string; body: Record<string, unknown> }) => api<IntegrationView>(`/api/orgs/${orgId}/integrations/${v.id}`, { method: 'PATCH', body: v.body }));
export const useTestIntegration = (orgId: string) => useOrgMutation(orgId, (id: string) => api<{ ok: boolean; error: string }>(`/api/orgs/${orgId}/integrations/${id}/test`, { method: 'POST' }));
export const useRunExport = (orgId: string) => useOrgMutation(orgId, (id: string) => api<ExportRunView>(`/api/orgs/${orgId}/integrations/${id}/run`, { method: 'POST', direct: true }));   // an export can take up to 2 minutes: past a proxy's time limit
export const useDeleteIntegration = (orgId: string) =>
  useOrgMutation(orgId, (id: string) => api<{ deleted: true }>(`/api/orgs/${orgId}/integrations/${id}`, { method: 'DELETE' }), (o) => [[...qk.org(o), 'issues']]);

// ---- tickets (members) ----
export interface IssuesAnswer {
  items: IssueLinkView[];
  trackers: { kind: TrackerKind; name: string; target: string; status: string }[];
}
export const useIssues = (orgId: string, siteId: string | null, enabled = true) =>
  useQuery({ queryKey: issuesKey(orgId, siteId), queryFn: () => api<IssuesAnswer>(`/api/orgs/${orgId}/issues${siteId ? `?siteId=${siteId}` : ''}`), enabled, staleTime: 60_000 });

export function useCreateIssue(orgId: string, siteId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: IssueCreateInput) => api<{ existing: boolean; issue: IssueLinkView }>(`/api/orgs/${orgId}/issues`, { method: 'POST', body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: issuesKey(orgId, siteId) }),
  });
}

export function useRefreshIssues(orgId: string, siteId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ refreshed: number; failed: number; items: IssueLinkView[] }>(`/api/orgs/${orgId}/issues/refresh${siteId ? `?siteId=${siteId}` : ''}`, { method: 'POST' }),
    onSuccess: (d) => qc.setQueryData<IssuesAnswer>(issuesKey(orgId, siteId), (old) => (old ? { ...old, items: d.items } : old)),
  });
}

/** the ticket of one finding / recommendation of a website, if one was made */
export const issueFor = (items: IssueLinkView[] | undefined, sourceKey: string) => items?.find((i) => i.sourceKey === sourceKey && i.status === 'created') ?? null;
