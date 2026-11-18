/**
 * Alerts (client report 2026-11-17, devaicon.com F5 / F6; engine build section 194). One rule for every screen that counts or lists alerts:
 * the Alerts page, the Overview tile and the recommendations' alert count.
 *
 * The engine (Page Watch) keeps ONE alert per condition (`condition_key`): while the condition lasts the same row is seen again
 * (`last_seen_at`, `count`); when the watch reads the page and the condition is gone the row is resolved (`status: 'resolved'`, `resolved_at`,
 * `resolution`). "Mark as seen" in the app writes `ack_by` / `ack_at`: the alert stays listed with the open ones but leaves the open count.
 * Search Console mail alerts and check-in alerts have no lifecycle yet: they are open until resolved by status, as before.
 *
 * The monthly check-in stores -1 as "not recorded" when no Pages export was uploaded (engine Parse_Checkin.js). It is a marker, never a count:
 * `checkinNotIndexed` turns it (and anything negative or missing) into null, and a month-to-month change exists only between two real numbers.
 */

import { GOOGLE_ALL_ADDRESSES_LABEL, GOOGLE_ALL_ADDRESSES_LINE } from './site-health';

export type AlertState = 'open' | 'seen' | 'resolved';

/** The fields of one alert the rule reads (shared ConsoleAlert has them all). */
export interface AlertLike {
  severity: string;
  status: string;
  resolvedAt?: string | null;
  ackAt?: string | null;
}

const CLOSED = ['resolved', 'closed', 'fixed', 'done', 'dismissed', 'ignored'];

/** resolved (the condition is gone, or the alert was closed) > seen (somebody marked it) > open. */
export function alertState(a: AlertLike): AlertState {
  if (CLOSED.includes(String(a.status ?? '').toLowerCase()) || String(a.resolvedAt ?? '').trim()) return 'resolved';
  if (String(a.ackAt ?? '').trim()) return 'seen';
  return 'open';
}

/** An Info alert is a notice: it never makes an alert count, whatever its state. */
export const isNotice = (a: Pick<AlertLike, 'severity'>) => String(a.severity ?? '').toLowerCase() === 'info';

/** Counted as open: not resolved, not marked seen, and not a notice. This is the number on the Overview tile and the Alerts page. */
export const isOpenAlert = (a: AlertLike) => alertState(a) === 'open' && !isNotice(a);

const URGENT = ['critical', 'high', 'serious'];

export interface AlertCounts {
  /** open, not seen, not a notice */
  open: number;
  /** of those, critical or high */
  urgent: number;
  /** marked seen, condition still there */
  seen: number;
  resolved: number;
  total: number;
}

export function alertCounts(alerts: readonly AlertLike[]): AlertCounts {
  const c: AlertCounts = { open: 0, urgent: 0, seen: 0, resolved: 0, total: alerts.length };
  for (const a of alerts) {
    const st = alertState(a);
    if (st === 'resolved') c.resolved += 1;
    else if (st === 'seen') c.seen += 1;
    else if (!isNotice(a)) {
      c.open += 1;
      if (URGENT.includes(String(a.severity ?? '').toLowerCase())) c.urgent += 1;
    }
  }
  return c;
}

/** The Overview / recommendations count: the same rule as the Alerts page. */
export const openAlertCount = (alerts: readonly AlertLike[]) => alertCounts(alerts).open;

/** Which list an alert belongs to on the Alerts page: Open (open and seen, still true) or Resolved. */
export const alertView = (a: AlertLike): 'open' | 'resolved' => (alertState(a) === 'resolved' ? 'resolved' : 'open');

/** Where an alert came from, in the client's words (never the raw source code). */
export function alertSourceLabel(source: string): string {
  const s = String(source ?? '').toLowerCase();
  if (s === 'page_watch') return 'from the daily page watch';
  if (s === 'checkin') return 'from a check-in';
  if (s === 'imap' || s === 'mail') return 'from a Search Console e-mail';
  return '';
}

/** A stored check-in count: -1 (no Pages export uploaded), a negative or a missing value is "not recorded" (null), never a number. */
export function checkinNotIndexed(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** The change between two check-ins, only when both recorded a number. */
export function checkinDelta(now: number | null | undefined, before: number | null | undefined): number | null {
  return typeof now === 'number' && typeof before === 'number' ? now - before : null;
}

/** What the check-in's Pages report counts: Google's own figure, over every address it knows. Shown with every such number. CR17
 *  integration: ONE wording with Index coverage (site-health.ts GOOGLE_ALL_ADDRESSES_LINE / _LABEL, package C), never a second sentence. */
export const GOOGLE_PAGES_COUNT_NOTE = GOOGLE_ALL_ADDRESSES_LINE;
/** The check-in's "not indexed" figure, named as Google's count (its -1 "no export" is shown as NO_PAGES_EXPORT, checkinNotIndexed) */
export const CHECKIN_NOT_INDEXED_LABEL = `Not indexed: ${GOOGLE_ALL_ADDRESSES_LABEL}`;

/** Said where a check-in has no Pages export. */
export const NO_PAGES_EXPORT = 'No Pages export in this check-in';
