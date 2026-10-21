// Dashboard payloads: what GET /api/orgs/:org/sites/:site/data/<page> returns. The server reads the n8n Data Tables
// (filtered to the site's domain), parses the JSON columns and shapes them here; the client only renders.
import type { ModeId } from './constants';
import type { MonitorSettings, ProfileFields } from './schemas';
import type { Report } from './api';
import type { ChartAnnotation } from './annotations';
import type { PageChangeTest } from './change-test';
import type { Lineage } from './lineage';
import type { RecommendationScore } from './queue';
import type { AiPanelInfo, AiSegments } from './ai-panel';

export interface MetricsPoint {
  periodStart: string;
  periodEnd: string;
  checkedAt: string;
  gscConnected: boolean;
  ga4Connected: boolean;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  prevClicks: number;
  prevImpressions: number;
  prevCtr: number;
  prevPosition: number;
  yoyClicks: number;
  yoyImpressions: number;
  sessions: number;
  engagedSessions: number;
  keyEvents: number;
  prevSessions: number;
  prevEngagedSessions: number;
  prevKeyEvents: number;
  organicShare: number;
  queries: number;
  striking: number;
  alerts: string[];
}

export interface QueryPoint {
  query: string;
  periodEnd: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  prevClicks: number;
  prevImpressions: number;
  prevPosition: number;
  page: string;
  tracked: boolean;
  /** live Google position (0 = not in the top 50, -1 = check failed / not checked) */
  serpPosition: number;
}

export interface TrendPoint {
  keyword: string;
  checkedAt: string;
  periodEnd: string;
  direction: string;
  changePct: number;
  peakDate: string;
  latest: number;
  average: number;
  rising: string[];
  top: string[];
}

export interface TrackingConnection {
  tracked: boolean;
  status: string | null;
  gscProperty: string | null;
  ga4PropertyId: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  keywords: string[];
  /** the engine's weekly reports for this site are delivered to this app (false: still to an older address, save tracking once) */
  reportsToThisApp: boolean;
}

export interface GscTotals {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface QueryChange {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  prevClicks: number;
  prevImpressions: number;
  prevPosition: number;
  clicksDelta: number | null;
  positionDelta: number | null;
}

/** An action the SEO engine itself recommends in a weekly report (with a ready-made run when it has one). */
export interface EngineAction {
  source: 'site_tracker' | 'ai_visibility' | 'backlinks' | 'rank_tracker';
  priority: number;
  type: string;
  action: string;
  why: string;
  keyword: string | null;
  url: string | null;
  receivedAt: string;
  /** API body of the run that carries the action out (snake_case, as n8n takes it) */
  apiBody: Record<string, unknown> | null;
}

/** The latest weekly Site Tracker report (richer than the stored metrics: daily series, channels, landing pages). */
export interface TrackerSnapshot {
  reportId: string;
  receivedAt: string;
  period: { current: { start: string; end: string }; previous: { start: string; end: string } } | null;
  gsc: {
    connected: boolean;
    property: string | null;
    error: string | null;
    current: GscTotals | null;
    previous: GscTotals | null;
    deltas: { clicksPct: number | null; impressionsPct: number | null; position: number | null; ctrPts: number | null };
    daily: { date: string; clicks: number; impressions: number; position: number }[];
    winners: QueryChange[];
    losers: QueryChange[];
    newQueries: QueryChange[];
    lostQueries: QueryChange[];
  };
  ga4: {
    connected: boolean;
    propertyId: string | null;
    organic: { sessions: number; engaged: number; keyEvents: number; users: number } | null;
    organicPrev: { sessions: number; engaged: number; keyEvents: number; users: number } | null;
    total: { sessions: number; engaged: number; keyEvents: number; users: number } | null;
    totalPrev: { sessions: number; engaged: number; keyEvents: number; users: number } | null;
    organicShare: number | null;
    channels: { channel: string; sessions: number; keyEvents: number }[];
    landing: { page: string; sessions: number; prevSessions: number; engaged: number; keyEvents: number; delta: number }[];
    daily: { date: string; sessions: number; engaged: number; keyEvents: number }[];
  };
  brief: { headline?: string; summary?: string } | null;
  actions: EngineAction[];
}

export interface SearchData {
  connection: TrackingConnection;
  snapshot: TrackerSnapshot | null;
  metrics: MetricsPoint[];
  queries: QueryPoint[];
  periods: string[];
  trends: TrendPoint[];
  /** G12: what to mark on the charts, pages published, audit fixes, Google updates, data breaks (oldest first) */
  annotations: ChartAnnotation[];
  /** G12: the data breaks this window straddles, so a before / after comparison can say it is not comparable */
  dataBreaks: { name: string; start: string; end: string; detail: string }[];
  /** G12: did a page change help? Each change read against the site's other pages over the same weeks */
  changeTests: PageChangeTest[];
  /** G29: where each figure on this page came from, over what period, from how big a sample */
  lineage: Lineage[];
}

export interface RankPoint {
  checkedAt: string;
  position: number;
  /** G6: our modelled share of the clicks page 1 offers at that check (null = not recorded or the check failed) */
  shareOfVoice?: number | null;
}

/**
 * G6: what one rank check's results page showed, read back from the stored row (`features_json` of `seo_rank_history`, written by
 * `v5/code/_rank_serp.js`). `null` always means "not known from this check", never "no": a check that failed claims nothing, and an
 * AI Overview Google loads asynchronously comes back without its sources, so `citesUs` is then null.
 */
export interface SerpFeatures {
  unavailable: boolean;
  checkedAt: string | null;
  aiOverview: { shown: boolean | null; citesUs: boolean | null; sourcesLoaded: boolean; citedDomains: string[] };
  featuredSnippet: { shown: boolean | null; ours: boolean | null; domain: string };
  peopleAlsoAsk: { shown: boolean | null; count: number; questions: string[] };
  localPack: { shown: boolean | null; ours: boolean | null };
  video: boolean | null;
  shopping: boolean | null;
  /** the short labels the tables show ("AI Overview (cites you)", "Snippet (yours)", "PAA", ...) */
  labels: string[];
}

/** G6: the other sites on the results page, from the same check */
export interface SerpCompetitor {
  domain: string;
  position: number | null;
  /** on the website's own competitor list (seo_monitors / the site model), not just a domain that happens to rank */
  tracked: boolean;
}

/** G6: the whole results-page reading of the latest check of one keyword */
export interface SerpReading {
  features: SerpFeatures;
  /** our modelled share of the clicks page 1 offers (null = the check failed) */
  shareOfVoice: number | null;
  /** how that share is modelled, shown wherever the number is shown; it is not measured clicks */
  method: string;
  above: SerpCompetitor[];
  competitors: SerpCompetitor[];
  /** the top 10 kept as proof of the reading */
  snapshot: { at: string | null; device: string; top: { position: number; url: string; title: string }[] };
  /** the mobile reading of the same keyword, when one was bought (the ladder's main keywords, weekly) */
  mobile: { position: number; checkedAt: string } | null;
}

export interface LadderRung {
  rung: number;
  pageNo: number;
  keyword: string;
  supporting: string[];
  pageType: string;
  targetUrl: string;
  pageExists: boolean;
  status: string;
  months: string;
  latestPosition: number | null;
  previousPosition: number | null;
  bestPosition: number | null;
  lastChecked: string | null;
  history: RankPoint[];
  /** G6: the results page of the latest check (features, competitors, share of voice, the mobile reading); absent before G6 */
  serp?: SerpReading | null;
}

export interface Ladder {
  ladderId: string;
  headKeyword: string;
  country: string;
  startDate: string;
  pages: number;
  published: number;
  rungs: LadderRung[];
}

export interface TrackedKeyword {
  keyword: string;
  url: string;
  serpFeatures: string[];
  latestPosition: number | null;
  previousPosition: number | null;
  bestPosition: number | null;
  lastChecked: string | null;
  history: RankPoint[];
  /** G6: the results page of the latest check (features, competitors, share of voice, the mobile reading); absent before G6 */
  serp?: SerpReading | null;
}

export interface RankingsData {
  ladders: Ladder[];
  keywords: TrackedKeyword[];
  /** G29: where the positions and the share of voice come from */
  lineage: Lineage[];
  /** P1 / B6 (2026-10-21): no page is written on its own before the author profile and the business facts are on file (readiness.ts);
   *  the planned rungs say so and point to where they are filled in. Absent from older servers: treated as ready. */
  readiness?: { ready: boolean; missingText: string; page: 'settings/profile' | 'settings/business' };
}

export interface ContentItem {
  keyword: string;
  source: string;
  pageType: string;
  rung: number;
  ladderId: string;
  requestId: string;
  startedAt: string;
  status: string;
  publishedUrl: string;
  publishedAt: string;
  week: string;
  existingPageUrl: string;
  /** R111: why a `not_ready` draft failed its last quality round ('; '-joined by the engine); empty on every other row */
  qaReasons?: string;
}

export interface CaseStudy {
  caseId: string;
  title: string;
  clientName: string;
  clientPublic: boolean;
  industry: string;
  service: string;
  results: string;
  status: string;
  pageUrl: string;
  createdAt: string;
  keyword: string;
}

export interface ProfileReadiness {
  score: number;
  missing: string[];
}

export interface ContentData {
  items: ContentItem[];
  cadence: { pagesPerWeek: number; status: string } | null;
  caseStudies: CaseStudy[];
  profile: ProfileFields | null;
  readiness: ProfileReadiness;
  generated: Report[];
}

export interface AuditPoint {
  auditId: string;
  auditedAt: string;
  reportType: string;
  healthScore: number;
  grade: string;
  pagesCrawled: number;
  findings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  scheduled: boolean;
}

/** `no_longer_seen`: a finding that rested on one outside reading and is not seen now - never counted as fixed (R74). */
export type FindingStatus = 'new' | 'open' | 'fixed' | 'no_longer_seen';
export interface Finding {
  key: string;
  category: string;
  severity: string;
  title: string;
  affectedCount: number;
  previousCount: number | null;
  status: FindingStatus;
  /** G26: the audit's impact weight and why it ranks where it does (null on audits written before 2026-10-12). */
  impact: number | null;
  impactBasis: string;
  /** G11: the state of a re-check the owner asked for with "I fixed this" (null when nobody asked). */
  recheck: FindingRecheck | null;
}

/** G11 (2026-10-13, FIX_PLAN): "I fixed this" asks the daily key-page watch to judge this one finding again, within a day, not at the
 *  next monthly audit. `requested` = waiting for tonight's watch; `fixed` / `still_open` = it was judged on the site's key pages;
 *  `not_checked` = the watch cannot judge it without the full audit (and says so). */
export type RecheckState = 'requested' | 'fixed' | 'still_open' | 'not_checked';
export interface FindingRecheck {
  state: RecheckState;
  requestedAt: string;
  checkedAt: string;
  /** the watch rule that judged it (empty when nothing could) */
  rule: string;
  note: string;
}

/** G11: the daily key-page watch, as the technical page shows it. */
export interface PageWatch {
  running: boolean;
  lastCheckedAt: string;
  pagesWatched: number;
  pagesNotChecked: number;
  changedLast7Days: number;
  pages: WatchedPage[];
  changes: { url: string; changes: string[]; at: string }[];
}
export interface WatchedPage {
  url: string;
  kind: string;
  checkedAt: string;
  status: number;
  noindex: boolean;
  canonical: string;
  canonicalOk: boolean;
  title: string;
  robotsBlocked: boolean;
  state: string;
  changes: string[];
  lastChangeAt: string;
  /** G25: what Search Console's URL Inspection said about this page ('' / null = not checked, never "fine") */
  inspectedAt: string;
  indexed: boolean | null;
  indexState: string;
  coverage: string;
  googleCanonical: string;
  lastCrawl: string;
  mobile: 'pass' | 'fail' | '';
  richResults: string[];
  inspectError: string;
}

/** G25: Google's own view of the key pages, with what nobody asked about counted apart. */
export interface IndexCoverage {
  checked: number;
  indexed: number;
  notIndexed: number;
  notChecked: number;
  canonicalMismatch: number;
  mobileBad: number;
  quota: number;
  text: string;
}

export interface TechnicalData {
  audits: AuditPoint[];
  selectedAuditId: string | null;
  previousAuditId: string | null;
  findings: Finding[];
  byCategory: { category: string; critical: number; high: number; medium: number; low: number }[];
  reports: Report[];
  /** G11: the daily key-page watch (null before the first watch has run for this website) */
  watch: PageWatch | null;
  /** G25: Google's index view of those pages, from URL Inspection within its 2,000-a-day quota */
  indexCoverage: IndexCoverage | null;
}

/** What the app answers when somebody presses "I fixed this" on a finding. */
export interface RecheckRequest {
  findingKey: string;
  state: RecheckState;
  requestedAt: string;
  message: string;
}

export interface AiEngineStat {
  key: string;
  name: string;
  asked: number;
  answered: number;
  mentioned: number;
  cited: number;
  mentionRate: number;
  citationRate: number;
  errors: number;
  knowsBrand: boolean | null;
  carried: boolean;
  /** v4.9: answers counted over the past 7 days (this run + the daily pulse), of which from the pulse, and the 95% range of the mention rate */
  samples: number;
  pulseSamples: number;
  ci: [number, number] | null;
  /** -100..100 over the answers naming the business (null = none read) */
  sentiment: number | null;
}

export interface AiRun {
  runId: string;
  checkedAt: string;
  prompts: number;
  answers: number;
  mentionRate: number;
  citationRate: number;
  shareOfVoice: number;
  avgRank: number;
  aioPresence: number;
  aioCitationRate: number;
  /** credits (app/docs/CREDITS.md): the credits this run used, from its provider cost at the platform's settings */
  credits: number;
  alerts: string[];
  /** v4.9 (0 / null on runs before v4.9) */
  runKind: string;
  samples: number;
  visibilityScore: number | null;
  mentionLo: number | null;
  mentionHi: number | null;
  sentimentScore: number | null;
  accuracyIssues: number;
  aiSessions: number | null;
  aiConversions: number | null;
  aiRevenue: number | null;
  indexSov: number | null;
  aiImpressions: number | null;
}

/** v4.9: one AI Pulse day (ChatGPT, Gemini and Google AI Mode on the whole panel) */
export interface AiDay {
  date: string;
  samples: number;
  mentionRate: number;
  citationRate: number;
  shareOfVoice: number;
  visibilityScore: number;
  alerts: string[];
  /** R104: the newest reading of the day - when the pulse really ran */
  checkedAt?: string;
}

export interface AiTraffic {
  connected: boolean;
  error: string | null;
  period: { start: string; end: string } | null;
  sessions: number;
  engaged: number;
  keyEvents: number;
  revenue: number;
  prevSessions: number;
  changePct: number | null;
  shareOfSessions: number;
  convRate: number;
  organicConvRate: number;
  assistants: { name: string; sessions: number; prevSessions: number; engaged: number; keyEvents: number; revenue: number }[];
  landing: { page: string; sessions: number; keyEvents: number; revenue: number; citedByAi: boolean }[];
  weekly: { week: string; sessions: number; keyEvents: number; revenue: number }[];
}

export interface AiAccess {
  checkedAt: string;
  ok: boolean;
  robotsFound: boolean;
  llmsTxt: boolean;
  bots: { bot: string; owner: string; group: 'answer' | 'training'; allowed: boolean; rule: string; blockedPaths: string[]; fetchStatus: number | null; fetchBlocked: boolean }[];
  issues: { level: string; bot: string; text: string; fix: string }[];
}

export interface AiPerception {
  analysed: number;
  positive: number;
  neutral: number;
  negative: number;
  score: number | null;
  descriptors: string[];
  negatives: { engine: string; prompt: string; excerpt: string }[];
  issues: { text: string; engines: string[]; questions: string[]; new: boolean }[];
}

/** v4.9: the AI-answer database (DataForSEO LLM Mentions, monthly) and what the panel does not cover */
export interface AiIndex {
  checkedAt: string;
  carried: boolean;
  platforms: string[];
  sov: number | null;
  answersCitingYou: number;
  brands: { key: string; label: string; you: boolean; mentions: number; aiSearchVolume: number; share: number | null }[];
  questions: { question: string; volume: number; platform: string }[];
  suggestions: { question: string; volume: number; platform: string; youCited: boolean }[];
  fanout: { query: string; count: number; engines: string[]; questions: string[] }[];
  demand: { total: number; named: number; lost: number };
}

/** v4.9: a buyer stage or topic cluster of the panel */
export interface AiGroup {
  key: string;
  questions: number;
  volume: number;
  samples: number;
  mentionRate: number;
  leader: string;
}

/** v4.12: one key page, can AI assistants read and quote it (0-100), Bing's crawl, when it was sent to Bing / IndexNow */
export interface AiPageStat {
  url: string;
  kind: string;
  checkedAt: string;
  status: number;
  score: number | null;
  checks: { key: string; ok: boolean | 'partial'; label: string }[];
  issues: string[];
  wordsRaw: number;
  title: string;
  updatedOn: string;
  bingCrawledAt: string;
  submittedAt: string;
  submittedVia: string;
  citedBy: string[];
}
/** v4.12: a question to win in AI answers: a new answer page or a refresh of the page the site has */
export interface AiTargetStat {
  targetId: string;
  question: string;
  keyword: string;
  kind: 'answer' | 'refresh';
  pageUrl: string;
  pageType: string;
  fanout: string[];
  sources: { url: string; title: string }[];
  competitors: string[];
  stage: string;
  value: number;
  status: string;
  reason: string;
  writtenAt: string;
  wonAt: string;
  updatedAt: string;
}
/** v4.12: a third-party page AI cites without naming the business (earned media) */
export interface AiEarnedPage {
  url: string;
  title: string;
  host: string;
  kind: string;
  citations: number;
  engines: string[];
  questions: string[];
  mentionsUs: boolean | null;
  competitorsNamed: string[];
  action: string;
  status: string;
  drafted: boolean;
  /** a contact found on the page or added on the Backlinks page */
  contactEmail: string;
  /** the outreach draft / forum reply (from seo_link_prospects) */
  draft: { subject: string; body: string } | null;
}
/** v4.12: is the IndexNow key file on the site? (POST .../ai/indexnow/check) */
export interface IndexNowCheck {
  verified: boolean;
  keyUrl: string;
  status: number;
  message: string;
}
export interface AiGrowth {
  checkedAt: string;
  submitted: { bing: { enabled: boolean; inAccount: boolean; submitted: number; quota: number | null; error: string }; indexnow: { keyUrl: string; key: string; verified: boolean; submitted: number; error: string } };
  pagesChecked: number;
  avgScore: number | null;
  pages: AiPageStat[];
  targets: AiTargetStat[];
  earned: AiEarnedPage[];
  entity: { checkedAt: string; found: boolean; qid: string; byName: { id: string; label: string; description: string }[] } | null;
  actions: { priority: number; type: string; action: string; why: string }[];
  alerts: { level: string; text: string }[];
  /** AI answer / refresh pages a month (settings) and how many the content run wrote this month */
  pagesPerMonth: number;
  writtenThisMonth: number;
}

export interface AiData {
  runs: AiRun[];
  latest: {
    runId: string;
    engines: AiEngineStat[];
    competitors: { domain: string; mentions: number; share: number; auto: boolean }[];
    sources: { domain: string; citations: number; engines: string[]; topics: string[]; kind: string }[];
    pages: { url: string; citations: number; engines: string[] }[];
    gaps: { prompt: string; competitors: string[]; sources: string[]; volume: number | null; stage: string; cluster: string; fanout: string[] }[];
    traffic: AiTraffic | null;
    access: AiAccess | null;
    perception: AiPerception | null;
    index: AiIndex | null;
    stages: AiGroup[];
    clusters: AiGroup[];
    market: {
      keyword: string;
      checkedAt: string;
      totalMentions: number;
      aiSearchVolume: number;
      top: { domain: string; mentions: number; aiSearchVolume: number }[];
      you: { mentions: number; aiSearchVolume: number } | null;
    } | null;
  } | null;
  /** G6: persona (buyer role), market (CC-lang), pinned, and the fit gate's sentence for a refused question */
  prompts: { promptId: string; prompt: string; kind: string; topic: string; keyword: string; source: string; status: string; createdAt: string; stage: string; cluster: string; volume: number | null; origin: string; persona: string; market: string; pinned: boolean; fitNote: string }[];
  /** G6 (2026-10-18): the latest run's rates per engine / cluster / buyer role / market / stage, and the panel it asked */
  segments: AiSegments | null;
  panel: AiPanelInfo | null;
  /** v4.9: the AI Pulse days (last 90) */
  daily: AiDay[];
  answers: {
    promptId: string;
    prompt: string;
    kind: string;
    topic: string;
    engine: string;
    answered: boolean;
    mentioned: boolean;
    cited: boolean;
    rank: number;
    ourUrls: string[];
    competitors: string[];
    sources: string[];
    excerpt: string;
    error: string;
    checkedAt: string;
    runKind: string;
    sentiment: string;
    brands: string[];
    issues: string[];
    fanout: string[];
    /** v4.12: the exact third-party pages the answer cited */
    citedUrls: { url: string; title: string }[];
  }[];
  /** v4.12 (n8n/seo-agent/AI_GROWTH_SPEC.md): the weekly AI growth loop, null until its first run */
  growth: AiGrowth | null;
  /** from the latest AI visibility report (when it was delivered to the app) */
  report: {
    receivedAt: string;
    brief: { headline?: string; summary?: string } | null;
    /** question x engine grid: engine key -> 'mentioned' | 'cited' | 'absent' | 'none' | 'error' | 'monthly' */
    questions: { promptId: string; prompt: string; kind: string; topic: string; won: boolean; engines: Record<string, string>; competitors: string[]; sources: string[]; stage: string; volume: number | null; winRate: number | null; samples: number }[];
    actions: EngineAction[];
  } | null;
}

export interface BacklinkLink {
  fromDomain: string;
  fromUrl: string;
  toUrl: string;
  anchor: string;
  dofollow: boolean;
  domainRank: number;
  spam: number;
  firstSeen: string;
  lastSeen: string;
  title: string;
}

export interface BacklinkSnapshot {
  checkedAt: string;
  mode: string;
  rank: number;
  backlinks: number;
  referringDomains: number;
  referringDomainsNofollow: number;
  spamScore: number;
  brokenBacklinks: number;
  newLinks: number;
  lostLinks: number;
  importantLost: number;
  spammyNew: number;
  /** credits (app/docs/CREDITS.md): the credits this check used, from its provider cost at the platform's settings */
  credits: number;
  /** v4.10: referring sites from every source (null before v4.10) */
  unionDomains: number | null;
  bestLinks: number | null;
  verifiedLive: number | null;
  atRisk: number | null;
  confirmedLost: number | null;
  referralVisits: number | null;
}

/** v4.10: one referring site in the link ledger (every source merged, checked on the linking page; n8n/seo-agent/BACKLINKS_SPEC.md) */
export interface BacklinkRef {
  refDomain: string;
  /** web | social */
  kind: string;
  fromUrl: string;
  toUrl: string;
  anchor: string;
  /** brand | url | generic | money | image_or_empty */
  anchorKind: string;
  /** follow | nofollow | ugc | sponsored | redirect ('' = not checked yet) */
  rel: string;
  /** content | body | sidebar | nav | footer | comment */
  placement: string;
  /** the Link Analyst's label: editorial, press, resource, listing, directory, profile, partner, forum, comment, guest_post, sponsored, scraper, spam, other */
  linkType: string;
  /** 0-1 (0-3 from the analyst / 3) */
  relevance: number | null;
  note: string;
  /** dfs, bing, gsc, ga4, cc, wiki, hn, news, web, import, every source that ever reported it */
  sources: string[];
  firstSeen: string;
  lastSeen: string;
  /** live | at_risk (missed once) | lost (two misses, with the reason) */
  status: string;
  lostAt: string;
  /** link_removed | page_gone | domain_gone | not_seen */
  lostReason: string;
  /** found | missing | gone | blocked | js | error | unchecked */
  verify: string;
  verifiedAt: string;
  noindex: boolean;
  pageTitle: string;
  context: string;
  authority: number;
  /** Ahrefs Domain Rating (free API; shown with the "Domain Rating by Ahrefs" credit) */
  dr: number | null;
  /** Common Crawl harmonic-centrality position (1 = best) */
  ccRank: number | null;
  pageKeywords: number;
  spamScore: number;
  /** false = inserted into an existing page later (often paid) */
  original: boolean;
  visits: number;
  keyEvents: number;
  aiCited: boolean;
  seoValue: number;
  referralValue: number;
  brandValue: number;
}

export interface BacklinkSourceStatus {
  bing: { enabled: boolean; connected: boolean; inAccount: boolean | null; error: string; pages: number; links: number };
  gsc: { rows: number; domains: number; uploadedAt: string };
  ga4: { connected: boolean; error: string; property: string; sources: number; visits: number; excluded: string[] };
  cc: { release: string; links: number; checkedAt: string };
  wiki: { pages: number };
  hn: { stories: number };
}

export interface BacklinkCoverage {
  /** referring sites (web) live or at risk, all sources */
  union: number;
  social: number;
  perSource: Record<string, number>;
  /** sites only one source found */
  onlyIn: Record<string, number>;
  /** % of the union DataForSEO reports */
  dfsShare: number;
  /** sites in Google's own sample (the Search Console upload) */
  gscSample: number;
  /** % of Google's sample DataForSEO sees; null without an upload */
  dfsSeesGoogle: number | null;
  allSeeGoogle: number | null;
  verified: number;
  checkedNow: number;
  blocked: number;
  status: BacklinkSourceStatus | null;
}

export interface Prospect {
  prospectDomain: string;
  type: string;
  rank: number;
  spamScore: number;
  detail: string;
  sourceUrl: string;
  targetUrl: string;
  status: string;
  firstSeen: string;
  lastSeen: string;
  wonAt: string;
  outreachSubject: string;
  outreachBody: string;
  note: string;
  /** v4.10: value x likelihood, 0-100 */
  score: number;
  origin: string;
  contactEmail: string;
  contactUrl: string;
  contactedAt: string;
  followupStep: number;
  followupSubject: string;
  followupBody: string;
  verifiedAt: string;
}

export interface BacklinksData {
  snapshots: BacklinkSnapshot[];
  latest: {
    lost: (BacklinkLink & { reason?: string; pending?: boolean })[];
    new: BacklinkLink[];
    competitors: { domain: string; [k: string]: unknown }[];
    timeseries: { month: string; backlinks: number; referringDomains: number; rank: number }[];
    /** v4.10 (null before) */
    coverage: BacklinkCoverage | null;
    anchors: { kinds: Record<string, number>; top: { anchor: string; referringDomains: number; backlinks: number; kind: string }[] } | null;
    pages: { url: string; referringDomains: number; backlinks: number; status: number | null }[];
    wins: { refDomain: string; url: string; why: string; seo: number; linkType: string }[];
    relChanged: { refDomain: string; url: string; rel: string; was: string }[];
    compNew: { domain: string; competitor: string; url: string; firstSeen: string; domainRank: number; title: string }[];
    lists: { domain: string; url: string; title: string; topic: string; competitors: string[]; named: boolean; linked: boolean }[];
  } | null;
  /** v4.10: the link ledger (every referring site, every source, checked on the page) */
  refs: BacklinkRef[];
  /** v4.10: the uploads (latest per kind) */
  imports: { source: string; rows: number; importedAt: string }[];
  /** v4.10: the Common Crawl graph rows written for this site (monthly job) */
  linkGraph: { release: string; checkedAt: string; counts: Record<string, number> } | null;
  prospects: Prospect[];
  /** from the latest backlink report delivered to the app */
  report: {
    receivedAt: string;
    alerts: { level: string; text: string }[];
    gap: { domain: string; rank: number; spam: number; linksTo: string[]; backlinks: number; source: string; ccRank: number | null }[];
    spammy: BacklinkLink[];
    disavowFileId: string | null;
    prospectsCsvFileId: string | null;
    /** v4.10 */
    mentions: { domain: string; url: string; title: string; source: string; verified: boolean; context: string }[];
    atRisk: { refDomain: string; url: string; verify: string }[];
    reclaim: { brokenUrl: string; status: number | null; links: number; domains: string[]; redirectTo: string }[];
    drEnabled: boolean;
  } | null;
}

export interface ConsoleAlert {
  kind: string;
  severity: string;
  subject: string;
  summary: string;
  receivedAt: string;
  status: string;
  source: string;
}

export interface Checkin {
  month: string;
  manualAction: boolean;
  securityIssue: boolean;
  notes: string;
  notIndexedTotal: number;
  indexedTotal: number | null;
  csvKind: string;
  submittedAt: string;
}

export interface AlertsData {
  alerts: ConsoleAlert[];
  checkins: Checkin[];
  checkinDue: boolean;
}

export interface SiteSettingsData {
  tracking: TrackingConnection;
  monitors: (MonitorSettings & { competitors: string[]; updatedAt: string }) | null;
  cadence: { pagesPerWeek: number; status: string } | null;
  profile: ProfileFields | null;
  readiness: ProfileReadiness;
  /** B7-5: the website's content groups as the engine stores them (seo_sites.content_groups_json); [] when none are set */
  contentGroups?: { name: string; pattern: string }[];
}

export type RecommendationCategory = 'search' | 'technical' | 'ai' | 'backlinks' | 'content' | 'rankings' | 'setup';
export type Priority = 'high' | 'medium' | 'low';

export interface RecommendationAction {
  label: string;
  /** open the tool form for this mode with these values filled in */
  mode?: ModeId;
  prefill?: Record<string, unknown>;
  /** or go to a page of the site, relative to /o/:org/sites/:site/ (e.g. "settings/profile") */
  page?: string;
  /** or an external link (the page in question) */
  href?: string;
  /** or one of the company's reports (E-QA 2026-10-21: a not-ready draft opens its report, where each bracket to edit is listed) */
  report?: string;
  /** keyword-first: add this keyword to one of the website's ladders (POST .../ladders/:ladderId/keywords), where its topic matches */
  addToLadder?: { ladderId: string; head: string; keyword: string };
}

export interface Recommendation {
  id: string;
  category: RecommendationCategory;
  priority: Priority;
  title: string;
  detail: string;
  /** a short evidence line, e.g. "position 11.2 · 340 impressions / week" */
  evidence?: string;
  action?: RecommendationAction;
  /** a second button (keyword-first: "Add to my ladder" beside "Write the page") */
  secondary?: RecommendationAction;
  /** B3 (pre-launch run 2026-10-21): this website's own values for the recommendation's "Show me how" guide (the IndexNow key, its file
   *  and its address), so the guide never shows its example values where the real ones exist */
  guideVars?: Record<string, string>;
  /** REP 3.3 (benchmark pass 2026-10-14): what this is worth and why it sits where it does in the one queue (`queue.ts`).
   * Absent only on rows written before the queue existed; a reader must treat a missing score as "not ranked". */
  score?: RecommendationScore;
}

export interface OverviewData {
  site: { domain: string; trackingStatus: string; verified: boolean };
  search: {
    latest: MetricsPoint | null;
    series: { periodEnd: string; clicks: number; impressions: number; position: number; sessions: number }[];
    /** 'weekly': rolling 28-day totals per weekly run; 'daily': the latest report's daily Search Console values (before the weekly history exists) */
    seriesKind: 'weekly' | 'daily';
    /** G12: the events marked on this chart */
    annotations: ChartAnnotation[];
    /** G29: where these figures come from */
    lineage: Lineage[];
  };
  health: { latest: AuditPoint | null; series: { auditedAt: string; healthScore: number }[] };
  ai: { latest: AiRun | null; series: { checkedAt: string; mentionRate: number; citationRate: number; shareOfVoice: number }[] };
  backlinks: { latest: BacklinkSnapshot | null; series: { month: string; referringDomains: number; backlinks: number }[] };
  rankings: { ladders: number; keywords: number; top3: number; top10: number; top50: number; movers: { keyword: string; from: number | null; to: number | null }[] };
  content: { started: number; published: number; pendingPublish: number; /** R111: written drafts that failed the quality check (not counted in pendingPublish) */ needsFix?: number; pagesPerWeek: number; caseStudies: number };
  alerts: { open: number; checkinDue: boolean };
  recommendations: Recommendation[];
  reports: Report[];
}

// ---------- pipeline: what runs on its own for a website, when, and what it decided ----------
export type AutomationState = 'on' | 'off' | 'paused' | 'needs_setup';

export interface AutomationStatus {
  id: import('./constants').AutomationId;
  state: AutomationState;
  /** why it is off / what is missing */
  reason: string | null;
  /** next scheduled time (UTC ISO), null when it will not run */
  nextRunAt: string | null;
  lastRunAt: string | null;
  /** one line about the last run, e.g. "29 clicks · +53%" */
  lastResult: string | null;
  lastReportId: string | null;
  /** credits (app/docs/CREDITS.md): about how many credits a month, at the platform's credit rate */
  monthlyCredits: number;
  /** extra facts, e.g. "8 questions · 6 engines" */
  detail: string | null;
}

export interface QueueItem {
  keyword: string;
  /**
   * v4.12: ai_answer / ai_refresh = the AI page of the week (AI_GROWTH_SPEC.md).
   * v4.16 (B4-3): decay = a refresh of a page the Site Tracker proved is losing traffic, queued ahead of striking and trend.
   */
  source: 'ladder' | 'decay' | 'striking' | 'trend' | 'ai_answer' | 'ai_refresh';
  why: string;
  pageType: string;
  existingPageUrl: string;
  ladder: { id: string; rung: number; head: string; pageNo: number } | null;
  /** v4.12: the AI target the page is written for. Keyword-first (R-K5): a suggestion also carries the target's searches, sources and
   * the companies AI names, so "Write it" writes it as the AI answer page it is */
  aiTarget?: { targetId: string; question: string; kind: 'answer' | 'refresh'; fanout?: string[]; sources?: { url: string; title: string }[]; competitors?: string[] } | null;
  /** v4.16 (B4-3): the clicks this page lost in 28 days, what put a `decay` refresh where it is in the queue */
  decayLost?: number;
  /** keyword-first (2026-10-19): the "Coming up" item key (cycles.ts itemKey), whether it is written on its own (`auto`) or waits for
   * an OK, and its price in credits */
  itemKey?: string;
  auto?: boolean;
  credits?: number;
}

export interface PipelineStage {
  id: 'research' | 'plan' | 'write' | 'publish' | 'track' | 'monitor' | 'improve';
  title: string;
  state: 'done' | 'active' | 'waiting' | 'attention';
  headline: string;
  detail: string;
  /** relative to the site, or a tool mode */
  action: { label: string; page?: string; mode?: import('./constants').ModeId } | null;
}

export interface PipelineData {
  /** n8n's timezone (the schedules' clock) */
  timezone: string;
  tracking: { status: 'active' | 'paused' | 'not_started'; verified: boolean; reportsToThisApp: boolean; engineEmails: boolean };
  stages: PipelineStage[];
  automations: AutomationStatus[];
  queue: {
    pagesPerWeek: number;
    /** the posts the next Monday run will write (in order) */
    next: QueueItem[];
    /** then these, week after week */
    later: QueueItem[];
    /** written, not published yet */
    /** `needsFix` (R111): the draft did not pass its quality check: finish it by hand (E-QA, never a re-run), do not publish it as it is; `reasons` say why */
    waiting: { keyword: string; startedAt: string; days: number; needsFix?: boolean; reasons?: string[] }[];
    /** opportunity posts while they are set to Manual: what Auto would write, nothing is written on its own (v4.8) */
    suggestions?: QueueItem[];
    /** the coming Monday run writes nothing because too many pages wait to be published (the pile-up guard, v4.8) */
    paused?: { reason: 'pileup'; waiting: number; max: number } | null;
    /** when the n8n cadence last reported its own plan */
    engineUpcoming: { keyword: string; source: string; why: string }[];
    engineUpcomingAt: string | null;
  };
  calendar: { at: string; automation: import('./constants').AutomationId }[];
  activity: Report[];
  /** credits (app/docs/CREDITS.md): about how many credits a month, at the platform's credit rate */
  monthlyCredits: number;
  /** automatic runs n8n's schedule started and is still executing (they cover every website, this one included) */
  running: { automation: import('./constants').AutomationId; startedAt: string }[];
  /** this website's runs started in the app that have not finished */
  activeRuns: { id: string; mode: import('./constants').ModeId; keyword: string; createdAt: string }[];
  /** pages written for this website (content log + ladder pages being written or published), newest first */
  written: { keyword: string; status: 'started' | 'writing' | 'published'; startedAt: string; publishedUrl: string; source: string }[];
  /** keyword ladders with the pages still to write */
  ladders: {
    id: string;
    head: string;
    pages: number;
    published: number;
    planned: { keyword: string; rung: number; pageNo: number; pageType: string }[];
    /** every page keyword of the ladder (the overlap check of a new ladder) */
    keywords?: string[];
  }[];
  /** v4.8 Pipeline home (PIPELINE_FEATURE_SPEC.md §4.1): one card per keyword ladder, in priority order */
  ladderCards: LadderCard[];
  /** what only a person can do, most urgent first */
  needsYou: NeedsYouItem[];
  /** the next Monday (or 1st of the month) runs in order, with what each touches */
  thisWeek: ThisWeekItem[];
  summary: PipelineSummary;
  /** the website's automation settings (Phase 2 makes them editable; until then the defaults) */
  automation: SiteAutomation;
  /** pages the weekly site report found live on the website by itself (Phase 4, newest first; missing before it is deployed) */
  detected?: DetectedPage[];
  /** the platform switch for keyword proposals (AUTO_START_LADDERS): the server proposes the next keyword, and starts it at level 3 */
  autoStartEnabled?: boolean;
  /** keyword-first (2026-10-19, SCHEDULING_KEYWORDS_PLAN.md §4 / §5): the website's own cycle (always set by the server) */
  cycle?: import('./cycles').SiteCycleView;
  /** keyword-first: the autopilot level and what it means this cycle (always set by the server) */
  autopilot?: PipelineAutopilot;
  /** P1 (2026-10-20): is the website ready for a written page (author profile + business facts, shared/src/readiness.ts) */
  readiness?: import('./readiness').ContentReadiness | null;
}

/** What the autopilot does for the website this cycle (keyword-first, plan §5.5). */
export interface PipelineAutopilot {
  level: import('./cycles').AutopilotLevel;
  /** levels 1 and 2: no keyword chosen yet, so nothing is written */
  waitingForKeyword: boolean;
  /** why the coming cycle writes nothing ('' when it writes) */
  reason: string;
  /** what waits for the client's OK (with its price), as in the "Coming up" plan */
  suggestions: QueueItem[];
  /** what the topic check refused, with the reason in plain words */
  refused: { keyword: string; source: string; reason: string; detail: string }[];
  /** the auto-pause dropped the level to 1 (rejected pages), and from which level */
  dropped: { at: string; from: number } | null;
  /** the ladders whose keyword the client did not choose (their pages wait for an OK) */
  notChosen: string[];
}

/** A written page the weekly Site Tracker found live on the website (its `detected_published`, PIPELINE_FEATURE_SPEC.md §6.5). */
export interface DetectedPage {
  keyword: string;
  url: string;
  /** '' when the page is not a ladder page */
  ladderId: string;
  /** the ladder's main keyword, '' when unknown */
  head: string;
  /** how the page was recognised: its planned address ('slug') or its title / heading ('title') */
  matchedBy: string;
  /** when the report arrived */
  at: string;
  reportId: string;
}

// ---------- v4.8: keyword ladders on the Pipeline page (PIPELINE_FEATURE_SPEC.md) ----------

/** Planning: nothing written yet · Writing: pages written, none live · Climbing: pages live, main keyword not top 3 ·
 *  Won: main keyword top 3 for 4 checks · Paused / Queued: by the settings · Stuck: no live page improved for 8 weeks ·
 *  Needs you: pages waiting to be published for 7+ days (or the pile-up guard stopped the writing) */
export type LadderStatus = 'planning' | 'writing' | 'climbing' | 'won' | 'paused' | 'queued' | 'stuck' | 'needs_you';
export type LadderMode = 'auto' | 'manual';
export type PlanType = 'direct' | 'short' | 'full';
/** planned · writing (run in progress) · waiting (written, not published) · published · gated (main page waiting for support) ·
 *  set_aside (R16: the keyword rule refused this planned page, a competitor's brand, a government portal or an off-topic search -
 *  so the Monday runs skip it and nothing is written for it; the engine marks the row `set_aside` with the reason) */
export type LadderPageState = 'planned' | 'writing' | 'waiting' | 'published' | 'gated' | 'set_aside';

export interface LadderPage {
  keyword: string;
  /** 1-3 supporting rungs, 4 = the main page */
  rung: number;
  pageNo: number;
  pageType: string;
  state: LadderPageState;
  /** the planned path / URL from the ladder plan */
  targetUrl: string;
  /** where it is live (content log or ladder row), '' when not published */
  publishedUrl: string;
  /** latest Google position: null = never checked, 0 = not in the top 50 */
  position: number | null;
  previousPosition: number | null;
  bestPosition: number | null;
  history: RankPoint[];
  /** when it was written (content log), null when not yet */
  writtenAt: string | null;
  publishedAt: string | null;
  /** the app run / report that wrote it, when the app knows it */
  runId: string | null;
  reportId: string | null;
  /** search volume / difficulty from the ladder plan report, when the app received it */
  volume: number | null;
  kd: number | null;
  supporting: string[];
  /** R111: written, but the draft did not pass the quality check: finished by hand in the draft (never "I published it" as it is, never a re-run) */
  needsFix?: boolean;
  qaReasons?: string[];
}

export interface LadderOverlap {
  ladderId: string;
  head: string;
  /** keywords of this ladder that overlap keywords of the other one */
  keywords: string[];
}

export interface LadderCard {
  id: string;
  head: string;
  country: string;
  startDate: string;
  /** null for ladders planned before v4.8 */
  planType: PlanType | null;
  mode: LadderMode;
  /** 1 = written first */
  priority: number;
  status: LadderStatus;
  /** one plain-language line about the status */
  statusText: string;
  counts: { total: number; published: number; waiting: number; writing: number; planned: number };
  headPosition: number | null;
  /** positive = moved up since the previous check */
  headChange: number | null;
  headSeries: RankPoint[];
  top10: number;
  top3: number;
  next: { kind: 'write' | 'publish' | 'approve' | 'check' | 'wait' | 'none'; text: string; at: string | null };
  /** expected months from the plan, e.g. "9-12", '' when unknown */
  months: string;
  /** credits (app/docs/CREDITS.md): about how many credits a month, at the platform's credit rate */
  monthlyCredits: number;
  overlaps: LadderOverlap[];
}

export interface LadderTimelineEvent {
  at: string;
  kind: 'planned' | 'written' | 'published' | 'top10' | 'top3' | 'drop' | 'next';
  text: string;
  /** a coming event (next Mondays) */
  future: boolean;
  keyword?: string;
  /** published: the weekly site report found the page live by itself (nobody reported it) */
  detected?: boolean;
}

export interface LadderDetail extends LadderCard {
  pages: LadderPage[];
  timeline: LadderTimelineEvent[];
  /** clicks / impressions of the ladder's published pages (Search Console, by page URL) */
  traffic: { points: { periodEnd: string; clicks: number; impressions: number }[]; clicks28d: number; impressions28d: number };
  reports: Report[];
  /** about how many credits this ladder has used so far (its runs, its pages, its rank checks) */
  creditsSoFar: number;
  expectedVisitsTop3: number | null;
  /** G12: the events marked on this ladder's charts, its pages going live, audit fixes, Google updates, data breaks */
  annotations: ChartAnnotation[];
  /** G12: what each of this ladder's page changes did, against the site's other pages */
  changeTests: PageChangeTest[];
  /** G29: where the positions, the traffic and the expected visits come from */
  lineage: Lineage[];
}

export interface NeedsYouItem {
  id: string;
  /** keyword-first: `keyword` (choose your first / next keyword), `proposal` (a keyword we propose or announced), `recheck` (a queued
   * ladder whose keyword fell when it became active), `level` (the autopilot level: dropped after rejections, or a nudge to raise it);
   * P1: `profile` (the author profile and the business facts the first page waits for, or that first page ready to write) */
  kind: 'publish' | 'approve' | 'overlap' | 'duplicate' | 'failed' | 'connection' | 'pileup' | 'keyword' | 'proposal' | 'recheck' | 'level' | 'profile';
  severity: 'warning' | 'info';
  title: string;
  detail: string;
  /** one button: a page of the website, a tool (with prefill), a run, or a ladder */
  action: { label: string; page?: string; mode?: import('./constants').ModeId; prefill?: Record<string, unknown>; runId?: string; ladderId?: string; /** G2: the page's report (to send it to the CMS) */ reportId?: string } | null;
  ladderId?: string;
  /** approve items: the page the "Write it" dialog starts (with its ladder fields) */
  writeNow?: QueueItem;
}

export interface ThisWeekItem {
  at: string;
  automation: import('./constants').AutomationId;
  title: string;
  /** what it touches, e.g. "2 ladders, 18 pages" or "'accredited service provider...' for ladder 'e invoicing in uae'" */
  detail: string;
  running: boolean;
}

export interface PipelineSummary {
  publishedThisMonth: number;
  /** ladder pages and main keywords in the top 10 */
  top10: number;
  /** clicks of all ladder pages, last 28 days */
  clicks28d: number;
  /** credits (app/docs/CREDITS.md): the credits the company used this calendar month (autopilot + on-demand) */
  creditsUsedThisMonth: number;
}

export interface SiteAutomation {
  /** keyword-first (§5.5): 1 only my keywords, 2 my keywords and keep my pages healthy (default), 3 full autopilot. The server always
   * sets it (the `_site` row's autopilot_level, empty = 2). */
  autopilotLevel?: import('./cycles').AutopilotLevel;
  /** default for new ladders */
  defaultMode: LadderMode;
  /** stored for older screens; it decides nothing any more (keyword-first R-K3: what runs on its own is the autopilot level) */
  opportunities: LadderMode;
  /** stored for older screens; it decides nothing any more (keyword proposals follow the autopilot level) */
  autoStartLadders: boolean;
  maxActiveLadders: number;
  /** pile-up guard: no new pages while this many are written but not published */
  maxWaiting: number;
}
