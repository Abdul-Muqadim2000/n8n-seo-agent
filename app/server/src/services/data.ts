import {
  COUNTRIES,
  profileReadiness,
  safeJson,
  splitList,
  type AiAccess,
  type AiData,
  type AiDailyRow,
  type AiEngineStat,
  type AiGroup,
  type AiIndex,
  type AiPerception,
  type AiTraffic,
  type AiRun,
  type AiAnswerRow,
  type AiPromptRow,
  type AiVisibilityRow,
  type AlertsData,
  type AuditFindingRow,
  type AuditPoint,
  type AuditRow,
  type BacklinkLink,
  type BacklinkSnapshot,
  type BacklinkSnapshotRow,
  type BacklinksData,
  type BacklinkRef,
  type BacklinkRow,
  type BacklinkCoverage,
  type LinkImportRow,
  type LinkGraphRow,
  type CadenceRow,
  type CaseStudyRow,
  type CheckinRow,
  type ConsoleAlertRow,
  type ContentData,
  type ContentLogRow,
  type EngineAction,
  type Finding,
  type Ladder,
  type LadderRow,
  type MetricsPoint,
  type MonitorsRow,
  type ProfileFields,
  type ProfileReadiness,
  type ProfileRow,
  type ProspectRow,
  type QueryChange,
  type QueryPoint,
  type QueryRow,
  type RankHistoryRow,
  type RankPoint,
  type RankingsData,
  type SearchData,
  type SiteMetricsRow,
  type SiteRow as DtSiteRow,
  type SiteSettingsData,
  type TechnicalData,
  type TrackerSnapshot,
  type TrackingConnection,
  type TrackedKeyword,
  type TrendPoint,
  type TrendRow,
  type MonitorSettings,
} from '@seo/shared';
import type { OrgRow, SiteRow } from '../db/schema';
import { siteRows } from '../n8n/client';
import { callbackUrl, latestReport, reportsList } from './runs';

// Dashboards: the n8n Data Tables of one domain (filtered server-side by `domain`), shaped for the client. JSON columns are parsed
// here; the richer weekly reports (daily series, the question grid, the engine's own actions) come from the latest callback stored
// in the app's reports table.

type P = Record<string, unknown>;
const n = (v: unknown): number => {
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
};
const nn = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : null;
};
const s = (v: unknown): string => (v == null ? '' : String(v));
const b = (v: unknown): boolean => v === true || v === 'true' || v === 1;
const o = (v: unknown): P => (v && typeof v === 'object' && !Array.isArray(v) ? (v as P) : {});
const arr = <T = P>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const byDate = <T>(get: (x: T) => string) => (a: T, c: T) => get(a).localeCompare(get(c));
/** One row per key: the one checked last (rows carry checked_at). */
function latestPer<T extends { checked_at: string }>(rows: T[], key: (r: T) => string): T[] {
  const m = new Map<string, T>();
  for (const r of rows) {
    const k = key(r);
    const cur = m.get(k);
    if (!cur || s(r.checked_at) > s(cur.checked_at)) m.set(k, r);
  }
  return [...m.values()];
}

// ---------------- site connection ----------------

export async function n8nSite(site: SiteRow): Promise<DtSiteRow | null> {
  const r = await siteRows<DtSiteRow>('sites', site.domain, { max: 5 });
  return r[0] ?? null;
}

function connection(row: DtSiteRow | null, org: OrgRow): TrackingConnection {
  return {
    reportsToThisApp: !!row && row.callback_url === callbackUrl(org),
    tracked: !!row,
    status: row?.status ?? null,
    gscProperty: row?.gsc_property || null,
    ga4PropertyId: row?.ga4_property_id || null,
    lastRunAt: row?.last_run_at || null,
    lastStatus: row?.last_status || null,
    keywords: splitList(row?.keywords),
  };
}

// ---------------- search & traffic ----------------

const toMetrics = (r: SiteMetricsRow): MetricsPoint => ({
  periodStart: s(r.period_start),
  periodEnd: s(r.period_end),
  checkedAt: s(r.checked_at),
  gscConnected: b(r.gsc_connected),
  ga4Connected: b(r.ga4_connected),
  clicks: n(r.clicks),
  impressions: n(r.impressions),
  ctr: n(r.ctr),
  position: n(r.position),
  prevClicks: n(r.prev_clicks),
  prevImpressions: n(r.prev_impressions),
  prevCtr: n(r.prev_ctr),
  prevPosition: n(r.prev_position),
  yoyClicks: n(r.yoy_clicks),
  yoyImpressions: n(r.yoy_impressions),
  sessions: n(r.sessions),
  engagedSessions: n(r.engaged_sessions),
  keyEvents: n(r.key_events),
  prevSessions: n(r.prev_sessions),
  prevEngagedSessions: n(r.prev_engaged_sessions),
  prevKeyEvents: n(r.prev_key_events),
  organicShare: n(r.organic_share),
  queries: n(r.queries),
  striking: n(r.striking),
  alerts: splitList(r.alerts),
});

const toQuery = (r: QueryRow): QueryPoint => ({
  query: s(r.query),
  periodEnd: s(r.period_end),
  clicks: n(r.clicks),
  impressions: n(r.impressions),
  ctr: n(r.ctr),
  position: n(r.position),
  prevClicks: n(r.prev_clicks),
  prevImpressions: n(r.prev_impressions),
  prevPosition: n(r.prev_position),
  page: s(r.page),
  tracked: b(r.tracked),
  serpPosition: r.serp_position == null ? -1 : n(r.serp_position),
});

const toTrend = (r: TrendRow): TrendPoint => ({
  keyword: s(r.keyword),
  checkedAt: s(r.checked_at),
  periodEnd: s(r.period_end),
  direction: s(r.direction),
  changePct: n(r.change_pct),
  peakDate: s(r.peak_date),
  latest: n(r.latest),
  average: n(r.average),
  rising: splitList(r.rising),
  top: splitList(r.top),
});

const toChange = (q: P): QueryChange => ({
  query: s(q.query),
  page: s(q.page),
  clicks: n(q.clicks),
  impressions: n(q.impressions),
  ctr: n(q.ctr),
  position: n(q.position),
  prevClicks: n(q.prev_clicks),
  prevImpressions: n(q.prev_impressions),
  prevPosition: n(q.prev_position),
  clicksDelta: nn(q.clicks_delta),
  positionDelta: nn(q.position_delta),
});

export function engineActions(list: unknown, source: EngineAction['source'], receivedAt: string): EngineAction[] {
  return arr(list)
    .filter((a) => a && typeof a === 'object' && (a.action || a.text))
    .map((a) => ({
      source,
      priority: n(a.priority) || 2,
      type: s(a.type) || 'action',
      action: s(a.action || a.text),
      why: s(a.why),
      keyword: s(a.keyword) || null,
      url: s(a.url) || null,
      receivedAt,
      apiBody: a.api_body && typeof a.api_body === 'object' ? (a.api_body as Record<string, unknown>) : null,
    }));
}

const totals = (t: unknown) => {
  const x = o(t);
  return Object.keys(x).length ? { clicks: n(x.clicks), impressions: n(x.impressions), ctr: n(x.ctr), position: n(x.position) } : null;
};
const ga4Block = (t: unknown) => {
  const x = o(t);
  return Object.keys(x).length ? { sessions: n(x.sessions), engaged: n(x.engaged), keyEvents: n(x.key_events), users: n(x.users) } : null;
};

export async function trackerSnapshot(org: OrgRow, site: SiteRow): Promise<TrackerSnapshot | null> {
  const latest = await latestReport(org.id, site.id, ['site_tracker']);
  if (!latest) return null;
  const p = latest.payload;
  const g = o(p.gsc);
  const a = o(p.ga4);
  const per = o(p.period);
  const cur = o(per.current);
  const prev = o(per.previous);
  return {
    reportId: latest.report.id,
    receivedAt: latest.report.receivedAt,
    period: cur.start ? { current: { start: s(cur.start), end: s(cur.end) }, previous: { start: s(prev.start), end: s(prev.end) } } : null,
    gsc: {
      connected: b(g.connected),
      property: s(g.property) || null,
      error: s(g.error) || null,
      current: totals(o(g.totals).cur),
      previous: totals(o(g.totals).prev),
      deltas: {
        clicksPct: nn(o(g.deltas).clicks_pct),
        impressionsPct: nn(o(g.deltas).impressions_pct),
        position: nn(o(g.deltas).position),
        ctrPts: nn(o(g.deltas).ctr_pts),
      },
      daily: arr(g.daily).map((d) => ({ date: s(d.date), clicks: n(d.clicks), impressions: n(d.impressions), position: n(d.position) })),
      winners: arr(g.winners).map(toChange),
      losers: arr(g.losers).map(toChange),
      newQueries: arr(g.new_queries).map(toChange),
      lostQueries: arr(g.lost_queries).map(toChange),
    },
    ga4: {
      connected: b(a.connected),
      propertyId: s(a.property_id) || null,
      organic: ga4Block(o(a.organic).cur),
      organicPrev: ga4Block(o(a.organic).prev),
      total: ga4Block(o(a.total).cur),
      totalPrev: ga4Block(o(a.total).prev),
      organicShare: nn(a.organic_share),
      channels: arr(a.channels).map((c) => ({ channel: s(c.channel), sessions: n(c.sessions), keyEvents: n(c.key_events) })),
      landing: arr(a.landing).map((l) => ({ page: s(l.page), sessions: n(l.sessions), prevSessions: n(l.prev_sessions), engaged: n(l.engaged), keyEvents: n(l.key_events), delta: n(l.delta) })),
      daily: arr(a.daily).map((d) => ({ date: s(d.date), sessions: n(d.sessions), engaged: n(d.engaged), keyEvents: n(d.key_events) })),
    },
    brief: p.brief && typeof p.brief === 'object' ? (p.brief as TrackerSnapshot['brief']) : null,
    actions: engineActions(p.actions, 'site_tracker', latest.report.receivedAt),
  };
}

export async function searchData(org: OrgRow, site: SiteRow): Promise<SearchData> {
  const d = site.domain;
  const [siteRow, metrics, queries, trends, snapshot] = await Promise.all([
    n8nSite(site),
    siteRows<SiteMetricsRow>('siteMetrics', d, { sortBy: 'period_end:asc', max: 300 }),
    siteRows<QueryRow>('queryHistory', d, { sortBy: 'period_end:desc', max: 4000 }),
    siteRows<TrendRow>('trends', d, { sortBy: 'checked_at:desc', max: 300 }),
    trackerSnapshot(org, site),
  ]);
  const seen = new Set<string>();
  const latestTrends = trends.filter((t) => (seen.has(t.keyword) ? false : (seen.add(t.keyword), true))).map(toTrend);
  // the Site Tracker inserts a row per run: a re-run for the same period stores the period again — keep the newest check
  const qs = latestPer(queries, (q) => `${s(q.query).toLowerCase()}|${s(q.period_end)}`);
  const ms = latestPer(metrics, (m) => s(m.period_end)).sort(byDate((m) => s(m.period_end)));
  const periods = [...new Set(qs.map((q) => s(q.period_end)))].filter(Boolean).sort().reverse();
  return { connection: connection(siteRow, org), snapshot, metrics: ms.map(toMetrics), queries: qs.map(toQuery), periods, trends: latestTrends };
}

// ---------------- rankings ----------------

export function rankSeries(rows: RankHistoryRow[]): { history: RankPoint[]; latest: number | null; previous: number | null; best: number | null; lastChecked: string | null } {
  const history = rows
    .slice()
    .sort(byDate((r) => s(r.checked_at)))
    .map((r) => ({ checkedAt: s(r.checked_at), position: n(r.position) }));
  const ok = history.filter((h) => h.position >= 0); // -1 = the check failed: check again, not "does not rank"
  const pos = ok.filter((h) => h.position > 0).map((h) => h.position);
  return {
    history,
    latest: ok.length ? ok[ok.length - 1].position : null,
    previous: ok.length > 1 ? ok[ok.length - 2].position : null,
    best: pos.length ? Math.min(...pos) : null,
    lastChecked: history.length ? history[history.length - 1].checkedAt : null,
  };
}

export async function rankingsData(site: SiteRow): Promise<RankingsData> {
  const d = site.domain;
  const [ladderRows, history] = await Promise.all([
    siteRows<LadderRow>('ladders', d, { max: 1000 }),
    siteRows<RankHistoryRow>('rankHistory', d, { sortBy: 'checked_at:asc', max: 5000 }),
  ]);
  const histBy = new Map<string, RankHistoryRow[]>();
  for (const h of history) {
    const k = `${h.ladder_id}|${s(h.keyword).toLowerCase()}`;
    const l = histBy.get(k) ?? [];
    l.push(h);
    histBy.set(k, l);
  }
  const ladders = new Map<string, LadderRow[]>();
  for (const r of ladderRows) {
    const l = ladders.get(r.ladder_id) ?? [];
    l.push(r);
    ladders.set(r.ladder_id, l);
  }
  const out: Ladder[] = [...ladders.entries()].map(([id, rs]) => {
    const rungs = rs
      .slice()
      .sort((a, c) => n(a.rung) - n(c.rung) || n(a.page_no) - n(c.page_no))
      .map((r) => {
        const series = rankSeries(histBy.get(`${id}|${s(r.keyword).toLowerCase()}`) ?? []);
        return {
          rung: n(r.rung),
          pageNo: n(r.page_no),
          keyword: s(r.keyword),
          supporting: splitList(r.supporting),
          pageType: s(r.page_type),
          targetUrl: s(r.target_url),
          pageExists: b(r.page_exists),
          status: s(r.status) || 'planned',
          months: s(r.months),
          latestPosition: series.latest,
          previousPosition: series.previous,
          bestPosition: series.best,
          lastChecked: series.lastChecked,
          history: series.history,
        };
      });
    const first = rs[0];
    return {
      ladderId: id,
      headKeyword: s(first.head_keyword),
      country: s(first.country),
      startDate: s(first.start_date),
      pages: rungs.length,
      published: rungs.filter((r) => r.status === 'published' || r.pageExists).length,
      rungs,
    };
  });
  out.sort((a, c) => c.startDate.localeCompare(a.startDate));

  // Site Tracker live checks are stored with the site id as ladder_id
  const ladderIds = new Set(ladders.keys());
  const siteKw = new Map<string, RankHistoryRow[]>();
  for (const h of history) {
    if (ladderIds.has(h.ladder_id)) continue;
    const k = s(h.keyword).toLowerCase();
    const l = siteKw.get(k) ?? [];
    l.push(h);
    siteKw.set(k, l);
  }
  for (const k of site.keywords) if (!siteKw.has(k.toLowerCase())) siteKw.set(k.toLowerCase(), []);
  const keywords: TrackedKeyword[] = [...siteKw.entries()].map(([kw, rs]) => {
    const series = rankSeries(rs);
    const last = rs[rs.length - 1];
    return {
      keyword: kw,
      url: s(last?.url),
      serpFeatures: splitList(last?.serp_features),
      latestPosition: series.latest,
      previousPosition: series.previous,
      bestPosition: series.best,
      lastChecked: series.lastChecked,
      history: series.history,
    };
  });
  keywords.sort((a, c) => (a.latestPosition || 999) - (c.latestPosition || 999));
  return { ladders: out, keywords };
}

// ---------------- content & profile ----------------

const ISO_TO_COUNTRY = new Map<string, string>(COUNTRIES.map((c) => [c.iso, c.name]));

export function profileFromRow(r: ProfileRow | null | undefined): ProfileFields | null {
  if (!r) return null;
  const country = ISO_TO_COUNTRY.get(s(r.country_code).toUpperCase()) ?? '';
  return {
    author: {
      name: s(r.author_name),
      jobTitle: s(r.author_job_title),
      credentials: s(r.author_credentials),
      bio: s(r.author_bio),
      url: s(r.author_url),
      sameAs: s(r.author_same_as).split(/\s+/).filter((u) => /^https?:\/\//.test(u)),
      imageUrl: s(r.author_image_url),
      knowsAbout: splitList(r.author_knows_about),
    },
    reviewer: { name: s(r.reviewer_name), jobTitle: s(r.reviewer_job_title), url: s(r.reviewer_url) },
    businessName: s(r.business_name),
    businessType: s(r.business_type),
    address: { street: s(r.street_address), city: s(r.city), region: s(r.region), postalCode: s(r.postal_code), country: country as ProfileFields['address']['country'] },
    phone: s(r.phone),
    publicEmail: s(r.public_email),
    openingHours: s(r.opening_hours),
    serviceAreas: splitList(r.service_areas),
    mapUrl: s(r.map_url),
    logoUrl: s(r.logo_url),
  };
}

export const readiness = (p: ProfileFields | null): ProfileReadiness => profileReadiness(p);

export async function contentData(org: OrgRow, site: SiteRow): Promise<ContentData> {
  const d = site.domain;
  const [log, cadence, cases, profiles, generated] = await Promise.all([
    siteRows<ContentLogRow>('contentLog', d, { sortBy: 'started_at:desc', max: 1000 }),
    siteRows<CadenceRow>('cadence', d, { max: 5 }),
    siteRows<CaseStudyRow>('caseStudies', d, { sortBy: 'created_at:desc', max: 200 }),
    siteRows<ProfileRow>('profiles', d, { max: 5 }),
    reportsList(org.id, { siteId: site.id, stages: ['content'], limit: 40 }),
  ]);
  const profile = profileFromRow(profiles[0]);
  return {
    items: log.map((r) => ({
      keyword: s(r.keyword),
      source: s(r.source),
      pageType: s(r.page_type),
      rung: n(r.rung),
      ladderId: s(r.ladder_id),
      requestId: s(r.request_id),
      startedAt: s(r.started_at),
      status: s(r.status),
      publishedUrl: s(r.published_url),
      publishedAt: s(r.published_at),
      week: s(r.week),
      existingPageUrl: s(r.existing_page_url),
    })),
    cadence: cadence[0] ? { pagesPerWeek: n(cadence[0].pages_per_week), status: s(cadence[0].status) } : null,
    caseStudies: cases.map((c) => ({
      caseId: s(c.case_id),
      title: s(c.title),
      clientName: s(c.client_name),
      clientPublic: b(c.client_public),
      industry: s(c.industry),
      service: s(c.service),
      results: s(c.results),
      status: s(c.status),
      pageUrl: s(c.page_url),
      createdAt: s(c.created_at),
      keyword: s(c.keyword),
    })),
    profile,
    readiness: readiness(profile),
    generated,
  };
}

// ---------------- technical ----------------

const toAudit = (r: AuditRow): AuditPoint => ({
  auditId: s(r.audit_id),
  auditedAt: s(r.audited_at),
  reportType: s(r.report_type),
  healthScore: n(r.health_score),
  grade: s(r.grade),
  pagesCrawled: n(r.pages_crawled),
  findings: n(r.findings),
  critical: n(r.critical),
  high: n(r.high),
  medium: n(r.medium),
  low: n(r.low),
  scheduled: b(r.scheduled),
});

export async function technicalData(org: OrgRow, site: SiteRow, auditId?: string): Promise<TechnicalData> {
  const d = site.domain;
  const [audits, reports] = await Promise.all([
    siteRows<AuditRow>('audits', d, { sortBy: 'audited_at:asc', max: 500 }),
    reportsList(org.id, { siteId: site.id, stages: ['site_audit', 'full_report'], limit: 12 }),
  ]);
  const points = audits.map(toAudit);
  const idx = auditId ? points.findIndex((a) => a.auditId === auditId) : points.length - 1;
  const selected = idx >= 0 ? points[idx] : null;
  const previous = idx > 0 ? points[idx - 1] : null;
  const [cur, prev] = await Promise.all([
    selected ? siteRows<AuditFindingRow>('auditFindings', d, { extra: [{ columnName: 'audit_id', condition: 'eq', value: selected.auditId }], max: 1000 }) : Promise.resolve([]),
    previous ? siteRows<AuditFindingRow>('auditFindings', d, { extra: [{ columnName: 'audit_id', condition: 'eq', value: previous.auditId }], max: 1000 }) : Promise.resolve([]),
  ]);
  const prevBy = new Map(prev.map((f) => [f.finding_key, f]));
  const curKeys = new Set(cur.map((f) => f.finding_key));
  const findings: Finding[] = [
    ...cur.map((f) => ({
      key: s(f.finding_key),
      category: s(f.category),
      severity: s(f.severity),
      title: s(f.title),
      affectedCount: n(f.affected_count),
      previousCount: prevBy.has(f.finding_key) ? n(prevBy.get(f.finding_key)!.affected_count) : null,
      status: (previous ? (prevBy.has(f.finding_key) ? 'open' : 'new') : 'open') as Finding['status'],
    })),
    ...prev
      .filter((f) => !curKeys.has(f.finding_key))
      .map((f) => ({ key: s(f.finding_key), category: s(f.category), severity: s(f.severity), title: s(f.title), affectedCount: 0, previousCount: n(f.affected_count), status: 'fixed' as const })),
  ];
  const sevRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  findings.sort((a, c) => (sevRank[a.severity.toLowerCase()] ?? 5) - (sevRank[c.severity.toLowerCase()] ?? 5) || c.affectedCount - a.affectedCount);
  const cats = new Map<string, { category: string; critical: number; high: number; medium: number; low: number }>();
  for (const f of findings) {
    if (f.status === 'fixed') continue;
    const c = cats.get(f.category) ?? { category: f.category, critical: 0, high: 0, medium: 0, low: 0 };
    const k = f.severity.toLowerCase() as 'critical' | 'high' | 'medium' | 'low';
    if (k in c) c[k] += 1;
    cats.set(f.category, c);
  }
  return {
    audits: points,
    selectedAuditId: selected?.auditId ?? null,
    previousAuditId: previous?.auditId ?? null,
    findings,
    byCategory: [...cats.values()].sort((a, c) => c.critical * 100 + c.high * 10 + c.medium - (a.critical * 100 + a.high * 10 + a.medium)),
    reports,
  };
}

// ---------------- AI visibility ----------------

const toAiRun = (r: AiVisibilityRow): AiRun => ({
  runId: s(r.run_id),
  checkedAt: s(r.checked_at),
  prompts: n(r.prompts),
  answers: n(r.answers),
  mentionRate: n(r.mention_rate),
  citationRate: n(r.citation_rate),
  shareOfVoice: n(r.share_of_voice),
  avgRank: n(r.avg_rank),
  aioPresence: n(r.aio_presence),
  aioCitationRate: n(r.aio_citation_rate),
  costUsd: n(r.cost_usd),
  alerts: splitList(r.alerts),
  runKind: s(r.run_kind),
  samples: n(r.samples) || n(r.answers),
  visibilityScore: nn(r.visibility_score),
  mentionLo: nn(r.mention_lo),
  mentionHi: nn(r.mention_hi),
  sentimentScore: nn(r.sentiment_score),
  accuracyIssues: n(r.accuracy_issues),
  aiSessions: nn(r.ai_sessions),
  aiConversions: nn(r.ai_conversions),
  aiRevenue: nn(r.ai_revenue),
  indexSov: nn(r.index_sov),
  aiImpressions: nn(r.ai_impressions),
});

const ci = (v: unknown): [number, number] | null => (Array.isArray(v) && v.length === 2 ? [n(v[0]), n(v[1])] : null);
const toGroup = (g: P): AiGroup => ({ key: s(g.key), questions: n(g.questions), volume: n(g.volume), samples: n(g.samples), mentionRate: n(g.mention_rate), leader: s(g.leader) });

function toTraffic(t: P | null): AiTraffic | null {
  if (!t || !Object.keys(t).length) return null;
  const period = o(t.period);
  return {
    connected: b(t.connected),
    error: t.error ? s(t.error) : null,
    period: period.start ? { start: s(period.start), end: s(period.end) } : null,
    sessions: n(t.sessions),
    engaged: n(t.engaged),
    keyEvents: n(t.key_events),
    revenue: n(t.revenue),
    prevSessions: n(t.prev_sessions),
    changePct: nn(t.change_pct),
    shareOfSessions: n(t.share_of_sessions),
    convRate: n(t.conv_rate),
    organicConvRate: n(t.organic_conv_rate),
    assistants: arr(t.assistants).map((a) => ({ name: s(a.name), sessions: n(a.sessions), prevSessions: n(a.prev_sessions), engaged: n(a.engaged), keyEvents: n(a.key_events), revenue: n(a.revenue) })),
    landing: arr(t.landing).map((l) => ({ page: s(l.page), sessions: n(l.sessions), keyEvents: n(l.key_events), revenue: n(l.revenue), citedByAi: b(l.cited_by_ai) })),
    weekly: arr(t.weekly).map((w) => ({ week: s(w.week), sessions: n(w.sessions), keyEvents: n(w.key_events), revenue: n(w.revenue) })),
  };
}

function toAccess(a: P | null): AiAccess | null {
  if (!a || !Object.keys(a).length) return null;
  const tests = arr(o(a.fetch).tests);
  return {
    checkedAt: s(a.checked_at),
    ok: b(a.ok),
    robotsFound: b(o(a.robots).found),
    llmsTxt: b(o(a.llms_txt).found),
    bots: arr(a.bots).map((x) => {
      const t = tests.find((y) => s(y.bot) === s(x.bot));
      return { bot: s(x.bot), owner: s(x.owner), group: s(x.group) === 'training' ? 'training' : 'answer', allowed: b(x.allowed), rule: s(x.rule), blockedPaths: arr<string>(x.blocked_paths).map(String), fetchStatus: t ? n(t.status) : null, fetchBlocked: t ? b(t.blocked) : false };
    }),
    issues: arr(a.issues).map((i) => ({ level: s(i.level), bot: s(i.bot), text: s(i.text), fix: s(i.fix) })),
  };
}

function toPerception(p: P | null): AiPerception | null {
  if (!p || !Object.keys(p).length) return null;
  return {
    analysed: n(p.analysed),
    positive: n(p.positive),
    neutral: n(p.neutral),
    negative: n(p.negative),
    score: nn(p.score),
    descriptors: arr<string>(p.descriptors).map(String),
    negatives: arr(p.negatives).map((x) => ({ engine: s(x.engine), prompt: s(x.prompt), excerpt: s(x.excerpt) })),
    issues: arr(p.issues).map((x) => ({ text: s(x.text), engines: arr<string>(x.engines).map(String), questions: arr<string>(x.questions).map(String), new: b(x.new) })),
  };
}

function toIndex(x: P | null): AiIndex | null {
  if (!x || !Object.keys(x).length) return null;
  const d = o(x.demand);
  return {
    checkedAt: s(x.checked_at),
    carried: b(x.carried),
    platforms: arr<string>(x.platforms).map(String),
    sov: nn(x.sov),
    answersCitingYou: n(x.answers_citing_you),
    brands: arr(x.brands).map((y) => ({ key: s(y.key), label: s(y.domain) || (y.name ? `“${s(y.name)}” by name` : s(y.key)), you: b(y.you), mentions: n(y.mentions), aiSearchVolume: n(y.ai_search_volume), share: nn(y.share) })),
    questions: arr(x.questions).map((q) => ({ question: s(q.question), volume: n(q.volume), platform: s(q.platform) })),
    suggestions: arr(x.suggestions).map((q) => ({ question: s(q.question), volume: n(q.volume), platform: s(q.platform), youCited: b(q.you_cited) })),
    fanout: arr(x.fanout).map((f) => ({ query: s(f.query), count: n(f.count), engines: arr<string>(f.engines).map(String), questions: arr<string>(f.questions).map(String) })),
    demand: { total: n(d.total), named: n(d.named), lost: n(d.lost) },
  };
}

export async function aiData(org: OrgRow, site: SiteRow): Promise<AiData> {
  const d = site.domain;
  const since = new Date(Date.now() - 90 * 864e5).toISOString();
  const [vis, prompts, report, days] = await Promise.all([
    siteRows<AiVisibilityRow>('aiVisibility', d, { sortBy: 'checked_at:asc', max: 300 }),
    siteRows<AiPromptRow>('aiPrompts', d, { max: 300 }),
    latestReport(org.id, site.id, ['ai_visibility']),
    siteRows<AiDailyRow>('aiDaily', d, { sortBy: 'date:asc', max: 120, extra: [{ columnName: 'checked_at', condition: 'gte', value: since }] }),
  ]);
  const last = vis[vis.length - 1];
  // n8n's run id is per day (ai_YYYYMMDD_domain): a second run that day shares it, so only the answers of the latest run count
  const answers = last
    ? (await siteRows<AiAnswerRow>('aiAnswers', d, { extra: [{ columnName: 'run_id', condition: 'eq', value: last.run_id }], max: 1000 })).filter((a) => s(a.checked_at) >= s(last.checked_at))
    : [];
  let latest: AiData['latest'] = null;
  if (last) {
    const engines = safeJson<Record<string, P>>(last.engines_json, {});
    const market = safeJson<P | null>(last.market_json, null);
    const clusters = safeJson<P>(last.clusters_json, {});
    const marketTop = market ? arr(market.top) : [];
    // n8n stores the business's place in the market list as a number (1-based; null = not listed)
    const youAt = market ? nn(market.you) : null;
    const youRow = youAt && youAt > 0 ? marketTop[youAt - 1] : market && market.you && typeof market.you === 'object' ? o(market.you) : null;
    latest = {
      runId: s(last.run_id),
      engines: Object.entries(engines).map(
        ([key, e]): AiEngineStat => ({
          key,
          name: s(e.name) || key,
          asked: n(e.asked),
          answered: n(e.answered),
          mentioned: n(e.mentioned),
          cited: n(e.cited),
          mentionRate: n(e.mention_rate),
          citationRate: n(e.citation_rate),
          errors: n(e.errors),
          knowsBrand: e.knows_brand == null ? null : b(e.knows_brand),
          carried: b(e.carried),
          samples: e.samples == null ? n(e.answered) : n(e.samples),
          pulseSamples: n(e.pulse_samples),
          ci: ci(e.ci),
          sentiment: nn(e.sentiment),
        }),
      ),
      competitors: arr(safeJson(last.competitors_json, [])).map((c) => ({ domain: s(c.domain), mentions: n(c.mentions), share: n(c.share), auto: b(c.auto) })),
      sources: arr(safeJson(last.sources_json, [])).map((x) => ({ domain: s(x.domain), citations: n(x.citations), engines: arr<string>(x.engines).map(String), topics: arr<string>(x.topics).map(String), kind: s(x.kind) })),
      pages: arr(safeJson(last.pages_json, [])).map((x) => ({ url: s(x.url), citations: n(x.citations), engines: arr<string>(x.engines).map(String) })),
      gaps: arr(safeJson(last.gaps_json, [])).map((g) => ({ prompt: s(g.prompt), competitors: arr<string>(g.competitors).map(String), sources: arr<string>(g.sources).map(String), volume: nn(g.volume), stage: s(g.stage), cluster: s(g.cluster), fanout: arr<string>(g.fanout).map(String) })),
      traffic: toTraffic(safeJson<P | null>(last.traffic_json, null)),
      access: toAccess(safeJson<P | null>(last.access_json, null)),
      perception: toPerception(safeJson<P | null>(last.perception_json, null)),
      index: toIndex(safeJson<P | null>(last.index_json, null)),
      stages: arr(clusters.stages).map(toGroup),
      clusters: arr(clusters.clusters).map(toGroup),
      market:
        market && Object.keys(market).length
          ? {
              keyword: s(market.keyword),
              checkedAt: s(market.checked_at),
              totalMentions: n(market.total_mentions),
              aiSearchVolume: n(market.ai_search_volume),
              top: marketTop.map((t) => ({ domain: s(t.domain), mentions: n(t.mentions), aiSearchVolume: n(t.ai_search_volume) })),
              you: youRow ? { mentions: n(youRow.mentions), aiSearchVolume: n(youRow.ai_search_volume) } : null,
            }
          : null,
    };
  }
  const rp = report?.payload;
  return {
    runs: vis.map(toAiRun),
    latest,
    daily: days
      .filter((x) => n(x.samples) > 0)
      .map((x) => ({ date: s(x.date), samples: n(x.samples), mentionRate: n(x.mention_rate), citationRate: n(x.citation_rate), shareOfVoice: n(x.share_of_voice), visibilityScore: n(x.visibility_score), alerts: splitList(x.alerts) })),
    prompts: prompts.map((p) => ({
      promptId: s(p.prompt_id),
      prompt: s(p.prompt),
      kind: s(p.kind),
      topic: s(p.topic),
      keyword: s(p.keyword),
      source: s(p.source),
      status: s(p.status),
      createdAt: s(p.created_at),
      stage: s(p.stage),
      cluster: s(p.cluster) || s(p.topic),
      volume: nn(p.volume),
      origin: s(p.origin),
    })),
    answers: answers.map((a) => ({
      promptId: s(a.prompt_id),
      prompt: s(a.prompt),
      kind: s(a.kind),
      topic: s(a.topic),
      engine: s(a.engine),
      answered: b(a.answered),
      mentioned: b(a.mentioned),
      cited: b(a.cited),
      rank: n(a.rank),
      ourUrls: splitList(a.our_urls),
      competitors: splitList(a.competitors),
      sources: splitList(a.sources),
      excerpt: s(a.excerpt),
      error: s(a.error),
      checkedAt: s(a.checked_at),
      runKind: s(a.run_kind),
      sentiment: s(a.sentiment),
      brands: splitList(a.brands),
      issues: s(a.issues).split(' | ').filter(Boolean),
      fanout: s(a.fanout).split(' | ').filter(Boolean),
    })),
    report: rp
      ? {
          receivedAt: report!.report.receivedAt,
          brief: rp.brief && typeof rp.brief === 'object' ? (rp.brief as { headline?: string; summary?: string }) : null,
          questions: arr(rp.questions).map((q) => ({
            promptId: s(q.prompt_id),
            prompt: s(q.prompt),
            kind: s(q.kind),
            topic: s(q.topic),
            won: b(q.won),
            engines: Object.fromEntries(Object.entries(o(q.engines)).map(([k, v]) => [k, s(v)])),
            competitors: arr<string>(q.competitors).map(String),
            sources: arr<string>(q.sources).map(String),
            stage: s(q.stage),
            volume: nn(q.volume),
            winRate: nn(q.win_rate),
            samples: n(q.samples),
          })),
          actions: engineActions(rp.actions, 'ai_visibility', report!.report.receivedAt),
        }
      : null,
  };
}

// ---------------- backlinks ----------------

const toLink = (l: P): BacklinkLink => ({
  fromDomain: s(l.from_domain || l.domain),
  fromUrl: s(l.from_url || l.url_from),
  toUrl: s(l.to_url || l.url_to),
  anchor: s(l.anchor),
  dofollow: l.dofollow == null ? true : b(l.dofollow),
  domainRank: n(l.domain_rank ?? l.rank),
  spam: n(l.spam ?? l.spam_score),
  firstSeen: s(l.first_seen),
  lastSeen: s(l.last_seen),
  title: s(l.title),
});

const toSnapshot = (r: BacklinkSnapshotRow): BacklinkSnapshot => ({
  checkedAt: s(r.checked_at),
  mode: s(r.mode),
  rank: n(r.rank),
  backlinks: n(r.backlinks),
  referringDomains: n(r.referring_domains),
  referringDomainsNofollow: n(r.referring_domains_nofollow),
  spamScore: n(r.spam_score),
  brokenBacklinks: n(r.broken_backlinks),
  newLinks: n(r.new_links),
  lostLinks: n(r.lost_links),
  importantLost: n(r.important_lost),
  spammyNew: n(r.spammy_new),
  costUsd: n(r.cost_usd),
  unionDomains: nn(r.union_domains),
  bestLinks: nn(r.best_links),
  verifiedLive: nn(r.verified_live),
  atRisk: nn(r.at_risk),
  confirmedLost: nn(r.confirmed_lost),
  referralVisits: nn(r.referral_visits),
});

const toRef = (r: BacklinkRow): BacklinkRef => ({
  refDomain: s(r.ref_domain),
  kind: s(r.kind) || 'web',
  fromUrl: s(r.from_url),
  toUrl: s(r.to_url),
  anchor: s(r.anchor),
  anchorKind: s(r.anchor_kind),
  rel: s(r.rel),
  placement: s(r.placement),
  linkType: s(r.link_type),
  relevance: nn(r.relevance),
  note: s(r.note),
  sources: s(r.sources).split(',').map((x) => x.trim()).filter(Boolean),
  firstSeen: s(r.first_seen),
  lastSeen: s(r.last_seen),
  status: s(r.status) || 'live',
  lostAt: s(r.lost_at),
  lostReason: s(r.lost_reason),
  verify: s(r.verify) || 'unchecked',
  verifiedAt: s(r.verified_at),
  noindex: b(r.noindex),
  pageTitle: s(r.page_title),
  context: s(r.context),
  authority: n(r.authority),
  dr: n(r.dr) > 0 ? n(r.dr) : null,
  ccRank: n(r.cc_rank) > 0 ? n(r.cc_rank) : null,
  pageKeywords: n(r.page_keywords),
  spamScore: n(r.spam_score),
  original: !(r.original === false || (r.original as unknown) === 'false'),
  visits: n(r.visits),
  keyEvents: n(r.key_events),
  aiCited: b(r.ai_cited),
  seoValue: n(r.seo_value),
  referralValue: n(r.referral_value),
  brandValue: n(r.brand_value),
});

const toCoverage = (c: P | null): BacklinkCoverage | null => {
  if (!c || typeof c !== 'object' || c.union == null) return null;
  const st = (c.status ?? null) as P | null;
  const num = (o: unknown) => Object.fromEntries(Object.entries((o ?? {}) as P).map(([k, v]) => [k, n(v)]));
  const sub = (k: string) => ((st?.[k] ?? {}) as P);
  return {
    union: n(c.union),
    social: n(c.social),
    perSource: num(c.per_source),
    onlyIn: num(c.only_in),
    dfsShare: n(c.dfs_share),
    gscSample: n(c.gsc_sample),
    dfsSeesGoogle: nn(c.dfs_sees_google),
    allSeeGoogle: nn(c.all_see_google),
    verified: n(c.verified),
    checkedNow: n(c.checked_now),
    blocked: n(c.blocked),
    status: st
      ? {
          bing: { enabled: b(sub('bing').enabled), connected: b(sub('bing').connected), inAccount: sub('bing').in_account == null ? null : b(sub('bing').in_account), error: s(sub('bing').error), pages: n(sub('bing').pages), links: n(sub('bing').links) },
          gsc: { rows: n(sub('gsc').rows), domains: n(sub('gsc').domains), uploadedAt: s(sub('gsc').uploaded_at) },
          ga4: { connected: b(sub('ga4').connected), error: s(sub('ga4').error), property: s(sub('ga4').property), sources: n(sub('ga4').sources), visits: n(sub('ga4').visits), excluded: arr<string>(sub('ga4').excluded).map(String) },
          cc: { release: s(sub('cc').release), links: n(sub('cc').links), checkedAt: s(sub('cc').checked_at) },
          wiki: { pages: n(sub('wiki').pages) },
          hn: { stories: n(sub('hn').stories) },
        }
      : null,
  };
};

export async function backlinksData(org: OrgRow, site: SiteRow): Promise<BacklinksData> {
  const d = site.domain;
  const [snaps, prospects, report, refs, imports, graphSummary] = await Promise.all([
    siteRows<BacklinkSnapshotRow>('backlinkSnapshots', d, { sortBy: 'checked_at:asc', max: 300 }),
    siteRows<ProspectRow>('prospects', d, { max: 1000 }),
    latestReport(org.id, site.id, ['backlinks']),
    siteRows<BacklinkRow>('backlinks', d, { max: 3000 }),
    siteRows<LinkImportRow>('linkImports', d, { max: 20000 }),
    siteRows<LinkGraphRow>('linkGraph', d, { extra: [{ columnName: 'kind', condition: 'eq', value: 'summary' }], max: 20 }),
  ]);
  const last = snaps[snaps.length - 1];
  const rp = report?.payload;
  const fileId = (needle: string) => report?.report.files.find((f) => f.field.includes(needle) || f.fileName.includes(needle))?.id ?? null;
  const values = last ? safeJson<P>(last.values_json, {}) : {};
  const anchors = last ? safeJson<P | null>(last.anchors_json, null) : null;
  // the latest upload of each kind (the monitor uses the same rule)
  const latestAt = new Map<string, string>();
  for (const r of imports) if (s(r.imported_at) > (latestAt.get(s(r.source)) ?? '')) latestAt.set(s(r.source), s(r.imported_at));
  const graphRow = graphSummary.sort((a, c) => s(c.checked_at).localeCompare(s(a.checked_at)))[0];
  return {
    snapshots: snaps.map(toSnapshot),
    latest: last
      ? {
          lost: arr(safeJson(last.lost_json, [])).map((l) => ({ ...toLink(l), reason: s(l.reason) || undefined, pending: l.pending === true ? true : undefined })),
          new: arr(safeJson(last.new_json, [])).map(toLink),
          competitors: arr(safeJson(last.competitors_json, [])).map((c) => ({ ...c, domain: s(c.domain) })),
          timeseries: arr(safeJson(last.timeseries_json, [])).map((t) => ({ month: s(t.month), backlinks: n(t.backlinks), referringDomains: n(t.referring_domains), rank: n(t.rank) })),
          coverage: toCoverage(safeJson<P | null>(last.coverage_json, null)),
          anchors: anchors
            ? {
                kinds: Object.fromEntries(Object.entries((anchors.kinds ?? {}) as P).map(([k, v]) => [k, n(v)])),
                top: arr(anchors.top).map((a) => ({ anchor: s(a.anchor), referringDomains: n(a.referring_domains), backlinks: n(a.backlinks), kind: s(a.kind) })),
              }
            : null,
          pages: arr(safeJson(last.pages_json, [])).map((x) => ({ url: s(x.url), referringDomains: n(x.referring_domains), backlinks: n(x.backlinks), status: nn(x.status) })),
          wins: arr(values.wins).map((w) => ({ refDomain: s(w.ref_domain), url: s(w.url), why: s(w.why), seo: n(w.seo), linkType: s(w.link_type) })),
          relChanged: arr(values.rel_changed).map((r) => ({ refDomain: s(r.ref_domain), url: s(r.url), rel: s(r.rel), was: s(r.was) })),
          compNew: arr(values.comp_new).map((c) => ({ domain: s(c.domain), competitor: s(c.competitor), url: s(c.url), firstSeen: s(c.first_seen), domainRank: n(c.domain_rank), title: s(c.title) })),
          lists: arr(values.lists).map((l) => ({ domain: s(l.domain), url: s(l.url), title: s(l.title), topic: s(l.topic), competitors: arr<string>(l.competitors).map(String), named: b(l.named), linked: b(l.linked) })),
        }
      : null,
    refs: refs.map(toRef).sort((a, c) => c.seoValue - a.seoValue || c.referralValue - a.referralValue),
    imports: [...latestAt].map(([source, at]) => ({ source, rows: imports.filter((r) => s(r.source) === source && s(r.imported_at) === at).length, importedAt: at })),
    linkGraph: graphRow
      ? { release: s(graphRow.release), checkedAt: s(graphRow.checked_at), counts: Object.fromEntries(s(graphRow.links_to).split(',').map((x) => x.split('=')).filter((x) => x.length === 2).map(([k, v]) => [k!, n(v)])) }
      : null,
    prospects: prospects
      .map((p) => ({
        prospectDomain: s(p.prospect_domain),
        type: s(p.type),
        rank: n(p.rank),
        spamScore: n(p.spam_score),
        detail: s(p.detail),
        sourceUrl: s(p.source_url),
        targetUrl: s(p.target_url),
        status: s(p.status) || 'new',
        firstSeen: s(p.first_seen),
        lastSeen: s(p.last_seen),
        wonAt: s(p.won_at),
        outreachSubject: s(p.outreach_subject),
        outreachBody: s(p.outreach_body),
        note: s(p.note),
        score: n(p.score),
        origin: s(p.origin),
        contactEmail: s(p.contact_email),
        contactUrl: s(p.contact_url),
        contactedAt: s(p.contacted_at),
        followupStep: n(p.followup_step),
        followupSubject: s(p.followup_subject),
        followupBody: s(p.followup_body),
        verifiedAt: s(p.verified_at),
      }))
      .sort((a, c) => c.score - a.score || c.rank - a.rank),
    report: rp
      ? {
          receivedAt: report!.report.receivedAt,
          alerts: arr(rp.alerts).map((a) => ({ level: s(a.level), text: s(a.text) })),
          gap: arr(rp.gap).map((g) => ({ domain: s(g.domain), rank: n(g.rank), spam: n(g.spam), linksTo: arr<string>(g.links_to).map(String), backlinks: n(g.backlinks), source: s(g.source) || 'dfs', ccRank: nn(g.cc_rank) })),
          spammy: arr(rp.spammy).map(toLink),
          disavowFileId: fileId('disavow'),
          prospectsCsvFileId: fileId('prospects'),
          mentions: arr(rp.mentions).map((m) => ({ domain: s(m.domain), url: s(m.url), title: s(m.title), source: s(m.source), verified: b(m.verified), context: s(m.context) })),
          atRisk: arr(rp.at_risk).map((a) => ({ refDomain: s(a.ref_domain), url: s(a.url), verify: s(a.verify) })),
          reclaim: arr(rp.reclaim).map((r) => ({ brokenUrl: s(r.broken_url), status: nn(r.status), links: n(r.links), domains: arr<string>(r.domains).map(String), redirectTo: s(r.redirect_to) })),
          drEnabled: b(rp.dr_enabled),
        }
      : null,
  };
}

// ---------------- alerts & check-ins ----------------

export async function alertsData(site: SiteRow): Promise<AlertsData> {
  const d = site.domain;
  const [alerts, checkins] = await Promise.all([
    siteRows<ConsoleAlertRow>('consoleAlerts', d, { sortBy: 'received_at:desc', max: 300 }),
    siteRows<CheckinRow>('checkins', d, { sortBy: 'month:desc', max: 60 }),
  ]);
  const month = new Date().toISOString().slice(0, 7);
  return {
    alerts: alerts.map((a) => ({ kind: s(a.kind), severity: s(a.severity), subject: s(a.subject), summary: s(a.summary), receivedAt: s(a.received_at), status: s(a.status), source: s(a.source) })),
    checkins: checkins.map((c) => {
      const cov = safeJson<P>(c.coverage_json, {});
      return {
        month: s(c.month),
        manualAction: b(c.manual_action),
        securityIssue: b(c.security_issue),
        notes: s(c.notes),
        notIndexedTotal: n(c.not_indexed_total),
        indexedTotal: nn(cov.indexed_total),
        csvKind: s(c.csv_kind),
        submittedAt: s(c.submitted_at),
      };
    }),
    checkinDue: site.trackingStatus === 'active' && !checkins.some((c) => s(c.month) === month),
  };
}

// ---------------- settings ----------------

export function monitorsFromRow(r: MonitorsRow | undefined): (MonitorSettings & { competitors: string[]; updatedAt: string }) | null {
  if (!r) return null;
  const engines = splitList(r.ai_engines) as MonitorSettings['aiEngines'];
  return {
    aiVisibility: r.ai_visibility == null ? true : b(r.ai_visibility),
    aiEngines: engines.length ? engines : ['chatgpt', 'perplexity', 'gemini', 'claude', 'ai_overview', 'ai_mode'],
    aiPromptsMax: n(r.ai_prompts_max) || 20,
    aiPulse: r.ai_pulse == null || (r.ai_pulse as unknown) === '' ? true : b(r.ai_pulse),
    backlinks: r.backlinks == null ? true : b(r.backlinks),
    auditMonthly: r.audit_monthly == null ? true : b(r.audit_monthly),
    auditPages: n(r.audit_pages) || 200,
    auditJs: b(r.audit_js),
    brandNames: splitList(r.brand_names),
    competitors: splitList(r.competitors),
    updatedAt: s(r.updated_at),
  };
}

export async function settingsData(org: OrgRow, site: SiteRow): Promise<SiteSettingsData> {
  const d = site.domain;
  const [siteRow, monitors, cadence, profiles] = await Promise.all([
    n8nSite(site),
    siteRows<MonitorsRow>('monitors', d, { max: 5 }),
    siteRows<CadenceRow>('cadence', d, { max: 5 }),
    siteRows<ProfileRow>('profiles', d, { max: 5 }),
  ]);
  const profile = profileFromRow(profiles[0]);
  return {
    tracking: connection(siteRow, org),
    monitors: monitorsFromRow(monitors[0]),
    cadence: cadence[0] ? { pagesPerWeek: n(cadence[0].pages_per_week), status: s(cadence[0].status) } : null,
    profile,
    readiness: readiness(profile),
  };
}
