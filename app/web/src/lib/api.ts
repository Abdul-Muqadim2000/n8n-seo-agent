import type { ApiError, StepUpMethod } from '@seo/shared';

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string> = {},
    public code?: string,
    /** the whole JSON answer (G1: the step-up methods, the SSO address) */
    public data: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * G1 step-up: a security-relevant change answered `403 reauth_required` opens one dialog (StepUpProvider); when the person confirms
 * it is them, the request is sent once more. Without a handler (or when they cancel) the error reaches the caller as usual.
 */
type StepUpHandler = (methods: StepUpMethod[]) => Promise<boolean>;
let stepUpHandler: StepUpHandler | null = null;
export function setStepUpHandler(h: StepUpHandler | null) {
  stepUpHandler = h;
}

/**
 * deploy/gcp: the API server's own origin when this front end is served from another host of the same site (Vercel), e.g.
 * https://api.alaventra.com (build-time VITE_API_ORIGIN). Everything else goes through this host's /api proxy; requests that may be
 * large or slow (log uploads, backlink CSVs, warehouse exports) go to the API directly, because a proxy in front has body-size and
 * time limits. The session cookie is shared on the parent domain and the server answers CORS for this origin (lib/crossOrigin.ts).
 * Empty (development, the single-server production image) = same origin for everything.
 */
export const API_ORIGIN = String(import.meta.env.VITE_API_ORIGIN ?? '')
  .trim()
  .replace(/\/+$/, '');
/** the URL for a request that should bypass the front end's proxy */
export const directUrl = (path: string) => (API_ORIGIN ? API_ORIGIN + path : path);
/** fetch credentials for such a request: the cookie must travel cross-origin */
export const directCredentials = (): RequestCredentials => (API_ORIGIN ? 'include' : 'same-origin');

/** JSON fetch against the app server. Mutations carry X-Requested-With (the server's CSRF guard). `direct`: see API_ORIGIN. */
export async function api<T>(path: string, opts: { method?: Method; body?: unknown; signal?: AbortSignal; noStepUp?: boolean; direct?: boolean } = {}): Promise<T> {
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = { accept: 'application/json' };
  if (method !== 'GET') headers['x-requested-with'] = 'fetch';
  // G1 idle timeout: what a hidden tab fetches by itself (polling) is not the person being active
  if (method === 'GET' && typeof document !== 'undefined' && document.visibilityState === 'hidden') headers['x-alaventra-passive'] = '1';
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(opts.direct ? directUrl(path) : path, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: opts.direct ? directCredentials() : 'same-origin',
      signal: opts.signal,
    });
  } catch {
    throw new ApiRequestError(0, 'Cannot reach the server. Check your connection and try again.');
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? safeParse(text) : null;
  if (!res.ok) {
    const e = (data ?? {}) as Partial<ApiError> & Record<string, unknown>;
    // G1: the company's idle timeout ended the session — back to sign-in (which explains why), then back here
    if (res.status === 401 && e.code === 'session_idle' && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login'))
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    if (res.status === 403 && e.code === 'reauth_required' && stepUpHandler && !opts.noStepUp) {
      const confirmed = await stepUpHandler(Array.isArray(e.methods) ? (e.methods as StepUpMethod[]) : ['password']);
      if (confirmed) return api<T>(path, { ...opts, noStepUp: true });
    }
    throw new ApiRequestError(res.status, e.error || `Request failed (${res.status})`, e.fields ?? {}, e.code, e);
  }
  return data as T;
}

function safeParse(t: string): unknown {
  try {
    return JSON.parse(t);
  } catch {
    return { error: t.slice(0, 200) };
  }
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiRequestError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}

export const fileUrl = (orgId: string, fileId: string, download = false) => `/api/orgs/${orgId}/files/${fileId}${download ? '?download=1' : ''}`;

/** G15: a file of a shared report, through the share token (no account, read-only). */
export const sharedFileUrl = (token: string, fileId: string, download = false) =>
  `/api/share/${encodeURIComponent(token)}/files/${fileId}${download ? '?download=1' : ''}`;
