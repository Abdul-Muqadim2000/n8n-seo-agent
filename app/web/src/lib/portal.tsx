import { useEffect, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { brandCss, brandTokens, type PortalBrand, type PortalContext } from '@seo/shared';
import { api } from './api';

/**
 * G5 (app/docs/WHITE_LABEL.md): the agency's brand in the running page. It is active on an agency's portal host (for every page,
 * sign-in included) and inside a white-label client workspace for the client's own people; agency staff on the app's own host keep
 * Alaventra. Everything that names the product reads it here — the header lockup, the tab title, the loader, the sign-in panel — and
 * the accent tokens are replaced by ones computed for WCAG AA in light and dark (`brandTokens`).
 */

let current: PortalBrand | null = null;
let hostBrand: PortalBrand | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/** the server marks a portal host's page shell (services/portalShell.ts): no Alaventra mark even before the brand has loaded */
export const onPortalHost = (): boolean => typeof document !== 'undefined' && !!document.querySelector('meta[name="portal-host"]');

/** the brand in force right now (null = Alaventra) */
export const portalBrand = (): PortalBrand | null => current;
/** the product name for titles and copy */
export const productName = (): string => current?.name ?? 'Alaventra';

export function usePortalBrand(): PortalBrand | null {
  return useSyncExternalStore(subscribe, portalBrand, portalBrand);
}

const STYLE_ID = 'portal-brand-tokens';
function applyTokens(b: PortalBrand | null) {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(STYLE_ID);
  const t = b?.accent ? brandTokens(b.accent) : null;
  if (!t) {
    el?.remove();
    return;
  }
  const style = el ?? Object.assign(document.createElement('style'), { id: STYLE_ID });
  // only computed `#hex` / rgba() values reach the stylesheet (brandCss); the agency's typed text never does
  style.textContent = brandCss(t);
  if (!el) document.head.appendChild(style);
}

function set(b: PortalBrand | null) {
  if (b === current || (b && current && JSON.stringify(b) === JSON.stringify(current))) return;
  current = b;
  applyTokens(b);
  notify();
}

/** the host's own brand (portal host), fetched once at start */
export function usePortalContext() {
  return useQuery({
    queryKey: ['portal-context'],
    queryFn: () => api<PortalContext | null>('/api/portal/context'),
    staleTime: Infinity,
    retry: false,
  });
}

/** at the root of the app: applies a portal host's brand to every page */
export function PortalHostBrand() {
  const q = usePortalContext();
  const b = q.data?.brand ?? null;
  useEffect(() => {
    hostBrand = b;
    if (b) set(b);
  }, [b]);
  return null;
}

/** inside a white-label client workspace, for the client's own people (and on a share page): the brand while mounted */
export function useApplyBrand(b: PortalBrand | null | undefined) {
  const key = b ? JSON.stringify(b) : '';
  useEffect(() => {
    if (!b) return;
    set(b);
    return () => set(hostBrand);
    // the brand's content, not its identity, decides
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** sets the brand directly (render tests, where effects do not run) */
export const setPortalBrand = (b: PortalBrand | null) => set(b);

/** tests */
export const resetPortalBrand = () => {
  hostBrand = null;
  set(null);
};
