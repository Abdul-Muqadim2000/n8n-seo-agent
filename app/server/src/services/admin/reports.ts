import { sql, type SQL } from 'drizzle-orm';
import {
  emptyCostSplit,
  type AdminActivityRow,
  type AdminCompanyDetail,
  type AdminCompanyRow,
  type AdminDailyPoint,
  type AdminMember,
  type AdminModeCost,
  type AdminOverview,
  type AdminRunRow,
  type AdminRunsPage,
  type AdminSiteRow,
  type AdminUserRow,
  type CostCertainty,
  type CostSplit,
  type MoneySummary,
} from '@seo/shared';
import { isPlatformAdmin } from '../../auth/access';
import { db, schema } from '../../db';
import type { UserRow } from '../../db/schema';
import { anthropicBill, dataforseoBill } from './bills';
import { allBalances, creditTotals, listCreditEntries } from './credits';
import { daysOf, type PeriodRange } from './period';
import { settingsRow } from './settings';
import { execRows, tsv } from './sqlRows';

// The panel's read side. Every money figure comes from cost_events (services/admin/costSync.ts) inside the period; credits from
// credit_ledger; revenue = the payments recorded with grants. Nothing here reads n8n.

const r4 = (n: number) => Math.round(n * 10000) / 10000;
const r2 = (n: number) => Math.round(n * 100) / 100;
const iso = (v: unknown): string | null => (v ? new Date(v as string).toISOString() : null);

type CostAgg = { claude: number; claude_est: number; dfs: number };
export const toSplit = (a?: Partial<CostAgg> | null): CostSplit => {
  const claude = r4(Number(a?.claude ?? 0));
  const dfs = r4(Number(a?.dfs ?? 0));
  return { claudeUsd: claude, dataforseoUsd: dfs, totalUsd: r4(claude + dfs), claudeEstimatedUsd: r4(Math.min(claude, Number(a?.claude_est ?? 0))) };
};
export const addSplit = (a: CostSplit, b: CostSplit): CostSplit => ({
  claudeUsd: r4(a.claudeUsd + b.claudeUsd),
  dataforseoUsd: r4(a.dataforseoUsd + b.dataforseoUsd),
  totalUsd: r4(a.totalUsd + b.totalUsd),
  claudeEstimatedUsd: r4(a.claudeEstimatedUsd + b.claudeEstimatedUsd),
});

export function moneyOf(cost: CostSplit, revenueUsd: number, creditsUsed: number, creditValueUsd: number): MoneySummary {
  const revenue = r2(revenueUsd);
  const margin = r4(revenue - cost.totalUsd);
  return { cost, revenueUsd: revenue, marginUsd: margin, marginPct: revenue > 0 ? Math.round((margin / revenue) * 1000) / 10 : null, listValueUsd: r2(creditsUsed * creditValueUsd) };
}

/** the credits really debited for one cost event (its debit, plus any re-pricing of it), from credit_ledger — never recomputed at
 *  today's settings */
const debitedFor = (eventKey: SQL) =>
  sql`(select coalesce(-sum(c.credits), 0) from ${schema.creditLedger} c where c.ref_key = 'cost:' || ${eventKey} or c.ref_key like 'cost:' || ${eventKey} || ':%')`;

/** `occurred_at` (or another column) inside the period */
const within = (col: SQL, r: PeriodRange) => sql`${col} < ${tsv(r.to)} ${r.from ? sql`and ${col} >= ${tsv(r.from)}` : sql``}`;
const COST_COLS = sql`coalesce(sum(claude_usd), 0)::float as claude, coalesce(sum(claude_estimated_usd), 0)::float as claude_est, coalesce(sum(dataforseo_usd), 0)::float as dfs`;

async function costByOrg(r: PeriodRange): Promise<Map<string | null, CostSplit>> {
  const rows = await execRows<CostAgg & { org_id: string | null }>(db, sql`select org_id, ${COST_COLS} from ${schema.costEvents} where ${within(sql`occurred_at`, r)} group by org_id`);
  return new Map(rows.map((x) => [x.org_id, toSplit(x)]));
}

// ---------------- companies ----------------

export async function companyRows(r: PeriodRange, opts: { q?: string; ids?: string[] } = {}): Promise<AdminCompanyRow[]> {
  const like = opts.q ? `%${opts.q.replace(/[\\%_]/g, (c) => '\\' + c)}%` : null;
  const orgs = await execRows<{ id: string; name: string; slug: string; kind: string; created_at: string; disabled: boolean; monthly_budget_usd: number; credits_enforced: boolean }>(
    db,
    sql`select id, name, slug, kind, created_at, disabled, monthly_budget_usd, credits_enforced from ${schema.organizations}
        where true ${like ? sql`and (name ilike ${like} or slug ilike ${like})` : sql``}
        ${opts.ids ? (opts.ids.length ? sql`and id in (${sql.join(opts.ids.map((i) => sql`${i}::uuid`), sql`, `)})` : sql`and false`) : sql``}`,
  );
  if (!orgs.length) return [];
  const counts = await execRows<{ org_id: string; members: number; sites: number; runs: number; failed: number; last_run: string | null }>(
    db,
    sql`select o.id as org_id,
          (select count(*)::int from ${schema.memberships} m where m.org_id = o.id) as members,
          (select count(*)::int from ${schema.sites} s where s.org_id = o.id) as sites,
          (select count(*)::int from ${schema.runs} ru where ru.org_id = o.id and ${within(sql`ru.created_at`, r)}) as runs,
          (select count(*)::int from ${schema.runs} ru where ru.org_id = o.id and ru.status = 'failed' and ${within(sql`ru.created_at`, r)}) as failed,
          (select max(ru.created_at) from ${schema.runs} ru where ru.org_id = o.id) as last_run
        from ${schema.organizations} o where o.id in (${sql.join(orgs.map((o) => sql`${o.id}::uuid`), sql`, `)})`,
  );
  const by = new Map(counts.map((c) => [c.org_id, c]));
  const cost = await costByOrg(r);
  const credits = await creditTotals(r.from, r.to);
  const balances = await allBalances();
  const s = await settingsRow();
  return orgs
    .map((o): AdminCompanyRow => {
      const c = by.get(o.id);
      const cr = credits.get(o.id) ?? { granted: 0, used: 0, paid: 0 };
      const split = cost.get(o.id) ?? emptyCostSplit();
      return {
        id: o.id,
        name: o.name,
        slug: o.slug,
        kind: o.kind,
        createdAt: iso(o.created_at)!,
        disabled: !!o.disabled,
        members: Number(c?.members ?? 0),
        sites: Number(c?.sites ?? 0),
        monthlyBudgetUsd: Number(o.monthly_budget_usd),
        runs: Number(c?.runs ?? 0),
        failedRuns: Number(c?.failed ?? 0),
        lastRunAt: iso(c?.last_run),
        credits: { balance: balances.get(o.id) ?? 0, grantedInPeriod: cr.granted, usedInPeriod: cr.used, enforced: !!o.credits_enforced },
        money: moneyOf(split, cr.paid, cr.used, s.creditValueUsd),
      };
    })
    .sort((a, b) => b.money.cost.totalUsd - a.money.cost.totalUsd || a.name.localeCompare(b.name));
}

async function daily(r: PeriodRange, orgId?: string): Promise<AdminDailyPoint[]> {
  const scope = orgId ? sql`and org_id = ${orgId}::uuid` : sql``;
  let from = r.from;
  if (!from) {
    const [e] = await execRows<{ at: string | null }>(
      db,
      sql`select least((select min(occurred_at) from ${schema.costEvents} where true ${scope}), (select min(created_at) from ${schema.runs} where true ${scope})) as at`,
    );
    from = e?.at ? new Date(e.at) : new Date(r.to.getTime() - 30 * 86_400_000);
  }
  const range = { ...r, from };
  const day = (col: SQL) => sql`to_char(${col} at time zone 'UTC', 'YYYY-MM-DD')`;
  const cost = await execRows<CostAgg & { d: string; n: number }>(
    db,
    sql`select ${day(sql`occurred_at`)} as d, ${COST_COLS}, count(*) filter (where run_id is null)::int as n from ${schema.costEvents} where ${within(sql`occurred_at`, range)} ${scope} group by 1`,
  );
  const runs = await execRows<{ d: string; n: number }>(db, sql`select ${day(sql`created_at`)} as d, count(*)::int as n from ${schema.runs} where ${within(sql`created_at`, range)} ${scope} group by 1`);
  const rev = await execRows<{ d: string; usd: number }>(
    db,
    sql`select ${day(sql`created_at`)} as d, coalesce(sum(paid_usd), 0)::float as usd from ${schema.creditLedger} where kind = 'grant' and ${within(sql`created_at`, range)} ${scope} group by 1`,
  );
  const c = new Map(cost.map((x) => [x.d, x]));
  const ru = new Map(runs.map((x) => [x.d, Number(x.n)]));
  const rv = new Map(rev.map((x) => [x.d, Number(x.usd)]));
  return daysOf(from, r.to).map((d) => {
    const s = toSplit(c.get(d));
    return { date: d, claudeUsd: s.claudeUsd, dataforseoUsd: s.dataforseoUsd, revenueUsd: r2(rv.get(d) ?? 0), runs: (ru.get(d) ?? 0) + Number(c.get(d)?.n ?? 0) };
  });
}

export async function companyDetail(r: PeriodRange, orgId: string): Promise<AdminCompanyDetail | null> {
  const [row] = await companyRows(r, { ids: [orgId] });
  if (!row) return null;
  const members = await execRows<{ user_id: string; email: string; name: string; role: string; created_at: string; suspended_at: string | null }>(
    db,
    sql`select u.id as user_id, u.email, u.name, m.role, m.created_at, u.suspended_at from ${schema.memberships} m join ${schema.users} u on u.id = m.user_id
        where m.org_id = ${orgId}::uuid order by m.created_at`,
  );
  const sites = await execRows<{ id: string; domain: string; verified_at: string | null; tracking_status: string; created_at: string } & CostAgg>(
    db,
    sql`select s.id, s.domain, s.verified_at, s.tracking_status, s.created_at,
          coalesce((select sum(claude_usd) from ${schema.costEvents} e where e.site_id = s.id and ${within(sql`e.occurred_at`, r)}), 0)::float as claude,
          coalesce((select sum(claude_estimated_usd) from ${schema.costEvents} e where e.site_id = s.id and ${within(sql`e.occurred_at`, r)}), 0)::float as claude_est,
          coalesce((select sum(dataforseo_usd) from ${schema.costEvents} e where e.site_id = s.id and ${within(sql`e.occurred_at`, r)}), 0)::float as dfs
        from ${schema.sites} s where s.org_id = ${orgId}::uuid order by s.created_at`,
  );
  const modes = await execRows<CostAgg & { mode: string; runs: number; credits: number }>(
    db,
    sql`select mode, ${COST_COLS}, count(distinct coalesce(run_id::text, event_key))::int as runs,
          coalesce(sum(${debitedFor(sql`e.event_key`)}), 0)::float as credits
        from ${schema.costEvents} e
        where org_id = ${orgId}::uuid and ${within(sql`occurred_at`, r)} group by mode`,
  );
  const byMode: AdminModeCost[] = modes
    .map((m) => {
      const cost = toSplit(m);
      return { mode: m.mode || 'unknown', runs: Number(m.runs), cost, credits: r2(Number(m.credits)) };
    })
    .sort((a, b) => b.cost.totalUsd - a.cost.totalUsd);
  return {
    ...row,
    members_: members.map(
      (m): AdminMember => ({ userId: m.user_id, email: m.email, name: m.name, role: m.role, joinedAt: iso(m.created_at)!, suspended: !!m.suspended_at }),
    ),
    sites_: sites.map(
      (x): AdminSiteRow => ({ id: x.id, domain: x.domain, verified: !!x.verified_at, trackingStatus: x.tracking_status, createdAt: iso(x.created_at)!, cost: toSplit(x) }),
    ),
    byMode,
    daily: await daily(r, orgId),
    recentRuns: (await runsPage(r, { orgId, status: 'all', origin: 'all', limit: 20 })).rows,
    creditEntries: await listCreditEntries(orgId, 100),
  };
}

// ---------------- users ----------------

export async function userRows(r: PeriodRange, opts: { q?: string; ids?: string[] } = {}): Promise<AdminUserRow[]> {
  const like = opts.q ? `%${opts.q.replace(/[\\%_]/g, (c) => '\\' + c)}%` : null;
  const users = await execRows<{
    id: string; email: string; name: string; created_at: string; last_login_at: string | null; email_verified_at: string | null; password_hash: string | null;
    google_sub: string | null; suspended_at: string | null; totp: string | null; passkeys: number; sessions: number; runs: number;
  } & CostAgg>(
    db,
    sql`select u.id, u.email, u.name, u.created_at, u.last_login_at, u.email_verified_at, u.password_hash, u.google_sub, u.suspended_at,
          u.mfa_totp_enabled_at as totp,
          (select count(*)::int from ${schema.webauthnCredentials} w where w.user_id = u.id) as passkeys,
          (select count(*)::int from ${schema.sessions} se where se.user_id = u.id and se.expires_at > now()) as sessions,
          (select count(*)::int from ${schema.runs} ru where ru.user_id = u.id and ${within(sql`ru.created_at`, r)}) as runs,
          coalesce((select sum(claude_usd) from ${schema.costEvents} e where e.user_id = u.id and ${within(sql`e.occurred_at`, r)}), 0)::float as claude,
          coalesce((select sum(claude_estimated_usd) from ${schema.costEvents} e where e.user_id = u.id and ${within(sql`e.occurred_at`, r)}), 0)::float as claude_est,
          coalesce((select sum(dataforseo_usd) from ${schema.costEvents} e where e.user_id = u.id and ${within(sql`e.occurred_at`, r)}), 0)::float as dfs
        from ${schema.users} u
        where true ${like ? sql`and (u.email ilike ${like} or u.name ilike ${like})` : sql``}
        ${opts.ids ? (opts.ids.length ? sql`and u.id in (${sql.join(opts.ids.map((i) => sql`${i}::uuid`), sql`, `)})` : sql`and false`) : sql``}
        order by u.created_at desc`,
  );
  if (!users.length) return [];
  const ms = await execRows<{ user_id: string; org_id: string; name: string; role: string }>(
    db,
    sql`select m.user_id, m.org_id, o.name, m.role from ${schema.memberships} m join ${schema.organizations} o on o.id = m.org_id
        where m.user_id in (${sql.join(users.map((u) => sql`${u.id}::uuid`), sql`, `)}) order by o.name`,
  );
  const byUser = new Map<string, { id: string; name: string; role: string }[]>();
  for (const m of ms) byUser.set(m.user_id, [...(byUser.get(m.user_id) ?? []), { id: m.org_id, name: m.name, role: m.role }]);
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    createdAt: iso(u.created_at)!,
    lastLoginAt: iso(u.last_login_at),
    emailVerified: !!u.email_verified_at,
    mfa: !!u.totp || Number(u.passkeys) > 0,
    hasPassword: !!u.password_hash,
    google: !!u.google_sub,
    suspended: !!u.suspended_at,
    platformAdmin: isPlatformAdmin({ email: u.email, emailVerifiedAt: u.email_verified_at ? new Date(u.email_verified_at) : null } as UserRow),
    activeSessions: Number(u.sessions),
    companies: byUser.get(u.id) ?? [],
    cost: toSplit(u),
    runs: Number(u.runs),
  }));
}

// ---------------- runs ----------------

export interface RunsQuery {
  q?: string;
  orgId?: string;
  status: 'all' | 'failed' | 'running' | 'done';
  origin: 'all' | 'app' | 'schedule';
  cursor?: string;
  limit: number;
}

const encodeCursor = (at: string, id: string) => Buffer.from(JSON.stringify([at, id])).toString('base64url');
function decodeCursor(c?: string): [string, string] | null {
  if (!c) return null;
  try {
    const v = JSON.parse(Buffer.from(c, 'base64url').toString('utf8'));
    if (Array.isArray(v) && typeof v[0] === 'string' && typeof v[1] === 'string' && !Number.isNaN(Date.parse(v[0]))) return [v[0], v[1]];
  } catch {
    /* a bad cursor reads from the start */
  }
  return null;
}

const certaintyOf = (states: string[]): CostCertainty => {
  const s = new Set(states);
  if (!s.size) return 'measured';
  if (s.size === 1) return [...s][0] as CostCertainty;
  if (s.has('not reported')) return 'not reported';
  return 'partly estimated';
};

/**
 * The runs page: app runs (the `runs` table) and the engine's own work that belongs to no run (schedules, keyword checks: cost events
 * with no run), newest first, one cursor over both (`at`, `id`, microsecond precision so no row is skipped or repeated).
 */
export async function runsPage(r: PeriodRange, q: RunsQuery): Promise<AdminRunsPage> {
  const like = q.q ? `%${q.q.replace(/[\\%_]/g, (c) => '\\' + c)}%` : null;
  const withRuns = q.origin !== 'schedule';
  const withEvents = q.status === 'all' || q.status === 'done';
  const runStatus =
    q.status === 'failed' ? sql`and ru.status = 'failed'` : q.status === 'running' ? sql`and ru.status in ('submitting', 'accepted', 'running')` : q.status === 'done' ? sql`and ru.status = 'completed'` : sql``;
  const parts: SQL[] = [];
  if (withRuns)
    parts.push(sql`select ru.created_at as at, ru.id::text as id, 'run' as kind from ${schema.runs} ru
      join ${schema.organizations} o on o.id = ru.org_id
      left join ${schema.sites} s on s.id = ru.site_id
      left join ${schema.users} u on u.id = ru.user_id
      where ${within(sql`ru.created_at`, r)} ${runStatus} ${q.orgId ? sql`and ru.org_id = ${q.orgId}::uuid` : sql``}
      ${like ? sql`and (ru.title ilike ${like} or ru.mode ilike ${like} or o.name ilike ${like} or coalesce(s.domain, '') ilike ${like} or coalesce(u.email, '') ilike ${like})` : sql``}`);
  if (withEvents)
    parts.push(sql`select e.occurred_at as at, e.event_key as id, 'event' as kind from ${schema.costEvents} e
      left join ${schema.organizations} o on o.id = e.org_id
      where e.run_id is null and ${within(sql`e.occurred_at`, r)}
      ${q.origin !== 'all' ? sql`and e.origin = ${q.origin}` : sql``} ${q.orgId ? sql`and e.org_id = ${q.orgId}::uuid` : sql``}
      ${like ? sql`and (e.mode ilike ${like} or e.domain ilike ${like} or coalesce(o.name, '') ilike ${like})` : sql``}`);
  if (!parts.length) return { rows: [], total: 0, nextCursor: null };
  const items = sql.join(parts, sql` union all `);
  const cur = decodeCursor(q.cursor);
  const page = await execRows<{ at_text: string; id: string; kind: 'run' | 'event' }>(
    db,
    sql`select to_char(at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as at_text, id, kind from (${items}) i
        ${cur ? sql`where (at, id) < (${cur[0]}::timestamptz, ${cur[1]})` : sql``}
        order by at desc, id desc limit ${q.limit + 1}`,
  );
  const [{ n }] = await execRows<{ n: number }>(db, sql`select count(*)::int as n from (${items}) i`);
  const more = page.length > q.limit;
  const slice = page.slice(0, q.limit);
  const runIds = slice.filter((x) => x.kind === 'run').map((x) => x.id);
  const eventKeys = slice.filter((x) => x.kind === 'event').map((x) => x.id);

  const runRows = runIds.length
    ? await execRows<{
        id: string; org_id: string; org_name: string; domain: string | null; email: string | null; mode: string; title: string; status: string;
        created_at: string; completed_at: string | null; error: string | null; events: number; states: string[] | null; credits: number;
      } & CostAgg>(
        db,
        sql`select ru.id, ru.org_id, o.name as org_name, s.domain, u.email, ru.mode, ru.title, ru.status, ru.created_at, ru.completed_at, ru.error,
              (select count(*)::int from ${schema.costEvents} e where e.run_id = ru.id) as events,
              (select array_agg(distinct e.certainty) from ${schema.costEvents} e where e.run_id = ru.id) as states,
              (select coalesce(sum(${debitedFor(sql`e.event_key`)}), 0) from ${schema.costEvents} e where e.run_id = ru.id)::float as credits,
              coalesce((select sum(claude_usd) from ${schema.costEvents} e where e.run_id = ru.id), 0)::float as claude,
              coalesce((select sum(claude_estimated_usd) from ${schema.costEvents} e where e.run_id = ru.id), 0)::float as claude_est,
              coalesce((select sum(dataforseo_usd) from ${schema.costEvents} e where e.run_id = ru.id), 0)::float as dfs
            from ${schema.runs} ru join ${schema.organizations} o on o.id = ru.org_id left join ${schema.sites} s on s.id = ru.site_id
            left join ${schema.users} u on u.id = ru.user_id
            where ru.id in (${sql.join(runIds.map((i) => sql`${i}::uuid`), sql`, `)})`,
      )
    : [];
  const evRows = eventKeys.length
    ? await execRows<{
        event_key: string; org_id: string | null; org_name: string | null; domain: string; email: string | null; mode: string; origin: string; source: string;
        started_at: string | null; occurred_at: string; certainty: string; credits: number;
      } & CostAgg>(
        db,
        sql`select e.event_key, e.org_id, o.name as org_name, e.domain, u.email, e.mode, e.origin, e.source, e.started_at, e.occurred_at, e.certainty,
              e.claude_usd::float as claude, e.claude_estimated_usd::float as claude_est, e.dataforseo_usd::float as dfs,
              ${debitedFor(sql`e.event_key`)}::float as credits
            from ${schema.costEvents} e left join ${schema.organizations} o on o.id = e.org_id left join ${schema.users} u on u.id = e.user_id
            where e.event_key in (${sql.join(eventKeys.map((k) => sql`${k}`), sql`, `)})`,
      )
    : [];
  const runMap = new Map(runRows.map((x) => [x.id, x]));
  const evMap = new Map(evRows.map((x) => [x.event_key, x]));
  const modeTitle = (m: string) => (m ? m.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : 'Engine run');
  const rows: AdminRunRow[] = [];
  for (const it of slice) {
    if (it.kind === 'run') {
      const x = runMap.get(it.id);
      if (!x) continue;
      const cost = Number(x.events) > 0 ? toSplit(x) : null;
      rows.push({
        id: x.id,
        orgId: x.org_id,
        orgName: x.org_name,
        siteDomain: x.domain,
        userEmail: x.email,
        mode: x.mode,
        title: x.title,
        status: x.status,
        createdAt: iso(x.created_at)!,
        completedAt: iso(x.completed_at),
        error: x.error,
        cost,
        certainty: cost ? certaintyOf(x.states ?? []) : 'not reported',
        credits: cost ? r2(Number(x.credits)) : null,
        origin: 'app',
      });
    } else {
      const x = evMap.get(it.id);
      if (!x) continue;
      const cost = toSplit(x);
      rows.push({
        id: x.event_key,
        orgId: x.org_id ?? '',
        orgName: x.org_name ?? 'Unattributed',
        siteDomain: x.domain || null,
        userEmail: x.email,
        mode: x.mode,
        title: x.source === 'keyword_check' ? 'Keyword check' : `${modeTitle(x.mode)}${x.origin === 'schedule' ? ' (schedule)' : ''}${x.domain ? ` · ${x.domain}` : ''}`,
        status: 'completed',
        createdAt: iso(x.started_at ?? x.occurred_at)!,
        completedAt: iso(x.occurred_at),
        error: null,
        cost,
        certainty: x.certainty as CostCertainty,
        credits: x.org_id ? r2(Number(x.credits)) : null,
        origin: x.origin === 'app' ? 'app' : 'schedule',
      });
    }
  }
  const last = slice[slice.length - 1];
  return { rows, total: Number(n), nextCursor: more && last ? encodeCursor(last.at_text, last.id) : null };
}

// ---------------- overview ----------------

export async function overview(r: PeriodRange): Promise<AdminOverview> {
  const [u] = await execRows<{ total: number; new_: number; active: number; suspended: number }>(
    db,
    sql`select count(*)::int as total,
          count(*) filter (where ${within(sql`created_at`, r)})::int as new_,
          count(*) filter (where (${within(sql`last_login_at`, r)}) or exists (select 1 from ${schema.runs} ru where ru.user_id = u.id and ${within(sql`ru.created_at`, r)}))::int as active,
          count(*) filter (where suspended_at is not null)::int as suspended
        from ${schema.users} u`,
  );
  const [o] = await execRows<{ total: number; new_: number; disabled: number; enforced: number }>(
    db,
    sql`select count(*)::int as total, count(*) filter (where ${within(sql`created_at`, r)})::int as new_,
          count(*) filter (where disabled)::int as disabled, count(*) filter (where credits_enforced)::int as enforced from ${schema.organizations}`,
  );
  const [st] = await execRows<{ sites: number; started: number; failed: number; inflight: number }>(
    db,
    sql`select (select count(*)::int from ${schema.sites}) as sites,
          (select count(*)::int from ${schema.runs} where ${within(sql`created_at`, r)}) as started,
          (select count(*)::int from ${schema.runs} where status = 'failed' and ${within(sql`created_at`, r)}) as failed,
          (select count(*)::int from ${schema.runs} where status in ('submitting', 'accepted', 'running')) as inflight`,
  );
  const cost = await costByOrg(r);
  let all = emptyCostSplit();
  for (const v of cost.values()) all = addSplit(all, v);
  const unattributed = cost.get(null) ?? emptyCostSplit();
  const credits = await creditTotals(r.from, r.to);
  let granted = 0;
  let used = 0;
  let paid = 0;
  for (const c of credits.values()) {
    granted += c.granted;
    used += c.used;
    paid += c.paid;
  }
  const deleted = credits.get(null) ?? { granted: 0, used: 0, paid: 0 };
  const [gone] = await execRows<CostAgg>(db, sql`select ${COST_COLS} from ${schema.costEvents} where detached_from is not null and ${within(sql`occurred_at`, r)}`);
  const balances = await allBalances();
  const outstanding = [...balances.values()].reduce((a, b) => a + b, 0);
  const s = await settingsRow();
  const [earliest] = await execRows<{ at: string | null }>(db, sql`select min(occurred_at) as at from ${schema.costEvents}`);
  const [anthropic, dataforseo] = await Promise.all([
    anthropicBill(r, all.claudeUsd, earliest?.at ? new Date(earliest.at) : null),
    dataforseoBill(r, all.dataforseoUsd),
  ]);
  const companies = await companyRows(r);
  const ledgerNote = !s.ledgerSyncedAt
    ? 'The engine ledger has not been synced yet (the first sync runs a minute after the server starts, or use "Sync now").'
    : s.ledgerSyncOk
      ? `Synced ${s.ledgerSyncedAt.toISOString()}: ${s.ledgerSyncNote}`
      : `Last sync ${s.ledgerSyncedAt.toISOString()}: ${s.ledgerSyncNote}`;
  return {
    period: r.period,
    from: r.from?.toISOString() ?? null,
    to: r.to.toISOString(),
    users: { total: Number(u.total), newInPeriod: Number(u.new_), activeInPeriod: Number(u.active), suspended: Number(u.suspended) },
    companies: { total: Number(o.total), newInPeriod: Number(o.new_), disabled: Number(o.disabled), withEnforcedCredits: Number(o.enforced) },
    sites: Number(st.sites),
    runs: { started: Number(st.started), failed: Number(st.failed), inFlight: Number(st.inflight) },
    money: moneyOf(all, paid, used, s.creditValueUsd),
    unattributed,
    deletedCompanies: { cost: toSplit(gone), revenueUsd: r2(deleted.paid), creditsGranted: r2(deleted.granted) },
    credits: { outstanding: r2(outstanding), grantedInPeriod: r2(granted), usedInPeriod: r2(used) },
    daily: await daily(r),
    bills: [anthropic, dataforseo],
    sources: { engineLedger: { ok: s.ledgerSyncOk, lastSyncAt: s.ledgerSyncedAt?.toISOString() ?? null, rows: s.ledgerRows, note: ledgerNote } },
    topCompanies: companies.slice(0, 5),
  };
}

// ---------------- activity + CSV ----------------

export async function activity(limit: number): Promise<AdminActivityRow[]> {
  const rows = await db.query.adminAudit.findMany({ orderBy: (t, { desc }) => [desc(t.at)], limit });
  return rows.map((x) => ({ id: x.id, at: x.at.toISOString(), actor: x.actorEmail, action: x.action, target: { type: x.targetType, id: x.targetId, label: x.targetLabel }, details: x.details }));
}

/** One CSV cell: quoted when needed; a text cell that a spreadsheet would run as a formula (= + - @, tab, CR) is defused with a '. */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const toCsv = (header: string[], rows: unknown[][]): string => [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

export function companiesCsv(rows: AdminCompanyRow[]): string {
  return toCsv(
    ['company', 'slug', 'kind', 'created_at', 'disabled', 'members', 'websites', 'runs', 'failed_runs', 'claude_usd', 'claude_estimated_usd', 'dataforseo_usd', 'cost_usd', 'revenue_usd', 'margin_usd', 'margin_pct', 'list_value_usd', 'credits_balance', 'credits_granted', 'credits_used', 'credits_enforced', 'monthly_budget_usd', 'last_run_at'],
    rows.map((c) => [
      c.name, c.slug, c.kind, c.createdAt, c.disabled, c.members, c.sites, c.runs, c.failedRuns, c.money.cost.claudeUsd, c.money.cost.claudeEstimatedUsd,
      c.money.cost.dataforseoUsd, c.money.cost.totalUsd, c.money.revenueUsd, c.money.marginUsd, c.money.marginPct, c.money.listValueUsd, c.credits.balance,
      c.credits.grantedInPeriod, c.credits.usedInPeriod, c.credits.enforced, c.monthlyBudgetUsd, c.lastRunAt,
    ]),
  );
}
