// Response shapes of the app's REST API (server/src/routes/*), shared with the React client.
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
}

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  role: Role;
  onboardingStep: string;
  onboardedAt: string | null;
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
  mode: ModeId;
  title: string;
  status: RunStatus;
  requestId: string | null;
  error: string | null;
  estimatedCostUsd: number;
  actualCostUsd: number | null;
  etaMinutes: number;
  input: RunInput;
  createdAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
  reportCount: number;
  lastStage: string | null;
}

export interface ReportFile {
  id: string;
  kind: 'pdf' | 'docx' | 'doc' | 'html' | 'md' | 'json' | 'zip' | 'csv' | 'txt' | 'other';
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
}

export interface InvitationPreview {
  orgName: string;
  email: string;
  role: Role;
  inviterName: string | null;
  valid: boolean;
  reason: string | null;
}

export interface Usage {
  month: string;
  budgetUsd: number;
  estimatedUsd: number;
  actualUsd: number;
  remainingUsd: number;
  runs: number;
  byMode: { mode: ModeId; runs: number; estimatedUsd: number }[];
  daily: { date: string; runs: number; estimatedUsd: number }[];
  monitoringMonthlyUsd: number;
  /** keyword checks this month (the "New keyword ladder" flow): counted in estimatedUsd and in the daily totals, not in runs */
  keywordChecks: { checks: number; usd: number };
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

/** v4.10: the result of a link upload (POST …/backlinks/import) */
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
