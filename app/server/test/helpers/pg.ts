import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '../../src/db/schema';

/**
 * G1: a real Postgres for route tests, in-process (PGlite: Postgres compiled to WebAssembly) — no container, no network. Every
 * migration in server/drizzle runs on it, so the tests exercise the real schema, constraints and triggers.
 *
 * Use in a test file:
 *   vi.mock('../src/db', async () => (await import('./helpers/pg')).pgDbModule());
 */
export async function pgDbModule() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  const here = dirname(fileURLToPath(import.meta.url));
  await migrate(db, { migrationsFolder: resolve(here, '../../drizzle') });
  // `sqlClient` is the postgres-js tagged template in production; the health check is all that uses it
  const sqlClient = Object.assign(async (strings: TemplateStringsArray, ...values: unknown[]) => (await client.query(strings.join('?'), values)).rows, {
    end: async () => client.close(),
  });
  return { db, schema, sqlClient, runMigrations: async () => {}, pglite: client };
}
