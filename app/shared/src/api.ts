// Response shapes of the app's REST API (server/src/routes/*), shared with the React client.
import type { OrgAgencyInfo, OrgKind, PortalBrand } from './agency';
import type { ModeId, Role } from './constants';
import type { MonitorSettings, ProfileFields, RunInput } from './schemas';

export interface ApiError {
  error: string;
  /** field path -> message, for form errors */
  fields?: Record<string, string>;
  code?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  hasPassword: boolean;
  googleLinked: boolean;
  createdAt: string;
  /** G1: at least one second factor (authenticator app or passkey) is set up */
  mfaEnabled: boolean;
}

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  role: Role;
  onboardingStep: string;
  onboardedAt: string | null;
  /** G1: the company requires two-step verification */
  requiresMfa?: boolean;
  /** G5: standard / agency / client workspace, and the agency a client workspace belongs to */
  kind?: OrgKind;
  agencyName?: string | null;
}

export interface Me {
  user: User;
  orgs: OrgSummary[];
  platformAdmin: boolean;
}

export interface AuthProviders {
  google: boolean;
  emailPassword: boolean;
  /** account e-mails (verification, password reset, invitations) are sent */
  email: boolean;
  /** the SEO engine also e-mails reports (off: everything is delivered to the app only) */
  engineEmails: boolean;
  /** analyses start only after the e-mail address is confirmed (only when account e-mails are on) */
  requireEmailVerification: boolean;
}

export interface Org {
  id: string;
  name: string;
  slug: string;
  industry: string;
  size: string;
  website: string;
  monthlyBudgetUsd: number;
  disabled: boolean;
  onboardingStep: string;
  onboardedAt: string | null;
  createdAt: string;
  role: Role;
  /** G5 (app/docs/WHITE_LABEL.md): standard company, agency, or an agency's client workspace */
  kind: OrgKind;
  /** a client workspace: its agency (the id only for the agency's own staff) */
  agency: OrgAgencyInfo | null;
  /** the brand client-facing surfaces of this company use (white-label on), else null (the app's own) */
  brand: PortalBrand | null;
  /** a client workspace: a live publish / an outreach send waits for the client's approval */
  clientApproval: boolean;
}

export type TrackingStatus = 'not_started' | 'active' | 'paused';
export type VerificationMethod = 'search_console' | 'dns' | 'meta';

export interface Site {
  id: string;
  orgId: string;
  domain: string;
  /** the id the n8n workflows use (site_<domain>) */
  n8nSiteId: string;
  country: string;
  business: string;
  customers: string;
  goal: string;
  tone: string;
  cta: string;
  businessFacts: string;
  competitors: string[];
  brandNames: string[];
  keywords: string[];
  ga4PropertyId: string;
  gscProperty: string;
  blogsPerWeek: number;
  verifiedAt: string | null;
  verificationMethod: VerificationMethod | null;
  trackingStatus: TrackingStatus;
  trackingStartedAt: string | null;
  createdAt: string;
  /** keyword-first (2026-10-19; always set by the server): the website's IANA time zone ('' = the engine's), what it sells, the weekday
   * of its weekly cycle (0 Sunday - 6; null = the weekday tracking started on) and its autopilot level */
  timezone?: string;
  services?: string[];
  cycleWeekday?: number | null;
  autopilotLevel?: import('./cycles').AutopilotLevel;
}

export interface SiteVerificationInfo {
  verified: boolean;
  verifiedAt: string | null;
  method: VerificationMethod | null;
  token: string;
  dnsRecord: { type: 'TXT'; host: string; value: string };
  metaTag: string;
  serviceAccountEmail: string | null;
  /** another company already verified this domain */
  claimedElsewhere: boolean;
}

export interface VerifyResult {
  verified: boolean;
  method: VerificationMethod;
  message: string;
}

export interface GoogleConnection {
  serviceAccountEmail: string | null;
  configured: boolean;
  gsc: { connected: boolean; property: string | null; permissionLevel: string | null; error: string | null };
  ga4: {
    connected: boolean;
    properties: { id: string; name: string; account: string; matchesDomain: boolean }[];
    selected: string | null;
    error: string | null;
  };
}

export type RunStatus = 'submitting' | 'accepted' | 'running' | 'completed' | 'failed';

export interface Run {
  id: string;
  orgId: string;
  siteId: string | null;
  siteDomain: string | null;
  userId: string | null;
  userName: string | null;
  /** G4: the API key that started it (the run is still the key creator's); null for a run started in the app */
  apiKeyName?: string | null;
  mode: ModeId;
  title: string;
  status: RunStatus;
  requestId: string | null;
  error: string | null;
  /**
   * credits (app/docs/CREDITS.md): what the run is quoted, holds and is charged, in credits, the customer's only figure for it. The
   * provider cost behind it (the old `estimatedCostUsd` / `actualCostUsd` / engine estimate fields) stays in the database and the
   * platform admin panel (`AdminRunRow`); it is never sent to a customer.
   */
  credits: RunCredits;
  etaMinutes: number;
  input: RunInput;
  createdAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
  reportCount: number;
  lastStage: string | null;
}

/**
 * credits (app/docs/CREDITS.md) of one run:
 *   free         it costs nothing
 *   held         still going: its quote is held, so no other analysis can spend the same credits
 *   charged      settled at what it really used (never more than its quote)
 *   not_charged  it failed: nothing is charged (credits taken before it failed are given back)
 *   quoted       finished, its charge not settled yet (the cost sync runs every 10 minutes)
 */
export type RunCreditState = 'free' | 'quoted' | 'held' | 'charged' | 'not_charged';
export interface RunCredits {
  /** the whole credits it was quoted before it started (the most it can be charged); null when unknown */
  quoted: number | null;
  /** what it was charged (the usage entries of the run, a failed run's return included); null before any */
  charged: number | null;
  state: RunCreditState;
  /** it used more than its quote and was charged the quote */
  capped: boolean;
}

export interface ReportFile {
  id: string;
  /** `image` since 2026-10-18 (D-13): a page's hero and in-body images (.webp / .png / .jpg) were listed as a generic "File" */
  kind: 'pdf' | 'docx' | 'doc' | 'html' | 'md' | 'json' | 'zip' | 'csv' | 'txt' | 'image' | 'other';
  fileName: string;
  mimeType: string;
  size: number;
  /** where in the callback the file was found, e.g. "pdf", "file", "package.html" */
  field: string;
}

export interface Report {
  id: string;
  runId: string | null;
  siteId: string | null;
  siteDomain: string | null;
  stage: string;
  status: string;
  title: string;
  /** a few headline values for lists (verdict, score, health score, ...) */
  summary: Record<string, string | number | boolean | null>;
  receivedAt: string;
  scheduled: boolean;
  files: ReportFile[];
}

export interface ReportDetail extends Report {
  /** the callback body with every embedded file replaced by { $file: id, fileName, mimeType, size } */
  payload: Record<string, unknown>;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface Member {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
  joinedAt: string;
  /** G1: the member has two-step verification (owners and admins see it; false for viewers' view) */
  mfaEnabled?: boolean;
  /** G1: how the person came in (owner / invite / jit = first SSO sign-in / scim) */
  provisionedBy?: 'owner' | 'invite' | 'jit' | 'scim';
  /** G1: switched off by the company's identity provider (SCIM); no access until reactivated */
  deactivated?: boolean;
}

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  invitedBy: string | null;
  createdAt: string;
  expiresAt: string;
  /** only returned right after creation, so the inviter can copy it */
  inviteUrl?: string;
  /** D-10: right after creation, whether this server e-mails invitations at all (no mail account = the link is the only way) */
  emailed?: boolean;
}

export interface InvitationPreview {
  orgName: string;
  email: string;
  role: Role;
  inviterName: string | null;
  valid: boolean;
  reason: string | null;
  /** D-11: the signed-in person already belongs to the invitation's company (they joined from it): where to go */
  joinedOrgId?: string;
}

export interface AdminOrg {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  members: number;
  sites: number;
  monthlyBudgetUsd: number;
  disabled: boolean;
  monthEstimatedUsd: number;
  monthRuns: number;
}

// ---------- G21 (2026-10-13): the delivery rate, did what should have run, run, and did it reach the customer? ----------
/** One side of a week: runs that started, runs that were delivered, and everything in between. */
export interface DeliveryCount {
  started: number;
  /** finished AND something reached the customer (at least one report) */
  delivered: number;
  failed: number;
  /** finished with no report at all: nothing reached the customer, so it does not count as delivered */
  noReport: number;
  /** never finished and never will (older than the engine's own execution timeout) */
  stuck: number;
  /** still going: left out of the rate rather than counted against it */
  inFlight: number;
  /** delivered + failed + noReport + stuck, what the rate is taken over */
  settled: number;
  ratePct: number | null;
}
/** A schedule that should have fired and left no execution behind (D25a: this stack is Mac-hosted and sleeps). */
export interface MissedSchedule {
  automation: string;
  title: string;
  workflow: string;
  /** when it should have fired, in n8n's own clock */
  expectedAt: string;
}
export interface DeliveryWeek {
  /** the Monday the week starts on (UTC, YYYY-MM-DD) */
  week: string;
  onDemand: DeliveryCount;
  scheduled: DeliveryCount;
  overallPct: number | null;
  belowTarget: boolean;
  missed: MissedSchedule[];
}
/** Ops alerts and the channel that carried each one (R6 writes `delivered` back on the row). */
export interface AlertDelivery {
  total: number;
  delivered: number;
  pending: number;
  failed: number;
  /** the same failure inside the dedupe window: deliberately not re-sent, so it is left out of the rate */
  deduped: number;
  notSent: number;
  ratePct: number | null;
  byChannel: Record<string, number>;
}
export interface DeliveryReport {
  generatedAt: string;
  /** n8n's own clock, which the schedules fire on (GENERIC_TIMEZONE) */
  timezone: string;
  targetPct: number;
  weeks: DeliveryWeek[];
  alerts: AlertDelivery;
  /** what could not be measured, in words, instead of a figure that looks complete */
  notes: string[];
}

/** v4.10: the result of a link upload (POST .../backlinks/import) */
export interface LinkImportSummary {
  source: string;
  label: string;
  rows: number;
  domains: number;
  total: number;
  skipped: number;
  importedAt: string;
}

export interface AdminResult {
  ok: boolean;
  action: string;
  affected: number;
  error: string | null;
}

export type { MonitorSettings, ProfileFields };
