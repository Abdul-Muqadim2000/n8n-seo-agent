import { createHash } from 'node:crypto';
import {
  COUNTRY_NAMES,
  daysSince,
  fitBrandList,
  fitEvidence,
  fitGate,
  fitLabels,
  fitLearnedBrands,
  fitOwnLabels,
  fitStored,
  fitStoredLive,
  fitTokens,
  fitTopic,
  FITR,
  KEYWORD_CHECK,
  RECOMMENDATIONS_MAX_AGE_DAYS,
  recommendedFromStrategy,
  toAssessment,
  type CaseStudyRow,
  type KeywordAssessInput,
  type KeywordCheck,
  type LadderKeywords,
  type LadderRow,
  type RecommendedKeywords,
} from '@seo/shared';
import type { SiteAccess } from '../auth/access';
import { requireVerified } from '../auth/access';
import { config } from '../config';
import type { KeywordCheckRow, OrgRow, SiteRow } from '../db/schema';
import { badRequest, forbidden, HttpError } from '../lib/errors';
import { namesProviderCost } from '../lib/customerError';
import { assessCall, siteRows, type AssessCallResult } from '../n8n/client';
import { dropCheck, findRecentCheck, finishCheck, reserveCheck, type CheckStamp } from './keywordCheckStore';
import { latestReport } from './runs';
import { creditsOfUsd } from './admin/settings';
import { siteForecasts } from './billing';

// The "New keyword ladder" flow (PIPELINE_FEATURE_SPEC.md §5): the keyword check of one typed keyword (n8n's Keyword Check,
// SEOagentAssess, paid: DataForSEO ~$0.02-0.05 a check) and the recommended keywords from the website's latest keyword strategy
// (free). Order of a check: the stored answer of the last few hours made by the same engine rules for the same website context (free,
// no call) -> the daily limit and the budget under the
// company's lock (keywordCheckStore.reserveCheck) -> n8n -> the answer stored with its cost, or the error mapped for people.

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown): number | null => (v == null || v === '' || typeof v === 'boolean' || !Number.isFinite(Number(v)) ? null : Number(v));

/** Every ladder of the website with its main and page keywords (seo_ladders rows of the domain). */
export function ladderKeywordsOf(rows: LadderRow[]): LadderKeywords[] {
  const by = new Map<string, LadderRow[]>();
  for (const r of rows) if (r.ladder_id && r.keyword) by.set(r.ladder_id, [...(by.get(r.ladder_id) ?? []), r]);
  return [...by.entries()].map(([id, list]) => ({
    id,
    head: str(list[0].head_keyword) || str(list.find((r) => Number(r.rung) === 4)?.keyword),
    keywords: [...new Set(list.map((r) => str(r.keyword)).filter(Boolean))],
  }));
}

/** The n8n request body (POST /webhook/seo-keyword-assess). The website's ladder keywords are never suggested back as alternatives. */
export function assessBody(o: { site: Pick<SiteRow, 'domain' | 'business'>; keyword: string; country: string; existing: string[]; services: string[] }): Record<string, unknown> {
  const existing = [...new Set(o.existing.map((k) => k.trim().toLowerCase()).filter((k) => k.length >= 2 && k.length <= 120))].slice(0, 300);
  const services = [...new Set(o.services.map((x) => x.trim()).filter((x) => x.length >= 2))].slice(0, 20).map((x) => x.slice(0, 120));
  return {
    keyword: o.keyword,
    country: o.country,
    domain: o.site.domain,
    // without it the engine uses the website's stored homepage description
    ...(o.site.business.trim() ? { business: o.site.business.trim().slice(0, 1500) } : {}),
    services,
    existing_keywords: existing,
  };
}

// ---- KW-APP D6 (2026-10-21, live run): which stored answers may be shown again ----
// The engine reports no version of its own in the check's answer, so the rules version is the engine's keyword fit gate as this build of
// the app carries it: fit-gate.generated.js is written from the engine's kit by build_v4.py (KW-PARITY), so it changes whenever the gate
// the engine runs changes. Engine changes outside the gate are bounded by the short reuse window (KEYWORD_CHECK.cacheHours).
const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const src = (v: unknown): string => (typeof v === 'function' ? String(v) : v && typeof v === 'object' ? Object.entries(v).map(([k, x]) => `${k}=${src(x)}`).join('\n') : JSON.stringify(v ?? null));
let rulesVersion = '';
/** A hash of the engine's fit gate as generated into this build ("fg-" + 16 hex characters). */
export function engineRulesVersion(): string {
  if (!rulesVersion) {
    const parts = { fitGate, fitTopic, fitEvidence, fitStored, fitStoredLive, fitTokens, fitLabels, fitOwnLabels, fitLearnedBrands, fitBrandList, FITR };
    rulesVersion = `fg-${sha(Object.entries(parts).map(([k, v]) => `${k}:${src(v)}`).join('\n'))}`;
  }
  return rulesVersion;
}

const sorted = (xs: readonly unknown[] | null | undefined) => [...new Set((xs ?? []).map((x) => String(x ?? '').trim().toLowerCase()).filter(Boolean))].sort();
/**
 * The website context a check was made for: what is sent to the engine (domain, business, services, the ladder keywords never suggested
 * back) and what the engine reads from the website's settings (brand names, competitors). Any change and the stored answer is not reused.
 */
export function checkContextHash(o: { site: Pick<SiteRow, 'domain' | 'business'> & Partial<Pick<SiteRow, 'brandNames' | 'competitors'>>; services: string[]; existing: string[] }): string {
  return sha(
    JSON.stringify({
      domain: o.site.domain.toLowerCase(),
      business: (o.site.business ?? '').trim(),
      services: sorted(o.services),
      brandNames: sorted(o.site.brandNames),
      competitors: sorted(o.site.competitors),
      existing: sorted(o.existing),
    }),
  );
}

export type AssessOutcome = { ok: true; raw: Record<string, unknown>; costUsd: number } | { ok: false; error: HttpError; reachedEngine: boolean };

/**
 * n8n's answer for people. `reachedEngine`: the engine may have spent money on it (DataForSEO calls ran), such a failure counts in
 * the daily limit; a refusal before any paid call (validation, limit, workflow off, key refused, not reachable) does not.
 */
export function interpretAssess(res: AssessCallResult): AssessOutcome {
  if (res.kind === 'unreachable') return { ok: false, reachedEngine: false, error: new HttpError(502, 'The SEO engine is not reachable right now. Nothing was charged; try again in a few minutes.', 'engine_unreachable') };
  if (res.kind === 'timeout') return { ok: false, reachedEngine: true, error: new HttpError(502, 'The keyword check took too long to answer. Try again in a few minutes.', 'engine_timeout') };
  const j = res.json;
  if (res.status === 200 && j.ok === true && str(j.keyword)) {
    const reported = num(j.cost_usd);
    const costUsd = reported != null && reported >= 0 && reported < 1 ? Math.round(reported * 10000) / 10000 : KEYWORD_CHECK.estimateUsd;
    return { ok: true, raw: j, costUsd };
  }
  if (res.status === 400) {
    const errs = j.errors && typeof j.errors === 'object' ? (j.errors as Record<string, unknown>) : {};
    const fields: Record<string, string> = {};
    if (str(errs.keyword)) fields.keyword = 'Use 2-100 characters';
    if (str(errs.country)) fields.country = 'Choose one of the listed countries';
    const why = providerFree(str(j.error).slice(0, 200));
    return { ok: false, reachedEngine: false, error: new HttpError(400, `The SEO engine could not check this keyword${why ? `: ${why}` : ''}.`, 'validation', Object.keys(fields).length ? fields : undefined) };
  }
  if (res.status === 429)
    return { ok: false, reachedEngine: false, error: new HttpError(429, "The SEO engine's daily limit of keyword checks is reached. Try again tomorrow, or pick one of the recommended keywords (they are free).", 'engine_limit') };
  if (res.status === 404) return { ok: false, reachedEngine: false, error: new HttpError(502, 'The keyword check is not switched on in the SEO engine (workflow SEOagentAssess). Nothing was charged.', 'engine_off') };
  if (res.status === 401 || res.status === 403) return { ok: false, reachedEngine: false, error: new HttpError(502, "The SEO engine refused the app's key. Nothing was charged.", 'engine_key') };
  const why = providerFree(str(j.error).slice(0, 160));
  return { ok: false, reachedEngine: true, error: new HttpError(502, `Could not check this keyword right now${why ? ` (${why})` : ''}. Try again in a few minutes.`, 'engine_failed') };
}

/** credits (app/docs/CREDITS.md): an engine reason that names a dollar balance or a provider is left out of the customer's message */
const providerFree = (why: string): string => (namesProviderCost(why) ? '' : why);

export function toKeywordCheck(row: KeywordCheckRow, cached: boolean): KeywordCheck {
  return { id: row.id, siteId: row.siteId, keyword: row.keyword, country: row.country, result: toAssessment(row.result), credits: cached ? 0 : creditsOfUsd(row.costUsd), createdAt: row.createdAt.toISOString(), cached };
}

/** The website's ladder keywords (main and pages) from n8n; none when n8n cannot be read (the check still works). */
async function existingKeywords(domain: string): Promise<string[]> {
  const rows = await siteRows<LadderRow>('ladders', domain, { max: 2000 }).catch(() => [] as LadderRow[]);
  return ladderKeywordsOf(rows).flatMap((l) => [l.head, ...l.keywords]);
}

/** Services the business delivered (its case studies), for the topic check. */
async function siteServices(domain: string): Promise<string[]> {
  const rows = await siteRows<CaseStudyRow>('caseStudies', domain, { max: 50 }).catch(() => [] as CaseStudyRow[]);
  return rows.map((r) => str(r.service));
}

/**
 * POST .../keywords/assess: the stored answer of the last few hours, same rules and context (free), else one paid check. `automatic`: the system asked for it (the
 * queued-ladder re-check), on the owner's behalf: it is the website's autopilot spend, never the person's on-demand spend (costSync).
 */
export async function assessKeyword(a: Pick<SiteAccess, 'org' | 'site' | 'user'>, input: KeywordAssessInput, opts: { automatic?: boolean } = {}): Promise<KeywordCheck> {
  const { org, site, user } = a;
  requireVerified(site);
  if (org.disabled) throw forbidden('This company is disabled. Contact the platform administrator.');
  if (config.requireEmailVerification && !user.emailVerifiedAt) throw forbidden('Verify your e-mail address before checking keywords (check your inbox, or resend the link from your account page).');
  const country = input.country ?? ((COUNTRY_NAMES as readonly string[]).includes(site.country) ? site.country : '');
  if (!country) throw badRequest('Choose the country to check it in', { country: 'Choose a country' });
  const keyword = input.keyword;

  // what the website sells: the client's own words ("What do you sell?") first, then its case studies; read before the stored answer is
  // considered, because a stored answer counts only for the same context (KW-APP D6)
  const [existing, studied] = await Promise.all([existingKeywords(site.domain), siteServices(site.domain)]);
  const services = [...(site.services ?? []), ...studied];
  const stamp: CheckStamp = { rulesVersion: engineRulesVersion(), contextHash: checkContextHash({ site, services, existing }) };
  const cached = await findRecentCheck(site.id, keyword, country, new Date(Date.now() - KEYWORD_CHECK.cacheHours * 3600_000), stamp);
  if (cached) return toKeywordCheck(cached, true);

  // the schedules' forecast is read outside the company's lock (the credit check inside reads it), as createRun does
  await siteForecasts(org.id).catch(() => []);
  const id = await reserveCheck({ org, site, user, keyword, country, automatic: opts.automatic === true, stamp });
  let outcome: AssessOutcome;
  try {
    outcome = interpretAssess(await assessCall(assessBody({ site, keyword, country, existing, services }), org.id, KEYWORD_CHECK.timeoutMs));
  } catch (err) {
    await dropCheck(id, false).catch(() => undefined);
    throw err;
  }
  if (!outcome.ok) {
    await dropCheck(id, outcome.reachedEngine).catch(() => undefined);
    throw outcome.error;
  }
  return toKeywordCheck(await finishCheck(id, outcome.raw, outcome.costUsd), false);
}

/** GET .../keywords/recommended: the keywords of the website's latest keyword strategy report, marked when a ladder covers them. */
export async function recommendedKeywords(org: OrgRow, site: SiteRow, now = Date.now()): Promise<RecommendedKeywords> {
  const [latest, rows] = await Promise.all([latestReport(org.id, site.id, ['keyword_strategy']), siteRows<LadderRow>('ladders', site.domain, { max: 2000 }).catch(() => [] as LadderRow[])]);
  if (!latest) return { reportId: null, receivedAt: null, ageDays: null, stale: false, reach: null, country: null, keywords: [] };
  const ageDays = daysSince(latest.report.receivedAt, now);
  const reach = latest.payload.reach && typeof latest.payload.reach === 'object' ? num((latest.payload.reach as Record<string, unknown>).reach) : null;
  return {
    reportId: latest.report.id,
    receivedAt: latest.report.receivedAt,
    ageDays,
    stale: ageDays > RECOMMENDATIONS_MAX_AGE_DAYS,
    reach,
    country: (COUNTRY_NAMES as readonly string[]).includes(str(latest.payload.country)) ? str(latest.payload.country) : null,
    keywords: recommendedFromStrategy(latest.payload, ladderKeywordsOf(rows)),
  };
}
