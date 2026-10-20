import { and, desc, eq, inArray } from 'drizzle-orm';
import { RECOMMENDATIONS_MAX_AGE_DAYS, discoverInput, registrableDomain, type RecommendedKeywords, type ResearchStartResult, type ResearchStatus } from '@seo/shared';
import type { OrgAccess } from '../auth/access';
import { requireVerified } from '../auth/access';
import { db, schema } from '../db';
import type { OrgRow, RunRow, SiteRow } from '../db/schema';
import { HttpError } from '../lib/errors';
import { quoteCredits } from './billing';
import { settingsRow } from './admin/settings';
import { estimateCost, createRunWithMeta } from './runs';
import { recommendedKeywords } from './keywordChecks';

// Keyword research in the background at setup (SCHEDULING_KEYWORDS_PLAN.md §5.2, owner decision D3): the business step starts one
// discovery run (`mode: discover`, never a page) so the suggestions are ready when the owner reaches "Your first keyword".
// It is FREE ONCE PER WEBSITE, AT SETUP ONLY, and the exemption is exact:
//   * once per website: the grant is keyed by the REGISTRABLE DOMAIN (free_research_grants.domain is the primary key; the engine's rule,
//     shared registrableDomain), so deleting the website and adding it again, adding it in another company, or adding its subdomains one
//     by one never earns a second free research (a subdomain of a hosting platform is its own website); grants stored by the full domain
//     before 2026-10-20 still count; the grant is claimed inside one insert, so two requests at once get one free run;
//   * at setup only: while the website's tracking has not started, or within SETUP_HOURS of its start (the onboarding launch);
//   * a run the engine explicitly refused (it answered 4xx: validation, key, limit, workflow off) gives the grant back, because nothing
//     was done; a run that ran, failed or not, keeps it used, and so does a start with no answer (a timeout or a 5xx: the engine may be
//     working on it, so a second free run could be a second research);
//   * the free run is quoted at 0 credits, which caps every charge of it at 0 (the cost sync never charges a run beyond its quote); the
//     platform's own daily ceiling still applies to it.
// Later research (a stale list, "Find keywords for me") is a normal paid run through POST /runs; this endpoint answers 409 `research_not_free`
// with its price in credits instead of charging anything on its own.

export const SETUP_HOURS = 24;
const ACTIVE = ['submitting', 'accepted', 'running'];

/** Whether the website may have its free research now (pure): not granted before for its domain, and still at setup. */
export function freeResearchAllowed(site: Pick<SiteRow, 'trackingStatus' | 'trackingStartedAt'>, granted: boolean, now = Date.now()): boolean {
  if (granted) return false;
  if (site.trackingStatus === 'not_started' || !site.trackingStartedAt) return true;
  return now - site.trackingStartedAt.getTime() <= SETUP_HOURS * 3_600_000;
}

/** The research state (pure): a discovery run of the last 12 hours still going, else fresh research on file, else none. */
export function researchStatusOf(run: Pick<RunRow, 'status' | 'createdAt'> | null, recommended: Pick<RecommendedKeywords, 'reportId' | 'ageDays'>, now = Date.now()): ResearchStatus {
  if (run && ACTIVE.includes(run.status) && now - run.createdAt.getTime() < 12 * 3_600_000) return 'running';
  if (recommended.reportId && recommended.ageDays != null && recommended.ageDays <= RECOMMENDATIONS_MAX_AGE_DAYS) return 'ready';
  return 'none';
}

/** The key of a website's free research: its registrable domain (and the full domain, how grants were keyed before). */
export const grantKeys = (domain: string): string[] => [...new Set([registrableDomain(domain), domain])];
const grantOf = (domain: string) => db.query.freeResearchGrants.findFirst({ where: inArray(schema.freeResearchGrants.domain, grantKeys(domain)) });

/** Whether a failed start gives the free research back (pure): only when the engine answered and refused it (4xx). */
export function grantGivenBack(run: Pick<RunRow, 'status'>, engineStatus: number | null | undefined): boolean {
  return run.status === 'failed' && typeof engineStatus === 'number' && engineStatus >= 400 && engineStatus < 500;
}

type StartFn = (a: OrgAccess, input: Parameters<typeof createRunWithMeta>[1], opts: Parameters<typeof createRunWithMeta>[2]) => Promise<{ run: RunRow; engineStatus?: number | null }>;

const latestDiscover = async (siteId: string) => (await db.query.runs.findFirst({ where: and(eq(schema.runs.siteId, siteId), eq(schema.runs.mode, 'discover')), orderBy: desc(schema.runs.createdAt) })) ?? null;

/** GET .../keywords/recommended, with `status`, `startedAt` and whether the free research is still available. */
export async function recommendedWithStatus(org: OrgRow, site: SiteRow, now = Date.now()): Promise<RecommendedKeywords> {
  const [rec, run, grant] = await Promise.all([recommendedKeywords(org, site, now), latestDiscover(site.id), grantOf(site.domain)]);
  const status = researchStatusOf(run, rec, now);
  return { ...rec, status, startedAt: run && status === 'running' ? run.createdAt.toISOString() : null, runId: run && status === 'running' ? run.id : null, freeResearch: freeResearchAllowed(site, !!grant, now) };
}

// Rehearsal 2026-10-20 (real engine): the automatic research asks for the keyword strategy only. With the schema's default
// receiveReport: true the engine also ran a full keyword report on its own top pick (a second paid run under a run quoted free),
// which nobody reads at setup. The same holds for the level-3 research refresh (autoStart.ts).
export const inputOf = (site: SiteRow) =>
  discoverInput.parse({ mode: 'discover', siteId: site.id, country: site.country, business: site.business.slice(0, 500), customers: site.customers.slice(0, 300), businessFacts: site.businessFacts.slice(0, 2000), goal: site.goal, receiveReport: false, emailCopy: false });

/** POST .../research/start: the free research at setup, or the research already going / fresh. 409 `research_not_free` otherwise. */
export async function startResearch(a: OrgAccess & { site: SiteRow }, now = Date.now(), start: StartFn = createRunWithMeta): Promise<ResearchStartResult> {
  const site = a.site;
  requireVerified(site);
  if (!site.business.trim() && !site.services.length)
    throw new HttpError(400, 'Tell us what you sell first (the business step), so the research looks for the right keywords.', 'validation', { business: 'Describe your business' });
  const [rec, run] = await Promise.all([recommendedKeywords(a.org, site, now), latestDiscover(site.id)]);
  const status = researchStatusOf(run, rec, now);
  if (status === 'running') return { status, runId: run!.id, startedAt: run!.createdAt.toISOString(), free: run!.input?.freeResearch === true, started: false };
  if (status === 'ready') return { status, runId: null, startedAt: null, free: false, started: false };
  const input = inputOf(site);
  const granted = await grantOf(site.domain);
  const key = registrableDomain(site.domain);
  if (!freeResearchAllowed(site, !!granted, now)) {
    const credits = quoteCredits(await estimateCost(input), await settingsRow());
    throw new HttpError(409, granted ? 'The free keyword research of this website was used at setup. Start it again from the keyword research form (it uses credits).' : 'Free keyword research is part of setting a website up. Start it from the keyword research form (it uses credits).', 'research_not_free', undefined, { credits });
  }
  // claim the domain's grant: one insert, so two requests at once get one free run
  const [claim] = await db.insert(schema.freeResearchGrants).values({ domain: key, orgId: a.org.id, siteId: site.id }).onConflictDoNothing().returning();
  if (!claim) {
    const again = await latestDiscover(site.id);
    if (again && ACTIVE.includes(again.status)) return { status: 'running', runId: again.id, startedAt: again.createdAt.toISOString(), free: true, started: false };
    throw new HttpError(409, 'The free keyword research of this website was used at setup.', 'research_not_free');
  }
  let r: RunRow;
  let engineStatus: number | null | undefined;
  try {
    ({ run: r, engineStatus } = await start(a, input, { free: true }));
  } catch (err) {
    // refused by the app before anything reached the engine (the platform's ceiling, a disabled company): nothing ran
    await db.delete(schema.freeResearchGrants).where(eq(schema.freeResearchGrants.domain, key));
    throw err;
  }
  // only an explicit refusal by the engine (4xx) gives the grant back; a timeout or a 5xx keeps it used (the engine may have started it)
  if (grantGivenBack(r, engineStatus)) await db.delete(schema.freeResearchGrants).where(eq(schema.freeResearchGrants.domain, key));
  else await db.update(schema.freeResearchGrants).set({ runId: r.id }).where(eq(schema.freeResearchGrants.domain, key));
  return { status: r.status === 'failed' ? 'none' : 'running', runId: r.id, startedAt: r.createdAt.toISOString(), free: true, started: r.status !== 'failed' };
}
