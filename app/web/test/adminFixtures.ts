// Answers shaped exactly like the admin contract (shared/src/admin.ts), with realistic numbers: the render test uses them, and the
// browser pass bundles this file (esbuild) to serve /api/admin/* while the server side is being built.
import type {
  AdminActivityRow,
  AdminCompanyDetail,
  AdminCompanyRow,
  AdminCreatedUser,
  AdminDailyPoint,
  AdminOverview,
  AdminRunRow,
  AdminRunsPage,
  AdminUserRow,
  CostSplit,
  CreditEntry,
  DeliveryReport,
  Me,
  PlatformSettings,
} from '@seo/shared';

const r4 = (n: number) => Math.round(n * 10000) / 10000;
const split = (c: number, d: number, est = 0): CostSplit => ({ claudeUsd: r4(c), dataforseoUsd: r4(d), totalUsd: r4(c + d), claudeEstimatedUsd: r4(est) });
const money = (cost: CostSplit, revenue: number, creditsUsed: number) => ({
  cost,
  revenueUsd: revenue,
  marginUsd: r4(revenue - cost.totalUsd),
  marginPct: revenue > 0 ? Math.round(((revenue - cost.totalUsd) / revenue) * 1000) / 10 : null,
  listValueUsd: r4(creditsUsed * 0.1),
});

export const ADMIN_ID = '0b8f3a52-6f0e-4c5e-9a43-1d2f6a7b8c01';
export const me: Me = {
  user: { id: ADMIN_ID, email: 'ops@alaventra.com', name: 'Abdul Muqadim', avatarUrl: null, emailVerified: true, hasPassword: true, googleLinked: true, createdAt: '2026-10-01T08:00:00Z', mfaEnabled: true },
  orgs: [{ id: '5f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e01', name: 'Techand', slug: 'techand', role: 'owner', onboardingStep: 'done', onboardedAt: '2026-10-01T09:00:00Z' }],
  platformAdmin: true,
};

const ORGS = [
  { id: '5f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e01', name: 'Techand', slug: 'techand', kind: 'company', members: 4, sites: 2, runs: 46, failed: 2, c: 8.4127, d: 3.9105, est: 2.71, rev: 49, used: 372.4, bal: 627.6, enforced: true },
  { id: '5f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e02', name: 'Northwind Trading', slug: 'northwind-trading', kind: 'company', members: 2, sites: 1, runs: 18, failed: 0, c: 3.1044, d: 1.2381, est: 0.98, rev: 25, used: 130.3, bal: 119.7, enforced: false },
  { id: '5f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e03', name: 'Brightline Agency', slug: 'brightline', kind: 'agency', members: 7, sites: 5, runs: 112, failed: 5, c: 21.877, d: 9.402, est: 6.1, rev: 120, used: 938.4, bal: 61.6, enforced: true },
  { id: '5f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e04', name: 'Azdan Consulting', slug: 'azdan', kind: 'company', members: 1, sites: 1, runs: 3, failed: 1, c: 0.4211, d: 0.0904, est: 0.2, rev: 0, used: 15.3, bal: -15.3, enforced: false },
  { id: '5f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e05', name: 'Peppol Partners', slug: 'peppol-partners', kind: 'company', members: 3, sites: 0, runs: 0, failed: 0, c: 0, d: 0, est: 0, rev: 0, used: 0, bal: 100, enforced: false, disabled: true },
];

export const companies: AdminCompanyRow[] = ORGS.map((o, i) => ({
  id: o.id,
  name: o.name,
  slug: o.slug,
  kind: o.kind,
  createdAt: `2026-0${8 + Math.min(i, 1)}-1${i}T09:00:00Z`,
  disabled: !!o.disabled,
  members: o.members,
  sites: o.sites,
  monthlyBudgetUsd: [50, 20, 150, 10, 20][i]!,
  runs: o.runs,
  failedRuns: o.failed,
  lastRunAt: o.runs ? `2026-10-18T1${i}:24:00Z` : null,
  credits: { balance: o.bal, grantedInPeriod: o.rev ? o.rev * 10 + 100 : 0, usedInPeriod: o.used, enforced: o.enforced },
  money: money(split(o.c, o.d, o.est), o.rev, o.used),
}));

const daily: AdminDailyPoint[] = Array.from({ length: 18 }, (_, i) => {
  const day = String(i + 1).padStart(2, '0');
  const wave = 0.6 + 0.4 * Math.sin(i / 2);
  return {
    date: `2026-10-${day}`,
    claudeUsd: r4((1.4 + (i % 7 === 0 ? 2.2 : 0)) * wave + 0.3),
    dataforseoUsd: r4(0.55 * wave + (i % 7 === 0 ? 0.9 : 0.1)),
    revenueUsd: [1, 6, 12].includes(i) ? [49, 25, 120][[1, 6, 12].indexOf(i)]! : 0,
    runs: Math.round(8 * wave + 2),
  };
});

const cost = companies.reduce((t, c) => split(t.claudeUsd + c.money.cost.claudeUsd, t.dataforseoUsd + c.money.cost.dataforseoUsd, t.claudeEstimatedUsd + c.money.cost.claudeEstimatedUsd), split(0, 0));
const revenue = companies.reduce((t, c) => t + c.money.revenueUsd, 0);
const unattributed = split(1.0832, 0.4127, 0.31);

export const overview: AdminOverview = {
  period: 'month',
  from: '2026-10-01T00:00:00Z',
  to: '2026-10-18T19:00:00Z',
  users: { total: 23, newInPeriod: 6, activeInPeriod: 14, suspended: 1 },
  companies: { total: companies.length, newInPeriod: 2, disabled: 1, withEnforcedCredits: 2 },
  sites: 9,
  runs: { started: 179, failed: 8, inFlight: 2 },
  money: money(cost, revenue, 1456.4),
  unattributed,
  credits: { outstanding: 893.6, grantedInPeriod: 2240, usedInPeriod: 1456.4 },
  daily,
  bills: [
    {
      provider: 'anthropic',
      billedUsd: null,
      attributedUsd: r4(cost.claudeUsd + unattributed.claudeUsd),
      ratio: null,
      asOf: null,
      source: 'unavailable',
      note: 'No Anthropic Admin API key is set (ANTHROPIC_ADMIN_KEY), so the bill cannot be read; the attributed figure comes from the engine ledger.',
    },
    {
      provider: 'dataforseo',
      billedUsd: 15.4127,
      attributedUsd: r4(cost.dataforseoUsd + unattributed.dataforseoUsd),
      ratio: r4(15.4127 / (cost.dataforseoUsd + unattributed.dataforseoUsd)),
      balanceUsd: 42.61,
      asOf: '2026-10-18T18:40:00Z',
      source: 'provider',
      note: 'Balance movement over the period, read from the DataForSEO account.',
    },
  ],
  sources: { engineLedger: { ok: true, lastSyncAt: '2026-10-18T18:52:00Z', rows: 1843, note: 'Costs come from the engine’s run ledger, matched to app runs by execution id.' } },
  topCompanies: [...companies].sort((a, b) => b.money.cost.totalUsd - a.money.cost.totalUsd).slice(0, 5),
};

const MODES_LIST = ['keyword', 'verdict', 'audit', 'ai_visibility', 'backlinks', 'discover', 'track'];
export const runs: AdminRunRow[] = Array.from({ length: 64 }, (_, i) => {
  const o = companies[i % 4]!;
  const mode = MODES_LIST[i % MODES_LIST.length]!;
  const failed = i % 11 === 3;
  const running = i < 2;
  const c = mode === 'keyword' ? 0.52 + (i % 5) * 0.03 : mode === 'audit' ? 0.04 : 0.01 + (i % 4) * 0.004;
  const d = mode === 'keyword' ? 0.21 : mode === 'ai_visibility' ? 0.31 : 0.02 + (i % 3) * 0.006;
  const sc = running ? null : split(c, d, mode === 'keyword' ? c * 0.4 : 0);
  return {
    id: `7a0e${String(i).padStart(4, '0')}-1111-4222-8333-944455556666`,
    orgId: o.id,
    orgName: o.name,
    siteDomain: ['techand.ai', 'northwind.example', 'brightline.example', 'azdan.com'][i % 4]!,
    userEmail: i % 3 === 0 ? null : ['sara@techand.ai', 'li@northwind.example', 'max@brightline.example', 'omar@azdan.com'][i % 4]!,
    mode,
    title: mode === 'keyword' ? ['e-invoicing in uae', 'peppol uae', 'corporate tax registration uae'][i % 3]! : '',
    status: running ? 'running' : failed ? 'failed' : 'completed',
    createdAt: new Date(Date.UTC(2026, 9, 18, 19) - i * 3.7 * 3600_000).toISOString(),
    completedAt: running ? null : new Date(Date.UTC(2026, 9, 18, 19) - i * 3.7 * 3600_000 + 600_000).toISOString(),
    error: failed
      ? i % 2
        ? 'DataForSEO answered 40501 inside HTTP 200 for serp/google/organic/live/advanced: Invalid Field: web_search_country_iso_code. The run was stopped before any page was written, so no credit was used for the writing step.'
        : 'Budget refused'
      : null,
    cost: sc,
    certainty: running ? 'not reported' : mode === 'keyword' ? 'partly estimated' : 'measured',
    credits: sc ? Math.round(((sc.totalUsd * 3) / 0.1) * 100) / 100 : null,
    origin: i % 3 === 0 ? 'schedule' : 'app',
  };
});

export function runsPage(cursor: string | null, limit: number, filter: (r: AdminRunRow) => boolean = () => true): AdminRunsPage {
  const all = runs.filter(filter);
  const start = cursor ? Number(cursor) : 0;
  const rows = all.slice(start, start + limit);
  return { rows, total: all.length, nextCursor: start + limit < all.length ? String(start + limit) : null };
}

export const users: AdminUserRow[] = [
  { id: ADMIN_ID, email: 'ops@alaventra.com', name: 'Abdul Muqadim', createdAt: '2026-10-01T08:00:00Z', lastLoginAt: '2026-10-18T18:30:00Z', emailVerified: true, mfa: true, hasPassword: true, google: true, suspended: false, platformAdmin: true, activeSessions: 2, companies: [{ id: ORGS[0]!.id, name: 'Techand', role: 'owner' }], cost: split(0.62, 0.21, 0.24), runs: 3 },
  { id: '1c9e7d1a-2b3c-4d5e-8f60-718293a4b5c2', email: 'sara@techand.ai', name: 'Sara Haddad', createdAt: '2026-10-02T10:12:00Z', lastLoginAt: '2026-10-18T11:05:00Z', emailVerified: true, mfa: false, hasPassword: true, google: false, suspended: false, platformAdmin: false, activeSessions: 1, companies: [{ id: ORGS[0]!.id, name: 'Techand', role: 'admin' }, { id: ORGS[2]!.id, name: 'Brightline Agency', role: 'viewer' }], cost: split(5.112, 2.004, 1.9), runs: 21 },
  { id: '1c9e7d1a-2b3c-4d5e-8f60-718293a4b5c3', email: 'li@northwind.example', name: 'Li Wei', createdAt: '2026-10-05T14:00:00Z', lastLoginAt: '2026-10-17T09:41:00Z', emailVerified: true, mfa: true, hasPassword: false, google: true, suspended: false, platformAdmin: false, activeSessions: 3, companies: [{ id: ORGS[1]!.id, name: 'Northwind Trading', role: 'owner' }], cost: split(3.1044, 1.2381, 0.98), runs: 12 },
  { id: '1c9e7d1a-2b3c-4d5e-8f60-718293a4b5c4', email: 'max@brightline.example', name: 'Max Becker', createdAt: '2026-09-21T16:20:00Z', lastLoginAt: '2026-10-18T07:02:00Z', emailVerified: true, mfa: true, hasPassword: true, google: false, suspended: false, platformAdmin: false, activeSessions: 1, companies: [{ id: ORGS[2]!.id, name: 'Brightline Agency', role: 'owner' }], cost: split(14.21, 6.02, 4.1), runs: 61 },
  { id: '1c9e7d1a-2b3c-4d5e-8f60-718293a4b5c5', email: 'omar@azdan.com', name: 'Omar Azdan', createdAt: '2026-10-16T12:00:00Z', lastLoginAt: null, emailVerified: false, mfa: false, hasPassword: false, google: false, suspended: false, platformAdmin: false, activeSessions: 0, companies: [{ id: ORGS[3]!.id, name: 'Azdan Consulting', role: 'owner' }], cost: split(0, 0), runs: 0 },
  { id: '1c9e7d1a-2b3c-4d5e-8f60-718293a4b5c6', email: 'former@peppol-partners.example', name: 'Jonas Former', createdAt: '2026-08-11T12:00:00Z', lastLoginAt: '2026-09-02T12:00:00Z', emailVerified: true, mfa: false, hasPassword: true, google: false, suspended: true, platformAdmin: false, activeSessions: 0, companies: [], cost: split(0, 0), runs: 0 },
];

export function companyDetail(id: string): AdminCompanyDetail | null {
  const c = companies.find((x) => x.id === id);
  if (!c) return null;
  const mine = runs.filter((r) => r.orgId === id);
  const byMode = new Map<string, { mode: string; runs: number; cost: CostSplit; credits: number }>();
  for (const r of mine) {
    const m = byMode.get(r.mode) ?? { mode: r.mode, runs: 0, cost: split(0, 0), credits: 0 };
    m.runs++;
    if (r.cost) m.cost = split(m.cost.claudeUsd + r.cost.claudeUsd, m.cost.dataforseoUsd + r.cost.dataforseoUsd, m.cost.claudeEstimatedUsd + r.cost.claudeEstimatedUsd);
    m.credits += r.credits ?? 0;
    byMode.set(r.mode, m);
  }
  return {
    ...c,
    members_: users
      .filter((u) => u.companies.some((m) => m.id === id))
      .map((u) => ({ userId: u.id, email: u.email, name: u.name, role: u.companies.find((m) => m.id === id)!.role, joinedAt: u.createdAt, suspended: u.suspended })),
    sites_: Array.from({ length: c.sites }, (_, i) => ({
      id: `9b1d${String(i).padStart(4, '0')}-1111-4222-8333-944455556666`,
      domain: i === 0 ? `${c.slug}.example` : `blog.${c.slug}.example`,
      verified: i === 0,
      trackingStatus: i === 0 ? 'tracking weekly' : 'not tracked',
      createdAt: c.createdAt,
      cost: i === 0 ? c.money.cost : split(0.12, 0.04),
    })),
    byMode: [...byMode.values()],
    daily: daily.map((d) => ({ ...d, claudeUsd: r4(d.claudeUsd * 0.3), dataforseoUsd: r4(d.dataforseoUsd * 0.3), revenueUsd: d.date === '2026-10-02' ? c.money.revenueUsd : 0, runs: Math.round(d.runs * 0.3) })),
    recentRuns: mine.slice(0, 8),
    creditEntries: credits(id),
  };
}

export function credits(id: string): CreditEntry[] {
  const c = companies.find((x) => x.id === id);
  if (!c) return [];
  const rows: Omit<CreditEntry, 'balanceAfter'>[] = [
    { id: 'ce-1', createdAt: '2026-10-02T09:00:00Z', kind: 'grant', credits: 500, paidUsd: c.money.revenueUsd, note: c.money.revenueUsd ? 'Invoice 2026-114, bank transfer' : 'Launch promotion', ref: null, actor: 'ops@alaventra.com' },
    { id: 'ce-2', createdAt: '2026-10-03T10:30:00Z', kind: 'usage', credits: -24.3, paidUsd: 0, note: '', ref: { runId: runs[4]!.id, mode: 'keyword', domain: 'techand.ai' }, actor: null },
    { id: 'ce-3', createdAt: '2026-10-05T12:00:00Z', kind: 'usage', credits: -0.9, paidUsd: 0, note: '', ref: { runId: runs[5]!.id, mode: 'verdict', domain: 'techand.ai' }, actor: null },
    { id: 'ce-4', createdAt: '2026-10-06T08:15:00Z', kind: 'refund', credits: 24.3, paidUsd: 0, note: 'Run failed on our side (DataForSEO 40501)', ref: null, actor: 'ops@alaventra.com' },
    { id: 'ce-5', createdAt: '2026-10-09T16:00:00Z', kind: 'adjust', credits: -10, paidUsd: 0, note: 'Duplicate grant corrected', ref: null, actor: 'ops@alaventra.com' },
    { id: 'ce-6', createdAt: '2026-10-12T07:30:00Z', kind: 'usage', credits: -31.2, paidUsd: 0, note: '', ref: { engineRunId: 'exec-842', mode: 'ai_visibility', domain: 'techand.ai' }, actor: null },
  ];
  let bal = 0;
  return rows
    .map((r) => {
      bal = Math.round((bal + r.credits) * 100) / 100;
      return { ...r, balanceAfter: bal };
    })
    .reverse();
}

export const settings: PlatformSettings = { creditValueUsd: 0.1, markup: 3, signupCredits: 50, enforceForNewCompanies: false, updatedAt: '2026-10-18T15:02:00Z', updatedBy: 'ops@alaventra.com' };

export const activity: AdminActivityRow[] = [
  { id: 'a1', at: '2026-10-18T18:21:00Z', actor: 'ops@alaventra.com', action: 'credits.granted', target: { type: 'company', id: ORGS[2]!.id, label: 'Brightline Agency' }, details: { credits: 1200, paidUsd: 120, note: 'Invoice 2026-121' } },
  { id: 'a2', at: '2026-10-18T15:02:00Z', actor: 'ops@alaventra.com', action: 'settings.changed', target: { type: 'settings', id: null, label: 'Platform settings' }, details: { markup: { from: 2.5, to: 3 }, signupCredits: { from: 0, to: 50 } } },
  { id: 'a3', at: '2026-10-17T11:40:00Z', actor: 'ops@alaventra.com', action: 'user.suspended', target: { type: 'user', id: users[5]!.id, label: 'former@peppol-partners.example' }, details: {} },
  { id: 'a4', at: '2026-10-16T12:00:00Z', actor: 'ops@alaventra.com', action: 'user.created', target: { type: 'user', id: users[4]!.id, label: 'omar@azdan.com' }, details: { orgId: ORGS[3]!.id, role: 'owner', markVerified: false } },
  { id: 'a5', at: '2026-10-15T09:12:00Z', actor: 'ops@alaventra.com', action: 'company.disabled', target: { type: 'company', id: ORGS[4]!.id, label: 'Peppol Partners' }, details: { reason: 'Asked to pause' } },
];

export const createdUser = (body: { email: string; name: string }): AdminCreatedUser => ({
  user: { ...users[4]!, id: '1c9e7d1a-2b3c-4d5e-8f60-718293a4b5c9', email: body.email, name: body.name },
  setPasswordUrl: 'https://app.alaventra.com/reset-password?token=ae3b0c7f1e9d4a6b8c2e5f7a9b1d3c5e',
  expiresInHours: 72,
});

export const delivery: DeliveryReport = {
  targetPct: 99,
  timezone: 'America/New_York',
  weeks: [
    { week: '2026-09-28', overallPct: 96.2, onDemand: { started: 30, settled: 29, delivered: 28, failed: 1, noReport: 0, stuck: 0, inFlight: 0, ratePct: 96.6 }, scheduled: { started: 24, settled: 24, delivered: 24, failed: 0, ratePct: 100 }, missed: [] },
    { week: '2026-10-05', overallPct: 92.1, onDemand: { started: 41, settled: 40, delivered: 38, failed: 1, noReport: 1, stuck: 0, inFlight: 0, ratePct: 95 }, scheduled: { started: 22, settled: 22, delivered: 20, failed: 2, ratePct: 90.9 }, missed: [{ workflow: 'SEOagentTracker1', title: 'Rank Tracker', expectedAt: '2026-10-12T12:00:00Z' }] },
    { week: '2026-10-12', overallPct: 99.1, onDemand: { started: 70, settled: 68, delivered: 68, failed: 0, noReport: 0, stuck: 0, inFlight: 2, ratePct: 100 }, scheduled: { started: 40, settled: 40, delivered: 39, failed: 1, ratePct: 97.5 }, missed: [] },
  ],
  alerts: { total: 6, delivered: 6, pending: 0, ratePct: 100, byChannel: { slack: 6 } },
  notes: [],
} as unknown as DeliveryReport;
