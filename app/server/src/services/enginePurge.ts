import { enginePurgePlan, type EnginePurgeStep } from '@seo/shared';
import type { SiteRow } from '../db/schema';
import { deleteRowsByName } from '../n8n/client';
import { foreignEngineDomain } from './engineSite';

// CR17-B (client report 2026-11-17, C1): when a website (or the company that holds it) is deleted, every engine Data Table row that is
// its history goes too: the one list n8n/seo-agent/ladder_common.py SITE_PURGE (app copy: @seo/shared engine-purge.generated.ts). The
// engine's Site Admin `delete` runs the same list; this is the app's backstop for an engine without that step or a delete it missed.
// Rows match by EXACT equality (the domain, its www. form, or the engine site id), so a look-alike domain is never touched. A table
// that fails is logged and the others still go; nothing here throws (a website delete never fails on the engine).

type Log = { warn: (o: object, m: string) => void; info?: (o: object, m: string) => void };
type Del = (name: string, filters: { columnName: string; condition: 'eq'; value: string }[], match: 'and' | 'or') => Promise<boolean>;

export interface EnginePurgeResult {
  /** delete calls made (one per table and key column) */
  steps: number;
  /** "<table>.<column>" that could not be deleted */
  failed: string[];
  /** another domain holds the same engine site id: the tables keyed only by that id were left alone */
  idSkipped: boolean;
}

/** whether rows keyed only by the engine site id are this website's: no other domain holds the id (read BEFORE the engine's delete) */
export async function engineIdIsOwn(site: Pick<SiteRow, 'domain'>, log: Log): Promise<boolean> {
  try {
    return (await foreignEngineDomain(site, { fresh: true, log })) === null;
  } catch (err) {
    // not readable: the id-only tables are left (never risk another website's rows); the domain-keyed ones still go
    log.warn({ err: String(err), domain: site.domain }, 'engine site id owner not readable: id-keyed history is kept');
    return false;
  }
}

export async function purgeEngineHistory(domain: string, log: Log, opts: { idSafe: boolean; del?: Del }): Promise<EnginePurgeResult> {
  const del: Del = opts.del ?? deleteRowsByName;
  const plan: EnginePurgeStep[] = enginePurgePlan(domain, { idSafe: opts.idSafe });
  const failed: string[] = [];
  // a few at a time: ~50 small deletes against the engine on the same host
  for (let i = 0; i < plan.length; i += 4) {
    await Promise.all(
      plan.slice(i, i + 4).map(async (s) => {
        try {
          await del(s.table, s.values.map((value) => ({ columnName: s.column, condition: 'eq' as const, value })), 'or');
        } catch (err) {
          failed.push(`${s.table}.${s.column}`);
          log.warn({ err: String(err), domain, table: s.table, column: s.column }, 'engine history delete failed');
        }
      }),
    );
  }
  if (!opts.idSafe) log.warn({ domain }, 'another website holds this engine site id: its id-keyed history was not deleted');
  log.info?.({ domain, steps: plan.length, failed: failed.length }, 'engine history purged');
  return { steps: plan.length, failed: failed.sort(), idSkipped: !opts.idSafe };
}
