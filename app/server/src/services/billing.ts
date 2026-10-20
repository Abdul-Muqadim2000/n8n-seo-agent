import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import {
  autopilotMonthlyUsd,
  creditLimitsOf,
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
import { addCreditEntry, creditBalance, inFlightCredits } from './admin/credits';
import { settingsRow } from './admin/settings';
import { billingContacts, listInvoices } from './invoices';
import { execRows, tsv } from './admin/sqlRows';
import { monitorsFromRow } from './data';
import { chosenLadderWriting } from './cadence';

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
  /** provider cost a month of the website's schedules, USD (0 while a person has paused them) */
  usd: number;
  paused: boolean;
  pausedForCredits: boolean;
  pausedReason: string | null;
}

const forecastCache = new Map<string, { at: number; sites: SiteForecast[] }>();
const FORECAST_TTL = 10 * 60_000;
export const invalidateForecast = (orgId: string) => void forecastCache.delete(orgId);

const completeMonitors = (m: Partial<MonitorSettings> | null | undefined): MonitorSettings => monitorSettingsSchema.parse({ ...(m ?? {}), brandNames: [], aiPersonas: [], aiMarkets: [] });

/** The tracked, verified websites of a company and what their schedules use a month. */
export async function siteForecasts(orgId: string, opts: { fresh?: boolean } = {}): Promise<SiteForecast[]> {
  const hit = forecastCache.get(orgId);
  if (hit && !opts.fresh && Date.now() - hit.at < FORECAST_TTL) return hit.sites;
  const sites = await db.query.sites.findMany({ where: and(eq(schema.sites.orgId, orgId), inArray(schema.sites.trackingStatus, ['active', 'paused']), isNotNull(schema.sites.verifiedAt)) });
  const out = await Promise.all(
    sites.map(async (s): Promise<SiteForecast> => {
      const pausedByPerson = s.trackingStatus === 'paused' && !s.creditsPausedAt;
      let usd = 0;
      if (!pausedByPerson) {
        // keyword-first (plan §5.4): pages are forecast only while a keyword the client chose has pages to write (level 3: always)
        const level = (s.autopilotLevel === 1 || s.autopilotLevel === 3 ? s.autopilotLevel : 2) as AutopilotLevel;
        const [mon, ladders, settings] = await Promise.all([
          siteRows<MonitorsRow>('monitors', s.domain, { max: 5 }).catch(() => [] as MonitorsRow[]),
          siteRows<LadderRow>('ladders', s.domain, { max: 2000 }).catch(() => [] as LadderRow[]),
          siteRows<LadderSettingsRow>('ladderSettings', s.domain, { max: 500 }).catch(() => [] as LadderSettingsRow[]),
        ]);
        usd = autopilotMonthlyUsd(completeMonitors(monitorsFromRow(mon[0])), s.blogsPerWeek, { level, writing: chosenLadderWriting(ladders, settings, level) });
      }
      return { siteId: s.id, domain: s.domain, usd, paused: s.trackingStatus === 'paused', pausedForCredits: !!s.creditsPausedAt, pausedReason: s.creditsPausedReason ?? null };
    }),
  );
  forecastCache.set(orgId, { at: Date.now(), sites: out });
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// What was used, split autopilot / on-demand (a usage entry's `ref.origin`; older entries: a run behind it = on-demand)
// ---------------------------------------------------------------------------------------------------------------------------------

const ORIGIN = sql.raw(`coalesce(ref->>'origin', case when ref->>'runId' is not null then 'on_demand' else 'autopilot' end)`);

export async function usageSince(q: Q, orgId: string, since: Date): Promise<{ autopilot: number; onDemand: number }> {
  const rows = await execRows<{ origin: string; used: number }>(q, sql`
    select ${ORIGIN} as origin, (-sum(credits))::float as used from ${schema.creditLedger}
    where org_id = ${orgId}::uuid and kind = 'usage' and created_at >= ${tsv(since)} group by 1`);
  const of = (o: string) => Math.max(0, r2(Number(rows.find((r) => r.origin === o)?.used ?? 0)));
  return { autopilot: of('autopilot'), onDemand: of('on_demand') };
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
  const last30 = await usageSince(q, org.id, new Date(now.getTime() - 30 * DAY));
  const forecastMonthly = r2(sites.reduce((t, x) => t + x.usd, 0) * rate);
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
  const dailyBurn = r2(forecastMonthly / 30 + last30.onDemand / 30);
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

export const requestView = (r: CreditPurchaseRequestRow): CreditPurchaseRequest => ({
  id: r.id,
  packId: r.packId,
  credits: r.credits,
  priceUsd: r.priceUsd,
  status: r.status as CreditPurchaseRequest['status'],
  note: r.note,
  requestedBy: r.requestedByEmail ?? null,
  createdAt: r.createdAt.toISOString(),
  resolvedAt: r.resolvedAt?.toISOString() ?? null,
});

export async function billingOverview(org: OrgRow, now = new Date()): Promise<BillingOverview> {
  const s = await settingsRow();
  const st = await creditState(db, org, { now });
  const since = monthStartUtc(now);
  const rate = st.rate;

  const perSite = await execRows<{ domain: string; used: number }>(db, sql`
    select coalesce(ref->>'domain', '') as domain, (-sum(credits))::float as used from ${schema.creditLedger}
    where org_id = ${org.id}::uuid and kind = 'usage' and created_at >= ${tsv(since)} and ${ORIGIN} = 'autopilot' group by 1`);
  const usedOn = new Map(perSite.map((r) => [r.domain.toLowerCase().replace(/^www\./, ''), Math.max(0, r2(Number(r.used)))]));

  const features = await execRows<{ mode: string; origin: string; used: number; n: number }>(db, sql`
    select coalesce(ref->>'mode', '') as mode, ${ORIGIN} as origin, (-sum(credits))::float as used, count(*) filter (where credits < 0)::int as n
    from ${schema.creditLedger} where org_id = ${org.id}::uuid and kind = 'usage' and created_at >= ${tsv(since)} group by 1, 2`);
  const byFeature = new Map<string, BillingOverview['byFeature'][number]>();
  for (const f of features) {
    const label = featureLabel(f.mode);
    const origin: CreditOrigin = f.origin === 'on_demand' ? 'on_demand' : 'autopilot';
    const k = `${origin}:${label}`;
    const cur = byFeature.get(k) ?? { key: k, label, origin, credits: 0, runs: 0 };
    cur.credits = r2(cur.credits + Number(f.used));
    cur.runs += Number(f.n);
    byFeature.set(k, cur);
  }

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
  const invoices = await listInvoices(org.id);
  const runway = org.creditsEnforced ? runwayDays(st.available, st.dailyBurn) : null;
  return {
    enforced: org.creditsEnforced,
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
      autopilotUsed: st.autopilotUsed,
      onDemandUsed: st.onDemandUsed,
      autopilotForecast: st.forecastMonthly,
      planMonthly: org.planMonthlyCredits > 0 ? org.planMonthlyCredits : null,
      planRenewsOn: org.planMonthlyCredits > 0 ? nextMonthUtc(now).toISOString().slice(0, 10) : null,
    },
    limits: st.limits,
    sites: st.sites.map((x) => ({
      siteId: x.siteId,
      domain: x.domain,
      forecastMonthly: r2(x.usd * rate),
      usedThisMonth: usedOn.get(x.domain.toLowerCase().replace(/^www\./, '')) ?? 0,
      paused: x.paused,
      pausedForCredits: x.pausedForCredits,
    })),
    byFeature: [...byFeature.values()].filter((f) => f.credits !== 0).sort((a, b) => b.credits - a.credits),
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
    lots: lots.map(lotView),
    expiringSoon,
    packs: packsOf(s).map((p) => pricePack(p, s.creditValueUsd)),
    requests: requests.map(requestView),
    invoices,
    creditValueUsd: s.creditValueUsd,
    packExpiryMonths: s.packExpiryMonths,
    planRolloverMonths: s.planRollover ? 1 : 0,
    checkout: 'request',
  };
}

/** The company's movements, newest first (`cursor` = the seq to continue below), as the customer reads them. */
export async function creditActivity(orgId: string, o: { origin: 'all' | 'autopilot' | 'on_demand' | 'account'; cursor?: string; limit: number }): Promise<{ rows: CreditActivityRow[]; nextCursor: string | null }> {
  const filter =
    o.origin === 'account' ? sql`and kind <> 'usage'` : o.origin === 'all' ? sql`` : sql`and kind = 'usage' and ${ORIGIN} = ${o.origin}`;
  const rows = await execRows<{ id: string; seq: string; created_at: string; kind: string; credits: number; note: string; ref: Record<string, unknown> | null; origin: string; balance_after: number }>(db, sql`
    select * from (
      select id, seq::text as seq, created_at, kind, credits, note, ref, ${ORIGIN} as origin,
        sum(credits) over (order by seq rows between unbounded preceding and current row)::float as balance_after
      from ${schema.creditLedger} where org_id = ${orgId}::uuid
    ) x where credits <> 0 ${filter} ${o.cursor ? sql`and seq::bigint < ${o.cursor}::bigint` : sql``}
    order by seq::bigint desc limit ${o.limit + 1}`);
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
  return { rows: page, nextCursor: rows.length > o.limit ? rows[o.limit - 1].seq : null };
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
  const priced = pricePack(pack, s.creditValueUsd);
  const [row] = await db
    .insert(schema.creditPurchaseRequests)
    .values({ orgId: org.id, orgName: org.name, packId: pack.id, credits: pack.credits, priceUsd: priced.priceUsd, note, requestedBy: user.id, requestedByEmail: user.email })
    .returning();
  for (const to of config.platformAdmins)
    void sendMail(
      {
        to,
        subject: `Credit request: ${org.name} asks for ${formatCredits(pack.credits)} ($${priced.priceUsd.toFixed(2)})`,
        lines: [`${user.email} asked for the ${formatCredits(pack.credits)} pack for ${org.name} ($${priced.priceUsd.toFixed(2)}).`, ...(note ? [`Their note: ${note}`] : []), 'Invoice it, then confirm it in the admin panel: the credits are added when you confirm.'],
        action: { label: 'Open the admin panel', url: `${config.appUrl}/admin/companies/${org.id}` },
      },
      log,
    ).catch(() => undefined);
  return requestView(row);
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
  low: { subject: 'Your credits will run out within a week', line: (st) => `You have ${formatCredits(st.available)} available and use about ${formatCredits(st.dailyBurn)} a day, so they last about ${Math.floor(st.available / st.dailyBurn)} more days.` },
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

type GuardResult = { granted: number; expired: number; paused: number; resumed: number; notices: number };
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
  const out = { granted: 0, expired: 0, paused: 0, resumed: 0, notices: 0 };
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
      .then((r) => (r.granted || r.expired || r.paused || r.resumed || r.notices) && log.info(r, 'credit guard'))
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
