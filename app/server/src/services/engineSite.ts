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

// ---------------- the website's GA4 property, app -> engine (2026-10-28) ----------------
// A property chosen on Verification & Google was saved in the app only: the engine kept "ga4:off" (devaicon.com), so the weekly report,
// Recommendations and the Pipeline all said "not connected" while the panel said Connected. The chosen id is written to the engine's site
// row (the Site Tracker reads `ga4_property_id` and keeps it when it detects nothing itself), scoped to this domain AND its own engine id.

type Ga4Site = Pick<SiteRow, 'id' | 'domain' | 'ga4PropertyId' | 'verifiedAt'>;
const bySite = (site: Pick<SiteRow, 'domain'>) => [
  { columnName: 'domain', condition: 'eq' as const, value: site.domain },
  { columnName: 'site_id', condition: 'eq' as const, value: n8nSiteId(site.domain) },
];

/** Writes the website's chosen GA4 property id to its engine site row (a save Google just confirmed). Never writes an empty id. */
export async function syncGa4ToEngine(site: Pick<SiteRow, 'domain' | 'ga4PropertyId' | 'verifiedAt'>, log?: Logger): Promise<boolean> {
  const id = String(site.ga4PropertyId || '').trim();
  if (!site.verifiedAt || !/^\d{1,16}$/.test(id)) return false;
  const { updateRows, invalidateSite } = await import('../n8n/client');
  const ok = await updateRows('sites', bySite(site), { ga4_property_id: id }).catch((err) => {
    warn(log, { site: site.domain, err: String((err as Error)?.message ?? err) }, 'GA4 property not sent to the engine');
    return false;
  });
  if (ok) invalidateSite(site.domain);
  return ok;
}

/**
 * The property was cleared in the app: the engine row forgets it too, but only when it still holds the id the app had sent (a property the
 * engine detected itself is its own, and stays).
 */
export async function clearGa4OnEngine(site: Pick<SiteRow, 'domain' | 'verifiedAt'>, previousId: string, log?: Logger): Promise<void> {
  if (!site.verifiedAt || !previousId) return;
  const { siteRows, updateRows, invalidateSite } = await import('../n8n/client');
  try {
    const row = (await siteRows<{ ga4_property_id?: string; site_id?: string }>('sites', site.domain, { max: 5, fresh: true })).find((r) => r.site_id === n8nSiteId(site.domain));
    if (!row || String(row.ga4_property_id || '').replace(/^properties\//, '') !== previousId) return;
    await updateRows('sites', bySite(site), { ga4_property_id: '' });
    invalidateSite(site.domain);
  } catch (err) {
    warn(log, { site: site.domain, err: String((err as Error)?.message ?? err) }, 'GA4 property not cleared on the engine');
  }
}

/** per website: the id the heal last handled and when; a success is not repeated for 6 hours, a failure is retried after 10 minutes */
const healed = new Map<string, { id: string; at: number; ok: boolean }>();
const HEAL_OK_MS = 6 * 3600_000;
const HEAL_RETRY_MS = 10 * 60_000;

/**
 * A read of the website (Pipeline, Recommendations, Search) found its engine row WITHOUT a GA4 property while one is chosen in the app (every
 * website saved before 2026-10-28). In the background: Google is asked again (the same check a save runs); confirmed, the id goes to the
 * engine and the answer counts as the live check; refused ("not a property of this domain"), the live check says so; no answer, nothing.
 * A property the engine row already holds (its own detection, or another id) is never overwritten here: only a person's save does that.
 */
export function healGa4(site: Ga4Site, engineGa4: string | null | undefined, log?: Logger): void {
  const want = String(site.ga4PropertyId || '').trim();
  const have = String(engineGa4 || '').trim();
  if (!site.verifiedAt || !want || have) return;
  const last = healed.get(site.domain);
  const now = Date.now();
  if (last && last.id === want && now - last.at < (last.ok ? HEAL_OK_MS : HEAL_RETRY_MS)) return;
  healed.set(site.domain, { id: want, at: now, ok: true });
  void (async () => {
    const { assertGa4ForDomain } = await import('./google');
    const { db, schema } = await import('../db');
    const { eq } = await import('drizzle-orm');
    try {
      await assertGa4ForDomain(want, site.domain);
    } catch (err) {
      const refused = err instanceof HttpError && /^Not a property/.test(err.fields?.ga4PropertyId ?? '');
      if (refused) await db.update(schema.sites).set({ ga4CheckedAt: new Date(), ga4Readable: false }).where(eq(schema.sites.id, site.id));
      else healed.set(site.domain, { id: want, at: now, ok: false });
      warn(log, { site: site.domain, err: String((err as Error)?.message ?? err) }, refused ? 'GA4 property refused by Google; not sent to the engine' : 'GA4 property could not be checked; not sent to the engine');
      return;
    }
    await db.update(schema.sites).set({ ga4CheckedAt: new Date(), ga4Readable: true }).where(eq(schema.sites.id, site.id));
    if (!(await syncGa4ToEngine(site, log))) healed.set(site.domain, { id: want, at: now, ok: false });
  })().catch((err) => {
    healed.set(site.domain, { id: want, at: now, ok: false });
    warn(log, { site: site.domain, err: String((err as Error)?.message ?? err) }, 'GA4 heal failed');
  });
}
