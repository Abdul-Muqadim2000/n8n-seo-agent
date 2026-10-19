import type { FindingRecheck, IndexCoverage, PageWatch, PageWatchRow, RecheckRequest, RecheckState, WatchedPage } from '@seo/shared';
import { badRequest, notFound } from '../lib/errors';
import { rows, updateRows } from '../n8n/client';
import type { AuditFindingRow } from '@seo/shared';

// G11 + G25 (2026-10-13, system review FIX_PLAN.md): the daily key-page watch and Google's view of the same pages, as the technical page
// shows them, and the "I fixed this" request that makes the engine re-check one finding within a day instead of at the next monthly audit.
// The engine owns the data (n8n Data Table seo_page_watch, written by `SEO Agent, Page Watch` every morning and by the weekly URL
// Inspection rotation); this app reads it and writes the one field that asks for a re-check.

const s = (v: unknown) => (v == null ? '' : String(v));
const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const list = (v: unknown) => s(v).split(',').map((x) => x.trim()).filter(Boolean);
/** the watch runs every morning; a row nobody refreshed for two days means the watch is not running for this site */
export const WATCH_STALE_DAYS = 2;
/** when the next daily watch runs (n8n's clock), for the message the app shows after "I fixed this" */
export const WATCH_HOUR_UTC = 5;

export function watchedPage(r: PageWatchRow): WatchedPage {
  return {
    url: s(r.url),
    kind: s(r.kind) || 'page',
    checkedAt: s(r.checked_at),
    status: n(r.status),
    noindex: r.noindex === true,
    canonical: s(r.canonical),
    canonicalOk: r.canonical_ok === true,
    title: s(r.title),
    robotsBlocked: r.robots_blocked === true,
    state: s(r.state) || 'ok',
    changes: list(r.changes),
    lastChangeAt: s(r.last_change_at),
    inspectedAt: s(r.inspect_at),
    // '' means Google was never asked (or the answer failed): never shown as indexed, never as "fine"
    indexed: s(r.indexed) === 'yes' ? true : s(r.indexed) === 'no' ? false : null,
    indexState: s(r.index_state),
    coverage: s(r.coverage),
    googleCanonical: s(r.google_canonical),
    lastCrawl: s(r.last_crawl),
    mobile: s(r.mobile) === 'pass' ? 'pass' : s(r.mobile) === 'fail' ? 'fail' : '',
    richResults: s(r.rich_results).split(',').map((x) => x.trim()).filter(Boolean),
    inspectError: s(r.inspect_error),
  };
}

/** The daily watch of one website: when it last ran, what it watches and what changed in the last week. */
export function watchView(watchRows: PageWatchRow[], now = new Date()): PageWatch | null {
  if (!watchRows.length) return null;
  const pages = watchRows.map(watchedPage).sort((a, b) => (b.lastChangeAt || '').localeCompare(a.lastChangeAt || '') || a.url.localeCompare(b.url));
  const lastCheckedAt = pages.map((p) => p.checkedAt).filter(Boolean).sort().slice(-1)[0] ?? '';
  const since = new Date(now.getTime() - 7 * 864e5).toISOString();
  const changed = pages.filter((p) => p.lastChangeAt && p.lastChangeAt >= since && p.changes.length);
  const fresh = !!lastCheckedAt && now.getTime() - new Date(lastCheckedAt).getTime() < WATCH_STALE_DAYS * 864e5;
  return {
    running: fresh,
    lastCheckedAt,
    pagesWatched: pages.length,
    pagesNotChecked: pages.filter((p) => p.state === 'not_checked').length,
    changedLast7Days: changed.length,
    pages,
    changes: changed.slice(0, 10).map((p) => ({ url: p.url, changes: p.changes, at: p.lastChangeAt })),
  };
}

/** G25: Google's index view over the watched pages, the ones nobody asked about are counted apart, never as "fine". */
export function indexCoverage(watchRows: PageWatchRow[], quota = 2000): IndexCoverage | null {
  if (!watchRows.length) return null;
  const pages = watchRows.map(watchedPage);
  const answered = pages.filter((p) => p.indexed !== null);
  const indexed = answered.filter((p) => p.indexed === true).length;
  const notIndexed = answered.length - indexed;
  const notChecked = pages.length - answered.length;
  const canonicalMismatch = answered.filter((p) => p.googleCanonical && p.googleCanonical !== p.url).length;
  const mobileBad = pages.filter((p) => p.mobile === 'fail').length;
  const text = answered.length
    ? `${indexed} of ${answered.length} key pages are in Google's index${notIndexed ? `, ${notIndexed} ${notIndexed === 1 ? 'is' : 'are'} not` : ''}${notChecked ? `, ${notChecked} not checked yet` : ''} (Search Console URL Inspection; Google allows ${quota.toLocaleString('en-US')} inspections a day per property, so the pages rotate oldest-first).`
    : `No key page has been inspected in Search Console yet (${notChecked} not checked). Nothing is claimed about Google's index until it answers.`;
  return { checked: answered.length, indexed, notIndexed, notChecked, canonicalMismatch, mobileBad, quota, text };
}

/** The re-check state stored on a finding row (null when nobody asked for one). */
export function recheckOf(r: Pick<AuditFindingRow, 'recheck_state' | 'recheck_requested_at' | 'recheck_at' | 'recheck_rule' | 'recheck_note'>): FindingRecheck | null {
  const state = s(r.recheck_state) as RecheckState;
  if (!state || !['requested', 'fixed', 'still_open', 'not_checked'].includes(state)) return null;
  return { state, requestedAt: s(r.recheck_requested_at), checkedAt: s(r.recheck_at), rule: s(r.recheck_rule), note: s(r.recheck_note) };
}

/** When the next daily watch runs (the engine's schedule is 05:45 UTC), worded for the person who just marked a fix done. */
export function nextWatchMessage(now = new Date()): string {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), WATCH_HOUR_UTC, 45, 0));
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  const hours = Math.max(1, Math.round((next.getTime() - now.getTime()) / 36e5));
  return `The daily key-page watch re-checks this one in about ${hours} ${hours === 1 ? 'hour' : 'hours'} (every morning 05:45 UTC) and the result appears here. It does not wait for the next monthly audit.`;
}

/**
 * "I fixed this": marks that finding for a re-check. The engine's daily watch picks every `requested` row up, judges it on the website's
 * key pages and writes the answer back on the same row (fixed / still_open / not_checked with the reason).
 */
export async function requestRecheck(domain: string, auditId: string, findingKey: string, now = new Date()): Promise<RecheckRequest> {
  const key = findingKey.trim();
  const audit = auditId.trim();
  if (!key || key.length > 300) throw badRequest('That issue cannot be re-checked (no finding key).');
  if (!audit || audit.length > 120) throw badRequest('That issue cannot be re-checked (no audit).');
  const found = await rows<AuditFindingRow>('auditFindings', {
    filters: [
      { columnName: 'domain', condition: 'eq', value: domain },
      { columnName: 'audit_id', condition: 'eq', value: audit },
      { columnName: 'finding_key', condition: 'eq', value: key },
    ],
    max: 2,
    fresh: true,
  });
  if (!found.length) throw notFound('That issue is not stored for this audit any more: run a new audit to get its current state.');
  const requestedAt = now.toISOString();
  await updateRows(
    'auditFindings',
    [
      { columnName: 'domain', condition: 'eq', value: domain },
      { columnName: 'audit_id', condition: 'eq', value: audit },
      { columnName: 'finding_key', condition: 'eq', value: key },
    ],
    { recheck_state: 'requested', recheck_requested_at: requestedAt, recheck_at: '', recheck_rule: '', recheck_note: '' },
  );
  return { findingKey: key, state: 'requested', requestedAt, message: nextWatchMessage(now) };
}
