import { useEffect, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EngineCalibration } from '@seo/shared';
import { api } from './api';
import { useOrgCtx } from './context';

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

/** Loads the org's engine calibration once (5-minute cache) and re-renders the calling component when it arrives. */
export function useEngineCal(): EngineCalibration | null {
  const { org } = useOrgCtx();
  const q = useQuery({
    queryKey: ['engine-costs', org.id],
    queryFn: () => api<{ calibration?: EngineCalibration | null }>(`/api/orgs/${org.id}/costs`),
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
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}
