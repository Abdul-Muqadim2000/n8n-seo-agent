import { z } from 'zod';
import type { RunCredits } from './api';

/**
 * B5-11 / area 12 G-5 (v4.18): the read API over a company's own data, and B3-7 "is this page publishable?" as an endpoint.
 * Design note: `app/API.md` -> "Read API v1". This file holds what the server and the web app share, the key format, the request
 * schemas, the answer types and the pure rules (pagination cursors, the finding comparison), so they are unit-tested here once.
 */

// ---------------------------------------------------------------------------------------------------------------------------
// 1. Company API keys
// ---------------------------------------------------------------------------------------------------------------------------

export const API_KEY = {
  /** every key starts with this, so a leaked key is recognisable in a log or a scanner */
  prefix: 'asc_',
  /** 256 bits, base64url -> 43 characters after the prefix */
  tokenBytes: 32,
  /** the part of the key shown in the list after creation (`asc_` + 8 characters): enough to tell keys apart, useless to an attacker */
  displayLength: 12,
  maxLive: 10,
  /** expiry choices offered in the app; 0 = never */
  expiryDays: [30, 90, 365, 0] as const,
  defaultExpiryDays: 90,
  /** requests a minute per key (or per session) on every /api/v1 route */
  perMinute: 120,
  /** publish checks per 10 minutes per key */
  publishChecksPer10Min: 30,
  /** G4: run starts a minute per key, the same ceiling as the app's own "start a run" route */
  runsPerMinute: 30,
} as const;

/**
 * G4 (2026-10-17, app/docs/INTEGRATIONS.md): `run` and `admin` are WRITE permissions, chosen at creation and never implied by the
 * others. `run` starts analyses (they use credits, within the company's balance and limits) and pushes findings to the company's issue tracker;
 * `admin` manages the event webhooks and starts exports. A key acts as the person who made it, re-checked on every request.
 */
export const API_SCOPES = ['read', 'publish_check', 'run', 'admin'] as const;
export type ApiScope = (typeof API_SCOPES)[number];
export const API_SCOPE_LABELS: Record<ApiScope, string> = {
  read: 'Read websites, audits and findings, runs, reports, files and the export tables',
  publish_check: 'Check a page before it is published (free, writes nothing)',
  run: 'Start analyses with your credits, and create tickets in your issue tracker',
  admin: 'Manage event webhooks and start data exports',
};
/** the short words the key list shows */
export const API_SCOPE_SHORT: Record<ApiScope, string> = { read: 'read', publish_check: 'publish check', run: 'start runs', admin: 'admin' };
/** the role the key's creator must still hold for a key to use the scope (re-checked on every request) */
export const API_SCOPE_ROLE: Record<ApiScope, 'viewer' | 'member' | 'admin'> = { read: 'viewer', publish_check: 'member', run: 'member', admin: 'admin' };
/** scopes that change something or use credits: shown with a warning when a key is created */
export const API_WRITE_SCOPES: readonly ApiScope[] = ['run', 'admin'];

/** `Idempotency-Key`: what a caller may send (Stripe's shape: an opaque string the caller generates, e.g. a UUID) */
export const IDEMPOTENCY = { header: 'idempotency-key', replayHeader: 'idempotent-replayed', hours: 24, re: /^[A-Za-z0-9_.:-]{1,200}$/ } as const;
export const idempotencyKeyOk = (v: unknown): v is string => typeof v === 'string' && IDEMPOTENCY.re.test(v);

const KEY_RE = /^asc_[A-Za-z0-9_-]{43}$/;
/** true for something shaped like one of our keys, checked before any lookup, so junk never reaches the database */
export const isApiKeyToken = (v: unknown): v is string => typeof v === 'string' && KEY_RE.test(v);
export const keyDisplayPrefix = (token: string): string => token.slice(0, API_KEY.displayLength);

/** `Authorization: Bearer asc_...` -> the key; anything else (no header, another scheme, a malformed key) -> null */
export function bearerKey(header: unknown): string | null {
  if (typeof header !== 'string') return null;
  const m = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return m && isApiKeyToken(m[1]) ? m[1] : null;
}
/** a request that tried to use a key at all (even a malformed one): it is answered as a key request, never by the cookie */
export const triesBearer = (header: unknown): boolean => typeof header === 'string' && /^Bearer\s/i.test(header);

export const apiKeyCreateSchema = z.object({
  name: z.string().trim().min(1, 'Give the key a name, e.g. "Looker Studio" or "CI release check"').max(60, 'At most 60 characters'),
  scopes: z.array(z.enum(API_SCOPES)).min(1, 'Choose at least one permission').max(API_SCOPES.length).default(['read', 'publish_check']),
  expiresInDays: z
    .number()
    .int()
    .refine((v) => (API_KEY.expiryDays as readonly number[]).includes(v), 'Choose 30, 90 or 365 days, or no expiry')
    .default(API_KEY.defaultExpiryDays),
});
export type ApiKeyCreate = z.input<typeof apiKeyCreateSchema>;

export interface ApiKeyView {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiScope[];
  state: 'active' | 'expired' | 'revoked';
  createdAt: string;
  createdByName: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export function apiKeyState(k: { revokedAt: Date | string | null; expiresAt: Date | string | null }, now = new Date()): ApiKeyView['state'] {
  if (k.revokedAt) return 'revoked';
  if (k.expiresAt && new Date(k.expiresAt).getTime() <= now.getTime()) return 'expired';
  return 'active';
}

export function keyExpiry(days: number, now = new Date()): Date | null {
  return days > 0 ? new Date(now.getTime() + days * 86_400_000) : null;
}

// ---------------------------------------------------------------------------------------------------------------------------
// 2. Pagination
// ---------------------------------------------------------------------------------------------------------------------------

export const PAGE = { defaultLimit: 25, maxLimit: 100 } as const;
export const pageLimit = (v: unknown): number => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, PAGE.maxLimit) : PAGE.defaultLimit;
};

/** A keyset position (time + id, for the app's own tables) or an offset (n8n rows, read whole and sorted here). Opaque to callers. */
export type Cursor = { t: string; id: string } | { o: number };

const b64url = (s: string) => {
  const b = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, 'utf8').toString('base64');
  return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64url = (s: string) => {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  return typeof atob === 'function' ? decodeURIComponent(escape(atob(b))) : Buffer.from(b, 'base64').toString('utf8');
};

export const encodeCursor = (c: Cursor): string => b64url(JSON.stringify(c));

/** null for anything that is not a cursor this API issued (a caller's junk is "start from the top", never an error or a crash) */
export function decodeCursor(v: unknown): Cursor | null {
  if (typeof v !== 'string' || !v || v.length > 200 || !/^[A-Za-z0-9_-]+$/.test(v)) return null;
  try {
    const o = JSON.parse(unb64url(v)) as Record<string, unknown>;
    if (o && typeof o.o === 'number' && Number.isInteger(o.o) && o.o >= 0 && o.o < 1_000_000) return { o: o.o };
    if (o && typeof o.t === 'string' && !Number.isNaN(Date.parse(o.t)) && typeof o.id === 'string' && /^[0-9a-f-]{36}$/i.test(o.id)) return { t: o.t, id: o.id };
  } catch {
    /* not ours */
  }
  return null;
}

export interface PageV1<T> {
  items: T[];
  nextCursor: string | null;
}

/** One page of an in-memory list (n8n rows): the offset cursor. */
export function pageOf<T>(all: readonly T[], cursor: Cursor | null, limit: number): PageV1<T> {
  const start = cursor && 'o' in cursor ? cursor.o : 0;
  const items = all.slice(start, start + limit);
  return { items, nextCursor: start + limit < all.length ? encodeCursor({ o: start + limit }) : null };
}

// ---------------------------------------------------------------------------------------------------------------------------
// 3. Answer types
// ---------------------------------------------------------------------------------------------------------------------------

export interface WebsiteV1 {
  id: string;
  domain: string;
  country: string;
  verified: boolean;
  verifiedAt: string | null;
  trackingStatus: string;
  createdAt: string;
}

export interface AuditV1 {
  id: string;
  auditedAt: string;
  /** `technical` (site audit) or `full` (full SEO report): findings are only ever compared within one type */
  reportType: string;
  healthScore: number | null;
  grade: string;
  pagesCrawled: number | null;
  findings: number | null;
  bySeverity: { critical: number; high: number; medium: number; low: number };
  scheduled: boolean;
}

export type FindingStatusV1 = 'new' | 'open' | 'fixed' | 'no_longer_seen';

export interface FindingV1 {
  key: string;
  category: string;
  severity: string;
  title: string;
  /** pages affected (0 for a site-wide finding) */
  affected: number;
  /** how many pages that count was measured on; null when the engine did not store it for this audit */
  checked: number | null;
  /** the engine's own evidence line; null when this audit was stored before evidence was kept (v4.18) */
  evidence: string | null;
  sampleUrls: string[] | null;
  /** the audit's impact weight (its fix-list order) and the sentence behind it; null for audits before G26 */
  impact: number | null;
  impactBasis: string | null;
  status: FindingStatusV1;
  /** the count in the compared audit, when it is comparable */
  previousAffected: number | null;
  /** why the count is not compared with the previous audit (the sample moved), or null */
  notCompared: string | null;
  /** "I fixed this" and the daily watch's answer, when asked */
  recheck: { state: string; at: string | null; rule: string | null; note: string | null } | null;
}

export interface AuditDetailV1 {
  audit: AuditV1;
  /** the previous audit of the same report type, or null */
  comparedWith: string | null;
  findings: FindingV1[];
}

export interface RunV1 {
  id: string;
  websiteId: string | null;
  mode: string;
  title: string;
  status: string;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  reportCount: number;
  /** credits (app/docs/CREDITS.md): quoted, charged, state, capped, as the app's own Run (the provider cost is never sent) */
  credits: RunCredits;
}

export interface ReportFileV1 {
  id: string;
  kind: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface ReportV1 {
  id: string;
  runId: string | null;
  websiteId: string | null;
  stage: string;
  status: string;
  title: string;
  summary: Record<string, string | number | boolean | null>;
  receivedAt: string;
  scheduled: boolean;
  /** the delivery rule: false for a draft that failed its quality check, a refused plan, evidence the engine could not read, ... */
  ready: { ok: boolean; code: string | null; reason: string | null };
  files: ReportFileV1[];
}

// ---------------------------------------------------------------------------------------------------------------------------
// 4. Findings of one audit, compared with the previous audit of the same type
// ---------------------------------------------------------------------------------------------------------------------------

/** a stored seo_audit_findings row, as far as the API reads it */
export interface FindingRowIn {
  finding_key?: unknown;
  category?: unknown;
  severity?: unknown;
  title?: unknown;
  affected_count?: unknown;
  checked?: unknown;
  evidence?: unknown;
  sample_urls?: unknown;
  impact?: unknown;
  impact_basis?: unknown;
  source?: unknown;
  recheck_state?: unknown;
  recheck_at?: unknown;
  recheck_rule?: unknown;
  recheck_note?: unknown;
}

const str = (v: unknown): string => (v == null ? '' : String(v));
const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

/** R19: a count is compared only when both audits measured it on roughly the same pages (within 20%) */
export const SAMPLE_DRIFT_MAX = 0.2;

export function sampleNote(now: number | null, before: number | null): string | null {
  if (!now || !before) return null;
  const drift = Math.abs(now - before) / Math.max(now, before);
  return drift > SAMPLE_DRIFT_MAX ? `not compared: the sample moved (${now} pages checked now, ${before} before)` : null;
}

function sampleUrls(v: unknown): string[] | null {
  if (v == null || v === '') return null;
  let list: unknown = v;
  if (typeof v === 'string') {
    try {
      list = JSON.parse(v);
    } catch {
      list = v.split(/\s*[\n,]\s*/);
    }
  }
  if (!Array.isArray(list)) return null;
  return list.map(str).filter((u) => /^https?:\/\//i.test(u)).slice(0, 10);
}

function recheck(f: FindingRowIn): FindingV1['recheck'] {
  const state = str(f.recheck_state);
  if (!state) return null;
  return { state, at: str(f.recheck_at) || null, rule: str(f.recheck_rule) || null, note: str(f.recheck_note) || null };
}

const SEV: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

/**
 * The findings of one audit for the API. `prev` are the rows of the previous audit **of the same report type** (or none);
 * `oneReading(f)` is the dashboards' R74 rule (a finding resting on one outside reading that is not seen again is "no longer seen",
 * never "fixed"). Order: the audit's own impact order where it exists, else severity then pages, the same order the app shows.
 */
export function findingsV1(cur: readonly FindingRowIn[], prev: readonly FindingRowIn[] | null, oneReading: (f: FindingRowIn) => boolean): FindingV1[] {
  const prevBy = new Map((prev ?? []).map((f) => [str(f.finding_key), f]));
  const curKeys = new Set(cur.map((f) => str(f.finding_key)));
  const base = (f: FindingRowIn) => ({
    key: str(f.finding_key),
    category: str(f.category),
    severity: str(f.severity),
    title: str(f.title),
    checked: num(f.checked) || null,
    evidence: str(f.evidence).trim() || null,
    sampleUrls: sampleUrls(f.sample_urls),
    impact: num(f.impact) || null,
    impactBasis: str(f.impact_basis) || null,
    recheck: recheck(f),
  });
  const out: FindingV1[] = cur.map((f) => {
    const p = prevBy.get(str(f.finding_key));
    const note = p ? sampleNote(num(f.checked), num(p.checked)) : null;
    return {
      ...base(f),
      affected: num(f.affected_count) ?? 0,
      status: prev == null ? 'open' : p ? 'open' : 'new',
      previousAffected: p && !note ? num(p.affected_count) : null,
      notCompared: note,
    };
  });
  for (const p of prev ?? []) {
    if (curKeys.has(str(p.finding_key))) continue;
    out.push({ ...base(p), affected: 0, status: oneReading(p) ? 'no_longer_seen' : 'fixed', previousAffected: num(p.affected_count), notCompared: null });
  }
  const sev = (f: FindingV1) => SEV[f.severity.toLowerCase()] ?? 5;
  return out.sort((a, b) =>
    a.impact != null && b.impact != null ? b.impact - a.impact || sev(a) - sev(b) : sev(a) - sev(b) || b.affected - a.affected,
  );
}

/** `?severity=high,critical&status=new,open` on the audit route */
export function filterFindings(list: readonly FindingV1[], q: { severity?: unknown; status?: unknown }): FindingV1[] {
  const set = (v: unknown) => (typeof v === 'string' && v.trim() ? new Set(v.toLowerCase().split(',').map((x) => x.trim()).filter(Boolean)) : null);
  const sev = set(q.severity);
  const st = set(q.status);
  return list.filter((f) => (!sev || sev.has(f.severity.toLowerCase())) && (!st || st.has(f.status)));
}

// ---------------------------------------------------------------------------------------------------------------------------
// 5. B3-7: the publish check (n8n's `POST /webhook/seo-publish-check` contract; v5/code/PubCheck_Parse_Brief.js validates again)
// ---------------------------------------------------------------------------------------------------------------------------

const shortText = (max: number) => z.string().max(max);
const urlish = z.string().trim().max(2000);

export const publishCheckSchema = z.object({
  markdown: z
    .string()
    .max(200_000, 'At most 200,000 characters')
    .refine((v) => v.trim().split(/\s+/).filter(Boolean).length >= 50, 'Paste the whole page: at least 50 words'),
  keyword: z.string().trim().min(1, 'Enter the search the page is for').max(120, 'At most 120 characters'),
  domain: shortText(253).optional(),
  page_type: shortText(60).optional(),
  target_words: z.number().int().min(200).max(10_000).optional(),
  terms: z
    .array(z.union([shortText(80), z.object({ term: shortText(80), min_count: z.number().int().min(0).max(100).optional() })]))
    .max(60)
    .optional(),
  competitors: z
    .array(z.object({ url: urlish, content: shortText(30_000), rank: z.number().int().min(1).max(100).optional(), title: shortText(300).optional() }))
    .max(10)
    .optional(),
  sources: z.array(z.object({ url: urlish, text: shortText(40_000) })).max(20).optional(),
  internal_links: z.array(urlish).max(500).optional(),
  business_facts: shortText(5_000).optional(),
  currency: shortText(10).optional(),
  country: shortText(60).optional(),
  ai_question: shortText(300).optional(),
  ai_fanout: z.array(shortText(300)).max(12).optional(),
});
export type PublishCheckInput = z.input<typeof publishCheckSchema>;

export interface PublishCheckResult {
  ok: boolean;
  publishable: boolean;
  verdict: string;
  exit_code: 0 | 1 | 2;
  label?: string;
  summary?: string;
  reasons?: string[];
  content_score?: number | null;
  score_bar?: number;
  score_breakdown?: Record<string, unknown>;
  warnings?: string[];
  advice?: string[];
  checks?: Record<string, unknown>;
  fixed_markdown?: string;
  auto_fixes?: string[];
  schema_types?: string[];
  not_checked?: { check: string; reason: string }[];
  basis?: string;
  writes?: string;
  error?: string;
  errors?: string[];
}
