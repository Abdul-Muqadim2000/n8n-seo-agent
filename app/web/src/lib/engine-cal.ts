import { useContext, useEffect, useSyncExternalStore } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { isClientRole, type EngineCalibration } from '@seo/shared';
import { api } from './api';
import { OrgContext } from './context';

/**
 * R99 / R100 (2026-10-16): the engine reserves its own calibrated figure per mode (seo_cache `cost:*`, read by the server's
 * GET /api/orgs/:orgId/costs), and the server's budget check now holds that figure. Every price a screen shows — the tool forms'
 * hero, the cards, the sentences in PRICES — must be the same number, so they all read the calibration from this one store.
 * Until it arrives (or when the engine cannot be read) the shared table's shipped figures are used, exactly as before.
 */
let current: EngineCalibration | null = null;
const listeners = new Set<() => void>();

/** the calibration the price helpers use right now (null = the shipped table) */
export const engineCal = (): EngineCalibration | null => current;

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const snapshot = () => current;

/**
 * Loads the company's engine calibration once (5-minute cache) and re-renders the calling component when it arrives.
 *
 * D-1 (re-rating 2026-10-17): this hook is also used by components that render outside the company layout — onboarding step 6
 * (`MonitorSettingsFields` inside the tracking form) crashed on every load with "useOrgCtx outside OrgLayout". So it never requires
 * the company context: the company is the layout's when there is one, else the `orgId` passed in, else the route's `:orgId`
 * (onboarding is `/onboarding/:orgId/:step`). With no company at all it reads nothing and the shipped table stays in use.
 */
export function useEngineCal(orgId?: string | null): EngineCalibration | null {
  const ctx = useContext(OrgContext);
  const params = useParams();
  const id = ctx?.org.id ?? orgId ?? params.orgId ?? null;
  const q = useQuery({
    queryKey: ['engine-costs', id],
    queryFn: () => api<{ calibration?: EngineCalibration | null }>(`/api/orgs/${id}/costs`),
    // G5: a client person never reads what runs cost (the route refuses them): the shipped table stays in use
    enabled: !!id && !(ctx && isClientRole(ctx.role)),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const next = q.data?.calibration ?? null;
  useEffect(() => {
    if (next && next !== current) {
      current = next;
      listeners.forEach((f) => f());
    }
  }, [next]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
