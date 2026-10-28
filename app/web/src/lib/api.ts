import { toast } from 'sonner';
import type { ApiError, StepUpMethod, Warning } from '@seo/shared';

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
 * MKT (2026-10-27, mismatch audit §2.2): a request answered `409 confirm_needed` (the server's warnings: a run for another country, a
 * keyword about another market, a likely duplicate...) opens one dialog (ConfirmProvider). For each warning the person chooses Accept
 * (the correction: fields merged into the request, or a call made first) or Continue anyway (its id joins `acknowledge`); the request is
 * then sent again. Cancel, or no handler, and the 409 reaches the caller as usual.
 */
export type ConfirmAnswer =
  | { acknowledge: string[]; set: Record<string, unknown> }
  /** an Accept that replaced the request (e.g. the keyword was added to an existing ladder instead of starting a new one): what was done */
  | { instead: string }
  | null;
/** The error a caller gets when an Accept in the dialog replaced its request: nothing it asked for was sent, the correction was made. */
export const DONE_INSTEAD = 'done_instead';
type ConfirmHandler = (warnings: Warning[], needsAcknowledge: string[]) => Promise<ConfirmAnswer>;
let confirmHandler: ConfirmHandler | null = null;
export function setConfirmHandler(h: ConfirmHandler | null) {
  confirmHandler = h;
}
/** What a 409 confirm_needed that was not answered says in the app (the dialog was cancelled): plain words, never the server's text. */
export const CONFIRM_CANCELLED_TEXT = 'Nothing was started or changed. Check the warnings, then try again.';
/**
 * The person closed the "Check this first" dialog with Cancel (or no dialog could ask): nothing was sent again and nothing changed.
 * A form keeps what the person typed and shows no error; a 409 confirm_needed is never "already exists".
 */
export const isConfirmCancelled = (e: unknown): e is ApiRequestError => e instanceof ApiRequestError && e.status === 409 && e.code === 'confirm_needed';

/** The request again with the person's answers: the accepted fields and every acknowledged id (earlier ones kept). */
export function resendBody(body: unknown, answer: { acknowledge: string[]; set: Record<string, unknown> }): Record<string, unknown> {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const before = Array.isArray(b.acknowledge) ? (b.acknowledge as unknown[]).map(String) : [];
  return { ...b, ...answer.set, acknowledge: [...new Set([...before, ...answer.acknowledge])] };
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
export async function api<T>(
  path: string,
  opts: { method?: Method; body?: unknown; signal?: AbortSignal; noStepUp?: boolean; direct?: boolean; /** MKT: answer a 409 confirm_needed here, never in the dialog */ noConfirm?: boolean; confirmDepth?: number } = {},
): Promise<T> {
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
    // G1: the company's idle timeout ended the session, back to sign-in (which explains why), then back here
    if (res.status === 401 && e.code === 'session_idle' && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login'))
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    if (res.status === 403 && e.code === 'reauth_required' && stepUpHandler && !opts.noStepUp) {
      const confirmed = await stepUpHandler(Array.isArray(e.methods) ? (e.methods as StepUpMethod[]) : ['password']);
      if (confirmed) return api<T>(path, { ...opts, noStepUp: true });
    }
    // MKT: the server's warnings, answered in the dialog, then the same request again (at most three rounds: an Accept can surface a new warning)
    const bodyOk = opts.body === undefined || (!!opts.body && typeof opts.body === 'object' && !Array.isArray(opts.body));
    if (res.status === 409 && e.code === 'confirm_needed' && confirmHandler && !opts.noConfirm && method !== 'GET' && bodyOk && (opts.confirmDepth ?? 0) < 3) {
      const warnings = (Array.isArray(e.warnings) ? e.warnings : Array.isArray(e.notices) ? e.notices : []) as Warning[];
      const answer = await confirmHandler(warnings, Array.isArray(e.needsAcknowledge) ? (e.needsAcknowledge as string[]) : []);
      if (answer && 'instead' in answer) throw new ApiRequestError(409, answer.instead, {}, DONE_INSTEAD, { instead: true });
      if (answer) return api<T>(path, { ...opts, body: resendBody(opts.body, answer), confirmDepth: (opts.confirmDepth ?? 0) + 1 });
      // Cancel: nothing was sent again, nothing changed; the caller keeps its form as it was (isConfirmCancelled)
      throw new ApiRequestError(409, CONFIRM_CANCELLED_TEXT, e.fields ?? {}, 'confirm_needed', { ...e, cancelled: true });
    }
    // the server's own sentence for confirm_needed is written for API clients ("send their ids in acknowledge"): never shown in the app
    if (res.status === 409 && e.code === 'confirm_needed') throw new ApiRequestError(409, CONFIRM_CANCELLED_TEXT, e.fields ?? {}, 'confirm_needed', e);
    throw new ApiRequestError(res.status, errorText(e.error, res.status), e.fields ?? {}, e.code, e);
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

/** The message of an error answer. Ours carry `error` as text; Vercel's platform errors (e.g. MIDDLEWARE_INVOCATION_FAILED)
 *  answer `{"error":{"code","message"}}`, printing that object showed "[object Object]" on the sign-in page (2026-10-18). */
export function errorText(error: unknown, status: number): string {
  if (typeof error === 'string' && error.trim()) return error;
  const m = error && typeof error === 'object' ? (error as { message?: unknown }).message : undefined;
  if (typeof m === 'string' && m.trim()) return status >= 500 ? `${m} (${status}). Please try again in a moment.` : m;
  return status >= 500 ? `The server could not answer (${status}). Please try again in a moment.` : `Request failed (${status})`;
}

/**
 * The error toast of a request that did not do what was asked. A cancelled "Check this first" (409 confirm_needed) is not an error:
 * nothing changed and the person chose that, so nothing is shown. An Accept that replaced the request says what was done instead.
 */
export function toastError(e: unknown, title?: string): void {
  if (isConfirmCancelled(e)) return;
  if (e instanceof ApiRequestError && e.code === DONE_INSTEAD) return void toast.success(e.message);
  if (title) toast.error(title, { description: errorMessage(e) });
  else toast.error(errorMessage(e));
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
