// Client report 2026-11-11 (devaicon.com, Technical health page): the "not indexed by Google" finding was the 28 Oct audit's reading,
// shown as Open and High two weeks later while the daily index check had read the same pages every day since (8 of the 15 in Google, 3 left
// out on purpose, 9 of the 10 pages the client asked Google about in the index). The technical page now reads that finding live from the
// daily index check (shared/src/technical-live.ts holds the rule; this file only reads). Every read here can fail without breaking the
// technical page: a failure keeps the audit's finding as it was.

import {
  indexPageOf,
  isIndexFinding,
  liveIndexFinding,
  safeJson,
  type AuditInspectedPage,
  type AuditPoint,
  type Finding,
  type IndexPage,
} from '@seo/shared';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import type { SiteRow } from '../db/schema';
import { indexingData, indexPageRows } from './indexing';

type Logger = { warn: (o: object, msg: string) => void };
const quiet: Logger = { warn: (o, msg) => console.warn(JSON.stringify({ level: 'warn', msg, ...o })) };

/** The audit's inspected pages, from its own report (the engine keeps only 5 sample addresses on the finding row). [] = not found. */
export async function auditInspectedPages(orgId: string, siteId: string, auditId: string): Promise<AuditInspectedPage[]> {
  const R = schema.reports;
  const got = await db
    .select({ pages: sql<unknown>`${R.payload}->'search_console'->'index_coverage'->'pages'` })
    .from(R)
    .where(and(eq(R.orgId, orgId), eq(R.siteId, siteId), inArray(R.stage, ['site_audit', 'full_report']), sql`${R.payload}->>'audit_id' = ${auditId}`))
    .orderBy(desc(R.receivedAt))
    .limit(1);
  return inspectedPagesOf(got[0]?.pages);
}

/** The report's page list, read defensively (pure, for tests). */
export function inspectedPagesOf(v: unknown): AuditInspectedPage[] {
  const xs = Array.isArray(v) ? v : safeJson<unknown[]>(typeof v === 'string' ? v : '', []);
  if (!Array.isArray(xs)) return [];
  return xs
    .map((x) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {}))
    .filter((x) => typeof x.url === 'string' && /^https?:\/\//i.test(x.url))
    .map((x) => ({ url: String(x.url), indexed: x.indexed === true ? true : x.indexed === false ? false : null, coverage: String(x.coverage ?? '') }));
}

export interface LiveSite {
  indexed: number;
  shouldBe: number;
  known: number;
  notChecked: number;
  newWaiting: number;
  checkedAt: string;
}

/** The Indexing page's own totals (buildIndexingData through indexingData), null when the daily index check has no reading. */
export async function indexCheckTotals(site: Pick<SiteRow, 'domain' | 'id' | 'orgId'>, log: Logger = quiet): Promise<LiveSite | null> {
  const d = await indexingData(site, log);
  if (d.status !== 'ok') return null;
  return {
    indexed: d.totals.indexed,
    shouldBe: d.totals.shouldBe,
    known: d.totals.known,
    notChecked: d.totals.unknown,
    newWaiting: Math.max(0, d.lanes.new.shouldBe - d.lanes.new.indexed),
    checkedAt: d.checkedAt ?? '',
  };
}

/** The daily index check's pages of the website (capped as the Indexing page reads them); [] when it cannot be read. */
export async function indexCheckPages(domain: string): Promise<IndexPage[]> {
  return (await indexPageRows(domain).catch(() => [])).map(indexPageOf).filter((p) => p.url);
}

/**
 * The technical page's live part: the selected audit's "not indexed by Google" finding read again from the daily index check (only when the
 * selected audit is the newest one: an older audit is history and keeps its own reading), and the daily index check's pages for the key-page
 * watch's "In Google's index" figure. Never throws: a failed read keeps the audit's finding as it was.
 */
export async function liveTechnical(
  site: Pick<SiteRow, 'domain' | 'id' | 'orgId'>,
  selected: AuditPoint | null,
  newestAuditId: string | null,
  findings: Finding[],
  stored: { key: string; checked: number; sampleUrls: string[] }[],
  log: Logger = quiet,
): Promise<{ findings: Finding[]; indexPages: IndexPage[] }> {
  const targets = findings.filter((f) => f.status !== 'fixed' && f.status !== 'no_longer_seen' && isIndexFinding(f));
  const want = !!selected && targets.length > 0 && selected.auditId === newestAuditId;
  const [pagesR, totalsR, auditR] = await Promise.allSettled([
    indexCheckPages(site.domain),
    want ? indexCheckTotals(site, log) : Promise.resolve(null),
    want && selected ? auditInspectedPages(site.orgId, site.id, selected.auditId) : Promise.resolve([] as AuditInspectedPage[]),
  ]);
  const indexPages = pagesR.status === 'fulfilled' ? pagesR.value : [];
  if (!want || !selected) return { findings, indexPages };
  const totals = totalsR.status === 'fulfilled' ? totalsR.value : null;
  const auditPages = auditR.status === 'fulfilled' ? auditR.value : [];
  if (totalsR.status === 'rejected') log.warn({ site: site.domain, err: String((totalsR.reason as Error)?.message ?? totalsR.reason).slice(0, 200) }, 'index check totals not read');
  const out = findings.map((f) => {
    if (!targets.includes(f)) return f;
    const row = stored.find((x) => x.key === f.key);
    try {
      const live = liveIndexFinding({
        finding: f,
        inspected: row?.checked ?? 0,
        auditedAt: selected.auditedAt,
        auditPages,
        sampleUrls: row?.sampleUrls ?? [],
        indexPages,
        site: totals,
        domain: site.domain,
      });
      return live ? { ...f, live } : f;
    } catch (e) {
      log.warn({ site: site.domain, err: String((e as Error)?.message ?? e).slice(0, 200) }, 'live index finding not built');
      return f;
    }
  });
  return { findings: out, indexPages };
}
