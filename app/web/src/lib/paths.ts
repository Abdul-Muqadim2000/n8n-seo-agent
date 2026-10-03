import type { ModeId } from '@seo/shared';
import { encodePrefill } from './utils';

// Every in-app URL in one place.
export const paths = {
  login: (next?: string) => `/login${next ? `?next=${encodeURIComponent(next)}` : ''}`,
  signup: '/signup',
  forgot: '/forgot-password',
  account: '/account',
  onboarding: (orgId?: string, step?: string) => (orgId ? `/onboarding/${orgId}${step ? `/${step}` : ''}` : '/onboarding'),
  org: (orgId: string) => `/o/${orgId}`,
  site: (orgId: string, siteId: string, page = 'overview') => `/o/${orgId}/sites/${siteId}/${page}`,
  /** one keyword ladder of a website (inside its Pipeline) */
  ladder: (orgId: string, siteId: string, ladderId: string) => `/o/${orgId}/sites/${siteId}/pipeline/ladders/${encodeURIComponent(ladderId)}`,
  /** the "New keyword ladder" flow of a website (choose → review → start); `keyword` preselects or pre-fills it */
  newLadder: (orgId: string, siteId: string, opts: { keyword?: string; country?: string; tab?: 'recommended' | 'check' } = {}) => {
    const q = new URLSearchParams();
    if (opts.keyword) q.set('keyword', opts.keyword);
    if (opts.country) q.set('country', opts.country);
    if (opts.tab) q.set('tab', opts.tab);
    const s = q.toString();
    return `/o/${orgId}/sites/${siteId}/pipeline/new${s ? `?${s}` : ''}`;
  },
  sites: (orgId: string) => `/o/${orgId}/sites`,
  newSite: (orgId: string) => `/o/${orgId}/sites/new`,
  tools: (orgId: string) => `/o/${orgId}/tools`,
  tool: (orgId: string, mode: ModeId, opts: { siteId?: string | null; prefill?: Record<string, unknown> } = {}) => {
    const q = new URLSearchParams();
    if (opts.siteId) q.set('site', opts.siteId);
    if (opts.prefill && Object.keys(opts.prefill).length) q.set('prefill', encodePrefill(opts.prefill));
    const s = q.toString();
    return `/o/${orgId}/tools/${mode}${s ? `?${s}` : ''}`;
  },
  runs: (orgId: string) => `/o/${orgId}/runs`,
  run: (orgId: string, runId: string) => `/o/${orgId}/runs/${runId}`,
  report: (orgId: string, reportId: string) => `/o/${orgId}/reports/${reportId}`,
  reports: (orgId: string) => `/o/${orgId}/reports`,
  settings: (orgId: string, tab = 'company') => `/o/${orgId}/settings/${tab}`,
  admin: '/admin',
};
