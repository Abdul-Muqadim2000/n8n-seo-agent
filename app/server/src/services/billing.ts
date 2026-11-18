import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import {
  autopilotRows,
  type AutopilotRow,
  costPerOutcome,
  creditLimitsOf,
  creditRunways,
  KI_RUN_MODES,
  measuredForecast,
  type AutoTopUpView,
  type CreditForecast,
  type CreditUsage,
  type ForecastSiteInput,
  type UsageEntry,
  creditRate,
  creditStatus,
  creditPacksSchema,
  DEFAULT_CREDIT_PACKS,
  featureLabel,
  formatCredits,
  monitorSettingsSchema,
  n8nSiteId,
  pricePack,
  runwayDays,
  type BillingOverview,
  type CreditActivityRow,
  type CreditLimits,
  type CreditLot,
  type CreditOrigin,
  type CreditPack,
  type CreditPurchaseRequest,
  type CreditRefusal,
  type CreditSource,
  type CreditStatus,
  type MonitorSettings,
  type MonitorsRow,
  type AutopilotLevel,
  type LadderRow,
  type LadderSettingsRow,
} from '@seo/shared';
import { config } from '../config';
import { db, schema } from '../db';
import type { CreditPurchaseRequestRow, OrgRow, PlatformSettingsRow, SiteRow } from '../db/schema';
import { HttpError } from '../lib/errors';
import { sendMail } from '../lib/mailer';
import { siteAdmin, siteRows } from '../n8n/client';
import { addCreditEntry, creditBalance, inFlightCredits, USAGE_ORIGIN_SQL } from './admin/credits';
import { settingsRow } from './admin/settings';
import { billingContacts, listInvoices } from './invoices';
import { execRows, tsv } from './admin/sqlRows';
import { monitorsFromRow } from './data';
import { chosenLadderPagesLeft, chosenLadderWriting } from './cadence';

// Credits as the customer lives with them (app/docs/CREDITS.md): the balance and what can be spent now, the schedules' forecast and
// the credits kept for them, the company's own limits, the check every analysis passes before it starts, the Credits page, and the
// guard that grants plan credits, expires lots, pauses a company's schedules when its credits run out and resumes them after a top-up.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Q = typeof db | Tx;
type Log = { info: (o: object, m: string) => void; warn: (o: object, m: string) => void; error: (o: object, m: string) => void };

const r2 = (n: number) => Math.round(n * 100) / 100;
const DAY = 86_400_000;

export const monthStartUtc = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
export const nextMonthUtc = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
export const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);

export const packsOf = (s: Pick<PlatformSettingsRow, 'creditPacks'>): CreditPack[] => {
  const r = creditPacksSchema.safeParse(s.creditPacks);
  return r.success ? r.data : DEFAULT_CREDIT_PACKS;
};

/** The whole credits a run is quoted (what it is held at and the most it is charged): its estimate at the markup, rounded up. */
export function quoteCredits(estimatedUsd: number, s: Pick<PlatformSettingsRow, 'creditValueUsd' | 'markup'>): number {
  if (!(estimatedUsd > 0)) return 0;
  return Math.max(1, Math.ceil(r2(estimatedUsd * creditRate(s)) - 1e-9));
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The schedules' forecast, per website (cached: it reads each website's monitor settings from the engine)
// ---------------------------------------------------------------------------------------------------------------------------------

export interface SiteForecast {
  siteId: string;
  domain: string;
  /** provider cost a month of the website's schedules at the price list, USD (0 while a person has paused them) */
  usd: number;
  paused: boolean;
  pausedForCredits: boolean;
  pausedReason: string | null;
  /** CR17-I (M2): what the measured forecast needs: the schedule's rows (on / off), pages a week, the pages its ladders still have to
   *  write (null = no ceiling, level 3) and since when it runs */
  rows?: AutopilotRow[];
  pagesPerWeek?: number;
  pagesLeft?: number | null;
  since?: string | null;
  /** FX-SERVER (R3 M1): rows a pending settings change switches on (creditRunway only) */
  switchedOn?: string[];
}

/** A website as the measured forecast (shared/src/credit-forecast.ts) reads it. */
export const forecastSite = (x: SiteForecast): ForecastSiteInput => ({
  domain: x.domain,
  rows: x.rows ?? [],
  pagesPerWeek: x.pagesPerWeek ?? 0,
  pagesLeft: x.pagesLeft === undefined ? 0 : x.pagesLeft,
  since: x.since ?? null,
  pausedByPerson: x.paused && !x.pausedForCredits,
  ...(x.switchedOn?.length ? { switchedOn: x.switchedOn } : {}),
});

const forecastCache = new Map<string, { at: number; sites: SiteForecast[] }>();
const FORECAST_TTL = 10 * 60_000;
export const invalidateForecast = (orgId: string) => void forecastCache.delete(orgId);

const completeMonitors = (m: Partial<MonitorSettings> | null | undefined): MonitorSettings => monitorSettingsSchema.parse({ ...(m ?? {}), brandNames: [], aiPersonas: [], aiMarkets: [] });

/**
 * One website's schedules a month, row by row (provider cost, USD), from the rows the engine holds for it. The one computation behind the
 * Credits page's forecast, the schedules' reserve and the Pipeline's "about N credits a month" with its per-automation figures (pre-launch
 * run 2026-10-21, B4: the Pipeline summed its own figures and read 573 credits where the Credits page read 567).
 */
export function siteAutopilotRows(
  s: Pick<SiteRow, 'autopilotLevel' | 'blogsPerWeek'>,
  mon: MonitorsRow | null | undefined,
  ladders: LadderRow[],
  settings: LadderSettingsRow[],
): AutopilotRow[] {
  // keyword-first (plan §5.4): pages are forecast only while a keyword the client chose has pages to write (level 3: always)
  const level = (s.autopilotLevel === 1 || s.autopilotLevel === 3 ? s.autopilotLevel : 2) as AutopilotLevel;
  return autopilotRows(completeMonitors(monitorsFromRow(mon ?? undefined)), s.blogsPerWeek ?? 0, {
    level,
    writing: chosenLadderWriting(ladders, settings, level),
    ranking: ladders.some((l) => String(l.ladder_id || '').trim() !== ''),
  });
}

/** A change of one website's schedule settings (C1): pages a week, the autopilot level, monitor switches. */
export interface ScheduleChange {
  blogsPerWeek?: number;
  autopilotLevel?: AutopilotLevel;
  monitors?: Partial<MonitorSettings>;
}

/**
 * MKT C1 (2026-10-27, mismatch audit): the company's daily credit use now and with one website's schedules changed, from the same rows as
 * the Credits page (siteAutopilotRows, creditState). null when credits are not enforced for the company.
 */
export async function creditRunway(
  org: Pick<OrgRow, 'id' | 'creditsEnforced' | 'creditLimits'>,
  site: SiteRow,
  change: ScheduleChange,
): Promise<{ enforced: boolean; available: number; dailyBefore: number; dailyAfter: number } | null> {
  if (!org.creditsEnforced) return null;
  const [mon, ladders, settings] = await Promise.all([
    siteRows<MonitorsRow>('monitors', site.domain, { max: 5 }),
    siteRows<LadderRow>('ladders', site.domain, { max: 2000 }),
    siteRows<LadderSettingsRow>('ladderSettings', site.domain, { max: 500 }),
  ]);
  const level = (change.autopilotLevel ?? (site.autopilotLevel === 1 || site.autopilotLevel === 3 ? site.autopilotLevel : 2)) as AutopilotLevel;
  const monitors = completeMonitors({ ...(monitorsFromRow(mon[0] ?? undefined) ?? {}), ...(change.monitors ?? {}) });
  const pagesPerWeek = change.blogsPerWeek ?? site.blogsPerWeek ?? 0;
  const afterRows = autopilotRows(monitors, pagesPerWeek, {
    level,
    writing: chosenLadderWriting(ladders, settings, level),
    ranking: ladders.some((l) => String(l.ladder_id || '').trim() !== ''),
  });
  const afterUsd = afterRows.reduce((t, r) => t + r.usd, 0);
  const sites = await siteForecasts(org.id, { fresh: true });
  const before = await creditState(db, org, { sites });
  const mine = sites.find((x) => x.siteId === site.id);
  // a website paused by a person forecasts nothing, with or without the change; CR17-I: the changed rows go through the same measured
  // forecast (a row switched off forecasts nothing, pages a week move the pages). FX-SERVER (review R3 M1): a row this change switches on
  // has no measured window yet: it is priced at its typical run when it ran before, else from the price list (`switchedOn`), never at
  // the 0 its off weeks charged
  const wasOn = new Set((mine?.rows ?? []).filter((r) => r.on).map((r) => r.id));
  const switchedOn = afterRows.filter((r) => r.on && !wasOn.has(r.id)).map((r) => r.id);
  const changed = (x: SiteForecast): SiteForecast => ({ ...x, usd: afterUsd, rows: afterRows, pagesPerWeek, pagesLeft: level === 3 ? null : chosenLadderPagesLeft(ladders, settings, level), switchedOn });
  const after = mine && !(mine.paused && !mine.pausedForCredits) ? await creditState(db, org, { sites: sites.map((x) => (x.siteId === site.id ? changed(x) : x)) }) : before;
  return { enforced: true, available: before.available, dailyBefore: before.dailyBurn, dailyAfter: after.dailyBurn };
}

/** The tracked, verified websites of a company and what their schedules use a month. */
export async function siteForecasts(orgId: string, opts: { fresh?: boolean } = {}): Promise<SiteForecast[]> {
  const hit = forecastCache.get(orgId);
  if (hit && !opts.fresh && Date.now() - hit.at < FORECAST_TTL) return hit.sites;
  const sites = await db.query.sites.findMany({ where: and(eq(schema.sites.orgId, orgId), inArray(schema.sites.trackingStatus, ['active', 'paused']), isNotNull(schema.sites.verifiedAt)) });
  const out = await Promise.all(
    sites.map(async (s): Promise<SiteForecast> => {
      const pausedByPerson = s.trackingStatus === 'paused' && !s.creditsPausedAt;
      let usd = 0;
      let rows: AutopilotRow[] = [];
      let pagesLeft: number | null = 0;
      if (!pausedByPerson) {
        const [mon, ladders, settings] = await Promise.all([
          siteRows<MonitorsRow>('monitors', s.domain, { max: 5 }).catch(() => [] as MonitorsRow[]),
          siteRows<LadderRow>('ladders', s.domain, { max: 2000 }).catch(() => [] as LadderRow[]),
          siteRows<LadderSettingsRow>('ladderSettings', s.domain, { max: 500 }).catch(() => [] as LadderSettingsRow[]),
        ]);
        rows = siteAutopilotRows(s, mon[0], ladders, settings);
        usd = Math.round(rows.reduce((t, r) => t + r.usd, 0) * 10000) / 10000;
        const level = (s.autopilotLevel === 1 || s.autopilotLevel === 3 ? s.autopilotLevel : 2) as AutopilotLevel;
        pagesLeft = level === 3 ? null : chosenLadderPagesLeft(ladders, settings, level);
      }
      return {
        siteId: s.id,
        domain: s.domain,
        usd,
        paused: s.trackingStatus === 'paused',
        pausedForCredits: !!s.creditsPausedAt,
        pausedReason: s.creditsPausedReason ?? null,
        rows,
        pagesPerWeek: s.blogsPerWeek ?? 0,
        pagesLeft,
        since: (s.trackingStartedAt ?? s.verifiedAt)?.toISOString() ?? null,
      };
    }),
  );
  forecastCache.set(orgId, { at: Date.now(), sites: out });
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// What was used, split autopilot / on-demand (a usage entry's `ref.origin`; older entries: a run behind it = on-demand)
// ---------------------------------------------------------------------------------------------------------------------------------

const ORIGIN = sql.raw(USAGE_ORIGIN_SQL);

/** our own team's test runs among the ledger's usage entries (shared/src/credit-forecast.ts `isOurTestEntry`), as SQL */
const OUR_TEST = sql.raw(`(coalesce(ref->>'mode', '') in (${KI_RUN_MODES.map((m) => `'${m}'`).join(', ')}) and coalesce(ref->>'runId', '') = '')`);
const KI_TRIAL_RUN = sql`exists (select 1 from ${schema.runs} ru where ru.id::text = ref->>'runId' and coalesce(ru.input->>'kiTrial', '') = 'true')`;

/**
 * CR17-I (client report 2026-11-17, F7): the company's credit use over a period, THE one computation of "credits used" (the Pipeline tile,
 * its breakdown, the Credits page, the agency's client list and the admin's company view read it): every usage entry of the ledger in the
 * period, debits and returns, split autopilot / on-demand by the entry's own `ref.origin`, by feature and by website. The feature rows add up
 * to the total. Our team's test runs are named (`ourTests`), never hidden from the total: they were charged until they are returned.
 */
export async function creditUsage(q: Q, orgId: string, period: { from: Date; to?: Date }): Promise<CreditUsage> {
  const to = period.to ?? new Date(Date.now() + 60_000);
  const rows = await execRows<{ origin: string; mode: string; domain: string; test: boolean; used: number; n: number }>(q, sql`
    select ${ORIGIN} as origin, coalesce(ref->>'mode', '') as mode, lower(coalesce(ref->>'domain', '')) as domain,
      (${OUR_TEST} or ${KI_TRIAL_RUN}) as test,
      (-sum(credits))::float as used, count(*) filter (where credits < 0)::int as n
    from ${schema.creditLedger}
    where org_id = ${orgId}::uuid and kind = 'usage' and created_at >= ${tsv(period.from)} and created_at < ${tsv(to)}
    group by 1, 2, 3, 4`);
  const sumOf = (pred: (r: (typeof rows)[number]) => boolean) => rows.filter(pred).reduce((t, r) => t + Number(r.used), 0);
  const autopilot = Math.max(0, r2(sumOf((r) => r.origin !== 'on_demand')));
  const onDemand = Math.max(0, r2(sumOf((r) => r.origin === 'on_demand')));
  const features = new Map<string, BillingOverview['byFeature'][number]>();
  const sites = new Map<string, { domain: string; autopilot: number; onDemand: number }>();
  for (const r of rows) {
    const origin: CreditOrigin = r.origin === 'on_demand' ? 'on_demand' : 'autopilot';
    const label = featureLabel(r.mode);
    const k = `${origin}:${label}`;
    const f = features.get(k) ?? { key: k, label, origin, credits: 0, runs: 0 };
    f.credits = r2(f.credits + Number(r.used));
    // FX-A: our team's test runs are never counted as the company's runs
    if (!r.test) f.runs += Number(r.n);
    features.set(k, f);
    const d = r.domain.replace(/^www\./, '');
    const site = sites.get(d) ?? { domain: d, autopilot: 0, onDemand: 0 };
    if (origin === 'on_demand') site.onDemand = r2(site.onDemand + Number(r.used));
    else site.autopilot = r2(site.autopilot + Number(r.used));
    sites.set(d, site);
  }
  return {
    from: period.from.toISOString(),
    to: to.toISOString(),
    autopilot,
    onDemand,
    total: r2(autopilot + onDemand),
    byFeature: [...features.values()].filter((f) => f.credits !== 0).sort((a, b) => b.credits - a.credits),
    bySite: [...sites.values()].filter((x) => x.autopilot !== 0 || x.onDemand !== 0),
    ourTests: r2(sumOf((r) => r.test)),
  };
}

/** The two halves of creditUsage from `since` to now (kept for the callers that only need them). */
export async function usageSince(q: Q, orgId: string, since: Date): Promise<{ autopilot: number; onDemand: number }> {
  const u = await creditUsage(q, orgId, { from: since });
  return { autopilot: u.autopilot, onDemand: u.onDemand };
}

/**
 * CR17-I (M2): the company's usage entries since `since`, as the measured forecast and the cost per outcome read them. FX-SERVER (review R3
 * L6): past the limit the NEWEST are kept (the 30-day forecast and the cost per outcome read those), newest first; no consumer reads order.
 */
export async function usageEntries(q: Q, orgId: string, since: Date): Promise<UsageEntry[]> {
  const rows = await execRows<{ id: string; created_at: string; credits: number; origin: string; mode: string; domain: string; run_id: string | null; engine_run_id: string | null; trial: boolean }>(q, sql`
    select id, created_at, credits, ${ORIGIN} as origin, coalesce(ref->>'mode', '') as mode, coalesce(ref->>'domain', '') as domain,
      nullif(ref->>'runId', '') as run_id, nullif(ref->>'engineRunId', '') as engine_run_id, ${KI_TRIAL_RUN} as trial
    from ${schema.creditLedger}
    where org_id = ${orgId}::uuid and kind = 'usage' and credits <> 0 and created_at >= ${tsv(since)}
    order by created_at desc limit 20000`);
  return rows.map((r) => ({
    id: r.id,
    at: new Date(r.created_at).toISOString(),
    credits: Number(r.credits),
    origin: r.origin === 'on_demand' ? 'on_demand' : 'autopilot',
    mode: r.mode,
    domain: r.domain,
    runId: r.run_id,
    engineRunId: r.engine_run_id,
    ...(r.trial ? { kiTrial: true } : {}),
  }));
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The company's credit state, and the check every on-demand analysis passes
// ---------------------------------------------------------------------------------------------------------------------------------

export interface CreditState {
  enforced: boolean;
  rate: number;
  balance: number;
  held: number;
  available: number;
  /** credits a month the schedules are forecast to use */
  forecastMonthly: number;
  /** what the schedules still need this month (kept from on-demand when the company reserves for them) */
  autopilotNeed: number;
  reserved: number;
  onDemandAvailable: number;
  autopilotUsed: number;
  onDemandUsed: number;
  dailyBurn: number;
  status: CreditStatus;
  limits: CreditLimits;
  sites: SiteForecast[];
  /** CR17-I (M2): the forecast from the ledger (the source of `forecastMonthly`) and the entries it was built from (the last 90 days) */
  forecast: CreditForecast;
  entries: UsageEntry[];
}

export async function creditState(q: Q, org: Pick<OrgRow, 'id' | 'creditsEnforced' | 'creditLimits'>, opts: { sites?: SiteForecast[]; now?: Date } = {}): Promise<CreditState> {
  const now = opts.now ?? new Date();
  const s = await settingsRow(q);
  const rate = creditRate(s);
  const limits = creditLimitsOf(org.creditLimits);
  const sites = opts.sites ?? (await siteForecasts(org.id));
  const balance = await creditBalance(q, org.id);
  const held = await inFlightCredits(q, org.id, s);
  const month = await usageSince(q, org.id, monthStartUtc(now));
  // CR17-I (M2): the schedules' forecast and the on-demand pace from what the ledger really charged (shared/src/credit-forecast.ts); the
  // price-list figure (`x.usd`) is only the fallback of a row with no history
  const entries = await usageEntries(q, org.id, new Date(now.getTime() - 90 * DAY));
  const forecast = measuredForecast({ sites: sites.map(forecastSite), entries, rate, now });
  const forecastMonthly = forecast.autopilotMonthly;
  const start = monthStartUtc(now).getTime();
  const end = nextMonthUtc(now).getTime();
  const left = Math.max(0, (end - now.getTime()) / (end - start));
  let autopilotNeed = forecastMonthly * left;
  if (limits.autopilotMonthly != null) autopilotNeed = Math.min(autopilotNeed, Math.max(0, limits.autopilotMonthly - month.autopilot));
  autopilotNeed = r2(autopilotNeed);
  const available = r2(balance - held);
  const reserved = limits.reserveForAutopilot ? r2(Math.min(autopilotNeed, Math.max(0, available))) : 0;
  let onDemandAvailable = r2(available - reserved);
  if (limits.onDemandMonthly != null) onDemandAvailable = Math.min(onDemandAvailable, r2(limits.onDemandMonthly - month.onDemand - held));
  const dailyBurn = creditRunways(available, forecastMonthly, forecast.onDemandMonthly).dailyWithOwn;
  const pausedForCredits = sites.some((x) => x.pausedForCredits);
  return {
    enforced: org.creditsEnforced,
    rate,
    balance,
    held,
    available,
    forecastMonthly,
    autopilotNeed,
    reserved,
    onDemandAvailable: r2(onDemandAvailable),
    autopilotUsed: month.autopilot,
    onDemandUsed: month.onDemand,
    dailyBurn,
    status: org.creditsEnforced ? creditStatus(available, dailyBurn, pausedForCredits) : pausedForCredits ? 'paused' : 'ok',
    limits,
    sites,
    forecast,
    entries,
  };
}

export interface CreditCheck {
  enforced: boolean;
  /** credits this work is quoted at */
  needed: number;
  /** what an on-demand analysis may use now, every rule applied */
  available: number;
  held: number;
  reserved: number;
  enough: boolean;
  reason: CreditRefusal['reason'] | null;
}

/**
 * Whether the company may start on-demand work estimated at `estimatedUsd`. The company's own on-demand limit applies whether or not
 * its credits are enforced (it is its own spending control); the balance and the credits kept for the schedules only when enforced.
 */
export async function creditCheck(q: Q, org: Pick<OrgRow, 'id' | 'creditsEnforced' | 'creditLimits'>, estimatedUsd: number): Promise<CreditCheck> {
  const s = await settingsRow(q);
  const needed = quoteCredits(estimatedUsd, s);
  const st = await creditState(q, org);
  let reason: CreditCheck['reason'] = null;
  if (needed > 0) {
    if (st.limits.onDemandMonthly != null && needed > r2(st.limits.onDemandMonthly - st.onDemandUsed - st.held)) reason = 'on_demand_limit';
    else if (org.creditsEnforced && needed > st.available) reason = 'balance';
    else if (org.creditsEnforced && needed > r2(st.available - st.reserved)) reason = 'reserve';
  }
  return { enforced: org.creditsEnforced, needed, available: Math.max(0, st.onDemandAvailable), held: st.held, reserved: st.reserved, enough: reason == null, reason };
}

/** The words for a refusal (the 402 an analysis gets), in credits only. */
export function refusalMessage(c: CreditCheck, what: string, limits: CreditLimits, used: number): string {
  const w = what.toLowerCase();
  const need = formatCredits(c.needed);
  if (c.reason === 'on_demand_limit')
    return `${what} (about ${need}) would go over your company's on-demand limit of ${formatCredits(limits.onDemandMonthly ?? 0)} this month (${formatCredits(used)} used${c.held > 0 ? `, ${formatCredits(c.held)} held by analyses still running` : ''}). An owner can raise the limit in Settings > Credits.`;
  if (c.reason === 'reserve')
    return `${what} needs about ${need}, but ${formatCredits(c.reserved)} of your balance is kept for your websites' automatic work for the rest of the month. Buy credits in Settings > Credits, or let on-demand analyses use those credits there.`;
  return c.available > 0 || c.held > 0
    ? `Not enough credits for ${w}: it needs about ${need} and ${formatCredits(c.available)} ${c.available === 1 ? 'is' : 'are'} available${c.held > 0 ? ` (${formatCredits(c.held)} more are held by analyses still running)` : ''}. Buy credits in Settings > Credits.`
    : `Your company has no credits left for ${w} (it needs about ${need}). Buy credits in Settings > Credits.`;
}

/** The check inside the transaction that holds the company's lock: throws 402 with the credits it needs. */
export async function assertCredits(tx: Tx, org: OrgRow, estimatedUsd: number, what: string): Promise<number> {
  const c = await creditCheck(tx, org, estimatedUsd);
  if (!c.enough) {
    const st = await usageSince(tx, org.id, monthStartUtc());
    const extra: CreditRefusal = { creditsNeeded: c.needed, creditsAvailable: c.available, reason: c.reason! };
    throw new HttpError(402, refusalMessage(c, what, creditLimitsOf(org.creditLimits), st.onDemand), 'credits', undefined, extra as unknown as Record<string, unknown>);
  }
  return c.needed;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The Credits page
// ---------------------------------------------------------------------------------------------------------------------------------

export const lotView = (l: typeof schema.creditLots.$inferSelect): CreditLot => ({
  id: l.id,
  source: l.source as CreditSource,
  credits: l.credits,
  remaining: l.remaining,
  expiresAt: l.expiresAt?.toISOString() ?? null,
  createdAt: l.createdAt.toISOString(),
  note: l.note,
});

export const requestView = (r: CreditPurchaseRequestRow, granted: CreditPurchaseRequest['granted'] = null): CreditPurchaseRequest => ({
  id: r.id,
  packId: r.packId,
  credits: r.credits,
  priceUsd: r.priceUsd,
  status: r.status as CreditPurchaseRequest['status'],
  note: r.note,
  requestedBy: r.requestedByEmail ?? null,
  createdAt: r.createdAt.toISOString(),
  resolvedAt: r.resolvedAt?.toISOString() ?? null,
  auto: !!r.auto,
  granted,
});

/**
 * CR17-I: what each confirming grant really added and recorded as paid, by its ledger id. A request asked for the 2,000-credit pack was
 * confirmed with 1,000 credits four times on production (the admin changed the pre-filled amount); the Credits page said "2,000" for each.
 */
export async function grantsOf(ledgerIds: string[]): Promise<Map<string, { credits: number; paidUsd: number }>> {
  if (!ledgerIds.length) return new Map();
  const rows = await db.select({ id: schema.creditLedger.id, credits: schema.creditLedger.credits, paidUsd: schema.creditLedger.paidUsd }).from(schema.creditLedger).where(inArray(schema.creditLedger.id, ledgerIds));
  return new Map(rows.map((r) => [r.id, { credits: r.credits, paidUsd: r.paidUsd }]));
}

export async function billingOverview(org: OrgRow, now = new Date()): Promise<BillingOverview> {
  const s = await settingsRow();
  const st = await creditState(db, org, { now });
  const since = monthStartUtc(now);
  const rate = st.rate;

  // CR17-I (F7): this month's use, the one computation (creditUsage) the Pipeline tile and the admin read too
  const usage = await creditUsage(db, org.id, { from: since, to: new Date(now.getTime() + 60_000) });
  const usedOn = new Map(usage.bySite.map((r) => [r.domain, Math.max(0, r.autopilot)]));

  const days = await execRows<{ d: string; origin: string; used: number }>(db, sql`
    select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD') as d, ${ORIGIN} as origin, (-sum(credits))::float as used
    from ${schema.creditLedger} where org_id = ${org.id}::uuid and kind = 'usage' and created_at >= ${tsv(since)} group by 1, 2`);
  const daily = new Map<string, { date: string; autopilot: number; onDemand: number }>();
  for (let t = since.getTime(); t <= now.getTime(); t += DAY) {
    const d = new Date(t).toISOString().slice(0, 10);
    daily.set(d, { date: d, autopilot: 0, onDemand: 0 });
  }
  for (const r of days) {
    const row = daily.get(r.d) ?? { date: r.d, autopilot: 0, onDemand: 0 };
    if (r.origin === 'on_demand') row.onDemand = Math.max(0, r2(row.onDemand + Number(r.used)));
    else row.autopilot = Math.max(0, r2(row.autopilot + Number(r.used)));
    daily.set(r.d, row);
  }

  const lots = await db.query.creditLots.findMany({
    where: and(eq(schema.creditLots.orgId, org.id), sql`(${schema.creditLots.remaining} > 0 or ${schema.creditLots.createdAt} > ${tsv(new Date(now.getTime() - 90 * DAY))})`),
    orderBy: [sql`${schema.creditLots.expiresAt} asc nulls last`, desc(schema.creditLots.createdAt)],
    limit: 50,
  });
  const soon = lots.filter((l) => l.remaining > 0 && l.expiresAt && l.expiresAt.getTime() > now.getTime() && l.expiresAt.getTime() - now.getTime() <= 30 * DAY);
  const expiringSoon = soon.length
    ? { credits: r2(soon.reduce((t, l) => t + l.remaining, 0)), on: new Date(Math.min(...soon.map((l) => l.expiresAt!.getTime()))).toISOString() }
    : null;

  const requests = await db.query.creditPurchaseRequests.findMany({ where: eq(schema.creditPurchaseRequests.orgId, org.id), orderBy: desc(schema.creditPurchaseRequests.createdAt), limit: 10 });
  const granted = await grantsOf(requests.map((r) => r.ledgerId).filter((x): x is string => !!x));
  const invoices = await listInvoices(org.id);
  // CR17-I (M2): two runways, the schedules alone and with the company's own analyses at last month's pace; the status keeps the second
  const runways = creditRunways(st.available, st.forecastMonthly, st.forecast.onDemandMonthly);
  const runway = org.creditsEnforced ? runwayDays(st.available, st.dailyBurn) : null;
  const packs = packsOf(s).map((p) => pricePack(p, s.creditValueUsd));
  return {
    enforced: org.creditsEnforced,
    usage,
    forecast: st.forecast,
    runways,
    costPerOutcome: costPerOutcome(st.entries, now),
    autoTopUp: autoTopUpView(org, packs),
    balance: st.balance,
    held: st.held,
    reservedForAutopilot: st.reserved,
    available: st.available,
    onDemandAvailable: Math.max(0, st.onDemandAvailable),
    status: st.status,
    dailyBurn: st.dailyBurn,
    runwayDays: runway,
    runsOutOn: runway != null ? new Date(now.getTime() + runway * DAY).toISOString().slice(0, 10) : null,
    month: {
      month: monthKey(now),
      autopilotUsed: usage.autopilot,
      onDemandUsed: usage.onDemand,
      autopilotForecast: st.forecastMonthly,
      planMonthly: org.planMonthlyCredits > 0 ? org.planMonthlyCredits : null,
      planRenewsOn: org.planMonthlyCredits > 0 ? nextMonthUtc(now).toISOString().slice(0, 10) : null,
    },
    limits: st.limits,
    sites: st.sites.map((x) => ({
      siteId: x.siteId,
      domain: x.domain,
      forecastMonthly: st.forecast.sites.find((f) => f.domain === x.domain)?.monthly ?? r2(x.usd * rate),
      usedThisMonth: usedOn.get(x.domain.toLowerCase().replace(/^www\./, '')) ?? 0,
      paused: x.paused,
      pausedForCredits: x.pausedForCredits,
    })),
    byFeature: usage.byFeature,
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
    lots: lots.map(lotView),
    expiringSoon,
    packs,
    requests: requests.map((r) => requestView(r, r.ledgerId ? (granted.get(r.ledgerId) ?? null) : null)),
    invoices,
    creditValueUsd: s.creditValueUsd,
    packExpiryMonths: s.packExpiryMonths,
    planRolloverMonths: s.planRollover ? 1 : 0,
    checkout: 'request',
  };
}

/**
 * The cursor of the activity list: the row's time (milliseconds) and its seq, `<ms>_<seq>`. A bare seq (an older client's cursor) is read
 * as "below this seq" as before.
 */
export function activityCursor(c: string | undefined): { ms: number; seq: string } | { seq: string } | null {
  if (!c) return null;
  const m = /^(\d+)_(\d+)$/.exec(c);
  return m ? { ms: Number(m[1]), seq: m[2] } : /^\d+$/.test(c) ? { seq: c } : null;
}

/**
 * The company's movements, newest first (`cursor` from the previous page), as the customer reads them.
 *
 * B12 (pre-launch run 2026-10-21): the list said "newest first" and was sorted by the order the rows were booked, while each row shows when
 * its work happened: a schedule's charge is booked when its cost settles, minutes after a later on-demand run, so 14:54 sat above 15:01.
 * It is now sorted by the time it shows (then by booking order), and "balance after" runs in the same order.
 */
export async function creditActivity(orgId: string, o: { origin: 'all' | 'autopilot' | 'on_demand' | 'account'; cursor?: string; limit: number }): Promise<{ rows: CreditActivityRow[]; nextCursor: string | null }> {
  const filter =
    o.origin === 'account' ? sql`and kind <> 'usage'` : o.origin === 'all' ? sql`` : sql`and kind = 'usage' and ${ORIGIN} = ${o.origin}`;
  const cur = activityCursor(o.cursor);
  const after = !cur
    ? sql``
    : 'ms' in cur
      ? sql`and (at_ms < ${cur.ms} or (at_ms = ${cur.ms} and seq::bigint < ${cur.seq}::bigint))`
      : sql`and seq::bigint < ${cur.seq}::bigint`;
  const rows = await execRows<{ id: string; seq: string; at_ms: string; created_at: string; kind: string; credits: number; note: string; ref: Record<string, unknown> | null; origin: string; balance_after: number }>(db, sql`
    select * from (
      select id, seq::text as seq, floor(extract(epoch from created_at) * 1000)::bigint as at_ms, created_at, kind, credits, note, ref, ${ORIGIN} as origin,
        sum(credits) over (order by floor(extract(epoch from created_at) * 1000), seq rows between unbounded preceding and current row)::float as balance_after
      from ${schema.creditLedger} where org_id = ${orgId}::uuid
    ) x where credits <> 0 ${filter} ${after}
    order by at_ms desc, seq::bigint desc limit ${o.limit + 1}`);
  const page = rows.slice(0, o.limit).map((r): CreditActivityRow => {
    const ref = r.ref ?? {};
    const domain = typeof ref.domain === 'string' && ref.domain ? ref.domain : null;
    const source = typeof ref.source === 'string' ? ref.source : '';
    const kind: CreditActivityRow['kind'] =
      r.kind === 'usage' ? (r.credits < 0 ? 'usage' : 'refund') : r.kind === 'grant' ? (source === 'pack' ? 'pack' : 'grant') : (r.kind as CreditActivityRow['kind']);
    const title =
      kind === 'usage' ? `${featureLabel(typeof ref.mode === 'string' ? ref.mode : '')}${domain ? ` · ${domain}` : ''}` : r.note || (kind === 'expire' ? 'Credits expired' : 'Credits');
    return {
      id: r.id,
      at: new Date(r.created_at).toISOString(),
      kind,
      credits: r2(Number(r.credits)),
      origin: r.kind === 'usage' ? (r.origin === 'on_demand' ? 'on_demand' : 'autopilot') : null,
      title,
      domain,
      runId: typeof ref.runId === 'string' ? ref.runId : null,
      balanceAfter: r2(Number(r.balance_after)),
    };
  });
  const last = rows[o.limit - 1];
  return { rows: page, nextCursor: rows.length > o.limit && last ? `${last.at_ms}_${last.seq}` : null };
}

export function activityCsv(rows: CreditActivityRow[]): string {
  const esc = (v: unknown) => {
    const t = String(v ?? '');
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const head = ['date', 'type', 'what', 'website', 'source', 'credits', 'balance_after'];
  return [head.join(','), ...rows.map((r) => [r.at, r.kind, r.title, r.domain ?? '', r.origin ?? 'account', r.credits, r.balanceAfter].map(esc).join(','))].join('\n') + '\n';
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Purchase requests ("Buy credits" until card payments exist): the customer asks for a pack, the Alaventra team invoices it and
// fulfils it in the admin panel with a grant that records the payment
// ---------------------------------------------------------------------------------------------------------------------------------

export async function requestPack(org: OrgRow, user: { id: string; email: string }, packId: string, note: string, log: Log): Promise<CreditPurchaseRequest> {
  const s = await settingsRow();
  const pack = packsOf(s).find((p) => p.id === packId);
  if (!pack) throw new HttpError(400, 'Choose one of the credit packs.', 'bad_request');
  const pending = await db.query.creditPurchaseRequests.findMany({ where: and(eq(schema.creditPurchaseRequests.orgId, org.id), eq(schema.creditPurchaseRequests.status, 'pending')) });
  if (pending.length >= 3) throw new HttpError(409, 'Your company already has 3 credit requests waiting. Cancel one, or wait for them to be confirmed.', 'too_many_requests');
  return requestView(await fileRequest(org, { id: user.id, email: user.email }, pack, s.creditValueUsd, note, false, log));
}

/** One "Buy credits" request written and the platform admins told: a person's, or the automatic top-up's (CR17-I). */
async function fileRequest(org: OrgRow, by: { id: string | null; email: string | null }, pack: CreditPack, creditValueUsd: number, note: string, auto: boolean, log: Log): Promise<CreditPurchaseRequestRow> {
  const row = await insertRequest(db, org, by, pack, creditValueUsd, note, auto);
  tellAdmins(org, row, pack, creditValueUsd, note, auto, log);
  return row;
}

async function insertRequest(q: Q, org: OrgRow, by: { id: string | null; email: string | null }, pack: CreditPack, creditValueUsd: number, note: string, auto: boolean): Promise<CreditPurchaseRequestRow> {
  const priced = pricePack(pack, creditValueUsd);
  const [row] = await q
    .insert(schema.creditPurchaseRequests)
    .values({ orgId: org.id, orgName: org.name, packId: pack.id, credits: pack.credits, priceUsd: priced.priceUsd, note, requestedBy: by.id, requestedByEmail: by.email, auto })
    .returning();
  return row;
}

/** the platform admins' mail of a request just filed (never awaited: a mail never fails the request) */
function tellAdmins(org: OrgRow, row: CreditPurchaseRequestRow, pack: CreditPack, creditValueUsd: number, note: string, auto: boolean, log: Log): void {
  const priced = pricePack(pack, creditValueUsd);
  const who = auto ? `${org.name}'s automatic top-up (credits are running low)` : (row.requestedByEmail ?? 'The customer');
  for (const to of config.platformAdmins)
    void sendMail(
      {
        to,
        subject: `Credit request${auto ? ' (automatic)' : ''}: ${org.name} asks for ${formatCredits(pack.credits)} ($${priced.priceUsd.toFixed(2)})`,
        lines: [`${who} asked for the ${formatCredits(pack.credits)} pack for ${org.name} ($${priced.priceUsd.toFixed(2)}).`, ...(note ? [`Note: ${note}`] : []), 'Invoice it, then confirm it in the admin panel: the credits are added when you confirm.'],
        action: { label: 'Open the admin panel', url: `${config.appUrl}/admin/companies/${org.id}` },
      },
      log,
    ).catch(() => undefined);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// CR17-I (client report 2026-11-17, M2): the automatic top-up request. No card payment exists (app/docs/CREDITS.md section 5), so it does
// what a person would: when the balance is running low (the guard's low / critical / empty, or schedules paused for an empty balance) and
// nothing is already waiting, it files ONE ordinary "Buy credits" request for the company's chosen pack, tells the platform admins and the
// company's owners and admins, and waits for an admin's confirmation (the existing grant + invoice). Once per low episode: it is armed again
// only after the balance is back to ok. Never an overdraft (owner decision 2026-11-17).
// ---------------------------------------------------------------------------------------------------------------------------------

export function autoTopUpView(org: Pick<OrgRow, 'autoTopUpPackId' | 'autoTopUpArmed'>, packs: ReturnType<typeof pricePack>[]): AutoTopUpView | null {
  const p = org.autoTopUpPackId ? packs.find((x) => x.id === org.autoTopUpPackId) : null;
  return p ? { packId: p.id, credits: p.credits, priceUsd: p.priceUsd, armed: org.autoTopUpArmed } : null;
}

/** The company's setting (owner / admin): the pack to ask for, or null to switch it off. Returns the view. */
export async function setAutoTopUp(org: OrgRow, user: { id: string }, packId: string | null): Promise<AutoTopUpView | null> {
  const s = await settingsRow();
  const packs = packsOf(s).map((p) => pricePack(p, s.creditValueUsd));
  if (packId && !packs.some((p) => p.id === packId)) throw new HttpError(400, 'Choose one of the credit packs.', 'bad_request');
  const [row] = await db
    .update(schema.organizations)
    .set({ autoTopUpPackId: packId, autoTopUpBy: packId ? user.id : null, ...(packId && !org.autoTopUpPackId ? { autoTopUpArmed: true } : {}) })
    .where(eq(schema.organizations.id, org.id))
    .returning();
  return autoTopUpView(row, packs);
}

const AUTO_TOP_UP_LEVELS: ReadonlySet<CreditStatus> = new Set(['low', 'critical', 'empty']);

/**
 * The guard's step for one company (after its level is known): files the automatic request when due, re-arms it when the balance is back
 * to ok. Returns the request filed, if any.
 */
export async function autoTopUpStep(org: OrgRow, level: CreditStatus, balance: number, log: Log): Promise<CreditPurchaseRequestRow | null> {
  if (!org.autoTopUpPackId || !org.creditsEnforced) return null;
  if (level === 'ok') {
    if (!org.autoTopUpArmed) await db.update(schema.organizations).set({ autoTopUpArmed: true }).where(eq(schema.organizations.id, org.id));
    return null;
  }
  const short = AUTO_TOP_UP_LEVELS.has(level) || (level === 'paused' && balance <= 0);
  if (!short || !org.autoTopUpArmed) return null;
  // a request already waiting (a person's or an earlier automatic one) covers this episode: nothing more is filed
  const waiting = await db.query.creditPurchaseRequests.findFirst({ where: and(eq(schema.creditPurchaseRequests.orgId, org.id), eq(schema.creditPurchaseRequests.status, 'pending')) });
  if (waiting) return null;
  const s = await settingsRow();
  const pack = packsOf(s).find((p) => p.id === org.autoTopUpPackId);
  if (!pack) {
    log.warn({ org: org.id, pack: org.autoTopUpPackId }, 'automatic top-up: the chosen pack no longer exists');
    return null;
  }
  // disarm and file in ONE transaction (FX-SERVER, review R3 L4): a second guard pass, or a second server, never files twice for one
  // episode (the conditional disarm), and a failed insert leaves the company armed, so the next pass asks again
  const NOTE = 'Asked automatically: credits are running low.';
  const row = await db.transaction(async (tx) => {
    const [armed] = await tx
      .update(schema.organizations)
      .set({ autoTopUpArmed: false })
      .where(and(eq(schema.organizations.id, org.id), eq(schema.organizations.autoTopUpArmed, true)))
      .returning({ id: schema.organizations.id });
    if (!armed) return null;
    const by = org.autoTopUpBy ? await tx.query.users.findFirst({ where: eq(schema.users.id, org.autoTopUpBy) }) : null;
    return insertRequest(tx, org, { id: by?.id ?? null, email: by?.email ?? null }, pack, s.creditValueUsd, NOTE, true);
  });
  if (!row) return null;
  tellAdmins(org, row, pack, s.creditValueUsd, NOTE, true, log);
  const priced = pricePack(pack, s.creditValueUsd);
  for (const to of await billingContacts(org.id))
    await sendMail(
      {
        to,
        subject: `We asked for ${formatCredits(pack.credits)} for you · ${org.name}`,
        lines: [
          `Your credits are running low, so we asked for the ${formatCredits(pack.credits)} pack ($${priced.priceUsd.toFixed(2)}), as your company's setting says.`,
          'The Alaventra team sends you the payment details; the credits are added as soon as it is paid. You can cancel the request on the Credits page.',
        ],
        action: { label: 'Open Credits', url: `${config.appUrl}/o/${org.id}/settings/credits` },
      },
      log,
    ).catch(() => false);
  return row;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The guard (every 10 minutes): plan credits, expiry, pausing / resuming schedules, low-balance notices
// ---------------------------------------------------------------------------------------------------------------------------------

const endOfMonth = (d: Date, plus = 0) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1 + plus, 1) - 1);

/** Grants the plan's monthly credits once per calendar month (they last to the end of the next month with rollover, else this one). */
export async function grantPlanCredits(now = new Date()): Promise<number> {
  const s = await settingsRow();
  const key = monthKey(now);
  const due = await db.query.organizations.findMany({
    where: sql`${schema.organizations.planMonthlyCredits} > 0 and ${schema.organizations.disabled} = false and coalesce(${schema.organizations.planGrantedMonth}, '') <> ${key}`,
  });
  let n = 0;
  for (const org of due) {
    await db.transaction(async (tx) => {
      const row = await addCreditEntry(tx, {
        orgId: org.id,
        kind: 'plan',
        credits: org.planMonthlyCredits,
        note: `Plan credits for ${new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`,
        ref: { source: 'plan', month: key },
        refKey: `plan:${org.id}:${key}`,
        lot: { source: 'plan', expiresAt: endOfMonth(now, s.planRollover ? 1 : 0) },
      });
      await tx.update(schema.organizations).set({ planGrantedMonth: key }).where(eq(schema.organizations.id, org.id));
      if (row) n++;
    });
  }
  return n;
}

/** Empties every lot past its expiry into an `expire` entry (once per lot). */
export async function expireLots(now = new Date()): Promise<number> {
  const due = await db.query.creditLots.findMany({ where: sql`${schema.creditLots.remaining} > 0 and ${schema.creditLots.expiresAt} <= ${tsv(now)}` });
  let n = 0;
  for (const lot of due) {
    const row = await addCreditEntry(db, {
      orgId: lot.orgId,
      kind: 'expire',
      credits: -lot.remaining,
      note: `${formatCredits(lot.remaining)} expired (${lot.note || lot.source})`,
      ref: { source: lot.source, lotId: lot.id },
      refKey: `expire:${lot.id}`,
      lotId: lot.id,
      at: lot.expiresAt ?? now,
    });
    if (row) n++;
  }
  return n;
}

const SEVERITY: Record<CreditStatus, number> = { ok: 0, low: 1, critical: 2, empty: 3, paused: 4 };

async function setPaused(site: SiteRow, reason: 'balance' | 'autopilot_limit' | null, log: Log): Promise<boolean> {
  const action = reason ? 'pause' : 'resume';
  const r = await siteAdmin({ action, domain: site.domain, site_id: n8nSiteId(site.domain), request_id: `app-credits-${action}-${Date.now().toString(36)}` }).catch((e) => ({ ok: false, error: String(e), affected: 0 }));
  if (!r.ok) {
    log.warn({ site: site.domain, action, error: (r as { error?: string }).error }, 'credit guard could not change the schedules');
    return false;
  }
  await db
    .update(schema.sites)
    .set(reason ? { trackingStatus: 'paused', creditsPausedAt: new Date(), creditsPausedReason: reason, updatedAt: new Date() } : { trackingStatus: 'active', creditsPausedAt: null, creditsPausedReason: null, updatedAt: new Date() })
    .where(eq(schema.sites.id, site.id));
  return true;
}


const NOTICE: Record<Exclude<CreditStatus, 'ok'>, { subject: string; line: (st: CreditState) => string }> = {
  low: { subject: 'Your credits will run out within two weeks', line: (st) => `You have ${formatCredits(st.available)} available and use about ${formatCredits(st.dailyBurn)} a day, so they last about ${Math.floor(st.available / st.dailyBurn)} more days.` },
  critical: { subject: 'Your credits run out in the next few days', line: (st) => `You have ${formatCredits(st.available)} available and use about ${formatCredits(st.dailyBurn)} a day. When they run out, your websites' automatic work pauses until credits are added.` },
  empty: { subject: 'You are out of credits', line: () => 'Your company has no credits left. New analyses are refused and your websites\' automatic work pauses until credits are added.' },
  paused: { subject: 'Automatic work is paused: out of credits', line: (st) => `The automatic work of ${st.sites.filter((x) => x.pausedForCredits).map((x) => x.domain).join(', ')} is paused. It resumes by itself as soon as credits are added; nothing is lost but the weeks it misses.` },
};

export interface AlignResult {
  /** false when it had already run (the automatic pass runs once) */
  ran: boolean;
  granted: { id: string; name: string; credits: number }[];
  enforced: { id: string; name: string; balance: number }[];
  /** left counted only, with why: an admin decides */
  leftCountedOnly: { id: string; name: string; balance: number; reason: string }[];
}

/**
 * Brings the companies that existed before credits onto them, exactly as a company signing up today is (app/docs/CREDITS.md §1): the
 * welcome credits (never twice, the same `signup:<company>` key a new company's grant uses; never to an agency's client workspace or a
 * disabled company, as for new ones) and credits enforced. Careful by design:
 *   - it follows the platform settings as they are: no welcome credits when they are 0, no enforcement when new companies are not
 *     enforced;
 *   - a company is enforced only when it starts with credits (balance > 0 after its welcome credits): one that would start at or below
 *     zero is left counted only and named in the admin log, because enforcing it would pause its websites' schedules at once;
 *   - every step is idempotent, so it can run again (POST /api/admin/credits/align) without granting or changing anything twice.
 * `auto` = the pass at server start: it runs once (`platform_settings.credits_aligned_at`) and is written to the admin log as "system".
 */
export async function alignExistingCompanies(log: Log, opts: { auto?: boolean; actor?: { userId: string | null; email: string }; now?: Date } = {}): Promise<AlignResult> {
  const now = opts.now ?? new Date();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('alaventra.credits_align'))`);
    const s = await settingsRow(tx);
    const out: AlignResult = { ran: false, granted: [], enforced: [], leftCountedOnly: [] };
    if (opts.auto && s.creditsAlignedAt) return out;
    out.ran = true;
    const orgs = await tx.query.organizations.findMany({ where: sql`${schema.organizations.createdAt} <= ${tsv(now)}` });
    for (const org of orgs) {
      if (s.signupCredits > 0 && org.kind !== 'client' && !org.disabled) {
        const row = await addCreditEntry(tx, {
          orgId: org.id,
          kind: 'grant',
          credits: s.signupCredits,
          paidUsd: 0,
          note: 'Welcome credits',
          ref: { source: 'signup' },
          refKey: `signup:${org.id}`,
          lot: { source: 'signup', expiresAt: s.signupExpiryDays > 0 ? new Date(now.getTime() + s.signupExpiryDays * DAY) : null },
        });
        if (row) out.granted.push({ id: org.id, name: org.name, credits: row.credits });
      }
      if (s.enforceForNewCompanies && !org.creditsEnforced) {
        const balance = await creditBalance(tx, org.id);
        if (balance > 0) {
          await tx.update(schema.organizations).set({ creditsEnforced: true }).where(eq(schema.organizations.id, org.id));
          out.enforced.push({ id: org.id, name: org.name, balance });
        } else
          out.leftCountedOnly.push({
            id: org.id,
            name: org.name,
            balance,
            reason: org.kind === 'client' ? 'an agency client workspace with no credits of its own' : 'no credits to start with: enforcing would pause its schedules at once',
          });
      }
    }
    if (opts.auto) await tx.update(schema.platformSettings).set({ creditsAlignedAt: now }).where(eq(schema.platformSettings.id, 1));
    await tx.insert(schema.adminAudit).values({
      actorUserId: opts.actor?.userId ?? null,
      actorEmail: opts.actor?.email ?? 'system',
      action: 'credits.aligned',
      targetType: 'platform',
      targetId: null,
      targetLabel: 'existing companies brought onto credits',
      details: { granted: out.granted, enforced: out.enforced, leftCountedOnly: out.leftCountedOnly, signupCredits: s.signupCredits, enforceForNewCompanies: s.enforceForNewCompanies },
    });
    if (out.granted.length || out.enforced.length || out.leftCountedOnly.length)
      log.info({ granted: out.granted.length, enforced: out.enforced.length, leftCountedOnly: out.leftCountedOnly.length }, 'existing companies brought onto credits');
    return out;
  });
}

type GuardResult = { granted: number; expired: number; paused: number; resumed: number; notices: number; requested: number };
let guardInFlight: Promise<GuardResult> | null = null;

/** One pass over every company that has credits to watch. Never throws; returns what it did. Single-flight: a pass asked for while
 *  another runs (the timer, an admin's "run now", a grant) waits for that one and then runs its own, so two never act at once. */
export async function creditGuardTick(log: Log, now?: Date): Promise<GuardResult> {
  while (guardInFlight) await guardInFlight.catch(() => undefined);
  const p = guardPass(log, now ?? new Date());
  guardInFlight = p;
  try {
    return await p;
  } finally {
    if (guardInFlight === p) guardInFlight = null;
  }
}

async function guardPass(log: Log, now: Date): Promise<GuardResult> {
  const out = { granted: 0, expired: 0, paused: 0, resumed: 0, notices: 0, requested: 0 };
  out.granted = await grantPlanCredits(now).catch((e) => (log.warn({ err: String(e) }, 'plan credits failed'), 0));
  out.expired = await expireLots(now).catch((e) => (log.warn({ err: String(e) }, 'credit expiry failed'), 0));
  const orgs = await db.query.organizations.findMany({
    where: sql`${schema.organizations.disabled} = false and (${schema.organizations.creditsEnforced} = true or ${schema.organizations.creditLimits} ? 'autopilotMonthly'
      or exists (select 1 from ${schema.sites} s where s.org_id = ${schema.organizations.id} and s.credits_paused_at is not null))`,
  });
  for (const org of orgs) {
    try {
      const st = await creditState(db, org, { now, sites: await siteForecasts(org.id, { fresh: true }) });
      const limitHit = st.limits.autopilotMonthly != null && st.autopilotUsed >= st.limits.autopilotMonthly;
      const outOf = org.creditsEnforced && st.balance <= 0; // holds of on-demand analyses never pause the schedules
      const reason: 'balance' | 'autopilot_limit' | null = outOf ? 'balance' : limitHit ? 'autopilot_limit' : null;
      const sites = await db.query.sites.findMany({ where: and(eq(schema.sites.orgId, org.id), isNotNull(schema.sites.verifiedAt)) });
      let changed = false;
      for (const site of sites) {
        if (reason && site.trackingStatus === 'active') {
          if (await setPaused(site, reason, log)) (out.paused++, (changed = true));
        } else if (!reason && site.creditsPausedAt && site.trackingStatus === 'paused') {
          if (await setPaused(site, null, log)) (out.resumed++, (changed = true));
        } else if (reason && site.creditsPausedAt && site.creditsPausedReason !== reason) {
          await db.update(schema.sites).set({ creditsPausedReason: reason }).where(eq(schema.sites.id, site.id));
        }
      }
      if (changed) invalidateForecast(org.id);
      const level: CreditStatus = changed ? (await creditState(db, org, { now, sites: await siteForecasts(org.id, { fresh: true }) })).status : st.status;
      // CR17-I: the automatic top-up request, once per low episode (re-armed when the balance is back to ok)
      if (await autoTopUpStep(org, level, st.balance, log).catch((e) => (log.warn({ org: org.id, err: String(e) }, 'automatic top-up failed'), null))) out.requested++;
      const before = (org.creditAlertLevel as CreditStatus) in SEVERITY ? (org.creditAlertLevel as CreditStatus) : 'ok';
      if (level !== before) {
        await db.update(schema.organizations).set({ creditAlertLevel: level, creditAlertAt: now }).where(eq(schema.organizations.id, org.id));
        const worse = SEVERITY[level] > SEVERITY[before];
        const resumed = before === 'paused' && level !== 'paused';
        if ((worse && level !== 'ok') || resumed) {
          const n = level !== 'ok' && worse ? NOTICE[level as Exclude<CreditStatus, 'ok'>] : null;
          const subject = n ? n.subject : 'Automatic work has resumed';
          const line = n ? n.line(st) : 'Credits were added, so your websites\' automatic work runs again from its next scheduled time.';
          for (const to of await billingContacts(org.id)) {
            await sendMail({ to, subject: `${subject} · ${org.name}`, lines: [line], action: { label: 'Open Credits', url: `${config.appUrl}/o/${org.id}/settings/credits` } }, log).catch(() => false);
            out.notices++;
          }
        }
      }
    } catch (err) {
      log.warn({ org: org.id, err: String(err) }, 'credit guard failed for a company');
    }
  }
  return out;
}

/** The guard's timer (every 10 minutes, first two minutes after start, after the cost sync). CREDIT_GUARD=false stops it. */
export function startCreditGuard(log: Log): () => void {
  let running = false;
  const tick = () => {
    if (running) return;
    running = true;
    void creditGuardTick(log)
      .then((r) => (r.granted || r.expired || r.paused || r.resumed || r.notices || r.requested) && log.info(r, 'credit guard'))
      .catch((err) => log.warn({ err: String(err) }, 'credit guard failed'))
      .finally(() => (running = false));
  };
  const first = setTimeout(tick, 120_000);
  const every = setInterval(tick, 10 * 60_000);
  first.unref?.();
  every.unref?.();
  return () => {
    clearTimeout(first);
    clearInterval(every);
  };
}
