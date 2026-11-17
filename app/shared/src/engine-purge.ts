// CR17-B (client report 2026-11-17, C1): which rows of the SEO engine's Data Tables are one website's history, from the ONE list
// (n8n/seo-agent/ladder_common.py SITE_PURGE, generated into engine-purge.generated.ts). Matching is by exact equality only, never a
// prefix: devaicon.com never touches mydevaicon.com or devaicon.com.au. Used by the server's purge (services/enginePurge.ts) when a
// website or a company is deleted; the engine's Site Admin `delete` runs the same list.
import { cleanDomain, n8nSiteId } from './domain';
import { ENGINE_SITE_PURGE, type EnginePurgeKind } from './engine-purge.generated';

export { ENGINE_SITE_PURGE, ENGINE_SITE_KEEP, type EnginePurgeKind, type EnginePurgeTable } from './engine-purge.generated';

/** the exact values a key column must equal: 'domain' = the domain and its www. form, 'id' = the engine site id */
export function enginePurgeValues(kind: EnginePurgeKind, domain: string): string[] {
  const d = cleanDomain(domain);
  if (!d) return [];
  return kind === 'domain' ? [d, `www.${d}`] : [n8nSiteId(d)];
}

export interface EnginePurgeStep {
  table: string;
  column: string;
  kind: EnginePurgeKind;
  /** a row is deleted when its column equals ANY of these */
  values: string[];
}

/**
 * The deletes for one website, one step per table and key column. `idSafe` false (another domain holds the same engine site id, see
 * services/engineSite.ts foreignEngineDomain) leaves the 'id' keys out: those rows cannot be told apart from the other website's.
 */
export function enginePurgePlan(domain: string, opts: { idSafe: boolean }): EnginePurgeStep[] {
  if (!cleanDomain(domain)) return [];
  return ENGINE_SITE_PURGE.flatMap((t) =>
    t.keys.filter((k) => opts.idSafe || k.kind !== 'id').map((k) => ({ table: t.table, column: k.column, kind: k.kind, values: enginePurgeValues(k.kind, domain) })),
  );
}

/** whether a step deletes this row (the same rule n8n applies: column equals one of the values) */
export function enginePurgeMatches(step: Pick<EnginePurgeStep, 'column' | 'values'>, row: Record<string, unknown>): boolean {
  const v = row?.[step.column];
  return typeof v === 'string' && step.values.includes(v);
}
