import { eq, sql } from 'drizzle-orm';
import { creditPacksSchema, creditRate, DEFAULT_CREDIT_PACKS, DEFAULT_PLATFORM_SETTINGS, type PlatformSettings } from '@seo/shared';
import { db, schema } from '../../db';
import type { PlatformSettingsRow } from '../../db/schema';

type Q = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// credits (app/docs/CREDITS.md): the credit rate as last read, for code that builds customer answers synchronously (the pipeline and
// ladder builders); every settings read refreshes it, so a caller that awaited settingsRow() first has the current one
let lastRate = creditRate(DEFAULT_PLATFORM_SETTINGS);
const remember = (r: PlatformSettingsRow) => ((lastRate = creditRate(r)), r);
export const cachedCreditRate = () => lastRate;
/** credits for a cost figure at the cached rate (2 decimals) */
export const creditsOfUsd = (usd: number) => Math.round(usd * lastRate * 100) / 100;
/** a price shown before the work ("about N credits"): whole credits, rounded up, as a run is quoted (billing.ts quoteCredits) */
export const wholeCreditsOfUsd = (usd: number) => (usd > 0 ? Math.max(1, Math.ceil(creditsOfUsd(usd) - 1e-9)) : 0);

/** The single settings row (migration 0014 writes it; recreated with the defaults if somebody removed it). */
export async function settingsRow(q: Q = db): Promise<PlatformSettingsRow> {
  const row = await q.query.platformSettings.findFirst({ where: eq(schema.platformSettings.id, 1) });
  if (row) return remember(row);
  await q
    .insert(schema.platformSettings)
    .values({ id: 1, ...DEFAULT_PLATFORM_SETTINGS })
    .onConflictDoNothing();
  return remember((await q.query.platformSettings.findFirst({ where: eq(schema.platformSettings.id, 1) }))!);
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
  return toSettings(remember(r));
}
