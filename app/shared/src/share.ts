// Expiring share links for one report (G15, system review 2026-10-11 FIX_PLAN; criterion REP 3.7 "Client sharing").
// A report can be shown to somebody with no account through a link that expires. The rules are the same on both sides, so they live here:
//   * the link carries a 256-bit random token; only its SHA-256 hash is stored, so a database copy does not hand out working links;
//   * it is scoped to exactly ONE report — never a dashboard, never a list, never another report's files;
//   * it is read-only and expires (14 days by default, the owner may pick 1-90), and it can be revoked at any time;
//   * who created it, when, and when it was last opened are recorded.
// Nothing here talks to a database: the server's shareLinks service and the app's Share control both use these rules.

import type { SharedBrand } from './brand';
import type { PortalBrand } from './agency';

export const SHARE = {
  /** random bytes behind a token (256 bits, base64url -> 43 characters) */
  tokenBytes: 32,
  /** how many days a new link lasts unless the owner picks something else */
  defaultDays: 14,
  minDays: 1,
  maxDays: 90,
  /** at most this many live links per report (a revoked or expired one never counts) */
  maxPerReport: 10,
  /** the path the link points at */
  path: '/share/',
} as const;

/** The days the owner asked for, kept inside the allowed range (anything unusable falls back to the default). */
export function shareDays(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return SHARE.defaultDays;
  return Math.min(SHARE.maxDays, Math.max(SHARE.minDays, n));
}

/** When a link created now with `days` days expires. */
export function shareExpiry(days: unknown, now: Date = new Date()): Date {
  return new Date(now.getTime() + shareDays(days) * 864e5);
}

/** A token looks like one of ours: base64url, long enough to be a 256-bit secret. A wrong shape never reaches the database. */
export function isShareToken(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 32 && value.length <= 128 && /^[A-Za-z0-9_-]+$/.test(value);
}

export type ShareState = 'live' | 'revoked' | 'expired';

export interface ShareRowLike {
  expiresAt: Date | string;
  revokedAt?: Date | string | null;
}

/** What a stored link is right now. A revoked link stays revoked even if its expiry is still in the future. */
export function shareState(row: ShareRowLike | null | undefined, now: Date = new Date()): ShareState | 'missing' {
  if (!row) return 'missing';
  if (row.revokedAt) return 'revoked';
  return new Date(row.expiresAt).getTime() > now.getTime() ? 'live' : 'expired';
}

/** Whether a stored link may still be opened. */
export function shareUsable(row: ShareRowLike | null | undefined, now: Date = new Date()): boolean {
  return shareState(row, now) === 'live';
}

/** The message somebody sees when a link no longer works — the same words wherever it is shown, and never a hint about the report. */
export function shareRefusal(state: ShareState | 'missing'): string {
  if (state === 'revoked') return 'This link has been turned off by the person who shared it.';
  if (state === 'expired') return 'This link has expired. Ask the person who shared it for a new one.';
  return 'This link is not valid.';
}

/** The absolute link to hand over. `base` is the app's own URL (no trailing slash needed). */
export function shareUrl(base: string, token: string): string {
  return String(base || '').replace(/\/+$/, '') + SHARE.path + token;
}

/** One share link as the app shows it. `url` and `token` are only ever returned the once, right after it is created. */
export interface ShareLink {
  id: string;
  reportId: string;
  state: ShareState;
  expiresAt: string;
  createdAt: string;
  createdByName: string | null;
  lastOpenedAt: string | null;
  opens: number;
  revokedAt: string | null;
  /** only on the answer that created it */
  url?: string;
}

/**
 * B-R2: the caveat a shared report carries when the run that made it said it was not finished work.
 *
 * The delivery rule (B-R1, `report-delivery.ts`) refuses to e-mail a report a run marked not ready, with no override even on a
 * manual send. A share link is the same report leaving the company by another door, so it answers to the same honesty: the link is
 * not blocked — an owner may well want a colleague to look at a draft — but the reader is told, in the run's own words, before they
 * read a single figure.
 */
export interface SharedCaveat {
  /** the hold code from `deliveryDecision` ('not_ready', 'rejected', 'refused', 'unavailable', 'interim') */
  code: string;
  /** the heading a reader sees */
  title: string;
  /** the run's own reason, in the customer's words */
  detail: string;
}

const CAVEAT_TITLE: Record<string, string> = {
  not_ready: 'A draft, not finished work',
  rejected: 'This run did not produce a report',
  refused: 'The engine refused this run',
  unavailable: 'Some of the evidence could not be read',
  interim: 'The work had only started',
};

/**
 * The caveat for a decision from `deliveryDecision`, or null when the report is finished work. Codes that are about the company's
 * own delivery settings rather than about the report ('delivery_off', 'no_channel', 'stage_not_chosen', 'already_delivered') say
 * nothing to a reader and produce no caveat.
 */
export function shareCaveat(d: { deliver: boolean; reason: string; code: string | null }): SharedCaveat | null {
  if (d.deliver || !d.code) return null;
  const title = CAVEAT_TITLE[d.code];
  if (!title) return null;
  return { code: d.code, title, detail: d.reason };
}

/** What somebody holding a live link is shown: one report, read-only, with its files and nothing else. */
export interface SharedReport {
  id: string;
  stage: string;
  status: string;
  title: string;
  siteDomain: string | null;
  receivedAt: string;
  scheduled: boolean;
  summary: Record<string, string | number | boolean | null>;
  files: { id: string; kind: string; fileName: string; mimeType: string; size: number }[];
  /** the company's name, so the reader knows whose report this is (no other company data is exposed) */
  orgName: string;
  /** B-R2: that company's own mark — its business name and logo, and nothing else of its profile */
  brand: SharedBrand;
  /** B-R2: what the run said about itself when it is not finished work, else null */
  caveat: SharedCaveat | null;
  expiresAt: string;
  /** G5: the agency's brand when the report belongs to a white-label client workspace (its name replaces ours in the footer) */
  agencyBrand?: PortalBrand | null;
}
