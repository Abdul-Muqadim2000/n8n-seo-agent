import { and, ne, or, isNotNull, sql } from 'drizzle-orm';
import { cleanDomain, engineRowIsDomain, n8nSiteId } from '@seo/shared';
import { db, schema } from '../db';
import type { SiteRow } from '../db/schema';
import { HttpError } from '../lib/errors';
import { rows as n8nRows } from '../n8n/client';

// One engine site id, one website (production-safety review 2026-10-20). The engine stores a website under `site_` + its domain with every
// non-alphanumeric run as `-` (shared n8nSiteId), so `foo.co.uk` and `foo-co.uk` share `site_foo-co-uk`. That scheme is used by every
// workflow and cannot change now, so the app holds the line in two places:
//   * a second domain with the same engine id is refused when a website is added and when it is verified (a unique index on verified
//     websites makes the verify race-proof, migration 0019);
//   * every engine row the app reads or writes by site id is checked against this website's domain first. Tables without a domain column
//     (seo_cycle_jobs, seo_skips) are used only when the website's own rows that carry one (seo_sites, seo_cycles) all name this domain.

/** The SQL twin of n8nSiteId over sites.domain (domains are stored clean and lower case). */
export const engineIdSql = sql`('site_' || regexp_replace(${schema.sites.domain}, '[^a-z0-9]+', '-', 'g'))`;

export const ENGINE_ID_TAKEN =
  'This address cannot be set up: another website on this platform has an address that differs only in its dots and dashes (for example foo.co.uk and foo-co.uk), and our engine would mix up their data. Contact support and we will help you.';

/** Another website (any company) that is verified or tracked and whose domain shares this domain's engine id, or null. */
export async function engineIdTakenBy(domain: string, exceptSiteId?: string): Promise<Pick<SiteRow, 'id' | 'orgId' | 'domain'> | null> {
  const d = cleanDomain(domain);
  const row = await db.query.sites.findFirst({
    columns: { id: true, orgId: true, domain: true },
    where: and(
      sql`${engineIdSql} = ${n8nSiteId(d)}`,
      ne(schema.sites.domain, d),
      or(isNotNull(schema.sites.verifiedAt), ne(schema.sites.trackingStatus, 'not_started')),
      exceptSiteId ? ne(schema.sites.id, exceptSiteId) : undefined,
    ),
  });
  return row ?? null;
}

/** 409 `engine_id_taken` when another verified or tracked website shares the engine id. */
export async function assertEngineIdFree(domain: string, exceptSiteId?: string): Promise<void> {
  if (await engineIdTakenBy(domain, exceptSiteId)) throw new HttpError(409, ENGINE_ID_TAKEN, 'engine_id_taken');
}

/** The rows that really are this website's: keyed by its site id AND naming its domain. */
export function ownEngineRows<T extends { domain?: unknown }>(rows: T[], site: Pick<SiteRow, 'domain'>): T[] {
  return rows.filter((r) => engineRowIsDomain(r?.domain, site.domain));
}

type Logger = { warn?: (o: object, m: string) => void; error?: (o: object, m: string) => void };
const warn = (log: Logger | undefined, o: object, m: string) =>
  (log?.warn ?? log?.error ?? ((x: object, msg: string) => console.error(JSON.stringify({ level: 'warn', msg, ...x }))))(o, m);

/**
 * The domain another website holds this site id under in the engine (its seo_sites or seo_cycles row names it), or null when every
 * such row is this website's. Tables keyed by site id without a domain column are read and written only when this is null.
 */
export async function foreignEngineDomain(site: Pick<SiteRow, 'domain'>, opts: { fresh?: boolean; log?: Logger } = {}): Promise<string | null> {
  const sid = n8nSiteId(site.domain);
  const by = [{ columnName: 'site_id', condition: 'eq' as const, value: sid }];
  const [sites, cycles] = await Promise.all([n8nRows<{ domain?: unknown }>('sites', { filters: by, max: 20, fresh: opts.fresh }), n8nRows<{ domain?: unknown }>('cycles', { filters: by, max: 20, fresh: opts.fresh })]);
  const other = [...sites, ...cycles].map((r) => cleanDomain(r?.domain)).find((d) => !!d && d !== cleanDomain(site.domain)) ?? null;
  if (other) warn(opts.log, { site: site.domain, siteId: sid, engineDomain: other }, 'engine site id is held by another domain: its rows are not used');
  return other;
}

/** 409 before a write keyed by site id when the engine holds that id for another domain. */
export async function assertEngineSiteIsOurs(site: Pick<SiteRow, 'domain'>, log?: Logger): Promise<void> {
  if (await foreignEngineDomain(site, { fresh: true, log }))
    throw new HttpError(409, 'This change was not saved: our engine has another website under the same name as this one. Contact support and we will sort it out.', 'engine_site_conflict');
}
