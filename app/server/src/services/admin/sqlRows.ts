import { sql, type SQL } from 'drizzle-orm';
import { db } from '../../db';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Rows of a raw query on either driver: postgres-js answers an array, PGlite (the route tests) an object with `rows`. Every admin
 * aggregate goes through here.
 */
export async function execRows<T>(q: typeof db | Tx, query: SQL): Promise<T[]> {
  const r = (await q.execute(query)) as unknown;
  if (Array.isArray(r)) return r as T[];
  return ((r as { rows?: T[] })?.rows ?? []) as T[];
}

/** a timestamp parameter for a raw template: postgres-js cannot bind a JS Date there, so it goes as ISO text with a cast */
export const tsv = (d: Date) => sql`${d.toISOString()}::timestamptz`;
