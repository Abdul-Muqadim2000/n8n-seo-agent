import { eq, sql } from 'drizzle-orm';
import { creditPacksSchema, DEFAULT_CREDIT_PACKS, DEFAULT_PLATFORM_SETTINGS, type PlatformSettings } from '@seo/shared';
import { db, schema } from '../../db';
import type { PlatformSettingsRow } from '../../db/schema';

type Q = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The single settings row (migration 0014 writes it; recreated with the defaults if somebody removed it). */
export async function settingsRow(q: Q = db): Promise<PlatformSettingsRow> {
  const row = await q.query.platformSettings.findFirst({ where: eq(schema.platformSettings.id, 1) });
  if (row) return row;
  await q
    .insert(schema.platformSettings)
    .values({ id: 1, ...DEFAULT_PLATFORM_SETTINGS })
    .onConflictDoNothing();
  return (await q.query.platformSettings.findFirst({ where: eq(schema.platformSettings.id, 1) }))!;
}

export const toSettings = (r: PlatformSettingsRow): PlatformSettings => ({
  creditValueUsd: r.creditValueUsd,
  markup: r.markup,
  signupCredits: r.signupCredits,
  enforceForNewCompanies: r.enforceForNewCompanies,
  creditPacks: creditPacksSchema.safeParse(r.creditPacks).data ?? DEFAULT_CREDIT_PACKS,
  packExpiryMonths: r.packExpiryMonths,
  planRollover: r.planRollover,
  signupExpiryDays: r.signupExpiryDays,
  updatedAt: r.updatedAt?.toISOString() ?? null,
  updatedBy: r.updatedBy ?? null,
});

export async function getSettings(q: Q = db): Promise<PlatformSettings> {
  return toSettings(await settingsRow(q));
}

export async function saveSettings(body: Omit<PlatformSettings, 'updatedAt' | 'updatedBy'>, actorEmail: string): Promise<PlatformSettings> {
  await settingsRow();
  const [r] = await db
    .update(schema.platformSettings)
    .set({ ...body, updatedAt: sql`now()`, updatedBy: actorEmail })
    .where(eq(schema.platformSettings.id, 1))
    .returning();
  return toSettings(r);
}
